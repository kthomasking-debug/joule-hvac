// src/utils/askJouleCommandHandlers.js
// Command handlers for AskJoule using config map pattern

import {
  getPersonalizedResponse,
  EDUCATIONAL_CONTENT,
  HELP_CONTENT,
} from "./askJouleContent";
import { NAVIGATION_SHORTCUTS, getRouteLabel } from "./routes";
import { setSetting } from "../lib/unifiedSettingsManager";
import {
  loadThermostatSettings,
  saveThermostatSettings,
} from "../lib/thermostatSettings";

/**
 * Configuration map for setting commands
 * Maps action names to their configuration for consistent handling
 */
export const SETTING_COMMANDS = {
  setWinterTemp: {
    key: "winterThermostat",
    label: "Winter thermostat",
    unit: "°F",
    useUnifiedManager: true,
  },
  setSummerTemp: {
    key: "summerThermostat",
    label: "Summer thermostat",
    unit: "°F",
    useUnifiedManager: true,
  },
  setHSPF: {
    key: "hspf2",
    label: "HSPF",
    unit: "",
    useUnifiedManager: true,
  },
  setSEER: {
    key: "efficiency",
    label: "SEER",
    unit: "",
    useUnifiedManager: true,
  },
  setHomeElevation: {
    key: "homeElevation",
    label: "Home elevation",
    unit: " ft",
    useUnifiedManager: true,
  },
  setUtilityCost: {
    key: "utilityCost",
    label: "Utility cost",
    unit: "/kWh",
    prefix: "$",
    useUnifiedManager: true,
  },
  setElectricRate: {
    key: "utilityCost",
    label: "Electric rate",
    unit: "/kWh",
    prefix: "$",
  },
  setGasRate: {
    key: "gasCost",
    label: "Gas rate",
    unit: "/therm",
    prefix: "$",
  },
  setSquareFeet: {
    key: "squareFeet",
    label: "Home size",
    unit: " sq ft",
  },
  setInsulationLevel: {
    key: "insulationLevel",
    label: "Insulation",
    unit: "",
    useRaw: true,
  },
  setCapacity: {
    key: "capacity",
    label: "Capacity",
    unit: "k BTU",
    alsoSet: ["coolingCapacity"],
  },
  setAFUE: {
    key: "afue",
    label: "AFUE",
    unit: "",
  },
  setCeilingHeight: {
    key: "ceilingHeight",
    label: "Ceiling height",
    unit: " ft",
  },
  setHomeShape: {
    key: "homeShape",
    label: "Home shape",
    unit: "",
  },
  setSolarExposure: {
    key: "solarExposure",
    label: "Solar exposure",
    unit: "",
  },
  setEnergyMode: {
    key: "energyMode",
    label: "Energy mode",
    unit: "",
  },
  setPrimarySystem: {
    key: "primarySystem",
    label: "Primary system",
    unit: "",
  },
  setGasCost: {
    key: "gasCost",
    label: "Gas cost",
    unit: "",
    prefix: "$",
  },
  setCoolingSystem: {
    key: "coolingSystem",
    label: "Cooling system",
    unit: "",
  },
  setCoolingCapacity: {
    key: "coolingCapacity",
    label: "Cooling capacity",
    unit: "k BTU",
  },
  setUseElectricAuxHeat: {
    key: "useElectricAuxHeat",
    label: "Electric aux heat",
    unit: "",
    isBoolean: true,
  },
  setUseDetailedAnnualEstimate: {
    key: "useDetailedAnnualEstimate",
    label: "Detailed annual estimate",
    unit: "",
    isBoolean: true,
  },
  setUseManualHeatLoss: {
    key: "useManualHeatLoss",
    label: "Use manual heat loss",
    unit: "",
    isBoolean: true,
    alsoDisable: ["useCalculatedHeatLoss", "useAnalyzerHeatLoss"],
  },
  setUseCalculatedHeatLoss: {
    key: "useCalculatedHeatLoss",
    label: "Use calculated heat loss",
    unit: "",
    isBoolean: true,
    alsoDisable: ["useManualHeatLoss", "useAnalyzerHeatLoss"],
  },
  setUseAnalyzerHeatLoss: {
    key: "useAnalyzerHeatLoss",
    label: "Use analyzer heat loss",
    unit: "",
    isBoolean: true,
    alsoDisable: ["useManualHeatLoss", "useCalculatedHeatLoss"],
  },
  setManualHeatLoss: {
    key: "manualHeatLoss",
    label: "Manual heat loss",
    unit: " BTU/hr/°F",
    useUnifiedManager: true,
  },
  setAnalyzerHeatLoss: {
    key: "analyzerHeatLoss",
    label: "Analyzer heat loss",
    unit: " BTU/hr/°F",
    useUnifiedManager: true,
  },
};

/**
 * Handle a setting command using the config map
 * @param {object} parsed - Parsed command object
 * @param {object} callbacks - Callback functions { onSettingChange, setOutput }
 * @returns {object|null} Result object or null if not a setting command
 */
export function handleSettingCommand(parsed, callbacks) {
  const config = SETTING_COMMANDS[parsed.action];
  if (!config) return null;

  const { onSettingChange, setOutput } = callbacks;
  const {
    key,
    label,
    unit,
    prefix = "",
    useUnifiedManager,
    useRaw,
    isBoolean,
    alsoSet,
    alsoDisable,
  } = config;

  // Determine the value to display
  const displayValue = useRaw && parsed.raw ? parsed.raw : parsed.value;
  const formattedValue = isBoolean
    ? parsed.value
      ? "enabled"
      : "disabled"
    : `${prefix}${displayValue}${unit}`;

  // Use unified settings manager if configured
  if (useUnifiedManager) {
    const result = setSetting(key, parsed.value, {
      source: "AskJoule",
      comment: `Set ${label.toLowerCase()} via Ask Joule`,
    });

    if (result.success) {
      // Also notify parent component if available
      if (onSettingChange) {
        onSettingChange(key, parsed.value, {
          source: "AskJoule",
          comment: `Set ${label.toLowerCase()} via Ask Joule`,
        });
      }
      setOutput({
        message: `✓ ${label} set to ${formattedValue}`,
        status: "success",
      });
    } else {
      setOutput({
        message: `❌ ${result.error || `Failed to set ${label.toLowerCase()}`}`,
        status: "error",
      });
    }
    return { handled: true };
  }

  // Standard handling via onSettingChange callback
  if (onSettingChange) {
    onSettingChange(key, parsed.value, {
      source: "AskJoule",
      comment: `Set ${label.toLowerCase()} via Ask Joule`,
    });

    // Handle additional settings (e.g., setCapacity also sets coolingCapacity)
    if (alsoSet) {
      alsoSet.forEach((additionalKey) => {
        onSettingChange(additionalKey, parsed.value, {
          source: "AskJoule",
          comment: `Set ${additionalKey} via Ask Joule`,
        });
      });
    }

    // Handle disabling other settings (for mutually exclusive options)
    if (alsoDisable) {
      alsoDisable.forEach((disableKey) => {
        onSettingChange(disableKey, false, {
          source: "AskJoule",
          comment: `Disabled ${disableKey} via Ask Joule (alsoDisable from ${key})`,
        });
      });
    }

    setOutput({
      message: `✓ ${label} set to ${formattedValue}`,
      status: "success",
    });
  } else {
    setOutput({
      message: `I would set ${label.toLowerCase()} to ${formattedValue}, but settings updates aren't connected.`,
      status: "error",
    });
  }

  return { handled: true };
}

/**
 * Handle temperature preset commands
 * @param {string} presetType - 'sleep' | 'away' | 'home'
 * @param {object} callbacks - { onSettingChange, setOutput, speak }
 * @returns {object} Result object
 */
export function handlePresetCommand(presetType, callbacks) {
  const { onSettingChange, setOutput, speak } = callbacks;

  const presets = {
    sleep: { temp: 65, action: "sleep", comment: "Sleep mode preset" },
    away: { temp: 60, action: "away", comment: "Away mode preset" },
    home: { temp: 70, action: "home", comment: "Home mode preset" },
  };

  const preset = presets[presetType];
  if (!preset) return { handled: false };

  if (onSettingChange) {
    onSettingChange("winterThermostat", preset.temp, {
      source: "AskJoule",
      comment: preset.comment,
    });
    const response = getPersonalizedResponse(preset.action, {
      temp: preset.temp,
    });
    setOutput({ message: response, status: "success" });
    if (speak) speak(response);
  }

  return { handled: true };
}

/**
 * Handle temperature adjustment commands
 * @param {string} direction - 'up' | 'down'
 * @param {number} delta - Amount to adjust
 * @param {number} currentTemp - Current temperature
 * @param {object} callbacks - { onSettingChange, setOutput, speak }
 * @returns {object} Result object
 */
export function handleTempAdjustment(direction, delta, currentTemp, callbacks) {
  const { onSettingChange, setOutput, speak } = callbacks;

  const newTemp =
    direction === "up" ? currentTemp + delta : currentTemp - delta;
  const action = direction === "up" ? "tempUp" : "tempDown";

  if (onSettingChange) {
    onSettingChange("winterThermostat", newTemp, {
      source: "AskJoule",
      comment: `${direction === "up" ? "Increased" : "Decreased"} by ${delta}°`,
    });
    const response = getPersonalizedResponse(action, { temp: newTemp, delta });
    setOutput({ message: response, status: "success" });
    if (speak) speak(response);
  }

  return { handled: true, newTemp };
}

/**
 * Handle navigation commands
 * @param {object} parsed - Parsed command with target
 * @param {object} callbacks - { navigate, onNavigate, setOutput, speak }
 * @returns {object} Result object
 */
export function handleNavigationCommand(parsed, callbacks) {
  const { navigate, onNavigate, setOutput, speak } = callbacks;

  // Store city for forecast page if provided
  if (parsed.cityName) {
    try {
      localStorage.setItem("askJoule_targetCity", parsed.cityName);
    } catch {
      // ignore storage errors
    }
  }

  const path = NAVIGATION_SHORTCUTS[parsed.target];
  const label = path ? getRouteLabel(path) : null;

  if (path) {
    if (onNavigate) {
      onNavigate(path);
    } else if (navigate) {
      navigate(path);
    }
    setOutput({ message: `Opening ${label}...`, status: "success" });
    if (speak) speak(`Opening ${label}`);
    return { handled: true, navigated: true, path };
  }

  setOutput({ message: "Navigation target not recognized.", status: "error" });
  return { handled: true, navigated: false };
}

/**
 * Handle educational content commands
 * @param {string} topic - Topic to explain
 * @param {object} callbacks - { setOutput }
 * @returns {object} Result object
 */
export function handleEducationalCommand(topic, callbacks) {
  const { setOutput } = callbacks;

  // Normalize topic name
  const normalizedTopic = topic.toLowerCase().replace(/[\s-_]/g, "");
  const content =
    EDUCATIONAL_CONTENT[normalizedTopic] || EDUCATIONAL_CONTENT[topic];

  if (content) {
    setOutput({ message: `ℹ️ ${content}`, status: "info" });
    return { handled: true, found: true };
  }

  const availableTopics = Object.keys(EDUCATIONAL_CONTENT).join(", ");
  setOutput({
    message: `I don't have info on that topic yet. Try: ${availableTopics}.`,
    status: "info",
  });
  return { handled: true, found: false };
}

/**
 * Handle help command
 * @param {object} callbacks - { setOutput, speak }
 * @returns {object} Result object
 */
export function handleHelpCommand(callbacks) {
  const { setOutput, speak } = callbacks;

  setOutput({ message: HELP_CONTENT, status: "info" });
  if (speak) {
    speak("I can navigate to any tool, answer questions, or change settings.");
  }

  return { handled: true };
}

/**
 * Handle dark mode toggle
 * @param {object} parsed - Parsed command
 * @param {object} callbacks - { setOutput, speak }
 * @returns {object} Result object
 */
export function handleDarkModeCommand(parsed, callbacks) {
  const { setOutput, speak } = callbacks;

  try {
    const currentDarkMode = document.documentElement.classList.contains("dark");
    const newDarkMode =
      parsed.action === "toggleDarkMode" ? !currentDarkMode : parsed.value;

    // Update DOM
    if (newDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Update localStorage
    localStorage.setItem("darkMode", JSON.stringify(newDarkMode));

    // Dispatch custom event
    window.dispatchEvent(
      new CustomEvent("separateSettingUpdated", {
        detail: { key: "darkMode", value: newDarkMode },
      })
    );

    setOutput({
      message: `✓ Switched to ${newDarkMode ? "dark" : "light"} mode`,
      status: "success",
    });
    if (speak) speak(`Switched to ${newDarkMode ? "dark" : "light"} mode`);

    return { handled: true, darkMode: newDarkMode };
  } catch (error) {
    setOutput({
      message: `Failed to change theme: ${error.message}`,
      status: "error",
    });
    return { handled: true, error: error.message };
  }
}

/**
 * Handle thermostat-specific settings (compressor runtime, sleep time, etc.)
 * @param {object} parsed - Parsed command
 * @param {object} callbacks - { onSettingChange, setOutput, speak }
 * @returns {object} Result object
 */
export function handleThermostatSettingCommand(parsed, callbacks) {
  const { onSettingChange, setOutput, speak } = callbacks;

  switch (parsed.action) {
    case "setCompressorMinRuntime": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.thresholds.compressorMinCycleOff;
        settings.thresholds.compressorMinCycleOff = parsed.value;
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange(
            "thermostat.thresholds.compressorMinCycleOff",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set compressor min runtime via Ask Joule",
              oldValue,
            }
          );
        }

        const minutes = Math.round(parsed.value / 60);
        setOutput({
          message: `✓ Compressor minimum runtime set to ${minutes} minutes (${parsed.value} seconds)`,
          status: "success",
        });
        if (speak)
          speak(`Compressor minimum runtime set to ${minutes} minutes`);
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set compressor runtime: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setHeatDifferential": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.thresholds.heatDifferential;
        settings.thresholds.heatDifferential = parsed.value;
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange(
            "thermostat.thresholds.heatDifferential",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set heat differential via Ask Joule",
              oldValue,
            }
          );
        }

        setOutput({
          message: `✓ Heat Differential set to ${parsed.value}°F`,
          status: "success",
        });
        if (speak) speak(`Heat Differential set to ${parsed.value} degrees`);
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set heat differential: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setCoolDifferential": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.thresholds.coolDifferential;
        settings.thresholds.coolDifferential = parsed.value;
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange(
            "thermostat.thresholds.coolDifferential",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set cool differential via Ask Joule",
              oldValue,
            }
          );
        }

        setOutput({
          message: `✓ Cool Differential set to ${parsed.value}°F`,
          status: "success",
        });
        if (speak) speak(`Cool Differential set to ${parsed.value} degrees`);
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set cool differential: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setSleepModeStartTime":
    case "setNighttimeStartTime": {
      try {
        const settings = loadThermostatSettings();

        // Get old sleep times for audit log
        const oldTimes = [];
        for (let day = 0; day < 7; day++) {
          const daySchedule = settings.schedule.weekly[day] || [];
          const sleepEntry = daySchedule.find(
            (e) => e.comfortSetting === "sleep"
          );
          oldTimes.push(sleepEntry?.time || "22:00");
        }

        // Update sleep mode start time for all days
        for (let day = 0; day < 7; day++) {
          const daySchedule = settings.schedule.weekly[day] || [];
          const sleepIndex = daySchedule.findIndex(
            (entry) => entry.comfortSetting === "sleep"
          );
          if (sleepIndex >= 0) {
            daySchedule[sleepIndex].time = parsed.value;
          } else {
            daySchedule.push({
              time: parsed.value,
              comfortSetting: "sleep",
            });
            daySchedule.sort((a, b) => a.time.localeCompare(b.time));
          }
          settings.schedule.weekly[day] = daySchedule;
        }

        saveThermostatSettings(settings);

        // Dispatch event to notify components
        window.dispatchEvent(
          new CustomEvent("thermostatSettingsUpdated", {
            detail: { comfortSettings: { sleep: { time: parsed.value } } },
          })
        );

        if (onSettingChange) {
          onSettingChange(
            "thermostat.schedule.sleepModeStartTime",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set sleep mode start time via Ask Joule",
              oldValue: oldTimes[0],
            }
          );
        }

        // Format time for display
        const [hours, minutes] = parsed.value.split(":").map(Number);
        const displayTime =
          hours > 12
            ? `${hours - 12}:${String(minutes).padStart(2, "0")} PM`
            : hours === 12
            ? `12:${String(minutes).padStart(2, "0")} PM`
            : hours === 0
            ? `12:${String(minutes).padStart(2, "0")} AM`
            : `${hours}:${String(minutes).padStart(2, "0")} AM`;

        setOutput({
          message: `✓ Nighttime start time set to ${displayTime} for all days`,
          status: "success",
        });
        if (speak) speak(`Nighttime start time set to ${displayTime}`);
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set nighttime start time: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setDaytimeStartTime":
    case "setWakeTime": {
      try {
        const settings = loadThermostatSettings();

        // Get old home times for audit log
        const oldTimes = [];
        for (let day = 0; day < 7; day++) {
          const daySchedule = settings.schedule.weekly[day] || [];
          const homeEntry = daySchedule.find(
            (e) => e.comfortSetting === "home"
          );
          oldTimes.push(homeEntry?.time || "06:00");
        }

        // Update daytime start time for all days
        for (let day = 0; day < 7; day++) {
          const daySchedule = settings.schedule.weekly[day] || [];
          const homeIndex = daySchedule.findIndex(
            (entry) => entry.comfortSetting === "home"
          );
          if (homeIndex >= 0) {
            daySchedule[homeIndex].time = parsed.value;
          } else {
            daySchedule.push({
              time: parsed.value,
              comfortSetting: "home",
            });
            daySchedule.sort((a, b) => a.time.localeCompare(b.time));
          }
          settings.schedule.weekly[day] = daySchedule;
        }

        saveThermostatSettings(settings);

        // Dispatch event to notify components
        window.dispatchEvent(
          new CustomEvent("thermostatSettingsUpdated", {
            detail: { comfortSettings: { home: { time: parsed.value } } },
          })
        );

        if (onSettingChange) {
          onSettingChange(
            "thermostat.schedule.daytimeStartTime",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set daytime start time via Ask Joule",
              oldValue: oldTimes[0],
            }
          );
        }

        // Format time for display
        const [hours, minutes] = parsed.value.split(":").map(Number);
        const displayTime =
          hours > 12
            ? `${hours - 12}:${String(minutes).padStart(2, "0")} PM`
            : hours === 12
            ? `12:${String(minutes).padStart(2, "0")} PM`
            : hours === 0
            ? `12:${String(minutes).padStart(2, "0")} AM`
            : `${hours}:${String(minutes).padStart(2, "0")} AM`;

        setOutput({
          message: `✓ Daytime start time set to ${displayTime} for all days`,
          status: "success",
        });
        if (speak) speak(`Daytime start time set to ${displayTime}`);
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set daytime start time: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setDaytimeTemperature":
    case "setHomeTemperature": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.comfortSettings?.home?.heatSetPoint || 70;
        settings.comfortSettings.home.heatSetPoint = parsed.value;
        saveThermostatSettings(settings);

        // Dispatch event to notify components
        window.dispatchEvent(
          new CustomEvent("thermostatSettingsUpdated", {
            detail: {
              comfortSettings: { home: { heatSetPoint: parsed.value } },
            },
          })
        );

        if (onSettingChange) {
          onSettingChange(
            "thermostat.comfortSettings.home.heatSetPoint",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set daytime temperature via Ask Joule",
              oldValue,
            }
          );
        }

        setOutput({
          message: `✓ Daytime temperature set to ${parsed.value}°F`,
          status: "success",
        });
        if (speak) speak(`Daytime temperature set to ${parsed.value} degrees`);
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set daytime temperature: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setNighttimeTemperature":
    case "setSleepTemperature": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.comfortSettings?.sleep?.heatSetPoint || 65;
        settings.comfortSettings.sleep.heatSetPoint = parsed.value;
        saveThermostatSettings(settings);

        // Dispatch event to notify components
        window.dispatchEvent(
          new CustomEvent("thermostatSettingsUpdated", {
            detail: {
              comfortSettings: { sleep: { heatSetPoint: parsed.value } },
            },
          })
        );

        if (onSettingChange) {
          onSettingChange(
            "thermostat.comfortSettings.sleep.heatSetPoint",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set nighttime temperature via Ask Joule",
              oldValue,
            }
          );
        }

        setOutput({
          message: `✓ Nighttime temperature set to ${parsed.value}°F`,
          status: "success",
        });
        if (speak)
          speak(`Nighttime temperature set to ${parsed.value} degrees`);
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set nighttime temperature: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    default:
      return { handled: false };
  }
}

/**
 * Handle advanced settings commands (Groq API key, model, voice duration)
 * These are stored in localStorage, not userSettings
 * @param {object} parsed - Parsed command
 * @param {object} callbacks - { setOutput, speak }
 * @returns {object} Result object
 */
export function handleAdvancedSettingsCommand(parsed, callbacks) {
  const { setOutput, speak } = callbacks;

  switch (parsed.action) {
    case "setGroqApiKey": {
      try {
        const apiKey = parsed.value;
        if (!apiKey || !apiKey.startsWith("gsk_")) {
          setOutput({
            message: "❌ Invalid Groq API key format. Must start with 'gsk_'",
            status: "error",
          });
          return { handled: true, error: "Invalid API key format" };
        }
        localStorage.setItem("groqApiKey", apiKey);
        // Trigger storage event for other components
        window.dispatchEvent(new Event("storage"));
        setOutput({
          message: "✓ Groq API key updated successfully",
          status: "success",
        });
        if (speak) speak("Groq API key updated");
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set Groq API key: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setGroqModel": {
      try {
        const model = parsed.value;
        localStorage.setItem("groqModel", model);
        // Trigger storage event for other components
        window.dispatchEvent(new Event("storage"));
        setOutput({
          message: `✓ Groq model set to ${model}`,
          status: "success",
        });
        if (speak) speak(`Groq model set to ${model}`);
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set Groq model: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setVoiceListenDuration": {
      try {
        const seconds = Math.max(2, Math.min(30, Number(parsed.value)));
        localStorage.setItem("askJouleListenSeconds", String(seconds));
        // Trigger storage event for other components
        window.dispatchEvent(new Event("askJouleListenSecondsChanged"));
        setOutput({
          message: `✓ Voice listening duration set to ${seconds} seconds`,
          status: "success",
        });
        if (speak) speak(`Voice listening duration set to ${seconds} seconds`);
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set voice listening duration: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "queryGroqApiKey": {
      try {
        const apiKey = localStorage.getItem("groqApiKey");
        if (apiKey) {
          // Show only first 8 and last 4 characters for security
          const masked = `${apiKey.substring(0, 8)}...${apiKey.substring(
            apiKey.length - 4
          )}`;
          setOutput({
            message: `✓ Groq API key is configured: ${masked}`,
            status: "info",
          });
        } else {
          setOutput({
            message:
              "ℹ️ No Groq API key configured. Add one in Settings to enable AI features.",
            status: "info",
          });
        }
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to read Groq API key: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "queryGroqModel": {
      try {
        const model =
          localStorage.getItem("groqModel") || "llama-3.3-70b-versatile";
        setOutput({
          message: `✓ Current Groq model: ${model}`,
          status: "info",
        });
        if (speak) speak(`Current Groq model is ${model}`);
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to read Groq model: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "queryVoiceListenDuration": {
      try {
        const seconds = localStorage.getItem("askJouleListenSeconds") || "5";
        setOutput({
          message: `✓ Voice listening duration: ${seconds} seconds`,
          status: "info",
        });
        if (speak) speak(`Voice listening duration is ${seconds} seconds`);
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to read voice listening duration: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    default:
      return { handled: false };
  }
}

/**
 * Handle diagnostic commands (show diagnostics, check short cycling, etc.)
 * @param {object} parsed - Parsed command
 * @param {object} callbacks - { setOutput, speak }
 * @returns {object} Result object
 */
export function handleDiagnosticCommand(parsed, callbacks) {
  const { setOutput, speak } = callbacks;

  switch (parsed.action) {
    case "showDiagnostics": {
      try {
        const diagnostics = JSON.parse(
          localStorage.getItem("spa_diagnostics") || "null"
        );
        if (
          !diagnostics ||
          !diagnostics.issues ||
          diagnostics.issues.length === 0
        ) {
          setOutput({
            message:
              "✅ No system issues detected. Upload thermostat data in the Performance Analyzer to check your system.",
            status: "info",
          });
          if (speak) speak("No system issues detected");
        } else {
          const summary = diagnostics.summary;
          const issueList = diagnostics.issues
            .slice(0, 3)
            .map((i) => `• ${i.description}`)
            .join("\n");
          const more =
            diagnostics.issues.length > 3
              ? `\n... and ${diagnostics.issues.length - 3} more issues`
              : "";
          setOutput({
            message: `⚠️ **System Diagnostics**\n\nFound ${summary.totalIssues} issue(s):\n${issueList}${more}\n\nView Performance Analyzer for details.`,
            status: "warning",
          });
          if (speak) {
            speak(
              `Found ${summary.totalIssues} system issues. Check the performance analyzer for details.`
            );
          }
        }
        return { handled: true };
      } catch {
        setOutput({
          message:
            "No diagnostic data available. Upload thermostat CSV in Performance Analyzer first.",
          status: "info",
        });
        return { handled: true };
      }
    }

    case "checkShortCycling": {
      try {
        const diagnostics = JSON.parse(
          localStorage.getItem("spa_diagnostics") || "null"
        );
        const shortCycling = diagnostics?.issues?.find(
          (i) => i.type === "short_cycling"
        );
        if (shortCycling) {
          setOutput({
            message: `⚠️ ${shortCycling.description}\n\nShort cycling reduces efficiency and can damage your compressor. Consider checking: refrigerant levels, thermostat placement, or filter cleanliness.`,
            status: "warning",
          });
          if (speak)
            speak("Short cycling detected. This can damage your compressor.");
        } else {
          setOutput({
            message: "✅ No short cycling detected in your thermostat data.",
            status: "success",
          });
          if (speak) speak("No short cycling detected");
        }
        return { handled: true };
      } catch {
        setOutput({
          message:
            "Upload thermostat CSV data in Performance Analyzer to check for short cycling.",
          status: "info",
        });
        return { handled: true };
      }
    }

    case "checkAuxHeat": {
      try {
        const diagnostics = JSON.parse(
          localStorage.getItem("spa_diagnostics") || "null"
        );
        const auxHeat = diagnostics?.issues?.find(
          (i) => i.type === "excessive_aux_heat"
        );
        if (auxHeat) {
          setOutput({
            message: `⚠️ ${auxHeat.description}\n\nAux heat (${auxHeat.details?.auxPercentage}% of runtime) is expensive! Check your balance point setting or thermostat configuration.`,
            status: "warning",
          });
          if (speak) speak("Excessive auxiliary heat usage detected");
        } else {
          setOutput({
            message: "✅ Auxiliary heat usage is within normal range.",
            status: "success",
          });
          if (speak) speak("Auxiliary heat usage is normal");
        }
        return { handled: true };
      } catch {
        setOutput({
          message: "Upload thermostat data to analyze aux heat usage.",
          status: "info",
        });
        return { handled: true };
      }
    }

    case "checkTempStability": {
      try {
        const diagnostics = JSON.parse(
          localStorage.getItem("spa_diagnostics") || "null"
        );
        const tempStability = diagnostics?.issues?.find(
          (i) => i.type === "temperature_instability"
        );
        if (tempStability) {
          setOutput({
            message: `⚠️ ${tempStability.description}\n\nLarge temperature swings may indicate thermostat issues, poor insulation, or undersized equipment.`,
            status: "warning",
          });
          if (speak) speak("Temperature instability detected");
        } else {
          setOutput({
            message: "✅ Indoor temperature stability looks good.",
            status: "success",
          });
          if (speak) speak("Temperature stability is normal");
        }
        return { handled: true };
      } catch {
        setOutput({
          message: "Upload thermostat data to analyze temperature stability.",
          status: "info",
        });
        return { handled: true };
      }
    }

    case "showCsvInfo": {
      try {
        const filename = localStorage.getItem("spa_filename");
        const timestamp = localStorage.getItem("spa_uploadTimestamp");
        const data = JSON.parse(
          localStorage.getItem("spa_parsedCsvData") || "null"
        );
        if (data && data.length > 0) {
          const uploaded = timestamp
            ? new Date(timestamp).toLocaleDateString()
            : "recently";
          setOutput({
            message: `📊 **Thermostat Data**\n\nFile: ${
              filename || "thermostat-data.csv"
            }\nUploaded: ${uploaded}\nData points: ${
              data.length
            }\n\nAsk me about problems, short cycling, or aux heat usage!`,
            status: "info",
          });
          if (speak)
            speak(
              `You have ${data.length} data points uploaded on ${uploaded}`
            );
        } else {
          setOutput({
            message:
              "No thermostat data uploaded yet. Visit Performance Analyzer to upload CSV data.",
            status: "info",
          });
        }
        return { handled: true };
      } catch {
        setOutput({
          message: "No CSV data found. Upload in Performance Analyzer first.",
          status: "info",
        });
        return { handled: true };
      }
    }

    default:
      return { handled: false };
  }
}
