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
import DailyBreakdownTable from "./heatpump/DailyBreakdownTable";
import {
  fetchLiveElectricityRate,
  fetchLiveGasRate,
  getStateCode,
} from "../lib/eiaRates";
import { getCustomHeroUrl } from "../lib/userImages";
import ThermostatScheduleCard from "../components/ThermostatScheduleCard";
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
  const indoorTemp =
    Number(userSettings?.indoorTemp ?? userSettings?.winterThermostat) ||
    Number(userSettings?.winterThermostat) ||
    70;

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


  // State for nighttime temperature
  const [nighttimeTemp, setNighttimeTemp] = useState(() => {
    try {
      const thermostatSettings = loadThermostatSettings();
      return thermostatSettings?.comfortSettings?.sleep?.heatSetPoint || 65;
    } catch {
      return 65;
    }
  });

  // Away mode state: tracks which days are in away mode (keyed by date string)
  const [awayModeDays, setAwayModeDays] = useState(() => {
    try {
      const stored = localStorage.getItem("forecastAwayModeDays");
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch {
      // Ignore errors
    }
    return new Set();
  });

  // Save away mode days to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("forecastAwayModeDays", JSON.stringify(Array.from(awayModeDays)));
    } catch {
      // Ignore errors
    }
  }, [awayModeDays]);

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
      const sleepTemp = thermostatSettings?.comfortSettings?.sleep?.heatSetPoint;
      if (sleepTemp !== undefined) setNighttimeTemp(sleepTemp);
    } catch {
      // ignore
    }
  }, []);

  // Listen for thermostat settings updates
  useEffect(() => {
    const handleSettingsUpdate = (e) => {
      try {
        const thermostatSettings = loadThermostatSettings();
        if (e.detail?.comfortSettings?.sleep?.heatSetPoint !== undefined) {
          setNighttimeTemp(thermostatSettings?.comfortSettings?.sleep?.heatSetPoint || 65);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("thermostatSettingsUpdated", handleSettingsUpdate);
    return () => {
      window.removeEventListener("thermostatSettingsUpdated", handleSettingsUpdate);
    };
  }, []);

  // Helper to convert time string to minutes since midnight
  const timeToMinutes = useCallback((time) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }, []);

  // Get energyMode early so it can be used in getIndoorTempForHour
  const energyMode = userSettings?.energyMode || "heating";

  // Get schedule-aware indoor temperature for a given hour
  // Uses dual-period logic: daytime starts at daytimeTime, nighttime starts at nighttimeTime
  // Also checks away mode: if the day is in away mode, uses away temperatures
  const getIndoorTempForHour = useCallback((hourDate) => {
    try {
      const thermostatSettings = loadThermostatSettings();
      
      // Check if this day is in away mode
      const dayString = hourDate.toLocaleDateString();
      const isAwayMode = awayModeDays.has(dayString);
      
      if (isAwayMode) {
        // Use away mode temperatures
        if (energyMode === "heating") {
          return thermostatSettings?.comfortSettings?.away?.heatSetPoint || 62;
        } else {
          return thermostatSettings?.comfortSettings?.away?.coolSetPoint || 85;
        }
      }
      
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
        return thermostatSettings?.comfortSettings?.sleep?.heatSetPoint || nighttimeTemp || 65;
      } else {
        // Use daytime temperature
        return indoorTemp;
      }
    } catch {
      // Fallback to daytime temp if schedule can't be loaded
      return indoorTemp;
    }
  }, [daytimeTime, nighttimeTime, indoorTemp, nighttimeTemp, timeToMinutes, awayModeDays, energyMode]);
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
    
    // Priority 3: Calculated from Building Characteristics (DoE data)
    if (useCalculatedHeatLoss) {
      try {
        const BASE_BTU_PER_SQFT_HEATING = 22.67; // empirical typical value
        const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
        const designHeatLoss =
          (squareFeet || 1500) *
          BASE_BTU_PER_SQFT_HEATING *
          (insulationLevel || 1.0) *
          (homeShape || 1.0) *
          ceilingMultiplier;
        return designHeatLoss; // BTU/hr at ~70°F delta
      } catch (e) {
        console.warn("Calculated heat loss computation failed", e);
      }
    }
    
    // Fallback: If explicit heatLoss stored in context, use it
    if (typeof heatLoss === "number" && heatLoss > 0) {
      return heatLoss;
    }
    
    // Final fallback: approximate design heat loss
    try {
      const BASE_BTU_PER_SQFT_HEATING = 22.67;
      const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
      const designHeatLoss =
        (squareFeet || 1500) *
        BASE_BTU_PER_SQFT_HEATING *
        (insulationLevel || 1.0) *
        (homeShape || 1.0) *
        ceilingMultiplier;
      return designHeatLoss;
    } catch (e) {
      console.warn("Fallback heat loss computation failed", e);
      return 0;
    }
  }, [
    userSettings?.useManualHeatLoss,
    userSettings?.useCalculatedHeatLoss,
    userSettings?.useAnalyzerHeatLoss,
    userSettings?.manualHeatLoss,
    userSettings?.analyzerHeatLoss, // Added: analyzer heat loss from userSettings
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
          heatLossBtu: safeEffectiveHeatLoss,
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
        heatLossBtu: safeEffectiveHeatLoss,
        compressorPower: safeCompressorPower,
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
        await fetchUtilityRate(
          finalStateName,
          setUtilityCost,
          setElectricityRateSource,
          "electricity"
        );
        await fetchUtilityRate(
          finalStateName,
          setGasCost,
          setGasRateSource,
          "gas"
        );
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
          totalGasCost: null, // 7-Day Forecaster doesn't calculate gas cost
          totalSavings: null,
          estimatedAnnualSavings: null,
          timestamp: Date.now(),
          // Include daily summary for Ask Joule access
          dailySummary: weeklyMetrics.summary || [],
        };
        localStorage.setItem("last_forecast_summary", JSON.stringify(payload));
      } catch {
        /* ignore persistence errors */
      }
    }
  }, [weeklyMetrics, foundLocationName]);

  const manualDayMetrics = useMemo(() => {
    const perf = getPerformanceAtTemp(manualTemp, manualHumidity);

    const electricalKw =
      typeof perf?.electricalKw === "number" ? perf.electricalKw : NaN;
    const runtime = typeof perf?.runtime === "number" ? perf.runtime : NaN;
    const hourlyEnergy =
      Number.isFinite(electricalKw) && Number.isFinite(runtime)
        ? electricalKw * (runtime / 100)
        : NaN;
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
        const energyForHour = perf.electricalKw * (perf.runtime / 100);
        const auxEnergyForHour = perf.auxKw;
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
        heatLossBtu: safeHeatLoss,
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
        if (navigateHome) navigate("/");
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
      if (tempDiff > 0 && perf.runtime > 0) {
        const duty = Math.min(100, Math.max(0, perf.runtime));
        const hourlyCost = perf.electricalKw * (duty / 100) * utilityCost;
        baselineTotal += hourlyCost;
      }
    });
    return baselineTotal;
  }, [adjustedForecast, indoorTemp, getPerformanceAtTemp, utilityCost]);

  const savingsVsBaseline = useMemo(() => {
    if (!baselineCost || !weeklyMetrics) return null;
    const currentCost = energyMode === "cooling" 
      ? weeklyMetrics.totalCost 
      : (breakdownView === "withAux" ? weeklyMetrics.totalCostWithAux : weeklyMetrics.totalCost);
    return baselineCost - currentCost;
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
    // Use season context
    const { seasonMode, setSeasonMode, isHeatingView, isCoolingView, autoDetectedMode } = useSeason();

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
      <div className="min-h-screen bg-[#0C0F14]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Page Header - Clear Hierarchy */}
        <div className="mb-10">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-[32px] font-semibold text-[#FFFFFF] mb-2">
                {isHeatingView && !isCoolingView
                  ? "Heating Load Forecast"
                  : isCoolingView && !isHeatingView
                  ? "Cooling Load Forecast"
                  : isHeatingView && isCoolingView
                  ? "Comfort & Efficiency Forecast"
                  : energyMode === "heating"
                  ? "Heating Load Forecast"
                  : energyMode === "cooling"
                  ? "Cooling Load Forecast"
                  : "Comfort & Efficiency Forecast"}
              </h1>
              <p className="text-base text-[#A7B0BA] leading-relaxed">
                {isHeatingView && !isCoolingView
                  ? "Set your schedule and see how it affects your heating costs."
                  : isCoolingView && !isHeatingView
                  ? "Set your schedule and see how it affects your cooling costs."
                  : isHeatingView && isCoolingView
                  ? "Set your schedule and see how it affects your heating and cooling costs."
                  : energyMode === "heating"
                  ? "Set your schedule and see how it affects your heating costs."
                  : energyMode === "cooling"
                  ? "Set your schedule and see how it affects your cooling costs."
                  : "Set your schedule and see how it affects your energy costs."}
              </p>
              
              {/* Section Navigation */}
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <a href="#summary" className="text-[#1E4CFF] hover:text-[#1a3fcc] transition-colors">Summary</a>
                <span className="text-[#7C8894]">·</span>
                <a href="#schedule" className="text-[#1E4CFF] hover:text-[#1a3fcc] transition-colors">Schedule</a>
                <span className="text-[#7C8894]">·</span>
                <a href="#daily-breakdown" className="text-[#1E4CFF] hover:text-[#1a3fcc] transition-colors">Daily breakdown</a>
                <span className="text-[#7C8894]">·</span>
                <a href="#assumptions" className="text-[#1E4CFF] hover:text-[#1a3fcc] transition-colors">Assumptions & config</a>
                <span className="text-[#7C8894]">·</span>
                <a href="#calculations" className="text-[#1E4CFF] hover:text-[#1a3fcc] transition-colors">Calculations</a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Compact Ask Joule */}
              <div className="relative">
                <button
                  onClick={() => {
                    const panel = document.getElementById('compact-ask-joule');
                    if (panel) {
                      panel.classList.toggle('hidden');
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#151A21] border border-[#222A35] rounded-lg hover:bg-[#1D232C] transition-colors"
                  title="Ask Joule AI Assistant"
                >
                  <Zap size={16} className="text-[#1E4CFF]" />
                  <span className="text-sm text-[#E8EDF3]">Ask Joule</span>
                </button>
                <div id="compact-ask-joule" className="hidden absolute top-full right-0 mt-2 w-96 bg-[#151A21] border border-[#222A35] rounded-xl p-4 z-50 shadow-xl">
                  <AskJoule
                    hasLocation={!!foundLocationName}
                    disabled={false}
                    userSettings={userSettings}
                    userLocation={
                      foundLocationName
                        ? {
                            city: foundLocationName.split(",")[0],
                            state: foundLocationName.split(",")[1]?.trim(),
                            elevation: locationElevation,
                          }
                        : null
                    }
                    annualEstimate={
                      weeklyMetrics
                        ? {
                            totalCost: weeklyMetrics.totalCost * 52,
                            heatingCost: weeklyMetrics.totalCost * 52 * 0.7,
                            coolingCost: weeklyMetrics.totalCost * 52 * 0.3,
                          }
                        : null
                    }
                    recommendations={recommendations}
                    onNavigate={(path) => {
                      if (path) navigate(path);
                    }}
                    onSettingChange={(key, value, meta = {}) => {
                      if (typeof setUserSetting === "function") {
                        setUserSetting(key, value, {
                          ...meta,
                          source: meta?.source || "AskJoule",
                        });
                      } else {
                        if (key === "winterThermostat") setIndoorTemp(value);
                        if (key === "summerThermostat") setIndoorTemp(value);
                      }
                    }}
                    auditLog={outlet.auditLog}
                    onUndo={(id) => outlet.undoChange && outlet.undoChange(id)}
                    onParsed={(params) => {
                      const {
                        cityName,
                        squareFeet,
                        insulationLevel,
                        indoorTemp,
                        primarySystem,
                      } = params || {};
                      try {
                        if (typeof squareFeet === "number")
                          setSquareFeet(squareFeet);
                        if (typeof insulationLevel === "number")
                          setInsulationLevel(insulationLevel);
                        if (typeof indoorTemp === "number")
                          setIndoorTemp(indoorTemp);
                        if (
                          primarySystem === "heatPump" ||
                          primarySystem === "gasFurnace"
                        )
                          setPrimarySystem(primarySystem);
                      } catch {
                        /* Intentionally empty */
                      }
                      if (cityName && cityName !== (ui?.cityName || "")) {
                        dispatch({
                          type: "SET_LOCATION_FIELD",
                          field: "cityName",
                          value: cityName,
                        });
                        setAutoAdvanceOnboarding(false);
                        handleCitySearch();
                      }
                      setShowAnswerCard(true);
                    }}
                  />
                </div>
              </div>
              
              {/* Mode Toggle */}
              <div id="energy-mode-toggle" className="inline-flex rounded-lg border border-[#222A35] overflow-hidden">
                <button
                  onClick={() => {
                    isUserClickRef.current = true; // Mark as user click to prevent sync loop
                    setEnergyMode("heating");
                    setSeasonMode("heating"); // Update both directly
                  }}
                  className={`px-4 py-2 text-sm font-medium flex items-center gap-2 transition-colors ${
                    energyMode === "heating"
                      ? "bg-[#1E4CFF] text-white"
                      : "bg-[#151A21] text-[#A7B0BA] hover:bg-[#1D232C]"
                  }`}
                >
                  <Flame size={16} /> Heating
                </button>
                <button
                  onClick={() => {
                    isUserClickRef.current = true; // Mark as user click to prevent sync loop
                    setEnergyMode("cooling");
                    setSeasonMode("cooling"); // Update both directly
                  }}
                  className={`px-4 py-2 text-sm font-medium flex items-center gap-2 transition-colors ${
                    energyMode === "cooling"
                      ? "bg-[#1E4CFF] text-white"
                      : "bg-[#151A21] text-[#A7B0BA] hover:bg-[#1D232C]"
                  }`}
                >
                  <ThermometerSun size={16} /> Cooling
                </button>
              </div>
            </div>
          </div>

        {/* Hidden off-screen share card for image generation */}
        <div style={{ position: "fixed", top: "-9999px", left: "-9999px" }}>
          {roiData && (
            <ShareableSavingsCard
              savings={roiData.annualSavings}
              location={foundLocationName}
            />
          )}
        </div>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}

        {/* Card A - This week at a glance - Show right after section navigation, before schedule */}
        {weeklyMetrics && !forecastLoading && !forecastError && foundLocationName && (
          <div id="summary" className="mb-10">
            <div className="bg-[#151A21] border border-[#222A35] rounded-xl p-8">
              <h2 className="text-xl font-semibold text-[#E8EDF3] mb-6">Next 7 days – {energyMode === "cooling" ? "Cooling" : "Heating"} cost forecast</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                {/* Daily Cost - Primary Metric */}
                <div>
                  <div className="text-[56px] font-semibold text-[#FFFFFF] leading-none mb-2">
                    $
                    {((energyMode === "cooling"
                        ? (weeklyMetrics?.totalCost ?? 0)
                        : primarySystem === "gasFurnace"
                        ? (weeklyGasMetrics?.totalCost ?? 0)
                        : (breakdownView === "withAux"
                            ? weeklyMetrics.totalCostWithAux
                            : weeklyMetrics.totalCost
                          )) / 7).toFixed(2)}
                  </div>
                  <div className="text-lg text-[#A7B0BA] mb-1">/day</div>
                  <div className="text-sm text-[#7C8894]">Estimated average over the next 7 days</div>
                </div>
                
                {/* Daily Energy - Secondary Metric */}
                <div>
                  <div className="text-[36px] font-semibold text-[#FFFFFF] mb-2">
                    {(() => {
                      const dailyKWh = (
                        energyMode === "cooling"
                          ? (weeklyMetrics?.totalEnergy ?? 0)
                          : primarySystem === "gasFurnace"
                          ? (weeklyGasMetrics?.totalTherms ?? 0) * 29.3 // Convert therms to kWh for display
                          : (breakdownView === "withAux"
                              ? weeklyMetrics.summary.reduce(
                                  (acc, d) => acc + d.energyWithAux,
                                  0
                                )
                              : weeklyMetrics.totalEnergy
                            )
                      ) / 7;
                      if (primarySystem === "gasFurnace") {
                        return `${(dailyKWh / 29.3).toFixed(2)} therms / day`;
                      }
                      // Use international unit system formatting, or nerd mode if enabled
                      const energyDisplayMode = isNerdMode ? "nerd" : "user";
                      if (energyDisplayMode === "nerd") {
                        return formatEnergyFromKwh(dailyKWh, "intl", { decimals: 1 }) + " / day";
                      }
                      return formatEnergy(kWhToJ(dailyKWh), { mode: "user", precision: 1 }) + " / day";
                    })()}
                  </div>
                  <div className="text-base text-[#A7B0BA] mb-1">
                    {/* Unit indicator - empty for now */}
                  </div>
                  <div className="text-sm text-[#7C8894]">Estimated {primarySystem === "gasFurnace" ? "gas" : "electric"} usage ({primarySystem === "gasFurnace" ? "gas" : "heat pump only"})</div>
                </div>
              </div>
              
              {/* In plain English paragraph */}
              <div className="mt-6 pt-6 border-t border-[#222A35]">
                <p className="text-sm text-[#A7B0BA] leading-relaxed">
                  {(() => {
                    const dailyCost = (energyMode === "cooling"
                      ? (weeklyMetrics?.totalCost ?? 0)
                      : primarySystem === "gasFurnace"
                      ? (weeklyGasMetrics?.totalCost ?? 0)
                      : (breakdownView === "withAux"
                          ? weeklyMetrics.totalCostWithAux
                          : weeklyMetrics.totalCost
                        )) / 7;
                    const weeklyCost = dailyCost * 7;
                    return `Based on your schedule, system size, and the 7-day weather forecast, you'll spend about $${dailyCost.toFixed(2)} per day ($${weeklyCost.toFixed(2)} this week) on ${energyMode === "cooling" ? "cooling" : "heating"}.`;
                  })()}
                  {savingsVsBaseline !== null && savingsVsBaseline > 0 && (
                    <span className="block mt-2 text-[#1E4CFF]">
                      Your schedule saves you ${(savingsVsBaseline / 7).toFixed(2)}/day vs keeping a constant {formatTemperatureFromF(indoorTemp, unitSystem, { decimals: 0 })}.
                    </span>
                  )}
                </p>
              </div>
              
              {/* Location - Inline with Summary */}
              {foundLocationName && (
                <div className="mt-6 pt-6 border-t border-[#222A35] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin size={18} className="text-[#1E4CFF]" />
                    <div>
                      <div className="text-sm font-medium text-[#E8EDF3]">
                        {foundLocationName}
                        {locationElevation > 0 && (
                          <span className="ml-2 text-[#7C8894] font-normal">
                            ({locationElevation.toLocaleString()} ft)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setOnboardingStep(1);
                      setShowOnboarding(true);
                    }}
                    className="text-sm text-[#1E4CFF] hover:text-[#1a3fcc] font-medium"
                  >
                    Change Location
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Card B - Your schedule & daily breakdown */}
        <div className="mb-10" id="schedule">
          <div className="bg-[#151A21] border border-[#222A35] rounded-xl p-8">
            <div className="mb-6">
              <h2 className="text-[24px] font-medium text-[#E8EDF3] mb-2">Your schedule</h2>
              <p className="text-sm text-[#A7B0BA]">
                This is the thermostat schedule we'll use for the forecast. Adjust it here, or match what you're really running.
              </p>
            </div>
            
            <ThermostatScheduleCard
              indoorTemp={indoorTemp}
              daytimeTime={daytimeTime}
              nighttimeTime={nighttimeTime}
              nighttimeTemp={nighttimeTemp}
              onDaytimeTimeChange={setDaytimeTime}
              onNighttimeTimeChange={setNighttimeTime}
              onNighttimeTempChange={setNighttimeTemp}
              onIndoorTempChange={setIndoorTemp}
              setUserSetting={setUserSetting}
            />
            
            {/* Single Schedule Summary - No Duplication */}
            <div className="mt-6 pt-6 border-t border-[#222A35]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-[#7C8894] mb-2">Current Schedule</div>
                  <div className="text-base text-[#E8EDF3] font-medium">
                    {(() => {
                      const dayMins = timeToMinutes(daytimeTime);
                      const nightMins = timeToMinutes(nighttimeTime);
                      const formatTime = (time) => {
                        const [h, m] = time.split(':').map(Number);
                        const period = h >= 12 ? 'PM' : 'AM';
                        const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
                        return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
                      };
                      
                      if (dayMins < nightMins) {
                        return `${formatTime(daytimeTime)}–${formatTime(nighttimeTime)} at ${formatTemperatureFromF(indoorTemp, unitSystem, { decimals: 0 })} • ${formatTime(nighttimeTime)}–${formatTime(daytimeTime)} at ${formatTemperatureFromF(nighttimeTemp, unitSystem, { decimals: 0 })}`;
                      } else {
                        return `${formatTime(daytimeTime)}–${formatTime(nighttimeTime)} at ${formatTemperatureFromF(indoorTemp, unitSystem, { decimals: 0 })} • ${formatTime(nighttimeTime)}–${formatTime(daytimeTime)} at ${formatTemperatureFromF(nighttimeTemp, unitSystem, { decimals: 0 })}`;
                      }
                    })()}
                  </div>
                </div>
                <button
                  onClick={() => {
                    const currentMonth = new Date().getMonth() + 1;
                    const isHeatingSeason = currentMonth >= 10 || currentMonth <= 4;
                    
                    if (isHeatingSeason || energyMode === "heating") {
                      setIndoorTemp(70);
                      setNighttimeTemp(68);
                      setUserSetting("winterThermostat", 70);
                      setUserSetting("summerThermostat", 76);
                    } else {
                      setIndoorTemp(76);
                      setNighttimeTemp(78);
                      setUserSetting("summerThermostat", 76);
                      setUserSetting("winterThermostat", 70);
                    }
                  }}
                  className="px-4 py-2 bg-[#1E4CFF] hover:bg-[#1a3fcc] text-white rounded-lg font-medium text-sm transition-colors"
                >
                  Apply Smart Baseline
                </button>
              </div>
              <p className="text-xs text-[#7C8894] italic mt-3">
                <em>Tip:</em> Big night setbacks on heat pumps can trigger strip heat in the morning.
              </p>
            </div>
          </div>
        </div>

        {/* Daily Breakdown Section - Part of Card B */}
        <div id="daily-breakdown" className="mb-10">
        </div>

        {showAnswerCard && (
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
          )}
        </div>

        {/* First-Time User Onboarding - Extracted Component */}
        <OnboardingWizard
          show={showOnboarding}
          onSkip={handleOnboardingSkip}
          onComplete={completeOnboarding}
          currentStep={onboardingStep}
          setStep={setOnboardingStep}
          totalSteps={totalSteps}
          hvacSubstep={hvacSubstep}
          setHvacSubstep={setHvacSubstep}
          autoAdvanceOnboarding={autoAdvanceOnboarding}
          setAutoAdvanceOnboarding={setAutoAdvanceOnboarding}
          cityName={cityName}
          setCityName={(value) => dispatch({ type: "SET_LOCATION_FIELD", field: "cityName", value })}
          foundLocationName={foundLocationName}
          onCitySearch={handleCitySearch}
          forecastLoading={forecastLoading}
          dispatch={dispatch}
          ui={ui}
          squareFeet={squareFeet}
          setSquareFeet={setSquareFeet}
          homeShape={homeShape}
          setHomeShape={setHomeShape}
          ceilingHeight={ceilingHeight}
          setCeilingHeight={setCeilingHeight}
          insulationLevel={insulationLevel}
          setInsulationLevel={setInsulationLevel}
          globalHomeElevation={globalHomeElevation}
          setHomeElevation={setHomeElevation}
          primarySystem={primarySystem}
          setPrimarySystem={setPrimarySystem}
          capacity={capacity}
          setCapacity={setCapacity}
          efficiency={efficiency}
          setEfficiency={setEfficiency}
          hspf2={hspf2}
          setHspf2={setHspf2}
          afue={afue}
          setAfue={setAfue}
          coolingSystem={coolingSystem}
          setCoolingSystem={setCoolingSystem}
          coolingCapacity={coolingCapacity}
          setCoolingCapacity={setCoolingCapacity}
          groqApiKey={groqApiKey}
          setGroqApiKey={setGroqApiKey}
          welcomeTheme={welcomeTheme}
          customHeroUrl={customHeroUrl}
          utilityCost={utilityCost}
          gasCost={gasCost}
          onNext={handleOnboardingNext}
          onBack={() => setOnboardingStep(Math.max(0, onboardingStep - 1))}
        />

        {/* ONBOARDING: Extracted to OnboardingWizard component
            See: src/features/forecaster/components/OnboardingWizard.jsx 
            ~700 lines of inline JSX removed during refactoring */}

        {/* Detailed Forecast Section - Only show if location is set */}
        {!foundLocationName ? (
          <div className="mb-10 bg-[#151A21] border border-[#222A35] rounded-xl p-12 text-center">
            <div className="text-5xl mb-4">ðŸ“</div>
            <h3 className="text-xl font-medium text-[#E8EDF3] mb-3">
              Get Your First Forecast
            </h3>
            <p className="text-sm text-[#A7B0BA] mb-6 max-w-md mx-auto">
              Set your location to see accurate weather-based cost estimates.
            </p>
            <button
              onClick={() => {
                setOnboardingStep(0);
                setShowOnboarding(true);
              }}
              className="px-6 py-3 bg-[#1E4CFF] hover:bg-[#1a3fcc] text-white rounded-lg font-medium transition-colors"
            >
              Set Location
            </button>
          </div>
        ) : (
          <div className="mb-10">
            {/* Tabs for Forecast vs Custom Scenario */}
            <div className="flex gap-2 mb-6 border-b border-[#222A35]">
              <button
                onClick={() =>
                  dispatch({
                    type: "SET_UI_FIELD",
                    field: "activeTab",
                    value: "forecast",
                  })
                }
                className={`px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === "forecast"
                    ? "text-[#1E4CFF] border-b-2 border-[#1E4CFF]"
                    : "text-[#A7B0BA] hover:text-[#E8EDF3]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Calendar size={16} />
                  7-Day Forecast
                </div>
              </button>
              <button
                onClick={() =>
                  dispatch({
                    type: "SET_UI_FIELD",
                    field: "activeTab",
                    value: "manual",
                  })
                }
                className={`px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === "manual"
                    ? "text-[#1E4CFF] border-b-2 border-[#1E4CFF]"
                    : "text-[#A7B0BA] hover:text-[#E8EDF3]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Settings size={16} />
                  Custom Scenario
                </div>
              </button>
            </div>
            
            {activeTab === "forecast" && (
              <div>
              {/* STEP 1: Configure Your Forecast (Inputs Section) - REMOVED (was dead code with `foundLocationName && false`) */}

              {/* Loading State */}
              {forecastLoading && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="text-gray-600 mt-2">
                    Loading location and weather data...
                  </p>
                </div>
              )}
              {forecastError && (
                <p className="text-red-600 font-semibold p-4 bg-red-50 rounded border border-red-200">
                  {forecastError}
                </p>
              )}

              {/* Weather Anomaly Alerts */}
              {weatherAnomalies && weatherAnomalies.hasAnomaly && (
                <div className="mb-6 space-y-3">
                  {weatherAnomalies.anomalies.map((anomaly, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg border-2 ${
                        anomaly.severity === 'extreme'
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-400 dark:border-red-600'
                          : anomaly.severity === 'high'
                          ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-400 dark:border-orange-600'
                          : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400 dark:border-yellow-600'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle
                          className={`flex-shrink-0 mt-0.5 ${
                            anomaly.severity === 'extreme'
                              ? 'text-red-600 dark:text-red-400'
                              : anomaly.severity === 'high'
                              ? 'text-orange-600 dark:text-orange-400'
                              : 'text-yellow-600 dark:text-yellow-400'
                          }`}
                          size={20}
                        />
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900 dark:text-white mb-1">
                            {anomaly.title}
                          </h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                            {anomaly.description}
                          </p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            ðŸ’° {anomaly.impact}
                          </p>
                          {anomaly.startDate && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                              Starts: {new Date(anomaly.startDate).toLocaleDateString()} • Duration: {anomaly.duration}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {weatherAnomalies.warnings.map((warning, idx) => (
                    <div
                      key={`warning-${idx}`}
                      className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700"
                    >
                      <div className="flex items-start gap-2">
                        <HelpCircle className="flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" size={18} />
                        <div>
                          <p className="font-semibold text-sm text-gray-900 dark:text-white mb-1">
                            {warning.title}
                          </p>
                          <p className="text-xs text-gray-700 dark:text-gray-300">
                            {warning.description} {warning.impact}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {weeklyMetrics && !forecastLoading && !forecastError && (
                <div>
                  {/* Cost cards moved to top - removed duplicates here */}

                  {/* ROI Widget (only for heat pump mode AND heating mode) */}
                  {primarySystem === "heatPump" &&
                    energyMode === "heating" &&
                    roiData &&
                    roiData.annualSavings > 0 && (
                      <div className="relative bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100 dark:from-purple-900 dark:via-pink-900 dark:to-purple-950 border-2 border-purple-400 dark:border-purple-600 rounded-2xl p-6 mb-6 shadow-xl hover:shadow-2xl transition-all duration-300 card-lift group">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-purple-100 dark:bg-purple-800 rounded-lg">
                            <TrendingDown
                              size={24}
                              className="text-purple-600 dark:text-purple-400"
                            />
                          </div>
                          <h3 className="text-xs font-bold text-gray-800 dark:text-gray-100 uppercase tracking-widest">
                            Annual Savings vs Gas Heat
                          </h3>
                        </div>
                        <div className="flex items-baseline gap-4 mb-4">
                          <p className="text-5xl md:text-6xl font-black bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent animate-count-up">
                            ${roiData.annualSavings.toFixed(0)}
                          </p>
                          <div>
                            <p className="text-xl font-bold text-purple-700 dark:text-purple-300">
                              /yr
                            </p>
                            <p className="text-sm text-purple-600 dark:text-purple-400 font-semibold">
                              ({roiData.savingsPercent.toFixed(0)}% lower)
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 backdrop-blur-sm">
                            <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold uppercase tracking-wide">
                              Heat Pump
                            </p>
                            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                              ${roiData.annualHeatPumpCost.toFixed(0)}/yr
                            </p>
                          </div>
                          <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 backdrop-blur-sm">
                            <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold uppercase tracking-wide">
                              Gas Heat
                            </p>
                            <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                              ${roiData.annualGasCost.toFixed(0)}/yr
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                          Based on {roiData.annualHDD.toLocaleString()} annual
                          HDD (30-year climate average)
                        </p>
                        <div className="absolute top-4 right-4">
                          <button
                            onClick={async () => {
                              try {
                                const el =
                                  document.getElementById("share-card");
                                if (!el) {
                                  setTimeout(async () => {
                                    const node =
                                      document.getElementById("share-card");
                                    if (!node) return;
                                    const html2canvas = await loadHtml2Canvas();
                                    const canvas = await html2canvas(node, {
                                      useCORS: true,
                                      backgroundColor: null,
                                      scale: 1,
                                    });
                                    const url = canvas.toDataURL("image/png");
                                    setGeneratedImage(url);
                                    setShowShareModal(true);
                                  }, 0);
                                } else {
                                  const html2canvas = await loadHtml2Canvas();
                                  const canvas = await html2canvas(el, {
                                    useCORS: true,
                                    backgroundColor: null,
                                    scale: 1,
                                  });
                                  const url = canvas.toDataURL("image/png");
                                  setGeneratedImage(url);
                                  setShowShareModal(true);
                                }
                              } catch (err) {
                                console.error(
                                  "Failed generating share image",
                                  err
                                );
                              }
                            }}
                            className="p-2 rounded-full hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
                            title="Share my savings"
                            aria-label="Share my savings"
                          >
                            <Share2
                              size={18}
                              className="text-purple-600 dark:text-purple-300"
                            />
                          </button>
                        </div>
                      </div>
                    )}

                  {/* Aux Heat Alert */}
                  {auxPercentage > 30 && (
                    <div className="bg-orange-50 border-l-4 border-orange-400 p-4 mb-4">
                      <div className="flex items-start">
                        <AlertTriangle
                          size={20}
                          className="text-orange-600 mt-0.5 mr-2 flex-shrink-0"
                        />
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-orange-800">
                            High Auxiliary Heat Usage (
                            {auxPercentage.toFixed(0)}%)
                          </h4>
                          <p className="text-xs text-orange-700 mt-1">
                            Your system is relying heavily on expensive backup
                            heat. Consider upgrading to a larger/more efficient
                            system or improving insulation to reduce costs.
                          </p>
                          <button
                            onClick={() => setShowUpgradeModal(true)}
                            className="mt-2 px-3 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700"
                          >
                            See Upgrade Options â†’
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Share & Upgrade Buttons */}
                  <div className="flex flex-wrap gap-3 mb-4">
                    <button
                      onClick={handleShare}
                      className="btn btn-outline"
                      aria-label="Copy shareable forecast URL"
                    >
                      <Share2 size={18} /> Share Forecast
                    </button>
                    <button
                      onClick={() => setShowUpgradeModal(true)}
                      className="btn btn-primary"
                      id="upgrade-button"
                      aria-label="Open upgrade comparison modal"
                    >
                      <TrendingUp size={18} /> Compare Upgrade
                    </button>
                  </div>
                  {shareMessage && (
                    <p className="text-sm text-green-600 mb-4">
                      {shareMessage}
                    </p>
                  )}

                  {showShareModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border dark:border-gray-700">
                        <div className="p-4 flex items-center justify-between border-b dark:border-gray-700">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Share your savings
                          </h3>
                          <button
                            onClick={() => setShowShareModal(false)}
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            aria-label="Close share dialog"
                          >
                            âœ•
                          </button>
                        </div>
                        <div className="p-4">
                          {generatedImage ? (
                            <img
                              src={generatedImage}
                              alt="Share preview"
                              className="w-full rounded-lg border dark:border-gray-800"
                            />
                          ) : (
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              Generating imageâ€¦
                            </p>
                          )}
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              onClick={async () => {
                                try {
                                  if (navigator.share) {
                                    const text = `I'm projected to save $${roiData?.annualSavings?.toFixed?.(
                                      0
                                    )}/year on home heating${
                                      foundLocationName
                                        ? ` in ${foundLocationName}`
                                        : ""
                                    }!`;
                                    const shareData = {
                                      title: "My heating savings",
                                      text,
                                    };
                                    if (
                                      navigator.canShare &&
                                      generatedImage?.startsWith("data:")
                                    ) {
                                      const resp = await fetch(generatedImage);
                                      const blob = await resp.blob();
                                      const file = new File(
                                        [blob],
                                        "joule-savings.png",
                                        { type: "image/png" }
                                      );
                                      if (
                                        navigator.canShare({ files: [file] })
                                      ) {
                                        await navigator.share({
                                          ...shareData,
                                          files: [file],
                                        });
                                        setShowShareModal(false);
                                        return;
                                      }
                                    }
                                    await navigator.share({
                                      ...shareData,
                                      url: window.location.href.split("#")[0],
                                    });
                                    setShowShareModal(false);
                                  } else {
                                    const text = encodeURIComponent(
                                      `I'm projected to save $${roiData?.annualSavings?.toFixed?.(
                                        0
                                      )}/year on home heating${
                                        foundLocationName
                                          ? ` in ${foundLocationName}`
                                          : ""
                                      }!`
                                    );
                                    const url = encodeURIComponent(
                                      window.location.href.split("#")[0]
                                    );
                                    window.open(
                                      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
                                      "_blank",
                                      "noopener"
                                    );
                                  }
                                } catch (e) {
                                  console.error("Share failed", e);
                                }
                              }}
                              className="btn btn-primary"
                            >
                              <span className="inline-flex items-center gap-2">
                                <Share2 size={16} /> Share
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                const text = encodeURIComponent(
                                  `I'm projected to save $${roiData?.annualSavings?.toFixed?.(
                                    0
                                  )}/year on home heating${
                                    foundLocationName
                                      ? ` in ${foundLocationName}`
                                      : ""
                                  }!`
                                );
                                const url = encodeURIComponent(
                                  window.location.href.split("#")[0]
                                );
                                window.open(
                                  `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
                                  "_blank",
                                  "noopener"
                                );
                              }}
                              className="btn btn-outline"
                            >
                              Tweet
                            </button>
                            <a
                              href={generatedImage || "#"}
                              download="joule-savings.png"
                              className="btn btn-outline"
                            >
                              Download Image
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Collapsible Daily Breakdown */}
                  {primarySystem === "heatPump" && (
                    <div
                      id="daily-breakdown-section"
                      className="border rounded-lg dark:border-gray-700 mb-6"
                    >
                      <button
                        onClick={() =>
                          setShowDailyBreakdown(!showDailyBreakdown)
                        }
                        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                      >
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                          <span>{showDailyBreakdown ? "▼" : "▶"}</span> Daily
                          Breakdown
                        </h3>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Detailed daily forecast
                        </span>
                      </button>
                      {showDailyBreakdown && (
                        <div className="p-4 border-t dark:border-gray-700">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <label
                                htmlFor="view-mode"
                                className="text-sm font-medium text-gray-700 dark:text-gray-300"
                              >
                                View Mode:
                              </label>
                              <select
                                id="view-mode"
                                value={breakdownView}
                                onChange={(e) =>
                                  dispatch({
                                    type: "SET_UI_FIELD",
                                    field: "breakdownView",
                                    value: e.target.value,
                                  })
                                }
                                className={selectClasses}
                              >
                                <option value="withAux">Heat Pump with Aux Heat</option>
                                <option value="noAux">Heat Pump Only</option>
                              </select>
                            </div>
                          </div>
                          <p className="text-xs text-gray-700 dark:text-gray-300 mb-3 italic bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                            <strong>Heat Pump with Aux Heat:</strong> shows minimum indoor
                            temp when supplemental electric resistance heat is
                            allowed (aux maintains setpoint when heat pump can't
                            meet load). Includes aux energy costs in daily totals.
                            <br />
                            <strong>Heat Pump Only:</strong> shows minimum
                            indoor temp if only the heat pump operates (no aux
                            backup). Excludes aux energy costs from daily totals.
                          </p>
                          {/* Elevation and Heat Loss Display */}
                          {((locationElevation > 0 || (typeof globalHomeElevation === "number" && globalHomeElevation >= 0)) || effectiveHeatLoss > 0) && (
                            <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg" data-testid="elevation-display">
                              <div className="space-y-2">
                                {/* Elevation Info */}
                                {(locationElevation > 0 || (typeof globalHomeElevation === "number" && globalHomeElevation >= 0)) && (
                                  <div className="text-xs text-gray-700 dark:text-gray-300">
                                    {locationElevation > 0 && (
                                      <span>
                                        <strong>Location Elevation:</strong> {locationElevation.toLocaleString()} ft
                                      </span>
                                    )}
                                    {typeof globalHomeElevation === "number" && globalHomeElevation >= 0 && (
                                      <span className={locationElevation > 0 ? "ml-2" : ""}>
                                        {locationElevation > 0 && "• "}
                                        <strong>Home Elevation:</strong>{" "}
                                        {isEditingElevation ? (
                                          <span className="inline-flex items-center gap-1">
                                            <input
                                              type="number"
                                              value={editingElevationValue}
                                              onChange={(e) => setEditingElevationValue(e.target.value)}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                  const val = parseFloat(editingElevationValue);
                                                  if (!isNaN(val) && val >= -500 && val <= 15000) {
                                                    if (setUserSetting) {
                                                      setUserSetting("homeElevation", Math.round(val));
                                                    }
                                                    setIsEditingElevation(false);
                                                  }
                                                } else if (e.key === "Escape") {
                                                  setIsEditingElevation(false);
                                                  setEditingElevationValue("");
                                                }
                                              }}
                                              onBlur={() => {
                                                const val = parseFloat(editingElevationValue);
                                                if (!isNaN(val) && val >= -500 && val <= 15000) {
                                                  if (setUserSetting) {
                                                    setUserSetting("homeElevation", Math.round(val));
                                                  }
                                                }
                                                setIsEditingElevation(false);
                                                setEditingElevationValue("");
                                              }}
                                              autoFocus
                                              className="w-20 px-1 py-0.5 text-xs border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                              min="-500"
                                              max="15000"
                                              step="1"
                                            />
                                            <span className="text-[10px] text-gray-500 dark:text-gray-400">ft</span>
                                          </span>
                                        ) : (
                                          <span
                                            data-testid="home-elevation-value"
                                            onClick={() => {
                                              setEditingElevationValue(String(Math.round(globalHomeElevation)));
                                              setIsEditingElevation(true);
                                            }}
                                            className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 underline decoration-dotted"
                                            title="Click to edit home elevation"
                                          >
                                            {globalHomeElevation.toLocaleString()} ft
                                          </span>
                                        )}
                                        {locationElevation > 0 && Math.abs(globalHomeElevation - locationElevation) >= 10 && (
                                          <span className="ml-1 text-blue-600 dark:text-blue-400">
                                            (Temps adjusted for {globalHomeElevation > locationElevation ? '+' : ''}{(globalHomeElevation - locationElevation).toLocaleString()} ft difference)
                                          </span>
                                        )}
                                      </span>
                                    )}
                                  </div>
                                )}
                                
                                {/* Heat Loss Info */}
                                {effectiveHeatLoss > 0 && (() => {
                                  const heatLossFactor = effectiveHeatLoss / 70; // BTU/hr/°F
                                  const heatLossAt70F = effectiveHeatLoss; // BTU/hr @ 70°F ΔT
                                  // Cost calculations: assume continuous operation at these rates
                                  // BTU/hr to kWh: 1 kWh = 3412 BTU, so BTU/hr / 3412 = kW
                                  const costPerHourAt70F = (heatLossAt70F / 3412) * utilityCost; // $/hr at 70°F ΔT
                                  const costPerHourPerDegreeF = (heatLossFactor / 3412) * utilityCost; // $/hr/°F
                                  
                                  // Determine data source for display
                                  const isUsingAnalyzerData = Boolean(userSettings?.useAnalyzerHeatLoss && userSettings?.analyzerHeatLoss);
                                  const isUsingManualData = Boolean(userSettings?.useManualHeatLoss && userSettings?.manualHeatLoss);
                                  const dataSourceLabel = isUsingAnalyzerData 
                                    ? "from ecobee CSV analysis" 
                                    : isUsingManualData 
                                    ? "from manual entry"
                                    : "calculated from building specs";
                                  
                                  return (
                                    <p className="text-xs text-gray-700 dark:text-gray-300 border-t border-blue-200 dark:border-blue-700 pt-2 mt-2">
                                      <strong>Building Heat Loss</strong>{" "}
                                      {isUsingAnalyzerData && (
                                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                          (from CSV analysis)
                                        </span>
                                      )}
                                      {": "}
                                      <span className="font-mono">{formatHeatLossFactor(heatLossFactor, unitSystem, { decimals: 1 })}</span>{" "}
                                      <span className="text-gray-500 dark:text-gray-400">•</span>{" "}
                                      <span className="font-mono">{formatCapacityFromKbtuh(heatLossAt70F / 1000, unitSystem, { decimals: 0 })}</span>{" "}
                                      @ {formatTemperatureFromF(70, unitSystem, { decimals: 0, withUnit: false })}°{unitSystem === "intl" ? "C" : "F"} ΔT
                                      <br />
                                      <span className="text-gray-600 dark:text-gray-400 text-[10px] italic">
                                        {dataSourceLabel}
                                      </span>
                                      <br />
                                      <span className="text-gray-600 dark:text-gray-400">
                                        Cost: <span className="font-mono">${costPerHourPerDegreeF.toFixed(4)}</span>/hr/°F{" "}
                                        <span className="text-gray-500 dark:text-gray-400">•</span>{" "}
                                        <span className="font-mono">${costPerHourAt70F.toFixed(2)}</span>/hr @ 70°F ΔT
                                        {utilityCost > 0 && (
                                          <span className="text-gray-500 dark:text-gray-400 text-[10px] ml-1">
                                            (@ ${utilityCost.toFixed(3)}/kWh)
                                          </span>
                                        )}
                                      </span>
                                    </p>
                                  );
                                })()}
                              </div>
                            </div>
                          )}
                          
                          {/* Weather Data Source Attribution */}
                          {forecastDataSource && (
                            <div className="mb-3 p-3 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-sm">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                                <MapPin size={16} className="text-blue-600 dark:text-blue-400" />
                                <span>Weather Forecast Data Source</span>
                              </p>
                              <p className="text-xs text-gray-700 dark:text-gray-300">
                                {forecastDataSource === 'NWS' ? (
                                  <>
                                    <strong className="text-blue-700 dark:text-blue-300">National Weather Service (NWS)</strong>
                                    {' '}— Official US government forecast from{' '}
                                    <a 
                                      href="https://www.weather.gov/" 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline font-medium"
                                    >
                                      weather.gov
                                    </a>
                                  </>
                                ) : (
                                  <>
                                    <strong className="text-indigo-700 dark:text-indigo-300">Open-Meteo</strong>
                                    {' '}— Global weather API (used when NWS unavailable). Data from{' '}
                                    <a 
                                      href="https://open-meteo.com/" 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 underline font-medium"
                                    >
                                      open-meteo.com
                                    </a>
                                  </>
                                )}
                              </p>
                            </div>
                          )}
                          
                          <DailyBreakdownTable
                            summary={weeklyMetrics.summary}
                            indoorTemp={indoorTemp}
                            viewMode={breakdownView}
                            awayModeDays={awayModeDays}
                            unitSystem={unitSystem}
                            onToggleAwayMode={(dayString) => {
                              setAwayModeDays((prev) => {
                                const newSet = new Set(prev);
                                if (newSet.has(dayString)) {
                                  newSet.delete(dayString);
                                } else {
                                  newSet.add(dayString);
                                }
                                return newSet;
                              });
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  
                  {primarySystem === "gasFurnace" && (
                    <div className="border rounded-lg dark:border-gray-700 mb-6 p-4 bg-gray-50 dark:bg-gray-800">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
                        Gas Furnace Summary
                      </h3>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                        AFUE {Math.round((afue ?? 0.95) * 100)}% • Weekly
                        Therms:{" "}
                        {(weeklyGasMetrics?.totalTherms ?? 0).toFixed(2)} •
                        Weekly Cost: $
                        {(weeklyGasMetrics?.totalCost ?? 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Detailed hourly breakdown is disabled in gas mode
                        (constant combustion efficiency). Switch back to Heat
                        Pump to see temperature-dependent performance details.
                      </p>
                    </div>
                  )}
                  {/* --- COLLAPSIBLE ELEVATION ANALYSIS GRAPH --- */}
                  {elevationCostData && (
                    <div className="border rounded-lg dark:border-gray-700">
                      <button
                        onClick={() =>
                          setShowElevationAnalysis(!showElevationAnalysis)
                        }
                        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                      >
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                          <span>{showElevationAnalysis ? "▼" : "▶"}</span>
                          <AreaChart size={20} /> Cost vs. Elevation Analysis
                        </h3>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          For mountainous regions
                        </span>
                      </button>

                      {showElevationAnalysis && (
                        <div className="p-4 border-t dark:border-gray-700">
                          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                            Especially useful for people in mountainous regions.
                            See how changing your elevation affects your energy
                            costs.
                          </p>
                          <div
                            className="glass dark:glass-dark rounded-2xl p-3 border border-gray-200 dark:border-gray-800 shadow-lg"
                            style={{
                              width: "100%",
                              height: window.innerWidth < 640 ? 260 : 320,
                            }}
                          >
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart
                                data={elevationCostData}
                                margin={{
                                  top: 10,
                                  right: window.innerWidth < 640 ? 8 : 24,
                                  left: window.innerWidth < 640 ? 8 : 16,
                                  bottom: 10,
                                }}
                              >
                                <defs>
                                  <linearGradient
                                    id="costAreaGradient"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                  >
                                    <stop
                                      offset="5%"
                                      stopColor="#3b82f6"
                                      stopOpacity={0.25}
                                    />
                                    <stop
                                      offset="95%"
                                      stopColor="#06b6d4"
                                      stopOpacity={0.05}
                                    />
                                  </linearGradient>
                                  <linearGradient
                                    id="costLineGradient"
                                    x1="0"
                                    y1="0"
                                    x2="1"
                                    y2="0"
                                  >
                                    <stop offset="0%" stopColor="#3b82f6" />
                                    <stop offset="100%" stopColor="#06b6d4" />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid
                                  stroke="#94a3b8"
                                  strokeOpacity={0.2}
                                  vertical={false}
                                />
                                <XAxis
                                  dataKey="elevation"
                                  type="number"
                                  domain={["dataMin", "dataMax"]}
                                  label={{
                                    value: "Elevation (ft)",
                                    position: "insideBottom",
                                    offset: -5,
                                    style: {
                                      fontSize:
                                        window.innerWidth < 640 ? 12 : 13,
                                    },
                                  }}
                                  tickFormatter={(tick) =>
                                    tick.toLocaleString()
                                  }
                                  tick={{
                                    fontSize: window.innerWidth < 640 ? 10 : 12,
                                  }}
                                />
                                <YAxis
                                  label={{
                                    value: "7-Day Cost",
                                    angle: -90,
                                    position: "insideLeft",
                                    style: {
                                      fontSize:
                                        window.innerWidth < 640 ? 12 : 13,
                                    },
                                  }}
                                  tickFormatter={(tick) => `$${tick}`}
                                  tick={{
                                    fontSize: window.innerWidth < 640 ? 10 : 12,
                                  }}
                                />
                                <Tooltip
                                  content={({ active, payload, label }) => {
                                    if (!active || !payload || !payload.length)
                                      return null;
                                    const cost = payload[0]?.value;
                                    return (
                                      <div className="rounded-xl px-3 py-2 bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 shadow-xl">
                                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                                          {label.toLocaleString()} ft
                                        </div>
                                        <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                          ${cost}
                                        </div>
                                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                          Estimated 7-day cost
                                        </div>
                                      </div>
                                    );
                                  }}
                                />
                                <Legend
                                  verticalAlign="top"
                                  height={30}
                                  wrapperStyle={{
                                    fontSize: window.innerWidth < 640 ? 12 : 13,
                                  }}
                                />
                                <Area
                                  type="monotone"
                                  dataKey="cost"
                                  fill="url(#costAreaGradient)"
                                  stroke="none"
                                  isAnimationActive
                                  animationDuration={800}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="cost"
                                  stroke="url(#costLineGradient)"
                                  strokeWidth={2.5}
                                  dot={{ r: 0 }}
                                  activeDot={{ r: 5 }}
                                  name="Estimated 7-Day Cost"
                                  isAnimationActive
                                  animationDuration={800}
                                />
                                <ReferenceDot
                                  x={
                                    globalHomeElevation ?? safeLocHomeElevation ?? 0
                                  }
                                  y={
                                    breakdownView === "withAux"
                                      ? weeklyMetrics.totalCostWithAux
                                      : weeklyMetrics.totalCost
                                  }
                                  r={6}
                                  fill="#dc2626"
                                  stroke="white"
                                />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
              </div>
            )}

          {/* View Calculation Methodology - Extracted Component */}
          {weeklyMetrics && primarySystem === "heatPump" && (
            <Methodology
              show={showCalculations}
              onToggle={() => setShowCalculations(!showCalculations)}
              squareFeet={squareFeet}
              insulationLevel={insulationLevel}
              homeShape={homeShape}
              ceilingHeight={ceilingHeight}
              capacity={capacity}
              tons={tons}
              hspf2={hspf2}
              compressorPower={compressorPower}
              utilityCost={utilityCost}
              indoorTemp={indoorTemp}
              nighttimeTemp={nighttimeTemp}
              foundLocationName={foundLocationName}
              locationElevation={locationElevation}
              energyMode={energyMode}
              adjustedForecast={adjustedForecast}
              effectiveHeatLoss={effectiveHeatLoss}
              weeklyMetrics={weeklyMetrics}
              breakdownView={breakdownView}
              useElectricAuxHeatSetting={useElectricAuxHeatSetting}
              localRates={localRates}
              useCalculatedHeatLoss={userSettings?.useCalculatedHeatLoss}
              useManualHeatLoss={userSettings?.useManualHeatLoss}
              useAnalyzerHeatLoss={userSettings?.useAnalyzerHeatLoss}
            />
          )}
            
            {activeTab === "manual" && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Test a specific temperature and humidity scenario.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Outdoor Temperature
                  </label>
                  <input
                    type="range"
                    min="-10"
                    max="70"
                    step="1"
                    value={manualTemp}
                    onChange={(e) => setManualTemp(Number(e.target.value))}
                    className="w-full mb-1 h-3 cursor-pointer"
                  />
                  <div className="text-center">
                    <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {manualTemp}°F
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Relative Humidity
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={manualHumidity}
                    onChange={(e) => setManualHumidity(Number(e.target.value))}
                    className="w-full mb-1 h-3 cursor-pointer"
                  />
                  <div className="text-center">
                    <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {manualHumidity}%
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Indoor Thermostat
                  </label>
                  <input
                    type="range"
                    min="60"
                    max="78"
                    step="1"
                    value={indoorTemp}
                    onChange={(e) => setIndoorTemp(Number(e.target.value))}
                    className="w-full mb-1 h-3 cursor-pointer"
                  />
                  <div className="text-center">
                    <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {indoorTemp}°F
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 text-center">
                    Setpoint used for load and cost calculations
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-2 border-blue-300 dark:border-blue-700 rounded-lg p-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    Daily Energy Use
                  </h3>
                  <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                    {Number.isFinite(manualDayMetrics.dailyEnergy)
                      ? manualDayMetrics.dailyEnergy.toFixed(1)
                      : "—"}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    kWh per day
                  </p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-2 border-green-300 dark:border-green-700 rounded-lg p-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    Daily Cost
                  </h3>
                  <p className="text-4xl font-bold text-green-600 dark:text-green-400">
                    $
                    {Number.isFinite(manualDayMetrics.dailyCost)
                      ? manualDayMetrics.dailyCost.toFixed(2)
                      : "—"}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    per day
                  </p>
                </div>
                {/* Design Temp & Heat Loss */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Design Temperature (°F)
                  </label>
                  <div className="flex items-center gap-3 mb-2">
                    <input
                      type="number"
                      min={-50}
                      max={70}
                      step={1}
                      value={designTemp ?? 0}
                      onChange={(e) => setDesignTemp(Number(e.target.value))}
                      className={`${inputClasses} w-28`}
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      Outdoor design temperature used for sizing (e.g., 0°F,
                      20°F)
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Heat loss at <strong>{formatTemperatureFromF(designTemp ?? 0, unitSystem, { decimals: 0 })}</strong> (ΔT ={" "}
                      {formatTemperatureFromF(Math.max(0, indoorTemp - (designTemp ?? 0)), unitSystem, { decimals: 0, withUnit: false })}°{unitSystem === "intl" ? "C" : "F"})
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Normalized: <strong>{perDegree.toFixed(1)}</strong>{" "}
                      BTU/hr/°F
                      {userSettings?.useAnalyzerHeatLoss && userSettings?.analyzerHeatLoss && (
                        <span className="text-emerald-600 dark:text-emerald-400 ml-1">
                          (from CSV analysis)
                        </span>
                      )}
                    </p>
                    <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                      {Number.isFinite(calculatedHeatLossBtu)
                        ? calculatedHeatLossBtu.toFixed(0)
                        : "—"}{" "}
                      BTU/hr •{" "}
                      {Number.isFinite(calculatedHeatLossKw)
                        ? calculatedHeatLossKw.toFixed(2)
                        : "—"}{" "}
                      kW
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      We report heat loss normalized at 70°F ΔT; use this input
                      to see heat loss at a different outdoor design
                      temperature. Multiply BTU/hr/°F by the ΔT to estimate
                      hourly heat loss.
                    </p>
                    {userSettings?.useAnalyzerHeatLoss && userSettings?.analyzerHeatLoss && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-semibold">
                        ✓ Using heat loss factor from ecobee CSV analysis: {userSettings.analyzerHeatLoss.toFixed(1)} BTU/hr/°F
                      </p>
                    )}
                    {!userSettings?.useAnalyzerHeatLoss && (
                      <div className="flex items-start gap-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          {userSettings?.useManualHeatLoss 
                            ? "Using manually entered heat loss factor."
                            : "This is calculated from building specs â€” real-world dynamic effects like solar gains, infiltration, or internal heat loads can change results."}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setShowHeatLossTooltip(!showHeatLossTooltip)
                          }
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors mt-2"
                          aria-label="More about dynamic effects"
                        >
                          <HelpCircle size={14} />
                        </button>
                      </div>
                    )}
                    {showHeatLossTooltip && (
                      <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg text-xs text-gray-700 dark:text-gray-300">
                        <p className="font-semibold text-blue-700 dark:text-blue-300 mb-2">
                          Why this is an estimate
                        </p>
                        <ul className="ml-4 list-disc space-y-1">
                          <li>
                            <strong>Solar gains:</strong> Sunlight through
                            windows and glazing can reduce heating demand during
                            the day.
                          </li>
                          <li>
                            <strong>Infiltration:</strong> Air leakage (drafts)
                            introduces additional heating load, especially in
                            cold/windy conditions.
                          </li>
                          <li>
                            <strong>Internal loads:</strong> Occupancy,
                            appliances, and lighting add heat that affects the
                            net load.
                          </li>
                        </ul>
                      </div>
                    )}
                    <details className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                      <summary className="cursor-pointer font-semibold">
                        How to use
                      </summary>
                      <div className="mt-2 space-y-1">
                        <p>
                          1) The displayed <strong>BTU/hr/°F</strong> is the
                          building's heat loss per degree of indoor-outdoor
                          difference.
                        </p>
                        <p>
                          2) If your indoor setpoint is{" "}
                          <strong>{indoorTemp}°F</strong> and you choose a
                          design temp <strong>{designTemp}°F</strong>, the ΔT =
                          indoor − design ={" "}
                          <strong>
                            {Math.max(0, indoorTemp - designTemp)}°F
                          </strong>
                          .
                        </p>
                        <p>
                          3) Hourly heat loss at the design temp ={" "}
                          <strong>BTU/hr/°F × ΔT</strong> ={" "}
                          <strong>
                            {Number.isFinite(perDegree)
                              ? perDegree.toFixed(1)
                              : "—"}{" "}
                            × {Math.max(0, indoorTemp - designTemp)}°F
                          </strong>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Tip: Use your local 1-in-10-year design temperature
                          (from your local code or weather data) for safe system
                          sizing.
                        </p>
                      </div>
                    </details>
                    <details className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                      <summary className="cursor-pointer font-semibold">
                        Learn more: heat loss, simply
                      </summary>
                      <div className="mt-2 space-y-2">
                        <p>
                          Think of your home like a <strong>coffee cup</strong>.
                          The bigger the difference between coffee temperature
                          and room air, the faster the cup cools. Your home's{" "}
                          <strong>insulation</strong> is like the cup's{" "}
                          <strong>lid</strong>: better insulation slows heat
                          escaping.
                        </p>
                        <ul className="ml-4 list-disc space-y-1">
                          <li>
                            <strong>BTU/hr/°F</strong> is like how fast heat
                            leaks for each degree of temperature difference.
                          </li>
                          <li>
                            Colder outside (bigger ΔT) → faster heat loss → more
                            heating needed.
                          </li>
                          <li>
                            Improve insulation/air-sealing → lower BTU/hr/°F →
                            lower bills.
                          </li>
                        </ul>
                      </div>
                    </details>
                  </div>
                </div>
              </div>
              {/* Live Defrost Multiplier */}
              <div
                className={`mt-3 text-xs rounded-md border px-3 py-2 inline-block ${
                  manualDayMetrics.defrostPenalty &&
                  manualDayMetrics.defrostPenalty > 1
                    ? "bg-blue-50 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200"
                    : "bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                }`}
              >
                <span className="font-semibold">Defrost multiplier:</span>{" "}
                {Number.isFinite(manualDayMetrics.defrostPenalty)
                  ? manualDayMetrics.defrostPenalty.toFixed(2)
                  : "1.00"}
                ×
                {Number.isFinite(manualDayMetrics.defrostPenalty) ? (
                  <>
                    {" "}
                    ({((manualDayMetrics.defrostPenalty - 1) * 100).toFixed(0)}
                    %)
                  </>
                ) : null}
                {manualDayMetrics.outdoorTemp >= 20 &&
                manualDayMetrics.outdoorTemp < 45 ? (
                  <span className="ml-2">
                    • Active at {manualDayMetrics.outdoorTemp}°F,{" "}
                    {manualDayMetrics.humidity}% RH
                  </span>
                ) : (
                  <span className="ml-2">
                    • Inactive at {manualDayMetrics.outdoorTemp}°F (applies
                    20–45°F)
                  </span>
                )}
              </div>

              {/* Expanded Defrost & Humidity Mechanics (collapsible) */}
              <details className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg group">
                <summary className="cursor-pointer text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
                  ❄️ Defrost & Humidity Mechanics{" "}
                  <span className="text-[10px] font-normal text-blue-700 dark:text-blue-400 cursor-pointer">
                    (click to expand)
                  </span>
                </summary>
                <div className="text-xs text-blue-800 dark:text-blue-200 space-y-4 leading-relaxed mt-3">
                  <section>
                    <h5 className="font-semibold mb-1">
                      1. The Premise: Humidity Impacts Energy Consumption
                    </h5>
                    <p>
                      A heat pump's outdoor coil often operates{" "}
                      <em>below the outdoor air temperature</em> while
                      extracting heat. If its surface falls below 32°F and
                      moisture is present, frost forms. Frost acts like an
                      insulating blanket, cutting heat transfer. To clear it,
                      the unit runs a <strong>defrost cycle</strong>,
                      temporarily reversing into cooling mode and using hot
                      refrigerant gas to melt ice. During defrost the house is
                      not actively heated, and supplemental heat may engage. The
                      extra runtime + lost heating output is the{" "}
                      <strong>defrost penalty</strong>.
                    </p>
                  </section>
                  <section>
                    <h5 className="font-semibold mb-1">
                      2. The Defrost "Sweet Spot" (≈ 20°F – 45°F)
                    </h5>
                    <p>
                      This band is the "perfect storm": cold enough for coil
                      surface temps well below freezing, yet warm enough that
                      the air can still carry meaningful water vapor. High
                      relative humidity here means rapid, thick frost
                      accumulation and frequent, energy-intensive defrost
                      cycles.
                    </p>
                  </section>
                  <section>
                    <h5 className="font-semibold mb-1">
                      3. Why The Penalty Drops Below ~20°F
                    </h5>
                    <p>
                      Very cold air is intrinsically dry in{" "}
                      <strong>absolute</strong> moisture terms. Even if RH reads
                      90%, the total water vapor available at 10°F is tiny
                      compared to 35°F. Think of air as a sponge: a small sponge
                      at 10°F can be "100% soaked" yet holds far less water than
                      a bigger sponge (35°F air) that's only half saturated.
                      Result: frost accumulates more slowly—often light and
                      powdery—so defrost frequency and duration diminish.
                    </p>
                  </section>
                  <section>
                    <h5 className="font-semibold mb-1">4. Summary Table</h5>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] border border-blue-200 dark:border-blue-800">
                        <thead className="bg-blue-100 dark:bg-blue-900/40">
                          <tr>
                            <th className="p-2 border-b border-blue-200 dark:border-blue-800">
                              Outdoor Temp
                            </th>
                            <th className="p-2 border-b border-blue-200 dark:border-blue-800">
                              Condition
                            </th>
                            <th className="p-2 border-b border-blue-200 dark:border-blue-800">
                              Frost Formation
                            </th>
                            <th className="p-2 border-b border-blue-200 dark:border-blue-800">
                              Defrost Impact
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="odd:bg-white even:bg-blue-50 dark:odd:bg-blue-950 dark:even:bg-blue-900/30">
                            <td className="p-2">Above 45°F</td>
                            <td className="p-2">
                              Air warm; coil mostly above freezing
                            </td>
                            <td className="p-2">Minimal frost</td>
                            <td className="p-2">Negligible</td>
                          </tr>
                          <tr className="odd:bg-white even:bg-blue-50 dark:odd:bg-blue-950 dark:even:bg-blue-900/30">
                            <td className="p-2">20–45°F</td>
                            <td className="p-2">Cool & still moist</td>
                            <td className="p-2">Rapid, thick buildup</td>
                            <td className="p-2 font-semibold">Highest</td>
                          </tr>
                          <tr className="odd:bg-white even:bg-blue-50 dark:odd:bg-blue-950 dark:even:bg-blue-900/30">
                            <td className="p-2">Below 20°F</td>
                            <td className="p-2">Very cold & very dry</td>
                            <td className="p-2">Slow, light powder</td>
                            <td className="p-2">Lower again</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </section>
                  <section>
                    <h5 className="font-semibold mb-1">
                      5. Model Formula (Simplified)
                    </h5>
                    <p>
                      Applied only when <strong>20°F ≤ T ≤ 45°F</strong>:
                    </p>
                    <div className="font-mono bg-white dark:bg-blue-900 p-2 rounded select-text">
                      defrostPenalty = 1 + (0.15 × RH_fraction)
                    </div>
                    <p className="mt-2">Examples:</p>
                    <ul className="list-disc list-inside ml-2 mb-2">
                      <li>30°F & 20% RH → ~3% energy increase</li>
                      <li>30°F & 80% RH → ~12% energy increase</li>
                      <li>56°F → Penalty inactive (too warm)</li>
                    </ul>
                    <p className="mt-2 italic">
                      Outside the active band the multiplier is 1.00 (no
                      humidity penalty applied).
                    </p>
                  </section>
                </div>
              </details>
            </div>
          )}

          {/* Gas Rates Section */}
          <div className="card card-hover p-6 fade-in">
            <div
              className="flex items-center justify-between mb-4 cursor-pointer"
              onClick={() => setGasRatesExpanded(!gasRatesExpanded)}
            >
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <DollarSign size={20} /> Gas Rates
                {gasRatesExpanded ? (
                  <ChevronUp size={20} />
                ) : (
                  <ChevronDown size={20} />
                )}
              </h2>
            </div>
            {gasRatesExpanded && (
              <>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                  Configure your natural gas rates for accurate cost comparisons
                  and gas furnace mode calculations.
                </p>

                <div className="mb-4 p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-100 dark:border-orange-800">
                  <label className="block text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">
                    Gas Cost
                  </label>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
                    {stateName
                      ? `Auto-set to ${stateName} average. Adjust if needed.`
                      : "Not sure? The national average is about $1.20/therm"}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">$</span>
                    <input
                      type="range"
                      min="0.50"
                      max="5.00"
                      step="0.05"
                      value={gasCost}
                      onChange={(e) => setGasCost(Number(e.target.value))}
                      className="flex-grow"
                    />
                    <span className="text-2xl font-bold text-orange-600 dark:text-orange-400 min-w-[120px]">
                      ${gasCost.toFixed(2)}/therm
                    </span>
                  </div>
                </div>

                {stateName && (
                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
                    <p className="text-blue-800 dark:text-blue-200">
                      <strong>ðŸ’¡ State Average for {stateName}:</strong> $
                      {getStateGasRate(stateName).toFixed(2)}/therm (currently
                      applied)
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* System & Utilities Section */}
          <div id="building-settings" className="card card-hover p-6 fade-in">
            <div
              className="flex items-center justify-between mb-4 cursor-pointer"
              onClick={() => setSystemExpanded(!systemExpanded)}
            >
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <Settings size={20} /> System & Utilities
                {systemExpanded ? (
                  <ChevronUp size={20} />
                ) : (
                  <ChevronDown size={20} />
                )}
              </h2>
            </div>
            {systemExpanded && (
              <div className="space-y-6">
                {/* Primary system toggle */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Primary Heating System
                  </label>
                  <div className="inline-flex rounded-lg border-2 border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 p-1">
                    <button
                      onClick={() => setPrimarySystem("heatPump")}
                      className={`px-4 py-2 rounded-md font-semibold transition-all ${
                        primarySystem === "heatPump"
                          ? "bg-blue-600 text-white shadow-md"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      Heat Pump
                    </button>
                    <button
                      onClick={() => setPrimarySystem("gasFurnace")}
                      className={`px-4 py-2 rounded-md font-semibold transition-all ${
                        primarySystem === "gasFurnace"
                          ? "bg-blue-600 text-white shadow-md"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      Gas Furnace
                    </button>
                  </div>
                </div>
                {primarySystem === "heatPump" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Heat Pump Capacity (kBTU)
                      </label>
                      <select
                        value={capacity}
                        onChange={(e) => setCapacity(Number(e.target.value))}
                        className="w-full px-3 py-2 border rounded-lg font-semibold dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                      >
                        {Object.entries(capacities).map(([btu, ton]) => (
                          <option key={btu} value={btu}>
                            {btu}k BTU ({ton} tons)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Cooling Efficiency (SEER2)
                      </label>
                      <select
                        value={efficiency}
                        onChange={(e) => setEfficiency(Number(e.target.value))}
                        className="w-full px-3 py-2 border rounded-lg font-semibold dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                      >
                        {[14, 15, 16, 17, 18, 19, 20, 21, 22].map((seer) => (
                          <option key={seer} value={seer}>
                            {seer} SEER2
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Heating Efficiency (HSPF2)
                      </label>
                      <input
                        type="number"
                        min={6}
                        max={13}
                        step={0.1}
                        value={hspf2}
                        onChange={(e) =>
                          setHspf2(
                            Math.min(13, Math.max(6, Number(e.target.value)))
                          )
                        }
                        className={inputClasses}
                      />
                    </div>
                  </div>
                )}
                {primarySystem === "gasFurnace" && (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Gas Furnace AFUE (Efficiency)
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowAfueTooltip(!showAfueTooltip)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                          aria-label="What's AFUE?"
                        >
                          <HelpCircle size={16} />
                        </button>
                      </div>

                      {showAfueTooltip && (
                        <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg text-xs text-gray-700 dark:text-gray-300">
                          <p className="font-semibold text-blue-700 dark:text-blue-300 mb-2">
                            What's AFUE?
                          </p>
                          <p className="mb-2">
                            AFUE stands for{" "}
                            <strong>Annual Fuel Utilization Efficiency</strong>.
                            It's like your furnace's "gas mileage."
                          </p>
                          <ul className="space-y-1 ml-4 mb-2">
                            <li>
                              <strong>90-98%:</strong> A high-efficiency furnace
                              (most common in new homes).
                            </li>
                            <li>
                              <strong>80%:</strong> A standard, mid-efficiency
                              furnace.
                            </li>
                            <li>
                              <strong>&lt; 80%:</strong> An older, less
                              efficient furnace.
                            </li>
                          </ul>
                          <p className="text-xs italic">
                            This rating is found on the furnace's EnergyGuide
                            label and does not change based on your home's size.
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="0.60"
                          max="0.99"
                          step="0.01"
                          value={typeof afue === "number" ? afue : 0.95}
                          onChange={(e) =>
                            setAfue(
                              Math.min(
                                0.99,
                                Math.max(0.6, Number(e.target.value))
                              )
                            )
                          }
                          className="flex-grow"
                        />
                        <span className="text-xl font-bold text-blue-600 dark:text-blue-400 min-w-[90px]">
                          {Math.round((afue ?? 0.95) * 100)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Annual Fuel Utilization Efficiency. Typical range
                        60%â€“99%.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Cooling System
                      </label>
                      <div className="inline-flex rounded-lg border-2 border-indigo-300 dark:border-indigo-700 bg-white dark:bg-gray-800 p-1">
                        <button
                          onClick={() => setCoolingSystem("centralAC")}
                          className={`px-4 py-2 rounded-md text-sm font-semibold ${
                            coolingSystem === "centralAC"
                              ? "bg-indigo-600 text-white shadow"
                              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          }`}
                        >
                          â„ï¸ Central A/C
                        </button>
                        <button
                          onClick={() => setCoolingSystem("dualFuel")}
                          className={`px-4 py-2 rounded-md text-sm font-semibold ${
                            coolingSystem === "dualFuel"
                              ? "bg-indigo-600 text-white shadow"
                              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          }`}
                        >
                          âš¡ Dual-Fuel HP
                        </button>
                        <button
                          onClick={() => setCoolingSystem("none")}
                          className={`px-4 py-2 rounded-md text-sm font-semibold ${
                            coolingSystem === "none"
                              ? "bg-indigo-600 text-white shadow"
                              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          }`}
                        >
                          None
                        </button>
                      </div>
                    </div>
                    {coolingSystem === "centralAC" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            A/C SEER2
                          </label>
                          <select
                            value={efficiency}
                            onChange={(e) =>
                              setEfficiency(Number(e.target.value))
                            }
                            className="w-full px-3 py-2 border rounded-lg font-semibold dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                          >
                            {[13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map(
                              (seer) => (
                                <option key={seer} value={seer}>
                                  {seer} SEER2
                                </option>
                              )
                            )}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            A/C Capacity (kBTU)
                          </label>
                          <select
                            value={coolingCapacity}
                            onChange={(e) =>
                              setCoolingCapacity(Number(e.target.value))
                            }
                            className={selectClasses}
                          >
                            {[18, 24, 30, 36, 42, 48, 60].map((bt) => (
                              <option key={bt} value={bt}>
                                {bt}k BTU (
                                {
                                  {
                                    18: 1.5,
                                    24: 2,
                                    30: 2.5,
                                    36: 3,
                                    42: 3.5,
                                    48: 4,
                                    60: 5,
                                  }[bt]
                                }{" "}
                                tons)
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                    {coolingSystem === "dualFuel" && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            HP Heating (HSPF2)
                          </label>
                          <input
                            type="number"
                            min={6}
                            max={13}
                            step={0.1}
                            value={hspf2}
                            onChange={(e) =>
                              setHspf2(
                                Math.min(
                                  13,
                                  Math.max(6, Number(e.target.value))
                                )
                              )
                            }
                            className={inputClasses}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            HP Cooling (SEER2)
                          </label>
                          <select
                            value={efficiency}
                            onChange={(e) =>
                              setEfficiency(Number(e.target.value))
                            }
                            className="w-full px-3 py-2 border rounded-lg font-semibold dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                          >
                            {[14, 15, 16, 17, 18, 19, 20, 21, 22].map(
                              (seer) => (
                                <option key={seer} value={seer}>
                                  {seer} SEER2
                                </option>
                              )
                            )}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            HP Capacity (kBTU)
                          </label>
                          <select
                            value={coolingCapacity}
                            onChange={(e) =>
                              setCoolingCapacity(Number(e.target.value))
                            }
                            className={selectClasses}
                          >
                            {[18, 24, 30, 36, 42, 48, 60].map((bt) => (
                              <option key={bt} value={bt}>
                                {bt}k BTU (
                                {
                                  {
                                    18: 1.5,
                                    24: 2,
                                    30: 2.5,
                                    36: 3,
                                    42: 3.5,
                                    48: 4,
                                    60: 5,
                                  }[bt]
                                }{" "}
                                tons)
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Upgrade Scenario Modal - Extracted Component */}
          <UpgradeModal
            show={showUpgradeModal}
            onClose={() => setShowUpgradeModal(false)}
            upgradeScenario={upgradeScenario}
            currentSystem={{ capacity, tons, efficiency }}
          />

          {/* Card C - Under the hood (optional) */}
          {weeklyMetrics && !forecastLoading && (
            <div id="assumptions" className="mt-10 mb-10">
              <div className="bg-[#151A21] border border-[#222A35] rounded-xl p-8">
                <button
                  onClick={() => setShowAssumptions(!showAssumptions)}
                  className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
                >
                  <h2 className="text-xl font-semibold text-[#E8EDF3]">Assumptions, system settings & thermostat details</h2>
                  {showAssumptions ? (
                    <ChevronUp className="w-6 h-6 text-[#7C8894]" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-[#7C8894]" />
                  )}
                </button>
                
                {showAssumptions && (
                  <div className="space-y-6 pt-6 border-t border-[#222A35]">
                    {/* Building heat loss */}
                    <div>
                      <h3 className="text-lg font-semibold text-[#E8EDF3] mb-3">Building heat loss</h3>
                      <p className="text-sm text-[#A7B0BA] mb-2">
                        Heat loss factor: <strong className="text-[#E8EDF3]">{formatHeatLossFactor((effectiveHeatLoss || 0) / 70, unitSystem, { decimals: 1 })}</strong>
                      </p>
                      <p className="text-sm text-[#A7B0BA]">
                        Total heat loss @ {formatTemperatureFromF(70, unitSystem, { decimals: 0, withUnit: false })}°{unitSystem === "intl" ? "C" : "F"} ΔT: <strong className="text-[#E8EDF3]">{formatCapacityFromKbtuh((effectiveHeatLoss || 0) / 1000, unitSystem, { decimals: 0 })}</strong>
                      </p>
                    </div>
                    
                    {/* Heat pump configuration */}
                    <div>
                      <h3 className="text-lg font-semibold text-[#E8EDF3] mb-3">Heat pump configuration</h3>
                      <p className="text-sm text-[#A7B0BA] mb-2">
                        Capacity: <strong className="text-[#E8EDF3]">{capacity}k BTU ({tons} tons)</strong>
                      </p>
                      {energyMode === "heating" ? (
                        <p className="text-sm text-[#A7B0BA]">
                          HSPF2: <strong className="text-[#E8EDF3]">{hspf2.toFixed(1)}</strong>
                        </p>
                      ) : (
                        <p className="text-sm text-[#A7B0BA]">
                          SEER2: <strong className="text-[#E8EDF3]">{efficiency}</strong>
                        </p>
                      )}
                    </div>
                    
                    {/* Thermostat settings */}
                    <div>
                      <h3 className="text-lg font-semibold text-[#E8EDF3] mb-3">Thermostat settings</h3>
                      <p className="text-sm text-[#A7B0BA]">
                        Daytime: <strong className="text-[#E8EDF3]">{indoorTemp}°F</strong> • Nighttime: <strong className="text-[#E8EDF3]">{nighttimeTemp}°F</strong>
                      </p>
                    </div>
                    
                    {/* Weekly summary */}
                    <div>
                      <h3 className="text-lg font-semibold text-[#E8EDF3] mb-3">Weekly summary</h3>
                      <p className="text-sm text-[#A7B0BA] mb-2">
                        Total cost: <strong className="text-[#E8EDF3]">${weeklyMetrics.totalCost.toFixed(2)}</strong>
                      </p>
                      <p className="text-sm text-[#A7B0BA]">
                        Total energy: <strong className="text-[#E8EDF3]">
                          {(() => {
                            const energyDisplayMode = isNerdMode ? "nerd" : (unitSystem === "intl" ? "intl" : "user");
                            if (energyDisplayMode === "intl" || energyDisplayMode === "nerd") {
                              return formatEnergyFromKwh(weeklyMetrics.totalEnergy, unitSystem, { decimals: 1 });
                            }
                            return formatEnergy(kWhToJ(weeklyMetrics.totalEnergy), { mode: "user", precision: 1 });
                          })()}
                        </strong>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Raw Calculation Block */}
          {weeklyMetrics && !forecastLoading && (
            <div id="calculations" className="mt-8 bg-[#11161e] border border-[#1f2937] rounded-xl shadow-lg overflow-hidden">
              <button
                onClick={() => setShowLiveMath(!showLiveMath)}
                className="w-full flex items-center justify-between p-6 hover:bg-[#0c1218] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                    <Calculator size={24} className="text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-white">Raw calculation trace (for auditors & nerds)</h3>
                    <p className="text-sm text-gray-400 mt-1">These are the exact numbers the forecast used. They're export-ready if you ever need to show your contractor, utility, or a spreadsheet.</p>
                  </div>
                </div>
                {showLiveMath ? (
                  <ChevronUp className="w-6 h-6 text-gray-400" />
                ) : (
                  <ChevronDown className="w-6 h-6 text-gray-400" />
                )}
              </button>

              {showLiveMath && (
                <div className="px-6 pb-6 space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                    We simulate your system hour-by-hour using real physics and your forecast. Here's how the numbers work:
                  </p>

                  {/* Building Heat Loss */}
                  <div>
                    <h4 className="font-bold text-lg mb-3 text-white">Building Heat Loss</h4>
                    <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                      Base BTU/sq ft: 22.67 BTU/hr/°F per sq ft<br />
                      Square Feet: {squareFeet.toLocaleString()} sq ft<br />
                      Insulation Factor: {insulationLevel.toFixed(2)}x<br />
                      {homeShape !== 1.0 && <>Home Shape Factor: {homeShape.toFixed(2)}x<br /></>}
                      Ceiling Height Multiplier: {(1 + (ceilingHeight - 8) * 0.1).toFixed(3)}x<br />
                      <br />
                      Total Heat Loss @ 70°F ΔT: <strong>{(effectiveHeatLoss || 0).toLocaleString()} BTU/hr</strong><br />
                      {homeShape !== 1.0 ? (
                        <>
                          = {squareFeet.toLocaleString()} * 22.67 * {insulationLevel.toFixed(2)} * {homeShape.toFixed(2)} * {(1 + (ceilingHeight - 8) * 0.1).toFixed(3)}<br />
                        </>
                      ) : (
                        <>
                          = {squareFeet.toLocaleString()} * 22.67 * {insulationLevel.toFixed(2)} * {(1 + (ceilingHeight - 8) * 0.1).toFixed(3)}<br />
                        </>
                      )}
                      <br />
                      BTU Loss per °F: <strong>{((effectiveHeatLoss || 0) / 70).toFixed(1)} BTU/hr/°F</strong>
                    </code>
                  </div>

                  {/* Heat Pump System */}
                  {primarySystem === "heatPump" && (
                    <div>
                      <h4 className="font-bold text-lg mb-3 text-white">Heat Pump System</h4>
                      <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                        Capacity: {capacity}k BTU ({tons} tons)<br />
                        {energyMode === "heating" ? (
                          <>
                            HSPF2: {hspf2.toFixed(1)}<br />
                            Compressor Power: <strong>{(compressorPower || 0).toFixed(2)} kW</strong><br />
                            = {tons} tons * 1.0 * (15 / {efficiency})<br />
                          </>
                        ) : (
                          <>
                            SEER2: {efficiency}<br />
                            Compressor Power: <strong>{(compressorPower || 0).toFixed(2)} kW</strong><br />
                          </>
                        )}
                        <br />
                        Performance at {currentOutdoorTemp?.toFixed(0) || 35}°F (current outdoor temp):<br />
                        {(() => {
                          const exampleTemp = currentOutdoorTemp || 35;
                          const exampleHumidity = 65;
                          const examplePerf = getPerformanceAtTemp(exampleTemp, exampleHumidity);
                          const tempDiff = Math.max(1, indoorTemp - exampleTemp);
                          const buildingHeatLossBtu = ((effectiveHeatLoss || 0) / 70) * tempDiff;
                          // Calculate capacity factor (same logic as heatUtils)
                          let capacityFactor = 1.0;
                          if (exampleTemp < 47) capacityFactor = 1.0 - (47 - exampleTemp) * 0.01;
                          if (exampleTemp < 17) capacityFactor = 0.70 - (17 - exampleTemp) * 0.0074;
                          capacityFactor = Math.max(0.3, capacityFactor);
                          // Calculate heat output
                          const KW_PER_TON_OUTPUT = 3.517;
                          const BTU_PER_KWH = 3412.14;
                          const heatpumpOutputBtu = tons * KW_PER_TON_OUTPUT * capacityFactor * BTU_PER_KWH;
                          return (
                            <>
                              Capacity Factor: <strong>{capacityFactor.toFixed(3)}</strong><br />
                              Defrost Penalty: <strong>{(examplePerf.defrostPenalty || 1.0).toFixed(3)}</strong><br />
                              Electrical Power: <strong>{(examplePerf.electricalKw || 0).toFixed(2)} kW</strong><br />
                              Heat Output: <strong>{(heatpumpOutputBtu / 1000).toFixed(0)}k BTU/hr</strong><br />
                              Building Heat Loss: <strong>{(buildingHeatLossBtu / 1000).toFixed(0)}k BTU/hr</strong><br />
                              Runtime: <strong>{(examplePerf.runtime || 0).toFixed(1)}%</strong><br />
                              {examplePerf.auxKw > 0 && (
                                <>
                                  Aux Heat: <strong>{(examplePerf.auxKw || 0).toFixed(2)} kW</strong><br />
                                </>
                              )}
                              <br />
                              Hourly Cost @ {(examplePerf.runtime || 0).toFixed(1)}%: <strong>${((examplePerf.electricalKw || 0) * (examplePerf.runtime || 0) / 100 * utilityCost).toFixed(3)}</strong><br />
                              = {(examplePerf.electricalKw || 0).toFixed(2)} kW * ({(examplePerf.runtime || 0).toFixed(1)}% / 100) * ${utilityCost.toFixed(2)}/kWh
                            </>
                          );
                        })()}
                      </code>
                    </div>
                  )}

                  {/* Weekly Summary */}
                  {weeklyMetrics && (
                    <div>
                      <h4 className="font-bold text-lg mb-3 text-white">Weekly Summary</h4>
                      <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                        Total Cost (7 days): <strong>${weeklyMetrics.totalCost.toFixed(2)}</strong><br />
                        Total Energy (7 days): <strong>{weeklyMetrics.totalEnergy.toFixed(1)} kWh</strong><br />
                        Average Daily Cost: <strong>${(weeklyMetrics.totalCost / 7).toFixed(2)}</strong><br />
                        Average Daily Energy: <strong>{(weeklyMetrics.totalEnergy / 7).toFixed(1)} kWh</strong><br />
                        <br />
                        {breakdownView === "withAux" && weeklyMetrics.totalCostWithAux && (
                          <>
                            Total Cost with Aux Heat: <strong>${weeklyMetrics.totalCostWithAux.toFixed(2)}</strong><br />
                            Aux Heat Cost: <strong>${(weeklyMetrics.totalCostWithAux - weeklyMetrics.totalCost).toFixed(2)}</strong><br />
                          </>
                        )}
                        Electricity Rate: <strong>${utilityCost.toFixed(2)} / kWh</strong><br />
                        Location: <strong>{foundLocationName || "Not set"}</strong><br />
                        {locationElevation && (
                          <>
                            Elevation: <strong>{locationElevation.toFixed(0)} ft</strong><br />
                          </>
                        )}
                      </code>
                    </div>
                  )}

                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    These calculations update in real-time as you adjust settings. Share this with your installer if they want the details.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
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
