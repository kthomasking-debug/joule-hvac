import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useOutletContext, Link, useNavigate } from "react-router-dom";
import {
  Calendar,
  Thermometer,
  MapPin,
  DollarSign,
  AlertTriangle,
  Cloud,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Calculator,
  CheckCircle2,
  Settings,
  Info,
  GraduationCap,
  BarChart2,
  BarChart3,
  Zap,
  Sun,
  Moon,
  Clock,
  TrendingDown,
  Home,
  RotateCcw,
  Send,
  Loader,
  Trash2,
  Copy,
  Upload,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  inputClasses,
  fullInputClasses,
  selectClasses,
} from "../../lib/uiClasses";
import ThermostatScheduleCard from "../../components/ThermostatScheduleCard";
import ThermostatScheduleClock from "../../components/ThermostatScheduleClock";
import AnswerCard from "../../components/AnswerCard";
import {
  loadThermostatSettings,
} from "../../lib/thermostatSettings";
import OneClickOptimizer from "../../components/optimization/OneClickOptimizer";
import useMonthlyForecast from "../../hooks/useMonthlyForecast";
import useHistoricalHourly from "../../hooks/useHistoricalHourly";
import {
  estimateMonthlyCoolingCostFromCDD,
  estimateMonthlyHeatingCostFromHDD,
} from "../../lib/budgetUtils";
import { getAnnualHDD, getAnnualCDD } from "../../lib/hddData";
import { 
  BASE_BTU_PER_SQFT,
  BASE_COOLING_LOAD_FACTOR,
  STATE_NAME_BY_ABBR,
  normalize 
} from "./constants";
import {
  getTypicalHDD,
  estimateTypicalHDDCost,
  estimateTypicalCDDCost
} from "./calculations";
import * as heatUtils from "../../lib/heatUtils";
import { getCached, setCached } from "../../utils/cachedStorage";
import { shouldUseLearnedHeatLoss } from "../../utils/billDataUtils";
import { isAIAvailable, callLLM, callLLMStreaming, warmLLM } from "../../lib/aiProvider";
import { useSpeechRecognition } from "../../hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "../../hooks/useSpeechSynthesis";
import { extractBillToStorage, isOnboardingExtractionFromContinue, clearOnboardingExtractionFlag } from "../../lib/billExtractor";
import { getBillMonthForComparison, parseBillDateRange } from "../../lib/bills/billParser";
import {
  defaultFixedChargesByState,
  defaultFallbackFixedCharges,
  normalizeStateToAbbreviation,
} from "../../data/fixedChargesByState";
import {
  fetchLiveElectricityRate,
  fetchLiveGasRate,
  getStateCode,
} from "../../lib/eiaRates";
import {
  calculateElectricityCO2,
  calculateGasCO2,
  formatCO2,
} from "../../lib/carbonFootprint";
import { getBestEquivalent, calculateCO2Equivalents } from "../../lib/co2Equivalents";
import { useUnitSystem, formatEnergyFromKwh } from "../../lib/units";
import {
  STATE_ELECTRICITY_RATES,
  STATE_GAS_RATES,
} from "../../data/stateRates";

const MonthlyBudgetPlanner = ({ initialMode = "budget" }) => {
  // Route guard: redirect to onboarding if not completed
  const navigate = useNavigate();
  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem("hasCompletedOnboarding") === "true";
    if (!hasCompletedOnboarding) {
      navigate("/onboarding");
    }
  }, [navigate]);

  // Warm local LLM on mount so bill analysis is instant (no cold-start latency)
  useEffect(() => {
    warmLLM();
  }, []);

  // Scroll to bill section if arriving via #bill-analysis hash
  useEffect(() => {
    if (window.location.hash === '#bill-analysis') {
      // Small delay to let the page render first
      const timer = setTimeout(() => {
        const el = document.getElementById('bill-analysis');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setShowBillPaste(true);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const { unitSystem } = useUnitSystem();
  const outletContext = useOutletContext() || {};
  const { userSettings, setUserSetting, onOpenAskJoule } = outletContext;

  // Derive all settings from context for consistency
  const {
    squareFeet = 1500,
    insulationLevel = 1.0,
    homeShape = 1.0,
    ceilingHeight = 8,
    wallHeight = null,
    hasLoft = false,
    capacity = 36,
    efficiency = 15.0,
    utilityCost = 0.15,
    gasCost = 1.2,
    primarySystem = "heatPump",
    afue = 0.95,
    energyMode = "heating",
    solarExposure = 1.0,
    coolingCapacity = 36,
    hspf2 = 9.0,
    useElectricAuxHeat = true,
    winterThermostat = 70,
    summerThermostat = 75,
    summerThermostatNight = 72,
    fixedElectricCost = 0,
    fixedGasCost = 0,
  } = userSettings || {};

  // Gas heat in winter (gasFurnace or Central AC + Gas). Summer cooling always uses electric/coolingCapacity.
  const isGasHeat = primarySystem === "gasFurnace" || primarySystem === "acPlusGas";

  // Round time to nearest 30 minutes for cleaner display
  const roundTimeTo30Minutes = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    const roundedMinutes = Math.round(minutes / 30) * 30;
    if (roundedMinutes === 60) {
      return `${String((hours + 1) % 24).padStart(2, "0")}:00`;
    }
    return `${String(hours).padStart(2, "0")}:${String(roundedMinutes).padStart(2, "0")}`;
  };

  // Load thermostat settings from thermostatSettings.js (same as 7-day planner)
  const [daytimeTime, setDaytimeTime] = useState(() => {
    try {
      const thermostatSettings = loadThermostatSettings();
      const homeEntry = thermostatSettings?.schedule?.weekly?.[0]?.find(
        (e) => e.comfortSetting === "home"
      );
      const time = homeEntry?.time || "05:30";
      return roundTimeTo30Minutes(time);
    } catch {
      return "05:30";
    }
  });

  const [nighttimeTime, setNighttimeTime] = useState(() => {
    try {
      const thermostatSettings = loadThermostatSettings();
      const sleepEntry = thermostatSettings?.schedule?.weekly?.[0]?.find(
        (e) => e.comfortSetting === "sleep"
      );
      const time = sleepEntry?.time || "15:00";
      return roundTimeTo30Minutes(time);
    } catch {
      return "15:00";
    }
  });

  // Annual Budget Planner: Separate state for winter and summer thermostat settings
  const [winterDayTime, setWinterDayTime] = useState(() => {
    try {
      const thermostatSettings = loadThermostatSettings();
      const homeEntry = thermostatSettings?.schedule?.weekly?.[0]?.find(
        (e) => e.comfortSetting === "home"
      );
      return roundTimeTo30Minutes(homeEntry?.time || "05:30");
    } catch {
      return roundTimeTo30Minutes("05:30");
    }
  });
  const [winterNightTime, setWinterNightTime] = useState(() => {
    try {
      const thermostatSettings = loadThermostatSettings();
      const sleepEntry = thermostatSettings?.schedule?.weekly?.[0]?.find(
        (e) => e.comfortSetting === "sleep"
      );
      return roundTimeTo30Minutes(sleepEntry?.time || "22:00");
    } catch {
      return roundTimeTo30Minutes("22:00");
    }
  });
  const [summerDayTime, setSummerDayTime] = useState(() => {
    try {
      const thermostatSettings = loadThermostatSettings();
      const homeEntry = thermostatSettings?.schedule?.weekly?.[0]?.find(
        (e) => e.comfortSetting === "home"
      );
      return roundTimeTo30Minutes(homeEntry?.time || "05:30");
    } catch {
      return roundTimeTo30Minutes("05:30");
    }
  });
  const [summerNightTime, setSummerNightTime] = useState(() => {
    try {
      const thermostatSettings = loadThermostatSettings();
      const sleepEntry = thermostatSettings?.schedule?.weekly?.[0]?.find(
        (e) => e.comfortSetting === "sleep"
      );
      return roundTimeTo30Minutes(sleepEntry?.time || "22:00");
    } catch {
      return roundTimeTo30Minutes("22:00");
    }
  });

  const [indoorTemp, setIndoorTemp] = useState(() => {
    // Priority: 1) userSettings (includes optimized values), 2) comfort settings, 3) defaults
    try {
      if (userSettings?.winterThermostatDay !== undefined) {
        return userSettings.winterThermostatDay;
      }
      if (userSettings?.winterThermostat !== undefined) {
        return userSettings.winterThermostat;
      }
      const thermostatSettings = loadThermostatSettings();
      return thermostatSettings?.comfortSettings?.home?.heatSetPoint || 70;
    } catch {
      return userSettings?.winterThermostatDay || userSettings?.winterThermostat || 70;
    }
  });

  const [nighttimeTemp, setNighttimeTemp] = useState(() => {
    // Priority: 1) userSettings (includes optimized values), 2) comfort settings, 3) defaults
    try {
      if (userSettings?.winterThermostatNight !== undefined) {
        return userSettings.winterThermostatNight;
      }
      const thermostatSettings = loadThermostatSettings();
      return thermostatSettings?.comfortSettings?.sleep?.heatSetPoint || 68;
    } catch {
      return userSettings?.winterThermostatNight || 68;
    }
  });

  // Sync local state from userSettings when it changes (e.g., when optimizer applies values)
  useEffect(() => {
    if (userSettings?.winterThermostatDay !== undefined) {
      setIndoorTemp(userSettings.winterThermostatDay);
    }
    if (userSettings?.winterThermostatNight !== undefined) {
      setNighttimeTemp(userSettings.winterThermostatNight);
    }
  }, [userSettings?.winterThermostatDay, userSettings?.winterThermostatNight]);

  // Sync from thermostatSettings when they change (but respect userSettings/optimized values)
  useEffect(() => {
    const handleSettingsUpdate = () => {
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
        
        // Only update temps if they're not already set in userSettings (optimized values take precedence)
        const homeTemp = thermostatSettings?.comfortSettings?.home?.heatSetPoint;
        const sleepTemp = thermostatSettings?.comfortSettings?.sleep?.heatSetPoint;
        if (homeTemp !== undefined && !userSettings?.winterThermostatDay) {
          setIndoorTemp(homeTemp);
        }
        if (sleepTemp !== undefined && !userSettings?.winterThermostatNight) {
          setNighttimeTemp(sleepTemp);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("thermostatSettingsUpdated", handleSettingsUpdate);
    return () => window.removeEventListener("thermostatSettingsUpdated", handleSettingsUpdate);
  }, [userSettings]);

  // Pre-fill Annual Budget Planner temperatures from comfort settings (ASHRAE defaults)
  useEffect(() => {
    try {
      const thermostatSettings = loadThermostatSettings();
      const comfortSettings = thermostatSettings?.comfortSettings;
      
      if (comfortSettings) {
        // ASHRAE Standard 55 recommended temperatures (50% RH):
        // Winter: 70°F day (middle of 68.5-74.5°F range), 68°F night
        // Summer: 76°F day (middle of 73-79°F range), 78°F night
        
        // Winter heating: use home heatSetPoint for day, sleep heatSetPoint for night
        const winterDay = comfortSettings.home?.heatSetPoint ?? 70; // ASHRAE Standard 55 default
        const winterNight = comfortSettings.sleep?.heatSetPoint ?? 68; // ASHRAE Standard 55 default
        
        // Summer cooling: use home coolSetPoint for day, sleep coolSetPoint for night
        const summerDay = comfortSettings.home?.coolSetPoint ?? 76; // ASHRAE Standard 55 default
        const summerNight = comfortSettings.sleep?.coolSetPoint ?? 78; // ASHRAE Standard 55 default
        
        // Only set if not already set in userSettings
        if (!userSettings?.winterThermostatDay && setUserSetting) {
          setUserSetting("winterThermostatDay", winterDay);
        }
        if (!userSettings?.winterThermostatNight && setUserSetting) {
          setUserSetting("winterThermostatNight", winterNight);
        }
        if (!userSettings?.summerThermostat && setUserSetting) {
          setUserSetting("summerThermostat", summerDay);
        }
        if (!userSettings?.summerThermostatNight && setUserSetting) {
          setUserSetting("summerThermostatNight", summerNight);
        }
      } else {
        // No comfort settings found, use ASHRAE Standard 55 defaults
        if (!userSettings?.winterThermostatDay && setUserSetting) {
          setUserSetting("winterThermostatDay", 70); // ASHRAE Standard 55: 70°F (middle of 68.5-74.5°F range)
        }
        if (!userSettings?.winterThermostatNight && setUserSetting) {
          setUserSetting("winterThermostatNight", 68); // ASHRAE Standard 55: 68°F for sleep/unoccupied
        }
        if (!userSettings?.summerThermostat && setUserSetting) {
          setUserSetting("summerThermostat", 76); // ASHRAE Standard 55: 76°F (middle of 73-79°F range)
        }
        if (!userSettings?.summerThermostatNight && setUserSetting) {
          setUserSetting("summerThermostatNight", 78); // ASHRAE Standard 55: 78°F for sleep/unoccupied
        }
      }
    } catch (error) {
      console.warn("Failed to load comfort settings for Annual Budget Planner:", error);
      // Fallback to ASHRAE Standard 55 defaults
      if (!userSettings?.winterThermostatDay && setUserSetting) {
        setUserSetting("winterThermostatDay", 70);
      }
      if (!userSettings?.winterThermostatNight && setUserSetting) {
        setUserSetting("winterThermostatNight", 68);
      }
      if (!userSettings?.summerThermostat && setUserSetting) {
        setUserSetting("summerThermostat", 76);
      }
      if (!userSettings?.summerThermostatNight && setUserSetting) {
        setUserSetting("summerThermostatNight", 78);
      }
    }
  }, [userSettings?.winterThermostatDay, userSettings?.winterThermostatNight, userSettings?.summerThermostat, userSettings?.summerThermostatNight, setUserSetting]);

  // Check if we're in auto mode (both heating and cooling setpoints configured)
  const isAutoMode = useMemo(() => {
    try {
      const thermostatSettings = loadThermostatSettings();
      const hasHeating = thermostatSettings?.comfortSettings?.home?.heatSetPoint !== undefined ||
                        thermostatSettings?.comfortSettings?.home?.heatSetPoint !== undefined;
      const hasCooling = thermostatSettings?.comfortSettings?.home?.coolSetPoint !== undefined;
      return hasHeating && hasCooling;
    } catch {
      return false;
    }
  }, []);

  // Get cooling setpoints for auto mode
  const coolingDayTemp = useMemo(() => {
    try {
      const thermostatSettings = loadThermostatSettings();
      return thermostatSettings?.comfortSettings?.home?.coolSetPoint ?? summerThermostat ?? 75;
    } catch {
      return summerThermostat ?? 75;
    }
  }, [summerThermostat]);

  const coolingNightTemp = useMemo(() => {
    try {
      const thermostatSettings = loadThermostatSettings();
      return thermostatSettings?.comfortSettings?.sleep?.coolSetPoint ?? summerThermostatNight ?? 72;
    } catch {
      return summerThermostatNight ?? 72;
    }
  }, [summerThermostatNight]);

  // Calculate weighted average indoor temp based on day/night schedule
  // Uses actual times from thermostat settings (not hardcoded)
  // In auto mode, this will be overridden per-day based on outdoor temperature
  const effectiveIndoorTemp = useMemo(() => {
    // Helper: Convert time string to hours (0-24)
    const timeToHours = (timeStr) => {
      const [hours, minutes] = timeStr.split(":").map(Number);
      return hours + minutes / 60;
    };

    const dayStart = timeToHours(daytimeTime);
    const nightStart = timeToHours(nighttimeTime);

    let dayHours, nightHours;
    if (dayStart < nightStart) {
      // Normal: day before night (e.g., 6am to 10pm)
      dayHours = nightStart - dayStart;
      nightHours = 24 - dayHours;
    } else {
      // Wrapped: night before day (e.g., 10pm to 6am)
      nightHours = dayStart - nightStart;
      dayHours = 24 - nightHours;
    }

    if (energyMode === "heating") {
      // Weighted average based on actual schedule times
      return (indoorTemp * dayHours + nighttimeTemp * nightHours) / 24;
    } else if (energyMode === "cooling") {
      // For cooling, use summer settings (fallback to realistic defaults)
      const summerDay = summerThermostat || 75;
      const summerNight = summerThermostatNight || 72;
      return (summerDay * dayHours + summerNight * nightHours) / 24;
    } else {
      // Auto mode: default to heating for now, will be overridden per-day
      return (indoorTemp * dayHours + nighttimeTemp * nightHours) / 24;
    }
  }, [energyMode, indoorTemp, nighttimeTemp, daytimeTime, nighttimeTime, summerThermostat, summerThermostatNight]);

  // Helper function to determine which setpoints to use based on outdoor temperature (for auto mode)
  const getEffectiveTempForDay = useCallback((outdoorAvgTemp) => {
    if (!isAutoMode) {
      return effectiveIndoorTemp;
    }

    // Helper: Convert time string to hours (0-24)
    const timeToHours = (timeStr) => {
      const [hours, minutes] = timeStr.split(":").map(Number);
      return hours + minutes / 60;
    };

    const dayStart = timeToHours(daytimeTime);
    const nightStart = timeToHours(nighttimeTime);

    let dayHours, nightHours;
    if (dayStart < nightStart) {
      dayHours = nightStart - dayStart;
      nightHours = 24 - dayHours;
    } else {
      nightHours = dayStart - nightStart;
      dayHours = 24 - nightHours;
    }

    // Use heating setpoints when outdoor temp is below 65°F, cooling when above 70°F
    // Transition zone (65-70°F) uses heating (more conservative for energy calculations)
    if (outdoorAvgTemp < 70) {
      // Heating mode: use heating setpoints
      return (indoorTemp * dayHours + nighttimeTemp * nightHours) / 24;
    } else {
      // Cooling mode: use cooling setpoints
      return (coolingDayTemp * dayHours + coolingNightTemp * nightHours) / 24;
    }
  }, [isAutoMode, effectiveIndoorTemp, indoorTemp, nighttimeTemp, coolingDayTemp, coolingNightTemp, daytimeTime, nighttimeTime]);

  // Local setters that call the global context setter
  const setUseElectricAuxHeat = (v) => setUserSetting("useElectricAuxHeat", v);

  // Component-specific state - with persistence
  // IMPORTANT: Always use userSettings over initialMode prop to maintain state across route changes
  const [mode, setModeState] = useState(() => {
    // If we have a persisted mode, use it (even if initialMode prop differs)
    // This prevents state loss when navigating between /analysis/monthly, /analysis/annual, etc.
    if (userSettings?.budgetPlannerMode) {
      return userSettings.budgetPlannerMode;
    }
    // Only use initialMode prop for very first visit
    return initialMode;
  });
  const [selectedMonth, setSelectedMonthState] = useState(() => {
    return userSettings?.budgetPlannerMonth || new Date().getMonth() + 1;
  });
  const [selectedYear, setSelectedYearState] = useState(() => {
    return userSettings?.budgetPlannerYear || new Date().getFullYear();
  });
  
  // Wrapper setters that persist to userSettings
  const _setMode = useCallback((newMode) => {
    setModeState(newMode);
    if (setUserSetting) {
      setUserSetting("budgetPlannerMode", newMode);
    }
  }, [setUserSetting]);
  
  const setSelectedMonth = useCallback((newMonth) => {
    setSelectedMonthState(newMonth);
    if (setUserSetting) {
      setUserSetting("budgetPlannerMonth", newMonth);
    }
  }, [setUserSetting]);

  const setSelectedYear = useCallback((newYear) => {
    setSelectedYearState(newYear);
    if (setUserSetting) {
      setUserSetting("budgetPlannerYear", newYear);
    }
  }, [setUserSetting]);

  // Month navigation handlers
  const goToPrevMonth = useCallback(() => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  }, [selectedMonth, selectedYear, setSelectedMonth, setSelectedYear]);

  const goToNextMonth = useCallback(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    // Don't go past current month
    if (selectedYear === currentYear && selectedMonth >= currentMonth) return;
    if (selectedYear > currentYear) return;
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  }, [selectedMonth, selectedYear, setSelectedMonth, setSelectedYear]);

  const isCurrentMonthSelected = selectedMonth === (new Date().getMonth() + 1) && selectedYear === new Date().getFullYear();
  const isPastMonth = !isCurrentMonthSelected && (selectedYear < new Date().getFullYear() || (selectedYear === new Date().getFullYear() && selectedMonth < new Date().getMonth() + 1));
  
  // Load location data synchronously on mount to enable cache lookups
  const [locationData, _setLocationData] = useState(() => {
    try {
      const saved = localStorage.getItem("userLocation");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Error loading location:", e);
    }
    return null;
  });
  
  // Cache key for monthly estimate
  const getEstimateCacheKey = useCallback(() => {
    if (!locationData?.latitude || !locationData?.longitude) return null;
    const lat = Number(locationData.latitude).toFixed(2);
    const lon = Number(locationData.longitude).toFixed(2);
    const dayTemp = energyMode === "cooling" ? (summerThermostat ?? 76) : (indoorTemp ?? 70);
    const nightTemp = energyMode === "cooling" ? (summerThermostatNight ?? 78) : (nighttimeTemp ?? 66);
    const settingsKey = `${primarySystem}_${energyMode}_${selectedMonth}_${dayTemp}_${nightTemp}_${utilityCost?.toFixed(3)}`;
    return `monthly_estimate_${lat}_${lon}_${settingsKey}`;
  }, [locationData?.latitude, locationData?.longitude, primarySystem, energyMode, selectedMonth, indoorTemp, nighttimeTemp, summerThermostat, summerThermostatNight, utilityCost]);
  
  // Initialize monthlyEstimate from cache if available
  const initialEstimate = useMemo(() => {
    const cacheKey = getEstimateCacheKey();
    if (!cacheKey) return null;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        // Cache for 30 minutes (same as forecast)
        if (age < 30 * 60 * 1000) {
          if (typeof window !== "undefined" && import.meta?.env?.DEV) {
            console.log(`📦 Using cached monthly estimate (${Math.round(age / 1000)}s old)`);
          }
          return data;
        }
        sessionStorage.removeItem(cacheKey);
      }
    } catch (err) {
      console.warn('Cache read error for estimate:', err);
    }
    return null;
  }, [getEstimateCacheKey]);
  
  const [monthlyEstimate, setMonthlyEstimate] = useState(initialEstimate);
  const [showCalculations, setShowCalculations] = useState(false);
  
  // Restore cached estimate when locationData becomes available (if not already loaded)
  useEffect(() => {
    if (locationData && !monthlyEstimate) {
      const cacheKey = getEstimateCacheKey();
      if (cacheKey) {
        try {
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            const age = Date.now() - timestamp;
            if (age < 30 * 60 * 1000) {
              setMonthlyEstimate(data);
              if (typeof window !== "undefined" && import.meta?.env?.DEV) {
                console.log(`📦 Restored cached estimate after location load (${Math.round(age / 1000)}s old)`);
              }
            }
          }
        } catch (err) {
          console.warn('Cache restore error:', err);
        }
      }
    }
  }, [locationData, monthlyEstimate, getEstimateCacheKey]);
  
  // Cache monthly estimate when it's calculated
  const setMonthlyEstimateCached = useCallback((estimate) => {
    setMonthlyEstimate(estimate);
    if (estimate && locationData?.latitude && locationData?.longitude) {
      // Calculate cache key with current values
      const lat = Number(locationData.latitude).toFixed(2);
      const lon = Number(locationData.longitude).toFixed(2);
      const settingsKey = `${primarySystem}_${energyMode}_${selectedMonth}_${indoorTemp}_${nighttimeTemp}_${utilityCost?.toFixed(3)}`;
      const cacheKey = `monthly_estimate_${lat}_${lon}_${settingsKey}`;
      
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({
          data: estimate,
          timestamp: Date.now()
        }));
        if (typeof window !== "undefined" && import.meta?.env?.DEV) {
          console.log(`💾 Cached monthly estimate for key: ${cacheKey}`);
        }
      } catch (err) {
        console.warn('Cache write error for estimate:', err);
      }
      
      // Sync is now handled by the useEffect below to ensure fixed fees are included
      // (the useEffect watches monthlyEstimate changes and syncs with proper totals)
    }
  }, [locationData?.latitude, locationData?.longitude, locationData?.city, locationData?.state, primarySystem, energyMode, selectedMonth, indoorTemp, nighttimeTemp, utilityCost]);
  
  // Wrapper for fetchHistoricalData that uses cached setter for Location A
  const setMonthlyEstimateForHistorical = useCallback((estimate) => {
    // Use cached version for Location A
    setMonthlyEstimateCached(estimate);
  }, [setMonthlyEstimateCached]);
  
  // Sync monthly estimate to bridge whenever it changes (including from cache)
  useEffect(() => {
    if (!monthlyEstimate?.cost || !locationData?.city) return;
    
    const syncToBridge = async () => {
      try {
        const bridgeUrl = localStorage.getItem('jouleBridgeUrl') || import.meta.env.VITE_JOULE_BRIDGE_URL;
        if (!bridgeUrl) return;
        
        // Use forecast-based cost (matches the Quick Answer card and forecast table)
        // rather than the 30-year typical estimate, since it's more accurate for the current month
        const fixedFees = monthlyEstimate.fixedCost || fixedElectricCost || 0;
        const forecastVariableCost = totalForecastCostRef.current || monthlyEstimate.cost || 0;
        const totalWithFees = forecastVariableCost + fixedFees;
        
        // Energy breakdown (kWh)
        const totalEnergy = monthlyEstimate.energy || 0;
        const auxEnergy = monthlyEstimate.excludedAuxEnergy || 0; // Only when aux is excluded
        const electricityRate = monthlyEstimate.electricityRate || utilityCost || 0.10;
        
        const payload = {
          location: `${locationData.city}, ${locationData.state}`,
          totalMonthlyCost: totalWithFees,
          variableCost: forecastVariableCost,
          fixedCost: fixedFees,
          totalHPCost: totalWithFees / 4.33,
          totalHPCostWithAux: totalWithFees / 4.33,
          timestamp: Date.now(),
          source: 'monthly_forecast',
          month: selectedMonth,
          targetTemp: indoorTemp,
          nightTemp: nighttimeTemp,
          mode: energyMode,
          // Energy data for HMI display
          totalEnergyKwh: totalEnergy,
          auxEnergyKwh: auxEnergy,
          hpEnergyKwh: totalEnergy - auxEnergy,
          electricityRate: electricityRate,
        };
        
        // Save to localStorage for other components
        localStorage.setItem("last_forecast_summary", JSON.stringify(payload));
        
        // Sync to bridge
        await fetch(`${bridgeUrl}/api/settings/last_forecast_summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: payload }),
        });
        
        if (import.meta.env.DEV) {
          console.log(`📡 Synced to bridge: $${totalWithFees.toFixed(2)}/month @ Day:${indoorTemp}°F Night:${nighttimeTemp}°F (variable: $${monthlyEstimate.cost.toFixed(2)} + fixed: $${fixedFees.toFixed(2)})`);
        } else {
          console.log(`📡 Synced to bridge: $${totalWithFees.toFixed(2)}/month @ Day:${indoorTemp}°F Night:${nighttimeTemp}°F`);
        }
      } catch {
        // Ignore sync errors
      }
    };
    
    syncToBridge();
  }, [monthlyEstimate?.cost, monthlyEstimate?.fixedCost, monthlyEstimate?.energy, monthlyEstimate?.electricityRate, fixedElectricCost, utilityCost, locationData?.city, locationData?.state, selectedMonth, indoorTemp, nighttimeTemp, energyMode]);
  
  // Periodic sync to bridge every 5 minutes (keeps HMI up to date even when page is idle)
  useEffect(() => {
    const bridgeUrl = localStorage.getItem('jouleBridgeUrl') || import.meta.env.VITE_JOULE_BRIDGE_URL;
    if (!bridgeUrl) return;
    
    const syncInterval = setInterval(() => {
      if (!monthlyEstimate?.cost || !locationData?.city) return;
      
      const fixedFees = monthlyEstimate.fixedCost || fixedElectricCost || 0;
      const forecastVariableCost = totalForecastCostRef.current || monthlyEstimate.cost || 0;
      const totalWithFees = forecastVariableCost + fixedFees;
      const totalEnergy = monthlyEstimate.energy || 0;
      const auxEnergy = monthlyEstimate.excludedAuxEnergy || 0;
      const electricityRate = monthlyEstimate.electricityRate || utilityCost || 0.10;
      
      const payload = {
        location: `${locationData.city}, ${locationData.state}`,
        totalMonthlyCost: totalWithFees,
        variableCost: forecastVariableCost,
        fixedCost: fixedFees,
        totalHPCost: totalWithFees / 4.33,
        totalHPCostWithAux: totalWithFees / 4.33,
        timestamp: Date.now(),
        source: 'monthly_forecast',
        month: selectedMonth,
        targetTemp: indoorTemp,
        nightTemp: nighttimeTemp,
        mode: energyMode,
        totalEnergyKwh: totalEnergy,
        auxEnergyKwh: auxEnergy,
        hpEnergyKwh: totalEnergy - auxEnergy,
        electricityRate: electricityRate,
      };
      
      fetch(`${bridgeUrl}/api/settings/last_forecast_summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: payload }),
      }).catch(() => {});
      
      if (import.meta.env.DEV) {
        console.log(`🔄 Auto-synced to bridge: $${totalWithFees.toFixed(2)}/month @ Day:${indoorTemp}°F Night:${nighttimeTemp}°F`);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
    
    return () => clearInterval(syncInterval);
  }, [monthlyEstimate, locationData, fixedElectricCost, utilityCost, selectedMonth, indoorTemp, nighttimeTemp, energyMode]);
  
  // Year selection for aux heat calculation
  const [auxHeatYear, setAuxHeatYear] = useState(() => new Date().getFullYear() - 1); // Default to previous year
  const [useWorstYear, setUseWorstYear] = useState(false);
  
  // Get hourly historical data for selected year (heat pumps only)
  const { hourlyData: historicalHourly, loading: _historicalLoading } = useHistoricalHourly(
    locationData?.latitude,
    locationData?.longitude,
    { 
      enabled: !!locationData?.latitude && !!locationData?.longitude && primarySystem === "heatPump" && energyMode === "heating",
      year: auxHeatYear
    }
  );
  const [forecastModel, setForecastModel] = useState("current"); // "typical" | "current" | "polarVortex"
  const [showAnnualPlanner, setShowAnnualPlanner] = useState(false); // Collapsed by default for reduced cognitive load
  useEffect(() => {
    if (mode === "annual") {
      setShowAnnualPlanner(true);
    }
  }, [mode]);
  const [showDailyForecast, setShowDailyForecast] = useState(false); // Collapsed by default — Got Your Bill? is the first thing users see
  const [showDetails, setShowDetails] = useState(false); // Details dropdown (Quick Answer, schedule, table, settings, show me the math)
  const [showSinusoidalGraph, setShowSinusoidalGraph] = useState(false); // Collapsed by default
  const [showMonthlyBreakdown, setShowMonthlyBreakdown] = useState(true); // Expanded by default for annual
  const [_showHeatingCosts, _setShowHeatingCosts] = useState(false); // Collapsed by default
  const [_showCoolingCosts, _setShowCoolingCosts] = useState(false); // Collapsed by default
  const [showTemperatureProfiles, setShowTemperatureProfiles] = useState(false); // Collapsed by default
  const [_thermostatModel, setThermostatModel] = useState("current"); // "current" | "flat70" | "flat68" | "custom"
  const [annualCostData, setAnnualCostData] = useState(null); // Store annual cost data for top card
  const annualCostDataRef = useRef(null); // Ref to store calculated values without causing re-renders
  const dailyMetricsRef = useRef([]); // Ref to store dailyMetrics for analytics section
  const totalForecastCostRef = useRef(0); // Ref to store totalForecastCost for analytics section
  const totalForecastEnergyRef = useRef(0); // Ref to store totalForecastEnergy for analytics section

  // Actual kWh tracking - user can enter real usage from their bill
  const actualKwhStorageKey = `actualKwh_${selectedYear}_${selectedMonth}`;
  const [actualKwhEntries, setActualKwhEntries] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(actualKwhStorageKey) || '{}');
    } catch { return {}; }
  });
  // Re-load when month changes
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(actualKwhStorageKey) || '{}');
      setActualKwhEntries(stored);
    } catch { setActualKwhEntries({}); }
  }, [actualKwhStorageKey]);
  const updateActualKwh = useCallback((dayKey, value) => {
    setActualKwhEntries(prev => {
      const next = { ...prev };
      if (value === '' || value === null || value === undefined) {
        delete next[dayKey];
      } else {
        next[dayKey] = Number(value);
      }
      localStorage.setItem(actualKwhStorageKey, JSON.stringify(next));
      return next;
    });
  }, [actualKwhStorageKey]);

  // Bill parsing with Groq AI
  const [billPasteText, setBillPasteText] = useState('');
  const [billParsing, setBillParsing] = useState(false);
  const [billParseError, setBillParseError] = useState(null);
  const [showBillPaste, setShowBillPaste] = useState(false);
  const [billPdfExtracting, setBillPdfExtracting] = useState(false);
  const [billPdfError, setBillPdfError] = useState('');
  const [runAutoAnalyzeAfterExtract, setRunAutoAnalyzeAfterExtract] = useState(false);
  const billFileInputRef = useRef(null);

  // Bill vs Forecast analysis — persisted per month (billDateRange declared early so onboarding effect can use setBillDateRange)
  const billChatStorageKey = `billAnalysisChat_${selectedYear}_${selectedMonth}`;
  const [billDateRange, setBillDateRange] = useState(() => {
    try {
      const raw = localStorage.getItem(billChatStorageKey);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data.billDateRange ?? null;
    } catch { return null; }
  });

  // Pre-populate bill paste from onboarding; expand daily forecast so dailyMetricsRef populates for auto-analyze
  // Also align to bill month (from parse or default last month) so weather comparison is correct
  useEffect(() => {
    try {
      const storedMonth = localStorage.getItem("onboardingBillMonth");
      const storedYear = localStorage.getItem("onboardingBillYear");
      if (storedMonth && storedYear) {
        const m = parseInt(storedMonth, 10);
        const y = parseInt(storedYear, 10);
        if (m >= 1 && m <= 12 && y >= 2020 && y <= 2030) {
          setSelectedMonth(m);
          setSelectedYear(y);
        }
        localStorage.removeItem("onboardingBillMonth");
        localStorage.removeItem("onboardingBillYear");
      }
      const stored = localStorage.getItem("onboardingBillPaste");
      const storedDateRange = localStorage.getItem("onboardingBillDateRange");
      if (stored && stored.trim()) {
        setBillPasteText(stored.trim());
        setShowBillPaste(true);
        setShowDetails(true); // Expand Details so table renders
        setShowDailyForecast(true); // Expand so dailyMetricsRef populates for auto-analyze
        sessionStorage.setItem("onboardingBillAutoProcess", "extract");
        localStorage.removeItem("onboardingBillPaste");
        if (storedDateRange) {
          setBillDateRange(storedDateRange);
          localStorage.removeItem("onboardingBillDateRange");
        }
      }
    } catch { /* ignore */ }
  }, [setSelectedMonth, setSelectedYear, setBillDateRange]);

  // When user has bill data (actualKwhEntries), auto-expand Details so the forecast table renders and dailyMetricsRef populates for analysis
  const actualKwhCountForExpand = Object.values(actualKwhEntries).filter(v => typeof v === 'number').length;
  useEffect(() => {
    if (actualKwhCountForExpand > 0) {
      setShowDetails(true);
      setShowDailyForecast(true);
    }
  }, [actualKwhCountForExpand]);

  // Bill analysis state (billChatStorageKey declared above)
  const [billAnalysis, setBillAnalysis] = useState(() => {
    try {
      const raw = localStorage.getItem(billChatStorageKey);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data.billAnalysis ?? null;
    } catch { return null; }
  });
  const [billAnalysisLoading, setBillAnalysisLoading] = useState(false);
  const [billFollowUpQuestion, setBillFollowUpQuestion] = useState('');
  const [billConversationHistory, setBillConversationHistory] = useState(() => {
    try {
      const raw = localStorage.getItem(billChatStorageKey);
      if (!raw) return [];
      const data = JSON.parse(raw);
      return Array.isArray(data.billConversationHistory) ? data.billConversationHistory : [];
    } catch { return []; }
  });
  const [complaintCopyFeedback, setComplaintCopyFeedback] = useState('');
  const [billFollowUpLoading, setBillFollowUpLoading] = useState(false);
  const [billFollowUpStreamingText, setBillFollowUpStreamingText] = useState('');

  // Speech-to-text for follow-up questions
  const { supported: billRecSupported, isListening: billIsListening, startListening: billStartListening, stopListening: billStopListening } = useSpeechRecognition({
    continuous: false,
    autoRestart: false,
    autoStopOnFinal: true,
    onFinal: (text) => setBillFollowUpQuestion(prev => (prev ? prev + ' ' : '') + text),
  });
  // Text-to-speech for bill analysis and AI responses
  const { speak: billSpeak, stop: billStopSpeaking, isSpeaking: billIsSpeaking } = useSpeechSynthesis({ enabled: true });
  const [billAnalysisSpeechEnabled, setBillAnalysisSpeechEnabled] = useState(() => {
    try {
      return localStorage.getItem("billAnalysisSpeechEnabled") !== "false";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("billAnalysisSpeechEnabled", String(billAnalysisSpeechEnabled));
    } catch { /* ignore */ }
  }, [billAnalysisSpeechEnabled]);

  // Reload bill chat when user switches month/year so they see that month's conversation
  useEffect(() => {
    try {
      const raw = localStorage.getItem(billChatStorageKey);
      if (!raw) {
        setBillAnalysis(null);
        setBillConversationHistory([]);
        setBillDateRange(null);
        return;
      }
      const data = JSON.parse(raw);
      setBillAnalysis(data.billAnalysis ?? null);
      setBillConversationHistory(Array.isArray(data.billConversationHistory) ? data.billConversationHistory : []);
      setBillDateRange(data.billDateRange ?? null);
    } catch {
      setBillAnalysis(null);
      setBillConversationHistory([]);
      setBillDateRange(null);
    }
  }, [billChatStorageKey]);

  // Persist bill analysis and conversation so chat survives navigation (pick up where you left off)
  useEffect(() => {
    try {
      if (!billAnalysis && !billDateRange && (!billConversationHistory || billConversationHistory.length === 0)) {
        localStorage.removeItem(billChatStorageKey);
      } else {
        localStorage.setItem(billChatStorageKey, JSON.stringify({ billAnalysis, billConversationHistory, billDateRange }));
      }
    } catch { /* ignore */ }
  }, [billChatStorageKey, billAnalysis, billConversationHistory, billDateRange]);

  const parseBillWithGroq = useCallback(async () => {
    if (!isAIAvailable()) {
      setBillParseError('AI not configured. Add a Groq API key or enable Local AI (Ollama) in Settings → Bridge & AI.');
      return;
    }
    if (!billPasteText.trim()) {
      setBillParseError('Please paste your utility bill data first.');
      return;
    }
    setBillParsing(true);
    setBillParseError(null);
    try {
      const billMonth = getBillMonthForComparison(billPasteText.trim());
      const dateRange = parseBillDateRange(billPasteText.trim());
      const byMonth = await extractBillToStorage(billPasteText.trim(), billMonth.year, billMonth.month);
      clearOnboardingExtractionFlag();
      setBillDateRange(dateRange);
      // Pick the month with the most days (handles multi-month bills like Jan 27 - Feb 10)
      let targetMonth = billMonth.month;
      let targetYear = billMonth.year;
      if (byMonth && Object.keys(byMonth).length > 0) {
        const entries = Object.entries(byMonth).map(([m, days]) => ({ month: parseInt(m, 10), count: Object.keys(days).length }));
        const best = entries.reduce((a, b) => (a.count >= b.count ? a : b));
        targetMonth = best.month;
        targetYear = billMonth.year;
      }
      setSelectedMonth(targetMonth);
      setSelectedYear(targetYear);
      const storageKey = `actualKwh_${targetYear}_${targetMonth}`;
      const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
      setActualKwhEntries(stored);
      setBillPasteText('');
      setShowBillPaste(false);
      setRunAutoAnalyzeAfterExtract(true);
    } catch (err) {
      setBillParseError(err.message);
    } finally {
      setBillParsing(false);
    }
  }, [billPasteText, selectedMonth, selectedYear, setSelectedMonth, setSelectedYear]);

  const extractBillPdf = useCallback(async (file) => {
    if (!file?.name?.toLowerCase().endsWith(".pdf")) {
      setBillPdfError("Please select a PDF file");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setBillPdfError("File too large. Please use a PDF under 50MB.");
      return;
    }
    setBillPdfExtracting(true);
    setBillPdfError(null);
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.js";
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => item.str).join(" ");
        fullText += (pageNum > 1 ? "\n" : "") + pageText;
      }
      const trimmed = fullText.trim();
      if (!trimmed || trimmed.length < 20) {
        setBillPdfError("No text found in PDF. Try pasting the bill text instead.");
        return;
      }
      setBillPasteText(trimmed);
    } catch (err) {
      setBillPdfError(err.message || "Failed to extract text from PDF.");
    } finally {
      setBillPdfExtracting(false);
      if (billFileInputRef.current) billFileInputRef.current.value = "";
    }
  }, []);

  const analyzeBillDiscrepancy = useCallback(async (dailyMetrics) => {
    if (!isAIAvailable()) {
      setBillAnalysis({ error: 'AI not configured. Add a Groq API key or enable Local AI (Ollama) in Settings → Bridge & AI.' });
      return;
    }
    const actualValues = Object.entries(actualKwhEntries).filter(([, v]) => typeof v === 'number');
    if (actualValues.length === 0) {
      setBillAnalysis({ error: 'Enter some actual kWh values first (paste a bill or type values).' });
      return;
    }
    setBillAnalysisLoading(true);
    setBillAnalysis(null);
    setBillConversationHistory([]);
    setBillFollowUpQuestion('');
    setBillFollowUpStreamingText('');
    try {
      // Bill month determines model mode: heating vs cooling (never announce mode — vocabulary carries context)
      const isCoolingMonth = [4, 5, 6, 7, 8, 9].includes(selectedMonth);

      // Build comparison data — only include days with actual usage entered (ignore 0/blank so we compare apples to apples)
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const allRows = (dailyMetrics || []).map((day, idx) => {
        const dayKey = day.date instanceof Date ? `${day.date.getMonth()+1}-${day.date.getDate()}` : String(idx+1);
        const actual = actualKwhEntries[dayKey];
        return {
          day: day.day,
          estKwh: Math.round(day.energy * 10) / 10,
          auxKwh: Math.round((day.auxEnergy || 0) * 10) / 10,
          actualKwh: actual != null ? actual : null,
          tempLow: day.low,
          tempHigh: day.high,
          tempRange: `${day.low.toFixed(0)}-${day.high.toFixed(0)}°F`,
          source: day.source,
        };
      });
      // Only compare days that have actual usage > 0 (partial month: user may have filled only first N days)
      const comparisonRows = allRows.filter(r => r.actualKwh != null && r.actualKwh > 0);
      const totalEst = comparisonRows.reduce((s, r) => s + r.estKwh, 0);
      const totalActual = comparisonRows.reduce((s, r) => s + r.actualKwh, 0);
      const fullMonthForecastKwh = allRows.reduce((s, r) => s + r.estKwh, 0);
      const fullMonthForecastCost = Math.round((fullMonthForecastKwh * utilityCost + fixedElectricCost) * 100) / 100;
      const isPartialMonth = comparisonRows.length > 0 && comparisonRows.length < daysInMonth;

      // Build rich model context so AI knows exactly what parameters drive the estimate
      const ceilingMult = 1 + (ceilingHeight - 8) * 0.1;
      const designHeatLoss = squareFeet * 22.67 * insulationLevel * homeShape * ceilingMult;
      const calculatedBtuLossPerDegF = designHeatLoss / 70;
      // Inline effective HLF (same logic as getEffectiveHeatLossFactor, including 30-day gate for learned)
      const effectiveBtuLossPerDegF = (userSettings?.useManualHeatLoss && userSettings?.manualHeatLoss > 0)
        ? userSettings.manualHeatLoss
        : (userSettings?.useAnalyzerHeatLoss && userSettings?.analyzerHeatLoss > 0)
          ? userSettings.analyzerHeatLoss
          : (userSettings?.useLearnedHeatLoss && userSettings?.learnedHeatLoss > 0 && shouldUseLearnedHeatLoss())
            ? userSettings.learnedHeatLoss
            : calculatedBtuLossPerDegF;
      const auditHlfSource = (userSettings?.useManualHeatLoss && userSettings?.manualHeatLoss > 0)
        ? 'manual'
        : (userSettings?.useAnalyzerHeatLoss && userSettings?.analyzerHeatLoss > 0)
          ? 'analyzer'
          : (userSettings?.useLearnedHeatLoss && userSettings?.learnedHeatLoss > 0 && shouldUseLearnedHeatLoss())
            ? 'learned'
            : 'calculated';
      const elecRate = utilityCost;
      const setTemp = effectiveIndoorTemp || winterThermostat;
      const coolingSetTemp = (summerThermostat ?? 76) * 16 / 24 + (summerThermostatNight ?? 78) * 8 / 24;

      // Average outdoor temp during bill period (for AI context)
      const avgOutdoorTemp = comparisonRows.length > 0
        ? (comparisonRows.reduce((s, r) => s + (r.tempLow + r.tempHigh) / 2, 0) / comparisonRows.length).toFixed(1)
        : null;

      // Cooling: heat gain factor (BTU/hr per °F above balance)
      const designHeatGain = squareFeet * 28.0 * insulationLevel * homeShape * ceilingMult * (solarExposure ?? 1);
      const btuGainPerDegF = designHeatGain / 20;

      // Capacity curve data points for AI context (heating only)
      const capacitySamples = [0, 5, 10, 15, 17, 25, 35, 47].map(t => {
        const cf = t <= -15 ? 0 : t >= 47 ? 1.0 : t < 17 ? Math.max(0, 0.64 - (17 - t) * 0.01) : 1.0 - (47 - t) * 0.012;
        return `${t}°F: ${(cf * capacity * 1000).toFixed(0)} BTU/hr (${(cf * 100).toFixed(0)}%)`;
      }).join(', ');

      // Empirical back-calculation from actual bill data
      const daysWithData = comparisonRows.filter(r => r.actualKwh > 0);
      let empiricalHLF = null;
      let empiricalHeatGain = null;
      if (daysWithData.length > 0) {
        if (isCoolingMonth) {
          const gains = daysWithData.map(r => {
            const avgOutdoor = (r.tempLow + r.tempHigh) / 2;
            const deltaT = Math.max(1, avgOutdoor - coolingSetTemp);
            return (r.actualKwh * 3412) / 24 / deltaT;
          });
          empiricalHeatGain = gains.reduce((a, b) => a + b, 0) / gains.length;
        } else {
          const hlfs = daysWithData.map(r => {
            const avgOutdoor = (r.tempLow + r.tempHigh) / 2;
            const deltaT = Math.max(1, setTemp - avgOutdoor);
            return (r.actualKwh * 3412) / 24 / deltaT;
          });
          empiricalHLF = hlfs.reduce((a, b) => a + b, 0) / hlfs.length;
        }
      }

      const learnedMonths = userSettings?.learnedHeatLossMonths || [];
      const isHeatLossFromThisBill = auditHlfSource === 'learned' && learnedMonths.includes(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}`);
      const homeContextStr = isCoolingMonth ? [
        isPartialMonth ? `PARTIAL MONTH: The user has entered actual bill data for ${comparisonRows.length} of ${daysInMonth} days only.` : null,
        billDateRange ? `BILL PERIOD: The user's bill covers ${billDateRange}. Refer to this exact period when explaining weather impact.` : null,
        avgOutdoorTemp ? `AVERAGE_TEMP: ${avgOutdoorTemp}°F during the bill period.` : null,
        `${squareFeet} sqft, ${primarySystem === 'heatPump' ? 'heat pump' : primarySystem === 'acPlusGas' ? 'Central AC + gas' : 'gas furnace'}`,
        `Summer thermostat: day ${summerThermostat ?? 76}°F, night ${summerThermostatNight ?? 78}°F, weighted avg ${coolingSetTemp.toFixed(1)}°F`,
        `SEER2: ${efficiency}, Cooling capacity: ${coolingCapacity || capacity}k BTU (${((coolingCapacity || capacity) / 12).toFixed(1)} tons)`,
        `Insulation multiplier: ${insulationLevel}x, Home shape: ${homeShape}x, Solar exposure: ${solarExposure ?? 1}x`,
        `Model's heat gain (BTU/hr per °F above balance): ${btuGainPerDegF.toFixed(0)} BTU/hr/°F`,
        `Electricity rate: $${elecRate}/kWh, Fixed monthly fees: $${fixedElectricCost}/mo`,
        `Full month forecast: $${fullMonthForecastCost.toFixed(2)} total. User entered ${comparisonRows.length} days: ${totalActual.toFixed(1)} kWh actual vs ${totalEst.toFixed(1)} kWh forecast = $${Math.abs((totalEst - totalActual) * elecRate).toFixed(2)} ${totalEst > totalActual ? 'model overestimated' : 'model underestimated'}.`,
        `Cooling: no aux heat. Compressor capacity derates above 95°F.`,
        empiricalHeatGain ? `Empirical heat gain (back-calc from bill): ~${empiricalHeatGain.toFixed(0)} BTU/hr/°F` : '',
      ].filter(Boolean).join('\n') : [
        isPartialMonth ? `PARTIAL MONTH: The user has entered actual bill data for ${comparisonRows.length} of ${daysInMonth} days only.` : null,
        billDateRange ? `BILL PERIOD: The user's bill covers ${billDateRange}. Refer to this exact period when explaining weather impact.` : null,
        avgOutdoorTemp ? `AVERAGE_TEMP: ${avgOutdoorTemp}°F during the bill period.` : null,
        `${squareFeet} sqft, ${primarySystem === 'heatPump' ? 'heat pump' : primarySystem === 'acPlusGas' ? 'Central AC + gas' : 'gas furnace'}`,
        `Thermostat: day ${indoorTemp || winterThermostat}°F, night ${nighttimeTemp || winterThermostat}°F, weighted avg ${setTemp.toFixed(1)}°F`,
        `HSPF2: ${hspf2}, Rated capacity: ${capacity}k BTU (${(capacity / 12).toFixed(1)} tons)`,
        `Insulation multiplier: ${insulationLevel}x, Home shape: ${homeShape}x`,
        `Heat loss source: ${auditHlfSource === 'learned' ? 'From Bill Data (Auto-learned)' : auditHlfSource === 'manual' ? 'Manual Entry' : auditHlfSource === 'analyzer' ? 'CSV Analyzer' : 'Calculated (DOE)'}`,
        `Model's BTU loss/°F: ${effectiveBtuLossPerDegF.toFixed(0)} BTU/hr/°F`,
        auditHlfSource !== 'calculated' ? '' : `Calculated building HLF (not used): ${calculatedBtuLossPerDegF.toFixed(0)} BTU/hr/°F`,
        `Electricity rate: $${elecRate}/kWh, Fixed monthly fees: $${fixedElectricCost}/mo`,
        `Full month forecast: $${fullMonthForecastCost.toFixed(2)} total. User entered ${comparisonRows.length} days: ${totalActual.toFixed(1)} kWh actual vs ${totalEst.toFixed(1)} kWh forecast = $${Math.abs((totalEst - totalActual) * elecRate).toFixed(2)} ${totalEst > totalActual ? 'model overestimated' : 'model underestimated'}.`,
        `Aux heat (electric strip): ${useElectricAuxHeat ? 'Included (5kW strips)' : 'Excluded'}`,
        `CAPACITY CURVE (capacity degrades with cold): ${capacitySamples}`,
        empiricalHLF ? `Empirical HLF (back-calc from bill): ${empiricalHLF.toFixed(0)} BTU/hr/°F` : '',
        isHeatLossFromThisBill ? `IMPORTANT: Heat loss is FROM THIS SAME BILL. Do NOT suggest adjusting heat loss — the gap is BASELOAD.` : '',
      ].filter(Boolean).join('\n');

      // Set initial analysis with totals so UI shows structure while streaming
      // totalEst = period forecast (for the days entered) — used for period comparison with totalActual
      // fullMonthForecast* = full month — same as Quick Answer, primary number on the page
      setBillAnalysis({
        text: '',
        totalEst, // period forecast for comparison days
        totalActual,
        fullMonthForecast: fullMonthForecastKwh,
        fullMonthForecastCost,
        daysCompared: comparisonRows.length,
        daysInMonth: isPartialMonth ? daysInMonth : undefined,
        comparisonRows,
        homeContext: homeContextStr,
        isCoolingMonth,
      });

      const billSystemPrompt = isCoolingMonth
        ? `You are Joule, the homeowner's advocate. You help people understand their energy bill and give them facts to stand on. Be warm, validating, and on their side — not the utility's.

TONE: Lead with validation. ${totalActual < totalEst ? 'Your bill was LOWER than the forecast — say "Your bill was actually lower than the forecast; you\'re right to want to understand why the model overestimated."' : 'If their bill is high, say so plainly: "That\'s a lot for this period — you\'re right to want to understand why."'} Validate first, then educate. Write like a knowledgeable neighbor who's on their side, over coffee. No bullets, no numbered lists, no bold headers. NEVER announce "cooling mode" or "heating mode" — speak in context (heat, sun, cooling demand).

CRITICAL - UNIFY NUMBERS: The page shows full month forecast exactly $${fullMonthForecastCost.toFixed(2)} (${fullMonthForecastKwh.toFixed(0)} kWh). Cite this exact amount. The ${totalEst.toFixed(1)} kWh ($${(totalEst * elecRate).toFixed(2)}) is for the ${comparisonRows.length} days the user entered only. When you mention the period numbers, ALWAYS say "for the ${comparisonRows.length} days you entered."

CRITICAL: The MODEL estimates HVAC cooling only (compressor). The ACTUAL BILL is whole-house electricity (HVAC + baseload: water heater, fridge, lights, appliances). Typical baseload: 5–15 kWh/day.

BASELOAD - DO NOT GET THIS WRONG: Baseload makes the actual bill HIGHER. When actual < estimate, your bill was LOWER than predicted. Baseload CANNOT explain a lower bill. The model overestimated cooling load. NEVER mention baseload when actual < estimate. Baseload only applies when actual > estimate.

DIRECTION RULES:
• When actual > estimate (model underestimates): The ${(totalActual - totalEst).toFixed(0)} kWh gap is likely BASELOAD first — water heater, appliances, etc. Do NOT recommend lowering heat gain factor; that would make the model predict even less. Consider: baseload (~${Math.round((totalActual - totalEst) / comparisonRows.length)} kWh/day), lower thermostat (more cooling), solar load.
• When actual < estimate (model overestimates): The model predicted more cooling than your bill shows. Baseload does NOT explain this. Heat gain or solar exposure may be too high in the model. Recommend lowering insulation multiplier or solar exposure to match. NEVER mention baseload when actual < estimate.

EMPIRICAL vs MODEL (when actual < estimate): The model uses ${btuGainPerDegF.toFixed(0)} BTU/hr/°F heat gain. ${empiricalHeatGain ? `Empirical from bill: ~${empiricalHeatGain.toFixed(0)} BTU/hr/°F. Since empirical (${empiricalHeatGain.toFixed(0)}) < model (${btuGainPerDegF.toFixed(0)}), the model's heat gain is TOO HIGH. Say: "The bill suggests ~${empiricalHeatGain.toFixed(0)} BTU/hr/°F but the model uses ${btuGainPerDegF.toFixed(0)} — so the model is overestimating. Lower the model's heat gain (insulation or solar exposure)."` : 'The bill shows less energy than the model predicts, so the model\'s heat gain is too high.'} NEVER say "baseload" when actual < estimate. The fix is: lower heat gain (insulation multiplier, solar exposure, or home shape).

COOLING VOCABULARY: Use heat gain, cooling demand, compressor runtime, solar load, SEER2. Do NOT use heat loss, aux heat, or HSPF. Compressor capacity derates above 95°F.

INSULATION: User's current insulation multiplier is ${insulationLevel}x. If recommending LOWER (when model overestimates), suggest a value BELOW their current — e.g. 0.55x or 0.5x if they're at 0.65x.

HOW TO CHANGE: Settings → Building Characteristics → Insulation Quality, Solar Exposure, Home Shape.

MODEL PARAMETERS:
${homeContextStr}

FORMAT: Write in friendly, conversational paragraph form. No bullet points, no numbered lists. VOICE: Joule is calm, observant, confident. Never announce modes — speak in context.

STRUCTURE: When numbers are close, write: "I've been looking at your home and your bill. The numbers are lining up almost exactly with what I'd expect for a house like yours in this weather. That usually means nothing is wrong — your home is behaving normally. Want to take a closer look together?" When the difference is significant, lead with "I compared your bill to your home and the weather." End with "Want to take a closer look together?" on its own line. Then STOP.`
        : `You are Joule, the homeowner's advocate. You help people understand why their heating bill is high and give them facts to stand on. Be warm, validating, and on their side — not the utility's.

TONE: Lead with validation. ${totalActual < totalEst ? 'Your bill was LOWER than the forecast — say "Your bill was actually lower than the forecast; you\'re right to want to understand why the model overestimated." Do NOT say "bill was high" or "higher than expected."' : 'If their bill is high, say so plainly: "That\'s a lot for January — you\'re right to want to understand why."'} Validate first, then educate. Write like a knowledgeable neighbor who's on their side, over coffee. No bullets, no numbered lists, no bold headers.

CRITICAL - UNIFY NUMBERS: The page shows full month forecast exactly $${fullMonthForecastCost.toFixed(2)} (${fullMonthForecastKwh.toFixed(0)} kWh) — same as Quick Answer. Cite this exact amount; do not recalculate or round differently. The ${totalEst.toFixed(1)} kWh ($${(totalEst * elecRate).toFixed(2)}) is for the ${comparisonRows.length} days the user entered only. When you mention the period numbers, ALWAYS say "for the ${comparisonRows.length} days you entered" so it's not confused with the full month. Lead with the full month ($${fullMonthForecastCost.toFixed(2)}) as the main forecast; use period numbers only when explaining the day-by-day comparison.

CRITICAL: The MODEL estimates HVAC heating only (heat pump + aux strips). The ACTUAL BILL is whole-house electricity (HVAC + baseload: water heater, fridge, lights, appliances). Typical baseload: 5–15 kWh/day.

BASELOAD - DO NOT GET THIS WRONG: Baseload (water heater, fridge, lights) makes the actual bill HIGHER. When actual < estimate, your bill was LOWER than predicted. Baseload CANNOT explain a lower bill. The model overestimated HVAC. NEVER mention baseload when actual < estimate. Baseload only applies when actual > estimate (whole-house bill is higher because it includes stuff the model doesn't).

DIRECTION RULES:
• When actual > estimate (model underestimates): The ${(totalActual - totalEst).toFixed(0)} kWh gap is likely BASELOAD first — water heater, appliances, etc. Do NOT recommend lowering Heat Loss Factor; that would make the model predict even less. Consider: baseload (~${Math.round((totalActual - totalEst) / comparisonRows.length)} kWh/day), higher thermostat use, aux heat not modeled.
• When actual < estimate (model overestimates): The model predicted more HVAC than your bill shows. Baseload does NOT explain this — the bill has everything. Heat loss or thermostat settings may be too high in the model. Recommend lowering insulation multiplier or HLF to match. NEVER mention baseload when actual < estimate.

EMPIRICAL vs MODEL HLF (when actual < estimate): The model uses ${effectiveBtuLossPerDegF.toFixed(0)} BTU/hr/°F. ${empiricalHLF ? `Empirical from bill: ~${empiricalHLF.toFixed(0)} BTU/hr/°F. Since empirical (${empiricalHLF.toFixed(0)}) < model (${effectiveBtuLossPerDegF.toFixed(0)}), the model's heat loss is TOO HIGH — the bill shows less energy per degree than the model assumes. Say: "The bill suggests ~${empiricalHLF.toFixed(0)} BTU/hr/°F but the model uses ${effectiveBtuLossPerDegF.toFixed(0)} — so the model is overestimating. Lower the model's heat loss."` : 'The bill shows less energy than the model predicts, so the model\'s heat loss is too high.'} NEVER say "baseload" or "empirical suggests low heat loss" when actual < estimate — baseload makes bills HIGHER, not lower. The fix is always: lower the model's heat loss (insulation multiplier or switch to From Bill Data).
EMPIRICAL HLF when actual > estimate: Formula assumes ALL kWh is heating; baseload inflates it. Use cautiously; lead with baseload as the main explanation.

HEAT LOSS FROM BILL: When heat loss source is "From Bill Data (Auto-learned)", the forecast is already using heat loss derived from bill data. Do NOT recommend adjusting heat loss — the forecast and bill share the same heat-loss basis. The gap is BASELOAD (whole-house: water heater, fridge, lights, appliances). If the prompt says "Heat loss is FROM THIS SAME BILL", emphasize that the model cannot match the bill because it estimates HVAC-only; the bill is whole-house.

HEAT LOSS FROM DOE: When heat loss source is "Calculated (DOE)", the model uses building characteristics (insulation multiplier, home shape, ceiling height). Acknowledge this: e.g. "You're using Calculated (DOE) heat loss (${effectiveBtuLossPerDegF.toFixed(0)} BTU/hr/°F). To lower the forecast, adjust insulation multiplier or home shape in Settings → Building Characteristics." Do NOT suggest "From Bill Data" unless the user asks — DOE is a valid choice.

HEAT LOSS vs TEMPERATURE: Heat loss (BTU/hr/°F) is NOT based on outdoor temperature. It comes from one of: building characteristics (DOE), bill data (auto-learned), or manual/analyzer. Temperature only affects how much energy is used each day (the forecast applies the same heat loss to each day's temperature). Do NOT say heat loss is "based on temperature" — that is incorrect.

OTHER RULES:
1. HVAC capacity DROPS in cold weather — use the capacity curve. At 15°F a ${capacity}k unit delivers ~${(0.64 * capacity).toFixed(0)}k BTU, not rated.
2. Reference specific days and numbers. No generic advice like "inspect insulation" unless the data supports it.
3. If model overestimates: suggest which parameter to lower. If model underestimates: explain baseload and what would need to change to match (higher HLF only if HVAC is provably under-modeled; usually baseload explains it).

INSULATION RECOMMENDATION: User's current insulation multiplier is ${insulationLevel}x. If recommending LOWER (when model overestimates), suggest a value BELOW their current — e.g. 0.55x or 0.5x if they're at 0.65x. NEVER suggest 0.65x or 0.6x when they already have 0.65x.

HOW TO CHANGE PARAMETERS (always include when recommending adjustments):
• Insulation multiplier: Go to Settings → Building Characteristics → "Insulation Quality". Options: Poor 1.4×, Average 1.0×, Good 0.65×, or enter a custom value (lower = better insulation = less heat loss).
• Home shape factor: Settings → Building Characteristics → "Building Shape" (Two-Story 0.9×, Split-Level 1.0×, Ranch 1.1×, etc.).
• Ceiling height: Settings → Building Characteristics → "Average Ceiling Height".
• Heat loss from bill: Settings → Heat Loss Source → "From Bill Data (Auto-learned)" — uses past bill data to learn heat loss.
• Manual heat loss: Settings → Heat Loss Source → "Manual Entry" — enter BTU/hr/°F directly.

MODEL PARAMETERS:
${homeContextStr}

FORMAT: Write in friendly, conversational paragraph form — like a knowledgeable neighbor explaining things over coffee. No bullet points, no numbered lists, no bold section headers. Use flowing prose that’s easy to read. VOICE: Joule is calm, observant, confident — a thermostat that can explain itself. Never salesy, jokey, or robotic. Reassuring when nothing is wrong, with a touch of pride.

STRUCTURE: When numbers are close (actual within ~15% of forecast), write: "I've been looking at your home and your bill. The numbers are lining up almost exactly with what I'd expect for a house like yours in this weather. That usually means nothing is wrong — your home is behaving normally. Want to take a closer look together?" When the difference is significant, lead with "I compared your bill to your home and the weather." One more sentence on whether things line up. End with "Want to take a closer look together?" on its own line. Then STOP. Do NOT include the full explanation or Shareable summary in this response — the user can say "Yes, dig deeper" in a follow-up to get the full explanation.

When the user later says "Yes, dig deeper" or similar, you will be asked in a follow-up to provide the full explanation and a Shareable summary — do not include those in this first response.`;

      const content = await callLLMStreaming({
        messages: [
          {
            role: 'system',
            content: billSystemPrompt,
          },
          {
            role: 'user',
              content: `Full month forecast (matches Quick Answer): ${fullMonthForecastKwh.toFixed(0)} kWh, $${fullMonthForecastCost.toFixed(2)} total. For the ${comparisonRows.length} days I entered: model estimated ${totalEst.toFixed(1)} kWh ($${(totalEst * elecRate).toFixed(2)}) vs my actual ${totalActual.toFixed(1)} kWh ($${(totalActual * elecRate).toFixed(2)}) — ${(totalActual - totalEst) > 0 ? '+' : ''}${(totalActual - totalEst).toFixed(1)} kWh ($${Math.abs((totalActual - totalEst) * elecRate).toFixed(2)}) difference at $${elecRate}/kWh.${isPartialMonth ? ` (Partial month: only ${comparisonRows.length} of ${daysInMonth} days.)` : ''}\n\nDaily comparison:\n${comparisonRows.map(r => `${r.day}: est ${r.estKwh} kWh ($${(r.estKwh * elecRate).toFixed(2)})${r.auxKwh > 0 ? ` (incl ${r.auxKwh} aux)` : ''} vs actual ${r.actualKwh} kWh ($${(r.actualKwh * elecRate).toFixed(2)}) (${r.tempRange}, ${r.source})`).join('\n')}\n\nPerform a field audit. When citing numbers, use full month ($${fullMonthForecastCost.toFixed(2)}) as the main forecast; if you mention the period forecast ($${(totalEst * elecRate).toFixed(2)}), say "for the ${comparisonRows.length} days you entered" so it's clear. Consider baseload (whole-house vs HVAC-only), ${isCoolingMonth ? 'heat gain' : 'heat loss'}, and thermostat behavior. If model parameters need adjustment, say which values to use AND exactly where in the app to change them. Include dollar amounts.`
            }
          ],
        temperature: 0.3,
        maxTokens: 400,
        onChunk: (chunk) => {
          setBillAnalysis((prev) =>
            prev ? { ...prev, text: (prev.text || '') + chunk } : prev
          );
        },
      });
      const analysisContent = content || 'No analysis available.';
      setBillAnalysis((prev) =>
        prev ? { ...prev, text: analysisContent } : prev
      );
    } catch (err) {
      setBillAnalysis({ error: err.message });
    } finally {
      setBillAnalysisLoading(false);
    }
  }, [actualKwhEntries, billDateRange, squareFeet, primarySystem, insulationLevel, effectiveIndoorTemp, winterThermostat, hspf2, capacity, ceilingHeight, homeShape, utilityCost, useElectricAuxHeat, indoorTemp, nighttimeTemp, summerThermostat, summerThermostatNight, efficiency, solarExposure, coolingCapacity, userSettings?.useManualHeatLoss, userSettings?.manualHeatLoss, userSettings?.useAnalyzerHeatLoss, userSettings?.analyzerHeatLoss, userSettings?.useLearnedHeatLoss, userSettings?.learnedHeatLoss, userSettings?.learnedHeatLossMonths, selectedMonth, selectedYear]);

  // Ref for follow-up prompt: updated in effect after getEffectiveHeatLossFactor/hlfSource exist (avoids TDZ)
  const billFollowUpContextRef = useRef({ effectiveHeatLoss: 0, hlfSource: 'calculated', squareFeet: 800, insulationLevel: 1, homeShape: 1, ceilingHeight: 8 });
  const billFollowUpScrollRef = useRef(null);

  const sendBillFollowUp = useCallback(async (questionOverride) => {
    const question = (questionOverride != null ? String(questionOverride).trim() : billFollowUpQuestion.trim()) || '';
    if (!question || !billAnalysis?.text) return;
    if (!isAIAvailable()) return;

    if (questionOverride == null) setBillFollowUpQuestion('');
    setBillFollowUpLoading(true);
    setBillFollowUpStreamingText('');

    // Add user message immediately so it shows up right away
    const historyWithUser = [
      ...billConversationHistory,
      { role: 'user', content: question },
    ];
    setBillConversationHistory(historyWithUser);

    try {
      // Build rich context so AI can reference specific days and numbers
      const elecRate = utilityCost;
      const dailyBreakdown = (billAnalysis.comparisonRows || []).map(r => `${r.day}: est ${r.estKwh} kWh ($${(r.estKwh * elecRate).toFixed(2)})${r.auxKwh > 0 ? ` (incl ${r.auxKwh} aux)` : ''} vs actual ${r.actualKwh} kWh ($${(r.actualKwh * elecRate).toFixed(2)}) (${r.tempRange}, ${r.source})`).join('\n');
      const messages = [
        {
          role: 'system',
          content: `You are Joule, the homeowner's advocate. Be warm, validating, and on their side. If they're frustrated, acknowledge it first ("That's frustrating" or "You're right to ask") before explaining. Write in conversational paragraph form — no bullets, no numbered lists, no bold headers.

CRITICAL - UNIFY NUMBERS: The page shows full month forecast $${(billAnalysis.fullMonthForecastCost ?? 0).toFixed(2)} (${(billAnalysis.fullMonthForecast ?? 0).toFixed(0)} kWh) — same as Quick Answer. The period forecast ($${((billAnalysis.totalEst ?? 0) * elecRate).toFixed(2)}) is for the ${billAnalysis.daysCompared ?? 0} days the user entered only. When you mention period numbers, ALWAYS say "for the ${billAnalysis.daysCompared ?? 0} days you entered." Lead with full month ($${(billAnalysis.fullMonthForecastCost ?? 0).toFixed(2)}) as the main forecast.

CRITICAL: The MODEL estimates HVAC ${billAnalysis.isCoolingMonth ? 'cooling' : 'heating'} only. The ACTUAL BILL is whole-house (HVAC + baseload). Baseload makes the bill HIGHER. When actual < estimate: the bill was LOWER than the forecast. Baseload CANNOT explain a lower bill — never mention it. The model overestimated HVAC (${billAnalysis.isCoolingMonth ? 'heat gain' : 'heat loss'} too high, etc). When actual > estimate: the gap is often baseload — do NOT recommend lowering ${billAnalysis.isCoolingMonth ? 'heat gain factor' : 'Heat Loss Factor'}. If the user asks "why my bill was high" but actual < estimate, correct them: "Actually your bill was lower than the forecast. The forecast overestimated."

${(billAnalysis.totalEst || 0) > (billAnalysis.totalActual || 0) ? `THIS COMPARISON: Actual < estimate (model overestimated). Baseload CANNOT explain a lower bill. If empirical ${billAnalysis.isCoolingMonth ? 'heat gain BTU/°F' : 'BTU/°F'} from HOME context is lower than the model's, say: the model's ${billAnalysis.isCoolingMonth ? 'heat gain' : 'heat loss'} is too high. Recommend lowering insulation or ${billAnalysis.isCoolingMonth ? 'solar exposure' : 'switching to From Bill Data'}.` : `THIS COMPARISON: Actual > estimate (model underestimated). Baseload likely explains the gap. Do NOT recommend lowering ${billAnalysis.isCoolingMonth ? 'heat gain factor' : 'Heat Loss Factor'}.`}

EMPIRICAL vs MODEL: When actual < estimate, if empirical from HOME context is lower than the model's, the model's ${billAnalysis.isCoolingMonth ? 'heat gain' : 'heat loss'} is too high. Say so plainly. NEVER mention baseload when actual < estimate. When actual > estimate, empirical can be distorted by baseload — lead with baseload.

INSULATION: If recommending lower insulation when model overestimates, suggest a value BELOW the user's current (from CURRENT SETTINGS). Never suggest 0.65x when they already have 0.65x — use 0.55x or 0.5x instead.

${billAnalysis.isCoolingMonth ? 'COOLING: Use heat gain, cooling demand, compressor runtime, SEER2. Do NOT use heat loss, aux heat, HSPF. Compressor capacity derates above 95°F.' : 'HEAT LOSS vs TEMPERATURE: Heat loss (BTU/hr/°F) is NOT based on temperature. It comes from building characteristics, bill data, or manual/analyzer. Do NOT say heat loss is "based on temperature".'}

When suggesting adjustments: suggest insulation multiplier or home shape${billAnalysis.isCoolingMonth ? ', or solar exposure (for cooling)' : ''} to lower the forecast.

HOW TO CHANGE PARAMETERS (always include when recommending adjustments):
• Insulation: Settings → Building Characteristics → "Insulation Quality" (Poor 1.4×, Average 1.0×, Good 0.65×, or custom).
• Home shape: Settings → Building Characteristics → "Building Shape".
• ${billAnalysis.isCoolingMonth ? 'Solar exposure: Settings → Building Characteristics.' : 'Heat loss from bill: Settings → Heat Loss Source → "From Bill Data (Auto-learned)". Manual heat loss: Settings → Heat Loss Source → "Manual Entry".'}

CURRENT SETTINGS (use these numbers in your answer — they reflect any changes the user or you applied since the analysis was run):
Model's ${billAnalysis.isCoolingMonth ? 'heat gain' : 'BTU loss/°F'} (current): ${billAnalysis.isCoolingMonth ? (squareFeet * 28 * (billFollowUpContextRef.current.insulationLevel || 1) * (billFollowUpContextRef.current.homeShape || 1) * (1 + ((billFollowUpContextRef.current.ceilingHeight || 8) - 8) * 0.1) * (solarExposure ?? 1) / 20).toFixed(0) : billFollowUpContextRef.current.effectiveHeatLoss.toFixed(0)} BTU/hr/°F
Square feet: ${billFollowUpContextRef.current.squareFeet}, Insulation: ${billFollowUpContextRef.current.insulationLevel}x, Home shape: ${billFollowUpContextRef.current.homeShape}x, Ceiling: ${billFollowUpContextRef.current.ceilingHeight} ft
${!billAnalysis.isCoolingMonth ? `Heat loss source: ${billFollowUpContextRef.current.hlfSource === 'learned' ? 'From Bill Data' : billFollowUpContextRef.current.hlfSource === 'manual' ? 'Manual' : billFollowUpContextRef.current.hlfSource === 'analyzer' ? 'CSV Analyzer' : 'Calculated (DOE)'}` : ''}
Do NOT use ${billAnalysis.isCoolingMonth ? 'heat gain or' : 'heat loss or'} building numbers from the HOME context below if they differ from the CURRENT SETTINGS above. The numbers above are what the app is using now.

${billAnalysis.homeContext || 'HOME: unknown'}

FULL MONTH FORECAST (Quick Answer): ${(billAnalysis.fullMonthForecast ?? 0).toFixed(0)} kWh, $${(billAnalysis.fullMonthForecastCost ?? ((billAnalysis.fullMonthForecast ?? 0) * elecRate + fixedElectricCost)).toFixed(2)} total
PERIOD (${billAnalysis.daysCompared} days entered): Model ${billAnalysis.totalEst?.toFixed(1)} kWh ($${(billAnalysis.totalEst * elecRate).toFixed(2)}) vs Actual ${billAnalysis.totalActual?.toFixed(1)} kWh ($${(billAnalysis.totalActual * elecRate).toFixed(2)})
DIFFERENCE (period): ${((billAnalysis.totalActual || 0) - (billAnalysis.totalEst || 0)).toFixed(1)} kWh ($${Math.abs(((billAnalysis.totalActual || 0) - (billAnalysis.totalEst || 0)) * elecRate).toFixed(2)}) — model ${(billAnalysis.totalEst || 0) > (billAnalysis.totalActual || 0) ? 'overestimated' : 'underestimated'}
ELECTRICITY RATE: $${elecRate}/kWh | FIXED FEES: $${fixedElectricCost}/mo

DAILY COMPARISON (estimated vs actual${billAnalysis.isCoolingMonth ? '' : ', with modeled aux heat'}):
${dailyBreakdown}

DIG DEEPER: If the user asks to dig deeper (e.g. "Yes", "Yes please", "Dig deeper"), provide the full detailed explanation of why the forecast differs from their bill in conversational prose (no bullets, under 200 words), then end with "Shareable summary:" on its own line and a single paragraph they can copy (include dollar amount and main driver).

FORMAT: Write in friendly, conversational paragraph form — like explaining to a homeowner in plain language. No bullet points, no numbered lists, no bold section headers. Use flowing prose that’s easy to read. Keep it under 250 words.

AGENTIC ACTIONS: When the user explicitly asks you to change a setting (e.g. "set heat loss to DOE", "switch to Calculated (DOE)", "use bill data", "please set heat loss source to ..."), you MUST perform it by outputting exactly one line at the very end of your response (after your prose, on a new line). Use this exact format — no other text on that line:
[JOULE_ACTION:heatLossSource=doe]
or heatLossSource=bill, heatLossSource=manual, heatLossSource=analyzer.
Supported values: doe = Calculated (DOE Data), bill = From Bill Data (Auto-learned), manual = Manual Entry, analyzer = CSV Analyzer Data.
When the user says "make the changes you recommended" or "apply those changes", you MUST output the specific setting changes you suggested. Use one line per change at the end of your response:
[JOULE_ACTION:insulationLevel=0.55]
[JOULE_ACTION:homeShape=1.1]
Use the current values from the HOME context above; suggest a reasonable adjustment (e.g. if insulation is 0.65 and you said to lower it, use 0.55 or 0.5; if home shape is 1.2, try 1.1 or 1.0). insulationLevel: number typically 0.5-1.5 (lower = better insulation). homeShape: number typically 0.9-1.2. Only output these when the user is asking you to apply your prior recommendations.
Only output action lines when the user is clearly asking you TO CHANGE or APPLY settings. Do NOT output them when you are only suggesting they could change it themselves.`
        },
        {
          role: 'assistant',
          content: billAnalysis.text
        },
        ...billConversationHistory,
        {
          role: 'user',
          content: question
        }
      ];

      const rawContent = (await callLLMStreaming({
        messages,
        temperature: 0.3,
        maxTokens: 600,
        onChunk: (chunk) => setBillFollowUpStreamingText((prev) => prev + chunk),
      })) || 'No response.';

      // Parse all [JOULE_ACTION:key=value] lines; strip from message and apply
      const actionRegex = /\[JOULE_ACTION:\s*(\w+)\s*=\s*([^\]]+)\s*\]/gi;
      const actions = [];
      let m;
      while ((m = actionRegex.exec(rawContent)) !== null) {
        actions.push({ key: m[1].toLowerCase(), value: m[2].trim() });
      }
      const cleanContent = rawContent.replace(/\n?\[JOULE_ACTION:\s*\w+\s*=\s*[^\]]+\s*\]\s*/gi, '').trim();

      if (setUserSetting) {
        for (const { key, value } of actions) {
          if (key === 'heatlosssource') {
            const v = value.toLowerCase();
            const isDoe = v === 'doe' || v === 'calculated';
            const isBill = v === 'bill' || v === 'learned';
            const isManual = v === 'manual';
            const isAnalyzer = v === 'analyzer';
            if (isDoe) {
              setUserSetting('useManualHeatLoss', false);
              setUserSetting('useAnalyzerHeatLoss', false);
              setUserSetting('useLearnedHeatLoss', false);
              setUserSetting('useCalculatedHeatLoss', true);
              try { localStorage.setItem('heatLossMethodUserChoice', 'true'); } catch { /* ignore */ }
            } else if (isBill) {
              setUserSetting('useManualHeatLoss', false);
              setUserSetting('useAnalyzerHeatLoss', false);
              setUserSetting('useCalculatedHeatLoss', false);
              setUserSetting('useLearnedHeatLoss', true);
              try { localStorage.setItem('heatLossMethodUserChoice', 'true'); } catch { /* ignore */ }
            } else if (isManual) {
              setUserSetting('useCalculatedHeatLoss', false);
              setUserSetting('useAnalyzerHeatLoss', false);
              setUserSetting('useLearnedHeatLoss', false);
              setUserSetting('useManualHeatLoss', true);
              try { localStorage.setItem('heatLossMethodUserChoice', 'true'); } catch { /* ignore */ }
            } else if (isAnalyzer) {
              setUserSetting('useManualHeatLoss', false);
              setUserSetting('useCalculatedHeatLoss', false);
              setUserSetting('useLearnedHeatLoss', false);
              setUserSetting('useAnalyzerHeatLoss', true);
              try { localStorage.setItem('heatLossMethodUserChoice', 'true'); } catch { /* ignore */ }
            }
          } else if (key === 'insulationlevel') {
            const num = parseFloat(value);
            if (Number.isFinite(num)) {
              const clamped = Math.max(0.3, Math.min(2, num));
              setUserSetting('insulationLevel', clamped);
            }
          } else if (key === 'homeshape') {
            const num = parseFloat(value);
            if (Number.isFinite(num)) {
              const clamped = Math.max(0.5, Math.min(2, num));
              setUserSetting('homeShape', clamped);
            }
          }
        }
      }

      const updatedHistory = [
        ...historyWithUser,
        { role: 'assistant', content: cleanContent },
      ];
      setBillConversationHistory(updatedHistory.slice(-8));
      if (billAnalysisSpeechEnabled && billSpeak && cleanContent?.trim()) {
        billSpeak(cleanContent, { force: true });
      }
    } catch (err) {
      console.error('Bill follow-up error:', err);
      setBillConversationHistory((prev) => {
        const withoutLast = prev.slice(0, -1);
        return [...withoutLast, { role: 'assistant', content: `Error: ${err.message}` }];
      });
    } finally {
      setBillFollowUpStreamingText('');
      setBillFollowUpLoading(false);
    }
  }, [billFollowUpQuestion, billAnalysis, billConversationHistory, utilityCost, fixedElectricCost, setUserSetting, billAnalysisSpeechEnabled, billSpeak]);

  // Auto-scroll follow-up chat so the latest message (and streaming) stays in view
  useEffect(() => {
    const el = billFollowUpScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [billConversationHistory, billFollowUpStreamingText]);

  // Auto-speak when bill analysis completes (only when loading transitions from true to false)
  const billAnalysisWasLoadingRef = useRef(false);
  useEffect(() => {
    if (billAnalysisLoading) {
      billAnalysisWasLoadingRef.current = true;
      return;
    }
    if (billAnalysisWasLoadingRef.current && billAnalysis?.text && billAnalysisSpeechEnabled && billSpeak) {
      billAnalysisWasLoadingRef.current = false;
      const fullText = billAnalysis.text;
      const summaryMatch = fullText.match(/\n\s*(?:Here'?s? a )?[Ss]hareable summary\s*:\s*\n?(.*)/is);
      const mainText = summaryMatch ? fullText.slice(0, fullText.indexOf(summaryMatch[0])).trim() : fullText;
      const digDeeperPhrase = mainText.includes('Want to take a closer look together?') ? 'Want to take a closer look together?' : 'Want to dig deeper?';
      const digDeeperIdx = mainText.indexOf(digDeeperPhrase);
      const textToSpeak = digDeeperIdx >= 0 ? mainText.slice(0, digDeeperIdx + digDeeperPhrase.length).trim() : mainText;
      if (textToSpeak?.trim()) {
        billSpeak(textToSpeak, { force: true });
      }
    } else if (!billAnalysisLoading) {
      billAnalysisWasLoadingRef.current = false;
    }
  }, [billAnalysisLoading, billAnalysis?.text, billAnalysisSpeechEnabled, billSpeak]);

  // Daily forecast for breakdown
  const { dailyForecast, loading: forecastLoading, error: forecastError } = useMonthlyForecast(
    locationData?.latitude,
    locationData?.longitude,
    selectedMonth,
    { enabled: !!locationData, year: selectedYear }
  );

  // Apply temperature adjustments based on forecast model
  const adjustedForecast = useMemo(() => {
    if (!dailyForecast || dailyForecast.length === 0) return null;
    
    // Debug logging
    if (import.meta?.env?.DEV) {
      const forecastCount = dailyForecast.filter(d => d.source === 'forecast' || d.source === 'forecast-adjusted').length;
      const historicalCount = dailyForecast.filter(d => d.source === 'historical' || d.source === 'historical-adjusted').length;
      console.log(`📊 MonthlyBudgetPlanner received ${dailyForecast.length} days (${forecastCount} forecast, ${historicalCount} historical)`);
    }
    
    if (forecastModel === "typical") {
      // No adjustment - use as-is (TMY3 baseline)
      return dailyForecast;
    }
    
    if (forecastModel === "polarVortex") {
      // Apply -5°F offset to all temperatures (worst case scenario)
      return dailyForecast.map(day => ({
        ...day,
        high: day.high - 5,
        low: day.low - 5,
        avg: day.avg - 5,
        source: day.source === "forecast" ? "forecast-adjusted" : "historical-adjusted",
      }));
    }
    
    // "current" - use forecast as-is (already using current forecast)
    return dailyForecast;
  }, [dailyForecast, forecastModel]);

  // Auto-extract bill when arriving from onboarding with pasted bill (must be after parseBillWithGroq, adjustedForecast)
  const actualKwhCount = Object.values(actualKwhEntries).filter((v) => typeof v === "number").length;
  useEffect(() => {
    const phase = sessionStorage.getItem("onboardingBillAutoProcess");
    if (phase !== "extract" || !billPasteText.trim() || billParsing) return;
    if (isOnboardingExtractionFromContinue()) {
      // Extraction was started from Continue - data may already be in localStorage
      const stored = JSON.parse(localStorage.getItem(actualKwhStorageKey) || '{}');
      if (Object.keys(stored).some(k => typeof stored[k] === 'number')) {
        setActualKwhEntries(stored);
        setBillPasteText('');
        setShowBillPaste(false);
        setRunAutoAnalyzeAfterExtract(true);
        sessionStorage.removeItem("onboardingBillAutoProcess");
        clearOnboardingExtractionFlag();
      }
      return;
    }
    sessionStorage.setItem("onboardingBillAutoProcess", "extracting");
    parseBillWithGroq();
  }, [billPasteText, billParsing, parseBillWithGroq, actualKwhStorageKey]);

  // Transition from extracting to analyze when extraction completes
  useEffect(() => {
    const phase = sessionStorage.getItem("onboardingBillAutoProcess");
    if (phase !== "extracting" || actualKwhCount === 0) return;
    sessionStorage.setItem("onboardingBillAutoProcess", "analyze");
  }, [actualKwhCount]);

  // Auto-analyze bill discrepancy after extraction (when forecast and dailyMetrics are ready)
  useEffect(() => {
    const phase = sessionStorage.getItem("onboardingBillAutoProcess");
    if (phase !== "analyze" || actualKwhCount === 0 || billAnalysisLoading) return;
    if (!adjustedForecast || adjustedForecast.length === 0) return;
    const metrics = dailyMetricsRef.current;
    if (!metrics || metrics.length === 0) return;
    sessionStorage.removeItem("onboardingBillAutoProcess");
    analyzeBillDiscrepancy(metrics);
  }, [actualKwhCount, billAnalysisLoading, adjustedForecast, analyzeBillDiscrepancy]);

  // After Extract with AI completes, auto-run "Why is my bill so high?" analysis
  // Must wait for adjustedForecast + dailyMetricsRef to be populated (Details table renders)
  useEffect(() => {
    if (!runAutoAnalyzeAfterExtract || actualKwhCount === 0 || billAnalysisLoading) return;
    if (!adjustedForecast || adjustedForecast.length === 0) return;
    const metrics = dailyMetricsRef.current;
    if (!metrics || metrics.length === 0) return;
    setRunAutoAnalyzeAfterExtract(false);
    analyzeBillDiscrepancy(metrics);
  }, [runAutoAnalyzeAfterExtract, actualKwhCount, billAnalysisLoading, adjustedForecast, analyzeBillDiscrepancy]);

  // Calculate balance point for aux heat (heat pumps only)
  const balancePoint = useMemo(() => {
    if (primarySystem !== "heatPump" || energyMode !== "heating") return null;
    
    const tonsMap = { 18: 1.5, 24: 2.0, 30: 2.5, 36: 3.0, 42: 3.5, 48: 4.0, 60: 5.0 };
    const tons = tonsMap[capacity] || 3.0;
    const estimatedDesignHeatLoss = heatUtils.calculateHeatLoss({
      squareFeet,
      insulationLevel,
      homeShape,
      ceilingHeight,
      wallHeight,
      hasLoft,
    });
    const heatLossBtu = estimatedDesignHeatLoss / 70; // BTU/hr per °F
    const avgWinterIndoorTemp = ((userSettings?.winterThermostatDay ?? 70) * 16 + (userSettings?.winterThermostatNight ?? 68) * 8) / 24;
    const compressorPower = tons * 1.0 * (15 / (hspf2 || efficiency));
    
    // Find balance point where heat pump output equals building heat loss
    for (let temp = -20; temp <= 50; temp += 0.5) {
      const perf = heatUtils.computeHourlyPerformance(
        {
          tons,
          indoorTemp: avgWinterIndoorTemp,
          designHeatLossBtuHrAt70F: estimatedDesignHeatLoss,
          compressorPower,
          hspf2: hspf2 || efficiency,
        },
        temp,
        50 // Typical humidity
      );
      
      const buildingHeatLossBtu = heatLossBtu * Math.max(0, avgWinterIndoorTemp - temp);
      const hpOutput = perf.deliveredHpBtuHr ?? perf.heatpumpOutputBtu ?? 0;
      
      // Balance point: heat pump output ≈ building heat loss (heatUtils returns deliveredHpBtuHr)
      if (hpOutput >= buildingHeatLossBtu * 0.95 && hpOutput <= buildingHeatLossBtu * 1.05) {
        return temp;
      }
      
      // If heat pump can't keep up even at warm temps, balance point is very low
      if (temp >= 40 && hpOutput < buildingHeatLossBtu) {
        return -25; // Below -20°F, effectively no balance point
      }
    }
    
    return null; // No balance point found (system can handle all temps)
  }, [primarySystem, energyMode, capacity, squareFeet, insulationLevel, homeShape, ceilingHeight, wallHeight, hasLoft, userSettings?.winterThermostatDay, userSettings?.winterThermostatNight]);
  
  // Calculate potential savings from recommended schedule
  // Heating: 70°F day / 68°F night (lower = less heating = save). Cooling: 76°F day / 78°F night (higher = less cooling = save)
  const _potentialSavings = useMemo(() => {
    if (!monthlyEstimate?.cost) return null;

    const timeToHours = (timeStr) => {
      const [hours, minutes] = timeStr.split(":").map(Number);
      return hours + minutes / 60;
    };
    const dayStart = timeToHours(daytimeTime);
    const nightStart = timeToHours(nighttimeTime);
    let dayHours, nightHours;
    if (dayStart < nightStart) {
      dayHours = nightStart - dayStart;
      nightHours = 24 - dayHours;
    } else {
      nightHours = dayStart - nightStart;
      dayHours = 24 - nightHours;
    }

    if (energyMode === "heating") {
      const currentAvg = (indoorTemp * dayHours + nighttimeTemp * nightHours) / 24;
      const recommendedDay = 70;
      const recommendedNight = 68;
      const recommendedAvg = (recommendedDay * dayHours + recommendedNight * nightHours) / 24;
      const tempDiff = currentAvg - recommendedAvg;
      if (tempDiff > 0) {
        const savingsPercent = (tempDiff / currentAvg) * 0.8;
        return {
          dollars: monthlyEstimate.cost * savingsPercent,
          percent: savingsPercent * 100,
          tempDiff,
        };
      }
    } else if (energyMode === "cooling") {
      const dayTemp = summerThermostat ?? 76;
      const nightTemp = summerThermostatNight ?? 78;
      const currentAvg = (dayTemp * dayHours + nightTemp * nightHours) / 24;
      const recommendedDay = 76;
      const recommendedNight = 78;
      const recommendedAvg = (recommendedDay * dayHours + recommendedNight * nightHours) / 24;
      const tempDiff = recommendedAvg - currentAvg;
      if (tempDiff > 0) {
        const savingsPercent = (tempDiff / currentAvg) * 0.8;
        return {
          dollars: monthlyEstimate.cost * savingsPercent,
          percent: savingsPercent * 100,
          tempDiff,
        };
      }
    }
    return null;
  }, [energyMode, monthlyEstimate, indoorTemp, nighttimeTemp, summerThermostat, summerThermostatNight, daytimeTime, nighttimeTime]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [electricityRateSourceA, setElectricityRateSourceA] =
    useState("default");
  const [electricityRateSourceB, setElectricityRateSourceB] =
    useState("default");

  // State for comparison mode
  const [locationDataB, setLocationDataB] = useState(null);
  const [historicalTempsB, setHistoricalTempsB] = useState(null);
  const [historicalTempsA, setHistoricalTempsA] = useState(null);
  const [monthlyEstimateB, setMonthlyEstimateB] = useState(null);
  const [loadingB, setLoadingB] = useState(false);
  const [errorB, setErrorB] = useState(null);
  const [cityInputB, setCityInputB] = useState("");
  const [elevationOverrideB, setElevationOverrideB] = useState(null);
  const [searchStatusB, setSearchStatusB] = useState(null);

  // State for fetched electricity rates
  const [electricityRateA, setElectricityRateA] = useState(null);
  const [electricityRateB, setElectricityRateB] = useState(null);
  const [_gasRateA, setGasRateA] = useState(null);
  const [_gasRateB, setGasRateB] = useState(null);

  // Hybrid rate fetching: Try EIA API first, fall back to hardcoded state averages
  const fetchUtilityRate = useCallback(
    async (stateName, rateType = "electricity") => {
      if (!stateName)
        return {
          rate: rateType === "electricity" ? utilityCost : gasCost,
          source: "⚠️ US National Average",
        };
      const stateCode = getStateCode(stateName);
      if (!stateCode) {
        console.warn(`Could not find state code for: ${stateName}`);
        return {
          rate: rateType === "electricity" ? utilityCost : gasCost,
          source: "⚠️ US National Average",
        };
      }
      try {
        const liveData =
          rateType === "electricity"
            ? await fetchLiveElectricityRate(stateCode)
            : await fetchLiveGasRate(stateCode);
        if (liveData?.rate)
          return {
            rate: liveData.rate,
            source: `✓ Live EIA Data (${liveData.timestamp})`,
          };
      } catch (err) {
        console.warn(`EIA API failed for ${stateName}, using fallback`, err);
      }
      const fallbackTable =
        rateType === "electricity" ? STATE_ELECTRICITY_RATES : STATE_GAS_RATES;
      const fallbackRate = fallbackTable[stateName] || fallbackTable["DEFAULT"];
      return {
        rate: fallbackRate,
        source: `ⓘ ${stateName} Average (Hardcoded)`,
      };
    },
    [utilityCost, gasCost]
  );

  // Track last fetched state to prevent duplicate fetches
  const lastFetchedStateRef = useRef(null);
  const isFetchingRateRef = useRef(false);

  // Automatically fetch electricity rates when Location A changes
  useEffect(() => {
    if (locationData?.state) {
      // Only fetch if state actually changed and not already fetching
      if (lastFetchedStateRef.current === locationData.state || isFetchingRateRef.current) {
        return;
      }
      lastFetchedStateRef.current = locationData.state;
      isFetchingRateRef.current = true;
      
      fetchUtilityRate(locationData.state, "electricity").then((result) => {
        if (result?.rate) {
          setElectricityRateA(result.rate);
          setElectricityRateSourceA(result.source);
        }
      }).catch((err) => {
        console.error("Error fetching rate for Location A:", err);
      }).finally(() => {
        isFetchingRateRef.current = false;
      });
      
      if (isGasHeat) {
        fetchUtilityRate(locationData.state, "gas").then((result) => {
          if (result?.rate) {
            setGasRateA(result.rate);
          }
        }).catch((err) => {
          console.error("Error fetching gas rate for Location A:", err);
        });
      }
    } else {
      lastFetchedStateRef.current = null;
    }
    // Don't include fetchUtilityRate in deps - it changes on every render causing loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationData?.state, primarySystem]);

  // Track last fetched state for Location B
  const lastFetchedStateBRef = useRef(null);
  const isFetchingRateBRef = useRef(false);
  
  // Automatically fetch electricity rates when Location B changes
  useEffect(() => {
    if (locationDataB?.state) {
      // Only fetch if state actually changed and not already fetching
      if (lastFetchedStateBRef.current === locationDataB.state || isFetchingRateBRef.current) {
        return;
      }
      lastFetchedStateBRef.current = locationDataB.state;
      isFetchingRateBRef.current = true;
      
      fetchUtilityRate(locationDataB.state, "electricity").then((result) => {
        if (result?.rate) {
          setElectricityRateB(result.rate);
          setElectricityRateSourceB(result.source);
        }
      }).catch((err) => {
        console.error("Error fetching rate for Location B:", err);
      }).finally(() => {
        isFetchingRateBRef.current = false;
      });
      
      if (isGasHeat) {
        fetchUtilityRate(locationDataB.state, "gas").then((result) => {
          if (result?.rate) {
            setGasRateB(result.rate);
          }
        }).catch((err) => {
          console.error("Error fetching gas rate for Location B:", err);
        });
      }
    } else {
      lastFetchedStateBRef.current = null;
    }
    // Don't include fetchUtilityRate in deps - it changes on every render causing loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationDataB?.state, primarySystem]);

  /**
   * Get effective heat loss factor (BTU/hr/°F)
   * Priority: 1) manual override, 2) ecobee CSV analyzer, 3) auto-learned from bill data, 4) building spec calc
   * 
   * The analyzerHeatLoss comes from SystemPerformanceAnalyzer.jsx which analyzes
   * actual runtime data from ecobee CSV files to calculate real-world building efficiency.
   * The learnedHeatLoss is auto-calculated from utility bill data vs weather data.
   * Both are more accurate than theoretical calculations based on square footage alone.
   */
  const calculatedHeatLossFactor = useMemo(() => {
    const estimatedDesignHeatLoss = heatUtils.calculateHeatLoss({
      squareFeet,
      insulationLevel,
      homeShape,
      ceilingHeight,
      wallHeight,
      hasLoft,
    });
    return estimatedDesignHeatLoss / 70;
  }, [squareFeet, insulationLevel, homeShape, ceilingHeight, wallHeight, hasLoft]);

  const getEffectiveHeatLossFactor = useMemo(() => {
    // Priority 1: Manual heat loss override (user-calibrated from utility bill)
    if (userSettings?.useManualHeatLoss && userSettings?.manualHeatLoss > 0) {
      return userSettings.manualHeatLoss;
    }
    
    // Priority 2: Analyzer heat loss from ecobee CSV analysis
    const analyzerHeatLoss = userSettings?.analyzerHeatLoss;
    if (userSettings?.useAnalyzerHeatLoss && analyzerHeatLoss && typeof analyzerHeatLoss === 'number' && analyzerHeatLoss > 0) {
      return analyzerHeatLoss;
    }
    
    // Priority 3: Auto-learned heat loss from bill data (only after ≥30 days of bill data)
    const learnedHeatLoss = userSettings?.learnedHeatLoss;
    if (userSettings?.useLearnedHeatLoss && learnedHeatLoss && typeof learnedHeatLoss === 'number' && learnedHeatLoss > 0 && shouldUseLearnedHeatLoss()) {
      return learnedHeatLoss;
    }
    
    // Priority 4: Fallback to calculated heat loss from building specs
    return calculatedHeatLossFactor;
  }, [userSettings?.useManualHeatLoss, userSettings?.manualHeatLoss, userSettings?.useAnalyzerHeatLoss, userSettings?.analyzerHeatLoss, userSettings?.useLearnedHeatLoss, userSettings?.learnedHeatLoss, calculatedHeatLossFactor]);

  // Track which HLF source is active for the calibration status indicator (learned only after ≥30 days of bill data)
  const hlfSource = useMemo(() => {
    if (userSettings?.useManualHeatLoss && userSettings?.manualHeatLoss > 0) return 'manual';
    if (userSettings?.useAnalyzerHeatLoss && userSettings?.analyzerHeatLoss > 0) return 'analyzer';
    if (userSettings?.useLearnedHeatLoss && userSettings?.learnedHeatLoss > 0 && shouldUseLearnedHeatLoss()) return 'learned';
    return 'calculated';
  }, [userSettings?.useManualHeatLoss, userSettings?.manualHeatLoss, userSettings?.useAnalyzerHeatLoss, userSettings?.analyzerHeatLoss, userSettings?.useLearnedHeatLoss, userSettings?.learnedHeatLoss]);

  // Heat gain factor for cooling (BTU/hr per °F above balance) — used for Smart Optimizer in cooling mode
  const heatGainFactor = useMemo(() => {
    const ceilingMult = 1 + (ceilingHeight - 8) * 0.1;
    const designHeatGain = squareFeet * 28.0 * insulationLevel * homeShape * ceilingMult * (solarExposure ?? 1);
    return designHeatGain / 20;
  }, [squareFeet, insulationLevel, homeShape, ceilingHeight, solarExposure]);

  // Keep bill follow-up prompt context ref in sync (used by sendBillFollowUp to avoid TDZ)
  useEffect(() => {
    billFollowUpContextRef.current = {
      effectiveHeatLoss: getEffectiveHeatLossFactor,
      hlfSource,
      squareFeet,
      insulationLevel,
      homeShape,
      ceilingHeight,
    };
  }, [getEffectiveHeatLossFactor, hlfSource, squareFeet, insulationLevel, homeShape, ceilingHeight]);

  /**
   * Auto-learn Heat Loss Factor from bill data
   * When the user has entered ≥7 heating days of actual kWh data and we have weather data,
   * back-calculate the empirical HLF and save it to userSettings so the model "learns" over time.
   * 
   * Formula: HLF = actualKwh × 3412 / 24 / ΔT  (BTU/hr/°F)
   * Only uses heating days (ΔT ≥ 5°F) to avoid division-by-near-zero noise.
   * Filters outliers using IQR method to prevent bad data from skewing the result.
   */
  useEffect(() => {
    if (!adjustedForecast || adjustedForecast.length === 0) return;
    if (!setUserSetting) return;
    // Don't overwrite manual or analyzer calibration
    if (userSettings?.useManualHeatLoss && userSettings?.manualHeatLoss > 0) return;
    if (userSettings?.analyzerHeatLoss > 0) return;

    const setTemp = effectiveIndoorTemp || 70;
    const MIN_DAYS = 7;
    const MIN_DELTA_T = 5; // Minimum temp diff to count as a real heating day

    // Collect days that have both actual kWh and weather data
    const hlfSamples = [];
    adjustedForecast.forEach((day) => {
      const dayKey = day.date instanceof Date
        ? `${day.date.getMonth() + 1}-${day.date.getDate()}`
        : `${selectedMonth}-${day.day}`;
      const actualKwh = actualKwhEntries[dayKey];
      if (actualKwh == null || actualKwh <= 0) return;

      const avgOutdoor = (day.low + day.high) / 2;
      const deltaT = setTemp - avgOutdoor;
      if (deltaT < MIN_DELTA_T) return; // Skip mild/cooling days

      // Back-calculate HLF for this day: kWh→BTU, then ÷ 24hr ÷ ΔT
      const dayHLF = (actualKwh * 3412) / 24 / deltaT;
      if (Number.isFinite(dayHLF) && dayHLF > 0 && dayHLF < 2000) {
        hlfSamples.push(dayHLF);
      }
    });

    if (hlfSamples.length < MIN_DAYS) return;

    // IQR outlier filter to remove bad data points
    const sorted = [...hlfSamples].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    const filtered = sorted.filter(v => v >= lowerBound && v <= upperBound);

    if (filtered.length < MIN_DAYS) return;

    const empiricalHLF = Math.round(filtered.reduce((a, b) => a + b, 0) / filtered.length);

    // Only save if meaningfully different from current learned value (>5% change)
    const currentLearned = userSettings?.learnedHeatLoss || 0;
    const pctChange = currentLearned > 0 ? Math.abs(empiricalHLF - currentLearned) / currentLearned : 1;
    if (pctChange < 0.05) return; // Already calibrated close enough

    // Save learned HLF and metadata
    const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    const existingMonths = userSettings?.learnedHeatLossMonths || [];
    const updatedMonths = existingMonths.includes(monthKey) ? existingMonths : [...existingMonths, monthKey];

    if (import.meta?.env?.DEV) {
      console.log(`🧠 Auto-learned HLF: ${empiricalHLF} BTU/hr/°F from ${filtered.length} heating days (was ${currentLearned || 'uncalibrated'}, calc'd ${calculatedHeatLossFactor.toFixed(0)})`);
    }

    setUserSetting('learnedHeatLoss', empiricalHLF);
    setUserSetting('useLearnedHeatLoss', true);
    setUserSetting('useCalculatedHeatLoss', false);
    setUserSetting('learnedHeatLossDays', filtered.length);
    setUserSetting('learnedHeatLossMonths', updatedMonths);
    setUserSetting('learnedHeatLossDate', new Date().toISOString());
  }, [actualKwhEntries, adjustedForecast, effectiveIndoorTemp, selectedMonth, selectedYear, userSettings?.useManualHeatLoss, userSettings?.manualHeatLoss, userSettings?.analyzerHeatLoss, userSettings?.learnedHeatLoss, userSettings?.learnedHeatLossMonths, calculatedHeatLossFactor, setUserSetting]);

  /**
   * Get location-aware baseline temperature for heating calculations
   * This is the outdoor temperature below which heating is needed (balance point).
   * Colder climates use 30°F, moderate climates use 35°F.
   * 
   * @param {Object} locationData - Location data with latitude
   * @returns {number} Baseline temperature in °F
   */
  const _getLocationAwareBaselineTemp = useCallback((locationData) => {
    if (!locationData?.latitude) return 35; // Default for unknown location
    
    const lat = Number(locationData.latitude);
    // Colder climates (higher latitude or known cold regions): 30°F
    // Moderate climates: 35°F
    if (lat >= 40 || locationData.state?.match(/AK|MN|ND|SD|MT|WY|ME|VT|NH/i)) {
      return 30;
    }
    return 35;
  }, []);

  const heatingMonths = useMemo(
    () => [
      { value: 1, label: "January" },
      { value: 2, label: "February" },
      { value: 10, label: "October" },
      { value: 11, label: "November" },
      { value: 12, label: "December" },
    ],
    []
  );
  const coolingMonths = useMemo(
    () => [
      { value: 4, label: "April" },
      { value: 5, label: "May" },
      { value: 6, label: "June" },
      { value: 7, label: "July" },
      { value: 8, label: "August" },
      { value: 9, label: "September" },
    ],
    []
  );
  // Combine all months for the dropdown - users can select any month
  const allMonths = useMemo(
    () => [
      ...heatingMonths,
      { value: 3, label: "March" },
      ...coolingMonths,
    ].sort((a, b) => a.value - b.value), // Sort by month number
    [heatingMonths, coolingMonths]
  );
  const activeMonths = useMemo(
    () => allMonths, // Show all months in dropdown
    [allMonths]
  );

  // Auto-determine energy mode based on selected month
  useEffect(() => {
    const isCoolingMonth = coolingMonths.some((m) => m.value === selectedMonth);
    const isHeatingMonth = heatingMonths.some((m) => m.value === selectedMonth);
    
    // Auto-switch energy mode when user selects a month
    if (isCoolingMonth && energyMode !== "cooling") {
      setUserSetting?.("energyMode", "cooling");
    } else if (isHeatingMonth && energyMode !== "heating") {
      setUserSetting?.("energyMode", "heating");
    }
    // For transition months (March, April), keep current mode or default to heating
  }, [selectedMonth, coolingMonths, heatingMonths, energyMode, setUserSetting]);

  const calculateMonthlyEstimate = useCallback(
    (temps, setEstimate, electricityRate, overrideLocationData = null) => {
      const commonParams = {
        squareFeet,
        insulationLevel,
        homeShape,
        ceilingHeight,
        efficiency,
        solarExposure,
      };
      
      const locData = overrideLocationData || locationData;

      // 1. DETERMINE FIXED CHARGE
      let monthlyFixedCharge = 0;
      
      // Logic: If using Gas Furnace during heating season, apply Gas Fixed Cost.
      // Otherwise (Heat Pump, Cooling, or Electric Furnace), apply Electric Fixed Cost.
      // Note: Realistically users pay both if they have both meters, but this attributes 
      // the fixed cost to the active fuel source for this budget estimate.
      const isHeatingMode = energyMode === "heating";
      if (isHeatingMode && isGasHeat) {
         monthlyFixedCharge = fixedGasCost;
      } else {
         monthlyFixedCharge = fixedElectricCost;
      }

      const isCoolingMonth = coolingMonths.some(m => m.value === selectedMonth);
      const isHeatingMonth = heatingMonths.some(m => m.value === selectedMonth);
      const useCooling = isCoolingMonth || (energyMode === "cooling" && !isHeatingMonth);

      if (!temps || temps.length === 0) {
        // Use the already-determined cooling/heating status from above
        
        // Wrap the setter to add fixed costs
        const wrappedSetEstimate = (est) => {
          if (est) {
            est.cost = (est.cost || 0) + monthlyFixedCharge;
            est.fixedCost = monthlyFixedCharge; // Save for display
          }
          setEstimate(est);
        };
        
        if (useCooling) {
          estimateTypicalCDDCost({
            ...commonParams,
            month: selectedMonth,
            setEstimate: wrappedSetEstimate, // Use wrapper
            capacity,
            electricityRate,
            locationData: locData,
            userSettings,
          });
        } else {
          estimateTypicalHDDCost({
            ...commonParams,
            month: selectedMonth,
            setEstimate: wrappedSetEstimate, // Use wrapper
            electricityRate,
            hspf: hspf2,
            locationData: locData,
            userSettings,
          });
        }
        return;
      }

      // Use the already-determined cooling/heating status from above
      
      if (useCooling) {
        const coolingCapacityKbtu =
          primarySystem === "heatPump" ? capacity : (coolingCapacity || capacity);
        const seer2 = efficiency;
        const tonsMap = {
          18: 1.5,
          24: 2.0,
          30: 2.5,
          36: 3.0,
          42: 3.5,
          48: 4.0,
          60: 5.0,
        };
        const tons = tonsMap[coolingCapacityKbtu] || tonsMap[capacity] || 3.0;
        const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
        const designHeatGain =
          squareFeet *
          28.0 *
          insulationLevel *
          homeShape *
          ceilingMultiplier *
          solarExposure;
        const btuGainPerDegF = designHeatGain / 20.0;
        let totalCost = 0,
          totalEnergyKWh = 0,
          unmetHours = 0;

        temps.forEach((day) => {
          const tempDiff = Math.max(0, day.avg - effectiveIndoorTemp);
          if (tempDiff <= 0) return;
          const totalDailyHeatGainBtu = btuGainPerDegF * tempDiff * 24;
          const dailyKWh = totalDailyHeatGainBtu / (seer2 * 1000);
          const systemDailyCapacityBtu = tons * 12000 * 24;
          if (totalDailyHeatGainBtu > systemDailyCapacityBtu) unmetHours += 24;
          const maxDailyKwh = systemDailyCapacityBtu / (seer2 * 1000);
          const actualDailyKwh = Math.min(dailyKWh, maxDailyKwh);
          totalEnergyKWh += actualDailyKwh;
          totalCost += actualDailyKwh * electricityRate;
        });

        totalCost += monthlyFixedCharge; // Add fixed charge to total
        
        setEstimate({
          cost: totalCost,
          fixedCost: monthlyFixedCharge, // Pass to state for display
          energy: totalEnergyKWh,
          days: temps.length,
          avgDailyTemp: temps.reduce((s, t) => s + t.avg, 0) / temps.length,
          electricityRate,
          method: "cooling",
          unmetHours: Math.round(unmetHours),
          seer2,
          tons,
          solarExposure,
        });
        return;
      }

      if (isGasHeat) {
        const eff = Math.min(0.99, Math.max(0.6, afue));
        const btuPerTherm = 100000;
        const estimatedDesignHeatLoss = heatUtils.calculateHeatLoss({
          squareFeet,
          insulationLevel,
          homeShape,
          ceilingHeight,
          wallHeight,
          hasLoft,
        });
        const btuLossPerDegF = estimatedDesignHeatLoss / 70;
        let totalTherms = 0,
          totalCost = 0;
        
        // Use sinusoidal hourly temperatures for accurate calculations (consistent with heat pump)
        temps.forEach((day) => {
          const lowTemp = day.low;
          const highTemp = day.high;
          const tempRange = highTemp - lowTemp;
          const avgTemp = (highTemp + lowTemp) / 2;
          
          let dailyTherms = 0;
          // Generate hourly temperatures using sinusoidal pattern (low at 6 AM, high at 2 PM)
          for (let hour = 0; hour < 24; hour++) {
            const phase = ((hour - 6) / 12) * Math.PI;
            const tempOffset = Math.cos(phase - Math.PI) * (tempRange / 2);
            const hourlyTemp = avgTemp + tempOffset;
            
            const tempDiff = Math.max(0, effectiveIndoorTemp - hourlyTemp);
            const buildingHeatLossBtu = btuLossPerDegF * tempDiff;
            const thermsPerHour = buildingHeatLossBtu / (btuPerTherm * eff);
            dailyTherms += thermsPerHour;
          }
          
          totalTherms += dailyTherms;
          totalCost += dailyTherms * gasCost;
        });
        totalCost += monthlyFixedCharge; // Add fixed charge to total
        
        setEstimate({
          cost: totalCost,
          fixedCost: monthlyFixedCharge, // Pass to state
          therms: totalTherms,
          days: temps.length,
          avgDailyTemp: temps.reduce((s, t) => s + t.avg, 0) / temps.length,
          gasCost,
          method: "gasFurnace",
        });
        return;
      }

      // Heat pump heating path
      const tonsMap = {
        18: 1.5,
        24: 2.0,
        30: 2.5,
        36: 3.0,
        42: 3.5,
        48: 4.0,
        60: 5.0,
      };
      const tons = tonsMap[capacity] || 3.0;
      const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
      const estimatedDesignHeatLoss =
        squareFeet * 22.67 * insulationLevel * homeShape * ceilingMultiplier;
      const btuLossPerDegF = estimatedDesignHeatLoss / 70;
      let totalCost = 0,
        totalEnergy = 0,
        excludedAuxEnergy = 0;

      // Use sinusoidal hourly temperatures for accurate aux heat calculations
      temps.forEach((day) => {
        const lowTemp = day.low;
        const highTemp = day.high;
        const tempRange = highTemp - lowTemp;
        const avgTemp = (highTemp + lowTemp) / 2;
        
        // Generate hourly temperatures using sinusoidal pattern (low at 6 AM, high at 6 PM)
        for (let hour = 0; hour < 24; hour++) {
          const phase = ((hour - 6) / 12) * Math.PI;
          const tempOffset = Math.cos(phase - Math.PI) * (tempRange / 2);
          const hourlyTemp = avgTemp + tempOffset;
          
          const tempDiff = Math.max(0, effectiveIndoorTemp - hourlyTemp);
        const buildingHeatLoss = btuLossPerDegF * tempDiff;
        const capFactor = Math.max(
          0.3,
            1 - (Math.abs(0 - hourlyTemp) / 100) * 0.5
        );
        const thermalOutput = tons * 12000 * capFactor;
        const compressorDelivered = Math.min(thermalOutput, buildingHeatLoss);
        const auxHeatBtu = Math.max(0, buildingHeatLoss - compressorDelivered);
        const compressorEnergyPerHour =
          compressorDelivered / ((hspf2 || efficiency) * 1000);
        const auxHeatEnergyPerHour = auxHeatBtu / 3412.14;
        const effectiveAuxEnergyPerHour = useElectricAuxHeat
          ? auxHeatEnergyPerHour
          : 0;
          const hourlyEnergy = compressorEnergyPerHour + effectiveAuxEnergyPerHour;
          totalCost += hourlyEnergy * electricityRate;
          totalEnergy += hourlyEnergy;
        if (!useElectricAuxHeat && auxHeatEnergyPerHour > 0)
            excludedAuxEnergy += auxHeatEnergyPerHour;
        }
      });

      totalCost += monthlyFixedCharge; // Add fixed charge to total
      
      setEstimate({
        cost: totalCost,
        fixedCost: monthlyFixedCharge, // Pass to state
        energy: totalEnergy,
        days: temps.length,
        avgDailyTemp: temps.reduce((s, t) => s + t.avg, 0) / temps.length,
        electricityRate,
        method: "heatPumpHeating",
        excludedAuxEnergy,
      });
    },
    [
      squareFeet,
      insulationLevel,
      homeShape,
      ceilingHeight,
      efficiency,
      solarExposure,
      energyMode,
      selectedMonth,
      capacity,
      primarySystem,
      coolingCapacity,
      effectiveIndoorTemp,
      indoorTemp,
      nighttimeTemp,
      daytimeTime,
      nighttimeTime,
      summerThermostat,
      summerThermostatNight,
      afue,
      gasCost,
      hspf2,
      useElectricAuxHeat,
      coolingMonths,
      heatingMonths,
      locationData,
      userSettings,
      fixedElectricCost,
      fixedGasCost,
    ]
  );

  const fetchHistoricalData = useCallback(
    async (
      locData,
      setEstimate,
      setLoadingState,
      setErrorState,
      elevationFtOverride
    ) => {
      if (!locData?.latitude || !locData?.longitude) {
        setErrorState(
          "Location not set. Please set your location in the Forecaster first."
        );
        return;
      }
      
      // Create cache key based on location (rounded to 2 decimals) and month
      // Historical data doesn't change, so we can cache it for a long time (30 days)
      const latRounded = Math.round(locData.latitude * 100) / 100;
      const lonRounded = Math.round(locData.longitude * 100) / 100;
      const cacheKey = `historical_climate_${latRounded}_${lonRounded}_${selectedMonth}_2020`;
      const CACHE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
      
      // Check cache first
      try {
        const cached = getCached(cacheKey);
        if (cached && cached.data && cached.timestamp) {
          const age = Date.now() - cached.timestamp;
          if (age < CACHE_EXPIRY_MS) {
            // Use cached data - process it the same way as fresh data
            const data = cached.data;
            const stationElevFt = locData.elevation ?? elevationFtOverride ?? 0;
            const homeElevFt = elevationFtOverride ?? stationElevFt;
            const deltaF = (homeElevFt - stationElevFt) * (-3.5 / 1000);
            const temps = data.daily.time.map((date, idx) => {
              const high = data.daily.temperature_2m_max[idx] + deltaF;
              const low = data.daily.temperature_2m_min[idx] + deltaF;
              return { date, high, low, avg: (high + low) / 2 };
            });
            
            if (setEstimate === setMonthlyEstimateB) setHistoricalTempsB(temps);
            if (setEstimate === setMonthlyEstimate || setEstimate === setMonthlyEstimateForHistorical) setHistoricalTempsA(temps);
            
            const isLocationA = setEstimate === setMonthlyEstimate || setEstimate === setMonthlyEstimateForHistorical;
            const rateResult = await fetchUtilityRate(locData.state, "electricity");
            if (isLocationA) setElectricityRateSourceA(rateResult.source);
            else setElectricityRateSourceB(rateResult.source);
            // Use cached setter for Location A
            const setterToUse = isLocationA ? setMonthlyEstimateCached : setEstimate;
            calculateMonthlyEstimate(temps, setterToUse, rateResult.rate);
            setLoadingState(false);
            return;
          }
        }
      } catch (error) {
        console.warn("Error reading cache, will fetch fresh data:", error);
      }
      
      setLoadingState(true);
      setErrorState(null);
      try {
        const response = await fetch(
          `https://archive-api.open-meteo.com/v1/archive?latitude=${
            locData.latitude
          }&longitude=${locData.longitude}&start_date=2020-${String(
            selectedMonth
          ).padStart(2, "0")}-01&end_date=2020-${String(selectedMonth).padStart(
            2,
            "0"
          )}-${new Date(
            2020,
            selectedMonth,
            0
          ).getDate()}&daily=temperature_2m_max,temperature_2m_min&timezone=auto&temperature_unit=fahrenheit`
        );
        if (!response.ok) throw new Error("Failed to fetch historical data");
        const data = await response.json();
        
        // Cache the raw API response
        try {
          setCached(cacheKey, {
            data: data,
            timestamp: Date.now()
          });
        } catch (cacheError) {
          console.warn("Failed to cache historical data:", cacheError);
        }
        
        const stationElevFt = locData.elevation ?? elevationFtOverride ?? 0;
        const homeElevFt = elevationFtOverride ?? stationElevFt;
        const deltaF = (homeElevFt - stationElevFt) * (-3.5 / 1000);
        const temps = data.daily.time.map((date, idx) => {
          const high = data.daily.temperature_2m_max[idx] + deltaF;
          const low = data.daily.temperature_2m_min[idx] + deltaF;
          return { date, high, low, avg: (high + low) / 2 };
        });

        if (setEstimate === setMonthlyEstimateB) setHistoricalTempsB(temps);
        if (setEstimate === setMonthlyEstimate || setEstimate === setMonthlyEstimateForHistorical) setHistoricalTempsA(temps);

        const isLocationA = setEstimate === setMonthlyEstimate || setEstimate === setMonthlyEstimateForHistorical;
        const rateResult = await fetchUtilityRate(locData.state, "electricity");
        if (isLocationA) setElectricityRateSourceA(rateResult.source);
        else setElectricityRateSourceB(rateResult.source);
        // Use cached setter for Location A
        const setterToUse = isLocationA ? setMonthlyEstimateCached : setEstimate;
        calculateMonthlyEstimate(temps, setterToUse, rateResult.rate);
      } catch (error) {
        console.warn("Error fetching historical data", error);
        setErrorState(
          "Could not fetch historical climate data. Using typical estimates."
        );
        const isLocationA = setEstimate === setMonthlyEstimate || setEstimate === setMonthlyEstimateForHistorical;
        const rateResult = await fetchUtilityRate(
          locData?.state,
          "electricity"
        );
        if (isLocationA) setElectricityRateSourceA(rateResult.source);
        else setElectricityRateSourceB(rateResult.source);
        // Use cached setter for Location A
        const setterToUse = isLocationA ? setMonthlyEstimateCached : setEstimate;
        const commonParams = {
          squareFeet,
          insulationLevel,
          homeShape,
          ceilingHeight,
          efficiency,
          solarExposure,
          electricityRate: rateResult.rate,
        };
        if (energyMode === "cooling") {
          estimateTypicalCDDCost({
            ...commonParams,
            month: selectedMonth,
            setEstimate: setterToUse,
            capacity,
            locationData,
            userSettings,
          });
        } else {
          estimateTypicalHDDCost({
            ...commonParams,
            month: selectedMonth,
            setEstimate: setterToUse,
            hspf: hspf2,
            locationData,
            userSettings,
          });
        }
      } finally {
        setLoadingState(false);
      }
    },
    [
      selectedMonth,
      fetchUtilityRate,
      calculateMonthlyEstimate,
      locationData,
      userSettings,
      hspf2,
      squareFeet,
      insulationLevel,
      homeShape,
      ceilingHeight,
      efficiency,
      solarExposure,
      energyMode,
      capacity,
    ]
  );

  // Auto-fetch for Location A - use adjusted forecast when available
  useEffect(() => {
    if (locationData?.latitude && locationData?.longitude) {
      // If we have adjusted forecast data and use forecast (not typical), the daily table
      // will compute totals; we sync monthlyEstimate from those in a separate effect.
      // Only call calculateMonthlyEstimate for typical model or when no forecast.
      if (adjustedForecast && adjustedForecast.length > 0 && mode === "budget" && forecastModel === "typical") {
        fetchUtilityRate(locationData.state, "electricity").then(result => {
          setElectricityRateSourceA(result.source);
          calculateMonthlyEstimate([], setMonthlyEstimateCached, result.rate);
        });
      } else if (adjustedForecast && adjustedForecast.length > 0 && mode === "budget") {
        // Forecast-based: fetch rate for display, monthlyEstimate synced from daily table
        fetchUtilityRate(locationData.state, "electricity").then(result => {
          setElectricityRateSourceA(result.source);
        });
      } else {
        // If forecast model is "typical", use the distribution model directly without fetching historical data
        if (forecastModel === "typical") {
          fetchUtilityRate(locationData.state, "electricity").then(result => {
            setElectricityRateSourceA(result.source);
            calculateMonthlyEstimate([], setMonthlyEstimateCached, result.rate);
          });
        } else {
          // Fall back to historical data fetch
          fetchHistoricalData(
            locationData,
            setMonthlyEstimateForHistorical,
            setLoading,
            setError
          );
        }
      }
    }
  }, [
    locationData,
    adjustedForecast,
    mode,
    fetchHistoricalData,
    selectedMonth,
    effectiveIndoorTemp,
    indoorTemp,
    nighttimeTemp,
    daytimeTime,
    nighttimeTime,
    summerThermostat,
    summerThermostatNight,
    userSettings?.winterThermostatDay,
    userSettings?.winterThermostatNight,
    utilityCost,
    gasCost,
    primarySystem,
    afue,
    capacity,
    efficiency,
    calculateMonthlyEstimate,
    fetchUtilityRate,
    forecastModel,
  ]);

  // Align monthlyEstimate with daily table totals when we have forecast-based data
  // The daily table uses heatUtils.computeHourlyPerformance + getEffectiveHeatLossFactor;
  // calculateMonthlyEstimate uses a different formula. This sync ensures Quick Answer and
  // Show me the math both use the same source (daily table).
  useEffect(() => {
    if (mode !== "budget" || forecastModel === "typical") return;
    if (!adjustedForecast?.length) return;
    const variableCost = totalForecastCostRef.current;
    const energy = totalForecastEnergyRef.current;
    if (variableCost == null || variableCost < 0 || energy == null) return;
    const isHeatingMode = energyMode === "heating";
    const fixedCost = isHeatingMode && isGasHeat ? fixedGasCost : fixedElectricCost;
    const totalCost = variableCost + (fixedCost || 0);
    setMonthlyEstimateCached(prev => ({
      ...(prev || {}),
      cost: totalCost,
      fixedCost: fixedCost || 0,
      energy,
      electricityRate: utilityCost,
    }));
  }, [
    mode,
    forecastModel,
    adjustedForecast,
    forecastLoading,
    energyMode,
    isGasHeat,
    fixedElectricCost,
    fixedGasCost,
    utilityCost,
  ]);

  // Initialize Location B to Chicago, Illinois by default when in comparison mode
  useEffect(() => {
    if (mode === "comparison" && !locationDataB) {
      // Set Chicago, Illinois as default Location B
      const chicagoLocation = {
        city: "Chicago",
        state: "Illinois",
        latitude: 41.8781,
        longitude: -87.6298,
        elevation: 587, // Approximate elevation in feet
      };
      setLocationDataB(chicagoLocation);
      setCityInputB("Chicago, Illinois");
    }
  }, [mode, locationDataB]);

  // Auto-fetch for Location B
  useEffect(() => {
    if (
      mode === "comparison" &&
      locationDataB?.latitude &&
      locationDataB?.longitude
    ) {
      if (forecastModel === "typical") {
        fetchUtilityRate(locationDataB.state, "electricity").then(result => {
          setElectricityRateSourceB(result.source);
          // Pass empty temps to trigger distribution model, and pass locationDataB
          calculateMonthlyEstimate([], setMonthlyEstimateB, result.rate, locationDataB);
        });
      } else {
        fetchHistoricalData(
          locationDataB,
          setMonthlyEstimateB,
          setLoadingB,
          setErrorB,
          elevationOverrideB
        );
      }
    }
  }, [
    mode,
    locationDataB,
    elevationOverrideB,
    fetchHistoricalData,
    selectedMonth,
    effectiveIndoorTemp,
    indoorTemp,
    nighttimeTemp,
    daytimeTime,
    nighttimeTime,
    summerThermostat,
    summerThermostatNight,
    utilityCost,
    gasCost,
    primarySystem,
    afue,
    capacity,
    efficiency,
    forecastModel,
    fetchUtilityRate,
    calculateMonthlyEstimate,
  ]);

  // Prefill fixed charges based on state when location changes
  useEffect(() => {
    const state = locationData?.state;
    if (!state) return;

    const stateAbbr = normalizeStateToAbbreviation(state);
    if (!stateAbbr) return;

    const defaults =
      defaultFixedChargesByState[stateAbbr] || defaultFallbackFixedCharges;

    // Only prefill if user hasn't touched these yet (or they're zero)
    if ((fixedElectricCost ?? 0) <= 0) {
      setUserSetting("fixedElectricCost", defaults.electric);
    }

    if (isGasHeat && (fixedGasCost ?? 0) <= 0) {
      setUserSetting("fixedGasCost", defaults.gas);
    }
  }, [
    locationData?.state,
    primarySystem,
    fixedElectricCost,
    fixedGasCost,
    setUserSetting,
  ]);

  // Handle City B search
  const handleCitySearchB = async () => {
    const raw = cityInputB.trim();
    if (!raw) return;
    setLoadingB(true);
    setSearchStatusB(null);
    try {
      // Split into city and optional state term
      let cityTerm = raw;
      let stateTerm = "";
      if (raw.includes(",")) {
        const [c, s] = raw.split(",");
        cityTerm = (c || "").trim();
        stateTerm = (s || "").trim();
      }

      const resp = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          cityTerm
        )}&count=10&language=en&format=json`
      );
      const data = await resp.json();
      let results = Array.isArray(data.results) ? data.results : [];

      // Prefer US results
      results = results.filter((r) => r.country_code === "US");

      // If a state was provided, try to match it (supports "IL" or "Illinois")
      if (stateTerm && results.length) {
        const stateNorm = normalize(stateTerm);
        const expanded = STATE_NAME_BY_ABBR[stateTerm.toUpperCase()];
        const expandedNorm = expanded ? normalize(expanded) : "";
        const filtered = results.filter((r) => {
          const adminNorm = normalize(r.admin1 || "");
          return (
            adminNorm.includes(stateNorm) ||
            (expandedNorm && adminNorm.includes(expandedNorm))
          );
        });
        if (filtered.length) results = filtered;
      }

      if (!results.length) {
        setLocationDataB(null);
        setSearchStatusB({
          type: "error",
          message: `Could not find "${raw}". Try a different spelling or include the state.`,
        });
        return;
      }

      const pick = results[0];
      const elevationFeet = Number.isFinite(pick.elevation)
        ? Math.round(pick.elevation * 3.28084)
        : 0;
      const newLoc = {
        city: pick.name,
        state: pick.admin1 || "",
        latitude: pick.latitude,
        longitude: pick.longitude,
        elevation: elevationFeet,
      };
      setLocationDataB(newLoc);
      setElevationOverrideB(elevationFeet);
      setSearchStatusB({
        type: "success",
        message: `✓ Found ${newLoc.city}, ${newLoc.state || "USA"}`,
      });
    } catch (err) {
      console.error(err);
      setSearchStatusB({
        type: "error",
        message: "Search failed. Please check your connection and try again.",
      });
    } finally {
      setLoadingB(false);
    }
  };

  // Simulate cost at a specific indoor temperature (for equivalency calc)
  const simulateCostAtTemp = (
    temps,
    targetIndoorTemp,
    electricityRate = utilityCost
  ) => {
    if (!temps || temps.length === 0) return null;

    // --- Gas Furnace Calculation ---
    if (isGasHeat) {
      const eff = Math.min(0.99, Math.max(0.6, afue));
      const btuPerTherm = 100000;
      const estimatedDesignHeatLoss = heatUtils.calculateHeatLoss({
        squareFeet,
        insulationLevel,
        homeShape,
        ceilingHeight,
        wallHeight,
        hasLoft,
      });
      const btuLossPerDegF = estimatedDesignHeatLoss / 70;

      let totalCost = 0;
      temps.forEach((day) => {
        const outdoorTemp = day.avg;
        const tempDiff = Math.max(0, targetIndoorTemp - outdoorTemp);
        const buildingHeatLossBtu = btuLossPerDegF * tempDiff;
        const thermsPerDay = (buildingHeatLossBtu * 24) / (btuPerTherm * eff);
        totalCost += thermsPerDay * gasCost;
      });
      return totalCost;
    }

    // --- Heat Pump Calculation (Covers both Heating and Cooling) ---
    let totalCost = 0;

    // Heating Logic
    if (energyMode === "heating") {
      const tonsMap = {
        18: 1.5,
        24: 2.0,
        30: 2.5,
        36: 3.0,
        42: 3.5,
        48: 4.0,
        60: 5.0,
      };
      const tons = tonsMap[capacity] || 3.0;
      const estimatedDesignHeatLoss = heatUtils.calculateHeatLoss({
        squareFeet,
        insulationLevel,
        homeShape,
        ceilingHeight,
        wallHeight,
        hasLoft,
      });
      const btuLossPerDegF = estimatedDesignHeatLoss / 70;
      const baseHspf = hspf2 || efficiency;

      temps.forEach((day) => {
        const outdoorTemp = day.avg;
        const tempDiff = Math.max(0, targetIndoorTemp - outdoorTemp);
        if (tempDiff <= 0) return; // No heating needed

        const buildingHeatLoss = btuLossPerDegF * tempDiff;
        const capFactor = Math.max(
          0.3,
          1 - (Math.abs(0 - outdoorTemp) / 100) * 0.5
        );
        const thermalOutput = tons * 12000 * capFactor;
        const compressorDelivered = Math.min(thermalOutput, buildingHeatLoss);
        const auxHeatBtu = Math.max(0, buildingHeatLoss - compressorDelivered);

        const compressorEnergyPerHour = compressorDelivered / (baseHspf * 1000);
        const auxHeatEnergyPerHour = auxHeatBtu / 3412.14;
        const effectiveAuxEnergyPerHour = useElectricAuxHeat
          ? auxHeatEnergyPerHour
          : 0;
        const totalDayEnergy =
          (compressorEnergyPerHour + effectiveAuxEnergyPerHour) * 24;
        totalCost += totalDayEnergy * electricityRate;
      });
    }
    // Cooling Logic
    else {
      const coolingCapacityKbtu = capacity;
      const seer2 = efficiency;
      const tonsMap = {
        18: 1.5,
        24: 2.0,
        30: 2.5,
        36: 3.0,
        42: 3.5,
        48: 4.0,
        60: 5.0,
      };
      const tons = tonsMap[coolingCapacityKbtu] || 3.0;
      const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
      const designHeatGain =
        squareFeet *
        28.0 *
        insulationLevel *
        homeShape *
        ceilingMultiplier *
        solarExposure;
      const btuGainPerDegF = designHeatGain / 20.0;

      temps.forEach((day) => {
        const outdoorTemp = day.avg;
        const tempDiff = Math.max(0, outdoorTemp - targetIndoorTemp);
        if (tempDiff <= 0) return; // No cooling needed

        const totalDailyHeatGainBtu = btuGainPerDegF * tempDiff * 24;
        const dailyKWh = totalDailyHeatGainBtu / (seer2 * 1000);
        const systemDailyCapacityBtu = tons * 12000 * 24;
        const maxDailyKwh = systemDailyCapacityBtu / (seer2 * 1000);
        const actualDailyKwh = Math.min(dailyKWh, maxDailyKwh);
        totalCost += actualDailyKwh * electricityRate;
      });
    }

    return totalCost;
  };

  // The calculateThermostatEquivalency function that uses the above simulation
  const calculateThermostatEquivalency = () => {
    if (!monthlyEstimate || !monthlyEstimateB || !historicalTempsB) return null;

    const targetCost = monthlyEstimate.cost;
    const cityBElectricityRate =
      monthlyEstimateB.electricityRate || utilityCost;

    let bestTemp = indoorTemp;
    let bestDiff = Infinity;

    // Iterate through a range of temperatures to find the closest cost match
    for (let temp = 60; temp <= 78; temp++) {
      const testCost = simulateCostAtTemp(
        historicalTempsB,
        temp,
        cityBElectricityRate
      );
      if (testCost === null) continue;

      const diff = Math.abs(testCost - targetCost);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestTemp = temp;
      }
    }
    return bestTemp;
  };

  // Compute a thermostat equivalency to display in the comparison card
  const thermostatEquivalency = calculateThermostatEquivalency();

  // Extract thermostat settings for top section (annual mode)
  const thermostatSettingsForDisplay = useMemo(() => {
    if (mode !== "annual" || !locationData) return null;
    
    const deadband = 5;
    let homeHeatSetPoint = 70;
    let homeCoolSetPoint = 75;
    let awayHeatSetPoint = 62;
    let awayCoolSetPoint = 85;
    let sleepHeatSetPoint = 66;
    let sleepCoolSetPoint = 78;
    let daytimeStartTime = "06:00";
    let nighttimeStartTime = "22:00";
    
    try {
      const thermostatSettings = loadThermostatSettings();
      const comfortSettings = thermostatSettings?.comfortSettings;
      const schedule = thermostatSettings?.schedule;
      
      if (comfortSettings?.home?.heatSetPoint !== undefined) {
        homeHeatSetPoint = comfortSettings.home.heatSetPoint;
      } else if (userSettings?.winterThermostatDay !== undefined) {
        homeHeatSetPoint = userSettings.winterThermostatDay;
      }
      
      if (comfortSettings?.home?.coolSetPoint !== undefined) {
        homeCoolSetPoint = comfortSettings.home.coolSetPoint;
      } else if (userSettings?.summerThermostat !== undefined) {
        homeCoolSetPoint = userSettings.summerThermostat;
      }
      
      if (comfortSettings?.away?.heatSetPoint !== undefined) {
        awayHeatSetPoint = comfortSettings.away.heatSetPoint;
      }
      if (comfortSettings?.away?.coolSetPoint !== undefined) {
        awayCoolSetPoint = comfortSettings.away.coolSetPoint;
      }
      
      if (comfortSettings?.sleep?.heatSetPoint !== undefined) {
        sleepHeatSetPoint = comfortSettings.sleep.heatSetPoint;
      } else if (userSettings?.winterThermostatNight !== undefined) {
        sleepHeatSetPoint = userSettings.winterThermostatNight;
      }
      
      if (comfortSettings?.sleep?.coolSetPoint !== undefined) {
        sleepCoolSetPoint = comfortSettings.sleep.coolSetPoint;
      } else if (userSettings?.summerThermostatNight !== undefined) {
        sleepCoolSetPoint = userSettings.summerThermostatNight;
      }
      
      if (schedule?.weekly && schedule.weekly[0]) {
        const daySchedule = schedule.weekly[0];
        const homeEntry = daySchedule.find(e => e.comfortSetting === "home");
        const sleepEntry = daySchedule.find(e => e.comfortSetting === "sleep");
        
        if (homeEntry?.time) {
          daytimeStartTime = homeEntry.time;
        }
        if (sleepEntry?.time) {
          nighttimeStartTime = sleepEntry.time;
        }
      }
      
      if (homeCoolSetPoint < homeHeatSetPoint + deadband) {
        homeCoolSetPoint = homeHeatSetPoint + deadband;
      }
      if (awayCoolSetPoint < awayHeatSetPoint + deadband) {
        awayCoolSetPoint = awayHeatSetPoint + deadband;
      }
      if (sleepCoolSetPoint < sleepHeatSetPoint + deadband) {
        sleepCoolSetPoint = sleepHeatSetPoint + deadband;
      }
    } catch (error) {
      console.warn("Could not load thermostat settings, using defaults:", error);
    }
    
    // Determine data source
    const usesHistoricalHourly = historicalHourly && historicalHourly.length > 0;
    const usesSinusoidalApprox = !usesHistoricalHourly && primarySystem === "heatPump";
    
    return {
      homeHeatSetPoint,
      homeCoolSetPoint,
      awayHeatSetPoint,
      awayCoolSetPoint,
      sleepHeatSetPoint,
      sleepCoolSetPoint,
      daytimeStartTime,
      nighttimeStartTime,
      usesHistoricalHourly,
      usesSinusoidalApprox,
    };
  }, [mode, locationData, historicalHourly, primarySystem, userSettings?.winterThermostatDay, userSettings?.winterThermostatNight, userSettings?.summerThermostat, userSettings?.summerThermostatNight]);

  // Update annual cost data state from ref (prevents infinite loop)
  // Use requestAnimationFrame to defer state update until after render
  useEffect(() => {
    if (mode === "annual" && locationData) {
      const updateState = () => {
        if (annualCostDataRef.current) {
          setAnnualCostData(annualCostDataRef.current);
        }
      };
      // Defer to next frame to avoid setting state during render
      requestAnimationFrame(updateState);
    }
  }, [mode, locationData, userSettings?.winterThermostatDay, userSettings?.winterThermostatNight, userSettings?.summerThermostat, userSettings?.summerThermostatNight, userSettings?.daytimeStart, userSettings?.nighttimeStart]);

  // Calculate city comparison savings for top card
  const cityComparisonSavings = useMemo(() => {
    if (mode !== "comparison" || !locationData || !locationDataB) return null;
    
    const annualHDDA = getAnnualHDD(locationData.city, locationData.state);
    const annualHDDB = getAnnualHDD(locationDataB.city, locationDataB.state);
    const annualCDDA = getAnnualCDD(locationData.city, locationData.state);
    const annualCDDB = getAnnualCDD(locationDataB.city, locationDataB.state);
    
    const monthlyHDDDist = [1200, 1000, 600, 200, 50, 10, 0, 0, 20, 200, 500, 1100];
    const monthlyCDDDist = [0, 0, 10, 60, 150, 300, 400, 350, 200, 80, 10, 0];
    const totalTypicalHDD = monthlyHDDDist.reduce((a, b) => a + b, 0);
    const totalTypicalCDD = monthlyCDDDist.reduce((a, b) => a + b, 0);
    
    let totalCostA = 0;
    let totalCostB = 0;
    
    for (let month = 0; month < 12; month++) {
      const monthHDDA = totalTypicalHDD > 0 ? (monthlyHDDDist[month] / totalTypicalHDD) * annualHDDA : 0;
      const monthHDDB = totalTypicalHDD > 0 ? (monthlyHDDDist[month] / totalTypicalHDD) * annualHDDB : 0;
      const monthCDDA = totalTypicalCDD > 0 ? (monthlyCDDDist[month] / totalTypicalCDD) * annualCDDA : 0;
      const monthCDDB = totalTypicalCDD > 0 ? (monthlyCDDDist[month] / totalTypicalCDD) * annualCDDB : 0;
      
      if (monthHDDA > 0) {
        const est = estimateMonthlyHeatingCostFromHDD({ hdd: monthHDDA, squareFeet, insulationLevel, homeShape, ceilingHeight, hspf: hspf2 || efficiency, electricityRate: utilityCost });
        totalCostA += est?.cost || 0;
      }
      if (monthHDDB > 0) {
        const est = estimateMonthlyHeatingCostFromHDD({ hdd: monthHDDB, squareFeet, insulationLevel, homeShape, ceilingHeight, hspf: hspf2 || efficiency, electricityRate: utilityCost });
        totalCostB += est?.cost || 0;
      }
      if (monthCDDA > 0) {
        const est = estimateMonthlyCoolingCostFromCDD({ cdd: monthCDDA, squareFeet, insulationLevel, homeShape, ceilingHeight, capacity: coolingCapacity || capacity, seer2: efficiency, electricityRate: utilityCost, solarExposure });
        totalCostA += est?.cost || 0;
      }
      if (monthCDDB > 0) {
        const est = estimateMonthlyCoolingCostFromCDD({ cdd: monthCDDB, squareFeet, insulationLevel, homeShape, ceilingHeight, capacity: coolingCapacity || capacity, seer2: efficiency, electricityRate: utilityCost, solarExposure });
        totalCostB += est?.cost || 0;
      }
    }
    
    const savings = totalCostB - totalCostA;
    const _isWarmer = totalCostA < totalCostB;
    
    // Show card if there's a meaningful difference (either direction)
    if (Math.abs(savings) < 10) return null;
    
    // Calculate December costs for both locations
    const decemberIndex = 11; // December is month 11 (0-indexed)
    const monthHDDADec = totalTypicalHDD > 0 ? (monthlyHDDDist[decemberIndex] / totalTypicalHDD) * annualHDDA : 0;
    const monthHDDBDec = totalTypicalHDD > 0 ? (monthlyHDDDist[decemberIndex] / totalTypicalHDD) * annualHDDB : 0;
    const monthCDDADec = totalTypicalCDD > 0 ? (monthlyCDDDist[decemberIndex] / totalTypicalCDD) * annualCDDA : 0;
    const monthCDDBDec = totalTypicalCDD > 0 ? (monthlyCDDDist[decemberIndex] / totalTypicalCDD) * annualCDDB : 0;
    
    let decemberCostA = 0;
    let decemberCostB = 0;
    
    if (monthHDDADec > 0) {
      const est = estimateMonthlyHeatingCostFromHDD({ hdd: monthHDDADec, squareFeet, insulationLevel, homeShape, ceilingHeight, hspf: hspf2 || efficiency, electricityRate: utilityCost });
      decemberCostA += est?.cost || 0;
    }
    if (monthHDDBDec > 0) {
      const est = estimateMonthlyHeatingCostFromHDD({ hdd: monthHDDBDec, squareFeet, insulationLevel, homeShape, ceilingHeight, hspf: hspf2 || efficiency, electricityRate: utilityCost });
      decemberCostB += est?.cost || 0;
    }
    if (monthCDDADec > 0) {
      const est = estimateMonthlyCoolingCostFromCDD({ cdd: monthCDDADec, squareFeet, insulationLevel, homeShape, ceilingHeight, capacity: coolingCapacity || capacity, seer2: efficiency, electricityRate: utilityCost, solarExposure });
      decemberCostA += est?.cost || 0;
    }
    if (monthCDDBDec > 0) {
      const est = estimateMonthlyCoolingCostFromCDD({ cdd: monthCDDBDec, squareFeet, insulationLevel, homeShape, ceilingHeight, capacity: coolingCapacity || capacity, seer2: efficiency, electricityRate: utilityCost, solarExposure });
      decemberCostB += est?.cost || 0;
    }
    
    const decemberDifference = decemberCostB - decemberCostA;
    
    return {
      savings: savings, // Keep original sign: positive = Location B costs more, negative = Location A costs more
      savingsAbs: Math.abs(savings),
      annualHDDA,
      annualHDDB,
      heatLoadRatio: annualHDDA > 0 ? (annualHDDB / annualHDDA).toFixed(1) : 'N/A',
      decemberDifference: decemberDifference, // Keep original sign
      decemberDifferenceAbs: Math.abs(decemberDifference),
      locationBCity: locationDataB.city,
    };
  }, [mode, locationData, locationDataB, squareFeet, insulationLevel, homeShape, ceilingHeight, wallHeight, hasLoft, hspf2, efficiency, utilityCost, coolingCapacity, capacity, solarExposure]);

  // Calculate comprehensive annual costs for both cities using auto-mode logic with sinusoidal patterns
  const annualComparisonCosts = useMemo(() => {
    if (mode !== "comparison" || !locationData || !locationDataB) return null;
    
    try {
      // Priority: 1) userSettings.winterThermostatDay/Night, 2) thermostatSettings comfortSettings, 3) defaults
      // Load thermostat settings as fallback
      const thermostatSettings = loadThermostatSettings();
      const comfortSettings = thermostatSettings?.comfortSettings || {};
      const _schedule = thermostatSettings?.schedule;
      
      // Get setpoints for all modes - prioritize userSettings
      // Priority: 1) userSettings, 2) thermostatSettings comfortSettings, 3) defaults
      // IMPORTANT: Read directly from userSettings to ensure reactivity
      let homeHeatSetPoint = userSettings?.winterThermostatDay ?? userSettings?.winterThermostat;
      let sleepHeatSetPoint = userSettings?.winterThermostatNight;
      let homeCoolSetPoint = userSettings?.summerThermostat;
      let sleepCoolSetPoint = userSettings?.summerThermostatNight;
      
      // Fallback to thermostat settings if userSettings not available
      if (homeHeatSetPoint === undefined || homeHeatSetPoint === null) {
        homeHeatSetPoint = comfortSettings?.home?.heatSetPoint ?? 70;
      }
      if (sleepHeatSetPoint === undefined || sleepHeatSetPoint === null) {
        sleepHeatSetPoint = comfortSettings?.sleep?.heatSetPoint ?? 66;
      }
      if (homeCoolSetPoint === undefined || homeCoolSetPoint === null) {
        homeCoolSetPoint = comfortSettings?.home?.coolSetPoint ?? 75;
      }
      if (sleepCoolSetPoint === undefined || sleepCoolSetPoint === null) {
        sleepCoolSetPoint = comfortSettings?.sleep?.coolSetPoint ?? 78;
      }
      
      // Ensure setpoints are numbers (use || operator carefully - 0 is valid)
      homeHeatSetPoint = Number.isFinite(homeHeatSetPoint) ? Number(homeHeatSetPoint) : 70;
      sleepHeatSetPoint = Number.isFinite(sleepHeatSetPoint) ? Number(sleepHeatSetPoint) : 66;
      homeCoolSetPoint = Number.isFinite(homeCoolSetPoint) ? Number(homeCoolSetPoint) : 75;
      sleepCoolSetPoint = Number.isFinite(sleepCoolSetPoint) ? Number(sleepCoolSetPoint) : 78;
      
      const awayHeatSetPoint = comfortSettings?.away?.heatSetPoint ?? 62;
      const awayCoolSetPoint = comfortSettings?.away?.coolSetPoint ?? 85;
      const _deadband = 3; // Minimum deadband between heat and cool
      
      // Helper to get comfort mode for hour
      // Uses daytimeTime and nighttimeTime from user settings
      const getComfortModeForHour = (hour, _DAY_OF_WEEK = 0) => {
        // Convert daytimeTime and nighttimeTime to hours (0-23)
        const timeToHours = (timeStr) => {
          const [h] = (timeStr || "06:00").split(":").map(Number);
          return h;
        };
        
        const dayStartHour = timeToHours(daytimeTime);
        const nightStartHour = timeToHours(nighttimeTime);
        
        // Handle schedule logic: if daytime starts before nighttime (e.g., 6am-10pm)
        if (dayStartHour < nightStartHour) {
          // Normal schedule: daytime period, then nighttime period
          return (hour >= dayStartHour && hour < nightStartHour) ? "home" : "sleep";
        } else {
          // Wrapped schedule: nighttime period, then daytime period (e.g., 10pm-6am)
          return (hour >= nightStartHour || hour < dayStartHour) ? "sleep" : "home";
        }
      };
      
      const getSetpointsForMode = (mode) => {
        switch (mode) {
          case "home": return { heat: homeHeatSetPoint, cool: homeCoolSetPoint };
          case "away": return { heat: awayHeatSetPoint, cool: awayCoolSetPoint };
          case "sleep": return { heat: sleepHeatSetPoint, cool: sleepCoolSetPoint };
          default: return { heat: homeHeatSetPoint, cool: homeCoolSetPoint };
        }
      };
      
      // Generate hourly temps using sinusoidal pattern
      const generateHourlyTemps = (dailyLow, dailyHigh, daysInMonth, monthIndex) => {
        const hours = [];
        const tempRange = dailyHigh - dailyLow;
        const avgTemp = (dailyHigh + dailyLow) / 2;
        for (let day = 0; day < daysInMonth; day++) {
          for (let hour = 0; hour < 24; hour++) {
            const phase = ((hour - 6) / 12) * Math.PI;
            const tempOffset = Math.cos(phase - Math.PI) * (tempRange / 2);
            const hourlyTemp = avgTemp + tempOffset;
            hours.push({
              temp: hourlyTemp,
              humidity: 50,
              time: new Date(2025, monthIndex, day + 1, hour),
            });
          }
        }
        return hours;
      };
      
      // Calculate annual costs for a location
      const calculateAnnualCosts = (locData, electricityRate) => {
        const annualHDD = getAnnualHDD(locData.city, locData.state);
        const annualCDD = getAnnualCDD(locData.city, locData.state);
        const monthlyHDDDist = [1200, 1000, 600, 200, 50, 10, 0, 0, 20, 200, 500, 1100];
        const monthlyCDDDist = [0, 0, 10, 60, 150, 300, 400, 350, 200, 80, 10, 0];
        const totalTypicalHDD = monthlyHDDDist.reduce((a, b) => a + b, 0);
        const totalTypicalCDD = monthlyCDDDist.reduce((a, b) => a + b, 0);
        
        let totalHeatingCost = 0;
        let totalCoolingCost = 0;
        let totalFixedCost = 0;
        const monthlyCosts = [];
        
        const estimatedDesignHeatLoss = heatUtils.calculateHeatLoss({
          squareFeet,
          insulationLevel,
          homeShape,
          ceilingHeight,
          wallHeight,
          hasLoft,
        });
        const btuLossPerDegF = estimatedDesignHeatLoss / 70;
        const tonsMap = { 18: 1.5, 24: 2.0, 30: 2.5, 36: 3.0, 42: 3.5, 48: 4.0, 60: 5.0 };
        const tons = tonsMap[capacity] || 3.0;
        // Balance point: temperature where heat pump capacity equals building heat loss
        // Simplified: balancePoint = indoorTemp - (ratedCapacity / btuLossPerDegF)
        // Using 70°F as typical indoor temp for calculation
        const ratedCapacityBtu = tons * 12000; // BTU/hr at 47°F (rated capacity)
        const balancePoint = primarySystem === "heatPump" && btuLossPerDegF > 0 
          ? (70 - (ratedCapacityBtu / btuLossPerDegF)) 
          : null;
        
        for (let month = 0; month < 12; month++) {
          const monthHDD = totalTypicalHDD > 0 ? (monthlyHDDDist[month] / totalTypicalHDD) * annualHDD : 0;
          const monthCDD = totalTypicalCDD > 0 ? (monthlyCDDDist[month] / totalTypicalCDD) * annualCDD : 0;
          
          const daysInMonth = new Date(2025, month + 1, 0).getDate();
          const baseTemp = 50;
          const tempRange = 20;
          const dailyLow = monthHDD > 0 ? baseTemp - (monthHDD / 30) : (monthCDD > 0 ? baseTemp + (monthCDD / 20) - tempRange : baseTemp - 5);
          const dailyHigh = dailyLow + tempRange;
          
          const monthHours = generateHourlyTemps(dailyLow, dailyHigh, daysInMonth, month);
          
          let monthHeatingKwh = 0;
          let monthCoolingKwh = 0;
          
          monthHours.forEach(hour => {
            const hourDate = new Date(hour.time);
            const dayOfWeek = hourDate.getDay();
            const hourOfDay = hourDate.getHours();
            const activeMode = getComfortModeForHour(hourOfDay, dayOfWeek);
            const setpoints = getSetpointsForMode(activeMode);
            
            const needsHeating = hour.temp < setpoints.heat;
            const needsCooling = hour.temp > setpoints.cool;
            
            if (needsHeating) {
              // Use the same setpoint that was used to determine needsHeating
              const indoorTempForMode = setpoints.heat;
              
              if (primarySystem === "heatPump" && balancePoint !== null) {
                const perf = heatUtils.computeHourlyPerformance(
                  { tons, indoorTemp: indoorTempForMode, designHeatLossBtuHrAt70F: estimatedDesignHeatLoss, compressorPower: null },
                  hour.temp,
                  hour.humidity ?? 50,
                  1.0
                );
                if (perf.hpKwh !== undefined) {
                  monthHeatingKwh += perf.hpKwh;
                }
                // Only include aux when the toggle is on; rely on performance model to flag aux hours
                if (useElectricAuxHeat && perf.auxKwh !== undefined && perf.auxKwh > 0) {
                  monthHeatingKwh += perf.auxKwh;
                }
              } else if (isGasHeat) {
                const tempDiff = Math.max(0, indoorTempForMode - hour.temp);
                const buildingHeatLossBtu = btuLossPerDegF * tempDiff;
                const _thermsPerHour = (buildingHeatLossBtu) / (100000 * afue);
                monthHeatingKwh += 0; // Gas, not electric
              } else {
                const tempDiff = Math.max(0, indoorTempForMode - hour.temp);
                const buildingHeatLossBtu = btuLossPerDegF * tempDiff;
                const kwhPerHour = buildingHeatLossBtu / ((hspf2 || efficiency) * 1000);
                monthHeatingKwh += kwhPerHour;
              }
            }
            
            if (needsCooling) {
              // Use the same setpoint that was used to determine needsCooling
              const indoorTempForMode = setpoints.cool;
              
              // Use the proper cooling performance function which handles capacity derate
              // But we need to adjust SEER2 for temperature-dependent efficiency
              const seer2Rating = efficiency; // Base SEER2 rating
              const ratingTemp = 95; // SEER2 rating temperature (95°F outdoor, 80°F indoor)
              const outdoorTemp = hour.temp;
              
              // Calculate temperature-dependent cooling efficiency (SEER/EER)
              // Cooling units are more efficient when it's cooler outside
              // Efficiency increases as outdoor temp decreases, decreases as it increases
              // At 95°F: multiplier = 1.0 (rated efficiency)
              // At 85°F: multiplier ≈ 1.15 (15% more efficient) 
              // At 105°F: multiplier ≈ 0.85 (15% less efficient)
              // Linear interpolation: ~1.5% change per 1°F difference from rating temp
              const tempDiffFromRating = outdoorTemp - ratingTemp;
              const efficiencyMultiplier = 1.0 - (tempDiffFromRating * 0.015); // 1.5% per degree
              const adjustedSeer2 = Math.max(seer2Rating * 0.5, Math.min(seer2Rating * 1.5, seer2Rating * efficiencyMultiplier)); // Clamp between 50% and 150% of rated
              
              // Calculate heat gain using standard approach (matches budgetUtils.js)
              // Design heat gain at 20°F ΔT: squareFeet * 28.0 BTU/(hr·ft²) * factors
              const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
              const designHeatGain = squareFeet * 28.0 * insulationLevel * homeShape * ceilingMultiplier * solarExposure; // BTU/hr at 20°F ΔT
              const btuGainPerDegF = designHeatGain / 20.0; // BTU/hr per °F temp difference
              
              const tempDiff = Math.max(0, hour.temp - indoorTempForMode);
              let buildingHeatGainBtuPerHour = btuGainPerDegF * tempDiff; // Hourly heat gain in BTU/hr
              
              // Add latent load adjustment for humidity (simple add-on, up to +5%)
              const latentFactor = 1 + ((hour.humidity ?? 50) / 100) * 0.05;
              buildingHeatGainBtuPerHour *= latentFactor;
              
              // Calculate hourly energy using temperature-adjusted SEER2
              // SEER2 is BTU/Wh, so kWh = BTU / (SEER2 * 1000)
              const _hourlyKWh = buildingHeatGainBtuPerHour / (adjustedSeer2 * 1000);
              
              // Check system capacity limit (system can only remove so much heat per hour)
              const coolingCapacityKbtu = primarySystem === "heatPump" ? capacity : coolingCapacity;
              const tonsCooling = tonsMap[coolingCapacityKbtu] || tons;
              const systemHourlyCapacityBtu = tonsCooling * 12000; // BTU/hr (1 ton = 12,000 BTU/hr)
              
              // Capacity derate above 95°F (system loses capacity when very hot)
              let capacityDerate = 1.0;
              if (outdoorTemp > 95) {
                capacityDerate = Math.max(0.75, 1 - (outdoorTemp - 95) * 0.01); // -1% per °F over 95°F
              }
              const availableCapacityBtu = systemHourlyCapacityBtu * capacityDerate;
              
              // If heat gain exceeds capacity, system runs at max capacity
              const actualHeatRemovedBtu = Math.min(buildingHeatGainBtuPerHour, availableCapacityBtu);
              const actualHourlyKwh = actualHeatRemovedBtu / (adjustedSeer2 * 1000);
              
              monthCoolingKwh += actualHourlyKwh;
            }
          });
          
          const monthHeatingCost = monthHeatingKwh * electricityRate;
          const monthCoolingCost = monthCoolingKwh * electricityRate;
          
          // Add fixed costs (prorated monthly)
          const monthlyFixed = (isGasHeat && monthHDD > 0) ? fixedGasCost : fixedElectricCost;
          const monthTotal = monthHeatingCost + monthCoolingCost + monthlyFixed;
          
          totalHeatingCost += monthHeatingCost;
          totalCoolingCost += monthCoolingCost;
          totalFixedCost += monthlyFixed;
          monthlyCosts.push({
            month,
            heating: monthHeatingCost,
            cooling: monthCoolingCost,
            fixed: monthlyFixed,
            total: monthTotal,
          });
        }
        
        return {
          totalAnnual: totalHeatingCost + totalCoolingCost + totalFixedCost,
          totalHeating: totalHeatingCost,
          totalCooling: totalCoolingCost,
          totalFixed: totalFixedCost,
          monthlyCosts,
        };
      };
      
      // Get electricity rates for both locations (use fetched rates if available)
      const rateA = monthlyEstimate?.electricityRate ?? electricityRateA ?? utilityCost;
      const rateB = monthlyEstimateB?.electricityRate ?? electricityRateB ?? utilityCost;
      
      const costsA = calculateAnnualCosts(locationData, rateA);
      const costsB = calculateAnnualCosts(locationDataB, rateB);
      
      return {
        locationA: costsA,
        locationB: costsB,
        savings: costsB.totalAnnual - costsA.totalAnnual,
      };
    } catch (error) {
      console.warn("Error calculating annual comparison costs:", error);
      return null;
    }
  }, [
    mode, locationData, locationDataB, squareFeet, insulationLevel, homeShape, ceilingHeight, wallHeight, hasLoft,
    capacity, efficiency, hspf2, coolingCapacity, primarySystem, afue, useElectricAuxHeat,
    utilityCost, fixedElectricCost, fixedGasCost, solarExposure, monthlyEstimate, monthlyEstimateB,
    userSettings?.winterThermostatDay, userSettings?.winterThermostatNight,
    userSettings?.summerThermostat, userSettings?.summerThermostatNight,
    daytimeTime, nighttimeTime // Include schedule times so changes trigger recalculation
  ]);

  return (
    <div className="min-h-screen bg-[#0C0F14]">
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      {/* Bill Import & Analysis — First thing for budget mode (angry users want to blow off steam) */}
      {mode === "budget" && (
        <div id="bill-analysis" className="mb-8 scroll-mt-4">
          {/* Prominent extracting banner — user needs to see the app is working, not crashed */}
          {billParsing && (
            <div className="mb-4 flex items-center justify-center gap-4 py-5 px-6 rounded-xl bg-amber-500/20 border-2 border-amber-500/50 animate-pulse">
              <Loader className="w-10 h-10 animate-spin text-amber-500 shrink-0" />
              <div>
                <p className="font-bold text-amber-200 text-lg">Extracting your bill data…</p>
                <p className="text-amber-300/90 text-sm mt-0.5">Joule is reading your bill and pulling out daily kWh. This usually takes 10–30 seconds.</p>
              </div>
            </div>
          )}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-700 dark:to-indigo-700 rounded-xl p-5 shadow-lg border border-purple-500/30">
            <div className="flex items-start justify-between mb-3">
              <div>
                {Object.values(actualKwhEntries).filter(v => typeof v === 'number').length === 0 && !billPasteText.trim() && (
                  <>
                    <h3 className="font-bold text-white drop-shadow-sm flex items-center gap-2" style={{ fontSize: '18pt' }}>
                      💡 Got Your Bill? Let's Compare.
                    </h3>
                    <p className="text-white/95 mt-1" style={{ fontSize: '14pt' }}>
                      Paste your utility bill and Joule will tell you exactly why it's different from the forecast — down to the dollar.
                    </p>
                    <p className="text-white/90 mt-1" style={{ fontSize: '14pt' }}>
                      For general questions about efficiency, settings, or savings, use {onOpenAskJoule ? (
                        <button type="button" onClick={onOpenAskJoule} className="font-bold text-white underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-white/50 rounded">
                          Ask Joule
                        </button>
                      ) : (
                        <strong className="text-white">Ask Joule</strong>
                      )}.
                    </p>
                  </>
                )}
              </div>
              {Object.values(actualKwhEntries).filter(v => typeof v === 'number').length > 0 && (
                <button
                  onClick={() => {
                    if (confirm('Clear all entered bill data for this month?')) {
                      setActualKwhEntries({});
                      localStorage.removeItem(actualKwhStorageKey);
                      localStorage.removeItem(billChatStorageKey);
                      setBillAnalysis(null);
                      setBillConversationHistory([]);
                      setBillDateRange(null);
                      setBillFollowUpStreamingText('');
                    }
                  }}
                  className="text-white/85 hover:text-white transition-colors flex items-center gap-1 shrink-0"
                  style={{ fontSize: '13pt' }}
                  title="Clear all bill entries"
                >
                  ✕ Clear Data
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              {Object.values(actualKwhEntries).filter(v => typeof v === 'number').length > 0 && !billAnalysis && (
                <>
                  <button
                    onClick={() => analyzeBillDiscrepancy(dailyMetricsRef.current)}
                    disabled={billAnalysisLoading}
                    className="flex items-center gap-2 px-6 py-4 text-xl font-bold rounded-lg bg-red-600 text-white hover:bg-red-500 shadow-md transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {billAnalysisLoading ? (
                      <><Loader className="w-5 h-5 animate-spin" /> Analyzing...</>
                    ) : (
                      <>🔍 Why is my bill so high?</>
                    )}
                  </button>
                  {runAutoAnalyzeAfterExtract && !billAnalysisLoading && (
                    <span className="text-white/90 text-sm">Waiting for forecast… click the button if analysis doesn&apos;t start.</span>
                  )}
                </>
              )}
            </div>
            {(() => {
              // Primary: one number. Secondary: supporting detail when partial bill entered.
              const withUsage = Object.entries(actualKwhEntries).filter(([, v]) => typeof v === 'number' && v > 0);
              const billDays = withUsage.length;
              const totalActualKwh = withUsage.reduce((s, [, v]) => s + v, 0);
              const actualEnergyCost = totalActualKwh * utilityCost;
              const variablePart = totalForecastCostRef.current ?? (monthlyEstimate?.cost != null ? monthlyEstimate.cost - (monthlyEstimate.fixedCost || 0) : null);
              const fixedPart = monthlyEstimate?.fixedCost ?? fixedElectricCost ?? 0;
              const fullMonthForecastCost = variablePart != null ? variablePart + fixedPart : null;
              const expectedTotal = fullMonthForecastCost != null ? Math.round(fullMonthForecastCost * 100) / 100 : null;
              const hasBillData = billDays > 0;
              return (
              <div className="mt-4 space-y-2">
                {/* Primary: Expected bill this month */}
                {expectedTotal != null && (
                  <div>
                    <p className="text-3xl font-bold text-white drop-shadow-sm" style={{ fontSize: '28pt' }}>
                      Expected bill this month: ${Math.round(expectedTotal)}
                    </p>
                    <p className="text-white/95 mt-0.5" style={{ fontSize: '13pt' }}>
                      Based on your home, thermostat, and weather
                    </p>
                  </div>
                )}
                {/* Secondary: when partial bill entered */}
                {hasBillData && (
                  <div className="pt-2 border-t border-white/20 space-y-0.5">
                    <p className="text-white/95 font-medium" style={{ fontSize: '14pt' }}>
                      So far: ${actualEnergyCost.toFixed(2)} for {billDays} days
                    </p>
                    {expectedTotal != null && (
                      <p className="text-white/90" style={{ fontSize: '13pt' }}>
                        On track for: ${expectedTotal.toFixed(2)} total
                      </p>
                    )}
                    {billDateRange && (
                      <p className="text-white/85 text-sm mt-1">
                        Your bill covers {billDateRange}
                      </p>
                    )}
                    <p className="text-white/80 text-sm">
                      Comparing to weather during that period.
                    </p>
                  </div>
                )}
              </div>
            );})()}
          </div>
          <div className="space-y-3 mt-3">
            {billAnalysis && (
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 animate-fade-in" data-bill-analysis-card>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-purple-900 dark:text-purple-100 flex items-center gap-2 flex-wrap" style={{ fontSize: '16pt' }}>
                      Here's what I'm seeing
                      <label className="flex items-center gap-1.5 cursor-pointer text-sm font-normal">
                        <input
                          type="checkbox"
                          checked={billAnalysisSpeechEnabled}
                          onChange={(e) => setBillAnalysisSpeechEnabled(e.target.checked)}
                          className="rounded border-purple-400"
                        />
                        <span className="text-purple-700 dark:text-purple-300">Auto-read</span>
                      </label>
                      {billSpeak && (() => {
                        const fullText = billAnalysis?.text || '';
                        const summaryMatch = fullText.match(/\n\s*(?:Here'?s? a )?[Ss]hareable summary\s*:\s*\n?(.*)/is);
                        const mainText = summaryMatch ? fullText.slice(0, fullText.indexOf(summaryMatch[0])).trim() : fullText;
                        const digDeeperPhrase = mainText.includes('Want to take a closer look together?') ? 'Want to take a closer look together?' : 'Want to dig deeper?';
                        const digDeeperIdx = mainText.indexOf(digDeeperPhrase);
                        const textToSpeak = digDeeperIdx >= 0 ? mainText.slice(0, digDeeperIdx + digDeeperPhrase.length).trim() : mainText;
                        const lastAi = billConversationHistory.filter(m => m.role === 'assistant').pop()?.content || '';
                        const toSpeak = lastAi || textToSpeak;
                        if (!toSpeak?.trim()) return null;
                        return (
                          <button
                            type="button"
                            onClick={() => billIsSpeaking ? billStopSpeaking() : billSpeak(toSpeak, { force: true })}
                            className={`p-1.5 rounded-lg transition-colors ${billIsSpeaking ? 'bg-purple-600 text-white' : 'text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/40 dark:text-purple-400'}`}
                            title={billIsSpeaking ? 'Stop speaking' : 'Read aloud'}
                            aria-label={billIsSpeaking ? 'Stop speaking' : 'Read aloud'}
                          >
                            {billIsSpeaking ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                          </button>
                        );
                      })()}
                    </h4>
                    {billAnalysis?.daysCompared > 0 && (
                      <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                        Comparing model vs your bill for {billAnalysis.daysCompared} days. Primary number above is full month.
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => { setBillAnalysis(null); setBillConversationHistory([]); setBillFollowUpQuestion(''); setBillFollowUpStreamingText(''); }}
                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    style={{ fontSize: '13pt' }}
                  >
                    ✕ Close
                  </button>
                </div>
                {billAnalysis.error ? (
                  <p className="text-sm text-red-600 dark:text-red-400">❌ {billAnalysis.error}</p>
                ) : (
                  <>
                    {billAnalysisLoading && (!billAnalysis.text || billAnalysis.text.length < 3) ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="flex flex-col items-center gap-3">
                          <Loader className="w-12 h-12 animate-spin text-purple-500" />
                          <span className="text-gray-600 dark:text-gray-400" style={{ fontSize: '14pt' }}>Thinking...</span>
                        </div>
                      </div>
                    ) : (() => {
                      const fullText = billAnalysis.text || '';
                      const summaryMatch = fullText.match(/\n\s*(?:Here'?s? a )?[Ss]hareable summary\s*:\s*\n?(.*)/is);
                      const mainText = summaryMatch ? fullText.slice(0, fullText.indexOf(summaryMatch[0])).trim() : fullText;
                      const digDeeperPhrase = mainText.includes('Want to take a closer look together?') ? 'Want to take a closer look together?' : 'Want to dig deeper?';
                      const digDeeperIdx = mainText.indexOf(digDeeperPhrase);
                      const textToShow = digDeeperIdx >= 0
                        ? mainText.slice(0, digDeeperIdx + digDeeperPhrase.length).trim()
                        : mainText;
                      const showDigDeeperButton = digDeeperIdx >= 0 && billConversationHistory.length === 0;
                      return (
                        <>
                          <div className="text-gray-800 dark:text-gray-200 prose dark:prose-invert max-w-none whitespace-pre-wrap" style={{ fontSize: '14pt', fontFamily: "'Times New Roman', Times, serif" }}>
                            {textToShow}
                          </div>
                          {showDigDeeperButton && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => sendBillFollowUp('Yes, please give the full explanation and a shareable summary I can copy.')}
                                disabled={billFollowUpLoading}
                                className="px-4 py-2.5 text-base font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                Yes, dig deeper
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                    )}
                    <div className="mt-4 pt-3 border-t border-purple-200 dark:border-purple-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">Ask a follow-up question</span>
                        <div className="flex items-center gap-3">
                          {billConversationHistory.length > 0 && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">{billConversationHistory.length} messages</span>
                          )}
                          {billConversationHistory.length > 0 && (
                            <button
                              onClick={() => { setBillConversationHistory([]); setBillFollowUpQuestion(''); setBillFollowUpStreamingText(''); }}
                              className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors flex items-center gap-1"
                              title="Clear conversation history"
                            >
                              <Trash2 className="w-3 h-3" />
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="bg-gray-900 dark:bg-gray-950 rounded-lg overflow-hidden">
                        {(billConversationHistory.length > 0 || billFollowUpStreamingText) && (
                          <div ref={billFollowUpScrollRef} className="max-h-80 overflow-y-auto overflow-x-hidden p-3 space-y-3 scroll-smooth">
                            {billConversationHistory.map((msg, idx) => (
                              <div key={idx} className={msg.role === 'user' ? 'text-blue-400' : 'text-green-400'} style={{ fontSize: '14pt', fontFamily: "'Times New Roman', Times, serif" }}>
                                <div className="font-semibold mb-0.5 flex items-center gap-2" style={{ fontSize: '13pt' }}>
                                  {msg.role === 'user' ? 'You:' : 'AI:'}
                                  {msg.role === 'assistant' && msg.content?.trim() && billSpeak && (
                                    <button
                                      type="button"
                                      onClick={() => billIsSpeaking ? billStopSpeaking() : billSpeak(msg.content, { force: true })}
                                      className={`p-1 rounded transition-colors ${billIsSpeaking ? 'bg-green-600 text-white' : 'text-green-400 hover:bg-green-900/40'}`}
                                      title={billIsSpeaking ? 'Stop' : 'Read aloud'}
                                    >
                                      {billIsSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                    </button>
                                  )}
                                </div>
                                <div className="whitespace-pre-wrap mt-1 opacity-90">{msg.content}</div>
                              </div>
                            ))}
                            {billFollowUpStreamingText && (
                              <div className="text-green-400" style={{ fontSize: '14pt', fontFamily: "'Times New Roman', Times, serif" }}>
                                <div className="font-semibold mb-0.5" style={{ fontSize: '13pt' }}>AI:</div>
                                <div className="whitespace-pre-wrap mt-1 opacity-90">
                                  {billFollowUpStreamingText}
                                  <span className="inline-block w-2 h-4 ml-0.5 bg-green-400 animate-pulse" />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        <div className={`${billConversationHistory.length > 0 ? 'border-t border-gray-700' : ''} p-3`}>
                          {billConversationHistory.length === 0 && !billFollowUpLoading && !billFollowUpStreamingText && (() => {
                              const displayActual = (billAnalysis.totalActual ?? 0) > 0 ? billAnalysis.totalActual : Object.values(actualKwhEntries).filter(v => typeof v === 'number').reduce((s, v) => s + v, 0);
                              const displayEst = (billAnalysis.totalEst ?? 0) > 0 ? billAnalysis.totalEst : (totalForecastEnergyRef.current || monthlyEstimate?.energy);
                              return (
                            <div className="mb-3 space-y-3">
                              <div>
                                <div className="text-lg text-gray-500 mb-2 uppercase tracking-wide font-semibold">Try asking:</div>
                                <div className="flex flex-wrap gap-2">
                                  {[
                                    'Yes — show me what\'s going on',
                                    (displayActual < (displayEst || 0))
                                      ? `Give me a short summary explaining why my forecast was higher than my actual bill.`
                                      : `Give me a short summary I can share with my spouse or landlord explaining why my bill was high.`,
                                    'Why was this bill higher than normal?',
                                    'Could something besides heating explain the difference?',
                                    'If I lower my thermostat to 66°F, how much would I save?',
                                    'What can I change to lower next month\'s bill?',
                                  ].map((q, i) => (
                                    <button
                                      key={i}
                                      onClick={() => { setBillFollowUpQuestion(q); }}
                                      className="text-lg px-4 py-3 rounded-xl bg-purple-800/60 hover:bg-purple-700/80 text-purple-200 hover:text-white border border-purple-700/40 hover:border-purple-500/60 transition-all cursor-pointer text-left leading-snug"
                                    >
                                      {q}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div className="text-base text-gray-500 mb-1.5 uppercase tracking-wide font-medium">More detailed questions</div>
                                <div className="flex flex-wrap gap-2">
                                  {[
                                    'What does this bill say about how fast my house loses heat?',
                                    'When does my system need backup heat?',
                                  ].map((q, i) => (
                                    <button
                                      key={i}
                                      onClick={() => { setBillFollowUpQuestion(q); }}
                                      className="text-lg px-4 py-3 rounded-xl bg-gray-700/60 hover:bg-gray-600/80 text-gray-300 hover:text-white border border-gray-600/40 hover:border-gray-500/60 transition-all cursor-pointer text-left leading-snug"
                                    >
                                      {q}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );})()}
                          {billConversationHistory.length > 0 && !billFollowUpLoading && !billFollowUpStreamingText && (() => {
                            const pool = [
                              `What would my bill be if the model were calibrated correctly?`,
                              `Should I adjust my ceiling multiplier or insulation multiplier?`,
                              `How many kWh per day is just my baseload (fridge, lights, etc)?`,
                              `What variable has biggest impact on monthly bill?`,
                              `At what outdoor temp does aux heat activate based on morning spikes?`,
                              `What night setback minimizes cost without triggering strip heat?`,
                              `Could my water heater explain the gap?`,
                              `What insulation multiplier would make the model match my actual bill?`,
                              `Based on my actual usage, what should my Heat Loss Factor be?`,
                              `If I lower my thermostat to 66°F, how much would I save per month?`,
                              `How did you extrapolate to a full month estimate?`,
                              `What if I enter more days of bill data?`,
                            ];
                            const lastAi = billConversationHistory.filter(m => m.role === 'assistant').pop()?.content || '';
                            const lastUser = billConversationHistory.filter(m => m.role === 'user').pop()?.content || '';
                            const asked = new Set(billConversationHistory.filter(m => m.role === 'user').map(m => (m.content || '').trim().toLowerCase()));
                            const text = `${lastAi} ${lastUser}`.toLowerCase();
                            const words = text.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
                            const scored = pool
                              .filter(q => !asked.has(q.trim().toLowerCase()))
                              .map(q => {
                                const qWords = q.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
                                const overlap = qWords.filter(w => w.length > 2 && words.includes(w)).length;
                                const phraseMatch = qWords.length >= 3 && qWords.some(w => text.includes(w)) ? 1 : 0;
                                return { q, score: overlap + phraseMatch };
                              })
                              .sort((a, b) => (b.score - a.score) || Math.random() - 0.5)
                              .slice(0, 3)
                              .map(({ q }) => q);
                            const toShow = scored.length >= 3 ? scored : [...scored, ...pool.filter(q => !scored.includes(q))].slice(0, 3);
                            return (
                              <div className="mb-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {toShow.map((q, i) => (
                                    <button
                                      key={i}
                                      onClick={() => { setBillFollowUpQuestion(q); }}
                                      className="text-lg px-4 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-600 transition-all cursor-pointer text-left leading-snug"
                                    >
                                      {q}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={billFollowUpQuestion}
                              onChange={(e) => setBillFollowUpQuestion(e.target.value)}
                              placeholder="e.g. Could something besides heating explain the difference?"
                              className="flex-1 px-4 py-3 rounded-lg text-base bg-gray-800 text-gray-100 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && billFollowUpQuestion.trim() && !billFollowUpLoading) {
                                  sendBillFollowUp();
                                }
                              }}
                              disabled={billFollowUpLoading}
                            />
                            {billRecSupported && (
                              <button
                                type="button"
                                onClick={() => billIsListening ? billStopListening() : billStartListening()}
                                className={`px-4 py-3 rounded-lg font-semibold text-base transition-colors flex items-center gap-2 ${
                                  billIsListening ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                                }`}
                                title={billIsListening ? 'Stop listening' : 'Speak your question'}
                                aria-label={billIsListening ? 'Stop listening' : 'Speak your question'}
                              >
                                {billIsListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                              </button>
                            )}
                            <button
                              onClick={() => sendBillFollowUp()}
                              disabled={!billFollowUpQuestion.trim() || billFollowUpLoading}
                              className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-base transition-colors flex items-center gap-2"
                            >
                              {billFollowUpLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowBillPaste(!showBillPaste)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-blue-100/50 dark:hover:bg-blue-800/30 transition-colors"
              >
                <span className="font-medium text-gray-800 dark:text-gray-200" style={{ fontSize: '14pt' }}>
                  📋 Upload a PDF or paste your utility bill or daily usage data
                </span>
                {showBillPaste ? (
                  <ChevronUp className="w-5 h-5 text-gray-500 shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500 shrink-0" />
                )}
              </button>
              {showBillPaste && (
              <div className="px-4 pb-4 pt-0 border-t border-blue-200/50 dark:border-blue-800/50">
                <p className="text-gray-600 dark:text-gray-400 mb-3 mt-3" style={{ fontSize: '14pt' }}>
                  Joule uses AI to extract daily kWh from your bill. Upload a PDF or paste raw text, a CSV table, or a summary — the AI will figure out the format.
                  {!isAIAvailable() && (
                    <span className="text-amber-600 dark:text-amber-400 font-medium"> ⚠️ Requires Groq API key or Local AI (Ollama) — set in Settings → Bridge & AI.</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <input
                    ref={billFileInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) extractBillPdf(f);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => billFileInputRef.current?.click()}
                    disabled={billPdfExtracting}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    {billPdfExtracting ? (
                      <><Loader size={16} className="animate-spin" /> Extracting...</>
                    ) : (
                      <><Upload size={16} /> Upload PDF</>
                    )}
                  </button>
                  <span className="text-xs text-gray-500 dark:text-gray-400 self-center">or paste below</span>
                </div>
                <textarea
                  value={billPasteText}
                  onChange={(e) => { setBillPasteText(e.target.value); setBillPdfError(''); }}
                  placeholder={`Paste your bill data here...\n\nExamples:\n- "Feb 1: 45.2 kWh, Feb 2: 38.1 kWh..."\n- CSV with date and kWh columns\n- "Total: 651 kWh for 28 days"\n- Screenshot text from your utility portal`}
                  className="w-full h-32 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono"
                />
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={parseBillWithGroq}
                    disabled={billParsing || !billPasteText.trim()}
                    className="px-10 py-5 text-xl font-bold bg-amber-500 hover:bg-amber-600 text-gray-900 rounded-xl disabled:opacity-70 disabled:cursor-not-allowed transition-all flex items-center gap-3 shadow-lg hover:shadow-xl ring-2 ring-amber-400/50"
                  >
                    {billParsing ? (
                      <><Loader className="w-7 h-7 animate-spin shrink-0" /><span>Extracting… Please wait</span></>
                    ) : (
                      <><span className="text-2xl">🤖</span><span>Extract with AI</span></>
                    )}
                  </button>
                  <button
                    onClick={() => { setBillPasteText(''); setBillParseError(null); setBillPdfError(''); }}
                    className="px-6 py-4 text-lg text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Cancel
                  </button>
                </div>
                {(billParseError || billPdfError) && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">❌ {billParseError || billPdfError}</p>
                )}
              </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* City Comparison Savings Card */}
      {mode === "comparison" && cityComparisonSavings && (
        <div className="mb-6">
          <div className={`${cityComparisonSavings.savings > 0 ? 'bg-orange-900/20 border-orange-800' : 'bg-[#0f2b1c] border-[#234435]'} border rounded-lg p-4 mb-4`}>
            <div className={`${cityComparisonSavings.savings > 0 ? 'text-orange-400' : 'text-green-400'} font-bold text-2xl mb-1`}>
              ${cityComparisonSavings.savingsAbs.toFixed(2)} {cityComparisonSavings.savings > 0 ? 'more/year' : 'saved/year'}
            </div>
            {cityComparisonSavings.decemberDifferenceAbs > 0 && (
              <div className={`text-sm ${cityComparisonSavings.savings > 0 ? 'text-orange-400' : 'text-gray-300'} mt-2 font-medium`}>
                💸 Moving to {cityComparisonSavings.locationBCity} would cost ${cityComparisonSavings.decemberDifferenceAbs.toFixed(2)} more for December
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Total Annual HVAC Cost Card - Right after breadcrumbs */}
      {mode === "annual" && annualCostData && (
        <div className="mb-6">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-4 border border-green-200 dark:border-green-800">
            <p className="font-semibold text-green-800 dark:text-green-200 mb-2">
              Total Annual HVAC Cost (energy + fixed)
            </p>
            <p className="text-3xl font-bold text-green-700 dark:text-green-300 mb-3">
              ${annualCostData.totalAnnualCost.toFixed(2)}
            </p>
            <div className="mt-2 space-y-1">
              <p className="text-sm text-green-700 dark:text-green-300">
                = ${annualCostData.annualHeatingCost.toFixed(2)} (heating) + ${annualCostData.annualCoolingCost.toFixed(2)} (cooling) + ${annualCostData.annualFixedOnly.toFixed(2)} (fixed)
              </p>
            </div>
            <p className="text-sm text-green-600 dark:text-green-400 mt-3">
              This works out to about <strong>${(annualCostData.annualHeatingCost / 12).toFixed(2)}/month</strong> in heating and <strong>${(annualCostData.annualCoolingCost / 12).toFixed(2)}/month</strong> in cooling on average.
            </p>
          </div>
        </div>
      )}
      
      {/* Annual Forecast Header */}
      {mode === "annual" && locationData && (
        <div className="mb-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              <Calendar className="w-6 h-6 text-blue-400" />
              <span>Annual Forecast</span>
            </h2>
            <p className="text-sm text-slate-300">
              Your annual heating and cooling cost breakdown by month
            </p>
          </div>
        </div>
      )}

      {/* Thermostat Settings for Annual Forecast */}
      {mode === "annual" && locationData && (
        <div className="mb-6">
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-800/90 via-slate-900/90 to-slate-800/90 border border-slate-700/50 rounded-2xl p-4 shadow-2xl shadow-slate-900/50 backdrop-blur-sm">
            {/* Subtle animated background */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-cyan-500/5 animate-pulse" />
            <div className="relative z-10">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Modeled Schedule (What-If)
                  </h2>
                  <p className="text-xs text-slate-400 flex items-center gap-1 px-1.5 py-0.5 bg-slate-800/50 rounded border border-slate-700/50">
                    <span>🔒</span>
                    <span>Safe to experiment</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-xs text-slate-400 hidden sm:block">
                    <strong className="text-blue-400">Hypothetical</strong> schedule for modeling only
                  </p>
                  <div className="flex-shrink-0">
                    <OneClickOptimizer
                      currentDayTemp={userSettings?.winterThermostatDay ?? 70}
                      currentNightTemp={userSettings?.winterThermostatNight ?? 66}
                      mode="heating"
                      weatherForecast={[]}
                      electricRate={utilityCost}
                      heatLossFactor={getEffectiveHeatLossFactor}
                      hspf2={hspf2 || efficiency}
                      onApplySchedule={(schedule) => {
                        if (setUserSetting) {
                          setUserSetting("winterThermostatDay", schedule.dayTemp);
                          setUserSetting("winterThermostatNight", schedule.nightTemp);
                        }
                      }}
                      compact={true}
                    />
                  </div>
                </div>
              </div>
              
              {/* Temperature and Time Controls - Ecobee Style */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Home Comfort Setting */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                  <div className="relative bg-slate-800/50 backdrop-blur-sm border border-green-500/20 rounded-xl p-3 hover:border-green-500/40 transition-all duration-300">
                    <div className="flex items-center gap-2 mb-3">
                      <Home className="w-4 h-4 text-green-400" />
                      <span className="text-sm font-bold text-white">home</span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-slate-300 mb-1">Heat Set Point (°F)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="60"
                            max="78"
                            value={userSettings?.winterThermostatDay ?? 70}
                            onChange={(e) => {
                              const temp = Number(e.target.value);
                              if (setUserSetting) {
                                setUserSetting("winterThermostatDay", temp);
                              }
                            }}
                            className="flex-1 h-2 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-yellow-500 hover:accent-yellow-400 transition-all"
                            style={{
                              background: `linear-gradient(to right, #fbbf24 0%, #fbbf24 ${((userSettings?.winterThermostatDay ?? 70) - 60) / 18 * 100}%, #374151 ${((userSettings?.winterThermostatDay ?? 70) - 60) / 18 * 100}%, #374151 100%)`
                            }}
                          />
                          <span className="text-sm font-bold text-yellow-400 w-10 text-right">{userSettings?.winterThermostatDay ?? 70}</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-300 mb-1">Cool Set Point (°F)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="68"
                            max="80"
                            value={userSettings?.summerThermostat ?? 74}
                            onChange={(e) => {
                              const temp = Number(e.target.value);
                              if (setUserSetting) {
                                setUserSetting("summerThermostat", temp);
                              }
                            }}
                            className="flex-1 h-2 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 transition-all"
                            style={{
                              background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${((userSettings?.summerThermostat ?? 74) - 68) / 12 * 100}%, #374151 ${((userSettings?.summerThermostat ?? 74) - 68) / 12 * 100}%, #374151 100%)`
                            }}
                          />
                          <span className="text-sm font-bold text-cyan-400 w-10 text-right">{userSettings?.summerThermostat ?? 74}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Schedule Clock */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-yellow-500/10 to-orange-500/10 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                  <div className="relative bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3 hover:border-slate-600/50 transition-all duration-300">
                    <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-200 mb-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span>Schedule Times</span>
                    </label>
                    <ThermostatScheduleClock
                      daytimeStart={daytimeTime || "06:00"}
                      setbackStart={nighttimeTime || "22:00"}
                      onDaytimeStartChange={(time) => {
                        setDaytimeTime(time);
                        if (setUserSetting) {
                          const timeToHours = (timeStr) => {
                            const [hours, minutes] = timeStr.split(":").map(Number);
                            return hours + minutes / 60;
                          };
                          setUserSetting("daytimeStart", timeToHours(time));
                        }
                      }}
                      onSetbackStartChange={(time) => {
                        setNighttimeTime(time);
                        if (setUserSetting) {
                          const timeToHours = (timeStr) => {
                            const [hours, minutes] = timeStr.split(":").map(Number);
                            return hours + minutes / 60;
                          };
                          setUserSetting("nighttimeStart", timeToHours(time));
                        }
                      }}
                      compact={true}
                    />
                  </div>
                </div>

                {/* Sleep Comfort Setting */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                  <div className="relative bg-slate-800/50 backdrop-blur-sm border border-blue-500/20 rounded-xl p-3 hover:border-blue-500/40 transition-all duration-300">
                    <div className="flex items-center gap-2 mb-3">
                      <Moon className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-bold text-white">sleep</span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-slate-300 mb-1">Heat Set Point (°F)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="60"
                            max="78"
                            value={userSettings?.winterThermostatNight ?? 66}
                            onChange={(e) => {
                              const temp = Number(e.target.value);
                              if (setUserSetting) {
                                setUserSetting("winterThermostatNight", temp);
                              }
                            }}
                            className="flex-1 h-2 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
                            style={{
                              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((userSettings?.winterThermostatNight ?? 66) - 60) / 18 * 100}%, #374151 ${((userSettings?.winterThermostatNight ?? 66) - 60) / 18 * 100}%, #374151 100%)`
                            }}
                          />
                          <span className="text-sm font-bold text-blue-400 w-10 text-right">{userSettings?.winterThermostatNight ?? 66}</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-300 mb-1">Cool Set Point (°F)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="68"
                            max="82"
                            value={userSettings?.summerThermostatNight ?? 72}
                            onChange={(e) => {
                              const temp = Number(e.target.value);
                              if (setUserSetting) {
                                setUserSetting("summerThermostatNight", temp);
                              }
                            }}
                            className="flex-1 h-2 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 transition-all"
                            style={{
                              background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${((userSettings?.summerThermostatNight ?? 72) - 68) / 14 * 100}%, #374151 ${((userSettings?.summerThermostatNight ?? 72) - 68) / 14 * 100}%, #374151 100%)`
                            }}
                          />
                          <span className="text-sm font-bold text-cyan-400 w-10 text-right">{userSettings?.summerThermostatNight ?? 72}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Current Schedule Summary */}
              <div className="mt-3 p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-300">
                    <strong className="text-white">Current Modeled Schedule:</strong> {daytimeTime || "06:00"}–{nighttimeTime || "22:00"} at Home ({userSettings?.winterThermostatDay ?? 70}°F heat / {userSettings?.summerThermostat ?? 74}°F cool) • {nighttimeTime || "22:00"}–{daytimeTime || "06:00"} at Sleep ({userSettings?.winterThermostatNight ?? 66}°F heat / {userSettings?.summerThermostatNight ?? 72}°F cool)
                  </p>
                  <button
                    onClick={() => {
                      try {
                        const thermostatSettings = loadThermostatSettings();
                        const comfortSettings = thermostatSettings?.comfortSettings;
                        const schedule = thermostatSettings?.schedule;
                        
                        // Reset to comfort settings defaults (comfort settings are the source of truth)
                        const winterDay = comfortSettings?.home?.heatSetPoint ?? 70;
                        const winterNight = comfortSettings?.sleep?.heatSetPoint ?? 68;
                        const summerDay = comfortSettings?.home?.coolSetPoint ?? 76;
                        const summerNight = comfortSettings?.sleep?.coolSetPoint ?? 78;
                        
                        // Update userSettings (this is the persistent storage)
                        if (setUserSetting) {
                          setUserSetting("winterThermostatDay", winterDay);
                          setUserSetting("winterThermostatNight", winterNight);
                          setUserSetting("summerThermostat", summerDay);
                          setUserSetting("summerThermostatNight", summerNight);
                        }
                        
                        // Also update local state for immediate UI feedback (for monthly forecast mode)
                        setIndoorTemp(winterDay);
                        setNighttimeTemp(winterNight);
                        
                        // Reset schedule times if available
                        if (schedule?.weekly && schedule.weekly[0]) {
                          const daySchedule = schedule.weekly[0];
                          const homeEntry = daySchedule.find(e => e.comfortSetting === "home");
                          const sleepEntry = daySchedule.find(e => e.comfortSetting === "sleep");
                          
                          if (homeEntry?.time) {
                            setDaytimeTime(homeEntry.time);
                            if (setUserSetting) {
                              const timeToHours = (timeStr) => {
                                const [hours, minutes] = timeStr.split(":").map(Number);
                                return hours + minutes / 60;
                              };
                              setUserSetting("daytimeStart", timeToHours(homeEntry.time));
                            }
                          }
                          if (sleepEntry?.time) {
                            setNighttimeTime(sleepEntry.time);
                            if (setUserSetting) {
                              const timeToHours = (timeStr) => {
                                const [hours, minutes] = timeStr.split(":").map(Number);
                                return hours + minutes / 60;
                              };
                              setUserSetting("nighttimeStart", timeToHours(sleepEntry.time));
                            }
                          }
                        } else {
                          // Default schedule times (ASHRAE defaults)
                          setDaytimeTime("06:00");
                          setNighttimeTime("22:00");
                          if (setUserSetting) {
                            setUserSetting("daytimeStart", 6);
                            setUserSetting("nighttimeStart", 22);
                          }
                        }
                      } catch (error) {
                        console.error("Failed to reset to comfort settings:", error);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/50 rounded-lg text-xs font-medium text-slate-200 hover:text-white transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Return to Default</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Details dropdown - Quick Answer, schedule, table, settings, show me the math */}
      {mode === "budget" && (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-slate-600/50 bg-slate-800/50 hover:bg-slate-700/50 transition-colors text-left"
          >
            <span className="text-2xl font-semibold text-white">Details</span>
            {showDetails ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>
        </div>
      )}

      {/* Quick Answer - Full month forecast (same as daily table total) */}
      {mode === "budget" && showDetails && (
        <div className="mb-2">
          <AnswerCard
            loading={!monthlyEstimate || loading}
            location={locationData ? `${locationData.city}, ${locationData.state}` : null}
            temp={Math.round(effectiveIndoorTemp)}
            weeklyCost={(() => {
              const fixed = monthlyEstimate?.fixedCost || 0;
              const variableCost = totalForecastCostRef.current;
              if (variableCost != null && variableCost >= 0) return variableCost + fixed;
              return monthlyEstimate?.cost ?? 0;
            })()}
            energyMode={energyMode}
            primarySystem={primarySystem}
            timePeriod="month"
            compact={false}
            contextSubtitle="Total bill (energy + fixed fees) • Based on NWS forecast for the full month"
          />
        </div>
      )}


      {/* Modeled Schedule Section - Match Weekly Forecast Layout */}
      {mode === "budget" && showDetails && (
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-800/90 via-slate-900/90 to-slate-800/90 border border-slate-700/50 rounded-xl p-4 mb-2 shadow-2xl shadow-slate-900/50 backdrop-blur-sm">
          {/* Subtle animated background */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-cyan-500/5 animate-pulse" />
          <div className="relative z-10">
            {/* Header */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Modeled Schedule (What-If)
                </h2>
                <p className="text-base text-slate-400 flex items-center gap-1 px-2 py-1 bg-slate-800/50 rounded border border-slate-700/50">
                  <span>🔒</span>
                  <span>Safe to experiment</span>
                </p>
              </div>
              {(energyMode === "heating" || energyMode === "cooling") && (
                <div className="flex-shrink-0">
                  <OneClickOptimizer
                    currentDayTemp={energyMode === "heating" ? (userSettings?.winterThermostatDay ?? 70) : (userSettings?.summerThermostat ?? 76)}
                    currentNightTemp={energyMode === "heating" ? (userSettings?.winterThermostatNight ?? 68) : (userSettings?.summerThermostatNight ?? 78)}
                    mode={energyMode}
                    weatherForecast={adjustedForecast?.slice(0, 7) || []}
                    electricRate={utilityCost}
                    heatLossFactor={energyMode === "heating" ? getEffectiveHeatLossFactor : heatGainFactor}
                    hspf2={energyMode === "heating" ? (hspf2 || efficiency) : efficiency}
                    onApplySchedule={(schedule) => {
                      if (setUserSetting) {
                        if (energyMode === "heating") {
                          setUserSetting("winterThermostatDay", schedule.dayTemp);
                          setUserSetting("winterThermostatNight", schedule.nightTemp);
                          setIndoorTemp(schedule.dayTemp);
                          setNighttimeTemp(schedule.nightTemp);
                        } else {
                          setUserSetting("summerThermostat", schedule.dayTemp);
                          setUserSetting("summerThermostatNight", schedule.nightTemp);
                        }
                      }
                    }}
                    compact={true}
                  />
                </div>
              )}
            </div>

            {/* Temperature and Time Controls - Horizontal Grid Layout (like Weekly) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Daytime Temperature */}
              {energyMode === "heating" && (
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                  <div className="relative bg-slate-800/50 backdrop-blur-sm border border-yellow-500/20 rounded-xl p-3 hover:border-yellow-500/40 transition-all duration-300">
                    <label className="flex items-center gap-1.5 text-xl font-semibold text-slate-200 mb-2">
                      <Sun className="w-5 h-5 text-yellow-400" />
                      <span>Daytime</span>
                      <span className="ml-auto text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">{userSettings?.winterThermostatDay ?? indoorTemp ?? 70}°F</span>
                    </label>
                    <input
                      type="range"
                      min="60"
                      max="78"
                      value={userSettings?.winterThermostatDay ?? indoorTemp ?? 70}
                      onChange={(e) => {
                        const temp = Number(e.target.value);
                        if (setUserSetting) {
                          setUserSetting("winterThermostatDay", temp);
                        }
                        setIndoorTemp(temp);
                        setThermostatModel("custom");
                      }}
                      className="w-full h-2 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-yellow-500 hover:accent-yellow-400 transition-all"
                      style={{
                        background: `linear-gradient(to right, #fbbf24 0%, #fbbf24 ${((userSettings?.winterThermostatDay ?? indoorTemp ?? 70) - 60) / 18 * 100}%, #374151 ${((userSettings?.winterThermostatDay ?? indoorTemp ?? 70) - 60) / 18 * 100}%, #374151 100%)`
                      }}
                    />
                    <div className="flex justify-between text-base text-slate-400 mt-1">
                      <span>60°F</span>
                      <span>78°F</span>
                    </div>
                  </div>
                </div>
              )}

              {energyMode === "cooling" && (
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                  <div className="relative bg-slate-800/50 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-3 hover:border-cyan-500/40 transition-all duration-300">
                    <label className="flex items-center gap-1.5 text-xl font-semibold text-slate-200 mb-2">
                      <Sun className="w-5 h-5 text-yellow-400" />
                      <span>Daytime</span>
                      <span className="ml-auto text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">{summerThermostat || 75}°F</span>
                    </label>
                    <input
                      type="range"
                      min="68"
                      max="80"
                      value={summerThermostat || 75}
                      onChange={(e) => {
                        const temp = Number(e.target.value);
                        setThermostatModel("custom");
                        if (setUserSetting) {
                          setUserSetting("summerThermostat", temp);
                        }
                      }}
                      className="w-full h-2 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 transition-all"
                      style={{
                        background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${((summerThermostat || 75) - 68) / 12 * 100}%, #374151 ${((summerThermostat || 75) - 68) / 12 * 100}%, #374151 100%)`
                      }}
                    />
                    <div className="flex justify-between text-base text-slate-400 mt-1">
                      <span>68°F</span>
                      <span>80°F</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Schedule Clock - Takes 2 columns on large screens */}
              <div className="md:col-span-2 relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-yellow-500/10 to-orange-500/10 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                <div className="relative bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3 hover:border-slate-600/50 transition-all duration-300">
                  <label className="flex items-center gap-1.5 text-xl font-semibold text-slate-200 mb-2">
                    <Clock className="w-5 h-5 text-slate-400" />
                    <span>Schedule Times</span>
                  </label>
                  <ThermostatScheduleClock
                    daytimeStart={daytimeTime || "06:00"}
                    setbackStart={nighttimeTime || "22:00"}
                    onDaytimeStartChange={(time) => {
                      setDaytimeTime(time);
                      if (setUserSetting) {
                        const timeToHours = (timeStr) => {
                          const [hours, minutes] = timeStr.split(":").map(Number);
                          return hours + minutes / 60;
                        };
                        setUserSetting("daytimeStart", timeToHours(time));
                      }
                    }}
                    onSetbackStartChange={(time) => {
                      setNighttimeTime(time);
                      if (setUserSetting) {
                        const timeToHours = (timeStr) => {
                          const [hours, minutes] = timeStr.split(":").map(Number);
                          return hours + minutes / 60;
                        };
                        setUserSetting("nighttimeStart", timeToHours(time));
                      }
                    }}
                    compact={true}
                  />
                </div>
              </div>

              {/* Nighttime Temperature */}
              {energyMode === "heating" && (
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                  <div className="relative bg-slate-800/50 backdrop-blur-sm border border-blue-500/20 rounded-xl p-3 hover:border-blue-500/40 transition-all duration-300">
                    <label className="flex items-center gap-1.5 text-xl font-semibold text-slate-200 mb-2">
                      <Moon className="w-5 h-5 text-blue-400" />
                      <span>Nighttime</span>
                      <span className="ml-auto text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">{userSettings?.winterThermostatNight ?? nighttimeTemp ?? 68}°F</span>
                    </label>
                    <input
                      type="range"
                      min="60"
                      max="78"
                      value={userSettings?.winterThermostatNight ?? nighttimeTemp ?? 68}
                      onChange={(e) => {
                        const temp = Number(e.target.value);
                        if (setUserSetting) {
                          setUserSetting("winterThermostatNight", temp);
                        }
                        setNighttimeTemp(temp);
                        setThermostatModel("custom");
                      }}
                      className="w-full h-2 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((userSettings?.winterThermostatNight ?? nighttimeTemp ?? 68) - 60) / 18 * 100}%, #374151 ${((userSettings?.winterThermostatNight ?? nighttimeTemp ?? 68) - 60) / 18 * 100}%, #374151 100%)`
                      }}
                    />
                    <div className="flex justify-between text-base text-slate-400 mt-1">
                      <span>60°F</span>
                      <span>78°F</span>
                    </div>
                  </div>
                </div>
              )}

              {energyMode === "cooling" && (
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                  <div className="relative bg-slate-800/50 backdrop-blur-sm border border-blue-500/20 rounded-xl p-3 hover:border-blue-500/40 transition-all duration-300">
                    <label className="flex items-center gap-1.5 text-xl font-semibold text-slate-200 mb-2">
                      <Moon className="w-5 h-5 text-blue-400" />
                      <span>Nighttime</span>
                      <span className="ml-auto text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">{summerThermostatNight || summerThermostat || 72}°F</span>
                    </label>
                    <input
                      type="range"
                      min="68"
                      max="82"
                      value={summerThermostatNight || summerThermostat || 72}
                      onChange={(e) => {
                        const temp = Number(e.target.value);
                        setThermostatModel("custom");
                        if (setUserSetting) {
                          setUserSetting("summerThermostatNight", temp);
                        }
                      }}
                      className="w-full h-2 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 transition-all"
                      style={{
                        background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${((summerThermostatNight || summerThermostat || 72) - 68) / 14 * 100}%, #374151 ${((summerThermostatNight || summerThermostat || 72) - 68) / 14 * 100}%, #374151 100%)`
                      }}
                    />
                    <div className="flex justify-between text-base text-slate-400 mt-1">
                      <span>68°F</span>
                      <span>82°F</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Schedule Summary - Like Weekly Forecast */}
            <div className="mt-3 pt-3 border-t border-slate-700/50">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Current Modeled Schedule</div>
                  <div className="text-sm text-slate-200 font-medium bg-slate-900/30 rounded-lg px-2.5 py-1.5 border border-slate-700/30">
                    {(() => {
                      const timeToMinutes = (timeStr) => {
                        const [h, m] = timeStr.split(':').map(Number);
                        return h * 60 + m;
                      };
                      const formatTime = (time) => {
                        const [h, m] = time.split(':').map(Number);
                        const period = h >= 12 ? 'PM' : 'AM';
                        const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
                        return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
                      };
                      
                      const dayMins = timeToMinutes(daytimeTime || "06:00");
                      const nightMins = timeToMinutes(nighttimeTime || "22:00");
                      
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
                      
                      const dayTemp = energyMode === "heating" 
                        ? (userSettings?.winterThermostatDay ?? indoorTemp ?? 70)
                        : (summerThermostat || 75);
                      const nightTemp = energyMode === "heating"
                        ? (userSettings?.winterThermostatNight ?? nighttimeTemp ?? 68)
                        : (summerThermostatNight || summerThermostat || 72);
                      
                      if (dayMins < nightMins) {
                        return (
                          <div className="space-y-1">
                            <div>{formatTime(daytimeTime || "06:00")}–{formatTime(nighttimeTime || "22:00")} at {dayTemp}°F <span className="text-slate-400 text-sm">({dayHours}h)</span></div>
                            <div>{formatTime(nighttimeTime || "22:00")}–{formatTime(daytimeTime || "06:00")} at {nightTemp}°F <span className="text-slate-400 text-sm">({nightHours}h)</span></div>
                          </div>
                        );
                      } else {
                        return (
                          <div className="space-y-1">
                            <div>{formatTime(nighttimeTime || "22:00")}–{formatTime(daytimeTime || "06:00")} at {nightTemp}°F <span className="text-slate-400 text-sm">({nightHours}h)</span></div>
                            <div>{formatTime(daytimeTime || "06:00")}–{formatTime(nighttimeTime || "22:00")} at {dayTemp}°F <span className="text-slate-400 text-sm">({dayHours}h)</span></div>
                          </div>
                        );
                      }
                    })()}
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400 italic mt-2 flex items-center gap-1.5">
                <span className="text-yellow-400">💡</span>
                <span><em>Tip:</em> Big night setbacks can trigger strip heat in the morning.</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Aux Heat Toggle - Show for heat pumps */}
      {mode === "budget" && showDetails && primarySystem === "heatPump" && energyMode === "heating" && (
        <div className="bg-slate-800/50 border border-amber-500/30 rounded-lg p-2.5 mb-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={!!useElectricAuxHeat}
                    onChange={(e) =>
                      setUseElectricAuxHeat(!!e.target.checked)
                    }
                    aria-label="Include electric auxiliary resistance heat in monthly energy and cost estimates"
                  />
                  <div className={`w-11 h-6 rounded-full transition-colors duration-200 ${
                    useElectricAuxHeat ? 'bg-amber-500' : 'bg-slate-600'
                  }`}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 mt-0.5 ${
                      useElectricAuxHeat ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium text-white">
                      Count electric auxiliary heat in estimates
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Include backup resistance heat in monthly cost calculations
                  </p>
                </div>
              </label>
              {!useElectricAuxHeat && (
                <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-amber-200 mb-1">
                        Aux heat disabled
                      </p>
                      <p className="text-xs text-amber-300/80">
                        Minimum achievable indoor temp is approximately{" "}
                        <strong className="text-amber-200">
                          {(() => {
                            // Estimate minimum indoor temp based on heat pump capacity vs building heat loss
                            const tonsMap = {
                              18: 1.5,
                              24: 2.0,
                              30: 2.5,
                              36: 3.0,
                              42: 3.5,
                              48: 4.0,
                              60: 5.0,
                            };
                            const tons = tonsMap[capacity] || 3.0;
                            const designHeatLoss = heatUtils.calculateHeatLoss({
            squareFeet,
            insulationLevel,
            homeShape,
            ceilingHeight,
            wallHeight,
            hasLoft,
          });
                            const heatLossPerDegF = designHeatLoss / 70;

                            // At 5°F outdoor, heat pump provides ~40% capacity (typical cold climate HP)
                            const outdoorTemp = 5;
                            const heatPumpCapacityAt5F = tons * 12000 * 0.4; // BTU/hr

                            // Find indoor temp where heat loss equals heat pump output
                            const minIndoorTemp =
                              outdoorTemp +
                              heatPumpCapacityAt5F / heatLossPerDegF;

                            return Math.round(
                              Math.min(indoorTemp, Math.max(40, minIndoorTemp))
                            );
                          })()}
                          °F
                        </strong>{" "}
                        at design conditions (5°F outdoor). Below this, the heat pump cannot maintain your setpoint without supplemental heat.
                      </p>
                    </div>
                  </div>
                </div>
              )}
        </div>
        )}

      {/* Daily Forecast Breakdown - Monthly Forecast */}
      {mode === "budget" && showDetails && adjustedForecast && adjustedForecast.length > 0 && (
        <div className="mt-12 pt-8 border-t-2 border-gray-300/30 dark:border-gray-700/30">
          <div className="glass-card p-6 mb-6 animate-fade-in-up border-gray-500/30">
            {/* Collapsible Header */}
            <button
              onClick={() => setShowDailyForecast(!showDailyForecast)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <Cloud className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-bold text-high-contrast">
                  Monthly Forecast
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="https://www.weather.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Cloud size={14} />
                  NWS
                </a>
                {showDailyForecast ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </div>
            </button>
          </div>
          
          {showDailyForecast && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 mb-4 border border-gray-200 dark:border-gray-700 animate-fade-in">
              <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <button
                onClick={goToPrevMonth}
                className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
                title="Previous month"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <p className="text-gray-600 dark:text-gray-400 font-medium" style={{ fontSize: '24pt' }}>
                {activeMonths.find((m) => m.value === selectedMonth)?.label} {selectedYear}{isPastMonth ? ' — Actual Weather' : ' — Forecast-Based Estimate'}
              </p>
              <button
                onClick={goToNextMonth}
                disabled={isCurrentMonthSelected}
                className={`p-1.5 rounded-lg transition-colors ${isCurrentMonthSelected ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                title={isCurrentMonthSelected ? 'Current month' : 'Next month'}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            {actualKwhCountForExpand > 0 && billDateRange && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Comparing bill period: {billDateRange}
              </p>
            )}
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              {isPastMonth ? (
                <p className="text-gray-700 dark:text-gray-300" style={{ fontSize: '20pt' }}>
                  <strong>📊 Past Month:</strong> All temperatures are <strong>actual observed weather</strong> from{" "}
                  <a
                    href="https://api.open-meteo.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Open-Meteo Archive API
                  </a>
                  . Energy costs are calculated using your current system settings applied to real weather data — compare this total with your utility bill for that month.
                </p>
              ) : (
                <>
              <p className="text-gray-700 dark:text-gray-300 mb-2" style={{ fontSize: '20pt' }}>
                <strong>⚠️ Note:</strong> The main estimate and this table both use the same forecast-based data: 
                actual observed weather for past days this month, NWS forecast for the next 15 days, and 3-year historical average for days beyond the forecast range.
              </p>
              <p className="text-gray-700 dark:text-gray-300" style={{ fontSize: '20pt' }}>
                <strong>Data Sources:</strong> Daily forecast data is fetched from{" "}
                <a
                  href="https://api.open-meteo.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Open-Meteo API
                </a>
                , which aggregates weather data from the{" "}
                <a
                  href="https://www.weather.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  National Weather Service (NWS)
                </a>
                . <strong>Actual</strong> = observed weather for past days this month, <strong>Forecast</strong> = real-time forecast for upcoming days (up to 15 days), <strong>Historical</strong> = 3-year average for days beyond forecast range.
              </p>
              </>
              )}
            </div>
          </div>
          
          {forecastLoading && (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              Loading daily forecast...
            </div>
          )}
          
          {forecastError && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4 text-sm text-red-800 dark:text-red-200 mb-4">
              <p><strong>Error loading forecast:</strong> {forecastError}</p>
            </div>
          )}

          {/* Sinusoidal Temperature Graph */}
          {!forecastLoading && !forecastError && adjustedForecast && adjustedForecast.length > 0 && (
            (() => {
            // Generate hourly temperature data for the entire month using sinusoidal calculation
            const graphData = [];
            
            adjustedForecast.forEach((day, dayIndex) => {
              const lowTemp = day.low;
              const highTemp = day.high;
              const tempRange = highTemp - lowTemp;
              const avgTemp = day.avg;
              
              // Generate 24 hourly data points for this day
              for (let hour = 0; hour < 24; hour++) {
                // Same sinusoidal calculation as used in the energy calculation
                const phase = ((hour - 6) / 12) * Math.PI;
                const tempOffset = Math.cos(phase - Math.PI) * (tempRange / 2);
                const hourlyTemp = avgTemp + tempOffset;
                
                // Calculate time label
                const hourLabel = hour === 0 ? '12 AM' : 
                                 hour < 12 ? `${hour} AM` : 
                                 hour === 12 ? '12 PM' : 
                                 `${hour - 12} PM`;
                
                graphData.push({
                  day: day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  hour: hour,
                  hourLabel: dayIndex === 0 ? hourLabel : '', // Only show labels for first day to avoid clutter
                  temperature: Math.round(hourlyTemp * 10) / 10,
                  date: day.date,
                  dayIndex: dayIndex,
                });
              }
            });
            
            return (
              <div className="mb-4">
                <button
                  onClick={() => setShowSinusoidalGraph(!showSinusoidalGraph)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                    <span className="font-semibold text-gray-900 dark:text-gray-100" style={{ fontSize: '14pt' }}>
                      Sinusoidal Temperature Profile (Entire Month)
                    </span>
                  </div>
                  {showSinusoidalGraph ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                
                {showSinusoidalGraph && (
                  <div className="mt-3 bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-gray-600 dark:text-gray-400 mb-3" style={{ fontSize: '14pt' }}>
                      This graph shows the hourly temperature profile for each day of the month, calculated using a sinusoidal curve. 
                      Temperatures are lowest around 6 AM and highest around 2 PM, creating a realistic daily temperature cycle.
                    </p>
                    <div className="w-full" style={{ height: '400px', minHeight: '400px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={graphData} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="day" 
                            angle={-45}
                            textAnchor="end"
                            height={80}
                            stroke="#6b7280"
                            tick={{ fontSize: 10 }}
                            interval="preserveStartEnd"
                          />
                          <YAxis 
                            label={{ value: 'Temperature (°F)', angle: -90, position: 'insideLeft' }}
                            stroke="#6b7280"
                            tick={{ fontSize: 10 }}
                          />
                          <Tooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                const hourLabel = data.hour === 0 ? '12 AM' : 
                                                 data.hour < 12 ? `${data.hour} AM` : 
                                                 data.hour === 12 ? '12 PM' : 
                                                 `${data.hour - 12} PM`;
                                return (
                                  <div className="bg-white dark:bg-gray-800 p-2 border border-gray-200 dark:border-gray-700 rounded shadow-lg">
                                    <p className="text-xs font-semibold">{data.day}</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">{hourLabel}</p>
                                    <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                      {data.temperature.toFixed(1)}°F
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="temperature" 
                            stroke="#3b82f6" 
                            strokeWidth={1.5}
                            dot={false}
                            name="Temperature (°F)"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            );
            })()
          )}
          
          {!forecastLoading && !forecastError && (() => {
            // Calculate daily metrics using effective (learned/calibrated) heat loss factor
            const tonsMap = {
              18: 1.5, 24: 2.0, 30: 2.5, 36: 3.0, 42: 3.5, 48: 4.0, 60: 5.0,
            };
            const tons = tonsMap[capacity] || 3.0;
            // Use getEffectiveHeatLossFactor (which includes learned/manual/analyzer calibration)
            // for heat pump energy; but bill-learned can understate peak load on very cold days
            // (it's an average across days). When building calc is significantly higher, use it
            // so aux heat is modeled on cold days when the heat pump can't keep up.
            const heatLossForForecast = (hlfSource === 'learned' && calculatedHeatLossFactor > getEffectiveHeatLossFactor * 1.5)
              ? Math.max(getEffectiveHeatLossFactor, calculatedHeatLossFactor)
              : getEffectiveHeatLossFactor;
            const effectiveDesignHeatLoss = heatLossForForecast * 70;
            const btuLossPerDegF = heatLossForForecast;
            const compressorPower = tons * 1.0 * (15 / efficiency);
            
            // Debug: log how many days we're processing
            if (import.meta?.env?.DEV) {
              console.log(`📆 Processing ${adjustedForecast.length} days for daily metrics table`);
            }
            
            const dailyMetrics = adjustedForecast.map((day) => {
              // In auto mode, determine which mode to use based on outdoor temperature
              const dayEffectiveTemp = isAutoMode ? getEffectiveTempForDay(day.avg) : effectiveIndoorTemp;
              const dayMode = isAutoMode 
                ? (day.avg < 70 ? "heating" : "cooling")
                : energyMode;
              
              const tempDiff = dayMode === "heating" 
                ? Math.max(0, dayEffectiveTemp - day.avg)
                : Math.max(0, day.avg - dayEffectiveTemp);
              
              let dailyEnergy = 0;
              let dailyCost = 0;
              let auxEnergy = 0;
              
              if (tempDiff > 0) {
                if (dayMode === "heating" && primarySystem === "heatPump") {
                  // Use hourly performance calculation for each hour of the day
                  // Create a realistic temperature profile using low/high temps
                  // Temperature typically lowest at ~6 AM, highest at ~2 PM
                  const avgHumidity = day.humidity || 50;
                  
                  // Calculate for 24 hours with realistic temperature profile
                  const dtHours = 1.0; // 1 hour per timestep
                  for (let hour = 0; hour < 24; hour++) {
                    // Create a realistic daily temperature curve
                    // Lowest temp typically around 6 AM, highest around 2 PM (14:00)
                    // Use a sine wave approximation: temp = avg + amplitude * sin(phase)
                    const lowTemp = day.low;
                    const highTemp = day.high;
                    const tempRange = highTemp - lowTemp;
                    const avgTemp = day.avg;
                    
                    // Phase: 0 at 6 AM (hour 6), peaks at 2 PM (hour 14)
                    // Shift so minimum is at hour 6, maximum at hour 14
                    const phase = ((hour - 6) / 12) * Math.PI; // -π at 6 AM, 0 at 12 PM, +π at 6 PM
                    // Use cosine to shift: cos(phase - π) gives -1 at 6 AM, +1 at 2 PM
                    const tempOffset = Math.cos(phase - Math.PI) * (tempRange / 2);
                    const hourlyTemp = avgTemp + tempOffset;
                    
                      const perf = heatUtils.computeHourlyPerformance(
                        {
                          tons,
                          indoorTemp: dayEffectiveTemp,
                          designHeatLossBtuHrAt70F: effectiveDesignHeatLoss,
                          compressorPower,
                          hspf2: hspf2 || efficiency,
                        },
                      hourlyTemp,
                      avgHumidity,
                      dtHours
                    );
                    
                    // AGGREGATION RULES: Sum energy directly - NEVER multiply by dtHours
                    // ✅ CORRECT: monthlyHpKwh += perf.hpKwh; monthlyAuxKwh += perf.auxKwh;
                    // ❌ WRONG: perf.hpKwh * dtHours or perf.auxKwh * dtHours (would double-count!)
                    // Note: auxKw is informational only; do not aggregate power, aggregate auxKwh.
                    const hourlyEnergy = perf.hpKwh !== undefined
                      ? perf.hpKwh
                      : perf.electricalKw * (perf.capacityUtilization / 100) * dtHours; // Fallback (using capacityUtilization, not time-based runtime)
                    dailyEnergy += hourlyEnergy;
                    
                    if (useElectricAuxHeat) {
                      const auxKwh = perf.auxKwh !== undefined
                        ? perf.auxKwh
                        : (perf.auxKw ? perf.auxKw * dtHours : 0); // Fallback
                      if (auxKwh > 0) {
                        auxEnergy += auxKwh;
                        dailyEnergy += auxKwh;
                        dailyCost += auxKwh * utilityCost;
                      }
                    }
                    
                    dailyCost += hourlyEnergy * utilityCost;
                  }
                } else if (dayMode === "heating" && isGasHeat) {
                  // Use sinusoidal hourly temperatures for accurate calculations (consistent with heat pump)
                  const eff = Math.min(0.99, Math.max(0.6, afue));
                  const btuPerTherm = 100000;
                  const lowTemp = day.low;
                  const highTemp = day.high;
                  const tempRange = highTemp - lowTemp;
                  const avgTemp = day.avg;
                  
                  let dailyTherms = 0;
                  // Generate hourly temperatures using sinusoidal pattern (low at 6 AM, high at 2 PM)
                  for (let hour = 0; hour < 24; hour++) {
                    const phase = ((hour - 6) / 12) * Math.PI;
                    const tempOffset = Math.cos(phase - Math.PI) * (tempRange / 2);
                    const hourlyTemp = avgTemp + tempOffset;
                    
                    const hourlyTempDiff = Math.max(0, dayEffectiveTemp - hourlyTemp);
                    const buildingHeatLossBtu = btuLossPerDegF * hourlyTempDiff;
                    const thermsPerHour = buildingHeatLossBtu / (btuPerTherm * eff);
                    dailyTherms += thermsPerHour;
                  }
                  
                  dailyCost = dailyTherms * gasCost;
                  dailyEnergy = dailyTherms * 29.3; // Convert therms to kWh for display
                } else if (dayMode === "cooling") {
                  const _coolingCapacityKbtu = primarySystem === "heatPump" ? capacity : (coolingCapacity || capacity);
                  const seer2 = efficiency;
                  const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
                  const btuGainPerDegF = (squareFeet * 28.0 * insulationLevel * homeShape * ceilingMultiplier * solarExposure) / 20.0;
                  const totalDailyHeatGainBtu = btuGainPerDegF * tempDiff * 24;
                  const dailyKWh = totalDailyHeatGainBtu / (seer2 * 1000);
                  dailyEnergy = dailyKWh;
                  dailyCost = dailyKWh * utilityCost;
                }
              }
              
              return {
                date: day.date,
                day: day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }),
                high: day.high,
                low: day.low,
                avg: day.avg,
                energy: dailyEnergy,
                auxEnergy: auxEnergy,
                cost: dailyCost,
                mode: dayMode, // Track which mode was used for this day (for display)
                effectiveTemp: dayEffectiveTemp, // Track effective temp used (for display)
                source: day.source,
              };
            });
            
            const totalForecastCost = dailyMetrics.reduce((sum, d) => sum + d.cost, 0);
            const totalForecastEnergy = dailyMetrics.reduce((sum, d) => sum + d.energy, 0);
            
            // Store in refs for analytics section access
            dailyMetricsRef.current = dailyMetrics;
            totalForecastCostRef.current = totalForecastCost;
            totalForecastEnergyRef.current = totalForecastEnergy;
            
            // Calculate max values for progress bars (with guards for empty arrays)
            const maxEnergy = dailyMetrics.length > 0 ? Math.max(...dailyMetrics.map(d => d.energy), 1) : 1;
            const maxAuxEnergy = dailyMetrics.length > 0 ? Math.max(...dailyMetrics.map(d => d.auxEnergy), 1) : 1;
            const costs = dailyMetrics.map(d => d.cost);
            const minCost = costs.length > 0 ? Math.min(...costs) : 0;
            const maxCost = costs.length > 0 ? Math.max(...costs) : 0;
            
            // Get heat map color based on cost value (same as weekly forecast)
            const getHeatMapColor = (cost) => {
              if (maxCost === minCost) return 'rgba(34, 197, 94, 0.1)'; // All same, light green
              const ratio = (cost - minCost) / (maxCost - minCost);
              // Gradient from light green (low cost) to light red (high cost)
              const r = Math.round(34 + (239 - 34) * ratio);
              const g = Math.round(197 - (197 - 68) * ratio);
              const b = Math.round(94 - (94 - 68) * ratio);
              return `rgba(${r}, ${g}, ${b}, ${0.15 + ratio * 0.25})`;
            };
            
            // Inline progress bar component (same as weekly forecast)
            const InlineBar = ({ value, maxValue, color = 'blue' }) => {
              const percentage = Math.min((value / maxValue) * 100, 100);
              const colorClasses = {
                blue: 'bg-blue-500',
                orange: 'bg-orange-500',
                green: 'bg-green-500'
              };
              
              return (
                <div className="flex items-center gap-2 justify-end">
                  <div className="flex-grow bg-gray-200 dark:bg-gray-600 rounded-full h-2 max-w-[100px]">
                    <div
                      className={`${colorClasses[color]} h-2 rounded-full transition-all`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <span className="font-semibold min-w-[50px] text-right text-gray-900 dark:text-gray-100">
                    {Math.round(value * 10) / 10}
                  </span>
                </div>
              );
            };
            
            return (
              <div className="overflow-x-auto" data-no-swipe>
                <table className="w-full border-collapse min-w-[640px]" style={{ fontSize: '18pt' }}>
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800 border-b-2 border-gray-300 dark:border-gray-600 sticky top-0 z-10">
                      <th className="text-left py-2.5 px-2 font-semibold text-gray-900 dark:text-gray-100" scope="col" style={{ fontSize: '18pt' }}>Day</th>
                      <th className="text-left py-2.5 px-2 font-semibold text-gray-900 dark:text-gray-100" scope="col" style={{ fontSize: '18pt' }}>Outdoor Temp (°F)</th>
                      <th className="text-center py-2.5 px-2 font-semibold text-gray-900 dark:text-gray-100" scope="col" style={{ fontSize: '18pt' }}>Forecast Energy (kWh)</th>
                      {primarySystem === "heatPump" && energyMode === "heating" && useElectricAuxHeat && (
                        <th className="text-center py-2.5 px-2 font-semibold text-gray-900 dark:text-gray-100" scope="col" style={{ fontSize: '18pt' }}>Aux Strip (kWh)</th>
                      )}
                      <th className="text-right py-2.5 px-2 font-semibold text-gray-900 dark:text-gray-100" scope="col" title="HVAC heating/cooling only; your bill includes whole-house (baseload)" style={{ fontSize: '18pt' }}>Est. Cost ($) — Heating/Cooling only</th>
                      <th className="text-right py-2.5 px-2 font-semibold text-gray-900 dark:text-gray-100" scope="col" title="Enter your actual kWh from your utility bill" style={{ fontSize: '18pt' }}>Your Bill (kWh)</th>
                      <th className="text-right py-2.5 px-2 font-semibold text-gray-900 dark:text-gray-100" scope="col" title="Your bill kWh × electricity rate" style={{ fontSize: '18pt' }}>Actual Cost ($)</th>
                      <th className="text-center py-2.5 px-2 font-semibold text-gray-900 dark:text-gray-100" scope="col" title="Your bill kWh − Forecast kWh" style={{ fontSize: '18pt' }}>Δ kWh</th>
                      <th className="text-center py-2.5 px-2 font-semibold text-gray-900 dark:text-gray-100" scope="col" title="Empirical BTU/hr/°F from bill: actual kWh × 3412 ÷ 24 ÷ ΔT (assumes all kWh is heating; includes baseload)" style={{ fontSize: '18pt' }}>BTU/°F (bill)</th>
                      <th className="text-left py-2.5 px-2 font-semibold text-gray-900 dark:text-gray-100" scope="col" style={{ fontSize: '18pt' }}>Data Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyMetrics.map((day, idx) => {
                      // Check if this day is today
                      const today = new Date();
                      const dayDate = new Date(day.date);
                      const isToday = dayDate.toDateString() === today.toDateString();
                      
                      return (
                      <tr 
                        key={idx} 
                        className={`even:bg-white odd:bg-gray-50 dark:even:bg-gray-800 dark:odd:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors ${
                          isToday ? 'bg-blue-200 dark:bg-blue-800 font-bold border-l-4 border-blue-600 dark:border-blue-400' : ''
                        }`}
                      >
                        <td className={`py-2 px-2 font-semibold ${isToday ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-gray-100'}`}>
                          {isToday && <span className="mr-1">📍</span>}{day.day}
                          {isToday && <span className="ml-2 bg-blue-600 dark:bg-blue-500 text-white px-2 py-0.5 rounded-full" style={{ fontSize: '11pt' }}>Today</span>}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <div className="bg-gradient-to-r from-blue-400 to-red-400 rounded-full h-2 w-16 shrink-0"></div>
                            <span className="text-gray-900 dark:text-gray-100">
                              {day.low.toFixed(0)}° – {day.high.toFixed(0)}°F
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <InlineBar value={day.energy} maxValue={maxEnergy} color="blue" />
                        </td>
                        {primarySystem === "heatPump" && energyMode === "heating" && useElectricAuxHeat && (
                          <td className="py-2 px-2 text-center">
                            <InlineBar value={day.auxEnergy} maxValue={maxAuxEnergy} color="orange" />
                          </td>
                        )}
                        <td
                          className="py-2 px-2 text-right transition-colors"
                          style={{ backgroundColor: getHeatMapColor(day.cost) }}
                        >
                          <span className="font-bold text-green-700 dark:text-green-400">
                            ${Math.round(day.cost * 100) / 100}
                          </span>
                        </td>
                        <td className="py-1 px-2 text-right">
                          {(() => {
                            const dayKey = day.date instanceof Date ? `${day.date.getMonth()+1}-${day.date.getDate()}` : String(idx+1);
                            const actualVal = actualKwhEntries[dayKey];
                            // Show "—" for 0 (no data) so it's not confused with actual usage
                            const displayVal = actualVal != null && actualVal > 0 ? actualVal : '';
                            return (
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                placeholder="—"
                                value={displayVal}
                                onChange={(e) => updateActualKwh(dayKey, e.target.value)}
                                className="w-full max-w-[80px] px-1.5 py-0.5 text-right rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                style={{ fontSize: '14pt' }}
                              />
                            );
                          })()}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {(() => {
                            const dayKey = day.date instanceof Date ? `${day.date.getMonth()+1}-${day.date.getDate()}` : String(idx+1);
                            const actualVal = actualKwhEntries[dayKey];
                            const elecRate = utilityCost ?? 0.1;
                            if (actualVal == null || actualVal <= 0) return <span className="text-gray-400">—</span>;
                            return (
                              <span className="font-bold text-green-700 dark:text-green-400">
                                ${(actualVal * elecRate).toFixed(2)}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {(() => {
                            const dayKey = day.date instanceof Date ? `${day.date.getMonth()+1}-${day.date.getDate()}` : String(idx+1);
                            const actualVal = actualKwhEntries[dayKey];
                            // Only show delta when there is actual bill data (no delta for empty or 0 — that's "no data")
                            const hasActual = actualVal != null && actualVal > 0;
                            const diff = hasActual ? (actualVal - day.energy) : null;
                            if (diff == null) return <span className="text-gray-400">—</span>;
                            return (
                              <span className={`font-medium ${diff > 0 ? 'text-red-500' : diff < 0 ? 'text-green-500' : 'text-gray-400'}`} title="Your bill kWh − Forecast kWh">
                                {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {(() => {
                            const dayKey = day.date instanceof Date ? `${day.date.getMonth()+1}-${day.date.getDate()}` : String(idx+1);
                            const actualVal = actualKwhEntries[dayKey];
                            if (actualVal == null || actualVal <= 0) return <span className="text-gray-400">—</span>;
                            const avgOutdoor = (day.low + day.high) / 2;
                            const deltaT = Math.max(1, (effectiveIndoorTemp || 70) - avgOutdoor);
                            const btuPerDegF = (actualVal * 3412) / 24 / deltaT;
                            return (
                              <span className="text-gray-600 dark:text-gray-400" title="actual kWh × 3412 ÷ 24 ÷ ΔT (assumes all kWh is heating)">
                                {Math.round(btuPerDegF)}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-2 px-2">
                          <span className={`px-2 py-1 rounded ${
                            day.source === 'actual'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                              : day.source === 'forecast' 
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}>
                            {day.source === 'actual' ? 'Actual' : day.source === 'forecast' ? 'Forecast' : 'Historical'}
                          </span>
                        </td>
                      </tr>
                      );
                    })}
                    <tr className="border-t-2 border-gray-300 dark:border-gray-600 font-bold bg-gray-50 dark:bg-gray-900/50">
                      <td colSpan={2} className="py-3 px-2 text-left text-gray-900 dark:text-gray-100">
                        Monthly Total
                      </td>
                      <td className="py-3 px-2 text-center text-gray-900 dark:text-gray-100">
                        <span className="font-normal text-gray-500 dark:text-gray-400 block" style={{ fontSize: '18pt' }}>Forecast</span>
                        {Math.round(totalForecastEnergy * 10) / 10} kWh
                      </td>
                      {primarySystem === "heatPump" && energyMode === "heating" && useElectricAuxHeat && (
                        <td className="py-3 px-2 text-center"></td>
                      )}
                      <td className="py-3 px-2 text-right text-gray-900 dark:text-gray-100">
                        <span className="font-normal text-gray-500 dark:text-gray-400 block" style={{ fontSize: '18pt' }}>Est. cost (Heating/Cooling only)</span>
                        ${(Math.round(totalForecastCost * 100) / 100).toFixed(2)} variable
                        {(() => {
                          const fixed = monthlyEstimate?.fixedCost ?? (energyMode === "heating" && isGasHeat ? fixedGasCost : fixedElectricCost) ?? 0;
                          return fixed > 0 && (
                            <span className="text-gray-600 dark:text-gray-300 font-normal block" style={{ fontSize: '18pt' }}>
                              + ${fixed.toFixed(2)} fixed = ${(Math.round(totalForecastCost * 100) / 100 + fixed).toFixed(2)} total
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-2 text-right text-gray-900 dark:text-gray-100">
                        <span className="font-normal text-gray-500 dark:text-gray-400 block" style={{ fontSize: '18pt' }}>Your bill</span>
                        {(() => {
                          const actualValues = Object.entries(actualKwhEntries).filter(([, v]) => typeof v === 'number' && v > 0);
                          if (actualValues.length === 0) return <span className="text-gray-400">—</span>;
                          const actualTotal = actualValues.reduce((sum, [, v]) => sum + v, 0);
                          return <span>{Math.round(actualTotal * 10) / 10} kWh</span>;
                        })()}
                      </td>
                      <td className="py-3 px-2 text-right text-gray-900 dark:text-gray-100">
                        <span className="font-normal text-gray-500 dark:text-gray-400 block" style={{ fontSize: '18pt' }}>Actual cost</span>
                        {(() => {
                          const actualValues = Object.entries(actualKwhEntries).filter(([, v]) => typeof v === 'number' && v > 0);
                          if (actualValues.length === 0) return <span className="text-gray-400">—</span>;
                          const actualTotal = actualValues.reduce((sum, [, v]) => sum + v, 0);
                          const elecRate = utilityCost ?? 0.1;
                          const actualCost = actualTotal * elecRate;
                          return <span>${actualCost.toFixed(2)}</span>;
                        })()}
                      </td>
                      <td className="py-3 px-2 text-center text-gray-900 dark:text-gray-100">
                        <span className="font-normal text-gray-500 dark:text-gray-400 block" style={{ fontSize: '18pt' }}>Δ kWh</span>
                        {(() => {
                          const actualValues = Object.entries(actualKwhEntries).filter(([, v]) => typeof v === 'number' && v > 0);
                          if (actualValues.length === 0) return <span className="text-gray-400">—</span>;
                          const actualTotal = actualValues.reduce((sum, [, v]) => sum + v, 0);
                          const diff = actualTotal - totalForecastEnergy;
                          return (
                            <span className={diff > 0 ? 'text-red-500' : diff < 0 ? 'text-green-500' : 'text-gray-500'} title="Your bill kWh − Forecast kWh">
                              {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-2 text-center text-gray-900 dark:text-gray-100">
                        <span className="font-normal text-gray-500 dark:text-gray-400 block" style={{ fontSize: '18pt' }}>BTU/°F (avg)</span>
                        {(() => {
                          const setTemp = effectiveIndoorTemp || 70;
                          const daysWithBtu = dailyMetrics.filter((d, i) => {
                            const dayKey = d.date instanceof Date ? `${d.date.getMonth()+1}-${d.date.getDate()}` : String(i+1);
                            const v = actualKwhEntries[dayKey];
                            return v != null && v > 0;
                          });
                          if (daysWithBtu.length === 0) return <span className="text-gray-400">—</span>;
                          const hlfs = daysWithBtu.map((d) => {
                            const dayKey = d.date instanceof Date ? `${d.date.getMonth()+1}-${d.date.getDate()}` : String(dailyMetrics.indexOf(d)+1);
                            const actualVal = actualKwhEntries[dayKey];
                            const avgOutdoor = (d.low + d.high) / 2;
                            const deltaT = Math.max(1, setTemp - avgOutdoor);
                            return (actualVal * 3412) / 24 / deltaT;
                          });
                          const avgHlf = hlfs.reduce((a, b) => a + b, 0) / hlfs.length;
                          return <span className="text-xs" title="Average empirical BTU/hr/°F from days with bill data">{Math.round(avgHlf)}</span>;
                        })()}
                      </td>
                      <td className="py-3 px-2 text-left"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()}
            </div>
          )}
        </div>
      )}

      {/* Settings Section - Moved to bottom so cost stays visible */}
      {mode !== "annual" && (mode !== "budget" || showDetails) && (
        <div className="mt-6 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-bold text-high-contrast">⚙️ Settings</h2>
          </div>
          
          {/* Group inputs in 3-column grid on desktop for compact layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
            {/* Location Display - Budget Mode */}
            {mode === "budget" && (
              <div className="glass-card p-2 animate-fade-in-up">
                <div className="flex items-center gap-1.5 mb-1">
                  <MapPin className="text-blue-500" size={14} />
                  <span className="text-xs font-semibold text-high-contrast">Location</span>
                </div>
                {locationData ? (
                  <>
                    <div className="text-xs font-semibold text-high-contrast">
                      {locationData.city}, {locationData.state}
                    </div>
                    {(typeof monthlyEstimate?.electricityRate === "number" || electricityRateA !== null) && (
                      <div className="text-[10px] text-muted mt-0.5">
                        ${(monthlyEstimate?.electricityRate ?? electricityRateA ?? utilityCost).toFixed(3)}/kWh
                        {electricityRateSourceA && electricityRateSourceA.includes("EIA") && (
                          <span className="text-[9px] text-green-400 ml-1">✓</span>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-[10px] text-yellow-600 dark:text-yellow-400">
                    Set in <Link to="/cost-forecaster" className="underline">Forecaster</Link>
                  </div>
                )}
              </div>
            )}
          
          {/* Month and Fixed Fees - Compact Layout */}
          <div className="glass-card p-2 animate-fade-in-up">
            <div className="grid grid-cols-2 gap-3">
              {/* Month Selector */}
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Calendar className="text-blue-500" size={12} />
                  <span className="text-[10px] font-semibold text-high-contrast">Month</span>
                </div>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className={`${selectClasses} text-xs py-0.5 h-7`}
                >
                  {activeMonths.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fixed Fees - Compact */}
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <DollarSign className="text-blue-500" size={12} />
                  <span className="text-[10px] font-semibold text-high-contrast">Fixed Fees</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <label className="text-[9px] text-muted whitespace-nowrap">Elec:</label>
                    <div className="relative flex-1">
                      <span className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-500 text-[10px]">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={fixedElectricCost}
                        onChange={(e) => setUserSetting("fixedElectricCost", parseFloat(e.target.value) || 0)}
                        className={`${inputClasses} pl-5 text-xs py-0.5 h-6`}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  {isGasHeat && (
                    <div className="flex items-center gap-1">
                      <label className="text-[9px] text-muted whitespace-nowrap">Gas:</label>
                      <div className="relative flex-1">
                        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-500 text-[10px]">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={fixedGasCost}
                          onChange={(e) => setUserSetting("fixedGasCost", parseFloat(e.target.value) || 0)}
                          className={`${inputClasses} pl-5 text-xs py-0.5 h-6`}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Forecast Model Selector - Only for monthly estimates, not annual */}
          {/* Note: Annual comparisons always use "Typical (30-Yr Avg)" since you can't forecast an entire year */}
          {mode !== "comparison" && energyMode === "heating" && (
            <div className="glass-card p-2 animate-fade-in-up border-blue-500/30">
              <div className="flex items-center gap-1.5 mb-1">
                <Cloud className="text-blue-500" size={14} />
                <span className="text-xs font-semibold text-high-contrast">Weather</span>
              </div>
              <select
                value={forecastModel}
                onChange={(e) => setForecastModel(e.target.value)}
                className={`${selectClasses} text-xs py-1`}
              >
                <option value="typical">Typical (30-Yr Avg)</option>
                <option value="current">Current Forecast</option>
                <option value="polarVortex">Polar Vortex (-5°F)</option>
              </select>
              {forecastModel === "polarVortex" && (
                <div className="mt-1.5 p-1.5 glass-card border-red-500/30 bg-red-900/10 text-[10px] text-high-contrast">
                  <p className="font-semibold">⚠️ 30-40% higher costs</p>
                </div>
              )}
              {forecastModel === "current" && dailyForecast && dailyForecast.some(d => d.source === "forecast") && (
                <div className="mt-1.5 p-1.5 glass-card border-blue-500/30 bg-blue-900/10 text-[10px] text-high-contrast">
                  <p>✓ Live forecast active</p>
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      )}

      {/* Location Status - Comparison Mode */}
      {mode === "comparison" && (
        // Two-city comparison mode
        <div className="grid grid-cols-1 md:grid-cols-2 gap-glass mb-3">
          {/* Location A */}
          <div className="glass-card p-2 animate-fade-in-up border-blue-500/30">
            <div className="text-[10px] font-semibold text-blue-500 mb-1">
              LOCATION A
            </div>
            {locationData ? (
              <>
                <div className="flex items-center gap-1.5 text-high-contrast mb-1">
                  <MapPin size={14} className="text-blue-500" />
                  <span className="text-xs font-semibold">
                    {locationData.city}, {locationData.state}
                  </span>
                </div>
                {typeof locationData.elevation === "number" && (
                  <div className="text-[10px] text-muted mb-1">
                    Elevation: ~{Math.round(locationData.elevation)} ft
                  </div>
                )}
                {(typeof monthlyEstimate?.electricityRate === "number" || electricityRateA !== null) && (
                  <div className="text-[10px] text-muted">
                    ${(monthlyEstimate?.electricityRate ?? electricityRateA ?? utilityCost).toFixed(3)}/kWh
                    {electricityRateSourceA && electricityRateSourceA.includes("EIA") && (
                      <span className="text-[9px] text-green-400 ml-1">✓</span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-high-contrast text-xs">
                Set in <Link to="/cost-forecaster" className="underline">Forecaster</Link>
              </div>
            )}
          </div>

          {/* Location B */}
          <div className="glass-card p-2 animate-fade-in-up border-green-500/30">
            <div className="text-[10px] font-semibold text-green-500 mb-1">
              LOCATION B
            </div>
            {locationDataB ? (
              <>
                <div className="flex items-center gap-1.5 text-high-contrast mb-1">
                  <MapPin size={14} className="text-green-500" />
                  <span className="text-xs font-semibold">
                    {locationDataB.city}, {locationDataB.state}
                  </span>
                  <button
                    onClick={() => setLocationDataB(null)}
                    className="ml-auto text-[10px] underline hover:opacity-80"
                  >
                    Change
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 items-end mb-1">
                  <div className="text-[10px] text-muted">
                    Station: ~{Math.round(locationDataB.elevation ?? 0)} ft
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] text-muted whitespace-nowrap">
                      Home:
                    </label>
                    <input
                      type="number"
                      value={elevationOverrideB ?? ""}
                      onChange={(e) =>
                        setElevationOverrideB(
                          e.target.value === "" ? null : Number(e.target.value)
                        )
                      }
                      className={`${inputClasses} text-xs py-0.5 px-1`}
                      placeholder={`${Math.round(
                        locationDataB.elevation ?? 0
                      )}`}
                    />
                    <span className="text-[10px] text-muted">
                      ft
                    </span>
                  </div>
                </div>
                <div className="text-[9px] text-muted opacity-80 mb-1">
                  Lapse rate: 3.5°F per 1000 ft
                </div>
                {(typeof monthlyEstimateB?.electricityRate === "number" || electricityRateB !== null) && (
                  <div className="text-[10px] text-muted">
                    ${(monthlyEstimateB?.electricityRate ?? electricityRateB ?? utilityCost).toFixed(3)}/kWh
                    {electricityRateSourceB && electricityRateSourceB.includes("EIA") && (
                      <span className="text-[9px] text-green-400 ml-1">✓</span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={cityInputB}
                    onChange={(e) => setCityInputB(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCitySearchB()}
                    placeholder="Enter city (e.g., Chicago, IL)"
                    className={fullInputClasses}
                  />
                  <button
                    onClick={handleCitySearchB}
                    disabled={loadingB}
                    className="px-3 py-1 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                  >
                    {loadingB ? "..." : "Search"}
                  </button>
                </div>
                {errorB && (
                  <div className="mt-2 text-sm text-red-500 flex items-start gap-2">
                    <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                    <span>{errorB}</span>
                  </div>
                )}
              </div>
            )}
            {!locationDataB && searchStatusB && (
              <div
                className={`mt-2 text-xs p-2 rounded ${
                  searchStatusB.type === "success"
                    ? "glass-card border-green-500/30 text-high-contrast"
                    : "glass-card border-red-500/30 text-high-contrast"
                }`}
              >
                {searchStatusB.message}
              </div>
            )}
          </div>
        </div>
      )}


      {/* Annual Forecast Display */}
      {mode === "annual" && locationData && (
        <div 
          key={`annual-${userSettings?.winterThermostatDay ?? 70}-${userSettings?.winterThermostatNight ?? 66}-${userSettings?.summerThermostat ?? 74}-${userSettings?.summerThermostatNight ?? 72}-${userSettings?.daytimeStart ?? 6}-${userSettings?.nighttimeStart ?? 22}`}
          className="glass-card-gradient glass-card p-glass-lg mb-4 animate-fade-in-up"
        >
          {(() => {
            // Use the same annual calculation logic from "Show me the math"
            const annualHDD = getAnnualHDD(locationData.city, locationData.state);
            const annualCDD = getAnnualCDD(locationData.city, locationData.state);
            
            const safeFixedElectric = Number(fixedElectricCost) || 0;
            const safeFixedGas = Number(fixedGasCost) || 0;

            const monthlyHDDDist = [1200, 1000, 600, 200, 50, 10, 0, 0, 20, 200, 500, 1100]; 
            const monthlyCDDDist = [0, 0, 10, 60, 150, 300, 450, 400, 250, 100, 10, 0];
            
            const totalTypicalHDD = monthlyHDDDist.reduce((a, b) => a + b, 0); 
            const totalTypicalCDD = monthlyCDDDist.reduce((a, b) => a + b, 0); 
            
            // Load thermostat comfort settings for all modes (home, away, sleep) - like Ecobee auto mode
            const deadband = 5; // Typical Ecobee deadband (5°F between heat and cool)
            
            // Default setpoints (Ecobee standard)
            let homeHeatSetPoint = 70;
            let homeCoolSetPoint = 75;
            let awayHeatSetPoint = 62;
            let awayCoolSetPoint = 85;
            let sleepHeatSetPoint = 66;
            let sleepCoolSetPoint = 78;
            
            // Get schedule times for determining which mode is active
            // Priority: userSettings (from sliders) > schedule > defaults
            let daytimeStartTime = "06:00"; // Default: home mode starts at 6 AM
            let nighttimeStartTime = "22:00"; // Default: sleep mode starts at 10 PM
            
            // Check userSettings first (from sliders)
            if (userSettings?.daytimeStart !== undefined) {
              const hours = Math.floor(userSettings.daytimeStart);
              const minutes = Math.round((userSettings.daytimeStart - hours) * 60);
              daytimeStartTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            }
            if (userSettings?.nighttimeStart !== undefined) {
              const hours = Math.floor(userSettings.nighttimeStart);
              const minutes = Math.round((userSettings.nighttimeStart - hours) * 60);
              nighttimeStartTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            }
            
            try {
              const thermostatSettings = loadThermostatSettings();
              const comfortSettings = thermostatSettings?.comfortSettings;
              const schedule = thermostatSettings?.schedule;
              
              // Priority: userSettings (from sliders) > comfortSettings > defaults
              // Load home mode setpoints
              if (userSettings?.winterThermostatDay !== undefined) {
                homeHeatSetPoint = userSettings.winterThermostatDay;
              } else if (comfortSettings?.home?.heatSetPoint !== undefined) {
                homeHeatSetPoint = comfortSettings.home.heatSetPoint;
              }
              
              if (userSettings?.summerThermostat !== undefined) {
                homeCoolSetPoint = userSettings.summerThermostat;
              } else if (comfortSettings?.home?.coolSetPoint !== undefined) {
                homeCoolSetPoint = comfortSettings.home.coolSetPoint;
              }
              
              // Load away mode setpoints (no userSettings sliders for away, so use comfortSettings)
              if (comfortSettings?.away?.heatSetPoint !== undefined) {
                awayHeatSetPoint = comfortSettings.away.heatSetPoint;
              }
              if (comfortSettings?.away?.coolSetPoint !== undefined) {
                awayCoolSetPoint = comfortSettings.away.coolSetPoint;
              }
              
              // Load sleep mode setpoints
              if (userSettings?.winterThermostatNight !== undefined) {
                sleepHeatSetPoint = userSettings.winterThermostatNight;
              } else if (comfortSettings?.sleep?.heatSetPoint !== undefined) {
                sleepHeatSetPoint = comfortSettings.sleep.heatSetPoint;
              }
              
              if (userSettings?.summerThermostatNight !== undefined) {
                sleepCoolSetPoint = userSettings.summerThermostatNight;
              } else if (comfortSettings?.sleep?.coolSetPoint !== undefined) {
                sleepCoolSetPoint = comfortSettings.sleep.coolSetPoint;
              }
              
              // Get schedule times (for determining which mode is active at different hours)
              // Only use schedule if userSettings doesn't have values
              if ((userSettings?.daytimeStart === undefined || userSettings?.nighttimeStart === undefined) && schedule?.weekly && schedule.weekly[0]) {
                // Use Monday's schedule as representative (or first day with entries)
                const daySchedule = schedule.weekly[0];
                const homeEntry = daySchedule.find(e => e.comfortSetting === "home");
                const sleepEntry = daySchedule.find(e => e.comfortSetting === "sleep");
                
                if (homeEntry?.time && userSettings?.daytimeStart === undefined) {
                  daytimeStartTime = homeEntry.time;
                }
                if (sleepEntry?.time && userSettings?.nighttimeStart === undefined) {
                  nighttimeStartTime = sleepEntry.time;
                }
              }
              
              // Ensure deadbands are maintained for all modes
              if (homeCoolSetPoint < homeHeatSetPoint + deadband) {
                homeCoolSetPoint = homeHeatSetPoint + deadband;
              }
              if (awayCoolSetPoint < awayHeatSetPoint + deadband) {
                awayCoolSetPoint = awayHeatSetPoint + deadband;
              }
              if (sleepCoolSetPoint < sleepHeatSetPoint + deadband) {
                sleepCoolSetPoint = sleepHeatSetPoint + deadband;
              }
            } catch (error) {
              console.warn("Could not load thermostat settings, using defaults:", error);
            }
            
            // Helper function to determine which comfort mode is active at a given hour
            const getComfortModeForHour = (hour, dayOfWeek = 0) => {
              // Convert hour to time string (HH:MM format)
              const timeStr = `${String(hour).padStart(2, '0')}:00`;
              
              try {
                const thermostatSettings = loadThermostatSettings();
                const schedule = thermostatSettings?.schedule;
                
                // If schedule is disabled or not available, default to home during day, sleep at night
                if (!schedule?.enabled || !schedule?.weekly) {
                  // Simple day/night logic
                  const hourNum = hour;
                  if (hourNum >= 6 && hourNum < 22) {
                    return "home";
                  } else {
                    return "sleep";
                  }
                }
                
                // Get schedule for this day of week
                const daySchedule = schedule.weekly[dayOfWeek] || schedule.weekly[0] || [];
                
                // Find the most recent schedule entry before or at current time
                let currentMode = "home"; // Default
                for (const entry of daySchedule) {
                  if (entry.time <= timeStr) {
                    currentMode = entry.comfortSetting;
                  } else {
                    break;
                  }
                }
                
                return currentMode;
              } catch {
                // Fallback: simple day/night logic
                const hourNum = hour;
                if (hourNum >= 6 && hourNum < 22) {
                  return "home";
                } else {
                  return "sleep";
                }
              }
            };
            
            // Helper function to get setpoints for a given comfort mode
            const getSetpointsForMode = (mode) => {
              switch (mode) {
                case "home":
                  return { heat: homeHeatSetPoint, cool: homeCoolSetPoint };
                case "away":
                  return { heat: awayHeatSetPoint, cool: awayCoolSetPoint };
                case "sleep":
                  return { heat: sleepHeatSetPoint, cool: sleepCoolSetPoint };
                default:
                  return { heat: homeHeatSetPoint, cool: homeCoolSetPoint };
              }
            };
            
            // Calculate weighted average indoor temps for heating and cooling
            // Use a representative day to determine average setpoints across all modes
            // For simplicity, we'll use home mode for day hours and sleep mode for night hours
            const avgWinterIndoorTemp = (homeHeatSetPoint * 16 + sleepHeatSetPoint * 8) / 24;
            const winterTempMultiplier = (avgWinterIndoorTemp - 35) / 30;
            
            const avgSummerIndoorTemp = (homeCoolSetPoint * 16 + sleepCoolSetPoint * 8) / 24;
            const summerTempMultiplier = (85 - avgSummerIndoorTemp) / 20;
            
            // Helper function to generate hourly temperatures using sinusoidal pattern
            // Low temp typically occurs around 6 AM, high temp around 6 PM
            const generateHourlyTemps = (dailyLow, dailyHigh, daysInMonth, monthIndex) => {
              const hours = [];
              const tempRange = dailyHigh - dailyLow;
              const avgTemp = (dailyHigh + dailyLow) / 2;
              
              for (let day = 0; day < daysInMonth; day++) {
                for (let hour = 0; hour < 24; hour++) {
                  // Sinusoidal pattern: low at 6 AM (hour 6), high at 6 PM (hour 18)
                  // Phase: ((hour - 6) / 12) * PI gives us low at hour 6, high at hour 18
                  const phase = ((hour - 6) / 12) * Math.PI;
                  const tempOffset = Math.cos(phase - Math.PI) * (tempRange / 2);
                  const hourlyTemp = avgTemp + tempOffset;
                  
                  hours.push({
                    temp: hourlyTemp,
                    humidity: 50,
                    time: new Date(2025, monthIndex, day + 1, hour),
                  });
                }
              }
              return hours;
            };
            
            let annualVariableHeating = 0;
            let annualVariableCooling = 0;
            let annualHeatingCost = 0;
            let annualCoolingCost = 0;
            
            const monthlyHeatingCosts = [];
            const monthlyCoolingCosts = [];
            const monthlyHDDValues = [];
            const monthlyCDDValues = [];
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            
            // Track data source for display
                    let _usesHistoricalHourly = false;
                    let _usesSinusoidalApprox = false;
            
            for (let month = 0; month < 12; month++) {
              // 1. Calculate Load
              const monthHDD = totalTypicalHDD > 0 ? (monthlyHDDDist[month] / totalTypicalHDD) * annualHDD : 0;
              const monthCDD = totalTypicalCDD > 0 ? (monthlyCDDDist[month] / totalTypicalCDD) * annualCDD : 0;
              
              monthlyHDDValues.push(Math.round(monthHDD));
              monthlyCDDValues.push(Math.round(monthCDD));
              
              let monthVariableHeating = 0;
              let monthVariableCooling = 0;
              let monthHeatingCost = 0; // Will include fixed
              let monthCoolingCost = 0; // Will include fixed
              
              // 2. Physics Cost: Heating (variable only)
              if (monthHDD > 0) {
                // Use hourly historical data for aux heat if available (heat pumps only)
                if (primarySystem === "heatPump" && historicalHourly && historicalHourly.length > 0 && balancePoint !== null) {
                  // Filter hours for this month from historical data
                  const monthHours = historicalHourly.filter(hour => {
                    const hourDate = new Date(hour.time);
                    return hourDate.getMonth() === month;
                  });
                  
                  if (monthHours.length > 0) {
                    _usesHistoricalHourly = true;
                    const tonsMap = { 18: 1.5, 24: 2.0, 30: 2.5, 36: 3.0, 42: 3.5, 48: 4.0, 60: 5.0 };
                    const tons = tonsMap[capacity] || 3.0;
                    const estimatedDesignHeatLoss = heatUtils.calculateHeatLoss({
            squareFeet,
            insulationLevel,
            homeShape,
            ceilingHeight,
            wallHeight,
            hasLoft,
          });
                    
                    // Calculate aux heat hour-by-hour
                    let totalHeatPumpKwh = 0;
                    let totalAuxKwh = 0;
                    
                    monthHours.forEach(hour => {
                      const dtHours = 1.0; // 1 hour per timestep
                      
                      // Determine which comfort mode is active for this hour
                      const hourDate = new Date(hour.time);
                      const dayOfWeek = hourDate.getDay();
                      const hourOfDay = hourDate.getHours();
                      const activeMode = getComfortModeForHour(hourOfDay, dayOfWeek);
                      const setpoints = getSetpointsForMode(activeMode);
                      
                      // Auto-mode logic: determine if heating or cooling is needed based on outdoor temp vs setpoints
                      // Like Ecobee auto mode: heating runs when outdoor temp < heatSetPoint, cooling runs when outdoor temp > coolSetPoint
                      const needsHeating = hour.temp < setpoints.heat;
                      const _needsCooling = hour.temp > setpoints.cool;
                      // Between heatSetPoint and coolSetPoint: no HVAC needed (deadband)
                      
                      if (needsHeating) {
                        // Use the appropriate indoor temp for the active mode
                        const indoorTempForMode = activeMode === "sleep" ? sleepHeatSetPoint : 
                                                  activeMode === "away" ? awayHeatSetPoint : 
                                                  homeHeatSetPoint;
                        
                        // Calculate heating energy
                        const perf = heatUtils.computeHourlyPerformance(
                          {
                            tons: tons,
                            indoorTemp: indoorTempForMode,
                            designHeatLossBtuHrAt70F: estimatedDesignHeatLoss,
                            compressorPower: null,
                          },
                          hour.temp,
                          hour.humidity ?? 50,
                          dtHours
                        );
                        
                        // AGGREGATION RULES: Sum energy directly - NEVER multiply by dtHours
                        if (perf.hpKwh !== undefined) {
                          totalHeatPumpKwh += perf.hpKwh;
                        } else {
                          // Fallback for backward compatibility
                          totalHeatPumpKwh += perf.electricalKw * (perf.capacityUtilization / 100) * dtHours;
                        }
                        
                        // Aux heat energy (only when needed)
                        if (useElectricAuxHeat) {
                          if (perf.auxKwh !== undefined && perf.auxKwh > 0) {
                            totalAuxKwh += perf.auxKwh;
                          } else if (perf.auxKw > 0) {
                            // Fallback for backward compatibility
                            totalAuxKwh += perf.auxKw * dtHours;
                          }
                        }
                      }
                      // If cooling is needed, it would be calculated separately (not in this heating-only path)
                      // If neither heating nor cooling needed (in deadband), no energy used
                    });
                    
                    // Scale to full month if we don't have complete data
                    const daysInMonth = new Date(new Date().getFullYear(), month + 1, 0).getDate();
                    const expectedHours = daysInMonth * 24;
                    if (monthHours.length < expectedHours * 0.8) {
                      const scaleFactor = expectedHours / monthHours.length;
                      totalHeatPumpKwh *= scaleFactor;
                      totalAuxKwh *= scaleFactor;
                    }
                    
                    // Calculate costs
                    const totalHeatingKwh = totalHeatPumpKwh + totalAuxKwh;
                    monthVariableHeating = totalHeatingKwh * utilityCost * winterTempMultiplier;
                    monthHeatingCost = monthVariableHeating;
                  } else {
                    // Fallback: Generate hourly temps using sinusoidal pattern
                    _usesSinusoidalApprox = true;
                    const daysInMonth = new Date(new Date().getFullYear(), month + 1, 0).getDate();
                    
                    // Estimate typical daily low/high for this month based on HDD
                    // Typical winter: low around 30-40°F, high around 50-60°F depending on location
                    // Use a simple approximation: if monthHDD is high, it's colder
                    const baseTemp = 50; // Base temperature for the month
                    const tempRange = 20; // Typical 20°F range between low and high
                    const dailyLow = baseTemp - (monthHDD / 30); // Colder months have lower temps
                    const dailyHigh = dailyLow + tempRange;
                    
                    const monthHours = generateHourlyTemps(dailyLow, dailyHigh, daysInMonth, month);
                    
                    if (primarySystem === "heatPump" && balancePoint !== null) {
                      const tonsMap = { 18: 1.5, 24: 2.0, 30: 2.5, 36: 3.0, 42: 3.5, 48: 4.0, 60: 5.0 };
                      const tons = tonsMap[capacity] || 3.0;
                      const estimatedDesignHeatLoss = heatUtils.calculateHeatLoss({
            squareFeet,
            insulationLevel,
            homeShape,
            ceilingHeight,
            wallHeight,
            hasLoft,
          });
                      
                      let totalHeatPumpKwh = 0;
                      let totalAuxKwh = 0;
                      
                      monthHours.forEach(hour => {
                        const dtHours = 1.0;
                        
                        // Determine which comfort mode is active for this hour
                        const hourDate = new Date(hour.time);
                        const dayOfWeek = hourDate.getDay();
                        const hourOfDay = hourDate.getHours();
                        const activeMode = getComfortModeForHour(hourOfDay, dayOfWeek);
                        const setpoints = getSetpointsForMode(activeMode);
                        
                        // Auto-mode logic: determine if heating or cooling is needed based on outdoor temp vs setpoints
                        const needsHeating = hour.temp < setpoints.heat;
                        const _needsCooling = hour.temp > setpoints.cool;
                        // Between heatSetPoint and coolSetPoint: no HVAC needed (deadband)
                        
                        if (needsHeating) {
                          // Use the appropriate indoor temp for the active mode
                          const indoorTempForMode = activeMode === "sleep" ? sleepHeatSetPoint : 
                                                    activeMode === "away" ? awayHeatSetPoint : 
                                                    homeHeatSetPoint;
                          
                          // Calculate heating energy
                          const perf = heatUtils.computeHourlyPerformance(
                            {
                              tons: tons,
                              indoorTemp: indoorTempForMode,
                              designHeatLossBtuHrAt70F: estimatedDesignHeatLoss,
                              compressorPower: null,
                            },
                            hour.temp,
                            hour.humidity ?? 50,
                            dtHours
                          );
                          
                          if (perf.hpKwh !== undefined) {
                            totalHeatPumpKwh += perf.hpKwh;
                          } else {
                            totalHeatPumpKwh += perf.electricalKw * (perf.capacityUtilization / 100) * dtHours;
                          }
                          
                          // Aux heat energy (only when needed) - nighttime is colder, so aux is more likely
                          if (useElectricAuxHeat) {
                            if (perf.auxKwh !== undefined && perf.auxKwh > 0) {
                              totalAuxKwh += perf.auxKwh;
                            } else if (perf.auxKw > 0) {
                              totalAuxKwh += perf.auxKw * dtHours;
                            }
                          }
                        }
                        // If cooling is needed, it would be calculated separately (not in this heating-only path)
                        // If neither heating nor cooling needed (in deadband), no energy used
                      });
                      
                      const totalHeatingKwh = totalHeatPumpKwh + totalAuxKwh;
                      monthVariableHeating = totalHeatingKwh * utilityCost * winterTempMultiplier;
                      monthHeatingCost = monthVariableHeating;
                    } else {
                      // Standard HDD-based estimate for non-heat-pump systems
                      const est = estimateMonthlyHeatingCostFromHDD({
                        hdd: monthHDD,
                        squareFeet,
                        insulationLevel,
                        homeShape,
                        ceilingHeight,
                        hspf: hspf2,
                        electricityRate: utilityCost,
                      });
                      if (est?.cost > 0) {
                        monthVariableHeating = est.cost * winterTempMultiplier;
                        monthHeatingCost = monthVariableHeating;
                      }
                    }
                  }
                } else {
                  // Standard HDD-based estimate (non-heat-pump or no historical data)
                  const est = estimateMonthlyHeatingCostFromHDD({
                    hdd: monthHDD,
                    squareFeet,
                    insulationLevel,
                    homeShape,
                    ceilingHeight,
                    hspf: hspf2,
                    electricityRate: utilityCost,
                  });
                  if (est?.cost > 0) {
                    monthVariableHeating = est.cost * winterTempMultiplier;
                    monthHeatingCost = monthVariableHeating;
                  }
                }
              }
              
              
              // 3. Physics Cost: Cooling (variable only)
              if (monthCDD > 0) {
                const est = estimateMonthlyCoolingCostFromCDD({
                  cdd: monthCDD,
                  squareFeet,
                  insulationLevel,
                  homeShape,
                  ceilingHeight,
                  seer2: efficiency,
                  electricityRate: utilityCost,
                  capacity: coolingCapacity || capacity,
                  solarExposure,
                });
                if (est?.cost > 0) {
                  monthVariableCooling = est.cost * summerTempMultiplier;
                  monthCoolingCost = monthVariableCooling;
                }
              }

              // C. Apply Fixed Costs (Crucial Step)
              // If Gas Furnace: Always add gas fixed cost to heating bucket
              if (isGasHeat) {
                monthHeatingCost += safeFixedGas;
              }
              
              // Electric Fixed Cost: Assign to the "dominant" fuel/mode for that month for display
              const isCoolingSeason = [4, 5, 6, 7, 8, 9].includes(month); // May-Oct
              if (monthCoolingCost > monthHeatingCost) {
                monthCoolingCost += safeFixedElectric;
              } else if (monthHeatingCost > monthCoolingCost) {
                monthHeatingCost += safeFixedElectric;
              } else {
                // If equal (e.g. 0 vs 0), assign based on season
                if (isCoolingSeason) monthCoolingCost += safeFixedElectric;
                else monthHeatingCost += safeFixedElectric;
              }
              
              // D. Accumulate
              annualVariableHeating += monthVariableHeating;
              annualVariableCooling += monthVariableCooling;
              annualHeatingCost += monthHeatingCost;
              annualCoolingCost += monthCoolingCost;

              // E. Push to Arrays (with fixed costs included for display)
              monthlyHeatingCosts.push(monthHeatingCost);
              monthlyCoolingCosts.push(monthCoolingCost);
            }
            
            const annualFixedOnly = (safeFixedElectric * 12) + (isGasHeat ? safeFixedGas * 12 : 0);
            const totalAnnualCost = annualVariableHeating + annualVariableCooling + annualFixedOnly;
            
            // Store annual cost data in ref (will be set to state via useEffect)
            annualCostDataRef.current = {
              totalAnnualCost,
              annualHeatingCost,
              annualCoolingCost,
              annualFixedOnly,
            };
            
            return (
              <>
                {/* Summary Boxes */}
                <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                  <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
                    <p className="font-semibold text-blue-700 dark:text-blue-300">
                      Annual Heating (energy only)
                    </p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      ${annualVariableHeating.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      {Math.round(annualHDD)} HDD
                    </p>
                  </div>
                  <div className="bg-cyan-50 dark:bg-cyan-900/30 rounded-lg p-3">
                    <p className="font-semibold text-cyan-700 dark:text-cyan-300">
                      Annual Cooling (energy only)
                    </p>
                    <p className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
                      ${annualVariableCooling.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      {Math.round(annualCDD)} CDD
                    </p>
                  </div>
                </div>
                
                {annualFixedOnly > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-3 mb-4">
                    <p className="font-semibold text-gray-700 dark:text-gray-300">
                      Annual Fixed Charges
                    </p>
                    <p className="text-lg font-bold text-gray-600 dark:text-gray-400">
                      ${annualFixedOnly.toFixed(2)}
                    </p>
                  </div>
                )}
                  
                {/* Monthly Breakdown - Collapsible Dropdown */}
                <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <button
                    onClick={() => setShowMonthlyBreakdown(!showMonthlyBreakdown)}
                    className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                        <BarChart2 size={24} className="text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">Monthly Breakdown</h3>
                    </div>
                    {showMonthlyBreakdown ? (
                      <ChevronUp className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    ) : (
                      <ChevronDown className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    )}
                  </button>
                  {showMonthlyBreakdown && (
                  <div className="p-6 pt-0 space-y-4 border-t border-gray-200 dark:border-gray-700">
                  
                  {/* Combined Monthly Costs - Shows total cost per month, highlighting months with both heating and cooling */}
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-indigo-200 dark:border-indigo-800">
                    <p className="font-semibold text-indigo-700 dark:text-indigo-300 mb-3">Total Monthly Costs (Heating + Cooling)</p>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-3">
                      Some months require both heating and cooling depending on daily temperatures. This shows the combined cost for each month.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                      {monthNames.map((monthName, idx) => {
                        const heatingCost = monthlyHeatingCosts[idx];
                        const coolingCost = monthlyCoolingCosts[idx];
                        const totalCost = heatingCost + coolingCost;
                        const hasBoth = heatingCost > 0 && coolingCost > 0;
                        const hdd = monthlyHDDValues[idx];
                        const cdd = monthlyCDDValues[idx];
                        const percent = totalAnnualCost > 0 ? (totalCost / totalAnnualCost) * 100 : 0;
                        
                        return (
                          <div 
                            key={idx} 
                            className={`bg-white dark:bg-gray-800 rounded p-2 border-2 ${
                              hasBoth 
                                ? 'border-purple-400 dark:border-purple-600' 
                                : 'border-indigo-200 dark:border-indigo-800'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-semibold text-xs text-indigo-600 dark:text-indigo-400">{monthName}</p>
                              {hasBoth && (
                                <span className="text-[10px] bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded">
                                  Both
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">${totalCost.toFixed(2)}</p>
                            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5 mt-1">
                              {heatingCost > 0 && (
                                <p className="text-blue-600 dark:text-blue-400">
                                  🔥 ${heatingCost.toFixed(2)} ({hdd} HDD)
                                </p>
                              )}
                              {coolingCost > 0 && (
                                <p className="text-cyan-600 dark:text-cyan-400">
                                  ❄️ ${coolingCost.toFixed(2)} ({cdd} CDD)
                                </p>
                              )}
                              {totalCost > 0 && (
                                <p className="text-gray-500 dark:text-gray-400 mt-1">
                                  {percent.toFixed(1)}% of annual
                                </p>
                              )}
                              {totalCost === 0 && (
                                <p className="text-gray-400 dark:text-gray-500 italic">No HVAC needed</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Heating Months */}
                  {annualHeatingCost > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                      <p className="font-semibold text-blue-700 dark:text-blue-300 mb-3">Heating Costs by Month</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {monthNames.map((monthName, idx) => {
                          const cost = monthlyHeatingCosts[idx];
                          const hdd = monthlyHDDValues[idx];
                          const percent = annualHeatingCost > 0 ? (cost / annualHeatingCost) * 100 : 0;
                          return (
                            <div key={idx} className="bg-white dark:bg-gray-800 rounded p-2 border border-blue-200 dark:border-blue-800">
                              <p className="font-semibold text-xs text-blue-600 dark:text-blue-400">{monthName}</p>
                              <p className="text-sm font-bold text-blue-700 dark:text-blue-300">${cost.toFixed(2)}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{hdd} HDD</p>
                              {cost > 0 && <p className="text-xs text-gray-500 dark:text-gray-400">{percent.toFixed(1)}%</p>}
                              {cost === 0 && hdd === 0 && <p className="text-xs text-gray-400 dark:text-gray-500 italic">No heating needed</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Cooling Months */}
                  {annualCoolingCost > 0 && (
                    <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-4">
                      <p className="font-semibold text-cyan-700 dark:text-cyan-300 mb-3">Cooling Costs by Month</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {monthNames.map((monthName, idx) => {
                          const cost = monthlyCoolingCosts[idx];
                          const cdd = monthlyCDDValues[idx];
                          const percent = annualCoolingCost > 0 ? (cost / annualCoolingCost) * 100 : 0;
                          return (
                            <div key={idx} className="bg-white dark:bg-gray-800 rounded p-2 border border-cyan-200 dark:border-cyan-800">
                              <p className="font-semibold text-xs text-cyan-600 dark:text-cyan-400">{monthName}</p>
                              <p className="text-sm font-bold text-cyan-700 dark:text-cyan-300">${cost.toFixed(2)}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{cdd} CDD</p>
                              {cost > 0 && <p className="text-xs text-gray-500 dark:text-gray-400">{percent.toFixed(1)}%</p>}
                              {cost === 0 && cdd === 0 && <p className="text-xs text-gray-400 dark:text-gray-500 italic">No cooling needed</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  </div>
                  )}
                </div>
                
                {/* Annual Temperature Profiles - Collapsible Dropdown */}
                <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <button
                    onClick={() => setShowTemperatureProfiles(!showTemperatureProfiles)}
                    className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg">
                        <Thermometer size={24} className="text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">Annual Temperature Profiles</h3>
                    </div>
                    {showTemperatureProfiles ? (
                      <ChevronUp className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    ) : (
                      <ChevronDown className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    )}
                  </button>
                  {showTemperatureProfiles && (
                  <div className="p-6 pt-0 space-y-6 border-t border-gray-200 dark:border-gray-700">
                  
                  {/* Winter Months Graph */}
                  {annualHeatingCost > 0 && (() => {
                    // Include all months that have heating needs (HDD > 0), including transition months
                    const activeWinterMonths = monthNames.map((_, idx) => idx).filter(m => monthlyHDDValues[m] > 0);
                    
                    // Create data structure: one row per hour, with columns for each month
                    const winterGraphData = [];
                    for (let hour = 0; hour < 24; hour++) {
                      const hourData = {
                        hour: hour,
                        hourLabel: hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`,
                      };
                      
                      activeWinterMonths.forEach(monthIdx => {
                        const monthHDD = totalTypicalHDD > 0 ? (monthlyHDDDist[monthIdx] / totalTypicalHDD) * annualHDD : 0;
                        if (monthHDD > 0) {
                          // Estimate typical daily low/high for this month
                          const baseTemp = 50;
                          const tempRange = 20;
                          const dailyLow = baseTemp - (monthHDD / 30);
                          const dailyHigh = dailyLow + tempRange;
                          const avgTemp = (dailyHigh + dailyLow) / 2;
                          const tempRangeValue = dailyHigh - dailyLow;
                          
                          // Calculate hourly temperature using sinusoidal pattern
                          const phase = ((hour - 6) / 12) * Math.PI;
                          const tempOffset = Math.cos(phase - Math.PI) * (tempRangeValue / 2);
                          const hourlyTemp = avgTemp + tempOffset;
                          
                          hourData[monthNames[monthIdx]] = Math.round(hourlyTemp * 10) / 10;
                        }
                      });
                      
                      winterGraphData.push(hourData);
                    }
                    
                    return (
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                        <h5 className="font-semibold text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-2">
                          <Thermometer className="w-5 h-5" />
                          Winter Temperature Profile (Heating Season)
                        </h5>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
                          Hourly temperature patterns for months with heating needs. 
                          Shows how nighttime temperatures drop significantly, requiring more heating and potentially aux heat for heat pumps. 
                          Transition months (like April, May, September, October) may also require cooling during warmer days.
                        </p>
                        <div className="w-full" style={{ height: '400px', minHeight: '400px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={winterGraphData} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis 
                                dataKey="hour" 
                                label={{ value: 'Hour of Day', position: 'insideBottom', offset: -5 }}
                                stroke="#6b7280"
                                tick={{ fontSize: 10 }}
                                tickFormatter={(value) => {
                                  if (value === 0) return '12 AM';
                                  if (value < 12) return `${value} AM`;
                                  if (value === 12) return '12 PM';
                                  return `${value - 12} PM`;
                                }}
                              />
                              <YAxis 
                                label={{ value: 'Temperature (°F)', angle: -90, position: 'insideLeft' }}
                                stroke="#6b7280"
                                tick={{ fontSize: 10 }}
                              />
                              <Tooltip 
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                      <div className="bg-white dark:bg-gray-800 p-2 border border-gray-200 dark:border-gray-700 rounded shadow-lg">
                                        <p className="text-xs font-semibold">{data.hourLabel}</p>
                                        {payload.map((entry, idx) => (
                                          <p key={idx} className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                            {entry.name}: {entry.value?.toFixed(1)}°F
                                          </p>
                                        ))}
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Legend />
                              {activeWinterMonths.map((monthIdx, idx) => (
                                <Line
                                  key={monthIdx}
                                  type="monotone"
                                  dataKey={monthNames[monthIdx]}
                                  name={monthNames[monthIdx]}
                                  stroke={idx === 0 ? "#3b82f6" : idx === 1 ? "#2563eb" : idx === 2 ? "#1d4ed8" : idx === 3 ? "#1e40af" : idx === 4 ? "#1e3a8a" : "#1e3a8a"}
                                  strokeWidth={2}
                                  dot={false}
                                  connectNulls
                                />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* Summer Months Graph */}
                  {annualCoolingCost > 0 && (() => {
                    // Include all months that have cooling needs (CDD > 0), including transition months
                    const activeSummerMonths = monthNames.map((_, idx) => idx).filter(m => monthlyCDDValues[m] > 0);
                    
                    // Create data structure: one row per hour, with columns for each month
                    const summerGraphData = [];
                    for (let hour = 0; hour < 24; hour++) {
                      const hourData = {
                        hour: hour,
                        hourLabel: hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`,
                      };
                      
                      activeSummerMonths.forEach(monthIdx => {
                        const monthCDD = totalTypicalCDD > 0 ? (monthlyCDDDist[monthIdx] / totalTypicalCDD) * annualCDD : 0;
                        if (monthCDD > 0) {
                          // Estimate typical daily low/high for this month
                          // Typical summer: low around 60-70°F, high around 80-90°F
                          const baseTemp = 75;
                          const tempRange = 20;
                          const dailyLow = baseTemp - (monthCDD / 20); // Warmer months have higher temps
                          const dailyHigh = dailyLow + tempRange;
                          const avgTemp = (dailyHigh + dailyLow) / 2;
                          const tempRangeValue = dailyHigh - dailyLow;
                          
                          // Calculate hourly temperature using sinusoidal pattern
                          const phase = ((hour - 6) / 12) * Math.PI;
                          const tempOffset = Math.cos(phase - Math.PI) * (tempRangeValue / 2);
                          const hourlyTemp = avgTemp + tempOffset;
                          
                          hourData[monthNames[monthIdx]] = Math.round(hourlyTemp * 10) / 10;
                        }
                      });
                      
                      summerGraphData.push(hourData);
                    }
                    
                    return (
                      <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-4 border border-cyan-200 dark:border-cyan-800">
                        <h5 className="font-semibold text-cyan-700 dark:text-cyan-300 mb-3 flex items-center gap-2">
                          <Thermometer className="w-5 h-5" />
                          Summer Temperature Profile (Cooling Season)
                        </h5>
                        <p className="text-xs text-cyan-600 dark:text-cyan-400 mb-3">
                          Hourly temperature patterns for months with cooling needs. 
                          Shows how daytime temperatures peak in the afternoon, requiring more cooling during peak hours. 
                          Transition months (like April, May, September, October) may also require heating during cooler nights.
                        </p>
                        <div className="w-full" style={{ height: '400px', minHeight: '400px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={summerGraphData} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis 
                                dataKey="hour" 
                                label={{ value: 'Hour of Day', position: 'insideBottom', offset: -5 }}
                                stroke="#6b7280"
                                tick={{ fontSize: 10 }}
                                tickFormatter={(value) => {
                                  if (value === 0) return '12 AM';
                                  if (value < 12) return `${value} AM`;
                                  if (value === 12) return '12 PM';
                                  return `${value - 12} PM`;
                                }}
                              />
                              <YAxis 
                                label={{ value: 'Temperature (°F)', angle: -90, position: 'insideLeft' }}
                                stroke="#6b7280"
                                tick={{ fontSize: 10 }}
                              />
                              <Tooltip 
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                      <div className="bg-white dark:bg-gray-800 p-2 border border-gray-200 dark:border-gray-700 rounded shadow-lg">
                                        <p className="text-xs font-semibold">{data.hourLabel}</p>
                                        {payload.map((entry, idx) => (
                                          <p key={idx} className="text-sm font-bold text-cyan-600 dark:text-cyan-400">
                                            {entry.name}: {entry.value?.toFixed(1)}°F
                                          </p>
                                        ))}
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Legend />
                              {activeSummerMonths.map((monthIdx, idx) => (
                                <Line
                                  key={monthIdx}
                                  type="monotone"
                                  dataKey={monthNames[monthIdx]}
                                  name={monthNames[monthIdx]}
                                  stroke={idx === 0 ? "#06b6d4" : idx === 1 ? "#0891b2" : idx === 2 ? "#0e7490" : idx === 3 ? "#155e75" : idx === 4 ? "#164e63" : "#164e63"}
                                  strokeWidth={2}
                                  dot={false}
                                  connectNulls
                                />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    );
                  })()}
                  </div>
                  )}
                </div>
                
                {/* Show me the math section for Annual Mode */}
                <details className="mt-8 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-200 dark:border-gray-700">
                  <summary className="p-4 cursor-pointer text-lg font-semibold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg flex items-center gap-2">
                    <span>📐</span> Show me the math (Annual Forecast)
                  </summary>
                  <div className="p-4 pt-0 space-y-6">
                    
                    {/* Building Characteristics */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">Building Characteristics</h4>
                      <div className="bg-white dark:bg-gray-800 rounded p-3 text-xs space-y-2">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          📊 {hlfSource === 'manual' ? 'Using Manual Entry' : hlfSource === 'analyzer' ? 'Using CSV Analyzer Data' : hlfSource === 'learned' ? 'Using Bill Data (Auto-learned)' : 'Using Calculated (DOE Data)'}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Square Feet:</span>
                              <span className="font-bold">{squareFeet.toLocaleString()} sq ft</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Insulation Level:</span>
                              <span className="font-bold">{insulationLevel.toFixed(2)}x</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Home Shape Factor:</span>
                              <span className="font-bold">{homeShape.toFixed(2)}x</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Ceiling Height:</span>
                              <span className="font-bold">{ceilingHeight} ft</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Design Heat Loss @ 70°F ΔT:</span>
                              <span className="font-bold">{(getEffectiveHeatLossFactor * 70 / 1000).toFixed(1)}k BTU/hr</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">BTU Loss per °F:</span>
                              <span className="font-bold">{getEffectiveHeatLossFactor.toFixed(1)} BTU/hr/°F</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* System Configuration */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">System Configuration</h4>
                      <div className="bg-white dark:bg-gray-800 rounded p-3 text-xs space-y-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Primary System:</span>
                              <span className="font-bold">{primarySystem === "heatPump" ? "Heat Pump" : primarySystem === "acPlusGas" ? "Central AC + Gas" : primarySystem === "gasFurnace" ? "Gas Furnace" : "Resistance"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Capacity:</span>
                              <span className="font-bold">{capacity}k BTU</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">HSPF2:</span>
                              <span className="font-bold">{hspf2}</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">SEER2:</span>
                              <span className="font-bold">{efficiency}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Electricity Rate:</span>
                              <span className="font-bold">${utilityCost.toFixed(3)} / kWh</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Temperature Settings */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">Temperature Settings</h4>
                      <div className="bg-white dark:bg-gray-800 rounded p-3 text-xs space-y-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Heat Set Point (Day):</span>
                              <span className="font-bold">{homeHeatSetPoint}°F</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Heat Set Point (Night):</span>
                              <span className="font-bold">{sleepHeatSetPoint}°F</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Cool Set Point (Day):</span>
                              <span className="font-bold">{homeCoolSetPoint}°F</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Cool Set Point (Night):</span>
                              <span className="font-bold">{sleepCoolSetPoint}°F</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Schedule:</span>
                            <span className="font-bold">{daytimeStartTime}–{nighttimeStartTime} (Home) • {nighttimeStartTime}–{daytimeStartTime} (Sleep)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Annual Summary */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">📊 Annual Summary</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-lg p-3 text-center border border-green-200 dark:border-green-800">
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">${totalAnnualCost.toFixed(0)}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Total Annual</div>
                        </div>
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg p-3 text-center border border-blue-200 dark:border-blue-800">
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">${annualVariableHeating.toFixed(0)}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Heating</div>
                        </div>
                        <div className="bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-900/30 dark:to-teal-900/30 rounded-lg p-3 text-center border border-cyan-200 dark:border-cyan-800">
                          <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">${annualVariableCooling.toFixed(0)}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Cooling</div>
                        </div>
                        <div className="bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/30 dark:to-slate-900/30 rounded-lg p-3 text-center border border-gray-200 dark:border-gray-600">
                          <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">${annualFixedOnly.toFixed(0)}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Fixed Fees</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Degree Days Analysis */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">🌡️ Degree Days Analysis</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{Math.round(annualHDD)} HDD</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Annual Heating Degree Days</div>
                          <div className="text-xs text-gray-400 mt-1">Base 65°F</div>
                        </div>
                        <div className="bg-cyan-50 dark:bg-cyan-900/30 rounded-lg p-3 border border-cyan-200 dark:border-cyan-800">
                          <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">{Math.round(annualCDD)} CDD</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Annual Cooling Degree Days</div>
                          <div className="text-xs text-gray-400 mt-1">Base 65°F</div>
                        </div>
                      </div>
                      <div className="mt-3 bg-white dark:bg-gray-800 rounded p-3 text-xs">
                        <div className="flex justify-between mb-2">
                          <span className="text-gray-600 dark:text-gray-400">Cost per HDD:</span>
                          <span className="font-bold">${annualHDD > 0 ? (annualVariableHeating / annualHDD).toFixed(3) : "0"}/HDD</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Cost per CDD:</span>
                          <span className="font-bold">${annualCDD > 0 ? (annualVariableCooling / annualCDD).toFixed(3) : "0"}/CDD</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Peak Months */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">🔥 Peak Cost Months</h4>
                      <div className="space-y-2">
                        {(() => {
                          const monthData = monthNames.map((name, idx) => ({
                            name,
                            heating: monthlyHeatingCosts[idx],
                            cooling: monthlyCoolingCosts[idx],
                            total: monthlyHeatingCosts[idx] + monthlyCoolingCosts[idx],
                            hdd: monthlyHDDValues[idx],
                            cdd: monthlyCDDValues[idx],
                          }));
                          
                          return monthData
                            .sort((a, b) => b.total - a.total)
                            .slice(0, 3)
                            .map((month, idx) => (
                              <div key={month.name} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-3">
                                  <span className="text-lg">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}</span>
                                  <div>
                                    <div className="font-medium text-gray-900 dark:text-white">{month.name}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {month.hdd > 0 && `${month.hdd} HDD`}
                                      {month.hdd > 0 && month.cdd > 0 && " • "}
                                      {month.cdd > 0 && `${month.cdd} CDD`}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-green-600 dark:text-green-400">${month.total.toFixed(2)}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {month.heating > 0 && <span className="text-blue-500">🔥${month.heating.toFixed(0)}</span>}
                                    {month.heating > 0 && month.cooling > 0 && " "}
                                    {month.cooling > 0 && <span className="text-cyan-500">❄️${month.cooling.toFixed(0)}</span>}
                                  </div>
                                </div>
                              </div>
                            ));
                        })()}
                      </div>
                    </div>
                    
                    {/* Seasonal Breakdown */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">📅 Seasonal Breakdown</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {(() => {
                          const seasons = [
                            { name: "Winter", months: [11, 0, 1], emoji: "❄️" }, // Dec, Jan, Feb
                            { name: "Spring", months: [2, 3, 4], emoji: "🌸" }, // Mar, Apr, May
                            { name: "Summer", months: [5, 6, 7], emoji: "☀️" }, // Jun, Jul, Aug
                            { name: "Fall", months: [8, 9, 10], emoji: "🍂" }, // Sep, Oct, Nov
                          ];
                          
                          return seasons.map(season => {
                            const heating = season.months.reduce((sum, m) => sum + monthlyHeatingCosts[m], 0);
                            const cooling = season.months.reduce((sum, m) => sum + monthlyCoolingCosts[m], 0);
                            const total = heating + cooling;
                            
                            return (
                              <div key={season.name} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-center">
                                <div className="text-lg mb-1">{season.emoji}</div>
                                <div className="font-semibold text-gray-900 dark:text-white text-sm">{season.name}</div>
                                <div className="text-lg font-bold text-green-600 dark:text-green-400">${total.toFixed(0)}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {heating > 0 && <span className="text-blue-500">H:${heating.toFixed(0)}</span>}
                                  {heating > 0 && cooling > 0 && " "}
                                  {cooling > 0 && <span className="text-cyan-500">C:${cooling.toFixed(0)}</span>}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                    
                    {/* Rate Sensitivity */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">💡 Electricity Rate Sensitivity (±20%)</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3 text-center border border-green-200 dark:border-green-800">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">At ${(utilityCost * 0.8).toFixed(3)}/kWh (-20%)</div>
                          <div className="text-xl font-bold text-green-600 dark:text-green-400">
                            ${((annualVariableHeating + annualVariableCooling) * 0.8 + annualFixedOnly).toFixed(0)}
                          </div>
                          <div className="text-xs text-green-600 dark:text-green-400">
                            Save ${((annualVariableHeating + annualVariableCooling) * 0.2).toFixed(0)}/year
                          </div>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 text-center border border-blue-200 dark:border-blue-800">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current Rate ${utilityCost.toFixed(3)}/kWh</div>
                          <div className="text-xl font-bold text-gray-700 dark:text-gray-300">${totalAnnualCost.toFixed(0)}</div>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-3 text-center border border-red-200 dark:border-red-800">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">At ${(utilityCost * 1.2).toFixed(3)}/kWh (+20%)</div>
                          <div className="text-xl font-bold text-red-600 dark:text-red-400">
                            ${((annualVariableHeating + annualVariableCooling) * 1.2 + annualFixedOnly).toFixed(0)}
                          </div>
                          <div className="text-xs text-red-600 dark:text-red-400">
                            +${((annualVariableHeating + annualVariableCooling) * 0.2).toFixed(0)}/year
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Monthly Average */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">📈 Monthly Averages</h4>
                      <div className="bg-white dark:bg-gray-800 rounded p-3 text-sm space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Average Monthly Total:</span>
                          <span className="font-bold">${(totalAnnualCost / 12).toFixed(2)}/month</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Average Monthly Heating:</span>
                          <span className="font-bold text-blue-600 dark:text-blue-400">${(annualVariableHeating / 12).toFixed(2)}/month</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Average Monthly Cooling:</span>
                          <span className="font-bold text-cyan-600 dark:text-cyan-400">${(annualVariableCooling / 12).toFixed(2)}/month</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                          <span className="text-gray-600 dark:text-gray-400">Fixed Fees per Month:</span>
                          <span className="font-bold">${(annualFixedOnly / 12).toFixed(2)}/month</span>
                        </div>
                      </div>
                    </div>
                    
                  </div>
                </details>
                
              </>
            );
          })()}
        </div>
      )}

      {/* Annual Budget Planner - Enhanced Section */}
      {/* Year-Ahead Budget Planning - Removed for simplified design */}
      {/* eslint-disable-next-line no-constant-binary-expression -- intentionally dead code for future use */}
      {false && mode === "budget" && locationData && (
        <div className="mt-16 pt-10 border-t-2 border-gray-300/30 dark:border-gray-700/30">
          <div className="glass-card p-5 mb-4 animate-fade-in-up border-indigo-500/40 bg-indigo-50/10 dark:bg-indigo-950/10 rounded-xl">
            {/* Collapsible Header */}
            <button
              onClick={() => setShowAnnualPlanner(!showAnnualPlanner)}
              className="w-full flex items-center justify-between p-6 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 rounded-lg transition-colors"
            >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📅</span>
                <h2 className="text-2xl font-bold text-high-contrast">
                  Year-Ahead Budget Planning
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted hidden sm:block">
                {showAnnualPlanner ? "Hide" : "Show"} yearly forecast
              </p>
              {showAnnualPlanner ? (
                <ChevronUp className="w-5 h-5 text-indigo-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-indigo-500" />
              )}
            </div>
            </button>

            {/* Collapsible Content */}
            {showAnnualPlanner && (
              <div className="px-4 pb-4 space-y-3 animate-fade-in border-t border-indigo-200/50 dark:border-indigo-800/50 pt-3">
              
              {/* Winter Heating Plan Subsection */}
              <div>
                <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-2">
                  <Thermometer size={18} />
                  Winter heating plan
                </h3>
                {(() => {
                  const winterDay = userSettings?.winterThermostatDay ?? 70;
                  const winterNight = userSettings?.winterThermostatNight ?? 68;
                  const setback = Math.abs(winterDay - winterNight);
                  const timeToHours = (timeStr) => {
                    const [hours, minutes] = timeStr.split(":").map(Number);
                    return hours + minutes / 60;
                  };
                  const dayStart = timeToHours(winterDayTime);
                  const nightStart = timeToHours(winterNightTime);
                  let setbackHours = 0;
                  if (dayStart < nightStart) {
                    setbackHours = 24 - (nightStart - dayStart);
                  } else {
                    setbackHours = dayStart - nightStart;
                  }
                  return (
                    <div className="mb-3 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200/50 dark:border-blue-800/50">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        <span className="font-semibold">Winter:</span> {winterDay}°F day / {winterNight}°F night
                        {setback > 0 && ` • ${setback}°F setback`}
                        {setbackHours > 0 && ` • ${Math.round(setbackHours)} hours setback`}
                      </p>
                    </div>
                  );
                })()}
                <div className="glass-card p-glass border-blue-500/30">
                  <ThermostatScheduleCard
                indoorTemp={userSettings?.winterThermostatDay ?? 70}
                daytimeTime={winterDayTime}
                nighttimeTime={winterNightTime}
                nighttimeTemp={userSettings?.winterThermostatNight ?? 68}
                onDaytimeTimeChange={setWinterDayTime}
                onNighttimeTimeChange={setWinterNightTime}
                onNighttimeTempChange={(temp) => {
                  setUserSetting?.("winterThermostatNight", temp);
                }}
                onIndoorTempChange={(temp) => {
                  setUserSetting?.("winterThermostatDay", temp);
                }}
                setUserSetting={setUserSetting}
                daytimeSettingKey="winterThermostatDay"
                    skipComfortSettingsUpdate={true}
                  />
                </div>
              </div>

              {/* Summer Cooling Plan Subsection */}
              <div>
                <h3 className="text-lg font-semibold text-cyan-700 dark:text-cyan-300 mb-3 flex items-center gap-2">
                  <Thermometer size={18} />
                  Summer cooling plan
                </h3>
                {(() => {
                  const summerDay = userSettings?.summerThermostat ?? 76;
                  const summerNight = userSettings?.summerThermostatNight ?? 78;
                  const setback = Math.abs(summerDay - summerNight);
                  const timeToHours = (timeStr) => {
                    const [hours, minutes] = timeStr.split(":").map(Number);
                    return hours + minutes / 60;
                  };
                  const dayStart = timeToHours(summerDayTime);
                  const nightStart = timeToHours(summerNightTime);
                  let setbackHours = 0;
                  if (dayStart < nightStart) {
                    setbackHours = 24 - (nightStart - dayStart);
                  } else {
                    setbackHours = dayStart - nightStart;
                  }
                  return (
                    <div className="mb-3 px-3 py-2 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200/50 dark:border-cyan-800/50">
                      <p className="text-sm font-medium text-cyan-900 dark:text-cyan-100">
                        <span className="font-semibold">Summer:</span> {summerDay}°F day / {summerNight}°F night
                        {setback > 0 && ` • ${setback}°F setback`}
                        {setbackHours > 0 && ` • ${Math.round(setbackHours)} hours setback`}
                      </p>
                    </div>
                  );
                })()}
                <div className="glass-card p-glass border-cyan-500/30">
                  <ThermostatScheduleCard
                indoorTemp={userSettings?.summerThermostat ?? 76}
                daytimeTime={summerDayTime}
                nighttimeTime={summerNightTime}
                nighttimeTemp={userSettings?.summerThermostatNight ?? 78}
                onDaytimeTimeChange={setSummerDayTime}
                onNighttimeTimeChange={setSummerNightTime}
                onNighttimeTempChange={(temp) => {
                  setUserSetting?.("summerThermostatNight", temp);
                }}
                onIndoorTempChange={(temp) => {
                  setUserSetting?.("summerThermostat", temp);
                }}
                setUserSetting={setUserSetting}
                daytimeSettingKey="summerThermostat"
                    skipComfortSettingsUpdate={true}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-4">
                    Setting nighttime temp higher than daytime can save energy
                    while you sleep
                  </p>
                </div>
              </div>
              
              {/* ASHRAE Standards Button */}
              <div className="flex flex-col items-center gap-3">
                <button
              onClick={() => {
                // ASHRAE Standard 55 recommendations (50% RH):
                // Winter heating: 68.5-74.5°F (use 70°F as middle) for day, 68°F for night
                // Summer cooling: 73-79°F (use 76°F as middle) for day, 78°F for night
                if (setUserSetting) {
                  setUserSetting("winterThermostatDay", 70); // ASHRAE Standard 55: 70°F for winter (middle of 68.5-74.5°F range)
                  setUserSetting("winterThermostatNight", 68); // ASHRAE Standard 55: 68°F for sleep/unoccupied in winter
                  setUserSetting("summerThermostat", 76); // ASHRAE Standard 55: 76°F for summer (middle of 73-79°F range)
                  setUserSetting("summerThermostatNight", 78); // ASHRAE Standard 55: 78°F for sleep/unoccupied in summer
                }
              }}
              className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-bold hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 text-sm ring-2 ring-indigo-400/50"
                  title="Apply ASHRAE Standard 55 thermal comfort recommendations"
                >
                  <CheckCircle2 size={18} />
                  Apply schedule to thermostat
                </button>
                <a
              href="https://www.ashrae.org/technical-resources/standards-and-guidelines"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              title="Learn more about ASHRAE standards"
            >
                  Learn more
                </a>
                <p className="text-xs text-center text-gray-500 dark:text-gray-400 max-w-2xl">
                  ASHRAE Standard 55 provides thermal comfort recommendations: 70°F day / 68°F night (winter) and 76°F day / 78°F night (summer) for occupied spaces at 50% relative humidity. Values are pre-filled from your Comfort Settings when available.
                </p>
              </div>

              {/* Annual Cost Estimate */}
              <div className="glass-card p-glass border-indigo-500/30">
                <h3 className="heading-tertiary mb-4 text-center">
                  Estimated Annual HVAC Cost
                </h3>
                <div className="text-center">
                  <div className="text-5xl font-black text-indigo-600 dark:text-indigo-400 mb-4">
                $
                {(() => {
                  // Calculate annual costs using ALL 12 months for accuracy
                  const annualHDD = getAnnualHDD(locationData.city, locationData.state);
                  const annualCDD = getAnnualCDD(locationData.city, locationData.state);
                  
                  // Get typical monthly HDD/CDD distribution (these sum to typical annual values)
                  const monthlyHDDDist = [1200, 1000, 600, 200, 50, 10, 0, 0, 20, 200, 500, 1100]; // Jan-Dec
                  const monthlyCDDDist = [0, 0, 10, 60, 150, 300, 450, 400, 250, 100, 10, 0]; // Jan-Dec
                  
                  const totalTypicalHDD = monthlyHDDDist.reduce((a, b) => a + b, 0); 
                  const totalTypicalCDD = monthlyCDDDist.reduce((a, b) => a + b, 0); 
                  
                  // Account for indoor temperature settings (weighted average of day/night)
                  const winterDayTemp = userSettings?.winterThermostatDay ?? 70;
                  const winterNightTemp = userSettings?.winterThermostatNight ?? 68;
                  const avgWinterIndoorTemp = (winterDayTemp * 16 + winterNightTemp * 8) / 24;
                  
                  const summerDayTemp = userSettings?.summerThermostat ?? 76;
                  const summerNightTemp = userSettings?.summerThermostatNight ?? 78;
                  const avgSummerIndoorTemp = (summerDayTemp * 16 + summerNightTemp * 8) / 24;
                  
                  // Temperature adjustment multipliers
                  const baseWinterOutdoorTemp = 35;
                  const baseWinterDelta = 65 - baseWinterOutdoorTemp; // 30°F
                  const actualWinterDelta = avgWinterIndoorTemp - baseWinterOutdoorTemp;
                  const winterTempMultiplier = actualWinterDelta / baseWinterDelta;
                  
                  const baseSummerOutdoorTemp = 85;
                  const baseSummerDelta = baseSummerOutdoorTemp - 65; // 20°F
                  const actualSummerDelta = baseSummerOutdoorTemp - avgSummerIndoorTemp;
                  const summerTempMultiplier = actualSummerDelta / baseSummerDelta;
                  
                  // Calculate cost for each month and sum
                  let annualHeatingCost = 0;
                  let annualCoolingCost = 0;
                  
                  for (let month = 0; month < 12; month++) {
                    // Scale monthly HDD/CDD to location's annual totals
                    const monthHDD = totalTypicalHDD > 0 ? (monthlyHDDDist[month] / totalTypicalHDD) * annualHDD : 0;
                    const monthCDD = totalTypicalCDD > 0 ? (monthlyCDDDist[month] / totalTypicalCDD) * annualCDD : 0;
                    
                    let monthHeatingCost = 0;
                    let monthCoolingCost = 0;
                    
                    // Calculate heating cost for this month
                    if (monthHDD > 0) {
                      const monthHeatingEstimate = estimateMonthlyHeatingCostFromHDD({
                        hdd: monthHDD,
                        squareFeet,
                        insulationLevel,
                        homeShape,
                        ceilingHeight,
                        hspf: hspf2,
                        electricityRate: utilityCost,
                      });
                      
                      if (monthHeatingEstimate && monthHeatingEstimate.cost > 0) {
                        monthHeatingCost = monthHeatingEstimate.cost * winterTempMultiplier;
                      }
                    }
                    
                    // Calculate cooling cost for this month
                    if (monthCDD > 0) {
                      const monthCoolingEstimate = estimateMonthlyCoolingCostFromCDD({
                        cdd: monthCDD,
                        squareFeet,
                        insulationLevel,
                        homeShape,
                        ceilingHeight,
                        seer2: efficiency,
                        electricityRate: utilityCost,
                        capacity: coolingCapacity || capacity,
                        solarExposure,
                      });
                      
                      if (monthCoolingEstimate && monthCoolingEstimate.cost > 0) {
                        monthCoolingCost = monthCoolingEstimate.cost * summerTempMultiplier;
                      }
                    }

                    // --- FIX START: Add Fixed Charges to Monthly Buckets ---
                    // Ensure safe type conversion
                    const safeFixedElectric = Number(fixedElectricCost) || 0;
                    const safeFixedGas = Number(fixedGasCost) || 0;
                    
                    // 1. Gas Fixed Charge (if using gas furnace)
                    if (isGasHeat) {
                      monthHeatingCost += safeFixedGas;
                    }

                    // 2. Electric Fixed Charge: Assign to dominant mode
                    const isCoolingSeason = [4, 5, 6, 7, 8, 9].includes(month); // May-Oct
                    if (monthCoolingCost > monthHeatingCost) {
                      monthCoolingCost += safeFixedElectric;
                    } else if (monthHeatingCost > monthCoolingCost) {
                      monthHeatingCost += safeFixedElectric;
                    } else {
                      // If equal (e.g. 0 vs 0), assign based on season
                      if (isCoolingSeason) monthCoolingCost += safeFixedElectric;
                      else monthHeatingCost += safeFixedElectric;
                    }
                    // --- FIX END ---
                    
                    // Now accumulate the totals (which now include fixed costs)
                    annualHeatingCost += monthHeatingCost;
                    annualCoolingCost += monthCoolingCost;
                  }
                  
                  // The annual total now already includes fixed costs from the loop
                  const totalAnnualCost = annualHeatingCost + annualCoolingCost;

                  return totalAnnualCost > 0 ? Math.max(0, totalAnnualCost).toFixed(2) : "—";
                  })()}
                  </div>
                  {(() => {
                // --- 1. SETUP & SAFE CASTING ---
                const annualHDD = getAnnualHDD(locationData.city, locationData.state);
                const annualCDD = getAnnualCDD(locationData.city, locationData.state);
                
                // Explicitly cast to Number to prevent string concatenation or 0-fail issues
                const safeFixedElectric = Number(fixedElectricCost) || 0;
                const safeFixedGas = Number(fixedGasCost) || 0;

                  // Distributions
                  const monthlyHDDDist = [1200, 1000, 600, 200, 50, 10, 0, 0, 20, 200, 500, 1100]; 
                  const monthlyCDDDist = [0, 0, 10, 60, 150, 300, 450, 400, 250, 100, 10, 0];
                  
                  const totalTypicalHDD = monthlyHDDDist.reduce((a, b) => a + b, 0); 
                  const totalTypicalCDD = monthlyCDDDist.reduce((a, b) => a + b, 0); 
                  
                  // Temp Multipliers (Calculated once)
                  const avgWinterIndoorTemp = ((userSettings?.winterThermostatDay ?? 70) * 16 + (userSettings?.winterThermostatNight ?? 68) * 8) / 24;
                  const winterTempMultiplier = (avgWinterIndoorTemp - 35) / 30; // Base 65 - 35
                  
                  const avgSummerIndoorTemp = ((userSettings?.summerThermostat ?? 76) * 16 + (userSettings?.summerThermostatNight ?? 78) * 8) / 24;
                  const summerTempMultiplier = (85 - avgSummerIndoorTemp) / 20; // Base 85 - 65
                  
                  // Accumulators - track variable and total separately
                  let annualVariableHeating = 0;
                  let annualVariableCooling = 0;
                  let annualHeatingCost = 0; // Includes fixed
                  let annualCoolingCost = 0; // Includes fixed
                  
                  // Arrays for the grid display
                  const monthlyHeatingCosts = [];
                  const monthlyCoolingCosts = [];
                  const monthlyHDDValues = [];
                  const monthlyCDDValues = [];
                  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  
                  // --- MAIN LOOP ---
                  for (let month = 0; month < 12; month++) {
                    // 1. Calculate Load
                    const monthHDD = totalTypicalHDD > 0 ? (monthlyHDDDist[month] / totalTypicalHDD) * annualHDD : 0;
                    const monthCDD = totalTypicalCDD > 0 ? (monthlyCDDDist[month] / totalTypicalCDD) * annualCDD : 0;
                    
                    monthlyHDDValues.push(Math.round(monthHDD));
                    monthlyCDDValues.push(Math.round(monthCDD));
                    
                    let monthVariableHeating = 0;
                    let monthVariableCooling = 0;
                    let monthHeatingCost = 0; // Will include fixed
                    let monthCoolingCost = 0; // Will include fixed
                    
                    // 2. Physics Cost: Heating (variable only)
                    if (monthHDD > 0) {
                      // Use hourly historical data for aux heat if available (heat pumps only)
                      if (primarySystem === "heatPump" && historicalHourly && historicalHourly.length > 0 && balancePoint !== null) {
                        // Filter hours for this month from historical data
                        const monthHours = historicalHourly.filter(hour => {
                          const hourDate = new Date(hour.time);
                          return hourDate.getMonth() === month;
                        });
                        
                        if (monthHours.length > 0) {
                          const tonsMap = { 18: 1.5, 24: 2.0, 30: 2.5, 36: 3.0, 42: 3.5, 48: 4.0, 60: 5.0 };
                          const tons = tonsMap[capacity] || 3.0;
                          const estimatedDesignHeatLoss = heatUtils.calculateHeatLoss({
            squareFeet,
            insulationLevel,
            homeShape,
            ceilingHeight,
            wallHeight,
            hasLoft,
          });
                          
                          // Calculate aux heat hour-by-hour
                          let totalHeatPumpKwh = 0;
                          let totalAuxKwh = 0;
                          
                          monthHours.forEach(hour => {
                            const dtHours = 1.0; // 1 hour per timestep
                            const perf = heatUtils.computeHourlyPerformance(
                              {
                                tons: tons,
                                indoorTemp: avgWinterIndoorTemp,
                                designHeatLossBtuHrAt70F: estimatedDesignHeatLoss,
                                compressorPower: null,
                              },
                              hour.temp,
                              hour.humidity ?? 50,
                              dtHours
                            );
                            
                            // AGGREGATION RULES: Sum energy directly - NEVER multiply by dtHours
                            // ✅ CORRECT: monthlyHpKwh += perf.hpKwh; monthlyAuxKwh += perf.auxKwh;
                            // ❌ WRONG: perf.hpKwh * dtHours or perf.auxKwh * dtHours (would double-count!)
                            // Note: auxKw is informational only; do not aggregate power, aggregate auxKwh.
                            if (perf.hpKwh !== undefined) {
                              totalHeatPumpKwh += perf.hpKwh;
                            } else {
                              // Fallback for backward compatibility
                              totalHeatPumpKwh += perf.electricalKw * (perf.capacityUtilization / 100) * dtHours; // Using capacityUtilization, not time-based runtime
                            }
                            
                            // Aux heat energy (only when needed)
                            if (hour.temp < balancePoint && useElectricAuxHeat) {
                              if (perf.auxKwh !== undefined && perf.auxKwh > 0) {
                                totalAuxKwh += perf.auxKwh;
                              } else if (perf.auxKw > 0) {
                                // Fallback for backward compatibility
                                totalAuxKwh += perf.auxKw * dtHours;
                              }
                            }
                          });
                          
                          // Scale to full month if we don't have complete data
                          const daysInMonth = new Date(new Date().getFullYear(), month + 1, 0).getDate();
                          const expectedHours = daysInMonth * 24;
                          if (monthHours.length < expectedHours * 0.8) {
                            const scaleFactor = expectedHours / monthHours.length;
                            totalHeatPumpKwh *= scaleFactor;
                            totalAuxKwh *= scaleFactor;
                          }
                          
                          // Calculate costs
                          const totalHeatingKwh = totalHeatPumpKwh + totalAuxKwh;
                          monthVariableHeating = totalHeatingKwh * utilityCost * winterTempMultiplier;
                          monthHeatingCost = monthVariableHeating;
                        } else {
                          // Fallback to HDD-based estimate
                          const est = estimateMonthlyHeatingCostFromHDD({
                            hdd: monthHDD,
                            squareFeet,
                            insulationLevel,
                            homeShape,
                            ceilingHeight,
                            hspf: hspf2,
                            electricityRate: utilityCost,
                          });
                          if (est?.cost > 0) {
                            monthVariableHeating = est.cost * winterTempMultiplier;
                            monthHeatingCost = monthVariableHeating;
                          }
                        }
                      } else {
                        // Standard HDD-based estimate
                        const est = estimateMonthlyHeatingCostFromHDD({
                          hdd: monthHDD,
                          squareFeet,
                          insulationLevel,
                          homeShape,
                          ceilingHeight,
                          hspf: hspf2,
                          electricityRate: utilityCost,
                        });
                        if (est?.cost > 0) {
                          monthVariableHeating = est.cost * winterTempMultiplier;
                          monthHeatingCost = monthVariableHeating;
                        }
                      }
                    }
                    
                    // 3. Physics Cost: Cooling (variable only)
                    if (monthCDD > 0) {
                      const est = estimateMonthlyCoolingCostFromCDD({
                        cdd: monthCDD,
                        squareFeet,
                        insulationLevel,
                        homeShape,
                        ceilingHeight,
                        seer2: efficiency,
                        electricityRate: utilityCost,
                        capacity: coolingCapacity || capacity,
                        solarExposure,
                      });
                      if (est?.cost > 0) {
                        monthVariableCooling = est.cost * summerTempMultiplier;
                        monthCoolingCost = monthVariableCooling;
                      }
                    }

                    // C. Apply Fixed Costs (Crucial Step)
                    // If Gas Furnace: Always add gas fixed cost to heating bucket
                    if (isGasHeat) {
                      monthHeatingCost += safeFixedGas;
                    }
                    
                    // Electric Fixed Cost: Assign to the "dominant" fuel/mode for that month for display
                    const isCoolingSeason = [4, 5, 6, 7, 8, 9].includes(month); // May-Oct
                    if (monthCoolingCost > monthHeatingCost) {
                      monthCoolingCost += safeFixedElectric;
                    } else if (monthHeatingCost > monthCoolingCost) {
                      monthHeatingCost += safeFixedElectric;
                    } else {
                      // If equal (e.g. 0 vs 0), assign based on season
                      if (isCoolingSeason) monthCoolingCost += safeFixedElectric;
                      else monthHeatingCost += safeFixedElectric;
                    }
                    
                    // D. Accumulate
                    annualVariableHeating += monthVariableHeating;
                    annualVariableCooling += monthVariableCooling;
                    annualHeatingCost += monthHeatingCost;
                    annualCoolingCost += monthCoolingCost;

                    // E. Push to Arrays (with fixed costs included for display)
                    monthlyHeatingCosts.push(monthHeatingCost);
                    monthlyCoolingCosts.push(monthCoolingCost);
                  }
                  
                  // --- 3. TOTALS ---
                  const annualFixedOnly = (safeFixedElectric * 12) + (isGasHeat ? safeFixedGas * 12 : 0);
                  const totalAnnualCost = annualVariableHeating + annualVariableCooling + annualFixedOnly;
                
                // --- 4. RENDER ---
                return (
                  <>
                    {/* Summary Boxes */}
                    <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                      <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
                        <p className="font-semibold text-blue-700 dark:text-blue-300">
                          Annual Heating (energy only)
                        </p>
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          ${annualVariableHeating.toFixed(2)}
                        </p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                          {Math.round(annualHDD)} HDD
                        </p>
                      </div>
                      <div className="bg-cyan-50 dark:bg-cyan-900/30 rounded-lg p-3">
                        <p className="font-semibold text-cyan-700 dark:text-cyan-300">
                          Annual Cooling (energy only)
                        </p>
                        <p className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
                          ${annualVariableCooling.toFixed(2)}
                        </p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                          {Math.round(annualCDD)} CDD
                        </p>
                      </div>
                    </div>
                    
                    {annualFixedOnly > 0 && (
                      <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-3 mb-4">
                        <p className="font-semibold text-gray-700 dark:text-gray-300">
                          Annual Fixed Charges
                        </p>
                        <p className="text-lg font-bold text-gray-600 dark:text-gray-400">
                          ${annualFixedOnly.toFixed(2)}
                        </p>
                      </div>
                    )}
                    <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-3 mb-4">
                      <p className="font-semibold text-indigo-700 dark:text-indigo-300 mb-1">
                        Total Annual HVAC Cost (energy + fixed)
                      </p>
                      <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        ${totalAnnualCost.toFixed(2)}
                      </p>
                      {annualFixedOnly > 0 && (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-indigo-600 dark:text-indigo-400">
                            = ${annualVariableHeating.toFixed(2)} (heating) + ${annualVariableCooling.toFixed(2)} (cooling) + ${annualFixedOnly.toFixed(2)} (fixed)
                          </p>
                        </div>
                      )}
                      {totalAnnualCost === 0 ? (
                        <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            <strong>Unable to calculate costs.</strong> This may be because:
                          </p>
                          <ul className="text-xs text-yellow-700 dark:text-yellow-300 mt-2 ml-4 list-disc space-y-1">
                            <li>No HDD/CDD data available for {locationData?.city}, {locationData?.state}</li>
                            <li>Location data may be incomplete (HDD: {annualHDD}, CDD: {annualCDD})</li>
                            <li>Check that your location is correctly set in Settings</li>
                          </ul>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            (Heating ≈ ${Math.round(annualHeatingCost)} • Cooling ≈ ${Math.round(annualCoolingCost)})
                          </p>
                          <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-3 font-medium">
                            This works out to about <strong>${(annualHeatingCost / 12).toFixed(2)}/month</strong> in heating and <strong>${(annualCoolingCost / 12).toFixed(2)}/month</strong> in cooling on average.
                          </p>
                        </>
                      )}
                    </div>
                      
                      {/* Monthly Breakdown */}
                      <div className="mt-6 space-y-4">
                        <h4 className="font-semibold text-high-contrast text-lg mb-3">Monthly Breakdown</h4>
                        
                        {/* Heating Months */}
                        {annualHeatingCost > 0 && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                            <p className="font-semibold text-blue-700 dark:text-blue-300 mb-3">Heating Costs by Month</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                              {monthNames.map((monthName, idx) => {
                                const cost = monthlyHeatingCosts[idx];
                                const hdd = monthlyHDDValues[idx];
                                const percent = annualHeatingCost > 0 ? (cost / annualHeatingCost) * 100 : 0;
                                // Show all months, even if cost is 0 (to match comment at line 2764)
                                return (
                                  <div key={idx} className="bg-white dark:bg-gray-800 rounded p-2 border border-blue-200 dark:border-blue-800">
                                    <p className="font-semibold text-xs text-blue-600 dark:text-blue-400">{monthName}</p>
                                    <p className="text-sm font-bold text-blue-700 dark:text-blue-300">${cost.toFixed(2)}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{hdd} HDD</p>
                                    {cost > 0 && <p className="text-xs text-gray-500 dark:text-gray-400">{percent.toFixed(1)}%</p>}
                                    {cost === 0 && hdd === 0 && <p className="text-xs text-gray-400 dark:text-gray-500 italic">No heating needed</p>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        
                        {/* Cooling Months */}
                        {annualCoolingCost > 0 && (
                          <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-4">
                            <p className="font-semibold text-cyan-700 dark:text-cyan-300 mb-3">Cooling Costs by Month</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                              {monthNames.map((monthName, idx) => {
                                const cost = monthlyCoolingCosts[idx];
                                const cdd = monthlyCDDValues[idx];
                                const percent = annualCoolingCost > 0 ? (cost / annualCoolingCost) * 100 : 0;
                                // Show all months, even if cost is 0 (to match comment at line 2764)
                                return (
                                  <div key={idx} className="bg-white dark:bg-gray-800 rounded p-2 border border-cyan-200 dark:border-cyan-800">
                                    <p className="font-semibold text-xs text-cyan-600 dark:text-cyan-400">{monthName}</p>
                                    <p className="text-sm font-bold text-cyan-700 dark:text-cyan-300">${cost.toFixed(2)}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{cdd} CDD</p>
                                    {cost > 0 && <p className="text-xs text-gray-500 dark:text-gray-400">{percent.toFixed(1)}%</p>}
                                    {cost === 0 && cdd === 0 && <p className="text-xs text-gray-400 dark:text-gray-500 italic">No cooling needed</p>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          ✓ Annual Total Verification (All 12 Months Included)
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                          Heating: Sum of all 12 months (Jan-Dec) = ${annualHeatingCost.toFixed(2)}
                        </p>
                        <p className="text-xs text-blue-500 dark:text-blue-400 ml-2">
                          ({monthlyHeatingCosts.filter(c => c > 0).length} months with heating costs, scaled to {Math.round(annualHDD)} annual HDD)
                        </p>
                        <p className="text-xs text-cyan-600 dark:text-cyan-400 font-semibold mt-2">
                          Cooling: Sum of all 12 months (Jan-Dec) = ${annualCoolingCost.toFixed(2)}
                        </p>
                        <p className="text-xs text-cyan-500 dark:text-cyan-400 ml-2">
                          ({monthlyCoolingCosts.filter(c => c > 0).length} months with cooling costs, scaled to {Math.round(annualCDD)} annual CDD)
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 italic">
                          * All 12 months are calculated and included in the annual total, even if some months have $0.00 costs (no HDD/CDD for that month).
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 italic">
                        * Calculated by summing costs for all 12 months, with monthly HDD/CDD scaled to your location's annual totals. Accounts for seasonal variation and your thermostat settings.
                      </p>
                      
                      {/* Target Temperature Settings and Data Source - Above Math */}
                      {thermostatSettingsForDisplay && (
                        <>
                          {/* Target Temperature Settings - All Modes */}
                          <div className="relative overflow-hidden mt-6 mb-4 bg-gradient-to-br from-slate-800/90 via-slate-900/90 to-slate-800/90 border border-slate-700/50 rounded-xl p-4 shadow-2xl shadow-slate-900/50 backdrop-blur-sm">
                            {/* Subtle animated background */}
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-cyan-500/5 animate-pulse" />
                            <div className="relative z-10">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Thermometer className="w-4 h-4 text-blue-400" />
                                <p className="text-sm font-semibold text-white">
                                  Target Temperatures (Auto Mode - All Comfort Settings)
                                </p>
                              </div>
                              <Link
                                to="/settings#comfort-settings"
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-xs font-medium"
                              >
                                <Settings className="w-3.5 h-3.5" />
                                Configure in Settings
                              </Link>
                            </div>
                            <div className="text-xs text-slate-300 space-y-2">
                              {/* Home Mode */}
                              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <Home className="w-4 h-4 text-green-400" />
                                  <p className="font-semibold text-white">Home Mode</p>
                                </div>
                                <p className="text-slate-300">
                                  <strong className="text-white">Heating:</strong> {thermostatSettingsForDisplay.homeHeatSetPoint}°F (runs when outdoor temp &lt; {thermostatSettingsForDisplay.homeHeatSetPoint}°F) • 
                                  <strong className="text-white"> Cooling:</strong> {thermostatSettingsForDisplay.homeCoolSetPoint}°F (runs when outdoor temp &gt; {thermostatSettingsForDisplay.homeCoolSetPoint}°F)
                                </p>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  Active during daytime/occupied hours (typically {thermostatSettingsForDisplay.daytimeStartTime} - {thermostatSettingsForDisplay.nighttimeStartTime})
                                </p>
                              </div>
                              
                              {/* Sleep Mode */}
                              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <Moon className="w-4 h-4 text-blue-400" />
                                  <p className="font-semibold text-white">Sleep Mode</p>
                                </div>
                                <p className="text-slate-300">
                                  <strong className="text-white">Heating:</strong> {thermostatSettingsForDisplay.sleepHeatSetPoint}°F (runs when outdoor temp &lt; {thermostatSettingsForDisplay.sleepHeatSetPoint}°F) • 
                                  <strong className="text-white"> Cooling:</strong> {thermostatSettingsForDisplay.sleepCoolSetPoint}°F (runs when outdoor temp &gt; {thermostatSettingsForDisplay.sleepCoolSetPoint}°F)
                                </p>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  Active during nighttime/sleep hours (typically {thermostatSettingsForDisplay.nighttimeStartTime} - {thermostatSettingsForDisplay.daytimeStartTime})
                                </p>
                              </div>
                              
                              {/* Away Mode */}
                              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <Calendar className="w-4 h-4 text-orange-400" />
                                  <p className="font-semibold text-white">Away Mode</p>
                                </div>
                                <p className="text-slate-300">
                                  <strong className="text-white">Heating:</strong> {thermostatSettingsForDisplay.awayHeatSetPoint}°F (runs when outdoor temp &lt; {thermostatSettingsForDisplay.awayHeatSetPoint}°F) • 
                                  <strong className="text-white"> Cooling:</strong> {thermostatSettingsForDisplay.awayCoolSetPoint}°F (runs when outdoor temp &gt; {thermostatSettingsForDisplay.awayCoolSetPoint}°F)
                                </p>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  Active when schedule indicates away/unoccupied periods
                                </p>
                              </div>
                              
                              <p className="mt-2 text-slate-400">
                                These setpoints are loaded from your thermostat's comfort settings. 
                                If not configured, defaults to Ecobee standard: Home (70°F/75°F), Sleep (66°F/78°F), Away (62°F/85°F). 
                                The forecast uses auto-mode logic with schedule-aware mode switching: heating runs when outdoor temp is below the heating setpoint, 
                                cooling runs when outdoor temp is above the cooling setpoint. Each mode uses its own setpoints based on the schedule.
                              </p>
                            </div>
                            </div>
                          </div>
                          
                          {/* Data Source Information */}
                          <div className="relative overflow-hidden mb-4 bg-gradient-to-br from-slate-800/90 via-slate-900/90 to-slate-800/90 border border-slate-700/50 rounded-xl p-4 shadow-2xl shadow-slate-900/50 backdrop-blur-sm">
                            {/* Subtle animated background */}
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-cyan-500/5 animate-pulse" />
                            <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-2">
                              <BarChart3 className="w-4 h-4 text-blue-400" />
                              <p className="text-sm font-semibold text-white">
                                Temperature Data Source
                              </p>
                            </div>
                            <div className="text-xs text-slate-300 space-y-1">
                              {thermostatSettingsForDisplay.usesHistoricalHourly ? (
                                <p>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 inline mr-1" />
                                  <strong className="text-white">Using historical hourly temperature data</strong> from Open-Meteo API. 
                                  This provides the most accurate aux heat calculations for heat pumps, accounting for 
                                  nighttime temperature drops when aux heat is most likely needed.
                                </p>
                              ) : thermostatSettingsForDisplay.usesSinusoidalApprox ? (
                                <p>
                                  <BarChart3 className="w-3.5 h-3.5 text-blue-400 inline mr-1" />
                                  <strong className="text-white">Using sinusoidal temperature approximation</strong> based on monthly HDD/CDD data. 
                                  Daily temperatures follow a sinusoidal pattern (lowest around 6 AM, highest around 6 PM) 
                                  to accurately model nighttime heating costs and aux heat needs. This ensures heating costs 
                                  reflect that nights are colder and aux heat is more likely needed during nighttime hours.
                                </p>
                              ) : (
                                <p>
                                  <Info className="w-3.5 h-3.5 text-blue-400 inline mr-1" />
                                  <strong className="text-white">Using HDD/CDD-based monthly averages</strong> from location climate data. 
                                  This provides a good estimate for annual costs but doesn't account for daily temperature 
                                  cycles. For more accurate aux heat calculations with heat pumps, historical hourly data 
                                  or sinusoidal approximations are recommended.
                                </p>
                              )}
                              <p className="mt-2 text-slate-400">
                                <strong className="text-white">Why this matters:</strong> Nighttime temperatures are typically 10-20°F colder than 
                                daytime temperatures. For heat pumps, this means aux heat is more likely needed at night, 
                                which significantly increases heating costs. The sinusoidal pattern ensures these nighttime 
                                aux heat needs are properly accounted for.
                              </p>
                            </div>
                            </div>
                          </div>
                        </>
                      )}
                      
                      {/* Math Breakdown Section */}
                      <details className="mt-6 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                        <summary className="cursor-pointer font-semibold text-high-contrast text-lg mb-4 flex items-center gap-2">
                          <Calculator className="w-5 h-5" />
                          Show me the math
                          <a href="/docs/FORECAST_AND_COST_MODELS.md" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline ml-2" onClick={(e) => e.stopPropagation()}>Forecast & cost models explained</a>
                        </summary>
                        <div className="mt-3 space-y-3 text-sm">
                          {/* Input Parameters */}
                          {(() => {
                            // Calculate temperature values for display
                            const winterDayTemp = userSettings?.winterThermostatDay ?? 70;
                            const winterNightTemp = userSettings?.winterThermostatNight ?? 68;
                            const summerDayTemp = userSettings?.summerThermostat ?? 76;
                            const summerNightTemp = userSettings?.summerThermostatNight ?? 78;
                            
                            return (
                              <div>
                                <h5 className="font-semibold text-high-contrast mb-2">Input Parameters</h5>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs mb-3">
                                  <div><strong>Square Feet:</strong> {squareFeet}</div>
                                  <div><strong>Insulation Level:</strong> {insulationLevel}x</div>
                                  <div><strong>Home Shape Factor:</strong> {homeShape}x</div>
                                  <div><strong>Ceiling Height:</strong> {ceilingHeight} ft</div>
                                  <div><strong>HSPF2:</strong> {hspf2}</div>
                                  <div><strong>SEER2:</strong> {efficiency}</div>
                                  <div><strong>Electricity Rate:</strong> ${utilityCost.toFixed(3)}/kWh</div>
                                  {safeFixedElectric > 0 && (
                                    <div><strong>Fixed Electric Fee:</strong> ${safeFixedElectric.toFixed(2)}/mo</div>
                                  )}
                                  {safeFixedGas > 0 && (
                                    <div><strong>Fixed Gas Fee:</strong> ${safeFixedGas.toFixed(2)}/mo</div>
                                  )}
                                  <div><strong>Annual HDD:</strong> {Math.round(annualHDD)}</div>
                                  <div><strong>Annual CDD:</strong> {Math.round(annualCDD)}</div>
                                  <div><strong>Winter Day Temp:</strong> {winterDayTemp}°F</div>
                                  <div><strong>Winter Night Temp:</strong> {winterNightTemp}°F</div>
                                  <div><strong>Summer Day Temp:</strong> {summerDayTemp}°F</div>
                                  <div><strong>Summer Night Temp:</strong> {summerNightTemp}°F</div>
                                </div>
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded p-3 border border-yellow-200 dark:border-yellow-800 text-xs">
                              <p className="font-semibold text-yellow-800 dark:text-yellow-200 mb-1">⚠️ Understanding Insulation Level</p>
                              <p className="text-yellow-700 dark:text-yellow-300">
                                <strong>Insulation Level is a heat loss multiplier:</strong> Lower values = better insulation = less heat loss.
                                {insulationLevel < 0.7 && ` Your ${insulationLevel}x value indicates excellent insulation (less heat loss than typical).`}
                                {insulationLevel >= 0.7 && insulationLevel <= 1.1 && ` Your ${insulationLevel}x value indicates average insulation.`}
                                {insulationLevel > 1.1 && ` Your ${insulationLevel}x value indicates poor insulation (more heat loss than typical).`}
                              </p>
                              <p className="text-yellow-700 dark:text-yellow-300 mt-2">
                                <strong>DOE-Aligned Baseline:</strong> The 22.67 BTU/(hr·ft²) constant represents ~0.32 BTU/(hr·ft²·°F) heat loss coefficient, which aligns with DOE guidelines for "average modern" code-built homes (2000s+ construction) before applying insulation/shape multipliers. This baseline assumes typical construction with R-13 wall insulation, average windows, and standard air tightness at 70°F ΔT.
                              </p>
                              <p className="text-yellow-700 dark:text-yellow-300 mt-2">
                                <strong>DOE Typical Ranges:</strong> Well-insulated new homes: 0.2-0.4 BTU/(hr·ft²·°F). Average existing homes: 0.4-0.6 BTU/(hr·ft²·°F). For precise values, use DOE-endorsed tools like Manual J or REScheck.
                              </p>
                            </div>
                              </div>
                            );
                          })()}

                          {/* Total Cost Composition */}
                          {monthlyEstimate && (
                            <div>
                              <h5 className="font-semibold text-high-contrast mb-2">Total Estimate Composition</h5>
                              <div className="bg-gray-50 dark:bg-gray-900/20 rounded p-3 text-xs space-y-2">
                                <div className="flex justify-between">
                                  <span>Variable Energy Cost:</span>
                                  <span className="font-bold">
                                    ${((monthlyEstimate.cost || 0) - (monthlyEstimate.fixedCost || 0)).toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex justify-between text-blue-600 dark:text-blue-400">
                                  <span>+ Fixed Utility Charge:</span>
                                  <span className="font-bold">
                                    ${(monthlyEstimate.fixedCost || 0).toFixed(2)}
                                  </span>
                                </div>
                                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                                  <span className="font-bold">Total Estimate:</span>
                                  <span className="font-bold">
                                    ${(monthlyEstimate.cost || 0).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Temperature Multipliers */}
                          <div>
                            <h5 className="font-semibold text-high-contrast mb-2">Temperature Adjustment</h5>
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-3 mb-2">
                              <p className="text-xs mb-1"><strong>Winter Average Indoor Temp:</strong> {avgWinterIndoorTemp.toFixed(1)}°F</p>
                              <p className="text-xs mb-1">= ({(userSettings?.winterThermostatDay ?? 70)}°F × 16h + {(userSettings?.winterThermostatNight ?? 68)}°F × 8h) ÷ 24h</p>
                              <p className="text-xs mb-1"><strong>Winter Temp Multiplier:</strong> {winterTempMultiplier.toFixed(3)}</p>
                              <p className="text-xs">= ({avgWinterIndoorTemp.toFixed(1)}°F - 35°F) ÷ (65°F - 35°F)</p>
                            </div>
                            <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded p-3">
                              <p className="text-xs mb-1"><strong>Summer Average Indoor Temp:</strong> {avgSummerIndoorTemp.toFixed(1)}°F</p>
                              <p className="text-xs mb-1">= ({(userSettings?.summerThermostat ?? 76)}°F × 16h + {(userSettings?.summerThermostatNight ?? 78)}°F × 8h) ÷ 24h</p>
                              <p className="text-xs mb-1"><strong>Summer Temp Multiplier:</strong> {summerTempMultiplier.toFixed(3)}</p>
                              <p className="text-xs">= (85°F - {avgSummerIndoorTemp.toFixed(1)}°F) ÷ (85°F - 65°F)</p>
                            </div>
                          </div>
                          
                          {/* Heating Formula */}
                          <div>
                            <h5 className="font-semibold text-high-contrast mb-2">Heating Cost Formula (DOE-Aligned)</h5>
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-3 space-y-2 text-xs">
                              <p className="text-gray-600 dark:text-gray-400 italic mb-2">
                                Based on DOE's UA × ΔT approach. The 22.67 constant = ~0.32 BTU/(hr·ft²·°F) baseline for average modern construction.
                              </p>
                              <p><strong>1. Design Heat Loss (at 70°F ΔT):</strong></p>
                              <p className="ml-4">= Square Feet × {BASE_BTU_PER_SQFT} BTU/(hr·ft²) × Insulation × Shape × Ceiling Multiplier</p>
                              <p className="ml-4">= {squareFeet} × {BASE_BTU_PER_SQFT} × {insulationLevel} × {homeShape} × {ceilingHeight > 8 ? (1 + (ceilingHeight - 8) * 0.1).toFixed(3) : '1.000'}</p>
                              <p className="ml-4">= {Math.round(squareFeet * BASE_BTU_PER_SQFT * insulationLevel * homeShape * (1 + (ceilingHeight - 8) * 0.1))} BTU/hr @ 70°F ΔT</p>
                              
                              <p className="mt-2"><strong>2. Heat Loss Coefficient (UA per sq ft):</strong></p>
                              <p className="ml-4">= Design Heat Loss ÷ (Square Feet × 70°F)</p>
                              <p className="ml-4">= {Math.round(squareFeet * BASE_BTU_PER_SQFT * insulationLevel * homeShape * (1 + (ceilingHeight - 8) * 0.1))} ÷ ({squareFeet} × 70)</p>
                              <p className="ml-4">= {((BASE_BTU_PER_SQFT * insulationLevel * homeShape * (1 + (ceilingHeight - 8) * 0.1)) / 70).toFixed(3)} BTU/(hr·ft²·°F)</p>
                              
                              <p className="mt-2"><strong>3. Total BTU Loss per °F:</strong></p>
                              <p className="ml-4">= Heat Loss Coefficient × Square Feet</p>
                              <p className="ml-4">= {((BASE_BTU_PER_SQFT * insulationLevel * homeShape * (1 + (ceilingHeight - 8) * 0.1)) / 70).toFixed(3)} × {squareFeet}</p>
                              <p className="ml-4">= {((squareFeet * BASE_BTU_PER_SQFT * insulationLevel * homeShape * (1 + (ceilingHeight - 8) * 0.1)) / 70).toFixed(1)} BTU/(hr·°F)</p>
                              
                              <p className="mt-2"><strong>4. Monthly Energy (kWh):</strong></p>
                              <p className="ml-4">= (HDD × 24 hours × BTU Loss per °F) ÷ (HSPF2 × 1000)</p>
                              <p className="ml-4">Example (Jan): ({monthlyHDDValues[0]} HDD × 24 × {((squareFeet * BASE_BTU_PER_SQFT * insulationLevel * homeShape * (1 + (ceilingHeight - 8) * 0.1)) / 70).toFixed(1)}) ÷ ({hspf2} × 1000)</p>
                              {monthlyHeatingCosts[0] > 0 && (
                                <p className="ml-4">= {((monthlyHDDValues[0] * 24 * (squareFeet * BASE_BTU_PER_SQFT * insulationLevel * homeShape * (1 + (ceilingHeight - 8) * 0.1)) / 70) / (hspf2 * 1000)).toFixed(1)} kWh</p>
                              )}
                              
                              <p className="mt-2"><strong>4. Monthly Cost (variable energy only):</strong></p>
                              <p className="ml-4">= Energy × Rate × Temp Multiplier</p>
                              {monthlyHeatingCosts[0] > 0 && (() => {
                                const janEnergy = ((monthlyHDDValues[0] * 24 * (squareFeet * BASE_BTU_PER_SQFT * insulationLevel * homeShape * (1 + (ceilingHeight - 8) * 0.1)) / 70) / (hspf2 * 1000));
                                const janVariableCost = janEnergy * utilityCost * winterTempMultiplier;
                                return (
                                  <>
                                    <p className="ml-4">Example (Jan): {janEnergy.toFixed(1)} kWh × ${utilityCost.toFixed(3)}/kWh × {winterTempMultiplier.toFixed(3)}</p>
                                    <p className="ml-4">= ${janVariableCost.toFixed(2)} (variable energy cost)</p>
                                    <p className="ml-4 text-xs text-gray-500 dark:text-gray-400 italic">Note: Monthly breakdown shows ${monthlyHeatingCosts[0].toFixed(2)} which includes fixed charges</p>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                          
                          {/* Cooling Formula */}
                          <div>
                            <h5 className="font-semibold text-high-contrast mb-2">Cooling Cost Formula</h5>
                            <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded p-3 space-y-2 text-xs">
                              <p><strong>1. Design Heat Gain:</strong></p>
                              <p className="ml-4">= Square Feet × 28 BTU/(hr·ft²) × Insulation × Shape × Ceiling Multiplier × Solar</p>
                              <p className="ml-4">= {squareFeet} × 28 × {insulationLevel} × {homeShape} × {ceilingHeight > 8 ? (1 + (ceilingHeight - 8) * 0.1).toFixed(3) : '1.000'} × {solarExposure}</p>
                              <p className="ml-4">= {Math.round(squareFeet * 28 * insulationLevel * homeShape * (1 + (ceilingHeight - 8) * 0.1) * solarExposure)} BTU/hr</p>
                              
                              <p className="mt-2"><strong>2. BTU Gain per °F:</strong></p>
                              <p className="ml-4">= Design Heat Gain ÷ 20°F</p>
                              <p className="ml-4">= {Math.round(squareFeet * 28 * insulationLevel * homeShape * (1 + (ceilingHeight - 8) * 0.1) * solarExposure)} ÷ 20</p>
                              <p className="ml-4">= {((squareFeet * 28 * insulationLevel * homeShape * (1 + (ceilingHeight - 8) * 0.1) * solarExposure) / 20).toFixed(1)} BTU/(hr·°F)</p>
                              
                              <p className="mt-2"><strong>3. Monthly Energy (kWh):</strong></p>
                              <p className="ml-4">= (CDD × 24 hours × BTU Gain per °F) ÷ (SEER2 × 1000)</p>
                              <p className="ml-4">Example (Jul): ({monthlyCDDValues[6]} CDD × 24 × {((squareFeet * 28 * insulationLevel * homeShape * (1 + (ceilingHeight - 8) * 0.1) * solarExposure) / 20).toFixed(1)}) ÷ ({efficiency} × 1000)</p>
                              {monthlyCoolingCosts[6] > 0 && (
                                <p className="ml-4">= {((monthlyCDDValues[6] * 24 * (squareFeet * 28 * insulationLevel * homeShape * (1 + (ceilingHeight - 8) * 0.1) * solarExposure) / 20) / (efficiency * 1000)).toFixed(1)} kWh</p>
                              )}
                              
                              <p className="mt-2"><strong>4. Monthly Cost:</strong></p>
                              <p className="ml-4">= Energy × Rate × Temp Multiplier</p>
                              {monthlyCoolingCosts[6] > 0 && (
                                <>
                                  <p className="ml-4">Example (Jul): {((monthlyCDDValues[6] * 24 * (squareFeet * 28 * insulationLevel * homeShape * (1 + (ceilingHeight - 8) * 0.1) * solarExposure) / 20) / (efficiency * 1000)).toFixed(1)} kWh × ${utilityCost.toFixed(3)}/kWh × {summerTempMultiplier.toFixed(3)}</p>
                                  <p className="ml-4">= ${monthlyCoolingCosts[6].toFixed(2)}</p>
                                </>
                              )}
                            </div>
                          </div>
                          
                          {/* Annual Sum */}
                          <div>
                            <h5 className="font-semibold text-high-contrast mb-2">Annual Total</h5>
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded p-3 text-xs">
                              <p><strong>Annual Heating Cost:</strong> Sum of all 12 months = ${annualHeatingCost.toFixed(2)}</p>
                              <p className="ml-4">= {monthNames.map((name, idx) => {
                                if (monthlyHeatingCosts[idx] > 0) {
                                  return `${name}: $${monthlyHeatingCosts[idx].toFixed(2)}`;
                                }
                                return null;
                              }).filter(Boolean).join(' + ')}</p>
                              <p className="mt-2"><strong>Annual Cooling Cost:</strong> Sum of all 12 months = ${annualCoolingCost.toFixed(2)}</p>
                              <p className="ml-4">= {monthNames.map((name, idx) => {
                                if (monthlyCoolingCosts[idx] > 0) {
                                  return `${name}: $${monthlyCoolingCosts[idx].toFixed(2)}`;
                                }
                                return null;
                              }).filter(Boolean).join(' + ')}</p>
                              <p className="mt-2"><strong>Total Annual Cost (energy only):</strong> ${annualVariableHeating.toFixed(2)} + ${annualVariableCooling.toFixed(2)} = ${(annualVariableHeating + annualVariableCooling).toFixed(2)}</p>
                              <p className="mt-2"><strong>Total Annual Fixed Charges:</strong> ${annualFixedOnly.toFixed(2)}</p>
                              <p className="mt-2"><strong>Total Annual HVAC Cost:</strong> ${(annualVariableHeating + annualVariableCooling).toFixed(2)} + ${annualFixedOnly.toFixed(2)} = ${totalAnnualCost.toFixed(2)}</p>
                              <p className="mt-2 text-gray-600 dark:text-gray-400 italic">
                                Verification: Sum of displayed monthly costs should equal annual totals above.
                              </p>
                            </div>
                          </div>
                          
                          {/* Optimizer Math Section */}
                          <div>
                            <h5 className="font-semibold text-high-contrast mb-2">Automizer Calculations</h5>
                            <div className="bg-purple-50 dark:bg-purple-900/20 rounded p-3 space-y-2 text-xs">
                              <p className="text-gray-600 dark:text-gray-400 italic mb-2">
                                The Automizer compares your current schedule to ASHRAE 55 comfort standards and calculates potential savings.
                              </p>
                              
                              <p className="mt-2"><strong>1. Optimal Temperature Calculation (ASHRAE 55 Balanced Mode):</strong></p>
                              <div className="ml-4 space-y-1">
                                <p><strong>Heating Mode:</strong></p>
                                <p className="ml-2">Optimal Day: 70°F (ideal) - 1°F (balanced offset) = 69°F</p>
                                <p className="ml-2">Optimal Night: 70°F (ideal) - 2°F (balanced offset) = 68°F</p>
                                <p className="ml-2">Range: 66°F - 74°F (ASHRAE 55 comfort bounds)</p>
                                <p className="mt-1"><strong>Cooling Mode:</strong></p>
                                <p className="ml-2">Optimal Day: 75°F (ideal) - 1°F (balanced offset) = 74°F</p>
                                <p className="ml-2">Optimal Night: 75°F (ideal) - 2°F (balanced offset) = 73°F</p>
                                <p className="ml-2">Range: 72°F - 78°F (ASHRAE 55 comfort bounds)</p>
                              </div>
                              
                              <p className="mt-2"><strong>2. Average Temperature Calculation:</strong></p>
                              <div className="ml-4 space-y-1">
                                <p>Current Avg = (Day Temp × 16h + Night Temp × 8h) ÷ 24h</p>
                                <p>Optimal Avg = (Optimal Day × 16h + Optimal Night × 8h) ÷ 24h</p>
                                <p className="mt-1">Example (Heating):</p>
                                <p className="ml-2">Current: (69°F × 16 + 68°F × 8) ÷ 24 = 68.67°F</p>
                                <p className="ml-2">Optimal: (69°F × 16 + 68°F × 8) ÷ 24 = 68.67°F</p>
                                <p className="ml-2">Difference: 68.67°F - 68.67°F = 0°F</p>
                                <p className="mt-1">Example (Cooling):</p>
                                <p className="ml-2">Current: (80°F × 16 + 82°F × 8) ÷ 24 = 80.67°F</p>
                                <p className="ml-2">Optimal: (74°F × 16 + 73°F × 8) ÷ 24 = 73.67°F</p>
                                <p className="ml-2">Difference: 80.67°F - 73.67°F = 7.0°F</p>
                              </div>
                              
                              <p className="mt-2"><strong>3. Savings Percentage:</strong></p>
                              <div className="ml-4 space-y-1">
                                <p>Savings % = Temperature Difference × 3% per °F</p>
                                <p className="mt-1">Example (Cooling):</p>
                                <p className="ml-2">7.0°F × 3% = 21.0% potential savings</p>
                                <p className="ml-2 text-gray-600 dark:text-gray-400 italic">Note: Only applies if settings are wasteful (heating too warm, cooling too cold)</p>
                              </div>
                              
                              <p className="mt-2"><strong>4. Monthly Savings Calculation:</strong></p>
                              <div className="ml-4 space-y-1">
                                <p><strong>Step 1: Calculate Base Monthly Cost</strong></p>
                                <p className="ml-2">Daily BTU = Heat Loss Factor × Avg ΔT × 24 hours</p>
                                <p className="ml-2">Daily kWh = Daily BTU ÷ (HSPF2 × 3412 BTU/kWh)</p>
                                <p className="ml-2">Daily Cost = Daily kWh × Electricity Rate</p>
                                <p className="ml-2">Monthly Cost = Daily Cost × 30 days</p>
                                <p className="mt-1"><strong>Step 2: Apply Savings Percentage</strong></p>
                                <p className="ml-2">Monthly Savings = Monthly Cost × Savings %</p>
                                <p className="mt-1">Example (Cooling, assuming $100/month base cost):</p>
                                <p className="ml-2">$100 × 21.0% = $21.00/month savings</p>
                              </div>
                              
                              <p className="mt-2"><strong>5. Optimization Opportunity Detection:</strong></p>
                              <div className="ml-4 space-y-1">
                                <p>Shows optimization opportunity if:</p>
                                <p className="ml-2">• Settings are invalid (outside reasonable ranges)</p>
                                <p className="ml-2">• Settings are wasteful AND temp diff &gt; 0.5°F</p>
                                <p className="ml-2">• Temp diff &gt; 1.5°F (comfort optimization)</p>
                                <p className="mt-1"><strong>Wasteful Definition:</strong></p>
                                <p className="ml-2">Heating: Current &gt; Optimal (too warm = wasteful)</p>
                                <p className="ml-2">Cooling: Current &lt; Optimal (too cold = wasteful)</p>
                                <p className="ml-2">Note: Cooling setpoints above optimal use less energy but sacrifice comfort</p>
                              </div>
                              
                              <p className="mt-2"><strong>6. Dual-Mode Optimization (Auto Mode):</strong></p>
                              <div className="ml-4 space-y-1">
                                <p>When both heating and cooling setpoints are configured:</p>
                                <p className="ml-2">• Calculates optimization for both modes separately</p>
                                <p className="ml-2">• Combines savings: Total = Heating Savings + Cooling Savings</p>
                                <p className="ml-2">• Shows opportunity if EITHER mode has savings or can be optimized</p>
                                <p className="ml-2">• Uses maximum temperature difference for display</p>
                              </div>
                              
                              <div className="mt-3 pt-2 border-t border-purple-200 dark:border-purple-800">
                                <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                                  <strong>Note:</strong> The Automizer uses ASHRAE 55 Standard for thermal comfort. 
                                  The 3% savings per degree is a rule-of-thumb estimate. Actual savings depend on 
                                  your home's characteristics, weather patterns, and usage patterns.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </details>
                    </>
                  );
              })()}
              </div>
            </div>
            </div>
          )}
          </div>
        </div>
      )}

      {/* Modeled Schedule (What-If) for City Comparison */}
      {mode === "comparison" && locationData && locationDataB && (
        <div className="mb-4" id="schedule">
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-800/90 via-slate-900/90 to-slate-800/90 border border-slate-700/50 rounded-2xl p-5 shadow-2xl shadow-slate-900/50 backdrop-blur-sm">
            {/* Subtle animated background */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-cyan-500/5 animate-pulse" />
            <div className="relative z-10">
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Modeled Schedule (What-If)
            </h2>
                  <p className="text-sm text-slate-400 flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 rounded-lg border border-slate-700/50">
                    <span>🔒</span>
                    <span>Safe to experiment</span>
                  </p>
                </div>
                <p className="text-sm text-slate-300">
                  This is a <strong className="text-blue-400">hypothetical schedule</strong> used only for modeling.
            </p>
          </div>

              {/* Simple Temperature and Time Controls - Grid Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
                {/* Winter Daytime Temperature */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                  <div className="relative bg-slate-800/50 backdrop-blur-sm border border-yellow-500/20 rounded-xl p-4 hover:border-yellow-500/40 transition-all duration-300">
                    <label className="flex items-center gap-2 text-base font-semibold text-slate-200 mb-3">
                      <Sun className="w-5 h-5 text-yellow-400" />
                      <span>Winter Daytime</span>
                      <span className="ml-auto text-xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                        {userSettings?.winterThermostatDay ?? 70}°F
                      </span>
                  </label>
                    <input
                      type="range"
                      min="60"
                      max="78"
                      value={userSettings?.winterThermostatDay ?? 70}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setUserSetting?.("winterThermostatDay", value);
                      }}
                      className="w-full h-3 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-yellow-500 hover:accent-yellow-400 transition-all"
                      style={{
                        background: `linear-gradient(to right, #fbbf24 0%, #fbbf24 ${((userSettings?.winterThermostatDay ?? 70) - 60) / 18 * 100}%, #374151 ${((userSettings?.winterThermostatDay ?? 70) - 60) / 18 * 100}%, #374151 100%)`
                      }}
                    />
                    <div className="flex justify-between text-xs text-slate-400 mt-2">
                      <span>60°F</span>
                      <span>78°F</span>
                    </div>
                  </div>
                </div>

                {/* Schedule Clock - Combined Daytime and Setback Times */}
                <div className="md:col-span-2 relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-yellow-500/10 to-orange-500/10 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                  <div className="relative bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-slate-600/50 transition-all duration-300">
                    <label className="flex items-center gap-2 text-base font-semibold text-slate-200 mb-4">
                      <Clock className="w-5 h-5 text-slate-400" />
                      <span>Schedule Times</span>
                    </label>
                    <ThermostatScheduleClock
                      daytimeStart={daytimeTime}
                      setbackStart={nighttimeTime}
                      onDaytimeStartChange={(time) => {
                        setDaytimeTime(time);
                        if (setUserSetting) {
                          setUserSetting("daytimeTime", time);
                        }
                      }}
                      onSetbackStartChange={(time) => {
                        setNighttimeTime(time);
                        if (setUserSetting) {
                          setUserSetting("nighttimeTime", time);
                        }
                      }}
                      compact={false}
                    />
                  </div>
                </div>

                {/* Winter Nighttime Temperature */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                  <div className="relative bg-slate-800/50 backdrop-blur-sm border border-blue-500/20 rounded-xl p-4 hover:border-blue-500/40 transition-all duration-300">
                    <label className="flex items-center gap-2 text-base font-semibold text-slate-200 mb-3">
                      <Moon className="w-5 h-5 text-blue-400" />
                      <span>Winter Nighttime</span>
                      <span className="ml-auto text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                        {userSettings?.winterThermostatNight ?? 66}°F
                      </span>
                  </label>
                    <input
                      type="range"
                      min="60"
                      max="78"
                      value={userSettings?.winterThermostatNight ?? 66}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setUserSetting?.("winterThermostatNight", value);
                      }}
                      className="w-full h-3 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((userSettings?.winterThermostatNight ?? 66) - 60) / 18 * 100}%, #374151 ${((userSettings?.winterThermostatNight ?? 66) - 60) / 18 * 100}%, #374151 100%)`
                      }}
                    />
                    <div className="flex justify-between text-xs text-slate-400 mt-2">
                      <span>60°F</span>
                      <span>78°F</span>
                  </div>
                </div>
              </div>
            </div>

              {/* Summer Temperature Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                {/* Summer Daytime Temperature */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-teal-500/10 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                  <div className="relative bg-slate-800/50 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-4 hover:border-cyan-500/40 transition-all duration-300">
                    <label className="flex items-center gap-2 text-base font-semibold text-slate-200 mb-3">
                      <Sun className="w-5 h-5 text-cyan-400" />
                      <span>Summer Daytime</span>
                      <span className="ml-auto text-xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
                        {userSettings?.summerThermostat ?? 76}°F
                      </span>
                  </label>
                    <input
                      type="range"
                      min="68"
                      max="82"
                      value={userSettings?.summerThermostat ?? 76}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setUserSetting?.("summerThermostat", value);
                      }}
                      className="w-full h-3 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 transition-all"
                      style={{
                        background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${((userSettings?.summerThermostat ?? 76) - 68) / 14 * 100}%, #374151 ${((userSettings?.summerThermostat ?? 76) - 68) / 14 * 100}%, #374151 100%)`
                      }}
                    />
                    <div className="flex justify-between text-xs text-slate-400 mt-2">
                      <span>68°F</span>
                      <span>82°F</span>
                  </div>
                </div>
                </div>

                {/* Summer Nighttime Temperature */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                  <div className="relative bg-slate-800/50 backdrop-blur-sm border border-purple-500/20 rounded-xl p-4 hover:border-purple-500/40 transition-all duration-300">
                    <label className="flex items-center gap-2 text-base font-semibold text-slate-200 mb-3">
                      <Moon className="w-5 h-5 text-purple-400" />
                      <span>Summer Nighttime</span>
                      <span className="ml-auto text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        {userSettings?.summerThermostatNight ?? userSettings?.summerThermostat ?? 78}°F
                      </span>
                  </label>
                    <input
                      type="range"
                      min="68"
                      max="82"
                      value={userSettings?.summerThermostatNight ?? userSettings?.summerThermostat ?? 78}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setUserSetting?.("summerThermostatNight", value);
                      }}
                      className="w-full h-3 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400 transition-all"
                      style={{
                        background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${((userSettings?.summerThermostatNight ?? userSettings?.summerThermostat ?? 78) - 68) / 14 * 100}%, #374151 ${((userSettings?.summerThermostatNight ?? userSettings?.summerThermostat ?? 78) - 68) / 14 * 100}%, #374151 100%)`
                      }}
                    />
                    <div className="flex justify-between text-xs text-slate-400 mt-2">
                      <span>68°F</span>
                      <span>82°F</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Schedule Summary */}
              <div className="mt-3 pt-3 border-t border-slate-700/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs uppercase tracking-wider text-slate-400 mb-1.5 font-semibold">Current Modeled Schedule</div>
                    <div className="text-sm text-slate-200 font-medium bg-slate-900/30 rounded-lg px-2.5 py-1.5 border border-slate-700/30">
                      {(() => {
                        const timeToMinutes = (time) => {
                          const [h, m] = time.split(':').map(Number);
                          return h * 60 + m;
                        };
                        const formatTime = (time) => {
                          const [h, m] = time.split(':').map(Number);
                          const period = h >= 12 ? 'PM' : 'AM';
                          const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
                          return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
                        };
                        const calculateDuration = (startMins, endMins) => {
                          if (startMins < endMins) {
                            return endMins - startMins;
                          } else {
                            return (24 * 60) - startMins + endMins;
                          }
                        };
                        const dayMins = timeToMinutes(daytimeTime);
                        const nightMins = timeToMinutes(nighttimeTime);
                        const dayDuration = calculateDuration(dayMins, nightMins);
                        const nightDuration = calculateDuration(nightMins, dayMins);
                        const dayHours = Math.round(dayDuration / 60 * 10) / 10;
                        const nightHours = Math.round(nightDuration / 60 * 10) / 10;
                        const winterDay = userSettings?.winterThermostatDay ?? 70;
                        const winterNight = userSettings?.winterThermostatNight ?? 66;
                        const summerDay = userSettings?.summerThermostat ?? 76;
                        const summerNight = userSettings?.summerThermostatNight ?? userSettings?.summerThermostat ?? 78;
                        
                        const formatScheduleCompact = (dayTemp, nightTemp, label) => {
                          if (dayMins < nightMins) {
                            return (
                              <div className="text-xs">
                                <span className="text-slate-400 font-semibold">{label}:</span> {formatTime(daytimeTime)}–{formatTime(nighttimeTime)} {dayTemp}°F ({dayHours}h) | {formatTime(nighttimeTime)}–{formatTime(daytimeTime)} {nightTemp}°F ({nightHours}h)
                              </div>
                            );
                          } else {
                            return (
                              <div className="text-xs">
                                <span className="text-slate-400 font-semibold">{label}:</span> {formatTime(nighttimeTime)}–{formatTime(daytimeTime)} {nightTemp}°F ({nightHours}h) | {formatTime(daytimeTime)}–{formatTime(nighttimeTime)} {dayTemp}°F ({dayHours}h)
                              </div>
                            );
                          }
                        };
                        
                        return (
                          <div className="space-y-1.5">
                            {formatScheduleCompact(winterDay, winterNight, "Winter")}
                            {formatScheduleCompact(summerDay, summerNight, "Summer")}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-400 italic mt-1.5 flex items-center gap-1.5">
                  <span className="text-yellow-400">💡</span>
                  <span><em>Tip:</em> Big night setbacks can trigger strip heat in the morning.</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Annual Budget Comparison */}
      {mode === "comparison" && locationData && locationDataB && annualComparisonCosts && (
        <div className="glass-card-gradient glass-card p-3 mb-2 animate-fade-in-up">
          <div className="text-center mb-3">
            <h2 className="text-base font-bold mb-1">
              📅 Annual Budget Comparison (Auto Mode - All 12 Months)
            </h2>
            <p className="text-xs text-muted">
              Includes heating and cooling costs using sinusoidal day/night patterns and Ecobee auto-mode logic.
              <br />
              <strong>Note:</strong> Annual comparisons always use "Typical (30-Yr Avg)" climate data since you cannot forecast an entire year.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
            {/* Location A Annual */}
            <div className="glass-card p-2 border-blue-500/30">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <MapPin
                    size={14}
                    className="text-blue-500"
                  />
                  <h3 className="text-xs font-semibold text-high-contrast">
                    {locationData.city}, {locationData.state}
                  </h3>
                </div>
                <div className="text-3xl font-black text-high-contrast mb-1">
                  ${annualComparisonCosts.locationA.totalAnnual.toFixed(2)}
                </div>
                <p className="text-[10px] text-muted mb-1">
                  Annual cost
                </p>
                <div className="text-xs text-muted space-y-0.5">
                  <div>Heating: ${annualComparisonCosts.locationA.totalHeating.toFixed(2)}</div>
                  <div>Cooling: ${annualComparisonCosts.locationA.totalCooling.toFixed(2)}</div>
                  <div>Fixed: ${annualComparisonCosts.locationA.totalFixed.toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Location B Annual */}
            <div className="glass-card p-2 border-green-500/30">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <MapPin
                    size={14}
                    className="text-green-500"
                  />
                  <h3 className="text-xs font-semibold text-high-contrast">
                    {locationDataB.city}, {locationDataB.state}
                  </h3>
                </div>
                <div className="text-3xl font-black text-high-contrast mb-1">
                  ${annualComparisonCosts.locationB.totalAnnual.toFixed(2)}
                </div>
                <p className="text-[10px] text-muted mb-1">
                  Annual cost
                </p>
                <div className="text-xs text-muted space-y-0.5">
                  <div>Heating: ${annualComparisonCosts.locationB.totalHeating.toFixed(2)}</div>
                  <div>Cooling: ${annualComparisonCosts.locationB.totalCooling.toFixed(2)}</div>
                  <div>Fixed: ${annualComparisonCosts.locationB.totalFixed.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Climate Flex Score Card */}
          {locationData && locationDataB && (() => {
            const annualHDDA = getAnnualHDD(locationData.city, locationData.state);
            const annualHDDB = getAnnualHDD(locationDataB.city, locationDataB.state);
            const annualCDDA = getAnnualCDD(locationData.city, locationData.state);
            const annualCDDB = getAnnualCDD(locationDataB.city, locationDataB.state);
            
            // Calculate monthly costs for comparison
            const monthlyHDDDist = [1200, 1000, 600, 200, 50, 10, 0, 0, 20, 200, 500, 1100];
            const monthlyCDDDist = [0, 0, 10, 60, 150, 300, 400, 350, 200, 80, 10, 0];
            const totalTypicalHDD = monthlyHDDDist.reduce((a, b) => a + b, 0);
            const totalTypicalCDD = monthlyCDDDist.reduce((a, b) => a + b, 0);
            
            let totalCostA = 0;
            let totalCostB = 0;
            
            for (let month = 0; month < 12; month++) {
              const monthHDDA = totalTypicalHDD > 0 ? (monthlyHDDDist[month] / totalTypicalHDD) * annualHDDA : 0;
              const monthHDDB = totalTypicalHDD > 0 ? (monthlyHDDDist[month] / totalTypicalHDD) * annualHDDB : 0;
              const monthCDDA = totalTypicalCDD > 0 ? (monthlyCDDDist[month] / totalTypicalCDD) * annualCDDA : 0;
              const monthCDDB = totalTypicalCDD > 0 ? (monthlyCDDDist[month] / totalTypicalCDD) * annualCDDB : 0;
              
              if (monthHDDA > 0) {
                const est = estimateMonthlyHeatingCostFromHDD({ hdd: monthHDDA, squareFeet, insulationLevel, homeShape, ceilingHeight, hspf: hspf2 || efficiency, electricityRate: utilityCost });
                totalCostA += est?.cost || 0;
              }
              if (monthHDDB > 0) {
                const est = estimateMonthlyHeatingCostFromHDD({ hdd: monthHDDB, squareFeet, insulationLevel, homeShape, ceilingHeight, hspf: hspf2 || efficiency, electricityRate: utilityCost });
                totalCostB += est?.cost || 0;
              }
              if (monthCDDA > 0) {
                const est = estimateMonthlyCoolingCostFromCDD({ cdd: monthCDDA, squareFeet, insulationLevel, homeShape, ceilingHeight, capacity: coolingCapacity || capacity, seer2: efficiency, electricityRate: utilityCost, solarExposure });
                totalCostA += est?.cost || 0;
              }
              if (monthCDDB > 0) {
                const est = estimateMonthlyCoolingCostFromCDD({ cdd: monthCDDB, squareFeet, insulationLevel, homeShape, ceilingHeight, capacity: coolingCapacity || capacity, seer2: efficiency, electricityRate: utilityCost, solarExposure });
                totalCostB += est?.cost || 0;
              }
            }
            
            const savings = totalCostB - totalCostA;
            const heatLoadRatio = annualHDDA > 0 ? (annualHDDB / annualHDDA).toFixed(1) : 'N/A';
            const isWarmer = totalCostA < totalCostB;
            
            if (!isWarmer || savings < 10) return null; // Only show if Location A is warmer and savings are meaningful
            
            return (
              <div className="mt-3 glass-card p-2 border-green-500/30 bg-gradient-to-br from-green-900/10 to-emerald-900/10">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <span className="text-lg">🌎</span>
                    <h3 className="text-sm font-bold text-high-contrast">Climate Flex</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                    <div className="bg-[#0c1218] border border-[#1c2733] rounded-lg p-2">
                      <div className="text-gray-400 text-[10px] mb-1">{locationData.city}</div>
                      <div className="text-blue-400 font-bold text-sm mb-0.5">{annualHDDA.toLocaleString()} HDD</div>
                      <div className="text-cyan-400 font-bold text-sm">{annualCDDA.toLocaleString()} CDD</div>
                    </div>
                    <div className="bg-[#0c1218] border border-[#1c2733] rounded-lg p-2">
                      <div className="text-gray-400 text-[10px] mb-1">{locationDataB.city}</div>
                      <div className="text-orange-400 font-bold text-sm mb-0.5">{annualHDDB.toLocaleString()} HDD</div>
                      <div className="text-yellow-400 font-bold text-sm">{annualCDDB.toLocaleString()} CDD</div>
                      {annualHDDA > 0 && (
                        <div className="text-[10px] text-gray-500 mt-1">
                          ~{heatLoadRatio}× more heating
                    </div>
                      )}
                      {annualCDDA > 0 && annualCDDB > 0 && (
                        <div className="text-[10px] text-gray-500">
                          ~{(annualCDDB / annualCDDA).toFixed(1)}× cooling
                  </div>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-[10px] text-gray-400 italic mt-2">
                    Physics: saves money before you touch your thermostat.
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Comparison Results Card */}
      {mode === "comparison" &&
        monthlyEstimate &&
        monthlyEstimateB &&
        locationData &&
        locationDataB && (
          <div className="glass-card-gradient glass-card p-glass-lg mb-4 animate-fade-in-up">
            {/* Weather Model Selector - Right above monthly estimate */}
            {energyMode === "heating" && (
              <div className="mb-4 glass-card p-2 border-blue-500/30">
                <div className="flex items-center gap-1.5 mb-1">
                  <Cloud className="text-blue-500" size={14} />
                  <span className="text-xs font-semibold text-high-contrast">Weather</span>
                </div>
                <select
                  value={forecastModel}
                  onChange={(e) => setForecastModel(e.target.value)}
                  className={`${selectClasses} text-xs py-1`}
                >
                  <option value="typical">Typical (30-Yr Avg)</option>
                  <option value="current">Current Forecast</option>
                  <option value="polarVortex">Polar Vortex (-5°F)</option>
                </select>
                {forecastModel === "polarVortex" && (
                  <div className="mt-1.5 p-1.5 glass-card border-red-500/30 bg-red-900/10 text-[10px] text-high-contrast">
                    <p className="font-semibold">⚠️ 30-40% higher costs</p>
                  </div>
                )}
                {forecastModel === "current" && dailyForecast && dailyForecast.some(d => d.source === "forecast") && (
                  <div className="mt-1.5 p-1.5 glass-card border-blue-500/30 bg-blue-900/10 text-[10px] text-high-contrast">
                    <p>✓ Live forecast active</p>
                  </div>
                )}
              </div>
            )}
            
            <div className="text-center mb-6">
              <p className="text-sm font-semibold text-high-contrast mb-2">
                📅 Monthly Budget Comparison:{" "}
                {activeMonths
                  .find((m) => m.value === selectedMonth)
                  ?.label.toUpperCase()}{" "}
                @ {Math.round(effectiveIndoorTemp)}°F ({energyMode.toUpperCase()})
              </p>
              {monthlyEstimate.electricityRate !==
                monthlyEstimateB.electricityRate && (
                <p className="text-xs text-muted">
                  Using location-specific electricity rates
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-glass mb-3">
              {/* Location A */}
              <div className="glass-card p-glass border-blue-500/30">
                <div className="text-xs font-semibold text-blue-500 mb-2">
                  <MapPin size={12} className="inline mr-1" />{" "}
                  {locationData.city}, {locationData.state}
                </div>
                <div className="text-5xl font-black text-high-contrast mb-2">
                  ${monthlyEstimate.cost.toFixed(2)}
                </div>
                <span
                  data-testid="monthly-method-a"
                  data-method={monthlyEstimate.method}
                  className="sr-only"
                >
                  {monthlyEstimate.method}
                </span>
                <div className="text-sm text-muted">
                  {monthlyEstimate.method === "gasFurnace"
                    ? `${
                        monthlyEstimate.therms?.toFixed(1) ?? "0.0"
                      } therms/month`
                    : formatEnergyFromKwh(monthlyEstimate.energy ?? 0, unitSystem, { decimals: 0 }) + "/month"}
                </div>
                {monthlyEstimate.method === "heatPumpHeating" && (
                  <div className="text-xs text-muted mt-1">
                    @ ${monthlyEstimate.electricityRate.toFixed(3)}/kWh
                  </div>
                )}
                {monthlyEstimate.method === "gasFurnace" && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    @ $
                    {monthlyEstimate.gasCost?.toFixed(2) ?? gasCost.toFixed(2)}
                    /therm ({Math.round(afue * 100)}% AFUE)
                  </div>
                )}
                {/* CO2 Footprint */}
                <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    CO2:{" "}
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {(() => {
                        const co2Lbs =
                          monthlyEstimate.method === "gasFurnace"
                            ? calculateGasCO2(monthlyEstimate.therms ?? 0).lbs
                            : calculateElectricityCO2(
                                monthlyEstimate.energy ?? 0,
                                locationData.state
                              ).lbs;
                        const equivalent = getBestEquivalent(co2Lbs);
                        const equivalents = calculateCO2Equivalents(co2Lbs);
                        let co2Display = "N/A";
                        if (Number.isFinite(co2Lbs)) {
                          co2Display =
                            co2Lbs >= 1 ? formatCO2(co2Lbs) : "< 1 lb";
                        }
                        return (
                          <>
                            {co2Display}
                            {co2Lbs > 10 && (
                              <>
                                <span className="block text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 font-normal">
                                  ≈ {equivalent.text}
                                </span>
                                {equivalents.treeSeedlings >= 1 && (
                                  <span className="block text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 font-normal">
                                    Plant {Math.round(equivalents.treeSeedlings)} tree{Math.round(equivalents.treeSeedlings) !== 1 ? 's' : ''} to offset
                                  </span>
                                )}
                              </>
                            )}
                          </>
                        );
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Location B */}
              <div className="glass-card p-glass border-green-500/30">
                <div className="text-xs font-semibold text-green-500 mb-2">
                  <MapPin size={12} className="inline mr-1" />{" "}
                  {locationDataB.city}, {locationDataB.state}
                </div>
                <div className="text-5xl font-black text-high-contrast mb-2">
                  ${monthlyEstimateB.cost.toFixed(2)}
                </div>
                <span
                  data-testid="monthly-method-b"
                  data-method={monthlyEstimateB.method}
                  className="sr-only"
                >
                  {monthlyEstimateB.method}
                </span>
                <div className="text-sm text-muted">
                  {monthlyEstimateB.method === "gasFurnace"
                    ? `${
                        monthlyEstimateB.therms?.toFixed(1) ?? "0.0"
                      } therms/month`
                    : formatEnergyFromKwh(monthlyEstimateB.energy ?? 0, unitSystem, { decimals: 0 }) + "/month"}
                </div>
                {monthlyEstimateB.method === "heatPumpHeating" && (
                  <div className="text-xs text-muted mt-1">
                    @ ${monthlyEstimateB.electricityRate.toFixed(3)}/kWh
                  </div>
                )}
                {monthlyEstimateB.method === "gasFurnace" && (
                  <div className="text-xs text-muted mt-1">
                    @ $
                    {monthlyEstimateB.gasCost?.toFixed(2) ?? gasCost.toFixed(2)}
                    /therm ({Math.round(afue * 100)}% AFUE)
                  </div>
                )}
                {/* CO2 Footprint */}
                <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    CO2:{" "}
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {(() => {
                        const co2Lbs =
                          monthlyEstimateB.method === "gasFurnace"
                            ? calculateGasCO2(monthlyEstimateB.therms ?? 0).lbs
                            : calculateElectricityCO2(
                                monthlyEstimateB.energy ?? 0,
                                locationDataB.state
                              ).lbs;
                        const equivalent = getBestEquivalent(co2Lbs);
                        const equivalents = calculateCO2Equivalents(co2Lbs);
                        let co2Display = "N/A";
                        if (Number.isFinite(co2Lbs)) {
                          co2Display =
                            co2Lbs >= 1 ? formatCO2(co2Lbs) : "< 1 lb";
                        }
                        return (
                          <>
                            {co2Display}
                            {co2Lbs > 10 && (
                              <>
                                <span className="block text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 font-normal">
                                  ≈ {equivalent.text}
                                </span>
                                {equivalents.treeSeedlings >= 1 && (
                                  <span className="block text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 font-normal">
                                    Plant {Math.round(equivalents.treeSeedlings)} tree{Math.round(equivalents.treeSeedlings) !== 1 ? 's' : ''} to offset
                                  </span>
                                )}
                              </>
                            )}
                          </>
                        );
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Difference Callout */}
            <div
              className={`rounded-lg p-4 text-center ${
                monthlyEstimateB.cost > monthlyEstimate.cost
                  ? "bg-red-100 dark:bg-red-900/40 border-2 border-red-400 dark:border-red-700"
                  : "bg-green-100 dark:bg-green-900/40 border-2 border-green-400 dark:border-green-700"
              }`}
            >
              <p
                className={`text-lg font-bold ${
                  monthlyEstimateB.cost > monthlyEstimate.cost
                    ? "text-red-700 dark:text-red-300"
                    : "text-green-700 dark:text-green-300"
                }`}
              >
                {monthlyEstimateB.cost > monthlyEstimate.cost
                  ? `💸 Moving to ${locationDataB.city} would cost $${(
                      monthlyEstimateB.cost - monthlyEstimate.cost
                    ).toFixed(2)} more for ${activeMonths.find((m) => m.value === selectedMonth)?.label || "this month"}`
                  : `💰 Moving to ${locationDataB.city} would SAVE $${(
                      monthlyEstimate.cost - monthlyEstimateB.cost
                    ).toFixed(2)} for ${activeMonths.find((m) => m.value === selectedMonth)?.label || "this month"}`}
              </p>
            </div>
            {typeof thermostatEquivalency === "number" && (
              <div className="mt-4 text-sm text-center">
                <p>
                  To match your cost in <strong>{locationData.city}</strong>,
                  you'd need to set the thermostat to{" "}
                  <strong>{thermostatEquivalency}°F</strong> in{" "}
                  <strong>{locationDataB.city}</strong> for the same month.
                </p>
              </div>
            )}

            {/* Sinusoidal Temperature Graphs for Both Cities */}
            {mode === "comparison" && locationData && locationDataB && (() => {
              // Generate temperature data for both cities
              // Priority: 1) Historical data from Open-Meteo API, 2) Forecast data, 3) Synthetic from HDD/CDD
              const usingSyntheticData = !historicalTempsA && !adjustedForecast && !historicalTempsB;
              
              const generateTempsFromHDD = (city, state, monthIndex) => {
                const annualHDD = getAnnualHDD(city, state);
                const annualCDD = getAnnualCDD(city, state);
                const monthlyHDDDist = [1200, 1000, 600, 200, 50, 10, 0, 0, 20, 200, 500, 1100];
                const monthlyCDDDist = [0, 0, 10, 60, 150, 300, 400, 350, 200, 80, 10, 0];
                const totalTypicalHDD = monthlyHDDDist.reduce((a, b) => a + b, 0);
                const totalTypicalCDD = monthlyCDDDist.reduce((a, b) => a + b, 0);
                
                const monthHDD = totalTypicalHDD > 0 ? (monthlyHDDDist[monthIndex] / totalTypicalHDD) * annualHDD : 0;
                const monthCDD = totalTypicalCDD > 0 ? (monthlyCDDDist[monthIndex] / totalTypicalCDD) * annualCDD : 0;
                
                // Estimate typical daily low/high based on HDD/CDD
                // Higher HDD = colder (lower temps), Higher CDD = hotter (higher temps)
                const baseTemp = 50;
                const tempRange = 20; // Typical 20°F range between low and high
                
                let dailyLow, dailyHigh;
                if (monthHDD > 0) {
                  // Heating month: colder = lower temps
                  dailyLow = baseTemp - (monthHDD / 30); // Colder months have lower temps
                  dailyHigh = dailyLow + tempRange;
                } else if (monthCDD > 0) {
                  // Cooling month: hotter = higher temps
                  dailyHigh = baseTemp + (monthCDD / 20); // Hotter months have higher temps
                  dailyLow = dailyHigh - tempRange;
                } else {
                  // Transition month
                  dailyLow = baseTemp - 5;
                  dailyHigh = baseTemp + 15;
                }
                
                return { dailyLow, dailyHigh };
              };
              
              // Get or generate temperature data for Location A
              let tempsA = historicalTempsA || adjustedForecast || [];
              if (tempsA.length === 0 && locationData) {
                // Generate from HDD/CDD
                const { dailyLow, dailyHigh } = generateTempsFromHDD(locationData.city, locationData.state, selectedMonth - 1);
                const daysInMonth = new Date(2020, selectedMonth, 0).getDate();
                tempsA = Array.from({ length: daysInMonth }, (_, i) => ({
                  date: new Date(2020, selectedMonth - 1, i + 1),
                  low: dailyLow,
                  high: dailyHigh,
                  avg: (dailyLow + dailyHigh) / 2,
                }));
              }
              
              // Get or generate temperature data for Location B
              let tempsB = historicalTempsB || [];
              if (tempsB.length === 0 && locationDataB) {
                // Generate from HDD/CDD
                const { dailyLow, dailyHigh } = generateTempsFromHDD(locationDataB.city, locationDataB.state, selectedMonth - 1);
                const daysInMonth = new Date(2020, selectedMonth, 0).getDate();
                tempsB = Array.from({ length: daysInMonth }, (_, i) => ({
                  date: new Date(2020, selectedMonth - 1, i + 1),
                  low: dailyLow,
                  high: dailyHigh,
                  avg: (dailyLow + dailyHigh) / 2,
                }));
              }
              
              if (tempsA.length === 0 || tempsB.length === 0) return null;
              
              // Generate hourly temperature data for Location A using sinusoidal pattern
              const graphDataA = [];
              tempsA.forEach((day, dayIndex) => {
                const lowTemp = day.low;
                const highTemp = day.high;
                const tempRange = highTemp - lowTemp;
                const avgTemp = (highTemp + lowTemp) / 2;
                
                for (let hour = 0; hour < 24; hour++) {
                  const phase = ((hour - 6) / 12) * Math.PI;
                  const tempOffset = Math.cos(phase - Math.PI) * (tempRange / 2);
                  const hourlyTemp = avgTemp + tempOffset;
                  
                  const dayDate = day.date ? (day.date instanceof Date ? day.date : new Date(day.date)) : new Date(2020, selectedMonth - 1, dayIndex + 1);
                  
                  graphDataA.push({
                    day: dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    hour: dayIndex * 24 + hour,
                    hourLabel: dayIndex === 0 && hour % 6 === 0 ? (hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`) : '',
                    temperature: Math.round(hourlyTemp * 10) / 10,
                    city: locationData.city,
                  });
                }
              });

              // Generate hourly temperature data for Location B using sinusoidal pattern
              const graphDataB = [];
              tempsB.forEach((day, dayIndex) => {
                const lowTemp = day.low;
                const highTemp = day.high;
                const tempRange = highTemp - lowTemp;
                const avgTemp = (highTemp + lowTemp) / 2;
                
                for (let hour = 0; hour < 24; hour++) {
                  const phase = ((hour - 6) / 12) * Math.PI;
                  const tempOffset = Math.cos(phase - Math.PI) * (tempRange / 2);
                  const hourlyTemp = avgTemp + tempOffset;
                  
                  const dayDate = day.date ? (day.date instanceof Date ? day.date : new Date(day.date)) : new Date(2020, selectedMonth - 1, dayIndex + 1);
                  
                  graphDataB.push({
                    day: dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    hour: dayIndex * 24 + hour,
                    hourLabel: dayIndex === 0 && hour % 6 === 0 ? (hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`) : '',
                    temperature: Math.round(hourlyTemp * 10) / 10,
                    city: locationDataB.city,
                  });
                }
              });

              // Combine data for comparison - align by day
              const maxDays = Math.max(graphDataA.length / 24, graphDataB.length / 24);
              const combinedData = [];
              for (let dayIdx = 0; dayIdx < maxDays; dayIdx++) {
                for (let hour = 0; hour < 24; hour++) {
                  const idxA = dayIdx * 24 + hour;
                  const idxB = dayIdx * 24 + hour;
                  const pointA = graphDataA[idxA];
                  const pointB = graphDataB[idxB];
                  if (pointA || pointB) {
                    combinedData.push({
                      day: pointA?.day || pointB?.day || `Day ${dayIdx + 1}`,
                      hour: dayIdx * 24 + hour,
                      hourLabel: dayIdx === 0 && hour % 6 === 0 ? (hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`) : '',
                      temperature: pointA?.temperature || 0,
                      temperatureB: pointB?.temperature || 0,
                    });
                  }
                }
              }
              
              if (combinedData.length === 0) return null;

              return (
                <div className="mt-6 space-y-4">
                  <h4 className="text-sm font-semibold text-high-contrast text-center">
                    📈 Daily Temperature Patterns (Sinusoidal)
                  </h4>
                  <div className="text-xs text-muted text-center mb-4 space-y-2">
                    {usingSyntheticData ? (
                      <>
                        <p>
                          <strong>Note:</strong> Using synthetic temperature data generated from HDD/CDD climate data (not from an API). 
                          Hourly temperatures follow a sinusoidal pattern: lowest around 6 AM, highest around 6 PM. 
                          This pattern is used to calculate costs, especially for heat pumps where nighttime aux heat needs are critical.
                        </p>
                        <button
                          onClick={() => setForecastModel("current")}
                          className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
                        >
                          📊 Switch to Historical Weather Model
                        </button>
                        <p className="text-[10px] text-gray-400 mt-1">
                          Get actual historical hourly temperatures from Open-Meteo API
                        </p>
                      </>
                    ) : (
                      <p>
                        Hourly temperatures from {historicalTempsA || historicalTempsB ? 'Open-Meteo historical API' : 'forecast data'} 
                        with sinusoidal interpolation: lowest around 6 AM, highest around 6 PM. 
                        This pattern is used to calculate costs, especially for heat pumps where nighttime aux heat needs are critical.
                      </p>
                    )}
                  </div>
                  <div className="w-full" style={{ height: '350px', minHeight: '350px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={combinedData} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis 
                          dataKey="day" 
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          stroke="#6b7280"
                          tick={{ fontSize: 10 }}
                          interval="preserveStartEnd"
                        />
                        <YAxis 
                          label={{ value: 'Temperature (°F)', angle: -90, position: 'insideLeft' }}
                          stroke="#6b7280"
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              const hour = data.hour % 24;
                              const hourLabel = hour === 0 ? '12 AM' : 
                                               hour < 12 ? `${hour} AM` : 
                                               hour === 12 ? '12 PM' : 
                                               `${hour - 12} PM`;
                              return (
                                <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow-lg">
                                  <p className="text-xs font-semibold mb-1">{data.day}</p>
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{hourLabel}</p>
                                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                    {locationData.city}: {data.temperature.toFixed(1)}°F
                                  </p>
                                  {data.temperatureB && (
                                    <p className="text-sm font-bold text-green-600 dark:text-green-400">
                                      {locationDataB.city}: {data.temperatureB.toFixed(1)}°F
                                    </p>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="temperature" 
                          stroke="#3b82f6" 
                          strokeWidth={2}
                          dot={false}
                          name={locationData.city}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="temperatureB" 
                          stroke="#10b981" 
                          strokeWidth={2}
                          dot={false}
                          name={locationDataB.city}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-4">
          <Cloud
            className="animate-spin mx-auto mb-2 text-blue-500"
            size={32}
          />
          <p className="text-muted">
            Fetching historical climate data...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="glass-card p-glass mb-6 border-red-500/30 text-high-contrast animate-fade-in-up">
          <p className="font-semibold">{error}</p>
        </div>
      )}

      {/* Footer Section - Removed for simplified design */}
      {/* eslint-disable-next-line no-constant-binary-expression -- intentionally dead code for future use */}
      {false && (
      <div className="mt-16 pt-10 border-t-2 border-gray-300/30 dark:border-gray-700/30">
        {/* Disclaimer */}
        <div className="glass-card p-4 mb-4 border-orange-500/40 bg-orange-50/20 dark:bg-orange-950/20 rounded-lg animate-fade-in-up">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-base font-bold text-orange-600 dark:text-orange-400 mb-2">
                ⚠️ Disclaimer
              </p>
              <p className="text-sm text-high-contrast/90 leading-relaxed">
                <strong>This is a planning estimate, not a bill.</strong> It's based on long-term weather average. Your real costs will change with actual weather and how you use your system.
              </p>
            </div>
          </div>
        </div>

        {/* How This Works - Enhanced */}
        <div className="glass-card p-5 mb-4 animate-fade-in-up border-blue-500/30 bg-blue-50/10 dark:bg-blue-950/10 rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <Info className="w-6 h-6 text-blue-500" />
            <h3 className="text-xl font-bold text-high-contrast">
              How This Works
            </h3>
          </div>
          <ul className="text-base text-high-contrast/90 space-y-3 leading-relaxed">
            <li className="flex items-start gap-3">
              <span className="text-blue-500 font-bold mt-0.5">•</span>
              <span>We use 30 years of typical weather data for your location.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-500 font-bold mt-0.5">•</span>
              <span>We simulate how your home responds to that weather.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-500 font-bold mt-0.5">•</span>
              <span>We combine that with your thermostat schedule and your utility rates.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-500 font-bold mt-0.5">•</span>
              <span>The result: a best-guess budget, not a guarantee.</span>
            </li>
          </ul>
        </div>
      </div>
      )}

      {/* Compare Upgrade Button - Removed for simplified design */}
      {/* eslint-disable-next-line no-constant-binary-expression -- intentionally dead code for future use */}
      {false && (
      <div className="flex justify-center mt-8">
        <Link
          to="/cost-comparison"
          className="btn-gradient inline-flex items-center gap-2"
        >
          Compare Upgrade →
        </Link>
      </div>
      )}

      {/* Live Math Calculations Pulldown - Monthly Mode Only */}
      {mode !== "annual" && (mode !== "budget" || showDetails) && (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden mt-8">
        <button
          onClick={() => setShowCalculations(!showCalculations)}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
              <GraduationCap size={24} className="text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Show me the math (Monthly Forecast)</h3>
          </div>
          {showCalculations ? (
            <ChevronUp className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          ) : (
            <ChevronDown className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          )}
        </button>

        {showCalculations && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3 text-[14pt] [&_.text-sm]:text-[14pt] [&_.text-xs]:text-[12pt]">
            {/* Building Characteristics */}
            <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Building Characteristics</h4>
              {/* Heat Loss Method Indicator */}
              {(() => {
                const useCalculated = userSettings?.useCalculatedHeatLoss !== false; // Default to true
                const useManual = Boolean(userSettings?.useManualHeatLoss);
                const useAnalyzer = Boolean(userSettings?.useAnalyzerHeatLoss);
                const useLearned = Boolean(userSettings?.useLearnedHeatLoss) && shouldUseLearnedHeatLoss();
                
                let methodLabel = "";
                let methodColor = "text-blue-600 dark:text-blue-400";
                
                if (useManual) {
                  methodLabel = "Using Manual Entry";
                  methodColor = "text-purple-600 dark:text-purple-400";
                } else if (useAnalyzer) {
                  methodLabel = "Using CSV Analyzer Data";
                  methodColor = "text-amber-600 dark:text-amber-400";
                } else if (useLearned) {
                  methodLabel = "Using Bill Data (Auto-learned)";
                  methodColor = "text-emerald-600 dark:text-emerald-400";
                } else if (useCalculated) {
                  methodLabel = "Using Calculated (DOE Data)";
                  methodColor = "text-blue-600 dark:text-blue-400";
                }
                
                const hasLearnedButNotYet = Boolean(userSettings?.useLearnedHeatLoss && userSettings?.learnedHeatLoss > 0) && !shouldUseLearnedHeatLoss();
                if (methodLabel) {
                  return (
                    <div className="mb-3">
                      <div className={`text-xs font-semibold ${methodColor} bg-white dark:bg-gray-800 rounded px-2 py-1 inline-block border border-current`}>
                        📊 {methodLabel}
                      </div>
                      {hasLearnedButNotYet && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                          Bill data available; Joule uses DOE until 30+ days of actual bill data are entered.
                        </p>
                      )}
                    </div>
                  );
                }
                return null;
              })()}
              <div className="space-y-2 text-sm font-mono text-gray-700 dark:text-gray-300">
                <div className="flex justify-between">
                  <span>Square Feet:</span>
                  <span className="font-bold">{squareFeet.toLocaleString()} sq ft</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 italic mt-1 mb-2">
                  <strong>Note:</strong> This is heated floor area (not total surface area). For non-standard structures like school buses, tiny homes, or RVs, enter actual conditioned floor space (typically 200-400 sq ft) and adjust insulation level accordingly.
                </div>
                <div className="flex justify-between">
                  <span>Insulation Level:</span>
                  <span className="font-bold">{insulationLevel.toFixed(2)}x</span>
                </div>
                <div className="flex justify-between">
                  <span>Home Shape Factor:</span>
                  <span className="font-bold">{homeShape.toFixed(2)}x</span>
                </div>
                <div className="flex justify-between">
                  <span>Ceiling Height:</span>
                  <span className="font-bold">{ceilingHeight} ft</span>
                </div>
                <div className="flex justify-between">
                  <span>Ceiling Multiplier:</span>
                  <span className="font-bold">{(1 + (ceilingHeight - 8) * 0.1).toFixed(3)}x</span>
                </div>
                <div className="pt-2 border-t border-blue-300 dark:border-blue-700">
                  <div className="flex justify-between">
                    <span>Design Heat Loss @ 70°F ΔT:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {hlfSource === "calculated"
                        ? (() => {
                            const ceilingMult = 1 + (ceilingHeight - 8) * 0.1;
                            const designHeatLoss = squareFeet * 22.67 * insulationLevel * homeShape * ceilingMult;
                            return `${Math.round(designHeatLoss).toLocaleString()} BTU/hr`;
                          })()
                        : `${Math.round(getEffectiveHeatLossFactor * 70).toLocaleString()} BTU/hr`}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {hlfSource === "calculated" ? (
                      <> = {squareFeet.toLocaleString()} × 22.67 × {insulationLevel.toFixed(2)} × {homeShape.toFixed(2)} × {(1 + (ceilingHeight - 8) * 0.1).toFixed(3)} = {Math.round(squareFeet * 22.67 * insulationLevel * homeShape * (1 + (ceilingHeight - 8) * 0.1)).toLocaleString()} BTU/hr</>
                    ) : (
                      <> = {getEffectiveHeatLossFactor.toFixed(0)} BTU/hr/°F × 70°F (from {hlfSource === "learned" ? "bill data" : hlfSource === "manual" ? "manual entry" : "analyzer"})</>
                    )}
                  </div>
                  {energyMode === "heating" && (() => {
                    const heatLossPerDegF = hlfSource === "calculated"
                      ? (squareFeet * 22.67 * insulationLevel * homeShape * (1 + (ceilingHeight - 8) * 0.1)) / 70
                      : getEffectiveHeatLossFactor;
                    const heatLossPer1000SqFt = (heatLossPerDegF / squareFeet) * 1000;
                    let heatLossContext = "";
                    if (heatLossPer1000SqFt < 80) {
                      heatLossContext = "Passive House / Super-insulated level";
                    } else if (heatLossPer1000SqFt < 150) {
                      heatLossContext = "Very well-insulated (newer construction)";
                    } else if (heatLossPer1000SqFt < 250) {
                      heatLossContext = "Good insulation (modern code-built)";
                    } else if (heatLossPer1000SqFt < 400) {
                      heatLossContext = "Average insulation (typical house)";
                    } else {
                      heatLossContext = "Poor insulation (older house)";
                    }
                    return (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-y-1">
                        <div className="italic">
                          (≈ {heatLossPerDegF.toFixed(0)} BTU/hr per °F for this home)
                        </div>
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded p-2 border border-yellow-200 dark:border-yellow-800 mt-2">
                          <p className="font-semibold text-yellow-800 dark:text-yellow-200 text-xs mb-1">Heat Loss Context:</p>
                          <p className="text-yellow-700 dark:text-yellow-300 text-xs">
                            {heatLossPer1000SqFt.toFixed(0)} BTU/hr/°F per 1,000 sq ft = <strong>{heatLossContext}</strong>
                          </p>
                          <p className="text-yellow-700 dark:text-yellow-300 text-xs mt-1 italic">
                            Typical ranges: Poor (400-600), Average (250-400), Good (150-250), Excellent (&lt;150), Passive House (&lt;80)
                          </p>
                        </div>
                        {/* Manual Heat Loss Override */}
                        <div className="mt-2 pt-2 border-t border-yellow-300 dark:border-yellow-700">
                          <button
                            type="button"
                            onClick={() => {
                              const current = userSettings?.manualHeatLoss;
                              if (current) {
                                // Clear override
                                setUserSetting('manualHeatLoss', null);
                                setUserSetting('useManualHeatLoss', false);
                              } else {
                                // Set override to current calculated value
                                setUserSetting('manualHeatLoss', Math.round(heatLossPerDegF));
                                setUserSetting('useManualHeatLoss', true);
                              }
                            }}
                            className="text-[10px] text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer"
                          >
                            {userSettings?.useManualHeatLoss ? '✓ Using manual override — click to reset' : '🔧 Override with your own BTU/hr/°F value'}
                          </button>
                          {userSettings?.useManualHeatLoss && (
                            <div className="mt-1 flex items-center gap-2">
                              <label className="text-[10px] text-yellow-700 dark:text-yellow-300 font-semibold">BTU/hr/°F:</label>
                              <input
                                type="number"
                                min={50}
                                max={2000}
                                step={10}
                                value={userSettings?.manualHeatLoss || Math.round(heatLossPerDegF)}
                                onChange={(e) => setUserSetting('manualHeatLoss', Number(e.target.value))}
                                className="w-24 px-2 py-0.5 text-xs rounded border border-yellow-400 dark:border-yellow-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                              />
                              <span className="text-[10px] text-yellow-600 dark:text-yellow-400 italic">Calibrate from utility bill</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                {energyMode === "heating" ? (
                  <div className="pt-2">
                    <div className="flex justify-between">
                      <span>BTU Loss per °F:</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {hlfSource === "calculated"
                          ? (() => {
                              const designHeatLoss = squareFeet * 22.67 * insulationLevel * homeShape * (1 + (ceilingHeight - 8) * 0.1);
                              return `${(designHeatLoss / 70).toFixed(1)} BTU/hr/°F`;
                            })()
                          : `${getEffectiveHeatLossFactor.toFixed(1)} BTU/hr/°F`}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {hlfSource === "calculated" ? (
                        <> = {Math.round(squareFeet * 22.67 * insulationLevel * homeShape * (1 + (ceilingHeight - 8) * 0.1)).toLocaleString()} ÷ 70</>
                      ) : (
                        <>From {hlfSource === "learned" ? "bill data" : hlfSource === "manual" ? "manual entry" : "analyzer"}</>
                      )}
                    </div>
                    {hlfSource === "learned" && (
                      <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg p-3">
                        <h5 className="font-semibold text-emerald-800 dark:text-emerald-200 text-xs mb-2">How bill-derived heat loss (~{userSettings?.learnedHeatLoss || getEffectiveHeatLossFactor} BTU/hr/°F) is calculated</h5>
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 mb-2">
                          For each heating day with bill data: <strong>HLF = actual_kWh × 3412 ÷ 24 ÷ ΔT</strong>
                        </p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2">
                          • 3412 BTU/kWh converts electricity to heat • ÷24 gives BTU/hr • ÷ΔT (indoor − outdoor temp) gives BTU/hr per °F
                        </p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2">
                          Example: 24 kWh on a 40°F day (ΔT=30°F): 24 × 3412 ÷ 24 ÷ 30 = 114 BTU/hr/°F. Average across heating days with bill data.
                        </p>
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mt-2 pt-2 border-t border-emerald-300 dark:border-emerald-800">
                          Assumption: ALL bill kWh is heating. When the bill includes baseload (water heater, fridge, lights, appliances), the formula attributes that to "heat loss" — so the number is distorted.
                        </p>
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-2">
                          When heat loss is from this bill: forecast and actual would match if the bill were HVAC-only. The gap between them shows baseload is significant — the model estimates HVAC only; your bill is whole-house.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="pt-2 border-t border-blue-300 dark:border-blue-700">
                    <div className="flex justify-between">
                      <span>Design Heat Gain @ 20°F ΔT:</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {Math.round(squareFeet * 28.0 * insulationLevel * homeShape * (1 + (ceilingHeight - 8) * 0.1) * solarExposure / 1000) * 1000} BTU/hr
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      = {squareFeet.toLocaleString()} × 28.0 × {insulationLevel.toFixed(2)} × {homeShape.toFixed(2)} × {(1 + (ceilingHeight - 8) * 0.1).toFixed(3)} × {solarExposure.toFixed(2)}
                    </div>
                    <div className="pt-2">
                      <div className="flex justify-between">
                        <span>BTU Gain per °F:</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {((squareFeet * 28.0 * insulationLevel * homeShape * (1 + (ceilingHeight - 8) * 0.1) * solarExposure) / 20.0).toFixed(1)} BTU/hr/°F
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* System Configuration */}
            <div className="bg-indigo-50 dark:bg-indigo-950 rounded-lg p-4 border border-indigo-200 dark:border-indigo-800">
              <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">System Configuration</h4>
              <div className="space-y-2 text-sm font-mono text-gray-700 dark:text-gray-300">
                <div className="flex justify-between">
                  <span>Primary System:</span>
                  <span className="font-bold">{primarySystem === "heatPump" ? "Heat Pump" : primarySystem === "acPlusGas" ? "Central AC + Gas" : "Gas Furnace"}</span>
                </div>
                <div className="flex justify-between">
                  <span>{(primarySystem === "gasFurnace" || primarySystem === "acPlusGas") ? "Furnace Size:" : "Capacity:"}</span>
                  <span className="font-bold">{capacity}k BTU</span>
                </div>
                {energyMode === "heating" && primarySystem === "heatPump" && (
                  <>
                    <div className="flex justify-between">
                      <span>HSPF2:</span>
                      <span className="font-bold">{hspf2 || efficiency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tons:</span>
                      <span className="font-bold">
                        {(() => {
                          const tonsMap = { 18: 1.5, 24: 2.0, 30: 2.5, 36: 3.0, 42: 3.5, 48: 4.0, 60: 5.0 };
                          return tonsMap[capacity] || 3.0;
                        })()} tons
                      </span>
                    </div>
                  </>
                )}
                {energyMode === "cooling" && (
                  <>
                    <div className="flex justify-between">
                      <span>SEER2:</span>
                      <span className="font-bold">{efficiency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cooling Tons:</span>
                      <span className="font-bold">
                        {(() => {
                          const tonsMap = { 18: 1.5, 24: 2.0, 30: 2.5, 36: 3.0, 42: 3.5, 48: 4.0, 60: 5.0 };
                          return tonsMap[capacity] || 3.0;
                        })()} tons
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span>Electricity Rate:</span>
                  <span className="font-bold">${utilityCost.toFixed(3)} / kWh</span>
                </div>
                {(primarySystem === "gasFurnace" || primarySystem === "acPlusGas") && (
                  <>
                    <div className="flex justify-between">
                      <span>AFUE:</span>
                      <span className="font-bold">{(afue * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gas Cost:</span>
                      <span className="font-bold">${gasCost.toFixed(2)} / therm</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Aux Heat Calculation (Heat Pumps Only) */}
            {primarySystem === "heatPump" && energyMode === "heating" && (
              <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Auxiliary Heat Calculation</h4>
                <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                  {balancePoint !== null ? (
                    <>
                      <div className="bg-white dark:bg-gray-800 rounded p-3 border border-purple-300 dark:border-purple-700">
                        <p className="font-semibold text-purple-600 dark:text-purple-400 mb-2">Aux threshold temperature: {balancePoint.toFixed(1)}°F</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                          Below this outdoor temperature, your heat pump may need backup heat to hold the setpoint.
                        </p>
                        <div className="text-xs space-y-1">
                          <p><strong>Heat Pump Output</strong> = {(() => {
                            const tonsMap = { 18: 1.5, 24: 2.0, 30: 2.5, 36: 3.0, 42: 3.5, 48: 4.0, 60: 5.0 };
                            const tons = tonsMap[capacity] || 3.0;
                            return `${tons.toFixed(1)} tons × 12,000 × Capacity Factor(temp)`;
                          })()}</p>
                          <p><strong>Building Heat Loss</strong> = {(() => {
                            const estimatedDesignHeatLoss = heatUtils.calculateHeatLoss({
            squareFeet,
            insulationLevel,
            homeShape,
            ceilingHeight,
            wallHeight,
            hasLoft,
          });
                            const heatLossBtu = estimatedDesignHeatLoss / 70;
                            const avgWinterIndoorTemp = ((userSettings?.winterThermostatDay ?? 70) * 16 + (userSettings?.winterThermostatNight ?? 68) * 8) / 24;
                            return `${heatLossBtu.toFixed(0)} BTU/hr/°F × (${avgWinterIndoorTemp.toFixed(1)}°F - outdoor temp)`;
                          })()}</p>
                        </div>
                      </div>
                      {historicalHourly && historicalHourly.length > 0 ? (
                        <div className="bg-green-50 dark:bg-green-900/20 rounded p-3 border border-green-300 dark:border-green-700">
                          <p className="font-semibold text-green-600 dark:text-green-400 mb-2">📊 Using Hourly Historical Data</p>
                          <div className="mb-3 p-2 bg-white dark:bg-gray-800 rounded border border-green-300 dark:border-green-700">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                              <strong>Aux heat risk (varies by winter):</strong> Monthly costs use typical climate average, but aux heat depends on <em>cold snaps</em>.
                            </p>
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <span className="text-xs text-gray-600 dark:text-gray-400">Choose a weather year:</span>
                              <select
                                value={auxHeatYear}
                                onChange={(e) => {
                                  setAuxHeatYear(Number(e.target.value));
                                  setUseWorstYear(false);
                                }}
                                className="text-xs px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                              >
                                {Array.from({ length: 10 }, (_, i) => {
                                  const year = new Date().getFullYear() - 1 - i;
                                  return (
                                    <option key={year} value={year}>
                                      {year}
                                    </option>
                                  );
                                })}
                              </select>
                              <button
                                onClick={() => {
                                  setAuxHeatYear(2021); // Conservative worst-case proxy
                                  setUseWorstYear(true);
                                }}
                                className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded border border-red-700 transition-colors"
                                title="Picks the coldest winter in the available history (more conservative)"
                              >
                                Use Coldest Year
                              </button>
                            </div>
                            {useWorstYear && (
                              <p className="text-xs text-red-600 dark:text-red-400 mt-1 italic">
                                Picks the coldest winter in the available history (more conservative).
                              </p>
                            )}
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                              Calculated from <strong>hourly outdoor temperatures</strong> for <strong>{auxHeatYear}</strong>.
                            </p>
                          </div>
                          <div className="text-xs space-y-1 mt-2">
                            <p><strong>Method:</strong></p>
                            <ol className="list-decimal list-inside space-y-1 ml-2">
                              <li>For each hour in {auxHeatYear}, check if outdoor temp &lt; {balancePoint.toFixed(1)}°F</li>
                              <li>Calculate heat pump output and building heat loss at that hour's temperature</li>
                              <li>If building heat loss &gt; heat pump output: Aux heat = (Deficit BTU) ÷ 3,412 BTU/kWh</li>
                              <li>Sum aux heat kWh for all hours below balance point in each month</li>
                            </ol>
                            <p className="mt-2 text-gray-500 dark:text-gray-400 italic">
                              Monthly totals use typical-year HDD/CDD, but aux heat is based on {auxHeatYear} actual temperatures. 
                              This keeps the <strong>annual budget stable</strong>, while showing how <strong>cold snaps</strong> change aux usage. 
                              Choose a different year to see how colder or milder winters affect aux heat.
                            </p>
                            <p className="mt-2 text-gray-500 dark:text-gray-400 italic">
                              <em>Tip:</em> If you want a conservative estimate, choose <strong>Use coldest year</strong>.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded p-3 border border-yellow-300 dark:border-yellow-700">
                          <p className="font-semibold text-yellow-600 dark:text-yellow-400 mb-2">Using HDD-Based Estimates</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Hourly historical data not available. Using Heating Degree Days (HDD) with statistical estimates for aux heat. For more accurate aux heat calculations, ensure location is set and historical data can be loaded.
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-3 border border-blue-300 dark:border-blue-700">
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Balance point calculation not available. Your heat pump system can handle all typical outdoor temperatures without auxiliary heat.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Temperature Settings */}
            <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Temperature Settings</h4>
              <div className="space-y-2 text-sm font-mono text-gray-700 dark:text-gray-300">
                {energyMode === "heating" ? (
                  <>
                    <div className="flex justify-between">
                      <span>Daytime Temp:</span>
                      <span className="font-bold">{indoorTemp}°F</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Nighttime Temp:</span>
                      <span className="font-bold">{nighttimeTemp}°F</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Day Start:</span>
                      <span className="font-bold">{daytimeTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Night Start:</span>
                      <span className="font-bold">{nighttimeTime}</span>
                    </div>
                    <div className="pt-2 border-t border-green-300 dark:border-green-700">
                      <div className="flex justify-between">
                        <span>Effective Indoor Temp:</span>
                        <span className="font-bold text-green-600 dark:text-green-400">{effectiveIndoorTemp.toFixed(1)}°F</span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Weighted average based on day/night schedule
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span>Daytime Temp:</span>
                      <span className="font-bold">{summerThermostat || 75}°F</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Nighttime Temp:</span>
                      <span className="font-bold">{summerThermostatNight || 72}°F</span>
                    </div>
                    <div className="pt-2 border-t border-green-300 dark:border-green-700">
                      <div className="flex justify-between">
                        <span>Effective Indoor Temp:</span>
                        <span className="font-bold text-green-600 dark:text-green-400">{effectiveIndoorTemp.toFixed(1)}°F</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Example Day Calculation */}
            {monthlyEstimate && (() => {
              const tonsMap = { 18: 1.5, 24: 2.0, 30: 2.5, 36: 3.0, 42: 3.5, 48: 4.0, 60: 5.0 };
              const tons = tonsMap[capacity] || 3.0;
              const exampleOutdoorTemp = energyMode === "heating" ? 35 : 85;
              const tempDiff = energyMode === "heating" 
                ? Math.max(0, effectiveIndoorTemp - exampleOutdoorTemp)
                : Math.max(0, exampleOutdoorTemp - effectiveIndoorTemp);
              
              if (energyMode === "heating") {
                // Use the same formula as shown in Building Characteristics section for consistency
                const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
                const estimatedDesignHeatLoss = squareFeet * BASE_BTU_PER_SQFT * insulationLevel * homeShape * ceilingMultiplier;
                const btuLossPerDegF = estimatedDesignHeatLoss / 70;
                const buildingHeatLoss = btuLossPerDegF * tempDiff;

                if (isGasHeat) {
                  const eff = Math.min(0.99, Math.max(0.6, afue));
                  const btuPerTherm = 100000;
                  const thermsPerDay = (buildingHeatLoss * 24) / (btuPerTherm * eff);
                  const dayCost = thermsPerDay * gasCost;
                  return (
                    <div className="bg-orange-50 dark:bg-orange-950 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                      <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Example Day Calculation ({exampleOutdoorTemp}°F outdoor – cold day example)</h4>
                      <div className="space-y-2 text-sm font-mono text-gray-700 dark:text-gray-300">
                        <div className="flex justify-between">
                          <span>Temperature Difference:</span>
                          <span className="font-bold">{tempDiff.toFixed(1)}°F</span>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          = {effectiveIndoorTemp.toFixed(1)}°F - {exampleOutdoorTemp}°F
                        </div>
                        <div className="flex justify-between">
                          <span>Building Heat Loss:</span>
                          <span className="font-bold text-orange-600 dark:text-orange-400">{(buildingHeatLoss / 1000).toFixed(1)}k BTU/hr</span>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          = {btuLossPerDegF.toFixed(1)} BTU/hr/°F × {tempDiff.toFixed(1)}°F
                        </div>
                        <div className="flex justify-between">
                          <span>Therms per Day:</span>
                          <span className="font-bold text-orange-600 dark:text-orange-400">{thermsPerDay.toFixed(2)} therms</span>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          = ({(buildingHeatLoss / 1000).toFixed(1)}k × 24 hr) ÷ (100,000 × {(eff * 100).toFixed(0)}% AFUE)
                        </div>
                        <div className="pt-2 border-t border-orange-300 dark:border-orange-700">
                          <div className="flex justify-between">
                            <span>Daily Cost:</span>
                            <span className="font-bold text-orange-600 dark:text-orange-400">${dayCost.toFixed(2)}</span>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            = {thermsPerDay.toFixed(2)} therms × ${gasCost.toFixed(2)}/therm
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Heat pump
                const capFactor = exampleOutdoorTemp >= 47 
                  ? 1.0 
                  : Math.max(0.3, 1.0 - ((47 - exampleOutdoorTemp) / 100) * 0.3);
                const thermalOutput = tons * 12000 * capFactor;
                const compressorDelivered = Math.min(thermalOutput, buildingHeatLoss);
                const auxHeatBtu = Math.max(0, buildingHeatLoss - compressorDelivered);
                const baseHspf = hspf2 || efficiency;
                const compressorEnergyPerHour = compressorDelivered / (baseHspf * 1000);
                const auxHeatEnergyPerHour = auxHeatBtu / 3412.14;
                const effectiveAuxEnergyPerHour = useElectricAuxHeat ? auxHeatEnergyPerHour : 0;
                const totalDayEnergy = (compressorEnergyPerHour + effectiveAuxEnergyPerHour) * 24;
                const dayCost = totalDayEnergy * utilityCost;

                return (
                  <div className="bg-orange-50 dark:bg-orange-950 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                    <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Example Day Calculation ({exampleOutdoorTemp}°F outdoor – cold day example)</h4>
                    <div className="space-y-2 text-sm font-mono text-gray-700 dark:text-gray-300">
                      <div className="flex justify-between">
                        <span>Temperature Difference:</span>
                        <span className="font-bold">{tempDiff.toFixed(1)}°F</span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        = {effectiveIndoorTemp.toFixed(1)}°F - {exampleOutdoorTemp}°F
                      </div>
                      <div className="flex justify-between">
                        <span>Building Heat Loss:</span>
                        <span className="font-bold text-orange-600 dark:text-orange-400">{(buildingHeatLoss / 1000).toFixed(1)}k BTU/hr</span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        = {btuLossPerDegF.toFixed(1)} BTU/hr/°F × {tempDiff.toFixed(1)}°F
                      </div>
                      <div className="flex justify-between">
                        <span>Capacity Factor:</span>
                        <span className="font-bold">{capFactor.toFixed(3)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Heat Pump Output:</span>
                        <span className="font-bold text-orange-600 dark:text-orange-400">{(thermalOutput / 1000).toFixed(1)}k BTU/hr</span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        = {tons} tons × 12,000 × {capFactor.toFixed(3)}
                      </div>
                      <div className="flex justify-between">
                        <span>Compressor Delivered:</span>
                        <span className="font-bold text-orange-600 dark:text-orange-400">{(compressorDelivered / 1000).toFixed(1)}k BTU/hr</span>
                      </div>
                      {auxHeatBtu > 0 && (
                        <>
                          <div className="flex justify-between">
                            <span>Aux Heat Needed:</span>
                            <span className="font-bold text-red-600 dark:text-red-400">{(auxHeatBtu / 1000).toFixed(1)}k BTU/hr</span>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            = {(buildingHeatLoss / 1000).toFixed(1)}k - {(compressorDelivered / 1000).toFixed(1)}k
                          </div>
                        </>
                      )}
                      <div className="pt-2 border-t border-orange-300 dark:border-orange-700">
                        <div className="flex justify-between">
                          <span>Compressor Energy/Hour:</span>
                          <span className="font-bold">{compressorEnergyPerHour.toFixed(3)} kWh</span>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          = {(compressorDelivered / 1000).toFixed(1)}k ÷ ({baseHspf} × 1,000)
                        </div>
                        {effectiveAuxEnergyPerHour > 0 && (
                          <>
                            <div className="flex justify-between">
                              <span>Aux Energy/Hour:</span>
                              <span className="font-bold text-red-600 dark:text-red-400">{effectiveAuxEnergyPerHour.toFixed(3)} kWh</span>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              = {(auxHeatBtu / 1000).toFixed(1)}k ÷ 3,412.14
                            </div>
                          </>
                        )}
                        <div className="flex justify-between">
                          <span>Total Energy/Day:</span>
                          <span className="font-bold text-orange-600 dark:text-orange-400">{totalDayEnergy.toFixed(2)} kWh</span>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          = ({compressorEnergyPerHour.toFixed(3)} + {effectiveAuxEnergyPerHour.toFixed(3)}) × 24
                        </div>
                        <div className="pt-2 border-t border-orange-300 dark:border-orange-700">
                          <div className="flex justify-between">
                            <span>Daily Cost:</span>
                            <span className="font-bold text-orange-600 dark:text-orange-400">${dayCost.toFixed(2)}</span>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            = {totalDayEnergy.toFixed(2)} kWh × ${utilityCost.toFixed(3)}/kWh
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              } else {
                const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
                const designHeatGain = squareFeet * 28.0 * insulationLevel * homeShape * ceilingMultiplier * solarExposure;
                const btuGainPerDegF = designHeatGain / 20.0;
                const totalDailyHeatGainBtu = btuGainPerDegF * tempDiff * 24;
                const seer2 = efficiency;
                const dailyKWh = totalDailyHeatGainBtu / (seer2 * 1000);
                const dayCost = dailyKWh * utilityCost;

                return (
                  <div className="bg-orange-50 dark:bg-orange-950 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                    <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Example Day Calculation ({exampleOutdoorTemp}°F outdoor)</h4>
                    <div className="space-y-2 text-sm font-mono text-gray-700 dark:text-gray-300">
                      <div className="flex justify-between">
                        <span>Temperature Difference:</span>
                        <span className="font-bold">{tempDiff.toFixed(1)}°F</span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        = {exampleOutdoorTemp}°F - {effectiveIndoorTemp.toFixed(1)}°F
                      </div>
                      <div className="flex justify-between">
                        <span>BTU Gain per °F:</span>
                        <span className="font-bold">{btuGainPerDegF.toFixed(1)} BTU/hr/°F</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Daily Heat Gain:</span>
                        <span className="font-bold text-orange-600 dark:text-orange-400">{(totalDailyHeatGainBtu / 1000).toFixed(1)}k BTU</span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        = {btuGainPerDegF.toFixed(1)} × {tempDiff.toFixed(1)}°F × 24 hours
                      </div>
                      <div className="pt-2 border-t border-orange-300 dark:border-orange-700">
                        <div className="flex justify-between">
                          <span>Daily Energy:</span>
                          <span className="font-bold text-orange-600 dark:text-orange-400">{dailyKWh.toFixed(2)} kWh</span>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          = {(totalDailyHeatGainBtu / 1000).toFixed(1)}k ÷ ({seer2} × 1,000)
                        </div>
                        <div className="pt-2 border-t border-orange-300 dark:border-orange-700">
                          <div className="flex justify-between">
                            <span>Daily Cost:</span>
                            <span className="font-bold text-orange-600 dark:text-orange-400">${dayCost.toFixed(2)}</span>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            = {dailyKWh.toFixed(2)} kWh × ${utilityCost.toFixed(3)}/kWh
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
            })()}

            {/* Monthly Summary */}
            {monthlyEstimate && (
              <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Monthly Summary</h4>
                <div className="space-y-2 text-sm font-mono text-gray-700 dark:text-gray-300">
                  <div className="flex justify-between">
                    <span>Total Monthly Cost:</span>
                    <span className="font-bold text-green-600 dark:text-green-400">${monthlyEstimate.cost.toFixed(2)}</span>
                  </div>
                  {monthlyEstimate.energy && (
                    <div className="flex justify-between">
                      <span>Total Monthly Energy:</span>
                      <span className="font-bold text-green-600 dark:text-green-400">{formatEnergyFromKwh(monthlyEstimate.energy, unitSystem, { decimals: 2 })}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-green-300 dark:border-green-700">
                    <div className="flex justify-between">
                      <span>Estimated Annual Variable Cost (simplified):</span>
                      <span className="font-bold text-green-600 dark:text-green-400">
                        {(() => {
                          if (energyMode === "heating" && locationData) {
                            // Use HDD-based scaling for variable cost only: Annual = (Monthly Variable / Monthly HDD) * Annual HDD
                            const monthlyHDD = getTypicalHDD(selectedMonth);
                            const annualHDD = getAnnualHDD(locationData.city, locationData.state);
                            if (monthlyHDD > 0 && annualHDD > 0) {
                              const monthlyVariableCost = (monthlyEstimate.cost || 0) - (monthlyEstimate.fixedCost || 0);
                              const annualVariableCost = (monthlyVariableCost / monthlyHDD) * annualHDD;
                              return `$${annualVariableCost.toFixed(2)} (see full example below)`;
                            }
                          }
                          // Fallback: for cooling or if HDD data unavailable, show note
                          return "N/A (see below)";
                        })()}
                      </span>
                    </div>
                    {/* Old simplified annual estimate removed - see "Simplified Annual Estimate" section below for correct calculation */}
                  </div>
                </div>
              </div>
            )}

            {/* Total Estimate Composition */}
            {monthlyEstimate && (
              <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h5 className="font-semibold text-high-contrast mb-2">Total Estimate Composition</h5>
                <div className="bg-white dark:bg-gray-800 rounded p-3 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span>Variable Energy Cost:</span>
                    <span className="font-bold">${(monthlyEstimate.cost - (monthlyEstimate.fixedCost || 0)).toFixed(2)}</span>
                  </div>
                  {monthlyEstimate.fixedCost > 0 && (
                    <div className="flex justify-between text-blue-600 dark:text-blue-400">
                      <span>+ Fixed Utility Charge:</span>
                      <span className="font-bold">${(monthlyEstimate.fixedCost || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                    <span className="font-bold">Total Estimate:</span>
                    <span className="font-bold">${monthlyEstimate.cost.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Annual Cost Calculation Using Degree Days */}
            {monthlyEstimate && energyMode === "heating" && locationData && (() => {
              const monthlyHDD = getTypicalHDD(selectedMonth);
              const annualHDD = getAnnualHDD(locationData.city, locationData.state);
              
              if (monthlyHDD > 0 && annualHDD > 0) {
                // Calculate annual cost using degree-day scaling
                // Use variable cost only (fixed costs don't scale with HDD)
                const monthlyVariableCost = (monthlyEstimate.cost || 0) - (monthlyEstimate.fixedCost || 0);
                const annualVariableCost = (monthlyVariableCost / monthlyHDD) * annualHDD;
                const annualFixedCost = (monthlyEstimate.fixedCost || 0) * 12;
                const annualCost = annualVariableCost + annualFixedCost;
                const monthlyRatio = monthlyHDD / annualHDD;
                
                // ========== COMPREHENSIVE ANALYTICS CALCULATIONS ==========
                
                // Get data from refs (stored during forecast calculation)
                const dailyMetrics = dailyMetricsRef.current || [];
                const totalForecastCost = totalForecastCostRef.current || 0;
                const totalForecastEnergy = totalForecastEnergyRef.current || 0;
                
                // Skip analytics if no data available
                if (dailyMetrics.length === 0) {
                  return (
                    <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                      <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Annual Heating Cost</h4>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Loading forecast data for analytics...
                      </div>
                    </div>
                  );
                }
                
                // 1. Historical vs Forecast Breakdown
                const historicalDays = dailyMetrics.filter(d => d.source === 'historical');
                const forecastDays = dailyMetrics.filter(d => d.source === 'forecast');
                const historicalCost = historicalDays.reduce((sum, d) => sum + d.cost, 0);
                const forecastCost = forecastDays.reduce((sum, d) => sum + d.cost, 0);
                const historicalEnergy = historicalDays.reduce((sum, d) => sum + d.energy, 0);
                const forecastEnergy = forecastDays.reduce((sum, d) => sum + d.energy, 0);
                
                // 2. Auxiliary Heat Analysis
                const totalAuxEnergy = dailyMetrics.reduce((sum, d) => sum + (d.auxEnergy || 0), 0);
                const totalHpEnergy = totalForecastEnergy - totalAuxEnergy;
                const auxPercentage = totalForecastEnergy > 0 ? (totalAuxEnergy / totalForecastEnergy) * 100 : 0;
                const daysWithAux = dailyMetrics.filter(d => (d.auxEnergy || 0) > 0.1).length;
                const auxCost = totalAuxEnergy * utilityCost;
                const hpCost = totalHpEnergy * utilityCost;
                
                // 3. Top 5 Peak Cost Days
                const top5Days = [...dailyMetrics].sort((a, b) => b.cost - a.cost).slice(0, 5);
                
                // 4. Day/Night Cost Breakdown
                // Use winterThermostat from userSettings directly since thermostatSettings isn't in scope
                const indoorTemp = winterThermostat || 70;
                const nighttimeTemp = indoorTemp - 3; // Standard 3 degree night setback
                const dayHours = 16;
                const _nightHours = 8;
                const avgDailyEnergy = totalForecastEnergy / dailyMetrics.length;
                const estimatedDaytimeFraction = dayHours / 24 * 1.1; // Slightly higher since daytime is typically colder
                const estimatedDaytimeEnergy = avgDailyEnergy * estimatedDaytimeFraction * dailyMetrics.length;
                const estimatedNighttimeEnergy = totalForecastEnergy - estimatedDaytimeEnergy;
                const estimatedDaytimeCost = estimatedDaytimeEnergy * utilityCost;
                const estimatedNighttimeCost = estimatedNighttimeEnergy * utilityCost;
                
                // 5. Weather vs 30-Year Normal
                const actualMonthHDD = dailyMetrics.reduce((sum, d) => {
                  const hdd = Math.max(0, 65 - d.avg);
                  return sum + hdd;
                }, 0);
                const typicalMonthHDD = monthlyHDD; // This is already from 30-year normals
                const hddDiff = actualMonthHDD - typicalMonthHDD;
                const hddPercentDiff = typicalMonthHDD > 0 ? (hddDiff / typicalMonthHDD) * 100 : 0;
                
                // 6. Balance Point Analysis
                const balancePointTemp = 65; // Standard balance point
                const _daysAboveBalance = dailyMetrics.filter(d => d.avg >= balancePointTemp).length;
                const daysBelowBalance = dailyMetrics.filter(d => d.avg < balancePointTemp).length;
                const balancePointPercentage = dailyMetrics.length > 0 ? (daysBelowBalance / dailyMetrics.length) * 100 : 0;
                const avgTempBelowBalance = daysBelowBalance > 0 
                  ? dailyMetrics.filter(d => d.avg < balancePointTemp).reduce((sum, d) => sum + d.avg, 0) / daysBelowBalance 
                  : 0;
                
                // 7. Electricity Rate Sensitivity
                const costAtPlusTwenty = totalForecastEnergy * (utilityCost * 1.2);
                const costAtMinusTwenty = totalForecastEnergy * (utilityCost * 0.8);
                
                // 8. Weekly Breakdown
                const weeks = [];
                let currentWeek = { start: null, end: null, days: [], cost: 0, energy: 0 };
                dailyMetrics.forEach((day, idx) => {
                  if (!currentWeek.start) currentWeek.start = day.date;
                  currentWeek.end = day.date;
                  currentWeek.days.push(day);
                  currentWeek.cost += day.cost;
                  currentWeek.energy += day.energy;
                  
                  if ((idx + 1) % 7 === 0 || idx === dailyMetrics.length - 1) {
                    weeks.push({ ...currentWeek });
                    currentWeek = { start: null, end: null, days: [], cost: 0, energy: 0 };
                  }
                });
                
                // 9. Realized Efficiency
                const avgOutdoorTemp = dailyMetrics.reduce((sum, d) => sum + d.avg, 0) / dailyMetrics.length;
                const avgIndoorTemp = indoorTemp;
                const avgTempDiff = avgIndoorTemp - avgOutdoorTemp;
                const estimatedDesignHeatLoss = heatUtils.calculateHeatLoss({ squareFeet, insulationLevel, homeShape, ceilingHeight, wallHeight, hasLoft });
                const btuLossPerDegF = estimatedDesignHeatLoss / 70;
                const totalHours = dailyMetrics.length * 24;
                const _totalBtuDelivered = totalForecastEnergy * 3412.14; // Convert kWh to BTU
                const totalBtuNeeded = btuLossPerDegF * avgTempDiff * totalHours;
                const realizedCOP = totalHpEnergy > 0 ? totalBtuNeeded / (totalHpEnergy * 3412.14) : 0;
                const ratedCOP = hspf2 / 3.412; // Convert HSPF2 to COP
                
                // 10. Optimization Opportunities
                const potentialSetbackSavings = estimatedNighttimeCost * 0.15; // 15% potential savings
                const potentialAuxReduction = auxCost * 0.5; // 50% reduction if optimized
                
                return (
                  <>
                    {/* Comprehensive Analytics Section */}
                    <div className="mt-6 space-y-4">
                      {/* 1. Historical vs Forecast */}
                      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                        <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                          📊 Data Source Breakdown
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-white dark:bg-gray-900 rounded p-3">
                            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Historical Data ({historicalDays.length} days)</div>
                            <div className="text-xs space-y-1">
                              <div className="flex justify-between">
                                <span>Energy:</span>
                                <span className="font-bold">{Math.round(historicalEnergy)} kWh</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Cost:</span>
                                <span className="font-bold">${historicalCost.toFixed(2)}</span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">✓ High confidence - actual weather data</div>
                            </div>
                          </div>
                          <div className="bg-white dark:bg-gray-900 rounded p-3">
                            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Forecast Data ({forecastDays.length} days)</div>
                            <div className="text-xs space-y-1">
                              <div className="flex justify-between">
                                <span>Energy:</span>
                                <span className="font-bold">{Math.round(forecastEnergy)} kWh</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Cost:</span>
                                <span className="font-bold">${forecastCost.toFixed(2)}</span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">⚠️ Forecast - subject to change</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* 2. Auxiliary Heat Analysis (Heat Pump Only) */}
                      {primarySystem === "heatPump" && useElectricAuxHeat && (
                        <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                          <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                            ⚡ Auxiliary Heat Analysis
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-gray-900 rounded p-3">
                              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Aux Heat Usage</div>
                              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{auxPercentage.toFixed(1)}%</div>
                              <div className="text-xs text-gray-500">of total energy</div>
                            </div>
                            <div className="bg-white dark:bg-gray-900 rounded p-3">
                              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Days Using Aux</div>
                              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{daysWithAux}</div>
                              <div className="text-xs text-gray-500">out of {dailyMetrics.length} days</div>
                            </div>
                            <div className="bg-white dark:bg-gray-900 rounded p-3">
                              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Aux Heat Cost</div>
                              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">${auxCost.toFixed(2)}</div>
                              <div className="text-xs text-gray-500">HP: ${hpCost.toFixed(2)}</div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* 3. Top 5 Peak Cost Days */}
                      <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950 dark:to-pink-950 rounded-lg p-4 border border-red-200 dark:border-red-800">
                        <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                          🔥 Top 5 Peak Cost Days
                        </h4>
                        <div className="space-y-2">
                          {top5Days.map((day, idx) => (
                            <div key={idx} className="bg-white dark:bg-gray-900 rounded p-2 flex justify-between items-center">
                              <div>
                                <span className="font-semibold">{day.day}</span>
                                <span className="text-xs text-gray-500 ml-2">Avg: {Math.round(day.avg)}°F</span>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-red-600 dark:text-red-400">${day.cost.toFixed(2)}</div>
                                <div className="text-xs text-gray-500">{Math.round(day.energy)} kWh</div>
                                {day.auxEnergy > 0 && <div className="text-xs text-orange-500">⚡ {Math.round(day.auxEnergy)} kWh aux</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* 4. Day/Night Cost Breakdown */}
                      <div className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950 dark:to-amber-950 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                        <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                          🌅 Day/Night Cost Estimate
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-white dark:bg-gray-900 rounded p-3">
                            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">☀️ Daytime (6AM-10PM)</div>
                            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">${estimatedDaytimeCost.toFixed(2)}</div>
                            <div className="text-xs text-gray-500 mt-1">16 hours @ {indoorTemp}°F setpoint</div>
                          </div>
                          <div className="bg-white dark:bg-gray-900 rounded p-3">
                            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">🌙 Nighttime (10PM-6AM)</div>
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">${estimatedNighttimeCost.toFixed(2)}</div>
                            <div className="text-xs text-gray-500 mt-1">8 hours @ {Math.round(nighttimeTemp)}°F setpoint</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* 5. Weather vs 30-Year Normal */}
                      <div className="bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-950 dark:to-teal-950 rounded-lg p-4 border border-cyan-200 dark:border-cyan-800">
                        <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                          🌡️ Weather vs 30-Year Normal
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-white dark:bg-gray-900 rounded p-3">
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Actual Month HDD</div>
                            <div className="text-2xl font-bold">{Math.round(actualMonthHDD)}</div>
                          </div>
                          <div className="bg-white dark:bg-gray-900 rounded p-3">
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Normal Month HDD</div>
                            <div className="text-2xl font-bold">{Math.round(typicalMonthHDD)}</div>
                          </div>
                          <div className="bg-white dark:bg-gray-900 rounded p-3">
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Difference</div>
                            <div className={`text-2xl font-bold ${hddPercentDiff > 0 ? 'text-blue-600' : 'text-green-600'}`}>
                              {hddPercentDiff > 0 ? '+' : ''}{hddPercentDiff.toFixed(1)}%
                            </div>
                            <div className="text-xs text-gray-500">{hddPercentDiff > 0 ? 'Colder than normal' : 'Warmer than normal'}</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* 6. Balance Point Analysis */}
                      {primarySystem === "heatPump" && (
                        <div className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950 dark:to-violet-950 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                          <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                            ⚖️ Balance Point Analysis
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-gray-900 rounded p-3">
                              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Balance Point</div>
                              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{balancePointTemp}°F</div>
                            </div>
                            <div className="bg-white dark:bg-gray-900 rounded p-3">
                              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Heating Days</div>
                              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{daysBelowBalance}</div>
                              <div className="text-xs text-gray-500">{balancePointPercentage.toFixed(0)}% of month</div>
                            </div>
                            <div className="bg-white dark:bg-gray-900 rounded p-3">
                              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Avg Temp on Heating Days</div>
                              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{Math.round(avgTempBelowBalance)}°F</div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* 7. Electricity Rate Sensitivity */}
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg p-4 border border-green-200 dark:border-green-800">
                        <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                          💡 Electricity Rate Sensitivity (±20%)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-white dark:bg-gray-900 rounded p-3">
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">At ${(utilityCost * 0.8).toFixed(3)}/kWh (-20%)</div>
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">${costAtMinusTwenty.toFixed(2)}</div>
                            <div className="text-xs text-gray-500">Save ${(totalForecastCost - costAtMinusTwenty).toFixed(2)}</div>
                          </div>
                          <div className="bg-white dark:bg-gray-900 rounded p-3">
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Current Rate ${utilityCost.toFixed(3)}/kWh</div>
                            <div className="text-2xl font-bold">${totalForecastCost.toFixed(2)}</div>
                          </div>
                          <div className="bg-white dark:bg-gray-900 rounded p-3">
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">At ${(utilityCost * 1.2).toFixed(3)}/kWh (+20%)</div>
                            <div className="text-2xl font-bold text-red-600 dark:text-red-400">${costAtPlusTwenty.toFixed(2)}</div>
                            <div className="text-xs text-gray-500">+${(costAtPlusTwenty - totalForecastCost).toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* 8. Weekly Breakdown */}
                      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950 dark:to-blue-950 rounded-lg p-4 border border-indigo-200 dark:border-indigo-800">
                        <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                          📅 Weekly Breakdown
                        </h4>
                        <div className="space-y-2">
                          {weeks.map((week, idx) => (
                            <div key={idx} className="bg-white dark:bg-gray-900 rounded p-3 flex justify-between items-center">
                              <div>
                                <span className="font-semibold">Week {idx + 1}</span>
                                <span className="text-xs text-gray-500 ml-2">
                                  {week.start?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {week.end?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-indigo-600 dark:text-indigo-400">${week.cost.toFixed(2)}</div>
                                <div className="text-xs text-gray-500">{Math.round(week.energy)} kWh</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* 9. Realized Efficiency Metrics */}
                      {primarySystem === "heatPump" && (
                        <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950 dark:to-cyan-950 rounded-lg p-4 border border-teal-200 dark:border-teal-800">
                          <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                            📈 Realized Efficiency Metrics
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-gray-900 rounded p-3">
                              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Realized COP</div>
                              <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">{realizedCOP.toFixed(2)}</div>
                              <div className="text-xs text-gray-500">Actual performance</div>
                            </div>
                            <div className="bg-white dark:bg-gray-900 rounded p-3">
                              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Rated COP</div>
                              <div className="text-2xl font-bold">{ratedCOP.toFixed(2)}</div>
                              <div className="text-xs text-gray-500">From HSPF2 {hspf2}</div>
                            </div>
                            <div className="bg-white dark:bg-gray-900 rounded p-3">
                              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Efficiency Ratio</div>
                              <div className={`text-2xl font-bold ${realizedCOP / ratedCOP >= 0.8 ? 'text-green-600' : 'text-orange-600'}`}>
                                {ratedCOP > 0 ? ((realizedCOP / ratedCOP) * 100).toFixed(0) : 0}%
                              </div>
                              <div className="text-xs text-gray-500">of rated</div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* 10. Optimization Opportunities */}
                      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                        <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                          💰 Optimization Opportunities
                        </h4>
                        <div className="space-y-3">
                          <div className="bg-white dark:bg-gray-900 rounded p-3">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-semibold text-gray-700 dark:text-gray-300">Night Setback Optimization</span>
                              <span className="text-lg font-bold text-green-600 dark:text-green-400">~${potentialSetbackSavings.toFixed(2)}/mo</span>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              Optimizing night setback timing could save ~15% of nighttime heating costs.
                            </div>
                          </div>
                          {primarySystem === "heatPump" && useElectricAuxHeat && auxCost > 5 && (
                            <div className="bg-white dark:bg-gray-900 rounded p-3">
                              <div className="flex justify-between items-center mb-2">
                                <span className="font-semibold text-gray-700 dark:text-gray-300">Aux Heat Reduction</span>
                                <span className="text-lg font-bold text-green-600 dark:text-green-400">~${potentialAuxReduction.toFixed(2)}/mo</span>
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                Pre-heating before cold snaps or adjusting setpoints could reduce aux heat usage.
                              </div>
                            </div>
                          )}
                          <div className="bg-white dark:bg-gray-900 rounded p-3">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-semibold text-gray-700 dark:text-gray-300">Rate Shopping Potential</span>
                              <span className="text-lg font-bold text-green-600 dark:text-green-400">~${(totalForecastCost - costAtMinusTwenty).toFixed(2)}/mo</span>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              If you could find a rate 20% lower, you'd save significantly. Check for time-of-use or off-peak rates.
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Original Annual Example */}
                    <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-4 border border-purple-200 dark:border-purple-800 mt-6">
                    <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Annual Heating Cost (Simplified Example)</h4>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-3 italic">
                      This example just shows how degree-day scaling works for one month. The real annual estimate above uses all 12 months.
                    </div>
                    <div className="space-y-2 text-sm font-mono text-gray-700 dark:text-gray-300">
                      <div className="space-y-3">
                        <div>
                          <div className="font-semibold mb-2">Simplified Degree-Day Scaling:</div>
                          <div className="space-y-1 pl-4">
                            <div className="flex justify-between">
                              <span>Selected Month ({activeMonths.find((m) => m.value === selectedMonth)?.label}) Variable Cost:</span>
                              <span className="font-bold text-purple-600 dark:text-purple-400">${monthlyVariableCost.toFixed(2)}</span>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              (Total ${monthlyEstimate.cost.toFixed(2)} - Fixed ${(monthlyEstimate.fixedCost || 0).toFixed(2)})
                            </div>
                            <div className="flex justify-between pt-2">
                              <span>Monthly HDD ({activeMonths.find((m) => m.value === selectedMonth)?.label}):</span>
                              <span className="font-bold text-purple-600 dark:text-purple-400">{monthlyHDD} HDD</span>
                            </div>
                            <div className="flex justify-between pt-2">
                              <span>Annual HDD ({locationData.city}, {locationData.state}):</span>
                              <span className="font-bold text-purple-600 dark:text-purple-400">{Math.round(annualHDD)} HDD</span>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 pt-1">
                              {activeMonths.find((m) => m.value === selectedMonth)?.label} represents {(monthlyRatio * 100).toFixed(1)}% of annual heating load
                            </div>
                          </div>
                        </div>
                        
                        <div className="pt-2 border-t-2 border-purple-400 dark:border-purple-600">
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="font-semibold">Annual Variable Cost:</span>
                              <span className="font-bold text-purple-600 dark:text-purple-400">${annualVariableCost.toFixed(2)}</span>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              = (${monthlyVariableCost.toFixed(2)} / {monthlyHDD} HDD) × {Math.round(annualHDD)} HDD
                            </div>
                            {annualFixedCost > 0 && (
                              <>
                                <div className="flex justify-between pt-1">
                                  <span className="font-semibold">+ Annual Fixed Charges:</span>
                                  <span className="font-bold text-purple-600 dark:text-purple-400">${annualFixedCost.toFixed(2)}</span>
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  = ${(monthlyEstimate.fixedCost || 0).toFixed(2)} × 12 months
                                </div>
                              </>
                            )}
                            <div className="flex justify-between pt-2 border-t border-purple-300 dark:border-purple-700">
                              <span className="font-bold text-lg">Simplified Annual Estimate:</span>
                              <span className="font-bold text-lg text-purple-600 dark:text-purple-400">${annualCost.toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-semibold">
                            ⚠️ Note: This is a simplified example. The actual annual cost shown above uses per-month physics calculations for all 12 months, which accounts for seasonal temperature variations and thermostat settings more accurately. The actual annual heating cost may differ from this simplified estimate.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  </>
                );
              }
              
              return (
                <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                  <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Annual Heating Cost</h4>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    HDD data not available for this location. Annual estimate requires location data.
                  </div>
                </div>
              );
            })()}
            
            {energyMode === "cooling" && (
              <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Annual Cooling Cost</h4>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Cooling cost calculations use CDD (Cooling Degree Days) methodology. See monthly estimates above for cooling months.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}
      </div>
    </div>
  );
};

export default MonthlyBudgetPlanner;




