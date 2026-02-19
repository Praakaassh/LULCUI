import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./development/development.css";

import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const ChangeAnalysis = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { aoi, initialType } = location.state || {};

  const [analysisMode, setAnalysisMode] = useState(initialType || "development");

  // Stats State
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Visual Change Map State
  const [changeMapUrl, setChangeMapUrl] = useState(null);
  const [mapLoading, setMapLoading] = useState(false);

  // --- NEW: TRANSITIONS STATE ---
  const [transitions, setTransitions] = useState(null);
  const [transLoading, setTransLoading] = useState(false);

  // Years State
  const [startYear, setStartYear] = useState(2015);
  const [endYear, setEndYear] = useState(2024);

  useEffect(() => {
    if (!aoi) navigate("/home");
  }, [aoi, navigate]);

  // Clear data when mode changes
  useEffect(() => {
    setStats(null);
    setChangeMapUrl(null);
    setTransitions(null); // Clear table on toggle
    setError(null);
  }, [analysisMode]);

  const getApiUrl = (endpoint) => {
    const port = analysisMode === "development" ? 5000 : 5002;
    return `http://localhost:${port}/api/${endpoint}`;
  };

  // 1. Calculate Stats
  const calculateRate = async () => {
    setLoading(true);
    setError(null);
    setStats(null);

    try {
      const response = await fetch(getApiUrl("calculate-change"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year_start: startYear, year_end: endYear, geojson: aoi.geometry }),
      });

      if (!response.ok) throw new Error("Calculation failed");
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(`Error connecting to backend. Is it running?`);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Visual Map of Changed Pixels
  const fetchChangeMap = async () => {
    setMapLoading(true);
    setError(null);
    setChangeMapUrl(null);

    try {
      const response = await fetch(getApiUrl("get-change-map"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year_start: startYear, year_end: endYear, geojson: aoi.geometry }),
      });

      if (!response.ok) throw new Error("Failed to load map layer");
      const data = await response.json();
      setChangeMapUrl(data.url);
    } catch (err) {
      setError(`Error loading map layer.`);
    } finally {
      setMapLoading(false);
    }
  };

  // 3. NEW: Fetch Pixel Transitions
  const fetchTransitions = async () => {
    setTransLoading(true);
    setError(null);
    setTransitions(null);

    try {
      const response = await fetch(getApiUrl("get-transitions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year_start: startYear, year_end: endYear, geojson: aoi.geometry }),
      });

      if (!response.ok) throw new Error("Failed to load transitions");
      const data = await response.json();
      setTransitions(data.transitions);
    } catch (err) {
      setError("Error loading transition matrix. Is the server running?");
    } finally {
      setTransLoading(false);
    }
  };

  if (!aoi) return null;

  const aoiLayer = L.geoJSON(aoi);
  const mapBounds = aoiLayer.getBounds();

  const isUrban = analysisMode === "development";
  const themeColor = isUrban ? "#ff4444" : "#2e7d32";
  const pageTitle = isUrban ? "🏗 Urban Development Analysis" : "🌲 Deforestation Analysis";

  return (
    <div className="dev-container">
      <div className="dev-header" style={{ borderBottom: `4px solid ${themeColor}` }}>
        <button onClick={() => navigate("/home")} className="back-btn">⬅ Back to Home</button>
        <h2>{pageTitle}</h2>
      </div>

      <div className="dev-content">
        <div className="dev-sidebar">
          
          <div className="control-card">
            <h3>Analysis Controls</h3>

            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              <button 
                onClick={() => setAnalysisMode("development")}
                style={{
                  flex: 1, padding: "8px", borderRadius: "4px", border: "none", cursor: "pointer",
                  backgroundColor: isUrban ? "#ff4444" : "#ddd", color: isUrban ? "#fff" : "#333",
                }}
              >
                🏗 Urban
              </button>
              <button 
                onClick={() => setAnalysisMode("deforestation")}
                style={{
                  flex: 1, padding: "8px", borderRadius: "4px", border: "none", cursor: "pointer",
                  backgroundColor: !isUrban ? "#2e7d32" : "#ddd", color: !isUrban ? "#fff" : "#333",
                }}
              >
                🌲 Forest
              </button>
            </div>

            <div className="year-inputs">
              <label>
                Start: <input type="number" value={startYear} onChange={(e) => setStartYear(Number(e.target.value))} />
              </label>
              <label>
                End: <input type="number" value={endYear} onChange={(e) => setEndYear(Number(e.target.value))} />
              </label>
            </div>

            {/* Calculate Stats Button */}
            <button className="calc-btn" onClick={calculateRate} disabled={loading} style={{ backgroundColor: themeColor, marginBottom: '10px' }}>
              {loading ? "Calculating..." : "1. Calculate Change Stats 📊"}
            </button>

            {/* Visualize Changed Pixels Button */}
            <button className="calc-btn" onClick={fetchChangeMap} disabled={mapLoading} style={{ backgroundColor: "#333", marginBottom: '10px' }}>
              {mapLoading ? "Loading Map..." : "2. Show Changed Pixels 👁️"}
            </button>
            
            {/* NEW: Calculate Transitions Button */}
            <button className="calc-btn" onClick={fetchTransitions} disabled={transLoading} style={{ backgroundColor: "#1565c0" }}>
              {transLoading ? "Analyzing Pixels..." : "3. Show LULC Transitions 🔄"}
            </button>

            {/* Toggle Map off if it's already showing */}
            {changeMapUrl && (
               <button className="calc-btn secondary-btn" onClick={() => setChangeMapUrl(null)} style={{ marginTop: '10px' }}>
                 ❌ Hide Changed Pixels
               </button>
            )}

            {error && <div className="error-msg">{error}</div>}
          </div>

          {stats && (
            <div className="stats-results">
              <div className="stat-card">
                <h4>{isUrban ? "Total Urban Growth" : "Forest Cover Change"}</h4>
                <p className={`big-num ${isUrban ? 'red' : (stats.growth_km2 < 0 ? 'red' : 'green')}`}>
                  {stats.growth_km2 > 0 ? "+" : ""}{stats.growth_km2} km²
                </p>
              </div>
              <div className="stat-card">
                <h4>Avg. Annual Rate</h4>
                <p className={`big-num ${isUrban ? 'green' : ''}`}>{stats.rate_per_year} km²/yr</p>
              </div>
            </div>
          )}

          {/* NEW: LULC TRANSITIONS TABLE */}
          {transitions && transitions.length > 0 && (
            <div className="control-card" style={{ marginTop: "20px" }}>
              <h4>Major Land Cover Transitions</h4>
              <p className="description" style={{ fontSize: "0.8rem", marginBottom: "10px" }}>
                Breakdown of changed areas ({startYear} - {endYear})
              </p>
              <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #ccc" }}>
                    <th>From</th>
                    <th>To</th>
                    <th>Area</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {transitions.map((t, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #eee", height: "30px" }}>
                      <td>{t.from}</td>
                      <td>{t.to}</td>
                      <td style={{ fontWeight: "bold" }}>{t.area_km2} km²</td>
                      <td style={{ color: "#d32f2f", fontWeight: "bold" }}>{t.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="dev-map">
          <MapContainer bounds={mapBounds} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Esri World Imagery"
            />

            {changeMapUrl && (
              <TileLayer 
                url={changeMapUrl} 
                zIndex={100} 
              />
            )}

            <GeoJSON 
              key={themeColor} 
              data={aoi} 
              style={{ color: themeColor, weight: 3, dashArray: "5, 5", fillOpacity: 0.1 }} 
            />
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default ChangeAnalysis;