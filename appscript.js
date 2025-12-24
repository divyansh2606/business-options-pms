// @ts-nocheck
// ============ EXISTING FUNCTIONS (NO CHANGES) ============

function copyMenuData() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = ss.getSheetByName("PMS");   // source sheet name
    const targetSheet = ss.getSheetByName("P VS A(Item Wise)");  // target sheet name

    // --- Cells jahan se Client, Venue, Date milta hai ---
    const client = sourceSheet.getRange("Y1").getValue();  // client name
    const venue = sourceSheet.getRange("A1").getValue();   // venue
    const menuDate = sourceSheet.getRange("M1").getValue(); // date

    // --- Find last row of data ---
    const lastRow = sourceSheet.getLastRow();
    const dataRange = sourceSheet.getRange("AK7:AV" + lastRow); // data from A7 to N:lastRow
    const data = dataRange.getValues();

    // --- Filter out blank rows ---
    const filteredData = data.filter(row => row.join("") !== "");

    if (filteredData.length === 0) {
        SpreadsheetApp.getUi().alert("No data to copy!");
        return;
    }

    // --- Add Client, Venue, Date columns to each row ---
    const updatedData = filteredData.map(r => [...r, client, venue, menuDate]);

    // --- Find next empty row in target sheet ---
    const lastTargetRow = targetSheet.getLastRow();
    const startRow = lastTargetRow === 0 ? 1 : lastTargetRow + 1;

    // --- Paste data ---
    targetSheet.getRange(startRow, 1, updatedData.length, updatedData[0].length)
        .setValues(updatedData);

    SpreadsheetApp.getUi().alert("Data copied successfully with Client, Venue, and Date!");
}

function pasteFullData() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var src = ss.getSheetByName("PMS");
    var dst = ss.getSheetByName("P Vs A (Recipe)");

    // ----- Read main header values -----
    var venue = src.getRange("A1").getValue();
    var date = src.getRange("M1").getValue();
    var company = src.getRange("Y1").getValue();
    var personCount = src.getRange("J1").getValue();   // NEW ADDED

    // ----- Menu Block (A5:AJ6) -----
    var menuBlock = src.getRange("A2:AJ3").getValues();

    // ----- Planned / Actual / Diff Block (A7:AJ25) -----
    var planBlock = src.getRange("A5:AJ6").getValues();

    // ----- Find next empty row in destination -----
    var nextRow = dst.getLastRow() + 1;

    // ----- Paste Header: Venue, Date, Company, Person -----
    dst.getRange(nextRow, 1).setValue(venue);
    dst.getRange(nextRow, 2).setValue(date);
    dst.getRange(nextRow, 3).setValue(company);
    dst.getRange(nextRow, 4).setValue(personCount);   // NEW ADDED

    // ----- Paste Menu Block starting column 5 -----
    dst.getRange(nextRow, 5, menuBlock.length, menuBlock[0].length).setValues(menuBlock);

    // ----- Paste Planned/Actual Block (below menu) -----
    var planStartRow = nextRow + menuBlock.length;
    dst.getRange(planStartRow, 5, planBlock.length, planBlock[0].length).setValues(planBlock);

    SpreadsheetApp.flush();
}

function sendMergedSheetEmail() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("P Vs A (Recipe)");
    var data = sheet.getDataRange().getDisplayValues();

    // Replace with your deployed Web App URL
    // Use ScriptApp.getService().getUrl() to dynamically get the current URL if preferred, or hardcode.
    // Keeping logic similar to original but generic or hardcoded if user had one.
    var webAppUrl = ScriptApp.getService().getUrl();

    var html = "<h2>Daily Planned Vs Actual Report</h2>";
    html += "<form method='post' action='" + webAppUrl + "'>"; // submit to web app
    html += "<table border='1' style='border-collapse:collapse;'>";

    for (var i = 0; i < data.length; i++) {
        var row = data[i];
        var nonEmptyCount = row.filter(c => c !== "").length;
        var blankCount = row.filter(c => c === "").length;

        if (row[0] !== "" && blankCount > row.length / 2) {
            // Item / Recipe row
            html += "<tr>";
            var j = 0;
            while (j < row.length) {
                if (row[j] !== "") {
                    var colspan = 1;
                    for (var k = j + 1; k < row.length; k++) {
                        if (row[k] === "") colspan++;
                        else break;
                    }
                    html += "<td style='padding:5px; font-weight:bold; background:#f0f0f0;' colspan='" + colspan + "'>" + row[j] + "</td>";
                    j += colspan;
                } else {
                    html += "<td style='padding:5px;'>&nbsp;</td>";
                    j++;
                }
            }
            html += "</tr>";
        } else {
            // Planned / Actual / Diff / Unit rows
            html += "<tr>";
            row.forEach(function (cell, colIndex) {
                // Detect if header above is "Actual"
                if (data[i - 1] && data[i - 1][colIndex] && data[i - 1][colIndex].toString().toLowerCase() === "actual") {
                    html += "<td style='padding:4px;'><input type='text' name='cell_" + i + "_" + colIndex + "' value='" + (cell || "") + "' style='width:80px;'></td>";
                } else {
                    html += "<td style='padding:4px;'>" + (cell || "&nbsp;") + "</td>";
                }
            });
            html += "</tr>";
        }
    }

    html += "</table>";
    html += "<br><input type='submit' value='Update Sheet' style='padding:5px 10px;'>";
    html += "</form>";

    GmailApp.sendEmail(
        "mis@optionfoodmanagement.in,sankalp@optionfoodmanagement.in",
        "Daily Planned Vs Actual Report - According To Your Recipe",
        "This is Option MIS System",
        { htmlBody: html }
    );

    Logger.log("Email sent successfully!");
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
            if (targetRow <= 7) {
                Logger.log(`🚫 BLOCKED: Attempt to write to header row ${targetRow}, col ${targetCol}`);
                return ContentService.createTextOutput(JSON.stringify({
                    success: false,
                    error: "Write blocked: cannot modify header rows (1-7)",
                    details: { row: targetRow, col: targetCol, value: val }
                })).setMimeType(ContentService.MimeType.JSON);
            }

            // CRITICAL: Protect item name columns (C, G, K, O, S, W, AA, AE, AI = cols 3, 7, 11, 15, 19, 23, 27, 31, 35)
            const itemNameColumns = new Set([3, 7, 11, 15, 19, 23, 27, 31, 35]);
            if (itemNameColumns.has(targetCol)) {
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

            if (!(inAllowedCols || isHeaderActual)) {
                Logger.log(`🚫 BLOCKED: Column ${targetCol} is not an Actual column`);
                return ContentService.createTextOutput(JSON.stringify({
                    success: false,
                    error: "Write blocked to protect item names (not an Actual column)",
                    details: { row: targetRow, col: targetCol, inAllowedCols, isHeaderActual }
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
                cellA1.clearDataValidations();
                cellA1.setValue(clientStr);
            }
        }

        // Set date (P1) - reverted to P1 as M1 is not driving the sheet
        if (dateStr) {
            const cellM1 = sheet.getRange("P1");
            try {
                cellM1.setValue(dateStr);
            } catch (e) {
                Logger.log("⚠️ P1 validation error, clearing...");
                cellM1.clearDataValidations();
                cellM1.setValue(dateStr);
            }
        }

        // Set meal (AE1) - reverted to AE1 as Y1 is not driving the sheet
        if (mealStr) {
            const cellY1 = sheet.getRange("AE1");
            try {
                cellY1.setValue(mealStr);
            } catch (e) {
                Logger.log("⚠️ AE1 validation error, clearing...");
                cellY1.clearDataValidations();
                cellY1.setValue(mealStr);
            }
        }

        // Force recalculation
        SpreadsheetApp.flush();

        if (!fastMode) {
            // Trigger recalculation by updating a dummy cell
            const dummyCell = sheet.getRange("Z1000");
            dummyCell.setValue(new Date().getTime());
            SpreadsheetApp.flush();
            // Wait briefly for formulas to recalculate
            Utilities.sleep(800);
            // Clear dummy cell
            dummyCell.clearContent();
            SpreadsheetApp.flush();
        }

        // Verify the values are set correctly
        const actualClient = sheet.getRange("A1").getValue();
        const actualDate = sheet.getRange("P1").getValue();  // Changed to P1
        const actualMeal = sheet.getRange("AE1").getValue();  // Changed to AE1

        Logger.log("✅ Values after set - A1: " + actualClient + ", P1: " + actualDate + ", AE1: " + actualMeal);

        const verification = {
            requested: { client: clientStr, date: dateStr, meal: mealStr },
            actual: {
                client: actualClient?.toString().trim() || "",
                date: actualDate ? formatDateValue(actualDate) : "",
                meal: actualMeal?.toString().trim() || ""
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
        const mealMatches = normalizeForComparison(verification.requested.meal) === normalizeForComparison(verification.actual.meal);

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

    var ranges = [
        "D8:D",
        "H8:H",
        "L8:L",
        "P8:P",
        "T8:T",
        "X8:X",
        "AB8:AB",
        "AF8:AF",
        "AJ8:AJ"
    ];

    ranges.forEach(function (range) {
        sheet.getRange(range).clearContent();
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