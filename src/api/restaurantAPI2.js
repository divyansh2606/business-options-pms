// src/api/restaurantAPI2.js - Apps Script Method (with MENU options)

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwYKRNanvcuOShPYZvUgCUSU6xmOzMab-9TRzMKKksm0RG_NLp4dGDXkEPIEhnfkGy1/exec";
// ------- Lightweight localStorage cache helpers -------
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function getLocalCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    const ts = obj.ts || 0;
    const ttl = obj.ttl || CACHE_TTL_MS;
    if (Date.now() - ts > ttl) {
      localStorage.removeItem(key);
      return null;
    }
    return obj.value;
  } catch (e) {
    console.warn("Local cache read error:", e);
    return null;
  }
}

function setLocalCache(key, value, ttlMs = CACHE_TTL_MS) {
  try {
    const obj = { value, ts: Date.now(), ttl: ttlMs };
    localStorage.setItem(key, JSON.stringify(obj));
  } catch (e) {
    console.warn("Local cache write error:", e);
  }
}
async function fetchSheetData(sheetName) {
  try {
    const url = `${APPS_SCRIPT_URL}?action=fetch&sheet=${encodeURIComponent(sheetName)}&_t=${Date.now()}`;

    console.log(`📡 Fetching "${sheetName}" from Apps Script...`);
    console.log(`🌐 URL: ${url}`);

    const response = await fetch(url);

    console.log(`📊 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.error(`❌ HTTP Error ${response.status}: ${response.statusText}`);
      const text = await response.text();
      console.error(`❌ Response body:`, text);
      return [];
    }

    const data = await response.json();

    if (data.error) {
      console.error(`❌ Apps Script Error: ${data.error}`);
      if (data.stack) {
        console.error(`❌ Stack trace:`, data.stack);
      }
      return [];
    }

    console.log(`✅ Received ${data.length} rows from "${sheetName}"`);
    return data; // data IS the rows array

  } catch (error) {
    console.error(`❌ Error fetching "${sheetName}":`, error);
    console.error(`❌ Error details:`, error.message, error.stack);
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

    // Verify the actual value that was set
    if (data.updated && data.updated.actualValue) {
      const actualValue = data.updated.actualValue;
      const expectedValue = value?.toString().trim() || "";
      if (actualValue.toLowerCase() !== expectedValue.toLowerCase() && actualValue !== expectedValue) {
        console.warn(`⚠️ Value mismatch! Requested "${expectedValue}" but got "${actualValue}"`);
      } else {
        console.log(`✅ Value verified: "${actualValue}" matches requested "${expectedValue}"`);
      }
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
      value: value,
      guard: 'actualOnly'
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
    // Try local cache first for instant UX
    const cached = getLocalCache("clients_v1");
    if (cached && Array.isArray(cached) && cached.length > 0) {
      // Kick off background refresh without blocking UI
      (async () => {
        try {
          const url = `${APPS_SCRIPT_URL}?action=getClients&_t=${Date.now()}`;
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            if (data?.clients && Array.isArray(data.clients)) {
              setLocalCache("clients_v1", data.clients);
            }
          }
        } catch (e) {
          // ignore
        }
      })();
      return cached;
    }

    const url = `${APPS_SCRIPT_URL}?action=getClients`;
    console.log("🔄 Fetching dynamic clients...");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ Dynamic clients:", data.clients);
    if (data.clients && Array.isArray(data.clients)) {
      setLocalCache("clients_v1", data.clients);
    }
    return data.clients || [];
  } catch (err) {
    console.error("❌ Error fetching dynamic clients:", err);
    return [];
  }
};

// Get dates for a specific client
export const fetchDynamicDates = async (client) => {
  try {
    // Instant cached dates by client
    const cacheKey = `dates_${encodeURIComponent(client)}`;
    const cached = getLocalCache(cacheKey);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      // Background refresh
      (async () => {
        try {
          const url = `${APPS_SCRIPT_URL}?action=getDates&client=${encodeURIComponent(client)}&_t=${Date.now()}`;
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            if (data?.dates && Array.isArray(data.dates)) {
              setLocalCache(cacheKey, data.dates);
            }
          }
        } catch (e) { }
      })();
      return cached;
    }

    const url = `${APPS_SCRIPT_URL}?action=getDates&client=${encodeURIComponent(client)}`;
    console.log(`🔄 Fetching dates for client: ${client}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Dates for ${client}:`, data.dates);
    if (data.dates && Array.isArray(data.dates)) {
      setLocalCache(cacheKey, data.dates);
    }
    return data.dates || [];
  } catch (err) {
    console.error("❌ Error fetching dynamic dates:", err);
    return [];
  }
};

// Get meals for a specific client and date
export const fetchDynamicMeals = async (client, date) => {
  try {
    // Instant cached meals by client+date
    const cacheKey = `meals_${encodeURIComponent(client)}_${encodeURIComponent(date)}`;
    const cached = getLocalCache(cacheKey);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      // Background refresh
      (async () => {
        try {
          const url = `${APPS_SCRIPT_URL}?action=getMeals&client=${encodeURIComponent(client)}&date=${encodeURIComponent(date)}&_t=${Date.now()}`;
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            if (data?.meals && Array.isArray(data.meals)) {
              setLocalCache(cacheKey, data.meals);
            }
          }
        } catch (e) { }
      })();
      return cached;
    }

    const url = `${APPS_SCRIPT_URL}?action=getMeals&client=${encodeURIComponent(client)}&date=${encodeURIComponent(date)}`;
    console.log(`🔄 Fetching meals for ${client} on ${date}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Meals for ${client} on ${date}:`, data.meals);
    if (data.meals && Array.isArray(data.meals)) {
      setLocalCache(cacheKey, data.meals);
    }
    return data.meals || [];
  } catch (err) {
    console.error("❌ Error fetching dynamic meals:", err);
    return [];
  }
};


// ----- NEW: Set all three filters at once (server-side verification) -----
export const setFiltersAndVerify = async (client, date, meal) => {
  try {
    const params = new URLSearchParams({
      action: "setFilters",
      client: client || "",
      date: date || "",
      meal: meal || "",
      // fast: "true", // ❌ REMOVED: This was preventing sheet formulas from recalculating
      _t: Date.now().toString(),
    });

    const url = `${APPS_SCRIPT_URL}?${params.toString()}`;
    console.log("🛰️ Setting filters via Apps Script:", { client, date, meal });
    console.log("🌐 URL:", url);

    const res = await fetch(url, { method: "GET" });

    console.log(`📊 setFilters Response status: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ HTTP Error ${res.status}:`, errorText);
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }

    const data = await res.json();

    console.log("📦 setFilters Response data:", data);

    if (!data || data.success === false) {
      console.error("❌ setFilters failed:", data?.error || "Unknown error");
      throw new Error(data?.error || "setFilters failed");
    }

    console.log("🔎 Server verification:", data.verification);
    return data.verification;
  } catch (err) {
    console.error("❌ Error in setFiltersAndVerify:", err);
    console.error("❌ Error details:", err.message, err.stack);
    throw err;
  }
};


// ----- DIAGNOSTIC CHECK FUNCTION -----
export const fetchDiagnosticReport = async () => {
  try {
    const url = `${APPS_SCRIPT_URL}?action=diagnostic&_t=${Date.now()}`;
    console.log("🔍 Running diagnostic check...");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log("📊 Diagnostic Report:", data);
    return data;
  } catch (err) {
    console.error("❌ Error fetching diagnostic report:", err);
    throw err;
  }
};
