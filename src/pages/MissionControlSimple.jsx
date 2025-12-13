import React, { useMemo, useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Sparkles,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  TrendingDown,
  DollarSign,
  Settings as SettingsIcon,
} from "lucide-react";
import AskJoule from "../components/AskJoule";
import { calculateBalancePoint } from "../utils/balancePointCalculator";
import { getCached, getCachedBatch } from "../utils/cachedStorage";
import {
  getAnnualHDD,
  getAnnualCDD,
  calculateAnnualHeatingCostFromHDD,
  calculateAnnualCoolingCostFromCDD,
} from "../lib/hddData";
import {
  estimateMonthlyHeatingCostFromHDD,
} from "../lib/budgetUtils";
import {
  defaultFixedChargesByState,
  defaultFallbackFixedCharges,
  normalizeStateToAbbreviation,
} from "../data/fixedChargesByState";
import { loadThermostatSettings } from "../lib/thermostatSettings";
import { STATE_ELECTRICITY_RATES, getStateElectricityRate } from "../data/stateRates";
import { getStateCode, fetchLiveElectricityRate } from "../lib/eiaRates";
import { useJouleBridgeContext } from "../contexts/JouleBridgeContext";

const currency = (v) => `$${(v ?? 0).toFixed(2)}`;

// Stable empty object for outlet context fallback
const EMPTY_OUTLET = {};

const MissionControlSimple = () => {
  const [showNerdMode, setShowNerdMode] = useState(false);
  const [showAskJoule, setShowAskJoule] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizerStatus, setOptimizerStatus] = useState(null); // "updated" | "unchanged" | null
  const [isAutoOptimizing, setIsAutoOptimizing] = useState(false);
  const [autoOptimizeResults, setAutoOptimizeResults] = useState(null); // { enabled: boolean, alreadyEnabled: boolean, changes: string[] }
  const [showLearnMoreAutoOptimize, setShowLearnMoreAutoOptimize] = useState(false);
  
  // Get cached data
  const cachedData = useMemo(() => {
    const activeZoneId = getCached("activeZoneId", "zone1");
    const zoneKey = `spa_resultsHistory_${activeZoneId}`;
    
    return getCachedBatch([
      zoneKey,
      "spa_resultsHistory",
      "userLocation",
      "activeZoneId"
    ]);
  }, []);

  const resultsHistory = useMemo(() => {
    const activeZoneId = cachedData["activeZoneId"] || "zone1";
    const zoneKey = `spa_resultsHistory_${activeZoneId}`;
    const zoneHistory = cachedData[zoneKey];
    
    if (zoneHistory && Array.isArray(zoneHistory) && zoneHistory.length > 0) {
      return zoneHistory;
    }
    return cachedData["spa_resultsHistory"] || [];
  }, [cachedData]);

  const latestAnalysis = resultsHistory && resultsHistory.length > 0 ? resultsHistory[resultsHistory.length - 1] : null;
  const userLocation = useMemo(() => cachedData["userLocation"] || null, [cachedData]);

  // Get outlet context
  const outletContext = useOutletContext();
  const outlet = useMemo(() => outletContext || EMPTY_OUTLET, [outletContext]);
  const { userSettings: ctxUserSettings } = outlet;
  const userSettings = useMemo(() => {
    return ctxUserSettings || (typeof outlet.primarySystem !== "undefined" ? { ...outlet } : {});
  }, [ctxUserSettings, outlet]);

  const settings = useMemo(() => userSettings || {}, [userSettings]);

  // Fetch electricity rate (same as Budget page)
  const [electricityRate, setElectricityRate] = useState(null);
  useEffect(() => {
    const fetchRate = async () => {
      if (!userLocation?.state) {
        setElectricityRate(settings.utilityCost || 0.15);
        return;
      }
      
      try {
        const stateCode = getStateCode(userLocation.state);
        if (stateCode) {
          const liveData = await fetchLiveElectricityRate(stateCode);
          if (liveData?.rate) {
            setElectricityRate(liveData.rate);
            return;
          }
        }
      } catch (err) {
        console.warn(`EIA API failed for ${userLocation.state}, using fallback`, err);
      }
      
      // Fallback to state hardcoded rate
      const fallbackRate = getStateElectricityRate(userLocation.state);
      setElectricityRate(fallbackRate || settings.utilityCost || 0.15);
    };
    
    fetchRate();
  }, [userLocation?.state, settings.utilityCost]);

  // Joule Bridge integration - use shared context (persists across navigation)
  const jouleBridge = useJouleBridgeContext();
  const bridgeAvailable = jouleBridge.bridgeAvailable;

  // State - get from Joule Bridge if available, otherwise localStorage or defaults
  const currentTemp = useMemo(() => {
    // If demo mode is disabled or Joule Bridge is connected, use real data
    const demoModeDisabled = localStorage.getItem("demoModeDisabled") === "true";
    
    // Debug logging
    if (demoModeDisabled) {
      console.log("[Mission Control] Demo mode disabled, checking Joule Bridge data:", {
        bridgeAvailable,
        connected: jouleBridge.connected,
        temperature: jouleBridge.temperature,
        error: jouleBridge.error,
        loading: jouleBridge.loading
      });
    }
    
    if (demoModeDisabled || (bridgeAvailable && jouleBridge.connected && jouleBridge.temperature !== null)) {
      const temp = jouleBridge.temperature;
      if (temp !== null && temp !== undefined) {
        console.log("[Mission Control] Using Joule Bridge temperature:", temp);
        return temp;
      }
    }
    
    // Fallback to localStorage
    try {
      const state = JSON.parse(localStorage.getItem("thermostatState") || '{"currentTemp": 72}');
      const fallbackTemp = state.currentTemp || 72;
      console.log("[Mission Control] Using localStorage temperature:", fallbackTemp);
      return fallbackTemp;
    } catch {
      console.log("[Mission Control] Using default temperature: 72");
      return 72;
    }
  }, [jouleBridge.temperature, jouleBridge.connected, bridgeAvailable, jouleBridge.error, jouleBridge.loading]);

  const systemStatus = useMemo(() => {
    try {
      const savedMode = localStorage.getItem("hvacMode") || "heat";
      const modeLabels = { heat: "HEAT ON", cool: "COOL ON", auto: "AUTO ON", off: "SYSTEM OFF" };
      return modeLabels[savedMode] || "HEAT ON";
    } catch {
      return "HEAT ON";
    }
  }, []);

  const outdoorTemp = useMemo(() => {
    // In real app, this would come from weather API or thermostat data
    return 45;
  }, []);

  // Get balance point and calculate issues
  const balancePoint = useMemo(() => {
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
        const designHeatLoss = (settings.squareFeet || 1500) * BASE_BTU_PER_SQFT_HEATING * 
          (settings.insulationLevel || 1.0) * (settings.homeShape || 1.0) * ceilingMultiplier;
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
  }, [settings, latestAnalysis]);

  const usingAux = useMemo(() => {
    return systemStatus === "HEAT ON" && outdoorTemp < balancePoint;
  }, [systemStatus, outdoorTemp, balancePoint]);

  // Calculate issues/problems
  const issues = useMemo(() => {
    const problems = [];
    
    if (usingAux && outdoorTemp < balancePoint) {
      problems.push({
        icon: "💸",
        problem: `Heat strips came on at ${outdoorTemp}°F`,
        impact: "mildly annoying",
        fix: "Reduce Strip-Heat Use",
        fixAction: () => {
          window.dispatchEvent(new CustomEvent('askJouleSetQuestion', {
            detail: { question: "How can I reduce strip heat usage?", autoSubmit: true }
          }));
        }
      });
    }
    
    if (systemStatus === "HEAT ON" && outdoorTemp < 32) {
      problems.push({
        icon: "🥶",
        problem: "Running inefficient mode in cold weather",
        impact: "moderate",
        fix: "Switch to Cold-Weather Mode",
        fixAction: () => {
          window.dispatchEvent(new CustomEvent('askJouleSetQuestion', {
            detail: { question: "How should I set my thermostat for cold weather?", autoSubmit: true }
          }));
        }
      });
    }
    
    // Check for frequent defrost cycles (mock data - in real app, use actual data)
    if (usingAux) {
      problems.push({
        icon: "🍞",
        problem: "Defrost cycles too frequent",
        impact: "low",
        fix: "Tune Defrost Behavior",
        fixAction: () => {
          window.dispatchEvent(new CustomEvent('askJouleSetQuestion', {
            detail: { question: "Why is my heat pump defrosting so often?", autoSubmit: true }
          }));
        }
      });
    }
    
    return problems;
  }, [usingAux, outdoorTemp, systemStatus, balancePoint]);

  // Calculate annual cost estimate using HDD/CDD (matches budget page)
  const annualCost = useMemo(() => {
    if (!userLocation) {
      // Fallback to simplified calculation if no location
      const utilityCost = settings.utilityCost || 0.15;
      const hspf2 = settings.hspf2 || 9;
      const heatLossFactor = settings.manualHeatLoss || 
        (settings.squareFeet ? (settings.squareFeet * 22.67 * (settings.insulationLevel || 1.0) / 70) : 314);
      const deltaT = Math.max(0, (settings.winterThermostat || 70) - outdoorTemp);
      const hourlyHeatLossBtu = heatLossFactor * deltaT;
      const hourlyKwh = hourlyHeatLossBtu / (hspf2 * 1000);
      const dailyCost = (hourlyKwh * utilityCost * 24);
      return dailyCost * 365;
    }

    // Use same calculation method as Home.jsx and MonthlyBudgetPlanner
    const useManualHeatLoss = Boolean(settings?.useManualHeatLoss);
    const useCalculatedHeatLoss = settings?.useCalculatedHeatLoss !== false;
    const useAnalyzerHeatLoss = Boolean(settings?.useAnalyzerHeatLoss);
    let heatLossFactor;
    
    // Calculate ceiling multiplier
    const ceilingMultiplier = 1 + ((settings.ceilingHeight || 8) - 8) * 0.1;
    
    // Priority 1: Manual Entry
    if (useManualHeatLoss) {
      const manualHeatLossFactor = Number(settings?.manualHeatLoss);
      if (Number.isFinite(manualHeatLossFactor) && manualHeatLossFactor > 0) {
        heatLossFactor = manualHeatLossFactor;
      }
    }
    
    // Priority 2: Analyzer Data
    if (!heatLossFactor && useAnalyzerHeatLoss && latestAnalysis?.heatLossFactor) {
      heatLossFactor = latestAnalysis.heatLossFactor;
    }
    
    // Priority 3: Calculated from Building Characteristics
    if (!heatLossFactor && useCalculatedHeatLoss) {
      const BASE_BTU_PER_SQFT_HEATING = 22.67;
      const designHeatLoss =
        (settings.squareFeet || 1500) *
        BASE_BTU_PER_SQFT_HEATING *
        (settings.insulationLevel || 1.0) *
        (settings.homeShape || 1.0) *
        ceilingMultiplier;
      heatLossFactor = designHeatLoss / 70;
    }
    
    // Fallback: Use analyzer data if available
    if (!heatLossFactor && latestAnalysis?.heatLossFactor) {
      heatLossFactor = latestAnalysis.heatLossFactor;
    }

    if (!heatLossFactor) {
      return 0;
    }

    // Get elevation multiplier
    const globalHomeElevation =
      typeof settings?.homeElevation === "number"
        ? settings.homeElevation
        : userLocation && typeof userLocation.elevation === "number"
        ? userLocation.elevation
        : 0;
    const elevationMultiplierRaw = 1 + ((globalHomeElevation || 0) / 1000) * 0.005;
    const elevationMultiplier = Math.max(0.8, Math.min(1.3, elevationMultiplierRaw));

    // Get annual HDD and calculate heating cost
    const annualHDD = getAnnualHDD(
      `${userLocation.city}, ${userLocation.state}`,
      userLocation.state
    );
    const heatingThermostatMultiplier = (settings.winterThermostat || 70) / 70;
    const useElectricAuxHeat = settings.useElectricAuxHeat;
    // Use fetched electricity rate (same as Budget page), fallback to settings if not loaded yet
    const effectiveElectricityRateAnnual = electricityRate !== null ? electricityRate : (settings.utilityCost || 0.15);
    
    const annualHeatingCost = calculateAnnualHeatingCostFromHDD(
      annualHDD,
      heatLossFactor,
      settings.hspf2 || 9.0,
      effectiveElectricityRateAnnual,
      useElectricAuxHeat
    );
    annualHeatingCost.energy *= heatingThermostatMultiplier;
    annualHeatingCost.cost *= heatingThermostatMultiplier;
    annualHeatingCost.energy *= elevationMultiplier;
    annualHeatingCost.cost *= elevationMultiplier;

    // Get annual CDD and calculate cooling cost
    const annualCDD = getAnnualCDD(
      `${userLocation.city}, ${userLocation.state}`,
      userLocation.state
    );
    const BASE_BTU_PER_SQFT_COOLING = 28.0;
    const designHeatGain =
      (settings.squareFeet || 1500) *
      BASE_BTU_PER_SQFT_COOLING *
      (settings.insulationLevel || 1.0) *
      (settings.homeShape || 1.0) *
      ceilingMultiplier *
      (settings.solarExposure || 1.0);
    const heatGainFactor = designHeatGain / 20;

    const coolingThermostatMultiplier = 74 / (settings.summerThermostat || 74);
    const annualCoolingCost = calculateAnnualCoolingCostFromCDD(
      annualCDD,
      heatGainFactor,
      settings.efficiency || 15.0,
      effectiveElectricityRateAnnual
    );
    annualCoolingCost.energy *= coolingThermostatMultiplier;
    annualCoolingCost.cost *= coolingThermostatMultiplier;
    annualCoolingCost.energy *= elevationMultiplier;
    annualCoolingCost.cost *= elevationMultiplier;

    // Get fixed charges
    const stateAbbr = normalizeStateToAbbreviation(userLocation.state);
    const fixedCharges = stateAbbr && defaultFixedChargesByState[stateAbbr]
      ? defaultFixedChargesByState[stateAbbr]
      : defaultFallbackFixedCharges;
    
    // Use user's fixed charges if set, otherwise use state defaults
    const fixedElectricCost = settings.fixedElectricCost ?? fixedCharges.electric;
    const fixedGasCost = settings.fixedGasCost ?? fixedCharges.gas;
    const primarySystem = settings.primarySystem || "heatPump";
    
    // Annual fixed charges = monthly × 12
    const annualFixedCharges = (fixedElectricCost * 12) + 
      (primarySystem === "gasFurnace" ? fixedGasCost * 12 : 0);

    // Total annual cost = heating + cooling + fixed charges
    return annualHeatingCost.cost + annualCoolingCost.cost + annualFixedCharges;
  }, [settings, userLocation, latestAnalysis, outdoorTemp, electricityRate]);

  // Calculate monthly heating cost for current month (matches budget page logic)
  const monthlyHeatingCost = useMemo(() => {
    if (!userLocation) {
      return null;
    }

    // Calculate heatLossFactor (same logic as annual cost)
    const useManualHeatLoss = Boolean(settings?.useManualHeatLoss);
    const useCalculatedHeatLoss = settings?.useCalculatedHeatLoss !== false;
    const useAnalyzerHeatLoss = Boolean(settings?.useAnalyzerHeatLoss);
    let heatLossFactor;
    
    const ceilingMultiplier = 1 + ((settings.ceilingHeight || 8) - 8) * 0.1;
    
    if (useManualHeatLoss) {
      const manualHeatLossFactor = Number(settings?.manualHeatLoss);
      if (Number.isFinite(manualHeatLossFactor) && manualHeatLossFactor > 0) {
        heatLossFactor = manualHeatLossFactor;
      }
    }
    
    if (!heatLossFactor && useAnalyzerHeatLoss && latestAnalysis?.heatLossFactor) {
      heatLossFactor = latestAnalysis.heatLossFactor;
    }
    
    if (!heatLossFactor && useCalculatedHeatLoss) {
      const BASE_BTU_PER_SQFT_HEATING = 22.67;
      const designHeatLoss =
        (settings.squareFeet || 1500) *
        BASE_BTU_PER_SQFT_HEATING *
        (settings.insulationLevel || 1.0) *
        (settings.homeShape || 1.0) *
        ceilingMultiplier;
      heatLossFactor = designHeatLoss / 70;
    }
    
    if (!heatLossFactor && latestAnalysis?.heatLossFactor) {
      heatLossFactor = latestAnalysis.heatLossFactor;
    }

    if (!heatLossFactor) {
      return null;
    }

    const currentMonth = new Date().getMonth() + 1; // 1-12 (Jan-Dec)
    
    // Monthly HDD distribution (same as budget page)
    const monthlyHDDDist = [1200, 1000, 600, 200, 50, 10, 0, 0, 20, 200, 500, 1100]; // Jan-Dec
    const totalTypicalHDD = monthlyHDDDist.reduce((a, b) => a + b, 0); // ~4880
    
    // Get location-specific annual HDD
    const annualHDD = getAnnualHDD(
      `${userLocation.city}, ${userLocation.state}`,
      userLocation.state
    );
    
    // Scale monthly HDD to location's annual total (same as budget page)
    const monthIndex = currentMonth - 1; // Convert 1-12 to 0-11
    const monthHDD = totalTypicalHDD > 0 ? (monthlyHDDDist[monthIndex] / totalTypicalHDD) * annualHDD : 0;
    
    // If no HDD for this month, return null
    if (monthHDD <= 0) {
      return null;
    }
    
    // Calculate temperature multiplier - use actual thermostat settings first
    // Priority: 1) userSettings.winterThermostatDay/Night, 2) thermostatSettings comfortSettings, 3) defaults
    let winterDayTemp = settings.winterThermostatDay;
    let winterNightTemp = settings.winterThermostatNight;
    
    // If not in userSettings, check thermostat settings
    if (winterDayTemp === undefined || winterNightTemp === undefined) {
      try {
        const thermostatSettings = loadThermostatSettings();
        const comfortSettings = thermostatSettings?.comfortSettings;
        
        if (winterDayTemp === undefined) {
          winterDayTemp = comfortSettings?.home?.heatSetPoint ?? settings.winterThermostat ?? 70;
        }
        if (winterNightTemp === undefined) {
          winterNightTemp = comfortSettings?.sleep?.heatSetPoint ?? 66; // Default is 66, not 68
        }
      } catch {
        // Fallback to defaults if thermostat settings can't be loaded
        if (winterDayTemp === undefined) {
          winterDayTemp = settings.winterThermostat ?? 70;
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
    
    // Use fetched electricity rate (same as Budget page), fallback to settings if not loaded yet
    const effectiveElectricityRate = electricityRate !== null ? electricityRate : (settings.utilityCost || 0.15);
    
    // Calculate monthly heating cost
    const estimate = estimateMonthlyHeatingCostFromHDD({
      hdd: monthHDD,
      squareFeet: settings.squareFeet || 1500,
      insulationLevel: settings.insulationLevel || 1.0,
      homeShape: settings.homeShape || 1.0,
      ceilingHeight: settings.ceilingHeight || 8,
      hspf: settings.hspf2 || 9.0,
      electricityRate: effectiveElectricityRate,
    });
    
    // Apply temperature multiplier (same as budget page)
    if (estimate && estimate.cost > 0) {
      estimate.cost = estimate.cost * winterTempMultiplier;
    }
    
    // Add fixed charges (monthly)
    const stateAbbr = normalizeStateToAbbreviation(userLocation.state);
    const fixedCharges = stateAbbr && defaultFixedChargesByState[stateAbbr]
      ? defaultFixedChargesByState[stateAbbr]
      : defaultFallbackFixedCharges;
    const fixedElectricCost = settings.fixedElectricCost ?? fixedCharges.electric;
    const fixedGasCost = settings.fixedGasCost ?? fixedCharges.gas;
    const primarySystem = settings.primarySystem || "heatPump";
    const monthlyFixedCharge = primarySystem === "gasFurnace" ? fixedGasCost : fixedElectricCost;
    
    return (estimate?.cost || 0) + monthlyFixedCharge;
  }, [settings, userLocation, latestAnalysis, electricityRate]);

  // Determine main banner message
  const mainMessage = useMemo(() => {
    if (issues.length > 0) {
      return {
        type: "problem",
        title: "Your System Needs Attention",
        subtitle: issues.length === 1 ? "There's one issue to fix." : `There are ${issues.length} issues to fix.`,
        buttonText: "✨ Make It Run Better"
      };
    } else {
      return {
        type: "good",
        title: "Relax. I'm taking care of things.",
        subtitle: "Your heat pump is running smoothly and everything looks just the way it should.",
        buttonText: "✨ Keep Things Running Smoothly"
      };
    }
  }, [issues]);

  // Event log (simplified, human-friendly, text-like)
  const eventLog = useMemo(() => {
    const events = [];
    
    if (usingAux) {
      events.push({
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        message: "All good. Nothing unusual today.",
        details: `It got a bit cold (${outdoorTemp}°F), but everything's handling it fine.`
      });
    }
    
    const hasOptimizerSchedule = localStorage.getItem('optimizerSchedule');
    if (hasOptimizerSchedule) {
      events.push({
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        message: "System ran a quick check.",
        details: "Everything's normal."
      });
    }
    
    // Always add a default "all good" message
    if (events.length === 0 || !usingAux) {
      events.push({
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        message: "All good. Everything is running as expected.",
        details: ""
      });
    }
    
    return events.slice(0, 5);
  }, [usingAux, outdoorTemp]);

  const handleOptimize = async () => {
    setIsOptimizing(true);
    setOptimizerStatus(null);
    
    setTimeout(() => {
      // Calculate optimized setpoints based on recommendation (68°F day / 66°F night)
      const currentWinter = settings.winterThermostat || 70;
      const optimizedDay = Math.max(68, currentWinter - 2); // 68°F day
      const optimizedNight = Math.max(66, optimizedDay - 2); // 66°F night
      
      // Check if settings actually need to change
      const hasExistingSchedule = localStorage.getItem('optimizerSchedule');
      const settingsChanged = !hasExistingSchedule || 
        (currentWinter !== optimizedDay && currentWinter !== optimizedNight);
      
      // Determine current time and which setpoint to apply
      const now = new Date();
      const currentHour = now.getHours();
      const isNighttime = currentHour >= 22 || currentHour < 6;
      const targetSetpoint = isNighttime ? optimizedNight : optimizedDay;
      
      // Save optimizer schedule to localStorage
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
        try {
          // Use outlet from component scope (defined above)
          const currentOutlet = outlet;
          
          if (currentOutlet?.setUserSetting) {
            currentOutlet.setUserSetting("winterThermostat", targetSetpoint, {
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
        
        // Set status based on whether changes were made
        setOptimizerStatus(settingsChanged ? "updated" : "unchanged");
        
        // Clear status message after 5 seconds
        setTimeout(() => {
          setOptimizerStatus(null);
        }, 5000);
        
      } catch (e) {
        console.warn("Failed to save optimizer schedule:", e);
        setOptimizerStatus("unchanged");
        setTimeout(() => {
          setOptimizerStatus(null);
        }, 5000);
      }
      
      setIsOptimizing(false);
    }, 1500); // Simulate optimization delay
  };

  const handleFixClick = () => {
    // Always run the optimizer
    handleOptimize();
  };

  const handleAutoOptimize = async () => {
    setIsAutoOptimizing(true);
    setAutoOptimizeResults(null);
    
    setTimeout(() => {
      const changes = [];
      let auxThresholdReduced = false;
      let scheduleOptimized = false;
      let setbacksApplied = false;
      
      try {
        // 1. Enable auto-optimize mode
        const userSettings = JSON.parse(localStorage.getItem("userSettings") || "{}");
        const wasAlreadyEnabled = userSettings.autoOptimize === true;
        userSettings.autoOptimize = true;
        localStorage.setItem("userSettings", JSON.stringify(userSettings));
        
        // 2. Calculate optimized setpoints
        const currentWinter = settings.winterThermostat || 70;
        const optimizedDay = Math.max(68, currentWinter - 2); // 68°F day
        const optimizedNight = Math.max(66, optimizedDay - 2); // 66°F night
        
        // Check if schedule needs updating
        const existingSchedule = localStorage.getItem('optimizerSchedule');
        if (!existingSchedule || currentWinter !== optimizedDay) {
          const optimizedSchedule = {
            blocks: [
              { start: "00:00", end: "06:00", setpoint: optimizedNight },
              { start: "06:00", end: "22:00", setpoint: optimizedDay },
              { start: "22:00", end: "24:00", setpoint: optimizedNight },
            ],
            appliedAt: new Date().toISOString(),
            autoMode: true,
          };
          localStorage.setItem("optimizerSchedule", JSON.stringify(optimizedSchedule));
          localStorage.setItem("optimizerScheduleAppliedAt", new Date().toISOString());
          scheduleOptimized = true;
          changes.push("Optimized heating schedule (68°F day, 66°F night)");
        }
        
        // 3. Update thermostat target temperature
        const now = new Date();
        const currentHour = now.getHours();
        const isNighttime = currentHour >= 22 || currentHour < 6;
        const targetSetpoint = isNighttime ? optimizedNight : optimizedDay;
        
        try {
          const currentOutlet = outlet;
          if (currentOutlet?.setUserSetting) {
            currentOutlet.setUserSetting("winterThermostat", targetSetpoint, {
              source: "AutoOptimizer",
              comment: "Auto-optimize mode enabled",
            });
          } else {
            const userSettingsUpdate = JSON.parse(localStorage.getItem("userSettings") || "{}");
            userSettingsUpdate.winterThermostat = targetSetpoint;
            localStorage.setItem("userSettings", JSON.stringify(userSettingsUpdate));
          }
        } catch (e) {
          console.warn("Failed to update userSettings:", e);
        }
        
        // 4. Update thermostatState
        try {
          const thermostatState = JSON.parse(
            localStorage.getItem("thermostatState") || '{"targetTemp": 70, "mode": "heat", "preset": "home"}'
          );
          if (thermostatState.targetTemp !== targetSetpoint) {
            thermostatState.targetTemp = targetSetpoint;
            localStorage.setItem("thermostatState", JSON.stringify(thermostatState));
            window.dispatchEvent(new CustomEvent("targetTempChanged", {
              detail: { temp: targetSetpoint, temperature: targetSetpoint, source: "auto-optimizer" }
            }));
          }
        } catch (e) {
          console.warn("Failed to update thermostatState:", e);
        }
        
        // 5. Reduce aux threshold if balance point is available
        if (balancePoint && Number.isFinite(balancePoint)) {
          const currentAuxThreshold = settings.auxHeatThreshold || 35;
          const optimalThreshold = Math.max(balancePoint + 2, 30); // Balance point + 2°F safety margin
          
          if (currentAuxThreshold > optimalThreshold) {
            try {
              const userSettingsAux = JSON.parse(localStorage.getItem("userSettings") || "{}");
              userSettingsAux.auxHeatThreshold = optimalThreshold;
              localStorage.setItem("userSettings", JSON.stringify(userSettingsAux));
              auxThresholdReduced = true;
              changes.push(`Lowered aux heat threshold to ${optimalThreshold}°F to reduce strip usage`);
            } catch (e) {
              console.warn("Failed to update aux threshold:", e);
            }
          }
        }
        
        // 6. Apply conservative setbacks
        if (!setbacksApplied && scheduleOptimized) {
          setbacksApplied = true;
          changes.push("Applied comfort-focused nighttime setbacks");
        }
        
        // 7. Enable intelligent monitoring flag
        localStorage.setItem("jouleAutoModeEnabled", "true");
        localStorage.setItem("jouleAutoModeEnabledAt", new Date().toISOString());
        
        // 8. If this is the first time enabling, add initial win message
        if (!wasAlreadyEnabled) {
          changes.push("Joule will continue tuning things automatically");
        }
        
        // Determine if any actual changes were made (not just re-enabling)
        const hasNewChanges = changes.length > 0 && (scheduleOptimized || auxThresholdReduced);
        
        // Set results - include whether it was already enabled and if there were new changes
        setAutoOptimizeResults({
          enabled: true,
          alreadyEnabled: wasAlreadyEnabled && !hasNewChanges, // Already enabled AND no new changes
          changes: hasNewChanges ? changes : (wasAlreadyEnabled 
            ? [] // Don't show bullet points when already enabled - show custom message in UI instead
            : ["Auto-optimize mode enabled - Joule will monitor and adjust automatically"]),
          auxReduced: auxThresholdReduced,
          scheduleOptimized: scheduleOptimized,
        });
        
        // Clear results after 10 seconds
        setTimeout(() => {
          setAutoOptimizeResults(prev => {
            // Keep it shown but mark as "stable"
            return prev ? { ...prev, stable: true } : null;
          });
        }, 10000);
        
      } catch (e) {
        console.warn("Auto-optimize failed:", e);
        setAutoOptimizeResults({
          enabled: false,
          changes: ["Unable to enable auto-optimize. Please try again."],
        });
      }
      
      setIsAutoOptimizing(false);
    }, 1500); // Simulate processing delay
  };

  return (
    <div className="min-h-screen bg-[#050B10]">
      <div className="mx-auto max-w-[900px] px-6 lg:px-8 py-2">
        
        {/* Page Header - Compact */}
        <header className="mb-2">
          <h1 className="text-xl font-semibold text-white">
            Home Health
          </h1>
          <p className="text-xs text-[#A7B0BA] mt-0.5">
            Your system's daily wellness check.
          </p>
        </header>

        {/* SECTION 1: Big Banner - Compact */}
        <section className="mb-2">
          <div className={`rounded-lg p-3 border-2 ${
            mainMessage.type === "problem" 
              ? "bg-amber-500/10 border-amber-500/40" 
              : "bg-emerald-500/10 border-emerald-500/40"
          }`}>
            <div className="text-center">
              <h2 className="text-lg font-bold text-white mb-1">
                {mainMessage.title}
              </h2>
              <p className="text-sm text-slate-300 mb-2">
                {mainMessage.subtitle}
              </p>
              <button
                onClick={handleFixClick}
                disabled={isOptimizing}
                className="px-6 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-all shadow-lg hover:shadow-xl"
              >
                {isOptimizing ? "Optimizing..." : mainMessage.buttonText}
              </button>
              {optimizerStatus && (
                <p className={`text-xs mt-2 ${
                  optimizerStatus === "updated" 
                    ? "text-emerald-400" 
                    : "text-slate-400"
                }`}>
                  {optimizerStatus === "updated" 
                    ? "✓ Settings updated" 
                    : "Everything looks good — no changes needed"}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* SECTION 2: System Health - "Here's What's Happening" - Compact */}
        {issues.length > 0 && (
          <section className="mb-2">
            <div className="bg-[#0C1118] border border-slate-800 rounded-lg p-2">
              <h3 className="text-sm font-medium text-[#E8EDF3] mb-2">
                🔥 Here's What's Happening
              </h3>
              
              {issues.length > 0 && (
                <div className="mb-2 p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <p className="text-sm text-slate-300 mb-1">
                    Your heat pump is working harder than usual today.
                  </p>
                  <p className="text-xs text-slate-400 mb-3">
                    {usingAux && outdoorTemp < balancePoint 
                      ? `Cold weather hit, and your system is dipping into auxiliary heat more than it should.` 
                      : "There are some efficiency improvements we can make."}
                  </p>
                  
                  <div>
                    <p className="text-xs text-slate-400 mb-2">
                      <strong className="text-slate-300">Why It Matters:</strong> That means higher bills and lower efficiency.
                    </p>
                    <button
                      onClick={handleOptimize}
                      disabled={isOptimizing}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-2"
                    >
                      <Sparkles className="w-3 h-3" />
                      {isOptimizing ? "Tuning..." : "Let Joule tune my settings"}
                    </button>
                    {optimizerStatus && (
                      <p className={`text-xs mt-1 ${
                        optimizerStatus === "updated" 
                          ? "text-emerald-400" 
                          : "text-slate-400"
                      }`}>
                        {optimizerStatus === "updated" 
                          ? "✓ Settings updated" 
                          : "Everything looks good — no changes needed"}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      Joule will reduce strip-heat usage and tune your schedule automatically.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* SECTION 3: Today's Issues - Problem Cards - Compact */}
        {issues.length > 0 && (
          <section className="mb-2">
            <div className="bg-[#0C1118] border border-slate-800 rounded-lg p-2">
              <h3 className="text-sm font-medium text-[#E8EDF3] mb-2">
                Today's Issues
              </h3>
              
              <div className="space-y-2">
                {issues.map((issue, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-2">
                    <div className="flex items-start gap-2">
                      <span className="text-lg">{issue.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-slate-200 font-medium">
                            Problem: {issue.problem}
                          </p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            issue.impact === "low" ? "bg-blue-500/20 text-blue-300" :
                            issue.impact === "mildly annoying" ? "bg-amber-500/20 text-amber-300" :
                            "bg-orange-500/20 text-orange-300"
                          }`}>
                            {issue.impact}
                          </span>
                        </div>
                        <button
                          onClick={issue.fixAction}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 mt-1"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          {issue.fix === "Reduce Strip-Heat Use" ? "Make It Run Better" :
                           issue.fix === "Switch to Cold-Weather Mode" ? "Make It Run Better" :
                           issue.fix === "Tune Defrost Behavior" ? "Make It Run Better" :
                           issue.fix}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* SECTION 5: Active Intelligence Feed - Human-Friendly - Compact */}
        <section className="mb-2">
          <div className="bg-[#0C1118] border border-slate-800 rounded-lg p-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-[#E8EDF3]">
                📡 What's Been Happening
              </h3>
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">Today</span>
            </div>
            
            <div className="space-y-1">
              {eventLog.map((event, idx) => (
                <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-1.5">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-400 font-medium text-[10px] flex-shrink-0 mt-0.5">
                      {event.time}
                    </span>
                    <div className="flex-1">
                      <p className="text-xs text-slate-200 font-medium">
                        {event.message}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {event.details}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 6: Ask Joule - Collapsible (moved below What's Been Happening) - Compact */}
        <section className="mb-2">
          <div className="bg-[#0C1118] border border-slate-800 rounded-lg p-2">
            <button
              onClick={() => setShowAskJoule(!showAskJoule)}
              className="w-full flex items-center justify-between p-1.5 hover:bg-slate-900/50 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-slate-100">
                  ▼ Ask Joule (optional)
                </h3>
              </div>
              {showAskJoule ? (
                <ChevronUp className="w-3 h-3 text-slate-400" />
              ) : (
                <ChevronDown className="w-3 h-3 text-slate-400" />
              )}
            </button>
            
            {showAskJoule && (
              <div className="mt-2 pt-2 border-t border-slate-800">
                <p className="text-xs text-slate-400 mb-2">
                  If you're wondering about anything, just ask in plain English.
                </p>
                
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
                />
                
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    "Why is my system turning on so much?",
                    "How can I save money right now?",
                    "Is something wrong with my heat pump?"
                  ].map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('askJouleSetQuestion', {
                          detail: { question: prompt, autoSubmit: true }
                        }));
                      }}
                      className="px-2 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 7: System Status - Collapsible - Compact */}
        <section className="mb-2">
          <div className="bg-[#0C1118] border border-slate-800 rounded-lg p-2">
            <button
              onClick={() => setShowNerdMode(!showNerdMode)}
              className="w-full flex items-center justify-between p-1.5 hover:bg-slate-900/50 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-slate-100">
                  ▼ System Details (optional)
                </h3>
              </div>
              {showNerdMode ? (
                <ChevronUp className="w-3 h-3 text-slate-400" />
              ) : (
                <ChevronDown className="w-3 h-3 text-slate-400" />
              )}
            </button>
            
            {showNerdMode && (
              <div className="mt-2 pt-2 border-t border-slate-800 space-y-2">
                <p className="text-[10px] text-slate-500 mb-2">
                  Only if you're curious — there's nothing you need to adjust.
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400">Indoor temperature:</span>
                    <span className="text-white font-medium ml-1">{currentTemp.toFixed(1)}°F</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Outdoor temperature:</span>
                    <span className="text-white font-medium ml-1">{outdoorTemp}°F</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Balance point:</span>
                    <span className="text-white font-medium ml-1">{balancePoint}°F</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Status:</span>
                    <span className="text-white font-medium ml-1">{systemStatus}</span>
                  </div>
                </div>
                
                {/* Debug: Show raw Joule Bridge data when demo mode is disabled */}
                {localStorage.getItem("demoModeDisabled") === "true" && (
                  <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg text-xs">
                    <div className="font-semibold text-yellow-300 mb-2">🔍 Debug: Raw Joule Bridge Data</div>
                    <div className="space-y-1 text-yellow-200/80 font-mono">
                      <div>Bridge Available: {bridgeAvailable ? "✅" : "❌"}</div>
                      <div>Connected: {jouleBridge.connected ? "✅" : "❌"}</div>
                      <div>Loading: {jouleBridge.loading ? "⏳" : "✅"}</div>
                      <div>Temperature: {jouleBridge.temperature !== null ? `${jouleBridge.temperature}°F` : "null"}</div>
                      <div>Target Temp: {jouleBridge.targetTemperature !== null ? `${jouleBridge.targetTemperature}°F` : "null"}</div>
                      <div>Mode: {jouleBridge.mode || "null"}</div>
                      {jouleBridge.error && (
                        <div className="text-red-400">Error: {jouleBridge.error}</div>
                      )}
                      <div className="mt-2 pt-2 border-t border-yellow-700">
                        <div className="text-yellow-300">Displayed Temp: {currentTemp.toFixed(1)}°F</div>
                        <div className="text-yellow-300">Source: {bridgeAvailable && jouleBridge.connected && jouleBridge.temperature !== null ? "Joule Bridge" : "localStorage/Default"}</div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Temperature chart placeholder - in real app, use actual chart component */}
                <div className="h-20 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-center">
                  <span className="text-slate-500 text-[10px]">Temperature trends will show here as I learn more.</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 8: Cost Forecast - Simplified - Compact */}
        <section className="mb-2">
          <div className="bg-gradient-to-br from-blue-600/15 via-purple-600/15 to-blue-600/15 border-2 border-blue-500/40 rounded-lg p-2">
            <div className="text-center">
              <p className="text-emerald-400 font-medium text-sm mb-1">Good News — You're on Track.</p>
              <p className="text-xs text-slate-300 mb-1">
                Your estimated yearly cost is {currency(annualCost)}.
              </p>
              {monthlyHeatingCost !== null && (
                <p className="text-[10px] text-slate-400 mb-1">
                  🔥 Estimated Monthly Heating Cost: {currency(monthlyHeatingCost)}
                </p>
              )}
              {monthlyHeatingCost === null && (
                <p className="text-[10px] text-slate-400 mb-1">
                  About {currency(annualCost / 12)} per month on average.
                </p>
              )}
              <p className="text-[10px] text-slate-400 mb-2 italic">
                Most similar homes spend more.
              </p>
              <button
                onClick={handleAutoOptimize}
                disabled={isAutoOptimizing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5"
              >
                <TrendingDown className="w-3 h-3" />
                {isAutoOptimizing ? "Enabling Auto Mode..." : "Lower My Bill Automatically"}
              </button>
              {autoOptimizeResults && (
                <div className="mt-1.5 text-left">
                  <p className="text-xs font-medium text-emerald-400 mb-0.5">
                    {autoOptimizeResults.alreadyEnabled
                      ? "✓ Joule is now optimizing your system automatically."
                      : "✓ Joule is now lowering your bill automatically"}
                  </p>
                  {autoOptimizeResults.alreadyEnabled && (
                    <div className="text-[10px] text-slate-300 space-y-0.5 mt-0.5">
                      <p>Your heat pump will stay comfortable while using less energy.</p>
                      <p>Auto-optimize is active — Joule will continue monitoring and adjusting on its own.</p>
                    </div>
                  )}
                  {autoOptimizeResults.changes && autoOptimizeResults.changes.length > 0 && !autoOptimizeResults.alreadyEnabled && (
                    <div className="text-[10px] text-slate-300 space-y-0.5 mt-0.5">
                      {autoOptimizeResults.changes.map((change, idx) => (
                        <p key={idx} className="flex items-start gap-1.5">
                          <span className="text-emerald-400 mt-0.5">•</span>
                          <span>{change}</span>
                        </p>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setShowLearnMoreAutoOptimize(!showLearnMoreAutoOptimize)}
                    className="mt-1 text-[10px] text-slate-400 hover:text-slate-300 transition-colors flex items-center gap-1"
                  >
                    {showLearnMoreAutoOptimize ? (
                      <>
                        <ChevronUp className="w-2.5 h-2.5" />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-2.5 h-2.5" />
                        Learn what Joule adjusts automatically
                      </>
                    )}
                  </button>
                  {showLearnMoreAutoOptimize && (
                    <div className="mt-1 pt-1 border-t border-slate-700/50 text-[9px] text-slate-400 space-y-0.5">
                      <p className="font-medium text-slate-300 text-[10px] mb-0.5">What I Adjust For You</p>
                      <p className="text-[9px] text-slate-400 mb-1 leading-tight">
                        I handle these automatically, with comfort always first:
                      </p>
                      <ul className="space-y-0.5 ml-3 list-disc leading-tight">
                        <li>Notice and soften inefficient heating patterns</li>
                        <li>Help your system warm up smoothly in colder weather</li>
                        <li>Adjust timing based on the forecast to avoid surprises</li>
                        <li>Watch your system 24/7 and make quiet micro-adjustments</li>
                        <li>Reduce unnecessary energy use without changing how your home feels</li>
                      </ul>
                      <p className="text-[8px] text-slate-500 mt-1 leading-tight italic">
                        Every change is gentle — nothing sudden, nothing aggressive.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Everything Else Section - Compact */}
        {issues.length === 0 && (
          <section className="mb-2">
            <div className="bg-[#0C1118] border border-slate-800 rounded-lg p-2">
              <h3 className="text-xs font-medium text-[#E8EDF3] mb-0.5">
                🌱 Everything Else is Fine.
              </h3>
              <p className="text-[10px] text-slate-400">
                I'm here, watching for anything unusual, and I'll let you know if something needs attention.
              </p>
            </div>
          </section>
        )}

      </div>
    </div>
  );
};

export default MissionControlSimple;

