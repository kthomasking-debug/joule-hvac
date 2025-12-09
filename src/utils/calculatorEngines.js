// Voice-accessible calculator utilities for Ask Joule
// Provides calculation engines for all tools without requiring UI interaction

import {
  getSaturationTemp,
  getTargetLiquidLineTemp,
  // getSaturationPressure, // Unused - kept for future use
} from "../lib/ptCharts.js";

/**
 * A/C Charging Calculator
 * Calculate target subcooling and superheat for refrigerant charging
 */
export function calculateCharging(params) {
  const {
    refrigerant = "R-410A",
    outdoorTemp = 85,
    indoorTemp = 75,
    liquidLineTemp = null,
    suctionLineTemp = null,
    dischargePressure = null,
    suctionPressure = null,
  } = params;

  const results = {
    refrigerant,
    outdoorTemp,
    indoorTemp,
  };

  // Calculate target subcooling
  if (outdoorTemp) {
    const targetLiquidTemp = getTargetLiquidLineTemp(refrigerant, outdoorTemp);
    const satTemp = getSaturationTemp(refrigerant, dischargePressure);

    results.targetSubcooling = Math.round(satTemp - targetLiquidTemp);
    results.targetLiquidLineTemp = Math.round(targetLiquidTemp);

    if (liquidLineTemp && dischargePressure) {
      results.actualSubcooling = Math.round(satTemp - liquidLineTemp);
      results.subcoolingStatus =
        Math.abs(results.actualSubcooling - results.targetSubcooling) <= 2
          ? "optimal"
          : results.actualSubcooling < results.targetSubcooling - 2
          ? "undercharged"
          : "overcharged";
    }
  }

  // Calculate target superheat (typically 8-12°F for fixed orifice, 5-8°F for TXV)
  if (indoorTemp) {
    results.targetSuperheat = 10; // Default target

    if (suctionLineTemp && suctionPressure) {
      const satTempSuction = getSaturationTemp(refrigerant, suctionPressure);
      results.actualSuperheat = Math.round(suctionLineTemp - satTempSuction);
      results.superheatStatus =
        Math.abs(results.actualSuperheat - results.targetSuperheat) <= 2
          ? "optimal"
          : results.actualSuperheat < results.targetSuperheat - 2
          ? "overcharged"
          : "undercharged";
    }
  }

  return results;
}

export function formatChargingResponse(results) {
  const {
    refrigerant,
    outdoorTemp,
    targetSubcooling,
    targetSuperheat,
    subcoolingStatus,
    superheatStatus,
  } = results;

  let response = `**${refrigerant} Charging Targets** (Outdoor: ${outdoorTemp}°F)\n\n`;

  if (targetSubcooling) {
    response += `• **Target Subcooling:** ${targetSubcooling}°F\n`;
    response += `  (Liquid line should be ${targetSubcooling}°F cooler than saturation temp)\n\n`;
  }

  if (targetSuperheat) {
    response += `• **Target Superheat:** ${targetSuperheat}°F\n`;
    response += `  (Suction line should be ${targetSuperheat}°F warmer than saturation temp)\n\n`;
  }

  if (subcoolingStatus) {
    response += `**Subcooling Status:** ${subcoolingStatus}\n`;
    if (subcoolingStatus === "undercharged")
      response += "⚠️ Add refrigerant slowly\n";
    if (subcoolingStatus === "overcharged")
      response += "⚠️ Recover refrigerant\n";
  }

  if (superheatStatus) {
    response += `**Superheat Status:** ${superheatStatus}\n`;
    if (superheatStatus === "undercharged")
      response += "⚠️ Add refrigerant slowly\n";
    if (superheatStatus === "overcharged")
      response += "⚠️ Recover refrigerant\n";
  }

  return response;
}

/**
 * Performance Analyzer
 * Calculate heat loss factor from user settings
 */
export function calculatePerformanceMetrics(userSettings) {
  const {
    squareFeet = 2000,
    ceilingHeight = 8,
    insulationLevel = 1.0,
    hspf2 = 9,
    tons = 3,
  } = userSettings;

  const volume = squareFeet * ceilingHeight;
  const baseHeatLossPerDegF = volume * 0.018;
  const heatLossFactor = Math.round(baseHeatLossPerDegF * insulationLevel);

  const avgCOP = hspf2 / 3.4;
  const ratedCapacityBtu = tons * 12000;

  return {
    heatLossFactor,
    thermalFactor: Math.round((heatLossFactor / squareFeet) * 100) / 100,
    avgCOP: Math.round(avgCOP * 100) / 100,
    ratedCapacity: ratedCapacityBtu,
    insulationQuality:
      insulationLevel <= 0.7
        ? "Good"
        : insulationLevel <= 1.1
        ? "Average"
        : "Poor",
  };
}

export function formatPerformanceResponse(metrics, userSettings) {
  const { squareFeet } = userSettings;
  const {
    heatLossFactor,
    thermalFactor,
    avgCOP,
    ratedCapacity,
    insulationQuality,
  } = metrics;

  return `**Your System Performance Metrics**

• **Heat Loss Factor:** ${heatLossFactor.toLocaleString()} BTU/hr per °F
  (Building loses ${heatLossFactor.toLocaleString()} BTU/hr for each degree of temperature difference)

• **Thermal Factor:** ${thermalFactor} BTU/hr/°F per sq ft
  (${insulationQuality} insulation for ${squareFeet.toLocaleString()} sq ft home)

• **Average COP:** ${avgCOP}
  (Heat pump produces ${avgCOP} units of heat per unit of electricity)

• **Rated Capacity:** ${ratedCapacity.toLocaleString()} BTU/hr at 47°F

${
  thermalFactor > 1.2
    ? "⚠️ High thermal factor - consider improving insulation"
    : thermalFactor < 0.6
    ? "✓ Excellent thermal performance"
    : "✓ Typical thermal performance"
}`;
}

/**
 * Thermostat Strategy Calculator
 * Calculate savings from setback strategies
 */
export function calculateSetbackSavings(params) {
  const {
    winterTemp = 68,
    summerTemp = 75,
    sleepSetback = 4,
    awaySetback = 6,
    sleepHours = 8,
    awayHours = 8,
    // utilityCost = 0.12, // Unused - kept for future use
    // hspf2 = 9, // Unused - kept for future use
    // seer = 16, // Unused - kept for future use
  } = params;

  // Simplified savings calculation
  // const avgCOP = hspf2 / 3.4; // Unused - kept for future use
  // const avgEER = seer * 0.9; // Unused - kept for future use

  // Winter heating savings (setback reduces heat loss)
  const winterDailySetbackHours = sleepHours + awayHours;
  const winterSetbackDegrees =
    (sleepHours * sleepSetback + awayHours * awaySetback) /
    winterDailySetbackHours;
  const winterSavingsPercent = (winterSetbackDegrees / winterTemp) * 0.7; // ~70% efficiency of theoretical
  const winterMonthlySavings = 150 * winterSavingsPercent; // Assuming $150/mo baseline

  // Summer cooling savings
  const summerDailySetbackHours = sleepHours + awayHours;
  const summerSetbackDegrees =
    (sleepHours * sleepSetback + awayHours * awaySetback) /
    summerDailySetbackHours;
  const summerSavingsPercent = (summerSetbackDegrees / (95 - summerTemp)) * 0.6; // 60% efficiency
  const summerMonthlySavings = 120 * summerSavingsPercent; // Assuming $120/mo baseline

  const annualSavings = Math.round(
    winterMonthlySavings * 5 + summerMonthlySavings * 4
  ); // 5 winter, 4 summer months

  return {
    winterSetback: Math.round(winterSetbackDegrees),
    summerSetback: Math.round(summerSetbackDegrees),
    winterMonthlySavings: Math.round(winterMonthlySavings),
    summerMonthlySavings: Math.round(summerMonthlySavings),
    annualSavings,
    paybackDays: 0, // Setbacks are free
  };
}

export function formatSetbackResponse(results) {
  const {
    winterSetback,
    summerSetback,
    winterMonthlySavings,
    summerMonthlySavings,
    annualSavings,
  } = results;

  return `**Thermostat Setback Strategy Savings**

• **Winter setback:** ${winterSetback}°F → Save ~$${winterMonthlySavings}/month
• **Summer setback:** ${summerSetback}°F → Save ~$${summerMonthlySavings}/month

**Annual Savings:** ~$${annualSavings}/year

💡 **Recommended Schedule:**
- Sleep (8 hrs): Set back ${winterSetback}°F
- Away (8 hrs): Set back ${winterSetback + 2}°F
- Home: Normal temperature

Joule can automate this with intelligent scheduling - optimize your HVAC system for maximum savings!`;
}

/**
 * System Comparison (Heat Pump vs Gas Furnace)
 */
export function compareHeatingSystems(params) {
  const {
    squareFeet = 2000,
    winterTemp = 68,
    avgWinterOutdoor = 35,
    electricRate = 0.12,
    gasRate = 1.2,
    hspfHP = 9,
    afueGas = 95,
    // balancePoint = 32, // Unused - kept for future use
  } = params;

  // Heat pump calculations
  const avgCOP = hspfHP / 3.4;
  const heatLossFactor = squareFeet * 0.018 * 1.0; // Assume average insulation
  const avgHeatLoad = heatLossFactor * (winterTemp - avgWinterOutdoor);

  const hpElectricUse = avgHeatLoad / (avgCOP * 3412); // kWh/hr
  const hpDailyCost = hpElectricUse * 24 * electricRate;
  const hpMonthlyCost = Math.round(hpDailyCost * 30);

  // Gas furnace calculations
  const gasEfficiency = afueGas / 100;
  const gasBtuPerHour = avgHeatLoad / gasEfficiency;
  const gasThermPerHour = gasBtuPerHour / 100000;
  const gasDailyCost = gasThermPerHour * 24 * gasRate;
  const gasMonthlyCost = Math.round(gasDailyCost * 30);

  const monthlySavings = gasMonthlyCost - hpMonthlyCost;
  const annualSavings = monthlySavings * 5; // 5 winter months

  return {
    hpMonthlyCost,
    gasMonthlyCost,
    monthlySavings,
    annualSavings,
    winner: monthlySavings > 0 ? "Heat Pump" : "Gas Furnace",
    hpCOP: Math.round(avgCOP * 100) / 100,
  };
}

export function formatComparisonResponse(results) {
  const {
    hpMonthlyCost,
    gasMonthlyCost,
    monthlySavings,
    annualSavings,
    winner,
    hpCOP,
  } = results;

  return `**Heat Pump vs Gas Furnace Comparison**

• **Heat Pump:** $${hpMonthlyCost}/month (COP: ${hpCOP})
• **Gas Furnace:** $${gasMonthlyCost}/month

**${winner} wins!**
Monthly savings: $${Math.abs(monthlySavings)}
Annual savings: $${Math.abs(annualSavings)} over 5 winter months

${
  monthlySavings > 50
    ? "✓ Significant savings with heat pump"
    : monthlySavings > 0
    ? "✓ Heat pump is more economical"
    : "⚠️ Gas furnace may be more cost-effective in your area"
}`;
}

/**
 * Calculate Heat Loss at Specific Outdoor Temperature
 * Uses Thermal Factor (BTU/hr/°F) from analyzed CSV data or calculated from settings
 * @param {Object} params - Calculation parameters
 * @param {number} params.outdoorTemp - Outdoor temperature in °F
 * @param {number} params.indoorTemp - Indoor temperature in °F (default: 68)
 * @param {number} params.thermalFactor - Thermal Factor in BTU/hr/°F per sq ft (from CSV analysis)
 * @param {number} params.heatLossFactor - Heat Loss Factor in BTU/hr/°F (alternative to thermalFactor)
 * @param {number} params.squareFeet - Square footage (required if using thermalFactor)
 * @returns {Object} Heat loss calculation results
 */
export function calculateHeatLoss(params) {
  const {
    outdoorTemp,
    indoorTemp = 68,
    thermalFactor = null,
    heatLossFactor = null,
    squareFeet = null,
  } = params;

  if (outdoorTemp === undefined || outdoorTemp === null) {
    return {
      error: "Outdoor temperature is required",
    };
  }

  // Calculate heat loss factor
  let btuPerHourPerDegF = null;
  let source = "unknown";

  if (heatLossFactor) {
    // Direct heat loss factor provided (from CSV analysis)
    btuPerHourPerDegF = heatLossFactor;
    source = "analyzed CSV data";
  } else if (thermalFactor && squareFeet) {
    // Thermal factor provided (BTU/hr/°F per sq ft)
    btuPerHourPerDegF = thermalFactor * squareFeet;
    source = "thermal factor from analyzed data";
  } else if (squareFeet) {
    // Fallback: estimate from square footage (rough approximation)
    const volume = squareFeet * 8; // Assume 8ft ceiling
    btuPerHourPerDegF = volume * 0.018; // Rough estimate
    source = "estimated from square footage";
  } else {
    return {
      error:
        "Either thermalFactor+squareFeet, heatLossFactor, or squareFeet is required",
    };
  }

  // Calculate temperature difference
  const tempDiff = indoorTemp - outdoorTemp;

  // Calculate heat loss
  const heatLossBtuPerHour = btuPerHourPerDegF * tempDiff;

  return {
    outdoorTemp,
    indoorTemp,
    tempDiff,
    heatLossBtuPerHour: Math.round(heatLossBtuPerHour),
    heatLossFactor: Math.round(btuPerHourPerDegF),
    thermalFactor: squareFeet
      ? Math.round((btuPerHourPerDegF / squareFeet) * 100) / 100
      : null,
    source,
    squareFeet: squareFeet || null,
  };
}

/**
 * Format heat loss response for Ask Joule
 */
export function formatHeatLossResponse(results) {
  if (results.error) {
    return `❌ ${results.error}`;
  }

  const {
    outdoorTemp,
    indoorTemp,
    tempDiff,
    heatLossBtuPerHour,
    heatLossFactor,
    thermalFactor,
    source,
  } = results;

  let response = `**Heat Loss at ${outdoorTemp}°F**\n\n`;
  response += `• **Heat Loss:** ${heatLossBtuPerHour.toLocaleString()} BTU/hr\n`;
  response += `  (Indoor: ${indoorTemp}°F, Outdoor: ${outdoorTemp}°F, ΔT: ${tempDiff}°F)\n\n`;

  if (heatLossFactor) {
    response += `• **Heat Loss Factor:** ${heatLossFactor.toLocaleString()} BTU/hr per °F\n`;
  }

  if (thermalFactor) {
    response += `• **Thermal Factor:** ${thermalFactor} BTU/hr/°F per sq ft\n`;
  }

  response += `\n*Calculated from ${source}*\n`;

  return response;
}

/**
 * System Sizing Calculator (Manual J-style)
 * Simplified load calculation based on loadcalc.net methodology
 * @param {Object} params - Sizing parameters
 * @returns {Object} Sizing results
 */
export function calculateSystemSizing(params) {
  const {
    squareFeet = 2000,
    ceilingHeight = 8,
    insulationQuality = "average", // "poor", "average", "good", "excellent"
    windowType = "double", // "single", "double", "triple", "low-e"
    climateZone = "moderate", // "cold", "moderate", "hot"
    numberOfOccupants = 2,
  } = params;

  // Insulation multipliers (based on Manual J methodology)
  const insulationMultipliers = {
    poor: 1.4,
    average: 1.0,
    good: 0.65,
    excellent: 0.45,
  };

  // Window multipliers
  const windowMultipliers = {
    single: 1.2,
    double: 1.0,
    triple: 0.8,
    "low-e": 0.7,
  };

  // Climate zone base loads (BTU per sq ft)
  const climateBaseLoads = {
    cold: { heating: 50, cooling: 20 },
    moderate: { heating: 35, cooling: 25 },
    hot: { heating: 20, cooling: 35 },
  };

  const insulationMult = insulationMultipliers[insulationQuality] || 1.0;
  const windowMult = windowMultipliers[windowType] || 1.0;
  const climateLoads =
    climateBaseLoads[climateZone] || climateBaseLoads.moderate;

  // Calculate base heating load
  const baseHeatingLoad = squareFeet * climateLoads.heating;
  const heatingLoad = Math.round(baseHeatingLoad * insulationMult * windowMult);

  // Calculate base cooling load
  const baseCoolingLoad = squareFeet * climateLoads.cooling;
  // Add internal gains (people, appliances, lighting)
  const internalGains = numberOfOccupants * 400; // ~400 BTU/hr per person
  const coolingLoad = Math.round(
    baseCoolingLoad * insulationMult * windowMult + internalGains
  );

  // Determine recommended tonnage (1 ton = 12,000 BTU/hr)
  const heatingTons = Math.ceil(heatingLoad / 12000);
  const coolingTons = Math.ceil(coolingLoad / 12000);
  const recommendedTons = Math.max(heatingTons, coolingTons);

  // Round to nearest 0.5 tons for practical sizing
  const practicalTons = Math.ceil(recommendedTons * 2) / 2;

  return {
    squareFeet,
    ceilingHeight,
    insulationQuality,
    windowType,
    climateZone,
    heatingLoad,
    coolingLoad,
    recommendedTons: practicalTons,
    heatingTons: Math.round((heatingLoad / 12000) * 10) / 10,
    coolingTons: Math.round((coolingLoad / 12000) * 10) / 10,
    internalGains,
  };
}
