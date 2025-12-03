// src/api/restaurantAPI2.js - Apps Script Method (with MENU options + WRITE support)
// NOTE:
//  - "PMS" sheet => actual data (meal blocks + items)
//  - "MENU" sheet => dropdown master values (Clients / Dates etc.)
//  - JSON POST -> doPost -> handleJsonUpdate (Apps Script)

// Web App URL (Apps Script deployment)
const APPS_SCRIPT_URL ="https://script.google.com/macros/s/AKfycbypM0CI6PA5ycn7TummTWIxwCXfkC6J33QYqowmR1qXJIqXcbPrV25zddzCanAOZb97/exec";
// -------------------- COMMON FETCH HELPER (GET) --------------------

async function fetchSheetData(sheetName) {
  try {
    const url = `${APPS_SCRIPT_URL}?sheet=${encodeURIComponent(sheetName)}`;

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

// -------------------- PMS DATA (READ) --------------------

export const fetchPMSData = async () => {
  console.log("🔄 Fetching PMS Data via Apps Script...");
  const data = await fetchSheetData("PMS");
  console.log(`✅ TOTAL PMS ROWS: ${data.length}`);

  // Optional debug
  if (data.length > 50) {
    console.log("🔍 Sample row[50]:", data[50]);
  }

  return data;
};

// -------------------- RECIPE DATA (READ) --------------------

export const fetchRecipeData = async () => {
  console.log("🔄 Fetching Recipe Data...");
  return await fetchSheetData("P Vs A (Recipe)");
};

// -------------------- MENU OPTIONS (READ) --------------------
// Assumption: "MENU" sheet me columns something like:
// Row 1: headers
// Col A: Meal names   (Breakfast, Lunch, Dinner...)   [optional]
// Col B: Client names (Millennium, Cipla, ...)        [used]
// Col C: Dates / other options                        [used]

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

    // idx > 0 => header row skip
    if (meal && idx > 0) {
      mealSet.add(meal.toString().trim());
    }
    if (client && idx > 0) {
      clientSet.add(client.toString().trim());
    }
    if (date && idx > 0) {
      dateSet.add(date.toString().trim());
    }
  });

  const meals = Array.from(mealSet).filter(Boolean).sort();
  const clients = Array.from(clientSet).filter(Boolean).sort();
  const dates = Array.from(dateSet).filter(Boolean).sort();

  console.log("🍽️ MENU Meals:", meals);
  console.log("🏢 MENU Clients:", clients);
  console.log("📅 MENU Dates:", dates);

  return { meals, clients, dates };
};

// -------------------- PMS DATA (WRITE) --------------------
// JSON POST -> Apps Script doPost -> handleJsonUpdate
//
// updates = [
//   { rowIndex: 4, colIndex: 7, value: 123 }, // 0-based indices
//   ...
// ]
//
// NOTE:
//  - rowIndex / colIndex yaha 0-based hai
//  - Apps Script me +1 karke sheet me likh raha hai

export const updatePMSCells = async (updates, sheetName = "PMS") => {
  try {
    if (!Array.isArray(updates) || updates.length === 0) {
      console.warn("⚠️ updatePMSCells called with empty updates array");
      return { success: false, error: "No updates provided" };
    }

    console.log("✏️ Sending PMS updates:", updates);

    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sheet: sheetName,
        updates,
      }),
    });

    if (!response.ok) {
      console.error("❌ HTTP error while updating PMS:", response.status);
      return { success: false, error: "HTTP " + response.status };
    }

    const data = await response.json();
    console.log("✅ PMS update response:", data);

    if (data.error) {
      console.error("❌ Apps Script update error:", data.error);
    }

    return data;
  } catch (err) {
    console.error("❌ updatePMSCells exception:", err);
    return { success: false, error: err.toString() };
  }
};

// (optional helper – single cell update)
// export const updateSinglePMSCell = async (rowIndex, colIndex, value, sheetName = "PMS") => {
//   return updatePMSCells([{ rowIndex, colIndex, value }], sheetName);
// };
