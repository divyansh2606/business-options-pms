// DashboardSummary.jsx - Systematic PMS View (Meals → Dishes → Ingredients) + Save button
import React, { useState, useEffect } from "react";
import {
  fetchPMSData,
  fetchMenuOptions,
  updatePMSCells,
} from "../../api/restaurantAPI2";

// ----------------------- helpers -----------------------

// hamesha "dd-MMM-yyyy" return karega (e.g. 07-Dec-2025)
const formatDate = (date) => {
  if (!date) return "";

  const d = new Date(date);
  if (isNaN(d)) {
    // fallback: raw string hi dikha do
    return date.toString().trim();
  }

  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "short" });
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

const isNumericCell = (v) => {
  if (v === null || v === undefined || v === "") return false;
  if (typeof v === "number") return !isNaN(v);
  const n = Number(v);
  return !isNaN(n);
};

// -------- FIXED: detect meal header ANYWHERE in row --------
const extractHeaderInfo = (row) => {
  if (!row || row.length === 0) return null;

  const mealKeywords = [
    "morning",
    "breakfast",
    "lunch",
    "evening",
    "evening snacks",
    "dinner",
  ];

  let meal = null;
  let pax = null;
  let date = null;
  let client = null;

  row.forEach((cell) => {
    if (cell == null || cell === "") return;

    const str = cell.toString().trim();
    const lower = str.toLowerCase();

    // 🎯 MEAL: row me kahin bhi ho sakta hai
    if (!meal && mealKeywords.includes(lower)) {
      meal = str;
      return;
    }

    // 📅 DATE
    if (!date) {
      // direct parse
      const d = new Date(str);
      if (!isNaN(d) && d.getFullYear() > 2000 && d.getFullYear() < 2100) {
        date = formatDate(d);
        return;
      }
    }

    // 🔢 PERSONS (PAX)
    if (pax == null && isNumericCell(str)) {
      const num = Number(str);
      if (num > 10 && num < 50000) {
        pax = num;
        return;
      }
    }

    // 🏢 CLIENT: last non-numeric, non-date, non-meal text
    if (!isNumericCell(str) && !mealKeywords.includes(lower) && str !== date) {
      client = str;
    }
  });

  if (!meal) return null; // header hi nahi

  return {
    meal,
    client: client || "",
    pax,
    date: date || "",
  };
};

// PMS sheet ko parse karo – har meal block ke liye:
// { meal, date, client, pax, items: [ { name, planned, actual, diff, unit, actualCell, ingredients: [...] } ] }
const parsePMSSheet = (rows) => {
  const menus = [];
  console.log("🔍 Parsing PMS sheet, total rows:", rows.length);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((cell) => cell === "" || cell == null)) continue;

    const header = extractHeaderInfo(row);
    if (!header) continue;

    console.log(
      `🎯 Meal header @ row ${i}:`,
      header.meal,
      "|",
      header.date,
      "|",
      header.client,
      "| pax:",
      header.pax
    );

    // dishes ka naam wali row: header ke 2 row niche
    const itemsRowIndex = i + 2;
    const itemsRow = rows[itemsRowIndex];
    if (!itemsRow) continue;

    // ---------- Dish headers row (actual dish names in Item 1, Item 2...) ----------
    const dishHeaders = [];
    for (let col = 0; col < itemsRow.length; col++) {
      const raw = itemsRow[col];
      const name = raw?.toString().trim();
      if (
        !name ||
        name === "" ||
        /^item\s*\d*/i.test(name) ||
        name === "#N/A"
      ) {
        continue;
      }
      dishHeaders.push({ col, name });
    }

    if (dishHeaders.length === 0) continue;
    console.log("🍛 Dish headers:", dishHeaders);

    // ---------- Dish Planned/Actual/Unit ----------
    const dishesWithMeta = dishHeaders.map((dish) => {
      const col = dish.col;
      let planned = 0;
      let actual = 0;
      let unit = "";
      let actualCell = null;

      for (
        let r = itemsRowIndex + 1;
        r <= itemsRowIndex + 10 && r < rows.length;
        r++
      ) {
        const dataRow = rows[r];
        if (!dataRow) continue;

        const pCell = dataRow[col];
        const aCell = dataRow[col + 1];
        const uCell = dataRow[col + 3];

        const hasNumeric = isNumericCell(pCell) || isNumericCell(aCell);
        if (!hasNumeric) continue;

        planned = isNumericCell(pCell) ? Number(pCell) : 0;
        actual = isNumericCell(aCell) ? Number(aCell) : 0;
        unit = (uCell || "").toString().trim();

        actualCell = { rowIndex: r, colIndex: col + 1 };

        console.log(
          `📦 Dish @ row ${r}, col ${col}:`,
          dish.name,
          "| P:",
          planned,
          "A:",
          actual,
          "U:",
          unit
        );
        break;
      }

      const diff = planned - actual;

      return {
        ...dish,
        planned,
        actual,
        diff,
        unit,
        actualCell,
      };
    });

    // ---------- Ingredients header row (common for all dishes in that meal) ----------
    let ingHeaderIndex = null;
    for (
      let r = itemsRowIndex + 1;
      r <= itemsRowIndex + 60 && r < rows.length;
      r++
    ) {
      const hr = rows[r];
      if (!hr) continue;

      const lower = hr.map((c) =>
        (c || "").toString().trim().toLowerCase()
      );

      const hasPlanned = lower.includes("planned");
      const hasUnit = lower.includes("unit");
      const countItemName = lower.filter((c) => c === "item name").length;

      // kam se kam 2 "Item Name" hone chahiye – tabhi ye ingredients header hai
      if (countItemName >= 2 && hasPlanned && hasUnit) {
        ingHeaderIndex = r;
        console.log(
          "🍲 Found ING header row @",
          r,
          "ItemName count:",
          countItemName,
          "=>",
          hr
        );
        break;
      }
    }

    let ingGroups = [];
    if (ingHeaderIndex != null) {
      const hr = rows[ingHeaderIndex];
      for (let col = 0; col < hr.length; col++) {
        const cell = (hr[col] || "").toString().trim().toLowerCase();
        if (cell === "item name") {
          ingGroups.push(col);
        }
      }
      console.log("🍱 Ingredient group start columns:", ingGroups);
    }

    const items = [];

    // ---------- ek-ek dish ke ingredients ----------
    dishesWithMeta.forEach((dish, idx) => {
      let ingredients = [];

      if (ingHeaderIndex != null && ingGroups.length > 0) {
        // dish index ke hisab se group choose karo
        const groupCol =
          idx < ingGroups.length ? ingGroups[idx] : ingGroups[ingGroups.length - 1];

        for (
          let r = ingHeaderIndex + 1;
          r < rows.length && r <= ingHeaderIndex + 200;
          r++
        ) {
          const ir = rows[r];
          if (!ir) continue;

          const ingNameRaw = ir[groupCol];
          const ingName = ingNameRaw?.toString().trim();

          const plannedVal = ir[groupCol + 1];
          const unitVal = ir[groupCol + 2];
          const actualVal = ir[groupCol + 3];

          const rowAllEmpty =
            !ingName &&
            (plannedVal === "" || plannedVal == null) &&
            (unitVal === "" || unitVal == null) &&
            (actualVal === "" || actualVal == null);

          if (rowAllEmpty) break;

          if (
            !ingName ||
            ingName === "" ||
            ingName === "#N/A" ||
            ingName.toLowerCase() === "item name"
          ) {
            continue;
          }

          const ingPlanned = isNumericCell(plannedVal)
            ? Number(plannedVal)
            : 0;
          const ingActual = isNumericCell(actualVal)
            ? Number(actualVal)
            : 0;
          const ingUnit = (unitVal || "").toString().trim();

          ingredients.push({
            name: ingName,
            planned: ingPlanned,
            actual: ingActual,
            unit: ingUnit,
            actualCell: {
              rowIndex: r,
              colIndex: groupCol + 3, // Actual column
            },
          });
        }
      }

      items.push({
        name: dish.name,
        planned: dish.planned,
        actual: dish.actual,
        diff: dish.diff,
        unit: dish.unit,
        actualCell: dish.actualCell,
        ingredients,
      });
    });

    menus.push({
      meal: header.meal,
      date: header.date,
      client: header.client,
      pax: header.pax || "?",
      items,
    });

    console.log(
      `✅ Menu added: ${header.meal} | ${header.date} | ${header.client} | items = ${items.length}`
    );
  }

  console.log("📊 FINAL MENUS COUNT:", menus.length);
  return menus;
};

// ----------------------- component -----------------------

export default function DashboardSummary() {
  const [allMenus, setAllMenus] = useState([]);
  const [client, setClient] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  const [clientOptions, setClientOptions] = useState([]);
  const [dateOptions, setDateOptions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState({}); // key -> {rowIndex,colIndex,value}

  const loadData = async () => {
    setLoading(true);
    try {
      const [pmsRows, menuOpts] = await Promise.all([
        fetchPMSData(),
        fetchMenuOptions(),
      ]);

      const menus = parsePMSSheet(pmsRows || []);
      setAllMenus(menus);

      let clients = menuOpts.clients || [];
      let datesRaw = menuOpts.dates || [];

      if (clients.length === 0) {
        const tmp = new Set();
        menus.forEach((m) => {
          if (m.client) tmp.add(m.client);
        });
        clients = Array.from(tmp);
      }

      if (datesRaw.length === 0) {
        const tmp = new Set();
        menus.forEach((m) => {
          if (m.date) tmp.add(m.date);
        });
        datesRaw = Array.from(tmp);
      }

      const dates = datesRaw
        .map((d) => formatDate(d))
        .filter(Boolean);

      clients.sort();
      dates.sort(
        (a, b) =>
          new Date(a.split("-").reverse().join("-")) -
          new Date(b.split("-").reverse().join("-"))
      );

      setClientOptions(clients);
      setDateOptions(dates);

      if (!client && clients.length > 0) setClient(clients[0]);
      if (!selectedDate && dates.length > 0) setSelectedDate(dates[0]);

      console.log(
        "📅 Parsed menus dates:",
        menus.map((m) => `${m.date} | ${m.client} | ${m.meal}`)
      );
    } catch (err) {
      console.error("❌ Error loading PMS/Menu:", err);
      setAllMenus([]);
      setClientOptions([]);
      setDateOptions([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Date + Client filter – same date/client ke sab meals (Morning, Lunch, Evening...)
   const filteredMenus = allMenus.filter(
    (m) => m.client?.toLowerCase() === client?.toLowerCase()
  );

  console.log("💡 All menus for client:", client, allMenus);

  const markUpdate = (cellMeta, newValue) => {
    if (!cellMeta) return;
    const { rowIndex, colIndex } = cellMeta;
    const key = `${rowIndex}_${colIndex}`;
    const val =
      newValue === "" || newValue === null
        ? ""
        : isNaN(Number(newValue))
        ? newValue
        : Number(newValue);

    setPendingUpdates((prev) => ({
      ...prev,
      [key]: { rowIndex, colIndex, value: val },
    }));
  };

  const hasPending = Object.keys(pendingUpdates).length > 0;

  const handleSaveAll = async () => {
    if (!hasPending) return;
    setSaving(true);
    try {
      const updatesArray = Object.values(pendingUpdates);
      console.log("💾 Sending updates:", updatesArray);
      const res = await updatePMSCells(updatesArray);
      console.log("💾 Save response:", res);
      setPendingUpdates({});
      await loadData();
    } catch (e) {
      console.error("❌ Error saving updates:", e);
    }
    setSaving(false);
  };

  return (
    <div className="p-8 min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100">
      {/* Filters */}
      <div className="bg-white rounded-3xl shadow-2xl p-10 mb-8 border-4 border-indigo-200">
        <div className="flex flex-wrap items-end justify-center gap-10">
          {/* Date */}
          <div className="text-center">
            <label className="block text-2xl font-bold text-indigo-800 mb-3">
              Date
            </label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-12 py-5 text-2xl border-4 border-indigo-600 rounded-2xl font-bold bg-gradient-to-r from-indigo-50 to-purple-50"
            >
              {dateOptions.length > 0 ? (
                dateOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))
              ) : (
                <option>No Dates</option>
              )}
            </select>
          </div>

          {/* Client */}
          <div className="text-center">
            <label className="block text-2xl font-bold text-indigo-800 mb-3">
              Client
            </label>
            <select
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className="px-12 py-5 text-2xl border-4 border-indigo-600 rounded-2xl font-bold bg-gradient-to-r from-indigo-50 to-purple-50"
            >
              {clientOptions.length > 0 ? (
                clientOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))
              ) : (
                <option>No Clients</option>
              )}
            </select>
          </div>

          {/* Reload */}
          <button
            onClick={loadData}
            className="px-16 py-5 bg-gradient-to-r from-purple-700 to-indigo-800 text-white text-2xl font-extrabold rounded-3xl shadow-2xl hover:scale-110 transition transform"
          >
            RELOAD DATA
          </button>

          {/* Save All Changes */}
          <button
            onClick={handleSaveAll}
            disabled={!hasPending || saving}
            className={`px-16 py-5 text-2xl font-extrabold rounded-3xl shadow-2xl transition transform ${
              hasPending && !saving
                ? "bg-green-600 text-white hover:scale-110"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {saving ? "SAVING..." : "SAVE ALL CHANGES"}
          </button>
        </div>

        {hasPending && !saving && (
          <p className="mt-4 text-center text-lg text-orange-600 font-semibold">
            You have unsaved changes. Click "SAVE ALL CHANGES" to update Google
            Sheet.
          </p>
        )}
      </div>

      {/* Data Display */}
      {loading ? (
        <div className="text-center py-64">
          <div className="inline-block animate-spin rounded-full h-40 w-40 border-t-16 border-b-16 border-purple-600"></div>
          <p className="mt-16 text-6xl font-bold text-purple-800">
            Loading PMS...
          </p>
        </div>
      ) : filteredMenus.length === 0 ? (
        <div className="text-center py-64 bg-red-100 rounded-3xl shadow-2xl">
          <p className="text-6xl font-extrabold text-red-600">NO DATA FOUND</p>
          <p className="text-4xl text-gray-700 mt-8">
            {selectedDate} • {client}
          </p>
        </div>
      ) : (
        <div className="space-y-16">
          {filteredMenus.map((menu, idx) => (
            <div
              key={idx}
              className="bg-white rounded-3xl shadow-2xl p-10 border-8 border-blue-400"
            >
              <h1 className="text-4xl font-extrabold text-center mb-8 text-blue-800">
                {menu.meal} • {menu.pax} Persons • {menu.date} • {menu.client}
              </h1>

              {/* Dishes as cards with ingredients */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {menu.items.map((item, i) => (
                  <div
                    key={i}
                    className="border-4 border-blue-200 rounded-2xl overflow-hidden bg-white shadow-md"
                  >
                    {/* Dish header + planned/actual/diff/unit */}
                    <div className="bg-blue-50 px-4 py-3">
                      <div className="text-2xl font-bold mb-2">
                        {item.name}
                      </div>
                      <div className="text-sm md:text-base flex flex-wrap gap-4">
                        <span>
                          <strong>Planned:</strong> {item.planned}{" "}
                          {item.unit}
                        </span>
                        <span>
                          <strong>Actual:</strong>{" "}
                          {item.actualCell ? (
                            <input
                              type="number"
                              defaultValue={item.actual}
                              onBlur={(e) =>
                                markUpdate(item.actualCell, e.target.value)
                              }
                              className="w-20 px-2 py-1 border-2 border-blue-400 rounded-lg text-right"
                            />
                          ) : (
                            item.actual
                          )}{" "}
                          {item.unit}
                        </span>
                        <span>
                          <strong>Diff:</strong>{" "}
                          {item.planned - item.actual}
                        </span>
                      </div>
                    </div>

                    {/* Ingredient table for this dish */}
                    {item.ingredients && item.ingredients.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm md:text-base">
                          <thead className="bg-blue-800 text-white">
                            <tr>
                              <th className="p-3 text-left">Item Name</th>
                              <th className="p-3 text-right">Planned</th>
                              <th className="p-3 text-right">Actual</th>
                              <th className="p-3 text-right">Unit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.ingredients.map((ing, j) => (
                              <tr
                                key={j}
                                className="border-t hover:bg-blue-50 transition"
                              >
                                <td className="p-3">{ing.name}</td>
                                <td className="p-3 text-right">
                                  {ing.planned}
                                </td>
                                <td className="p-3 text-right">
                                  {ing.actualCell ? (
                                    <input
                                      type="number"
                                      defaultValue={ing.actual}
                                      onBlur={(e) =>
                                        markUpdate(
                                          ing.actualCell,
                                          e.target.value
                                        )
                                      }
                                      className="w-20 px-2 py-1 border-2 border-blue-400 rounded-lg text-right"
                                    />
                                  ) : (
                                    ing.actual
                                  )}
                                </td>
                                <td className="p-3 text-right">
                                  {ing.unit}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
