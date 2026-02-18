import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, GeoJSON, ImageOverlay } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./development.css"; 

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

const Development = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { aoi } = location.state || {};

  // --- STATS STATE (Linked to ab.py on Port 5000) ---
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);

  // --- MODEL STATE (Linked to model.py on Port 5001) ---
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState(null);
  const [heatmapUrl, setHeatmapUrl] = useState(null);
  const [heatmapBounds, setHeatmapBounds] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Years State (For Stats)
  const [startYear, setStartYear] = useState(2015);
  const [endYear, setEndYear] = useState(2024);

  useEffect(() => {
    if (!aoi) {
      alert("No Area of Interest found. Redirecting...");
      navigate("/home");
    }
  }, [aoi, navigate]);

  // =========================================================
  //  FUNCTION 1: Get Stats from ab.py (Port 5000)
  // =========================================================
  const calculateRate = async () => {
    setStatsLoading(true);
    setStatsError(null);
    setStats(null);

    try {
      console.log("📊 Fetching stats from Port 5000...");
      const response = await fetch("http://localhost:5000/api/calculate-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year_start: startYear,
          year_end: endYear,
          geojson: aoi.geometry,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Stats calculation failed");
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error(err);
      setStatsError("Error connecting to ab.py (Port 5000). Is it running?");
    } finally {
      setStatsLoading(false);
    }
  };

  // =========================================================
  //  FUNCTION 2: Get Prediction from model.py (Port 5001)
  // =========================================================
  const runAIModel = async () => {
    setModelLoading(true);
    setModelError(null);
    setHeatmapUrl(null);
    setHeatmapBounds(null);

    try {
      console.log("🧠 Sending request to AI Model on Port 5001...");
      const response = await fetch("http://localhost:5001/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          geojson: aoi.geometry, // The model only needs the location
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Model inference failed");
      }

      const data = await response.json();
      console.log("✅ Prediction received!");
      
      setHeatmapUrl(data.url);       // Base64 Image string
      setHeatmapBounds(data.bounds); // Lat/Lon bounds
      setShowHeatmap(true);

    } catch (err) {
      console.error(err);
      setModelError("Error connecting to model.py (Port 5001). Is it running?");
    } finally {
      setModelLoading(false);
    }
  };

  if (!aoi) return null;

  const aoiLayer = L.geoJSON(aoi);
  const mapBounds = aoiLayer.getBounds();

  return (
    <div className="dev-container">
      {/* HEADER */}
      <div className="dev-header">
        <button onClick={() => navigate("/home")} className="back-btn">⬅ Back to Home</button>
        <h2>🏗 Urban Development Prediction</h2>
      </div>

      <div className="dev-content">
        <div className="dev-sidebar">
          
          {/* CONTROL CARD */}
          <div className="control-card">
            <h3>Analysis Controls</h3>
            <div className="year-inputs">
              <label>
                Start: <input type="number" value={startYear} onChange={(e) => setStartYear(Number(e.target.value))} />
              </label>
              <label>
                End: <input type="number" value={endYear} onChange={(e) => setEndYear(Number(e.target.value))} />
              </label>
            </div>

            <button 
              className="calc-btn" 
              onClick={calculateRate} 
              disabled={statsLoading}
            >
              {statsLoading ? "Calculating..." : "Calculate Stats 📊"}
            </button>

            {/* Stats Error Msg */}
            {statsError && <div className="error-msg">{statsError}</div>}

            <div className="divider"></div>

            <h3>AI Prediction</h3>
            <p className="description">
              Run the PyTorch Deep Learning model to predict future urbanization.
            </p>

            <button 
              className="calc-btn heatmap-btn" 
              onClick={runAIModel} 
              disabled={modelLoading}
            >
              {modelLoading ? "Running Model... ⏳" : "🔮 Generate 2027 Map"}
            </button>

             {/* Model Error Msg */}
            {modelError && <div className="error-msg">{modelError}</div>}

            {showHeatmap && (
              <button className="calc-btn secondary-btn" onClick={() => setShowHeatmap(false)}>
                ❌ Hide Prediction
              </button>
            )}
          </div>

          {/* RESULTS SECTION */}
          {stats && (
            <div className="stats-results">
              <div className="stat-card">
                <h4>Total Urban Growth</h4>
                <p className="big-num red">+{stats.growth_km2} km²</p>
                <small>Period: {stats.period}</small>
              </div>
              <div className="stat-card">
                <h4>Avg. Rate</h4>
                <p className="big-num green">{stats.rate_per_year} km²/yr</p>
              </div>
            </div>
          )}
        </div>

        {/* MAP */}
        <div className="dev-map">
          <MapContainer bounds={mapBounds} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Esri World Imagery"
            />

            <GeoJSON 
              data={aoi} 
              style={{ color: "#ff4444", weight: 2, dashArray: "5, 5", fillOpacity: 0 }} 
            />

            {/* AI PREDICTION OVERLAY */}
            {showHeatmap && heatmapUrl && heatmapBounds && (
              <ImageOverlay
                url={heatmapUrl}
                bounds={heatmapBounds}
                opacity={0.7}
                zIndex={1000}
              />
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default Development;