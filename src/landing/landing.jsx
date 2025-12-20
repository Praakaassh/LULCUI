import "./landing.css";
import { Link } from "react-router-dom";

const Landing = () => {
  return (
    <div className="Landing">
      {/* NAVBAR */}
      <nav className="navbar">
        <div className="nav-left">
          <h2 className="logo">Dribbble</h2>

          <ul className="nav-menu">
            <li>Explore</li>
            <li>Hire Talent</li>
            <li>Get Hired</li>
            <li>Community</li>
          </ul>
        </div>

        <div className="nav-right">
          <Link to="/signup" className="signup-link">
            Sign up
          </Link>

          <Link to="/login" className="login-pill">
            Log in
          </Link>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="hero">
        <div className="hero-left">
          <h1>
            Discover the <br /> World’s Top Designers
          </h1>

          <p>
            Explore work from the most talented and accomplished designers
            ready to take on your next project.
          </p>

          <div className="hero-tabs">
            <button className="active">Shots</button>
            <button>Designers</button>
            <button>Services</button>
          </div>

          <div className="search-box">
            <input
              type="text"
              placeholder="What type of design are you interested in?"
            />
            <button>🔍</button>
          </div>

          <div className="tags">
            <span>dashboard</span>
            <span>landing page</span>
            <span>e-commerce</span>
            <span>logo</span>
            <span>icons</span>
          </div>
        </div>

        <div className="hero-right">
          <div className="mockup">
            <h2>Solving AI’s Last Mile</h2>
            <p>Landing page preview</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
