import os
import ee
from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
from geopy.geocoders import Nominatim
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# --- INITIALIZE EARTH ENGINE ---
try:
    ee.Initialize(project='lulc-470905')
    print("✅ Earth Engine Initialized.")
except Exception as e:
    print(f"❌ EE Initialization Error: {e}")

API_KEYS = ["AIzaSyC8vnIM2HEQw21Lpa5qvQnsyjXh4LTlgF0"] 
current_key_idx = 0

def get_ai_client():
    return genai.Client(api_key=API_KEYS[current_key_idx])

DW_CLASSES = {0: "Water", 1: "Trees", 2: "Grass", 3: "Flooded Vegetation",
              4: "Crops", 5: "Shrub & Scrub", 6: "Built Area", 7: "Bare Ground", 8: "Snow & Ice"}

@app.route('/api/analyze-lulc', methods=['POST'])
def analyze_lulc():
    try:
        data = request.json
        year_start, year_end = int(data.get('year_start', 2015)), int(data.get('year_end', 2024))
        region = ee.Geometry(data['geojson'])
        dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1').filterBounds(region)

        actual_s, actual_e = year_start, year_end
        while actual_s < year_end and dw.filterDate(f'{actual_s}-01-01', f'{actual_s}-12-31').limit(1).size().getInfo() == 0: actual_s += 1
        while actual_e > actual_s and dw.filterDate(f'{actual_e}-01-01', f'{actual_e}-12-31').limit(1).size().getInfo() == 0: actual_e -= 1

        img_s = dw.filterDate(f'{actual_s}-01-01', f'{actual_s}-12-31').select('label').mode().clip(region)
        img_e = dw.filterDate(f'{actual_e}-01-01', f'{actual_e}-12-31').select('label').mode().clip(region)

        transition_img = img_s.multiply(10).add(img_e)
        stats = ee.Image.pixelArea().addBands(transition_img.updateMask(img_s.neq(img_e))).reduceRegion(
            reducer=ee.Reducer.sum().group(groupField=1, groupName='code'),
            geometry=region, scale=10, maxPixels=1e10, bestEffort=True
        )

        groups = stats.get('groups').getInfo()
        results, total = [], 0
        if groups:
            for g in groups:
                area = g['sum'] / 1e6
                total += area
                results.append({'from': DW_CLASSES.get(int(g['code'] // 10)), 'to': DW_CLASSES.get(int(g['code'] % 10)), 'area_km2': round(area, 2), 'raw': area})
        
        results.sort(key=lambda x: x['raw'], reverse=True)
        return jsonify({
            'total_changed_km2': round(total, 2), 
            'dominant_shift': results[0]['to'] if results else "Stable", 
            'transitions': results[:10], 
            'analyzed_period': f'{actual_s}-{actual_e}'
        })
    except Exception as e: return jsonify({'error': str(e)}), 500

@app.route('/api/generate-inference', methods=['POST'])
def generate_inference():
    data = request.json
    coords = data.get('coords')
    
    location_full = "the analyzed area"
    if coords:
        try:
            geolocator = Nominatim(user_agent="lulc_final_test", timeout=3)
            location = geolocator.reverse(f"{coords['lat']}, {coords['lon']}", language='en')
            if location:
                addr = location.raw.get('address', {})
                city = addr.get('city') or addr.get('town') or "Attingal"
                state = addr.get('state', 'Kerala')
                location_full = f"{city}, {state}"
        except: pass

    models_to_try = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemma-3-27b-it'] 
    prompt = f"As a Senior Urban Planner, analyze {location_full}. Total change: {data.get('total_changed_km2')} km2, primary shift: {data.get('dominant_shift')}. Write a 100-word professional report. No formatting."

    for model_id in models_to_try:
        try:
            client = get_ai_client()
            response = client.models.generate_content(model=model_id, contents=prompt)
            return jsonify({'inference': response.text, 'used_model': model_id, 'location': location_full})
        except Exception as e:
            continue

    return jsonify({
        'inference': f"Report for {location_full}: Urban growth of {data.get('total_changed_km2')} km2 detected. Immediate zoning review recommended.",
        'used_model': 'Local Fallback', 'location': location_full
    })

# --- ROUTE: GENERATE STATIC LULC MAP FOR PDF ---
@app.route('/api/get-lulc-thumb', methods=['POST'])
def get_lulc_thumb():
    try:
        data = request.json
        year = int(data.get('year', 2024))
        region = ee.Geometry(data['geojson'])
        
        dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1').filterDate(f'{year}-01-01', f'{year}-12-31').filterBounds(region)
        img = dw.select('label').mode().clip(region)
        
        # Standard LULC Colors
        palette = ['419bdf', '397d49', '88b053', '7a87c6', 'e49635', 'dfc35a', 'c4281b', 'a59b8f', 'b39fe1']
        
        # Get a high-res static PNG from Google Earth Engine
        thumb_url = img.getThumbURL({
            'min': 0, 'max': 8, 'palette': palette,
            'dimensions': 1000, 'region': region, 'format': 'png' # Increased resolution
        })
        return jsonify({'url': thumb_url})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- NEW ROUTE: GENERATE STATIC SATELLITE IMAGE FOR PDF OVERLAY ---
@app.route('/api/get-satellite-thumb', methods=['POST'])
def get_satellite_thumb():
    try:
        data = request.json
        year = int(data.get('year', 2024))
        region = ee.Geometry(data['geojson'])
        
        # Use Sentinel-2 for high-res true-color satellite imagery
        collection = ee.ImageCollection('COPERNICUS/S2_SR') \
            .filterBounds(region) \
            .filterDate(f'{year}-01-01', f'{year}-12-31') \
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
            
        # If Sentinel has images, use it, otherwise fallback to Landsat
        if collection.size().getInfo() > 0:
            img = collection.median().clip(region)
            bands = ['B4', 'B3', 'B2']
            min_val, max_val = 0, 3000
        else:
            img = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2').filterBounds(region).filterDate(f'{year}-01-01', f'{year}-12-31').median().clip(region)
            bands = ['SR_B4', 'SR_B3', 'SR_B2']
            min_val, max_val = 7000, 15000

        # High resolution parameters for PDF
        vis_params = {
            'bands': bands,
            'min': min_val, 'max': max_val, 
            'gamma': 1.4,
            'region': region,
            'dimensions': 1000, # Crisp resolution
            'format': 'png'
        }
        
        thumb_url = img.getThumbURL(vis_params)
        return jsonify({'url': thumb_url})
    except Exception as e:
        print(f"Satellite Error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)