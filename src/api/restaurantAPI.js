// src/api/restaurantAPI.js
const API_BASE_URL = "https://script.google.com/macros/s/AKfycbwn9px7fvfpdApioOzcCLahnC6Xcrx32CJ8RplsIgFu-IRw82m_Bpyi-pGjxchQuqE8/exec";

async function fetchSheet(sheetName) {
  try {
    const url = `${API_BASE_URL}?sheet=${encodeURIComponent(sheetName)}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Fetch error: ${response.status} ${response.statusText} when requesting ${url}`);
      return [];
    }

    const data = await response.json();

    // Normalize a few common response shapes into an array-of-rows format
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.values)) return data.values;
    if (data && Array.isArray(data.data)) return data.data;

    // If the response is an object but not an array, return an empty array and log it for debugging
    console.warn('Unexpected sheet response shape for', sheetName, data);
    return [];
  } catch (error) {
    console.error('Error fetching sheet', sheetName, error);
    return [];
  }
}

// PMS sheet se data read karne ke liye
export const fetchPMSData = async () => {
  return await fetchSheet('PMS');
};

// Recipe sheet se data read karne ke liye
export const fetchRecipeData = async () => {
  return await fetchSheet('P Vs A (Recipe)');
};