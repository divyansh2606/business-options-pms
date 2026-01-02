
import React, { useState, useEffect, useRef } from "react";
import { fetchFeedbackData } from "../../api/feedbackAPI";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid
} from "recharts";
import {
    Plus, Trash2, Star, Building2, X, Search, ChevronRight
} from "lucide-react";

export default function Feedback() {
    const [allData, setAllData] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [watchlist, setWatchlist] = useState([]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedDate, setSelectedDate] = useState("all"); // For date filtering
    const [chartDate, setChartDate] = useState(""); // For chart date selection
    const [selectedRecordId, setSelectedRecordId] = useState(null); // To uniquely identify a record
    const detailContainerRef = useRef(null);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const data = await fetchFeedbackData();
            setAllData(data);

            const uniqueCompanies = [...new Set(data.map(d => d.company))].filter(Boolean).sort();
            setCompanies(uniqueCompanies);

            const saved = localStorage.getItem('feedback_watchlist');
            if (saved) {
                setWatchlist(JSON.parse(saved));
            } else if (uniqueCompanies.length > 0) {
                setWatchlist(uniqueCompanies.slice(0, 3));
            }

            setLoading(false);
        };
        loadData();
    }, []);

    useEffect(() => {
        if (watchlist.length > 0) {
            localStorage.setItem('feedback_watchlist', JSON.stringify(watchlist));
        }
    }, [watchlist]);

    // Initialize chartDate when company is selected
    useEffect(() => {
        if (selectedCompany && allData.length > 0) {
            const stats = getCompanyStats(selectedCompany);
            const uniqueDates = [...new Set(stats.records.map(r =>
                r.dateObj ? r.dateObj.toLocaleDateString() : "N/A"
            ))].sort((a, b) => {
                if (a === "N/A") return 1;
                if (b === "N/A") return -1;
                return new Date(b) - new Date(a);
            });
            setChartDate(uniqueDates[0] || "");
            setSelectedRecordId(null); // Reset to most recent when changing company
        }
    }, [selectedCompany, allData]);

    const addToWatchlist = (company) => {
        if (!watchlist.includes(company)) {
            setWatchlist([...watchlist, company]);
        }
        setIsAddModalOpen(false);
    };

    const removeFromWatchlist = (e, company) => {
        e.stopPropagation();
        const newList = watchlist.filter(c => c !== company);
        setWatchlist(newList);
        if (newList.length === 0) localStorage.removeItem('feedback_watchlist');
    };

    const getCompanyStats = (company) => {
        const records = allData.filter(d => d.company === company);
        const count = records.length;

        const avgRating = count ? (records.reduce((acc, curr) => acc + (curr.averageRating || 0), 0) / count).toFixed(1) : 0;

        const categoryTotals = {};
        const categoryCounts = {};

        records.forEach(r => {
            if (!r.ratings) return;
            Object.entries(r.ratings).forEach(([cat, score]) => {
                if (!categoryTotals[cat]) { categoryTotals[cat] = 0; categoryCounts[cat] = 0; }
                categoryTotals[cat] += score;
                categoryCounts[cat] += 1;
            });
        });

        const categoryStats = Object.keys(categoryTotals).map(cat => ({
            subject: cat.length > 30 ? cat.substring(0, 27) + '...' : cat,
            fullSubject: cat,
            A: (categoryTotals[cat] / categoryCounts[cat]).toFixed(1),
        }));

        const sortedRecords = [...records].map((r, i) => {
            let dateVal = null;
            if (r.date) {
                if (typeof r.date === 'string') {
                    if (r.date.includes("Date")) {
                        const parts = r.date.match(/\d+/g);
                        if (parts && parts.length >= 3) {
                            dateVal = new Date(parts[0], parts[1], parts[2]);
                        } else if (parts && parts.length === 1) {
                            dateVal = new Date(parseInt(parts[0]));
                        }
                    } else {
                        dateVal = new Date(r.date);
                        // Handle DD/MM/YYYY fallback if browser fails to parse it
                        if (isNaN(dateVal.getTime()) && /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(r.date)) {
                            const parts = r.date.split(/[\/\-\s]/);
                            if (parts.length >= 3) {
                                let day = parseInt(parts[0]);
                                let month = parseInt(parts[1]) - 1;
                                let year = parseInt(parts[2]);
                                if (year < 100) year += 2000;
                                dateVal = new Date(year, month, day);
                            }
                        }
                    }
                } else {
                    dateVal = new Date(r.date);
                }
            }

            return {
                ...r,
                dateObj: (dateVal && !isNaN(dateVal.getTime())) ? dateVal : null,
                index: i + 1,
                rating: r.averageRating,
                id: r.id || `${r.date || 'no-date'}-${i}`
            };
        }).sort((a, b) => {
            if (!a.dateObj) return 1;
            if (!b.dateObj) return -1;
            return b.dateObj - a.dateObj;
        }); // Most recent first

        return {
            avgRating,
            count,
            records: sortedRecords,
            categoryStats
        };
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600"></div>
            </div>
        );
    }

    const renderDetailView = () => {
        if (!selectedCompany) return null;
        const stats = getCompanyStats(selectedCompany);

        // Get unique dates for filtering
        const uniqueDates = [...new Set(stats.records.map(r =>
            r.dateObj ? r.dateObj.toLocaleDateString() : "N/A"
        ))].sort((a, b) => {
            if (a === "N/A") return 1;
            if (b === "N/A") return -1;
            return new Date(b) - new Date(a); // Most recent first
        });

        // Filter records by selected date for Audit History table
        const filteredRecords = selectedDate === "all"
            ? stats.records
            : stats.records.filter(r => {
                const recordDate = r.dateObj ? r.dateObj.toLocaleDateString() : "N/A";
                return recordDate === selectedDate;
            });

        // chartDate is now managed at component level via useState and useEffect

        // Get the record for the selected chart date, prioritizing the specific record clicked
        const chartRecord = (selectedRecordId
            ? stats.records.find(r => r.id === selectedRecordId)
            : stats.records.find(r => {
                const recordDate = r.dateObj ? r.dateObj.toLocaleDateString() : "N/A";
                return recordDate === chartDate;
            })) || stats.records[0]; // Fallback to most recent

        const categoryStatsForDate = chartRecord && chartRecord.ratings
            ? Object.entries(chartRecord.ratings).map(([cat, score]) => ({
                subject: cat.length > 35 ? cat.substring(0, 32) + '...' : cat,
                fullSubject: cat,
                A: score,
            }))
            : [];

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden">
                    <div className="p-6 md:p-8 bg-indigo-900 text-white flex justify-between items-center shrink-0">
                        <div>
                            <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                                {selectedCompany}
                                <span className={`px-3 py-1 rounded-full text-base font-bold backdrop-blur-md ${stats.avgRating >= 4 ? 'bg-green-500/30 text-green-100' :
                                    stats.avgRating >= 3 ? 'bg-yellow-500/30 text-yellow-100' : 'bg-red-500/30 text-red-100'
                                    }`}>
                                    {stats.avgRating} / 5.0
                                </span>
                            </h2>
                            <p className="text-indigo-200 mt-2 flex items-center gap-2 text-sm">
                                <Building2 size={14} /> Total Audits: {stats.count}
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                setSelectedCompany(null);
                                setSelectedDate("all"); // Reset date filter when closing
                            }}
                            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    <div
                        ref={detailContainerRef}
                        className="flex-1 overflow-y-auto p-6 md:p-8 bg-gray-50/50"
                    >
                        <div className="mb-8">
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center">
                                            <Star size={18} className="mr-2 text-indigo-500" />
                                            Detailed Ratings
                                        </h3>
                                        <p className="text-xs text-gray-400">
                                            Showing feedback from {chartDate}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {chartRecord && (
                                            <div className={`px-4 py-2 rounded-xl font-bold text-lg ${chartRecord.averageRating >= 4 ? 'bg-green-100 text-green-700' :
                                                chartRecord.averageRating >= 2.5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                {chartRecord.averageRating.toFixed(1)} ★
                                            </div>
                                        )}
                                        <select
                                            value={chartDate}
                                            onChange={(e) => {
                                                setChartDate(e.target.value);
                                                setSelectedRecordId(null); // Manual selection defaults to latest of that date
                                            }}
                                            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all cursor-pointer"
                                        >
                                            {uniqueDates.map(date => (
                                                <option key={date} value={date}>
                                                    {date}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex-1" style={{ height: '600px' }}>
                                    {categoryStatsForDate.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={categoryStatsForDate}
                                                margin={{ top: 20, right: 30, left: 50, bottom: 120 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} horizontal={true} stroke="#e5e7eb" />
                                                <XAxis
                                                    dataKey="subject"
                                                    angle={-45}
                                                    textAnchor="end"
                                                    height={100}
                                                    interval={0}
                                                    tick={{ fill: '#374151', fontSize: 11, fontWeight: 500 }}
                                                    axisLine={{ stroke: '#d1d5db' }}
                                                />
                                                <YAxis
                                                    type="number"
                                                    domain={[0, 5]}
                                                    ticks={[0, 1, 2, 3, 4, 5]}
                                                    tick={{ fill: '#6b7280', fontSize: 12 }}
                                                    axisLine={{ stroke: '#d1d5db' }}
                                                />
                                                <Tooltip
                                                    cursor={{ fill: '#f3f4f6' }}
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            const data = payload[0].payload;
                                                            return (
                                                                <div className="bg-white p-3 border border-gray-200 shadow-xl rounded-xl">
                                                                    <p className="font-bold text-gray-800 mb-1 text-sm">{data.fullSubject}</p>
                                                                    <p className="text-indigo-600 font-bold text-lg">{data.A} / 5 ★</p>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Bar dataKey="A" barSize={40} radius={[6, 6, 0, 0]}>
                                                    {categoryStatsForDate.map((entry, index) => (
                                                        <Cell
                                                            key={`cell-${index}`}
                                                            fill={entry.A >= 4 ? '#22c55e' : entry.A >= 3 ? '#f59e0b' : entry.A >= 2 ? '#eab308' : '#ef4444'}
                                                        />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-gray-400">
                                            No rating data available
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">Audit History</h3>
                                    <span className="text-sm font-medium text-gray-400">
                                        {selectedDate === "all"
                                            ? `${stats.records.length} Total Records`
                                            : `${filteredRecords.length} Record(s) on ${selectedDate}`
                                        }
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="text-sm font-semibold text-gray-600">Filter by Date:</label>
                                    <select
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all cursor-pointer"
                                    >
                                        <option value="all">All Dates ({stats.records.length})</option>
                                        {uniqueDates.map(date => {
                                            const count = stats.records.filter(r => {
                                                const recordDate = r.dateObj ? r.dateObj.toLocaleDateString() : "N/A";
                                                return recordDate === date;
                                            }).length;
                                            return (
                                                <option key={date} value={date}>
                                                    {date} ({count})
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            </div>

                            <div className="overflow-x-auto max-h-[400px]">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr className="text-gray-400 text-xs font-bold uppercase tracking-wider border-b border-gray-200">
                                            <th className="p-4">Date</th>
                                            <th className="p-4">Overall</th>
                                            <th className="p-4">Detailed Breakdown (Stars)</th>
                                            <th className="p-4 w-1/3">Supervisor Comment</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-gray-600 divide-y divide-gray-100">
                                        {filteredRecords.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="p-8 text-center text-gray-400 italic">
                                                    No feedback records found for this date.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredRecords.map((record, idx) => (
                                                <tr
                                                    key={record.id || idx}
                                                    className={`hover:bg-indigo-50 cursor-pointer transition-all group/row relative ${selectedRecordId === record.id ? 'bg-indigo-50/50' : ''}`}
                                                    onClick={() => {
                                                        const recordDate = record.dateObj ? record.dateObj.toLocaleDateString() : "N/A";
                                                        setChartDate(recordDate);
                                                        setSelectedRecordId(record.id);
                                                        detailContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }}
                                                >
                                                    <td className="p-4 text-xs font-mono text-gray-700 font-semibold align-top group-hover/row:text-indigo-600">
                                                        {record.dateObj ? record.dateObj.toLocaleDateString() : (record.date || "N/A")}
                                                        <div className="text-[10px] text-gray-400 font-normal mt-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                            Click to view graph
                                                        </div>
                                                    </td>
                                                    <td className="p-4 align-top">
                                                        <div className={`inline-flex items-center px-2.5 py-1 rounded-lg font-bold text-sm ${record.averageRating >= 4 ? 'bg-green-100 text-green-700' :
                                                            record.averageRating >= 2.5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                                            }`}>
                                                            {record.averageRating.toFixed(1)} ★
                                                        </div>

                                                    </td>
                                                    <td className="p-4 align-top">
                                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                                            {record.ratings && Object.entries(record.ratings).map(([key, val]) => (
                                                                <div key={key} className="flex justify-between items-center">
                                                                    <span className="text-gray-500 truncate max-w-[120px]" title={key}>{key}</span>
                                                                    <div className="flex">
                                                                        {[...Array(5)].map((_, i) => (
                                                                            <span key={i} className={i < val ? "text-yellow-400" : "text-gray-200"}>★</span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 align-top">
                                                        <p className="text-sm leading-relaxed text-gray-800">
                                                            {record.feedback || <span className="text-gray-300 italic">-</span>}
                                                        </p>
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
            </div>
        );
    };

    return (
        <div className="p-6 md:p-10 bg-gray-50 min-h-screen font-sans">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                <div>
                    <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">Company Feedback</h1>
                    <p className="text-gray-500 text-lg">Monitor audit scores and compliance across sites.</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl shadow-lg hover:shadow-indigo-200 transition-all font-bold text-lg"
                >
                    <Plus size={24} />
                    Add Company
                </button>
            </div>

            {watchlist.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[2rem] border-2 border-dashed border-gray-200">
                    <div className="bg-indigo-50 p-6 rounded-full mb-6 max-w-xs mx-auto">
                        <Building2 size={48} className="text-indigo-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">No Companies Monitored</h3>
                    <p className="text-gray-400 mb-6">Add a client site to view their audit analytics.</p>
                    <button onClick={() => setIsAddModalOpen(true)} className="text-indigo-600 font-bold hover:underline">
                        Browse Client Sites
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {watchlist.map(company => {
                        const stats = getCompanyStats(company);
                        return (
                            <div
                                key={company}
                                onClick={() => setSelectedCompany(company)}
                                className="group relative bg-white p-6 rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 hover:border-indigo-100 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col items-center text-center h-full"
                            >
                                <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => removeFromWatchlist(e, company)}
                                        className="text-gray-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-full transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>

                                <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-3xl font-bold text-indigo-600 mb-4 group-hover:scale-110 transition-transform shadow-inner">
                                    {company.charAt(0).toUpperCase()}
                                </div>

                                <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-indigo-700 transition-colors">
                                    {company}
                                </h3>

                                <p className="text-sm text-gray-400 font-medium mb-4">
                                    {stats.count} Audits
                                </p>

                                <div className="mt-auto w-full pt-4 border-t border-gray-50 flex items-center justify-center gap-2 text-indigo-600 font-semibold text-sm group-hover:underline">
                                    View Details <ChevronRight size={16} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {isAddModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="text-xl font-bold text-gray-900">Add Client Site</h3>
                            <button onClick={() => setIsAddModalOpen(false)}>
                                <X className="text-gray-400 hover:text-gray-600" />
                            </button>
                        </div>

                        <div className="p-4 bg-white border-b border-gray-100">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="Search client site..."
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500 rounded-xl outline-none transition-all font-medium"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="p-2 max-h-[50vh] overflow-y-auto">
                            {companies.filter(c => c.toLowerCase().includes(searchTerm.toLowerCase())).map(company => {
                                const isAdded = watchlist.includes(company);
                                return (
                                    <button
                                        key={company}
                                        disabled={isAdded}
                                        onClick={() => addToWatchlist(company)}
                                        className={`w-full text-left px-5 py-4 rounded-xl flex justify-between items-center mb-2 transition-all ${isAdded
                                            ? "opacity-50 cursor-default"
                                            : "hover:bg-indigo-50 hover:text-indigo-700"
                                            }`}
                                    >
                                        <span className="font-semibold text-lg">{company}</span>
                                        {isAdded ? (
                                            <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded">ADDED</span>
                                        ) : (
                                            <Plus size={20} className="text-indigo-400" />
                                        )}
                                    </button>
                                );
                            })}
                            {companies.length === 0 && (
                                <div className="p-8 text-center text-gray-400">
                                    No client sites found.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {renderDetailView()}

        </div>
    );
}
