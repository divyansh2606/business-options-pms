// src/api/stockAPI.js
// Stock API - IMS-O2D Google Sheet integration (hardened/timeout/retries)
const STOCK_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxDTPKbWz5FgBi9zJzFsECmt1jl-NOywdPV6wk1PXbN0jEW9y9HZE5FTgcW9LiJsOnL/exec";
/**
 * Fetch wrapper with timeout + simple retry on network errors.
 * @param {string} url
 * @param {object} opts fetch options
 * @param {number} timeoutMs milliseconds to abort (default 8000)
 * @param {number} retries number of retries on network failure (default 1)
 */
async function fetchWithTimeout(url, opts = {}, timeoutMs = 8000, retries = 1) {
  const controller = new AbortController();
  const signal = controller.signal;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...opts, signal });
    clearTimeout(timer);
    return response;
  } catch (err) {
    clearTimeout(timer);
    const isAbort = err && err.name === 'AbortError';
    // network error or abort
    if (retries > 0 && !isAbort) {
      // small delay before retrying
      await new Promise(res => setTimeout(res, 300));
      return fetchWithTimeout(url, opts, timeoutMs, retries - 1);
    }
    // rethrow with useful info
    const wrapped = new Error(isAbort ? 'Request timed out' : (err && err.message) || 'Network error');
    wrapped.original = err;
    throw wrapped;
  }
}

/**
 * Safe JSON parse: try json(), else fallback to text()
 * Additional hardening:
 * - trims whitespace
 * - strips a trailing '%' or stray characters after JSON
 * - attempts to locate first '[' or '{' and parse substring
 */
async function parseResponse(response) {
  const contentType = (response && response.headers && response.headers.get('content-type')) || '';
  let text = await response.text();
  if (!text) return null;
  text = String(text).trim();

  // Remove a trailing '%' (common from terminal printouts) or trailing control characters
  // and also remove weird leading/trailing characters that are not valid JSON.
  // Find first occurrence of '{' or '[' and last occurrence of '}' or ']'
  const firstJsonStart = Math.min(
    ...['{', '['].map(c => {
      const idx = text.indexOf(c);
      return idx === -1 ? Infinity : idx;
    })
  );
  const lastJsonEnd = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));

  if (firstJsonStart !== Infinity && lastJsonEnd !== -1 && lastJsonEnd >= firstJsonStart) {
    text = text.substring(firstJsonStart, lastJsonEnd + 1);
  } else {
    // fallback: strip trailing '%' and control chars
    text = text.replace(/\%+$/g, '').trim();
  }

  // If content-type claims JSON or text now looks like JSON -> try parse
  if (contentType.toLowerCase().includes('application/json') || text.startsWith('{') || text.startsWith('[')) {
    try {
      return JSON.parse(text);
    } catch (err) {
      // parsing failed — return raw trimmed text for caller to inspect
      return text;
    }
  }

  // Not JSON: return trimmed text
  return text;
}

/* -------------------------
   Public API functions
   ------------------------- */

// Fetch all items for dropdown (Item Code, Item Name, Unit)
export const fetchItems = async () => {
  const url = `${STOCK_APPS_SCRIPT_URL}?action=getItems`;
  console.log("📡 fetchItems ->", url);
  try {
    // Increased timeout to 25s and retries to 3 for Apps Script cold starts
    const res = await fetchWithTimeout(url, {}, 25000, 3);
    if (!res.ok) {
      console.error(`❌ fetchItems HTTP ${res.status}`);
      return [];
    }
    const data = await parseResponse(res);
    console.log("✅ Items fetched:", data);
    // Expecting an array; if server wrapped data, try to extract .data
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.data)) return data.data;
    return [];
  } catch (err) {
    console.error("❌ Error fetching items:", err);
    return [];
  }
};

// Fetch priority options for dropdown
export const fetchPriorities = async () => {
  const url = `${STOCK_APPS_SCRIPT_URL}?action=getPriorities`;
  console.log("📡 fetchPriorities ->", url);
  try {
    const res = await fetchWithTimeout(url, {}, 7000, 1);
    if (!res.ok) {
      console.error(`❌ fetchPriorities HTTP ${res.status}`);
      return ["High", "Medium", "Low"];
    }
    const data = await parseResponse(res);
    console.log("✅ Priorities fetched:", data);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.data)) return data.data;
    return ["High", "Medium", "Low"];
  } catch (err) {
    console.error("❌ Error fetching priorities:", err);
    return ["High", "Medium", "Low"];
  }
};

// Fetch existing stock orders
export const fetchStockOrders = async () => {
  const url = `${STOCK_APPS_SCRIPT_URL}?action=getOrders`;
  console.log("📡 fetchStockOrders ->", url);
  try {
    // Increased timeout to 30s and retries to 3 for large datasets
    const res = await fetchWithTimeout(url, {}, 30000, 3);
    if (!res.ok) {
      console.error(`❌ fetchStockOrders HTTP ${res.status}`);
      return [];
    }
    const data = await parseResponse(res);
    console.log("✅ Orders fetched:", data);
    // If server returns { success: true, data: [...] } normalize that
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.data)) return data.data;
    if (data && data.orders && Array.isArray(data.orders)) return data.orders;
    return [];
  } catch (err) {
    console.error("❌ Error fetching orders:", err);
    return [];
  }
};

// Fetch orders from Diff-O2d sheet (for Pending Stock Page)
export const fetchDiffO2dOrders = async () => {
  const url = `${STOCK_APPS_SCRIPT_URL}?action=getDiffO2dOrders`;
  console.log("📡 fetchDiffO2dOrders ->", url);
  try {
    // Increased timeout to 30s and retries to 3 for large datasets
    const res = await fetchWithTimeout(url, {}, 30000, 3);
    if (!res.ok) {
      console.error(`❌ fetchDiffO2dOrders HTTP ${res.status}`);
      return { headerRow1: [], headerRow2: [], data: [] };
    }
    const data = await parseResponse(res);
    console.log("✅ Diff-O2d Orders fetched:", data);
    
    // Return the full response object with headers and data
    if (data && (data.headerRow1 || data.headerRow2)) {
      console.log("✅ Response has headerRow1/headerRow2:", {
        h1: data.headerRow1,
        h2: data.headerRow2,
        dataLen: data.data ? data.data.length : 0
      });
      return data;
    }
    
    // Fallback: if it's just an array, return it
    if (Array.isArray(data)) {
      console.log("⚠️ Got array response, returning as data:", data.length, "items");
      return { headerRow1: [], headerRow2: [], data: data };
    }
    
    console.warn("⚠️ Unexpected response format:", data);
    return { headerRow1: [], headerRow2: [], data: [] };
  } catch (err) {
    console.error("❌ Error fetching Diff-O2d orders:", err);
    return { headerRow1: [], headerRow2: [], data: [] };
  }
};

// Add new stock order
export const addStockOrder = async (orderData) => {
  try {
    const params = new URLSearchParams({
      action: 'addOrder',
      itemCode: orderData.itemCode || '',
      itemName: orderData.itemName || '',
      qty: String(orderData.qty || ''),
      unit: orderData.unit || '',
      priority: orderData.priority || 'Medium'
    });

    if (orderData.orderNo) params.append('orderNo', orderData.orderNo);

    const url = `${STOCK_APPS_SCRIPT_URL}?${params.toString()}`;
    console.log("📡 addStockOrder ->", url, { orderData });

    // Increased timeout to 30s and retries to 3 for write operations (Apps Script can be slow)
    const res = await fetchWithTimeout(url, {}, 30000, 3);
    console.log("📨 addStockOrder status:", res.status);
    const parsed = await parseResponse(res);

    if (!res.ok) {
      // server error: include body for debugging
      const err = new Error(`HTTP ${res.status}`);
      err.body = parsed;
      throw err;
    }

    // parsed expected to be JSON like { success: true, row: 12, orderNo: 'ORD0001' } or similar
    console.log("✅ Order added response:", parsed);
    return parsed;
  } catch (error) {
    console.error("❌ Error adding order:", error);
    throw error;
  }
};

// Test API connectivity
export const testStockAPI = async () => {
  const url = `${STOCK_APPS_SCRIPT_URL}?action=test`;
  console.log("🧪 Testing Stock API ->", url);
  try {
    const res = await fetchWithTimeout(url, {}, 10000, 1);
    const parsed = await parseResponse(res);
    console.log("✅ API Test response:", parsed);
    return parsed && parsed.success === true;
  } catch (err) {
    console.error("❌ API Test failed:", err);
    return false;
  }
};

// Test getPriorities endpoint (should be instant)
export const testGetPriorities = async () => {
  const startTime = performance.now();
  console.log("🧪 Testing getPriorities (should be instant)...");

  try {
    const result = await fetchPriorities();
    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(2);

    console.log(`✅ getPriorities completed in ${duration}ms`);
    console.log("📊 Result:", result);

    if (duration < 1000) {
      console.log("✅ SUCCESS: getPriorities is fast (< 1 second)");
    } else {
      console.warn("⚠️ WARNING: getPriorities took longer than expected");
    }

    return { success: true, duration, result };
  } catch (err) {
    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(2);
    console.error(`❌ getPriorities failed after ${duration}ms:`, err);
    return { success: false, duration, error: err };
  }
};

// Comprehensive API test function
export const testAllEndpoints = async () => {
  console.log("🧪 Starting comprehensive API test...\n");

  const results = {
    test: null,
    getPriorities: null,
    getItems: null,
    startOrder: null,
    getOrders: null
  };

  // Test 1: Basic connectivity
  console.log("1️⃣ Testing basic connectivity...");
  const testStart = performance.now();
  try {
    const testUrl = `${STOCK_APPS_SCRIPT_URL}?action=test`;
    const testRes = await fetch(testUrl);
    const testData = await testRes.json();
    const testDuration = (performance.now() - testStart).toFixed(2);
    results.test = { success: true, duration: testDuration, data: testData };
    console.log(`✅ Test endpoint: ${testDuration}ms`);
  } catch (err) {
    results.test = { success: false, error: err.message };
    console.error("❌ Test endpoint failed:", err);
  }

  // Test 2: getPriorities (should be instant)
  console.log("\n2️⃣ Testing getPriorities (should be instant)...");
  results.getPriorities = await testGetPriorities();

  // Test 3: getItems
  console.log("\n3️⃣ Testing getItems...");
  const itemsStart = performance.now();
  try {
    const items = await fetchItems();
    const itemsDuration = (performance.now() - itemsStart).toFixed(2);
    results.getItems = { success: true, duration: itemsDuration, count: items.length };
    console.log(`✅ getItems: ${itemsDuration}ms (${items.length} items)`);
  } catch (err) {
    results.getItems = { success: false, error: err.message };
    console.error("❌ getItems failed:", err);
  }

  // Test 4: startOrder
  console.log("\n4️⃣ Testing startOrder...");
  const startOrderStart = performance.now();
  try {
    const orderNo = await startOrder();
    const startOrderDuration = (performance.now() - startOrderStart).toFixed(2);
    results.startOrder = { success: !!orderNo, duration: startOrderDuration, orderNo };
    console.log(`✅ startOrder: ${startOrderDuration}ms (Order: ${orderNo})`);
  } catch (err) {
    results.startOrder = { success: false, error: err.message };
    console.error("❌ startOrder failed:", err);
  }

  // Test 5: getOrders
  console.log("\n5️⃣ Testing getOrders...");
  const ordersStart = performance.now();
  try {
    const orders = await fetchStockOrders();
    const ordersDuration = (performance.now() - ordersStart).toFixed(2);
    results.getOrders = { success: true, duration: ordersDuration, count: orders.length };
    console.log(`✅ getOrders: ${ordersDuration}ms (${orders.length} orders)`);
  } catch (err) {
    results.getOrders = { success: false, error: err.message };
    console.error("❌ getOrders failed:", err);
  }

  console.log("\n📊 Test Summary:");
  console.table(results);

  return results;
};

// Start a new order session on the server and get available order numbers from the sheet
// Returns { success: boolean, orderNumbers: array, message: string } 
// instead of just a single orderNo (which was auto-generated before)
export const startOrder = async () => {
  const url = `${STOCK_APPS_SCRIPT_URL}?action=startOrder`;
  console.log("📡 startOrder ->", url);
  try {
    // Increased timeout to 30s and retries to 3 for Apps Script cold starts (can be very slow)
    const res = await fetchWithTimeout(url, {}, 30000, 3);
    if (!res.ok) {
      console.error(`❌ startOrder HTTP ${res.status}`);
      return { success: false, orderNumbers: [], error: `HTTP ${res.status}` };
    }
    const parsed = await parseResponse(res);
    console.log("✅ startOrder response:", parsed);

    // Return full response (should include { success, orderNumbers: [...], message })
    if (parsed && typeof parsed === 'object') {
      if (parsed.orderNumbers && Array.isArray(parsed.orderNumbers)) {
        return parsed; // Full response with orderNumbers
      }
      // Fallback for old response format (for backward compatibility)
      if (parsed.orderNo) {
        return { success: true, orderNumbers: [parsed.orderNo], message: 'Single order available' };
      }
      // If error returned from backend
      if (parsed.error || !parsed.success) {
        return { success: false, orderNumbers: [], error: parsed.error || 'Unknown error' };
      }
    }
    return { success: false, orderNumbers: [], error: 'Invalid response format' };
  } catch (err) {
    console.error("❌ Error starting order:", err);
    return { success: false, orderNumbers: [], error: err.message };
  }
};

/**
 * deleteStockOrder flexible signatures:
 * - deleteStockOrder(rowNumber)           // pass numeric row to delete by row (fast)
 * - deleteStockOrder(orderNo, itemName)  // pass (orderNo, itemName) to delete matching rows
 *
 * If you call deleteStockOrder(orderNo, row) (old signature) it will still detect numeric second arg.
 */
export const deleteStockOrder = async (a, b) => {
  try {
    const params = new URLSearchParams({ action: 'deleteOrder' });

    // If only one argument passed and it's numeric => treat as row
    if (b === undefined && a !== undefined && String(a).match(/^[0-9]+$/)) {
      params.append('row', String(a));
    } else {
      // If second arg looks numeric, treat it as row fast-path
      if (b !== undefined && String(b).match(/^[0-9]+$/)) {
        params.append('row', String(b));
      } else if (a !== undefined && String(a).match(/^[0-9]+$/) && (b === undefined || b === null || b === '')) {
        // (a) numeric and no b -> row
        params.append('row', String(a));
      } else {
        // fallback to orderNo + itemName
        params.append('orderNo', a || '');
        params.append('itemName', b || '');
      }
    }

    const url = `${STOCK_APPS_SCRIPT_URL}?${params.toString()}`;
    console.log("📡 deleteStockOrder ->", url);

    // Increased timeout to 60s for large sheets (14k+ rows) and retries to 2
    const res = await fetchWithTimeout(url, {}, 60000, 2);
    console.log("📨 deleteStockOrder status:", res.status);
    const parsed = await parseResponse(res);

    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.body = parsed;
      throw err;
    }

    console.log("✅ Order deleted:", parsed);
    return parsed;
  } catch (err) {
    console.error("❌ Error deleting order:", err);
    throw err;
  }
};

// Update existing order item in sheet
export const updateStockOrder = async ({ orderNo, originalItemName, itemCode, itemName, qty, unit, priority, row }) => {
  try {
    const params = new URLSearchParams({
      action: 'updateOrder',
      orderNo: orderNo || '',
      originalItemName: originalItemName || '',
      itemCode: itemCode || '',
      itemName: itemName || '',
      qty: String(qty || ''),
      unit: unit || '',
      priority: priority || 'Medium'
    });

    if (row) params.append('row', String(row));

    const url = `${STOCK_APPS_SCRIPT_URL}?${params.toString()}`;
    console.log('📡 updateStockOrder ->', url);

    // Increased timeout to 30s and retries to 3 for write operations (Apps Script can be slow)
    const res = await fetchWithTimeout(url, {}, 30000, 3);
    console.log('📨 updateStockOrder status:', res.status);
    const parsed = await parseResponse(res);

    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.body = parsed;
      throw err;
    }

    console.log('✅ Order updated:', parsed);
    return parsed;
  } catch (err) {
    console.error('❌ Error updating order:', err);
    throw err;
  }
};

// Save received stock data to columns P-R
export const saveReceivedStock = async ({ row, receivedQty, weight, unit, remark }) => {
  try {
    const params = new URLSearchParams({
      action: 'saveReceivedStock',
      row: String(row || ''),
      receivedQty: String(receivedQty || ''),
      weight: String(weight || ''),
      unit: unit || '',
      remark: remark || ''
    });

    const url = `${STOCK_APPS_SCRIPT_URL}?${params.toString()}`;
    console.log('📡 saveReceivedStock ->', url, { row, receivedQty, weight, unit, remark });

    // Increased timeout to 30s and retries to 3 for write operations
    const res = await fetchWithTimeout(url, {}, 30000, 3);
    console.log('📨 saveReceivedStock status:', res.status);
    const parsed = await parseResponse(res);

    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.body = parsed;
      throw err;
    }

    console.log('✅ Received stock saved:', parsed);
    return parsed;
  } catch (err) {
    console.error('❌ Error saving received stock:', err);
    throw err;
  }
};