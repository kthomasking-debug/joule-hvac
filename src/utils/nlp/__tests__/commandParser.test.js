import { describe, it, expect } from "vitest";
import { parseThermostatCommand } from "../commandParser";

describe("parseThermostatCommand", () => {
  it("parses set temperature explicit", () => {
    const r = parseThermostatCommand("Set temperature to 72");
    expect(r.intent).toBe("setTemperature");
    expect(r.entities.value).toBe(72);
    expect(r.confidence).toBeGreaterThan(0.8);
  });
  it("parses increase temperature", () => {
    const r = parseThermostatCommand("Make it warmer by 3");
    expect(r.intent).toBe("increaseTemperature");
    expect(r.entities.value).toBe(3);
  });
  it("parses decrease temperature default 1", () => {
    const r = parseThermostatCommand("Make it cooler");
    expect(r.intent).toBe("decreaseTemperature");
    expect(r.entities.value).toBe(1);
  });
  it("parses mode", () => {
    const r = parseThermostatCommand("Switch to cooling mode");
    expect(r.intent).toBe("setMode");
    expect(r.entities.mode).toBe("cool");
  });
  it("parses preset", () => {
    const r = parseThermostatCommand("activate sleep preset");
    expect(r.intent).toBe("applyPreset");
    expect(r.entities.preset).toBe("sleep");
  });
  it("parses navigation", () => {
    const r = parseThermostatCommand("open forecast");
    expect(r.intent).toBe("navigate");
    expect(r.entities.target).toBe("forecast");
  });
  it("parses help", () => {
    const r = parseThermostatCommand("help");
    expect(r.intent).toBe("help");
  });
  it("returns unknown", () => {
    const r = parseThermostatCommand("Tell me a joke");
    expect(r.intent).toBe("unknown");
    expect(r.confidence).toBe(0);
  });
});
