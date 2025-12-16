// DashboardSummary.jsx - Systematic PMS View (Meals → Dishes → Ingredients) + Save + Sheet Dropdown Control

import React, { useState, useEffect } from "react";
import {
  fetchPMSData, // Apps Script - triggers live sheet recalculation
  updatePMSDropdown,
  updateCell,
  fetchDynamicClients, // ✅ NEW: Dynamic filtering
  fetchDynamicDates,
  fetchDynamicMeals,
} from "../../api/restaurantAPI2";

// ----------------------- helpers -----------------------

// hamesha "dd-MMM-yyyy" return karega (e.g. 07-Dec-2025)
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

// PMS sheet ko parse karo and meals extract karo
const extractHeaderInfo = (row) => {
  if (!row) return null;

  // More robust keyword matching
  const mealRegex = /^(morning|breakfast|lunch|evening|evening snacks|dinner)/i;

  let meal = null,
    date = null,
    pax = null,
    client = null;

  row.forEach((cell) => {
    if (!cell) return;

    const str = cell.toString().trim();
    if (!str) return;

    // Check Meal
    if (!meal && mealRegex.test(str)) {
      meal = str; // Keep original casing/string
    }
    // Check Date
    else if (!date && !isNaN(new Date(str)) && str.length > 5 && str.includes("-")) {
      // Basic heuristic for date string like "07-Dec-2025" or "2025-12-07"
      date = formatDate(new Date(str));
    }
    // Check Pax (Number > 10)
    else if (!pax && !isNaN(str) && Number(str) > 10 && Number(str) < 50000) {
      pax = Number(str);
    }
    // Check Client (Not meal, not date, not number)
    else if (!client && !mealRegex.test(str) && str !== date && isNaN(str) && str.length > 2) {
      // Exclude common header keywords if any
      if (!["date", "pax", "party", "venue"].includes(str.toLowerCase())) {
        client = str;
      }
    }
  });

  if (!meal) return null;
  return { meal, date, pax, client };
};

const parsePMSSheet = (rows) => {
  const menus = [];
  console.log("🔍 Parsing PMS sheet, total rows:", rows.length);

  for (let i = 0; i < rows.length; i++) {
    const header = extractHeaderInfo(rows[i]);
    if (!header) continue;

    console.log("🎯 Meal header found at row", i, ":", header);

    // 1️⃣ Step 1: Identify "Main Dishes" (Columns)
    // SEARCH for the header row in the next few rows (i+1 to i+6)
    // It usually contains multiple text items like "Dal", "Paneer", "Item X"
    let itemsRow = null;
    let itemsRowIndex = -1;

    for (let offset = 1; offset <= 6; offset++) {
      const r = i + offset;
      if (r >= rows.length) break;
      const candidateRow = rows[r];
      if (!candidateRow) continue;

      // Check if this row looks like a header (has multiple text values)
      const textCount = candidateRow.filter(c =>
        c && c.toString().trim().length > 2 &&
        isNaN(Number(c)) &&
        c !== "#N/A" &&
        !["planned", "actual", "p", "a", "qty"].includes(c.toString().toLowerCase())
      ).length;

      // If we see at least 2 text columns, assume it's the dish header
      if (textCount >= 2) {
        itemsRow = candidateRow;
        itemsRowIndex = r;
        break;
      }
    }

    if (!itemsRow) {
      continue;
    }

    const dishHeaders = [];
    // ✅ User Requirement: "Row 2 has Item 1, Row 3 has Actual Name"
    // So if itemsRow is Row 2, we grab names from Row 3 (itemsRowIndex + 1)
    const namesRow = rows[itemsRowIndex + 1];

    itemsRow.forEach((cell, col) => {
      // We detect columns based on "Item 1", "Item 2" presence
      if (cell && cell.toString().trim() && cell !== "#N/A") {

        let dishName = cell.toString().trim(); // Default to "Item 1"

        // Try to grab the actual name from the row below
        if (namesRow && namesRow[col] && namesRow[col].toString().trim()) {
          dishName = namesRow[col].toString().trim();
        }

        dishHeaders.push({ col, name: dishName, ingredients: [] });
      }
    });

    if (!dishHeaders.length) continue;
    // console.log("🍛 Dish headers (Columns):", dishHeaders);

    // 2️⃣ Step 2: Grab "Dish Level" totals (Rows below item header)
    // We scan columns relative to dish.col to find numbers
    dishHeaders.forEach(dish => {
      // Look for values in cols [dish.col, dish.col+1, dish.col+2]
      // Often Name is at col, P at col+1, A at col+2.
      // But if headers are merged, P might be at col.

      // Scan a few rows BELOW the itemsRowIndex
      for (let r = itemsRowIndex + 1; r < itemsRowIndex + 5 && r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;

        // Check broad range to find "Dish Level" summary
        const pCell = row[dish.col + 1]; // Try col+1 first?
        const aCell = row[dish.col + 2];
        const pCellAlt = row[dish.col]; // Fallback

        if (isNumericCell(pCell) || isNumericCell(aCell)) {
          dish.planned = Number(pCell) || 0;
          dish.actual = Number(aCell) || 0;
          dish.actualCell = { rowIndex: r, colIndex: dish.col + 2 };
          dish.unit = row[dish.col + 3]?.toString().trim() || "";
          break;
        } else if (isNumericCell(pCellAlt)) {
          // Case where numbers start at dish.col
          dish.planned = Number(pCellAlt) || 0;
          dish.actual = Number(row[dish.col + 1]) || 0;
          dish.actualCell = { rowIndex: r, colIndex: dish.col + 1 };
          dish.unit = row[dish.col + 2]?.toString().trim() || "";
          break;
        }
      }
    });

    // 3️⃣ Step 3: Process "Ingredients" (Rows 8+)
    // Start significantly below items row to skip the "Planned/Actual" sub-headers
    const startRowIndex = itemsRowIndex + 5;

    for (let r = startRowIndex; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) break;

      // Stop if it looks like a new meal header
      // Using broad check to catch ANY generic keyword in first few cols
      // to avoid processing "Dinner" block as ingredients of "Lunch"
      const cell0 = row[0]?.toString().trim().toLowerCase();
      if (
        r > startRowIndex &&
        /^(morning|breakfast|lunch|evening|dinner)/i.test(cell0)
      ) {
        break;
      }

      // ✅ FIX: Look for Ingredient Data PER DISH (Locally)
      // Do NOT look for a single global "IngredientName" in Col A (unless it extends).
      // User Implies: Each Dish Block has its own ingredients logic.

      dishHeaders.forEach(dish => {
        // We need to find: Name, Planned, Actual, Unit for THIS dish in THIS row.
        // Heuristic: Name is usually the text string in the block.
        // Columns in block: [dish.col, dish.col+1, dish.col+2, dish.col+3]

        let localName = "";
        let pVal = 0, aVal = 0, uVal = "";
        let actCell = null;
        let foundData = false;

        // Try to identify structure in this block
        const c0 = row[dish.col];     // Candidate Name?
        const c1 = row[dish.col + 1]; // Candidate Planned?
        const c2 = row[dish.col + 2]; // Candidate Actual?
        const c3 = row[dish.col + 3]; // Candidate Unit?

        // Pattern 1: Name | Planned | Actual | Unit
        // Name must be string, P/A numeric
        if (c0 && isNaN(Number(c0)) && c0.toString().length > 1) {
          localName = c0.toString().trim();
          if (isNumericCell(c1) || isNumericCell(c2)) {
            pVal = Number(c1) || 0;
            aVal = Number(c2) || 0;
            uVal = c3?.toString().trim() || "";
            actCell = { rowIndex: r, colIndex: dish.col + 2 };
            foundData = true;
          }
        }
        // Pattern 2: Maybe Name is in previous column? (dish.col - 1)
        // If dish.col was derived from "Planned" column in header...
        else {
          const cPrev = row[dish.col - 1];
          if (cPrev && isNaN(Number(cPrev)) && cPrev.toString().length > 1) {
            localName = cPrev.toString().trim();
            // Then P is likely at c0 (dish.col)
            if (isNumericCell(c0) || isNumericCell(c1)) {
              pVal = Number(c0) || 0;
              aVal = Number(c1) || 0;
              uVal = c2?.toString().trim() || "";
              actCell = { rowIndex: r, colIndex: dish.col + 1 };
              foundData = true;
            }
          }
        }

        if (foundData && localName) {
          dish.ingredients.push({
            name: localName,
            planned: pVal,
            actual: aVal,
            unit: uVal,
            actualCell: actCell,
            diff: pVal - aVal
          });
        }
      });
    }

    // Transform dishHeaders back to our standard "items" format
    const items = dishHeaders.map(d => ({
      name: d.name,
      planned: d.planned || 0,
      actual: d.actual || 0,
      unit: d.unit || "",
      actualCell: d.actualCell,
      diff: (d.planned || 0) - (d.actual || 0),
      ingredients: d.ingredients
    }));

    menus.push({
      meal: header.meal,
      date: header.date,
      client: header.client,
      pax: header.pax,
      items,
    });
  }

  console.log("📊 FINAL MENUS COUNT:", menus.length);
  return menus;
};

// ----------------------- component -----------------------

export default function DashboardSummary() {
  const [allMenus, setAllMenus] = useState([]);
  const [client, setClient] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [mealType, setMealType] = useState(""); // ✅ DYNAMIC

  const [clientOptions, setClientOptions] = useState([]);
  const [dateOptions, setDateOptions] = useState([]);
  const [mealOptions, setMealOptions] = useState([]); // ✅ NEW: Dynamic meal options

  const [loading, setLoading] = useState(true);
  const [autoSaving, setAutoSaving] = useState(false);

  // ✅ Auto-refresh mechanism (Polling every 60s)
  useEffect(() => {
    const timer = setInterval(() => {
      console.log("⏰ Auto-refreshing data...");
      loadData(true); // pass true to indicate silent reload
    }, 60000); // 60 seconds

    return () => clearInterval(timer);
  }, []);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Fetch PMS data and ALL clients
      const [pmsRows, allClients] = await Promise.all([
        fetchPMSData(),
        fetchDynamicClients(),
      ]);

      let menus = parsePMSSheet(pmsRows);

      // 🔄 RETRY LOGIC: If no menus found, wait 1s and try again (Sheet might be updating)
      if (menus.length === 0) {
        console.log("⚠️ No data found immediately. Retrying in 1s...");
        await new Promise(r => setTimeout(r, 1000));
        const pmsRowsRetry = await fetchPMSData();
        menus = parsePMSSheet(pmsRowsRetry);
      }

      setAllMenus(menus);
      setClientOptions(allClients);

      // ✅ Check localStorage for saved selections
      const savedClient = localStorage.getItem('pms_selected_client');
      const savedDate = localStorage.getItem('pms_selected_date');
      const savedMeal = localStorage.getItem('pms_selected_meal');

      // --- INITIAL STATE SETUP ---
      let currentClient = client;
      if (allClients.length > 0 && !client) {
        currentClient = savedClient && allClients.includes(savedClient) ? savedClient : allClients[0];
        setClient(currentClient);

        // Fetch dates for default client
        const clientDates = await fetchDynamicDates(currentClient);
        setDateOptions(clientDates);

        if (clientDates.length > 0 && !selectedDate) {
          const defaultDate = savedDate && clientDates.includes(savedDate) ? savedDate : clientDates[0];
          setSelectedDate(defaultDate);

          const clientMeals = await fetchDynamicMeals(currentClient, defaultDate);
          setMealOptions(clientMeals);

          if (clientMeals.length > 0 && !mealType) {
            const defaultMeal = savedMeal && clientMeals.includes(savedMeal) ? savedMeal : clientMeals[0];
            setMealType(defaultMeal);
          }
        }
      }

      // 🚨 CLOSED SHEET FIX: Check for Data Mismatch
      // If we have menus, but they belong to a different client/date/meal than what we selected,
      // it means the sheet is stale (didn't update). We must force an update.
      if (menus.length > 0 && currentClient) {
        const sheetClient = menus[0].client; // Assuming single menu view
        // Note: formatted dates might differ slightly, checking Client mainly
        if (sheetClient && sheetClient.toLowerCase() !== currentClient.toLowerCase()) {
          console.warn(`⚠️ Data Mismatch! Sheet has "${sheetClient}", expected "${currentClient}". Forcing update...`);

          await updatePMSDropdown({ sheet: "PMS", dropdownCell: "Y1", value: currentClient });
          if (selectedDate) await updatePMSDropdown({ sheet: "PMS", dropdownCell: "M1", value: selectedDate });
          if (mealType) await updatePMSDropdown({ sheet: "PMS", dropdownCell: "B2", value: mealType });

          // Re-fetch after forced update
          await new Promise(r => setTimeout(r, 2000)); // Wait for sheet calc
          const freshRows = await fetchPMSData();
          setAllMenus(parsePMSSheet(freshRows));
        }
      }

      console.log("📅 Parsed menus count:", menus.length);
    } catch (err) {
      console.error("❌ Error loading PMS/Menu:", err);
    }
    if (!silent) setLoading(false);
  };

  // ✅ FORCE RELOAD: Updates Dropdowns + Fetches Data
  const handleForceReload = async () => {
    setLoading(true);
    try {
      console.log("🔄 Force Reloading: Syncing Dropdowns...");
      try {
        if (client) await updatePMSDropdown({ sheet: "PMS", dropdownCell: "A1", value: client });
        if (selectedDate) await updatePMSDropdown({ sheet: "PMS", dropdownCell: "M1", value: selectedDate });
        if (mealType) await updatePMSDropdown({ sheet: "PMS", dropdownCell: "Y1", value: mealType });
      } catch (updateErr) {
        console.warn("⚠️ Dropdown update failed, but proceeding to load data:", updateErr);
      }

      await loadData(true); // Load data (silent=true because we handle loading here)
    } catch (e) {
      console.error("Force reload failed", e);
    }
    setLoading(false);
  };


  useEffect(() => {
    // Initial load
    loadData();
  }, []);

  // ✅ Filter by all three: meal, date, client (Empty = All)
  const filteredMenus = allMenus.filter((m) => {
    const matchesMeal = !mealType || m.meal?.toLowerCase() === mealType?.toLowerCase();
    const matchesDate = !selectedDate || m.date === selectedDate;
    const matchesClient = !client || m.client?.toLowerCase() === client?.toLowerCase();

    return matchesMeal && matchesDate && matchesClient;
  });

  console.log(`💡 Filtered menus: ${filteredMenus.length} / ${allMenus.length}`);

  // 1️⃣ HANDLE MEAL CHANGE (Updates Sheet B2 & Reloads)
  const handleMealChange = async (e) => {
    const newVal = e.target.value;
    setMealType(newVal);
    localStorage.setItem('pms_selected_meal', newVal);

    if (newVal) {
      setLoading(true);
      try {
        await updatePMSDropdown({
          sheet: "PMS",
          dropdownCell: "Y1",
          value: newVal,
        });
        await loadData();
      } catch (err) {
        console.error("❌ Meal change failed:", err);
        setLoading(false);
      }
    }
  };

  // 2️⃣ HANDLE DATE CHANGE (Updates Sheet M1 & Reloads)
  const handleDateChange = async (e) => {
    const newVal = e.target.value;
    setSelectedDate(newVal);
    localStorage.setItem('pms_selected_date', newVal);

    if (newVal) {
      setLoading(true);
      try {
        await updatePMSDropdown({
          sheet: "PMS",
          dropdownCell: "M1",
          value: newVal
        });

        const pmsRows = await fetchPMSData();
        const menus = parsePMSSheet(pmsRows);
        setAllMenus(menus);

        const clientMeals = await fetchDynamicMeals(client, newVal);
        setMealOptions(clientMeals);

        if (clientMeals.length > 0) {
          // ✅ SMART LOGIC: Keep current meal if valid, else check storage, else use first
          let nextMeal = mealType;
          if (!clientMeals.includes(nextMeal)) {
            const savedMeal = localStorage.getItem('pms_selected_meal');
            nextMeal = savedMeal && clientMeals.includes(savedMeal) ? savedMeal : clientMeals[0];
          }

          setMealType(nextMeal);
          localStorage.setItem('pms_selected_meal', nextMeal); // Update storage with valid meal

          // Only update sheet if it changed
          if (nextMeal !== mealType) {
            await updatePMSDropdown({
              sheet: "PMS",
              dropdownCell: "B2",
              value: nextMeal
            });
          }
        }

        setLoading(false);
      } catch (err) {
        console.error("❌ Date change failed:", err);
        setLoading(false);
      }
    }
  };

  // 3️⃣ HANDLE CLIENT CHANGE (Updates Sheet Y1 & Reloads)
  const handleClientChange = async (e) => {
    const newVal = e.target.value;
    setClient(newVal);
    localStorage.setItem('pms_selected_client', newVal);

    if (newVal) {
      setLoading(true);
      try {
        await updatePMSDropdown({
          sheet: "PMS",
          dropdownCell: "A1",
          value: newVal
        });

        const pmsRows = await fetchPMSData();
        const menus = parsePMSSheet(pmsRows);
        setAllMenus(menus);

        const clientDates = await fetchDynamicDates(newVal);
        setDateOptions(clientDates);

        if (clientDates.length > 0) {
          // ✅ SMART LOGIC: Keep current date if valid, else check storage, else use first
          let nextDate = selectedDate;
          if (!clientDates.includes(nextDate)) {
            const savedDate = localStorage.getItem('pms_selected_date');
            nextDate = savedDate && clientDates.includes(savedDate) ? savedDate : clientDates[0];
          }

          setSelectedDate(nextDate);
          localStorage.setItem('pms_selected_date', nextDate);

          // Update date in sheet
          await updatePMSDropdown({
            sheet: "PMS",
            dropdownCell: "M1",
            value: nextDate
          });

          // Fetch meals for this client + date
          const clientMeals = await fetchDynamicMeals(newVal, nextDate);
          setMealOptions(clientMeals);

          if (clientMeals.length > 0) {
            // ✅ SMART LOGIC: Keep current meal if valid, else check storage, else use first
            let nextMeal = mealType;
            if (!clientMeals.includes(nextMeal)) {
              const savedMeal = localStorage.getItem('pms_selected_meal');
              nextMeal = savedMeal && clientMeals.includes(savedMeal) ? savedMeal : clientMeals[0];
            }

            setMealType(nextMeal);
            localStorage.setItem('pms_selected_meal', nextMeal);

            // Update meal in sheet
            await updatePMSDropdown({
              sheet: "PMS",
              dropdownCell: "B2",
              value: nextMeal
            });
          }
        }

        setLoading(false);
      } catch (err) {
        console.error("❌ Client change failed:", err);
        setLoading(false);
      }
    }
  };

  // 🔄 AUTO SAVE HANDLER
  const handleAutoSave = async (cellMeta, newValue) => {
    if (!cellMeta) return;

    try {
      setAutoSaving(true);
      const { rowIndex, colIndex } = cellMeta;

      console.log(`💾 Auto-saving cell R${rowIndex}C${colIndex} -> ${newValue}`);

      await updateCell("PMS", rowIndex, colIndex, newValue);

      setAutoSaving(false);
    } catch (e) {
      console.error("❌ Auto-save failed:", e);
      setAutoSaving(false);
      // alert("⚠️ Failed to save change. Please check connection.");
    }
  };

  return (
    // ✅ MOBILE: p-0 (Full Width), DESKTOP: p-8
    <div className="p-0 md:p-8 min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100">

      {/* Filters */}
      {/* ✅ MOBILE: m-4 (Card Look), DESKTOP: m-0 (Normal) */}
      <div className="m-4 md:m-0 bg-gradient-to-r from-white to-indigo-50 rounded-3xl shadow-2xl p-6 md:p-10 mb-8 border-4 border-indigo-300">
        <h2 className="text-2xl md:text-3xl font-extrabold text-indigo-900 mb-6 text-center">
          📊 Select Filters
        </h2>
        <div className="flex flex-wrap items-end justify-center gap-6 md:gap-8">

          {/* Client (First) */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm md:text-lg font-bold text-indigo-700 mb-2 uppercase tracking-wide">
              👤 Client
            </label>
            <select
              value={client}
              onChange={handleClientChange}
              className="w-full px-5 py-3 md:px-6 md:py-4 text-base md:text-xl font-semibold bg-white border-3 border-indigo-500 rounded-xl shadow-lg hover:shadow-2xl hover:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition-all duration-200 cursor-pointer"
            >
              {clientOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Date (Second - varies by client) */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm md:text-lg font-bold text-indigo-700 mb-2 uppercase tracking-wide">
              📅 Date
            </label>
            <select
              value={selectedDate}
              onChange={handleDateChange}
              className="w-full px-5 py-3 md:px-6 md:py-4 text-base md:text-xl font-semibold bg-white border-3 border-indigo-500 rounded-xl shadow-lg hover:shadow-2xl hover:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition-all duration-200 cursor-pointer"
            >
              {dateOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Meal Type (Third - varies by client) */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm md:text-lg font-bold text-orange-700 mb-2 uppercase tracking-wide">
              🍽️ Meal Type
            </label>
            <select
              value={mealType}
              onChange={handleMealChange}
              className="w-full px-5 py-3 md:px-6 md:py-4 text-base md:text-xl font-semibold bg-white border-3 border-orange-500 rounded-xl shadow-lg hover:shadow-2xl hover:border-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-300 transition-all duration-200 cursor-pointer"
            >
              {mealOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Reload / Status */}
          <div className="flex flex-col gap-2 w-full md:w-auto">
            <button
              onClick={handleForceReload}
              className="w-full md:w-auto px-6 py-3 md:px-16 md:py-5 bg-purple-800 text-white text-base md:text-2xl font-extrabold rounded-2xl md:rounded-3xl shadow-xl hover:bg-purple-900 transition-colors"
            >
              RELOAD DATA
            </button>
            {autoSaving && (
              <p className="text-center text-green-600 font-bold animate-pulse text-sm md:text-base">
                💾 Saving...
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Data */}
      {loading ? (
        <p className="text-center text-4xl py-64">Loading...</p>
      ) : filteredMenus.length === 0 ? (
        <p className="text-center text-4xl py-64">NO DATA FOUND</p>
      ) : (
        filteredMenus.map((menu, menuIdx) => {

          // 1️⃣ PREPARE MENU DATA FOR TABLE RENDER
          // We need to group ingredients by their original rowIndex to align them horizontally "like the sheet".

          // Collect all unique row indices from all ingredients across all items
          const rowMap = new Map();

          menu.items.forEach((item, itemColIdx) => {
            item.ingredients.forEach(ing => {
              if (!ing.actualCell) return;
              const r = ing.actualCell.rowIndex;

              if (!rowMap.has(r)) {
                rowMap.set(r, {});
              }
              // Map: RowIndex -> { [ItemIndex]: Ingredient }
              rowMap.get(r)[itemColIdx] = ing;
            });
          });

          // Sort rows by index to appear in order
          const sortedRowIndices = Array.from(rowMap.keys()).sort((a, b) => a - b);

          return (
            <div
              key={menuIdx}
              // ✅ MOBILE OPTIMIZED: Full width, no padding, no rounded corners on mobile
              // ✅ DESKTOP KEPT SAME: rounded-3xl, shadow-xl, p-6
              className="bg-white md:rounded-3xl md:shadow-xl md:p-6 mb-12 border-b-4 md:border-4 border-indigo-200 overflow-x-auto w-full"
            >
              <h1 className="text-xl md:text-3xl font-extrabold text-indigo-900 mb-4 md:mb-6 border-b-4 border-indigo-100 pb-4 sticky left-0 px-4 md:px-0">
                {menu.meal} • {menu.pax} Pax • {menu.date} • {menu.client}
              </h1>

              <table className="min-w-full border-collapse text-sm">
                <thead>
                  {/* Header Row 1: Dish Names */}
                  <tr className="bg-indigo-600 text-white">
                    <th className="p-3 border bg-indigo-700 min-w-[50px]">
                      #
                    </th>
                    {menu.items.map((item, idx) => (
                      <th
                        key={idx}
                        colSpan={3} // Name, Planned, Actual (Unit inside)
                        className="p-3 border border-indigo-500 text-center font-bold text-lg"
                      >
                        {item.name}
                      </th>
                    ))}
                  </tr>

                  {/* Header Row 2: Columns (Name, Planned, Actual) */}
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
                  {/* TOTALS ROW */}
                  <tr className="bg-yellow-50 font-bold border-b-4 border-indigo-100">
                    <td className="p-3 border text-center bg-yellow-100 text-yellow-800">
                      TOTALS
                    </td>
                    {menu.items.map((item, idx) => (
                      <React.Fragment key={idx}>
                        <td className="p-3 border text-center text-gray-500 italic">
                          (Dish Total)
                        </td>
                        <td className="p-3 border text-center text-indigo-700 text-lg">
                          {item.planned} {item.unit}
                        </td>
                        <td className="p-3 border text-center relative bg-white">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              defaultValue={item.actual === 0 ? "" : item.actual}
                              placeholder="0"
                              onBlur={(e) =>
                                handleAutoSave(item.actualCell, e.target.value)
                              }
                              className="w-20 p-1 border-2 border-yellow-300 rounded text-center bg-yellow-50 focus:bg-white focus:border-indigo-500 outline-none"
                            />
                            <span className="text-xs text-gray-400">{item.unit}</span>
                          </div>
                        </td>
                      </React.Fragment>
                    ))}
                  </tr>

                  {/* INGREDIENT ROWS */}
                  {sortedRowIndices.map((rowIndex, rIdx) => (
                    <tr key={rowIndex} className="hover:bg-gray-50 even:bg-gray-50">
                      <td className="p-2 border text-center text-xs text-gray-400 font-mono bg-white">
                        {rowIndex + 1}
                      </td>

                      {menu.items.map((item, itemIdx) => {
                        const ing = rowMap.get(rowIndex)[itemIdx];

                        if (!ing) {
                          // Empty cells for this dish in this row
                          return (
                            <React.Fragment key={itemIdx}>
                              <td className="border bg-gray-50/30"></td>
                              <td className="border bg-gray-50/30"></td>
                              <td className="border bg-gray-50/30"></td>
                            </React.Fragment>
                          );
                        }

                        return (
                          <React.Fragment key={itemIdx}>
                            <td className="p-2 border font-medium text-gray-700">
                              {ing.name}
                            </td>
                            <td className="p-2 border text-center text-gray-600">
                              {ing.planned} {ing.unit}
                            </td>
                            <td className="p-2 border text-center">
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  defaultValue={ing.actual === 0 ? "" : ing.actual}
                                  placeholder="0"
                                  onBlur={(e) =>
                                    handleAutoSave(ing.actualCell, e.target.value)
                                  }
                                  className={`w-20 p-1 border rounded text-center outline-none ${ing.diff < 0 ? "border-red-300 bg-red-50 text-red-700" :
                                    ing.diff > 0 ? "border-green-300 bg-green-50 text-green-700" :
                                      "border-gray-300"
                                    } focus:border-indigo-500 focus:bg-white focus:text-black transition-colors`}
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

              {menu.items.length === 0 && (
                <div className="p-8 text-center text-gray-400">
                  No dishes found for this menu.
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
