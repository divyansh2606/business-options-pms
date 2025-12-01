// src/api/restaurantAPI2.js - Apps Script Method (with MENU options)
// NOTE:
//  - "PMS" sheet => actual data (meal blocks + items)
//  - "MENU" sheet => dropdown master values (Meals / Clients / Dates etc.)

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwVmJ7sesXGVun0H2RN2rnxDwzl0WWZHsEeDU8vfVnD757E8Bo_xliAmj1e81ki9N1J/exec";

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

// ----- PMS DATA (actual menu + items) -----
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

// ----- RECIPE DATA (agar baad me chahiye) -----
export const fetchRecipeData = async () => {
  console.log("🔄 Fetching Recipe Data...");
  return await fetchSheetData("P Vs A (Recipe)");
};

// ----- NEW: MENU OPTIONS (for dropdowns) -----
// Assumption: "MENU" sheet me columns something like:
// Row 1: headers
// Col A: Meal names   (Breakfast, Lunch, Dinner...)
// Col B: Client names (Millennium, Cipla, ...)
// Col C: Dates / other options (optional)
//
// Jo bhi non-empty values milengi unse unique list bana denge.
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

    if (meal && idx > 0) {
      // idx > 0 => header row skip
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
