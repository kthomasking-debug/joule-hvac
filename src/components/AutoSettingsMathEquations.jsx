import React, { useState, useEffect, useMemo } from "react";
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Shield,
  DollarSign,
  Zap,
  ThermometerSun,
} from "lucide-react";
import { getDefrostPenalty } from "../lib/heatUtils";

// Component to display live math equations for auto settings
const AutoSettingsMathEquations = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isMethodologyExpanded, setIsMethodologyExpanded] = useState(false);

  // Listen for settings changes
  useEffect(() => {
    const handleChange = () => {
      setRefreshKey(prev => prev + 1);
    };
    window.addEventListener("thermostatSettingsChanged", handleChange);
    window.addEventListener("storage", handleChange);
    return () => {
      window.removeEventListener("thermostatSettingsChanged", handleChange);
      window.removeEventListener("storage", handleChange);
    };
  }, []);

  // Get CSV analysis data if available
  const analysis = useMemo(() => {
    try {
      const csvData = localStorage.getItem('spa_parsedCsvData');
      if (!csvData) return null;
      const data = JSON.parse(csvData);
      if (!data || data.length === 0) return null;
      
      // Simplified analysis (same logic as in ThermostatSettingsPanel)
      const heatStageCol = Object.keys(data[0] || {}).find(col => 
        col.toLowerCase().includes('heat stage')
      );
      const coolStageCol = Object.keys(data[0] || {}).find(col => 
        col.toLowerCase().includes('cool stage') || col.toLowerCase().includes('compressor stage')
      );
      const currentTempCol = Object.keys(data[0] || {}).find(col => 
        col.toLowerCase().includes('current temp') || col.toLowerCase().includes('indoor temp')
      );
      const heatSetTempCol = Object.keys(data[0] || {}).find(col => 
        col.toLowerCase().includes('heat set temp') || col.toLowerCase().includes('heat setpoint')
      );
      const outdoorTempCol = Object.keys(data[0] || {}).find(col => 
        col.toLowerCase().includes('outdoor temp') || col.toLowerCase().includes('outside temp')
      );
      const auxHeatCol = Object.keys(data[0] || {}).find(col => 
        col.toLowerCase().includes('aux heat')
      );

      const analysis = {
        cyclesPerHour: null,
        shortCycles: 0,
        avgRuntime: null,
        heatDifferential: null,
        compressorMinOutdoorTemp: null,
        auxHeatMaxOutdoorTemp: null,
        heatDissipationTime: null,
        compressorMinCycleOff: null,
        heatMinOnTime: null,
      };

      if (heatStageCol) {
        const heatRuns = data.filter(row => parseFloat(row[heatStageCol] || 0) > 0);
        const heatRuntimes = heatRuns.map(row => parseFloat(row[heatStageCol] || 0));
        
        if (heatRuntimes.length > 0) {
          analysis.avgRuntime = heatRuntimes.reduce((a, b) => a + b, 0) / heatRuntimes.length;
          analysis.shortCycles = heatRuntimes.filter(rt => rt > 0 && rt < 240).length;
          
          let cycleCount = 0;
          let wasRunning = false;
          const recentData = data.slice(-12);
          recentData.forEach((row) => {
            const runtime = parseFloat(row[heatStageCol] || 0);
            const isRunning = runtime > 0;
            if (isRunning && !wasRunning) cycleCount++;
            wasRunning = isRunning;
          });
          analysis.cyclesPerHour = recentData.length >= 4 ? (cycleCount / recentData.length) * 12 : null;
        }

        if (currentTempCol && heatSetTempCol) {
          const heatErrors = [];
          let wasOff = true;
          data.forEach((row) => {
            const runtime = parseFloat(row[heatStageCol] || 0);
            const isRunning = runtime > 0;
            const currentTemp = parseFloat(row[currentTempCol] || 0);
            const setTemp = parseFloat(row[heatSetTempCol] || 0);
            
            if (isRunning && wasOff && currentTemp > 0 && setTemp > 0) {
              heatErrors.push(setTemp - currentTemp);
            }
            wasOff = !isRunning;
          });
          if (heatErrors.length > 0) {
            const maxError = Math.max(...heatErrors);
            analysis.heatDifferential = maxError > 1.0 ? Math.min(maxError, 1.5) : 0.5;
          }
        }

        if (outdoorTempCol) {
          const coldRuns = data.filter(row => {
            const runtime = parseFloat(row[heatStageCol] || 0);
            const outdoorTemp = parseFloat(row[outdoorTempCol] || 0);
            return runtime > 0 && outdoorTemp < 35;
          });
          if (coldRuns.length > 0) {
            const coldestRun = Math.min(...coldRuns.map(r => parseFloat(r[outdoorTempCol] || 0)));
            analysis.compressorMinOutdoorTemp = Math.max(30, Math.ceil(coldestRun + 2));
          }
        }
      }

      if (auxHeatCol && outdoorTempCol) {
        const auxRuns = data.filter(row => parseFloat(row[auxHeatCol] || 0) > 0);
        if (auxRuns.length > 0) {
          const auxOutdoorTemps = auxRuns.map(row => parseFloat(row[outdoorTempCol] || 0));
          const maxAuxTemp = Math.max(...auxOutdoorTemps);
          if (maxAuxTemp > 40) {
            analysis.auxHeatMaxOutdoorTemp = 35;
          }
        } else {
          analysis.auxHeatMaxOutdoorTemp = 50;
        }
      } else {
        analysis.auxHeatMaxOutdoorTemp = 50;
      }

      if (analysis.shortCycles > 0) {
        analysis.compressorMinCycleOff = 600;
        analysis.heatMinOnTime = analysis.avgRuntime < 300 ? 600 : 300;
      } else {
        analysis.compressorMinCycleOff = 300;
        analysis.heatMinOnTime = analysis.avgRuntime < 300 ? 420 : 300;
      }

      // Differential recommendation based on cycles per hour
      // Fix: When cycles are LOW (< 3), use tight comfort (0.5°F)
      // When cycles are HIGH (> 6), use wider differential (1.5°F) to reduce cycling
      if (analysis.cyclesPerHour !== null && !isNaN(analysis.cyclesPerHour) && isFinite(analysis.cyclesPerHour)) {
        if (analysis.cyclesPerHour < 3) {
          // Low cycles = system is efficient, use tight comfort
          analysis.heatDifferential = 0.5;
        } else if (analysis.cyclesPerHour <= 4) {
          analysis.heatDifferential = 0.75;
        } else if (analysis.cyclesPerHour <= 6) {
          analysis.heatDifferential = 1.0;
        } else {
          // High cycles = system is short cycling, use wider differential
          analysis.heatDifferential = 1.5;
        }
      }

      return analysis;
    } catch {
      return null;
    }
  }, [refreshKey]);

  const TYPICAL_VALUES = {
    "heatDifferential": 1.0,
    "coolDifferential": 1.0,
    "compressorMinCycleOff": 600,
    "heatMinOnTime": 300,
    "coolMinOnTime": 300,
    "compressorMinOutdoorTemp": 20,
    "auxHeatMaxOutdoorTemp": 35,
    "heatDissipationTime": 60,
    "coolDissipationTime": 45,
    "acOvercoolMax": 2.5,
    "heatCoolMinDelta": 5,
    "temperatureCorrection": 0,
    "humidityCorrection": 0,
    "thermalProtect": 10,
  };

  const getValue = (key) => {
    if (analysis && analysis[key] !== null && analysis[key] !== undefined) {
      return analysis[key];
    }
    return TYPICAL_VALUES[key];
  };

  // Group equations by optimization category
  const equationGroups = [
    {
      title: "Protect Equipment & Stop Short Cycling",
      description: "Cycle Management",
      icon: Shield,
      equations: [
        {
          name: "Heat Differential",
          key: "heatDifferential",
          unit: "°F",
          formula: analysis?.cyclesPerHour !== null && !isNaN(analysis?.cyclesPerHour) && isFinite(analysis?.cyclesPerHour)
            ? `Formula:\nIf cycles/hour < 3: 0.5°F (tight comfort - system is efficient)\nIf 3-4 cycles/hour: 0.75°F\nIf 4-6 cycles/hour: 1.0°F\nIf > 6 cycles/hour: 1.5°F (reduce cycling)\n\nYour data: ${analysis?.cyclesPerHour?.toFixed(1)} cycles/hour → ${getValue("heatDifferential")}°F`
            : `Default: 1.0°F\n\nFormula: Prevents rapid cycling (6+ cycles/hr). 1.0°F reduces cycles by ~40% with no noticeable comfort loss.`,
          value: getValue("heatDifferential"),
        },
        {
          name: "Cool Differential",
          key: "coolDifferential",
          unit: "°F",
          formula: `Default: 1.0°F\n\nFormula: Same as heat differential - prevents short cycling.`,
          value: getValue("coolDifferential"),
        },
        {
          name: "Compressor Min Cycle-Off",
          key: "compressorMinCycleOff",
          unit: "s",
          formula: analysis?.shortCycles > 0
            ? `Short cycles detected: ${analysis?.shortCycles}\nFormula: Short cycling → 600s (10 min)\nNo short cycling → 300s (5 min)\n\nNEMA MG-1: Motors overheat on startup. Extending rest period allows refrigerant pressures to equalize.`
            : `Default: 600s (10 min)\n\nFormula: NEMA MG-1 standard. Motors overheat on startup. Extending the rest period allows refrigerant pressures to equalize, reducing startup torque and amp draw.`,
          value: getValue("compressorMinCycleOff"),
        },
      ],
    },
    {
      title: "Optimize Balance Point & Aux Costs",
      description: "Temperature Boundaries",
      icon: DollarSign,
      equations: [
        {
          name: "Compressor Min Outdoor Temp",
          key: "compressorMinOutdoorTemp",
          unit: "°F",
          formula: analysis?.compressorMinOutdoorTemp
            ? `From CSV: Coldest run temp = ${((analysis?.compressorMinOutdoorTemp || 0) - 2).toFixed(0)}°F\nFormula: max(30, coldest_run_temp + 2)\n\nBelow balance point, heat pumps run continuously but lose ground.`
            : `Default: 20°F (Balance Point)\n\nFormula: Set to system's balance point. Below balance point, heat pumps run continuously but lose ground. Running compressor at very low temps risks oil thickening and mechanical stress.`,
          value: getValue("compressorMinOutdoorTemp"),
        },
        {
          name: "Aux Heat Max Outdoor Temp",
          key: "auxHeatMaxOutdoorTemp",
          unit: "°F",
          formula: `Default: 35°F\n\nFormula: Electric strips cost 3x more than heat pumps. Never use above freezing unless emergency. This is the "Bank Account" defender.`,
          value: getValue("auxHeatMaxOutdoorTemp"),
        },
      ],
    },
    {
      title: "Capture Free Heat & Cooling",
      description: "Efficiency Harvesting",
      icon: Zap,
      equations: [
        {
          name: "Heat Dissipation Time",
          key: "heatDissipationTime",
          unit: "s",
          formula: `Default: 60s\n\nFormula: Heat exchanger still hot when fire stops. 60s of fan scavenges that "free" heat into room. (Gas furnaces may need shorter time to avoid blowing cold air at end).`,
          value: getValue("heatDissipationTime"),
        },
        {
          name: "Cool Dissipation Time",
          key: "coolDissipationTime",
          unit: "s",
          formula: `Default: 45s\n\nFormula: Coil still wet and cold. 45s evaporates water (cooling air) and raises Sensible Heat Ratio for next run.`,
          value: getValue("coolDissipationTime"),
        },
        {
          name: "Heat Min On Time",
          key: "heatMinOnTime",
          unit: "s",
          formula: analysis?.avgRuntime !== null
            ? `Avg runtime: ${analysis?.avgRuntime?.toFixed(0)}s\nFormula: If avg < 300s → 600s, else 300s\n\nOil return: Oil migrates into lines, takes ~3-5 minutes to push back to crankcase.`
            : `Default: 300s (5 min)\n\nFormula: Oil return requirement. Oil in compressor migrates into lines. Takes ~3-5 minutes of runtime to push it back to crankcase. Short runs starve compressor of oil.`,
          value: getValue("heatMinOnTime"),
        },
        {
          name: "Cool Min On Time",
          key: "coolMinOnTime",
          unit: "s",
          formula: `Default: 300s (5 min)\n\nFormula: Same oil return requirement as heat - oil needs time to return to compressor crankcase.`,
          value: getValue("coolMinOnTime"),
        },
      ],
    },
    {
      title: "Fine-Tune Humidity & Comfort",
      description: "Comfort & Sensors",
      icon: ThermometerSun,
      equations: [
        {
          name: "AC Overcool Max",
          key: "acOvercoolMax",
          unit: "°F",
          formula: `Default: 2.5°F\n\nFormula: Allows AC to act as dehumidifier. If humidity > target, keep cooling. Cold & Dry feels better than Warm & Wet. Default 0°F disables this feature.`,
          value: getValue("acOvercoolMax"),
        },
        {
          name: "Heat/Cool Min Delta",
          key: "heatCoolMinDelta",
          unit: "°F",
          formula: `Default: 5°F\n\nFormula: Prevents "mode fighting." If set to 2°F, AC might overshoot and trigger heat immediately. Range: 4-5°F recommended.`,
          value: getValue("heatCoolMinDelta"),
        },
        {
          name: "Temperature Correction",
          key: "temperatureCorrection",
          unit: "°F",
          formula: `Default: 0°F (no correction)\n\nFormula: Use if thermostat reads accurately. Adjust if you notice consistent offset between thermostat and calibrated thermometer.`,
          value: getValue("temperatureCorrection"),
        },
        {
          name: "Humidity Correction",
          key: "humidityCorrection",
          unit: "%",
          formula: `Default: 0% (no correction)\n\nFormula: Use if humidity sensor reads accurately. Adjust if you notice consistent offset between sensor and calibrated hygrometer.`,
          value: getValue("humidityCorrection"),
        },
        {
          name: "Thermal Protect",
          key: "thermalProtect",
          unit: "°F",
          formula: `Default: 10°F\n\nFormula: Maximum difference between thermostat's temperature reading and remote sensors. If sensor reads wildly different, it may be ignored. Helps avoid using bad sensors.`,
          value: getValue("thermalProtect"),
        },
      ],
    },
  ];

  const [expandedGroups, setExpandedGroups] = useState({
    group0: false,
    group1: false,
    group2: false,
    group3: false,
  });

  const toggleGroup = (groupIndex) => {
    setExpandedGroups(prev => ({
      ...prev,
      [`group${groupIndex}`]: !prev[`group${groupIndex}`],
    }));
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <button
          onClick={() => setIsMethodologyExpanded(!isMethodologyExpanded)}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">
              View Calculation Methodology
            </h3>
          </div>
          {isMethodologyExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>

        {isMethodologyExpanded && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>Optimization Dashboard:</strong> These equations show how the "Auto" button calculates recommended values. 
                {analysis ? " Values are calculated from your uploaded CSV data." : " Values use typical defaults based on Building Science, NEMA Standards, and Comfort Psychology."}
              </p>
            </div>

            {equationGroups.map((group, groupIndex) => {
              const Icon = group.icon;
              const isExpanded = expandedGroups[`group${groupIndex}`];
              
              return (
                <div
                  key={groupIndex}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <button
                    onClick={() => toggleGroup(groupIndex)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <div className="text-left">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                          {group.title}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {group.description}
                        </p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {group.equations.map((eq) => (
                          <div
                            key={eq.key}
                            className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
                                {eq.name}
                              </h4>
                              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                {eq.value}{eq.unit}
                              </span>
                            </div>
                            <div className="mt-3 p-4 bg-[#1a1a1a] rounded-lg border border-gray-700">
                              <pre className="text-xs text-[#00ff9d] whitespace-pre-wrap font-mono" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                                {eq.formula}
                              </pre>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AutoSettingsMathEquations;

