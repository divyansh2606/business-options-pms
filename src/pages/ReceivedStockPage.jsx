import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchStockOrders, saveReceivedStock } from '../api/stockAPI';

const normalizeOrders = (rows) =>
  rows.map((r) => ({
    orderNo: r[0],
    timestamp: r[1],
    itemCode: r[2],
    itemName: r[3],
    qty: r[4],
    unit: r[5],
    priority: r[6],
    remark: r[7] || '',
    row: r[8] || null, // sheet row number

    // Received Stock Columns (P-S from Google Sheets)
    receivedQty: r[9] || '', // Column P (index 15 in sheet, index 9 in API response)
    weight: r[10] || '',     // Column Q (index 16 in sheet, index 10 in API response)
    receivedUnit: r[11] || '', // Column R (index 17 in sheet, index 11 in API response)
    receivedRemark: r[12] || '' // Column S (index 18 in sheet, index 12 in API response)
  }));

export default function ReceivedStockPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = location.state?.user;
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [receivedData, setReceivedData] = useState({});
  const [savingRows, setSavingRows] = useState(new Set());
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  // Fetch orders on mount
  useEffect(() => {
    const loadOrders = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchStockOrders();
        console.log('📋 Orders loaded:', data);

        if (Array.isArray(data)) {
          const normalized = normalizeOrders(data).filter((o) => {
            // Remove header-like rows
            const isHeaderRow6 = o.row === 6;
            const looksLikeHeader = String(o.orderNo || '').toLowerCase().includes('order')
              && String(o.itemName || '').toLowerCase().includes('item');
            return !(isHeaderRow6 || looksLikeHeader);
          });

          setOrders(normalized);

          // Pre-populate received data state from fetched orders
          const initialData = {};
          normalized.forEach(o => {
            // Initialize with existing data from Google Sheets
            initialData[o.row] = {
              receivedQty: o.receivedQty || '',
              weight: o.weight || '',
              remark: o.receivedRemark || ''
            };
          });
          setReceivedData(initialData);

        } else {
          setOrders([]);
        }
      } catch (err) {
        console.error('❌ Error loading orders:', err);
        setError('Failed to load orders. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    loadOrders();
  }, []);

  const showNotificationMsg = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => setNotification({ show: false, type: '', message: '' }), 3000);
  };

  // Handle received data change
  const handleReceivedChange = (row, field, value) => {
    setReceivedData(prev => ({
      ...prev,
      [row]: {
        ...prev[row],
        [field]: value
      }
    }));
  };

  // Auto-save on blur
  const handleFieldBlur = async (order) => {
    const data = receivedData[order.row];

    // Only save if there's data to save
    if (!data || (!data.receivedQty && !data.weight && !data.remark)) {
      return;
    }

    // Mark as saving
    setSavingRows(prev => new Set(prev).add(order.row));

    try {
      console.log('💾 Auto-saving received data:', { row: order.row, data });

      const payload = {
        row: order.row,
        receivedQty: data.receivedQty || '',
        weight: data.weight || '',
        unit: order.unit || '', // Auto-populated from order
        remark: data.remark || ''
      };

      await saveReceivedStock(payload);
      showNotificationMsg('success', `✓ Saved data for ${order.itemName}`);
    } catch (err) {
      console.error('❌ Error saving received data:', err);
      showNotificationMsg('error', `Failed to save data for ${order.itemName}`);
    } finally {
      setSavingRows(prev => {
        const newSet = new Set(prev);
        newSet.delete(order.row);
        return newSet;
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      {/* Notification */}
      {notification.show && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${notification.type === 'success'
            ? 'bg-green-500 text-white'
            : notification.type === 'info'
              ? 'bg-blue-500 text-white'
              : 'bg-red-500 text-white'
            }`}
        >
          {notification.message}
        </div>
      )}

      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0 text-center sm:text-left">
          <div>
            <button
              onClick={() => navigate('/dashboard?tab=stock', { state: { user } })}
              className="flex items-center justify-center sm:justify-start text-blue-600 hover:text-blue-800 mb-3 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Received Stock Entry</h1>
            <p className="text-gray-600 text-sm sm:text-base">Click on any green column to enter received stock data</p>
          </div>
          <div className="text-4xl mt-4 sm:mt-0">📦</div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading orders...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">⚠️ {error}</p>
          </div>
        )}

        {/* Orders Table */}
        {!loading && orders.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">No orders found. Please place an order first.</p>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    {/* Order Data Columns (A-H) - Blue Headers */}
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 bg-blue-50 border-r border-gray-300 min-w-[120px]">Order No</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 bg-blue-50 border-r border-gray-300 min-w-[150px]">Timestamp</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 bg-blue-50 border-r border-gray-300 min-w-[100px]">Item Code</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 bg-blue-50 border-r border-gray-300 min-w-[200px]">Item Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 bg-blue-50 border-r border-gray-300 min-w-[80px]">Ordered Qty</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 bg-blue-50 border-r border-gray-300 min-w-[70px]">Unit</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 bg-blue-50 border-r border-gray-300 min-w-[100px]">Priority</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 bg-blue-50 border-r-2 border-gray-400 min-w-[120px]">Order Remark</th>

                    {/* Received Data Columns (P-R) - Green Headers */}
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white bg-emerald-600 border-r border-emerald-700 min-w-[120px]">Received Qty</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white bg-emerald-600 border-r border-emerald-700 min-w-[120px]">Weight</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white bg-emerald-600 border-r border-emerald-700 min-w-[80px]">Unit</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white bg-emerald-600 min-w-[150px]">Received Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, idx) => {
                    const data = receivedData[order.row] || {};
                    const isSaving = savingRows.has(order.row);

                    return (
                      <tr key={order.row || idx} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                        {/* Order Data (Read-only) */}
                        <td className="px-4 py-3 text-sm text-gray-700 font-medium border-r border-gray-200">{order.orderNo}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200">
                          {order.timestamp ? new Date(order.timestamp).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200">{order.itemCode}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 font-medium border-r border-gray-200">{order.itemName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200">{order.qty}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200">{order.unit}</td>
                        <td className="px-4 py-3 text-sm border-r border-gray-200">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${order.priority === 'High' ? 'bg-red-100 text-red-800' :
                            order.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                            {order.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 border-r-2 border-gray-400">{order.remark || '—'}</td>

                        {/* Received Data (Directly Editable) */}
                        <td className="px-4 py-3 text-sm bg-emerald-50/30 border-r border-gray-200">
                          <input
                            type="number"
                            value={data.receivedQty || ''}
                            onChange={(e) => handleReceivedChange(order.row, 'receivedQty', e.target.value)}
                            onBlur={() => handleFieldBlur(order)}
                            placeholder="Enter qty"
                            disabled={isSaving}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm bg-emerald-50/30 border-r border-gray-200">
                          <input
                            type="number"
                            step="0.01"
                            value={data.weight || ''}
                            onChange={(e) => handleReceivedChange(order.row, 'weight', e.target.value)}
                            onBlur={() => handleFieldBlur(order)}
                            placeholder="Enter weight"
                            disabled={isSaving}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm bg-emerald-50/30 border-r border-gray-200">
                          <input
                            type="text"
                            value={order.unit || ''}
                            readOnly
                            className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-600 cursor-not-allowed"
                            title="Unit is auto-populated from order"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm bg-emerald-50/30 relative">
                          <input
                            type="text"
                            value={data.remark || ''}
                            onChange={(e) => handleReceivedChange(order.row, 'remark', e.target.value)}
                            onBlur={() => handleFieldBlur(order)}
                            placeholder="Enter remark"
                            disabled={isSaving}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          {isSaving && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-emerald-50 border-l-4 border-emerald-600 rounded-lg p-5 shadow-sm">
          <div className="flex items-start">
            <div className="text-2xl mr-3">💡</div>
            <div>
              <p className="text-sm text-gray-800 font-semibold mb-2">How to use:</p>
              <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                <li><strong>Blue columns</strong> show ordered items (read-only)</li>
                <li><strong>Green columns</strong> are for received stock entry (editable)</li>
                <li>Click any green field to enter data - it auto-saves when you click away</li>
                <li>Unit is automatically populated from the order</li>
                <li>Enter Received Qty, Weight, and Remark as needed</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
