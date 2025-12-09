/**
 * Data-Driven Threshold Recommendations
 * Calculates optimal ecobee threshold settings based on CSV analysis data
 */

/**
 * Calculate recommended threshold settings based on analysis data
 * @param {Object} analysisResults - Results from analyzeThermostatData
 * @param {Array} parsedCsvRows - Parsed CSV data rows
 * @param {Object} config - Configuration (squareFeet, etc.)
 * @returns {Object} Recommended settings with reasoning
 */
export function calculateThresholdRecommendations(analysisResults, parsedCsvRows, config = {}) {
  if (!analysisResults || !parsedCsvRows || parsedCsvRows.length === 0) {
    return null;
  }

  const balancePoint = analysisResults.balancePoint;
  const heatLossFactor = analysisResults.heatLossFactor || 0;
  const squareFeet = config.squareFeet || 2000;

  // 1. Compressor Min Outdoor Temperature (Hard Deck)
  let compressorMinOutdoorTemp = null;
  if (balancePoint != null && isFinite(balancePoint) && balancePoint > -50 && balancePoint < 100 && balancePoint !== -99) {
    // Set 5°F below balance point, but not below 0°F for safety
    compressorMinOutdoorTemp = Math.max(0, Math.round(balancePoint - 5));
  }

  // 2. Aux Heat Max Outdoor Temperature (Money Saver)
  let auxHeatMaxOutdoorTemp = null;
  if (balancePoint != null && isFinite(balancePoint) && balancePoint > -50 && balancePoint < 100 && balancePoint !== -99) {
    // Set 5-10°F above balance point, default to 5°F
    auxHeatMaxOutdoorTemp = Math.round(balancePoint + 5);
  }

  // 3. Heat Differential Temperature (Short Cycle Killer)
  // Count cycles per hour between 30-40°F outdoor temps
  let heatDifferential = 0.5; // Default
  let cyclesPerHour = 0;
  
  try {
    if (parsedCsvRows && parsedCsvRows.length > 0) {
      const availableCols = Object.keys(parsedCsvRows[0]);
      const outdoorTempCol = availableCols.find(
        col => /outdoor.*temp/i.test(col) || /^Outdoor Tel$/i.test(col.trim()) || /outdoor/i.test(col)
      );
      const heatStageCol = availableCols.find(
        col => /heat.*stage/i.test(col) || /^Heat Stage$/i.test(col.trim()) || /heat.*stage.*1/i.test(col)
      );

      if (outdoorTempCol && heatStageCol) {
        // Filter rows between 30-40°F outdoor temp
        const relevantRows = parsedCsvRows.filter(row => {
          const outdoorTemp = parseFloat(row[outdoorTempCol]);
          return !isNaN(outdoorTemp) && outdoorTemp >= 30 && outdoorTemp <= 40;
        });

        if (relevantRows.length > 0) {
          // Count cycles: transitions from 0 to >0
          let cycles = 0;
          let previousRunning = false;
          for (let i = 0; i < relevantRows.length; i++) {
            const runtime = parseFloat(relevantRows[i][heatStageCol] || 0);
            const isRunning = runtime > 0;
            if (isRunning && !previousRunning) {
              cycles++;
            }
            previousRunning = isRunning;
          }

          // Estimate cycles per hour (assuming 5-minute intervals)
          const hours = relevantRows.length * (5 / 60);
          cyclesPerHour = hours > 0 ? cycles / hours : 0;

          // Set differential based on cycles
          if (cyclesPerHour > 4) {
            heatDifferential = 1.0; // Wide differential to prevent short cycling
          } else if (cyclesPerHour < 3) {
            heatDifferential = 0.5; // Tight for comfort
          } else {
            heatDifferential = 0.75; // Balanced
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error calculating cycles per hour:', e);
  }

  // 4. Heat Dissipation Time (Free Heat Scavenger)
  // Check post-cycle temperature rise
  let heatDissipationTime = 30; // Default
  try {
    if (parsedCsvRows && parsedCsvRows.length > 0) {
      const availableCols = Object.keys(parsedCsvRows[0]);
      const currentTempCol = availableCols.find(
        col => /current.*temp/i.test(col) || /^Current Ten$/i.test(col.trim()) || /thermostat.*temp/i.test(col) || /indoor.*temp/i.test(col)
      );
      const heatStageCol = availableCols.find(
        col => /heat.*stage/i.test(col) || /^Heat Stage$/i.test(col.trim()) || /heat.*stage.*1/i.test(col)
      );

      if (currentTempCol && heatStageCol) {
        // Find periods where heat stage goes from >0 to 0
        let postCycleRises = [];
        for (let i = 1; i < parsedCsvRows.length; i++) {
          const prevRuntime = parseFloat(parsedCsvRows[i - 1][heatStageCol] || 0);
          const currRuntime = parseFloat(parsedCsvRows[i][heatStageCol] || 0);
          const prevTemp = parseFloat(parsedCsvRows[i - 1][currentTempCol]);
          const currTemp = parseFloat(parsedCsvRows[i][currentTempCol]);

          // Heat just turned off
          if (prevRuntime > 0 && currRuntime === 0 && !isNaN(prevTemp) && !isNaN(currTemp)) {
            const tempRise = currTemp - prevTemp;
            if (tempRise > 0) {
              postCycleRises.push(tempRise);
            }
          }
        }

        if (postCycleRises.length > 0) {
          const avgRise = postCycleRises.reduce((a, b) => a + b, 0) / postCycleRises.length;
          // If we see temperature rise after heat stops, we're wasting heat in ducts
          if (avgRise >= 0.1) {
            heatDissipationTime = 60; // Force 60 seconds to scavenge heat
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error calculating heat dissipation time:', e);
  }

  // 5. Compressor Min On Time (Oil Return Safety)
  // Check for short runtimes (2-4 minutes)
  let compressorMinOnTime = 300; // Default 5 minutes
  try {
    if (parsedCsvRows && parsedCsvRows.length > 0) {
      const availableCols = Object.keys(parsedCsvRows[0]);
      const compressorStageCol = availableCols.find(
        col => /compressor.*stage/i.test(col) || /compressor/i.test(col)
      );

      if (compressorStageCol) {
        const shortRuntimes = parsedCsvRows.filter(row => {
          const runtime = parseFloat(row[compressorStageCol] || 0);
          return runtime > 0 && runtime < 240; // Less than 4 minutes
        });

        // If we have many short runtimes, increase min on time
        if (shortRuntimes.length > parsedCsvRows.length * 0.1) {
          // More than 10% are short cycles
          compressorMinOnTime = 600; // 10 minutes to force longer runs
        }
      }
    }
  } catch (e) {
    console.warn('Error calculating compressor min on time:', e);
  }

  // 6. AC Overcool Max (Dehumidifier Proxy)
  // Check average summer humidity
  let acOvercoolMax = 0; // Default off
  try {
    if (parsedCsvRows && parsedCsvRows.length > 0) {
      const availableCols = Object.keys(parsedCsvRows[0]);
      const humidityCol = availableCols.find(
        col => /humidity/i.test(col)
      );
      const dateCol = availableCols.find(
        col => /^Date$/i.test(col.trim())
      );

      if (humidityCol && dateCol) {
        // Filter summer months (June, July, August)
        const summerRows = parsedCsvRows.filter(row => {
          const dateStr = String(row[dateCol] || '');
          const monthMatch = dateStr.match(/\/(\d{1,2})\//);
          if (monthMatch) {
            const month = parseInt(monthMatch[1], 10);
            return month >= 6 && month <= 8; // June-August
          }
          return false;
        });

        if (summerRows.length > 0) {
          const humidities = summerRows
            .map(row => parseFloat(row[humidityCol]))
            .filter(h => !isNaN(h));
          
          if (humidities.length > 0) {
            const avgHumidity = humidities.reduce((a, b) => a + b, 0) / humidities.length;
            if (avgHumidity > 55) {
              acOvercoolMax = 2; // Enable 2°F overcool for dehumidification
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error calculating AC overcool max:', e);
  }

  // 7. Compressor to Aux Temperature Delta (Patience Setting)
  // Based on heat loss factor - slow heat loss = more patience
  let compressorToAuxTempDelta = 1; // Default
  if (heatLossFactor > 0) {
    // Low heat loss factor = efficient house = can wait longer
    // High heat loss factor = leaky house = need aux sooner
    if (heatLossFactor < 400) {
      // Very efficient house
      compressorToAuxTempDelta = 3;
    } else if (heatLossFactor < 600) {
      // Efficient house
      compressorToAuxTempDelta = 2;
    } else {
      // Average or leaky house
      compressorToAuxTempDelta = 1;
    }
  }

  // Determine profile and reason
  let profile = "Efficiency Optimized (Manual Staging)";
  let reason = "Based on your system analysis data.";
  
  if (cyclesPerHour > 4) {
    reason = "High efficiency envelope detected. Preventing short cycles.";
  } else if (heatLossFactor < 400) {
    reason = "Very efficient home detected. Optimized for efficiency and comfort.";
  }

  // Build recommendations object
  const recommendations = {
    profile,
    reason,
    settings: {},
  };

  // Only include settings that we calculated
  if (compressorMinOutdoorTemp !== null) {
    recommendations.settings.compressor_min_outdoor_temp = `${compressorMinOutdoorTemp}°F`;
  }
  if (auxHeatMaxOutdoorTemp !== null) {
    recommendations.settings.aux_heat_max_outdoor_temp = `${auxHeatMaxOutdoorTemp}°F`;
  }
  recommendations.settings.heat_differential_temp = `${heatDifferential}°F`;
  recommendations.settings.cool_differential_temp = `${heatDifferential}°F`; // Use same as heat
  recommendations.settings.heat_dissipation_time = `${heatDissipationTime} seconds`;
  recommendations.settings.compressor_min_cycle_off = "600 seconds"; // Always recommend 10 min for efficiency
  recommendations.settings.compressor_min_on_time = `${compressorMinOnTime} seconds`;
  
  if (acOvercoolMax > 0) {
    recommendations.settings.ac_overcool_max = `${acOvercoolMax}°F`;
  }
  
  // Only include compressor to aux if we have heat loss data
  if (heatLossFactor > 0) {
    recommendations.settings.compressor_to_aux_temp_delta = `${compressorToAuxTempDelta}°F`;
  }

  // Add staging recommendation
  recommendations.settings.configure_staging = "Manually";

  // Add metadata
  recommendations.metadata = {
    balancePoint: balancePoint ? balancePoint.toFixed(1) : null,
    heatLossFactor: heatLossFactor ? heatLossFactor.toFixed(1) : null,
    cyclesPerHour: cyclesPerHour.toFixed(1),
    squareFeet,
  };

  return recommendations;
}

