import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSpeechRecognition } from "../../hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "../../hooks/useSpeechSynthesis";
import { useWakeWord } from "../../hooks/useWakeWord";
import { executeCommand } from "../../utils/nlp/commandExecutor";
import { parseAskJoule } from "../../utils/askJouleParser";
import {
  answerWithAgent,
  MARKETING_SITE_SYSTEM_PROMPT,
} from "../../lib/groqAgent";
// EBAY_STORE_URL is now lazy loaded - access via salesFAQ module when needed
// For now, use a constant if needed elsewhere
export const EBAY_STORE_URL = "https://www.ebay.com/usr/firehousescorpions";
import { hasSalesIntent } from "../../utils/rag/salesFAQ";
import { ROUTES } from "../../utils/routes";
import {
  calculateHeatLoss,
  formatHeatLossResponse,
  calculateSetbackSavings,
  formatSetbackResponse,
  compareHeatingSystems,
  formatComparisonResponse,
} from "../../utils/calculatorEngines";
import { calculateBalancePoint } from "../../utils/balancePointCalculator";
import { getSystemHealthAlerts } from "../../utils/alertDetector";
import {
  getWiringDiagramForQuery,
  generateEcobeeWiringDiagram,
} from "../../utils/ecobeeWiringDiagrams";
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
  handleAdvancedSettingsCommand,
  SETTING_COMMANDS,
} from "../../utils/askJouleCommandHandlers";

export function useAskJoule({
  onParsed,
  hasLocation,
  disabled,
  tts: ttsProp,
  groqKey: groqKeyProp,
  userSettings = {},
  userLocation = null,
  annualEstimate = null,
  recommendations = [],
  onNavigate = null,
  onSettingChange = null,
  auditLog = [],
  onUndo = null,
  salesMode = false,
  pushAuditLog = null,
  latestAnalysis = null,
}) {
  const navigate = useNavigate();

  // Expose parseAskJoule on window for E2E tests (fallback if main.jsx dynamic import fails)
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1")
    ) {
      if (!window.parseAskJoule) {
        window.parseAskJoule = parseAskJoule;
      }
    }
  }, []);

  // --- State ---
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [outputStatus, setOutputStatus] = useState(""); // 'success' | 'error' | 'info' | ''
  const [showGroqPrompt, setShowGroqPrompt] = useState(false);
  const [isLoadingGroq, setIsLoadingGroq] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCommandHelp, setShowCommandHelp] = useState(false);
  const [showQuestionHelp, setShowQuestionHelp] = useState(false);
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
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Refs
  const inputRef = useRef(null);
  const submitRef = useRef(null);
  const handleSubmitRef = useRef(null);
  const valueClearedRef = useRef(false);
  const shouldBeListeningRef = useRef(false);
  const speechManuallyStoppedRef = useRef(false);
  const lastProcessedResponseRef = useRef(null); // Track last processed response to prevent loops
  const speakerAutoEnabledRef = useRef(false); // Track if we auto-enabled speaker for this session
  const isProcessingResponseRef = useRef(false); // Prevent concurrent response processing
  const speechTimeoutRef = useRef(null); // Track speech timeout to prevent multiple calls

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

  // Check for pending TTS messages on mount (e.g., after navigation)
  useEffect(() => {
    const pendingTTS = sessionStorage.getItem("askJoule_pendingTTS");
    const pendingTimestamp = sessionStorage.getItem(
      "askJoule_pendingTTS_timestamp"
    );

    if (pendingTTS && pendingTimestamp) {
      const timestamp = parseInt(pendingTimestamp);
      const age = Date.now() - timestamp;

      // If the message is recent (within 3 seconds) and TTS is enabled, continue speaking
      if (age < 3000 && speechEnabled && speak) {
        // Check if TTS is still speaking (it might have continued during navigation)
        if (
          typeof window !== "undefined" &&
          window.speechSynthesis &&
          !window.speechSynthesis.speaking
        ) {
          // TTS was interrupted, restart it
          setTimeout(() => {
            speak(pendingTTS);
          }, 100);
        }

        // Clean up the pending TTS flag
        sessionStorage.removeItem("askJoule_pendingTTS");
        sessionStorage.removeItem("askJoule_pendingTTS_timestamp");
      } else if (age >= 3000) {
        // Message is stale, clean it up
        sessionStorage.removeItem("askJoule_pendingTTS");
        sessionStorage.removeItem("askJoule_pendingTTS_timestamp");
      }
    }
  }, [speak, speechEnabled]);

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
    autoStopOnFinal: false, // Keep listening after command so user can give multiple commands
    // NOTE: We intentionally do NOT use onInterim to set value here.
    // The useEffect below (lines ~118-120) correctly syncs transcript -> value
    // whenever the transcript state changes. Using onInterim with a closure
    // would capture a stale `transcript` value and cause bugs.
    onFinal: (finalText) => {
      if (!finalText) return;

      // Auto-enable speech when using voice input (user expects voice output)
      // Note: We'll check isListening in the useEffect instead to avoid closure issues

      // finalText now contains only the NEW command (hook handles extraction)
      setValue(finalText);
      // Submit shortly after finalization - use ref to access handleSubmit
      setTimeout(async () => {
        try {
          if (handleSubmitRef.current) {
            await handleSubmitRef.current(null, finalText);
            // Clear the input field after command executes so next voice command is fresh
            valueClearedRef.current = true; // Flag that we're clearing to prevent transcript from repopulating
            setValue("");
          }
        } catch (err) {
          console.error("Error submitting voice command:", err);
        }
      }, 600);
    },
  });

  // Wake word detection - DEMO MODE ONLY (Browser-based)
  // TODO: Replace with Pi-based WebSocket listener when hardware arrives
  // See docs/WAKE-WORD-ARCHITECTURE.md for production plan
  const {
    supported: wakeWordSupported,
    isListening: isWakeWordListening,
    error: wakeWordError,
  } = useWakeWord({
    onWake: () => {
      console.log(
        "[AskJoule] Wake word detected (DEMO MODE), starting listening..."
      );
      if (!isListening && recognitionSupported) {
        startListening();
        // Optional: Play a subtle sound or show visual feedback
        speak?.("Listening...");
      }
    },
    enabled: wakeWordEnabled && recognitionSupported,
    wakeWord: "hey joule", // Note: Actually uses "Hey Pico" (Porcupine built-in)
  });

  // Pause speech recognition when speech synthesis is speaking
  // This prevents the microphone from picking up the system's own voice
  useEffect(() => {
    if (!recognitionSupported) return;

    // Clear any pending timeouts when effect runs
    const currentTimeout = speechTimeoutRef.current;
    if (currentTimeout) {
      clearTimeout(currentTimeout);
      speechTimeoutRef.current = null;
    }

    if (isSpeaking) {
      // System is speaking - pause recognition if it's currently listening
      if (isListening) {
        shouldBeListeningRef.current = true; // Remember user wanted to listen
        stopListening();
      }
      // Reset manual stop flag when speech starts (user might have stopped previous speech)
      speechManuallyStoppedRef.current = false;
    } else {
      // System finished speaking - resume recognition if user wanted to listen
      // IMPORTANT: Only resume if shouldBeListeningRef is true (user hasn't manually turned it off)
      // Only resume if we're not currently listening (to avoid conflicts)
      // Add a longer delay to prevent rapid toggling
      if (shouldBeListeningRef.current && !isListening && !isSpeaking) {
        // Longer delay to ensure speech synthesis has fully stopped and state has settled
        const timeoutId = setTimeout(() => {
          // Double-check conditions before resuming (including that user still wants to listen)
          if (shouldBeListeningRef.current && !isListening && !isSpeaking) {
            startListening();
          }
          speechTimeoutRef.current = null;
        }, 1000); // Increased from 500ms to 1000ms for stability
        speechTimeoutRef.current = timeoutId;
        return () => {
          clearTimeout(timeoutId);
          speechTimeoutRef.current = null;
        };
      }
    }
  }, [
    isSpeaking,
    isListening,
    recognitionSupported,
    startListening,
    stopListening,
  ]);

  // Update input live while listening
  // But don't overwrite if value was just cleared (wait a bit after clearing)
  useEffect(() => {
    if (isListening && transcript) {
      // Only update if we haven't just cleared the value (give it a moment)
      if (!valueClearedRef.current) {
        setValue(transcript);
      } else {
        // Reset the flag after a short delay to allow new speech to populate
        setTimeout(() => {
          valueClearedRef.current = false;
        }, 1000);
      }
    }
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

  // Helper to push audit log entries (if available)
  const pushAuditLogEntry = (entry) => {
    // Try to access pushAuditLog from the prop (passed as parameter to useAskJoule)
    if (pushAuditLog && typeof pushAuditLog === "function") {
      pushAuditLog(entry);
    } else {
      // If pushAuditLog not available, just log a warning (non-critical)
      if (import.meta.env.DEV) {
        console.warn(
          "[AskJoule] pushAuditLog not available, cannot log activity"
        );
      }
    }
  };

  // --- Command Handling ---
  const callbacks = {
    onSettingChange,
    pushAuditLog: pushAuditLogEntry,
    userSettings, // Pass userSettings to command handlers
    setOutput: ({ message, status, speakText }) => {
      // Set the message in the appropriate state based on status
      if (status === "success") {
        setAnswer(message);
        setError(""); // Clear any previous errors
        // Also set agenticResponse so it displays properly
        setAgenticResponse({
          success: true,
          message: message,
          source: "command",
          speakText: speakText || message, // Use speakText if provided, otherwise use message
        });
      } else {
        setError(message);
        setAnswer(""); // Clear any previous answers
        // Store speakText for TTS formatting
        if (speakText) {
          // Store in a way that TTS can access it
          setAgenticResponse({
            success: status !== "error",
            message: message,
            source: "command",
            speakText: speakText,
          });
        }
      }
      setOutputStatus(status);
      setShowGroqPrompt(true); // Show the response area

      // Speak success, error, and info messages
      // Always speak command responses (status === "success") for vocal confirmation
      // Also speak if speech is enabled or user is using voice input
      const shouldSpeak =
        speak &&
        message &&
        (speechEnabled || isListening || status === "success");
      if (shouldSpeak) {
        // Use speakText if provided, otherwise format message for TTS
        let ttsMessage = speakText || message;

        // Format message for TTS: remove markdown, emojis, and format units
        ttsMessage = ttsMessage
          .replace(/^✓\s*/, "") // Remove checkmark
          .replace(/•/g, ". ") // Replace bullet points with period and space (like a period)
          .replace(/\*\*/g, ", ") // Replace double asterisks (bold) with comma pause
          .replace(/\*/g, ", ") // Replace single asterisk with comma pause (short silence)
          .replace(/~/g, "about ") // Replace tilde with "about"
          .replace(/→/g, " to ") // Replace right arrow with "to"
          // Handle dollar amounts with time periods FIRST (before general "/" replacement)
          // Convert "$X/month" to "X dollars per month"
          .replace(
            /\$(\d+(?:,\d{3})*(?:\.\d+)?)\s*\/\s*(month|year|day|week|hr|hour)/gi,
            (match, amount, period) => {
              const num = parseFloat(amount.replace(/,/g, ""));
              const periodText =
                period === "month"
                  ? "per month"
                  : period === "year"
                  ? "per year"
                  : period === "day"
                  ? "per day"
                  : period === "week"
                  ? "per week"
                  : period === "hr" || period === "hour"
                  ? "per hour"
                  : `per ${period}`;
              return `${num} dollars ${periodText}`;
            }
          )
          // Handle "on/off" before general "/" replacement
          .replace(/\bon\s*\/\s*off\b/gi, "on off") // Pronounce "on/off" as "on off" (not "on slash off")
          // Handle BTU/hr before general "/" replacement
          .replace(/\bBTU\s*\/\s*hr\b/gi, "B T U per hour")
          .replace(/(\d+)\s*BTU\s*\/\s*hr\b/gi, "$1 B T U per hour")
          .replace(/\//g, " ") // Replace forward slash with space (prevents "slash" from being spoken)
          // Expand common abbreviations
          .replace(/\becobee\b/gi, "eco bee") // Pronounce as "eco-bee" (like ecosystem)
          // Handle dollar amounts without time periods - convert "$X" to "X dollars"
          .replace(
            /\$(\d+(?:,\d{3})*(?:\.\d+)?)\s*\/\s*(month|year|day|week|hr|hour)/gi,
            (match, amount, period) => {
              const num = parseFloat(amount.replace(/,/g, ""));
              const periodText =
                period === "month"
                  ? "per month"
                  : period === "year"
                  ? "per year"
                  : period === "day"
                  ? "per day"
                  : period === "week"
                  ? "per week"
                  : period === "hr" || period === "hour"
                  ? "per hour"
                  : `per ${period}`;
              return `${num} dollars ${periodText}`;
            }
          )
          // Handle dollar amounts without time periods - convert "$X" to "X dollars"
          .replace(/\$(\d+(?:,\d{3})*(?:\.\d+)?)/g, (match, amount) => {
            const num = parseFloat(amount.replace(/,/g, ""));
            return `${num} dollars`;
          })
          // Handle square footage - use singular "square foot" for 1, plural "square feet" for others
          .replace(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*sq\s*ft\b/gi, (match, num) => {
            const n = parseFloat(num.replace(/,/g, ""));
            const unit = n === 1 ? "square foot" : "square feet";
            return `${num} ${unit}`;
          })
          .replace(/\bsq\s*ft\b/gi, "square feet") // Handle "sq ft" without numbers
          .replace(/\bhrs\b/gi, "hours")
          .replace(/\bmin\b/gi, "minutes")
          .replace(/\bsec\b/gi, "seconds")
          .replace(/\bBTU\b/g, "B T U")
          // Note: BTU/hr already handled above before general "/" replacement
          .replace(/\bHSPF\b/g, "H S P F")
          .replace(/\bSEER\b/g, "S E E R")
          .replace(/\bCOP\b/g, "C O P")
          .replace(/\bHVAC\b/g, "H V A C")
          .replace(/\bAC\b/g, "A C")
          .replace(/\bROI\b/g, "return on investment") // Pronounce ROI as "return on investment"
          .replace(
            /💰|🔍|📊|⚡|🌡️|💡|📈|💵|😴|⚠️|🔥|⏰|🎯|🔄|📅|⚖️|🧪|📍|❄️|⬆️|⬇️|➕|➖|😌|▶️|⏸️/g,
            ""
          ) // Remove emojis
          // Handle numbers with degrees - use singular "degree" for 1, plural for others
          .replace(/(\d+(?:\.\d+)?)°F/gi, (match, num) => {
            const n = parseFloat(num);
            const degree = n === 1 ? "degree" : "degrees";
            return `${num} ${degree} Fahrenheit`;
          })
          .replace(/(\d+(?:\.\d+)?)°C/gi, (match, num) => {
            const n = parseFloat(num);
            const degree = n === 1 ? "degree" : "degrees";
            return `${num} ${degree} Celsius`;
          })
          // Handle remaining degree symbols without numbers
          .replace(/°F/g, " degrees Fahrenheit")
          .replace(/°C/g, " degrees Celsius")
          .replace(/\n\n/g, ". ") // Replace double newlines with period
          .replace(/\n/g, " ") // Replace single newlines with space
          .replace(/\s+/g, " ") // Collapse multiple spaces
          .trim();

        if (ttsMessage) {
          if (import.meta.env.DEV) {
            console.log("[AskJoule] Speaking command response:", ttsMessage);
          }
          speak(ttsMessage);
        } else if (import.meta.env.DEV) {
          console.warn(
            "[AskJoule] TTS message was empty after formatting:",
            message
          );
        }
      }
    },
    speak,
    navigate,
    onNavigate,
  };

  // Handle Offline Intelligence Answers (No API Key Needed)
  const handleOfflineAnswer = (parsed, callbacks) => {
    const { setOutput, speak } = callbacks;
    const { type, answer, check, needsContext, query } = parsed;

    // Direct answers (knowledge base, calculator, easter egg)
    if (answer) {
      setOutput({ message: answer, status: "info" });
      // Note: setOutput automatically handles TTS, so no need to call speak() again
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
        } catch {}
        const msg =
          "Temperature data not available. Connect your Ecobee thermostat to see real-time temperature.";
        setOutput({ message: msg, status: "info" });
        // Note: setOutput automatically handles TTS, so no need to call speak() again
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
        } catch {}
        const msg =
          "Humidity data not available. Connect your Ecobee thermostat to see real-time humidity.";
        setOutput({ message: msg, status: "info" });
        // Note: setOutput automatically handles TTS, so no need to call speak() again
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
            // Note: setOutput automatically handles TTS, so no need to call speak() again
            return true;
          }
        } catch {}
        const msg =
          "HVAC status not available. Connect your Ecobee thermostat to see real-time status.";
        setOutput({ message: msg, status: "info" });
        // Note: setOutput automatically handles TTS, so no need to call speak() again
        return true;
      }

      if (type === "wiring") {
        // Answer wiring questions from knowledge base
        const queryLower = (query || "").toLowerCase();
        const wiringAnswers = {
          "r wire": "R terminal (Red wire) provides 24VAC power to the thermostat. It's required for all systems and connects to the transformer's hot side.",
          "c wire": "C terminal (Common, typically Blue or Black wire) provides the 24VAC return path. Required for Ecobee thermostats. If missing, you may need a Power Extender Kit (PEK).",
          "y wire": "Y terminal (Yellow wire) controls cooling. Connects to the air conditioner compressor contactor or heat pump compressor.",
          "w wire": "W terminal (White wire) controls heating. In conventional systems, activates furnace. In heat pumps, activates auxiliary/emergency heat.",
          "g wire": "G terminal (Green wire) controls the fan independently. Allows fan to run without heating or cooling for air circulation.",
          "o wire": "O terminal (Orange wire) controls the reversing valve on heat pumps. Energized when cooling - used by most brands (Carrier, Trane, Lennox).",
          "b wire": "B terminal (Brown wire) controls reversing valve on some heat pumps. Energized when heating - used by Rheem, Ruud, and some older systems.",
          "reversing valve": "The reversing valve switches heat pump between heating and cooling modes. Most systems use O terminal (energized on cool), but Rheem/Ruud use B terminal (energized on heat).",
          "aux heat": "Auxiliary heat (W1 terminal, White wire) activates backup heat when the heat pump can't keep up. Typically engages below 35-40°F outdoor temperature.",
          "accessory terminal": "ACC+ and ACC- terminals provide 24VAC power for accessories like humidifiers, dehumidifiers, or ventilators. Controlled by Ecobee settings.",
        };

        // Try to match specific wire/terminal question
        let wiringAnswer = null;
        for (const [key, value] of Object.entries(wiringAnswers)) {
          if (queryLower.includes(key)) {
            wiringAnswer = value;
            break;
          }
        }

        if (!wiringAnswer) {
          wiringAnswer = "Common Ecobee terminals: R (24VAC power), C (common), Y (cooling), W (heating), G (fan), O/B (reversing valve for heat pumps). Ask for a wiring diagram to see the full connection layout.";
        }

        setOutput({ message: wiringAnswer, status: "info" });
        return true;
      }

      if (type === "balancePoint") {
        // Calculate from user settings
        try {
          // calculateBalancePoint always returns a result with defaults, so it should never be null
          const result = calculateBalancePoint(userSettings || {});

          if (
            result &&
            result.balancePoint !== null &&
            isFinite(result.balancePoint)
          ) {
            // Add context about where balance point comes from and how it relates to settings
            const sourceInfo = result.source === "analyzer" 
              ? " (calculated from your thermostat data)" 
              : " (calculated from your system capacity and building heat loss)";
            const compressorLockout = userSettings?.thresholds?.compressorMinOutdoorTemp;
            const auxLockout = userSettings?.thresholds?.auxHeatMaxOutdoorTemp;
            
            // Check if balance point seems unrealistic
            let warningNote = "";
            if (result.balancePoint < 15) {
              warningNote = ` Note: A balance point below 15°F is unusual. Most systems in your area have balance points of 20-30°F. This suggests your system may be very oversized, or you may need to verify your system capacity and home details in Settings.`;
            }
            
            let settingsNote = "";
            if (compressorLockout || auxLockout) {
              settingsNote = ` Your compressor lockout is set to ${compressorLockout || 'auto'}°F, and aux heat max outdoor temp is ${auxLockout || 'auto'}°F.`;
              // Add note if balance point differs significantly from compressor lockout
              if (compressorLockout && Math.abs(result.balancePoint - compressorLockout) > 10) {
                settingsNote += ` Your balance point (${result.balancePoint.toFixed(1)}°F) differs significantly from your compressor lockout setting (${compressorLockout}°F). The compressor lockout should typically be set near your balance point.`;
              }
            }
            
            const message = `Your balance point is ${result.balancePoint.toFixed(
              1
            )}°F${sourceInfo}. This is the outdoor temperature where your heat pump output equals your building's heat loss.${warningNote}${settingsNote}`;
            setOutput({ message, status: "info" });
            // Note: setOutput automatically handles TTS, so no need to call speak() again
            return true;
          } else {
            // If balance point is null, it means the calculation couldn't find a crossover
            // This can happen with extremely oversized or undersized systems
            const message = `I calculated your balance point, but it's outside the normal range. Your heat loss factor is ${
              result?.heatLossFactor?.toLocaleString() || "unknown"
            } BTU/hr per °F. This might indicate your system is very oversized or undersized. Check your system capacity and home details in Settings.`;
            setOutput({ message, status: "info" });
            // Note: setOutput automatically handles TTS, so no need to call speak() again
            return true;
          }
        } catch (err) {
          console.error("Balance point calculation failed:", err);
          const errorMessage = `Balance point calculation error: ${err.message}. Please check your system settings in Settings.`;
          setOutput({ message: errorMessage, status: "error" });
          // Note: setOutput automatically handles TTS, so no need to call speak() again
          return true;
        }
      }

      if (type === "yesterdayCost") {
        const msg =
          "Yesterday's cost calculation requires thermostat runtime data. Upload CSV data in Performance Analyzer to see daily costs.";
        setOutput({ message: msg, status: "info" });
        // Note: setOutput automatically handles TTS, so no need to call speak() again
        return true;
      }

      if (type === "filterCoilEfficiency") {
        // Check if we have efficiency drop data from alerts
        let efficiencyDrop = null;
        let hasEfficiencyAlert = false;

        try {
          // Check for efficiency drop alert data
          // Try to get latestAnalysis from props, or from localStorage
          let analysisData = latestAnalysis;
          if (!analysisData) {
            try {
              // Try to get from resultsHistory (same way Home.jsx does it)
              const resultsHistory = JSON.parse(
                localStorage.getItem("spa_resultsHistory") || "[]"
              );
              if (resultsHistory && resultsHistory.length > 0) {
                analysisData = resultsHistory[resultsHistory.length - 1];
              }
            } catch (err) {
              // Ignore
            }
          }
          const alerts = getSystemHealthAlerts(
            userSettings || {},
            analysisData || null,
            "HEAT ON",
            32
          );
          const efficiencyAlert = alerts.find(
            (a) => a.id === "efficiency-drop"
          );
          if (efficiencyAlert && efficiencyAlert.metricSummary) {
            // Extract the percentage from metricSummary like "~25% more kWh/HDD"
            const match = efficiencyAlert.metricSummary.match(/(\d+)%/);
            if (match) {
              efficiencyDrop = parseInt(match[1], 10);
              hasEfficiencyAlert = true;
            }
          }
        } catch (err) {
          // Ignore errors - we'll provide a general answer
        }

        // Build contextual answer
        let message;
        let speakMessage; // TTS-friendly version without markdown/bullets
        if (hasEfficiencyAlert && efficiencyDrop) {
          message = `Yes, a dirty filter or coil could definitely explain why your system is using ${efficiencyDrop}% more energy per heating degree-day.\n\n`;
          message += `**How it works:**\n`;
          message += `• A dirty air filter restricts airflow, forcing your heat pump to work harder to move the same amount of air\n`;
          message += `• A dirty or iced evaporator coil reduces heat transfer efficiency, requiring more runtime to meet the same heating load\n`;
          message += `• Both conditions increase energy consumption (kWh) while delivering less heating capacity (BTU)\n\n`;
          message += `**What to check:**\n`;
          message += `• Air filter: Replace if it's been more than 3 months or looks dirty\n`;
          message += `• Evaporator coil: Check for visible dirt, ice, or frost buildup\n`;
          message += `• Outdoor coil: Clear any debris, leaves, or ice accumulation\n\n`;
          message += `**Expected improvement:** After cleaning/replacing, you should see energy usage return to baseline within a few days. If the problem persists, have your contractor check refrigerant levels and system charge.`;

          // TTS-friendly version: replace bullets with periods
          speakMessage = `Yes, a dirty filter or coil could definitely explain why your system is using ${efficiencyDrop}% more energy per heating degree-day. `;
          speakMessage += `How it works: A dirty air filter restricts airflow, forcing your heat pump to work harder to move the same amount of air. `;
          speakMessage += `A dirty or iced evaporator coil reduces heat transfer efficiency, requiring more runtime to meet the same heating load. `;
          speakMessage += `Both conditions increase energy consumption while delivering less heating capacity. `;
          speakMessage += `What to check: Air filter - replace if it's been more than 3 months or looks dirty. `;
          speakMessage += `Evaporator coil - check for visible dirt, ice, or frost buildup. `;
          speakMessage += `Outdoor coil - clear any debris, leaves, or ice accumulation. `;
          speakMessage += `After cleaning or replacing, you should see energy usage return to baseline within a few days. If the problem persists, have your contractor check refrigerant levels and system charge.`;
        } else {
          message = `Yes, a dirty filter or coil can definitely cause your system to use more energy.\n\n`;
          message += `**How it works:**\n`;
          message += `• **Dirty air filter:** Restricts airflow, forcing the heat pump to work harder. This increases energy consumption (kWh) while reducing heating capacity (BTU output).\n`;
          message += `• **Dirty evaporator coil:** Reduces heat transfer efficiency. The system runs longer to meet the same heating load, using more energy.\n`;
          message += `• **Iced or dirty outdoor coil:** Reduces heat absorption from outside air, lowering the system's COP (coefficient of performance).\n\n`;
          message += `**Signs to look for:**\n`;
          message += `• Energy usage per heating degree-day (kWh/HDD) increasing over time\n`;
          message += `• System running longer cycles to maintain setpoint\n`;
          message += `• Reduced airflow from vents\n`;
          message += `• Visible ice or frost on coils\n\n`;
          message += `**What to do:**\n`;
          message += `• Replace air filter every 1-3 months (check monthly during heavy use)\n`;
          message += `• Have your contractor inspect and clean coils annually\n`;
          message += `• Check for ice buildup, especially in defrost-prone conditions (36-40°F with high humidity)\n\n`;
          message += `If you're seeing a 20%+ increase in energy usage compared to earlier in the season, filter/coil maintenance is often the culprit.`;

          // TTS-friendly version: replace bullets with periods
          speakMessage = `Yes, a dirty filter or coil can definitely cause your system to use more energy. `;
          speakMessage += `How it works: A dirty air filter restricts airflow, forcing the heat pump to work harder. This increases energy consumption while reducing heating capacity. `;
          speakMessage += `A dirty evaporator coil reduces heat transfer efficiency. The system runs longer to meet the same heating load, using more energy. `;
          speakMessage += `An iced or dirty outdoor coil reduces heat absorption from outside air, lowering the system's coefficient of performance. `;
          speakMessage += `Signs to look for: Energy usage per heating degree-day increasing over time. `;
          speakMessage += `System running longer cycles to maintain setpoint. `;
          speakMessage += `Reduced airflow from vents. `;
          speakMessage += `Visible ice or frost on coils. `;
          speakMessage += `What to do: Replace air filter every 1 to 3 months, check monthly during heavy use. `;
          speakMessage += `Have your contractor inspect and clean coils annually. `;
          speakMessage += `Check for ice buildup, especially in defrost-prone conditions around 36 to 40 degrees with high humidity. `;
          speakMessage += `If you're seeing a 20% or more increase in energy usage compared to earlier in the season, filter and coil maintenance is often the culprit.`;
        }

        setOutput({
          message,
          status: "info",
          speakText: speakMessage, // Provide TTS-friendly version
        });
        // Note: setOutput automatically handles TTS, so no need to call speak() again
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
          localStorage.getItem("jouleBridgeConnected") === "true";
        const status = bridgeStatus
          ? "Bridge is connected"
          : "Bridge is not connected";
        setOutput({
          message: status,
          status: bridgeStatus ? "success" : "info",
        });
        if (speak) speak(status);
        return true;
      } catch {}
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
          localStorage.getItem("jouleBridgeLastUpdate") ||
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
        localStorage.getItem("jouleBridgeData") ||
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
    // A command is identified by either isCommand === true OR having an action
    // This handles cases where the parser returns an action but doesn't explicitly set isCommand
    if (!parsed.isCommand && !parsed.action) return false;

    setError("");
    setAnswer(""); // Clear previous answer
    setAgenticResponse(null); // Clear previous response
    stopSpeaking();

    // Clear loading state immediately for commands (they're handled locally)
    setIsLoadingGroq(false);
    setLoadingMessage("");

    // Show response area immediately for command feedback
    setShowGroqPrompt(true);

    // 0. Fun Responses (Highest Priority - Personality/Viral Content)
    if (parsed.action === "funResponse") {
      if (import.meta.env.DEV) {
        console.log("[AskJoule] Handling fun response:", parsed);
      }
      setAnswer(parsed.response);
      setOutputStatus("success");
      setAgenticResponse({
        success: true,
        message: parsed.response,
        source: "funResponse",
      });
      if (speak && speechEnabled && parsed.speakResponse) {
        speak(parsed.speakResponse);
      }
      return true;
    }

    // 0.5. Offline Intelligence (High Priority - No API Key Needed)
    if (parsed.action === "offlineAnswer") {
      if (import.meta.env.DEV) {
        console.log("[AskJoule] Handling offline answer:", parsed);
      }
      return handleOfflineAnswer(parsed, callbacks);
    }

    // 0.6. Wiring Diagrams (High Priority - No API Key Needed)
    if (parsed.action === "wiringDiagram") {
      if (import.meta.env.DEV) {
        console.log("[AskJoule] Handling wiring diagram request:", parsed);
      }
      try {
        const query = parsed.query || "";
        // Try to get wiring config from user settings if available
        const wiringConfig = userSettings?.equipment?.wiring || {};
        const config = {
          hasHeat: wiringConfig.hasHeat !== false,
          hasCool: wiringConfig.hasCool !== false,
          hasFan: wiringConfig.hasFan !== false,
          hasAuxHeat: wiringConfig.hasAuxHeat || false,
          hasHeatPump: userSettings?.equipment?.heatPump?.type === "air-to-air" || userSettings?.equipment?.heatPump?.type === "geothermal",
          reversingValve: userSettings?.equipment?.heatPump?.reversingValve || "O",
          hasHumidifier: wiringConfig.hasHumidifier || false,
          hasDehumidifier: wiringConfig.hasDehumidifier || false,
        };
        
        // Generate diagram based on query or user settings
        const diagram = query 
          ? getWiringDiagramForQuery(query)
          : generateEcobeeWiringDiagram(config);
        
        const message = diagram + "\n\nTip: You can ask for specific configurations like 'wiring diagram for heat pump with aux heat' or 'show me wiring for conventional system'.";
        
        setOutput({ message, status: "info" });
        setAgenticResponse({
          success: true,
          message,
          source: "wiringDiagram",
        });
        return true;
      } catch (error) {
        console.error("[AskJoule] Error generating wiring diagram:", error);
        setOutput({
          message: "Error generating wiring diagram. Please try again.",
          status: "error",
        });
        return true;
      }
    }

    // 1. Setting Commands
    if (SETTING_COMMANDS[parsed.action]) {
      const res = handleSettingCommand(parsed, callbacks);
      if (res?.handled) return true;
    }

    // 2. Presets
    if (
      [
        "sleep",
        "away",
        "home",
        "presetSleep",
        "presetAway",
        "presetHome",
      ].includes(parsed.action)
    ) {
      // Normalize preset action names (presetHome -> home, etc.)
      const presetType = parsed.action.startsWith("preset")
        ? parsed.action.replace("preset", "").toLowerCase()
        : parsed.action;
      const res = handlePresetCommand(presetType, callbacks);
      if (res?.handled) return true;
    }

    // 3. Temp Adjustment
    if (parsed.action === "increaseTemp" || parsed.action === "decreaseTemp") {
      const direction = parsed.action === "increaseTemp" ? "up" : "down";
      const currentWinter = userSettings.winterThermostat || 68;
      const res = handleTempAdjustment(
        direction,
        parsed.value,
        currentWinter,
        callbacks
      );
      if (res?.handled) return true;
    }

    // 3.5. Emergency Comfort (Fixed +5°F or -5°F)
    if (
      parsed.action === "emergencyHeatBoost" ||
      parsed.action === "emergencyCoolBoost"
    ) {
      const direction = parsed.action === "emergencyHeatBoost" ? "up" : "down";
      const currentWinter = userSettings.winterThermostat || 68;
      // Emergency actions use fixed 5-degree adjustment
      const res = handleTempAdjustment(
        direction,
        5, // Fixed emergency boost value
        currentWinter,
        callbacks
      );
      if (res?.handled) {
        // Add friendly message for emergency actions
        const message =
          parsed.action === "emergencyHeatBoost"
            ? "🔥 Emergency heat boost activated! Temperature increased by 5°F."
            : "❄️ Emergency cool boost activated! Temperature decreased by 5°F.";
        setAnswer(message);
        setOutputStatus("success");
        if (speak && speechEnabled) {
          speak(message);
        }
        return true;
      }
    }

    // 4. Navigation
    if (parsed.action === "navigate") {
      const res = handleNavigationCommand(parsed, callbacks);
      if (res?.handled) return true;
    }

    // 5. Educational
    if (parsed.action === "explain") {
      const res = handleEducationalCommand(parsed.target, callbacks);
      if (res?.handled) return true;
    }

    // 6. Help & Dark Mode
    if (parsed.action === "help") return handleHelpCommand(callbacks).handled;
    if (parsed.action === "setDarkMode" || parsed.action === "toggleDarkMode") {
      return handleDarkModeCommand(parsed, callbacks).handled;
    }

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

    // 7. Advanced Settings (Groq API key, model, voice duration)
    const advRes = handleAdvancedSettingsCommand(parsed, callbacks);
    if (advRes.handled) return true;

    // 8. Diagnostics & Thermostat Specifics
    const diagRes = handleDiagnosticCommand(parsed, callbacks);
    if (diagRes.handled) return true;

    const thermRes = handleThermostatSettingCommand(parsed, callbacks);
    if (thermRes.handled) return true;

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

      case "systemStatus": {
        // Get current thermostat state from localStorage
        let currentState = null;
        try {
          if (typeof window !== "undefined") {
            const storedState = localStorage.getItem("thermostatState");
            if (storedState) {
              currentState = JSON.parse(storedState);
            }
          }
        } catch {
          // Ignore parse errors
        }

        const statusParts = [];

        // Show current thermostat state if available
        if (
          currentState &&
          (currentState.currentTemp ||
            currentState.indoorTemp ||
            currentState.targetTemp)
        ) {
          const indoorTemp =
            currentState.currentTemp || currentState.indoorTemp;
          const targetTemp = currentState.targetTemp;
          const mode = currentState.mode || "unknown";
          const isRunning =
            currentState.isRunning || currentState.systemRunning || false;

          if (indoorTemp) {
            statusParts.push(`Current: ${indoorTemp}°F`);
          }
          if (targetTemp) {
            statusParts.push(`Target: ${targetTemp}°F`);
          }
          statusParts.push(`Mode: ${mode}`);
          if (isRunning) {
            statusParts.push(`System: Running`);
          }
          if (currentState.outdoorTemp) {
            statusParts.push(`Outdoor: ${currentState.outdoorTemp}°F`);
          }
        }

        // Add system specs if available
        if (userSettings.hspf2 || userSettings.efficiency) {
          const specs = [];
          if (userSettings.hspf2) specs.push(`${userSettings.hspf2} HSPF2`);
          if (userSettings.efficiency)
            specs.push(`${userSettings.efficiency} SEER2`);
          if (specs.length > 0) {
            statusParts.push(`System: ${specs.join(" / ")}`);
          }
        }

        // Add annual cost if available (optional, not required)
        if (annualEstimate) {
          statusParts.push(
            `Annual cost: $${Math.round(annualEstimate.totalCost)}`
          );
        }

        // Add recommendations if available
        if (recommendations.length > 0) {
          statusParts.push(
            `💡 ${recommendations.length} improvement(s) available`
          );
        }

        if (statusParts.length > 0) {
          callbacks.setOutput({
            message: statusParts.join(" • "),
            status: "info",
          });
        } else {
          // No status data available - provide helpful guidance
          let message;
          if (
            !currentState &&
            !userSettings.hspf2 &&
            !userSettings.efficiency
          ) {
            message = `No system status available. Set up your thermostat or system settings to see status.`;
          } else if (!currentState) {
            message = `System specs: ${
              userSettings.hspf2 ? `${userSettings.hspf2} HSPF2` : ""
            } ${
              userSettings.efficiency ? `${userSettings.efficiency} SEER2` : ""
            }. No current thermostat data available.`;
          } else {
            message = `Status information is limited. Complete your system settings for full status.`;
          }
          callbacks.setOutput({ message, status: "info" });
        }
        return true;
      }

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

      case "showSavings":
        try {
          const winterTemp = userSettings.winterThermostat || 70;
          const summerTemp = userSettings.summerThermostat || 75;

          // Calculate setback savings
          const setbackResults = calculateSetbackSavings({
            winterTemp,
            summerTemp,
            sleepSetback: 4,
            awaySetback: 6,
            sleepHours: 8,
            awayHours: 8,
          });

          const setbackMessage = formatSetbackResponse(setbackResults);

          // Add annual estimate if available
          let savingsMessage = setbackMessage;
          if (annualEstimate) {
            const totalAnnual = annualEstimate.totalCost || 0;
            const potentialSavings = setbackResults.annualSavings;
            const savingsPercent =
              totalAnnual > 0
                ? Math.round((potentialSavings / totalAnnual) * 100)
                : 0;

            savingsMessage = `💰 **Your Savings Opportunities:**\n\n${setbackMessage}\n\n💡 **Additional Tips:**\n• Joule's intelligent scheduling can save 10-23% annually (DOE data)\n• Proper insulation reduces heating costs by 15-20%\n• Regular maintenance improves efficiency by 5-10%`;
          }

          // Use setOutput callback which handles TTS automatically
          callbacks.setOutput({ message: savingsMessage, status: "success" });
        } catch (error) {
          console.error("Savings calculation error:", error);
          callbacks.setOutput({
            message: `I can calculate your savings potential. Please set your thermostat temperatures in Settings first.`,
            status: "info",
          });
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

      case "compareSystem": {
        try {
          // Get user settings for comparison
          const squareFeet = userSettings?.squareFeet || 2000;
          const winterTemp = userSettings?.winterThermostat || 68;
          const electricRate = userSettings?.utilityCost || 0.15;
          const hspfHP = userSettings?.hspf2 || 9;
          const afueGas = 95; // Standard high-efficiency gas furnace

          // Estimate average winter outdoor temp from location (if available)
          let avgWinterOutdoor = 35; // Default
          if (userLocation) {
            // Rough estimate: average of typical winter temps
            // This is a simplification - in production, use actual weather data
            avgWinterOutdoor = 35; // Could be improved with HDD data
          }

          // Calculate gas rate (estimate from electric rate if not available)
          const gasRate = 1.2; // $/therm - typical US average

          const comparisonResults = compareHeatingSystems({
            squareFeet,
            winterTemp,
            avgWinterOutdoor,
            electricRate,
            gasRate,
            hspfHP,
            afueGas,
          });

          const response = formatComparisonResponse(comparisonResults);
          callbacks.setOutput({ message: response, status: "success" });
        } catch (error) {
          console.error("System comparison error:", error);
          callbacks.setOutput({
            message: `I can compare heat pump vs gas furnace costs. Please set your system settings (square feet, HSPF, utility rates) in Settings first.`,
            status: "info",
          });
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

    // Auto-cancel any pending LLM prompt when a new command/question is submitted
    // This prevents the "Send to AI" prompt from blocking new commands
    if (showGroqPrompt && !isLoadingGroq) {
      // Clear the prompt state to allow new commands to execute
      setShowGroqPrompt(false);
      setAgenticResponse(null);
      setAnswer("");
      setError("");
    }

    setLastQuery(input);

    // Add to history
    const newHistory = [input, ...commandHistory].slice(0, 50);
    setCommandHistory(newHistory);
    localStorage.setItem("askJouleHistory", JSON.stringify(newHistory));
    setHistoryIndex(-1);

    // Clear previous state
    setAnswer("");
    setAgenticResponse(null);
    setError("");
    setOutputStatus("");
    setLoadingMessage("Thinking...");
    setIsLoadingGroq(true);
    setShowGroqPrompt(true); // Show the response area
    // Don't clear input - keep it like questions do so user can see what they entered

    try {
      // 1. Try LLM-based intent classification (AI Paradise) with regex fallback (Regex Hell)
      // Get Groq API key from context or localStorage
      const groqApiKeyForParser =
        groqKeyProp ||
        (typeof window !== "undefined"
          ? localStorage.getItem("groqApiKey")
          : null) ||
        import.meta.env.VITE_GROQ_API_KEY;

      const parsed = await parseAskJoule(input, {
        groqApiKey: groqApiKeyForParser,
      });

      // Enhanced logging to debug parser issues
      if (import.meta.env.DEV) {
        console.log("[AskJoule] Parsed query:", {
          input,
          parsed,
          isCommand: parsed?.isCommand,
          action: parsed?.action,
          hasKeys: Object.keys(parsed || {}),
          parsedWith: parsed?.confidence ? "LLM" : "regex",
          fullParsed: JSON.stringify(parsed, null, 2),
        });
      }

      // Check if this is a command FIRST - before any other checks
      // A command is identified by either isCommand === true OR having an action property
      const isCommand = parsed && (parsed.isCommand === true || parsed.action);

      if (import.meta.env.DEV) {
        console.log("[AskJoule] Command detection:", {
          input,
          isCommand,
          hasAction: !!parsed?.action,
          isCommandFlag: parsed?.isCommand,
          willHandleAsCommand: isCommand,
        });
      }

      // If parsed is empty or doesn't have isCommand, it's likely a question
      if (!parsed || Object.keys(parsed).length === 0) {
        if (import.meta.env.DEV) {
          console.warn("[AskJoule] Empty parse result for:", input);
        }
        // Fall through to LLM handling
      } else if (parsed.isCommand === false && !parsed.action) {
        // Explicitly marked as not a command - this is a question for the LLM
        if (import.meta.env.DEV) {
          console.log(
            "[AskJoule] Query marked as question (not command), sending to LLM"
          );
        }
        // Fall through to LLM handling
      } else if (isCommand) {
        // This is a command - handle it
        if (import.meta.env.DEV) {
          console.log("[AskJoule] Recognized as command, handling locally");
        }
        // Will be handled in the if (parsed.isCommand) block below
      }

      // Check for sales queries (Presales RAG capability)
      if (parsed.isSalesQuery) {
        setIsLoadingGroq(false);
        setLoadingMessage(""); // Clear loading
        setShowGroqPrompt(false);
        // Set the sales answer as the response
        const salesResponse = {
          success: true,
          message: parsed.salesAnswer,
          source: "salesFAQ",
        };
        setAgenticResponse(salesResponse);
        // Speak the sales answer immediately
        if (speak && speechEnabled && parsed.salesAnswer) {
          speak(parsed.salesAnswer);
        }
        if (onParsed) onParsed(parsed); // Notify parent
        return;
      }

      // Check if this is a command - either explicitly marked or has an action (which indicates a command)
      // Use the isCommand variable we calculated above for consistency
      // Also double-check: if parsed has an action property, it's definitely a command
      const definitelyCommand =
        isCommand || (parsed && parsed.action && !parsed.isSalesQuery);

      if (definitelyCommand) {
        if (import.meta.env.DEV) {
          console.log("[AskJoule] Attempting to handle command:", parsed);
        }
        const handled = await handleCommand(parsed);
        if (import.meta.env.DEV) {
          console.log("[AskJoule] Command handled result:", handled);
        }
        if (handled) {
          // If handled locally, show the response and speak it
          // Check if we have a response to show (answer or error should be set by command handlers)
          const hasResponse = answer || error || agenticResponse;
          if (!hasResponse && import.meta.env.DEV) {
            console.warn(
              "[AskJoule] Command handled but no response set. Command:",
              parsed,
              "Answer:",
              answer,
              "Error:",
              error,
              "AgenticResponse:",
              agenticResponse
            );
          }
          setIsLoadingGroq(false);
          setLoadingMessage(""); // Clear loading
          setShowGroqPrompt(true); // Show response area for command confirmations
          if (onParsed) onParsed(parsed); // Notify parent
          return;
        } else if (import.meta.env.DEV) {
          console.warn(
            "[AskJoule] Command not handled. Parsed:",
            parsed,
            "Action:",
            parsed?.action
          );
        }
        // Command was parsed but not handled - this shouldn't happen for valid commands
        // Commands are handled by the parser, not the LLM
        const errorMsg = `Command not recognized. Please check the command syntax or try a different command.`;
        setError(errorMsg);
        setOutputStatus("error");
        setIsLoadingGroq(false);
        setLoadingMessage("");
        setShowGroqPrompt(true); // Show error message
        if (speak && speechEnabled) {
          speak("Command not recognized. Please try a different command.");
        }
        return;
      }

      // If we get here, it's not a command - send to LLM
      if (import.meta.env.DEV) {
        console.log(
          "[AskJoule] Not a command, sending to LLM. Parsed:",
          parsed
        );
      }

      // 2. Check if local backend is enabled
      const useLocalBackend =
        typeof window !== "undefined" &&
        localStorage.getItem("useLocalBackend") === "true";
      const localBackendUrl =
        (typeof window !== "undefined" &&
          localStorage.getItem("localBackendUrl")) ||
        (typeof window !== "undefined" &&
          localStorage.getItem("jouleBridgeUrl")) ||
        "http://localhost:8080";

      if (useLocalBackend) {
        // Use local backend (Raspberry Pi)
        console.log("[AskJoule] Using local backend:", localBackendUrl);

        try {
          const response = await fetch(`${localBackendUrl}/api/ask-joule`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: input,
              context: {
                userSettings,
                userLocation,
              },
            }),
          });

          if (!response.ok) {
            throw new Error(
              `Local backend error: ${response.status} ${response.statusText}`
            );
          }

          const data = await response.json();

          if (data.success && data.message) {
            setAgenticResponse({
              success: true,
              message: data.message,
              source: "local-ollama",
            });
          } else {
            setError(data.message || "Local AI request failed");
            setOutputStatus("error");
            setAgenticResponse({
              success: false,
              error: true,
              message: data.message || "Local AI request failed",
            });
          }

          setIsLoadingGroq(false);
          setLoadingMessage("");
          setShowGroqPrompt(true);

          // Speak the response
          if (speak && speechEnabled && data.message) {
            speak(data.message);
          }

          return;
        } catch (error) {
          console.error("[AskJoule] Local backend error:", error);
          console.error("[AskJoule] Attempted URL:", `${localBackendUrl}/api/ask-joule`);
          console.error("[AskJoule] Error details:", {
            message: error.message,
            name: error.name,
            stack: error.stack
          });
          const errorMsg = `Local backend unavailable: ${error.message}. Falling back to Groq.`;
          setError(errorMsg);
          setOutputStatus("error");
          setIsLoadingGroq(false);
          setShowGroqPrompt(true);

          // Fall through to Groq as fallback
        }
      }

      // 3. Try to answer simple questions without API key using available data
      const lowerInput = input.toLowerCase();
      let fallbackAnswer = null;

      // Check for common question patterns and provide basic answers
      if (
        lowerInput.includes("strips") ||
        lowerInput.includes("strip") ||
        lowerInput.includes("auxiliary") ||
        lowerInput.includes("aux heat")
      ) {
        // Questions about auxiliary/strip heat
        const winterTemp =
          userSettings?.winterThermostat || userSettings?.indoorTemp || 70;
        const nighttimeTemp =
          userSettings?.nighttimeTemp || userSettings?.winterThermostat || 70;
        const outdoorTemp = userLocation
          ? (() => {
              // Try to get current outdoor temp from forecast or use a default
              try {
                const forecast = JSON.parse(
                  localStorage.getItem("lastForecast") || "{}"
                );
                if (forecast.currentTemp) return forecast.currentTemp;
              } catch {}
              return null;
            })()
          : null;

        if (
          lowerInput.includes("why") ||
          lowerInput.includes("when") ||
          lowerInput.includes("last night")
        ) {
          fallbackAnswer =
            `Auxiliary heat (strips) typically runs when:\n\n` +
            `• The outdoor temperature is very cold (usually below your heat pump's balance point, around 20-30°F)\n` +
            `• Your heat pump can't keep up with the heating demand\n` +
            `• You have a large temperature setback at night (your nighttime temp is ${nighttimeTemp}°F vs daytime ${winterTemp}°F)\n\n` +
            `To reduce strip usage, try:\n` +
            `• Reducing nighttime setbacks (smaller difference between day and night temps)\n` +
            `• Setting your nighttime temp closer to your daytime temp\n` +
            `• Checking your heat pump's balance point in Settings\n\n` +
            `💡 For more detailed analysis, add a Groq API key in Settings to get AI-powered answers.`;
        } else {
          fallbackAnswer =
            `Auxiliary heat (electric resistance strips) provides backup heating when your heat pump can't keep up. ` +
            `It typically activates when outdoor temps drop below your system's balance point (usually 20-30°F) or during large temperature recoveries.`;
        }
      } else if (
        lowerInput.includes("bill") ||
        lowerInput.includes("cost") ||
        lowerInput.includes("save money") ||
        lowerInput.includes("lower")
      ) {
        // Questions about bills and savings
        const winterTemp = userSettings?.winterThermostat || 70;
        const nighttimeTemp = userSettings?.nighttimeTemp || winterTemp;
        const tempDiff = Math.abs(winterTemp - nighttimeTemp);

        fallbackAnswer =
          `To lower your heating bill:\n\n` +
          `• Reduce temperature setbacks: Your current settings show ${winterTemp}°F day / ${nighttimeTemp}°F night (${tempDiff}°F difference). ` +
          `Smaller setbacks (1-2°F) use less energy than large ones.\n` +
          `• Avoid large nighttime setbacks with heat pumps - they can trigger expensive auxiliary heat in the morning\n` +
          `• Set your nighttime temp closer to your daytime temp (try ${
            winterTemp - 1
          }°F instead of ${nighttimeTemp}°F)\n` +
          `• Check your insulation and air sealing - better insulation = lower bills\n\n` +
          `💡 Use the Forecast page to see how different schedules affect your weekly costs.`;
      } else if (
        lowerInput.includes("nighttime") ||
        lowerInput.includes("night temp") ||
        lowerInput.includes("set my night")
      ) {
        // Questions about nighttime temperature
        const winterTemp = userSettings?.winterThermostat || 70;
        const currentNighttime = userSettings?.nighttimeTemp || winterTemp;
        const recommended = Math.max(winterTemp - 2, 66);

        fallbackAnswer =
          `Recommended nighttime temperature: ${recommended}°F\n\n` +
          `Your current nighttime setting: ${currentNighttime}°F\n\n` +
          `💡 Tips:\n` +
          `• For heat pumps, keep setbacks small (1-2°F) to avoid triggering auxiliary heat\n` +
          `• ${recommended}°F is a good balance between comfort and savings\n` +
          `• Larger setbacks (3+°F) can cause your system to use expensive strip heat in the morning\n\n` +
          `You can adjust this in Settings under Thermostat Behavior.`;
      }

      // If we have a fallback answer, use it
      if (fallbackAnswer) {
        setAgenticResponse({
          success: true,
          message: fallbackAnswer,
          source: "fallback",
        });
        setIsLoadingGroq(false);
        setLoadingMessage("");
        setShowGroqPrompt(true);
        setOutputStatus("success");
        // Speak the answer
        if (speak && speechEnabled) {
          speak(fallbackAnswer.replace(/\n/g, ". ").replace(/💡/g, "Tip:"));
        }
        return;
      }

      // 4. Fallback to Groq Agent (automatic - no prompt needed)
      // Check prop first, then localStorage, then env variable
      const groqApiKey =
        groqKeyProp ||
        (typeof window !== "undefined"
          ? localStorage.getItem("groqApiKey")
          : null) ||
        import.meta.env.VITE_GROQ_API_KEY;

      if (!groqApiKey || !groqApiKey.trim()) {
        const errorMsg =
          "API key not configured. Please add your Groq API key in Settings, or enable local backend.\n\n" +
          "💡 I can answer simple questions about your system without an API key. Try asking about:\n" +
          "• Why your strips ran\n" +
          "• How to lower your bill\n" +
          "• What to set your nighttime temp to";
        setError(errorMsg);
        setOutputStatus("error");
        setLoadingMessage("");
        setIsLoadingGroq(false);
        setShowGroqPrompt(true);
        // Speak the error message
        if (speak && speechEnabled) {
          speak(
            "API key not configured. Please add your Groq API key in Settings, or enable local backend."
          );
        }
        return;
      }

      // Automatically call Groq Agent - no prompt needed
      // Continue with the existing Groq Agent call below

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
        historyForAgent,
        {
          systemPromptOverride: salesMode ? MARKETING_SITE_SYSTEM_PROMPT : null,
        }
      );

      console.log("[AskJoule] Got response:", response);

      // Handle response
      if (response) {
        if (response.error) {
          console.log("[AskJoule] Response has error:", response.message);
          const errorMessage = response.message || "AI request failed";
          // Store the full error object to check for needsApiKey
          if (response.needsApiKey) {
            const apiKeyErrorMsg =
              "API key not configured. Please add your Groq API key in Settings.";
            setError(apiKeyErrorMsg);
            setOutputStatus("error");
            setShowGroqPrompt(true);
            // Speak the error message
            if (speak && speechEnabled) {
              speak(apiKeyErrorMsg);
            }
          } else {
            setError(errorMessage);
            setOutputStatus("error");
            setShowGroqPrompt(true);
            // Also set agenticResponse so the error message can be spoken
            setAgenticResponse({
              success: false,
              error: true,
              message: errorMessage,
            });
            // Speak the error message
            if (speak && speechEnabled) {
              speak(errorMessage);
            }
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
          const errorMsg = "Received an unexpected response format";
          setError(errorMsg);
          setOutputStatus("error");
          setShowGroqPrompt(true);
          // Speak the error message
          if (speak && speechEnabled) {
            speak(errorMsg);
          }
        }
        setIsLoadingGroq(false);
        setLoadingMessage("");
        setShowGroqPrompt(true);
      } else {
        console.log("[AskJoule] No response received");
        const errorMsg = "No response from AI assistant";
        setError(errorMsg);
        setOutputStatus("error");
        setIsLoadingGroq(false);
        setLoadingMessage("");
        setShowGroqPrompt(true);
        // Speak the error message
        if (speak && speechEnabled) {
          speak(errorMsg);
        }
      }
    } catch (err) {
      console.error("AskJoule error:", err);
      const errorMsg =
        err.message || "An error occurred while processing your request";
      setError(errorMsg);
      setOutputStatus("error");
      setIsLoadingGroq(false);
      setLoadingMessage("");
      setShowGroqPrompt(true);
      // Speak the error message
      if (speak && speechEnabled) {
        speak(errorMsg);
      }
    } finally {
      setIsLoadingGroq(false);
      setLoadingMessage(""); // Always clear loading message
    }
  };

  // Update handleSubmit ref so it's accessible in onFinal callback
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  // Listen for external requests to submit a question (e.g., from SystemHealthAlerts)
  useEffect(() => {
    const handleAskJouleQuestion = (event) => {
      const question = event.detail?.question || event.detail?.text;
      if (question && typeof question === "string") {
        if (import.meta.env.DEV) {
          console.log(
            "[AskJoule] Received external question request:",
            question
          );
        }
        // Set the value and submit
        setValue(question);
        // Focus the input
        if (inputRef.current) {
          inputRef.current.focus();
        }
        // Submit after a brief delay to ensure state is updated
        setTimeout(() => {
          handleSubmit(null, question);
        }, 100);
      }
    };

    // Handle custom event to set question value (for suggested questions)
    const handleSetQuestion = (event) => {
      const question = event.detail?.question || event.detail;
      if (question && typeof question === "string") {
        setValue(question);
        inputRef.current?.focus();
        // Optionally auto-submit if requested
        if (event.detail?.autoSubmit) {
          setTimeout(() => {
            handleSubmit(null, question);
          }, 100);
        }
      }
    };

    window.addEventListener("askJouleSubmitQuestion", handleAskJouleQuestion);
    window.addEventListener("askJouleSetQuestion", handleSetQuestion);
    return () => {
      window.removeEventListener(
        "askJouleSubmitQuestion",
        handleAskJouleQuestion
      );
      window.removeEventListener("askJouleSetQuestion", handleSetQuestion);
    };
  }, [handleSubmit, setValue, inputRef]); // setValue is stable, handleSubmit changes

  // Speak the agentic response when it arrives (including error messages)
  useEffect(() => {
    if (agenticResponse?.message && speak) {
      // Skip TTS for command responses - they're already spoken in setOutput callback
      // Commands are identified by source: "command" or source: "funResponse"
      if (
        agenticResponse.source === "command" ||
        agenticResponse.source === "funResponse"
      ) {
        return; // Already spoken in setOutput callback, don't speak again
      }

      // Speak both success and error messages
      // Use speakText if provided, otherwise use message
      const responseText = agenticResponse.speakText || agenticResponse.message;
      if (responseText && responseText.trim()) {
        // Prevent concurrent processing
        if (isProcessingResponseRef.current) {
          return; // Already processing a response
        }

        // Prevent processing the same response multiple times (infinite loop prevention)
        const responseId = agenticResponse.message; // Use just the message as ID

        // If this is a NEW response (different from last), reset the manual stop flag
        // This allows new responses to speak even if user stopped the previous one
        const isNewResponse = lastProcessedResponseRef.current !== responseId;
        if (isNewResponse) {
          speechManuallyStoppedRef.current = false; // Reset for new response - allow it to speak
        }

        if (!isNewResponse) {
          return; // Already processed this exact response
        }

        // Mark as processing
        isProcessingResponseRef.current = true;
        lastProcessedResponseRef.current = responseId;

        // Auto-enable speaker if user is using voice input (microphone is active)
        // Only do this once per session to prevent loops
        if (
          isListening &&
          !speechEnabled &&
          toggleSpeech &&
          !speakerAutoEnabledRef.current
        ) {
          speakerAutoEnabledRef.current = true; // Mark that we've auto-enabled
          toggleSpeech(); // Enable the speaker button

          // Wait for state to settle before speaking (longer delay to prevent rapid toggling)
          setTimeout(() => {
            isProcessingResponseRef.current = false; // Clear processing flag
            // Double-check conditions before speaking
            if (
              !speechManuallyStoppedRef.current &&
              responseText &&
              responseText.trim()
            ) {
              speak(responseText);
            }
          }, 800); // Increased delay to allow state to settle
          return; // Exit early to prevent double-speaking
        }

        // Check if speech is enabled, or if we should enable it for voice responses
        // IMPORTANT: Always speak if speechEnabled is true (speaker button is on),
        // regardless of microphone state. This allows typed questions to be spoken.
        const shouldSpeak = speechEnabled || isListening; // Speak if enabled OR if user is using voice input
        if (shouldSpeak) {
          // Longer delay to ensure UI has updated and state has settled
          setTimeout(() => {
            isProcessingResponseRef.current = false; // Clear processing flag
            // Only respect speechManuallyStoppedRef if microphone was active when stopped
            // If user has speaker button on but mic off, always speak (they want audio output)
            // speechManuallyStoppedRef is reset for new responses above, so this should work
            if (
              !speechManuallyStoppedRef.current &&
              responseText &&
              responseText.trim()
            ) {
              speak(responseText);
            }
          }, 800); // Increased from 500ms to 800ms for stability
        } else {
          isProcessingResponseRef.current = false; // Clear flag if not speaking
        }
      }
    }
  }, [agenticResponse, speak, speechEnabled, isListening]); // Removed toggleSpeech from deps - it's stable

  // Speak error messages when they're set directly (not through setOutput callback)
  // This ensures ALL error messages are spoken, not just those going through setOutput
  useEffect(() => {
    if (error && error.trim() && speak && outputStatus) {
      // Only speak if speech is enabled or user is using voice input
      const shouldSpeak = speechEnabled || isListening;
      if (shouldSpeak && !isProcessingResponseRef.current) {
        // Format message for TTS: remove markdown, emojis, and format units
        let ttsMessage = error
          .replace(/^✓\s*/, "") // Remove checkmark
          .replace(/\*\*/g, ", ") // Replace double asterisks (bold) with comma pause
          .replace(/\*/g, ", ") // Replace single asterisk with comma pause (short silence)
          .replace(/~/g, "about ") // Replace tilde with "about"
          .replace(/→/g, " to ") // Replace right arrow with "to"
          // Handle dollar amounts with time periods FIRST (before general "/" replacement)
          // Convert "$X/month" to "X dollars per month"
          .replace(
            /\$(\d+(?:,\d{3})*(?:\.\d+)?)\s*\/\s*(month|year|day|week|hr|hour)/gi,
            (match, amount, period) => {
              const num = parseFloat(amount.replace(/,/g, ""));
              const periodText =
                period === "month"
                  ? "per month"
                  : period === "year"
                  ? "per year"
                  : period === "day"
                  ? "per day"
                  : period === "week"
                  ? "per week"
                  : period === "hr" || period === "hour"
                  ? "per hour"
                  : `per ${period}`;
              return `${num} dollars ${periodText}`;
            }
          )
          // Handle "on/off" before general "/" replacement
          .replace(/\bon\s*\/\s*off\b/gi, "on off") // Pronounce "on/off" as "on off" (not "on slash off")
          // Handle BTU/hr before general "/" replacement
          .replace(/\bBTU\s*\/\s*hr\b/gi, "B T U per hour")
          .replace(/(\d+)\s*BTU\s*\/\s*hr\b/gi, "$1 B T U per hour")
          .replace(/\//g, " ") // Replace forward slash with space
          .replace(/\becobee\b/gi, "eco bee") // Pronounce as "eco-bee" (like ecosystem)
          // Handle dollar amounts without time periods - convert "$X" to "X dollars"
          .replace(/\$(\d+(?:,\d{3})*(?:\.\d+)?)/g, (match, amount) => {
            const num = parseFloat(amount.replace(/,/g, ""));
            return `${num} dollars`;
          })
          // Handle square footage - use singular "square foot" for 1, plural "square feet" for others
          .replace(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*sq\s*ft\b/gi, (match, num) => {
            const n = parseFloat(num.replace(/,/g, ""));
            const unit = n === 1 ? "square foot" : "square feet";
            return `${num} ${unit}`;
          })
          .replace(/\bsq\s*ft\b/gi, "square feet") // Handle "sq ft" without numbers
          .replace(/\bhrs\b/gi, "hours")
          .replace(/\bmin\b/gi, "minutes")
          .replace(/\bsec\b/gi, "seconds")
          .replace(/\bBTU\b/g, "B T U")
          // Note: BTU/hr already handled above before general "/" replacement
          .replace(/\bHSPF\b/g, "H S P F")
          .replace(/\bSEER\b/g, "S E E R")
          .replace(/\bCOP\b/g, "C O P")
          .replace(/\bHVAC\b/g, "H V A C")
          .replace(/\bAC\b/g, "A C")
          .replace(/\bROI\b/g, "return on investment") // Pronounce ROI as "return on investment"
          .replace(
            /💰|🔍|📊|⚡|🌡️|💡|📈|💵|😴|⚠️|🔥|⏰|🎯|🔄|📅|⚖️|🧪|📍|❄️|⬆️|⬇️|➕|➖|😌|▶️|⏸️/g,
            ""
          ) // Remove emojis
          // Handle numbers with degrees - use singular "degree" for 1, plural for others
          .replace(/(\d+(?:\.\d+)?)°F/gi, (match, num) => {
            const n = parseFloat(num);
            const degree = n === 1 ? "degree" : "degrees";
            return `${num} ${degree} Fahrenheit`;
          })
          .replace(/(\d+(?:\.\d+)?)°C/gi, (match, num) => {
            const n = parseFloat(num);
            const degree = n === 1 ? "degree" : "degrees";
            return `${num} ${degree} Celsius`;
          })
          // Handle remaining degree symbols without numbers
          .replace(/°F/g, " degrees Fahrenheit")
          .replace(/°C/g, " degrees Celsius")
          .replace(/\n\n/g, ". ") // Replace double newlines with period
          .replace(/\n/g, " ") // Replace single newlines with space
          .replace(/\s+/g, " ") // Collapse multiple spaces
          .trim();

        if (ttsMessage) {
          // Prevent duplicate speaking by checking if we just processed this
          const errorId = error;
          if (lastProcessedResponseRef.current !== errorId) {
            lastProcessedResponseRef.current = errorId;
            isProcessingResponseRef.current = true;

            setTimeout(() => {
              if (!speechManuallyStoppedRef.current && ttsMessage.trim()) {
                speak(ttsMessage);
              }
              isProcessingResponseRef.current = false;
            }, 300); // Small delay to prevent rapid-fire speaking
          }
        }
      }
    }
  }, [error, outputStatus, speak, speechEnabled, isListening]);

  const toggleListening = () => {
    if (isListening) {
      shouldBeListeningRef.current = false; // User manually stopped
      stopListening();
      speakerAutoEnabledRef.current = false; // Reset auto-enable flag when user stops listening
    } else {
      shouldBeListeningRef.current = true; // User wants to listen
      speakerAutoEnabledRef.current = false; // Reset auto-enable flag for new session
      // Start listening immediately - the pause/resume logic will handle pausing if speaking
      startListening();
    }
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
    showQuestionHelp,
    setShowQuestionHelp,
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
    stopSpeaking: () => {
      speechManuallyStoppedRef.current = true; // Mark that user manually stopped
      stopSpeaking();

      // Resume microphone if it was active before speech started
      if (
        shouldBeListeningRef.current &&
        !isListening &&
        recognitionSupported
      ) {
        // Small delay to ensure speech has fully stopped
        setTimeout(() => {
          if (shouldBeListeningRef.current && !isListening) {
            startListening();
          }
        }, 300);
      }
    },
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
