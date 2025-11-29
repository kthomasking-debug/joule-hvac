// src/lib/rateSuggestions.js

// A simple lookup for providing up-to-date flat rate suggestions
// when the OpenEI database returns outdated information for a known utility.
// Key: The 'utility' name string returned from the OpenEI API.
// Value: A suggested flat rate in USD/kWh.
const suggestions = {
    'Consolidated Edison Co-NY Inc': 0.24,
    // Add other utilities here as needed, e.g.:
    // 'Pacific Gas & Electric Co': 0.35,
};

/**
 * Gets a suggested flat rate for a given utility name.
 * @param {string} utilityName The name of the utility.
 * @returns {number|null} The suggested rate, or null if none is found.
 */
export const getSuggestedRate = (utilityName) => {
    return suggestions[utilityName] || null;
};
