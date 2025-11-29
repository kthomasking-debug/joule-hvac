import React, { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Zap, MapPin, Info, Flame, Home, TrendingUp, AlertCircle } from 'lucide-react';
import { inputClasses, fullInputClasses, selectClasses } from '../lib/uiClasses';
import { DashboardLink } from '../components/DashboardLink';
import { fetchGeocodeCandidates, chooseBestCandidate, reverseGeocode } from '../utils/geocode';
import { fetchStateAverageGasPrice } from '../lib/eia';

const GasVsHeatPump = () => {
  const EXTREME_COLD_F = 0; // Default threshold for extreme cold advisory

  // Extract context
  const outletContext = useOutletContext() || {};
  const { userSettings, setUserSetting } = outletContext || {};
  // Extract building characteristics from userSettings/context
  const squareFeet = Number(userSettings?.squareFeet) || outletContext?.squareFeet || 1500;
  const setSquareFeetContext = (v) => setUserSetting ? setUserSetting('squareFeet', v) : (outletContext?.setSquareFeet || (() => { }))(v);
  const insulationLevel = Number(userSettings?.insulationLevel) || outletContext?.insulationLevel || 1.0;
  const setInsulationLevelContext = (v) => setUserSetting ? setUserSetting('insulationLevel', v) : (outletContext?.setInsulationLevel || (() => { }))(v);
  const homeShape = Number(userSettings?.homeShape) || outletContext?.homeShape || 1.0;
  const setHomeShapeContext = (v) => setUserSetting ? setUserSetting('homeShape', v) : (outletContext?.setHomeShape || (() => { }))(v);
  const ceilingHeight = Number(userSettings?.ceilingHeight) || outletContext?.ceilingHeight || 8;
  const setCeilingHeightContext = (v) => setUserSetting ? setUserSetting('ceilingHeight', v) : (outletContext?.setCeilingHeight || (() => { }))(v);
  const contextIndoorTemp = Number(userSettings?.indoorTemp ?? userSettings?.winterThermostat) || outletContext?.indoorTemp || 70;
  const contextCapacity = userSettings?.capacity || outletContext?.capacity || 24;
  const contextEfficiency = Number(userSettings?.efficiency) || outletContext?.efficiency || 15;
  const contextUtilityCost = Number(userSettings?.utilityCost) || outletContext?.utilityCost || 0.10;
  const contextGasCost = Number(userSettings?.gasCost) || outletContext?.gasCost || 1.50; // Get gas cost from context/onboarding

  // --- System Configuration (use context if available, otherwise local state) ---
  const [capacity, setCapacity] = useState(contextCapacity);
  const [efficiency, setEfficiency] = useState(contextEfficiency);
  const [indoorTemp] = useState(contextIndoorTemp);
  const [utilityCost, setUtilityCost] = useState(contextUtilityCost);

  // --- New Gas Furnace Inputs ---
  const [gasFurnaceAFUE, setGasFurnaceAFUE] = useState(0.95); // 95% AFUE
  const [gasCostPerTherm, setGasCostPerTherm] = useState(contextGasCost); // Use gas cost from onboarding

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
        const { city, state } = JSON.parse(savedLocation);
        if (city && state) {
          return `${city}, ${state}`;
        }
      }
    } catch (e) {
      console.error('Failed to load saved location:', e);
    }
    return "Chicago, IL"; // Default fallback
  });
  const [location, setLocation] = useState(null);
  const [foundLocationName, setFoundLocationName] = useState("");
  const [forecast, setForecast] = useState(null);
  const [forecastTimezone, setForecastTimezone] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [geocodeCandidates, setGeocodeCandidates] = useState([]);
  const [showCandidateList, setShowCandidateList] = useState(false);
  const [lowHeatLossWarning, setLowHeatLossWarning] = useState(false);

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
    const calculatedHeatLoss = squareFeet * baseBtuPerSqFt * insulationLevel * homeShape * ceilingMultiplier;
    const rounded = Math.round(calculatedHeatLoss / 1000) * 1000;
    setHeatLoss(rounded);
    setLowHeatLossWarning(rounded < 10000); // Warn if abnormally low, likely invalid inputs
  }, [squareFeet, insulationLevel, homeShape, ceilingHeight]);

  // Update gas cost when context changes (from onboarding or settings)
  useEffect(() => {
    if (contextGasCost && contextGasCost !== gasCostPerTherm) {
      setGasCostPerTherm(contextGasCost);
    }
  }, [contextGasCost]);

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

    let defrostPenalty = 1.0;
    const humidityRatio = humidity / 100;
    if (outdoorTemp > 20 && outdoorTemp < 45) {
      defrostPenalty = 1 + (0.15 * humidityRatio);
    }
    const electricalKw = baseElectricalKw * defrostPenalty;

    const heatpumpOutputBtu = (tons * 3.517 * capacityFactor) * 3412.14;

    let runtimePercentage = heatpumpOutputBtu > 0 ? (buildingHeatLossBtu / heatpumpOutputBtu) * 100 : 100;
    runtimePercentage = Math.min(100, Math.max(0, runtimePercentage));

    return { electricalKw, runtime: runtimePercentage, buildingHeatLossBtu };
  }, [indoorTemp, compressorPower, efficiency, heatLoss, tons]);

  const handleCitySearch = async () => {
    if (!locationQuery) return setError("Please enter a city (e.g., 'Chicago, IL').");
    setLoading(true);
    setError(null);
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
        setLoading(false);
        return; // Wait for user to pick
      }

      const bestResult = chooseBestCandidate(prioritized);
      setLocation({ latitude: bestResult.latitude, longitude: bestResult.longitude });
      setFoundLocationName(`${bestResult.name}${bestResult.admin1 ? ', ' + bestResult.admin1 : ''}${bestResult.country ? ', ' + bestResult.country : ''}`);
    } catch (e) {
      setError(e.message);
      setLoading(false);
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
      setError('Geolocation is not available in this environment.');
      return;
    }

    // Helpful hint when running on an insecure origin (browsers block geolocation on HTTP except localhost).
    if (typeof window !== 'undefined' && !window.isSecureContext && !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) {
      setError('Location requires HTTPS (or localhost) in browsers. Use city search or switch to https.');
      return;
    }

    setLoading(true);
    setError(null);

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
      setError(msg);
    } finally {
      setLoading(false);
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

  // Auto-search location on mount (uses location from onboarding if available)
  useEffect(() => { handleCitySearch(); }, []);

  useEffect(() => {
    if (!location) return;
    const fetchWeather = async () => {
      setLoading(true);
      setError(null);
      try {
        // Request humidity & dew point (some older naming variations included for robustness)
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&hourly=temperature_2m,relativehumidity_2m,relative_humidity_2m,dew_point_2m&temperature_unit=fahrenheit&timeformat=unixtime&forecast_days=7&timezone=auto`);
        if (!response.ok) throw new Error('Weather data not available.');
        const data = await response.json();
        const temps = data?.hourly?.temperature_2m || [];
        const humidityA = data?.hourly?.relativehumidity_2m || [];
        const humidityB = data?.hourly?.relative_humidity_2m || [];
        const dewpoints = data?.hourly?.dew_point_2m || [];
        const times = data?.hourly?.time || [];

        const processedForecast = times.map((t, i) => {
          const temp = temps[i];
          let humidity = humidityA[i] ?? humidityB[i];
          // Fallback: derive relative humidity from dewpoint if missing
          if ((humidity === undefined || humidity === null) && dewpoints[i] !== undefined && temp !== undefined) {
            // Convert Fahrenheit to Celsius for Magnus formula
            const TdC = (dewpoints[i] - 32) * 5 / 9;
            const TC = (temp - 32) * 5 / 9;
            // Approximation using Magnus formula (over water)
            const esTd = Math.exp((17.625 * TdC) / (243.04 + TdC));
            const esT = Math.exp((17.625 * TC) / (243.04 + TC));
            humidity = Math.min(100, Math.max(0, (esTd / esT) * 100));
          }
          if (humidity === undefined || humidity === null || isNaN(humidity)) humidity = 50; // Final fallback
          return {
            timeMs: t * 1000,
            temp,
            humidity,
          };
        });
        setForecastTimezone(data.timezone || null);
        setForecast(processedForecast);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchWeather();
  }, [location]);

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

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">7-Day Cost Comparison</h2>
          <p className="text-gray-600 dark:text-gray-400">Compare heat pump vs. gas furnace costs for your home</p>
        </div>
        <DashboardLink />
      </div>

      {/* Step 1: Building & Systems (inputs grouped together) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
            <Home size={24} className="text-white" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Step 1: Your Building & Systems</h3>
        </div>
        {/* Building Characteristics Sub-section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Square Footage</label>
            <input type="range" min="800" max="4000" step="100" value={squareFeet} onChange={(e) => setSquareFeetContext(Number(e.target.value))} className="w-full mb-2" />
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{squareFeet.toLocaleString()} sq ft</span>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Insulation</label>
            <select value={insulationLevel} onChange={(e) => setInsulationLevelContext(Number(e.target.value))} className={selectClasses}>
              <option value={1.4}>Poor</option>
              <option value={1.0}>Average</option>
              <option value={0.65}>Good</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Home Shape</label>
            <select value={homeShape} onChange={(e) => setHomeShapeContext(Number(e.target.value))} className={selectClasses}>
              <option value={1.3}>Cabin/A-Frame</option>
              <option value={1.15}>Ranch</option>
              <option value={1.0}>Average</option>
              <option value={0.9}>2-Story</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Ceiling Height</label>
            <input type="range" min="7" max="20" step="1" value={ceilingHeight} onChange={(e) => setCeilingHeightContext(Number(e.target.value))} className="w-full mb-2" />
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{ceilingHeight} ft</span>
          </div>
        </div>
        {/* System Comparison Sub-section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {/* Heat Pump Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-xl shadow-lg p-6 border-2 border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                <Zap size={24} className="text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Heat Pump</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Capacity
                  <button className="group relative">
                    <Info size={14} className="text-gray-500" />
                    <span className="invisible group-hover:visible absolute left-0 top-6 w-48 bg-gray-900 text-white text-xs rounded p-2 z-10">
                      Nominal heating/cooling size of the heat pump
                    </span>
                  </button>
                </label>
                <select value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className={selectClasses}>
                  {Object.entries(capacities).map(([btu, ton]) => (
                    <option key={btu} value={btu}>{btu}k BTU ({ton} tons)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  SEER2
                  <button className="group relative">
                    <Info size={14} className="text-gray-500" />
                    <span className="invisible group-hover:visible absolute left-0 top-6 w-48 bg-gray-900 text-white text-xs rounded p-2 z-10">
                      Seasonal Energy Efficiency Ratio 2. Higher is better
                    </span>
                  </button>
                </label>
                <select value={efficiency} onChange={(e) => setEfficiency(Number(e.target.value))} className={selectClasses}>
                  {[14, 15, 16, 17, 18, 19, 20, 21, 22].map(seer => (
                    <option key={seer} value={seer}>{seer} SEER2</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Electricity Cost</label>
                <input type="range" min="0.05" max="0.50" step="0.01" value={utilityCost} onChange={(e) => setUtilityCost(Number(e.target.value))} className="w-full mb-2" />
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">${utilityCost.toFixed(2)} / kWh</span>
              </div>
            </div>
          </div>

          {/* Gas Furnace Card */}
          <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 rounded-xl shadow-lg p-6 border-2 border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg">
                <Flame size={24} className="text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Gas Furnace</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Efficiency (AFUE)
                  <button className="group relative">
                    <Info size={14} className="text-gray-500" />
                    <span className="invisible group-hover:visible absolute left-0 top-6 w-64 bg-gray-900 text-white text-xs rounded p-2 z-10">
                      98-90%: High-Efficiency (PVC vent)<br />
                      90-80%: Standard (Metal vent)<br />
                      &lt;80%: Legacy (Pilot light)
                    </span>
                  </button>
                </label>
                <input type="range" min={80} max={98} value={gasFurnaceAFUE * 100} onChange={(e) => setGasFurnaceAFUE(Number(e.target.value) / 100)} className="w-full mb-2" />
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{(gasFurnaceAFUE * 100).toFixed(0)}%</span>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Gas Cost
                  <button className="group relative">
                    <Info size={14} className="text-gray-500" />
                    <span className="invisible group-hover:visible absolute left-0 top-6 w-64 bg-gray-900 text-white text-xs rounded p-2 z-10">
                      Check your utility bill. If you have $/Mcf, convert: 1 Mcf ≈ 10.37 therms
                    </span>
                  </button>
                </label>
                <input type="range" min="0.5" max="3.0" step="0.05" value={gasCostPerTherm} onChange={(e) => setGasCostPerTherm(Number(e.target.value))} className="w-full mb-2" />
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">${gasCostPerTherm.toFixed(2)} / therm</span>

                <div className="mt-3 p-3 rounded-lg bg-white dark:bg-gray-900 border border-orange-200 dark:border-orange-800 space-y-2">
                  <GasMcfConverter onApply={(val) => setGasCostPerTherm(val)} />
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href="https://www.eia.gov/dnav/ng/ng_pri_sum_a_EPG0_PRS_DMcf_m.htm"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      EIA State Gas Prices
                    </a>
                    <button
                      type="button"
                      className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

      {/* Weather & Forecast Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
            <MapPin size={24} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Step 2: Get Weather Forecast</h2>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            value={locationQuery}
            onChange={e => setLocationQuery(e.target.value)}
            placeholder="City, State (e.g., Chicago, IL)"
            className={`${fullInputClasses} flex-1`}
            onKeyDown={e => e.key === 'Enter' && handleCitySearch()}
          />
          <button onClick={handleCitySearch} className="px-6 py-3 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg transform hover:scale-105">
            Search
          </button>
          <button onClick={handleLocationRequest} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
            <MapPin size={18} />
            Use My Location
          </button>
        </div>

        {showCandidateList && geocodeCandidates.length > 0 && (
          <div className="mb-4 p-4 border-2 border-green-200 dark:border-green-800 rounded-lg bg-green-50 dark:bg-green-950">
            <p className="text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">Select a matching location:</p>
            <ul className="space-y-2">
              {geocodeCandidates.map(c => (
                <li key={`${c.latitude}-${c.longitude}`}>
                  <button
                    type="button"
                    onClick={() => handleCandidateSelect(c)}
                    className={`text-left ${fullInputClasses} px-3 py-2 rounded-lg bg-white dark:bg-gray-800 hover:bg-green-100 dark:hover:bg-green-900 focus:outline-none focus:ring-2 focus:ring-green-400 text-gray-900 dark:text-gray-100 transition-colors`}
                  >
                    {c.name}{c.admin1 ? `, ${c.admin1}` : ''}{c.country ? `, ${c.country}` : ''} ({c.latitude.toFixed(2)}, {c.longitude.toFixed(2)})
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {foundLocationName && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-semibold">Location:</span> {foundLocationName}
            </p>
          </div>
        )}

        {(warnings.extremeCold || warnings.overRuntime) && (
          <div className="mb-4 space-y-3">
            {warnings.extremeCold && (
              <div className="flex gap-3 p-4 rounded-lg border-2 bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-700">
                <AlertCircle size={20} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-semibold mb-1">Extreme Cold Warning</p>
                  <p>Forecast includes sub-zero temperatures (≤ {EXTREME_COLD_F}°F). Many heat pumps rely on auxiliary/backup heat in this range, which may increase actual electricity usage.</p>
                </div>
              </div>
            )}
            {warnings.overRuntime && (
              <div className="flex gap-3 p-4 rounded-lg border-2 bg-yellow-50 dark:bg-yellow-950 border-yellow-300 dark:border-yellow-700">
                <AlertCircle size={20} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  <p className="font-semibold mb-1">Runtime Warning</p>
                  <p>At times the modeled heat pump would need to run over 100% duty cycle to maintain {indoorTemp}°F. Real systems will either use backup heat or allow temperature drop, which can increase actual costs.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {lowHeatLossWarning && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 rounded-lg">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              ⚠️ Heat loss appears unusually low. Double-check square footage, insulation and shape — costs may be understated.
            </p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-3 py-8">
            <svg className="animate-spin h-8 w-8 text-green-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-gray-700 dark:text-gray-300 font-medium">Loading forecast...</p>
          </div>
        )}

        {error && (
          <div className="flex gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-red-700 dark:text-red-300 font-medium">{error}</p>
          </div>
        )}
        {/* Results moved to a dedicated section below */}
      </div>

      {/* Results & Insight Section (centralized at the end) */}
      {weeklyMetrics && !loading && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg"><TrendingUp size={24} className="text-white" /></div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Results & Insight</h2>
          </div>
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

          {/* Diagnostic Insight Box */}
          <div className={`mb-6 p-6 rounded-xl border-l-4 shadow-md ${weeklyMetrics.totalSavings >= 0 ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-l-green-600 dark:border-l-green-400' : 'bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 border-l-red-600 dark:border-l-red-400'}`}>
            <h3 className={`font-bold text-lg mb-3 flex items-center gap-2 ${weeklyMetrics.totalSavings >= 0 ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
              <TrendingUp size={20} />
              Insight
            </h3>
            <p className={`text-sm leading-relaxed ${weeklyMetrics.totalSavings >= 0 ? 'text-green-700 dark:text-green-200' : 'text-red-700 dark:text-red-200'}`}>
              {weeklyMetrics.totalSavings >= 0
                ? `In this scenario, the heat pump is more economical. This is common in regions with moderate winter temperatures and where electricity rates are competitive with natural gas.`
                : `In this scenario, the gas furnace is more economical. This is common in regions with very cold winter temperatures and when the price of natural gas is significantly lower than electricity. However, heat pumps often provide superior comfort and may have other benefits not captured in this weekly cost analysis.`
              }
            </p>
          </div>

          <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">Daily Cost Breakdown</h3>

          {/* Mobile cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {weeklyMetrics.summary.map((day) => (
              <div key={day.day} className="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-gray-900 dark:text-gray-100">{day.day}</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{day.lowTemp.toFixed(0)}–{day.highTemp.toFixed(0)}°F</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">HP: ${day.hpCost.toFixed(2)}</span>
                  <span className="text-orange-600 dark:text-orange-400 font-semibold">Gas: ${day.gasCost.toFixed(2)}</span>
                  <span className={`font-bold ${day.savings >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
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
                  <th className="p-4 font-bold text-gray-900 dark:text-gray-100">Temp Range</th>
                  <th className="p-4 font-bold text-blue-600 dark:text-blue-400">HP Cost</th>
                  <th className="p-4 font-bold text-orange-600 dark:text-orange-400">Gas Cost</th>
                  <th className="p-4 font-bold text-gray-900 dark:text-gray-100">Savings with HP</th>
                </tr>
              </thead>
              <tbody>
                {weeklyMetrics.summary.map((day, idx) => (
                  <tr key={day.day} className={idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'}>
                    <td className="p-4 font-semibold text-gray-900 dark:text-gray-100">{day.day}</td>
                    <td className="p-4 text-gray-700 dark:text-gray-300">{day.lowTemp.toFixed(0)} - {day.highTemp.toFixed(0)}°F</td>
                    <td className="p-4 font-semibold text-blue-600 dark:text-blue-400">${day.hpCost.toFixed(2)}</td>
                    <td className="p-4 font-semibold text-orange-600 dark:text-orange-400">${day.gasCost.toFixed(2)}</td>
                    <td className={`p-4 font-bold ${day.savings >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      ${day.savings.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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