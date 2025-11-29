// src/utils/weatherAnomalyDetector.js
// Detects weather anomalies (polar vortex, cold snaps, heat waves) using NWS data

/**
 * Detects weather anomalies in a forecast
 * @param {Array} forecast - Array of {time: Date, temp: number, humidity?: number}
 * @param {Object} location - {latitude, longitude, city?, state?}
 * @returns {Object} - {hasAnomaly: boolean, anomalies: Array, warnings: Array}
 */
export async function detectWeatherAnomalies(forecast, location) {
  if (!forecast || !Array.isArray(forecast) || forecast.length === 0) {
    return { hasAnomaly: false, anomalies: [], warnings: [] };
  }

  const anomalies = [];
  const warnings = [];

  // Extract temperatures from forecast
  const temps = forecast.map(h => h.temp).filter(t => typeof t === 'number');
  if (temps.length === 0) return { hasAnomaly: false, anomalies: [], warnings: [] };

  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;

  // 1. Polar Vortex Detection: Sustained extreme cold (multiple days below freezing)
  const freezingHours = forecast.filter(h => h.temp <= 32).length;
  const extremeColdHours = forecast.filter(h => h.temp <= 0).length;
  const veryColdHours = forecast.filter(h => h.temp <= 15).length;

  if (extremeColdHours >= 12) {
    anomalies.push({
      type: 'polarVortex',
      severity: 'extreme',
      title: '❄️ Polar Vortex Event Detected',
      description: `Sub-zero temperatures expected for ${Math.round(extremeColdHours / 24)}+ days. This will significantly increase heating costs.`,
      impact: 'High - Expect 30-50% increase in heating costs during this period.',
      startDate: forecast.find(h => h.temp <= 0)?.time,
      duration: `${Math.round(extremeColdHours / 24)} days`,
    });
  } else if (veryColdHours >= 24) {
    anomalies.push({
      type: 'coldSnap',
      severity: 'high',
      title: '⚠️ Extreme Cold Snap',
      description: `Temperatures below 15°F expected for ${Math.round(veryColdHours / 24)}+ days.`,
      impact: 'Moderate-High - Heat pump efficiency drops significantly below 15°F.',
      startDate: forecast.find(h => h.temp <= 15)?.time,
      duration: `${Math.round(veryColdHours / 24)} days`,
    });
  } else if (freezingHours >= 48) {
    warnings.push({
      type: 'extendedFreeze',
      severity: 'moderate',
      title: '🌡️ Extended Freezing Period',
      description: `Temperatures at or below freezing for ${Math.round(freezingHours / 24)}+ days.`,
      impact: 'Moderate - Increased heating demand expected.',
    });
  }

  // 2. Sudden Temperature Drop Detection
  // Check for drops of 20°F+ within 24 hours
  for (let i = 0; i < forecast.length - 24; i++) {
    const currentTemp = forecast[i].temp;
    const futureTemp = forecast[i + 24].temp;
    const drop = currentTemp - futureTemp;

    if (drop >= 20) {
      anomalies.push({
        type: 'suddenDrop',
        severity: 'moderate',
        title: '📉 Sudden Temperature Drop',
        description: `Temperature expected to drop ${drop.toFixed(0)}°F within 24 hours (from ${currentTemp.toFixed(0)}°F to ${futureTemp.toFixed(0)}°F).`,
        impact: 'Moderate - Sudden increase in heating demand.',
        startDate: forecast[i].time,
        dropAmount: drop,
      });
      break; // Only flag the first significant drop
    }
  }

  // 3. Heat Wave Detection (for cooling season)
  const veryHotHours = forecast.filter(h => h.temp >= 90).length;
  const extremeHotHours = forecast.filter(h => h.temp >= 100).length;

  if (extremeHotHours >= 12) {
    anomalies.push({
      type: 'heatWave',
      severity: 'extreme',
      title: '🔥 Extreme Heat Wave',
      description: `Temperatures above 100°F expected for ${Math.round(extremeHotHours / 24)}+ days.`,
      impact: 'High - Expect 40-60% increase in cooling costs during this period.',
      startDate: forecast.find(h => h.temp >= 100)?.time,
      duration: `${Math.round(extremeHotHours / 24)} days`,
    });
  } else if (veryHotHours >= 48) {
    warnings.push({
      type: 'extendedHeat',
      severity: 'moderate',
      title: '☀️ Extended Heat Period',
      description: `Temperatures above 90°F expected for ${Math.round(veryHotHours / 24)}+ days.`,
      impact: 'Moderate - Increased cooling demand expected.',
    });
  }

  // 4. Compare against historical averages (if location provided)
  // This would require fetching historical data, but we can use simple heuristics
  // For now, flag if forecast is significantly outside normal ranges
  const isWinter = new Date().getMonth() >= 10 || new Date().getMonth() <= 2; // Nov-Feb
  if (isWinter && minTemp < -10) {
    warnings.push({
      type: 'unusualCold',
      severity: 'moderate',
      title: '🌨️ Unusually Cold Weather',
      description: `Temperatures below -10°F are unusual for this time of year.`,
      impact: 'Moderate - Higher than normal heating costs expected.',
    });
  }

  const hasAnomaly = anomalies.length > 0 || warnings.length > 0;

  return {
    hasAnomaly,
    anomalies,
    warnings,
    summary: hasAnomaly
      ? `${anomalies.length} anomaly${anomalies.length !== 1 ? 'ies' : ''} detected, ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`
      : 'No weather anomalies detected',
  };
}

/**
 * Formats anomaly data for display
 */
export function formatAnomalyAlert(anomaly) {
  return {
    title: anomaly.title,
    message: `${anomaly.description} ${anomaly.impact}`,
    severity: anomaly.severity,
    type: anomaly.type,
  };
}

