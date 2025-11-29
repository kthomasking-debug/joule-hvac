import { describe, it, expect } from "vitest";
import { executeCommand } from "../commandExecutor";

// Simple isolation: mock localStorage
const store = {};
beforeEach(() => {
  global.localStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => {
      store[k] = v;
    },
    removeItem: (k) => {
      delete store[k];
    },
  };
  delete store.thermostatState;
});

describe("executeCommand", () => {
  it("sets temperature", () => {
    const res = executeCommand({
      intent: "setTemperature",
      entities: { value: 72 },
    });
    expect(res.success).toBe(true);
    expect(JSON.parse(store.thermostatState).targetTemp).toBe(72);
  });
  it("increases temperature", () => {
    store.thermostatState = JSON.stringify({
      targetTemp: 70,
      mode: "heat",
      preset: "home",
    });
    const res = executeCommand({
      intent: "increaseTemperature",
      entities: { value: 3 },
    });
    expect(res.updates.targetTemp).toBe(73);
  });
  it("decreases temperature", () => {
    store.thermostatState = JSON.stringify({
      targetTemp: 70,
      mode: "heat",
      preset: "home",
    });
    const res = executeCommand({
      intent: "decreaseTemperature",
      entities: { value: 2 },
    });
    expect(res.updates.targetTemp).toBe(68);
  });
  it("sets mode", () => {
    const res = executeCommand({
      intent: "setMode",
      entities: { mode: "cool" },
    });
    expect(res.updates.mode).toBe("cool");
  });
  it("applies preset sleep", () => {
    store.thermostatState = JSON.stringify({
      targetTemp: 70,
      mode: "heat",
      preset: "home",
    });
    const res = executeCommand({
      intent: "applyPreset",
      entities: { preset: "sleep" },
    });
    expect(res.updates.preset).toBe("sleep");
    expect(res.updates.targetTemp).toBe(68);
  });
  it("navigates", () => {
    const res = executeCommand({
      intent: "navigate",
      entities: { target: "forecast" },
    });
    expect(res.updates.path).toBe("/cost-forecaster");
  });
  it("help intent", () => {
    const res = executeCommand({ intent: "help", entities: {} });
    expect(res.action).toBe("help");
    expect(res.message).toMatch(/Set temperature/);
  });
  it("unknown intent", () => {
    const res = executeCommand({ intent: "other", entities: {} });
    expect(res.success).toBe(false);
  });
});
