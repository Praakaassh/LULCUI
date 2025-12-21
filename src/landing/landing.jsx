import React from 'react';
import { Link } from "react-router-dom";
// Import the separate CSS file
import './landing.css';

// Import icons from lucide-react
import {
  Globe,
  Leaf,
  Map as MapIcon,
  Settings,
  Cloud,
  Database,
  Satellite,
  Facebook,
  Twitter,
  Instagram,
  Plane, // Using Plane as proxy for drone icon
} from 'lucide-react';

// Placeholder Image URLs (Replace with your actual assets)
const HERO_IMAGE_URL = "https://images.unsplash.com/photo-1477346611705-65d1883cee1e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3";
const NEWS_IMG_1 = "https://placehold.co/400x250/e2e8f0/1e293b?text=Precision+Data";
const NEWS_IMG_2 = "https://placehold.co/400x250/22c55e/ffffff?text=Mapping+Initiative";
const NEWS_IMG_3 = "https://placehold.co/400x250/3b82f6/ffffff?text=Project+Team";


const Landing = () => {
  return (
    <div className="landing-page">
      
      {/* --- HEADER --- */}
      <header className="lp-header">
        <div className="lp-header__container">
          <div className="lp-logo">
            <Globe className="lp-logo__icon" size={32} />
            <span className="lp-logo__text">LULC Project</span>
          </div>

          <nav className="lp-nav">
            <ul className="lp-nav__list">
              <li><a href="#features">Features</a></li>
              <li><a href="#technology">Technology</a></li>
              <li><a href="#news">News</a></li>
            </ul>
          </nav>

          <div className="lp-header__actions">
            {/* ROUTE: Login */}
            <Link to="/login" className="lp-btn lp-btn--login">
              LOGIN
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* --- HERO SECTION --- */}
        <section className="lp-hero">
          <div 
            className="lp-hero__background" 
            style={{ backgroundImage: `url(${HERO_IMAGE_URL})` }}
          >
             <div className="lp-hero__overlay"></div>
          </div>

          <div className="lp-hero__content">
            <h1>
              UNDERSTANDING EARTH'S SURFACE,<br />
              EMPOWERING SUSTAINABILITY
            </h1>
            <h2>
              PRECISION LAND USE/LAND COVER MAPPING & ANALYSIS
            </h2>
            <div className="lp-hero__buttons">
               {/* ROUTE: Get Started / Upload */}
              <Link to="/upload" className="lp-btn lp-btn--primary">
                EXPLORE DATA
              </Link>
               {/* ROUTE: Learn More / About */}
              <Link to="/about" className="lp-btn lp-btn--white">
                LEARN MORE
              </Link>
            </div>
          </div>
        </section>

        {/* --- FEATURES SECTION (Overlapping) --- */}
        <section id="features" className="lp-features">
          <div className="lp-container lp-features__grid">
            {/* Feature Card 1 */}
            <div className="lp-feature-card">
              <div className="lp-feature-card__icon-wrapper">
                <Leaf size={32} strokeWidth={1.5} />
              </div>
              <h3>ECOLOGICAL<br/>INSIGHTS</h3>
            </div>
             {/* Feature Card 2 */}
            <div className="lp-feature-card">
              <div className="lp-feature-card__icon-wrapper">
                <MapIcon size={32} strokeWidth={1.5} />
              </div>
              <h3>SPATIAL<br/>ANALYTICS</h3>
            </div>
             {/* Feature Card 3 */}
            <div className="lp-feature-card">
              <div className="lp-feature-card__icon-wrapper">
                <Settings size={32} strokeWidth={1.5} />
              </div>
              <h3>PLANNING &<br/>DEVELOPMENT</h3>
            </div>
          </div>
        </section>

        {/* --- TECHNOLOGY SECTION --- */}
        <section id="technology" className="lp-technology">
          <div className="lp-container">
            <h2 className="lp-section-title">OUR TECHNOLOGY</h2>
            
            <div className="lp-tech-flow">
              {/* Item 1 */}
              <div className="lp-tech-item">
                  <Plane size={48} strokeWidth={1} className="lp-tech-icon" />
                  <p>AI DRIVEN<br/>CLOUD PLATFORM</p>
              </div>

              {/* Connector */}
              <div className="lp-tech-connector"></div>

              {/* Item 2 */}
              <div className="lp-tech-item">
                   <Satellite size={64} strokeWidth={1} className="lp-tech-icon lp-tech-icon--blue" />
              </div>

              {/* Connector */}
              <div className="lp-tech-connector"></div>
              
              {/* Item 3 */}
              <div className="lp-tech-item">
                  <div className="lp-tech-multi-icon">
                      <Database size={40} strokeWidth={1}/>
                      <Cloud size={40} strokeWidth={1}/>
                  </div>
                <p>REMOTE<br/>SENSING</p>
              </div>
            </div>
          </div>
        </section>

        {/* --- NEWS SECTION --- */}
        <section id="news" className="lp-news">
          <div className="lp-container">
            <h2 className="lp-section-title">RECENT NEWS</h2>
            <div className="lp-news__grid">
              {/* News Item 1 */}
              <div className="lp-news-card">
                <img src={NEWS_IMG_1} alt="News 1" />
                <div className="lp-news-card__content">
                  <h3>Precision Land Cover Data Released</h3>
                  <p>Read more about our latest developments.</p>
                </div>
              </div>
              {/* News Item 2 */}
              <div className="lp-news-card">
                <img src={NEWS_IMG_2} alt="News 2" />
                <div className="lp-news-card__content">
                  <h3>New Global Mapping Initiative</h3>
                  <p>Read more about our latest developments.</p>
                </div>
              </div>
              {/* News Item 3 */}
              <div className="lp-news-card">
                <img src={NEWS_IMG_3} alt="News 3" />
                <div className="lp-news-card__content">
                  <h3>Meet the New Project Team</h3>
                  <p>Read more about our latest developments.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* --- FOOTER --- */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer__container">
          <div className="lp-logo lp-footer__logo">
            <Globe className="lp-logo__icon" size={24} />
            <span className="lp-logo__text">LULC Project</span>
          </div>
          
          <div className="lp-footer__social">
            <a href="#!"><Facebook size={20} /></a>
            <a href="#!"><Twitter size={20} /></a>
            <a href="#!"><Instagram size={20} /></a>
          </div>

          <div className="lp-footer__contact">
              <a href="#contact">Contact Us</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;