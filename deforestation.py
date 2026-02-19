from flask import Flask, request, jsonify
from flask_cors import CORS
import ee

# 1. Initialize Flask
app = Flask(__name__)
CORS(app)

# 2. Initialize Google Earth Engine
try:
    ee.Initialize(project='lulc-470905') 
    print("✅ Earth Engine Initialized (Deforestation Server).")
except Exception as e:
    print(f"❌ Auth Error: {e}")
    try:
        ee.Authenticate()
        ee.Initialize()
    except Exception as inner_e:
        print(f"❌ Critical Auth Error: {inner_e}")

# Class 1 = Trees
TREE_CLASS = 1

def get_tree_area(geometry, year):
    """
    Calculates tree area. Returns (None, None) if no images exist.
    """
    start_date = f'{year}-01-01'
    end_date = f'{year}-12-31'

    # Filter Collection
    dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1') \
        .filterBounds(geometry) \
        .filterDate(start_date, end_date)

    # 1. SAFETY CHECK: Do we have data?
    if dw.limit(1).size().getInfo() == 0:
        return None, None

    # 2. Calculate Area
    classification = dw.select('label').mode()
    tree_mask = classification.eq(TREE_CLASS)
    area_image = tree_mask.multiply(ee.Image.pixelArea())

    stats = area_image.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=geometry,
        scale=10,
        maxPixels=1e9,
        bestEffort=True
    )

    val = stats.get('label').getInfo()
    
    # If val is None, it means the mask was empty or failed
    if val is None:
        return None, 0

    area_sq_km = val / 1e6
    return area_image, area_sq_km

@app.route('/api/calculate-change', methods=['POST'])
def calculate_change():
    try:
        data = request.json
        year_start = int(data.get('year_start', 2015))
        year_end = int(data.get('year_end', 2024))
        geojson = data.get('geojson')

        if not geojson:
            return jsonify({"error": "No geometry provided"}), 400

        region = ee.Geometry(geojson)

        print(f"🌲 Request: Calculate Forest Change {year_start}-{year_end}")

        # --- STEP 1: FIND FIRST VALID START YEAR ---
        area_start = None
        valid_start_year = year_start

        # Loop forward from 2015 -> 2016 -> 2017 until we find data
        for y in range(year_start, year_end):
            _, area = get_tree_area(region, y)
            if area is not None:
                area_start = area
                valid_start_year = y
                print(f"✅ Found valid start data in {y}: {area:.3f} km²")
                break
            else:
                print(f"⚠️ No data for {y}, skipping...")

        # --- STEP 2: GET END YEAR DATA ---
        _, area_end = get_tree_area(region, year_end)
        
        # If end year (e.g., 2025) has no data yet, try one year back
        valid_end_year = year_end
        if area_end is None:
             print(f"⚠️ No data for {year_end}, trying {year_end-1}...")
             _, area_end = get_tree_area(region, year_end - 1)
             valid_end_year = year_end - 1

        # --- STEP 3: CHECK & CALCULATE ---
        if area_start is None or area_end is None:
             return jsonify({"error": "Insufficient satellite data for this region."}), 400

        change_total = area_end - area_start
        years_diff = valid_end_year - valid_start_year
        rate_per_year = change_total / years_diff if years_diff > 0 else 0

        response = {
            "period": f"{valid_start_year} - {valid_end_year}", # Show ACTUAL years used
            "start_area_km2": round(area_start, 3),
            "end_area_km2": round(area_end, 3),
            "growth_km2": round(change_total, 3),
            "loss_km2": round(abs(change_total) if change_total < 0 else 0, 3),
            "rate_per_year": round(rate_per_year, 3),
            "status": "Deforestation" if change_total < 0 else "Reforestation"
        }

        print(f"✅ Result: {response}")
        return jsonify(response)

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

# =========================================================
#  ROUTE: GET FOREST LOSS MAP (PIXEL OVERLAY)
# =========================================================
@app.route('/api/get-change-map', methods=['POST'])
def get_change_map():
    try:
        data = request.json
        year_start = int(data.get('year_start', 2015))
        year_end = int(data.get('year_end', 2024))
        geojson = data.get('geojson')

        if not geojson:
            return jsonify({"error": "No geometry provided"}), 400

        region = ee.Geometry(geojson)
        dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1').filterBounds(region)

        # --- SAFETY NET: FIND VALID YEARS ---
        valid_start_year = year_start
        for y in range(year_start, year_end):
            count = dw.filterDate(f'{y}-01-01', f'{y}-12-31').limit(1).size().getInfo()
            if count > 0:
                valid_start_year = y
                break

        valid_end_year = year_end
        count_end = dw.filterDate(f'{valid_end_year}-01-01', f'{valid_end_year}-12-31').limit(1).size().getInfo()
        if count_end == 0:
             valid_end_year -= 1  # Fallback 1 year if empty
             
        print(f"🗺️ Map Request: Generating map for {valid_start_year} -> {valid_end_year}")

        # --- GENERATE MAP WITH VALIDATED YEARS ---
        img_start = dw.filterDate(f'{valid_start_year}-01-01', f'{valid_start_year}-12-31').select('label').mode().clip(region)
        img_end = dw.filterDate(f'{valid_end_year}-01-01', f'{valid_end_year}-12-31').select('label').mode().clip(region)
        
        # Find pixels that WERE trees (1) but are NOT trees anymore
        loss = img_start.eq(TREE_CLASS).And(img_end.neq(TREE_CLASS))
        
        # Mask out everything except the lost forest
        loss_masked = loss.updateMask(loss.eq(1))
        
        # Color the lost forest pixels Red
        map_id = loss_masked.getMapId({'palette': ['#ff0000']}) 
        
        return jsonify({'url': map_id['tile_fetcher'].url_format})
    except Exception as e:
        print(f"❌ Error generating change map: {e}")
        return jsonify({'error': str(e)}), 500


# =========================================================
#  ROUTE: GET LULC TRANSITION MATRIX (ALL CLASSES)
# =========================================================
@app.route('/api/get-transitions', methods=['POST'])
def get_transitions():
    try:
        data = request.json
        year_start = int(data.get('year_start', 2015))
        year_end = int(data.get('year_end', 2024))
        geojson = data.get('geojson')

        if not geojson:
            return jsonify({"error": "No geometry provided"}), 400

        region = ee.Geometry(geojson)
        dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1').filterBounds(region)

        # --- SAFETY NET: FIND VALID YEARS ---
        valid_start_year = year_start
        for y in range(year_start, year_end):
            count = dw.filterDate(f'{y}-01-01', f'{y}-12-31').limit(1).size().getInfo()
            if count > 0:
                valid_start_year = y
                break

        valid_end_year = year_end
        count_end = dw.filterDate(f'{valid_end_year}-01-01', f'{valid_end_year}-12-31').limit(1).size().getInfo()
        if count_end == 0:
             valid_end_year -= 1  # Fallback 1 year if empty

        print(f"🔄 Transition Request: {valid_start_year} -> {valid_end_year}")

        # Get imagery
        img_start = dw.filterDate(f'{valid_start_year}-01-01', f'{valid_start_year}-12-31').select('label').mode().clip(region)
        img_end = dw.filterDate(f'{valid_end_year}-01-01', f'{valid_end_year}-12-31').select('label').mode().clip(region)
        
        # Isolate only pixels that changed
        changed = img_start.neq(img_end)
        
        # Create a unique code for every transition (e.g., 1 (Trees) to 6 (Urban) becomes 106)
        transitions = img_start.multiply(100).add(img_end).updateMask(changed)
        
        # Count the pixels for each transition
        stats = transitions.reduceRegion(
            reducer=ee.Reducer.frequencyHistogram(),
            geometry=region,
            scale=10,
            maxPixels=1e10,
            bestEffort=True
        )
        
        histogram = stats.get('label').getInfo()
        if not histogram:
            return jsonify({"transitions": []})

        # Dynamic World LULC Classes
        classes = {
            0: "Water", 1: "Trees", 2: "Grass", 3: "Flooded Veg", 
            4: "Crops", 5: "Shrub/Scrub", 6: "Built Area", 
            7: "Bare Ground", 8: "Snow/Ice"
        }

        result = []
        total_changed_pixels = sum(histogram.values())

        for code_str, count in histogram.items():
            code = int(float(code_str))
            c_start = code // 100
            c_end = code % 100
            
            # Convert pixels to square kilometers (1 pixel = 100 sq meters)
            area_km2 = (count * 100) / 1e6
            percentage = (count / total_changed_pixels) * 100
            
            # Filter out tiny insignificant changes (less than 0.01 km2) to keep the table clean
            if area_km2 > 0.01:
                result.append({
                    "from": classes.get(c_start, f"Class {c_start}"),
                    "to": classes.get(c_end, f"Class {c_end}"),
                    "area_km2": round(area_km2, 3),
                    "percentage": round(percentage, 1)
                })
                
        # Sort so the biggest changes are at the top of the list
        result = sorted(result, key=lambda x: x['area_km2'], reverse=True)

        return jsonify({
            "period": f"{valid_start_year} - {valid_end_year}",
            "transitions": result
        })

    except Exception as e:
        print(f"❌ Error calculating transitions: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # ✅ RUNS ON PORT 5002
    app.run(debug=True, port=5002)