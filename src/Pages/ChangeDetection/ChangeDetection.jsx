import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  ImageOverlay,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const ChangeDetection = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Safety check
  if (!location.state || !location.state.aoi) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2>No Area Selected</h2>
        <button onClick={() => navigate("/home")}>Go Back</button>
      </div>
    );
  }

  const { aoi, areaKm2 } = location.state;

  const bounds = L.geoJSON(aoi).getBounds();

  // UI state
  const [selectedYear, setSelectedYear] = useState(2020);
  const [showLULC, setShowLULC] = useState(false);

  /**
   * TEMPORARY:
   * Later this will come from backend like:
   * http://localhost:8000/output/lulc_2020.png
   */
  const lulcImageByYear = {
    2015: null,
    2020: null,
    2023: null,
  };

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      {/* HEADER */}
      <div
        style={{
          padding: "12px 20px",
          background: "#0b0f14",
          color: "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <strong>Change Detection Over Time</strong>
          <span style={{ marginLeft: "10px", fontSize: "14px" }}>
            Area: {areaKm2} km²
          </span>
        </div>
        <button onClick={() => navigate(-1)}>⬅ Back</button>
      </div>

      {/* CONTENT */}
      <div style={{ display: "flex", height: "calc(100% - 50px)" }}>
        {/* LEFT CONTROL PANEL */}
        <div
          style={{
            width: "300px",
            padding: "20px",
            background: "#111827",
            color: "#fff",
          }}
        >
          <h3>Satellite & LULC View</h3>

          {/* YEAR SELECTOR */}
          <label style={{ display: "block", marginTop: "15px" }}>
            Select Year
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{
                width: "100%",
                marginTop: "6px",
                padding: "6px",
              }}
            >
              <option value={2015}>2015</option>
              <option value={2020}>2020</option>
              <option value={2023}>2023</option>
            </select>
          </label>

          {/* TOGGLE LULC */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: "15px",
              gap: "8px",
            }}
          >
            <input
              type="checkbox"
              checked={showLULC}
              onChange={() => setShowLULC(!showLULC)}
            />
            Show LULC Map
          </label>

          <p style={{ fontSize: "12px", marginTop: "15px", opacity: 0.7 }}>
            Satellite imagery is always visible.  
            LULC maps are shown as overlays per year.
          </p>
        </div>

        {/* MAP */}
        <div style={{ flex: 1 }}>
        <MapContainer
  style={{ height: "100%", width: "100%" }}
  bounds={bounds}
  maxBounds={bounds}
  maxBoundsViscosity={1.0}
>
  {/* SATELLITE */}
  <TileLayer
    attribution="Imagery © Esri"
    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
  />

  {/* MASK */}
  <GeoJSON
    data={{
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-180, -90],
            [180, -90],
            [180, 90],
            [-180, 90],
            [-180, -90],
          ],
          aoi.geometry.coordinates[0],
        ],
      },
    }}
    style={{
      fillColor: "#000",
      fillOpacity: 0.55,
      stroke: false,
    }}
  />

  {/* AOI BORDER */}
  <GeoJSON
    data={aoi}
    style={{
      color: "#00ff88",
      weight: 2,
      fillOpacity: 0,
    }}
  />
</MapContainer>

        </div>
      </div>
    </div>
  );
};

export default ChangeDetection;
