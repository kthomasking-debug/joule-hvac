import React, { useState, useMemo, useEffect } from "react";
import { useOutletContext, Link } from "react-router-dom";
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  X,
  Info,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { useJouleBridgeContext } from "../contexts/JouleBridgeContext";
import { getCached } from "../utils/cachedStorage";
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
import { 
  useUnitSystem, 
  formatTemperatureFromF, 
  formatEnergyFromKwh, 
  formatHeatLossFactor,
  UNIT_SYSTEMS
} from "../lib/units";

// generateTypicalYearHourlyTemps function for monthly budget calculations
const SECOND_HARMONIC_WEIGHT = 0.3;
const computeMaxAbsSkewedCycle = (harmonicWeight) => {
  const SAMPLES = 10000;
  let maxAbs = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const theta = (i / SAMPLES) * 2 * Math.PI;
    const value = Math.cos(theta) + harmonicWeight * Math.cos(2 * theta);
    maxAbs = Math.max(maxAbs, Math.abs(value));
  }
  return maxAbs;
};
const MAX_ABS_SKEWED_CYCLE = computeMaxAbsSkewedCycle(SECOND_HARMONIC_WEIGHT);

class SeededPRNG {
  constructor(seed) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }
  next() {
    this.seed = (this.seed * 1664525 + 1013904223) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
  nextPair() {
    return [this.next(), this.next()];
  }
}

function generateTypicalYearHourlyTemps(monthHDD, monthCDD, daysInMonth, heatingBaseF, coolingBaseF, avgTemp, minTemp, maxTemp, generatorParams = {}) {
  const {
    diurnalAmplitudeFactor = 0.4,
    noiseSigma = 0.0,
    minClamp = null,
    hddMatchStrategy = 'hardClamp',
    seed = null,
  } = generatorParams;
  
  const hoursInMonth = daysInMonth * 24;
  let effectiveMonthCDD = monthCDD;
  if (monthCDD > 0 && maxTemp <= coolingBaseF) {
    effectiveMonthCDD = 0;
  }
  
  const prng = seed !== null ? new SeededPRNG(seed) : null;
  const hourlyTemps = [];
  
  for (let hour = 0; hour < hoursInMonth; hour++) {
    const dayOfMonth = Math.floor(hour / 24);
    const hourOfDay = hour % 24;
    
    const hourAngle = ((hourOfDay - 14 + 24) % 24) * (Math.PI / 12);
    const baseCycle = Math.cos(hourAngle);
    const secondHarmonic = SECOND_HARMONIC_WEIGHT * Math.cos(2 * hourAngle);
    const dailyCycleRaw = baseCycle + secondHarmonic;
    const dailyCycle = dailyCycleRaw / MAX_ABS_SKEWED_CYCLE;
    
    const tempRange = maxTemp - minTemp;
    const dailyAmplitude = tempRange > 0 ? tempRange * diurnalAmplitudeFactor : 0;
    
    const dayVariation = daysInMonth > 0 
      ? Math.sin((dayOfMonth / daysInMonth) * Math.PI * 2) * (tempRange * 0.1)
      : 0;
    
    let noise = 0;
    if (noiseSigma > 0) {
      const [u1raw, u2] = prng ? prng.nextPair() : [Math.random(), Math.random()];
      const u1 = Math.max(u1raw, 1e-12);
      const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      noise = z0 * noiseSigma;
    }
    
    let temp = avgTemp + (dailyCycle * dailyAmplitude) + dayVariation + noise;
    const effectiveMinTemp = minClamp !== null ? Math.max(minClamp, minTemp) : minTemp;
    temp = Math.max(effectiveMinTemp, Math.min(maxTemp, temp));
    
    const humidityCycle = -dailyCycle;
    const humidity = 60 + (humidityCycle * 10);
    
    hourlyTemps.push({ temp, humidity });
  }
  
  // Simple scaling to match HDD/CDD (hardClamp strategy)
  let actualHDD = 0;
  let actualCDD = 0;
  hourlyTemps.forEach(({ temp }) => {
    if (temp < heatingBaseF) {
      actualHDD += (heatingBaseF - temp) / 24;
    }
    if (temp > coolingBaseF) {
      actualCDD += (temp - coolingBaseF) / 24;
    }
  });
  
  if (monthHDD > 0 && actualHDD > 0) {
    const kHDD = monthHDD / actualHDD;
    hourlyTemps.forEach(hour => {
      if (hour.temp < heatingBaseF) {
        const deficit = heatingBaseF - hour.temp;
        hour.temp = heatingBaseF - (deficit * kHDD);
      }
    });
  }
  
  if (effectiveMonthCDD > 0 && actualCDD > 0) {
    const kCDD = effectiveMonthCDD / actualCDD;
    hourlyTemps.forEach(hour => {
      if (hour.temp > coolingBaseF) {
        const surplus = hour.temp - coolingBaseF;
        hour.temp = coolingBaseF + (surplus * kCDD);
      }
    });
  }
  
  hourlyTemps.forEach(hour => {
    const effectiveMinTemp = minClamp !== null ? Math.max(minClamp, minTemp) : minTemp;
    hour.temp = Math.max(effectiveMinTemp, Math.min(maxTemp, hour.temp));
  });
  
  return hourlyTemps;
}

/**
 * MonthlyBudget - Current month budget with daily breakdown
 */
const MonthlyBudget = () => {
  const outletContext = useOutletContext() || {};
  const { userSettings = {} } = outletContext;
  
  const { unitSystem } = useUnitSystem();
  const nerdMode = userSettings?.nerdMode || false;
  const effectiveUnitSystem = nerdMode ? UNIT_SYSTEMS.INTL : unitSystem;
  
  const userLocation = useMemo(() => getCached("userLocation", null), []);
  const jouleBridge = useJouleBridgeContext();
  const isConnected = jouleBridge.bridgeAvailable && jouleBridge.connected;
  const hvacMode = jouleBridge.hvacMode;
  const ecobeeTargetTemp = jouleBridge.targetTemperature;
  const currentIndoorTemp = jouleBridge.temperature;
  
  const now = new Date();
  const currentMonthIndex = now.getMonth();
  const currentYear = now.getFullYear();
  const daysInCurrentMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
  const currentDayOfMonth = now.getDate();
  
  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  
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
        const stateRate = getStateElectricityRate(userLocation.state);
        if (stateRate) {
          setElectricityRate(stateRate);
          setRateSource(`${userLocation.state} Average`);
        }
      } catch (error) {
        console.error('[MonthlyBudget] Error fetching rate:', error);
      }
    };
    fetchRate();
  }, [userLocation]);
  
  const fixedCharges = useMemo(() => {
    if (!userLocation?.state) return defaultFallbackFixedCharges;
    const stateAbbr = normalizeStateToAbbreviation(userLocation.state);
    return stateAbbr && defaultFixedChargesByState[stateAbbr]
      ? defaultFixedChargesByState[stateAbbr]
      : defaultFallbackFixedCharges;
  }, [userLocation]);
  
  const monthlyFixedCharge = userSettings.fixedElectricCost ?? fixedCharges.electric;
  const dailyFixedCharge = monthlyFixedCharge / daysInCurrentMonth;
  
  // System parameters
  const heatLossFactor = useMemo(() => {
    const useManualHeatLoss = Boolean(userSettings?.useManualHeatLoss);
    const useCalculatedHeatLoss = userSettings?.useCalculatedHeatLoss !== false;
    const useAnalyzerHeatLoss = Boolean(userSettings?.useAnalyzerHeatLoss);
    
    if (useManualHeatLoss && userSettings?.manualHeatLoss) {
      return Number(userSettings.manualHeatLoss);
    }
    if (useAnalyzerHeatLoss && userSettings?.analyzerHeatLoss) {
      return Number(userSettings.analyzerHeatLoss);
    }
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
    return 314;
  }, [userSettings]);
  
  const hspf2 = userSettings?.hspf2 || 9.0;
  const seer2 = userSettings?.efficiency || 15.0;
  const capacity = Number(userSettings?.capacity ?? userSettings?.coolingCapacity ?? 36);
  const tons = capacity / 12.0;
  const useElectricAuxHeat = Boolean(userSettings?.useElectricAuxHeat !== false);
  const compressorPower = useMemo(() => {
    return (tons * 1.0 * (15 / Math.max(1, seer2)));
  }, [tons, seer2]);
  const designHeatLossBtuHrAt70F = useMemo(() => {
    return heatLossFactor * 70;
  }, [heatLossFactor]);
  
  const balancePoint = useMemo(() => {
    if (!ecobeeTargetTemp) return null;
    const cutoffTemp = userSettings?.cutoffTemp ?? -15;
    for (let temp = 60; temp >= -20; temp -= 1) {
      const capacityFactor = heatUtils.getCapacityFactor(temp, cutoffTemp);
      const heatPumpOutputBtu = tons * 12000 * capacityFactor;
      const deltaT = Math.max(0, ecobeeTargetTemp - temp);
      const buildingHeatLossBtu = heatLossFactor * deltaT;
      if (heatPumpOutputBtu <= buildingHeatLossBtu) {
        return temp;
      }
    }
    return null;
  }, [ecobeeTargetTemp, tons, heatLossFactor, userSettings?.cutoffTemp]);
  
  // Cooling target
  const coolingBaseF = useMemo(() => {
    if (jouleBridge.targetCoolTemp !== null) {
      return jouleBridge.targetCoolTemp;
    }
    return userSettings.coolingSetpoint || 74;
  }, [jouleBridge.targetCoolTemp, userSettings.coolingSetpoint]);
  const heatingBaseF = ecobeeTargetTemp || 68;
  
  // Get 14-day extended forecast
  const { forecast: extendedForecast, loading: forecastLoading, error: forecastError } = useExtendedForecast(
    userLocation?.latitude,
    userLocation?.longitude,
    { enabled: !!userLocation?.latitude && !!userLocation?.longitude }
  );
  
  // Fetch historical data for current month (from start of month to today)
  const [historicalData, setHistoricalData] = useState(null);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [historicalError, setHistoricalError] = useState(null);
  
  useEffect(() => {
    const fetchHistorical = async () => {
      if (!userLocation?.latitude || !userLocation?.longitude) return;
      
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // If today is the 1st, no historical data needed
      if (today <= firstOfMonth) {
        setHistoricalData([]);
        return;
      }
      
      setHistoricalLoading(true);
      setHistoricalError(null);
      
      try {
        const startDate = firstOfMonth.toISOString().split('T')[0];
        const endDate = today.toISOString().split('T')[0];
        
        const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${userLocation.latitude}&longitude=${userLocation.longitude}&start_date=${startDate}&end_date=${endDate}&hourly=temperature_2m,relativehumidity_2m&temperature_unit=fahrenheit&timezone=auto&timeformat=unixtime`;
        
        const resp = await fetch(url);
        if (!resp.ok) {
          throw new Error(`Historical data not available: ${resp.status}`);
        }
        
        const json = await resp.json();
        const temps = json.hourly?.temperature_2m || [];
        const humidity = json.hourly?.relativehumidity_2m || [];
        const times = json.hourly?.time || [];
        
        const processed = times.map((t, i) => ({
          time: new Date(t * 1000),
          temp: temps[i],
          humidity: humidity[i] ?? 70,
        }));
        
        setHistoricalData(processed);
      } catch (err) {
        setHistoricalError(err.message || "Unknown error fetching historical data");
      } finally {
        setHistoricalLoading(false);
      }
    };
    
    fetchHistorical();
  }, [userLocation?.latitude, userLocation?.longitude, currentMonthIndex, currentYear]);
  
  // Merge historical and forecast data, plus extend with typical year data
  const allHourlyData = useMemo(() => {
    const combined = [];
    const now = new Date();
    const endOfMonth = new Date(currentYear, currentMonthIndex + 1, 0, 23, 59, 59);
    
    // Add historical data (only past days)
    if (historicalData) {
      historicalData.forEach(hour => {
        const hourTime = new Date(hour.time);
        // Only include hours before now
        if (hourTime < now) {
          combined.push(hour);
        }
      });
    }
    
    // Add forecast data (future hours)
    if (extendedForecast) {
      extendedForecast.forEach(hour => {
        const hourTime = new Date(hour.time);
        // Only include hours from now onwards and within current month
        if (hourTime >= now && hourTime <= endOfMonth) {
          combined.push(hour);
        }
      });
    }
    
    // Sort by time
    combined.sort((a, b) => new Date(a.time) - new Date(b.time));
    
    // Find the last day with actual data
    let lastDataDate = null;
    if (combined.length > 0) {
      lastDataDate = new Date(combined[combined.length - 1].time);
    }
    
    // If forecast doesn't cover full month, extend with typical year estimates
    if (lastDataDate && lastDataDate < endOfMonth) {
      const lastDayOfData = lastDataDate.getDate();
      const remainingDays = daysInCurrentMonth - lastDayOfData;
      
      if (remainingDays > 0) {
        // Get typical temps from recent data to estimate
        const recentTemps = combined.slice(-48).map(h => h.temp).filter(t => t != null);
        const avgRecentTemp = recentTemps.length > 0 
          ? recentTemps.reduce((a, b) => a + b, 0) / recentTemps.length 
          : 40; // Default fallback
        const minRecentTemp = recentTemps.length > 0 ? Math.min(...recentTemps) : avgRecentTemp - 15;
        const maxRecentTemp = recentTemps.length > 0 ? Math.max(...recentTemps) : avgRecentTemp + 15;
        
        // Generate typical year hours for remaining days
        for (let dayOffset = 1; dayOffset <= remainingDays; dayOffset++) {
          const dayDate = new Date(currentYear, currentMonthIndex, lastDayOfData + dayOffset);
          
          // Generate 24 hours for this day using sinusoidal pattern
          for (let hour = 0; hour < 24; hour++) {
            const hourTime = new Date(dayDate);
            hourTime.setHours(hour, 0, 0, 0);
            
            // Simple sinusoidal temp variation: coldest at 6am, warmest at 3pm
            const hourAngle = ((hour - 6 + 24) % 24) * (Math.PI / 12);
            const tempRange = maxRecentTemp - minRecentTemp;
            const hourTemp = avgRecentTemp + (tempRange / 2) * Math.sin(hourAngle - Math.PI / 2);
            
            // Add some daily variation (warmer towards end of Feb)
            const dayVariation = (dayOffset / remainingDays) * 3; // Slight warming trend
            
            combined.push({
              time: hourTime,
              temp: hourTemp + dayVariation,
              humidity: 70, // Default humidity
              isEstimate: true, // Flag as estimated data
            });
          }
        }
      }
    }
    
    return combined;
  }, [historicalData, extendedForecast, currentYear, currentMonthIndex, daysInCurrentMonth]);
  
  // Calculate daily breakdown from merged data
  const dailyBreakdown = useMemo(() => {
    if (!ecobeeTargetTemp || !allHourlyData || allHourlyData.length === 0) return null;
    
    // Group hours by day
    const daysMap = new Map();
    
    allHourlyData.forEach((hour) => {
      const date = new Date(hour.time);
      const dateKey = date.toDateString(); // Use date string as key
      
      if (!daysMap.has(dateKey)) {
        daysMap.set(dateKey, {
          date: date,
          dateKey: dateKey,
          hours: [],
        });
      }
      
      daysMap.get(dateKey).hours.push(hour);
    });
    
    // Convert to array and sort by date
    const days = Array.from(daysMap.values()).sort((a, b) => a.date - b.date);
      
    // Calculate daily totals for each day
    const dailyBreakdown = days.map(({ date, dateKey, hours }) => {
      let dayHeatPumpKwh = 0;
      let dayAuxKwh = 0;
      let dayCoolingKwh = 0;
      let dayMinTemp = Infinity;
      let dayMaxTemp = -Infinity;
      let daySumTemp = 0;
      let hasEstimatedHours = false;
      
      hours.forEach((hour) => {
        const temp = hour.temp;
        const humidity = hour.humidity ?? 70; // Default humidity if not provided
        const dtHours = hour.dtHours ?? 1.0; // Use dtHours if available, default to 1.0
        
        if (hour.isEstimate) hasEstimatedHours = true;
        
        if (temp == null) return; // Skip null temps
        
        dayMinTemp = Math.min(dayMinTemp, temp);
        dayMaxTemp = Math.max(dayMaxTemp, temp);
        daySumTemp += temp;
        
        if (temp < heatingBaseF) {
          const perf = heatUtils.computeHourlyPerformance(
            {
              tons,
              indoorTemp: heatingBaseF,
              designHeatLossBtuHrAt70F,
              compressorPower,
              hspf2,
              cutoffTemp: userSettings?.cutoffTemp ?? -15,
            },
            temp,
            humidity,
            dtHours
          );
          
          if (perf.hpKwh !== undefined) {
            dayHeatPumpKwh += perf.hpKwh;
          }
          if (temp < balancePoint && useElectricAuxHeat && perf.auxKwh !== undefined && perf.auxKwh > 0) {
            dayAuxKwh += perf.auxKwh;
          }
        }
        
        if (temp > coolingBaseF) {
          const perf = heatUtils.computeHourlyCoolingPerformance(
            {
              tons,
              indoorTemp: coolingBaseF,
              designHeatLossBtuHrAt70F,
              seer2,
              solarExposure: userSettings.solarExposure || 1.5,
            },
            temp,
            humidity
          );
          // computeHourlyCoolingPerformance returns electricalKw in kW (power)
          // Multiply by dtHours to get kWh (energy)
          dayCoolingKwh += (perf.electricalKw || 0) * dtHours;
        }
      });
      
      const dayHeatingKwh = dayHeatPumpKwh + dayAuxKwh;
      const dayTotalKwh = dayHeatingKwh + dayCoolingKwh;
      const dayAvgTemp = hours.length > 0 ? daySumTemp / hours.length : 0;
      const dayHeatingCost = dayHeatingKwh * electricityRate;
      const dayCoolingCost = dayCoolingKwh * electricityRate;
      const dayEnergyCost = dayHeatingCost + dayCoolingCost;
      // Calculate daily fixed charge proportionally
      const dayFixedCharge = monthlyFixedCharge / daysInCurrentMonth;
      const dayTotalCost = dayEnergyCost + dayFixedCharge;
      
      return {
        date: date,
        dateKey: dateKey,
        dayOfMonth: date.getDate(),
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        avgTemp: dayAvgTemp,
        minTemp: dayMinTemp === Infinity ? 0 : dayMinTemp,
        maxTemp: dayMaxTemp === -Infinity ? 0 : dayMaxTemp,
        heatPumpKwh: dayHeatPumpKwh,
        auxKwh: dayAuxKwh,
        heatingKwh: dayHeatingKwh,
        coolingKwh: dayCoolingKwh,
        totalKwh: dayTotalKwh,
        heatingCost: dayHeatingCost,
        coolingCost: dayCoolingCost,
        energyCost: dayEnergyCost,
        fixedCost: dayFixedCharge,
        totalCost: dayTotalCost,
        isEstimate: hasEstimatedHours,
      };
    });
    
    return dailyBreakdown;
  }, [ecobeeTargetTemp, allHourlyData, heatingBaseF, coolingBaseF, 
      heatLossFactor, hspf2, seer2, tons, designHeatLossBtuHrAt70F, compressorPower, useElectricAuxHeat, 
      balancePoint, electricityRate, monthlyFixedCharge, daysInCurrentMonth, userSettings]);
  
  const monthlyTotals = useMemo(() => {
    if (!dailyBreakdown) return null;
    return dailyBreakdown.reduce((acc, day) => ({
      heatingKwh: acc.heatingKwh + day.heatingKwh,
      coolingKwh: acc.coolingKwh + day.coolingKwh,
      totalKwh: acc.totalKwh + day.totalKwh,
      heatingCost: acc.heatingCost + day.heatingCost,
      coolingCost: acc.coolingCost + day.coolingCost,
      totalCost: acc.totalCost + day.totalCost,
    }), { heatingKwh: 0, coolingKwh: 0, totalKwh: 0, heatingCost: 0, coolingCost: 0, totalCost: 0 });
  }, [dailyBreakdown]);

  // Push forecast data to bridge for e-ink display
  useEffect(() => {
    if (!monthlyTotals || !dailyBreakdown || dailyBreakdown.length === 0) return;
    
    // Get bridge URL from various sources
    const bridgeUrl = localStorage.getItem('jouleBridgeUrl') || 
                      (localStorage.getItem('bridgeIp') ? `http://${localStorage.getItem('bridgeIp')}:8080` : null);
    if (!bridgeUrl) {
      console.log('No bridge URL configured - skipping forecast push');
      return;
    }
    
    // Calculate weekly equivalent for bridge display
    const daysWithData = dailyBreakdown.length;
    const avgDailyCost = monthlyTotals.totalCost / daysWithData;
    const weeklyCost = avgDailyCost * 7;
    
    const forecastSummary = {
      location: userLocation?.city ? `${userLocation.city}, ${userLocation.state}` : 'Unknown',
      totalHPCost: weeklyCost,
      totalHPCostWithAux: weeklyCost,
      totalWeeklyCost: weeklyCost,
      weeklyCost: weeklyCost,
      monthlyCost: monthlyTotals.totalCost,
      totalKwh: monthlyTotals.totalKwh,
      heatingKwh: monthlyTotals.heatingKwh,
      coolingKwh: monthlyTotals.coolingKwh,
      daysInMonth: daysInCurrentMonth,
      daysCalculated: daysWithData,
      timestamp: Date.now(),
      source: 'monthly-budget',
      // Include daily breakdown for detailed display
      dailySummary: dailyBreakdown.map(day => ({
        date: day.date.toISOString(),
        cost: day.totalCost,
        kwh: day.totalKwh,
        avgTemp: day.avgTemp,
        isEstimate: day.isEstimate,
      })),
    };
    
    // Save to localStorage for other components
    localStorage.setItem('last_forecast_summary', JSON.stringify(forecastSummary));
    
    // Push to bridge
    fetch(`${bridgeUrl}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        settings: { last_forecast_summary: forecastSummary }
      }),
    }).then(response => {
      if (response.ok) {
        console.log('✓ Monthly budget forecast pushed to bridge');
      }
    }).catch(err => {
      console.log('Bridge forecast push failed (non-critical):', err.message);
    });
  }, [monthlyTotals, dailyBreakdown, userLocation, daysInCurrentMonth]);
  
  const [dismissedInfoBanner, setDismissedInfoBanner] = useState(() => {
    return localStorage.getItem('monthlyBudget_dismissedBanner') === 'true';
  });
  
  const handleDismissBanner = () => {
    setDismissedInfoBanner(true);
    localStorage.setItem('monthlyBudget_dismissedBanner', 'true');
  };
  
  const formatEnergy = (kwh) => {
    if (kwh == null || isNaN(kwh)) return "—";
    return formatEnergyFromKwh(kwh, effectiveUnitSystem, { decimals: 1 });
  };
  
  return (
    <div className="min-h-screen bg-[#0C0F14] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <header className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                <Calendar className="w-7 h-7 text-blue-400" />
                Monthly Forecast
              </h1>
              <p className="text-base text-gray-300 mt-2 max-w-3xl">
                See your daily heating and cooling costs for {MONTH_NAMES[currentMonthIndex]}. Uses historical data, 14-day NWS forecast, and estimates for the rest of the month.
              </p>
            </div>
            <Link
              to="/onboarding?rerun=true"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors"
            >
              Run Onboarding
            </Link>
          </div>
        </header>
        
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
                <div className="font-medium text-blue-200 mb-1">About This Estimate</div>
                <div className="text-sm text-blue-300">
                  Historical data comes from Open-Meteo archive API. Future days use the National Weather Service (NWS) 14-day forecast. 
                  Daily costs are calculated from actual temperatures for each hour.
                </div>
              </div>
            </div>
          </div>
        )}
        
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
        
        {!ecobeeTargetTemp ? (
          <Link
            to="/onboarding?rerun=true"
            className="block bg-yellow-900/20 border border-yellow-700 rounded-lg p-6 text-center hover:border-yellow-500 hover:bg-yellow-900/30 transition-colors"
          >
            <AlertTriangle className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-yellow-200 mb-2">Connect to Joule Bridge</h3>
            <p className="text-yellow-300">Connect to Joule Bridge to see your 14-day forecast budget.</p>
          </Link>
        ) : forecastLoading ? (
          <div className="bg-[#151A21] border border-[#222A35] rounded-lg p-6 text-center">
            <RefreshCw className="w-10 h-10 text-blue-400 animate-spin mx-auto mb-3" />
            <p className="text-gray-400 text-lg">Loading weather forecast...</p>
          </div>
        ) : forecastError ? (
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-red-200 mb-2">Error Loading Weather Data</h3>
            <p className="text-red-300">{forecastError || historicalError}</p>
          </div>
        ) : !dailyBreakdown || dailyBreakdown.length === 0 ? (
          <div className="bg-[#151A21] border border-[#222A35] rounded-lg p-6 text-center">
            <p className="text-gray-400">No forecast data available</p>
          </div>
        ) : (
          <>
            {/* Monthly Summary Cards */}
            {monthlyTotals && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-gradient-to-br from-green-600/30 to-green-800/30 border-2 border-green-600/60 rounded-xl p-6 shadow-lg">
                  <div className="text-sm text-green-200 mb-2 font-medium">MONTH TO DATE + FORECAST</div>
                  <div className="text-4xl font-bold text-white mb-2">${monthlyTotals.totalCost.toFixed(2)}</div>
                  <div className="text-sm text-green-300">{formatEnergy(monthlyTotals.totalKwh)}</div>
                </div>
                <div className="bg-gradient-to-br from-orange-600/30 to-orange-800/30 border-2 border-orange-600/60 rounded-xl p-6 shadow-lg">
                  <div className="text-sm text-orange-200 mb-2 font-medium">HEATING</div>
                  <div className="text-3xl font-bold text-white mb-2">${monthlyTotals.heatingCost.toFixed(2)}</div>
                  <div className="text-xs text-orange-300">{formatEnergy(monthlyTotals.heatingKwh)}</div>
                </div>
                <div className="bg-gradient-to-br from-blue-600/30 to-blue-800/30 border-2 border-blue-600/60 rounded-xl p-6 shadow-lg">
                  <div className="text-sm text-blue-200 mb-2 font-medium">COOLING</div>
                  <div className="text-3xl font-bold text-white mb-2">${monthlyTotals.coolingCost.toFixed(2)}</div>
                  <div className="text-xs text-blue-300">{formatEnergy(monthlyTotals.coolingKwh)}</div>
                </div>
              </div>
            )}
            
            {/* Daily Breakdown Table */}
            <div className="bg-[#151A21] border border-[#222A35] rounded-lg overflow-hidden">
              <div className="p-4 border-b border-[#222A35]">
                <h2 className="text-xl font-semibold text-white">Daily Breakdown</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Location: {userLocation ? `${userLocation.city}, ${userLocation.state}` : "Not set"} • 
                  {" "}Electricity Rate: ${electricityRate.toFixed(3)}/kWh • 
                  {" "}Target: {formatTemperatureFromF(heatingBaseF, effectiveUnitSystem, { decimals: 0 })}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#1D232C]">
                    <tr>
                      <th className="px-4 py-3 text-left text-gray-300 font-medium">Date</th>
                      <th className="px-4 py-3 text-right text-gray-300 font-medium">Avg Temp</th>
                      <th className="px-4 py-3 text-right text-gray-300 font-medium">Min/Max</th>
                      <th className="px-4 py-3 text-right text-gray-300 font-medium">Heating kWh</th>
                      <th className="px-4 py-3 text-right text-gray-300 font-medium">Cooling kWh</th>
                      <th className="px-4 py-3 text-right text-gray-300 font-medium">Total kWh</th>
                      <th className="px-4 py-3 text-right text-gray-300 font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyBreakdown.map((day, idx) => {
                      const isToday = day.date.toDateString() === new Date().toDateString();
                      return (
                      <tr 
                        key={day.dateKey} 
                        className={`${
                          idx % 2 === 0 ? "bg-[#151A21]" : "bg-[#1A1F27]"
                        } ${
                          isToday ? "ring-2 ring-blue-500" : ""
                        } ${
                          day.isEstimate ? "opacity-70" : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-medium">
                          {day.dayName}, {day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {isToday && (
                            <span className="ml-1 text-xs text-blue-400">←</span>
                          )}
                          {day.isEstimate && (
                            <span className="ml-1 text-xs text-yellow-500" title="Estimated based on recent weather patterns">~</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-cyan-400">
                          {formatTemperatureFromF(day.avgTemp, effectiveUnitSystem, { decimals: 1 })}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400">
                          {formatTemperatureFromF(day.minTemp, effectiveUnitSystem, { decimals: 0, withUnit: false })} / {formatTemperatureFromF(day.maxTemp, effectiveUnitSystem, { decimals: 0, withUnit: false })}
                        </td>
                        <td className="px-4 py-3 text-right text-orange-400">{formatEnergy(day.heatingKwh)}</td>
                        <td className="px-4 py-3 text-right text-blue-400">{formatEnergy(day.coolingKwh)}</td>
                        <td className="px-4 py-3 text-right text-yellow-400 font-semibold">{formatEnergy(day.totalKwh)}</td>
                        <td className="px-4 py-3 text-right text-green-400 font-bold">${day.totalCost.toFixed(2)}</td>
                      </tr>
                    );
                    })}
                  </tbody>
                  {monthlyTotals && (
                    <tfoot className="bg-[#1E4CFF]/20 border-t border-[#1E4CFF]">
                      <tr>
                        <td className="px-4 py-3 font-bold" colSpan={3}>Total</td>
                        <td className="px-4 py-3 text-right text-orange-400 font-bold">{formatEnergy(monthlyTotals.heatingKwh)}</td>
                        <td className="px-4 py-3 text-right text-blue-400 font-bold">{formatEnergy(monthlyTotals.coolingKwh)}</td>
                        <td className="px-4 py-3 text-right text-yellow-400 font-bold">{formatEnergy(monthlyTotals.totalKwh)}</td>
                        <td className="px-4 py-3 text-right text-green-400 font-bold text-lg">${monthlyTotals.totalCost.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MonthlyBudget;
