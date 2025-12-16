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
  ChevronDown,
  ChevronUp,
  X,
  Info,
  Settings,
  BarChart3,
  Code,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
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
 * BudgetDebug - Simplified monthly/annual budget using Ecobee setpoints
 * 
 * This page calculates costs using:
 * - Heating: Ecobee target temperature (heating mode) from HomeKit (Joule Bridge)
 * - Cooling: Ecobee cooling target temperature (if available) or user settings
 * 
 * No scheduling complexity - uses actual setpoints directly.
 */

// Monthly HDD/CDD distribution (typical US pattern)
const MONTHLY_HDD_DIST = [1200, 1000, 600, 200, 50, 10, 0, 0, 20, 200, 500, 1100]; // Jan-Dec
const MONTHLY_CDD_DIST = [0, 0, 10, 50, 150, 300, 400, 380, 200, 50, 10, 0]; // Jan-Dec

/**
 * Generate typical-year hourly temperatures for a month
 * These temps match the monthly HDD/CDD distribution and can be used for consistent HP + Aux calculations
 * 
 * @param {number} monthHDD - Monthly HDD for this month
 * @param {number} monthCDD - Monthly CDD for this month
 * @param {number} daysInMonth - Number of days in the month
 * @param {number} heatingBaseF - Base temperature for HDD (heating setpoint)
 * @param {number} coolingBaseF - Base temperature for CDD (cooling setpoint)
 * @param {number} avgTemp - Average outdoor temperature for the month
 * @param {number} minTemp - Minimum outdoor temperature for the month
 * @param {number} maxTemp - Maximum outdoor temperature for the month
 * @returns {Array<{temp: number, humidity: number}>} Array of hourly temperature/humidity pairs
 */
// Compute max absolute value of skewed cycle function: f(θ) = cos(θ) + weight * cos(2θ)
// Cached at module level to avoid recomputing on every call
// Function: f(θ) = cos(θ) + SECOND_HARMONIC_WEIGHT * cos(2θ)
// We need max|f(θ)| over θ ∈ [0, 2π]
const SECOND_HARMONIC_WEIGHT = 0.3;
const computeMaxAbsSkewedCycle = (harmonicWeight) => {
  const SAMPLES = 10000; // Dense sampling for accuracy
  let maxAbs = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const theta = (i / SAMPLES) * 2 * Math.PI;
    const value = Math.cos(theta) + harmonicWeight * Math.cos(2 * theta);
    maxAbs = Math.max(maxAbs, Math.abs(value));
  }
  return maxAbs;
};
// Cache the computed value (computed once at module load, reused for all calls)
const MAX_ABS_SKEWED_CYCLE = computeMaxAbsSkewedCycle(SECOND_HARMONIC_WEIGHT);

// Seeded PRNG for deterministic randomness (same seed = same sequence)
// Simple LCG (Linear Congruential Generator) for portability
class SeededPRNG {
  constructor(seed) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }
  
  next() {
    // LCG: (a * seed + c) mod m
    // Using constants from Numerical Recipes
    this.seed = (this.seed * 1664525 + 1013904223) % 2147483647;
    return (this.seed - 1) / 2147483646; // Normalize to [0, 1)
  }
  
  // Generate two uniform random numbers for Box-Muller
  nextPair() {
    return [this.next(), this.next()];
  }
}

function generateTypicalYearHourlyTemps(monthHDD, monthCDD, daysInMonth, heatingBaseF, coolingBaseF, avgTemp, minTemp, maxTemp, generatorParams = {}) {
  const {
    diurnalAmplitudeFactor = 0.4, // 40% of temp range for daily variation
    noiseSigma = 0.0, // Gaussian noise standard deviation (°F)
    minClamp = null, // Optional minimum temperature clamp (°F), null = use minTemp
    hddMatchStrategy = 'hardClamp', // 'hardClamp' or 'constrainedMatch'
    seed = null, // Optional seed for deterministic randomness (null = use Math.random)
  } = generatorParams;
  
  const hoursInMonth = daysInMonth * 24;
  
  // If CDD is physically impossible under bounds, zero it out internally and proceed with HDD-only matching
  // This preserves HDD matching while gracefully handling impossible CDD (common in shoulder months)
  let effectiveMonthCDD = monthCDD;
  if (monthCDD > 0 && maxTemp <= coolingBaseF) {
    // Impossible to realize any CDD if max never exceeds cooling base
    // Zero out CDD requirement internally so generator can proceed with HDD-only matching
    effectiveMonthCDD = 0;
  }
  
  // Create seeded PRNG if seed provided, otherwise use Math.random (non-deterministic)
  const prng = seed !== null ? new SeededPRNG(seed) : null;
  
  const hourlyTemps = [];
  
  // Create a daily temperature cycle with peak in afternoon, minimum near sunrise
  // Use skewed sinusoid (cos + 2nd harmonic) to allow min at ~6 AM while max at ~2 PM
  // Normalization constant ensures dailyCycle has effective range [-1, 1] so dailyAmplitude means what we think
  
  for (let hour = 0; hour < hoursInMonth; hour++) {
    const dayOfMonth = Math.floor(hour / 24);
    const hourOfDay = hour % 24;
    
    // Daily temperature cycle: skewed sinusoid with peak at 2 PM, minimum at 6 AM
    // Base cycle: cos with peak at 2 PM (hour 14)
    const hourAngle = ((hourOfDay - 14 + 24) % 24) * (Math.PI / 12);
    const baseCycle = Math.cos(hourAngle); // +1 at 2 PM, -1 at 2 AM
    // Add 2nd harmonic to shift minimum toward sunrise (6 AM)
    const secondHarmonic = SECOND_HARMONIC_WEIGHT * Math.cos(2 * hourAngle);
    // Normalize to preserve amplitude range [-1, 1]
    const dailyCycleRaw = baseCycle + secondHarmonic;
    const dailyCycle = dailyCycleRaw / MAX_ABS_SKEWED_CYCLE; // Normalized: effective range [-1, 1]
    
    // Temperature range: min to max
    const tempRange = maxTemp - minTemp;
    const dailyAmplitude = tempRange > 0 ? tempRange * diurnalAmplitudeFactor : 0;
    
    // Base temperature varies slightly by day (add some monthly variation)
    // Safety check: prevent division by zero if daysInMonth is invalid
    const dayVariation = daysInMonth > 0 
      ? Math.sin((dayOfMonth / daysInMonth) * Math.PI * 2) * (tempRange * 0.1)
      : 0;
    
    // Add Gaussian noise if specified
    // Box-Muller transform for proper Gaussian: std dev = noiseSigma
    let noise = 0;
    if (noiseSigma > 0) {
      // Use Box-Muller for true Gaussian distribution
      // Use seeded PRNG if available (deterministic), otherwise Math.random (non-deterministic)
      const [u1raw, u2] = prng ? prng.nextPair() : [Math.random(), Math.random()];
      const u1 = Math.max(u1raw, 1e-12); // Prevent log(0) explosion
      const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      noise = z0 * noiseSigma; // Standard deviation = noiseSigma
    }
    
    // Calculate hourly temperature
    let temp = avgTemp + (dailyCycle * dailyAmplitude) + dayVariation + noise;
    
    // Clamp to min/max bounds (use minClamp if specified, otherwise minTemp)
    const effectiveMinTemp = minClamp !== null ? Math.max(minClamp, minTemp) : minTemp;
    temp = Math.max(effectiveMinTemp, Math.min(maxTemp, temp));
    
    // Typical humidity: higher at night (6 AM), lower during day (2 PM)
    // Range: 50-70% typical, with daily variation
    const humidityCycle = -dailyCycle; // Inverted: high at night, low during day
    const humidity = 60 + (humidityCycle * 10); // 50-70% range
    
    hourlyTemps.push({ temp, humidity });
  }
  
  // Adjust temperatures to match HDD/CDD
  // Two strategies:
  // 1. 'hardClamp': Scale first, then clamp (accepts small HDD error)
  // 2. 'constrainedMatch': Iterative solver that enforces clamp while matching HDD/CDD
  
  const effectiveMinTemp = minClamp !== null ? Math.max(minClamp, minTemp) : minTemp;
  
  if (hddMatchStrategy === 'constrainedMatch') {
    // Constrained match: iterative solver that enforces clamp while matching HDD/CDD
    // Uses effectiveMinTemp (minClamp if set, otherwise minTemp) as the effective clamp
    // Algorithm: Scale only the deficit portion, re-clamp, redistribute mismatch until convergence
    const MAX_ITERATIONS = 50;
    const TOLERANCE = 0.01; // 1% HDD error tolerance
    
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      // Calculate actual HDD/CDD
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
      
      // Check convergence
      const hddError = monthHDD > 0 ? Math.abs(actualHDD - monthHDD) / monthHDD : 0;
      // Use effectiveMonthCDD for consistency (accounts for zeroed-out micro-CDD)
      const cddError = effectiveMonthCDD > 0 ? Math.abs(actualCDD - effectiveMonthCDD) / effectiveMonthCDD : 0;
      
      if (hddError < TOLERANCE && cddError < TOLERANCE) {
        break; // Converged
      }
      
      // Scale heating hours (only those that can be scaled without violating clamp)
      if (monthHDD > 0 && actualHDD > 0) {
        const kHDD = monthHDD / actualHDD;
        const heatingHours = hourlyTemps.filter(h => h.temp < heatingBaseF);
        const clampedHours = [];
        
        // Scale heating hours and track desired temps (before clamping)
        heatingHours.forEach(hour => {
          const deficit = heatingBaseF - hour.temp;
          const desiredTemp = heatingBaseF - (deficit * kHDD);
          hour._desiredTemp = desiredTemp; // Store desired temp after scaling
          
          if (desiredTemp >= effectiveMinTemp) {
            hour.temp = desiredTemp;
          } else {
            // This hour would violate clamp - mark for redistribution
            hour.temp = effectiveMinTemp;
            clampedHours.push(hour);
          }
        });
        
        // Redistribute the mismatch from clamped hours to other heating hours
        if (clampedHours.length > 0 && heatingHours.length > clampedHours.length) {
          // Calculate total deficit that was "lost" due to clamping
          // Use desiredTemp (what we wanted after scaling) not originalTemp
          let lostDeficit = 0;
          clampedHours.forEach(hour => {
            // Lost deficit = difference between desired temp and clamped temp
            lostDeficit += (effectiveMinTemp - hour._desiredTemp) / 24; // positive value
          });
          
          // Redistribute to non-clamped heating hours
          const redistributableHours = heatingHours.filter(h => !clampedHours.includes(h));
          if (redistributableHours.length > 0 && lostDeficit > 0) {
            const deficitPerHour = lostDeficit / redistributableHours.length;
            redistributableHours.forEach(hour => {
              const currentDeficit = heatingBaseF - hour.temp;
              const newDeficit = currentDeficit + (deficitPerHour * 24);
              hour.temp = Math.max(effectiveMinTemp, heatingBaseF - newDeficit);
            });
          }
        }
        
        // Clean up temporary property
        heatingHours.forEach(hour => {
          delete hour._desiredTemp;
        });
      }
      
      // Scale cooling hours with redistribution (similar to heating)
      if (effectiveMonthCDD > 0 && actualCDD > 0) {
        const kCDD = effectiveMonthCDD / actualCDD;
        const coolingHours = hourlyTemps.filter(h => h.temp > coolingBaseF);
        const clampedHours = [];
        
        // Scale cooling hours and track desired temps (before clamping)
        coolingHours.forEach(hour => {
          const surplus = hour.temp - coolingBaseF;
          const desiredTemp = coolingBaseF + (surplus * kCDD);
          hour._desiredTemp = desiredTemp; // Store desired temp after scaling
          
          if (desiredTemp <= maxTemp) {
            hour.temp = desiredTemp;
          } else {
            // This hour would violate clamp - mark for redistribution
            hour.temp = maxTemp;
            clampedHours.push(hour);
          }
        });
        
        // Redistribute the mismatch from clamped hours to other cooling hours
        if (clampedHours.length > 0 && coolingHours.length > clampedHours.length) {
          // Calculate total surplus that was "lost" due to clamping
          // Use desiredTemp (what we wanted after scaling) not originalTemp
          let lostSurplus = 0;
          clampedHours.forEach(hour => {
            // Lost surplus = difference between desired temp and clamped temp
            lostSurplus += (hour._desiredTemp - maxTemp) / 24; // positive value
          });
          
          // Redistribute to non-clamped cooling hours
          const redistributableHours = coolingHours.filter(h => !clampedHours.includes(h));
          if (redistributableHours.length > 0 && lostSurplus > 0) {
            const surplusPerHour = lostSurplus / redistributableHours.length;
            redistributableHours.forEach(hour => {
              const currentSurplus = hour.temp - coolingBaseF;
              const newSurplus = currentSurplus + (surplusPerHour * 24);
              hour.temp = Math.min(maxTemp, coolingBaseF + newSurplus);
            });
          }
        }
        
        // Clean up temporary property
        coolingHours.forEach(hour => {
          delete hour._desiredTemp;
        });
      }
      
    }
  } else {
    // Hard clamp strategy: Scale first, then clamp (accepts small HDD error)
    // Calculate actual HDD/CDD from generated temps
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
    
    // Scale degree-deficits/surpluses to match target HDD/CDD
    // Explicit formulas:
    // For heating hours (T < heatingBaseF):
    //   T' = heatingBaseF - kHDD * (heatingBaseF - T)
    //   where kHDD = targetHDD / actualHDD
    //
    // For cooling hours (T > coolingBaseF):
    //   T' = coolingBaseF + kCDD * (T - coolingBaseF)
    //   where kCDD = targetCDD / actualCDD
    if (monthHDD > 0 && actualHDD > 0) {
      const kHDD = monthHDD / actualHDD;
      hourlyTemps.forEach(hour => {
        if (hour.temp < heatingBaseF) {
          const deficit = heatingBaseF - hour.temp;
          hour.temp = heatingBaseF - (deficit * kHDD); // T' = base - k*(base - T)
        }
      });
    }
    
    if (monthCDD > 0 && actualCDD > 0) {
      const kCDD = monthCDD / actualCDD;
      hourlyTemps.forEach(hour => {
        if (hour.temp > coolingBaseF) {
          const surplus = hour.temp - coolingBaseF;
          hour.temp = coolingBaseF + (surplus * kCDD); // T' = base + k*(T - base)
        }
      });
    }
    
    
    // Clamp AFTER scaling (hard clamp strategy)
    hourlyTemps.forEach(hour => {
      hour.temp = Math.max(effectiveMinTemp, Math.min(maxTemp, hour.temp));
    });
  }
  
  // Calculate final HDD/CDD for reporting match accuracy
  let finalHDD = 0;
  let finalCDD = 0;
  hourlyTemps.forEach(({ temp }) => {
    if (temp < heatingBaseF) {
      finalHDD += (heatingBaseF - temp) / 24;
    }
    if (temp > coolingBaseF) {
      finalCDD += (temp - coolingBaseF) / 24;
    }
  });
  
  // HDD match error: only calculate if target HDD > 0
  const hddMatchError = monthHDD > 0 ? Math.abs(finalHDD - monthHDD) / monthHDD * 100 : null;
  
  // CDD match error: handle case where no hours exceed cooling base (unmatchable)
  // If monthCDD > 0 but finalCDD == 0, we cannot match (no exceedance hours generated)
  const cddMatchError = monthCDD > 0 
    ? (finalCDD > 0 
        ? Math.abs(finalCDD - monthCDD) / monthCDD * 100 
        : null) // null = unmatchable (no exceedance hours)
    : null; // No target CDD
  
  // VALIDATION: Compute diagnostic statistics for tail distribution validation
  // These help verify that aux heat estimates are driven by realistic tail distributions
  const temps = hourlyTemps.map(h => h.temp);
  const monthlyMinTemp = Math.min(...temps);
  const monthlyMaxTemp = Math.max(...temps);
  const sortedTemps = [...temps].sort((a, b) => a - b);
  const p5 = sortedTemps[Math.floor(sortedTemps.length * 0.05)];
  const p50 = sortedTemps[Math.floor(sortedTemps.length * 0.50)];
  const p95 = sortedTemps[Math.floor(sortedTemps.length * 0.95)];
  
  // Attach diagnostics to returned array (for validation reporting)
  hourlyTemps._diagnostics = {
    monthlyMinTemp,
    monthlyMaxTemp,
    p5,
    p50,
    p95,
    hoursBelow32F: temps.filter(t => t < 32).length,
    hoursBelowBalancePoint: null, // Will be set by caller if balance point is known
    hddMatchError, // HDD match error percentage
    cddMatchError, // CDD match error percentage
    finalHDD, // Final HDD after scaling/clamping
    finalCDD, // Final CDD after scaling/clamping
  };
  
  return hourlyTemps;
}
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
  
  // Typical year generator parameters (dev mode only)
  const [diurnalAmplitudeFactor, setDiurnalAmplitudeFactor] = useState(0.4);
  const [noiseSigma, setNoiseSigma] = useState(0.0);
  const [minClamp, setMinClamp] = useState(null);
  const [hddMatchStrategy, setHddMatchStrategy] = useState('hardClamp'); // 'hardClamp' or 'constrainedMatch'
  
  
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
  
  // Target temperatures from Ecobee (via Joule Bridge)
  const ecobeeTargetTemp = useMemo(() => {
    if (jouleBridge.bridgeAvailable && jouleBridge.connected && jouleBridge.targetTemperature !== null) {
      return jouleBridge.targetTemperature;
    }
    return null;
  }, [jouleBridge.bridgeAvailable, jouleBridge.connected, jouleBridge.targetTemperature]);
  
  // Cooling target temperature from Ecobee (via Joule Bridge)
  const ecobeeCoolingTargetTemp = useMemo(() => {
    if (jouleBridge.bridgeAvailable && jouleBridge.connected && jouleBridge.targetCoolTemp !== null) {
      return jouleBridge.targetCoolTemp;
    }
    return null;
  }, [jouleBridge.bridgeAvailable, jouleBridge.connected, jouleBridge.targetCoolTemp]);
  
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
      // BASE_BTU_PER_SQFT: 22.67 BTU/(hr·ft²) @ 70°F ΔT
      // Source: DOE Residential Energy Consumption Survey (RECS) & ASHRAE Handbook - Fundamentals
      // Represents ~0.32 BTU/(hr·ft²·°F) for average modern code-built homes
      const BASE_BTU_PER_SQFT = 22.67;
      const ceilingMultiplier = 1 + ((userSettings.ceilingHeight || 8) - 8) * 0.1;
      const effectiveSquareFeet = heatUtils.getEffectiveSquareFeet(
        userSettings.squareFeet || 1500,
        userSettings.hasLoft || false,
        userSettings.homeShape || 1.0
      );
      
      const designHeatLoss = effectiveSquareFeet * 
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
  
  // Heat gain factor for cooling - derived from heat loss factor with solar exposure multiplier
  const heatGainFactor = useMemo(() => {
    if (!heatLossFactor || heatLossFactor <= 0) {
      return 0;
    }
    
    // Get solar exposure multiplier
    // Default range: 1.3-1.8 (unless user explicitly selects "shaded/minimal windows" which allows 1.0-1.2)
    let solarExposureMultiplier = userSettings.solarExposure || 1.5;
    
    // If it's a percent (>= 1 and <= 100), divide by 100
    if (solarExposureMultiplier >= 1 && solarExposureMultiplier <= 100) {
      solarExposureMultiplier = solarExposureMultiplier / 100;
    }
    
    // Clamp to [1.0, 2.5] range
    // Note: Shaded/minimal windows allows 1.0-1.2, typical range is 1.3-1.8
    solarExposureMultiplier = Math.max(1.0, Math.min(2.5, solarExposureMultiplier));
    
    // Derive heat gain from heat loss: heatGainFactor = heatLossFactor * solarExposureMultiplier
    const calculatedHeatGain = heatLossFactor * solarExposureMultiplier;
    
    return calculatedHeatGain;
  }, [userSettings, heatLossFactor]);
  
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
  const designHeatLossBtuHrAt70F = useMemo(() => {
    return heatLossFactor * 70; // BTU/hr at design conditions (70°F delta-T)
  }, [heatLossFactor]);
  
  // Year selection for aux heat calculation (needed early for historicalHourly)
  const [auxHeatYear, setAuxHeatYear] = useState(() => new Date().getFullYear() - 1); // Default to previous year
  const [useWorstYear, setUseWorstYear] = useState(false);
  
  // Get hourly historical data for selected year (needed early for CDD calculation)
  const { hourlyData: historicalHourly, loading: historicalLoading } = useHistoricalHourly(
    userLocation?.latitude,
    userLocation?.longitude,
    { 
      year: auxHeatYear,
      enabled: !!userLocation?.latitude && !!userLocation?.longitude
    }
  );
  
  // Get annual HDD/CDD for location at base 65°F
  const annualHDDBase65 = useMemo(() => {
    if (!userLocation) return 5000; // Default
    return getAnnualHDD(`${userLocation.city}, ${userLocation.state}`, userLocation.state);
  }, [userLocation]);
  
  const annualCDDBase65 = useMemo(() => {
    if (!userLocation) return 1500; // Default
    return getAnnualCDD(`${userLocation.city}, ${userLocation.state}`, userLocation.state);
  }, [userLocation]);
  
  // First-class base temperature variables (used in all calculations)
  // Heating base: from Ecobee target temperature (heating mode)
  const heatingBaseF = ecobeeTargetTemp || 68; // Base temperature for HDD calculations (from Ecobee if available)
  // Cooling base: from Ecobee cooling target if available, otherwise from user settings
  const coolingBaseF = ecobeeCoolingTargetTemp || userSettings?.summerThermostat || 74; // Base temperature for CDD calculations
  
  // Standard reference base (65°F) for HDD/CDD from NOAA
  const hddBaseTemp = 65;
  const cddBaseTemp = 65;
  
  // Legacy aliases for backward compatibility in existing code
  const heatingSetpoint = heatingBaseF;
  const coolingSetpoint = coolingBaseF;
  
  // Compute annual HDD from hourly temps if available, otherwise adjust from base 65°F
  // HDD measures heating degree days: sum of (base_temp - outdoor_temp) when outdoor < base
  // Base temperature: heatingBaseF = {heatingBaseF}°F (used in model)
  // HDD_base = Σ max(0, base - T_out) / 24 (degree-days)
  const annualHDD = useMemo(() => {
    // If we have historical hourly data, compute HDD directly from hourly temps
    // This is more accurate than adjusting from base 65°F
    if (historicalHourly && historicalHourly.length > 0) {
      let totalHDD = 0;
      historicalHourly.forEach(hour => {
        const temp = hour.temp;
        if (temp < heatingBaseF) {
          const dtHours = hour.dtHours ?? 1.0;
          totalHDD += (heatingBaseF - temp) * dtHours / 24; // Convert degree-hours to degree-days
        }
      });
      return totalHDD;
    }
    
    // Fallback: Adjust from base 65°F using approximation
    // If base is HIGHER than 65°F, we need MORE HDD (more heating needed)
    // If base is LOWER than 65°F, we need FEWER HDD (less heating needed)
    // Formula: HDD_new ≈ HDD_old + (base_new - base_old) × 365
    // Note: This approximation assumes every day is below both bases, which isn't exact
    if (heatingBaseF > hddBaseTemp) {
      return annualHDDBase65 + (heatingBaseF - hddBaseTemp) * 365;
    } else if (heatingBaseF < hddBaseTemp) {
      // If base is lower, reduce HDD (but don't go negative)
      return Math.max(0, annualHDDBase65 + (heatingBaseF - hddBaseTemp) * 365);
    }
    return annualHDDBase65;
  }, [annualHDDBase65, heatingBaseF, historicalHourly]);
  
  // Compute annual CDD from hourly temps if available, otherwise adjust from base 65°F
  // CDD measures cooling degree days: sum of (outdoor_temp - base_temp) when outdoor > base
  // Base temperature: coolingBaseF = {coolingBaseF}°F (used in model)
  // CDD_base = Σ max(0, T_out - base) / 24 (degree-days)
  const annualCDD = useMemo(() => {
    // If we have historical hourly data, compute CDD directly from hourly temps
    // This is more accurate than adjusting from base 65°F
    if (historicalHourly && historicalHourly.length > 0) {
      let totalCDD = 0;
      historicalHourly.forEach(hour => {
        const temp = hour.temp;
        if (temp > coolingBaseF) {
          const dtHours = hour.dtHours ?? 1.0;
          totalCDD += (temp - coolingBaseF) * dtHours / 24; // Convert degree-hours to degree-days
        }
      });
      return totalCDD;
    }
    
    // Fallback: Adjust from base 65°F using approximation
    // If base is HIGHER than 65°F, we need FEWER CDD (less cooling needed)
    // If base is LOWER than 65°F, we need MORE CDD (more cooling needed)
    // Formula: CDD_new ≈ CDD_old - (base_new - base_old) × cooling_season_days
    const coolingSeasonDays = 180; // Typical cooling season (May-September)
    if (coolingBaseF > cddBaseTemp) {
      // Higher base = less cooling needed = fewer CDD
      return Math.max(0, annualCDDBase65 - (coolingBaseF - cddBaseTemp) * coolingSeasonDays);
    } else if (coolingBaseF < cddBaseTemp) {
      // Lower base = more cooling needed = more CDD
      return annualCDDBase65 + (cddBaseTemp - coolingBaseF) * coolingSeasonDays;
    }
    return annualCDDBase65;
  }, [annualCDDBase65, coolingBaseF, historicalHourly]);
  
  // Generate deterministic seed for Typical Year generator
  // Same inputs = same seed = same "typical year" (deterministic)
  // This prevents budget roulette where refreshing gives different results
  const typicalYearSeed = useMemo(() => {
    // Create seed from location + "typicalYear" + key input parameters
    const locationKey = userLocation ? `${userLocation.city},${userLocation.state}` : 'default';
    const paramsKey = `${heatingBaseF},${coolingBaseF},${annualHDD?.toFixed(0) || '0'},${annualCDD?.toFixed(0) || '0'}`;
    const seedString = `typicalYear:${locationKey}:${paramsKey}`;
    
    // Simple hash function to convert string to integer seed
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
      const char = seedString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }, [userLocation, heatingBaseF, coolingBaseF, annualHDD, annualCDD]);
  
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
  
  // Calculate monthly costs using Ecobee setpoints (heating from Ecobee, cooling from Ecobee if available or user settings) with aux heat
  const monthlyBudget = useMemo(() => {
    if (!ecobeeTargetTemp) return null;
    
    const totalTypicalHDD = MONTHLY_HDD_DIST.reduce((a, b) => a + b, 0);
    const totalTypicalCDD = MONTHLY_CDD_DIST.reduce((a, b) => a + b, 0);
    
    // Days per month (approximate)
    const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    
    // Compute monthly HDD/CDD values first (before normalization)
    const monthlyHDDValues = MONTH_NAMES.map((name, idx) => {
      return totalTypicalHDD > 0 
        ? (MONTHLY_HDD_DIST[idx] / totalTypicalHDD) * annualHDD 
        : 0;
    });
    const monthlyCDDValues = MONTH_NAMES.map((name, idx) => {
      return totalTypicalCDD > 0 
        ? (MONTHLY_CDD_DIST[idx] / totalTypicalCDD) * annualCDD 
        : 0;
    });
    
    // Normalize to ensure exact sum: adjust last month to account for floating-point rounding
    const hddSum = monthlyHDDValues.reduce((a, b) => a + b, 0);
    const cddSum = monthlyCDDValues.reduce((a, b) => a + b, 0);
    if (Math.abs(hddSum - annualHDD) > 1e-6 && monthlyHDDValues.length > 0) {
      monthlyHDDValues[monthlyHDDValues.length - 1] += (annualHDD - hddSum);
    }
    if (Math.abs(cddSum - annualCDD) > 1e-6 && monthlyCDDValues.length > 0) {
      monthlyCDDValues[monthlyCDDValues.length - 1] += (annualCDD - cddSum);
    }
    
    const months = MONTH_NAMES.map((name, idx) => {
      // Use normalized monthly values (ensures exact sum to annual)
      const monthHDD = monthlyHDDValues[idx];
      let monthCDD = monthlyCDDValues[idx];
      
      // Zero out micro-CDD months: tiny shoulder-season CDD allocations (< 1.5 CDD) are likely
      // artifacts of the distribution pattern rather than real climate signals. Zeroing them
      // avoids forcing unrealistic temperature bounds for months that shouldn't have cooling.
      const CDD_THRESHOLD = 1.5; // CDD below this threshold are considered artifacts
      // Compute effectiveMonthCDD once and use consistently
      const effectiveMonthCDD = (monthCDD > 0 && monthCDD < CDD_THRESHOLD) ? 0 : monthCDD;
      
      // NOTE: In "Typical Year (Budget)" mode, forecast injection is disabled to preserve
      // determinism and HDD matching. Forecast data breaks typical year generation because
      // it uses actual temps that may not match the target HDD, causing large HDD errors.
      // All months use HDD-based typical year generation for consistency.
      let avgOutdoorTemp = heatingBaseF; // Default to heatingBaseF (typically 68°F)
      let minOutdoorTemp = 65;
      let maxOutdoorTemp = 65;
      
      // Estimate from HDD with better temperature distribution (all months use this)
      // Estimate average outdoor temp from HDD
      // HDD = sum of (heatingBaseF - outdoor_temp) / 24 for all hours where outdoor < heatingBaseF
      // Mean ≈ heatingBaseF - (HDD × 24 / hours_in_month)
      // Simplified: Mean ≈ heatingBaseF - (HDD / days_in_month) since 24 hours/day
      const hoursInMonth = daysPerMonth[idx] * 24;
      avgOutdoorTemp = monthHDD > 0 
        ? Math.max(-20, heatingBaseF - (monthHDD * 24 / hoursInMonth)) // Cap at -20°F minimum
        : heatingBaseF; // No heating needed
      
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
      
      // Option A: Make bounds compatible with CDD (feasibility check)
      // When effectiveMonthCDD > 0, ensure maxTemp is high enough to actually support the target CDD
      // Simple, aggressive check: force maxTemp to be at least 5°F above cooling base
      // This ensures there are always some hours above the cooling base, preventing "unmatchable" CDD
      if (effectiveMonthCDD > 0) {
        maxOutdoorTemp = Math.max(maxOutdoorTemp, coolingBaseF + 5);
      }
      
      // Calculate heating with aux heat
      // PURE TYPICAL-YEAR MODE: Both HP and Aux computed from typical-year hourly temps
      // This ensures HP + Aux are from the same weather realization and can be properly added
      //
      // FLOW: Monthly HDD/CDD → generateTypicalYearHourlyTemps() → computeHourlyPerformance() → Monthly totals
      // 1. Monthly HDD/CDD values (derived from annual HDD/CDD and monthly distribution) are used to generate
      //    typical-year hourly temperatures that match the monthly degree-day totals exactly
      // 2. Each hourly temperature is fed to computeHourlyPerformance() which calculates:
      //    - Heat pump output (BTU/hr) based on capacity factor at that temperature
      //    - Building heat loss (BTU/hr) based on temperature difference
      //    - Delivered heat (HP + Aux) to match building load
      //    - HP kWh from delivered heat / COP (removes linear kW scaling assumption)
      //    - Aux kWh from deficit when HP output < building load
      // 3. Monthly totals are summed from all hourly calculations
      let heatingKwh = 0;
      let auxKwh = 0;
      let heatPumpKwh = 0;
      let typicalYearDiagnostics = null; // Store diagnostics for this month
      
      if (monthHDD > 0) {
        // Generate typical-year hourly temperatures for this month
        // These temps match the monthly HDD distribution exactly
        // NOTE: This is where HDD (monthly aggregate) is converted to hourly data
        const typicalYearHourlyTemps = generateTypicalYearHourlyTemps(
          monthHDD,
          effectiveMonthCDD, // Use effectiveMonthCDD consistently
          daysPerMonth[idx],
          heatingBaseF,
          coolingBaseF,
          avgOutdoorTemp,
          minOutdoorTemp,
          maxOutdoorTemp,
          { 
            diurnalAmplitudeFactor, 
            noiseSigma: nerdMode ? noiseSigma : 0.0, // Force noiseSigma=0 in normal mode (deterministic)
            minClamp, 
            hddMatchStrategy,
            seed: typicalYearSeed // Deterministic seed for reproducible results
          }
        );
        
        // Extract diagnostics for validation (hours below balance point, min temp, percentiles)
        typicalYearDiagnostics = typicalYearHourlyTemps._diagnostics;
        if (typicalYearDiagnostics && balancePoint !== null) {
          // Count hours below balance point
          const hoursBelowBalancePoint = typicalYearHourlyTemps.filter(
            h => h.temp < balancePoint
          ).length;
          typicalYearDiagnostics.hoursBelowBalancePoint = hoursBelowBalancePoint;
        }
        
        // Calculate both HP and Aux from typical-year hourly temps
        // Each hour is processed through computeHourlyPerformance() to get accurate part-load behavior
        let totalHeatPumpKwh = 0;
        let totalAuxKwh = 0;
        let totalDailyBtuLoad = 0;
        let totalHpDeliveredBtu = 0;
        let totalAuxDeliveredBtu = 0;
        
        typicalYearHourlyTemps.forEach(({ temp, humidity }) => {
          // computeHourlyPerformance() is the core function that models heat pump behavior at each hour
          // Input: system parameters (tons, HSPF2, cutoff temp) + outdoor temp + humidity
          // Output: delivered heat (HP + Aux), kWh consumption, runtime, etc.
          // This replaces the old "HDD energy estimator" approach with actual equipment modeling
          const dtHours = 1.0; // Timestep duration (1 hour per timestep)
          const perf = heatUtils.computeHourlyPerformance(
            {
              tons: tons,
              indoorTemp: ecobeeTargetTemp,
              designHeatLossBtuHrAt70F: designHeatLossBtuHrAt70F,
              compressorPower: compressorPower,
              hspf2: hspf2,
              cutoffTemp: userSettings?.cutoffTemp ?? -15, // Manufacturer-dependent cutoff temperature
            },
            temp,
            humidity,
            dtHours
          );
          
          // AGGREGATION RULES: Sum energy directly - NEVER multiply by dtHours
          // ✅ CORRECT: monthlyHpKwh += perf.hpKwh;
          // ❌ WRONG: monthlyHpKwh += perf.hpKwh * dtHours; // Would double-count!
          if (perf.hpKwh !== undefined) {
            totalHeatPumpKwh += perf.hpKwh; // ✅ CORRECT: Sum energy directly
          } else {
            // Fallback for backward compatibility
            totalHeatPumpKwh += perf.electricalKw * (perf.capacityUtilization / 100) * dtHours; // Fallback (using capacityUtilization, not time-based runtime)
          }
          
          // Aux heat energy (only when needed)
          // ✅ CORRECT: monthlyAuxKwh += perf.auxKwh;
          // ❌ WRONG: monthlyAuxKwh += perf.auxKw * dtHours; // Use auxKwh, not auxKw!
          // Note: auxKw is informational only; do not aggregate power, aggregate auxKwh.
          if (temp < balancePoint && useElectricAuxHeat && perf.auxKwh !== undefined && perf.auxKwh > 0) {
            totalAuxKwh += perf.auxKwh; // ✅ CORRECT: Sum energy directly
          } else if (temp < balancePoint && useElectricAuxHeat && perf.auxKw > 0) {
            // Fallback for backward compatibility
            totalAuxKwh += perf.auxKw * dtHours; // kW × h = kWh
          }
          
          // DIAGNOSTIC: Calculate BTU loads and deliveries for invariant check
          const buildingHeatLossBtuHr = heatLossFactor * Math.max(0, ecobeeTargetTemp - temp);
          
          // Use values from computeHourlyPerformance() as single source of truth
          const deliveredHpBtuHr = perf.deliveredHpBtuHr !== undefined 
            ? perf.deliveredHpBtuHr 
            : (buildingHeatLossBtuHr * (perf.capacityUtilization / 100)); // Fallback (using capacityUtilization, not time-based runtime)
          const deficitBtuHr = perf.deficitBtuHr !== undefined
            ? perf.deficitBtuHr
            : Math.max(0, buildingHeatLossBtuHr - deliveredHpBtuHr); // Fallback
          const deliveredAuxBtuHr = deficitBtuHr;
          
          // SANITY CHECK 1: No free heat - if load is 0, energy should be 0
          if (buildingHeatLossBtuHr === 0) {
            if (perf.hpKwh > 0.01 || perf.auxKw > 0.01) {
              console.warn(`[BudgetDebug] Sanity check failed: load=0 but hpKwh=${perf.hpKwh}, auxKw=${perf.auxKw}`);
            }
          }
          
          // SANITY CHECK 2: Energy balance per timestep
          const deliveredTotalBtuHr = deliveredHpBtuHr + deliveredAuxBtuHr;
          const loadMismatch = Math.abs(deliveredTotalBtuHr - buildingHeatLossBtuHr);
          if (loadMismatch > 0.1) { // Allow 0.1 BTU/hr rounding tolerance
            console.warn(`[BudgetDebug] Energy balance mismatch: delivered=${deliveredTotalBtuHr.toFixed(1)} BTU/hr, load=${buildingHeatLossBtuHr.toFixed(1)} BTU/hr, diff=${loadMismatch.toFixed(1)}`);
          }
          
          totalDailyBtuLoad += buildingHeatLossBtuHr * dtHours; // BTU/hr × h = BTU
          totalHpDeliveredBtu += deliveredHpBtuHr * dtHours; // BTU/hr × h = BTU
          totalAuxDeliveredBtu += deliveredAuxBtuHr * dtHours; // BTU/hr × h = BTU
        });
        
        // INVARIANT CHECK: Delivered heat should match building load (within rounding)
        const deliveredTotalBtu = totalHpDeliveredBtu + totalAuxDeliveredBtu;
        const loadMismatch = Math.abs(deliveredTotalBtu - totalDailyBtuLoad);
        if (loadMismatch > 1000) { // Allow 1000 BTU rounding tolerance for monthly totals
          console.warn(`[BudgetDebug] Monthly heat balance mismatch for month ${idx + 1}: delivered=${deliveredTotalBtu.toFixed(0)} BTU, load=${totalDailyBtuLoad.toFixed(0)} BTU, diff=${loadMismatch.toFixed(0)}`);
        }
        
        // DIAGNOSTIC: Calculate implied average COP for sanity check
        const impliedAvgCop = totalHeatPumpKwh > 0
          ? totalHpDeliveredBtu / (totalHeatPumpKwh * 3412.14)
          : null;
        
        // Debug print for implied COP (especially for cold months)
        if (impliedAvgCop !== null && avgOutdoorTemp >= 30 && avgOutdoorTemp <= 35) {
          console.log(`[BudgetDebug] Month ${idx + 1} (${avgOutdoorTemp.toFixed(1)}°F avg): Implied Avg COP = ${impliedAvgCop.toFixed(2)}, HP Delivered = ${(totalHpDeliveredBtu/1000).toFixed(0)}k BTU, HP kWh = ${totalHeatPumpKwh.toFixed(1)}`);
          if (impliedAvgCop > 4.5) {
            console.warn(`[BudgetDebug] ⚠️ High implied COP (${impliedAvgCop.toFixed(2)}) at ${avgOutdoorTemp.toFixed(1)}°F - COP curve may be too optimistic`);
          }
        }
        
        // Use typical-year hourly calculations for both HP and aux
        auxKwh = totalAuxKwh;
        heatPumpKwh = totalHeatPumpKwh;
        
        heatingKwh = heatPumpKwh + auxKwh;
      }
      
      // Cooling cost calculation (no aux heat for cooling)
      // NOTE: This is a SIMPLIFIED "CDD energy estimator", not a real equipment model.
      // It uses degree-days to estimate cooling energy, which is appropriate for long-term planning
      // but does not model actual equipment behavior (runtime, part-load efficiency, etc.).
      // 
      // Limitations:
      // 1. Solar multiplier > 1 can cause heating/cooling asymmetry in shoulder seasons
      // 2. SEER2 is seasonal/test-procedure dependent (similar to HSPF2 calibration issues)
      // 
      // CDD works similarly but with SEER2
      // SEER2 = BTU / Wh, so kWh = BTU / (SEER2 * 1000)
      const coolingBtu = heatGainFactor * monthCDD * 24;
      // Safety check: prevent division by zero if seer2 is invalid
      const effectiveSeer2 = Math.max(1.0, seer2); // Minimum 1.0 to prevent division by zero
      const coolingKwh = coolingBtu / (effectiveSeer2 * 1000);
      
      // SANITY CHECK: Maximum possible cooling kWh based on system capacity
      // A 2-ton, 15 SEER unit draws ~1.6 kW while running
      // Max possible = power × hours in month (if running 24/7)
      const compressorPowerKw = tons * (15 / seer2); // Approximate compressor power
      const maxPossibleCoolingKwh = compressorPowerKw * (daysPerMonth[idx] * 24);
      const coolingExceedsMax = coolingKwh > maxPossibleCoolingKwh;
      
      if (coolingExceedsMax) {
        console.warn(`[BudgetDebug] ⚠️ ${name}: Cooling kWh (${coolingKwh.toFixed(0)}) exceeds maximum possible (${maxPossibleCoolingKwh.toFixed(0)} kWh) for ${tons}-ton, SEER2=${seer2} system running 24/7. Heat gain factor may be too high.`);
      }
      
      // Total for month
      const totalKwh = heatingKwh + coolingKwh;
      // Round kWh first, then calculate cost from rounded values to ensure table reconciles
      // Keep full precision for cost calculations to avoid rounding drift
      // Round only for display in return object
      const heatingCost = heatingKwh * electricityRate;
      const coolingCost = coolingKwh * electricityRate;
      const energyCost = heatingCost + coolingCost;
      const totalCost = energyCost + monthlyFixedCharge;
      
      // Get achieved HDD/CDD from diagnostics (what was actually produced)
      const achievedHDD = typicalYearDiagnostics?.finalHDD ?? monthHDD;
      const achievedCDD = typicalYearDiagnostics?.finalCDD ?? effectiveMonthCDD;
      
      return {
        month: name,
        monthIdx: idx,
        hdd: monthHDD, // Target HDD (for reference)
        cdd: monthCDD, // Target CDD (for reference)
        achievedHDD, // Actual HDD produced by generator
        achievedCDD, // Actual CDD produced by generator
        heatPumpKwh: heatPumpKwh.toFixed(0), // Round only for display
        auxKwh: auxKwh.toFixed(0), // Round only for display
        heatingKwh: heatingKwh.toFixed(0), // Round only for display
        coolingKwh: coolingKwh.toFixed(0), // Round only for display
        totalKwh: totalKwh.toFixed(0), // Round only for display
        heatingCost: heatingCost.toFixed(2), // Round only for display
        coolingCost: coolingCost.toFixed(2), // Round only for display
        energyCost: energyCost.toFixed(2), // Round only for display
        fixedCost: monthlyFixedCharge.toFixed(2), // Round only for display
        totalCost: totalCost.toFixed(2), // Round only for display
        // Validation flags
        coolingExceedsMax: coolingExceedsMax,
        maxPossibleCoolingKwh: maxPossibleCoolingKwh,
        // Typical year diagnostics (for validation/display in coldest month analysis)
        typicalYearDiagnostics: typicalYearDiagnostics,
      };
    });
    
    return months;
  }, [ecobeeTargetTemp, annualHDD, annualCDD, heatLossFactor, heatGainFactor, hspf2, seer2, electricityRate, monthlyFixedCharge, tons, designHeatLossBtuHrAt70F, compressorPower, useElectricAuxHeat, extendedForecast, currentMonth, balancePoint, historicalHourly, diurnalAmplitudeFactor, noiseSigma, minClamp, hddMatchStrategy]);
  
  // Calculate temperature analysis for coldest month to explain aux heat calculation
  // In Typical Year mode, use typical year diagnostics from monthly budget
  const coldestMonthAnalysis = useMemo(() => {
    if (!ecobeeTargetTemp || !annualHDD || balancePoint === null) return null;
    
    // Try to get typical year diagnostics from monthly budget (if available)
    let typicalYearMinTemp = null;
    let typicalYearHoursBelowBalancePoint = null;
    let typicalYearP5 = null;
    
    if (monthlyBudget && monthlyBudget.length > 0) {
      // Find coldest month (highest HDD)
      const coldestMonth = monthlyBudget.reduce((max, month) => 
        parseFloat(month.hdd) > parseFloat(max.hdd) ? month : max
      );
      
      if (coldestMonth.typicalYearDiagnostics) {
        typicalYearMinTemp = coldestMonth.typicalYearDiagnostics.monthlyMinTemp;
        typicalYearHoursBelowBalancePoint = coldestMonth.typicalYearDiagnostics.hoursBelowBalancePoint;
        typicalYearP5 = coldestMonth.typicalYearDiagnostics.p5;
      }
    }
    
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
    
    // Estimate monthly average temp from HDD
    // Mean ≈ heatingBaseF - (HDD × 24 / hours_in_month)
    // Simplified: Mean ≈ heatingBaseF - (HDD / days) since 24 hours/day
    // This is the AVERAGE, not the minimum - there are much colder nights
    const monthlyAvgTemp = Math.max(-20, heatingBaseF - (scaledMaxHDD / maxHDDDays));
    
    // Use typical year min temp if available, otherwise estimate
    // Estimate minimum temperature (typically 15-20°F below average for winter months)
    // For Blairsville GA and similar climates, winter nights can be 15-25°F below daily average
    const estimatedMinTemp = typicalYearMinTemp !== null 
      ? typicalYearMinTemp 
      : monthlyAvgTemp - 20; // Conservative estimate
    
    // Calculate at average temp (heat pump can handle this)
    const cutoffTemp = userSettings?.cutoffTemp ?? -15;
    const capacityFactorAvg = heatUtils.getCapacityFactor(monthlyAvgTemp, cutoffTemp);
    const heatPumpOutputBtuAvg = tons * 12000 * capacityFactorAvg;
    const deltaTAvg = Math.max(0, ecobeeTargetTemp - monthlyAvgTemp);
    const buildingHeatLossBtuAvg = heatLossFactor * deltaTAvg;
    const surplusBtuAvg = heatPumpOutputBtuAvg - buildingHeatLossBtuAvg;
    
    // Calculate at estimated minimum temp (aux heat needed)
    const capacityFactorMin = heatUtils.getCapacityFactor(estimatedMinTemp, cutoffTemp);
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
      // Typical year diagnostics (if available)
      typicalYearMinTemp: typicalYearMinTemp,
      typicalYearHoursBelowBalancePoint: typicalYearHoursBelowBalancePoint,
      typicalYearP5: typicalYearP5,
    };
  }, [ecobeeTargetTemp, annualHDD, tons, heatLossFactor, balancePoint]);
  
  // Annual totals
  const annualTotals = useMemo(() => {
    if (!monthlyBudget) return null;
    
    const totalHeatPumpKwh = monthlyBudget.reduce((sum, m) => sum + parseFloat(m.heatPumpKwh), 0);
    const totalAuxKwh = monthlyBudget.reduce((sum, m) => sum + parseFloat(m.auxKwh), 0);
    const totalHeatingKwh = totalHeatPumpKwh + totalAuxKwh;
    const totalCoolingKwh = monthlyBudget.reduce((sum, m) => sum + parseFloat(m.coolingKwh), 0);
    
    // Calculate sum of target HDD/CDD (distribution-derived targets used for budgeting)
    // Also calculate achieved totals for diagnostic comparison
    const totalMonthlyHDD = monthlyBudget.reduce((sum, m) => {
      const hdd = Number(m.hdd) || 0;
      return sum + hdd; // Sum target HDD (not rounded, keep precision)
    }, 0);
    const totalMonthlyCDDAchieved = monthlyBudget.reduce((sum, m) => {
      const cdd = Number(m.achievedCDD ?? m.cdd) || 0;
      return sum + cdd; // Sum achieved CDD for comparison
    }, 0);
    const totalMonthlyHDDAchieved = monthlyBudget.reduce((sum, m) => {
      const hdd = Number(m.achievedHDD ?? m.hdd) || 0;
      return sum + hdd; // Sum achieved HDD for diagnostic comparison
    }, 0);
    const totalMonthlyCDD = monthlyBudget.reduce((sum, m) => {
      const cdd = Number(m.cdd) || 0;
      return sum + cdd; // Sum target CDD (not rounded, keep precision)
    }, 0);
    const totalKwh = totalHeatingKwh + totalCoolingKwh;
    // Keep full precision for cost calculations to avoid rounding drift
    // Round only for display in return object
    const totalHeatingCost = totalHeatingKwh * electricityRate;
    const totalCoolingCost = totalCoolingKwh * electricityRate;
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
      totalMonthlyHDD: totalMonthlyHDD, // Target HDD sum (distribution-derived)
      totalMonthlyCDD: totalMonthlyCDD, // Target CDD sum (distribution-derived)
      totalMonthlyHDDAchieved: totalMonthlyHDDAchieved, // Achieved HDD sum (from generator)
      totalMonthlyCDDAchieved: totalMonthlyCDDAchieved, // Achieved CDD sum (from generator)
    };
  }, [monthlyBudget, monthlyFixedCharge]);
  
  // Aggregate typical year diagnostics across all months
  const aggregateDiagnostics = useMemo(() => {
    if (!monthlyBudget || monthlyBudget.length === 0) return null;
    
    let minTemp = Infinity;
    let p5Temp = Infinity;
    let totalHoursBelowBalancePoint = 0;
    let maxHddMatchError = 0;
    let maxCddMatchError = 0;
    let totalHddMatchError = 0;
    let totalCddMatchError = 0;
    let monthsWithHDD = 0;
    let monthsWithCDD = 0;
    
    monthlyBudget.forEach(month => {
      if (month.typicalYearDiagnostics) {
        const diag = month.typicalYearDiagnostics;
        if (diag.monthlyMinTemp !== null && diag.monthlyMinTemp !== undefined) {
          minTemp = Math.min(minTemp, diag.monthlyMinTemp);
        }
        if (diag.p5 !== null && diag.p5 !== undefined) {
          p5Temp = Math.min(p5Temp, diag.p5);
        }
        if (diag.hoursBelowBalancePoint !== null && diag.hoursBelowBalancePoint !== undefined) {
          totalHoursBelowBalancePoint += diag.hoursBelowBalancePoint;
        }
        if (diag.hddMatchError !== null && diag.hddMatchError !== undefined) {
          maxHddMatchError = Math.max(maxHddMatchError, diag.hddMatchError);
          totalHddMatchError += diag.hddMatchError;
          monthsWithHDD++;
        }
        if (diag.cddMatchError !== null && diag.cddMatchError !== undefined) {
          // Only count non-null errors (null = unmatchable, don't include in average)
          maxCddMatchError = Math.max(maxCddMatchError, diag.cddMatchError);
          totalCddMatchError += diag.cddMatchError;
          monthsWithCDD++;
        }
      }
    });
    
    // Count months with unmatchable CDD (target > 0 but no exceedance hours)
    const monthsWithUnmatchableCDD = monthlyBudget.filter(m => 
      m.typicalYearDiagnostics?.cddMatchError === null && 
      parseFloat(m.cdd) > 0
    ).length;
    
    return {
      minTemp: minTemp !== Infinity ? minTemp : null,
      p5Temp: p5Temp !== Infinity ? p5Temp : null,
      hoursBelowBalancePoint: totalHoursBelowBalancePoint,
      maxHddMatchError,
      maxCddMatchError,
      avgHddMatchError: monthsWithHDD > 0 ? totalHddMatchError / monthsWithHDD : 0,
      avgCddMatchError: monthsWithCDD > 0 ? totalCddMatchError / monthsWithCDD : null, // null if no matchable months
      monthsWithUnmatchableCDD,
    };
  }, [monthlyBudget]);
  
  // Debug: Track input hashes to detect what's changing between runs
  const inputHashes = useMemo(() => {
    if (!monthlyBudget || monthlyBudget.length === 0) return null;
    
    // Simple hash function
    const hash = (str) => {
      let h = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        h = ((h << 5) - h) + char;
        h = h & h; // Convert to 32-bit integer
      }
      return Math.abs(h).toString(16).substring(0, 8);
    };
    
    // Hash monthly HDD/CDD arrays
    const monthHDDHash = hash(monthlyBudget.map(m => m.hdd.toFixed(2)).join(','));
    const monthCDDHash = hash(monthlyBudget.map(m => m.cdd.toFixed(2)).join(','));
    
    // Hash December inputs (most likely to change due to forecast)
    const decMonth = monthlyBudget.find(m => m.monthIdx === 11); // December is index 11
    const decInputs = decMonth ? {
      monthHDD: decMonth.hdd.toFixed(2),
      monthCDD: decMonth.cdd.toFixed(2),
      avgTemp: extendedForecast && currentMonth === 11 && extendedForecast.length > 0
        ? (() => {
            const temps = extendedForecast.map(h => h.temp).filter(t => t != null);
            return temps.length > 0 
              ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(2)
              : 'estimated';
          })()
        : 'estimated',
      minTemp: extendedForecast && currentMonth === 11 && extendedForecast.length > 0
        ? (() => {
            const temps = extendedForecast.map(h => h.temp).filter(t => t != null);
            return temps.length > 0 
              ? Math.min(...temps).toFixed(2)
              : 'estimated';
          })()
        : 'estimated',
      maxTemp: extendedForecast && currentMonth === 11 && extendedForecast.length > 0
        ? (() => {
            const temps = extendedForecast.map(h => h.temp).filter(t => t != null);
            return temps.length > 0 
              ? Math.max(...temps).toFixed(2)
              : 'estimated';
          })()
        : 'estimated',
      forecastHash: extendedForecast && currentMonth === 11 && extendedForecast.length > 0
        ? hash(extendedForecast.map(h => `${h.temp?.toFixed(1)},${h.time}`).join('|'))
        : 'none',
      forecastCount: extendedForecast && currentMonth === 11 ? extendedForecast.length : 0,
    } : null;
    
    return {
      monthHDDHash,
      monthCDDHash,
      generatorParams: hash(`${diurnalAmplitudeFactor},${noiseSigma},${minClamp},${hddMatchStrategy}`),
      decInputs,
    };
  }, [monthlyBudget, extendedForecast, currentMonth, diurnalAmplitudeFactor, noiseSigma, minClamp, hddMatchStrategy]);
  
  const isConnected = jouleBridge.bridgeAvailable && jouleBridge.connected;
  
  // State for collapsible sections
  const [showFormula, setShowFormula] = useState(false);
  
  // State for tabs and UI improvements
  const [activeTab, setActiveTab] = useState("overview");
  const [showHddCddColumns, setShowHddCddColumns] = useState(false);
  const [dismissedInfoBanner, setDismissedInfoBanner] = useState(() => {
    return localStorage.getItem('budgetDebug_dismissedBanner') === 'true';
  });
  
  const handleDismissBanner = () => {
    setDismissedInfoBanner(true);
    localStorage.setItem('budgetDebug_dismissedBanner', 'true');
  };
  
  return (
    <div className="min-h-screen bg-[#0C0F14] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-7 h-7 text-purple-400" />
            Annual Energy Budget
          </h1>
          <p className="text-base text-gray-300 mt-2 max-w-3xl">
            Estimate your annual heating and cooling costs based on your location's climate and your Ecobee thermostat settings. 
            This uses a typical weather year to calculate monthly energy usage and costs.
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
                  About This Estimate
                </div>
                <div className="text-sm text-blue-300">
                  This estimate uses a synthetic "Typical Year" based on historical weather averages for your location, not a specific past year. 
                  It's designed for annual budget planning and may differ from actual costs in any given year.
                </div>
              </div>
            </div>
          </div>
        )}
        
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
        
        {/* Dev Panel: Typical Year Generator Parameters (nerdMode only) */}
        {nerdMode && (
          <div className="mb-6 p-4 rounded-lg border border-purple-700/50 bg-purple-900/10">
            <p className="text-purple-400 font-semibold mb-3 text-sm">🔧 Dev: Typical Year Generator Parameters</p>
            <p className="text-gray-400 text-xs mb-3">These parameters control the synthetic temperature distribution. Changes affect tail temperatures and aux heat estimates.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Diurnal Amplitude Factor: <span className="text-purple-300 font-mono">{diurnalAmplitudeFactor.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="0.8"
                  step="0.05"
                  value={diurnalAmplitudeFactor}
                  onChange={(e) => setDiurnalAmplitudeFactor(parseFloat(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Controls daily temperature swing (0.1 = 10% of range, 0.8 = 80%)</p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Noise Sigma (°F): <span className="text-purple-300 font-mono">{noiseSigma.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={noiseSigma}
                  onChange={(e) => setNoiseSigma(parseFloat(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Gaussian noise standard deviation (adds randomness to temps)</p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Min Clamp (°F): <span className="text-purple-300 font-mono">{minClamp !== null ? minClamp.toFixed(1) : "None"}</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="-20"
                    max="50"
                    step="1"
                    value={minClamp !== null ? minClamp : ""}
                    onChange={(e) => setMinClamp(e.target.value === "" ? null : parseFloat(e.target.value))}
                    placeholder="None"
                    className="flex-1 px-2 py-1 bg-[#151A21] border border-[#222A35] rounded text-xs text-white"
                  />
                  <button
                    onClick={() => setMinClamp(null)}
                    className="px-2 py-1 bg-[#151A21] border border-[#222A35] rounded text-xs text-gray-400 hover:text-white"
                  >
                    Clear
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Minimum temperature floor (null = use calculated minTemp)</p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  HDD Match Strategy: <span className="text-purple-300 font-mono">{hddMatchStrategy}</span>
                </label>
                <select
                  value={hddMatchStrategy}
                  onChange={(e) => setHddMatchStrategy(e.target.value)}
                  className="w-full px-2 py-1 bg-[#151A21] border border-[#222A35] rounded text-xs text-white"
                >
                  <option value="hardClamp">Hard Clamp (accept small HDD error)</option>
                  <option value="constrainedMatch">Constrained Match (iterative solver)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {hddMatchStrategy === 'hardClamp' 
                    ? 'Scale first, then clamp. Clamp is absolute (never violated), but HDD may not match exactly (small error reported).'
                    : 'Iterative solver that enforces clamp while matching HDD/CDD.'}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Current Values Panel */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {/* Ecobee Setpoints */}
          <div className="bg-[#151A21] border border-[#222A35] rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-300 text-sm mb-2 font-medium">
              <Thermometer className="w-4 h-4" />
              Thermostat Settings
            </div>
            <div className="space-y-2">
              <div>
                <div className="text-sm text-cyan-300 font-semibold">Heating: {heatingBaseF}°F</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {ecobeeTargetTemp !== null ? "From your Ecobee" : "Default setting"}
                </div>
              </div>
              <div>
                <div className="text-sm text-red-300 font-semibold">Cooling: {coolingBaseF}°F</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {ecobeeCoolingTargetTemp !== null ? "From your Ecobee" : ecobeeTargetTemp !== null ? "From user settings" : "Default setting"}
                </div>
              </div>
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
            <div className="flex items-center gap-2 text-gray-300 text-sm mb-2 font-medium">
              <TrendingUp className="w-4 h-4" />
              Heating Degree Days
            </div>
            <div className="text-2xl font-bold text-cyan-400 mb-1" title="Heating Degree Days (HDD) measure how much heating is needed. Higher numbers mean colder winters.">
              {annualTotals && annualTotals.totalMonthlyHDDAchieved !== undefined 
                ? Math.round(annualTotals.totalMonthlyHDDAchieved).toLocaleString() 
                : annualTotals && annualTotals.totalMonthlyHDD !== undefined
                ? Math.round(annualTotals.totalMonthlyHDD).toLocaleString()
                : Math.round(annualHDD || 0).toLocaleString()}
            </div>
            <div className="text-xs text-gray-400">
              Base: {heatingBaseF}°F • Used for heating calculations
            </div>
            {annualTotals && annualTotals.totalMonthlyHDD !== undefined && (
              <div className="text-xs text-gray-500 mt-1">
                {Math.abs(annualTotals.totalMonthlyHDD - (annualTotals.totalMonthlyHDDAchieved ?? annualTotals.totalMonthlyHDD)) > 0.5 ? (
                  <>
                    <span className="text-gray-400">Target: {Math.round(annualTotals.totalMonthlyHDD).toLocaleString()}</span>
                    <span className="text-gray-500 ml-2">(distribution-derived, used as input to generator)</span>
                    <br />
                    {annualHDD && Math.abs(annualTotals.totalMonthlyHDD - annualHDD) > 0.5 && (
                      <>
                        Annual HDD data: {Math.round(annualHDD).toLocaleString()} (base {heatingBaseF}°F, from location data)
                        <br />
                      </>
                    )}
                  </>
                ) : (
                  annualHDDBase65 && <>Base 65°F: {annualHDDBase65.toLocaleString()}</>
                )}
              </div>
            )}
          </div>
          
          {/* Annual CDD */}
          <div className="bg-[#151A21] border border-[#222A35] rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-300 text-sm mb-2 font-medium">
              <TrendingUp className="w-4 h-4" />
              Cooling Degree Days
            </div>
            <div className="text-2xl font-bold text-red-400 mb-1" title="Cooling Degree Days (CDD) measure how much cooling is needed. Higher numbers mean hotter summers.">
              {annualTotals && annualTotals.totalMonthlyCDD !== undefined 
                ? Math.round(annualTotals.totalMonthlyCDD).toLocaleString() 
                : Math.round(annualCDD || 0).toLocaleString()}
            </div>
            <div className="text-xs text-gray-400">
              Base: {coolingBaseF}°F • Used for cooling calculations
            </div>
            {annualTotals && annualTotals.totalMonthlyCDD !== undefined && (
              <div className="text-xs text-gray-500 mt-1">
                {annualCDD && Math.abs(annualTotals.totalMonthlyCDD - annualCDD) > 0.5 ? (
                  <>
                    Theoretical: {Math.round(annualCDD).toLocaleString()} (base {coolingBaseF}°F, computed from hourly truth)
                    <br />
                    Sum of monthly: {Math.round(annualTotals.totalMonthlyCDD).toLocaleString()} (base {coolingBaseF}°F, unrounded sum)
                  </>
                ) : (
                  annualCDDBase65 && (
                    <>
                      CDD65 (standard climate reference): {annualCDDBase65.toLocaleString()}
                      {historicalHourly && historicalHourly.length > 0 && (
                        <> • Computed from {historicalHourly.length} hourly temps</>
                      )}
                    </>
                  )
                )}
              </div>
            )}
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
        
        
        {/* Hero Section: Key Metrics */}
        {annualTotals && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {/* Total Annual Cost - Hero Card */}
              <div className="bg-gradient-to-br from-green-600/30 to-green-800/30 border-2 border-green-600/60 rounded-xl p-6 shadow-lg">
                <div className="text-sm text-green-200 mb-2 font-medium">TOTAL ANNUAL COST</div>
                <div className="text-4xl font-bold text-white mb-2">${annualTotals.totalCost}</div>
                <div className="text-sm text-green-300">
                  {formatEnergyFromKwh(parseFloat(annualTotals.totalKwh), effectiveUnitSystem, { decimals: 0 })}
                </div>
              </div>
              
              {/* Heating Cost */}
              <div className="bg-gradient-to-br from-orange-600/30 to-red-800/30 border-2 border-orange-600/60 rounded-xl p-6 shadow-lg">
                <div className="text-sm text-orange-200 mb-2 font-medium">HEATING ESTIMATE</div>
                <div className="text-3xl font-bold text-white mb-2">${annualTotals.heatingCost}</div>
                <div className="text-xs text-orange-300">
                  {formatEnergyFromKwh(parseFloat(annualTotals.heatingKwh), effectiveUnitSystem, { decimals: 0 })} • Includes backup heat
                </div>
              </div>
              
              {/* Cooling Cost */}
              <div className="bg-gradient-to-br from-blue-600/30 to-cyan-800/30 border-2 border-blue-600/60 rounded-xl p-6 shadow-lg">
                <div className="text-sm text-blue-200 mb-2 font-medium">COOLING ESTIMATE</div>
                <div className="text-3xl font-bold text-white mb-2">${annualTotals.coolingCost}</div>
                <div className="text-xs text-blue-300">
                  {formatEnergyFromKwh(parseFloat(annualTotals.coolingKwh), effectiveUnitSystem, { decimals: 0 })}
                </div>
              </div>
            </div>
            
            {/* Cost Breakdown Donut Chart */}
            <div className="bg-[#151A21] border border-[#222A35] rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-white mb-4">Cost Breakdown</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Heating', value: parseFloat(annualTotals.heatingCost), color: '#f97316' },
                          { name: 'Cooling', value: parseFloat(annualTotals.coolingCost), color: '#3b82f6' },
                          { name: 'Fixed Charges', value: parseFloat(annualTotals.fixedCost), color: '#6b7280' },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {[
                          { name: 'Heating', value: parseFloat(annualTotals.heatingCost), color: '#f97316' },
                          { name: 'Cooling', value: parseFloat(annualTotals.coolingCost), color: '#3b82f6' },
                          { name: 'Fixed Charges', value: parseFloat(annualTotals.fixedCost), color: '#6b7280' },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value) => `$${parseFloat(value).toFixed(2)}`}
                        contentStyle={{ backgroundColor: '#1a1f27', border: '1px solid #222a35', borderRadius: '8px' }}
                      />
                      <Legend 
                        wrapperStyle={{ color: '#d1d5db', fontSize: '12px' }}
                        formatter={(value) => {
                          const total = parseFloat(annualTotals.totalCost);
                          const val = value === 'Heating' ? parseFloat(annualTotals.heatingCost) :
                                     value === 'Cooling' ? parseFloat(annualTotals.coolingCost) :
                                     parseFloat(annualTotals.fixedCost);
                          const percent = ((val / total) * 100).toFixed(1);
                          return `${value} (${percent}%)`;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-orange-900/20 rounded-lg border border-orange-700/30">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-orange-500"></div>
                      <span className="text-gray-300">Heating</span>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-semibold">${annualTotals.heatingCost}</div>
                      <div className="text-xs text-gray-400">
                        {((parseFloat(annualTotals.heatingCost) / parseFloat(annualTotals.totalCost)) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-900/20 rounded-lg border border-blue-700/30">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-blue-500"></div>
                      <span className="text-gray-300">Cooling</span>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-semibold">${annualTotals.coolingCost}</div>
                      <div className="text-xs text-gray-400">
                        {((parseFloat(annualTotals.coolingCost) / parseFloat(annualTotals.totalCost)) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800/20 rounded-lg border border-gray-700/30">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-gray-500"></div>
                      <span className="text-gray-300">Fixed Charges</span>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-semibold">${annualTotals.fixedCost}</div>
                      <div className="text-xs text-gray-400">
                        {((parseFloat(annualTotals.fixedCost) / parseFloat(annualTotals.totalCost)) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-gray-700">
                    <div className="text-xs text-gray-400">
                      Your electric rate: <span className="text-white font-semibold">${electricityRate.toFixed(3)}/kWh</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
        
        {/* Tabbed Interface */}
        {!isConnected ? (
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-yellow-200 mb-2">Connect to Joule Bridge</h3>
            <p className="text-yellow-300 mb-4">Connect to Joule Bridge to see your personalized budget calculations based on your Ecobee thermostat settings.</p>
            <p className="text-sm text-yellow-400">The budget will use your actual heating and cooling setpoints from your Ecobee.</p>
          </div>
        ) : monthlyBudget ? (
          <div className="bg-[#151A21] border border-[#222A35] rounded-lg overflow-hidden">
            {/* Tab Navigation */}
            <div className="border-b border-[#222A35] bg-[#1D232C]">
              <div className="flex flex-wrap gap-2 p-2">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    activeTab === "overview"
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-white hover:bg-[#222A35]"
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Monthly Budget
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
                <button
                  onClick={() => setActiveTab("diagnostics")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    activeTab === "diagnostics"
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-white hover:bg-[#222A35]"
                  }`}
                >
                  <Info className="w-4 h-4" />
                  Diagnostics
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
              {activeTab === "overview" && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white">Monthly Budget Breakdown</h2>
                    <button
                      onClick={() => setShowHddCddColumns(!showHddCddColumns)}
                      className="text-xs text-gray-400 hover:text-white px-3 py-1 rounded border border-[#222A35] hover:border-[#333A45] transition-colors"
                    >
                      {showHddCddColumns ? "Hide" : "Show"} Technical Columns
                    </button>
                  </div>
                  <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3 mb-4">
                    <p className="text-sm text-blue-200 mb-2">
                      <strong>How It Works:</strong>
                    </p>
                    <p className="text-xs text-blue-300">
                      This estimate uses your location's typical weather patterns to calculate monthly heating and cooling needs. 
                      The model generates hourly temperatures for a typical year, then calculates energy usage based on your heat pump's efficiency and your building's characteristics. 
                      Costs are based on your electricity rate and include backup heat when needed.
                    </p>
                  </div>
                  <p className="text-sm text-gray-400 mb-4">
                    Location: {userLocation ? `${userLocation.city}, ${userLocation.state}` : "Not set"} • 
                    {" "}Forecasting Mode: <span className="text-blue-300">Average Weather Year</span>
                  </p>
            
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#1D232C]">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-300 font-medium">Month</th>
                          {showHddCddColumns && (
                            <>
                              <th className="px-3 py-2 text-right text-gray-300 font-medium" title="Target Heating Degree Days">HDD Target</th>
                              <th className="px-3 py-2 text-right text-gray-300 font-medium" title="Achieved Heating Degree Days">HDD Actual</th>
                              <th className="px-3 py-2 text-right text-gray-300 font-medium" title="Target Cooling Degree Days">CDD Target</th>
                              <th className="px-3 py-2 text-right text-gray-300 font-medium" title="Achieved Cooling Degree Days">CDD Actual</th>
                            </>
                          )}
                          <th className="px-3 py-2 text-right text-gray-300 font-medium" title="Total heating energy (Heat Pump + Backup)">Heating kWh</th>
                          <th className="px-3 py-2 text-right text-gray-300 font-medium" title="Total cooling energy">Cooling kWh</th>
                          <th className="px-3 py-2 text-right text-gray-300 font-medium" title="Heating cost">Heating $</th>
                          <th className="px-3 py-2 text-right text-gray-300 font-medium" title="Cooling cost">Cooling $</th>
                          <th className="px-3 py-2 text-right text-gray-300 font-medium" title="Fixed monthly service charges">Fixed $</th>
                          <th className="px-3 py-2 text-right text-gray-300 font-medium" title="Total monthly cost">Total</th>
                        </tr>
                      </thead>
                <tbody>
                  {monthlyBudget.map((month, idx) => (
                    <tr 
                      key={month.month} 
                      className={`${idx === currentMonth ? "bg-blue-900/30 border-l-2 border-blue-500" : idx % 2 === 0 ? "bg-[#151A21]" : "bg-[#1A1F27]"}`}
                    >
                          <td className="px-3 py-2 font-medium">
                            <div className="flex items-center gap-2">
                              {idx >= 0 && idx <= 2 && <span className="text-blue-400">❄️</span>}
                              {idx >= 5 && idx <= 7 && <span className="text-yellow-400">☀️</span>}
                              {month.month}
                              {idx === currentMonth && <span className="ml-1 text-xs text-blue-400">←</span>}
                            </div>
                          </td>
                          {showHddCddColumns && (
                            <>
                              <td className="px-3 py-2 text-right text-cyan-300">
                                {Math.round(month.hdd)}
                              </td>
                              <td className="px-3 py-2 text-right text-cyan-400">
                                {Math.round(month.achievedHDD ?? month.hdd)}
                                {month.typicalYearDiagnostics?.hddMatchError !== null && month.typicalYearDiagnostics?.hddMatchError > 0.5 && (
                                  <span className="text-yellow-400 text-xs ml-1 cursor-help" title={`Warning: Heating degree days don't match exactly. Target: ${Math.round(month.hdd).toLocaleString()}, Actual: ${Math.round(month.achievedHDD ?? month.hdd).toLocaleString()} (${month.typicalYearDiagnostics.hddMatchError.toFixed(1)}% difference). This is usually fine - heating costs are calculated from the actual values.`}>⚠️</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right text-red-300">
                                {Math.round(month.cdd)}
                              </td>
                              <td className="px-3 py-2 text-right text-red-400">
                                {Math.round(month.achievedCDD ?? month.cdd)}
                                {month.typicalYearDiagnostics?.cddMatchError !== null && month.typicalYearDiagnostics?.cddMatchError > 0.5 && (
                                  <span className="text-yellow-400 text-xs ml-1 cursor-help" title={`Warning: Cooling degree days don't match exactly. Target: ${Math.round(month.cdd).toLocaleString()}, Actual: ${Math.round(month.achievedCDD ?? month.cdd).toLocaleString()} (${month.typicalYearDiagnostics.cddMatchError.toFixed(1)}% difference). Cooling costs use the target value.`}>⚠️</span>
                                )}
                                {month.typicalYearDiagnostics?.cddMatchError === null && month.cdd > 0 && (
                                  <span className="text-yellow-400 text-xs ml-1 cursor-help" title={`Warning: Unable to generate enough cooling degree days. Target: ${Math.round(month.cdd).toLocaleString()}${month.typicalYearDiagnostics?.unmatchableReason ? ` (${month.typicalYearDiagnostics.unmatchableReason})` : ' (not enough hours above cooling base)'}. Cooling costs still use the target value.`}>⚠️</span>
                                )}
                              </td>
                            </>
                          )}
                          <td className="px-3 py-2 text-right text-blue-300 font-semibold" title={`Heat Pump: ${formatEnergy(month.heatPumpKwh)}, Backup Heat: ${formatEnergy(month.auxKwh)}`}>
                            {formatEnergy(month.heatingKwh)}
                          </td>
                          <td className={`px-3 py-2 text-right ${month.coolingExceedsMax ? 'text-yellow-400 font-semibold' : 'text-orange-400'}`}>
                            {formatEnergy(month.coolingKwh)}
                            {month.coolingExceedsMax && (
                              <span className="text-yellow-400 text-xs ml-1 cursor-help" title={`Warning: Cooling energy (${Math.round(month.coolingKwh)} kWh) exceeds the maximum possible for a ${tons}-ton system running 24/7 (${month.maxPossibleCoolingKwh?.toFixed(0)} kWh). This may indicate the heat gain factor is set too high.`}>⚠️</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-blue-300">${month.heatingCost}</td>
                          <td className={`px-3 py-2 text-right ${month.coolingExceedsMax ? 'text-yellow-400 font-semibold' : 'text-orange-300'}`}>${month.coolingCost}</td>
                          <td className="px-3 py-2 text-right text-gray-400">${month.fixedCost}</td>
                          <td className="px-3 py-2 text-right text-green-400 font-semibold">${month.totalCost}</td>
                    </tr>
                  ))}
                </tbody>
                      {annualTotals && (
                        <tfoot className="bg-[#1E4CFF]/20 border-t border-[#1E4CFF]">
                          <tr>
                            <td className="px-3 py-2 font-bold">Annual</td>
                            {showHddCddColumns && (
                              <>
                                <td className="px-3 py-2 text-right text-cyan-300 font-bold">
                                  {Math.round(annualHDD || 0).toLocaleString()}
                                </td>
                                <td className="px-3 py-2 text-right text-cyan-400 font-bold">
                                  {annualTotals.totalMonthlyHDDAchieved !== undefined
                                    ? Math.round(annualTotals.totalMonthlyHDDAchieved).toLocaleString()
                                    : Math.round(annualTotals.totalMonthlyHDD).toLocaleString()}
                                </td>
                                <td className="px-3 py-2 text-right text-red-300 font-bold">
                                  {Math.round(annualCDD || 0).toLocaleString()}
                                </td>
                                <td className="px-3 py-2 text-right text-red-400 font-bold">
                                  {annualTotals.totalMonthlyCDDAchieved !== undefined
                                    ? Math.round(annualTotals.totalMonthlyCDDAchieved).toLocaleString()
                                    : Math.round(annualTotals.totalMonthlyCDD).toLocaleString()}
                                </td>
                              </>
                            )}
                            <td className="px-3 py-2 text-right text-blue-300 font-bold">{formatEnergy(annualTotals.heatingKwh)}</td>
                            <td className="px-3 py-2 text-right text-orange-400 font-bold">{formatEnergy(annualTotals.coolingKwh)}</td>
                            <td className="px-3 py-2 text-right text-blue-300 font-bold">${annualTotals.heatingCost}</td>
                            <td className="px-3 py-2 text-right text-orange-300 font-bold">${annualTotals.coolingCost}</td>
                            <td className="px-3 py-2 text-right text-gray-400 font-bold">${annualTotals.fixedCost}</td>
                            <td className="px-3 py-2 text-right text-green-400 font-bold text-lg">${annualTotals.totalCost}</td>
                          </tr>
                          <tr>
                            <td colSpan={showHddCddColumns ? "10" : "6"} className="px-3 py-1 text-xs text-gray-500 italic">
                              Annual totals are computed from unrounded hourly sums; monthly rows are rounded, so the sum of months may differ by ~1 kWh / a few cents.
                            </td>
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
                  {(heatGainFactor / (heatLossFactor || 1) > 3.0) && (
                    <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                      <p className="text-yellow-300 text-xs font-semibold mb-1">⚠️ Heat Gain Factor Validation Warning</p>
                      <p className="text-yellow-200 text-xs">
                        Heat gain ({formatHeatLossFactor(heatGainFactor, effectiveUnitSystem)}) is {((heatGainFactor / (heatLossFactor || 1))).toFixed(1)}x higher than heat loss ({formatHeatLossFactor(heatLossFactor, effectiveUnitSystem)}). 
                        This is unusually high - typical ratio is 1.2-2.5x. Check your <strong>solarExposure</strong> setting in Settings. 
                        High heat gain will cause unrealistic cooling cost estimates.
                      </p>
                    </div>
                  )}
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
                          <span className="text-white font-mono">{seer2}</span>
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
                        <div className="flex justify-between">
                          <span className="text-gray-400">Compressor Power:</span>
                          <span className="text-white font-mono">{compressorPower.toFixed(1)} kW</span>
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
                        <div className="flex justify-between">
                          <span className="text-gray-400">Heat Gain Factor:</span>
                          <span className={`font-mono ${heatGainFactor / (heatLossFactor || 1) > 3.0 ? 'text-yellow-400' : 'text-white'}`}>
                            {formatHeatLossFactor(heatGainFactor, effectiveUnitSystem)}
                            {heatGainFactor / (heatLossFactor || 1) > 3.0 && (
                              <span className="text-yellow-400 text-xs ml-1" title="Heat gain is unusually high compared to heat loss. Check solarExposure setting.">⚠️</span>
                            )}
                          </span>
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
                          <span className="text-gray-400">Fixed Monthly Charge:</span>
                          <span className="text-white font-mono">${monthlyFixedCharge.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === "diagnostics" && (
                <div>
                  <h2 className="text-xl font-semibold text-white mb-4">Diagnostics & Validation</h2>
                  {aggregateDiagnostics && annualTotals && balancePoint !== null && (
                    <div className="space-y-4">
                      <div className="bg-[#1A1F27] border border-[#222A35] rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-gray-300 mb-3">Balance Point Analysis</h3>
                        <div className="text-sm space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Backup Heat Activation Temp:</span>
                            <span className="text-white font-mono">{balancePoint.toFixed(1)}°F</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            When outdoor temperature drops below this point, your heat pump output is less than your building's heat loss, requiring backup heat.
                          </p>
                        </div>
                      </div>
                      <div className="bg-[#1A1F27] border border-[#222A35] rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-gray-300 mb-3">Annual Summary</h3>
                        <div className="text-sm space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Total Heating Energy:</span>
                            <span className="text-white">{formatEnergyFromKwh(parseFloat(annualTotals.heatingKwh), effectiveUnitSystem, { decimals: 0 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Heat Pump:</span>
                            <span className="text-white">{formatEnergyFromKwh(parseFloat(annualTotals.heatPumpKwh), effectiveUnitSystem, { decimals: 0 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Backup Heat:</span>
                            <span className="text-white">{formatEnergyFromKwh(parseFloat(annualTotals.auxKwh), effectiveUnitSystem, { decimals: 0 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Backup Heat %:</span>
                            <span className="text-white">
                              {((parseFloat(annualTotals.auxKwh) / parseFloat(annualTotals.heatingKwh)) * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === "technical" && nerdMode && (
                <div>
                  <h2 className="text-xl font-semibold text-white mb-4">Technical Details</h2>
                  <p className="text-sm text-gray-400 mb-4">
                    This section contains detailed technical information about the calculation methodology, formulas, and code implementation.
                  </p>
                  <div className="text-xs text-gray-400 space-y-4">
                    {showFormula ? (
                      <>
                        {/* Overview */}
                        <div className="bg-[#0F1419] rounded p-3 border border-[#222A35]">
                          <p className="text-purple-400 font-semibold mb-2">Overview</p>
                          <div className="mb-2 p-2 bg-blue-900/20 rounded border border-blue-700/30">
                            <p className="text-blue-300 text-xs font-semibold mb-1">Mode: <strong>Typical Year (Budget)</strong></p>
                            <p className="text-gray-300 text-xs">Annual budget uses <strong>synthetic hourly temperatures</strong> generated to match monthly HDD/CDD distributions. Synthetic typical year uses <strong>8760 hours</strong> (standard year). Both heating and cooling use synthetic CDD from the same typical year. Distribution assumptions (diurnal amplitude, noise, min clamp) affect tail temperatures and aux estimates. Heating <em>budget</em> is robust; aux <em>split</em> is more sensitive. Both HP and Aux are computed from the same synthetic weather realization, ensuring they can be properly added.</p>
                            <p className="text-gray-400 text-xs italic mt-1">This represents a "typical" weather year based on long-term climate averages, suitable for annual budget planning. This is not a specific historical year.</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowFormula(false)}
                          className="w-full mb-4 p-2 bg-[#1A1F27] border border-[#222A35] rounded text-sm text-gray-400 hover:text-white transition-colors"
                        >
                          Hide Detailed Formulas
                        </button>
                      </>
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
            <p className="text-gray-400">No budget data available</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetDebug;
