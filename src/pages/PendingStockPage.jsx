import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function PendingStockPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const user = location.state?.user;

    return (
        <div className="min-h-screen bg-gray-50 py-6 px-4">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0 text-center sm:text-left">
                    <div>
                        <button
                            onClick={() => navigate(-1)}
                            className="flex items-center justify-center sm:justify-start text-blue-600 hover:text-blue-800 mb-3 transition-colors"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Dashboard
                        </button>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Pending Stock</h1>
                        <p className="text-gray-600">View orders that haven't been received yet</p>
                    </div>
                    <div className="text-4xl mt-4 sm:mt-0">⏳</div>
                </div>

                <div className="bg-white rounded-lg shadow-lg p-12 text-center">
                    <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-5xl">🚧</span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Coming Soon</h2>
                    <p className="text-gray-600 max-w-md mx-auto">
                        This feature is currently under development. You will soon be able to view and manage all pending stock orders here.
                    </p>
                </div>
            </div>
        </div>
    );
}
