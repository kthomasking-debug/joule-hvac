import React, { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { computeHourlyPerformance, computeHourlyCoolingPerformance, calculateHeatLoss, getCapacityFactor, getDefrostPenalty, KW_PER_TON_OUTPUT, BTU_PER_KWH } from '../lib/heatUtils';
import { computeHourlyCost } from '../lib/costUtils';
import { HelpCircle, Calculator, ChevronDown, ChevronUp } from 'lucide-react';
import BeforeAfterSlider from '../components/BeforeAfterSlider';

const defaultSettings = {
  squareFeet: 1500,
  insulationLevel: 1.0,
  homeShape: 1.0,
  ceilingHeight: 8,
  tons: 2.5,
  compressorPower: 1.8,
  hspf2: 9.0,
  seer2: 15.0,
  utilityCost: 0.15,
  useElectricAuxHeat: true,
};

function make24HourProfile(low, high) {
  // Use a sinusoidal-ish profile peaking at 16:00 and low at 4:00
  const hours = [];
  const amplitude = (high - low) / 2;
  const mid = (high + low) / 2;
  for (let h = 0; h < 24; h++) {
    // phase: low at 4 => sin(-12deg?) We'll use cosine shift so mid-day at 16:00
    // map h=4 -> -pi, h=16 -> pi
    const phase = ((h - 16) / 24) * Math.PI * 2; // shift so max at 16
    const t = mid + amplitude * Math.sin(phase);
    hours.push({ hour: h, temp: Math.round(t * 10) / 10, humidity: 50, time: new Date(2025, 0, 1, h) });
  }
  return hours;
}

function runScenario(profileHours, indoorStrategyFn, settings, heatLoss) {
  let totalEnergy = 0;
  let totalCost = 0;
  let totalAux = 0;
  for (const hour of profileHours) {
    const indoorTemp = indoorStrategyFn(hour.hour);
    let perf;
    if (indoorTemp > hour.temp) {
      perf = computeHourlyPerformance({
        tons: settings.tons,
        indoorTemp: indoorTemp,
        designHeatLossBtuHrAt70F: heatLoss,
        compressorPower: settings.compressorPower,
        hspf2: settings.hspf2 || 9.0,
      }, hour.temp, hour.humidity);
      const kwh = perf.electricalKw * (perf.capacityUtilization / 100); // Using capacityUtilization, not time-based runtime
      totalEnergy += kwh;
      const aux = settings.useElectricAuxHeat ? perf.auxKw : 0;
      totalAux += aux;
      totalCost += computeHourlyCost(kwh, hour.time, [], settings.utilityCost);
      if (settings.useElectricAuxHeat) totalCost += computeHourlyCost(aux, hour.time, [], settings.utilityCost);
    } else {
      const perfCool = computeHourlyCoolingPerformance({
        tons: settings.tons,
        indoorTemp: indoorTemp,
        designHeatLossBtuHrAt70F: heatLoss,
        seer2: settings.seer2,
        solarExposure: 1.0,
      }, hour.temp, hour.humidity);
      const kwh = perfCool.electricalKw * (perfCool.runtime / 100);
      totalEnergy += kwh;
      totalCost += computeHourlyCost(kwh, hour.time, [], settings.utilityCost);
    }
  }
  return { totalEnergy, totalCost, totalAux };
}

export default function ThermostatStrategyAnalyzer() {
  const outletContext = useOutletContext() || {};
  // Merge context with defaults, ensuring all values are numeric and present
  const settings = {
    squareFeet: Number(outletContext.squareFeet) || defaultSettings.squareFeet,
    insulationLevel: Number(outletContext.insulationLevel) || defaultSettings.insulationLevel,
    homeShape: Number(outletContext.homeShape) || defaultSettings.homeShape,
    ceilingHeight: Number(outletContext.ceilingHeight) || defaultSettings.ceilingHeight,
    tons: Number(outletContext.tons) || defaultSettings.tons,
    compressorPower: Number(outletContext.compressorPower) || defaultSettings.compressorPower,
    hspf2: Number(outletContext.hspf2) || defaultSettings.hspf2,
    seer2: Number(outletContext.seer2) || defaultSettings.seer2,
    utilityCost: Number(outletContext.utilityCost) || defaultSettings.utilityCost,
    useElectricAuxHeat: outletContext.useElectricAuxHeat ?? defaultSettings.useElectricAuxHeat,
  };
  const [lowTemp, setLowTemp] = useState(30);
  const [highTemp, setHighTemp] = useState(45);
  const [constantTemp, setConstantTemp] = useState(70);
  const [comfortTemp, setComfortTemp] = useState(70);
  const [setbackTemp, setSetbackTemp] = useState(65);
  // Store 24-hour time for setback start (0-23)
  const [setbackStart, setSetbackStart] = useState(22); // 22:00 (10 PM)
  const [setbackDuration, setSetbackDuration] = useState(8);
  const [result, setResult] = useState(null);
  const [selectedHour, setSelectedHour] = useState(6);

  const [showHeatLossTooltip, setShowHeatLossTooltip] = useState(false);
  const [showCalculations, setShowCalculations] = useState(false);
  const profile = make24HourProfile(lowTemp, highTemp);
  // Calculate per-hour values for the selected hour
  const hourData = profile[selectedHour] || profile[0];
  // Use constantTemp for demonstration; could allow user to pick strategy
  const indoorTemp = constantTemp;
  const mid = (highTemp + lowTemp) / 2;
  const amplitude = (highTemp - lowTemp) / 2;
  const outdoorTemp = hourData.temp;
  const humidity = hourData.humidity;
  const heatLoss = calculateHeatLoss(settings);
  const btuLossPerDegreeF = heatLoss / 70;
  const buildingHeatLossBtu = btuLossPerDegreeF * (indoorTemp - outdoorTemp);

  // Compute heat pump output and performance for this hour (handle heating vs cooling)
  let perfHeat, perfCool;
  let capacityFactor = getCapacityFactor(outdoorTemp);
  const nominalCapacityBtu = settings.tons * KW_PER_TON_OUTPUT * BTU_PER_KWH;
  let heatpumpOutputBtu = nominalCapacityBtu * (capacityFactor || 0);
  let powerFactor = 1 / Math.max(0.7, capacityFactor || 0.7);
  let baseElectricalKw = settings.compressorPower * powerFactor;
  let defrostPenalty = getDefrostPenalty(outdoorTemp, humidity);
  let electricalKw = 0;
  let runtimePercent = 0;
  let deficitBtu = 0;
  let auxKw = 0;

  if (indoorTemp > outdoorTemp) {
    // Heating
    perfHeat = computeHourlyPerformance({
      tons: settings.tons,
      indoorTemp,
      heatLossBtu: heatLoss,
      compressorPower: settings.compressorPower,
      hspf2: settings.hspf2 || 9.0,
    }, outdoorTemp, humidity);
    electricalKw = perfHeat.electricalKw;
    runtimePercent = perfHeat.capacityUtilization || 0; // Using capacityUtilization, not time-based runtime
    auxKw = perfHeat.auxKw || 0;
    // recompute heatpumpOutputBtu/factors by capacityFactor
    capacityFactor = getCapacityFactor(outdoorTemp);
    heatpumpOutputBtu = nominalCapacityBtu * (capacityFactor || 0);
    powerFactor = 1 / Math.max(0.7, capacityFactor || 0.7);
    baseElectricalKw = settings.compressorPower * powerFactor;
    defrostPenalty = perfHeat.defrostPenalty || defrostPenalty;
    // Use computed deficits
    deficitBtu = Math.max(0, buildingHeatLossBtu - heatpumpOutputBtu);
  } else {
    // Cooling
    perfCool = computeHourlyCoolingPerformance({
      tons: settings.tons,
      indoorTemp: indoorTemp,
      heatLossBtu: heatLoss,
      seer2: settings.seer2,
      solarExposure: 1.0,
    }, outdoorTemp, humidity);
    electricalKw = perfCool.electricalKw;
    runtimePercent = perfCool.capacityUtilization || 0; // Using capacityUtilization, not time-based runtime
    deficitBtu = perfCool.deficitBtu || 0;
    auxKw = 0; // cooling has no auxKw
    // capacity derate applied to cooling capacity
    const capacityDerate = perfCool.capacityDerate || 1.0;
    const availableCapacityBtu = nominalCapacityBtu * capacityDerate;
    heatpumpOutputBtu = availableCapacityBtu;
    // For display compute approximate power factors
    powerFactor = 1 / Math.max(0.7, capacityFactor || 0.7);
    baseElectricalKw = settings.compressorPower * powerFactor;
    defrostPenalty = 1; // no defrost penalty on cooling
  }
  // ensure numeric defaults
  heatpumpOutputBtu = heatpumpOutputBtu || 0;
  capacityFactor = capacityFactor || 0;
  powerFactor = powerFactor || 1;
  baseElectricalKw = baseElectricalKw || 0;
  defrostPenalty = defrostPenalty || 1;
  electricalKw = electricalKw || 0;
  runtimePercent = runtimePercent || 0;
  deficitBtu = deficitBtu || 0;
  auxKw = auxKw || 0;
  const costHour = electricalKw * settings.utilityCost;

  // Reusable input classes for dark mode
  const inputClasses = "w-20 p-1 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

  // Reusable slider component
  const TempSlider = ({ label, value, onChange, min = 40, max = 80, showValue = true }) => (
    <div>
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{label}</label>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-600 dark:text-gray-400">{min}°F</span>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-grow h-2 cursor-pointer accent-blue-600"
          aria-label={label}
        />
        <span className="text-xs text-gray-600 dark:text-gray-400">{max}°F</span>
      </div>
      {showValue && <div className="text-center mt-2"><p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{value}°F</p></div>}
    </div>
  );

  const calc = () => {
    const heatLoss = calculateHeatLoss(settings);
    // Scenario A: Constant Temp
    const constantFn = () => constantTemp;
    const cA = runScenario(profile, constantFn, settings, heatLoss);

    // Scenario B: Setback schedule (use 24h value from AM/PM selector)
    const start = setbackStart;
    const end = (start + setbackDuration) % 24;
    const scheduleFn = (hour) => {
      // compute if in setback window
      const inSetback = start < end ? (hour >= start && hour < end) : (hour >= start || hour < end);
      return inSetback ? setbackTemp : comfortTemp;
    };

    // Recovery factor handling: We'll add a naive multiplier to the heatLoss during the first 2 hours after setback ends to simulate extra load
    const profileWithRecovery = profile.map(h => ({ ...h }));
    const recoveryStart = (start + setbackDuration) % 24;
    const recoveryHours = [recoveryStart, (recoveryStart + 1) % 24];
    for (const h of profileWithRecovery) {
      h.recoveryFactor = recoveryHours.includes(h.hour) ? 1.35 : 1.0; // 35% extra load
    }

    function runScenarioWithRecovery(profileHours, indoorStrategyFn, settings, baseHeatLoss) {
      let totalEnergy = 0;
      let totalCost = 0;
      let totalAux = 0;
      for (const hour of profileHours) {
        const indoorTemp = indoorStrategyFn(hour.hour);
        let perf;
        const heatLossBtu = baseHeatLoss * (hour.recoveryFactor || 1.0);
        if (indoorTemp > hour.temp) {
          perf = computeHourlyPerformance({
            tons: settings.tons,
            indoorTemp: indoorTemp,
            heatLossBtu: heatLossBtu,
            compressorPower: settings.compressorPower,
          }, hour.temp, hour.humidity);
          const kwh = perf.electricalKw * (perf.capacityUtilization / 100); // Using capacityUtilization, not time-based runtime
          totalEnergy += kwh;
          const aux = settings.useElectricAuxHeat ? perf.auxKw : 0;
          totalAux += aux;
          totalCost += computeHourlyCost(kwh, hour.time, [], settings.utilityCost);
          if (settings.useElectricAuxHeat) totalCost += computeHourlyCost(aux, hour.time, [], settings.utilityCost);
        } else {
          const perfCool = computeHourlyCoolingPerformance({
            tons: settings.tons,
            indoorTemp: indoorTemp,
            heatLossBtu: heatLossBtu,
            seer2: settings.seer2,
            solarExposure: 1.0,
          }, hour.temp, hour.humidity);
          const kwh = perfCool.electricalKw * (perfCool.runtime / 100);
          totalEnergy += kwh;
          totalCost += computeHourlyCost(kwh, hour.time, [], settings.utilityCost);
        }
      }
      return { totalEnergy, totalCost, totalAux };
    }

    const resConst = cA;
    const resSetback = runScenarioWithRecovery(profileWithRecovery, scheduleFn, settings, heatLoss);

    const savings = resConst.totalCost - resSetback.totalCost;
    setResult({ constant: resConst, setback: resSetback, savings });
  };

  // --- Building Heat Loss Section (Manual Estimator) ---
  // Initialize from userSettings (from onboarding)
  const [showBuildingHeatLoss, setShowBuildingHeatLoss] = useState(false);
  const [squareFeet, setSquareFeet] = useState(outletContext.squareFeet || defaultSettings.squareFeet);
  const [ceilingHeight, setCeilingHeight] = useState(outletContext.ceilingHeight || defaultSettings.ceilingHeight);
  const [insulationLevel, setInsulationLevel] = useState(outletContext.insulationLevel || defaultSettings.insulationLevel);
  const [homeShape, setHomeShape] = useState(outletContext.homeShape || defaultSettings.homeShape);
  const capacity = settings.tons * 12;
  const manualHeatLoss = Math.round(squareFeet * ceilingHeight * insulationLevel * homeShape);

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Thermostat Strategy Analyzer</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Compare constant temperature vs. nightly setback strategies</p>
        </div>
        
        <div>

        {/* Page controls moved into a guided flow below */}
        {/* Step 1: Typical Day */}
        <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">1. Set a Typical Day's Weather</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1">Average Low</label>
              <input type="number" value={lowTemp} onChange={(e) => setLowTemp(Number(e.target.value))} className={inputClasses} />
            </div>
            <div>
              <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1">Average High</label>
              <input type="number" value={highTemp} onChange={(e) => setHighTemp(Number(e.target.value))} className={inputClasses} />
            </div>
          </div>
        </div>

        {/* Step 2: Compare Strategies */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">2. Define Your Two Strategies</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strategy A - Constant */}
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Strategy A: Constant Temp</h3>
              <TempSlider label="Thermostat Setting" value={constantTemp} onChange={setConstantTemp} min={60} max={78} />
            </div>
            {/* Strategy B - Setback */}
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Strategy B: Nightly Setback</h3>
              <div className="space-y-6">
                <TempSlider label="Comfort Temperature (Day)" value={comfortTemp} onChange={setComfortTemp} min={60} max={78} />
                <TempSlider label="Setback Temperature (Night)" value={setbackTemp} onChange={setSetbackTemp} min={55} max={70} />
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1">Start Hour (24-hour)</label>
                    <select
                      value={setbackStart}
                      onChange={e => setSetbackStart(Number(e.target.value))}
                      className={inputClasses}
                      style={{ width: '100%' }}
                    >
                      {[...Array(24).keys()].map(hour => (
                        <option key={hour} value={hour}>
                          {String(hour).padStart(2, '0')}:00
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1">Duration (hours)</label>
                    <select value={setbackDuration} onChange={(e) => setSetbackDuration(Number(e.target.value))} className={`p-1 border rounded w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100`}>
                      {[...Array(24).keys()].slice(1).map(n => <option key={n} value={n}>{n} hrs</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3: Calculate */}
        <div className="text-center mb-4">
          <button className="btn btn-primary px-10 py-4 text-lg font-semibold" onClick={calc}>Calculate My Savings</button>
          <Link to="/cost-forecaster" className="block mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline">Back to Forecaster</Link>
        </div>

        {result && (
          <>
            {/* Verdict Hero Card */}
            <div data-testid="verdict-card" className={`mb-8 p-6 rounded-lg text-center border-2 ${result.savings > 0 ? 'bg-green-100 dark:bg-green-900 border-green-400' : 'bg-red-100 dark:bg-red-900 border-red-400'}`}>
              <p className={`text-lg font-semibold ${result.savings > 0 ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>The Verdict: {result.savings > 0 ? 'A Setback Saves You Money' : 'No Savings from Setback'}</p>
              <p data-testid="savings-value" className={`text-6xl font-black my-2 ${result.savings > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{result.savings > 0 ? `+$${result.savings.toFixed(2)}` : `$${result.savings.toFixed(2)}`}</p>
              <p className={`text-md ${result.savings > 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>per day ({(result.savings / result.constant.totalCost * 100).toFixed(1)}% {result.savings > 0 ? 'reduction' : 'change'})</p>
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                <strong>Why?</strong> The energy saved during the {setbackDuration}-hour setback was {result.savings > 0 ? 'greater' : 'not enough'} than the energy used to recover the temperature in the morning. {result.setback.totalAux > 0 ? (<span>Your system <strong>needed to use auxiliary heat</strong> during recovery, which reduced savings.</span>) : (<span>Your system <strong>did not need to use expensive auxiliary heat</strong> during the recovery.</span>)}
              </div>
            </div>

            {/* Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
              <div className="p-4 border rounded-lg dark:border-gray-700 bg-white dark:bg-gray-900">
                <h4 className="font-bold">Constant ({constantTemp}°)</h4>
                <p className="text-3xl font-bold text-blue-600 my-2">${result.constant.totalCost.toFixed(2)}</p>
                <p className="text-xs">Total Energy: {result.constant.totalEnergy.toFixed(2)} kWh</p>
                <p className="text-xs">Aux Energy: {result.constant.totalAux.toFixed(2)} kWh</p>
              </div>
              <div className="p-4 border rounded-lg dark:border-gray-700 bg-white dark:bg-gray-900">
                <h4 className="font-bold">Setback ({comfortTemp}° → {setbackTemp}°, {setbackDuration}h)</h4>
                <p className="text-3xl font-bold text-gray-700 dark:text-gray-300 my-2">${result.setback.totalCost.toFixed(2)}</p>
                <p className="text-xs">Total Energy: {result.setback.totalEnergy.toFixed(2)} kWh</p>
                <p className="text-xs">Aux Energy: {result.setback.totalAux.toFixed(2)} kWh</p>
              </div>
            </div>

            {/* Before/After Interactive Slider */}
            <div className="mt-6">
              <BeforeAfterSlider
                titleLeft={`Constant (${constantTemp}°)`}
                titleRight={`Setback (${comfortTemp}° → ${setbackTemp}°, ${setbackDuration}h)`}
                left={{ cost: result.constant.totalCost, energy: result.constant.totalEnergy, aux: result.constant.totalAux }}
                right={{ cost: result.setback.totalCost, energy: result.setback.totalEnergy, aux: result.setback.totalAux }}
                defaultValue={0.0}
              />
            </div>

            {/* Live Math Calculations Pulldown */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden mt-8">
              <button
                onClick={() => setShowCalculations(!showCalculations)}
                className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                    <Calculator size={24} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">View Calculation Methodology</h3>
                </div>
                {showCalculations ? (
                  <ChevronUp className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                ) : (
                  <ChevronDown className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                )}
              </button>

              {showCalculations && (
                <div className="px-6 pb-6 space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
                {/* Summary Calculations Section */}
                <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Summary Calculations (24-Hour Totals)</h4>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Strategy A: Constant Temperature ({constantTemp}°F)</p>
                      <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                        For each hour (0-23):<br />
                        Calculate indoor temp = {constantTemp}°F (constant)<br />
                        Calculate hourly energy = sum(electricalKw * runtime% / 100) for all 24 hours<br />
                        Calculate hourly cost = sum(energy * ${settings.utilityCost.toFixed(3)}/kWh) for all 24 hours<br />
                        Total Energy = <strong>{result.constant.totalEnergy.toFixed(2)} kWh</strong><br />
                        Total Cost = <strong>${result.constant.totalCost.toFixed(2)}</strong><br />
                        Total Aux Energy = <strong>{result.constant.totalAux.toFixed(2)} kWh</strong>
                      </code>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Strategy B: Setback ({comfortTemp}°F → {setbackTemp}°F, {setbackDuration}h)</p>
                      <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                        For each hour (0-23):<br />
                        Calculate indoor temp = setback window? {setbackTemp}°F : {comfortTemp}°F<br />
                        Setback window: hours {setbackStart}:00 to {((setbackStart + setbackDuration) % 24)}:00<br />
                        Recovery factor: first 2 hours after setback = 1.35 * heat loss (35% extra load)<br />
                        Calculate hourly energy = sum(electricalKw * runtime% / 100) for all 24 hours<br />
                        Calculate hourly cost = sum(energy * ${settings.utilityCost.toFixed(3)}/kWh) for all 24 hours<br />
                        Total Energy = <strong>{result.setback.totalEnergy.toFixed(2)} kWh</strong><br />
                        Total Cost = <strong>${result.setback.totalCost.toFixed(2)}</strong><br />
                        Total Aux Energy = <strong>{result.setback.totalAux.toFixed(2)} kWh</strong>
                      </code>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Savings Calculation</p>
                      <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                        Daily Savings = Constant Cost - Setback Cost<br />
                        = ${result.constant.totalCost.toFixed(2)} - ${result.setback.totalCost.toFixed(2)}<br />
                        = <strong>${result.savings.toFixed(2)}</strong> per day<br />
                        <br />
                        Percentage Change = (Savings / Constant Cost) * 100%<br />
                        = (${result.savings.toFixed(2)} / ${result.constant.totalCost.toFixed(2)}) * 100%<br />
                        = <strong>{(result.savings / result.constant.totalCost * 100).toFixed(1)}%</strong>
                      </code>
                    </div>
                  </div>
                </div>

                {/* Per-Hour Detail Section */}
                <div>
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Per-Hour Calculation Details</h4>
                  <div className="mb-4">
                    <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1">Select Hour of Day</label>
                    <input type="range" min={0} max={23} value={selectedHour} onChange={e => setSelectedHour(Number(e.target.value))} className="w-full" />
                    <div className="text-center text-sm mt-1">Hour: <span data-testid="detail-hour" className="font-mono">{selectedHour}:00</span> &nbsp;|&nbsp; Outdoor Temp: <span data-testid="detail-outdoor-temp" className="font-mono">{outdoorTemp}°F</span></div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">1. Outdoor Temperature Profile</p>
                      <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                        T_hour = mid + amplitude * sin(2 * PI * (h - 16) / 24)<br />
                        mid = ({highTemp} + {lowTemp}) / 2 = {mid.toFixed(1)}<br />
                        amplitude = ({highTemp} - {lowTemp}) / 2 = {amplitude.toFixed(1)}<br />
                        T_hour = {mid.toFixed(1)} + {amplitude.toFixed(1)} * sin(2 * PI * ({selectedHour} - 16) / 24) = <strong>{outdoorTemp}°F</strong>
                      </code>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">2. Building Heat Loss (BTU/hr)</p>
                      <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                        HeatLoss = sqft * 22.67 * insulation * shape * (1 + 0.1 * (ceilingHeight - 8))<br />
                        = {settings.squareFeet} * 22.67 * {settings.insulationLevel} * {settings.homeShape} * (1 + 0.1 * ({settings.ceilingHeight} - 8)) = <strong>{heatLoss} BTU/hr</strong>
                      </code>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">3. Hourly Building Heat Loss</p>
                      <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                        btuLossPerDegreeF = HeatLoss / 70 = {heatLoss} / 70 = {btuLossPerDegreeF.toFixed(1)}<br />
                        buildingHeatLossBtu = btuLossPerDegreeF * (indoorTemp - outdoorTemp) = {btuLossPerDegreeF.toFixed(1)} * ({indoorTemp} - {outdoorTemp}) = <strong>{buildingHeatLossBtu.toFixed(0)}</strong>
                      </code>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">4. Heat Pump Output</p>
                      <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                        heatpumpOutputBtu = tons * 3.517 * capacityFactor * 3412.14<br />
                        = {settings.tons} * 3.517 * {capacityFactor.toFixed(3)} * 3412.14 = <strong>{isFinite(heatpumpOutputBtu) ? heatpumpOutputBtu.toFixed(0) : '—'}</strong>
                      </code>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">5. Power and Runtime</p>
                      <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                        powerFactor = 1 / max(0.7, capacityFactor) = {isFinite(powerFactor) ? powerFactor.toFixed(2) : '—'}<br />
                        baseElectricalKw = compressorPower * powerFactor = {settings.compressorPower} * {isFinite(powerFactor) ? powerFactor.toFixed(2) : '—'} = {isFinite(baseElectricalKw) ? baseElectricalKw.toFixed(2) : '—'}<br />
                        defrostPenalty = {(indoorTemp > outdoorTemp) ? defrostPenalty.toFixed(2) : 'N/A'} (only if 20 &lt; outdoorTemp &lt; 45)<br />
                        electricalKw = baseElectricalKw * defrostPenalty = {isFinite(baseElectricalKw) ? baseElectricalKw.toFixed(2) : '—'} * {(indoorTemp > outdoorTemp) ? defrostPenalty.toFixed(2) : 'N/A'} = <strong>{isFinite(electricalKw) ? electricalKw.toFixed(2) : '—'}</strong>
                      </code>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">6. Runtime and Auxiliary Heat</p>
                      <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                        runtime% = buildingHeatLossBtu / heatpumpOutputBtu * 100 = {isFinite(buildingHeatLossBtu) && isFinite(heatpumpOutputBtu) ? buildingHeatLossBtu.toFixed(0) : '—'} / {isFinite(heatpumpOutputBtu) ? heatpumpOutputBtu.toFixed(0) : '—'} * 100 = {isFinite(runtimePercent) ? runtimePercent.toFixed(1) : '—'}%<br />
                        deficitBtu = max(0, buildingHeatLossBtu - heatpumpOutputBtu) = {isFinite(deficitBtu) ? deficitBtu.toFixed(0) : '—'}<br />
                        auxKw = deficitBtu / 3412.14 = {isFinite(deficitBtu) ? deficitBtu.toFixed(0) : '—'} / 3412.14 = <strong>{(indoorTemp > outdoorTemp && isFinite(auxKw)) ? auxKw.toFixed(2) : 'N/A'}</strong>
                      </code>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">7. Hourly Cost</p>
                      <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                        cost_hour = electricalKw * rate = {electricalKw.toFixed(2)} * {settings.utilityCost} = <strong>${costHour.toFixed(2)}</strong>
                      </code>
                    </div>
                  </div>
                </div>
                  <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                    The summary calculations show how the 24-hour totals are computed. The per-hour details show the calculation for a single selected hour. All variables update as you change thermostat settings above or select a different hour.
                  </div>
                </div>
              )}
            </div>

            {/* Heat Loss Comparison Section */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-2">How does your building compare?</h3>
              <p className="mb-4 text-gray-300 dark:text-gray-200">
                Your Home Heat Loss Factor shows how well your home retains thermal energy compared to similar homes in your region.
              </p>
              {/* Example percentile calculation and bar visualization */}
              {(() => {
                // Example: national distribution (replace with real data if available)
                const userFactor = btuLossPerDegreeF;
                // Example bins (BTU/hr/°F): lower is better
                const bins = [400, 500, 600, 700, 800];
                let percentile = 23; // Example: top 23% (replace with real calculation)
                // Bar segments
                const segments = bins.length + 1;
                // Find bin index (lower values are more efficient). Flip so right = most efficient.
                let idxRaw = bins.findIndex(b => userFactor < b);
                if (idxRaw === -1) idxRaw = bins.length;
                const idx = (segments - 1) - idxRaw;
                return (
                  <div className="w-full max-w-2xl mx-auto">
                    <div className="flex justify-between mb-2">
                      <span className="text-red-600 dark:text-red-400 text-sm font-medium">LEAST EFFICIENT</span>
                      <span className="text-green-700 dark:text-green-400 text-sm font-medium">MOST EFFICIENT</span>
                    </div>
                    <div className="flex items-center w-full h-10 rounded-lg overflow-hidden bg-green-200 dark:bg-green-900">
                      {Array.from({ length: segments }).map((_, i) => (
                        <div
                          key={i}
                          className={`flex-1 h-full ${i === idx ? 'relative' : ''} ${i === 0 ? 'rounded-l-lg' : ''} ${i === segments - 1 ? 'rounded-r-lg' : ''}`}
                          style={{ background: `rgba(100,180,80,${0.5 + 0.1 * i})` }}
                        >
                          {i === idx && (
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8">
                              <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs font-semibold px-1 py-0.5 rounded bg-white/90 dark:bg-gray-800/90 text-gray-800 dark:text-gray-100 shadow"
                                   data-testid="efficiency-marker-label">
                                {percentile}%
                              </div>
                              <div className="w-8 h-8 border-4 border-white dark:border-gray-800 rounded-full bg-transparent"></div>
                              <span className="sr-only">Your Home</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-center mt-2">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-gray-100">YOUR HOME</div>
                        <div className="text-sm text-gray-400">TOP {percentile}%</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </>
        )}

        {/* Building Heat Loss Estimator */}
        <div className="card card-hover p-6 fade-in mt-8">
          <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setShowBuildingHeatLoss(v => !v)}>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <span role="img" aria-label="Home">🏠</span> Building Heat Loss
            </h2>
            <button className="text-blue-600 dark:text-blue-400 text-sm underline" onClick={e => { e.stopPropagation(); setShowBuildingHeatLoss(v => !v); }}>{showBuildingHeatLoss ? 'Hide' : 'Show'}</button>
          </div>
          {showBuildingHeatLoss && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <div><label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Square Footage</label><input type="range" min="800" max="4000" step="100" value={squareFeet} onChange={e => setSquareFeet(Number(e.target.value))} className="w-full" /><span className="font-bold text-gray-900 dark:text-gray-100">{squareFeet.toLocaleString()} sq ft</span></div>
                <div><label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Ceiling Height</label><input type="range" min="7" max="20" step="1" value={ceilingHeight} onChange={e => setCeilingHeight(Number(e.target.value))} className="w-full" /><span className="font-bold text-gray-900 dark:text-gray-100">{ceilingHeight} ft</span></div>
                <div><label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Insulation</label><select value={insulationLevel} onChange={e => setInsulationLevel(Number(e.target.value))} className="w-full p-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"><option value={1.4}>Poor</option><option value={1.0}>Average</option><option value={0.65}>Good</option></select></div>
                <div><label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Home Shape</label><select value={homeShape} onChange={e => setHomeShape(Number(e.target.value))} className="w-full p-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"><option value={2.2}>Cabin / A-Frame</option><option value={1.15}>Ranch</option><option value={1.0}>Average</option><option value={0.9}>2-Story</option></select></div>
              </div>
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 space-y-2">
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  <strong>Calculated Heat Loss:</strong> {manualHeatLoss.toLocaleString()} BTU/hr at 70°F ΔT ({(manualHeatLoss / 70).toFixed(1)} BTU/hr/°F)
                  <div className="flex items-start gap-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">This is an estimate — real-world dynamic effects like solar gains, infiltration, or internal heat loads can change results.</p>
                    <button type="button" onClick={() => setShowHeatLossTooltip(!showHeatLossTooltip)} className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors mt-1" aria-label="More about dynamic effects">
                      <HelpCircle size={14} />
                    </button>
                  </div>
                </p>
                {showHeatLossTooltip && (
                  <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg text-xs text-gray-700 dark:text-gray-300">
                    <p className="font-semibold text-blue-700 dark:text-blue-300 mb-2">Why this is an estimate</p>
                    <ul className="ml-4 list-disc space-y-1">
                      <li><strong>Solar gains:</strong> Sunlight through windows and glazing can reduce heating demand during the day.</li>
                      <li><strong>Infiltration:</strong> Air leakage (drafts) introduces additional heating load, especially in cold/windy conditions.</li>
                      <li><strong>Internal loads:</strong> Occupancy, appliances, and lighting add heat that affects the net load.</li>
                    </ul>
                  </div>
                )}
                <p className="text-xs text-gray-700 dark:text-gray-300">
                  <strong>What does this mean?</strong> We report heat loss at a standardized ΔT of 70°F—that’s the difference between an indoor setpoint of 70°F and an outdoor design temperature of 0°F. Using a fixed ΔT is a common engineering practice because it makes heat-loss numbers comparable between homes and useful for sizing a heating system.
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  <strong>More detail:</strong> The value in BTU/hr is the building's heat loss at that ΔT; dividing by 70 gives BTU/hr/°F so you can multiply by any real-world indoor–outdoor temperature difference to estimate hourly heat loss (e.g., at 50°F ΔT, Heat Loss ≈ BTU/hr/°F × 50).
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  (You can adjust the indoor setpoint or use the Analyzer tab for more precise, data-driven results.)
                </p>
                {manualHeatLoss > capacity * 1000 && (
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    ⚠️ Heat loss exceeds system capacity — expect high aux heat usage in cold weather
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
