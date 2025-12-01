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
