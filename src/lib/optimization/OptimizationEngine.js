// src/lib/optimization/OptimizationEngine.js
// Central engine for all HVAC optimization recommendations, forecasting, and savings tracking

const STORAGE_KEY = "jouleOptimizationData";
const FORECAST_ACCURACY_KEY = "jouleForecastAccuracy";
const MAINTENANCE_KEY = "jouleMaintenanceData";

// ============================================================================
// STORAGE UTILITIES
// ============================================================================

function loadData(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore localStorage errors
  }
}

// ============================================================================
// SCHEDULE OPTIMIZATION
// ============================================================================

/**
 * Calculate optimal thermostat schedule based on user preferences, weather, and efficiency goals
 */
export function calculateOptimalSchedule(options = {}) {
  const {
    currentDayTemp = 70,
    currentNightTemp = 68,
    mode = "heating",
    weatherForecast = [],
    electricRate = 0.12,
    heatLossFactor = 200,
    hpCapacity = 24000, // BTU
    hspf2 = 9,
    auxLockout = 35,
    userComfortLevel = "balanced", // "comfort", "balanced", "savings"
  } = options;

  // ASHRAE 55 comfort bounds
  const comfortBounds = {
    heating: { min: 66, max: 74, ideal: 70 },
    cooling: { min: 72, max: 78, ideal: 75 },
  };

  const bounds = comfortBounds[mode];

  // Calculate optimal temperatures based on user preference
  const adjustments = {
    comfort: { dayOffset: 0, nightOffset: 0 },
    balanced: { dayOffset: -1, nightOffset: -2 },
    savings: { dayOffset: -2, nightOffset: -4 },
  };

  const adj = adjustments[userComfortLevel] || adjustments.balanced;

  // Optimal day/night temps
  const optimalDayTemp = Math.max(
    bounds.min,
    Math.min(bounds.max, bounds.ideal + adj.dayOffset)
  );
  const optimalNightTemp = Math.max(
    bounds.min,
    Math.min(bounds.max, bounds.ideal + adj.nightOffset)
  );

  // Validate current temperatures make sense for the mode
  // For heating: night should be <= day (or very close). For cooling: night should be >= day (or very close)
  const isHeating = mode === "heating";
  const tempRangeIssue = isHeating 
    ? currentNightTemp > currentDayTemp + 2  // Heating: night shouldn't be much higher than day
    : currentNightTemp < currentDayTemp - 2; // Cooling: night shouldn't be much lower than day
  
  // If temperatures are clearly wrong for the mode, always show optimization opportunity
  const hasInvalidSettings = tempRangeIssue || 
    (isHeating && (currentDayTemp < 60 || currentDayTemp > 80 || currentNightTemp < 60 || currentNightTemp > 80)) ||
    (!isHeating && (currentDayTemp < 65 || currentDayTemp > 85 || currentNightTemp < 65 || currentNightTemp > 85));

  // Calculate savings
  const currentAvgTemp = (currentDayTemp * 16 + currentNightTemp * 8) / 24;
  const optimalAvgTemp = (optimalDayTemp * 16 + optimalNightTemp * 8) / 24;
  const tempDiff = currentAvgTemp - optimalAvgTemp;

  // Determine if current settings are wasteful
  // For heating: wasteful if current > optimal (tempDiff > 0)
  // For cooling: wasteful if current < optimal (tempDiff < 0)
  const isWasteful = isHeating 
    ? tempDiff > 0  // Heating: too warm = wasteful
    : tempDiff < 0; // Cooling: too cold = wasteful
  
  // Rough savings estimate: each degree saves ~3% on heating/cooling
  // Use absolute value for savings calculation, but only if wasteful
  const absTempDiff = Math.abs(tempDiff);
  const savingsPercent = isWasteful ? absTempDiff * 0.03 : 0;
  
  // Calculate monthly cost at current schedule
  const avgDeltaT = mode === "heating" ? 30 : 15; // Rough delta T assumption
  const dailyBTU = heatLossFactor * avgDeltaT * 24;
  const dailykWh = dailyBTU / (hspf2 * 3412);
  const dailyCost = dailykWh * electricRate;
  const monthlyCost = dailyCost * 30;
  
  const monthlySavings = monthlyCost * savingsPercent;

  // Weather-aware adjustments
  let weatherAdjustment = null;
  if (weatherForecast.length >= 24) {
    const next24Temps = weatherForecast.slice(0, 24).map(h => h.temp || h.temperature || 50);
    const minTemp = Math.min(...next24Temps);
    const maxTemp = Math.max(...next24Temps);

    if (mode === "heating" && minTemp < auxLockout) {
      weatherAdjustment = {
        type: "cold_snap",
        message: `Cold snap coming (${Math.round(minTemp)}°F). Pre-heating to ${optimalDayTemp + 1}°F before ${getAuxHeatingHour(weatherForecast, auxLockout)} could prevent expensive aux heat.`,
        suggestedPreHeat: optimalDayTemp + 1,
        reason: "Avoid aux heat by building thermal mass",
      };
    } else if (mode === "cooling" && maxTemp > 95) {
      weatherAdjustment = {
        type: "heat_wave",
        message: `Heat wave expected (${Math.round(maxTemp)}°F). Pre-cool to ${optimalDayTemp - 2}°F before peak hours.`,
        suggestedPreCool: optimalDayTemp - 2,
        reason: "Pre-cool before peak electricity rates",
      };
    } else if (mode === "heating" && minTemp > 50) {
      weatherAdjustment = {
        type: "mild_weather",
        message: `Mild weather ahead (low of ${Math.round(minTemp)}°F). You can lower setpoint by 2°F and save ${(monthlySavings * 1.5).toFixed(0)}% more.`,
        suggestedTemp: optimalDayTemp - 2,
        reason: "Take advantage of mild conditions",
      };
    }
  }

  // Generate reasoning for the optimization
  const reasoning = {
    primary: absTempDiff > 2 && isWasteful
      ? "Your current schedule uses significantly more energy than necessary for comfort"
      : absTempDiff > 0.5 && isWasteful
      ? "Your current schedule can be optimized for better efficiency"
      : "Your schedule is already well-optimized",
    factors: [],
    comfortImpact: absTempDiff < 1 
      ? "Minimal - you'll barely notice the difference"
      : absTempDiff < 2
      ? "Slight - most people find this comfortable"
      : "Moderate - you may notice the change initially",
  };

  // Add specific factors
  if (isHeating) {
    // Heating mode: wasteful if too warm
    if (currentDayTemp > optimalDayTemp + 0.5) {
      reasoning.factors.push(`Daytime temperature (${currentDayTemp}°F) is above ASHRAE 55 recommended range`);
    }
    if (currentNightTemp > optimalNightTemp + 0.5) {
      reasoning.factors.push(`Nighttime temperature (${currentNightTemp}°F) can be lowered for better efficiency`);
    }
  } else {
    // Cooling mode: wasteful if too cold
    if (currentDayTemp < optimalDayTemp - 0.5) {
      reasoning.factors.push(`Daytime temperature (${currentDayTemp}°F) is below ASHRAE 55 recommended range`);
    }
    if (currentNightTemp < optimalNightTemp - 0.5) {
      reasoning.factors.push(`Nighttime temperature (${currentNightTemp}°F) can be raised for better efficiency`);
    }
  }
  if (weatherForecast.length >= 24) {
    const next24Temps = weatherForecast.slice(0, 24).map(h => h.temp || h.temperature || 50);
    const avgNext24 = next24Temps.reduce((a, b) => a + b, 0) / next24Temps.length;
    if (mode === "heating" && avgNext24 > 50) {
      reasoning.factors.push("Mild weather forecast allows for lower setpoints");
    }
  }
  if (heatLossFactor < 250) {
    reasoning.factors.push("Your home has good insulation, allowing for more efficient operation");
  }
  if (reasoning.factors.length === 0) {
    reasoning.factors.push("Based on ASHRAE 55 comfort standards and your home's characteristics");
  }

  return {
    currentSchedule: {
      dayTemp: currentDayTemp,
      nightTemp: currentNightTemp,
      avgTemp: currentAvgTemp,
    },
    optimalSchedule: {
      dayTemp: optimalDayTemp,
      nightTemp: optimalNightTemp,
      avgTemp: optimalAvgTemp,
      dayHours: "6am - 10pm",
      nightHours: "10pm - 6am",
    },
    savings: {
      tempDiff: absTempDiff.toFixed(1),
      percent: (savingsPercent * 100).toFixed(1),
      monthlyDollars: monthlySavings.toFixed(2),
      annualDollars: (monthlySavings * 12).toFixed(2),
    },
    weatherAdjustment,
    reasoning,
    // Has savings opportunity if:
    // 1. Settings are invalid
    // 2. Settings are wasteful (wrong direction) and significantly different (>0.5°F)
    // 3. Settings are significantly different from optimal in EITHER direction (>1.5°F) for comfort optimization
    //    - For heating: if too warm (wasteful) OR too cold (comfort issue)
    //    - For cooling: if too cold (wasteful) OR too warm (comfort issue, but uses less energy)
    // Note: For cooling, higher setpoints use less energy but sacrifice comfort, so we still optimize
    hasSavingsOpportunity: hasInvalidSettings || 
                          (isWasteful && absTempDiff > 0.5) || 
                          (absTempDiff > 1.5), // Show opportunity if significantly different from optimal (comfort or efficiency)
    canOptimize: hasInvalidSettings || Math.abs(currentDayTemp - optimalDayTemp) > 0.5 || 
                 Math.abs(currentNightTemp - optimalNightTemp) > 0.5,
  };
}

function getAuxHeatingHour(forecast, auxLockout) {
  for (let i = 0; i < Math.min(24, forecast.length); i++) {
    const temp = forecast[i].temp || forecast[i].temperature || 50;
    if (temp < auxLockout) {
      const hour = new Date().getHours() + i;
      const hourNormalized = hour % 24;
      return hourNormalized < 12 
        ? `${hourNormalized}am` 
        : `${hourNormalized === 12 ? 12 : hourNormalized - 12}pm`;
    }
  }
  return "tonight";
}

// ============================================================================
// WEATHER ALERTS & ANOMALY DETECTION
// ============================================================================

/**
 * Analyze weather forecast for cost-impacting anomalies
 */
export function analyzeWeatherAnomalies(forecast, options = {}) {
  const {
    mode = "heating",
    electricRate = 0.12,
    heatLossFactor = 200,
    normalSeasonalAvg = null,
  } = options;

  if (!forecast || forecast.length < 24) {
    return { hasAnomaly: false, anomalies: [], warnings: [], stats: null };
  }

  const anomalies = [];
  const alerts = [];

  // Calculate 7-day average
  const temps = forecast.slice(0, 168).map(h => h.temp || h.temperature || 50);
  const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);

  // Seasonal reference (rough estimates)
  const month = new Date().getMonth();
  const seasonalNorms = {
    0: 35, 1: 38, 2: 48, 3: 58, 4: 68, 5: 78,
    6: 82, 7: 80, 8: 72, 9: 60, 10: 48, 11: 38,
  };
  const expectedAvg = normalSeasonalAvg || seasonalNorms[month];
  const deviation = avgTemp - expectedAvg;

  // Cold snap detection (heating mode)
  if (mode === "heating" && minTemp < 15) {
    const severity = minTemp < 0 ? "extreme" : minTemp < 10 ? "high" : "medium";
    const extraCost = estimateExtraCost(minTemp, expectedAvg, heatLossFactor, electricRate);
    anomalies.push({
      type: "cold_snap",
      severity,
      title: `❄️ ${severity === "extreme" ? "Extreme" : "Significant"} Cold Incoming`,
      description: `Temperatures dropping to ${Math.round(minTemp)}°F.`,
      impact: `Could add $${extraCost.toFixed(2)} to your weekly bill.`,
      advice: "Pre-heat your home and check your aux heat lockout setting.",
      startDate: findStartDate(forecast, t => t < 20),
      duration: countDays(forecast, t => t < 25),
    });
  }

  // Heat wave detection (cooling mode)
  if (mode === "cooling" && maxTemp > 95) {
    const severity = maxTemp > 105 ? "extreme" : maxTemp > 100 ? "high" : "medium";
    const extraCost = estimateExtraCost(95 - maxTemp, expectedAvg, heatLossFactor * 0.7, electricRate);
    anomalies.push({
      type: "heat_wave",
      severity,
      title: `🔥 ${severity === "extreme" ? "Extreme" : "Significant"} Heat Wave`,
      description: `Temperatures reaching ${Math.round(maxTemp)}°F.`,
      impact: `Could add $${Math.abs(extraCost).toFixed(2)} to your weekly bill.`,
      advice: "Pre-cool your home before peak hours and check your AC efficiency.",
      startDate: findStartDate(forecast, t => t > 90),
      duration: countDays(forecast, t => t > 90),
    });
  }

  // Unusual weather pattern
  if (Math.abs(deviation) > 10) {
    const warmer = deviation > 0;
    alerts.push({
      type: "unusual_pattern",
      title: `📊 Weather ${warmer ? "Warmer" : "Colder"} Than Typical`,
      description: `This week is ${Math.abs(deviation).toFixed(0)}°F ${warmer ? "warmer" : "colder"} than average for this time of year.`,
      impact: warmer 
        ? `Your ${mode} costs may be ${(Math.abs(deviation) * 3).toFixed(0)}% lower than expected.`
        : `Your ${mode} costs may be ${(Math.abs(deviation) * 3).toFixed(0)}% higher than expected.`,
    });
  }

  // Temperature swing detection
  const dailyRange = maxTemp - minTemp;
  if (dailyRange > 40) {
    alerts.push({
      type: "temperature_swing",
      title: "🎢 Large Temperature Swings",
      description: `${Math.round(dailyRange)}°F range this week (${Math.round(minTemp)}°F to ${Math.round(maxTemp)}°F).`,
      impact: "Your system may cycle more frequently. Consider widening your differential setting.",
    });
  }

  return {
    hasAnomaly: anomalies.length > 0,
    anomalies,
    warnings: alerts,
    stats: {
      avgTemp: Math.round(avgTemp),
      minTemp: Math.round(minTemp),
      maxTemp: Math.round(maxTemp),
      expectedAvg: Math.round(expectedAvg),
      deviation: Math.round(deviation),
    },
  };
}

function estimateExtraCost(tempDelta, normalTemp, heatLossFactor, electricRate) {
  const extraBTU = Math.abs(tempDelta) * heatLossFactor * 24 * 7;
  const extraKWh = extraBTU / (9 * 3412); // Assume HSPF2 of 9
  return extraKWh * electricRate;
}

function findStartDate(forecast, condition) {
  for (let i = 0; i < forecast.length; i++) {
    const temp = forecast[i].temp || forecast[i].temperature || 50;
    if (condition(temp)) {
      const date = new Date();
      date.setHours(date.getHours() + i);
      return date.toISOString();
    }
  }
  return null;
}

function countDays(forecast, condition) {
  let count = 0;
  for (let i = 0; i < Math.min(168, forecast.length); i += 24) {
    const dayTemps = forecast.slice(i, i + 24).map(h => h.temp || h.temperature || 50);
    if (dayTemps.some(condition)) count++;
  }
  return `${count} day${count !== 1 ? "s" : ""}`;
}

// ============================================================================
// FORECAST ACCURACY TRACKING
// ============================================================================

/**
 * Record a prediction for later accuracy comparison
 */
export function recordPrediction(prediction) {
  const data = loadData(FORECAST_ACCURACY_KEY) || { predictions: [], accuracy: [] };
  
  data.predictions.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: new Date().toISOString().slice(0, 10),
    predictedCost: prediction.cost,
    predictedKWh: prediction.kWh,
    predictedTemp: prediction.avgTemp,
    period: prediction.period || "week",
    createdAt: new Date().toISOString(),
  });

  // Keep last 52 weeks of predictions
  data.predictions = data.predictions.slice(-52);
  saveData(FORECAST_ACCURACY_KEY, data);
  return data;
}

/**
 * Record actual costs and compare to prediction
 */
export function recordActual(actual) {
  const data = loadData(FORECAST_ACCURACY_KEY) || { predictions: [], accuracy: [] };
  
  // Find matching prediction
  const prediction = data.predictions.find(p => 
    p.date === actual.date || 
    (new Date(p.date).getTime() <= new Date(actual.date).getTime() &&
     new Date(p.date).getTime() + 7 * 24 * 60 * 60 * 1000 > new Date(actual.date).getTime())
  );

  if (prediction) {
    const accuracy = {
      date: actual.date,
      predictedCost: prediction.predictedCost,
      actualCost: actual.cost,
      error: Math.abs(prediction.predictedCost - actual.cost),
      errorPercent: Math.abs((prediction.predictedCost - actual.cost) / actual.cost * 100),
      direction: prediction.predictedCost > actual.cost ? "over" : "under",
    };
    data.accuracy.push(accuracy);
  }

  // Keep last 52 weeks of accuracy data
  data.accuracy = data.accuracy.slice(-52);
  saveData(FORECAST_ACCURACY_KEY, data);
  return data;
}

/**
 * Get forecast accuracy statistics
 */
export function getAccuracyStats() {
  const data = loadData(FORECAST_ACCURACY_KEY) || { predictions: [], accuracy: [] };
  
  if (data.accuracy.length === 0) {
    return {
      hasData: false,
      message: "Not enough data yet. Accuracy tracking starts after you enter actual costs.",
    };
  }

  const errors = data.accuracy.map(a => a.errorPercent);
  const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;
  const within5Pct = errors.filter(e => e <= 5).length / errors.length * 100;
  const within10Pct = errors.filter(e => e <= 10).length / errors.length * 100;

  return {
    hasData: true,
    totalPredictions: data.accuracy.length,
    avgErrorPercent: avgError.toFixed(1),
    within5Pct: within5Pct.toFixed(0),
    within10Pct: within10Pct.toFixed(0),
    recentAccuracy: data.accuracy.slice(-5),
    trend: calculateAccuracyTrend(data.accuracy),
  };
}

function calculateAccuracyTrend(accuracy) {
  if (accuracy.length < 4) return "insufficient_data";
  const recent = accuracy.slice(-4).map(a => a.errorPercent);
  const older = accuracy.slice(-8, -4).map(a => a.errorPercent);
  if (older.length === 0) return "insufficient_data";
  
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  
  if (recentAvg < olderAvg - 2) return "improving";
  if (recentAvg > olderAvg + 2) return "declining";
  return "stable";
}

// ============================================================================
// TIME-OF-USE RATE OPTIMIZATION
// ============================================================================

/**
 * Analyze schedule for TOU rate optimization
 */
export function analyzeTOUOptimization(options = {}) {
  const {
    touRates = null, // { peak: 0.25, offPeak: 0.08, peakHours: [14, 19] }
    currentSchedule = { dayTemp: 70, nightTemp: 68 },
    mode = "heating",
    heatLossFactor = 200,
    weatherForecast = [],
  } = options;

  if (!touRates) {
    return {
      hasTOU: false,
      message: "No time-of-use rates configured. Add TOU rates in settings to see optimization suggestions.",
    };
  }

  const { peak, offPeak, peakHours } = touRates;
  const peakStart = peakHours[0];
  const peakEnd = peakHours[1];
  const peakDuration = peakEnd - peakStart;
  const rateDiff = peak - offPeak;
  const ratioSavings = rateDiff / peak;

  // Strategy depends on mode
  const strategies = [];

  if (mode === "heating") {
    // Pre-heat before peak
    strategies.push({
      name: "Pre-Heat Strategy",
      description: `Raise thermostat to ${currentSchedule.dayTemp + 2}°F by ${peakStart - 1}:00, then let it coast through peak hours.`,
      timing: `${peakStart - 2}:00 - ${peakStart}:00`,
      savingsEstimate: `$${(heatLossFactor * rateDiff * peakDuration / 10000).toFixed(2)}/day`,
      difficulty: "Easy",
    });

    // Setback during peak
    strategies.push({
      name: "Peak Avoidance",
      description: `Lower thermostat to ${currentSchedule.dayTemp - 2}°F during peak hours (${peakStart}:00 - ${peakEnd}:00).`,
      timing: `${peakStart}:00 - ${peakEnd}:00`,
      savingsEstimate: `$${(heatLossFactor * rateDiff * peakDuration / 8000).toFixed(2)}/day`,
      difficulty: "Moderate",
      comfortImpact: "Slight temperature drop during late afternoon",
    });
  } else {
    // Pre-cool before peak
    strategies.push({
      name: "Pre-Cool Strategy",
      description: `Cool to ${currentSchedule.dayTemp - 3}°F before ${peakStart}:00, then let temperature rise through peak.`,
      timing: `${peakStart - 3}:00 - ${peakStart}:00`,
      savingsEstimate: `$${(heatLossFactor * 0.7 * rateDiff * peakDuration / 8000).toFixed(2)}/day`,
      difficulty: "Easy",
    });

    // Raise during peak
    strategies.push({
      name: "Peak Reduction",
      description: `Allow temperature to rise to ${currentSchedule.dayTemp + 3}°F during peak hours.`,
      timing: `${peakStart}:00 - ${peakEnd}:00`,
      savingsEstimate: `$${(heatLossFactor * 0.7 * rateDiff * peakDuration / 6000).toFixed(2)}/day`,
      difficulty: "Moderate",
      comfortImpact: "Warmer during late afternoon",
    });
  }

  const totalDailySavings = strategies.reduce((sum, s) => {
    const match = s.savingsEstimate.match(/\$([\d.]+)/);
    return sum + (match ? parseFloat(match[1]) : 0);
  }, 0) / 2; // Average of strategies, not sum

  return {
    hasTOU: true,
    rates: touRates,
    strategies,
    summary: {
      peakRate: `$${peak.toFixed(3)}/kWh`,
      offPeakRate: `$${offPeak.toFixed(3)}/kWh`,
      peakHours: `${peakStart}:00 - ${peakEnd}:00`,
      potentialDailySavings: `$${totalDailySavings.toFixed(2)}`,
      potentialMonthlySavings: `$${(totalDailySavings * 30).toFixed(2)}`,
    },
  };
}

// ============================================================================
// SYSTEM HEALTH & EFFICIENCY RECOMMENDATIONS
// ============================================================================

/**
 * Analyze system health and provide recommendations
 */
export function analyzeSystemHealth(options = {}) {
  const {
    heatLossFactor = 200,
    expectedHeatLoss = null, // Based on building characteristics
    squareFeet = 1000,
    auxHeatHours = 0,
    totalHeatHours = 100,
    cyclesPerHour = 3,
    lastMaintenanceDate = null,
    filterLastChanged = null,
    systemAge = 0,
    hspf2 = 9,
    seer2 = 16,
  } = options;

  const recommendations = [];
  const positives = [];
  const metrics = {};

  // Heat loss per sq ft analysis
  const heatLossPerSqFt = heatLossFactor / squareFeet;
  metrics.heatLossPerSqFt = heatLossPerSqFt.toFixed(2);

  if (heatLossPerSqFt > 0.3) {
    recommendations.push({
      category: "Insulation",
      priority: "high",
      title: "Higher Than Expected Heat Loss",
      current: `${heatLossPerSqFt.toFixed(2)} BTU/hr/°F per sq ft`,
      expected: "0.15-0.25 for well-insulated homes",
      action: "Consider an energy audit to identify insulation gaps or air leaks.",
      savings: `Fixing this could save 20-30% on heating costs.`,
    });
  } else if (heatLossPerSqFt < 0.2) {
    positives.push({
      category: "Insulation",
      title: "Well-Insulated Home",
      detail: `Your heat loss of ${heatLossPerSqFt.toFixed(2)} BTU/hr/°F/sqft is better than average.`,
    });
  }

  // Aux heat usage
  const auxHeatPercent = totalHeatHours > 0 ? (auxHeatHours / totalHeatHours) * 100 : 0;
  metrics.auxHeatPercent = auxHeatPercent.toFixed(1);

  if (auxHeatPercent > 15) {
    recommendations.push({
      category: "Aux Heat",
      priority: auxHeatPercent > 30 ? "high" : "medium",
      title: "High Auxiliary Heat Usage",
      current: `${auxHeatPercent.toFixed(0)}% of heating hours use aux heat`,
      expected: "Under 10% for most climates",
      action: "Lower your aux heat lockout temperature or adjust your setback schedule.",
      savings: `Each 5% reduction in aux heat could save $10-20/month.`,
    });
  } else if (auxHeatHours === 0 && totalHeatHours > 50) {
    positives.push({
      category: "Aux Heat",
      title: "Excellent Heat Pump Utilization",
      detail: "You're running entirely on your efficient heat pump!",
    });
  }

  // Cycling frequency
  metrics.cyclesPerHour = cyclesPerHour;
  if (cyclesPerHour > 4) {
    recommendations.push({
      category: "Cycling",
      priority: cyclesPerHour > 6 ? "high" : "medium",
      title: "System Cycling Too Frequently",
      current: `${cyclesPerHour.toFixed(1)} cycles per hour`,
      expected: "2-3 cycles per hour",
      action: "Increase your differential setting from 0.5°F to 1.0°F.",
      savings: "Reduces compressor wear and improves efficiency by 5-10%.",
    });
  }

  // Maintenance reminders
  const now = new Date();
  if (filterLastChanged) {
    const daysSinceFilter = Math.floor((now - new Date(filterLastChanged)) / (1000 * 60 * 60 * 24));
    metrics.daysSinceFilterChange = daysSinceFilter;
    
    if (daysSinceFilter > 90) {
      recommendations.push({
        category: "Maintenance",
        priority: daysSinceFilter > 180 ? "high" : "medium",
        title: "Filter Change Overdue",
        current: `${daysSinceFilter} days since last change`,
        expected: "Every 60-90 days",
        action: "Replace your HVAC filter for better airflow and efficiency.",
        savings: "A clean filter can improve efficiency by 5-15%.",
      });
    }
  }

  if (lastMaintenanceDate) {
    const daysSinceMaintenance = Math.floor((now - new Date(lastMaintenanceDate)) / (1000 * 60 * 60 * 24));
    metrics.daysSinceMaintenance = daysSinceMaintenance;
    
    if (daysSinceMaintenance > 365) {
      recommendations.push({
        category: "Maintenance",
        priority: "medium",
        title: "Annual Service Due",
        current: `${Math.floor(daysSinceMaintenance / 30)} months since last service`,
        expected: "Annual professional tune-up",
        action: "Schedule a professional HVAC tune-up.",
        savings: "Regular maintenance extends equipment life and maintains efficiency.",
      });
    }
  }

  // Efficiency rating check
  if (hspf2 < 8) {
    recommendations.push({
      category: "Equipment",
      priority: "low",
      title: "Below-Average Efficiency Rating",
      current: `HSPF2: ${hspf2}`,
      expected: "HSPF2 9+ for modern systems",
      action: "Consider upgrading to a more efficient heat pump when it's time to replace.",
      savings: "A higher efficiency system could save 20-30% on heating costs.",
    });
  } else if (hspf2 >= 10) {
    positives.push({
      category: "Equipment",
      title: "High-Efficiency System",
      detail: `Your HSPF2 of ${hspf2} is above average.`,
    });
  }

  // System age
  if (systemAge > 15) {
    recommendations.push({
      category: "Equipment",
      priority: systemAge > 20 ? "medium" : "low",
      title: "Aging Equipment",
      current: `${systemAge} years old`,
      expected: "Average lifespan: 15-20 years",
      action: "Start planning for replacement. Modern systems are 30-50% more efficient.",
      savings: "A new system could pay for itself in 5-8 years through energy savings.",
    });
  }

  return {
    recommendations: recommendations.sort((a, b) => {
      const priority = { high: 0, medium: 1, low: 2 };
      return priority[a.priority] - priority[b.priority];
    }),
    positives,
    metrics,
    overallHealth: recommendations.filter(r => r.priority === "high").length === 0 ? "good" : "needs_attention",
    score: calculateHealthScore(recommendations, positives),
  };
}

function calculateHealthScore(recommendations, positives) {
  let score = 100;
  for (const r of recommendations) {
    if (r.priority === "high") score -= 20;
    else if (r.priority === "medium") score -= 10;
    else score -= 5;
  }
  score += positives.length * 5;
  return Math.max(0, Math.min(100, score));
}

// ============================================================================
// PREDICTIVE MAINTENANCE
// ============================================================================

/**
 * Track maintenance events and predict future needs
 */
export function trackMaintenance(event) {
  const data = loadData(MAINTENANCE_KEY) || { events: [], reminders: [] };
  
  data.events.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: event.type, // "filter_change", "tune_up", "repair", "cleaning"
    date: event.date || new Date().toISOString(),
    cost: event.cost || 0,
    notes: event.notes || "",
    technician: event.technician || "",
  });

  // Keep last 5 years of events
  data.events = data.events.slice(-100);
  saveData(MAINTENANCE_KEY, data);
  
  return getMaintenanceStatus();
}

/**
 * Get current maintenance status and upcoming needs
 */
export function getMaintenanceStatus() {
  const data = loadData(MAINTENANCE_KEY) || { events: [], reminders: [] };
  const now = new Date();

  // Find last events of each type
  const lastFilter = data.events
    .filter(e => e.type === "filter_change")
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  
  const lastTuneUp = data.events
    .filter(e => e.type === "tune_up")
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  const upcoming = [];
  const overdue = [];

  // Filter check
  if (lastFilter) {
    const daysSince = Math.floor((now - new Date(lastFilter.date)) / (1000 * 60 * 60 * 24));
    const dueIn = 90 - daysSince;
    
    if (dueIn < 0) {
      overdue.push({
        type: "filter_change",
        title: "Filter Change Overdue",
        daysPast: Math.abs(dueIn),
        icon: "🔧",
      });
    } else if (dueIn < 14) {
      upcoming.push({
        type: "filter_change",
        title: "Filter Change Due Soon",
        daysUntil: dueIn,
        icon: "📋",
      });
    }
  } else {
    upcoming.push({
      type: "filter_change",
      title: "Set Up Filter Tracking",
      daysUntil: null,
      icon: "⚙️",
      action: "Log your last filter change to enable reminders",
    });
  }

  // Tune-up check
  if (lastTuneUp) {
    const daysSince = Math.floor((now - new Date(lastTuneUp.date)) / (1000 * 60 * 60 * 24));
    const dueIn = 365 - daysSince;
    
    if (dueIn < 0) {
      overdue.push({
        type: "tune_up",
        title: "Annual Tune-Up Overdue",
        daysPast: Math.abs(dueIn),
        icon: "⚠️",
      });
    } else if (dueIn < 30) {
      upcoming.push({
        type: "tune_up",
        title: "Annual Tune-Up Due Soon",
        daysUntil: dueIn,
        icon: "📅",
      });
    }
  }

  // Seasonal reminders
  const month = now.getMonth();
  if (month === 8 || month === 9) { // Sept-Oct
    upcoming.push({
      type: "seasonal",
      title: "Pre-Winter Checkup",
      description: "Good time for a heating system tune-up before cold weather.",
      icon: "❄️",
    });
  } else if (month === 3 || month === 4) { // Apr-May
    upcoming.push({
      type: "seasonal",
      title: "Pre-Summer Checkup",
      description: "Good time for an AC tune-up before hot weather.",
      icon: "☀️",
    });
  }

  return {
    lastFilter: lastFilter?.date || null,
    lastTuneUp: lastTuneUp?.date || null,
    upcoming,
    overdue,
    recentEvents: data.events.slice(-5).reverse(),
    needsAttention: overdue.length > 0,
  };
}

// ============================================================================
// BENCHMARKING
// ============================================================================

/**
 * Compare user's efficiency to benchmarks
 */
export function getBenchmarks(options = {}) {
  const {
    monthlyCost = 100,
    monthlyKWh = 500,
    squareFeet = 1000,
    climateZone = "mixed", // "hot", "mixed", "cold"
    heatPumpType = "standard", // "standard", "mini_split", "geothermal"
  } = options;

  // Benchmark data (simplified averages)
  const benchmarks = {
    hot: { costPerSqFt: 0.12, kWhPerSqFt: 0.8 },
    mixed: { costPerSqFt: 0.10, kWhPerSqFt: 0.7 },
    cold: { costPerSqFt: 0.15, kWhPerSqFt: 1.0 },
  };

  const benchmark = benchmarks[climateZone] || benchmarks.mixed;
  const userCostPerSqFt = monthlyCost / squareFeet;
  const userKWhPerSqFt = monthlyKWh / squareFeet;

  const costComparison = ((benchmark.costPerSqFt - userCostPerSqFt) / benchmark.costPerSqFt) * 100;
  const kWhComparison = ((benchmark.kWhPerSqFt - userKWhPerSqFt) / benchmark.kWhPerSqFt) * 100;

  let percentile;
  if (costComparison > 30) percentile = "Top 10%";
  else if (costComparison > 15) percentile = "Top 25%";
  else if (costComparison > 0) percentile = "Better than average";
  else if (costComparison > -15) percentile = "Average";
  else if (costComparison > -30) percentile = "Below average";
  else percentile = "Needs improvement";

  return {
    userMetrics: {
      costPerSqFt: userCostPerSqFt.toFixed(3),
      kWhPerSqFt: userKWhPerSqFt.toFixed(2),
    },
    benchmarkMetrics: {
      costPerSqFt: benchmark.costPerSqFt.toFixed(3),
      kWhPerSqFt: benchmark.kWhPerSqFt.toFixed(2),
    },
    comparison: {
      costDiff: costComparison.toFixed(1),
      kWhDiff: kWhComparison.toFixed(1),
      percentile,
      isAboveAverage: costComparison > 0,
    },
    insights: generateBenchmarkInsights(costComparison, kWhComparison, climateZone),
  };
}

function generateBenchmarkInsights(costDiff, kWhDiff, climate) {
  const insights = [];

  if (costDiff > 20 && kWhDiff > 20) {
    insights.push({
      type: "positive",
      text: "Excellent! You're using less energy AND paying less than similar homes.",
    });
  } else if (costDiff > 20 && kWhDiff < 0) {
    insights.push({
      type: "info",
      text: "Your rates are low, but your energy use is higher than average. Focus on efficiency improvements.",
    });
  } else if (costDiff < -20) {
    insights.push({
      type: "attention",
      text: "Your costs are higher than typical. Consider an energy audit or efficiency upgrades.",
    });
  }

  return insights;
}

// ============================================================================
// SAVINGS GAMIFICATION
// ============================================================================

/**
 * Get savings progress and achievements
 */
export function getSavingsProgress() {
  const data = loadData(STORAGE_KEY) || { 
    totalSavings: 0, 
    events: [], 
    achievements: [],
    streak: 0,
    lastOptimization: null,
  };

  // Calculate streak
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const hasToday = data.events.some(e => e.date?.startsWith(today));
  const hasYesterday = data.events.some(e => e.date?.startsWith(yesterday));

  if (hasToday) {
    data.streak = hasYesterday ? data.streak : 1;
  } else if (!hasYesterday) {
    data.streak = 0;
  }

  // Achievement badges
  const badges = [
    { id: "first_save", name: "First Steps", icon: "🌱", requirement: 1, description: "Record your first savings" },
    { id: "save_10", name: "Getting Started", icon: "💵", requirement: 10, description: "Save $10" },
    { id: "save_50", name: "Frugal Finder", icon: "💰", requirement: 50, description: "Save $50" },
    { id: "save_100", name: "Century Saver", icon: "💎", requirement: 100, description: "Save $100" },
    { id: "save_250", name: "Energy Expert", icon: "🏆", requirement: 250, description: "Save $250" },
    { id: "save_500", name: "Efficiency Champion", icon: "👑", requirement: 500, description: "Save $500" },
    { id: "streak_7", name: "Week Warrior", icon: "🔥", requirement: 7, description: "7-day optimization streak", type: "streak" },
    { id: "streak_30", name: "Month Master", icon: "⭐", requirement: 30, description: "30-day optimization streak", type: "streak" },
  ];

  const earnedBadges = badges.filter(b => {
    if (b.type === "streak") return data.streak >= b.requirement;
    return data.totalSavings >= b.requirement;
  });

  const nextBadge = badges.find(b => {
    if (b.type === "streak") return data.streak < b.requirement;
    return data.totalSavings < b.requirement;
  });

  const progress = nextBadge 
    ? (nextBadge.type === "streak" 
        ? (data.streak / nextBadge.requirement) * 100 
        : (data.totalSavings / nextBadge.requirement) * 100)
    : 100;

  return {
    totalSavings: data.totalSavings.toFixed(2),
    thisMonth: calculateThisMonthSavings(data.events).toFixed(2),
    streak: data.streak,
    earnedBadges,
    nextBadge,
    progressToNext: Math.min(100, progress).toFixed(0),
    recentEvents: data.events.slice(-10).reverse(),
    level: Math.floor(data.totalSavings / 100) + 1,
  };
}

function calculateThisMonthSavings(events) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return events
    .filter(e => e.date >= monthStart)
    .reduce((sum, e) => sum + (e.amount || 0), 0);
}

/**
 * Record a savings event
 */
export function recordSavingsEvent(amount, source = "optimization") {
  const data = loadData(STORAGE_KEY) || { 
    totalSavings: 0, 
    events: [], 
    achievements: [],
    streak: 0,
  };

  const event = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    amount: Number(amount),
    source,
    date: new Date().toISOString(),
  };

  data.events.push(event);
  data.totalSavings = Math.round((data.totalSavings + event.amount) * 100) / 100;
  data.streak += 1;
  data.lastOptimization = event.date;

  // Keep last 365 days of events
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  data.events = data.events.filter(e => e.date >= oneYearAgo);

  saveData(STORAGE_KEY, data);
  return getSavingsProgress();
}

// ============================================================================
// QUICK ACTIONS
// ============================================================================

/**
 * Get prioritized quick actions based on current state
 */
export function getQuickActions(options = {}) {
  const {
    hasWeatherAlert = false,
    weatherAlertType = null,
    currentTemp = 70,
    optimalTemp = 69,
    auxHeatRunning = false,
    lastOptimized = null,
    costSoFar = 0,
    budgetLimit = null,
  } = options;

  const actions = [];

  // Weather-based actions
  if (hasWeatherAlert && weatherAlertType === "cold_snap") {
    actions.push({
      id: "pre_heat",
      priority: 1,
      icon: "❄️",
      label: "Prepare for Cold",
      description: "Pre-heat your home before temperatures drop",
      action: "navigate",
      target: "/analysis/weekly",
    });
  }

  if (hasWeatherAlert && weatherAlertType === "heat_wave") {
    actions.push({
      id: "pre_cool",
      priority: 1,
      icon: "🔥",
      label: "Prepare for Heat",
      description: "Pre-cool your home before temperatures spike",
      action: "navigate",
      target: "/analysis/weekly",
    });
  }

  // Optimization action
  if (currentTemp > optimalTemp + 1) {
    actions.push({
      id: "optimize_now",
      priority: 2,
      icon: "💡",
      label: "Lower Thermostat",
      description: `Lowering to ${optimalTemp}°F could save money`,
      action: "optimize",
      suggestedTemp: optimalTemp,
    });
  }

  // Aux heat warning
  if (auxHeatRunning) {
    actions.push({
      id: "aux_heat_alert",
      priority: 1,
      icon: "⚠️",
      label: "Aux Heat Running",
      description: "Consider adjusting schedule to reduce aux heat usage",
      action: "navigate",
      target: "/settings",
    });
  }

  // Budget warning
  if (budgetLimit && costSoFar > budgetLimit * 0.8) {
    actions.push({
      id: "budget_warning",
      priority: 2,
      icon: "💰",
      label: "Approaching Budget",
      description: `You've used ${((costSoFar / budgetLimit) * 100).toFixed(0)}% of your monthly budget`,
      action: "navigate",
      target: "/analysis/monthly",
    });
  }

  // Regular actions
  actions.push({
    id: "view_forecast",
    priority: 3,
    icon: "📊",
    label: "This Week's Forecast",
    description: "See your predicted costs for the next 7 days",
    action: "navigate",
    target: "/analysis/weekly",
  });

  actions.push({
    id: "compare_cities",
    priority: 4,
    icon: "🏙️",
    label: "City Comparison",
    description: "Compare costs across different locations",
    action: "navigate",
    target: "/analysis/monthly",
  });

  return actions.sort((a, b) => a.priority - b.priority);
}

// ============================================================================
// OPTIMIZATION HISTORY TRACKING
// ============================================================================

const OPTIMIZATION_HISTORY_KEY = "jouleOptimizationHistory";

/**
 * Track an optimization attempt
 */
export function trackOptimizationAttempt(optimization) {
  const history = loadData(OPTIMIZATION_HISTORY_KEY) || [];
  const attempt = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: new Date().toISOString(),
    before: {
      dayTemp: optimization.currentSchedule.dayTemp,
      nightTemp: optimization.currentSchedule.nightTemp,
    },
    after: {
      dayTemp: optimization.optimalSchedule.dayTemp,
      nightTemp: optimization.optimalSchedule.nightTemp,
    },
    projectedSavings: parseFloat(optimization.savings.monthlyDollars),
    reasoning: optimization.reasoning,
    applied: false, // Will be updated when user confirms
  };
  
  history.push(attempt);
  // Keep last 50 optimizations
  const trimmed = history.slice(-50);
  saveData(OPTIMIZATION_HISTORY_KEY, trimmed);
  return attempt;
}

/**
 * Mark an optimization as applied
 */
export function markOptimizationApplied(optimizationId) {
  const history = loadData(OPTIMIZATION_HISTORY_KEY) || [];
  const updated = history.map(opt => 
    opt.id === optimizationId 
      ? { ...opt, applied: true, appliedAt: new Date().toISOString() }
      : opt
  );
  saveData(OPTIMIZATION_HISTORY_KEY, updated);
  return updated.find(opt => opt.id === optimizationId);
}

/**
 * Get optimization history
 */
export function getOptimizationHistory(limit = 10) {
  const history = loadData(OPTIMIZATION_HISTORY_KEY) || [];
  return history.slice(-limit).reverse();
}

/**
 * Get optimization statistics
 */
export function getOptimizationStats() {
  const history = loadData(OPTIMIZATION_HISTORY_KEY) || [];
  const applied = history.filter(opt => opt.applied);
  const totalProjectedSavings = applied.reduce((sum, opt) => sum + (opt.projectedSavings || 0), 0);
  
  return {
    totalAttempts: history.length,
    appliedCount: applied.length,
    acceptanceRate: history.length > 0 ? (applied.length / history.length * 100).toFixed(1) : 0,
    totalProjectedSavings: totalProjectedSavings.toFixed(2),
    averageSavings: applied.length > 0 ? (totalProjectedSavings / applied.length).toFixed(2) : 0,
  };
}

// ============================================================================
// EXPORT ALL
// ============================================================================

export default {
  calculateOptimalSchedule,
  analyzeWeatherAnomalies,
  recordPrediction,
  recordActual,
  getAccuracyStats,
  analyzeTOUOptimization,
  analyzeSystemHealth,
  trackMaintenance,
  getMaintenanceStatus,
  getBenchmarks,
  getSavingsProgress,
  recordSavingsEvent,
  getQuickActions,
  trackOptimizationAttempt,
  markOptimizationApplied,
  getOptimizationHistory,
  getOptimizationStats,
};

