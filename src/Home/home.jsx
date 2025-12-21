import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../Supabase/supabaseClient";
import "./home.css";

import { MapContainer, TileLayer, FeatureGroup } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import L from "leaflet";

// Fix for default Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const Home = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // STATE: Stores the boundary of the shape you drew
  const [overlayBounds, setOverlayBounds] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);

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

  const _onCreated = (e) => {
    const { layer } = e;
    
    // 1. Get the rectangular boundary of the shape you drew
    const bounds = layer.getBounds();
    setOverlayBounds(bounds);

    // 2. Log coordinates for your backend
    const coordinates = layer.getLatLngs()[0].map(latlng => [latlng.lat, latlng.lng]);
    console.log("Coordinates:", coordinates);
  };

  const _onDeleted = () => {
    // Remove the Sentinel patch when shape is deleted
    setOverlayBounds(null);
    setAnalysisResults(null);
  };
  
  const runAnalysis = () => {
      setIsAnalyzing(true);
      setTimeout(() => {
          setIsAnalyzing(false);
          setAnalysisResults({ title: "Analysis Complete", stats: { "Status": "Success" } });
      }, 2000);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="home-container">
      <nav className="navbar">
        <div className="nav-brand">LULC Satellite Analyzer</div>
        <div className="nav-user-menu">
          <span>{user?.email}</span>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <div className="main-content">
        <div className="sidebar">
          <h2>1. Select Area</h2>
          <p className="instruction-text">
            Draw a shape. The map inside will switch to Sentinel-2 view.
          </p>

          <h2>2. Run Analysis</h2>
          <button 
            className="tool-btn" 
            onClick={runAnalysis}
            disabled={isAnalyzing || !overlayBounds}
          >
            Generate LULC Map
          </button>
          
           {analysisResults && (
            <div className="results-container">
              <h3>{analysisResults.title}</h3>
              <p>Model Inputs Verified.</p>
            </div>
           )}
        </div>

        <div className="map-wrapper">
          <MapContainer center={[20.5937, 78.9629]} zoom={5}>
            
            {/* 1. BASE LAYER (Always Google/Esri High Res) */}
            <TileLayer
                attribution='Tiles &copy; Esri'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />

            {/* 2. OVERLAY LAYER (Sentinel-2) - Only shows if bounds exist */}
            {overlayBounds && (
              <TileLayer
                // KEY TRICK: The 'bounds' prop restricts this layer to the box
                bounds={overlayBounds} 
                attribution='Sentinel-2'
                url="https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg"
                zIndex={100} // Ensures it sits ON TOP of the base layer
              />
            )}

            {/* Labels (Roads) on top of everything */}
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
                zIndex={200}
            />

            <FeatureGroup>
              <EditControl
                position='topleft'
                onCreated={_onCreated}
                onDeleted={_onDeleted}
                draw={{
                  rectangle: true,
                  polygon: true, // Note: The overlay will be a rectangle around the polygon
                  circle: false,
                  marker: false,
                  polyline: false,
                  circlemarker: false
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