/**
 * Methodology - Collapsible Calculation Methodology Section
 * Extracted from SevenDayCostForecaster for maintainability
 */
import React from "react";
import {
  ChevronUp,
  ChevronDown,
  FileText,
  Home,
  Settings,
  Thermometer,
  Calculator,
} from "lucide-react";
import * as heatUtils from "../../../lib/heatUtils";
import { computeHourlyRate } from "../../../lib/costUtils";

const Methodology = ({
  show,
  onToggle,
  // Building data
  squareFeet,
  insulationLevel,
  homeShape,
  ceilingHeight,
  // System data
  capacity,
  tons,
  hspf2,
  compressorPower,
  utilityCost,
  // Temperature data
  indoorTemp,
  nighttimeTemp,
  // Location data
  foundLocationName,
  locationElevation,
  energyMode,
  // Forecast data
  adjustedForecast,
  effectiveHeatLoss,
  weeklyMetrics,
  breakdownView,
  useElectricAuxHeatSetting,
  localRates,
  // Heat loss method info
  useCalculatedHeatLoss,
  useManualHeatLoss,
  useAnalyzerHeatLoss,
}) => {
  const ceilingMultiplier = 1 + (ceilingHeight - 8) * 0.1;
  const designHeatLoss =
    Math.round(
      (squareFeet * 22.67 * insulationLevel * homeShape * ceilingMultiplier) /
        1000
    ) * 1000;
  const btuLossPerDegree = (
    (squareFeet * 22.67 * insulationLevel * homeShape * ceilingMultiplier) /
    70
  ).toFixed(1);

  const handleCopy = (e) => {
    e.stopPropagation();
    const methodologyText =
      document.getElementById("calculation-methodology-content")?.innerText ||
      "";
    navigator.clipboard.writeText(methodologyText).then(() => {
      const btn = e.target.closest("button");
      const originalText = btn?.textContent;
      if (btn) {
        btn.textContent = "Copied!";
        setTimeout(() => {
          if (btn) btn.textContent = originalText;
        }, 2000);
      }
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden mt-6">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
      >
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            View Calculation Methodology
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            title="Copy calculation methodology to clipboard"
          >
            Copy
          </button>
          {show ? (
            <ChevronUp className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          ) : (
            <ChevronDown className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          )}
        </div>
      </button>

      {show && (
        <div
          id="calculation-methodology-content"
          className="px-6 pb-6 space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6"
        >
          {/* Weather Data Source Attribution */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              <strong>Weather Data:</strong> NOAA 30-year normals, adjusted with
              7-day forecast from Open-Meteo API.
              {foundLocationName &&
                ` Location: ${foundLocationName.split("(")[0].trim()}.`}
              {locationElevation > 0 &&
                ` Elevation: ${locationElevation.toLocaleString()} ft.`}
              {energyMode === "cooling" &&
                " Humidity data included for cooling load calculations."}
            </p>
          </div>

          {/* Building Characteristics */}
          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-3">
              <Home className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h4 className="font-bold text-lg text-gray-900 dark:text-white">
                Building Characteristics
              </h4>
            </div>
            {/* Heat Loss Method Indicator */}
            {(() => {
              const useCalculated = useCalculatedHeatLoss !== false; // Default to true if not provided
              const useManual = Boolean(useManualHeatLoss);
              const useAnalyzer = Boolean(useAnalyzerHeatLoss);
              
              let methodLabel = "";
              let methodColor = "text-blue-600 dark:text-blue-400";
              
              if (useManual) {
                methodLabel = "Using Manual Entry";
                methodColor = "text-purple-600 dark:text-purple-400";
              } else if (useAnalyzer) {
                methodLabel = "Using CSV Analyzer Data";
                methodColor = "text-amber-600 dark:text-amber-400";
              } else if (useCalculated) {
                methodLabel = "Using Calculated (DOE Data)";
                methodColor = "text-blue-600 dark:text-blue-400";
              }
              
              if (methodLabel) {
                return (
                  <div className={`mb-3 text-xs font-semibold ${methodColor} bg-white dark:bg-gray-800 rounded px-2 py-1 inline-block border border-current`}>
                    📊 {methodLabel}
                  </div>
                );
              }
              return null;
            })()}
            <div className="space-y-2 text-sm font-mono text-gray-700 dark:text-gray-300">
              <div className="flex justify-between">
                <span>Square Feet:</span>
                <span className="font-bold">
                  {squareFeet.toLocaleString()} sq ft
                </span>
              </div>
              <div className="flex justify-between">
                <span>Insulation Level:</span>
                <span className="font-bold">{insulationLevel.toFixed(2)}x</span>
              </div>
              <div className="flex justify-between">
                <span>Home Shape Factor:</span>
                <span className="font-bold">{homeShape.toFixed(2)}x</span>
              </div>
              <div className="flex justify-between">
                <span>Ceiling Height:</span>
                <span className="font-bold">{ceilingHeight} ft</span>
              </div>
              <div className="flex justify-between">
                <span>Ceiling Multiplier:</span>
                <span className="font-bold">{ceilingMultiplier.toFixed(3)}x</span>
              </div>
              <div className="pt-2 border-t border-blue-300 dark:border-blue-700">
                <div className="flex justify-between">
                  <span>Design Heat Loss @ 70°F ΔT:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {designHeatLoss} BTU/hr
                  </span>
                </div>
                <div
                  className="text-xs mt-2 p-4 bg-[#1a1a1a] rounded-lg border border-gray-700"
                  style={{
                    fontFamily:
                      "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace",
                  }}
                >
                  <span className="text-[#00ff9d]">
                    = {squareFeet.toLocaleString()} × 22.67 ×{" "}
                    {insulationLevel.toFixed(2)} × {homeShape.toFixed(2)} ×{" "}
                    {ceilingMultiplier.toFixed(3)}
                  </span>
                </div>
              </div>
              <div className="pt-2">
                <div className="flex justify-between">
                  <span>BTU Loss per °F:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {btuLossPerDegree} BTU/hr/°F
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* System Configuration */}
          <div className="bg-indigo-50 dark:bg-indigo-950 rounded-lg p-4 border border-indigo-200 dark:border-indigo-800">
            <div className="flex items-center gap-2 mb-3">
              <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h4 className="font-bold text-lg text-gray-900 dark:text-white">
                System Configuration
              </h4>
            </div>
            <div className="space-y-2 text-sm font-mono text-gray-700 dark:text-gray-300">
              <div className="flex justify-between">
                <span>Primary System:</span>
                <span className="font-bold">Heat Pump</span>
              </div>
              <div className="flex justify-between">
                <span>Capacity:</span>
                <span className="font-bold">{capacity}k BTU</span>
              </div>
              <div className="flex justify-between">
                <span>Tons:</span>
                <span className="font-bold">{tons.toFixed(1)} tons</span>
              </div>
              <div className="flex justify-between">
                <span>HSPF2:</span>
                <span className="font-bold">{hspf2.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span>Compressor Power:</span>
                <span className="font-bold">{compressorPower.toFixed(2)} kW</span>
              </div>
              <div className="flex justify-between">
                <span>Electricity Rate:</span>
                <span className="font-bold">${utilityCost.toFixed(3)} / kWh</span>
              </div>
            </div>
          </div>

          {/* Temperature Settings */}
          <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-3">
              <Thermometer className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h4 className="font-bold text-lg text-gray-900 dark:text-white">
                Temperature Settings
              </h4>
            </div>
            <div className="space-y-2 text-sm font-mono text-gray-700 dark:text-gray-300">
              <div className="flex justify-between">
                <span>Indoor Temp:</span>
                <span className="font-bold">{indoorTemp}°F</span>
              </div>
              <div className="flex justify-between">
                <span>Daytime Temp:</span>
                <span className="font-bold">{indoorTemp}°F</span>
              </div>
              <div className="flex justify-between">
                <span>Nighttime Temp:</span>
                <span className="font-bold">{nighttimeTemp}°F</span>
              </div>
            </div>
          </div>

          {/* Example Hour Calculation */}
          {adjustedForecast && adjustedForecast.length > 0 && (
            <ExampleHourCalculation
              firstHour={adjustedForecast[0]}
              indoorTemp={indoorTemp}
              effectiveHeatLoss={effectiveHeatLoss}
              tons={tons}
              compressorPower={compressorPower}
              breakdownView={breakdownView}
              useElectricAuxHeatSetting={useElectricAuxHeatSetting}
              localRates={localRates}
              utilityCost={utilityCost}
            />
          )}

          {/* Weekly Summary */}
          {weeklyMetrics && (
            <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">
                7-Day Summary
              </h4>
              <div className="space-y-2 text-sm font-mono text-gray-700 dark:text-gray-300">
                <div className="flex justify-between">
                  <span>Total HP Energy:</span>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    {weeklyMetrics.totalEnergy.toFixed(1)} kWh
                  </span>
                </div>
                {breakdownView === "withAux" && useElectricAuxHeatSetting && (
                  <>
                    <div className="flex justify-between">
                      <span>Total Aux Energy:</span>
                      <span className="font-bold text-green-600 dark:text-green-400">
                        {weeklyMetrics.summary
                          .reduce((acc, d) => acc + d.auxEnergy, 0)
                          .toFixed(1)}{" "}
                        kWh
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Energy (with Aux):</span>
                      <span className="font-bold text-green-600 dark:text-green-400">
                        {(
                          weeklyMetrics.totalEnergy +
                          weeklyMetrics.summary.reduce(
                            (acc, d) => acc + d.auxEnergy,
                            0
                          )
                        ).toFixed(1)}{" "}
                        kWh
                      </span>
                    </div>
                  </>
                )}
                <div className="pt-2 border-t border-green-300 dark:border-green-700">
                  <div className="flex justify-between">
                    <span>Total 7-Day Cost:</span>
                    <span className="font-bold text-green-600 dark:text-green-400">
                      $
                      {(breakdownView === "withAux" && useElectricAuxHeatSetting
                        ? weeklyMetrics.totalCostWithAux
                        : weeklyMetrics.totalCost
                      ).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span>Average Daily Cost:</span>
                    <span className="font-bold text-green-600 dark:text-green-400">
                      $
                      {(
                        (breakdownView === "withAux" && useElectricAuxHeatSetting
                          ? weeklyMetrics.totalCostWithAux
                          : weeklyMetrics.totalCost) / 7
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Sub-component for Example Hour Calculation
const ExampleHourCalculation = ({
  firstHour,
  indoorTemp,
  effectiveHeatLoss,
  tons,
  compressorPower,
  breakdownView,
  useElectricAuxHeatSetting,
  localRates,
  utilityCost,
}) => {
  const tempDiff = Math.max(1, indoorTemp - firstHour.temp);
  const heatLossFactor = effectiveHeatLoss / 70;
  const buildingHeatLossBtu = heatLossFactor * tempDiff;
  const capacityFactor = heatUtils.getCapacityFactor(firstHour.temp);
  const heatpumpOutputBtu = tons * 3.517 * capacityFactor * 3412.14;
  const powerFactor = 1 / Math.max(0.7, capacityFactor);
  const baseElectricalKw = compressorPower * powerFactor;
  const defrostPenalty = heatUtils.getDefrostPenalty(
    firstHour.temp,
    firstHour.humidity
  );
  const electricalKw = baseElectricalKw * defrostPenalty;
  const runtime =
    heatpumpOutputBtu > 0
      ? (buildingHeatLossBtu / heatpumpOutputBtu) * 100
      : 100;
  const deficitBtu = Math.max(0, buildingHeatLossBtu - heatpumpOutputBtu);
  const auxKw = deficitBtu / 3412.14;
  const energyForHour =
    electricalKw * (Math.min(100, Math.max(0, runtime)) / 100);
  const hourRate = computeHourlyRate(firstHour.time, localRates, utilityCost);
  const hourCost = energyForHour * hourRate;
  const auxCost =
    breakdownView === "withAux" && useElectricAuxHeatSetting
      ? auxKw * hourRate
      : 0;

  return (
    <div className="bg-orange-50 dark:bg-orange-950 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="w-5 h-5 text-orange-600 dark:text-orange-400" />
        <h4 className="font-bold text-lg text-gray-900 dark:text-white">
          Example Hour Calculation (
          {firstHour.time.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          - {firstHour.temp.toFixed(1)}°F outdoor)
        </h4>
      </div>
      <div className="space-y-2 text-sm font-mono text-gray-700 dark:text-gray-300">
        <div className="flex justify-between">
          <span>Temperature Difference:</span>
          <span className="font-bold">{tempDiff.toFixed(1)}°F</span>
        </div>
        <CodeBlock>
          = {indoorTemp}°F - {firstHour.temp.toFixed(1)}°F
        </CodeBlock>

        <div className="flex justify-between">
          <span>Building Heat Loss:</span>
          <span className="font-bold text-orange-600 dark:text-orange-400">
            {buildingHeatLossBtu.toFixed(0)} BTU/hr
          </span>
        </div>
        <CodeBlock>
          = {heatLossFactor.toFixed(1)} BTU/hr/°F × {tempDiff.toFixed(1)}°F
        </CodeBlock>

        <div className="flex justify-between">
          <span>Capacity Factor:</span>
          <span className="font-bold">{capacityFactor.toFixed(3)}</span>
        </div>

        <div className="flex justify-between">
          <span>Heat Pump Output:</span>
          <span className="font-bold text-orange-600 dark:text-orange-400">
            {heatpumpOutputBtu.toFixed(0)} BTU/hr
          </span>
        </div>
        <CodeBlock>
          = {tons.toFixed(1)} tons × 3.517 × {capacityFactor.toFixed(3)} ×
          3412.14
        </CodeBlock>

        <div className="flex justify-between">
          <span>Runtime:</span>
          <span className="font-bold text-orange-600 dark:text-orange-400">
            {Math.min(100, Math.max(0, runtime)).toFixed(1)}%
          </span>
        </div>
        <CodeBlock>
          = ({buildingHeatLossBtu.toFixed(0)} ÷ {heatpumpOutputBtu.toFixed(0)}) ×
          100
        </CodeBlock>

        {deficitBtu > 0 && (
          <>
            <div className="flex justify-between">
              <span>Aux Heat Needed:</span>
              <span className="font-bold text-red-600 dark:text-red-400">
                {auxKw.toFixed(2)} kW
              </span>
            </div>
            <CodeBlock>= {deficitBtu.toFixed(0)} BTU ÷ 3412.14</CodeBlock>
          </>
        )}

        <div className="pt-2 border-t border-orange-300 dark:border-orange-700">
          <div className="flex justify-between">
            <span>Energy for Hour:</span>
            <span className="font-bold text-orange-600 dark:text-orange-400">
              {energyForHour.toFixed(3)} kWh
            </span>
          </div>
          <CodeBlock>
            = {electricalKw.toFixed(2)} kW × (
            {Math.min(100, Math.max(0, runtime)).toFixed(1)} ÷ 100)
          </CodeBlock>

          <div className="pt-2 border-t border-orange-300 dark:border-orange-700">
            <div className="flex justify-between">
              <span>Hourly Cost:</span>
              <span className="font-bold text-orange-600 dark:text-orange-400">
                ${(hourCost + auxCost).toFixed(2)}
              </span>
            </div>
            <CodeBlock>
              = {energyForHour.toFixed(3)} kWh × ${hourRate.toFixed(3)}/kWh
              {auxCost > 0 &&
                ` + ${auxKw.toFixed(2)} kW aux × $${hourRate.toFixed(3)}/kWh`}
            </CodeBlock>
          </div>
        </div>
      </div>
    </div>
  );
};

// Styled code block helper
const CodeBlock = ({ children }) => (
  <div
    className="text-xs mt-1 p-4 bg-[#1a1a1a] rounded-lg border border-gray-700"
    style={{
      fontFamily:
        "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace",
    }}
  >
    <span className="text-[#00ff9d]">{children}</span>
  </div>
);

export default Methodology;

