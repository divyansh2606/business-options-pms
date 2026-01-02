// @ts-nocheck
// ============ EXISTING FUNCTIONS (NO CHANGES) ============

function copyMenuData() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = ss.getSheetByName("PMS");
    const targetSheet = ss.getSheetByName("ingredient");

    const client = sourceSheet.getRange("A1").getValue();
    const venue = sourceSheet.getRange("A2").getValue();
    const menuDate = sourceSheet.getRange("P1").getValue();

    // 🔹 NEW: L1 & L2
    const l1 = sourceSheet.getRange("L1").getValue();
    const l2 = sourceSheet.getRange("L2").getValue();

    const lastRow = sourceSheet.getLastRow();
    if (lastRow < 10) {
        SpreadsheetApp.getUi().alert("No data to copy!");
        return;
    }

    const data = sourceSheet.getRange("A10:BE" + lastRow).getValues();
    const filteredData = data.filter(r => r.some(c => c !== ""));

    if (filteredData.length === 0) {
        SpreadsheetApp.getUi().alert("No data to copy!");
        return;
    }

    // 🔹 Yahan L1 & L2 add kiya
    const updatedData = filteredData.map(r => [
        ...r,
        client,
        venue,
        menuDate,
        l1,
        l2
    ]);

    const startRow = targetSheet.getLastRow() + 1;
    targetSheet
        .getRange(startRow, 1, updatedData.length, updatedData[0].length)
        .setValues(updatedData);

    SpreadsheetApp.getUi().alert("Data copied successfully!");
}






function pasteFullData() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var src = ss.getSheetByName("PMS");
    var dst = ss.getSheetByName("Weight");

    var company = src.getRange("A1").getValue();
    var venue = src.getRange("A2").getValue();
    var date = src.getRange("P1").getValue();

    // ✅ FULL RANGE L1:O2
    var personCount = src.getRange("L1:O2").getValues();

    var menuBlock = src.getRange("A3:AX4").getValues();
    var planBlock = src.getRange("A7:AX8").getValues();

    var nextRow = dst.getLastRow() + 1;

    dst.getRange(nextRow, 1).setValue(venue);
    dst.getRange(nextRow, 2).setValue(date);
    dst.getRange(nextRow, 3).setValue(company);

    // ✅ Paste L1:O2 properly
    dst.getRange(
        nextRow,
        4,
        personCount.length,
        personCount[0].length
    ).setValues(personCount);

    dst.getRange(
        nextRow,
        8,
        menuBlock.length,
        menuBlock[0].length
    ).setValues(menuBlock);

    var planStartRow = nextRow + menuBlock.length;
    dst.getRange(
        planStartRow,
        8,
        planBlock.length,
        planBlock[0].length
    ).setValues(planBlock);

    SpreadsheetApp.flush();
}



// 🔹 Sirf row 8 clear karega
function clearPMSRow8() {
    const sheet = SpreadsheetApp.getActive().getSheetByName("PMS");
    ["D8", "I8", "N8", "S8", "X8", "AC8", "AH8", "AM8", "AR8", "AW8"]
        .forEach(c => sheet.getRange(c).clearContent());
}

// 🔹 Row 11 se lastRow tak clear karega
function clearPMSFrom11() {
    const sheet = SpreadsheetApp.getActive().getSheetByName("PMS");
    const lastRow = sheet.getLastRow();
    if (lastRow < 11) return;

    ["D", "I", "N", "S", "X", "AC", "AH", "AM", "AR", "AW"]
        .forEach(c => sheet.getRange(c + "11:" + c + lastRow).clearContent());
}



function clearPMSAY11BC() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("PMS");

    const lastRow = sheet.getLastRow();
    if (lastRow >= 11) {
        sheet.getRange("AY11:BC" + lastRow).clearContent();
    }

    SpreadsheetApp.getUi().alert("AY11:BC data cleared!");
}
















// ============ NEW FUNCTIONS FOR REACT APP ============

// Handle GET requests (Read data for React app)
function doGet(e) {
    const lock = LockService.getScriptLock();
    try {
        lock.waitLock(30000);
    } catch (e) {
        return ContentService.createTextOutput(JSON.stringify({ error: "Server busy, could not acquire lock" }))
            .setMimeType(ContentService.MimeType.JSON);
    }

    try {
        const action = e.parameter.action;

        if (action === "update") {
            const sheetName = e.parameter.sheet || "PMS";
            const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

            if (!sheet) {
                return ContentService.createTextOutput(JSON.stringify({ error: "Sheet not found" }))
                    .setMimeType(ContentService.MimeType.JSON);
            }

            const row = parseInt(e.parameter.row);
            const col = parseInt(e.parameter.col);
            let val = e.parameter.value;

            const targetRow = row + 1;
            const targetCol = col + 1;

            // CRITICAL: Block any writes to rows 1-7 (headers/formulas)
            // EXCEPT for the specific filter dropdowns used by the app:
            // A1 (row 1, col 1): Client
            // A2 (row 2, col 1): Meal/Venue
            // P1 (row 1, col 16): Date
            // M1 (row 1, col 13): Date (Secondary)
            // AE1 (row 1, col 31): Meal (Secondary)
            const isFilterCell = (targetRow === 1 && (targetCol === 1 || targetCol === 16 || targetCol === 13 || targetCol === 31)) ||
                (targetRow === 2 && targetCol === 1);

            if (targetRow <= 7 && !isFilterCell) {
                Logger.log(`🚫 BLOCKED: Attempt to write to header row ${targetRow}, col ${targetCol}`);
                return ContentService.createTextOutput(JSON.stringify({
                    success: false,
                    error: "Write blocked: cannot modify header rows (1-7)",
                    details: { row: targetRow, col: targetCol, value: val }
                })).setMimeType(ContentService.MimeType.JSON);
            }

            // CRITICAL: Protect item name columns (C, G, K, O, S, W, AA, AE, AI = cols 3, 7, 11, 15, 19, 23, 27, 31, 35)
            const itemNameColumns = new Set([3, 7, 11, 15, 19, 23, 27, 31, 35]);
            if (itemNameColumns.has(targetCol) && !isFilterCell) {
                Logger.log(`🚫 BLOCKED: Cannot modify item name column ${targetCol}`);
                return ContentService.createTextOutput(JSON.stringify({
                    success: false,
                    error: "Write blocked: cannot modify item name columns",
                    details: { row: targetRow, col: targetCol, value: val, columnType: "ItemName" }
                })).setMimeType(ContentService.MimeType.JSON);
            }

            const cell = sheet.getRange(targetRow, targetCol);

            // Log current cell state
            const oldValue = cell.getValue();
            const oldFormula = cell.getFormula();
            const oldType = typeof oldValue;

            Logger.log(`📝 UPDATE REQUEST: Row ${targetRow}, Col ${targetCol} (0-based: ${row}, ${col})`);
            Logger.log(`   Old Value: "${oldValue}" (${oldType})`);
            Logger.log(`   Old Formula: "${oldFormula}"`);
            Logger.log(`   New Value: "${val}"`);

            // CRITICAL: Never overwrite a formula cell
            if (oldFormula) {
                Logger.log(`🚫 BLOCKED: Target cell has formula: ${oldFormula}`);
                return ContentService.createTextOutput(JSON.stringify({
                    success: false,
                    error: "Write blocked: target cell contains a formula",
                    details: { row: targetRow, col: targetCol, formula: oldFormula }
                })).setMimeType(ContentService.MimeType.JSON);
            }

            // Additional header-based guard for data rows
            let isHeaderActual = false;
            const headerRows = [5, 6, 7];
            for (let hr of headerRows) {
                try {
                    const headerText = sheet.getRange(hr, targetCol).getDisplayValue();
                    if (headerText && headerText.toString().trim().toLowerCase() === 'actual') {
                        isHeaderActual = true;
                        Logger.log(`   ✓ Header check: Column ${targetCol} has 'Actual' in row ${hr}`);
                        break;
                    }
                } catch (e) { }
            }

            const allowedActualCols = new Set([4, 8, 12, 16, 20, 24, 28, 32, 36]); // D,H,L,P,T,X,AB,AF,AJ
            const inAllowedCols = allowedActualCols.has(targetCol);

            if (!(inAllowedCols || isHeaderActual || isFilterCell)) {
                Logger.log(`🚫 BLOCKED: Column ${targetCol} is not an Actual column and not a filter cell`);
                return ContentService.createTextOutput(JSON.stringify({
                    success: false,
                    error: "Write blocked to protect item names (not an Actual column)",
                    details: { row: targetRow, col: targetCol, inAllowedCols, isHeaderActual, isFilterCell }
                })).setMimeType(ContentService.MimeType.JSON);
            }

            // Normalize numeric for Actual columns
            if (isHeaderActual || inAllowedCols) {
                const asNum = parseFloat(String(val).replace(/,/g, ''));
                if (!isNaN(asNum)) {
                    val = asNum;
                    Logger.log(`   ℹ️ Normalized to number: ${val}`);
                }
            }
            const validation = cell.getDataValidation();

            if (validation) {
                const criteria = validation.getCriteriaType();
                const values = validation.getCriteriaValues();
                let allowedValues = [];

                if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
                    if (values && values.length > 0 && Array.isArray(values[0])) {
                        allowedValues = values[0];
                    }
                } else if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
                    if (values && values.length > 0) {
                        const range = values[0];
                        if (range && typeof range.getValues === 'function') {
                            const rangeValues = range.getValues();
                            rangeValues.forEach(r => r.forEach(c => allowedValues.push(c)));
                        }
                    }
                }

                if (allowedValues.length > 0) {
                    const exactMatch = allowedValues.find(v => v == val);

                    if (!exactMatch) {
                        const fuzzyMatch = allowedValues.find(v =>
                            v && val && v.toString().trim().toLowerCase() === val.toString().trim().toLowerCase()
                        );

                        if (fuzzyMatch) {
                            Logger.log(`⚠️ Fuzzy Match: Replacing "${val}" with valid "${fuzzyMatch}"`);
                            val = fuzzyMatch;
                        } else {
                            Logger.log(`⚠️ No match found for "${val}" in validation list.`);
                        }
                    }
                }
            }

            try {
                cell.setValue(val);
            } catch (e) {
                if (e.toString().includes("violates the data validation")) {
                    Logger.log(`⚠️ Validation Error for "${val}". clearing validation rule...`);
                    cell.clearDataValidation();
                    SpreadsheetApp.flush();
                    cell.setValue(val);
                } else {
                    throw e;
                }
            }

            // Flush and wait for formulas to recalculate
            SpreadsheetApp.flush();

            // Verify the value was actually set
            const verifyValue = cell.getValue();
            Logger.log(`✅ Cell (${row + 1}, ${col + 1}) set to: "${verifyValue}" (requested: "${val}")`);

            // If the value doesn't match, try setting it again (case-insensitive match is OK)
            const verifyStr = verifyValue?.toString().trim() || "";
            const valStr = val?.toString().trim() || "";
            if (verifyStr.toLowerCase() !== valStr.toLowerCase() && verifyStr !== valStr) {
                Logger.log(`⚠️ Value mismatch! Trying to set again...`);
                cell.setValue(val);
                SpreadsheetApp.flush();
                const verifyValue2 = cell.getValue();
                Logger.log(`✅ After retry, cell value: "${verifyValue2}"`);
            }

            // Multiple flush triggers to force dependent formulas
            const dummyCell = sheet.getRange("Z1000");
            dummyCell.setValue(new Date().getTime());
            SpreadsheetApp.flush();

            // Wait for formulas to recalculate
            Utilities.sleep(5000);

            dummyCell.clearContent();
            SpreadsheetApp.flush();

            // Final verification after wait
            const finalValue = cell.getValue();
            Logger.log(`✅ Final cell (${row + 1}, ${col + 1}) value after wait: "${finalValue}"`);

            return ContentService.createTextOutput(JSON.stringify({
                success: true,
                updated: { row, col, val, actualValue: finalValue?.toString() || "" }
            }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        if (action === "getClients") {
            return getClients();
        }

        if (action === "getDates") {
            const client = e.parameter.client;
            return getDates(client);
        }

        if (action === "getMeals") {
            const client = e.parameter.client;
            const date = e.parameter.date;
            return getMeals(client, date);
        }

        if (action === "setFilters") {
            const client = e.parameter.client;
            const date = e.parameter.date;
            const meal = e.parameter.meal;
            const fast = e.parameter.fast === 'true';
            // Pass fast flag by packing into an object on client param to avoid breaking signature
            return setFiltersAndVerify(fast ? { value: client, fast: true } : client, date, meal);
        }

        if (action === "backup") {
            const sheetName = e.parameter.sheet || "PMS";
            return backupSheet(sheetName);
        }

        if (action === "restore") {
            const sheetName = e.parameter.sheet || "PMS";
            return restoreSheetFromBackup(sheetName);
        }

        if (action === "diagnostic") {
            return getDiagnostic();
        }


        if (action === "fetch") {
            const sheetName = e.parameter.sheet || "PMS";
            const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
            if (!sheet) {
                return ContentService.createTextOutput(JSON.stringify({ error: "Sheet not found" }))
                    .setMimeType(ContentService.MimeType.JSON);
            }

            // ⚡ Performance: allow fetching only the needed range instead of whole sheet
            // Query params supported:
            // - range= A1:AX150
            // - rows=200&cols=60  (starts from A1)
            const rangeA1 = e.parameter.range;
            const rowsParam = parseInt(e.parameter.rows || "", 10);
            const colsParam = parseInt(e.parameter.cols || "", 10);

            let values;
            if (rangeA1) {
                values = sheet.getRange(rangeA1).getValues();
            } else if (!isNaN(rowsParam) && !isNaN(colsParam) && rowsParam > 0 && colsParam > 0) {
                const maxRows = Math.min(rowsParam, sheet.getMaxRows());
                const maxCols = Math.min(colsParam, sheet.getMaxColumns());
                values = sheet.getRange(1, 1, maxRows, maxCols).getValues();
            } else {
                // fallback: safe default (avoid full getDataRange for big sheets)
                const maxRows = Math.min(200, sheet.getMaxRows());
                const maxCols = Math.min(60, sheet.getMaxColumns());
                values = sheet.getRange(1, 1, maxRows, maxCols).getValues();
            }

            return ContentService.createTextOutput(JSON.stringify(values))
                .setMimeType(ContentService.MimeType.JSON);
        }

        // Default: Return sheet data
        const sheetName = e.parameter.sheet || "PMS";
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

        if (!sheet) {
            return ContentService.createTextOutput(JSON.stringify({ error: "Sheet not found" }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        SpreadsheetApp.flush();
        const data = sheet.getDataRange().getValues();

        return ContentService.createTextOutput(JSON.stringify(data))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ error: err.toString(), stack: err.stack }))
            .setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}

// ============ DYNAMIC FILTER FUNCTIONS ============
// Backup entire sheet data to a dedicated backup sheet (overwrites previous backup)
function backupSheet(sheetName) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const src = ss.getSheetByName(sheetName);
        if (!src) {
            return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Source sheet not found" }))
                .setMimeType(ContentService.MimeType.JSON);
        }
        const backupName = `BACKUP_${sheetName}`;
        let backup = ss.getSheetByName(backupName);
        if (!backup) {
            backup = ss.insertSheet(backupName);
        }
        // Clear backup and copy values only (no formulas to avoid recalculation side-effects)
        backup.clear();
        const range = src.getDataRange();
        const values = range.getValues();
        backup.getRange(1, 1, values.length, values[0].length).setValues(values);
        backup.getRange(1, values[0].length + 1).setValue(`Snapshot: ${new Date().toString()}`);
        Logger.log(`📦 Backup completed for ${sheetName}`);
        return ContentService.createTextOutput(JSON.stringify({ success: true, sheet: sheetName, backup: backupName }))
            .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

// Restore sheet data from its backup sheet
function restoreSheetFromBackup(sheetName) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const dst = ss.getSheetByName(sheetName);
        const backup = ss.getSheetByName(`BACKUP_${sheetName}`);
        if (!dst || !backup) {
            return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Destination or backup sheet not found" }))
                .setMimeType(ContentService.MimeType.JSON);
        }
        const bRange = backup.getDataRange();
        const values = bRange.getValues();
        dst.clear();
        dst.getRange(1, 1, values.length, values[0].length).setValues(values);
        SpreadsheetApp.flush();
        Logger.log(`♻️ Restore completed for ${sheetName}`);
        return ContentService.createTextOutput(JSON.stringify({ success: true, sheet: sheetName }))
            .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

// Simple Script-level cache helpers (10 min TTL)
function getCache(key) {
    try {
        const cache = CacheService.getScriptCache();
        const raw = cache.get(key);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        Logger.log("Cache get error: " + e.toString());
        return null;
    }
}

function setCache(key, value, seconds) {
    try {
        const cache = CacheService.getScriptCache();
        cache.put(key, JSON.stringify(value), seconds || 600);
    } catch (e) {
        Logger.log("Cache set error: " + e.toString());
    }
}

// Get all unique clients - primarily from MENU sheet (real data), fallback to PMS dropdowns
function getClients() {
    SpreadsheetApp.flush(); // Ensure fresh data
    const clientSet = new Set();

    // Try cache first
    const cachedClients = getCache("clients_v1");
    if (cachedClients && Array.isArray(cachedClients) && cachedClients.length > 0) {
        Logger.log("🗄️ Using cached clients: " + cachedClients.length);
        return ContentService.createTextOutput(JSON.stringify({ clients: cachedClients }))
            .setMimeType(ContentService.MimeType.JSON);
    }

    // PRIORITY 1: Get clients from MENU sheet (real data)
    const clientMapping = buildClientMappingFromMenu();
    Object.keys(clientMapping).forEach(client => {
        if (client && client.trim() !== "") {
            clientSet.add(client);
        }
    });

    // PRIORITY 2: Fallback to PMS dropdowns if MENU sheet is empty
    if (clientSet.size === 0) {
        Logger.log("⚠️ No clients found in MENU sheet, falling back to PMS dropdowns");
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("PMS");
        if (sheet) {
            // Scan columns A to K (indices 1 to 11) in row 1
            for (let col = 1; col <= 11; col++) {
                const cell = sheet.getRange(1, col);
                const cellValue = cell.getValue();
                if (cellValue && cellValue.toString().trim() !== "") {
                    clientSet.add(cellValue.toString());
                }
                const validation = cell.getDataValidation();
                if (validation) {
                    try {
                        const criteria = validation.getCriteriaType();
                        const values = validation.getCriteriaValues();
                        if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST && values && values.length > 0 && Array.isArray(values[0])) {
                            values[0].forEach(option => {
                                if (option && option.toString().trim() !== "") {
                                    clientSet.add(option.toString());
                                }
                            });
                        } else if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE && values && values.length > 0) {
                            const range = values[0];
                            if (range && typeof range.getValues === 'function') {
                                const rangeValues = range.getValues();
                                rangeValues.forEach(row => {
                                    row.forEach(cell => {
                                        if (cell && cell.toString().trim() !== "") {
                                            clientSet.add(cell.toString());
                                        }
                                    });
                                });
                            }
                        }
                    } catch (e) {
                        Logger.log("Error processing client cell " + col + ": " + e.toString());
                    }
                }
            }
        }
    }

    const clients = Array.from(clientSet).sort();
    Logger.log("✅ Found " + clients.length + " clients: " + JSON.stringify(clients));
    setCache("clients_v1", clients, 600);

    return ContentService.createTextOutput(JSON.stringify({ clients: clients }))
        .setMimeType(ContentService.MimeType.JSON);
}

// Helper function to build client-date-meal mapping from MENU sheet
function buildClientMappingFromMenu() {
    // Try cache first
    const cached = getCache("clientMapping_v1");
    if (cached && Object.keys(cached).length > 0) {
        Logger.log("🗄️ Using cached client mapping");
        return cached;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const menuSheet = ss.getSheetByName("MENU");
    const clientMapping = {};

    if (!menuSheet) {
        Logger.log("⚠️ MENU sheet not found");
        return clientMapping;
    }

    SpreadsheetApp.flush(); // Ensure fresh data
    const menuData = menuSheet.getDataRange().getValues();

    if (menuData.length <= 1) {
        Logger.log("⚠️ MENU sheet has no data rows");
        return clientMapping;
    }

    const headerRow = menuData[0];

    // Smart column detection
    let colMeal = -1, colClient = -1, colDate = -1;

    headerRow.forEach((cellValue, idx) => {
        const val = cellValue?.toString().toLowerCase().trim() || "";
        if (val.includes("meal") || val.includes("venue")) colMeal = idx;
        else if (val.includes("client") || val.includes("clint")) colClient = idx;
        else if (val.includes("date")) colDate = idx;
    });

    Logger.log("🧠 MENU Sheet Columns - Meal: " + colMeal + ", Client: " + colClient + ", Date: " + colDate);

    // If columns detected, build the mapping
    if (colMeal >= 0 && colClient >= 0 && colDate >= 0) {
        for (let i = 1; i < menuData.length; i++) {
            const row = menuData[i];
            const meal = row[colMeal]?.toString().trim();
            const client = row[colClient]?.toString().trim();
            const rawDate = row[colDate];

            if (!client || !rawDate || !meal) continue;

            // Format date consistently (dd-MMM-yyyy)
            let formattedDate = "";
            try {
                let d;
                if (rawDate instanceof Date) {
                    d = rawDate;
                } else {
                    d = new Date(rawDate);
                }

                if (!isNaN(d.getTime())) {
                    const day = String(d.getDate()).padStart(2, "0");
                    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                    const month = monthNames[d.getMonth()];
                    const year = d.getFullYear();
                    formattedDate = `${day}-${month}-${year}`;
                } else {
                    formattedDate = rawDate.toString().trim();
                }
            } catch (e) {
                formattedDate = rawDate.toString().trim();
            }

            // Build nested structure: client → date → meals[]
            if (!clientMapping[client]) {
                clientMapping[client] = {};
            }
            if (!clientMapping[client][formattedDate]) {
                clientMapping[client][formattedDate] = [];
            }
            if (!clientMapping[client][formattedDate].includes(meal)) {
                clientMapping[client][formattedDate].push(meal);
            }
        }

        Logger.log("✅ Client Mapping built with " + Object.keys(clientMapping).length + " clients");
    } else {
        Logger.log("⚠️ Could not detect MENU sheet columns");
    }

    setCache("clientMapping_v1", clientMapping, 600);
    return clientMapping;
}

// Get dates for a specific client (filtered from MENU sheet)
function getDates(client) {
    SpreadsheetApp.flush(); // Ensure fresh data
    if (!client) {
        return ContentService.createTextOutput(JSON.stringify({ dates: [] }))
            .setMimeType(ContentService.MimeType.JSON);
    }

    // Use MENU sheet to get actual dates for this client
    const clientMapping = buildClientMappingFromMenu();
    // Try per-client cache
    const cacheKey = "dates_" + encodeURIComponent(client);
    const cachedDates = getCache(cacheKey);
    if (cachedDates && Array.isArray(cachedDates) && cachedDates.length > 0) {
        Logger.log("🗄️ Using cached dates for client: " + client);
        return ContentService.createTextOutput(JSON.stringify({ dates: cachedDates }))
            .setMimeType(ContentService.MimeType.JSON);
    }
    const dateSet = new Set();

    // Get dates for this specific client from MENU sheet
    if (clientMapping[client]) {
        Object.keys(clientMapping[client]).forEach(date => {
            if (date && date.trim() !== "") {
                dateSet.add(date);
            }
        });
    }

    // Fallback: If no dates found in MENU sheet, try PMS dropdowns (P1 to AD1)
    if (dateSet.size === 0) {
        Logger.log("⚠️ No dates found in MENU sheet for client: " + client + ", falling back to PMS dropdowns");
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("PMS");
        for (let col = 16; col <= 30; col++) {
            const cell = sheet.getRange(1, col);
            const cellValue = cell.getValue();
            if (cellValue && cellValue.toString().trim() !== "") {
                const dateStr = formatDateValue(cellValue);
                if (dateStr) dateSet.add(dateStr);
            }
            const validation = cell.getDataValidation();
            if (validation) {
                try {
                    const criteria = validation.getCriteriaType();
                    const values = validation.getCriteriaValues();
                    if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST && values && values.length > 0 && Array.isArray(values[0])) {
                        values[0].forEach(option => {
                            if (option) {
                                const dateStr = formatDateValue(option);
                                if (dateStr) dateSet.add(dateStr);
                            }
                        });
                    } else if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE && values && values.length > 0) {
                        const range = values[0];
                        if (range && typeof range.getValues === 'function') {
                            const rangeValues = range.getValues();
                            rangeValues.forEach(row => {
                                row.forEach(cell => {
                                    if (cell) {
                                        const dateStr = formatDateValue(cell);
                                        if (dateStr) dateSet.add(dateStr);
                                    }
                                });
                            });
                        }
                    }
                } catch (e) {
                    Logger.log("Error processing date cell " + col + ": " + e.toString());
                }
            }
        }
    }

    const dates = Array.from(dateSet).sort();
    Logger.log("✅ Found " + dates.length + " dates for client: " + client);
    if (dates.length > 0) setCache(cacheKey, dates, 600);

    return ContentService.createTextOutput(JSON.stringify({ dates: dates }))
        .setMimeType(ContentService.MimeType.JSON);
}

// Get meals for a specific client and date (filtered from MENU sheet)
function getMeals(client, date) {
    SpreadsheetApp.flush(); // Ensure fresh data
    if (!client || !date) {
        return ContentService.createTextOutput(JSON.stringify({ meals: [] }))
            .setMimeType(ContentService.MimeType.JSON);
    }

    // Use MENU sheet to get actual meals for this client-date combination
    const clientMapping = buildClientMappingFromMenu();
    // Try per client+date cache
    const cacheKey = "meals_" + encodeURIComponent(client) + "_" + encodeURIComponent(date);
    const cachedMeals = getCache(cacheKey);
    if (cachedMeals && Array.isArray(cachedMeals) && cachedMeals.length > 0) {
        Logger.log("🗄️ Using cached meals for " + client + " on " + date);
        return ContentService.createTextOutput(JSON.stringify({ meals: cachedMeals }))
            .setMimeType(ContentService.MimeType.JSON);
    }
    const mealSet = new Set();

    // Normalize date format for matching (try to match both formats)
    const normalizeDate = (dateStr) => {
        if (!dateStr) return "";
        try {
            // If it's already in dd-MMM-yyyy format, return as is
            if (dateStr.match(/^\d{2}-\w{3}-\d{4}$/)) {
                return dateStr;
            }
            // Try to parse and format
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
                const day = String(d.getDate()).padStart(2, "0");
                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                const month = monthNames[d.getMonth()];
                const year = d.getFullYear();
                return `${day}-${month}-${year}`;
            }
            return dateStr.toString().trim();
        } catch (e) {
            return dateStr.toString().trim();
        }
    };

    const normalizedDate = normalizeDate(date);

    // Get meals for this specific client-date combination from MENU sheet
    if (clientMapping[client] && clientMapping[client][normalizedDate]) {
        clientMapping[client][normalizedDate].forEach(meal => {
            if (meal && meal.trim() !== "") {
                mealSet.add(meal);
            }
        });
    }

    // Also check for date variations (in case of format mismatch)
    if (clientMapping[client] && mealSet.size === 0) {
        Object.keys(clientMapping[client]).forEach(dateKey => {
            const normalizedKey = normalizeDate(dateKey);
            if (normalizedKey === normalizedDate || dateKey === date || normalizedKey === date || dateKey === normalizedDate) {
                clientMapping[client][dateKey].forEach(meal => {
                    if (meal && meal.trim() !== "") {
                        mealSet.add(meal);
                    }
                });
            }
        });
    }

    // Fallback: If no meals found in MENU sheet, try PMS dropdowns (AE1 to AS1)
    if (mealSet.size === 0) {
        Logger.log("⚠️ No meals found in MENU sheet for client: " + client + ", date: " + date + ", falling back to PMS dropdowns");
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("PMS");
        for (let col = 31; col <= 45; col++) {
            const cell = sheet.getRange(1, col);
            const cellValue = cell.getValue();
            if (cellValue && cellValue.toString().trim() !== "") {
                mealSet.add(cellValue.toString());
            }
            const validation = cell.getDataValidation();
            if (validation) {
                try {
                    const criteria = validation.getCriteriaType();
                    const values = validation.getCriteriaValues();
                    if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST && values && values.length > 0 && Array.isArray(values[0])) {
                        values[0].forEach(option => {
                            if (option && option.toString().trim() !== "") {
                                mealSet.add(option.toString());
                            }
                        });
                    } else if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE && values && values.length > 0) {
                        const range = values[0];
                        if (range && typeof range.getValues === 'function') {
                            const rangeValues = range.getValues();
                            rangeValues.forEach(row => {
                                row.forEach(cell => {
                                    if (cell && cell.toString().trim() !== "") {
                                        mealSet.add(cell.toString());
                                    }
                                });
                            });
                        }
                    }
                } catch (e) {
                    Logger.log("Error processing meal cell " + col + ": " + e.toString());
                }
            }
        }
    }

    const meals = Array.from(mealSet).sort();
    Logger.log("✅ Found " + meals.length + " meals for client: " + client + ", date: " + date);
    if (meals.length > 0) setCache(cacheKey, meals, 600);

    return ContentService.createTextOutput(JSON.stringify({ meals: meals }))
        .setMimeType(ContentService.MimeType.JSON);
}

// Helper function to format date values consistently
function formatDateValue(dateValue) {
    if (!dateValue && dateValue !== 0) return ""; // Handle null, undefined, empty string

    let d;

    try {
        // Case 1: Already a valid Date object
        if (dateValue instanceof Date) {
            d = dateValue;
        }
        // Case 2: Google Sheets date serial number (e.g., 46000+ for 2025 dates)
        else if (typeof dateValue === "number") {
            d = new Date((dateValue - 25569) * 86400 * 1000); // Convert Excel serial to JS Date (UTC)
            // Adjust for Google Sheets/Apps Script timezone quirk
            d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
        }
        // Case 3: String date - try parsing common formats
        else if (typeof dateValue === "string") {
            const trimmed = dateValue.trim();
            if (trimmed === "") return "";

            // Direct parse attempt (handles ISO, dd-MMM-yyyy, MM/DD/YYYY, etc.)
            d = new Date(trimmed);

            // Special handling if it's already in dd-MMM-yyyy format
            if (isNaN(d.getTime()) && /^\d{2}-[A-Za-z]{3}-\d{4}$/.test(trimmed)) {
                // JavaScript sometimes fails to parse "25-Dec-2025", so manual parse
                const parts = trimmed.split("-");
                const day = parseInt(parts[0], 10);
                const monthStr = parts[1];
                const year = parseInt(parts[2], 10);

                const monthNames = {
                    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
                    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
                };

                if (monthNames.hasOwnProperty(monthStr)) {
                    d = new Date(year, monthNames[monthStr], day);
                }
            }
        }
        // Fallback: try direct conversion
        else {
            d = new Date(dateValue);
        }

        // Validate the resulting date
        if (!d || isNaN(d.getTime())) {
            throw new Error("Invalid date");
        }

        // Format as dd-MMM-yyyy
        const day = String(d.getDate()).padStart(2, "0");
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = monthNames[d.getMonth()];
        const year = d.getFullYear();

        return `${day}-${month}-${year}`;

    } catch (e) {
        // If all parsing fails, return trimmed string as fallback
        return typeof dateValue === "string" ? dateValue.trim() : String(dateValue);
    }
}

// Set all filters (client, date, meal) and verify they're set correctly
function setFiltersAndVerify(client, date, meal) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("PMS");
        if (!sheet) {
            return ContentService.createTextOutput(JSON.stringify({
                success: false,
                error: "PMS sheet not found"
            })).setMimeType(ContentService.MimeType.JSON);
        }

        // Normalize inputs and detect fast mode
        const fastMode = (typeof client === 'object' && client !== null && client.fast) ? true : (typeof date === 'object' && date !== null && date.fast) ? true : false;
        const clientStr = (typeof client === 'object' && client !== null && client.value !== undefined) ? client.value : client;
        const dateStr = (typeof date === 'object' && date !== null && date.value !== undefined) ? date.value : date;
        const mealStr = (typeof meal === 'object' && meal !== null && meal.value !== undefined) ? meal.value : meal;

        Logger.log("🔧 Setting filters - Client: " + clientStr + ", Date: " + dateStr + ", Meal: " + mealStr + (fastMode ? " (fast)" : ""));

        // Set client (A1)
        if (clientStr) {
            const cellA1 = sheet.getRange("A1");
            try {
                cellA1.setValue(clientStr);
            } catch (e) {
                Logger.log("⚠️ A1 validation error, clearing...");
                cellA1.clearDataValidation();
                cellA1.setValue(clientStr);
            }
        }

        // Set date (P1) - primary date, also M1 as secondary
        if (dateStr) {
            const dateCells = ["P1", "M1"];
            dateCells.forEach(cell => {
                const range = sheet.getRange(cell);
                try {
                    range.setValue(dateStr);
                } catch (e) {
                    Logger.log(`⚠️ ${cell} validation error, clearing...`);
                    range.clearDataValidation();
                    range.setValue(dateStr);
                }
            });
        }

        // Set meal (A2) - primary meal, also AE1 as secondary
        if (mealStr) {
            const mealCells = ["A2", "AE1"];
            mealCells.forEach(cell => {
                const range = sheet.getRange(cell);
                try {
                    range.setValue(mealStr);
                } catch (e) {
                    Logger.log(`⚠️ ${cell} validation error, clearing...`);
                    range.clearDataValidation();
                    range.setValue(mealStr);
                }
            });
        }

        // Force recalculation
        SpreadsheetApp.flush();

        if (!fastMode) {
            // Trigger recalculation by updating a dummy cell
            const dummyCell = sheet.getRange("Z1000");
            dummyCell.setValue(new Date().getTime());
            SpreadsheetApp.flush();
            // Wait longer for formulas to recalculate (increased from 800ms)
            Utilities.sleep(3000);
            // Clear dummy cell
            dummyCell.clearContent();
            SpreadsheetApp.flush();
        }

        // Verify the values are set correctly
        const actualClient = sheet.getRange("A1").getValue();
        const actualDate = sheet.getRange("P1").getValue();
        const actualMeal = sheet.getRange("A2").getValue();
        const actualMealAE1 = sheet.getRange("AE1").getValue();

        Logger.log("✅ Values after set - A1: " + actualClient + ", P1: " + actualDate + ", A2: " + actualMeal + ", AE1: " + actualMealAE1);

        const verification = {
            requested: { client: clientStr, date: dateStr, meal: mealStr },
            actual: {
                client: actualClient?.toString().trim() || "",
                date: actualDate ? formatDateValue(actualDate) : "",
                meal: actualMeal?.toString().trim() || "",
                mealAE1: actualMealAE1?.toString().trim() || ""
            },
            rawActual: {
                client: actualClient,
                date: actualDate,
                meal: actualMeal
            },
            matches: true
        };

        // Check if values match (with some flexibility for date formatting)
        const normalizeForComparison = (val) => val?.toString().trim().toLowerCase() || "";
        const clientMatches = normalizeForComparison(verification.requested.client) === normalizeForComparison(verification.actual.client);

        // Meal matches if either A2 or AE1 matches
        const mealMatchesA2 = normalizeForComparison(verification.requested.meal) === normalizeForComparison(verification.actual.meal);
        const mealMatchesAE1 = normalizeForComparison(verification.requested.meal) === normalizeForComparison(verification.actual.mealAE1);
        const mealMatches = mealMatchesA2 || mealMatchesAE1;

        // For date, try to match both formats
        const normalizeDateForComparison = (val) => {
            if (!val) return "";
            const normalized = formatDateValue(val);
            return normalized.toLowerCase();
        };
        const dateMatches = normalizeDateForComparison(verification.requested.date) === normalizeDateForComparison(verification.actual.date) ||
            normalizeDateForComparison(verification.requested.date) === normalizeForComparison(verification.actual.date) ||
            normalizeForComparison(verification.requested.date) === normalizeDateForComparison(verification.actual.date);

        verification.matches = clientMatches && dateMatches && mealMatches;

        if (!verification.matches) {
            Logger.log("⚠️ Filter verification failed: " + JSON.stringify(verification));
        }

        return ContentService.createTextOutput(JSON.stringify({
            success: true,
            verification: verification
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
        Logger.log("❌ Error in setFiltersAndVerify: " + err.toString());
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            error: err.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

// Handle POST requests (from email AND React app)
function doPost(e) {
    // Handle React app requests
    if (e.parameter && e.parameter.source === "react") {
        return handleReactRequest(e);
    }

    // Handle email form requests (existing functionality)
    else {
        return handleEmailRequest(e);
    }
}

// Handle React app requests
function handleReactRequest(e) {
    const sheetName = e.parameter.sheet || "PMS";
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

    if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Sheet not found" }))
            .setMimeType(ContentService.MimeType.JSON);
    }

    // Handle cell updates
    for (var key in e.parameter) {
        if (key.startsWith("cell_")) {
            var parts = key.split("_"); // cell_i_j
            var row = parseInt(parts[1]);
            var col = parseInt(parts[2]);
            // Existing logic uses [row+1, col+1] so we keep it
            sheet.getRange(row + 1, col + 1).setValue(e.parameter[key]);
        }
    }

    // Flush to ensure saves are committed and formulas update
    SpreadsheetApp.flush();

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
}

// Handle email form requests (existing functionality)
function handleEmailRequest(e) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("P Vs A (Recipe)");
    var params = e.parameter;

    for (var key in params) {
        if (key.startsWith("cell_")) {
            var parts = key.split("_"); // cell_i_j
            var row = parseInt(parts[1]);
            var col = parseInt(parts[2]);
            sheet.getRange(row + 1, col + 1).setValue(params[key]);
        }
    }

    return HtmlService.createHtmlOutput("Sheet updated successfully!");
}

function clearSelectedData() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var lastRow = sheet.getLastRow();

    var ranges = [
        ["D8:D8", "D10:D" + lastRow],
        ["H8:H8", "H10:H" + lastRow],
        ["N8:N8", "N10:N" + lastRow],
        ["S8:S8", "S10:S" + lastRow],
        ["X8:X8", "X10:X" + lastRow],
        ["AC8:AC8", "AC10:AC" + lastRow],
        ["AH8:AH8", "AH10:AH" + lastRow],
        ["AM8:AM8", "AM10:AM" + lastRow],
        ["AR8:AR8", "AR10:AR" + lastRow]
    ];

    ranges.forEach(function (group) {
        group.forEach(function (range) {
            sheet.getRange(range).clearContent();
        });
    });
}


// ============ DIAGNOSTIC FUNCTION ============
// Call this to check data consistency and structure
function diagnosticCheck() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const menuSheet = ss.getSheetByName("MENU");
    const pmsSheet = ss.getSheetByName("PMS");

    const report = {
        timestamp: new Date().toString(),
        menuSheetExists: !!menuSheet,
        pmsSheetExists: !!pmsSheet,
        issues: [],
        warnings: [],
        info: {}
    };

    // Check 1: MENU Sheet Structure
    if (!menuSheet) {
        report.issues.push("❌ MENU sheet not found");
        return report;
    }

    const menuData = menuSheet.getDataRange().getValues();
    if (menuData.length === 0) {
        report.issues.push("❌ MENU sheet is empty");
        return report;
    }

    const headerRow = menuData[0];
    let colMeal = -1, colClient = -1, colDate = -1;

    headerRow.forEach((cellValue, idx) => {
        const val = cellValue?.toString().toLowerCase().trim() || "";
        if (val.includes("meal") || val.includes("venue")) colMeal = idx;
        else if (val.includes("client") || val.includes("clint")) colClient = idx;
        else if (val.includes("date")) colDate = idx;
    });

    report.info.menuColumns = {
        mealColumn: colMeal >= 0 ? headerRow[colMeal] : "NOT FOUND",
        clientColumn: colClient >= 0 ? headerRow[colClient] : "NOT FOUND",
        dateColumn: colDate >= 0 ? headerRow[colDate] : "NOT FOUND"
    };

    if (colMeal < 0) report.issues.push("❌ MENU sheet missing 'Meal' or 'Venue' column");
    if (colClient < 0) report.issues.push("❌ MENU sheet missing 'Client' column");
    if (colDate < 0) report.issues.push("❌ MENU sheet missing 'Date' column");

    if (colMeal < 0 || colClient < 0 || colDate < 0) {
        return report;
    }

    // Check 2: Sample data from MENU sheet
    const sampleRows = menuData.slice(1, Math.min(6, menuData.length));
    report.info.menuSampleData = sampleRows.map(row => ({
        meal: row[colMeal]?.toString() || "",
        client: row[colClient]?.toString() || "",
        date: row[colDate]?.toString() || "",
        dateType: typeof row[colDate]
    }));

    // Check 3: Date Format Analysis
    const dateFormats = new Set();
    const clients = new Set();
    const meals = new Set();

    for (let i = 1; i < menuData.length; i++) {
        const row = menuData[i];
        const client = row[colClient]?.toString().trim();
        const meal = row[colMeal]?.toString().trim();
        const rawDate = row[colDate];

        if (client) clients.add(client);
        if (meal) meals.add(meal);

        if (rawDate) {
            if (rawDate instanceof Date) {
                dateFormats.add("Date Object");
            } else {
                const dateStr = rawDate.toString().trim();
                if (dateStr.match(/^\d{2}-\w{3}-\d{4}$/)) {
                    dateFormats.add("dd-MMM-yyyy (e.g., 07-Dec-2025)");
                } else if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
                    dateFormats.add("MM/DD/YYYY or DD/MM/YYYY");
                } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    dateFormats.add("YYYY-MM-DD");
                } else {
                    dateFormats.add("Other: " + dateStr.substring(0, 15));
                }
            }
        }
    }

    report.info.menuDataSummary = {
        totalRows: menuData.length - 1,
        uniqueClients: clients.size,
        uniqueMeals: meals.size,
        dateFormats: Array.from(dateFormats)
    };

    report.info.clientList = Array.from(clients).sort();
    report.info.mealList = Array.from(meals).sort();

    // Check 4: PMS Sheet Current Values
    if (pmsSheet) {
        const pmsClient = pmsSheet.getRange("A1").getValue();
        const pmsDate = pmsSheet.getRange("M1").getValue();
        const pmsMeal = pmsSheet.getRange("Y1").getValue();

        report.info.pmsCurrentValues = {
            client: pmsClient?.toString() || "(empty)",
            date: pmsDate ? (pmsDate instanceof Date ? formatDateValue(pmsDate) : pmsDate.toString()) : "(empty)",
            meal: pmsMeal?.toString() || "(empty)"
        };

        // Check 5: Client Name Matching
        const pmsClientStr = pmsClient?.toString().trim() || "";
        if (pmsClientStr && !clients.has(pmsClientStr)) {
            const similarClients = Array.from(clients).filter(c =>
                c.toLowerCase() === pmsClientStr.toLowerCase()
            );

            if (similarClients.length > 0) {
                report.warnings.push(`⚠️ PMS Client "${pmsClientStr}" doesn't match exactly. Did you mean: "${similarClients[0]}"?`);
            } else {
                report.warnings.push(`⚠️ PMS Client "${pmsClientStr}" not found in MENU sheet`);
            }
        }

        // Check 6: Date Format Consistency
        if (pmsDate) {
            const pmsDateFormatted = formatDateValue(pmsDate);
            const menuHasSimilarDate = menuData.slice(1).some(row => {
                const menuDate = row[colDate];
                if (!menuDate) return false;
                const menuDateFormatted = formatDateValue(menuDate);
                return menuDateFormatted === pmsDateFormatted;
            });

            if (!menuHasSimilarDate && pmsDateFormatted) {
                report.warnings.push(`⚠️ PMS Date "${pmsDateFormatted}" not found in MENU sheet`);
            }
        }
    }

    // Summary
    if (report.issues.length === 0 && report.warnings.length === 0) {
        report.status = "✅ All checks passed!";
    } else if (report.issues.length > 0) {
        report.status = "❌ Critical issues found";
    } else {
        report.status = "⚠️ Warnings detected";
    }

    Logger.log("=== DIAGNOSTIC REPORT ===");
    Logger.log(JSON.stringify(report, null, 2));

    return report;
}

// Add diagnostic endpoint to doGet
function getDiagnostic() {
    const report = diagnosticCheck();
    return ContentService.createTextOutput(JSON.stringify(report, null, 2))
        .setMimeType(ContentService.MimeType.JSON);
}