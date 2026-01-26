import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./development.css"; // Make sure you have this CSS file

const Development = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // 1. Get AOI from navigation state
  const { aoi } = location.state || {};
  
  // 2. State for results
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Default calculation: 2015 to 2024
  const [startYear, setStartYear] = useState(2015);
  const [endYear, setEndYear] = useState(2024);

  useEffect(() => {
    if (!aoi) {
      alert("No Area of Interest found. Please select an area on the Home page.");
      navigate("/home");
    }
  }, [aoi, navigate]);

  const calculateRate = async () => {
    setLoading(true);
    setError(null);
    setStats(null);

    try {
      // Call your Python Backend
      const response = await fetch('http://localhost:5000/api/calculate-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year_start: startYear,
          year_end: endYear,
          geojson: aoi.geometry
        })
      });

      if (!response.ok) throw new Error("Failed to calculate. Check backend.");
      
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error(err);
      setError("Error calculating stats. Ensure your Python backend is running.");
    } finally {
      setLoading(false);
    }
  };

  if (!aoi) return null;

  return (
    <div className="dev-container">
      <div className="dev-header">
        <button onClick={() => navigate("/home")} className="back-btn">⬅ Back to Home</button>
        <h2>🏗 Development Rate Prediction</h2>
      </div>

      <div className="dev-content">
        {/* Left: Controls & Stats */}
        <div className="dev-sidebar">
          <div className="control-card">
            <h3>Analysis Period</h3>
            <div className="year-inputs">
              <label>
                Start:
                <input 
                  type="number" 
                  value={startYear} 
                  onChange={(e) => setStartYear(e.target.value)} 
                  min="2015" max="2025"
                />
              </label>
              <label>
                End:
                <input 
                  type="number" 
                  value={endYear} 
                  onChange={(e) => setEndYear(e.target.value)} 
                  min="2015" max="2025"
                />
              </label>
            </div>
            <button 
              className="calc-btn" 
              onClick={calculateRate}
              disabled={loading}
            >
              {loading ? "Calculating..." : "Calculate Development Rate 🚀"}
            </button>
          </div>

          {error && <div className="error-msg">{error}</div>}

          {stats && (
            <div className="stats-results">
              <div className="stat-card">
                <h4>Total Urban Growth</h4>
                <p className="big-num red">+{stats.growth_km2} km²</p>
                <small>New built-up area since {startYear}</small>
              </div>

              <div className="stat-card">
                <h4>Avg. Development Rate</h4>
                <p className="big-num green">{stats.rate_per_year} km²/yr</p>
                <small>Speed of urbanization</small>
              </div>

              <div className="prediction-box">
                <h4>🔮 Prediction</h4>
                <p>
                  At this rate, an additional 
                  <b> {(stats.rate_per_year * 5).toFixed(2)} km² </b> 
                  will be urbanized in the next 5 years.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Map Reference */}
        <div className="dev-map">
          <MapContainer 
            bounds={L.geoJSON(aoi).getBounds()} 
            style={{ height: "100%", width: "100%" }}
          >
             <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
             <GeoJSON data={aoi} style={{ color: "#ff4444", fillOpacity: 0.1, weight: 2 }} />
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default Development;