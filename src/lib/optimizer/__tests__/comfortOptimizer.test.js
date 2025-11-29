import { describe, it, expect } from "vitest";
import { generateSchedule } from "../../optimizer/comfortOptimizer";

const settings = {
  winterThermostat: 70,
  summerThermostat: 74,
};

describe("comfortOptimizer.generateSchedule", () => {
  it("generates baseline blocks and night setback in heating mode by default", () => {
    const sched = generateSchedule(settings, null, []);
    expect(sched.mode).toBe("heating");
    const night = sched.blocks.find((b) =>
      b.rationale.includes("night_setback")
    );
    expect(night).toBeTruthy();
    expect(night.startHour).toBe(22);
    expect(night.endHour).toBe(5);
    expect(night.setpoint).toBeLessThanOrEqual(sched.baseSetpoint);
  });

  it("adds a morning prewarm block when recent winter bumps are present", () => {
    const now = new Date("2025-11-19T12:00:00Z");
    const events = [
      {
        kind: "winter",
        hour: 6,
        prev: 68,
        next: 70,
        ts: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        kind: "winter",
        hour: 7,
        prev: 69,
        next: 71,
        ts: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        kind: "winter",
        hour: 5,
        prev: 68,
        next: 70,
        ts: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
    const sched = generateSchedule(settings, null, events, now);
    const pre = sched.blocks.find((b) =>
      b.rationale.includes("morning_prewarm")
    );
    expect(pre).toBeTruthy();
    expect(pre.startHour).toBe(5);
    expect(pre.endHour).toBe(7);
    expect(pre.setpoint).toBeGreaterThan(sched.baseSetpoint);
  });

  it("computes cooling mode with hot forecast and clamps bounds", () => {
    const hotForecast = Array.from({ length: 24 }, () => ({
      time: new Date(),
      temp: 95,
    }));
    const sched = generateSchedule(settings, hotForecast, []);
    expect(sched.mode).toBe("cooling");
    // all setpoints should be within cooling safe bounds
    for (const b of sched.blocks) {
      expect(b.setpoint).toBeGreaterThanOrEqual(sched.bounds.min);
      expect(b.setpoint).toBeLessThanOrEqual(sched.bounds.max);
    }
  });
});
