import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSpeechRecognition } from "../../hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "../../hooks/useSpeechSynthesis";
import { parseAskJoule } from "../../utils/askJouleParser";
import { answerWithAgent } from "../../lib/groqAgent";
import { hasSalesIntent, EBAY_STORE_URL } from "../../utils/rag/salesFAQ";
import {
  calculateHeatLoss,
  formatHeatLossResponse,
} from "../../utils/calculatorEngines";
import { calculateBalancePoint } from "../../utils/balancePointCalculator";

export function useAskJoule({
  onParsed,
  tts: ttsProp,
  groqKey: groqKeyProp,
  userSettings = {},
  userLocation = null,
  annualEstimate = null,
  recommendations = [],
  onNavigate = null,
  onSettingChange = null,
  salesMode = false,
}) {
  const navigate = useNavigate();

  // --- State ---
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [outputStatus, setOutputStatus] = useState(""); // 'success' | 'error' | 'info' | ''
  const [showGroqPrompt, setShowGroqPrompt] = useState(false);
  const [isLoadingGroq, setIsLoadingGroq] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCommandHelp, setShowCommandHelp] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showPersonalization, setShowPersonalization] = useState(false);

  // Response state
  const [answer, setAnswer] = useState("");
  const [agenticResponse, setAgenticResponse] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState("");

  // History
  const [commandHistory, setCommandHistory] = useState(() => {
    try {
      const stored = localStorage.getItem("askJouleHistory");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [lastQuery, setLastQuery] = useState(null);

  // Refs
  const inputRef = useRef(null);
  const submitRef = useRef(null);

  // --- Hooks ---
  // Wake word detection enabled state
  const [wakeWordEnabled, setWakeWordEnabled] = useState(() => {
    try {
      return localStorage.getItem("askJouleWakeWordEnabled") === "true";
    } catch {
      return false;
    }
  });

  const {
    speak,
    stop: stopSpeaking,
    isSpeaking,
    isEnabled: speechEnabled,
    toggleEnabled: toggleSpeech,
  } = useSpeechSynthesis({
    enabled: ttsProp !== false,
  });

  const {
    supported: recognitionSupported,
    isListening,
    transcript,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    interim: true,
    continuous: true,
    autoRestart: true,
    maxAutoRestarts: 8,
    autoStopOnFinal: true,
    // NOTE: We intentionally do NOT use onInterim to set value here.
    // The useEffect below (lines ~118-120) correctly syncs transcript -> value
    // whenever the transcript state changes. Using onInterim with a closure
    // would capture a stale `transcript` value and cause bugs.
    onFinal: (finalText) => {
      if (!finalText) return;
      setValue(finalText);
      // Submit shortly after finalization
      setTimeout(() => {
        try {
          if (submitRef.current)
            submitRef.current({ preventDefault: () => {} });
        } catch {
          /* ignore submit failure */
        }
      }, 600);
    },
  });

  // Wake word detection - DEMO MODE ONLY (Browser-based)
  // TODO: Replace with Pi-based WebSocket listener when hardware arrives
  // See docs/WAKE-WORD-ARCHITECTURE.md for production plan
  // Note: useWakeWord hook is not yet implemented
  const wakeWordSupported = false;
  const isWakeWordListening = false;
  const wakeWordError = null;

  // Update input live while listening
  useEffect(() => {
    if (isListening && transcript) setValue(transcript);
  }, [isListening, transcript]);

  // --- Suggestions Logic ---
  const contextualSuggestions = useMemo(() => {
    const suggestions = [];

    // Personalized based on recommendations
    if (recommendations.length > 0) {
      suggestions.push(`What can I save?`);
      const topRec = recommendations[0];
      if (topRec.savingsEstimate > 200) {
        suggestions.push(
          `How to save $${Math.round(topRec.savingsEstimate)}/year`
        );
      }
    }

    // System-specific
    if (userSettings.hspf2 && userSettings.hspf2 < 9) {
      suggestions.push(`What if I had a 10 HSPF system?`);
    }
    if (userSettings.efficiency && userSettings.efficiency < 16) {
      suggestions.push(`What if I had 18 SEER?`);
    }

    // Location-specific
    if (userLocation) {
      suggestions.push(`What's normal for ${userLocation.city}?`);
      suggestions.push(`Show me ${userLocation.city} forecast`);
    }

    // General helpful queries
    suggestions.push(`My Joule Score`);
    suggestions.push(`What's my heat loss factor?`);
    suggestions.push(`Set temperature to 72`);
    suggestions.push(`Run analyzer`);
    suggestions.push(`Set to heat mode`);

    return suggestions.slice(0, 8);
  }, [recommendations, userSettings, userLocation]);

  // Filter suggestions
  useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, contextualSuggestions]);

  const placeholder = useMemo(() => {
    // Sales mode placeholder for upgrades/customer service context
    if (salesMode) {
      return 'Try: "What thermostats are compatible?" or "Do you ship to Canada?"';
    }
    if (recommendations && recommendations.length > 0) {
      return 'Try: "What can I save?" or "My score"';
    }
    return 'Try: "2,000 sq ft in Atlanta at 70" or "What is my score?"';
  }, [recommendations, salesMode]);

  // --- Command Handling ---
  const callbacks = {
    onSettingChange,
    setOutput: ({ message, status }) => {
      setError(message);
      setOutputStatus(status);
    },
    speak,
    navigate,
    onNavigate,
  };

  // Handle Offline Intelligence Answers (No API Key Needed)
  const handleOfflineAnswer = (parsed, callbacks) => {
    const { setOutput, speak } = callbacks;
    const { type, answer, check, needsContext } = parsed;

    // Direct answers (knowledge base, calculator, easter egg)
    if (answer) {
      setOutput({ message: answer, status: "info" });
      if (speak) speak(answer);
      return true;
    }

    // Context-dependent answers (need data from context)
    if (needsContext) {
      if (type === "temperature") {
        // Try to get from context or localStorage
        try {
          const tempData = JSON.parse(
            localStorage.getItem("ecobeeData") || "null"
          );
          const temp =
            tempData?.temperature || tempData?.runtime?.actualTemperature / 10;
          if (temp) {
            setOutput({
              message: `Current temperature: ${temp.toFixed(1)}°F`,
              status: "info",
            });
            if (speak) speak(`The temperature is ${Math.round(temp)} degrees`);
            return true;
          }
        } catch (err) {
          console.warn("Temperature data error:", err);
        }
        setOutput({
          message:
            "Temperature data not available. Connect your Ecobee thermostat to see real-time temperature.",
          status: "info",
        });
        return true;
      }

      if (type === "humidity") {
        try {
          const tempData = JSON.parse(
            localStorage.getItem("ecobeeData") || "null"
          );
          const humidity =
            tempData?.humidity || tempData?.runtime?.actualHumidity;
          if (humidity !== undefined) {
            setOutput({
              message: `Current humidity: ${humidity}%`,
              status: "info",
            });
            if (speak) speak(`Humidity is ${humidity} percent`);
            return true;
          }
        } catch (err) {
          console.warn("Humidity data error:", err);
        }
        setOutput({
          message:
            "Humidity data not available. Connect your Ecobee thermostat to see real-time humidity.",
          status: "info",
        });
        return true;
      }

      if (type === "hvacStatus") {
        try {
          const tempData = JSON.parse(
            localStorage.getItem("ecobeeData") || "null"
          );
          const mode = tempData?.hvacMode || tempData?.settings?.hvacMode;
          const isRunning = tempData?.equipmentStatus || "";
          if (mode) {
            const status = isRunning
              ? `HVAC is running in ${mode} mode`
              : `HVAC is in ${mode} mode (not currently running)`;
            setOutput({ message: status, status: "info" });
            if (speak) speak(status);
            return true;
          }
        } catch (err) {
          console.warn("HVAC status error:", err);
        }
        setOutput({
          message:
            "HVAC status not available. Connect your Ecobee thermostat to see real-time status.",
          status: "info",
        });
        return true;
      }

      if (type === "balancePoint") {
        // Calculate from user settings
        try {
          const result = calculateBalancePoint(userSettings);
          if (result && result.balancePoint !== null) {
            setOutput({
              message: `Your balance point is ${result.balancePoint.toFixed(
                1
              )}°F. This is the outdoor temperature where your heat pump output equals your building's heat loss.`,
              status: "info",
            });
            if (speak)
              speak(
                `Balance point is ${Math.round(result.balancePoint)} degrees`
              );
            return true;
          }
        } catch (err) {
          console.warn("Balance point calculation failed:", err);
        }
        setOutput({
          message:
            "Balance point calculation requires system settings. Please configure your heat pump capacity and home details in Settings.",
          status: "info",
        });
        return true;
      }

      if (type === "yesterdayCost") {
        setOutput({
          message:
            "Yesterday's cost calculation requires thermostat runtime data. Upload CSV data in Performance Analyzer to see daily costs.",
          status: "info",
        });
        return true;
      }
    }

    // System status checks
    if (check === "firmware") {
      setOutput({
        message:
          "Firmware check not yet implemented. This will check your local version against GitHub latest.",
        status: "info",
      });
      return true;
    }

    if (check === "bridge") {
      // Check if bridge is connected via localStorage or context
      try {
        const bridgeStatus =
          localStorage.getItem("prostatBridgeConnected") === "true";
        const status = bridgeStatus
          ? "Bridge is connected"
          : "Bridge is not connected";
        setOutput({
          message: status,
          status: bridgeStatus ? "success" : "info",
        });
        if (speak) speak(status);
        return true;
      } catch (err) {
        console.warn("Bridge status error:", err);
      }
      setOutput({
        message: "Bridge connection status not available.",
        status: "info",
      });
      return true;
    }

    if (check === "lastUpdate") {
      try {
        // Check multiple possible localStorage keys for last update timestamp
        const timestamp =
          localStorage.getItem("ecobeeLastUpdate") ||
          localStorage.getItem("lastDataUpdate") ||
          localStorage.getItem("prostatBridgeLastUpdate") ||
          localStorage.getItem("temperatureLastUpdate");
        if (timestamp) {
          const date = new Date(timestamp);
          const timeAgo = Math.round((Date.now() - date.getTime()) / 1000 / 60); // minutes ago
          const timeAgoText =
            timeAgo < 1
              ? "just now"
              : timeAgo === 1
              ? "1 minute ago"
              : `${timeAgo} minutes ago`;
          setOutput({
            message: `Last data update: ${date.toLocaleString()} (${timeAgoText})`,
            status: "info",
          });
          if (speak) speak(`Last update was ${timeAgoText}`);
          return true;
        }
      } catch (err) {
        console.warn("Error reading last update timestamp:", err);
      }
      // Check if we're in demo mode or if there's any data at all
      const hasAnyData =
        localStorage.getItem("ecobeeData") ||
        localStorage.getItem("prostatBridgeData") ||
        localStorage.getItem("temperatureData");

      if (hasAnyData) {
        setOutput({
          message:
            "Last update timestamp not tracked. Data is available but the update time wasn't recorded. This is normal in demo mode or when using manual data entry.",
          status: "info",
        });
      } else {
        setOutput({
          message:
            "No data updates yet. In production, ProStat tracks when your Ecobee thermostat or ProStat Bridge last sent data. Connect your thermostat to see real-time update timestamps.",
          status: "info",
        });
      }
      return true;
    }

    return false;
  };

  const handleCommand = async (parsed) => {
    if (!parsed.isCommand) return false;

    setError("");
    stopSpeaking();

    // 0. Offline Intelligence (Highest Priority - No API Key Needed)
    if (parsed.action === "offlineAnswer") {
      if (import.meta.env.DEV) {
        console.log("[AskJoule] Handling offline answer:", parsed);
      }
      return handleOfflineAnswer(parsed, callbacks);
    }

    // Command handlers are implemented inline below
    // Note: askJouleCommandHandlers module is not yet available

    // 6.5 Byzantine Mode Easter Egg 🕯️
    if (parsed.action === "setByzantineMode") {
      const enabled = parsed.value;
      localStorage.setItem("byzantineMode", enabled ? "true" : "false");
      console.log(
        `[AskJoule] 🕯️ Byzantine Mode ${
          enabled ? "ENABLED" : "DISABLED"
        } - localStorage set to: ${localStorage.getItem("byzantineMode")}`
      );
      if (enabled) {
        setError(`🕯️ BYZANTINE MODE ACTIVATED 🕯️

Oh faithful servant of efficiency! The Holy Order of HVAC doth welcome thee.
Henceforth, all responses shall be delivered in the sacred tradition of Byzantine liturgical chant.

Rejoice, Oh Coil Unfrosted!
Glory to Thee, Oh Scroll Compressor!
May thy HSPF be ever high, and thy electric bills be ever low.

(Mode Plagal of the Fourth, with faint 60Hz hum)
Amen.`);
        setOutputStatus("success");
        speak?.("Rejoice, Oh Coil Unfrosted! Byzantine mode is now active.");
      } else {
        setError(
          `Byzantine mode disabled. Joule returns to normal speech patterns.`
        );
        setOutputStatus("info");
      }
      return true;
    }

    // Advanced command handlers are implemented inline below

    // 9. Analysis / What-If (Logic kept here for now as it needs specific context)
    switch (parsed.action) {
      case "showScore":
        if (userSettings.hspf2 && userSettings.efficiency) {
          const hspf = Number(userSettings.hspf2) || 9;
          const seer = Number(userSettings.efficiency) || 15;
          const score = Math.max(
            1,
            Math.min(100, 70 + (hspf - 8) * 2 + (seer - 14) * 1.2)
          );
          setError(
            `🎯 Your Joule Score: ${Math.round(
              score
            )}/100 (HSPF: ${hspf.toFixed(1)}, SEER: ${seer.toFixed(1)})`
          );
          setOutputStatus("success");
        } else {
          setError(`Complete your system settings to see your Joule Score!`);
          setOutputStatus("info");
        }
        return true;

      case "systemStatus":
        if (userSettings.hspf2 && annualEstimate) {
          const status = [
            `System: ${userSettings.hspf2} HSPF2 / ${userSettings.efficiency} SEER2`,
            `Annual cost: $${Math.round(annualEstimate.totalCost)}`,
          ];
          if (recommendations.length > 0) {
            status.push(
              `💡 ${recommendations.length} improvement(s) available`
            );
          }
          setError(status.join(" • "));
          setOutputStatus("info");
        } else {
          // Provide more specific and helpful error message
          if (!userLocation) {
            setError(`Set your location to see system status.`);
          } else if (!userSettings.hspf2 && !userSettings.efficiency) {
            setError(
              `Set your system efficiency (HSPF2 and/or SEER2) to see status.`
            );
          } else if (!annualEstimate) {
            // Location is set but annualEstimate is null - need building details
            setError(
              `Set your building details (square footage, insulation level, etc.) in Settings to calculate your annual costs.`
            );
          } else {
            setError(`Unable to calculate status. Please check your settings.`);
          }
          setOutputStatus("info");
        }
        return true;

      case "whatIfHSPF":
        if (annualEstimate && userSettings.hspf2) {
          const currentHSPF = Number(userSettings.hspf2) || 9;
          const newHSPF = parsed.value;
          const improvementRatio = newHSPF / currentHSPF;
          const currentHeating = annualEstimate.heatingCost || 0;
          const newCost = currentHeating / improvementRatio;
          const savings = currentHeating - newCost;
          setError(
            `With ${newHSPF} HSPF2: Heating cost would be $${Math.round(
              newCost
            )}/year (save $${Math.round(savings)})`
          );
          setOutputStatus("info");
        } else {
          setError(
            `Set your location and current HSPF2 to calculate what-if scenarios.`
          );
          setOutputStatus("info");
        }
        return true;

      case "whatIfSEER":
        if (annualEstimate && userSettings.efficiency) {
          const currentSEER = Number(userSettings.efficiency) || 15;
          const newSEER = parsed.value;
          const improvementRatio = newSEER / currentSEER;
          const currentCooling = annualEstimate.coolingCost || 0;
          const newCost = currentCooling / improvementRatio;
          const savings = currentCooling - newCost;
          setError(
            `With ${newSEER} SEER2: Cooling cost would be $${Math.round(
              newCost
            )}/year (save $${Math.round(savings)})`
          );
          setOutputStatus("info");
        } else {
          setError(
            `Set your location and current SEER2 to calculate what-if scenarios.`
          );
          setOutputStatus("info");
        }
        return true;

      case "calculateHeatLoss": {
        // Get thermal factor from annualEstimate or userSettings
        let thermalFactor = null;
        let heatLossFactor = null;
        let squareFeet = userSettings?.squareFeet || null;

        // Try to get from annualEstimate (analyzed CSV data)
        if (annualEstimate && annualEstimate.thermalFactor) {
          thermalFactor = annualEstimate.thermalFactor;
        } else if (annualEstimate && annualEstimate.heatLossFactor) {
          heatLossFactor = annualEstimate.heatLossFactor;
        }

        // Fallback to userSettings
        if (!thermalFactor && !heatLossFactor) {
          if (userSettings?.thermalFactor) {
            thermalFactor = userSettings.thermalFactor;
          } else if (userSettings?.heatLossFactor) {
            heatLossFactor = userSettings.heatLossFactor;
          }
        }

        // Calculate heat loss
        const heatLossResult = calculateHeatLoss({
          outdoorTemp: parsed.outdoorTemp,
          indoorTemp: userSettings?.winterThermostat || 68,
          thermalFactor,
          heatLossFactor,
          squareFeet,
        });

        if (heatLossResult.error) {
          setError(
            `❌ ${heatLossResult.error}\n\nTo calculate heat loss, please:\n1. Upload your thermostat CSV data in the Performance Analyzer, or\n2. Set your square footage in Settings.`
          );
          setOutputStatus("error");
        } else {
          const response = formatHeatLossResponse(heatLossResult);
          setError(response);
          setOutputStatus("success");
          speak?.(
            `Your heat loss at ${
              parsed.outdoorTemp
            } degrees is ${heatLossResult.heatLossBtuPerHour.toLocaleString()} BTU per hour.`
          );
        }
        return true;
      }
    }

    return false;
  };

  const handleSubmit = async (e, textOverride = null) => {
    if (e?.preventDefault) e.preventDefault();
    const input = textOverride || value.trim();
    if (!input) return;

    setLastQuery(input);

    // Add to history
    const newHistory = [input, ...commandHistory].slice(0, 50);
    setCommandHistory(newHistory);
    localStorage.setItem("askJouleHistory", JSON.stringify(newHistory));

    // Clear previous state
    setAnswer("");
    setAgenticResponse(null);
    setError("");
    setOutputStatus("");
    setLoadingMessage("Thinking...");
    setIsLoadingGroq(true);
    setShowGroqPrompt(true); // Show the response area
    setValue(""); // Clear input immediately

    try {
      // 1. Try local regex command parsing first
      const parsed = parseAskJoule(input);
      if (import.meta.env.DEV) {
        console.log("[AskJoule] Parsed query:", {
          input,
          parsed,
          isCommand: parsed.isCommand,
          action: parsed.action,
        });
      }

      // Check for sales queries (Presales RAG capability)
      if (parsed.isSalesQuery) {
        setIsLoadingGroq(false);
        setLoadingMessage(""); // Clear loading
        setShowGroqPrompt(false);
        // Set the sales answer as the response
        setAgenticResponse({
          success: true,
          message: parsed.salesAnswer,
          source: "salesFAQ",
        });
        if (onParsed) onParsed(parsed); // Notify parent
        return;
      }

      if (parsed.isCommand) {
        const handled = await handleCommand(parsed);
        if (handled) {
          // If handled locally, we're done
          setIsLoadingGroq(false);
          setLoadingMessage(""); // Clear loading
          setShowGroqPrompt(false);
          if (onParsed) onParsed(parsed); // Notify parent
          return;
        }
      }

      // 2. Fallback to Groq Agent
      // Check prop first, then localStorage, then env variable
      const groqApiKey =
        groqKeyProp ||
        (typeof window !== "undefined"
          ? localStorage.getItem("groqApiKey")
          : null) ||
        import.meta.env.VITE_GROQ_API_KEY;

      if (!groqApiKey || !groqApiKey.trim()) {
        setError("API_KEY_ERROR"); // Special marker for API key error
        setOutputStatus("error");
        setLoadingMessage("");
        setIsLoadingGroq(false);
        return;
      }

      // Format history for agent
      const historyForAgent = commandHistory
        .slice(0, 5)
        .map((cmd) => ({ role: "user", content: cmd }));

      console.log("[AskJoule] Calling answerWithAgent with:", {
        input,
        hasApiKey: !!groqApiKey,
      });

      const response = await answerWithAgent(
        input,
        groqApiKey,
        null, // thermostatData
        userSettings,
        userLocation,
        historyForAgent
      );

      console.log("[AskJoule] Got response:", response);

      // Handle response
      if (response) {
        if (response.error) {
          console.log("[AskJoule] Response has error:", response.message);
          // Store the full error object to check for needsApiKey
          if (response.needsApiKey) {
            setError("API_KEY_ERROR"); // Special marker for API key error
            setOutputStatus("error");
          } else {
            setError(response.message || "AI request failed");
            setOutputStatus("error");
          }
        } else if (response.success && response.message) {
          console.log(
            "[AskJoule] Success! Message:",
            response.message?.slice(0, 100)
          );

          // Check if this is a sales query and the AI couldn't answer well
          const isSalesQuery = salesMode || hasSalesIntent(input);
          if (isSalesQuery) {
            const message = response.message.toLowerCase();
            // Detect uncertainty phrases
            const uncertaintyPhrases = [
              "i don't know",
              "i'm not sure",
              "i cannot",
              "i can't",
              "i'm unable",
              "i don't have",
              "i'm not certain",
              "i'm uncertain",
              "i'm not familiar",
              "i don't have information",
              "i don't have the answer",
              "i'm not able to",
              "unable to",
              "cannot answer",
              "don't have that information",
            ];

            const showsUncertainty = uncertaintyPhrases.some((phrase) =>
              message.includes(phrase)
            );

            // Also check if response is very short (likely unhelpful)
            const isTooShort = response.message.trim().length < 50;

            if (showsUncertainty || isTooShort) {
              // Append message seller advice
              const sellerMessage = `\n\nIf you need more specific information, please message the seller directly on eBay: ${EBAY_STORE_URL}`;
              setAgenticResponse({
                ...response,
                message: response.message + sellerMessage,
              });
            } else {
              setAgenticResponse(response);
            }
          } else {
            setAgenticResponse(response);
          }
        } else {
          console.log("[AskJoule] Unexpected response format:", response);
          setError("Received an unexpected response format");
          setOutputStatus("error");
        }
        setShowGroqPrompt(false);
      } else {
        console.log("[AskJoule] No response received");
        setError("No response from AI assistant");
        setOutputStatus("error");
      }
    } catch (err) {
      console.error("AskJoule error:", err);
      setError(
        `Sorry, I encountered an error: ${err.message || "Unknown error"}`
      );
      setOutputStatus("error");
    } finally {
      setIsLoadingGroq(false);
      setLoadingMessage(""); // Always clear loading message
    }
  };

  const toggleListening = () => {
    if (isListening) stopListening();
    else startListening();
  };

  const handleRetryGroq = () => {
    if (lastQuery) handleSubmit(null, lastQuery);
  };

  const handleCancelGroq = () => {
    setShowGroqPrompt(false);
    setIsLoadingGroq(false);
    setLoadingMessage("");
    setAgenticResponse(null);
  };

  return {
    // State
    value,
    setValue,
    error,
    outputStatus,
    showGroqPrompt,
    isLoadingGroq,
    suggestions,
    showSuggestions,
    showCommandHelp,
    setShowCommandHelp,
    showAudit,
    setShowAudit,
    showPersonalization,
    setShowPersonalization,
    answer,
    agenticResponse,
    loadingMessage,
    isListening,
    transcript,
    speechEnabled,
    isSpeaking,
    inputRef,
    submitRef,
    recognitionSupported,
    commandHistory, // Exposed for completeness
    placeholder,

    // Actions
    handleSubmit,
    toggleListening,
    toggleSpeech,
    setShowSuggestions,
    setError,
    handleRetryGroq,
    handleCancelGroq,

    // Wake word
    wakeWordEnabled,
    setWakeWordEnabled: (enabled) => {
      setWakeWordEnabled(enabled);
      try {
        localStorage.setItem(
          "askJouleWakeWordEnabled",
          enabled ? "true" : "false"
        );
      } catch {
        // Ignore localStorage errors
      }
    },
    wakeWordSupported,
    isWakeWordListening,
    wakeWordError,
  };
}
