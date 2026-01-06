import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  ImageOverlay,
} from "react-leaflet";
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
  .legend-panel { position: absolute; bottom: 20px; right: 20px; z-index: 1000; background: rgba(0, 0, 0, 0.8); padding: 10px; border-radius: 6px; font-size: 0.75rem; border: 1px solid #444; pointer-events: none; }
  .legend-panel h4 { margin: 0 0 5px 0; color: #aaa; }
  .l-item { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
  .box { width: 10px; height: 10px; display: inline-block; border-radius: 2px; }
  .water { background: #419bdf; } .trees { background: #397d49; } .grass { background: #88b053; } .crops { background: #e49635; } .urban { background: #c4281b; } 
`;

// --- SINGLE MAP COMPONENT ---
// Now accepts 'fetchUrl' function instead of fetching internally
const MapScreen = React.memo(({ screenId, layerId, onLayerChange, fetchUrl, bounds, maskGeo }) => {
  const [tileUrl, setTileUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true; // Prevents setting state if component unmounts

    if (layerId === "satellite") {
      setTileUrl("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}");
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      // CALL THE CACHED FETCH FUNCTION FROM PARENT
      const url = await fetchUrl(layerId, maskGeo.geometry);
      if (active) {
        setTileUrl(url);
        setLoading(false);
      }
    };

    loadData();

    return () => { active = false; };
  }, [layerId, maskGeo, fetchUrl]);

  const maxPanBounds = useMemo(() => L.latLngBounds(bounds._southWest, bounds._northEast).pad(10.0), [bounds]);

  return (
    <div className="map-frame">
      <div className="map-controls">
        <select 
          className="map-select"
          value={layerId}
          onChange={(e) => onLayerChange(screenId, e.target.value)}
        >
          <option value="satellite">Satellite (Ref)</option>
          {Array.from({length: 11}, (_, i) => 2015 + i).map(year => (
            <option key={year} value={year}>{year} Map</option>
          ))}
        </select>
        {loading && <span className="loading-indicator">Cache Miss (Fetching)...</span>}
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
            opacity={layerId === 'satellite' ? 1 : 0.9} 
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
    { id: 1, layer: "2015" },
    { id: 2, layer: "2025" },
  ]);

  // --- CACHE STATE ---
  // Stores URLs like: { "2015": "https://earthengine...", "2016": "..." }
  const [urlCache, setUrlCache] = useState({});

  if (!location.state?.aoi) {
     return <div style={{color: "white", padding: 20}}>Error: No AOI data found. Go back home.</div>;
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

  // --- SMART FETCH FUNCTION (WITH CACHING) ---
  const getLayerUrl = useCallback(async (year, geojson) => {
    // 1. Check Cache First
    if (urlCache[year]) {
      console.log(`Cache Hit for ${year}`);
      return urlCache[year];
    }

    // 2. If not in cache, fetch from Python Backend
    console.log(`Cache Miss for ${year}, fetching...`);
    try {
      const response = await fetch('http://localhost:5000/api/get-gee-layer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, geojson })
      });
      
      if (!response.ok) return null;
      
      const data = await response.json();
      
      // 3. Save to Cache
      setUrlCache(prev => ({ ...prev, [year]: data.url }));
      
      return data.url;
    } catch (error) {
      console.error("Fetch error:", error);
      return null;
    }
  }, [urlCache]); // Depends on current cache state

  // --- HANDLERS ---
  const addScreen = () => {
    if (screens.length < 6) {
      setScreens([...screens, { id: Math.random(), layer: "satellite" }]);
    }
  };

  const removeScreen = () => {
    if (screens.length > 2) {
      setScreens(screens.slice(0, -1));
    }
  };

  const handleLayerChange = useCallback((id, newLayer) => {
    setScreens(prevScreens => prevScreens.map(s => s.id === id ? { ...s, layer: newLayer } : s));
  }, []);

  return (
    <>
      <style>{STYLES}</style>

      <div className="cd-container">
        {/* HEADER */}
        <div className="cd-header">
          <div className="cd-title">
            <button onClick={() => navigate(-1)} className="back-btn">⬅ Back</button>
            <span>Sentinel-2 LULC Analysis (Cached)</span>
          </div>

          <div className="screen-controls">
            <span className="screen-count">{screens.length} Screens</span>
            <button 
              className="screen-btn remove" 
              onClick={removeScreen} 
              disabled={screens.length <= 2}
              title="Remove Screen"
            >
              -
            </button>
            <button 
              className="screen-btn" 
              onClick={addScreen} 
              disabled={screens.length >= 6}
              title="Add Screen"
            >
              +
            </button>
          </div>
        </div>

        {/* DYNAMIC GRID */}
        <div className={`cd-grid grid-${screens.length}`}>
          {screens.map((screen) => (
            <MapScreen 
              key={screen.id}
              screenId={screen.id}
              layerId={screen.layer}
              onLayerChange={handleLayerChange}
              fetchUrl={getLayerUrl} // Pass the smart fetcher
              bounds={bounds}
              maskGeo={maskGeometry}
            />
          ))}
        </div>

        <div className="legend-panel">
          <h4>Class Legend</h4>
          <div className="l-item"><span className="box urban"></span> Built-up / Urban</div>
          <div className="l-item"><span className="box trees"></span> Trees / Forest</div>
          <div className="l-item"><span className="box crops"></span> Crops / Agriculture</div>
          <div className="l-item"><span className="box water"></span> Water</div>
          <div className="l-item"><span className="box grass"></span> Grassland</div>
        </div>
      </div>
    </>
  );
};

export default ChangeDetection;