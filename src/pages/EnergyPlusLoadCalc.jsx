import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Calculator,
  Zap,
  Home,
  Thermometer,
  Download,
  Info,
  DollarSign,
  Tag,
  Database,
  Search,
  Loader,
} from "lucide-react";
import { queryHVACKnowledge } from "../utils/rag/ragQuery";
import { fullInputClasses } from "../lib/uiClasses";
import { calculateLoadSimplified, calculateRebates } from "../lib/energyPlusCalculations";

export default function EnergyPlusLoadCalc() {
  const outlet = useOutletContext() || {};
  const { userSettings = {} } = outlet;

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  // Rebate lookup state
  const [rebateZipCode, setRebateZipCode] = useState("");
  const [rebateSku, setRebateSku] = useState("");
  const [rebateLoading, setRebateLoading] = useState(false);
  const [rebateResults, setRebateResults] = useState(null);
  const [rebateError, setRebateError] = useState(null);

  // RAG search state
  const [ragQuery, setRagQuery] = useState("");
  const [ragResults, setRagResults] = useState(null);
  const [ragLoading, setRagLoading] = useState(false);
  const [showRAGSearch, setShowRAGSearch] = useState(false);

  // AI explanation state
  const [aiExplanation, setAiExplanation] = useState(null);
  const [aiExplanationLoading, setAiExplanationLoading] = useState(false);
  const [showApiKeyPrompt, setShowApiKeyPrompt] = useState(false);
  const [tempApiKey, setTempApiKey] = useState("");
  const [savingApiKey, setSavingApiKey] = useState(false);

  // Form state
  const [squareFeet, setSquareFeet] = useState(userSettings.squareFeet || 2000);
  const [ceilingHeight, setCeilingHeight] = useState(userSettings.ceilingHeight || 8);
  const [insulationLevel, setInsulationLevel] = useState(userSettings.insulationLevel || 1.0);
  const [climateZone, setClimateZone] = useState(5); // Default to Zone 5
  const [windowType, setWindowType] = useState("double");
  const [orientation, setOrientation] = useState("north");

  const handleRAGSearch = async () => {
    if (!ragQuery.trim()) {
      return;
    }

    setRagLoading(true);
    setRagResults(null);
    setShowRAGSearch(true);

    try {
      const result = await queryHVACKnowledge(ragQuery);
      setRagResults(result);
      
      // If RAG found nothing, try Groq fallback
      if (!result.success) {
        const groqApiKey = typeof window !== "undefined" ? localStorage.getItem("groqApiKey") : "";
        const model = typeof window !== "undefined" ? localStorage.getItem("groqModel") || "llama-3.3-70b-versatile" : "llama-3.3-70b-versatile";
        
        if (groqApiKey && groqApiKey.trim()) {
          try {
            const { askJouleFallback } = await import("../lib/groqAgent");
            const groqResult = await askJouleFallback(
              `Load calculation question: ${ragQuery}\n\nAnswer as a senior HVAC engineer. Be specific about Manual J, load calculations, sizing, BTU requirements, and engineering standards.`,
              groqApiKey,
              model
            );
            
            if (groqResult.success && groqResult.message) {
              setRagResults({
                success: true,
                content: groqResult.message,
                sources: [{ title: "AI-Powered Response (Groq)", score: 1 }],
                isGroqFallback: true,
              });
            }
          } catch (groqErr) {
            console.error("Groq fallback error:", groqErr);
            // Keep the RAG "no results" message
          }
        }
      }
    } catch (err) {
      console.error("RAG search error:", err);
      setRagResults({ success: false, message: "Failed to search knowledge base." });
    } finally {
      setRagLoading(false);
    }
  };

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const params = {
        squareFeet: Number(squareFeet),
        ceilingHeight: Number(ceilingHeight),
        insulationLevel: Number(insulationLevel),
        climateZone: Number(climateZone),
        windowType,
        orientation,
      };

      // Use frontend calculation (no backend required)
      const data = calculateLoadSimplified(params);
      setResults(data);
      setAiExplanation(null); // Reset explanation for new calculation
    } catch (err) {
      setError(err.message || "Calculation failed. Please check your inputs and try again.");
      console.error("Load calculation error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!tempApiKey.trim()) return;
    
    setSavingApiKey(true);
    try {
      localStorage.setItem("groqApiKey", tempApiKey.trim());
      setShowApiKeyPrompt(false);
      setTempApiKey("");
      // Auto-generate explanation after saving key
      await generateAiExplanation();
    } catch (err) {
      console.error("Error saving API key:", err);
    } finally {
      setSavingApiKey(false);
    }
  };

  const generateAiExplanation = async () => {
    const groqApiKey = typeof window !== "undefined" ? localStorage.getItem("groqApiKey") : "";
    
    // Check if API key exists
    if (!groqApiKey || !groqApiKey.trim()) {
      setShowApiKeyPrompt(true);
      return;
    }

    // Check if we have results
    if (!results) {
      return;
    }

    setAiExplanationLoading(true);
    setShowApiKeyPrompt(false);
    
    try {
      const { askJouleFallback } = await import("../lib/groqAgent");
      const model = typeof window !== "undefined" ? localStorage.getItem("groqModel") || "llama-3.3-70b-versatile" : "llama-3.3-70b-versatile";
      
      // Build prompt based on available data
      let prompt = `Explain this HVAC load calculation in plain, conversational English:\n\n`;
      
      // Building parameters
      prompt += `Building: ${squareFeet} sq ft, ${ceilingHeight}' ceilings\n`;
      prompt += `Insulation: ${insulationLevel}x multiplier (0.65=Good, 1.0=Average, 1.4=Poor)\n`;
      prompt += `Climate Zone: ${climateZone}\n`;
      
      // Design temps if available
      if (results.designHeatingTemp !== undefined && results.designCoolingTemp !== undefined) {
        prompt += `Design Temps: ${results.designHeatingTemp}°F heating, ${results.designCoolingTemp}°F cooling\n`;
      }
      
      prompt += `\nResults:\n`;
      prompt += `- Heating Load: ${results.heatingLoadBtuHr.toLocaleString()} BTU/hr (${results.heatingTons} tons)\n`;
      prompt += `- Cooling Load: ${results.coolingLoadBtuHr.toLocaleString()} BTU/hr (${results.coolingTons} tons)\n`;
      prompt += `- Recommended: ${Math.max(results.heatingTons, results.coolingTons)} tons\n`;
      
      // Include breakdown if available
      if (results.breakdown) {
        prompt += `\nBreakdown:\n`;
        if (results.breakdown.heating) {
          prompt += `Heating - Envelope: ${results.breakdown.heating.envelope.toLocaleString()} BTU/hr, Windows: ${results.breakdown.heating.windows.toLocaleString()} BTU/hr, Infiltration: ${results.breakdown.heating.infiltration.toLocaleString()} BTU/hr\n`;
        }
        if (results.breakdown.cooling) {
          prompt += `Cooling - Envelope: ${results.breakdown.cooling.envelope.toLocaleString()} BTU/hr, Windows: ${results.breakdown.cooling.windows.toLocaleString()} BTU/hr, Solar: ${results.breakdown.cooling.solar.toLocaleString()} BTU/hr, Infiltration: ${results.breakdown.cooling.infiltration.toLocaleString()} BTU/hr\n`;
        }
      }
      
      prompt += `\nWrite a conversational 3-4 paragraph explanation covering:\n`;
      prompt += `1. What the base heat loss coefficient (0.32) means and how insulation affects it\n`;
      prompt += `2. Why the design temperatures matter and what they represent\n`;
      prompt += `3. How the heating/cooling calculations work and the key factors\n`;
      prompt += `4. What these numbers mean for equipment sizing\n\n`;
      prompt += `Write like you're explaining to a homeowner, not an engineer. Be specific about THIS calculation's actual numbers.`;

      const result = await askJouleFallback(prompt, groqApiKey, model);
      
      if (result.success && result.message) {
        setAiExplanation(result.message);
      }
    } catch (err) {
      console.error("AI explanation error:", err);
      // Silently fail - user can still see static explanation
    } finally {
      setAiExplanationLoading(false);
    }
  };

  const handleRebateLookup = async () => {
    setRebateLoading(true);
    setRebateError(null);
    setRebateResults(null);

    try {
      if (!rebateZipCode || !rebateSku) {
        throw new Error("Please enter both zip code and equipment SKU");
      }

      // Use frontend calculation (no backend required)
      const data = calculateRebates(rebateZipCode.trim(), rebateSku.trim());
      setRebateResults(data);
    } catch (err) {
      setRebateError(err.message);
      console.error("Rebate lookup error:", err);
    } finally {
      setRebateLoading(false);
    }
  };

  const climateZones = [
    { value: 1, label: "Zone 1 - Very Hot (Miami, FL)" },
    { value: 2, label: "Zone 2 - Hot (Phoenix, AZ)" },
    { value: 3, label: "Zone 3 - Warm (Atlanta, GA)" },
    { value: 4, label: "Zone 4 - Mixed (Kansas City, MO)" },
    { value: 5, label: "Zone 5 - Cool (Chicago, IL)" },
    { value: 6, label: "Zone 6 - Cold (Minneapolis, MN)" },
    { value: 7, label: "Zone 7 - Very Cold (Fairbanks, AK)" },
  ];

  return (
    <div className="mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Calculator className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            EnergyPlus Load Calculator
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          ACCA Manual J-compliant heating and cooling load calculations using DOE EnergyPlus
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
            <Home className="w-5 h-5" />
            Building Parameters
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Square Feet
              </label>
              <input
                type="number"
                value={squareFeet}
                onChange={(e) => setSquareFeet(e.target.value)}
                className={fullInputClasses}
                min="500"
                max="10000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Ceiling Height (feet)
              </label>
              <input
                type="number"
                value={ceilingHeight}
                onChange={(e) => setCeilingHeight(e.target.value)}
                className={fullInputClasses}
                min="6"
                max="12"
                step="0.5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Insulation Level
              </label>
              <select
                value={insulationLevel}
                onChange={(e) => setInsulationLevel(Number(e.target.value))}
                className={fullInputClasses}
              >
                <option value="0.45">Excellent (R-30+ walls, R-50+ roof)</option>
                <option value="0.65">Good (R-19 walls, R-38 roof)</option>
                <option value="1.0">Average (R-13 walls, R-30 roof)</option>
                <option value="1.4">Poor (R-11 walls, R-19 roof)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Climate Zone
              </label>
              <select
                value={climateZone}
                onChange={(e) => setClimateZone(Number(e.target.value))}
                className={fullInputClasses}
              >
                {climateZones.map((zone) => (
                  <option key={zone.value} value={zone.value}>
                    {zone.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Window Type
              </label>
              <select
                value={windowType}
                onChange={(e) => setWindowType(e.target.value)}
                className={fullInputClasses}
              >
                <option value="single">Single Pane</option>
                <option value="double">Double Pane</option>
                <option value="triple">Triple Pane</option>
                <option value="low-e">Low-E Double Pane</option>
              </select>
            </div>

            <button
              onClick={handleCalculate}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Calculating...
                </>
              ) : (
                <>
                  <Calculator className="w-5 h-5" />
                  Calculate Loads
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Load Calculation Results
          </h2>

          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
              <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                <AlertCircle className="w-5 h-5" />
                <p className="font-semibold">Error</p>
              </div>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {results && (
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <p className="font-semibold text-blue-900 dark:text-blue-100">
                    Calculation Method: {results.method || "simplified"}
                  </p>
                </div>
                {results.designHeatingTemp && (
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Design Heating Temp: {results.designHeatingTemp}°F
                  </p>
                )}
                {results.designCoolingTemp && (
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Design Cooling Temp: {results.designCoolingTemp}°F
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Thermometer className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">Heating Load</h3>
                  </div>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {results.heatingLoadBtuHr?.toLocaleString()} BTU/hr
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {results.heatingTons} tons
                  </p>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Thermometer className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">Cooling Load</h3>
                  </div>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {results.coolingLoadBtuHr?.toLocaleString()} BTU/hr
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {results.coolingTons} tons
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Recommended System Size
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Heating:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {results.heatingTons} tons
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Cooling:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {results.coolingTons} tons
                    </span>
                  </div>
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                    <span className="text-gray-900 dark:text-white font-semibold">Total:</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold text-lg">
                      {Math.max(results.heatingTons, results.coolingTons).toFixed(1)} tons
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  const report = {
                    timestamp: new Date().toISOString(),
                    parameters: {
                      squareFeet,
                      ceilingHeight,
                      insulationLevel,
                      climateZone,
                      windowType,
                    },
                    results,
                  };
                  const blob = new Blob([JSON.stringify(report, null, 2)], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `energyplus-load-report-${Date.now()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Report
              </button>

              {/* Calculation Methodology */}
              {(results.method === "simplified" || results.method === "simplified_manual_j") && (
                <details className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mt-6">
                  <summary className="cursor-pointer font-semibold text-gray-900 dark:text-white text-lg mb-4 flex items-center gap-2">
                    <Calculator className="w-5 h-5" />
                    View Calculation Methodology (Simplified Fallback)
                  </summary>
                  <div className="mt-4 space-y-4 text-sm">
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-700">
                      <p className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                        Note: Using Simplified Manual J-style Calculation
                      </p>
                      <p className="text-yellow-800 dark:text-yellow-200 text-xs">
                        EnergyPlus API is not available. This calculation uses a simplified fallback method based on DOE averages and Manual J principles.
                      </p>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">Constants Used:</h4>
                      <div className="space-y-2 text-blue-800 dark:text-blue-200 font-mono text-xs">
                        <div>base_heat_loss_per_sqft = 0.32 BTU/(hr·ft²·°F)</div>
                        <div className="text-xs italic ml-4 text-blue-700 dark:text-blue-300">Source: DOE Building Energy Codes Program, average residential heat loss coefficient</div>
                        <div className="mt-2">insulation_level = {insulationLevel} (multiplier)</div>
                        <div className="text-xs italic ml-4 text-blue-700 dark:text-blue-300">Source: ACCA Manual J insulation multipliers (0.45=Excellent, 0.65=Good, 1.0=Average, 1.4=Poor)</div>
                        <div className="mt-2">indoor_heating_temp = 70°F</div>
                        <div className="text-xs italic ml-4 text-blue-700 dark:text-blue-300">Source: ASHRAE Standard 55, ACCA Manual J typical heating setpoint</div>
                        <div className="mt-2">indoor_cooling_temp = 75°F</div>
                        <div className="text-xs italic ml-4 text-blue-700 dark:text-blue-300">Source: ASHRAE Standard 55, ACCA Manual J typical cooling setpoint</div>
                        <div className="mt-2">design_heating_temp = {results.designHeatingTemp}°F (Zone {climateZone})</div>
                        <div className="text-xs italic ml-4 text-blue-700 dark:text-blue-300">Source: ASHRAE 99% heating design temperatures by climate zone (1% of hours colder)</div>
                        <div className="mt-2">design_cooling_temp = {results.designCoolingTemp}°F (Zone {climateZone})</div>
                        <div className="text-xs italic ml-4 text-blue-700 dark:text-blue-300">Source: ASHRAE 1% cooling design temperatures by climate zone (1% of hours hotter)</div>
                        <div className="mt-2">cooling_internal_gains_multiplier = 1.2 (20% for internal gains)</div>
                        <div className="text-xs italic ml-4 text-blue-700 dark:text-blue-300">Source: ACCA Manual J methodology for internal heat gains (people, appliances, lighting)</div>
                      </div>
                    </div>

                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-700">
                      <h4 className="font-semibold text-orange-900 dark:text-orange-100 mb-3">Heating Load Calculation:</h4>
                      <div className="space-y-2 text-orange-800 dark:text-orange-200">
                        <div className="font-mono text-xs">
                          <div>Step 1: Calculate heat loss factor</div>
                          <div className="ml-4">heat_loss_factor = base_heat_loss_per_sqft × insulation_level</div>
                          <div className="ml-4">heat_loss_factor = 0.32 × {insulationLevel} = {(0.32 * insulationLevel).toFixed(3)} BTU/(hr·ft²·°F)</div>
                        </div>
                        <div className="font-mono text-xs mt-3">
                          <div>Step 2: Calculate temperature difference</div>
                          <div className="ml-4">heating_delta_t = indoor_heating_temp - design_heating_temp</div>
                          <div className="ml-4">heating_delta_t = 70°F - {results.designHeatingTemp}°F = {70 - results.designHeatingTemp}°F</div>
                        </div>
                        <div className="font-mono text-xs mt-3">
                          <div>Step 3: Calculate heating load</div>
                          <div className="ml-4">heating_load = squareFeet × heat_loss_factor × heating_delta_t</div>
                          <div className="ml-4">heating_load = {squareFeet} × {(0.32 * insulationLevel).toFixed(3)} × {70 - results.designHeatingTemp}</div>
                          <div className="ml-4 font-bold">heating_load = {results.heatingLoadBtuHr?.toLocaleString()} BTU/hr</div>
                          <div className="ml-4">heating_tons = {results.heatingLoadBtuHr?.toLocaleString()} ÷ 12,000 = {results.heatingTons} tons</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-4 border border-cyan-200 dark:border-cyan-700">
                      <h4 className="font-semibold text-cyan-900 dark:text-cyan-100 mb-3">Cooling Load Calculation:</h4>
                      <div className="space-y-2 text-cyan-800 dark:text-cyan-200">
                        <div className="font-mono text-xs">
                          <div>Step 1: Use same heat loss factor as heating</div>
                          <div className="ml-4">heat_loss_factor = {(0.32 * insulationLevel).toFixed(3)} BTU/(hr·ft²·°F)</div>
                        </div>
                        <div className="font-mono text-xs mt-3">
                          <div>Step 2: Calculate temperature difference</div>
                          <div className="ml-4">cooling_delta_t = design_cooling_temp - indoor_cooling_temp</div>
                          <div className="ml-4">cooling_delta_t = {results.designCoolingTemp}°F - 75°F = {results.designCoolingTemp - 75}°F</div>
                        </div>
                        <div className="font-mono text-xs mt-3">
                          <div>Step 3: Calculate cooling load (with internal gains)</div>
                          <div className="ml-4">cooling_load = squareFeet × heat_loss_factor × cooling_delta_t × 1.2</div>
                          <div className="ml-4">cooling_load = {squareFeet} × {(0.32 * insulationLevel).toFixed(3)} × {results.designCoolingTemp - 75} × 1.2</div>
                          <div className="ml-4 font-bold">cooling_load = {results.coolingLoadBtuHr?.toLocaleString()} BTU/hr</div>
                          <div className="ml-4">cooling_tons = {results.coolingLoadBtuHr?.toLocaleString()} ÷ 12,000 = {results.coolingTons} tons</div>
                        </div>
                        <div className="text-xs mt-2 italic">
                          Note: The 1.2 multiplier accounts for internal gains (people, appliances, lighting) per ACCA Manual J methodology. Source: ACCA Manual J Section 4, Internal Heat Gains.
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 border border-gray-300 dark:border-gray-600">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Formula Summary:</h4>
                      <div className="font-mono text-xs text-gray-700 dark:text-gray-300 space-y-1">
                        <div>Heating: heating_load = sqft × 0.32 × insulation × (70 - design_heating_temp)</div>
                        <div>Cooling: cooling_load = sqft × 0.32 × insulation × (design_cooling_temp - 75) × 1.2</div>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-3 space-y-2">
                        <p className="font-semibold">Sources & Citations:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>DOE Building Energy Codes Program - Base heat loss coefficient (0.32 BTU/(hr·ft²·°F))</li>
                          <li>ACCA Manual J (8th Edition) - Load calculation methodology, insulation multipliers, internal gains</li>
                          <li>ASHRAE Standard 55 - Thermal comfort conditions (indoor temperatures)</li>
                          <li>ASHRAE Handbook Fundamentals - Design temperature methodology (99% heating, 1% cooling)</li>
                          <li>ASHRAE Climate Zone Design Temperatures - Zone-specific outdoor design conditions</li>
                        </ul>
                        <p className="mt-2 italic">Note: This is a simplified Manual J-style calculation. For full EnergyPlus simulation with detailed building physics, install EnergyPlus software and Python API.</p>
                      </div>
                    </div>

                    {/* AI-generated or static explanation */}
                    <details className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 border border-indigo-200 dark:border-indigo-700 mt-4">
                      <summary className="cursor-pointer font-semibold text-indigo-900 dark:text-indigo-100 text-sm flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        Explanation (Plain English)
                        {aiExplanation && <span className="ml-2 text-xs bg-indigo-600 dark:bg-indigo-500 text-white px-2 py-0.5 rounded">AI-Generated</span>}
                      </summary>
                      <div className="mt-4 text-sm text-indigo-900 dark:text-indigo-200 space-y-3 leading-relaxed">
                        {/* AI Explanation Button */}
                        {!aiExplanation && !aiExplanationLoading && (
                          <div className="mb-4 pb-4 border-b border-indigo-200 dark:border-indigo-700">
                            <button
                              onClick={generateAiExplanation}
                              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                              <Zap className="w-4 h-4" />
                              Generate AI Explanation (Uses Your Groq API Key)
                            </button>
                          </div>
                        )}

                        {showApiKeyPrompt && !aiExplanation && !aiExplanationLoading ? (
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                            <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                              Enter your Groq API Key
                            </label>
                            <div className="flex gap-2 mb-2">
                              <input
                                type="password"
                                value={tempApiKey}
                                onChange={(e) => setTempApiKey(e.target.value)}
                                placeholder="gsk_..."
                                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && tempApiKey.trim()) {
                                    handleSaveApiKey();
                                  }
                                }}
                              />
                              <button
                                onClick={handleSaveApiKey}
                                disabled={!tempApiKey.trim() || savingApiKey}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-sm transition-colors"
                              >
                                {savingApiKey ? "Saving..." : "Save"}
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <a
                                href="https://console.groq.com/keys"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs transition-colors"
                              >
                                <Zap className="w-3.5 h-3.5" />
                                Get Free API Key →
                              </a>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                No credit card required
                              </p>
                            </div>
                          </div>
                        ) : aiExplanationLoading ? (
                          <div className="flex items-center justify-center py-8 gap-2">
                            <Loader className="w-5 h-5 animate-spin" />
                            <span>Generating explanation...</span>
                          </div>
                        ) : aiExplanation ? (
                          <div className="whitespace-pre-line">{aiExplanation}</div>
                        ) : null}
                      </div>
                    </details>
                  </div>
                </details>
              )}
            </div>
          )}

          {!results && !error && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Calculator className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Enter building parameters and click "Calculate Loads" to get results</p>
            </div>
          )}
        </div>
      </div>

      {/* Rebate Lookup Section */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
          Rebate Calculator
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Enter your zip code and equipment SKU to calculate total rebates from federal, state, and utility programs.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Zip Code
            </label>
            <input
              type="text"
              value={rebateZipCode}
              onChange={(e) => setRebateZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
              className={fullInputClasses}
              placeholder="12345"
              maxLength={5}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Equipment SKU
            </label>
            <input
              type="text"
              value={rebateSku}
              onChange={(e) => setRebateSku(e.target.value.toUpperCase())}
              className={fullInputClasses}
              placeholder="HP-3T-18SEER"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Examples: HP-3T-18SEER, AC-4T-18SEER, FURNACE-80K-96AFUE
            </p>
          </div>
        </div>

        <button
          onClick={handleRebateLookup}
          disabled={rebateLoading || !rebateZipCode || !rebateSku}
          className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {rebateLoading ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              Calculating Rebates...
            </>
          ) : (
            <>
              <Tag className="w-5 h-5" />
              Calculate Rebates
            </>
          )}
        </button>

        {rebateError && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <AlertCircle className="w-5 h-5" />
              <p className="font-semibold">Error</p>
            </div>
            <p className="text-sm mt-1">{rebateError}</p>
          </div>
        )}

        {rebateResults && (
          <div className="mt-6 space-y-4">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6 border border-green-200 dark:border-green-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Net Price After Rebates
                </h3>
                <div className="text-right">
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                    ${rebateResults.net_price.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Save {rebateResults.savings_percentage}%
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Base Price</p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    ${rebateResults.base_price.toLocaleString()}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Rebates</p>
                  <p className="text-xl font-semibold text-green-600 dark:text-green-400">
                    -${rebateResults.total_rebates.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Rebate Breakdown</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Federal Rebate (IRA):</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      ${rebateResults.federal_rebate.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">State Rebate:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      ${rebateResults.state_rebate.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Utility Rebate:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      ${rebateResults.utility_rebate.toLocaleString()}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                    <span className="font-semibold text-gray-900 dark:text-white">Total Savings:</span>
                    <span className="font-bold text-green-600 dark:text-green-400 text-lg">
                      ${rebateResults.total_rebates.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                <p>
                  <strong>Equipment:</strong> {rebateResults.equipment_sku} |{" "}
                  <strong>Location:</strong> {rebateResults.zip_code}
                </p>
                <p className="mt-1">
                  Rebates are estimates based on current federal (IRA), state, and utility programs.
                  Actual rebates may vary.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          About EnergyPlus Load Calculations
        </h3>
        <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
          <p>
            <strong>EnergyPlus</strong> is the U.S. Department of Energy's building energy
            simulation engine. It provides ACCA Manual J-compliant load calculations using
            sub-hourly simulations.
          </p>
          <p>
            This calculator can show you exactly how much energy your home will use at specific
            temperatures (e.g., -5°F) before you spend a dime on equipment.
          </p>
          <p>
            <strong>Note:</strong> If EnergyPlus is not available, the calculator uses simplified
            Manual J-style calculations based on DOE guidelines.
          </p>
        </div>
      </div>
    </div>
  );
}

