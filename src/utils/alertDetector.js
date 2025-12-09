/**
 * Alert Detection System for Ask Joule
 *
 * Detects potential issues with heat pump systems based on metrics.
 * Uses humble, data-driven language that doesn't conflict with tech advice.
 */

import { calculateBalancePoint } from "../utils/balancePointCalculator";

/**
 * @typedef {Object} Alert
 * @property {string} id - Unique identifier (e.g. "aux-usage-high")
 * @property {"info" | "warn" | "critical"} severity - Alert severity level
 * @property {string} message - Short alert message
 * @property {string} detail - Detailed explanation
 * @property {string} [metricSummary] - Summary of the metric (e.g. "38% of heating hours")
 * @property {string} [suggestedQuestion] - Pre-filled question for Ask Joule
 * @property {string} createdAt - ISO timestamp when alert was created
 * @property {string} [muteKey] - Key for muting similar alerts (e.g. "aux-usage")
 */

/**
 * Mock metrics structure - in production, this would come from real data
 * For now, we'll use calculated values from settings and current state
 *
 * WARNING: These are placeholder estimates for testing UI.
 * In production, replace with 7–30 day historical metrics before enabling alerts.
 */
function getMetricsFromSettings(
  settings,
  latestAnalysis,
  systemStatus,
  outdoorTemp
) {
  // Compute effective heat loss factor (used for balance point calculation)
  const useManualHeatLoss = Boolean(settings?.useManualHeatLoss);
  const useCalculatedHeatLoss = settings?.useCalculatedHeatLoss !== false;
  const useAnalyzerHeatLoss = Boolean(settings?.useAnalyzerHeatLoss);
  let effectiveHeatLossFactor;

  if (useManualHeatLoss) {
    const manualHeatLossFactor = Number(settings?.manualHeatLoss);
    if (Number.isFinite(manualHeatLossFactor) && manualHeatLossFactor > 0) {
      effectiveHeatLossFactor = manualHeatLossFactor;
    }
  }

  if (
    !effectiveHeatLossFactor &&
    useAnalyzerHeatLoss &&
    latestAnalysis?.heatLossFactor
  ) {
    effectiveHeatLossFactor = latestAnalysis.heatLossFactor;
  }

  if (!effectiveHeatLossFactor && useCalculatedHeatLoss) {
    const BASE_BTU_PER_SQFT_HEATING = 22.67;
    const ceilingMultiplier = 1 + ((settings.ceilingHeight || 8) - 8) * 0.1;
    const designHeatLoss =
      (settings.squareFeet || 1500) *
      BASE_BTU_PER_SQFT_HEATING *
      (settings.insulationLevel || 1.0) *
      (settings.homeShape || 1.0) *
      ceilingMultiplier;
    effectiveHeatLossFactor = designHeatLoss / 70;
  }

  if (!effectiveHeatLossFactor && latestAnalysis?.heatLossFactor) {
    effectiveHeatLossFactor = latestAnalysis.heatLossFactor;
  }

  // Build balance point settings (hoisted so it can be reused)
  const balancePointSettings = {
    ...settings,
    ...(effectiveHeatLossFactor
      ? { heatLossFactor: effectiveHeatLossFactor }
      : {}),
    ...(latestAnalysis?.balancePoint != null &&
    Number.isFinite(latestAnalysis.balancePoint)
      ? { analyzerBalancePoint: latestAnalysis.balancePoint }
      : {}),
  };

  // Calculate if aux is being used
  const usingAux = (() => {
    try {
      const bp = calculateBalancePoint(balancePointSettings);
      return systemStatus === "HEAT ON" && bp && outdoorTemp < bp.balancePoint;
    } catch {
      return false;
    }
  })();

  // Calculate metrics based on current state and settings
  // Note: In production, these would come from historical thermostat data
  // For now, we estimate based on current conditions and settings

  // Estimate aux fraction: if currently using aux and it's cold, likely high usage
  // This is a simplified model - real implementation would use 7-day historical data
  let auxFractionLast7Days = 0.08; // Default low usage
  if (usingAux) {
    // If aux is needed now, estimate higher usage over last 7 days
    // Scale based on how far below balance point we are
    const balancePoint = (() => {
      try {
        const bp = calculateBalancePoint(balancePointSettings);
        return bp?.balancePoint || 35;
      } catch {
        return 35;
      }
    })();
    const tempBelowBP = Math.max(0, balancePoint - outdoorTemp);
    // More aux usage if it's been consistently cold
    auxFractionLast7Days = Math.min(0.5, 0.15 + (tempBelowBP / 20) * 0.25);
  }

  // Estimate heating hours (simplified - would use actual runtime data)
  const heatingHoursLast7Days = systemStatus === "HEAT ON" ? 120 : 0;

  // Calculate night setback from settings
  const winterThermostat = settings.winterThermostat || 70;
  const winterThermostatNight =
    settings.winterThermostatNight || winterThermostat - 4;
  const avgNightSetback = Math.abs(winterThermostat - winterThermostatNight);
  const morningAuxSpikes = usingAux && avgNightSetback >= 4; // If using aux and big setback

  // Efficiency metrics (simplified - would compare to historical baseline)
  // WARNING: These are placeholder estimates for testing UI.
  // In production, replace with real 7–30 day historical metrics before enabling alerts.
  //
  // In production, this would come from:
  // - kwhPerHDDNow: Current 7-day average kWh per heating degree-day
  // - kwhPerHDDBase: Baseline from earlier in the season (e.g., October average)
  const kwhPerHDDNow = 0.15; // Placeholder: Current efficiency estimate
  const kwhPerHDDBase = 0.12; // Placeholder: Baseline from earlier season

  // Guard against zero/NaN baseline - if no good data, don't trigger efficiency alerts
  let efficiencyDrop = 1; // Neutral - no alert
  if (
    Number.isFinite(kwhPerHDDBase) &&
    kwhPerHDDBase > 0 &&
    Number.isFinite(kwhPerHDDNow)
  ) {
    efficiencyDrop = kwhPerHDDNow / kwhPerHDDBase;
  }

  return {
    auxFractionLast7Days,
    heatingHoursLast7Days,
    avgNightSetback,
    morningAuxSpikes,
    kwhPerHDDNow,
    kwhPerHDDBase,
    efficiencyDrop,
    usingAux,
  };
}

/**
 * Detects alerts based on system metrics
 * @param {Object} metrics - System metrics object
 * @returns {Alert[]} Array of detected alerts
 */
export function detectAlerts(metrics) {
  const alerts = [];

  // 1) Aux usage is high
  if (metrics.auxFractionLast7Days > 0.3 && metrics.heatingHoursLast7Days > 5) {
    alerts.push({
      id: "aux-usage-high",
      severity: "warn",
      message: "Aux heat is doing a lot of work",
      detail:
        `In the last 7 days, auxiliary/strip heat ran about ` +
        `${Math.round(
          metrics.auxFractionLast7Days * 100
        )}% of heating hours. ` +
        `In similar climates, tuned systems often use much less.`,
      metricSummary: `${Math.round(
        metrics.auxFractionLast7Days * 100
      )}% of heating hours`,
      suggestedQuestion:
        "Why is my auxiliary heat running so much, and what can I change?",
      createdAt: new Date().toISOString(),
      muteKey: "aux-usage",
    });
  }

  // 2) Night setback causing aux
  if (metrics.avgNightSetback >= 5 && metrics.morningAuxSpikes) {
    alerts.push({
      id: "night-setback-aux",
      severity: "info",
      message: "Big night setback is triggering strip heat",
      detail:
        `Your thermostat drops about ${metrics.avgNightSetback.toFixed(
          1
        )}°F at night and then recovers quickly in the morning. ` +
        `That pattern can make the electric strips more likely to kick in.`,
      metricSummary: `${metrics.avgNightSetback.toFixed(1)}°F setback`,
      suggestedQuestion:
        "What thermostat schedule should I use to avoid strip heat in the morning?",
      createdAt: new Date().toISOString(),
      muteKey: "night-setback",
    });
  }

  // 3) Likely dirty filter/coil (efficiency drop)
  if (metrics.efficiencyDrop > 1.2) {
    alerts.push({
      id: "efficiency-drop",
      severity: "info",
      message: "Your heat pump is working harder than before",
      detail:
        `Compared to earlier this season, your system is using about ` +
        `${Math.round((metrics.efficiencyDrop - 1) * 100)}% ` +
        `more energy per heating degree-day. Often this is a filter or coil issue.`,
      metricSummary: `~${Math.round(
        (metrics.efficiencyDrop - 1) * 100
      )}% more kWh/HDD`,
      suggestedQuestion:
        "Could a dirty filter or coil explain why my system is using more energy now?",
      createdAt: new Date().toISOString(),
      muteKey: "efficiency-drop",
    });
  }

  return alerts;
}

/**
 * Main function to get alerts for the home page
 * @param {Object} settings - User settings
 * @param {Object} latestAnalysis - Latest analysis data
 * @param {string} systemStatus - Current system status
 * @param {number} outdoorTemp - Current outdoor temperature
 * @returns {Alert[]} Array of active alerts
 */
export function getSystemHealthAlerts(
  settings,
  latestAnalysis,
  systemStatus,
  outdoorTemp
) {
  const metrics = getMetricsFromSettings(
    settings,
    latestAnalysis,
    systemStatus,
    outdoorTemp
  );
  return detectAlerts(metrics);
}

/**
 * Filter and sort alerts based on snooze state
 * @param {Alert[]} alerts - All detected alerts
 * @param {Object} snoozedAlerts - Map of snoozed alerts { muteKey: snoozedUntil }
 * @param {number} maxAlerts - Maximum number of alerts to show (default: 2)
 * @returns {Alert[]} Filtered and sorted alerts
 */
export function filterActiveAlerts(alerts, snoozedAlerts = {}, maxAlerts = 2) {
  const now = new Date();

  return alerts
    .filter((alert) => {
      // Check if alert is snoozed
      if (alert.muteKey && snoozedAlerts[alert.muteKey]) {
        const snoozedUntil = new Date(snoozedAlerts[alert.muteKey]);
        if (snoozedUntil > now) {
          return false; // Still snoozed
        }
      }
      return true;
    })
    .sort((a, b) => {
      // Sort by severity: critical > warn > info
      const severityOrder = { critical: 0, warn: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    })
    .slice(0, maxAlerts);
}
