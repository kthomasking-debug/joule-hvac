import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import ThermostatScheduleCard from "../components/ThermostatScheduleCard";
import {
  loadThermostatSettings,
  saveThermostatSettings,
} from "../lib/thermostatSettings";
import { useEcobee } from "../hooks/useEcobee";
import { getEcobeeCredentials } from "../lib/ecobeeApi";
import { useProstatBridge } from "../hooks/useProstatBridge";
import { checkBridgeHealth } from "../lib/prostatBridgeApi";
import { useProstatRelay } from "../hooks/useProstatRelay";
import { useBlueair } from "../hooks/useBlueair";
import {
  Zap,
  Home,
  BarChart3,
  Calendar,
  DollarSign,
  Bot,
  Droplets,
  Thermometer,
  Wind,
  CheckCircle2,
  Clock,
  Settings,
  Mic,
  MicOff,
  Search,
  RotateCcw,
  MessageSquare,
} from "lucide-react";
import AskJoule from "../components/AskJoule";

const SmartThermostatDemo = () => {
  const navigate = useNavigate();
  const outlet = useOutletContext() || {};
  const userSettings = outlet.userSettings || {};
  const setUserSetting = outlet.setUserSetting;
  
  // Route guard: Redirect to onboarding if not completed
  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem("hasCompletedOnboarding");
    if (!hasCompletedOnboarding) {
      navigate("/onboarding");
    }
  }, [navigate]);
  
  // Load userLocation from localStorage
  const userLocation = useMemo(() => {
    try {
      const raw = localStorage.getItem("userLocation");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);
  
  // Initialize targetTemp from userSettings, fallback to 70
  const [targetTemp, setTargetTemp] = useState(() => {
    return userSettings.winterThermostat || 70;
  });

  // State for dual-period thermostat schedule
  // daytimeTime = when daytime period BEGINS (e.g., 6:00 AM)
  // nighttimeTime = when nighttime period BEGINS (e.g., 10:00 PM)
  const [daytimeTime, setDaytimeTime] = useState(() => {
    try {
      const thermostatSettings = loadThermostatSettings();
      const homeEntry = thermostatSettings?.schedule?.weekly?.[0]?.find(
        (e) => e.comfortSetting === "home"
      );
      return homeEntry?.time || "06:00";
    } catch {
      return "06:00";
    }
  });

  const [nighttimeTime, setNighttimeTime] = useState(() => {
    try {
      const thermostatSettings = loadThermostatSettings();
      const sleepEntry = thermostatSettings?.schedule?.weekly?.[0]?.find(
        (e) => e.comfortSetting === "sleep"
      );
      return sleepEntry?.time || "22:00";
    } catch {
      return "22:00";
    }
  });

  // State for nighttime temperature
  const [nighttimeTemp, setNighttimeTemp] = useState(() => {
    try {
      const thermostatSettings = loadThermostatSettings();
      return thermostatSettings?.comfortSettings?.sleep?.heatSetPoint || 65;
    } catch {
      return 65;
    }
  });

  // Sync times and temperatures from localStorage when component mounts or settings change
  useEffect(() => {
    try {
      const thermostatSettings = loadThermostatSettings();
      const homeEntry = thermostatSettings?.schedule?.weekly?.[0]?.find(
        (e) => e.comfortSetting === "home"
      );
      const sleepEntry = thermostatSettings?.schedule?.weekly?.[0]?.find(
        (e) => e.comfortSetting === "sleep"
      );
      if (homeEntry?.time) setDaytimeTime(homeEntry.time);
      if (sleepEntry?.time) setNighttimeTime(sleepEntry.time);
      const sleepTemp = thermostatSettings?.comfortSettings?.sleep?.heatSetPoint;
      if (sleepTemp !== undefined) setNighttimeTemp(sleepTemp);
    } catch {
      // ignore
    }
  }, []);

  // Track settings version to force dehumidifier settings to update
  const [settingsVersion, setSettingsVersion] = useState(0);

  // Listen for thermostat settings updates
  useEffect(() => {
    const handleSettingsUpdate = (e) => {
      try {
        const thermostatSettings = loadThermostatSettings();
        if (e.detail?.comfortSettings?.sleep?.heatSetPoint !== undefined) {
          setNighttimeTemp(thermostatSettings?.comfortSettings?.sleep?.heatSetPoint || 65);
        }
        // Force dehumidifier settings to recompute when any settings change
        setSettingsVersion(prev => prev + 1);
      } catch {
        // ignore
      }
    };
    window.addEventListener("thermostatSettingsUpdated", handleSettingsUpdate);
    return () => {
      window.removeEventListener("thermostatSettingsUpdated", handleSettingsUpdate);
    };
  }, []);

  
  // Sync targetTemp when userSettings.winterThermostat changes (e.g., from AI update)
  useEffect(() => {
    if (userSettings.winterThermostat && userSettings.winterThermostat !== targetTemp) {
      setTargetTemp(userSettings.winterThermostat);
    }
  }, [userSettings.winterThermostat]);
  
  // ProStat Bridge (HomeKit HAP) - Preferred method
  const [bridgeAvailable, setBridgeAvailable] = useState(false);
  const prostatBridge = useProstatBridge(null, 5000); // Poll every 5 seconds (faster than cloud)
  
  // ProStat Bridge Relay Control (Dehumidifier)
  const prostatRelay = useProstatRelay(2, 5000); // Channel 2 (Y2 terminal), poll every 5 seconds
  
  // ProStat Bridge Blueair Control (Air Purifier)
  const _blueair = useBlueair(0, 10000); // Device 0, poll every 10 seconds
  
  // Ecobee Cloud API (fallback)
  const ecobeeCredentials = getEcobeeCredentials();
  const useEcobeeIntegration = !!(ecobeeCredentials.apiKey && ecobeeCredentials.accessToken) && !bridgeAvailable;
  const ecobee = useEcobee(null, 30000); // Poll every 30 seconds
  
  // State for simulated mode (when Ecobee not connected)
  const [simulatedCurrentTemp, _setSimulatedCurrentTemp] = useState(72);
  const [simulatedCurrentHumidity, _setSimulatedCurrentHumidity] = useState(50);
  const [simulatedMode, setSimulatedMode] = useState("heat");
  const [simulatedIsAway, setSimulatedIsAway] = useState(false);
  
  // Determine which integration to use (ProStat Bridge preferred)
  const useProstatIntegration = bridgeAvailable && prostatBridge.connected;
  const activeIntegration = useProstatIntegration ? prostatBridge : (useEcobeeIntegration ? ecobee : null);
  
  // Use ProStat Bridge or Ecobee data if available, otherwise use simulated
  const currentTemp = activeIntegration && activeIntegration.temperature !== null 
    ? activeIntegration.temperature 
    : simulatedCurrentTemp;
  const currentHumidity = activeIntegration && activeIntegration.humidity !== null 
    ? activeIntegration.humidity 
    : simulatedCurrentHumidity;
  const mode = activeIntegration && activeIntegration.mode 
    ? activeIntegration.mode 
    : simulatedMode;
  
  // Check bridge availability on mount
  useEffect(() => {
    checkBridgeHealth().then(setBridgeAvailable);
  }, []);
  const isAway = activeIntegration 
    ? (activeIntegration.isAway || false) 
    : simulatedIsAway;
  
  // Wrapper functions that use active integration if connected, otherwise update local state
  const handleSetMode = useCallback(async (newMode) => {
    if (activeIntegration) {
      try {
        await activeIntegration.setMode(newMode);
      } catch (error) {
        console.error('Failed to set thermostat mode:', error);
      }
    } else {
      setSimulatedMode(newMode);
    }
  }, [activeIntegration]);
  
  const handleSetAway = useCallback(async (away) => {
    if (activeIntegration) {
      try {
        // Get away mode temps from comfort settings
        const thermostatSettings = loadThermostatSettings();
        const awaySettings = thermostatSettings?.comfortSettings?.away;
        const heatTemp = awaySettings?.heatSetPoint || 62;
        const coolTemp = awaySettings?.coolSetPoint || 85;
        await activeIntegration.setAway(away, heatTemp, coolTemp);
      } catch (error) {
        console.error('Failed to set away mode:', error);
      }
    } else {
      setSimulatedIsAway(away);
    }
  }, [activeIntegration]);
  
  // Update local state when integration data changes
  useEffect(() => {
    if (activeIntegration && activeIntegration.thermostatData) {
      // Sync target temp from thermostat
      if (activeIntegration.targetHeatTemp !== null && mode === 'heat') {
        setTargetTemp(activeIntegration.targetHeatTemp);
      } else if (activeIntegration.targetCoolTemp !== null && mode === 'cool') {
        setTargetTemp(activeIntegration.targetCoolTemp);
      }
    }
  }, [activeIntegration, mode]);
  
  // Dehumidifier state tracking for minOnTime/minOffTime enforcement
  const [dehumidifierState, setDehumidifierState] = useState({
    isOn: false,
    lastTurnedOn: null, // timestamp when turned on
    lastTurnedOff: null, // timestamp when turned off
  });
  const [aiInput, setAiInput] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [_isSpeaking, setIsSpeaking] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Persist speech enabled state to localStorage
  const [speechEnabled, setSpeechEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem("thermostatSpeechEnabled");
      return saved !== null ? JSON.parse(saved) : true; // Default to true (voice on)
    } catch {
      return true;
    }
  });

  const [autoSubmitCountdown, setAutoSubmitCountdown] = useState(null);
  const [shouldAutoSubmit, setShouldAutoSubmit] = useState(false);

  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const autoSubmitTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  // Clear auto-submit timers
  const clearAutoSubmitTimers = useCallback(() => {
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setShouldAutoSubmit(false);
  }, []);

  // Start auto-submit countdown
  const startAutoSubmit = useCallback(() => {
    clearAutoSubmitTimers();

    let countdown = 5;
    setAutoSubmitCountdown(countdown);

    // Update countdown every second
    countdownIntervalRef.current = setInterval(() => {
      countdown -= 1;
      setAutoSubmitCountdown(countdown);
      if (countdown <= 0) {
        clearInterval(countdownIntervalRef.current);
      }
    }, 1000);

    // Trigger auto-submit after 5 seconds
    autoSubmitTimerRef.current = setTimeout(() => {
      setShouldAutoSubmit(true);
    }, 5000);
  }, [clearAutoSubmitTimers]);

  // Initialize speech recognition
  useEffect(() => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setAiInput(transcript);
        setIsListening(false);
        // Start auto-submit countdown
        startAutoSubmit();
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
        clearAutoSubmitTimers();
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    // Cleanup on unmount
    return () => {
      clearAutoSubmitTimers();
    };
  }, [startAutoSubmit, clearAutoSubmitTimers]);

  // Toggle microphone
  const toggleMic = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Toggle speech and persist to localStorage
  const toggleSpeech = () => {
    const newValue = !speechEnabled;
    setSpeechEnabled(newValue);
    try {
      localStorage.setItem("thermostatSpeechEnabled", JSON.stringify(newValue));
    } catch {
      // Ignore storage errors
    }
  };

  // Check if globally muted (from App.jsx mute button)
  const isGloballyMuted = () => {
    try {
      const globalMuted = localStorage.getItem("globalMuted");
      const askJouleMuted = localStorage.getItem("askJouleMuted");
      return globalMuted === "true" || askJouleMuted === "true";
    } catch {
      return false;
    }
  };

  // Cancel speech if globally muted (reacts to mute button in header)
  useEffect(() => {
    const checkMute = () => {
      if (isGloballyMuted() && synthRef.current) {
        synthRef.current.cancel();
        setIsSpeaking(false);
      }
    };

    // Check immediately
    checkMute();

    // Listen for storage changes (when mute button is clicked)
    const handleStorageChange = (e) => {
      if (e.key === "globalMuted" || e.key === "askJouleMuted") {
        checkMute();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // Also poll for changes (since same-origin storage events don't fire)
    const interval = setInterval(checkMute, 500);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Speak text
  const _speak = (text) => {
    // Check both local speechEnabled AND global mute state
    if (!speechEnabled || isGloballyMuted() || !synthRef.current) return;

    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    synthRef.current.speak(utterance);
  };

  // Load thermostat settings for away mode calculation
  const [thermostatSettings, setThermostatSettings] = useState(() => {
    try {
      return loadThermostatSettings();
    } catch {
      return null;
    }
  });

  // Listen for thermostat settings updates
  useEffect(() => {
    const handleSettingsUpdate = () => {
      try {
        setThermostatSettings(loadThermostatSettings());
      } catch {
        // Ignore errors
      }
    };
    window.addEventListener("thermostatSettingsChanged", handleSettingsUpdate);
    window.addEventListener("thermostatSettingsUpdated", handleSettingsUpdate);
    return () => {
      window.removeEventListener("thermostatSettingsChanged", handleSettingsUpdate);
      window.removeEventListener("thermostatSettingsUpdated", handleSettingsUpdate);
    };
  }, []);

  // Calculate effective target with away mode adjustment
  const effectiveTarget = useMemo(() => {
    if (!isAway) return targetTemp;

    // Away mode uses temperatures from comfort settings
    try {
      const settings = thermostatSettings || loadThermostatSettings();
      const awaySettings = settings?.comfortSettings?.away;
      
      if (awaySettings) {
        // Use the appropriate setpoint based on current mode
        if (mode === "heat") {
          return awaySettings.heatSetPoint || targetTemp;
        } else if (mode === "cool") {
          return awaySettings.coolSetPoint || targetTemp;
        }
      }
    } catch (e) {
      console.warn("Failed to load away mode settings:", e);
    }

    // Fallback to old behavior if settings not available
    const awayOffset = 6;
    if (mode === "heat") {
      return Math.max(60, targetTemp - awayOffset);
    } else if (mode === "cool") {
      return Math.min(80, targetTemp + awayOffset);
    }
    return targetTemp;
  }, [isAway, targetTemp, mode, currentTemp, thermostatSettings]);

  // Handle AI submission
  const handleAiSubmit = useCallback(
    async (e) => {
      e?.preventDefault();
      clearAutoSubmitTimers();

      if (!aiInput.trim()) return;

      const input = aiInput.toLowerCase().trim();
      let response = "";

      // Parse commands
      if (input.includes("set") && input.includes("to")) {
        const tempMatch = input.match(/(\d+)/);
        if (tempMatch) {
          const temp = parseInt(tempMatch[1]);
          if (temp >= 60 && temp <= 80) {
            setTargetTemp(temp);
            // Update thermostat if connected
            if (activeIntegration && activeIntegration.setTemperature) {
              const heatTemp = mode === 'heat' || mode === 'auto' ? temp : (activeIntegration.targetHeatTemp || temp);
              const coolTemp = mode === 'cool' || mode === 'auto' ? temp : (activeIntegration.targetCoolTemp || temp);
              await activeIntegration.setTemperature(heatTemp, coolTemp);
            }
            // Also update userSettings if setUserSetting is available
            if (setUserSetting) {
              setUserSetting("winterThermostat", temp, {
                source: "SmartThermostatDemo",
                comment: "Set target temperature via voice command",
              });
            }
            response = `Target temperature set to ${temp} degrees Fahrenheit`;
          } else {
            response = `Temperature must be between 60 and 80 degrees`;
          }
        }
      } else if (input.includes("away")) {
        if (
          input.includes("on") ||
          input.includes("enable") ||
          input.includes("activate")
        ) {
          await handleSetAway(true);
          response =
            "Away mode activated. Adjusting temperature for energy savings.";
        } else if (
          input.includes("off") ||
          input.includes("disable") ||
          input.includes("home") ||
          input.includes("back")
        ) {
          await handleSetAway(false);
          response = "Away mode deactivated. Welcome home!";
        } else {
          const newAway = !isAway;
          await handleSetAway(newAway);
          response = newAway
            ? "Away mode activated. Adjusting temperature for energy savings."
            : "Away mode deactivated. Welcome home!";
        }
      } else if (input.includes("heat")) {
        await handleSetMode("heat");
        response = "Heat mode activated";
      } else if (input.includes("cool")) {
        await handleSetMode("cool");
        response = "Cool mode activated";
      } else if (input.includes("off")) {
        await handleSetMode("off");
        response = "System turned off";
      } else if (input.includes("status") || input.includes("what")) {
        // Calculate status inline
        const deadband = 1;
        const effectiveTargetForStatus = isAway ? effectiveTarget : targetTemp;
        const tempDiff = currentTemp - effectiveTargetForStatus;
        let status = "satisfied";

        if (mode === "off") {
          status = "off";
        } else if (tempDiff > deadband && mode === "cool") {
          status = "cooling";
        } else if (tempDiff < -deadband && mode === "heat") {
          status = "heating";
        }

        const awayStatus = isAway
          ? ` Away mode is active, effective target is ${effectiveTargetForStatus} degrees.`
          : "";
        response = `Current temperature is ${currentTemp} degrees. Target is ${targetTemp} degrees.${awayStatus} System is in ${mode} mode and currently ${status}.`;
      } else {
        response = `I heard: "${aiInput}". Try commands like "set to 72", "heat mode", or "what's the status?"`;
      }

      setAiResponse(response);
      setAiInput("");

      // Speak response (only if not globally muted)
      setTimeout(() => {
        // Check both local speechEnabled AND global mute state
        if (
          synthRef.current &&
          response &&
          speechEnabled &&
          !isGloballyMuted()
        ) {
          synthRef.current.cancel();
          const utterance = new SpeechSynthesisUtterance(response);
          utterance.onstart = () => setIsSpeaking(true);
          utterance.onend = () => setIsSpeaking(false);
          utterance.onerror = () => setIsSpeaking(false);
          synthRef.current.speak(utterance);
        }
      }, 100);
    },
    [
      aiInput,
      currentTemp,
      targetTemp,
      mode,
      isAway,
      effectiveTarget,
      clearAutoSubmitTimers,
      speechEnabled,
    ]
  );

  // Auto-submit when flag is set
  useEffect(() => {
    if (shouldAutoSubmit) {
      handleAiSubmit();
      setShouldAutoSubmit(false);
      clearAutoSubmitTimers();
    }
  }, [shouldAutoSubmit, handleAiSubmit, clearAutoSubmitTimers]);

  // Get current humidity setpoint from thermostat settings
  // Include settingsVersion in dependency array so it updates when humidity setpoint changes
  const humiditySetpoint = useMemo(() => {
    try {
      const thermostatSettings = loadThermostatSettings();
      const currentComfort = isAway ? "away" : "home";
      return thermostatSettings?.comfortSettings?.[currentComfort]?.humiditySetPoint || 50;
    } catch {
      return 50;
    }
  }, [isAway, settingsVersion]);

  // Get dehumidifier settings
  // Include settingsVersion in dependency array so it updates when settings change
  const dehumidifierSettings = useMemo(() => {
    try {
      const thermostatSettings = loadThermostatSettings();
      return thermostatSettings?.dehumidifier || {
        enabled: false,
        humidityDeadband: 5,
        minOnTime: 300,
        minOffTime: 300,
        relayTerminal: "Y2",
      };
    } catch {
      return {
        enabled: false,
        humidityDeadband: 5,
        minOnTime: 300,
        minOffTime: 300,
        relayTerminal: "Y2",
      };
    }
  }, [settingsVersion]);

  // Reset dehumidifier state when disabled
  useEffect(() => {
    if (!dehumidifierSettings.enabled && dehumidifierState.isOn) {
      setDehumidifierState({
        isOn: false,
        lastTurnedOn: null,
        lastTurnedOff: Date.now(),
      });
    }
  }, [dehumidifierSettings.enabled, dehumidifierState.isOn]);

  // Determine desired dehumidifier state based on humidity conditions
  const desiredDehumidifierState = useMemo(() => {
    if (!dehumidifierSettings.enabled) {
      return false;
    }

    const humidityDiff = currentHumidity - humiditySetpoint;
    const humidityDeadband = dehumidifierSettings.humidityDeadband || 5;
    
    // Desired state: on if humidity is above setpoint + deadband
    return humidityDiff > humidityDeadband;
  }, [currentHumidity, humiditySetpoint, dehumidifierSettings]);

  // Update dehumidifier state when desired state changes, respecting minOnTime/minOffTime
  useEffect(() => {
    if (!dehumidifierSettings.enabled) {
      return;
    }

    const now = Date.now();
    const minOnTimeMs = (dehumidifierSettings.minOnTime || 300) * 1000;
    const minOffTimeMs = (dehumidifierSettings.minOffTime || 300) * 1000;

    // If dehumidifier should be on
    if (desiredDehumidifierState) {
      // Check if we can turn it on (respecting minOffTime)
      if (!dehumidifierState.isOn) {
        if (!dehumidifierState.lastTurnedOff || (now - dehumidifierState.lastTurnedOff) >= minOffTimeMs) {
          // Can turn on - minimum off time has elapsed
          setDehumidifierState({
            isOn: true,
            lastTurnedOn: now,
            lastTurnedOff: dehumidifierState.lastTurnedOff,
          });
        }
        // Otherwise, keep it off (still within minOffTime)
      }
      // If already on, keep it on (will be enforced by minOnTime check)
    } else {
      // If dehumidifier should be off
      if (dehumidifierState.isOn) {
        // Check if we can turn it off (respecting minOnTime)
        if (!dehumidifierState.lastTurnedOn || (now - dehumidifierState.lastTurnedOn) >= minOnTimeMs) {
          // Can turn off - minimum on time has elapsed
          setDehumidifierState({
            isOn: false,
            lastTurnedOn: dehumidifierState.lastTurnedOn,
            lastTurnedOff: now,
          });
        }
        // Otherwise, keep it on (still within minOnTime)
      }
    }
  }, [desiredDehumidifierState, dehumidifierState, dehumidifierSettings]);

  // Control ProStat Bridge relay when dehumidifier state changes
  useEffect(() => {
    if (bridgeAvailable && prostatRelay.connected && dehumidifierSettings.enabled) {
      // Sync dehumidifier state with relay
      if (dehumidifierState.isOn !== prostatRelay.relayOn) {
        if (dehumidifierState.isOn) {
          prostatRelay.turnOn().catch(err => {
            console.warn('Failed to turn on dehumidifier relay:', err);
          });
        } else {
          prostatRelay.turnOff().catch(err => {
            console.warn('Failed to turn off dehumidifier relay:', err);
          });
        }
      }
    }
  }, [bridgeAvailable, prostatRelay.connected, dehumidifierState.isOn, prostatRelay.relayOn, dehumidifierSettings.enabled, prostatRelay]);

  // Thermostat logic with 1° deadband (uses effectiveTarget for away mode)
  // Also includes dehumidifier control logic with minOnTime/minOffTime enforcement
  const thermostatState = useMemo(() => {
    const deadband = 1;
    const tempDiff = currentTemp - effectiveTarget;

    if (mode === "off") {
      // Even in off mode, check dehumidifier if enabled
      if (dehumidifierSettings.enabled && dehumidifierState.isOn) {
        return {
          status: "Dehumidifying",
          activeCall: dehumidifierSettings.relayTerminal || "Y2",
          statusColor: "text-blue-600",
        };
      }
      return { status: "Off", activeCall: null, statusColor: "text-gray-600" };
    }

    // Priority 1: Temperature control (heating/cooling)
    // Call for cooling - current temp is above target + deadband
    if (tempDiff > deadband && mode === "cool") {
      return {
        status: "Cooling",
        activeCall: "Y1",
        statusColor: "text-cyan-600",
      };
    }

    // Call for heating - current temp is below target - deadband
    if (tempDiff < -deadband && mode === "heat") {
      return {
        status: "Heating",
        activeCall: "W1",
        statusColor: "text-orange-600",
      };
    }

    // Check if temperature is actually satisfied (within deadband)
    // For heating: current should be >= target - deadband
    // For cooling: current should be <= target + deadband
    const isTempSatisfied = 
      (mode === "heat" && tempDiff >= -deadband) ||
      (mode === "cool" && tempDiff <= deadband);

    // Only show "Satisfied" if temperature is actually at target
    // Priority 2: Humidity control (dehumidifier) - only if temp is satisfied
    if (isTempSatisfied) {
      // Use actual dehumidifier state (which respects minOnTime/minOffTime)
      if (dehumidifierSettings.enabled && dehumidifierState.isOn) {
        return {
          status: "Dehumidifying",
          activeCall: dehumidifierSettings.relayTerminal || "Y2",
          statusColor: "text-blue-600",
        };
      }

      return {
        status: "Satisfied",
        activeCall: null,
        statusColor: "text-green-600",
      };
    }

    // If we get here, temperature is not satisfied but also not calling for heat/cool
    // This shouldn't normally happen, but show a warning status
    return {
      status: mode === "heat" ? "Waiting" : "Idle",
      activeCall: null,
      statusColor: "text-yellow-600",
    };
  }, [currentTemp, effectiveTarget, mode, dehumidifierSettings, dehumidifierState]);

  // Update system state for interlock logic when data changes
  useEffect(() => {
    if (bridgeAvailable && prostatBridge.connected && prostatRelay.connected) {
      // Update system state with current readings
      prostatRelay.updateState({
        indoor_temp: currentTemp,
        indoor_humidity: currentHumidity,
        outdoor_temp: null, // TODO: Get from weather API or sensor
        hvac_mode: mode,
        hvac_running: thermostatState.status !== 'Idle',
      }).catch(err => {
        console.warn('Failed to update system state:', err);
      });
    }
  }, [bridgeAvailable, prostatBridge.connected, prostatRelay.connected, currentTemp, currentHumidity, mode, thermostatState.status, prostatRelay]);

  // Get Groq model and location for status bar
  const groqModel = useMemo(() => {
    try {
      return localStorage.getItem("groqModel") || "llama-3.3-70b-versatile";
    } catch {
      return "llama-3.3-70b-versatile";
    }
  }, []);

  const locationDisplay = useMemo(() => {
    if (userLocation?.city && userLocation?.state) {
      return `${userLocation.city}, ${userLocation.state}`;
    }
    return "Location not set";
  }, [userLocation]);

  const handleTargetTempChange = useCallback((newTemp) => {
    setTargetTemp(newTemp);
    // Update thermostat if connected
    if (activeIntegration && activeIntegration.setTemperature) {
      const heatTemp = mode === 'heat' || mode === 'auto' ? newTemp : (activeIntegration.targetHeatTemp || newTemp);
      const coolTemp = mode === 'cool' || mode === 'auto' ? newTemp : (activeIntegration.targetCoolTemp || newTemp);
      activeIntegration.setTemperature(heatTemp, coolTemp).catch(err => {
        console.error('Failed to set temperature:', err);
      });
    }
    // Also update userSettings if setUserSetting is available
    if (setUserSetting) {
      setUserSetting("winterThermostat", newTemp, {
        source: "SmartThermostatDemo",
        comment: "Set target temperature via slider",
      });
    }
  }, [activeIntegration, mode, setUserSetting]);

  return (
    <div className="page-gradient-overlay min-h-screen">
      <style>{`
        @keyframes pulse-subtle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .pulse-subtle { animation: pulse-subtle 2s ease-in-out infinite; }
      `}</style>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Page Header */}
        <div className="mb-8 animate-fade-in-up">
          <div className="flex items-center gap-4 mb-3">
            <div className="icon-container icon-container-gradient">
              <Thermometer className="w-6 h-6" />
            </div>
            <div>
              <h1 className="heading-primary">
                Smart Thermostat Control
              </h1>
              <p className="text-muted mt-1">
                Monitor and control your home's temperature and humidity
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-glass">
          
          {/* Left: Temperature Control */}
          <div className="glass-card p-glass-lg animate-fade-in-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="heading-tertiary">Manual Control</h2>
              <div className="flex items-center gap-2">
                {speechEnabled ? (
                  <>
                    <Mic className="w-4 h-4 text-cyan-500" />
                    <span className="text-xs text-cyan-500">Voice enabled</span>
                  </>
                ) : (
                  <MicOff className="w-4 h-4 text-muted" title="Voice disabled" />
                )}
              </div>
            </div>
            
            <div className="text-center mb-8">
              <div className="text-7xl font-bold mb-2 text-high-contrast">{currentTemp}°F</div>
              <div className="text-muted text-sm">CURRENT TEMPERATURE</div>
              <div className="text-muted text-xs mt-1">Target: {isAway ? effectiveTarget : targetTemp}°F</div>
            </div>
            
            <div className="space-y-6">
              {/* Temperature Slider */}
              <div>
                <div className="flex justify-between text-xs text-muted mb-2">
                  <span>60°F</span>
                  <span>80°F</span>
                </div>
                <input 
                  type="range" 
                  min="60" 
                  max="80" 
                  value={isAway ? effectiveTarget : targetTemp}
                  onChange={(e) => handleTargetTempChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-700 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>
              
              {/* Humidity and Mode Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card p-glass-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Droplets className="w-4 h-4 text-blue-500" />
                    <span className="text-xs text-muted">HUMIDITY</span>
                  </div>
                  <div className="text-2xl font-bold text-high-contrast">{currentHumidity}%</div>
                  <div className="text-xs text-muted">Target: {humiditySetpoint}%</div>
                </div>
                
                <div className="glass-card p-glass-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Wind className="w-4 h-4 text-orange-500" />
                    <span className="text-xs text-muted">MODE</span>
                  </div>
                  <div className="text-2xl font-bold capitalize text-high-contrast">{mode}</div>
                  <div className={`text-xs ${
                    thermostatState.statusColor === 'text-green-600' ? 'text-green-500' : 
                    thermostatState.statusColor === 'text-orange-600' ? 'text-orange-500' : 
                    thermostatState.statusColor === 'text-cyan-600' ? 'text-cyan-500' : 
                    'text-muted'
                  }`}>
                    {thermostatState.status === "Satisfied" && "✓ Satisfied"}
                    {thermostatState.status === "Heating" && "Heating"}
                    {thermostatState.status === "Cooling" && "Cooling"}
                    {thermostatState.status === "Dehumidifying" && "Dehumidifying"}
                    {thermostatState.status === "Off" && "Off"}
                  </div>
                </div>
              </div>
              
              {/* Target Humidity Slider */}
              <div>
                <label className="text-xs text-muted mb-2 block">Target Humidity: {humiditySetpoint}%</label>
                <div className="flex justify-between text-xs text-muted mb-2">
                  <span>30%</span>
                  <span>80%</span>
                </div>
                <input 
                  type="range" 
                  min="30" 
                  max="80" 
                  value={humiditySetpoint}
                  onChange={(e) => {
                    const newHumidity = Number(e.target.value);
                    try {
                      const thermostatSettings = loadThermostatSettings();
                      const currentComfort = isAway ? "away" : "home";
                      
                      if (!thermostatSettings.comfortSettings) {
                        thermostatSettings.comfortSettings = {};
                      }
                      if (!thermostatSettings.comfortSettings[currentComfort]) {
                        thermostatSettings.comfortSettings[currentComfort] = {};
                      }
                      thermostatSettings.comfortSettings[currentComfort].humiditySetPoint = newHumidity;
                      
                      saveThermostatSettings(thermostatSettings);
                      
                      window.dispatchEvent(new CustomEvent("thermostatSettingsUpdated", {
                        detail: {
                          comfortSettings: thermostatSettings.comfortSettings
                        }
                      }));
                      
                      setSettingsVersion(prev => prev + 1);
                    } catch (err) {
                      console.error("Failed to update humidity setpoint:", err);
                    }
                  }}
                  className="w-full h-2 bg-slate-700 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
              
              {/* Away Mode Button */}
              <button
                onClick={() => handleSetAway(!isAway)}
                className={`w-full p-3 rounded-lg transition-all ${
                  isAway
                    ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg"
                    : "btn-glass text-high-contrast"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Home className={`w-4 h-4 ${isAway ? 'opacity-0' : ''}`} />
                  <span className="text-sm font-medium">
                    {isAway ? "Away Mode Active" : "Activate Away Mode"}
                  </span>
                </div>
              </button>
              
              {/* Schedule Button */}
              <button
                onClick={() => setShowScheduleModal(true)}
                className="btn-glass w-full flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Schedule</span>
              </button>
            </div>
          </div>
          
          {/* Center: AI Assistant */}
          <div className="lg:col-span-2 glass-card p-glass-lg flex flex-col animate-fade-in-up">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="icon-container icon-container-gradient">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="heading-secondary">Ask Joule</h2>
                  <p className="text-sm text-muted">Voice assistant</p>
                </div>
              </div>
              
              <p className="text-muted text-sm mb-3">
                Ask about your home's efficiency, comfort, or costs. Get answers based on your settings and usage data.
              </p>
            </div>
            
            {/* Ask Joule Component */}
            <div className="flex-1 min-h-[400px]">
              <AskJoule
                hasLocation={!!(userSettings?.location || userLocation)}
                userLocation={userLocation || (userSettings?.location ? { city: userSettings.location, state: userSettings.state || "GA" } : null)}
                userSettings={userSettings}
                annualEstimate={null}
                recommendations={[]}
                onNavigate={(path) => {
                  if (path) navigate(path);
                }}
                onSettingChange={(key, value, meta = {}) => {
                  if (typeof setUserSetting === "function") {
                    setUserSetting(key, value, {
                      ...meta,
                      source: meta?.source || "AskJoule",
                    });
                  }
                }}
              />
            </div>
          </div>
        </div>
        
        {/* Status Bar */}
        <div className="mt-6 glass-card p-glass animate-fade-in-up">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-6">
              <span className="text-muted">Location: <span className="text-high-contrast">{locationDisplay}</span></span>
              <span className="text-muted">AI Model: <span className="text-cyan-500">{groqModel}</span></span>
              <span className="text-green-500">● AI Mode Active</span>
              {useProstatIntegration && (
                <span className="text-muted">
                  Bridge: <span className={prostatBridge.connected ? "text-green-500" : "text-red-500"}>
                    {prostatBridge.connected ? "Connected" : "Disconnected"}
                  </span>
                </span>
              )}
              {useEcobeeIntegration && !useProstatIntegration && (
                <span className="text-muted">
                  Ecobee: <span className={ecobee.connected ? "text-green-500" : "text-red-500"}>
                    {ecobee.connected ? "Connected" : "Disconnected"}
                  </span>
                </span>
              )}
              {!useProstatIntegration && !useEcobeeIntegration && (
                <span className="text-muted">Mode: <span className="text-high-contrast">Manual</span></span>
              )}
            </div>
            <div className="text-muted text-xs">
              CPU Temp: <span className="text-red-500">Offline</span>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Modal - Outside main container */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowScheduleModal(false)}>
          <div className="glass-card shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 glass-card border-b p-glass flex items-center justify-between z-10">
              <h2 className="heading-secondary">Thermostat Schedule</h2>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-2 hover:opacity-80 rounded-lg transition-all"
              >
                <svg className="w-6 h-6 text-high-contrast" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-glass">
              <ThermostatScheduleCard
                indoorTemp={userSettings.winterThermostat || 70}
                daytimeTime={daytimeTime}
                nighttimeTime={nighttimeTime}
                nighttimeTemp={nighttimeTemp}
                onDaytimeTimeChange={setDaytimeTime}
                onNighttimeTimeChange={setNighttimeTime}
                onNighttimeTempChange={setNighttimeTemp}
                onIndoorTempChange={setTargetTemp}
                setUserSetting={setUserSetting}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartThermostatDemo;
