import React from 'react';

export default function Sidebar({ user, activeTab, setActiveTab, onLogout }) {
  // Menu items array
  const menuItems = [
    { id: "dashboard", label: "Production Summary", icon: "📊" },
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
    <div className="w-64 bg-gradient-to-b from-indigo-900 to-purple-900 text-white flex flex-col h-screen fixed left-0 top-0 shadow-2xl z-50">
      <div className="flex flex-col h-full overflow-hidden p-6">
        {/* Logo/Brand Section */}
        <div className="mb-8 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-xl font-bold">P</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">PMS</h1>
              <p className="text-xs text-cyan-300">Restaurant Management</p>
            </div>
          </div>
        </div>

        {/* User Info Section */}
        <div className="mb-6 p-4 bg-gradient-to-r from-indigo-800 to-purple-800 rounded-xl border border-indigo-600 shadow-lg flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-indigo-500 rounded-full flex items-center justify-center shadow-md">
              <span className="text-lg">👤</span>
            </div>
            <div>
              <p className="font-semibold text-white">{user?.name || "User"}</p>
              <p className="text-xs text-cyan-300 uppercase tracking-wide">
                {user?.role === 'ceo' ? 'CEO' : 'Employee'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Menu Section */}
        <nav className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-indigo-600 scrollbar-track-indigo-900">
          <h3 className="text-xs font-semibold text-cyan-300 uppercase tracking-wider mb-4 px-2">
            Main Menu
          </h3>
          <div className="space-y-1">
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center group ${
                  activeTab === item.id 
                    ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 shadow-xl transform scale-105' 
                    : 'hover:bg-indigo-800 hover:bg-opacity-70 hover:transform hover:scale-102'
                }`}
              >
                <span className={`mr-3 text-xl transition-transform duration-200 ${
                  activeTab === item.id ? 'scale-110' : 'group-hover:scale-110'
                }`}>{item.icon}</span>
                <span className="flex-1 text-sm font-medium">{item.label}</span>
                {activeTab === item.id && (
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* Logout Section */}
        <div className="mt-6 pt-4 border-t border-indigo-700 flex-shrink-0">
          <button
            onClick={onLogout}
            className="w-full px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 rounded-xl transition-all duration-200 flex items-center justify-center group shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-5 mr-2 transition-transform duration-200 group-hover:translate-x-1" 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path 
                fillRule="evenodd" 
                d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-2.293 2.293z" 
                clipRule="evenodd" 
              />
            </svg>
            <span className="font-semibold">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}