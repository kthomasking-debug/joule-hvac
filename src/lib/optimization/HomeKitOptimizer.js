// src/lib/optimization/HomeKitOptimizer.js
// Optimizations that work with limited HomeKit data (current temp, target temp, mode only)
// Does NOT assume schedules, comfort settings, or energy usage data

/**
 * Calculate simple optimization based on current state only
 * Works with HomeKit's limited data: current temp, target temp, mode
 */
export function calculateSimpleOptimization(options = {}) {
  const {
    currentTemp = 70,
    targetTemp = 70,
    mode = "heating", // "heating", "cooling", "off", "auto"
    outdoorTemp = null, // Optional - from weather API
    electricRate = 0.12,
    heatLossFactor = 200,
    hspf2 = 9,
    userComfortLevel = "balanced", // "comfort", "balanced", "savings"
  } = options;

  // ASHRAE 55 comfort bounds
  const comfortBounds = {
    heating: { min: 66, max: 74, ideal: 70 },
    cooling: { min: 72, max: 78, ideal: 75 },
  };

  const bounds = mode === "heating" ? comfortBounds.heating : comfortBounds.cooling;

  // Calculate optimal temperature based on user preference
  const adjustments = {
    comfort: { offset: 0 },
    balanced: { offset: -1 },
    savings: { offset: -2 },
  };

  const adj = adjustments[userComfortLevel] || adjustments.balanced;
  const optimalTemp = Math.max(
    bounds.min,
    Math.min(bounds.max, bounds.ideal + adj.offset)
  );

  // Calculate potential savings (rough estimate)
  const tempDiff = mode === "heating" 
    ? targetTemp - optimalTemp  // Lower is better for heating
    : optimalTemp - targetTemp; // Higher is better for cooling

  // Only show savings if optimization would actually save money
  const hasSavingsOpportunity = mode === "heating" 
    ? targetTemp > optimalTemp && tempDiff > 0.5
    : mode === "cooling"
    ? targetTemp < optimalTemp && tempDiff > 0.5
    : false;

  // Rough savings estimate: each degree saves ~3% on heating/cooling
  const savingsPercent = Math.max(0, tempDiff * 0.03);
  
  // Calculate monthly cost estimate
  let monthlySavings = 0;
  if (hasSavingsOpportunity && outdoorTemp !== null) {
    const avgDeltaT = mode === "heating" 
      ? Math.max(0, targetTemp - outdoorTemp)
      : Math.max(0, outdoorTemp - targetTemp);
    const dailyBTU = heatLossFactor * avgDeltaT * 24;
    const dailykWh = dailyBTU / (hspf2 * 3412);
    const dailyCost = dailykWh * electricRate;
    const monthlyCost = dailyCost * 30;
    monthlySavings = monthlyCost * savingsPercent;
  } else if (hasSavingsOpportunity) {
    // Rough estimate without outdoor temp
    monthlySavings = (tempDiff * 0.03 * 100); // Rough $3-5 per degree per month
  }

  // Generate simple reasoning
  const reasoning = {
    primary: hasSavingsOpportunity
      ? `Your target temperature (${targetTemp}°F) can be optimized for better efficiency`
      : `Your target temperature (${targetTemp}°F) is already well-optimized`,
    factors: [],
    comfortImpact: Math.abs(tempDiff) < 1 
      ? "Minimal - you'll barely notice the difference"
      : Math.abs(tempDiff) < 2
      ? "Slight - most people find this comfortable"
      : "Moderate - you may notice the change initially",
  };

  if (targetTemp > optimalTemp + 0.5 && mode === "heating") {
    reasoning.factors.push(`Target temperature (${targetTemp}°F) is above ASHRAE 55 recommended range for heating`);
  } else if (targetTemp < optimalTemp - 0.5 && mode === "cooling") {
    reasoning.factors.push(`Target temperature (${targetTemp}°F) is below ASHRAE 55 recommended range for cooling`);
  }

  if (outdoorTemp !== null) {
    if (mode === "heating" && outdoorTemp > 50) {
      reasoning.factors.push(`Mild outdoor temperature (${Math.round(outdoorTemp)}°F) allows for lower setpoint`);
    } else if (mode === "cooling" && outdoorTemp < 80) {
      reasoning.factors.push(`Mild outdoor temperature (${Math.round(outdoorTemp)}°F) allows for higher setpoint`);
    }
  }

  if (reasoning.factors.length === 0) {
    reasoning.factors.push("Based on ASHRAE 55 comfort standards");
  }

  return {
    current: {
      temp: currentTemp,
      target: targetTemp,
      mode,
    },
    optimal: {
      temp: optimalTemp,
      mode, // Keep same mode
    },
    savings: {
      tempDiff: Math.abs(tempDiff).toFixed(1),
      percent: (savingsPercent * 100).toFixed(1),
      monthlyDollars: monthlySavings.toFixed(2),
    },
    reasoning,
    hasSavingsOpportunity,
    canOptimize: hasSavingsOpportunity,
    // Note: We don't know schedules, so we can only optimize the current target
    limitation: "HomeKit provides limited data - we can only optimize your current target temperature, not schedules",
  };
}

/**
 * Get immediate optimization recommendation based on current state
 * This is what we can do with HomeKit data only
 */
export function getImmediateOptimization(thermostatData, options = {}) {
  if (!thermostatData || !thermostatData.targetTemperature) {
    return {
      available: false,
      reason: "No thermostat data available",
    };
  }

  const optimization = calculateSimpleOptimization({
    currentTemp: thermostatData.temperature || thermostatData.targetTemperature,
    targetTemp: thermostatData.targetTemperature,
    mode: thermostatData.mode || "heat",
    outdoorTemp: options.outdoorTemp || null,
    electricRate: options.electricRate || 0.12,
    heatLossFactor: options.heatLossFactor || 200,
    hspf2: options.hspf2 || 9,
    userComfortLevel: options.userComfortLevel || "balanced",
  });

  return {
    available: optimization.hasSavingsOpportunity,
    recommendation: optimization.hasSavingsOpportunity ? {
      action: `Set target temperature to ${optimization.optimal.temp}°F`,
      current: `${optimization.current.target}°F`,
      optimal: `${optimization.optimal.temp}°F`,
      savings: optimization.savings,
      reasoning: optimization.reasoning,
    } : null,
    limitation: optimization.limitation,
  };
}

/**
 * Check if current settings are wasteful
 * Based on simple heuristics with limited data
 */
export function checkForWaste(thermostatData, options = {}) {
  if (!thermostatData) {
    return { hasWaste: false };
  }

  const { targetTemperature, mode, temperature } = thermostatData;
  const { outdoorTemp, heatLossFactor, electricRate } = options;

  const warnings = [];

  // Check for extreme temperatures
  if (mode === "heating" && targetTemperature > 74) {
    warnings.push({
      type: "extreme_temp",
      severity: "high",
      message: `Target temperature (${targetTemperature}°F) is very high for heating`,
      recommendation: "Consider lowering to 70-72°F for better efficiency",
      estimatedSavings: "$10-20/month",
    });
  }

  if (mode === "cooling" && targetTemperature < 72) {
    warnings.push({
      type: "extreme_temp",
      severity: "high",
      message: `Target temperature (${targetTemperature}°F) is very low for cooling`,
      recommendation: "Consider raising to 74-76°F for better efficiency",
      estimatedSavings: "$10-20/month",
    });
  }

  // Check for large gap between current and target (system working hard)
  if (temperature && Math.abs(temperature - targetTemperature) > 3) {
    warnings.push({
      type: "large_gap",
      severity: "medium",
      message: `Large temperature gap (${Math.abs(temperature - targetTemperature).toFixed(1)}°F) - system working hard`,
      recommendation: "Consider a smaller target to reduce system strain",
    });
  }

  // Check for heating when it's warm outside (if we have outdoor temp)
  if (mode === "heating" && outdoorTemp && outdoorTemp > 65) {
    warnings.push({
      type: "unnecessary_heating",
      severity: "medium",
      message: `Heating when outdoor temp is ${Math.round(outdoorTemp)}°F`,
      recommendation: "Consider turning off heat or lowering target significantly",
      estimatedSavings: "$15-30/month",
    });
  }

  // Check for cooling when it's cool outside
  if (mode === "cooling" && outdoorTemp && outdoorTemp < 75) {
    warnings.push({
      type: "unnecessary_cooling",
      severity: "medium",
      message: `Cooling when outdoor temp is ${Math.round(outdoorTemp)}°F`,
      recommendation: "Consider turning off AC or raising target significantly",
      estimatedSavings: "$15-30/month",
    });
  }

  return {
    hasWaste: warnings.length > 0,
    warnings,
  };
}

/**
 * Get time-based optimization suggestion
 * Since we can't read schedules, we suggest based on time of day
 */
export function getTimeBasedSuggestion(currentTarget, mode, options = {}) {
  const hour = new Date().getHours();
  const { userComfortLevel = "balanced" } = options;

  // Simple time-based suggestions (we don't know actual schedule)
  const suggestions = [];

  // Nighttime (10pm - 6am) - suggest lower for heating, higher for cooling
  if (hour >= 22 || hour < 6) {
    if (mode === "heating") {
      const nightOptimal = userComfortLevel === "savings" ? 66 : 68;
      if (currentTarget > nightOptimal + 0.5) {
        suggestions.push({
          time: "nighttime",
          current: currentTarget,
          suggested: nightOptimal,
          reason: "Lower nighttime temperature saves energy while you sleep",
          savings: "$5-10/month",
        });
      }
    } else if (mode === "cooling") {
      const nightOptimal = userComfortLevel === "savings" ? 76 : 74;
      if (currentTarget < nightOptimal - 0.5) {
        suggestions.push({
          time: "nighttime",
          current: currentTarget,
          suggested: nightOptimal,
          reason: "Higher nighttime temperature saves energy while you sleep",
          savings: "$5-10/month",
        });
      }
    }
  }

  // Daytime (6am - 10pm)
  else {
    if (mode === "heating") {
      const dayOptimal = userComfortLevel === "savings" ? 68 : 70;
      if (currentTarget > dayOptimal + 0.5) {
        suggestions.push({
          time: "daytime",
          current: currentTarget,
          suggested: dayOptimal,
          reason: "Optimal daytime temperature for comfort and efficiency",
          savings: "$5-15/month",
        });
      }
    } else if (mode === "cooling") {
      const dayOptimal = userComfortLevel === "savings" ? 76 : 75;
      if (currentTarget < dayOptimal - 0.5) {
        suggestions.push({
          time: "daytime",
          current: currentTarget,
          suggested: dayOptimal,
          reason: "Optimal daytime temperature for comfort and efficiency",
          savings: "$5-15/month",
        });
      }
    }
  }

  return {
    hasSuggestion: suggestions.length > 0,
    suggestions,
    note: "These are general recommendations. Your Ecobee may have its own schedule that we can't see via HomeKit.",
  };
}

export default {
  calculateSimpleOptimization,
  getImmediateOptimization,
  checkForWaste,
  getTimeBasedSuggestion,
};


