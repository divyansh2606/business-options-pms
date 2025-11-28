import React, { useState } from 'react';

export default function FinancialData({ data }) {
  const [dateRange, setDateRange] = useState('month');
  
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Financial Data</h3>
          <div className="flex space-x-3">
            <select 
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Generate Report
            </button>
          </div>
        </div>
        
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="text-sm text-green-600 font-medium mb-1">Total Revenue</h4>
            <p className="text-2xl font-bold text-green-800">$45,678.90</p>
            <p className="text-sm text-green-600">+12% from last month</p>
          </div>
          
          <div className="bg-red-50 p-4 rounded-lg">
            <h4 className="text-sm text-red-600 font-medium mb-1">Total Expenses</h4>
            <p className="text-2xl font-bold text-red-800">$32,456.30</p>
            <p className="text-sm text-red-600">+5% from last month</p>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="text-sm text-blue-600 font-medium mb-1">Net Profit</h4>
            <p className="text-2xl font-bold text-blue-800">$13,222.60</p>
            <p className="text-sm text-blue-600">+28% from last month</p>
          </div>
        </div>
        
        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-4">Revenue vs Expenses</h4>
            <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
              <p className="text-gray-500">Line Chart Here</p>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-4">Expense Breakdown</h4>
            <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
              <p className="text-gray-500">Pie Chart Here</p>
            </div>
          </div>
        </div>
        
        {/* Expense Table */}
        <div className="mt-6">
          <h4 className="font-semibold mb-4">Expense Details</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className="pb-3 text-gray-600">Date</th>
                  <th className="pb-3 text-gray-600">Category</th>
                  <th className="pb-3 text-gray-600">Description</th>
                  <th className="pb-3 text-gray-600">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3">2023-11-25</td>
                  <td className="py-3">Ingredients</td>
                  <td className="py-3">Vegetables and meat</td>
                  <td className="py-3">$1,245.50</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3">2023-11-24</td>
                  <td className="py-3">Utilities</td>
                  <td className="py-3">Electricity bill</td>
                  <td className="py-3">$450.00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}