import { describe, it, expect } from "vitest";
import {
  detectShortCycling,
  detectExcessiveAuxHeat,
  detectTemperatureInstability,
  detectInefficientRuntime,
  analyzeThermostatIssues,
} from "../thermostatDiagnostics.js";

function makeRow({
  Date = "2025-01-01",
  Time = "00:00:00",
  outdoor = 30,
  indoor = 70,
  heat = 300,
  aux = 0,
}) {
  return {
    Date,
    Time,
    "Outdoor Temp (F)": outdoor,
    "Thermostat Temperature (F)": indoor,
    "Heat Stage 1 (sec)": heat,
    "Aux Heat 1 (sec)": aux,
  };
}

describe("thermostatDiagnostics", () => {
  it("detects short cycling severity medium", () => {
    // 6 cycles within ~60 minutes (rows 0-12 with 5-min increments)
    const data = [];
    for (let i = 0; i < 12; i++) {
      const isOn = i % 2 === 0; // alternating on/off
      data.push(
        makeRow({
          Time: `00:${String(i * 5).padStart(2, "0")}:00`,
          heat: isOn ? 120 : 0,
        })
      );
    }
    const res = detectShortCycling(data);
    expect(res.hasIssue).toBe(true);
    expect(res.severity).toBe("medium");
  });

  it("flags excessive aux heat above 35F", () => {
    const data = [
      makeRow({ outdoor: 40, heat: 300, aux: 200 }),
      makeRow({ outdoor: 42, heat: 250, aux: 250 }),
      makeRow({ outdoor: 33, heat: 300, aux: 0 }),
    ];
    const res = detectExcessiveAuxHeat(data);
    expect(res.hasIssue).toBe(true);
    expect(["high", "medium"]).toContain(res.severity);
    expect(res.description).toMatch(/Auxiliary heat/);
  });

  it("detects temperature instability", () => {
    const data = [];
    for (let i = 0; i < 13; i++) {
      // >12 rows so window loop executes
      data.push(
        makeRow({
          Time: `01:${String(i * 5).padStart(2, "0")}:00`,
          indoor: i < 6 ? 70 : 66,
        })
      );
    }
    const res = detectTemperatureInstability(data);
    expect(res.hasIssue).toBe(true);
    expect(["medium", "high"]).toContain(res.severity);
  });

  it("detects inefficient runtime due to short cycles", () => {
    const data = [];
    // 10 cycles, 6 short (<180s)
    for (let i = 0; i < 40; i++) {
      const heat = i % 4 === 0 ? 100 : 0; // short cycles
      data.push(
        makeRow({ Time: `02:${String(i * 5).padStart(2, "0")}:00`, heat })
      );
    }
    const res = detectInefficientRuntime(data);
    expect(res.hasIssue).toBe(true);
    expect(["medium", "high"]).toContain(res.severity);
  });

  it("aggregates issues with analyzeThermostatIssues", () => {
    const data = [];
    for (let i = 0; i < 24; i++) {
      // 2 hours
      const heat = i % 2 === 0 ? 140 : 0; // cycling
      const aux = i === 5 ? 250 : 0; // one aux event mild weather
      const indoor = i < 12 ? 70 : 66; // swing
      const outdoor = i === 5 ? 40 : 30;
      data.push(
        makeRow({
          Time: `03:${String(i * 5).padStart(2, "0")}:00`,
          heat,
          aux,
          indoor,
          outdoor,
        })
      );
    }
    const res = analyzeThermostatIssues(data);
    expect(res.issues.length).toBeGreaterThan(0);
    const types = res.issues.map((i) => i.type);
    expect(types).toContain("short_cycling");
  });
});
