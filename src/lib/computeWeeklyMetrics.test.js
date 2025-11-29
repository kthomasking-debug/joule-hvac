import { describe, it, expect } from "vitest";
import { computeWeeklyMetrics } from "./heatUtils";

function makeHour(dateStr, temp = 30, humidity = 50) {
  return { time: new Date(dateStr), temp, humidity };
}

describe("computeWeeklyMetrics", () => {
  it("calculates minIndoorTemp as setpoint when aux runs", () => {
    const forecast = [
      makeHour("2025-11-07T00:00:00"),
      makeHour("2025-11-07T01:00:00"),
    ];
    // perf: aux runs on both hours
    const perf = () => ({
      electricalKw: 1,
      runtime: 50,
      actualIndoorTemp: 60,
      auxKw: 1,
    });
    const res = computeWeeklyMetrics(forecast, perf, 0.2, 70);
    expect(res).toBeTruthy();
    const day = res.summary[0];
    expect(day.minIndoorTemp).toBe(70);
    expect(day.minNoAuxIndoorTemp).toBe(60);
  });

  it("calculates minIndoorTemp lower when aux does not run", () => {
    const forecast = [
      makeHour("2025-11-07T00:00:00"),
      makeHour("2025-11-07T01:00:00"),
    ];
    // perf: aux never runs
    const perf = () => ({
      electricalKw: 1,
      runtime: 100,
      actualIndoorTemp: 62,
      auxKw: 0,
    });
    const res = computeWeeklyMetrics(forecast, perf, 0.2, 70);
    const day = res.summary[0];
    expect(day.minIndoorTemp).toBe(62);
    expect(day.minNoAuxIndoorTemp).toBe(62);
  });
});
