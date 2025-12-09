// Balance point calculation utility for Ask Joule
// Calculates the outdoor temperature where heat pump output equals building heat loss

const CONSTANTS = {
  BTU_PER_KWH: 3412.14,
  KW_PER_TON_OUTPUT: 3.517,
  MIN_CAPACITY_FACTOR: 0.3,
};

export function calculateBalancePoint(userSettings = {}) {
  // Priority 1: Use analyzer balance point if available (most accurate - from real thermostat data)
  if (
    userSettings.analyzerBalancePoint != null &&
    Number.isFinite(userSettings.analyzerBalancePoint) &&
    userSettings.analyzerBalancePoint > -50 && // Valid range check
    userSettings.analyzerBalancePoint < 100
  ) {
    // Use the analyzer's calculated balance point directly
    // This is based on actual thermostat data showing when aux heat engaged
    const analyzerBalancePoint = userSettings.analyzerBalancePoint;
    const btuLossPerDegF =
      userSettings.heatLossFactor &&
      Number.isFinite(userSettings.heatLossFactor) &&
      userSettings.heatLossFactor > 0
        ? userSettings.heatLossFactor
        : 200; // Fallback for display purposes

    return {
      balancePoint: Math.round(analyzerBalancePoint * 10) / 10,
      auxHeatAtDesign: 0, // Will be calculated if needed
      copAtDesign: null,
      heatLossFactor: Math.round(btuLossPerDegF),
      interpretation: getBalancePointInterpretation(analyzerBalancePoint),
      source: "analyzer", // Indicate this came from analyzer
    };
  }

  // Ensure we always have valid defaults - handle null/undefined explicitly
  let tons = userSettings.tons;
  if (!tons && userSettings.capacity) {
    // Convert capacity (kBTU) to tons: 12 kBTU = 1 ton
    tons = userSettings.capacity / 12.0;
  }
  if (!tons || tons <= 0) {
    tons = 3; // Default to 3 tons if not set
  }

  const {
    squareFeet = 2000,
    ceilingHeight = 8,
    insulationLevel = 1.0, // multiplier: 0.65 = good, 1.0 = average, 1.4 = poor
    homeShape = 1.0, // multiplier: affects heat loss (1.0 = standard, higher = more surface area)
    hspf2 = 9,
    targetIndoorTemp = userSettings.winterThermostat || 68,
    designOutdoorTemp = 20,
  } = userSettings;

  // Calculate building heat loss rate (BTU/hr per °F difference)
  // Priority: Use provided heatLossFactor if available (from analyzer or manual entry),
  // otherwise calculate from building characteristics
  let btuLossPerDegF;

  if (
    userSettings.heatLossFactor &&
    Number.isFinite(userSettings.heatLossFactor) &&
    userSettings.heatLossFactor > 0
  ) {
    // Use provided heat loss factor (from analyzer data or manual entry)
    btuLossPerDegF = userSettings.heatLossFactor;
  } else {
    // Calculate from building characteristics (fallback)
    // Use standard ASHRAE-based calculation: base BTU/sqft at 70°F delta-T, then divide by 70 to get per-degree rate
    // IMPORTANT: Match HeatPumpEnergyFlow page calculation exactly (includes homeShape)
    const BASE_BTU_PER_SQFT_AT_70F = 22.67; // Standard base heat loss at 70°F delta-T
    const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1; // Adjust for ceiling height (8ft = 1.0)
    const designTempDiff = Math.max(10, Math.abs(70 - designOutdoorTemp)); // Match HeatPumpEnergyFlow logic
    const baseHeatLossAt70F =
      squareFeet *
      BASE_BTU_PER_SQFT_AT_70F *
      ceilingMultiplier *
      insulationLevel *
      homeShape;
    // Convert to BTU/hr per °F: divide by design temp difference (matches HeatPumpEnergyFlow)
    btuLossPerDegF = baseHeatLossAt70F / designTempDiff;
  }

  // Check if custom equipment profile is enabled and has required data
  const useCustomProfile =
    userSettings.useCustomEquipmentProfile &&
    userSettings.capacity47 &&
    userSettings.capacity17 &&
    userSettings.cop47 &&
    userSettings.cop17;

  // Heat pump capacity derating with temperature
  // At 47°F, HP operates at rated capacity. Below that, capacity decreases
  const ratedCapacityBtu = tons * 12000; // Tons to BTU/hr at rated conditions (fallback)

  // Helper function for linear interpolation
  const interpolate = (x, x1, y1, x2, y2) => {
    if (x2 === x1) return y1;
    return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
  };

  // Get capacity at a given temperature using custom profile or generic curve
  const getCapacityAtTemp = (temp) => {
    if (useCustomProfile) {
      // Use linear interpolation between 47°F and 17°F
      if (temp >= 47) {
        return userSettings.capacity47;
      } else if (temp <= 17) {
        // Extrapolate below 17°F if we have 5°F data, otherwise use linear from 17°F
        if (userSettings.capacity5) {
          return interpolate(
            temp,
            17,
            userSettings.capacity17,
            5,
            userSettings.capacity5
          );
        }
        // Extrapolate linearly from 17°F (assume continues at same rate)
        const slope =
          (userSettings.capacity17 - userSettings.capacity47) / (17 - 47);
        return Math.max(0, userSettings.capacity17 + slope * (temp - 17));
      } else {
        // Interpolate between 47°F and 17°F
        return interpolate(
          temp,
          47,
          userSettings.capacity47,
          17,
          userSettings.capacity17
        );
      }
    } else {
      // Generic capacity derating: matches HeatPumpEnergyFlow exactly
      // Standard curve: 100% at 47°F+, linear derate to 64% at 17°F, then 0.01 per °F below 17°F
      let capacityFactor;
      if (temp >= 47) {
        capacityFactor = 1.0;
      } else if (temp >= 17) {
        // Linear derate from 100% @ 47°F to 64% @ 17°F
        // Slope = (1.0 - 0.64) / (47 - 17) = 0.36 / 30 = 0.012 per °F
        capacityFactor = 1.0 - (47 - temp) * 0.012;
      } else {
        // Below 17°F: continue derating at 0.01 per °F below 17°F
        // At 17°F: 0.64, at 5°F: 0.64 - (17-5)*0.01 = 0.64 - 0.12 = 0.52
        capacityFactor = 0.64 - (17 - temp) * 0.01;
      }
      // Ensure minimum capacity (system never completely shuts off)
      capacityFactor = Math.max(CONSTANTS.MIN_CAPACITY_FACTOR, capacityFactor);
      return ratedCapacityBtu * capacityFactor;
    }
  };

  // Get COP at a given temperature using custom profile or generic curve
  const getCOPAtTemp = (temp) => {
    if (useCustomProfile) {
      // Use linear interpolation between 47°F and 17°F
      if (temp >= 47) {
        return userSettings.cop47;
      } else if (temp <= 17) {
        // Extrapolate below 17°F if we have 5°F data, otherwise use linear from 17°F
        if (userSettings.cop5) {
          return interpolate(
            temp,
            17,
            userSettings.cop17,
            5,
            userSettings.cop5
          );
        }
        // Extrapolate linearly from 17°F (assume continues at same rate)
        const slope = (userSettings.cop17 - userSettings.cop47) / (17 - 47);
        return Math.max(1.0, userSettings.cop17 + slope * (temp - 17));
      } else {
        // Interpolate between 47°F and 17°F
        return interpolate(
          temp,
          47,
          userSettings.cop47,
          17,
          userSettings.cop17
        );
      }
    } else {
      // Generic COP calculation based on HSPF2
      const avgCOP = hspf2 / 3.4;
      const tempAdjustedCOP = avgCOP * (1 + (temp - 47) * 0.01);
      return Math.max(1.5, tempAdjustedCOP);
    }
  };

  // Generate temperature range data from 60°F down to design temp
  const data = [];
  for (let temp = 60; temp >= designOutdoorTemp; temp -= 1) {
    const thermalOutputBtu = getCapacityAtTemp(temp);

    // Building heat loss at this outdoor temp
    const deltaT = targetIndoorTemp - temp;
    const buildingHeatLossBtu = btuLossPerDegF * deltaT;

    const cop = getCOPAtTemp(temp);

    data.push({
      outdoorTemp: temp,
      thermalOutputBtu,
      buildingHeatLossBtu,
      cop,
      surplus: thermalOutputBtu - buildingHeatLossBtu,
    });
  }

  // Find balance point: where surplus goes from positive to negative
  let balancePoint = null;
  for (let i = 0; i < data.length - 1; i++) {
    const curr = data[i];
    const next = data[i + 1];
    if (curr.surplus >= 0 && next.surplus < 0) {
      // Linear interpolation
      const t = curr.surplus / (curr.surplus - next.surplus);
      balancePoint =
        curr.outdoorTemp + t * (next.outdoorTemp - curr.outdoorTemp);
      break;
    }
    // Also check if we cross zero in the opposite direction (negative to positive)
    if (curr.surplus < 0 && next.surplus >= 0) {
      const t = Math.abs(curr.surplus) / (next.surplus - curr.surplus);
      balancePoint =
        curr.outdoorTemp + t * (next.outdoorTemp - curr.outdoorTemp);
      break;
    }
  }

  // If no crossover found, check if system is oversized (always positive surplus)
  // or undersized (always negative surplus)
  if (balancePoint === null && data.length > 0) {
    const firstSurplus = data[0].surplus;
    const lastSurplus = data[data.length - 1].surplus;

    // If surplus is always positive, system is oversized - balance point is below design temp
    // OR it could be above 60°F if the system is undersized at warmer temps
    if (firstSurplus > 0 && lastSurplus > 0) {
      // Try binary search to find balance point by extending range
      // First, check if balance point might be above 60°F
      let foundAbove = false;
      for (let test = 70; test >= 60; test -= 1) {
        const testOutput = getCapacityAtTemp(test);
        const testDeltaT = targetIndoorTemp - test;
        const testHeatLoss = btuLossPerDegF * testDeltaT;
        const testSurplus = testOutput - testHeatLoss;
        if (testSurplus <= 0) {
          // Found crossover above 60°F
          // Interpolate between this and next temp
          const nextTest = test - 1;
          const nextOutput = getCapacityAtTemp(nextTest);
          const nextDeltaT = targetIndoorTemp - nextTest;
          const nextHeatLoss = btuLossPerDegF * nextDeltaT;
          const nextSurplus = nextOutput - nextHeatLoss;
          if (nextSurplus > 0) {
            const t = Math.abs(testSurplus) / (nextSurplus - testSurplus);
            balancePoint = test + t * (nextTest - test);
            foundAbove = true;
            break;
          }
        }
      }

      if (!foundAbove) {
        // Balance point is below design temp - use binary search to find it accurately
        let lowTemp = designOutdoorTemp - 20; // Extend search range below design
        let highTemp = designOutdoorTemp;
        let bestBalancePoint = null;

        // Binary search for balance point
        for (let iterations = 0; iterations < 50; iterations++) {
          const midTemp = (lowTemp + highTemp) / 2;
          const midOutput = getCapacityAtTemp(midTemp);
          const midDeltaT = targetIndoorTemp - midTemp;
          const midHeatLoss = btuLossPerDegF * midDeltaT;
          const midSurplus = midOutput - midHeatLoss;

          if (Math.abs(midSurplus) < 10) {
            // Close enough to zero
            bestBalancePoint = midTemp;
            break;
          }

          if (midSurplus > 0) {
            // Still positive, balance point is lower
            highTemp = midTemp;
          } else {
            // Negative, balance point is higher
            lowTemp = midTemp;
          }

          bestBalancePoint = midTemp;
        }

        if (bestBalancePoint !== null) {
          balancePoint = bestBalancePoint;
        } else {
          // Fallback: extrapolate using linear regression from all data points
          if (data.length >= 2) {
            const last = data[data.length - 1];
            const secondLast = data[data.length - 2];
            const surplusSlope =
              (last.surplus - secondLast.surplus) /
              (last.outdoorTemp - secondLast.outdoorTemp);
            if (surplusSlope < 0 && Math.abs(surplusSlope) > 0.0001) {
              balancePoint = last.outdoorTemp - last.surplus / surplusSlope;
            } else {
              // Use average rate of change across all points
              const avgSurplusChange =
                (firstSurplus - lastSurplus) /
                (data[0].outdoorTemp - last.outdoorTemp);
              if (avgSurplusChange < 0 && Math.abs(avgSurplusChange) > 0.0001) {
                balancePoint =
                  last.outdoorTemp - last.surplus / avgSurplusChange;
              }
            }
          }
        }
      }
    }
    // If surplus is always negative, system is undersized - balance point is above 60°F
    else if (firstSurplus < 0 && lastSurplus < 0) {
      // Extrapolate above 60°F to find where it would cross zero
      if (data.length >= 2) {
        const first = data[0];
        const second = data[1];
        const surplusSlope =
          (second.surplus - first.surplus) /
          (second.outdoorTemp - first.outdoorTemp);
        if (surplusSlope > 0 && Math.abs(surplusSlope) > 0.0001) {
          // Positive slope means surplus is increasing
          balancePoint = first.outdoorTemp - first.surplus / surplusSlope;
        } else {
          // If slope is too small, estimate based on average rate of change
          const last = data[data.length - 1];
          const avgSurplusChange =
            (lastSurplus - firstSurplus) /
            (last.outdoorTemp - first.outdoorTemp);
          if (avgSurplusChange > 0 && Math.abs(avgSurplusChange) > 0.0001) {
            balancePoint = first.outdoorTemp - first.surplus / avgSurplusChange;
          } else {
            // Very undersized system - balance point is well above 60°F
            balancePoint = 70; // Estimate 70°F (above normal range)
          }
        }
      } else {
        // Only one data point - estimate based on heat loss vs capacity
        balancePoint = 70; // Conservative estimate for undersized
      }
    }
    // If surplus changes sign but we didn't catch it in the loop, find the closest crossover
    else if (firstSurplus * lastSurplus < 0) {
      // There IS a crossover, but we missed it - find it more carefully
      for (let i = 0; i < data.length - 1; i++) {
        const curr = data[i];
        const next = data[i + 1];
        if (Math.abs(curr.surplus) < 100 || Math.abs(next.surplus) < 100) {
          // Very close to zero - use interpolation
          const t = curr.surplus / (curr.surplus - next.surplus);
          balancePoint =
            curr.outdoorTemp + t * (next.outdoorTemp - curr.outdoorTemp);
          break;
        }
      }
    }

    // Final fallback: if still null, use iterative search to find exact balance point
    if (balancePoint === null && data.length > 0) {
      // Use iterative method to solve: thermalOutput(temp) = heatLossRate * (targetIndoorTemp - temp)
      let testTemp = 50; // Start in middle of typical range
      let bestTemp = testTemp;
      let bestError = Infinity;

      for (let iterations = 0; iterations < 100; iterations++) {
        const testOutput = getCapacityAtTemp(testTemp);
        const testDeltaT = targetIndoorTemp - testTemp;
        const testHeatLoss = btuLossPerDegF * testDeltaT;
        const error = Math.abs(testOutput - testHeatLoss);

        if (error < bestError) {
          bestError = error;
          bestTemp = testTemp;
        }

        if (error < 1) {
          // Close enough
          balancePoint = testTemp;
          break;
        }

        // Adjust temperature based on whether output is too high or too low
        if (testOutput > testHeatLoss) {
          // Output too high, need lower temp (more heat loss)
          testTemp -= (testOutput - testHeatLoss) / (btuLossPerDegF * 10);
        } else {
          // Output too low, need higher temp (less heat loss)
          testTemp += (testHeatLoss - testOutput) / (btuLossPerDegF * 10);
        }

        // Clamp to reasonable range
        testTemp = Math.max(-20, Math.min(80, testTemp));
      }

      if (balancePoint === null && bestError < 1000) {
        balancePoint = bestTemp;
      }
    }
  }

  // Calculate aux heat need at design temp
  const designData = data.find((d) => d.outdoorTemp === designOutdoorTemp);
  const auxHeatNeeded = designData ? Math.max(0, -designData.surplus) : 0;

  return {
    balancePoint: balancePoint ? Math.round(balancePoint * 10) / 10 : null,
    auxHeatAtDesign: Math.round(auxHeatNeeded),
    copAtDesign: designData ? Math.round(designData.cop * 100) / 100 : null,
    heatLossFactor: Math.round(btuLossPerDegF),
    interpretation: getBalancePointInterpretation(balancePoint),
  };
}

function getBalancePointInterpretation(balancePoint) {
  if (!balancePoint) return "Unable to calculate - check your system settings";

  if (balancePoint <= 25) {
    return "Lower balance point — heat pump is well-sized for your home. Minimal aux heat needed.";
  } else if (balancePoint <= 35) {
    return "Moderate balance point — aux heat will help on colder days. System is reasonably sized.";
  } else {
    return "Higher balance point — aux heat will engage more often in winter. Consider upgrading to larger/more efficient unit.";
  }
}

export function formatBalancePointResponse(result, userSettings) {
  if (!result.balancePoint) {
    return "I need your system details to calculate the balance point. Please set your square footage, HSPF rating, and system capacity in Settings first.";
  }

  const { balancePoint, auxHeatAtDesign, copAtDesign, heatLossFactor } = result;
  const { designOutdoorTemp = 20 } = userSettings;

  return `Your system's balance point is **${balancePoint}°F** — the outdoor temperature where your heat pump's output equals your home's heat loss.

**Key metrics:**
• Balance point: ${balancePoint}°F
• Heat loss rate: ${heatLossFactor.toLocaleString()} BTU/hr per °F
• COP at ${designOutdoorTemp}°F design: ${copAtDesign}
• Aux heat needed at ${designOutdoorTemp}°F: ${auxHeatAtDesign.toLocaleString()} BTU/hr

**What this means:**
${result.interpretation}

Below ${balancePoint}°F, your heat pump alone can't keep up, and auxiliary heat (electric strips or gas furnace backup) will engage to maintain comfort.`;
}
