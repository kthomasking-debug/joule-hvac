// src/lib/upgrades/roiCalculator.js
// Calculate ROI, payback, and financing for home energy upgrades

export const UPGRADE_SCENARIOS = {
  heatPump: {
    name: "Heat Pump Upgrade",
    upfrontCost: 8500,
    annualSavings: 850,
    lifespan: 15,
    federalRebate: 2000,
    stateRebate: 500,
    description: "Replace furnace/AC with high-efficiency heat pump",
  },
  insulation: {
    name: "Attic Insulation",
    upfrontCost: 2500,
    annualSavings: 350,
    lifespan: 30,
    federalRebate: 0,
    stateRebate: 200,
    description: "Upgrade attic to R-49 insulation",
  },
  airSealing: {
    name: "Air Sealing Package",
    upfrontCost: 1200,
    annualSavings: 180,
    lifespan: 20,
    federalRebate: 0,
    stateRebate: 150,
    description: "Seal air leaks, add weatherstripping",
  },
  windows: {
    name: "Energy-Efficient Windows",
    upfrontCost: 12000,
    annualSavings: 500,
    lifespan: 25,
    federalRebate: 600,
    stateRebate: 0,
    description: "Replace with double-pane, low-E windows",
  },
  solarPanels: {
    name: "Solar Panel System",
    upfrontCost: 18000,
    annualSavings: 1400,
    lifespan: 25,
    federalRebate: 5400, // 30% ITC
    stateRebate: 1000,
    description: "6 kW solar system with net metering",
  },
};

export function calculateROI(scenario, customInputs = {}) {
  const upfront = customInputs.upfrontCost ?? scenario.upfrontCost;
  const annualSavings = customInputs.annualSavings ?? scenario.annualSavings;
  const federalRebate = customInputs.federalRebate ?? scenario.federalRebate;
  const stateRebate = customInputs.stateRebate ?? scenario.stateRebate;
  const lifespan = customInputs.lifespan ?? scenario.lifespan;
  const interestRate = customInputs.interestRate ?? 0; // financing rate
  const loanTerm = customInputs.loanTerm ?? 0; // years

  const totalRebates = federalRebate + stateRebate;
  const netCost = upfront - totalRebates;

  // Simple payback (years)
  const simplePayback = netCost / annualSavings;

  // Total lifetime savings
  const lifetimeSavings = annualSavings * lifespan;
  const netLifetimeSavings = lifetimeSavings - netCost;

  // ROI percentage
  const roi = (netLifetimeSavings / netCost) * 100;

  // Financing monthly payment (if applicable)
  let monthlyPayment = 0;
  let totalFinancingCost = netCost;
  if (loanTerm > 0 && interestRate > 0) {
    const r = interestRate / 100 / 12;
    const n = loanTerm * 12;
    monthlyPayment =
      (netCost * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    totalFinancingCost = monthlyPayment * n;
  }

  return {
    upfrontCost: upfront,
    totalRebates,
    netCost,
    annualSavings,
    simplePayback: Math.round(simplePayback * 10) / 10,
    lifetimeSavings: Math.round(lifetimeSavings),
    netLifetimeSavings: Math.round(netLifetimeSavings),
    roi: Math.round(roi),
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    totalFinancingCost: Math.round(totalFinancingCost),
  };
}

export function compareScenarios(scenarioKeys, customInputs = {}) {
  return scenarioKeys.map((key) => {
    const scenario = UPGRADE_SCENARIOS[key];
    const roi = calculateROI(scenario, customInputs[key] || {});
    return {
      key,
      name: scenario.name,
      description: scenario.description,
      ...roi,
    };
  });
}
