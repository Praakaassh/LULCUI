from flask import Flask, request, jsonify
from flask_cors import CORS
import ee

app = Flask(__name__)
CORS(app)

# --- INITIALIZE EARTH ENGINE ---
try:
    ee.Initialize(project='lulc-470905')
    print("✅ Earth Engine Initialized Successfully.")
except Exception as e:
    print(f"❌ Authentication error: {e}")

# =========================================================
#  ROUTE 1: LULC VISUALIZATION (UNCHANGED)
# =========================================================
@app.route('/api/get-gee-layer', methods=['POST'])
def get_gee_layer():
    try:
        data = request.json
        year = int(data.get('year'))
        geojson = data.get('geojson')
        region = ee.Geometry(geojson)

        dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1') \
            .filterDate(f'{year}-01-01', f'{year}-12-31') \
            .filterBounds(region)

        def add_confidence(image):
            confidence = image.select(ee.List.sequence(0, 8)) \
                .reduce(ee.Reducer.max()).rename('confidence')
            return image.addBands(confidence)

        sharp_image = dw.map(add_confidence).qualityMosaic('confidence')
        final_image = sharp_image.select('label').clip(region)

        vis_params = {
            'min': 0, 'max': 8,
            'palette': [
                '419bdf', '397d49', '88b053', '7a87c6',
                'e49635', 'dfc35a', 'c4281b', 'a59b8f', 'b39fe1'
            ]
        }

        map_id = final_image.getMapId(vis_params)
        return jsonify({'url': map_id['tile_fetcher'].url_format})

    except Exception as e:
        print(f"Route 1 Error: {e}")
        return jsonify({'error': str(e)}), 500


# =========================================================
#  ROUTE 2: DEVELOPMENT RATE (YEAR-WISE AVERAGING)
# =========================================================
@app.route('/api/calculate-change', methods=['POST'])
def calculate_change():
    try:
        data = request.json
        year_start = int(data.get('year_start'))
        year_end = int(data.get('year_end'))
        geojson = data.get('geojson')
        region = ee.Geometry(geojson)

        URBAN_CLASS = 6
        dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1').filterBounds(region)

        total_growth_area = 0
        intervals = 0

        def yearly_lulc(y):
            col = dw.filterDate(f'{y}-01-01', f'{y}-12-31').select('label')
            return col.mode().clip(region)

        # --- YEAR-WISE GROWTH LOOP ---
        for year in range(year_start, year_end):
            img_curr = yearly_lulc(year)
            img_next = yearly_lulc(year + 1)

            yearly_growth = img_curr.neq(URBAN_CLASS).And(
                img_next.eq(URBAN_CLASS)
            )

            stats = ee.Image.pixelArea().updateMask(yearly_growth).reduceRegion(
                reducer=ee.Reducer.sum(),
                geometry=region,
                scale=10,
                maxPixels=1e10,
                bestEffort=True
            )

            area = stats.get('area').getInfo()
            if area:
                total_growth_area += area
                intervals += 1

        if intervals == 0:
            return jsonify({'error': 'No urban development detected'}), 400

        total_growth_km2 = total_growth_area / 1e6
        avg_rate = total_growth_km2 / intervals

        return jsonify({
            'growth_km2': round(total_growth_km2, 4),
            'rate_per_year': round(avg_rate, 4),
            'period': f"{year_start}-{year_end}"
        })

    except Exception as e:
        print(f"Route 2 Error: {e}")
        return jsonify({'error': str(e)}), 500
# =========================================================
#  ROUTE 3: FUTURE DEVELOPMENT HEATMAP (PREDICTION)
# =========================================================
@app.route('/api/get-future-heatmap', methods=['POST'])
def get_future_heatmap():
    try:
        data = request.json
        year_start = int(data.get('year_start'))  # e.g. 2015
        year_end = int(data.get('year_end'))      # e.g. 2024
        geojson = data.get('geojson')
        region = ee.Geometry(geojson)

        URBAN = 6
        dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1').filterBounds(region)

        growth_stack = []

        def yearly_lulc(y):
            return dw.filterDate(f'{y}-01-01', f'{y}-12-31') \
                     .select('label').mode()

        # --- Collect year-wise growth ---
        for y in range(year_start, year_end):
            curr = yearly_lulc(y)
            nxt = yearly_lulc(y + 1)

            growth = curr.neq(URBAN).And(nxt.eq(URBAN))
            growth_stack.append(growth)

        # --- Aggregate historical growth intensity ---
        intensity = ee.ImageCollection(growth_stack).sum().clip(region)

        # --- Normalize to 0–1 (probability) ---
        max_val = intensity.reduceRegion(
            reducer=ee.Reducer.max(),
            geometry=region,
            scale=10,
            bestEffort=True
        ).values().get(0)

        probability = intensity.divide(ee.Number(max_val))

        # --- Spatial diffusion (future likelihood) ---
        kernel = ee.Kernel.gaussian(
        radius=150,
        sigma=75,
        units='meters',
        normalize=True
        )

        probability = probability.convolve(kernel)


        # --- Serve as heatmap ---
        map_id = probability.getMapId({
        'min': 0,
        'max': 1,
        'palette': ['000000', 'ffff00', 'ff0000']
        })


        return jsonify({'url': map_id['tile_fetcher'].url_format})

    except Exception as e:
        print(f"Heatmap Error: {e}")
        return jsonify({'error': str(e)}), 500



if __name__ == '__main__':
    app.run(debug=True, port=5000)
