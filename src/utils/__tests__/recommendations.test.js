// src/utils/__tests__/recommendations.test.js
import { describe, it, expect } from "vitest";
import {
  generateRecommendations,
  getTopRecommendations,
  getTotalPotentialSavings,
  filterByCategory,
  getRecommendationStats,
  PRIORITY,
  IMPACT,
} from "../recommendations";

describe("recommendations engine", () => {
  const mockSettings = {
    hspf2: 8.0,
    efficiency: 14.0,
    insulationLevel: 1.1,
    winterThermostat: 72,
    summerThermostat: 72,
    squareFeet: 2000,
    utilityCost: 0.15,
    capacity: 36,
    useElectricAuxHeat: true,
  };

  const mockLocation = {
    city: "Chicago",
    state: "Illinois",
    elevation: 600,
  };

  const mockAnnualEstimate = {
    totalCost: 2000,
    heatingCost: 1200,
    coolingCost: 800,
    auxKwhIncluded: 500,
  };

  it("generates recommendations for inefficient system", () => {
    const recommendations = generateRecommendations(
      mockSettings,
      mockLocation,
      mockAnnualEstimate
    );

    expect(recommendations).toBeDefined();
    expect(Array.isArray(recommendations)).toBe(true);
    expect(recommendations.length).toBeGreaterThan(0);
  });

  it("includes HSPF upgrade recommendation for low efficiency", () => {
    const recommendations = generateRecommendations(
      mockSettings,
      mockLocation,
      mockAnnualEstimate
    );
    const hspfRec = recommendations.find((r) => r.id === "hspf2-upgrade");

    expect(hspfRec).toBeDefined();
    expect(hspfRec.priority).toBe("high");
    expect(hspfRec.savingsEstimate).toBeGreaterThan(0);
  });

  it("includes SEER upgrade recommendation for cooling climate", () => {
    const hotLocation = { city: "Phoenix", state: "Arizona", elevation: 1100 };
    const recommendations = generateRecommendations(
      mockSettings,
      hotLocation,
      mockAnnualEstimate
    );
    const seerRec = recommendations.find((r) => r.id === "seer2-upgrade");

    expect(seerRec).toBeDefined();
    expect(seerRec?.category).toBe("equipment");
  });

  it("recommends thermostat adjustments when set too high/low", () => {
    const recommendations = generateRecommendations(
      mockSettings,
      mockLocation,
      mockAnnualEstimate
    );
    const winterRec = recommendations.find((r) => r.id === "winter-thermostat");
    const summerRec = recommendations.find((r) => r.id === "summer-thermostat");

    // Winter recommendation should exist (72°F > 68°F threshold)
    expect(winterRec).toBeDefined();
    expect(winterRec?.category).toBe("behavior");

    // Summer may or may not exist depending on CDD threshold
    if (summerRec) {
      expect(summerRec.category).toBe("behavior");
    }
  });

  it("sorts recommendations by priority and impact", () => {
    const recommendations = generateRecommendations(
      mockSettings,
      mockLocation,
      mockAnnualEstimate
    );

    // Critical should come before high
    const priorities = recommendations.map((r) => r.priority);
    const priorityOrder = ["critical", "high", "medium", "low"];

    for (let i = 1; i < priorities.length; i++) {
      const prevIndex = priorityOrder.indexOf(priorities[i - 1]);
      const currIndex = priorityOrder.indexOf(priorities[i]);
      expect(currIndex).toBeGreaterThanOrEqual(prevIndex);
    }
  });

  it("returns empty array for missing inputs", () => {
    expect(
      generateRecommendations(null, mockLocation, mockAnnualEstimate)
    ).toEqual([]);
    expect(
      generateRecommendations(mockSettings, null, mockAnnualEstimate)
    ).toEqual([]);
  });

  it("getTopRecommendations limits results correctly", () => {
    const recommendations = generateRecommendations(
      mockSettings,
      mockLocation,
      mockAnnualEstimate
    );
    const top3 = getTopRecommendations(recommendations, 3);

    expect(top3.length).toBeLessThanOrEqual(3);
    expect(top3.length).toBeLessThanOrEqual(recommendations.length);
  });

  it("getTotalPotentialSavings calculates correctly", () => {
    const recommendations = generateRecommendations(
      mockSettings,
      mockLocation,
      mockAnnualEstimate
    );
    const totalSavings = getTotalPotentialSavings(recommendations);

    expect(totalSavings).toBeGreaterThan(0);
    expect(typeof totalSavings).toBe("number");
  });

  it("filterByCategory returns only matching recommendations", () => {
    const recommendations = generateRecommendations(
      mockSettings,
      mockLocation,
      mockAnnualEstimate
    );
    const equipmentRecs = filterByCategory(recommendations, "equipment");

    expect(equipmentRecs.every((r) => r.category === "equipment")).toBe(true);
  });

  it("getRecommendationStats returns summary object", () => {
    const recommendations = generateRecommendations(
      mockSettings,
      mockLocation,
      mockAnnualEstimate
    );
    const stats = getRecommendationStats(recommendations);

    expect(stats).toHaveProperty("total");
    expect(stats).toHaveProperty("critical");
    expect(stats).toHaveProperty("high");
    expect(stats).toHaveProperty("medium");
    expect(stats).toHaveProperty("low");
    expect(stats).toHaveProperty("totalSavings");
    expect(stats).toHaveProperty("categories");

    expect(stats.total).toBe(recommendations.length);
    expect(stats.totalSavings).toBeGreaterThan(0);
  });

  it("handles efficient system with fewer recommendations", () => {
    const efficientSettings = {
      hspf2: 10.5,
      efficiency: 18.0,
      insulationLevel: 0.75,
      winterThermostat: 68,
      summerThermostat: 76,
      squareFeet: 2000,
      utilityCost: 0.12,
      capacity: 36,
      useElectricAuxHeat: false,
    };

    const recommendations = generateRecommendations(
      efficientSettings,
      mockLocation,
      mockAnnualEstimate
    );

    // Efficient system should have fewer critical/high priority recommendations
    const criticalOrHigh = recommendations.filter(
      (r) => r.priority === "critical" || r.priority === "high"
    );
    expect(criticalOrHigh.length).toBeLessThan(3);
  });

  it("includes aux heat recommendation for cold climates", () => {
    const coldLocation = {
      city: "Minneapolis",
      state: "Minnesota",
      elevation: 840,
    };
    const highAuxEstimate = { ...mockAnnualEstimate, auxKwhIncluded: 2000 };

    const recommendations = generateRecommendations(
      mockSettings,
      coldLocation,
      highAuxEstimate
    );
    const auxRec = recommendations.find((r) => r.id === "minimize-aux-heat");

    expect(auxRec).toBeDefined();
    // Priority depends on aux cost: 2000 kWh * $0.15 = $300, which is medium priority
    expect(["high", "medium"]).toContain(auxRec?.priority);
  });

  it("each recommendation has required properties", () => {
    const recommendations = generateRecommendations(
      mockSettings,
      mockLocation,
      mockAnnualEstimate
    );

    recommendations.forEach((rec) => {
      expect(rec).toHaveProperty("id");
      expect(rec).toHaveProperty("title");
      expect(rec).toHaveProperty("message");
      expect(rec).toHaveProperty("priority");
      expect(rec).toHaveProperty("impact");
      expect(rec).toHaveProperty("category");
      expect(rec).toHaveProperty("icon");
    });
  });
});
