// DashboardSummary.jsx - PMS Data Display (Fully Dynamic with MENU options)
import React, { useState, useEffect } from "react";
import { fetchPMSData, fetchMenuOptions } from "../../api/restaurantAPI2";

// Date ko dd-MMM-yyyy format me convert karo
const formatDate = (date) => {
  if (!date) return "";

  if (typeof date === "string") {
    // Already formatted ho sakta hai
    if (/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(date.trim())) {
      return date.trim();
    }
  }

  const d = new Date(date);
  if (isNaN(d)) return "";

  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "short" });
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

// Header row se dynamic tareeke se meal, pax, date, client nikalne ka helper
const extractHeaderInfo = (row) => {
  if (!row) return null;

  const cells = row.filter((c) => c !== "" && c != null && c !== undefined);
  if (cells.length < 3) return null;

  const numbers = [];
  const dates = [];
  const texts = [];

  cells.forEach((cell) => {
    const str = cell.toString().trim();

    const num = Number(str.replace(",", ""));
    if (!isNaN(num) && str !== "") {
      numbers.push(num);
      return;
    }

    if (/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(str)) {
      dates.push(str);
      return;
    }
    const d = new Date(str);
    if (!isNaN(d) && d.getFullYear() > 2000 && d.getFullYear() < 2100) {
      dates.push(d);
      return;
    }

    texts.push(str);
  });

  if (numbers.length === 0 || dates.length === 0 || texts.length === 0) {
    return null;
  }

  const meal = texts[0];
  const client = texts[texts.length - 1];
  const pax = numbers[0];
  const rawDate = dates[0];
  const date =
    rawDate instanceof Date ? formatDate(rawDate) : formatDate(rawDate);

  return {
    meal: meal.toString().trim(),
    client: client.toString().trim(),
    pax,
    date,
  };
};

// Complete PMS sheet ko parse karo – jitne bhi meal blocks hai sab nikal lo
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

    // 👉 Items row = header ke 2 rows niche (Item 1 wali row ke baad)
    const itemsRow = rows[i + 2];
    if (itemsRow) {
      console.log("🧾 Items row (fixed) @ row", i + 2, "=>", itemsRow);
    }

    const items = [];
    if (itemsRow) {
      itemsRow.forEach((cell) => {
        const name = cell?.toString().trim();
        if (
          name &&
          name !== "" &&
          !/^item\s*\d*/i.test(name) && // "Item 1" jaisi cheeze hatao
          name !== "#N/A"
        ) {
          items.push({
            name,
            planned: "",
            unit: "",
            actual: "",
          });
        }
      });
    }

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

export default function DashboardSummary() {
  const [mealType, setMealType] = useState("");
  const [selectedDate, setSelectedDate] = useState(""); // string format dd-MMM-yyyy
  const [client, setClient] = useState("");

  const [allMenus, setAllMenus] = useState([]);
  const [mealOptions, setMealOptions] = useState([]);
  const [clientOptions, setClientOptions] = useState([]);
  const [dateOptions, setDateOptions] = useState([]);

  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      // PMS = actual data, MENU = dropdown options
      const [pmsRows, menuOpts] = await Promise.all([
        fetchPMSData(),
        fetchMenuOptions(),
      ]);

      // PMS parse
      const menus = parsePMSSheet(pmsRows);
      setAllMenus(menus);

      // MENU sheet se options
      let meals = menuOpts.meals || [];
      let clients = menuOpts.clients || [];
      let datesRaw = menuOpts.dates || [];

      // Fallback: agar MENU sheet khali ho to PMS se hi options nikaal lo
      if (meals.length === 0) {
        meals = [...new Set(menus.map((m) => m.meal))].filter(Boolean);
      }
      if (clients.length === 0) {
        clients = [...new Set(menus.map((m) => m.client))].filter(Boolean);
      }
      if (datesRaw.length === 0) {
        datesRaw = [...new Set(menus.map((m) => m.date))].filter(Boolean);
      }

      const dates = datesRaw.map((d) => formatDate(d)).filter(Boolean);

      meals.sort();
      clients.sort();
      dates.sort(
        (a, b) =>
          new Date(a.split("-").reverse().join("-")) -
          new Date(b.split("-").reverse().join("-"))
      );

      console.log("🍽️ UI Meals options:", meals);
      console.log("🏢 UI Clients options:", clients);
      console.log("📅 UI Dates options:", dates);

      setMealOptions(meals);
      setClientOptions(clients);
      setDateOptions(dates);

      // Defaults
      if (!mealType && meals.length > 0) setMealType(meals[0]);
      if (!client && clients.length > 0) setClient(clients[0]);
      if (!selectedDate && dates.length > 0) setSelectedDate(dates[0]);
    } catch (err) {
      console.error("❌ Error loading data:", err);
      setAllMenus([]);
      setMealOptions([]);
      setClientOptions([]);
      setDateOptions([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // User selection ke base pe current menu choose karo
  const currentMenu = allMenus.find((menu) => {
    return (
      menu.meal?.toLowerCase() === mealType?.toLowerCase() &&
      menu.date?.toLowerCase() === selectedDate?.toLowerCase() &&
      menu.client?.toLowerCase() === client?.toLowerCase()
    );
  });

  const items = currentMenu?.items || [];
  const pax = currentMenu?.pax || "?";

  return (
    <div className="p-8 min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100">
      {/* Filters */}
      <div className="bg-white rounded-3xl shadow-2xl p-10 mb-12 border-4 border-indigo-200">
        <div className="flex flex-wrap items-end justify-center gap-10">
          {/* Meal */}
          <div className="text-center">
            <label className="block text-2xl font-bold text-indigo-800 mb-3">
              Meal
            </label>
            <select
              value={mealType}
              onChange={(e) => setMealType(e.target.value)}
              className="px-12 py-5 text-2xl border-4 border-indigo-600 rounded-2xl font-bold bg-gradient-to-r from-indigo-50 to-purple-50"
            >
              {mealOptions.length > 0 ? (
                mealOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))
              ) : (
                <option>No Meals</option>
              )}
            </select>
          </div>

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
            className="px-20 py-6 bg-gradient-to-r from-purple-700 to-indigo-800 text-white text-3xl font-extrabold rounded-3xl shadow-2xl hover:scale-110 transition transform"
          >
            RELOAD DATA
          </button>
        </div>
      </div>

      {/* Data Display */}
      {loading ? (
        <div className="text-center py-64">
          <div className="inline-block animate-spin rounded-full h-40 w-40 border-t-16 border-b-16 border-purple-600"></div>
          <p className="mt-16 text-6xl font-bold text-purple-800">
            Loading Menu...
          </p>
        </div>
      ) : currentMenu ? (
        <div className="bg-white rounded-3xl shadow-2xl p-16 border-12 border-blue-500">
          <h1 className="text-7xl font-extrabold text-center mb-12 text-blue-800">
            {mealType} • {pax} Persons
            <br />
            <span className="text-5xl text-blue-700 block mt-6">
              {selectedDate} • {client}
            </span>
          </h1>

          {/* Sirf ITEMS table */}
          <div className="max-h-screen overflow-y-auto">
            <table className="w-full text-2xl">
              <thead className="sticky top-0 bg-blue-800 text-white">
                <tr>
                  <th className="p-8 text-left">Item Name</th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? (
                  items.map((item, i) => (
                    <tr
                      key={i}
                      className="border-b-4 hover:bg-blue-50 transition"
                    >
                      <td className="p-8 font-medium">{item.name}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="p-8 text-center text-gray-500">
                      No items found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-64 bg-red-100 rounded-3xl shadow-2xl">
          <p className="text-9xl font-extrabold text-red-600">NO MENU FOUND</p>
          <p className="text-5xl text-gray-700 mt-12">
            {mealType} • {selectedDate} • {client}
          </p>
          <p className="text-3xl text-gray-600 mt-8">
            Total menus available: {allMenus.length}
          </p>
        </div>
      )}
    </div>
  );
}
