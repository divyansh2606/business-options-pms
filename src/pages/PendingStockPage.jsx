import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchDiffO2dOrders } from '../api/stockAPI';

export default function PendingStockPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const user = location.state?.user;
    const [headerRow1, setHeaderRow1] = useState([]);
    const [headerRow2, setHeaderRow2] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch orders on mount
    useEffect(() => {
        const loadOrders = async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await fetchDiffO2dOrders();
                console.log('📋 Diff-O2d Data loaded:', response);
                console.log('Response type:', typeof response);
                console.log('Is Array:', Array.isArray(response));
                console.log('Has headerRow1:', response?.headerRow1);
                console.log('Has headerRow2:', response?.headerRow2);
                console.log('Has data:', response?.data);

                // Handle response from new API format with both header rows
                if (response && (response.headerRow1 || response.headerRow2 || response.data)) {
                    console.log('✅ Valid response detected');
                    console.log('HeaderRow1 length:', response.headerRow1?.length);
                    console.log('HeaderRow2 length:', response.headerRow2?.length);
                    console.log('Data length:', response.data?.length);

                    setHeaderRow1(response.headerRow1 || []);
                    setHeaderRow2(response.headerRow2 || []);
                    // Ensure data is always an array
                    setOrders(Array.isArray(response.data) ? response.data : []);
                } else if (response && response.headers) {
                    // Fallback for old format with single headers row
                    console.log('⚠️ Using old format with headers');
                    setHeaderRow2(response.headers || []);
                    setOrders(Array.isArray(response.data) ? response.data : []);
                } else if (Array.isArray(response)) {
                    // Fallback for very old format - response is direct array
                    console.log('⚠️ Got direct array response');
                    setOrders(response);
                    setHeaderRow1([]);
                    setHeaderRow2([]);
                } else {
                    console.warn('⚠️ Unexpected response format:', response);
                    setOrders([]);
                    setHeaderRow1([]);
                    setHeaderRow2([]);
                }
            } catch (err) {
                console.error('❌ Error loading pending orders:', err);
                setError('Failed to load pending orders. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        loadOrders();
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 py-6 px-4">
            <div className="max-w-full mx-auto">
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
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Pending Stock</h1>
                        <p className="text-gray-600 text-sm sm:text-base">View orders that are waiting to be received</p>
                    </div>
                    <div className="text-4xl mt-4 sm:mt-0">⏳</div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="bg-white rounded-lg shadow p-8 text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                        <p className="text-gray-600">Loading pending orders...</p>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <p className="text-red-800">⚠️ {error}</p>
                    </div>
                )}

                {/* No Headers */}
                {!loading && headerRow1.length === 0 && headerRow2.length === 0 && (
                    <div className="bg-white rounded-lg shadow p-8 text-center">
                        <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-5xl">⚠️</span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">No Data Available</h2>
                        <p className="text-gray-600">The Diff-O2d sheet is empty or headers not found.</p>
                    </div>
                )}

                {/* Orders Table */}
                {!loading && (headerRow1.length > 0 || headerRow2.length > 0) && (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead className="bg-blue-50 sticky top-0">
                                    {/* Header Row 1 */}
                                    {headerRow1.length > 0 && (
                                        <tr>
                                            {headerRow1.map((header, idx) => (
                                                <th
                                                    key={`h1-${idx}`}
                                                    className="px-4 py-3 text-left text-sm font-bold text-gray-800 border-r border-gray-300 whitespace-nowrap bg-blue-100"
                                                >
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    )}
                                    {/* Header Row 2 */}
                                    {headerRow2.length > 0 && (
                                        <tr>
                                            {headerRow2.map((header, idx) => (
                                                <th
                                                    key={`h2-${idx}`}
                                                    className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-r border-gray-300 whitespace-nowrap bg-blue-50"
                                                >
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    )}
                                </thead>
                                <tbody>
                                    {orders.length > 0 ? (
                                        orders.map((order, idx) => (
                                            <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                                                {order.map((cell, cellIdx) => (
                                                    <td
                                                        key={cellIdx}
                                                        className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200"
                                                    >
                                                        {cell instanceof Date
                                                            ? cell.toLocaleString()
                                                            : cell !== null && cell !== undefined
                                                                ? String(cell).trim()
                                                                : '—'}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={Math.max(headerRow1.length, headerRow2.length)} className="px-4 py-8 text-center text-gray-600">
                                                <div className="flex flex-col items-center gap-2">
                                                    <span className="text-3xl">✅</span>
                                                    <p>No data rows in the Diff-O2d sheet</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Info Box */}
                {!loading && (headerRow1.length > 0 || headerRow2.length > 0) && (
                    <div className="mt-6 bg-blue-50 border-l-4 border-blue-600 rounded-lg p-5 shadow-sm">
                        <div className="flex items-start">
                            <div className="text-2xl mr-3">ℹ️</div>
                            <div>
                                <p className="text-sm text-gray-800 font-semibold mb-2">Diff-O2d Sheet Summary:</p>
                                <p className="text-sm text-gray-700">
                                    Data Rows: <strong>{orders.length}</strong> | Columns: <strong>{Math.max(headerRow1.length, headerRow2.length)}</strong>
                                </p>
                                <p className="text-xs text-gray-600 mt-2">Data automatically syncs with the Diff-O2d sheet</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
