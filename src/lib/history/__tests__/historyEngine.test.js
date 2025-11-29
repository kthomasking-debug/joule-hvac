import { describe, it, expect, beforeEach } from "vitest";
import {
  loadHistory,
  recordMonth,
  getMonthData,
  getComparison,
  getRecentTrend,
} from "../historyEngine";

describe("historyEngine", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("records a month with predicted and actual costs", () => {
    const result = recordMonth(2025, 11, {
      predictedCost: 150,
      actualCost: 145,
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(result[0].key).toBe("2025-11");
  });

  it("updates existing month data", () => {
    recordMonth(2025, 10, { predictedCost: 120 });
    recordMonth(2025, 10, { predictedCost: 125, actualCost: 118 });
    const data = getMonthData(2025, 10);
    expect(data.predictedCost).toBe(125);
    expect(data.actualCost).toBe(118);
  });

  it("compares current month to last year", () => {
    recordMonth(2024, 11, { predictedCost: 140, actualCost: 138 });
    recordMonth(2025, 11, { predictedCost: 130, actualCost: 128 });
    const comp = getComparison(2025, 11);
    expect(comp).toBeTruthy();
    expect(comp.actualDelta).toBe(-10);
    expect(comp.actualPctChange).toBeCloseTo(-7.25, 1);
  });

  it("returns recent trend for last N months", () => {
    recordMonth(2025, 6, { predictedCost: 100 });
    recordMonth(2025, 7, { predictedCost: 110 });
    recordMonth(2025, 8, { predictedCost: 105 });
    const trend = getRecentTrend(3);
    expect(trend.length).toBe(3);
    expect(trend[0].label).toBe("2025-08");
  });

  it("keeps only last 24 months", () => {
    for (let i = 1; i <= 30; i++) {
      recordMonth(2023, i > 12 ? i - 12 : i, { predictedCost: 100 + i });
    }
    const history = loadHistory();
    expect(history.length).toBeLessThanOrEqual(24);
  });
});
