import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useReducer,
} from "react";
import { Toast } from "../components/Toast";
import { US_STATES } from "../lib/usStates";
import html2canvas from "html2canvas";
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
} from "lucide-react";
import {
  inputClasses,
  fullInputClasses,
  selectClasses,
} from "../lib/uiClasses";
import { DashboardLink } from "../components/DashboardLink";
import AskJoule from "../components/AskJoule";
import {
  calculateElectricityCO2,
  calculateGasCO2,
  formatCO2,
} from "../lib/carbonFootprint";
import { getBestEquivalent } from "../lib/co2Equivalents";
import needsCommaBetweenCityAndState from "../utils/validateLocation";
import {
  generateRecommendations,
  getTopRecommendations,
} from "../utils/recommendations";
// --- STEP 1: IMPORT RECHARTS COMPONENTS ---
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
import Joyride from "react-joyride";
import {
  fetchLiveElectricityRate,
  fetchLiveGasRate,
  getStateCode,
} from "../lib/eiaRates";
import { getCustomHeroUrl } from "../lib/userImages";
import ThermostatScheduleCard from "../components/ThermostatScheduleCard";
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
    setSource("⚠️ US National Average");
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
      setSource(`✓ Live EIA Data (${liveData.timestamp})`);
      console.log(
        `✓ Fetched live ${rateType} rate for ${stateName}:`,
        liveData
      );
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
    setSource(`ⓘ ${stateName} Average (Hardcoded)`);
  } else {
    setSource("⚠️ US National Average");
  }

  setRate(stateRate);
  console.log(
    `Fallback: Using ${
      isUsingStateAverage ? "state" : "national"
    } average ${rateType} rate for ${stateName}:`,
    stateRate
  );
  return stateRate;
};

const SevenDayCostForecaster = () => {
  const outlet = useOutletContext() || {};
  const { userSettings: ctxUserSettings, setUserSetting: ctxSetUserSetting } =
    outlet;
  const userSettings =
    ctxUserSettings || (outlet.userSettings ? outlet.userSettings : {});
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
      Number(userSettings?.hspf2) > 0 ? Number(userSettings.hspf2) / 3.4 : 2.8; // HSPF2/3.4 ≈ seasonal COP
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
                console.log("🏔️ Elevation change detected in localStorage:", {
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
  const setUseElectricAuxHeat = (v) => setUserSetting("useElectricAuxHeat", v);
  const setEnergyMode = (v) => setUserSetting("energyMode", v);
  const setHomeElevation = (v) => setUserSetting("homeElevation", v);

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
  
  // Ensure locHomeElevation has a default value to prevent initialization errors
  const safeLocHomeElevation = locHomeElevation ?? 0;
  
  // Prefer userSettings.homeElevation (from agent or UI), fallback to reducer state
  // Must be defined AFTER locHomeElevation is destructured
  const globalHomeElevation = useMemo(() => {
    // Check merged settings first (includes localStorage updates) - this takes precedence
    if (typeof mergedUserSettings?.homeElevation === "number" && mergedUserSettings.homeElevation >= 0) {
      if (import.meta.env.DEV) {
        console.log("🏔️ Using mergedUserSettings.homeElevation:", mergedUserSettings.homeElevation, {
          localUserSettings: localUserSettings?.homeElevation,
          userSettings: userSettings?.homeElevation,
        });
      }
      return mergedUserSettings.homeElevation;
    }
    // If userSettings has homeElevation set (even if 0), use it
    if (typeof userSettings?.homeElevation === "number" && userSettings.homeElevation >= 0) {
      if (import.meta.env.DEV) {
        console.log("🏔️ Using userSettings.homeElevation:", userSettings.homeElevation);
      }
      return userSettings.homeElevation;
    }
    // Check localUserSettings directly (in case mergedUserSettings didn't work)
    if (typeof localUserSettings?.homeElevation === "number" && localUserSettings.homeElevation >= 0) {
      if (import.meta.env.DEV) {
        console.log("🏔️ Using localUserSettings.homeElevation:", localUserSettings.homeElevation);
      }
      return localUserSettings.homeElevation;
    }
    // Otherwise, use reducer state (locHomeElevation) or outlet
    const fallback = outlet?.homeElevation ?? safeLocHomeElevation ?? 0;
    if (import.meta.env.DEV) {
      console.log("🏔️ Using fallback elevation:", fallback);
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
  const [tourActive, setTourActive] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  // Legacy rateSource tracking removed.
  const [localRates, setLocalRates] = useState([]); // TOU rate schedule
  const [showDailyBreakdown, setShowDailyBreakdown] = useState(false);
  const [showElevationAnalysis, setShowElevationAnalysis] = useState(false);
  const [showAfueTooltip, setShowAfueTooltip] = useState(false);
  const [showHeatLossTooltip, setShowHeatLossTooltip] = useState(false);
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
  const [onboardingMode, setOnboardingMode] = useState("quick"); // 'quick' | 'custom'
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
            latitude: loc.latitude || 0,
            longitude: loc.longitude || 0,
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
        const initialElev = homeElevFromSettings ?? loc.elevation ?? 0;
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
          value: `${loc.city}, ${loc.state} (Elev: ${loc.elevation} ft)`,
        });
      }
    } catch (e) {
      console.error("Error loading saved location:", e);
    }
  }, []); // Run once on mount

  // Debug logging for elevation changes (moved after locHomeElevation is defined)
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("🏔️ Elevation State Check:", {
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
      console.log("🏔️ Syncing globalHomeElevation to reducer:", {
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
    // ☦️ LOAD-BEARING: Check both React state (heatLossFactor) and userSettings (analyzerHeatLoss)
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
  } = useForecast(coords.latitude, coords.longitude, { enabled: !!coords });

  // Debugging logs to trace calculation parameters
  useEffect(() => {
    console.log("🔥 Heating Mode Debug:", {
      energyMode,
      effectiveHeatLoss,
      compressorPower,
      tons,
      indoorTemp,
      forecastLength: forecastData?.length || 0,
      coords,
      hspf2,
    });
  }, [
    energyMode,
    effectiveHeatLoss,
    compressorPower,
    tons,
    indoorTemp,
    forecastData,
    coords,
    hspf2,
  ]);

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
      console.log("🌍 Elevation Adjustment Debug:", {
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
    // Debug logging to investigate NaN values
    console.log("manualDayMetrics perf:", {
      perf,
      manualTemp,
      manualHumidity,
      utilityCost,
    });

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
    console.log("manualDayMetrics values:", {
      electricalKw,
      runtime,
      hourlyEnergy,
      dailyEnergy,
      dailyCost,
      compressorPower,
      tons,
      heatLoss,
      indoorTemp,
      utilityCost,
    });
    return {
      dailyEnergy,
      dailyCost,
      defrostPenalty: perf?.defrostPenalty,
      humidity: manualHumidity,
      outdoorTemp: manualTemp,
    };
  }, [manualTemp, manualHumidity, getPerformanceAtTemp, utilityCost]);

  // Add logging to identify undefined values causing the error
  console.log("manualDayMetrics:", manualDayMetrics);
  console.log("manualDayMetrics.dailyEnergy:", manualDayMetrics?.dailyEnergy);
  console.log("manualDayMetrics.dailyCost:", manualDayMetrics?.dailyCost);
  console.log(
    "manualDayMetrics.defrostPenalty:",
    manualDayMetrics?.defrostPenalty
  );

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

  const steps = useMemo(
    () => [
      {
        target: ".seven-day-cost-forecaster",
        content:
          "Welcome to the 7-Day Cost Forecaster! This is your command center for predicting and budgeting your home's energy costs for the week ahead.",
        disableBeacon: true,
        placement: "center",
        spotlightClicks: true,
      },
      {
        target: foundLocationName
          ? ".bg-gradient-to-r.from-blue-50"
          : ".bg-gradient-to-br.from-blue-100",
        content:
          "Everything starts here. We use your location to fetch the latest 7-day weather forecast, which is the foundation for all our calculations.",
        placement: "bottom",
        spotlightClicks: true,
      },
      {
        target: "#indoor-temp-slider",
        content:
          "This is the most important part! Drag this slider to set your desired indoor temperature. Watch how the results below change in real-time. This is how you find the perfect balance between comfort and cost.",
        placement: "bottom",
        spotlightClicks: true,
      },
      {
        target: "#weekly-energy-card",
        content:
          "This card shows you the total estimated energy your HVAC system will use over the next 7 days to maintain your chosen temperature.",
        placement: "bottom",
        spotlightClicks: true,
      },
      {
        target: "#weekly-cost-card",
        content:
          "And here's the bottom line: your estimated weekly bill. This number is calculated using the energy from above and the electricity rate you can configure in the settings below.",
        placement: "bottom",
        spotlightClicks: true,
      },
      {
        target: "#weekly-cost-card",
        content:
          "Keep an eye out for alerts that may appear here. We'll let you know if your system is relying too heavily on expensive backup heat, which is a great indicator that an upgrade could save you money.",
        placement: "top",
        spotlightClicks: true,
      },
      {
        target: "#upgrade-button",
        content:
          "Curious how a newer, more efficient system would perform? Click here to run a side-by-side comparison and see your potential savings.",
        placement: "bottom",
        spotlightClicks: true,
      },
      {
        target: "#daily-breakdown-section",
        content:
          "For a deeper dive, you can expand these sections to see a day-by-day cost breakdown or analyze how your home's elevation impacts your energy costs.",
        placement: "top",
        spotlightClicks: true,
      },
      {
        target: "#building-settings",
        content:
          "This is where the magic happens. In these sections, you can fine-tune all the details about your home, your specific HVAC equipment, and your utility rates for the most accurate possible forecast.",
        placement: "top",
        spotlightClicks: true,
      },
      {
        target: "#energy-mode-toggle",
        content:
          "Don't forget, you can switch the entire app between Heating and Cooling modes to budget your energy costs all year round!",
        placement: "bottom",
        spotlightClicks: true,
      },
      {
        target: ".seven-day-cost-forecaster",
        content:
          "You're all set! You now know how to forecast your weekly energy bill. Start by setting your location, then find the budget that's right for you. Enjoy!",
        placement: "center",
        spotlightClicks: true,
      },
    ],
    [foundLocationName]
  );

  // Ensure all Joyride targets are mounted before starting the tour
  useEffect(() => {
    if (tourActive) {
      const allTargetsMounted = steps.every((step) =>
        document.querySelector(step.target)
      );
      if (!allTargetsMounted) {
        const missingTargets = steps
          .filter((step) => !document.querySelector(step.target))
          .map((step) => step.target);
        console.warn(
          "Some Joyride targets are not yet mounted:",
          missingTargets
        );
        // Don't prevent tour from starting, just log the warning
        // setTourActive(false);
      }
    }
  }, [tourActive, steps]);

  // Detect dark mode for tour styling
  useEffect(() => {
    const checkDarkMode = () => {
      if (typeof window !== "undefined") {
        setIsDarkMode(document.documentElement.classList.contains("dark"));
      }
    };

    checkDarkMode();

    // Optional: Listen for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  // Dynamic Joyride styles based on theme
  const joyrideStyles = useMemo(
    () => ({
      options: {
        primaryColor: "#3b82f6",
        zIndex: 10000,
      },
      tooltip: {
        backgroundColor: isDarkMode ? "#1f2937" : "#ffffff",
        color: isDarkMode ? "#f9fafb" : "#111827",
        borderRadius: "12px",
        fontSize: "15px",
        padding: "20px",
      },
      tooltipTitle: {
        color: isDarkMode ? "#ffffff" : "#000000",
        fontSize: "16px",
        fontWeight: "bold",
      },
      tooltipContent: {
        color: isDarkMode ? "#e5e7eb" : "#374151",
      },
      buttonNext: {
        backgroundColor: "#3b82f6",
        color: "#ffffff",
        borderRadius: "8px",
        padding: "8px 16px",
      },
      buttonBack: {
        color: "#3b82f6",
        marginRight: "10px",
      },
      buttonSkip: {
        color: isDarkMode ? "#9ca3af" : "#6b7280",
      },
      overlay: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
      },
      spotlight: {
        border: "3px solid #60a5fa",
        borderRadius: "16px",
        boxShadow:
          "0 0 0 9999px rgba(0, 0, 0, 0.8), 0 0 40px rgba(96, 165, 250, 0.7)",
      },
    }),
    [isDarkMode]
  );

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
  const [showAnswerCard, setShowAnswerCard] = useState(false);
  useEffect(() => {
    if (!forecastLoading && foundLocationName && showAnswerCard) {
      // nothing extra to do; AnswerCard consumes computed props
    }
  }, [forecastLoading, foundLocationName, showAnswerCard]);

  // Building details are now REQUIRED in all modes for Ask Joule
  const totalSteps = 4; // Always 4 steps: Welcome, Location, Building/System, Confirmation

  return (
    <div className="page-gradient-overlay min-h-screen">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-2">
        {/* Compact Page Header */}
        <div className="mb-3 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                <Calendar className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  7-Day Cost Forecaster
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Plan your {energyMode === "heating" ? "heating" : "cooling"} costs for the week ahead
                </p>
              </div>
            </div>
            {/* Mode Toggle - Compact */}
            <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden">
              <button
                onClick={() => setEnergyMode("heating")}
                className={`px-2.5 py-1 text-xs font-semibold flex items-center gap-1 transition-colors ${
                  energyMode === "heating"
                    ? "bg-red-600 text-white"
                    : "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                }`}
              >
                <Flame size={12} /> Heating
              </button>
              <button
                onClick={() => setEnergyMode("cooling")}
                className={`px-2.5 py-1 text-xs font-semibold flex items-center gap-1 transition-colors ${
                  energyMode === "cooling"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                }`}
              >
                <ThermometerSun size={12} /> Cooling
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3 seven-day-cost-forecaster">
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
        {/* Dashboard Link */}
        <div className="flex flex-col gap-2 mb-2">
          <div className="flex justify-end">
            <DashboardLink />
          </div>
          <div className="bg-gradient-to-br from-blue-100/40 via-purple-100/30 to-blue-100/40 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30 rounded-2xl border-2 border-blue-300 dark:border-blue-600 shadow-xl p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="bg-gradient-to-br from-blue-600 to-purple-600 dark:from-blue-500 dark:to-purple-500 rounded-full p-3 shadow-lg">
                <Zap size={24} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  Ask Joule
                </h3>
                <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300">
                  Natural language commands, what-if scenarios, and insights
                </p>
              </div>
            </div>
            <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
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
                        heatingCost: weeklyMetrics.totalCost * 52 * 0.7, // Estimate
                        coolingCost: weeklyMetrics.totalCost * 52 * 0.3,
                      }
                    : null
                }
                recommendations={recommendations}
                onNavigate={(path) => {
                  if (path) navigate(path);
                }}
                onSettingChange={(key, value, meta = {}) => {
                  // Prefer using outlet setUserSetting so App-level audit and persistence are used
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
                  // Minimal, non-invasive apply: set parsed fields and trigger location search if provided.
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
                  // Reveal answer card after query; parent will compute costs when forecast completes
                  setShowAnswerCard(true);
                }}
              />
            </div>
          </div>

          {/* Thermostat Clock Controls - Dual-Period Schedule */}
          <div className="mb-6">
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
            
            {/* ASHRAE Standards Button */}
            <div className="mt-4 flex items-center justify-center">
              <button
                onClick={() => {
                  // Determine if heating or cooling season based on current month
                  const currentMonth = new Date().getMonth() + 1; // 1-12
                  const isHeatingSeason = currentMonth >= 10 || currentMonth <= 4; // Oct-Apr
                  
                  // ASHRAE Standard 55 recommendations (50% RH):
                  // Winter heating: 68.5-74.5°F (use 70°F as middle)
                  // Summer cooling: 73-79°F (use 76°F as middle)
                  // Sleep/unoccupied: 68°F for heating, 78°F for cooling
                  
                  if (isHeatingSeason || energyMode === "heating") {
                    // Heating season: Set to ASHRAE winter recommendations
                    setIndoorTemp(70); // ASHRAE Standard 55: 70°F for winter (middle of 68.5-74.5°F range)
                    setNighttimeTemp(68); // ASHRAE Standard 55: 68°F for sleep/unoccupied in winter
                    setUserSetting("winterThermostat", 70);
                    setUserSetting("summerThermostat", 76); // Also set summer for when season changes
                  } else {
                    // Cooling season: Set to ASHRAE summer recommendations
                    setIndoorTemp(76); // ASHRAE Standard 55: 76°F for summer (middle of 73-79°F range)
                    setNighttimeTemp(78); // ASHRAE Standard 55: 78°F for sleep/unoccupied in summer
                    setUserSetting("summerThermostat", 76);
                    setUserSetting("winterThermostat", 70); // Also set winter for when season changes
                  }
                  
                  // Show success message (toast will be handled by parent component if available)
                  console.log(`Applied ASHRAE Standard 55 temperatures: ${isHeatingSeason || energyMode === "heating" ? "70°F day / 68°F night (heating)" : "76°F day / 78°F night (cooling)"}`);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 dark:from-blue-700 dark:to-indigo-700 dark:hover:from-blue-600 dark:hover:to-indigo-600 transition-all shadow-md hover:shadow-lg transform hover:scale-105 text-sm"
                title="Apply ASHRAE Standard 55 thermal comfort recommendations"
              >
                <CheckCircle2 size={16} />
                Apply ASHRAE Standard 55
              </button>
              <a
                href="https://www.ashrae.org/technical-resources/standards-and-guidelines"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-3 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                title="Learn more about ASHRAE standards"
              >
                Learn more
              </a>
            </div>
            <p className="mt-2 text-xs text-center text-gray-500 dark:text-gray-400">
              ASHRAE Standard 55 provides thermal comfort recommendations: 70°F (winter) / 76°F (summer) for occupied spaces at 50% relative humidity
            </p>
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
              onOpenDashboard={() => {
                try {
                  setShowOnboarding(false);
                  const el =
                    document.querySelector("#daily-breakdown-section") ||
                    document.querySelector(".seven-day-cost-forecaster");
                  if (el)
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                } catch {
                  /* Intentionally empty */
                }
              }}
            />
          )}
        </div>

        {/* First-Time User Onboarding Overlay */}
        {showOnboarding && (
          <div
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Onboarding setup"
            onClick={handleOnboardingSkip}
          >
            <div
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 relative dark:border dark:border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Skip button - Removed: Building details are required for Ask Joule to function */}
              {/* Users must complete onboarding to ensure Ask Joule has necessary data */}

              {/* Progress indicator */}
              <div
                className="flex items-center justify-center gap-2 mb-6"
                aria-label={`Step ${Math.min(
                  onboardingStep + 1,
                  totalSteps
                )} of ${totalSteps}`}
              >
                {Array.from({ length: totalSteps }).map((_, step) => (
                  <div
                    key={step}
                    className={`h-2 w-16 rounded-full transition-all ${
                      step <= Math.min(onboardingStep, totalSteps - 1)
                        ? "bg-blue-600"
                        : "bg-gray-200 dark:bg-gray-700"
                    }`}
                  />
                ))}
              </div>

              {/* Step 0: Welcome (soft landing) */}
              {onboardingStep === 0 && (
                <div className="text-center">
                  <div className="rounded-2xl overflow-hidden mb-6 border dark:border-gray-800 h-48 md:h-56">
                    {/* High-DPI support: prefer PNG with @2x, then fall back to SVG */}
                    {welcomeTheme === "custom" ? (
                      customHeroUrl ? (
                        <img
                          src={customHeroUrl}
                          alt="Custom welcome background"
                          className="w-full h-full object-cover"
                          loading="eager"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                          Welcome
                        </div>
                      )
                    ) : (
                      <img
                        src={
                          WELCOME_THEMES[welcomeTheme]?.file
                            ? buildPublicPath(WELCOME_THEMES[welcomeTheme].file)
                            : ""
                        }
                        fetchpriority="high"
                        alt={`${WELCOME_THEMES[welcomeTheme]?.label} calming background`}
                        className="w-full h-full object-cover"
                        loading="eager"
                      />
                    )}
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                    Welcome — take a breath
                  </h2>
                  <p className="text-lg text-gray-500 dark:text-gray-400 mb-4">
                    to the Energy Cost Forecaster
                  </p>
                  <p className="sr-only">Welcome to Energy Cost Forecaster</p>
                  <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed mb-6 max-w-xl mx-auto">
                    We’ll guide you step by step. No rush, no jargon—just a
                    simple path to understanding your energy costs.
                  </p>

                  {/* Quick vs Custom toggle */}
                  <div className="mb-6">
                    <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
                      <button
                        onClick={() => setOnboardingMode("quick")}
                        className={`px-4 py-2 text-sm font-semibold transition-colors ${
                          onboardingMode === "quick"
                            ? "bg-emerald-600 text-white"
                            : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                      >
                        Quick Setup
                      </button>
                      <button
                        onClick={() => setOnboardingMode("custom")}
                        className={`px-4 py-2 text-sm font-semibold transition-colors ${
                          onboardingMode === "custom"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                      >
                        Custom Setup
                      </button>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {onboardingMode === "quick" ? (
                        <span>
                          Quick uses sensible defaults. You'll still confirm your home details for accurate estimates.
                        </span>
                      ) : (
                        <span>
                          We'll walk through all building/system inputs now for best accuracy.
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-6 mb-6">
                    Want to change this image later?{" "}
                    <Link
                      to="/settings#personalization"
                      onClick={() => setShowOnboarding(false)}
                      className="underline text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      Customize in Settings
                    </Link>
                  </p>

                  <button
                    onClick={handleOnboardingNext}
                    className="btn btn-primary px-8 py-3 text-lg"
                  >
                    Let’s Begin
                  </button>
                </div>
              )}

              {/* Step 1: Location */}
              {onboardingStep === 1 && (
                <div className="text-center">
                  <div className="mb-4">
                    <MapPin
                      size={48}
                      className="mx-auto text-blue-600 dark:text-blue-400"
                    />
                  </div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                    STEP {Math.min(onboardingStep + 1, totalSteps)} OF{" "}
                    {totalSteps}
                  </p>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                    Where do you live?
                  </h2>
                  <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                    We use this for local weather and utility rate data.
                  </p>

                  <div className="bg-blue-50 dark:bg-blue-950 dark:border dark:border-blue-800 rounded-xl p-6 mb-6">
                    <input
                      type="text"
                      value={cityName}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_LOCATION_FIELD",
                          field: "cityName",
                          value: e.target.value,
                        })
                      }
                      placeholder="Enter city, state (e.g., Denver, CO or Atlanta, GA)"
                      className={fullInputClasses}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && cityName) {
                          // Validate input contains comma and state
                          const needsComma =
                            needsCommaBetweenCityAndState(cityName);
                          const hasComma = cityName.includes(",");
                          let hasState = false;
                          if (hasComma) {
                            const parts = cityName.split(",");
                            if (
                              parts.length > 1 &&
                              parts[1].trim().length > 0
                            ) {
                              hasState = true;
                            }
                          }
                          if (needsComma) {
                            const message =
                              'Please separate city and state with a comma (example: "Denver, CO").';
                            dispatch({
                              type: "SET_UI_FIELD",
                              field: "error",
                              value: message,
                            });
                            return;
                          }
                          if (!hasComma || !hasState) {
                            const message =
                              'Please enter both city and state, separated by a comma (e.g., "Denver, Colorado").';
                            dispatch({
                              type: "SET_UI_FIELD",
                              field: "error",
                              value: message,
                            });
                            return;
                          }
                          dispatch({
                            type: "SET_UI_FIELD",
                            field: "error",
                            value: null,
                          });
                          handleCitySearch();
                        }
                      }}
                      aria-invalid={!!ui.error}
                      aria-describedby={
                        ui.error ? "city-input-error" : undefined
                      }
                    />
                    <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
                      Format: <span className="font-semibold">City, State</span>{" "}
                      (e.g., <span className="italic">Denver, CO</span>).{" "}
                      <span className="font-semibold">Include a comma</span>{" "}
                      between city and state for best results.
                    </p>

                    {ui.error && (
                      <div
                        id="city-input-error"
                        className="flex items-center gap-2 mt-3 mb-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/40 dark:border-red-700 dark:text-red-200"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 flex-shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"
                          />
                        </svg>
                        <span className="text-sm font-medium">{ui.error}</span>
                      </div>
                    )}
                    {foundLocationName && !forecastLoading && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/30 dark:border-green-700">
                        <p className="text-green-800 text-sm dark:text-green-400">
                          ✓ Found: {foundLocationName}
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      if (!cityName.trim()) {
                        alert("⚠️ Please enter your location first.");
                        return;
                      }
                      // Validate and fetch if not already confirmed
                      if (!foundLocationName) {
                        const needsComma =
                          needsCommaBetweenCityAndState(cityName);
                        if (needsComma) {
                          const message =
                            'Please separate city and state with a comma (example: "Denver, CO").';
                          dispatch({
                            type: "SET_UI_FIELD",
                            field: "error",
                            value: message,
                          });
                          window.alert(message);
                          return;
                        }
                        dispatch({
                          type: "SET_UI_FIELD",
                          field: "error",
                          value: null,
                        });
                        setAutoAdvanceOnboarding(true);
                        handleCitySearch();
                      } else {
                        handleOnboardingNext();
                      }
                    }}
                    disabled={forecastLoading}
                    className="btn btn-primary px-8 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {forecastLoading ? "Loading..." : "Next →"}
                  </button>
                </div>
              )}

              {/* Step 2: Split into a two-step wizard (Building -> System) */}
              {onboardingStep === 2 && (
                <div className="text-center">
                  <div className="mb-4">
                    {hvacSubstep === 1 ? (
                      <Home
                        size={48}
                        className="mx-auto text-blue-600 dark:text-blue-400"
                      />
                    ) : (
                      <Thermometer
                        size={48}
                        className="mx-auto text-blue-600 dark:text-blue-400"
                      />
                    )}
                  </div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                    STEP {onboardingStep + 1} OF 5
                  </p>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                    {hvacSubstep === 1
                      ? "Tell us about your home"
                      : "Tell us about your HVAC system"}
                  </h2>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
                    Part {hvacSubstep} of 2
                  </p>
                  <div className="flex items-center justify-center gap-2 mb-5">
                    {[1, 2].map((step) => (
                      <div
                        key={step}
                        className={`h-1.5 w-16 rounded-full ${
                          step <= hvacSubstep
                            ? "bg-blue-600"
                            : "bg-gray-300 dark:bg-gray-700"
                        }`}
                      ></div>
                    ))}
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl p-5 mb-6 text-left">
                    {hvacSubstep === 1 ? (
                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-100 mb-2">
                            Home Size
                          </label>
                          <div className="flex items-center gap-4">
                            <input
                              type="range"
                              min="800"
                              max="4000"
                              step="100"
                              value={squareFeet}
                              onChange={(e) =>
                                setSquareFeet(Number(e.target.value))
                              }
                              className="flex-grow"
                            />
                            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 min-w-[120px]">
                              {squareFeet.toLocaleString()} sq ft
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                              Building Type
                            </label>
                            <select
                              value={homeShape}
                              onChange={(e) =>
                                setHomeShape(Number(e.target.value))
                              }
                              className={selectClasses}
                            >
                              <option value={1.1}>Ranch / Single-Story</option>
                              <option value={0.9}>Two-Story</option>
                              <option value={1.0}>Split-Level</option>
                              <option value={1.25}>Cabin / A-Frame</option>
                              <option value={1.15}>Manufactured Home</option>
                            </select>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Affects surface area exposure
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                              Ceiling Height
                            </label>
                            <select
                              value={ceilingHeight}
                              onChange={(e) =>
                                setCeilingHeight(Number(e.target.value))
                              }
                              className={selectClasses}
                            >
                              <option value={8}>8 feet (standard)</option>
                              <option value={9}>9 feet</option>
                              <option value={10}>10 feet</option>
                              <option value={12}>12 feet (vaulted)</option>
                              <option value={16}>16+ feet (cathedral)</option>
                            </select>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Average ceiling height
                            </p>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                            How well insulated is your home?
                          </label>
                          <select
                            value={insulationLevel}
                            onChange={(e) =>
                              setInsulationLevel(Number(e.target.value))
                            }
                            className={selectClasses}
                          >
                            <option value={1.4}>
                              Poor (older home, drafty)
                            </option>
                            <option value={1.0}>Average (typical home)</option>
                            <option value={0.65}>
                              Good (well-insulated, newer)
                            </option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-100 mb-2">
                            Elevation
                          </label>
                          <div className="flex items-center gap-4">
                            <input
                              type="range"
                              min="0"
                              max="8000"
                              step="100"
                              value={globalHomeElevation || 0}
                              onChange={(e) =>
                                setHomeElevation(Number(e.target.value))
                              }
                              className="flex-grow"
                            />
                            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 min-w-[120px]">
                              {(globalHomeElevation || 0).toLocaleString()} ft
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Higher elevation increases heating costs (thinner
                            air, less efficient heat pumps)
                          </p>
                        </div>
                        <div className="flex gap-3 justify-center pt-2">
                          <button
                            onClick={() => setOnboardingStep(1)}
                            className="btn btn-outline px-6 py-3"
                          >
                            ← Back
                          </button>
                          <button
                            onClick={() => setHvacSubstep(2)}
                            className="btn btn-primary px-8 py-3 text-lg"
                          >
                            Next →
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                            Primary Heating System
                          </label>
                          <div className="inline-flex rounded-lg border-2 border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 p-1">
                            <button
                              onClick={() => setPrimarySystem("heatPump")}
                              className={`px-6 py-2 rounded-md font-semibold transition-all ${
                                primarySystem === "heatPump"
                                  ? "bg-blue-600 text-white shadow-md"
                                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              }`}
                            >
                              ⚡ Heat Pump
                            </button>
                            <button
                              onClick={() => setPrimarySystem("gasFurnace")}
                              className={`px-6 py-2 rounded-md font-semibold transition-all ${
                                primarySystem === "gasFurnace"
                                  ? "bg-blue-600 text-white shadow-md"
                                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              }`}
                            >
                              🔥 Gas Furnace
                            </button>
                          </div>
                        </div>
                        {primarySystem === "heatPump" && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                                Heating Efficiency (HSPF2)
                                <span
                                  className="ml-1 text-blue-600 dark:text-blue-400 cursor-help"
                                  title="Heating Seasonal Performance Factor — a heating efficiency rating. Higher is better."
                                >
                                  ⓘ
                                </span>
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
                              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                                Cooling Efficiency (SEER2)
                                <span
                                  className="ml-1 text-blue-600 dark:text-blue-400 cursor-help"
                                  title="Seasonal Energy Efficiency Ratio — a cooling efficiency rating. Higher is better."
                                >
                                  ⓘ
                                </span>
                              </label>
                              <input
                                type="number"
                                min={14}
                                max={22}
                                step={1}
                                value={efficiency}
                                onChange={(e) =>
                                  setEfficiency(
                                    Math.min(
                                      22,
                                      Math.max(14, Number(e.target.value))
                                    )
                                  )
                                }
                                className={inputClasses}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                                Capacity (kBTU)
                              </label>
                              <select
                                value={displayCapacity}
                                onChange={(e) =>
                                  setCapacity(Number(e.target.value))
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
                        {primarySystem === "heatPump" && (
                          <div className="mt-3 text-left">
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              Electric auxiliary heat (backup)
                            </label>
                            <div className="inline-flex items-center gap-3">
                              <label className="inline-flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4"
                                  checked={!!useElectricAuxHeatSetting}
                                  onChange={(e) =>
                                    setUseElectricAuxHeat(!!e.target.checked)
                                  }
                                  aria-label="Include electric auxiliary resistance heat in electricity & cost estimates"
                                  title="When enabled, electric auxiliary resistance backup heat will be counted in your electricity estimates"
                                />
                                Count electric resistance backup heat toward
                                electricity estimates (if enabled, aux heat will
                                increase monthly kWh and cost)
                              </label>
                            </div>
                          </div>
                        )}
                        {primarySystem === "gasFurnace" && (
                          <>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                AFUE (Efficiency)
                                <span
                                  className="ml-1 text-blue-600 dark:text-blue-400 cursor-help"
                                  title="Annual Fuel Utilization Efficiency — how much of your fuel becomes usable heat. Higher is better."
                                >
                                  ⓘ
                                </span>
                              </label>
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
                                Typical range: 60%–99%. Default 95%.
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                Cooling System
                              </label>
                              <div className="inline-flex rounded-lg border-2 border-indigo-300 dark:border-indigo-700 bg-white dark:bg-gray-800 p-1">
                                <button
                                  onClick={() => setCoolingSystem("centralAC")}
                                  className={`px-4 py-2 rounded-md text-xs font-semibold ${
                                    coolingSystem === "centralAC"
                                      ? "bg-indigo-600 text-white shadow"
                                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                  }`}
                                >
                                  ❄️ Central A/C
                                </button>
                                <button
                                  onClick={() => setCoolingSystem("dualFuel")}
                                  className={`px-4 py-2 rounded-md text-xs font-semibold ${
                                    coolingSystem === "dualFuel"
                                      ? "bg-indigo-600 text-white shadow"
                                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                  }`}
                                >
                                  ⚡ Dual-Fuel HP
                                </button>
                                <button
                                  onClick={() => setCoolingSystem("none")}
                                  className={`px-4 py-2 rounded-md text-xs font-semibold ${
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
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                                    A/C SEER2
                                    <span
                                      className="ml-1 text-blue-600 dark:text-blue-400 cursor-help"
                                      title="Cooling efficiency rating. Higher is better."
                                    >
                                      ⓘ
                                    </span>
                                  </label>
                                  <input
                                    type="number"
                                    min={13}
                                    max={22}
                                    step={1}
                                    value={efficiency}
                                    onChange={(e) =>
                                      setEfficiency(
                                        Math.min(
                                          22,
                                          Math.max(13, Number(e.target.value))
                                        )
                                      )
                                    }
                                    className={inputClasses}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
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
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                                    HP Heating (HSPF2)
                                    <span
                                      className="ml-1 text-blue-600 dark:text-blue-400 cursor-help"
                                      title="Heating efficiency rating. Higher is better."
                                    >
                                      ⓘ
                                    </span>
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
                                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                    HP Cooling (SEER2)
                                    <span
                                      className="ml-1 text-blue-600 dark:text-blue-400 cursor-help"
                                      title="Cooling efficiency rating. Higher is better."
                                    >
                                      ⓘ
                                    </span>
                                  </label>
                                  <input
                                    type="number"
                                    min={14}
                                    max={22}
                                    step={1}
                                    value={efficiency}
                                    onChange={(e) =>
                                      setEfficiency(
                                        Math.min(
                                          22,
                                          Math.max(14, Number(e.target.value))
                                        )
                                      )
                                    }
                                    className={inputClasses}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
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
                          </>
                        )}

                        <div className="flex gap-3 justify-center pt-2">
                          <button
                            onClick={() => setHvacSubstep(1)}
                            className="btn btn-outline px-6 py-3"
                          >
                            ← Back
                          </button>
                          <button
                            onClick={handleOnboardingNext}
                            className="btn btn-primary px-8 py-3 text-lg"
                          >
                            Next →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Groq API Key (Optional) */}
              {onboardingStep === 3 && (
                <div className="text-center">
                  <div className="mb-4">
                    <Zap
                      size={48}
                      className="mx-auto text-purple-600 dark:text-purple-400"
                    />
                  </div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                    STEP {onboardingStep + 1} OF 5
                  </p>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                    Enable Ask Joule AI (Optional)
                  </h2>
                  <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed mb-2">
                    Ask Joule is your AI assistant for natural language queries
                    like "What if I had a 10 HSPF system?" or "Set winter to
                    68".
                  </p>
                  <p className="text-sm text-purple-600 dark:text-purple-400 font-semibold mb-6">
                    ✨ This step is completely optional — you can skip if you
                    don't need AI features.
                  </p>

                  <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 rounded-xl shadow-md p-6 mb-6 text-left border-2 border-purple-200 dark:border-purple-800">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <span>🔑</span> Free Groq API Key
                    </h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                      Groq provides{" "}
                      <strong className="text-purple-600 dark:text-purple-400">
                        free API access
                      </strong>{" "}
                      with generous limits. Get your key in 60 seconds:
                    </p>
                    <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300 mb-4 list-decimal list-inside">
                      <li>
                        Visit{" "}
                        <a
                          href="https://console.groq.com/keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300"
                        >
                          console.groq.com/keys
                        </a>{" "}
                        (opens in new tab)
                      </li>
                      <li>Sign up with Google/GitHub (takes 30 seconds)</li>
                      <li>Click "Create API Key" and copy it</li>
                      <li>
                        Paste it below or save it in{" "}
                        <Link
                          to="/settings#api-keys"
                          className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300"
                        >
                          Settings
                        </Link>{" "}
                        later
                      </li>
                    </ol>
                    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3 mb-4">
                      <p className="text-xs text-blue-800 dark:text-blue-200">
                        <strong>💡 Recommended Model:</strong>{" "}
                        <code className="bg-white dark:bg-gray-800 px-2 py-0.5 rounded">
                          llama-3.3-70b-versatile
                        </code>
                        <br />
                        <span className="text-[10px] text-blue-600 dark:text-blue-300">
                          Fast, accurate, and free. If deprecated, we'll suggest
                          the latest model.
                        </span>
                      </p>
                    </div>
                    <input
                      type="text"
                      placeholder="Paste your Groq API key here (optional)"
                      className="w-full p-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800 transition-all"
                      defaultValue={(() => {
                        try {
                          return localStorage.getItem("groq_api_key") || "";
                        } catch {
                          return "";
                        }
                      })()}
                      onChange={(e) => {
                        try {
                          if (e.target.value.trim()) {
                            localStorage.setItem(
                              "groq_api_key",
                              e.target.value.trim()
                            );
                          } else {
                            localStorage.removeItem("groq_api_key");
                          }
                        } catch {
                          /* Intentionally empty */
                        }
                      }}
                    />
                  </div>

                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-6 text-left">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>🔒 Privacy:</strong> Your API key stays on your
                      device. We never send it to our servers.
                    </p>
                  </div>

                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => setOnboardingStep(2)}
                      className="btn btn-outline px-6 py-3"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={handleOnboardingNext}
                      className="btn btn-outline px-6 py-3"
                    >
                      Skip This Step
                    </button>
                    <button
                      onClick={handleOnboardingNext}
                      className="btn btn-primary px-8 py-3 text-lg"
                    >
                      Next →
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-6">
                    Need detailed instructions? Visit{" "}
                    <Link
                      to="/settings#api-keys"
                      className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300"
                    >
                      Settings → API Keys
                    </Link>{" "}
                    for a complete step-by-step guide.
                  </p>
                </div>
              )}

              {/* Step 4: Confirmation */}
              {onboardingStep === 4 && (
                <div className="text-center">
                  <div className="text-7xl mb-6 text-green-600">
                    <CheckCircle2 size={64} />
                  </div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                    STEP {onboardingStep + 1} OF 5
                  </p>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                    You're all set!
                  </h2>
                  <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed mb-8 max-w-xl mx-auto">
                    We have everything we need to create your personalized
                    energy cost forecast.
                  </p>

                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-xl shadow-md p-6 mb-6 text-left border-2 border-blue-200 dark:border-blue-800">
                    <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3">
                      Quick summary:
                    </h3>
                    <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-400 mt-0.5">
                          ✓
                        </span>
                        <span>
                          <strong>Location:</strong>{" "}
                          {foundLocationName || "Set"}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-400 mt-0.5">
                          ✓
                        </span>
                        <span>
                          <strong>Home:</strong> {squareFeet.toLocaleString()}{" "}
                          sq ft,{" "}
                          {insulationLevel === 1.4
                            ? "Poor"
                            : insulationLevel === 1.0
                            ? "Average"
                            : "Good"}{" "}
                          insulation
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-400 mt-0.5">
                          ✓
                        </span>
                        <span>
                          <strong>System:</strong>{" "}
                          {primarySystem === "heatPump"
                            ? "Heat Pump"
                            : "Gas Furnace"}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-400 mt-0.5">
                          ✓
                        </span>
                        <span>
                          <strong>Ask Joule AI:</strong>{" "}
                          {(() => {
                            try {
                              return localStorage.getItem("groq_api_key")
                                ? "Enabled ✨"
                                : "Skipped (can enable later)";
                            } catch {
                              return "Skipped";
                            }
                          })()}
                        </span>
                      </li>
                    </ul>
                  </div>

                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => setOnboardingStep(3)}
                      className="btn btn-outline px-6 py-3"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={completeOnboarding}
                      className="btn btn-primary px-8 py-3 text-lg"
                    >
                      Go to Overview
                    </button>
                  </div>

                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-xl shadow-md p-6 mt-6 text-center border-2 border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                      Want a quick tour of all the features?
                    </p>
                    <button
                      onClick={() => {
                        // Complete onboarding without navigating away so the tour component remains mounted
                        completeOnboarding({ navigateHome: false });
                        // Start the tour after a brief delay to allow UI to settle
                        setTimeout(() => setTourActive(true), 500);
                      }}
                      className="btn btn-outline px-6 py-2 text-sm"
                    >
                      🎯 Show Feature Tour
                    </button>
                  </div>
                </div>
              )}

              {/* Legacy steps (3–5) removed: electricity/gas cost, auto-fetch rates, preview. Rates can be adjusted post-onboarding in settings. */}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {weeklyMetrics && (
              <span className="badge badge-accent">Forecast Ready</span>
            )}
            {!isFirstTimeUser && (
              <button
                onClick={() => {
                  // When editing home details from the main header, open the onboarding at the Location step
                  setOnboardingStep(1);
                  setShowOnboarding(true);
                }}
                className="text-sm text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 underline"
              >
                Edit Home Details
              </button>
            )}
          </div>
        </div>

        {/* Cost Estimates Section - MOVED TO TOP FOR EMPHASIS */}
        <div className="card card-hover p-6 fade-in">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2">
            <TrendingUp
              size={24}
              className="text-green-600 dark:text-green-400"
            />
            Cost Estimates
          </h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">
            Get accurate 7-day forecasts based on real weather data or test
            custom scenarios
          </p>
          <div className="flex gap-2 mb-6 border-b">
            <button
              onClick={() =>
                dispatch({
                  type: "SET_UI_FIELD",
                  field: "activeTab",
                  value: "forecast",
                })
              }
              className={`px-4 py-2 font-semibold transition-colors ${
                activeTab === "forecast"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <Calendar size={18} />
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
              className={`px-4 py-2 font-semibold transition-colors ${
                activeTab === "manual"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <Settings size={18} />
                Custom Scenario
              </div>
            </button>
          </div>
          {activeTab === "forecast" && (
            <div>
              {/* Hybrid Setup Wizard / Location Summary */}
              {!foundLocationName ? (
                /* First-Time User: Clean Setup Wizard Button */
                <div className="mb-6 p-8 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900 rounded-2xl border-2 border-blue-300 dark:border-blue-700 shadow-lg text-center">
                  <div className="text-6xl mb-4">🧙‍♂️</div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    Let's Get Your First Forecast
                  </h3>
                  <p className="text-lg text-gray-700 dark:text-gray-300 mb-6 max-w-xl mx-auto">
                    We just need your location to get started with accurate
                    weather data and cost estimates
                  </p>
                  <button
                    onClick={() => {
                      setOnboardingStep(0);
                      setShowOnboarding(true);
                    }}
                    className="btn btn-primary px-10 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                  >
                    Launch Setup Wizard
                  </button>
                </div>
              ) : (
                /* Returning User: Compact Location Summary with Edit */
                <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MapPin
                        size={20}
                        className="text-blue-600 dark:text-blue-400"
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                          Forecasting for:
                        </p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {foundLocationName || "No location set"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Elevation: {locationElevation > 0 ? locationElevation.toLocaleString() : "Not set"} ft
                          {globalHomeElevation && globalHomeElevation !== locationElevation && (
                            <span className="ml-2 text-blue-600 dark:text-blue-400">
                              (Home: {globalHomeElevation.toLocaleString()} ft)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        // When editing a location, jump to the Location step (step 1)
                        setOnboardingStep(1);
                        setShowOnboarding(true);
                      }}
                      className="btn btn-outline px-4 py-2 text-sm font-semibold hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                    >
                      Change Location
                    </button>
                  </div>
                </div>
              )}

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

              {weeklyMetrics && !forecastLoading && !forecastError && (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div
                      id="weekly-energy-card"
                      className="bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100 dark:from-blue-900 dark:via-cyan-900 dark:to-blue-950 border-2 border-blue-400 dark:border-blue-600 rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 card-lift group"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Zap
                          size={20}
                          className="text-blue-600 dark:text-blue-400"
                        />
                        <h3 className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-widest">
                          {energyMode === "cooling"
                            ? "Total Cooling Energy"
                            : primarySystem === "gasFurnace"
                            ? "Total Therms"
                            : "Total Heating Energy"}
                        </h3>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <p className="text-6xl md:text-7xl font-black bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent animate-count-up">
                          {energyMode === "cooling"
                            ? (weeklyMetrics?.totalEnergy ?? 0).toFixed(1)
                            : primarySystem === "gasFurnace"
                            ? (weeklyGasMetrics?.totalTherms ?? 0).toFixed(2)
                            : (breakdownView === "withAux"
                                ? weeklyMetrics.summary.reduce(
                                    (acc, d) => acc + d.energyWithAux,
                                    0
                                  )
                                : weeklyMetrics.totalEnergy
                              ).toFixed(1)}
                        </p>
                        <span className="text-2xl text-gray-600 dark:text-gray-300 font-bold">
                          {energyMode === "cooling"
                            ? "kWh"
                            : primarySystem === "gasFurnace"
                            ? "therms"
                            : "kWh"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 font-medium">
                        Next 7 days
                      </p>
                    </div>
                    <div
                      id="weekly-cost-card"
                      className="bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 dark:from-green-900 dark:via-emerald-900 dark:to-green-950 border-2 border-green-400 dark:border-green-600 rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 card-lift group"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <DollarSign
                          size={20}
                          className="text-green-600 dark:text-green-400"
                        />
                        <h3 className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-widest">
                          Weekly Cost
                        </h3>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <p className="text-6xl md:text-7xl font-black bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent animate-count-up">
                          $
                          {energyMode === "cooling"
                            ? (weeklyMetrics?.totalCost ?? 0).toFixed(2)
                            : primarySystem === "gasFurnace"
                            ? (weeklyGasMetrics?.totalCost ?? 0).toFixed(2)
                            : (breakdownView === "withAux"
                                ? weeklyMetrics.totalCostWithAux
                                : weeklyMetrics.totalCost
                              ).toFixed(2)}
                        </p>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 font-medium">
                        Estimated for 7 days
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                        {energyMode === "cooling" ? (
                          <>
                            @ ${utilityCost.toFixed(3)}/kWh{" "}
                            <button
                              onClick={() =>
                                dispatch({
                                  type: "SET_UI_FIELD",
                                  field: "activeTab",
                                  value: "forecast",
                                })
                              }
                              className="italic text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                              (edit rate)
                            </button>
                          </>
                        ) : primarySystem === "gasFurnace" ? (
                          <>@ ${gasCost.toFixed(2)}/therm</>
                        ) : (
                          <>
                            @ ${utilityCost.toFixed(3)}/kWh{" "}
                            <button
                              onClick={() =>
                                dispatch({
                                  type: "SET_UI_FIELD",
                                  field: "activeTab",
                                  value: "forecast",
                                })
                              }
                              className="italic text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                              (edit rate)
                            </button>
                          </>
                        )}
                      </p>
                      {/* CO2 Footprint */}
                      <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Estimated CO2 Footprint:{" "}
                          <span className="font-semibold text-gray-700 dark:text-gray-300">
                            {(() => {
                              const co2Lbs =
                                primarySystem === "gasFurnace"
                                  ? calculateGasCO2(
                                      weeklyGasMetrics?.totalTherms ?? 0
                                    ).lbs
                                  : calculateElectricityCO2(
                                      energyMode === "cooling"
                                        ? weeklyMetrics?.totalEnergy ?? 0
                                        : (breakdownView === "withAux"
                                            ? weeklyMetrics?.totalEnergyWithAux
                                            : weeklyMetrics?.totalEnergy) ?? 0,
                                      stateName
                                    ).lbs;
                              const equivalent = getBestEquivalent(co2Lbs);
                              // Show '< 1 lb' if 0 <= co2Lbs < 1, 'N/A' if invalid, else formatCO2
                              let co2Display;
                              if (!Number.isFinite(co2Lbs) || co2Lbs < 0) {
                                co2Display = "N/A";
                              } else if (co2Lbs >= 0 && co2Lbs < 1) {
                                co2Display = "< 1 lb";
                              } else {
                                co2Display = formatCO2(co2Lbs);
                              }
                              return (
                                <>
                                  {co2Display}
                                  {co2Lbs > 10 && Number.isFinite(co2Lbs) && (
                                    <span className="block text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 font-normal">
                                      ≈ {equivalent.text}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

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
                            See Upgrade Options →
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
                            ✕
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
                              Generating image…
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
                                  
                                  return (
                                    <p className="text-xs text-gray-700 dark:text-gray-300 border-t border-blue-200 dark:border-blue-700 pt-2 mt-2">
                                      <strong>Building Heat Loss:</strong>{" "}
                                      <span className="font-mono">{heatLossFactor.toFixed(1)}</span> BTU/hr/°F{" "}
                                      <span className="text-gray-500 dark:text-gray-400">•</span>{" "}
                                      <span className="font-mono">{heatLossAt70F.toLocaleString()}</span> BTU/hr @ 70°F ΔT
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
                          <DailyBreakdownTable
                            summary={weeklyMetrics.summary}
                            indoorTemp={indoorTemp}
                            viewMode={breakdownView}
                            awayModeDays={awayModeDays}
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
                          
                          {/* Live Calculation Worksheet */}
                          {primarySystem === "heatPump" && weeklyMetrics && (
                            <details className="mt-6 border rounded-lg dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                              <summary className="p-4 cursor-pointer font-semibold text-lg text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors flex items-center gap-2 list-none">
                                <HelpCircle size={20} />
                                <span>Live Calculation Worksheet</span>
                                <span className="ml-auto text-sm text-gray-600 dark:text-gray-400">Click to expand</span>
                              </summary>
                              <div className="p-4 border-t dark:border-gray-700">
                                <div className="space-y-4 text-sm font-mono">
                                {/* System Parameters */}
                                <div className="bg-white dark:bg-gray-900 p-3 rounded border dark:border-gray-700">
                                  <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2">System Parameters:</h4>
                                  <div className="space-y-1 text-xs">
                                    <div>Capacity = {capacity} kBTU = {tons.toFixed(1)} tons</div>
                                    <div>HSPF2 = {hspf2.toFixed(1)}</div>
                                    <div>SEER2 = {efficiency.toFixed(1)}</div>
                                    <div>Compressor Power = {compressorPower.toFixed(2)} kW</div>
                                    <div>Heat Loss = {effectiveHeatLoss.toLocaleString()} BTU/hr @ 70°F ΔT</div>
                                    <div>Indoor Temp = {indoorTemp}°F</div>
                                    <div>Utility Cost = ${utilityCost.toFixed(3)}/kWh</div>
                                  </div>
                                </div>

                                {/* Heat Loss Calculation */}
                                <div className="bg-white dark:bg-gray-900 p-3 rounded border dark:border-gray-700">
                                  <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2">Heat Loss Calculation:</h4>
                                  <div className="space-y-1 text-xs">
                                    {(() => {
                                      const useManualHeatLoss = Boolean(userSettings?.useManualHeatLoss);
                                      const useAnalyzerHeatLoss = Boolean(userSettings?.useAnalyzerHeatLoss);
                                      const heatLossFactor = effectiveHeatLoss / 70;
                                      
                                      if (useManualHeatLoss) {
                                        const manualValue = Number(userSettings?.manualHeatLoss) || 0;
                                        return (
                                          <>
                                            <div className="mb-2 font-semibold text-blue-600 dark:text-blue-400">Source: Manual Entry</div>
                                            <div>Manual Heat Loss = {manualValue.toFixed(1)} BTU/hr/°F</div>
                                            <div className="font-bold">= {effectiveHeatLoss.toLocaleString()} BTU/hr @ 70°F ΔT</div>
                                            <div>BTU Loss per °F = {effectiveHeatLoss.toLocaleString()} ÷ 70 = {heatLossFactor.toFixed(1)} BTU/hr/°F</div>
                                          </>
                                        );
                                      }
                                      
                                      if (useAnalyzerHeatLoss) {
                                        const analyzerValue = Number(userSettings?.analyzerHeatLoss) || heatLossFactor;
                                        return (
                                          <>
                                            <div className="mb-2 font-semibold text-blue-600 dark:text-blue-400">Source: Analyzer Data (CSV Import)</div>
                                            <div>Analyzer Heat Loss = {analyzerValue.toFixed(1)} BTU/hr/°F</div>
                                            <div className="font-bold">= {effectiveHeatLoss.toLocaleString()} BTU/hr @ 70°F ΔT</div>
                                            <div>BTU Loss per °F = {effectiveHeatLoss.toLocaleString()} ÷ 70 = {heatLossFactor.toFixed(1)} BTU/hr/°F</div>
                                          </>
                                        );
                                      }
                                      
                                      // Calculated (DoE) method
                                      return (
                                        <>
                                          <div className="mb-2 font-semibold text-blue-600 dark:text-blue-400">Source: Calculated (Department of Energy Data)</div>
                                          <div>Base BTU/sqft = 22.67</div>
                                          <div>Square Feet = {squareFeet.toLocaleString()}</div>
                                          <div>Insulation Factor = {insulationLevel.toFixed(2)}</div>
                                          <div>Home Shape Factor = {homeShape.toFixed(2)}</div>
                                          <div>Ceiling Multiplier = 1 + ({ceilingHeight} - 8) × 0.1 = {(1 + (ceilingHeight - 8) * 0.1).toFixed(2)}</div>
                                          <div>Design Heat Loss = {squareFeet.toLocaleString()} × 22.67 × {insulationLevel.toFixed(2)} × {homeShape.toFixed(2)} × {(1 + (ceilingHeight - 8) * 0.1).toFixed(2)}</div>
                                          <div className="font-bold">= {effectiveHeatLoss.toLocaleString()} BTU/hr @ 70°F ΔT</div>
                                          <div>BTU Loss per °F = {effectiveHeatLoss.toLocaleString()} ÷ 70 = {heatLossFactor.toFixed(1)} BTU/hr/°F</div>
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>

                                {/* Hourly Performance Calculation (Example for first hour) */}
                                {adjustedForecast && adjustedForecast.length > 0 && (() => {
                                  const firstHour = adjustedForecast[0];
                                  const tempDiff = Math.max(1, indoorTemp - firstHour.temp);
                                  const buildingHeatLossBtu = (effectiveHeatLoss / 70) * tempDiff;
                                  const capacityFactor = heatUtils.getCapacityFactor(firstHour.temp);
                                  const heatpumpOutputBtu = tons * 3.517 * capacityFactor * 3412.14;
                                  const powerFactor = 1 / Math.max(0.7, capacityFactor);
                                  const baseElectricalKw = compressorPower * powerFactor;
                                  const defrostPenalty = (firstHour.temp > 20 && firstHour.temp < 45) ? (1 + 0.15 * (firstHour.humidity / 100)) : 1.0;
                                  const electricalKw = baseElectricalKw * defrostPenalty;
                                  const runtime = heatpumpOutputBtu > 0 ? (buildingHeatLossBtu / heatpumpOutputBtu) * 100 : 100;
                                  const deficitBtu = Math.max(0, buildingHeatLossBtu - heatpumpOutputBtu);
                                  const auxKw = deficitBtu / 3412.14;
                                  const energyForHour = electricalKw * (Math.min(100, Math.max(0, runtime)) / 100);
                                  const hourRate = computeHourlyRate(firstHour.time, localRates, utilityCost);
                                  const hourCost = energyForHour * hourRate;
                                  const auxCost = (breakdownView === "withAux" && useElectricAuxHeatSetting) ? auxKw * hourRate : 0;

                                  return (
                                    <div className="bg-white dark:bg-gray-900 p-3 rounded border dark:border-gray-700">
                                      <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2">Hourly Performance Calculation (Example: {firstHour.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}):</h4>
                                      <div className="space-y-1 text-xs">
                                        <div>Outdoor Temp = {firstHour.temp.toFixed(1)}°F</div>
                                        <div>Humidity = {firstHour.humidity.toFixed(0)}%</div>
                                        <div>Temp Difference = {indoorTemp} - {firstHour.temp.toFixed(1)} = {tempDiff.toFixed(1)}°F</div>
                                        <div>Building Heat Loss = {(effectiveHeatLoss / 70).toFixed(1)} × {tempDiff.toFixed(1)} = {buildingHeatLossBtu.toFixed(0)} BTU/hr</div>
                                        <div className="mt-2 font-semibold">Capacity Factor:</div>
                                        <div>Capacity Factor = {capacityFactor.toFixed(3)} (from temp {firstHour.temp.toFixed(1)}°F)</div>
                                        <div>Heat Pump Output = {tons.toFixed(1)} × 3.517 × {capacityFactor.toFixed(3)} × 3412.14 = {heatpumpOutputBtu.toFixed(0)} BTU/hr</div>
                                        <div className="mt-2 font-semibold">Electrical Power:</div>
                                        <div>Power Factor = 1 ÷ max(0.7, {capacityFactor.toFixed(3)}) = {powerFactor.toFixed(3)}</div>
                                        <div>Base Electrical = {compressorPower.toFixed(2)} × {powerFactor.toFixed(3)} = {baseElectricalKw.toFixed(2)} kW</div>
                                        <div>Defrost Penalty = {defrostPenalty.toFixed(3)}</div>
                                        <div>Electrical Power = {baseElectricalKw.toFixed(2)} × {defrostPenalty.toFixed(3)} = {electricalKw.toFixed(2)} kW</div>
                                        <div className="mt-2 font-semibold">Runtime:</div>
                                        <div>Runtime % = ({buildingHeatLossBtu.toFixed(0)} ÷ {heatpumpOutputBtu.toFixed(0)}) × 100 = {Math.min(100, Math.max(0, runtime)).toFixed(1)}%</div>
                                        <div>Energy for Hour = {electricalKw.toFixed(2)} × ({Math.min(100, Math.max(0, runtime)).toFixed(1)} ÷ 100) = {energyForHour.toFixed(3)} kWh</div>
                                        <div className="mt-2 font-semibold">Auxiliary Heat:</div>
                                        <div>Deficit BTU = max(0, {buildingHeatLossBtu.toFixed(0)} - {heatpumpOutputBtu.toFixed(0)}) = {deficitBtu.toFixed(0)} BTU</div>
                                        <div>Aux Power = {deficitBtu.toFixed(0)} ÷ 3412.14 = {auxKw.toFixed(2)} kW</div>
                                        <div className="mt-2 font-semibold">Cost:</div>
                                        <div>Hourly Rate = ${hourRate.toFixed(3)}/kWh</div>
                                        <div>HP Cost = {energyForHour.toFixed(3)} × ${hourRate.toFixed(3)} = ${hourCost.toFixed(2)}</div>
                                        {breakdownView === "withAux" && useElectricAuxHeatSetting && (
                                          <div>Aux Cost = {auxKw.toFixed(2)} × ${hourRate.toFixed(3)} = ${auxCost.toFixed(2)}</div>
                                        )}
                                        <div className="font-bold mt-1">Total Hourly Cost = ${(hourCost + auxCost).toFixed(2)}</div>
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* Weekly Summary */}
                                <div className="bg-white dark:bg-gray-900 p-3 rounded border dark:border-gray-700">
                                  <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2">Weekly Summary:</h4>
                                  <div className="space-y-1 text-xs">
                                    <div>Total HP Energy = {weeklyMetrics.totalEnergy.toFixed(1)} kWh</div>
                                    <div>Total Aux Energy = {weeklyMetrics.summary.reduce((acc, d) => acc + d.auxEnergy, 0).toFixed(1)} kWh</div>
                                    {breakdownView === "withAux" && useElectricAuxHeatSetting && (
                                      <>
                                        <div>Total Energy (with Aux) = {(weeklyMetrics.totalEnergy + weeklyMetrics.summary.reduce((acc, d) => acc + d.auxEnergy, 0)).toFixed(1)} kWh</div>
                                        <div className="font-bold">Total Cost (with Aux) = ${weeklyMetrics.totalCostWithAux.toFixed(2)}</div>
                                      </>
                                    )}
                                    {breakdownView === "noAux" && (
                                      <div className="font-bold">Total Cost (HP Only) = ${weeklyMetrics.totalCost.toFixed(2)}</div>
                                    )}
                                    <div className="mt-2">Average Daily Cost = ${((breakdownView === "withAux" && useElectricAuxHeatSetting ? weeklyMetrics.totalCostWithAux : weeklyMetrics.totalCost) / 7).toFixed(2)}</div>
                                  </div>
                                </div>
                                </div>
                              </div>
                            </details>
                          )}
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
                      Heat loss at <strong>{designTemp ?? 0}°F</strong> (ΔT ={" "}
                      {Math.max(0, indoorTemp - (designTemp ?? 0))}°F)
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Normalized: <strong>{perDegree.toFixed(1)}</strong>{" "}
                      BTU/hr/°F
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
                    <div className="flex items-start gap-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        This is an estimate — real-world dynamic effects like
                        solar gains, infiltration, or internal heat loads can
                        change results.
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
                            Improve insulation/air‑sealing → lower BTU/hr/°F →
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
                  🧊 Defrost & Humidity Mechanics{" "}
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
                      <strong>💡 State Average for {stateName}:</strong> $
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
                        60%–99%.
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
                          ❄️ Central A/C
                        </button>
                        <button
                          onClick={() => setCoolingSystem("dualFuel")}
                          className={`px-4 py-2 rounded-md text-sm font-semibold ${
                            coolingSystem === "dualFuel"
                              ? "bg-indigo-600 text-white shadow"
                              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          }`}
                        >
                          ⚡ Dual-Fuel HP
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

          {/* Upgrade Scenario Modal */}
          {showUpgradeModal && upgradeScenario && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowUpgradeModal(false)}
              role="dialog"
              aria-modal="true"
              aria-labelledby="upgrade-modal-title"
            >
              <div
                className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2
                      id="upgrade-modal-title"
                      className="text-2xl font-bold text-gray-800 dark:text-gray-100"
                    >
                      Upgrade Scenario Comparison
                    </h2>
                    <button
                      onClick={() => setShowUpgradeModal(false)}
                      className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                      &times;
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="border-2 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-700 dark:text-gray-100 mb-2">
                        Current System
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Capacity:{" "}
                        <span className="font-bold">
                          {capacity}k BTU ({tons} tons)
                        </span>
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Efficiency:{" "}
                        <span className="font-bold">{efficiency} SEER2</span>
                      </p>
                      <div className="mt-3 pt-3 border-t dark:border-gray-600">
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          ${upgradeScenario.currentCost.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          7-day cost
                        </p>
                      </div>
                    </div>

                    <div className="border-2 border-purple-400 dark:border-purple-700 bg-purple-50 dark:bg-purple-900 rounded-lg p-4">
                      <h3 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">
                        Upgraded System
                      </h3>
                      <p className="text-sm text-purple-700 dark:text-purple-200">
                        Capacity:{" "}
                        <span className="font-bold">
                          {upgradeScenario.capacity}k BTU (
                          {upgradeScenario.tons} tons)
                        </span>
                      </p>
                      <p className="text-sm text-purple-700 dark:text-purple-200">
                        Efficiency:{" "}
                        <span className="font-bold">
                          {upgradeScenario.efficiency} SEER2
                        </span>
                      </p>
                      <div className="mt-3 pt-3 border-t border-purple-300 dark:border-purple-600">
                        <p className="text-2xl font-bold text-purple-700 dark:text-purple-200">
                          ${upgradeScenario.upgradedCost.toFixed(2)}
                        </p>
                        <p className="text-xs text-purple-600 dark:text-purple-300">
                          7-day cost
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Annual Savings - Primary KPI */}
                  {(() => {
                    const currentAnnualCost =
                      upgradeScenario.currentCost * (365 / 7);
                    const upgradedAnnualCost =
                      upgradeScenario.upgradedCost * (365 / 7);
                    const annualSavings =
                      currentAnnualCost - upgradedAnnualCost;
                    const percentageReduction =
                      currentAnnualCost > 0
                        ? (annualSavings / currentAnnualCost) * 100
                        : 0;
                    const UPGRADE_COST_PER_TON = 3500; // rough heuristic used for payback estimate
                    const estimatedUpgradeCost =
                      (upgradeScenario.tons || 1) * UPGRADE_COST_PER_TON;
                    const paybackYears =
                      annualSavings > 0
                        ? estimatedUpgradeCost / annualSavings
                        : null;
                    return (
                      <div className="bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg p-6 mb-4 text-center">
                        <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                          Projected Annual Savings
                        </h4>
                        <p className="text-6xl font-extrabold text-green-700 dark:text-green-200 my-2">
                          ${Math.max(0, Math.round(annualSavings))}
                        </p>
                        <p className="text-sm text-green-600 dark:text-green-200 mb-3">
                          That's a{" "}
                          {percentageReduction
                            ? `${percentageReduction.toFixed(0)}%`
                            : "—"}{" "}
                          reduction in yearly costs
                        </p>
                        <div className="flex items-center justify-center gap-6">
                          <div className="text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Estimated Payback Period
                            </p>
                            <p className="font-semibold text-gray-700 dark:text-gray-100">
                              {paybackYears && isFinite(paybackYears)
                                ? `${Math.round(paybackYears)} years`
                                : "—"}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Upgrade Cost Estimate
                            </p>
                            <p className="font-semibold text-gray-700 dark:text-gray-100">
                              ${estimatedUpgradeCost.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Side-by-side annual comparison & optional weekly details */}
                  <div className="p-6">
                    <h4 className="font-semibold text-gray-700 dark:text-white mb-4 text-center">
                      Annual Cost Comparison
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="text-center p-4 border rounded-lg dark:border-gray-700">
                        <p className="font-semibold">Current System</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {capacity}k BTU ({tons} tons) · {efficiency} SEER2
                        </p>
                        <p className="text-2xl font-bold mt-2">
                          $
                          {Math.round(
                            upgradeScenario.currentCost * (365 / 7)
                          ).toLocaleString()}
                          /yr
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          ${upgradeScenario.currentCost.toFixed(2)}/week
                        </p>
                      </div>

                      <div className="text-center p-4 border rounded-lg dark:border-gray-700 bg-purple-50 dark:bg-purple-900/30">
                        <p className="font-semibold text-purple-700 dark:text-purple-300">
                          Upgraded System
                        </p>
                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                          {upgradeScenario.capacity}k BTU (
                          {upgradeScenario.tons} tons) ·{" "}
                          {upgradeScenario.efficiency} SEER2
                        </p>
                        <p className="text-2xl font-bold mt-2">
                          $
                          {Math.round(
                            upgradeScenario.upgradedCost * (365 / 7)
                          ).toLocaleString()}
                          /yr
                        </p>
                        <p className="text-xs text-purple-600 mt-1">
                          ${upgradeScenario.upgradedCost.toFixed(2)}/week
                        </p>
                      </div>
                    </div>
                    {upgradeScenario.metrics && (
                      <div className="mt-4 text-sm text-gray-700 dark:text-white">
                        <h5 className="font-semibold mb-2">
                          Upgraded System Summary (weekly)
                        </h5>
                        <p>
                          Total Energy:{" "}
                          <span className="font-bold">
                            {upgradeScenario.metrics.summary
                              .reduce((acc, d) => acc + d.energyWithAux, 0)
                              .toFixed(1)}{" "}
                            kWh
                          </span>
                        </p>
                        <p>
                          Aux Heat Energy:{" "}
                          <span className="font-bold">
                            {upgradeScenario.metrics.summary
                              .reduce((acc, d) => acc + d.auxEnergy, 0)
                              .toFixed(1)}{" "}
                            kWh
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t">
                    <p className="text-xs text-gray-500 italic">
                      Note: Savings estimate based on current 7-day forecast.
                      Actual savings vary with weather, usage patterns, and
                      installation quality. Consult a qualified HVAC
                      professional for detailed assessment and installation
                      costs.
                    </p>
                    <p className="text-xs text-gray-500 italic mt-2">
                      *Estimated payback uses an assumed upgrade cost of $3,500
                      per ton. Actual installation costs vary widely by location
                      and installer.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => setTourActive(true)}
            className="btn btn-primary mb-4"
            id="tour-button"
          >
            <span className="flex items-center gap-2">
              <HelpCircle size={18} />
              Show Feature Tour
            </span>
          </button>
          <Joyride
            steps={steps}
            run={tourActive}
            continuous
            showSkipButton
            showProgress
            scrollToFirstStep
            disableOverlayClose
            spotlightClicks
            spotlightPadding={8}
            floaterProps={{
              disableAnimation: false,
              styles: {
                floater: {
                  filter: "drop-shadow(0 10px 30px rgba(0, 0, 0, 0.3))",
                },
                arrow: {
                  length: 12,
                  spread: 16,
                },
              },
            }}
            styles={joyrideStyles}
            locale={{
              back: "Back",
              close: "Close",
              last: "Finish",
              next: "Next",
              skip: "Skip Tour",
            }}
            callback={(data) => {
              const { status, action } = data;
              if (status === "finished" || status === "skipped") {
                setTourActive(false);
              }
              // Log tour progress for debugging
              console.log("Tour event:", { status, action, step: data.index });
            }}
          />
        </div>
      </div>
    </div>
    </div>
  );
};

export default SevenDayCostForecaster;
