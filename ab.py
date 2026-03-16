import os
import ee
import warnings
from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
from geopy.geocoders import Nominatim
from dotenv import load_dotenv

# Load local environment variables if they exist
load_dotenv()

# --- SUPPRESS WARNINGS ---
warnings.filterwarnings("ignore", category=FutureWarning)

app = Flask(__name__)

# Update CORS to be more secure for production later
CORS(app)

# --- INITIALIZE EARTH ENGINE (Cloud-Ready) ---
try:
    ee_project = os.getenv('EE_PROJECT_ID')
    service_account = os.getenv('EE_SERVICE_ACCOUNT')
    private_key = os.getenv('EE_PRIVATE_KEY')

    if service_account and private_key:
        # PRODUCTION: Uses Service Account (Render)
        # We handle potential escaped newlines from environment variables
        formatted_key = private_key.replace('\\n', '\n')
        credentials = ee.ServiceAccountCredentials(service_account, key_data=formatted_key)
        ee.Initialize(credentials, project=ee_project)
        print(f"✅ EE Initialized via Service Account: {service_account}")
    else:
        # LOCAL: Uses your local gcloud authentication
        ee.Initialize(project=ee_project)
        print(f"✅ EE Initialized via Local Auth with project: {ee_project}")
except Exception as e:
    print(f"❌ EE Initialization Error: {e}")

# --- AI CONFIGURATION ---
api_key = os.getenv('GEMINI_API_KEY')

def get_ai_client():
    return genai.Client(api_key=api_key)

DW_CLASSES = {0: "Water", 1: "Trees", 2: "Grass", 3: "Flooded Vegetation",
              4: "Crops", 5: "Shrub & Scrub", 6: "Built Area", 7: "Bare Ground", 8: "Snow & Ice"}

@app.route('/api/analyze-lulc', methods=['POST'])
def analyze_lulc():
    try:
        data = request.json
        # Set default start year to 2016 as requested
        year_start = int(data.get('year_start', 2016))
        year_end = int(data.get('year_end', 2024))
        region = ee.Geometry(data['geojson'])
        
        dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1').filterBounds(region)

        actual_s, actual_e = year_start, year_end
        while actual_s < year_end and dw.filterDate(f'{actual_s}-01-01', f'{actual_s}-12-31').limit(1).size().getInfo() == 0: actual_s += 1
        while actual_e > actual_s and dw.filterDate(f'{actual_e}-01-01', f'{actual_e}-12-31').limit(1).size().getInfo() == 0: actual_e -= 1

        img_s = dw.filterDate(f'{actual_s}-01-01', f'{actual_s}-12-31').select('label').mode().clip(region)
        img_e = dw.filterDate(f'{actual_e}-01-01', f'{actual_e}-12-31').select('label').mode().clip(region)

        transition_img = img_s.multiply(10).add(img_e)
        changed_mask = img_s.neq(img_e)
        masked_transition = transition_img.updateMask(changed_mask)

        area_image = ee.Image.pixelArea().addBands(masked_transition)

        stats = area_image.reduceRegion(
            reducer=ee.Reducer.sum().group(groupField=1, groupName='code'),
            geometry=region, 
            scale=10, 
            maxPixels=1e13 
        )

        groups = stats.get('groups').getInfo()
        results = []
        total_km2 = 0
        
        if groups:
            for g in groups:
                area_km2 = g['sum'] / 1e6 
                if area_km2 > 0.0001: 
                    total_km2 += area_km2
                    from_code, to_code = int(g['code'] // 10), int(g['code'] % 10)
                    results.append({
                        'from': DW_CLASSES.get(from_code, "Unknown"), 
                        'to': DW_CLASSES.get(to_code, "Unknown"), 
                        'area_km2': round(area_km2, 4), 
                        'raw': area_km2 
                    })
        
        results.sort(key=lambda x: x['raw'], reverse=True)
        return jsonify({
            'total_changed_km2': round(total_km2, 4), 
            'dominant_shift': results[0]['to'] if results else "Stable", 
            'transitions': results[:10], 
            'analyzed_period': f'{actual_s}-{actual_e}'
        })
    except Exception as e: 
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-inference', methods=['POST'])
def generate_inference():
    data = request.json
    coords = data.get('coords')
    
    location_full = "the analyzed area"
    if coords:
        try:
            geolocator = Nominatim(user_agent="lulc_seminar_app", timeout=5)
            location = geolocator.reverse(f"{coords['lat']}, {coords['lon']}", language='en')
            if location:
                addr = location.raw.get('address', {})
                city = addr.get('city') or addr.get('town') or addr.get('village') or addr.get('suburb') or "Selected Area"
                state = addr.get('state') or "India"
                location_full = f"{city}, {state}"
        except Exception as e: 
            print(f"⚠️ Geocoder warning: {e}")

    models_to_try = ['gemini-2.0-flash', 'gemini-1.5-flash'] 
    prompt = f"As a Senior Urban Planner, analyze {location_full}. Total change: {data.get('total_changed_km2')} km2, primary shift: {data.get('dominant_shift')}. Write a 100-word professional report. No formatting."

    for model_id in models_to_try:
        try:
            client = get_ai_client()
            response = client.models.generate_content(model=model_id, contents=prompt)
            return jsonify({'inference': response.text, 'used_model': model_id, 'location': location_full})
        except Exception as e:
            continue

    return jsonify({
        'inference': f"Report for {location_full}: Urban growth of {data.get('total_changed_km2')} km2 detected.",
        'used_model': 'Local Fallback', 'location': location_full
    })

@app.route('/api/get-lulc-thumb', methods=['POST'])
def get_lulc_thumb():
    try:
        data = request.json
        year, region = int(data.get('year', 2024)), ee.Geometry(data['geojson'])
        img = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1').filterDate(f'{year}-01-01', f'{year}-12-31').filterBounds(region).select('label').mode().clip(region)
        palette = ['419bdf', '397d49', '88b053', '7a87c6', 'e49635', 'dfc35a', 'c4281b', 'a59b8f', 'b39fe1']
        return jsonify({'url': img.getThumbURL({'min': 0, 'max': 8, 'palette': palette, 'dimensions': 1000, 'region': region, 'format': 'png'})})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/get-satellite-thumb', methods=['POST'])
def get_satellite_thumb():
    try:
        data = request.json
        year, region = int(data.get('year', 2024)), ee.Geometry(data['geojson'])
        try:
            img = ee.ImageCollection('COPERNICUS/S2_HARMONIZED').filterBounds(region).filterDate(f'{year}-01-01', f'{year}-12-31').filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10)).median().clip(region)
            thumb_url = img.getThumbURL({'bands': ['B4', 'B3', 'B2'], 'min': 0, 'max': 3000, 'gamma': 1.4, 'region': region, 'dimensions': 1000, 'format': 'png'})
        except:
            thumb_url = ee.Image.constant([200, 200, 200]).clip(region).getThumbURL({'min': 0, 'max': 255, 'region': region, 'dimensions': 1000, 'format': 'png'})
        return jsonify({'url': thumb_url})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Local dev server
    app.run(debug=True, port=5000)