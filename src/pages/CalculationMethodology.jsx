import React, { useMemo, useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Info, Home, Snowflake, Clock, Mountain, BarChart3, Flame, ThermometerSun } from 'lucide-react';
import { DashboardLink } from '../components/DashboardLink';
import { getDefrostPenalty, calculateHeatLoss } from '../lib/heatUtils';

const CalculationMethodology = () => {
  const [showMath, setShowMath] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const prefersWide = window.matchMedia('(min-width: 768px)').matches;
      setShowMath(prefersWide);
    }
  }, []);

  // Helper component for clickable variable links
  const VarLink = ({ to, field, children, title }) => (
    <Link
      to={`${to}${field ? `?highlight=${field}` : ''}`}
      title={title || `Click to edit this value in the calculator`}
      className="underline decoration-dotted hover:decoration-solid text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors cursor-pointer"
    >
      {children}
    </Link>
  );

  const MathBlock = ({ children }) => (
    <div className={showMath ? 'block' : 'hidden md:block'}>
      {children}
    </div>
  );

  const outletContext = useOutletContext() || {};
  const { userSettings, setUserSetting } = outletContext;
  const squareFeet = Number(userSettings?.squareFeet) || outletContext?.squareFeet || 1500;
  const insulationLevel = Number(userSettings?.insulationLevel) || outletContext?.insulationLevel || 1.0;
  const homeShape = Number(userSettings?.homeShape) || outletContext?.homeShape || 1.0;
  const ceilingHeight = Number(userSettings?.ceilingHeight) || outletContext?.ceilingHeight || 8;
  const indoorTemp = Number(userSettings?.indoorTemp ?? userSettings?.winterThermostat) || outletContext?.indoorTemp || 70;
  const manualTemp = outletContext?.manualTemp || 32;
  const manualHumidity = outletContext?.manualHumidity || 65;
  const tons = outletContext?.tons || userSettings?.capacity || 2.0;
  const compressorPower = outletContext?.compressorPower || (tons * 1.0 * (15 / (Number(userSettings?.efficiency) || 15)));
  const utilityCost = Number(userSettings?.utilityCost) || outletContext?.utilityCost || 0.15;
  // Calculate heat loss from building parameters if not provided
  const heatLoss = outletContext?.heatLoss || userSettings?.heatLoss || calculateHeatLoss({
    squareFeet,
    insulationLevel,
    homeShape,
    ceilingHeight,
  });
  const energyMode = userSettings?.energyMode || outletContext?.energyMode || 'heating';
  const setEnergyMode = (v) => setUserSetting ? setUserSetting('energyMode', v) : (outletContext?.setEnergyMode || (() => { }))(v);
  const efficiency = Number(userSettings?.efficiency) || outletContext?.efficiency || 15;
  const solarExposure = Number(userSettings?.solarExposure) || outletContext?.solarExposure || 1.0;

  const methodologyCalcs = useMemo(() => {
    const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
    const btuLossPerDegreeF = heatLoss / 70;
    const buildingHeatLoss = btuLossPerDegreeF * (indoorTemp - manualTemp);
    let capacityFactor = 1.0;
    if (manualTemp < 47) capacityFactor = 1.0 - (47 - manualTemp) * 0.01;
    if (manualTemp < 17) capacityFactor = 0.70 - (17 - manualTemp) * 0.0074;
    capacityFactor = Math.max(0.3, capacityFactor);
    const powerFactor = 1 / Math.max(0.7, capacityFactor);
    const defrostPenalty = getDefrostPenalty(manualTemp, manualHumidity);
    const electricalKw = (compressorPower * powerFactor) * defrostPenalty;
    // Heat pump output: 1 ton = 12,000 BTU/hr at 47°F, adjusted by capacity factor
    const hpOutputBtu = tons * 12000 * capacityFactor;
    const runtime = (buildingHeatLoss / hpOutputBtu) * 100;
    const energyForHour = electricalKw * (Math.min(100, Math.max(0, runtime)) / 100);
    const costForHour = energyForHour * utilityCost;
    return {
      designHeatLoss: heatLoss, btuLossPerDegreeF, buildingHeatLoss, electricalKw, hpOutputBtu,
      runtime, energyForHour, costForHour, ceilingMultiplier,
      capacityFactor, powerFactor, defrostPenalty, compressorPower,
    };
  }, [
    squareFeet, insulationLevel, homeShape, ceilingHeight, indoorTemp, manualTemp,
    manualHumidity, tons, compressorPower, utilityCost, heatLoss
  ]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-end mb-4">
          <DashboardLink />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 mb-4">
            <Info size={24} /> Calculation Methodology
          </h2>

          {/* Mode Toggle */}
          <div className="mb-6 flex items-center justify-center">
            <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
              <button
                onClick={() => setEnergyMode('heating')}
                className={`px-4 py-2 text-sm font-semibold flex items-center gap-2 transition-colors ${energyMode === 'heating'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
              >
                <Flame size={16} /> Heating
              </button>
              <button
                onClick={() => setEnergyMode('cooling')}
                className={`px-4 py-2 text-sm font-semibold flex items-center gap-2 transition-colors ${energyMode === 'cooling'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
              >
                <ThermometerSun size={16} /> Cooling
              </button>
            </div>
          </div>

          <div className="space-y-8 text-sm text-gray-700 dark:text-gray-300 font-mono p-4 sm:p-6 bg-gray-100 dark:bg-gray-900 rounded-lg">
            <div className="font-sans text-base leading-relaxed bg-white dark:bg-gray-800 rounded-md p-4 border border-gray-200 dark:border-gray-700">
              <p className="mb-2 font-bold text-gray-900 dark:text-gray-100 text-lg">How to Read This Page</p>
              <p className="mb-2">This page explains the science behind our calculators. We model how your home {energyMode === 'heating' ? 'loses heat' : 'gains heat'}, how your {energyMode === 'heating' ? 'heat pump performs in the cold' : 'A/C or heat pump removes that heat'}, and how we estimate your budget. You don't need to understand the math to use the tools, but it's here for engineers to audit and homeowners to see we're not a black box.</p>
              <p className="mb-0 text-sm text-gray-600 dark:text-gray-400">Clicking on an underlined number will take you to the calculator where you can change that value.</p>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-400 font-sans mb-2">NOTE: Solutions shown for sections 1–3 are based on the live inputs from the calculators. Section 4 uses a fixed example for clarity.</p>

            {energyMode === 'heating' && (
              <>
                {/* --- SECTION 1: BUILDING HEAT LOSS (DYNAMIC) --- */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-100 font-sans text-xl flex items-center gap-2"><Home size={20} className="text-blue-600 dark:text-blue-400" /> 1. Building Heat Loss</h4>

                  {/* Understanding the 22.67 Constant */}
                  <div className="bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Understanding the Constants</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                      <strong>22.67 BTU/(hr·ft²):</strong> This is a baseline Heat Loss Factor used in simplified residential load calculations. It represents the heat loss per square foot for a typically constructed modern home (e.g., 2×4 walls with R-13 insulation, average window quality, and standard air tightness) assuming a 70°F temperature difference.
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                      Our calculator uses this as a starting point and then applies your specific insulation, home shape, and ceiling height as multipliers to create a more accurate, customized estimate for your building. This method is a common industry practice for providing quick and reliable estimates.
                    </p>
                  </div>

                  <div className="pl-4 border-l-2 border-gray-300 dark:border-gray-600 space-y-4">
                    <div>
                      <p className="italic text-gray-600 dark:text-gray-400 font-sans font-normal">Calculates the home's total design heat loss by combining all building factors.</p>
                      <code className="block mt-1 p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto whitespace-nowrap border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                        Design_Heat_Loss = <VarLink to="/energy-flow" field="squareFeet">{squareFeet} sq ft</VarLink> * 22.67 * <VarLink to="/energy-flow" field="insulationLevel">{insulationLevel}</VarLink> * <VarLink to="/energy-flow" field="homeShape">{homeShape}</VarLink> * <VarLink to="/energy-flow" field="ceilingHeight">{methodologyCalcs.ceilingMultiplier.toFixed(1)}</VarLink> = <strong>{(methodologyCalcs.designHeatLoss / 1000).toFixed(2)} kBTU/hr</strong>
                      </code>
                      <code className="block mt-2 p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto whitespace-nowrap border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                        Ceiling multiplier = 1 + (<VarLink to="/energy-flow" field="ceilingHeight">{ceilingHeight} ft</VarLink> - 8) × 0.1 = <strong>{methodologyCalcs.ceilingMultiplier.toFixed(1)}</strong>
                      </code>
                    </div>
                    <div>
                      <p className="italic text-gray-600 dark:text-gray-400 font-sans font-normal">Determines how many BTUs the house loses for every one-degree drop in temperature.</p>
                      <code className="block mt-1 p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto whitespace-nowrap border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>BTU_Loss_Per_Degree_F = {(methodologyCalcs.designHeatLoss / 1000).toFixed(2)} kBTU/hr / 70 °F = <strong>{methodologyCalcs.btuLossPerDegreeF.toFixed(1)} BTU/(hr*°F)</strong></code>
                    </div>
                    <div>
                      <p className="italic text-gray-600 dark:text-gray-400 font-sans font-normal">Finds the specific heat loss for the current outdoor temperature.</p>
                      <code className="block mt-1 p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto whitespace-nowrap border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                        Building_Heat_Loss = {methodologyCalcs.btuLossPerDegreeF.toFixed(1)} * (<VarLink to="/cost-forecaster" field="indoorTemp">{indoorTemp} °F</VarLink> - <VarLink to="/cost-forecaster" field="manualTemp">{manualTemp} °F</VarLink>) = <strong>{(methodologyCalcs.buildingHeatLoss / 1000).toFixed(2)} kBTU/hr</strong>
                      </code>
                    </div>
                  </div>
                </div>

                {/* --- SECTION 2: HEAT PUMP PERFORMANCE (DYNAMIC) --- */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-100 font-sans text-xl flex items-center gap-2"><Snowflake size={20} className="text-cyan-600 dark:text-cyan-400" /> 2. Heat Pump Performance</h4>
                  <div className="pl-4 border-l-2 border-gray-300 dark:border-gray-600 space-y-4">
                    <div>
                      <p className="italic text-gray-600 dark:text-gray-400 font-sans font-normal">Calculates the electricity draw, including penalties for cold and humidity.</p>
                      <code className="block mt-1 p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto whitespace-nowrap border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                        Electrical_kW = Compressor_Power × Power_Factor × Defrost_Penalty<br/>
                        = {methodologyCalcs.compressorPower.toFixed(2)} kW × {methodologyCalcs.powerFactor.toFixed(2)} × {methodologyCalcs.defrostPenalty.toFixed(2)} = <strong>{methodologyCalcs.electricalKw.toFixed(2)} kW</strong>
                      </code>
                    </div>
                    <div>
                      <p className="italic text-gray-600 dark:text-gray-400 font-sans font-normal">Calculates the actual heat output at the given temperature.</p>
                      <code className="block mt-1 p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto whitespace-nowrap border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                        HP_Output_BTU = <VarLink to="/energy-flow" field="capacity">{tons} tons</VarLink> × 12,000 BTU/ton × Capacity_Factor({manualTemp}°F) = {tons} × 12,000 × {methodologyCalcs.capacityFactor.toFixed(3)} = <strong>{(methodologyCalcs.hpOutputBtu / 1000).toFixed(2)} kBTU/hr</strong>
                      </code>
                    </div>
                  </div>
                </div>

                {/* --- SECTION 3: HOURLY SIMULATION (DYNAMIC) --- */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-100 font-sans text-xl flex items-center gap-2"><Clock size={20} className="text-emerald-600 dark:text-emerald-400" /> 3. Hourly Simulation</h4>
                  <div className="pl-4 border-l-2 border-gray-300 dark:border-gray-600 space-y-4">
                    <div>
                      <p className="italic text-gray-600 dark:text-gray-400 font-sans font-normal">Calculates the percentage of time the heat pump must run.</p>
                      <code className="block mt-1 p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto whitespace-nowrap border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>Runtime = ({methodologyCalcs.buildingHeatLoss.toFixed(0)} / {methodologyCalcs.hpOutputBtu.toFixed(0)}) * 100 = <strong>{methodologyCalcs.runtime.toFixed(1)}%</strong></code>
                    </div>
                    <div>
                      <p className="italic text-gray-600 dark:text-gray-400 font-sans font-normal">Determines the energy consumed in one hour.</p>
                      <code className="block mt-1 p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto whitespace-nowrap border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>Energy_For_Hour = {methodologyCalcs.electricalKw.toFixed(2)} kW * ({methodologyCalcs.runtime.toFixed(1)}% / 100) = <strong>{methodologyCalcs.energyForHour.toFixed(2)} kWh</strong></code>
                    </div>
                    <div>
                      <p className="italic text-gray-600 dark:text-gray-400 font-sans font-normal">Calculates the final cost for one hour of operation.</p>
                      <code className="block mt-1 p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto whitespace-nowrap border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                        Cost_For_Hour = {methodologyCalcs.energyForHour.toFixed(2)} kWh * <VarLink to="/cost-forecaster" field="utilityCost">${utilityCost.toFixed(3)}/kWh</VarLink> = <strong>${methodologyCalcs.costForHour.toFixed(2)}</strong>
                      </code>
                    </div>
                  </div>
                </div>
              </>
            )}

            {energyMode === 'cooling' && (
              <>
                {/* --- SECTION 1: BUILDING HEAT GAIN (COOLING MODE) --- */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-100 font-sans text-xl flex items-center gap-2"><Home size={20} className="text-orange-600 dark:text-orange-400" /> 1. Building Heat Gain</h4>

                  {/* Understanding the 25.0 Constant */}
                  <div className="bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800 p-4">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Understanding the Constants</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                      <strong>25.0 BTU/(hr·ft²):</strong> This is a baseline Heat Gain Factor used in simplified residential load calculations. It represents the heat gain per square foot for a typically constructed modern home, including sensible heat (temperature) and latent heat (humidity removal) assuming a 20°F temperature difference.
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                      Our calculator uses this as a starting point and then applies your specific insulation, home shape, and ceiling height as multipliers to create a more accurate, customized estimate for your building. This method is a common industry practice for providing quick and reliable estimates.
                    </p>
                  </div>

                  <div className="pl-4 border-l-2 border-gray-300 dark:border-gray-600 space-y-4">
                    <div>
                      <p className="italic text-gray-600 dark:text-gray-400 font-sans font-normal">Calculates the home's total design heat gain by combining all building factors.</p>
                      <code className="block mt-1 p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto whitespace-nowrap border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                        Design_Heat_Gain = <VarLink to="/energy-flow" field="squareFeet">{squareFeet} sq ft</VarLink> * 25.0 * <VarLink to="/energy-flow" field="insulationLevel">{insulationLevel}</VarLink> * <VarLink to="/energy-flow" field="homeShape">{homeShape}</VarLink> * <VarLink to="/energy-flow" field="ceilingHeight">{methodologyCalcs.ceilingMultiplier.toFixed(1)}</VarLink> = <strong>{(methodologyCalcs.designHeatLoss * 25.0 / 22.67 / 1000).toFixed(2)} kBTU/hr</strong>
                      </code>
                      <code className="block mt-2 p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto whitespace-nowrap border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                        Ceiling multiplier = 1 + (<VarLink to="/energy-flow" field="ceilingHeight">{ceilingHeight} ft</VarLink> - 8) × 0.1 = <strong>{methodologyCalcs.ceilingMultiplier.toFixed(1)}</strong>
                      </code>
                    </div>
                    <div>
                      <p className="italic text-gray-600 dark:text-gray-400 font-sans font-normal">Determines how many BTUs the house gains for every one-degree rise in temperature.</p>
                      <code className="block mt-1 p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto whitespace-nowrap border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>BTU_Gain_Per_Degree_F = {(methodologyCalcs.designHeatLoss * 25.0 / 22.67 / 1000).toFixed(2)} kBTU/hr / 20 °F = <strong>{(methodologyCalcs.designHeatLoss * 25.0 / 22.67 / 20).toFixed(1)} BTU/(hr*°F)</strong></code>
                    </div>
                    <div>
                      <p className="italic text-gray-600 dark:text-gray-400 font-sans font-normal">Finds the specific heat gain for the current outdoor temperature, including solar exposure.</p>
                      <code className="block mt-1 p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto whitespace-nowrap border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                        Building_Heat_Gain = {(methodologyCalcs.designHeatLoss * 25.0 / 22.67 / 20).toFixed(1)} * (<VarLink to="/cost-forecaster" field="manualTemp">{manualTemp} °F</VarLink> - <VarLink to="/cost-forecaster" field="indoorTemp">{indoorTemp} °F</VarLink>) * <VarLink to="/settings" field="solarExposure">{solarExposure}</VarLink> = <strong>{(methodologyCalcs.designHeatLoss * 25.0 / 22.67 / 20 * (manualTemp - indoorTemp) * solarExposure / 1000).toFixed(2)} kBTU/hr</strong>
                      </code>
                    </div>
                  </div>
                </div>

                {/* --- SECTION 2: A/C PERFORMANCE (COOLING MODE) --- */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-100 font-sans text-xl flex items-center gap-2"><Snowflake size={20} className="text-blue-600 dark:text-blue-400" /> 2. A/C Performance</h4>
                  <div className="pl-4 border-l-2 border-gray-300 dark:border-gray-600 space-y-4">
                    <div>
                      <p className="italic text-gray-600 dark:text-gray-400 font-sans font-normal">Calculates the nominal cooling capacity in BTU/hr.</p>
                      <code className="block mt-1 p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto whitespace-nowrap border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>Nominal_Capacity_BTU = <strong>{(tons * 12000).toLocaleString()} BTU/hr</strong></code>
                    </div>
                    <div>
                      <p className="italic text-gray-600 dark:text-gray-400 font-sans font-normal">Calculates the electrical efficiency (SEER2 rating).</p>
                      <code className="block mt-1 p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto whitespace-nowrap border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>SEER2_Efficiency = <strong>{efficiency} BTU/Wh</strong></code>
                    </div>
                    <div>
                      <p className="italic text-gray-600 dark:text-gray-400 font-sans font-normal">Calculates the electrical power draw in kW.</p>
                      <code className="block mt-1 p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto whitespace-nowrap border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>Electrical_kW = {(tons * 12000).toLocaleString()} BTU/hr / ({efficiency} BTU/Wh * 1000) = <strong>{((tons * 12000) / (efficiency * 1000)).toFixed(2)} kW</strong></code>
                    </div>
                  </div>
                </div>

                {/* --- SECTION 3: HOURLY COOLING SIMULATION (COOLING MODE) --- */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-100 font-sans text-xl flex items-center gap-2"><Clock size={20} className="text-emerald-600 dark:text-emerald-400" /> 3. Hourly Cooling Simulation</h4>
                  <div className="pl-4 border-l-2 border-gray-300 dark:border-gray-600 space-y-4">
                    <div>
                      <p className="italic text-gray-600 dark:text-gray-400 font-sans font-normal">Calculates the percentage of time the A/C must run to meet the cooling load.</p>
                      <code className="block mt-1 p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto whitespace-nowrap border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>Runtime = ({(methodologyCalcs.designHeatLoss * 25.0 / 22.67 / 20 * (manualTemp - indoorTemp) * solarExposure).toFixed(0)} / {(tons * 12000).toFixed(0)}) * 100 = <strong>{Math.min(100, (methodologyCalcs.designHeatLoss * 25.0 / 22.67 / 20 * (manualTemp - indoorTemp) * solarExposure / (tons * 12000)) * 100).toFixed(1)}%</strong></code>
                    </div>
                    <div>
                      <p className="italic text-gray-600 dark:text-gray-400 font-sans font-normal">Determines the energy consumed in one hour.</p>
                      <code className="block mt-1 p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto whitespace-nowrap border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>Energy_For_Hour = {((tons * 12000) / (efficiency * 1000)).toFixed(2)} kW * ({Math.min(100, (methodologyCalcs.designHeatLoss * 25.0 / 22.67 / 20 * (manualTemp - indoorTemp) * solarExposure / (tons * 12000)) * 100).toFixed(1)}% / 100) = <strong>{(((tons * 12000) / (efficiency * 1000)) * Math.min(100, (methodologyCalcs.designHeatLoss * 25.0 / 22.67 / 20 * (manualTemp - indoorTemp) * solarExposure / (tons * 12000)) * 100) / 100).toFixed(2)} kWh</strong></code>
                    </div>
                    <div>
                      <p className="italic text-gray-600 dark:text-gray-400 font-sans font-normal">Calculates the final cost for one hour of operation.</p>
                      <code className="block mt-1 p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto whitespace-nowrap border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                        Cost_For_Hour = {(((tons * 12000) / (efficiency * 1000)) * Math.min(100, (methodologyCalcs.designHeatLoss * 25.0 / 22.67 / 20 * (manualTemp - indoorTemp) * solarExposure / (tons * 12000)) * 100) / 100).toFixed(2)} kWh * <VarLink to="/cost-forecaster" field="utilityCost">${utilityCost.toFixed(3)}/kWh</VarLink> = <strong>${((((tons * 12000) / (efficiency * 1000)) * Math.min(100, (methodologyCalcs.designHeatLoss * 25.0 / 22.67 / 20 * (manualTemp - indoorTemp) * solarExposure / (tons * 12000)) * 100) / 100) * utilityCost).toFixed(2)}</strong>
                      </code>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* --- SECTION 4: COST VS. ELEVATION GRAPH (STATIC EXAMPLE) --- */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-800 dark:text-gray-100 font-sans text-xl flex items-center gap-2">
                <Mountain size={20} className="text-purple-600 dark:text-purple-400" /> 4. Cost vs. Elevation Graph
              </h4>
              <div className="pl-4 border-l-2 border-gray-300 dark:border-gray-600 space-y-4 font-sans text-gray-700 dark:text-gray-300">
                <div className="italic text-gray-600 dark:text-gray-400 space-y-2">
                  <p>To model the effect of altitude on temperature, the calculator uses the <strong>environmental lapse rate</strong>—the rate at which air cools as it rises. This rate is based on two standard scientific values:</p>
                  <ul className="list-disc pl-5">
                    <li><strong>Dry Adiabatic Lapse Rate (DALR):</strong> The rate for dry air, a constant <strong>5.4°F per 1,000 ft</strong>.</li>
                    <li><strong>Saturated Adiabatic Lapse Rate (SALR):</strong> The rate for moist air, approx. <strong>2.7°F per 1,000 ft</strong>.</li>
                  </ul>
                  <p>The calculator interpolates between these two rates based on relative humidity. Let's walk through an example:</p>
                </div>
                <div>
                  <h5 className="font-semibold">Example Scenario</h5>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Home Elevation: 3,500 ft | Weather Station Elevation: 500 ft | Station Temp: 32°F | Humidity: 65%</p>
                </div>
                <div>
                  <p className="italic text-gray-600 dark:text-gray-400"><strong>Step 1: Calculate the Humidity-Adjusted Lapse Rate</strong></p>
                  <code className="block mt-1 p-3 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto whitespace-nowrap border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>Lapse_Rate = SALR + (DALR - SALR) * (1 - Humidity_Ratio)</code>
                  <code className="block mt-1 p-3 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto whitespace-nowrap border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>Lapse_Rate = 2.7 + (5.4 - 2.7) * (1 - 0.65) = <strong>3.65 °F per 1,000 ft</strong></code>
                </div>
                <div>
                  <p className="italic text-gray-600 dark:text-gray-400"><strong>Step 2: Calculate the Total Temperature Adjustment</strong></p>
                  <code className="block mt-1 p-3 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto whitespace-nowrap border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>Temp_Adjustment = ((Home_Elevation - Station_Elevation) / 1000) * Lapse_Rate</code>
                  <code className="block mt-1 p-3 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto whitespace-nowrap border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>Temp_Adjustment = ((3,500ft - 500ft) / 1000) * 3.65 = <strong>10.95 °F</strong></code>
                </div>
                <div>
                  <p className="italic text-gray-600 dark:text-gray-400"><strong>Step 3: Determine the Final Adjusted Temperature</strong></p>
                  <code className="block mt-1 p-3 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto whitespace-nowrap border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>Adjusted_Temp = Station_Temp - Temp_Adjustment</code>
                  <code className="block mt-1 p-3 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto whitespace-nowrap border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>Adjusted_Temp = 32°F - 10.95°F = <strong>21.05 °F</strong></code>
                </div>
                <div>
                  <p className="italic text-gray-600 dark:text-gray-400">
                    This colder, more accurate temperature is then used in the full heating cost simulation. The graph is generated by running this entire process repeatedly for a range of elevations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalculationMethodology;
