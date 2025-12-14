import React, { useMemo, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Thermometer,
  DollarSign,
  Zap,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
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
      // BASE_BTU_PER_SQFT: 22.67 BTU/(hr·ft²) @ 70°F ΔT
      // Source: DOE Residential Energy Consumption Survey (RECS) & ASHRAE Handbook - Fundamentals
      // Represents ~0.32 BTU/(hr·ft²·°F) for average modern code-built homes
      const BASE_BTU_PER_SQFT = 22.67;
      const ceilingMultiplier = 1 + ((userSettings.ceilingHeight || 8) - 8) * 0.1;
      const designHeatLoss = (userSettings.squareFeet || 1500) * 
        BASE_BTU_PER_SQFT * 
        (userSettings.insulationLevel || 1.0) * 
        (userSettings.homeShape || 1.0) * 
        ceilingMultiplier;
      // Divide by 70°F design temp difference to get BTU/hr/°F
      return designHeatLoss / 70; // BTU/hr/°F
    }
    
    // Fallback
    return 314; // ~22,000 BTU/hr design heat loss / 70
  }, [userSettings]);
  
  // HSPF2 efficiency
  const hspf2 = userSettings?.hspf2 || 9.0;
  
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
  const heatLossBtu = useMemo(() => {
    return heatLossFactor * 70; // BTU/hr at design conditions
  }, [heatLossFactor]);
  
  // Calculate balance point: where heat pump output equals building heat loss
  const balancePoint = useMemo(() => {
    if (!ecobeeTargetTemp) return null;
    
    // Try temperatures from 60°F down to find where output = loss
    for (let temp = 60; temp >= -20; temp -= 1) {
      const capacityFactor = heatUtils.getCapacityFactor(temp);
      const heatPumpOutputBtu = tons * 12000 * capacityFactor;
      const deltaT = Math.max(0, ecobeeTargetTemp - temp);
      const buildingHeatLossBtu = heatLossFactor * deltaT;
      if (heatPumpOutputBtu <= buildingHeatLossBtu) {
        return temp;
      }
    }
    return null; // Balance point below -20°F or system can handle all temps
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
      const dayKey = date.toISOString().split('T')[0];
      
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
    
    // Calculate cost for each day with aux heat
    dayMap.forEach((day, key) => {
      const avgTemp = day.temps.reduce((a, b) => a + b, 0) / day.temps.length;
      const minTemp = Math.min(...day.temps);
      const maxTemp = Math.max(...day.temps);
      
      // Calculate hourly performance for aux heat
      let totalHeatPumpKwh = 0;
      let totalAuxKwh = 0;
      
      day.hours.forEach(hour => {
        const perf = heatUtils.computeHourlyPerformance(
          {
            tons: tons,
            indoorTemp: ecobeeTargetTemp,
            heatLossBtu: heatLossBtu,
            compressorPower: compressorPower,
          },
          hour.temp,
          hour.humidity
        );
        
        // Heat pump energy (kWh per hour)
        const heatPumpKwhPerHour = perf.electricalKw * (perf.runtime / 100);
        totalHeatPumpKwh += heatPumpKwhPerHour;
        
        // Aux heat energy (kWh per hour) - only if enabled
        if (useElectricAuxHeat) {
          totalAuxKwh += perf.auxKw;
        }
      });
      
      const totalKwh = totalHeatPumpKwh + totalAuxKwh;
      const dailyCost = totalKwh * electricityRate;
      
      dailyData.push({
        date: key,
        dayName: day.dayName,
        avgTemp: Math.round(avgTemp),
        minTemp: Math.round(minTemp),
        maxTemp: Math.round(maxTemp),
        deltaT: (ecobeeTargetTemp - avgTemp).toFixed(1),
        heatPumpKwh: totalHeatPumpKwh.toFixed(1),
        auxKwh: totalAuxKwh.toFixed(1),
        kWh: totalKwh.toFixed(1),
        cost: dailyCost.toFixed(2),
      });
    });
    
    return dailyData.slice(0, 7); // Limit to 7 days
  }, [ecobeeTargetTemp, forecast, heatLossBtu, tons, compressorPower, useElectricAuxHeat, electricityRate]);
  
  // Weekly totals
  const weeklyTotals = useMemo(() => {
    if (!dailyCosts) return null;
    
    const totalKwh = dailyCosts.reduce((sum, day) => sum + parseFloat(day.kWh), 0);
    const totalHeatPumpKwh = dailyCosts.reduce((sum, day) => sum + parseFloat(day.heatPumpKwh), 0);
    const totalAuxKwh = dailyCosts.reduce((sum, day) => sum + parseFloat(day.auxKwh), 0);
    const totalCost = dailyCosts.reduce((sum, day) => sum + parseFloat(day.cost), 0);
    
    return {
      kWh: totalKwh.toFixed(1),
      heatPumpKwh: totalHeatPumpKwh.toFixed(1),
      auxKwh: totalAuxKwh.toFixed(1),
      cost: totalCost.toFixed(2),
    };
  }, [dailyCosts]);
  
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
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-400" />
            Weekly Planner
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            7-day cost forecast using Ecobee target temperature directly (no scheduling)
          </p>
        </header>
        
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
                  ? "Device is paired but not reachable. Bridge will auto-reconnect. Using default settings for forecast."
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
        
        {/* Calculation Parameters */}
        <div className="bg-[#151A21] border border-[#222A35] rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">Calculation Parameters</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Heat Loss Factor:</span>
              <span className="ml-2 text-white font-mono">{formatHeatLossFactor(heatLossFactor, effectiveUnitSystem)}</span>
            </div>
            <div>
              <span className="text-gray-400">HSPF2:</span>
              <span className="ml-2 text-white font-mono">{hspf2}</span>
            </div>
            <div>
              <span className="text-gray-400">Capacity:</span>
              <span className="ml-2 text-white font-mono">
                {effectiveUnitSystem === UNIT_SYSTEMS.INTL 
                  ? `${(capacity * 0.293071).toFixed(1)} kW`
                  : `${capacity}k BTU (${formatCapacityFromTons(tons, effectiveUnitSystem)})`
                }
              </span>
            </div>
            <div>
              <span className="text-gray-400">SEER2:</span>
              <span className="ml-2 text-white font-mono">{efficiency}</span>
            </div>
            <div>
              <span className="text-gray-400">Location:</span>
              <span className="ml-2 text-white font-mono">
                {userLocation ? `${userLocation.city}, ${userLocation.state}` : "Not set"}
              </span>
            </div>
          </div>
        </div>
        
        {/* 7-Day Forecast Table */}
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
              </p>
              <p className="text-xs text-gray-500 mt-2 italic">
                This forecast assumes your thermostat stays at its current target. If you use schedules or setbacks, actual costs may differ.
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#1D232C]">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">Day</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">Avg Temp</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">Min/Max</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">ΔT</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">HP kWh</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">Aux kWh</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">Total kWh</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyCosts.map((day, idx) => (
                    <tr key={day.date} className={idx % 2 === 0 ? "bg-[#151A21]" : "bg-[#1A1F27]"}>
                      <td className="px-4 py-3 font-medium">{day.dayName}</td>
                      <td className="px-4 py-3 text-right text-cyan-400">{formatTemperatureFromF(day.avgTemp, effectiveUnitSystem, { decimals: 0 })}</td>
                      <td className="px-4 py-3 text-right text-gray-400">
                        {formatTemperatureFromF(day.minTemp, effectiveUnitSystem, { decimals: 0, withUnit: false })} / {formatTemperatureFromF(day.maxTemp, effectiveUnitSystem, { decimals: 0, withUnit: false })}
                      </td>
                      <td className="px-4 py-3 text-right text-orange-400">
                        {(() => {
                          const deltaT = parseFloat(day.deltaT);
                          return effectiveUnitSystem === UNIT_SYSTEMS.INTL 
                            ? `${(deltaT * 5/9).toFixed(1)}°C`
                            : `${deltaT}°F`;
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right text-blue-400">{formatEnergy(day.heatPumpKwh)}</td>
                      <td className="px-4 py-3 text-right text-red-400">{formatEnergy(day.auxKwh)}</td>
                      <td className="px-4 py-3 text-right text-yellow-400 font-semibold">{formatEnergy(day.kWh)}</td>
                      <td className="px-4 py-3 text-right text-green-400 font-bold">${day.cost}</td>
                    </tr>
                  ))}
                </tbody>
                {weeklyTotals && (
                  <tfoot className="bg-[#1E4CFF]/20 border-t border-[#1E4CFF]">
                    <tr>
                      <td className="px-4 py-3 font-bold" colSpan={4}>Weekly Total</td>
                      <td className="px-4 py-3 text-right text-blue-400 font-bold">{formatEnergy(weeklyTotals.heatPumpKwh)}</td>
                      <td className="px-4 py-3 text-right text-red-400 font-bold">{formatEnergy(weeklyTotals.auxKwh)}</td>
                      <td className="px-4 py-3 text-right text-yellow-400 font-bold">{formatEnergy(weeklyTotals.kWh)}</td>
                      <td className="px-4 py-3 text-right text-green-400 font-bold text-lg">${weeklyTotals.cost}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-[#151A21] border border-[#222A35] rounded-lg p-6 text-center">
            <p className="text-gray-400">No forecast data available</p>
          </div>
        )}
        
        {/* Formula Explanation */}
        <div className="mt-6 bg-[#151A21] border border-[#222A35] rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Calculation Formula</h3>
          <div className="text-xs text-gray-400 font-mono space-y-1">
            <p><span className="text-purple-400">Aux Threshold Temperature:</span> Find temp where Heat Pump Output = Building Heat Loss</p>
            <p className="ml-2">Heat Pump Output = {formatCapacityFromTons(tons, effectiveUnitSystem)} × 12,000 × Capacity Factor(temp)</p>
            <p className="ml-4 text-xs text-gray-500 italic">Source: 12,000 BTU/ton = standard refrigeration ton (ASHRAE Handbook - Fundamentals). Capacity Factor derating based on AHRI performance data.</p>
            <p className="ml-2">Building Heat Loss = {formatHeatLossFactor(heatLossFactor, effectiveUnitSystem)} × ({ecobeeTargetTemp !== null ? formatTemperatureFromF(ecobeeTargetTemp, effectiveUnitSystem, { decimals: 1, withUnit: false }) : "—"} - outdoor temp)</p>
            <p className="ml-4 text-xs text-gray-500 italic">Source: Heat loss factor calculated from building characteristics using DOE Residential Energy Consumption Survey (RECS) & ASHRAE Handbook - Fundamentals.</p>
            {balancePoint !== null ? (
              <>
                <p className="ml-2 text-purple-300">Aux threshold temperature: <strong>{formatTemperatureFromF(balancePoint, effectiveUnitSystem, { decimals: 1 })}</strong></p>
                <p className="ml-4 text-gray-400 text-xs">Below this outdoor temperature, your heat pump may need backup heat to hold the setpoint.</p>
                <p className="ml-2 text-red-300">Aux heat required when outdoor temp &lt; {formatTemperatureFromF(balancePoint, effectiveUnitSystem, { decimals: 1 })}</p>
                <p className="ml-2 text-gray-500">Below {formatTemperatureFromF(balancePoint, effectiveUnitSystem, { decimals: 1 })}, heat pump output drops below building heat loss, so electric strip heat supplements the heat pump.</p>
              </>
            ) : (
              <p className="ml-2 text-purple-300">Aux threshold: Below {formatTemperatureFromF(-20, effectiveUnitSystem, { decimals: 0 })} (system can handle all temps without aux)</p>
            )}
            <p className="mt-2">ΔT = Ecobee Target ({ecobeeTargetTemp !== null ? formatTemperatureFromF(ecobeeTargetTemp, effectiveUnitSystem, { decimals: 1 }) : "—"}) - Outdoor Temp</p>
            <p>Heat Loss = {formatHeatLossFactor(heatLossFactor, effectiveUnitSystem)} × ΔT = BTU/hr needed</p>
            <p>Heat Pump Output = {formatCapacityFromTons(tons, effectiveUnitSystem)} × 12,000 × Capacity Factor (varies with temp)</p>
            <p className="ml-2 text-xs text-gray-500 italic">Capacity Factor: 1.0 @ 47°F+, linear derate 1.0 - (47 - T) × 0.012 for 17°F ≤ T &lt; 47°F, then 0.64 - (17 - T) × 0.01 below 17°F (AHRI performance data)</p>
            <p>If Heat Loss &gt; Heat Pump Output: Aux Heat = (Deficit BTU) ÷ 3,412.14 BTU/kWh</p>
            <p className="ml-2 text-xs text-gray-500 italic">Source: 3,412.14 BTU/kWh = standard energy conversion constant</p>
            <p>Heat Pump {nerdMode ? "Energy" : "kWh"} = (Electrical kW × Runtime%) × 24 hours</p>
            <p>Total {nerdMode ? "Energy" : "kWh"} = Heat Pump {nerdMode ? "Energy" : "kWh"} + Aux Heat {nerdMode ? "Energy" : "kWh"}</p>
            <p>Daily Cost = Total {nerdMode ? "Energy" : "kWh"} × ${electricityRate.toFixed(3)}/kWh</p>
            <div className="mt-3 pt-3 border-t border-[#222A35]">
              <p className="text-xs text-gray-500 italic">
                <strong>References:</strong> ASHRAE Handbook - Fundamentals (refrigeration ton, building heat loss), 
                DOE Residential Energy Consumption Survey (RECS) (building heat loss constants), 
                AHRI (Air-Conditioning, Heating, and Refrigeration Institute) performance data (capacity derating curves)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForecastDebug;
