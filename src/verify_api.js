
const STOCK_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxDTPKbWz5FgBi9zJzFsECmt1jl-NOywdPV6wk1PXbN0jEW9y9HZE5FTgcW9LiJsOnL/exec";

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
