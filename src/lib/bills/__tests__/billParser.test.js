import { describe, it, expect } from "vitest";
import { parseBillText, calibrateModel } from "../billParser";

describe("billParser", () => {
  it("parses total cost from bill text", () => {
    const text = "Total Amount Due: $145.50";
    const result = parseBillText(text);
    expect(result.totalCost).toBe(145.5);
  });

  it("parses kWh usage", () => {
    const text = "Usage this period: 850 kWh";
    const result = parseBillText(text);
    expect(result.kwh).toBe(850);
  });

  it("parses therms usage", () => {
    const text = "Natural Gas: 45 therms";
    const result = parseBillText(text);
    expect(result.therms).toBe(45);
  });

  it("parses billing period dates", () => {
    const text = "Billing Period: 10/15/2025 - 11/14/2025";
    const result = parseBillText(text);
    expect(result.startDate).toBe("10/15/2025");
    expect(result.endDate).toBe("11/14/2025");
  });

  it("calibrates model with actual vs predicted", () => {
    const cal = calibrateModel(150, 140);
    expect(cal.variance).toBeCloseTo(7.1, 1);
    expect(cal.calibrationFactor).toBeCloseTo(1.07, 2);
    expect(cal.suggestion).toContain("good");
  });

  it("suggests adjustment when variance is high", () => {
    const cal = calibrateModel(180, 140);
    expect(cal.variance).toBeGreaterThan(10);
    expect(cal.suggestion).toContain("under-predicting");
  });

  // Test flexible "total" parsing
  it("finds total when word 'total' appears with number nearby", () => {
    const text = "Your total is $123.45 for this month";
    const result = parseBillText(text);
    expect(result.totalCost).toBe(123.45);
  });

  it("finds total when number appears before 'total'", () => {
    const text = "$145.50 Total";
    const result = parseBillText(text);
    expect(result.totalCost).toBe(145.5);
  });

  it("finds total with comma separators", () => {
    const text = "Total: $1,234.56";
    const result = parseBillText(text);
    expect(result.totalCost).toBe(1234.56);
  });

  it("finds total without dollar sign", () => {
    const text = "Total 145.50";
    const result = parseBillText(text);
    expect(result.totalCost).toBe(145.5);
  });

  it("finds total in messy text", () => {
    const text = "blah blah blah total amount 123.45 dollars";
    const result = parseBillText(text);
    expect(result.totalCost).toBe(123.45);
  });

  it("finds largest amount when no 'total' keyword found", () => {
    const text = "Service charge: $25.00, Usage: $120.50, Total: $145.50";
    const result = parseBillText(text);
    expect(result.totalCost).toBe(145.5);
  });

  it("handles real-world bill format", () => {
    const text = `
      ELECTRIC BILL
      Account: 123456789
      Service Period: 10/15/2025 - 11/14/2025
      
      Usage: 850 kWh
      Rate: $0.12/kWh
      
      Amount Due: $145.50
      Due Date: 12/05/2025
    `;
    const result = parseBillText(text);
    expect(result.totalCost).toBe(145.5);
    expect(result.kwh).toBe(850);
    expect(result.startDate).toBe("10/15/2025");
    expect(result.endDate).toBe("11/14/2025");
  });
});
