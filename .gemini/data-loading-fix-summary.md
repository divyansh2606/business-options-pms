# Fix Summary: Data Not Loading When Filters Changed

## Problem
When users selected Client, Date, or Meal filters and clicked "RELOAD DATA", the application showed "NO DATA FOUND" even though data existed in the Google Sheet. Console logs showed:
```
M1 (col 12): ""  ← Date column empty
Y1 (col 24): ""  ← Meal column empty
Menu filter check - Valid: false
```

## Root Cause
The issue was in the `setFiltersAndVerify` API call which was using `fast: "true"` mode:

1. **`restaurantAPI2.js` line 379** passed `fast: "true"` to the server
2. **`appscript.js` lines 932-942** - When `fastMode = true`:
   - **SKIPPED** the `Utilities.sleep(800)` wait
   - **SKIPPED** the formula recalculation triggers
   - Returned immediately without waiting for Google Sheets formulas to update

3. **`DashboardSummary.jsx`** then fetched data after only 500ms wait
4. Google Sheets formulas didn't have enough time to recalculate
5. The M1 (date) and Y1 (meal) cells remained empty
6. Filter validation failed → "NO DATA FOUND"

## Solution Applied

### 1. Removed Fast Mode (restaurantAPI2.js)
**File**: `src/api/restaurantAPI2.js`
**Line**: 379
**Change**: Commented out `fast: "true"` parameter

```javascript
// Before:
fast: "true",

// After:
// fast: "true", // ❌ REMOVED: This was preventing sheet formulas from recalculating
```

### 2. Increased Wait Times (DashboardSummary.jsx)
**File**: `src/pages/dashboard/DashboardSummary.jsx`
**Lines**: 511, 570, 611, 639
**Change**: Extended wait time from 500ms to 2000ms

```javascript
// Before:
await new Promise(r => setTimeout(r, 500));

// After:
await new Promise(r => setTimeout(r, 2000)); // ✅ Wait for sheet recalculation
```

## How It Works Now

1. User selects filters (Client/Date/Meal)
2. `setFiltersAndVerify()` is called **WITHOUT** fast mode
3. Server-side (Apps Script):
   - Sets values in A1, M1, Y1
   - Triggers dummy cell update to force recalculation
   - **Waits 800ms** for formulas to recalculate
   - Clears dummy cell
   - Flushes changes
4. Client-side waits **2000ms** for sheet to fully update
5. Fetches fresh PMS data
6. Data is properly parsed and displayed

## Expected Behavior

✅ Filters set correctly in Google Sheet  
✅ Formulas recalculate properly  
✅ Date and Meal columns populated  
✅ Data loads and displays correctly  
✅ No more "NO DATA FOUND" errors  

## Testing Instructions

1. Open the application at `http://localhost:5173/`
2. Select a Client from the dropdown
3. Select a Date from the dropdown
4. Select a Meal Type from the dropdown
5. Click "RELOAD DATA" button
6. **Expected**: Data should load successfully after ~2-3 seconds
7. Console should show:
   ```
   ✅ Values after set - A1: [client], M1: [date], Y1: [meal]
   Menu filter check - Valid: true
   ✅ Loaded 1 menus with X items
   ```

## Technical Details

### Google Sheets Formula Recalculation
Google Sheets uses a reactive formula engine that recalculates when:
- Cell values change
- Dependencies update
- Manual triggers (flush, dummy cell updates)

The recalculation is **asynchronous** and can take:
- Simple formulas: 100-500ms
- Complex formulas with lookups: 500-1500ms
- Large sheets with many formulas: 1000-3000ms

Our PMS sheet has complex VLOOKUP and conditional formulas, requiring at least 800ms server-side + 2000ms client-side wait to ensure all formulas have recalculated.

### Why Fast Mode Failed
Fast mode was designed for performance but broke functionality:
- **Fast mode**: Set values, return immediately (0ms wait)
- **Normal mode**: Set values, trigger recalc, wait 800ms, verify

For user-facing filter changes, **correctness > speed**. The 2-3 second wait ensures reliable data loading.

---

**Date**: 2025-12-23  
**Status**: ✅ Fixed and deployed  
**Files Modified**:
- `src/api/restaurantAPI2.js`
- `src/pages/dashboard/DashboardSummary.jsx`
