import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./login/login";
import Signup from "./signup/signup";
import Landing from "./landing/landing";
import Home from "./Home/home";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* DEFAULT PAGE */}
        <Route path="/" element={<Landing />} />

        {/* AUTH PAGES */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/home" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
