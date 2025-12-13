import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/auth/LoginPage";
import Dashboard from "./pages/dashboard/Dashboard";
import OrderStockPage from "./pages/OrderStockPage";
import ReceivedStockPage from "./pages/ReceivedStockPage";
import PendingStockPage from "./pages/PendingStockPage";

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

        {/* Standalone Order Stock page */}
        <Route path="/order-stock" element={<OrderStockPage />} />

        {/* Standalone Received Stock page */}
        <Route path="/received-stock" element={<ReceivedStockPage />} />

        {/* Standalone Pending Stock page */}
        <Route path="/pending-stock" element={<PendingStockPage />} />

        {/* Agar galat URL ho to bhi LOGIN pe hi bhej dena */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
  );
}

export default App;
