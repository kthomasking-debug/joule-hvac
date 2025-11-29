/**
 * Carbon Footprint Calculation Utilities
 * 
 * Calculates CO2 emissions from energy usage based on EPA eGRID regional factors.
 * Data source: EPA eGRID (Emissions & Generation Resource Integrated Database)
 */

// Regional grid carbon intensity factors (lbs CO2 per MWh)
// Source: EPA eGRID 2022 data
const GRID_CARBON_INTENSITY = {
  // NERC Regions approximations for major states
  'California': 430,      // WECC California - lots of renewables
  'Washington': 280,      // Northwest - hydropower heavy
  'Oregon': 320,          // Northwest - hydropower heavy
  'Idaho': 310,           // Northwest
  'New York': 580,        // NPCC - cleaner than average
  'Vermont': 150,         // Cleanest grid (nuclear + hydro)
  'Maine': 420,           // NPCC
  'New Hampshire': 520,   // NPCC
  'Massachusetts': 650,   // NPCC
  'Connecticut': 630,     // NPCC
  'Rhode Island': 670,    // NPCC
  'New Jersey': 710,      // RFC
  'Pennsylvania': 920,    // RFC - coal heavy
  'Maryland': 880,        // RFC
  'Delaware': 900,        // RFC
  'Virginia': 850,        // SERC
  'North Carolina': 880,  // SERC
  'South Carolina': 820,  // SERC
  'Georgia': 920,         // SERC
  'Florida': 940,         // FRCC - natural gas heavy
  'Alabama': 950,         // SERC
  'Mississippi': 980,     // SERC
  'Louisiana': 960,       // SERC - natural gas
  'Texas': 920,           // ERCOT - mix of coal, gas, wind
  'Tennessee': 910,       // SERC
  'Kentucky': 1100,       // SERC - very coal heavy
  'West Virginia': 1200,  // RFC - coal dominant
  'Ohio': 1050,           // RFC
  'Michigan': 960,        // RFC
  'Indiana': 1180,        // RFC - coal heavy
  'Illinois': 820,        // RFC - nuclear + coal
  'Wisconsin': 950,       // MRO
  'Minnesota': 880,       // MRO
  'Iowa': 1050,           // MRO - coal heavy
  'Missouri': 1100,       // SERC - coal
  'Arkansas': 940,        // SPP
  'Oklahoma': 980,        // SPP
  'Kansas': 1020,         // SPP
  'Nebraska': 1040,       // MRO
  'South Dakota': 780,    // MRO
  'North Dakota': 1150,   // MRO - coal dominant
  'Montana': 950,         // WECC
  'Wyoming': 1200,        // WECC - coal
  'Colorado': 1050,       // WECC
  'New Mexico': 970,      // WECC
  'Arizona': 880,         // WECC
  'Nevada': 800,          // WECC
  'Utah': 1100,           // WECC - coal
  'Hawaii': 1050,         // Hawaii - oil/gas
  'Alaska': 850,          // Alaska - natural gas
  'District of Columbia': 850, // RFC
  
  // National average fallback
  'DEFAULT': 850          // US national average
};

// Natural gas combustion: ~11.7 lbs CO2 per therm
const GAS_CO2_PER_THERM = 11.7;

/**
 * Get the carbon intensity factor for a state's electrical grid
 * @param {string} stateName - Full state name (e.g., "California")
 * @returns {number} Carbon intensity in lbs CO2 per kWh
 */
export const getGridCarbonIntensity = (stateName) => {
  const intensityPerMWh = GRID_CARBON_INTENSITY[stateName] || GRID_CARBON_INTENSITY['DEFAULT'];
  // Convert from lbs CO2/MWh to lbs CO2/kWh
  return intensityPerMWh / 1000;
};

/**
 * Calculate CO2 emissions from electricity usage
 * @param {number} kWh - Total electricity consumption in kilowatt-hours
 * @param {string} stateName - State name for grid intensity lookup
 * @returns {object} CO2 emissions in lbs and tons
 */
export const calculateElectricityCO2 = (kWh, stateName = null) => {
  const lbsPerKWh = getGridCarbonIntensity(stateName);
  const totalLbs = kWh * lbsPerKWh;
  
  return {
    lbs: totalLbs,
    tons: totalLbs / 2000, // Convert to US tons
    intensity: lbsPerKWh,
    gridType: stateName || 'US Average'
  };
};

/**
 * Calculate CO2 emissions from natural gas usage
 * @param {number} therms - Total natural gas consumption in therms
 * @returns {object} CO2 emissions in lbs and tons
 */
export const calculateGasCO2 = (therms) => {
  const totalLbs = therms * GAS_CO2_PER_THERM;
  
  return {
    lbs: totalLbs,
    tons: totalLbs / 2000,
    intensity: GAS_CO2_PER_THERM,
    fuelType: 'Natural Gas'
  };
};

/**
 * Calculate total CO2 emissions from combined electricity and gas usage
 * @param {number} kWh - Electricity consumption
 * @param {number} therms - Natural gas consumption
 * @param {string} stateName - State for grid intensity
 * @returns {object} Combined CO2 emissions
 */
export const calculateTotalCO2 = (kWh = 0, therms = 0, stateName = null) => {
  const electricCO2 = kWh > 0 ? calculateElectricityCO2(kWh, stateName) : { lbs: 0, tons: 0 };
  const gasCO2 = therms > 0 ? calculateGasCO2(therms) : { lbs: 0, tons: 0 };
  
  const totalLbs = electricCO2.lbs + gasCO2.lbs;
  
  return {
    lbs: totalLbs,
    tons: totalLbs / 2000,
    electric: electricCO2,
    gas: gasCO2
  };
};

/**
 * Format CO2 emissions for display
 * @param {number} lbs - CO2 in pounds
 * @returns {string} Formatted string
 */
export const formatCO2 = (lbs) => {
  if (lbs < 1000) {
    return `${lbs.toFixed(0)} lbs`;
  } else if (lbs < 10000) {
    return `${(lbs / 1000).toFixed(2)} tons`;
  } else {
    return `${(lbs / 1000).toFixed(1)} tons`;
  }
};
