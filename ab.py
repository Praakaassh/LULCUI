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
#  ROUTE 1: LULC VISUALIZATION (Used by lulcview.jsx)
# =========================================================
@app.route('/api/get-gee-layer', methods=['POST'])
def get_gee_layer():
    try:
        data = request.json
        year = int(data.get('year'))
        geojson = data.get('geojson')
        region = ee.Geometry(geojson)

        # 1. Load Data
        dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1') \
            .filterDate(f'{year}-01-01', f'{year}-12-31') \
            .filterBounds(region)

        # 2. Create Sharp Composite
        def add_confidence(image):
            confidence = image.select(ee.List.sequence(0, 8)) \
                .reduce(ee.Reducer.max()).rename('confidence')
            return image.addBands(confidence)

        sharp_image = dw.map(add_confidence).qualityMosaic('confidence')
        
        # 3. CRITICAL SETTING: 
        # We REMOVED .reproject() here. This fixes the "Black Screen" on large areas.
        # It allows the LULC View to load fast at any zoom level.
        final_image = sharp_image.select('label').clip(region)

        # 4. Visualization (COLORS)
        # This ensures lulcview.jsx shows colors, not just black/white
        vis_params = {
            'min': 0, 'max': 8,
            'palette': [
                '419bdf', # Water
                '397d49', # Trees
                '88b053', # Grass
                '7a87c6', # Flooded Veg
                'e49635', # Crops
                'dfc35a', # Shrub & Scrub
                'c4281b', # Built-up (Red)
                'a59b8f', # Bare
                'b39fe1'  # Snow
            ]
        }

        map_id = final_image.getMapId(vis_params)
        return jsonify({'url': map_id['tile_fetcher'].url_format})

    except Exception as e:
        print(f"Route 1 Error: {e}")
        return jsonify({'error': str(e)}), 500


# =========================================================
#  ROUTE 2: STATISTICS (Used by Development.jsx)
# =========================================================
@app.route('/api/calculate-change', methods=['POST'])
def calculate_change():
    try:
        data = request.json
        year_start = int(data.get('year_start'))
        year_end = int(data.get('year_end'))
        geojson = data.get('geojson')
        region = ee.Geometry(geojson)

        # Helper to get collection safely
        def get_data(y):
            return ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1') \
                .filterDate(f'{y}-01-01', f'{y}-12-31') \
                .filterBounds(region).select('label')

        col_start = get_data(year_start)
        col_end = get_data(year_end)

        # --- SAFETY FIX ---
        # If 2015 is empty (common issue), try 2016 automatically.
        if col_start.size().getInfo() == 0 and year_start == 2015:
            print(f"⚠️ Data missing for {year_start}. Falling back to 2016.")
            year_start = 2016
            col_start = get_data(2016)

        # Final Empty Check
        if col_start.size().getInfo() == 0:
            return jsonify({'error': f"No data available for start year {year_start}"}), 400
        if col_end.size().getInfo() == 0:
            return jsonify({'error': f"No data available for end year {year_end}"}), 400

        # Calculations
        # We use .mode() for stats to get the most common land cover type per pixel
        img_start = col_start.mode().clip(region)
        img_end = col_end.mode().clip(region)
        
        URBAN_CLASS = 6
        
        # Calculate pixels that turned INTO Urban
        urban_growth = img_start.neq(URBAN_CLASS).And(img_end.eq(URBAN_CLASS))
        
        # We keep scale=10 here for accuracy, but since it's a number (reduceRegion),
        # it won't crash the map visualization.
        stats = ee.Image.pixelArea().updateMask(urban_growth).reduceRegion(
            reducer=ee.Reducer.sum(), 
            geometry=region, 
            scale=10, 
            maxPixels=1e10, 
            bestEffort=True
        )
        
        growth_sq_m = stats.get('area').getInfo() or 0
        growth_km2 = growth_sq_m / 1e6
        years_diff = max(1, year_end - year_start)
        
        return jsonify({
            'growth_km2': round(growth_km2, 4),
            'rate_per_year': round(growth_km2 / years_diff, 4),
            'period': f"{year_start}-{year_end}"
        })

    except Exception as e:
        print(f"Route 2 Error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)