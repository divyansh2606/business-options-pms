// src/api/restaurantAPI2.js - Apps Script Method (with MENU options)

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwjGs5jBufTTxVftIRe6Qpx3m-5Ig4D8X06c5r73IKpqOHLI050T6HTV0vwBe_ix22G/exec";
async function fetchSheetData(sheetName) {
  try {
    const url = `${APPS_SCRIPT_URL}?action=fetch&sheet=${encodeURIComponent(sheetName)}&_t=${Date.now()}`;

    console.log(`📡 Fetching "${sheetName}" from Apps Script...`);

    const response = await fetch(url);

    if (!response.ok) {
      console.error(`❌ HTTP Error ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (data.error) {
      console.error(`❌ Apps Script Error: ${data.error}`);
      return [];
    }

    console.log(`✅ Received ${data.length} rows from "${sheetName}"`);
    return data;
  } catch (error) {
    console.error(`❌ Error fetching "${sheetName}":`, error);
    return [];
  }
}

// ----- PMS DATA (actual menu + items) -----
export const fetchPMSData = async () => {
  console.log("🔄 Fetching PMS Data via Apps Script...");
  const data = await fetchSheetData("PMS");
  console.log(`✅ TOTAL PMS ROWS: ${data.length}`);

  if (data.length > 50) {
    console.log("🔍 Sample row[50]:", data[50]);
  }

  return data;
};

// ----- RECIPE DATA -----
export const fetchRecipeData = async () => {
  console.log("🔄 Fetching Recipe Data...");
  return await fetchSheetData("P Vs A (Recipe)");
};

// ----- MENU OPTIONS -----
export const fetchMenuOptions = async () => {
  console.log("🔄 Fetching MENU (dropdown options)...");
  const rows = await fetchSheetData("MENU");

  const mealSet = new Set();
  const clientSet = new Set();
  const dateSet = new Set();

  rows.forEach((row, idx) => {
    if (!row || row.length === 0) return;

    const meal = row[0];
    const client = row[1];
    const date = row[2];

    if (meal && idx > 0) mealSet.add(meal.toString().trim());
    if (client && idx > 0) clientSet.add(client.toString().trim());
    if (date && idx > 0) dateSet.add(date.toString().trim());
  });

  const meals = Array.from(mealSet).filter(Boolean).sort();
  const clients = Array.from(clientSet).filter(Boolean).sort();
  const dates = Array.from(dateSet).filter(Boolean).sort();

  console.log("🍽️ MENU Meals:", meals);
  console.log("🏢 MENU Clients:", clients);
  console.log("📅 MENU Dates:", dates);

  return { meals, clients, dates };
};

// ----- EXISTING: batch cell updates (planned/actual etc.) -----
export const updatePMSCells = async (updates) => {
  try {
    const body = {
      sheet: "PMS",
      updates, // [ {rowIndex, colIndex, value}, ... ]
    };

    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    console.log("💾 updatePMSCells response:", data);
    return data;
  } catch (err) {
    console.error("❌ Error in updatePMSCells:", err);
    throw err;
  }
};

// ----- Helper: Convert cell reference like "B2" to {row: 1, col: 1} (0-indexed) -----
const cellRefToIndex = (cellRef) => {
  const match = cellRef.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;

  const colLetters = match[1];
  const rowNum = parseInt(match[2]);

  // Convert column letters to index (A=0, B=1, ..., Z=25, AA=26, etc.)
  let colIndex = 0;
  for (let i = 0; i < colLetters.length; i++) {
    colIndex = colIndex * 26 + (colLetters.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
  }
  colIndex--; // Make it 0-indexed

  return { rowIndex: rowNum - 1, colIndex }; // 0-indexed
};

// ----- NEW: dropdown control from frontend (uses GET to avoid CORS preflight) -----
export const updatePMSDropdown = async ({ sheet, dropdownCell, value }) => {
  try {
    // Convert cell reference to row/col indices
    const indices = cellRefToIndex(dropdownCell);
    if (!indices) {
      throw new Error(`Invalid cell reference: ${dropdownCell}`);
    }

    console.log(`🔁 Updating ${dropdownCell} (row:${indices.rowIndex}, col:${indices.colIndex}) to "${value}"`);

    // Use GET request with URL parameters to avoid CORS preflight
    const params = new URLSearchParams({
      action: 'update',
      sheet: sheet,
      row: indices.rowIndex.toString(), // 0-indexed, Apps Script adds +1
      col: indices.colIndex.toString(), // 0-indexed, Apps Script adds +1
      value: value,
      _t: Date.now() // Cache busting
    });

    const url = `${APPS_SCRIPT_URL}?${params.toString()}`;

    const res = await fetch(url, {
      method: "GET",
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    console.log("🔁 Dropdown update response:", data);

    if (data.error) {
      throw new Error(data.error);
    }

    return data;
  } catch (err) {
    console.error("❌ Error in updatePMSDropdown:", err);
    throw err;
  }
};

// ----- NEW: Direct Cell Update (for auto-save) -----
export const updateCell = async (sheet, rowIndex, colIndex, value) => {
  try {
    console.log(`🔁 Auto-Saving (row:${rowIndex}, col:${colIndex}) -> "${value}"`);

    // ✅ Fix: User reported +1 was "too low" (updating row below).
    // Reverting to rowIndex directly for row.
    const params = new URLSearchParams({
      action: 'update',
      sheet: sheet,
      row: rowIndex.toString(),
      col: colIndex.toString(), // Standard 0-indexed, Apps Script will add +1
      value: value
    });

    const url = `${APPS_SCRIPT_URL}?${params.toString()}`;

    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("❌ Error in updateCell:", err);
    throw err;
  }
};

// ============ NEW: DYNAMIC FILTERING APIs ============

// Get all clients dynamically from PMS sheet
export const fetchDynamicClients = async () => {
  try {
    const url = `${APPS_SCRIPT_URL}?action=getClients`;
    console.log("🔄 Fetching dynamic clients...");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ Dynamic clients:", data.clients);
    return data.clients || [];
  } catch (err) {
    console.error("❌ Error fetching dynamic clients:", err);
    return [];
  }
};

// Get dates for a specific client
export const fetchDynamicDates = async (client) => {
  try {
    const url = `${APPS_SCRIPT_URL}?action=getDates&client=${encodeURIComponent(client)}`;
    console.log(`🔄 Fetching dates for client: ${client}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Dates for ${client}:`, data.dates);
    return data.dates || [];
  } catch (err) {
    console.error("❌ Error fetching dynamic dates:", err);
    return [];
  }
};

// Get meals for a specific client and date
export const fetchDynamicMeals = async (client, date) => {
  try {
    const url = `${APPS_SCRIPT_URL}?action=getMeals&client=${encodeURIComponent(client)}&date=${encodeURIComponent(date)}`;
    console.log(`🔄 Fetching meals for ${client} on ${date}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Meals for ${client} on ${date}:`, data.meals);
    return data.meals || [];
  } catch (err) {
    console.error("❌ Error fetching dynamic meals:", err);
    return [];
  }
};

