import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Send,
  Bot,
  Loader2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import TemperatureDisplay from "../components/TemperatureDisplay";
import useAgentRunner from "../hooks/useAgentRunner";
import useVoiceHMI from "../hooks/useVoiceHMI";
import {
  classifyIntent,
  INTENT_TYPES,
} from "../lib/thermostatIntentClassifier";
import {
  loadThermostatSettings,
  getCurrentSetpoints,
  getCurrentComfortSetting,
} from "../lib/thermostatSettings";

/**
 * ContactorDemo - Visual simulation of HVAC contactors
 * Shows animated contactors for W (heat), Y (cool), and G (fan)
 * Syncs with ShortCycleTest state via localStorage for live demo
 * Features: audio clack, lockout visualization, event-driven sync
 */
export default function ContactorDemo() {
  const [contactorStates, setContactorStates] = useState({
    W: false, // Heat
    Y: false, // Cool/Compressor
    G: false, // Fan
  });
  const [lockoutUntil, setLockoutUntil] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

  // Manual thermostat controls
  const [tempMode, setTempMode] = useState("cpu"); // 'cpu' or 'manual'
  const [manualRoomTemp, setManualRoomTemp] = useState(70);
  const [thermostatSetting, setThermostatSetting] = useState(68);
  const [hvacMode, setHvacMode] = useState("heat"); // 'heat', 'cool', 'auto', 'off'
  const [actualRoomTemp, setActualRoomTemp] = useState(70);

  // Compressor protection tracking
  const [compressorOffTime, setCompressorOffTime] = useState(null); // Timestamp when compressor turned off
  const [compressorProtectionActive, setCompressorProtectionActive] =
    useState(false);

  // Min on-time tracking
  const [heatOnTime, setHeatOnTime] = useState(null); // Timestamp when heat turned on
  const [coolOnTime, setCoolOnTime] = useState(null); // Timestamp when cool turned on
  const [heatMinOnEnforced, setHeatMinOnEnforced] = useState(false);
  const [coolMinOnEnforced, setCoolMinOnEnforced] = useState(false);

  // Dissipation time tracking
  const [dissipationActive, setDissipationActive] = useState(false);
  const [dissipationEndTime, setDissipationEndTime] = useState(null);
  const [dissipationType, setDissipationType] = useState(null); // 'heat' | 'cool'

  // Load thermostat settings
  const [thermostatSettings, setThermostatSettings] = useState(() =>
    loadThermostatSettings()
  );

  // Schedule hold state
  const [scheduleHold, setScheduleHold] = useState(() => {
    try {
      const stored = localStorage.getItem("thermostatScheduleHold");
      if (stored) {
        const hold = JSON.parse(stored);
        // Check if hold has expired
        if (hold.until && new Date(hold.until) > new Date()) {
          return hold;
        }
      }
    } catch {
      // Ignore localStorage errors (e.g., quota exceeded)
    }
    return null;
  });

  // Computed corrected temperature (with correction offset applied)
  const correctedTemp =
    actualRoomTemp + (thermostatSettings.thresholds.temperatureCorrection || 0);

  // Listen for settings changes
  useEffect(() => {
    const handleSettingsChange = () => {
      setThermostatSettings(loadThermostatSettings());
    };
    window.addEventListener("thermostatSettingsChanged", handleSettingsChange);
    return () =>
      window.removeEventListener(
        "thermostatSettingsChanged",
        handleSettingsChange
      );
  }, []);

  // Save schedule hold to localStorage
  useEffect(() => {
    if (scheduleHold) {
      localStorage.setItem(
        "thermostatScheduleHold",
        JSON.stringify(scheduleHold)
      );
    } else {
      localStorage.removeItem("thermostatScheduleHold");
    }
  }, [scheduleHold]);

  // Polling interval to update protection status
  // Note: Using a counter state to force re-renders instead of setState(prev => prev)
  // which can cause issues in some React versions

  const [, setProtectionUpdateCounter] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      // Force re-render to update protection status displays
      setProtectionUpdateCounter((prev) => prev + 1);
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  // Hold schedule function
  const holdSchedule = useCallback(
    (hours = null) => {
      const until = hours
        ? new Date(Date.now() + hours * 60 * 60 * 1000)
        : null;
      setScheduleHold({
        until: until?.toISOString(),
        setpoint: thermostatSetting,
      });
    },
    [thermostatSetting]
  );

  // Release hold
  const releaseHold = useCallback(() => {
    setScheduleHold(null);
  }, []);

  // Apply schedule if enabled (auto-apply)
  useEffect(() => {
    if (!thermostatSettings.schedule.enabled) return;
    if (
      scheduleHold &&
      scheduleHold.until &&
      new Date(scheduleHold.until) > new Date()
    ) {
      // Hold is active, don't apply schedule
      return;
    }

    // Check if hold expired
    if (
      scheduleHold &&
      scheduleHold.until &&
      new Date(scheduleHold.until) <= new Date()
    ) {
      setScheduleHold(null);
      return; // Exit early, will re-run on next render after hold is cleared
    }

    const setpoints = getCurrentSetpoints(thermostatSettings);

    // Determine which setpoint to use based on mode
    let targetSetpoint;
    if (hvacMode === "heat" || hvacMode === "auto") {
      targetSetpoint = setpoints.heatSetPoint;
    } else if (hvacMode === "cool") {
      targetSetpoint = setpoints.coolSetPoint;
    } else {
      return; // No setpoint for 'off' mode
    }

    // Use functional update to avoid dependency on thermostatSetting
    setThermostatSetting((prev) => {
      // Only update if different (avoid unnecessary updates)
      if (Math.abs(targetSetpoint - prev) > 0.5) {
        return targetSetpoint;
      }
      return prev;
    });
  }, [thermostatSettings, scheduleHold, hvacMode]); // Removed thermostatSetting from deps

  // Poll every minute to check for schedule changes
  useEffect(() => {
    if (!thermostatSettings.schedule.enabled) return;

    const interval = setInterval(() => {
      if (
        scheduleHold &&
        scheduleHold.until &&
        new Date(scheduleHold.until) <= new Date()
      ) {
        setScheduleHold(null);
      }

      const setpoints = getCurrentSetpoints(thermostatSettings);

      let targetSetpoint;
      if (hvacMode === "heat" || hvacMode === "auto") {
        targetSetpoint = setpoints.heatSetPoint;
      } else if (hvacMode === "cool") {
        targetSetpoint = setpoints.coolSetPoint;
      } else {
        return; // No setpoint for 'off' mode
      }

      // Use functional update to avoid dependency on thermostatSetting
      setThermostatSetting((prev) => {
        if (Math.abs(targetSetpoint - prev) > 0.5) {
          return targetSetpoint;
        }
        return prev;
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [thermostatSettings, scheduleHold, hvacMode]); // Removed thermostatSetting from deps

  // Agent integration
  const {
    events: _events,
    isRunning,
    lastFinal: _lastFinal,
    run: runAgent,
  } = useAgentRunner();
  const [agentInput, setAgentInput] = useState("");
  const [chatHistory, setChatHistory] = useState([
    {
      type: "system",
      text: '🤖 Talking Thermostat ready! Now with AI-powered intent understanding. Try: "set temperature to 72", "make it warmer", "what\'s the current temperature?", "optimize for comfort", or "give me a status report". I understand natural language better than ever!',
    },
  ]);
  const [llmLoading, setLlmLoading] = useState(false);

  // Voice integration
  const {
    isListening,
    transcript,
    interimTranscript,
    audioLevel,
    startListening,
    stopListening,
    stopSpeaking,
    isSpeaking,
    ttsEnabled,
    toggleTts,
    resetTranscript,
  } = useVoiceHMI();

  const audioContextRef = useRef(null);
  const prevStatesRef = useRef({ W: false, Y: false, G: false });
  const chatEndRef = useRef(null);
  const lastProcessedTranscriptRef = useRef("");

  // Local TTS helper since hook does not expose speak()
  const speakText = useCallback(
    (text) => {
      if (!ttsEnabled || !text) return;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 1.0;
          window.speechSynthesis.speak(utterance);
        } catch (e) {
          console.warn("TTS error (ignored):", e);
        }
      }
    },
    [ttsEnabled]
  );

  // Execute intent and return response
  const executeIntent = useCallback(
    async (classification, state, originalCommand = "") => {
      const { intent, parameters } = classification;
      const {
        setTempMode,
        setManualRoomTemp,
        setThermostatSetting,
        setHvacMode,
        actualRoomTemp,
        thermostatSetting,
        hvacMode,
        tempMode,
        contactorStates,
        thermostatSettings,
        compressorProtectionActive,
        heatMinOnEnforced,
        coolMinOnEnforced,
        dissipationActive,
        dissipationType,
        setThermostatSettings,
      } = state;

      switch (intent) {
        case INTENT_TYPES.SET_THERMOSTAT:
          if (parameters.temperature !== null) {
            const temp = Math.max(60, Math.min(80, parameters.temperature));
            setThermostatSetting(temp);
            return `✓ Thermostat set to ${temp}°F`;
          }
          return "❓ Please specify a temperature (60-80°F)";

        case INTENT_TYPES.SET_ROOM_TEMP:
          if (parameters.temperature !== null) {
            const temp = Math.max(50, Math.min(90, parameters.temperature));
            setTempMode("manual");
            setManualRoomTemp(temp);
            return `✓ Room temperature set to ${temp}°F (manual mode)`;
          }
          return "❓ Please specify a room temperature (50-90°F)";

        case INTENT_TYPES.ADJUST_TEMP_UP: {
          const degreesUp = parameters.degrees ?? 2;
          const newTempUp = Math.min(80, thermostatSetting + degreesUp);
          setThermostatSetting(newTempUp);
          return `✓ Increased temperature to ${newTempUp}°F (+${degreesUp}°)`;
        }

        case INTENT_TYPES.ADJUST_TEMP_DOWN: {
          const degreesDown = parameters.degrees ?? 2;
          const newTempDown = Math.max(60, thermostatSetting - degreesDown);
          setThermostatSetting(newTempDown);
          return `✓ Decreased temperature to ${newTempDown}°F (-${degreesDown}°)`;
        }

        case INTENT_TYPES.QUERY_TEMPERATURE: {
          const corrected =
            actualRoomTemp +
            (thermostatSettings.thresholds.temperatureCorrection || 0);
          return `🏠 Current temperature is ${corrected.toFixed(1)}°F${
            thermostatSettings.thresholds.temperatureCorrection !== 0
              ? ` (corrected from ${actualRoomTemp}°F)`
              : ""
          }`;
        }

        case INTENT_TYPES.SWITCH_MODE: {
          if (parameters.mode) {
            setHvacMode(parameters.mode);
            return `✓ Switched to ${parameters.mode.toUpperCase()} mode`;
          }
          return "❓ Please specify a mode: heat, cool, auto, or off";
        }

        case INTENT_TYPES.QUERY_STATUS: {
          const correctedTemp =
            actualRoomTemp +
            (thermostatSettings.thresholds.temperatureCorrection || 0);
          const tempDiff = correctedTemp - thermostatSetting;
          const systemState = contactorStates.W
            ? "HEATING"
            : contactorStates.Y
            ? "COOLING"
            : "IDLE";
          const protectionStatus = [];
          if (compressorProtectionActive)
            protectionStatus.push("Compressor Protected");
          if (heatMinOnEnforced) protectionStatus.push("Heat Min On-Time");
          if (coolMinOnEnforced) protectionStatus.push("Cool Min On-Time");
          if (dissipationActive)
            protectionStatus.push(
              `${dissipationType === "heat" ? "Heat" : "Cool"} Dissipation`
            );

          return (
            `📊 Status Report:\n` +
            `• Room: ${correctedTemp.toFixed(1)}°F (${
              tempDiff > 0 ? "+" : ""
            }${tempDiff.toFixed(1)}° from setpoint)\n` +
            `• Setpoint: ${thermostatSetting}°F\n` +
            `• Mode: ${hvacMode.toUpperCase()}\n` +
            `• Source: ${tempMode.toUpperCase()}\n` +
            `• System: ${systemState}` +
            (protectionStatus.length > 0
              ? `\n• Protection: ${protectionStatus.join(", ")}`
              : "")
          );
        }

        case INTENT_TYPES.OPTIMIZE_COMFORT: {
          setHvacMode("auto");
          setThermostatSetting(72);
          return `✓ Optimized for comfort: AUTO mode, 72°F setpoint`;
        }

        case INTENT_TYPES.OPTIMIZE_SAVINGS: {
          setHvacMode("auto");
          setThermostatSetting(68);
          return `✓ Optimized for savings: AUTO mode, 68°F setpoint (reduces energy use ~10%)`;
        }

        case INTENT_TYPES.QUERY_COMFORT: {
          const tempDiffComfort = Math.abs(actualRoomTemp - 70);
          const comfort =
            tempDiffComfort < 2
              ? "Very comfortable"
              : tempDiffComfort < 4
              ? "Comfortable"
              : "Could be better";
          return `${comfort} - Room is ${actualRoomTemp}°F (ideal ~70°F)`;
        }

        case INTENT_TYPES.QUERY_SYSTEM_RUNNING: {
          const isRunning =
            contactorStates.W || contactorStates.Y || contactorStates.G;
          const activeContactors = Object.entries(contactorStates)
            .filter(([, active]) => active)
            .map(([name]) =>
              name === "W" ? "Heat" : name === "Y" ? "Cool" : "Fan"
            )
            .join(", ");
          return isRunning
            ? `✓ System RUNNING - Active: ${activeContactors}`
            : `○ System IDLE - no contactors engaged`;
        }

        case INTENT_TYPES.SWITCH_TEMP_SOURCE: {
          if (parameters.source === "cpu") {
            setTempMode("cpu");
            return "✓ Switched to CPU temperature source";
          } else if (parameters.source === "manual") {
            setTempMode("manual");
            return "✓ Switched to manual temperature mode";
          }
          return "❓ Please specify source: CPU or manual";
        }

        case INTENT_TYPES.BEDTIME_TEMP:
          setThermostatSetting(66);
          return `😴 Set to 66°F for optimal sleep (recommended: 65-68°F for best rest)`;

        case INTENT_TYPES.PERSONALITY_QUERY: {
          const lower = originalCommand.toLowerCase();
          if (/gordon.*ramsay|ramsay/i.test(lower)) {
            const waste = Math.abs(actualRoomTemp - thermostatSetting) > 3;
            return waste
              ? `🍳 "IT'S RAW! You're heating/cooling to ${thermostatSetting}°F but the room is ${actualRoomTemp}°F! That's energy waste, you donkey!"`
              : `🍳 "Finally, some good temperature control. Well done!"`;
          }
          return `🤖 I'm feeling efficient! All systems operational. How can I help optimize your comfort?`;
        }

        case INTENT_TYPES.MULTI_STEP: {
          // Execute multiple actions sequentially
          if (
            parameters.actions &&
            Array.isArray(parameters.actions) &&
            parameters.actions.length > 0
          ) {
            const responses = [];
            for (const action of parameters.actions) {
              // Create a mini classification for each action
              const actionClassification = {
                intent: action.intent,
                parameters: {
                  temperature: action.temperature ?? null,
                  degrees: action.degrees ?? null,
                  mode: action.mode ?? null,
                  source: action.source ?? null,
                },
              };
              // Execute each action (reuse the same executeIntent logic)
              try {
                const actionResponse = await executeIntent(
                  actionClassification,
                  state,
                  originalCommand
                );
                if (actionResponse && !actionResponse.startsWith("❓")) {
                  responses.push(actionResponse);
                }
              } catch (e) {
                console.warn("Multi-step action failed:", e);
              }
            }
            return responses.length > 0
              ? responses.join("\n")
              : "❓ Multi-step command execution failed";
          }
          // Fallback: try to parse simple "and" commands
          const lower = originalCommand.toLowerCase();
          if (lower.includes(" and ")) {
            const parts = lower.split(" and ");
            if (parts.length === 2) {
              // Try to handle simple two-part commands
              return "🔄 Multi-step commands detected. Please use separate commands or add Groq API key for full support.";
            }
          }
          return "❓ Multi-step command format error";
        }

        case INTENT_TYPES.QUERY_HUMIDITY:
          return `💧 Humidity monitoring not yet implemented in this demo. Coming soon!`;

        case INTENT_TYPES.QUERY_ENERGY:
          return `⚡ Energy tracking not yet implemented. Coming soon: real-time usage, cost estimates, and efficiency tips!`;

        case INTENT_TYPES.QUERY_WEATHER:
          return `🌤️ Outside temperature: ~45°F (simulated). Weather integration coming soon!`;

        case INTENT_TYPES.FAN_CONTROL:
          return `🌀 Fan control not yet implemented. Currently fans run automatically with heat/cool.`;

        case INTENT_TYPES.HELP:
          return (
            `📖 Available Commands:\n` +
            `• Temperature: "set to 72", "make it warmer", "turn up by 2 degrees"\n` +
            `• Modes: "switch to heat/cool/auto/off"\n` +
            `• Queries: "what's the temperature", "status", "is it running"\n` +
            `• Optimization: "optimize for comfort/savings"\n` +
            `• Special: "bedtime temp", "set room temp to 65"\n` +
            `• Settings: "what are my thresholds", "show comfort settings"\n` +
            `• Multi-step: "set to 72 and switch to cool"\n` +
            `Try natural language - I understand many variations!`
          );

        case INTENT_TYPES.QUERY_SETTINGS: {
          // Provide summary of key settings
          const thresholds = state.thermostatSettings?.thresholds || {};
          return (
            `⚙️ Current Settings:\n` +
            `• Heat Differential: ${thresholds.heatDifferential || 0.5}°F\n` +
            `• Cool Differential: ${thresholds.coolDifferential || 0.5}°F\n` +
            `• Compressor Min Off: ${
              (thresholds.compressorMinCycleOff || 300) / 60
            } min\n` +
            `• Auto Mode: ${
              thresholds.autoHeatCool ? "Enabled" : "Disabled"
            }\n` +
            `• Comfort Settings: Home ${
              state.thermostatSettings?.comfortSettings?.home?.heatSetPoint ||
              70
            }°F / ${
              state.thermostatSettings?.comfortSettings?.home?.coolSetPoint ||
              74
            }°F\n` +
            `View all settings in Settings → Thermostat Settings`
          );
        }

        case INTENT_TYPES.UPDATE_SETTINGS: {
          // Parse and update settings
          const { updateThermostatSetting: updateSetting } = await import(
            "../lib/thermostatSettings"
          );
          const settingName = parameters.settingName;
          let settingValue = parameters.settingValue;

          // Convert units if needed
          if (parameters.settingUnit === "minutes" && settingValue) {
            settingValue = settingValue * 60; // Convert to seconds
          }

          // Map common setting names to actual paths
          const settingMap = {
            heatdifferential: "thresholds.heatDifferential",
            cooldifferential: "thresholds.coolDifferential",
            compressormincycleoff: "thresholds.compressorMinCycleOff",
            compressorofftime: "thresholds.compressorMinCycleOff",
            heatminontime: "thresholds.heatMinOnTime",
            coolminontime: "thresholds.coolMinOnTime",
            temperaturecorrection: "thresholds.temperatureCorrection",
            heatcoolmindelta: "thresholds.heatCoolMinDelta",
            autoheatcool: "thresholds.autoHeatCool",
          };

          const settingPath = settingName
            ? settingMap[settingName.toLowerCase()]
            : null;

          if (
            !settingPath ||
            settingValue === null ||
            settingValue === undefined
          ) {
            return (
              `⚙️ I couldn't understand that setting update. Try:\n` +
              `• "set heat differential to 1 degree"\n` +
              `• "change compressor off time to 5 minutes"\n` +
              `• "set temperature correction to 2 degrees"\n` +
              `• "set heat min on time to 10 minutes"`
            );
          }

          // Validate and update
          try {
            updateSetting(settingPath, settingValue);
            // Reload settings to reflect changes
            const { loadThermostatSettings } = await import(
              "../lib/thermostatSettings"
            );
            const updated = loadThermostatSettings();
            if (setThermostatSettings) {
              setThermostatSettings(updated);
            }
            const unit = parameters.settingUnit || "";
            return `✓ Updated ${settingName} to ${parameters.settingValue}${
              unit ? " " + unit : ""
            }`;
          } catch (error) {
            return `❌ Failed to update setting: ${error.message}`;
          }
        }

        case INTENT_TYPES.UNKNOWN:
        default:
          return "❓ Command not recognized.";
      }
    },
    [setTempMode, setManualRoomTemp, setThermostatSetting, setHvacMode]
  );

  // Process agent commands using intent classifier
  const processAgentCommand = useCallback(
    async (command) => {
      // Get API key and model for intent classification
      const apiKey =
        typeof window !== "undefined" ? localStorage.getItem("groqApiKey") : "";
      const model =
        typeof window !== "undefined"
          ? localStorage.getItem("groqModel") || "llama-3.3-70b-versatile"
          : "llama-3.3-70b-versatile";

      // Classify intent
      const classification = await classifyIntent(command, apiKey, model);

      // Execute action based on intent
      return executeIntent(
        classification,
        {
          setTempMode,
          setManualRoomTemp,
          setThermostatSetting,
          setHvacMode,
          actualRoomTemp,
          thermostatSetting,
          hvacMode,
          tempMode,
          contactorStates,
          thermostatSettings, // Make settings available to agent
          compressorProtectionActive,
          heatMinOnEnforced,
          coolMinOnEnforced,
          dissipationActive,
          dissipationType,
          setThermostatSettings, // Allow agent to update settings
        },
        command
      );
    },
    [
      actualRoomTemp,
      thermostatSetting,
      hvacMode,
      tempMode,
      contactorStates,
      executeIntent,
    ]
  );

  // LLM fallback for unrecognized commands
  const runLlmFallback = useCallback(async (originalCommand) => {
    const apiKey =
      typeof window !== "undefined" ? localStorage.getItem("groqApiKey") : "";
    const model =
      typeof window !== "undefined"
        ? localStorage.getItem("groqModel") || "llama-3.3-70b-versatile"
        : "llama-3.3-70b-versatile";
    if (!apiKey) {
      return "🧠 Advanced Q&A disabled (no Groq API key). Add one in Settings to enable richer answers.";
    }
    setLlmLoading(true);
    try {
      const { askJouleFallback } = await import("../lib/groqAgent");
      const result = await askJouleFallback(originalCommand, apiKey, model);
      if (result.error) {
        return result.message || "⚠️ LLM fallback error.";
      }
      return result.response || result.message || "💬 Processed.";
    } catch (e) {
      console.warn("LLM fallback error:", e);
      return "⚠️ Unable to process with LLM fallback.";
    } finally {
      setLlmLoading(false);
    }
  }, []);

  // Handle agent command submission
  const handleAgentSubmit = useCallback(
    async (e, voiceCommand = null) => {
      if (e?.preventDefault) {
        e.preventDefault();
      }
      const commandToProcess = voiceCommand || agentInput.trim();
      if (!commandToProcess) return;

      const userCommand = commandToProcess;
      setChatHistory((prev) => [...prev, { type: "user", text: userCommand }]);
      setAgentInput("");

      // Process command using intent classifier (async)
      let response = await processAgentCommand(userCommand);
      // If unknown, attempt LLM fallback
      if (response && response.startsWith("❓")) {
        // Show thinking placeholder
        setChatHistory((prev) => [
          ...prev,
          { type: "agent", text: "🤔 Let me think..." },
        ]);
        response = await runLlmFallback(userCommand);
        // Replace placeholder with final (append for simplicity)
        setChatHistory((prev) => [...prev, { type: "agent", text: response }]);
        speakText(response);
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
        if (userCommand.toLowerCase().includes("agent run")) {
          runAgent(userCommand);
        }
        return; // exit early, already appended
      }

      // Speak the response if TTS is enabled
      speakText(response);

      setTimeout(() => {
        setChatHistory((prev) => [...prev, { type: "agent", text: response }]);
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 150);

      // Also send to backend agent for logging (optional)
      if (userCommand.toLowerCase().includes("agent run")) {
        runAgent(userCommand);
      }
    },
    [agentInput, processAgentCommand, runAgent, speakText, runLlmFallback]
  );

  // Handle voice transcript - submit when user stops talking
  useEffect(() => {
    if (!transcript || isListening) return;
    const trimmed = transcript.trim();
    if (!trimmed) return;
    if (trimmed === lastProcessedTranscriptRef.current) return; // guard against repeat loop
    lastProcessedTranscriptRef.current = trimmed;

    setChatHistory((prev) => [...prev, { type: "user", text: trimmed }]);

    // Create async function to handle the async processAgentCommand
    (async () => {
      const response = await processAgentCommand(trimmed);
      if (response && response.startsWith("❓")) {
        setChatHistory((prev) => [
          ...prev,
          { type: "agent", text: "🤔 Let me think..." },
        ]);
        runLlmFallback(trimmed).then((final) => {
          setChatHistory((prev) => [...prev, { type: "agent", text: final }]);
          speakText(final);
          chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
        });
      } else {
        speakText(response);
        setTimeout(() => {
          setChatHistory((prev) => [
            ...prev,
            { type: "agent", text: response },
          ]);
          chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 150);
      }
    })();

    resetTranscript();
    stopListening();
  }, [
    transcript,
    isListening,
    processAgentCommand,
    speakText,
    resetTranscript,
    stopListening,
    runLlmFallback,
  ]);

  // Voice control handlers
  const handleMicToggle = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const handleTtsToggle = useCallback(() => {
    toggleTts();
    if (isSpeaking) {
      stopSpeaking();
    }
  }, [toggleTts, isSpeaking, stopSpeaking]);

  // Create audio context for clack sound
  useEffect(() => {
    if (typeof window !== "undefined" && window.AudioContext) {
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Play contactor clack sound
  const playClack = () => {
    if (!audioContextRef.current) return;
    try {
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Sharp attack, quick decay for mechanical clack
      oscillator.frequency.setValueAtTime(80, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        40,
        ctx.currentTime + 0.02
      );

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.1);
    } catch {
      // Audio failed, silent fail
    }
  };

  // Read state from localStorage
  const readState = useCallback(() => {
    try {
      const stateJson = localStorage.getItem("shortCycleContactorState");
      if (stateJson) {
        const state = JSON.parse(stateJson);

        // Detect transitions to closed for audio
        const prev = prevStatesRef.current;
        if (
          (state.W && !prev.W) ||
          (state.Y && !prev.Y) ||
          (state.G && !prev.G)
        ) {
          playClack();
        }
        prevStatesRef.current = {
          W: state.W ?? false,
          Y: state.Y ?? false,
          G: state.G ?? false,
        };

        setContactorStates((p) => ({
          W: state.W ?? p.W,
          Y: state.Y ?? p.Y,
          G: state.G ?? p.G,
        }));
        setLockoutUntil(state.lockoutUntil || null);
        setIsLocked(state.isLocked || false);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // Event-driven sync via storage event (cross-tab)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "shortCycleContactorState") {
        readState();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [readState]);

  // Fallback poll for same-tab updates (storage event doesn't fire in same tab)
  useEffect(() => {
    readState(); // initial read
    const pollInterval = setInterval(readState, 500); // slower poll as fallback
    return () => clearInterval(pollInterval);
  }, [readState]);

  // Update actual room temp from CPU or manual
  useEffect(() => {
    if (tempMode === "manual") {
      setActualRoomTemp(manualRoomTemp);
    } else {
      // Fetch CPU temp (this would normally come from the server)
      // For now, we'll use a placeholder that updates from TemperatureDisplay
      fetch("http://localhost:3001/api/temperature/cpu")
        .then((res) => res.json())
        .then((data) => {
          // CPU temp is in Celsius, already divided by 2
          const fahrenheit = (data.main * 9) / 5 + 32;
          setActualRoomTemp(Math.round(fahrenheit));
        })
        .catch(() => {
          // Fallback if server unavailable
          setActualRoomTemp(70);
        });
    }
  }, [tempMode, manualRoomTemp]);

  // Track contactor state changes for protection logic
  useEffect(() => {
    const prevY = prevStatesRef.current.Y;
    const prevW = prevStatesRef.current.W;
    // const prevG = prevStatesRef.current.G; // Available for future fan state tracking

    // Track compressor (Y) turning off for protection
    if (prevY && !contactorStates.Y) {
      setCompressorOffTime(Date.now());
      setCompressorProtectionActive(true);
    }

    // Track heat turning on/off for min on-time
    if (!prevW && contactorStates.W) {
      setHeatOnTime(Date.now());
      setHeatMinOnEnforced(true);
    } else if (prevW && !contactorStates.W) {
      setHeatOnTime(null);
      setHeatMinOnEnforced(false);
    }

    // Track cool turning on/off for min on-time
    if (!prevY && contactorStates.Y) {
      setCoolOnTime(Date.now());
      setCoolMinOnEnforced(true);
    } else if (prevY && !contactorStates.Y) {
      setCoolOnTime(null);
      setCoolMinOnEnforced(false);
    }

    prevStatesRef.current = { ...contactorStates };
  }, [contactorStates]);

  // Check compressor protection status
  useEffect(() => {
    if (!compressorProtectionActive || !compressorOffTime) return;

    const thresholds = thermostatSettings.thresholds;
    const minCycleOffMs = (thresholds.compressorMinCycleOff || 300) * 1000;
    const timeSinceOff = Date.now() - compressorOffTime;

    if (timeSinceOff >= minCycleOffMs) {
      setCompressorProtectionActive(false);
      setCompressorOffTime(null);
    }
  }, [compressorProtectionActive, compressorOffTime, thermostatSettings]);

  // Check min on-time enforcement
  useEffect(() => {
    const thresholds = thermostatSettings.thresholds;

    if (heatOnTime && heatMinOnEnforced) {
      const minOnMs = (thresholds.heatMinOnTime || 300) * 1000;
      const timeOn = Date.now() - heatOnTime;
      if (timeOn >= minOnMs) {
        setHeatMinOnEnforced(false);
      }
    }

    if (coolOnTime && coolMinOnEnforced) {
      const minOnMs = (thresholds.coolMinOnTime || 300) * 1000;
      const timeOn = Date.now() - coolOnTime;
      if (timeOn >= minOnMs) {
        setCoolMinOnEnforced(false);
      }
    }
  }, [
    heatOnTime,
    coolOnTime,
    heatMinOnEnforced,
    coolMinOnEnforced,
    thermostatSettings,
  ]);

  // Handle dissipation time
  useEffect(() => {
    if (!dissipationActive || !dissipationEndTime) return;

    if (Date.now() >= dissipationEndTime) {
      setDissipationActive(false);
      setDissipationEndTime(null);
      setDissipationType(null);
      // Turn off fan if dissipation complete
      setContactorStates((prev) => ({ ...prev, G: false }));
    }
  }, [dissipationActive, dissipationEndTime]);

  // Automatic contactor control based on thermostat logic with threshold settings
  useEffect(() => {
    if (hvacMode === "off") {
      setContactorStates({ W: false, Y: false, G: false });
      setDissipationActive(false);
      return;
    }

    const thresholds = thermostatSettings.thresholds;

    // Apply temperature correction
    const correctedTemp =
      actualRoomTemp + (thresholds.temperatureCorrection || 0);
    const tempDiff = correctedTemp - thermostatSetting;

    // Use functional update to read current state without including it in dependencies
    setContactorStates((currentStates) => {
      const newStates = { ...currentStates };

      // Use threshold settings for differentials
      const heatDifferential = thresholds.heatDifferential || 0.5;
      const coolDifferential = thresholds.coolDifferential || 0.5;

      // Check if we need to start dissipation
      const prevW = prevStatesRef.current.W;
      const prevY = prevStatesRef.current.Y;

      // If heat just turned off, start heat dissipation
      if (prevW && !currentStates.W && thresholds.heatDissipationTime > 0) {
        setDissipationActive(true);
        setDissipationEndTime(
          Date.now() + thresholds.heatDissipationTime * 1000
        );
        setDissipationType("heat");
        newStates.G = true; // Keep fan on for dissipation
      }

      // If cool just turned off, start cool dissipation
      if (prevY && !currentStates.Y && thresholds.coolDissipationTime > 0) {
        setDissipationActive(true);
        setDissipationEndTime(
          Date.now() + thresholds.coolDissipationTime * 1000
        );
        setDissipationType("cool");
        newStates.G = true; // Keep fan on for dissipation
      }

      // If dissipation is active, don't change contactor states
      if (dissipationActive) {
        return currentStates; // Return unchanged state
      }

      // Reset states (will be set based on conditions)
      newStates.W = false;
      newStates.Y = false;
      newStates.G = false;

      // Check min on-time: if currently on and hasn't met minimum, keep it on
      const heatNeedsMinOn = currentStates.W && heatMinOnEnforced;
      const coolNeedsMinOn = currentStates.Y && coolMinOnEnforced;

      if (hvacMode === "heat") {
        // Room is cooler than setting (accounting for heat differential)
        const needsHeat = tempDiff < -heatDifferential;

        // Turn on if needed OR if min on-time requires it
        if (needsHeat || heatNeedsMinOn) {
          newStates.W = true;
          // Fan runs with heat (check fan mode from comfort settings)
          const comfort = getCurrentComfortSetting(thermostatSettings);
          const fanMode =
            thermostatSettings.comfortSettings[comfort]?.fanMode || "auto";
          if (fanMode === "on" || fanMode === "auto") {
            newStates.G = true;
          }
        }
      } else if (hvacMode === "cool") {
        // Check compressor protection
        const canStartCompressor = !compressorProtectionActive;

        // Room is warmer than setting (accounting for cool differential)
        const needsCool = tempDiff > coolDifferential;

        // Turn on if needed AND compressor protection allows OR if min on-time requires it
        if ((needsCool && canStartCompressor) || coolNeedsMinOn) {
          newStates.Y = true;
          // Fan runs with cooling
          const comfort = getCurrentComfortSetting(thermostatSettings);
          const fanMode =
            thermostatSettings.comfortSettings[comfort]?.fanMode || "auto";
          if (fanMode === "on" || fanMode === "auto") {
            newStates.G = true;
          }
        }
      } else if (hvacMode === "auto" && thresholds.autoHeatCool) {
        // Auto mode: use heat/cool min delta to prevent rapid switching
        // If schedule hold is active, use manual thermostat setting instead of schedule setpoints
        let heatSetpoint, coolSetpoint;
        if (
          scheduleHold &&
          scheduleHold.until &&
          new Date(scheduleHold.until) > new Date()
        ) {
          // Schedule hold active: use manual thermostat setting with a deadband
          const deadband = thresholds.heatCoolMinDelta || 3;
          heatSetpoint = thermostatSetting - deadband / 2;
          coolSetpoint = thermostatSetting + deadband / 2;
        } else {
          // No hold: use schedule setpoints
          const setpoints = getCurrentSetpoints(thermostatSettings);
          heatSetpoint = setpoints.heatSetPoint || thermostatSetting;
          coolSetpoint = setpoints.coolSetPoint || thermostatSetting;
        }

        const needsHeat = correctedTemp < heatSetpoint - (heatDifferential + 1);
        const needsCool = correctedTemp > coolSetpoint + (coolDifferential + 1);
        const canStartCompressor = !compressorProtectionActive;

        // Only heat if room is significantly below heat setpoint OR min on-time requires it
        if (needsHeat || heatNeedsMinOn) {
          newStates.W = true;
          const comfort = getCurrentComfortSetting(thermostatSettings);
          const fanMode =
            thermostatSettings.comfortSettings[comfort]?.fanMode || "auto";
          if (fanMode === "on" || fanMode === "auto") {
            newStates.G = true;
          }
        }
        // Only cool if room is significantly above cool setpoint AND compressor protection allows OR min on-time requires it
        else if ((needsCool && canStartCompressor) || coolNeedsMinOn) {
          newStates.Y = true;
          const comfort = getCurrentComfortSetting(thermostatSettings);
          const fanMode =
            thermostatSettings.comfortSettings[comfort]?.fanMode || "auto";
          if (fanMode === "on" || fanMode === "auto") {
            newStates.G = true;
          }
        }
      }

      // Only update if state actually changed to prevent infinite loops
      if (
        newStates.W !== currentStates.W ||
        newStates.Y !== currentStates.Y ||
        newStates.G !== currentStates.G
      ) {
        localStorage.setItem(
          "shortCycleContactorState",
          JSON.stringify(newStates)
        );
        return newStates;
      }

      return currentStates; // Return unchanged state
    });
  }, [
    actualRoomTemp,
    thermostatSetting,
    hvacMode,
    thermostatSettings,
    compressorProtectionActive,
    heatMinOnEnforced,
    coolMinOnEnforced,
    dissipationActive,
    scheduleHold,
  ]);

  // Manual toggle for demo/testing without ShortCycleTest
  const toggleContactor = (terminal) => {
    setContactorStates((prev) => {
      const newState = { ...prev, [terminal]: !prev[terminal] };
      // Also write to localStorage so ShortCycleTest can read if needed
      localStorage.setItem(
        "shortCycleContactorState",
        JSON.stringify(newState)
      );
      return newState;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            Contactor Visualizer
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Real-time animation of thermostat contactors (normally open). Click
            terminals or sync with ShortCycleTest.
          </p>
        </div>

        {/* Power indicator */}
        <div className="mb-6 flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-500/50"></div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            24 VAC Control Power Active
          </span>
        </div>

        {/* CPU Temperature Display for Bench Testing */}
        <div className="mb-6 space-y-2">
          <TemperatureDisplay compact />
          <p className="text-xs text-slate-500 dark:text-slate-400 italic">
            Temperature data from{" "}
            <strong>localhost:3001/api/temperature</strong> (CPU temp ÷ 2 for
            thermostat simulation). Use manual update endpoint or
            poll-ecobee.ps1 script to change values.
          </p>
        </div>

        {/* Manual Thermostat Controls */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg mb-6">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
            Bench Test Controls
          </h2>

          {/* Temperature Mode Toggle */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Temperature Source
            </label>
            <div className="flex gap-2">
              <button
                data-testid="temp-mode-cpu"
                onClick={() => setTempMode("cpu")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  tempMode === "cpu"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                }`}
              >
                CPU Temperature
              </button>
              <button
                data-testid="temp-mode-manual"
                onClick={() => setTempMode("manual")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  tempMode === "manual"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                }`}
              >
                Manual Temperature
              </button>
            </div>
          </div>

          {/* Manual Room Temperature Slider */}
          {tempMode === "manual" && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Room Temperature:{" "}
                <span
                  className="text-blue-600 dark:text-blue-400 font-bold"
                  data-testid="room-temp-value"
                >
                  {manualRoomTemp}°F
                </span>
              </label>
              <input
                type="range"
                data-testid="room-temp-slider"
                min="50"
                max="90"
                value={manualRoomTemp}
                onChange={(e) => setManualRoomTemp(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>50°F</span>
                <span>90°F</span>
              </div>
            </div>
          )}

          {/* Actual Room Temperature Display */}
          <div className="mb-4 p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Current Room Temperature
            </div>
            <div
              className="text-2xl font-bold text-slate-900 dark:text-white"
              data-testid="actual-room-temp"
            >
              {correctedTemp.toFixed(1)}°F
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Source: {tempMode === "cpu" ? "CPU Sensor" : "Manual Entry"}
              {thermostatSettings.thresholds.temperatureCorrection !== 0 && (
                <span className="ml-2">
                  (Raw: {actualRoomTemp}°F, Correction:{" "}
                  {thermostatSettings.thresholds.temperatureCorrection > 0
                    ? "+"
                    : ""}
                  {thermostatSettings.thresholds.temperatureCorrection}°F)
                </span>
              )}
            </div>
          </div>

          {/* Protection Status Indicators */}
          {(compressorProtectionActive ||
            heatMinOnEnforced ||
            coolMinOnEnforced ||
            dissipationActive) && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
              <div className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
                Protection Status:
              </div>
              <div className="space-y-1 text-xs">
                {compressorProtectionActive && compressorOffTime && (
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    <span>
                      Compressor Protection:{" "}
                      {Math.max(
                        0,
                        Math.ceil(
                          (thermostatSettings.thresholds.compressorMinCycleOff -
                            (Date.now() - compressorOffTime) / 1000) /
                            60
                        )
                      )}{" "}
                      min remaining
                    </span>
                  </div>
                )}
                {heatMinOnEnforced && heatOnTime && (
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    <span>
                      Heat Min On-Time:{" "}
                      {Math.max(
                        0,
                        Math.ceil(
                          (thermostatSettings.thresholds.heatMinOnTime -
                            (Date.now() - heatOnTime) / 1000) /
                            60
                        )
                      )}{" "}
                      min remaining
                    </span>
                  </div>
                )}
                {coolMinOnEnforced && coolOnTime && (
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span>
                      Cool Min On-Time:{" "}
                      {Math.max(
                        0,
                        Math.ceil(
                          (thermostatSettings.thresholds.coolMinOnTime -
                            (Date.now() - coolOnTime) / 1000) /
                            60
                        )
                      )}{" "}
                      min remaining
                    </span>
                  </div>
                )}
                {dissipationActive && dissipationEndTime && (
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                    <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
                    <span>
                      {dissipationType === "heat" ? "Heat" : "Cool"}{" "}
                      Dissipation:{" "}
                      {Math.max(
                        0,
                        Math.ceil((dissipationEndTime - Date.now()) / 1000)
                      )}{" "}
                      sec remaining
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Schedule Hold Status */}
          {scheduleHold &&
            scheduleHold.until &&
            new Date(scheduleHold.until) > new Date() && (
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-amber-900 dark:text-amber-100">
                      Schedule Hold Active
                    </div>
                    <div className="text-xs text-amber-700 dark:text-amber-300">
                      Until: {new Date(scheduleHold.until).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={releaseHold}
                    className="px-3 py-1 text-xs font-medium bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 rounded hover:bg-amber-300 dark:hover:bg-amber-700"
                  >
                    Release Hold
                  </button>
                </div>
              </div>
            )}

          {/* Thermostat Setting Slider */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Thermostat Setting:{" "}
                <span
                  className="text-orange-600 dark:text-orange-400 font-bold"
                  data-testid="thermostat-value"
                >
                  {thermostatSetting}°F
                </span>
              </label>
              {thermostatSettings.schedule.enabled && (
                <div className="flex gap-1">
                  <button
                    onClick={() => holdSchedule(2)}
                    className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50"
                    title="Hold schedule for 2 hours"
                  >
                    Hold 2h
                  </button>
                  <button
                    onClick={() => holdSchedule(null)}
                    className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50"
                    title="Hold schedule indefinitely"
                  >
                    Hold
                  </button>
                </div>
              )}
            </div>
            <input
              type="range"
              data-testid="thermostat-slider"
              min="60"
              max="80"
              value={thermostatSetting}
              onChange={(e) => {
                setThermostatSetting(Number(e.target.value));
                // Auto-hold when manually adjusting
                if (thermostatSettings.schedule.enabled && !scheduleHold) {
                  holdSchedule(2);
                }
              }}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
              <span>60°F</span>
              <span>80°F</span>
            </div>
            {thermostatSettings.schedule.enabled && !scheduleHold && (
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Schedule active: {getCurrentComfortSetting(thermostatSettings)}{" "}
                ({getCurrentSetpoints(thermostatSettings).heatSetPoint}°F /{" "}
                {getCurrentSetpoints(thermostatSettings).coolSetPoint}°F)
              </div>
            )}
          </div>

          {/* HVAC Mode Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              HVAC Mode
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                data-testid="hvac-mode-heat"
                onClick={() => setHvacMode("heat")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  hvacMode === "heat"
                    ? "bg-orange-600 text-white"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                }`}
              >
                Heat
              </button>
              <button
                data-testid="hvac-mode-cool"
                onClick={() => setHvacMode("cool")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  hvacMode === "cool"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                }`}
              >
                Cool
              </button>
              <button
                data-testid="hvac-mode-auto"
                onClick={() => setHvacMode("auto")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  hvacMode === "auto"
                    ? "bg-green-600 text-white"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                }`}
              >
                Auto
              </button>
              <button
                data-testid="hvac-mode-off"
                onClick={() => setHvacMode("off")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  hvacMode === "off"
                    ? "bg-slate-600 text-white"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                }`}
              >
                Off
              </button>
            </div>
          </div>

          {/* Status Indicator */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
            <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
              System Status:
              <span className="ml-2" data-testid="system-status">
                {hvacMode === "off" && "System Off"}
                {hvacMode === "heat" &&
                  correctedTemp <
                    thermostatSetting -
                      (thermostatSettings.thresholds.heatDifferential || 0.5) &&
                  "🔥 Heating"}
                {hvacMode === "heat" &&
                  correctedTemp >=
                    thermostatSetting -
                      (thermostatSettings.thresholds.heatDifferential || 0.5) &&
                  "✓ Satisfied (Heat)"}
                {hvacMode === "cool" &&
                  correctedTemp >
                    thermostatSetting +
                      (thermostatSettings.thresholds.coolDifferential || 0.5) &&
                  !compressorProtectionActive &&
                  "❄️ Cooling"}
                {hvacMode === "cool" &&
                  correctedTemp >
                    thermostatSetting +
                      (thermostatSettings.thresholds.coolDifferential || 0.5) &&
                  compressorProtectionActive &&
                  "⏸️ Cooling (Compressor Protected)"}
                {hvacMode === "cool" &&
                  correctedTemp <=
                    thermostatSetting +
                      (thermostatSettings.thresholds.coolDifferential || 0.5) &&
                  "✓ Satisfied (Cool)"}
                {hvacMode === "auto" &&
                  correctedTemp < thermostatSetting - 2 &&
                  "🔥 Heating (Auto)"}
                {hvacMode === "auto" &&
                  correctedTemp > thermostatSetting + 2 &&
                  !compressorProtectionActive &&
                  "❄️ Cooling (Auto)"}
                {hvacMode === "auto" &&
                  correctedTemp > thermostatSetting + 2 &&
                  compressorProtectionActive &&
                  "⏸️ Cooling (Auto, Compressor Protected)"}
                {hvacMode === "auto" &&
                  correctedTemp >= thermostatSetting - 2 &&
                  correctedTemp <= thermostatSetting + 2 &&
                  "✓ Satisfied (Auto)"}
              </span>
            </div>
          </div>
        </div>

        {/* Agent Chat Interface */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 rounded-xl p-6 shadow-lg mb-6 border-2 border-blue-200 dark:border-blue-700">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Agent Command Interface
            </h2>
            {(isRunning || llmLoading) && (
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            )}
          </div>

          {/* Chat History */}
          <div className="bg-white dark:bg-slate-950 rounded-lg p-4 mb-4 h-64 overflow-y-auto space-y-3">
            {chatHistory.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.type === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    msg.type === "user"
                      ? "bg-blue-600 text-white"
                      : msg.type === "system"
                      ? "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm italic"
                      : "bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Voice Controls */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={handleMicToggle}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                isListening
                  ? "bg-red-600 hover:bg-red-700 text-white animate-pulse"
                  : "bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
              }`}
              title={isListening ? "Stop listening" : "Start voice input"}
            >
              {isListening ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
              {isListening ? "Listening..." : "Voice"}
            </button>

            <button
              onClick={handleTtsToggle}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                ttsEnabled
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
              }`}
              title={
                ttsEnabled ? "Disable text-to-speech" : "Enable text-to-speech"
              }
            >
              {ttsEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
              TTS
            </button>

            {isListening && audioLevel > 0 && (
              <div className="flex items-center gap-1 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  Level:
                </span>
                <div className="w-20 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 dark:bg-blue-400 transition-all duration-100"
                    style={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Transcript Overlay */}
          {(isListening || interimTranscript) && (
            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg">
              <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">
                Voice Transcript:
              </div>
              <div className="text-slate-700 dark:text-slate-300">
                {transcript && (
                  <span className="font-semibold">{transcript} </span>
                )}
                {interimTranscript && (
                  <span className="text-slate-500 dark:text-slate-400 italic">
                    {interimTranscript}
                  </span>
                )}
                {!transcript && !interimTranscript && (
                  <span className="text-slate-400 dark:text-slate-500 italic">
                    Speak now...
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Command Input */}
          <form onSubmit={handleAgentSubmit} className="flex gap-2">
            <input
              type="text"
              value={agentInput}
              onChange={(e) => setAgentInput(e.target.value)}
              placeholder="Try: set thermostat to 72, switch to cool mode, set room temp to 65..."
              className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isRunning}
            />
            <button
              type="submit"
              disabled={isRunning || !agentInput.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </form>

          {/* Quick Command Buttons */}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => {
                setAgentInput("set thermostat to 72");
              }}
              className="px-3 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
            >
              Set to 72°F
            </button>
            <button
              onClick={() => {
                setAgentInput("switch to cool mode");
              }}
              className="px-3 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
            >
              Cool Mode
            </button>
            <button
              onClick={() => {
                setAgentInput("set room temp to 65");
              }}
              className="px-3 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
            >
              Room 65°F
            </button>
            <button
              onClick={() => {
                setAgentInput("what is the current status");
              }}
              className="px-3 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
            >
              Status
            </button>
          </div>
        </div>

        {/* Contactors grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <ContactorCard
            terminal="W"
            label="Heat"
            color="orange"
            isClosed={contactorStates.W}
            onToggle={() => toggleContactor("W")}
          />
          <ContactorCard
            terminal="Y"
            label="Cool/Compressor"
            color="blue"
            isClosed={contactorStates.Y}
            isLocked={isLocked}
            lockoutUntil={lockoutUntil}
            onToggle={() => toggleContactor("Y")}
          />
          <ContactorCard
            terminal="G"
            label="Fan/Blower"
            color="green"
            isClosed={contactorStates.G}
            onToggle={() => toggleContactor("G")}
          />
        </div>

        {/* Legend */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
            How it works
          </h2>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <li>
              <strong className="text-slate-800 dark:text-slate-200">
                R (hot):
              </strong>{" "}
              24 VAC supply from transformer
            </li>
            <li>
              <strong className="text-slate-800 dark:text-slate-200">
                C (common):
              </strong>{" "}
              24 VAC return
            </li>
            <li>
              <strong className="text-slate-800 dark:text-slate-200">
                Normally Open (NO):
              </strong>{" "}
              Contacts are open by default; close when thermostat calls for that
              function
            </li>
            <li>
              <strong className="text-slate-800 dark:text-slate-200">W:</strong>{" "}
              Close R→W to energize heat
            </li>
            <li>
              <strong className="text-slate-800 dark:text-slate-200">Y:</strong>{" "}
              Close R→Y to energize compressor contactor coil
            </li>
            <li>
              <strong className="text-slate-800 dark:text-slate-200">G:</strong>{" "}
              Close R→G to run indoor blower
            </li>
          </ul>
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-500">
            Tip: Run ShortCycleTest in another tab and enable hardware mode to
            see contactors react in real-time.
          </p>
        </div>
      </div>
    </div>
  );
}

function ContactorCard({
  terminal,
  label,
  color,
  isClosed,
  isLocked,
  lockoutUntil,
  onToggle,
}) {
  const colorMap = {
    orange: {
      bg: "bg-orange-500",
      shadow: "shadow-orange-500/50",
      border: "border-orange-500",
      text: "text-orange-600 dark:text-orange-400",
    },
    blue: {
      bg: "bg-blue-500",
      shadow: "shadow-blue-500/50",
      border: "border-blue-500",
      text: "text-blue-600 dark:text-blue-400",
    },
    green: {
      bg: "bg-green-500",
      shadow: "shadow-green-500/50",
      border: "border-green-500",
      text: "text-green-600 dark:text-green-400",
    },
  };

  const colors = colorMap[color];
  const showLockout = isLocked && terminal === "Y";

  return (
    <div
      className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg cursor-pointer hover:shadow-xl transition-shadow relative"
      onClick={onToggle}
    >
      {/* Lockout badge overlay */}
      {showLockout && (
        <div className="absolute top-4 right-4 z-10 px-3 py-1 rounded-full text-xs font-bold bg-red-600 text-white shadow-lg shadow-red-600/50 animate-pulse">
          LOCKOUT
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className={`text-2xl font-bold ${colors.text}`}>{terminal}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          {showLockout && lockoutUntil && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              Until {new Date(lockoutUntil).toLocaleTimeString()}
            </p>
          )}
        </div>
        <div
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            isClosed
              ? `${colors.bg} text-white shadow-lg ${colors.shadow}`
              : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
          }`}
        >
          {isClosed ? "CLOSED" : "OPEN"}
        </div>
      </div>

      {/* Animated contactor */}
      <div className="relative h-48 flex items-center justify-center">
        <ContactorSVG
          isClosed={isClosed}
          color={color}
          isLocked={showLockout}
        />
      </div>

      {/* Terminal labels */}
      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-4">
        <span className="font-mono">R (hot)</span>
        <span className="font-mono">{terminal}</span>
      </div>
    </div>
  );
}

function ContactorSVG({ isClosed, color, isLocked }) {
  const colorMap = {
    orange: "#f97316",
    blue: "#3b82f6",
    green: "#22c55e",
  };

  const strokeColor = isLocked ? "#dc2626" : colorMap[color]; // Red when locked

  return (
    <svg
      width="200"
      height="160"
      viewBox="0 0 200 160"
      className="drop-shadow-md"
    >
      {/* Fixed terminal - R (hot) - left */}
      <circle
        cx="40"
        cy="80"
        r="8"
        fill="#ef4444"
        stroke="#991b1b"
        strokeWidth="2"
      />
      <text
        x="40"
        y="105"
        fontSize="10"
        textAnchor="middle"
        fill="currentColor"
      >
        R
      </text>

      {/* Fixed terminal - Function (W/Y/G) - right */}
      <circle
        cx="160"
        cy="80"
        r="8"
        fill={isLocked ? "#dc2626" : colorMap[color]}
        stroke="#334155"
        strokeWidth="2"
      />
      <text
        x="160"
        y="105"
        fontSize="10"
        textAnchor="middle"
        fill="currentColor"
      >
        OUT
      </text>

      {/* Left contact (fixed) */}
      <motion.line
        x1="48"
        y1="80"
        x2="75"
        y2="80"
        stroke="#334155"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Right contact (fixed) */}
      <motion.line
        x1="152"
        y1="80"
        x2="125"
        y2="80"
        stroke="#334155"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Moving contact (animated) - stays open when locked */}
      <AnimatePresence mode="wait">
        {isClosed && !isLocked ? (
          <motion.g
            key="closed"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            {/* Closed position - horizontal bridge */}
            <motion.line
              x1="75"
              y1="80"
              x2="125"
              y2="80"
              stroke={strokeColor}
              strokeWidth="6"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.2 }}
            />
            {/* Contact indicator dots */}
            <circle cx="75" cy="80" r="3" fill={strokeColor} />
            <circle cx="125" cy="80" r="3" fill={strokeColor} />
          </motion.g>
        ) : (
          <motion.g
            key="open"
            initial={{ y: 0, opacity: 1 }}
            animate={{ y: -15, opacity: 1 }}
            exit={{ y: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            {/* Open position - angled up */}
            <motion.line
              x1="75"
              y1="65"
              x2="115"
              y2="50"
              stroke={isLocked ? "#dc2626" : "#64748b"}
              strokeWidth="6"
              strokeLinecap="round"
            />
            {/* Gap indicator */}
            <circle cx="100" cy="57" r="2" fill="#ef4444" opacity="0.5" />
          </motion.g>
        )}
      </AnimatePresence>

      {/* Spring/coil indicator (solenoid) - glows red when locked */}
      <motion.g
        animate={{
          y: isClosed && !isLocked ? 2 : -2,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 10 }}
      >
        <path
          d="M 100 20 Q 95 25, 100 30 Q 105 35, 100 40"
          stroke={isLocked ? "#dc2626" : "#94a3b8"}
          strokeWidth="2"
          fill="none"
        />
        {isLocked && (
          <motion.circle
            cx="100"
            cy="30"
            r="8"
            fill="#dc2626"
            opacity="0.3"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        )}
        <line
          x1="100"
          y1="15"
          x2="100"
          y2="20"
          stroke={isLocked ? "#dc2626" : "#94a3b8"}
          strokeWidth="2"
        />
        <line
          x1="100"
          y1="40"
          x2="100"
          y2="55"
          stroke={isLocked ? "#dc2626" : "#94a3b8"}
          strokeWidth="2"
        />
      </motion.g>

      {/* Current flow indicator when closed and not locked */}
      <AnimatePresence>
        {isClosed && !isLocked && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          >
            <circle cx="60" cy="80" r="4" fill={strokeColor} opacity="0.8" />
            <circle cx="100" cy="80" r="4" fill={strokeColor} opacity="0.8" />
            <circle cx="140" cy="80" r="4" fill={strokeColor} opacity="0.8" />
          </motion.g>
        )}
      </AnimatePresence>
    </svg>
  );
}
