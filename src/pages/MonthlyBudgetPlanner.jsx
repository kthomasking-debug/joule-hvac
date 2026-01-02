import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useOutletContext, Link } from "react-router-dom";
import {
  Calendar,
  Thermometer,
  MapPin,
  DollarSign,
  AlertTriangle,
  Cloud,
  ChevronDown,
  ChevronUp,
  Calculator,
  CheckCircle2,
  Settings,
  Info,
  GraduationCap,
  BarChart3,
  Zap,
  Sun,
  Moon,
  Clock,
  TrendingDown,
  Home,
  RotateCcw,
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
} from "../lib/uiClasses";
import ThermostatScheduleCard from "../components/ThermostatScheduleCard";
import ThermostatScheduleClock from "../components/ThermostatScheduleClock";
import AnswerCard from "../components/AnswerCard";
import {
  loadThermostatSettings,
} from "../lib/thermostatSettings";
import OneClickOptimizer from "../components/optimization/OneClickOptimizer";
import useMonthlyForecast from "../hooks/useMonthlyForecast";
import useHistoricalHourly from "../hooks/useHistoricalHourly";
import {
  estimateMonthlyCoolingCostFromCDD,
  estimateMonthlyHeatingCostFromHDD,
} from "../lib/budgetUtils";

// Constants for math display
const BASE_BTU_PER_SQFT = 22.67;
const BASE_COOLING_LOAD_FACTOR = 28.0;
import { getAnnualHDD, getAnnualCDD } from "../lib/hddData";
import * as heatUtils from "../lib/heatUtils";
import { getCached, setCached } from "../utils/cachedStorage";
import {
  defaultFixedChargesByState,
  defaultFallbackFixedCharges,
  normalizeStateToAbbreviation,
} from "../data/fixedChargesByState";
import {
  fetchLiveElectricityRate,
  fetchLiveGasRate,
  getStateCode,
} from "../lib/eiaRates";
import {
  calculateElectricityCO2,
  calculateGasCO2,
  formatCO2,
} from "../lib/carbonFootprint";
import { getBestEquivalent, calculateCO2Equivalents, formatCO2Equivalent } from "../lib/co2Equivalents";
import { useUnitSystem, formatEnergyFromKwh } from "../lib/units";
import {
  STATE_ELECTRICITY_RATES,
  STATE_GAS_RATES,
} from "../data/stateRates";

// US State abbreviations to full names for input like "Chicago, IL"
const STATE_NAME_BY_ABBR = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

const normalize = (s) => (s || "").toLowerCase().replace(/[^a-z]/g, "");

// --- Typical HDD/CDD helpers (moved outside component for rules-of-hooks compliance) ---
function getTypicalHDD(month) {
  const typicalHDD = { 1: 1200, 2: 1000, 10: 200, 11: 500, 12: 1100 };
  return typicalHDD[month] || 800;
}

function getTypicalCDD(month) {
  const typicalCDD = { 5: 100, 6: 250, 7: 450, 8: 400, 9: 250 };
  return typicalCDD[month] || 300;
}

function estimateTypicalHDDCost(params) {
  // Use the same scaling logic as annual breakdown for consistency
  const monthlyHDDDist = [1200, 1000, 600, 200, 50, 10, 0, 0, 20, 200, 500, 1100]; // Jan-Dec
  const totalTypicalHDD = monthlyHDDDist.reduce((a, b) => a + b, 0); // ~4880
  
  // Get location-specific annual HDD if available
  let annualHDD = 5000; // default fallback
  if (params.locationData?.city && params.locationData?.state) {
    // getAnnualHDD is already imported at top of file
    annualHDD = getAnnualHDD(params.locationData.city, params.locationData.state);
  }
  
  // Scale monthly HDD to location's annual total (same as annual breakdown)
  const monthIndex = params.month - 1; // Convert 1-12 to 0-11
  const monthHDD = totalTypicalHDD > 0 ? (monthlyHDDDist[monthIndex] / totalTypicalHDD) * annualHDD : 0;
  
  // Calculate temperature multiplier - use actual thermostat settings first
  // Priority: 1) userSettings.winterThermostatDay/Night, 2) thermostatSettings comfortSettings, 3) defaults
  let winterDayTemp = params.userSettings?.winterThermostatDay;
  let winterNightTemp = params.userSettings?.winterThermostatNight;
  
  // If not in userSettings, check thermostat settings
  if (winterDayTemp === undefined || winterNightTemp === undefined) {
    try {
      const thermostatSettings = loadThermostatSettings();
      const comfortSettings = thermostatSettings?.comfortSettings;
      
      if (winterDayTemp === undefined) {
        winterDayTemp = comfortSettings?.home?.heatSetPoint ?? 70;
      }
      if (winterNightTemp === undefined) {
        winterNightTemp = comfortSettings?.sleep?.heatSetPoint ?? 66; // Default is 66, not 68
      }
    } catch {
      // Fallback to defaults if thermostat settings can't be loaded
      if (winterDayTemp === undefined) {
        winterDayTemp = 70;
      }
      if (winterNightTemp === undefined) {
        winterNightTemp = 66; // Default is 66, not 68 (from thermostatSettings.js)
      }
    }
  }
  const avgWinterIndoorTemp = (winterDayTemp * 16 + winterNightTemp * 8) / 24;
  const baseWinterOutdoorTemp = 35;
  const baseWinterDelta = 65 - baseWinterOutdoorTemp; // 30°F
  const actualWinterDelta = avgWinterIndoorTemp - baseWinterOutdoorTemp;
  const winterTempMultiplier = actualWinterDelta / baseWinterDelta;
  
  const estimate = estimateMonthlyHeatingCostFromHDD({
    hdd: monthHDD,
    squareFeet: params.squareFeet,
    insulationLevel: params.insulationLevel,
    homeShape: params.homeShape,
    ceilingHeight: params.ceilingHeight,
    hspf: params.hspf || params.efficiency,
    electricityRate: params.electricityRate,
  });
  
  // Apply temperature multiplier (same as annual breakdown)
  if (estimate && estimate.cost > 0) {
    estimate.cost = estimate.cost * winterTempMultiplier;
  }
  
  // Fixed costs are now handled by calculateMonthlyEstimate wrapper
  // No need to add them here to avoid double-counting
  params.setEstimate(estimate);
}

function estimateTypicalCDDCost(params) {
  // Use the same scaling logic as annual breakdown for consistency
  const monthlyCDDDist = [0, 0, 10, 60, 150, 300, 450, 400, 250, 100, 10, 0]; // Jan-Dec
  const totalTypicalCDD = monthlyCDDDist.reduce((a, b) => a + b, 0); // ~1730
  
  // Get location-specific annual CDD if available
  let annualCDD = 1500; // default fallback
  if (params.locationData?.city && params.locationData?.state) {
    // getAnnualCDD is already imported at top of file
    annualCDD = getAnnualCDD(params.locationData.city, params.locationData.state);
  }
  
  // Scale monthly CDD to location's annual total (same as annual breakdown)
  const monthIndex = params.month - 1; // Convert 1-12 to 0-11
  const monthCDD = totalTypicalCDD > 0 ? (monthlyCDDDist[monthIndex] / totalTypicalCDD) * annualCDD : 0;
  
  // Calculate temperature multiplier (same as annual breakdown)
  const summerDayTemp = params.userSettings?.summerThermostat ?? 76;
  const summerNightTemp = params.userSettings?.summerThermostatNight ?? 78;
  const avgSummerIndoorTemp = (summerDayTemp * 16 + summerNightTemp * 8) / 24;
  const baseSummerOutdoorTemp = 85;
  const baseSummerDelta = baseSummerOutdoorTemp - 65; // 20°F
  const actualSummerDelta = baseSummerOutdoorTemp - avgSummerIndoorTemp;
  const summerTempMultiplier = actualSummerDelta / baseSummerDelta;
  
  const estimate = estimateMonthlyCoolingCostFromCDD({
    ...params,
    cdd: monthCDD,
    seer2: params.efficiency,
  });
  
  // Apply temperature multiplier (same as annual breakdown)
  if (estimate && estimate.cost > 0) {
    estimate.cost = estimate.cost * summerTempMultiplier;
  }
  
  // Fixed costs are now handled by calculateMonthlyEstimate wrapper
  // No need to add them here to avoid double-counting
  
  params.setEstimate(estimate);
}

const MonthlyBudgetPlanner = ({ initialMode = "budget" }) => {
  const { unitSystem } = useUnitSystem();
  const outletContext = useOutletContext() || {};
  const { userSettings, setUserSetting } = outletContext;

  // Derive all settings from context for consistency
  const {
    squareFeet = 1500,
    insulationLevel = 1.0,
    homeShape = 1.0,
    ceilingHeight = 8,
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
    const handleSettingsUpdate = (e) => {
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

  // Component-specific state
  const [mode, setMode] = useState(initialMode);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1); // Default to current month
  const [locationData, setLocationData] = useState(null);
  const [monthlyEstimate, setMonthlyEstimate] = useState(null);
  const [showCalculations, setShowCalculations] = useState(false);
  
  // Year selection for aux heat calculation
  const [auxHeatYear, setAuxHeatYear] = useState(() => new Date().getFullYear() - 1); // Default to previous year
  const [useWorstYear, setUseWorstYear] = useState(false);
  
  // Get hourly historical data for selected year (heat pumps only)
  const { hourlyData: historicalHourly, loading: historicalLoading } = useHistoricalHourly(
    locationData?.latitude,
    locationData?.longitude,
    { 
      enabled: !!locationData?.latitude && !!locationData?.longitude && primarySystem === "heatPump" && energyMode === "heating",
      year: auxHeatYear
    }
  );
  const [forecastModel, setForecastModel] = useState("current"); // "typical" | "current" | "polarVortex"
  const [showAnnualPlanner, setShowAnnualPlanner] = useState(false); // Collapsed by default for reduced cognitive load
  const [showDailyForecast, setShowDailyForecast] = useState(false); // Collapsed by default - less important
  const [showSinusoidalGraph, setShowSinusoidalGraph] = useState(false); // Collapsed by default
  const [thermostatModel, setThermostatModel] = useState("current"); // "current" | "flat70" | "flat68" | "custom"
  const [annualCostData, setAnnualCostData] = useState(null); // Store annual cost data for top card
  const annualCostDataRef = useRef(null); // Ref to store calculated values without causing re-renders
  
  // Daily forecast for breakdown
  const { dailyForecast, loading: forecastLoading, error: forecastError } = useMonthlyForecast(
    locationData?.latitude,
    locationData?.longitude,
    selectedMonth,
    { enabled: !!locationData && mode === "budget" }
  );

  // Apply temperature adjustments based on forecast model
  const adjustedForecast = useMemo(() => {
    if (!dailyForecast || dailyForecast.length === 0) return null;
    
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
    });
    const heatLossBtu = estimatedDesignHeatLoss / 70; // BTU/hr per °F
    const avgWinterIndoorTemp = ((userSettings?.winterThermostatDay ?? 70) * 16 + (userSettings?.winterThermostatNight ?? 68) * 8) / 24;
    
    // Find balance point where heat pump output equals building heat loss
    for (let temp = -20; temp <= 50; temp += 0.5) {
      const perf = heatUtils.computeHourlyPerformance(
        {
          tons: tons,
          indoorTemp: avgWinterIndoorTemp,
          designHeatLossBtuHrAt70F: estimatedDesignHeatLoss,
          compressorPower: null, // Will be calculated
        },
        temp,
        50 // Typical humidity
      );
      
      const buildingHeatLossBtu = heatLossBtu * Math.max(0, avgWinterIndoorTemp - temp);
      
      // Balance point: heat pump output ≈ building heat loss
      if (perf.heatpumpOutputBtu >= buildingHeatLossBtu * 0.95 && perf.heatpumpOutputBtu <= buildingHeatLossBtu * 1.05) {
        return temp;
      }
      
      // If heat pump can't keep up even at warm temps, balance point is very low
      if (temp >= 40 && perf.heatpumpOutputBtu < buildingHeatLossBtu) {
        return -25; // Below -20°F, effectively no balance point
      }
    }
    
    return null; // No balance point found (system can handle all temps)
  }, [primarySystem, energyMode, capacity, squareFeet, insulationLevel, homeShape, ceilingHeight, userSettings?.winterThermostatDay, userSettings?.winterThermostatNight]);
  
  // Calculate potential savings from recommended schedule (70°F day / 68°F night)
  const potentialSavings = useMemo(() => {
    if (energyMode !== "heating" || !monthlyEstimate?.cost) return null;
    
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

    // Current weighted average
    const currentAvg = (indoorTemp * dayHours + nighttimeTemp * nightHours) / 24;
    
    // Recommended schedule: 70°F day / 68°F night (ASHRAE Standard 55)
    const recommendedDay = 70;
    const recommendedNight = 68;
    const recommendedAvg = (recommendedDay * dayHours + recommendedNight * nightHours) / 24;
    
    // Calculate temperature difference
    const tempDiff = currentAvg - recommendedAvg;
    
    // Rule of thumb: each degree lower saves ~2.5% on heating costs
    // Only show savings if recommended is lower (saves money)
    if (tempDiff > 0) {
      const savingsPercent = (tempDiff / currentAvg) * 0.8; // ~80% efficiency of theoretical
      const savingsDollars = monthlyEstimate.cost * savingsPercent;
      return {
        dollars: savingsDollars,
        percent: savingsPercent * 100,
        tempDiff: tempDiff
      };
    }
    
    return null;
  }, [energyMode, monthlyEstimate, indoorTemp, nighttimeTemp, daytimeTime, nighttimeTime]);

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
  const [gasRateA, setGasRateA] = useState(null);
  const [gasRateB, setGasRateB] = useState(null);

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

  // Automatically fetch electricity rates when Location A changes
  useEffect(() => {
    if (locationData?.state) {
      console.log("Fetching rates for Location A:", locationData.state);
      fetchUtilityRate(locationData.state, "electricity").then((result) => {
        console.log("Location A rate fetch result:", result);
        if (result?.rate) {
          setElectricityRateA(result.rate);
          setElectricityRateSourceA(result.source);
          // Update monthlyEstimate if it exists
          if (monthlyEstimate) {
            setMonthlyEstimate({
              ...monthlyEstimate,
              electricityRate: result.rate,
            });
          }
        } else {
          console.warn("No rate returned for Location A:", locationData.state, "Result:", result);
        }
      }).catch((err) => {
        console.error("Error fetching rate for Location A:", err);
      });
      if (primarySystem === "gasFurnace") {
        fetchUtilityRate(locationData.state, "gas").then((result) => {
          if (result?.rate) {
            setGasRateA(result.rate);
          }
        });
      }
    } else {
      console.log("Location A state not available:", locationData);
    }
  }, [locationData?.state, fetchUtilityRate, primarySystem]);

  // Automatically fetch electricity rates when Location B changes
  useEffect(() => {
    if (locationDataB?.state) {
      console.log("Fetching rates for Location B:", locationDataB.state);
      fetchUtilityRate(locationDataB.state, "electricity").then((result) => {
        console.log("Location B rate fetch result:", result);
        if (result?.rate) {
          setElectricityRateB(result.rate);
          setElectricityRateSourceB(result.source);
          // Update monthlyEstimateB if it exists
          if (monthlyEstimateB) {
            setMonthlyEstimateB({
              ...monthlyEstimateB,
              electricityRate: result.rate,
            });
          }
        } else {
          console.warn("No rate returned for Location B:", locationDataB.state);
        }
      }).catch((err) => {
        console.error("Error fetching rate for Location B:", err);
      });
      if (primarySystem === "gasFurnace") {
        fetchUtilityRate(locationDataB.state, "gas").then((result) => {
          if (result?.rate) {
            setGasRateB(result.rate);
          }
        });
      }
    } else {
      console.log("Location B state not available:", locationDataB);
    }
  }, [locationDataB?.state, fetchUtilityRate, primarySystem]);

  // Get user's location from localStorage (set during onboarding)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("userLocation");
      if (saved) setLocationData(JSON.parse(saved));
    } catch (e) {
      console.error("Error loading location:", e);
    }
  }, []);

  /**
   * Get effective heat loss factor (BTU/hr/°F)
   * Priority: 1) analyzerHeatLoss from ecobee CSV, 2) calculated from building specs
   * 
   * The analyzerHeatLoss comes from SystemPerformanceAnalyzer.jsx which analyzes
   * actual runtime data from ecobee CSV files to calculate real-world building efficiency.
   * This is more accurate than theoretical calculations based on square footage alone.
   */
  const getEffectiveHeatLossFactor = useMemo(() => {
    // Check for analyzer heat loss from ecobee CSV analysis
    const analyzerHeatLoss = userSettings?.analyzerHeatLoss;
    if (analyzerHeatLoss && typeof analyzerHeatLoss === 'number' && analyzerHeatLoss > 0) {
      return analyzerHeatLoss;
    }
    
    // Fallback to calculated heat loss from building specs using centralized function
    const estimatedDesignHeatLoss = heatUtils.calculateHeatLoss({
      squareFeet,
      insulationLevel,
      homeShape,
      ceilingHeight,
    });
    // Convert to BTU/hr/°F (divide by 70°F design temp difference)
    return estimatedDesignHeatLoss / 70;
  }, [userSettings?.analyzerHeatLoss, squareFeet, insulationLevel, homeShape, ceilingHeight]);

  /**
   * Get location-aware baseline temperature for heating calculations
   * This is the outdoor temperature below which heating is needed (balance point).
   * Colder climates use 30°F, moderate climates use 35°F.
   * 
   * @param {Object} locationData - Location data with latitude
   * @returns {number} Baseline temperature in °F
   */
  const getLocationAwareBaselineTemp = useCallback((locationData) => {
    if (!locationData?.latitude) return 35; // Default for unknown location
    
    const lat = Number(locationData.latitude);
    // Colder climates (higher latitude or known cold regions): 30°F
    // Moderate climates: 35°F
    if (lat >= 40 || locationData.state?.match(/AK|MN|ND|SD|MT|WY|ME|VT|NH/i)) {
      return 30;
    }
    return 35;
  }, []);

  const heatingMonths = React.useMemo(
    () => [
      { value: 1, label: "January" },
      { value: 2, label: "February" },
      { value: 10, label: "October" },
      { value: 11, label: "November" },
      { value: 12, label: "December" },
    ],
    []
  );
  const coolingMonths = React.useMemo(
    () => [
      { value: 5, label: "May" },
      { value: 6, label: "June" },
      { value: 7, label: "July" },
      { value: 8, label: "August" },
      { value: 9, label: "September" },
    ],
    []
  );
  // Combine all months for the dropdown - users can select any month
  const allMonths = React.useMemo(
    () => [
      ...heatingMonths,
      { value: 3, label: "March" },
      { value: 4, label: "April" },
      ...coolingMonths,
    ].sort((a, b) => a.value - b.value), // Sort by month number
    [heatingMonths, coolingMonths]
  );
  const activeMonths = React.useMemo(
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
      if (isHeatingMode && primarySystem === "gasFurnace") {
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
          primarySystem === "heatPump" ? capacity : coolingCapacity;
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

      if (primarySystem === "gasFurnace") {
        const eff = Math.min(0.99, Math.max(0.6, afue));
        const btuPerTherm = 100000;
        const estimatedDesignHeatLoss = heatUtils.calculateHeatLoss({
          squareFeet,
          insulationLevel,
          homeShape,
          ceilingHeight,
        });
        const btuLossPerDegF = estimatedDesignHeatLoss / 70;
        let totalTherms = 0,
          totalCost = 0;
        temps.forEach((day) => {
          const tempDiff = Math.max(0, effectiveIndoorTemp - day.avg);
          const buildingHeatLossBtu = btuLossPerDegF * tempDiff;
          const thermsPerDay = (buildingHeatLossBtu * 24) / (btuPerTherm * eff);
          totalTherms += thermsPerDay;
          totalCost += thermsPerDay * gasCost;
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
            if (setEstimate === setMonthlyEstimate) setHistoricalTempsA(temps);
            
            const isLocationA = setEstimate === setMonthlyEstimate;
            const rateResult = await fetchUtilityRate(locData.state, "electricity");
            if (isLocationA) setElectricityRateSourceA(rateResult.source);
            else setElectricityRateSourceB(rateResult.source);
            calculateMonthlyEstimate(temps, setEstimate, rateResult.rate);
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
        if (setEstimate === setMonthlyEstimate) setHistoricalTempsA(temps);

        const isLocationA = setEstimate === setMonthlyEstimate;
        const rateResult = await fetchUtilityRate(locData.state, "electricity");
        if (isLocationA) setElectricityRateSourceA(rateResult.source);
        else setElectricityRateSourceB(rateResult.source);
        calculateMonthlyEstimate(temps, setEstimate, rateResult.rate);
      } catch (error) {
        console.warn("Error fetching historical data", error);
        setErrorState(
          "Could not fetch historical climate data. Using typical estimates."
        );
        const isLocationA = setEstimate === setMonthlyEstimate;
        const rateResult = await fetchUtilityRate(
          locData?.state,
          "electricity"
        );
        if (isLocationA) setElectricityRateSourceA(rateResult.source);
        else setElectricityRateSourceB(rateResult.source);
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
            setEstimate,
            capacity,
            locationData,
            userSettings,
          });
        } else {
          estimateTypicalHDDCost({
            ...commonParams,
            month: selectedMonth,
            setEstimate,
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
      // If we have adjusted forecast data, use it directly
      if (adjustedForecast && adjustedForecast.length > 0 && mode === "budget") {
        fetchUtilityRate(locationData.state, "electricity").then(result => {
          setElectricityRateSourceA(result.source);
          // If forecast model is "typical", use the distribution model (pass empty array)
          // to match the Annual Breakdown calculation exactly
          const temps = forecastModel === "typical" ? [] : adjustedForecast;
          calculateMonthlyEstimate(temps, setMonthlyEstimate, result.rate);
        });
      } else {
        // If forecast model is "typical", use the distribution model directly without fetching historical data
        if (forecastModel === "typical") {
          fetchUtilityRate(locationData.state, "electricity").then(result => {
            setElectricityRateSourceA(result.source);
            calculateMonthlyEstimate([], setMonthlyEstimate, result.rate);
          });
        } else {
          // Fall back to historical data fetch
          fetchHistoricalData(
            locationData,
            setMonthlyEstimate,
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

    if (primarySystem === "gasFurnace" && (fixedGasCost ?? 0) <= 0) {
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
    if (primarySystem === "gasFurnace") {
      const eff = Math.min(0.99, Math.max(0.6, afue));
      const btuPerTherm = 100000;
      const estimatedDesignHeatLoss = heatUtils.calculateHeatLoss({
        squareFeet,
        insulationLevel,
        homeShape,
        ceilingHeight,
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
    const isWarmer = totalCostA < totalCostB;
    
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
  }, [mode, locationData, locationDataB, squareFeet, insulationLevel, homeShape, ceilingHeight, hspf2, efficiency, utilityCost, coolingCapacity, capacity, solarExposure]);

  // Calculate comprehensive annual costs for both cities using auto-mode logic with sinusoidal patterns
  const annualComparisonCosts = useMemo(() => {
    if (mode !== "comparison" || !locationData || !locationDataB) return null;
    
    try {
      // Priority: 1) userSettings.winterThermostatDay/Night, 2) thermostatSettings comfortSettings, 3) defaults
      // Load thermostat settings as fallback
      const thermostatSettings = loadThermostatSettings();
      const comfortSettings = thermostatSettings?.comfortSettings || {};
      const schedule = thermostatSettings?.schedule;
      
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
      const deadband = 3; // Minimum deadband between heat and cool
      
      // Helper to get comfort mode for hour
      // Uses daytimeTime and nighttimeTime from user settings
      const getComfortModeForHour = (hour, dayOfWeek = 0) => {
        // Convert daytimeTime and nighttimeTime to hours (0-23)
        const timeToHours = (timeStr) => {
          const [h, m] = (timeStr || "06:00").split(":").map(Number);
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
                if (hour.temp < balancePoint && useElectricAuxHeat && perf.auxKwh !== undefined) {
                  monthHeatingKwh += perf.auxKwh;
                }
              } else if (primarySystem === "gasFurnace") {
                const tempDiff = Math.max(0, indoorTempForMode - hour.temp);
                const buildingHeatLossBtu = btuLossPerDegF * tempDiff;
                const thermsPerHour = (buildingHeatLossBtu) / (100000 * afue);
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
              const hourlyKWh = buildingHeatGainBtuPerHour / (adjustedSeer2 * 1000);
              
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
          const monthlyFixed = (primarySystem === "gasFurnace" && monthHDD > 0) ? fixedGasCost : fixedElectricCost;
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
    mode, locationData, locationDataB, squareFeet, insulationLevel, homeShape, ceilingHeight,
    capacity, efficiency, hspf2, coolingCapacity, primarySystem, afue, useElectricAuxHeat,
    utilityCost, fixedElectricCost, fixedGasCost, solarExposure, monthlyEstimate, monthlyEstimateB,
    userSettings?.winterThermostatDay, userSettings?.winterThermostatNight,
    userSettings?.summerThermostat, userSettings?.summerThermostatNight,
    daytimeTime, nighttimeTime // Include schedule times so changes trigger recalculation
  ]);

  return (
    <div className="min-h-screen bg-[#0C0F14]">
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
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


      {/* Quick Answer - Monthly Cost Estimate at Top */}
      {mode === "budget" && monthlyEstimate && (
        <div className="mb-2">
          <AnswerCard
            loading={false}
            location={locationData ? `${locationData.city}, ${locationData.state}` : null}
            temp={Math.round(effectiveIndoorTemp)}
            weeklyCost={monthlyEstimate.cost}
            energyMode={energyMode}
            primarySystem={primarySystem}
            timePeriod="month"
            compact={true}
          />
        </div>
      )}


      {/* Modeled Schedule Section - Match Weekly Forecast Layout */}
      {mode === "budget" && (
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-800/90 via-slate-900/90 to-slate-800/90 border border-slate-700/50 rounded-xl p-4 mb-2 shadow-2xl shadow-slate-900/50 backdrop-blur-sm">
          {/* Subtle animated background */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-cyan-500/5 animate-pulse" />
          <div className="relative z-10">
            {/* Header */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Modeled Schedule (What-If)
                </h2>
                <p className="text-xs text-slate-400 flex items-center gap-1 px-1.5 py-0.5 bg-slate-800/50 rounded border border-slate-700/50">
                  <span>🔒</span>
                  <span>Safe to experiment</span>
                </p>
              </div>
              {energyMode === "heating" && (
                <div className="flex-shrink-0">
                  <OneClickOptimizer
                    currentDayTemp={userSettings?.winterThermostatDay ?? 70}
                    currentNightTemp={userSettings?.winterThermostatNight ?? 68}
                    mode={energyMode}
                    weatherForecast={adjustedForecast?.slice(0, 7) || []}
                    electricRate={utilityCost}
                    heatLossFactor={getEffectiveHeatLossFactor}
                    hspf2={hspf2 || efficiency}
                    onApplySchedule={(schedule) => {
                      if (setUserSetting) {
                        setUserSetting("winterThermostatDay", schedule.dayTemp);
                        setUserSetting("winterThermostatNight", schedule.nightTemp);
                      }
                      setIndoorTemp(schedule.dayTemp);
                      setNighttimeTemp(schedule.nightTemp);
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
                    <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-200 mb-2">
                      <Sun className="w-4 h-4 text-yellow-400" />
                      <span>Daytime</span>
                      <span className="ml-auto text-lg font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">{userSettings?.winterThermostatDay ?? indoorTemp ?? 70}°F</span>
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
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
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
                    <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-200 mb-2">
                      <Sun className="w-4 h-4 text-yellow-400" />
                      <span>Daytime</span>
                      <span className="ml-auto text-lg font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">{summerThermostat || 75}°F</span>
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
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
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

              {/* Nighttime Temperature */}
              {energyMode === "heating" && (
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                  <div className="relative bg-slate-800/50 backdrop-blur-sm border border-blue-500/20 rounded-xl p-3 hover:border-blue-500/40 transition-all duration-300">
                    <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-200 mb-2">
                      <Moon className="w-4 h-4 text-blue-400" />
                      <span>Nighttime</span>
                      <span className="ml-auto text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">{userSettings?.winterThermostatNight ?? nighttimeTemp ?? 68}°F</span>
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
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
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
                    <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-200 mb-2">
                      <Moon className="w-4 h-4 text-blue-400" />
                      <span>Nighttime</span>
                      <span className="ml-auto text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">{summerThermostatNight || summerThermostat || 72}°F</span>
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
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
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
      {mode === "budget" && primarySystem === "heatPump" && energyMode === "heating" && (
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
      {mode === "budget" && adjustedForecast && adjustedForecast.length > 0 && monthlyEstimate && (
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
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
              {activeMonths.find((m) => m.value === selectedMonth)?.label} {new Date().getFullYear()} - 
              Forecast-Based Estimate
            </p>
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-gray-700 dark:text-gray-300 mb-2">
                <strong>⚠️ Note:</strong> This forecast-based total may differ from the "30-year typical" estimate above. 
                The main estimate uses long-term climate average for budgeting, while this table uses actual forecast data 
                (first 15 days from NWS forecast, remaining days from historical average).
              </p>
              <p className="text-xs text-gray-700 dark:text-gray-300">
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
                . The first 15 days use real-time forecast data, while days 16-31 use 10-year historical average from the Open-Meteo archive API.
              </p>
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
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
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
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                      This graph shows the hourly temperature profile for each day of the month, calculated using a sinusoidal curve. 
                      Temperatures are lowest around 6 AM and highest around 2 PM, creating a realistic daily temperature cycle.
                    </p>
                    <div className="w-full" style={{ height: '400px' }}>
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
            // Calculate daily metrics
            const tonsMap = {
              18: 1.5, 24: 2.0, 30: 2.5, 36: 3.0, 42: 3.5, 48: 4.0, 60: 5.0,
            };
            const tons = tonsMap[capacity] || 3.0;
            const estimatedDesignHeatLoss = heatUtils.calculateHeatLoss({
              squareFeet,
              insulationLevel,
              homeShape,
              ceilingHeight,
            });
            const btuLossPerDegF = estimatedDesignHeatLoss / 70;
            const compressorPower = tons * 1.0 * (15 / efficiency);
            
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
                        designHeatLossBtuHrAt70F: estimatedDesignHeatLoss,
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
                } else if (dayMode === "heating" && primarySystem === "gasFurnace") {
                  const buildingHeatLossBtu = btuLossPerDegF * tempDiff;
                  const eff = Math.min(0.99, Math.max(0.6, afue));
                  const thermsPerDay = (buildingHeatLossBtu * 24) / (100000 * eff);
                  dailyCost = thermsPerDay * gasCost;
                  dailyEnergy = thermsPerDay * 29.3; // Convert therms to kWh for display
                } else if (dayMode === "cooling") {
                  const coolingCapacityKbtu = primarySystem === "heatPump" ? capacity : coolingCapacity;
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
                  <span className="text-sm font-semibold min-w-[50px] text-right text-gray-900 dark:text-gray-100">
                    {Math.round(value * 10) / 10}
                  </span>
                </div>
              );
            };
            
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800 border-b-2 border-gray-300 dark:border-gray-600">
                      <th className="text-left py-2 px-3 font-semibold text-gray-900 dark:text-gray-100">Day</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-900 dark:text-gray-100">Temp Range</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-900 dark:text-gray-100">Energy (kWh)</th>
                      {primarySystem === "heatPump" && energyMode === "heating" && useElectricAuxHeat && (
                        <th className="text-right py-2 px-3 font-semibold text-gray-900 dark:text-gray-100">Aux (kWh)</th>
                      )}
                      <th className="text-right py-2 px-3 font-semibold text-gray-900 dark:text-gray-100">Cost</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-900 dark:text-gray-100">Source</th>
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
                          isToday ? 'bg-blue-100 dark:bg-blue-900/30 font-semibold' : ''
                        }`}
                      >
                        <td className="py-2 px-3 font-semibold text-gray-900 dark:text-gray-100">{day.day}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div className="bg-gradient-to-r from-blue-400 to-red-400 rounded-full h-2 w-16"></div>
                            <span className="text-sm text-gray-900 dark:text-gray-100">
                              {day.low.toFixed(0)}° - {day.high.toFixed(0)}°F
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <InlineBar value={day.energy} maxValue={maxEnergy} color="blue" />
                        </td>
                        {primarySystem === "heatPump" && energyMode === "heating" && useElectricAuxHeat && (
                          <td className="py-2 px-3">
                            <InlineBar value={day.auxEnergy} maxValue={maxAuxEnergy} color="orange" />
                          </td>
                        )}
                        <td
                          className="py-2 px-3 transition-colors"
                          style={{ backgroundColor: getHeatMapColor(day.cost) }}
                        >
                          <span className="text-sm font-bold text-green-700 dark:text-green-400">
                            ${Math.round(day.cost * 100) / 100}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`text-xs px-2 py-1 rounded ${
                            day.source === 'forecast' 
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}>
                            {day.source === 'forecast' ? 'Forecast' : 'Historical'}
                          </span>
                        </td>
                      </tr>
                      );
                    })}
                    <tr className="border-t-2 border-gray-300 dark:border-gray-600 font-bold bg-gray-50 dark:bg-gray-900/50">
                      <td colSpan={primarySystem === "heatPump" && energyMode === "heating" && useElectricAuxHeat ? 3 : 2} className="py-3 px-3 text-gray-900 dark:text-gray-100">
                        Monthly Total (Forecast-Based)
                      </td>
                      <td className="py-3 px-3 text-right text-gray-900 dark:text-gray-100">
                        {Math.round(totalForecastEnergy * 10) / 10} kWh
                      </td>
                      {primarySystem === "heatPump" && energyMode === "heating" && useElectricAuxHeat && (
                        <td className="py-3 px-3"></td>
                      )}
                      <td className="py-3 px-3 text-right text-gray-900 dark:text-gray-100">
                        ${(Math.round(totalForecastCost * 100) / 100).toFixed(2)}
                        {monthlyEstimate?.fixedCost > 0 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-normal block mt-1">
                            + ${monthlyEstimate.fixedCost.toFixed(2)} fixed fees = ${(Math.round(totalForecastCost * 100) / 100 + monthlyEstimate.fixedCost).toFixed(2)} total
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3"></td>
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
      {mode !== "annual" && (
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
                  {primarySystem === "gasFurnace" && (
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
            let usesHistoricalHourly = false;
            let usesSinusoidalApprox = false;
            
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
                    usesHistoricalHourly = true;
                    const tonsMap = { 18: 1.5, 24: 2.0, 30: 2.5, 36: 3.0, 42: 3.5, 48: 4.0, 60: 5.0 };
                    const tons = tonsMap[capacity] || 3.0;
                    const estimatedDesignHeatLoss = heatUtils.calculateHeatLoss({
                      squareFeet,
                      insulationLevel,
                      homeShape,
                      ceilingHeight,
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
                      const needsCooling = hour.temp > setpoints.cool;
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
                        if (hour.temp < balancePoint && useElectricAuxHeat) {
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
                    usesSinusoidalApprox = true;
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
                        const needsCooling = hour.temp > setpoints.cool;
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
                          if (hour.temp < balancePoint && useElectricAuxHeat) {
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
              if (primarySystem === "gasFurnace") {
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
            
            const annualFixedOnly = (safeFixedElectric * 12) + (primarySystem === "gasFurnace" ? safeFixedGas * 12 : 0);
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
                  
                {/* Monthly Breakdown */}
                <div className="mt-6 space-y-4">
                  <h4 className="font-semibold text-high-contrast text-lg mb-3">Monthly Breakdown</h4>
                  
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
                
                {/* Sinusoidal Temperature Graphs */}
                <div className="mt-8 space-y-6">
                  <h4 className="font-semibold text-high-contrast text-lg mb-4">Annual Temperature Profiles</h4>
                  
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
                        <div className="w-full" style={{ height: '400px' }}>
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
                        <div className="w-full" style={{ height: '400px' }}>
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
              </>
            );
          })()}
        </div>
      )}

      {/* Annual Budget Planner - Enhanced Section */}
      {/* Year-Ahead Budget Planning - Removed for simplified design */}
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
                    if (primarySystem === "gasFurnace") {
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
                    if (primarySystem === "gasFurnace") {
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
                  const annualFixedOnly = (safeFixedElectric * 12) + (primarySystem === "gasFurnace" ? safeFixedGas * 12 : 0);
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
                  <div className="w-full" style={{ height: '350px' }}>
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

      {/* Live Math Calculations Pulldown */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden mt-8">
        <button
          onClick={() => setShowCalculations(!showCalculations)}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
              <GraduationCap size={24} className="text-white" />
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
          <div className="px-4 pb-4 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3">
            {/* Building Characteristics */}
            <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Building Characteristics</h4>
              {/* Heat Loss Method Indicator */}
              {(() => {
                const useCalculated = userSettings?.useCalculatedHeatLoss !== false; // Default to true
                const useManual = Boolean(userSettings?.useManualHeatLoss);
                const useAnalyzer = Boolean(userSettings?.useAnalyzerHeatLoss);
                
                let methodLabel = "";
                let methodColor = "text-blue-600 dark:text-blue-400";
                
                if (useManual) {
                  methodLabel = "Using Manual Entry";
                  methodColor = "text-purple-600 dark:text-purple-400";
                } else if (useAnalyzer) {
                  methodLabel = "Using CSV Analyzer Data";
                  methodColor = "text-amber-600 dark:text-amber-400";
                } else if (useCalculated) {
                  methodLabel = "Using Calculated (DOE Data)";
                  methodColor = "text-blue-600 dark:text-blue-400";
                }
                
                if (methodLabel) {
                  return (
                    <div className={`mb-3 text-xs font-semibold ${methodColor} bg-white dark:bg-gray-800 rounded px-2 py-1 inline-block border border-current`}>
                      📊 {methodLabel}
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
                      {Math.round(squareFeet * 22.67 * insulationLevel * homeShape * (1 + (ceilingHeight - 8) * 0.1)).toLocaleString()} BTU/hr
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    = {squareFeet.toLocaleString()} × 22.67 × {insulationLevel.toFixed(2)} × {homeShape.toFixed(2)} × {(1 + (ceilingHeight - 8) * 0.1).toFixed(3)}
                  </div>
                  {energyMode === "heating" && (() => {
                    const heatLossPerDegF = ((squareFeet * 22.67 * insulationLevel * homeShape * (1 + (ceilingHeight - 8) * 0.1)) / 70);
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
                      </div>
                    );
                  })()}
                </div>
                {energyMode === "heating" ? (
                  <div className="pt-2">
                    <div className="flex justify-between">
                      <span>BTU Loss per °F:</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {((squareFeet * 22.67 * insulationLevel * homeShape * (1 + (ceilingHeight - 8) * 0.1)) / 70).toFixed(1)} BTU/hr/°F
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      = {Math.round(squareFeet * 22.67 * insulationLevel * homeShape * (1 + (ceilingHeight - 8) * 0.1)).toLocaleString()} ÷ 70
                    </div>
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
                  <span className="font-bold">{primarySystem === "heatPump" ? "Heat Pump" : "Gas Furnace"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Capacity:</span>
                  <span className="font-bold">{capacity}k BTU</span>
                </div>
                {energyMode === "heating" ? (
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
                ) : (
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
                {primarySystem === "gasFurnace" && (
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
                // Capacity factor: heat pumps lose capacity as outdoor temp drops
                // At 47°F: 100% capacity, at 17°F: ~70% capacity, at 0°F: ~50% capacity
                // Simplified linear model: capFactor = 1 - ((47 - outdoorTemp) / 100) * 0.3 for temps below 47°F
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
                
                return (
                  <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
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
      </div>
    </div>
  );
};

export default MonthlyBudgetPlanner;




