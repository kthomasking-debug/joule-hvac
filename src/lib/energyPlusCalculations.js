/**
 * EnergyPlus Load Calculation - Frontend Implementation
 * Simplified Manual J-style heating/cooling load calculations
 * 
 * This is a client-side implementation that doesn't require a backend server.
 * Based on ACCA Manual J methodology with simplified assumptions.
 */

/**
 * Calculate simplified Manual J-style heating and cooling loads
 * @param {Object} params - Building parameters
 * @param {number} params.squareFeet - Floor area in square feet
 * @param {number} params.ceilingHeight - Ceiling height in feet
 * @param {number} params.insulationLevel - Insulation multiplier (0.5-2.0)
 * @param {number} params.climateZone - IECC climate zone (1-7)
 * @param {number} [params.windowArea] - Total window area in sq ft
 * @param {number} [params.windowUFactor] - Window U-factor
 * @param {number} [params.infiltration] - Air changes per hour
 * @returns {Object} Load calculation results
 */
export function calculateLoadSimplified(params) {
  const sqft = params.squareFeet || 2000;
  const ceilingHeight = params.ceilingHeight || 8;
  const insulation = params.insulationLevel || 1.0;
  const climateZone = params.climateZone || 5;
  const windowArea = params.windowArea || sqft * 0.15; // Default 15% window-to-floor ratio
  const windowUFactor = params.windowUFactor || 0.35; // Default double-pane low-e
  const infiltration = params.infiltration || 0.35; // Default ACH50

  // Base heat loss (BTU/hr per sqft per °F delta-T)
  // Adjusted for insulation level: 1.0 = average, 0.5 = well-insulated, 2.0 = poor
  const baseHeatLossPerSqft = 0.32; // DOE average
  const heatLossFactor = baseHeatLossPerSqft * insulation;

  // Design conditions based on climate zone (99% heating, 1% cooling)
  const designConditions = {
    1: { heating: 30, cooling: 95 },  // Hot-Humid
    2: { heating: 20, cooling: 92 },  // Hot-Dry
    3: { heating: 10, cooling: 90 },  // Warm-Humid
    4: { heating: 0, cooling: 88 },   // Mixed-Humid
    5: { heating: -5, cooling: 85 },  // Cool-Humid
    6: { heating: -10, cooling: 82 }, // Cold
    7: { heating: -15, cooling: 80 }, // Very Cold
  };

  const design = designConditions[climateZone] || designConditions[5];
  const designHeatingTemp = design.heating;
  const designCoolingTemp = design.cooling;

  const indoorHeating = 70; // °F
  const indoorCooling = 75; // °F

  // Calculate temperature deltas
  const heatingDeltaT = indoorHeating - designHeatingTemp;
  const coolingDeltaT = designCoolingTemp - indoorCooling;

  // Envelope loads (walls, ceiling, floor)
  const envelopeHeatingLoad = sqft * heatLossFactor * heatingDeltaT;
  const envelopeCoolingLoad = sqft * heatLossFactor * coolingDeltaT;

  // Window loads
  const windowHeatingLoad = windowArea * windowUFactor * heatingDeltaT;
  const windowCoolingLoad = windowArea * windowUFactor * coolingDeltaT;
  
  // Solar gain through windows (cooling only)
  const solarHeatGainCoefficient = 0.3; // SHGC for low-e windows
  const solarGainLoad = windowArea * solarHeatGainCoefficient * 200; // Simplified solar intensity

  // Infiltration loads
  const volume = sqft * ceilingHeight; // cubic feet
  const airDensity = 0.075; // lb/ft³
  const specificHeat = 0.24; // BTU/lb·°F
  const infiltrationHeatingLoad = (volume * infiltration * airDensity * specificHeat * heatingDeltaT) / 60;
  const infiltrationCoolingLoad = (volume * infiltration * airDensity * specificHeat * coolingDeltaT) / 60;

  // Internal gains (people, appliances, lighting) - cooling only
  const internalGainsLoad = sqft * 2.0; // 2 BTU/hr per sqft (simplified)

  // Total loads
  const heatingLoadBtuHr = Math.round(
    envelopeHeatingLoad + windowHeatingLoad + infiltrationHeatingLoad
  );

  const coolingLoadBtuHr = Math.round(
    envelopeCoolingLoad + windowCoolingLoad + solarGainLoad + infiltrationCoolingLoad + internalGainsLoad
  );

  // Convert to tons (12,000 BTU/hr = 1 ton)
  const heatingTons = heatingLoadBtuHr / 12000;
  const coolingTons = coolingLoadBtuHr / 12000;

  // Equipment sizing recommendations (add 10-20% for safety factor)
  const heatingEquipmentBtuHr = Math.round(heatingLoadBtuHr * 1.15);
  const coolingEquipmentBtuHr = Math.round(coolingLoadBtuHr * 1.15);
  const heatingEquipmentTons = heatingEquipmentBtuHr / 12000;
  const coolingEquipmentTons = coolingEquipmentBtuHr / 12000;

  return {
    heatingLoadBtuHr,
    coolingLoadBtuHr,
    heatingTons: Math.round(heatingTons * 100) / 100,
    coolingTons: Math.round(coolingTons * 100) / 100,
    heatingEquipmentBtuHr,
    coolingEquipmentBtuHr,
    heatingEquipmentTons: Math.round(heatingEquipmentTons * 100) / 100,
    coolingEquipmentTons: Math.round(coolingEquipmentTons * 100) / 100,
    method: 'simplified_manual_j',
    designHeatingTemp,
    designCoolingTemp,
    breakdown: {
      heating: {
        envelope: Math.round(envelopeHeatingLoad),
        windows: Math.round(windowHeatingLoad),
        infiltration: Math.round(infiltrationHeatingLoad),
      },
      cooling: {
        envelope: Math.round(envelopeCoolingLoad),
        windows: Math.round(windowCoolingLoad),
        solar: Math.round(solarGainLoad),
        infiltration: Math.round(infiltrationCoolingLoad),
        internalGains: Math.round(internalGainsLoad),
      },
    },
  };
}

/**
 * Calculate rebates and net equipment price
 * @param {string} zipCode - 5-digit US zip code
 * @param {string} equipmentSku - Equipment SKU/model number
 * @returns {Object} Rebate breakdown and net price
 */
export function calculateRebates(zipCode, equipmentSku) {
  // Mock equipment pricing (in production, this would come from a database)
  const equipmentPrices = {
    'HP-3T-18SEER': 8500,  // 3-ton heat pump, 18 SEER
    'HP-4T-20SEER': 12000, // 4-ton heat pump, 20 SEER
    'HP-5T-18SEER': 15000, // 5-ton heat pump, 18 SEER
    'AC-3T-16SEER': 4500,  // 3-ton AC, 16 SEER
    'AC-4T-18SEER': 6500,  // 4-ton AC, 18 SEER
    'FURNACE-80K-96AFUE': 3500,  // 80K BTU furnace, 96% AFUE
    'FURNACE-100K-98AFUE': 4500, // 100K BTU furnace, 98% AFUE
  };

  const basePrice = equipmentPrices[equipmentSku] || 5000; // Default price

  // Extract region from zip code (simplified - first digit)
  const zipFirst = zipCode && zipCode[0] ? parseInt(zipCode[0]) : 5;

  // Federal rebates (IRA/Inflation Reduction Act)
  let federalRebate = 0;
  if (equipmentSku.includes('HP')) {
    federalRebate = 2000; // Heat pump rebate
  } else if (equipmentSku.includes('AC')) {
    federalRebate = 600; // AC rebate
  } else if (equipmentSku.includes('FURNACE')) {
    federalRebate = 1500; // High-efficiency furnace rebate
  }

  // State rebates (varies by region - simplified mapping)
  const stateRebates = {
    0: 500, // Northeast states (MA, NY, CT, etc.)
    1: 300, // Northeast states
    2: 400, // Mid-Atlantic states
    3: 200, // Southeast states
    4: 300, // Southeast states
    5: 400, // Midwest states (IL, MI, etc.)
    6: 500, // Midwest states
    7: 200, // Mountain states
    8: 300, // West Coast states (CA, OR, WA)
    9: 250, // West Coast states
  };
  const stateRebate = stateRebates[zipFirst] || 300;

  // Utility rebates (varies by efficiency)
  let utilityRebate = 0;
  if (equipmentSku.includes('18SEER') || equipmentSku.includes('20SEER')) {
    utilityRebate = 500; // High-efficiency bonus
  } else if (equipmentSku.includes('16SEER')) {
    utilityRebate = 200;
  }
  if (equipmentSku.includes('96AFUE') || equipmentSku.includes('98AFUE')) {
    utilityRebate += 300; // High-efficiency furnace bonus
  }

  // Total rebates
  const totalRebates = federalRebate + stateRebate + utilityRebate;
  const netPrice = Math.max(0, basePrice - totalRebates); // Can't go negative

  return {
    basePrice,
    federalRebate,
    stateRebate,
    utilityRebate,
    totalRebates,
    netPrice,
    savingsPercentage: basePrice > 0 ? Math.round((totalRebates / basePrice * 100) * 10) / 10 : 0,
    zipCode,
    equipmentSku,
  };
}
