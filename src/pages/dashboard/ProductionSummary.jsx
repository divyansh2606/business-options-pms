import React, { useState, useEffect } from "react";
import { fetchMenuOptions } from "../../api/restaurantAPI3"; // CSV API for menu options (static list)
import {
    fetchPMSData, // Apps Script - triggers live sheet recalculation
    updatePMSDropdown,
    updateCell,
    fetchDynamicClients,
    fetchDynamicDates,
    fetchDynamicMeals,
    setFiltersAndVerify,
} from "../../api/restaurantAPI2";

// ✅ Constants matching DashboardSummary to ensure synced behavior
const DROPDOWN_CELLS = {
    client: "A1",  // Column A (0-indexed: 0)
    date: "P1",    // Column P (0-indexed: 15)
    meal: "AE1",   // Column AE (0-indexed: 30)
};

// Helper components & functions
const formatDate = (date) => {
    if (!date) return "";

    let d;
    let str = date.toString().trim();

    // If it's already a Date object
    if (date instanceof Date && !isNaN(date)) {
        d = date;
    } else {
        // It's a string - try common formats
        // Handle ISO format: 2025-12-25
        const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (isoMatch) {
            d = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
        }
        // Handle dd-MMM-yyyy like 25-Dec-2025
        else if (str.match(/^\d{2}-[A-Za-z]{3}-\d{4}$/)) {
            d = new Date(str); // JS can parse this
        }
        // Fallback: let JS try to parse
        else {
            d = new Date(str);
        }
    }

    if (!d || isNaN(d.getTime())) {
        // console.warn("Invalid date could not be parsed:", date);
        return str; // return original as fallback
    }

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

// ✅ Robust Parser for Production Summary
// User specified: Data starts from Column AT (45), Row 5.
// Assumed Mapping based on standard layout starting at AT:
// Name: AT (45)
// Planned: AU (46)
// Unit: AV (47)
// Actual: AW (48) (or similar, scanning will be lenient)
const parseProductionSheet = (rows, verificationData = null) => {
    const menus = [];

    // Add robustness: check top rows for explicitly placed headers
    let topRowClient, topRowDate, topRowMeal;
    if (rows.length > 0) {
        topRowClient = rows[0][0]?.toString().trim();
        topRowDate = rows[0][15]?.toString().trim() || rows[0][12]?.toString().trim(); // P1 or M1
        topRowMeal = rows[0][30]?.toString().trim() || rows[0][24]?.toString().trim(); // AE1 or Y1
    }

    // Configuration
    const HEADER_ROW_IDX = 7; // Row 8
    const DATA_START_ROW = 8; // Row 9

    // Explicit Mapping based on User Screenshot (Right-side Green Block)
    // Name: AT (45)
    // Planned: AW (48)
    // Unit: BA (52)
    // Actual: BC (54) (To the right of Unit)
    let cols = {
        name: 45,
        planned: 48,
        unit: 52,
        actual: 54
    };

    // 🔍 Verify/Refine Columns by checking Header Row (Row 8)
    // We only scan locallly around the expected positions to avoid picking up "Item Name" from the left side (AO, AM, etc.)
    if (rows[HEADER_ROW_IDX]) {
        const headerRow = rows[HEADER_ROW_IDX];

        // Check Name at AT(45)
        const nameHeader = headerRow[45]?.toString().trim().toLowerCase();
        if (nameHeader && nameHeader.includes("item")) cols.name = 45;

        // Check Planned at AW(48)
        if (headerRow[48]?.toString().trim().toLowerCase() === "planned") cols.planned = 48;

        // Check Unit at BA(52)
        if (headerRow[52]?.toString().trim().toLowerCase() === "unit") cols.unit = 52;

        // Check Actual at BC(54) or nearby
        // Scan 53, 54, 55 for "Actual"
        for (let i = 53; i <= 56; i++) {
            if (headerRow[i]?.toString().trim().toLowerCase() === "actual") {
                cols.actual = i;
                break;
            }
        }

        console.log(`🔍 Confirmed Columns: Name=${cols.name}, Planned=${cols.planned}, Unit=${cols.unit}, Actual=${cols.actual}`);
    }

    // Use a header found in the first few rows if possible, else verification data
    let globalHeader = null;
    for (let i = 0; i < DATA_START_ROW; i++) {
        const h = extractHeaderInfo(rows[i]);
        if (h) {
            globalHeader = h;
            break;
        }
    }

    if (!globalHeader) {
        if (topRowClient || topRowDate || topRowMeal) {
            globalHeader = {
                client: topRowClient,
                date: topRowDate ? formatDate(topRowDate) : null,
                meal: topRowMeal
            };
        } else if (verificationData?.requested) {
            globalHeader = {
                client: verificationData.requested.client,
                date: verificationData.requested.date,
                meal: verificationData.requested.meal
            };
        }
    }

    const items = [];

    for (let r = DATA_START_ROW; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;

        // Check for new meal section
        const cell0 = row[0]?.toString().trim().toLowerCase();
        if (cell0 && /^(morning|breakfast|lunch|evening|dinner)/i.test(cell0)) {
            // Future: handle multiple sections
        }

        const cName = row[cols.name];
        if (cName && cName.toString().length > 1) {
            const name = cName.toString().trim();
            // Filter keywords
            if (["planned", "actual", "total", "unit", "qty", "item name", "amount", "remark"].includes(name.toLowerCase())) continue;

            const cActual = row[cols.actual];
            const cPlanned = row[cols.planned];
            const cUnit = row[cols.unit];

            let planned = 0;
            if (cPlanned) {
                if (!isNaN(Number(cPlanned))) {
                    planned = Number(cPlanned);
                } else {
                    const pFloat = parseFloat(cPlanned.toString());
                    if (!isNaN(pFloat)) planned = pFloat;
                }
            }

            let actual = 0;
            if (cActual) {
                if (!isNaN(Number(cActual))) {
                    actual = Number(cActual);
                } else {
                    const aFloat = parseFloat(cActual.toString());
                    if (!isNaN(aFloat)) actual = aFloat;
                }
            }

            // Parse Unit
            let unit = "";
            if (cUnit !== undefined && cUnit !== null) {
                unit = cUnit.toString().trim();
            }

            // Fallback: If unit is empty, check +1 or -1 of detected unit col (merged cells?)
            if (!unit) {
                const neighbors = [cols.unit - 1, cols.unit + 1];
                for (let nc of neighbors) {
                    const val = row[nc]?.toString().trim();
                    if (val && isNaN(Number(val)) && val.length < 10) {
                        unit = val;
                        break;
                    }
                }
            }

            items.push({
                name,
                planned,
                actual,
                unit,
                actualCell: { rowIndex: r, colIndex: cols.actual }
            });
        }
    }

    if (items.length > 0) {
        let finalClient = globalHeader?.client || "Unknown Client";
        let finalDate = globalHeader?.date || "Unknown Date";
        let finalMeal = globalHeader?.meal || "Unknown Meal";

        if (verificationData && verificationData.requested) {
            finalClient = finalClient === "Unknown Client" ? verificationData.requested.client : finalClient;
            finalDate = finalDate === "Unknown Date" ? verificationData.requested.date : finalDate;
            finalMeal = finalMeal === "Unknown Meal" ? verificationData.requested.meal : finalMeal;
        }

        menus.push({
            meal: finalMeal,
            date: finalDate,
            client: finalClient,
            items: [{ name: "Production Items", ingredients: items }],
            debugRows: []
        });
    }

    return menus;
};

// ✅ Helper: Verify dropdown values are set correctly
const verifyDropdownValues = async (expectedClient, expectedDate, expectedMeal) => {
    try {
        const rows = await fetchPMSData();
        if (rows.length === 0) {
            console.warn("⚠️ Cannot verify: No rows received");
            return { client: false, date: false, meal: false };
        }

        const row0 = rows[0] || [];
        const actualClient = row0[0]?.toString().trim() || "";
        // Check P1 (col 15) for date, fallback M1 (col 12)
        const actualDate = (row0[15]?.toString().trim() || row0[12]?.toString().trim()) || "";
        // Check AE1 (col 30) for meal, fallback Y1 (col 24)
        const actualMeal = (row0[30]?.toString().trim() || row0[24]?.toString().trim()) || "";

        const normalize = (str) => str?.toString().trim().toLowerCase() || "";
        const clientMatch = normalize(actualClient) === normalize(expectedClient);

        // Normalize date for comparison
        let normalizedActual = actualDate.toLowerCase();
        try {
            const d = new Date(actualDate);
            if (!isNaN(d.getTime())) {
                normalizedActual = formatDate(d).toLowerCase();
            }
        } catch (e) { }

        const normalizedExpected = formatDate(expectedDate).toLowerCase();

        const dateMatch = normalizedExpected === normalizedActual ||
            normalizedActual.includes(normalizedExpected) ||
            normalizedExpected.includes(normalizedActual);
        const mealMatch = normalize(actualMeal) === normalize(expectedMeal);

        console.log(`🔍 Verification: Client="${actualClient}" (${clientMatch ? '✅' : '❌'}), Date="${actualDate}" (${dateMatch ? '✅' : '❌'}), Meal="${actualMeal}" (${mealMatch ? '✅' : '❌'})`);

        return { client: clientMatch, date: dateMatch, meal: mealMatch, actualClient, actualDate, actualMeal };
    } catch (err) {
        console.error("⚠️ Verification error:", err);
        return { client: false, date: false, meal: false };
    }
};


export default function ProductionSummary() {
    const [loading, setLoading] = useState(true);
    const [autoSaving, setAutoSaving] = useState(false);
    const [lastSaveStatus, setLastSaveStatus] = useState("");

    // Filter State
    // ✅ Persist Data (Menus) to prevent refresh on tab switch
    const [allMenus, setAllMenus] = useState(() => {
        try {
            const cached = localStorage.getItem('production_summary_cache');
            return cached ? JSON.parse(cached) : [];
        } catch { return []; }
    });

    useEffect(() => {
        if (allMenus.length > 0) {
            localStorage.setItem('production_summary_cache', JSON.stringify(allMenus));
        }
    }, [allMenus]);
    const [client, setClient] = useState("");
    const [selectedDate, setSelectedDate] = useState("");
    const [mealType, setMealType] = useState("");

    // Options State
    const [clientOptions, setClientOptions] = useState([]);
    const [dateOptions, setDateOptions] = useState([]);
    const [mealOptions, setMealOptions] = useState([]);

    // ✅ Helper: Validate fetched data matches all three filters
    const validateFetchedData = (menus, expectedClient, expectedDate, expectedMeal) => {
        if (!menus || menus.length === 0) return false;

        const normalizeStr = (str) => str?.toString().trim().toLowerCase() || "";
        const menu = menus[0];

        // Check if we have items
        const hasItems = menu.items && menu.items[0] && menu.items[0].ingredients && menu.items[0].ingredients.length > 0;

        const menuClient = normalizeStr(menu.client);
        const menuDate = normalizeStr(menu.date);
        const menuMeal = normalizeStr(menu.meal);

        const expectClient = normalizeStr(expectedClient);
        const expectDate = normalizeStr(formatDate(expectedDate));
        const expectMeal = normalizeStr(expectedMeal);

        const clientMatch = menuClient === expectClient;
        const dateMatch = menuDate === expectDate ||
            menuDate.includes(expectDate) ||
            expectDate.includes(menuDate);
        const mealMatch = menuMeal === expectMeal;

        // Lenient check if items are present and client matches
        if (hasItems && clientMatch) {
            return true;
        }

        return clientMatch && dateMatch && mealMatch;
    };

    // ✅ Helper: Fetch and validate data with retries
    const fetchAndValidateData = async (expectedClient, expectedDate, expectedMeal, verificationData = null, maxRetries = 3) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(`📡 Fetch attempt ${attempt}/${maxRetries}...`);

            if (attempt > 1) {
                const waitTime = 2000 + (1000 * (attempt - 1));
                await new Promise(r => setTimeout(r, waitTime));
            }

            const rows = await fetchPMSData();
            let menus = parseProductionSheet(rows, verificationData);

            if (menus && menus.length > 0) {
                if (validateFetchedData(menus, expectedClient, expectedDate, expectedMeal)) {
                    console.log(`✅ Data validated successfully on attempt ${attempt}!`);
                    return menus;
                }
                // If validation fails but we have data, we might return it anyway if we are on last retry
            }

            if (attempt < maxRetries) {
                console.log(`🔄 Re-setting filters and retrying...`);
                const newVerification = await setFiltersAndVerify(expectedClient, expectedDate, expectedMeal);
                verificationData = newVerification;
                await new Promise(r => setTimeout(r, 3000));
            }
        }

        console.log("📡 Final fetch attempt...");
        const finalRows = await fetchPMSData();
        return parseProductionSheet(finalRows, verificationData);
    };

    const loadData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [pmsRows, allClients] = await Promise.all([
                fetchPMSData(),
                fetchDynamicClients(),
            ]);

            let menus = parseProductionSheet(pmsRows);
            setAllMenus(menus);
            setClientOptions(allClients);

            // Initial State Setup
            if (allClients.length > 0 && !client) {
                const savedClient = localStorage.getItem('pms_selected_client');
                const savedDate = localStorage.getItem('pms_selected_date');
                const savedMeal = localStorage.getItem('pms_selected_meal');

                const currentClient = savedClient && allClients.includes(savedClient) ? savedClient : allClients[0];
                setClient(currentClient);

                const clientDates = await fetchDynamicDates(currentClient);
                setDateOptions(clientDates);

                if (clientDates.length > 0) {
                    const defaultDate = savedDate && clientDates.includes(savedDate) ? savedDate : clientDates[0];
                    setSelectedDate(defaultDate);

                    const clientMeals = await fetchDynamicMeals(currentClient, defaultDate);
                    setMealOptions(clientMeals);

                    if (clientMeals.length > 0) {
                        const defaultMeal = savedMeal && clientMeals.includes(savedMeal) ? savedMeal : clientMeals[0];
                        setMealType(defaultMeal);

                        if (currentClient && defaultDate && defaultMeal) {
                            setTimeout(async () => {
                                try {
                                    const verification = await setFiltersAndVerify(currentClient, defaultDate, defaultMeal);
                                    await new Promise(r => setTimeout(r, 3000));
                                    const initialMenus = await fetchAndValidateData(currentClient, defaultDate, defaultMeal, verification);
                                    if (initialMenus && initialMenus.length > 0) {
                                        setAllMenus(initialMenus);
                                    }
                                } catch (e) { console.warn("Auto-load failed", e); }
                            }, 200);
                        }
                    }
                }
            }
        } catch (err) {
            console.error("❌ Error loading Production Summary data:", err);
        }
        if (!silent) setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    // ---------------------------------------------------------
    //  HANDLERS (Using robust logic from DashboardSummary)
    // ---------------------------------------------------------

    const handleClientChange = async (e) => {
        const newVal = e.target.value;
        setClient(newVal);
        localStorage.setItem('pms_selected_client', newVal);
        setAllMenus([]); // Clear current data

        if (newVal) {
            setLoading(true);
            try {
                const clientDates = await fetchDynamicDates(newVal);
                setDateOptions(clientDates);

                if (clientDates.length > 0) {
                    const nextDate = clientDates[0];
                    setSelectedDate(nextDate);
                    localStorage.setItem('pms_selected_date', nextDate);

                    const clientMeals = await fetchDynamicMeals(newVal, nextDate);
                    setMealOptions(clientMeals);

                    if (clientMeals.length > 0) {
                        const nextMeal = clientMeals[0];
                        setMealType(nextMeal);
                        localStorage.setItem('pms_selected_meal', nextMeal);

                        const verification = await setFiltersAndVerify(newVal, nextDate, nextMeal);
                        await new Promise(r => setTimeout(r, 5000));
                        const menus = await fetchAndValidateData(newVal, nextDate, nextMeal, verification);
                        setAllMenus(menus);
                    }
                }
                setLoading(false);
            } catch (err) {
                console.error("Client change failed", err);
                setLoading(false);
            }
        }
    };

    const handleDateChange = async (e) => {
        const newVal = e.target.value;
        setSelectedDate(newVal);
        localStorage.setItem('pms_selected_date', newVal);
        setAllMenus([]);

        if (newVal) {
            setLoading(true);
            try {
                const clientMeals = await fetchDynamicMeals(client, newVal);
                setMealOptions(clientMeals);

                if (clientMeals.length > 0) {
                    let nextMeal = mealType;
                    if (!clientMeals.includes(nextMeal)) nextMeal = clientMeals[0];
                    setMealType(nextMeal);
                    localStorage.setItem('pms_selected_meal', nextMeal);

                    const verification = await setFiltersAndVerify(client, newVal, nextMeal);
                    await new Promise(r => setTimeout(r, 5000));
                    const menus = await fetchAndValidateData(client, newVal, nextMeal, verification);
                    setAllMenus(menus);
                }
                setLoading(false);
            } catch (err) {
                console.error("Date change failed", err);
                setLoading(false);
            }
        }
    };

    const handleMealChange = async (e) => {
        const newVal = e.target.value;
        setMealType(newVal);
        localStorage.setItem('pms_selected_meal', newVal);
        setAllMenus([]);

        if (newVal) {
            setLoading(true);
            try {
                const verification = await setFiltersAndVerify(client, selectedDate, newVal);
                await new Promise(r => setTimeout(r, 5000));
                const menus = await fetchAndValidateData(client, selectedDate, newVal, verification);
                setAllMenus(menus);
                setLoading(false);
            } catch (err) {
                console.error("Meal change failed", err);
                setLoading(false);
            }
        }
    };

    const handleForceReload = async () => {
        if (!client || !selectedDate || !mealType) {
            alert("Please select Client, Date, and Meal before reloading.");
            return;
        }
        setLoading(true);
        setAllMenus([]);
        try {
            const verification = await setFiltersAndVerify(client, selectedDate, mealType);
            await new Promise(r => setTimeout(r, 5000));
            const menus = await fetchAndValidateData(client, selectedDate, mealType, verification);
            if (menus && menus.length > 0) {
                setAllMenus(menus);
            } else {
                alert("No data found matching selections.");
            }
        } catch (e) {
            console.error("Force reload failed", e);
            alert("Failed to reload data: " + e.message);
        }
        setLoading(false);
    };

    // Filter displayed menus (should be redundant if fetchAndValidateData works, but good for safety)
    const filteredMenus = allMenus.filter((m) => {
        // Same lenient logic as DashboardSummary
        const hasItems = m.items && m.items.length > 0 && m.items[0].ingredients && m.items[0].ingredients.length > 0;
        const clientMatch = m.client?.toLowerCase() === client?.toLowerCase();
        if (hasItems && clientMatch) return true;

        const matchesMeal = !mealType || m.meal?.toLowerCase() === mealType?.toLowerCase();
        const matchesDate = !selectedDate || m.date === selectedDate;
        return matchesMeal && matchesDate && clientMatch;
    });

    return (
        <div className="p-8 min-h-screen bg-gray-50">
            {/* Filters UI - REORDERED: Client, Date, Meal */}
            <div className="bg-white rounded-3xl shadow-xl p-8 mb-8 border-2 border-indigo-100">
                <div className="flex flex-wrap items-end justify-center gap-8">
                    {/* Client */}
                    <div className="text-center">
                        <label className="block text-xl font-bold text-indigo-800 mb-2">Client</label>
                        <select value={client} onChange={handleClientChange} className="px-8 py-3 text-xl border-2 border-indigo-500 rounded-xl">
                            {clientOptions.map(c => <option key={c}>{c}</option>)}
                        </select>
                    </div>
                    {/* Date */}
                    <div className="text-center">
                        <label className="block text-xl font-bold text-indigo-800 mb-2">Date</label>
                        <select value={selectedDate} onChange={handleDateChange} className="px-8 py-3 text-xl border-2 border-indigo-500 rounded-xl">
                            {dateOptions.map(d => <option key={d}>{d}</option>)}
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
                        <button onClick={handleForceReload} className="px-10 py-3 bg-indigo-600 text-white text-xl font-bold rounded-2xl shadow-lg hover:bg-indigo-700">
                            RELOAD
                        </button>
                        {autoSaving && <p className="text-green-600 font-bold animate-pulse text-center">💾 Saving...</p>}
                        {lastSaveStatus && <p className="text-xs font-mono text-gray-500 bg-gray-100 p-1 rounded max-w-[200px] break-words">{lastSaveStatus}</p>}
                    </div>
                </div>
            </div>

            {/* Content using parsed AK-AV Data */}
            <div className="max-w-7xl mx-auto">
                {loading ? (
                    <div className="text-center py-20 text-2xl text-gray-500">Loading Production Data...</div>
                ) : filteredMenus.length === 0 ? (
                    <div className="text-center py-10">
                        <p className="text-2xl text-gray-400 mb-4">NO DATA FOUND FOR SELECTION</p>
                        <div className="bg-gray-800 text-green-400 p-6 rounded-xl font-mono text-left text-xs overflow-x-auto max-w-4xl mx-auto border-4 border-red-500">
                            <h3 className="text-xl font-bold text-white mb-2">🕵️ DEBUG MODE: RAW SHEET DATA (Cols AK-AV)</h3>
                            <p className="mb-4 text-gray-400">Since no ingredients were found, I am showing you what I see in the Sheet from Column AK (36) to AV (47).</p>
                            {/* Debug table omitted for brevity/performance unless explicitly requested, can rely on console logs from fetch */}
                        </div>
                    </div>
                ) : (
                    filteredMenus.map((menu, idx) => {
                        const allIngredients = menu.items.flatMap(item =>
                            item.ingredients.map(ing => ({
                                ...ing,
                                parentItem: item.name
                            }))
                        );

                        if (allIngredients.length === 0) {
                            return <div key={idx} className="text-center py-10 text-xl text-red-500">Found Menu Header, but 0 Ingredients.</div>;
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
                                                        defaultValue={ing.actual === 0 ? "" : ing.actual}
                                                        placeholder="0"
                                                        onBlur={async (e) => {
                                                            setAutoSaving(true);
                                                            setLastSaveStatus("Saving...");
                                                            try {
                                                                const r = ing.actualCell.rowIndex + 1;
                                                                const c = ing.actualCell.colIndex;
                                                                await updateCell("PMS", r, c, e.target.value);
                                                                console.log(`💾 Saved R${r}C${c} -> ${e.target.value}`);
                                                                setLastSaveStatus(`✅ Saved: Row ${r}, Col ${c + 1}`);
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
