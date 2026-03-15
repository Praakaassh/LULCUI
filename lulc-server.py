import ee
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    return response

# --- INITIALIZE EARTH ENGINE ---
try:
    ee.Initialize(project='lulc-470905')
    print("✅ Earth Engine Initialized.")
except Exception as e:
    print(f"❌ EE Initialization Error: {e}")

DW_PALETTE = ['419bdf', '397d49', '88b053', '7a87c6',
              'e49635', 'dfc35a', 'c4281b', 'a59b8f', 'b39fe1']


@app.route('/api/get-gee-layer', methods=['POST', 'OPTIONS'])
def get_gee_layer():
    if request.method == 'OPTIONS':
        return '', 200

    try:
        data = request.json
        print(f"📥 Request: year={data.get('year')}")

        if not data or 'year' not in data or 'geojson' not in data:
            return jsonify({'error': 'Missing year or geojson'}), 400

        year = int(data['year'])
        region = ee.Geometry(data['geojson'])

        if year < 2015 or year > 2025:
            return jsonify({'error': f'Year {year} out of range. Use 2015–2025.'}), 400

        # FIX: No .getInfo() calls — build the image directly and let getMapId fail fast
        # if there's no data, instead of hanging on size().getInfo()
        for offset in [0, 1, -1, 2, -2, 3, -3]:
            candidate = year + offset
            if candidate < 2015 or candidate > 2025:
                continue
            try:
                col = (ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
                       .filterDate(f'{candidate}-01-01', f'{candidate}-12-31')
                       .filterBounds(region)
                       .select('label'))

                img = col.mode().clip(region)

                # getMapId is the only blocking call — throws if collection is empty
                map_id = img.getMapId({'min': 0, 'max': 8, 'palette': DW_PALETTE})

                print(f"✅ Tile URL generated for year {candidate}")
                if candidate != year:
                    print(f"⚠️  No data for {year}, served {candidate}")

                return jsonify({
                    'url': map_id['tile_fetcher'].url_format,
                    'actual_year': candidate
                })

            except Exception as inner_e:
                print(f"  ⚠️  Year {candidate} failed: {inner_e}")
                continue

        return jsonify({'error': f'No Dynamic World data found near {year} for this region.'}), 404

    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'port': 5002})


if __name__ == '__main__':
    print("🚀 LULC Viewer starting on http://localhost:5002")
    app.run(host='0.0.0.0', debug=True, port=5002, threaded=True)