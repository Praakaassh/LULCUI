import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../Supabase/supabaseClient";
import "./home.css";

import { MapContainer, TileLayer, FeatureGroup } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import L from "leaflet";
import * as turf from "@turf/turf";

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const MIN_AREA_KM2 = 5;

const Home = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // AOI state
  const [aoiGeoJSON, setAoiGeoJSON] = useState(null);
  const [areaKm2, setAreaKm2] = useState(null);

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/");
      else {
        setUser(session.user);
        setLoading(false);
      }
    });
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  // AOI created
  const onCreated = (e) => {
    const layer = e.layer;
    const geojson = layer.toGeoJSON();

    const areaSqMeters = turf.area(geojson);
    const areaSqKm = areaSqMeters / 1e6;

    setAoiGeoJSON(geojson);
    setAreaKm2(areaSqKm.toFixed(2));
  };

  const onDeleted = () => {
    setAoiGeoJSON(null);
    setAreaKm2(null);
  };

  // Common navigation helper
  const goToAnalysis = (type) => {
    if (!aoiGeoJSON || areaKm2 < MIN_AREA_KM2) return;

    navigate(`/analysis/${type}`, {
      state: {
        aoi: aoiGeoJSON,
        areaKm2: areaKm2,
      },
    });
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="home-container">
      {/* NAVBAR */}
      <nav className="navbar">
        <div className="nav-brand">LULC Satellite Analyzer</div>
        <div className="nav-user-menu">
          <span>{user?.email}</span>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>

      <div className="main-content">
        {/* LEFT PANEL */}
        <div className="sidebar">
          <h2>1. Select Area of Interest</h2>
          <p className="instruction-text">
            Draw a polygon or rectangle (minimum {MIN_AREA_KM2} km²).
          </p>

          {areaKm2 && (
            <p
              style={{
                marginTop: "10px",
                color: areaKm2 >= MIN_AREA_KM2 ? "#4caf50" : "#f44336",
              }}
            >
              Selected Area: {areaKm2} km²
            </p>
          )}

          <h2 style={{ marginTop: "30px" }}>2. Select Analysis</h2>

          <button
            className="analysis-btn"
            disabled={!aoiGeoJSON || areaKm2 < MIN_AREA_KM2}
            onClick={() => goToAnalysis("pollution")}
          >
            🌫 Environmental Pollution Monitoring
          </button>

          <button
            className="analysis-btn"
            disabled={!aoiGeoJSON || areaKm2 < MIN_AREA_KM2}
            onClick={() => goToAnalysis("disaster")}
          >
            🌪 Disaster Impact Assessment
          </button>

          <button
            className="analysis-btn"
            disabled={!aoiGeoJSON || areaKm2 < MIN_AREA_KM2}
            onClick={() => goToAnalysis("change")}
          >
            📈 Change Detection Over Time
          </button>
        </div>

        {/* MAP */}
        <div className="map-wrapper">
          <MapContainer
            center={[20.5937, 78.9629]}
            zoom={5}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <FeatureGroup>
              <EditControl
                position="topleft"
                onCreated={onCreated}
                onDeleted={onDeleted}
                draw={{
                  rectangle: true,
                  polygon: true,
                  circle: false,
                  marker: false,
                  polyline: false,
                  circlemarker: false,
                }}
              />
            </FeatureGroup>
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default Home;
