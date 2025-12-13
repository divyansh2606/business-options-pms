// src/components/dashboard/StockManagement.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function StockManagement({ user }) {
  const navigate = useNavigate();

  if (user?.role !== 'employee') {
    return (
      <div className="bg-white p-8 rounded-xl shadow-lg text-center">
        <div className="text-gray-400 mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-16 w-16 mx-auto"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-700">Stock Management</h3>
        <p className="text-gray-500 mt-2">Stock management features coming soon</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Order Stock Card */}
        <div
          className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-6 rounded-2xl shadow-xl text-white relative overflow-hidden group cursor-pointer hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-10 rounded-full -ml-12 -mb-12"></div>

          <div className="relative mb-5">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-white/30 to-transparent flex items-center justify-center backdrop-blur-sm border border-white/20 shadow-lg">
              <span className="text-5xl animate-bounce">🛒</span>
            </div>
            <div className="absolute inset-0 w-20 h-20 rounded-full bg-white/20 blur-xl"></div>
          </div>
          <h3 className="text-2xl font-bold mb-2">Order Stock</h3>
          <p className="text-white text-opacity-80 text-sm mb-6">
            Request items you need for the kitchen
          </p>
          <button
            onClick={() => navigate('/order-stock', { state: { user } })}
            className="w-full px-4 py-3 bg-white text-indigo-600 font-semibold rounded-xl hover:bg-opacity-90 transition-all duration-200 shadow-lg flex items-center justify-center space-x-2"
          >
            <span>Place Order</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Enter Received Stock Card – abhi sirf route placeholder */}
        <div
          className="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 p-6 rounded-2xl shadow-xl text-white relative overflow-hidden group cursor-pointer hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-10 rounded-full -ml-12 -mb-12"></div>
          <div className="relative mb-5">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-white/30 to-transparent flex items-center justify-center backdrop-blur-sm border border-white/20 shadow-lg">
              <span className="text-5xl animate-pulse">📦</span>
            </div>
            <div className="absolute inset-0 w-20 h-20 rounded-full bg-white/20 blur-xl"></div>
          </div>
          <h3 className="text-2xl font-bold mb-2">Enter Received Stock</h3>
          <p className="text-white text-opacity-80 text-sm mb-6">
            Record items received from suppliers
          </p>
          <button
            onClick={() => navigate('/received-stock', { state: { user } })} // future page ke liye
            className="w-full px-4 py-3 bg-white text-emerald-600 font-semibold rounded-xl hover:bg-opacity-90 transition-all duration-200 shadow-lg flex items-center justify-center space-x-2"
          >
            <span>Enter Stock</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Pending Stock Card */}
        <div
          className="bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 p-6 rounded-2xl shadow-xl text-white relative overflow-hidden group cursor-pointer hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-10 rounded-full -ml-12 -mb-12"></div>
          <div className="relative mb-5">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-white/30 to-transparent flex items-center justify-center backdrop-blur-sm border border-white/20 shadow-lg">
              <span className="text-5xl animate-pulse">⏳</span>
            </div>
            <div className="absolute inset-0 w-20 h-20 rounded-full bg-white/20 blur-xl"></div>
          </div>
          <h3 className="text-2xl font-bold mb-2">Pending Stock</h3>
          <p className="text-white text-opacity-80 text-sm mb-6">
            View orders waiting to be delivered
          </p>
          <button
            onClick={() => navigate('/pending-stock', { state: { user } })}
            className="w-full px-4 py-3 bg-white text-amber-600 font-semibold rounded-xl hover:bg-opacity-90 transition-all duration-200 shadow-lg flex items-center justify-center space-x-2"
          >
            <span>View Pending</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
