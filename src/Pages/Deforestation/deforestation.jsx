import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./development.css"; // reuse same CSS

const Deforestation = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // AOI from Home
  const { aoi } = location.state || {};

  // Stats
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Years
  const [startYear, setStartYear] = useState(2015);
  const [endYear, setEndYear] = useState(2024);

  // Heatmap
  const [heatmapUrl, setHeatmapUrl] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);

  useEffect(() => {
    if (!aoi) {
      alert("No Area of Interest found. Please select an area on the Home page.");
      navigate("/home");
    }
  }, [aoi, navigate]);

  // -------------------------
  // Calculate deforestation rate
  // -------------------------
  const calculateRate = async () => {
    setLoading(true);
    setError(null);
    setStats(null);

    try {
      const response = await fetch(
        "http://localhost:5000/api/calculate-deforestation",
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
      setError("Error calculating deforestation rate.");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // Load deforestation risk heatmap (future prediction)
  // -------------------------
  const loadHeatmap = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        "http://localhost:5000/api/get-deforestation-heatmap",
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

      if (!response.ok) throw new Error("Heatmap failed");

      const data = await response.json();
      setHeatmapUrl(data.url);
      setShowHeatmap(true);
    } catch (err) {
      console.error(err);
      setError("Error loading deforestation prediction heatmap.");
    } finally {
      setLoading(false);
    }
  };

  if (!aoi) return null;

  return (
    <div className="dev-container">
      {/* HEADER */}
      <div className="dev-header">
        <button onClick={() => navigate("/home")} className="back-btn">
          ⬅ Back to Home
        </button>
        <h2>🌲 Deforestation Rate & Prediction</h2>
      </div>

      <div className="dev-content">
        {/* SIDEBAR */}
        <div className="dev-sidebar">
          <div className="control-card">
            <h3>Analysis Period</h3>

            <div className="year-inputs">
              <label>
                Start:
                <input
                  type="number"
                  value={startYear}
                  min="2015"
                  max="2025"
                  onChange={(e) => setStartYear(Number(e.target.value))}
                />
              </label>

              <label>
                End:
                <input
                  type="number"
                  value={endYear}
                  min="2015"
                  max="2025"
                  onChange={(e) => setEndYear(Number(e.target.value))}
                />
              </label>
            </div>

            <button
              className="calc-btn"
              onClick={calculateRate}
              disabled={loading}
            >
              {loading ? "Calculating..." : "Calculate Deforestation Rate 🌲"}
            </button>

            <button
              className="calc-btn heatmap-btn"
              onClick={loadHeatmap}
              disabled={loading}
            >
              {loading ? "Loading..." : "🔮 Show Deforestation Risk Heatmap"}
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

          {stats && (
            <div className="stats-results">
              <div className="stat-card">
                <h4>Total Forest Loss</h4>
                <p className="big-num red">-{stats.loss_km2} km²</p>
                <small>Cumulative loss ({stats.period})</small>
              </div>

              <div className="stat-card">
                <h4>Avg. Deforestation Rate</h4>
                <p className="big-num green">
                  {stats.rate_per_year} km² / year
                </p>
                <small>Trend-based average</small>
              </div>

              <div className="prediction-box">
                <h4>🔮 Prediction</h4>
                <p>
                  At this rate, approximately
                  <b>
                    {" "}
                    {(stats.rate_per_year * 5).toFixed(2)} km²{" "}
                  </b>
                  of forest may be lost in the next 5 years.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* MAP */}
        <div className="dev-map">
          <MapContainer
            bounds={L.geoJSON(aoi).getBounds()}
            style={{ height: "100%", width: "100%" }}
          >
            {/* Base map */}
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />

            {/* 🔮 DEFORESTATION HEATMAP */}
            {showHeatmap && heatmapUrl && (
              <TileLayer url={heatmapUrl} opacity={0.6} />
            )}

            {/* AOI outline */}
            <GeoJSON
              data={aoi}
              style={{
                color: "#00c853",
                fillOpacity: 0.1,
                weight: 2,
              }}
            />
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default Deforestation;
