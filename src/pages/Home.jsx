import React, { useMemo, useState, useEffect, useRef } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Home,
  Calendar,
  TrendingUp,
  Activity,
  Zap,
  BarChart3,
  Info,
  X,
  Lightbulb,
  Settings as SettingsIcon,
  CheckCircle2,
  Flame,
  Snowflake,
  Fan,
  Circle,
  Cpu,
  Sparkles,
  AlertCircle,
  Clock,
  XCircle,
  ChevronRight,
  Wifi,
  ArrowRight,
  AlertTriangle,
  ThermometerSun,
  DollarSign,
} from "lucide-react";
import AskJoule from "../components/AskJoule";
import HomeTopSection from "../components/HomeTopSection";
import DemoModeBanner from "../components/DemoModeBanner";
import SystemHealthAlerts from "../components/SystemHealthAlerts";
import { useDemoMode } from "../hooks/useDemoMode";
import { useJouleBridgeContext } from "../contexts/JouleBridgeContext";
import AutoSettingsMathEquations from "../components/AutoSettingsMathEquations";
import { EBAY_STORE_URL } from "../utils/rag/salesFAQ";
import {
  getAnnualHDD,
  getAnnualCDD,
  calculateAnnualHeatingCostFromHDD,
  calculateAnnualCoolingCostFromCDD,
} from "../lib/hddData";
import { calculateBalancePoint } from "../utils/balancePointCalculator";
import computeAnnualPrecisionEstimate from "../lib/fullPrecisionEstimate";
import { getRecentlyViewed, removeFromRecentlyViewed } from "../utils/recentlyViewed";
import * as heatUtils from "../lib/heatUtils";
import { routes } from "../navConfig";
import { getCached, getCachedBatch } from "../utils/cachedStorage";

const currency = (v) => `$${(v ?? 0).toFixed(2)}`;

// Stable empty object for outlet context fallback to prevent unnecessary re-renders
const EMPTY_OUTLET = {};

const HomeDashboard = () => {
  // Mouse position for glassmorphic glow effect
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const toolsSectionRef = useRef(null);

  // Track mouse position for glassmorphic glow (relative to tools section)
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (toolsSectionRef.current) {
        const rect = toolsSectionRef.current.getBoundingClientRect();
        setMousePosition({ 
          x: e.clientX - rect.left, 
          y: e.clientY - rect.top 
        });
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Optimized: Batch load all localStorage values in a single pass using cached storage
  // This reduces redundant localStorage reads from 5+ to a single batch operation
  const cachedData = useMemo(() => {
    const activeZoneId = getCached("activeZoneId", "zone1");
    const zoneKey = `spa_resultsHistory_${activeZoneId}`;
    
    // Batch read all needed keys at once
    const batch = getCachedBatch([
      "last_forecast_summary",
      zoneKey,
      "spa_resultsHistory",
      "userLocation",
      "activeZoneId"
    ]);
    
    return batch;
  }, []);

  const lastForecast = useMemo(
    () => cachedData["last_forecast_summary"] || null,
    [cachedData]
  );

  // Multi-zone support: Check active zone or all zones
  const resultsHistory = useMemo(() => {
    const activeZoneId = cachedData["activeZoneId"] || "zone1";
    const zoneKey = `spa_resultsHistory_${activeZoneId}`;
    const zoneHistory = cachedData[zoneKey];
    
    if (zoneHistory && Array.isArray(zoneHistory) && zoneHistory.length > 0) {
      return zoneHistory;
    }
    // Fallback to legacy single-zone storage
    return cachedData["spa_resultsHistory"] || [];
  }, [cachedData]);

  const latestAnalysis =
    resultsHistory && resultsHistory.length > 0
      ? resultsHistory[resultsHistory.length - 1]
      : null;
  const userLocation = useMemo(() => cachedData["userLocation"] || null, [cachedData]);

  // Retrieve outlet context (routing state). Memoized to provide stable reference for useMemo dependencies.
  const outletContext = useOutletContext();
  const outlet = useMemo(() => outletContext || EMPTY_OUTLET, [outletContext]);
  // Support both new userSettings shape and legacy direct setters
  const { userSettings: ctxUserSettings } = outlet;
  const userSettings = React.useMemo(() => {
    return (
      ctxUserSettings ||
      (typeof outlet.primarySystem !== "undefined" ? { ...outlet } : {})
    );
  }, [ctxUserSettings, outlet]);
  const globalHomeElevation =
    typeof userSettings?.homeElevation === "number"
      ? userSettings.homeElevation
      : typeof outlet.homeElevation === "number"
      ? outlet.homeElevation
      : userLocation && typeof userLocation.elevation === "number"
      ? userLocation.elevation
      : undefined;
  const [precisionEstimate, setPrecisionEstimate] = React.useState(null);
  const [precisionLoading, setPrecisionLoading] = React.useState(false);
  const [precisionError, setPrecisionError] = React.useState(null);

  // Memoize settings object to avoid hook dependency churn warnings
  const settings = React.useMemo(() => userSettings || {}, [userSettings]);

  // Mission Control Center State
  // Joule Bridge integration - use shared context (persists across navigation)
  const jouleBridge = useJouleBridgeContext();
  const bridgeAvailable = jouleBridge.bridgeAvailable;
  
  // Use Joule Bridge temperature if available, otherwise use simulated
  const [simulatedCurrentTemp, setSimulatedCurrentTemp] = useState(72);
  const currentTemp = bridgeAvailable && jouleBridge.connected && jouleBridge.temperature !== null
    ? jouleBridge.temperature
    : simulatedCurrentTemp;
  
  // Initialize systemStatus from localStorage or default to "HEAT ON"
  const [systemStatus, setSystemStatus] = useState(() => {
    try {
      const savedMode = localStorage.getItem("hvacMode") || "heat";
      const modeLabels = {
        heat: "HEAT ON",
        cool: "COOL ON",
        auto: "AUTO ON",
        off: "SYSTEM OFF",
      };
      return modeLabels[savedMode] || "HEAT ON";
    } catch {
      return "HEAT ON";
    }
  });
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showOptimizeModal, setShowOptimizeModal] = useState(false);
  const [optimizationResults, setOptimizationResults] = useState(null);
  const [eventLog, setEventLog] = useState([
    { 
      time: "10:30 AM", 
      message: "Short cycle prevented", 
      type: "info", 
      icon: "⚡",
      details: "Saved ~$0.15 in energy waste by preventing rapid on/off cycling",
      expanded: false
    },
    { 
      time: "10:15 AM", 
      message: "Heat pump locked out - outdoor temp 32°F", 
      type: "warning", 
      icon: "⚠️",
      details: "Switched to aux heat (balance point: 41°F). Heat pump efficiency drops below threshold.",
      expanded: false
    },
    { 
      time: "10:00 AM", 
      message: "System check passed", 
      type: "success", 
      icon: "✓",
      details: "All parameters within optimal range. System operating efficiently.",
      expanded: false
    },
  ]);
  const [outdoorTemp, setOutdoorTemp] = useState(32); // Simulated outdoor temp
  const eventLogRef = useRef(null);
  const navigate = useNavigate();
  // Optimized: Use cached storage for banner state
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    return getCached('demoBannerDismissed', false) === true || 
           getCached('demoBannerDismissed', 'false') === 'true';
  });
  
  // Recently viewed pages state
  const [recentlyViewed, setRecentlyViewed] = useState(() => {
    try {
      return getRecentlyViewed();
    } catch {
      return [];
    }
  });

  // Listen for updates to recently viewed
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        setRecentlyViewed(getRecentlyViewed());
      } catch {
        setRecentlyViewed([]);
      }
    };

    // Listen for custom event from recentlyViewed utils
    window.addEventListener('recentlyViewedUpdated', handleStorageChange);
    // Also listen for storage events (cross-tab updates)
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('recentlyViewedUpdated', handleStorageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Listen for HVAC mode changes from Ask Joule commands
  useEffect(() => {
    const handleHvacModeChange = (event) => {
      const newMode = event.detail?.mode;
      if (newMode && ["heat", "cool", "auto", "off"].includes(newMode)) {
        const modeLabels = {
          heat: "HEAT ON",
          cool: "COOL ON",
          auto: "AUTO ON",
          off: "SYSTEM OFF",
        };
        setSystemStatus(modeLabels[newMode] || "HEAT ON");
      }
    };

    window.addEventListener("hvacModeChanged", handleHvacModeChange);
    return () => {
      window.removeEventListener("hvacModeChanged", handleHvacModeChange);
    };
  }, []);

  // Listen for target temperature changes from Ask Joule commands
  // Force re-render of target temperature display
  const [targetTempUpdate, setTargetTempUpdate] = useState(0);
  useEffect(() => {
    const handleTargetTempChange = (event) => {
      const newTemp = event.detail?.temp || event.detail?.temperature;
      if (typeof newTemp === "number") {
        // Update thermostatState if not already updated
        try {
          const currentState = JSON.parse(
            localStorage.getItem("thermostatState") || '{"targetTemp": 70, "mode": "heat", "preset": "home"}'
          );
          currentState.targetTemp = newTemp;
          localStorage.setItem("thermostatState", JSON.stringify(currentState));
        } catch (error) {
          console.warn("[Home] Failed to update thermostatState:", error);
        }
        // Force re-render by updating state
        setTargetTempUpdate(prev => prev + 1);
      }
    };

    window.addEventListener("targetTempChanged", handleTargetTempChange);
    return () => {
      window.removeEventListener("targetTempChanged", handleTargetTempChange);
    };
  }, []);

  // Compute target temperature reactively
  const targetTemp = useMemo(() => {
    // targetTempUpdate dependency forces recomputation when event fires
    let temp = null;
    
    // Priority 1: Use Joule Bridge data when demo mode is disabled and bridge is connected
    const demoModeDisabled = localStorage.getItem("demoModeDisabled") === "true";
    if (demoModeDisabled && bridgeAvailable && jouleBridge.connected) {
      const bridgeTarget = jouleBridge.targetTemperature;
      if (bridgeTarget !== null && bridgeTarget !== undefined) {
        return bridgeTarget;
      }
    }
    
    // Priority 2: localStorage thermostatState
    try {
      const thermostatState = localStorage.getItem('thermostatState');
      if (thermostatState) {
        const state = JSON.parse(thermostatState);
        if (typeof state.targetTemp === 'number') {
          temp = state.targetTemp;
        }
      }
    } catch {
      // Ignore localStorage errors
    }
    
    // Fallback to settings if no thermostat state
    if (temp === null) {
      // Use winter or summer thermostat based on current mode
      if (systemStatus === "COOL ON" || systemStatus === "AUTO ON") {
        temp = settings?.summerThermostat || null;
      } else {
        temp = settings?.winterThermostat || null;
      }
    }
    
    return temp;
  }, [targetTempUpdate, systemStatus, settings?.winterThermostat, settings?.summerThermostat, bridgeAvailable, jouleBridge.connected, jouleBridge.targetTemperature]);
  
  // Demo mode hook
  const { isDemo, demoData, proAccess } = useDemoMode();

  // Simulate temperature changes (only if not using Joule Bridge)
  useEffect(() => {
    if (bridgeAvailable && jouleBridge.connected) {
      // Don't simulate if we have real data
      return;
    }
    const interval = setInterval(() => {
      setSimulatedCurrentTemp((prev) => {
        const change = (Math.random() - 0.5) * 0.5;
        return Math.max(68, Math.min(76, prev + change));
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [bridgeAvailable, jouleBridge.connected]);

  // Auto-scroll event log
  useEffect(() => {
    if (eventLogRef.current) {
      eventLogRef.current.scrollTop = 0;
    }
  }, [eventLog]);

  // Generate sparkline data (last 4 hours, 48 points)
  const sparklineData = useMemo(() => {
    const data = [];
    const baseTemp = currentTemp;
    for (let i = 47; i >= 0; i--) {
      const variance = (Math.sin(i / 8) + Math.random() * 0.3) * 1.5;
      data.push(baseTemp + variance);
    }
    return data;
  }, [currentTemp]);

  const handleOptimize = async () => {
    setIsOptimizing(true);
    setTimeout(() => {
      setIsOptimizing(false);
      setOptimizationResults({
        inefficiencies: 3,
        savings: 42,
        fixes: [
          "Lockout temperature set too high",
          "Short cycle protection disabled",
          "Aux heat threshold needs adjustment",
        ],
      });
      setShowOptimizeModal(true);
      
      // Calculate optimized setpoints based on recommendation (68°F day / 66°F night)
      const currentWinter = settings.winterThermostat || 70;
      const optimizedDay = Math.max(68, currentWinter - 2); // 68°F day
      const optimizedNight = Math.max(66, optimizedDay - 2); // 66°F night
      
      // Determine current time and which setpoint to apply
      const now = new Date();
      const currentHour = now.getHours();
      const isNighttime = currentHour >= 22 || currentHour < 6;
      const targetSetpoint = isNighttime ? optimizedNight : optimizedDay;
      
      // Save optimizer schedule to localStorage so verdict can detect it
      try {
        const optimizedSchedule = {
          blocks: [
            { start: "00:00", end: "06:00", setpoint: optimizedNight },
            { start: "06:00", end: "22:00", setpoint: optimizedDay },
            { start: "22:00", end: "24:00", setpoint: optimizedNight },
          ],
          appliedAt: new Date().toISOString(),
        };
        localStorage.setItem("optimizerSchedule", JSON.stringify(optimizedSchedule));
        localStorage.setItem("optimizerScheduleAppliedAt", new Date().toISOString());
        
        // Update actual thermostat target temperature
        // Update userSettings.winterThermostat (used by Control page)
        try {
          // Try outlet.setUserSetting first (if available)
          if (outlet?.setUserSetting) {
            outlet.setUserSetting("winterThermostat", targetSetpoint, {
              source: "Optimizer",
              comment: "Applied optimized schedule",
            });
          } else {
            // Fallback: update directly in localStorage
            const userSettings = JSON.parse(localStorage.getItem("userSettings") || "{}");
            userSettings.winterThermostat = targetSetpoint;
            localStorage.setItem("userSettings", JSON.stringify(userSettings));
          }
        } catch (e) {
          console.warn("Failed to update userSettings:", e);
        }
        
        // Update thermostatState.targetTemp (used by Control page)
        try {
          const thermostatState = JSON.parse(
            localStorage.getItem("thermostatState") || '{"targetTemp": 70, "mode": "heat", "preset": "home"}'
          );
          thermostatState.targetTemp = targetSetpoint;
          localStorage.setItem("thermostatState", JSON.stringify(thermostatState));
          
          // Dispatch event to notify other components
          window.dispatchEvent(new CustomEvent("targetTempChanged", {
            detail: { temp: targetSetpoint, temperature: targetSetpoint, source: "optimizer" }
          }));
        } catch (e) {
          console.warn("Failed to update thermostatState:", e);
        }
      } catch (e) {
        console.warn("Failed to save optimizer schedule:", e);
      }
      
      // Add event to log
      setEventLog((prev) => [
        { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), message: `Applied 3 optimizations. Target set to ${targetSetpoint}°F. Estimated savings: $42/year.`, type: "success", icon: "✅" },
        ...prev,
      ]);
    }, 2000);
  };

  // Debugging hook: log when the detailed precision flag changes to help detect E2E flakiness
  React.useEffect(() => {
    if (import.meta.env.DEV) {
      console.info(
        "Home: useDetailedAnnualEstimate",
        settings.useDetailedAnnualEstimate
      );
    }
  }, [settings.useDetailedAnnualEstimate]);

  // Debug the full settings object when it changes to verify area prop syncing
  React.useEffect(() => {
    if (import.meta.env.DEV) {
      console.info("Home: full settings snapshot", settings);
    }
  }, [settings]);

  const annualEstimate = useMemo(() => {
    const useManualHeatLoss = Boolean(settings?.useManualHeatLoss);
    const useCalculatedHeatLoss = settings?.useCalculatedHeatLoss !== false; // Default to true
    const useAnalyzerHeatLoss = Boolean(settings?.useAnalyzerHeatLoss);
    let heatLossFactor;
    
    // Calculate ceiling multiplier once for use in both heating and cooling calculations
    const ceilingMultiplier = 1 + ((settings.ceilingHeight || 8) - 8) * 0.1;
    
    // Priority 1: Manual Entry (if enabled)
    if (useManualHeatLoss) {
      const manualHeatLossFactor = Number(settings?.manualHeatLoss);
      if (Number.isFinite(manualHeatLossFactor) && manualHeatLossFactor > 0) {
        // manualHeatLoss is already stored as BTU/hr/°F (heat loss factor)
        heatLossFactor = manualHeatLossFactor;
      }
    }
    
    // Priority 2: Analyzer Data from CSV (if enabled and available)
    if (!heatLossFactor && useAnalyzerHeatLoss && latestAnalysis?.heatLossFactor) {
      heatLossFactor = latestAnalysis.heatLossFactor;
    }
    
    // Priority 3: Calculated from Building Characteristics (DoE data)
    if (!heatLossFactor && useCalculatedHeatLoss) {
      const BASE_BTU_PER_SQFT_HEATING = 22.67;
      const effectiveSquareFeet = heatUtils.getEffectiveSquareFeet(
        settings.squareFeet || 1500,
        settings.hasLoft || false,
        settings.homeShape || 1.0
      );
      const designHeatLoss =
        effectiveSquareFeet *
        BASE_BTU_PER_SQFT_HEATING *
        (settings.insulationLevel || 1.0) *
        (settings.homeShape || 1.0) *
        ceilingMultiplier;
      heatLossFactor = designHeatLoss / 70;
    }
    
    // Fallback: Use analyzer data if available (for backwards compatibility)
    if (!heatLossFactor && latestAnalysis?.heatLossFactor) {
      heatLossFactor = latestAnalysis.heatLossFactor;
    }

    if (!userLocation || !heatLossFactor) {
      return null;
    }

    const homeElevation =
      typeof globalHomeElevation === "number"
        ? globalHomeElevation
        : settings.homeElevation ?? 0;
    const elevationMultiplierRaw = 1 + ((homeElevation || 0) / 1000) * 0.005;
    const elevationMultiplier = Math.max(
      0.8,
      Math.min(1.3, elevationMultiplierRaw)
    );

    const winterThermostat = settings.winterThermostat;
    const summerThermostat = settings.summerThermostat;
    const useDetailed = settings.useDetailedAnnualEstimate;

    const annualHDD = getAnnualHDD(
      `${userLocation.city}, ${userLocation.state}`,
      userLocation.state
    );
    const heatingThermostatMultiplier = (winterThermostat || 70) / 70;

    const useElectricAuxHeat = settings.useElectricAuxHeat;
    const annualHeatingCost = calculateAnnualHeatingCostFromHDD(
      annualHDD,
      heatLossFactor,
      settings.hspf2 || 9.0,
      settings.utilityCost || 0.15,
      useElectricAuxHeat
    );
    annualHeatingCost.energy *= heatingThermostatMultiplier;
    annualHeatingCost.cost *= heatingThermostatMultiplier;
    annualHeatingCost.energy *= elevationMultiplier;
    annualHeatingCost.cost *= elevationMultiplier;

    const annualCDD = getAnnualCDD(
      `${userLocation.city}, ${userLocation.state}`,
      userLocation.state
    );
    
    // Heat gain factor derived from heat loss factor with solar exposure multiplier
    // This is a UA-like term (BTU/hr/°F), consistent with heatLossFactor
    // Default range: 1.3-1.8 (unless user explicitly selects "shaded/minimal windows" which allows 1.0-1.2)
    let solarExposureMultiplier = settings.solarExposure || 1.5;
    
    // If it's a percent (>= 1 and <= 100), divide by 100
    if (solarExposureMultiplier >= 1 && solarExposureMultiplier <= 100) {
      solarExposureMultiplier = solarExposureMultiplier / 100;
    }
    
    // Clamp to [1.0, 2.5] range
    // Note: Shaded/minimal windows allows 1.0-1.2, typical range is 1.3-1.8
    solarExposureMultiplier = Math.max(1.0, Math.min(2.5, solarExposureMultiplier));
    
    // Derive heat gain from heat loss: heatGainFactor = heatLossFactor * solarExposureMultiplier
    // This ensures consistency - heat gain is always proportional to heat loss
    const heatGainFactor = heatLossFactor * solarExposureMultiplier;

    const coolingThermostatMultiplier = 74 / (summerThermostat || 74);

    const annualCoolingCost = calculateAnnualCoolingCostFromCDD(
      annualCDD,
      heatGainFactor,
      settings.efficiency || 15.0,
      settings.utilityCost || 0.15
    );
    annualCoolingCost.energy *= coolingThermostatMultiplier;
    annualCoolingCost.cost *= coolingThermostatMultiplier;
    annualCoolingCost.energy *= elevationMultiplier;
    annualCoolingCost.cost *= elevationMultiplier;

    const totalAnnualCost = annualHeatingCost.cost + annualCoolingCost.cost;

    const quickEstimate = {
      totalCost: totalAnnualCost,
      elevationDelta: elevationMultiplier,
      homeElevation: homeElevation,
      heatingCost: annualHeatingCost.cost,
      coolingCost: annualCoolingCost.cost,
      auxKwhIncluded: annualHeatingCost.auxKwhIncluded || 0,
      auxKwhExcluded: annualHeatingCost.auxKwhExcluded || 0,
      hdd: annualHDD,
      cdd: annualCDD,
      isEstimated: !latestAnalysis?.heatLossFactor,
      method: useDetailed ? "detailed" : "quick",
      winterThermostat: winterThermostat,
      summerThermostat: summerThermostat,
    };

    if (useDetailed && precisionEstimate) {
      return {
        ...quickEstimate,
        totalCost: precisionEstimate.totalCost,
        heatingCost: precisionEstimate.heatingCost,
        coolingCost: precisionEstimate.coolingCost,
        totalEnergy: precisionEstimate.totalEnergy,
        totalAux: precisionEstimate.totalAux,
        method: "fullPrecision",
      };
    }

    return quickEstimate;
  }, [
    latestAnalysis,
    userLocation,
    // --- FIX: ADD ALL SETTINGS FROM CONTEXT TO THE DEPENDENCY ARRAY ---
    settings.squareFeet,
    settings.insulationLevel,
    settings.homeShape,
    settings.ceilingHeight,
    settings.utilityCost,
    settings.homeElevation,
    settings.hspf2,
    settings.efficiency,
    settings.solarExposure,
    settings.useElectricAuxHeat,
    settings.winterThermostat,
    settings.summerThermostat,
    settings.useDetailedAnnualEstimate,
    settings.useManualHeatLoss,
    settings.useCalculatedHeatLoss,
    settings.useAnalyzerHeatLoss,
    settings.manualHeatLoss,
    precisionEstimate,
    globalHomeElevation, // Also add the global elevation
  ]);

  React.useEffect(() => {
    let mounted = true;
    async function runPrecision() {
      if (!settings.useDetailedAnnualEstimate || !userLocation) {
        setPrecisionEstimate(null);
        return;
      }
      try {
        setPrecisionLoading(true);
        setPrecisionError(null);
        const res = await computeAnnualPrecisionEstimate(settings, {
          monthlyProfile: optionsMonthlyProfileFromUserLocation(userLocation),
        });
        if (mounted) {
          setPrecisionEstimate(res);
        }
      } catch (error) {
        console.warn("computeAnnualPrecisionEstimate failed", error);
        if (mounted) setPrecisionError("Failed to compute detailed estimate.");
      } finally {
        if (mounted) setPrecisionLoading(false);
      }
    }
    runPrecision();
    return () => {
      mounted = false;
    };
  }, [
    settings,
    settings.useDetailedAnnualEstimate,
    userLocation,
    settings.winterThermostat,
    settings.summerThermostat,
    settings.squareFeet,
    settings.insulationLevel,
    settings.homeShape,
    settings.ceilingHeight,
    settings.hspf2,
    settings.efficiency,
    settings.utilityCost,
    settings.useElectricAuxHeat,
  ]);

  function optionsMonthlyProfileFromUserLocation() {
    const defaultHighs = [42, 45, 55, 65, 75, 85, 88, 86, 78, 66, 55, 45];
    return defaultHighs.map((h) => ({ high: h, low: h - 14 }));
  }

  // Determine ambient gradient based on system status - Lightened for clarity
  // Using inline styles for precise color control
  const ambientGradientStyle = useMemo(() => {
    if (systemStatus === "COOL ON") {
      // Light, crisp blue - much lighter for clarity
      return {
        background: 'linear-gradient(to bottom, rgba(30, 58, 138, 0.08), rgba(30, 64, 175, 0.05), transparent)'
      };
    } else if (systemStatus === "HEAT ON") {
      // Light, warm amber - much lighter for clarity
      return {
        background: 'linear-gradient(to bottom, rgba(124, 45, 18, 0.08), rgba(154, 52, 18, 0.05), transparent)'
      };
    } else if (systemStatus === "AUTO ON") {
      return {
        background: 'linear-gradient(to bottom, rgba(88, 28, 135, 0.06), rgba(67, 56, 202, 0.04), transparent)'
      };
    }
    return {
      background: 'linear-gradient(to bottom, rgba(17, 24, 39, 0.04), transparent)'
    };
  }, [systemStatus]);

  const isCooling = systemStatus === "COOL ON";
  const isHeating = systemStatus === "HEAT ON";

  // Page background gradient based on system status - Flattened for clarity
  const pageBackgroundStyle = useMemo(() => {
    if (systemStatus === "COOL ON") {
      return {
        background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.03) 0%, transparent 100%)'
      };
    } else if (systemStatus === "HEAT ON") {
      return {
        background: 'linear-gradient(135deg, rgba(124, 45, 18, 0.03) 0%, transparent 100%)'
      };
    }
    return {
      background: 'transparent'
    };
  }, [systemStatus]);

  return (
    <React.Fragment>
      <div className="min-h-screen bg-[#050B10]">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-8 py-6">
        {/* ============================================
             THESIS: "Explain what the heat pump is doing, 
             whether it's wasting money, and what to change — 
             in plain language — using real physics and real data."
             ============================================ */}
        
        {/* Page Header */}
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[24px] sm:text-[28px] font-semibold text-white">
                Mission Control
              </h1>
              <p className="text-sm text-[#A7B0BA] mt-1 max-w-2xl italic">
                Understand what your heat pump is doing, how it's feeling, and where it might need a little support — all in plain, human language.
              </p>
            </div>
            <Link
              to="/mission-control"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
            >
              Simple View
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </header>

        {/* Debug Panel - Prominent display when demo mode is disabled */}
        {localStorage.getItem("demoModeDisabled") === "true" && (
          <div className="mb-6 p-4 bg-yellow-900/30 border-2 border-yellow-500/50 rounded-lg shadow-lg">
            <div className="flex items-start gap-3">
              <div className="text-2xl">🔍</div>
              <div className="flex-1">
                <div className="font-bold text-yellow-200 text-lg mb-2">Debug: Raw Joule Bridge Data</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="bg-yellow-900/40 p-2 rounded">
                    <div className="text-yellow-300/70 text-xs">Bridge Available</div>
                    <div className="text-yellow-100 font-mono font-semibold">{bridgeAvailable ? "✅ Yes" : "❌ No"}</div>
                  </div>
                  <div className="bg-yellow-900/40 p-2 rounded">
                    <div className="text-yellow-300/70 text-xs">Connected</div>
                    <div className="text-yellow-100 font-mono font-semibold">{jouleBridge.connected ? "✅ Yes" : "❌ No"}</div>
                  </div>
                  <div className="bg-yellow-900/40 p-2 rounded">
                    <div className="text-yellow-300/70 text-xs">Temperature</div>
                    <div className="text-yellow-100 font-mono font-semibold">
                      {jouleBridge.temperature !== null && jouleBridge.temperature !== undefined 
                        ? `${jouleBridge.temperature.toFixed(1)}°F` 
                        : "null"}
                    </div>
                  </div>
                  <div className="bg-yellow-900/40 p-2 rounded">
                    <div className="text-yellow-300/70 text-xs">Target Temp</div>
                    <div className="text-yellow-100 font-mono font-semibold">
                      {(() => {
                        const targetTemp = jouleBridge.targetTemperature || jouleBridge.targetHeatTemp || jouleBridge.targetCoolTemp;
                        return targetTemp !== null && targetTemp !== undefined 
                          ? `${targetTemp.toFixed(1)}°F` 
                          : "null";
                      })()}
                    </div>
                  </div>
                  <div className="bg-yellow-900/40 p-2 rounded">
                    <div className="text-yellow-300/70 text-xs">Mode</div>
                    <div className="text-yellow-100 font-mono font-semibold">{jouleBridge.mode || "null"}</div>
                  </div>
                  <div className="bg-yellow-900/40 p-2 rounded">
                    <div className="text-yellow-300/70 text-xs">Loading</div>
                    <div className="text-yellow-100 font-mono font-semibold">{jouleBridge.loading ? "⏳ Yes" : "✅ No"}</div>
                  </div>
                  <div className="bg-yellow-900/40 p-2 rounded">
                    <div className="text-yellow-300/70 text-xs">Displayed Temp</div>
                    <div className="text-yellow-100 font-mono font-semibold">
                      {(() => {
                        const demoModeDisabled = localStorage.getItem("demoModeDisabled") === "true";
                        if (demoModeDisabled || (bridgeAvailable && jouleBridge.connected && jouleBridge.temperature !== null)) {
                          return jouleBridge.temperature ? `${jouleBridge.temperature.toFixed(1)}°F` : "72.0°F";
                        }
                        try {
                          const state = JSON.parse(localStorage.getItem("thermostatState") || '{"currentTemp": 72}');
                          return `${(state.currentTemp || 72).toFixed(1)}°F`;
                        } catch {
                          return "72.0°F";
                        }
                      })()}
                    </div>
                  </div>
                  <div className="bg-yellow-900/40 p-2 rounded">
                    <div className="text-yellow-300/70 text-xs">Data Source</div>
                    <div className="text-yellow-100 font-mono font-semibold text-xs">
                      {bridgeAvailable && jouleBridge.connected && jouleBridge.temperature !== null 
                        ? "Joule Bridge" 
                        : "localStorage/Default"}
                    </div>
                  </div>
                </div>
                {jouleBridge.error && (
                  <div className="mt-3 p-2 bg-red-900/40 border border-red-500/50 rounded text-red-200 text-sm font-mono">
                    <div className="font-semibold">Error:</div>
                    <div>{jouleBridge.error}</div>
                  </div>
                )}
                <div className="mt-3 text-xs text-yellow-300/70">
                  This debug panel shows raw data from your Ecobee via HomeKit. Check browser console (F12) for detailed logs.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Demo Mode Banner (subtle) */}
        {isDemo && !bannerDismissed && (
          <div className="bg-slate-950 border border-blue-500/30 rounded-lg p-4 mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span className="text-sm text-slate-300">
                <Link to="/config#joule-bridge" className="text-blue-400 hover:text-blue-300 font-medium">Demo mode — Connect your thermostat</Link> for live data.
              </span>
            </div>
            <button
              onClick={() => {
                setBannerDismissed(true);
                try { localStorage.setItem('demoBannerDismissed', 'true'); } catch {}
              }}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* System Health Alerts - Ask Joule insights */}
        <div className="mb-6">
          <SystemHealthAlerts
            settings={settings}
            latestAnalysis={latestAnalysis}
            systemStatus={systemStatus}
            outdoorTemp={outdoorTemp}
            onAskJoule={(question) => {
              // Dispatch custom event that AskJoule listens for
              // This is more reliable than DOM manipulation since AskJoule uses React state
              window.dispatchEvent(new CustomEvent('askJouleSubmitQuestion', {
                detail: { question, text: question }
              }));
            }}
          />
        </div>

        {/* ================================================
            TOP SECTION: Verdict + Explanation + Ask Joule
            Using new HomeTopSection component
            ================================================ */}
        {(() => {
          // Compute verdict from real data
          const usingAux = (() => {
            try {
              const useManualHeatLoss = Boolean(settings?.useManualHeatLoss);
              const useCalculatedHeatLoss = settings?.useCalculatedHeatLoss !== false;
              const useAnalyzerHeatLoss = Boolean(settings?.useAnalyzerHeatLoss);
              let effectiveHeatLossFactor;
              
              if (useManualHeatLoss) {
                const manualHeatLossFactor = Number(settings?.manualHeatLoss);
                if (Number.isFinite(manualHeatLossFactor) && manualHeatLossFactor > 0) {
                  effectiveHeatLossFactor = manualHeatLossFactor;
                }
              }
              
              if (!effectiveHeatLossFactor && useAnalyzerHeatLoss && latestAnalysis?.heatLossFactor) {
                effectiveHeatLossFactor = latestAnalysis.heatLossFactor;
              }
              
              if (!effectiveHeatLossFactor && useCalculatedHeatLoss) {
                const BASE_BTU_PER_SQFT_HEATING = 22.67;
                const ceilingMultiplier = 1 + ((settings.ceilingHeight || 8) - 8) * 0.1;
                const designHeatLoss = (settings.squareFeet || 1500) * BASE_BTU_PER_SQFT_HEATING * (settings.insulationLevel || 1.0) * (settings.homeShape || 1.0) * ceilingMultiplier;
                effectiveHeatLossFactor = designHeatLoss / 70;
              }
              
              if (!effectiveHeatLossFactor && latestAnalysis?.heatLossFactor) {
                effectiveHeatLossFactor = latestAnalysis.heatLossFactor;
              }
              
              const balancePointSettings = {
                ...settings,
                ...(effectiveHeatLossFactor ? { heatLossFactor: effectiveHeatLossFactor } : {}),
                ...(latestAnalysis?.balancePoint != null && Number.isFinite(latestAnalysis.balancePoint) 
                  ? { analyzerBalancePoint: latestAnalysis.balancePoint } 
                  : {})
              };
              const bp = calculateBalancePoint(balancePointSettings);
              return systemStatus === "HEAT ON" && bp && outdoorTemp < bp.balancePoint;
            } catch {
              return false;
            }
          })();
          
          // Calculate daily cost estimate
          const costToday = (() => {
            try {
              const utilityCost = settings.utilityCost || 0.15;
              const hspf2 = settings.hspf2 || 9;
              const heatLossFactor = settings.manualHeatLoss || 
                (settings.squareFeet ? (settings.squareFeet * 22.67 * (settings.insulationLevel || 1.0) / 70) : 314);
              const deltaT = Math.max(0, (settings.winterThermostat || 70) - outdoorTemp);
              const hourlyHeatLossBtu = heatLossFactor * deltaT;
              const hourlyKwh = hourlyHeatLossBtu / (hspf2 * 1000);
              const auxKwh = usingAux ? (hourlyHeatLossBtu * 0.3) / 3412 : 0;
              return ((hourlyKwh + auxKwh) * utilityCost * 24);
            } catch {
              return 3.42;
            }
          })();
          
          // Calculate extra cost per night when wasting
          const extraPerNight = (() => {
            if (!usingAux) return 0;
            try {
              const utilityCost = settings.utilityCost || 0.15;
              const heatLossFactor = settings.manualHeatLoss || 
                (settings.squareFeet ? (settings.squareFeet * 22.67 * (settings.insulationLevel || 1.0) / 70) : 314);
              const deltaT = Math.max(0, (settings.winterThermostat || 70) - outdoorTemp);
              const hourlyHeatLossBtu = heatLossFactor * deltaT;
              const auxKwh = (hourlyHeatLossBtu * 0.3) / 3412;
              const hpKwh = hourlyHeatLossBtu / ((settings.hspf2 || 9) * 1000);
              const extraKwh = auxKwh - (hpKwh * 0.1);
              return (extraKwh * utilityCost * 8);
            } catch {
              return 1.85;
            }
          })();
          
          // Check if optimizer schedule has been applied
          const hasOptimizerSchedule = (() => {
            try {
              return !!localStorage.getItem('optimizerSchedule');
            } catch {
              return false;
            }
          })();
          
          // Determine verdict - if optimizations are applied, be more lenient
          const verdict = hasOptimizerSchedule 
            ? (usingAux && costToday > 8 ? "watch" : "ok")  // More lenient threshold when optimized
            : (usingAux ? "wasting" : (costToday > 5 ? "watch" : "ok"));
          const isEfficient = verdict === "ok";
          
          // Get balance point for waste threshold
          const balancePoint = (() => {
            try {
              const useManualHeatLoss = Boolean(settings?.useManualHeatLoss);
              const useCalculatedHeatLoss = settings?.useCalculatedHeatLoss !== false;
              const useAnalyzerHeatLoss = Boolean(settings?.useAnalyzerHeatLoss);
              let effectiveHeatLossFactor;
              
              if (useManualHeatLoss) {
                const manualHeatLossFactor = Number(settings?.manualHeatLoss);
                if (Number.isFinite(manualHeatLossFactor) && manualHeatLossFactor > 0) {
                  effectiveHeatLossFactor = manualHeatLossFactor;
                }
              }
              
              if (!effectiveHeatLossFactor && useAnalyzerHeatLoss && latestAnalysis?.heatLossFactor) {
                effectiveHeatLossFactor = latestAnalysis.heatLossFactor;
              }
              
              if (!effectiveHeatLossFactor && useCalculatedHeatLoss) {
                const BASE_BTU_PER_SQFT_HEATING = 22.67;
                const ceilingMultiplier = 1 + ((settings.ceilingHeight || 8) - 8) * 0.1;
                const designHeatLoss = (settings.squareFeet || 1500) * BASE_BTU_PER_SQFT_HEATING * (settings.insulationLevel || 1.0) * (settings.homeShape || 1.0) * ceilingMultiplier;
                effectiveHeatLossFactor = designHeatLoss / 70;
              }
              
              if (!effectiveHeatLossFactor && latestAnalysis?.heatLossFactor) {
                effectiveHeatLossFactor = latestAnalysis.heatLossFactor;
              }
              
              const balancePointSettings = {
                ...settings,
                ...(effectiveHeatLossFactor ? { heatLossFactor: effectiveHeatLossFactor } : {}),
                ...(latestAnalysis?.balancePoint != null && Number.isFinite(latestAnalysis.balancePoint) 
                  ? { analyzerBalancePoint: latestAnalysis.balancePoint } 
                  : {})
              };
              const bp = calculateBalancePoint(balancePointSettings);
              return bp?.balancePoint ? Math.round(bp.balancePoint) : 25;
            } catch {
              return 25;
            }
          })();
          
          const currentSetpoint = settings.winterThermostat || 70;
          const recommendedSetpoint = Math.max(68, currentSetpoint - 2);
          
          // Build verdict text - acknowledge if optimizations are applied
          const verdictText = hasOptimizerSchedule && isEfficient
            ? "Your heat pump is running efficiently with optimized settings."
            : isEfficient
            ? "Your heat pump is running efficiently today."
            : hasOptimizerSchedule
            ? "Optimizations applied. Monitor for improvements."
            : "You're probably wasting money tonight with your current schedule.";
          
          // Build savings estimate - don't show if optimizations are already applied
          const savingsEstimateText = hasOptimizerSchedule
            ? null  // Don't show savings estimate if already optimized
            : !isEfficient && extraPerNight > 0
            ? `Letting Joule tune your schedule could save about $${extraPerNight.toFixed(2)} tonight and ~$${(extraPerNight * 7).toFixed(2)} this week.`
            : null;
          
          // Build wasting summary
          const wastingSummaryText = hasOptimizerSchedule && isEfficient
            ? `Your optimization settings are active, and the schedule should help your heat pump stay off auxiliary heat tonight.`
            : !isEfficient
            ? `Using more energy than earlier this season. This can happen when surfaces like the filter or coil need a little attention. It's not urgent — just something to be aware of. If a technician has already checked your system, you can safely dismiss this.`
            : `Things look good. Your optimization settings are active, and the schedule should help your heat pump stay off auxiliary heat tonight.`;
          
          // Build change recommendation
          const changeTitle = `When the temperature drops below ${balancePoint}°F, your heat pump stays happier when the night and day settings are closer together.`;
          const changeBody = `Tonight, try:\n\n${recommendedSetpoint}°F during the day → ${Math.max(66, recommendedSetpoint - 2)}°F at night\n\ninstead of dropping to ${currentSetpoint - 4}°F.\n\nThis helps the system stay efficient without waking up the strips in the early morning hours.`;
          const changeFootnote = "If everyone feels comfortable, you can always adjust it down later.";
          
          // Build last optimization summary
          const lastOptimization = optimizationResults ? {
            ranAt: `Today · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            resultSummary: `Your system is running more efficiently.`
          } : null;
          
          // Build today summary
          const todaySummary = {
            indoor: currentTemp.toFixed(1),
            outdoor: outdoorTemp.toFixed(0),
            stripsStatus: (() => {
              try {
                const bp = calculateBalancePoint(settings);
                return systemStatus === "HEAT ON" && bp && outdoorTemp < bp.balancePoint ? "active" : "low usage";
              } catch { return "low usage"; }
            })()
          };
          
          // Handle question click - targets AskJoule input
          const handleQuestionClick = (question) => {
            // Try multiple selectors to find the AskJoule input
            const selectors = [
              '#ask-joule-top-section input[type="text"]',
              '#ask-joule-top-section textarea',
              '#ask-joule-tour-target input[type="text"]',
              '#ask-joule-tour-target textarea',
              'input[placeholder*="Ask in plain English"]',
              'textarea[placeholder*="Ask in plain English"]'
            ];
            
            let input = null;
            for (const selector of selectors) {
              input = document.querySelector(selector);
              if (input) break;
            }
            
            // Use the custom event system to set the question (cleaner approach)
            const askJouleEvent = new CustomEvent('askJouleSetQuestion', {
              detail: { question, autoSubmit: true },
              bubbles: true,
              cancelable: true
            });
            window.dispatchEvent(askJouleEvent);
            
            // Also try DOM manipulation as fallback
            if (input) {
              // Focus and select all existing text first to replace it
              input.focus();
              input.select();
              
              // Use React's synthetic event system to properly update controlled component
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set ||
                                            Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
              
              // Set the value using native setter (triggers React's onChange)
              if (nativeInputValueSetter) {
                nativeInputValueSetter.call(input, question);
              } else {
                // Fallback: direct assignment
                input.value = question;
              }
              
              // Create and dispatch React-compatible input event
              const inputEvent = new Event('input', { bubbles: true, cancelable: true });
              Object.defineProperty(inputEvent, 'target', { 
                value: input, 
                enumerable: true,
                writable: false,
                configurable: false
              });
              Object.defineProperty(inputEvent, 'currentTarget', { 
                value: input, 
                enumerable: true,
                writable: false,
                configurable: false
              });
              
              // Dispatch the event
              input.dispatchEvent(inputEvent);
              
              // Also dispatch change event
              const changeEvent = new Event('change', { bubbles: true, cancelable: true });
              Object.defineProperty(changeEvent, 'target', { 
                value: input, 
                enumerable: true,
                writable: false,
                configurable: false
              });
              input.dispatchEvent(changeEvent);
              
              // Automatically submit the question after a short delay
              setTimeout(() => {
                // Find the submit button - try multiple selectors
                const form = input.closest('form');
                let submitButton = null;
                
                if (form) {
                  submitButton = form.querySelector('button[type="submit"]');
                }
                
                // Fallback: search in the AskJoule container
                if (!submitButton) {
                  const askJouleContainer = input.closest('#ask-joule-top-section') || 
                                           input.closest('#ask-joule-tour-target') ||
                                           document.querySelector('#ask-joule-top-section') ||
                                           document.querySelector('#ask-joule-tour-target');
                  if (askJouleContainer) {
                    submitButton = askJouleContainer.querySelector('button[type="submit"]');
                  }
                }
                
                // If we found a submit button, click it
                if (submitButton) {
                  submitButton.click();
                } else if (form) {
                  // Fallback: dispatch submit event on the form
                  const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                  form.dispatchEvent(submitEvent);
                }
              }, 150);
            }
          };
          
          // Render AskJoule component
          const askJouleComponent = (
            <AskJoule
              hasLocation={!!userLocation}
              userSettings={{
                ...userSettings,
                ...(latestAnalysis?.balancePoint != null && Number.isFinite(latestAnalysis.balancePoint) 
                  ? { analyzerBalancePoint: latestAnalysis.balancePoint } 
                  : {})
              }}
              userLocation={userLocation}
              hideHeader={true}
              onParsed={(data) => {
                try { console.info("AskJoule(Home) parsed:", data); } catch {}
              }}
            />
          );
          
          return (
            <HomeTopSection
              verdict={verdict}
              verdictText={verdictText}
              savingsEstimateText={savingsEstimateText}
              onOptimizeClick={handleOptimize}
              isOptimizing={isOptimizing}
              wastingSummaryText={wastingSummaryText}
              changeTitle={changeTitle}
              changeBody={changeBody}
              changeFootnote={changeFootnote}
              lastOptimization={lastOptimization}
              todaySummary={todaySummary}
              onQuestionClick={handleQuestionClick}
              askJouleComponent={askJouleComponent}
            />
          );
        })()}

        {/* ================================================
            ACTIVE INTELLIGENCE FEED - PROMOTED & ENHANCED
            ================================================ */}
        <section className="mb-6">
          <div id="active-intelligence-feed-tour-target" className="bg-[#0C1118] border border-slate-800 rounded-xl p-6">
            <div className="mb-4">
              <h3 className="text-[18px] font-medium text-[#E8EDF3] mb-1">
                🔎 Active Intelligence Feed
              </h3>
              <p className="text-sm text-slate-400 italic">What happened today — and what it means for you</p>
            </div>
            <div 
              ref={eventLogRef}
              className="space-y-3"
            >
              {eventLog.slice(0, 5).map((event, idx) => (
                <div 
                  key={idx} 
                  className="bg-slate-950 border border-slate-800 rounded-lg p-4 hover:bg-slate-900/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-blue-400 flex-shrink-0 font-medium text-xs mt-0.5">{event.time}</span>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-start gap-2">
                        {event.icon && (
                          <span className="text-base flex-shrink-0 mt-0.5">{event.icon}</span>
                        )}
                        <span className={`text-sm font-medium leading-relaxed ${
                          event.type === "success" ? "text-emerald-400" :
                          event.type === "warning" ? "text-amber-400" :
                          "text-slate-200"
                        }`}>
                          {event.message}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed pl-6">
                        {event.details || "Everything checked out. Your system passed its routine health check and is running efficiently. No action needed."}
                      </p>
                      <div className="pl-6 mt-2">
                        {event.type === "success" ? (
                          <span className="text-xs text-slate-500 italic">Just keep an eye on things; nothing to worry about.</span>
                        ) : event.type === "warning" ? (
                          <span className="text-xs text-amber-400 font-medium">
                            👉 <span className="italic">Gentle tip:</span> When it's below <strong>25°F</strong>, raising your nighttime setpoint from <strong>{(settings.winterThermostat || 70) - 4}°F → {settings.winterThermostat || 70}°F</strong> can help avoid extra aux usage. This is normal in colder weather.
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500 italic">This is normal. Just keep an eye on things.</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================
            BAND 4: DETAILED DATA (Nerd Panels)
            For users who want the full physics & data.
            ================================================ */}
      <div className="flex flex-col gap-5">
        {/* System Status - Detailed (How we know section) */}
        <div id="system-status-tour-target" className="bg-[#0C1118] border border-slate-800 rounded-xl p-6">
          {/* Header */}
          <div className="mb-5">
            <h2 className="text-[20px] font-medium text-[#E8EDF3]">🌡 System Status</h2>
          </div>
          
          {/* Two Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
            {/* Left Column: Temperature - Hero */}
            <div>
              <div className="text-[56px] font-bold text-[#FFFFFF] mb-2 leading-none">
                {currentTemp.toFixed(1)}°F
              </div>
              <div className="text-base text-[#A7B0BA] mb-5 font-medium">
                Indoor temperature {settings.winterThermostat && `(Optimal: ${settings.winterThermostat}°F)`}
              </div>
              
              {/* Mode + Status Row 1 */}
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-3 h-3 rounded-full ${
                  systemStatus === "HEAT ON" ? "bg-amber-400" :
                  systemStatus === "COOL ON" ? "bg-blue-400" :
                  systemStatus === "AUTO ON" ? "bg-purple-400" :
                  "bg-slate-500"
                }`} />
                <span className="text-sm font-medium text-[#E8EDF3]">
                  {systemStatus === "HEAT ON" || systemStatus === "COOL ON" || systemStatus === "AUTO ON" ? "Active" : "Idle"}
                </span>
                <span className="text-sm text-[#7C8894]">·</span>
                <span className="text-sm text-[#A7B0BA]">{systemStatus}</span>
              </div>
              {(() => {
                try {
                  const utilityCost = settings.utilityCost || 0.15;
                  const hspf2 = settings.hspf2 || 9;
                  const heatLossFactor = settings.manualHeatLoss || 
                    (settings.squareFeet ? (settings.squareFeet * 22.67 * (settings.insulationLevel || 1.0) / 70) : 314);
                  const hourlyCost = (heatLossFactor * utilityCost) / hspf2;
                  return (
                    <div className="text-xs text-[#7C8894]">
                      Estimated cost right now: <strong className="text-white">${hourlyCost.toFixed(2)}/hour</strong>
                    </div>
                  );
            } catch {
                  return null;
            }
              })()}
      </div>

            {/* Right Column: Temperature Trend Chart - Enhanced */}
            <div>
              <p className="text-xs text-slate-500 mb-3 italic">Temperature trends will appear here as Joule learns more.</p>
              <div className="text-base font-semibold text-[#E8EDF3] mb-3">Temperature Trend (4 hours)</div>
              <div className="h-40 bg-slate-950 border border-slate-800 rounded-lg p-4 relative overflow-hidden">
                {/* Y-axis labels */}
                <div className="absolute left-3 top-3 text-xs text-slate-400 font-medium">76°F</div>
                <div className="absolute left-3 bottom-3 text-xs text-slate-400 font-medium">68°F</div>
                <svg className="w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="none">
                  {/* Grid lines */}
                  <line x1="0" y1="25" x2="200" y2="25" stroke="#1e293b" strokeWidth="0.5" />
                  <line x1="0" y1="50" x2="200" y2="50" stroke="#1e293b" strokeWidth="0.5" />
                  <line x1="0" y1="75" x2="200" y2="75" stroke="#1e293b" strokeWidth="0.5" />
                  {/* Temperature line */}
                  <polyline
                    points={sparklineData.map((temp, i) => `${(i / (sparklineData.length - 1)) * 200},${100 - ((temp - 68) / 8) * 100}`).join(" ")}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                  />
                  {/* Current point indicator */}
                  {sparklineData.length > 0 && (
                    <circle
                      cx={200}
                      cy={100 - ((sparklineData[sparklineData.length - 1] - 68) / 8) * 100}
                      r="4"
                      fill="#3b82f6"
                      stroke="#0C1118"
                      strokeWidth="2"
                    />
                  )}
                </svg>
              </div>
            </div>
          </div>
          
          {/* Footer Row: Summary Info - Two Rows */}
          <div className="pt-5 border-t border-slate-800">
            {/* Row 1: Mode + Status */}
            <div className="flex flex-wrap items-center gap-4 text-sm mb-4">
              {/* Balance Point */}
                {(() => {
                  try {
                    const useManualHeatLoss = Boolean(settings?.useManualHeatLoss);
                    const useCalculatedHeatLoss = settings?.useCalculatedHeatLoss !== false;
                    const useAnalyzerHeatLoss = Boolean(settings?.useAnalyzerHeatLoss);
                    let effectiveHeatLossFactor;
                    
                    if (useManualHeatLoss) {
                      const manualHeatLossFactor = Number(settings?.manualHeatLoss);
                      if (Number.isFinite(manualHeatLossFactor) && manualHeatLossFactor > 0) {
                        effectiveHeatLossFactor = manualHeatLossFactor;
                      }
                    }
                    
                    if (!effectiveHeatLossFactor && useAnalyzerHeatLoss && latestAnalysis?.heatLossFactor) {
                      effectiveHeatLossFactor = latestAnalysis.heatLossFactor;
                    }
                    
                    if (!effectiveHeatLossFactor && useCalculatedHeatLoss) {
                      const BASE_BTU_PER_SQFT_HEATING = 22.67;
                      const ceilingMultiplier = 1 + ((settings.ceilingHeight || 8) - 8) * 0.1;
                      const designHeatLoss =
                        (settings.squareFeet || 1500) *
                        BASE_BTU_PER_SQFT_HEATING *
                        (settings.insulationLevel || 1.0) *
                        (settings.homeShape || 1.0) *
                        ceilingMultiplier;
                      effectiveHeatLossFactor = designHeatLoss / 70;
                    }
                    
                    if (!effectiveHeatLossFactor && latestAnalysis?.heatLossFactor) {
                      effectiveHeatLossFactor = latestAnalysis.heatLossFactor;
                    }
                    
                    const balancePointSettings = {
                      ...settings,
                      ...(effectiveHeatLossFactor ? { heatLossFactor: effectiveHeatLossFactor } : {}),
                      ...(latestAnalysis?.balancePoint != null && Number.isFinite(latestAnalysis.balancePoint) 
                        ? { analyzerBalancePoint: latestAnalysis.balancePoint } 
                        : {})
                    };
                    const balancePoint = calculateBalancePoint(balancePointSettings);
                    if (balancePoint && balancePoint.balancePoint) {
                    const bp = Math.round(balancePoint.balancePoint);
                    return (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#7C8894]">Balance point:</span>
                        <span className="text-[#FFFFFF] font-medium">{bp}°F</span>
                        </div>
                      );
                    }
                } catch {}
                  return null;
                })()}
              
              {/* Outdoor Temp */}
              <div className="flex items-center gap-1.5">
                <span className="text-[#7C8894]">Outdoor temperature:</span>
                <span className="text-[#FFFFFF] font-medium">{outdoorTemp}°F</span>
              </div>
              
              {/* Target Temp */}
              {targetTemp !== null && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[#7C8894]">Target:</span>
                  <span className="text-[#FFFFFF] font-medium">{Math.round(targetTemp)}°F</span>
                </div>
              )}
            </div>
            
            {/* Row 2: Cost + Aux Heat */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {/* Aux Heat Needed */}
                  {(() => {
                    try {
                      const useManualHeatLoss = Boolean(settings?.useManualHeatLoss);
                      const useCalculatedHeatLoss = settings?.useCalculatedHeatLoss !== false;
                      const useAnalyzerHeatLoss = Boolean(settings?.useAnalyzerHeatLoss);
                      let effectiveHeatLossFactor;
                      
                      if (useManualHeatLoss) {
                        const manualHeatLossFactor = Number(settings?.manualHeatLoss);
                        if (Number.isFinite(manualHeatLossFactor) && manualHeatLossFactor > 0) {
                          effectiveHeatLossFactor = manualHeatLossFactor;
                        }
                      }
                      
                      if (!effectiveHeatLossFactor && useAnalyzerHeatLoss && latestAnalysis?.heatLossFactor) {
                        effectiveHeatLossFactor = latestAnalysis.heatLossFactor;
                      }
                      
                      if (!effectiveHeatLossFactor && useCalculatedHeatLoss) {
                        const BASE_BTU_PER_SQFT_HEATING = 22.67;
                        const ceilingMultiplier = 1 + ((settings.ceilingHeight || 8) - 8) * 0.1;
                        const designHeatLoss =
                          (settings.squareFeet || 1500) *
                          BASE_BTU_PER_SQFT_HEATING *
                          (settings.insulationLevel || 1.0) *
                          (settings.homeShape || 1.0) *
                          ceilingMultiplier;
                        effectiveHeatLossFactor = designHeatLoss / 70;
                      }
                      
                      if (!effectiveHeatLossFactor && latestAnalysis?.heatLossFactor) {
                        effectiveHeatLossFactor = latestAnalysis.heatLossFactor;
                      }
                      
                      const balancePointSettings = {
                        ...settings,
                        ...(effectiveHeatLossFactor ? { heatLossFactor: effectiveHeatLossFactor } : {}),
                        ...(latestAnalysis?.balancePoint != null && Number.isFinite(latestAnalysis.balancePoint) 
                          ? { analyzerBalancePoint: latestAnalysis.balancePoint } 
                          : {})
                      };
                      const balancePoint = calculateBalancePoint(balancePointSettings);
                      if (balancePoint && balancePoint.balancePoint && outdoorTemp < balancePoint.balancePoint) {
                        return (
                      <div className="flex items-center gap-1.5">
                        <span className="text-amber-400 font-medium">Aux heat: active</span>
                      </div>
                    );
                  }
                } catch {}
                    return null;
                  })()}
            </div>
          </div>
          
              {/* Current vs Optimal Temperature Indicator */}
              {settings.winterThermostat && (
                <div className="mt-2 text-xs">
                  <span className="text-muted">Optimal: </span>
              <span
                className={`font-semibold ${
                    Math.abs(currentTemp - settings.winterThermostat) <= 1 
                      ? "text-green-600 dark:text-green-400" 
                      : Math.abs(currentTemp - settings.winterThermostat) <= 3
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-orange-600 dark:text-orange-400"
                }`}
              >
                    {settings.winterThermostat}°F
                  </span>
                  {Math.abs(currentTemp - settings.winterThermostat) > 1 && (
                    <span className="text-muted ml-1">
                  ({currentTemp > settings.winterThermostat ? "+" : ""}
                  {(currentTemp - settings.winterThermostat).toFixed(1)}°F)
                    </span>
                  )}
                </div>
              )}

          {/* Fan + Cost Indicator */}
              <div className="flex flex-col items-center gap-1 mt-2">
                <div className="flex items-center justify-center gap-2">
              <Fan
                className={`w-5 h-5 ${
                  systemStatus === "HEAT ON"
                    ? "text-orange-500 animate-spin"
                    : systemStatus === "COOL ON"
                    ? "text-blue-500 animate-spin"
                    : systemStatus === "AUTO ON"
                    ? "text-purple-500 animate-spin"
                    : "text-gray-400"
                }`}
              />
                  <span className="text-xs text-muted">HVAC Active</span>
                </div>
            {(systemStatus === "HEAT ON" ||
              systemStatus === "COOL ON" ||
              systemStatus === "AUTO ON") &&
              (() => {
                  try {
                    const utilityCost = settings.utilityCost || 0.15;
                    const hspf2 = settings.hspf2 || 9;
                  const heatLossFactor =
                    settings.manualHeatLoss ||
                    (settings.squareFeet
                      ? (settings.squareFeet *
                          22.67 *
                          (settings.insulationLevel || 1.0)) /
                        70
                      : 314);
                  const deltaT = Math.max(
                    0,
                    (settings.winterThermostat || 70) - outdoorTemp
                  );
                    const hourlyHeatLossBtu = heatLossFactor * deltaT;
                    const hourlyKwh = hourlyHeatLossBtu / (hspf2 * 1000);
                    
                    const useManualHeatLoss = Boolean(settings?.useManualHeatLoss);
                  const useCalculatedHeatLoss =
                    settings?.useCalculatedHeatLoss !== false;
                  const useAnalyzerHeatLoss = Boolean(
                    settings?.useAnalyzerHeatLoss
                  );
                    let effectiveHeatLossFactor;
                    
                    if (useManualHeatLoss) {
                    const manualHeatLossFactor = Number(
                      settings?.manualHeatLoss
                    );
                    if (
                      Number.isFinite(manualHeatLossFactor) &&
                      manualHeatLossFactor > 0
                    ) {
                        effectiveHeatLossFactor = manualHeatLossFactor;
                      }
                    }
                    
                  if (
                    !effectiveHeatLossFactor &&
                    useAnalyzerHeatLoss &&
                    latestAnalysis?.heatLossFactor
                  ) {
                      effectiveHeatLossFactor = latestAnalysis.heatLossFactor;
                    }
                    
                    if (!effectiveHeatLossFactor && useCalculatedHeatLoss) {
                      const BASE_BTU_PER_SQFT_HEATING = 22.67;
                    const ceilingMultiplier =
                      1 + ((settings.ceilingHeight || 8) - 8) * 0.1;
                      const designHeatLoss =
                        (settings.squareFeet || 1500) *
                        BASE_BTU_PER_SQFT_HEATING *
                        (settings.insulationLevel || 1.0) *
                        (settings.homeShape || 1.0) *
                        ceilingMultiplier;
                      effectiveHeatLossFactor = designHeatLoss / 70;
                    }
                    
                  if (
                    !effectiveHeatLossFactor &&
                    latestAnalysis?.heatLossFactor
                  ) {
                      effectiveHeatLossFactor = latestAnalysis.heatLossFactor;
                    }
                    
                    const balancePointSettings = {
                      ...settings,
                    ...(effectiveHeatLossFactor
                      ? { heatLossFactor: effectiveHeatLossFactor }
                      : {}),
                    ...(latestAnalysis?.balancePoint != null &&
                    Number.isFinite(latestAnalysis.balancePoint)
                        ? { analyzerBalancePoint: latestAnalysis.balancePoint } 
                      : {}),
                  };
                  const balancePoint =
                    calculateBalancePoint(balancePointSettings);
                  const usingAux =
                    systemStatus === "HEAT ON" &&
                    balancePoint &&
                    outdoorTemp < balancePoint.balancePoint;
                  const auxKwh = usingAux
                    ? (hourlyHeatLossBtu * 0.3) / 3412
                    : 0;
                    const totalHourlyCost = (hourlyKwh + auxKwh) * utilityCost;
                    
                    let systemType = "Heat Pump";
                    if (systemStatus === "COOL ON") {
                      systemType = "Cooling";
                    } else if (systemStatus === "AUTO ON") {
                      systemType = "Auto";
                    } else if (usingAux) {
                      systemType = "Heat Pump + Aux Heat";
                    }
                    
                    return (
                      <div className="text-xs text-muted mt-1">
                        <div className="font-semibold text-high-contrast">
                          {systemType}
                        </div>
                        <div className="text-xs text-muted">
                          Estimated: ${totalHourlyCost.toFixed(2)}/hr
                        </div>
                      </div>
                    );
                  } catch {
                    return null;
                  }
                })()}
            </div>
          </div>
        </div>


            {/* Hardware Status - Collapsed by default */}
        <div className="bg-[#0C1118] border border-slate-800 rounded-xl p-4">
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer list-none">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-100">Devices</h3>
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="text-xs font-medium text-emerald-400">All systems online</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-open:rotate-90 transition-transform" />
            </summary>
            <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Joule Bridge</span>
                <span className="text-emerald-400 font-medium">Online</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Ecobee Thermostat</span>
                <span className="text-emerald-400 font-medium">Paired</span>
              </div>
            </div>
          </details>
        </div>

        {/* Legacy: At a glance (Hidden by default, can be shown via toggle) */}
        <div className="glass-card p-glass animate-fade-in-up hidden">
          <div className="flex items-center gap-3 mb-4">
            <div className="icon-container">
              <BarChart3 className="w-5 h-5 text-blue-500" />
            </div>
            <h3 className="heading-tertiary">
              At a glance
            </h3>
          </div>
            {lastForecast ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">
                      Last forecast in
                    </p>
                    <p
                      data-testid="last-forecast-elevation"
                      className="text-xl font-bold text-gray-900 dark:text-white"
                    >
                      {(() => {
                        if (!lastForecast || !userLocation)
                          return lastForecast?.location || "";
                        const city =
                          userLocation.city ||
                          lastForecast.location?.split(",")[0] ||
                          "";
                        const state = userLocation.state || "";
                        const elevation =
                          typeof globalHomeElevation === "number"
                            ? globalHomeElevation
                            : userLocation.elevation ?? 0;
                        return `${city}, ${state} (Elev: ${elevation} ft)`;
                      })()}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-glass-sm">
                    <div className="text-center glass-card p-glass-sm">
                      <div className="flex items-center justify-center gap-1 mb-2">
                        <Zap className="w-3 h-3 text-blue-500" />
                        <div className="text-[11px] font-semibold text-muted">
                          Heat Pump (7d)
                        </div>
                      </div>
                      <div className="text-xl font-bold text-high-contrast">
                        {currency(lastForecast.totalHPCost)}
                      </div>
                    </div>
                    <div className="text-center glass-card p-glass-sm">
                      <div className="flex items-center justify-center gap-1 mb-2">
                        <Flame className="w-3 h-3 text-orange-500" />
                        <div className="text-[11px] font-semibold text-muted">
                          Gas (7d)
                        </div>
                      </div>
                      {lastForecast.totalGasCost > 0 ? (
                        <div className="text-xl font-bold text-high-contrast">
                          {currency(lastForecast.totalGasCost)}
                        </div>
                      ) : (
                        <div className="text-sm text-subtle">
                          <Link
                            to="/cost-comparison"
                            className="underline hover:text-high-contrast"
                          >
                            Run a comparison
                          </Link>
                        </div>
                      )}
                    </div>
                    <div className="text-center glass-card p-glass-sm">
                      <div className="flex items-center justify-center gap-1 mb-2">
                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                        <div className="text-[11px] font-semibold text-muted">
                          Savings (7d)
                        </div>
                      </div>
                      {lastForecast.totalSavings > 0 ? (
                        <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                          {currency(lastForecast.totalSavings)}
                        </div>
                      ) : (
                        <div className="text-sm text-subtle">
                          <Link
                            to="/cost-comparison"
                            className="underline hover:text-high-contrast"
                          >
                            Run a comparison
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted">
                Run a forecast or comparison to see a summary here.
              </p>
            )}
            <div className="mt-4">
              <Link
                to="/analysis/compare"
                className="btn-glass inline-flex items-center gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                Open System Comparison
              </Link>
            </div>
          </div>

          {/* Annual Estimate - Prominent Hero Card */}
          <div className="bg-gradient-to-br from-blue-600/15 via-purple-600/15 to-blue-600/15 border-2 border-blue-500/40 rounded-xl p-7 shadow-lg shadow-blue-600/10">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="mb-2">
                  <h3 className="text-[22px] font-semibold text-white mb-1">
                    💵 What This Year May Cost
                  </h3>
                  <p className="text-xs text-slate-400 italic">
                    {optimizationResults 
                      ? "If you continue with Joule's optimized schedule, your estimated yearly cost is:"
                      : "If you continue with today's strategy, your estimated yearly cost is:"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                    <span
                      data-testid="estimation-method"
                    className="text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-600/30 text-blue-200 border border-blue-500/50"
                    >
                      {annualEstimate?.method === "fullPrecision"
                        ? "Full Precision"
                        : annualEstimate?.method === "detailed"
                        ? "Detailed"
                        : "Quick"}
                    </span>
                    {annualEstimate?.isEstimated && (
                      <span
                        title={`Based on ${annualEstimate?.hdd?.toLocaleString()} HDD & ${annualEstimate?.cdd?.toLocaleString()} CDD/year (estimated). Upload thermostat data for personalized accuracy.`}
                      >
                      <Info size={14} className="text-blue-400" />
                      </span>
                    )}
                </div>
                  </div>
                </div>
                <div
                  data-testid="annual-total-cost"
              className="text-6xl sm:text-7xl font-black text-white mb-5 leading-none"
                >
                  {annualEstimate ? currency(annualEstimate.totalCost) : "—"}
                </div>
                {precisionLoading && (
                  <div
                    data-testid="annual-precision-loading"
                    className="mt-2 text-sm text-gray-600 dark:text-gray-300"
                  >
                    Calculating detailed estimate…
                  </div>
                )}
                {precisionError && (
                  <div
                    data-testid="annual-precision-error"
                    className="mt-2 text-sm text-red-600"
                  >
                    {precisionError}
                  </div>
                )}
                {annualEstimate && (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm mb-4">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-400" />
                      <span className="text-slate-300">
                        Heating:{" "}
                        <strong data-testid="annual-heating-cost" className="text-white">
                          {currency(annualEstimate.heatingCost)}
                        </strong>
                      </span>
                    </div>
                    <span className="hidden sm:inline text-slate-500">·</span>
                    <div className="flex items-center gap-2">
                      <Snowflake className="w-4 h-4 text-blue-400" />
                      <span className="text-slate-300">
                        Cooling:{" "}
                        <strong data-testid="annual-cooling-cost" className="text-white">
                          {currency(annualEstimate.coolingCost)}
                        </strong>
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 italic">This estimate adjusts as Joule learns more about your home, weather, and comfort patterns.</p>
                  </div>
                )}
                <div className="mt-4">
                  <Link
                    to="/cost-forecaster"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <SettingsIcon className="w-4 h-4" />
                    Set My Thermostats in 7-Day Forecast
                  </Link>
                </div>
                {annualEstimate?.auxKwhExcluded > 0 && (
                  <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-200">
                    <p id="aux-excluded-note">
                      Note: {annualEstimate.auxKwhExcluded.toFixed(0)} kWh of electric
                      aux heat was excluded from this estimate because your settings
                      indicate that electric auxiliary heat is not used.
                    </p>
                  </div>
                )}
              </div>

          {/* Recently Viewed Section */}
          {recentlyViewed.length > 0 && (
            <div className="bg-[#0C1118] border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-blue-400" />
                  <h3 className="text-[18px] font-medium text-[#E8EDF3]">Recently Viewed</h3>
                  </div>
                </div>
              <div className="flex flex-wrap gap-2">
                {recentlyViewed.slice(0, 5).map((item, idx) => {
                  // Look up the route to get the icon component
                  const route = routes.find(r => r.path === item.path);
                  const IconComponent = route?.icon;
                  
                  return (
                    <Link
                      key={idx}
                      to={item.path}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg hover:bg-slate-900 hover:border-slate-700 transition-colors group text-sm"
                    >
                        {IconComponent && (
                          <div className="flex-shrink-0">
                          {React.createElement(IconComponent, { size: 14, className: "text-slate-400 group-hover:text-slate-200" })}
                          </div>
                        )}
                      <span className="text-slate-300 group-hover:text-white font-medium">
                          {item.title}
                        </span>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeFromRecentlyViewed(item.path);
                          setRecentlyViewed(getRecentlyViewed());
                        }}
                        className="ml-1 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-400"
                        aria-label={`Remove ${item.title} from recently viewed`}
                      >
                        <XCircle size={14} />
                      </button>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

        {/* ================================================
            WANT TO GO DEEPER? - Simplified Tools Section
            ================================================ */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-slate-100">
                🧠 Want to explore more?
              </h2>
              <p className="text-xs text-[#A7B0BA] mt-1 max-w-xl italic">
                Here are some tools if you enjoy looking deeper into the data or trying "what if" scenarios.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 7-Day Cost Forecaster */}
            <button
              type="button"
              onClick={() => navigate("/analysis/forecast")}
              className="flex flex-col items-stretch rounded-xl border border-slate-800 bg-[#0C1118] p-4 text-left hover:border-blue-500/80 hover:bg-slate-900/60 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-blue-300" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      7-Day Cost Forecaster
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      See how your current schedule affects cost throughout the week.
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500" />
              </div>
            </button>

            {/* Thermostat Strategy */}
            <button
              type="button"
              onClick={() => navigate("/thermostat-analyzer")}
              className="flex flex-col items-stretch rounded-xl border border-slate-800 bg-[#0C1118] p-4 text-left hover:border-blue-500/80 hover:bg-slate-900/60 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center">
                    <BarChart3 className="h-4 w-4 text-violet-300" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      Thermostat Strategy
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Compare constant temperatures vs nighttime setbacks.
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500" />
              </div>
              <p className="mt-2 text-xs text-[#A7B0BA]">
                Find the balance between comfort and savings for your home.
              </p>
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate("/analysis")}
            className="mt-3 text-[11px] text-[#A7B0BA] hover:text-slate-100 inline-flex items-center gap-1"
          >
            View the full toolbox in Analysis
            <ArrowRight className="h-3 w-3" />
          </button>
        </section>

        {/* Legacy tools grid - REMOVED, moved to Analysis page */}
        {/* All secondary tools (Balance Point Analyzer, Performance Analyzer, etc.) are now in /analysis */}

        {/* Optimization Modal - Fixed overlay */}
      {showOptimizeModal && optimizationResults && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-high-contrast">Optimization Complete</h3>
              <button
                onClick={() => {
                  setShowOptimizeModal(false);
                  setOptimizationResults(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-6">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="font-semibold text-green-800 dark:text-green-200">
                    Found {optimizationResults.inefficiencies} inefficiencies
                  </span>
                </div>
                <div className="text-3xl font-black text-green-600 dark:text-green-400">
                  Saved ${optimizationResults.savings}/year
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <p className="text-sm font-semibold text-high-contrast">Recommended Fixes:</p>
                <ul className="space-y-2">
                  {optimizationResults.fixes.map((fix, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-muted">
                      <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <span>{fix}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowOptimizeModal(false);
                  setOptimizationResults(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-semibold transition-colors"
              >
                Review Later
              </button>
              <button
                onClick={() => {
                  setShowOptimizeModal(false);
                  setOptimizationResults(null);
                  // In real app, this would apply the fixes
                  setEventLog((prev) => [
                    { 
                      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
                      message: `Applied ${optimizationResults.inefficiencies} optimizations. Estimated savings: $${optimizationResults.savings}/year.`, 
                      type: "success" 
                    },
                    ...prev,
                  ]);
                }}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-lg font-semibold transition-all shadow-lg"
              >
                Apply Fixes
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-center text-muted mb-3">
                Want this for real?
              </p>
              <a
                href={EBAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full px-4 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-lg font-bold transition-all shadow-lg hover:shadow-xl text-center block"
              >
                Buy the Bridge ($299)
              </a>
            </div>
          </div>
        </div>
      )}
      </div>
      </div>
    </React.Fragment>
    );
};

export default HomeDashboard;
