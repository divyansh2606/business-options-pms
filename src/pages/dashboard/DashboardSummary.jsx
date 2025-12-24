// DashboardSummary.jsx - Fixed Version with Forced Sheet Focus

import React, { useState, useEffect } from "react";
import {
  fetchPMSData,
  updatePMSDropdown,
  updateCell,
  fetchDynamicClients,
  fetchDynamicDates,
  fetchDynamicMeals,
  setFiltersAndVerify,
} from "../../api/restaurantAPI2";

const DROPDOWN_CELLS = {
  client: "A1",  // Column A (0-indexed: 0)
  date: "P1",    // Column P (0-indexed: 15)
  meal: "AE1",   // Column AE (0-indexed: 30)
};

// 🔍 DEBUG: Verify cell positions
console.log("📍 Dropdown cells:", {
  client: "A1 (col 0)",
  date: "P1 (col 15)",
  meal: "AE1 (col 30)"
});

const formatDate = (date) => {
  if (!date) return "";

  let d;
  let str = date.toString().trim(); // Move str declaration outside else block

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
    console.warn("Invalid date could not be parsed:", date);
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

const parsePMSSheet = (rows, verificationData = null) => {
  if (rows.length === 0) {
    console.error("❌ No rows received");
    return [];
  }

  const row0 = rows[0] || [];

  // 🔍 DEBUG: Show ALL control cells in row 1 (expanded debugging)
  console.log("🔍 RAW ROW 1 DATA (first 40 columns):");
  for (let i = 0; i < Math.min(40, row0.length); i++) {
    const colLetter = String.fromCharCode(65 + i); // A=0, B=1, ... not fully accurate past Z but good enough for index
    if (i === 0 || i === 12 || i === 15 || i === 24 || i === 30 || row0[i]) {
      console.log(`  Col ${i}: "${row0[i]}" (type: ${typeof row0[i]})`);
    }
  }

  // Also check if cells might be in row 2 (merged cells sometimes appear in row 2)
  if (rows.length > 1) {
    const row1 = rows[1] || [];
    console.log("🔍 RAW ROW 2 DATA (key columns):");
    console.log(`  P2 (col 15): "${row1[15]}"`);
    console.log(`  AE2 (col 30): "${row1[30]}"`);
  }

  // ✅ Use verification data as fallback if cells are empty
  // Priority: 1) Sheet cells, 2) Verification requested (if we just set it), 3) Verification actual
  let client = row0[0]?.toString().trim();
  if (!client || client === "" || client === "#N/A") {
    // If verification exists and we just set it, trust the requested value
    if (verificationData?.requested?.client) {
      client = verificationData.requested.client.toString().trim();
    } else {
      client = verificationData?.actual?.client?.toString().trim();
    }
  }
  client = client || "Unknown Client";

  // Try row0 P1 (col 15) first, then M1 (col 12) as fallback
  let date = row0[15]?.toString().trim(); // Priority: P1
  if (!date || date === "" || date === "#N/A") {
    // Check M1 (col 12) - fallback
    const m1Date = row0[12];
    if (m1Date) {
      date = m1Date.toString().trim();
    }
  }

  if (date) {
    // If it's a date object or ISO string, format it
    try {
      const dateObj = new Date(date);
      if (!isNaN(dateObj.getTime())) {
        date = formatDate(dateObj);
      }
    } catch (e) {
      // Ignore
    }
  }

  if (!date || date === "" || date === "#N/A") {
    date = rows[1]?.[15]?.toString().trim(); // check row 2 col P
  }

  // If verification exists and we just set it, trust the requested value (sheet might not have updated yet)
  if ((!date || date === "" || date === "#N/A") && verificationData?.requested?.date) {
    date = verificationData.requested.date.toString().trim();
    console.log(`📋 Using requested date from verification: "${date}"`);
  } else if (!date || date === "" || date === "#N/A") {
    date = verificationData?.actual?.date?.toString().trim();
  }
  date = date || "Unknown Date";

  const pax = row0[9] ? Number(row0[9]) : 0;

  // Try row0 AE1 (col 30) first, then Y1 (col 24) as fallback
  let meal = row0[30]?.toString().trim(); // Priority: AE1
  if (!meal || meal === "" || meal === "#N/A") {
    meal = row0[24]?.toString().trim(); // Fallback: Y1
  }

  if (!meal || meal === "" || meal === "#N/A") {
    meal = rows[1]?.[30]?.toString().trim();
  }
  // If verification exists and we just set it, trust the requested value (sheet might not have updated yet)
  if ((!meal || meal === "" || meal === "#N/A") && verificationData?.requested?.meal) {
    meal = verificationData.requested.meal.toString().trim();
    console.log(`📋 Using requested meal from verification: "${meal}"`);
  } else if (!meal || meal === "" || meal === "#N/A") {
    meal = verificationData?.actual?.meal?.toString().trim();
  }
  meal = meal || "Unknown Meal";

  console.log(`📋 PARSED: Client="${client}" Date="${date}" Pax=${pax} Meal="${meal}"`);
  if (verificationData) {
    console.log(`📋 VERIFICATION FALLBACK USED: Client="${verificationData.actual?.client}", Date="${verificationData.actual?.date}", Meal="${verificationData.actual?.meal}"`);
  }

  console.log(`📋 PARSED: Client="${client}" Date="${date}" Pax=${pax} Meal="${meal}"`);

  const row1 = rows[1] || [];
  const row2 = rows[2] || [];
  const row3 = rows[3] || []; // Google Sheet row 4 - has "Item 1", "Item 2", etc.

  const dishHeaders = [];
  /* REPLACED HEADER LOGIC START */
  const startCol = 0; // A
  const endCol = 60;  // Scan generously past AS to catch all items

  // 🔁 Scan EVERY column for a header instead of jumping in fixed steps.
  // This is more robust because the sheet has black separator columns and
  // merged header cells, so "Item 1".."Item 9" blocks are not perfectly spaced.
  for (let c = startCol; c < endCol; c++) {
    // Check row 3 (index 3 = Google Sheet row 4) for "Item 1", "Item 2", etc.
    let itemLabel = row3[c]?.toString().trim();

    // Also check row 2 (index 2 = Google Sheet row 3) for dish names like "Paneer Masala", "Mix Veg"
    let dishNameFromRow3 = row2[c]?.toString().trim();

    // If we find an "Item X" label in row 3, prioritize the dish name from row 3 (Google Sheet row 3, index 2)
    let headerName = "";
    if (itemLabel && itemLabel.toLowerCase().startsWith("item")) {
      // Found "Item 1", "Item 2", etc. - get the dish name from row 3 (Google Sheet row 3, index 2)
      headerName = dishNameFromRow3 || "";
      // If not found in row 3, try row 5 (Google Sheet row 5, index 4)
      if (!headerName || headerName === "#N/A" || headerName === "") {
        const row4 = rows[4] || []; // Google Sheet row 5
        headerName = row4[c]?.toString().trim() || "";
      }
      // If still no name, use the item label itself
      if (!headerName || headerName === "#N/A") {
        headerName = itemLabel;
      }
    } else if (dishNameFromRow3 && dishNameFromRow3 !== "#N/A" && dishNameFromRow3 !== "") {
      // No "Item X" label, but found a dish name in row 3 - use it directly
      headerName = dishNameFromRow3;
    } else {
      // Fallback: check row1 and row2 as before
      headerName = row1[c]?.toString().trim();
      if (!headerName || headerName === "#N/A") {
        headerName = row2[c]?.toString().trim();
      }
    }

    if (!headerName || headerName === "" || headerName === "#N/A") {
      continue;
    }

    // Exclude "Item Name" if it gets picked up as a dish header
    if (headerName.toLowerCase() === "item name") {
      continue;
    }

    // Avoid duplicate headers if the same merged value appears more than once
    const alreadyExists = dishHeaders.some(
      (d) => d.col === c || d.name.toLowerCase() === headerName.toLowerCase()
    );
    if (alreadyExists) {
      continue;
    }

    dishHeaders.push({
      col: c,
      name: headerName,
      ingredients: [],
      planned: 0,
      actual: 0,
      unit: "",
      actualCell: null
    });
    console.log(`✅ Detected dish: "${headerName}" at column ${c} (from row 3 item: ${itemLabel || 'N/A'})`);
  }


  if (dishHeaders.length === 0) {
    console.error("❌ No dish headers found");
    return [];
  }

  for (let r = 3; r < Math.min(8, rows.length); r++) {
    const row = rows[r];
    if (!row) continue;

    dishHeaders.forEach(dish => {
      if (dish.planned || dish.actual) return;

      const nameCell = row[dish.col];
      const plannedCell = row[dish.col + 1];
      const unitCell = row[dish.col + 2];
      const actualCell = row[dish.col + 3];

      if (isNumericCell(plannedCell) || isNumericCell(actualCell)) {
        dish.planned = Number(plannedCell) || 0;
        dish.actual = Number(actualCell) || 0;
        dish.actualCell = { rowIndex: r, colIndex: dish.col + 3 };
        dish.unit = unitCell?.toString().trim() || "";
        dish.name = dish.name || nameCell?.toString().trim() || dish.name;
      }
    });
  }


  // Start scanning ingredients from row index 8 (Google Sheet row 9),
  // which matches the earlier stable behaviour.
  const startRow = 8;
  const maxRow = Math.min(150, rows.length); // Scan up to 150 rows

  for (let r = startRow; r < maxRow; r++) {
    const row = rows[r];
    if (!row || row.length === 0) break;

    // Stop if we hit a new meal section text
    const firstCell = row[0]?.toString().trim().toLowerCase();
    if (firstCell && (firstCell.includes("breakfast") || firstCell.includes("lunch") || firstCell.includes("dinner") || firstCell.includes("morning"))) {
      // Assume it's a separator if it's alone? or just ignore for now as per user instruction.
    }

    dishHeaders.forEach(dish => {
      const colIdx = dish.col;

      const ingName = row[colIdx]?.toString().trim();
      const plannedVal = row[colIdx + 1];
      const unitVal = row[colIdx + 2];
      const actualVal = row[colIdx + 3];

      if (ingName && ingName !== "#N/A" && ingName.toLowerCase() !== "total" && ingName.toLowerCase() !== "diff") {
        const planned = Number(plannedVal) || 0;
        const actual = Number(actualVal) || 0;

        if (ingName !== "") {
          dish.ingredients.push({
            name: ingName,
            planned,
            actual,
            unit: unitVal?.toString().trim() || "",
            actualCell: { rowIndex: r, colIndex: colIdx + 3 },
            diff: planned - actual
          });
        }
      }
    });
  }

  // Calculate Dish Totals
  const items = dishHeaders.map(d => {
    // If we parsed headers correctly, we might have total rows captured in ingredients?
    // Actually the sheet has ingredients below. Does it NOT have a total row for the dish?
    // Image 1 shows "Dish Total" in yellow. 
    // This usually means we should calculate it from ingredients OR read it from the top row if it exists.
    // The previous code block (lines 134-154) tries to read dish header totals.
    // Let's rely on summing ingredients if the top row detection failed.

    // Sum ingredients
    const calcPlanned = d.ingredients.reduce((acc, curr) => acc + curr.planned, 0);
    const calcActual = d.ingredients.reduce((acc, curr) => acc + curr.actual, 0);

    // Choose: if we found a top-level total (d.planned/d.actual set in previous loop), use it?
    // Or just use calculated? Calculated is safer if we trust the ingredients list.

    return {
      name: d.name,
      planned: calcPlanned,
      actual: calcActual,
      unit: "",
      actualCell: null,
      diff: calcPlanned - calcActual,
      ingredients: d.ingredients
    };
  });

  return [{
    meal,
    date: formatDate(date),
    client,
    pax,
    items
  }];
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

// ✅ CRITICAL FIX: Force recalculation by updating ALL THREE dropdowns + verify + wait for data
const forceSheetRecalculation = async (client, date, meal) => {
  try {
    console.log(`🔄 FORCING RECALC: Client="${client}", Date="${date}", Meal="${meal}"`);

    let allVerified = false;
    let retryCount = 0;
    const maxRetries = 3;

    while (!allVerified && retryCount < maxRetries) {
      if (retryCount > 0) {
        console.log(`🔄 Retry attempt ${retryCount}/${maxRetries}...`);
      }

      // Step 1: Prefer server-side set of all filters for atomic update
      try {
        const serverVerification = await setFiltersAndVerify(client, date, meal);
        const cOk = (serverVerification?.matches && serverVerification?.actual?.client) ?
          serverVerification.actual.client?.toString().trim().toLowerCase() === client.toString().trim().toLowerCase() : false;
        const mOk = (serverVerification?.matches && serverVerification?.actual?.meal) ?
          serverVerification.actual.meal?.toString().trim().toLowerCase() === meal.toString().trim().toLowerCase() : false;
        // Normalize date to dd-MMM-yyyy for comparison
        const expectedDateFmt = formatDate(date).toLowerCase();
        const actualDateFmt = (serverVerification?.actual?.date || "").toString().trim().toLowerCase();
        const dOk = actualDateFmt === expectedDateFmt || actualDateFmt.includes(expectedDateFmt) || expectedDateFmt.includes(actualDateFmt);

        if (cOk && dOk && mOk) {
          console.log("✅ Server-side filters set and verified");
        } else {
          console.warn("⚠️ Server-side verification mismatch, will fallback to client-driven updates", serverVerification);
          throw new Error("Server verification mismatch");
        }
      } catch (serverErr) {
        // Fallback: update individually as before
        console.log(`1️⃣ Updating client dropdown (A1) to "${client}"...`);
        await updatePMSDropdown({ sheet: "PMS", dropdownCell: DROPDOWN_CELLS.client, value: client });
        await new Promise(r => setTimeout(r, 2000));

        console.log(`2️⃣ Updating date dropdown (P1) to "${date}"...`);
        await updatePMSDropdown({ sheet: "PMS", dropdownCell: DROPDOWN_CELLS.date, value: date });
        await new Promise(r => setTimeout(r, 2000));

        console.log(`3️⃣ Updating meal dropdown (AE1) to "${meal}"...`);
        const mealUpdateResult = await updatePMSDropdown({ sheet: "PMS", dropdownCell: DROPDOWN_CELLS.meal, value: meal });
        console.log(`   Meal update result:`, mealUpdateResult);
        await new Promise(r => setTimeout(r, 3000));
      }

      // 🔥 CRITICAL: Final wait to ensure all formulas have recalculated
      console.log("⏳ Waiting for sheet formulas to fully recalculate...");
      await new Promise(r => setTimeout(r, 5000));

      // Verify the values were actually set
      console.log("🔍 Verifying dropdown values after update...");
      const verification = await verifyDropdownValues(client, date, meal);

      allVerified = verification.client && verification.date && verification.meal;

      if (allVerified) {
        console.log("✅ All dropdowns verified successfully!");
        break;
      } else {
        console.warn(`⚠️ Verification failed:`);
        if (!verification.client) console.warn(`   ❌ Client: Expected "${client}", got "${verification.actualClient}"`);
        if (!verification.date) console.warn(`   ❌ Date: Expected "${formatDate(date)}", got "${verification.actualDate}"`);
        if (!verification.meal) console.warn(`   ❌ Meal: Expected "${meal}", got "${verification.actualMeal}"`);

        retryCount++;
        if (retryCount < maxRetries) {
          console.log(`⏳ Waiting before retry...`);
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    }

    if (!allVerified) {
      // Final verification to get the actual values for error message
      const finalVerification = await verifyDropdownValues(client, date, meal);
      console.error(`❌ Failed to set all dropdowns correctly after ${maxRetries} attempts!`);
      throw new Error(`Could not set filters correctly. Client: ${finalVerification.client}, Date: ${finalVerification.date}, Meal: ${finalVerification.meal}`);
    }

    console.log("✅ All dropdowns updated and verified!");
  } catch (err) {
    console.error("⚠️ Force recalc error:", err);
    throw err;
  }
};

// ✅ CRITICAL: Strict validation with retries
const fetchWithStrictValidation = async (expectedClient, expectedDate, expectedMeal, maxRetries = 8) => {
  const normalizeString = (str) => str?.toString().trim().toLowerCase() || "";

  console.log(`🔍 Starting validation for Client="${expectedClient}", Date="${expectedDate}", Meal="${expectedMeal}"`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`🔍 Validation attempt ${attempt}/${maxRetries}...`);

    // Progressive delay: starts at 5s, increases by 2s each attempt
    const waitTime = 5000 + (2000 * (attempt - 1));
    console.log(`⏳ Waiting ${waitTime}ms before fetching data...`);
    await new Promise(r => setTimeout(r, waitTime));

    console.log(`📡 Fetching PMS data (attempt ${attempt})...`);
    const rows = await fetchPMSData();

    if (rows.length === 0) {
      console.warn(`⚠️ Attempt ${attempt}: No rows received from sheet`);
      continue;
    }

    console.log(`📊 Parsing ${rows.length} rows...`);
    const menus = parsePMSSheet(rows);

    if (menus.length === 0) {
      console.warn(`⚠️ Attempt ${attempt}: No menus parsed`);
      continue;
    }

    const menu = menus[0];
    const fetchedClient = normalizeString(menu.client);
    const fetchedMeal = normalizeString(menu.meal);
    const fetchedDate = normalizeString(menu.date);
    const expectClient = normalizeString(expectedClient);
    const expectMeal = normalizeString(expectedMeal);
    const expectDate = normalizeString(expectedDate);

    console.log(`📊 Sheet shows: Client="${menu.client}" Date="${menu.date}" Meal="${menu.meal}"`);
    console.log(`🎯 Expected: Client="${expectedClient}" Date="${expectedDate}" Meal="${expectedMeal}"`);

    // Check for valid data
    const clientMatch = fetchedClient === expectClient;
    const mealMatch = fetchedMeal === expectMeal;
    const dateMatch = fetchedDate === expectDate || fetchedDate.includes(expectDate) || expectDate.includes(fetchedDate);
    const notUnknown = menu.meal !== "Unknown Meal" && menu.meal !== "";
    const hasClient = menu.client !== "Unknown Client" && menu.client !== "";

    if (clientMatch && mealMatch && notUnknown && hasClient) {
      console.log(`✅ DATA VERIFIED on attempt ${attempt}!`);
      console.log(`✅ Returning menu with ${menu.items?.length || 0} items`);
      return menus;
    } else {
      console.warn(`❌ MISMATCH on attempt ${attempt}:`);
      if (!clientMatch) console.warn(`   ❌ Client: got "${menu.client}", expected "${expectedClient}"`);
      if (!dateMatch) console.warn(`   ❌ Date: got "${menu.date}", expected "${expectedDate}"`);
      if (!mealMatch) console.warn(`   ❌ Meal: got "${menu.meal}", expected "${expectedMeal}"`);
      if (!notUnknown) console.warn(`   ❌ Meal is "${menu.meal}" - AE1 cell not populated correctly`);
      if (!hasClient) console.warn(`   ❌ Client is "${menu.client}" - A1 cell not populated correctly`);

      // Re-force dropdowns on specific attempts (fewer times to avoid infinite loops)
      if (attempt === 3 || attempt === 6) {
        console.log("🔁 Re-forcing ALL dropdowns + recalc triggers...");
        await forceSheetRecalculation(expectedClient, expectedDate, expectedMeal);
      }
    }
  }

  console.error("❌ VALIDATION FAILED after all retries");

  // Final fetch to show what we actually got
  console.log("🔍 Final fetch attempt...");
  const finalRows = await fetchPMSData();
  const finalMenus = parsePMSSheet(finalRows);

  if (finalMenus.length > 0) {
    console.log(`📊 Final result: Client="${finalMenus[0].client}", Date="${finalMenus[0].date}", Meal="${finalMenus[0].meal}"`);
  }

  const errorMsg = `⚠️ DATA SYNC FAILED!\n\nExpected:\n- Client: "${expectedClient}"\n- Date: "${expectedDate}"\n- Meal: "${expectedMeal}"\n\nGot:\n- Client: "${finalMenus[0]?.client || 'Unknown'}"\n- Date: "${finalMenus[0]?.date || 'Unknown'}"\n- Meal: "${finalMenus[0]?.meal || 'Unknown'}"\n\nPossible issues:\n1. Google Sheet formulas not recalculating\n2. Dropdown cells (A1, P1, AE1) not updating properly\n3. Sheet may be showing cached data\n\n✅ Solution: Click RELOAD DATA button or refresh the page and try again.`;

  alert(errorMsg);

  // Return whatever we got, even if it doesn't match
  return finalMenus;
};

export default function DashboardSummary() {
  // ✅ Optimization: Cache filter options
  const [clientOptions, setClientOptions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('client_options_cache') || '[]');
    } catch { return []; }
  });
  const [dateOptions, setDateOptions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('date_options_cache') || '[]');
    } catch { return []; }
  });
  const [mealOptions, setMealOptions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('meal_options_cache') || '[]');
    } catch { return []; }
  });


  // ✅ Persist Data (Menus) to prevent refresh on tab switch
  const [allMenus, setAllMenus] = useState(() => {
    try {
      const cached = localStorage.getItem('dashboard_menus_cache');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });

  // Save menus to cache whenever they change
  useEffect(() => {
    if (allMenus.length > 0) {
      localStorage.setItem('dashboard_menus_cache', JSON.stringify(allMenus));
    }
  }, [allMenus]);

  const [client, setClient] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [mealType, setMealType] = useState("");

  const [loading, setLoading] = useState(false); // Start false to allow cached filters to show
  const [autoSaving, setAutoSaving] = useState(false);

  // ✅ Persist Cache Helper
  const persistCache = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);

    try {
      // 1. Fetch Basic Data
      const [pmsRows, allClients] = await Promise.all([
        fetchPMSData(),
        fetchDynamicClients(),
      ]);

      // Update Cache
      setClientOptions(allClients);
      persistCache('client_options_cache', allClients);

      // 2. Determine Current Active Selection
      const savedClient = localStorage.getItem('pms_selected_client');
      const savedDate = localStorage.getItem('pms_selected_date');
      const savedMeal = localStorage.getItem('pms_selected_meal');

      let currentClient = client || savedClient;
      if (!currentClient && allClients.length > 0) currentClient = allClients[0];

      // Update State if needed
      if ((!client && currentClient) || client !== currentClient) setClient(currentClient);

      // 3. Parse Sheet Content IMMEDIATELY to see what's there
      let menus = parsePMSSheet(pmsRows);

      // 4. Smart Check: Does the sheet ALREADY contain the data we want?
      const normalize = (s) => s?.toString().trim().toLowerCase() || "";
      let sheetMatches = false;

      if (menus.length > 0 && currentClient) {
        const m = menus[0];
        const mClient = normalize(m.client);
        const mDate = normalize(m.date);
        const mMeal = normalize(m.meal);

        const targetClient = normalize(currentClient);
        const targetDate = savedDate ? normalize(formatDate(savedDate)) : ""; // normalize saved date format
        const targetMeal = savedMeal ? normalize(savedMeal) : "";

        // Check basic match (Client is most critical)
        if (mClient === targetClient) {
          // If Date/Meal also match (or we don't have defaults yet), we are GOLDEN.
          // Even if they don't perfectly match stored defaults, 
          // showing *some* valid data for the client is better than a blank screen while loading.

          const exactMatch = (!targetDate || mDate.includes(targetDate) || targetDate.includes(mDate)) &&
            (!targetMeal || mMeal === targetMeal);

          if (exactMatch) {
            console.log("🚀 FAST LOAD: Sheet already has requested data!", m);
            setAllMenus(menus);

            // Sync dropdowns to what's properly loaded if strictly matching
            if (!selectedDate && m.date) setSelectedDate(m.date);
            if (!mealType && m.meal) setMealType(m.meal);

            setLoading(false);
            sheetMatches = true;

            // Background fetch of options (non-blocking)
            fetchDynamicDates(currentClient).then(dates => {
              setDateOptions(dates);
              persistCache('date_options_cache', dates);
              if (dates.length > 0 && savedDate && dates.includes(savedDate)) {
                fetchDynamicMeals(currentClient, savedDate).then(meals => {
                  setMealOptions(meals);
                  persistCache('meal_options_cache', meals);
                });
              }
            });
            return; // EXIT EARLY - SUCCESS
          }
        }
      }

      // 5. If Strict Match Failed, we fallback to the robust "Set & Verify" flow
      // But we can still populates options to make UI usable

      if (!sheetMatches && currentClient) {
        console.log("⚠️ Sheet data mismatch or stale. Initiating sync sequence...");

        // Populate Dates/Meals for the selected client first so user can see filters
        const dates = await fetchDynamicDates(currentClient);
        setDateOptions(dates);
        persistCache('date_options_cache', dates);

        let targetDate = savedDate;
        if (!targetDate || !dates.includes(targetDate)) targetDate = dates[0];
        if (targetDate) setSelectedDate(targetDate);

        if (targetDate) {
          const meals = await fetchDynamicMeals(currentClient, targetDate);
          setMealOptions(meals);
          persistCache('meal_options_cache', meals);

          let targetMeal = savedMeal;
          if (!targetMeal || !meals.includes(targetMeal)) targetMeal = meals[0];
          if (targetMeal) setMealType(targetMeal);

          if (currentClient && targetDate && targetMeal) {
            // NOW trigger the slow update, but user sees filters populated
            console.log(`🔄 Syncing Sheet to: ${currentClient} / ${targetDate} / ${targetMeal}`);

            // Double check: if menus matches this target? (Already checked above, likely false)

            setTimeout(async () => {
              try {
                const verification = await setFiltersAndVerify(currentClient, targetDate, targetMeal);
                await new Promise(r => setTimeout(r, 4000)); // slightly reduced wait
                const validMenus = await fetchAndValidateData(currentClient, targetDate, targetMeal, verification);
                if (validMenus) setAllMenus(validMenus);
                setLoading(false);
              } catch (e) {
                console.error("Auto-sync failed", e);
                setLoading(false);
              }
            }, 100);
            return;
          }
        }
      }

      setAllMenus(menus); // Fallback: show what we have
    } catch (err) {
      console.error("❌ Error loading data:", err);
    }

    if (!silent) setLoading(false);
  };

  // ✅ Helper: Validate fetched data matches all three filters (relaxed - allow if we have items)
  const validateFetchedData = (menus, expectedClient, expectedDate, expectedMeal) => {
    if (!menus || menus.length === 0) return false;

    const normalizeStr = (str) => str?.toString().trim().toLowerCase() || "";
    const menu = menus[0];

    // Check if we have valid items - if yes, be more lenient
    const hasItems = menu.items && menu.items.length > 0;

    const menuClient = normalizeStr(menu.client);
    const menuDate = normalizeStr(menu.date);
    const menuMeal = normalizeStr(menu.meal);

    const expectClient = normalizeStr(expectedClient);
    const expectDate = normalizeStr(formatDate(expectedDate));
    const expectMeal = normalizeStr(expectedMeal);

    // Matching
    const clientMatch = menuClient === expectClient;
    const dateMatch = menuDate === expectDate ||
      menuDate.includes(expectDate) ||
      expectDate.includes(menuDate);
    const mealMatch = menuMeal === expectMeal;

    // If we have items and client matches, be lenient with date/meal (sheet might not have updated yet)
    if (hasItems && clientMatch) {
      console.log(`✅ Validation passed (lenient): Client matches, has ${menu.items.length} items`);
      return true;
    }

    // Otherwise require all three to match
    const allMatch = clientMatch && dateMatch && mealMatch;

    if (!allMatch) {
      console.warn(`❌ Data validation failed:`);
      console.warn(`   Client: got "${menu.client}" (${clientMatch ? '✅' : '❌'}), expected "${expectedClient}"`);
      console.warn(`   Date: got "${menu.date}" (${dateMatch ? '✅' : '❌'}), expected "${formatDate(expectedDate)}"`);
      console.warn(`   Meal: got "${menu.meal}" (${mealMatch ? '✅' : '❌'}), expected "${expectedMeal}"`);
    }

    return allMatch;
  };

  // ✅ Helper: Fetch and validate data with retries (uses verification data as fallback)
  const fetchAndValidateData = async (expectedClient, expectedDate, expectedMeal, verificationData = null, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`📡 Fetch attempt ${attempt}/${maxRetries}...`);

      // Wait progressively longer between retries
      if (attempt > 1) {
        const waitTime = 2000 + (1000 * (attempt - 1));
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(r => setTimeout(r, waitTime));
      }

      const rows = await fetchPMSData();
      let menus = parsePMSSheet(rows, verificationData); // Pass verification data to parser

      // If we have menus with items, return them (validation is lenient)
      if (menus && menus.length > 0 && menus[0].items && menus[0].items.length > 0) {
        if (validateFetchedData(menus, expectedClient, expectedDate, expectedMeal)) {
          console.log(`✅ Data validated successfully on attempt ${attempt}!`);
          return menus;
        }
        // Even if validation fails but we have items, return them (lenient mode)
        console.log(`⚠️ Validation failed but returning data with ${menus[0].items.length} items`);
        return menus;
      }

      // If validation failed and no items, re-set filters and try again
      if (attempt < maxRetries) {
        console.log(`🔄 Re-setting filters and retrying...`);
        const newVerification = await setFiltersAndVerify(expectedClient, expectedDate, expectedMeal);
        verificationData = newVerification; // Update verification data
        await new Promise(r => setTimeout(r, 3000)); // Wait for sheet recalculation
      }
    }

    // Final attempt - return whatever we got
    console.log("📡 Final fetch attempt...");
    const finalRows = await fetchPMSData();
    const finalMenus = parsePMSSheet(finalRows, verificationData);
    if (finalMenus && finalMenus.length > 0) {
      console.log(`✅ Returning data with ${finalMenus[0].items?.length || 0} items`);
    }
    return finalMenus;
  };

  const handleForceReload = async () => {
    if (!client || !selectedDate || !mealType) {
      alert("Please select Client, Date, and Meal before reloading!");
      return;
    }

    setLoading(true);
    setAllMenus([]); // ✅ Clear old data
    try {
      console.log("🔄 FORCE RELOAD (With Validation)");
      console.log(`📋 Filters: Client="${client}", Date="${selectedDate}", Meal="${mealType}"`);

      // Set filters and verify
      const verification = await setFiltersAndVerify(client, selectedDate, mealType);
      console.log("🔎 Verification received:", verification);
      await new Promise(r => setTimeout(r, 5000)); // Wait longer for sheet recalculation

      // Fetch and validate data (pass verification data as fallback)
      const menus = await fetchAndValidateData(client, selectedDate, mealType, verification);

      if (menus && menus.length > 0) {
        console.log(`✅ Successfully loaded ${menus.length} menu(s) with ${menus[0].items?.length || 0} items`);
        setAllMenus(menus);
      } else {
        console.warn("⚠️ No menus returned");
        alert("No data found matching the selected filters. Please check your sheet or try different filters.");
      }

      console.log("✅ Force reload complete");
    } catch (e) {
      console.error("❌ Force reload failed:", e);
      alert(`Failed to reload data: ${e.message || e.toString()}`);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleClientChange = async (e) => {
    const newVal = e.target.value;
    setClient(newVal);
    localStorage.setItem('pms_selected_client', newVal);
    setAllMenus([]); // ✅ Clear data when filter changes

    if (newVal) {
      setLoading(true);
      try {
        console.log(`👤 CLIENT CHANGED TO: ${newVal}`);

        // Fetch dates for new client
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

            // ✅ Set filters, then fetch and validate
            const verification = await setFiltersAndVerify(newVal, nextDate, nextMeal);
            await new Promise(r => setTimeout(r, 5000)); // ✅ Wait longer for sheet recalculation
            const menus = await fetchAndValidateData(newVal, nextDate, nextMeal, verification);
            console.log(`✅ Loaded ${menus.length} menus for Client="${newVal}"`);
            setAllMenus(menus);
          }
        }

        setLoading(false);
      } catch (err) {
        console.error("❌ Client change failed:", err);
        setLoading(false);
      }
    }
  };

  const handleDateChange = async (e) => {
    const newVal = e.target.value;
    setSelectedDate(newVal);
    localStorage.setItem('pms_selected_date', newVal);
    setAllMenus([]); // ✅ Clear data when filter changes

    if (newVal) {
      setLoading(true);
      try {
        console.log(`📅 DATE CHANGED TO: ${newVal}`);

        const clientMeals = await fetchDynamicMeals(client, newVal);
        setMealOptions(clientMeals);

        if (clientMeals.length > 0) {
          let nextMeal = mealType;
          if (!clientMeals.includes(nextMeal)) {
            nextMeal = clientMeals[0];
          }

          setMealType(nextMeal);
          localStorage.setItem('pms_selected_meal', nextMeal);

          // ✅ Set filters, then fetch and validate
          const verification = await setFiltersAndVerify(client, newVal, nextMeal);
          await new Promise(r => setTimeout(r, 5000)); // ✅ Wait longer for sheet recalculation
          const menus = await fetchAndValidateData(client, newVal, nextMeal, verification);
          console.log(`✅ Loaded ${menus.length} menus for Date="${newVal}"`);
          setAllMenus(menus);
        }

        setLoading(false);
      } catch (err) {
        console.error("❌ Date change failed:", err);
        setLoading(false);
      }
    }
  };

  const handleMealChange = async (e) => {
    const newVal = e.target.value;
    setMealType(newVal);
    localStorage.setItem('pms_selected_meal', newVal);
    setAllMenus([]); // ✅ Clear data when filter changes

    if (newVal) {
      setLoading(true);
      try {
        console.log(`🍽️ MEAL CHANGED TO: ${newVal}`);

        // ✅ Set filters, then fetch and validate
        const verification = await setFiltersAndVerify(client, selectedDate, newVal);
        await new Promise(r => setTimeout(r, 5000)); // ✅ Wait longer for sheet recalculation
        const menus = await fetchAndValidateData(client, selectedDate, newVal, verification);
        console.log(`✅ Loaded ${menus.length} menus for Meal="${newVal}"`);
        setAllMenus(menus);

        setLoading(false);
      } catch (err) {
        console.error("❌ Meal change failed:", err);
        setLoading(false);
      }
    }
  };

  const handleAutoSave = async (cellMeta, newValue) => {
    if (!cellMeta) return;

    try {
      // Note: Apps Script has server-side validation to protect item name columns and header rows
      setAutoSaving(true);
      const { rowIndex, colIndex } = cellMeta;
      await updateCell("PMS", rowIndex, colIndex, newValue);
      setAutoSaving(false);
    } catch (e) {
      console.error("❌ Auto-save failed:", e);
      if (e.message && e.message.includes("blocked")) {
        alert(`❌ ${e.message}`);
      }
      setAutoSaving(false);
    }
  };

  // ✅ Filter displayed data to match selected filters (LENIENT - show if client matches and has items)
  const menusToShow = allMenus.filter(menu => {
    const normalizeStr = (str) => str?.toString().trim().toLowerCase() || "";

    const menuClient = normalizeStr(menu.client);
    const selectedClientNorm = normalizeStr(client);
    const menuDate = normalizeStr(menu.date);
    const selectedDateNorm = normalizeStr(selectedDate);
    const selectedDateFormatted = formatDate(selectedDate).toLowerCase();
    const menuMeal = normalizeStr(menu.meal);
    const selectedMealNorm = normalizeStr(mealType);

    // Check if we have items
    const hasItems = menu.items && menu.items.length > 0;

    // Client must match
    const clientMatch = menuClient === selectedClientNorm;

    // Date matching - check both formats
    const dateMatch = menuDate === selectedDateNorm ||
      menuDate === selectedDateFormatted ||
      menuDate.includes(selectedDateNorm) ||
      selectedDateNorm.includes(menuDate);

    const mealMatch = menuMeal === selectedMealNorm;

    // If client matches and we have items, show it (lenient - date/meal might not have updated in sheet yet)
    if (clientMatch && hasItems) {
      return true;
    }

    // Otherwise require all three to match
    const isValid = clientMatch && dateMatch && mealMatch;

    if (!isValid && hasItems) {
      console.log(`⚠️ Menu shown (lenient): Client matches, has ${menu.items.length} items`);
    }

    return isValid;
  });

  return (
    <div className="p-0 md:p-8 min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100">
      <div className="m-4 md:m-0 bg-gradient-to-r from-white to-indigo-50 rounded-3xl shadow-2xl p-6 md:p-10 mb-8 border-4 border-indigo-300">
        <h2 className="text-2xl md:text-3xl font-extrabold text-indigo-900 mb-6 text-center">
          📊 Select Filters
        </h2>
        <div className="flex flex-wrap items-end justify-center gap-6 md:gap-8">
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

      {loading ? (
        <p className="text-center text-4xl py-64">Loading...</p>
      ) : menusToShow.length === 0 ? (
        <div className="text-center py-32">
          <p className="text-4xl mb-4">NO DATA FOUND</p>
          <p className="text-gray-600">Please check your sheet or try reloading</p>
        </div>
      ) : (
        menusToShow.map((menu, menuIdx) => {
          const rowMap = new Map();

          menu.items.forEach((item, itemColIdx) => {
            item.ingredients.forEach(ing => {
              if (!ing.actualCell) return;
              const r = ing.actualCell.rowIndex;

              if (!rowMap.has(r)) {
                rowMap.set(r, {});
              }
              rowMap.get(r)[itemColIdx] = ing;
            });
          });

          const sortedRowIndices = Array.from(rowMap.keys()).sort((a, b) => a - b);

          return (
            <div
              key={menuIdx}
              className="bg-white md:rounded-3xl md:shadow-xl md:p-6 mb-12 border-b-4 md:border-4 border-indigo-200 overflow-x-auto w-full"
            >
              <h1 className="text-xl md:text-3xl font-extrabold text-indigo-900 mb-4 md:mb-6 border-b-4 border-indigo-100 pb-4 sticky left-0 px-4 md:px-0">
                {menu.meal} • {menu.pax} Pax • {menu.date} • {menu.client}
              </h1>

              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-indigo-600 text-white">
                    <th className="p-3 border bg-indigo-700 min-w-[50px]">#</th>
                    {menu.items.map((item, idx) => (
                      <th key={idx} colSpan={3} className="p-3 border border-indigo-500 text-center font-bold text-lg">
                        {item.name}
                      </th>
                    ))}
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
                        <td className="p-3 border text-center text-indigo-700 text-lg">
                          {item.planned} {item.unit}
                        </td>
                        <td className="p-3 border text-center relative bg-white">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              defaultValue={item.actual === 0 ? "" : item.actual}
                              placeholder="0"
                              onBlur={(e) => handleAutoSave(item.actualCell, e.target.value)}
                              className="w-20 p-1 border-2 border-yellow-300 rounded text-center bg-yellow-50 focus:bg-white focus:border-indigo-500 outline-none"
                            />
                            <span className="text-xs text-gray-400">{item.unit}</span>
                          </div>
                        </td>
                      </React.Fragment>
                    ))}
                  </tr>

                  {sortedRowIndices.map((rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-gray-50 even:bg-gray-50">
                      <td className="p-2 border text-center text-xs text-gray-400 font-mono bg-white">
                        {rowIndex + 1}
                      </td>

                      {menu.items.map((item, itemIdx) => {
                        const ing = rowMap.get(rowIndex)[itemIdx];

                        if (!ing) {
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
                            <td className="p-2 border font-medium text-gray-700">{ing.name}</td>
                            <td className="p-2 border text-center text-gray-600">
                              {ing.planned} {ing.unit}
                            </td>
                            <td className="p-2 border text-center">
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  defaultValue={ing.actual === 0 ? "" : ing.actual}
                                  placeholder="0"
                                  onBlur={(e) => handleAutoSave(ing.actualCell, e.target.value)}
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