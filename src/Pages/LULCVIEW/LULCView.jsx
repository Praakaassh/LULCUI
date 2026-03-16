import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import React from "react";

// --- CSS STYLES ---
const STYLES = `
  .cd-container { height: 100vh; display: flex; flex-direction: column; background: #0b0f14; color: white; font-family: 'Segoe UI', sans-serif; overflow: hidden; }
  .cd-header { height: 50px; background: #111827; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; border-bottom: 1px solid #333; flex-shrink: 0; }
  .cd-title { display: flex; align-items: center; gap: 15px; font-weight: 600; font-size: 1rem; }
  .back-btn { background: none; border: 1px solid #444; color: #fff; padding: 4px 10px; border-radius: 4px; cursor: pointer; transition: background 0.2s; }
  .back-btn:hover { background: #333; }
  .screen-controls { display: flex; align-items: center; gap: 10px; }
  .screen-btn { background: #2563eb; color: white; border: none; width: 30px; height: 30px; border-radius: 4px; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .screen-btn:disabled { background: #4b5563; cursor: not-allowed; opacity: 0.5; }
  .screen-btn.remove { background: #dc2626; }
  .screen-count { font-size: 0.9rem; color: #aaa; margin: 0 5px; }
  .cd-grid { flex: 1; display: grid; gap: 2px; background: #333; height: calc(100vh - 50px); }
  .grid-2 { grid-template-columns: 1fr 1fr; }
  .grid-3 { grid-template-columns: 1fr 1fr 1fr; }
  .grid-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
  .grid-5 { grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 1fr 1fr; }
  .grid-6 { grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 1fr 1fr; }
  .map-frame { position: relative; width: 100%; height: 100%; background: #000; overflow: hidden; }
  .map-controls { position: absolute; top: 10px; left: 50px; z-index: 999; background: rgba(0, 0, 0, 0.8); padding: 5px; border-radius: 4px; backdrop-filter: blur(4px); border: 1px solid rgba(255, 255, 255, 0.2); display: flex; align-items: center; gap: 8px; }
  .map-select { background: transparent; color: white; border: none; font-size: 0.85rem; outline: none; cursor: pointer; font-weight: 500; }
  .map-select option { background: #111; color: white; }
  .loading-indicator { font-size: 0.7rem; color: #fbbf24; animation: pulse 1.5s infinite; }
  @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
  .error-indicator { font-size: 0.7rem; color: #f87171; }

  /* LEGEND PANEL STYLES */
  .legend-panel { position: absolute; bottom: 20px; right: 20px; z-index: 1000; background: rgba(0, 0, 0, 0.85); padding: 12px; border-radius: 6px; font-size: 0.75rem; border: 1px solid #444; pointer-events: none; min-width: 140px; }
  .legend-panel h4 { margin: 0 0 8px 0; color: #ccc; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #444; padding-bottom: 5px; }
  .l-item { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .box { width: 12px; height: 12px; display: inline-block; border-radius: 2px; border: 1px solid rgba(255,255,255,0.2); }

  /* DYNAMIC WORLD PALETTE COLORS */
  .water { background: #419bdf; }
  .trees { background: #397d49; }
  .grass { background: #88b053; }
  .flooded_veg { background: #7a87c6; }
  .crops { background: #e49635; }
  .shrub { background: #dfc35a; }
  .urban { background: #c4281b; }
  .bare { background: #a59b8f; }
  .snow { background: #b39fe1; }
`;

// --- SINGLE MAP COMPONENT ---
const MapScreen = React.memo(({ screenId, layerId, onLayerChange, fetchUrl, bounds, maskGeo }) => {
  const [tileUrl, setTileUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setError(null);

    if (layerId === "satellite") {
      setTileUrl("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}");
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setTileUrl(null);
      try {
        const url = await fetchUrl(layerId, maskGeo.geometry);
        if (active) {
          if (url) {
            setTileUrl(url);
          } else {
            setError("No data");
          }
          setLoading(false);
        }
      } catch (err) {
        console.error("MapScreen fetch error:", err);
        if (active) {
          setError("Failed");
          setLoading(false);
        }
      }
    };

    loadData();

    return () => { active = false; };
  }, [layerId, maskGeo, fetchUrl]);

  const maxPanBounds = useMemo(() =>
    L.latLngBounds(bounds._southWest, bounds._northEast).pad(10.0),
  [bounds]);

  return (
    <div className="map-frame">
      <div className="map-controls">
        <select
          className="map-select"
          value={layerId}
          onChange={(e) => onLayerChange(screenId, e.target.value)}
        >
          <option value="satellite">Satellite (Ref)</option>
          {/* Dynamic World V1 data available 2015–2024 */}
          {Array.from({ length: 11 }, (_, i) => 2016 + i).map(year => (
            <option key={year} value={String(year)}>{year} Map</option>
          ))}
        </select>
        {loading && <span className="loading-indicator">Fetching...</span>}
        {error && <span className="error-indicator">⚠ {error}</span>}
      </div>

      <MapContainer
        id={`map-view-${screenId}`}
        style={{ height: "100%", width: "100%", background: "#0b0f14" }}
        bounds={bounds}
        maxBounds={maxPanBounds}
        maxBoundsViscosity={0.8}
        minZoom={4}
        zoomControl={true}
        attributionControl={false}
      >
        {tileUrl && (
          <TileLayer
            url={tileUrl}
            noWrap={true}
            opacity={layerId === "satellite" ? 1 : 0.9}
          />
        )}
        <GeoJSON
          data={maskGeo}
          style={{ fillColor: "#0b0f14", fillOpacity: 1, stroke: false }}
        />
      </MapContainer>
    </div>
  );
});

// --- MAIN COMPONENT ---
const ChangeDetection = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [screens, setScreens] = useState([
    { id: 1, layer: "2016" },
    { id: 2, layer: "2025" }, // Fixed: was "2025" which doesn't exist in Dynamic World
  ]);

  // FIX: useRef instead of useState for cache — prevents infinite re-render loop
  const urlCacheRef = useRef({});

  if (!location.state?.aoi) {
    return <div style={{ color: "white", padding: 20 }}>Error: No AOI data found. Go back home.</div>;
  }

  const { aoi } = location.state;
  const bounds = useMemo(() => L.geoJSON(aoi).getBounds(), [aoi]);

  const maskGeometry = useMemo(() => ({
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]],
        aoi.geometry.coordinates[0],
      ],
    },
  }), [aoi]);

  // FIX: empty dependency array — stable function reference, no infinite loop
  const getLayerUrl = useCallback(async (year, geojson) => {
    const cacheKey = String(year);

    // Return cached URL immediately if available
    if (urlCacheRef.current[cacheKey]) {
      return urlCacheRef.current[cacheKey];
    }

    try {
      // 🔴 Updated to point to live Render backend
      const response = await fetch("https://prakash787-lulcmodel.hf.space/api/get-gee-layer",{
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: parseInt(year), geojson }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error(`GEE layer error for ${year}:`, errData.error || response.status);
        return null;
      }

      const data = await response.json();

      if (data.url) {
        urlCacheRef.current[cacheKey] = data.url; // Cache without triggering re-render
        return data.url;
      }

      return null;
    } catch (error) {
      console.error(`Fetch error for year ${year}:`, error);
      return null;
    }
  }, []); // ✅ No dependencies — function never recreates, no infinite loop

  const addScreen = () => {
    if (screens.length < 6) {
      setScreens(prev => [...prev, { id: Math.random(), layer: "satellite" }]);
    }
  };

  const removeScreen = () => {
    if (screens.length > 2) {
      setScreens(prev => prev.slice(0, -1));
    }
  };

  const handleLayerChange = useCallback((id, newLayer) => {
    setScreens(prev => prev.map(s => s.id === id ? { ...s, layer: newLayer } : s));
  }, []);

  return (
    <>
      <style>{STYLES}</style>

      <div className="cd-container">
        <div className="cd-header">
          <div className="cd-title">
            <button onClick={() => navigate(-1)} className="back-btn">⬅ Back</button>
            <span>Sentinel-2 LULC Analysis</span>
          </div>

          <div className="screen-controls">
            <span className="screen-count">{screens.length} Screens</span>
            <button
              className="screen-btn remove"
              onClick={removeScreen}
              disabled={screens.length <= 2}
              title="Remove Screen"
            >−</button>
            <button
              className="screen-btn"
              onClick={addScreen}
              disabled={screens.length >= 6}
              title="Add Screen"
            >+</button>
          </div>
        </div>

        <div className={`cd-grid grid-${screens.length}`}>
          {screens.map((screen) => (
            <MapScreen
              key={screen.id}
              screenId={screen.id}
              layerId={screen.layer}
              onLayerChange={handleLayerChange}
              fetchUrl={getLayerUrl}
              bounds={bounds}
              maskGeo={maskGeometry}
            />
          ))}
        </div>

        <div className="legend-panel">
          <h4>Dynamic World Legend</h4>
          <div className="l-item"><span className="box water"></span> Water</div>
          <div className="l-item"><span className="box trees"></span> Trees</div>
          <div className="l-item"><span className="box grass"></span> Grass</div>
          <div className="l-item"><span className="box flooded_veg"></span> Flooded Vegetation</div>
          <div className="l-item"><span className="box crops"></span> Crops</div>
          <div className="l-item"><span className="box shrub"></span> Shrub & Scrub</div>
          <div className="l-item"><span className="box urban"></span> Built-up</div>
          <div className="l-item"><span className="box bare"></span> Bare Ground</div>
          <div className="l-item"><span className="box snow"></span> Snow & Ice</div>
        </div>
      </div>
    </>
  );
};

export default ChangeDetection;