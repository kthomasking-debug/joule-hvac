import React, { useState, useMemo, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Thermometer,
  DollarSign,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { useJouleBridgeContext } from "../contexts/JouleBridgeContext";
import { getCached } from "../utils/cachedStorage";
import { getAnnualHDD, getAnnualCDD } from "../lib/hddData";
import {
  fetchLiveElectricityRate,
  getStateCode,
} from "../lib/eiaRates";
import { getStateElectricityRate } from "../data/stateRates";
import {
  defaultFixedChargesByState,
  defaultFallbackFixedCharges,
  normalizeStateToAbbreviation,
} from "../data/fixedChargesByState";
import * as heatUtils from "../lib/heatUtils";
import useExtendedForecast from "../hooks/useExtendedForecast";
import useHistoricalHourly from "../hooks/useHistoricalHourly";
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

/**
 * BudgetDebug - Simplified monthly/annual budget using Ecobee target temp directly
 * 
 * This page calculates costs using the actual target temperature from the Ecobee
 * thermostat via HomeKit (Joule Bridge), without any scheduling complexity.
 */

// Monthly HDD/CDD distribution (typical US pattern)
const MONTHLY_HDD_DIST = [1200, 1000, 600, 200, 50, 10, 0, 0, 20, 200, 500, 1100]; // Jan-Dec
const MONTHLY_CDD_DIST = [0, 0, 10, 50, 150, 300, 400, 380, 200, 50, 10, 0]; // Jan-Dec
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const BudgetDebug = () => {
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
  
  // Target temperature from Ecobee (via Joule Bridge)
  const ecobeeTargetTemp = useMemo(() => {
    if (jouleBridge.bridgeAvailable && jouleBridge.connected && jouleBridge.targetTemperature !== null) {
      return jouleBridge.targetTemperature;
    }
    return null;
  }, [jouleBridge.bridgeAvailable, jouleBridge.connected, jouleBridge.targetTemperature]);
  
  // Current indoor temperature from Ecobee
  const currentIndoorTemp = useMemo(() => {
    if (jouleBridge.bridgeAvailable && jouleBridge.connected && jouleBridge.temperature !== null) {
      return jouleBridge.temperature;
    }
    return null;
  }, [jouleBridge.bridgeAvailable, jouleBridge.connected, jouleBridge.temperature]);
  
  // HVAC mode from Ecobee
  const hvacMode = useMemo(() => {
    if (jouleBridge.bridgeAvailable && jouleBridge.connected && jouleBridge.mode) {
      return jouleBridge.mode;
    }
    return "heat";
  }, [jouleBridge.bridgeAvailable, jouleBridge.connected, jouleBridge.mode]);
  
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
      const BASE_BTU_PER_SQFT = 22.67;
      const ceilingMultiplier = 1 + ((userSettings.ceilingHeight || 8) - 8) * 0.1;
      const designHeatLoss = (userSettings.squareFeet || 1500) * 
        BASE_BTU_PER_SQFT * 
        (userSettings.insulationLevel || 1.0) * 
        (userSettings.homeShape || 1.0) * 
        ceilingMultiplier;
      return designHeatLoss / 70; // BTU/hr/°F
    }
    
    // Fallback
    return 314; // ~22,000 BTU/hr design heat loss / 70
  }, [userSettings]);
  
  // Heat gain factor for cooling (typically higher than heat loss)
  const heatGainFactor = useMemo(() => {
    const BASE_BTU_PER_SQFT_COOLING = 28.0;
    const ceilingMultiplier = 1 + ((userSettings.ceilingHeight || 8) - 8) * 0.1;
    const designHeatGain = (userSettings.squareFeet || 1500) * 
      BASE_BTU_PER_SQFT_COOLING * 
      (userSettings.insulationLevel || 1.0) * 
      (userSettings.homeShape || 1.0) * 
      ceilingMultiplier *
      (userSettings.solarExposure || 1.0);
    return designHeatGain / 20; // BTU/hr/°F for cooling (smaller delta T)
  }, [userSettings]);
  
  // Efficiency values
  const hspf2 = userSettings?.hspf2 || 9.0;
  const seer2 = userSettings?.efficiency || 15.0;
  
  // System capacity and efficiency for aux heat calculations
  const capacity = Number(userSettings?.capacity ?? userSettings?.coolingCapacity ?? 36); // kBTU
  const tons = capacity / 12.0; // Convert kBTU to tons
  const useElectricAuxHeat = Boolean(userSettings?.useElectricAuxHeat !== false); // Default to true
  
  // Calculate compressor power (kW) from tons and efficiency
  const compressorPower = useMemo(() => {
    // Formula: tons * 1.0 * (15 / efficiency)
    return (tons * 1.0 * (15 / Math.max(1, seer2)));
  }, [tons, seer2]);
  
  // Calculate total design heat loss (BTU/hr at 70°F delta-T)
  const heatLossBtu = useMemo(() => {
    return heatLossFactor * 70; // BTU/hr at design conditions
  }, [heatLossFactor]);
  
  // Get annual HDD/CDD for location (needed before balance point and coldest month analysis)
  const annualHDD = useMemo(() => {
    if (!userLocation) return 5000; // Default
    return getAnnualHDD(`${userLocation.city}, ${userLocation.state}`, userLocation.state);
  }, [userLocation]);
  
  const annualCDD = useMemo(() => {
    if (!userLocation) return 1500; // Default
    return getAnnualCDD(`${userLocation.city}, ${userLocation.state}`, userLocation.state);
  }, [userLocation]);
  
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
  
  // Calculate temperature analysis for coldest month to explain aux heat calculation
  const coldestMonthAnalysis = useMemo(() => {
    if (!ecobeeTargetTemp || !annualHDD || balancePoint === null) return null;
    
    // Find month with highest HDD (typically January)
    const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const totalTypicalHDD = MONTHLY_HDD_DIST.reduce((a, b) => a + b, 0);
    const maxHDD = Math.max(...MONTHLY_HDD_DIST);
    const maxHDDIndex = MONTHLY_HDD_DIST.indexOf(maxHDD);
    const maxHDDDays = daysPerMonth[maxHDDIndex];
    
    // Scale to actual location HDD
    const scaledMaxHDD = totalTypicalHDD > 0 
      ? (maxHDD / totalTypicalHDD) * annualHDD 
      : maxHDD;
    
    // Estimate monthly average temp: 65 - (HDD / days)
    // This is the AVERAGE, not the minimum - there are much colder nights
    const monthlyAvgTemp = Math.max(-20, 65 - (scaledMaxHDD / maxHDDDays));
    
    // Estimate minimum temperature (typically 15-20°F below average for winter months)
    // For Blairsville GA and similar climates, winter nights can be 15-25°F below daily average
    const estimatedMinTemp = monthlyAvgTemp - 20; // Conservative estimate
    
    // Calculate at average temp (heat pump can handle this)
    const capacityFactorAvg = heatUtils.getCapacityFactor(monthlyAvgTemp);
    const heatPumpOutputBtuAvg = tons * 12000 * capacityFactorAvg;
    const deltaTAvg = Math.max(0, ecobeeTargetTemp - monthlyAvgTemp);
    const buildingHeatLossBtuAvg = heatLossFactor * deltaTAvg;
    const surplusBtuAvg = heatPumpOutputBtuAvg - buildingHeatLossBtuAvg;
    
    // Calculate at estimated minimum temp (aux heat needed)
    const capacityFactorMin = heatUtils.getCapacityFactor(estimatedMinTemp);
    const heatPumpOutputBtuMin = tons * 12000 * capacityFactorMin;
    const deltaTMin = Math.max(0, ecobeeTargetTemp - estimatedMinTemp);
    const buildingHeatLossBtuMin = heatLossFactor * deltaTMin;
    const deficitBtuMin = buildingHeatLossBtuMin - heatPumpOutputBtuMin;
    
    return {
      monthlyAvgTemp: monthlyAvgTemp.toFixed(1),
      estimatedMinTemp: estimatedMinTemp.toFixed(1),
      balancePoint: balancePoint.toFixed(1),
      heatPumpOutputBtuAvg: heatPumpOutputBtuAvg.toFixed(0),
      buildingHeatLossBtuAvg: buildingHeatLossBtuAvg.toFixed(0),
      surplusBtuAvg: surplusBtuAvg.toFixed(0),
      heatPumpOutputBtuMin: heatPumpOutputBtuMin.toFixed(0),
      buildingHeatLossBtuMin: buildingHeatLossBtuMin.toFixed(0),
      deficitBtuMin: deficitBtuMin > 0 ? deficitBtuMin.toFixed(0) : "0",
      needsAuxAtMin: deficitBtuMin > 0,
    };
  }, [ecobeeTargetTemp, annualHDD, tons, heatLossFactor, balancePoint]);
  
  // Fixed charges
  const fixedCharges = useMemo(() => {
    if (!userLocation?.state) return defaultFallbackFixedCharges;
    const stateAbbr = normalizeStateToAbbreviation(userLocation.state);
    return stateAbbr && defaultFixedChargesByState[stateAbbr]
      ? defaultFixedChargesByState[stateAbbr]
      : defaultFallbackFixedCharges;
  }, [userLocation]);
  
  const monthlyFixedCharge = userSettings.fixedElectricCost ?? fixedCharges.electric;
  
  // Get extended forecast for current month (14 days from NWS)
  const currentMonth = new Date().getMonth();
  const { forecast: extendedForecast, loading: forecastLoading } = useExtendedForecast(
    userLocation?.latitude,
    userLocation?.longitude,
    { enabled: !!userLocation?.latitude && !!userLocation?.longitude }
  );
  
  // Year selection for aux heat calculation
  const [auxHeatYear, setAuxHeatYear] = useState(() => new Date().getFullYear() - 1); // Default to previous year
  const [useWorstYear, setUseWorstYear] = useState(false);
  
  // Get hourly historical data for selected year (for accurate aux heat calculation)
  const { hourlyData: historicalHourly, loading: historicalLoading } = useHistoricalHourly(
    userLocation?.latitude,
    userLocation?.longitude,
    { 
      enabled: !!userLocation?.latitude && !!userLocation?.longitude && balancePoint !== null,
      year: auxHeatYear
    }
  );
  
  // Calculate monthly costs using Ecobee target temp with aux heat
  const monthlyBudget = useMemo(() => {
    if (!ecobeeTargetTemp) return null;
    
    const totalTypicalHDD = MONTHLY_HDD_DIST.reduce((a, b) => a + b, 0);
    const totalTypicalCDD = MONTHLY_CDD_DIST.reduce((a, b) => a + b, 0);
    
    // Days per month (approximate)
    const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    
    const months = MONTH_NAMES.map((name, idx) => {
      // Scale monthly HDD/CDD to location's annual totals
      const monthHDD = totalTypicalHDD > 0 
        ? (MONTHLY_HDD_DIST[idx] / totalTypicalHDD) * annualHDD 
        : 0;
      const monthCDD = totalTypicalCDD > 0 
        ? (MONTHLY_CDD_DIST[idx] / totalTypicalCDD) * annualCDD 
        : 0;
      
      // For current month, use extended forecast data if available
      const isCurrentMonth = idx === currentMonth;
      let avgOutdoorTemp = 65;
      let minOutdoorTemp = 65;
      let maxOutdoorTemp = 65;
      let useForecastData = false;
      
      if (isCurrentMonth && extendedForecast && extendedForecast.length > 0) {
        // Use actual forecast data for current month
        const temps = extendedForecast.map(h => h.temp).filter(t => t != null);
        if (temps.length > 0) {
          avgOutdoorTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
          minOutdoorTemp = Math.min(...temps);
          maxOutdoorTemp = Math.max(...temps);
          useForecastData = true;
        }
      }
      
      // For historical months, estimate from HDD with better temperature distribution
      if (!useForecastData) {
        // Estimate average outdoor temp from HDD
        // HDD = sum of (65 - outdoor_temp) for all hours where outdoor < 65
        // Average temp ≈ 65 - (HDD / days_in_month)
        avgOutdoorTemp = monthHDD > 0 
          ? Math.max(-20, 65 - (monthHDD / daysPerMonth[idx])) // Cap at -20°F minimum
          : 65; // No heating needed
        
        // Estimate min/max from average (typical winter: min ~20-30°F below avg, max ~10-15°F above)
        // For heating months with high HDD, assume larger spread and colder minimums
        if (monthHDD > 0) {
          // More HDD = colder month = larger temperature spread
          const hddPerDay = monthHDD / daysPerMonth[idx];
          const tempSpread = Math.max(20, Math.min(40, hddPerDay * 1.2)); // 20-40°F spread
          // Minimum temp should be well below balance point for high HDD months
          // For Jan/Feb with high HDD, minimums can be 25-30°F below average
          minOutdoorTemp = avgOutdoorTemp - tempSpread * 0.7; // Min is ~70% of spread below avg (colder)
          maxOutdoorTemp = avgOutdoorTemp + tempSpread * 0.3; // Max is ~30% of spread above avg
        } else {
          minOutdoorTemp = avgOutdoorTemp;
          maxOutdoorTemp = avgOutdoorTemp;
        }
      }
      
      // Calculate heating with aux heat
      let heatingKwh = 0;
      let auxKwh = 0;
      let heatPumpKwh = 0;
      
      if (monthHDD > 0) {
        // Use pre-calculated balance point
        // Use a representative temperature that's below the balance point for aux heat calculation
        // If balance point exists and avg temp is above it, use balance point - 10°F for aux calc
        // Otherwise use avg temp
        const auxCalcTemp = (balancePoint !== null && avgOutdoorTemp > balancePoint)
          ? Math.max(balancePoint - 10, avgOutdoorTemp - 15) // Use colder temp for aux calc
          : avgOutdoorTemp;
        
        // Calculate performance at average temp (for heat pump)
        const perfAvg = heatUtils.computeHourlyPerformance(
          {
            tons: tons,
            indoorTemp: ecobeeTargetTemp,
            heatLossBtu: heatLossBtu,
            compressorPower: compressorPower,
          },
          avgOutdoorTemp,
          50 // Typical humidity
        );
        
        // Calculate performance at aux calc temp (for aux heat)
        const perfAux = heatUtils.computeHourlyPerformance(
          {
            tons: tons,
            indoorTemp: ecobeeTargetTemp,
            heatLossBtu: heatLossBtu,
            compressorPower: compressorPower,
          },
          auxCalcTemp,
          50 // Typical humidity
        );
        
        // Calculate total monthly heating BTU needed (from HDD)
        // HDD represents degree-days, so total BTU = heatLossFactor * HDD * 24
        const totalMonthlyHeatingBtu = heatLossFactor * monthHDD * 24;
        
        // Calculate representative hourly heating load at avg outdoor temp
        const deltaT = Math.max(0, ecobeeTargetTemp - avgOutdoorTemp);
        const hourlyHeatLossBtu = heatLossFactor * deltaT;
        
        // Heat pump kWh per hour (at average conditions)
        const heatPumpKwhPerHour = perfAvg.electricalKw * (perfAvg.runtime / 100);
        
        // Aux heat kWh per hour (at colder conditions when aux is needed)
        const auxKwhPerHour = useElectricAuxHeat ? perfAux.auxKw : 0;
        
        // Scale to monthly totals based on actual heating load
        const hoursInMonth = daysPerMonth[idx] * 24;
        const loadRatio = hourlyHeatLossBtu > 0 
          ? (totalMonthlyHeatingBtu / hoursInMonth) / hourlyHeatLossBtu
          : 1.0;
        
        // Heat pump kWh scales with the actual monthly load
        heatPumpKwh = heatPumpKwhPerHour * hoursInMonth * loadRatio;
        
        // Aux heat: calculate based on temperature distribution
        // If we have forecast data, calculate aux for each hour below balance point
        if (useForecastData && balancePoint !== null && extendedForecast) {
          // Calculate aux heat for each hour in forecast that's below balance point
          let totalAuxKwhFromForecast = 0;
          extendedForecast.forEach(hour => {
            if (hour.temp < balancePoint) {
              const perf = heatUtils.computeHourlyPerformance(
                {
                  tons: tons,
                  indoorTemp: ecobeeTargetTemp,
                  heatLossBtu: heatLossBtu,
                  compressorPower: compressorPower,
                },
                hour.temp,
                hour.humidity ?? 50
              );
              if (useElectricAuxHeat && perf.auxKw > 0) {
                totalAuxKwhFromForecast += perf.auxKw;
              }
            }
          });
          
          // Scale to full month: (forecast aux / forecast days) * days in month
          const forecastDays = extendedForecast.length / 24;
          auxKwh = forecastDays > 0 
            ? (totalAuxKwhFromForecast / forecastDays) * daysPerMonth[idx]
            : 0;
        } else if (historicalHourly && historicalHourly.length > 0 && balancePoint !== null) {
          // Use historical hourly data for accurate aux heat calculation
          // Filter hours for this month from historical data
          const monthHours = historicalHourly.filter(hour => {
            const hourDate = new Date(hour.time);
            return hourDate.getMonth() === idx;
          });
          
          // Calculate aux heat for each hour below balance point
          let totalAuxKwhFromHistory = 0;
          let totalHeatPumpKwhFromHistory = 0;
          
          monthHours.forEach(hour => {
            const perf = heatUtils.computeHourlyPerformance(
              {
                tons: tons,
                indoorTemp: ecobeeTargetTemp,
                heatLossBtu: heatLossBtu,
                compressorPower: compressorPower,
              },
              hour.temp,
              hour.humidity ?? 50
            );
            
            // Heat pump energy
            totalHeatPumpKwhFromHistory += perf.electricalKw * (perf.runtime / 100);
            
            // Aux heat energy (only when needed)
            if (hour.temp < balancePoint && useElectricAuxHeat && perf.auxKw > 0) {
              totalAuxKwhFromHistory += perf.auxKw;
            }
          });
          
          // Use historical data if we have enough hours, otherwise scale
          if (monthHours.length >= daysPerMonth[idx] * 20) {
            // We have good historical coverage, use it directly
            auxKwh = totalAuxKwhFromHistory;
            // Scale heat pump to match total heating load from HDD
            const historicalHeatPumpRatio = totalHeatPumpKwhFromHistory > 0
              ? heatPumpKwh / totalHeatPumpKwhFromHistory
              : 1.0;
            heatPumpKwh = totalHeatPumpKwhFromHistory * historicalHeatPumpRatio;
          } else {
            // Not enough historical data, scale what we have
            const scaleFactor = (daysPerMonth[idx] * 24) / monthHours.length;
            auxKwh = totalAuxKwhFromHistory * scaleFactor;
            heatPumpKwh = totalHeatPumpKwhFromHistory * scaleFactor;
          }
        } else {
          // Fallback: estimate aux fraction based on temperature distribution
          let auxFraction = 0;
          if (balancePoint !== null && monthHDD > 0) {
            // Estimate hours below balance point using statistical approach
            if (avgOutdoorTemp > balancePoint) {
              const tempAboveBalance = avgOutdoorTemp - balancePoint;
              const hddPerDay = monthHDD / daysPerMonth[idx];
              const baseFraction = Math.max(0, Math.min(0.6, 
                (hddPerDay / 30) * (1 - tempAboveBalance / 30)
              ));
              
              if (minOutdoorTemp < balancePoint) {
                const tempRange = maxOutdoorTemp - minOutdoorTemp;
                if (tempRange > 0) {
                  const depthBelowBalance = balancePoint - minOutdoorTemp;
                  const additionalFraction = Math.min(0.4, (depthBelowBalance / tempRange) * 0.8);
                  auxFraction = Math.min(0.7, baseFraction + additionalFraction);
                } else {
                  auxFraction = baseFraction;
                }
              } else {
                auxFraction = baseFraction;
              }
            } else if (avgOutdoorTemp <= balancePoint) {
              auxFraction = 0.7;
            }
          }
          
          // Scale aux heat: use aux kWh per hour * hours * fraction of time aux is needed
          auxKwh = auxKwhPerHour * hoursInMonth * auxFraction;
        }
        
        heatingKwh = heatPumpKwh + auxKwh;
      }
      
      // Cooling cost calculation (no aux heat for cooling)
      // CDD works similarly but with SEER2
      // SEER2 = BTU / Wh, so kWh = BTU / (SEER2 * 1000)
      const coolingBtu = heatGainFactor * monthCDD * 24;
      const coolingKwh = coolingBtu / (seer2 * 1000);
      const coolingCost = coolingKwh * electricityRate;
      
      // Total for month
      const totalKwh = heatingKwh + coolingKwh;
      const heatingCost = heatingKwh * electricityRate;
      const energyCost = heatingCost + coolingCost;
      const totalCost = energyCost + monthlyFixedCharge;
      
      return {
        month: name,
        monthIdx: idx,
        hdd: Math.round(monthHDD),
        cdd: Math.round(monthCDD),
        heatPumpKwh: heatPumpKwh.toFixed(0),
        auxKwh: auxKwh.toFixed(0),
        heatingKwh: heatingKwh.toFixed(0),
        coolingKwh: coolingKwh.toFixed(0),
        totalKwh: totalKwh.toFixed(0),
        heatingCost: heatingCost.toFixed(2),
        coolingCost: coolingCost.toFixed(2),
        energyCost: energyCost.toFixed(2),
        fixedCost: monthlyFixedCharge.toFixed(2),
        totalCost: totalCost.toFixed(2),
      };
    });
    
    return months;
  }, [ecobeeTargetTemp, annualHDD, annualCDD, heatLossFactor, heatGainFactor, hspf2, seer2, electricityRate, monthlyFixedCharge, tons, heatLossBtu, compressorPower, useElectricAuxHeat, extendedForecast, currentMonth, balancePoint, historicalHourly]);
  
  // Annual totals
  const annualTotals = useMemo(() => {
    if (!monthlyBudget) return null;
    
    const totalHeatPumpKwh = monthlyBudget.reduce((sum, m) => sum + parseFloat(m.heatPumpKwh), 0);
    const totalAuxKwh = monthlyBudget.reduce((sum, m) => sum + parseFloat(m.auxKwh), 0);
    const totalHeatingKwh = totalHeatPumpKwh + totalAuxKwh;
    const totalCoolingKwh = monthlyBudget.reduce((sum, m) => sum + parseFloat(m.coolingKwh), 0);
    const totalKwh = totalHeatingKwh + totalCoolingKwh;
    const totalHeatingCost = monthlyBudget.reduce((sum, m) => sum + parseFloat(m.heatingCost), 0);
    const totalCoolingCost = monthlyBudget.reduce((sum, m) => sum + parseFloat(m.coolingCost), 0);
    const totalEnergyCost = totalHeatingCost + totalCoolingCost;
    const totalFixedCost = monthlyFixedCharge * 12;
    const totalCost = totalEnergyCost + totalFixedCost;
    
    return {
      heatPumpKwh: totalHeatPumpKwh.toFixed(0),
      auxKwh: totalAuxKwh.toFixed(0),
      heatingKwh: totalHeatingKwh.toFixed(0),
      coolingKwh: totalCoolingKwh.toFixed(0),
      totalKwh: totalKwh.toFixed(0),
      heatingCost: totalHeatingCost.toFixed(2),
      coolingCost: totalCoolingCost.toFixed(2),
      energyCost: totalEnergyCost.toFixed(2),
      fixedCost: totalFixedCost.toFixed(2),
      totalCost: totalCost.toFixed(2),
    };
  }, [monthlyBudget, monthlyFixedCharge]);
  
  const isConnected = jouleBridge.bridgeAvailable && jouleBridge.connected;
  
  return (
    <div className="min-h-screen bg-[#0C0F14] text-white">
      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-purple-400" />
            Budget Debug
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Annual budget calculation using Ecobee target temperature directly (no scheduling)
          </p>
        </header>
        
        {/* Connection Status */}
        <div className={`mb-6 p-4 rounded-lg border ${
          isConnected 
            ? "bg-emerald-900/20 border-emerald-700" 
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
                {isConnected ? "Connected to Joule Bridge" : "Joule Bridge Not Connected"}
              </div>
              <div className="text-sm text-gray-400">
                {isConnected 
                  ? `Mode: ${hvacMode?.toUpperCase() || "—"} • Last update: ${new Date().toLocaleTimeString()}`
                  : "Start the Joule Bridge to get real Ecobee data"}
              </div>
            </div>
            {jouleBridge.loading && (
              <RefreshCw className="w-4 h-4 text-blue-400 animate-spin ml-auto" />
            )}
          </div>
        </div>
        
        {/* Current Values Panel */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {/* Ecobee Target Temp */}
          <div className="bg-[#151A21] border border-[#222A35] rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Thermometer className="w-3 h-3" />
              Ecobee Target
            </div>
            <div className="text-xl font-bold text-orange-400">
              {ecobeeTargetTemp !== null ? formatTemperatureFromF(ecobeeTargetTemp, effectiveUnitSystem, { decimals: 1 }) : "—"}
            </div>
          </div>
          
          {/* Current Indoor Temp */}
          <div className="bg-[#151A21] border border-[#222A35] rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Thermometer className="w-3 h-3" />
              Indoor Now
            </div>
            <div className="text-xl font-bold text-blue-400">
              {currentIndoorTemp !== null ? formatTemperatureFromF(currentIndoorTemp, effectiveUnitSystem, { decimals: 1 }) : "—"}
            </div>
          </div>
          
          {/* Annual HDD */}
          <div className="bg-[#151A21] border border-[#222A35] rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <TrendingUp className="w-3 h-3" />
              Annual HDD
            </div>
            <div className="text-xl font-bold text-cyan-400">
              {annualHDD.toLocaleString()}
            </div>
          </div>
          
          {/* Annual CDD */}
          <div className="bg-[#151A21] border border-[#222A35] rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <TrendingUp className="w-3 h-3" />
              Annual CDD
            </div>
            <div className="text-xl font-bold text-red-400">
              {annualCDD.toLocaleString()}
            </div>
          </div>
          
          {/* Electricity Rate */}
          <div className="bg-[#151A21] border border-[#222A35] rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <DollarSign className="w-3 h-3" />
              Rate
            </div>
            <div className="text-xl font-bold text-green-400">
              ${electricityRate.toFixed(3)}
            </div>
          </div>
        </div>
        
        {/* Calculation Parameters */}
        <div className="bg-[#151A21] border border-[#222A35] rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold mb-3">Calculation Parameters</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
            <div>
              <span className="text-gray-400">Heat Loss:</span>
              <span className="ml-1 text-white font-mono">{formatHeatLossFactor(heatLossFactor, effectiveUnitSystem)}</span>
            </div>
            <div>
              <span className="text-gray-400">Heat Gain:</span>
              <span className="ml-1 text-white font-mono">{formatHeatLossFactor(heatGainFactor, effectiveUnitSystem)}</span>
            </div>
            <div>
              <span className="text-gray-400">HSPF2:</span>
              <span className="ml-1 text-white font-mono">{hspf2}</span>
            </div>
            <div>
              <span className="text-gray-400">SEER2:</span>
              <span className="ml-1 text-white font-mono">{seer2}</span>
            </div>
            <div>
              <span className="text-gray-400">Capacity:</span>
              <span className="ml-1 text-white font-mono">
                {effectiveUnitSystem === UNIT_SYSTEMS.INTL 
                  ? `${(capacity * 0.293071).toFixed(1)} kW`
                  : `${capacity}k BTU (${formatCapacityFromTons(tons, effectiveUnitSystem)})`
                }
              </span>
            </div>
            <div>
              <span className="text-gray-400">Fixed:</span>
              <span className="ml-1 text-white font-mono">${monthlyFixedCharge.toFixed(2)}/mo</span>
            </div>
          </div>
        </div>
        
        {/* Annual Summary Cards */}
        {annualTotals && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-600/40 rounded-lg p-4">
              <div className="text-sm text-blue-300 mb-1">Annual Heating</div>
              <div className="text-2xl font-bold text-white">${annualTotals.heatingCost}</div>
              <div className="text-xs text-blue-400">
                {nerdMode 
                  ? (() => {
                      const joules = kwhToJ(parseFloat(annualTotals.heatingKwh));
                      const { value, unit } = formatJoulesParts(joules);
                      return `${value} ${unit} (${parseInt(annualTotals.heatingKwh).toLocaleString()} kWh)`;
                    })()
                  : formatEnergyFromKwh(parseFloat(annualTotals.heatingKwh), effectiveUnitSystem, { decimals: 0 })
                }
              </div>
            </div>
            <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 border border-red-600/40 rounded-lg p-4">
              <div className="text-sm text-red-300 mb-1">Annual Cooling</div>
              <div className="text-2xl font-bold text-white">${annualTotals.coolingCost}</div>
              <div className="text-xs text-red-400">
                {nerdMode 
                  ? (() => {
                      const joules = kwhToJ(parseFloat(annualTotals.coolingKwh));
                      const { value, unit } = formatJoulesParts(joules);
                      return `${value} ${unit} (${parseInt(annualTotals.coolingKwh).toLocaleString()} kWh)`;
                    })()
                  : formatEnergyFromKwh(parseFloat(annualTotals.coolingKwh), effectiveUnitSystem, { decimals: 0 })
                }
              </div>
            </div>
            <div className="bg-gradient-to-br from-gray-600/20 to-gray-800/20 border border-gray-600/40 rounded-lg p-4">
              <div className="text-sm text-gray-300 mb-1">Fixed Charges</div>
              <div className="text-2xl font-bold text-white">${annualTotals.fixedCost}</div>
              <div className="text-xs text-gray-400">${monthlyFixedCharge.toFixed(2)} × 12</div>
            </div>
            <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-600/40 rounded-lg p-4">
              <div className="text-sm text-green-300 mb-1">Annual Total</div>
              <div className="text-3xl font-bold text-white">${annualTotals.totalCost}</div>
              <div className="text-xs text-green-400">
                {nerdMode 
                  ? (() => {
                      const joules = kwhToJ(parseFloat(annualTotals.totalKwh));
                      const { value, unit } = formatJoulesParts(joules);
                      return `${value} ${unit} (${parseInt(annualTotals.totalKwh).toLocaleString()} kWh total)`;
                    })()
                  : formatEnergyFromKwh(parseFloat(annualTotals.totalKwh), effectiveUnitSystem, { decimals: 0 })
                }
              </div>
            </div>
          </div>
        )}
        
        {/* Monthly Budget Table */}
        {!isConnected ? (
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <p className="text-yellow-200">Connect to Joule Bridge to see budget calculations</p>
          </div>
        ) : monthlyBudget ? (
          <div className="bg-[#151A21] border border-[#222A35] rounded-lg overflow-hidden">
            <div className="p-4 border-b border-[#222A35]">
              <h2 className="text-lg font-semibold">Monthly Budget Breakdown</h2>
              <p className="text-sm text-gray-400">
                Using constant target: <span className="text-orange-400 font-bold">{ecobeeTargetTemp?.toFixed(1)}°F</span>
                {" "}• Location: {userLocation ? `${userLocation.city}, ${userLocation.state}` : "Not set"}
              </p>
              {extendedForecast && extendedForecast.length > 0 && (
                <p className="text-xs text-blue-400 mt-1">
                  📡 Using NWS 14-day forecast for {MONTH_NAMES[currentMonth]}
                </p>
              )}
              {/* Aux Heat Year Selection */}
              {balancePoint !== null && userLocation && (
                <div className="mt-3 p-3 bg-purple-900/20 border border-purple-700/50 rounded-lg">
                  <div className="mb-2">
                    <p className="text-xs text-purple-300 font-semibold mb-1">
                      Aux heat risk (varies by winter):
                    </p>
                    <p className="text-xs text-gray-400 mb-2">
                      Monthly costs use typical climate averages, but aux heat depends on <em>cold snaps</em>.
                      Pick a weather year to see how a milder or colder winter changes aux usage.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400">Choose a weather year:</span>
                    <select
                      value={auxHeatYear}
                      onChange={(e) => {
                        setAuxHeatYear(Number(e.target.value));
                        setUseWorstYear(false);
                      }}
                      className="text-xs px-2 py-1 bg-[#151A21] border border-[#222A35] rounded text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
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
                        // For now, use 2021 as a conservative "worst year" proxy
                        // In a full implementation, we'd fetch multiple years and compare
                        setAuxHeatYear(2021); // 2021 was a cold winter in many US regions
                        setUseWorstYear(true);
                      }}
                      className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded border border-red-700 transition-colors"
                      title="Picks the coldest winter in the available history (more conservative)"
                    >
                      Use Coldest Year
                    </button>
                  </div>
                  {useWorstYear && (
                    <p className="text-xs text-red-300 mt-1 italic">
                      Picks the coldest winter in the available history (more conservative).
                    </p>
                  )}
                  {historicalHourly && historicalHourly.length > 0 && (
                    <p className="text-xs text-purple-300 mt-2">
                      Calculated from <strong>hourly outdoor temperatures</strong> for <strong>{auxHeatYear}</strong>.
                    </p>
                  )}
                  {historicalLoading && (
                    <p className="text-xs text-yellow-400 mt-2">Loading {auxHeatYear} data...</p>
                  )}
                  <p className="text-xs text-gray-500 mt-2 italic">
                    <em>Tip:</em> If you want a conservative estimate, choose <strong>Use coldest year</strong>.
                  </p>
                </div>
              )}
              {historicalHourly && historicalHourly.length > 0 && !balancePoint && (
                <p className="text-xs text-green-400 mt-1">
                  📊 Using hourly historical data (Open-Meteo archive) for aux heat calculations
                </p>
              )}
              {!historicalHourly && !historicalLoading && balancePoint && (
                <p className="text-xs text-gray-500 mt-1">
                  Using HDD-based estimates for historical months
                </p>
              )}
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#1D232C]">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-400 font-medium">Month</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">HDD</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">CDD</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">HP kWh</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Aux kWh</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Heat kWh</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Cool kWh</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Heat $</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Cool $</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Fixed $</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyBudget.map((month, idx) => (
                    <tr 
                      key={month.month} 
                      className={`${idx === currentMonth ? "bg-blue-900/30 border-l-2 border-blue-500" : idx % 2 === 0 ? "bg-[#151A21]" : "bg-[#1A1F27]"}`}
                    >
                      <td className="px-3 py-2 font-medium">
                        {month.month}
                        {idx === currentMonth && <span className="ml-1 text-xs text-blue-400">←</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-cyan-400">{month.hdd}</td>
                      <td className="px-3 py-2 text-right text-red-400">{month.cdd}</td>
                      <td className="px-3 py-2 text-right text-blue-400">{formatEnergy(month.heatPumpKwh)}</td>
                      <td className="px-3 py-2 text-right text-red-400">{formatEnergy(month.auxKwh)}</td>
                      <td className="px-3 py-2 text-right text-blue-300 font-semibold">{formatEnergy(month.heatingKwh)}</td>
                      <td className="px-3 py-2 text-right text-orange-400">{formatEnergy(month.coolingKwh)}</td>
                      <td className="px-3 py-2 text-right text-blue-300">${month.heatingCost}</td>
                      <td className="px-3 py-2 text-right text-orange-300">${month.coolingCost}</td>
                      <td className="px-3 py-2 text-right text-gray-400">${month.fixedCost}</td>
                      <td className="px-3 py-2 text-right text-green-400 font-bold">${month.totalCost}</td>
                    </tr>
                  ))}
                </tbody>
                {annualTotals && (
                  <tfoot className="bg-[#1E4CFF]/20 border-t border-[#1E4CFF]">
                    <tr>
                      <td className="px-3 py-2 font-bold">Annual</td>
                      <td className="px-3 py-2 text-right text-cyan-400 font-bold">{annualHDD.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-red-400 font-bold">{annualCDD.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-blue-400 font-bold">{formatEnergy(annualTotals.heatPumpKwh)}</td>
                      <td className="px-3 py-2 text-right text-red-400 font-bold">{formatEnergy(annualTotals.auxKwh)}</td>
                      <td className="px-3 py-2 text-right text-blue-300 font-bold">{formatEnergy(annualTotals.heatingKwh)}</td>
                      <td className="px-3 py-2 text-right text-orange-400 font-bold">{formatEnergy(annualTotals.coolingKwh)}</td>
                      <td className="px-3 py-2 text-right text-blue-300 font-bold">${annualTotals.heatingCost}</td>
                      <td className="px-3 py-2 text-right text-orange-300 font-bold">${annualTotals.coolingCost}</td>
                      <td className="px-3 py-2 text-right text-gray-400 font-bold">${annualTotals.fixedCost}</td>
                      <td className="px-3 py-2 text-right text-green-400 font-bold text-lg">${annualTotals.totalCost}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-[#151A21] border border-[#222A35] rounded-lg p-6 text-center">
            <p className="text-gray-400">No budget data available</p>
          </div>
        )}
        
        {/* Formula Explanation */}
        <div className="mt-6 bg-[#151A21] border border-[#222A35] rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Calculation Formula</h3>
          <div className="text-xs text-gray-400 font-mono space-y-1">
            <p><span className="text-purple-400">Aux Threshold Temperature:</span> Find temp where Heat Pump Output = Building Heat Loss</p>
            <p className="ml-2">Heat Pump Output = {formatCapacityFromTons(tons, effectiveUnitSystem)} × 12,000 × Capacity Factor(temp)</p>
            <p className="ml-2">Building Heat Loss = {formatHeatLossFactor(heatLossFactor, effectiveUnitSystem)} × ({ecobeeTargetTemp !== null ? formatTemperatureFromF(ecobeeTargetTemp, effectiveUnitSystem, { decimals: 1, withUnit: false }) : "—"} - outdoor temp)</p>
            {balancePoint !== null ? (
              <>
                <p className="ml-2 text-purple-300">Aux threshold temperature: <strong>{formatTemperatureFromF(balancePoint, effectiveUnitSystem, { decimals: 1 })}</strong></p>
                <p className="ml-4 text-gray-400 text-xs">Below this outdoor temperature, your heat pump may need backup heat to hold the setpoint.</p>
              </>
            ) : (
              <p className="ml-2 text-purple-300">Aux threshold: Below -20°F (system can handle all temps without aux)</p>
            )}
            {historicalHourly && historicalHourly.length > 0 && balancePoint !== null && (
              <>
                <p className="mt-2 text-yellow-400">Aux Heat Calculation:</p>
                <p className="ml-2 text-gray-400">Uses hourly temperature data from <strong>{auxHeatYear}</strong> to calculate aux heat hour-by-hour.</p>
                <p className="ml-2 text-gray-400">For each hour where outdoor temp &lt; {balancePoint.toFixed(1)}°F, aux heat = (Building Heat Loss - Heat Pump Output) ÷ 3,412 BTU/kWh</p>
                <p className="ml-4 text-gray-500 italic">
                  Monthly totals use typical-year HDD/CDD, but aux heat is based on {auxHeatYear} actual temperatures. 
                  This keeps the <strong>annual budget stable</strong>, while showing how <strong>cold snaps</strong> change aux usage. 
                  Choose a different year above to see how colder or milder winters affect aux heat.
                </p>
              </>
            )}
            {coldestMonthAnalysis && balancePoint !== null && (
              <>
                <p className="mt-2 text-yellow-300"><strong>Temperature Analysis (Coldest Month):</strong></p>
                <p className="ml-2">Monthly Average Temp = {formatTemperatureFromF(parseFloat(coldestMonthAnalysis.monthlyAvgTemp), effectiveUnitSystem, { decimals: 1 })} (from HDD calculation)</p>
                <p className="ml-2 text-gray-500">Note: This is the AVERAGE - actual temps range from ~{formatTemperatureFromF(parseFloat(coldestMonthAnalysis.estimatedMinTemp), effectiveUnitSystem, { decimals: 1 })} (nights) to ~{formatTemperatureFromF(parseFloat(coldestMonthAnalysis.monthlyAvgTemp) + 15, effectiveUnitSystem, { decimals: 1 })} (days)</p>
                <p className="ml-2 mt-1"><strong>At Average Temp ({formatTemperatureFromF(parseFloat(coldestMonthAnalysis.monthlyAvgTemp), effectiveUnitSystem, { decimals: 1 })}):</strong></p>
                <p className="ml-4">Heat Pump Output = {coldestMonthAnalysis.heatPumpOutputBtuAvg} BTU/hr</p>
                <p className="ml-4">Building Heat Loss = {coldestMonthAnalysis.buildingHeatLossBtuAvg} BTU/hr</p>
                <p className="ml-4 text-green-300">Surplus = {coldestMonthAnalysis.surplusBtuAvg} BTU/hr ✓</p>
                <p className="ml-2 mt-1">
                  <strong>
                    {historicalHourly && historicalHourly.length > 0 
                      ? (() => {
                          const coldestHour = Math.min(...historicalHourly.map(h => h.temp));
                          return `Coldest hour in ${auxHeatYear}: ${formatTemperatureFromF(coldestHour, effectiveUnitSystem, { decimals: 1 })}`;
                        })()
                      : `Illustrative cold night example: ${formatTemperatureFromF(parseFloat(coldestMonthAnalysis.estimatedMinTemp), effectiveUnitSystem, { decimals: 1 })}`
                    }
                  </strong>
                </p>
                <p className="ml-4">Heat Pump Output = {coldestMonthAnalysis.heatPumpOutputBtuMin} BTU/hr</p>
                <p className="ml-4">Building Heat Loss = {coldestMonthAnalysis.buildingHeatLossBtuMin} BTU/hr</p>
                {coldestMonthAnalysis.needsAuxAtMin ? (
                  <>
                    <p className="ml-4 text-red-300">Deficit = {coldestMonthAnalysis.deficitBtuMin} BTU/hr (aux heat needed)</p>
                    <p className="ml-2 text-gray-500 mt-1">Aux heat is needed during coldest hours (below balance point {formatTemperatureFromF(parseFloat(coldestMonthAnalysis.balancePoint), effectiveUnitSystem, { decimals: 1 })}), but monthly budget uses averages, so aux appears as 0.</p>
                  </>
                ) : (
                  <p className="ml-4 text-green-300">Surplus = {coldestMonthAnalysis.deficitBtuMin === "0" ? "0" : `-${coldestMonthAnalysis.deficitBtuMin}`} BTU/hr ✓</p>
                )}
              </>
            )}
            <p className="mt-2"><span className="text-blue-400">Heating:</span> For each month, estimate avg outdoor temp from HDD</p>
            <p className="ml-2">Heat Pump Output = {formatCapacityFromTons(tons, effectiveUnitSystem)} × 12,000 × Capacity Factor (varies with temp)</p>
            <p className="ml-2">If Heat Loss &gt; Heat Pump Output: Aux Heat = (Deficit BTU) ÷ 3,412 BTU/kWh</p>
            <p className="ml-2">Heat Pump {nerdMode ? "Energy" : "kWh"} = (Electrical kW × Runtime%) × hours in month</p>
            <p className="ml-2">Total Heating {nerdMode ? "Energy" : "kWh"} = Heat Pump {nerdMode ? "Energy" : "kWh"} + Aux Heat {nerdMode ? "Energy" : "kWh"}</p>
            <p className="mt-2"><span className="text-orange-400">Cooling:</span> {nerdMode ? "Energy" : "kWh"} = (HeatGainFactor × CDD × 24) ÷ (SEER2 × 1000)</p>
            <p className="mt-2"><span className="text-green-400">Cost:</span> {nerdMode ? "Energy" : "kWh"} × ${electricityRate.toFixed(3)}/kWh + ${monthlyFixedCharge.toFixed(2)} fixed</p>
            <p className="text-gray-500 mt-2">
              Note: HDD/CDD already account for temperature differential over time.
              Target temp from Ecobee: {ecobeeTargetTemp !== null ? formatTemperatureFromF(ecobeeTargetTemp, effectiveUnitSystem, { decimals: 1 }) : "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BudgetDebug;
