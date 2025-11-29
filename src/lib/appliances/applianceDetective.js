// src/lib/appliances/applianceDetective.js
// Estimate energy usage for major home appliances

export const APPLIANCE_PROFILES = {
  waterHeater: {
    name: "Water Heater",
    avgWatts: 4500,
    avgHoursPerDay: 3,
    estimatedAnnualKwh: 4900,
    rulesOfThumb: {
      electric: { dailyKwh: 13.4, monthlyCost: 60 },
      gas: { dailyTherms: 1.8, monthlyCost: 65 },
    },
  },
  dryer: {
    name: "Clothes Dryer",
    avgWatts: 3000,
    avgHoursPerDay: 1,
    estimatedAnnualKwh: 1095,
    rulesOfThumb: {
      electric: { dailyKwh: 3, monthlyCost: 14 },
      gas: { dailyTherms: 0.5, monthlyCost: 18 },
    },
  },
  dishwasher: {
    name: "Dishwasher",
    avgWatts: 1800,
    avgHoursPerDay: 0.5,
    estimatedAnnualKwh: 330,
    rulesOfThumb: { dailyKwh: 0.9, monthlyCost: 4 },
  },
  refrigerator: {
    name: "Refrigerator",
    avgWatts: 150,
    avgHoursPerDay: 24,
    estimatedAnnualKwh: 1314,
    rulesOfThumb: { dailyKwh: 3.6, monthlyCost: 16 },
  },
  oven: {
    name: "Electric Oven",
    avgWatts: 2400,
    avgHoursPerDay: 0.5,
    estimatedAnnualKwh: 438,
    rulesOfThumb: { dailyKwh: 1.2, monthlyCost: 5 },
  },
  washer: {
    name: "Washing Machine",
    avgWatts: 500,
    avgHoursPerDay: 0.5,
    estimatedAnnualKwh: 91,
    rulesOfThumb: { dailyKwh: 0.25, monthlyCost: 1 },
  },
};

export function calculateApplianceCost(applianceKey, userInputs = {}) {
  const profile = APPLIANCE_PROFILES[applianceKey];
  if (!profile) return null;

  const hoursPerDay = userInputs.hoursPerDay ?? profile.avgHoursPerDay;
  const watts = userInputs.watts ?? profile.avgWatts;
  const utilityCost = userInputs.utilityCost ?? 0.15;

  const dailyKwh = (watts * hoursPerDay) / 1000;
  const monthlyKwh = dailyKwh * 30;
  const annualKwh = dailyKwh * 365;
  const monthlyCost = monthlyKwh * utilityCost;
  const annualCost = annualKwh * utilityCost;

  return {
    applianceName: profile.name,
    dailyKwh: Math.round(dailyKwh * 10) / 10,
    monthlyKwh: Math.round(monthlyKwh),
    annualKwh: Math.round(annualKwh),
    monthlyCost: Math.round(monthlyCost * 100) / 100,
    annualCost: Math.round(annualCost * 100) / 100,
  };
}

export function getAllAppliancesCost(userInputs = {}) {
  const results = [];
  let totalAnnual = 0;

  for (const key of Object.keys(APPLIANCE_PROFILES)) {
    const cost = calculateApplianceCost(key, userInputs[key] || {});
    if (cost) {
      results.push({ key, ...cost });
      totalAnnual += cost.annualCost;
    }
  }

  return {
    appliances: results,
    totalAnnualCost: Math.round(totalAnnual * 100) / 100,
  };
}
