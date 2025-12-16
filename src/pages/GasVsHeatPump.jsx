import React, { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Zap, MapPin, Info, Flame, Home, TrendingUp, AlertCircle, ChevronDown, ChevronUp, Calculator, Award, Leaf } from 'lucide-react';
import { inputClasses, fullInputClasses, selectClasses } from '../lib/uiClasses';
import { DashboardLink } from '../components/DashboardLink';
import { fetchGeocodeCandidates, chooseBestCandidate, reverseGeocode } from '../utils/geocode';
import { fetchStateAverageGasPrice } from '../lib/eia';
import { getDefrostPenalty, getEffectiveSquareFeet } from '../lib/heatUtils';
import useForecast from '../hooks/useForecast';
import { useUnitSystem, formatTemperatureFromF, formatCapacityFromKbtuh } from '../lib/units';
import { getAllSettings } from '../lib/unifiedSettingsManager';

const GasVsHeatPump = () => {
  const EXTREME_COLD_F = 0; // Default threshold for extreme cold advisory
  const { unitSystem } = useUnitSystem();

  // Extract context
  const outletContext = useOutletContext() || {};
  const { userSettings, setUserSetting } = outletContext || {};
  
  // Get onboarding data from unified settings manager as fallback
  const allSettings = getAllSettings();
  
  // Extract building characteristics from userSettings/context/onboarding
  const squareFeet = Number(userSettings?.squareFeet || outletContext?.squareFeet || allSettings?.squareFeet || 1500);
  const setSquareFeetContext = (v) => setUserSetting ? setUserSetting('squareFeet', v) : (outletContext?.setSquareFeet || (() => { }))(v);
  const insulationLevel = Number(userSettings?.insulationLevel || outletContext?.insulationLevel || allSettings?.insulationLevel || 1.0);
  const setInsulationLevelContext = (v) => setUserSetting ? setUserSetting('insulationLevel', v) : (outletContext?.setInsulationLevel || (() => { }))(v);
  const homeShape = Number(userSettings?.homeShape || outletContext?.homeShape || allSettings?.homeShape || 1.0);
  const setHomeShapeContext = (v) => setUserSetting ? setUserSetting('homeShape', v) : (outletContext?.setHomeShape || (() => { }))(v);
  const ceilingHeight = Number(userSettings?.ceilingHeight || outletContext?.ceilingHeight || allSettings?.ceilingHeight || 8);
  const setCeilingHeightContext = (v) => setUserSetting ? setUserSetting('ceilingHeight', v) : (outletContext?.setCeilingHeight || (() => { }))(v);
  const hasLoft = Boolean(userSettings?.hasLoft || outletContext?.hasLoft || allSettings?.hasLoft || false);
  const setHasLoftContext = (v) => setUserSetting ? setUserSetting('hasLoft', v) : (outletContext?.setHasLoft || (() => { }))(v);
  const contextIndoorTemp = Number((userSettings?.indoorTemp ?? userSettings?.winterThermostat) || outletContext?.indoorTemp || allSettings?.indoorTemp || allSettings?.winterThermostat || 70);
  const contextCapacity = userSettings?.capacity || outletContext?.capacity || allSettings?.capacity || allSettings?.coolingCapacity || 24;
  const contextEfficiency = Number(userSettings?.efficiency || outletContext?.efficiency || allSettings?.efficiency || allSettings?.seer2 || 15);
  const contextUtilityCost = Number(userSettings?.utilityCost || outletContext?.utilityCost || allSettings?.utilityCost || 0.10);
  const contextGasCost = Number(userSettings?.gasCost || outletContext?.gasCost || allSettings?.gasCost || 1.50);
  const contextAFUE = Number(userSettings?.afue || outletContext?.afue || allSettings?.afue || 0.95);

  // --- System Configuration (use context if available, otherwise local state) ---
  const [capacity, setCapacity] = useState(contextCapacity);
  const [efficiency, setEfficiency] = useState(contextEfficiency);
  const [indoorTemp, setIndoorTemp] = useState(contextIndoorTemp);
  const [utilityCost, setUtilityCost] = useState(contextUtilityCost);

  // --- New Gas Furnace Inputs ---
  const [gasFurnaceAFUE, setGasFurnaceAFUE] = useState(contextAFUE);
  const [gasCostPerTherm, setGasCostPerTherm] = useState(contextGasCost);
  
  // Sync state with onboarding data when it becomes available
  useEffect(() => {
    if (contextCapacity && contextCapacity !== capacity) {
      setCapacity(contextCapacity);
    }
    if (contextEfficiency && contextEfficiency !== efficiency) {
      setEfficiency(contextEfficiency);
    }
    if (contextIndoorTemp && contextIndoorTemp !== indoorTemp) {
      setIndoorTemp(contextIndoorTemp);
    }
    if (contextUtilityCost && contextUtilityCost !== utilityCost) {
      setUtilityCost(contextUtilityCost);
    }
    if (contextGasCost && contextGasCost !== gasCostPerTherm) {
      setGasCostPerTherm(contextGasCost);
    }
    if (contextAFUE && contextAFUE !== gasFurnaceAFUE) {
      setGasFurnaceAFUE(contextAFUE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextCapacity, contextEfficiency, contextIndoorTemp, contextUtilityCost, contextGasCost, contextAFUE]);

  // --- State for EIA gas price fetch ---
  const [showStatePickerModal, setShowStatePickerModal] = useState(false);
  const [fetchingGasPrice, setFetchingGasPrice] = useState(false);
  const [gasPriceFetchError, setGasPriceFetchError] = useState(null);
  const eiaApiKey = import.meta.env.VITE_EIA_API_KEY || '';

  // --- Building Characteristics - REMOVED (now using context) ---
  // const [squareFeet, setSquareFeet] = useState(1500);
  // const [insulationLevel, setInsulationLevel] = useState(1.0);
  // const [homeShape, setHomeShape] = useState(1.0);
  // const [ceilingHeight, setCeilingHeight] = useState(8);
  const [heatLoss, setHeatLoss] = useState(34000);

  // --- Location and Weather ---
  const [locationQuery, setLocationQuery] = useState(() => {
    // Try to load location from onboarding localStorage
    try {
      const savedLocation = localStorage.getItem('userLocation');
      if (savedLocation) {
        const locationData = JSON.parse(savedLocation);
        if (locationData.city && locationData.state) {
          return `${locationData.city}, ${locationData.state}`;
        }
      }
    } catch (e) {
      console.error('Failed to load saved location:', e);
    }
    return "Chicago, IL"; // Default fallback
  });
  
  // Initialize location from onboarding data if available
  const [location, setLocation] = useState(() => {
    try {
      const savedLocation = localStorage.getItem('userLocation');
      if (savedLocation) {
        const locationData = JSON.parse(savedLocation);
        if (locationData.latitude && locationData.longitude) {
          return {
            latitude: locationData.latitude,
            longitude: locationData.longitude,
          };
        }
      }
    } catch (e) {
      console.error('Failed to load saved location coordinates:', e);
    }
    return null;
  });
  const [foundLocationName, setFoundLocationName] = useState("");
  const [forecastTimezone, setForecastTimezone] = useState(null);
  
  // Local state for geocoding operations
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState(null);
  
  // Use NWS-first forecast hook
  const { forecast: rawForecast, loading: forecastLoading, error: forecastError, dataSource: forecastDataSource } = useForecast(
    location?.latitude,
    location?.longitude,
    { enabled: !!location }
  );
  
  // Transform forecast data to expected format
  const forecast = useMemo(() => {
    if (!rawForecast) return null;
    return rawForecast.map(hour => ({
      timeMs: hour.time.getTime(),
      temp: hour.temp,
      humidity: hour.humidity ?? 50, // Default to 50% if missing
    }));
  }, [rawForecast]);
  
  // Combined UI state
  const isLoading = geoLoading || forecastLoading;
  const displayError = geoError || forecastError || null;
  const [geocodeCandidates, setGeocodeCandidates] = useState([]);
  const [showCandidateList, setShowCandidateList] = useState(false);
  const [lowHeatLossWarning, setLowHeatLossWarning] = useState(false);
  const [showCalculations, setShowCalculations] = useState(false);
  const [simpleMode, setSimpleMode] = useState(false);
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);

  // Basic US state abbreviation to name mapping for better geocoding disambiguation
  const STATE_ABBR = useMemo(() => ({
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
    DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
    KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
    MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
    NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
    OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
    TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
    DC: 'District of Columbia'
  }), []);

  const capacities = { 18: 1.5, 24: 2.0, 30: 2.5, 36: 3.0, 42: 3.5, 48: 4.0, 60: 5.0 };
  const tons = capacities[capacity];

  useEffect(() => {
    const baseBtuPerSqFt = 22.67;
    const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
    const effectiveSquareFeet = getEffectiveSquareFeet(squareFeet, hasLoft, homeShape);
    const calculatedHeatLoss = effectiveSquareFeet * baseBtuPerSqFt * insulationLevel * homeShape * ceilingMultiplier;
    const rounded = Math.round(calculatedHeatLoss / 1000) * 1000;
    setHeatLoss(rounded);
    setLowHeatLossWarning(rounded < 10000); // Warn if abnormally low, likely invalid inputs
  }, [squareFeet, insulationLevel, homeShape, ceilingHeight, hasLoft]);

  // Gas cost sync is now handled in the main sync useEffect above

  const compressorPower = useMemo(() => tons * 1.0 * (15 / efficiency), [tons, efficiency]);

  const getPerformanceAtTemp = useMemo(() => (outdoorTemp, humidity) => {
    const tempDiff = Math.max(1, indoorTemp - outdoorTemp);
    const btuLossPerDegreeF = heatLoss > 0 ? heatLoss / 70 : 0;
    const buildingHeatLossBtu = btuLossPerDegreeF * tempDiff;

    let capacityFactor = 1.0;
    if (outdoorTemp < 47) capacityFactor = 1.0 - (47 - outdoorTemp) * 0.01;
    if (outdoorTemp < 17) capacityFactor = 0.70 - (17 - outdoorTemp) * 0.0074;
    capacityFactor = Math.max(0.3, capacityFactor);

    const powerFactor = 1 / Math.max(0.7, capacityFactor);
    const baseElectricalKw = compressorPower * powerFactor;

    // Use centralized defrost penalty calculation
    const defrostPenalty = getDefrostPenalty(outdoorTemp, humidity);
    const electricalKw = baseElectricalKw * defrostPenalty;

    const heatpumpOutputBtu = (tons * 3.517 * capacityFactor) * 3412.14;

    let runtimePercentage = heatpumpOutputBtu > 0 ? (buildingHeatLossBtu / heatpumpOutputBtu) * 100 : 100;
    runtimePercentage = Math.min(100, Math.max(0, runtimePercentage));

    return { electricalKw, runtime: runtimePercentage, buildingHeatLossBtu };
  }, [indoorTemp, compressorPower, efficiency, heatLoss, tons]);

  const handleCitySearch = async () => {
    if (!locationQuery) {
      setGeoError("Please enter a city (e.g., 'Chicago, IL').");
      return;
    }
    setGeoError(null);
    setGeoLoading(true);
    try {
      const fullQuery = locationQuery.trim();

      // Handle both "City, State" and "City State" formats
      let cityPart, statePartRaw;
      if (fullQuery.includes(',')) {
        [cityPart, statePartRaw] = fullQuery.split(',').map(s => s.trim());
      } else {
        // Split on space and take last word as potential state
        const parts = fullQuery.split(/\s+/);
        if (parts.length > 1) {
          const lastWord = parts[parts.length - 1];
          // Check if last word looks like a state (2-3 chars or known state name)
          if (lastWord.length <= 3 || STATE_ABBR[lastWord.toUpperCase()] || Object.values(STATE_ABBR).some(s => s.toLowerCase() === lastWord.toLowerCase())) {
            statePartRaw = lastWord;
            cityPart = parts.slice(0, -1).join(' ');
          } else {
            cityPart = fullQuery;
          }
        } else {
          cityPart = fullQuery;
        }
      }

      const statePart = statePartRaw && statePartRaw.length <= 3 ? (STATE_ABBR[statePartRaw.toUpperCase()] || statePartRaw) : statePartRaw;

      const rawCandidates = await fetchGeocodeCandidates(cityPart);
      if (!rawCandidates || rawCandidates.length === 0) throw new Error(`Could not find location: "${fullQuery}"`);

      // Filter US first then fallback
      let candidates = rawCandidates.filter(r => (r.country || '').toLowerCase().includes('united states'));
      if (candidates.length === 0) candidates = rawCandidates;

      // If statePart provided, prioritize matches but still allow selection list if >1
      let prioritized = candidates;
      if (statePart) {
        const matches = candidates.filter(r => (r.admin1 || '').toLowerCase() === statePart.toLowerCase());
        if (matches.length > 0) prioritized = matches;
      }

      // If more than one plausible candidate, show selection list
      if (prioritized.length > 1) {
        setGeocodeCandidates(prioritized.slice(0, 7));
        setShowCandidateList(true);
        setGeoLoading(false);
        return; // Wait for user to pick
      }

      const bestResult = chooseBestCandidate(prioritized);
      setLocation({ latitude: bestResult.latitude, longitude: bestResult.longitude });
      setFoundLocationName(`${bestResult.name}${bestResult.admin1 ? ', ' + bestResult.admin1 : ''}${bestResult.country ? ', ' + bestResult.country : ''}`);
    } catch (e) {
      console.error("Geocoding error:", e);
      setGeoError(e?.message || "Failed to find that city.");
    } finally {
      setGeoLoading(false);
    }
  };

  const handleCandidateSelect = (candidate) => {
    setLocation({ latitude: candidate.latitude, longitude: candidate.longitude });
    setFoundLocationName(`${candidate.name}${candidate.admin1 ? ', ' + candidate.admin1 : ''}${candidate.country ? ', ' + candidate.country : ''}`);
    setShowCandidateList(false);
    setGeocodeCandidates([]);
  };

  // Request user's current location via the browser (or Capacitor on native) and reverse-geocode it.
  const handleLocationRequest = async () => {
    // If neither browser nor Capacitor geolocation is available, show an error.
    const hasBrowserGeo = typeof navigator !== 'undefined' && !!navigator.geolocation;
    const hasCapacitorGeo = !!(window?.Capacitor?.isNativePlatform && window?.Capacitor?.Plugins?.Geolocation?.getCurrentPosition);
    if (!hasBrowserGeo && !hasCapacitorGeo) {
      setGeoError('Geolocation is not available in this environment.');
      return;
    }

    // Helpful hint when running on an insecure origin (browsers block geolocation on HTTP except localhost).
    if (typeof window !== 'undefined' && !window.isSecureContext && !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) {
      setGeoError('Location requires HTTPS (or localhost) in browsers. Use city search or switch to https.');
      return;
    }

    setGeoError(null);
    setGeoLoading(true);

    const getPosition = () => new Promise((resolve, reject) => {
      if (hasCapacitorGeo) {
        window.Capacitor.Plugins.Geolocation.getCurrentPosition({ timeout: 10000 })
          .then(resolve)
          .catch(reject);
      } else if (hasBrowserGeo) {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true, maximumAge: 60000 });
      } else {
        reject(new Error('Geolocation not supported'));
      }
    });

    try {
      const pos = await getPosition();
      const latitude = pos.coords?.latitude ?? pos.latitude;
      const longitude = pos.coords?.longitude ?? pos.longitude;
      setLocation({ latitude, longitude });

      try {
        const rev = await reverseGeocode(latitude, longitude);
        const label = rev
          ? `${rev.name}${rev.admin1 ? ', ' + rev.admin1 : ''}${rev.country ? ', ' + rev.country : ''}`
          : `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
        setFoundLocationName(label);
        setLocationQuery(label); // reflect in the input for visible feedback
        setShowCandidateList(false);
        setGeocodeCandidates([]);
      } catch (error) {
        console.warn('Reverse geocoding failed', error);
        const label = `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
        setFoundLocationName(label);
        setLocationQuery(label);
      }
    } catch (e) {
      let msg = 'Location unavailable. Please try again or enter a city.';
      if (e && typeof e === 'object') {
        // Browser PositionError codes: 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT
        if (e.code === 1) msg = 'Location access was denied. Check browser/site permissions.';
        else if (e.message) msg = e.message;
      }
      setGeoError(msg);
    } finally {
      setGeoLoading(false);
    }
  };

  // Handler for fetching state-average gas price from EIA
  const handleFetchStateAverage = async (selectedState) => {
    if (!eiaApiKey) {
      setGasPriceFetchError('EIA API key is required. Please set VITE_EIA_API_KEY in your environment.');
      return;
    }

    if (!selectedState) {
      setGasPriceFetchError('Please select a state.');
      return;
    }

    setFetchingGasPrice(true);
    setGasPriceFetchError(null);

    try {
      const result = await fetchStateAverageGasPrice(eiaApiKey, selectedState);

      if (!result) {
        setGasPriceFetchError(`No gas price data found for ${selectedState}. Try another state.`);
        return;
      }

      // Update the gas cost per therm with the fetched value
      setGasCostPerTherm(parseFloat(result.rate.toFixed(3)));

      // Close the modal
      setShowStatePickerModal(false);

      // Success feedback could be added here (e.g., toast notification)
      console.log(`Updated gas price to $${result.rate.toFixed(3)}/therm from ${result.period} EIA data (${result.originalMcfPrice.toFixed(2)} $/Mcf)`);

    } catch (error) {
      setGasPriceFetchError(error.message || 'Failed to fetch gas price from EIA.');
    } finally {
      setFetchingGasPrice(false);
    }
  };

  // Auto-load location from onboarding on mount
  useEffect(() => {
    // If we already have coordinates from onboarding, set the found location name
    if (location?.latitude && location?.longitude) {
      try {
        const savedLocation = localStorage.getItem('userLocation');
        if (savedLocation) {
          const locationData = JSON.parse(savedLocation);
          if (locationData.city && locationData.state) {
            setFoundLocationName(`${locationData.city}${locationData.state ? ', ' + locationData.state : ''}${locationData.country ? ', ' + locationData.country : ''}`);
            // Forecast will automatically load via useForecast hook since location is set
            return;
          }
        }
      } catch (e) {
        console.error('Failed to load saved location name:', e);
      }
    }
    // If no saved coordinates, try to search using the location query
    if (locationQuery && locationQuery !== "Chicago, IL") {
      handleCitySearch();
    }
  }, []); // Only run on mount

  // Set timezone from location (useForecast doesn't provide timezone, so we'll infer from location)
  useEffect(() => {
    if (location && forecast) {
      // Try to get timezone from the first forecast entry's time
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setForecastTimezone(tz);
      } catch {
        setForecastTimezone(null);
      }
    }
  }, [location, forecast]);

  const weeklyMetrics = useMemo(() => {
    if (!forecast) return null;
    const dailyData = {};
    const BTU_PER_THERM = 100000;
    const dayKeyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: forecastTimezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' });
    const dayLabelFmt = new Intl.DateTimeFormat(undefined, { timeZone: forecastTimezone || 'UTC', weekday: 'short', month: 'numeric', day: 'numeric' });

    forecast.forEach(hour => {
      const dateObj = new Date(hour.timeMs);
      const dayKey = dayKeyFmt.format(dateObj); // YYYY-MM-DD in target timezone
      if (!dailyData[dayKey]) dailyData[dayKey] = { temps: [], humidities: [], totalHPCost: 0, totalGasCost: 0, firstMs: hour.timeMs };
      if (!('firstMs' in dailyData[dayKey])) dailyData[dayKey].firstMs = hour.timeMs;

      const perf = getPerformanceAtTemp(hour.temp, hour.humidity);

      // Heat Pump Calculation
      const duty = Math.min(100, Math.max(0, perf.runtime));
      const hpCostForHour = perf.electricalKw * (duty / 100) * utilityCost;

      // Gas Furnace Calculation
      const gasEnergyInputBtu = perf.buildingHeatLossBtu / gasFurnaceAFUE;
      const thermsUsed = gasEnergyInputBtu / BTU_PER_THERM;
      const gasCostForHour = thermsUsed * gasCostPerTherm;

      dailyData[dayKey].temps.push(hour.temp);
      dailyData[dayKey].humidities.push(hour.humidity);
      dailyData[dayKey].totalHPCost += hpCostForHour;
      dailyData[dayKey].totalGasCost += gasCostForHour;
    });

    const summary = Object.keys(dailyData).map(key => ({
      day: dayLabelFmt.format(new Date(dailyData[key].firstMs)),
      lowTemp: Math.min(...dailyData[key].temps),
      highTemp: Math.max(...dailyData[key].temps),
      avgHumidity: dailyData[key].humidities.reduce((a, b) => a + b, 0) / dailyData[key].humidities.length,
      hpCost: dailyData[key].totalHPCost,
      gasCost: dailyData[key].totalGasCost,
      savings: dailyData[key].totalGasCost - dailyData[key].totalHPCost,
    }));

    const totalHPCost = summary.reduce((acc, day) => acc + day.hpCost, 0);
    const totalGasCost = summary.reduce((acc, day) => acc + day.gasCost, 0);
    const totalSavings = totalGasCost - totalHPCost;
    // Rough annual projection: assume ~26 heating weeks/year
    const estimatedAnnualSavings = totalSavings * 26;

    return { summary, totalHPCost, totalGasCost, totalSavings, estimatedAnnualSavings };
  }, [forecast, getPerformanceAtTemp, utilityCost, gasFurnaceAFUE, gasCostPerTherm]);

  // Persist last forecast summary for home dashboard
  useEffect(() => {
    if (weeklyMetrics && foundLocationName) {
      try {
        const payload = {
          location: foundLocationName,
          totalHPCost: weeklyMetrics.totalHPCost,
          totalGasCost: weeklyMetrics.totalGasCost,
          totalSavings: weeklyMetrics.totalSavings,
          estimatedAnnualSavings: weeklyMetrics.estimatedAnnualSavings,
          timestamp: Date.now()
        };
        localStorage.setItem('last_forecast_summary', JSON.stringify(payload));
      } catch { /* ignore persistence errors */ }
    }
  }, [weeklyMetrics, foundLocationName]);

  // Warnings for edge cases
  const warnings = useMemo(() => {
    if (!forecast) return { extremeCold: false, overRuntime: false };
    const extremeCold = forecast.some(h => h.temp <= EXTREME_COLD_F);
    const overRuntime = forecast.some(h => {
      const perf = getPerformanceAtTemp(h.temp, h.humidity);
      return perf.runtime > 100;
    });
    return { extremeCold, overRuntime };
  }, [forecast, getPerformanceAtTemp]);

  // Calculate CO2 savings for hero banner
  const co2Savings = useMemo(() => {
    if (!weeklyMetrics) return null;
    const estimatedHPkWh = weeklyMetrics.totalHPCost / utilityCost;
    const estimatedGasTherms = weeklyMetrics.totalGasCost / gasCostPerTherm;
    const hpCO2 = estimatedHPkWh * 0.92; // lbs CO₂ from electricity
    const gasCO2 = estimatedGasTherms * 11.7; // lbs CO₂ from natural gas
    const co2Saved = gasCO2 - hpCO2;
    return co2Saved >= 0 ? `${co2Saved.toFixed(0)} lbs` : null;
  }, [weeklyMetrics, utilityCost, gasCostPerTherm]);

  // Format daily rows for table
  const dailyRows = useMemo(() => {
    if (!weeklyMetrics) return [];
    return weeklyMetrics.summary.map(day => ({
      date: day.day,
      tempRange: `${formatTemperatureFromF(day.lowTemp, unitSystem, { decimals: 0, withUnit: false })}–${formatTemperatureFromF(day.highTemp, unitSystem, { decimals: 0 })}`,
      hp: day.hpCost,
      gas: day.gasCost,
      savings: day.savings
    }));
  }, [weeklyMetrics]);

  // Calculate savings percentage
  const savingsPercent = useMemo(() => {
    if (!weeklyMetrics || weeklyMetrics.totalGasCost === 0) return '0%';
    return `${((weeklyMetrics.totalSavings / weeklyMetrics.totalGasCost) * 100).toFixed(0)}%`;
  }, [weeklyMetrics]);

  // Annual savings label
  const annualSavingsLabel = useMemo(() => {
    if (!weeklyMetrics) return '$0';
    return `$${weeklyMetrics.estimatedAnnualSavings.toFixed(0)}`;
  }, [weeklyMetrics]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 text-gray-200">
      {/* ---------------- PAGE HERO ---------------- */}
      <section className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white">7-Day Cost Comparison</h1>
            <p className="mt-2 text-gray-400">
              See how your heat pump stacks up against gas for the next 7 days — using real weather and real physics.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <label className={`flex items-center gap-2 ${(!location || !forecast || forecastLoading) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={simpleMode}
                onChange={(e) => setSimpleMode(e.target.checked)}
                disabled={!location || !forecast || forecastLoading}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className={`text-sm ${(!location || !forecast || forecastLoading) ? 'text-gray-500' : 'text-gray-300'}`}>
                Simple mode
                {(!location || !forecast || forecastLoading) && (
                  <span className="ml-1 text-xs text-gray-500">(enter location first)</span>
                )}
              </span>
            </label>
            <DashboardLink />
          </div>
        </div>
        {weeklyMetrics && !isLoading && co2Savings && (() => {
          const nighttimeTemp = Number(userSettings?.winterThermostatNight ?? userSettings?.nighttimeTemp) || (indoorTemp - 2);
          return (
            <div className="mt-4 bg-green-900/30 border border-green-600/40 rounded-lg p-4">
              <p className="text-green-300 text-sm">
                This week your heat pump will cost <strong className="text-green-400">${weeklyMetrics.totalHPCost.toFixed(2)}</strong> vs <strong className="text-green-400">${weeklyMetrics.totalGasCost.toFixed(2)}</strong> on gas — about <strong className="text-green-400">${weeklyMetrics.totalSavings.toFixed(2)}</strong> saved for the same comfort.
              </p>
              <p className="text-green-400/70 text-xs mt-2">
                This assumes {formatTemperatureFromF(indoorTemp, unitSystem, { decimals: 0 })} day / {formatTemperatureFromF(nighttimeTemp, unitSystem, { decimals: 0 })} night
              </p>
            </div>
          );
        })()}
      </section>

      {/* ---------------- STEP 1 ---------------- */}
      {!simpleMode && (
      <section className="bg-[#11161e] border border-[#1f2937] rounded-xl p-6 mb-8">
        <h2 className="text-xl font-semibold text-white mb-1">Step 1 · Your Building & Systems</h2>
        <p className="text-gray-400 text-sm mb-6">
          Tell Joule what you're heating so we don't compare apples to igloos.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {/* ---- HOME DETAILS ---- */}
          <div>
            <h3 className="text-lg font-semibold text-blue-300 mb-1">Your Home</h3>
            <p className="text-gray-500 text-xs mb-3">size & shell</p>
            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-gray-300 mb-1">Home size (sq ft)</label>
                <input type="range" min="800" max="4000" step="100" value={squareFeet} onChange={(e) => setSquareFeetContext(Number(e.target.value))} className="w-full mb-2" />
                <span className="text-lg font-bold text-white">{squareFeet.toLocaleString()} sq ft</span>
                <p className="text-gray-500 text-xs mt-1">Heated floor area only.</p>
              </div>
              <div>
                <label className="block text-gray-300 mb-1">Insulation Quality</label>
                <select value={insulationLevel} onChange={(e) => setInsulationLevelContext(Number(e.target.value))} className={selectClasses}>
                  <option value={1.4}>Poor (pre-1980, minimal upgrades)</option>
                  <option value={1.0}>Average (1990s-2000s, code-min)</option>
                  <option value={0.65}>Good (post-2010, ENERGY STAR)</option>
                </select>
              </div>
              
              {/* Advanced Details Accordion */}
              <div className="border border-[#1c2733] rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowAdvancedDetails(!showAdvancedDetails)}
                  className="w-full flex items-center justify-between p-3 hover:bg-[#0c1218] transition-colors text-left"
                >
                  <span className="text-sm font-medium text-gray-300">Advanced details (optional)</span>
                  {showAdvancedDetails ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                {showAdvancedDetails && (
                  <div className="p-3 space-y-4 border-t border-[#1c2733] bg-[#0c1218]">
                    <div>
                      <label className="block text-gray-300 mb-1">Building Shape</label>
                      <select value={homeShape} onChange={(e) => setHomeShapeContext(Number(e.target.value))} className={selectClasses}>
                        <option value={0.9}>Two-Story (less exterior surface)</option>
                        <option value={1.0}>Split-Level / Standard</option>
                        <option value={1.1}>Ranch / Single-Story (more exterior surface)</option>
                        <option value={1.15}>Manufactured Home</option>
                        <option value={2.2}>Cabin / A-Frame</option>
                      </select>
                      <p className="text-gray-500 text-xs mt-1">Affects surface area exposure and heat loss.</p>
                      {/* Loft toggle - only show for Cabin/A-Frame */}
                      {homeShape >= 1.2 && homeShape < 1.3 && (
                        <div className="mt-3">
                          <label className="flex items-center text-sm font-medium text-gray-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={hasLoft}
                              onChange={(e) => setHasLoftContext(e.target.checked)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                            />
                            Has Loft (reduces effective square footage for heat loss)
                          </label>
                          <p className="text-gray-500 text-xs mt-1 ml-6">
                            For cabins with lofts, this adjusts the heat loss calculation to account for reduced exterior surface area, similar to a two-story home.
                          </p>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-gray-300 mb-1">Average Ceiling Height</label>
                      <select value={ceilingHeight} onChange={(e) => setCeilingHeightContext(Number(e.target.value))} className={selectClasses}>
                        <option value={8}>8 feet (standard)</option>
                        <option value={9}>9 feet</option>
                        <option value={10}>10 feet</option>
                        <option value={12}>12 feet (vaulted)</option>
                        <option value={16}>16+ feet (cathedral)</option>
                      </select>
                      <p className="text-gray-500 text-xs mt-1">Higher ceilings increase heating volume and energy needs.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* ---- SYSTEM CARDS ---- */}
          <div className="space-y-6">
            {/* HEAT PUMP CARD */}
            <div className="bg-[#0c1218] border border-[#1c2733] rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-300 mb-1">Heat Pump</h3>
              <p className="text-gray-500 text-xs mb-3">efficiency & size</p>
              <div className="space-y-4 text-sm">
                <div>
                  <label className="block text-gray-300 mb-1">Capacity</label>
                  <select value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className={selectClasses}>
                    {Object.entries(capacities).map(([btu, ton]) => (
                      <option key={btu} value={btu}>
                        {unitSystem === "intl" 
                          ? formatCapacityFromKbtuh(Number(btu), unitSystem) + ` (${btu}k BTU)`
                          : `${btu}k BTU (${ton} tons)`
                        }
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const capacityBTU = capacity * 1000;
                    const heatLossBTU = heatLoss;
                    const ratio = capacityBTU / heatLossBTU;
                    if (ratio > 2.5) {
                      return (
                        <p className="text-yellow-400 text-xs mt-2 flex items-start gap-1">
                          <Info size={14} className="flex-shrink-0 mt-0.5" />
                          <span>This is a very large system for an {squareFeet.toLocaleString()} sq ft space — that's okay if you're modeling reality.</span>
                        </p>
                      );
                    } else if (ratio < 0.8) {
                      return (
                        <p className="text-yellow-400 text-xs mt-2 flex items-start gap-1">
                          <Info size={14} className="flex-shrink-0 mt-0.5" />
                          <span><strong>This looks a bit undersized for your home's heat loss.</strong> If that matches the equipment you actually have, keep it – you're modeling reality.</span>
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Efficiency (HSPF2/SEER2)</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setEfficiency(15)}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
                        efficiency >= 14 && efficiency <= 15
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Standard (14-15)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEfficiency(17)}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
                        efficiency >= 16 && efficiency <= 17
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Good (16-17)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEfficiency(19)}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
                        efficiency >= 18 && efficiency <= 20
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      High (18-20)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEfficiency(21)}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
                        efficiency >= 21
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Premium (21+)
                    </button>
                  </div>
                  {showAdvancedDetails && (
                    <select value={efficiency} onChange={(e) => setEfficiency(Number(e.target.value))} className={selectClasses}>
                      {[14, 15, 16, 17, 18, 19, 20, 21, 22].map(seer => (
                        <option key={seer} value={seer}>{seer} SEER2</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Electricity Cost ($/kWh)</label>
                  <input type="range" min="0.05" max="0.50" step="0.01" value={utilityCost} onChange={(e) => setUtilityCost(Number(e.target.value))} className="w-full mb-2" />
                  <span className="text-lg font-bold text-white">${utilityCost.toFixed(2)} / kWh</span>
                </div>
              </div>
            </div>

            {/* GAS FURNACE CARD */}
            <div className="bg-[#0c1218] border border-[#1c2733] rounded-lg p-4">
              <h3 className="text-lg font-semibold text-red-300 mb-1">Gas Furnace</h3>
              <p className="text-gray-500 text-xs mb-3">efficiency & fuel price</p>
              <div className="space-y-4 text-sm">
                <div>
                  <label className="block text-gray-300 mb-1">AFUE (%)</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setGasFurnaceAFUE(0.80)}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
                        Math.round(gasFurnaceAFUE * 100) === 80
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      80% (old)
                    </button>
                    <button
                      type="button"
                      onClick={() => setGasFurnaceAFUE(0.90)}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
                        Math.round(gasFurnaceAFUE * 100) === 90
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      90%
                    </button>
                    <button
                      type="button"
                      onClick={() => setGasFurnaceAFUE(0.95)}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
                        Math.round(gasFurnaceAFUE * 100) >= 95
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      95%+ (high-efficiency)
                    </button>
                  </div>
                  <input type="range" min={80} max={98} value={gasFurnaceAFUE * 100} onChange={(e) => setGasFurnaceAFUE(Number(e.target.value) / 100)} className="w-full mb-2" />
                  <span className="text-lg font-bold text-white">{(gasFurnaceAFUE * 100).toFixed(0)}%</span>
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Gas Cost ($/therm)</label>
                  <input type="range" min="0.5" max="3.0" step="0.05" value={gasCostPerTherm} onChange={(e) => setGasCostPerTherm(Number(e.target.value))} className="w-full mb-2" />
                  <span className="text-lg font-bold text-white">${gasCostPerTherm.toFixed(2)} / therm</span>
                  <div className="mt-3 p-3 rounded-lg bg-[#0a0f14] border border-[#1c2733] space-y-2">
                    <GasMcfConverter onApply={(val) => setGasCostPerTherm(val)} />
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href="https://www.eia.gov/dnav/ng/ng_pri_sum_a_EPG0_PRS_DMcf_m.htm"
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-400 underline hover:text-blue-300"
                      >
                        EIA State Gas Prices
                      </a>
                      <button
                        type="button"
                        className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        onClick={() => setShowStatePickerModal(true)}
                        disabled={!eiaApiKey}
                      >
                        {!eiaApiKey ? 'API Key Required' : 'Fetch State Average'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-gray-500 text-xs">
          These inputs define your home's heat loss and how hard each system must work.
        </p>
      </section>
      )}

      {/* ---------------- STEP 2 ---------------- */}
      {!simpleMode && (
      <section className="bg-[#11161e] border border-[#1f2937] rounded-xl p-6 mb-8">
        <h2 className="text-xl font-semibold text-white mb-1">Step 2 · Weather for Your Home</h2>
        <p className="text-gray-400 text-sm mb-6">
          Joule uses next week's real forecast to simulate both systems hour-by-hour.
        </p>
        <p className="text-gray-400 text-sm mb-6">
          We pull the 7-day forecast for your address and run both systems through identical weather.
        </p>

        <div className="flex gap-3 items-center flex-wrap">
          <input
            type="text"
            value={locationQuery}
            onChange={e => setLocationQuery(e.target.value)}
            placeholder="City, State (e.g., Chicago, IL)"
            className={`${fullInputClasses} flex-1 min-w-[200px]`}
            onKeyDown={e => e.key === 'Enter' && handleCitySearch()}
          />
          <button onClick={handleCitySearch} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm">
            Search
          </button>
          <button onClick={handleLocationRequest} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm flex items-center gap-2">
            <MapPin size={18} />
            Use My Location
          </button>
        </div>

        <p className="text-gray-500 text-xs mt-3">
          Forecast temps drive the physics model — cold snaps and warm spells both matter.
        </p>

        {forecastDataSource && (
          <div className="mt-4 p-3 bg-blue-900/20 border border-blue-600/40 rounded-lg space-y-2">
            <p className="text-xs text-blue-300 flex items-center gap-2">
              <Info size={14} className="flex-shrink-0" />
              <span>
                <strong>Weather data source:</strong> {forecastDataSource === 'NWS' ? (
                  <>
                    <a 
                      href="https://www.weather.gov/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      National Weather Service (NWS)
                    </a>
                    {' '}— official US government forecast
                  </>
                ) : (
                  <>
                    <a 
                      href="https://open-meteo.com/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      Open-Meteo
                    </a>
                    {' '}— global weather API (used when NWS unavailable)
                  </>
                )}
              </span>
            </p>
            {forecastDataSource === 'NWS' && (
              <p className="text-xs text-blue-400/80 pl-5">
                <strong>Note:</strong> We use NWS hourly forecast data (better for cost calculations) and calculate daily min/max from hourly values. 
                The{' '}
                <a 
                  href="https://www.weather.gov/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline hover:text-blue-300"
                >
                  weather.gov website
                </a>
                {' '}shows official daily forecast periods, which may differ slightly. Both are valid — hourly data is more accurate for hour-by-hour energy cost modeling.
              </p>
            )}
          </div>
        )}

        {showCandidateList && geocodeCandidates.length > 0 && (
          <div className="mt-4 p-4 border-2 border-green-600/40 rounded-lg bg-green-900/20">
            <p className="text-sm font-semibold mb-3 text-green-300">Select a matching location:</p>
            <ul className="space-y-2">
              {geocodeCandidates.map(c => (
                <li key={`${c.latitude}-${c.longitude}`}>
                  <button
                    type="button"
                    onClick={() => handleCandidateSelect(c)}
                    className="text-left w-full px-3 py-2 rounded-lg bg-[#0c1218] hover:bg-[#141a22] border border-[#1c2733] text-gray-300 hover:text-white transition-colors"
                  >
                    {c.name}{c.admin1 ? `, ${c.admin1}` : ''}{c.country ? `, ${c.country}` : ''} ({c.latitude.toFixed(2)}, {c.longitude.toFixed(2)})
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {foundLocationName && (
          <div className="mt-4 p-3 bg-blue-900/20 border border-blue-600/40 rounded-lg">
            <p className="text-sm text-blue-300">
              <span className="font-semibold">Location:</span> {foundLocationName}
            </p>
          </div>
        )}

        {(warnings.extremeCold || warnings.overRuntime) && (
          <div className="mt-4 space-y-3">
            {warnings.extremeCold && (
              <div className="flex gap-3 p-4 rounded-lg border-2 bg-amber-900/20 border-amber-600/40">
                <AlertCircle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-300">
                  <p className="font-semibold mb-1">Extreme Cold Warning</p>
                  <p>Forecast includes sub-zero temperatures (≤ {formatTemperatureFromF(EXTREME_COLD_F, unitSystem, { decimals: 0 })}). Many heat pumps rely on auxiliary/backup heat in this range, which may increase actual electricity usage.</p>
                </div>
              </div>
            )}
            {warnings.overRuntime && (
              <div className="flex gap-3 p-4 rounded-lg border-2 bg-yellow-900/20 border-yellow-600/40">
                <AlertCircle size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-300">
                  <p className="font-semibold mb-1">Runtime Warning</p>
                  <p>At times the modeled heat pump would need to run over 100% duty cycle to maintain {formatTemperatureFromF(indoorTemp, unitSystem, { decimals: 0 })}. Real systems will either use backup heat or allow temperature drop, which can increase actual costs.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {lowHeatLossWarning && (
          <div className="mt-4 p-3 bg-amber-900/20 border border-amber-600/40 rounded-lg">
            <p className="text-sm text-amber-300">
              ⚠️ Heat loss appears unusually low. Double-check square footage, insulation and shape — costs may be understated.
            </p>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center gap-3 py-8">
            <svg className="animate-spin h-8 w-8 text-blue-400" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-gray-300 font-medium">Loading forecast...</p>
          </div>
        )}

        {displayError && (
          <div className="mt-4 flex gap-3 p-4 bg-red-900/20 border border-red-600/40 rounded-lg">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-red-300 font-medium">{displayError}</p>
          </div>
        )}
      </section>
      )}

      {/* Results & Bragging Rights Section */}
      {weeklyMetrics && !isLoading && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Results & Bragging Rights</h2>

          {/* Net Result One-Liner */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg border-l-4 border-blue-500 dark:border-blue-400">
            <p className="text-base text-gray-900 dark:text-white">
              <strong>Net result:</strong> your current heat pump setup is <strong className="text-blue-700 dark:text-blue-300">about ${Math.abs(weeklyMetrics.totalSavings).toFixed(2)} {weeklyMetrics.totalSavings >= 0 ? 'cheaper' : 'more expensive'}</strong> than gas over the next 7 days at this weather.
            </p>
          </div>

          {/* Top Summary Row - Three Big Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Card 1: Total Week Cost - Heat Pump */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-900 rounded-xl p-6 border-2 border-blue-300 dark:border-blue-700 shadow-lg">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">This week with your heat pump you'll spend:</h3>
              <p className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">${weeklyMetrics.totalHPCost.toFixed(2)}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Running your current heat pump with your settings and forecast.</p>
            </div>

            {/* Card 2: Total Week Cost - Gas Furnace */}
            <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-900 rounded-xl p-6 border-2 border-orange-300 dark:border-orange-700 shadow-lg">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">If you heated with gas instead, it would cost:</h3>
              <p className="text-4xl font-bold text-orange-600 dark:text-orange-400 mb-2">${weeklyMetrics.totalGasCost.toFixed(2)}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Same house, same weather, same comfort — just on gas.</p>
            </div>

            {/* Card 3: Savings & Annualized */}
            <div className={`bg-gradient-to-br ${weeklyMetrics.totalSavings >= 0 ? 'from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-900 border-4 border-green-400 dark:border-green-500' : 'from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-900 border-4 border-red-400 dark:border-red-500'} rounded-xl p-6 shadow-xl ring-2 ${weeklyMetrics.totalSavings >= 0 ? 'ring-green-300 dark:ring-green-600' : 'ring-red-300 dark:ring-red-600'} ring-opacity-50`}>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">You come out ahead by:</h3>
              <p className={`text-4xl font-bold mb-2 ${weeklyMetrics.totalSavings >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                ${weeklyMetrics.totalSavings.toFixed(2)}
              </p>
              <div className={`inline-block px-2 py-1 rounded-full text-xs font-semibold mb-2 ${weeklyMetrics.totalSavings >= 0 ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200' : 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'}`}>
                ≈ ${weeklyMetrics.estimatedAnnualSavings.toFixed(0)}/year at this pattern
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Assumes this week is roughly typical for your heating season.</p>
            </div>
          </div>

          {/* Pride Copy Block */}
          {weeklyMetrics.totalSavings >= 0 && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-xl p-6 mb-8 border-l-4 border-green-500 dark:border-green-400">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">In plain English:</h3>
              <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">
                With your setup, <strong className="font-bold text-gray-900 dark:text-white">your heat pump beats a gas furnace by about {((weeklyMetrics.totalSavings / weeklyMetrics.totalGasCost) * 100).toFixed(0)}% on energy cost for the same comfort.</strong>
              </p>
              <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">
                That's <strong className="text-green-700 dark:text-green-400">${weeklyMetrics.totalSavings.toFixed(2)}</strong> saved this week and roughly <strong className="text-green-700 dark:text-green-400">${weeklyMetrics.estimatedAnnualSavings.toFixed(0)}/year</strong> if this pattern holds.
              </p>
              <p className="text-sm text-gray-800 dark:text-gray-200 italic mb-2">
                Translation: your weird electric box is absolutely clowning on fossil heat.
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                Based on this week's forecast
              </p>
            </div>
          )}

          {/* Simple Mode Tip */}
          {simpleMode && weeklyMetrics && (() => {
            const nighttimeTemp = Number(userSettings?.winterThermostatNight ?? userSettings?.nighttimeTemp) || (indoorTemp - 2);
            return (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 mb-8">
                <p className="text-base text-gray-800 dark:text-gray-200">
                  <strong className="text-blue-700 dark:text-blue-300">To save more, lower your nighttime temp by {unitSystem === "intl" ? "1–2°C" : "1–2°F"}.</strong>
                </p>
              </div>
            );
          })()}


          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-6">
            {/* Heat Pump Cost */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-6 text-center shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-2">Total HP Cost (7 days)</h3>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">${weeklyMetrics.totalHPCost.toFixed(2)}</p>
            </div>

            {/* Gas Cost */}
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-2 border-orange-300 dark:border-orange-700 rounded-xl p-6 text-center shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-2">Total Gas Cost (7 days)</h3>
              <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">${weeklyMetrics.totalGasCost.toFixed(2)}</p>
            </div>

            {/* Weekly Savings */}
            <div className={`bg-gradient-to-br ${weeklyMetrics.totalSavings >= 0 ? 'from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-2 border-green-300 dark:border-green-700' : 'from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-2 border-red-300 dark:border-red-700'} rounded-xl p-6 text-center shadow-sm`}>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-2">Total Savings with HP</h3>
              <p className={`text-3xl font-bold ${weeklyMetrics.totalSavings >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                ${weeklyMetrics.totalSavings.toFixed(2)}
              </p>
            </div>

            {/* Annual Estimate */}
            <div className={`bg-gradient-to-br ${weeklyMetrics.estimatedAnnualSavings >= 0 ? 'from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-2 border-emerald-300 dark:border-emerald-700' : 'from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-2 border-red-300 dark:border-red-700'} rounded-xl p-6 text-center shadow-sm`}>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-2 flex items-center justify-center gap-2">
                Estimated Annual Savings
                <span title="Approximation: This week's savings × 26 heating weeks/year." className="cursor-help">
                  <Info size={16} className={`${weeklyMetrics.estimatedAnnualSavings >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} />
                </span>
              </h3>
              <p className={`text-3xl font-bold ${weeklyMetrics.estimatedAnnualSavings >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                ${weeklyMetrics.estimatedAnnualSavings.toFixed(0)}
              </p>
            </div>
          </div>

          {/* Daily Breakdown Table */}
          {!simpleMode && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Daily Breakdown – How Each Day Stacked Up</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Colder days tilt toward gas being more expensive. Mild days are where heat pumps really flex.
            </p>

          {/* Mobile cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {weeklyMetrics.summary.map((day) => (
              <div key={day.day} className="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-gray-900 dark:text-gray-100">{day.day}</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {formatTemperatureFromF(day.lowTemp, unitSystem, { decimals: 0, withUnit: false })}–{formatTemperatureFromF(day.highTemp, unitSystem, { decimals: 0 })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                    {day.savings >= 0 && <span>🟢</span>}
                    HP: ${day.hpCost.toFixed(2)}
                  </span>
                  <span className="text-orange-600 dark:text-orange-400 font-semibold flex items-center gap-1">
                    {day.savings < 0 && <span>🔴</span>}
                    Gas: ${day.gasCost.toFixed(2)}
                  </span>
                  <span className={`font-bold flex items-center gap-1 ${day.savings >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {day.savings >= 0 ? <span>⬆</span> : <span>⬇</span>}
                    ${day.savings.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-hidden rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900 border-b-2 border-gray-200 dark:border-gray-700">
                    <th className="p-4 font-bold text-gray-900 dark:text-gray-100">Day</th>
                    <th className="p-4 font-bold text-gray-900 dark:text-gray-100">Temp Range ({unitSystem === "intl" ? "°C" : "°F"})</th>
                    <th className="p-4 font-bold text-blue-600 dark:text-blue-400 text-right">Heat Pump Cost</th>
                    <th className="p-4 font-bold text-orange-600 dark:text-orange-400 text-right">Gas Cost</th>
                    <th className="p-4 font-bold text-gray-900 dark:text-gray-100 text-right">You Saved</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyMetrics.summary.map((day, idx) => (
                    <tr key={day.day} className={`${idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'} hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors`}>
                      <td className="p-4 font-semibold text-gray-900 dark:text-gray-100">{day.day}</td>
                      <td className="p-4 text-gray-700 dark:text-gray-300">
                        {formatTemperatureFromF(day.lowTemp, unitSystem, { decimals: 0, withUnit: false })}–{formatTemperatureFromF(day.highTemp, unitSystem, { decimals: 0 })}
                      </td>
                      <td className="p-4 font-semibold text-blue-600 dark:text-blue-400 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {day.savings >= 0 && <span className="text-green-600 dark:text-green-400">🟢</span>}
                          ${day.hpCost.toFixed(2)}
                        </div>
                      </td>
                      <td className="p-4 font-semibold text-orange-600 dark:text-orange-400 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {day.savings < 0 && <span className="text-red-600 dark:text-red-400">🔴</span>}
                          ${day.gasCost.toFixed(2)}
                        </div>
                      </td>
                      <td className={`p-4 font-bold text-right ${day.savings >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        <div className="flex items-center justify-end gap-2">
                          {day.savings >= 0 ? (
                            <span className="text-green-600 dark:text-green-400">⬆</span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400">⬇</span>
                          )}
                          ${day.savings.toFixed(2)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(() => {
              // Find days with biggest savings
              const daysWithSavings = weeklyMetrics.summary
                .filter(day => day.savings > 0)
                .sort((a, b) => b.savings - a.savings);
              
              if (daysWithSavings.length === 0) {
                return null;
              }
              
              // Get top 2-3 days with biggest savings
              const topDays = daysWithSavings.slice(0, 3);
              const dayNames = topDays.map(d => d.day);
              const dayNamesStr = dayNames.length === 1 
                ? dayNames[0]
                : dayNames.length === 2
                ? `${dayNames[0]} & ${dayNames[1]}`
                : `${dayNames.slice(0, -1).join(', ')}, & ${dayNames[dayNames.length - 1]}`;
              
              // Find common temperature pattern
              const allBelow40 = topDays.every(d => d.highTemp < 40);
              const allBelow50 = topDays.every(d => d.highTemp < 50);
              const tempPattern = allBelow40 
                ? 'when temps stay below 40°F all day'
                : allBelow50
                ? 'when temps stay below 50°F all day'
                : `when temps averaged ${Math.round(topDays.reduce((sum, d) => sum + (d.lowTemp + d.highTemp) / 2, 0) / topDays.length)}°F`;
              
              return (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-4 text-center">
                  <strong className="text-gray-900 dark:text-gray-100">Biggest savings: {dayNamesStr}, {tempPattern}.</strong>
                </p>
              );
            })()}
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center">
              Total this week: <strong className="text-blue-600 dark:text-blue-400">${weeklyMetrics.totalHPCost.toFixed(2)}</strong> on heat pump vs <strong className="text-orange-600 dark:text-orange-400">${weeklyMetrics.totalGasCost.toFixed(2)}</strong> on gas — you kept <strong className="text-green-600 dark:text-green-400">${weeklyMetrics.totalSavings.toFixed(2)}</strong> in your pocket.
            </p>
          </div>
          )}

          {/* Use These Results micro-CTA */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 mb-8 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">What you can actually do with this:</h3>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300 mb-4">
              <li>💬 <strong>Share this with your HVAC tech</strong> if you're planning changes.</li>
              <li>🧮 <strong>Use it to compare quotes:</strong> plug in the new equipment's efficiency and see how it pencils out.</li>
              <li>📎 <strong>Download the brag sheet</strong> if you want something to send to friends / HOA / Facebook group.</li>
            </ul>
            <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white font-semibold rounded-lg transition-colors text-sm">
              Download brag sheet (PDF)
            </button>
          </div>
        </div>
      )}

      {/* Calculation Methodology Section - Expanded Details */}
      {!simpleMode && weeklyMetrics && !isLoading && (
        <div className="bg-[#11161e] border border-[#1f2937] rounded-xl shadow-lg overflow-hidden">
          <button
            onClick={() => setShowCalculations(!showCalculations)}
            className="w-full flex items-center justify-between p-6 hover:bg-[#0c1218] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                <Calculator size={24} className="text-white" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-white">Show the math (for engineers, nerds, and inspectors)</h3>
              </div>
            </div>
            {showCalculations ? (
              <ChevronUp className="w-6 h-6 text-gray-400" />
            ) : (
              <ChevronDown className="w-6 h-6 text-gray-400" />
            )}
          </button>

          {showCalculations && (
            <div className="px-6 pb-6 space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                We simulate both systems hour-by-hour using:
              </p>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300 mb-4 list-disc list-inside">
                <li>Your home size, insulation, and ceiling height</li>
                <li>A simplified Manual-J-style heat loss model</li>
                <li>Rated efficiency for your heat pump and the comparison furnace</li>
                <li>Local 7-day weather forecast</li>
              </ul>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                We then convert total BTUs into cost using your electricity and gas rates.
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Share this with your installer if they want the details.
              </p>
              <div className="mt-6 space-y-6">
                {/* TL;DR Summary */}
                <div>
                  <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-sm overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                    # TL;DR: At your {squareFeet.toLocaleString()} sq ft / {heatLoss.toLocaleString()} BTU/hr design loss, the heat pump wins this week by {((weeklyMetrics.totalSavings / weeklyMetrics.totalGasCost) * 100).toFixed(0)}% on fuel cost.
                  </code>
                </div>
                {/* Building Heat Loss Calculation */}
            <div>
              <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Building Heat Loss</h4>
              <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                Base BTU/sq ft: 22.67 BTU/hr/°F per sq ft<br />
                Square Feet: {squareFeet.toLocaleString()} sq ft<br />
                Insulation Factor: {insulationLevel.toFixed(2)}x<br />
                Home Shape Factor: {homeShape.toFixed(2)}x<br />
                Ceiling Height Multiplier: {(1 + (ceilingHeight - 8) * 0.1).toFixed(3)}x<br />
                <br />
                Total Heat Loss @ 70°F ΔT: <strong>{heatLoss.toLocaleString()} BTU/hr</strong><br />
                = {squareFeet.toLocaleString()} * 22.67 * {insulationLevel.toFixed(2)} * {homeShape.toFixed(2)} * {(1 + (ceilingHeight - 8) * 0.1).toFixed(3)}<br />
                <br />
                BTU Loss per °F: <strong>{(heatLoss / 70).toFixed(1)} BTU/hr/°F</strong>
              </code>
            </div>

                {/* Heat Pump Calculations */}
                <div>
                  <h4 className="font-bold text-lg mb-3 text-white">Heat Pump System</h4>
                  <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                Capacity: {capacity}k BTU ({tons} tons)<br />
                SEER2: {efficiency}<br />
                Compressor Power: <strong>{(compressorPower).toFixed(2)} kW</strong><br />
                = {tons} tons * 1.0 * (15 / {efficiency})<br />
                <br />
                Performance at 35°F (example):<br />
                {(() => {
                    const exampleTemp = 35;
                    const exampleHumidity = 50;
                    const examplePerf = getPerformanceAtTemp(exampleTemp, exampleHumidity);
                    // Match the exact logic from getPerformanceAtTemp
                    let capacityFactor = 1.0;
                    if (exampleTemp < 47) capacityFactor = 1.0 - (47 - exampleTemp) * 0.01;
                    if (exampleTemp < 17) capacityFactor = 0.70 - (17 - exampleTemp) * 0.0074;
                    const capacityFactorClamped = Math.max(0.3, capacityFactor);
                    const powerFactor = 1 / Math.max(0.7, capacityFactorClamped);
                    const baseKw = compressorPower * powerFactor;
                    const defrostPenalty = getDefrostPenalty(exampleTemp, exampleHumidity);
                    const electricalKw = baseKw * defrostPenalty;
                    const heatpumpOutputBtu = (tons * 3.517 * capacityFactorClamped) * 3412.14;
                    const tempDiff = Math.max(1, indoorTemp - exampleTemp);
                    const buildingHeatLossBtu = (heatLoss / 70) * tempDiff;
                    const runtime = heatpumpOutputBtu > 0 ? (buildingHeatLossBtu / heatpumpOutputBtu) * 100 : 100;
                    const runtimeClamped = Math.min(100, Math.max(0, runtime));
                    return (
                      <>
                        Capacity Factor: <strong>{capacityFactorClamped.toFixed(3)}</strong><br />
                        Power Factor: <strong>{powerFactor.toFixed(3)}</strong><br />
                        Defrost Penalty: <strong>{defrostPenalty.toFixed(3)}</strong><br />
                        Electrical Power: <strong>{electricalKw.toFixed(2)} kW</strong><br />
                        Heat Output: <strong>{(heatpumpOutputBtu / 1000).toFixed(0)}k BTU/hr</strong><br />
                        Building Heat Loss: <strong>{(buildingHeatLossBtu / 1000).toFixed(0)}k BTU/hr</strong><br />
                        Runtime: <strong>{runtimeClamped.toFixed(1)}%</strong><br />
                        <br />
                        Hourly Cost @ {runtimeClamped.toFixed(1)}%: <strong>${(electricalKw * (runtimeClamped / 100) * utilityCost).toFixed(3)}</strong><br />
                        = {electricalKw.toFixed(2)} kW * ({runtimeClamped.toFixed(1)}% / 100) * ${utilityCost.toFixed(2)}/kWh
                      </>
                    );
                  })()}
              </code>
            </div>

                {/* Gas Furnace Calculations */}
                <div>
                  <h4 className="font-bold text-lg mb-3 text-white">Gas Furnace System</h4>
                  <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                AFUE: <strong>{(gasFurnaceAFUE * 100).toFixed(0)}%</strong><br />
                Gas Cost: <strong>${gasCostPerTherm.toFixed(2)} / therm</strong><br />
                <br />
                Performance at 35°F (example):<br />
                {(() => {
                    const exampleTemp = 35;
                    const examplePerf = getPerformanceAtTemp(exampleTemp, 50);
                    const tempDiff = Math.max(1, indoorTemp - exampleTemp);
                    const buildingHeatLossBtu = (heatLoss / 70) * tempDiff;
                    const gasEnergyInputBtu = buildingHeatLossBtu / gasFurnaceAFUE;
                    const thermsUsed = gasEnergyInputBtu / 100000;
                    const gasCostForHour = thermsUsed * gasCostPerTherm;
                    return (
                      <>
                        Building Heat Loss: <strong>{(buildingHeatLossBtu / 1000).toFixed(0)}k BTU/hr</strong><br />
                        Gas Energy Input: <strong>{(gasEnergyInputBtu / 1000).toFixed(0)}k BTU/hr</strong><br />
                        = {(buildingHeatLossBtu / 1000).toFixed(0)}k / {(gasFurnaceAFUE * 100).toFixed(0)}%<br />
                        Therms per Hour: <strong>{thermsUsed.toFixed(4)}</strong><br />
                        = {(gasEnergyInputBtu / 1000).toFixed(0)}k / 100,000<br />
                        <br />
                        Hourly Cost: <strong>${gasCostForHour.toFixed(3)}</strong><br />
                        = {thermsUsed.toFixed(4)} therms * ${gasCostPerTherm.toFixed(2)}/therm
                      </>
                    );
                  })()}
              </code>
            </div>

                {/* Weekly Summary Calculations */}
                {weeklyMetrics && (
                  <div>
                    <h4 className="font-bold text-lg mb-3 text-white">Weekly Summary</h4>
                    <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                  Total HP Cost (7 days): <strong>${weeklyMetrics.totalHPCost.toFixed(2)}</strong><br />
                  Total Gas Cost (7 days): <strong>${weeklyMetrics.totalGasCost.toFixed(2)}</strong><br />
                  <br />
                  Weekly Savings: <strong>${weeklyMetrics.totalSavings.toFixed(2)}</strong><br />
                  = ${weeklyMetrics.totalGasCost.toFixed(2)} - ${weeklyMetrics.totalHPCost.toFixed(2)}<br />
                  <br />
                  Estimated Annual Savings: <strong>${weeklyMetrics.estimatedAnnualSavings.toFixed(0)}</strong><br />
                  = ${weeklyMetrics.totalSavings.toFixed(2)} * 26 heating weeks/year
                </code>
              </div>
            )}
              </div>
          </div>
        )}
      </div>
      )}

      {/* State Picker Modal for EIA Gas Price Fetch */}
      {showStatePickerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 border-2 border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Select State for Gas Price</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Choose a state to fetch the latest average residential natural gas price from the EIA.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
              Note: FL, LA, MD, ME, SC, WA, WY currently have no EIA residential gas price data.
            </p>

            {gasPriceFetchError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg text-sm text-red-800 dark:text-red-200">
                {gasPriceFetchError}
              </div>
            )}

            <select
              id="state-select"
              className={`${selectClasses} mb-4 p-3`}
              defaultValue=""
            >
              <option value="" disabled>Select a state...</option>
              {Object.entries(STATE_ABBR).map(([abbr, name]) => (
                <option key={abbr} value={abbr}>{name} ({abbr})</option>
              ))}
            </select>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  const select = document.getElementById('state-select');
                  const selectedState = select?.value;
                  if (selectedState) {
                    handleFetchStateAverage(selectedState);
                  }
                }}
                disabled={fetchingGasPrice}
                className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transform hover:scale-105 transition-all"
              >
                {fetchingGasPrice ? 'Fetching...' : 'Fetch Price'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowStatePickerModal(false);
                  setGasPriceFetchError(null);
                }}
                className="px-4 py-3 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 font-semibold rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GasVsHeatPump;

// --- Inline helper component: Convert $/Mcf to $/therm ---
// Placed after export to avoid re-render concerns; can be extracted later.
function GasMcfConverter({ onApply }) {
  const [mcfPrice, setMcfPrice] = React.useState('');
  const [converted, setConverted] = React.useState(null);
  const FACTOR = 10.37; // 1 Mcf ≈ 10.37 therms

  const handleConvert = () => {
    const val = parseFloat(mcfPrice);
    if (isNaN(val) || val <= 0) {
      setConverted(null);
      return;
    }
    const perTherm = val / FACTOR;
    setConverted(perTherm);
  };

  const handleApply = () => {
    if (converted && onApply) onApply(Number(converted.toFixed(4)));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={mcfPrice}
          onChange={(e) => setMcfPrice(e.target.value)}
          placeholder="$ / Mcf"
          step="0.01"
          className={`${inputClasses} w-28 text-xs`}
          aria-label="Gas price in dollars per Mcf"
        />
        <button
          type="button"
          onClick={handleConvert}
          className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-600"
        >Convert</button>
        {converted !== null && (
          <button
            type="button"
            onClick={handleApply}
            className="px-2 py-1 text-xs rounded bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600"
            title="Apply converted $/therm to Gas Cost slider"
          >Apply</button>
        )}
      </div>
      {converted !== null && (
        <p className="text-[10px] text-gray-600 dark:text-gray-300">≈ ${converted.toFixed(4)} / therm (using 1 Mcf ≈ 10.37 therms)</p>
      )}
      <p className="text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">If your source gives $/Mcf (EIA, wholesale), convert here. For best accuracy, prefer the $/therm value from your utility bill.</p>
    </div>
  );
}