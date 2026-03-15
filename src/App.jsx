import { Routes, Route } from "react-router-dom";
import Login from "./login/login";
import Signup from "./signup/signup";
import Landing from "./landing/landing";
import Home from "./Home/home";
import LULCVIEW from "./Pages/LULCVIEW/LULCView"; 

// ✅ Existing New Pages
import Prediction from "./Pages/AIPrediction/prediction.jsx";
import ChangeAnalysis from "./Pages/ChangeDetection/ChangeAnalysis.jsx"; 

// 📁 New Saved Reports Archive Page
import SavedReports from "./Pages/savedReports.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/home" element={<Home />} />
      <Route path="/lulc-view" element={<LULCVIEW />} />
      
      <Route path="/prediction" element={<Prediction />} />
      <Route path="/change-analysis" element={<ChangeAnalysis />} />

      {/* ✅ Add this new route */}
      <Route path="/saved-reports" element={<SavedReports />} />
    </Routes>
  );
}

export default App;