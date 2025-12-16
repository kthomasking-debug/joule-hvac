// src/lib/annualAdapter.js
import {
  getAnnualHDD,
  getAnnualCDD,
  calculateAnnualHeatingCostFromHDD,
  calculateAnnualCoolingCostFromCDD,
} from "./hddData";
import computeAnnualPrecisionEstimate from "./fullPrecisionEstimate";
import * as heatUtils from "./heatUtils";

function optionsMonthlyProfileFromUserLocation(userLocation) {
  const defaultHighs = [42, 45, 55, 65, 75, 85, 88, 86, 78, 66, 55, 45];
  return defaultHighs.map((h) => ({ high: h, low: h - 14 }));
}

export function estimateAnnualCostQuick(
  settings,
  userLocation,
  latestAnalysis
) {
  if (!userLocation) return null;
  const heatLossFactor =
    latestAnalysis?.heatLossFactor ||
    (() => {
      return heatUtils.calculateHeatLoss({
        squareFeet: settings.squareFeet || 1500,
        insulationLevel: settings.insulationLevel || 1.0,
        homeShape: settings.homeShape || 1.0,
        ceilingHeight: settings.ceilingHeight || 8,
        wallHeight: settings.wallHeight ?? null,
        hasLoft: settings.hasLoft || false,
      }) / 70; // Convert to BTU/hr/°F
    })();

  const homeElevation =
    typeof settings.homeElevation === "number" ? settings.homeElevation : 0;
  const elevationMultiplierRaw = 1 + ((homeElevation || 0) / 1000) * 0.005;
  const elevationMultiplier = Math.max(
    0.8,
    Math.min(1.3, elevationMultiplierRaw)
  );

  const annualHDD = getAnnualHDD(
    `${userLocation.city}, ${userLocation.state}`,
    userLocation.state
  );
  const heatingThermostatMultiplier = (settings.winterThermostat || 70) / 70;
  const annualHeatingCost = calculateAnnualHeatingCostFromHDD(
    annualHDD,
    heatLossFactor,
    settings.hspf2 || 9.0,
    settings.utilityCost || 0.15,
    settings.useElectricAuxHeat
  );
  annualHeatingCost.energy *= heatingThermostatMultiplier * elevationMultiplier;
  annualHeatingCost.cost *= heatingThermostatMultiplier * elevationMultiplier;

  const annualCDD = getAnnualCDD(
    `${userLocation.city}, ${userLocation.state}`,
    userLocation.state
  );
  const BASE_BTU_PER_SQFT_COOLING = 28.0;
  const ceilingMultiplier = 1 + ((settings.ceilingHeight || 8) - 8) * 0.1;
  const designHeatGain =
    (settings.squareFeet || 1500) *
    BASE_BTU_PER_SQFT_COOLING *
    (settings.insulationLevel || 1.0) *
    (settings.homeShape || 1.0) *
    ceilingMultiplier *
    (settings.solarExposure || 1.0);
  const heatGainFactor = designHeatGain / 20;

  const coolingThermostatMultiplier = 74 / (settings.summerThermostat || 74);
  const annualCoolingCost = calculateAnnualCoolingCostFromCDD(
    annualCDD,
    heatGainFactor,
    settings.efficiency || 15.0,
    settings.utilityCost || 0.15
  );
  annualCoolingCost.energy *= coolingThermostatMultiplier * elevationMultiplier;
  annualCoolingCost.cost *= coolingThermostatMultiplier * elevationMultiplier;

  return {
    total: annualHeatingCost.cost + annualCoolingCost.cost,
    heating: annualHeatingCost.cost,
    cooling: annualCoolingCost.cost,
  };
}

export async function estimateAnnualCostDetailed(
  settings,
  userLocation,
  latestAnalysis
) {
  if (!userLocation) return null;
  const monthlyProfile = optionsMonthlyProfileFromUserLocation(userLocation);
  const res = await computeAnnualPrecisionEstimate(settings, {
    monthlyProfile,
  });
  return {
    total: res.totalCost,
    heating: res.heatingCost,
    cooling: res.coolingCost,
  };
}

export function estimateAnnualCostReal(settings, userLocation, latestAnalysis) {
  // Synchronous adapter for UI codepaths; swap to detailed async in the page if desired.
  if (settings?.useDetailedAnnualEstimate) {
    // For now, return quick to keep sync; detailed variant is available as async.
    return estimateAnnualCostQuick(settings, userLocation, latestAnalysis);
  }
  return estimateAnnualCostQuick(settings, userLocation, latestAnalysis);
}

export default {
  estimateAnnualCostQuick,
  estimateAnnualCostDetailed,
  estimateAnnualCostReal,
};
