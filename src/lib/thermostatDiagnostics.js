// Thermostat data diagnostics engine
// Detects short cycling, inefficient operation, and other system issues

/**
 * Detect short cycling in thermostat data
 * Short cycling = compressor turning on/off too frequently
 * @param {Array} data - Parsed CSV rows with Heat Stage 1 (sec) column
 * @param {number} thresholdMinutes - Time window to check (default: 60 minutes)
 * @param {number} maxCycles - Maximum acceptable cycles in window (default: 4)
 * @returns {Object} { hasIssue: boolean, severity: string, description: string, details: object }
 */
export function detectShortCycling(data, thresholdMinutes = 60, maxCycles = 4) {
  if (!data || data.length < 4) {
    return {
      hasIssue: false,
      severity: "none",
      description: "Insufficient data for short cycling detection",
    };
  }

  const heatStage1Col = "Heat Stage 1 (sec)";

  // Count cycles: transitions from 0 to >0 runtime
  let cycles = [];
  let previousRunning = false;

  for (let i = 0; i < data.length; i++) {
    const runtime = parseFloat(data[i][heatStage1Col] || 0);
    const isRunning = runtime > 0;

    if (isRunning && !previousRunning) {
      // Compressor just turned on
      cycles.push({
        index: i,
        date: data[i].Date,
        time: data[i].Time,
        runtime,
      });
    }

    previousRunning = isRunning;
  }

  if (cycles.length === 0) {
    return {
      hasIssue: false,
      severity: "none",
      description: "No heating cycles detected in data",
    };
  }

  // Check for excessive cycling in rolling window
  let maxCyclesInWindow = 0;
  let worstWindow = null;

  for (let i = 0; i < cycles.length; i++) {
    let windowCycles = 1;
    const startIdx = cycles[i].index;

    for (let j = i + 1; j < cycles.length; j++) {
      const endIdx = cycles[j].index;
      const rowSpan = endIdx - startIdx;

      // Assuming each row is ~5 minutes (adjust based on actual data)
      const estimatedMinutes = rowSpan * 5;

      if (estimatedMinutes <= thresholdMinutes) {
        windowCycles++;
      } else {
        break;
      }
    }

    if (windowCycles > maxCyclesInWindow) {
      maxCyclesInWindow = windowCycles;
      worstWindow = {
        startDate: cycles[i].date,
        startTime: cycles[i].time,
        cycles: windowCycles,
      };
    }
  }

  const hasIssue = maxCyclesInWindow > maxCycles;
  const severity =
    maxCyclesInWindow > maxCycles * 2
      ? "critical"
      : maxCyclesInWindow > maxCycles * 1.5
      ? "high"
      : maxCyclesInWindow > maxCycles
      ? "medium"
      : "none";

  return {
    hasIssue,
    severity,
    description: hasIssue
      ? `Short cycling detected: ${maxCyclesInWindow} cycles in ${thresholdMinutes} minutes (max recommended: ${maxCycles})`
      : "No short cycling detected",
    details: {
      maxCyclesInWindow,
      threshold: maxCycles,
      worstWindow,
      totalCycles: cycles.length,
    },
  };
}

/**
 * Detect excessive auxiliary heat usage
 * @param {Array} data - Parsed CSV rows
 * @returns {Object} Issue object
 */
export function detectExcessiveAuxHeat(data) {
  if (!data || data.length === 0) {
    return {
      hasIssue: false,
      severity: "none",
      description: "No data for aux heat analysis",
    };
  }

  const auxHeatCol = "Aux Heat 1 (sec)";
  const outdoorTempCol = "Outdoor Temp (F)";

  let totalRuntime = 0;
  let auxRuntime = 0;
  let auxAbove35F = 0;

  data.forEach((row) => {
    const heat = parseFloat(row["Heat Stage 1 (sec)"] || 0);
    const aux = parseFloat(row[auxHeatCol] || 0);
    const outdoorTemp = parseFloat(row[outdoorTempCol] || 0);

    totalRuntime += heat;
    auxRuntime += aux;

    if (aux > 0 && outdoorTemp > 35) {
      auxAbove35F += aux;
    }
  });

  const auxPercentage =
    totalRuntime > 0 ? (auxRuntime / totalRuntime) * 100 : 0;
  const hasIssue = auxPercentage > 25 || auxAbove35F > 0;

  const severity =
    auxAbove35F > 0
      ? "high"
      : auxPercentage > 40
      ? "high"
      : auxPercentage > 25
      ? "medium"
      : "none";

  let description = "Auxiliary heat usage is normal";
  if (auxAbove35F > 0) {
    description =
      "Auxiliary heat running in mild weather (above 35°F) - possible balance point issue";
  } else if (auxPercentage > 40) {
    description = `Excessive auxiliary heat usage: ${auxPercentage.toFixed(
      1
    )}% of total runtime`;
  } else if (auxPercentage > 25) {
    description = `High auxiliary heat usage: ${auxPercentage.toFixed(
      1
    )}% of total runtime`;
  }

  return {
    hasIssue,
    severity,
    description,
    details: {
      auxPercentage: auxPercentage.toFixed(1),
      auxRuntimeSeconds: auxRuntime,
      auxAbove35F,
    },
  };
}

/**
 * Detect temperature instability
 * @param {Array} data - Parsed CSV rows
 * @returns {Object} Issue object
 */
export function detectTemperatureInstability(data) {
  if (!data || data.length < 6) {
    return {
      hasIssue: false,
      severity: "none",
      description: "Insufficient data for temperature stability analysis",
    };
  }

  const thermostatTempCol = "Thermostat Temperature (F)";

  // Calculate temperature swings in 1-hour windows (12 rows at 5-min intervals)
  let maxSwing = 0;
  let worstPeriod = null;

  for (let i = 0; i < data.length - 12; i += 12) {
    const window = data.slice(i, i + 12);
    const temps = window.map((row) => parseFloat(row[thermostatTempCol] || 0));
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    const swing = max - min;

    if (swing > maxSwing) {
      maxSwing = swing;
      worstPeriod = {
        startDate: data[i].Date,
        startTime: data[i].Time,
        swing: swing.toFixed(1),
      };
    }
  }

  const hasIssue = maxSwing > 3;
  const severity = maxSwing > 5 ? "high" : maxSwing > 3 ? "medium" : "none";

  return {
    hasIssue,
    severity,
    description: hasIssue
      ? `Temperature instability detected: ${maxSwing.toFixed(
          1
        )}°F swing in 1 hour`
      : "Temperature stability is normal",
    details: {
      maxSwing: maxSwing.toFixed(1),
      worstPeriod,
    },
  };
}

/**
 * Detect inefficient runtime patterns
 * @param {Array} data - Parsed CSV rows
 * @returns {Object} Issue object
 */
export function detectInefficientRuntime(data) {
  if (!data || data.length === 0) {
    return {
      hasIssue: false,
      severity: "none",
      description: "No data for runtime analysis",
    };
  }

  const heatStage1Col = "Heat Stage 1 (sec)";

  // Count very short runtime cycles (< 180 seconds = 3 minutes)
  let shortCycles = 0;
  let totalCycles = 0;

  let previousRunning = false;
  let currentCycleRuntime = 0;

  for (let i = 0; i < data.length; i++) {
    const runtime = parseFloat(data[i][heatStage1Col] || 0);
    const isRunning = runtime > 0;

    if (isRunning) {
      currentCycleRuntime += runtime;
    }

    if (!isRunning && previousRunning) {
      // Cycle just ended
      totalCycles++;
      if (currentCycleRuntime < 180) {
        shortCycles++;
      }
      currentCycleRuntime = 0;
    }

    previousRunning = isRunning;
  }

  const shortCyclePercentage =
    totalCycles > 0 ? (shortCycles / totalCycles) * 100 : 0;
  const hasIssue = shortCyclePercentage > 30;
  const severity =
    shortCyclePercentage > 50
      ? "high"
      : shortCyclePercentage > 30
      ? "medium"
      : "none";

  return {
    hasIssue,
    severity,
    description: hasIssue
      ? `Inefficient runtime: ${shortCyclePercentage.toFixed(
          0
        )}% of cycles are too short (< 3 minutes)`
      : "Runtime patterns are efficient",
    details: {
      shortCycles,
      totalCycles,
      shortCyclePercentage: shortCyclePercentage.toFixed(1),
    },
  };
}

/**
 * Comprehensive thermostat data analysis
 * @param {Array} data - Parsed CSV rows
 * @returns {Object} { issues: Array, summary: Object }
 */
export function analyzeThermostatIssues(data) {
  if (!data || data.length === 0) {
    return {
      issues: [],
      summary: {
        totalIssues: 0,
        critical: 0,
        high: 0,
        medium: 0,
        timestamp: new Date().toISOString(),
      },
    };
  }

  const issues = [];

  // Run all diagnostic checks
  const shortCycling = detectShortCycling(data);
  if (shortCycling.hasIssue) {
    issues.push({ type: "short_cycling", ...shortCycling });
  }

  const auxHeat = detectExcessiveAuxHeat(data);
  if (auxHeat.hasIssue) {
    issues.push({ type: "excessive_aux_heat", ...auxHeat });
  }

  const tempStability = detectTemperatureInstability(data);
  if (tempStability.hasIssue) {
    issues.push({ type: "temperature_instability", ...tempStability });
  }

  const runtime = detectInefficientRuntime(data);
  if (runtime.hasIssue) {
    issues.push({ type: "inefficient_runtime", ...runtime });
  }

  // Count severity levels
  const summary = {
    totalIssues: issues.length,
    critical: issues.filter((i) => i.severity === "critical").length,
    high: issues.filter((i) => i.severity === "high").length,
    medium: issues.filter((i) => i.severity === "medium").length,
    timestamp: new Date().toISOString(),
    dataRows: data.length,
  };

  return { issues, summary };
}
