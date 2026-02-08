import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useReducer,
  useRef,
} from "react";
import { Toast } from "../components/Toast";
import { US_STATES } from "../lib/usStates";
import ShareableSavingsCard from "../components/ShareableSavingsCard";
import AnswerCard from "../components/AnswerCard";
import { useOutletContext, Link, useNavigate } from "react-router-dom";
import {
  Zap,
  Home,
  Settings,
  DollarSign,
  MapPin,
  TrendingUp,
  Calendar,
  Activity,
  Search,
  BarChart2,
  Mountain,
  AreaChart,
  ChevronDown,
  ChevronUp,
  Share2,
  AlertTriangle,
  TrendingDown,
  HelpCircle,
  Thermometer,
  CheckCircle2,
  Flame,
  ThermometerSun,
  Calculator,
  FileText,
  Sun,
  Moon,
  Clock,
} from "lucide-react";
import {
  inputClasses,
  selectClasses,
} from "../lib/uiClasses";
import { DashboardLink } from "../components/DashboardLink";
import AskJoule from "../components/AskJoule";
// CO2 calculations - may be used in future features
// import { calculateElectricityCO2, calculateGasCO2, formatCO2 } from "../lib/carbonFootprint";
// import { getBestEquivalent } from "../lib/co2Equivalents";
import {
  generateRecommendations,
  getTopRecommendations,
} from "../utils/recommendations";
// --- STEP 1: IMPORT RECHARTS COMPONENTS ---
// Note: Recharts is already lazy loaded at route level (page is lazy)
// Only loads when user navigates to /analysis/forecast
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  Legend,
  ComposedChart,
  Area,
} from "recharts";

// --- STEP 1: IMPORT UTILS ---
import * as heatUtils from "../lib/heatUtils";
import { computeHourlyRate } from "../lib/costUtils";
import useForecast from "../hooks/useForecast";
import { reducer, initialState } from "./heatpump/reducer";
import { detectWeatherAnomalies } from "../utils/weatherAnomalyDetector";
import { WeatherAlerts } from "../components/optimization";
import DailyBreakdownTable from "./heatpump/DailyBreakdownTable";
import ThermostatScheduleClock from "../components/ThermostatScheduleClock";
import OneClickOptimizer from "../components/optimization/OneClickOptimizer";
import {
  fetchLiveElectricityRate,
  fetchLiveGasRate,
  getStateCode,
} from "../lib/eiaRates";
import { getCustomHeroUrl } from "../lib/userImages";
import { formatEnergy, kWhToJ } from "../lib/units/energy";
import { useUnitSystem, formatEnergyFromKwh, formatTemperatureFromF, formatHeatLossFactor, formatCapacityFromKbtuh } from "../lib/units";
import {
  loadThermostatSettings,
} from "../lib/thermostatSettings";
import {
  STATE_ELECTRICITY_RATES,
  STATE_GAS_RATES,
  getStateElectricityRate,
  getStateGasRate,
  hasStateElectricityRate,
  hasStateGasRate,
} from "../data/stateRates";

// Extracted components for better maintainability
import { 
  UpgradeModal, 
  Methodology, 
  OnboardingWizard,
  SeasonProvider,
  SeasonModeToggle,
  useSeason
} from "../features/forecaster/components";

// Lazy load html2canvas - only load when user actually tries to share
let html2canvasModule = null;
async function loadHtml2Canvas() {
  if (!html2canvasModule) {
    html2canvasModule = await import("html2canvas");
  }
  return html2canvasModule.default || html2canvasModule;
}

/**
 * Hybrid rate fetching with EIA API (live) and fallback to hardcoded state averages
 * @param {string} stateName - Full state name (e.g., 'California')
 * @param {Function} setRate - State setter for the rate
 * @param {Function} setSource - State setter for rate source label
 * @param {string} rateType - 'electricity' or 'gas'
 * @returns {Promise<number>} - The rate that was set
 */
const fetchUtilityRate = async (
  stateName,
  setRate,
  setSource,
  rateType = "electricity"
) => {
  // Check if user has manually set the rate - if so, don't overwrite it
  try {
    const storedSettings = localStorage.getItem("userSettings");
    if (storedSettings) {
      const parsed = JSON.parse(storedSettings);
      const manualRate = rateType === "electricity" ? parsed.utilityCost : parsed.gasCost;
      if (manualRate !== undefined && manualRate !== null && Number.isFinite(Number(manualRate))) {
        // User has manual rate - don't overwrite it
        setSource("⚙️ Manual Entry");
        return Number(manualRate);
      }
    }
  } catch (e) {
    // If we can't check, proceed with fetch
  }

  if (!stateName) {
    setSource("âš ï¸ US National Average");
    const defaultRate =
      rateType === "electricity"
        ? STATE_ELECTRICITY_RATES.DEFAULT
        : STATE_GAS_RATES.DEFAULT;
    setRate(defaultRate);
    return defaultRate;
  }

  const stateCode = getStateCode(stateName);

  // Try EIA API first (live data)
  try {
    let liveData = null;
    if (rateType === "electricity") {
      liveData = await fetchLiveElectricityRate(stateCode);
    } else {
      liveData = await fetchLiveGasRate(stateCode);
    }

    if (liveData && liveData.rate) {
      setRate(liveData.rate);
      setSource(`âœ" Live EIA Data (${liveData.timestamp})`);
      return liveData.rate;
    }
  } catch (error) {
    console.warn(
      `Failed to fetch live ${rateType} rate for ${stateName}, using fallback:`,
      error
    );
  }

  // Fallback to hardcoded state average
  const stateRate =
    rateType === "electricity"
      ? getStateElectricityRate(stateName)
      : getStateGasRate(stateName);
  const isUsingStateAverage =
    rateType === "electricity"
      ? hasStateElectricityRate(stateName)
      : hasStateGasRate(stateName);

  if (isUsingStateAverage) {
    setSource(`â“˜ ${stateName} Average (Hardcoded)`);
  } else {
    setSource("âš ï¸ US National Average");
  }

  setRate(stateRate);
  return stateRate;
};

const SevenDayCostForecaster = () => {
  const { unitSystem } = useUnitSystem();
  const outlet = useOutletContext() || {};
  const { userSettings: ctxUserSettings, setUserSetting: ctxSetUserSetting } =
    outlet;
  const userSettings =
    ctxUserSettings || (outlet.userSettings ? outlet.userSettings : {});
  const isNerdMode = userSettings?.nerdMode === true;
  const setUserSetting =
    ctxSetUserSetting ||
    outlet.setUserSetting ||
    ((k, v) => {
      const fn = outlet[`set${k.charAt(0).toUpperCase() + k.slice(1)}`];
      if (typeof fn === "function") fn(v);
    });
  const heatLossFactor = outlet.heatLossFactor;
  const manualTemp = outlet.manualTemp;
  const setManualTemp = outlet.setManualTemp;
  const manualHumidity = outlet.manualHumidity;
  const setManualHumidity = outlet.setManualHumidity;
  const heatLoss = outlet.heatLoss;

  // Derive primitive settings from userSettings
  const utilityCost = Number(userSettings?.utilityCost) || 0.1;
  const gasCost = Number(userSettings?.gasCost) || 1.2;
  // Capacity is stored in kBTU (e.g., 24, 36, etc.), but onboarding and settings should always reflect the same value
  // If userSettings.capacity is set, use it directly (do not default to 24 or 36 if user chose 2 tons/24k)
  // Capacity is stored in kBTU; for backwards compatibility we accept either 'capacity' or 'coolingCapacity'
  const capacity = Number(
    userSettings?.capacity ?? userSettings?.coolingCapacity
  );
  // Fallback to 24 (2 tons) only if not set at all
  const displayCapacity =
    Number.isFinite(capacity) && capacity > 0 ? capacity : 24;
  // Convert capacity (kBTU) to tons: 12 kBTU = 1 ton
  const tons = displayCapacity / 12.0;

  // Derive compressorPower from tons and HSPF2 if not in context
  let compressorPower = outlet.compressorPower;
  // Fallback compressor power (kW) if not provided by context: derive from tons and seasonal COP
  if (!Number.isFinite(compressorPower) || compressorPower <= 0) {
    const seasonalCOP =
      Number(userSettings?.hspf2) > 0 ? Number(userSettings.hspf2) / 3.4 : 2.8; // HSPF2/3.4 â‰ˆ seasonal COP
    compressorPower =
      (tons * heatUtils.KW_PER_TON_OUTPUT) / Math.max(1, seasonalCOP); // kW electrical draw at rated output
  }

  // Track userSettings from localStorage to react to changes from AskJoule
  const [localUserSettings, setLocalUserSettings] = useState(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem("userSettings");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Listen for localStorage changes (e.g., from AskJoule agent updates)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "userSettings" && e.newValue) {
        try {
          const updated = JSON.parse(e.newValue);
          setLocalUserSettings(updated);
        } catch {
          // Ignore parse errors
        }
      }
    };

    // Listen for storage events (from other tabs/windows)
    window.addEventListener("storage", handleStorageChange);

    // Also listen for custom events dispatched when settings change in same tab
    const handleCustomStorageChange = () => {
      try {
        const stored = localStorage.getItem("userSettings");
        if (stored) {
          const parsed = JSON.parse(stored);
          setLocalUserSettings(parsed);
        }
      } catch {
        // Ignore errors
      }
    };
    window.addEventListener("userSettingsUpdated", handleCustomStorageChange);

    // Also poll localStorage periodically to catch same-tab changes
    // (storage event only fires for cross-tab changes)
    const interval = setInterval(() => {
      try {
        const stored = localStorage.getItem("userSettings");
        if (stored) {
          const parsed = JSON.parse(stored);
          setLocalUserSettings((prev) => {
            // Always update if the stored value is different (deep comparison for homeElevation)
            const prevElevation = prev?.homeElevation;
            const newElevation = parsed?.homeElevation;
            if (prevElevation !== newElevation || JSON.stringify(prev) !== JSON.stringify(parsed)) {
              if (import.meta.env.DEV) {
                console.log("ðŸ”ï¸ Elevation change detected in localStorage:", {
                  prevElevation,
                  newElevation,
                  prev: prev,
                  parsed: parsed,
                });
              }
              return parsed;
            }
            return prev;
          });
        }
      } catch {
        // Ignore errors
      }
    }, 100); // Check every 100ms for faster updates

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("userSettingsUpdated", handleCustomStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Merge outlet userSettings with localStorage userSettings (localStorage takes precedence for homeElevation)
  const mergedUserSettings = useMemo(() => {
    return { ...userSettings, ...localUserSettings };
  }, [userSettings, localUserSettings]);

  const efficiency = Number(userSettings?.efficiency) || 15;
  
  // Get energyMode early so it can be used for temperature selection
  const energyMode = userSettings?.energyMode || "heating";
  
  // Get temperatures based on energyMode - use heating or cooling setpoints as appropriate
  const indoorTemp = (() => {
    try {
      const thermostatSettings = loadThermostatSettings();
      if (energyMode === "cooling") {
        return thermostatSettings?.comfortSettings?.home?.coolSetPoint || 
               userSettings?.summerThermostat || 74;
      } else {
        return Number(userSettings?.indoorTemp ?? userSettings?.winterThermostat) ||
               thermostatSettings?.comfortSettings?.home?.heatSetPoint ||
               Number(userSettings?.winterThermostat) ||
               70;
      }
    } catch {
      return energyMode === "cooling" ? 74 : 70;
    }
  })();

  // State for dual-period thermostat schedule times
  // Daytime clock = when daytime period BEGINS (e.g., 6:00 AM - wake up/active)
  // Nighttime clock = when nighttime period BEGINS (e.g., 10:00 PM - sleep/setback)
  // Round time to nearest 30 minutes for cleaner display
  const roundTimeTo30Minutes = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    const roundedMinutes = Math.round(minutes / 30) * 30;
    if (roundedMinutes === 60) {
      return `${String((hours + 1) % 24).padStart(2, "0")}:00`;
    }
    return `${String(hours).padStart(2, "0")}:${String(roundedMinutes).padStart(2, "0")}`;
  };

  const [daytimeTime, setDaytimeTime] = useState(() => {
    try {
      const thermostatSettings = loadThermostatSettings();
      // Look for 'home' entry (when daytime/active period starts)
      const homeEntry = thermostatSettings?.schedule?.weekly?.[0]?.find(
        (e) => e.comfortSetting === "home"
      );
      const time = homeEntry?.time || "05:30"; // Default: daytime starts at 5:30 AM (cleaner)
      return roundTimeTo30Minutes(time);
    } catch {
      return "05:30";
    }
  });

  const [nighttimeTime, setNighttimeTime] = useState(() => {
    try {
      const thermostatSettings = loadThermostatSettings();
      // Look for 'sleep' entry (when nighttime/setback period starts)
      const sleepEntry = thermostatSettings?.schedule?.weekly?.[0]?.find(
        (e) => e.comfortSetting === "sleep"
      );
      const time = sleepEntry?.time || "15:00"; // Default: nighttime starts at 3 PM (cleaner)
      return roundTimeTo30Minutes(time);
    } catch {
      return "15:00";
    }
  });


  // State for nighttime temperature - use cooling or heating setpoint based on energyMode
  const [nighttimeTemp, setNighttimeTemp] = useState(() => {
    try {
      const thermostatSettings = loadThermostatSettings();
      if (energyMode === "cooling") {
        return thermostatSettings?.comfortSettings?.sleep?.coolSetPoint || 78;
      } else {
        return thermostatSettings?.comfortSettings?.sleep?.heatSetPoint || 65;
      }
    } catch {
      return energyMode === "cooling" ? 78 : 65;
    }
  });

  // Sync times and temperatures from localStorage when component mounts or settings change
  useEffect(() => {
    try {
      const thermostatSettings = loadThermostatSettings();
      // home entry = when daytime starts
      const homeEntry = thermostatSettings?.schedule?.weekly?.[0]?.find(
        (e) => e.comfortSetting === "home"
      );
      // sleep entry = when nighttime starts
      const sleepEntry = thermostatSettings?.schedule?.weekly?.[0]?.find(
        (e) => e.comfortSetting === "sleep"
      );
      if (homeEntry?.time) setDaytimeTime(homeEntry.time);
      if (sleepEntry?.time) setNighttimeTime(sleepEntry.time);
      // Update nighttime temp based on energyMode
      if (energyMode === "cooling") {
        const sleepTemp = thermostatSettings?.comfortSettings?.sleep?.coolSetPoint;
        if (sleepTemp !== undefined) setNighttimeTemp(sleepTemp);
      } else {
        const sleepTemp = thermostatSettings?.comfortSettings?.sleep?.heatSetPoint;
        if (sleepTemp !== undefined) setNighttimeTemp(sleepTemp);
      }
    } catch {
      // ignore
    }
  }, [energyMode]);

  // State to track thermostat settings updates (for re-rendering display)
  const [settingsUpdateTrigger, setSettingsUpdateTrigger] = useState(0);

  // Listen for thermostat settings updates
  useEffect(() => {
    const handleSettingsUpdate = (e) => {
      try {
        const thermostatSettings = loadThermostatSettings();
        if (energyMode === "cooling") {
          if (e.detail?.comfortSettings?.sleep?.coolSetPoint !== undefined) {
            setNighttimeTemp(thermostatSettings?.comfortSettings?.sleep?.coolSetPoint || 78);
          }
        } else {
          if (e.detail?.comfortSettings?.sleep?.heatSetPoint !== undefined) {
            setNighttimeTemp(thermostatSettings?.comfortSettings?.sleep?.heatSetPoint || 65);
          }
        }
        // Trigger re-render to update home/away display
        setSettingsUpdateTrigger(prev => prev + 1);
      } catch {
        // ignore
      }
    };
    window.addEventListener("thermostatSettingsUpdated", handleSettingsUpdate);
    // Also listen for storage events (cross-tab updates)
    const handleStorageChange = () => {
      setSettingsUpdateTrigger(prev => prev + 1);
    };
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("thermostatSettingsUpdated", handleSettingsUpdate);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // Helper to convert time string to minutes since midnight
  const timeToMinutes = useCallback((time) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }, []);

  // energyMode is already defined above

  // Get schedule-aware indoor temperature for a given hour
  // Uses dual-period logic: daytime starts at daytimeTime, nighttime starts at nighttimeTime
  const getIndoorTempForHour = useCallback((hourDate) => {
    try {
      const thermostatSettings = loadThermostatSettings();
      
      // Get current time in minutes
      const currentHour = hourDate.getHours();
      const currentMinute = hourDate.getMinutes();
      const currentTimeMinutes = currentHour * 60 + currentMinute;
      
      // Get the schedule times (may be day-specific in future, but for now use state)
      const dayMinutes = timeToMinutes(daytimeTime);
      const nightMinutes = timeToMinutes(nighttimeTime);
      
      // Determine which period we're in using the same logic as getCurrentPeriod
      let isNightPeriod = false;
      if (dayMinutes < nightMinutes) {
        // Normal case: day comes before night (e.g., 6 AM to 10 PM)
        // Daytime: from dayMinutes to nightMinutes
        // Nighttime: from nightMinutes to dayMinutes (wraps midnight)
        isNightPeriod = currentTimeMinutes >= nightMinutes || currentTimeMinutes < dayMinutes;
      } else {
        // Wraps midnight: night comes before day (e.g., day at 6 PM, night at 2 AM)
        // Nighttime: from nightMinutes to dayMinutes
        isNightPeriod = currentTimeMinutes >= nightMinutes && currentTimeMinutes < dayMinutes;
      }
      
      if (isNightPeriod) {
        // Use nighttime temperature (sleep setpoint)
        // Prioritize nighttimeTemp state (from slider) over stored thermostat settings for simulation
        return nighttimeTemp || thermostatSettings?.comfortSettings?.sleep?.heatSetPoint || 65;
      } else {
        // Use daytime temperature
        return indoorTemp;
      }
    } catch {
      // Fallback to daytime temp if schedule can't be loaded
      return indoorTemp;
    }
  }, [daytimeTime, nighttimeTime, indoorTemp, nighttimeTemp, timeToMinutes, energyMode]);
  const squareFeet = Number(userSettings?.squareFeet) || 800;
  const insulationLevel = Number(userSettings?.insulationLevel) || 1.0;
  const homeShape = Number(userSettings?.homeShape) || 1.0; // geometry factor (1.0 default)
  const ceilingHeight = Number(userSettings?.ceilingHeight) || 8; // feet
  const primarySystem = userSettings?.primarySystem || "heatPump";
  const afue = Number(userSettings?.afue) || 0.95;
  // energyMode already declared above for use in getIndoorTempForHour
  const solarExposure = Number(userSettings?.solarExposure) || 1.0;
  const coolingSystem = userSettings?.coolingSystem || "heatPump";
  const coolingCapacity = Number(userSettings?.coolingCapacity) || 36;
  const hspf2 = Number(userSettings?.hspf2) || 9.0;
  const useElectricAuxHeatSetting = Boolean(userSettings?.useElectricAuxHeat);
  const setUtilityCost = (v) => setUserSetting("utilityCost", v);
  const setGasCost = (v) => setUserSetting("gasCost", v);
  const setIndoorTemp = (v) => setUserSetting("indoorTemp", v);
  const setCapacity = (v) => {
    // Keep both fields in sync since Settings uses 'coolingCapacity' while other code may use 'capacity'
    setUserSetting("capacity", v);
    setUserSetting("coolingCapacity", v);
    // Provide quick feedback to user
    try {
      const t = capacities?.[v] || null;
      const tonsText = t ? `${t} tons` : "";
      setToast({
        message: `Capacity updated: ${tonsText} (${v}k BTU)`,
        type: "success",
      });
    } catch {
      /* ignore */
    }
  };
  const setEfficiency = (v) => setUserSetting("efficiency", v);
  const setPrimarySystem = (v) => setUserSetting("primarySystem", v);
  const setAfue = (v) => setUserSetting("afue", v);
  const setCoolingSystem = (v) => setUserSetting("coolingSystem", v);
  const setCoolingCapacity = (v) => {
    setUserSetting("coolingCapacity", v);
    setUserSetting("capacity", v);
    // Provide quick feedback to user
    try {
      const t = capacities?.[v] || null;
      const tonsText = t ? `${t} tons` : "";
      setToast({
        message: `Capacity updated: ${tonsText} (${v}k BTU)`,
        type: "success",
      });
    } catch {
      /* ignore */
    }
  };
  const setHspf2 = (v) => setUserSetting("hspf2", v);
  const setSquareFeet = (v) => setUserSetting("squareFeet", v);
  const setInsulationLevel = (v) => setUserSetting("insulationLevel", v);
  const setHomeShape = (v) => setUserSetting("homeShape", v);
  const setCeilingHeight = (v) => setUserSetting("ceilingHeight", v);
  // setUseElectricAuxHeat available if needed for onboarding
  // const setUseElectricAuxHeat = (v) => setUserSetting("useElectricAuxHeat", v);
  const setEnergyMode = (v) => setUserSetting("energyMode", v);
  const setHomeElevation = (v) => setUserSetting("homeElevation", v);
  
  // Groq API Key state for onboarding (stored in localStorage)
  const [groqApiKey, setGroqApiKeyState] = useState(() => 
    typeof window !== 'undefined' ? localStorage.getItem("groqApiKey") || "" : ""
  );
  const setGroqApiKey = (v) => {
    setGroqApiKeyState(v);
    if (typeof window !== 'undefined') {
      if (v) {
        localStorage.setItem("groqApiKey", v);
      } else {
        localStorage.removeItem("groqApiKey");
      }
    }
  };

  const [state, dispatch] = useReducer(reducer, initialState);
  
  // Destructure location state early so it's available for globalHomeElevation
  const { ui, location: locState } = state || {};
  const {
    cityName,
    stateName,
    coords,
    locationElevation,
    homeElevation: locHomeElevation,
    foundLocationName,
  } = locState || {};
  
  const [weatherAnomalies, setWeatherAnomalies] = useState(null);
  
  // Ensure locHomeElevation has a default value to prevent initialization errors
  const safeLocHomeElevation = locHomeElevation ?? 0;
  
  // Prefer userSettings.homeElevation (from agent or UI), fallback to reducer state
  // Must be defined AFTER locHomeElevation is destructured
  const globalHomeElevation = useMemo(() => {
    // Check merged settings first (includes localStorage updates) - this takes precedence
    if (typeof mergedUserSettings?.homeElevation === "number" && mergedUserSettings.homeElevation >= 0) {
      if (import.meta.env.DEV) {
        console.log("ðŸ”ï¸ Using mergedUserSettings.homeElevation:", mergedUserSettings.homeElevation, {
          localUserSettings: localUserSettings?.homeElevation,
          userSettings: userSettings?.homeElevation,
        });
      }
      return mergedUserSettings.homeElevation;
    }
    // If userSettings has homeElevation set (even if 0), use it
    if (typeof userSettings?.homeElevation === "number" && userSettings.homeElevation >= 0) {
      if (import.meta.env.DEV) {
        console.log("ðŸ”ï¸ Using userSettings.homeElevation:", userSettings.homeElevation);
      }
      return userSettings.homeElevation;
    }
    // Check localUserSettings directly (in case mergedUserSettings didn't work)
    if (typeof localUserSettings?.homeElevation === "number" && localUserSettings.homeElevation >= 0) {
      if (import.meta.env.DEV) {
        console.log("ðŸ”ï¸ Using localUserSettings.homeElevation:", localUserSettings.homeElevation);
      }
      return localUserSettings.homeElevation;
    }
    // Otherwise, use reducer state (locHomeElevation) or outlet
    const fallback = outlet?.homeElevation ?? safeLocHomeElevation ?? 0;
    if (import.meta.env.DEV) {
      console.log("ðŸ”ï¸ Using fallback elevation:", fallback);
    }
    return fallback;
  }, [mergedUserSettings?.homeElevation, userSettings?.homeElevation, localUserSettings?.homeElevation, outlet?.homeElevation, safeLocHomeElevation]);
  
  const [systemExpanded, setSystemExpanded] = useState(false);
  const [gasRatesExpanded, setGasRatesExpanded] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [designTemp, setDesignTemp] = useState(0); // Outdoor design temperature to view heat loss at
  // Prefer environment-provided key (Vite exposes env vars as import.meta.env)
  // Do NOT commit API keys to source control. If you previously hard-coded a key, remove it and create a .env file.
  // Removed legacy auto-fetch rate state after onboarding simplification.
  // Utility and gas rates are now manually set or auto-populated from state averages during location selection.
  // Legacy rateSource tracking removed.
  const [localRates, setLocalRates] = useState([]); // TOU rate schedule
  const [showDailyBreakdown, setShowDailyBreakdown] = useState(false);
  const [showElevationAnalysis, setShowElevationAnalysis] = useState(false);
  const [showAfueTooltip, setShowAfueTooltip] = useState(false);
  const [showHeatLossTooltip, setShowHeatLossTooltip] = useState(false);
  const [showCalculations, setShowCalculations] = useState(false);
  const [showLiveMath, setShowLiveMath] = useState(false);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [isEditingElevation, setIsEditingElevation] = useState(false);
  const [editingElevationValue, setEditingElevationValue] = useState("");

  // Sharing state for savings card
  const [showShareModal, setShowShareModal] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [toast, setToast] = useState(null);

  const [isFirstTimeUser, setIsFirstTimeUser] = useState(() => {
    // Check if user has completed onboarding before
    return !localStorage.getItem("hasCompletedOnboarding");
  });
  // Onboarding steps: 0 = Welcome, 1 = Location, 2 = Building/System, 3 = Confirmation
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [welcomeTheme, setWelcomeTheme] = useState(() => {
    try {
      return localStorage.getItem("onboardingWelcomeTheme") || "winter";
    } catch {
      return "winter";
    }
  });
  const PUBLIC_BASE = useMemo(() => {
    try {
      const b = import.meta?.env?.BASE_URL ?? "/";
      return b.endsWith("/") ? b : `${b}/`;
    } catch {
      return "/";
    }
  }, []);
  const buildPublicPath = useCallback(
    (filename) =>
      `${PUBLIC_BASE}images/welcome/${encodeURIComponent(filename)}`,
    [PUBLIC_BASE]
  );
  const WELCOME_THEMES = useMemo(
    () => ({
      // Filenames normalized to web-safe kebab-case
      winter: { file: "winter-wonderland.png", label: "Winter Wonderland" },
      waterfall: { file: "waterfall.png", label: "Waterfall" },
      bear: {
        file: "bear-setting-thermostat.png",
        label: "Bear Setting Thermostat",
      },
      custom: { custom: true, label: "Custom" },
    }),
    []
  );
  // If a previously saved theme key no longer exists (e.g., 'sunrise'), default to the first available theme
  useEffect(() => {
    if (!WELCOME_THEMES[welcomeTheme]) {
      const firstKey = Object.keys(WELCOME_THEMES)[0];
      if (firstKey) {
        setWelcomeTheme(firstKey);
        try {
          localStorage.setItem("onboardingWelcomeTheme", firstKey);
        } catch {
          /* Intentionally empty */
        }
      }
    }
  }, [welcomeTheme, WELCOME_THEMES]);
  // Sub-steps for the formerly tall Step 2 (now a 2-step wizard: Building -> System)
  const [hvacSubstep, setHvacSubstep] = useState(1); // 1 = Building, 2 = System
  const [showOnboarding, setShowOnboarding] = useState(isFirstTimeUser);
  const [customHeroUrl, setCustomHeroUrl] = useState(null);

  // Load any previously saved custom hero
  useEffect(() => {
    let mounted = true;
    (async () => {
      const url = await getCustomHeroUrl();
      if (mounted) setCustomHeroUrl(url);
    })();
    return () => {
      mounted = false;
    };
  }, []);
  // Preload the current hero image to improve LCP on the welcome step
  useEffect(() => {
    if (!showOnboarding || onboardingStep !== 0) return;
    // Do not preload blob: or data: URLs for custom theme
    if (welcomeTheme === "custom") return;
    const theme = WELCOME_THEMES[welcomeTheme];
    if (!theme) return;
    const url1x = buildPublicPath(theme.file);
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = url1x;
    link.setAttribute("fetchpriority", "high");
    document.head.appendChild(link);
    return () => {
      try {
        document.head.removeChild(link);
      } catch {
        /* Intentionally empty */
      }
    };
  }, [
    showOnboarding,
    onboardingStep,
    welcomeTheme,
    WELCOME_THEMES,
    buildPublicPath,
  ]);
  const [justFetchedWeather, setJustFetchedWeather] = useState(false);
  const [autoAdvanceOnboarding, setAutoAdvanceOnboarding] = useState(false);

  // Rate source tracking for transparency (live API vs fallback)
  const [, setElectricityRateSource] = useState("default");
  const [, setGasRateSource] = useState("default");

  // convenience destructuring - only get page-specific state from reducer
  // Note: ui and locState were already destructured above for locHomeElevation
  const {
    useCalculatedFactor,
    activeTab,
    breakdownView,
    rateSchedule: reduxRateSchedule,
  } = ui || {};
  const rateSchedule = reduxRateSchedule; // avoid creating a new [] each render as a destructuring default

  const capacities = useMemo(
    () => ({ 18: 1.5, 24: 2.0, 30: 2.5, 36: 3.0, 42: 3.5, 48: 4.0, 60: 5.0 }),
    []
  );

  // Load saved location from localStorage on mount
  useEffect(() => {
    try {
      const savedLocation = localStorage.getItem("userLocation");
      if (savedLocation) {
        const loc = JSON.parse(savedLocation);
        // Restore location state from localStorage
        dispatch({
          type: "SET_LOCATION_FIELD",
          field: "cityName",
          value: loc.city || "",
        });
        dispatch({
          type: "SET_LOCATION_FIELD",
          field: "stateName",
          value: loc.state || "",
        });
        dispatch({
          type: "SET_LOCATION_COORDS",
          payload: {
            latitude: loc.latitude ?? loc.lat ?? 0,
            longitude: loc.longitude ?? loc.lon ?? 0,
          },
        });
        dispatch({
          type: "SET_LOCATION_FIELD",
          field: "locationElevation",
          value: loc.elevation || 0,
        });
        // Check userSettings for homeElevation first (may have been updated by agent)
        // Only use loc.elevation as fallback if userSettings doesn't have homeElevation
        const savedUserSettings = localStorage.getItem("userSettings");
        let homeElevFromSettings = null;
        if (savedUserSettings) {
          try {
            const userSettings = JSON.parse(savedUserSettings);
            if (typeof userSettings.homeElevation === "number") {
              homeElevFromSettings = userSettings.homeElevation;
            }
          } catch {
            /* ignore */
          }
        }
        // Convert elevation from meters to feet if needed (legacy data might be in meters)
        // If elevation is less than 1000, it's likely in meters (most US elevations are > 100 ft)
        let elevationInFeet = loc.elevation ?? 0;
        if (elevationInFeet > 0 && elevationInFeet < 1000) {
          // Likely in meters, convert to feet
          elevationInFeet = Math.round(elevationInFeet * 3.28084);
        }
        
        // Also check and convert homeElevFromSettings if it's in meters
        let convertedHomeElev = homeElevFromSettings;
        if (convertedHomeElev !== null && convertedHomeElev > 0 && convertedHomeElev < 1000) {
          // Likely in meters, convert to feet
          convertedHomeElev = Math.round(convertedHomeElev * 3.28084);
          // Update settings with converted value
          try {
            const userSettings = JSON.parse(localStorage.getItem("userSettings") || "{}");
            userSettings.homeElevation = convertedHomeElev;
            localStorage.setItem("userSettings", JSON.stringify(userSettings));
          } catch {
            /* ignore */
          }
        }
        
        const initialElev = convertedHomeElev ?? elevationInFeet ?? 0;
        dispatch({
          type: "SET_LOCATION_FIELD",
          field: "homeElevation",
          value: initialElev,
        });
        try {
          if (typeof setHomeElevation === "function")
            setHomeElevation(initialElev);
        } catch {
          /* ignore */
        }
        dispatch({
          type: "SET_LOCATION_FIELD",
          field: "foundLocationName",
          value: `${loc.city}, ${loc.state} (Elev: ${initialElev} ft)`,
        });
        
        // Update localStorage with converted elevation if it was in meters
        if (elevationInFeet !== loc.elevation && loc.elevation) {
          try {
            const updatedLocation = { ...loc, elevation: initialElev };
            localStorage.setItem("userLocation", JSON.stringify(updatedLocation));
          } catch {
            /* ignore */
          }
        }
      }
    } catch (e) {
      console.error("Error loading saved location:", e);
    }
  }, []); // Run once on mount

  // Debug logging for elevation changes (moved after locHomeElevation is defined)
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("ðŸ”ï¸ Elevation State Check:", {
        globalHomeElevation,
        userSettingsHomeElevation: userSettings?.homeElevation,
        outletHomeElevation: outlet?.homeElevation,
        locHomeElevation: safeLocHomeElevation,
        locationElevation,
      });
    }
  }, [globalHomeElevation, userSettings?.homeElevation, outlet?.homeElevation, safeLocHomeElevation, locationElevation]);

  // Sync global homeElevation into reducer state when it changes in settings
  // This ensures the reducer state reflects the latest elevation from userSettings/localStorage
  useEffect(() => {
    if (typeof globalHomeElevation !== "number" || globalHomeElevation < 0) return;
    
    // Only update if it's different from current reducer state to avoid unnecessary dispatches
    if (safeLocHomeElevation === globalHomeElevation) return;
    
    // Debug logging
    if (import.meta.env.DEV) {
      console.log("ðŸ”ï¸ Syncing globalHomeElevation to reducer:", {
        globalHomeElevation,
        locHomeElevation: safeLocHomeElevation,
        locationElevation,
        userSettingsHomeElevation: userSettings?.homeElevation,
        outletHomeElevation: outlet?.homeElevation,
        localUserSettingsHomeElevation: localUserSettings?.homeElevation,
        mergedUserSettingsHomeElevation: mergedUserSettings?.homeElevation,
      });
    }
    
    dispatch({
      type: "SET_LOCATION_FIELD",
      field: "homeElevation",
      value: globalHomeElevation,
    });
  }, [globalHomeElevation, safeLocHomeElevation, locationElevation, userSettings?.homeElevation, outlet?.homeElevation, localUserSettings?.homeElevation, mergedUserSettings?.homeElevation, dispatch]);

  // Use the correct heatLoss from context (already computed with building characteristics)
  const effectiveHeatLoss = useMemo(() => {
    const useManualHeatLoss = Boolean(userSettings?.useManualHeatLoss);
    const useCalculatedHeatLoss = userSettings?.useCalculatedHeatLoss !== false; // Default to true
    const useAnalyzerHeatLoss = Boolean(userSettings?.useAnalyzerHeatLoss);
    const useLearnedHeatLoss = Boolean(userSettings?.useLearnedHeatLoss);
    
    // Priority 1: Manual Entry (if enabled)
    if (useManualHeatLoss) {
      const manualHeatLossFactor = Number(userSettings?.manualHeatLoss);
      if (Number.isFinite(manualHeatLossFactor) && manualHeatLossFactor > 0) {
        // manualHeatLoss is stored as BTU/hr/°F (heat loss factor), convert to BTU/hr at 70°F delta
        return manualHeatLossFactor * 70;
      }
    }
    
    // Priority 2: Analyzer Data from CSV (if enabled)
    // â˜¦ï¸ LOAD-BEARING: Check both React state (heatLossFactor) and userSettings (analyzerHeatLoss)
    // Why both: React state is immediate but doesn't persist. userSettings persists across reloads.
    // The analyzer sets both, but if user refreshes, only userSettings remains.
    const analyzerHeatLossFromSettings = Number(userSettings?.analyzerHeatLoss);
    const analyzerHeatLossValue = heatLossFactor || (Number.isFinite(analyzerHeatLossFromSettings) && analyzerHeatLossFromSettings > 0 ? analyzerHeatLossFromSettings : null);
    
    if (useAnalyzerHeatLoss && analyzerHeatLossValue) {
      // analyzerHeatLossValue is already in BTU/hr/°F, convert to BTU/hr at 70°F delta
      return analyzerHeatLossValue * 70;
    }
    
    // Priority 3: Bill-learned heat loss (if enabled)
    if (useLearnedHeatLoss && userSettings?.learnedHeatLoss > 0) {
      const learned = Number(userSettings.learnedHeatLoss);
      if (Number.isFinite(learned)) return learned * 70; // BTU/hr at 70°F delta
    }
    
    // Priority 4: Calculated from Building Characteristics (DoE data)
    if (useCalculatedHeatLoss) {
      try {
        const designHeatLoss = heatUtils.calculateHeatLoss({
          squareFeet: squareFeet || 1500,
          insulationLevel: insulationLevel || 1.0,
          homeShape: homeShape || 1.0,
          ceilingHeight: ceilingHeight || 8,
          wallHeight: userSettings?.wallHeight ?? null,
          hasLoft: userSettings?.hasLoft || false,
        });
        return designHeatLoss; // BTU/hr at ~70°F delta
      } catch (e) {
        console.warn("Calculated heat loss computation failed", e);
      }
    }
    
    // Fallback: If explicit heatLoss stored in context, use it
    if (typeof heatLoss === "number" && heatLoss > 0) {
      return heatLoss;
    }
    
    // Final fallback: approximate design heat loss using centralized function
    try {
      const designHeatLoss = heatUtils.calculateHeatLoss({
        squareFeet: squareFeet || 1500,
        insulationLevel: insulationLevel || 1.0,
        homeShape: homeShape || 1.0,
        ceilingHeight: ceilingHeight || 8,
        wallHeight: userSettings?.wallHeight ?? null,
        hasLoft: userSettings?.hasLoft || false,
      });
      return designHeatLoss;
    } catch (e) {
      console.warn("Fallback heat loss computation failed", e);
      return 0;
    }
  }, [
    userSettings?.useManualHeatLoss,
    userSettings?.useCalculatedHeatLoss,
    userSettings?.useAnalyzerHeatLoss,
    userSettings?.useLearnedHeatLoss,
    userSettings?.manualHeatLoss,
    userSettings?.analyzerHeatLoss,
    userSettings?.learnedHeatLoss,
    userSettings?.wallHeight,
    userSettings?.hasLoft,
    useCalculatedFactor,
    heatLossFactor,
    heatLoss,
    squareFeet,
    insulationLevel,
    homeShape,
    ceilingHeight,
  ]);

  const getPerformanceAtTemp = useCallback(
    (outdoorTemp, humidity, hourDate = null) => {
      // Validate inputs are finite numbers
      const safeOutdoorTemp = Number.isFinite(outdoorTemp) ? outdoorTemp : 50;
      const safeHumidity = Number.isFinite(humidity) ? humidity : 50;
      const safeTons = Number.isFinite(tons) && tons > 0 ? tons : 2.0;
      
      // Use schedule-aware temperature if hourDate is provided, otherwise use default
      const tempForHour = hourDate ? getIndoorTempForHour(hourDate) : indoorTemp;
      const safeIndoorTemp = Number.isFinite(tempForHour) && tempForHour > 0 ? tempForHour : 70;
      
      const safeEffectiveHeatLoss = Number.isFinite(effectiveHeatLoss) && effectiveHeatLoss >= 0 ? effectiveHeatLoss : 0;
      const safeCompressorPower = Number.isFinite(compressorPower) && compressorPower > 0 ? compressorPower : (safeTons * 1.0 * (15 / 15));
      const safeEfficiency = Number.isFinite(efficiency) && efficiency > 0 ? efficiency : 15;
      const safeSolarExposure = Number.isFinite(solarExposure) && solarExposure > 0 ? solarExposure : 1.0;

      if (energyMode === "cooling") {
        const params = {
          tons: safeTons,
          indoorTemp: safeIndoorTemp,
          designHeatLossBtuHrAt70F: safeEffectiveHeatLoss,
          seer2: safeEfficiency,
          solarExposure: safeSolarExposure,
        };
        return heatUtils.computeHourlyCoolingPerformance(
          params,
          safeOutdoorTemp,
          safeHumidity
        );
      }
      const params = {
        tons: safeTons,
        indoorTemp: safeIndoorTemp,
        designHeatLossBtuHrAt70F: safeEffectiveHeatLoss,
        compressorPower: safeCompressorPower,
        hspf2: hspf2,
      };
      return heatUtils.computeHourlyPerformance(params, safeOutdoorTemp, safeHumidity);
    },
    [
      tons,
      indoorTemp,
      effectiveHeatLoss,
      compressorPower,
      energyMode,
      efficiency,
      solarExposure,
      getIndoorTempForHour,
    ]
  );

  // Use the new hook to fetch forecast with cancellation support
  // The hook automatically refetches when lat/lon change, so no manual refetch needed
  const {
    forecast: forecastData,
    loading: forecastLoading,
    error: forecastError,
    dataSource: forecastDataSource,
  } = useForecast(coords.latitude, coords.longitude, { enabled: !!coords });

  // Debugging logs to trace calculation parameters
  // Removed debug logging

  // sync hook results into reducer forecast state
  useEffect(() => {
    if (forecastLoading && !state.forecast.loading)
      dispatch({ type: "FETCH_START" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecastLoading]);

  useEffect(() => {
    if (forecastData && state.forecast.data !== forecastData)
      dispatch({ type: "FETCH_SUCCESS", payload: forecastData });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecastData]);

  useEffect(() => {
    if (forecastError && state.forecast.error !== forecastError)
      dispatch({ type: "FETCH_ERROR", error: forecastError });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecastError]);

  // Detect weather anomalies when forecast data is available
  useEffect(() => {
    if (forecastData && forecastData.length > 0 && coords.latitude && coords.longitude) {
      detectWeatherAnomalies(forecastData, {
        latitude: coords.latitude,
        longitude: coords.longitude,
        city: foundLocationName?.split(',')[0],
        state: foundLocationName?.split(',')[1]?.trim(),
      }).then((result) => {
        setWeatherAnomalies(result);
      }).catch((err) => {
        console.warn("Failed to detect weather anomalies:", err);
        setWeatherAnomalies(null);
      });
    } else {
      setWeatherAnomalies(null);
    }
  }, [forecastData, coords, foundLocationName]);

  // Location search (simplified after refactor)
  const handleCitySearch = async () => {
    if (!cityName)
      return dispatch({
        type: "SET_UI_FIELD",
        field: "error",
        value: "Please enter a city name.",
      });
    dispatch({ type: "SET_UI_FIELD", field: "error", value: null });
    dispatch({
      type: "SET_LOCATION_FIELD",
      field: "foundLocationName",
      value: "",
    });
    try {
      const input = cityName.trim();
      let cityPart = input;
      let statePart = null;

      if (input.includes(",")) {
        [cityPart, statePart] = input.split(",").map((s) => s.trim());
      }

      // Validation: accept two-letter state abbreviations by expanding them to full names
      if (statePart && statePart.length === 2) {
        const expanded = US_STATES[statePart.toUpperCase()];
        if (expanded) {
          statePart = expanded;
        } else {
          dispatch({
            type: "SET_UI_FIELD",
            field: "error",
            value:
              "Please use the full state name (e.g., 'Georgia' instead of 'GA').",
          });
          return;
        }
      }

      const geoResponse = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          cityPart
        )}&count=10&language=en&format=json`
      );
      const geoData = await geoResponse.json();

      if (!geoResponse.ok || !geoData.results || geoData.results.length === 0)
        throw new Error(`Could not find location: "${input}"`);

      let bestResult;
      if (statePart) {
        // Direct, case-insensitive match on full state name
        const stateMatches = geoData.results.filter(
          (r) => (r.admin1 || "").toLowerCase() === statePart.toLowerCase()
        );
        if (stateMatches.length > 0) {
          bestResult = stateMatches[0];
        }
      }

      // Fallback if no specific state match was found or no state was provided
      if (!bestResult) {
        const usResults = geoData.results.filter(
          (r) => (r.country_code || "").toLowerCase() === "us"
        );
        bestResult = usResults.length > 0 ? usResults[0] : geoData.results[0];
      }

      let elevationInFeet = 0;
      if (
        typeof bestResult.elevation === "number" &&
        bestResult.elevation > 0
      ) {
        elevationInFeet = Math.round(bestResult.elevation * 3.28084);
      } else if (
        bestResult.name.toLowerCase() === "blairsville" &&
        bestResult.admin1?.toLowerCase() === "georgia"
      ) {
        elevationInFeet = 1830;
      }

      dispatch({
        type: "SET_LOCATION_COORDS",
        payload: {
          latitude: bestResult.latitude,
          longitude: bestResult.longitude,
        },
      });
      dispatch({
        type: "SET_LOCATION_FIELD",
        field: "locationElevation",
        value: elevationInFeet,
      });
      dispatch({
        type: "SET_LOCATION_FIELD",
        field: "homeElevation",
        value: elevationInFeet,
      });
      if (typeof setHomeElevation === "function") {
        setHomeElevation(elevationInFeet);
      }

      const finalStateName = bestResult.admin1 || statePart || "";
      dispatch({
        type: "SET_LOCATION_FIELD",
        field: "foundLocationName",
        value: `${bestResult.name}, ${finalStateName} (Elev: ${elevationInFeet} ft)`,
      });

      localStorage.setItem(
        "userLocation",
        JSON.stringify({
          city: bestResult.name,
          state: finalStateName,
          latitude: bestResult.latitude,
          longitude: bestResult.longitude,
          elevation: elevationInFeet,
        })
      );

      if (finalStateName) {
        dispatch({
          type: "SET_LOCATION_FIELD",
          field: "stateName",
          value: finalStateName,
        });
        // Only fetch and set utility rates if user hasn't manually set them
        // Check localStorage directly to see if user explicitly set the rate
        let hasManualElectricityRate = false;
        let hasManualGasRate = false;
        try {
          const storedSettings = localStorage.getItem("userSettings");
          if (storedSettings) {
            const parsed = JSON.parse(storedSettings);
            // If utilityCost exists in stored settings, user has manually set it
            hasManualElectricityRate = parsed.utilityCost !== undefined && 
                                      parsed.utilityCost !== null &&
                                      Number.isFinite(Number(parsed.utilityCost));
            hasManualGasRate = parsed.gasCost !== undefined && 
                              parsed.gasCost !== null &&
                              Number.isFinite(Number(parsed.gasCost));
          }
        } catch (e) {
          // If we can't read localStorage, assume no manual rates
          console.warn("Could not check localStorage for manual rates", e);
        }
        
        if (!hasManualElectricityRate) {
          await fetchUtilityRate(
            finalStateName,
            setUtilityCost,
            setElectricityRateSource,
            "electricity"
          );
        } else {
          // User has manual rate, don't overwrite it - just update the source
          setElectricityRateSource("⚙️ Manual Entry");
          // Ensure the manual rate is preserved (don't call setUtilityCost)
        }
        
        if (!hasManualGasRate) {
          await fetchUtilityRate(
            finalStateName,
            setGasCost,
            setGasRateSource,
            "gas"
          );
        } else {
          // User has manual rate, just update the source to indicate it's manual
          setGasRateSource("⚙️ Manual Entry");
        }
      }

      dispatch({ type: "FETCH_ERROR", error: null });
      setJustFetchedWeather(true);
      // Note: No manual refetch needed - useForecast hook automatically refetches when coordinates change
    } catch (err) {
      dispatch({ type: "SET_UI_FIELD", field: "error", value: err.message });
    }
  };

  const adjustedForecast = useMemo(() => {
    if (!forecastData) return null;
    const homeElev = globalHomeElevation || safeLocHomeElevation || locationElevation || 0;
    
    // Use API elevation if available (more accurate than geocoded elevation)
    // Check first hour for API elevation
    const apiElevation = forecastData[0]?.apiElevationFeet;
    
    // Only apply elevation adjustment if we have reliable station elevation data
    // Weather APIs typically provide forecasts for the requested coordinates,
    // so if we don't have explicit API elevation, assume forecast is already correct
    let weatherStationElev = null;
    if (apiElevation !== undefined && apiElevation !== null) {
      // Use API elevation if provided (most reliable)
      weatherStationElev = apiElevation;
    } else if (locationElevation && Math.abs(homeElev - locationElevation) > 500) {
      // Only use locationElevation if it's significantly different (>500ft) from home elevation
      // This suggests the weather station might be at a different elevation
      weatherStationElev = locationElevation;
    } else {
      // If no reliable station elevation data, assume forecast is already for home elevation
      // Don't apply adjustment to avoid making temperatures too cold
      weatherStationElev = homeElev;
    }
    
    // Debug logging for elevation adjustment
    if (import.meta.env.DEV) {
      console.log("ðŸŒ Elevation Adjustment Debug:", {
        homeElevation: homeElev,
        locationElevation: locationElevation,
        apiElevation: apiElevation,
        weatherStationElevation: weatherStationElev,
        elevationDifference: homeElev - weatherStationElev,
        forecastLength: forecastData.length,
        sampleTemp: forecastData[0]?.temp,
        coords: coords,
        adjustmentApplied: Math.abs(homeElev - weatherStationElev) >= 10,
        reason: apiElevation !== undefined ? "Using API elevation" : 
                (locationElevation && Math.abs(homeElev - locationElevation) > 500) ? "Using locationElevation (significant difference)" :
                "No adjustment (assuming forecast is for home elevation)",
      });
    }
    
    return heatUtils.adjustForecastForElevation(
      forecastData,
      homeElev,
      weatherStationElev
    );
  }, [forecastData, globalHomeElevation, locationElevation, safeLocHomeElevation, coords]);

  useEffect(() => {
    const incoming = rateSchedule || [];
    try {
      const prevJson = JSON.stringify(localRates || []);
      const nextJson = JSON.stringify(incoming);
      if (prevJson !== nextJson) setLocalRates(incoming);
    } catch {
      if ((localRates || []).length !== incoming.length)
        setLocalRates(incoming);
    }
    // Only depend on rateSchedule - localRates is updated by this effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rateSchedule]);

  const weeklyMetrics = useMemo(() => {
    return heatUtils.computeWeeklyMetrics(
      adjustedForecast,
      getPerformanceAtTemp,
      utilityCost,
      indoorTemp,
      useElectricAuxHeatSetting,
      localRates
    );
  }, [
    adjustedForecast,
    getPerformanceAtTemp,
    utilityCost,
    indoorTemp,
    nighttimeTemp,
    localRates,
    daytimeTime,
    nighttimeTime,
  ]);

  // Gas-mode weekly metrics (therms and cost)
  const weeklyGasMetrics = useMemo(() => {
    if (!adjustedForecast) return null;
    const btuPerTherm = 100000;
    const eff = Math.min(
      0.99,
      Math.max(0.6, typeof afue === "number" ? afue : 0.95)
    );
    const btuLossPerDegreeF = effectiveHeatLoss / 70; // heat loss per °F
    let totalTherms = 0;
    let totalCost = 0;
    // Sum hourly across the 7-day hourly forecast
    adjustedForecast.forEach((hour) => {
      const temp = hour.temp;
      // Use schedule-aware temperature for gas calculations too
      const hourIndoorTemp = getIndoorTempForHour(hour.time);
      const tempDiff = Math.max(0, hourIndoorTemp - temp);
      const buildingHeatLossBtu = btuLossPerDegreeF * tempDiff; // BTU/hr at this delta
      const therms = buildingHeatLossBtu / (btuPerTherm * eff);
      totalTherms += therms;
      totalCost += therms * gasCost; // flat gas $/therm
    });
    return { totalTherms, totalCost };
  }, [adjustedForecast, indoorTemp, effectiveHeatLoss, afue, gasCost, getIndoorTempForHour]);

  // --- Design temperature heat loss calculation ---
  const perDegree =
    Number(effectiveHeatLoss) > 0 ? Number(effectiveHeatLoss) / 70 : 0; // BTU/hr per °F
  const deltaTForDesign = Math.max(0, Number(indoorTemp) - Number(designTemp));
  const calculatedHeatLossBtu = perDegree * deltaTForDesign;
  const calculatedHeatLossKw = calculatedHeatLossBtu / heatUtils.BTU_PER_KWH;

  // Persist last forecast summary for home dashboard and Ask Joule
  useEffect(() => {
    if (weeklyMetrics && foundLocationName) {
      try {
        const payload = {
          location: foundLocationName,
          totalHPCost: weeklyMetrics.totalCost,
          totalHPCostWithAux: weeklyMetrics.totalCost,
          totalMonthlyCost: weeklyMetrics.totalCost * 4.33,
          totalGasCost: null, // 7-Day Forecaster doesn't calculate gas cost
          totalSavings: null,
          estimatedAnnualSavings: null,
          timestamp: Date.now(),
          source: 'weekly_forecast',
          // Include daily summary for Ask Joule access
          dailySummary: weeklyMetrics.summary || [],
        };
        // Save to separate key so we don't overwrite the monthly forecast summary
        // which the bridge uses for the e-ink HMI display
        localStorage.setItem("last_weekly_forecast_summary", JSON.stringify(payload));
        
        // Only update last_forecast_summary if there isn't already a monthly forecast saved
        const existing = localStorage.getItem("last_forecast_summary");
        if (existing) {
          try {
            const parsed = JSON.parse(existing);
            if (parsed.source === 'monthly_forecast') {
              // Don't overwrite monthly forecast data - it's more accurate
              return;
            }
          } catch { /* ignore */ }
        }
        localStorage.setItem("last_forecast_summary", JSON.stringify(payload));
      } catch {
        /* ignore persistence errors */
      }
    }
  }, [weeklyMetrics, foundLocationName]);

  const manualDayMetrics = useMemo(() => {
    const perf = getPerformanceAtTemp(manualTemp, manualHumidity);

    // perf.hpKwh is already energy (kWh) for 1 hour (dtHours = 1.0 by default)
    const hourlyEnergy = typeof perf?.hpKwh === "number" ? perf.hpKwh : NaN;
    const dailyEnergy = Number.isFinite(hourlyEnergy) ? hourlyEnergy * 24 : NaN;
    const dailyCost =
      Number.isFinite(dailyEnergy) && Number.isFinite(utilityCost)
        ? dailyEnergy * utilityCost
        : NaN;
    return {
      dailyEnergy,
      dailyCost,
      defrostPenalty: perf?.defrostPenalty,
      humidity: manualHumidity,
      outdoorTemp: manualTemp,
    };
  }, [manualTemp, manualHumidity, getPerformanceAtTemp, utilityCost]);

  // --- STEP 2: CALCULATE DATA FOR THE GRAPH ---
  const elevationCostData = useMemo(() => {
    if (!forecastData) return null;

    const results = [];
    const baseElevation = Math.round(locationElevation / 500) * 500;
    const startElevation = Math.max(0, baseElevation - 2000);
    const endElevation = baseElevation + 4000;

    for (let elev = startElevation; elev <= endElevation; elev += 500) {
      const tempAdjustedForecast = heatUtils.adjustForecastForElevation(
        forecastData,
        elev,
        locationElevation
      );

      let totalCostWithAux = 0;
      tempAdjustedForecast.forEach((hour) => {
        const perf = getPerformanceAtTemp(hour.temp, hour.humidity);
        // perf.hpKwh is already energy (kWh) for the timestep, scaled by dtHours
        const energyForHour = perf.hpKwh || 0;
        // perf.auxKwh is already energy (kWh) for the timestep, scaled by dtHours
        const auxEnergyForHour = perf.auxKwh || 0;
        const effectiveAuxEnergyForHour = useElectricAuxHeatSetting
          ? auxEnergyForHour
          : 0;
        // use localRates when calculating elevation cost
        const dt = hour.time instanceof Date ? hour.time : new Date(hour.time);
        const rate = computeHourlyRate(dt, localRates, utilityCost);
        totalCostWithAux += (energyForHour + effectiveAuxEnergyForHour) * rate;
      });
      results.push({
        elevation: elev,
        cost: parseFloat(totalCostWithAux.toFixed(2)),
      });
    }
    return results;
  }, [
    forecastData,
    locationElevation,
    getPerformanceAtTemp,
    utilityCost,
    localRates,
  ]);

  // --- Aux heat usage percentage ---
  const auxPercentage = useMemo(() => {
    if (!weeklyMetrics) return 0;
    const totalAux = weeklyMetrics.summary.reduce(
      (acc, d) => acc + d.auxEnergy,
      0
    );
    const totalEnergy = weeklyMetrics.summary.reduce(
      (acc, d) => acc + d.energyWithAux,
      0
    );
    return totalEnergy > 0 ? (totalAux / totalEnergy) * 100 : 0;
  }, [weeklyMetrics]);

  // --- Upgrade scenario calculation ---
  const upgradeScenario = useMemo(() => {
    if (!adjustedForecast) return null;
    const upgradedCapacity = capacity + 6; // e.g., 24k -> 30k
    const upgradedEfficiency = Math.min(efficiency + 2, 22); // e.g., 15 SEER2 -> 17 SEER2
    const upgradedTons = capacities[upgradedCapacity] || tons;
    const upgradedCompressorPower =
      upgradedTons * 1.0 * (15 / upgradedEfficiency);

    const getUpgradedPerformance = (outdoorTemp, humidity) => {
      // Validate inputs are finite numbers
      const safeOutdoorTemp = Number.isFinite(outdoorTemp) ? outdoorTemp : 50;
      const safeHumidity = Number.isFinite(humidity) ? humidity : 50;
      const safeUpgradedTons = Number.isFinite(upgradedTons) && upgradedTons > 0 ? upgradedTons : 2.0;
      const safeIndoorTemp = Number.isFinite(indoorTemp) && indoorTemp > 0 ? indoorTemp : 70;
      const safeHeatLoss = (Number.isFinite(heatLoss) && heatLoss > 0) ? heatLoss : (Number.isFinite(effectiveHeatLoss) && effectiveHeatLoss > 0 ? effectiveHeatLoss : 0);
      const safeUpgradedCompressorPower = Number.isFinite(upgradedCompressorPower) && upgradedCompressorPower > 0 ? upgradedCompressorPower : (safeUpgradedTons * 1.0 * (15 / upgradedEfficiency));

      const params = {
        tons: safeUpgradedTons,
        indoorTemp: safeIndoorTemp,
        designHeatLossBtuHrAt70F: safeHeatLoss,
        compressorPower: safeUpgradedCompressorPower,
      };
      return heatUtils.computeHourlyPerformance(params, safeOutdoorTemp, safeHumidity);
    };

    const upgraded = heatUtils.computeWeeklyMetrics(
      adjustedForecast,
      getUpgradedPerformance,
      utilityCost,
      indoorTemp,
      useElectricAuxHeatSetting,
      localRates
    );
    return {
      capacity: upgradedCapacity,
      efficiency: upgradedEfficiency,
      tons: upgradedTons,
      metrics: upgraded,
      currentCost:
        breakdownView === "withAux"
          ? weeklyMetrics?.totalCostWithAux || 0
          : weeklyMetrics?.totalCost || 0,
      upgradedCost:
        breakdownView === "withAux"
          ? upgraded?.totalCostWithAux || 0
          : upgraded?.totalCost || 0,
    };
  }, [
    adjustedForecast,
    capacity,
    efficiency,
    tons,
    heatLoss,
    indoorTemp,
    utilityCost,
    localRates,
    weeklyMetrics,
    breakdownView,
    capacities,
  ]);

  // --- ROI calculation (annual savings vs gas heat baseline) ---
  // Uses industry-standard HDD (Heating Degree Days) methodology for accurate annual estimates
  const roiData = useMemo(() => {
    if (!weeklyMetrics || energyMode !== "heating") return null;
    // ...existing ROI calculation logic...
    return {
      /* ...roiData fields... */
    };
  }, [weeklyMetrics, energyMode, coords.latitude]);

  // --- Share handler ---
  const handleShare = useCallback(() => {
    try {
      const params = new URLSearchParams({
        lat: coords.latitude?.toFixed?.(4) ?? "",
        lon: coords.longitude?.toFixed?.(4) ?? "",
        cap: capacity,
        eff: efficiency,
        temp: indoorTemp,
        cost: utilityCost,
      });
      const shareUrl = `${window.location.origin}${
        window.location.pathname
      }?${params.toString()}`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(shareUrl)
          .then(() => {
            setShareMessage("Link copied to clipboard!");
            setTimeout(() => setShareMessage(""), 3000);
          })
          .catch(() => {
            setShareMessage("Share URL: " + shareUrl);
          });
      } else {
        setShareMessage("Share URL: " + shareUrl);
        setTimeout(() => setShareMessage(""), 5000);
      }
    } catch (err) {
      console.error("Failed to create share link", err);
      setShareMessage("Unable to create share URL");
      setTimeout(() => setShareMessage(""), 3000);
    }
  }, [coords, capacity, efficiency, indoorTemp, utilityCost]);

  // --- Load params on mount (simple version) ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("lat") && params.has("lon")) {
      const lat = parseFloat(params.get("lat"));
      const lon = parseFloat(params.get("lon"));
      if (!isNaN(lat) && !isNaN(lon)) {
        dispatch({
          type: "SET_LOCATION_COORDS",
          payload: { latitude: lat, longitude: lon },
        });
      }
    }
    if (params.has("cap")) {
      const cap = Number(params.get("cap"));
      if (capacities[cap])
        dispatch({ type: "SET_UI_FIELD", field: "capacity", value: cap });
    }
    if (params.has("eff")) {
      const eff = Number(params.get("eff"));
      if (eff >= 14 && eff <= 22)
        dispatch({ type: "SET_UI_FIELD", field: "efficiency", value: eff });
    }
    if (params.has("temp")) {
      const temp = Number(params.get("temp"));
      if (temp >= 65 && temp <= 75)
        dispatch({ type: "SET_UI_FIELD", field: "indoorTemp", value: temp });
    }
    if (params.has("cost")) {
      const cost = Number(params.get("cost"));
      if (cost >= 0.05 && cost <= 0.5) setUtilityCost(cost);
    }
  }, [capacities]);


  // Onboarding handlers
  const navigate = useNavigate();
  const completeOnboarding = React.useCallback(
    ({ navigateHome = true } = {}) => {
      localStorage.setItem("hasCompletedOnboarding", "true");
      setIsFirstTimeUser(false);
      setShowOnboarding(false);
      try {
        if (navigateHome) navigate("/home-health");
      } catch {
        /* Intentionally empty */
      }
    },
    [navigate]
  );

  const handleOnboardingNext = React.useCallback(() => {
    // Building details are now REQUIRED in all modes for Ask Joule to work properly
    // Flow: 0 (Welcome) -> 1 (Location) -> 2 (Building/System) -> 3 (Confirmation) -> 4 (Optional Tour)
    if (onboardingStep === 0) {
      setOnboardingStep(1);
      return;
    }
    if (onboardingStep === 1) {
      // Always go to building step - required for Ask Joule
      setOnboardingStep(2);
      return;
    }
    if (onboardingStep === 2) {
      setOnboardingStep(3);
      return;
    }
    if (onboardingStep === 3) {
      setOnboardingStep(4);
    } else if (onboardingStep === 4) {
      completeOnboarding();
    }
  }, [onboardingStep, completeOnboarding]);

  const handleOnboardingSkip = () => {
    // Set minimum required fields for Ask Joule even when skipping
    if (setUserSetting) {
      setUserSetting("squareFeet", squareFeet || 1500);
      setUserSetting("insulationLevel", insulationLevel || 1.0);
      // Set other defaults if missing
      if (!userSettings.primarySystem) {
        setUserSetting("primarySystem", "heatPump");
      }
      if (!userSettings.capacity) {
        setUserSetting("capacity", 36);
        setUserSetting("coolingCapacity", 36);
      }
    }
    completeOnboarding({ navigateHome: false });
  };

  // Auto-advance onboarding step 1 when location is found (only if we just fetched it)
  useEffect(() => {
    // Only auto-advance if we're on step 1 AND we just successfully fetched the weather
    // This prevents auto-advancing on initial load if location is already saved
    if (
      onboardingStep === 1 &&
      foundLocationName &&
      !forecastLoading &&
      showOnboarding &&
      justFetchedWeather
    ) {
      // Auto-advance after a brief delay so user sees the confirmation
      const timer = setTimeout(() => {
        handleOnboardingNext();
        setJustFetchedWeather(false); // Reset the flag
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [
    foundLocationName,
    forecastLoading,
    onboardingStep,
    showOnboarding,
    justFetchedWeather,
    handleOnboardingNext,
  ]);

  // Auto-advance onboarding if Next was clicked before confirming location
  useEffect(() => {
    if (
      autoAdvanceOnboarding &&
      foundLocationName &&
      !forecastLoading &&
      onboardingStep === 1
    ) {
      handleOnboardingNext();
      setAutoAdvanceOnboarding(false);
    }
  }, [
    autoAdvanceOnboarding,
    foundLocationName,
    forecastLoading,
    onboardingStep,
    handleOnboardingNext,
  ]);

  // Generate smart recommendations for AskJoule
  const recommendations = useMemo(() => {
    if (!foundLocationName || !weeklyMetrics) return [];
    const userLocation = {
      city: foundLocationName.split(",")[0],
      state: foundLocationName.split(",")[1]?.trim(),
    };
    const annualEstimate = weeklyMetrics.totalCost
      ? { totalCost: weeklyMetrics.totalCost * 52 }
      : null;
    const allRecs = generateRecommendations(
      userSettings,
      userLocation,
      annualEstimate
    );
    return getTopRecommendations(allRecs, 5);
  }, [foundLocationName, weeklyMetrics, userSettings]);

  // Ask Joule: reveal answer once forecast completes after a query
  const [showAnswerCard, setShowAnswerCard] = useState(true);
  useEffect(() => {
    if (!forecastLoading && foundLocationName && showAnswerCard) {
      // nothing extra to do; AnswerCard consumes computed props
    }
  }, [forecastLoading, foundLocationName, showAnswerCard]);

  // Building details are now REQUIRED in all modes for Ask Joule
  const totalSteps = 4; // Always 4 steps: Welcome, Location, Building/System, Confirmation

  // Calculate baseline cost (constant temperature - no schedule)
  const baselineCost = useMemo(() => {
    if (!adjustedForecast || !getPerformanceAtTemp) return null;
    // Calculate what cost would be if we kept constant temp (daytime temp) all week
    const constantTemp = indoorTemp;
    let baselineTotal = 0;
    adjustedForecast.forEach((hour) => {
      const perf = getPerformanceAtTemp(hour.temp, hour.humidity);
      // Use constant temp for all hours (no schedule)
      const tempDiff = Math.max(0, constantTemp - hour.temp);
      if (tempDiff > 0 && perf.hpKwh !== undefined) {
        // perf.hpKwh is already energy (kWh) for the hour
        const hourlyCost = (perf.hpKwh || 0) * utilityCost;
        baselineTotal += hourlyCost;
      }
    });
    return baselineTotal;
  }, [adjustedForecast, indoorTemp, getPerformanceAtTemp, utilityCost]);

  const savingsVsBaseline = useMemo(() => {
    if (!baselineCost || !weeklyMetrics || !Number.isFinite(baselineCost)) return null;
    const currentCost = energyMode === "cooling" 
      ? weeklyMetrics.totalCost 
      : (breakdownView === "withAux" ? weeklyMetrics.totalCostWithAux : weeklyMetrics.totalCost);
    if (!Number.isFinite(currentCost)) return null;
    const savings = baselineCost - currentCost;
    return Number.isFinite(savings) ? savings : null;
  }, [baselineCost, weeklyMetrics, energyMode, breakdownView]);

  // Determine thermostat mode for SeasonProvider
  const thermostatMode = useMemo(() => {
    if (primarySystem === "gasFurnace") return "heat";
    if (energyMode === "heating") return "heat";
    if (energyMode === "cooling") return "cool";
    return "auto";
  }, [primarySystem, energyMode]);

  // Get current outdoor temp from forecast if available
  const currentOutdoorTemp = useMemo(() => {
    if (adjustedForecast && adjustedForecast.length > 0) {
      return adjustedForecast[0]?.temp;
    }
    return undefined;
  }, [adjustedForecast]);

  // Define inner component that has access to all parent variables via closure
  const SevenDayCostForecasterContent = () => {
    const navigate = useNavigate();
    // Use season context
    const { seasonMode, setSeasonMode, isHeatingView, isCoolingView, autoDetectedMode } = useSeason();

    // Track if schedule is optimized to hide the display section
    const [scheduleOptimized, setScheduleOptimized] = useState(false);

    // Sync season mode with energyMode (one-way: seasonMode → energyMode)
    // Only sync when seasonMode changes from the toggle, not from button clicks
    const prevSeasonModeRef = useRef(seasonMode);
    const isUserClickRef = useRef(false);
    
    useEffect(() => {
      // Skip sync if this was triggered by a user button click
      if (isUserClickRef.current) {
        isUserClickRef.current = false;
        prevSeasonModeRef.current = seasonMode;
        return;
      }
      
      // Only sync if seasonMode changed (user clicked toggle), not if energyMode changed
      if (prevSeasonModeRef.current !== seasonMode) {
        if (seasonMode === "heating" && energyMode !== "heating") {
          setEnergyMode("heating");
        } else if (seasonMode === "cooling" && energyMode !== "cooling") {
          setEnergyMode("cooling");
        } else if (seasonMode === "auto") {
          const detected = autoDetectedMode === "heating" ? "heating" : autoDetectedMode === "cooling" ? "cooling" : energyMode;
          if (detected !== energyMode) {
            setEnergyMode(detected);
          }
        }
        prevSeasonModeRef.current = seasonMode;
      }
    }, [seasonMode, autoDetectedMode, energyMode, setEnergyMode]);

    return (
      <div className="space-y-2">
        {/* Top Row: Weather Alerts and Quick Answer Side-by-Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 auto-rows-fr">
          {/* Enhanced Weather Alerts - Always Visible, Compact */}
          {forecastData && forecastData.length > 0 && (
            <div className="h-full">
              <WeatherAlerts
                forecast={forecastData}
                mode={energyMode}
                electricRate={utilityCost}
                heatLossFactor={heatLossFactor || outlet.heatLossFactor || 200}
                compact
              />
            </div>
          )}

          {/* Quick Answer Section */}
          {showAnswerCard && (
            <div className="h-full">
              <AnswerCard
                loading={forecastLoading}
                location={foundLocationName}
                temp={indoorTemp}
                weeklyCost={(() => {
                  try {
                    if (primarySystem === "gasFurnace") {
                      return weeklyGasMetrics?.totalCost ?? 0;
                    }
                    if (energyMode === "cooling") {
                      return weeklyMetrics?.totalCost ?? 0;
                    }
                    // heating (with/without aux)
                    if (breakdownView === "withAux") {
                      return (
                        weeklyMetrics?.totalCostWithAux ??
                        weeklyMetrics?.totalCost ??
                        0
                      );
                    }
                    return weeklyMetrics?.totalCost ?? 0;
                  } catch {
                    return 0;
                  }
                })()}
                energyMode={energyMode}
                primarySystem={primarySystem}
                roiSavings={roiData?.annualSavings ?? 0}
              />
            </div>
          )}
        </div>

        {/* Modeled Schedule Section - Compact, Always Visible */}
        <div id="schedule">
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-800/90 via-slate-900/90 to-slate-800/90 border border-slate-700/50 rounded-xl p-3 backdrop-blur-sm">
            <div className="relative z-10">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Modeled Schedule (What-If)
                </h2>
                <p className="text-xs text-slate-400 flex items-center gap-0.5 px-1.5 py-1 bg-slate-800/50 rounded border border-slate-700/50">
                  <span>🔒</span>
                  <span>Safe</span>
                </p>
              </div>
            </div>
            
            {/* Simple Temperature and Time Controls - Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
              {/* Daytime Temperature */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-lg blur-xl group-hover:blur-2xl transition-all duration-300" />
                <div className="relative bg-slate-800/50 backdrop-blur-sm border border-yellow-500/20 rounded-lg p-4 hover:border-yellow-500/40 transition-all duration-300">
                  <label className="flex items-center gap-2 text-base font-semibold text-slate-200 mb-3">
                    <Sun className="w-5 h-5 text-yellow-400" />
                    <span>Daytime</span>
                    <span className="ml-auto text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">{indoorTemp}°F</span>
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="85"
                    value={indoorTemp}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setIndoorTemp(value);
                      setUserSetting("indoorTemp", value);
                    }}
                    className="w-full h-2 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-yellow-500 hover:accent-yellow-400 transition-all"
                    style={{
                      background: `linear-gradient(to right, #fbbf24 0%, #fbbf24 ${((indoorTemp - 50) / 35) * 100}%, #374151 ${((indoorTemp - 50) / 35) * 100}%, #374151 100%)`
                    }}
                  />
                  <div className="flex justify-between text-sm text-slate-400 mt-1">
                    <span>50°F</span>
                    <span>85°F</span>
                  </div>
                </div>
              </div>

              {/* Schedule Clock - Combined Daytime and Setback Times */}
              <div className="md:col-span-2 relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-yellow-500/10 to-orange-500/10 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                <div className="relative bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3 hover:border-slate-600/50 transition-all duration-300">
                  <label className="flex items-center gap-1.5 text-base font-semibold text-slate-200 mb-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>Schedule Times</span>
                  </label>
                  <ThermostatScheduleClock
                    daytimeStart={daytimeTime}
                    setbackStart={nighttimeTime}
                    onDaytimeStartChange={(time) => {
                      console.log("Parent: onDaytimeStartChange called with:", time);
                      try {
                        setDaytimeTime(time);
                        console.log("Parent: daytimeTime updated to:", time);
                      } catch (error) {
                        console.error("Parent: Error updating daytimeTime:", error);
                      }
                    }}
                    onSetbackStartChange={(time) => {
                      console.log("Parent: onSetbackStartChange called with:", time);
                      try {
                        setNighttimeTime(time);
                        console.log("Parent: nighttimeTime updated to:", time);
                      } catch (error) {
                        console.error("Parent: Error updating nighttimeTime:", error);
                      }
                    }}
                    compact={true}
                  />
                </div>
              </div>

              {/* Nighttime Temperature */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-lg blur-xl group-hover:blur-2xl transition-all duration-300" />
                <div className="relative bg-slate-800/50 backdrop-blur-sm border border-blue-500/20 rounded-lg p-4 hover:border-blue-500/40 transition-all duration-300">
                  <label className="flex items-center gap-2 text-base font-semibold text-slate-200 mb-3">
                    <Moon className="w-5 h-5 text-blue-400" />
                    <span>Nighttime</span>
                    <span className="ml-auto text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">{nighttimeTemp}°F</span>
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="85"
                    value={nighttimeTemp}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setNighttimeTemp(value);
                      setUserSetting("nighttimeTemp", value);
                    }}
                    className="w-full h-2 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((nighttimeTemp - 50) / 35) * 100}%, #374151 ${((nighttimeTemp - 50) / 35) * 100}%, #374151 100%)`
                    }}
                  />
                  <div className="flex justify-between text-sm text-slate-400 mt-1">
                    <span>50°F</span>
                    <span>85°F</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Single Schedule Summary - Hidden when Already Optimized */}
            {!scheduleOptimized && (
            <div className="mt-2 pt-2 border-t border-slate-700/50">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5 font-semibold">Current Modeled Schedule</div>
                  <div className="text-xs text-slate-200 font-medium bg-slate-900/30 rounded px-2 py-1 border border-slate-700/30">
                    {(() => {
                      const dayMins = timeToMinutes(daytimeTime);
                      const nightMins = timeToMinutes(nighttimeTime);
                      const formatTime = (time) => {
                        const [h, m] = time.split(':').map(Number);
                        const period = h >= 12 ? 'PM' : 'AM';
                        const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
                        return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
                      };
                      
                      // Calculate duration of each period
                      const calculateDuration = (startMins, endMins) => {
                        if (startMins < endMins) {
                          return endMins - startMins;
                        } else {
                          return (24 * 60) - startMins + endMins;
                        }
                      };
                      
                      const dayDuration = calculateDuration(dayMins, nightMins);
                      const nightDuration = calculateDuration(nightMins, dayMins);
                      const dayHours = Math.round(dayDuration / 60 * 10) / 10;
                      const nightHours = Math.round(nightDuration / 60 * 10) / 10;
                      
                      if (dayMins < nightMins) {
                        return (
                          <div className="space-y-0.5">
                            <div className="text-[11px]">{formatTime(daytimeTime)}–{formatTime(nighttimeTime)} at {formatTemperatureFromF(indoorTemp, unitSystem, { decimals: 0 })} <span className="text-slate-400">({dayHours}h)</span></div>
                            <div className="text-[11px]">{formatTime(nighttimeTime)}–{formatTime(daytimeTime)} at {formatTemperatureFromF(nighttimeTemp, unitSystem, { decimals: 0 })} <span className="text-slate-400">({nightHours}h)</span></div>
                          </div>
                        );
                      } else {
                        return (
                          <div className="space-y-0.5">
                            <div className="text-[11px]">{formatTime(nighttimeTime)}–{formatTime(daytimeTime)} at {formatTemperatureFromF(nighttimeTemp, unitSystem, { decimals: 0 })} <span className="text-slate-400">({nightHours}h)</span></div>
                            <div className="text-[11px]">{formatTime(daytimeTime)}–{formatTime(nighttimeTime)} at {formatTemperatureFromF(indoorTemp, unitSystem, { decimals: 0 })} <span className="text-slate-400">({dayHours}h)</span></div>
                          </div>
                        );
                      }
                    })()}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {(() => {
                    // Get cooling setpoints from comfort settings if available
                    let coolDayTemp = null;
                    let coolNightTemp = null;
                    try {
                      const thermostatSettings = loadThermostatSettings();
                      coolDayTemp = thermostatSettings?.comfortSettings?.home?.coolSetPoint;
                      coolNightTemp = thermostatSettings?.comfortSettings?.sleep?.coolSetPoint;
                    } catch {
                      // Ignore errors
                    }
                    
                    return (
                      <OneClickOptimizer
                        currentDayTemp={indoorTemp || 70}
                        currentNightTemp={nighttimeTemp || 68}
                        currentCoolDayTemp={coolDayTemp}
                        currentCoolNightTemp={coolNightTemp}
                        mode={energyMode}
                        weatherForecast={adjustedForecast?.slice(0, 7) || []}
                        electricRate={utilityCost}
                        heatLossFactor={effectiveHeatLoss / 70}
                        hspf2={hspf2 || efficiency}
                        onScheduleOptimized={(isOptimized) => setScheduleOptimized(isOptimized)}
                        onApplySchedule={(schedule) => {
                          setIndoorTemp(schedule.dayTemp);
                          setNighttimeTemp(schedule.nightTemp);
                          if (setUserSetting) {
                            if (energyMode === "heating") {
                              setUserSetting("winterThermostat", schedule.dayTemp);
                              setUserSetting("winterThermostatDay", schedule.dayTemp);
                              setUserSetting("winterThermostatNight", schedule.nightTemp);
                            } else {
                              setUserSetting("summerThermostat", schedule.dayTemp);
                              setUserSetting("summerThermostatNight", schedule.nightTemp);
                            }
                          }
                        }}
                        compact={true}
                      />
                    );
                  })()}
                </div>
              </div>
              <p className="text-[10px] text-slate-400 italic mt-1 flex items-center gap-1">
                <span className="text-yellow-400">💡</span>
                <span><em>Tip:</em> Big night setbacks can trigger strip heat in the morning.</span>
              </p>
            </div>
            )}
            </div>
          </div>
        </div>

        {/* Weekly Forecast Table */}
        {weeklyMetrics && weeklyMetrics.summary && weeklyMetrics.summary.length > 0 && (
          <div>
            <div className="bg-gradient-to-br from-slate-800/90 via-slate-900/90 to-slate-800/90 border border-slate-700/50 rounded-xl shadow-xl p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <BarChart2 className="w-6 h-6 text-blue-400" />
                  Weekly Forecast
                </h3>
              </div>
              
              {/* Weekly Forecast Table Dropdown */}
              <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <button
                  onClick={() => setShowDailyBreakdown(!showDailyBreakdown)}
                  className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg">
                      <BarChart2 size={24} className="text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Daily Breakdown</h3>
                  </div>
                  {showDailyBreakdown ? (
                    <ChevronUp className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                  )}
                </button>
                {showDailyBreakdown && (
                <div className="p-6 pt-0 border-t border-gray-200 dark:border-gray-700">
                  <DailyBreakdownTable
                    summary={weeklyMetrics.summary}
                    indoorTemp={indoorTemp}
                    viewMode={breakdownView === "withAux" ? "withAux" : "noAux"}
                    unitSystem={unitSystem}
                  />
                </div>
                )}
              </div>
              
              {/* Show me the math section */}
              <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <button
                  onClick={() => setShowCalculations(!showCalculations)}
                  className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                      <Calculator size={24} className="text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Show me the math</h3>
                  </div>
                  {showCalculations ? (
                    <ChevronUp className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                  )}
                </button>
                {showCalculations && (
                <div className="p-6 pt-0 space-y-6 border-t border-gray-200 dark:border-gray-700">
                  
                  {/* Building Characteristics */}
                  <div className="border-t border-slate-700/50 pt-4">
                    <h4 className="text-md font-semibold text-gray-200 mb-3">Building Characteristics</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Square Feet:</span>
                          <span className="text-white font-mono">{squareFeet.toLocaleString()} sq ft</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Insulation Level:</span>
                          <span className="text-white font-mono">{insulationLevel.toFixed(2)}x</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Heat Loss Factor:</span>
                          <span className="text-white font-mono">{formatHeatLossFactor(effectiveHeatLoss / 70, unitSystem)}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Design Heat Loss @ 70°F ΔT:</span>
                          <span className="text-white font-mono">{(effectiveHeatLoss / 1000).toFixed(1)}k BTU/hr</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">BTU Loss per °F:</span>
                          <span className="text-white font-mono">{(effectiveHeatLoss / 70).toFixed(1)} BTU/hr/°F</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* System Configuration */}
                  <div className="border-t border-slate-700/50 pt-4">
                    <h4 className="text-md font-semibold text-gray-200 mb-3">System Configuration</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Primary System:</span>
                          <span className="text-white font-mono">{primarySystem === "heatPump" ? "Heat Pump" : primarySystem === "gasFurnace" ? "Gas Furnace" : "Resistance"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Capacity:</span>
                          <span className="text-white font-mono">{capacity}k BTU ({(capacity / 12).toFixed(1)} tons)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">HSPF2:</span>
                          <span className="text-white font-mono">{hspf2}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Electricity Rate:</span>
                          <span className="text-white font-mono">${utilityCost.toFixed(3)}/kWh</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Target Temperature:</span>
                          <span className="text-orange-400 font-mono">{formatTemperatureFromF(indoorTemp, unitSystem, { decimals: 0 })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Night Setback:</span>
                          <span className="text-white font-mono">{formatTemperatureFromF(nighttimeTemp, unitSystem, { decimals: 0 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Weekly Summary */}
                  {weeklyMetrics && (
                    <div className="border-t border-slate-700/50 pt-4">
                      <h4 className="text-md font-semibold text-gray-200 mb-3">📊 Weekly Summary</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 rounded-lg p-3 text-center border border-green-700/50">
                          <div className="text-2xl font-bold text-green-400">${weeklyMetrics.totalCost.toFixed(2)}</div>
                          <div className="text-xs text-gray-400">Total Cost</div>
                        </div>
                        <div className="bg-gradient-to-br from-blue-900/30 to-indigo-900/30 rounded-lg p-3 text-center border border-blue-700/50">
                          <div className="text-2xl font-bold text-blue-400">{formatEnergyFromKwh(weeklyMetrics.totalEnergy, unitSystem, { decimals: 1 })}</div>
                          <div className="text-xs text-gray-400">Total Energy</div>
                        </div>
                        <div className="bg-gradient-to-br from-cyan-900/30 to-teal-900/30 rounded-lg p-3 text-center border border-cyan-700/50">
                          <div className="text-2xl font-bold text-cyan-400">{formatEnergyFromKwh(weeklyMetrics.totalHPEnergy || 0, unitSystem, { decimals: 1 })}</div>
                          <div className="text-xs text-gray-400">Heat Pump</div>
                        </div>
                        <div className="bg-gradient-to-br from-orange-900/30 to-red-900/30 rounded-lg p-3 text-center border border-orange-700/50">
                          <div className="text-2xl font-bold text-orange-400">{formatEnergyFromKwh(weeklyMetrics.totalAuxEnergy || 0, unitSystem, { decimals: 1 })}</div>
                          <div className="text-xs text-gray-400">Aux Heat</div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Auxiliary Heat Analysis */}
                  {weeklyMetrics && weeklyMetrics.summary && (() => {
                    const totalAux = weeklyMetrics.totalAuxEnergy || 0;
                    const totalEnergy = weeklyMetrics.totalEnergy || 0;
                    const auxPercent = totalEnergy > 0 ? (totalAux / totalEnergy * 100) : 0;
                    const daysWithAux = weeklyMetrics.summary.filter(d => (d.auxKwh || 0) > 0.1).length;
                    const auxCost = totalAux * utilityCost;
                    const hpCost = (totalEnergy - totalAux) * utilityCost;
                    
                    return (
                      <div className="border-t border-slate-700/50 pt-4">
                        <h4 className="text-md font-semibold text-gray-200 mb-3">⚡ Auxiliary Heat Analysis</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-600/50">
                            <div className="text-xl font-bold text-orange-400">{auxPercent.toFixed(1)}%</div>
                            <div className="text-xs text-gray-400">Aux Heat Usage</div>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-600/50">
                            <div className="text-xl font-bold text-white">{daysWithAux}</div>
                            <div className="text-xs text-gray-400">Days Using Aux</div>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-600/50">
                            <div className="text-xl font-bold text-orange-400">${auxCost.toFixed(2)}</div>
                            <div className="text-xs text-gray-400">Aux Heat Cost</div>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-600/50">
                            <div className="text-xl font-bold text-blue-400">${hpCost.toFixed(2)}</div>
                            <div className="text-xs text-gray-400">HP Cost</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* Peak Days */}
                  {weeklyMetrics && weeklyMetrics.summary && weeklyMetrics.summary.length > 0 && (
                    <div className="border-t border-slate-700/50 pt-4">
                      <h4 className="text-md font-semibold text-gray-200 mb-3">🔥 Peak Cost Days</h4>
                      <div className="space-y-2">
                        {[...weeklyMetrics.summary]
                          .sort((a, b) => (b.costWithAux || b.dailyCost || 0) - (a.costWithAux || a.dailyCost || 0))
                          .slice(0, 3)
                          .map((day, idx) => (
                            <div key={day.day || idx} className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3 border border-slate-600/50">
                              <div className="flex items-center gap-3">
                                <span className="text-lg">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}</span>
                                <div>
                                  <div className="font-medium text-white">{day.day}</div>
                                  <div className="text-xs text-gray-400">
                                    {day.minTemp !== undefined && day.maxTemp !== undefined 
                                      ? `${formatTemperatureFromF(day.minTemp, unitSystem, { decimals: 0, withUnit: false })} - ${formatTemperatureFromF(day.maxTemp, unitSystem, { decimals: 0 })}`
                                      : `Avg: ${formatTemperatureFromF(day.avgTemp || 35, unitSystem, { decimals: 0 })}`
                                    }
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-green-400">${(day.costWithAux || day.dailyCost || 0).toFixed(2)}</div>
                                <div className="text-xs text-gray-400">{formatEnergyFromKwh(day.totalKwh || day.hpKwh || 0, unitSystem, { decimals: 1 })}</div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Weather Analysis */}
                  {weeklyMetrics && weeklyMetrics.summary && weeklyMetrics.summary.length > 0 && (() => {
                    const temps = weeklyMetrics.summary.map(d => d.avgTemp || ((d.minTemp + d.maxTemp) / 2) || 40);
                    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
                    const minTemps = weeklyMetrics.summary.map(d => d.minTemp || d.avgTemp || 40);
                    const maxTemps = weeklyMetrics.summary.map(d => d.maxTemp || d.avgTemp || 40);
                    const coldestLow = Math.min(...minTemps);
                    const warmestHigh = Math.max(...maxTemps);
                    const coldDays = temps.filter(t => t < 32).length;
                    const heatingDays = temps.filter(t => t < indoorTemp).length;
                    
                    return (
                      <div className="border-t border-slate-700/50 pt-4">
                        <h4 className="text-md font-semibold text-gray-200 mb-3">🌡️ Weather Analysis</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-600/50">
                            <div className="text-xl font-bold text-cyan-400">{formatTemperatureFromF(avgTemp, unitSystem, { decimals: 1 })}</div>
                            <div className="text-xs text-gray-400">Avg Temp</div>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-600/50">
                            <div className="text-xl font-bold text-blue-400">{formatTemperatureFromF(coldestLow, unitSystem, { decimals: 0 })}</div>
                            <div className="text-xs text-gray-400">Coldest Low</div>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-600/50">
                            <div className="text-xl font-bold text-orange-400">{formatTemperatureFromF(warmestHigh, unitSystem, { decimals: 0 })}</div>
                            <div className="text-xs text-gray-400">Warmest High</div>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-600/50">
                            <div className="text-xl font-bold text-white">{heatingDays}</div>
                            <div className="text-xs text-gray-400">Heating Days</div>
                          </div>
                        </div>
                        {coldDays > 0 && (
                          <div className="mt-3 text-sm text-yellow-400">
                            ⚠️ {coldDays} day{coldDays > 1 ? 's' : ''} with freezing temperatures expected
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  
                  {/* Rate Sensitivity */}
                  {weeklyMetrics && (
                    <div className="border-t border-slate-700/50 pt-4">
                      <h4 className="text-md font-semibold text-gray-200 mb-3">💡 Electricity Rate Sensitivity (±20%)</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-green-900/20 rounded-lg p-3 text-center border border-green-700/50">
                          <div className="text-xs text-gray-400 mb-1">At ${(utilityCost * 0.8).toFixed(3)}/kWh (-20%)</div>
                          <div className="text-xl font-bold text-green-400">
                            ${(weeklyMetrics.totalEnergy * utilityCost * 0.8).toFixed(2)}
                          </div>
                          <div className="text-xs text-green-400">
                            Save ${(weeklyMetrics.totalEnergy * utilityCost * 0.2).toFixed(2)}
                          </div>
                        </div>
                        <div className="bg-blue-900/20 rounded-lg p-3 text-center border border-blue-700/50">
                          <div className="text-xs text-gray-400 mb-1">Current Rate ${utilityCost.toFixed(3)}/kWh</div>
                          <div className="text-xl font-bold text-white">${weeklyMetrics.totalCost.toFixed(2)}</div>
                        </div>
                        <div className="bg-red-900/20 rounded-lg p-3 text-center border border-red-700/50">
                          <div className="text-xs text-gray-400 mb-1">At ${(utilityCost * 1.2).toFixed(3)}/kWh (+20%)</div>
                          <div className="text-xl font-bold text-red-400">
                            ${(weeklyMetrics.totalEnergy * utilityCost * 1.2).toFixed(2)}
                          </div>
                          <div className="text-xs text-red-400">
                            +${(weeklyMetrics.totalEnergy * utilityCost * 0.2).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Example Day Calculation */}
                  {weeklyMetrics && weeklyMetrics.summary && weeklyMetrics.summary.length > 0 && (() => {
                    // Pick the coldest day as the example
                    const temps = weeklyMetrics.summary.map(d => d.avgTemp || ((d.minTemp + d.maxTemp) / 2) || 40);
                    const coldestIdx = temps.indexOf(Math.min(...temps));
                    const exampleDay = weeklyMetrics.summary[coldestIdx];
                    const exampleAvgTemp = exampleDay.avgTemp || ((exampleDay.minTemp + exampleDay.maxTemp) / 2) || 35;
                    const deltaT = indoorTemp - exampleAvgTemp;
                    const heatLossBtuHr = (effectiveHeatLoss / 70) * deltaT;
                    
                    return (
                      <div className="border-t border-slate-700/50 pt-4">
                        <h4 className="text-md font-semibold text-gray-200 mb-3">🧮 Example Day Calculation ({exampleDay.day} - coldest day)</h4>
                        <div className="bg-slate-900/50 rounded-lg p-4 text-sm space-y-2 font-mono">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Avg Outdoor Temp:</span>
                            <span className="text-cyan-400">{formatTemperatureFromF(exampleAvgTemp, unitSystem, { decimals: 1 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Target Indoor Temp:</span>
                            <span className="text-orange-400">{formatTemperatureFromF(indoorTemp, unitSystem, { decimals: 0 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Temperature Difference (ΔT):</span>
                            <span className="text-white">{deltaT.toFixed(1)}°F</span>
                          </div>
                          <div className="h-px bg-slate-700 my-2"></div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Heat Loss Rate:</span>
                            <span className="text-white">{(heatLossBtuHr / 1000).toFixed(1)}k BTU/hr</span>
                          </div>
                          <div className="text-xs text-gray-500 ml-4">
                            = {(effectiveHeatLoss / 70).toFixed(1)} BTU/hr/°F × {deltaT.toFixed(1)}°F
                          </div>
                          <div className="h-px bg-slate-700 my-2"></div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Daily Energy:</span>
                            <span className="text-blue-400">{formatEnergyFromKwh(exampleDay.totalKwh || exampleDay.hpKwh || 0, unitSystem, { decimals: 1 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Daily Cost:</span>
                            <span className="text-green-400 font-bold">${(exampleDay.costWithAux || exampleDay.dailyCost || 0).toFixed(2)}</span>
                          </div>
                          <div className="text-xs text-gray-500 ml-4">
                            = {(exampleDay.totalKwh || exampleDay.hpKwh || 0).toFixed(1)} kWh × ${utilityCost.toFixed(3)}/kWh
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  
                </div>
                )}
              </div>
              
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <SeasonProvider 
      thermostatMode={thermostatMode}
      outdoorTemp={currentOutdoorTemp}
      defaultMode="auto"
    >
      <SevenDayCostForecasterContent />
    </SeasonProvider>
  );
};

export default SevenDayCostForecaster;
