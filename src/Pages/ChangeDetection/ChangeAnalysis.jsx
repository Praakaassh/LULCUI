import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, GeoJSON, ImageOverlay } from "react-leaflet";
import L from "leaflet";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import "leaflet/dist/leaflet.css";
import "./ChangeAnalysis.css";

// Fix Leaflet marker icons
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
let DefaultIcon = L.icon({
  iconUrl: icon, shadowUrl: iconShadow,
  iconSize: [25, 41], iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const ChangeAnalysis = () => {
  const { aoi } = useLocation().state || {};
  const navigate = useNavigate();

  // --- STATES ---
  const [startYear, setStartYear] = useState(2015);
  const [endYear, setEndYear] = useState(2024);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Data States
  const [stats, setStats] = useState(null);
  const [transitions, setTransitions] = useState(null);
  
  // AI States
  const [aiInference, setAiInference] = useState(null);
  const [usedModel, setUsedModel] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Prediction States
  const [modelLoading, setModelLoading] = useState(false);
  const [heatmapUrl, setHeatmapUrl] = useState(null);
  const [heatmapBounds, setHeatmapBounds] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // PDF Report States
  const [reportLoading, setReportLoading] = useState(false);
  const [lulcThumbUrl, setLulcThumbUrl] = useState(null);
  const [satelliteMapUrl, setSatelliteMapUrl] = useState(null);
  // NEW: Store the base64 versions for bulletproof PDF generation
  const [base64Images, setBase64Images] = useState({ lulc: null, sat: null, heat: null });

  // UI States
  const [sidebarWidth, setSidebarWidth] = useState(420);
  const isResizing = useRef(false);

  useEffect(() => { if (!aoi) navigate("/home"); }, [aoi, navigate]);

  // --- RESIZE LOGIC ---
  const startResizing = useCallback(() => {
    isResizing.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopResizing);
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", stopResizing);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isResizing.current) return;
    setSidebarWidth(Math.max(380, Math.min(e.clientX, 800)));
  }, []);

  const API_BASE = "http://localhost:5000/api";
  const MODEL_BASE = "http://localhost:5001/api";

  const runFullAnalysis = async () => {
    setLoading(true); setError(null); setStats(null); setTransitions(null); setAiInference(null);
    const center = L.geoJSON(aoi).getBounds().getCenter();

    try {
      const dataRes = await fetch(`${API_BASE}/analyze-lulc`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year_start: startYear, year_end: endYear, geojson: aoi.geometry }),
      });

      if (!dataRes.ok) throw new Error("Analysis failed.");
      const data = await dataRes.json();
      
      setStats({
        totalChangedArea: data.total_changed_km2,
        dominantShift: data.dominant_shift,
        period: data.analyzed_period,
        coords: { lat: center.lat.toFixed(4), lng: center.lng.toFixed(4) }
      });
      setTransitions(data.transitions);

      setAiLoading(true);
      const aiRes = await fetch(`${API_BASE}/generate-inference`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, coords: { lat: center.lat, lon: center.lng } }),
      });
      
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        setAiInference(aiData.inference);
        setUsedModel(aiData.used_model || "Local Heuristic");
        setStats(prev => ({ ...prev, location: aiData.location })); 
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false); setAiLoading(false);
    }
  };

  const runAIModel = async () => {
    setModelLoading(true);
    try {
      const response = await fetch(`${MODEL_BASE}/predict`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geojson: aoi.geometry }),
      });
      const data = await response.json();
      setHeatmapUrl(data.url); setHeatmapBounds(data.bounds); setShowHeatmap(true);
      return data.url; 
    } catch (err) {
      setError("Prediction Model Offline");
      return null;
    } finally {
      setModelLoading(false);
    }
  };

  // --- HELPER: Convert URL to Base64 to bypass CORS in html2canvas ---
  const fetchImageAsBase64 = async (url) => {
    if (!url) return null;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Failed to convert image to base64", url, e);
      return null;
    }
  };

  // --- AUTOMATED PDF GENERATOR (BULLETPROOF BASE64 IMAGES) ---
  const generatePDFReport = async () => {
    if (!stats || !aiInference) {
      alert("Please Run Historical Analysis first!");
      return;
    }
    setReportLoading(true);

    try {
      let currentHeatmap = heatmapUrl;
      if (!currentHeatmap) currentHeatmap = await runAIModel();

      // Fetch Image URLs
      const lulcRes = await fetch(`${API_BASE}/get-lulc-thumb`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: endYear, geojson: aoi.geometry })
      });
      const lulcData = await lulcRes.json();
      
      const satRes = await fetch(`${API_BASE}/get-satellite-thumb`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: endYear, geojson: aoi.geometry })
      });
      const satData = await satRes.json();

      // Convert ALL images to Base64 *before* rendering the PDF template
      const b64Lulc = await fetchImageAsBase64(lulcData.url);
      const b64Sat = await fetchImageAsBase64(satData.url);
      const b64Heat = await fetchImageAsBase64(currentHeatmap);

      // Save to state so the hidden DOM updates with the Base64 strings
      setBase64Images({ lulc: b64Lulc, sat: b64Sat, heat: b64Heat });

      // Give the React DOM a moment to update the <img> tags
      setTimeout(async () => {
        const reportElement = document.getElementById("hidden-pdf-report");
        reportElement.style.display = "block"; 

        const canvas = await html2canvas(reportElement, { 
            scale: 2, 
            useCORS: true, // Still good practice
            logging: false,
            windowWidth: 800 
        });
        
        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        
        const pdfWidth = 210; 
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: [pdfWidth, pdfHeight] 
        });

        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
        pdf.save(`LULC_Report_${stats.location || 'Region'}.pdf`);
        
        reportElement.style.display = "none"; 
        setReportLoading(false);
      }, 1000); // Shorter timeout needed since images are already local Base64

    } catch (err) {
      console.error(err);
      alert("Failed to generate PDF. Check console.");
      setReportLoading(false);
    }
  };

  if (!aoi) return null;
  const mapBounds = L.geoJSON(aoi).getBounds();

  return (
    <div className="dev-container" style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      
      {/* LOADING OVERLAYS */}
      {loading && <div className="loading-overlay"><div className="spinner"></div><p>Performing Analysis...</p></div>}
      {reportLoading && <div className="loading-overlay" style={{backgroundColor: 'rgba(142, 68, 173, 0.95)', zIndex: 9999}}><div className="spinner"></div><p>Compiling High-Res PDF Report...</p></div>}

      <div className="dev-header">
        <button onClick={() => navigate("/home")} className="back-btn">⬅ Back</button>
        <h2>🌍 LULC Analysis & Future Simulation</h2>
      </div>

      <div className="dev-content" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* RESIZABLE SIDEBAR */}
        <div className="dev-sidebar" style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px`, overflowY: 'auto' }}>
          
          <div className="control-card">
            <h3>Parameters & Models</h3>
            <div className="year-inputs">
              <label>Start: <input type="number" value={startYear} onChange={(e) => setStartYear(Number(e.target.value))} /></label>
              <label>End: <input type="number" value={endYear} onChange={(e) => setEndYear(Number(e.target.value))} /></label>
            </div>
            <button className="calc-btn" onClick={runFullAnalysis} disabled={loading}>
              {loading ? "Analyzing..." : "1. Run Historical Analysis 🚀"}
            </button>
            <button className="calc-btn" onClick={runAIModel} disabled={modelLoading} style={{backgroundColor: "#8e44ad", marginTop: "10px"}}>
              {modelLoading ? "Simulating..." : "2. Predict Future Growth 🔮"}
            </button>
            {heatmapUrl && (
                <button className="calc-btn secondary-btn" onClick={() => setShowHeatmap(!showHeatmap)} style={{marginTop: "8px", backgroundColor: "#333"}}>
                  {showHeatmap ? "❌ Hide Heatmap" : "👁️ Show Heatmap"}
                </button>
            )}
            
            {/* GENERATE PDF BUTTON */}
            {aiInference && (
              <button className="calc-btn" onClick={generatePDFReport} disabled={reportLoading} style={{backgroundColor: "#27ae60", marginTop: "15px", border: '2px solid #2ecc71'}}>
                {reportLoading ? "Generating..." : "3. Generate Final PDF Report 📄"}
              </button>
            )}
          </div>

          {error && <div className="error-msg" style={{color: '#ff4d4d', padding: '10px', border: '1px solid #ff4d4d', borderRadius: '4px', margin: '10px 0'}}>{error}</div>}

          {/* KEY METRICS DASHBOARD */}
          {stats && (
            <div className="metrics-grid">
              <div className="metric-box">
                <span className="metric-title">Total Change</span>
                <span className="metric-value highlight-red">{stats.totalChangedArea} km²</span>
              </div>
              <div className="metric-box">
                <span className="metric-title">Dominant Shift</span>
                <span className="metric-value highlight-purple">{stats.dominantShift}</span>
              </div>
              <div className="metric-box">
                <span className="metric-title">Analyzed Period</span>
                <span className="metric-value">{stats.period}</span>
              </div>
            </div>
          )}

          {/* CSS-BASED ANALYTICAL CHART */}
          {transitions && stats && (
            <div className="control-card">
              <h3>Shift Distribution Intensity</h3>
              <div className="custom-chart-container">
                {transitions.slice(0, 4).map((t, i) => {
                  const percentage = ((t.area_km2 / stats.totalChangedArea) * 100).toFixed(1);
                  const isUrban = t.to.includes("Built");
                  return (
                    <div key={i} className="chart-bar-row">
                      <div className="chart-label" title={`${t.from} → ${t.to}`}>{t.from} → {t.to}</div>
                      <div className="chart-track">
                        <div 
                          className="chart-fill" 
                          style={{ 
                            width: `${percentage}%`, 
                            backgroundColor: isUrban ? '#ff4d4d' : '#4dff88' 
                          }}
                        ></div>
                      </div>
                      <div className="chart-value">{percentage}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI CONSULTANT REPORT */}
          {(aiLoading || aiInference) && (
            <div className="control-card ai-insight">
              <h3>✨ AI Data Analyst Insights</h3>
              {aiLoading ? <p>Generating localized urban report...</p> : (
                <>
                  <p className="detailed-text" style={{ lineHeight: '1.6' }}>{aiInference}</p>
                  <div style={{fontSize: '0.7rem', color: '#8e44ad', marginTop: '10px', fontWeight: 'bold'}}>
                    ⚡ ENGINE: {usedModel?.toUpperCase()}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TRANSITION MATRIX */}
          {transitions && (
            <div className="control-card">
              <h3>Detailed Transition Matrix</h3>
              <div className="table-wrapper">
                <table style={{width: '100%', textAlign: 'left', borderCollapse: 'collapse'}}>
                  <thead>
                    <tr style={{borderBottom: '1px solid #444'}}>
                      <th style={{padding: '8px'}}>From</th><th style={{padding: '8px'}}>To</th><th style={{padding: '8px'}}>Area km²</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transitions.map((t, i) => (
                      <tr key={i} style={{borderBottom: '1px solid #333', backgroundColor: t.to.includes("Built") ? 'rgba(255, 77, 77, 0.1)' : 'transparent'}}>
                        <td style={{padding: '8px'}}>{t.from}</td>
                        <td style={{padding: '8px', fontWeight: 'bold'}}>{t.to}</td>
                        <td style={{padding: '8px'}}>{t.area_km2}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* RESIZE HANDLE */}
        <div className="resizer-handle" onMouseDown={startResizing} title="Drag to resize sidebar" />

        {/* MAP */}
        <div className="dev-map" style={{ flex: 1, position: 'relative' }}>
          <MapContainer bounds={mapBounds} style={{ height: "100%", width: "100%", zIndex: 1 }} zoomControl={false}>
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
            <GeoJSON data={aoi} style={{ color: "#4a90e2", weight: 2, fillOpacity: 0.05 }} />
            {showHeatmap && heatmapUrl && heatmapBounds && (
              <ImageOverlay url={heatmapUrl} bounds={heatmapBounds} opacity={0.7} zIndex={1000} />
            )}
          </MapContainer>
        </div>
      </div>

      {/* --- HIDDEN PDF REPORT TEMPLATE --- */}
      <div id="hidden-pdf-report" style={{ 
          display: 'none', position: 'absolute', top: '-9999px', left: '-9999px', 
          width: '800px', backgroundColor: '#ffffff', color: '#000000', padding: '40px', fontFamily: 'Helvetica, Arial, sans-serif' 
      }}>
        {/* HEADER */}
        <div style={{ borderBottom: '3px solid #8e44ad', paddingBottom: '15px', marginBottom: '20px' }}>
          <h1 style={{ margin: 0, color: '#2c3e50', fontSize: '28px' }}>Strategic Urban & LULC Report</h1>
          <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#7f8c8d' }}>
            Location: {stats?.location || 'Specified Region'} | Coordinates: [Lat: {stats?.coords?.lat}, Lng: {stats?.coords?.lng}]
          </p>
        </div>

        {/* KEY METRICS BOXES */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
          <div style={{ flex: 1, backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #dee2e6', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#6c757d', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Change</div>
            <div style={{ fontSize: '22px', color: '#dc3545', fontWeight: 'bold', marginTop: '5px' }}>{stats?.totalChangedArea} km²</div>
          </div>
          <div style={{ flex: 1, backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #dee2e6', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#6c757d', textTransform: 'uppercase', fontWeight: 'bold' }}>Dominant Shift</div>
            <div style={{ fontSize: '22px', color: '#6f42c1', fontWeight: 'bold', marginTop: '5px' }}>{stats?.dominantShift}</div>
          </div>
          <div style={{ flex: 1, backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #dee2e6', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#6c757d', textTransform: 'uppercase', fontWeight: 'bold' }}>Analyzed Period</div>
            <div style={{ fontSize: '22px', color: '#343a40', fontWeight: 'bold', marginTop: '5px' }}>{startYear} - {endYear}</div>
          </div>
        </div>

        {/* AI INSIGHTS */}
        <h3 style={{ color: '#2c3e50', borderBottom: '1px solid #bdc3c7', paddingBottom: '5px', marginTop: '10px' }}>1. AI Urban Insights</h3>
        <p style={{ lineHeight: '1.6', fontSize: '15px', color: '#34495e', textAlign: 'justify' }}>{aiInference}</p>

        {/* SHIFT DISTRIBUTION CHART */}
        <h3 style={{ color: '#2c3e50', borderBottom: '1px solid #bdc3c7', paddingBottom: '5px', marginTop: '30px' }}>2. Shift Distribution Intensity</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
          {transitions && stats && transitions.slice(0, 4).map((t, i) => {
            const percentage = ((t.area_km2 / stats.totalChangedArea) * 100).toFixed(1);
            const isUrban = t.to.includes("Built");
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', fontSize: '14px', color: '#2c3e50' }}>
                <div style={{ width: '40%', fontWeight: 'bold' }}>{t.from} → {t.to}</div>
                <div style={{ width: '45%', backgroundColor: '#ecf0f1', height: '12px', borderRadius: '6px', overflow: 'hidden', margin: '0 15px' }}>
                  <div style={{ width: `${percentage}%`, backgroundColor: isUrban ? '#e74c3c' : '#2ecc71', height: '100%' }}></div>
                </div>
                <div style={{ width: '15%', textAlign: 'right', fontWeight: 'bold' }}>{percentage}%</div>
              </div>
            );
          })}
        </div>

        {/* TRANSITION MATRIX */}
        <h3 style={{ color: '#2c3e50', borderBottom: '1px solid #bdc3c7', paddingBottom: '5px', marginTop: '30px' }}>3. Detailed Transition Matrix</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '14px', color: '#2c3e50' }}>
          <thead>
            <tr style={{ backgroundColor: '#ecf0f1', borderBottom: '2px solid #bdc3c7' }}>
              <th style={{ padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>From (Previous State)</th>
              <th style={{ padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>To (Current State)</th>
              <th style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>Area (km²)</th>
            </tr>
          </thead>
          <tbody>
            {transitions && transitions.map((t, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #bdc3c7', backgroundColor: t.to.includes("Built") ? 'rgba(231, 76, 60, 0.15)' : 'transparent' }}>
                <td style={{ padding: '10px', color: '#34495e' }}>{t.from}</td>
                <td style={{ padding: '10px', fontWeight: 'bold', color: t.to.includes("Built") ? '#c0392b' : '#27ae60' }}>{t.to}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>{t.area_km2}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* MAP VISUALIZATIONS (Using Base64 Strings) */}
        <h3 style={{ color: '#2c3e50', borderBottom: '1px solid #bdc3c7', paddingBottom: '5px', marginTop: '30px' }}>4. Geospatial Validations</h3>
        <div style={{ display: 'flex', gap: '20px', marginTop: '15px', alignItems: 'flex-start' }}>
          
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#34495e' }}>Current LULC Classification</h4>
            <div style={{ width: '100%', aspectRatio: '1/1', position: 'relative', border: '1px solid #bdc3c7', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#ecf0f1' }}>
              {base64Images.lulc ? (
                <img src={base64Images.lulc} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="LULC Base Map" />
              ) : (
                <div style={{padding: '50px 0', color: '#7f8c8d'}}>Loading Map...</div>
              )}
            </div>
          </div>
          
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#34495e' }}>Predicted Growth Trajectory</h4>
            <div style={{ width: '100%', aspectRatio: '1/1', position: 'relative', border: '1px solid #bdc3c7', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#ecf0f1' }}>
              {base64Images.sat ? (
                  <>
                    {/* The base satellite layer */}
                    <img src={base64Images.sat} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} alt="Satellite Base" />
                    
                    {/* The red prediction mask layer */}
                    {base64Images.heat && (
                      <img src={base64Images.heat} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} alt="Prediction Heatmap" />
                    )}
                  </>
              ) : (
                  <div style={{color: '#7f8c8d', padding: '50px 0'}}>Loading Overlay...</div>
              )}
            </div>
          </div>

        </div>
        
        {/* FOOTER */}
        <div style={{ marginTop: '40px', textAlign: 'center', fontSize: '12px', color: '#95a5a6', borderTop: '1px solid #ecf0f1', paddingTop: '10px' }}>
          *This report was compiled using Earth Engine historical metrics and AI spatial analysis powered by {usedModel}.
        </div>
      </div>

    </div>
  );
};

export default ChangeAnalysis;