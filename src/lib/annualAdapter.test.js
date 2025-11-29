import { describe, it, expect } from "vitest";
import { estimateAnnualCostQuick } from "./annualAdapter";

const mockLocation = { city: "Blairsville", state: "GA", elevation: 1900 };

describe("annualAdapter quick estimates", () => {
  it("returns heating, cooling, and total for baseline settings", () => {
    const settings = {
      squareFeet: 1800,
      insulationLevel: 1.0,
      homeShape: 1.0,
      ceilingHeight: 8,
      utilityCost: 0.15,
      hspf2: 8.5,
      efficiency: 14,
      winterThermostat: 70,
      summerThermostat: 74,
      useElectricAuxHeat: true,
    };
    const res = estimateAnnualCostQuick(settings, mockLocation, null);
    expect(res).toBeTruthy();
    expect(res.total).toBeGreaterThan(0);
    expect(res.heating).toBeGreaterThan(0);
    expect(res.cooling).toBeGreaterThan(0);
    expect(Math.round(res.heating + res.cooling)).toBe(Math.round(res.total));
  });

  it("shows lower total when efficiency is improved", () => {
    const base = estimateAnnualCostQuick(
      {
        squareFeet: 1800,
        insulationLevel: 1.0,
        homeShape: 1.0,
        ceilingHeight: 8,
        utilityCost: 0.15,
        hspf2: 8.5,
        efficiency: 14,
        winterThermostat: 70,
        summerThermostat: 74,
        useElectricAuxHeat: true,
      },
      mockLocation,
      null
    );

    const upgraded = estimateAnnualCostQuick(
      {
        squareFeet: 1800,
        insulationLevel: 1.0,
        homeShape: 1.0,
        ceilingHeight: 8,
        utilityCost: 0.15,
        hspf2: 11.5,
        efficiency: 18,
        winterThermostat: 70,
        summerThermostat: 74,
        useElectricAuxHeat: true,
      },
      mockLocation,
      null
    );

    expect(upgraded.total).toBeLessThan(base.total);
    expect(upgraded.heating).toBeLessThan(base.heating);
  });
});
