import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../Supabase/supabaseClient";
import "./home.css";

import { MapContainer, TileLayer, FeatureGroup, LayersControl, GeoJSON } from "react-leaflet";
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

const MIN_AREA_KM2 = 0.01;

const Home = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- FIX 1: Initialize State from localStorage ---
  // This checks if we saved a polygon before page load/refresh
  const [aoiGeoJSON, setAoiGeoJSON] = useState(() => {
    const saved = localStorage.getItem("aoiGeoJSON");
    return saved ? JSON.parse(saved) : null;
  });

  const [areaKm2, setAreaKm2] = useState(() => {
    return localStorage.getItem("areaKm2") || null;
  });

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

  // --- FIX 2: Persist State to localStorage ---
  // Whenever the polygon changes, save it to browser storage
  useEffect(() => {
    if (aoiGeoJSON) {
      localStorage.setItem("aoiGeoJSON", JSON.stringify(aoiGeoJSON));
      localStorage.setItem("areaKm2", areaKm2);
    } else {
      localStorage.removeItem("aoiGeoJSON");
      localStorage.removeItem("areaKm2");
    }
  }, [aoiGeoJSON, areaKm2]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear(); // Clear data on logout
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

  // Manual Clear Function (for the sidebar button)
  const handleClearSelection = () => {
    setAoiGeoJSON(null);
    setAreaKm2(null);
    window.location.reload(); // Force reload to clear map visuals completely
  };

  // --- UPDATED NAVIGATION HELPER ---
  const goToAnalysis = (type) => {
    if (!aoiGeoJSON || areaKm2 < MIN_AREA_KM2) return;
  
    let path = `/analysis/${type}`;
  
    if (type === "LULCVIEW") {
      path = "/lulc-view";
    }
    else if (type === "development") {
      path = "/development";
    }
    else if (type === "deforestation") {
      path = "/deforestation";
    }
    else if (type === "Change Detection") {
      path = "/change-detection";
    }
  
    navigate(path, {
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
            <div style={{ marginTop: "10px" }}>
              <p
                style={{
                  color: areaKm2 >= MIN_AREA_KM2 ? "#4caf50" : "#f44336",
                  marginBottom: "10px"
                }}
              >
                Selected Area: {areaKm2} km²
              </p>
              
              {/* Added Clear Button */}
              <button 
                onClick={handleClearSelection}
                style={{
                  background: "#ff4444",
                  color: "white",
                  border: "none",
                  padding: "5px 10px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "0.8rem"
                }}
              >
                Clear Selection 🗑️
              </button>
            </div>
          )}

          <h2 style={{ marginTop: "30px" }}>2. Select Analysis</h2>
           
          {/* LULC VIEW BUTTON */}
          <button
            className="analysis-btn"
            disabled={!aoiGeoJSON || areaKm2 < MIN_AREA_KM2}
            onClick={() => goToAnalysis("LULCVIEW")}
          >
            View LULC MAP
          </button>

          {/* DEVELOPMENT RATE BUTTON */}
          <button
            className="analysis-btn"
            disabled={!aoiGeoJSON || areaKm2 < MIN_AREA_KM2}
            onClick={() => goToAnalysis("development")}
          >
            Development Rate Prediction 🏗
          </button>
          {/* DEFORESTATION RATE BUTTON */}
<button
  className="analysis-btn"
  disabled={!aoiGeoJSON || areaKm2 < MIN_AREA_KM2}
  onClick={() => goToAnalysis("deforestation")}
>
  Deforestation Rate Prediction 🌲
</button>


          {/* CHANGE DETECTION BUTTON (Optional/Extra) */}
          <button
            className="analysis-btn"
            disabled={!aoiGeoJSON || areaKm2 < MIN_AREA_KM2}
            onClick={() => goToAnalysis("Change Detection")}
          >
            Change Detection
          </button>

        </div>

        {/* MAP */}
        <div className="map-wrapper">
          <MapContainer
            center={[20.5937, 78.9629]}
            zoom={5}
            style={{ height: "100%", width: "100%" }}
          >
            <LayersControl position="topright">
              
              <LayersControl.BaseLayer checked name="Satellite (Esri)">
                <TileLayer
                  attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-GP, and the GIS User Community'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              </LayersControl.BaseLayer>

              <LayersControl.BaseLayer name="Street Map (OSM)">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              </LayersControl.BaseLayer>

              <LayersControl.Overlay checked name="Labels (Roads & Names)">
                 <TileLayer
                   url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                 />
              </LayersControl.Overlay>

            </LayersControl>

            {/* --- FIX 3: Restore the Polygon Visual --- */}
            {/* Renders the saved polygon when you navigate back */}
            {aoiGeoJSON && (
              <GeoJSON 
                key={JSON.stringify(aoiGeoJSON)} 
                data={aoiGeoJSON} 
                style={{ color: "#3388ff", weight: 2, fillOpacity: 0.2 }}
              />
            )}

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