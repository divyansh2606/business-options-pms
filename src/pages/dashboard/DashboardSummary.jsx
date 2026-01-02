// DashboardSummary.jsx - Optimized for Immediate Data Fetching and Caching
import React, { useState, useEffect, useRef } from "react";
import {
  fetchPMSData,
  updatePMSDropdown,
  updateCell,
  fetchDynamicClients,
  fetchDynamicDates,
  fetchDynamicMeals,
  setFiltersAndVerify,
} from "../../api/restaurantAPI2";

const DROPDOWN_CELLS = {
  client: "A1",
  date: "P1",
  meal: "A2",
};

const formatDate = (date) => {
  if (!date) return "";
  let d;
  let str = date.toString().trim();
  if (date instanceof Date && !isNaN(date)) {
    d = date;
  } else {
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      d = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    } else if (str.match(/^\d{2}-[A-Za-z]{3}-\d{4}$/)) {
      d = new Date(str);
    } else {
      d = new Date(str);
    }
  }
  if (!d || isNaN(d.getTime())) return str;
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "short" });
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

const isNumericCell = (v) => {
  if (v === null || v === undefined || v === "") return false;
  if (typeof v === "number") return !isNaN(v);
  return !isNaN(Number(v));
};

const parsePMSSheet = (rows, verificationData = null) => {
  if (rows.length === 0) return [];
  const row0 = rows[0] || [];
  const row1 = rows[1] || [];

  let client = row0[0]?.toString().trim();
  if (!client || client === "" || client === "#N/A") {
    client = verificationData?.requested?.client || verificationData?.actual?.client || "Unknown Client";
  }

  let date = row0[15]?.toString().trim() || rows[1]?.[15]?.toString().trim() || row0[12]?.toString().trim();
  if (date && !isNaN(new Date(date).getTime())) {
    date = formatDate(new Date(date));
  } else {
    date = verificationData?.requested?.date || "Unknown Date";
  }

  const pax = row0[10] ? Number(row0[10]) : 0;
  let meal = row1[0]?.toString().trim() || row0[30]?.toString().trim();
  if (!meal || meal === "" || meal === "#N/A") {
    meal = verificationData?.requested?.meal || "Unknown Meal";
  }

  const dishHeaders = [];
  let itemLabelRow = -1;
  let dishNameRow = -1;

  for (let r = 0; r < Math.min(10, rows.length); r++) {
    const row = rows[r] || [];
    for (let c = 0; c < 50; c++) {
      const cell = row[c]?.toString().trim().toLowerCase();
      if (cell && cell.match(/^item\s+\d+$/)) {
        itemLabelRow = r;
        dishNameRow = r + 1;
        break;
      }
    }
    if (itemLabelRow >= 0) break;
  }

  if (itemLabelRow < 0) return [];

  const itemRow = rows[itemLabelRow] || [];
  const nameRow = rows[dishNameRow] || [];

  for (let c = 0; c < 50; c++) {
    const itemLabel = itemRow[c]?.toString().trim();
    if (itemLabel && itemLabel.toLowerCase().match(/^item\s+\d+$/)) {
      let dishName = nameRow[c]?.toString().trim();
      if (!dishName || dishName === "#N/A" || dishName === "") dishName = itemLabel;
      if (dishName.toLowerCase() === "item name") continue;
      dishHeaders.push({ col: c, name: dishName, ingredients: [], planned: 0, actual: 0, unit: "", actualCell: null });
    }
  }

  let totalsRow = -1;
  for (let r = itemLabelRow + 1; r < Math.min(itemLabelRow + 6, rows.length); r++) {
    const row = rows[r] || [];
    for (let c = 0; c < 50; c++) {
      const cell = row[c]?.toString().trim().toLowerCase();
      if (cell === "planned" || cell === "actual") {
        totalsRow = r;
        break;
      }
    }
    if (totalsRow >= 0) break;
  }

  if (totalsRow >= 0) {
    const totalRow = rows[totalsRow] || [];
    dishHeaders.forEach(dish => {
      dish.planned = Number(totalRow[dish.col + 1]) || 0;
      dish.unit = totalRow[dish.col + 2]?.toString().trim() || "";
      dish.actual = Number(totalRow[dish.col + 3]) || 0;
      dish.actualCell = { rowIndex: totalsRow, colIndex: dish.col + 3 };
    });
  }

  let ingredientsStartRow = totalsRow + 2;
  for (let r = totalsRow + 1; r < Math.min(totalsRow + 5, rows.length); r++) {
    const row = rows[r] || [];
    for (let c = 0; c < 50; c++) {
      if (row[c]?.toString().trim().toLowerCase() === "item name") {
        ingredientsStartRow = r + 1;
        break;
      }
    }
    if (ingredientsStartRow > totalsRow + 2) break;
  }

  for (let r = ingredientsStartRow; r < Math.min(150, rows.length); r++) {
    const row = rows[r];
    if (!row || row.length === 0) break;
    const firstCell = row[0]?.toString().trim().toLowerCase();
    if (firstCell && (firstCell.includes("breakfast") || firstCell.includes("lunch") || firstCell.includes("dinner") || firstCell.includes("morning"))) break;

    dishHeaders.forEach(dish => {
      const ingName = row[dish.col]?.toString().trim();
      if (ingName && ingName !== "#N/A" && ingName !== "" && !["total", "diff", "item name"].includes(ingName.toLowerCase())) {
        const planned = Number(row[dish.col + 1]) || 0;
        const actual = Number(row[dish.col + 3]) || 0;
        dish.ingredients.push({
          name: ingName,
          planned,
          actual,
          unit: row[dish.col + 2]?.toString().trim() || "",
          actualCell: { rowIndex: r, colIndex: dish.col + 3 },
          diff: planned - actual
        });
      }
    });
  }

  const items = dishHeaders.map(d => ({
    name: d.name,
    planned: d.ingredients.reduce((acc, curr) => acc + curr.planned, 0),
    actual: d.ingredients.reduce((acc, curr) => acc + curr.actual, 0),
    unit: d.unit,
    actualCell: d.actualCell,
    diff: d.planned - d.actual,
    ingredients: d.ingredients
  }));

  return [{ meal, date: formatDate(date), client, pax, items }];
};

export default function DashboardSummary() {
  const [loading, setLoading] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('dashboard_data_cache') || '[]');
      return !(cached && Array.isArray(cached) && cached.length > 0);
    } catch (e) {
      return true;
    }
  });
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaveStatus, setLastSaveStatus] = useState("");

  const [client, setClient] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [mealType, setMealType] = useState("");

  const [clientOptions, setClientOptions] = useState(() => JSON.parse(localStorage.getItem('pms_client_options') || '[]'));
  const [dateOptions, setDateOptions] = useState(() => JSON.parse(localStorage.getItem('pms_date_options') || '[]'));
  const [mealOptions, setMealOptions] = useState(() => JSON.parse(localStorage.getItem('pms_meal_options') || '[]'));

  const [allMenus, setAllMenus] = useState(() => JSON.parse(localStorage.getItem('dashboard_data_cache') || '[]'));
  const [dataCache, setDataCache] = useState(() => JSON.parse(localStorage.getItem('pms_full_data_cache') || '{}'));

  const bootstrappedRef = useRef(false);

  useEffect(() => {
    localStorage.setItem('pms_full_data_cache', JSON.stringify(dataCache));
    localStorage.setItem('dashboard_data_cache', JSON.stringify(allMenus));
    localStorage.setItem('pms_client_options', JSON.stringify(clientOptions));
    localStorage.setItem('pms_date_options', JSON.stringify(dateOptions));
    localStorage.setItem('pms_meal_options', JSON.stringify(mealOptions));
  }, [dataCache, allMenus, clientOptions, dateOptions, mealOptions]);

  const validateFetchedData = (menus, expectedClient, expectedDate, expectedMeal) => {
    if (!menus || menus.length === 0) return false;
    const menu = menus[0];
    const normalize = (s) => s?.toString().trim().toLowerCase() || "";
    const clientMatch = normalize(menu.client) === normalize(expectedClient);
    if (menu.items?.length > 0 && clientMatch) return true;
    return clientMatch && normalize(menu.date).includes(normalize(formatDate(expectedDate))) && normalize(menu.meal) === normalize(expectedMeal);
  };

  const fetchAndValidateData = async (expectedClient, expectedDate, expectedMeal, verificationData = null, maxRetries = 3) => {
    const cacheKey = `${expectedClient}_${expectedDate}_${expectedMeal}`.toLowerCase();
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (attempt > 1) await new Promise(r => setTimeout(r, 1500));
      const rows = await fetchPMSData();
      const menus = parsePMSSheet(rows, verificationData);
      if (menus.length > 0 && menus[0].items?.length > 0) {
        if (validateFetchedData(menus, expectedClient, expectedDate, expectedMeal)) {
          setDataCache(prev => ({ ...prev, [cacheKey]: menus }));
          return menus;
        }
        setDataCache(prev => ({ ...prev, [cacheKey]: menus }));
        return menus;
      }
      if (attempt < maxRetries) verificationData = await setFiltersAndVerify(expectedClient, expectedDate, expectedMeal);
    }
    return [];
  };

  const loadData = async () => {
    // If we already have cached menu data, keep UI responsive and refresh in background
    if (!allMenus || allMenus.length === 0) setLoading(true);
    try {
      const allClients = await fetchDynamicClients();
      setClientOptions(allClients);
      const currentClient = client || localStorage.getItem('pms_selected_client') || allClients[0];
      if (currentClient) {
        setClient(currentClient);
        const dates = await fetchDynamicDates(currentClient);
        setDateOptions(dates);
        const targetDate = localStorage.getItem('pms_selected_date') || dates[0];
        if (targetDate) {
          setSelectedDate(targetDate);
          const meals = await fetchDynamicMeals(currentClient, targetDate);
          setMealOptions(meals);
          const targetMeal = localStorage.getItem('pms_selected_meal') || meals[0];
          if (targetMeal) {
            setMealType(targetMeal);
            const cacheKey = `${currentClient}_${targetDate}_${targetMeal}`.toLowerCase();
            if (dataCache[cacheKey]) {
              setAllMenus(dataCache[cacheKey]);
              setLoading(false);
              setFiltersAndVerify(currentClient, { value: targetDate, fast: true }, { value: targetMeal, fast: true })
                .then(v => fetchAndValidateData(currentClient, targetDate, targetMeal, v));
            } else {
              const v = await setFiltersAndVerify(currentClient, targetDate, targetMeal);
              const m = await fetchAndValidateData(currentClient, targetDate, targetMeal, v);
              if (m) setAllMenus(m);
              setLoading(false);
            }
          }
        }
      }
    } catch (e) { setLoading(false); }
  };

  useEffect(() => {
    if (bootstrappedRef.current) return; // prevents double fetch in React 18 StrictMode dev
    bootstrappedRef.current = true;
    loadData();
  }, []);

  const handleClientChange = async (e) => {
    const newVal = e.target.value;
    setClient(newVal);
    localStorage.setItem('pms_selected_client', newVal);
    setLoading(true);
    const dates = await fetchDynamicDates(newVal);
    setDateOptions(dates);
    const targetDate = dates[0];
    setSelectedDate(targetDate);
    localStorage.setItem('pms_selected_date', targetDate);
    const meals = await fetchDynamicMeals(newVal, targetDate);
    setMealOptions(meals);
    const targetMeal = meals[0];
    setMealType(targetMeal);
    localStorage.setItem('pms_selected_meal', targetMeal);

    const cacheKey = `${newVal}_${targetDate}_${targetMeal}`.toLowerCase();
    if (dataCache[cacheKey]) setAllMenus(dataCache[cacheKey]); else setAllMenus([]);

    const v = await setFiltersAndVerify(newVal, { value: targetDate, fast: true }, { value: targetMeal, fast: true });
    await new Promise(r => setTimeout(r, 50));
    const m = await fetchAndValidateData(newVal, targetDate, targetMeal, v);
    if (m) setAllMenus(m);
    setLoading(false);
  };

  const handleDateChange = async (e) => {
    const newVal = e.target.value;
    setSelectedDate(newVal);
    localStorage.setItem('pms_selected_date', newVal);
    const meals = await fetchDynamicMeals(client, newVal);
    setMealOptions(meals);
    let targetMeal = mealType;
    if (!meals.includes(targetMeal)) targetMeal = meals[0];
    setMealType(targetMeal);
    localStorage.setItem('pms_selected_meal', targetMeal);

    const cacheKey = `${client}_${newVal}_${targetMeal}`.toLowerCase();
    if (dataCache[cacheKey]) setAllMenus(dataCache[cacheKey]); else { setAllMenus([]); setLoading(true); }

    const v = await setFiltersAndVerify(client, { value: newVal, fast: true }, { value: targetMeal, fast: true });
    await new Promise(r => setTimeout(r, 50));
    const m = await fetchAndValidateData(client, newVal, targetMeal, v);
    if (m) setAllMenus(m);
    setLoading(false);
  };

  const handleMealChange = async (e) => {
    const newVal = e.target.value;
    setMealType(newVal);
    localStorage.setItem('pms_selected_meal', newVal);
    const cacheKey = `${client}_${selectedDate}_${newVal}`.toLowerCase();
    if (dataCache[cacheKey]) setAllMenus(dataCache[cacheKey]); else { setAllMenus([]); setLoading(true); }

    const v = await setFiltersAndVerify(client, selectedDate, { value: newVal, fast: true });
    await new Promise(r => setTimeout(r, 50));
    const m = await fetchAndValidateData(client, selectedDate, newVal, v);
    if (m) setAllMenus(m);
    setLoading(false);
  };

  const handleAutoSave = async (cell, value) => {
    if (!cell) return;
    setAutoSaving(true);
    try {
      await updateCell("PMS", cell.rowIndex + 1, cell.colIndex, value);
      setLastSaveStatus(`✅ Saved`);
    } catch (e) { setLastSaveStatus(`❌ Error`); }
    setTimeout(() => setAutoSaving(false), 2000);
  };

  const handleForceReload = async () => {
    setLoading(true);
    const v = await setFiltersAndVerify(client, selectedDate, mealType);
    await new Promise(r => setTimeout(r, 300));
    const m = await fetchAndValidateData(client, selectedDate, mealType, v);
    if (m) setAllMenus(m);
    setLoading(false);
  };

  return (
    <div className="p-0 md:p-8 min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100">
      <div className="m-4 md:m-0 bg-gradient-to-r from-white to-indigo-50 rounded-3xl shadow-2xl p-6 md:p-10 mb-8 border-4 border-indigo-300">
        <h2 className="text-2xl md:text-3xl font-extrabold text-indigo-900 mb-6 text-center">📊 Select Filters</h2>
        <div className="flex flex-wrap items-end justify-center gap-6 md:gap-8">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm md:text-lg font-bold text-indigo-700 mb-2 uppercase tracking-wide">👤 Client</label>
            <select value={client} onChange={handleClientChange} className="w-full px-5 py-3 md:px-6 md:py-4 text-base md:text-xl font-semibold bg-white border-3 border-indigo-500 rounded-xl shadow-lg hover:shadow-2xl hover:border-indigo-600 outline-none">
              {clientOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm md:text-lg font-bold text-indigo-700 mb-2 uppercase tracking-wide">📅 Date</label>
            <select value={selectedDate} onChange={handleDateChange} className="w-full px-5 py-3 md:px-6 md:py-4 text-base md:text-xl font-semibold bg-white border-3 border-indigo-500 rounded-xl shadow-lg hover:shadow-2xl hover:border-indigo-600 outline-none">
              {dateOptions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm md:text-lg font-bold text-orange-700 mb-2 uppercase tracking-wide">🍽️ Meal Type</label>
            <select value={mealType} onChange={handleMealChange} className="w-full px-5 py-3 md:px-6 md:py-4 text-base md:text-xl font-semibold bg-white border-3 border-orange-500 rounded-xl shadow-lg hover:shadow-2xl hover:border-orange-600 outline-none">
              {mealOptions.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2 w-full md:w-auto">
            <button onClick={handleForceReload} className="w-full md:w-auto px-6 py-3 md:px-16 md:py-5 bg-purple-800 text-white text-base md:text-2xl font-extrabold rounded-2xl md:rounded-3xl shadow-xl hover:bg-purple-900">RELOAD DATA</button>
            {autoSaving && <p className="text-center text-green-600 font-bold animate-pulse text-sm">💾 Saving...</p>}
          </div>
        </div>
      </div>
      {loading ? <p className="text-center text-4xl py-64">Loading...</p> : allMenus.length === 0 ? <div className="text-center py-32 text-4xl">NO DATA FOUND</div> :
        allMenus.map((menu, menuIdx) => {
          const rowMap = new Map();
          menu.items.forEach((item, itemColIdx) => { item.ingredients.forEach(ing => { if (ing.actualCell) { const r = ing.actualCell.rowIndex; if (!rowMap.has(r)) rowMap.set(r, {}); rowMap.get(r)[itemColIdx] = ing; } }); });
          const sortedRowIndices = Array.from(rowMap.keys()).sort((a, b) => a - b);
          return (
            <div key={menuIdx} className="bg-white md:rounded-3xl md:shadow-xl md:p-6 mb-12 border-b-4 md:border-4 border-indigo-200 overflow-x-auto w-full">
              <h1 className="text-xl md:text-3xl font-extrabold text-indigo-900 mb-4 md:mb-6 border-b-4 border-indigo-100 pb-4 sticky left-0 px-4 md:px-0">{menu.meal} • {menu.pax} Pax • {menu.date} • {menu.client}</h1>
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-indigo-600 text-white"><th className="p-3 border bg-indigo-700 min-w-[50px]">#</th>{menu.items.map((item, idx) => <th key={idx} colSpan={3} className="p-3 border border-indigo-500 text-center font-bold text-lg">{item.name}</th>)}</tr>
                  <tr className="bg-indigo-50 text-indigo-900 font-semibold"><th className="p-2 border bg-indigo-100">Row</th>{menu.items.map((_, idx) => <React.Fragment key={idx}><th className="p-2 border min-w-[120px]">Item Name</th><th className="p-2 border w-24">Planned</th><th className="p-2 border w-32">Actual</th></React.Fragment>)}</tr>
                </thead>
                <tbody>
                  <tr className="bg-yellow-50 font-bold border-b-4 border-indigo-100"><td className="p-3 border text-center bg-yellow-100 text-yellow-800">TOTALS</td>{menu.items.map((item, idx) => <React.Fragment key={idx}><td className="p-3 border text-center text-gray-500 italic">(Dish Total)</td><td className="p-3 border text-center text-indigo-700 text-lg">{item.planned} {item.unit}</td><td className="p-3 border text-center bg-white"><div className="flex items-center justify-center gap-1"><input type="number" defaultValue={item.actual === 0 ? "" : item.actual} onBlur={(e) => handleAutoSave(item.actualCell, e.target.value)} className="w-20 p-1 border-2 border-yellow-300 rounded text-center bg-yellow-50 outline-none" /><span className="text-xs text-gray-400">{item.unit}</span></div></td></React.Fragment>)}</tr>
                  {sortedRowIndices.map((rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-gray-50 even:bg-gray-50">
                      <td className="p-2 border text-center text-xs text-gray-400 font-mono bg-white">{rowIndex + 1}</td>
                      {menu.items.map((item, itemIdx) => {
                        const ing = rowMap.get(rowIndex)[itemIdx];
                        if (!ing) return <React.Fragment key={itemIdx}><td className="border bg-gray-50/30"></td><td className="border bg-gray-50/30"></td><td className="border bg-gray-50/30"></td></React.Fragment>;
                        return (
                          <React.Fragment key={itemIdx}>
                            <td className="p-2 border font-medium text-gray-700">{ing.name}</td>
                            <td className="p-2 border text-center text-gray-600">{ing.planned} {ing.unit}</td>
                            <td className="p-2 border text-center"><div className="flex items-center justify-center gap-1"><input type="number" defaultValue={ing.actual === 0 ? "" : ing.actual} onBlur={(e) => handleAutoSave(ing.actualCell, e.target.value)} className={`w-20 p-1 border rounded text-center outline-none ${ing.diff < 0 ? "border-red-300 bg-red-50 text-red-700" : ing.diff > 0 ? "border-green-300 bg-green-50 text-green-700" : "border-gray-300"}`} />{ing.unit && <span className="text-xs text-gray-400">{ing.unit}</span>}</div></td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })
      }
    </div>
  );
}