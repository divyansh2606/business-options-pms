import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/auth/LoginPage";
import Dashboard from "./pages/dashboard/Dashboard";

function App() {
  return (
    <div className="min-h-screen">
      <Routes>
        {/* Default: root pe aaye to LOGIN pe bhejo */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Auth pages */}
        <Route path="/login" element={<LoginPage />} />   
        
        {/* Dashboard route */}
        <Route path="/dashboard" element={<Dashboard />} />
 
        {/* Agar galat URL ho to bhi LOGIN pe hi bhej dena */}   
        <Route path="*" element={<Navigate to="/login" replace />} />   
      </Routes>    
    </div>        
  );           
}   
export default App;