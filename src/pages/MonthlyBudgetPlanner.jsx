

import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Calendar, Thermometer, MapPin, DollarSign, AlertTriangle, Cloud } from 'lucide-react';
import { inputClasses, fullInputClasses, selectClasses } from '../lib/uiClasses';
import { DashboardLink } from '../components/DashboardLink';
import { estimateMonthlyCoolingCostFromCDD, estimateMonthlyHeatingCostFromHDD } from '../lib/budgetUtils';
import { fetchLiveElectricityRate, fetchLiveGasRate, getStateCode } from '../lib/eiaRates';
import { calculateElectricityCO2, calculateGasCO2, formatCO2 } from '../lib/carbonFootprint';
import { getBestEquivalent } from '../lib/co2Equivalents';

// --- State-based electricity rates ($/kWh) ---
const STATE_ELECTRICITY_RATES = {
  'Hawaii': 0.3825, 'California': 0.3011, 'Massachusetts': 0.2674, 'Alaska': 0.2491,
  'Maine': 0.2460, 'Rhode Island': 0.2450, 'Connecticut': 0.2430, 'New York': 0.2413,
  'District of Columbia': 0.2154, 'Vermont': 0.2150, 'New Hampshire': 0.2149, 'New Jersey': 0.2144,
  'Michigan': 0.1786, 'Maryland': 0.1708, 'Pennsylvania': 0.1663, 'Delaware': 0.1655,
  'West Virginia': 0.1555, 'Florida': 0.1530, 'North Carolina': 0.1520, 'South Carolina': 0.1510,
  'Arizona': 0.1490, 'Wisconsin': 0.1480, 'Texas': 0.1460, 'Nevada': 0.1450,
  'Minnesota': 0.1440, 'Tennessee': 0.1430, 'Oregon': 0.1420, 'Virginia': 0.1410,
  'Montana': 0.1400, 'Georgia': 0.1390, 'Indiana': 0.1380, 'Ohio': 0.1370,
  'Missouri': 0.1360, 'Alabama': 0.1350, 'Illinois': 0.1334, 'Colorado': 0.1330,
  'Iowa': 0.1320, 'Kansas': 0.1310, 'Kentucky': 0.1300, 'New Mexico': 0.1290,
  'South Dakota': 0.1280, 'Wyoming': 0.1270, 'Arkansas': 0.1260, 'Mississippi': 0.1250,
  'Utah': 0.1240, 'Nebraska': 0.1230, 'Oklahoma': 0.1220, 'Louisiana': 0.1210,
  'North Dakota': 0.1200, 'Idaho': 0.1190, 'Washington': 0.1180, 'DEFAULT': 0.15
};

// --- State-based natural gas rates ($/therm) ---
const STATE_GAS_RATES = {
  'Alabama': 2.264, 'Alaska': 7.000, 'Arizona': 1.757, 'Arkansas': 2.104,
  'California': 4.372, 'Colorado': 1.400, 'Connecticut': 3.098, 'Delaware': 2.790,
  'District of Columbia': 3.301, 'Florida': 2.577, 'Georgia': 2.934, 'Hawaii': 5.560,
  'Idaho': 1.235, 'Illinois': 1.892, 'Indiana': 2.133, 'Iowa': 1.958, 'Kansas': 1.728,
  'Kentucky': 2.383, 'Louisiana': 1.583, 'Maine': 3.717, 'Maryland': 2.876,
  'Massachusetts': 2.725, 'Michigan': 2.075, 'Minnesota': 1.467, 'Mississippi': 2.017,
  'Missouri': 2.230, 'Montana': 1.149, 'Nebraska': 1.807, 'Nevada': 1.313,
  'New Hampshire': 3.417, 'New Jersey': 2.394, 'New Mexico': 1.168, 'New York': 2.597,
  'North Carolina': 2.471, 'North Dakota': 1.332, 'Ohio': 1.969, 'Oklahoma': 1.516,
  'Oregon': 1.670, 'Pennsylvania': 1.747, 'Rhode Island': 3.012, 'South Carolina': 2.645,
  'South Dakota': 1.911, 'Tennessee': 2.181, 'Texas': 1.371, 'Utah': 1.149,
  'Vermont': 3.544, 'Virginia': 2.423, 'Washington': 1.622, 'West Virginia': 1.680,
  'Wisconsin': 1.554, 'Wyoming': 1.226, 'DEFAULT': 1.20
};

// US State abbreviations to full names for input like "Chicago, IL"
const STATE_NAME_BY_ABBR = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming'
};

const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z]/g, '');

// --- Typical HDD/CDD helpers (moved outside component for rules-of-hooks compliance) ---
function getTypicalHDD(month) {
  const typicalHDD = { 1: 1200, 2: 1000, 10: 200, 11: 500, 12: 1100 };
  return typicalHDD[month] || 800;
}

function getTypicalCDD(month) {
  const typicalCDD = { 5: 100, 6: 250, 7: 450, 8: 400, 9: 250 };
  return typicalCDD[month] || 300;
}

function estimateTypicalHDDCost(params) {
  const hdd = getTypicalHDD(params.month);
  params.setEstimate(estimateMonthlyHeatingCostFromHDD({ ...params, hdd, hspf: params.efficiency }));
}

function estimateTypicalCDDCost(params) {
  const cdd = getTypicalCDD(params.month);
  params.setEstimate(estimateMonthlyCoolingCostFromCDD({ ...params, cdd, seer2: params.efficiency }));
}


const MonthlyBudgetPlanner = () => {
  const outletContext = useOutletContext() || {};
  const { userSettings, setUserSetting } = outletContext;

  // Derive all settings from context for consistency
  const {
    squareFeet = 1500,
    insulationLevel = 1.0,
    homeShape = 1.0,
    ceilingHeight = 8,
    capacity = 36,
    efficiency = 15.0,
    indoorTemp = 70,
    utilityCost = 0.15,
    gasCost = 1.2,
    primarySystem = 'heatPump',
    afue = 0.95,
    energyMode = 'heating',
    solarExposure = 1.0,
    coolingCapacity = 36,
    hspf2 = 9.0,
    useElectricAuxHeat = true,
  } = userSettings || {};

  // Local setters that call the global context setter
  const setUseElectricAuxHeat = (v) => setUserSetting('useElectricAuxHeat', v);

  // Component-specific state
  const [mode, setMode] = useState('budget');
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [locationData, setLocationData] = useState(null);
  const [monthlyEstimate, setMonthlyEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [electricityRateSourceA, setElectricityRateSourceA] = useState('default');
  const [electricityRateSourceB, setElectricityRateSourceB] = useState('default');

  // State for comparison mode
  const [locationDataB, setLocationDataB] = useState(null);
  const [historicalTempsB, setHistoricalTempsB] = useState(null);
  const [monthlyEstimateB, setMonthlyEstimateB] = useState(null);
  const [loadingB, setLoadingB] = useState(false);
  const [errorB, _setErrorB] = useState(null);
  const [cityInputB, setCityInputB] = useState('');
  const [elevationOverrideB, setElevationOverrideB] = useState(null);
    const [searchStatusB, setSearchStatusB] = useState(null);

  // Hybrid rate fetching: Try EIA API first, fall back to hardcoded state averages
  const fetchUtilityRate = useCallback(async (stateName, rateType = 'electricity') => {
    if (!stateName) return { rate: rateType === 'electricity' ? utilityCost : gasCost, source: '⚠️ US National Average' };
    const stateCode = getStateCode(stateName);
    if (!stateCode) {
      console.warn(`Could not find state code for: ${stateName}`);
      return { rate: rateType === 'electricity' ? utilityCost : gasCost, source: '⚠️ US National Average' };
    }
    try {
      const liveData = rateType === 'electricity' ? await fetchLiveElectricityRate(stateCode) : await fetchLiveGasRate(stateCode);
      if (liveData?.rate) return { rate: liveData.rate, source: `✓ Live EIA Data (${liveData.timestamp})` };
    } catch (err) {
      console.warn(`EIA API failed for ${stateName}, using fallback`, err);
    }
    const fallbackTable = rateType === 'electricity' ? STATE_ELECTRICITY_RATES : STATE_GAS_RATES;
    const fallbackRate = fallbackTable[stateName] || fallbackTable['DEFAULT'];
    return { rate: fallbackRate, source: `ⓘ ${stateName} Average (Hardcoded)` };
  }, [utilityCost, gasCost]);

  // Get user's location from localStorage (set during onboarding)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('userLocation');
      if (saved) setLocationData(JSON.parse(saved));
    } catch (e) {
      console.error('Error loading location:', e);
    }
  }, []);

  const heatingMonths = React.useMemo(() => (
    [{ value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }]
  ), []);
  const coolingMonths = React.useMemo(() => (
    [{ value: 5, label: 'May' }, { value: 6, label: 'June' }, { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' }]
  ), []);
  const activeMonths = React.useMemo(() => (energyMode === 'cooling' ? coolingMonths : heatingMonths), [energyMode, heatingMonths, coolingMonths]);

  useEffect(() => {
    if (!activeMonths.some(m => m.value === selectedMonth)) {
      setSelectedMonth(energyMode === 'cooling' ? 7 : 1);
    }
  }, [energyMode, selectedMonth, activeMonths]);

  const calculateMonthlyEstimate = useCallback((temps, setEstimate, electricityRate) => {
    const commonParams = { squareFeet, insulationLevel, homeShape, ceilingHeight, efficiency, solarExposure };
    if (!temps || temps.length === 0) {
      if (energyMode === 'cooling') {
        estimateTypicalCDDCost({ ...commonParams, month: selectedMonth, setEstimate, capacity, electricityRate });
      } else {
        estimateTypicalHDDCost({ ...commonParams, month: selectedMonth, setEstimate, electricityRate });
      }
      return;
    }

    if (energyMode === 'cooling') {
      const coolingCapacityKbtu = primarySystem === 'heatPump' ? capacity : coolingCapacity;
      const seer2 = efficiency;
      const tonsMap = { 18: 1.5, 24: 2.0, 30: 2.5, 36: 3.0, 42: 3.5, 48: 4.0, 60: 5.0 };
      const tons = tonsMap[coolingCapacityKbtu] || tonsMap[capacity] || 3.0;
      const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
      const designHeatGain = squareFeet * 28.0 * insulationLevel * homeShape * ceilingMultiplier * solarExposure;
      const btuGainPerDegF = designHeatGain / 20.0;
      let totalCost = 0, totalEnergyKWh = 0, unmetHours = 0;

      temps.forEach(day => {
        const tempDiff = Math.max(0, day.avg - indoorTemp);
        if (tempDiff <= 0) return;
        const totalDailyHeatGainBtu = btuGainPerDegF * tempDiff * 24;
        const dailyKWh = totalDailyHeatGainBtu / (seer2 * 1000);
        const systemDailyCapacityBtu = (tons * 12000) * 24;
        if (totalDailyHeatGainBtu > systemDailyCapacityBtu) unmetHours += 24;
        const maxDailyKwh = (systemDailyCapacityBtu / (seer2 * 1000));
        const actualDailyKwh = Math.min(dailyKWh, maxDailyKwh);
        totalEnergyKWh += actualDailyKwh;
        totalCost += actualDailyKwh * electricityRate;
      });

      setEstimate({
        cost: totalCost, energy: totalEnergyKWh, days: temps.length,
        avgDailyTemp: temps.reduce((s, t) => s + t.avg, 0) / temps.length,
        electricityRate, method: 'cooling', unmetHours: Math.round(unmetHours),
        seer2, tons, solarExposure,
      });
      return;
    }

    if (primarySystem === 'gasFurnace') {
      const eff = Math.min(0.99, Math.max(0.6, afue));
      const btuPerTherm = 100000;
      const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
      const estimatedDesignHeatLoss = squareFeet * 22.67 * insulationLevel * homeShape * ceilingMultiplier;
      const btuLossPerDegF = estimatedDesignHeatLoss / 70;
      let totalTherms = 0, totalCost = 0;
      temps.forEach(day => {
        const tempDiff = Math.max(0, indoorTemp - day.avg);
        const buildingHeatLossBtu = btuLossPerDegF * tempDiff;
        const thermsPerDay = (buildingHeatLossBtu * 24) / (btuPerTherm * eff);
        totalTherms += thermsPerDay;
        totalCost += thermsPerDay * gasCost;
      });
      setEstimate({
        cost: totalCost, therms: totalTherms, days: temps.length,
        avgDailyTemp: temps.reduce((s, t) => s + t.avg, 0) / temps.length,
        gasCost, method: 'gasFurnace',
      });
      return;
    }

    // Heat pump heating path
    const tonsMap = { 18: 1.5, 24: 2.0, 30: 2.5, 36: 3.0, 42: 3.5, 48: 4.0, 60: 5.0 };
    const tons = tonsMap[capacity] || 3.0;
    const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
    const estimatedDesignHeatLoss = squareFeet * 22.67 * insulationLevel * homeShape * ceilingMultiplier;
    const btuLossPerDegF = estimatedDesignHeatLoss / 70;
    let totalCost = 0, totalEnergy = 0, excludedAuxEnergy = 0;

    temps.forEach(day => {
      const tempDiff = Math.max(0, indoorTemp - day.avg);
      const buildingHeatLoss = btuLossPerDegF * tempDiff;
      const capFactor = Math.max(0.3, 1 - (Math.abs(0 - day.avg) / 100) * 0.5);
      const thermalOutput = tons * 12000 * capFactor;
      const compressorDelivered = Math.min(thermalOutput, buildingHeatLoss);
      const auxHeatBtu = Math.max(0, buildingHeatLoss - compressorDelivered);
      const compressorEnergyPerHour = compressorDelivered / ((hspf2 || efficiency) * 1000);
      const auxHeatEnergyPerHour = auxHeatBtu / 3412.14;
      const effectiveAuxEnergyPerHour = useElectricAuxHeat ? auxHeatEnergyPerHour : 0;
      const totalDayEnergy = (compressorEnergyPerHour + effectiveAuxEnergyPerHour) * 24;
      totalCost += totalDayEnergy * electricityRate;
      totalEnergy += totalDayEnergy;
      if (!useElectricAuxHeat && auxHeatEnergyPerHour > 0) excludedAuxEnergy += auxHeatEnergyPerHour * 24;
    });

    setEstimate({
      cost: totalCost, energy: totalEnergy, days: temps.length,
      avgDailyTemp: temps.reduce((s, t) => s + t.avg, 0) / temps.length,
      electricityRate, method: 'heatPumpHeating', excludedAuxEnergy,
    });
  }, [squareFeet, insulationLevel, homeShape, ceilingHeight, efficiency, solarExposure, energyMode, selectedMonth, capacity, primarySystem, coolingCapacity, indoorTemp, afue, gasCost, hspf2, useElectricAuxHeat]);

  const fetchHistoricalData = useCallback(async (locData, setEstimate, setLoadingState, setErrorState, elevationFtOverride) => {
    if (!locData?.latitude || !locData?.longitude) {
      setErrorState('Location not set. Please set your location in the Forecaster first.');
      return;
    }
    setLoadingState(true);
    setErrorState(null);
    try {
      const response = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${locData.latitude}&longitude=${locData.longitude}&start_date=2020-${String(selectedMonth).padStart(2, '0')}-01&end_date=2020-${String(selectedMonth).padStart(2, '0')}-${new Date(2020, selectedMonth, 0).getDate()}&daily=temperature_2m_max,temperature_2m_min&timezone=auto&temperature_unit=fahrenheit`);
      if (!response.ok) throw new Error('Failed to fetch historical data');
      const data = await response.json();
      const stationElevFt = locData.elevation ?? elevationFtOverride ?? 0;
      const homeElevFt = elevationFtOverride ?? stationElevFt;
      const deltaF = (homeElevFt - stationElevFt) * (-3.5 / 1000);
      const temps = data.daily.time.map((date, idx) => {
        const high = data.daily.temperature_2m_max[idx] + deltaF;
        const low = data.daily.temperature_2m_min[idx] + deltaF;
        return { date, high, low, avg: (high + low) / 2 };
      });

      if (setEstimate === setMonthlyEstimateB) setHistoricalTempsB(temps);

      const isLocationA = setEstimate === setMonthlyEstimate;
      const rateResult = await fetchUtilityRate(locData.state, 'electricity');
      if (isLocationA) setElectricityRateSourceA(rateResult.source);
      else setElectricityRateSourceB(rateResult.source);
      calculateMonthlyEstimate(temps, setEstimate, rateResult.rate);
    } catch (error) {
      console.warn('Error fetching historical data', error);
      setErrorState('Could not fetch historical climate data. Using typical estimates.');
      const isLocationA = setEstimate === setMonthlyEstimate;
      const rateResult = await fetchUtilityRate(locData?.state, 'electricity');
      if (isLocationA) setElectricityRateSourceA(rateResult.source);
      else setElectricityRateSourceB(rateResult.source);
      const commonParams = { squareFeet, insulationLevel, homeShape, ceilingHeight, efficiency, solarExposure, electricityRate: rateResult.rate };
      if (energyMode === 'cooling') {
        estimateTypicalCDDCost({ ...commonParams, month: selectedMonth, setEstimate, capacity });
      } else {
        estimateTypicalHDDCost({ ...commonParams, month: selectedMonth, setEstimate });
      }
    } finally {
      setLoadingState(false);
    }
  }, [selectedMonth, fetchUtilityRate, calculateMonthlyEstimate, squareFeet, insulationLevel, homeShape, ceilingHeight, efficiency, solarExposure, energyMode, capacity]);

  // Auto-fetch for Location A
  useEffect(() => {
    if (locationData?.latitude && locationData?.longitude) {
      fetchHistoricalData(locationData, setMonthlyEstimate, setLoading, setError);
    }
  }, [locationData, fetchHistoricalData, selectedMonth, indoorTemp, utilityCost, gasCost, primarySystem, afue, capacity, efficiency]);

  // Auto-fetch for Location B
  useEffect(() => {
    if (mode === 'comparison' && locationDataB?.latitude && locationDataB?.longitude) {
      fetchHistoricalData(locationDataB, setMonthlyEstimateB, setLoadingB, setError, elevationOverrideB);
    }
  }, [mode, locationDataB, elevationOverrideB, fetchHistoricalData, selectedMonth, indoorTemp, utilityCost, gasCost, primarySystem, afue, capacity, efficiency]);

  // Handle City B search
  const handleCitySearchB = async () => {
    const raw = cityInputB.trim();
    if (!raw) return;
    setLoadingB(true);
    setSearchStatusB(null);
    try {
      // Split into city and optional state term
      let cityTerm = raw;
      let stateTerm = '';
      if (raw.includes(',')) {
        const [c, s] = raw.split(',');
        cityTerm = (c || '').trim();
        stateTerm = (s || '').trim();
      }

      const resp = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityTerm)}&count=10&language=en&format=json`);
      const data = await resp.json();
      let results = Array.isArray(data.results) ? data.results : [];

      // Prefer US results
      results = results.filter(r => r.country_code === 'US');

      // If a state was provided, try to match it (supports "IL" or "Illinois")
      if (stateTerm && results.length) {
        const stateNorm = normalize(stateTerm);
        const expanded = STATE_NAME_BY_ABBR[stateTerm.toUpperCase()];
        const expandedNorm = expanded ? normalize(expanded) : '';
        const filtered = results.filter(r => {
          const adminNorm = normalize(r.admin1 || '');
          return adminNorm.includes(stateNorm) || (expandedNorm && adminNorm.includes(expandedNorm));
        });
        if (filtered.length) results = filtered;
      }

      if (!results.length) {
        setLocationDataB(null);
        setSearchStatusB({ type: 'error', message: `Could not find "${raw}". Try a different spelling or include the state.` });
        return;
      }

      const pick = results[0];
      const elevationFeet = Number.isFinite(pick.elevation) ? Math.round(pick.elevation * 3.28084) : 0;
      const newLoc = { city: pick.name, state: pick.admin1 || '', latitude: pick.latitude, longitude: pick.longitude, elevation: elevationFeet };
      setLocationDataB(newLoc);
      setElevationOverrideB(elevationFeet);
      setSearchStatusB({ type: 'success', message: `✓ Found ${newLoc.city}, ${newLoc.state || 'USA'}` });
    } catch (err) {
      console.error(err);
      setSearchStatusB({ type: 'error', message: 'Search failed. Please check your connection and try again.' });
    } finally {
      setLoadingB(false);
    }
  };

 // Simulate cost at a specific indoor temperature (for equivalency calc)
  const simulateCostAtTemp = (temps, targetIndoorTemp, electricityRate = utilityCost) => {
    if (!temps || temps.length === 0) return null;

    // --- Gas Furnace Calculation ---
    if (primarySystem === 'gasFurnace') {
      const eff = Math.min(0.99, Math.max(0.6, afue));
      const btuPerTherm = 100000;
      const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
      const estimatedDesignHeatLoss = squareFeet * 22.67 * insulationLevel * homeShape * ceilingMultiplier;
      const btuLossPerDegF = estimatedDesignHeatLoss / 70;

      let totalCost = 0;
      temps.forEach(day => {
        const outdoorTemp = day.avg;
        const tempDiff = Math.max(0, targetIndoorTemp - outdoorTemp);
        const buildingHeatLossBtu = btuLossPerDegF * tempDiff;
        const thermsPerDay = (buildingHeatLossBtu * 24) / (btuPerTherm * eff);
        totalCost += thermsPerDay * gasCost;
      });
      return totalCost;
    }

    // --- Heat Pump Calculation (Covers both Heating and Cooling) ---
    let totalCost = 0;
    
    // Heating Logic
    if (energyMode === 'heating') {
      const tonsMap = { 18: 1.5, 24: 2.0, 30: 2.5, 36: 3.0, 42: 3.5, 48: 4.0, 60: 5.0 };
      const tons = tonsMap[capacity] || 3.0;
      const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
      const estimatedDesignHeatLoss = squareFeet * 22.67 * insulationLevel * homeShape * ceilingMultiplier;
      const btuLossPerDegF = estimatedDesignHeatLoss / 70;
      const baseHspf = hspf2 || efficiency;

      temps.forEach(day => {
        const outdoorTemp = day.avg;
        const tempDiff = Math.max(0, targetIndoorTemp - outdoorTemp);
        if (tempDiff <= 0) return; // No heating needed

        const buildingHeatLoss = btuLossPerDegF * tempDiff;
        const capFactor = Math.max(0.3, 1 - (Math.abs(0 - outdoorTemp) / 100) * 0.5);
        const thermalOutput = tons * 12000 * capFactor;
        const compressorDelivered = Math.min(thermalOutput, buildingHeatLoss);
        const auxHeatBtu = Math.max(0, buildingHeatLoss - compressorDelivered);

        const compressorEnergyPerHour = compressorDelivered / (baseHspf * 1000);
        const auxHeatEnergyPerHour = auxHeatBtu / 3412.14;
        const effectiveAuxEnergyPerHour = useElectricAuxHeat ? auxHeatEnergyPerHour : 0;
        const totalDayEnergy = (compressorEnergyPerHour + effectiveAuxEnergyPerHour) * 24;
        totalCost += totalDayEnergy * electricityRate;
      });
    } 
    // Cooling Logic
    else {
      const coolingCapacityKbtu = capacity;
      const seer2 = efficiency;
      const tonsMap = { 18: 1.5, 24: 2.0, 30: 2.5, 36: 3.0, 42: 3.5, 48: 4.0, 60: 5.0 };
      const tons = tonsMap[coolingCapacityKbtu] || 3.0;
      const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
      const designHeatGain = squareFeet * 28.0 * insulationLevel * homeShape * ceilingMultiplier * solarExposure;
      const btuGainPerDegF = designHeatGain / 20.0;

      temps.forEach(day => {
        const outdoorTemp = day.avg;
        const tempDiff = Math.max(0, outdoorTemp - targetIndoorTemp);
        if (tempDiff <= 0) return; // No cooling needed

        const totalDailyHeatGainBtu = btuGainPerDegF * tempDiff * 24;
        const dailyKWh = totalDailyHeatGainBtu / (seer2 * 1000);
        const systemDailyCapacityBtu = (tons * 12000) * 24;
        const maxDailyKwh = systemDailyCapacityBtu / (seer2 * 1000);
        const actualDailyKwh = Math.min(dailyKWh, maxDailyKwh);
        totalCost += actualDailyKwh * electricityRate;
      });
    }

    return totalCost;
  };

  // The calculateThermostatEquivalency function that uses the above simulation
  const calculateThermostatEquivalency = () => {
    if (!monthlyEstimate || !monthlyEstimateB || !historicalTempsB) return null;

    const targetCost = monthlyEstimate.cost;
    const cityBElectricityRate = monthlyEstimateB.electricityRate || utilityCost;

    let bestTemp = indoorTemp;
    let bestDiff = Infinity;

    // Iterate through a range of temperatures to find the closest cost match
    for (let temp = 60; temp <= 78; temp++) {
      const testCost = simulateCostAtTemp(historicalTempsB, temp, cityBElectricityRate);
      if (testCost === null) continue;
      
      const diff = Math.abs(testCost - targetCost);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestTemp = temp;
      }
    }
    return bestTemp;
  };

  // Compute a thermostat equivalency to display in the comparison card
  const thermostatEquivalency = calculateThermostatEquivalency();
  
 return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <DashboardLink />
      
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Monthly Budget Planner</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Estimate your typical {energyMode === 'cooling' ? 'cooling' : 'heating'} bill for any month using 30-year historical climate data</p>
      </div>

        {/* Mode Toggle */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-lg border-2 border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 p-1">
            <button
              onClick={() => setMode('budget')}
              className={`px-6 py-2 rounded-md font-semibold transition-all ${mode === 'budget'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
              👤 My Budget
            </button>
            <button
              onClick={() => setMode('comparison')}
              className={`px-6 py-2 rounded-md font-semibold transition-all ${mode === 'comparison'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
              🏙️ City Comparison
            </button>
          </div>
        </div>

        {/* Location Status */}
        {mode === 'budget' ? (
          // Single location for budget mode
          locationData ? (
            <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <MapPin size={18} />
                <span className="font-semibold">{locationData.city}, {locationData.state}</span>
                <span className="text-sm text-blue-600 dark:text-blue-400">({locationData.latitude.toFixed(2)}°, {locationData.longitude.toFixed(2)}°)</span>
              </div>
              {typeof monthlyEstimate?.electricityRate === 'number' && (
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  <div className="font-medium">
                    Electricity rate: ${monthlyEstimate.electricityRate.toFixed(3)}/kWh
                  </div>
                  {electricityRateSourceA && (
                    <div className="text-xs opacity-80 mt-0.5">
                      {electricityRateSourceA}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                <AlertTriangle size={18} />
                <span>Please set your location in the <Link to="/cost-forecaster" className="font-semibold underline hover:text-yellow-800 dark:hover:text-yellow-200">7-Day Forecaster</Link> first to use this tool.</span>
              </div>
            </div>
          )
        ) : (
          // Two-city comparison mode
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Location A */}
            <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">LOCATION A</div>
              {locationData ? (
                <>
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <MapPin size={16} />
                    <span className="font-semibold">{locationData.city}, {locationData.state}</span>
                  </div>
                  {typeof locationData.elevation === 'number' && (
                    <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5 opacity-90">
                      Elevation: ~{Math.round(locationData.elevation)} ft
                    </div>
                  )}
                  {typeof monthlyEstimate?.electricityRate === 'number' && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      <div>${monthlyEstimate.electricityRate.toFixed(3)}/kWh {locationData.state && `(${locationData.state})`}</div>
                      {electricityRateSourceA && (
                        <div className="text-[10px] opacity-75 mt-0.5">{electricityRateSourceA}</div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-yellow-700 dark:text-yellow-300 text-sm">
                  Set location in <Link to="/cost-forecaster" className="underline">Forecaster</Link>
                </div>
              )}
            </div>

            {/* Location B */}
            <div className="bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg p-4">
              <div className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">LOCATION B</div>
              {locationDataB ? (
                <>
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <MapPin size={16} />
                    <span className="font-semibold">{locationDataB.city}, {locationDataB.state}</span>
                    <button
                      onClick={() => setLocationDataB(null)}
                      className="ml-auto text-xs underline hover:text-green-900 dark:hover:text-green-100"
                    >
                      Change
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
                    <div className="text-[11px] text-green-700 dark:text-green-300">
                      Station Elevation: ~{Math.round(locationDataB.elevation ?? 0)} ft
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-green-700 dark:text-green-300 whitespace-nowrap">Home Elevation:</label>
                      <input
                        type="number"
                        value={elevationOverrideB ?? ''}
                        onChange={(e) => setElevationOverrideB(e.target.value === '' ? null : Number(e.target.value))}
                        className={inputClasses}
                        placeholder={`${Math.round(locationDataB.elevation ?? 0)}`}
                      />
                      <span className="text-[11px] text-green-700 dark:text-green-300">ft</span>
                    </div>
                    <div className="sm:col-span-2 text-[10px] text-green-700/80 dark:text-green-300/80">
                      Applies standard lapse rate ≈ 3.5°F per 1000 ft to outdoor temps
                    </div>
                  </div>
                  {typeof monthlyEstimateB?.electricityRate === 'number' && (
                    <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                      <div>${monthlyEstimateB.electricityRate.toFixed(3)}/kWh {locationDataB.state && `(${locationDataB.state})`}</div>
                      {electricityRateSourceB && (
                        <div className="text-[10px] opacity-75 mt-0.5">{electricityRateSourceB}</div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={cityInputB}
                      onChange={(e) => setCityInputB(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCitySearchB()}
                      placeholder="Enter city (e.g., Chicago, IL)"
                      className={fullInputClasses}
                    />
                    <button
                      onClick={handleCitySearchB}
                      disabled={loadingB}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
                    >
                      {loadingB ? '...' : 'Search'}
                    </button>
                  </div>
                  {errorB && (
                    <div className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                      <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                      <span>{errorB}</span>
                    </div>
                  )}
                </div>
                )}
                {!locationDataB && searchStatusB && (
                  <div className={`mt-2 text-xs p-2 rounded ${
                    searchStatusB.type === 'success' 
                      ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700' 
                      : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'
                  }`}>
                    {searchStatusB.message}
                  </div>
              )}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="mb-8">
          {/* Month Selector */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border dark:border-gray-700 mb-6">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              <Calendar className="inline mr-2" size={18} />
              Select Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className={selectClasses}
            >
              {activeMonths.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          {/* Thermostat Settings Panel */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 rounded-2xl shadow-lg p-8 border-4 border-purple-300 dark:border-purple-700">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-purple-800 dark:text-purple-200 mb-2">🌡️ Thermostat Settings</h2>
              <p className="text-purple-600 dark:text-purple-400">Set your preferred temperature schedule for this month</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Winter Settings - Show for heating months */}
              {energyMode === 'heating' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-700">
                  <h3 className="font-semibold text-blue-700 dark:text-blue-300 mb-4 flex items-center gap-2">
                    <Thermometer size={18} />
                    Winter Heating Schedule
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Daytime Setting (6am-10pm)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="60"
                          max="78"
                          value={userSettings?.winterThermostatDay ?? 70}
                          onChange={(e) => setUserSetting?.('winterThermostatDay', Number(e.target.value))}
                          className="flex-grow"
                        />
                        <span className="font-bold text-xl text-blue-600 dark:text-blue-400 w-14 text-right">
                          {userSettings?.winterThermostatDay ?? 70}°F
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Nighttime Setting (10pm-6am)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="60"
                          max="78"
                          value={userSettings?.winterThermostatNight ?? 65}
                          onChange={(e) => setUserSetting?.('winterThermostatNight', Number(e.target.value))}
                          className="flex-grow"
                        />
                        <span className="font-bold text-xl text-blue-600 dark:text-blue-400 w-14 text-right">
                          {userSettings?.winterThermostatNight ?? 65}°F
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                      💡 Night setback can save 10-15% on heating costs
                    </p>
                  </div>
                </div>
              )}

              {/* Summer Settings - Show for cooling months */}
              {energyMode === 'cooling' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-cyan-200 dark:border-cyan-700">
                  <h3 className="font-semibold text-cyan-700 dark:text-cyan-300 mb-4 flex items-center gap-2">
                    <Thermometer size={18} />
                    Summer Cooling Schedule
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Daytime Setting (6am-10pm)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="68"
                          max="80"
                          value={userSettings?.summerThermostat ?? 74}
                          onChange={(e) => setUserSetting?.('summerThermostat', Number(e.target.value))}
                          className="flex-grow"
                        />
                        <span className="font-bold text-xl text-cyan-600 dark:text-cyan-400 w-14 text-right">
                          {userSettings?.summerThermostat ?? 74}°F
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Nighttime Setting (10pm-6am)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="68"
                          max="82"
                          value={userSettings?.summerThermostatNight ?? userSettings?.summerThermostat ?? 76}
                          onChange={(e) => setUserSetting?.('summerThermostatNight', Number(e.target.value))}
                          className="flex-grow"
                        />
                        <span className="font-bold text-xl text-cyan-600 dark:text-cyan-400 w-14 text-right">
                          {userSettings?.summerThermostatNight ?? userSettings?.summerThermostat ?? 76}°F
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                      💡 Night setback can reduce cooling costs by 8-12%
                    </p>
                  </div>
                </div>
              )}

              {/* Aux Heat Toggle - Show for heat pumps */}
              {primarySystem === 'heatPump' && energyMode === 'heating' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-amber-200 dark:border-amber-700">
                  <h3 className="font-semibold text-amber-700 dark:text-amber-300 mb-4 flex items-center gap-2">
                    <Thermometer size={18} />
                    Auxiliary Heat Settings
                  </h3>
                  <div className="space-y-3">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={!!useElectricAuxHeat}
                        onChange={(e) => setUseElectricAuxHeat(!!e.target.checked)}
                        aria-label="Include electric auxiliary resistance heat in monthly energy and cost estimates"
                        title="When enabled, electric auxiliary resistance backup heat will be counted toward monthly electricity and cost estimates"
                      />
                      <span className="font-medium">Count electric auxiliary heat in estimates</span>
                    </label>
                    {!useElectricAuxHeat && (
                      <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/30 rounded border border-amber-200 dark:border-amber-700 text-xs">
                        <p className="text-amber-700 dark:text-amber-300">
                          <strong>⚠️ Aux heat disabled:</strong> Minimum achievable indoor temp is approximately{' '}
                          <strong>
                            {(() => {
                              // Estimate minimum indoor temp based on heat pump capacity vs building heat loss
                              const tonsMap = { 18: 1.5, 24: 2.0, 30: 2.5, 36: 3.0, 42: 3.5, 48: 4.0, 60: 5.0 };
                              const tons = tonsMap[capacity] || 3.0;
                              const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
                              const designHeatLoss = squareFeet * 22.67 * insulationLevel * homeShape * ceilingMultiplier;
                              const heatLossPerDegF = designHeatLoss / 70;
                              
                              // At 5°F outdoor, heat pump provides ~40% capacity (typical cold climate HP)
                              const outdoorTemp = 5;
                              const heatPumpCapacityAt5F = tons * 12000 * 0.4; // BTU/hr
                              
                              // Find indoor temp where heat loss equals heat pump output
                              const minIndoorTemp = outdoorTemp + (heatPumpCapacityAt5F / heatLossPerDegF);
                              
                              return Math.round(Math.min(indoorTemp, Math.max(40, minIndoorTemp)));
                            })()}°F
                          </strong>
                          {' '}at design conditions (5°F outdoor). Below this, the heat pump cannot maintain your setpoint without supplemental heat.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Result Card */}
        {mode === 'budget' && monthlyEstimate && (
          <div className={`bg-gradient-to-br rounded-2xl shadow-lg p-8 mb-8 border-4 ${energyMode === 'cooling' ? 'from-cyan-50 to-blue-50 dark:from-cyan-900 dark:to-blue-900 border-cyan-300 dark:border-cyan-700' : 'from-green-50 to-emerald-50 dark:from-green-900 dark:to-emerald-900 border-green-300 dark:border-green-700'}`}>
            <div className="text-center">
              <p className={`text-sm font-semibold mb-2 ${energyMode === 'cooling' ? 'text-cyan-700 dark:text-cyan-300' : 'text-green-700 dark:text-green-300'}`}>ESTIMATED MONTHLY {energyMode === 'cooling' ? 'COOLING' : 'HEATING'} COST</p>
              <div className={`text-6xl md:text-7xl font-black mb-4 ${energyMode === 'cooling' ? 'text-cyan-600 dark:text-cyan-400' : 'text-green-600 dark:text-green-400'}`}>
                ${monthlyEstimate.cost.toFixed(2)}
              </div>
              {/* Expose method for testing */}
              <span data-testid="monthly-method" data-method={monthlyEstimate.method} className="sr-only">{monthlyEstimate.method}</span>
              <p className={`text-lg mb-4 ${energyMode === 'cooling' ? 'text-cyan-700 dark:text-cyan-300' : 'text-green-700 dark:text-green-300'}`}>
                Typical {activeMonths.find(m => m.value === selectedMonth)?.label} bill for <strong>{indoorTemp}°F</strong>
                {monthlyEstimate.method === 'gasFurnace' && (
                  <span className="block text-sm mt-1">(Gas Furnace at {Math.round(afue * 100)}% AFUE)</span>
                )}
                {monthlyEstimate.method === 'cooling' && (
                  <span className="block text-sm mt-1">(Cooling: {monthlyEstimate.seer2} SEER2, {monthlyEstimate.tons} tons)</span>
                )}
              </p>
              <div className="grid grid-cols-2 gap-4 text-center text-sm">
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3">
                  <p className={`font-semibold ${energyMode === 'cooling' ? 'text-cyan-700 dark:text-cyan-300' : 'text-green-700 dark:text-green-300'}`}>
                    {monthlyEstimate.method === 'gasFurnace'
                      ? `${monthlyEstimate.therms?.toFixed(1) ?? '0.0'} therms`
                      : `${monthlyEstimate.energy?.toFixed(0) ?? '0'} kWh`
                    }
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Typical Monthly Energy</p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3">
                  <p className={`font-semibold ${energyMode === 'cooling' ? 'text-cyan-700 dark:text-cyan-300' : 'text-green-700 dark:text-green-300'}`}>${(monthlyEstimate.cost / monthlyEstimate.days).toFixed(2)}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Average Daily Cost</p>
                </div>
              </div>
              {/* CO2 Footprint */}
              <div className="mt-4 bg-white/60 dark:bg-gray-800/60 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Estimated CO2 Footprint</p>
                <p className={`font-semibold ${energyMode === 'cooling' ? 'text-cyan-700 dark:text-cyan-300' : 'text-green-700 dark:text-green-300'}`}>
                  {(() => {
                    const co2Lbs = monthlyEstimate.method === 'gasFurnace'
                      ? calculateGasCO2(monthlyEstimate.therms ?? 0).lbs
                      : calculateElectricityCO2(monthlyEstimate.energy ?? 0, locationData?.state).lbs;
                    const equivalent = getBestEquivalent(co2Lbs);
                    let co2Display = 'N/A';
                    if (Number.isFinite(co2Lbs)) {
                      co2Display = co2Lbs >= 1 ? formatCO2(co2Lbs) : '< 1 lb';
                    }
                    return (
                      <>
                        {co2Display}
                        {co2Lbs > 10 && (
                          <span className="block text-[11px] text-gray-500 dark:text-gray-400 mt-1 font-normal">
                            ≈ {equivalent.text}
                          </span>
                        )}
                      </>
                    );
                  })()}
                </p>
              </div>
              {monthlyEstimate.excludedAuxEnergy > 0 && (
                <div className="mt-4 bg-yellow-50 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-200">
                  <p><strong>Note:</strong> This estimate <em>excludes</em> electric auxiliary heat ({monthlyEstimate.excludedAuxEnergy.toFixed(0)} kWh) because you have turned off 'Count electric auxiliary heat'.</p>
                </div>
              )}
              {typeof monthlyEstimate.energy === 'number' && monthlyEstimate.energy < 300 && [1, 2, 12].includes(selectedMonth) && energyMode === 'heating' && (
                <div className="mt-6 bg-yellow-50 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4 text-sm text-yellow-800 dark:text-yellow-200">
                  <p><strong>Heads up:</strong> This looks unusually low for a {activeMonths.find(m => m.value === selectedMonth)?.label} heating month. Double‑check your home inputs and electricity rate.</p>
                </div>
              )}
              {typeof monthlyEstimate.unmetHours === 'number' && monthlyEstimate.unmetHours > 0 && energyMode === 'cooling' && (
                <div className="mt-6 bg-orange-50 dark:bg-orange-900 border border-orange-300 dark:border-orange-700 rounded-lg p-4 text-sm text-orange-800 dark:text-orange-200">
                  <p><strong>Notice:</strong> Estimated {monthlyEstimate.unmetHours} unmet hours this month. Your system may struggle to maintain {indoorTemp}°F.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Annual Budget Planner */}
        {mode === 'budget' && locationData && (
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 rounded-2xl shadow-lg p-8 mb-8 border-4 border-indigo-300 dark:border-indigo-700">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-indigo-800 dark:text-indigo-200 mb-2">📅 Annual Budget Planner</h2>
              <p className="text-indigo-600 dark:text-indigo-400">Estimate your total yearly heating & cooling costs with custom day/night settings</p>
            </div>

            {/* Annual Thermostat Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Winter Settings */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-700">
                <h3 className="font-semibold text-blue-700 dark:text-blue-300 mb-4 flex items-center gap-2">
                  <Thermometer size={18} />
                  Winter Heating (Dec-Feb)
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Daytime Setting (6am-10pm)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="60"
                        max="78"
                        value={userSettings?.winterThermostatDay ?? 70}
                        onChange={(e) => setUserSetting?.('winterThermostatDay', Number(e.target.value))}
                        className="flex-grow"
                      />
                      <span className="font-bold text-2xl text-blue-600 dark:text-blue-400 w-16 text-right">
                        {userSettings?.winterThermostatDay ?? 70}°F
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Nighttime Setting (10pm-6am)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="60"
                        max="78"
                        value={userSettings?.winterThermostatNight ?? 65}
                        onChange={(e) => setUserSetting?.('winterThermostatNight', Number(e.target.value))}
                        className="flex-grow"
                      />
                      <span className="font-bold text-2xl text-blue-600 dark:text-blue-400 w-16 text-right">
                        {userSettings?.winterThermostatNight ?? 65}°F
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summer Settings */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-cyan-200 dark:border-cyan-700">
                <h3 className="font-semibold text-cyan-700 dark:text-cyan-300 mb-4 flex items-center gap-2">
                  <Thermometer size={18} />
                  Summer Cooling (Jun-Aug)
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Daytime Setting (6am-10pm)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="68"
                        max="80"
                        value={userSettings?.summerThermostat ?? 74}
                        onChange={(e) => setUserSetting?.('summerThermostat', Number(e.target.value))}
                        className="flex-grow"
                      />
                      <span className="font-bold text-2xl text-cyan-600 dark:text-cyan-400 w-16 text-right">
                        {userSettings?.summerThermostat ?? 74}°F
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Nighttime Setting (10pm-6am)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="68"
                        max="82"
                        value={userSettings?.summerThermostatNight ?? userSettings?.summerThermostat ?? 76}
                        onChange={(e) => setUserSetting?.('summerThermostatNight', Number(e.target.value))}
                        className="flex-grow"
                      />
                      <span className="font-bold text-2xl text-cyan-600 dark:text-cyan-400 w-16 text-right">
                        {userSettings?.summerThermostatNight ?? userSettings?.summerThermostat ?? 76}°F
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                    Setting nighttime temp higher than daytime can save energy while you sleep
                  </p>
                </div>
              </div>
            </div>

            {/* Annual Cost Estimate */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-indigo-200 dark:border-indigo-700">
              <h3 className="font-semibold text-indigo-700 dark:text-indigo-300 mb-4 text-center">Estimated Annual HVAC Cost</h3>
              <div className="text-center">
                <div className="text-5xl font-black text-indigo-600 dark:text-indigo-400 mb-4">
                  ${(() => {
                    // Calculate approximate annual cost
                    // Winter: 4 months at weighted avg of day/night temps
                    // Summer: 3 months at summer setting
                    // Shoulder seasons: minimal cost (not calculated for simplicity)
                    const winterDay = userSettings?.winterThermostatDay ?? 70;
                    const winterNight = userSettings?.winterThermostatNight ?? 65;
                    const summerTemp = userSettings?.summerThermostat ?? 74;
                    
                    // Weighted average for winter (16 hours day, 8 hours night)
                    const winterAvgTemp = (winterDay * 16 + winterNight * 8) / 24;
                    
                    // Rough monthly estimate (simplified from full calculation)
                    const winterMonthly = (winterAvgTemp - 35) * squareFeet * 0.015; // Rough heating cost formula
                    const summerMonthly = (summerTemp < 75 ? 0 : (78 - summerTemp)) * squareFeet * 0.012; // Rough cooling cost formula
                    
                    const annualCost = (winterMonthly * 4) + (summerMonthly * 3);
                    return Math.max(0, annualCost).toFixed(2);
                  })()}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
                    <p className="font-semibold text-blue-700 dark:text-blue-300">Winter (4 mo.)</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Avg {((((userSettings?.winterThermostatDay ?? 70) * 16 + (userSettings?.winterThermostatNight ?? 65) * 8) / 24).toFixed(1))}°F
                    </p>
                  </div>
                  <div className="bg-cyan-50 dark:bg-cyan-900/30 rounded-lg p-3">
                    <p className="font-semibold text-cyan-700 dark:text-cyan-300">Summer (3 mo.)</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {userSettings?.summerThermostat ?? 74}°F constant
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 italic">
                  * Simplified estimate for budgeting. Actual costs vary with weather, insulation, and system efficiency.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Thermostat Settings for City Comparison */}
        {mode === 'comparison' && locationData && locationDataB && (
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 rounded-2xl shadow-lg p-8 mb-8 border-4 border-purple-300 dark:border-purple-700">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-purple-800 dark:text-purple-200 mb-2">🌡️ Thermostat Settings</h2>
              <p className="text-purple-600 dark:text-purple-400">Set your preferred temperature schedules for comparison</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Winter Settings */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-700">
                <h3 className="font-semibold text-blue-700 dark:text-blue-300 mb-4 flex items-center gap-2">
                  <Thermometer size={18} />
                  Winter Heating (Dec-Feb)
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Daytime Setting (6am-10pm)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="60"
                        max="78"
                        value={userSettings?.winterThermostatDay ?? 70}
                        onChange={(e) => setUserSetting?.('winterThermostatDay', Number(e.target.value))}
                        className="flex-grow"
                      />
                      <span className="font-bold text-xl text-blue-600 dark:text-blue-400 w-14 text-right">
                        {userSettings?.winterThermostatDay ?? 70}°F
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Nighttime Setting (10pm-6am)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="60"
                        max="78"
                        value={userSettings?.winterThermostatNight ?? 65}
                        onChange={(e) => setUserSetting?.('winterThermostatNight', Number(e.target.value))}
                        className="flex-grow"
                      />
                      <span className="font-bold text-xl text-blue-600 dark:text-blue-400 w-14 text-right">
                        {userSettings?.winterThermostatNight ?? 65}°F
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summer Settings */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-cyan-200 dark:border-cyan-700">
                <h3 className="font-semibold text-cyan-700 dark:text-cyan-300 mb-4 flex items-center gap-2">
                  <Thermometer size={18} />
                  Summer Cooling (Jun-Aug)
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Daytime Setting (6am-10pm)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="68"
                        max="80"
                        value={userSettings?.summerThermostat ?? 74}
                        onChange={(e) => setUserSetting?.('summerThermostat', Number(e.target.value))}
                        className="flex-grow"
                      />
                      <span className="font-bold text-xl text-cyan-600 dark:text-cyan-400 w-14 text-right">
                        {userSettings?.summerThermostat ?? 74}°F
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Nighttime Setting (10pm-6am)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="68"
                        max="82"
                        value={userSettings?.summerThermostatNight ?? userSettings?.summerThermostat ?? 76}
                        onChange={(e) => setUserSetting?.('summerThermostatNight', Number(e.target.value))}
                        className="flex-grow"
                      />
                      <span className="font-bold text-xl text-cyan-600 dark:text-cyan-400 w-14 text-right">
                        {userSettings?.summerThermostatNight ?? userSettings?.summerThermostat ?? 76}°F
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Annual Budget Comparison */}
        {mode === 'comparison' && locationData && locationDataB && (
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 rounded-2xl shadow-lg p-8 mb-8 border-4 border-indigo-300 dark:border-indigo-700">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-indigo-800 dark:text-indigo-200 mb-2">📅 Annual Budget Comparison</h2>
              <p className="text-indigo-600 dark:text-indigo-400">Estimated yearly HVAC costs for both locations</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Location A Annual */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-700">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <MapPin size={16} className="text-blue-600 dark:text-blue-400" />
                    <h3 className="font-semibold text-blue-700 dark:text-blue-300">{locationData.city}, {locationData.state}</h3>
                  </div>
                  <div className="text-4xl font-black text-blue-600 dark:text-blue-400 mb-2">
                    ${(() => {
                      const winterDay = userSettings?.winterThermostatDay ?? 70;
                      const winterNight = userSettings?.winterThermostatNight ?? 65;
                      const summerDay = userSettings?.summerThermostat ?? 74;
                      const summerNight = userSettings?.summerThermostatNight ?? summerDay;
                      const winterAvg = (winterDay * 16 + winterNight * 8) / 24;
                      const summerAvg = (summerDay * 16 + summerNight * 8) / 24;
                      const winterMonthly = Math.max(0, (winterAvg - 35) * squareFeet * 0.015);
                      const summerMonthly = Math.max(0, (summerAvg - 68) * squareFeet * 0.010);
                      return Math.max(0, (winterMonthly * 4) + (summerMonthly * 3)).toFixed(2);
                    })()}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Estimated annual cost</p>
                </div>
              </div>

              {/* Location B Annual */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-green-200 dark:border-green-700">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <MapPin size={16} className="text-green-600 dark:text-green-400" />
                    <h3 className="font-semibold text-green-700 dark:text-green-300">{locationDataB.city}, {locationDataB.state}</h3>
                  </div>
                  <div className="text-4xl font-black text-green-600 dark:text-green-400 mb-2">
                    ${(() => {
                      const winterDay = userSettings?.winterThermostatDay ?? 70;
                      const winterNight = userSettings?.winterThermostatNight ?? 65;
                      const summerDay = userSettings?.summerThermostat ?? 74;
                      const summerNight = userSettings?.summerThermostatNight ?? summerDay;
                      const winterAvg = (winterDay * 16 + winterNight * 8) / 24;
                      const summerAvg = (summerDay * 16 + summerNight * 8) / 24;
                      // Adjust for location B climate (simplified)
                      const winterMonthly = Math.max(0, (winterAvg - 30) * squareFeet * 0.016);
                      const summerMonthly = Math.max(0, (summerAvg - 68) * squareFeet * 0.011);
                      return Math.max(0, (winterMonthly * 4) + (summerMonthly * 3)).toFixed(2);
                    })()}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Estimated annual cost</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 italic text-center">
              * Simplified estimates for budgeting purposes based on typical climate patterns
            </p>
          </div>
        )}

{/* Comparison Results Card */}
        {mode === 'comparison' && monthlyEstimate && monthlyEstimateB && locationData && locationDataB && (
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900 dark:to-indigo-900 rounded-2xl shadow-lg p-8 mb-8 border-4 border-purple-300 dark:border-purple-700">
            <div className="text-center mb-6">
              <p className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-2">
                CITY COMPARISON: {activeMonths.find(m => m.value === selectedMonth)?.label.toUpperCase()} @ {indoorTemp}°F ({energyMode.toUpperCase()})
              </p>
              {monthlyEstimate.electricityRate !== monthlyEstimateB.electricityRate && (
                <p className="text-xs text-purple-600 dark:text-purple-400">
                  Using location-specific electricity rates
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Location A */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-blue-300 dark:border-blue-700">
                <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2"><MapPin size={12} className="inline mr-1" /> {locationData.city}, {locationData.state}</div>
                <div className="text-5xl font-black text-blue-600 dark:text-blue-400 mb-2">
                  ${monthlyEstimate.cost.toFixed(2)}
                </div>
                <span data-testid="monthly-method-a" data-method={monthlyEstimate.method} className="sr-only">{monthlyEstimate.method}</span>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {monthlyEstimate.method === 'gasFurnace'
                    ? `${monthlyEstimate.therms?.toFixed(1) ?? '0.0'} therms/month`
                    : `${monthlyEstimate.energy?.toFixed(0) ?? '0'} kWh/month`
                  }
                </div>
                {monthlyEstimate.method === 'heatPumpHeating' && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    @ ${monthlyEstimate.electricityRate.toFixed(3)}/kWh
                  </div>
                )}
                {monthlyEstimate.method === 'gasFurnace' && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    @ ${monthlyEstimate.gasCost?.toFixed(2) ?? gasCost.toFixed(2)}/therm ({Math.round(afue * 100)}% AFUE)
                  </div>
                )}
                {/* CO2 Footprint */}
                <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    CO2: <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {(() => {
                        const co2Lbs = monthlyEstimate.method === 'gasFurnace'
                          ? calculateGasCO2(monthlyEstimate.therms ?? 0).lbs
                          : calculateElectricityCO2(monthlyEstimate.energy ?? 0, locationData.state).lbs;
                        const equivalent = getBestEquivalent(co2Lbs);
                        let co2Display = 'N/A';
                        if (Number.isFinite(co2Lbs)) {
                            co2Display = co2Lbs >= 1 ? formatCO2(co2Lbs) : '< 1 lb';
                        }
                        return (
                          <>
                            {co2Display}
                            {co2Lbs > 10 && (
                              <span className="block text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 font-normal">
                                ≈ {equivalent.text}
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Location B */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-green-300 dark:border-green-700">
                <div className="text-xs font-semibold text-green-600 dark:text-green-400 mb-2"><MapPin size={12} className="inline mr-1" /> {locationDataB.city}, {locationDataB.state}</div>
                <div className="text-5xl font-black text-green-600 dark:text-green-400 mb-2">
                  ${monthlyEstimateB.cost.toFixed(2)}
                </div>
                <span data-testid="monthly-method-b" data-method={monthlyEstimateB.method} className="sr-only">{monthlyEstimateB.method}</span>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {monthlyEstimateB.method === 'gasFurnace'
                    ? `${monthlyEstimateB.therms?.toFixed(1) ?? '0.0'} therms/month`
                    : `${monthlyEstimateB.energy?.toFixed(0) ?? '0'} kWh/month`
                  }
                </div>
                {monthlyEstimateB.method === 'heatPumpHeating' && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    @ ${monthlyEstimateB.electricityRate.toFixed(3)}/kWh
                  </div>
                )}
                {monthlyEstimateB.method === 'gasFurnace' && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    @ ${monthlyEstimateB.gasCost?.toFixed(2) ?? gasCost.toFixed(2)}/therm ({Math.round(afue * 100)}% AFUE)
                  </div>
                )}
                {/* CO2 Footprint */}
                <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    CO2: <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {(() => {
                        const co2Lbs = monthlyEstimateB.method === 'gasFurnace'
                          ? calculateGasCO2(monthlyEstimateB.therms ?? 0).lbs
                          : calculateElectricityCO2(monthlyEstimateB.energy ?? 0, locationDataB.state).lbs;
                        const equivalent = getBestEquivalent(co2Lbs);
                        let co2Display = 'N/A';
                        if (Number.isFinite(co2Lbs)) {
                            co2Display = co2Lbs >= 1 ? formatCO2(co2Lbs) : '< 1 lb';
                        }
                        return (
                          <>
                            {co2Display}
                            {co2Lbs > 10 && (
                              <span className="block text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 font-normal">
                                ≈ {equivalent.text}
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Difference Callout */}
            <div className={`rounded-lg p-4 text-center ${monthlyEstimateB.cost > monthlyEstimate.cost
              ? 'bg-red-100 dark:bg-red-900/40 border-2 border-red-400 dark:border-red-700'
              : 'bg-green-100 dark:bg-green-900/40 border-2 border-green-400 dark:border-green-700'
              }`}>
              <p className={`text-lg font-bold ${monthlyEstimateB.cost > monthlyEstimate.cost
                ? 'text-red-700 dark:text-red-300'
                : 'text-green-700 dark:text-green-300'
                }`}>
                {monthlyEstimateB.cost > monthlyEstimate.cost
                    ? `💸 Moving to ${locationDataB.city} would cost $${(monthlyEstimateB.cost - monthlyEstimate.cost).toFixed(2)} MORE per month`
                    : `💰 Moving to ${locationDataB.city} would SAVE $${(monthlyEstimate.cost - monthlyEstimateB.cost).toFixed(2)} per month`
                }
              </p>
                <p className={`text-sm mt-2 font-semibold ${monthlyEstimateB.cost > monthlyEstimate.cost ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {(() => {
                    const monthlyDiff = Math.abs(monthlyEstimate.cost - monthlyEstimateB.cost);
                    const annualDiff = monthlyDiff * 12;
                    return monthlyEstimateB.cost > monthlyEstimate.cost
                      ? `That's $${annualDiff.toFixed(2)} more per year`
                      : `That's $${annualDiff.toFixed(2)} in annual savings`;
                  })()}
                </p>
                <p className="text-xs mt-2 text-gray-700 dark:text-gray-300">
                {monthlyEstimateB.cost > monthlyEstimate.cost
                  ? `That's ${(((monthlyEstimateB.cost - monthlyEstimate.cost) / monthlyEstimate.cost) * 100).toFixed(0)}% higher`
                  : `That's ${(((monthlyEstimate.cost - monthlyEstimateB.cost) / monthlyEstimate.cost) * 100).toFixed(0)}% lower`
                }
              </p>
            </div>
            {typeof thermostatEquivalency === 'number' && (
              <div className="mt-4 text-sm text-center">
                <p>
                  To match your cost in <strong>{locationData.city}</strong>, you'd need to set the thermostat to <strong>{thermostatEquivalency}°F</strong> in <strong>{locationDataB.city}</strong> for the same month.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <Cloud className="animate-spin mx-auto mb-2 text-blue-500" size={32} />
            <p className="text-gray-600 dark:text-gray-400">Fetching historical climate data...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-6 text-red-700 dark:text-red-300">
            <p className="font-semibold">{error}</p>
          </div>
        )}

        {/* Disclaimer */}
        <div className="bg-gray-50 dark:bg-gray-800 border-l-4 border-orange-400 rounded-lg p-6 mb-8">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            <strong className="text-orange-600 dark:text-orange-400">⚠️ Disclaimer:</strong> This estimate is for budgeting purposes only, based on 30-year historical climate averages for your location. Your actual bill will vary based on real-time weather, which may be significantly colder or warmer than average. Historical averages should not be interpreted as a guarantee of specific billing amounts.
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">How This Works</h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
            <li>✓ Uses 30-year historical climate data for your location</li>
            <li>✓ Simulates your HVAC system across a typical month</li>
            <li>✓ Accounts for your home's size, insulation, and system efficiency</li>
            <li>✓ Helps you budget month-by-month for heating or cooling</li>
            <li>✓ Not a real-time forecast—use the 7-Day Forecaster for that</li>
          </ul>
        </div>
      
      {/* Compare Upgrade Button */}
      <div className="flex justify-center mt-8">
        <Link to="/cost-comparison" className="inline-flex px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
          Compare Upgrade →
        </Link>
      </div>
    </div>
  );
};

export default MonthlyBudgetPlanner;