// src/api/restaurantAPI3.js - CSV Chunked Fetching (Cache Buster Version)
const SHEET_ID = "1eV02EdigeQuKp2VHLZA0xUIstj9xqvmTZ_-wMaIZv7E";

// Fetch data in chunks using CSV format to bypass empty row truncation
async function fetchCompleteSheetData(sheetName) {
    let allRows = [];
    const chunkSize = 100;
    const maxRows = 1000; // Safety limit

    console.log(`🚀 Starting CHUNKED CSV fetch for "${sheetName}" (API v3)...`);

    for (let offset = 0; offset < maxRows; offset += chunkSize) {
        try {
            // Google Visualization API with LIMIT and OFFSET - Request CSV format
            const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&limit=${chunkSize}&offset=${offset}`;

            console.log(`📡 Fetching chunk ${offset}-${offset + chunkSize} (CSV)...`);

            const response = await fetch(url);

            if (!response.ok) {
                console.error(`❌ HTTP Error ${response.status} for chunk ${offset}`);
                continue;
            }

            const csvText = await response.text();

            // Check if we got valid CSV data
            if (!csvText || csvText.trim().length === 0) {
                console.log(`⚠️ Chunk ${offset} returned empty CSV. Continuing...`);
                const emptyChunk = Array(chunkSize).fill([]);
                allRows = allRows.concat(emptyChunk);
                continue;
            }

            // Parse CSV chunk
            const chunkRows = parseCSV(csvText);

            console.log(`✅ Chunk ${offset} received: ${chunkRows.length} rows`);
            allRows = allRows.concat(chunkRows);

        } catch (error) {
            console.error(`❌ Error fetching chunk ${offset}:`, error);
        }
    }

    console.log(`🏁 Fetch complete. Total rows collected: ${allRows.length}`);
    return allRows;
}

// Robust CSV Parser
function parseCSV(csvText) {
    const rows = [];
    let currentRow = [];
    let currentValue = '';
    let insideQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                currentValue += '"';
                i++; // Skip next quote
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === ',' && !insideQuotes) {
            currentRow.push(cleanValue(currentValue));
            currentValue = '';
        } else if (char === '\n' && !insideQuotes) {
            currentRow.push(cleanValue(currentValue));
            rows.push(currentRow);
            currentRow = [];
            currentValue = '';
        } else {
            currentValue += char;
        }
    }

    // Add last row if exists
    if (currentValue || currentRow.length > 0) {
        currentRow.push(cleanValue(currentValue));
        rows.push(currentRow);
    }

    return rows;
}

function cleanValue(value) {
    if (!value) return '';
    value = value.trim();
    if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
    }
    return value;
}

export const fetchPMSData = async () => {
    console.log("🔄 Fetching PMS Data (Chunked CSV v3)...");
    const data = await fetchCompleteSheetData("PMS");
    console.log(`✅ TOTAL PMS ROWS: ${data.length}`);
    return data;
};

export const fetchRecipeData = async () => {
    return [];
};

// Helper to format date consistently
const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d)) return date.toString().trim();

    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleString("en-US", { month: "short" });
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
};

// Fetch MENU options using Google Visualization API (works without sheet open)
export const fetchMenuOptions = async () => {
    console.log("🔄 Fetching MENU options (CSV v3)...");
    const rows = await fetchCompleteSheetData("MENU");

    const mealSet = new Set();
    const clientSet = new Set();
    const dateSet = new Set();

    rows.forEach((row, idx) => {
        if (!row || row.length === 0) return;
        if (idx === 0) return; // Skip header row

        const meal = row[0];
        const client = row[1];
        const date = row[2];

        if (meal) mealSet.add(meal.toString().trim());
        if (client) clientSet.add(client.toString().trim());
        if (date) {
            // Try to format date consistently
            const trimmed = date.toString().trim();
            if (trimmed) {
                // Check if it looks like a date
                const parsed = new Date(trimmed);
                if (!isNaN(parsed)) {
                    dateSet.add(formatDate(parsed));
                } else {
                    dateSet.add(trimmed);
                }
            }
        }
    });

    const meals = Array.from(mealSet).filter(Boolean).sort();
    const clients = Array.from(clientSet).filter(Boolean).sort();
    // Sort dates chronologically (not alphabetically)
    const dates = Array.from(dateSet).filter(Boolean).sort((a, b) => {
        const dateA = new Date(a);
        const dateB = new Date(b);
        if (isNaN(dateA)) return 1;
        if (isNaN(dateB)) return -1;
        return dateA - dateB;
    });

    console.log("🍽️ MENU Meals:", meals);
    console.log("🏢 MENU Clients:", clients);
    console.log("📅 MENU Dates:", dates);

    return { meals, clients, dates };
};
