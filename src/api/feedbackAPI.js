
// src/api/feedbackAPI.js

// 🔴 IMPORTANT: Replace this URL with the NEW Web App URL you generate from the Feedback Sheet
// Example: "https://script.google.com/macros/s/AKfy.../exec"
const FEEDBACK_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyz1NVjxeC7gzlU7s_4XHIbaLElUnXP5Ze_GZhwBtID_M6najrhrPTL6x-mryBKt0Tu/exec";

export const fetchFeedbackData = async () => {
    // If the user hasn't replaced the URL yet, warn them
    if (FEEDBACK_APPS_SCRIPT_URL.includes("REPLACE_THIS")) {
        console.warn("⚠️ You have not set the FEEDBACK_APPS_SCRIPT_URL in src/api/feedbackAPI.js");
        console.warn("Using mock data for now...");
        return getMockData();
    }

    const url = `${FEEDBACK_APPS_SCRIPT_URL}?action=getFeedback&_t=${Date.now()}`;

    try {
        console.log("Fetching feedback data from:", url);
        const response = await fetch(url);

        if (!response.ok) {
            console.warn(`⚠️ Apps Script Error ${response.status}`);
            return getMockData();
        }

        const json = await response.json();

        if (json.error) {
            console.error("❌ Backend Error:", json.error);
            return getMockData();
        }

        if (!Array.isArray(json) || json.length === 0) return [];

        const headers = json[0].map(h => h?.toString().trim().toLowerCase() || "");
        const rows = json.slice(1);

        // --- STRICT COLUMN MAPPING (C-N) ---
        // Column A (0): Timestamp
        // Column B (1): Client Site Name
        // Columns C-N (Index 2 - 13): Ratings/Data

        const sourceHeaders = json[0];

        const parsedData = rows.map(row => {
            const dateRaw = row[0]; // (A) Timestamp
            // Try Column B (index 1) or Column C (index 2) for company name
            // Often Google Forms have Timestamp, Email, THEN Client Site Name
            const company = row[1]?.toString().trim() || row[2]?.toString().trim();

            if (!company || company.includes("@") || company.toLowerCase() === "email address") return null;

            const ratings = {};
            let totalScore = 0;
            let ratedCount = 0;
            let comments = [];

            // Iterate strictly from Column C (index 2) to Column N (index 13)
            // Note: Use Math.min in case sheet has fewer columns than N
            const maxCol = Math.min(row.length - 1, 13);

            for (let i = 2; i <= maxCol; i++) {
                const header = sourceHeaders[i]?.toString().trim();
                const val = row[i];

                if (!header) continue;

                // Try to parse as rating first
                let score = 0;
                let isRating = false;

                if (typeof val === 'number') {
                    score = val;
                    isRating = true;
                } else if (typeof val === 'string') {
                    const stars = (val.match(/⭐|★/g) || []).length;
                    if (stars > 0) {
                        score = stars;
                        isRating = true;
                    } else {
                        const num = parseFloat(val);
                        if (!isNaN(num)) {
                            score = num;
                            isRating = true;
                        }
                    }
                }

                if (score > 5) score = 5;

                if (isRating && score > 0) {
                    ratings[header] = score;
                    totalScore += score;
                    ratedCount++;
                } else if (val && val.toString().trim() !== "") {
                    // Capturing text responses in C-N range as well
                    comments.push(`${header}: ${val}`);
                }
            }

            const averageRating = ratedCount > 0 ? (totalScore / ratedCount) : 0;

            // Combine specific feedback column (if any) or just use the compiled C-N text
            const finalFeedback = comments.join(" | ");

            return {
                company,
                date: dateRaw,
                ratings,
                averageRating,
                feedback: finalFeedback
            };
        }).filter(Boolean);

        // Sort by Date Descending (Newest on Top)
        const parseForSort = (d) => {
            if (!d) return new Date(0);
            let dateVal = new Date(d);
            if (isNaN(dateVal.getTime()) && typeof d === 'string' && /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(d)) {
                const parts = d.split(/[\/\-\s]/);
                if (parts.length >= 3) {
                    let day = parseInt(parts[0]);
                    let month = parseInt(parts[1]) - 1;
                    let year = parseInt(parts[2]);
                    if (year < 100) year += 2000;
                    dateVal = new Date(year, month, day);
                }
            }
            return isNaN(dateVal.getTime()) ? new Date(0) : dateVal;
        };

        parsedData.sort((a, b) => parseForSort(b.date) - parseForSort(a.date));

        return parsedData;

        return parsedData;

    } catch (error) {
        console.error("Error fetching feedback data", error);
        return getMockData();
    }
};

const getMockData = () => {
    // Mock data fallback
    return [];
};
