import "./login.css";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

// FIX: Go up one level (..) then into Supabase folder
import { supabase } from "../Supabase/supabaseClient"; 

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const navigate = useNavigate();

  // Handle Email & Password Login
// Handle Email & Password Login
const handleLogin = async (e) => {
  e.preventDefault();
  setLoading(true);
  setErrorMsg("");

  console.log("1. Attempting login with:", email); // Debug step 1

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    console.log("2. Supabase Response:", { data, error }); // Debug step 2

    if (error) {
      console.error("3. Login Failed:", error.message); // Debug step 3
      setErrorMsg(error.message); // This should show the text on screen
    } else {
      console.log("3. Login Success! Navigating to home...");
      navigate("/home");
    }
  } catch (err) {
    console.error("UNEXPECTED ERROR:", err);
  } finally {
    setLoading(false);
  }
};
  // Handle Google Login
  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Redirects to this URL after Google auth completes
        redirectTo: window.location.origin + "/home", 
      },
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-title">Login</div>

        {errorMsg && <div className="error-message">{errorMsg}</div>}

        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <div className="divider">OR</div>

        {/* Google Login Button */}
        <button 
          type="button" 
          className="google-btn" 
          onClick={handleGoogleLogin} 
          disabled={loading}
        >
          Sign in with Google
        </button>

        <div className="auth-footer">
          Don’t have an account? <Link to="/signup">Sign up</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;