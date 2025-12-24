# 🚀 QUICK START: Fix Your Data Fetching Issue

## THE PROBLEM
Your app was reading data from **WRONG cells**:
- ❌ Reading date from **P1** (should be **M1**)  
- ❌ Reading meal from **AE1** (should be **Y1**)

This is why you were seeing wrong or "Unknown" data!

---

## THE FIX (2 STEPS)

### ✅ STEP 1: Update Apps Script (MUST DO FIRST!)

1. **Open your Google Sheet**:  
   https://docs.google.com/spreadsheets/d/1eV02EdigeQuKp2VHLZA0xUIstj9xqvmTZ_-wMaIZv7E

2. **Open Apps Script**:  
   Click: **Extensions** → **Apps Script**

3. **Replace the code**:
   - Copy **ALL** code from `appscript.js` in this project folder
   - Paste into the Apps Script editor (replace everything)

4. **Deploy**:
   - Click **Deploy** → **Manage deployments**
   - Click the **edit icon** (pencil) on your existing deployment
   - Change **Version** to **"New version"**
   - Description: `Fixed M1/Y1 cell references`
   - Click **Deploy**
   - ✅ Done!

### ✅ STEP 2: Test the App

1. **Refresh your React app**:
   - Hard refresh: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows)

2. **Use the app**:
   - Select a **Client** (e.g., "CPLA")
   - Select a **Date** (e.g., "25-Dec-2023")
   - Select a **Meal** (e.g., "Dinner")
   - Click **"RELOAD DATA"** button

3. **Verify it works**:
   - Open browser console (press **F12**)
   - You should see:
     ```
     📍 Dropdown cells: {client: "A1 (col 0)", date: "M1 (col 12)", meal: "Y1 (col 24)"}
     📋 PARSED: Client="CPLA" Date="25-Dec-2023" Pax=220 Meal="Dinner"
     ```
   - The table should show **correct data** for your selection!

---

## WHAT WAS FIXED

| Component | Before (❌ Wrong) | After (✅ Correct) |
|-----------|-------------------|-------------------|
| **Date Cell** | P1 (column 15) | M1 (column 12) |
| **Meal Cell** | AE1 (column 30) | Y1 (column 24) |
| **Pax Cell** | O1 (column 14) | J1 (column 9) |
| **Column Detection** | Hardcoded | Auto-detect |

---

## TROUBLESHOOTING

**Still seeing wrong data?**
1. ✅ Make sure you deployed the **new version** in Apps Script
2. ✅ Clear browser cache: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
3. ✅ Try in **incognito/private window**
4. ✅ Check console (F12) for any errors

**Console shows errors?**
- Check that Apps Script deployment is successful
- Make sure the sheet name is "PMS"
- Verify cells M1 and Y1 have data in your sheet

**Need more details?**
- Read `FIX_SUMMARY.md` for technical details
- Read `DEPLOY_APPSCRIPT.md` for deployment guide

---

## DONE! 🎉

Your app should now fetch the **exact data** from your Google Sheet according to the filters you select!
