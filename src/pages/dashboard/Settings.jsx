import React, { useState, useEffect } from 'react';
import { getEmployees, addUser, updateUser, deleteUser, toggleUserStatus } from '../../services/userService';

export default function Settings() {
  const [activeSection, setActiveSection] = useState('general');
  const [employees, setEmployees] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ name: '', mobile: '', password: '' });
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  // Load employees on component mount and when activeSection changes
  useEffect(() => {
    if (activeSection === 'users') {
      loadEmployees();
    }
  }, [activeSection]);

  const loadEmployees = async () => {
    try {
      const empList = await getEmployees();
      setEmployees(empList);
    } catch (error) {
      console.error('Error loading employees:', error);
      showNotification('error', 'Failed to load employees');
    }
  };

  const showNotification = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => setNotification({ show: false, type: '', message: '' }), 3000);
  };

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({ name: user.name, mobile: user.mobile, password: '' });
    } else {
      setEditingUser(null);
      setFormData({ name: '', mobile: '', password: '' });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({ name: '', mobile: '', password: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.mobile || (!editingUser && !formData.password)) {
      showNotification('error', 'Please fill all required fields');
      return;
    }

    try {
      let result;
      if (editingUser) {
        result = await updateUser(editingUser.id, formData);
      } else {
        result = await addUser(formData);
      }

      if (result.success) {
        showNotification('success', result.message);
        await loadEmployees();
        handleCloseModal();
      } else {
        showNotification('error', result.message);
      }
    } catch (error) {
      console.error('Error saving user:', error);
      showNotification('error', 'Network error. Could not save user.');
    }
  };

  const handleDelete = async (userId) => {
    if (window.confirm('Are you sure you want to delete this employee?')) {
      try {
        const result = await deleteUser(userId);
        if (result.success) {
          showNotification('success', result.message);
          await loadEmployees();
        } else {
          showNotification('error', result.message);
        }
      } catch (error) {
        console.error('Error deleting user:', error);
        showNotification('error', 'Network error. Could not delete user.');
      }
    }
  };

  const handleToggleStatus = async (userId) => {
    try {
      const result = await toggleUserStatus(userId);
      if (result.success) {
        showNotification('success', result.message);
        await loadEmployees();
      } else {
        showNotification('error', result.message);
      }
    } catch (error) {
      console.error('Error toggling user status:', error);
      showNotification('error', 'Network error. Could not update user status.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification.show && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}>
          {notification.message}
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold mb-6">Settings</h3>

        <div className="flex flex-col md:flex-row">
          {/* Settings Sidebar */}
          <div className="w-full md:w-64 mb-6 md:mb-0">
            <nav className="space-y-1">
              <button
                onClick={() => setActiveSection('general')}
                className={`w-full text-left px-4 py-2 rounded-lg ${activeSection === 'general' ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'
                  }`}
              >
                General
              </button>
              <button
                onClick={() => setActiveSection('users')}
                className={`w-full text-left px-4 py-2 rounded-lg ${activeSection === 'users' ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'
                  }`}
              >
                User Management
              </button>
              <button
                onClick={() => setActiveSection('notifications')}
                className={`w-full text-left px-4 py-2 rounded-lg ${activeSection === 'notifications' ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'
                  }`}
              >
                Notifications
              </button>
              <button
                onClick={() => setActiveSection('backup')}
                className={`w-full text-left px-4 py-2 rounded-lg ${activeSection === 'backup' ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'
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
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-lg">User Management</h4>
                  <button
                    onClick={() => handleOpenModal()}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Add New Employee
                  </button>
                </div>

                {/* Employees Table */}
                <div className="bg-gray-50 rounded-lg overflow-hidden">
                  {employees.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <p className="font-medium">No employees added yet</p>
                      <p className="text-sm">Click "Add New Employee" to create employee credentials</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Name</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Mobile</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Created</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {employees.map((emp) => (
                          <tr key={emp.id} className="hover:bg-gray-100">
                            <td className="px-4 py-3">
                              <div className="flex items-center">
                                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold mr-3">
                                  {emp.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium">{emp.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{emp.mobile}</td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleToggleStatus(emp.id)}
                                className={`px-2 py-1 rounded-full text-xs font-medium ${emp.status === 'active'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                  }`}
                              >
                                {emp.status === 'active' ? 'Active' : 'Inactive'}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-sm">
                              {new Date(emp.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-center space-x-2">
                                <button
                                  onClick={() => handleOpenModal(emp)}
                                  className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                                  title="Edit"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDelete(emp.id)}
                                  className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
                                  title="Delete"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
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

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-lg font-semibold">
                {editingUser ? 'Edit Employee' : 'Add New Employee'}
              </h4>
              <button
                onClick={handleCloseModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter employee name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter mobile number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {!editingUser && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={editingUser ? "Leave blank to keep existing" : "Enter password"}
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingUser ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}