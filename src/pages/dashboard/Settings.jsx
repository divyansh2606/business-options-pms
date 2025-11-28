import React, { useState } from 'react';

export default function Settings() {
  const [activeSection, setActiveSection] = useState('general');
  
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold mb-6">Settings</h3>
        
        <div className="flex flex-col md:flex-row">
          {/* Settings Sidebar */}
          <div className="w-full md:w-64 mb-6 md:mb-0">
            <nav className="space-y-1">
              <button
                onClick={() => setActiveSection('general')}
                className={`w-full text-left px-4 py-2 rounded-lg ${
                  activeSection === 'general' ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'
                }`}
              >
                General
              </button>
              <button
                onClick={() => setActiveSection('users')}
                className={`w-full text-left px-4 py-2 rounded-lg ${
                  activeSection === 'users' ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'
                }`}
              >
                User Management
              </button>
              <button
                onClick={() => setActiveSection('notifications')}
                className={`w-full text-left px-4 py-2 rounded-lg ${
                  activeSection === 'notifications' ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'
                }`}
              >
                Notifications
              </button>
              <button
                onClick={() => setActiveSection('backup')}
                className={`w-full text-left px-4 py-2 rounded-lg ${
                  activeSection === 'backup' ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'
                }`}
              >
                Backup & Restore
              </button>
            </nav>
          </div>
          
          {/* Settings Content */}
          <div className="flex-1 md:ml-8">
            {activeSection === 'general' && (
              <div className="space-y-6">
                <h4 className="font-semibold text-lg">General Settings</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Restaurant Name</label>
                    <input type="text" defaultValue="PMS Restaurant" className="w-full border rounded-lg px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <textarea className="w-full border rounded-lg px-3 py-2" rows="3"></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <input type="tel" defaultValue="+1234567890" className="w-full border rounded-lg px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" defaultValue="info@pmsrestaurant.com" className="w-full border rounded-lg px-3 py-2" />
                  </div>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Save Changes
                  </button>
                </div>
              </div>
            )}
            
            {activeSection === 'users' && (
              <div className="space-y-6">
                <h4 className="font-semibold text-lg">User Management</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-4">Manage user accounts and permissions</p>
                  <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    Add New User
                  </button>
                </div>
              </div>
            )}
            
            {activeSection === 'notifications' && (
              <div className="space-y-6">
                <h4 className="font-semibold text-lg">Notification Settings</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Low Stock Alerts</p>
                      <p className="text-sm text-gray-600">Get notified when items are running low</p>
                    </div>
                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600">
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6"></span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">New Order Notifications</p>
                      <p className="text-sm text-gray-600">Get notified when new orders are placed</p>
                    </div>
                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600">
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6"></span>
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {activeSection === 'backup' && (
              <div className="space-y-6">
                <h4 className="font-semibold text-lg">Backup & Restore</h4>
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-4">Last backup: November 24, 2023 at 10:30 PM</p>
                    <div className="flex space-x-3">
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Backup Now
                      </button>
                      <button className="px-4 py-2 border border-gray-300 rounded-lg">
                        Restore from Backup
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}