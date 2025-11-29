import { describe, it, expect } from "vitest";
import {
  calculateApplianceCost,
  getAllAppliancesCost,
  APPLIANCE_PROFILES,
} from "../applianceDetective";

describe("applianceDetective", () => {
  it("calculates cost for a specific appliance with defaults", () => {
    const result = calculateApplianceCost("waterHeater");
    expect(result.applianceName).toBe("Water Heater");
    expect(result.annualKwh).toBeGreaterThan(0);
    expect(result.annualCost).toBeGreaterThan(0);
  });

  it("calculates cost with custom inputs", () => {
    const custom = { hoursPerDay: 2, watts: 4000, utilityCost: 0.2 };
    const result = calculateApplianceCost("waterHeater", custom);
    expect(result.dailyKwh).toBe(8);
    expect(result.monthlyKwh).toBe(240);
    expect(result.annualKwh).toBe(2920);
    expect(result.monthlyCost).toBe(48);
  });

  it("returns all appliances with total cost", () => {
    const results = getAllAppliancesCost();
    expect(results.appliances.length).toBe(
      Object.keys(APPLIANCE_PROFILES).length
    );
    expect(results.totalAnnualCost).toBeGreaterThan(0);
  });

  it("sums total annual cost correctly", () => {
    const results = getAllAppliancesCost();
    const manualSum = results.appliances.reduce(
      (sum, a) => sum + a.annualCost,
      0
    );
    expect(results.totalAnnualCost).toBeCloseTo(manualSum, 2);
  });
});
