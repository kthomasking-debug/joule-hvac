import { describe, it, expect } from "vitest";
import { computeRoi } from "./roiUtils";

describe("ROI Utilities", () => {
  it("calculates payback period correctly", () => {
    const { payback } = computeRoi(8000, 400, 10, 0.05);
    expect(payback).toBeCloseTo(20, 5);
  });

  it("handles negative or zero savings with infinite payback", () => {
    const r1 = computeRoi(8000, -50, 10, 0.05);
    expect(r1.payback).toBe(Infinity);
    const r2 = computeRoi(8000, 0, 10, 0.05);
    expect(r2.payback).toBe(Infinity);
  });

  it("calculates 10-year NPV with discount rate", () => {
    const { npv } = computeRoi(8000, 500, 10, 0.03);
    // Present value of 500 for 10 years at 3% minus 8000
    // PV annuity factor ~ 8.5302 => PV ~ 4265.1, NPV ~ -3734.9
    expect(npv).toBeCloseTo(-3735, 0);
  });

  it("computes 10-year simple ROI (undiscounted)", () => {
    const { roi10 } = computeRoi(8000, 1000, 10, 0.05);
    // 10*1000 - 8000 = 2000
    expect(roi10).toBe(2000);
  });
});
