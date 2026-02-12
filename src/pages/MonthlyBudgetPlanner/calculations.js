import { getAnnualHDD, getAnnualCDD } from "../../lib/hddData";
import { loadThermostatSettings } from "../../lib/thermostatSettings";
import {
  estimateMonthlyCoolingCostFromCDD,
  estimateMonthlyHeatingCostFromHDD,
} from "../../lib/budgetUtils";

/**
 * Get typical HDD for a month (legacy fallback)
 */
export function getTypicalHDD(month) {
  const typicalHDD = { 1: 1200, 2: 1000, 10: 200, 11: 500, 12: 1100 };
  return typicalHDD[month] || 800;
}

/**
 * Get typical HDD for a date range by prorating monthly values.
 * Use when bill period spans partial months (e.g. Jan 27 – Feb 10).
 */
export function getTypicalHDDForPeriod(startDate, endDate) {
  const typicalHDD = { 1: 1200, 2: 1000, 3: 600, 4: 200, 5: 50, 6: 10, 7: 0, 8: 0, 9: 20, 10: 200, 11: 500, 12: 1100 };
  const daysInMonth = (m, y) => new Date(y, m, 0).getDate();
  let total = 0;
  const cur = new Date(startDate);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  while (cur <= end) {
    const m = cur.getMonth() + 1;
    const y = cur.getFullYear();
    const days = daysInMonth(m, y);
    total += (typicalHDD[m] || 800) / days;
    cur.setDate(cur.getDate() + 1);
  }
  return Math.round(total);
}

/**
 * Get typical CDD for a month (legacy fallback)
 */
export function getTypicalCDD(month) {
  const typicalCDD = { 5: 100, 6: 250, 7: 450, 8: 400, 9: 250 };
  return typicalCDD[month] || 300;
}

/**
 * Estimate monthly heating cost from HDD
 * Uses location-specific climate data and actual thermostat settings
 */
export function estimateTypicalHDDCost(params) {
  // Use the same scaling logic as annual breakdown for consistency
  const monthlyHDDDist = [1200, 1000, 600, 200, 50, 10, 0, 0, 20, 200, 500, 1100]; // Jan-Dec
  const totalTypicalHDD = monthlyHDDDist.reduce((a, b) => a + b, 0); // ~4880
  
  // Get location-specific annual HDD if available
  let annualHDD = 5000; // default fallback
  if (params.locationData?.city && params.locationData?.state) {
    annualHDD = getAnnualHDD(params.locationData.city, params.locationData.state);
  }
  
  // Scale monthly HDD to location's annual total (same as annual breakdown)
  const monthIndex = params.month - 1; // Convert 1-12 to 0-11
  const monthHDD = totalTypicalHDD > 0 ? (monthlyHDDDist[monthIndex] / totalTypicalHDD) * annualHDD : 0;
  
  // Calculate temperature multiplier - use actual thermostat settings first
  // Priority: 1) userSettings.winterThermostatDay/Night, 2) thermostatSettings comfortSettings, 3) defaults
  let winterDayTemp = params.userSettings?.winterThermostatDay;
  let winterNightTemp = params.userSettings?.winterThermostatNight;
  
  // If not in userSettings, check thermostat settings
  if (winterDayTemp === undefined || winterNightTemp === undefined) {
    try {
      const thermostatSettings = loadThermostatSettings();
      const comfortSettings = thermostatSettings?.comfortSettings;
      
      if (winterDayTemp === undefined) {
        winterDayTemp = comfortSettings?.home?.heatSetPoint ?? 70;
      }
      if (winterNightTemp === undefined) {
        winterNightTemp = comfortSettings?.sleep?.heatSetPoint ?? 66;
      }
    } catch {
      if (winterDayTemp === undefined) {
        winterDayTemp = 70;
      }
      if (winterNightTemp === undefined) {
        winterNightTemp = 66;
      }
    }
  }
  
  const avgWinterIndoorTemp = (winterDayTemp * 16 + winterNightTemp * 8) / 24;
  const baseWinterOutdoorTemp = 35;
  const baseWinterDelta = 65 - baseWinterOutdoorTemp; // 30°F
  const actualWinterDelta = avgWinterIndoorTemp - baseWinterOutdoorTemp;
  const winterTempMultiplier = actualWinterDelta / baseWinterDelta;
  
  const estimate = estimateMonthlyHeatingCostFromHDD({
    hdd: monthHDD,
    squareFeet: params.squareFeet,
    insulationLevel: params.insulationLevel,
    homeShape: params.homeShape,
    ceilingHeight: params.ceilingHeight,
    hspf: params.hspf || params.efficiency,
    electricityRate: params.electricityRate,
  });
  
  // Apply temperature multiplier (same as annual breakdown)
  if (estimate && estimate.cost > 0) {
    estimate.cost = estimate.cost * winterTempMultiplier;
  }
  
  params.setEstimate(estimate);
}

/**
 * Estimate monthly cooling cost from CDD
 * Uses location-specific climate data and actual thermostat settings
 */
export function estimateTypicalCDDCost(params) {
  // Use the same scaling logic as annual breakdown for consistency
  const monthlyCDDDist = [0, 0, 10, 60, 150, 300, 450, 400, 250, 100, 10, 0]; // Jan-Dec
  const totalTypicalCDD = monthlyCDDDist.reduce((a, b) => a + b, 0); // ~1730
  
  // Get location-specific annual CDD if available
  let annualCDD = 1500; // default fallback
  if (params.locationData?.city && params.locationData?.state) {
    annualCDD = getAnnualCDD(params.locationData.city, params.locationData.state);
  }
  
  // Scale monthly CDD to location's annual total (same as annual breakdown)
  const monthIndex = params.month - 1; // Convert 1-12 to 0-11
  const monthCDD = totalTypicalCDD > 0 ? (monthlyCDDDist[monthIndex] / totalTypicalCDD) * annualCDD : 0;
  
  // Calculate temperature multiplier (same as annual breakdown)
  const summerDayTemp = params.userSettings?.summerThermostat ?? 76;
  const summerNightTemp = params.userSettings?.summerThermostatNight ?? 78;
  const avgSummerIndoorTemp = (summerDayTemp * 16 + summerNightTemp * 8) / 24;
  const baseSummerOutdoorTemp = 85;
  const baseSummerDelta = baseSummerOutdoorTemp - 65; // 20°F
  const actualSummerDelta = baseSummerOutdoorTemp - avgSummerIndoorTemp;
  const summerTempMultiplier = actualSummerDelta / baseSummerDelta;
  
  const estimate = estimateMonthlyCoolingCostFromCDD({
    ...params,
    cdd: monthCDD,
    seer2: params.efficiency,
  });
  
  // Apply temperature multiplier (same as annual breakdown)
  if (estimate && estimate.cost > 0) {
    estimate.cost = estimate.cost * summerTempMultiplier;
  }
  
  params.setEstimate(estimate);
}
