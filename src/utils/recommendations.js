// src/utils/recommendations.js
// Smart recommendations engine for personalized upgrade insights

import { getAnnualHDD, getAnnualCDD } from "../lib/hddData";

// Modern efficiency standards (2025)
const MODERN_STANDARDS = {
  HSPF2_EXCELLENT: 10.0,
  HSPF2_GOOD: 9.0,
  HSPF2_MINIMUM: 7.5,
  SEER2_EXCELLENT: 18.0,
  SEER2_GOOD: 16.0,
  SEER2_MINIMUM: 14.5,
  INSULATION_GOOD: 0.85,
  INSULATION_EXCELLENT: 0.7,
};

// Climate zone classification based on HDD/CDD
const classifyClimateZone = (hdd, cdd) => {
  if (hdd > 7000) return "very_cold";
  if (hdd > 5000) return "cold";
  if (hdd > 3000 && cdd < 2000) return "mixed_heating";
  if (cdd > 2500 && hdd < 2000) return "hot_humid";
  if (cdd > 3000) return "very_hot";
  return "mixed";
};

// Priority levels for recommendations
const PRIORITY = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

// Impact levels for recommendations
const IMPACT = {
  MAJOR: "major", // >$500/year savings potential
  MODERATE: "moderate", // $200-$500/year
  MINOR: "minor", // <$200/year
};

/**
 * Generate personalized recommendations based on user settings and climate
 * @param {Object} settings - User settings object
 * @param {Object} userLocation - Location data with city, state, elevation
 * @param {Object} annualEstimate - Current annual cost estimate
 * @returns {Array} Array of recommendation objects
 */
export function generateRecommendations(
  settings,
  userLocation,
  annualEstimate
) {
  if (!settings || !userLocation) return [];

  const recommendations = [];

  // Get climate data
  const hdd = getAnnualHDD(
    `${userLocation.city}, ${userLocation.state}`,
    userLocation.state
  );
  const cdd = getAnnualCDD(
    `${userLocation.city}, ${userLocation.state}`,
    userLocation.state
  );
  const climateZone = classifyClimateZone(hdd, cdd);

  // Extract settings
  const hspf2 = Number(settings.hspf2) || 9.0;
  const seer2 = Number(settings.efficiency) || 15.0;
  const insulationLevel = Number(settings.insulationLevel) || 1.0;
  const winterThermostat = Number(settings.winterThermostat) || 70;
  const summerThermostat = Number(settings.summerThermostat) || 74;
  const squareFeet = Number(settings.squareFeet) || 1500;
  const utilityCost = Number(settings.utilityCost) || 0.15;

  // 1. HSPF2 upgrade recommendation (heating efficiency)
  if (hspf2 < MODERN_STANDARDS.HSPF2_GOOD) {
    const potentialHSPF = MODERN_STANDARDS.HSPF2_EXCELLENT;
    const improvementRatio = potentialHSPF / hspf2;
    const currentHeatingCost = annualEstimate?.heatingCost || 0;
    const potentialSavings = currentHeatingCost * (1 - 1 / improvementRatio);

    const priority =
      hspf2 < MODERN_STANDARDS.HSPF2_MINIMUM
        ? PRIORITY.CRITICAL
        : PRIORITY.HIGH;
    const impact =
      potentialSavings > 500
        ? IMPACT.MAJOR
        : potentialSavings > 200
        ? IMPACT.MODERATE
        : IMPACT.MINOR;

    recommendations.push({
      id: "hspf2-upgrade",
      title: "Upgrade to High-Efficiency Heat Pump",
      message: `Your current HSPF2 of ${hspf2.toFixed(1)} is ${
        hspf2 < MODERN_STANDARDS.HSPF2_MINIMUM
          ? "below modern standards"
          : "good but improvable"
      }. Upgrading to a ${potentialHSPF.toFixed(
        1
      )} HSPF2 system could save approximately $${potentialSavings.toFixed(
        0
      )}/year on heating.`,
      priority,
      impact,
      category: "equipment",
      savingsEstimate: potentialSavings,
      actionLabel: "Explore Heat Pumps",
      actionRoute: "/roi",
      icon: "⚡",
      details: {
        currentHSPF: hspf2,
        recommendedHSPF: potentialHSPF,
        climateNote:
          climateZone === "very_cold"
            ? "Consider cold-climate models rated for your region."
            : null,
      },
    });
  }

  // 2. SEER2 upgrade recommendation (cooling efficiency)
  if (seer2 < MODERN_STANDARDS.SEER2_GOOD && cdd > 1000) {
    const potentialSEER = MODERN_STANDARDS.SEER2_EXCELLENT;
    const improvementRatio = potentialSEER / seer2;
    const currentCoolingCost = annualEstimate?.coolingCost || 0;
    const potentialSavings = currentCoolingCost * (1 - 1 / improvementRatio);

    const priority =
      seer2 < MODERN_STANDARDS.SEER2_MINIMUM ? PRIORITY.HIGH : PRIORITY.MEDIUM;
    const impact =
      potentialSavings > 500
        ? IMPACT.MAJOR
        : potentialSavings > 200
        ? IMPACT.MODERATE
        : IMPACT.MINOR;

    recommendations.push({
      id: "seer2-upgrade",
      title: "Improve Cooling Efficiency",
      message: `Your SEER2 of ${seer2.toFixed(
        1
      )} could be improved. A ${potentialSEER.toFixed(
        1
      )} SEER2 system could save approximately $${potentialSavings.toFixed(
        0
      )}/year on cooling in your ${climateZone.replace("_", " ")} climate.`,
      priority,
      impact,
      category: "equipment",
      savingsEstimate: potentialSavings,
      actionLabel: "Compare Systems",
      actionRoute: "/roi",
      icon: "❄️",
      details: {
        currentSEER: seer2,
        recommendedSEER: potentialSEER,
      },
    });
  }

  // 3. Insulation upgrade recommendation
  if (insulationLevel > MODERN_STANDARDS.INSULATION_GOOD) {
    const currentTotalCost = annualEstimate?.totalCost || 0;
    const insulationFactor =
      insulationLevel / MODERN_STANDARDS.INSULATION_EXCELLENT;
    const potentialSavings =
      currentTotalCost * (1 - 1 / insulationFactor) * 0.25; // ~25% of load is insulation-dependent

    const priority = insulationLevel > 1.2 ? PRIORITY.HIGH : PRIORITY.MEDIUM;
    const impact =
      potentialSavings > 500
        ? IMPACT.MAJOR
        : potentialSavings > 200
        ? IMPACT.MODERATE
        : IMPACT.MINOR;

    recommendations.push({
      id: "insulation-upgrade",
      title: "Improve Home Insulation",
      message: `Your insulation level (${insulationLevel.toFixed(
        2
      )}) suggests opportunity for improvement. Better insulation could save approximately $${potentialSavings.toFixed(
        0
      )}/year and reduce system wear.`,
      priority,
      impact,
      category: "building_envelope",
      savingsEstimate: potentialSavings,
      actionLabel: "Learn More",
      icon: "🏠",
      details: {
        currentInsulation: insulationLevel,
        targetInsulation: MODERN_STANDARDS.INSULATION_EXCELLENT,
        recommendation:
          insulationLevel > 1.2
            ? "Consider attic and wall insulation upgrades"
            : "Minor improvements could help",
      },
    });
  }

  // 4. Thermostat optimization (heating)
  if (winterThermostat > 68 && hdd > 3000) {
    const savingsPerDegree = (annualEstimate?.heatingCost || 0) * 0.03; // ~3% per degree F
    const degreesReduction = winterThermostat - 68;
    const potentialSavings = savingsPerDegree * degreesReduction;

    recommendations.push({
      id: "winter-thermostat",
      title: "Optimize Winter Thermostat",
      message: `Lowering your winter thermostat from ${winterThermostat}°F to 68°F could save approximately $${potentialSavings.toFixed(
        0
      )}/year. Consider using a programmable thermostat for automatic setbacks.`,
      priority: PRIORITY.LOW,
      impact: potentialSavings > 200 ? IMPACT.MODERATE : IMPACT.MINOR,
      category: "behavior",
      savingsEstimate: potentialSavings,
      actionLabel: "Adjust Settings",
      actionRoute: "/settings",
      icon: "🌡️",
      details: {
        currentSetting: winterThermostat,
        recommendedSetting: 68,
        savingsPerDegree: savingsPerDegree,
      },
    });
  }

  // 5. Thermostat optimization (cooling)
  if (summerThermostat < 76 && cdd > 2000) {
    const savingsPerDegree = (annualEstimate?.coolingCost || 0) * 0.04; // ~4% per degree F for cooling
    const degreesIncrease = 76 - summerThermostat;
    const potentialSavings = savingsPerDegree * degreesIncrease;

    recommendations.push({
      id: "summer-thermostat",
      title: "Raise Summer Thermostat",
      message: `Increasing your summer thermostat from ${summerThermostat}°F to 76°F could save approximately $${potentialSavings.toFixed(
        0
      )}/year. Fans can help maintain comfort at higher settings.`,
      priority: PRIORITY.LOW,
      impact: potentialSavings > 200 ? IMPACT.MODERATE : IMPACT.MINOR,
      category: "behavior",
      savingsEstimate: potentialSavings,
      actionLabel: "Adjust Settings",
      actionRoute: "/settings",
      icon: "🌡️",
      details: {
        currentSetting: summerThermostat,
        recommendedSetting: 76,
        savingsPerDegree: savingsPerDegree,
      },
    });
  }

  // 6. System sizing recommendation
  if (squareFeet && settings.capacity) {
    const tonsNeeded = squareFeet / 600; // Rule of thumb: 1 ton per 600 sq ft (varies by climate)
    const tonsCurrent = settings.capacity / 12; // Convert kBtu to tons
    const oversizingRatio = tonsCurrent / tonsNeeded;

    if (oversizingRatio > 1.3) {
      recommendations.push({
        id: "system-sizing",
        title: "System May Be Oversized",
        message: `Your ${tonsCurrent.toFixed(
          1
        )}-ton system appears oversized for ${squareFeet} sq ft. Oversized systems can short-cycle, reducing efficiency and comfort. Consider right-sizing during next replacement.`,
        priority: PRIORITY.LOW,
        impact: IMPACT.MINOR,
        category: "equipment",
        icon: "📏",
        details: {
          currentTons: tonsCurrent,
          estimatedNeed: tonsNeeded,
          note: "Consult a Manual J load calculation for precise sizing",
        },
      });
    }
  }

  // 7. Electric aux heat recommendation
  if (
    settings.useElectricAuxHeat &&
    hdd > 5000 &&
    (annualEstimate?.auxKwhIncluded || 0) > 1000
  ) {
    const auxCost = (annualEstimate.auxKwhIncluded || 0) * utilityCost;

    recommendations.push({
      id: "minimize-aux-heat",
      title: "Reduce Auxiliary Heat Usage",
      message: `You're using approximately ${annualEstimate.auxKwhIncluded.toFixed(
        0
      )} kWh/year of expensive auxiliary heat ($${auxCost.toFixed(
        0
      )}). Consider a cold-climate heat pump upgrade or dual-fuel system.`,
      priority: auxCost > 500 ? PRIORITY.HIGH : PRIORITY.MEDIUM,
      impact: auxCost > 500 ? IMPACT.MAJOR : IMPACT.MODERATE,
      category: "equipment",
      savingsEstimate: auxCost * 0.6, // Could save ~60% with proper system
      actionLabel: "Explore Options",
      actionRoute: "/roi",
      icon: "🔥",
      details: {
        annualAuxKwh: annualEstimate.auxKwhIncluded,
        annualAuxCost: auxCost,
      },
    });
  }

  // 8. Utility rate optimization
  if (utilityCost > 0.18) {
    recommendations.push({
      id: "utility-rate",
      title: "Explore Time-of-Use Rates",
      message: `Your electricity rate of $${utilityCost.toFixed(
        2
      )}/kWh is above average. Check if your utility offers time-of-use rates or budget billing to reduce costs.`,
      priority: PRIORITY.LOW,
      impact: IMPACT.MINOR,
      category: "utility",
      icon: "💰",
      details: {
        currentRate: utilityCost,
        averageRate: 0.15,
      },
    });
  }

  // 9. Elevation-specific recommendation
  if (userLocation.elevation && userLocation.elevation > 5000) {
    recommendations.push({
      id: "high-altitude",
      title: "High-Altitude System Considerations",
      message: `At ${userLocation.elevation.toLocaleString()} ft elevation, ensure your heat pump is properly sized for reduced air density. Consider systems with altitude compensation.`,
      priority: PRIORITY.LOW,
      impact: IMPACT.MINOR,
      category: "equipment",
      icon: "⛰️",
      details: {
        elevation: userLocation.elevation,
        note: "High altitude reduces heat pump capacity by ~4% per 1000ft",
      },
    });
  }

  // Sort by priority and impact
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const impactOrder = { major: 0, moderate: 1, minor: 2 };

  return recommendations.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return impactOrder[a.impact] - impactOrder[b.impact];
  });
}

/**
 * Get the top N recommendations
 * @param {Array} recommendations - Full recommendations array
 * @param {number} limit - Maximum number to return
 * @returns {Array} Top recommendations
 */
export function getTopRecommendations(recommendations, limit = 3) {
  return recommendations.slice(0, limit);
}

/**
 * Calculate total potential savings from all recommendations
 * @param {Array} recommendations - Recommendations array
 * @returns {number} Total estimated savings
 */
export function getTotalPotentialSavings(recommendations) {
  return recommendations.reduce(
    (sum, rec) => sum + (rec.savingsEstimate || 0),
    0
  );
}

/**
 * Filter recommendations by category
 * @param {Array} recommendations - Recommendations array
 * @param {string} category - Category to filter by
 * @returns {Array} Filtered recommendations
 */
export function filterByCategory(recommendations, category) {
  return recommendations.filter((rec) => rec.category === category);
}

/**
 * Get recommendation summary statistics
 * @param {Array} recommendations - Recommendations array
 * @returns {Object} Summary stats
 */
export function getRecommendationStats(recommendations) {
  return {
    total: recommendations.length,
    critical: recommendations.filter((r) => r.priority === PRIORITY.CRITICAL)
      .length,
    high: recommendations.filter((r) => r.priority === PRIORITY.HIGH).length,
    medium: recommendations.filter((r) => r.priority === PRIORITY.MEDIUM)
      .length,
    low: recommendations.filter((r) => r.priority === PRIORITY.LOW).length,
    totalSavings: getTotalPotentialSavings(recommendations),
    categories: {
      equipment: filterByCategory(recommendations, "equipment").length,
      behavior: filterByCategory(recommendations, "behavior").length,
      building_envelope: filterByCategory(recommendations, "building_envelope")
        .length,
      utility: filterByCategory(recommendations, "utility").length,
    },
  };
}

export default {
  generateRecommendations,
  getTopRecommendations,
  getTotalPotentialSavings,
  filterByCategory,
  getRecommendationStats,
  PRIORITY,
  IMPACT,
};
