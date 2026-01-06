import { Routes, Route } from "react-router-dom";
import Login from "./login/login";
import Signup from "./signup/signup";
import Landing from "./landing/landing";
import Home from "./Home/home";
import LULCVIEW from "./Pages/LULCVIEW/LULCVIEW";



function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/home" element={<Home />} />
      <Route path="/lulc-view" element={<LULCVIEW />} />

    </Routes>
  );
}

export default App;
