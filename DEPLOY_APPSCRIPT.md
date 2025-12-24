# Deploy Apps Script Fix

## Critical Bug Fixed

The Apps Script was using **wrong cell references** for the date and meal dropdowns:

### Before (WRONG):
- Client: A1 ✓ (correct)
- Date: **P1** ❌ (wrong - should be M1)
- Meal: **AE1** ❌ (wrong - should be Y1)

### After (CORRECT):
- Client: **A1** ✓
- Date: **M1** ✓ 
- Meal: **Y1** ✓

## Steps to Deploy the Fix

1. **Open Google Apps Script Editor**:
   - Go to your Google Sheet: https://docs.google.com/spreadsheets/d/1eV02EdigeQuKp2VHLZA0xUIstj9xqvmTZ_-wMaIZv7E
   - Click **Extensions** → **Apps Script**

2. **Update the Code**:
   - Find the `setFiltersAndVerify` function (around line 875)
   - Replace these lines:
     ```javascript
     // OLD CODE (lines ~904-922):
     const cellP1 = sheet.getRange("P1");  // ❌ WRONG
     const cellAE1 = sheet.getRange("AE1"); // ❌ WRONG
     const actualDate = sheet.getRange("P1").getValue();  // ❌ WRONG
     const actualMeal = sheet.getRange("AE1").getValue(); // ❌ WRONG
     ```
   
   - With:
     ```javascript
     // NEW CODE:
     const cellM1 = sheet.getRange("M1");  // ✓ CORRECT
     const cellY1 = sheet.getRange("Y1");  // ✓ CORRECT
     const actualDate = sheet.getRange("M1").getValue();  // ✓ CORRECT
     const actualMeal = sheet.getRange("Y1").getValue();  // ✓ CORRECT
     ```

3. **OR Copy the Entire Fixed File**:
   - Open `appscript.js` in this project folder
   - Copy **ALL** the code
   - Paste it into the Apps Script editor (replacing everything)

4. **Deploy**:
   - Click **Deploy** → **Manage deployments**
   - Click the edit icon (pencil) on your existing deployment
   - Change **Version** to "New version"
   - Add description: "Fixed dropdown cell references (M1, Y1)"
   - Click **Deploy**

5. **Test**:
   - Refresh your React app
   - Select a client, date, and meal
   - Click "RELOAD DATA"
   - The correct data should now appear!

## What This Fixes

- ✅ Client dropdown (A1) will now correctly control the data
- ✅ Date dropdown (M1) will now correctly filter by date
- ✅ Meal dropdown (Y1) will now correctly show the right meal data
- ✅ The app will fetch the exact data matching your selections
- ✅ No more "Unknown Meal" or wrong data appearing

## Verification

After deploying, check the browser console (F12). You should see:
```
📍 Dropdown cells: {client: "A1 (col 0)", date: "M1 (col 12)", meal: "Y1 (col 24)"}
🔍 RAW ROW 1 DATA:
  A1 (col 0): "CPLA"
  M1 (col 12): "25-Dec-2023"
  J1 (col 9): "220"
  Y1 (col 24): "Dinner"
```

If the data still looks wrong, clear your browser cache and try again.
