
const STOCK_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxZY1V-n4iW8rn8Up-NPSyYw-4CdESiyWbqGU7bso-N523vJ5HF2A5mEtHRq9QhgDy5/exec";

async function fetchStockOrders() {
    try {
        const response = await fetch(`${STOCK_APPS_SCRIPT_URL}?action=getOrders`);
        const data = await response.json();
        console.log("Data structure:", JSON.stringify(data.slice(0, 2), null, 2));

        if (data.length > 0) {
            const firstRow = data[0];
            console.log("First row length:", firstRow.length);
            console.log("Indices 15-18:", firstRow.slice(15, 19));
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

fetchStockOrders();
