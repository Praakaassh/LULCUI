import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, GeoJSON, ImageOverlay } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./development.css";

const Development = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // AOI (Area of Interest) from previous page
  const { aoi } = location.state || {};

  // Stats State
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Years State
  const [startYear, setStartYear] = useState(2015);
  const [endYear, setEndYear] = useState(2024);

  // Heatmap State
  const [heatmapUrl, setHeatmapUrl] = useState(null);
  const [heatmapBounds, setHeatmapBounds] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Redirect if no AOI
  useEffect(() => {
    if (!aoi) {
      alert("No Area of Interest found. Please select an area on the Home page.");
      navigate("/home");
    }
  }, [aoi, navigate]);

  // -------------------------
  // 1. Calculate Statistics (Server 1: Port 5000)
  // -------------------------
  const calculateRate = async () => {
    setLoading(true);
    setError(null);
    setStats(null);

    try {
      const response = await fetch(
        "http://localhost:5000/api/calculate-change",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            year_start: startYear,
            year_end: endYear,
            geojson: aoi.geometry,
          }),
        }
      );

      if (!response.ok) throw new Error("Calculation failed");

      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error(err);
      setError("Error calculating development rate (Check Server 1 on Port 5000).");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // 2. Load Future Prediction Heatmap (Server 2: Port 5001)
  // -------------------------
  const loadHeatmap = async () => {
    setLoading(true);
    setError(null);
    setHeatmapUrl(null); // Clear previous map
    setHeatmapBounds(null);

    try {
      console.log("🚀 Requesting prediction map from model.py...");
      
      // UPDATED PORT: 5001 (To avoid conflict with stats server)
      const response = await fetch(
        "http://localhost:5001/api/predict",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            geojson: aoi.geometry, // Send the polygon coordinates
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Heatmap generation failed");
      }

      const data = await response.json();
      
      console.log("✅ Prediction received!");
      setHeatmapUrl(data.url);       // Base64 image string
      setHeatmapBounds(data.bounds); // [[lat1, lon1], [lat2, lon2]]
      setShowHeatmap(true);

    } catch (err) {
      console.error(err);
      setError("Error loading future prediction heatmap (Check model.py on Port 5001): " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!aoi) return null;

  // Calculate Map Center based on AOI
  const aoiLayer = L.geoJSON(aoi);
  const mapBounds = aoiLayer.getBounds();

  return (
    <div className="dev-container">
      {/* HEADER */}
      <div className="dev-header">
        <button onClick={() => navigate("/home")} className="back-btn">
          ⬅ Back to Home
        </button>
        <h2>🏗 Urban Development Prediction</h2>
      </div>

      <div className="dev-content">
        {/* SIDEBAR */}
        <div className="dev-sidebar">
          
          {/* Controls */}
          <div className="control-card">
            <h3>Analysis Controls</h3>

            <div className="year-inputs">
              <label>
                Start Year:
                <input
                  type="number"
                  value={startYear}
                  onChange={(e) => setStartYear(Number(e.target.value))}
                />
              </label>
              <label>
                End Year:
                <input
                  type="number"
                  value={endYear}
                  onChange={(e) => setEndYear(Number(e.target.value))}
                />
              </label>
            </div>

            <button
              className="calc-btn"
              onClick={calculateRate}
              disabled={loading}
            >
              {loading ? "Calculating..." : "Calculate Stats 📊"}
            </button>

            <div className="divider"></div>

            <h3>AI Prediction</h3>
            <p className="description">
              Generate a forecast for 2027 using the Deep Learning model.
            </p>

            <button
              className="calc-btn heatmap-btn"
              onClick={loadHeatmap}
              disabled={loading}
            >
              {loading ? "Running Model... ⏳" : "🔮 Generate 2027 Map"}
            </button>

            {showHeatmap && (
              <button
                className="calc-btn secondary-btn"
                onClick={() => setShowHeatmap(false)}
              >
                ❌ Hide Heatmap
              </button>
            )}
          </div>

          {/* Error Message */}
          {error && <div className="error-msg">{error}</div>}

          {/* Stats Results */}
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
          <MapContainer
            bounds={mapBounds}
            style={{ height: "100%", width: "100%" }}
          >
            {/* Satellite Base Map */}
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Esri World Imagery"
            />

            {/* AOI Outline (Dashed Line) */}
            <GeoJSON
              data={aoi}
              style={{
                color: "#ff4444",
                weight: 2,
                dashArray: "5, 5",
                fillOpacity: 0.0,
              }}
            />

            {/* AI Prediction Overlay */}
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