import React from 'react';
import { Link } from "react-router-dom";
import { 
  Globe, Satellite, ShieldAlert, BarChart3, 
  Thermometer, Box, Facebook, Twitter, Linkedin 
} from 'lucide-react';
import './landing.css'; 
import backgroundVideo from '../assets/earth-rotating.mp4';

const Landing = () => {
  return (
    <div className="lp-main-container">
      <header className="lp-navbar">
        <div className="lp-logo">
          <Globe size={24} /> 
          <span>LULC Analytics</span>
        </div>
        <nav className="lp-nav-links">
          <Link to="/">Home</Link>
          <Link to="/features">Features</Link>
          <Link to="/about">About Us</Link>
          <Link to="/pricing">Pricing</Link>
        </nav>
        <Link to="/login" className="lp-get-started">Login</Link>
      </header>

      <section className="lp-hero">
        <video autoPlay loop muted playsInline className="lp-video-bg">
          <source src={backgroundVideo} type="video/mp4" />
        </video>
        <div className="lp-hero-overlay"></div>
        <div className="lp-hero-content">
          <h1>Transforming Earth Observation into Actionable Insights</h1>
          <p>Leverage Satellite Data for Smarter Land Use Decisions</p>
        </div>
      </section>

      <div className="lp-features-section">
        <div className="lp-grid">
          {/* Row 1 */}
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

          {/* Row 2 */}
          <div className="lp-card border-blue">
            <BarChart3 color="#3b82f6" size={32} />
            <div className="lp-card-text">
              <h3>AVG DEVELOPMENT GROWTH</h3>
              <p>Trend Analysis</p>
            </div>
          </div>
          <div className="lp-card border-purple">
            <Thermometer color="#a855f7" size={32} />
            <div className="lp-card-text">
              <h3>HEATMAP PREDICTION</h3>
              <p>Future Scenario Modeling</p>
            </div>
          </div>
          <div className="lp-card border-cyan">
            <Globe color="#06b6d4" size={32} />
            <div className="lp-card-text">
              <h3>DYNAMIC WORLD COVER V1</h3>
              <p>Global Land Cover Data</p>
            </div>
          </div>
        </div>
      </div>

      <footer className="lp-footer">
        <div className="lp-footer-left">
          <Globe size={18} />
          <span>Powered By Dynamic World & Sentinel-2 Satellite Imagery</span>
        </div>
        <div className="lp-social-icons">
          <Facebook size={20} />
          <Twitter size={20} />
          <Linkedin size={20} />
        </div>
      </footer>
    </div>
  );
};

export default Landing;