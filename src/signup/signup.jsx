import "./signup.css";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../Supabase/supabaseClient";

// 1. Import the video file
import earthVideo from "../assets/earth-rotating-web.mp4.mp4"; // Ensure this matches your file name exactly

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
      });

      if (error) throw error;
      
      // Fix: Check if session exists for immediate login if email confirm is off
      if (data.session) {
         navigate("/home");
      } else {
         alert("Success! Check your email for the confirmation link.");
      }

    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      
      {/* 2. Add the Video Background */}
      <div className="video-background">
        <video autoPlay loop muted playsInline>
          <source src={earthVideo} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        {/* Optional: Overlay to darken video slightly for better text readability */}
        <div className="video-overlay"></div>
      </div>

      {/* 3. The Signup Form (remains mostly the same, just sits on top now) */}
      <div className="signup-card">
        <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#333' }}>Create Account</h2>
        
        <form onSubmit={handleSignup}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Create password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Signing up..." : "Sign up"}
          </button>
        </form>

        <div style={{ marginTop: '15px', textAlign: 'center', fontSize: '0.9rem' }}>
          Already have an account? <Link to="/login" style={{ color: '#2a5298', fontWeight: 'bold' }}>Login</Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;