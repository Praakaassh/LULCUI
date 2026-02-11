# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import ee
import torch
import torch.nn as nn
import numpy as np
import rasterio
import io
import requests
import base64
import math
from PIL import Image

# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------
app = Flask(__name__)
CORS(app)  # Enable CORS for React Frontend

# Initialize Google Earth Engine
try:
    ee.Initialize(project='lulc-470905') # <--- KEEP YOUR PROJECT ID
    print("✅ GEE Initialized Successfully.")
except Exception as e:
    print(f"❌ GEE Initialization Error: {e}")
    print("Try running 'earthengine authenticate' in your terminal.")

# Check for GPU
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"✅ Using Device: {device}")

# ---------------------------------------------------------
# 1. DEFINE U-NET ARCHITECTURE
# ---------------------------------------------------------
class UNet(nn.Module):
    def __init__(self):
        super().__init__()
        def cb(in_c, out_c):
            return nn.Sequential(
                nn.Conv2d(in_c, out_c, 3, padding=1),
                nn.BatchNorm2d(out_c),
                nn.ReLU(inplace=True),
                nn.Conv2d(out_c, out_c, 3, padding=1),
                nn.BatchNorm2d(out_c),
                nn.ReLU(inplace=True),
            )
        self.enc1 = cb(10, 64); self.pool = nn.MaxPool2d(2)
        self.enc2 = cb(64, 128)
        self.enc3 = cb(128, 256)
        
        # Matches your saved model keys
        self.bottleneck = cb(256, 512) 
        
        self.up3 = nn.ConvTranspose2d(512, 256, 2, 2); self.dec3 = cb(512, 256)
        self.up2 = nn.ConvTranspose2d(256, 128, 2, 2); self.dec2 = cb(256, 128)
        self.up1 = nn.ConvTranspose2d(128, 64, 2, 2); self.dec1 = cb(128, 64)
        self.final = nn.Conv2d(64, 1, 1)

    def forward(self, x):
        e1 = self.enc1(x)
        e2 = self.enc2(self.pool(e1))
        e3 = self.enc3(self.pool(e2))
        
        b = self.bottleneck(self.pool(e3)) 
        
        # Note: Padding is handled externally now, so standard cat is safe
        d3 = self.dec3(torch.cat([self.up3(b), e3], dim=1))
        d2 = self.dec2(torch.cat([self.up2(d3), e2], dim=1))
        d1 = self.dec1(torch.cat([self.up1(d2), e1], dim=1))
        return self.final(d1)

# ---------------------------------------------------------
# 2. LOAD MODEL
# ---------------------------------------------------------
MODEL_PATH = r'model\tvm_growth_model.pth' # Ensure path is correct

model = UNet().to(device)

try:
    state_dict = torch.load(MODEL_PATH, map_location=device)
    model.load_state_dict(state_dict)
    model.eval()
    print(f"✅ Model loaded from {MODEL_PATH}")
except FileNotFoundError:
    print(f"❌ Error: Model file '{MODEL_PATH}' not found!")

# ---------------------------------------------------------
# 3. HELPER FUNCTIONS (With Fixes)
# ---------------------------------------------------------
def get_gee_image(roi, year=2023):
    """Fetches LULC and Distance map from GEE."""
    dw = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")\
           .filterDate(f'{year}-01-01', f'{year}-12-31')\
           .filterBounds(roi)\
           .mode()
    
    lulc = dw.select('label')
    urban_mask = lulc.eq(6)
    dist_urban = urban_mask.fastDistanceTransform(30).sqrt().multiply(30)
    
    return ee.Image.cat([lulc, dist_urban]).toFloat().clip(roi)

def preprocess_numpy_to_tensor(arr):
    """Converts (2, H, W) numpy array to (1, 10, H, W) tensor."""
    arr = np.nan_to_num(arr, nan=0.0)
    
    # 1. Separate Bands
    lulc_band = arr[0, :, :].astype(np.int64)
    dist_band = arr[1, :, :].astype(np.float32)
    
    # 2. SAFETY FIX: Clip classes to 0-8 to prevent extra channels
    lulc_band = np.clip(lulc_band, 0, 8)
    
    # 3. Normalize Distance
    dist_band = np.clip(dist_band / 5000.0, 0, 1)
    
    # 4. One-Hot Encode (Strictly 9 channels)
    lulc_onehot = np.eye(9)[lulc_band] # (H, W, 9)
    
    # 5. Combine
    dist_expanded = np.expand_dims(dist_band, axis=-1)
    combined = np.concatenate([lulc_onehot, dist_expanded], axis=-1)
    
    # 6. To Tensor (Batch, Channels, H, W)
    tensor = torch.from_numpy(combined).permute(2, 0, 1).float().unsqueeze(0)
    return tensor

# ---------------------------------------------------------
# 4. API ROUTES
# ---------------------------------------------------------
@app.route('/api/predict', methods=['POST'])
def predict_heatmap():
    try:
        data = request.json
        if not data or 'geojson' not in data:
            return jsonify({"error": "Missing 'geojson' in request body"}), 400
        
        geojson_geometry = data['geojson']
        roi = ee.Geometry(geojson_geometry)
        
        print("🔄 Step 1: Requesting data from GEE...")
        input_image = get_gee_image(roi, year=2023)
        
        url = input_image.getDownloadURL({
            'name': 'prediction_input',
            'scale': 30,
            'crs': 'EPSG:4326',
            'region': roi,
            'format': 'GEO_TIFF'
        })
        
        print("🔄 Step 2: Downloading GeoTIFF...")
        response = requests.get(url)
        
        with rasterio.open(io.BytesIO(response.content)) as src:
            image_data = src.read() # Shape: (2, Height, Width)
            bounds = src.bounds
            orig_h, orig_w = image_data.shape[1], image_data.shape[2]
            
        print(f"🔄 Step 3: Original Shape ({orig_h}, {orig_w}). Applying Padding...")

        # --- A. PADDING LOGIC (The Fix) ---
        # U-Net needs dimensions divisible by 16
        pad_h = (16 - (orig_h % 16)) % 16
        pad_w = (16 - (orig_w % 16)) % 16
        
        # Pad with edge reflection (2 bands, pad_h, pad_w)
        # np.pad format: ((before, after), (before, after), (before, after))
        padded_image = np.pad(image_data, ((0,0), (0, pad_h), (0, pad_w)), mode='edge')
        
        # --- B. INFERENCE ---
        input_tensor = preprocess_numpy_to_tensor(padded_image).to(device)
        
        with torch.no_grad():
            logits = model(input_tensor)
            probs = torch.sigmoid(logits).squeeze().cpu().numpy() # Shape: (New_H, New_W)
            
        # --- C. CROP BACK TO ORIGINAL SIZE ---
        probs = probs[:orig_h, :orig_w]
        
        print("✅ Inference Done. Generating PNG...")

        # --- D. VISUALIZATION ---
        mask = probs > 0.2
        rgba = np.zeros((orig_h, orig_w, 4), dtype=np.uint8)
        
        rgba[mask, 0] = 255  # Red
        rgba[mask, 1] = 0    # Green
        rgba[mask, 2] = 0    # Blue
        rgba[mask, 3] = 180  # Alpha
        
        pil_img = Image.fromarray(rgba)
        buff = io.BytesIO()
        pil_img.save(buff, format="PNG")
        img_str = base64.b64encode(buff.getvalue()).decode("utf-8")
        data_url = f"data:image/png;base64,{img_str}"
        
        leaflet_bounds = [[bounds.bottom, bounds.left], [bounds.top, bounds.right]]
        
        return jsonify({
            "url": data_url,
            "bounds": leaflet_bounds,
            "message": "Prediction successful"
        })

    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/calculate-change', methods=['POST'])
def calculate_change():
    return jsonify({"growth_km2": 12.5, "rate_per_year": 1.25, "period": "2015-2024"})

if __name__ == '__main__':
    # Running on Port 5001 to avoid conflict with your other server
    app.run(debug=True, port=5001)