from flask import Flask, request, jsonify
from flask_cors import CORS
import ee

app = Flask(__name__)
CORS(app)

# --- INITIALIZE EARTH ENGINE ---
try:
    ee.Initialize(project='lulc-470905')
    print("✅ Earth Engine Initialized Successfully (Stats Server).")
except Exception as e:
    print(f"❌ Authentication error: {e}")
    try:
        ee.Authenticate()
        ee.Initialize()
    except Exception as inner_e:
        print(f"❌ Critical Auth Error: {inner_e}")

# =========================================================
#  ROUTE 1: LULC VISUALIZATION
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
#  ROUTE 2: DEVELOPMENT RATE (FIXED)
# =========================================================
@app.route('/api/calculate-change', methods=['POST'])
def calculate_change():
    try:
        data = request.json
        year_start = int(data.get('year_start', 2015))
        year_end = int(data.get('year_end', 2024))
        geojson = data.get('geojson')
        region = ee.Geometry(geojson)

        URBAN_CLASS = 6
        dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1').filterBounds(region)

        total_growth_area = 0
        intervals = 0

        print(f"📊 Calculating Stats from {year_start} to {year_end}...")

        # --- YEAR-WISE GROWTH LOOP ---
        for year in range(year_start, year_end):
            # Define exact date ranges
            start_curr, end_curr = f'{year}-01-01', f'{year}-12-31'
            start_next, end_next = f'{year+1}-01-01', f'{year+1}-12-31'

            # 1. CRITICAL FIX: Check if images exist BEFORE processing
            count_curr = dw.filterDate(start_curr, end_curr).limit(1).size().getInfo()
            count_next = dw.filterDate(start_next, end_next).limit(1).size().getInfo()

            # If either year is missing data (0 images), SKIP IT
            if count_curr == 0 or count_next == 0:
                print(f"⚠️ Skipping {year}-{year+1}: Missing satellite data.")
                continue

            # 2. Proceed safely
            img_curr = dw.filterDate(start_curr, end_curr).select('label').mode().clip(region)
            img_next = dw.filterDate(start_next, end_next).select('label').mode().clip(region)

            yearly_growth = img_curr.neq(URBAN_CLASS).And(img_next.eq(URBAN_CLASS))

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
            return jsonify({
                'growth_km2': 0, 
                'rate_per_year': 0, 
                'period': f"{year_start}-{year_end} (No Detectable Growth)"
            })

        total_growth_km2 = total_growth_area / 1e6
        avg_rate = total_growth_km2 / intervals

        print(f"✅ Stats Done: {total_growth_km2} km²")
        return jsonify({
            'growth_km2': round(total_growth_km2, 4),
            'rate_per_year': round(avg_rate, 4),
            'period': f"{year_start}-{year_end}"
        })

    except Exception as e:
        print(f"❌ Route 2 Error: {e}")
        return jsonify({'error': str(e)}), 500

# =========================================================
#  ROUTE 3: FUTURE HEATMAP (Uses Model Server Now)
# =========================================================
# Note: Since you moved the AI prediction to model.py (Port 5001), 
# this route is technically no longer used by the frontend button.
# But we can keep a simple placeholder or the GEE version just in case.
@app.route('/api/get-future-heatmap', methods=['POST'])
def get_future_heatmap():
    return jsonify({"message": "Please use Port 5001 for AI prediction"})

if __name__ == '__main__':
    # ✅ RUNS ON PORT 5000
    app.run(debug=True, port=5000)