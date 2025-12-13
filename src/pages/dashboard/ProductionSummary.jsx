import React, { useState, useEffect } from "react";
import { fetchMenuOptions } from "../../api/restaurantAPI3"; // CSV API for menu options (static list)
import {
    fetchPMSData, // Apps Script - triggers live sheet recalculation
    updatePMSDropdown,
    updateCell,
} from "../../api/restaurantAPI2";

// Helper components & functions
const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d)) return date.toString().trim();

    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleString("en-US", { month: "short" });
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
};

const isNumericCell = (v) => {
    if (v === null || v === undefined || v === "") return false;
    if (typeof v === "number") return !isNaN(v);
    return !isNaN(Number(v));
};

const extractHeaderInfo = (row) => {
    if (!row) return null;
    const mealRegex = /^(morning|breakfast|lunch|evening|evening snacks|dinner)/i;
    let meal = null, date = null, client = null;

    row.forEach((cell) => {
        if (!cell) return;
        const str = cell.toString().trim();
        if (!str) return;

        if (!meal && mealRegex.test(str)) {
            meal = str;
        } else if (!date && !isNaN(new Date(str)) && str.length > 5 && str.includes("-")) {
            date = formatDate(new Date(str));
        } else if (!client && !mealRegex.test(str) && str !== date && isNaN(str) && str.length > 2) {
            if (!["date", "pax", "party", "venue"].includes(str.toLowerCase())) {
                client = str;
            }
        }
    });

    if (!meal) return null;
    return { meal, date, client };
};

// ✅ Robust Parser for Production Summary (Exact Columns)
// User defined: Name(AK=36), Planned(AN=39), Unit(AR=43), Actual(AT=45 / AV=47)
// Data starts from 8th row (index 7 if 0-based) relative to meal header? 
// Or just generally scan downwards. User said "starting from 8th row".
const parseProductionSheet = (rows) => {
    const menus = [];
    console.log("🔍 Parsing Production Summary (Exact Columns)...");

    for (let i = 0; i < rows.length; i++) {
        const header = extractHeaderInfo(rows[i]);
        if (!header) continue;

        const items = [];

        // Determine Default Actual Column by scanning Header Row (row i)
        // User said AT (45) / AV (47). We check AT, AU(46), AV.
        let defaultActualColForMealSection = 45; // Default AT

        if (rows[i]) {
            const headAT = rows[i][45]?.toString().toLowerCase() || "";
            const headAV = rows[i][47]?.toString().toLowerCase() || "";
            // If AV says "actual" but AT doesn't, prefer AV.
            if (headAV.includes("actual") && !headAT.includes("actual")) {
                defaultActualColForMealSection = 47;
            }
        }

        // Scan rows until next meal header or end of valid block
        // User stated "starting from 8th row". 
        // If "i" is the header row, then "i + 8" is the 8th row AFTER header? 
        // Or "8th row" absolute relative to something? 
        // I will start scanning from i + 1, but check indices.

        for (let r = i + 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;

            const cell0 = row[0]?.toString().trim().toLowerCase();
            // Stop if we hit a new Meal Section
            if (/^(morning|breakfast|lunch|evening|dinner)/i.test(cell0)) {
                break;
            }

            // EXACT COLUMNS from User:
            // Name: AK (36)
            // Planned: AN (39)
            // Unit: AR (43)
            // Actual: AT (45) or AV (47)

            const cName = row[36];
            const cPlanned = row[39];
            const cUnit = row[43];
            // const cActualAT = row[45]; // Removed, now part of dynamic check
            // const cActualAV = row[47]; // Removed, now part of dynamic check

            if (cName && cName.toString().length > 1) {
                const name = cName.toString().trim();
                // Filter out headers/metadata keywords if needed
                if (["planned", "actual", "total", "unit", "qty", "item name", "amount"].includes(name.toLowerCase())) continue;

                // RELAXED PARSING:
                // Even if Planned is empty or "10 kg", we try to capture it.
                // We trust the Row Name presence more.

                let planned = 0;
                if (cPlanned) {
                    // Try strict number
                    if (!isNaN(Number(cPlanned))) {
                        planned = Number(cPlanned);
                    } else {
                        // Try parseFloat for "10 kg"
                        const pFloat = parseFloat(cPlanned.toString());
                        if (!isNaN(pFloat)) planned = pFloat;
                    }
                }

                let unit = "";
                // Unit Strategy: User said AR (43).
                // But sometimes it might be in AQ (42) or AS (44) if cells are merged or offset.
                // We prioritize AR, then check neighbors for "unit-like" strings.

                const cUnitAR = row[43]; // AR
                const cUnitAQ = row[42]; // AQ
                const cUnitAS = row[44]; // AS

                const isUnitLike = (val) => {
                    if (!val) return false;
                    const s = val.toString().trim().toLowerCase();
                    // Check for common units or short strings (1-5 chars) that aren't numbers
                    return s.length > 0 && s.length < 6 && isNaN(Number(s));
                };

                if (cUnitAR && cUnitAR.toString().trim()) {
                    unit = cUnitAR.toString().trim();
                } else if (isUnitLike(cUnitAQ)) {
                    unit = cUnitAQ.toString().trim();
                } else if (isUnitLike(cUnitAS)) {
                    unit = cUnitAS.toString().trim();
                }

                // Actual Checking (AT, AU, AV)
                // We look for value in AT(45), AU(46), AV(47).
                // Use whichever has value. If multiple, prefer AT? Or prefer Default.

                let actual = 0;
                let actualCol = defaultActualColForMealSection;

                const cActualAT = row[45];
                const cActualAU = row[46];
                const cActualAV = row[47];

                const parseActual = (val) => {
                    if (!val) return 0;
                    if (!isNaN(Number(val))) return Number(val);
                    const f = parseFloat(val.toString());
                    return isNaN(f) ? 0 : f;
                };

                const hasVal = (val) => {
                    if (val === undefined || val === null || val === "") return false;
                    return !isNaN(parseFloat(val));
                };

                if (hasVal(cActualAT)) {
                    actual = parseActual(cActualAT);
                    actualCol = 45;
                } else if (hasVal(cActualAV)) {
                    actual = parseActual(cActualAV);
                    actualCol = 47;
                } else if (hasVal(cActualAU)) {
                    actual = parseActual(cActualAU);
                    actualCol = 46;
                }

                items.push({
                    name,
                    planned,
                    actual,
                    unit,
                    actualCell: { rowIndex: r, colIndex: actualCol }
                });
            }
        }

        if (items.length > 0) {
            menus.push({
                meal: header.meal,
                date: header.date,
                client: header.client,
                items: [{ name: "Production Items", ingredients: items }]
            });
        }
    }

    return menus;
};

export default function ProductionSummary() {
    const [loading, setLoading] = useState(true);
    const [autoSaving, setAutoSaving] = useState(false);
    const [lastSaveStatus, setLastSaveStatus] = useState(""); // Debug UI

    // Filter State
    const [allMenus, setAllMenus] = useState([]);
    const [client, setClient] = useState("");
    const [selectedDate, setSelectedDate] = useState("");
    const [mealType, setMealType] = useState("");

    // Options State
    const [clientOptions, setClientOptions] = useState([]);
    const [dateOptions, setDateOptions] = useState([]);
    const [mealOptions, setMealOptions] = useState([]);

    // Load Data
    const loadData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [pmsRows, menuOpts] = await Promise.all([
                fetchPMSData(),
                fetchMenuOptions(),
            ]);

            // Use the NEW parser for Columns AK+
            const menus = parseProductionSheet(pmsRows);
            setAllMenus(menus);

            // Derive options (standard logic)
            const meals = menuOpts.meals.length ? menuOpts.meals : [...new Set(menus.map(m => m.meal))].filter(Boolean);
            const clients = menuOpts.clients.length ? menuOpts.clients : [...new Set(menus.map(m => m.client))].filter(Boolean);
            const dates = menuOpts.dates.length ? menuOpts.dates.map(formatDate) : [...new Set(menus.map(m => m.date))].filter(Boolean).map(formatDate);

            setMealOptions(meals);
            setClientOptions(clients);
            setDateOptions(dates);

            // Sync defaults
            if (menus.length > 0) {
                // Try to keep current selection if valid, else pick first
                if (!mealType) setMealType(menus[0].meal);
                if (!selectedDate) setSelectedDate(menus[0].date);
                if (!client) setClient(menus[0].client);
            } else {
                if (!mealType && meals.length) setMealType(meals[0]);
                if (!client && clients.length) setClient(clients[0]);
                if (!selectedDate && dates.length) setSelectedDate(dates[0]);
            }

        } catch (err) {
            console.error("❌ Error loading Production Summary data:", err);
        }
        if (!silent) setLoading(false);
    };

    useEffect(() => {
        loadData();
        // Polling
        const timer = setInterval(() => loadData(true), 60000);
        return () => clearInterval(timer);
    }, []);

    // Filter Logic
    const filteredMenus = allMenus.filter((m) => {
        const matchesMeal = !mealType || m.meal?.toLowerCase() === mealType?.toLowerCase();
        const matchesDate = !selectedDate || m.date === selectedDate;
        const matchesClient = !client || m.client?.toLowerCase() === client?.toLowerCase();
        return matchesMeal && matchesDate && matchesClient;
    });

    // Handlers (Identical to DashboardSummary)
    // Helper: delay to allow sheet recalculation
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const handleMealChange = async (e) => {
        const newVal = e.target.value;
        setMealType(newVal);
        if (newVal) {
            setLoading(true);
            await updatePMSDropdown({ sheet: "PMS", dropdownCell: "B2", value: newVal });
            await delay(2000); // Wait for sheet to recalculate
            await loadData();
        }
    };
    const handleDateChange = async (e) => {
        const newVal = e.target.value;
        setSelectedDate(newVal);
        if (newVal) {
            setLoading(true);
            await updatePMSDropdown({ sheet: "PMS", dropdownCell: "M1", value: newVal });
            await delay(2000); // Wait for sheet to recalculate
            await loadData();
        }
    };
    const handleClientChange = async (e) => {
        const newVal = e.target.value;
        setClient(newVal);
        if (newVal) {
            setLoading(true);
            await updatePMSDropdown({ sheet: "PMS", dropdownCell: "Y1", value: newVal });
            await delay(2000); // Wait for sheet to recalculate
            await loadData();
        }
    };

    return (
        <div className="p-8 min-h-screen bg-gray-50">
            {/* Filters UI (Same as before) */}
            <div className="bg-white rounded-3xl shadow-xl p-8 mb-8 border-2 border-indigo-100">
                <div className="flex flex-wrap items-end justify-center gap-8">
                    {/* Date */}
                    <div className="text-center">
                        <label className="block text-xl font-bold text-indigo-800 mb-2">Date</label>
                        <select value={selectedDate} onChange={handleDateChange} className="px-8 py-3 text-xl border-2 border-indigo-500 rounded-xl">
                            {dateOptions.map(d => <option key={d}>{d}</option>)}
                        </select>
                    </div>
                    {/* Client */}
                    <div className="text-center">
                        <label className="block text-xl font-bold text-indigo-800 mb-2">Client</label>
                        <select value={client} onChange={handleClientChange} className="px-8 py-3 text-xl border-2 border-indigo-500 rounded-xl">
                            {clientOptions.map(c => <option key={c}>{c}</option>)}
                        </select>
                    </div>
                    {/* Meal */}
                    <div className="text-center">
                        <label className="block text-xl font-bold text-indigo-800 mb-2">Meal Type</label>
                        <select value={mealType} onChange={handleMealChange} className="px-8 py-3 text-xl border-2 border-orange-500 rounded-xl">
                            {mealOptions.map(m => <option key={m}>{m}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-2">
                        <button onClick={() => loadData(false)} className="px-10 py-3 bg-indigo-600 text-white text-xl font-bold rounded-2xl shadow-lg hover:bg-indigo-700">
                            RELOAD
                        </button>
                        {autoSaving && <p className="text-green-600 font-bold animate-pulse text-center">💾 Saving...</p>}
                        {lastSaveStatus && <p className="text-xs font-mono text-gray-500 bg-gray-100 p-1 rounded max-w-[200px] break-words">{lastSaveStatus}</p>}
                    </div>
                </div>
            </div>

            {/* Content for AK-AV Data */}
            <div className="max-w-7xl mx-auto">
                {loading ? (
                    <div className="text-center py-20 text-2xl text-gray-500">Loading Production Data...</div>
                ) : filteredMenus.length === 0 ? (
                    <div className="text-center py-10">
                        <p className="text-2xl text-gray-400 mb-4">NO DATA FOUND FOR SELECTION</p>


                        {/* DEBUG DATA DUMP */}
                        <div className="bg-gray-800 text-green-400 p-6 rounded-xl font-mono text-left text-xs overflow-x-auto max-w-4xl mx-auto border-4 border-red-500">
                            <h3 className="text-xl font-bold text-white mb-2">🕵️ DEBUG MODE: RAW SHEET DATA (Cols AK-AV)</h3>
                            <p className="mb-4 text-gray-400">Since no ingredients were found, I am showing you what I see in the Sheet from Column AK (36) to AV (47).</p>
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-700 text-white">
                                        <th className="p-1 border border-gray-600">Row #</th>
                                        {Array.from({ length: 12 }).map((_, i) => (
                                            <th key={i} className="p-1 border border-gray-600">Col {36 + i}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(allMenus.length > 0 && allMenus[0].debugRows) ? (
                                        allMenus[0].debugRows.map((r, i) => (
                                            <tr key={i} className="hover:bg-gray-700">
                                                <td className="p-1 border border-gray-600 text-yellow-500">{r.rowIndex + 1}</td>
                                                {r.data.map((cell, j) => (
                                                    <td key={j} className="p-1 border border-gray-600 truncate max-w-[50px]" title={cell}>
                                                        {cell ? cell.toString() : "."}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan="13" className="p-4 text-center">No Raw Data Captured. Check Parser.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    filteredMenus.map((menu, idx) => {
                        // Flatten all ingredients from all "items" (dishes) into one list
                        const allIngredients = menu.items.flatMap(item =>
                            item.ingredients.map(ing => ({
                                ...ing,
                                parentItem: item.name // Optional: if we need to show which Dish it belongs to
                            }))
                        );

                        if (allIngredients.length === 0) {
                            return <div key={idx} className="text-center py-10 text-xl text-red-500">Found Menu Header, but 0 Ingredients. (Debug info needed)</div>;
                        }

                        return (
                            <div key={idx} className="bg-white rounded-3xl shadow-xl p-8 mb-8 border-2 border-indigo-100 overflow-x-auto">
                                <h2 className="text-2xl font-bold text-indigo-900 mb-6 border-b pb-4">
                                    {menu.meal} - {menu.client} ({menu.date})
                                </h2>

                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-indigo-600 text-white">
                                            <th className="p-3 border bg-indigo-700 w-16 text-center">Row</th>
                                            <th className="p-3 text-left font-bold text-lg">Item Name</th>
                                            <th className="p-3 text-center font-bold text-lg">Planned</th>
                                            <th className="p-3 text-center font-bold text-lg">Unit</th>
                                            <th className="p-3 text-center font-bold text-lg">Actual</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allIngredients.map((ing, j) => (
                                            <tr key={j} className="border-b last:border-0 hover:bg-gray-50">
                                                <td className="p-3 border text-center font-mono text-gray-400 bg-gray-50">
                                                    {ing.actualCell.rowIndex + 1}
                                                </td>
                                                <td className="p-3 font-medium text-gray-800 text-base">{ing.name}</td>
                                                <td className="p-3 text-center text-gray-600 font-medium text-base">{ing.planned}</td>
                                                <td className="p-3 text-center text-gray-400 text-sm">{ing.unit}</td>
                                                <td className="p-3 text-center">
                                                    <input
                                                        type="number"
                                                        defaultValue={ing.actual}
                                                        onBlur={async (e) => {
                                                            setAutoSaving(true);
                                                            setLastSaveStatus("Saving...");
                                                            try {
                                                                // Row Index Fix: App Script expects 1-based Index.
                                                                // Our 'rowIndex' is 0-based. So we send rowIndex + 1.
                                                                const r = ing.actualCell.rowIndex + 1;
                                                                const c = ing.actualCell.colIndex; /* colIndex is 0-based for JS, converted in API */

                                                                await updateCell("PMS", r, c, e.target.value);
                                                                console.log(`💾 Saved R${r}C${c} -> ${e.target.value}`);
                                                                setLastSaveStatus(`✅ Saved: Row ${r}, Col ${c + 1} (${c === 45 ? 'AT' : c === 47 ? 'AV' : 'AU'})`);
                                                            } catch (error) {
                                                                console.error("❌ Error saving cell:", error);
                                                                setLastSaveStatus(`❌ Error: ${error.message}`);
                                                            } finally {
                                                                setAutoSaving(false);
                                                            }
                                                        }}
                                                        className="w-24 p-2 border-2 border-indigo-100 rounded-lg text-center bg-white focus:border-indigo-500 outline-none font-bold text-indigo-700"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
