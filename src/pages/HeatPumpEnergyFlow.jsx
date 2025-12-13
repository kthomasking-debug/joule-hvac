import React, { useState, useMemo, useEffect, useRef } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  LineChart,
  Area,
  ComposedChart,
} from "recharts";
import {
  Zap,
  Thermometer,
  Home,
  Settings,
  AlertTriangle,
  ChevronRight,
  BarChart3,
  Flame,
  Calculator,
  ChevronDown,
  ChevronUp,
  Printer,
} from "lucide-react";
import { fullInputClasses, selectClasses } from "../lib/uiClasses";
import { DashboardLink } from "../components/DashboardLink";
import { getAnnualHDD } from "../lib/hddData";
import useForecast from "../hooks/useForecast";
import { useJouleBridgeContext } from "../contexts/JouleBridgeContext";
import { getCached } from "../utils/cachedStorage";

// A custom tooltip for a richer display on charts
const CustomTooltip = ({ active, payload, label, mode = "heatPump", afue }) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    // Helper function to safely format numbers
    const formatNumber = (value, options = { maximumFractionDigits: 0 }) => {
      if (value == null || !Number.isFinite(value)) return "N/A";
      return value.toLocaleString(undefined, options);
    };
    
    return (
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl dark:text-gray-100">
        <p className="font-bold text-gray-800 dark:text-gray-100 mb-2">
          At {label}°F Outdoor
        </p>
        {mode === "gasFurnace" ? (
          <p className="text-sm text-blue-600 font-semibold">
            Furnace Output:{" "}
            {formatNumber(d.thermalOutputBtu)}{" "}
            BTU/hr
          </p>
        ) : (
          <p className="text-sm text-blue-600 font-semibold">
            HP Output:{" "}
            {formatNumber(d.thermalOutputBtu)}{" "}
            BTU/hr
          </p>
        )}
        <p className="text-sm text-red-600 font-semibold">
          Building Heat Loss:{" "}
          {formatNumber(d.buildingHeatLossBtu)}{" "}
          BTU/hr
        </p>
        <hr className="my-2" />
        <p className="text-sm text-orange-600 font-semibold">
          Aux Heat Needed:{" "}
          {formatNumber(d.auxHeatBtu)}{" "}
          BTU/hr
        </p>
        {mode === "gasFurnace" ? (
          <>
            <hr className="my-2" />
            <p className="text-sm text-green-600 font-semibold">
              Efficiency (AFUE): {Math.round((afue ?? 0.95) * 100)}%
            </p>
          </>
        ) : (
          <>
            <hr className="my-2" />
            {d.electricalInputBtu != null && Number.isFinite(d.electricalInputBtu) && (
              <p className="text-sm text-green-600 font-semibold">
                Electrical Input: {formatNumber(d.electricalInputBtu)} BTU/hr
                {d.electricalKw != null && Number.isFinite(d.electricalKw) && (
                  <span className="text-xs text-gray-500 ml-1">
                    ({d.electricalKw.toFixed(2)} kW)
                  </span>
                )}
              </p>
            )}
            <p className="text-sm text-green-600 font-semibold">
              Efficiency (COP): {d.cop != null && Number.isFinite(d.cop) ? d.cop.toFixed(2) : "N/A"}
            </p>
          </>
        )}
      </div>
    );
  }
  return null;
};

// Data Sources Dropdown Component
const DataSourcesDropdown = ({ chartName, dataSources }) => {
  const [isOpen, setIsOpen] = useState(false);

  const renderDataSource = (key, source) => {
    if (!source || !source.source || source.source === "Not applicable" || source.source.includes("Not shown")) {
      return null;
    }

    return (
      <div key={key} className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0 last:pb-0 last:mb-0">
        <div className="font-semibold text-sm text-gray-800 dark:text-gray-200 mb-2">
          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
        </div>
        <div className="text-sm text-gray-700 dark:text-gray-300">
          <div className="mb-1">
            <span className="font-medium">Source: </span>
            <span className="text-blue-600 dark:text-blue-400">{source.source}</span>
          </div>
          {source.formula && (
            <div className="mb-1 mt-2">
              <span className="font-medium">Formula: </span>
              <code className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">{source.formula}</code>
            </div>
          )}
          {source.value && (
            <div className="mb-1 mt-2">
              <span className="font-medium">Value: </span>
              <span className="text-green-600 dark:text-green-400">{source.value}</span>
            </div>
          )}
          {source.inputs && (
            <div className="mt-2 ml-4 space-y-1">
              {Object.entries(source.inputs).map(([inputKey, inputValue]) => (
                <div key={inputKey} className="text-xs">
                  <span className="text-gray-600 dark:text-gray-400">{inputKey}: </span>
                  <span className="text-gray-800 dark:text-gray-200">{inputValue}</span>
                </div>
              ))}
            </div>
          )}
          {source.constants && (
            <div className="mt-2 ml-4 space-y-1">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Constants:</div>
              {Object.entries(source.constants).map(([constKey, constValue]) => (
                <div key={constKey} className="text-xs ml-2">
                  <span className="text-gray-600 dark:text-gray-400">{constKey}: </span>
                  <span className="text-gray-800 dark:text-gray-200">{constValue}</span>
                </div>
              ))}
            </div>
          )}
          {source.method && (
            <div className="mb-1 mt-2">
              <span className="font-medium">Method: </span>
              <span className="text-gray-600 dark:text-gray-400">{source.method}</span>
            </div>
          )}
          {source.example && (
            <div className="mb-1 mt-2">
              <span className="font-medium">Example Calculation: </span>
              <code className="text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-2 py-1 rounded">{source.example}</code>
            </div>
          )}
          {source.note && (
            <div className="mt-2 text-xs italic text-gray-500 dark:text-gray-400">
              Note: {source.note}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Calculator size={16} />
          Data Sources for "{chartName}"
        </span>
        {isOpen ? (
          <ChevronUp size={16} />
        ) : (
          <ChevronDown size={16} />
        )}
      </button>
      {isOpen && (
        <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            This chart uses the following data sources and calculations:
          </div>
          <div className="space-y-0">
            {Object.entries(dataSources).map(([key, source]) => renderDataSource(key, source))}
          </div>
        </div>
      )}
    </div>
  );
};

const HeatPumpEnergyFlow = () => {
  // --- Context and State ---
  const outletContext = useOutletContext() || {};
  const { userSettings, setUserSetting } = outletContext;
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get heat loss factor from multiple sources: outlet context, then latest analysis results
  const contextHeatLossFactor = outletContext?.heatLossFactor;
  const latestAnalysisHeatLossFactor = useMemo(() => {
    try {
      // Check for latest analyzer results in localStorage
      const activeZoneId = localStorage.getItem("activeZoneId") || "zone1";
      const zoneKey = `spa_resultsHistory_${activeZoneId}`;
      const zoneHistory = JSON.parse(localStorage.getItem(zoneKey) || "null");
      const legacyHistory = JSON.parse(localStorage.getItem("spa_resultsHistory") || "null");
      const resultsHistory = (zoneHistory && Array.isArray(zoneHistory) && zoneHistory.length > 0) 
        ? zoneHistory 
        : (legacyHistory && Array.isArray(legacyHistory) && legacyHistory.length > 0) 
          ? legacyHistory 
          : [];
      const latestAnalysis = resultsHistory.length > 0 ? resultsHistory[resultsHistory.length - 1] : null;
      return latestAnalysis?.heatLossFactor || null;
    } catch {
      return null;
    }
  }, []);
  
  // Use outlet context first, then fall back to latest analysis
  const effectiveHeatLossFactor = contextHeatLossFactor || latestAnalysisHeatLossFactor;
  const contextBalancePoint = outletContext?.balancePoint;
  
  // Default to using analyzer data if available
  const [useAnalyzerData, setUseAnalyzerData] = useState(() => {
    // Check if analyzer data is available in context or localStorage
    return Boolean(effectiveHeatLossFactor);
  });
  const primarySystem =
    userSettings?.primarySystem || outletContext.primarySystem || "heatPump";
  const afue = Number(userSettings?.afue) || outletContext?.afue || 0.95;

  // Refs for field highlighting
  const squareFeetRef = useRef(null);
  const insulationRef = useRef(null);
  const homeShapeRef = useRef(null);
  const ceilingHeightRef = useRef(null);

  // Extract building characteristics from context
  const squareFeet =
    Number(userSettings?.squareFeet) || outletContext?.squareFeet || 1500;
  const setSquareFeet = (v) =>
    setUserSetting
      ? setUserSetting("squareFeet", v)
      : (outletContext?.setSquareFeet || (() => {}))(v);
  const insulationLevel =
    Number(userSettings?.insulationLevel) ||
    outletContext?.insulationLevel ||
    1.0;
  const setInsulationLevel = (v) =>
    setUserSetting
      ? setUserSetting("insulationLevel", v)
      : (outletContext?.setInsulationLevel || (() => {}))(v);
  const homeShape =
    Number(userSettings?.homeShape) || outletContext?.homeShape || 1.0;
  const setHomeShape = (v) =>
    setUserSetting
      ? setUserSetting("homeShape", v)
      : (outletContext?.setHomeShape || (() => {}))(v);
  const ceilingHeight =
    Number(userSettings?.ceilingHeight) || outletContext?.ceilingHeight || 8;
  const setCeilingHeight = (v) =>
    setUserSetting
      ? setUserSetting("ceilingHeight", v)
      : (outletContext?.setCeilingHeight || (() => {}))(v);
  const contextIndoorTemp =
    Number(userSettings?.indoorTemp ?? userSettings?.winterThermostat) ||
    outletContext?.indoorTemp ||
    70;

  // Constants
  const CONSTANTS = {
    BTU_PER_KWH: 3412.14,
    KW_PER_TON_OUTPUT: 3.517,
    BASE_BTU_PER_SQFT: 22.67,
    TON_BTU_H: 12000,
    DESIGN_INDOOR_TEMP: 70,
    MIN_CAPACITY_FACTOR: 0.3,
  };

  // System & Environment Inputs (local state only - page-specific)
  // Initialize indoorTemp with real data if available, otherwise use context
  const [indoorTemp, setIndoorTemp] = useState(() => {
    // Will be updated by useEffect if Ecobee data is available
    return contextIndoorTemp;
  });
  
  // Use capacity from userSettings/context (set during onboarding), fallback to 36 if not set
  const contextCapacity =
    Number(userSettings?.capacity || userSettings?.coolingCapacity) ||
    outletContext?.capacity ||
    36;
  const [capacity, setCapacity] = useState(contextCapacity); // HP capacity (kBTU) when in heat pump mode
  const contextHspf =
    Number(userSettings?.hspf2) || outletContext?.hspf2 || 9.0;
  const [hspf, setHspf] = useState(contextHspf); // HSPF2 for HP mode
  const [furnaceInput, setFurnaceInput] = useState(80); // Gas furnace input in kBTU/hr (e.g., 80 => 80,000 BTU/hr)
  const [designOutdoorTemp, setDesignOutdoorTemp] = useState(0);
  const [autoDesignFromLocation, setAutoDesignFromLocation] = useState(true); // true until user overrides
  
  // Get user location for forecast
  const userLocation = useMemo(() => getCached("userLocation", null), []);
  
  // Get forecast data from NWS
  const { forecast: rawForecast } = useForecast(
    userLocation?.latitude,
    userLocation?.longitude,
    { enabled: !!userLocation?.latitude && !!userLocation?.longitude }
  );
  
  // Get current outdoor temp from forecast[1] (next hour, closest to "current")
  const currentOutdoorTempFromForecast = useMemo(() => {
    if (rawForecast && rawForecast.length > 1) {
      return rawForecast[1]?.temp ?? null;
    }
    return null;
  }, [rawForecast]);
  
  // Get Joule Bridge data for target temperature
  const jouleBridge = useJouleBridgeContext();
  const targetTempFromEcobee = useMemo(() => {
    if (jouleBridge?.connected && jouleBridge?.targetTemperature !== null && jouleBridge?.targetTemperature !== undefined) {
      return jouleBridge.targetTemperature;
    }
    return null;
  }, [jouleBridge?.connected, jouleBridge?.targetTemperature]);
  
  // Track if user has manually overridden values
  const [outdoorTempManuallySet, setOutdoorTempManuallySet] = useState(false);
  const [indoorTempManuallySet, setIndoorTempManuallySet] = useState(false);
  
  // Initialize currentOutdoor with real data if available, otherwise use design temp
  const [currentOutdoor, setCurrentOutdoor] = useState(() => {
    // Will be updated by useEffect if forecast data is available
    return designOutdoorTemp;
  });
  
  // Update currentOutdoor when forecast data becomes available
  useEffect(() => {
    if (currentOutdoorTempFromForecast !== null && !outdoorTempManuallySet) {
      setCurrentOutdoor(currentOutdoorTempFromForecast);
    }
  }, [currentOutdoorTempFromForecast, outdoorTempManuallySet]);
  
  // Update indoorTemp when Ecobee data becomes available
  useEffect(() => {
    if (targetTempFromEcobee !== null && !indoorTempManuallySet) {
      setIndoorTemp(targetTempFromEcobee);
    }
  }, [targetTempFromEcobee, indoorTempManuallySet]);

  // Sync capacity and HSPF from context when userSettings change
  useEffect(() => {
    setCapacity(contextCapacity);
  }, [contextCapacity]);

  useEffect(() => {
    setHspf(contextHspf);
  }, [contextHspf]);

  // Auto-enable analyzer data if available (only on initial load, not if user has toggled it off)
  // Only auto-enable if the data is measured (not estimated/fallback)
  useEffect(() => {
    if (effectiveHeatLossFactor) {
      const analyzerSource = userSettings?.analyzerHeatLossSource || outletContext?.analyzerHeatLossSource;
      const isMeasured = analyzerSource === 'measured';
      // Only auto-enable if data is measured, not if it's an estimate
      if (isMeasured) {
        setUseAnalyzerData(true);
      } else {
        // If it's an estimate, make sure it's disabled
        setUseAnalyzerData(false);
      }
    }
    // Only run when effectiveHeatLossFactor becomes available
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveHeatLossFactor]);

  // Auto-select design temperature based on onboarding / forecast location saved in localStorage
  useEffect(() => {
    if (!autoDesignFromLocation) return; // user already picked
    try {
      const raw = localStorage.getItem("userLocation");
      if (!raw) return;
      const loc = JSON.parse(raw);
      const lat = Number(loc.latitude ?? loc.lat);
      if (isNaN(lat)) return;
      // Simple latitude band heuristic for 99% design dry-bulb (approximate)
      const bands = [
        { max: 28, temp: 30 }, // South Florida, Hawaii
        { max: 32, temp: 25 }, // Gulf Coast / Coastal South
        { max: 36, temp: 20 }, // Mid-South / Mid-Atlantic
        { max: 40, temp: 10 }, // Interior Mid-Atlantic / Lower Midwest
        { max: 44, temp: 0 }, // Upper Midwest / New England south
        { max: 48, temp: -5 }, // Northern tier / Northern New England
        { max: 90, temp: -10 }, // Far north / Alaska interior
      ];
      const band = bands.find((b) => lat < b.max) || bands[bands.length - 1];
      setDesignOutdoorTemp(band.temp);
    } catch {
      /* ignore malformed */
    }
  }, [autoDesignFromLocation]);

  // Building Inputs - REMOVED (now using context)
  // const [squareFeet, setSquareFeet] = useState(1500);
  // const [insulationLevel, setInsulationLevel] = useState(1.0);
  // const [homeShape, setHomeShape] = useState(1.0);
  // const [ceilingHeight, setCeilingHeight] = useState(8);
  const [hoursElapsed, setHoursElapsed] = useState(4);
  const [indoorAuxMode, setIndoorAuxMode] = useState(() => {
    try {
      return localStorage.getItem("indoorAuxMode") || "both";
    } catch {
      return "both";
    }
  }); // 'with', 'without', 'both'
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);
  // Show the analyzer data option by default if analyzer data is available
  const [showImportOption, setShowImportOption] = useState(() => {
    return Boolean(effectiveHeatLossFactor);
  });
  const [showCalculations, setShowCalculations] = useState(false);
  const [showEngineeringDetails, setShowEngineeringDetails] = useState(false);

  // persist selection
  useEffect(() => {
    try {
      localStorage.setItem("indoorAuxMode", indoorAuxMode);
    } catch {
      /* ignore */
    }
  }, [indoorAuxMode]);

  // Handle field highlighting from methodology page
  useEffect(() => {
    const highlightField = searchParams.get("highlight");
    if (highlightField) {
      const refMap = {
        squareFeet: squareFeetRef,
        insulationLevel: insulationRef,
        homeShape: homeShapeRef,
        ceilingHeight: ceilingHeightRef,
      };

      const targetRef = refMap[highlightField];
      if (targetRef?.current) {
        // Scroll to the field
        setTimeout(() => {
          targetRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          // Add highlight animation
          targetRef.current.style.transition = "all 0.3s ease";
          targetRef.current.style.boxShadow =
            "0 0 0 3px rgba(59, 130, 246, 0.5)";
          targetRef.current.style.transform = "scale(1.02)";

          // Remove highlight after 3 seconds
          setTimeout(() => {
            targetRef.current.style.boxShadow = "";
            targetRef.current.style.transform = "";
          }, 3000);

          // Clear the URL parameter
          setSearchParams({});
        }, 300);
      }
    }
  }, [searchParams, setSearchParams]);

  // --- Derived Values & Physics Model ---
  const capacities = {
    18: 1.5,
    24: 2.0,
    30: 2.5,
    36: 3.0,
    42: 3.5,
    48: 4.0,
    60: 5.0,
  };
  // Ensure capacity is a number and get tons
  const capacityNum = Number(capacity);
  let tons = capacities[capacityNum];
  
  // Safety check: if tons is undefined, use fallback
  if (tons === undefined || !Number.isFinite(tons)) {
    // Fallback: assume 1 ton per 12k BTU (standard conversion)
    const fallbackTons = capacityNum / 12;
    if (fallbackTons > 0 && Number.isFinite(fallbackTons)) {
      console.warn(`Capacity ${capacity} (${typeof capacity}) not in map. Using fallback: ${capacityNum}k BTU = ${fallbackTons.toFixed(2)} tons`);
      tons = fallbackTons;
    } else {
      console.error(`Cannot calculate tons from capacity ${capacity} (${typeof capacity}). Using 1.5 tons as emergency default.`);
      tons = 1.5; // Emergency fallback
    }
  }
  
  // Final validation
  if (!Number.isFinite(tons) || tons <= 0) {
    console.error(`CRITICAL: Invalid tons value ${tons} for capacity ${capacity}. Using 1.5 tons.`);
    tons = 1.5;
  }

  /**
   * Single source of truth for the building's heat loss characteristic.
   */
  const btuLossPerDegF = useMemo(() => {
    if (useAnalyzerData && effectiveHeatLossFactor) {
      return effectiveHeatLossFactor;
    }
    const designTempDiff = Math.max(
      10,
      Math.abs(CONSTANTS.DESIGN_INDOOR_TEMP - designOutdoorTemp)
    );
    const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
    const estimatedDesignHeatLoss =
      squareFeet *
      CONSTANTS.BASE_BTU_PER_SQFT *
      insulationLevel *
      homeShape *
      ceilingMultiplier;
    return estimatedDesignHeatLoss / designTempDiff;
  }, [
    squareFeet,
    insulationLevel,
    homeShape,
    ceilingHeight,
    designOutdoorTemp,
    useAnalyzerData,
    effectiveHeatLossFactor,
    CONSTANTS.BASE_BTU_PER_SQFT,
    CONSTANTS.DESIGN_INDOOR_TEMP,
  ]);

  // Estimate compressor power from HSPF rating (HP mode only).
  const compressorPower = useMemo(() => {
    if (primarySystem === "gasFurnace") return 0;
    return (tons * CONSTANTS.TON_BTU_H) / Math.max(0.1, hspf) / 1000;
  }, [tons, hspf, primarySystem, CONSTANTS.TON_BTU_H]);

  // Main calculation loop to generate performance data across all temperatures.
  const data = useMemo(() => {
    const result = [];
    const thermalCap = Math.max(2000, squareFeet * 5); // Building's thermal mass.

    for (let tempOut = -10; tempOut <= 70; tempOut += 1) {
      // 1. Calculate system output at this temperature
      let thermalOutputBtu;
      let thermalOutputKw = 0;
      if (primarySystem === "gasFurnace") {
        // Furnace output assumed constant: input * AFUE
        thermalOutputBtu = Math.max(
          10000,
          furnaceInput * 1000 * Math.max(0.5, Math.min(0.99, afue))
        );
      } else {
        // Check if custom equipment profile is enabled
        const useCustomProfile = userSettings?.useCustomEquipmentProfile && 
          userSettings?.capacity47 && 
          userSettings?.capacity17 && 
          userSettings?.cop47 && 
          userSettings?.cop17;

        if (useCustomProfile) {
          // Use custom capacity curve with linear interpolation
          const interpolate = (x, x1, y1, x2, y2) => {
            if (x2 === x1) return y1;
            return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
          };

          if (tempOut >= 47) {
            thermalOutputBtu = userSettings.capacity47;
          } else if (tempOut <= 17) {
            if (userSettings.capacity5) {
              thermalOutputBtu = interpolate(tempOut, 17, userSettings.capacity17, 5, userSettings.capacity5);
            } else {
              const slope = (userSettings.capacity17 - userSettings.capacity47) / (17 - 47);
              thermalOutputBtu = Math.max(0, userSettings.capacity17 + slope * (tempOut - 17));
            }
          } else {
            thermalOutputBtu = interpolate(tempOut, 47, userSettings.capacity47, 17, userSettings.capacity17);
          }
          // Convert BTU/hr to kW (thermal output)
          thermalOutputKw = thermalOutputBtu / 3412;
        } else {
          // Generic heat pump derating curve
          // Standard curve: 100% at 47°F+, linear derate to 64% at 17°F, then 0.01 per °F below 17°F
          // Minimum capacity factor ensures system never goes to zero (maintains at least 30% capacity)
          let capacityFactor;
          if (tempOut >= 47) {
            capacityFactor = 1.0;
          } else if (tempOut >= 17) {
            // Linear derate from 100% @ 47°F to 64% @ 17°F
            // Slope = (1.0 - 0.64) / (47 - 17) = 0.36 / 30 = 0.012 per °F
            capacityFactor = 1.0 - (47 - tempOut) * 0.012;
          } else {
            // Below 17°F: continue derating at 0.01 per °F below 17°F
            // At 17°F: 0.64, at 5°F: 0.64 - (17-5)*0.01 = 0.64 - 0.12 = 0.52
            capacityFactor = 0.64 - (17 - tempOut) * 0.01;
          }
          // Ensure minimum capacity (system never completely shuts off)
          capacityFactor = Math.max(
            CONSTANTS.MIN_CAPACITY_FACTOR,
            capacityFactor
          );
          // Safety check: ensure tons is valid (use the tons calculated above, with fallback)
          const safeTons = (tons !== undefined && Number.isFinite(tons) && tons > 0) 
            ? tons 
            : (capacityNum / 12); // Fallback: 12k BTU = 1 ton
          
          if (!Number.isFinite(safeTons) || safeTons <= 0) {
            console.error(`Cannot calculate output at ${tempOut}°F: invalid tons (${safeTons}) from capacity ${capacity} (${typeof capacity}). Using 1.5 tons as emergency fallback.`);
            thermalOutputKw = 1.5 * CONSTANTS.KW_PER_TON_OUTPUT * capacityFactor;
          } else {
            thermalOutputKw = safeTons * CONSTANTS.KW_PER_TON_OUTPUT * capacityFactor;
          }
          
          thermalOutputBtu = thermalOutputKw * CONSTANTS.BTU_PER_KWH;
          
          // Safety check: ensure output is never zero or negative
          if (!Number.isFinite(thermalOutputBtu) || thermalOutputBtu <= 0) {
            console.warn(`Invalid thermal output at ${tempOut}°F: ${thermalOutputBtu}, tons: ${safeTons}, capacity: ${capacity}, capacityFactor: ${capacityFactor}. Using minimum.`);
            const emergencyTons = safeTons > 0 ? safeTons : 1.5;
            thermalOutputBtu = emergencyTons * CONSTANTS.KW_PER_TON_OUTPUT * CONSTANTS.MIN_CAPACITY_FACTOR * CONSTANTS.BTU_PER_KWH;
          }
          
          // Final validation - this should never be 0 if we have valid inputs
          if (!Number.isFinite(thermalOutputBtu) || thermalOutputBtu <= 0) {
            console.error(`CRITICAL: Still invalid output at ${tempOut}°F after all fixes: ${thermalOutputBtu}. Capacity: ${capacity}, Tons: ${safeTons}, Factor: ${capacityFactor}`);
          }
        }
      }

      // 2. Calculate Building's heat loss at this temperature.
      const tempDiff = Math.max(1, indoorTemp - tempOut);
      const buildingHeatLossBtu = btuLossPerDegF * tempDiff;

      // 3. Determine how much auxiliary heat is needed (if any).
      const auxHeatBtu = Math.max(0, buildingHeatLossBtu - thermalOutputBtu);

      // 4. Calculate total heat supplied to the building (HP + Aux).
      //    *** THIS IS THE KEY LOGICAL FIX ***
      const totalHeatSuppliedBtu = thermalOutputBtu + auxHeatBtu;

      // 5. Calculate the final steady-state indoor temperature the system can maintain.
      //    T_ss = T_outdoor + (Available Heat Output / Heat Loss per Degree)
      //    NOTE: This uses ACTUAL available heat (thermalOutputBtu), not totalHeatSuppliedBtu
      //    because totalHeatSuppliedBtu includes aux heat which may not be available.
      //    The steady state is what the system can maintain WITHOUT aux heat.
      const steadyStateIndoorTemp =
        tempOut + thermalOutputBtu / Math.max(0.1, btuLossPerDegF);

      // 6. Calculate the time-evolved temperature after `hoursElapsed`.
      const H = btuLossPerDegF;
      const k = H / thermalCap; // Time constant.
      const t = Math.max(0, hoursElapsed);
      const effectiveIndoorTemp =
        steadyStateIndoorTemp +
        (indoorTemp - steadyStateIndoorTemp) * Math.exp(-k * t);

      // 7. Calculate other metrics for display.
      let electricalKw = 0;
      let actualCOP = 0;
      if (primarySystem !== "gasFurnace") {
        // Check if custom equipment profile is enabled
        const useCustomProfile = userSettings?.useCustomEquipmentProfile && 
          userSettings?.capacity47 && 
          userSettings?.capacity17 && 
          userSettings?.cop47 && 
          userSettings?.cop17;

        if (useCustomProfile) {
          // Use custom COP curve with linear interpolation
          const interpolate = (x, x1, y1, x2, y2) => {
            if (x2 === x1) return y1;
            return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
          };

          if (tempOut >= 47) {
            actualCOP = userSettings.cop47;
          } else if (tempOut <= 17) {
            if (userSettings.cop5) {
              actualCOP = interpolate(tempOut, 17, userSettings.cop17, 5, userSettings.cop5);
            } else {
              const slope = (userSettings.cop17 - userSettings.cop47) / (17 - 47);
              actualCOP = Math.max(1.0, userSettings.cop17 + slope * (tempOut - 17));
            }
          } else {
            actualCOP = interpolate(tempOut, 47, userSettings.cop47, 17, userSettings.cop17);
          }
          // Calculate electrical input from COP: COP = thermalOutput / electricalInput
          electricalKw = thermalOutputKw / Math.max(0.001, actualCOP);
        } else {
          // Generic calculation: rough mapping of electrical input for HP mode
          const powerFactor =
            1.2 -
            Math.max(
              CONSTANTS.MIN_CAPACITY_FACTOR,
              thermalOutputKw / (tons * CONSTANTS.KW_PER_TON_OUTPUT)
            ) *
              0.5;
          electricalKw = compressorPower * powerFactor;
          actualCOP = thermalOutputKw / Math.max(0.001, electricalKw);
        }
      }

      result.push({
        outdoorTemp: tempOut,
        thermalOutputBtu,
        auxHeatBtu,
        buildingHeatLossBtu,
        cop: actualCOP,
        electricalKw,
        electricalInputBtu: electricalKw * CONSTANTS.BTU_PER_KWH, // Convert kW to BTU/hr for consistent units
        effectiveIndoorTemp,
        T_ss: steadyStateIndoorTemp,
      });
    }
    return result;
  }, [
    indoorTemp,
    compressorPower,
    tons,
    btuLossPerDegF,
    squareFeet,
    hoursElapsed,
    primarySystem,
    furnaceInput,
    afue,
    CONSTANTS.BTU_PER_KWH,
    CONSTANTS.KW_PER_TON_OUTPUT,
    CONSTANTS.MIN_CAPACITY_FACTOR,
    userSettings,
  ]);

  // Indoor temperature vs time at the current outdoor temperature (using same corrected logic)
  const indoorTimeSeries = useMemo(() => {
    const series = [];
    const H = Math.max(0.1, btuLossPerDegF); // BTU/hr/°F

    // System output at the current outdoor temp
    let thermalOutputBtu_now;
    if (primarySystem === "gasFurnace") {
      thermalOutputBtu_now = Math.max(
        10000,
        furnaceInput * 1000 * Math.max(0.5, Math.min(0.99, afue))
      );
    } else {
      // Use same derating curve as main data calculation
      let capacityFactor;
      if (currentOutdoor >= 47) {
        capacityFactor = 1.0;
      } else if (currentOutdoor >= 17) {
        capacityFactor = 1.0 - (47 - currentOutdoor) * 0.012;
      } else {
        capacityFactor = 0.64 - (17 - currentOutdoor) * 0.01;
      }
      capacityFactor = Math.max(CONSTANTS.MIN_CAPACITY_FACTOR, capacityFactor);
      const thermalOutputKw_now =
        tons * CONSTANTS.KW_PER_TON_OUTPUT * capacityFactor;
      thermalOutputBtu_now = thermalOutputKw_now * CONSTANTS.BTU_PER_KWH;
      
      // Safety check: ensure output is never zero
      if (!Number.isFinite(thermalOutputBtu_now) || thermalOutputBtu_now <= 0) {
        thermalOutputBtu_now = tons * CONSTANTS.KW_PER_TON_OUTPUT * CONSTANTS.MIN_CAPACITY_FACTOR * CONSTANTS.BTU_PER_KWH;
      }
    }

    // Thermal capacitance (BTU/°F)
    const C = Math.max(2000, squareFeet * 5);

    const dt = 0.25; // hours per step (15 min)
    const steps = Math.max(1, Math.ceil(hoursElapsed / dt));
    let T_noAux = indoorTemp;
    let T_withAux = indoorTemp;
    for (let i = 0; i <= steps; i++) {
      const t = i * dt;

      // Compute building loss at current indoor temps
      const loss_noAux = H * (T_noAux - currentOutdoor);
      const Q_in_noAux = thermalOutputBtu_now; // no auxiliary
      const dT_noAux = (Q_in_noAux - loss_noAux) / C; // °F/hr

      // With aux: auxiliary supplies deficit up to meeting building loss
      const loss_withAux = H * (T_withAux - currentOutdoor);
      const auxNeeded = Math.max(0, loss_withAux - thermalOutputBtu_now);
      const Q_in_withAux = thermalOutputBtu_now + auxNeeded;
      const dT_withAux = (Q_in_withAux - loss_withAux) / C;

      series.push({ time: t, T_noAux, T_withAux });

      T_noAux = T_noAux + dT_noAux * dt;
      T_withAux = T_withAux + dT_withAux * dt;
    }
    return series;
  }, [
    currentOutdoor,
    hoursElapsed,
    indoorTemp,
    tons,
    btuLossPerDegF,
    squareFeet,
    primarySystem,
    furnaceInput,
    afue,
    CONSTANTS.BTU_PER_KWH,
    CONSTANTS.KW_PER_TON_OUTPUT,
    CONSTANTS.MIN_CAPACITY_FACTOR,
  ]);

  // Find the balance point where HP output equals building heat loss.
  const balancePoint = useMemo(() => {
    if (useAnalyzerData && contextBalancePoint) return contextBalancePoint;
    
    // First, check if system has any output at all
    const hasOutput = data.some(d => d.thermalOutputBtu > 0);
    if (!hasOutput) {
      // System has no output - balance point is undefined (system can't handle any load)
      return null;
    }
    
    // Find where output transitions from meeting load to not meeting load
    for (let i = 0; i < data.length - 1; i++) {
      const curr = data[i];
      const next = data[i + 1];
      
      // Skip if either point has invalid output
      if (!Number.isFinite(curr.thermalOutputBtu) || !Number.isFinite(next.thermalOutputBtu)) {
        continue;
      }
      
      const surplusCurr = curr.thermalOutputBtu - curr.buildingHeatLossBtu;
      const surplusNext = next.thermalOutputBtu - next.buildingHeatLossBtu;
      
      // Find the crossing point where we go from surplus to deficit
      if (surplusCurr >= 0 && surplusNext < 0) {
        const t = surplusCurr / (surplusCurr - surplusNext);
        const balanceTemp = curr.outdoorTemp + t * (next.outdoorTemp - curr.outdoorTemp);
        return balanceTemp;
      }
    }
    
    // If we never cross (system always has surplus or always has deficit)
    // Check if system can handle design temp
    const designPoint = data.find(d => d.outdoorTemp === designOutdoorTemp);
    if (designPoint && designPoint.thermalOutputBtu >= designPoint.buildingHeatLossBtu) {
      // System can handle design temp - balance point is below design temp
      return designOutdoorTemp - 1;
    }
    
    // System cannot handle design temp - no valid balance point
    return null;
  }, [data, useAnalyzerData, contextBalancePoint, designOutdoorTemp]);

  // Store balance point in localStorage for Ask Joule to access
  useEffect(() => {
    if (balancePoint !== null && isFinite(balancePoint) && primarySystem === "heatPump") {
      try {
        localStorage.setItem("energyFlowBalancePoint", JSON.stringify({
          balancePoint,
          btuLossPerDegF,
          squareFeet,
          ceilingHeight,
          insulationLevel,
          homeShape,
          capacity,
          hspf,
          indoorTemp,
          designOutdoorTemp,
          timestamp: Date.now(),
        }));
      } catch (e) {
        console.warn("Failed to store balance point:", e);
      }
    }
  }, [balancePoint, btuLossPerDegF, squareFeet, ceilingHeight, insulationLevel, homeShape, capacity, hspf, indoorTemp, designOutdoorTemp, primarySystem]);

  // Calculate summary statistics for the dashboard
  const summaryStats = useMemo(() => {
    // Safely calculate maxOutput - handle empty data or invalid values
    const validOutputs = data
      .map((d) => d.thermalOutputBtu)
      .filter((val) => val != null && Number.isFinite(val) && val > 0);
    let maxOutput = validOutputs.length > 0 ? Math.max(...validOutputs) : 0;
    
    // Fallback: if maxOutput is 0, calculate it directly (peak performance at 47°F+)
    if (maxOutput === 0 && primarySystem !== "gasFurnace" && tons > 0) {
      // At 47°F or higher, capacity factor is 1.0 (100% capacity)
      const peakOutputKw = tons * CONSTANTS.KW_PER_TON_OUTPUT * 1.0;
      maxOutput = peakOutputKw * CONSTANTS.BTU_PER_KWH;
    }
    
    // Find design temperature point - try exact match first, then closest
    let atDesign = data.find((d) => d.outdoorTemp === designOutdoorTemp);
    if (!atDesign && data.length > 0) {
      // Find closest temperature point
      atDesign = data.reduce((closest, current) => {
        const closestDiff = Math.abs(closest.outdoorTemp - designOutdoorTemp);
        const currentDiff = Math.abs(current.outdoorTemp - designOutdoorTemp);
        return currentDiff < closestDiff ? current : closest;
      });
    }
    
    // Calculate shortfall: building heat loss - system output
    // If auxHeatBtu is available, use it; otherwise calculate directly
    let shortfallAtDesign = 0;
    let systemOutputAtDesign = 0;
    if (atDesign) {
      // Get system output at design temp
      systemOutputAtDesign = atDesign.thermalOutputBtu != null && Number.isFinite(atDesign.thermalOutputBtu) 
        ? atDesign.thermalOutputBtu 
        : 0;
      
      // Fallback: calculate system output at design temp if not available in data
      if (systemOutputAtDesign === 0 && primarySystem !== "gasFurnace" && tons > 0) {
        // Calculate capacity factor at design temp
        let capacityFactor = 0;
        if (designOutdoorTemp >= 47) {
          capacityFactor = 1.0;
        } else if (designOutdoorTemp >= 17) {
          capacityFactor = 1.0 - (47 - designOutdoorTemp) * 0.012;
        } else {
          capacityFactor = 0.64 - (17 - designOutdoorTemp) * 0.01;
        }
        capacityFactor = Math.max(CONSTANTS.MIN_CAPACITY_FACTOR, capacityFactor);
        const thermalOutputKw = tons * CONSTANTS.KW_PER_TON_OUTPUT * capacityFactor;
        systemOutputAtDesign = thermalOutputKw * CONSTANTS.BTU_PER_KWH;
      }
      
      if (atDesign.auxHeatBtu != null && Number.isFinite(atDesign.auxHeatBtu)) {
        shortfallAtDesign = Math.max(0, atDesign.auxHeatBtu);
      } else {
        // Calculate directly: shortfall = heat loss - output
        const heatLoss = atDesign.buildingHeatLossBtu != null && Number.isFinite(atDesign.buildingHeatLossBtu)
          ? atDesign.buildingHeatLossBtu
          : btuLossPerDegF * (indoorTemp - designOutdoorTemp);
        shortfallAtDesign = Math.max(0, heatLoss - systemOutputAtDesign);
      }
    } else {
      // Fallback: calculate from known values
      // Calculate system output at design temp if not available in data
      if (primarySystem !== "gasFurnace" && tons > 0) {
        // Calculate capacity factor at design temp
        let capacityFactor = 0;
        if (designOutdoorTemp >= 47) {
          capacityFactor = 1.0;
        } else if (designOutdoorTemp >= 17) {
          capacityFactor = 1.0 - (47 - designOutdoorTemp) * 0.012;
        } else {
          capacityFactor = 0.64 - (17 - designOutdoorTemp) * 0.01;
        }
        capacityFactor = Math.max(CONSTANTS.MIN_CAPACITY_FACTOR, capacityFactor);
        const thermalOutputKw = tons * CONSTANTS.KW_PER_TON_OUTPUT * capacityFactor;
        systemOutputAtDesign = thermalOutputKw * CONSTANTS.BTU_PER_KWH;
      }
      const heatLoss = btuLossPerDegF * (indoorTemp - designOutdoorTemp);
      shortfallAtDesign = Math.max(0, heatLoss - systemOutputAtDesign);
    }
    
    const designDataPoint = atDesign || data.find((d) => d.outdoorTemp === designOutdoorTemp);
    const copAtDesign = 
      (designDataPoint?.cop != null && Number.isFinite(designDataPoint.cop))
        ? designDataPoint.cop
        : 0;

    // Calculate annual aux heat hours based on location HDD data
    let annualAuxHours = 0;
    let annualAuxDays = 0;
    try {
      const userLoc = JSON.parse(localStorage.getItem("userLocation") || "{}");
      const foundLocationName = userLoc.foundLocationName || "";
      const stateFullName = userLoc.state || "";

      if (
        foundLocationName &&
        stateFullName &&
        balancePoint !== null &&
        isFinite(balancePoint)
      ) {
        const annualHDD = getAnnualHDD(foundLocationName, stateFullName);
        if (annualHDD) {
          // Estimate hours below balance point using HDD and temperature distribution
          // Rough approximation: if balance point is B°F, estimate hours below B
          // Using degree-day distribution, approximately (HDD / (65 - avgWinterTemp)) * 24 hours
          // Simplified: assume ~20% of heating hours are below balance point for typical systems
          const avgHeatingHours = (annualHDD / 30) * 24; // rough estimate of total heating hours
          const tempRange = 65 - designOutdoorTemp; // temperature range for heating
          const balanceRange = balancePoint - designOutdoorTemp; // range where aux is needed
          const fractionNeedingAux = Math.max(
            0,
            Math.min(1, balanceRange / tempRange)
          );
          annualAuxHours = Math.round(avgHeatingHours * fractionNeedingAux);
          annualAuxDays = Math.round(annualAuxHours / 24);
        }
      }
    } catch {
      // Silently fail if localStorage is unavailable
    }

    return {
      maxOutput,
      shortfallAtDesign,
      copAtDesign,
      annualAuxHours,
      annualAuxDays,
    };
  }, [data, designOutdoorTemp, balancePoint, primarySystem, tons, indoorTemp, btuLossPerDegF]);

  // Get design temperature data point for live calculations
  const designDataPoint = useMemo(() => {
    return data.find((d) => d.outdoorTemp === designOutdoorTemp) || data[0] || null;
  }, [data, designOutdoorTemp]);

  // Calculate building heat loss at design temp
  const buildingHeatLossAtDesign = useMemo(() => {
    if (!designDataPoint) return 0;
    return designDataPoint.buildingHeatLossBtu || btuLossPerDegF * (indoorTemp - designOutdoorTemp);
  }, [designDataPoint, btuLossPerDegF, indoorTemp, designOutdoorTemp]);

  // Calculate system output at design temp
  const systemOutputAtDesign = useMemo(() => {
    if (!designDataPoint) return 0;
    return designDataPoint.thermalOutputBtu || 0;
  }, [designDataPoint]);

  // Calculate aux heat at design temp
  const auxHeatAtDesign = useMemo(() => {
    if (!designDataPoint) return 0;
    return designDataPoint.auxHeatBtu || Math.max(0, buildingHeatLossAtDesign - systemOutputAtDesign);
  }, [designDataPoint, buildingHeatLossAtDesign, systemOutputAtDesign]);

  return (
      <div className="heat-pump-energy-flow pb-20">
        <div className="detailed-view">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all no-print"
              title="Print to PDF (Ctrl+P)"
            >
              <Printer size={18} />
              <span>Print to PDF</span>
            </button>
            <DashboardLink />
          </div>

        <div className="text-center mb-8">
          {primarySystem === "gasFurnace" ? (
            <>
              <div className="flex items-center justify-center gap-3 mb-2">
                <Flame className="text-orange-600" size={32} />
                <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                  Gas Furnace Performance & Coverage
                </h1>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                See when your furnace output meets your home's heat loss and how
                efficiency (AFUE) impacts sizing.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-3 mb-2">
                <Zap className="text-blue-600" size={32} />
                <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                  Heat Pump Performance & Cold-Weather Limits
                </h1>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                See when your heat pump is enough — and when backup heat is needed.
              </p>
            </>
          )}
        </div>

        {!showImportOption && effectiveHeatLossFactor && (
          <div className="mb-6 text-center">
            <button
              onClick={() => setShowImportOption(true)}
              className="text-blue-600 hover:text-blue-800 underline text-sm font-semibold"
            >
              Have a Heat Loss Factor? Import it here
            </button>
          </div>
        )}

        {showImportOption && (() => {
          // Check if analyzer data is from measured coast-down or fallback/estimate
          const analyzerSource = userSettings?.analyzerHeatLossSource || outletContext?.analyzerHeatLossSource;
          const isMeasured = analyzerSource === 'measured';
          const isFallbackOrEstimate = effectiveHeatLossFactor && !isMeasured;
          
          return (
            <div className={`mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border dark:border-gray-700 ${isFallbackOrEstimate ? 'opacity-50' : ''}`}>
              <label
                htmlFor="useAnalyzerData"
                className={`font-semibold flex items-center gap-2 ${isFallbackOrEstimate ? 'text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'text-gray-900 dark:text-gray-100 cursor-pointer'}`}
              >
                <input
                  type="checkbox"
                  id="useAnalyzerData"
                  checked={useAnalyzerData}
                  onChange={(e) => setUseAnalyzerData(e.target.checked)}
                  disabled={!effectiveHeatLossFactor || isFallbackOrEstimate}
                  className="w-5 h-5 accent-blue-600"
                />
                Use my real-world Heat Loss Factor from the Performance Analyzer
                tool
              </label>
              {!effectiveHeatLossFactor && (
                <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">
                  No data available. Run the "System Performance Analyzer" first
                  to enable this.
                </p>
              )}
              {isFallbackOrEstimate && (
                <p className="text-xs text-gray-500 dark:text-gray-400 ml-7 mt-1">
                  This option is disabled because the analyzer used an estimate rather than measured data. For more accurate results, upload data with a longer "system off" period (about 3 hours).
                </p>
              )}
            </div>
          );
        })()}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div
            className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border dark:border-gray-700 transition-opacity ${
              useAnalyzerData ? "opacity-50 pointer-events-none" : "opacity-100"
            }`}
          >
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Home size={20} />
              Building Characteristics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div ref={squareFeetRef}>
                <label
                  htmlFor="squareFeet"
                  className="block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >
                  Square Footage
                </label>
                <input
                  id="squareFeet"
                  type="range"
                  min="800"
                  max="4000"
                  step="100"
                  value={squareFeet}
                  onChange={(e) => setSquareFeet(Number(e.target.value))}
                  className="w-full"
                />
                <span className="font-bold text-gray-900 dark:text-gray-100">
                  {squareFeet.toLocaleString()} sq ft
                </span>
              </div>
              <div ref={ceilingHeightRef}>
                <label
                  htmlFor="ceilingHeight"
                  className="block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >
                  Ceiling Height
                </label>
                <input
                  id="ceilingHeight"
                  type="range"
                  min="7"
                  max="20"
                  step="1"
                  value={ceilingHeight}
                  onChange={(e) => setCeilingHeight(Number(e.target.value))}
                  className="w-full"
                />
                <span className="font-bold text-gray-900 dark:text-gray-100">
                  {ceilingHeight} ft
                </span>
              </div>
              <div ref={insulationRef}>
                <label
                  htmlFor="insulationLevel"
                  className="block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >
                  Insulation
                </label>
                <select
                  id="insulationLevel"
                  value={insulationLevel}
                  onChange={(e) => setInsulationLevel(Number(e.target.value))}
                  className={selectClasses}
                >
                  <option value={1.4}>Poor</option>
                  <option value={1.0}>Average</option>
                  <option value={0.65}>Good</option>
                </select>
              </div>
              <div ref={homeShapeRef}>
                <label
                  htmlFor="homeShape"
                  className="block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >
                  Home Shape
                </label>
                <select
                  id="homeShape"
                  value={homeShape}
                  onChange={(e) => setHomeShape(Number(e.target.value))}
                  className={selectClasses}
                >
                  <option value={1.3}>Cabin / A-Frame</option>
                  <option value={1.15}>Ranch</option>
                  <option value={1.0}>Average</option>
                  <option value={0.9}>2-Story</option>
                </select>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Settings size={20} />
              System & Environment
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {primarySystem === "gasFurnace" ? (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Furnace Input Capacity
                    </label>
                    <select
                      value={furnaceInput}
                      onChange={(e) => setFurnaceInput(Number(e.target.value))}
                      className={selectClasses}
                    >
                      {[40, 60, 80, 100, 120, 140].map((v) => (
                        <option key={v} value={v}>
                          {v}k BTU/hr input
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                      AFUE (from Settings)
                    </label>
                    <div
                      className={
                        fullInputClasses + " flex items-center justify-between"
                      }
                    >
                      <span className="font-semibold">
                        {Math.round(afue * 100)}%
                      </span>
                      <span className="text-xs text-gray-500">
                        Adjust in Settings
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                      HP Capacity
                    </label>
                    <select
                      value={capacity}
                      onChange={(e) => setCapacity(Number(e.target.value))}
                      className={selectClasses}
                    >
                      {Object.entries(capacities).map(([btu, ton]) => (
                        <option key={btu} value={btu}>
                          {btu}k BTU ({ton} tons)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                      HSPF2 Rating
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="6"
                      max="13"
                      value={hspf}
                      onChange={(e) =>
                        setHspf(
                          Math.max(6, Math.min(13, Number(e.target.value)))
                        )
                      }
                      className={fullInputClasses}
                    />
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                      Find this on your system's nameplate or Energy Guide
                      label. Typical range: 6.0–13.0
                    </p>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Target Indoor Temp
                </label>
                <input
                  type="range"
                  min="65"
                  max="75"
                  value={indoorTemp}
                  onChange={(e) => {
                    setIndoorTemp(Number(e.target.value));
                    setIndoorTempManuallySet(true);
                  }}
                  className="w-full"
                />
                <div className="flex items-center justify-between mt-1">
                  <span className="font-bold text-gray-900 dark:text-gray-100">
                    {indoorTemp}°F
                  </span>
                  {targetTempFromEcobee !== null && !indoorTempManuallySet && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-semibold">
                      ✓ From Ecobee
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Design Outdoor Temp
                </label>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  This is a <strong>planning temperature</strong>, not today's weather. It represents a cold night your system should be able to handle without losing comfort.
                </p>
                {(() => {
                  const climateBands = [
                    { key: "warm", label: "Warm (30°F)", temp: 30 },
                    { key: "mild", label: "Mild (25°F)", temp: 25 },
                    { key: "cool", label: "Cool (20°F)", temp: 20 },
                    { key: "cold", label: "Cold (10°F)", temp: 10 },
                    { key: "verycold", label: "Very Cold (0°F)", temp: 0 },
                    { key: "frigid", label: "Frigid (-5°F)", temp: -5 },
                    { key: "custom", label: "Custom…", temp: null },
                  ];
                  const match = climateBands.find(
                    (b) => b.temp === designOutdoorTemp
                  );
                  const selectedKey = match ? match.key : "custom";
                  return (
                    <>
                      <div className="mb-2">
                        <select
                          aria-label="Quick select climate band"
                          className={fullInputClasses}
                          value={selectedKey}
                          onChange={(e) => {
                            setAutoDesignFromLocation(false);
                            const key = e.target.value;
                            const band = climateBands.find(
                              (b) => b.key === key
                            );
                            if (band && band.temp !== null)
                              setDesignOutdoorTemp(band.temp);
                          }}
                        >
                          {climateBands.map((b) => (
                            <option key={b.key} value={b.key}>
                              {b.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <input
                        type="range"
                        min="-20"
                        max="30"
                        step="1"
                        value={designOutdoorTemp}
                        onChange={(e) => {
                          setAutoDesignFromLocation(false);
                          setDesignOutdoorTemp(Number(e.target.value));
                        }}
                        className="w-full"
                      />
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-bold text-gray-900 dark:text-gray-100">
                          {designOutdoorTemp}°F
                        </span>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          Pick a band or fine-tune
                        </span>
                      </div>
                      {autoDesignFromLocation && (
                        <div className="mt-2 text-[11px] text-indigo-600 dark:text-indigo-300">
                          Auto-selected from your location. Adjust if needed.
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
            {primarySystem === "gasFurnace" ? (
              <div className="mt-6 p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>About AFUE:</strong> AFUE is the seasonal efficiency
                  of your gas furnace. For example, 95% AFUE means 95% of the
                  fuel energy becomes useful heat. Typical modern furnaces range
                  80–98%.
                </p>
              </div>
            ) : (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Where to find HSPF2:</strong> Check your system's
                  nameplate (usually on the outdoor unit), the Energy Guide
                  label from when you bought it, or your installer's paperwork.
                  You can also search online using your system's model number.
                  HSPF2 is the newer standard that replaced HSPF.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Summary Dashboard - Default View */}
        {!showDetailedAnalysis ? (
          <div className="space-y-6">
            {/* Hero Balance Point Card */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-indigo-950 dark:to-blue-950 rounded-2xl shadow-xl p-8 mb-8 border-4 border-indigo-300 dark:border-indigo-700">
              <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6 text-center flex items-center justify-center gap-3">
                <Thermometer
                  className="text-indigo-600 dark:text-indigo-400"
                  size={36}
                />
                {primarySystem === "gasFurnace"
                  ? "Coverage Temperature"
                  : "System Balance Point"}
              </h2>
              <div className="text-center">
                {balancePoint !== null &&
                isFinite(balancePoint) &&
                balancePoint > designOutdoorTemp ? (
                  <>
                    <div className="mb-6">
                      <div className="text-7xl md:text-8xl font-black text-indigo-600 dark:text-indigo-400 mb-3">
                        {balancePoint.toFixed(1)}°F
                      </div>
                      <div className="inline-block bg-white/80 dark:bg-gray-800/80 rounded-lg px-6 py-3 shadow-md">
                        <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                          Below this temperature, system output is less than
                          building heat loss
                        </p>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl mx-auto shadow-lg border dark:border-gray-700">
                      <p className="text-xl text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                        <strong className="text-indigo-700 dark:text-indigo-400">
                          What this means:
                        </strong>{" "}
                        Below{" "}
                        <strong className="text-indigo-600 dark:text-indigo-300">
                          {balancePoint.toFixed(1)}°F
                        </strong>
                        , the system alone cannot meet your {indoorTemp}°F
                        target. At the design temperature of {designOutdoorTemp}
                        °F (the coldest expected outdoor temperature for your
                        area), the shortfall is approximately{" "}
                        <strong className="text-indigo-600 dark:text-indigo-300">
                          {summaryStats.shortfallAtDesign > 0 && Number.isFinite(summaryStats.shortfallAtDesign)
                            ? (summaryStats.shortfallAtDesign / 1000).toFixed(1) + "k"
                            : "0"}
                          BTU/hr
                        </strong>
                        .
                      </p>
                      {summaryStats.annualAuxHours > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                          <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                            <strong className="text-orange-600 dark:text-orange-400">
                              Annual Impact:
                            </strong>{" "}
                            Based on your location's typical weather, auxiliary
                            heat will likely be needed for approximately{" "}
                            <strong className="text-orange-600 dark:text-orange-400">
                              {summaryStats.annualAuxHours.toLocaleString()}{" "}
                              hours
                            </strong>{" "}
                            ({summaryStats.annualAuxDays} days) per year when
                            outdoor temperatures drop below{" "}
                            {balancePoint.toFixed(1)}°F.
                          </p>
                        </div>
                      )}
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400">
                        <p>
                          <strong>Note:</strong> The balance point is based on
                          your chosen design temperature ({designOutdoorTemp}
                          °F), which represents the coldest expected outdoor
                          temperature for your climate zone—not current outdoor
                          conditions.
                        </p>
                      </div>
                    </div>
                  </>
                ) : balancePoint !== null && isFinite(balancePoint) ? (
                  <>
                    <div className="mb-6">
                      <div className="text-sm font-semibold text-indigo-700 dark:text-indigo-400 mb-2 uppercase tracking-wide">
                        System Balance Point
                      </div>
                      <div className="text-7xl md:text-8xl font-black text-indigo-600 dark:text-indigo-400 mb-3">
                        {balancePoint.toFixed(1)}°F
                      </div>
                      <div className="inline-block bg-white/80 dark:bg-gray-800/80 rounded-lg px-6 py-3 shadow-md">
                        <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                          Coverage temperature is below the design temperature
                        </p>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl mx-auto shadow-lg border dark:border-gray-700">
                      <p className="text-xl text-gray-700 dark:text-gray-300 leading-relaxed">
                        <strong className="text-indigo-700 dark:text-indigo-400">
                          What this means:
                        </strong>{" "}
                        The coverage temperature is below the design
                        temperature. At {designOutdoorTemp}°F, the system
                        shortfall is approximately{" "}
                        <strong className="text-orange-600 dark:text-orange-400">
                          {summaryStats.shortfallAtDesign > 0 && Number.isFinite(summaryStats.shortfallAtDesign)
                            ? (summaryStats.shortfallAtDesign / 1000).toFixed(1) + "k"
                            : "0"}
                          BTU/hr
                        </strong>
                        .
                      </p>
                    </div>
                  </>
                ) : (() => {
                  // Check if system can actually handle design temp before saying "No Aux Needed"
                  const designPoint = data.find(d => d.outdoorTemp === designOutdoorTemp);
                  
                  // Calculate current values using latest btuLossPerDegF (may have changed if analyzer data was enabled)
                  let outputValue = designPoint?.thermalOutputBtu != null && Number.isFinite(designPoint.thermalOutputBtu)
                    ? designPoint.thermalOutputBtu
                    : 0;
                  
                  // Fallback: calculate system output at design temp if not available in data
                  if (outputValue === 0 && primarySystem !== "gasFurnace" && tons > 0) {
                    // Calculate capacity factor at design temp
                    let capacityFactor = 0;
                    if (designOutdoorTemp >= 47) {
                      capacityFactor = 1.0;
                    } else if (designOutdoorTemp >= 17) {
                      capacityFactor = 1.0 - (47 - designOutdoorTemp) * 0.012;
                    } else {
                      capacityFactor = 0.64 - (17 - designOutdoorTemp) * 0.01;
                    }
                    capacityFactor = Math.max(CONSTANTS.MIN_CAPACITY_FACTOR, capacityFactor);
                    const thermalOutputKw = tons * CONSTANTS.KW_PER_TON_OUTPUT * capacityFactor;
                    outputValue = thermalOutputKw * CONSTANTS.BTU_PER_KWH;
                  }
                  
                  // Calculate current heat loss using latest btuLossPerDegF
                  const heatLossValue = btuLossPerDegF * (indoorTemp - designOutdoorTemp);
                  
                  // System can handle design temp if output >= heat loss
                  const canHandleDesignTemp = outputValue > 0 && outputValue >= heatLossValue;
                  
                  if (canHandleDesignTemp) {
                    return (
                      <div className="bg-green-50 dark:bg-green-950 rounded-xl p-8 border-4 border-green-400 dark:border-green-800">
                        <p className="text-3xl font-bold text-green-700 dark:text-green-400 mb-3">
                          No Auxiliary Heat Needed
                        </p>
                        <p className="text-xl text-gray-700 dark:text-gray-300 mb-4">
                          Your system can handle all temperatures down to{" "}
                          {designOutdoorTemp}°F without auxiliary heat.
                        </p>
                        <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-700 text-sm text-gray-600 dark:text-gray-400">
                          <p>
                            <strong>What this means:</strong> The balance point
                            (where system output equals building heat loss) is at or
                            below your design temperature of {designOutdoorTemp}°F.
                            This is the coldest expected temperature for your
                            climate zone, so your heat pump can meet the full
                            heating load year-round.
                          </p>
                        </div>
                      </div>
                    );
                  } else {
                    // System cannot handle design temp - show warning
                    return (
                      <div className="bg-red-50 dark:bg-red-950 rounded-xl p-8 border-4 border-red-400 dark:border-red-800">
                        <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-3">
                          ℹ️ When Backup Heat Is Needed
                        </p>
                        {(() => {
                          // Always recalculate values using current settings to ensure accuracy
                          // (data array may have stale values if analyzer data was enabled after initial calculation)
                          let outputValue = 0;
                          
                          if (primarySystem === "gasFurnace") {
                            // Furnace output: input * AFUE
                            outputValue = Math.max(
                              10000,
                              furnaceInput * 1000 * Math.max(0.5, Math.min(0.99, afue))
                            );
                          } else if (tons > 0) {
                            // Heat pump: calculate capacity factor and output
                            let capacityFactor = 0;
                            if (designOutdoorTemp >= 47) {
                              capacityFactor = 1.0;
                            } else if (designOutdoorTemp >= 17) {
                              capacityFactor = 1.0 - (47 - designOutdoorTemp) * 0.012;
                            } else {
                              capacityFactor = 0.64 - (17 - designOutdoorTemp) * 0.01;
                            }
                            capacityFactor = Math.max(CONSTANTS.MIN_CAPACITY_FACTOR, capacityFactor);
                            const thermalOutputKw = tons * CONSTANTS.KW_PER_TON_OUTPUT * capacityFactor;
                            outputValue = thermalOutputKw * CONSTANTS.BTU_PER_KWH;
                          }
                          
                          // Always use current btuLossPerDegF to ensure we have the latest value (may have changed if analyzer data was enabled)
                          const heatLossValue = btuLossPerDegF * (indoorTemp - designOutdoorTemp);
                          const shortfallValue = Math.max(0, heatLossValue - outputValue);
                          
                          return (
                            <>
                              {shortfallValue > 0 ? (
                                <>
                                  <p className="text-xl text-gray-700 dark:text-gray-300 mb-4">
                                    At {designOutdoorTemp}°F, your heat pump alone cannot meet your home's heat loss. The heat pump provides {outputValue > 0 ? (outputValue / 1000).toFixed(1) + "k" : "0"} BTU/hr, while building heat loss is {(heatLossValue / 1000).toFixed(1)}k BTU/hr. Auxiliary heat supplies the remaining {(shortfallValue / 1000).toFixed(1)}k BTU/hr to maintain comfort.
                                  </p>
                                </>
                              ) : (
                                <p className="text-xl text-gray-700 dark:text-gray-300 mb-4">
                                  At {designOutdoorTemp}°F, your system output ({outputValue > 0 ? (outputValue / 1000).toFixed(1) + "k" : "0"} BTU/hr) meets or exceeds building heat loss ({(heatLossValue / 1000).toFixed(1)}k BTU/hr). No auxiliary heat needed.
                                </p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    );
                  }
                })()}
              </div>
            </div>

            {/* Current Conditions Card */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl p-6 mb-8 border-2 border-green-200 dark:border-green-800">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Thermometer className="text-green-600 dark:text-green-400" size={24} />
                Current Conditions
              </h3>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-green-200 dark:border-green-700">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-lg text-gray-700 dark:text-gray-300">
                    It's <strong>{currentOutdoor}°F</strong> outside right now.
                  </p>
                  {currentOutdoorTempFromForecast !== null && !outdoorTempManuallySet && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-semibold">
                      ✓ Live from NWS
                    </span>
                  )}
                </div>
                {(() => {
                  const currentPoint = data.find(d => Math.abs(d.outdoorTemp - currentOutdoor) < 1);
                  const needsAux = currentPoint && currentPoint.auxHeatBtu > 0;
                  if (needsAux) {
                    return (
                      <p className="text-sm text-orange-600 dark:text-orange-400">
                        Auxiliary heat may be needed at this temperature.
                      </p>
                    );
                  } else {
                    return (
                      <p className="text-sm text-green-600 dark:text-green-400">
                        <strong>This is why auxiliary heat is <em>not</em> running right now.</strong> Your heat pump alone can handle the current conditions.
                      </p>
                    );
                  }
                })()}
              </div>
            </div>

            {/* Section 2: Why This Result Is Conservative */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border dark:border-gray-700 mb-8">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                Why This Result Is Conservative
              </h2>
              <div className="space-y-4">
                {showImportOption && (() => {
                  const analyzerSource = userSettings?.analyzerHeatLossSource || outletContext?.analyzerHeatLossSource;
                  const isMeasured = analyzerSource === 'measured';
                  const isFallbackOrEstimate = effectiveHeatLossFactor && !isMeasured;
                  
                  if (isFallbackOrEstimate) {
                    return (
                      <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          <strong>Not available — using conservative building-based estimate:</strong> The analyzer used an estimate rather than measured data. For more accurate results, upload data with a longer "system off" period (about 3 hours).
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
                {!effectiveHeatLossFactor && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Not available — using conservative building-based estimate:</strong> No measured heat loss data available. Joule is using industry-standard building characteristics to estimate heat loss, which tends to be conservative.
                    </p>
                  </div>
                )}
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <strong>Conservative assumptions:</strong> Joule uses industry-standard building characteristics and conservative derating curves. We <em>could</em> be more optimistic, but we choose not to.
                  </p>
                </div>
              </div>
            </div>

            {/* Stop Here Divider */}
            <div className="my-12 border-t-2 border-dashed border-gray-300 dark:border-gray-600 relative">
              <div className="absolute left-1/2 transform -translate-x-1/2 -top-4 bg-white dark:bg-gray-800 px-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  You don't need to read further unless you want deeper detail
                </p>
              </div>
            </div>

            {/* Section 3: Proof at a Glance */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                Proof at a Glance
              </h2>
              <button
                onClick={() => setShowCalculations(!showCalculations)}
                className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                    <Calculator size={24} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">How This Is Calculated (for engineers & curious nerds)</h3>
                </div>
                {showCalculations ? (
                  <ChevronUp className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                ) : (
                  <ChevronDown className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                )}
              </button>

              {showCalculations && (
                <div className="px-6 pb-6 space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
                  {(() => {
                    // Check if analyzer data is usable (measured, not fallback)
                    const analyzerSource = userSettings?.analyzerHeatLossSource || outletContext?.analyzerHeatLossSource;
                    const isMeasured = analyzerSource === 'measured';
                    const isFallbackOrEstimate = effectiveHeatLossFactor && !isMeasured;
                    const shouldUseAnalyzerValue = useAnalyzerData && !isFallbackOrEstimate && isMeasured;
                    
                    // Calculate theoretical heat loss factor for display
                    const designTempDiff = Math.max(10, Math.abs(70 - designOutdoorTemp));
                    const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
                    const theoreticalHeatLossFactor = (squareFeet * CONSTANTS.BASE_BTU_PER_SQFT * insulationLevel * homeShape * ceilingMultiplier) / designTempDiff;
                    
                    // Use analyzer value only if it's being used and measured, otherwise use theoretical
                    const displayedHeatLossFactor = shouldUseAnalyzerValue ? effectiveHeatLossFactor : theoreticalHeatLossFactor;
                    
                    // Get design point data
                    const designPoint = data.find(d => d.outdoorTemp === designOutdoorTemp);
                    
                    // Calculate all intermediate values for display
                    const capacityNum = Number(capacity);
                    const tonsFromMap = capacities[capacityNum];
                    const tonsValue = (tonsFromMap !== undefined && Number.isFinite(tonsFromMap)) 
                      ? tonsFromMap 
                      : (capacityNum / 12);
                    
                    // Calculate capacity factor at design temp
                    let capacityFactorCalc = 0;
                    let capacityFactorExplanation = "";
                    if (designOutdoorTemp >= 47) {
                      capacityFactorCalc = 1.0;
                      capacityFactorExplanation = `≥ 47°F: Capacity Factor = 1.0 (100% capacity)`;
                    } else if (designOutdoorTemp >= 17) {
                      capacityFactorCalc = 1.0 - (47 - designOutdoorTemp) * 0.012;
                      capacityFactorExplanation = `17°F ≤ T < 47°F: Capacity Factor = 1.0 - (47 - ${designOutdoorTemp}) × 0.012 = 1.0 - ${(47 - designOutdoorTemp).toFixed(1)} × 0.012 = ${capacityFactorCalc.toFixed(4)}`;
                    } else {
                      capacityFactorCalc = 0.64 - (17 - designOutdoorTemp) * 0.01;
                      capacityFactorExplanation = `T < 17°F: Capacity Factor = 0.64 - (17 - ${designOutdoorTemp}) × 0.01 = 0.64 - ${(17 - designOutdoorTemp).toFixed(1)} × 0.01 = ${capacityFactorCalc.toFixed(4)}`;
                    }
                    
                    // Apply minimum
                    const capacityFactorBeforeMin = capacityFactorCalc;
                    capacityFactorCalc = Math.max(CONSTANTS.MIN_CAPACITY_FACTOR, capacityFactorCalc);
                    const minApplied = capacityFactorBeforeMin < CONSTANTS.MIN_CAPACITY_FACTOR;
                    
                    // Calculate thermal output
                    const thermalOutputKwCalc = tonsValue * CONSTANTS.KW_PER_TON_OUTPUT * capacityFactorCalc;
                    const thermalOutputBtuCalc = thermalOutputKwCalc * CONSTANTS.BTU_PER_KWH;
                    
                    // Get actual values from data point
                    const actualOutput = designPoint?.thermalOutputBtu ?? thermalOutputBtuCalc;
                    const actualHeatLoss = designPoint?.buildingHeatLossBtu ?? (displayedHeatLossFactor * (indoorTemp - designOutdoorTemp));
                    const actualShortfall = Math.max(0, actualHeatLoss - actualOutput);
                    
                    return (
                      <div className="space-y-6">
                        <div>
                          <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Step 1: Capacity to Tons Conversion</h4>
                          <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                            <div className="mb-2">
                              <strong className="text-yellow-400">Input:</strong> HP Capacity = <strong className="text-green-400">{capacity}k BTU</strong> (from user selection)
                            </div>
                            <div className="mb-2">
                              <strong className="text-yellow-400">Lookup:</strong> capacities[{capacityNum}] = <strong className="text-green-400">{tonsFromMap !== undefined ? tonsFromMap.toFixed(1) : "undefined"}</strong> tons
                            </div>
                            {tonsFromMap === undefined && (
                              <div className="mb-2 text-orange-400">
                                ⚠️ <strong>Fallback:</strong> Capacity not in map! Using: {capacityNum} ÷ 12 = <strong className="text-green-400">{tonsValue.toFixed(2)}</strong> tons
                              </div>
                            )}
                            <div>
                              <strong className="text-yellow-400">Result:</strong> Tons = <strong className="text-green-400">{tonsValue.toFixed(2)}</strong> tons
                            </div>
                          </code>
                        </div>

                        <div>
                          <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Step 2: Capacity Factor at {designOutdoorTemp}°F</h4>
                          <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                            <div className="mb-2">
                              <strong className="text-yellow-400">Temperature:</strong> {designOutdoorTemp}°F (Design Outdoor Temp)
                            </div>
                            <div className="mb-2">
                              <strong className="text-yellow-400">Calculation:</strong> {capacityFactorExplanation}
                            </div>
                            {minApplied && (
                              <div className="mb-2 text-orange-400">
                                ⚠️ <strong>Minimum Applied:</strong> Calculated factor ({capacityFactorBeforeMin.toFixed(4)}) &lt; MIN_CAPACITY_FACTOR ({CONSTANTS.MIN_CAPACITY_FACTOR})
                              </div>
                            )}
                            <div>
                              <strong className="text-yellow-400">Result:</strong> Capacity Factor = <strong className="text-green-400">{capacityFactorCalc.toFixed(4)}</strong> ({Math.round(capacityFactorCalc * 100)}% of rated capacity)
                            </div>
                          </code>
                        </div>

                        <div>
                          <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Step 3: Thermal Output Calculation</h4>
                          <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                            <div className="mb-2">
                              <strong className="text-yellow-400">Step 3a: Thermal Output (kW):</strong>
                            </div>
                            <div className="ml-4 mb-2">
                              Thermal Output (kW) = Tons × KW_PER_TON_OUTPUT × Capacity Factor
                            </div>
                            <div className="ml-4 mb-2">
                              = <strong className="text-green-400">{tonsValue.toFixed(2)}</strong> tons × <strong className="text-green-400">{CONSTANTS.KW_PER_TON_OUTPUT}</strong> kW/ton × <strong className="text-green-400">{capacityFactorCalc.toFixed(4)}</strong>
                            </div>
                            <div className="ml-4 mb-4">
                              = <strong className="text-green-400">{thermalOutputKwCalc.toFixed(2)}</strong> kW
                            </div>
                            <div className="mb-2">
                              <strong className="text-yellow-400">Step 3b: Thermal Output (BTU/hr):</strong>
                            </div>
                            <div className="ml-4 mb-2">
                              Thermal Output (BTU/hr) = Thermal Output (kW) × BTU_PER_KWH
                            </div>
                            <div className="ml-4 mb-2">
                              = <strong className="text-green-400">{thermalOutputKwCalc.toFixed(2)}</strong> kW × <strong className="text-green-400">{CONSTANTS.BTU_PER_KWH.toFixed(2)}</strong> BTU/kWh
                            </div>
                            <div className="ml-4">
                              = <strong className="text-green-400">{thermalOutputBtuCalc.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> BTU/hr
                            </div>
                            {actualOutput !== thermalOutputBtuCalc && (
                              <div className="mt-2 text-orange-400">
                                ⚠️ <strong>Note:</strong> Actual output from data array: <strong>{actualOutput.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> BTU/hr (may differ due to safety checks)
                              </div>
                            )}
                          </code>
                        </div>

                        <div>
                          <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Step 4: Building Heat Loss at {designOutdoorTemp}°F</h4>
                          <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                            <div className="mb-2">
                              <strong className="text-yellow-400">Heat Loss Factor:</strong> <strong className="text-green-400">{displayedHeatLossFactor.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong> BTU/hr/°F
                            </div>
                            <div className="mb-2">
                              <strong className="text-yellow-400">Temperature Difference:</strong> {indoorTemp}°F (Indoor) - {designOutdoorTemp}°F (Outdoor) = <strong className="text-green-400">{indoorTemp - designOutdoorTemp}</strong>°F
                            </div>
                            <div className="mb-2">
                              <strong className="text-yellow-400">Calculation:</strong>
                            </div>
                            <div className="ml-4 mb-2">
                              Building Heat Loss = Heat Loss Factor × Temperature Difference
                            </div>
                            <div className="ml-4 mb-2">
                              = <strong className="text-green-400">{displayedHeatLossFactor.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong> BTU/hr/°F × <strong className="text-green-400">{indoorTemp - designOutdoorTemp}</strong>°F
                            </div>
                            <div className="ml-4">
                              = <strong className="text-green-400">{actualHeatLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> BTU/hr
                            </div>
                          </code>
                        </div>

                        <div>
                          <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Step 5: Shortfall Calculation</h4>
                          <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                            <div className="mb-2">
                              <strong className="text-yellow-400">System Output:</strong> <strong className="text-green-400">{actualOutput.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> BTU/hr
                            </div>
                            <div className="mb-2">
                              <strong className="text-yellow-400">Building Heat Loss:</strong> <strong className="text-red-400">{actualHeatLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> BTU/hr
                            </div>
                            <div className="mb-2">
                              <strong className="text-yellow-400">Calculation:</strong>
                            </div>
                            <div className="ml-4 mb-2">
                              Shortfall = max(0, Building Heat Loss - System Output)
                            </div>
                            <div className="ml-4 mb-2">
                              = max(0, <strong className="text-red-400">{actualHeatLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> - <strong className="text-green-400">{actualOutput.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>)
                            </div>
                            <div className="ml-4">
                              = <strong className="text-orange-400">{actualShortfall.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> BTU/hr = <strong className="text-orange-400">{(actualShortfall / 1000).toFixed(1)}k</strong> BTU/hr
                            </div>
                            {actualOutput === 0 && (
                              <div className="mt-4 p-3 bg-red-900/30 border border-red-600 rounded text-red-300">
                                <strong>⚠️ PROBLEM DETECTED:</strong> System output is 0 BTU/hr!<br />
                                Possible causes:<br />
                                1. Capacity ({capacity}) not found in capacities map → Tons = {tonsValue.toFixed(2)}<br />
                                2. Capacity Factor = {capacityFactorCalc.toFixed(4)} (should be &gt; 0)<br />
                                3. Thermal Output (kW) = {thermalOutputKwCalc.toFixed(2)} kW<br />
                                4. Check console for error messages
                              </div>
                            )}
                          </code>
                        </div>

                        <div>
                          <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Constants Used</h4>
                          <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                            <div>KW_PER_TON_OUTPUT = <strong className="text-green-400">{CONSTANTS.KW_PER_TON_OUTPUT}</strong> kW/ton (industry standard)</div>
                            <div>BTU_PER_KWH = <strong className="text-green-400">{CONSTANTS.BTU_PER_KWH.toFixed(2)}</strong> BTU/kWh (energy conversion)</div>
                            <div>MIN_CAPACITY_FACTOR = <strong className="text-green-400">{CONSTANTS.MIN_CAPACITY_FACTOR}</strong> (30% minimum capacity)</div>
                          </code>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 border-blue-200 dark:border-blue-800">
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
                  Max System Output
                </h3>
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                  {summaryStats.maxOutput > 0 && Number.isFinite(summaryStats.maxOutput)
                    ? (summaryStats.maxOutput / 1000).toFixed(1) + "k"
                    : "0"}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  BTU/hr at peak performance
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 border-orange-200 dark:border-orange-800">
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
                  Shortfall @ {designOutdoorTemp}°F
                </h3>
                <div className="text-4xl font-bold text-orange-600 dark:text-orange-400 mb-2">
                  {summaryStats.shortfallAtDesign > 0 && Number.isFinite(summaryStats.shortfallAtDesign)
                    ? (summaryStats.shortfallAtDesign / 1000).toFixed(1) + "k"
                    : "0"}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  BTU/hr deficit at design
                </div>
              </div>

              {primarySystem === "gasFurnace" ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 border-green-200 dark:border-green-800">
                  <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
                    Efficiency (AFUE)
                  </h3>
                  <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
                    {Math.round(afue * 100)}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Seasonal efficiency
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 border-green-200 dark:border-green-800">
                  <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
                    Efficiency (COP)
                  </h3>
                  <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
                    {summaryStats.copAtDesign.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    at {designOutdoorTemp}°F design temp
                  </div>
                </div>
              )}
            </div>

            {/* Call to Action */}
            <div className="text-center">
              <button
                onClick={() => setShowDetailedAnalysis(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl text-lg font-bold shadow-lg hover:shadow-xl transition-all flex items-center gap-3 mx-auto"
              >
                <BarChart3 size={24} />
                View Detailed Analysis
                <ChevronRight size={24} />
              </button>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                See comprehensive charts and performance data
              </p>
            </div>
          </div>
        ) : (
          /* Detailed Analysis View */
          <div>
            <div className="mb-6 text-center">
              <button
                onClick={() => setShowDetailedAnalysis(false)}
                className="text-indigo-600 hover:text-indigo-800 font-semibold underline"
              >
                ← Back to Summary
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8 border-2 border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2 text-center">
                {primarySystem === "gasFurnace"
                  ? "Coverage Temperature"
                  : "System Balance Point"}
              </h2>
              <div className="text-center">
                {balancePoint !== null &&
                isFinite(balancePoint) &&
                balancePoint > designOutdoorTemp ? (
                  <>
                    <p className="text-6xl font-bold text-red-600 dark:text-red-400">
                      {balancePoint.toFixed(1)}°F
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
                      Below this temperature, system output is less than your
                      home's heat loss. Additional capacity would be required to
                      maintain your set temperature of {indoorTemp}°F.
                    </p>
                  </>
                ) : balancePoint !== null && isFinite(balancePoint) ? (
                  <>
                    <p className="text-6xl font-bold text-red-600 dark:text-red-400">
                      {balancePoint.toFixed(1)}°F
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
                      Coverage is below the design temperature. The system alone
                      cannot meet the load below this point.
                    </p>
                  </>
                ) : (() => {
                  // Always recalculate values using current settings to ensure accuracy
                  // (data array may have stale values if analyzer data was enabled after initial calculation)
                  let outputValue = 0;
                  
                  if (primarySystem === "gasFurnace") {
                    // Furnace output: input * AFUE
                    outputValue = Math.max(
                      10000,
                      furnaceInput * 1000 * Math.max(0.5, Math.min(0.99, afue))
                    );
                  } else if (tons > 0) {
                    // Heat pump: calculate capacity factor and output
                    let capacityFactor = 0;
                    if (designOutdoorTemp >= 47) {
                      capacityFactor = 1.0;
                    } else if (designOutdoorTemp >= 17) {
                      capacityFactor = 1.0 - (47 - designOutdoorTemp) * 0.012;
                    } else {
                      capacityFactor = 0.64 - (17 - designOutdoorTemp) * 0.01;
                    }
                    capacityFactor = Math.max(CONSTANTS.MIN_CAPACITY_FACTOR, capacityFactor);
                    const thermalOutputKw = tons * CONSTANTS.KW_PER_TON_OUTPUT * capacityFactor;
                    outputValue = thermalOutputKw * CONSTANTS.BTU_PER_KWH;
                  }
                  
                  // Always use current btuLossPerDegF to ensure we have the latest value
                  const heatLossValue = btuLossPerDegF * (indoorTemp - designOutdoorTemp);
                  const shortfallValue = Math.max(0, heatLossValue - outputValue);
                  
                  // System can handle design temp if output >= heat loss
                  const canHandleDesignTemp = outputValue > 0 && outputValue >= heatLossValue;
                  
                  if (canHandleDesignTemp) {
                    return (
                      <>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400 mb-3">
                          No Auxiliary Heat Needed
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
                          Your system can handle all temperatures down to{" "}
                          {designOutdoorTemp}°F without auxiliary heat.
                        </p>
                      </>
                    );
                  } else {
                    return (
                      <>
                        <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mb-3">
                          ℹ️ When Backup Heat Is Needed
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
                          At {designOutdoorTemp}°F, your heat pump alone cannot meet your home's heat loss. The heat pump provides {outputValue > 0 ? (outputValue / 1000).toFixed(1) + "k" : "0"} BTU/hr, while building heat loss is {(heatLossValue / 1000).toFixed(1)}k BTU/hr. Auxiliary heat supplies the remaining {(shortfallValue / 1000).toFixed(1)}k BTU/hr to maintain comfort.
                        </p>
                      </>
                    );
                  }
                })()}
              </div>
            </div>

            {/* Detailed Math Breakdown - Debug Output Calculation (Detailed View) */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-purple-200 dark:border-purple-800 overflow-hidden mt-8 mb-8">
              <button
                onClick={() => setShowCalculations(!showCalculations)}
                className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                    <Calculator size={24} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">How This Is Calculated (for engineers & curious nerds)</h3>
                </div>
                {showCalculations ? (
                  <ChevronUp className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                ) : (
                  <ChevronDown className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                )}
              </button>

              {showCalculations && (
                <div className="px-6 pb-6 space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
                  {(() => {
                    // Check if analyzer data is usable (measured, not fallback)
                    const analyzerSource = userSettings?.analyzerHeatLossSource || outletContext?.analyzerHeatLossSource;
                    const isMeasured = analyzerSource === 'measured';
                    const isFallbackOrEstimate = effectiveHeatLossFactor && !isMeasured;
                    const shouldUseAnalyzerValue = useAnalyzerData && !isFallbackOrEstimate && isMeasured;
                    
                    // Calculate theoretical heat loss factor for display
                    const designTempDiff = Math.max(10, Math.abs(70 - designOutdoorTemp));
                    const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
                    const theoreticalHeatLossFactor = (squareFeet * CONSTANTS.BASE_BTU_PER_SQFT * insulationLevel * homeShape * ceilingMultiplier) / designTempDiff;
                    
                    // Use analyzer value only if it's being used and measured, otherwise use theoretical
                    const displayedHeatLossFactor = shouldUseAnalyzerValue ? effectiveHeatLossFactor : theoreticalHeatLossFactor;
                    
                    // Get design point data
                    const designPoint = data.find(d => d.outdoorTemp === designOutdoorTemp);
                    
                    // Calculate all intermediate values for display
                    const capacityNum = Number(capacity);
                    const tonsFromMap = capacities[capacityNum];
                    const tonsValue = (tonsFromMap !== undefined && Number.isFinite(tonsFromMap)) 
                      ? tonsFromMap 
                      : (capacityNum / 12);
                    
                    // Calculate capacity factor at design temp
                    let capacityFactorCalc = 0;
                    let capacityFactorExplanation = "";
                    if (designOutdoorTemp >= 47) {
                      capacityFactorCalc = 1.0;
                      capacityFactorExplanation = `≥ 47°F: Capacity Factor = 1.0 (100% capacity)`;
                    } else if (designOutdoorTemp >= 17) {
                      capacityFactorCalc = 1.0 - (47 - designOutdoorTemp) * 0.012;
                      capacityFactorExplanation = `17°F ≤ T < 47°F: Capacity Factor = 1.0 - (47 - ${designOutdoorTemp}) × 0.012 = 1.0 - ${(47 - designOutdoorTemp).toFixed(1)} × 0.012 = ${capacityFactorCalc.toFixed(4)}`;
                    } else {
                      capacityFactorCalc = 0.64 - (17 - designOutdoorTemp) * 0.01;
                      capacityFactorExplanation = `T < 17°F: Capacity Factor = 0.64 - (17 - ${designOutdoorTemp}) × 0.01 = 0.64 - ${(17 - designOutdoorTemp).toFixed(1)} × 0.01 = ${capacityFactorCalc.toFixed(4)}`;
                    }
                    
                    // Apply minimum
                    const capacityFactorBeforeMin = capacityFactorCalc;
                    capacityFactorCalc = Math.max(CONSTANTS.MIN_CAPACITY_FACTOR, capacityFactorCalc);
                    const minApplied = capacityFactorBeforeMin < CONSTANTS.MIN_CAPACITY_FACTOR;
                    
                    // Calculate thermal output
                    const thermalOutputKwCalc = tonsValue * CONSTANTS.KW_PER_TON_OUTPUT * capacityFactorCalc;
                    const thermalOutputBtuCalc = thermalOutputKwCalc * CONSTANTS.BTU_PER_KWH;
                    
                    // Get actual values from data point
                    const actualOutput = designPoint?.thermalOutputBtu ?? thermalOutputBtuCalc;
                    const actualHeatLoss = designPoint?.buildingHeatLossBtu ?? (displayedHeatLossFactor * (indoorTemp - designOutdoorTemp));
                    const actualShortfall = Math.max(0, actualHeatLoss - actualOutput);
                    
                    return (
                      <div className="space-y-6">
                        <div>
                          <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Step 1: Capacity to Tons Conversion</h4>
                          <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                            <div className="mb-2">
                              <strong className="text-yellow-400">Input:</strong> HP Capacity = <strong className="text-green-400">{capacity}k BTU</strong> (from user selection)
                            </div>
                            <div className="mb-2">
                              <strong className="text-yellow-400">Lookup:</strong> capacities[{capacityNum}] = <strong className="text-green-400">{tonsFromMap !== undefined ? tonsFromMap.toFixed(1) : "undefined"}</strong> tons
                            </div>
                            {tonsFromMap === undefined && (
                              <div className="mb-2 text-orange-400">
                                ⚠️ <strong>Fallback:</strong> Capacity not in map! Using: {capacityNum} ÷ 12 = <strong className="text-green-400">{tonsValue.toFixed(2)}</strong> tons
                              </div>
                            )}
                            <div>
                              <strong className="text-yellow-400">Result:</strong> Tons = <strong className="text-green-400">{tonsValue.toFixed(2)}</strong> tons
                            </div>
                          </code>
                        </div>

                        <div>
                          <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Step 2: Capacity Factor at {designOutdoorTemp}°F</h4>
                          <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                            <div className="mb-2">
                              <strong className="text-yellow-400">Temperature:</strong> {designOutdoorTemp}°F (Design Outdoor Temp)
                            </div>
                            <div className="mb-2">
                              <strong className="text-yellow-400">Calculation:</strong> {capacityFactorExplanation}
                            </div>
                            {minApplied && (
                              <div className="mb-2 text-orange-400">
                                ⚠️ <strong>Minimum Applied:</strong> Calculated factor ({capacityFactorBeforeMin.toFixed(4)}) &lt; MIN_CAPACITY_FACTOR ({CONSTANTS.MIN_CAPACITY_FACTOR})
                              </div>
                            )}
                            <div>
                              <strong className="text-yellow-400">Result:</strong> Capacity Factor = <strong className="text-green-400">{capacityFactorCalc.toFixed(4)}</strong> ({Math.round(capacityFactorCalc * 100)}% of rated capacity)
                            </div>
                          </code>
                        </div>

                        <div>
                          <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Step 3: Thermal Output Calculation</h4>
                          <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                            <div className="mb-2">
                              <strong className="text-yellow-400">Step 3a: Thermal Output (kW):</strong>
                            </div>
                            <div className="ml-4 mb-2">
                              Thermal Output (kW) = Tons × KW_PER_TON_OUTPUT × Capacity Factor
                            </div>
                            <div className="ml-4 mb-2">
                              = <strong className="text-green-400">{tonsValue.toFixed(2)}</strong> tons × <strong className="text-green-400">{CONSTANTS.KW_PER_TON_OUTPUT}</strong> kW/ton × <strong className="text-green-400">{capacityFactorCalc.toFixed(4)}</strong>
                            </div>
                            <div className="ml-4 mb-4">
                              = <strong className="text-green-400">{thermalOutputKwCalc.toFixed(2)}</strong> kW
                            </div>
                            <div className="mb-2">
                              <strong className="text-yellow-400">Step 3b: Thermal Output (BTU/hr):</strong>
                            </div>
                            <div className="ml-4 mb-2">
                              Thermal Output (BTU/hr) = Thermal Output (kW) × BTU_PER_KWH
                            </div>
                            <div className="ml-4 mb-2">
                              = <strong className="text-green-400">{thermalOutputKwCalc.toFixed(2)}</strong> kW × <strong className="text-green-400">{CONSTANTS.BTU_PER_KWH.toFixed(2)}</strong> BTU/kWh
                            </div>
                            <div className="ml-4">
                              = <strong className="text-green-400">{thermalOutputBtuCalc.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> BTU/hr
                            </div>
                            {actualOutput !== thermalOutputBtuCalc && (
                              <div className="mt-2 text-orange-400">
                                ⚠️ <strong>Note:</strong> Actual output from data array: <strong>{actualOutput.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> BTU/hr (may differ due to safety checks)
                              </div>
                            )}
                          </code>
                        </div>

                        <div>
                          <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Step 4: Building Heat Loss at {designOutdoorTemp}°F</h4>
                          <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                            <div className="mb-2">
                              <strong className="text-yellow-400">Heat Loss Factor:</strong> <strong className="text-green-400">{displayedHeatLossFactor.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong> BTU/hr/°F
                            </div>
                            <div className="mb-2">
                              <strong className="text-yellow-400">Temperature Difference:</strong> {indoorTemp}°F (Indoor) - {designOutdoorTemp}°F (Outdoor) = <strong className="text-green-400">{indoorTemp - designOutdoorTemp}</strong>°F
                            </div>
                            <div className="mb-2">
                              <strong className="text-yellow-400">Calculation:</strong>
                            </div>
                            <div className="ml-4 mb-2">
                              Building Heat Loss = Heat Loss Factor × Temperature Difference
                            </div>
                            <div className="ml-4 mb-2">
                              = <strong className="text-green-400">{displayedHeatLossFactor.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong> BTU/hr/°F × <strong className="text-green-400">{indoorTemp - designOutdoorTemp}</strong>°F
                            </div>
                            <div className="ml-4">
                              = <strong className="text-green-400">{actualHeatLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> BTU/hr
                            </div>
                          </code>
                        </div>

                        <div>
                          <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Step 5: Shortfall Calculation</h4>
                          <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                            <div className="mb-2">
                              <strong className="text-yellow-400">System Output:</strong> <strong className="text-green-400">{actualOutput.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> BTU/hr
                            </div>
                            <div className="mb-2">
                              <strong className="text-yellow-400">Building Heat Loss:</strong> <strong className="text-red-400">{actualHeatLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> BTU/hr
                            </div>
                            <div className="mb-2">
                              <strong className="text-yellow-400">Calculation:</strong>
                            </div>
                            <div className="ml-4 mb-2">
                              Shortfall = max(0, Building Heat Loss - System Output)
                            </div>
                            <div className="ml-4 mb-2">
                              = max(0, <strong className="text-red-400">{actualHeatLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> - <strong className="text-green-400">{actualOutput.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>)
                            </div>
                            <div className="ml-4">
                              = <strong className="text-orange-400">{actualShortfall.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> BTU/hr = <strong className="text-orange-400">{(actualShortfall / 1000).toFixed(1)}k</strong> BTU/hr
                            </div>
                            {actualOutput === 0 && (
                              <div className="mt-4 p-3 bg-red-900/30 border border-red-600 rounded text-red-300">
                                <strong>⚠️ PROBLEM DETECTED:</strong> System output is 0 BTU/hr!<br />
                                Possible causes:<br />
                                1. Capacity ({capacity}) not found in capacities map → Tons = {tonsValue.toFixed(2)}<br />
                                2. Capacity Factor = {capacityFactorCalc.toFixed(4)} (should be &gt; 0)<br />
                                3. Thermal Output (kW) = {thermalOutputKwCalc.toFixed(2)} kW<br />
                                4. Check console for error messages
                              </div>
                            )}
                          </code>
                        </div>

                        <div>
                          <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Constants Used</h4>
                          <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                            <div>KW_PER_TON_OUTPUT = <strong className="text-green-400">{CONSTANTS.KW_PER_TON_OUTPUT}</strong> kW/ton (industry standard)</div>
                            <div>BTU_PER_KWH = <strong className="text-green-400">{CONSTANTS.BTU_PER_KWH.toFixed(2)}</strong> BTU/kWh (energy conversion)</div>
                            <div>MIN_CAPACITY_FACTOR = <strong className="text-green-400">{CONSTANTS.MIN_CAPACITY_FACTOR}</strong> (30% minimum capacity)</div>
                          </code>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border dark:border-gray-700">
                <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">
                  Heat Loss vs.{" "}
                  {primarySystem === "gasFurnace"
                    ? "Furnace Output"
                    : "Heat Pump Output"}
                </h2>
                {/* Responsive aspect-ratio wrapper for chart */}
                <div
                  className="relative w-full"
                  style={{ paddingBottom: "56.25%" }}
                >
                  <div className="absolute top-0 left-0 w-full h-full">
                    <div className="glass dark:glass-dark rounded-2xl p-3 border border-gray-200 dark:border-gray-800 shadow-lg h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={data}
                          margin={{
                            top: 10,
                            right: window.innerWidth < 640 ? 8 : 24,
                            left: window.innerWidth < 640 ? 8 : 16,
                            bottom: 10,
                          }}
                        >
                          <defs>
                            <linearGradient
                              id="heatLossGradient"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#e11d48"
                                stopOpacity={0.2}
                              />
                              <stop
                                offset="95%"
                                stopColor="#e11d48"
                                stopOpacity={0.05}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            stroke="#94a3b8"
                            strokeOpacity={0.2}
                            vertical={false}
                          />
                          <XAxis
                            dataKey="outdoorTemp"
                            label={{
                              value: "Outdoor Temperature (°F)",
                              position: "insideBottom",
                              offset: -5,
                              style: {
                                fontSize: window.innerWidth < 640 ? 10 : 12,
                              },
                            }}
                            type="number"
                            domain={[-10, 70]}
                            tick={{
                              fontSize: window.innerWidth < 640 ? 9 : 12,
                            }}
                          />
                          <YAxis
                            label={{
                              value: "Heat (BTU/hr)",
                              angle: -90,
                              position: "insideLeft",
                              style: {
                                fontSize: window.innerWidth < 640 ? 10 : 12,
                              },
                            }}
                            tickFormatter={(value) =>
                              `${(value / 1000).toFixed(0)}k`
                            }
                            tick={{
                              fontSize: window.innerWidth < 640 ? 9 : 12,
                            }}
                          />
                          <Tooltip
                            content={
                              <CustomTooltip mode={primarySystem} afue={afue} />
                            }
                          />
                          <Legend
                            wrapperStyle={{
                              fontSize: window.innerWidth < 640 ? 11 : 13,
                              paddingTop: "20px",
                            }}
                          />
                          {balancePoint !== null && isFinite(balancePoint) && (
                            <ReferenceLine
                              x={balancePoint}
                              stroke="#ef4444"
                              strokeWidth={2}
                              label={{
                                value: `${
                                  primarySystem === "gasFurnace"
                                    ? "Coverage"
                                    : "Balance"
                                }: ${balancePoint.toFixed(1)}°F`,
                                position: "insideTopRight",
                                style: {
                                  fontSize: window.innerWidth < 640 ? 10 : 12,
                                },
                              }}
                            />
                          )}
                          <Area
                            type="monotone"
                            dataKey="buildingHeatLossBtu"
                            fill="url(#heatLossGradient)"
                            stroke="none"
                            isAnimationActive
                            animationDuration={800}
                          />
                          <Line
                            type="monotone"
                            dataKey="thermalOutputBtu"
                            stroke="#3b82f6"
                            strokeWidth={2.5}
                            name={
                              primarySystem === "gasFurnace"
                                ? "Furnace Output"
                                : "Heat Pump Output"
                            }
                            dot={false}
                            activeDot={{ r: 5 }}
                            isAnimationActive
                            animationDuration={800}
                          />
                          <Line
                            type="monotone"
                            dataKey="buildingHeatLossBtu"
                            stroke="#e11d48"
                            strokeWidth={2.5}
                            name="Building Heat Loss"
                            dot={false}
                            activeDot={{ r: 5 }}
                            isAnimationActive
                            animationDuration={800}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                  <strong>What this shows:</strong> Building heat loss (red) and
                  system thermal output (blue) across outdoor temperatures.
                  Values are in BTU/hr. For heat pumps, blue derates in colder
                  temps; for gas furnaces, blue is constant output (input ×
                  AFUE). Where blue falls below red is the temperature where the
                  system alone can't meet the load.
                </div>
                <DataSourcesDropdown
                  chartName="Heat Loss vs. System Output"
                  dataSources={{
                    buildingHeatLoss: (() => {
                      // Check if analyzer data is usable (measured, not fallback)
                      const analyzerSource = userSettings?.analyzerHeatLossSource || outletContext?.analyzerHeatLossSource;
                      const isMeasured = analyzerSource === 'measured';
                      const isFallbackOrEstimate = effectiveHeatLossFactor && !isMeasured;
                      const shouldUseAnalyzerValue = useAnalyzerData && !isFallbackOrEstimate && isMeasured;
                      
                      // Calculate theoretical heat loss factor for display
                      const designTempDiff = Math.max(10, Math.abs(70 - designOutdoorTemp));
                      const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
                      const theoreticalHeatLossFactor = (squareFeet * CONSTANTS.BASE_BTU_PER_SQFT * insulationLevel * homeShape * ceilingMultiplier) / designTempDiff;
                      const displayedHeatLossFactor = shouldUseAnalyzerValue ? effectiveHeatLossFactor : theoreticalHeatLossFactor;
                      const displayedHeatLossAtDesign = displayedHeatLossFactor * (indoorTemp - designOutdoorTemp);
                      
                      if (shouldUseAnalyzerValue) {
                        return { 
                          source: "System Performance Analyzer", 
                          value: `${effectiveHeatLossFactor.toLocaleString(undefined, { maximumFractionDigits: 1 })} BTU/hr/°F`,
                          example: `At ${designOutdoorTemp}°F: ${buildingHeatLossAtDesign.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr = ${effectiveHeatLossFactor.toLocaleString(undefined, { maximumFractionDigits: 1 })} BTU/hr/°F × (${indoorTemp}°F - ${designOutdoorTemp}°F)`
                        };
                      }
                      return {
                        source: "Calculated from building characteristics",
                        formula: `(Square Feet × ${CONSTANTS.BASE_BTU_PER_SQFT} BTU/sqft × Insulation × Home Shape × Ceiling Multiplier) / Design Temp Diff`,
                        inputs: {
                          squareFeet: `${squareFeet.toLocaleString()} sq ft`,
                          insulationLevel: `${insulationLevel.toFixed(2)} (${insulationLevel === 1.4 ? 'Poor' : insulationLevel === 1.0 ? 'Average' : 'Good'})`,
                          homeShape: `${homeShape.toFixed(2)}`,
                          ceilingHeight: `${ceilingHeight} ft (multiplier: ${(1 + (ceilingHeight - 8) * 0.1).toFixed(2)})`,
                          designTempDiff: `${Math.max(10, Math.abs(70 - designOutdoorTemp))}°F`,
                          baseConstant: `${CONSTANTS.BASE_BTU_PER_SQFT} BTU/sqft (industry standard)`
                        },
                        example: `Heat Loss Factor: ${displayedHeatLossFactor.toLocaleString(undefined, { maximumFractionDigits: 1 })} BTU/hr/°F. At ${designOutdoorTemp}°F: ${displayedHeatLossAtDesign.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr = ${displayedHeatLossFactor.toLocaleString(undefined, { maximumFractionDigits: 1 })} BTU/hr/°F × (${indoorTemp}°F - ${designOutdoorTemp}°F)`
                      };
                    })(),
                  systemOutput: primarySystem === "gasFurnace"
                      ? {
                          source: "Furnace input × AFUE",
                          inputs: {
                            furnaceInput: `${furnaceInput}k BTU/hr`,
                            afue: `${Math.round(afue * 100)}%`,
                            output: `${(furnaceInput * 1000 * afue).toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr`
                          },
                          example: `Constant output at all temperatures: ${systemOutputAtDesign.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr = ${furnaceInput}k BTU/hr × ${Math.round(afue * 100)}% AFUE`
                        }
                      : (userSettings?.useCustomEquipmentProfile && userSettings?.capacity47 && userSettings?.capacity17)
                        ? {
                            source: "Custom equipment profile",
                            inputs: {
                              capacity47: `${userSettings.capacity47.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr @ 47°F`,
                              capacity17: `${userSettings.capacity17.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr @ 17°F`,
                              cop47: `COP: ${userSettings.cop47?.toFixed(2) || 'N/A'} @ 47°F`,
                              cop17: `COP: ${userSettings.cop17?.toFixed(2) || 'N/A'} @ 17°F`,
                              interpolation: "Linear interpolation between data points"
                            },
                            example: `At ${designOutdoorTemp}°F: ${systemOutputAtDesign.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr (interpolated from ${userSettings.capacity47.toLocaleString(undefined, { maximumFractionDigits: 0 })} @ 47°F and ${userSettings.capacity17.toLocaleString(undefined, { maximumFractionDigits: 0 })} @ 17°F)`
                          }
                        : {
                            source: "Generic heat pump derating curve",
                            inputs: {
                              capacity: `${capacity}k BTU (${tons.toFixed(1)} tons)`,
                              hspf2: `${hspf.toFixed(1)}`,
                              deratingFormula: "Capacity factor = 1.0 @ 47°F+, linear derate to 0.64 @ 17°F, then 0.01 per °F below 17°F",
                              baseConstant: `${CONSTANTS.KW_PER_TON_OUTPUT} kW/ton output, ${CONSTANTS.BTU_PER_KWH.toFixed(2)} BTU/kWh`
                            },
                            example: `At 47°F: ~${(tons * CONSTANTS.KW_PER_TON_OUTPUT * CONSTANTS.BTU_PER_KWH).toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr. At ${designOutdoorTemp}°F: ${systemOutputAtDesign.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr (derated)`
                          },
                    balancePoint: balancePoint !== null && isFinite(balancePoint)
                      ? {
                          source: "Modeled balance point",
                          value: `${balancePoint.toFixed(1)}°F`,
                          method: "Where system output equals building heat loss",
                          example: `At ${balancePoint.toFixed(1)}°F, system output = building heat loss = ${(btuLossPerDegF * (indoorTemp - balancePoint)).toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr`,
                          note: "Below this temperature, auxiliary heat is required"
                        }
                      : { 
                          source: "Modeled balance point",
                          note: "Below this temperature, auxiliary heat is required"
                        }
                  }}
                />
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border dark:border-gray-700">
                <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <AlertTriangle className="text-orange-500" />
                  {primarySystem === "gasFurnace"
                    ? "Shortfall (If Undersized)"
                    : "Auxiliary Heat Required"}
                </h2>
                <div
                  className="relative w-full"
                  style={{ paddingBottom: "56.25%" }}
                >
                  <div className="absolute top-0 left-0 w-full h-full">
                    <div className="glass dark:glass-dark rounded-2xl p-3 border border-gray-200 dark:border-gray-800 shadow-lg h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={data}
                          margin={{
                            top: 10,
                            right: window.innerWidth < 640 ? 8 : 24,
                            left: window.innerWidth < 640 ? 8 : 16,
                            bottom: 10,
                          }}
                        >
                          <defs>
                            <linearGradient
                              id="auxHeatGradient"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#f97316"
                                stopOpacity={0.25}
                              />
                              <stop
                                offset="95%"
                                stopColor="#f97316"
                                stopOpacity={0.05}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            stroke="#94a3b8"
                            strokeOpacity={0.2}
                            vertical={false}
                          />
                          <XAxis
                            dataKey="outdoorTemp"
                            label={{
                              value: "Outdoor Temperature (°F)",
                              position: "insideBottom",
                              offset: -5,
                              style: {
                                fontSize: window.innerWidth < 640 ? 10 : 12,
                              },
                            }}
                            type="number"
                            domain={[-10, 70]}
                            tick={{
                              fontSize: window.innerWidth < 640 ? 9 : 12,
                            }}
                          />
                          <YAxis
                            label={{
                              value: "Supplemental Heat (BTU/hr)",
                              angle: -90,
                              position: "insideLeft",
                              style: {
                                fontSize: window.innerWidth < 640 ? 10 : 12,
                              },
                            }}
                            tickFormatter={(value) =>
                              value > 0 ? `${(value / 1000).toFixed(0)}k` : "0"
                            }
                            tick={{
                              fontSize: window.innerWidth < 640 ? 9 : 12,
                            }}
                          />
                          <Tooltip
                            content={
                              <CustomTooltip mode={primarySystem} afue={afue} />
                            }
                          />
                          <Legend
                            wrapperStyle={{
                              fontSize: window.innerWidth < 640 ? 11 : 13,
                              paddingTop: "20px",
                            }}
                          />
                          {balancePoint !== null && isFinite(balancePoint) && (
                            <ReferenceLine
                              x={balancePoint}
                              stroke="#ef4444"
                              strokeDasharray="4 4"
                              label={{
                                value:
                                  primarySystem === "gasFurnace"
                                    ? "Shortfall Begins"
                                    : "Aux Turns On",
                                position: "insideTopRight",
                                style: {
                                  fontSize: window.innerWidth < 640 ? 10 : 12,
                                },
                              }}
                            />
                          )}
                          <Area
                            type="monotone"
                            dataKey="auxHeatBtu"
                            fill="url(#auxHeatGradient)"
                            stroke="none"
                            isAnimationActive
                            animationDuration={800}
                          />
                          <Line
                            type="monotone"
                            dataKey="auxHeatBtu"
                            stroke="#f97316"
                            strokeWidth={3}
                            name={
                              primarySystem === "gasFurnace"
                                ? "Shortfall (BTU/hr)"
                                : "Aux Heat Needed"
                            }
                            dot={false}
                            activeDot={{ r: 5 }}
                            isAnimationActive
                            animationDuration={800}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                  <strong>What this shows:</strong> The positive difference when
                  building heat loss exceeds system output (BTU/hr) at each
                  outdoor temperature. For heat pumps this is auxiliary heat;
                  for furnaces it represents undersizing shortfall.
                </div>
                <DataSourcesDropdown
                  chartName="Auxiliary Heat Required"
                  dataSources={{
                    auxHeat: {
                      source: "Calculated as max(0, Building Heat Loss - System Output)",
                      formula: `Aux Heat = Building Heat Loss - System Output (when positive)`,
                      example: `At ${designOutdoorTemp}°F: ${auxHeatAtDesign > 0 ? auxHeatAtDesign.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"} BTU/hr = ${buildingHeatLossAtDesign.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr - ${systemOutputAtDesign.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr`
                    },
                    buildingHeatLoss: (() => {
                      // Check if analyzer data is usable (measured, not fallback)
                      const analyzerSource = userSettings?.analyzerHeatLossSource || outletContext?.analyzerHeatLossSource;
                      const isMeasured = analyzerSource === 'measured';
                      const isFallbackOrEstimate = effectiveHeatLossFactor && !isMeasured;
                      const shouldUseAnalyzerValue = useAnalyzerData && !isFallbackOrEstimate && isMeasured;
                      
                      // Calculate theoretical heat loss factor for display
                      const designTempDiff = Math.max(10, Math.abs(CONSTANTS.DESIGN_INDOOR_TEMP - designOutdoorTemp));
                      const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
                      const theoreticalHeatLossFactor = (squareFeet * CONSTANTS.BASE_BTU_PER_SQFT * insulationLevel * homeShape * ceilingMultiplier) / designTempDiff;
                      const displayedHeatLossFactor = shouldUseAnalyzerValue ? effectiveHeatLossFactor : theoreticalHeatLossFactor;
                      const displayedHeatLossAtDesign = displayedHeatLossFactor * (indoorTemp - designOutdoorTemp);
                      
                      if (shouldUseAnalyzerValue) {
                        return { 
                          source: "System Performance Analyzer", 
                          value: `${effectiveHeatLossFactor.toLocaleString(undefined, { maximumFractionDigits: 1 })} BTU/hr/°F`,
                          example: `At ${designOutdoorTemp}°F: ${displayedHeatLossAtDesign.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr = ${effectiveHeatLossFactor.toLocaleString(undefined, { maximumFractionDigits: 1 })} BTU/hr/°F × (${indoorTemp}°F - ${designOutdoorTemp}°F)`
                        };
                      }
                      return {
                        source: "Calculated from building characteristics",
                        formula: `Heat Loss = ${displayedHeatLossFactor.toLocaleString(undefined, { maximumFractionDigits: 1 })} BTU/hr/°F × (Indoor Temp - Outdoor Temp)`,
                        example: `At ${designOutdoorTemp}°F: ${displayedHeatLossAtDesign.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr = ${displayedHeatLossFactor.toLocaleString(undefined, { maximumFractionDigits: 1 })} BTU/hr/°F × (${indoorTemp}°F - ${designOutdoorTemp}°F)`
                      };
                    })(),
                    systemOutput: primarySystem === "gasFurnace"
                      ? { 
                          source: "Furnace input × AFUE", 
                          value: `${(furnaceInput * 1000 * afue).toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr constant`,
                          example: `At ${designOutdoorTemp}°F: ${systemOutputAtDesign.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr = ${furnaceInput}k BTU/hr × ${Math.round(afue * 100)}% AFUE`
                        }
                      : { 
                          source: "Heat pump output (derates with temperature)",
                          value: `At ${designOutdoorTemp}°F: ${systemOutputAtDesign.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr`,
                          note: `Output varies with temperature. At 47°F: ~${(tons * CONSTANTS.KW_PER_TON_OUTPUT * CONSTANTS.BTU_PER_KWH).toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr, at ${designOutdoorTemp}°F: ${systemOutputAtDesign.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr`
                        }
                  }}
                />
              </div>
            </div>

            {/* Section 4: Engineering & Simulation Details (Collapsed by default) */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-purple-200 dark:border-purple-800 overflow-hidden mt-8">
              <button
                onClick={() => setShowEngineeringDetails(!showEngineeringDetails)}
                className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                    <Calculator size={24} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Engineering & Simulation Details</h3>
                </div>
                {showEngineeringDetails ? (
                  <ChevronUp className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                ) : (
                  <ChevronDown className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                )}
              </button>
              {showEngineeringDetails && (
                <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700">
                  {/* Disclaimer about instantaneous performance */}
                  <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-6 mb-8 border-2 border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Note:</strong> This page shows <em>instantaneous performance</em> at specific outdoor temperatures. Energy cost forecasts and annual budgets are calculated elsewhere using time-weighted weather data.
                    </p>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-2">
                      <strong>TL;DR:</strong> This page answers <em>capacity</em>, not <em>cost</em>.
                    </p>
                  </div>

                  {/* Additional visualizations: Energy Flow (MJ/h) and Indoor Temperature vs Time */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border dark:border-gray-700">
                <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">
                  Energy Flow vs. Outdoor Temperature (BTU/hr)
                </h2>
                <div
                  className="relative w-full"
                  style={{ paddingBottom: "56.25%" }}
                >
                  <div className="absolute top-0 left-0 w-full h-full">
                    <div className="glass dark:glass-dark rounded-2xl p-3 border border-gray-200 dark:border-gray-800 shadow-lg h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={data}
                          margin={{
                            top: 20,
                            right: window.innerWidth < 640 ? 8 : 24,
                            left: window.innerWidth < 640 ? 8 : 16,
                            bottom: 20,
                          }}
                        >
                          <defs>
                            <linearGradient
                              id="energyFlowGradient"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#3b82f6"
                                stopOpacity={0.2}
                              />
                              <stop
                                offset="95%"
                                stopColor="#06b6d4"
                                stopOpacity={0.05}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            stroke="#94a3b8"
                            strokeOpacity={0.2}
                            vertical={false}
                          />
                          <XAxis
                            dataKey="outdoorTemp"
                            label={{
                              value: "Outdoor Temperature (°F)",
                              position: "insideBottom",
                              offset: -5,
                              style: {
                                fontSize: window.innerWidth < 640 ? 10 : 12,
                              },
                            }}
                            type="number"
                            domain={[-10, 70]}
                            tick={{
                              fontSize: window.innerWidth < 640 ? 9 : 12,
                            }}
                          />
                          <YAxis
                            label={{
                              value: "Energy (BTU/hr)",
                              angle: -90,
                              position: "insideLeft",
                              style: {
                                fontSize: window.innerWidth < 640 ? 10 : 12,
                              },
                            }}
                            tickFormatter={(value) =>
                              `${(value / 1000).toFixed(0)}k`
                            }
                            tick={{
                              fontSize: window.innerWidth < 640 ? 9 : 12,
                            }}
                          />
                          <Tooltip
                            content={
                              <CustomTooltip mode={primarySystem} afue={afue} />
                            }
                          />
                          <Legend
                            wrapperStyle={{
                              fontSize: window.innerWidth < 640 ? 10 : 12,
                              paddingTop: "30px",
                            }}
                            iconSize={window.innerWidth < 640 ? 10 : 14}
                            layout="horizontal"
                            verticalAlign="top"
                            align="center"
                          />
                          <Area
                            type="monotone"
                            dataKey="thermalOutputBtu"
                            fill="url(#energyFlowGradient)"
                            stroke="none"
                            isAnimationActive
                            animationDuration={800}
                          />
                          <Line
                            type="monotone"
                            dataKey="thermalOutputBtu"
                            stroke="#3b82f6"
                            strokeWidth={2.5}
                            name={
                              primarySystem === "gasFurnace"
                                ? "Furnace Output"
                                : "Heat Extracted"
                            }
                            dot={false}
                            activeDot={{ r: 5 }}
                            isAnimationActive
                            animationDuration={800}
                          />
                          <Line
                            type="monotone"
                            dataKey="buildingHeatLossBtu"
                            stroke="#e11d48"
                            strokeWidth={2.5}
                            name="Building Heat Loss"
                            dot={false}
                            activeDot={{ r: 5 }}
                            isAnimationActive
                            animationDuration={800}
                          />
                          {primarySystem !== "gasFurnace" && (
                            <Line
                              type="monotone"
                              dataKey="electricalInputBtu"
                              stroke="#10b981"
                              strokeWidth={2.5}
                              name="Electrical Input"
                              dot={false}
                              activeDot={{ r: 5 }}
                              isAnimationActive
                              animationDuration={800}
                            />
                          )}
                          {balancePoint !== null && isFinite(balancePoint) && (
                            <ReferenceLine
                              x={balancePoint}
                              stroke="#ef4444"
                              strokeWidth={2}
                              label={{
                                value: `${
                                  primarySystem === "gasFurnace"
                                    ? "Coverage"
                                    : "Balance"
                                }: ${balancePoint.toFixed(1)}°F`,
                                position: "insideTopRight",
                                style: {
                                  fontSize: window.innerWidth < 640 ? 10 : 12,
                                },
                              }}
                            />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                  <strong>What this shows:</strong> Energy flows in BTU per hour
                  so heating quantities are directly comparable. Blue is system
                  heat delivered; red is building heat loss.{" "}
                  {primarySystem !== "gasFurnace"
                    ? `Green is electrical input converted to BTU/hr (kW × ${CONSTANTS.BTU_PER_KWH.toFixed(
                        0
                      )}). Heat pumps deliver more thermal energy than electrical input due to COP.`
                    : `For gas furnaces, output is input × AFUE and electrical input is not shown.`}
                </div>
                <DataSourcesDropdown
                  chartName="Energy Flow vs. Outdoor Temperature"
                  dataSources={{
                    thermalOutput: primarySystem === "gasFurnace"
                      ? {
                          source: "Furnace output",
                          formula: "Input × AFUE",
                          value: `${(furnaceInput * 1000 * afue).toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr`,
                          example: `At ${designOutdoorTemp}°F: ${systemOutputAtDesign.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr = ${furnaceInput}k BTU/hr × ${Math.round(afue * 100)}% AFUE (constant at all temps)`
                        }
                      : (userSettings?.useCustomEquipmentProfile && userSettings?.capacity47)
                        ? {
                            source: "Custom equipment profile (interpolated)",
                            note: "See Heat Loss vs. System Output chart for capacity details",
                            example: `At ${designOutdoorTemp}°F: ${systemOutputAtDesign.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr thermal output`
                          }
                        : {
                            source: "Heat pump thermal output",
                            formula: "Tons × Capacity Factor × 3.517 kW/ton × 3412.14 BTU/kWh",
                            constants: {
                              kwPerTon: `${CONSTANTS.KW_PER_TON_OUTPUT} kW/ton`,
                              btuPerKwh: `${CONSTANTS.BTU_PER_KWH.toFixed(2)} BTU/kWh (standard conversion)`
                            },
                            example: `At ${designOutdoorTemp}°F: ${systemOutputAtDesign.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr thermal output (derated from ${(tons * CONSTANTS.KW_PER_TON_OUTPUT * CONSTANTS.BTU_PER_KWH).toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr @ 47°F)`
                          },
                    electricalInput: primarySystem === "gasFurnace"
                      ? { source: "Not shown for gas furnaces" }
                      : (userSettings?.useCustomEquipmentProfile && userSettings?.cop47)
                        ? {
                            source: "Calculated from custom COP profile",
                            formula: "Electrical Input = Thermal Output / COP",
                            note: "COP interpolated from custom profile data points",
                            example: designDataPoint && designDataPoint.electricalKw ? `At ${designOutdoorTemp}°F: ${(designDataPoint.electricalKw * CONSTANTS.BTU_PER_KWH).toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr = ${systemOutputAtDesign.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr ÷ ${designDataPoint.cop?.toFixed(2) || 'N/A'} COP` : `At ${designOutdoorTemp}°F: See chart for electrical input values`
                          }
                        : {
                            source: "Estimated from HSPF2 and capacity",
                            formula: "Electrical Input ≈ Compressor Power × Power Factor",
                            inputs: {
                              compressorPower: `${compressorPower.toFixed(2)} kW (from HSPF2: ${hspf.toFixed(1)})`,
                              powerFactor: "Varies with capacity factor (1.2 - 0.5 × capacity_factor)"
                            },
                            example: designDataPoint && designDataPoint.electricalKw ? `At ${designOutdoorTemp}°F: ${(designDataPoint.electricalKw * CONSTANTS.BTU_PER_KWH).toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr electrical input (${designDataPoint.electricalKw.toFixed(2)} kW)` : `At ${designOutdoorTemp}°F: See chart for electrical input values`
                          },
                    buildingHeatLoss: (() => {
                      // Check if analyzer data is usable (measured, not fallback)
                      const analyzerSource = userSettings?.analyzerHeatLossSource || outletContext?.analyzerHeatLossSource;
                      const isMeasured = analyzerSource === 'measured';
                      const isFallbackOrEstimate = effectiveHeatLossFactor && !isMeasured;
                      const shouldUseAnalyzerValue = useAnalyzerData && !isFallbackOrEstimate && isMeasured;
                      
                      // Calculate theoretical heat loss factor for display
                      const designTempDiff = Math.max(10, Math.abs(CONSTANTS.DESIGN_INDOOR_TEMP - designOutdoorTemp));
                      const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
                      const theoreticalHeatLossFactor = (squareFeet * CONSTANTS.BASE_BTU_PER_SQFT * insulationLevel * homeShape * ceilingMultiplier) / designTempDiff;
                      const displayedHeatLossFactor = shouldUseAnalyzerValue ? effectiveHeatLossFactor : theoreticalHeatLossFactor;
                      const displayedHeatLossAtDesign = displayedHeatLossFactor * (indoorTemp - designOutdoorTemp);
                      
                      if (shouldUseAnalyzerValue) {
                        return { 
                          source: "System Performance Analyzer", 
                          value: `${effectiveHeatLossFactor.toLocaleString(undefined, { maximumFractionDigits: 1 })} BTU/hr/°F`,
                          example: `At ${designOutdoorTemp}°F: ${displayedHeatLossAtDesign.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr = ${effectiveHeatLossFactor.toLocaleString(undefined, { maximumFractionDigits: 1 })} BTU/hr/°F × (${indoorTemp}°F - ${designOutdoorTemp}°F)`
                        };
                      }
                      return {
                        source: "Calculated from building characteristics",
                        value: `${displayedHeatLossFactor.toLocaleString(undefined, { maximumFractionDigits: 1 })} BTU/hr/°F`,
                        example: `At ${designOutdoorTemp}°F: ${displayedHeatLossAtDesign.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr = ${displayedHeatLossFactor.toLocaleString(undefined, { maximumFractionDigits: 1 })} BTU/hr/°F × (${indoorTemp}°F - ${designOutdoorTemp}°F)`
                      };
                    })()
                  }}
                />
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border dark:border-gray-700">
                {/* Header */}
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                    Indoor Temperature vs Time (Current Outdoor)
                  </h2>
                  
                  {/* Modeling Warning */}
                  <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm font-bold text-yellow-800 dark:text-yellow-200">
                      ⚠️ Modeling note:
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      This simulation ignores thermostat cycling and assumes continuous operation.
                      The steady-state temperature is a mathematical artifact, not a real indoor temperature prediction.
                    </p>
                  </div>
                  
                  {/* Controls Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    {/* Simulation Time Control */}
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Simulation Time
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="0"
                          max="48"
                          step="1"
                          value={hoursElapsed}
                          onChange={(e) => setHoursElapsed(Number(e.target.value))}
                          className="flex-1"
                        />
                        <span className="font-bold text-gray-900 dark:text-gray-100 min-w-[4rem] text-right">
                          {hoursElapsed} hrs
                        </span>
                      </div>
                    </div>

                    {/* Current Outdoor Temp Control */}
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Current Outdoor Temperature
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="-10"
                          max="70"
                          value={currentOutdoor}
                          onChange={(e) => {
                            setCurrentOutdoor(Number(e.target.value));
                            setOutdoorTempManuallySet(true);
                          }}
                          className="flex-1"
                        />
                        <div className="flex flex-col items-end min-w-[6rem]">
                          <span className="font-bold text-gray-900 dark:text-gray-100">
                            {currentOutdoor}°F
                          </span>
                          {currentOutdoorTempFromForecast !== null && !outdoorTempManuallySet && (
                            <span className="text-xs text-green-600 dark:text-green-400 font-semibold">
                              ✓ Live from NWS
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Display Options */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Display:
                        </span>
                        <div className="inline-flex bg-gray-100 dark:bg-gray-700 rounded-md p-0.5">
                          <button
                            type="button"
                            onClick={() => setIndoorAuxMode("both")}
                            className={`px-4 py-2 text-sm rounded transition-all ${
                              indoorAuxMode === "both"
                                ? "bg-white dark:bg-gray-600 shadow-sm font-semibold text-gray-900 dark:text-gray-100"
                                : "text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-600/50"
                            }`}
                          >
                            Both
                          </button>
                          <button
                            type="button"
                            onClick={() => setIndoorAuxMode("with")}
                            className={`px-4 py-2 text-sm rounded transition-all ${
                              indoorAuxMode === "with"
                                ? "bg-white dark:bg-gray-600 shadow-sm font-semibold text-gray-900 dark:text-gray-100"
                                : "text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-600/50"
                            }`}
                          >
                            With Aux
                          </button>
                          <button
                            type="button"
                            onClick={() => setIndoorAuxMode("without")}
                            className={`px-4 py-2 text-sm rounded transition-all ${
                              indoorAuxMode === "without"
                                ? "bg-white dark:bg-gray-600 shadow-sm font-semibold text-gray-900 dark:text-gray-100"
                                : "text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-600/50"
                            }`}
                          >
                            Without Aux
                          </button>
                        </div>
                        {indoorAuxMode !== "both" && (
                          <span className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-sm text-blue-700 dark:text-blue-300 font-medium">
                            Showing: {indoorAuxMode === "with" ? "With Aux" : "Without Aux"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        <strong className="text-gray-700 dark:text-gray-300">Display Options:</strong>{" "}
                        <span className="text-blue-600 dark:text-blue-400 font-medium">"With Aux"</span> shows an idealized auxiliary-heated response that maintains target temperature.{" "}
                        <span className="text-orange-600 dark:text-orange-400 font-medium">"Without Aux"</span> shows heat-pump-only response, which may drop below target in extreme cold.{" "}
                        <span className="text-purple-600 dark:text-purple-400 font-medium">"Both"</span> overlays both series for comparison.
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  className="relative w-full"
                  style={{ paddingBottom: "56.25%" }}
                >
                  <div className="absolute top-0 left-0 w-full h-full">
                    <div className="glass dark:glass-dark rounded-2xl p-3 border border-gray-200 dark:border-gray-800 shadow-lg h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={indoorTimeSeries}
                          margin={{
                            top: 10,
                            right: window.innerWidth < 640 ? 8 : 24,
                            left: window.innerWidth < 640 ? 8 : 16,
                            bottom: 10,
                          }}
                        >
                          <defs>
                            <linearGradient
                              id="indoorNoAuxGradient"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#2563eb"
                                stopOpacity={0.2}
                              />
                              <stop
                                offset="95%"
                                stopColor="#2563eb"
                                stopOpacity={0.05}
                              />
                            </linearGradient>
                            <linearGradient
                              id="indoorWithAuxGradient"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#f97316"
                                stopOpacity={0.2}
                              />
                              <stop
                                offset="95%"
                                stopColor="#f97316"
                                stopOpacity={0.05}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            stroke="#94a3b8"
                            strokeOpacity={0.2}
                            vertical={false}
                          />
                          <XAxis
                            dataKey="time"
                            label={{
                              value: "Hours",
                              position: "insideBottom",
                              offset: -5,
                              style: {
                                fontSize: window.innerWidth < 640 ? 10 : 12,
                              },
                            }}
                            tick={{
                              fontSize: window.innerWidth < 640 ? 9 : 12,
                            }}
                          />
                          <YAxis
                            label={{
                              value: "Indoor Temp (°F)",
                              angle: -90,
                              position: "insideLeft",
                              style: {
                                fontSize: window.innerWidth < 640 ? 10 : 12,
                              },
                            }}
                            domain={[
                              Math.min(indoorTemp - 10, 30),
                              Math.max(indoorTemp + 10, 90),
                            ]}
                            tick={{
                              fontSize: window.innerWidth < 640 ? 9 : 12,
                            }}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload || !payload.length)
                                return null;
                              return (
                                <div className="rounded-xl px-3 py-2 bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 shadow-xl">
                                  <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                                    Hour {payload[0]?.payload?.time}
                                  </div>
                                  {payload.map((entry, idx) => (
                                    <div
                                      key={idx}
                                      className="text-sm font-bold"
                                      style={{ color: entry.color }}
                                    >
                                      {entry.name}:{" "}
                                      {typeof entry.value === "number"
                                        ? `${entry.value.toFixed(2)}°F`
                                        : entry.value}
                                    </div>
                                  ))}
                                </div>
                              );
                            }}
                          />
                          {indoorAuxMode === "both" ? (
                            <Legend
                              wrapperStyle={{
                                fontSize: window.innerWidth < 640 ? 11 : 13,
                                paddingTop: "20px",
                              }}
                            />
                          ) : null}
                          {(indoorAuxMode === "both" ||
                            indoorAuxMode === "without") && (
                            <>
                              <Area
                                type="monotone"
                                dataKey="T_noAux"
                                fill="url(#indoorNoAuxGradient)"
                                stroke="none"
                                isAnimationActive
                                animationDuration={800}
                              />
                              <Line
                                type="monotone"
                                dataKey="T_noAux"
                                stroke="#2563eb"
                                strokeWidth={2.5}
                                name="No Aux"
                                dot={false}
                                activeDot={{ r: 5 }}
                                isAnimationActive
                                animationDuration={800}
                              />
                            </>
                          )}
                          {(indoorAuxMode === "both" ||
                            indoorAuxMode === "with") && (
                            <>
                              <Area
                                type="monotone"
                                dataKey="T_withAux"
                                fill="url(#indoorWithAuxGradient)"
                                stroke="none"
                                isAnimationActive
                                animationDuration={800}
                              />
                              <Line
                                type="monotone"
                                dataKey="T_withAux"
                                stroke="#f97316"
                                strokeWidth={2.5}
                                name="With Aux"
                                dot={false}
                                activeDot={{ r: 5 }}
                                isAnimationActive
                                animationDuration={800}
                              />
                            </>
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                  <strong>What this shows:</strong> Time evolution of indoor
                  temperature starting from your target indoor temperature. "No
                  Aux" simulates the heat pump only. "With Aux" allows idealized
                  auxiliary heat to cover any deficit instantly. The simulation
                  uses a simple lumped-capacitance model (thermal capacitance ≈
                  max(2000, sqft×5) BTU/°F) and an exponential approach to the
                  steady-state temperature; it's intended for qualitative
                  insight rather than precise transient building simulation.
                </div>
                <DataSourcesDropdown
                  chartName="Indoor Temperature vs Time"
                  dataSources={{
                    thermalCapacitance: {
                      source: "Estimated building thermal mass",
                      formula: "max(2000, Square Feet × 5) BTU/°F",
                      value: `${Math.max(2000, squareFeet * 5).toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/°F`,
                      example: `C = max(2000, ${squareFeet.toLocaleString()} × 5) = ${Math.max(2000, squareFeet * 5).toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/°F`,
                      note: "Simplified lumped-capacitance model"
                    },
                    heatLossFactor: (() => {
                      // Check if analyzer data is usable (measured, not fallback)
                      const analyzerSource = userSettings?.analyzerHeatLossSource || outletContext?.analyzerHeatLossSource;
                      const isMeasured = analyzerSource === 'measured';
                      const isFallbackOrEstimate = effectiveHeatLossFactor && !isMeasured;
                      const shouldUseAnalyzerValue = useAnalyzerData && !isFallbackOrEstimate && isMeasured;
                      
                      // Calculate theoretical heat loss factor for display
                      const designTempDiff = Math.max(10, Math.abs(CONSTANTS.DESIGN_INDOOR_TEMP - designOutdoorTemp));
                      const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
                      const theoreticalHeatLossFactor = (squareFeet * CONSTANTS.BASE_BTU_PER_SQFT * insulationLevel * homeShape * ceilingMultiplier) / designTempDiff;
                      const displayedHeatLossFactor = shouldUseAnalyzerValue ? effectiveHeatLossFactor : theoreticalHeatLossFactor;
                      
                      if (shouldUseAnalyzerValue) {
                        return { 
                          source: "System Performance Analyzer", 
                          value: `${effectiveHeatLossFactor.toLocaleString(undefined, { maximumFractionDigits: 1 })} BTU/hr/°F`,
                          example: `H = ${effectiveHeatLossFactor.toLocaleString(undefined, { maximumFractionDigits: 1 })} BTU/hr/°F`
                        };
                      }
                      return {
                        source: "Calculated from building characteristics",
                        value: `${displayedHeatLossFactor.toLocaleString(undefined, { maximumFractionDigits: 1 })} BTU/hr/°F`,
                        example: `H = ${displayedHeatLossFactor.toLocaleString(undefined, { maximumFractionDigits: 1 })} BTU/hr/°F`
                      };
                    })(),
                    systemOutput: (() => {
                      // Calculate system output at current outdoor temp
                      let outputAtCurrent = 0;
                      if (primarySystem === "gasFurnace") {
                        outputAtCurrent = furnaceInput * 1000 * afue;
                      } else {
                        let capacityFactor;
                        if (currentOutdoor >= 47) capacityFactor = 1.0;
                        else if (currentOutdoor >= 17) capacityFactor = 1.0 - (47 - currentOutdoor) * 0.012;
                        else capacityFactor = 0.64 - (17 - currentOutdoor) * 0.01;
                        capacityFactor = Math.max(CONSTANTS.MIN_CAPACITY_FACTOR, capacityFactor);
                        const thermalOutputKw = tons * CONSTANTS.KW_PER_TON_OUTPUT * capacityFactor;
                        outputAtCurrent = thermalOutputKw * CONSTANTS.BTU_PER_KWH;
                      }
                      const lossAtCurrent = btuLossPerDegF * (indoorTemp - currentOutdoor);
                      const auxNeededAtCurrent = Math.max(0, lossAtCurrent - outputAtCurrent);
                      const totalHeatAtCurrent = outputAtCurrent + auxNeededAtCurrent;
                      const steadyStateTemp = currentOutdoor + (totalHeatAtCurrent / Math.max(0.1, btuLossPerDegF));
                      
                      return {
                        source: primarySystem === "gasFurnace" ? "Furnace output (constant)" : "Heat pump output at current outdoor temp",
                        value: primarySystem === "gasFurnace"
                          ? `${outputAtCurrent.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr`
                          : `${outputAtCurrent.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr @ ${currentOutdoor}°F`,
                        example: primarySystem === "gasFurnace"
                          ? `Constant: ${outputAtCurrent.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr at all temperatures`
                          : `At ${currentOutdoor}°F: ${outputAtCurrent.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr (derated from ${(tons * CONSTANTS.KW_PER_TON_OUTPUT * CONSTANTS.BTU_PER_KWH).toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr @ 47°F)`,
                        note: primarySystem === "gasFurnace" ? "Constant output" : "Derates in colder temperatures"
                      };
                    })(),
                    simulationModel: (() => {
                      // Check if analyzer data is usable (measured, not fallback)
                      const analyzerSource = userSettings?.analyzerHeatLossSource || outletContext?.analyzerHeatLossSource;
                      const isMeasured = analyzerSource === 'measured';
                      const isFallbackOrEstimate = effectiveHeatLossFactor && !isMeasured;
                      const shouldUseAnalyzerValue = useAnalyzerData && !isFallbackOrEstimate && isMeasured;
                      
                      // Calculate theoretical heat loss factor for display
                      const designTempDiff = Math.max(10, Math.abs(CONSTANTS.DESIGN_INDOOR_TEMP - designOutdoorTemp));
                      const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
                      const theoreticalHeatLossFactor = (squareFeet * CONSTANTS.BASE_BTU_PER_SQFT * insulationLevel * homeShape * ceilingMultiplier) / designTempDiff;
                      const displayedHeatLossFactor = shouldUseAnalyzerValue ? effectiveHeatLossFactor : theoreticalHeatLossFactor;
                      
                      const C = Math.max(2000, squareFeet * 5);
                      const k = displayedHeatLossFactor / C;
                      let outputAtCurrent = 0;
                      if (primarySystem === "gasFurnace") {
                        outputAtCurrent = furnaceInput * 1000 * afue;
                      } else {
                        let capacityFactor;
                        if (currentOutdoor >= 47) capacityFactor = 1.0;
                        else if (currentOutdoor >= 17) capacityFactor = 1.0 - (47 - currentOutdoor) * 0.012;
                        else capacityFactor = 0.64 - (17 - currentOutdoor) * 0.01;
                        capacityFactor = Math.max(CONSTANTS.MIN_CAPACITY_FACTOR, capacityFactor);
                        const thermalOutputKw = tons * CONSTANTS.KW_PER_TON_OUTPUT * capacityFactor;
                        outputAtCurrent = thermalOutputKw * CONSTANTS.BTU_PER_KWH;
                      }
                      const lossAtCurrent = displayedHeatLossFactor * (indoorTemp - currentOutdoor);
                      const auxNeededAtCurrent = Math.max(0, lossAtCurrent - outputAtCurrent);
                      // Steady state uses ACTUAL available output, not total (which includes aux)
                      // This shows what temp the system can maintain WITHOUT aux heat
                      const steadyStateTemp = currentOutdoor + (outputAtCurrent / Math.max(0.1, displayedHeatLossFactor));
                      
                      return {
                        source: "Exponential approach to steady-state",
                        formula: "T(t) = T_ss + (T_initial - T_ss) × exp(-k × t)",
                        inputs: {
                          timeConstant: `k = H / C = ${displayedHeatLossFactor.toFixed(1)} / ${C.toFixed(0)} = ${k.toFixed(4)} hr⁻¹`,
                          steadyState: `T_ss = ${currentOutdoor}°F + (${outputAtCurrent.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr available / ${displayedHeatLossFactor.toFixed(1)} BTU/hr/°F) = ${steadyStateTemp.toFixed(1)}°F (WITHOUT aux heat)`
                        },
                        example: `Starting at ${indoorTemp}°F, approaches ${steadyStateTemp.toFixed(1)}°F steady-state (NOT ${indoorTemp}°F!) because available heat (${outputAtCurrent.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr) is less than required (${lossAtCurrent.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr). Time constant: ${k.toFixed(4)} hr⁻¹`,
                        note: "Qualitative model, not precise building simulation. Steady-state is what system can maintain WITHOUT auxiliary heat."
                      };
                    })(),
                    currentOutdoor: {
                      source: "User-selected outdoor temperature",
                      value: `${currentOutdoor}°F`
                    },
                    targetIndoor: {
                      source: "User-selected target indoor temperature",
                      value: `${indoorTemp}°F`
                    }
                  }}
                />
              </div>
            </div>
                  </div>
              )}
            </div>

            {/* Live Math Calculations Pulldown - Always at the bottom */}
            {primarySystem === "heatPump" && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden mt-8">
            <button
              onClick={() => setShowCalculations(!showCalculations)}
              className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                  <Calculator size={24} className="text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">View Calculation Methodology</h3>
              </div>
              {showCalculations ? (
                <ChevronUp className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              ) : (
                <ChevronDown className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              )}
            </button>

            {showCalculations && (() => {
              // Check if analyzer data is from measured coast-down or fallback/estimate
              const analyzerSource = userSettings?.analyzerHeatLossSource || outletContext?.analyzerHeatLossSource;
              const isMeasured = analyzerSource === 'measured';
              const isFallbackOrEstimate = effectiveHeatLossFactor && !isMeasured;
              const isUsingMeasuredAnalyzerData = useAnalyzerData && effectiveHeatLossFactor && isMeasured;
              // Calculate the value to show: use analyzer value only if checkbox is enabled and data is measured
              const shouldShowAnalyzerValue = useAnalyzerData && !isFallbackOrEstimate && isMeasured;
              // Calculate theoretical value for display
              const designTempDiff = Math.max(10, Math.abs(70 - designOutdoorTemp));
              const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
              const theoreticalHeatLoss = (squareFeet * CONSTANTS.BASE_BTU_PER_SQFT * insulationLevel * homeShape * ceilingMultiplier) / designTempDiff;
              // Show analyzer value only if it's being used and measured, otherwise show calculated value
              const displayedValue = shouldShowAnalyzerValue ? effectiveHeatLossFactor : theoreticalHeatLoss;
              
              return (
                <div className="px-6 pb-6 space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
                  <div>
                    <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Balance Point Calculation</h4>
                    <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                      Building Heat Loss Factor: <strong>{displayedValue.toLocaleString(undefined, { maximumFractionDigits: 1 })} BTU/hr per °F</strong><br />
                      {isUsingMeasuredAnalyzerData ? (
                        <>
                          <span className="text-green-400">Source: Measured from System Performance Analyzer (Ecobee runtime data)</span><br />
                          <span className="text-gray-500">
                            Theoretical Baseline: ({squareFeet.toLocaleString()} sq ft * {CONSTANTS.BASE_BTU_PER_SQFT} BTU/sqft * {insulationLevel.toFixed(2)} insulation * {homeShape.toFixed(2)} home shape * {ceilingMultiplier.toFixed(2)} ceiling) / {designTempDiff.toFixed(0)}°F = <strong>{theoreticalHeatLoss.toLocaleString(undefined, { maximumFractionDigits: 1 })} BTU/hr/°F</strong>
                          </span>
                        </>
                      ) : (
                        <>
                          = ({squareFeet.toLocaleString()} sq ft * {CONSTANTS.BASE_BTU_PER_SQFT} BTU/sqft * {insulationLevel.toFixed(2)} insulation * {homeShape.toFixed(2)} home shape * {ceilingMultiplier.toFixed(2)} ceiling) / {designTempDiff.toFixed(0)}°F design temp<br />
                        </>
                      )}
                    <br />
                    System Capacity: <strong>{capacity}k BTU ({tons.toFixed(1)} tons)</strong><br />
                    HSPF2 Rating: <strong>{hspf.toFixed(1)}</strong><br />
                    Target Indoor Temperature: <strong>{indoorTemp}°F</strong><br />
                    Design Outdoor Temperature: <strong>{designOutdoorTemp}°F</strong><br />
                    <br />
                    {balancePoint !== null && isFinite(balancePoint) ? (
                      <>
                        Balance Point: <strong>{balancePoint.toFixed(1)}°F</strong><br />
                        Found where heat pump output equals building heat loss<br />
                        At {balancePoint.toFixed(1)}°F: HP Output = Building Heat Loss
                      </>
                    ) : (
                      <>
                        Balance Point: Below design temperature ({designOutdoorTemp}°F) or above 60°F<br />
                        System can handle all temperatures down to {designOutdoorTemp}°F without auxiliary heat
                      </>
                    )}
                    {summaryStats && (
                      <>
                        <br />
                        <br />
                        Max System Output: <strong>{summaryStats.maxOutput > 0 && Number.isFinite(summaryStats.maxOutput) ? (summaryStats.maxOutput / 1000).toFixed(1) + "k" : "0"} BTU/hr</strong><br />
                        Shortfall @ {designOutdoorTemp}°F: <strong>{summaryStats.shortfallAtDesign > 0 && Number.isFinite(summaryStats.shortfallAtDesign) ? (summaryStats.shortfallAtDesign / 1000).toFixed(1) + "k" : "0"} BTU/hr</strong><br />
                        Efficiency (COP) @ {designOutdoorTemp}°F: <strong>{Number.isFinite(summaryStats.copAtDesign) ? summaryStats.copAtDesign.toFixed(2) : "N/A"}</strong>
                      </>
                    )}
                  </code>
                </div>
              </div>
              );
            })()}
          </div>
        )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HeatPumpEnergyFlow;

