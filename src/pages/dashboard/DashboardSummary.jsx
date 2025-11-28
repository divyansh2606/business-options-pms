import React from 'react';

export default function DashboardSummary({ data }) {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Event Type</p>
              <p className="text-2xl font-bold text-gray-800">{data.dashboard?.eventType || "N/A"}</p>
            </div>
            <div className="text-3xl">🍽️</div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Planned</p>
              <p className="text-2xl font-bold text-gray-800">{data.dashboard?.totalPlanned || "N/A"}</p>
            </div>
            <div className="text-3xl">📋</div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Actual</p>
              <p className="text-2xl font-bold text-gray-800">{data.dashboard?.totalActual || "N/A"}</p>
            </div>
            <div className="text-3xl">✅</div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Person Count</p>
              <p className="text-2xl font-bold text-gray-800">{data.dashboard?.personCount || "N/A"}</p>
            </div>
            <div className="text-3xl">👥</div>
          </div>
        </div>
      </div>

      {/* PMS Data Table */}
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold mb-4">PMS Data</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="pb-3 text-gray-600">Item Name</th>
                <th className="pb-3 text-gray-600">Planned</th>
                <th className="pb-3 text-gray-600">Unit</th>
                <th className="pb-3 text-gray-600">Actual</th>
                <th className="pb-3 text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.pms && data.pms.slice(7).map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b">
                  <td className="py-3">{row[0] || ""}</td>
                  <td className="py-3">{row[1] || ""}</td>
                  <td className="py-3">{row[2] || ""}</td>
                  <td className="py-3">{row[3] || ""}</td>
                  <td className="py-3">
                    {row[3] ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                        Completed
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                        Pending
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recipe Data Table */}
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Recipe Data ({data.dashboard?.totalRecipes || 0} items)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                {data.recipe && data.recipe[0] && data.recipe[0].map((header, index) => (
                  <th key={index} className="pb-3 text-gray-600 text-sm">{header || ""}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.recipe && data.recipe.slice(1).map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="py-3 text-sm">{cell || ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}