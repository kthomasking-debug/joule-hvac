// src/data/fixedChargesByState.js
// State-based default fixed utility charges
// These are ballpark estimates for typical monthly fixed charges (meter fees, service charges, etc.)
// Users can override these values to match their actual bills

/**
 * Default fixed charges by state ($/month)
 * Electric: Base monthly service charge for electricity
 * Gas: Base monthly service charge for natural gas
 * 
 * Note: These are rough estimates. Actual charges vary by utility provider.
 * Some states (like FL, HI, NV, VT, ME) have many electric-only homes, so gas is 0.
 */
export const defaultFixedChargesByState = {
  AL: { electric: 18, gas: 20 },
  AK: { electric: 20, gas: 25 },
  AZ: { electric: 15, gas: 18 },
  AR: { electric: 16, gas: 18 },
  CA: { electric: 12, gas: 15 },
  CO: { electric: 12, gas: 16 },
  CT: { electric: 18, gas: 20 },
  DE: { electric: 14, gas: 16 },
  FL: { electric: 12, gas: 0 },   // many homes electric only
  GA: { electric: 15, gas: 18 },
  HI: { electric: 20, gas: 0 },
  IA: { electric: 14, gas: 17 },
  ID: { electric: 13, gas: 16 },
  IL: { electric: 15, gas: 18 },
  IN: { electric: 14, gas: 17 },
  KS: { electric: 14, gas: 17 },
  KY: { electric: 13, gas: 16 },
  LA: { electric: 14, gas: 16 },
  MA: { electric: 18, gas: 20 },
  MD: { electric: 15, gas: 18 },
  ME: { electric: 14, gas: 0 },
  MI: { electric: 15, gas: 18 },
  MN: { electric: 13, gas: 18 },
  MO: { electric: 14, gas: 17 },
  MS: { electric: 14, gas: 16 },
  MT: { electric: 13, gas: 17 },
  NC: { electric: 13, gas: 17 },
  ND: { electric: 13, gas: 18 },
  NE: { electric: 13, gas: 17 },
  NH: { electric: 15, gas: 18 },
  NJ: { electric: 16, gas: 19 },
  NM: { electric: 13, gas: 16 },
  NV: { electric: 14, gas: 0 },
  NY: { electric: 17, gas: 20 },
  OH: { electric: 14, gas: 18 },
  OK: { electric: 13, gas: 16 },
  OR: { electric: 12, gas: 16 },
  PA: { electric: 15, gas: 18 },
  RI: { electric: 17, gas: 19 },
  SC: { electric: 13, gas: 16 },
  SD: { electric: 13, gas: 17 },
  TN: { electric: 14, gas: 17 },
  TX: { electric: 13, gas: 16 },
  UT: { electric: 12, gas: 16 },
  VA: { electric: 14, gas: 17 },
  VT: { electric: 14, gas: 0 },
  WA: { electric: 12, gas: 16 },
  WI: { electric: 14, gas: 18 },
  WV: { electric: 14, gas: 17 },
  WY: { electric: 13, gas: 17 },
  DC: { electric: 15, gas: 18 },
};

/**
 * Fallback default fixed charges when state is not found or unknown
 */
export const defaultFallbackFixedCharges = { electric: 15, gas: 18 };

/**
 * Helper function to normalize state to abbreviation format
 * Handles both full state names and abbreviations
 */
export function normalizeStateToAbbreviation(state) {
  if (!state) return null;
  
  // If already an abbreviation (2 letters), return uppercase
  if (state.length === 2) {
    return state.toUpperCase();
  }
  
  // Map of common full state names to abbreviations
  const stateNameToAbbr = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
    'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
    'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
    'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
    'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
    'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
    'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
    'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
    'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
    'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
    'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
  };
  
  // Try to find match (case-insensitive)
  const normalized = state.trim();
  for (const [fullName, abbr] of Object.entries(stateNameToAbbr)) {
    if (fullName.toLowerCase() === normalized.toLowerCase()) {
      return abbr;
    }
  }
  
  // If not found, return original (might already be an abbreviation we don't recognize)
  return normalized.toUpperCase();
}




