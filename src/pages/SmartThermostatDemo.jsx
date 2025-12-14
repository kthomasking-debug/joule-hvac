import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  loadThermostatSettings,
  saveThermostatSettings,
} from "../lib/thermostatSettings";
import { useEcobee } from "../hooks/useEcobee";
import { getEcobeeCredentials } from "../lib/ecobeeApi";
import { useJouleBridgeContext } from "../contexts/JouleBridgeContext";
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
  Volume2,
  VolumeX,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import AskJoule from "../components/AskJoule";
import { getCached, getCachedBatch } from "../utils/cachedStorage";
import { useUnitSystem, formatTemperatureFromF } from "../lib/units";
import useForecast from "../hooks/useForecast";

const SmartThermostatDemo = () => {
  const navigate = useNavigate();
  const outlet = useOutletContext() || {};
  const userSettings = outlet.userSettings || {};
  const setUserSetting = outlet.setUserSetting;
  const { unitSystem } = useUnitSystem();
  
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
  
  // Get weather forecast for temperature drop detection
  const { forecast, loading: forecastLoading, error: forecastError } = useForecast(
    userLocation?.latitude,
    userLocation?.longitude,
    { enabled: !!(userLocation?.latitude && userLocation?.longitude) }
  );
  
  // Debug forecast loading
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[SmartThermostatDemo] Forecast state:', {
        hasUserLocation: !!userLocation,
        latitude: userLocation?.latitude,
        longitude: userLocation?.longitude,
        forecastLoading,
        forecastError,
        forecastLength: forecast?.length || 0,
        firstFewTemps: forecast?.slice(0, 5).map(f => f?.temp) || [],
      });
    }
  }, [forecast, forecastLoading, forecastError, userLocation]);
  
  // Detect sudden temperature drop (21°F or more within 24 hours)
  const temperatureDropAlert = useMemo(() => {
    if (!forecast || forecast.length < 24) {
      if (import.meta.env.DEV) {
        console.log('[TemperatureDropAlert] No forecast or insufficient data:', {
          hasForecast: !!forecast,
          forecastLength: forecast?.length || 0,
        });
      }
      return null; // Need at least 24 hours of forecast
    }
    
    const currentTemp = forecast[0]?.temp;
    if (!currentTemp || currentTemp === null || isNaN(currentTemp)) {
      if (import.meta.env.DEV) {
        console.log('[TemperatureDropAlert] Invalid current temp:', currentTemp);
      }
      return null;
    }
    
    // Check next 24 hours for significant drop
    const hoursToCheck = Math.min(24, forecast.length);
    let minTemp = currentTemp;
    let minTempTime = null;
    
    for (let i = 0; i < hoursToCheck; i++) {
      const hourTemp = forecast[i]?.temp;
      if (hourTemp !== null && hourTemp !== undefined && !isNaN(hourTemp) && hourTemp < minTemp) {
        minTemp = hourTemp;
        minTempTime = forecast[i].time;
      }
    }
    
    const dropAmount = currentTemp - minTemp;
    if (import.meta.env.DEV) {
      console.log('[TemperatureDropAlert] Checking drop:', {
        currentTemp,
        minTemp,
        dropAmount,
        threshold: 21,
        willShow: dropAmount >= 21,
      });
    }
    
    if (dropAmount >= 21) {
      // Find when the drop starts (first hour that's significantly colder, at least 5°F drop)
      let dropStartTime = null;
      for (let i = 0; i < hoursToCheck; i++) {
        const hourTemp = forecast[i]?.temp;
        if (hourTemp !== null && hourTemp !== undefined && !isNaN(hourTemp) && hourTemp <= currentTemp - 5) {
          dropStartTime = forecast[i].time;
          break;
        }
      }
      
      // Calculate duration in hours
      const startTime = dropStartTime || forecast[0].time;
      const endTime = minTempTime || forecast[hoursToCheck - 1].time;
      const durationHours = Math.round((new Date(endTime) - new Date(startTime)) / (1000 * 60 * 60));
      
      if (import.meta.env.DEV) {
        console.log('[TemperatureDropAlert] Alert triggered:', {
          currentTemp,
          minTemp,
          dropAmount,
          startTime,
          endTime,
          durationHours,
        });
      }
      
      return {
        currentTemp,
        minTemp,
        dropAmount,
        startTime: startTime,
        endTime: endTime,
        durationHours,
      };
    }
    
    return null;
  }, [forecast]);

  // Load analyzer results to get balance point
  const latestAnalysis = useMemo(() => {
    try {
      const activeZoneId = getCached("activeZoneId", "zone1");
      const zoneKey = `spa_resultsHistory_${activeZoneId}`;
      const batch = getCachedBatch([zoneKey, "spa_resultsHistory"]);
      const zoneHistory = batch[zoneKey];
      const resultsHistory = (zoneHistory && Array.isArray(zoneHistory) && zoneHistory.length > 0)
        ? zoneHistory
        : (batch["spa_resultsHistory"] || []);
      return resultsHistory && resultsHistory.length > 0
        ? resultsHistory[resultsHistory.length - 1]
        : null;
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
  
  // Joule Bridge (HomeKit HAP) - Preferred method - use shared context
  const jouleBridge = useJouleBridgeContext();
  const bridgeAvailable = jouleBridge.bridgeAvailable;
  
  // Joule Bridge Relay Control (Dehumidifier)
  const prostatRelay = useProstatRelay(2, 5000); // Channel 2 (Y2 terminal), poll every 5 seconds
  
  // Joule Bridge Blueair Control (Air Purifier)
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
  
  // Determine which integration to use (Joule Bridge preferred)
  const useJouleIntegration = bridgeAvailable && jouleBridge.connected;
  const activeIntegration = useJouleIntegration ? jouleBridge : (useEcobeeIntegration ? ecobee : null);
  
  // Expose activeIntegration to window for AskJoule command handlers
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.activeIntegration = activeIntegration;
    }
    return () => {
      if (typeof window !== "undefined") {
        window.activeIntegration = null;
      }
    };
  }, [activeIntegration]);
  
  // Use Joule Bridge or Ecobee data if available, otherwise use simulated
  const currentTemp = activeIntegration && activeIntegration.temperature !== null 
    ? activeIntegration.temperature 
    : simulatedCurrentTemp;
  const currentHumidity = activeIntegration && activeIntegration.humidity !== null 
    ? activeIntegration.humidity 
    : simulatedCurrentHumidity;
  const mode = activeIntegration && activeIntegration.mode 
    ? activeIntegration.mode 
    : simulatedMode;
  
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
  }, [activeIntegration, activeIntegration?.targetHeatTemp, activeIntegration?.targetCoolTemp, mode]);

  // Listen for HVAC mode changes from Ask Joule commands
  useEffect(() => {
    const handleHvacModeChange = (event) => {
      const newMode = event.detail?.mode;
      if (newMode && ["heat", "cool", "auto", "off"].includes(newMode)) {
        handleSetMode(newMode);
      }
    };

    window.addEventListener("hvacModeChanged", handleHvacModeChange);
    return () => {
      window.removeEventListener("hvacModeChanged", handleHvacModeChange);
    };
  }, [handleSetMode]);

  // Listen for target temperature changes from Ask Joule commands
  useEffect(() => {
    const handleTargetTempChange = (event) => {
      if (import.meta.env.DEV) {
        console.log("[SmartThermostatDemo] Received targetTempChanged event:", event.detail);
      }
      // Support both 'temp' and 'temperature' for backward compatibility
      const newTemp = event.detail?.temp || event.detail?.temperature;
      if (import.meta.env.DEV) {
        console.log("[SmartThermostatDemo] Extracted temperature:", newTemp, "Type:", typeof newTemp);
      }
      if (typeof newTemp === "number" && newTemp >= 50 && newTemp <= 90) {
        if (import.meta.env.DEV) {
          console.log("[SmartThermostatDemo] Setting target temperature to:", newTemp);
        }
        setTargetTemp(newTemp);
        // Also update thermostat if connected
        if (activeIntegration && activeIntegration.setTemperature) {
          const heatTemp = mode === 'heat' || mode === 'auto' ? newTemp : (activeIntegration.targetHeatTemp || newTemp);
          const coolTemp = mode === 'cool' || mode === 'auto' ? newTemp : (activeIntegration.targetCoolTemp || newTemp);
          activeIntegration.setTemperature(heatTemp, coolTemp).catch(err => {
            console.error('Failed to update thermostat temperature:', err);
          });
        }
      } else if (import.meta.env.DEV) {
        console.warn("[SmartThermostatDemo] Invalid temperature value:", newTemp, "Type:", typeof newTemp);
      }
    };

    window.addEventListener("targetTempChanged", handleTargetTempChange);
    return () => {
      window.removeEventListener("targetTempChanged", handleTargetTempChange);
    };
  }, [activeIntegration, mode, setTargetTemp]);
  
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

  // Control Joule Bridge relay when dehumidifier state changes
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
    if (bridgeAvailable && jouleBridge.connected && prostatRelay.connected) {
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
  }, [bridgeAvailable, jouleBridge.connected, prostatRelay.connected, currentTemp, currentHumidity, mode, thermostatState.status, prostatRelay]);

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
        // Show user-friendly error message
        if (err.message && err.message.includes("No device paired")) {
          alert('Cannot set temperature: No device is paired. Please pair your Ecobee in Settings → ProStat Bridge.');
        } else {
          alert(`Failed to set temperature: ${err.message || 'Unknown error'}`);
        }
      });
    } else if (bridgeAvailable && !activeIntegration) {
      // Bridge is available but no integration - device might not be paired
      alert('Cannot set temperature: Device is not connected. Please check your bridge connection in Settings → ProStat Bridge.');
    }
    // Also update userSettings if setUserSetting is available
    if (setUserSetting) {
      setUserSetting("winterThermostat", newTemp, {
        source: "SmartThermostatDemo",
        comment: "Set target temperature via slider",
      });
    }
  }, [activeIntegration, mode, setUserSetting, bridgeAvailable]);


  // Calculate estimated cost per hour (simplified)
  const estimatedCostPerHour = useMemo(() => {
    if (thermostatState.status === "Satisfied" || thermostatState.status === "Off") {
      return 0.0;
    }
    // Rough estimate: $0.50-1.50/hr when actively heating/cooling
    const baseCost = mode === "heat" ? 0.70 : mode === "cool" ? 0.85 : 0.60;
    return baseCost;
  }, [thermostatState.status, mode]);


  return (
    <div className="min-h-screen bg-[#050B10]">
      <style>{`
        @keyframes pulse-subtle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .pulse-subtle { animation: pulse-subtle 2s ease-in-out infinite; }
        
        /* Enhanced slider styling for better affordance */
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          cursor: pointer;
        }
        
        input[type="range"]::-webkit-slider-track {
          height: 8px;
          border-radius: 4px;
        }
        
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2), 0 2px 4px rgba(0, 0, 0, 0.3);
          transition: all 0.2s;
          margin-top: -6px;
        }
        
        input[type="range"]::-webkit-slider-thumb:hover {
          box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.3), 0 2px 6px rgba(0, 0, 0, 0.4);
          transform: scale(1.1);
        }
        
        input[type="range"]::-moz-range-track {
          height: 8px;
          border-radius: 4px;
        }
        
        input[type="range"]::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2), 0 2px 4px rgba(0, 0, 0, 0.3);
          transition: all 0.2s;
        }
        
        input[type="range"]::-moz-range-thumb:hover {
          box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.3), 0 2px 6px rgba(0, 0, 0, 0.4);
          transform: scale(1.1);
        }
      `}</style>

      {/* Main Content - Desktop Console Layout - Wider & Centered */}
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8 py-6">
        {/* Page Header Row - Tighter */}
        <header className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white">Thermostat Control</h1>
            <p className="mt-0.5 text-sm text-slate-400">
              Monitor and control your home's temperature and humidity.
            </p>
          </div>

          {/* Right side: Single source of truth for mode */}
          <div className="flex items-center gap-3 text-xs">
            {useJouleIntegration && jouleBridge.connected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-slate-300 border border-slate-700">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Joule Bridge Online
              </span>
            )}
            {useEcobeeIntegration && ecobee.connected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-slate-300 border border-slate-700">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Ecobee Connected
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-slate-300 border border-slate-700">
              {formatTemperatureFromF(currentTemp, unitSystem, { decimals: 0 })} · {mode.charAt(0).toUpperCase() + mode.slice(1)} · {thermostatState.status === "Satisfied" ? "Active" : thermostatState.status}
            </span>
          </div>
        </header>

        {/* Temperature Drop Alert */}
        {temperatureDropAlert ? (
          <div className="mb-6 rounded-xl bg-amber-900/20 border border-amber-600/40 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-amber-300">📉 Sudden Temperature Drop</span>
                </div>
                <p className="text-sm text-amber-200 mb-2">
                  Temperature expected to drop {temperatureDropAlert.dropAmount.toFixed(0)}°F within 24 hours 
                  (from {formatTemperatureFromF(temperatureDropAlert.currentTemp, unitSystem, { decimals: 0 })} to {formatTemperatureFromF(temperatureDropAlert.minTemp, unitSystem, { decimals: 0 })}).
                </p>
                <p className="text-xs text-amber-300/80 mb-2">
                  🔥 Moderate - Sudden increase in heating demand.
                </p>
                <div className="text-xs text-amber-300/70">
                  Starts: {new Date(temperatureDropAlert.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • 
                  Duration: {temperatureDropAlert.durationHours > 0 ? `${temperatureDropAlert.durationHours} hours` : '—'}
                </div>
              </div>
            </div>
          </div>
        ) : forecastLoading ? (
          <div className="mb-6 rounded-xl bg-slate-900/20 border border-slate-700/40 p-4 text-xs text-slate-400">
            Loading weather forecast...
          </div>
        ) : forecastError ? (
          <div className="mb-6 rounded-xl bg-red-900/20 border border-red-700/40 p-4 text-xs text-red-400">
            Weather forecast unavailable: {forecastError.message || 'Unknown error'}
          </div>
        ) : !userLocation?.latitude || !userLocation?.longitude ? (
          <div className="mb-6 rounded-xl bg-slate-900/20 border border-slate-700/40 p-4 text-xs text-slate-400">
            Location not set. Please set your location in Settings to enable weather alerts.
          </div>
        ) : null}

        {/* Main Console Card - Two Column Split */}
        <section className="rounded-2xl bg-[#0C1118] border border-slate-800 shadow-lg p-6 lg:p-7 mb-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            {/* Left: Thermostat Tile - Primary Focus */}
            <div className="flex flex-col h-full">
              {/* Mode Selector - Segmented Control */}
              <div className="mb-4 inline-flex rounded-lg bg-slate-900/80 border border-slate-700 p-1 gap-1">
                {["heat", "cool", "auto", "off"].map((m) => (
                  <button
                    key={m}
                    onClick={() => handleSetMode(m)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      mode === m
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-300 hover:bg-slate-800/60"
                    }`}
                  >
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>

              {/* Temperature Block */}
              <div className="flex-1 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 px-6 py-5 flex flex-col justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400 mb-2">
                    Current Temperature
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-white">
                      {formatTemperatureFromF(currentTemp, unitSystem, { decimals: 0, withUnit: false })}
                    </span>
                    <span className="text-2xl text-slate-300">
                      {unitSystem === "intl" ? "°C" : "°F"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Target <span className="font-semibold text-slate-100">
                      {formatTemperatureFromF(isAway ? effectiveTarget : targetTemp, unitSystem, { decimals: 0 })}
                    </span>
                    {forecast && forecast[1] && (
                      <> · Outdoor <span className="font-semibold text-slate-100">
                        {formatTemperatureFromF(forecast[1].temp, unitSystem, { decimals: 0 })}
                      </span></>
                    )}
                  </p>
                </div>

                {/* Slider + Quick Metrics - Tighter spacing, bigger slider */}
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-2 font-medium">Setpoint</label>
                    <input
                      type="range"
                      className="w-full h-4 accent-blue-500 cursor-pointer"
                      min={60}
                      max={80}
                      value={isAway ? effectiveTarget : targetTemp}
                      onChange={(e) => handleTargetTempChange(parseInt(e.target.value))}
                      style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((isAway ? effectiveTarget : targetTemp) - 60) / 20 * 100}%, #1e293b ${((isAway ? effectiveTarget : targetTemp) - 60) / 20 * 100}%, #1e293b 100%)`
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
                      <p className="text-slate-400 mb-1">Humidity</p>
                      <p className="text-sm font-semibold text-slate-50">
                        {currentHumidity}% <span className={`text-[10px] ml-1 ${Math.abs(currentHumidity - humiditySetpoint) <= 5 ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {Math.abs(currentHumidity - humiditySetpoint) <= 5 ? 'On target' : 'Off target'}
                        </span>
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
                      <p className="text-slate-400 mb-1">Est. Cost</p>
                      <p className="text-sm font-semibold text-slate-50">${estimatedCostPerHour.toFixed(2)} / hr</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <button
                  onClick={() => navigate('/config#schedule')}
                  className="col-span-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 transition-colors"
                >
                  Open Schedule
                </button>
                <button
                  onClick={() => handleSetAway(!isAway)}
                  className={`rounded-lg border transition-colors ${
                    isAway
                      ? "bg-slate-900 border-blue-500 text-blue-400"
                      : "bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  Away Mode
                </button>
              </div>
            </div>

            {/* Right: Ask Joule Panel - Secondary */}
            <div className="flex flex-col h-full rounded-2xl bg-slate-950/70 border border-slate-800 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">Ask Joule</h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Control your thermostat with natural language.
                  </p>
                </div>
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-400 border border-slate-700">
                  Beta
                </span>
              </div>
              
              <div className="border-t border-slate-800 mb-4"></div>

              <div className="flex-1 min-h-[400px]">
                <AskJoule
                  hasLocation={!!(userSettings?.location || userLocation)}
                  userLocation={userLocation || (userSettings?.location ? { city: userSettings.location, state: userSettings.state || "GA" } : null)}
                  userSettings={{
                    ...userSettings,
                    ...(latestAnalysis?.balancePoint != null && Number.isFinite(latestAnalysis.balancePoint) 
                      ? { analyzerBalancePoint: latestAnalysis.balancePoint } 
                      : {})
                  }}
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
                  auditLog={outlet.auditLog}
                  onUndo={(id) => outlet.undoChange && outlet.undoChange(id)}
                  hideHeader={true}
                />
              </div>
            </div>
          </div>
        </section>
        
        {/* Secondary Row: System Status / Hardware - Aligned with main grid */}
        <section className="mt-6 grid grid-cols-3 gap-4 text-xs">
          <div className="rounded-xl bg-slate-950/60 border border-slate-800 px-4 py-3">
            <p className="text-slate-400 mb-1">Location</p>
            <p className="text-slate-100 font-medium">{locationDisplay}</p>
          </div>
          <div className="rounded-xl bg-slate-950/60 border border-slate-800 px-4 py-3">
            <p className="text-slate-400 mb-1">AI Model</p>
            <p className="text-slate-100 font-medium">{groqModel} · {useJouleIntegration || useEcobeeIntegration ? "Joule Active" : "Manual"}</p>
          </div>
          <div className="rounded-xl bg-slate-950/60 border border-slate-800 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-slate-400 mb-1">Bridge</p>
              <p className="text-slate-100 font-medium">
                {useJouleIntegration && jouleBridge.connected 
                  ? "Connected" 
                  : useEcobeeIntegration && ecobee.connected
                  ? "Ecobee Connected"
                  : "Offline"}
              </p>
            </div>
            <span className={`h-2 w-2 rounded-full ${
              (useJouleIntegration && jouleBridge.connected) || (useEcobeeIntegration && ecobee.connected)
                ? "bg-emerald-400"
                : "bg-slate-500"
            }`} />
          </div>
        </section>
      </div>
    </div>
  );
};

export default SmartThermostatDemo;
