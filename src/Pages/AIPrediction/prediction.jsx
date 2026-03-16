import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, GeoJSON, ImageOverlay } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// You can reuse development.css or create a new prediction.css for the layout
import "./prediction.css";

// Fix for default Leaflet marker icons
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const Prediction = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Extract AOI from the navigation state sent from Home
  const { aoi } = location.state || {};

  // --- MODEL STATE (Linked to model.py on Port 5001) ---
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState(null);
  const [heatmapUrl, setHeatmapUrl] = useState(null);
  const [heatmapBounds, setHeatmapBounds] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);

  useEffect(() => {
    // Kick them back to Home if they try to access the URL directly without an AOI
    if (!aoi) {
      alert("No Area of Interest found. Redirecting to Home...");
      navigate("/home");
    }
  }, [aoi, navigate]);

  // =========================================================
  //  FUNCTION: Get Prediction from model.py (Port 5001)
  // =========================================================
  // =========================================================
  //  FUNCTION: Get Prediction from Live Cloud Backend
  // =========================================================
  // =========================================================
  //  FUNCTION: Get Prediction from Live Hugging Face Backend
  // =========================================================
  const runAIModel = async () => {
    setModelLoading(true);
    setModelError(null);
    setHeatmapUrl(null);
    setHeatmapBounds(null);

    try {
      console.log("🧠 Sending request to Live AI Model on Hugging Face...");
      
      // 🔴 Updated URL to point to your Hugging Face Space
      const response = await fetch("https://prakash787-lulcmodel.hf.space/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          geojson: aoi.geometry, // Sending the drawn geometry coordinates
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Model inference failed");
      }

      const data = await response.json();
      console.log("✅ Prediction received!");
      
      setHeatmapUrl(data.url);       // Base64 Image string from the model
      setHeatmapBounds(data.bounds); // Lat/Lon bounds for placing the overlay
      setShowHeatmap(true);

    } catch (err) {
      console.error(err);
      // Update error message to reflect the new host
      setModelError("Error connecting to Hugging Face backend. Please wait a moment if the Space is waking up.");
    } finally {
      setModelLoading(false);
    }
  };

  // Prevent map rendering crash if redirect is happening
  if (!aoi) return null;

  // Convert the GeoJSON to a Leaflet layer so we can calculate bounds to center the map
  const aoiLayer = L.geoJSON(aoi);
  const mapBounds = aoiLayer.getBounds();

  return (
    <div className="dev-container">
      {/* HEADER */}
      <div className="dev-header">
        <button onClick={() => navigate("/home")} className="back-btn">⬅ Back to Home</button>
        <h2>🧠 Deep Learning Urbanization Prediction</h2>
      </div>

      <div className="dev-content">
        {/* SIDEBAR */}
        <div className="dev-sidebar">
          <div className="control-card">
            <h3>PyTorch AI Model</h3>
            <p className="description">
              Run the deep learning model to generate a predicted LULC heatmap for future urbanization trends.
            </p>

            <button 
              className="calc-btn heatmap-btn" 
              onClick={runAIModel} 
              disabled={modelLoading}
            >
              {modelLoading ? "Generating Prediction... ⏳" : "🔮 Generate Future Heatmap"}
            </button>

             {/* Model Error Msg */}
            {modelError && <div className="error-msg">{modelError}</div>}

            {/* Toggle Visibility */}
            {showHeatmap && heatmapUrl && (
              <button 
                className="calc-btn secondary-btn" 
                onClick={() => setShowHeatmap(false)}
                style={{ marginTop: "10px", backgroundColor: "#333" }}
              >
                ❌ Hide Heatmap Overlay
              </button>
            )}
            
            {!showHeatmap && heatmapUrl && (
               <button 
                 className="calc-btn" 
                 onClick={() => setShowHeatmap(true)}
                 style={{ marginTop: "10px" }}
               >
                 👁️ Show Heatmap Overlay
               </button>
            )}
          </div>
        </div>

        {/* MAP */}
        <div className="dev-map">
          <MapContainer bounds={mapBounds} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Esri World Imagery"
            />

            {/* AOI Outline */}
            <GeoJSON 
              data={aoi} 
              style={{ color: "#00ff00", weight: 3, dashArray: "5, 5", fillOpacity: 0.1 }} 
            />

            {/* AI PREDICTION OVERLAY */}
            {showHeatmap && heatmapUrl && heatmapBounds && (
              <ImageOverlay
                url={heatmapUrl}
                bounds={heatmapBounds}
                opacity={0.75}
                zIndex={1000}
              />
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default Prediction;