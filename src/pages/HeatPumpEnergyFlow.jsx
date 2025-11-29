import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, LineChart, Area, ComposedChart } from 'recharts';
import { Zap, Thermometer, Home, Settings, AlertTriangle, ChevronRight, BarChart3, Flame } from 'lucide-react';
import { fullInputClasses, selectClasses } from '../lib/uiClasses'
import { DashboardLink } from '../components/DashboardLink';
import { getAnnualHDD } from '../lib/hddData';

// A custom tooltip for a richer display on charts
const CustomTooltip = ({ active, payload, label, mode = 'heatPump', afue }) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl dark:text-gray-100">
        <p className="font-bold text-gray-800 dark:text-gray-100 mb-2">At {label}°F Outdoor</p>
        {mode === 'gasFurnace' ? (
          <p className="text-sm text-blue-600 font-semibold">Furnace Output: {d.thermalOutputBtu.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr</p>
        ) : (
          <p className="text-sm text-blue-600 font-semibold">HP Output: {d.thermalOutputBtu.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr</p>
        )}
        <p className="text-sm text-red-600 font-semibold">Building Heat Loss: {d.buildingHeatLossBtu.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr</p>
        <hr className="my-2" />
        <p className="text-sm text-orange-600 font-semibold">Aux Heat Needed: {d.auxHeatBtu.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr</p>
        {mode === 'gasFurnace' ? (
          <>
            <hr className="my-2" />
            <p className="text-sm text-green-600 font-semibold">Efficiency (AFUE): {Math.round((afue ?? 0.95) * 100)}%</p>
          </>
        ) : (
          <>
            <hr className="my-2" />
            <p className="text-sm text-green-600 font-semibold">Efficiency (COP): {d.cop.toFixed(2)}</p>
          </>
        )}
      </div>
    );
  }
  return null;
};

const HeatPumpEnergyFlow = () => {
  // --- Context and State ---
  const outletContext = useOutletContext() || {};
  const { userSettings, setUserSetting } = outletContext;
  const [searchParams, setSearchParams] = useSearchParams();
  const [useAnalyzerData, setUseAnalyzerData] = useState(false);
  const contextHeatLossFactor = outletContext?.heatLossFactor;
  const contextBalancePoint = outletContext?.balancePoint;
  const primarySystem = userSettings?.primarySystem || outletContext.primarySystem || 'heatPump';
  const afue = Number(userSettings?.afue) || outletContext?.afue || 0.95;

  // Refs for field highlighting
  const squareFeetRef = useRef(null);
  const insulationRef = useRef(null);
  const homeShapeRef = useRef(null);
  const ceilingHeightRef = useRef(null);

  // Extract building characteristics from context
  const squareFeet = Number(userSettings?.squareFeet) || outletContext?.squareFeet || 1500;
  const setSquareFeet = (v) => setUserSetting ? setUserSetting('squareFeet', v) : (outletContext?.setSquareFeet || (() => { }))(v);
  const insulationLevel = Number(userSettings?.insulationLevel) || outletContext?.insulationLevel || 1.0;
  const setInsulationLevel = (v) => setUserSetting ? setUserSetting('insulationLevel', v) : (outletContext?.setInsulationLevel || (() => { }))(v);
  const homeShape = Number(userSettings?.homeShape) || outletContext?.homeShape || 1.0;
  const setHomeShape = (v) => setUserSetting ? setUserSetting('homeShape', v) : (outletContext?.setHomeShape || (() => { }))(v);
  const ceilingHeight = Number(userSettings?.ceilingHeight) || outletContext?.ceilingHeight || 8;
  const setCeilingHeight = (v) => setUserSetting ? setUserSetting('ceilingHeight', v) : (outletContext?.setCeilingHeight || (() => { }))(v);
  const contextIndoorTemp = Number(userSettings?.indoorTemp ?? userSettings?.winterThermostat) || outletContext?.indoorTemp || 70;

  // Constants
  const CONSTANTS = {
    BTU_PER_KWH: 3412.14,
    KW_PER_TON_OUTPUT: 3.517,
    BASE_BTU_PER_SQFT: 22.67,
    TON_BTU_H: 12000,
    DESIGN_INDOOR_TEMP: 70,
    MIN_CAPACITY_FACTOR: 0.3,
  };

  // System & Environment Inputs (local state only - page-specific)
  const [indoorTemp, setIndoorTemp] = useState(contextIndoorTemp);
  // Use capacity from userSettings/context (set during onboarding), fallback to 36 if not set
  const contextCapacity = Number(userSettings?.capacity || userSettings?.coolingCapacity) || outletContext?.capacity || 36;
  const [capacity, setCapacity] = useState(contextCapacity); // HP capacity (kBTU) when in heat pump mode
  const contextHspf = Number(userSettings?.hspf2) || outletContext?.hspf2 || 9.0;
  const [hspf, setHspf] = useState(contextHspf);       // HSPF2 for HP mode
  const [furnaceInput, setFurnaceInput] = useState(80); // Gas furnace input in kBTU/hr (e.g., 80 => 80,000 BTU/hr)
  const [designOutdoorTemp, setDesignOutdoorTemp] = useState(0);
  const [autoDesignFromLocation, setAutoDesignFromLocation] = useState(true); // true until user overrides

  // Sync capacity and HSPF from context when userSettings change
  useEffect(() => {
    setCapacity(contextCapacity);
  }, [contextCapacity]);

  useEffect(() => {
    setHspf(contextHspf);
  }, [contextHspf]);

  // Auto-select design temperature based on onboarding / forecast location saved in localStorage
  useEffect(() => {
    if (!autoDesignFromLocation) return; // user already picked
    try {
      const raw = localStorage.getItem('userLocation');
      if (!raw) return;
      const loc = JSON.parse(raw);
      const lat = Number(loc.latitude);
      if (isNaN(lat)) return;
      // Simple latitude band heuristic for 99% design dry-bulb (approximate)
      const bands = [
        { max: 28, temp: 30 },      // South Florida, Hawaii
        { max: 32, temp: 25 },      // Gulf Coast / Coastal South
        { max: 36, temp: 20 },      // Mid-South / Mid-Atlantic
        { max: 40, temp: 10 },      // Interior Mid-Atlantic / Lower Midwest
        { max: 44, temp: 0 },       // Upper Midwest / New England south
        { max: 48, temp: -5 },      // Northern tier / Northern New England
        { max: 90, temp: -10 },     // Far north / Alaska interior
      ];
      const band = bands.find(b => lat < b.max) || bands[bands.length - 1];
      setDesignOutdoorTemp(band.temp);
    } catch { /* ignore malformed */ }
  }, [autoDesignFromLocation]);

  // Building Inputs - REMOVED (now using context)
  // const [squareFeet, setSquareFeet] = useState(1500);
  // const [insulationLevel, setInsulationLevel] = useState(1.0);
  // const [homeShape, setHomeShape] = useState(1.0);
  // const [ceilingHeight, setCeilingHeight] = useState(8);
  const [hoursElapsed, setHoursElapsed] = useState(4);
  const [currentOutdoor, setCurrentOutdoor] = useState(designOutdoorTemp);
  const [indoorAuxMode, setIndoorAuxMode] = useState(() => {
    try { return localStorage.getItem('indoorAuxMode') || 'both'; } catch { return 'both'; }
  }); // 'with', 'without', 'both'
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);
  const [showImportOption, setShowImportOption] = useState(false);

  // persist selection
  useEffect(() => {
    try { localStorage.setItem('indoorAuxMode', indoorAuxMode); } catch { /* ignore */ }
  }, [indoorAuxMode]);

  // Handle field highlighting from methodology page
  useEffect(() => {
    const highlightField = searchParams.get('highlight');
    if (highlightField) {
      const refMap = {
        'squareFeet': squareFeetRef,
        'insulationLevel': insulationRef,
        'homeShape': homeShapeRef,
        'ceilingHeight': ceilingHeightRef
      };

      const targetRef = refMap[highlightField];
      if (targetRef?.current) {
        // Scroll to the field
        setTimeout(() => {
          targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add highlight animation
          targetRef.current.style.transition = 'all 0.3s ease';
          targetRef.current.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.5)';
          targetRef.current.style.transform = 'scale(1.02)';

          // Remove highlight after 3 seconds
          setTimeout(() => {
            targetRef.current.style.boxShadow = '';
            targetRef.current.style.transform = '';
          }, 3000);

          // Clear the URL parameter
          setSearchParams({});
        }, 300);
      }
    }
  }, [searchParams, setSearchParams]);

  // --- Derived Values & Physics Model ---
  const capacities = { 18: 1.5, 24: 2.0, 30: 2.5, 36: 3.0, 42: 3.5, 48: 4.0, 60: 5.0 };
  const tons = capacities[capacity];

  /**
   * Single source of truth for the building's heat loss characteristic.
   */
  const btuLossPerDegF = useMemo(() => {
    if (useAnalyzerData && contextHeatLossFactor) {
      return contextHeatLossFactor;
    }
    const designTempDiff = Math.max(10, Math.abs(CONSTANTS.DESIGN_INDOOR_TEMP - designOutdoorTemp));
    const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
    const estimatedDesignHeatLoss = squareFeet * CONSTANTS.BASE_BTU_PER_SQFT * insulationLevel * homeShape * ceilingMultiplier;
    return estimatedDesignHeatLoss / designTempDiff;
  }, [squareFeet, insulationLevel, homeShape, ceilingHeight, designOutdoorTemp, useAnalyzerData, contextHeatLossFactor, CONSTANTS.BASE_BTU_PER_SQFT, CONSTANTS.DESIGN_INDOOR_TEMP]);

  // Estimate compressor power from HSPF rating (HP mode only).
  const compressorPower = useMemo(() => {
    if (primarySystem === 'gasFurnace') return 0;
    return (tons * CONSTANTS.TON_BTU_H) / Math.max(0.1, hspf) / 1000;
  }, [tons, hspf, primarySystem, CONSTANTS.TON_BTU_H]);

  // Main calculation loop to generate performance data across all temperatures.
  const data = useMemo(() => {
    const result = [];
    const thermalCap = Math.max(2000, squareFeet * 5); // Building's thermal mass.

    for (let tempOut = -10; tempOut <= 70; tempOut += 1) {
      // 1. Calculate system output at this temperature
      let thermalOutputBtu;
      let thermalOutputKw = 0;
      if (primarySystem === 'gasFurnace') {
        // Furnace output assumed constant: input * AFUE
        thermalOutputBtu = Math.max(10000, furnaceInput * 1000 * Math.max(0.5, Math.min(0.99, afue)));
      } else {
        // Heat pump derating curve
        let capacityFactor;
        if (tempOut >= 47) capacityFactor = 1.0;
        else if (tempOut >= 17) capacityFactor = 1.0 - (47 - tempOut) * 0.012;
        else capacityFactor = 0.64 - (17 - tempOut) * 0.01;
        capacityFactor = Math.max(CONSTANTS.MIN_CAPACITY_FACTOR, capacityFactor);
        thermalOutputKw = tons * CONSTANTS.KW_PER_TON_OUTPUT * capacityFactor;
        thermalOutputBtu = thermalOutputKw * CONSTANTS.BTU_PER_KWH;
      }

      // 2. Calculate Building's heat loss at this temperature.
      const tempDiff = Math.max(1, indoorTemp - tempOut);
      const buildingHeatLossBtu = btuLossPerDegF * tempDiff;

      // 3. Determine how much auxiliary heat is needed (if any).
      const auxHeatBtu = Math.max(0, buildingHeatLossBtu - thermalOutputBtu);

      // 4. Calculate total heat supplied to the building (HP + Aux).
      //    *** THIS IS THE KEY LOGICAL FIX ***
      const totalHeatSuppliedBtu = thermalOutputBtu + auxHeatBtu;

      // 5. Calculate the final steady-state indoor temperature the system can maintain.
      //    T_ss = T_outdoor + (Total Heat Supplied / Heat Loss per Degree)
      const steadyStateIndoorTemp = tempOut + (totalHeatSuppliedBtu / Math.max(0.1, btuLossPerDegF));

      // 6. Calculate the time-evolved temperature after `hoursElapsed`.
      const H = btuLossPerDegF;
      const k = H / thermalCap; // Time constant.
      const t = Math.max(0, hoursElapsed);
      const effectiveIndoorTemp = steadyStateIndoorTemp + (indoorTemp - steadyStateIndoorTemp) * Math.exp(-k * t);

      // 7. Calculate other metrics for display.
      let electricalKw = 0;
      let actualCOP = 0;
      if (primarySystem !== 'gasFurnace') {
        // Rough mapping of electrical input for HP mode
        const powerFactor = 1.2 - (Math.max(CONSTANTS.MIN_CAPACITY_FACTOR, (thermalOutputKw / (tons * CONSTANTS.KW_PER_TON_OUTPUT))) * 0.5);
        electricalKw = compressorPower * powerFactor;
        actualCOP = thermalOutputKw / Math.max(0.001, electricalKw);
      }

      result.push({
        outdoorTemp: tempOut,
        thermalOutputBtu,
        auxHeatBtu,
        buildingHeatLossBtu,
        cop: actualCOP,
        electricalKw,
        effectiveIndoorTemp,
        T_ss: steadyStateIndoorTemp,
      });
    }
      return result;
    }, [indoorTemp, compressorPower, tons, btuLossPerDegF, squareFeet, hoursElapsed, primarySystem, furnaceInput, afue, CONSTANTS.BTU_PER_KWH, CONSTANTS.KW_PER_TON_OUTPUT, CONSTANTS.MIN_CAPACITY_FACTOR]);

  // Indoor temperature vs time at the current outdoor temperature (using same corrected logic)
  const indoorTimeSeries = useMemo(() => {
    const series = [];
    const H = Math.max(0.1, btuLossPerDegF); // BTU/hr/°F

    // System output at the current outdoor temp
    let thermalOutputBtu_now;
    if (primarySystem === 'gasFurnace') {
      thermalOutputBtu_now = Math.max(10000, furnaceInput * 1000 * Math.max(0.5, Math.min(0.99, afue)));
    } else {
      let capacityFactor;
      if (currentOutdoor >= 47) capacityFactor = 1.0;
      else if (currentOutdoor >= 17) capacityFactor = 1.0 - (47 - currentOutdoor) * 0.012;
      else capacityFactor = 0.64 - (17 - currentOutdoor) * 0.01;
      capacityFactor = Math.max(CONSTANTS.MIN_CAPACITY_FACTOR, capacityFactor);
      const thermalOutputKw_now = tons * CONSTANTS.KW_PER_TON_OUTPUT * capacityFactor;
      thermalOutputBtu_now = thermalOutputKw_now * CONSTANTS.BTU_PER_KWH;
    }

    // Thermal capacitance (BTU/°F)
    const C = Math.max(2000, squareFeet * 5);

    const dt = 0.25; // hours per step (15 min)
    const steps = Math.max(1, Math.ceil(hoursElapsed / dt));
    let T_noAux = indoorTemp;
    let T_withAux = indoorTemp;
    for (let i = 0; i <= steps; i++) {
      const t = i * dt;

      // Compute building loss at current indoor temps
      const loss_noAux = H * (T_noAux - currentOutdoor);
      const Q_in_noAux = thermalOutputBtu_now; // no auxiliary
      const dT_noAux = (Q_in_noAux - loss_noAux) / C; // °F/hr

      // With aux: auxiliary supplies deficit up to meeting building loss
      const loss_withAux = H * (T_withAux - currentOutdoor);
      const auxNeeded = Math.max(0, loss_withAux - thermalOutputBtu_now);
      const Q_in_withAux = thermalOutputBtu_now + auxNeeded;
      const dT_withAux = (Q_in_withAux - loss_withAux) / C;

      series.push({ time: t, T_noAux, T_withAux });

      T_noAux = T_noAux + dT_noAux * dt;
      T_withAux = T_withAux + dT_withAux * dt;
    }
    return series;
  }, [currentOutdoor, hoursElapsed, indoorTemp, tons, btuLossPerDegF, squareFeet, primarySystem, furnaceInput, afue, CONSTANTS.BTU_PER_KWH, CONSTANTS.KW_PER_TON_OUTPUT, CONSTANTS.MIN_CAPACITY_FACTOR]);

  // Find the balance point where HP output equals building heat loss.
  const balancePoint = useMemo(() => {
    if (useAnalyzerData && contextBalancePoint) return contextBalancePoint;
    for (let i = 0; i < data.length - 1; i++) {
      const curr = data[i];
      const next = data[i + 1];
      const surplusCurr = curr.thermalOutputBtu - curr.buildingHeatLossBtu;
      const surplusNext = next.thermalOutputBtu - next.buildingHeatLossBtu;
      if (surplusCurr >= 0 && surplusNext < 0) {
        const t = surplusCurr / (surplusCurr - surplusNext);
        return curr.outdoorTemp + t * (next.outdoorTemp - curr.outdoorTemp);
      }
    }
    return null;
  }, [data, useAnalyzerData, contextBalancePoint]);

  // Calculate summary statistics for the dashboard
  const summaryStats = useMemo(() => {
    const maxOutput = Math.max(...data.map(d => d.thermalOutputBtu));
    const atDesign = data.find(d => d.outdoorTemp === designOutdoorTemp) || data[0];
    const shortfallAtDesign = atDesign?.auxHeatBtu ?? 0;
    const copAtDesign = data.find(d => d.outdoorTemp === designOutdoorTemp)?.cop || 0;
    
    // Calculate annual aux heat hours based on location HDD data
    let annualAuxHours = 0;
    let annualAuxDays = 0;
    try {
      const userLoc = JSON.parse(localStorage.getItem('userLocation') || '{}');
      const foundLocationName = userLoc.foundLocationName || '';
      const stateFullName = userLoc.state || '';
      
      if (foundLocationName && stateFullName && balancePoint !== null && isFinite(balancePoint)) {
        const annualHDD = getAnnualHDD(foundLocationName, stateFullName);
        if (annualHDD) {
          // Estimate hours below balance point using HDD and temperature distribution
          // Rough approximation: if balance point is B°F, estimate hours below B
          // Using degree-day distribution, approximately (HDD / (65 - avgWinterTemp)) * 24 hours
          // Simplified: assume ~20% of heating hours are below balance point for typical systems
          const avgHeatingHours = (annualHDD / 30) * 24; // rough estimate of total heating hours
          const tempRange = 65 - designOutdoorTemp; // temperature range for heating
          const balanceRange = balancePoint - designOutdoorTemp; // range where aux is needed
          const fractionNeedingAux = Math.max(0, Math.min(1, balanceRange / tempRange));
          annualAuxHours = Math.round(avgHeatingHours * fractionNeedingAux);
          annualAuxDays = Math.round(annualAuxHours / 24);
        }
      }
    } catch {
      // Silently fail if localStorage is unavailable
    }
    
    return {
      maxOutput,
      shortfallAtDesign,
      copAtDesign,
      annualAuxHours,
      annualAuxDays,
    };
  }, [data, designOutdoorTemp, balancePoint]);

  return (
    <div className="heat-pump-energy-flow pb-20">
      <div className="detailed-view">
        <div className="flex justify-end mb-4">
          <DashboardLink />
        </div>

        <div className="text-center mb-8">
          {primarySystem === 'gasFurnace' ? (
            <>
              <div className="flex items-center justify-center gap-3 mb-2"><Flame className="text-orange-600" size={32} /><h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">Gas Furnace Performance & Coverage</h1></div>
              <p className="text-gray-600 dark:text-gray-400">See when your furnace output meets your home's heat loss and how efficiency (AFUE) impacts sizing.</p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-3 mb-2"><Zap className="text-blue-600" size={32} /><h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">Heat Pump Performance & Balance Point</h1></div>
              <p className="text-gray-600 dark:text-gray-400">Find your system's balance point and visualize its energy flow.</p>
            </>
          )}
        </div>

        {!showImportOption && contextHeatLossFactor && (
          <div className="mb-6 text-center">
            <button
              onClick={() => setShowImportOption(true)}
              className="text-blue-600 hover:text-blue-800 underline text-sm font-semibold"
            >
              Have a Heat Loss Factor? Import it here
            </button>
          </div>
        )}

        {showImportOption && (
          <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border dark:border-gray-700">
            <label htmlFor="useAnalyzerData" className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="useAnalyzerData" checked={useAnalyzerData} onChange={e => setUseAnalyzerData(e.target.checked)} disabled={!contextHeatLossFactor} className="w-5 h-5 accent-blue-600" />
              Use my real-world Heat Loss Factor from the Performance Analyzer tool
            </label>
            {!contextHeatLossFactor && <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">No data available. Run the "System Performance Analyzer" first to enable this.</p>}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border dark:border-gray-700 transition-opacity ${useAnalyzerData ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2"><Home size={20} />Building Characteristics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div ref={squareFeetRef}>
                <label htmlFor="squareFeet" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Square Footage</label>
                <input id="squareFeet" type="range" min="800" max="4000" step="100" value={squareFeet} onChange={(e) => setSquareFeet(Number(e.target.value))} className="w-full" />
                <span className="font-bold text-gray-900 dark:text-gray-100">{squareFeet.toLocaleString()} sq ft</span>
              </div>
              <div ref={ceilingHeightRef}>
                <label htmlFor="ceilingHeight" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Ceiling Height</label>
                <input id="ceilingHeight" type="range" min="7" max="20" step="1" value={ceilingHeight} onChange={(e) => setCeilingHeight(Number(e.target.value))} className="w-full" />
                <span className="font-bold text-gray-900 dark:text-gray-100">{ceilingHeight} ft</span>
              </div>
              <div ref={insulationRef}>
                <label htmlFor="insulationLevel" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Insulation</label>
                <select id="insulationLevel" value={insulationLevel} onChange={(e) => setInsulationLevel(Number(e.target.value))} className={selectClasses}>
                  <option value={1.4}>Poor</option>
                  <option value={1.0}>Average</option>
                  <option value={0.65}>Good</option>
                </select>
              </div>
              <div ref={homeShapeRef}>
                <label htmlFor="homeShape" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Home Shape</label>
                <select id="homeShape" value={homeShape} onChange={(e) => setHomeShape(Number(e.target.value))} className={selectClasses}>
                  <option value={1.3}>Cabin / A-Frame</option>
                  <option value={1.15}>Ranch</option>
                  <option value={1.0}>Average</option>
                  <option value={0.9}>2-Story</option>
                </select>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2"><Settings size={20} />System & Environment</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {primarySystem === 'gasFurnace' ? (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Furnace Input Capacity</label>
                    <select value={furnaceInput} onChange={(e) => setFurnaceInput(Number(e.target.value))} className={selectClasses}>
                      {[40, 60, 80, 100, 120, 140].map(v => (<option key={v} value={v}>{v}k BTU/hr input</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">AFUE (from Settings)</label>
                    <div className={fullInputClasses + " flex items-center justify-between"}>
                      <span className="font-semibold">{Math.round(afue * 100)}%</span>
                      <span className="text-xs text-gray-500">Adjust in Settings</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">HP Capacity</label>
                    <select value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className={selectClasses}>
                      {Object.entries(capacities).map(([btu, ton]) => (<option key={btu} value={btu}>{btu}k BTU ({ton} tons)</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">HSPF2 Rating</label>
                    <input type="number" step="0.1" min="6" max="13" value={hspf} onChange={(e) => setHspf(Math.max(6, Math.min(13, Number(e.target.value))))} className={fullInputClasses} />
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                      Find this on your system's nameplate or Energy Guide label. Typical range: 6.0–13.0
                    </p>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Target Indoor Temp</label>
                <input type="range" min="65" max="75" value={indoorTemp} onChange={(e) => setIndoorTemp(Number(e.target.value))} className="w-full" />
                <span className="font-bold text-gray-900 dark:text-gray-100">{indoorTemp}°F</span>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Design Outdoor Temp</label>
                {(() => {
                  const climateBands = [
                    { key: 'warm', label: 'Warm (30°F)', temp: 30 },
                    { key: 'mild', label: 'Mild (25°F)', temp: 25 },
                    { key: 'cool', label: 'Cool (20°F)', temp: 20 },
                    { key: 'cold', label: 'Cold (10°F)', temp: 10 },
                    { key: 'verycold', label: 'Very Cold (0°F)', temp: 0 },
                    { key: 'frigid', label: 'Frigid (-5°F)', temp: -5 },
                    { key: 'custom', label: 'Custom…', temp: null },
                  ];
                  const match = climateBands.find(b => b.temp === designOutdoorTemp);
                  const selectedKey = match ? match.key : 'custom';
                  return (
                    <>
                      <div className="mb-2">
                        <select
                          aria-label="Quick select climate band"
                          className={fullInputClasses}
                          value={selectedKey}
                          onChange={(e) => {
                            setAutoDesignFromLocation(false);
                            const key = e.target.value;
                            const band = climateBands.find(b => b.key === key);
                            if (band && band.temp !== null) setDesignOutdoorTemp(band.temp);
                          }}
                        >
                          {climateBands.map(b => (
                            <option key={b.key} value={b.key}>{b.label}</option>
                          ))}
                        </select>
                      </div>
                      <input
                        type="range"
                        min="-20"
                        max="30"
                        step="1"
                        value={designOutdoorTemp}
                        onChange={(e) => {
                          setAutoDesignFromLocation(false);
                          setDesignOutdoorTemp(Number(e.target.value));
                        }}
                        className="w-full"
                      />
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-bold text-gray-900 dark:text-gray-100">{designOutdoorTemp}°F</span>
                        <span className="text-xs text-gray-600 dark:text-gray-400">Pick a band or fine-tune</span>
                      </div>
                      {autoDesignFromLocation && (
                        <div className="mt-2 text-[11px] text-indigo-600 dark:text-indigo-300">
                          Auto-selected from your location. Adjust if needed.
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Simulation Time (hours)</label>
                <input type="range" min="0" max="48" step="1" value={hoursElapsed} onChange={(e) => setHoursElapsed(Number(e.target.value))} className={fullInputClasses} />
                <span className="font-bold text-gray-900 dark:text-gray-100">{hoursElapsed} hrs</span>
              </div>
            </div>
            {primarySystem === 'gasFurnace' ? (
              <div className="mt-6 p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>About AFUE:</strong> AFUE is the seasonal efficiency of your gas furnace. For example, 95% AFUE means 95% of the fuel energy becomes useful heat. Typical modern furnaces range 80–98%.
                </p>
              </div>
            ) : (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Where to find HSPF2:</strong> Check your system's nameplate (usually on the outdoor unit), the Energy Guide label from when you bought it, or your installer's paperwork. You can also search online using your system's model number. HSPF2 is the newer standard that replaced HSPF.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Summary Dashboard - Default View */}
        {!showDetailedAnalysis ? (
          <div className="space-y-6">
            {/* Hero Balance Point Card */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-indigo-950 dark:to-blue-950 rounded-2xl shadow-xl p-8 mb-8 border-4 border-indigo-300 dark:border-indigo-700">
              <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6 text-center flex items-center justify-center gap-3">
                <Thermometer className="text-indigo-600 dark:text-indigo-400" size={36} />
                {primarySystem === 'gasFurnace' ? 'Coverage Temperature' : 'System Balance Point'}
              </h2>
              <div className="text-center">
                {balancePoint !== null && isFinite(balancePoint) && balancePoint > designOutdoorTemp ? (
                  <>
                    <div className="mb-6">
                      <div className="text-7xl md:text-8xl font-black text-indigo-600 dark:text-indigo-400 mb-3">{balancePoint.toFixed(1)}°F</div>
                      <div className="inline-block bg-white/80 dark:bg-gray-800/80 rounded-lg px-6 py-3 shadow-md">
                        <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Below this temperature, system output is less than building heat loss</p>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl mx-auto shadow-lg border dark:border-gray-700">
                      <p className="text-xl text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                        <strong className="text-indigo-700 dark:text-indigo-400">What this means:</strong> Below <strong className="text-indigo-600 dark:text-indigo-300">{balancePoint.toFixed(1)}°F</strong>, the system alone cannot meet your {indoorTemp}°F target. At the design temperature of {designOutdoorTemp}°F (the coldest expected outdoor temperature for your area), the shortfall is approximately <strong className="text-indigo-600 dark:text-indigo-300">{(summaryStats.shortfallAtDesign / 1000).toFixed(1)}k BTU/hr</strong>.
                      </p>
                      {summaryStats.annualAuxHours > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                          <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                            <strong className="text-orange-600 dark:text-orange-400">Annual Impact:</strong> Based on your location's typical weather, auxiliary heat will likely be needed for approximately <strong className="text-orange-600 dark:text-orange-400">{summaryStats.annualAuxHours.toLocaleString()} hours</strong> ({summaryStats.annualAuxDays} days) per year when outdoor temperatures drop below {balancePoint.toFixed(1)}°F.
                          </p>
                        </div>
                      )}
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400">
                        <p><strong>Note:</strong> The balance point is based on your chosen design temperature ({designOutdoorTemp}°F), which represents the coldest expected outdoor temperature for your climate zone—not current outdoor conditions.</p>
                      </div>
                    </div>
                  </>
                ) : balancePoint !== null && isFinite(balancePoint) ? (
                  <>
                    <div className="mb-6">
                      <div className="text-sm font-semibold text-indigo-700 dark:text-indigo-400 mb-2 uppercase tracking-wide">System Balance Point</div>
                      <div className="text-7xl md:text-8xl font-black text-indigo-600 dark:text-indigo-400 mb-3">{balancePoint.toFixed(1)}°F</div>
                      <div className="inline-block bg-white/80 dark:bg-gray-800/80 rounded-lg px-6 py-3 shadow-md">
                        <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Coverage temperature is below the design temperature</p>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl mx-auto shadow-lg border dark:border-gray-700">
                      <p className="text-xl text-gray-700 dark:text-gray-300 leading-relaxed">
                        <strong className="text-indigo-700 dark:text-indigo-400">What this means:</strong> The coverage temperature is below the design temperature. At {designOutdoorTemp}°F, the system shortfall is approximately <strong className="text-orange-600 dark:text-orange-400">{(summaryStats.shortfallAtDesign / 1000).toFixed(1)}k BTU/hr</strong>.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="bg-green-50 dark:bg-green-950 rounded-xl p-8 border-4 border-green-400 dark:border-green-800">
                    <p className="text-3xl font-bold text-green-700 dark:text-green-400 mb-3">No Auxiliary Heat Needed</p>
                    <p className="text-xl text-gray-700 dark:text-gray-300 mb-4">Your system can handle all temperatures down to {designOutdoorTemp}°F without auxiliary heat.</p>
                    <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-700 text-sm text-gray-600 dark:text-gray-400">
                      <p><strong>What this means:</strong> The balance point (where system output equals building heat loss) is at or below your design temperature of {designOutdoorTemp}°F. This is the coldest expected temperature for your climate zone, so your heat pump can meet the full heating load year-round.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 border-blue-200 dark:border-blue-800">
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">Max System Output</h3>
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                  {(summaryStats.maxOutput / 1000).toFixed(1)}k
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">BTU/hr at peak performance</div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 border-orange-200 dark:border-orange-800">
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">Shortfall @ {designOutdoorTemp}°F</h3>
                <div className="text-4xl font-bold text-orange-600 dark:text-orange-400 mb-2">
                  {summaryStats.shortfallAtDesign > 0 ? (summaryStats.shortfallAtDesign / 1000).toFixed(1) + 'k' : '0'}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">BTU/hr deficit at design</div>
              </div>

              {primarySystem === 'gasFurnace' ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 border-green-200 dark:border-green-800">
                  <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">Efficiency (AFUE)</h3>
                  <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
                    {Math.round(afue * 100)}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Seasonal efficiency</div>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 border-green-200 dark:border-green-800">
                  <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">Efficiency (COP)</h3>
                  <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
                    {summaryStats.copAtDesign.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">at {designOutdoorTemp}°F design temp</div>
                </div>
              )}
            </div>

            {/* Call to Action */}
            <div className="text-center">
              <button
                onClick={() => setShowDetailedAnalysis(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl text-lg font-bold shadow-lg hover:shadow-xl transition-all flex items-center gap-3 mx-auto"
              >
                <BarChart3 size={24} />
                View Detailed Analysis
                <ChevronRight size={24} />
              </button>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">See comprehensive charts and performance data</p>
            </div>
          </div>
        ) : (
          /* Detailed Analysis View */
          <div>
            <div className="mb-6 text-center">
              <button
                onClick={() => setShowDetailedAnalysis(false)}
                className="text-indigo-600 hover:text-indigo-800 font-semibold underline"
              >
                ← Back to Summary
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8 border-2 border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2 text-center">{primarySystem === 'gasFurnace' ? 'Coverage Temperature' : 'System Balance Point'}</h2>
              <div className="text-center">
                {balancePoint !== null && isFinite(balancePoint) && balancePoint > designOutdoorTemp ? (
                  <>
                    <p className="text-6xl font-bold text-red-600 dark:text-red-400">{balancePoint.toFixed(1)}°F</p>
                    <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">Below this temperature, system output is less than your home's heat loss. Additional capacity would be required to maintain your set temperature of {indoorTemp}°F.</p>
                  </>
                ) : balancePoint !== null && isFinite(balancePoint) ? (
                  <>
                    <p className="text-6xl font-bold text-red-600 dark:text-red-400">{balancePoint.toFixed(1)}°F</p>
                    <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">Coverage is below the design temperature. The system alone cannot meet the load below this point.</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400 mb-3">No Auxiliary Heat Needed</p>
                    <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">Your system can handle all temperatures down to {designOutdoorTemp}°F without auxiliary heat.</p>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border dark:border-gray-700">
                <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Heat Loss vs. {primarySystem === 'gasFurnace' ? 'Furnace Output' : 'Heat Pump Output'}</h2>
                {/* Responsive aspect-ratio wrapper for chart */}
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <div className="absolute top-0 left-0 w-full h-full">
                    <div className="glass dark:glass-dark rounded-2xl p-3 border border-gray-200 dark:border-gray-800 shadow-lg h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 10, right: window.innerWidth < 640 ? 8 : 24, left: window.innerWidth < 640 ? 8 : 16, bottom: 10 }}>
                          <defs>
                            <linearGradient id="heatLossGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#e11d48" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#e11d48" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
                          <XAxis dataKey="outdoorTemp" label={{ value: 'Outdoor Temperature (°F)', position: 'insideBottom', offset: -5, style: { fontSize: window.innerWidth < 640 ? 10 : 12 } }} type="number" domain={[-10, 70]} tick={{ fontSize: window.innerWidth < 640 ? 9 : 12 }} />
                          <YAxis label={{ value: 'Heat (BTU/hr)', angle: -90, position: 'insideLeft', style: { fontSize: window.innerWidth < 640 ? 10 : 12 } }} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} tick={{ fontSize: window.innerWidth < 640 ? 9 : 12 }} />
                          <Tooltip content={<CustomTooltip mode={primarySystem} afue={afue} />} />
                          <Legend wrapperStyle={{ fontSize: window.innerWidth < 640 ? 11 : 13 }} />
                          {balancePoint !== null && isFinite(balancePoint) && <ReferenceLine x={balancePoint} stroke="#ef4444" strokeWidth={2} label={{ value: `${primarySystem === 'gasFurnace' ? 'Coverage' : 'Balance'}: ${balancePoint.toFixed(1)}°F`, position: 'insideTopRight', style: { fontSize: window.innerWidth < 640 ? 10 : 12 } }} />}
                          <Area type="monotone" dataKey="buildingHeatLossBtu" fill="url(#heatLossGradient)" stroke="none" isAnimationActive animationDuration={800} />
                          <Line type="monotone" dataKey="thermalOutputBtu" stroke="#3b82f6" strokeWidth={2.5} name={primarySystem === 'gasFurnace' ? 'Furnace Output' : 'Heat Pump Output'} dot={false} activeDot={{ r: 5 }} isAnimationActive animationDuration={800} />
                          <Line type="monotone" dataKey="buildingHeatLossBtu" stroke="#e11d48" strokeWidth={2.5} name="Building Heat Loss" dot={false} activeDot={{ r: 5 }} isAnimationActive animationDuration={800} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                  <strong>What this shows:</strong> Building heat loss (red) and system thermal output (blue) across outdoor temperatures. Values are in BTU/hr. For heat pumps, blue derates in colder temps; for gas furnaces, blue is constant output (input × AFUE). Where blue falls below red is the temperature where the system alone can't meet the load.
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border dark:border-gray-700">
                <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2"><AlertTriangle className="text-orange-500" />{primarySystem === 'gasFurnace' ? 'Shortfall (If Undersized)' : 'Auxiliary Heat Required'}</h2>
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <div className="absolute top-0 left-0 w-full h-full">
                    <div className="glass dark:glass-dark rounded-2xl p-3 border border-gray-200 dark:border-gray-800 shadow-lg h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 10, right: window.innerWidth < 640 ? 8 : 24, left: window.innerWidth < 640 ? 8 : 16, bottom: 10 }}>
                          <defs>
                            <linearGradient id="auxHeatGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="#f97316" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
                          <XAxis dataKey="outdoorTemp" label={{ value: 'Outdoor Temperature (°F)', position: 'insideBottom', offset: -5, style: { fontSize: window.innerWidth < 640 ? 10 : 12 } }} type="number" domain={[-10, 70]} tick={{ fontSize: window.innerWidth < 640 ? 9 : 12 }} />
                          <YAxis label={{ value: 'Supplemental Heat (BTU/hr)', angle: -90, position: 'insideLeft', style: { fontSize: window.innerWidth < 640 ? 10 : 12 } }} tickFormatter={(value) => value > 0 ? `${(value / 1000).toFixed(0)}k` : '0'} tick={{ fontSize: window.innerWidth < 640 ? 9 : 12 }} />
                          <Tooltip content={<CustomTooltip mode={primarySystem} afue={afue} />} />
                          <Legend wrapperStyle={{ fontSize: window.innerWidth < 640 ? 11 : 13 }} />
                          {balancePoint !== null && isFinite(balancePoint) && <ReferenceLine x={balancePoint} stroke="#ef4444" strokeDasharray="4 4" label={{ value: primarySystem === 'gasFurnace' ? 'Shortfall Begins' : 'Aux Turns On', position: 'insideTopRight', style: { fontSize: window.innerWidth < 640 ? 10 : 12 } }} />}
                          <Area type="monotone" dataKey="auxHeatBtu" fill="url(#auxHeatGradient)" stroke="none" isAnimationActive animationDuration={800} />
                          <Line type="monotone" dataKey="auxHeatBtu" stroke="#f97316" strokeWidth={3} name={primarySystem === 'gasFurnace' ? 'Shortfall (BTU/hr)' : 'Aux Heat Needed'} dot={false} activeDot={{ r: 5 }} isAnimationActive animationDuration={800} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                  <strong>What this shows:</strong> The positive difference when building heat loss exceeds system output (BTU/hr) at each outdoor temperature. For heat pumps this is auxiliary heat; for furnaces it represents undersizing shortfall.
                </div>
              </div>
            </div>

            {/* Additional visualizations: Energy Flow (MJ/h) and Indoor Temperature vs Time */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border dark:border-gray-700">
                <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Energy Flow vs. Outdoor Temperature (BTU/hr)</h2>
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <div className="absolute top-0 left-0 w-full h-full">
                    <div className="glass dark:glass-dark rounded-2xl p-3 border border-gray-200 dark:border-gray-800 shadow-lg h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 20, right: window.innerWidth < 640 ? 8 : 24, left: window.innerWidth < 640 ? 8 : 16, bottom: 20 }}>
                          <defs>
                            <linearGradient id="energyFlowGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
                          <XAxis dataKey="outdoorTemp" label={{ value: 'Outdoor Temperature (°F)', position: 'insideBottom', offset: -5, style: { fontSize: window.innerWidth < 640 ? 10 : 12 } }} type="number" domain={[-10, 70]} tick={{ fontSize: window.innerWidth < 640 ? 9 : 12 }} />
                          <YAxis label={{ value: 'Energy (BTU/hr)', angle: -90, position: 'insideLeft', style: { fontSize: window.innerWidth < 640 ? 10 : 12 } }} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} tick={{ fontSize: window.innerWidth < 640 ? 9 : 12 }} />
                          <Tooltip content={<CustomTooltip mode={primarySystem} afue={afue} />} />
                          <Legend 
                            wrapperStyle={{ fontSize: window.innerWidth < 640 ? 10 : 12, paddingTop: '10px' }}
                            iconSize={window.innerWidth < 640 ? 10 : 14}
                            layout="horizontal"
                            verticalAlign="top"
                            align="center"
                          />
                          <Area type="monotone" dataKey="thermalOutputBtu" fill="url(#energyFlowGradient)" stroke="none" isAnimationActive animationDuration={800} />
                          <Line type="monotone" dataKey="thermalOutputBtu" stroke="#3b82f6" strokeWidth={2.5} name={primarySystem === 'gasFurnace' ? 'Furnace Output' : 'Heat Extracted'} dot={false} activeDot={{ r: 5 }} isAnimationActive animationDuration={800} />
                          <Line type="monotone" dataKey="buildingHeatLossBtu" stroke="#e11d48" strokeWidth={2.5} name="Building Heat Loss" dot={false} activeDot={{ r: 5 }} isAnimationActive animationDuration={800} />
                          {primarySystem !== 'gasFurnace' && (
                            <Line type="monotone" dataKey="electricalKw" stroke="#10b981" strokeWidth={2.5} name="Electrical Input" dot={false} activeDot={{ r: 5 }} isAnimationActive animationDuration={800} />
                          )}
                          {balancePoint !== null && isFinite(balancePoint) && <ReferenceLine x={balancePoint} stroke="#ef4444" strokeWidth={2} label={{ value: `${primarySystem === 'gasFurnace' ? 'Coverage' : 'Balance'}: ${balancePoint.toFixed(1)}°F`, position: 'insideTopRight', style: { fontSize: window.innerWidth < 640 ? 10 : 12 } }} />}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                  <strong>What this shows:</strong> Energy flows in BTU per hour so heating quantities are directly comparable. Blue is system heat delivered; red is building heat loss. {primarySystem !== 'gasFurnace' ? `Green is electrical input converted to BTU/hr (kW × ${CONSTANTS.BTU_PER_KWH.toFixed(0)}). Heat pumps deliver more thermal energy than electrical input due to COP.` : `For gas furnaces, output is input × AFUE and electrical input is not shown.`}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border dark:border-gray-700">
                <div className="flex items-start justify-between mb-3">
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Indoor Temperature vs Time (Current Outdoor)</h2>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Show</span>
                    <div className="inline-flex bg-gray-100 dark:bg-gray-700 rounded-md p-0.5">
                      <button type="button" onClick={() => setIndoorAuxMode('both')} className={`px-3 py-1 text-sm rounded ${indoorAuxMode === 'both' ? 'bg-white dark:bg-gray-600 shadow-sm font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-600/50'}`}>
                        Both
                      </button>
                      <button type="button" onClick={() => setIndoorAuxMode('with')} className={`px-3 py-1 text-sm rounded ${indoorAuxMode === 'with' ? 'bg-white dark:bg-gray-600 shadow-sm font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-600/50'}`}>
                        With Aux
                      </button>
                      <button type="button" onClick={() => setIndoorAuxMode('without')} className={`px-3 py-1 text-sm rounded ${indoorAuxMode === 'without' ? 'bg-white dark:bg-gray-600 shadow-sm font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-600/50'}`}>
                        Without Aux
                      </button>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">Choose which series to display: "With Aux" shows an idealized auxiliary-heated response; "Without Aux" shows heat-pump-only response; "Both" overlays them.</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 mb-3">
                  <label className="text-sm font-semibold">Current Outdoor Temp</label>
                  <input type="range" min="-10" max="70" value={currentOutdoor} onChange={(e) => setCurrentOutdoor(Number(e.target.value))} className="w-48" />
                  <span className="font-bold">{currentOutdoor}°F</span>
                  {indoorAuxMode !== 'both' && (
                    <span className="ml-4 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm text-gray-700 dark:text-gray-200">Showing: {indoorAuxMode === 'with' ? 'With Aux' : 'Without Aux'}</span>
                  )}
                </div>
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <div className="absolute top-0 left-0 w-full h-full">
                    <div className="glass dark:glass-dark rounded-2xl p-3 border border-gray-200 dark:border-gray-800 shadow-lg h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={indoorTimeSeries} margin={{ top: 10, right: window.innerWidth < 640 ? 8 : 24, left: window.innerWidth < 640 ? 8 : 16, bottom: 10 }}>
                          <defs>
                            <linearGradient id="indoorNoAuxGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05} />
                            </linearGradient>
                            <linearGradient id="indoorWithAuxGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#f97316" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
                          <XAxis dataKey="time" label={{ value: 'Hours', position: 'insideBottom', offset: -5, style: { fontSize: window.innerWidth < 640 ? 10 : 12 } }} tick={{ fontSize: window.innerWidth < 640 ? 9 : 12 }} />
                          <YAxis label={{ value: 'Indoor Temp (°F)', angle: -90, position: 'insideLeft', style: { fontSize: window.innerWidth < 640 ? 10 : 12 } }} domain={[Math.min(indoorTemp - 10, 30), Math.max(indoorTemp + 10, 90)]} tick={{ fontSize: window.innerWidth < 640 ? 9 : 12 }} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload || !payload.length) return null;
                              return (
                                <div className="rounded-xl px-3 py-2 bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 shadow-xl">
                                  <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">Hour {payload[0]?.payload?.time}</div>
                                  {payload.map((entry, idx) => (
                                    <div key={idx} className="text-sm font-bold" style={{ color: entry.color }}>
                                      {entry.name}: {typeof entry.value === 'number' ? `${entry.value.toFixed(2)}°F` : entry.value}
                                    </div>
                                  ))}
                                </div>
                              );
                            }}
                          />
                          {indoorAuxMode === 'both' ? (
                            <Legend wrapperStyle={{ fontSize: window.innerWidth < 640 ? 11 : 13 }} />
                          ) : null}
                          {(indoorAuxMode === 'both' || indoorAuxMode === 'without') && (
                            <>
                              <Area type="monotone" dataKey="T_noAux" fill="url(#indoorNoAuxGradient)" stroke="none" isAnimationActive animationDuration={800} />
                              <Line type="monotone" dataKey="T_noAux" stroke="#2563eb" strokeWidth={2.5} name="No Aux" dot={false} activeDot={{ r: 5 }} isAnimationActive animationDuration={800} />
                            </>
                          )}
                          {(indoorAuxMode === 'both' || indoorAuxMode === 'with') && (
                            <>
                              <Area type="monotone" dataKey="T_withAux" fill="url(#indoorWithAuxGradient)" stroke="none" isAnimationActive animationDuration={800} />
                              <Line type="monotone" dataKey="T_withAux" stroke="#f97316" strokeWidth={2.5} name="With Aux" dot={false} activeDot={{ r: 5 }} isAnimationActive animationDuration={800} />
                            </>
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                  <strong>What this shows:</strong> Time evolution of indoor temperature starting from your target indoor temperature. "No Aux" simulates the heat pump only. "With Aux" allows idealized auxiliary heat to cover any deficit instantly. The simulation uses a simple lumped-capacitance model (thermal capacitance ≈ max(2000, sqft×5) BTU/°F) and an exponential approach to the steady-state temperature; it's intended for qualitative insight rather than precise transient building simulation.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HeatPumpEnergyFlow;
