// src/lib/eia.js

/**
 * Fetches the latest average residential electricity price for a given state from the EIA API.
 * See EIA API docs: https://www.eia.gov/opendata/documentation.php
 *
 * @param {string} apiKey - Your EIA API key.
 * @param {string} stateAbbr - The two-letter abbreviation for the state (e.g., 'GA', 'NY').
 * @returns {Promise<object|null>} A promise that resolves to an object containing the rate and period, or null if not found.
 */
export const fetchStateAverageRate = async (apiKey, stateAbbr) => {
  if (!apiKey || !stateAbbr) {
    throw new Error("EIA API key and state abbreviation are required.");
  }

  // The EIA API v2 endpoint for monthly residential electricity retail sales (price).
  const url = `https://api.eia.gov/v2/electricity/retail-sales/data/?api_key=${apiKey}&frequency=monthly&data[0]=price&facets[stateid][]=${stateAbbr.toUpperCase()}&facets[sectorid][]=RES&sort[0][column]=period&sort[0][direction]=desc&length=1`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      // Try to get more specific error info from the response body
      const errorBody = await response.json().catch(() => null);
      const errorMessage = errorBody?.error || `HTTP error! status: ${response.status}`;
      throw new Error(`EIA API request failed: ${errorMessage}`);
    }

    const data = await response.json();

    // The data is nested under response.response.data
    const series = data?.response?.data;
    if (!series || series.length === 0) {
      console.warn(`No EIA data found for state: ${stateAbbr}`);
      return null;
    }

    const latest = series[0];
    const rate = latest.price; // This is in cents/kWh
    const period = latest.period; // e.g., "2023-08"

    if (rate === null || rate === undefined) {
      return null;
    }

    // Convert cents/kWh to dollars/kWh
    const rateInDollars = rate / 100.0;

    return {
      rate: rateInDollars,
      period: period,
      source: 'EIA State Average',
    };

  } catch (error) {
    console.error("Error fetching from EIA API:", error);
    // Re-throw the error so the calling function can handle it
    throw error;
  }
};

/**
 * Fetches the latest average residential natural gas price for a given state from the EIA API.
 * See EIA API docs: https://www.eia.gov/opendata/documentation.php
 *
 * @param {string} apiKey - Your EIA API key.
 * @param {string} stateAbbr - The two-letter abbreviation for the state (e.g., 'GA', 'NY').
 * @returns {Promise<object|null>} A promise that resolves to an object containing the rate ($/therm) and period, or null if not found.
 */
export const fetchStateAverageGasPrice = async (apiKey, stateAbbr) => {
  if (!apiKey || !stateAbbr) {
    throw new Error("EIA API key and state abbreviation are required.");
  }

  // EIA uses 'S' + state abbreviation for area codes (e.g., GA -> SGA)
  const eiaAreaCode = 'S' + stateAbbr.toUpperCase();
  
  // The EIA API v2 endpoint for monthly residential natural gas prices
  const url = `https://api.eia.gov/v2/natural-gas/pri/sum/data/?api_key=${apiKey}&frequency=monthly&data[0]=value&facets[process][]=PRS&facets[duoarea][]=${eiaAreaCode}&sort[0][column]=period&sort[0][direction]=desc&length=1`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const errorMessage = errorBody?.error || `HTTP error! status: ${response.status}`;
      throw new Error(`EIA API request failed: ${errorMessage}`);
    }

    const data = await response.json();

    const series = data?.response?.data;
    if (!series || series.length === 0) {
      console.warn(`No EIA gas price data found for state: ${stateAbbr}`);
      return null;
    }

    const latest = series[0];
    const pricePerMcf = latest.value; // This is in $/Mcf (dollars per thousand cubic feet)
    const period = latest.period; // e.g., "2023-08"

    if (pricePerMcf === null || pricePerMcf === undefined) {
      return null;
    }

    // Convert $/Mcf to $/therm using the conversion factor: 1 Mcf ≈ 10.37 therms
    const THERMS_PER_MCF = 10.37;
    const pricePerTherm = pricePerMcf / THERMS_PER_MCF;

    return {
      rate: pricePerTherm,
      period: period,
      source: 'EIA State Average',
      originalMcfPrice: pricePerMcf,
    };

  } catch (error) {
    console.error("Error fetching gas price from EIA API:", error);
    throw error;
  }
};

