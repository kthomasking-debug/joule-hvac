// Helper utilities for annual and monthly budget estimates
import * as heatUtils from './heatUtils';

const BASE_COOLING_LOAD_FACTOR = 28.0; // BTU/(hr·ft²)
const BASE_BTU_PER_SQFT = 22.67;
const BTU_PER_KWH = 3412.14;

export const TYPICAL_CDD = {
  1: 0, // Jan
  2: 0, // Feb
  3: 20,
  4: 60,
  5: 100,
  6: 250,
  7: 450,
  8: 400,
  9: 250,
  10: 60,
  11: 10,
  12: 0,
};

// Typical HDD entries for heating months (degree-days per month), simplified
export const TYPICAL_HDD = {
  1: 1200, // Jan
  2: 1000, // Feb
  3: 600,
  4: 200,
  5: 50,
  6: 10,
  7: 0,
  8: 0,
  9: 20,
  10: 200,
  11: 500,
  12: 1100,
};

// Map capacity (kBTU) to tons
export const TONS_MAP = {
  18: 1.5,
  24: 2.0,
  30: 2.5,
  36: 3.0,
  42: 3.5,
  48: 4.0,
  60: 5.0,
};

/**
 * Estimate monthly cooling cost from a CDD (Cooling Degree Days) value.
 * This matches the simplified approach in MonthlyBudgetPlanner.jsx.
 */
export function estimateMonthlyCoolingCostFromCDD({
  cdd,
  squareFeet = 1500,
  insulationLevel = 1.0,
  homeShape = 1.0,
  ceilingHeight = 8,
  capacity = 36,
  seer2 = 10.0,
  electricityRate = 0.15,
  solarExposure = 1.0,
}) {
  const tons = TONS_MAP[capacity] || TONS_MAP[36] || 3.0;
  const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
  const designHeatGain =
    squareFeet *
    BASE_COOLING_LOAD_FACTOR *
    insulationLevel *
    homeShape *
    ceilingMultiplier *
    solarExposure; // BTU/hr
  const btuGainPerDegF = designHeatGain / 20; // Use representative ΔT baseline 20°F

  // Degree-days -> degree-hours
  const degreeHours = cdd * 24;
  const seasonalCoolingBtu = degreeHours * btuGainPerDegF;

  const estimatedKWh = seasonalCoolingBtu / (Math.max(5, seer2) * 1000);
  const estimatedCost = estimatedKWh * electricityRate;

  return {
    cost: estimatedCost,
    energy: estimatedKWh,
    days: 30,
    method: "CDD",
    cdd,
    electricityRate,
    seer2,
    tons,
    coolingLoadFactor: BASE_COOLING_LOAD_FACTOR,
    solarExposure,
  };
}

/**
 * Estimate an annual cooling cost using typical CDD values (sums cooling months).
 * This is a conservative approximation using the 'TYPICAL_CDD' map.
 */
export function estimateAnnualCoolingCostFromTypicalCDD(settings = {}) {
  const months = Object.keys(TYPICAL_CDD).map((m) => Number(m));
  let totalCost = 0;
  let totalEnergy = 0;
  months.forEach((month) => {
    const cdd = TYPICAL_CDD[month] || 0;
    if (!cdd || cdd <= 0) return; // Skip months with no cooling demand
    const { cost, energy } = estimateMonthlyCoolingCostFromCDD({
      cdd,
      ...settings,
    });
    totalCost += cost;
    totalEnergy += energy;
  });

  return {
    cost: totalCost,
    energy: totalEnergy,
    monthsCounted: months.filter((m) => (TYPICAL_CDD[m] || 0) > 0).length,
  };
}

/**
 * Sum monthly estimates for 12 months to produce an annual cost estimation.
 * This uses the per-month typical CDD/HDD maps and the monthly helpers; a pragmatic
 * approach to give a more realistic annual estimate without fetching per-month data.
 */
export function estimateAnnualCostFromMonthlyTypical(settings = {}) {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  let totalHeatingCost = 0;
  let totalCoolingCost = 0;
  let totalEnergy = 0;

  months.forEach((month) => {
    const cdd = TYPICAL_CDD[month] || 0;
    const hdd = TYPICAL_HDD[month] || 0;

    if (cdd > 0) {
      const monthlyCooling = estimateMonthlyCoolingCostFromCDD({
        cdd,
        ...settings,
      });
      totalCoolingCost += monthlyCooling?.cost || 0;
      totalEnergy += monthlyCooling?.energy || 0;
    }

    if (hdd > 0) {
      const monthlyHeating = estimateMonthlyHeatingCostFromHDD({
        hdd,
        ...settings,
      });
      totalHeatingCost += monthlyHeating?.cost || 0;
      totalEnergy += monthlyHeating?.energy || 0;
    }
  });

  return {
    cost: totalHeatingCost + totalCoolingCost,
    heatingCost: totalHeatingCost,
    coolingCost: totalCoolingCost,
    energy: totalEnergy,
    monthsCounted: 12,
  };
}

/**
 * Estimate monthly heating cost from a monthly HDD value.
 * This mirrors the simplified `calculateCostFromHDD` logic used in MonthlyBudgetPlanner.
 */
export function estimateMonthlyHeatingCostFromHDD({
  hdd,
  squareFeet = 1500,
  insulationLevel = 1.0,
  homeShape = 1.0,
  ceilingHeight = 8,
  hspf = 10.0,
  electricityRate = 0.15,
} = {}) {
  // Use centralized heat loss calculation function
  const estimatedDesignHeatLoss = heatUtils.calculateHeatLoss({
    squareFeet,
    insulationLevel,
    homeShape,
    ceilingHeight,
  });
  const btuLossPerDegF = estimatedDesignHeatLoss / 70; // consistent with planner's design temp diff

  // Convert monthly HDD (degree-days) to kWh equivalent using HSPF
  // HSPF is BTU/Wh, so kWh = BTU / (HSPF * 1000)
  const degreeHours = hdd * 24;
  const totalBtu = degreeHours * btuLossPerDegF;
  const estimatedEnergy = totalBtu / (Math.max(0.1, hspf) * 1000);
  const estimatedCost = estimatedEnergy * electricityRate;

  return {
    cost: estimatedCost,
    energy: estimatedEnergy,
    days: 30,
    method: "HDD",
    hdd,
    electricityRate,
  };
}
