/**
 * EIA (Energy Information Administration) Utility Rate API Integration
 * Fetches live electricity and natural gas prices from the U.S. Department of Energy
 *
 * API Documentation: https://www.eia.gov/opendata/
 */

// Note: Do not hardcode API keys in the client. Vite injects variables prefixed with VITE_.
// These are public at build time. Use VITE_EIA_API_KEY only for non-sensitive/public keys
// or route through a server if you need to keep a key secret.
const EIA_API_KEY = import.meta.env.VITE_EIA_API_KEY || "";
const EIA_BASE_URL = "https://api.eia.gov/v2";

/**
 * Fetch live electricity rate for a state from EIA API
 * @param {string} stateCode - Two-letter state code (e.g., 'CA', 'TX')
 * @returns {Promise<{rate: number, source: string, timestamp: string} | null>}
 */
export async function fetchLiveElectricityRate(stateCode) {
  if (!stateCode || stateCode.length !== 2) {
    console.warn("Invalid state code for EIA API:", stateCode);
    return null;
  }

  try {
    // EIA Electricity API endpoint for state-level residential rates
    // Series ID format: ELEC.PRICE.{STATE}-RES.M (Monthly residential electricity price)
    // Series ID (example: ELEC.PRICE.CA-RES.M) kept for reference if needed
    if (!EIA_API_KEY) {
      console.warn(
        "EIA API key is missing. Set VITE_EIA_API_KEY in your environment."
      );
      return null;
    }
    const url = `${EIA_BASE_URL}/electricity/retail-sales/data/?api_key=${EIA_API_KEY}&data[0]=price&facets[stateid][]=${stateCode.toUpperCase()}&facets[sectorid][]=RES&sort[0][column]=period&sort[0][direction]=desc&length=1`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`EIA API error for ${stateCode}:`, response.status);
      return null;
    }

    const data = await response.json();

    // EIA returns price in cents per kWh, convert to dollars
    if (data.response?.data && data.response.data.length > 0) {
      const latestData = data.response.data[0];
      const priceInCents = latestData.price;
      const priceInDollars = priceInCents / 100; // Convert cents to dollars

      return {
        rate: priceInDollars,
        source: "EIA Live Data",
        timestamp: latestData.period,
        state: stateCode.toUpperCase(),
      };
    }

    return null;
  } catch (error) {
    console.error("Error fetching EIA electricity rate:", error);
    return null;
  }
}

/**
 * Fetch live natural gas rate for a state from EIA API
 * @param {string} stateCode - Two-letter state code (e.g., 'CA', 'TX')
 * @returns {Promise<{rate: number, source: string, timestamp: string} | null>}
 */
export async function fetchLiveGasRate(stateCode) {
  if (!stateCode || stateCode.length !== 2) {
    console.warn("Invalid state code for EIA API:", stateCode);
    return null;
  }

  try {
    // EIA Natural Gas API endpoint for state-level residential rates
    // Series ID format: NG.N3010{STATE}.M (Monthly residential natural gas price)
    if (!EIA_API_KEY) {
      console.warn(
        "EIA API key is missing. Set VITE_EIA_API_KEY in your environment."
      );
      return null;
    }
    const url = `${EIA_BASE_URL}/natural-gas/pri/sum/data/?api_key=${EIA_API_KEY}&data[0]=value&facets[process][]=N3010&facets[duoarea][]=${stateCode.toUpperCase()}&sort[0][column]=period&sort[0][direction]=desc&length=1`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`EIA API error for ${stateCode} gas:`, response.status);
      return null;
    }

    const data = await response.json();

    // EIA returns price in dollars per thousand cubic feet ($/Mcf)
    // Convert to dollars per therm (1 therm ≈ 0.9756 Mcf, or 1 Mcf ≈ 1.025 therms)
    if (data.response?.data && data.response.data.length > 0) {
      const latestData = data.response.data[0];
      const pricePerMcf = latestData.value;
      const pricePerTherm = pricePerMcf / 1.025; // Convert Mcf to therms

      return {
        rate: pricePerTherm,
        source: "EIA Live Data",
        timestamp: latestData.period,
        state: stateCode.toUpperCase(),
      };
    }

    return null;
  } catch (error) {
    console.error("Error fetching EIA gas rate:", error);
    return null;
  }
}

/**
 * Map full state names to two-letter codes for EIA API
 */
export const STATE_NAME_TO_CODE = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  "District of Columbia": "DC",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
};

/**
 * Get state code from state name
 * @param {string} stateName - Full state name (e.g., 'California')
 * @returns {string | null} - Two-letter code or null
 */
export function getStateCode(stateName) {
  if (!stateName) return null;

  // Direct lookup
  if (STATE_NAME_TO_CODE[stateName]) {
    return STATE_NAME_TO_CODE[stateName];
  }

  // Case-insensitive fallback
  const stateKey = Object.keys(STATE_NAME_TO_CODE).find(
    (key) => key.toLowerCase() === stateName.toLowerCase()
  );

  return stateKey ? STATE_NAME_TO_CODE[stateKey] : null;
}
