import earthVideo from "../assets/earth-rotating.mp4";
import "./login.css";
import { useState } from "react";
import { Link } from "react-router-dom";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
  };

  return (
    <div className="auth-wrapper">

      {/* Background video */}
      <video autoPlay muted loop className="bg-video">
        <source src={earthVideo} type="video/mp4" />
      </video>

      {/* Login card */}
      <div className="auth-card">
        <div className="auth-title">Login</div>

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

          <button type="submit">Log in</button>
        </form>

        <div className="auth-footer">
          Don’t have an account? <Link to="/signup">Sign up</Link>
        </div>
      </div>

    </div>
  );
};

export default Login;
