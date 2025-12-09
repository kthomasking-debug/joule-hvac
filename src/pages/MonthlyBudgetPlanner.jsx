import React, { useState, useEffect, useCallback, useMemo } from "react";
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
} from "lucide-react";
import {
  inputClasses,
  fullInputClasses,
  selectClasses,
} from "../lib/uiClasses";
import { DashboardLink } from "../components/DashboardLink";
import ThermostatScheduleCard from "../components/ThermostatScheduleCard";
import {
  loadThermostatSettings,
} from "../lib/thermostatSettings";
import useMonthlyForecast from "../hooks/useMonthlyForecast";
import {
  estimateMonthlyCoolingCostFromCDD,
  estimateMonthlyHeatingCostFromHDD,
} from "../lib/budgetUtils";
import { getAnnualHDD, getAnnualCDD } from "../lib/hddData";
import * as heatUtils from "../lib/heatUtils";
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
  const hdd = getTypicalHDD(params.month);
  params.setEstimate(
    estimateMonthlyHeatingCostFromHDD({
      ...params,
      hdd,
      hspf: params.efficiency,
    })
  );
}

function estimateTypicalCDDCost(params) {
  const cdd = getTypicalCDD(params.month);
  params.setEstimate(
    estimateMonthlyCoolingCostFromCDD({
      ...params,
      cdd,
      seer2: params.efficiency,
    })
  );
}

const MonthlyBudgetPlanner = () => {
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
    try {
      const thermostatSettings = loadThermostatSettings();
      return thermostatSettings?.comfortSettings?.home?.heatSetPoint || 
             userSettings?.winterThermostat || 
             70;
    } catch {
      return userSettings?.winterThermostat || 70;
    }
  });

  const [nighttimeTemp, setNighttimeTemp] = useState(() => {
    try {
      const thermostatSettings = loadThermostatSettings();
      return thermostatSettings?.comfortSettings?.sleep?.heatSetPoint || 65;
    } catch {
      return 65;
    }
  });

  // Sync from thermostatSettings when they change
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
        const homeTemp = thermostatSettings?.comfortSettings?.home?.heatSetPoint;
        const sleepTemp = thermostatSettings?.comfortSettings?.sleep?.heatSetPoint;
        if (homeTemp !== undefined) setIndoorTemp(homeTemp);
        if (sleepTemp !== undefined) setNighttimeTemp(sleepTemp);
      } catch {
        // ignore
      }
    };
    window.addEventListener("thermostatSettingsUpdated", handleSettingsUpdate);
    return () => window.removeEventListener("thermostatSettingsUpdated", handleSettingsUpdate);
  }, []);

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

  // Calculate weighted average indoor temp based on day/night schedule
  // Uses actual times from thermostat settings (not hardcoded)
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
    } else {
      // For cooling, use summer settings (fallback to realistic defaults)
      const summerDay = summerThermostat || 75;
      const summerNight = summerThermostatNight || 72;
      return (summerDay * dayHours + summerNight * nightHours) / 24;
    }
  }, [energyMode, indoorTemp, nighttimeTemp, daytimeTime, nighttimeTime, summerThermostat, summerThermostatNight]);

  // Local setters that call the global context setter
  const setUseElectricAuxHeat = (v) => setUserSetting("useElectricAuxHeat", v);

  // Component-specific state
  const [mode, setMode] = useState("budget");
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1); // Default to current month
  const [locationData, setLocationData] = useState(null);
  const [monthlyEstimate, setMonthlyEstimate] = useState(null);
  const [showCalculations, setShowCalculations] = useState(false);
  const [forecastModel, setForecastModel] = useState("typical"); // "typical" | "current" | "polarVortex"
  const [showAnnualPlanner, setShowAnnualPlanner] = useState(false); // Collapsed by default for reduced cognitive load
  const [showThermostatSchedule, setShowThermostatSchedule] = useState(false); // Collapsed by default - cost is primary
  const [thermostatModel, setThermostatModel] = useState("current"); // "current" | "flat70" | "flat68" | "custom"
  
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
  const [monthlyEstimateB, setMonthlyEstimateB] = useState(null);
  const [loadingB, setLoadingB] = useState(false);
  const [errorB, setErrorB] = useState(null);
  const [cityInputB, setCityInputB] = useState("");
  const [elevationOverrideB, setElevationOverrideB] = useState(null);
  const [searchStatusB, setSearchStatusB] = useState(null);

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
    
    // Fallback to calculated heat loss from building specs
    const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
    const estimatedDesignHeatLoss = squareFeet * 22.67 * insulationLevel * homeShape * ceilingMultiplier;
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
    (temps, setEstimate, electricityRate) => {
      const commonParams = {
        squareFeet,
        insulationLevel,
        homeShape,
        ceilingHeight,
        efficiency,
        solarExposure,
      };
      if (!temps || temps.length === 0) {
        // Determine if this is a cooling or heating month
        const isCoolingMonth = coolingMonths.some((m) => m.value === selectedMonth);
        const isHeatingMonth = heatingMonths.some((m) => m.value === selectedMonth);
        // For transition months (March, April), use energyMode setting
        const useCooling = isCoolingMonth || (energyMode === "cooling" && !isHeatingMonth);
        
        if (useCooling) {
          estimateTypicalCDDCost({
            ...commonParams,
            month: selectedMonth,
            setEstimate,
            capacity,
            electricityRate,
          });
        } else {
          estimateTypicalHDDCost({
            ...commonParams,
            month: selectedMonth,
            setEstimate,
            electricityRate,
          });
        }
        return;
      }

      // Determine if this is a cooling or heating month
      const isCoolingMonth = coolingMonths.some((m) => m.value === selectedMonth);
      const isHeatingMonth = heatingMonths.some((m) => m.value === selectedMonth);
      // For transition months (March, April), use energyMode setting
      const useCooling = isCoolingMonth || (energyMode === "cooling" && !isHeatingMonth);
      
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

        setEstimate({
          cost: totalCost,
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
        const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
        const estimatedDesignHeatLoss =
          squareFeet * 22.67 * insulationLevel * homeShape * ceilingMultiplier;
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
        setEstimate({
          cost: totalCost,
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

      temps.forEach((day) => {
        const tempDiff = Math.max(0, effectiveIndoorTemp - day.avg);
        const buildingHeatLoss = btuLossPerDegF * tempDiff;
        const capFactor = Math.max(
          0.3,
          1 - (Math.abs(0 - day.avg) / 100) * 0.5
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
        const totalDayEnergy =
          (compressorEnergyPerHour + effectiveAuxEnergyPerHour) * 24;
        totalCost += totalDayEnergy * electricityRate;
        totalEnergy += totalDayEnergy;
        if (!useElectricAuxHeat && auxHeatEnergyPerHour > 0)
          excludedAuxEnergy += auxHeatEnergyPerHour * 24;
      });

      setEstimate({
        cost: totalCost,
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
        const stationElevFt = locData.elevation ?? elevationFtOverride ?? 0;
        const homeElevFt = elevationFtOverride ?? stationElevFt;
        const deltaF = (homeElevFt - stationElevFt) * (-3.5 / 1000);
        const temps = data.daily.time.map((date, idx) => {
          const high = data.daily.temperature_2m_max[idx] + deltaF;
          const low = data.daily.temperature_2m_min[idx] + deltaF;
          return { date, high, low, avg: (high + low) / 2 };
        });

        if (setEstimate === setMonthlyEstimateB) setHistoricalTempsB(temps);

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
          });
        } else {
          estimateTypicalHDDCost({
            ...commonParams,
            month: selectedMonth,
            setEstimate,
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
          calculateMonthlyEstimate(adjustedForecast, setMonthlyEstimate, result.rate);
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
    utilityCost,
    gasCost,
    primarySystem,
    afue,
    capacity,
    efficiency,
    calculateMonthlyEstimate,
    fetchUtilityRate,
  ]);

  // Auto-fetch for Location B
  useEffect(() => {
    if (
      mode === "comparison" &&
      locationDataB?.latitude &&
      locationDataB?.longitude
    ) {
      fetchHistoricalData(
        locationDataB,
        setMonthlyEstimateB,
        setLoadingB,
        setErrorB,
        elevationOverrideB
      );
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
      const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
      const estimatedDesignHeatLoss =
        squareFeet * 22.67 * insulationLevel * homeShape * ceilingMultiplier;
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
      const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
      const estimatedDesignHeatLoss =
        squareFeet * 22.67 * insulationLevel * homeShape * ceilingMultiplier;
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

  return (
    <div className="page-gradient-overlay min-h-screen">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8 bg-slate-800/40 dark:bg-slate-800/20 rounded-2xl">
        <DashboardLink />

        {/* Page Header */}
        <div className="mb-8 animate-fade-in-up">
          <div className="flex items-center gap-4 mb-3">
            <div className="icon-container icon-container-gradient">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h1 className="heading-primary">
                Monthly Budget Planner
              </h1>
              <p className="text-muted mt-1">
                Estimate your typical{" "}
                {energyMode === "cooling" ? "cooling" : "heating"} bill for any month
                using 30-year historical climate data
              </p>
            </div>
          </div>
        </div>

      {/* Mode Toggle */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex rounded-lg glass-card p-1">
          <button
            onClick={() => setMode("budget")}
            className={`px-6 py-2 rounded-md font-semibold transition-all ${
              mode === "budget"
                ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md"
                : "text-high-contrast hover:opacity-80"
            }`}
          >
            👤 My Budget
          </button>
          <button
            onClick={() => setMode("comparison")}
            className={`px-6 py-2 rounded-md font-semibold transition-all ${
              mode === "comparison"
                ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md"
                : "text-high-contrast hover:opacity-80"
            }`}
          >
            🏙️ City Comparison
          </button>
        </div>
      </div>

      {/* Location Status - Comparison Mode */}
      {mode === "comparison" && (
        // Two-city comparison mode
        <div className="grid grid-cols-1 md:grid-cols-2 gap-glass mb-6">
          {/* Location A */}
          <div className="glass-card p-glass animate-fade-in-up border-blue-500/30">
            <div className="text-xs font-semibold text-blue-500 mb-1">
              LOCATION A
            </div>
            {locationData ? (
              <>
                <div className="flex items-center gap-2 text-high-contrast">
                  <MapPin size={16} className="text-blue-500" />
                  <span className="font-semibold">
                    {locationData.city}, {locationData.state}
                  </span>
                </div>
                {typeof locationData.elevation === "number" && (
                  <div className="text-[11px] text-muted mt-0.5 opacity-90">
                    Elevation: ~{Math.round(locationData.elevation)} ft
                  </div>
                )}
                {typeof monthlyEstimate?.electricityRate === "number" && (
                  <div className="text-xs text-muted mt-1">
                    <div>
                      ${monthlyEstimate.electricityRate.toFixed(3)}/kWh{" "}
                      {locationData.state && `(${locationData.state})`}
                    </div>
                    {electricityRateSourceA && (
                      <div className="text-[10px] opacity-75 mt-0.5">
                        {electricityRateSourceA}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-high-contrast text-sm">
                Set location in{" "}
                <Link to="/cost-forecaster" className="underline">
                  Forecaster
                </Link>
              </div>
            )}
          </div>

          {/* Location B */}
          <div className="glass-card p-glass animate-fade-in-up border-green-500/30">
            <div className="text-xs font-semibold text-green-500 mb-1">
              LOCATION B
            </div>
            {locationDataB ? (
              <>
                <div className="flex items-center gap-2 text-high-contrast">
                  <MapPin size={16} className="text-green-500" />
                  <span className="font-semibold">
                    {locationDataB.city}, {locationDataB.state}
                  </span>
                  <button
                    onClick={() => setLocationDataB(null)}
                    className="ml-auto text-xs underline hover:opacity-80"
                  >
                    Change
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
                  <div className="text-[11px] text-muted">
                    Station Elevation: ~
                    {Math.round(locationDataB.elevation ?? 0)} ft
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-muted whitespace-nowrap">
                      Home Elevation:
                    </label>
                    <input
                      type="number"
                      value={elevationOverrideB ?? ""}
                      onChange={(e) =>
                        setElevationOverrideB(
                          e.target.value === "" ? null : Number(e.target.value)
                        )
                      }
                      className={inputClasses}
                      placeholder={`${Math.round(
                        locationDataB.elevation ?? 0
                      )}`}
                    />
                    <span className="text-[11px] text-muted">
                      ft
                    </span>
                  </div>
                  <div className="sm:col-span-2 text-[10px] text-muted opacity-80">
                    Applies standard lapse rate ≈ 3.5°F per 1000 ft to outdoor
                    temps
                  </div>
                </div>
                {typeof monthlyEstimateB?.electricityRate === "number" && (
                  <div className="text-xs text-muted mt-1">
                    <div>
                      ${monthlyEstimateB.electricityRate.toFixed(3)}/kWh{" "}
                      {locationDataB.state && `(${locationDataB.state})`}
                    </div>
                    {electricityRateSourceB && (
                      <div className="text-[10px] opacity-75 mt-0.5">
                        {electricityRateSourceB}
                      </div>
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

      {/* Inputs Section */}
      <div className="mb-8">
        <p className="text-xs text-muted mb-4 font-medium">Inputs we're using</p>
        
        {/* Location Display - Budget Mode */}
        {mode === "budget" && (
          locationData ? (
            <div className="glass-card p-glass mb-6 animate-fade-in-up">
              <label className="block text-sm font-semibold text-high-contrast mb-3">
                <MapPin className="inline mr-2 text-blue-500" size={18} />
                Location
              </label>
              <div className="flex items-center gap-2 text-high-contrast">
                <span className="font-semibold">
                  {locationData.city}, {locationData.state}
                </span>
                <span className="text-sm text-muted">
                  ({locationData?.latitude?.toFixed(2) ?? "N/A"}°,{" "}
                  {locationData?.longitude?.toFixed(2) ?? "N/A"}°)
                </span>
              </div>
              {typeof monthlyEstimate?.electricityRate === "number" && (
                <div className="text-xs text-muted mt-2">
                  <div className="font-medium">
                    Electricity rate: $
                    {monthlyEstimate.electricityRate.toFixed(3)}/kWh
                  </div>
                  {electricityRateSourceA && (
                    <div className="text-xs opacity-80 mt-0.5">
                      {electricityRateSourceA}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="glass-card p-glass mb-6 animate-fade-in-up border-yellow-500/30">
              <label className="block text-sm font-semibold text-high-contrast mb-3">
                <MapPin className="inline mr-2 text-yellow-500" size={18} />
                Location
              </label>
              <div className="flex items-center gap-2 text-high-contrast">
                <AlertTriangle size={18} className="text-yellow-500" />
                <span>
                  Please set your location in the{" "}
                  <Link
                    to="/cost-forecaster"
                    className="font-semibold underline hover:opacity-80"
                  >
                    7-Day Forecaster
                  </Link>{" "}
                  first to use this tool.
                </span>
              </div>
            </div>
          )
        )}
        
        {/* Month Selector */}
        <div className="glass-card p-glass mb-6 animate-fade-in-up">
          <label className="block text-sm font-semibold text-high-contrast mb-3">
            <Calendar className="inline mr-2 text-blue-500" size={18} />
            Select Month
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className={selectClasses}
          >
            {activeMonths.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </div>

        {/* Forecast Model Selector - Winter Severity Feature */}
        {energyMode === "heating" && (
          <div className="glass-card p-glass mb-6 animate-fade-in-up border-blue-500/30">
            <label className="block text-sm font-semibold text-high-contrast mb-3">
              <Cloud className="inline mr-2 text-blue-500" size={18} />
              Weather data: Typical year (30-year average)
              <span className="ml-2 relative group">
                <Info 
                  size={14} 
                  className="inline text-blue-500 cursor-help" 
                  title="TMY3 (Typical Meteorological Year 3) is a standardized weather dataset representing typical conditions based on 30 years of historical data. This provides a reliable baseline for energy cost estimates."
                />
              </span>
            </label>
            <select
              value={forecastModel}
              onChange={(e) => setForecastModel(e.target.value)}
              className={selectClasses}
            >
              <option value="typical">Typical year (30-year average)</option>
              <option value="current">Current Forecast (NOAA/NWS) - Live Data</option>
              <option value="polarVortex">Polar Vortex (Worst Case) - -5°F Anomaly</option>
            </select>
            {forecastModel === "polarVortex" && (
              <div className="mt-3 p-3 glass-card border-red-500/30 bg-red-900/10">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-high-contrast">
                    <p className="font-semibold mb-1">❄️ Polar Vortex Scenario Active</p>
                    <p className="text-muted">
                      This forecast applies a <strong>-5°F temperature offset</strong> to all outdoor temperatures, 
                      simulating a severe winter pattern. Your estimated costs will be <strong>30-40% higher</strong> 
                      than typical years. This helps you prepare for worst-case scenarios.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {forecastModel === "current" && dailyForecast && dailyForecast.some(d => d.source === "forecast") && (
              <div className="mt-3 p-2 glass-card border-blue-500/30 bg-blue-900/10 text-xs text-high-contrast">
                <p>✓ Using live 10-day forecast + historical averages for remaining days</p>
              </div>
            )}
          </div>
        )}

        {/* Thermostat Model Selector */}
        {energyMode === "heating" && (
          <div className="glass-card p-glass mb-6 animate-fade-in-up border-blue-500/30">
            <label className="block text-sm font-semibold text-high-contrast mb-3">
              <Thermometer className="inline mr-2 text-blue-500" size={18} />
              Thermostat schedule used in this estimate
            </label>
            <select
              value={thermostatModel}
              onChange={(e) => {
                const model = e.target.value;
                setThermostatModel(model);
                if (model === "flat70") {
                  setIndoorTemp(70);
                  setNighttimeTemp(70);
                } else if (model === "flat68") {
                  setIndoorTemp(68);
                  setNighttimeTemp(68);
                } else if (model === "current") {
                  // Reset to current settings from thermostatSettings
                  try {
                    const thermostatSettings = loadThermostatSettings();
                    const homeEntry = thermostatSettings?.schedule?.weekly?.[0]?.find(
                      (e) => e.comfortSetting === "home"
                    );
                    const sleepEntry = thermostatSettings?.schedule?.weekly?.[0]?.find(
                      (e) => e.comfortSetting === "sleep"
                    );
                    if (homeEntry?.heatSetPoint !== undefined) setIndoorTemp(homeEntry.heatSetPoint);
                    if (sleepEntry?.heatSetPoint !== undefined) setNighttimeTemp(sleepEntry.heatSetPoint);
                  } catch {
                    // Keep current values
                  }
                }
              }}
              className={selectClasses}
            >
              <option value="current">My current settings</option>
              <option value="flat70">Flat 70°F all day</option>
              <option value="flat68">Flat 68°F all day</option>
              <option value="custom">Custom schedule (edit below)</option>
            </select>
          </div>
        )}
      </div>

      {/* Main Result Card - Moved above thermostat settings for prominence */}
      {mode === "budget" && monthlyEstimate && (
        <div
          className={`glass-card-gradient glass-card p-glass-lg mb-8 animate-fade-in-up ${
            energyMode === "cooling"
              ? "border-cyan-500/30"
              : "border-green-500/30"
          }`}
        >
          <div className="text-center">
            <p
              className={`text-sm font-semibold mb-2 ${
                energyMode === "cooling"
                  ? "text-cyan-500"
                  : "text-green-500"
              }`}
            >
              ESTIMATED MONTHLY{" "}
              {energyMode === "cooling" ? "COOLING" : "HEATING"} COST
            </p>
            <div
              className={`text-6xl md:text-7xl font-black mb-4 text-high-contrast`}
            >
              ${monthlyEstimate.cost.toFixed(2)}
            </div>
            {forecastModel === "polarVortex" && dailyForecast && dailyForecast.length > 0 && (
              <div className="mt-4 p-4 glass-card border-red-500/30 bg-red-900/10 rounded-lg">
                <p className="text-sm font-semibold text-red-500 mb-2">⚠️ Polar Vortex Scenario</p>
                <p className="text-xs text-high-contrast">
                  This estimate is <strong>30-40% higher</strong> than a typical year due to the -5°F temperature anomaly. 
                  This helps you prepare for worst-case winter conditions.
                </p>
              </div>
            )}
            {/* Expose method for testing */}
            <span
              data-testid="monthly-method"
              data-method={monthlyEstimate.method}
              className="sr-only"
            >
              {monthlyEstimate.method}
            </span>
            <p
              className={`text-lg mb-4 text-high-contrast`}
            >
              Typical{" "}
              {activeMonths.find((m) => m.value === selectedMonth)?.label} bill
              for <strong>{Math.round(effectiveIndoorTemp)}°F</strong> (weighted average: {indoorTemp}°F day, {nighttimeTemp}°F night)
              {monthlyEstimate.method === "gasFurnace" && (
                <span className="block text-sm mt-1">
                  (Gas Furnace at {Math.round(afue * 100)}% AFUE)
                </span>
              )}
              {monthlyEstimate.method === "cooling" && (
                <span className="block text-sm mt-1">
                  (Cooling: {monthlyEstimate.seer2} SEER2,{" "}
                  {monthlyEstimate.tons} tons)
                </span>
              )}
            </p>
            <div className="grid grid-cols-2 gap-4 text-center text-sm">
              <div className="glass-card p-glass-sm">
                <p className="font-semibold text-high-contrast">
                  {monthlyEstimate.method === "gasFurnace"
                    ? `${monthlyEstimate.therms?.toFixed(1) ?? "0.0"} therms`
                    : formatEnergyFromKwh(monthlyEstimate.energy ?? 0, unitSystem, { decimals: 0 })}
                </p>
                <p className="text-xs text-muted">
                  Typical Monthly Energy
                </p>
              </div>
              <div className="glass-card p-glass-sm">
                <p className="font-semibold text-high-contrast">
                  ${(monthlyEstimate.cost / monthlyEstimate.days).toFixed(2)}
                </p>
                <p className="text-xs text-muted">
                  Average Daily Cost
                </p>
              </div>
            </div>
            
            {/* Bill Breakdown Strip */}
            <div className="mt-6 pt-6 border-t border-gray-200/50 dark:border-gray-700/50">
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted">Heating:</span>
                  <span className="font-semibold text-high-contrast">
                    {energyMode === "heating" 
                      ? `$${monthlyEstimate.cost.toFixed(2)}`
                      : "$0.00"}
                  </span>
                </div>
                <span className="text-muted">•</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted">Cooling:</span>
                  <span className="font-semibold text-high-contrast">
                    {energyMode === "cooling" 
                      ? `$${monthlyEstimate.cost.toFixed(2)}`
                      : "$0.00"}
                  </span>
                </div>
                <span className="text-muted">•</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted">Fan/other:</span>
                  <span className="font-semibold text-high-contrast">$0.00</span>
                </div>
              </div>
              <p className="text-xs text-muted text-center mt-3">
                Assumes: {indoorTemp}°F day / {nighttimeTemp}°F night, 30-year typical weather.
              </p>
            </div>
            
            {/* Cost Insight Block - Explains the "why" behind the cost */}
            {(() => {
              // Generate contextual insight about the cost
              const monthName = activeMonths.find((m) => m.value === selectedMonth)?.label || "this month";
              const stateName = locationData?.state || "";
              const cityName = locationData?.city || "";
              
              // Get HDD/CDD for context
              const monthlyHDD = energyMode === "heating" ? getTypicalHDD(selectedMonth) : 0;
              const monthlyCDD = energyMode === "cooling" ? getTypicalCDD(selectedMonth) : 0;
              
              // Calculate savings from nighttime setback (compared to constant 70°F for heating, 75°F for cooling)
              let savingsPercent = 0;
              let savingsExplanation = "";
              
              if (energyMode === "heating") {
                // Compare weighted average temp to constant 70°F
                const constantTemp = 70;
                const weightedAvg = effectiveIndoorTemp;
                const tempDiff = constantTemp - weightedAvg;
                
                // Rough estimate: each degree lower saves ~3-5% in heating costs
                // More accurate: proportional to temperature difference
                if (tempDiff > 0) {
                  // Savings roughly proportional to (tempDiff / constantTemp) * 0.8 (accounting for base load)
                  savingsPercent = Math.round((tempDiff / constantTemp) * 0.8 * 100);
                  savingsExplanation = `Your nighttime setback to ${nighttimeTemp}°F saves approximately ${savingsPercent}% compared to holding a constant 70°F.`;
                } else if (tempDiff < 0) {
                  savingsExplanation = `Your higher setpoint increases costs by approximately ${Math.round(Math.abs(tempDiff) / constantTemp * 0.8 * 100)}% compared to 70°F.`;
                } else {
                  savingsExplanation = "Your constant temperature setting provides steady comfort.";
                }
              } else {
                // Cooling: compare to constant 75°F baseline
                const constantTemp = 75;
                const weightedAvg = effectiveIndoorTemp;
                const tempDiff = weightedAvg - constantTemp;
                
                if (tempDiff > 0) {
                  // Higher temp = savings
                  savingsPercent = Math.round((tempDiff / constantTemp) * 0.7 * 100);
                  savingsExplanation = `Your higher setpoint saves approximately ${savingsPercent}% compared to a constant 75°F.`;
                } else if (tempDiff < 0) {
                  savingsExplanation = `Your lower setpoint increases costs by approximately ${Math.round(Math.abs(tempDiff) / constantTemp * 0.7 * 100)}% compared to 75°F.`;
                } else {
                  savingsExplanation = "Your constant temperature setting provides steady comfort.";
                }
              }
              
              // Determine seasonal context
              let seasonalContext = "";
              if (energyMode === "heating") {
                if ([12, 1, 2].includes(selectedMonth)) {
                  seasonalContext = "historically a high-heating month";
                } else if ([10, 11].includes(selectedMonth)) {
                  seasonalContext = "a moderate-heating month";
                } else if ([3, 4].includes(selectedMonth)) {
                  seasonalContext = "a low-heating transition month";
                } else {
                  seasonalContext = "typically a low-heating month";
                }
              } else {
                if ([6, 7, 8].includes(selectedMonth)) {
                  seasonalContext = "historically a high-cooling month";
                } else if ([5, 9].includes(selectedMonth)) {
                  seasonalContext = "a moderate-cooling month";
                } else {
                  seasonalContext = "typically a low-cooling month";
                }
              }
              
              // Determine cost drivers
              let costDrivers = "";
              if (energyMode === "heating") {
                if (monthlyHDD > 1000) {
                  costDrivers = "Your bills are driven mostly by cold outdoor temperatures and extended heat pump runtime.";
                } else if (monthlyHDD > 500) {
                  costDrivers = "Your bills are driven by moderate heating demand and heat pump runtime.";
                } else {
                  costDrivers = "Your bills are relatively low due to mild weather, with minimal heating needed.";
                }
              } else {
                if (monthlyCDD > 300) {
                  costDrivers = "Your bills are driven mostly by hot outdoor temperatures and extended cooling runtime.";
                } else if (monthlyCDD > 150) {
                  costDrivers = "Your bills are driven by moderate cooling demand and AC runtime.";
                } else {
                  costDrivers = "Your bills are relatively low due to mild weather, with minimal cooling needed.";
                }
              }
              
              // Build the insight message
              const locationContext = cityName && stateName ? `in ${cityName}, ${stateName}` : stateName ? `in ${stateName}` : "";
              const insightMessage = locationContext 
                ? `${monthName} is ${seasonalContext} ${locationContext}. ${costDrivers} ${savingsExplanation}`
                : `${monthName} is ${seasonalContext}. ${costDrivers} ${savingsExplanation}`;
              
              return (
                <div className="mt-6 glass-card p-glass border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <Calculator className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-high-contrast mb-1">
                        💡 Why this cost?
                      </p>
                      <p className="text-xs text-muted leading-relaxed">
                        {insightMessage}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
            
            {/* CO2 Footprint */}
            <div className="mt-4 glass-card p-glass-sm text-center">
              <p className="text-xs text-muted mb-1">
                Estimated CO2 Footprint
              </p>
              <p className="font-semibold text-high-contrast">
                {(() => {
                  const co2Lbs =
                    monthlyEstimate.method === "gasFurnace"
                      ? calculateGasCO2(monthlyEstimate.therms ?? 0).lbs
                      : calculateElectricityCO2(
                          monthlyEstimate.energy ?? 0,
                          locationData?.state
                        ).lbs;
                  const equivalent = getBestEquivalent(co2Lbs);
                  let co2Display = "N/A";
                  if (Number.isFinite(co2Lbs)) {
                    co2Display = co2Lbs >= 1 ? formatCO2(co2Lbs) : "< 1 lb";
                  }
                  return (
                    <>
                      {co2Display}
                      {co2Lbs > 10 && (
                        <span className="block text-[11px] text-muted mt-1 font-normal">
                          ≈ {equivalent.text}
                        </span>
                      )}
                    </>
                  );
                })()}
              </p>
            </div>
            {monthlyEstimate.excludedAuxEnergy > 0 && (
              <div className="mt-4 glass-card p-glass-sm border-yellow-500/30 text-sm text-high-contrast">
                <p>
                  <strong>Note:</strong> This estimate <em>excludes</em>{" "}
                  electric auxiliary heat (
                  {formatEnergyFromKwh(monthlyEstimate.excludedAuxEnergy, unitSystem, { decimals: 0 })}) because
                  you have turned off 'Count electric auxiliary heat'.
                </p>
              </div>
            )}
            {typeof monthlyEstimate.energy === "number" &&
              monthlyEstimate.energy < 300 &&
              [1, 2, 12].includes(selectedMonth) &&
              energyMode === "heating" && (
                <div className="mt-6 glass-card p-glass border-yellow-500/30 text-sm text-high-contrast">
                  <p>
                    <strong>Heads up:</strong> This looks unusually low for a{" "}
                    {activeMonths.find((m) => m.value === selectedMonth)?.label}{" "}
                    heating month. Double‑check your home inputs and electricity
                    rate.
                  </p>
                </div>
              )}
            {typeof monthlyEstimate.unmetHours === "number" &&
              monthlyEstimate.unmetHours > 0 &&
              energyMode === "cooling" && (
                <div className="mt-6 glass-card p-glass border-orange-500/30 text-sm text-high-contrast">
                  <p>
                    <strong>Notice:</strong> Estimated{" "}
                    {monthlyEstimate.unmetHours} unmet hours this month. Your
                    system may struggle to maintain {Math.round(effectiveIndoorTemp)}°F.
                  </p>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Thermostat Settings Panel - Compact by default, moved closer to monthly estimate */}
      {mode === "budget" && (
        <div className="glass-card-gradient glass-card p-glass-lg mb-8 animate-fade-in-up">
          <div className="text-center mb-4">
            <h2 className="heading-secondary mb-2">
              Want to lower this number?
            </h2>
            <p className="text-muted text-sm">
              Change your thermostat, change your bill
            </p>
          </div>

          {/* Compact Thermostat Summary - Always visible */}
          {energyMode === "heating" && (
            <div className="glass-card p-glass mb-4 border-blue-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-high-contrast">
                  <Thermometer className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-semibold">
                      Daytime: <span className="text-blue-500">{indoorTemp}°F</span> · Nighttime: <span className="text-blue-500">{nighttimeTemp}°F</span>
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {daytimeTime} - {nighttimeTime}
                    </p>
                    {potentialSavings && potentialSavings.dollars > 0.5 && (
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1.5">
                        Switching to our recommended schedule would make this month about <strong>${potentialSavings.dollars.toFixed(2)}</strong> cheaper.
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowThermostatSchedule(!showThermostatSchedule)}
                  className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold hover:from-blue-500 hover:to-indigo-500 transition-all text-sm flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105 ring-2 ring-blue-400/50"
                >
                  {showThermostatSchedule ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Hide Schedule
                    </>
                  ) : (
                    <>
                      <Settings className="w-4 h-4" />
                      Edit schedule & update cost
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Expanded Thermostat Schedule Card - Collapsible */}
          {energyMode === "heating" && showThermostatSchedule && (
            <div className="animate-fade-in">
              <ThermostatScheduleCard
                indoorTemp={indoorTemp}
                daytimeTime={daytimeTime}
                nighttimeTime={nighttimeTime}
                nighttimeTemp={nighttimeTemp}
                onDaytimeTimeChange={(time) => {
                  setDaytimeTime(time);
                  setThermostatModel("custom");
                }}
                onNighttimeTimeChange={(time) => {
                  setNighttimeTime(time);
                  setThermostatModel("custom");
                }}
                onNighttimeTempChange={(temp) => {
                  setNighttimeTemp(temp);
                  setThermostatModel("custom");
                }}
                onIndoorTempChange={(temp) => {
                  setIndoorTemp(temp);
                  setThermostatModel("custom");
                }}
                setUserSetting={setUserSetting}
              />
              
              {/* ASHRAE Standards Button */}
              <div className="mt-4 flex flex-col items-center gap-3">
                <button
                  onClick={() => {
                    // ASHRAE Standard 55 recommendations (50% RH):
                    // Winter heating: 68.5-74.5°F (use 70°F as middle) for day, 68°F for night
                    setIndoorTemp(70); // ASHRAE Standard 55: 70°F for winter (middle of 68.5-74.5°F range)
                    setNighttimeTemp(68); // ASHRAE Standard 55: 68°F for sleep/unoccupied in winter
                    setThermostatModel("custom");
                    if (setUserSetting) {
                      setUserSetting("winterThermostat", 70);
                    }
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
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  title="Learn more about ASHRAE standards"
                >
                  Learn more
                </a>
                <p className="text-xs text-center text-gray-500 dark:text-gray-400 max-w-2xl">
                  ASHRAE Standard 55 provides thermal comfort recommendations: 70°F day / 68°F night (winter) for occupied spaces at 50% relative humidity.
                </p>
              </div>
            </div>
          )}
          
          {/* Cooling mode - Compact summary */}
          {energyMode === "cooling" && (
            <div className="glass-card p-glass mb-4 border-cyan-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-high-contrast">
                  <Thermometer className="w-5 h-5 text-cyan-500" />
                  <div>
                    <p className="text-sm font-semibold">
                      Daytime: <span className="text-cyan-500">{summerThermostat || 75}°F</span> · Nighttime: <span className="text-cyan-500">{summerThermostatNight || 72}°F</span>
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      Cooling schedule
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Cooling mode - show summer ASHRAE button */}
          {energyMode === "cooling" && (
            <div className="mt-4 flex flex-col items-center gap-3">
              <button
                onClick={() => {
                  // ASHRAE Standard 55 recommendations (50% RH):
                  // Summer cooling: 73-79°F (use 76°F as middle) for day, 78°F for night
                  if (setUserSetting) {
                    setUserSetting("summerThermostat", 76); // ASHRAE Standard 55: 76°F for summer (middle of 73-79°F range)
                    setUserSetting("summerThermostatNight", 78); // ASHRAE Standard 55: 78°F for sleep/unoccupied in summer
                  }
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
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                title="Learn more about ASHRAE standards"
              >
                Learn more
              </a>
              <p className="text-xs text-center text-gray-500 dark:text-gray-400 max-w-2xl">
                ASHRAE Standard 55 provides thermal comfort recommendations: 76°F day / 78°F night (summer) for occupied spaces at 50% relative humidity.
              </p>
            </div>
          )}

          {/* Aux Heat Toggle - Show for heat pumps */}
          {primarySystem === "heatPump" && energyMode === "heating" && (
            <div className="glass-card p-glass border-amber-500/30">
              <h3 className="heading-tertiary mb-4 flex items-center gap-2">
                <Thermometer size={18} className="text-amber-500" />
                Auxiliary Heat Settings
              </h3>
              <div className="space-y-3">
                <label className="inline-flex items-center gap-2 text-sm text-high-contrast">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={!!useElectricAuxHeat}
                    onChange={(e) =>
                      setUseElectricAuxHeat(!!e.target.checked)
                    }
                    aria-label="Include electric auxiliary resistance heat in monthly energy and cost estimates"
                    title="When enabled, electric auxiliary resistance backup heat will be counted toward monthly electricity and cost estimates"
                  />
                  <span className="font-medium">
                    Count electric auxiliary heat in estimates
                  </span>
                </label>
                {!useElectricAuxHeat && (
                  <div className="mt-3 p-3 glass-card border-amber-500/30 text-xs">
                    <p className="text-high-contrast">
                      <strong>⚠️ Aux heat disabled:</strong> Minimum
                      achievable indoor temp is approximately{" "}
                      <strong>
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
                          const ceilingMultiplier =
                            1 + (ceilingHeight - 8) * 0.1;
                          const designHeatLoss =
                            squareFeet *
                            22.67 *
                            insulationLevel *
                            homeShape *
                            ceilingMultiplier;
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
                      at design conditions (5°F outdoor). Below this, the heat
                      pump cannot maintain your setpoint without supplemental
                      heat.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Daily Forecast Breakdown */}
      {mode === "budget" && adjustedForecast && adjustedForecast.length > 0 && monthlyEstimate && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8 border border-gray-200 dark:border-gray-700">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                Daily Forecast Breakdown
              </h3>
              <a
                href="https://www.weather.gov/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <Cloud size={16} />
                NWS Forecast
              </a>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {activeMonths.find((m) => m.value === selectedMonth)?.label} {new Date().getFullYear()} - 
              First 15 days use forecast data, remaining days use historical averages
            </p>
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
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
                . The first 15 days use real-time forecast data, while days 16-31 use 10-year historical averages from the Open-Meteo archive API.
              </p>
            </div>
          </div>
          
          {forecastLoading && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Loading daily forecast...
            </div>
          )}
          
          {forecastError && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4 text-sm text-red-800 dark:text-red-200 mb-4">
              <p><strong>Error loading forecast:</strong> {forecastError}</p>
            </div>
          )}
          
          {!forecastLoading && !forecastError && (() => {
            // Calculate daily metrics
            const tonsMap = {
              18: 1.5, 24: 2.0, 30: 2.5, 36: 3.0, 42: 3.5, 48: 4.0, 60: 5.0,
            };
            const tons = tonsMap[capacity] || 3.0;
            const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
            const estimatedDesignHeatLoss = squareFeet * 22.67 * insulationLevel * homeShape * ceilingMultiplier;
            const btuLossPerDegF = estimatedDesignHeatLoss / 70;
            const compressorPower = tons * 1.0 * (15 / efficiency);
            
            const dailyMetrics = adjustedForecast.map((day) => {
              const tempDiff = energyMode === "heating" 
                ? Math.max(0, effectiveIndoorTemp - day.avg)
                : Math.max(0, day.avg - effectiveIndoorTemp);
              
              let dailyEnergy = 0;
              let dailyCost = 0;
              let auxEnergy = 0;
              
              if (tempDiff > 0) {
                if (energyMode === "heating" && primarySystem === "heatPump") {
                  // Use hourly performance calculation for each hour of the day
                  // Simplified: use average temp and humidity for the day
                  const avgHumidity = day.humidity || 50;
                  
                  // Calculate for 24 hours
                  for (let hour = 0; hour < 24; hour++) {
                    const perf = heatUtils.computeHourlyPerformance(
                      {
                        tons,
                        indoorTemp: effectiveIndoorTemp,
                        heatLossBtu: estimatedDesignHeatLoss,
                        compressorPower,
                      },
                      day.avg,
                      avgHumidity
                    );
                    
                    const hourlyEnergy = perf.electricalKw * (perf.runtime / 100);
                    dailyEnergy += hourlyEnergy;
                    
                    if (useElectricAuxHeat && perf.auxKw) {
                      auxEnergy += perf.auxKw * (perf.runtime / 100);
                      dailyEnergy += perf.auxKw * (perf.runtime / 100);
                    }
                    
                    dailyCost += hourlyEnergy * utilityCost;
                    if (useElectricAuxHeat && perf.auxKw) {
                      dailyCost += perf.auxKw * (perf.runtime / 100) * utilityCost;
                    }
                  }
                } else if (energyMode === "heating" && primarySystem === "gasFurnace") {
                  const buildingHeatLossBtu = btuLossPerDegF * tempDiff;
                  const eff = Math.min(0.99, Math.max(0.6, afue));
                  const thermsPerDay = (buildingHeatLossBtu * 24) / (100000 * eff);
                  dailyCost = thermsPerDay * gasCost;
                  dailyEnergy = thermsPerDay * 29.3; // Convert therms to kWh for display
                } else if (energyMode === "cooling") {
                  const coolingCapacityKbtu = primarySystem === "heatPump" ? capacity : coolingCapacity;
                  const seer2 = efficiency;
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
                source: day.source,
              };
            });
            
            const totalForecastCost = dailyMetrics.reduce((sum, d) => sum + d.cost, 0);
            const totalForecastEnergy = dailyMetrics.reduce((sum, d) => sum + d.energy, 0);
            
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Day</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Temp Range</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Energy (kWh)</th>
                      {primarySystem === "heatPump" && energyMode === "heating" && useElectricAuxHeat && (
                        <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Aux (kWh)</th>
                      )}
                      <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Cost</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyMetrics.map((day, idx) => (
                      <tr 
                        key={idx} 
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <td className="py-2 px-3 text-gray-900 dark:text-gray-100">{day.day}</td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                          {day.low.toFixed(0)}° - {day.high.toFixed(0)}°F
                        </td>
                        <td className="py-2 px-3 text-right text-gray-900 dark:text-gray-100">
                          {day.energy.toFixed(1)}
                        </td>
                        {primarySystem === "heatPump" && energyMode === "heating" && useElectricAuxHeat && (
                          <td className="py-2 px-3 text-right text-orange-600 dark:text-orange-400">
                            {day.auxEnergy > 0 ? day.auxEnergy.toFixed(1) : '0.0'}
                          </td>
                        )}
                        <td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                          ${day.cost.toFixed(2)}
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
                    ))}
                    <tr className="border-t-2 border-gray-300 dark:border-gray-600 font-bold bg-gray-50 dark:bg-gray-900/50">
                      <td colSpan={primarySystem === "heatPump" && energyMode === "heating" && useElectricAuxHeat ? 3 : 2} className="py-3 px-3 text-gray-900 dark:text-gray-100">
                        Monthly Total
                      </td>
                      <td className="py-3 px-3 text-right text-gray-900 dark:text-gray-100">
                        {totalForecastEnergy.toFixed(1)} kWh
                      </td>
                      {primarySystem === "heatPump" && energyMode === "heating" && useElectricAuxHeat && (
                        <td className="py-3 px-3"></td>
                      )}
                      <td className="py-3 px-3 text-right text-gray-900 dark:text-gray-100">
                        ${totalForecastCost.toFixed(2)}
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

      {/* Annual Budget Planner */}
      {mode === "budget" && locationData && (
        <div className="mt-12 pt-8 border-t-2 border-gray-300/30 dark:border-gray-700/30">
          <div className="glass-card p-glass mb-8 animate-fade-in-up border-indigo-500/30">
            {/* Collapsible Header */}
            <button
              onClick={() => setShowAnnualPlanner(!showAnnualPlanner)}
              className="w-full flex items-center justify-between p-6 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 rounded-lg transition-colors"
            >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-500" />
                <h2 className="text-xl font-bold text-high-contrast">
                  Annual Budget Planner
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
              <div className="px-6 pb-6 space-y-6 animate-fade-in border-t border-indigo-200/50 dark:border-indigo-800/50 pt-6">
              
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
                  
                  const totalTypicalHDD = monthlyHDDDist.reduce((a, b) => a + b, 0); // ~4880
                  const totalTypicalCDD = monthlyCDDDist.reduce((a, b) => a + b, 0); // ~1730
                  
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
                        annualHeatingCost += monthHeatingEstimate.cost * winterTempMultiplier;
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
                        annualCoolingCost += monthCoolingEstimate.cost * summerTempMultiplier;
                      }
                    }
                  }
                  
                  const totalAnnualCost = annualHeatingCost + annualCoolingCost;
                    return totalAnnualCost > 0 ? Math.max(0, totalAnnualCost).toFixed(2) : "—";
                  })()}
                  </div>
                  {(() => {
                // Calculate annual costs using ALL 12 months for accuracy
                const annualHDD = getAnnualHDD(locationData.city, locationData.state);
                const annualCDD = getAnnualCDD(locationData.city, locationData.state);
                
                // Get typical monthly HDD/CDD distribution (these sum to typical annual values)
                const monthlyHDDDist = [1200, 1000, 600, 200, 50, 10, 0, 0, 20, 200, 500, 1100]; // Jan-Dec
                const monthlyCDDDist = [0, 0, 10, 60, 150, 300, 450, 400, 250, 100, 10, 0]; // Jan-Dec
                
                const totalTypicalHDD = monthlyHDDDist.reduce((a, b) => a + b, 0); // ~4880
                const totalTypicalCDD = monthlyCDDDist.reduce((a, b) => a + b, 0); // ~1730
                
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
                let januaryHeatingCost = 0;
                let julyCoolingCost = 0;
                
                for (let month = 0; month < 12; month++) {
                  // Scale monthly HDD/CDD to location's annual totals
                  const monthHDD = totalTypicalHDD > 0 ? (monthlyHDDDist[month] / totalTypicalHDD) * annualHDD : 0;
                  const monthCDD = totalTypicalCDD > 0 ? (monthlyCDDDist[month] / totalTypicalCDD) * annualCDD : 0;
                  
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
                      const adjustedCost = monthHeatingEstimate.cost * winterTempMultiplier;
                      annualHeatingCost += adjustedCost;
                      
                      // Track January for display
                      if (month === 0) {
                        januaryHeatingCost = adjustedCost;
                      }
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
                      const adjustedCost = monthCoolingEstimate.cost * summerTempMultiplier;
                      annualCoolingCost += adjustedCost;
                      
                      // Track July for display
                      if (month === 6) {
                        julyCoolingCost = adjustedCost;
                      }
                    }
                  }
                }
                
                if (annualHeatingCost > 0 || annualCoolingCost > 0) {
                  const totalAnnualCost = annualHeatingCost + annualCoolingCost;
                  // Calculate what percentage of annual cost January and July represent
                  const januaryCostPercent = annualHeatingCost > 0 ? (januaryHeatingCost / annualHeatingCost) * 100 : 0;
                  const julyCostPercent = annualCoolingCost > 0 ? (julyCoolingCost / annualCoolingCost) * 100 : 0;
                  // Get HDD/CDD for January/July for reference
                  const januaryHDD = totalTypicalHDD > 0 ? (monthlyHDDDist[0] / totalTypicalHDD) * annualHDD : 0;
                  const julyCDD = totalTypicalCDD > 0 ? (monthlyCDDDist[6] / totalTypicalCDD) * annualCDD : 0;
                  
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
                          <p className="font-semibold text-blue-700 dark:text-blue-300">
                            Annual Heating
                          </p>
                          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            ${annualHeatingCost.toFixed(2)}
                          </p>
                          {januaryHeatingCost > 0 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Jan: ${januaryHeatingCost.toFixed(2)} ({Math.round(januaryHDD)} HDD, {januaryCostPercent.toFixed(1)}% of heating cost)
                            </p>
                          )}
                        </div>
                        <div className="bg-cyan-50 dark:bg-cyan-900/30 rounded-lg p-3">
                          <p className="font-semibold text-cyan-700 dark:text-cyan-300">
                            Annual Cooling
                          </p>
                          <p className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
                            ${annualCoolingCost.toFixed(2)}
                          </p>
                          {julyCoolingCost > 0 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Jul: ${julyCoolingCost.toFixed(2)} ({Math.round(julyCDD)} CDD, {julyCostPercent.toFixed(1)}% of cooling cost)
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-3 mb-4">
                        <p className="font-semibold text-indigo-700 dark:text-indigo-300 mb-1">
                          Total Annual HVAC Cost
                        </p>
                        <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                          ${totalAnnualCost.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          (Heating ≈ ${Math.round(annualHeatingCost)} • Cooling ≈ ${Math.round(annualCoolingCost)})
                        </p>
                        <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-3 font-medium">
                          This works out to about <strong>${(annualHeatingCost / 12).toFixed(2)}/month</strong> in heating and <strong>${(annualCoolingCost / 12).toFixed(2)}/month</strong> in cooling on average.
                        </p>
                      </div>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-semibold">
                        Heating: Sum of all 12 months = ${annualHeatingCost.toFixed(2)} (scaled to {Math.round(annualHDD)} annual HDD)
                      </p>
                      <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-2 font-semibold">
                        Cooling: Sum of all 12 months = ${annualCoolingCost.toFixed(2)} (scaled to {Math.round(annualCDD)} annual CDD)
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 italic">
                        * Calculated by summing costs for all 12 months, with monthly HDD/CDD scaled to your location's annual totals. Accounts for seasonal variation and your thermostat settings.
                      </p>
                    </>
                  );
                }
                
                return (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                    Enter a location above to see annual estimate
                  </p>
                );
              })()}
              </div>
            </div>
            </div>
          )}
          </div>
        </div>
      )}

      {/* Thermostat Settings for City Comparison */}
      {mode === "comparison" && locationData && locationDataB && (
        <div className="glass-card-gradient glass-card p-glass-lg mb-8 animate-fade-in-up">
          <div className="text-center mb-6">
            <h2 className="heading-secondary mb-2">
              🌡️ Thermostat Settings
            </h2>
            <p className="text-muted">
              Set your preferred temperature schedules for comparison
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-glass">
            {/* Winter Settings */}
            <div className="glass-card p-glass border-blue-500/30">
              <h3 className="heading-tertiary mb-4 flex items-center gap-2">
                <Thermometer size={18} className="text-blue-500" />
                Winter Heating (Dec-Feb)
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-high-contrast mb-2">
                    Daytime Setting (6am-10pm)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="60"
                      max="78"
                      value={userSettings?.winterThermostatDay ?? 70}
                      onChange={(e) =>
                        setUserSetting?.(
                          "winterThermostatDay",
                          Number(e.target.value)
                        )
                      }
                      className="flex-grow"
                    />
                    <span className="font-bold text-xl text-blue-500 w-14 text-right">
                      {userSettings?.winterThermostatDay ?? 70}°F
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-high-contrast mb-2">
                    Nighttime Setting (10pm-6am)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="60"
                      max="78"
                      value={userSettings?.winterThermostatNight ?? 65}
                      onChange={(e) =>
                        setUserSetting?.(
                          "winterThermostatNight",
                          Number(e.target.value)
                        )
                      }
                      className="flex-grow"
                    />
                    <span className="font-bold text-xl text-blue-500 w-14 text-right">
                      {userSettings?.winterThermostatNight ?? 65}°F
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Summer Settings */}
            <div className="glass-card p-glass border-cyan-500/30">
              <h3 className="heading-tertiary mb-4 flex items-center gap-2">
                <Thermometer size={18} className="text-cyan-500" />
                Summer Cooling (Jun-Aug)
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-high-contrast mb-2">
                    Daytime Setting (6am-10pm)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="68"
                      max="80"
                      value={userSettings?.summerThermostat ?? 74}
                      onChange={(e) =>
                        setUserSetting?.(
                          "summerThermostat",
                          Number(e.target.value)
                        )
                      }
                      className="flex-grow"
                    />
                    <span className="font-bold text-xl text-cyan-500 w-14 text-right">
                      {userSettings?.summerThermostat ?? 74}°F
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-high-contrast mb-2">
                    Nighttime Setting (10pm-6am)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="68"
                      max="82"
                      value={
                        userSettings?.summerThermostatNight ??
                        userSettings?.summerThermostat ??
                        76
                      }
                      onChange={(e) =>
                        setUserSetting?.(
                          "summerThermostatNight",
                          Number(e.target.value)
                        )
                      }
                      className="flex-grow"
                    />
                    <span className="font-bold text-xl text-cyan-500 w-14 text-right">
                      {userSettings?.summerThermostatNight ??
                        userSettings?.summerThermostat ??
                        76}
                      °F
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Annual Budget Comparison */}
      {mode === "comparison" && locationData && locationDataB && (
        <div className="glass-card-gradient glass-card p-glass-lg mb-8 animate-fade-in-up">
          <div className="text-center mb-6">
            <h2 className="heading-secondary mb-2">
              📅 Annual Budget Comparison
            </h2>
            <p className="text-muted">
              Estimated yearly HVAC costs for both locations
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-glass">
            {/* Location A Annual */}
            <div className="glass-card p-glass border-blue-500/30">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <MapPin
                    size={16}
                    className="text-blue-500"
                  />
                  <h3 className="font-semibold text-high-contrast">
                    {locationData.city}, {locationData.state}
                  </h3>
                </div>
                <div className="text-4xl font-black text-high-contrast mb-2">
                  $
                  {(() => {
                    // Calculate annual cost by summing all 12 months
                    // Use location-specific annual HDD/CDD and distribute across months
                    const annualHDD = getAnnualHDD(locationData.city, locationData.state);
                    const annualCDD = getAnnualCDD(locationData.city, locationData.state);
                    
                    // Get monthly HDD/CDD distribution (typical pattern, scaled to location's annual totals)
                    // Typical distribution percentages from TYPICAL_HDD and TYPICAL_CDD
                    const monthlyHDDDist = [1200, 1000, 600, 200, 50, 10, 0, 0, 20, 200, 500, 1100]; // Jan-Dec
                    const monthlyCDDDist = [0, 0, 10, 60, 150, 300, 400, 350, 200, 80, 10, 0]; // Jan-Dec
                    
                    const totalTypicalHDD = monthlyHDDDist.reduce((a, b) => a + b, 0);
                    const totalTypicalCDD = monthlyCDDDist.reduce((a, b) => a + b, 0);
                    
                    let totalAnnualCost = 0;
                    
                    // Calculate cost for each month
                    for (let month = 0; month < 12; month++) {
                      const monthHDD = totalTypicalHDD > 0 ? (monthlyHDDDist[month] / totalTypicalHDD) * annualHDD : 0;
                      const monthCDD = totalTypicalCDD > 0 ? (monthlyCDDDist[month] / totalTypicalCDD) * annualCDD : 0;
                      
                      // Heating cost for this month
                      if (monthHDD > 0) {
                        const heatingEstimate = estimateMonthlyHeatingCostFromHDD({
                          hdd: monthHDD,
                          squareFeet,
                          insulationLevel,
                          homeShape,
                          ceilingHeight,
                          hspf: hspf2 || efficiency,
                          electricityRate: utilityCost,
                        });
                        totalAnnualCost += heatingEstimate?.cost || 0;
                      }
                      
                      // Cooling cost for this month
                      if (monthCDD > 0) {
                        const coolingEstimate = estimateMonthlyCoolingCostFromCDD({
                          cdd: monthCDD,
                          squareFeet,
                          insulationLevel,
                          homeShape,
                          ceilingHeight,
                          capacity: coolingCapacity || capacity,
                          seer2: efficiency,
                          electricityRate: utilityCost,
                          solarExposure,
                        });
                        totalAnnualCost += coolingEstimate?.cost || 0;
                      }
                    }
                    
                    return Math.max(0, totalAnnualCost).toFixed(2);
                  })()}
                </div>
                <p className="text-xs text-muted">
                  Estimated annual cost
                </p>
              </div>
            </div>

            {/* Location B Annual */}
            <div className="glass-card p-glass border-green-500/30">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <MapPin
                    size={16}
                    className="text-green-500"
                  />
                  <h3 className="font-semibold text-high-contrast">
                    {locationDataB.city}, {locationDataB.state}
                  </h3>
                </div>
                <div className="text-4xl font-black text-high-contrast mb-2">
                  $
                  {(() => {
                    // Calculate annual cost by summing all 12 months for Location B
                    // Use location-specific annual HDD/CDD and distribute across months
                    const annualHDD = getAnnualHDD(locationDataB.city, locationDataB.state);
                    const annualCDD = getAnnualCDD(locationDataB.city, locationDataB.state);
                    
                    // Get monthly HDD/CDD distribution (typical pattern, scaled to location's annual totals)
                    const monthlyHDDDist = [1200, 1000, 600, 200, 50, 10, 0, 0, 20, 200, 500, 1100]; // Jan-Dec
                    const monthlyCDDDist = [0, 0, 10, 60, 150, 300, 400, 350, 200, 80, 10, 0]; // Jan-Dec
                    
                    const totalTypicalHDD = monthlyHDDDist.reduce((a, b) => a + b, 0);
                    const totalTypicalCDD = monthlyCDDDist.reduce((a, b) => a + b, 0);
                    
                    let totalAnnualCost = 0;
                    
                    // Calculate cost for each month
                    for (let month = 0; month < 12; month++) {
                      const monthHDD = totalTypicalHDD > 0 ? (monthlyHDDDist[month] / totalTypicalHDD) * annualHDD : 0;
                      const monthCDD = totalTypicalCDD > 0 ? (monthlyCDDDist[month] / totalTypicalCDD) * annualCDD : 0;
                      
                      // Heating cost for this month
                      if (monthHDD > 0) {
                        const heatingEstimate = estimateMonthlyHeatingCostFromHDD({
                          hdd: monthHDD,
                          squareFeet,
                          insulationLevel,
                          homeShape,
                          ceilingHeight,
                          hspf: hspf2 || efficiency,
                          electricityRate: utilityCost,
                        });
                        totalAnnualCost += heatingEstimate?.cost || 0;
                      }
                      
                      // Cooling cost for this month
                      if (monthCDD > 0) {
                        const coolingEstimate = estimateMonthlyCoolingCostFromCDD({
                          cdd: monthCDD,
                          squareFeet,
                          insulationLevel,
                          homeShape,
                          ceilingHeight,
                          capacity: coolingCapacity || capacity,
                          seer2: efficiency,
                          electricityRate: utilityCost,
                          solarExposure,
                        });
                        totalAnnualCost += coolingEstimate?.cost || 0;
                      }
                    }
                    
                    return Math.max(0, totalAnnualCost).toFixed(2);
                  })()}
                </div>
                <p className="text-xs text-muted">
                  Estimated annual cost
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted mt-4 italic text-center">
            * Simplified estimates for budgeting purposes based on typical
            climate patterns
          </p>

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
              <div className="mt-6 glass-card p-glass border-green-500/30 bg-gradient-to-br from-green-900/10 to-emerald-900/10">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <span className="text-2xl">🌎</span>
                    <h3 className="text-lg font-bold text-high-contrast">Climate Flex</h3>
                  </div>
                  <p className="text-sm text-gray-300 mb-4 leading-relaxed">
                    Your heat pump works way less hard in your climate.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div className="bg-[#0c1218] border border-[#1c2733] rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">{locationData.city} winter load</div>
                      <div className="text-blue-400 font-bold">{annualHDDA.toLocaleString()} HDD</div>
                    </div>
                    <div className="bg-[#0c1218] border border-[#1c2733] rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">{locationDataB.city} winter load</div>
                      <div className="text-orange-400 font-bold">{annualHDDB.toLocaleString()} HDD</div>
                      <div className="text-xs text-gray-500 mt-1">~{heatLoadRatio}× more</div>
                    </div>
                  </div>
                  
                  <div className="bg-[#0f2b1c] border border-[#234435] rounded-lg p-4 mb-4">
                    <div className="text-green-400 font-bold text-lg mb-1">
                      ${Math.abs(savings).toFixed(2)} saved per year
                    </div>
                    <div className="text-xs text-gray-400">
                      Simply by living where air doesn't hurt your face
                    </div>
                  </div>
                  
                  <p className="text-xs text-gray-400 italic leading-relaxed">
                    Physics says: living here saves you money before you even touch your thermostat.
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
          <div className="glass-card-gradient glass-card p-glass-lg mb-8 animate-fade-in-up">
            <div className="text-center mb-6">
              <p className="text-sm font-semibold text-high-contrast mb-2">
                CITY COMPARISON:{" "}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-glass mb-6">
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
                    ).toFixed(2)} MORE per month`
                  : `💰 Moving to ${locationDataB.city} would SAVE $${(
                      monthlyEstimate.cost - monthlyEstimateB.cost
                    ).toFixed(2)} per month`}
              </p>
              <p
                className={`text-sm mt-2 font-semibold ${
                  monthlyEstimateB.cost > monthlyEstimate.cost
                    ? "text-red-600 dark:text-red-400"
                    : "text-green-600 dark:text-green-400"
                }`}
              >
                {(() => {
                  const monthlyDiff = Math.abs(
                    monthlyEstimate.cost - monthlyEstimateB.cost
                  );
                  const annualDiff = monthlyDiff * 12;
                  return monthlyEstimateB.cost > monthlyEstimate.cost
                    ? `That's $${annualDiff.toFixed(2)} more per year`
                    : `That's $${annualDiff.toFixed(2)} in annual savings`;
                })()}
              </p>
              <p className="text-xs mt-2 text-gray-700 dark:text-gray-300">
                {monthlyEstimateB.cost > monthlyEstimate.cost
                  ? `That's ${(
                      ((monthlyEstimateB.cost - monthlyEstimate.cost) /
                        monthlyEstimate.cost) *
                      100
                    ).toFixed(0)}% higher`
                  : `That's ${(
                      ((monthlyEstimate.cost - monthlyEstimateB.cost) /
                        monthlyEstimate.cost) *
                      100
                    ).toFixed(0)}% lower`}
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
          </div>
        )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
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

      {/* Disclaimer */}
      <div className="glass-card p-glass mb-8 border-orange-500/30 animate-fade-in-up">
        <p className="text-sm text-high-contrast leading-relaxed">
          <strong className="text-orange-500">
            ⚠️ Disclaimer:
          </strong>{" "}
          This estimate is for budgeting purposes only, based on 30-year
          historical climate averages for your location. Your actual bill will
          vary based on real-time weather, which may be significantly colder or
          warmer than average. Historical averages should not be interpreted as
          a guarantee of specific billing amounts.
        </p>
      </div>

      {/* Info Box */}
      <div className="glass-card p-glass animate-fade-in-up">
        <h3 className="heading-tertiary mb-3">
          How This Works
        </h3>
        <ul className="text-sm text-high-contrast space-y-2">
          <li>• We use 30 years of typical weather data for your location.</li>
          <li>• We simulate how your home responds to that weather.</li>
          <li>• We combine that with your thermostat schedule and your utility rates.</li>
          <li>• The result: a best-guess budget, not a guarantee.</li>
        </ul>
      </div>

      {/* Compare Upgrade Button */}
      <div className="flex justify-center mt-8">
        <Link
          to="/cost-comparison"
          className="btn-gradient inline-flex items-center gap-2"
        >
          Compare Upgrade →
        </Link>
      </div>

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
          <div className="px-6 pb-6 space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
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
                  {energyMode === "heating" && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                      (≈ {((squareFeet * 22.67 * insulationLevel * homeShape * (1 + (ceilingHeight - 8) * 0.1)) / 70).toFixed(0)} BTU/hr per °F for this home)
                    </div>
                  )}
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
              const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
              const exampleOutdoorTemp = energyMode === "heating" ? 35 : 85;
              const tempDiff = energyMode === "heating" 
                ? Math.max(0, effectiveIndoorTemp - exampleOutdoorTemp)
                : Math.max(0, exampleOutdoorTemp - effectiveIndoorTemp);
              
              if (energyMode === "heating") {
                const estimatedDesignHeatLoss = squareFeet * 22.67 * insulationLevel * homeShape * ceilingMultiplier;
                const btuLossPerDegF = estimatedDesignHeatLoss / 70;
                const buildingHeatLoss = btuLossPerDegF * tempDiff;
                const capFactor = Math.max(0.3, 1 - (Math.abs(0 - exampleOutdoorTemp) / 100) * 0.5);
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
                      <span>Estimated Annual Cost:</span>
                      <span className="font-bold text-green-600 dark:text-green-400">
                        {(() => {
                          if (energyMode === "heating" && locationData) {
                            // Use HDD-based scaling: Annual = (Monthly / Monthly HDD) * Annual HDD
                            const monthlyHDD = getTypicalHDD(selectedMonth);
                            const annualHDD = getAnnualHDD(locationData.city, locationData.state);
                            if (monthlyHDD > 0 && annualHDD > 0) {
                              const annualCost = (monthlyEstimate.cost / monthlyHDD) * annualHDD;
                              return `$${annualCost.toFixed(2)}`;
                            }
                          }
                          // Fallback: for cooling or if HDD data unavailable, show note
                          return "N/A (see below)";
                        })()}
                      </span>
                    </div>
                    {energyMode === "heating" && locationData && (() => {
                      const monthlyHDD = getTypicalHDD(selectedMonth);
                      const annualHDD = getAnnualHDD(locationData.city, locationData.state);
                      if (monthlyHDD > 0 && annualHDD > 0) {
                        const annualCost = (monthlyEstimate.cost / monthlyHDD) * annualHDD;
                        return (
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            = (${monthlyEstimate.cost.toFixed(2)} / {monthlyHDD} HDD) × {annualHDD} HDD
                            <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 italic">
                              * Scaled by degree days (not × 12 months)
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    {energyMode === "cooling" && (
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        See degree-day calculation below
                      </div>
                    )}
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
                // Annual = (Monthly Cost / Monthly HDD) × Annual HDD
                const annualCost = (monthlyEstimate.cost / monthlyHDD) * annualHDD;
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
                              <span>Selected Month ({activeMonths.find((m) => m.value === selectedMonth)?.label}):</span>
                              <span className="font-bold text-purple-600 dark:text-purple-400">${monthlyEstimate.cost.toFixed(2)}</span>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              From physics calculation above
                            </div>
                            <div className="flex justify-between pt-2">
                              <span>Monthly HDD ({activeMonths.find((m) => m.value === selectedMonth)?.label}):</span>
                              <span className="font-bold text-purple-600 dark:text-purple-400">{monthlyHDD} HDD</span>
                            </div>
                            <div className="flex justify-between pt-2">
                              <span>Annual HDD ({locationData.city}, {locationData.state}):</span>
                              <span className="font-bold text-purple-600 dark:text-purple-400">{annualHDD} HDD</span>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 pt-1">
                              {activeMonths.find((m) => m.value === selectedMonth)?.label} represents {(monthlyRatio * 100).toFixed(1)}% of annual heating load
                            </div>
                          </div>
                        </div>
                        
                        <div className="pt-2 border-t-2 border-purple-400 dark:border-purple-600">
                          <div className="flex justify-between">
                            <span className="font-bold text-lg">Simplified Annual Estimate:</span>
                            <span className="font-bold text-lg text-purple-600 dark:text-purple-400">${annualCost.toFixed(2)}</span>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            = (${monthlyEstimate.cost.toFixed(2)} / {monthlyHDD} HDD) × {annualHDD} HDD
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
