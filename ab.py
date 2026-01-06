from flask import Flask, request, jsonify
from flask_cors import CORS
import ee

app = Flask(__name__)
CORS(app)

# Initialize GEE (Make sure you are logged in via 'earthengine authenticate')
# Replace with your actual project ID
ee.Initialize(project='lulc-470905') 

@app.route('/api/get-gee-layer', methods=['POST'])
def get_gee_layer():
    try:
        data = request.json
        year = int(data.get('year'))
        geojson = data.get('geojson')

        # 1. Define Area of Interest
        region = ee.Geometry(geojson)

        # 2. Load Dynamic World (Sentinel-2 LULC)
        start_date = f'{year}-01-01'
        end_date = f'{year}-12-31'

        # FIX: We use .clip(region.bounds()) instead of .clip(region)
        # This cuts a simple rectangle, which is much faster and prevents
        # the "missing chunk" errors. Your React frontend hides the edges anyway.
        dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1') \
            .filterDate(start_date, end_date) \
            .filterBounds(region) \
            .select('label') \
            .mode() \
            .clip(region.bounds())

        # 3. Define Visualization
        vis_params = {
            'min': 0,
            'max': 8,
            'palette': [
                '419bdf', # Water
                '397d49', # Trees
                '88b053', # Grass
                '7a87c6', # Flooded Veg
                'e49635', # Crops
                'dfc35a', # Shrub & Scrub
                'c4281b', # Built-up (Urban)
                'a59b8f', # Bare
                'b39fe1'  # Snow & Ice
            ]
        }

        # 4. Get the Tile URL
        map_id = dw.getMapId(vis_params)
        tile_url = map_id['tile_fetcher'].url_format

        return jsonify({'url': tile_url})

    except Exception as e:
        print(f"Error: {e}") 
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)