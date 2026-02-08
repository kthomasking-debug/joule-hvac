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
  setWinterThermostat: {
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
  setSummerThermostat: {
    key: "summerThermostat",
    label: "Summer thermostat",
    unit: "°F",
    useUnifiedManager: true,
  },
  setWinterThermostatNight: {
    key: "winterThermostatNight",
    label: "Winter thermostat (night)",
    unit: "°F",
    useUnifiedManager: true,
  },
  setSummerThermostatNight: {
    key: "summerThermostatNight",
    label: "Summer thermostat (night)",
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
    alsoDisable: ["useCalculatedHeatLoss", "useAnalyzerHeatLoss", "useLearnedHeatLoss"],
  },
  setUseCalculatedHeatLoss: {
    key: "useCalculatedHeatLoss",
    label: "Use calculated heat loss",
    unit: "",
    isBoolean: true,
    alsoDisable: ["useManualHeatLoss", "useAnalyzerHeatLoss", "useLearnedHeatLoss"],
  },
  setUseAnalyzerHeatLoss: {
    key: "useAnalyzerHeatLoss",
    label: "Use analyzer heat loss",
    unit: "",
    isBoolean: true,
    alsoDisable: ["useManualHeatLoss", "useCalculatedHeatLoss", "useLearnedHeatLoss"],
  },
  setUseLearnedHeatLoss: {
    key: "useLearnedHeatLoss",
    label: "Use bill-learned heat loss",
    unit: "",
    isBoolean: true,
    alsoDisable: ["useManualHeatLoss", "useCalculatedHeatLoss", "useAnalyzerHeatLoss"],
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
  if (!config) {
    if (import.meta.env.DEV) {
      console.warn("[handleSettingCommand] No config found for action:", parsed.action, "Available actions:", Object.keys(SETTING_COMMANDS));
    }
    return null;
  }
  
  if (import.meta.env.DEV) {
    console.log("[handleSettingCommand] Handling action:", parsed.action, "with value:", parsed.value, "config:", config);
  }

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
    // Ensure value is a number for temperature settings
    const valueToSet = typeof parsed.value === 'number' ? parsed.value : Number(parsed.value);
    if (isNaN(valueToSet)) {
      if (import.meta.env.DEV) {
        console.error("[handleSettingCommand] Invalid value for", key, ":", parsed.value);
      }
      callbacks.setOutput({
        message: `❌ Invalid value: ${parsed.value}. Please provide a number.`,
        status: "error",
      });
      return { handled: true };
    }
    
    const result = setSetting(key, valueToSet, {
      source: "AskJoule",
      comment: `Set ${label.toLowerCase()} via Ask Joule`,
    });
    
    if (import.meta.env.DEV) {
      console.log("[handleSettingCommand] setSetting result:", result);
    }

    if (result.success) {
      // Dispatch custom events for thermostat control page updates
      if (key === "winterThermostat" || key === "summerThermostat") {
        // Try to call thermostat API directly if available (like we do for setMode)
        if (typeof window !== "undefined" && window.activeIntegration) {
          const integration = window.activeIntegration;
          if (integration && typeof integration.setTemperature === "function") {
            // Determine heat and cool temps based on current mode and key
            const currentMode = localStorage.getItem("hvacMode") || "heat";
            const heatTemp =
              key === "winterThermostat" ||
              currentMode === "heat" ||
              currentMode === "auto"
                ? parsed.value
                : integration.targetHeatTemp || parsed.value;
            const coolTemp =
              key === "summerThermostat" ||
              currentMode === "cool" ||
              currentMode === "auto"
                ? parsed.value
                : integration.targetCoolTemp || parsed.value;

            integration
              .setTemperature(heatTemp, coolTemp)
              .then(() => {
                if (import.meta.env.DEV) {
                  console.log(
                    "[AskJoule] Successfully called thermostat API to set temperature:",
                    parsed.value
                  );
                }
              })
              .catch((apiError) => {
                console.warn(
                  "[AskJoule] Failed to call thermostat API directly:",
                  apiError
                );
                // Continue with event dispatch as fallback
              });
          }
        }

        // Update thermostatState in localStorage for Home.jsx display
        try {
          const currentState = JSON.parse(
            localStorage.getItem("thermostatState") ||
              '{"targetTemp": 70, "mode": "heat", "preset": "home"}'
          );
          currentState.targetTemp = valueToSet;
          localStorage.setItem("thermostatState", JSON.stringify(currentState));
          if (import.meta.env.DEV) {
            console.log(
              "[AskJoule] Updated thermostatState.targetTemp to:",
              valueToSet
            );
          }
        } catch (error) {
          console.warn("[AskJoule] Failed to update thermostatState:", error);
        }

        // Dispatch event with both 'temp' and 'temperature' for compatibility
        if (import.meta.env.DEV) {
          console.log("[AskJoule] Dispatching targetTempChanged event:", {
            temp: valueToSet,
            temperature: valueToSet,
            source: "AskJoule",
            key,
          });
        }
        window.dispatchEvent(
          new CustomEvent("targetTempChanged", {
            detail: {
              temp: valueToSet,
              temperature: valueToSet,
              source: "AskJoule",
              key,
            },
          })
        );
      }

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
      if (import.meta.env.DEV) {
        console.log("[handleSettingCommand] Successfully set", key, "to", valueToSet);
      }
    } else {
      setOutput({
        message: `❌ ${result.error || `Failed to set ${label.toLowerCase()}`}`,
        status: "error",
      });
      if (import.meta.env.DEV) {
        console.warn("[handleSettingCommand] Failed to set", key, ":", result.error);
      }
    }
    // Always return handled: true so the command is marked as processed
    // (even if it failed, we've handled it and shown an error)
    return { handled: true };
  }

  // Standard handling via onSettingChange callback
  if (onSettingChange) {
    onSettingChange(key, parsed.value, {
      source: "AskJoule",
      comment: `Set ${label.toLowerCase()} via Ask Joule`,
    });

    // Dispatch custom events for thermostat control page updates (when not using unified manager)
    if (key === "winterThermostat" || key === "summerThermostat") {
      // Update thermostatState in localStorage for Home.jsx display (same as unified path)
      try {
        const currentState = JSON.parse(
          localStorage.getItem("thermostatState") ||
            '{"targetTemp": 70, "mode": "heat", "preset": "home"}'
        );
        currentState.targetTemp = parsed.value;
        localStorage.setItem("thermostatState", JSON.stringify(currentState));
        if (import.meta.env.DEV) {
          console.log(
            "[AskJoule] Updated thermostatState.targetTemp to:",
            parsed.value
          );
        }
      } catch (error) {
        console.warn("[AskJoule] Failed to update thermostatState:", error);
      }

      // Try to call thermostat API directly if available (like we do for setMode)
      if (typeof window !== "undefined" && window.activeIntegration) {
        const integration = window.activeIntegration;
        if (integration && typeof integration.setTemperature === "function") {
          // Determine heat and cool temps based on current mode and key
          const currentMode = localStorage.getItem("hvacMode") || "heat";
          const heatTemp =
            key === "winterThermostat" ||
            currentMode === "heat" ||
            currentMode === "auto"
              ? parsed.value
              : integration.targetHeatTemp || parsed.value;
          const coolTemp =
            key === "summerThermostat" ||
            currentMode === "cool" ||
            currentMode === "auto"
              ? parsed.value
              : integration.targetCoolTemp || parsed.value;

          integration
            .setTemperature(heatTemp, coolTemp)
            .then(() => {
              if (import.meta.env.DEV) {
                console.log(
                  "[AskJoule] Successfully called thermostat API to set temperature:",
                  parsed.value
                );
              }
            })
            .catch((apiError) => {
              console.warn(
                "[AskJoule] Failed to call thermostat API directly:",
                apiError
              );
              // Continue with event dispatch as fallback
            });
        }
      }

      // Dispatch event with both 'temp' and 'temperature' for compatibility
      if (import.meta.env.DEV) {
        console.log("[AskJoule] Dispatching targetTempChanged event:", {
          temp: parsed.value,
          temperature: parsed.value,
          source: "AskJoule",
          key,
        });
      }
      window.dispatchEvent(
        new CustomEvent("targetTempChanged", {
          detail: {
            temp: parsed.value,
            temperature: parsed.value,
            source: "AskJoule",
            key,
          },
        })
      );

      // Dispatch event with both 'temp' and 'temperature' for compatibility
      if (import.meta.env.DEV) {
        console.log(
          "[AskJoule] Dispatching targetTempChanged event (standard path):",
          {
            temp: parsed.value,
            temperature: parsed.value,
            source: "AskJoule",
            key,
          }
        );
      }
      window.dispatchEvent(
        new CustomEvent("targetTempChanged", {
          detail: {
            temp: parsed.value,
            temperature: parsed.value,
            source: "AskJoule",
            key,
          },
        })
      );
    }

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
  const { onSettingChange, setOutput } = callbacks;

  // Load actual comfort settings from thermostat settings
  let comfortSettings;
  try {
    const thermostatSettings = loadThermostatSettings();
    comfortSettings = thermostatSettings?.comfortSettings;
  } catch (error) {
    console.warn("Failed to load thermostat settings, using defaults", error);
  }

  // Use comfort settings if available, otherwise fall back to defaults
  const presets = {
    sleep: {
      temp: comfortSettings?.sleep?.heatSetPoint || 66,
      action: "sleep",
      comment: "Sleep mode preset",
      label: "Sleep mode",
    },
    away: {
      temp: comfortSettings?.away?.heatSetPoint || 62,
      action: "away",
      comment: "Away mode preset",
      label: "Away mode",
    },
    home: {
      temp: comfortSettings?.home?.heatSetPoint || 70,
      action: "home",
      comment: "Home mode preset",
      label: "Home mode",
    },
  };

  const preset = presets[presetType];
  if (!preset) {
    // Unknown preset type - return error if setOutput is available
    if (setOutput) {
      setOutput({
        message: `Unknown preset type: ${presetType}. Available presets: sleep, away, home.`,
        status: "error",
      });
    }
    return { handled: false };
  }

  // Demo mode: If onSettingChange is not available, update localStorage directly
  // This allows the feature to work in demo mode for demonstrations
  if (!onSettingChange) {
    console.log(
      `[handlePresetCommand] ${preset.label} command received in demo mode - updating localStorage directly`
    );

    // Update thermostatState in localStorage (for Home.jsx display)
    try {
      const currentState = JSON.parse(
        localStorage.getItem("thermostatState") ||
          '{"targetTemp": 70, "mode": "heat", "preset": "home"}'
      );
      currentState.targetTemp = preset.temp;
      currentState.preset = presetType;
      localStorage.setItem("thermostatState", JSON.stringify(currentState));
      if (import.meta.env.DEV) {
        console.log(
          `[handlePresetCommand] Updated thermostatState.targetTemp to ${preset.temp}°F in demo mode`
        );
      }
    } catch (error) {
      console.warn(
        "[handlePresetCommand] Failed to update thermostatState:",
        error
      );
    }

    // Update userSettings for compatibility
    try {
      const result = setSetting("winterThermostat", preset.temp, {
        source: "AskJoule",
        comment: preset.comment,
      });
      if (!result.success) {
        console.warn(
          "[handlePresetCommand] Failed to update userSettings:",
          result.error
        );
      }
    } catch (error) {
      console.warn(
        "[handlePresetCommand] Failed to update userSettings:",
        error
      );
    }

    // Dispatch event for thermostat control page updates
    window.dispatchEvent(
      new CustomEvent("targetTempChanged", {
        detail: {
          temperature: preset.temp,
          source: "AskJoule",
          key: "winterThermostat",
          preset: presetType,
        },
      })
    );

    // Get personalized response and show success message
    const personalizedResponse = getPersonalizedResponse(preset.action, {
      temp: preset.temp,
    });
    const response = `✓ ${preset.label} activated. Temperature set to ${preset.temp}°F. ${personalizedResponse}`;

    if (setOutput) {
      setOutput({ message: response, status: "success" });
    } else {
      console.error(
        "[handlePresetCommand] setOutput callback not available - cannot show success message"
      );
    }
    return { handled: true };
  }

  // Check if setOutput is available
  if (!setOutput) {
    console.error("handlePresetCommand: setOutput callback not provided");
    return { handled: false };
  }

  try {
    onSettingChange("winterThermostat", preset.temp, {
      source: "AskJoule",
      comment: preset.comment,
    });

    // Dispatch event for thermostat control page updates
    window.dispatchEvent(
      new CustomEvent("targetTempChanged", {
        detail: {
          temperature: preset.temp,
          source: "AskJoule",
          key: "winterThermostat",
          preset: presetType,
        },
      })
    );

    // Get personalized response and enhance it with preset mode info
    const personalizedResponse = getPersonalizedResponse(preset.action, {
      temp: preset.temp,
    });

    // Create a more complete response that mentions the mode and temperature
    const response = `✓ ${preset.label} activated. Temperature set to ${preset.temp}°F. ${personalizedResponse}`;

    // setOutput automatically handles TTS for success messages - no need to call speak() directly
    setOutput({ message: response, status: "success" });
  } catch (error) {
    // Handle errors gracefully
    console.error("Error in handlePresetCommand:", error);
    if (setOutput) {
      setOutput({
        message: `Failed to activate ${preset.label}: ${
          error.message || "Unknown error"
        }. Please try again or check your connection.`,
        status: "error",
      });
    }
    return { handled: true }; // Still handled, just failed to execute
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
  const { onSettingChange, setOutput, userSettings } = callbacks;

  // Ensure delta is a valid number (default to 2 if not provided)
  const deltaValue = typeof delta === "number" && delta > 0 ? delta : 2;

  // Get current temperature from userSettings if currentTemp is not provided
  const currentTempValue = currentTemp || userSettings?.winterThermostat || 70;

  const newTemp =
    direction === "up"
      ? currentTempValue + deltaValue
      : currentTempValue - deltaValue;

  // Clamp temperature to reasonable bounds
  const clampedTemp = Math.max(50, Math.min(90, Math.round(newTemp)));

  const action = direction === "up" ? "tempUp" : "tempDown";

  // Dispatch event for thermostat control page updates FIRST (before setting change)
  // This ensures the UI updates immediately
  window.dispatchEvent(
    new CustomEvent("targetTempChanged", {
      detail: {
        temp: clampedTemp,
        temperature: clampedTemp,
        source: "AskJoule",
        key: "winterThermostat",
      },
    })
  );

  if (onSettingChange) {
    onSettingChange("winterThermostat", clampedTemp, {
      source: "AskJoule",
      comment: `${
        direction === "up" ? "Increased" : "Decreased"
      } by ${deltaValue}°`,
    });
  }

  const response = getPersonalizedResponse(action, {
    temp: clampedTemp,
    delta: deltaValue,
  });
  // setOutput automatically handles TTS for success messages - no need to call speak() directly
  setOutput({ message: response, status: "success" });

  return { handled: true, newTemp: clampedTemp };
}

/**
 * Handle navigation commands
 * @param {object} parsed - Parsed command with target
 * @param {object} callbacks - { navigate, onNavigate, setOutput, speak }
 * @returns {object} Result object
 */
export function handleNavigationCommand(parsed, callbacks) {
  const { navigate, onNavigate, setOutput, speak, speechEnabled } = callbacks;

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
    // Format: "Navigating to [Page Name] page..."
    const pageName = label || parsed.target || "page";
    const message = pageName.toLowerCase().includes("page")
      ? `Navigating to ${pageName}...`
      : `Navigating to ${pageName} page...`;

    // Set output message first
    setOutput({
      message,
      status: "success",
    });

    // Start TTS and wait for it to finish before navigating
    if (speak && speechEnabled) {
      try {
        // Start speaking and wait for it to complete
        const ttsPromise = speak(message);

        // Wait for TTS to finish before navigating
        if (ttsPromise && typeof ttsPromise.then === "function") {
          // speak() returns a promise - wait for it
          ttsPromise
            .then(() => {
              // TTS finished - now safe to navigate
              if (onNavigate) {
                onNavigate(path);
              } else if (navigate) {
                navigate(path);
              }
            })
            .catch((error) => {
              // If TTS fails, navigate anyway
              console.warn("TTS error during navigation:", error);
              if (onNavigate) {
                onNavigate(path);
              } else if (navigate) {
                navigate(path);
              }
            });
        } else {
          // speak() doesn't return a promise - fallback to polling
          // Poll speechSynthesis.speaking until it's false
          const checkTTSComplete = () => {
            if (typeof window !== "undefined" && window.speechSynthesis) {
              if (window.speechSynthesis.speaking) {
                // Still speaking, check again in 100ms
                setTimeout(checkTTSComplete, 100);
              } else {
                // TTS finished - navigate
                if (onNavigate) {
                  onNavigate(path);
                } else if (navigate) {
                  navigate(path);
                }
              }
            } else {
              // No speechSynthesis, navigate after a delay
              setTimeout(() => {
                if (onNavigate) {
                  onNavigate(path);
                } else if (navigate) {
                  navigate(path);
                }
              }, 500);
            }
          };

          // Start checking after a short delay to allow TTS to start
          setTimeout(checkTTSComplete, 200);
        }
      } catch (error) {
        // If TTS fails, just navigate normally
        console.warn("TTS error during navigation:", error);
        setTimeout(() => {
          if (onNavigate) {
            onNavigate(path);
          } else if (navigate) {
            navigate(path);
          }
        }, 300);
      }
    } else {
      // No TTS, navigate immediately
      setTimeout(() => {
        if (onNavigate) {
          onNavigate(path);
        } else if (navigate) {
          navigate(path);
        }
      }, 300);
    }

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
  const { setOutput } = callbacks;

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
    // TTS is handled by setOutput - no need to call speak() directly

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
  const { onSettingChange, setOutput, speak, pushAuditLog } = callbacks;

  switch (parsed.action) {
    case "setCompressorMinRuntime": {
      try {
        const settings = loadThermostatSettings();
        // Ensure thresholds exist
        settings.thresholds = settings.thresholds || {};

        // Runtime = min ON time, not min cycle OFF time
        const oldValue = settings.thresholds.compressorMinOnTime ?? 300;
        if (parsed.value < 60 || parsed.value > 1800) {
          setOutput({
            message: `Compressor min runtime must be between 60-1800 seconds (1-30 minutes)`,
            status: "error",
          });
          return { handled: true, error: "Invalid range" };
        }
        settings.thresholds.compressorMinOnTime = parsed.value;
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange(
            "thermostat.thresholds.compressorMinOnTime",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set compressor min runtime via Ask Joule",
              oldValue,
            }
          );
        }

        const minutes = Math.round(parsed.value / 60);
        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ Compressor minimum runtime set to ${minutes} minutes (${parsed.value} seconds)`,
          status: "success",
        });
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

        // Include reason if provided (from problem detection)
        const reason = parsed.reason ? `\n${parsed.reason}` : "";

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
          message: `✓ Heat Differential set to ${parsed.value}°F${reason}`,
          status: "success",
        });
        // setOutput automatically handles TTS for success messages - no need to call speak() directly
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
        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set cool differential: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setCompressorLockout": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.thresholds.compressorMinOutdoorTemp;
        settings.thresholds.compressorMinOutdoorTemp = parsed.value;
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange(
            "thermostat.thresholds.compressorMinOutdoorTemp",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set compressor lockout temperature via Ask Joule",
              oldValue,
            }
          );
        }

        const reason = parsed.reason ? `\n${parsed.reason}` : "";
        setOutput({
          message: `✓ Compressor lockout temperature set to ${parsed.value}°F${reason}`,
          status: "success",
        });
        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set compressor lockout: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setACOvercool": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.thresholds.acOvercoolMax;
        if (parsed.value < 0 || parsed.value > 5) {
          setOutput({
            message: `AC overcool must be between 0-5°F`,
            status: "error",
          });
          return { handled: true, error: "Invalid range" };
        }
        settings.thresholds.acOvercoolMax = parsed.value;
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange("thermostat.thresholds.acOvercoolMax", parsed.value, {
            source: "AskJoule",
            comment: "Set AC overcool max via Ask Joule",
            oldValue,
          });
        }

        const reason = parsed.reason ? `\n${parsed.reason}` : "";
        let explanation = "";
        if (parsed.value >= 3) {
          explanation =
            "\n\nThis will remove the 'sticky' feeling by forcing the compressor to run longer for better dehumidification.";
        } else if (parsed.value > 0) {
          explanation =
            "\n\nThis allows the AC to run slightly past the setpoint to remove humidity.";
        }
        setOutput({
          message: `✓ AC overcool set to ${parsed.value}°F${reason}${explanation}`,
          status: "success",
        });
        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set AC overcool: ${error.message}`,
          status: "error",
        });
        return { handled: true };
      }
    }

    // Removed duplicate code blocks that were accidentally inserted
    // These handlers are already implemented in the switch statement above

    case "setTemperatureCorrection": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.thresholds.temperatureCorrection;
        if (parsed.value < -10 || parsed.value > 10) {
          setOutput({
            message: `Temperature correction must be between -10°F and 10°F`,
            status: "error",
          });
          return { handled: true, error: "Invalid range" };
        }
        settings.thresholds.temperatureCorrection = parsed.value;
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange(
            "thermostat.thresholds.temperatureCorrection",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set temperature correction via Ask Joule",
              oldValue,
            }
          );
        }

        const sign = parsed.value >= 0 ? "+" : "";
        const reason = parsed.reason ? `\n${parsed.reason}` : "";
        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ Temperature correction set to ${sign}${parsed.value}°F${reason}`,
          status: "success",
        });
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set temperature correction: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setHumidityCorrection": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.thresholds.humidityCorrection || 0;
        if (parsed.value < -20 || parsed.value > 20) {
          setOutput({
            message: `Humidity correction must be between -20% and 20%`,
            status: "error",
          });
          return { handled: true, error: "Invalid range" };
        }
        settings.thresholds.humidityCorrection = parsed.value;
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange(
            "thermostat.thresholds.humidityCorrection",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set humidity correction via Ask Joule",
              oldValue,
            }
          );
        }

        const sign = parsed.value >= 0 ? "+" : "";
        const reason = parsed.reason ? `\n${parsed.reason}` : "";
        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ Humidity correction set to ${sign}${parsed.value}%${reason}`,
          status: "success",
        });
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set humidity correction: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setHeatMinOnTime": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.thresholds.heatMinOnTime;
        if (parsed.value < 60 || parsed.value > 1800) {
          setOutput({
            message: `Heat min on time must be between 60-1800 seconds (1-30 minutes)`,
            status: "error",
          });
          return { handled: true, error: "Invalid range" };
        }
        settings.thresholds.heatMinOnTime = parsed.value;
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange("thermostat.thresholds.heatMinOnTime", parsed.value, {
            source: "AskJoule",
            comment: "Set heat min on time via Ask Joule",
            oldValue,
          });
        }

        const minutes = Math.round(parsed.value / 60);
        setOutput({
          message: `✓ Heat min on time set to ${minutes} minutes (${parsed.value} seconds)`,
          status: "success",
        });
        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set heat min on time: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setCompressorMinOnTime": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.thresholds.compressorMinOnTime || 300; // Default if not set
        if (parsed.value < 60 || parsed.value > 1800) {
          setOutput({
            message: `Compressor min on time must be between 60-1800 seconds (1-30 minutes)`,
            status: "error",
          });
          return { handled: true, error: "Invalid range" };
        }
        // Note: compressorMinOnTime might not exist in settings structure, we may need to add it
        if (!settings.thresholds.compressorMinOnTime) {
          settings.thresholds.compressorMinOnTime = parsed.value;
        } else {
          settings.thresholds.compressorMinOnTime = parsed.value;
        }
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange(
            "thermostat.thresholds.compressorMinOnTime",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set compressor min on time via Ask Joule",
              oldValue,
            }
          );
        }

        const minutes = Math.round(parsed.value / 60);
        const reason = parsed.reason ? `\n${parsed.reason}` : "";
        setOutput({
          message: `✓ Compressor min on time set to ${minutes} minutes (${parsed.value} seconds)${reason}`,
          status: "success",
        });
        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set compressor min on time: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setCoolMinOnTime": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.thresholds.coolMinOnTime;
        if (parsed.value < 60 || parsed.value > 1800) {
          setOutput({
            message: `Cool min on time must be between 60-1800 seconds (1-30 minutes)`,
            status: "error",
          });
          return { handled: true, error: "Invalid range" };
        }
        settings.thresholds.coolMinOnTime = parsed.value;
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange("thermostat.thresholds.coolMinOnTime", parsed.value, {
            source: "AskJoule",
            comment: "Set cool min on time via Ask Joule",
            oldValue,
          });
        }

        const minutes = Math.round(parsed.value / 60);
        const reason = parsed.reason ? `\n${parsed.reason}` : "";
        setOutput({
          message: `✓ Cool min on time set to ${minutes} minutes (${parsed.value} seconds)${reason}`,
          status: "success",
        });
        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set cool min on time: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setCompressorMinCycleOff": {
      try {
        const settings = loadThermostatSettings();
        // Ensure thresholds exist
        settings.thresholds = settings.thresholds || {};

        const oldValue = settings.thresholds.compressorMinCycleOff ?? 600;
        if (parsed.value < 60 || parsed.value > 1800) {
          setOutput({
            message: `Compressor min off time must be between 60-1800 seconds (1-30 minutes)`,
            status: "error",
          });
          return { handled: true, error: "Invalid range" };
        }
        settings.thresholds.compressorMinCycleOff = parsed.value;
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange(
            "thermostat.thresholds.compressorMinCycleOff",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set compressor min cycle off time via Ask Joule",
              oldValue,
            }
          );
        }

        const minutes = Math.round(parsed.value / 60);
        setOutput({
          message: `✓ Compressor min off time set to ${minutes} minutes (${parsed.value} seconds)`,
          status: "success",
        });
        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set compressor min off time: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setHeatDissipation": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.thresholds.heatDissipationTime;
        if (parsed.value < 0 || parsed.value > 300) {
          setOutput({
            message: `Heat dissipation time must be between 0-300 seconds`,
            status: "error",
          });
          return { handled: true, error: "Invalid range" };
        }
        settings.thresholds.heatDissipationTime = parsed.value;
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange(
            "thermostat.thresholds.heatDissipationTime",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set heat dissipation time via Ask Joule",
              oldValue,
            }
          );
        }

        const reason = parsed.reason ? `\n${parsed.reason}` : "";
        setOutput({
          message: `✓ Heat dissipation time set to ${parsed.value} seconds${reason}`,
          status: "success",
        });
        if (speak)
          speak(`Heat dissipation time set to ${parsed.value} seconds`);
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set heat dissipation time: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setAuxHeatMaxOutdoorTemp": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.thresholds.auxHeatMaxOutdoorTemp;
        if (parsed.value < 20 || parsed.value > 60) {
          setOutput({
            message: `Aux heat max outdoor temp must be between 20-60°F`,
            status: "error",
          });
          return { handled: true, error: "Invalid range" };
        }
        settings.thresholds.auxHeatMaxOutdoorTemp = parsed.value;
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange(
            "thermostat.thresholds.auxHeatMaxOutdoorTemp",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set aux heat max outdoor temp via Ask Joule",
              oldValue,
            }
          );
        }

        const reason = parsed.reason ? `\n${parsed.reason}` : "";
        setOutput({
          message: `✓ Aux heat locked out above ${parsed.value}°F${reason}`,
          status: "success",
        });
        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set aux heat lockout: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setHeatCoolMinDelta": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.thresholds.heatCoolMinDelta || 5;
        if (parsed.value < 0 || parsed.value > 10) {
          setOutput({
            message: `Heat/Cool min delta must be between 0-10°F`,
            status: "error",
          });
          return { handled: true, error: "Invalid range" };
        }
        settings.thresholds.heatCoolMinDelta = parsed.value;
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange(
            "thermostat.thresholds.heatCoolMinDelta",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set heat/cool min delta via Ask Joule",
              oldValue,
            }
          );
        }

        setOutput({
          message: `✓ Heat/Cool min delta set to ${parsed.value}°F`,
          status: "success",
        });
        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set heat/cool min delta: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setCompressorToAuxDelta": {
      try {
        const settings = loadThermostatSettings();
        // Note: This might need to be added to the settings structure
        const oldValue = settings.thresholds.compressorToAuxTempDelta || 1;
        if (parsed.value < 0 || parsed.value > 10) {
          setOutput({
            message: `Compressor to aux delta must be between 0-10°F`,
            status: "error",
          });
          return { handled: true, error: "Invalid range" };
        }
        if (!settings.thresholds.compressorToAuxTempDelta) {
          settings.thresholds.compressorToAuxTempDelta = parsed.value;
        } else {
          settings.thresholds.compressorToAuxTempDelta = parsed.value;
        }
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange(
            "thermostat.thresholds.compressorToAuxTempDelta",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set compressor to aux delta via Ask Joule",
              oldValue,
            }
          );
        }

        const reason = parsed.reason ? `\n${parsed.reason}` : "";
        setOutput({
          message: `✓ Compressor to aux delta set to ${parsed.value}°F${reason}`,
          status: "success",
        });
        if (speak)
          speak(`Compressor to aux delta set to ${parsed.value} degrees`);
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set compressor to aux delta: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setCompressorReverseStaging": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.thresholds.compressorReverseStaging;
        settings.thresholds.compressorReverseStaging = parsed.value;
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange(
            "thermostat.thresholds.compressorReverseStaging",
            parsed.value,
            {
              source: "AskJoule",
              comment: `${
                parsed.value ? "Enabled" : "Disabled"
              } compressor reverse staging via Ask Joule`,
              oldValue,
            }
          );
        }

        const reason = parsed.reason ? `\n${parsed.reason}` : "";
        setOutput({
          message: `✓ Compressor reverse staging ${
            parsed.value ? "enabled" : "disabled"
          }${reason}`,
          status: "success",
        });
        if (speak)
          speak(
            `Compressor reverse staging ${
              parsed.value ? "enabled" : "disabled"
            }`
          );
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set compressor reverse staging: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setThermalProtect": {
      try {
        const settings = loadThermostatSettings();
        // Thermal protect is a numeric value (temperature difference threshold), not a boolean
        // But we can enable/disable it by setting to 0 (disabled) or a value (enabled)
        const oldValue = settings.thresholds.thermalProtect || 10;
        const newValue =
          parsed.value === true ? 10 : parsed.value === false ? 0 : oldValue;

        if (newValue < 0 || newValue > 20) {
          setOutput({
            message: `Thermal protect must be between 0-20°F (0 = disabled)`,
            status: "error",
          });
          return { handled: true, error: "Invalid range" };
        }

        settings.thresholds.thermalProtect = newValue;
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange("thermostat.thresholds.thermalProtect", newValue, {
            source: "AskJoule",
            comment: `${
              newValue === 0 ? "Disabled" : "Enabled"
            } thermal protect via Ask Joule`,
            oldValue,
          });
        }

        setOutput({
          message: `✓ Thermal protect ${
            newValue === 0 ? "disabled" : `set to ${newValue}°F`
          }`,
          status: "success",
        });
        if (speak)
          speak(
            `Thermal protect ${
              newValue === 0 ? "disabled" : `set to ${newValue} degrees`
            }`
          );
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set thermal protect: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setThermalProtectValue": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.thresholds.thermalProtect || 10;
        if (parsed.value < 0 || parsed.value > 20) {
          setOutput({
            message: `Thermal protect must be between 0-20°F (0 = disabled)`,
            status: "error",
          });
          return { handled: true, error: "Invalid range" };
        }
        settings.thresholds.thermalProtect = parsed.value;
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange(
            "thermostat.thresholds.thermalProtect",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set thermal protect value via Ask Joule",
              oldValue,
            }
          );
        }

        setOutput({
          message: `✓ Thermal protect set to ${parsed.value}°F`,
          status: "success",
        });
        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set thermal protect: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setCompressorStage2Delta": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.thresholds.compressorStage2Delta || 2;
        if (parsed.value < 0 || parsed.value > 10) {
          setOutput({
            message: `Compressor stage 2 delta must be between 0-10°F`,
            status: "error",
          });
          return { handled: true, error: "Invalid range" };
        }
        if (!settings.thresholds.compressorStage2Delta) {
          settings.thresholds.compressorStage2Delta = parsed.value;
        } else {
          settings.thresholds.compressorStage2Delta = parsed.value;
        }
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange(
            "thermostat.thresholds.compressorStage2Delta",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set compressor stage 2 delta via Ask Joule",
              oldValue,
            }
          );
        }

        setOutput({
          message: `✓ Compressor stage 2 delta set to ${parsed.value}°F`,
          status: "success",
        });
        if (speak)
          speak(`Compressor stage 2 delta set to ${parsed.value} degrees`);
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set compressor stage 2 delta: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setCompressorStage1MaxRuntime": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.thresholds.compressorStage1MaxRuntime || 1800;
        if (parsed.value < 60 || parsed.value > 7200) {
          setOutput({
            message: `Compressor stage 1 max runtime must be between 60-7200 seconds (1-120 minutes)`,
            status: "error",
          });
          return { handled: true, error: "Invalid range" };
        }
        if (!settings.thresholds.compressorStage1MaxRuntime) {
          settings.thresholds.compressorStage1MaxRuntime = parsed.value;
        } else {
          settings.thresholds.compressorStage1MaxRuntime = parsed.value;
        }
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange(
            "thermostat.thresholds.compressorStage1MaxRuntime",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set compressor stage 1 max runtime via Ask Joule",
              oldValue,
            }
          );
        }

        const minutes = Math.round(parsed.value / 60);
        setOutput({
          message: `✓ Compressor stage 1 max runtime set to ${minutes} min (${parsed.value} sec)`,
          status: "success",
        });
        if (speak)
          speak(`Compressor stage 1 max runtime set to ${minutes} minutes`);
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set compressor stage 1 max runtime: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setHeatStage2Delta": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.thresholds.heatStage2Delta || 2;
        if (parsed.value < 0 || parsed.value > 10) {
          setOutput({
            message: `Heat stage 2 delta must be between 0-10°F`,
            status: "error",
          });
          return { handled: true, error: "Invalid range" };
        }
        if (!settings.thresholds.heatStage2Delta) {
          settings.thresholds.heatStage2Delta = parsed.value;
        } else {
          settings.thresholds.heatStage2Delta = parsed.value;
        }
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange(
            "thermostat.thresholds.heatStage2Delta",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set heat stage 2 delta via Ask Joule",
              oldValue,
            }
          );
        }

        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ Heat stage 2 delta set to ${parsed.value}°F`,
          status: "success",
        });
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set heat stage 2 delta: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setHeatStage1MaxRuntime": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.thresholds.heatStage1MaxRuntime || 1800;
        if (parsed.value < 60 || parsed.value > 7200) {
          setOutput({
            message: `Heat stage 1 max runtime must be between 60-7200 seconds (1-120 minutes)`,
            status: "error",
          });
          return { handled: true, error: "Invalid range" };
        }
        if (!settings.thresholds.heatStage1MaxRuntime) {
          settings.thresholds.heatStage1MaxRuntime = parsed.value;
        } else {
          settings.thresholds.heatStage1MaxRuntime = parsed.value;
        }
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange(
            "thermostat.thresholds.heatStage1MaxRuntime",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set heat stage 1 max runtime via Ask Joule",
              oldValue,
            }
          );
        }

        const minutes = Math.round(parsed.value / 60);
        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ Heat stage 1 max runtime set to ${minutes} min (${parsed.value} sec)`,
          status: "success",
        });
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set heat stage 1 max runtime: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setAuxStage2Delta": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.thresholds.auxStage2Delta || 2;
        if (parsed.value < 0 || parsed.value > 10) {
          setOutput({
            message: `Aux stage 2 delta must be between 0-10°F`,
            status: "error",
          });
          return { handled: true, error: "Invalid range" };
        }
        if (!settings.thresholds.auxStage2Delta) {
          settings.thresholds.auxStage2Delta = parsed.value;
        } else {
          settings.thresholds.auxStage2Delta = parsed.value;
        }
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange(
            "thermostat.thresholds.auxStage2Delta",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set aux stage 2 delta via Ask Joule",
              oldValue,
            }
          );
        }

        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ Aux stage 2 delta set to ${parsed.value}°F`,
          status: "success",
        });
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set aux stage 2 delta: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setAuxStage1MaxRuntime": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.thresholds.auxStage1MaxRuntime || 1800;
        if (parsed.value < 60 || parsed.value > 7200) {
          setOutput({
            message: `Aux stage 1 max runtime must be between 60-7200 seconds (1-120 minutes)`,
            status: "error",
          });
          return { handled: true, error: "Invalid range" };
        }
        if (!settings.thresholds.auxStage1MaxRuntime) {
          settings.thresholds.auxStage1MaxRuntime = parsed.value;
        } else {
          settings.thresholds.auxStage1MaxRuntime = parsed.value;
        }
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange(
            "thermostat.thresholds.auxStage1MaxRuntime",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set aux stage 1 max runtime via Ask Joule",
              oldValue,
            }
          );
        }

        const minutes = Math.round(parsed.value / 60);
        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ Aux stage 1 max runtime set to ${minutes} min (${parsed.value} sec)`,
          status: "success",
        });
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set aux stage 1 max runtime: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "optimizeForEfficiency": {
      try {
        const settings = loadThermostatSettings();
        const changes = [];

        // Ensure thresholds exist
        settings.thresholds = settings.thresholds || {};

        // Set Differential to 1.5°F
        const oldHeatDiff = settings.thresholds.heatDifferential ?? 2.0;
        const oldCoolDiff = settings.thresholds.coolDifferential ?? 2.0;
        settings.thresholds.heatDifferential = 1.5;
        settings.thresholds.coolDifferential = 1.5;
        changes.push(
          `Heat/Cool differential: ${oldHeatDiff}°F / ${oldCoolDiff}°F → 1.5°F`
        );

        // Set Dissipation to 60s
        const oldDissipation = settings.thresholds.heatDissipationTime ?? 120;
        settings.thresholds.heatDissipationTime = 60;
        changes.push(`Heat dissipation: ${oldDissipation}s → 60s`);

        // Set Overcool to 2°F
        const oldOvercool = settings.thresholds.acOvercoolMax ?? 0;
        settings.thresholds.acOvercoolMax = 2;
        changes.push(`AC overcool: ${oldOvercool}°F → 2°F`);

        // Set Aux Heat Lockout to 30°F (as mentioned in message)
        const oldAuxLockout = settings.thresholds.auxHeatMaxOutdoorTemp ?? 35;
        settings.thresholds.auxHeatMaxOutdoorTemp = 30;
        changes.push(`Aux heat lockout: ${oldAuxLockout}°F → 30°F`);

        saveThermostatSettings(settings);

        // Log to audit log if available
        if (pushAuditLog) {
          pushAuditLog({
            key: "thermostat.optimizeEfficiency",
            oldValue: null,
            newValue: changes.join("; "),
            source: "AskJoule",
            comment: "Optimized for efficiency via Ask Joule",
          });
        }

        // Note: We don't call onSettingChange here because thermostat settings
        // are stored separately from userSettings (in thermostatSettings localStorage key)
        // The saveThermostatSettings call above handles persistence and dispatches
        // the "thermostatSettingsChanged" event for reactive updates

        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ I've optimized your settings for better efficiency! Your heat and cool differentials are now 1.5°F, dissipation time is 60 seconds, AC overcool is 2°F, and aux heat lockout is 30°F.`,
          status: "success",
        });
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to optimize for efficiency: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "optimizeForComfort": {
      try {
        const settings = loadThermostatSettings();
        // Ensure thresholds exist
        settings.thresholds = settings.thresholds || {};
        const changes = [];

        // Set Differential to 0.5°F
        const oldHeatDiff = settings.thresholds.heatDifferential ?? 2.0;
        const oldCoolDiff = settings.thresholds.coolDifferential ?? 2.0;
        settings.thresholds.heatDifferential = 0.5;
        settings.thresholds.coolDifferential = 0.5;
        changes.push(
          `Heat/Cool differential: ${oldHeatDiff}°F / ${oldCoolDiff}°F → 0.5°F`
        );

        // Set Dissipation to 0s (to avoid drafts)
        const oldDissipation = settings.thresholds.heatDissipationTime ?? 120;
        settings.thresholds.heatDissipationTime = 0;
        changes.push(`Heat dissipation: ${oldDissipation}s → 0s`);

        saveThermostatSettings(settings);

        // Log to audit log if available
        if (pushAuditLog) {
          pushAuditLog({
            key: "thermostat.optimizeComfort",
            oldValue: null,
            newValue: changes.join("; "),
            source: "AskJoule",
            comment: "Optimized for comfort via Ask Joule",
          });
        }

        // Note: We don't call onSettingChange here because thermostat settings
        // are stored separately from userSettings (in thermostatSettings localStorage key)
        // The saveThermostatSettings call above handles persistence and dispatches
        // the "thermostatSettingsChanged" event for reactive updates

        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ Optimized for comfort:\n${changes.join("\n")}`,
          status: "success",
        });
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to optimize for comfort: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "protectCompressor": {
      try {
        const settings = loadThermostatSettings();
        // Ensure thresholds exist
        settings.thresholds = settings.thresholds || {};
        const changes = [];

        // Set Cycle Off to 600s (10 minutes)
        const oldCycleOff = settings.thresholds.compressorMinCycleOff ?? 300;
        settings.thresholds.compressorMinCycleOff = 600;
        changes.push(
          `Compressor min off time: ${Math.round(oldCycleOff / 60)}min → 10min`
        );

        // Set Min On to 300s (5 minutes)
        const oldMinOn = settings.thresholds.compressorMinOnTime ?? 180;
        settings.thresholds.compressorMinOnTime = 300;
        changes.push(
          `Compressor min on time: ${Math.round(oldMinOn / 60)}min → 5min`
        );

        saveThermostatSettings(settings);

        // Note: We don't call onSettingChange here because thermostat settings
        // are stored separately from userSettings (in thermostatSettings localStorage key)
        // The saveThermostatSettings call above handles persistence and dispatches
        // the "thermostatSettingsChanged" event for reactive updates

        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ Compressor protection enabled:\n${changes.join("\n")}`,
          status: "success",
        });
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to protect compressor: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setMode": {
      try {
        const mode = parsed.value?.toLowerCase();
        const validModes = ["heat", "cool", "auto", "off"];

        if (!mode || !validModes.includes(mode)) {
          setOutput({
            message: `Invalid mode. Available modes: ${validModes.join(", ")}`,
            status: "error",
          });
          if (speak)
            speak(
              `Invalid mode. Available modes are heat, cool, auto, and off.`
            );
          return { handled: true, error: "Invalid mode" };
        }

        // Store mode in localStorage
        localStorage.setItem("hvacMode", mode);

        // Try to call thermostat API directly if available
        // Check for active integration via window (set by SmartThermostatDemo)
        if (typeof window !== "undefined" && window.activeIntegration) {
          const integration = window.activeIntegration;
          if (integration && typeof integration.setMode === "function") {
            // Use promise chain instead of await since function is not async
            integration
              .setMode(mode)
              .then(() => {
                if (import.meta.env.DEV) {
                  console.log(
                    "[AskJoule] Successfully called thermostat API to set mode:",
                    mode
                  );
                }
                // Dispatch event after successful API call
                window.dispatchEvent(
                  new CustomEvent("hvacModeChanged", {
                    detail: { mode, source: "AskJoule", apiCallSuccess: true },
                  })
                );
              })
              .catch((apiError) => {
                console.warn(
                  "[AskJoule] Failed to call thermostat API directly:",
                  apiError
                );
                // Dispatch event as fallback if API call failed
                window.dispatchEvent(
                  new CustomEvent("hvacModeChanged", {
                    detail: { mode, source: "AskJoule", apiCallSuccess: false },
                  })
                );
              });
          } else {
            // No integration available, dispatch event immediately
            window.dispatchEvent(
              new CustomEvent("hvacModeChanged", {
                detail: { mode, source: "AskJoule", apiCallSuccess: false },
              })
            );
          }
        } else {
          // No integration available, dispatch event immediately
          window.dispatchEvent(
            new CustomEvent("hvacModeChanged", {
              detail: { mode, source: "AskJoule", apiCallSuccess: false },
            })
          );
        }

        if (onSettingChange) {
          onSettingChange("hvacMode", mode, {
            source: "AskJoule",
            comment: `Set HVAC mode to ${mode} via Ask Joule`,
          });
        }

        const modeLabels = {
          heat: "Heat",
          cool: "Cool",
          auto: "Auto Heat/Cool",
          off: "Off",
        };

        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ HVAC mode set to ${modeLabels[mode] || mode}`,
          status: "success",
        });
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set HVAC mode: ${error.message}`,
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

        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ Nighttime start time set to ${displayTime} for all days`,
          status: "success",
        });
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

        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ Daytime start time set to ${displayTime} for all days`,
          status: "success",
        });
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

        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ Daytime temperature set to ${parsed.value}°F`,
          status: "success",
        });
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

    case "setSleepCoolSetpoint": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.comfortSettings?.sleep?.coolSetPoint || 72;
        settings.comfortSettings.sleep.coolSetPoint = parsed.value;
        saveThermostatSettings(settings);

        window.dispatchEvent(
          new CustomEvent("thermostatSettingsUpdated", {
            detail: {
              comfortSettings: { sleep: { coolSetPoint: parsed.value } },
            },
          })
        );

        if (onSettingChange) {
          onSettingChange(
            "thermostat.comfortSettings.sleep.coolSetPoint",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set sleep cool setpoint via Ask Joule",
              oldValue,
            }
          );
        }

        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ Sleep cool setpoint set to ${parsed.value}°F`,
          status: "success",
        });
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set sleep cool setpoint: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setHomeCoolSetpoint": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.comfortSettings?.home?.coolSetPoint || 74;
        settings.comfortSettings.home.coolSetPoint = parsed.value;
        saveThermostatSettings(settings);

        window.dispatchEvent(
          new CustomEvent("thermostatSettingsUpdated", {
            detail: {
              comfortSettings: { home: { coolSetPoint: parsed.value } },
            },
          })
        );

        if (onSettingChange) {
          onSettingChange(
            "thermostat.comfortSettings.home.coolSetPoint",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set home cool setpoint via Ask Joule",
              oldValue,
            }
          );
        }

        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ Home cool setpoint set to ${parsed.value}°F`,
          status: "success",
        });
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set home cool setpoint: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setAwayHeatSetpoint": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.comfortSettings?.away?.heatSetPoint || 62;
        settings.comfortSettings.away.heatSetPoint = parsed.value;
        saveThermostatSettings(settings);

        window.dispatchEvent(
          new CustomEvent("thermostatSettingsUpdated", {
            detail: {
              comfortSettings: { away: { heatSetPoint: parsed.value } },
            },
          })
        );

        if (onSettingChange) {
          onSettingChange(
            "thermostat.comfortSettings.away.heatSetPoint",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set away heat setpoint via Ask Joule",
              oldValue,
            }
          );
        }

        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ Away heat setpoint set to ${parsed.value}°F`,
          status: "success",
        });
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set away heat setpoint: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setAwayCoolSetpoint": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.comfortSettings?.away?.coolSetPoint || 85;
        settings.comfortSettings.away.coolSetPoint = parsed.value;
        saveThermostatSettings(settings);

        window.dispatchEvent(
          new CustomEvent("thermostatSettingsUpdated", {
            detail: {
              comfortSettings: { away: { coolSetPoint: parsed.value } },
            },
          })
        );

        if (onSettingChange) {
          onSettingChange(
            "thermostat.comfortSettings.away.coolSetPoint",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set away cool setpoint via Ask Joule",
              oldValue,
            }
          );
        }

        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ Away cool setpoint set to ${parsed.value}°F`,
          status: "success",
        });
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set away cool setpoint: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setSleepFanMode": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.comfortSettings?.sleep?.fanMode || "auto";
        settings.comfortSettings.sleep.fanMode = parsed.value;
        saveThermostatSettings(settings);

        window.dispatchEvent(
          new CustomEvent("thermostatSettingsUpdated", {
            detail: {
              comfortSettings: { sleep: { fanMode: parsed.value } },
            },
          })
        );

        if (onSettingChange) {
          onSettingChange(
            "thermostat.comfortSettings.sleep.fanMode",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set sleep fan mode via Ask Joule",
              oldValue,
            }
          );
        }

        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ Sleep fan mode set to ${parsed.value}`,
          status: "success",
        });
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set sleep fan mode: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setHomeFanMode": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.comfortSettings?.home?.fanMode || "auto";
        settings.comfortSettings.home.fanMode = parsed.value;
        saveThermostatSettings(settings);

        window.dispatchEvent(
          new CustomEvent("thermostatSettingsUpdated", {
            detail: {
              comfortSettings: { home: { fanMode: parsed.value } },
            },
          })
        );

        if (onSettingChange) {
          onSettingChange(
            "thermostat.comfortSettings.home.fanMode",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set home fan mode via Ask Joule",
              oldValue,
            }
          );
        }

        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ Home fan mode set to ${parsed.value}`,
          status: "success",
        });
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set home fan mode: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setAwayFanMode": {
      try {
        const settings = loadThermostatSettings();
        const oldValue = settings.comfortSettings?.away?.fanMode || "auto";
        settings.comfortSettings.away.fanMode = parsed.value;
        saveThermostatSettings(settings);

        window.dispatchEvent(
          new CustomEvent("thermostatSettingsUpdated", {
            detail: {
              comfortSettings: { away: { fanMode: parsed.value } },
            },
          })
        );

        if (onSettingChange) {
          onSettingChange(
            "thermostat.comfortSettings.away.fanMode",
            parsed.value,
            {
              source: "AskJoule",
              comment: "Set away fan mode via Ask Joule",
              oldValue,
            }
          );
        }

        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ Away fan mode set to ${parsed.value}`,
          status: "success",
        });
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set away fan mode: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setFanMinOnTime": {
      try {
        const settings = loadThermostatSettings();
        // Note: Fan min on time might need to be added to settings structure
        // For now, we'll use a workaround or add it to thresholds
        const oldValue = settings.thresholds.fanMinOnTime || 0;
        if (!settings.thresholds.fanMinOnTime) {
          settings.thresholds.fanMinOnTime = parsed.value;
        } else {
          settings.thresholds.fanMinOnTime = parsed.value;
        }
        saveThermostatSettings(settings);

        if (onSettingChange) {
          onSettingChange("thermostat.thresholds.fanMinOnTime", parsed.value, {
            source: "AskJoule",
            comment: "Set fan min on time via Ask Joule",
            oldValue,
          });
        }

        const reason = parsed.reason ? `\n${parsed.reason}` : "";
        setOutput({
          message: `✓ Fan min on time set to ${parsed.value} minutes per hour${reason}`,
          status: "success",
        });
        if (speak)
          speak(`Fan min on time set to ${parsed.value} minutes per hour`);
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to set fan min on time: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "fixOversizedAC": {
      try {
        const settings = loadThermostatSettings();
        const changes = [];

        // Set Cool Min On Time to 600s (10 minutes)
        const oldCoolMinOn = settings.thresholds.coolMinOnTime;
        settings.thresholds.coolMinOnTime = 600;
        changes.push(
          `Cool min on time: ${Math.round(oldCoolMinOn / 60)}min → 10min`
        );

        // Set AC Overcool Max to 3°F
        const oldOvercool = settings.thresholds.acOvercoolMax;
        settings.thresholds.acOvercoolMax = 3;
        changes.push(`AC overcool: ${oldOvercool}°F → 3°F`);

        saveThermostatSettings(settings);

        // Note: We don't call onSettingChange here because thermostat settings
        // are stored separately from userSettings (in thermostatSettings localStorage key)
        // The saveThermostatSettings call above handles persistence and dispatches
        // the "thermostatSettingsChanged" event for reactive updates

        const reason = parsed.reason ? `\n${parsed.reason}` : "";
        setOutput({
          message: `✓ Oversized AC fix applied:${reason}\n${changes.join(
            "\n"
          )}\n\nThis will force the AC to run longer for better dehumidification, even if it gets a bit cold.`,
          status: "success",
        });
        if (speak)
          speak(
            "Oversized AC fix applied. This will force longer runtime for better dehumidification."
          );
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to fix oversized AC: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "checkAuxHeatUsage": {
      try {
        const settings = loadThermostatSettings();
        const currentLockout = settings.thresholds.auxHeatMaxOutdoorTemp;

        const reason =
          parsed.reason || "Burning smell or unnecessary aux heat detected";

        // If lockout is above 40°F, suggest lowering it
        if (currentLockout > 40) {
          settings.thresholds.auxHeatMaxOutdoorTemp = 35;
          saveThermostatSettings(settings);

          if (onSettingChange) {
            onSettingChange("thermostat.thresholds.auxHeatMaxOutdoorTemp", 35, {
              source: "AskJoule",
              comment: "Reduced aux heat lockout due to unnecessary usage",
              oldValue: currentLockout,
            });
          }

          setOutput({
            message: `✓ ${reason}\n\nI've set your aux heat lockout to 35°F. This prevents expensive electric strips from running when it's warm outside.`,
            status: "success",
          });
          if (speak)
            speak(
              "I've reduced your aux heat lockout to 35 degrees to prevent unnecessary usage."
            );
        } else {
          setOutput({
            message: `ℹ️ ${reason}\n\nYour aux heat lockout is already set to ${currentLockout}°F. If you're still smelling burning, the aux heat may be needed for recovery or it's very cold outside.`,
            status: "info",
          });
          if (speak)
            speak(
              `Your aux heat lockout is already set to ${currentLockout} degrees.`
            );
        }
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to check aux heat usage: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "fixSleepCycling": {
      try {
        const settings = loadThermostatSettings();
        // Ensure thresholds exist
        settings.thresholds = settings.thresholds || {};
        const changes = [];

        // Set Compressor Min Cycle Off to 900s (15 minutes)
        const oldCycleOff = settings.thresholds.compressorMinCycleOff ?? 300;
        settings.thresholds.compressorMinCycleOff = 900;
        changes.push(
          `Compressor min off time: ${Math.round(oldCycleOff / 60)}min → 15min`
        );

        // Set Differential to 2°F
        const oldHeatDiff = settings.thresholds.heatDifferential ?? 1.5;
        const oldCoolDiff = settings.thresholds.coolDifferential ?? 1.5;
        settings.thresholds.heatDifferential = 2.0;
        settings.thresholds.coolDifferential = 2.0;
        changes.push(
          `Heat/Cool differential: ${oldHeatDiff}°F / ${oldCoolDiff}°F → 2.0°F`
        );

        saveThermostatSettings(settings);

        // Note: We don't call onSettingChange here because thermostat settings
        // are stored separately from userSettings (in thermostatSettings localStorage key)
        // The saveThermostatSettings call above handles persistence and dispatches
        // the "thermostatSettingsChanged" event for reactive updates

        const reason = parsed.reason ? `\n${parsed.reason}` : "";
        setOutput({
          message: `✓ Sleep mode quiet operation enabled:${reason}\n${changes.join(
            "\n"
          )}\n\nThis reduces the number of starts/stops at night for quieter operation.`,
          status: "success",
        });
        if (speak)
          speak(
            "Sleep mode quiet operation enabled. This reduces cycling at night."
          );
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to fix sleep cycling: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "fixWindowFogging": {
      try {
        const settings = loadThermostatSettings();
        const changes = [];

        // Increase AC Overcool Max to 3°F for aggressive dehumidification
        const oldOvercool = settings.thresholds.acOvercoolMax;
        settings.thresholds.acOvercoolMax = 3;
        changes.push(`AC overcool: ${oldOvercool}°F → 3°F`);

        saveThermostatSettings(settings);

        // Note: We don't call onSettingChange here because thermostat settings
        // are stored separately from userSettings (in thermostatSettings localStorage key)
        // The saveThermostatSettings call above handles persistence and dispatches
        // the "thermostatSettingsChanged" event for reactive updates

        const reason = parsed.reason ? `\n${parsed.reason}` : "";
        setOutput({
          message: `✓ Window fogging fix applied:${reason}\n${changes.join(
            "\n"
          )}\n\nThis increases dehumidification to reduce indoor humidity and prevent window fogging.`,
          status: "success",
        });
        if (speak)
          speak(
            "Window fogging fix applied. Increasing dehumidification to reduce humidity."
          );
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to fix window fogging: ${error.message}`,
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
  const { setOutput } = callbacks;

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
        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: "✓ Groq API key updated successfully",
          status: "success",
        });
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
        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ Groq model set to ${model}`,
          status: "success",
        });
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
        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ Voice listening duration set to ${seconds} seconds`,
          status: "success",
        });
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
        // setOutput automatically handles TTS for info messages - no need to call speak() directly
        setOutput({
          message: `✓ Current Groq model: ${model}`,
          status: "info",
        });
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
        // setOutput automatically handles TTS for info messages - no need to call speak() directly
        setOutput({
          message: `✓ Voice listening duration: ${seconds} seconds`,
          status: "info",
        });
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
  const { setOutput, speak, userSettings } = callbacks;

  switch (parsed.action) {
    case "queryMode": {
      try {
        // Get current HVAC mode from localStorage (set by setMode command)
        let currentMode = localStorage.getItem("hvacMode");

        // If not in localStorage, try to get from thermostat settings or default
        if (!currentMode) {
          try {
            const thermostatSettings = loadThermostatSettings();
            // Check if there's a mode in thermostat settings
            currentMode = thermostatSettings?.mode || "auto";
          } catch {
            currentMode = "auto"; // Default fallback
          }
        }

        const modeLabels = {
          heat: "Heat",
          cool: "Cool",
          auto: "Auto Heat/Cool",
          off: "Off",
        };

        const modeLabel = modeLabels[currentMode] || currentMode;

        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ Current HVAC mode: ${modeLabel}`,
          status: "success",
        });
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to get current mode: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "queryTargetTemp": {
      try {
        // Get current target temperature from userSettings
        const targetTemp =
          userSettings?.winterThermostat ||
          userSettings?.summerThermostat ||
          70;
        const mode = userSettings?.energyMode || "heating";
        const tempLabel = mode === "heating" ? "winter" : "summer";

        setOutput({
          message: `✓ Target temperature is set to ${targetTemp}°F (${tempLabel} setpoint).`,
          status: "success",
        });
        if (speak)
          speak(`Target temperature is ${targetTemp} degrees Fahrenheit`);
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to get target temperature: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

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
          // setOutput automatically handles TTS for info messages - no need to call speak() directly
          setOutput({
            message:
              "✅ No system issues detected. Upload thermostat data in the Performance Analyzer to check your system.",
            status: "info",
          });
        } else {
          // Filter out impossible temperature swings (e.g., >20°F in 1 hour is physically impossible)
          const validIssues = diagnostics.issues.filter((issue) => {
            if (issue.type === "temperature_instability") {
              // Extract swing value from description (e.g., "67.3°F swing in 1 hour")
              const swingMatch = issue.description?.match(
                /(\d+\.?\d*)\s*°?F?\s*swing/i
              );
              if (swingMatch) {
                const swingValue = parseFloat(swingMatch[1]);
                // Filter out impossible swings (>20°F in 1 hour is physically impossible in a normal home)
                if (swingValue > 20) {
                  console.warn(
                    `[Diagnostics] Filtered out impossible temperature swing: ${swingValue}°F`
                  );
                  return false;
                }
              }
            }
            return true;
          });

          const issueList = validIssues
            .slice(0, 3)
            .map((i) => `• ${i.description}`)
            .join("\n");
          const more =
            validIssues.length > 3
              ? `\n... and ${validIssues.length - 3} more issues`
              : "";
          const totalValidIssues = validIssues.length;

          if (totalValidIssues === 0) {
            setOutput({
              message:
                "✅ No system issues detected after filtering invalid diagnostics.",
              status: "success",
            });
          } else {
            setOutput({
              message: `⚠️ **System Diagnostics**\n\nFound ${totalValidIssues} issue(s):\n${issueList}${more}\n\nView Performance Analyzer for details.`,
              status: "warning",
            });
          }
          // TTS should use filtered count, not raw count
          if (speak && totalValidIssues > 0) {
            speak(
              `Found ${totalValidIssues} system ${
                totalValidIssues === 1 ? "issue" : "issues"
              }. Check the performance analyzer for details.`
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
          // setOutput automatically handles TTS for warning messages - no need to call speak() directly
          setOutput({
            message: `⚠️ ${shortCycling.description}\n\nShort cycling reduces efficiency and can damage your compressor. Consider checking: refrigerant levels, thermostat placement, or filter cleanliness.`,
            status: "warning",
          });
        } else {
          // setOutput automatically handles TTS for success messages - no need to call speak() directly
          setOutput({
            message: "✅ No short cycling detected in your thermostat data.",
            status: "success",
          });
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
          // setOutput automatically handles TTS for warning messages - no need to call speak() directly
          setOutput({
            message: `⚠️ ${auxHeat.description}\n\nAux heat (${auxHeat.details?.auxPercentage}% of runtime) is expensive! Check your balance point setting or thermostat configuration.`,
            status: "warning",
          });
        } else {
          // setOutput automatically handles TTS for success messages - no need to call speak() directly
          setOutput({
            message: "✅ Auxiliary heat usage is within normal range.",
            status: "success",
          });
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
          // setOutput automatically handles TTS for warning messages - no need to call speak() directly
          setOutput({
            message: `⚠️ ${tempStability.description}\n\nLarge temperature swings may indicate thermostat issues, poor insulation, or undersized equipment.`,
            status: "warning",
          });
        } else {
          // setOutput automatically handles TTS for success messages - no need to call speak() directly
          setOutput({
            message: "✅ Indoor temperature stability looks good.",
            status: "success",
          });
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

    case "queryThreshold": {
      try {
        const settings = loadThermostatSettings();
        const settingName = parsed.setting;
        const value = settings.thresholds[settingName];

        if (value === undefined || value === null) {
          setOutput({
            message: `Setting "${settingName}" not found in thermostat settings.`,
            status: "error",
          });
          return { handled: true, error: "Setting not found" };
        }

        // Map setting names to friendly labels
        const settingLabels = {
          acOvercoolMax: "AC Overcool Max",
          heatDifferential: "Heat Differential",
          coolDifferential: "Cool Differential",
          compressorMinOutdoorTemp: "Compressor Lockout",
          auxHeatMaxOutdoorTemp: "Aux Heat Lockout",
          heatCoolMinDelta: "Heat/Cool Min Delta",
          heatMinOnTime: "Heat Min On Time",
          coolMinOnTime: "Cool Min On Time",
          compressorMinOnTime: "Compressor Min On Time",
          compressorMinCycleOff: "Compressor Min Off Time",
          heatDissipationTime: "Heat Dissipation Time",
          coolDissipationTime: "Cool Dissipation Time",
          temperatureCorrection: "Temperature Correction",
          humidityCorrection: "Humidity Correction",
          thermalProtect: "Thermal Protect",
          compressorStage2Delta: "Compressor Stage 2 Delta",
          compressorStage1MaxRuntime: "Compressor Stage 1 Max Runtime",
          heatStage2Delta: "Heat Stage 2 Delta",
          heatStage1MaxRuntime: "Heat Stage 1 Max Runtime",
          auxStage2Delta: "Aux Stage 2 Delta",
          auxStage1MaxRuntime: "Aux Stage 1 Max Runtime",
          compressorToAuxTempDelta: "Compressor to Aux Delta",
          compressorToAuxRuntime: "Compressor to Aux Runtime",
        };

        const label = settingLabels[settingName] || settingName;

        // Format the value with appropriate units
        let formattedValue = value;
        if (
          settingName.includes("Temp") ||
          settingName.includes("Delta") ||
          settingName.includes("Differential") ||
          settingName.includes("Overcool") ||
          (settingName.includes("Correction") &&
            !settingName.includes("Humidity"))
        ) {
          formattedValue = `${value}°F`;
        } else if (
          settingName.includes("Time") ||
          settingName.includes("On") ||
          settingName.includes("Off")
        ) {
          const minutes = Math.round(value / 60);
          formattedValue = `${minutes} min (${value} sec)`;
        } else if (
          settingName.includes("Correction") &&
          settingName.includes("Humidity")
        ) {
          formattedValue = `${value}%`;
        }

        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ ${label}: ${formattedValue}`,
          status: "success",
        });
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to read threshold setting: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "queryComfortSetting": {
      try {
        const settings = loadThermostatSettings();
        const settingPath = parsed.setting; // e.g., "sleep.heatSetPoint"
        const [comfortType, settingType] = settingPath.split(".");

        if (
          !settings.comfortSettings ||
          !settings.comfortSettings[comfortType]
        ) {
          setOutput({
            message: `Comfort setting "${comfortType}" not found.`,
            status: "error",
          });
          return { handled: true, error: "Comfort setting not found" };
        }

        const value = settings.comfortSettings[comfortType][settingType];

        if (value === undefined || value === null) {
          setOutput({
            message: `Setting "${settingPath}" not found in comfort settings.`,
            status: "error",
          });
          return { handled: true, error: "Setting not found" };
        }

        // Map comfort types and setting types to friendly labels
        const comfortLabels = {
          sleep: "Sleep",
          home: "Home",
          away: "Away",
        };

        const settingLabels = {
          heatSetPoint: "Heat Setpoint",
          coolSetPoint: "Cool Setpoint",
          humiditySetPoint: "Humidity Setpoint",
          fanMode: "Fan Mode",
        };

        const comfortLabel = comfortLabels[comfortType] || comfortType;
        const settingLabel = settingLabels[settingType] || settingType;
        const fullLabel = `${comfortLabel} ${settingLabel}`;

        // Format the value with appropriate units
        let formattedValue = value;
        if (settingType.includes("SetPoint")) {
          formattedValue = `${value}°F`;
        } else if (settingType.includes("humidity")) {
          formattedValue = `${value}%`;
        }

        setOutput({
          message: `${fullLabel}: ${formattedValue}`,
          status: "success",
        });

        return { handled: true, value, label: fullLabel };
      } catch (error) {
        setOutput({
          message: `Failed to query comfort setting: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "querySchedule": {
      try {
        const settings = loadThermostatSettings();
        const schedule = settings.schedule || {};
        const enabled = schedule.enabled !== false;
        const dayNames = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];

        if (!enabled) {
          setOutput({
            message: "Schedule is currently disabled.",
            status: "info",
          });
          return { handled: true };
        }

        let scheduleText = "Weekly Schedule:\n\n";
        for (let day = 0; day < 7; day++) {
          const daySchedule = schedule.weekly?.[day] || [];
          scheduleText += `${dayNames[day]}:\n`;
          if (daySchedule.length === 0) {
            scheduleText += "  No entries\n";
          } else {
            daySchedule.forEach((entry) => {
              const [hours, minutes] = entry.time.split(":").map(Number);
              const displayTime =
                hours > 12
                  ? `${hours - 12}:${String(minutes).padStart(2, "0")} PM`
                  : hours === 12
                  ? `12:${String(minutes).padStart(2, "0")} PM`
                  : hours === 0
                  ? `12:${String(minutes).padStart(2, "0")} AM`
                  : `${hours}:${String(minutes).padStart(2, "0")} AM`;
              scheduleText += `  ${displayTime} - ${entry.comfortSetting}\n`;
            });
          }
          scheduleText += "\n";
        }

        setOutput({
          message: scheduleText,
          status: "success",
        });
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to query schedule: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "queryScheduleDay": {
      try {
        const settings = loadThermostatSettings();
        const day = parsed.day;
        const dayNames = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];
        const daySchedule = settings.schedule?.weekly?.[day] || [];

        let scheduleText = `${dayNames[day]} Schedule:\n`;
        if (daySchedule.length === 0) {
          scheduleText += "No entries";
        } else {
          daySchedule.forEach((entry) => {
            const [hours, minutes] = entry.time.split(":").map(Number);
            const displayTime =
              hours > 12
                ? `${hours - 12}:${String(minutes).padStart(2, "0")} PM`
                : hours === 12
                ? `12:${String(minutes).padStart(2, "0")} PM`
                : hours === 0
                ? `12:${String(minutes).padStart(2, "0")} AM`
                : `${hours}:${String(minutes).padStart(2, "0")} AM`;
            scheduleText += `${displayTime} - ${entry.comfortSetting}\n`;
          });
        }

        setOutput({
          message: scheduleText,
          status: "success",
        });
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to query schedule: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "setScheduleEnabled": {
      try {
        const settings = loadThermostatSettings();
        settings.schedule = settings.schedule || {};
        settings.schedule.enabled = parsed.value;
        saveThermostatSettings(settings);

        window.dispatchEvent(
          new CustomEvent("thermostatSettingsUpdated", {
            detail: { schedule: { enabled: parsed.value } },
          })
        );

        // Note: Schedule settings are managed by saveThermostatSettings, not onSettingChange
        // The event dispatch above handles reactive updates

        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ Schedule ${parsed.value ? "enabled" : "disabled"}`,
          status: "success",
        });
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to ${
            parsed.value ? "enable" : "disable"
          } schedule: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "addScheduleEntry": {
      try {
        const settings = loadThermostatSettings();
        const day = parsed.day;
        const time = parsed.time;
        const comfortSetting = parsed.comfortSetting;

        if (!settings.schedule) {
          settings.schedule = { enabled: true, weekly: {} };
        }
        if (!settings.schedule.weekly) {
          settings.schedule.weekly = {};
        }
        if (!settings.schedule.weekly[day]) {
          settings.schedule.weekly[day] = [];
        }

        const daySchedule = settings.schedule.weekly[day];

        // Check if entry already exists at this time
        const existingIndex = daySchedule.findIndex((e) => e.time === time);
        if (existingIndex >= 0) {
          daySchedule[existingIndex].comfortSetting = comfortSetting;
        } else {
          daySchedule.push({ time, comfortSetting });
          daySchedule.sort((a, b) => a.time.localeCompare(b.time));
        }

        saveThermostatSettings(settings);

        window.dispatchEvent(
          new CustomEvent("thermostatSettingsUpdated", {
            detail: { schedule: { weekly: { [day]: daySchedule } } },
          })
        );

        const dayNames = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];
        const [hours, minutes] = time.split(":").map(Number);
        const displayTime =
          hours > 12
            ? `${hours - 12}:${String(minutes).padStart(2, "0")} PM`
            : hours === 12
            ? `12:${String(minutes).padStart(2, "0")} PM`
            : hours === 0
            ? `12:${String(minutes).padStart(2, "0")} AM`
            : `${hours}:${String(minutes).padStart(2, "0")} AM`;

        setOutput({
          message: `✓ Added schedule entry: ${dayNames[day]} at ${displayTime} → ${comfortSetting}`,
          status: "success",
        });
        if (speak)
          speak(`Added schedule entry for ${dayNames[day]} at ${displayTime}`);
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to add schedule entry: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "clearScheduleDay": {
      try {
        const settings = loadThermostatSettings();
        const day = parsed.day;

        if (!settings.schedule) {
          settings.schedule = { enabled: true, weekly: {} };
        }
        if (!settings.schedule.weekly) {
          settings.schedule.weekly = {};
        }

        settings.schedule.weekly[day] = [];
        saveThermostatSettings(settings);

        window.dispatchEvent(
          new CustomEvent("thermostatSettingsUpdated", {
            detail: { schedule: { weekly: { [day]: [] } } },
          })
        );

        const dayNames = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];

        // setOutput automatically handles TTS for success messages - no need to call speak() directly
        setOutput({
          message: `✓ Cleared schedule for ${dayNames[day]}`,
          status: "success",
        });
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to clear schedule: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    case "copyScheduleDay": {
      try {
        const settings = loadThermostatSettings();
        const fromDay = parsed.fromDay;
        const toDay = parsed.toDay;

        if (!settings.schedule) {
          settings.schedule = { enabled: true, weekly: {} };
        }
        if (!settings.schedule.weekly) {
          settings.schedule.weekly = {};
        }

        const sourceSchedule = settings.schedule.weekly[fromDay] || [];
        settings.schedule.weekly[toDay] = JSON.parse(
          JSON.stringify(sourceSchedule)
        );
        saveThermostatSettings(settings);

        window.dispatchEvent(
          new CustomEvent("thermostatSettingsUpdated", {
            detail: {
              schedule: {
                weekly: { [toDay]: settings.schedule.weekly[toDay] },
              },
            },
          })
        );

        const dayNames = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];

        setOutput({
          message: `✓ Copied schedule from ${dayNames[fromDay]} to ${dayNames[toDay]}`,
          status: "success",
        });
        if (speak)
          speak(
            `Copied schedule from ${dayNames[fromDay]} to ${dayNames[toDay]}`
          );
        return { handled: true };
      } catch (error) {
        setOutput({
          message: `Failed to copy schedule: ${error.message}`,
          status: "error",
        });
        return { handled: true, error: error.message };
      }
    }

    default:
      return { handled: false };
  }
}
