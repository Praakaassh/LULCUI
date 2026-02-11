import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './landing/landing';
import Login from './login/login';
import Signup from './signup/signup';

function App() {
  return (
    <Router>
      <Routes>
        {/* This makes Landing your home page */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
    </Router>
  );
}

export default App;