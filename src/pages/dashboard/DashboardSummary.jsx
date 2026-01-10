// DashboardSummary.jsx - Optimized for Immediate Data Fetching and Caching
import React, { useState, useEffect } from "react";
import {
  fetchPMSData,
  updatePMSDropdown,
  updateCell,
  pasteWeightToSheet,
  pasteIngredientToSheet,
  clearWeightData,
  clearIngredientData,
  clearManualData,
  fetchDynamicClients,
  fetchDynamicDates,
  fetchDynamicMeals,
  setFiltersAndVerify,
} from "../../api/restaurantAPI2";

const DROPDOWN_CELLS = {
  client: "A1",
  date: "P1",
  meal: "A2",
};

const formatDate = (date) => {
  if (!date) return "";
  let d;
  let str = date.toString().trim();
  if (date instanceof Date && !isNaN(date)) {
    d = date;
  } else {
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      d = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    } else if (str.match(/^\d{2}-[A-Za-z]{3}-\d{4}$/)) {
      d = new Date(str);
    } else {
      d = new Date(str);
    }
  }
  if (!d || isNaN(d.getTime())) return str;
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

const parsePMSSheet = (rows, verificationData = null) => {
  if (rows.length === 0) return [];
  const row0 = rows[0] || [];
  const row1 = rows[1] || [];

  let client = row0[0]?.toString().trim();
  if (!client || client === "" || client === "#N/A") {
    client = verificationData?.requested?.client || verificationData?.actual?.client || "Unknown Client";
  }

  let date = row0[15]?.toString().trim() || rows[1]?.[15]?.toString().trim() || row0[12]?.toString().trim();
  if (date && !isNaN(new Date(date).getTime())) {
    date = formatDate(new Date(date));
  } else {
    date = verificationData?.requested?.date || "Unknown Date";
  }

  const pax = row0[10] ? Number(row0[10]) : 0;
  let meal = row1[0]?.toString().trim() || row0[30]?.toString().trim();
  if (!meal || meal === "" || meal === "#N/A") {
    meal = verificationData?.requested?.meal || "Unknown Meal";
  }

  const dishHeaders = [];
  let itemLabelRow = -1;
  let dishNameRow = -1;

  for (let r = 0; r < Math.min(10, rows.length); r++) {
    const row = rows[r] || [];
    for (let c = 0; c < 50; c++) {
      const cell = row[c]?.toString().trim().toLowerCase();
      if (cell && cell.match(/^item\s+\d+$/)) {
        itemLabelRow = r;
        dishNameRow = r + 1;
        break;
      }
    }
    if (itemLabelRow >= 0) break;
  }

  if (itemLabelRow < 0) return [];

  const itemRow = rows[itemLabelRow] || [];
  const nameRow = rows[dishNameRow] || [];

  for (let c = 0; c < 50; c++) {
    const itemLabel = itemRow[c]?.toString().trim();
    if (itemLabel && itemLabel.toLowerCase().match(/^item\s+\d+$/)) {
      let dishName = nameRow[c]?.toString().trim();
      if (!dishName || dishName === "#N/A" || dishName === "") dishName = itemLabel;
      if (dishName.toLowerCase() === "item name") continue;
      dishHeaders.push({ col: c, name: dishName, ingredients: [], planned: 0, actual: 0, unit: "", actualCell: null });
    }
  }

  let totalsRow = -1;
  for (let r = itemLabelRow + 1; r < Math.min(itemLabelRow + 6, rows.length); r++) {
    const row = rows[r] || [];
    for (let c = 0; c < 50; c++) {
      const cell = row[c]?.toString().trim().toLowerCase();
      if (cell === "planned" || cell === "actual") {
        totalsRow = r;
        break;
      }
    }
    if (totalsRow >= 0) break;
  }

  if (totalsRow >= 0) {
    // Row with the labels (Planned/Diff/Unit/Actual) is `totalsRow`.
    // The numeric values are on the next row (row 8 in the sheet UI).
    const valuesRowIndex = Math.min(totalsRow + 1, rows.length - 1);
    const valuesRow = rows[valuesRowIndex] || [];
    dishHeaders.forEach(dish => {
      dish.planned = parseFloat(valuesRow[dish.col]) || 0;
      dish.unit = valuesRow[dish.col + 2]?.toString().trim() || "";
      // `actual` is NOT calculated; it comes from the sheet cell and can be edited by the user.
      dish.actual = parseFloat(valuesRow[dish.col + 3]) || 0;
      dish.actualCell = { rowIndex: valuesRowIndex, colIndex: dish.col + 3 };
    });
  }

  let ingredientsStartRow = totalsRow + 2;
  for (let r = totalsRow + 1; r < Math.min(totalsRow + 10, rows.length); r++) {
    const row = rows[r] || [];
    for (let c = 0; c < 50; c++) {
      const cellVal = row[c]?.toString().trim().toLowerCase() || "";
      if (cellVal.includes("item name") || cellVal === "items") {
        ingredientsStartRow = r + 2; // Skip header (r) and the repeated dish name row (r+1)
        break;
      }
    }
    if (ingredientsStartRow > totalsRow + 2) break;
  }

  for (let r = ingredientsStartRow; r < Math.min(150, rows.length); r++) {
    const row = rows[r];
    if (!row || row.length === 0) break;
    const firstCell = row[0]?.toString().trim().toLowerCase();
    if (firstCell && (firstCell.includes("breakfast") || firstCell.includes("lunch") || firstCell.includes("dinner") || firstCell.includes("morning"))) break;

    dishHeaders.forEach(dish => {
      const ingName = row[dish.col]?.toString().trim();
      if (ingName && ingName !== "#N/A" && ingName !== "" && !["total", "diff", "item name"].includes(ingName.toLowerCase()) && ingName.toLowerCase() !== dish.name.toLowerCase()) {
        const planned = Number(row[dish.col + 1]) || 0;
        const actual = Number(row[dish.col + 3]) || 0;
        dish.ingredients.push({
          name: ingName,
          planned,
          actual,
          unit: row[dish.col + 2]?.toString().trim() || "",
          actualCell: { rowIndex: r, colIndex: dish.col + 3 },
          diff: planned - actual
        });
      }
    });
  }

  const items = dishHeaders.map(d => ({
    name: d.name,
    // Use dish-level planned/actual from the sheet (row 8 values), do NOT calculate by summing ingredients
    planned: Number(d.planned) || 0,
    actual: Number(d.actual) || 0,
    unit: d.unit,
    actualCell: d.actualCell,
    diff: (Number(d.planned) || 0) - (Number(d.actual) || 0),
    ingredients: d.ingredients
  }));

  return [{ meal, date: formatDate(date), client, pax, items }];
};

export default function DashboardSummary() {
  const [loading, setLoading] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaveStatus, setLastSaveStatus] = useState("");
  const [weightPasting, setWeightPasting] = useState(false);
  const [ingredientPasting, setIngredientPasting] = useState(false);
  const [ingredientStatus, setIngredientStatus] = useState("");

  const [weightStatus, setWeightStatus] = useState("");
  const [clearingWeight, setClearingWeight] = useState(false);
  const [clearingIngredient, setClearingIngredient] = useState(false);
  const [clearingManual, setClearingManual] = useState(false);
  const [clearStatus, setClearStatus] = useState("");
  const [dataVersion, setDataVersion] = useState(0);


  const [client, setClient] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [mealType, setMealType] = useState("");

  const [clientOptions, setClientOptions] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('pms_client_options') || '[]');
      return Array.isArray(cached) ? cached : [];
    } catch (e) { return []; }
  });
  const [dateOptions, setDateOptions] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('pms_date_options') || '[]');
      return Array.isArray(cached) ? cached : [];
    } catch (e) { return []; }
  });
  const [mealOptions, setMealOptions] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('pms_meal_options') || '[]');
      return Array.isArray(cached) ? cached : [];
    } catch (e) { return []; }
  });

  const [allMenus, setAllMenus] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('dashboard_data_cache') || '[]');
      return Array.isArray(cached) ? cached : [];
    } catch (e) { return []; }
  });
  const [dataCache, setDataCache] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('pms_full_data_cache') || '{}');
      return (cached && typeof cached === 'object' && !Array.isArray(cached)) ? cached : {};
    } catch (e) { return {}; }
  });
  const [pmsData, setPmsData] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('pms_raw_data') || '[]');
      return Array.isArray(cached) ? cached : [];
    } catch (e) { return []; }
  });

  useEffect(() => {
    localStorage.setItem('pms_full_data_cache', JSON.stringify(dataCache));
    localStorage.setItem('dashboard_data_cache', JSON.stringify(allMenus));
    localStorage.setItem('pms_client_options', JSON.stringify(clientOptions));
    localStorage.setItem('pms_date_options', JSON.stringify(dateOptions));
    localStorage.setItem('pms_meal_options', JSON.stringify(mealOptions));
    localStorage.setItem('pms_raw_data', JSON.stringify(pmsData));
  }, [dataCache, allMenus, clientOptions, dateOptions, mealOptions, pmsData]);

  const validateFetchedData = (menus, expectedClient, expectedDate, expectedMeal) => {
    if (!menus || menus.length === 0) return false;
    const menu = menus[0];
    const normalize = (s) => s?.toString().trim().toLowerCase() || "";
    const clientMatch = normalize(menu.client) === normalize(expectedClient);
    if (menu.items?.length > 0 && clientMatch) return true;
    return clientMatch && normalize(menu.date).includes(normalize(formatDate(expectedDate))) && normalize(menu.meal) === normalize(expectedMeal);
  };

  const fetchAndValidateData = async (expectedClient, expectedDate, expectedMeal, verificationData = null, maxRetries = 3) => {
    const cacheKey = `${expectedClient}_${expectedDate}_${expectedMeal}`.toLowerCase();
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (attempt > 1) await new Promise(r => setTimeout(r, 1500));
      const rows = await fetchPMSData();
      if (rows && rows.length > 0) setPmsData(rows); // Always update local state if we got rows
      const menus = parsePMSSheet(rows, verificationData);
      if (menus.length > 0 && menus[0].items?.length > 0) {
        if (validateFetchedData(menus, expectedClient, expectedDate, expectedMeal)) {
          setDataCache(prev => ({ ...prev, [cacheKey]: menus }));
          return menus;
        }
        setDataCache(prev => ({ ...prev, [cacheKey]: menus }));
        return menus;
      }
      if (attempt < maxRetries) verificationData = await setFiltersAndVerify(expectedClient, expectedDate, expectedMeal);
    }
    return [];
  };

  const loadData = async () => {
    // Initial page load: show filters instantly (no spinner) and keep them ALL blank.
    try {
      const allClients = await fetchDynamicClients();
      setClientOptions(allClients);

      // ✅ DO NOT select any default client - user must select manually
      setClient("");

      // Clear all selections + data on initial load
      setSelectedDate("");
      setMealType("");
      setDateOptions([]);
      setMealOptions([]);
      setAllMenus([]);
    } catch (e) {
      // fail silently; page still renders filters
      setClientOptions([]);
      setDateOptions([]);
      setMealOptions([]);
      setAllMenus([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleClientChange = async (e) => {
    const newVal = e.target.value;

    // Update client instantly and clear dependent filters + data
    setClient(newVal);
    setSelectedDate("");
    setMealType("");
    setMealOptions([]);
    setAllMenus([]);

    // IMPORTANT: do NOT auto-pick date/meal on client change
    try {
      const dates = await fetchDynamicDates(newVal);
      setDateOptions(dates || []);
    } catch (err) {
      setDateOptions([]);
    }

    setLoading(false);
  };

  const handleDateChange = async (e) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    setAllMenus([]); // Clear current data view

    try {
      const meals = await fetchDynamicMeals(client, newDate);
      setMealOptions(meals || []);

      // Logic: Only fetch data if we have a valid meal selected that exists in the new date's options.
      // If no meal was selected (first load), DO NOT auto-select one.
      // If meal was selected but not available in new date, clear it.
      let targetMeal = mealType;

      if (!targetMeal) {
        // First-time selection scenario: User hasn't picked a meal yet. Do nothing.
        setMealType("");
      } else if (meals && meals.includes(targetMeal)) {
        // Meal preserved! Fetch data.
        setMealType(targetMeal); // Redundant but safe
        setLoading(true);
        const cacheKey = `${client}_${newDate}_${targetMeal}`.toLowerCase();
        if (dataCache[cacheKey]) {
          setAllMenus(dataCache[cacheKey]);
          setLoading(false);
          setFiltersAndVerify(client, newDate, { value: targetMeal, fast: true })
            .then(v => fetchAndValidateData(client, newDate, targetMeal, v))
            .then(m => { if (m) setAllMenus(m); });
        } else {
          const v = await setFiltersAndVerify(client, newDate, { value: targetMeal, fast: true });
          const m = await fetchAndValidateData(client, newDate, targetMeal, v);
          if (m) setAllMenus(m);
          setLoading(false);
        }
      } else {
        // Meal selected previously, but not available for new date -> Clear it.
        setMealType("");
      }
    } catch (err) {
      setMealOptions([]);
      setMealType("");
      setLoading(false);
    }
    // Ensure loading is off if we didn't start a fetch
    if (!mealType || (mealType && mealOptions.length > 0 && !mealOptions.includes(mealType))) {
      setLoading(false);
    }
  };

  const handleMealChange = async (e) => {
    const newVal = e.target.value;
    setMealType(newVal);

    // Only fetch data when all filters are selected
    if (!client || !selectedDate || !newVal) {
      setAllMenus([]);
      return;
    }

    setLoading(true);

    const cacheKey = `${client}_${selectedDate}_${newVal}`.toLowerCase();
    if (dataCache[cacheKey]) {
      setAllMenus(dataCache[cacheKey]);
      setLoading(false);
      // still refresh in background to keep data fresh
      try {
        const v = await setFiltersAndVerify(client, selectedDate, { value: newVal, fast: true });
        const m = await fetchAndValidateData(client, selectedDate, newVal, v);
        if (m) setAllMenus(m);
      } catch (err) { }
      return;
    } else {
      setAllMenus([]);
    }

    try {
      const v = await setFiltersAndVerify(client, selectedDate, { value: newVal, fast: true });
      const m = await fetchAndValidateData(client, selectedDate, newVal, v);
      if (m) setAllMenus(m);
    } catch (err) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleAutoSave = async (cell, value) => {
    if (!cell) return;
    setAutoSaving(true);
    try {
      await updateCell("PMS", cell.rowIndex + 1, cell.colIndex, value);
      setLastSaveStatus(`✅ Saved`);

      // Update local pmsData state immediately so changes reflect in UI
      setPmsData(prev => {
        if (!prev || !Array.isArray(prev)) return prev;
        const next = prev.map(r => (Array.isArray(r) ? [...r] : r));
        if (!next[cell.rowIndex]) next[cell.rowIndex] = [];
        next[cell.rowIndex][cell.colIndex] = value;
        return next;
      });
    } catch (e) { setLastSaveStatus(`❌ Error`); }
    setTimeout(() => setAutoSaving(false), 2000);
  };

  const handleForceReload = async () => {
    if (!client || !selectedDate || !mealType) {
      alert("Please select Client, Date and Meal first");
      return;
    }

    setLoading(true);

    // Clear ALL caches to force fresh data fetch
    const cacheKey = `${client}_${selectedDate}_${mealType}`.toLowerCase();
    setDataCache(prev => {
      const next = { ...prev };
      delete next[cacheKey];
      return next;
    });

    // Clear localStorage caches
    localStorage.removeItem('pms_full_data_cache');
    localStorage.removeItem('dashboard_data_cache');
    localStorage.removeItem('pms_raw_data');

    // Force sheet to recalculate and fetch fresh data
    const v = await setFiltersAndVerify(client, selectedDate, mealType);
    await new Promise(r => setTimeout(r, 3000)); // Wait for sheet recalculation

    // Fetch fresh data (bypassing cache since we cleared it)
    const rows = await fetchPMSData();
    setPmsData(rows);
    const menus = parsePMSSheet(rows, v);

    if (menus && menus.length > 0) {
      setAllMenus(menus);
      // Update cache with fresh data
      setDataCache(prev => ({ ...prev, [cacheKey]: menus }));
    }

    setLoading(false);
  };

  // ✅ Same as Google Sheet "Weight" button: paste PMS header + row8 block into Weight sheet
  const handlePasteWeight = async () => {
    if (!client || !selectedDate || !mealType) {
      alert("Please select Client, Date and Meal first");
      return;
    }

    setWeightPasting(true);
    setWeightStatus("");
    try {
      // Ensure PMS dropdowns match current selection before pasting
      await setFiltersAndVerify(
        client,
        { value: selectedDate, fast: true },
        { value: mealType, fast: true }
      );
      // Give sheet a tiny moment to recalc
      await new Promise((r) => setTimeout(r, 600));

      await pasteWeightToSheet();
      setWeightStatus("✅ Weight sheet updated");
    } catch (e) {
      setWeightStatus(`❌ ${e?.message || "Failed"}`);
    } finally {
      setWeightPasting(false);
    }
  }

  // ✅ Same as Google Sheet "Ingredient" button: paste PMS manual AY:BE rows into ingredient sheet
  const handlePasteIngredient = async () => {
    if (!client || !selectedDate || !mealType) {
      alert("Please select Client, Date and Meal first");
      return;
    }

    setIngredientPasting(true);
    setIngredientStatus("");
    try {
      // Ensure PMS dropdowns match current selection before pasting
      await setFiltersAndVerify(
        client,
        { value: selectedDate, fast: true },
        mealType
      );

      await pasteIngredientToSheet();

      setIngredientStatus("✅ Ingredient data saved to ingredient sheet");
    } catch (e) {
      console.error(e);
      setIngredientStatus("❌ Failed to save ingredient data");
    } finally {
      setIngredientPasting(false);
    }
  };

  // ✅ Clear Weight Data (Row 8 Actual values)
  const handleClearWeight = async () => {
    if (!client || !selectedDate || !mealType) {
      alert("Please select Client, Date and Meal first");
      return;
    }

    if (!confirm("Are you sure you want to clear all TOTALS (Row 8) actual values?")) {
      return;
    }

    setClearingWeight(true);
    setClearStatus("");
    try {
      // Instant local clear for Row 8 (Columns D, I, N, S, X, AC, AH, AM, AR, AW)
      const cols = [3, 8, 13, 18, 23, 28, 33, 38, 43, 48]; // 0-indexed indices for D, I, N...
      setPmsData(prev => {
        const next = [...prev.map(r => [...r])];
        if (next[7]) cols.forEach(c => next[7][c] = "");
        return next;
      });

      const res = await clearWeightData();
      setClearStatus(`✅ ${res.message || "Weight data cleared"}`);
      setDataVersion(v => v + 1);

      // Wait a bit longer for Google Sheets to sync before reloading
      setClearStatus(s => s + " (Syncing...)");
      await new Promise(r => setTimeout(r, 5000));
      await handleForceReload();
    } catch (e) {
      console.error(e);
      setClearStatus(`❌ Failed to clear weight data: ${e?.message || "Unknown error"}`);
    } finally {
      setClearingWeight(false);
    }
  };

  // ✅ Clear Ingredient Data (Row 11+ Actual values)
  const handleClearIngredient = async () => {
    if (!client || !selectedDate || !mealType) {
      alert("Please select Client, Date and Meal first");
      return;
    }

    if (!confirm("Are you sure you want to clear all ingredient (Row 11+) actual values?")) {
      return;
    }

    setClearingIngredient(true);
    setClearStatus("");
    try {
      // Instant local clear for Row 11+ Actuals
      const cols = [3, 8, 13, 18, 23, 28, 33, 38, 43, 48];
      setPmsData(prev => {
        const next = [...prev.map(r => [...r])];
        for (let r = 10; r < next.length; r++) {
          cols.forEach(c => { if (next[r]) next[r][c] = ""; });
        }
        return next;
      });

      const res = await clearIngredientData();
      setClearStatus(`✅ ${res.message || "Ingredient data cleared"}`);
      setDataVersion(v => v + 1);

      // Wait a bit longer for Google Sheets to sync before reloading
      setClearStatus(s => s + " (Syncing...)");
      await new Promise(r => setTimeout(r, 5000));
      await handleForceReload();
    } catch (e) {
      console.error(e);
      setClearStatus(`❌ Failed to clear ingredient data: ${e?.message || "Unknown error"}`);
    } finally {
      setClearingIngredient(false);
    }
  };

  // ✅ Clear Manual Entry Data (AY:BE columns, Row 11+)
  const handleClearManual = async () => {
    if (!client || !selectedDate || !mealType) {
      alert("Please select Client, Date and Meal first");
      return;
    }

    if (!confirm("Are you sure you want to clear all manual entry data (columns AY:BE)?")) {
      return;
    }

    setClearingManual(true);
    setClearStatus("");
    try {
      // Instant local clear for AY11:BE500 (Cols 50-56, Rows 10 onwards)
      setPmsData(prev => {
        const next = [...prev.map(r => [...r])];
        for (let r = 10; r < next.length; r++) {
          if (next[r]) {
            for (let c = 50; c <= 56; c++) next[r][c] = "";
          }
        }
        return next;
      });

      const res = await clearManualData();
      setClearStatus(`✅ ${res.message || "Manual entry data cleared"}`);
      setDataVersion(v => v + 1);

      // Wait a bit longer for Google Sheets to sync before reloading
      setClearStatus(s => s + " (Syncing...)");
      await new Promise(r => setTimeout(r, 5000));
      await handleForceReload();
    } catch (e) {
      console.error(e);
      setClearStatus(`❌ Failed to clear manual data: ${e?.message || "Unknown error"}`);
    } finally {
      setClearingManual(false);
    }
  };

  return (
    <div className="p-0 md:p-8 min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100">
      <div className="m-4 md:m-0 bg-gradient-to-r from-white to-indigo-50 rounded-3xl shadow-2xl p-6 md:p-10 mb-8 border-4 border-indigo-300">
        <h2 className="text-2xl md:text-3xl font-extrabold text-indigo-900 mb-6 text-center">📊 Select Filters</h2>
        <div className="flex flex-wrap items-end justify-center gap-6 md:gap-8">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm md:text-lg font-bold text-indigo-700 mb-2 uppercase tracking-wide">👤 Client</label>
            <select value={client} onChange={handleClientChange} className="w-full px-5 py-3 md:px-6 md:py-4 text-base md:text-xl font-semibold bg-white border-3 border-indigo-500 rounded-xl shadow-lg hover:shadow-2xl hover:border-indigo-600 outline-none">
              <option value="">Select Client</option>
              {clientOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm md:text-lg font-bold text-indigo-700 mb-2 uppercase tracking-wide">📅 Date</label>
            <select value={selectedDate} onChange={handleDateChange} className="w-full px-5 py-3 md:px-6 md:py-4 text-base md:text-xl font-semibold bg-white border-3 border-indigo-500 rounded-xl shadow-lg hover:shadow-2xl hover:border-indigo-600 outline-none">
              <option value="">Select Date</option>
              {dateOptions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm md:text-lg font-bold text-orange-700 mb-2 uppercase tracking-wide">🍽️ Meal Type</label>
            <select value={mealType} onChange={handleMealChange} className="w-full px-5 py-3 md:px-6 md:py-4 text-base md:text-xl font-semibold bg-white border-3 border-orange-500 rounded-xl shadow-lg hover:shadow-2xl hover:border-orange-600 outline-none">
              <option value="">Select Meal</option>
              {mealOptions.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2 w-full md:w-auto">
            <button onClick={handleForceReload} className="w-full md:w-auto px-6 py-3 md:px-16 md:py-5 bg-purple-800 text-white text-base md:text-2xl font-extrabold rounded-2xl md:rounded-3xl shadow-xl hover:bg-purple-900">RELOAD DATA</button>
            <button
              onClick={handlePasteWeight}
              disabled={weightPasting}
              className={`w-full md:w-auto px-6 py-3 md:px-16 md:py-5 text-white text-base md:text-2xl font-extrabold rounded-2xl md:rounded-3xl shadow-xl ${weightPasting ? "bg-green-500" : "bg-green-700 hover:bg-green-800"}`}
            >
              {weightPasting ? "UPDATING WEIGHT..." : "WEIGHT"}
            </button>
            <button
              onClick={handlePasteIngredient}
              disabled={ingredientPasting}
              className={`w-full md:w-auto px-8 py-4 text-white font-extrabold text-lg rounded-2xl md:rounded-3xl shadow-xl ${ingredientPasting ? "bg-orange-500" : "bg-orange-700 hover:bg-orange-800"
                }`}
            >
              {ingredientPasting ? "UPDATING INGREDIENT..." : "INGREDIENT"}
            </button>

            {/* Clear Buttons */}
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              <button
                onClick={handleClearWeight}
                disabled={clearingWeight}
                className={`flex-1 min-w-[120px] px-3 py-2 text-white font-bold text-xs rounded-xl shadow-md transition-all ${clearingWeight ? "bg-red-400" : "bg-red-600 hover:bg-red-700 active:scale-95"}`}
              >
                {clearingWeight ? "CLEARING..." : "CLEAR WEIGHT"}
              </button>
              <button
                onClick={handleClearIngredient}
                disabled={clearingIngredient}
                className={`flex-1 min-w-[120px] px-3 py-2 text-white font-bold text-sm rounded-xl shadow-md transition-all ${clearingIngredient ? "bg-red-400" : "bg-red-600 hover:bg-red-700 active:scale-95"}`}
              >
                {clearingIngredient ? "CLEARING..." : "CLEAR INGREDIENT"}
              </button>
              <button
                onClick={handleClearManual}
                disabled={clearingManual}
                className={`flex-1 min-w-[120px] px-3 py-2 text-white font-bold text-sm rounded-xl shadow-md transition-all ${clearingManual ? "bg-red-400" : "bg-red-600 hover:bg-red-700 active:scale-95"}`}
              >
                {clearingManual ? "CLEARING..." : "CLEAR DATA"}
              </button>
            </div>

            {autoSaving && <p className="text-center text-green-600 font-bold animate-pulse text-sm">💾 Saving...</p>}
            {weightStatus ? <p className="text-center font-bold text-sm">{weightStatus}</p> : null}
            {ingredientStatus ? <p className="text-center text-orange-700 font-bold text-sm mt-2">{ingredientStatus}</p> : null}
            {clearStatus ? <p className="text-center text-red-700 font-bold text-sm mt-2">{clearStatus}</p> : null}
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-4xl py-64">Loading...</p>
      ) : allMenus.length === 0 ? (
        <div className="text-center py-32 text-4xl">NO DATA FOUND</div>
      ) : (
        <>
          {allMenus.map((menu, menuIdx) => {
            const rowMap = new Map();
            menu.items.forEach((item, itemColIdx) => {
              item.ingredients.forEach(ing => {
                if (ing.actualCell) {
                  const r = ing.actualCell.rowIndex;
                  if (!rowMap.has(r)) rowMap.set(r, {});
                  rowMap.get(r)[itemColIdx] = ing;
                }
              });
            });
            const sortedRowIndices = Array.from(rowMap.keys()).sort((a, b) => a - b);
            return (
              <div key={menuIdx} className="bg-white md:rounded-3xl md:shadow-xl md:p-6 mb-12 border-b-4 md:border-4 border-indigo-200 overflow-x-auto w-full">
                <h1 className="text-xl md:text-3xl font-extrabold text-indigo-900 mb-4 md:mb-6 border-b-4 border-indigo-100 pb-4 sticky left-0 px-4 md:px-0">{menu.meal} • {menu.pax} Pax • {menu.date} • {menu.client}</h1>
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-indigo-600 text-white">
                      <th className="p-3 border bg-indigo-700 min-w-[50px]">#</th>
                      {menu.items.map((item, idx) => <th key={idx} colSpan={3} className="p-3 border border-indigo-500 text-center font-bold text-lg">{item.name}</th>)}
                    </tr>
                    <tr className="bg-indigo-50 text-indigo-900 font-semibold">
                      <th className="p-2 border bg-indigo-100">Row</th>
                      {menu.items.map((_, idx) => (
                        <React.Fragment key={idx}>
                          <th className="p-2 border min-w-[120px]">Item Name</th>
                          <th className="p-2 border w-24">Planned</th>
                          <th className="p-2 border w-32">Actual</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-yellow-50 font-bold border-b-4 border-indigo-100">
                      <td className="p-3 border text-center bg-yellow-100 text-yellow-800">TOTALS</td>
                      {menu.items.map((item, idx) => (
                        <React.Fragment key={idx}>
                          <td className="p-3 border text-center text-gray-500 italic">(Dish Total)</td>
                          <td className="p-3 border text-center text-indigo-700 text-lg">{item.planned} {item.unit}</td>
                          <td className="p-3 border text-center bg-white">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                key={`total-${dataVersion}-${item.actualCell?.rowIndex}-${item.actualCell?.colIndex}`}
                                type="number"
                                defaultValue={item.actual === 0 ? "" : item.actual}
                                onBlur={(e) => handleAutoSave(item.actualCell, e.target.value)}
                                className="w-20 p-1 border-2 border-yellow-300 rounded text-center bg-yellow-50 outline-none"
                              />
                              <span className="text-xs text-gray-400">{item.unit}</span>
                            </div>
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>
                    {sortedRowIndices.map((rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-gray-50 even:bg-gray-50">
                        <td className="p-2 border text-center text-xs text-gray-400 font-mono bg-white">{rowIndex + 1}</td>
                        {menu.items.map((item, itemIdx) => {
                          const ing = rowMap.get(rowIndex)[itemIdx];
                          if (!ing) return <React.Fragment key={itemIdx}><td className="border bg-gray-50/30"></td><td className="border bg-gray-50/30"></td><td className="border bg-gray-50/30"></td></React.Fragment>;
                          return (
                            <React.Fragment key={itemIdx}>
                              <td className="p-2 border font-medium text-gray-700">{ing.name}</td>
                              <td className="p-2 border text-center text-gray-600">{ing.planned} {ing.unit}</td>
                              <td className="p-2 border text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    key={`ing-${dataVersion}-${ing.actualCell?.rowIndex}-${ing.actualCell?.colIndex}`}
                                    type="number"
                                    defaultValue={ing.actual === 0 ? "" : ing.actual}
                                    onBlur={(e) => handleAutoSave(ing.actualCell, e.target.value)}
                                    className={`w-20 p-1 border rounded text-center outline-none ${ing.diff < 0 ? "border-red-300 bg-red-50 text-red-700" : ing.diff > 0 ? "border-green-300 bg-green-50 text-green-700" : "border-gray-300"}`}
                                  />
                                  {ing.unit && <span className="text-xs text-gray-400">{ing.unit}</span>}
                                </div>
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </>
      )}

      {/* ================= Manual Ingredient Entry (PMS AY:BE) ================= */}
      {!loading && client && selectedDate && mealType && (
        <div key={`manual-${dataVersion}`} className="mt-10 bg-white rounded-2xl shadow-xl p-6 border border-orange-200">
          <h2 className="text-2xl font-extrabold text-orange-700 mb-4">
            Manual Ingredient Entry (AY to BE)
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Fill items that are <b>not included in recipe</b> in these columns. Clicking <b>INGREDIENT</b> will append this data to the <b>ingredient</b> sheet.
          </p>

          <div className="overflow-auto">
            <table className="min-w-full border">
              <thead>
                <tr className="bg-orange-50">
                  <th className="p-2 border text-left">Row</th>
                  <th className="p-2 border text-left">Item Name (AY)</th>
                  <th className="p-2 border text-left">Planned (AZ)</th>
                  <th className="p-2 border text-left">Unit (BA)</th>
                  <th className="p-2 border text-left">Actual (BB)</th>
                  <th className="p-2 border text-left">Recipe (BC)</th>
                  <th className="p-2 border text-left">L1 (BD)</th>
                  <th className="p-2 border text-left">L2 (BE)</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 15 }).map((_, i) => {
                  const rowIndex = 10 + i; // PMS row 11 = index 10
                  const row = pmsData?.[rowIndex] || [];
                  const cols = [
                    { colIndex: 50 }, // AY
                    { colIndex: 51 }, // AZ
                    { colIndex: 52 }, // BA
                    { colIndex: 53 }, // BB
                    { colIndex: 54 }, // BC
                    { colIndex: 55 }, // BD
                    { colIndex: 56 }, // BE
                  ];

                  const saveManualCell = async (colIndex, value) => {
                    setAutoSaving(true);
                    try {
                      await updateCell("PMS", rowIndex, colIndex, value); // 0-based indices
                      setLastSaveStatus(`✅ Saved`);
                      // Update local cache so UI reflects instantly
                      setPmsData(prev => {
                        if (!prev || !Array.isArray(prev)) return prev;
                        const next = prev.map(r => (Array.isArray(r) ? [...r] : r));
                        if (!next[rowIndex]) next[rowIndex] = [];
                        next[rowIndex][colIndex] = value;
                        return next;
                      });
                    } catch (e) {
                      console.error(e);
                      setLastSaveStatus(`❌ Error`);
                    } finally {
                      setTimeout(() => setAutoSaving(false), 800);
                    }
                  };

                  return (
                    <tr key={rowIndex} className="hover:bg-orange-50/40">
                      <td className="p-2 border text-xs text-gray-500 font-mono bg-white">{rowIndex + 1}</td>
                      {cols.map((c, ci) => (
                        <td key={ci} className="p-2 border">
                          <input
                            key={`${dataVersion}-${rowIndex}-${c.colIndex}`}
                            className="w-full border rounded-lg px-2 py-1 text-sm"
                            defaultValue={row?.[c.colIndex] ?? ""}
                            onBlur={(e) => saveManualCell(c.colIndex, e.target.value)}
                            placeholder=""
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}