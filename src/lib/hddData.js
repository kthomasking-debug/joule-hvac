// Annual Heating Degree Days (HDD) for major US cities
// Base temperature: 65°F (industry standard)
// Source: NOAA Climate Normals (1991-2020)

const ANNUAL_HDD_DATA = {
  // Northeast
  'New York, NY': 4900,
  'New York, New York': 4900,
  'Boston, MA': 5630,
  'Boston, Massachusetts': 5630,
  'Philadelphia, PA': 4700,
  'Philadelphia, Pennsylvania': 4700,
  'Buffalo, NY': 6800,
  'Buffalo, New York': 6800,
  'Portland, ME': 7500,
  'Portland, Maine': 7500,
  
  // Mid-Atlantic
  'Washington, DC': 4200,
  'District of Columbia': 4200,
  'Baltimore, MD': 4700,
  'Baltimore, Maryland': 4700,
  'Pittsburgh, PA': 5900,
  'Pittsburgh, Pennsylvania': 5900,
  
  // Southeast
  'Atlanta, GA': 2800,
  'Atlanta, Georgia': 2800,
  'Charlotte, NC': 3200,
  'Charlotte, North Carolina': 3200,
  'Miami, FL': 130,
  'Miami, Florida': 130,
  'Nashville, TN': 3800,
  'Nashville, Tennessee': 3800,
  'Raleigh, NC': 3400,
  'Raleigh, North Carolina': 3400,
  
  // Midwest
  'Chicago, IL': 6500,
  'Chicago, Illinois': 6500,
  'Detroit, MI': 6600,
  'Detroit, Michigan': 6600,
  'Minneapolis, MN': 7900,
  'Minneapolis, Minnesota': 7900,
  'St. Louis, MO': 4900,
  'St. Louis, Missouri': 4900,
  'Cleveland, OH': 6200,
  'Cleveland, Ohio': 6200,
  'Milwaukee, WI': 7300,
  'Milwaukee, Wisconsin': 7300,
  'Indianapolis, IN': 5600,
  'Indianapolis, Indiana': 5600,
  'Columbus, OH': 5700,
  'Columbus, Ohio': 5700,
  'Kansas City, MO': 5200,
  'Kansas City, Missouri': 5200,
  
  // South
  'Houston, TX': 1400,
  'Houston, Texas': 1400,
  'Dallas, TX': 2400,
  'Dallas, Texas': 2400,
  'Austin, TX': 1700,
  'Austin, Texas': 1700,
  'San Antonio, TX': 1600,
  'San Antonio, Texas': 1600,
  'New Orleans, LA': 1400,
  'New Orleans, Louisiana': 1400,
  
  // Mountain West
  'Denver, CO': 6100,
  'Denver, Colorado': 6100,
  'Salt Lake City, UT': 5700,
  'Salt Lake City, Utah': 5700,
  'Albuquerque, NM': 4300,
  'Albuquerque, New Mexico': 4300,
  'Phoenix, AZ': 1000,
  'Phoenix, Arizona': 1000,
  'Boise, ID': 5800,
  'Boise, Idaho': 5800,
  
  // West Coast
  'Los Angeles, CA': 900,
  'Los Angeles, California': 900,
  'San Francisco, CA': 2700,
  'San Francisco, California': 2700,
  'San Diego, CA': 900,
  'San Diego, California': 900,
  'Seattle, WA': 4800,
  'Seattle, Washington': 4800,
  'Portland, OR': 4400,
  'Portland, Oregon': 4400,
  
  // Alaska & Hawaii
  'Anchorage, AK': 10800,
  'Anchorage, Alaska': 10800,
  'Fairbanks, AK': 14200,
  'Fairbanks, Alaska': 14200,
  'Honolulu, HI': 0,
  'Honolulu, Hawaii': 0,
};

// State-based fallback HDD (rough averages)
const ANNUAL_HDD_BY_STATE = {
  'AL': 2800, 'Alabama': 2800,
  'AK': 12000, 'Alaska': 12000,
  'AZ': 1800, 'Arizona': 1800,
  'AR': 3200, 'Arkansas': 3200,
  'CA': 2300, 'California': 2300,
  'CO': 6000, 'Colorado': 6000,
  'CT': 6200, 'Connecticut': 6200,
  'DE': 4600, 'Delaware': 4600,
  'DC': 4200, 'District of Columbia': 4200,
  'FL': 600, 'Florida': 600,
  'GA': 2800, 'Georgia': 2800,
  'HI': 0, 'Hawaii': 0,
  'ID': 6200, 'Idaho': 6200,
  'IL': 6000, 'Illinois': 6000,
  'IN': 5600, 'Indiana': 5600,
  'IA': 6800, 'Iowa': 6800,
  'KS': 5400, 'Kansas': 5400,
  'KY': 4600, 'Kentucky': 4600,
  'LA': 1600, 'Louisiana': 1600,
  'ME': 7800, 'Maine': 7800,
  'MD': 4700, 'Maryland': 4700,
  'MA': 5900, 'Massachusetts': 5900,
  'MI': 6800, 'Michigan': 6800,
  'MN': 8200, 'Minnesota': 8200,
  'MS': 2200, 'Mississippi': 2200,
  'MO': 5000, 'Missouri': 5000,
  'MT': 7800, 'Montana': 7800,
  'NE': 6500, 'Nebraska': 6500,
  'NV': 4000, 'Nevada': 4000,
  'NH': 7400, 'New Hampshire': 7400,
  'NJ': 5100, 'New Jersey': 5100,
  'NM': 4200, 'New Mexico': 4200,
  'NY': 6000, 'New York': 6000,
  'NC': 3400, 'North Carolina': 3400,
  'ND': 9200, 'North Dakota': 9200,
  'OH': 5800, 'Ohio': 5800,
  'OK': 3700, 'Oklahoma': 3700,
  'OR': 4600, 'Oregon': 4600,
  'PA': 5600, 'Pennsylvania': 5600,
  'RI': 5800, 'Rhode Island': 5800,
  'SC': 2400, 'South Carolina': 2400,
  'SD': 7800, 'South Dakota': 7800,
  'TN': 3800, 'Tennessee': 3800,
  'TX': 1800, 'Texas': 1800,
  'UT': 5700, 'Utah': 5700,
  'VT': 7900, 'Vermont': 7900,
  'VA': 4100, 'Virginia': 4100,
  'WA': 5200, 'Washington': 5200,
  'WV': 5200, 'West Virginia': 5200,
  'WI': 7600, 'Wisconsin': 7600,
  'WY': 7400, 'Wyoming': 7400,
};

// ...existing code...

// Removed duplicate declaration of getAnnualHDD
// The second declaration starting at line 286 has been removed.

// Correct placement of ANNUAL_CDD_DATA and ANNUAL_CDD_BY_STATE
const ANNUAL_CDD_DATA = {
  'New York, NY': 1200,
  'New York, New York': 1200,
  'Boston, MA': 1100,
  'Boston, Massachusetts': 1100,
  'Philadelphia, PA': 1300,
  'Philadelphia, Pennsylvania': 1300,
  'Buffalo, NY': 900,
  'Buffalo, New York': 900,
  'Portland, ME': 800,
  'Portland, Maine': 800,
  'Atlanta, GA': 2200,
  'Atlanta, Georgia': 2200,
  'Miami, FL': 4000,
  'Miami, Florida': 4000,
  'Chicago, IL': 1000,
  'Chicago, Illinois': 1000,
  'Los Angeles, CA': 1500,
  'Los Angeles, California': 1500,
  'San Francisco, CA': 1200,
  'San Francisco, California': 1200,
  'Seattle, WA': 800,
  'Seattle, Washington': 800,
  'DEFAULT': 1500,
};

const ANNUAL_CDD_BY_STATE = {
  'AL': 1800, 'Alabama': 1800,
  'AK': 100, 'Alaska': 100,
  'AZ': 3500, 'Arizona': 3500,
  'AR': 2200, 'Arkansas': 2200,
  'CA': 2000, 'California': 2000,
  'CO': 1200, 'Colorado': 1200,
  'CT': 800, 'Connecticut': 800,
  'DE': 1000, 'Delaware': 1000,
  'DC': 1000, 'District of Columbia': 1000,
  'FL': 4000, 'Florida': 4000,
  'GA': 2200, 'Georgia': 2200,
  'HI': 4500, 'Hawaii': 4500,
  'ID': 700, 'Idaho': 700,
  'IL': 1000, 'Illinois': 1000,
  'IN': 1200, 'Indiana': 1200,
  'IA': 900, 'Iowa': 900,
  'KS': 1500, 'Kansas': 1500,
  'KY': 1400, 'Kentucky': 1400,
  'LA': 2500, 'Louisiana': 2500,
  'ME': 400, 'Maine': 400,
  'MD': 1200, 'Maryland': 1200,
  'MA': 700, 'Massachusetts': 700,
  'MI': 600, 'Michigan': 600,
  'MN': 500, 'Minnesota': 500,
  'MS': 2000, 'Mississippi': 2000,
  'MO': 1400, 'Missouri': 1400,
  'MT': 300, 'Montana': 300,
  'NE': 1000, 'Nebraska': 1000,
  'NV': 2500, 'Nevada': 2500,
  'NH': 500, 'New Hampshire': 500,
  'NJ': 1000, 'New Jersey': 1000,
  'NM': 2000, 'New Mexico': 2000,
  'NY': 800, 'New York': 800,
  'NC': 1800, 'North Carolina': 1800,
  'ND': 200, 'North Dakota': 200,
  'OH': 1000, 'Ohio': 1000,
  'OK': 2000, 'Oklahoma': 2000,
  'OR': 700, 'Oregon': 700,
  'PA': 900, 'Pennsylvania': 900,
  'RI': 800, 'Rhode Island': 800,
  'SC': 2000, 'South Carolina': 2000,
  'SD': 400, 'South Dakota': 400,
  'TN': 1600, 'Tennessee': 1600,
  'TX': 3000, 'Texas': 3000,
  'UT': 1200, 'Utah': 1200,
  'VT': 300, 'Vermont': 300,
  'VA': 1400, 'Virginia': 1400,
  'WA': 500, 'Washington': 500,
  'WV': 1000, 'West Virginia': 1000,
  'WI': 600, 'Wisconsin': 600,
  'WY': 400, 'Wyoming': 400,
};

/**
 * Get annual HDD for a location
 * @param {string} locationName - Full location string (e.g., "New York, NY, USA")
 * @param {string} state - State name or abbreviation
 * @returns {number} Annual HDD (base 65°F)
 */
export function getAnnualHDD(locationName, state) {
  // Try exact city match first
  if (locationName) {
    // Clean up location string
    const cleaned = locationName.split('(')[0].trim(); // Remove elevation
    const cityState = cleaned.split(',').slice(0, 2).join(',').trim();
    
    if (ANNUAL_HDD_DATA[cityState]) {
      return ANNUAL_HDD_DATA[cityState];
    }
    
    // Try just city name
    const city = cleaned.split(',')[0].trim();
    for (const key in ANNUAL_HDD_DATA) {
      if (key.startsWith(city + ',')) {
        return ANNUAL_HDD_DATA[key];
      }
    }
  }
  
  // Fall back to state average
  if (state) {
    const stateHDD = ANNUAL_HDD_BY_STATE[state];
    if (stateHDD !== undefined) {
      return stateHDD;
    }
  }
  
  // Default fallback (moderate climate)
  return 5000;
}

/**
 * Get annual CDD for a location
 * @param {string} locationName - Full location string (e.g., "New York, NY, USA")
 * @param {string} state - State name or abbreviation
 * @returns {number} Annual CDD (base 65°F)
 */
export function getAnnualCDD(locationName, state) {
  // Try exact city match first
  if (locationName) {
    // Clean up location string
    const cleaned = locationName.split('(')[0].trim(); // Remove elevation
    const cityState = cleaned.split(',').slice(0, 2).join(',').trim();
    
    if (ANNUAL_CDD_DATA[cityState]) {
      return ANNUAL_CDD_DATA[cityState];
    }
    
    // Try just city name
    const city = cleaned.split(',')[0].trim();
    for (const key in ANNUAL_CDD_DATA) {
      if (key.startsWith(city + ',')) {
        return ANNUAL_CDD_DATA[key];
      }
    }
  }
  
  // Fall back to state average
  if (state) {
    const stateCDD = ANNUAL_CDD_BY_STATE[state];
    if (stateCDD !== undefined) {
      return stateCDD;
    }
  }
  
  // Default fallback (moderate climate)
  return 1500;
}

/**
 * Calculates annual COOLING cost based on CDD
 * @param {number} annualCDD - Annual cooling degree days
 * @param {number} heatGainFactor - BTU/hr/°F (from analyzer or estimate)
 * @param {number} seer2 - Cooling system SEER2 rating
 * @param {number} utilityCost - $/kWh
 * @returns {object} Estimated annual cooling cost and energy in dollars and kWh
 */
export function calculateAnnualCoolingCostFromCDD(annualCDD, heatGainFactor, seer2, utilityCost) {
  if (!annualCDD || !heatGainFactor || !seer2 || !utilityCost) return { cost: 0, energy: 0 };

  // CDD is in degree-days. Convert to degree-hours.
  const annualDegreeHours = annualCDD * 24;

  // Total annual heat gain in BTUs
  const annualHeatGainBtu = annualDegreeHours * heatGainFactor;

  // Convert BTU to kWh using SEER2 (BTU/Wh)
  // kWh = (Total BTU) / (SEER2 * 1000)
  const annualKwh = annualHeatGainBtu / (seer2 * 1000);

  // Calculate final cost
  const annualCost = annualKwh * utilityCost;

  return {
    cost: annualCost,
    energy: annualKwh,
  };
}

/**
 * Calculates annual HEATING cost based on HDD
 * @param {number} annualHDD - Annual heating degree days
 * @param {number} heatLossFactor - BTU/hr/°F (from analyzer or estimate)
 * @param {number} hspf2 - Heat pump HSPF2 rating
 * @param {number} utilityCost - $/kWh
 * @returns {object} Estimated annual heating cost and energy in dollars and kWh
 */
export function calculateAnnualHeatingCostFromHDD(annualHDD, heatLossFactor, hspf2, utilityCost, useElectricAuxHeat = true) {
  if (!annualHDD || !heatLossFactor || !hspf2 || !utilityCost) return { cost: 0, energy: 0 };
  
  // HDD is in degree-days. Convert to degree-hours.
  const annualDegreeHours = annualHDD * 24;

  // Total annual heat loss in BTUs
  const annualHeatLossBtu = annualDegreeHours * heatLossFactor;

  // Convert BTU to kWh using HSPF2 (BTU/Wh)
  // kWh = (Total BTU) / (HSPF2 * 1000)
  // Baseline kWh assuming heat pump provides all heating
  const baselineHpKwh = annualHeatLossBtu / (hspf2 * 1000);

  // Estimate fractional share of heating met by electric auxiliary resistance heat
  // Model: aux fraction increases with HDD; more HDD -> more chance of backup heat use
  const auxFraction = Math.min(0.5, Math.max(0, (annualHDD - 3000) / 12000));

  // Energy delivered by HP vs aux (kWh)
  const hpKwh = (1 - auxFraction) * baselineHpKwh;
  const auxKwh = (auxFraction * annualHeatLossBtu) / 3412.14; // 3412.14 BTU/kWh (resistance)

  const totalKwh = hpKwh + (useElectricAuxHeat ? auxKwh : 0);
  const annualCost = totalKwh * utilityCost;

  return {
    cost: annualCost,
    energy: totalKwh,
    auxFraction,
    auxKwhIncluded: useElectricAuxHeat ? auxKwh : 0,
    auxKwhExcluded: !useElectricAuxHeat ? auxKwh : 0,
  };
}

/**
 * Deprecated, use calculateAnnualHeatingCostFromHDD instead
 * @param {number} annualHDD - Annual heating degree days
 * @param {number} heatLossFactor - BTU/hr/°F (from analyzer or estimate)
 * @param {number} efficiency - Deprecated, use hspf2
 * @param {number} utilityCost - $/kWh
 * @returns {object} Estimated annual heating cost and energy in dollars and kWh
 */
export function calculateAnnualCostFromHDD(annualHDD, heatLossFactor, efficiency, utilityCost) {
    console.warn("DEPRECATED: calculateAnnualCostFromHDD is deprecated. Use calculateAnnualHeatingCostFromHDD instead.");
    // For backward compatibility, assume efficiency is HSPF2
    return calculateAnnualHeatingCostFromHDD(annualHDD, heatLossFactor, efficiency, utilityCost);
};
