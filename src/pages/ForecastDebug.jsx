import React, { useMemo, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
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
 * ForecastDebug - Simplified 7-day cost forecast using Ecobee target temp directly
 * 
 * This page calculates costs using the actual target temperature from the Ecobee
 * thermostat via HomeKit (Joule Bridge), without any scheduling complexity.
 */
const ForecastDebug = () => {
  // Get outlet context for user settings
  const outletContext = useOutletContext() || {};
  const { userSettings = {} } = outletContext;
  
  // Unit system
  const { unitSystem } = useUnitSystem();
  const nerdMode = userSettings?.nerdMode || false;
  const effectiveUnitSystem = nerdMode ? UNIT_SYSTEMS.INTL : unitSystem;
  
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
    return localStorage.getItem('forecastDebug_dismissedBanner') === 'true';
  });
  const [showFormula, setShowFormula] = useState(false);
  
  const handleDismissBanner = () => {
    setDismissedInfoBanner(true);
    localStorage.setItem('forecastDebug_dismissedBanner', 'true');
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
        console.log(`[ForecastDebug] Day 0 (${day.dayName}, ${key}): heatLossFactor=${heatLossFactor}, hours=${day.hours.length}, avgTemp=${avgTemp.toFixed(1)}`);
        if (day.hours.length !== 24) {
          console.warn(`[ForecastDebug] ⚠️ Day 0 has ${day.hours.length} hours instead of 24! This could cause incorrect BTU calculations.`);
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
        console.warn(`[ForecastDebug] Daily heat balance mismatch for ${key} (${day.dayName}): delivered=${deliveredTotalBtu.toFixed(0)} BTU, load=${totalDailyBtuLoad.toFixed(0)} BTU, diff=${loadMismatch.toFixed(0)} (${loadMismatchPercent.toFixed(2)}%)`);
      }
      
      // DIAGNOSTIC: Log first day (Monday) details for debugging
      if (dayIndex === 0 && import.meta.env.DEV) {
        const totalHours = day.hours.reduce((sum, h) => sum + (h.dtHours ?? 1.0), 0);
        console.log(`[ForecastDebug] Day 0 (${day.dayName}, ${key}): heatLossFactor=${heatLossFactor}, hours=${day.hours.length}, totalHours=${totalHours.toFixed(1)}, avgDeltaT=${avgDeltaT.toFixed(1)}`);
        console.log(`[ForecastDebug] Day 0 BTU totals: load=${(totalDailyBtuLoad/1000).toFixed(0)}k, HP=${(totalHpDeliveredBtu/1000).toFixed(0)}k, Aux=${(totalAuxDeliveredBtu/1000).toFixed(0)}k, delivered=${(deliveredTotalBtu/1000).toFixed(0)}k, mismatch=${loadMismatch.toFixed(0)}`);
      }
      
      // DIAGNOSTIC: Calculate implied average COP for sanity check
      // COP = delivered BTU / (electrical kWh × 3412.14 BTU/kWh)
      const impliedAvgCop = totalHeatPumpKwh > 0 
        ? totalHpDeliveredBtu / (totalHeatPumpKwh * 3412.14)
        : null;
      
      // Debug print for implied COP (especially for cold days)
      if (impliedAvgCop !== null && avgTemp >= 30 && avgTemp <= 35) {
        console.log(`[ForecastDebug] ${key} (${avgTemp.toFixed(1)}°F avg): Implied Avg COP = ${impliedAvgCop.toFixed(2)}, HP Delivered = ${(totalHpDeliveredBtu/1000).toFixed(0)}k BTU, HP kWh = ${totalHeatPumpKwh.toFixed(1)}`);
        if (impliedAvgCop > 4.5) {
          console.warn(`[ForecastDebug] ⚠️ High implied COP (${impliedAvgCop.toFixed(2)}) at ${avgTemp.toFixed(1)}°F - COP curve may be too optimistic`);
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
    <div className="min-h-screen bg-[#0C0F14] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-7 h-7 text-yellow-400" />
            Weekly Cost Forecast
          </h1>
          <p className="text-base text-gray-300 mt-2 max-w-3xl">
            See your heating and cooling costs for the next 7 days based on the weather forecast and your current Ecobee thermostat setting.
          </p>
        </header>
        
        {/* Dismissible Info Banner */}
        {!dismissedInfoBanner && (
          <div className="mb-6 p-4 rounded-lg border border-blue-700/50 bg-blue-900/20 relative">
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
        
        {/* Connection Status */}
        <div className={`mb-6 p-4 rounded-lg border ${
          isConnected 
            ? "bg-emerald-900/20 border-emerald-700" 
            : jouleBridge.bridgeAvailable
            ? "bg-yellow-900/20 border-yellow-700"
            : "bg-red-900/20 border-red-700"
        }`}>
          <div className="flex items-center gap-3">
            {isConnected ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400" />
            )}
            <div>
              <div className="font-medium">
                {isConnected 
                  ? "Connected to Joule Bridge" 
                  : bridgeAvailableButDeviceOffline
                  ? "Bridge Available, Device Offline"
                  : jouleBridge.bridgeAvailable
                  ? "Bridge Available, Waiting for Device"
                  : "Joule Bridge Not Connected"}
              </div>
              <div className="text-sm text-gray-400">
                {isConnected 
                  ? `Polling every 5 seconds • Last update: ${new Date().toLocaleTimeString()}`
                  : bridgeAvailableButDeviceOffline
                  ? (
                    <div className="space-y-1">
                      <p>Device is paired but not reachable. The bridge will automatically reconnect when the device comes back online.</p>
                      <p className="text-xs text-yellow-400 mt-1">
                        <strong>Why this happens:</strong> After server restart, pairing data may not load correctly due to:
                      </p>
                      <ul className="text-xs text-yellow-400 mt-1 ml-4 list-disc space-y-0.5">
                        <li>Pairing file corruption or incomplete save</li>
                        <li>Device IP address changed (DHCP lease renewal)</li>
                        <li>aiohomekit library unable to reconstruct pairing object from saved data</li>
                        <li>Network not ready when server starts (device unreachable)</li>
                        <li>Pairing data format mismatch after library update</li>
                      </ul>
                      <p className="text-xs text-yellow-400 mt-1">
                        If auto-reconnect doesn't work within 30 seconds, you may need to re-pair:
                      </p>
                      <ol className="text-xs text-yellow-400 mt-1 ml-4 list-decimal space-y-0.5">
                        <li>Go to Settings → Joule Bridge Settings</li>
                        <li>Click "Unpair" if a device is shown</li>
                        <li>Click "Discover" to find your Ecobee</li>
                        <li>Enter the 8-digit pairing code from your Ecobee screen</li>
                        <li>Click "Pair" and wait up to 45 seconds</li>
                      </ol>
                      <p className="text-xs text-gray-500 mt-1">Using default settings for forecast until device reconnects.</p>
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
            {jouleBridge.loading && (
              <RefreshCw className="w-4 h-4 text-blue-400 animate-spin ml-auto" />
            )}
          </div>
        </div>
        
        {/* Current Values Panel */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Ecobee Target Temp */}
          <div className="bg-[#151A21] border border-[#222A35] rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Thermometer className="w-4 h-4" />
              Ecobee Target
            </div>
            <div className="text-2xl font-bold text-orange-400">
              {ecobeeTargetTemp !== null ? formatTemperatureFromF(ecobeeTargetTemp, effectiveUnitSystem, { decimals: 1 }) : "—"}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              From HomeKit
            </div>
          </div>
          
          {/* Current Indoor Temp */}
          <div className="bg-[#151A21] border border-[#222A35] rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Thermometer className="w-4 h-4" />
              Indoor Now
            </div>
            <div className="text-2xl font-bold text-blue-400">
              {currentIndoorTemp !== null ? formatTemperatureFromF(currentIndoorTemp, effectiveUnitSystem, { decimals: 1 }) : "—"}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Current reading
            </div>
          </div>
          
          {/* Outdoor Temp */}
          <div className="bg-[#151A21] border border-[#222A35] rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Thermometer className="w-4 h-4" />
              Outdoor Now
            </div>
            <div className="text-2xl font-bold text-cyan-400">
              {currentOutdoorTemp !== null ? formatTemperatureFromF(currentOutdoorTemp, effectiveUnitSystem, { decimals: 0 }) : "—"}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Weather forecast
            </div>
          </div>
          
          {/* Electricity Rate */}
          <div className="bg-[#151A21] border border-[#222A35] rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <DollarSign className="w-4 h-4" />
              Electricity
            </div>
            <div className="text-2xl font-bold text-green-400">
              ${electricityRate.toFixed(3)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {rateSource}
            </div>
          </div>
        </div>
        
        {/* Hero Section: Weekly Totals */}
        {weeklyTotals && dailyCosts && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Weekly Total Cost */}
            <div className="bg-gradient-to-br from-green-600/30 to-green-800/30 border-2 border-green-600/60 rounded-xl p-6 shadow-lg">
              <div className="text-sm text-green-200 mb-2 font-medium">7-DAY TOTAL COST</div>
              <div className="text-4xl font-bold text-white mb-2">${weeklyTotals.cost}</div>
              <div className="text-sm text-green-300">
                {formatEnergyFromKwh(parseFloat(weeklyTotals.kWh), effectiveUnitSystem, { decimals: 1 })}
              </div>
            </div>
            
            {/* Daily Average */}
            <div className="bg-gradient-to-br from-blue-600/30 to-blue-800/30 border-2 border-blue-600/60 rounded-xl p-6 shadow-lg">
              <div className="text-sm text-blue-200 mb-2 font-medium">DAILY AVERAGE</div>
              <div className="text-3xl font-bold text-white mb-2">${(parseFloat(weeklyTotals.cost) / 7).toFixed(2)}</div>
              <div className="text-xs text-blue-300">
                {formatEnergyFromKwh(parseFloat(weeklyTotals.kWh) / 7, effectiveUnitSystem, { decimals: 1 })} per day
              </div>
            </div>
            
            {/* Backup Heat */}
            {parseFloat(weeklyTotals.auxKwh) > 0 && (
              <div className="bg-gradient-to-br from-orange-600/30 to-red-800/30 border-2 border-orange-600/60 rounded-xl p-6 shadow-lg">
                <div className="text-sm text-orange-200 mb-2 font-medium">BACKUP HEAT</div>
                <div className="text-3xl font-bold text-white mb-2">{formatEnergyFromKwh(parseFloat(weeklyTotals.auxKwh), effectiveUnitSystem, { decimals: 1 })}</div>
                <div className="text-xs text-orange-300">
                  ${(parseFloat(weeklyTotals.auxKwh) * electricityRate).toFixed(2)} this week
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Tabbed Interface */}
        {!isConnected ? (
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <p className="text-yellow-200">Connect to Joule Bridge to see forecast calculations</p>
          </div>
        ) : forecastLoading ? (
          <div className="bg-[#151A21] border border-[#222A35] rounded-lg p-6 text-center">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-2" />
            <p className="text-gray-400">Loading weather forecast...</p>
          </div>
        ) : forecastError ? (
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-200">Error loading forecast: {forecastError}</p>
          </div>
        ) : dailyCosts ? (
          <div className="bg-[#151A21] border border-[#222A35] rounded-lg overflow-hidden">
            <div className="p-4 border-b border-[#222A35]">
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
            <div className="border-b border-[#222A35] bg-[#1D232C]">
              <div className="flex flex-wrap gap-2 p-2">
                <button
                  onClick={() => setActiveTab("forecast")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    activeTab === "forecast"
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-white hover:bg-[#222A35]"
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
                      : "text-gray-400 hover:text-white hover:bg-[#222A35]"
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
                        : "text-gray-400 hover:text-white hover:bg-[#222A35]"
                    }`}
                  >
                    <Code className="w-4 h-4" />
                    Technical Details
                  </button>
                )}
              </div>
            </div>
            
            {/* Tab Content */}
            <div className="p-4">
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
                      <thead className="bg-[#1D232C]">
                        <tr>
                          <th className="px-4 py-3 text-left text-gray-300 font-medium">Day</th>
                          <th className="px-4 py-3 text-right text-gray-300 font-medium" title="Average temperature for this day">Avg Temp</th>
                          <th className="px-4 py-3 text-right text-gray-300 font-medium" title="Minimum and maximum temperatures">Min/Max</th>
                          <th className="px-4 py-3 text-right text-gray-300 font-medium" title="Total heating energy (Heat Pump + Backup)">Heating kWh</th>
                          <th className="px-4 py-3 text-right text-gray-300 font-medium" title="Daily cost">Cost</th>
                        </tr>
                      </thead>
                <tbody>
                        {dailyCosts.map((day, idx) => (
                          <tr key={day.date} className={idx % 2 === 0 ? "bg-[#151A21]" : "bg-[#1A1F27]"}>
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
                </div>
              )}
              
              {activeTab === "system" && (
                <div>
                  <h2 className="text-xl font-semibold text-white mb-4">System Specifications</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#1A1F27] border border-[#222A35] rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-300 mb-3">Efficiency Ratings</h3>
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
                    <div className="bg-[#1A1F27] border border-[#222A35] rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-300 mb-3">System Capacity</h3>
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
                    <div className="bg-[#1A1F27] border border-[#222A35] rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-300 mb-3">Building Characteristics</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Heat Loss Factor:</span>
                          <span className="text-white font-mono">{formatHeatLossFactor(heatLossFactor, effectiveUnitSystem)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-[#1A1F27] border border-[#222A35] rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-300 mb-3">Cost Settings</h3>
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
                        className="w-full mb-4 p-2 bg-[#1A1F27] border border-[#222A35] rounded text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        Hide Detailed Formulas
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowFormula(true)}
                        className="w-full mb-4 p-2 bg-[#1A1F27] border border-[#222A35] rounded text-sm text-gray-400 hover:text-white transition-colors"
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
          <div className="bg-[#151A21] border border-[#222A35] rounded-lg p-6 text-center">
            <p className="text-gray-400">No forecast data available</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForecastDebug;
