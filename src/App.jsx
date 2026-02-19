import { Routes, Route } from "react-router-dom";
import Login from "./login/login";
import Signup from "./signup/signup";
import Landing from "./landing/landing";
import Home from "./Home/home";
import LULCVIEW from "./Pages/LULCVIEW/LULCView"; 

// ✅ New Combined Analysis & Prediction Pages
import Prediction from "./Pages/AIPrediction/prediction.jsx";
import ChangeAnalysis from "./Pages/ChangeDetection/ChangeAnalysis.jsx"; 

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/home" element={<Home />} />
      <Route path="/lulc-view" element={<LULCVIEW />} />
      
      {/* Our New Routes */}
      <Route path="/prediction" element={<Prediction />} />
      <Route path="/change-analysis" element={<ChangeAnalysis />} />
    </Routes>
  );
}

export default App;