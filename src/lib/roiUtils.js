// src/lib/roiUtils.js
import {
  getAnnualHDD,
  getAnnualCDD,
  calculateAnnualHeatingCostFromHDD,
  calculateAnnualCoolingCostFromCDD,
} from "./hddData";
import * as heatUtils from "./heatUtils";

export const currency = (v) => `$${(v ?? 0).toFixed(0)}`;

export function estimateAnnualCost(settings, userLocation, latestAnalysis) {
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
  // Heat gain factor derived from heat loss factor with solar exposure multiplier
  // Default range: 1.3-1.8 (unless user explicitly selects "shaded/minimal windows" which allows 1.0-1.2)
  let solarExposureMultiplier = settings.solarExposure || 1.5;
  
  // If it's a percent (>= 1 and <= 100), divide by 100
  if (solarExposureMultiplier >= 1 && solarExposureMultiplier <= 100) {
    solarExposureMultiplier = solarExposureMultiplier / 100;
  }
  
  // Clamp to [1.0, 2.5] range
  // Note: Shaded/minimal windows allows 1.0-1.2, typical range is 1.3-1.8
  solarExposureMultiplier = Math.max(1.0, Math.min(2.5, solarExposureMultiplier));
  
  // Derive heat gain from heat loss: heatGainFactor = heatLossFactor * solarExposureMultiplier
  // This is a UA-like term (BTU/hr/°F), consistent with heatLossFactor
  const heatGainFactor = heatLossFactor * solarExposureMultiplier;

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

export function computeRoi(
  upgradeCost,
  annualSavings,
  years = 10,
  discountRate = 0.05
) {
  const costNum = Number(upgradeCost) || 0;
  const savingsNum = Number(annualSavings) || 0;
  const rate = Number(discountRate) || 0;
  const horizon = Number(years) || 10;
  const payback = savingsNum > 0 ? costNum / savingsNum : Infinity;
  let npv = -costNum;
  for (let t = 1; t <= horizon; t++) npv += savingsNum / Math.pow(1 + rate, t);
  const roi10 = horizon * savingsNum - costNum;
  return { payback, npv, roi10 };
}

export default {
  computeRoi,
  estimateAnnualCost,
  currency,
};
