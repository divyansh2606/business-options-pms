import React, { useState } from 'react';

export default function OrdersManagement({ data }) {
  const [statusFilter, setStatusFilter] = useState('all');
  
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Orders Management</h3>
          <div className="flex space-x-3">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="delivered">Delivered</option>
            </select>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Add New Order
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="pb-3 text-gray-600">Order ID</th>
                <th className="pb-3 text-gray-600">Customer</th>
                <th className="pb-3 text-gray-600">Items</th>
                <th className="pb-3 text-gray-600">Amount</th>
                <th className="pb-3 text-gray-600">Date</th>
                <th className="pb-3 text-gray-600">Status</th>
                <th className="pb-3 text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-3">#1234</td>
                <td className="py-3">John Doe</td>
                <td className="py-3">Burger, Fries, Coke</td>
                <td className="py-3">$45.99</td>
                <td className="py-3">2023-11-25</td>
                <td className="py-3">
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                    Delivered
                  </span>
                </td>
                <td className="py-3">
                  <button className="text-blue-600 hover:text-blue-800 mr-3">View</button>
                  <button className="text-green-600 hover:text-green-800">Edit</button>
                </td>
              </tr>
              <tr className="border-b">
                <td className="py-3">#1235</td>
                <td className="py-3">Jane Smith</td>
                <td className="py-3">Pizza, Salad</td>
                <td className="py-3">$28.50</td>
                <td className="py-3">2023-11-25</td>
                <td className="py-3">
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                    Preparing
                  </span>
                </td>
                <td className="py-3">
                  <button className="text-blue-600 hover:text-blue-800 mr-3">View</button>
                  <button className="text-green-600 hover:text-green-800">Edit</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}