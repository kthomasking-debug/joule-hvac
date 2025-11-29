// commandExecutor.js
// Maps parsed thermostat intents to side effects and returns structured response
// NOTE: Currently uses localStorage as a mock persistence layer.

const STORAGE_KEY = "thermostatState";

function readState() {
  if (typeof window === "undefined")
    return { targetTemp: 70, mode: "heat", preset: "home" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { targetTemp: 70, mode: "heat", preset: "home" };
    const obj = JSON.parse(raw);
    return {
      targetTemp: typeof obj.targetTemp === "number" ? obj.targetTemp : 70,
      mode: obj.mode || "heat",
      preset: obj.preset || "home",
    };
  } catch {
    return { targetTemp: 70, mode: "heat", preset: "home" };
  }
}

function writeState(state) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function clampTemp(t) {
  return Math.min(Math.max(t, 45), 85);
}

import {
  recordPreferenceEvent,
  analyzePreferences,
} from "../learning/preferenceLearner";

function makeResponse(success, message, action, updates = {}, meta = {}) {
  return { success, message, action, updates, meta };
}

export function executeCommand(parsed) {
  if (!parsed || !parsed.intent)
    return makeResponse(false, "No command parsed", "none");
  const state = readState();
  const intent = parsed.intent;

  if (intent === "setTemperature") {
    const value = clampTemp(parsed.entities.value);
    state.targetTemp = value;
    writeState(state);

    // Also update userSettings for compatibility with existing code
    try {
      const userSettings = JSON.parse(
        localStorage.getItem("userSettings") || "{}"
      );
      userSettings.winterThermostat = value;
      localStorage.setItem("userSettings", JSON.stringify(userSettings));
    } catch (e) {
      console.warn("Failed to update userSettings:", e);
    }

    recordPreferenceEvent({ intent, updates: { targetTemp: value } });
    const prefs = analyzePreferences();
    return makeResponse(
      true,
      `Temperature set to ${value}°F.`,
      "setTemperature",
      { targetTemp: value },
      { suggestions: prefs.suggestions }
    );
  }
  if (intent === "increaseTemperature") {
    const delta = parsed.entities.value || 1;
    state.targetTemp = clampTemp(state.targetTemp + delta);
    writeState(state);
    recordPreferenceEvent({
      intent,
      updates: { targetTemp: state.targetTemp },
    });
    const prefs = analyzePreferences();
    return makeResponse(
      true,
      `Increasing temperature by ${delta}°F to ${state.targetTemp}°F.`,
      "increaseTemperature",
      { targetTemp: state.targetTemp },
      { suggestions: prefs.suggestions }
    );
  }
  if (intent === "decreaseTemperature") {
    const delta = parsed.entities.value || 1;
    state.targetTemp = clampTemp(state.targetTemp - delta);
    writeState(state);
    recordPreferenceEvent({
      intent,
      updates: { targetTemp: state.targetTemp },
    });
    const prefs = analyzePreferences();
    return makeResponse(
      true,
      `Lowering temperature by ${delta}°F to ${state.targetTemp}°F.`,
      "decreaseTemperature",
      { targetTemp: state.targetTemp },
      { suggestions: prefs.suggestions }
    );
  }
  if (intent === "setMode") {
    const mode = parsed.entities.mode;
    if (!["heat", "cool", "auto", "off"].includes(mode))
      return makeResponse(false, "Unsupported mode", "error");
    state.mode = mode;
    writeState(state);
    recordPreferenceEvent({ intent, updates: { mode } });
    const prefs = analyzePreferences();
    return makeResponse(
      true,
      `Switched to ${mode} mode.`,
      "setMode",
      { mode },
      { suggestions: prefs.suggestions }
    );
  }
  if (intent === "applyPreset") {
    const preset = parsed.entities.preset;
    if (!["sleep", "away", "home"].includes(preset))
      return makeResponse(false, "Unsupported preset", "error");
    state.preset = preset;
    // Optional default temperatures per preset
    if (preset === "sleep") state.targetTemp = clampTemp(state.targetTemp - 2);
    if (preset === "away") state.targetTemp = clampTemp(state.targetTemp - 4);
    if (preset === "home") state.targetTemp = clampTemp(state.targetTemp);
    writeState(state);
    recordPreferenceEvent({
      intent,
      updates: { preset: state.preset, targetTemp: state.targetTemp },
    });
    const prefs = analyzePreferences();
    return makeResponse(
      true,
      `Applied ${preset} preset${
        preset !== "home" ? `; target now ${state.targetTemp}°F.` : "."
      }`,
      "applyPreset",
      { preset: state.preset, targetTemp: state.targetTemp },
      { suggestions: prefs.suggestions }
    );
  }
  if (intent === "navigate") {
    const target = parsed.entities.target;
    const pathMap = {
      forecast: "/cost-forecaster",
      settings: "/settings",
      home: "/",
      dashboard: "/",
      cost: "/cost-comparison",
      energy: "/energy-flow",
      thermostat: "/thermostat-analyzer",
    };
    const path = pathMap[target] || "/";
    return makeResponse(true, `Opening ${target} page.`, "navigate", { path });
  }
  if (intent === "help") {
    return makeResponse(
      true,
      'You can say: "Set temperature to 70", "Increase temperature by 2", "Switch to cooling", "Apply sleep preset", or "Open forecast".',
      "help"
    );
  }

  return makeResponse(false, "Unknown command", "unknown");
}

export default executeCommand;
