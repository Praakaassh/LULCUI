import { Routes, Route } from "react-router-dom";
import Login from "./login/login";
import Signup from "./signup/signup";
import Landing from "./landing/landing";
import Home from "./Home/home";
import LULCVIEW from "./Pages/LULCVIEW/LULCView"; // Adjust path if needed

// ✅ IMPORT YOUR NEW FILE
import Development from "./Pages/ChangeDetection/development/development";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/home" element={<Home />} />
      <Route path="/lulc-view" element={<LULCVIEW />} />
      
      {/* ✅ ADD THE ROUTE */}
      <Route path="/development" element={<Development />} />
    </Routes>

  );
}

export default App;