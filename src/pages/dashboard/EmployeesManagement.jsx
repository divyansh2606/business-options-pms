import React, { useState } from 'react';

export default function EmployeesManagement({ data }) {
  const [showAddModal, setShowAddModal] = useState(false);
  
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Employees Management</h3>
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Add New Employee
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Employee Cards */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center mb-3">
              <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                JD
              </div>
              <div>
                <h4 className="font-semibold">John Doe</h4>
                <p className="text-sm text-gray-600">Head Chef</p>
              </div>
            </div>
            <div className="text-sm text-gray-600 mb-3">
              <p>📞 +1234567890</p>
              <p>📧 john@example.com</p>
              <p>📅 Joined: Jan 15, 2023</p>
            </div>
            <div className="flex space-x-2">
              <button className="flex-1 px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                View Schedule
              </button>
              <button className="flex-1 px-3 py-1 bg-green-100 text-green-800 rounded text-sm">
                Performance
              </button>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center mb-3">
              <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                JS
              </div>
              <div>
                <h4 className="font-semibold">Jane Smith</h4>
                <p className="text-sm text-gray-600">Manager</p>
              </div>
            </div>
            <div className="text-sm text-gray-600 mb-3">
              <p>📞 +1234567891</p>
              <p>📧 jane@example.com</p>
              <p>📅 Joined: Feb 20, 2023</p>
            </div>
            <div className="flex space-x-2">
              <button className="flex-1 px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                View Schedule
              </button>
              <button className="flex-1 px-3 py-1 bg-green-100 text-green-800 rounded text-sm">
                Performance
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add New Employee</h2>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                <select className="w-full border rounded-lg px-3 py-2">
                  <option>Head Chef</option>
                  <option>Chef</option>
                  <option>Manager</option>
                  <option>Waiter</option>
                  <option>Receptionist</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                <input type="tel" className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div className="flex space-x-3">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg"
                >
                  Add Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}