import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, GeoJSON, ImageOverlay } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./deforestation.css"; // We can reuse the same CSS

const Deforestation = () => {
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

  // Heatmap State (Future Prediction)
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
  // 1. Calculate Deforestation (Server Port 5002)
  // -------------------------
  const calculateRate = async () => {
    setLoading(true);
    setError(null);
    setStats(null);

    try {
      // ✅ FIX: Pointing to Port 5002 (Deforestation Server)
      const response = await fetch(
        "http://localhost:5002/api/calculate-change",
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
      setError("Error calculating deforestation. Ensure Server on Port 5002 is running.");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // 2. Load Prediction (This can still use the Model Server on 5001)
  // -------------------------
  const loadHeatmap = async () => {
    setLoading(true);
    setError(null);
    setHeatmapUrl(null); 
    setHeatmapBounds(null);

    try {
      // Assuming you use the same model server for prediction visualizations
      const response = await fetch(
        "http://localhost:5001/api/predict",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ geojson: aoi.geometry }),
        }
      );

      if (!response.ok) throw new Error("Heatmap generation failed");

      const data = await response.json();
      setHeatmapUrl(data.url);
      setHeatmapBounds(data.bounds);
      setShowHeatmap(true);
    } catch (err) {
      console.error(err);
      setError("Error loading prediction map.");
    } finally {
      setLoading(false);
    }
  };

  if (!aoi) return null;

  // Calculate Map Center
  const aoiLayer = L.geoJSON(aoi);
  const mapBounds = aoiLayer.getBounds();

  return (
    <div className="dev-container">
      {/* HEADER - Updated Title */}
      <div className="dev-header" style={{ borderBottom: "4px solid #2e7d32" }}>
        <button onClick={() => navigate("/home")} className="back-btn">
          ⬅ Back to Home
        </button>
        <h2>🌲 Deforestation Analysis</h2>
      </div>

      <div className="dev-content">
        {/* SIDEBAR */}
        <div className="dev-sidebar">
          
          <div className="control-card">
            <h3>Analysis Controls</h3>

            <div className="year-inputs">
              <label>
                Start:
                <input
                  type="number"
                  value={startYear}
                  onChange={(e) => setStartYear(Number(e.target.value))}
                />
              </label>
              <label>
                End:
                <input
                  type="number"
                  value={endYear}
                  onChange={(e) => setEndYear(Number(e.target.value))}
                />
              </label>
            </div>

            <button
              className="calc-btn"
              style={{ backgroundColor: "#2e7d32" }} // Green button for forest
              onClick={calculateRate}
              disabled={loading}
            >
              {loading ? "Calculating..." : "Calculate Forest Loss 🌲"}
            </button>

            <div className="divider"></div>

            <h3>Future Risk</h3>
            <p className="description">
              Predict forest cover changes for 2027.
            </p>

            <button
              className="calc-btn heatmap-btn"
              onClick={loadHeatmap}
              disabled={loading}
            >
              {loading ? "Processing..." : "🔮 Generate Prediction Map"}
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

          {error && <div className="error-msg">{error}</div>}

          {/* ✅ UPDATED STATS DISPLAY FOR DEFORESTATION */}
          {stats && (
            <div className="stats-results">
              <div className="stat-card">
                <h4>Forest Cover Change</h4>
                {/* Logic: If growth is negative, it's loss (Red). If positive, it's gain (Green). */}
                <p className={`big-num ${stats.growth_km2 < 0 ? 'red' : 'green'}`}>
                  {stats.growth_km2 > 0 ? "+" : ""}
                  {stats.growth_km2} km²
                </p>
                <small>
                  {stats.percentage_change}% change ({stats.period})
                </small>
              </div>

              <div className="stat-card">
                <h4>Annual Rate</h4>
                <p className="big-num" style={{ color: "#555" }}>
                  {stats.rate_per_year} km² / year
                </p>
              </div>
              
              <div className="stat-card" style={{backgroundColor: "#e8f5e9"}}>
                 <h4>Current Forest Area</h4>
                 <p className="big-num green">{stats.end_area_km2} km²</p>
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
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Esri World Imagery"
            />

            <GeoJSON
              data={aoi}
              style={{
                color: "#2e7d32", // Forest Green outline
                weight: 2,
                dashArray: "5, 5",
                fillOpacity: 0.1,
              }}
            />

            {showHeatmap && heatmapUrl && heatmapBounds && (
              <ImageOverlay
                url={heatmapUrl}
                bounds={heatmapBounds}
                opacity={0.7}
              />
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default Deforestation;