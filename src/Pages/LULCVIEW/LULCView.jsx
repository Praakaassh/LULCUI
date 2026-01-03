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

const LULCView = () => {
  const navigate = useNavigate();
  const { state } = useLocation();

  const [lulcImage, setLulcImage] = useState(null);
  const [imageBounds, setImageBounds] = useState(null);

  if (!state || !state.aoi) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2>No AOI found</h2>
        <button onClick={() => navigate("/home")}>Go Back</button>
      </div>
    );
  }

  const { aoi, areaKm2 } = state;

  // Fetch clipped LULC from backend
  useEffect(() => {
    fetch("http://localhost:5000/api/clip-lulc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aoi }),
    })
      .then((res) => res.json())
      .then((data) => {
        setLulcImage(data.imageUrl);
        setImageBounds(data.bounds);
      })
      .catch((err) => console.error("LULC load error:", err));
  }, [aoi]);

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      {/* TOP BAR */}
      <div
        style={{
          padding: "10px 20px",
          background: "#0b0f14",
          color: "#fff",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <div>
          <strong>LULC Map View</strong> | Area: {areaKm2} km² | Dataset:
          Copernicus
        </div>
        <button onClick={() => navigate(-1)}>⬅ Back</button>
      </div>

      {/* MAP */}
      <MapContainer
        style={{ height: "calc(100% - 50px)", width: "100%" }}
        bounds={L.geoJSON(aoi).getBounds()}
      >
        {/* Optional faint basemap */}
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          opacity={0.25}
        />

        {/* CLIPPED LULC IMAGE */}
        {lulcImage && imageBounds && (
          <ImageOverlay
            url={lulcImage}
            bounds={imageBounds}
            opacity={0.9}
          />
        )}

        {/* AOI BORDER */}
        <GeoJSON
          data={aoi}
          style={{
            color: "#00c896",
            weight: 2,
            fillOpacity: 0,
          }}
        />
      </MapContainer>
    </div>
  );
};

export default LULCView;
