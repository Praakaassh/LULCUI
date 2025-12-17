import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./home/home";
import Login from "./login/login";
import Signup from "./signup/signup";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* DEFAULT PAGE */}
        <Route path="/" element={<Home />} />

        {/* AUTH PAGES */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
