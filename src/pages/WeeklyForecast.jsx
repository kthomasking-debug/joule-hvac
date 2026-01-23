import React, { useMemo, useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import {
  Thermometer,
  DollarSign,
  Zap,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  X,
  Info,
  Settings,
  BarChart3,
  Code,
  Calendar,
} from "lucide-react";
import { useJouleBridgeContext } from "../contexts/JouleBridgeContext";
import EcobeePairingOnboarding from "../components/EcobeePairingOnboarding";
import useForecast from "../hooks/useForecast";
import * as heatUtils from "../lib/heatUtils";
import { getCached } from "../utils/cachedStorage";
import { 
  useUnitSystem, 
  formatTemperatureFromF, 
  formatEnergyFromKwh, 
  formatHeatLossFactor,
  formatCapacityFromTons,
  formatJoulesParts,
  kwhToJ,
  UNIT_SYSTEMS
} from "../lib/units";
import {
  fetchLiveElectricityRate,
  getStateCode,
} from "../lib/eiaRates";
import { getStateElectricityRate } from "../data/stateRates";

/**
 * WeeklyForecast - Simplified 7-day cost forecast using Ecobee target temp directly
 * 
 * This page calculates costs using the actual target temperature from the Ecobee
 * thermostat via HomeKit (Joule Bridge), without any scheduling complexity.
 */
const WeeklyForecast = () => {
  // Route guard: redirect to onboarding if not completed
  const navigate = useNavigate();
  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem("hasCompletedOnboarding") === "true";
    if (!hasCompletedOnboarding) {
      navigate("/onboarding");
    }
  }, [navigate]);
  
  // Get outlet context for user settings
  const outletContext = useOutletContext() || {};
  const { userSettings = {} } = outletContext;
  
  // Unit system
  const { unitSystem } = useUnitSystem();
  const nerdMode = userSettings?.nerdMode || false;
  const effectiveUnitSystem = nerdMode ? UNIT_SYSTEMS.INTL : unitSystem;
  const [showPairingOnboarding, setShowPairingOnboarding] = useState(false);
  
  // Helper function to format energy values
  const formatEnergy = useMemo(() => {
    return (kwh) => {
      if (kwh == null || isNaN(kwh)) return "—";
      const kwhNum = typeof kwh === 'string' ? parseFloat(kwh) : kwh;
      if (nerdMode) {
        const joules = kwhToJ(kwhNum);
        const { value, unit } = formatJoulesParts(joules);
        return `${value} ${unit} (${kwhNum.toFixed(1)} kWh)`;
      }
      return formatEnergyFromKwh(kwhNum, effectiveUnitSystem, { decimals: 1 });
    };
  }, [nerdMode, effectiveUnitSystem]);
  
  // Get user location from cache
  const userLocation = useMemo(() => getCached("userLocation", null), []);
  
  // Joule Bridge integration - use shared context (persists across navigation)
  const jouleBridge = useJouleBridgeContext();
  
  // Debug: Log bridge state (remove in production)
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[Weekly Planner] Bridge state:', {
        bridgeAvailable: jouleBridge.bridgeAvailable,
        connected: jouleBridge.connected,
        loading: jouleBridge.loading,
        error: jouleBridge.error,
        temperature: jouleBridge.temperature,
        targetTemperature: jouleBridge.targetTemperature,
      });
    }
  }, [jouleBridge.bridgeAvailable, jouleBridge.connected, jouleBridge.loading, jouleBridge.error]);
  
  // Electricity rate
  const [electricityRate, setElectricityRate] = useState(0.15);
  const [rateSource, setRateSource] = useState("Default");
  
  // State for tabs and UI improvements
  const [activeTab, setActiveTab] = useState("forecast");
  const [dismissedInfoBanner, setDismissedInfoBanner] = useState(() => {
    return localStorage.getItem('weeklyForecast_dismissedBanner') === 'true';
  });
  const [showFormula, setShowFormula] = useState(false);
  const [showStatusPanel, setShowStatusPanel] = useState(false);
  const [showCurrentValues, setShowCurrentValues] = useState(false);
  const [showSchedulePanel, setShowSchedulePanel] = useState(false);
  
  const handleDismissBanner = () => {
    setDismissedInfoBanner(true);
    localStorage.setItem('weeklyForecast_dismissedBanner', 'true');
  };
  
  useEffect(() => {
    const fetchRate = async () => {
      if (!userLocation?.state) {
        setRateSource("US Average");
        return;
      }
      
      try {
        const stateCode = getStateCode(userLocation.state);
        if (stateCode) {
          const liveData = await fetchLiveElectricityRate(stateCode);
          if (liveData?.rate) {
            setElectricityRate(liveData.rate);
            setRateSource(`EIA ${userLocation.state}`);
            return;
          }
        }
      } catch (err) {
        console.warn("EIA API failed, using fallback", err);
      }
      
      const fallbackRate = getStateElectricityRate(userLocation.state);
      setElectricityRate(fallbackRate || 0.15);
      setRateSource(`${userLocation.state} Average`);
    };
    
    fetchRate();
  }, [userLocation?.state]);
  
  // Get 7-day weather forecast
  const { forecast, loading: forecastLoading, error: forecastError } = useForecast(
    userLocation?.latitude,
    userLocation?.longitude
  );
  
  // Target temperature from Ecobee (via Joule Bridge)
  // Use data if available, even if device is temporarily offline (bridge will auto-reconnect)
  const ecobeeTargetTemp = useMemo(() => {
    if (jouleBridge.bridgeAvailable && jouleBridge.targetTemperature !== null) {
      // Use target temperature if we have it, even if not currently connected
      // (device might be temporarily offline but data is cached)
      return jouleBridge.targetTemperature;
    }
    return null;
  }, [jouleBridge.bridgeAvailable, jouleBridge.targetTemperature]);
  
  // Current indoor temperature from Ecobee
  // Use data if available, even if device is temporarily offline
  const currentIndoorTemp = useMemo(() => {
    if (jouleBridge.bridgeAvailable && jouleBridge.temperature !== null) {
      // Use temperature if we have it, even if not currently connected
      return jouleBridge.temperature;
    }
    return null;
  }, [jouleBridge.bridgeAvailable, jouleBridge.temperature]);
  
  // Current outdoor temperature (from weather forecast, first hour)
  const currentOutdoorTemp = useMemo(() => {
    if (forecast && forecast.length > 0) {
      return forecast[0].temp;
    }
    return null;
  }, [forecast]);
  
  // Calculate heat loss factor from settings
  const heatLossFactor = useMemo(() => {
    const useManualHeatLoss = Boolean(userSettings?.useManualHeatLoss);
    const useCalculatedHeatLoss = userSettings?.useCalculatedHeatLoss !== false;
    const useAnalyzerHeatLoss = Boolean(userSettings?.useAnalyzerHeatLoss);
    
    // Priority 1: Manual Entry
    if (useManualHeatLoss && userSettings?.manualHeatLoss) {
      return Number(userSettings.manualHeatLoss);
    }
    
    // Priority 2: Analyzer Data
    if (useAnalyzerHeatLoss && userSettings?.analyzerHeatLoss) {
      return Number(userSettings.analyzerHeatLoss);
    }
    
    // Priority 3: Calculate from building specs
    if (useCalculatedHeatLoss) {
      return heatUtils.calculateHeatLoss({
        squareFeet: userSettings.squareFeet || 1500,
        insulationLevel: userSettings.insulationLevel || 1.0,
        homeShape: userSettings.homeShape || 1.0,
        ceilingHeight: userSettings.ceilingHeight || 8,
        wallHeight: userSettings.wallHeight ?? null,
        hasLoft: userSettings.hasLoft || false,
      }) / 70; // Convert to BTU/hr/°F
    }
    
    // Fallback
    return 314; // ~22,000 BTU/hr design heat loss / 70
  }, [userSettings]);
  
  // HSPF2 efficiency
  const hspf2 = userSettings?.hspf2 || 9.0;
  
  // Calculate seasonal COP from HSPF2 for COP expectation text
  // seasonal COP = (HSPF2 × 1000) / 3412.14
  const seasonalCOP = (hspf2 * 1000) / 3412.14;
  
  // System capacity and efficiency for aux heat calculations
  const capacity = Number(userSettings?.capacity ?? userSettings?.coolingCapacity ?? 36); // kBTU
  const efficiency = Number(userSettings?.efficiency) || 15; // SEER2
  const tons = capacity / 12.0; // Convert kBTU to tons
  const useElectricAuxHeat = Boolean(userSettings?.useElectricAuxHeat !== false); // Default to true
  
  // Calculate compressor power (kW) from tons and efficiency
  const compressorPower = useMemo(() => {
    // Formula: tons * 1.0 * (15 / efficiency)
    // This represents the electrical draw at rated output
    return (tons * 1.0 * (15 / Math.max(1, efficiency)));
  }, [tons, efficiency]);
  
  // Calculate total design heat loss (BTU/hr at 70°F delta-T)
  const designHeatLossBtuHrAt70F = useMemo(() => {
    return heatLossFactor * 70; // BTU/hr at design conditions (70°F delta-T)
  }, [heatLossFactor]);
  
  // Calculate balance point: where heat pump output equals building heat loss
  const balancePoint = useMemo(() => {
    if (!ecobeeTargetTemp) return null;
    
    // Try temperatures from 60°F down to find where output = loss
    let bestMatch = null;
    
    // First pass: find approximate range
    const cutoffTemp = userSettings?.cutoffTemp ?? -15;
    for (let temp = 60; temp >= -20; temp -= 1) {
      const capacityFactor = heatUtils.getCapacityFactor(temp, cutoffTemp);
      const heatPumpOutputBtu = tons * 12000 * capacityFactor;
      const deltaT = Math.max(0, ecobeeTargetTemp - temp);
      const buildingHeatLossBtu = heatLossFactor * deltaT;
      
      if (heatPumpOutputBtu <= buildingHeatLossBtu) {
        bestMatch = temp;
        break;
      }
    }
    
    // If we found a match, refine it with 0.1°F precision using binary search
    if (bestMatch !== null && bestMatch < 60) {
      // Binary search between bestMatch and bestMatch + 1°F for precise crossing point
      let low = bestMatch;
      let high = bestMatch + 1.0;
      let precision = 0.1;
      
      // Find the exact temperature where output = loss
      while (high - low > precision) {
        const mid = (low + high) / 2;
        const capFactorMid = heatUtils.getCapacityFactor(mid, cutoffTemp);
        const outputMid = tons * 12000 * capFactorMid;
        const deltaTMid = Math.max(0, ecobeeTargetTemp - mid);
        const lossMid = heatLossFactor * deltaTMid;
        
        if (outputMid > lossMid) {
          // Output exceeds loss, balance point is at lower temp
          high = mid;
        } else {
          // Loss exceeds output, balance point is at higher temp
          low = mid;
        }
      }
      
      return Math.round(((low + high) / 2) * 10) / 10;
    }
    
    return bestMatch; // Balance point below -20°F or system can handle all temps
  }, [ecobeeTargetTemp, tons, heatLossFactor]);
  
  // Calculate 7-day costs using Ecobee target temp with aux heat
  const dailyCosts = useMemo(() => {
    if (!ecobeeTargetTemp || !forecast || forecast.length === 0) {
      return null;
    }
    
    // Group forecast by day, keeping hourly data for aux heat calculations
    const dailyData = [];
    const dayMap = new Map();
    
    forecast.forEach(hour => {
      const date = new Date(hour.time);
      // Use local date consistently for both dayKey and dayName to avoid timezone mismatches
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const dayOfMonth = String(date.getDate()).padStart(2, '0');
      const dayKey = `${year}-${month}-${dayOfMonth}`;
      
      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, {
          date: dayKey,
          dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
          temps: [],
          hours: [],
        });
      }
      
      const day = dayMap.get(dayKey);
      day.temps.push(hour.temp);
      day.hours.push({
        temp: hour.temp,
        humidity: hour.humidity || 50, // Default humidity if not available
        time: hour.time,
      });
    });
    
    // Get sorted list of day keys to ensure chronological order
    const sortedDayKeys = Array.from(dayMap.keys()).sort();
    
    // Calculate cost for each day with aux heat (only first 7 days)
    sortedDayKeys.slice(0, 7).forEach((key, dayIndex) => {
      const day = dayMap.get(key);
      const avgTemp = day.temps.reduce((a, b) => a + b, 0) / day.temps.length;
      const minTemp = Math.min(...day.temps);
      const maxTemp = Math.max(...day.temps);
      
      // DIAGNOSTIC: Log heatLossFactor for first day (Monday) to debug indexing issue
      if (dayIndex === 0 && import.meta.env.DEV) {
        console.log(`[WeeklyForecast] Day 0 (${day.dayName}, ${key}): heatLossFactor=${heatLossFactor}, hours=${day.hours.length}, avgTemp=${avgTemp.toFixed(1)}`);
        if (day.hours.length !== 24) {
          console.warn(`[WeeklyForecast] ⚠️ Day 0 has ${day.hours.length} hours instead of 24! This could cause incorrect BTU calculations.`);
        }
      }
      
      // Calculate hourly performance for aux heat
      let totalHeatPumpKwh = 0;
      let totalAuxKwh = 0;
      let totalDailyBtuLoad = 0;
      let totalHpDeliveredBtu = 0;
      let totalAuxDeliveredBtu = 0;
      let totalFullTiltKwHours = 0; // Debug: accumulate full-tilt kW × hours
      
      day.hours.forEach(hour => {
        // Use dtHours from hour object if available, otherwise default to 1.0
        const dtHours = hour.dtHours ?? 1.0;
        
        // Calculate Daily BTU Load from hourly loop (same calculation used for all days)
        const dT = Math.max(0, ecobeeTargetTemp - hour.temp);
        const loadBtuHr = heatLossFactor * dT;
        totalDailyBtuLoad += loadBtuHr * dtHours; // BTU
        
        const perf = heatUtils.computeHourlyPerformance(
          {
            tons: tons,
            indoorTemp: ecobeeTargetTemp,
            designHeatLossBtuHrAt70F: designHeatLossBtuHrAt70F,
            compressorPower: compressorPower,
            hspf2: hspf2,
            cutoffTemp: userSettings?.cutoffTemp ?? -15, // Manufacturer-dependent cutoff temperature
          },
          hour.temp,
          hour.humidity,
          dtHours
        );
        
        // AGGREGATION RULES: Sum energy directly - NEVER multiply by dtHours
        // ✅ CORRECT: monthlyHpKwh += perf.hpKwh;
        // ❌ WRONG: monthlyHpKwh += perf.hpKwh * dtHours; // Would double-count!
        const heatPumpKwh = perf.hpKwh !== undefined 
          ? perf.hpKwh // ✅ CORRECT: Sum energy directly
          : perf.electricalKw * (perf.capacityUtilization / 100) * dtHours; // Fallback (using capacityUtilization, not time-based runtime)
        totalHeatPumpKwh += heatPumpKwh;
        
        // Aux heat energy
        // ✅ CORRECT: monthlyAuxKwh += perf.auxKwh;
        // ❌ WRONG: monthlyAuxKwh += perf.auxKw * dtHours; // Use auxKwh, not auxKw!
        // Note: auxKw is informational only; do not aggregate power, aggregate auxKwh.
        if (useElectricAuxHeat) {
          const auxKwh = perf.auxKwh !== undefined
            ? perf.auxKwh // ✅ CORRECT: Sum energy directly
            : perf.auxKw * dtHours; // Fallback for backward compatibility
          totalAuxKwh += auxKwh;
        }
        
        // DIAGNOSTIC: Calculate BTU deliveries for COP sanity check (must match load calculation)
        // Use values from computeHourlyPerformance to ensure consistency
        const buildingHeatLossBtuHr = heatLossFactor * Math.max(0, ecobeeTargetTemp - hour.temp);
        const deliveredHpBtuHr = perf.deliveredHpBtuHr !== undefined 
          ? perf.deliveredHpBtuHr 
          : (buildingHeatLossBtuHr * (perf.capacityUtilization / 100)); // Fallback (using capacityUtilization, not time-based runtime)
        const deficitBtuHr = perf.deficitBtuHr !== undefined
          ? perf.deficitBtuHr
          : Math.max(0, buildingHeatLossBtuHr - deliveredHpBtuHr); // Fallback
        const deliveredAuxBtuHr = deficitBtuHr;
        
        totalHpDeliveredBtu += deliveredHpBtuHr * dtHours; // BTU/hr × h = BTU
        totalAuxDeliveredBtu += deliveredAuxBtuHr * dtHours; // BTU/hr × h = BTU
        
        // Debug: accumulate full-tilt kW × hours (for debug column)
        if (perf.fullTiltKw !== undefined) {
          totalFullTiltKwHours += perf.fullTiltKw * dtHours; // kW × h = kWh (if running at 100% capacity)
        }
      });
      
      const totalKwh = totalHeatPumpKwh + totalAuxKwh;
      // Round kWh first, then calculate cost from rounded value to ensure table reconciles
      const roundedKwh = parseFloat(totalKwh.toFixed(1));
      const dailyCost = roundedKwh * electricityRate;
      
      // Calculate deltaT from hourly temps for consistency (average of hourly deltaTs)
      // This ensures ΔT matches the effective temperature difference used in calculations
      const avgDeltaT = day.hours.reduce((sum, hour) => {
        return sum + Math.max(0, ecobeeTargetTemp - hour.temp);
      }, 0) / day.hours.length;
      
      // INVARIANT CHECK: Delivered heat should match building load (within rounding)
      // dailyLoadBtu ≈ hpDeliveredBtu + auxDeliveredBtu
      const deliveredTotalBtu = totalHpDeliveredBtu + totalAuxDeliveredBtu;
      const loadMismatch = Math.abs(deliveredTotalBtu - totalDailyBtuLoad);
      const loadMismatchPercent = (loadMismatch / totalDailyBtuLoad) * 100;
      if (loadMismatch > 100 || loadMismatchPercent > 0.1) { // Allow 100 BTU or 0.1% rounding tolerance
        console.warn(`[WeeklyForecast] Daily heat balance mismatch for ${key} (${day.dayName}): delivered=${deliveredTotalBtu.toFixed(0)} BTU, load=${totalDailyBtuLoad.toFixed(0)} BTU, diff=${loadMismatch.toFixed(0)} (${loadMismatchPercent.toFixed(2)}%)`);
      }
      
      // DIAGNOSTIC: Log first day (Monday) details for debugging
      if (dayIndex === 0 && import.meta.env.DEV) {
        const totalHours = day.hours.reduce((sum, h) => sum + (h.dtHours ?? 1.0), 0);
        console.log(`[WeeklyForecast] Day 0 (${day.dayName}, ${key}): heatLossFactor=${heatLossFactor}, hours=${day.hours.length}, totalHours=${totalHours.toFixed(1)}, avgDeltaT=${avgDeltaT.toFixed(1)}`);
        console.log(`[WeeklyForecast] Day 0 BTU totals: load=${(totalDailyBtuLoad/1000).toFixed(0)}k, HP=${(totalHpDeliveredBtu/1000).toFixed(0)}k, Aux=${(totalAuxDeliveredBtu/1000).toFixed(0)}k, delivered=${(deliveredTotalBtu/1000).toFixed(0)}k, mismatch=${loadMismatch.toFixed(0)}`);
      }
      
      // DIAGNOSTIC: Calculate implied average COP for sanity check
      // COP = delivered BTU / (electrical kWh × 3412.14 BTU/kWh)
      const impliedAvgCop = totalHeatPumpKwh > 0 
        ? totalHpDeliveredBtu / (totalHeatPumpKwh * 3412.14)
        : null;
      
      // Debug print for implied COP (especially for cold days)
      if (impliedAvgCop !== null && avgTemp >= 30 && avgTemp <= 35) {
        console.log(`[WeeklyForecast] ${key} (${avgTemp.toFixed(1)}°F avg): Implied Avg COP = ${impliedAvgCop.toFixed(2)}, HP Delivered = ${(totalHpDeliveredBtu/1000).toFixed(0)}k BTU, HP kWh = ${totalHeatPumpKwh.toFixed(1)}`);
        if (impliedAvgCop > 4.5) {
          console.warn(`[WeeklyForecast] ⚠️ High implied COP (${impliedAvgCop.toFixed(2)}) at ${avgTemp.toFixed(1)}°F - COP curve may be too optimistic`);
        }
      }
      
      // Format day label: "Today (Xh remaining)" for partial first day, otherwise use day name
      const dayLabel = dayIndex === 0 && day.hours.length < 24
        ? `Today (${day.hours.length}h remaining)`
        : day.dayName;
      
      dailyData.push({
        date: key,
        dayName: dayLabel,
        avgTemp: parseFloat(avgTemp.toFixed(1)), // Show 1 decimal to match deltaT precision
        minTemp: Math.round(minTemp),
        maxTemp: Math.round(maxTemp),
        deltaT: avgDeltaT.toFixed(1), // Use average of hourly deltaTs for consistency
        heatPumpKwh: totalHeatPumpKwh.toFixed(1),
        auxKwh: totalAuxKwh.toFixed(1),
        kWh: totalKwh.toFixed(1),
        cost: dailyCost.toFixed(2),
        // Diagnostic data for COP sanity check
        totalDailyBtuLoad: totalDailyBtuLoad,
        totalHpDeliveredBtu: totalHpDeliveredBtu,
        totalAuxDeliveredBtu: totalAuxDeliveredBtu,
        impliedAvgCop: impliedAvgCop,
        fullTiltKwHours: totalFullTiltKwHours, // Debug: full-tilt kW × hours (if running at 100% capacity)
        hours: day.hours, // Store hours array to check if day is partial
        isPartialDay: dayIndex === 0 && day.hours.length < 24, // Flag for partial first day
      });
    });
    
    // dailyData is already in chronological order since we iterated sortedDayKeys
    return dailyData; // Already limited to 7 days
  }, [ecobeeTargetTemp, forecast, heatLossFactor, designHeatLossBtuHrAt70F, tons, compressorPower, useElectricAuxHeat, electricityRate, hspf2]);
  
  // Weekly totals
  const weeklyTotals = useMemo(() => {
    if (!dailyCosts) return null;
    
    const totalKwh = dailyCosts.reduce((sum, day) => sum + parseFloat(day.kWh), 0);
    const totalHeatPumpKwh = dailyCosts.reduce((sum, day) => sum + parseFloat(day.heatPumpKwh), 0);
    const totalAuxKwh = dailyCosts.reduce((sum, day) => sum + parseFloat(day.auxKwh), 0);
    // Calculate cost from rounded total kWh to ensure table reconciles
    const roundedTotalKwh = parseFloat(totalKwh.toFixed(1));
    const totalCost = roundedTotalKwh * electricityRate;
    
    return {
      kWh: totalKwh.toFixed(1),
      heatPumpKwh: totalHeatPumpKwh.toFixed(1),
      auxKwh: totalAuxKwh.toFixed(1),
      cost: totalCost.toFixed(2),
    };
  }, [dailyCosts, electricityRate]);
  
  // Consider bridge "available" if bridge is running, even if device isn't reachable
  // This allows the page to show calculations using cached/default values
  const isConnected = jouleBridge.bridgeAvailable && jouleBridge.connected;
  // Check if bridge is available but device is offline/unreachable
  const bridgeAvailableButDeviceOffline = jouleBridge.bridgeAvailable && !jouleBridge.connected && (
    (jouleBridge.error && (
      jouleBridge.error.includes("not reachable") || 
      jouleBridge.error.includes("Connect call failed") ||
      jouleBridge.error.includes("ConnectionError") ||
      jouleBridge.error.includes("IP address changed")
    )) ||
    // Also check if we have paired devices but connection failed
    (jouleBridge.loading === false && jouleBridge.error)
  );
  
  return (
    <div className="page-gradient-overlay min-h-screen">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8 py-2 lg:py-2 bg-slate-800/40 dark:bg-slate-800/20 rounded-2xl">
        {/* Header */}
        <div className="mb-2 animate-fade-in-up pt-1 pb-1">
          <p className="text-muted text-xs leading-relaxed mb-1 italic">
            See your heating and cooling costs for the next 7 days based on the weather forecast and your current Ecobee thermostat setting.
          </p>
          <div className="flex items-center gap-2 mb-1">
            <div className="icon-container icon-container-gradient">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h1 className="heading-primary text-xl md:text-2xl font-bold mb-1">
                Weekly Forecast
              </h1>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-gray-300/30 dark:via-gray-600/30 to-transparent mt-1"></div>
        </div>
        
        {/* Dismissible Info Banner */}
        {!dismissedInfoBanner && (
          <div className="mb-3 glass-card p-3 border-blue-500/30 bg-blue-900/20 relative">
            <button
              onClick={handleDismissBanner}
              className="absolute top-2 right-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-start gap-3 pr-6">
              <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium text-blue-200 mb-1">
                  About This Forecast
                </div>
                <div className="text-sm text-blue-300">
                  This forecast assumes your thermostat stays at its current target temperature. If you use schedules or setbacks, actual costs may differ.
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Connection Status - Collapsible */}
        <div className={`mb-2 glass-card ${
          isConnected 
            ? "border-emerald-500/30 bg-emerald-900/20" 
            : jouleBridge.bridgeAvailable
            ? "border-yellow-500/30 bg-yellow-900/20"
            : "border-red-500/30 bg-red-900/20"
        }`}>
          <button
            onClick={() => setShowStatusPanel(!showStatusPanel)}
            className="w-full p-2 flex items-center gap-2 hover:bg-white/5 transition-colors"
          >
            {isConnected ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400" />
            )}
            <div className="flex-1 text-left">
              <div className="text-xs font-semibold text-high-contrast">
                {isConnected 
                  ? "Connected to Joule Bridge" 
                  : bridgeAvailableButDeviceOffline
                  ? "Using Default Settings (Device Offline)"
                  : "Joule Bridge Not Connected"}
              </div>
            </div>
            {jouleBridge.loading && (
              <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />
            )}
            <span className="text-xs text-gray-400">{showStatusPanel ? '▼' : '▶'}</span>
          </button>
          {showStatusPanel && (
            <div className="px-3 pb-2 border-t border-gray-700/30 mt-1 pt-2">
              <div className="text-xs text-gray-400">
                {isConnected 
                  ? `Polling every 5 seconds • Last update: ${new Date().toLocaleTimeString()}`
                  : bridgeAvailableButDeviceOffline
                  ? (
                    <div className="space-y-2">
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                        <p className="text-xs text-gray-700 dark:text-gray-300 mb-1">
                          Device offline. Bridge will auto-reconnect within 30s.
                        </p>
                        <button
                          onClick={() => setShowPairingOnboarding(true)}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                        >
                          Re-pair Device
                        </button>
                      </div>
                    </div>
                  )
                  : jouleBridge.bridgeAvailable
                  ? "Bridge is running. Waiting for device connection..."
                  : "Start the Joule Bridge to get real Ecobee data"}
              </div>
              {jouleBridge.error && !bridgeAvailableButDeviceOffline && (
                <div className="text-xs text-yellow-400 mt-1">
                  {jouleBridge.error}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Current Values Panel */}
        <div className="glass-card mb-2">
          <button
            onClick={() => setShowCurrentValues(!showCurrentValues)}
            className="w-full p-2 flex items-center gap-2 hover:bg-white/5 transition-colors"
          >
            <Thermometer className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold text-high-contrast flex-1 text-left">Current Conditions</span>
            <span className="text-xs text-gray-400">{showCurrentValues ? '▼' : '▶'}</span>
          </button>
          {showCurrentValues && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3">
          {/* Ecobee Target Temp */}
          <div className="glass-card p-3">
            <div className="flex items-center gap-2 text-muted text-xs mb-1">
              <Thermometer className="w-4 h-4" />
              Ecobee Target
            </div>
            <div className="text-2xl font-bold text-orange-400">
              {ecobeeTargetTemp !== null ? formatTemperatureFromF(ecobeeTargetTemp, effectiveUnitSystem, { decimals: 1 }) : "—"}
            </div>
            <div className="text-xs text-muted mt-1">
              From HomeKit
            </div>
          </div>
          
          {/* Current Indoor Temp */}
          <div className="glass-card p-3">
            <div className="flex items-center gap-2 text-muted text-xs mb-1">
              <Thermometer className="w-4 h-4" />
              Indoor Now
            </div>
            <div className="text-2xl font-bold text-blue-400">
              {currentIndoorTemp !== null ? formatTemperatureFromF(currentIndoorTemp, effectiveUnitSystem, { decimals: 1 }) : "—"}
            </div>
            <div className="text-xs text-muted mt-1">
              Current reading
            </div>
          </div>
          
          {/* Outdoor Temp */}
          <div className="glass-card p-3">
            <div className="flex items-center gap-2 text-muted text-xs mb-1">
              <Thermometer className="w-4 h-4" />
              Outdoor Now
            </div>
            <div className="text-2xl font-bold text-cyan-400">
              {currentOutdoorTemp !== null ? formatTemperatureFromF(currentOutdoorTemp, effectiveUnitSystem, { decimals: 0 }) : "—"}
            </div>
            <div className="text-xs text-muted mt-1">
              Weather forecast
            </div>
          </div>
          
          {/* Electricity Rate */}
          <div className="glass-card p-3">
            <div className="flex items-center gap-2 text-muted text-xs mb-1">
              <DollarSign className="w-4 h-4" />
              Electricity
            </div>
            <div className="text-2xl font-bold text-green-400">
              ${electricityRate.toFixed(3)}
            </div>
            <div className="text-xs text-muted mt-1">
              {rateSource}
            </div>
          </div>
          </div>
          )}
        </div>
        
        {/* Hero Section: Weekly Totals */}
        {weeklyTotals && dailyCosts && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
            {/* Weekly Total Cost */}
            <div className="glass-card-gradient glass-card p-3 border-2 border-green-500/40 bg-green-900/20 shadow-lg">
              <div className="text-xs text-green-200 mb-1 font-medium">7-DAY TOTAL COST</div>
              <div className="text-3xl font-bold text-white mb-1">${weeklyTotals.cost}</div>
              <div className="text-xs text-green-300">
                {formatEnergyFromKwh(parseFloat(weeklyTotals.kWh), effectiveUnitSystem, { decimals: 1 })}
              </div>
            </div>
            
            {/* Daily Average */}
            <div className="glass-card-gradient glass-card p-3 border-2 border-blue-500/40 bg-blue-900/20 shadow-lg">
              <div className="text-xs text-blue-200 mb-1 font-medium">DAILY AVERAGE</div>
              <div className="text-2xl font-bold text-white mb-1">${(parseFloat(weeklyTotals.cost) / 7).toFixed(2)}</div>
              <div className="text-xs text-blue-300">
                {formatEnergyFromKwh(parseFloat(weeklyTotals.kWh) / 7, effectiveUnitSystem, { decimals: 1 })} per day
              </div>
            </div>
            
            {/* Backup Heat */}
            {parseFloat(weeklyTotals.auxKwh) > 0 && (
              <div className="glass-card-gradient glass-card p-3 border-2 border-orange-500/40 bg-orange-900/20 shadow-lg">
                <div className="text-xs text-orange-200 mb-1 font-medium">BACKUP HEAT</div>
                <div className="text-2xl font-bold text-white mb-1">{formatEnergyFromKwh(parseFloat(weeklyTotals.auxKwh), effectiveUnitSystem, { decimals: 1 })}</div>
                <div className="text-xs text-orange-300">
                  ${(parseFloat(weeklyTotals.auxKwh) * electricityRate).toFixed(2)} this week
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Tabbed Interface */}
        {!isConnected ? (
          <div className="glass-card p-4 border-yellow-500/30 bg-yellow-900/20 text-center">
            <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <p className="text-yellow-200">Connect to Joule Bridge to see forecast calculations</p>
          </div>
        ) : forecastLoading ? (
          <div className="glass-card p-4 text-center">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-2" />
            <p className="text-gray-400">Loading weather forecast...</p>
          </div>
        ) : forecastError ? (
          <div className="glass-card p-4 border-red-500/30 bg-red-900/20 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-200">Error loading forecast: {forecastError}</p>
          </div>
        ) : dailyCosts ? (
          <div className="glass-card overflow-hidden">
            <div className="p-3 border-b border-gray-200/20 dark:border-gray-700/20">
              <h2 className="text-lg font-semibold">7-Day Heating Cost Forecast</h2>
              <p className="text-sm text-gray-400">
                Using constant target: <span className="text-orange-400 font-bold">{ecobeeTargetTemp !== null ? formatTemperatureFromF(ecobeeTargetTemp, effectiveUnitSystem, { decimals: 1 }) : "—"}</span>
                {dailyCosts && dailyCosts[0] && dailyCosts[0].hours && dailyCosts[0].hours.length < 24 && (
                  <span className="text-xs text-yellow-400 ml-2">
                    (Today: {dailyCosts[0].hours.length} hours remaining)
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-500 mt-2 italic">
                This forecast assumes your thermostat stays at its current target. If you use schedules or setbacks, actual costs may differ.
              </p>
            </div>
            
            {/* Tab Navigation */}
            <div className="border-b border-gray-200/20 dark:border-gray-700/20 bg-gray-50/5 dark:bg-gray-900/20">
              <div className="flex flex-wrap gap-2 p-2">
                <button
                  onClick={() => setActiveTab("forecast")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    activeTab === "forecast"
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 dark:text-gray-300 hover:text-white hover:bg-gray-800/40"
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Daily Forecast
                </button>
                <button
                  onClick={() => setActiveTab("system")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    activeTab === "system"
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 dark:text-gray-300 hover:text-white hover:bg-gray-800/40"
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  System Specs
                </button>
                {nerdMode && (
                  <button
                    onClick={() => setActiveTab("technical")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                      activeTab === "technical"
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 dark:text-gray-300 hover:text-white hover:bg-gray-800/40"
                    }`}
                  >
                    <Code className="w-4 h-4" />
                    Technical Details
                  </button>
                )}
              </div>
            </div>
            
            {/* Tab Content */}
            <div className="p-3">
              {activeTab === "forecast" && (
                <div>
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold text-white mb-2">7-Day Forecast</h2>
                    <p className="text-sm text-gray-400">
                      Target: <span className="text-orange-400 font-bold">{ecobeeTargetTemp !== null ? formatTemperatureFromF(ecobeeTargetTemp, effectiveUnitSystem, { decimals: 1 }) : "—"}</span>
                      {dailyCosts && dailyCosts[0] && dailyCosts[0].hours && dailyCosts[0].hours.length < 24 && (
                        <span className="text-xs text-yellow-400 ml-2">
                          (Today: {dailyCosts[0].hours.length} hours remaining)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50/5 dark:bg-gray-900/20">
                        <tr>
                          <th className="px-4 py-3 text-left text-gray-300 dark:text-gray-100 font-medium">Day</th>
                          <th className="px-4 py-3 text-right text-gray-300 dark:text-gray-100 font-medium" title="Average temperature for this day">Avg Temp</th>
                          <th className="px-4 py-3 text-right text-gray-300 dark:text-gray-100 font-medium" title="Minimum and maximum temperatures">Min/Max</th>
                          <th className="px-4 py-3 text-right text-gray-300 dark:text-gray-100 font-medium" title="Total heating energy (Heat Pump + Backup)">Heating kWh</th>
                          <th className="px-4 py-3 text-right text-gray-300 dark:text-gray-100 font-medium" title="Daily cost">Cost</th>
                        </tr>
                      </thead>
                <tbody>
                        {dailyCosts.map((day, idx) => (
                          <tr key={day.date} className={idx % 2 === 0 ? "bg-white/5 dark:bg-white/5" : "bg-gray-50/5 dark:bg-gray-900/10"}>
                            <td className="px-4 py-3 font-medium">
                              {day.dayName}
                              {idx === 0 && dailyCosts[0]?.isPartialDay && (
                                <span className="ml-1 text-xs text-blue-400">←</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-cyan-400">{formatTemperatureFromF(day.avgTemp, effectiveUnitSystem, { decimals: 1 })}</td>
                            <td className="px-4 py-3 text-right text-gray-400">
                              {formatTemperatureFromF(day.minTemp, effectiveUnitSystem, { decimals: 0, withUnit: false })} / {formatTemperatureFromF(day.maxTemp, effectiveUnitSystem, { decimals: 0, withUnit: false })}
                            </td>
                            <td className="px-4 py-3 text-right text-blue-300 font-semibold" title={`Heat Pump: ${formatEnergy(day.heatPumpKwh)}, Backup Heat: ${formatEnergy(day.auxKwh)}`}>
                              {formatEnergy(day.kWh)}
                            </td>
                            <td className="px-4 py-3 text-right text-green-400 font-bold">${day.cost}</td>
                          </tr>
                        ))}
                </tbody>
                      {weeklyTotals && (
                        <tfoot className="bg-[#1E4CFF]/20 border-t border-[#1E4CFF]">
                          <tr>
                            <td className="px-4 py-3 font-bold" colSpan={2}>
                              {dailyCosts && dailyCosts[0] && dailyCosts[0].isPartialDay 
                                ? "Today remainder + next 6 days"
                                : "Weekly Total (7 days)"}
                            </td>
                            <td className="px-4 py-3 text-right text-blue-300 font-bold">{formatEnergy(weeklyTotals.kWh)}</td>
                            <td className="px-4 py-3 text-right text-green-400 font-bold text-lg">${weeklyTotals.cost}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                  
                  {/* Show me the math section */}
                  <details className="mt-6 glass-card">
                    <summary className="p-4 cursor-pointer text-lg font-semibold text-white hover:bg-white/5 rounded-lg flex items-center gap-2">
                      <span>📐</span> Show me the math
                    </summary>
                    <div className="p-4 pt-0 space-y-6">
                      
                      {/* Building Characteristics */}
                      <div className="border-t border-gray-700/50 pt-4">
                        <h4 className="text-md font-semibold text-gray-200 mb-3">Building Characteristics</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Heat Loss Factor:</span>
                              <span className="text-white font-mono">{formatHeatLossFactor(heatLossFactor, effectiveUnitSystem)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Design Heat Loss @ 70°F ΔT:</span>
                              <span className="text-white font-mono">{(heatLossFactor * 70 / 1000).toFixed(1)}k BTU/hr</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-gray-400">System Capacity:</span>
                              <span className="text-white font-mono">{capacity}k BTU ({tons.toFixed(1)} tons)</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">HSPF2:</span>
                              <span className="text-white font-mono">{hspf2}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* System Configuration */}
                      <div className="border-t border-gray-700/50 pt-4">
                        <h4 className="text-md font-semibold text-gray-200 mb-3">System Configuration</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Electricity Rate:</span>
                              <span className="text-white font-mono">${electricityRate.toFixed(3)}/kWh</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Rate Source:</span>
                              <span className="text-white font-mono">{rateSource}</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Target Temperature:</span>
                              <span className="text-orange-400 font-mono">{ecobeeTargetTemp !== null ? formatTemperatureFromF(ecobeeTargetTemp, effectiveUnitSystem, { decimals: 1 }) : "—"}</span>
                            </div>
                            {balancePoint !== null && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">Balance Point:</span>
                                <span className="text-white font-mono">{formatTemperatureFromF(balancePoint, effectiveUnitSystem, { decimals: 1 })}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Weekly Summary */}
                      {weeklyTotals && (
                        <div className="border-t border-gray-700/50 pt-4">
                          <h4 className="text-md font-semibold text-gray-200 mb-3">📊 Weekly Summary</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="glass-card p-3 text-center">
                              <div className="text-2xl font-bold text-green-400">${weeklyTotals.cost}</div>
                              <div className="text-xs text-gray-400">Total Cost</div>
                            </div>
                            <div className="glass-card p-3 text-center">
                              <div className="text-2xl font-bold text-blue-400">{formatEnergy(weeklyTotals.kWh)}</div>
                              <div className="text-xs text-gray-400">Total Energy</div>
                            </div>
                            <div className="glass-card p-3 text-center">
                              <div className="text-2xl font-bold text-cyan-400">{formatEnergy(weeklyTotals.heatPumpKwh)}</div>
                              <div className="text-xs text-gray-400">Heat Pump</div>
                            </div>
                            <div className="glass-card p-3 text-center">
                              <div className="text-2xl font-bold text-orange-400">{formatEnergy(weeklyTotals.auxKwh)}</div>
                              <div className="text-xs text-gray-400">Aux Heat</div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Auxiliary Heat Analysis */}
                      {dailyCosts && (() => {
                        const totalAux = dailyCosts.reduce((sum, d) => sum + parseFloat(d.auxKwh), 0);
                        const totalEnergy = dailyCosts.reduce((sum, d) => sum + parseFloat(d.kWh), 0);
                        const auxPercent = totalEnergy > 0 ? (totalAux / totalEnergy * 100) : 0;
                        const daysWithAux = dailyCosts.filter(d => parseFloat(d.auxKwh) > 0).length;
                        const auxCost = totalAux * electricityRate;
                        const hpCost = (totalEnergy - totalAux) * electricityRate;
                        
                        return (
                          <div className="border-t border-gray-700/50 pt-4">
                            <h4 className="text-md font-semibold text-gray-200 mb-3">⚡ Auxiliary Heat Analysis</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="glass-card p-3 text-center">
                                <div className="text-xl font-bold text-orange-400">{auxPercent.toFixed(1)}%</div>
                                <div className="text-xs text-gray-400">Aux Heat Usage</div>
                              </div>
                              <div className="glass-card p-3 text-center">
                                <div className="text-xl font-bold text-white">{daysWithAux}</div>
                                <div className="text-xs text-gray-400">Days Using Aux</div>
                              </div>
                              <div className="glass-card p-3 text-center">
                                <div className="text-xl font-bold text-orange-400">${auxCost.toFixed(2)}</div>
                                <div className="text-xs text-gray-400">Aux Heat Cost</div>
                              </div>
                              <div className="glass-card p-3 text-center">
                                <div className="text-xl font-bold text-blue-400">${hpCost.toFixed(2)}</div>
                                <div className="text-xs text-gray-400">HP Cost</div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      
                      {/* Peak Days */}
                      {dailyCosts && dailyCosts.length > 0 && (
                        <div className="border-t border-gray-700/50 pt-4">
                          <h4 className="text-md font-semibold text-gray-200 mb-3">🔥 Peak Cost Days</h4>
                          <div className="space-y-2">
                            {[...dailyCosts]
                              .sort((a, b) => parseFloat(b.cost) - parseFloat(a.cost))
                              .slice(0, 3)
                              .map((day, idx) => (
                                <div key={day.date} className="flex items-center justify-between glass-card p-3">
                                  <div className="flex items-center gap-3">
                                    <span className="text-lg">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}</span>
                                    <div>
                                      <div className="font-medium text-white">{day.dayName}</div>
                                      <div className="text-xs text-gray-400">
                                        Avg: {formatTemperatureFromF(day.avgTemp, effectiveUnitSystem, { decimals: 0 })}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-bold text-green-400">${day.cost}</div>
                                    <div className="text-xs text-gray-400">{formatEnergy(day.kWh)}</div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Weather Analysis */}
                      {dailyCosts && dailyCosts.length > 0 && (() => {
                        const avgTemp = dailyCosts.reduce((sum, d) => sum + d.avgTemp, 0) / dailyCosts.length;
                        const minTemp = Math.min(...dailyCosts.map(d => d.minTemp));
                        const maxTemp = Math.max(...dailyCosts.map(d => d.maxTemp));
                        const coldDays = dailyCosts.filter(d => d.avgTemp < 32).length;
                        const heatingDays = dailyCosts.filter(d => d.avgTemp < (ecobeeTargetTemp || 70)).length;
                        
                        return (
                          <div className="border-t border-gray-700/50 pt-4">
                            <h4 className="text-md font-semibold text-gray-200 mb-3">🌡️ Weather Analysis</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="glass-card p-3 text-center">
                                <div className="text-xl font-bold text-cyan-400">{formatTemperatureFromF(avgTemp, effectiveUnitSystem, { decimals: 1 })}</div>
                                <div className="text-xs text-gray-400">Avg Temp</div>
                              </div>
                              <div className="glass-card p-3 text-center">
                                <div className="text-xl font-bold text-blue-400">{formatTemperatureFromF(minTemp, effectiveUnitSystem, { decimals: 0 })}</div>
                                <div className="text-xs text-gray-400">Coldest Low</div>
                              </div>
                              <div className="glass-card p-3 text-center">
                                <div className="text-xl font-bold text-orange-400">{formatTemperatureFromF(maxTemp, effectiveUnitSystem, { decimals: 0 })}</div>
                                <div className="text-xs text-gray-400">Warmest High</div>
                              </div>
                              <div className="glass-card p-3 text-center">
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
                      
                      {/* Efficiency Metrics */}
                      {dailyCosts && dailyCosts.length > 0 && (() => {
                        const totalBtuLoad = dailyCosts.reduce((sum, d) => sum + (d.totalDailyBtuLoad || 0), 0);
                        const totalHpDelivered = dailyCosts.reduce((sum, d) => sum + (d.totalHpDeliveredBtu || 0), 0);
                        const totalHpKwh = dailyCosts.reduce((sum, d) => sum + parseFloat(d.heatPumpKwh), 0);
                        const realizedCop = totalHpKwh > 0 ? totalHpDelivered / (totalHpKwh * 3412.14) : 0;
                        const ratedCop = (hspf2 * 1000) / 3412.14;
                        const copRatio = ratedCop > 0 ? (realizedCop / ratedCop * 100) : 0;
                        
                        return (
                          <div className="border-t border-gray-700/50 pt-4">
                            <h4 className="text-md font-semibold text-gray-200 mb-3">📈 Efficiency Metrics</h4>
                            <div className="grid grid-cols-3 gap-4">
                              <div className="glass-card p-3 text-center">
                                <div className="text-xl font-bold text-green-400">{realizedCop.toFixed(2)}</div>
                                <div className="text-xs text-gray-400">Realized COP</div>
                              </div>
                              <div className="glass-card p-3 text-center">
                                <div className="text-xl font-bold text-blue-400">{ratedCop.toFixed(2)}</div>
                                <div className="text-xs text-gray-400">Rated COP</div>
                              </div>
                              <div className="glass-card p-3 text-center">
                                <div className="text-xl font-bold text-cyan-400">{copRatio.toFixed(0)}%</div>
                                <div className="text-xs text-gray-400">of Rated</div>
                              </div>
                            </div>
                            <p className="mt-3 text-xs text-gray-500">
                              Realized COP = Total HP BTU Delivered ÷ (Total HP kWh × 3412.14 BTU/kWh)
                            </p>
                          </div>
                        );
                      })()}
                      
                      {/* Rate Sensitivity */}
                      {weeklyTotals && (
                        <div className="border-t border-gray-700/50 pt-4">
                          <h4 className="text-md font-semibold text-gray-200 mb-3">💡 Electricity Rate Sensitivity (±20%)</h4>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="glass-card p-3 text-center border-green-500/30">
                              <div className="text-xs text-gray-400 mb-1">At ${(electricityRate * 0.8).toFixed(3)}/kWh (-20%)</div>
                              <div className="text-xl font-bold text-green-400">
                                ${(parseFloat(weeklyTotals.kWh) * electricityRate * 0.8).toFixed(2)}
                              </div>
                              <div className="text-xs text-green-400">
                                Save ${(parseFloat(weeklyTotals.kWh) * electricityRate * 0.2).toFixed(2)}
                              </div>
                            </div>
                            <div className="glass-card p-3 text-center border-blue-500/30">
                              <div className="text-xs text-gray-400 mb-1">Current Rate ${electricityRate.toFixed(3)}/kWh</div>
                              <div className="text-xl font-bold text-white">${weeklyTotals.cost}</div>
                            </div>
                            <div className="glass-card p-3 text-center border-red-500/30">
                              <div className="text-xs text-gray-400 mb-1">At ${(electricityRate * 1.2).toFixed(3)}/kWh (+20%)</div>
                              <div className="text-xl font-bold text-red-400">
                                ${(parseFloat(weeklyTotals.kWh) * electricityRate * 1.2).toFixed(2)}
                              </div>
                              <div className="text-xs text-red-400">
                                +${(parseFloat(weeklyTotals.kWh) * electricityRate * 0.2).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Example Day Calculation */}
                      {dailyCosts && dailyCosts.length > 0 && (() => {
                        // Pick the coldest day as the example
                        const exampleDay = [...dailyCosts].sort((a, b) => a.avgTemp - b.avgTemp)[0];
                        const deltaT = ecobeeTargetTemp ? (ecobeeTargetTemp - exampleDay.avgTemp).toFixed(1) : "—";
                        const heatLossBtuHr = heatLossFactor * (ecobeeTargetTemp - exampleDay.avgTemp);
                        
                        return (
                          <div className="border-t border-gray-700/50 pt-4">
                            <h4 className="text-md font-semibold text-gray-200 mb-3">🧮 Example Day Calculation ({exampleDay.dayName} - coldest day)</h4>
                            <div className="bg-gray-900/50 rounded-lg p-4 text-sm space-y-2 font-mono">
                              <div className="flex justify-between">
                                <span className="text-gray-400">Avg Outdoor Temp:</span>
                                <span className="text-cyan-400">{formatTemperatureFromF(exampleDay.avgTemp, effectiveUnitSystem, { decimals: 1 })}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Target Indoor Temp:</span>
                                <span className="text-orange-400">{ecobeeTargetTemp !== null ? formatTemperatureFromF(ecobeeTargetTemp, effectiveUnitSystem, { decimals: 1 }) : "—"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Temperature Difference (ΔT):</span>
                                <span className="text-white">{deltaT}°F</span>
                              </div>
                              <div className="h-px bg-gray-700 my-2"></div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Heat Loss Rate:</span>
                                <span className="text-white">{(heatLossBtuHr / 1000).toFixed(1)}k BTU/hr</span>
                              </div>
                              <div className="text-xs text-gray-500 ml-4">
                                = {heatLossFactor.toFixed(1)} BTU/hr/°F × {deltaT}°F
                              </div>
                              <div className="h-px bg-gray-700 my-2"></div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Daily Energy:</span>
                                <span className="text-blue-400">{formatEnergy(exampleDay.kWh)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Daily Cost:</span>
                                <span className="text-green-400 font-bold">${exampleDay.cost}</span>
                              </div>
                              <div className="text-xs text-gray-500 ml-4">
                                = {exampleDay.kWh} kWh × ${electricityRate.toFixed(3)}/kWh
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      
                    </div>
                  </details>
                  
                </div>
              )}
              
              {activeTab === "system" && (
                <div>
                  <h2 className="text-xl font-semibold text-white mb-4">System Specifications</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="glass-card p-3">
                      <h3 className="text-sm font-semibold text-gray-300 dark:text-gray-100 mb-2">Efficiency Ratings</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">HSPF2 (Heating):</span>
                          <span className="text-white font-mono">{hspf2}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">SEER2 (Cooling):</span>
                          <span className="text-white font-mono">{efficiency}</span>
                        </div>
                      </div>
                    </div>
                    <div className="glass-card p-3">
                      <h3 className="text-sm font-semibold text-gray-300 dark:text-gray-100 mb-2">System Capacity</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Capacity:</span>
                          <span className="text-white font-mono">
                            {effectiveUnitSystem === UNIT_SYSTEMS.INTL 
                              ? `${(capacity * 0.293071).toFixed(1)} kW`
                              : `${capacity}k BTU (${formatCapacityFromTons(tons, effectiveUnitSystem)})`
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="glass-card p-3">
                      <h3 className="text-sm font-semibold text-gray-300 dark:text-gray-100 mb-2">Building Characteristics</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Heat Loss Factor:</span>
                          <span className="text-white font-mono">{formatHeatLossFactor(heatLossFactor, effectiveUnitSystem)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="glass-card p-3">
                      <h3 className="text-sm font-semibold text-gray-300 dark:text-gray-100 mb-2">Cost Settings</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Electricity Rate:</span>
                          <span className="text-white font-mono">${electricityRate.toFixed(3)}/kWh</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Location:</span>
                          <span className="text-white">
                            {userLocation ? `${userLocation.city}, ${userLocation.state}` : "Not set"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === "technical" && nerdMode && (
                <div>
                  <h2 className="text-xl font-semibold text-white mb-4">Technical Details</h2>
                  <p className="text-sm text-gray-400 mb-4">
                    This section contains detailed technical information about the calculation methodology and formulas.
                  </p>
                  <div className="text-xs text-gray-400 space-y-4">
                    {showFormula ? (
                      <button
                        onClick={() => setShowFormula(false)}
                        className="w-full mb-3 p-2 glass-card text-sm text-gray-400 dark:text-gray-300 hover:text-white transition-colors"
                      >
                        Hide Detailed Formulas
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowFormula(true)}
                        className="w-full mb-3 p-2 glass-card text-sm text-gray-400 dark:text-gray-300 hover:text-white transition-colors"
                      >
                        Show Detailed Calculation Formulas
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="glass-card p-4 text-center">
            <p className="text-gray-400 dark:text-gray-300">No forecast data available</p>
          </div>
        )}
      </div>

      {/* Pairing Onboarding Modal */}
      {showPairingOnboarding && (
        <EcobeePairingOnboarding
          onClose={() => setShowPairingOnboarding(false)}
          onComplete={() => setShowPairingOnboarding(false)}
        />
      )}
    </div>
  );
};

export default WeeklyForecast;
