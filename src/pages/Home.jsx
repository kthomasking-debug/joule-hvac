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
  MapPin,
} from "lucide-react";
import AskJoule from "../components/AskJoule";
import HomeTopSection from "../components/HomeTopSection";
import DemoModeBanner from "../components/DemoModeBanner";
import SystemHealthAlerts from "../components/SystemHealthAlerts";
import { useDemoMode } from "../hooks/useDemoMode";
import { useJouleBridgeContext } from "../contexts/JouleBridgeContext";
import { QuickActionsBar, OneClickOptimizer, SavingsTracker, SystemHealthCard, WasteDetector } from "../components/optimization";
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

  // Check if onboarding has been completed
  const hasCompletedOnboarding = () => {
    try {
      return localStorage.getItem("hasCompletedOnboarding") === "true";
    } catch {
      return false;
    }
  };

  // Handle clicks on main feature buttons - redirect to onboarding if not completed
  const handleFeatureClick = (targetPath, event) => {
    event.preventDefault();
    if (!hasCompletedOnboarding()) {
      navigate("/onboarding");
    } else {
      navigate(targetPath);
    }
  };

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
  const { userSettings: ctxUserSettings, setUserSetting } = outlet;
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
    <div className="min-h-screen bg-[#050B10]">
      <div className="w-full px-6 lg:px-8 py-6">
        {/* Page Header */}
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-[28px] font-semibold text-white mb-2">
              Mission Control
            </h1>
            <p className="text-sm text-[#A7B0BA]">
              Quick overview of your system status
            </p>
          </div>
          <Link
            to="/onboarding?rerun=true"
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <SettingsIcon className="w-4 h-4" />
            Re-run Onboarding
          </Link>
        </header>

        {/* Quick Status Card - Only show when Ecobee is paired */}
        {bridgeAvailable && jouleBridge.connected && (
          <div className="mb-6 bg-[#0C1118] border border-slate-800 rounded-xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-[#A7B0BA] mb-1">Current Temperature</div>
                <div className="text-3xl font-bold text-white">{currentTemp.toFixed(1)}°F</div>
                <div className="text-xs text-[#7C8894] mt-1">Target: {targetTemp}°F</div>
              </div>
              <div>
                <div className="text-sm text-[#A7B0BA] mb-1">System Status</div>
                <div className="text-xl font-semibold text-white">{systemStatus}</div>
                <div className="text-xs text-[#7C8894] mt-1">Outdoor: {outdoorTemp}°F</div>
              </div>
              <div>
                <div className="text-sm text-[#A7B0BA] mb-1">Bridge Connection</div>
                <div className={`text-lg font-semibold ${bridgeAvailable && jouleBridge.connected ? 'text-green-400' : 'text-amber-400'}`}>
                  {bridgeAvailable && jouleBridge.connected ? 'Connected' : 'Demo Mode'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Coming Soon Notice */}
        {!bridgeAvailable || !jouleBridge.connected ? (
          <div className="mb-6 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-purple-500/10 border border-purple-500/30 rounded-xl p-6 relative overflow-hidden">
            <div className="flex items-start gap-4 relative z-10">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-400/30 flex items-center justify-center animate-pulse">
                  <Sparkles className="w-6 h-6 text-purple-300" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-3 py-1 bg-purple-500/20 border border-purple-400/30 rounded-md text-xs font-semibold text-purple-200 uppercase tracking-wider">
                    Coming Soon
                  </span>
                </div>
                <p className="text-base text-white font-semibold mb-2">
                  <a 
                    href={EBAY_STORE_URL} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:text-purple-200 transition-colors"
                  >
                    Pair with Ecobee to enable full features (Requires Joule Server)
                  </a>
                </p>
                <p className="text-sm text-slate-300">
                  Go to <Link to="/settings/bridge-ai" className="text-purple-300 hover:text-purple-200 underline font-medium">Settings → Bridge & AI</Link> to pair your Ecobee thermostat with the Joule Bridge.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Top Row: Performance, Cost Forecaster, Analyze System */}
          <button
            onClick={(e) => handleFeatureClick("/analysis/energy-flow", e)}
            className="bg-[#0C1118] border border-slate-800 rounded-xl p-6 hover:border-green-500/50 transition-colors text-left w-full"
          >
            <div className="flex items-center gap-3 mb-2">
              <Activity className="w-6 h-6 text-green-400" />
              <h3 className="text-lg font-semibold text-white">Performance</h3>
            </div>
            <p className="text-sm text-[#A7B0BA]">View heat pump performance and efficiency</p>
          </button>

          <button
            onClick={(e) => handleFeatureClick("/analysis/forecast", e)}
            className="bg-[#0C1118] border border-slate-800 rounded-xl p-6 hover:border-green-500/50 transition-colors text-left w-full"
          >
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-6 h-6 text-green-400" />
              <h3 className="text-lg font-semibold text-white">Cost Forecaster</h3>
            </div>
            <p className="text-sm text-[#A7B0BA]">Forecast weekly costs and optimize schedule</p>
          </button>

          <button
            onClick={(e) => handleFeatureClick("/analysis/analyzer", e)}
            className="bg-[#0C1118] border border-slate-800 rounded-xl p-6 hover:border-green-500/50 transition-colors text-left w-full"
          >
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-6 h-6 text-green-400" />
              <h3 className="text-lg font-semibold text-white">Analyze System</h3>
            </div>
            <p className="text-sm text-[#A7B0BA]">Deep dive into system performance</p>
          </button>

          {/* Bottom Row: Monthly Forecast, Optimizer, System Costs, Location Costs */}
          <Link
            to="/analysis/monthly-budget"
            className="bg-[#0C1118] border border-slate-800 rounded-xl p-6 hover:border-blue-500/50 transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-6 h-6 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">Monthly Forecast</h3>
            </div>
            <p className="text-sm text-[#A7B0BA]">View monthly budget and daily breakdown</p>
          </Link>

          <Link
            to="/optimize"
            className="bg-[#0C1118] border border-slate-800 rounded-xl p-6 hover:border-blue-500/50 transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="w-6 h-6 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">Optimizer</h3>
            </div>
            <p className="text-sm text-[#A7B0BA]">One-click optimizations to save money</p>
          </Link>

          <Link
            to="/tools/heat-pump-vs-gas-furnace"
            className="bg-[#0C1118] border border-slate-800 rounded-xl p-6 hover:border-amber-500/50 transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-6 h-6 text-amber-400" />
              <h3 className="text-lg font-semibold text-white">System Costs</h3>
            </div>
            <p className="text-sm text-[#A7B0BA]">Compare heat pump vs gas furnace savings for your climate</p>
          </Link>

          <Link
            to="/tools/city-cost-comparison"
            className="bg-[#0C1118] border border-slate-800 rounded-xl p-6 hover:border-amber-500/50 transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              <MapPin className="w-6 h-6 text-amber-400" />
              <h3 className="text-lg font-semibold text-white">Location Costs</h3>
            </div>
            <p className="text-sm text-[#A7B0BA]">See how your utility rates compare to other cities</p>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HomeDashboard;
