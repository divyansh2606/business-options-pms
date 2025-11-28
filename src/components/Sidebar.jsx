import React from 'react';

export default function Sidebar({ user, activeTab, setActiveTab, onLogout }) {
  // Menu items array
  const menuItems = [
    { id: "dashboard", label: "Dashboard Summary", icon: "📊" },
    { id: "stock", label: "Stock/Inventory", icon: "📦" },
    { id: "orders", label: "Orders", icon: "🛒" },
    { id: "employees", label: "Employees", icon: "👥" },
    { id: "menu", label: "Menu Items", icon: "🍽️" },
    { id: "financial", label: "Financial Data", icon: "💰" },
  ];

  // Add Settings tab only for CEO
  if (user?.role === 'ceo') {
    menuItems.push({ id: "settings", label: "Settings", icon: "⚙️" });
  }

  return (
    <div className="w-64 bg-gradient-to-b from-indigo-900 to-purple-900 text-white p-6 flex flex-col h-full">
      {/* Logo/Brand Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">PMS</h1>
        <p className="text-sm text-white opacity-75">Restaurant Management</p>
      </div>

      {/* User Info Section */}
      <div className="mb-8 p-4 bg-white bg-opacity-10 rounded-lg">
        <p className="font-semibold text-white">{user?.name || "User"}</p>
        <p className="text-sm text-white opacity-75">
          {user?.role === 'ceo' ? 'CEO' : 'Employee'}
        </p>
      </div>

      {/* Navigation Menu Section */}
      <nav className="flex-1 mb-8">
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-3 opacity-75">
          Main Menu
        </h3>
        <div className="space-y-2">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center ${
                activeTab === item.id 
                  ? 'bg-indigo-800 shadow-lg border-l-4 border-cyan-400' 
                  : 'hover:bg-indigo-800 hover:bg-opacity-50'
              }`}
            >
              <span className="mr-3 text-lg text-white">{item.icon}</span>
              <span className="flex-1 text-white font-medium">{item.label}</span>
              {activeTab === item.id && (
                <span className="w-2 h-2 bg-cyan-400 rounded-full"></span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Logout Section */}
      <div className="mt-auto">
        <button
          onClick={onLogout}
          className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center justify-center group"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5 mr-2 text-white group-hover:text-red-200" 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path 
              fillRule="evenodd" 
              d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-2.293 2.293a1 1 0 101.414 1.414l3-3z" 
              clipRule="evenodd" 
            />
          </svg>
          <span className="text-white font-medium group-hover:text-red-200">Logout</span>
        </button>
      </div>
    </div>
  );
}