import React from 'react';
import { Link } from "react-router-dom";
import { Globe, Satellite, ShieldAlert, BarChart3, Thermometer, Box } from 'lucide-react';
// This line MUST match your filename exactly
import './landing.css'; 

const Landing = () => {
  // Use a reliable background image URL
  const HERO_IMG = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072";

  return (
    <div className="lp-main-container">
      <header className="lp-navbar">
        <div className="lp-logo">
          <Globe size={24} /> 
          <span>LULC Analytics</span>
        </div>
        <Link to="/login" className="lp-get-started">Get Started</Link>
      </header>

      <section className="lp-hero" style={{ backgroundImage: `url(${HERO_IMG})` }}>
        <div className="lp-hero-overlay"></div>
        <div className="lp-hero-content">
          <h1>Transforming Earth Observation into Actionable Insights</h1>
          <p>Leverage Satellite Data for Smarter Land Use Decisions</p>
        </div>
      </section>

      <div className="lp-features-section">
        <div className="lp-grid">
          <div className="lp-card border-green">
            <Satellite color="#22c55e" size={32} />
            <div className="lp-card-text">
              <h3>GENERATE LULC MAPS</h3>
              <p>Dynamic World & Sentinel-2</p>
            </div>
          </div>
          <div className="lp-card border-red">
            <ShieldAlert color="#ef4444" size={32} />
            <div className="lp-card-text">
              <h3>FIND DEFORESTATION</h3>
              <p>Early Warning & Monitoring</p>
            </div>
          </div>
          <div className="lp-card border-orange">
            <Box color="#f97316" size={32} />
            <div className="lp-card-text">
              <h3>TOTAL URBAN GROWTH</h3>
              <p>Expansion & Change Detection</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;