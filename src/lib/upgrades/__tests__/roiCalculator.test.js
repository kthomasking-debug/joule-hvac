// src/lib/upgrades/__tests__/roiCalculator.test.js
import { describe, it, expect } from "vitest";
import {
  calculateROI,
  compareScenarios,
  UPGRADE_SCENARIOS,
} from "../roiCalculator";

describe("roiCalculator", () => {
  it("calculates ROI with default scenario values", () => {
    const result = calculateROI(UPGRADE_SCENARIOS.heatPump);

    expect(result.upfrontCost).toBe(8500);
    expect(result.totalRebates).toBe(2500); // 2000 + 500
    expect(result.netCost).toBe(6000);
    expect(result.annualSavings).toBe(850);
    expect(result.simplePayback).toBeCloseTo(7.1, 1); // 6000 / 850
    expect(result.lifetimeSavings).toBe(12750); // 850 * 15
    expect(result.netLifetimeSavings).toBe(6750); // 12750 - 6000
    expect(result.roi).toBeCloseTo(113, 0); // (6750 / 6000) * 100
  });

  it("calculates ROI with custom inputs", () => {
    const custom = {
      upfrontCost: 10000,
      annualSavings: 1000,
      federalRebate: 3000,
      stateRebate: 1000,
      lifespan: 20,
    };

    const result = calculateROI(UPGRADE_SCENARIOS.heatPump, custom);

    expect(result.upfrontCost).toBe(10000);
    expect(result.totalRebates).toBe(4000);
    expect(result.netCost).toBe(6000);
    expect(result.annualSavings).toBe(1000);
    expect(result.simplePayback).toBe(6);
    expect(result.lifetimeSavings).toBe(20000);
    expect(result.netLifetimeSavings).toBe(14000);
  });

  it("calculates financing costs when loan is provided", () => {
    const custom = {
      interestRate: 5, // 5% APR
      loanTerm: 10, // 10 years
    };

    const result = calculateROI(UPGRADE_SCENARIOS.insulation, custom);

    expect(result.monthlyPayment).toBeGreaterThan(0);
    expect(result.totalFinancingCost).toBeGreaterThan(result.netCost);
  });

  it("compares multiple upgrade scenarios", () => {
    const comparison = compareScenarios([
      "heatPump",
      "insulation",
      "airSealing",
    ]);

    expect(comparison).toHaveLength(3);
    expect(comparison[0].name).toBe("Heat Pump Upgrade");
    expect(comparison[1].name).toBe("Attic Insulation");
    expect(comparison[2].name).toBe("Air Sealing Package");
    expect(comparison[0].simplePayback).toBeCloseTo(7.1, 1);
    expect(comparison[1].simplePayback).toBeCloseTo(6.6, 1); // (2500-200)/350
    expect(comparison[2].simplePayback).toBeCloseTo(5.8, 1); // (1200-150)/180
  });

  it("returns zero financing cost when no loan is used", () => {
    const result = calculateROI(UPGRADE_SCENARIOS.airSealing);

    expect(result.monthlyPayment).toBe(0);
    expect(result.totalFinancingCost).toBe(result.netCost);
  });
});
