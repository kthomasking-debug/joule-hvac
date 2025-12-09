// src/hooks/useAskJouleController.js
// Controller hook for AskJoule - separates logic from presentation

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { useSpeechSynthesis } from "./useSpeechSynthesis";
import { useConversationContext } from "../contexts/ConversationContext";
import { useProactiveAgent } from "./useProactiveAgent";
import { parseAskJoule } from "../utils/askJouleParser";
import { executeCommand } from "../utils/nlp/commandExecutor";
import { resolvePronouns } from "../utils/nlp/contextResolver";
import { fetchGeocodeCandidates, chooseBestCandidate } from "../utils/geocode";
import { answerWithAgent } from "../lib/groqAgent";
import {
  calculateBalancePoint,
  formatBalancePointResponse,
} from "../utils/balancePointCalculator";
import {
  calculateCharging,
  formatChargingResponse,
  calculatePerformanceMetrics,
  formatPerformanceResponse,
  calculateSetbackSavings,
  formatSetbackResponse,
  compareHeatingSystems,
  formatComparisonResponse,
} from "../utils/calculatorEngines";
import {
  getPersonalizedResponse,
  EDUCATIONAL_CONTENT,
  HELP_CONTENT,
  getContextualSuggestions,
} from "../utils/askJouleContent";
import {
  handleSettingCommand,
  handlePresetCommand,
  handleTempAdjustment,
  handleNavigationCommand,
  handleEducationalCommand,
  handleHelpCommand,
  handleDarkModeCommand,
  handleThermostatSettingCommand,
  handleDiagnosticCommand,
} from "../utils/askJouleCommandHandlers";

/**
 * Consolidated state for UI interactions
 * @typedef {Object} InteractionState
 * @property {string} inputValue - Current input field value
 * @property {string} error - Error/status message to display
 * @property {string} outputStatus - 'success' | 'error' | 'info' | 'warning' | ''
 * @property {string} answer - AI response answer
 * @property {object|null} agenticResponse - Structured agentic response
 * @property {string} loadingMessage - Loading indicator message
 * @property {boolean} isLoading - Whether processing a request
 */

/**
 * Initial interaction state
 */
const INITIAL_INTERACTION_STATE = {
  inputValue: "",
  error: "",
  outputStatus: "",
  answer: "",
  agenticResponse: null,
  loadingMessage: "",
  isLoading: false,
};

/**
 * Custom hook to manage AskJoule controller logic
 * Separates business logic from presentation layer
 *
 * @param {object} props - Component props
 * @returns {object} Controller state and actions
 */
export function useAskJouleController(props) {
  const {
    tts: ttsProp,
    groqKey: groqKeyProp,
    userSettings = {},
    userLocation = null,
    annualEstimate = null,
    recommendations = [],
    onNavigate = null,
    onSettingChange = null,
    onUndo = null,
  } = props;

  const navigate = useNavigate();
  const inputRef = useRef(null);
  const submitRef = useRef(null);

  // ===== Consolidated Interaction State =====
  const [interaction, setInteraction] = useState(INITIAL_INTERACTION_STATE);

  // Helper to update interaction state
  const updateInteraction = useCallback((updates) => {
    setInteraction((prev) => ({ ...prev, ...updates }));
  }, []);

  // Helper for setOutput pattern used by command handlers
  const setOutput = useCallback(
    ({ message, status }) => {
      updateInteraction({ error: message, outputStatus: status });
    },
    [updateInteraction]
  );

  // ===== UI State =====
  const [showGroqPrompt, setShowGroqPrompt] = useState(false);
  const [lastQuery, setLastQuery] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasAskedQuestion, setHasAskedQuestion] = useState(false);
  const [showCommandHelp, setShowCommandHelp] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showPersonalization, setShowPersonalization] = useState(false);
  const [briefing, setBriefing] = useState(null);

  // ===== Command History =====
  const [commandHistory, setCommandHistory] = useState(() => {
    try {
      const stored = localStorage.getItem("askJouleHistory");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [historyIndex, setHistoryIndex] = useState(-1);

  // ===== Mode Toggles =====
  const [agenticMode, setAgenticMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("askJouleAgenticMode") === "on";
  });

  const [aiMode, setAiMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("askJouleAiMode") === "on";
  });

  const [ttsOn, setTtsOn] = useState(() => {
    if (typeof window === "undefined") return false;
    if (typeof ttsProp === "boolean") return ttsProp;
    return localStorage.getItem("askJouleTts") === "on";
  });

  // ===== Agentic Processing State =====
  const [executionProgress, setExecutionProgress] = useState([]);
  const [isAgenticProcessing, setIsAgenticProcessing] = useState(false);

  // ===== Settings Management =====
  const [localUserSettings, setLocalUserSettings] = useState(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem("userSettings");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Merge prop and local settings (prop takes precedence)
  const effectiveUserSettings = useMemo(() => {
    return { ...localUserSettings, ...userSettings };
  }, [localUserSettings, userSettings]);

  // ===== API Keys =====
  const groqApiKey = useMemo(() => {
    if (typeof groqKeyProp === "string" && groqKeyProp) return groqKeyProp;
    if (typeof window === "undefined") return "";
    return (localStorage.getItem("groqApiKey") || "").trim();
  }, [groqKeyProp]);

  const groqModel = useMemo(() => {
    if (typeof window === "undefined") return "llama-3.3-70b-versatile";
    return localStorage.getItem("groqModel") || "llama-3.3-70b-versatile";
  }, []);

  // ===== Location =====
  const userLocationFromStorage = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("userLocation");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const effectiveUserLocation = userLocation || userLocationFromStorage;

  // ===== Conversation Context =====
  const { history, addInteraction } = useConversationContext();

  // ===== Contextual Suggestions =====
  const contextualSuggestions = useMemo(() => {
    return getContextualSuggestions({
      recommendations,
      userSettings: effectiveUserSettings,
      userLocation: effectiveUserLocation,
    });
  }, [recommendations, effectiveUserSettings, effectiveUserLocation]);

  // ===== Proactive Agent =====
  const thermostatDataForProactive = useMemo(() => {
    try {
      const stored = localStorage.getItem("thermostatCSVData");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const {
    alerts: proactiveAlerts,
    briefing: dailyBriefingFromHook,
    hasAlerts,
    checkAlerts,
    getBriefing,
  } = useProactiveAgent(thermostatDataForProactive, effectiveUserSettings);

  // Sync briefing from hook to local state
  useEffect(() => {
    if (dailyBriefingFromHook) {
      setBriefing(dailyBriefingFromHook);
    }
  }, [dailyBriefingFromHook]);

  // ===== Speech Recognition =====
  const {
    supported: recognitionSupported,
    isListening,
    transcript,
    error: speechError,
    restartCount,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    interim: true,
    continuous: true,
    autoRestart: true,
    maxAutoRestarts: 8,
    autoStopOnFinal: true,
    onInterim: (chunk) => {
      setInteraction((prev) => {
        if (prev.inputValue && !prev.inputValue.endsWith(chunk)) return prev;
        return { ...prev, inputValue: transcript || chunk };
      });
    },
    onFinal: (finalText) => {
      if (!finalText) return;
      updateInteraction({ inputValue: finalText });
      setTimeout(() => {
        try {
          if (submitRef.current)
            submitRef.current({ preventDefault: () => {} });
        } catch {
          /* ignore */
        }
      }, 160);
    },
  });

  // Update input live while listening
  useEffect(() => {
    if (isListening && transcript) {
      updateInteraction({ inputValue: transcript });
    }
  }, [isListening, transcript, updateInteraction]);

  // ===== Speech Synthesis =====
  const {
    speak,
    speakImmediate,
    cancel: stopSpeaking,
    isEnabled: speechEnabled,
    isSpeaking,
    toggleEnabled: toggleSpeech,
  } = useSpeechSynthesis({
    enabled: ttsOn,
    personality: "friendly",
  });

  // ===== Storage Change Listener =====
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const raw = localStorage.getItem("userSettings");
        const updated = raw ? JSON.parse(raw) : {};
        if (groqKeyProp) updated.groqKey = groqKeyProp;
        const apiKey = localStorage.getItem("groqApiKey");
        if (apiKey && !updated.groqKey) updated.groqKey = apiKey.trim();
        setLocalUserSettings(updated);
      } catch {
        setLocalUserSettings({});
      }
    };

    window.addEventListener("storage", handleStorageChange);
    handleStorageChange();
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [groqKeyProp]);

  // ===== Filter Suggestions =====
  useEffect(() => {
    const value = interaction.inputValue;
    if (!value.trim()) {
      if (suggestions.length > 0) setSuggestions([]);
      if (showSuggestions) setShowSuggestions(false);
      return;
    }

    const filtered = contextualSuggestions
      .filter((s) => s.toLowerCase().includes(value.toLowerCase()))
      .slice(0, 5);

    const isSame =
      filtered.length === suggestions.length &&
      filtered.every((v, i) => v === suggestions[i]);
    if (!isSame) setSuggestions(filtered);

    const shouldShow = filtered.length > 0 && value.length > 2;
    if (shouldShow !== showSuggestions) setShowSuggestions(shouldShow);
  }, [
    interaction.inputValue,
    contextualSuggestions,
    suggestions,
    showSuggestions,
  ]);

  // ===== Command History Navigation =====
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target !== inputRef.current) return;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (commandHistory.length === 0) return;
        const newIndex =
          historyIndex < commandHistory.length - 1
            ? historyIndex + 1
            : commandHistory.length - 1;
        setHistoryIndex(newIndex);
        updateInteraction({ inputValue: commandHistory[newIndex] || "" });
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex <= 0) {
          setHistoryIndex(-1);
          updateInteraction({ inputValue: "" });
        } else {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          updateInteraction({ inputValue: commandHistory[newIndex] || "" });
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        updateInteraction({
          inputValue: "",
          error: "",
          answer: "",
          agenticResponse: null,
        });
        setHistoryIndex(-1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandHistory, historyIndex, updateInteraction]);

  // ===== Save to History =====
  const saveToHistory = useCallback((command) => {
    if (!command || !command.trim()) return;
    setCommandHistory((prev) => {
      const updated = [command, ...prev.filter((c) => c !== command)].slice(
        0,
        50
      );
      try {
        localStorage.setItem("askJouleHistory", JSON.stringify(updated));
      } catch {
        /* ignore */
      }
      return updated;
    });
    setHistoryIndex(-1);
  }, []);

  // ===== Command Callbacks =====
  const commandCallbacks = useMemo(
    () => ({
      onSettingChange,
      setOutput,
      speak,
      navigate,
      onNavigate,
    }),
    [onSettingChange, setOutput, speak, navigate, onNavigate]
  );

  // ===== Handle Local Command =====
  const handleCommand = useCallback(
    (parsed) => {
      if (!parsed.isCommand) return false;

      updateInteraction({ error: "" });
      stopSpeaking();

      const { action } = parsed;

      // Temperature adjustments
      if (action === "increaseTemp" || action === "decreaseTemp") {
        const currentTemp = effectiveUserSettings.winterThermostat || 68;
        const result = handleTempAdjustment(
          action === "increaseTemp" ? "up" : "down",
          parsed.value,
          currentTemp,
          commandCallbacks
        );
        return result.handled;
      }

      // Presets
      if (
        action === "presetSleep" ||
        action === "presetAway" ||
        action === "presetHome"
      ) {
        const presetType = action.replace("preset", "").toLowerCase();
        const result = handlePresetCommand(presetType, commandCallbacks);
        return result.handled;
      }

      // Query temperature
      if (action === "queryTemp") {
        const temp = effectiveUserSettings.winterThermostat || 68;
        const response = getPersonalizedResponse("queryTemp", { temp });
        setOutput({ message: response, status: "info" });
        speak(response);
        return true;
      }

      // Settings commands (using config map)
      const settingResult = handleSettingCommand(parsed, commandCallbacks);
      if (settingResult) return true;

      // Navigation
      if (action === "navigate") {
        const result = handleNavigationCommand(parsed, commandCallbacks);
        return result.handled;
      }

      // Educational content
      if (action === "educate") {
        const result = handleEducationalCommand(parsed.topic, { setOutput });
        return result.handled;
      }

      // Help
      if (action === "showHelp") {
        handleHelpCommand(commandCallbacks);
        return true;
      }

      // Dark mode
      if (action === "setDarkMode" || action === "toggleDarkMode") {
        handleDarkModeCommand(parsed, commandCallbacks);
        return true;
      }

      // Thermostat-specific settings
      const thermostatResult = handleThermostatSettingCommand(
        parsed,
        commandCallbacks
      );
      if (thermostatResult.handled) return true;

      // Diagnostic commands
      const diagnosticResult = handleDiagnosticCommand(
        parsed,
        commandCallbacks
      );
      if (diagnosticResult.handled) return true;

      // Undo
      if (action === "undo") {
        if (typeof onUndo === "function") {
          const success = onUndo(parsed.when || "last");
          setOutput({
            message: success ? "✓ Undid last change" : "No change to undo.",
            status: success ? "success" : "error",
          });
        } else {
          setOutput({
            message: "Undo is not available here.",
            status: "error",
          });
        }
        return true;
      }

      // What-if scenarios
      if (
        action === "whatIfHSPF" &&
        annualEstimate &&
        effectiveUserSettings.hspf2
      ) {
        const currentHSPF = Number(effectiveUserSettings.hspf2) || 9;
        const newHSPF = parsed.value;
        const improvementRatio = newHSPF / currentHSPF;
        const currentHeating = annualEstimate.heatingCost || 0;
        const newCost = currentHeating / improvementRatio;
        const savings = currentHeating - newCost;
        setOutput({
          message: `With ${newHSPF} HSPF2: Heating cost would be $${Math.round(
            newCost
          )}/year (save $${Math.round(savings)})`,
          status: "info",
        });
        return true;
      }

      if (
        action === "whatIfSEER" &&
        annualEstimate &&
        effectiveUserSettings.efficiency
      ) {
        const currentSEER = Number(effectiveUserSettings.efficiency) || 15;
        const newSEER = parsed.value;
        const improvementRatio = newSEER / currentSEER;
        const currentCooling = annualEstimate.coolingCost || 0;
        const newCost = currentCooling / improvementRatio;
        const savings = currentCooling - newCost;
        setOutput({
          message: `With ${newSEER} SEER2: Cooling cost would be $${Math.round(
            newCost
          )}/year (save $${Math.round(savings)})`,
          status: "info",
        });
        return true;
      }

      // Show savings
      if (action === "showSavings") {
        if (recommendations.length > 0) {
          const topRec = recommendations[0];
          setOutput({
            message: `💡 ${topRec.title}: ${topRec.message}`,
            status: "info",
          });
        } else {
          setOutput({
            message:
              "Great news! Your system is already well-optimized. Check Settings for minor improvements.",
            status: "info",
          });
        }
        return true;
      }

      // Show score
      if (action === "showScore") {
        if (effectiveUserSettings.hspf2 && effectiveUserSettings.efficiency) {
          const hspf = Number(effectiveUserSettings.hspf2) || 9;
          const seer = Number(effectiveUserSettings.efficiency) || 15;
          const score = Math.max(
            1,
            Math.min(100, 70 + (hspf - 8) * 2 + (seer - 14) * 1.2)
          );
          setOutput({
            message: `🎯 Your Joule Score: ${Math.round(
              score
            )}/100 (HSPF: ${hspf.toFixed(1)}, SEER: ${seer.toFixed(1)})`,
            status: "success",
          });
        } else {
          setOutput({
            message: "Complete your system settings to see your Joule Score!",
            status: "info",
          });
        }
        return true;
      }

      // System status
      if (action === "systemStatus") {
        if (effectiveUserSettings.hspf2 && annualEstimate) {
          const status = [];
          status.push(
            `System: ${effectiveUserSettings.hspf2} HSPF2 / ${effectiveUserSettings.efficiency} SEER2`
          );
          status.push(`Annual cost: $${Math.round(annualEstimate.totalCost)}`);
          if (recommendations.length > 0) {
            status.push(
              `💡 ${recommendations.length} improvement(s) available`
            );
          }
          setOutput({ message: status.join(" • "), status: "info" });
        } else {
          // Provide more specific and helpful error message
          let message;
          if (!effectiveUserLocation) {
            message = "Set your location to see system status.";
          } else if (!effectiveUserSettings.hspf2 && !effectiveUserSettings.efficiency) {
            message = "Set your system efficiency (HSPF2 and/or SEER2) to see status.";
          } else if (!annualEstimate) {
            // Location is set but annualEstimate is null - need building details
            message = "Set your building details (square footage, insulation level, etc.) in Settings to calculate your annual costs.";
          } else {
            message = "Unable to calculate status. Please check your settings.";
          }
          setOutput({ message, status: "info" });
        }
        return true;
      }

      // Explain bill
      if (action === "explainBill") {
        if (annualEstimate && effectiveUserLocation) {
          const reasons = [];
          if (annualEstimate.hdd > 5000)
            reasons.push(`cold climate (${annualEstimate.hdd} HDD)`);
          if (annualEstimate.cdd > 2000)
            reasons.push(`hot climate (${annualEstimate.cdd} CDD)`);
          if (effectiveUserSettings.hspf2 < 9)
            reasons.push(`low HSPF2 (${effectiveUserSettings.hspf2})`);
          if (effectiveUserSettings.insulationLevel > 1.1)
            reasons.push("poor insulation");
          if (annualEstimate.auxKwhIncluded > 1000)
            reasons.push("high aux heat usage");

          if (reasons.length > 0) {
            setOutput({
              message: `💡 Bill factors: ${reasons.join(
                ", "
              )}. See recommendations for fixes!`,
              status: "info",
            });
          } else {
            setOutput({
              message: `Your costs look normal for ${
                effectiveUserLocation.city
              }. Annual: $${Math.round(annualEstimate.totalCost)}`,
              status: "info",
            });
          }
        } else {
          setOutput({
            message: "Set your location to analyze your bill.",
            status: "info",
          });
        }
        return true;
      }

      // Break-even calculation
      if (action === "breakEven") {
        if (annualEstimate && recommendations.length > 0) {
          const totalSavings = recommendations.reduce(
            (sum, r) => sum + (r.savingsEstimate || 0),
            0
          );
          const years = parsed.cost / totalSavings;
          setOutput({
            message: `With $${parsed.cost.toLocaleString()} upgrade saving $${Math.round(
              totalSavings
            )}/year: Break-even in ${years.toFixed(1)} years`,
            status: "info",
          });
        } else {
          setOutput({
            message:
              "Set your location and system details to calculate payback period.",
            status: "info",
          });
        }
        return true;
      }

      // Unrecognized command
      setOutput({
        message: "❌ Sorry, I didn't recognize that command.",
        status: "error",
      });
      return false;
    },
    [
      effectiveUserSettings,
      effectiveUserLocation,
      annualEstimate,
      recommendations,
      commandCallbacks,
      onUndo,
      stopSpeaking,
      updateInteraction,
      setOutput,
      speak,
    ]
  );

  // ===== Handle Agentic Query =====
  const handleAgenticQuery = useCallback(
    async (query) => {
      updateInteraction({
        isLoading: true,
        loadingMessage: "🤖 Planning agent execution...",
      });
      setIsAgenticProcessing(true);
      setExecutionProgress([]);

      let thermostatData = null;
      try {
        const stored = localStorage.getItem("thermostatCSVData");
        if (stored) thermostatData = JSON.parse(stored);
      } catch {
        /* ignore */
      }

      try {
        const conversationHistory = history.slice(-10).map((entry) => ({
          role: entry.role || "user",
          content: entry.content || entry.raw || String(entry),
        }));

        const result = await answerWithAgent(
          query,
          groqApiKey,
          thermostatData,
          effectiveUserSettings,
          effectiveUserLocation,
          conversationHistory,
          groqModel
        );

        if (result.error) {
          updateInteraction({
            error: result.message || "An error occurred",
            outputStatus: "error",
            isLoading: false,
            loadingMessage: "",
          });
          return;
        }

        const response =
          result.answer || result.message || result.response || "";
        updateInteraction({
          answer: response,
          agenticResponse: result,
          outputStatus: "",
          error: "",
          isLoading: false,
          loadingMessage: "",
        });

        if (response && ttsOn) speak(response);

        addInteraction({
          raw: query,
          parsed: { isCommand: false },
          response,
          mode: "agentic",
        });
      } catch (err) {
        console.error("Agentic query failed:", err);
        updateInteraction({
          error: `AI error: ${err.message}`,
          outputStatus: "error",
          isLoading: false,
          loadingMessage: "",
        });
      } finally {
        setIsAgenticProcessing(false);
      }
    },
    [
      groqApiKey,
      groqModel,
      effectiveUserSettings,
      effectiveUserLocation,
      history,
      ttsOn,
      speak,
      addInteraction,
      updateInteraction,
    ]
  );

  // ===== Toggle Functions =====
  const toggleRecording = useCallback(() => {
    if (!recognitionSupported) return;
    if (isListening) stopListening();
    else startListening();
  }, [recognitionSupported, isListening, startListening, stopListening]);

  const toggleAgenticMode = useCallback(() => {
    setAgenticMode((prev) => {
      const newValue = !prev;
      localStorage.setItem("askJouleAgenticMode", newValue ? "on" : "off");
      return newValue;
    });
  }, []);

  const toggleAiMode = useCallback(() => {
    setAiMode((prev) => {
      const newValue = !prev;
      localStorage.setItem("askJouleAiMode", newValue ? "on" : "off");
      return newValue;
    });
  }, []);

  const toggleTts = useCallback(() => {
    setTtsOn((prev) => {
      const newValue = !prev;
      localStorage.setItem("askJouleTts", newValue ? "on" : "off");
      return newValue;
    });
  }, []);

  // ===== Clear Interaction =====
  const clearInteraction = useCallback(() => {
    updateInteraction(INITIAL_INTERACTION_STATE);
    setHistoryIndex(-1);
  }, [updateInteraction]);

  // ===== Set Input Value =====
  const setInputValue = useCallback(
    (value) => {
      updateInteraction({ inputValue: value });
    },
    [updateInteraction]
  );

  // Store submit handler ref for speech recognition
  useEffect(() => {
    submitRef.current = null; // Will be set by component
  }, []);

  return {
    // State
    state: {
      interaction,
      suggestions,
      showSuggestions,
      showGroqPrompt,
      showCommandHelp,
      showAudit,
      showAbout,
      showPersonalization,
      hasAskedQuestion,
      briefing,
      commandHistory,
      historyIndex,
      agenticMode,
      aiMode,
      ttsOn,
      executionProgress,
      isAgenticProcessing,
      proactiveAlerts,
      hasAlerts,
      effectiveUserSettings,
      effectiveUserLocation,
      groqApiKey,
      groqModel,
    },

    // Speech state
    speech: {
      recognitionSupported,
      isListening,
      transcript,
      speechError,
      restartCount,
      isSpeaking,
    },

    // Actions
    actions: {
      setInputValue,
      updateInteraction,
      setOutput,
      handleCommand,
      handleAgenticQuery,
      saveToHistory,
      clearInteraction,
      toggleRecording,
      toggleAgenticMode,
      toggleAiMode,
      toggleTts,
      speak,
      stopSpeaking,
      checkAlerts,
      getBriefing,
      setShowGroqPrompt,
      setShowCommandHelp,
      setShowAudit,
      setShowAbout,
      setShowPersonalization,
      setHasAskedQuestion,
      setLastQuery,
      setShowSuggestions,
    },

    // Refs
    refs: {
      inputRef,
      submitRef,
    },

    // Navigation
    navigate,
  };
}

