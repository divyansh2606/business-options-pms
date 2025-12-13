// src/pages/OrderStockPage.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  fetchItems,
  fetchPriorities,
  fetchStockOrders,
  addStockOrder,
  startOrder,
  deleteStockOrder,
  updateStockOrder,
  testGetPriorities,
  testAllEndpoints
} from '../api/stockAPI';

const normalizeOrders = (rows) =>
  rows.map((r) => ({
    orderNo: r[0],
    timestamp: r[1],
    itemCode: r[2],
    itemName: r[3],
    qty: r[4],
    unit: r[5],
    priority: r[6] || 'Medium',
    remark: r[7] || '',
    row: r[8] || null // sheet row number appended by server
  }));

export default function OrderStockPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = location.state?.user;

  // If user not provided, redirect back to dashboard/login
  if (!user) {
    navigate('/dashboard');
    return null;
  }

  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [priorities, setPriorities] = useState(['High', 'Medium', 'Low']);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });
  const [currentOrderNo, setCurrentOrderNo] = useState('');
  const [showOrderEntry, setShowOrderEntry] = useState(false);
  const [availableOrderNumbers, setAvailableOrderNumbers] = useState([]); // NEW: Store list of order numbers from sheet

  const [newOrder, setNewOrder] = useState({
    itemCode: '',
    itemName: '',
    qty: '',
    unit: '',
    priority: 'Medium'
  });

  const [editMeta, setEditMeta] = useState({ editing: false, orderNo: '', originalItemName: '', row: null });

  // Load initial data and fetch available order numbers
  useEffect(() => {
    if (user?.role === 'employee') {
      loadData();
      // Fetch available order numbers from sheet
      handleStartOrder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // TEST FUNCTION: Uncomment to test API endpoints
  // useEffect(() => {
  //   // Test getPriorities only
  //   testGetPriorities();
  //   
  //   // OR test all endpoints
  //   // testAllEndpoints();
  // }, []);

  const showNotificationMsg = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => setNotification({ show: false, type: '', message: '' }), 3000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [itemsData, prioritiesData, ordersData] = await Promise.all([
        fetchItems(),
        fetchPriorities(),
        fetchStockOrders()
      ]);

      if (Array.isArray(itemsData) && itemsData.length > 0) setItems(itemsData);
      if (Array.isArray(prioritiesData) && prioritiesData.length > 0) setPriorities(prioritiesData);

      // 🔥 SAFELY CLEAN + NORMALIZE + REMOVE HEADER ROWS
      if (Array.isArray(ordersData)) {
        const normalized = normalizeOrders(ordersData).filter((o) => {
          // Remove ONLY:
          // 1. Header row (row 6)
          // 2. Completely empty rows (no orderNo AND no itemName)
          const isHeaderRow6 = o.row === 6;
          const isEmpty = !o.orderNo && !o.itemName;

          return !(isHeaderRow6 || isEmpty);
        });

        setOrders(normalized);
      } else {
        setOrders([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      showNotificationMsg('error', 'Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = (e) => {
    const selectedName = e.target.value;
    const selectedItem = items.find(item => item.name === selectedName);

    if (selectedItem) {
      setNewOrder({
        ...newOrder,
        itemName: selectedName,
        itemCode: selectedItem.code || '',
        unit: selectedItem.unit || ''
      });
    } else {
      setNewOrder({
        ...newOrder,
        itemName: selectedName,
        itemCode: '',
        unit: ''
      });
    }
  };

  // ===== UPDATED: handleSubmitOrder (uses server row when returned) =====
  const handleSubmitOrder = async () => {
    if (!newOrder.itemName || !newOrder.qty) {
      showNotificationMsg('error', 'Please select item and enter quantity');
      return;
    }

    try {
      setLoading(true);

      if (editMeta.editing) {
        const payload = {
          orderNo: editMeta.orderNo || currentOrderNo,
          originalItemName: editMeta.originalItemName,
          itemCode: newOrder.itemCode,
          itemName: newOrder.itemName,
          qty: newOrder.qty,
          unit: newOrder.unit,
          priority: newOrder.priority,
          row: editMeta.row || undefined
        };

        const res = await updateStockOrder(payload);
        if (res && res.success === false) {
          throw new Error(res.message || 'Update failed');
        }

        showNotificationMsg('success', 'Order item updated successfully!');

        // optimistic update: replace any existing same row if present, else append
        setOrders(prev => {
          // remove the old item by row (preferred) or by orderNo+originalItemName
          const filtered = prev.filter(o => {
            if (payload.row) return o.row !== payload.row;
            return !(o.orderNo === payload.orderNo && o.itemName === payload.originalItemName);
          });

          const timestamp = new Date().toISOString();
          const updatedObj = {
            orderNo: payload.orderNo,
            timestamp,
            itemCode: payload.itemCode,
            itemName: payload.itemName,
            qty: payload.qty,
            unit: payload.unit,
            priority: payload.priority,
            remark: '',
            row: (res && res.row) ? res.row : payload.row || null
          };

          // keep list stable: put updated item at end (or you can unshift)
          return [...filtered, updatedObj];
        });

        // reset editor
        setEditMeta({ editing: false, orderNo: '', originalItemName: '', row: null });
        setNewOrder({ itemCode: '', itemName: '', qty: '', unit: '', priority: 'Medium' });
      } else {
        const payload = { ...newOrder };
        if (currentOrderNo) payload.orderNo = currentOrderNo;

        const result = await addStockOrder(payload);
        if (result && result.success === false) {
          throw new Error(result.message || 'Add failed');
        }

        // If server returned an orderNo (stable), persist it
        if (result && result.orderNo && !currentOrderNo) {
          setCurrentOrderNo(result.orderNo);
        }

        showNotificationMsg('success', 'Order placed successfully!');

        const timestamp = new Date().toISOString();
        const newOrderObj = {
          orderNo: currentOrderNo || (result && result.orderNo) || '',
          timestamp,
          itemCode: newOrder.itemCode,
          itemName: newOrder.itemName,
          qty: newOrder.qty,
          unit: newOrder.unit,
          priority: newOrder.priority,
          remark: '',
          row: (result && result.row) ? result.row : null
        };

        setOrders(prev => [...prev, newOrderObj]);

        setNewOrder({ itemCode: '', itemName: '', qty: '', unit: '', priority: 'Medium' });
      }
    } catch (error) {
      console.error('Submit error:', error);
      showNotificationMsg('error', editMeta.editing ? 'Failed to update order item' : 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const handleStartOrder = async () => {
    setLoading(true);
    try {
      const result = await startOrder();
      console.log('startOrder result:', result);

      if (result && result.success && Array.isArray(result.orderNumbers) && result.orderNumbers.length > 0) {
        setAvailableOrderNumbers(result.orderNumbers);
        showNotificationMsg('success', `Found ${result.orderNumbers.length} order number(s). Please select one.`);
        // Don't auto-select or show form yet - wait for user to select from dropdown
      } else if (result && result.error) {
        showNotificationMsg('error', result.error || 'No order numbers available in sheet');
      } else {
        showNotificationMsg('error', 'Failed to fetch order numbers from sheet');
      }
    } catch (err) {
      console.error('startOrder error', err);
      showNotificationMsg('error', 'Failed to fetch order numbers');
    } finally {
      setLoading(false);
    }
  };

  // NEW: Handle when user selects an order number from dropdown
  const handleSelectOrderNumber = (orderNo) => {
    setCurrentOrderNo(orderNo);
    setShowOrderEntry(true);
    showNotificationMsg('success', `Order selected: ${orderNo}`);
  };

  const handleFinishOrder = () => {
    setCurrentOrderNo('');
    setShowOrderEntry(false);
    showNotificationMsg('success', 'Order finished');
  };

  // ===== UPDATED: handleDeleteOrder (use server row when available for fast delete) =====
  const handleDeleteOrder = async (index) => {
    try {
      setLoading(true);
      const orderToDelete = orders[index];
      if (!orderToDelete) throw new Error('No order selected');

      // prefer deleting by sheet row if available (fast)
      if (orderToDelete.row) {
        // call fast path: pass numeric row
        await deleteStockOrder(orderToDelete.row);
      } else {
        // fallback: delete by orderNo + itemName
        await deleteStockOrder(orderToDelete.orderNo, orderToDelete.itemName);
      }

      // remove locally immediately
      setOrders(prev => prev.filter((_, i) => i !== index));
      showNotificationMsg('success', 'Order item deleted from sheet');
    } catch (error) {
      console.error('Delete error:', error);
      showNotificationMsg('error', 'Failed to delete order item');
    } finally {
      setLoading(false);
    }
  };

  const handleEditOrder = (index) => {
    const orderToEdit = orders[index];
    if (!orderToEdit) return;
    setNewOrder({
      itemCode: orderToEdit.itemCode,
      itemName: orderToEdit.itemName,
      qty: orderToEdit.qty,
      unit: orderToEdit.unit,
      priority: orderToEdit.priority || 'Medium'
    });

    // remove the edited row from display (we'll add it back after save)
    setOrders(prev => prev.filter((_, i) => i !== index));

    setEditMeta({
      editing: true,
      orderNo: orderToEdit.orderNo,
      originalItemName: orderToEdit.itemName,
      row: orderToEdit.row || null
    });

    showNotificationMsg('info', 'Editing order item - modify and save');
    setShowOrderEntry(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
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

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0">
          <h1 className="text-2xl font-bold text-gray-800">Order Stock</h1>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full sm:w-auto px-4 py-2 text-sm rounded-lg bg-white shadow hover:bg-gray-100"
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Order Number Selector Card - Show when no order is selected yet */}
        {!showOrderEntry && availableOrderNumbers.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-indigo-500">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Select Order Number</h2>
            <p className="text-gray-600 text-sm mb-4">
              Choose an order number from the Google Sheet to add items to:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {availableOrderNumbers.map((orderNo) => (
                <button
                  key={orderNo}
                  onClick={() => handleSelectOrderNumber(orderNo)}
                  className="px-4 py-3 bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 rounded-lg text-indigo-900 font-semibold text-sm transition-colors duration-200"
                >
                  {orderNo}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading or No Orders Message */}
        {!showOrderEntry && availableOrderNumbers.length === 0 && !loading && (
          <div className="bg-yellow-50 p-6 rounded-lg shadow-md border-l-4 border-yellow-400">
            <p className="text-yellow-800 font-semibold">No order numbers found</p>
            <p className="text-yellow-700 text-sm mt-1">Please create an order number in the Google Sheet first.</p>
          </div>
        )}

        {/* Order Form Card - Show only when an order is selected */}
        {showOrderEntry && (
          <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-6 rounded-2xl shadow-xl text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-10 rounded-full -ml-12 -mb-12"></div>

            <div className="relative flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold mb-1">
                  {editMeta.editing ? 'Edit Order Item' : 'Add New Order Item'}
                </h3>
                <p className="text-white/80 text-sm">
                  Select item, quantity and priority to place an order
                </p>
              </div>
              {currentOrderNo && (
                <div className="text-right text-sm">
                  <div>
                    <span className="font-semibold">Order No: </span>
                    {currentOrderNo}
                  </div>
                  <button
                    onClick={handleFinishOrder}
                    className="mt-1 underline text-white/80 hover:text-white"
                  >
                    Finish Order
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white/10 p-4 rounded-lg backdrop-blur-sm">
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">Order No</label>
                <input
                  type="text"
                  value={currentOrderNo || 'Auto'}
                  readOnly
                  className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">Timestamp</label>
                <input
                  type="text"
                  value={new Date().toLocaleString()}
                  readOnly
                  className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">Item Name *</label>
                <select
                  value={newOrder.itemName}
                  onChange={handleItemChange}
                  className="w-full px-3 py-2 border border-white/30 rounded-lg text-sm bg-white/20 text-white"
                >
                  <option value="" className="text-gray-800">
                    -- Select Item --
                  </option>
                  {items.map((item, idx) => (
                    <option key={idx} value={item.name} className="text-gray-800">
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">Item Code</label>
                <input
                  type="text"
                  value={newOrder.itemCode}
                  readOnly
                  className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">Quantity *</label>
                <input
                  type="number"
                  value={newOrder.qty}
                  onChange={(e) => setNewOrder({ ...newOrder, qty: e.target.value })}
                  className="w-full px-3 py-2 border border-white/30 rounded-lg text-sm bg-white/20 text-white"
                  placeholder="0"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">Unit</label>
                <input
                  type="text"
                  value={newOrder.unit}
                  readOnly
                  className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-sm text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-white/80 mb-1">Priority</label>
                <select
                  value={newOrder.priority}
                  onChange={(e) => setNewOrder({ ...newOrder, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-white/30 rounded-lg text-sm bg-white/20 text-white"
                >
                  {priorities.map((p, idx) => (
                    <option key={idx} value={p} className="text-gray-800">
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSubmitOrder}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-all"
              >
                {editMeta.editing ? '💾 Save Item' : '✓ Add Item'}
              </button>
              <button
                onClick={() => {
                  setNewOrder({ itemCode: '', itemName: '', qty: '', unit: '', priority: 'Medium' });
                  setEditMeta({ editing: false, orderNo: '', originalItemName: '', row: null });
                }}
                className="flex-1 px-4 py-2 bg-white/30 text-white font-semibold rounded-lg hover:bg-white/40 transition-all"
              >
                ✕ Clear
              </button>
            </div>
          </div>
        )}

        {/* Orders Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">Stock Orders</h3>
            <button
              onClick={loadData}
              className="px-3 py-1.5 text-sm bg-white/20 text-white rounded-lg hover:bg-white/30 flex items-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                  clipRule="evenodd"
                />
              </svg>
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="border-r border-gray-300 px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider w-24">Order No</th>
                  <th className="border-r border-gray-300 px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider w-40">Timestamp</th>
                  <th className="border-r border-gray-300 px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider w-24">Item Code</th>
                  <th className="border-r border-gray-300 px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider w-48">Item Name</th>
                  <th className="border-r border-gray-300 px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider w-20">Qty</th>
                  <th className="border-r border-gray-300 px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider w-20">Unit</th>
                  <th className="border-r border-gray-300 px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider w-24">Priority</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider w-24">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                      <p className="text-gray-500 mt-2">Loading...</p>
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-8 text-gray-500">
                      No orders yet. Use the form above to add items.
                    </td>
                  </tr>
                ) : (
                  orders.map((order, index) => (
                    <tr key={order.row || index} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="border-r border-gray-200 px-4 py-3 font-medium text-sm">{order.orderNo}</td>
                      <td className="border-r border-gray-200 px-4 py-3 text-sm text-gray-600">{order.timestamp}</td>
                      <td className="border-r border-gray-200 px-4 py-3 text-sm">{order.itemCode}</td>
                      <td className="border-r border-gray-200 px-4 py-3 text-sm">{order.itemName}</td>
                      <td className="border-r border-gray-200 px-4 py-3 text-sm">{order.qty}</td>
                      <td className="border-r border-gray-200 px-4 py-3 text-sm">{order.unit}</td>
                      <td className="border-r border-gray-200 px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${order.priority === 'High'
                          ? 'bg-red-100 text-red-800'
                          : order.priority === 'Medium'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                          }`}>
                          {order.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleEditOrder(index)}
                            className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-all"
                            title="Edit this order item"
                          >
                            ✎ Edit
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(index)}
                            className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-all"
                            title="Delete this order item"
                          >
                            ✕ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
