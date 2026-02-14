// src/components/optimization/OneClickOptimizer.jsx
// One-click schedule optimization with savings preview

import React, { useState, useMemo } from "react";
import { Zap, Check, TrendingDown, ThermometerSun, Moon, Sun, Sparkles, Undo2, Info, AlertCircle } from "lucide-react";
import { calculateOptimalSchedule, trackOptimizationAttempt, markOptimizationApplied, recordSavingsEvent } from "../../lib/optimization/OptimizationEngine";
import { getImmediateOptimization, checkForWaste, getTimeBasedSuggestion } from "../../lib/optimization/HomeKitOptimizer";
import { setTemperature, getPrimaryDeviceId } from "../../lib/jouleBridgeApi";
import { useJouleBridgeContext } from "../../contexts/JouleBridgeContext";
import { Toast } from "../Toast";
import { loadThermostatSettings, saveThermostatSettings } from "../../lib/thermostatSettings";

export default function OneClickOptimizer({
  currentDayTemp = 70,
  currentNightTemp = 68,
  currentCoolDayTemp = null, // Cooling setpoints (optional)
  currentCoolNightTemp = null,
  mode = "heating",
  weatherForecast = [],
  electricRate = 0.12,
  heatLossFactor = 200,
  hspf2 = 9,
  onApplySchedule,
  onScheduleOptimized,
  compact = false,
}) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimized, setOptimized] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [previousSettings, setPreviousSettings] = useState(null);
  const [optimizationId, setOptimizationId] = useState(null);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);
  
  const jouleBridge = useJouleBridgeContext();

  // Determine if we have full schedule data or just HomeKit data
  // HomeKit only provides: current temp, target temp, mode (no schedules)
  // If day and night temps are different, we have schedule data
  const hasScheduleData = currentDayTemp !== currentNightTemp && 
    Math.abs(currentDayTemp - currentNightTemp) > 0.5;
  
  // Use HomeKit-optimized version if we only have current target temp
  const homeKitOptimization = useMemo(() => {
    if (jouleBridge.connected && jouleBridge.targetTemperature) {
      return getImmediateOptimization(
        {
          temperature: jouleBridge.temperature,
          targetTemperature: jouleBridge.targetTemperature,
          mode: jouleBridge.mode || mode,
        },
        {
          outdoorTemp: weatherForecast?.[0]?.temp || weatherForecast?.[0]?.temperature || null,
          electricRate,
          heatLossFactor,
          hspf2,
          userComfortLevel: "balanced",
        }
      );
    }
    return null;
  }, [jouleBridge.connected, jouleBridge.targetTemperature, jouleBridge.temperature, jouleBridge.mode, mode, weatherForecast, electricRate, heatLossFactor, hspf2]);

  // Check if both heating and cooling setpoints are provided (auto mode)
  const hasBothModes = currentCoolDayTemp !== null && currentCoolNightTemp !== null;
  
  // Use full schedule optimization if we have schedule data
  const scheduleOptimization = useMemo(() => {
    if (hasScheduleData) {
      return calculateOptimalSchedule({
        currentDayTemp,
        currentNightTemp,
        mode,
        weatherForecast,
        electricRate,
        heatLossFactor,
        hspf2,
        userComfortLevel: "balanced",
      });
    }
    return null;
  }, [hasScheduleData, currentDayTemp, currentNightTemp, mode, weatherForecast, electricRate, heatLossFactor, hspf2]);

  // If both modes are configured, also check cooling optimization
  const coolingOptimization = useMemo(() => {
    if (hasBothModes && currentCoolDayTemp !== null && currentCoolNightTemp !== null) {
      return calculateOptimalSchedule({
        currentDayTemp: currentCoolDayTemp,
        currentNightTemp: currentCoolNightTemp,
        mode: "cooling",
        weatherForecast,
        electricRate,
        heatLossFactor,
        hspf2,
        userComfortLevel: "balanced",
      });
    }
    return null;
  }, [hasBothModes, currentCoolDayTemp, currentCoolNightTemp, weatherForecast, electricRate, heatLossFactor, hspf2]);

  // Choose which optimization to use
  const optimization = useMemo(() => {
    // Prefer HomeKit optimization if bridge is connected (more accurate current state)
    if (homeKitOptimization?.available && homeKitOptimization.recommendation) {
      return {
        // Convert HomeKit format to schedule format for compatibility
        currentSchedule: {
          dayTemp: jouleBridge.targetTemperature || currentDayTemp,
          nightTemp: jouleBridge.targetTemperature || currentNightTemp,
          avgTemp: jouleBridge.targetTemperature || currentDayTemp,
        },
        optimalSchedule: {
          dayTemp: parseFloat(homeKitOptimization.recommendation.optimal),
          nightTemp: parseFloat(homeKitOptimization.recommendation.optimal),
          avgTemp: parseFloat(homeKitOptimization.recommendation.optimal),
          dayHours: "All day",
          nightHours: "All day",
        },
        savings: homeKitOptimization.recommendation.savings,
        reasoning: homeKitOptimization.recommendation.reasoning,
        hasSavingsOpportunity: true,
        canOptimize: true,
        limitation: homeKitOptimization.limitation,
        isHomeKitOnly: true,
      };
    }
    
    // If both modes are configured, combine heating and cooling optimizations
    if (hasBothModes && scheduleOptimization && coolingOptimization) {
      // Combine savings from both modes
      const combinedSavings = {
        tempDiff: Math.max(
          parseFloat(scheduleOptimization.savings.tempDiff || 0),
          parseFloat(coolingOptimization.savings.tempDiff || 0)
        ).toFixed(1),
        percent: (
          parseFloat(scheduleOptimization.savings.percent || 0) +
          parseFloat(coolingOptimization.savings.percent || 0)
        ).toFixed(1),
        monthlyDollars: (
          parseFloat(scheduleOptimization.savings.monthlyDollars || 0) +
          parseFloat(coolingOptimization.savings.monthlyDollars || 0)
        ).toFixed(2),
        annualDollars: (
          parseFloat(scheduleOptimization.savings.annualDollars || 0) +
          parseFloat(coolingOptimization.savings.annualDollars || 0)
        ).toFixed(2),
      };
      
      // Show opportunity if EITHER mode has savings or can be optimized
      // This ensures we show optimization even if one mode is optimal but the other isn't
      const hasOpportunity = scheduleOptimization.hasSavingsOpportunity || 
                             coolingOptimization.hasSavingsOpportunity ||
                             scheduleOptimization.weatherAdjustment ||
                             coolingOptimization.weatherAdjustment ||
                             scheduleOptimization.canOptimize ||
                             coolingOptimization.canOptimize;
      
      const canOptimize = scheduleOptimization.canOptimize || coolingOptimization.canOptimize;
      
      return {
        ...scheduleOptimization,
        coolingOptimization, // Include cooling optimization for reference
        savings: combinedSavings,
        hasSavingsOpportunity: hasOpportunity,
        canOptimize: canOptimize,
        isDualMode: true,
      };
    }
    
    // Fall back to schedule optimization
    if (scheduleOptimization) {
      return scheduleOptimization;
    }
    
    // Default: use current target as both day and night
    return calculateOptimalSchedule({
      currentDayTemp: currentDayTemp || 70,
      currentNightTemp: currentNightTemp || currentDayTemp || 70,
      mode,
      weatherForecast,
      electricRate,
      heatLossFactor,
      hspf2,
      userComfortLevel: "balanced",
    });
  }, [homeKitOptimization, scheduleOptimization, coolingOptimization, hasBothModes, jouleBridge.targetTemperature, currentDayTemp, currentNightTemp, mode, weatherForecast, electricRate, heatLossFactor, hspf2]);

  const handleOptimize = async () => {
    setIsOptimizing(true);
    setError(null);
    
    // Save current settings for undo
    setPreviousSettings({
      dayTemp: currentDayTemp,
      nightTemp: currentNightTemp,
    });
    
    try {
      // Track the optimization attempt
      const attempt = trackOptimizationAttempt(optimization);
      setOptimizationId(attempt.id);
      
      // Get optimal values
      const optimalDay = optimization.optimalSchedule.dayTemp;
      const optimalNight = optimization.optimalSchedule.nightTemp;
      
      // Update local settings
      // Apply optimization - use single temp if HomeKit-only, otherwise use schedule
      if (optimization.isHomeKitOnly) {
        // HomeKit can only set one temperature at a time
        if (onApplySchedule) {
          onApplySchedule({
            dayTemp: optimalDay,
            nightTemp: optimalDay, // Same for HomeKit
          });
        }
      } else if (onApplySchedule) {
        // Always call onApplySchedule even if values are the same, to ensure UI updates
        // Call the callback to update the parent component's state
        onApplySchedule({
          dayTemp: optimalDay,
          nightTemp: optimalNight,
        });
        
        // Also update thermostat settings if this is a dual-mode optimization
        if (optimization.isDualMode && optimization.coolingOptimization) {
          try {
            const thermostatSettings = loadThermostatSettings();
            if (thermostatSettings) {
              // Update heating setpoints
              if (!thermostatSettings.comfortSettings) {
                thermostatSettings.comfortSettings = {};
              }
              if (!thermostatSettings.comfortSettings.home) {
                thermostatSettings.comfortSettings.home = {};
              }
              if (!thermostatSettings.comfortSettings.sleep) {
                thermostatSettings.comfortSettings.sleep = {};
              }
              
              thermostatSettings.comfortSettings.home.heatSetPoint = optimalDay;
              thermostatSettings.comfortSettings.sleep.heatSetPoint = optimalNight;
              
              // Update cooling setpoints
              thermostatSettings.comfortSettings.home.coolSetPoint = optimization.coolingOptimization.optimalSchedule.dayTemp;
              thermostatSettings.comfortSettings.sleep.coolSetPoint = optimization.coolingOptimization.optimalSchedule.nightTemp;
              
              saveThermostatSettings(thermostatSettings);
              
              // Dispatch event to notify other components
              window.dispatchEvent(new CustomEvent("thermostatSettingsUpdated", {
                detail: { comfortSettings: thermostatSettings.comfortSettings }
              }));
            }
          } catch (e) {
            console.warn("Failed to update thermostat settings:", e);
          }
        }
      }
      
      // Always mark as applied and show feedback, even if values didn't change
      markOptimizationApplied(attempt.id);
      
      // Try to update Ecobee directly if bridge is available
      if (jouleBridge.bridgeAvailable && jouleBridge.connected) {
        try {
          const deviceId = await getPrimaryDeviceId();
          if (deviceId) {
            // Set target temperature
            // HomeKit can only set one temperature at a time (not separate day/night)
            // Use the optimal temperature based on current time if we have schedule data,
            // otherwise use the single optimal temp
            let targetTemp;
            if (optimization.isHomeKitOnly) {
              // HomeKit-only: use single optimal temp
              targetTemp = optimization.optimalSchedule.dayTemp;
            } else {
              // Schedule-based: use time-appropriate temp
              const now = new Date();
              const hour = now.getHours();
              const isDaytime = hour >= 6 && hour < 22;
              targetTemp = isDaytime 
                ? optimization.optimalSchedule.dayTemp 
                : optimization.optimalSchedule.nightTemp;
            }
            
            await setTemperature(deviceId, targetTemp);
            
            // Mark as applied
            markOptimizationApplied(attempt.id);
            
            // Record savings event
            recordSavingsEvent(parseFloat(optimization.savings.monthlyDollars), "one_click_optimizer");
            
            setToast({
              type: "success",
              message: `Optimization applied! Ecobee set to ${targetTemp}°F. Estimated savings: $${optimization.savings.monthlyDollars}/month`,
            });
          }
        } catch (bridgeError) {
          console.warn("Could not update Ecobee directly:", bridgeError);
          // Still mark as applied locally
          markOptimizationApplied(attempt.id);
          setToast({
            type: "info",
            message: `Settings updated locally. Connect to Ecobee to apply automatically.`,
          });
        }
      } else {
        // No bridge - just update local settings
        markOptimizationApplied(attempt.id);
        const dayTemp = optimization.optimalSchedule.dayTemp;
        const nightTemp = optimization.optimalSchedule.nightTemp;
        setToast({
          type: "success",
          message: `Optimization applied! Settings updated to ${dayTemp}°F day / ${nightTemp}°F night.`,
        });
      }
      
      setIsOptimizing(false);
      setOptimized(true);
      
      // Reset toast after 5 seconds
      setTimeout(() => setToast(null), 5000);
      
      // Reset optimized state after 10 seconds
      setTimeout(() => setOptimized(false), 10000);
    } catch (err) {
      console.error("Optimization error:", err);
      setError(err.message || "Failed to apply optimization");
      setIsOptimizing(false);
      setToast({
        type: "error",
        message: err.message || "Failed to apply optimization. Please try again.",
      });
      setTimeout(() => setToast(null), 5000);
    }
  };
  
  const handleUndo = () => {
    if (previousSettings && onApplySchedule) {
      onApplySchedule(previousSettings);
      setOptimized(false);
      setPreviousSettings(null);
      setOptimizationId(null);
      setToast({
        type: "success",
        message: "Optimization reverted to previous settings",
      });
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Show "Already Optimized" only if there's no savings opportunity AND no optimization possible
  // (i.e., both day and night temps are within 0.5°F of optimal)
  // For dual-mode, check both heating and cooling optimizations
  const shouldShowOptimized = !optimization.hasSavingsOpportunity && 
                              !optimization.weatherAdjustment && 
                              !optimization.canOptimize &&
                              (!optimization.coolingOptimization || 
                               (!optimization.coolingOptimization.hasSavingsOpportunity && 
                                !optimization.coolingOptimization.canOptimize));
  
  // Notify parent when schedule is optimized
  React.useEffect(() => {
    if (onScheduleOptimized) {
      onScheduleOptimized(shouldShowOptimized);
    }
  }, [shouldShowOptimized, onScheduleOptimized]);
  
  if (shouldShowOptimized) {
    return (
      <div className={`rounded-2xl p-4 bg-green-900/20 border border-green-700/50 ${compact ? "" : "mb-4"}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <Check className="text-green-400" size={20} />
          </div>
          <div>
            <h3 className="font-bold text-green-400">Already Optimized!</h3>
            <p className="text-sm text-slate-400">Your schedule is efficient for current conditions.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl overflow-hidden ${compact ? "" : "mb-4"}`}>
      {/* Header with gradient - stack on mobile */}
      <div className="bg-gradient-to-r from-violet-600/20 via-purple-600/20 to-fuchsia-600/20 p-4 border-b border-purple-500/30">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30 shrink-0">
              <Sparkles className="text-white" size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-white">Smart Optimizer</h3>
              <p className="text-sm text-purple-300">Savings opportunity detected</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {optimized && previousSettings && (
              <button
                onClick={handleUndo}
                className="px-3 py-2 rounded-xl bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 text-sm transition-colors flex items-center gap-2"
                title="Undo optimization"
              >
                <Undo2 size={14} /> Undo
              </button>
            )}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleOptimize();
              }}
              disabled={isOptimizing || optimized}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 ${
                optimized
                  ? "bg-green-500/20 text-green-400 border border-green-500/50 cursor-not-allowed"
                  : isOptimizing
                  ? "bg-purple-500/30 text-purple-300 animate-pulse cursor-wait"
                  : "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:shadow-lg hover:shadow-purple-500/30 hover:scale-105 cursor-pointer"
              } ${(isOptimizing || optimized) ? "opacity-50" : ""}`}
              type="button"
            >
              {optimized ? (
                <>
                  <Check size={16} /> Applied!
                </>
              ) : isOptimizing ? (
                <>
                  <Zap size={16} className="animate-spin" /> Optimizing...
                </>
              ) : (
                <>
                  <Zap size={16} /> Optimize Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Savings Preview */}
      <div className="bg-slate-900/50 p-4 backdrop-blur-sm border border-purple-500/20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Current vs Optimal */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Sun size={14} /> Day Temperature
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg text-slate-300">{currentDayTemp}°F</span>
              <TrendingDown className="text-green-400" size={16} />
              <span className="text-lg font-bold text-green-400">{optimization.optimalSchedule.dayTemp}°F</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Moon size={14} /> Night Temperature
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg text-slate-300">{currentNightTemp}°F</span>
              <TrendingDown className="text-green-400" size={16} />
              <span className="text-lg font-bold text-green-400">{optimization.optimalSchedule.nightTemp}°F</span>
            </div>
          </div>

          {/* Savings */}
          <div className="space-y-2">
            <div className="text-sm text-slate-400">Estimated Savings</div>
            {parseFloat(optimization.savings.monthlyDollars) > 0 ? (
              <>
                <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                  ${optimization.savings.monthlyDollars}/mo
                </div>
                <div className="text-xs text-slate-500">
                  ${optimization.savings.annualDollars}/year
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-400 ">
                No thermostat savings detected.
                <span className="block mt-0.5 text-slate-500">Biggest savings likely from non-heating usage.</span>
              </div>
            )}
          </div>
        </div>

        {/* Weather Adjustment Alert */}
        {optimization.weatherAdjustment && (
          <div className="mt-4 p-3 rounded-xl bg-amber-900/20 border border-amber-600/30">
            <div className="flex items-start gap-3">
              <ThermometerSun className="text-amber-400 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-medium text-amber-300">
                  {optimization.weatherAdjustment.type === "cold_snap" && "❄️ Cold Weather Alert"}
                  {optimization.weatherAdjustment.type === "heat_wave" && "🔥 Heat Wave Alert"}
                  {optimization.weatherAdjustment.type === "mild_weather" && "🌤️ Mild Weather Opportunity"}
                </p>
                <p className="text-sm text-amber-200/80 mt-1">
                  {optimization.weatherAdjustment.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-900/20 border border-red-700/50">
            <div className="flex items-start gap-2">
              <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* Reasoning Toggle */}
        {optimization.reasoning && (
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="mt-3 py-2 min-h-[44px] text-sm sm:text-base text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 touch-manipulation"
          >
            <Info size={14} />
            {showReasoning ? "Hide why this helps ▲" : "Why this helps ▼"}
          </button>
        )}

        {showReasoning && optimization.reasoning && (
          <div className="mt-3 p-3 rounded-lg bg-blue-900/20 border border-blue-700/30">
            <p className="text-sm font-medium text-blue-300 mb-2">
              {optimization.reasoning.primary}
            </p>
            <ul className="text-xs text-blue-200/80 space-y-1 mb-2">
              {optimization.reasoning.factors.map((factor, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>{factor}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-blue-300/70">
              Comfort impact: {optimization.reasoning.comfortImpact}
            </p>
          </div>
        )}

        {/* Details toggle */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="mt-3 py-2 min-h-[44px] text-sm sm:text-base text-purple-400 hover:text-purple-300 transition-colors touch-manipulation"
        >
          {showDetails ? "Hide calculation details ▲" : "Show calculation details ▼"}
        </button>

        {showDetails && (
          <div className="mt-3 p-3 rounded-lg bg-slate-800/50 text-xs text-slate-400 space-y-1">
            <p>• Current avg: {optimization.currentSchedule.avgTemp.toFixed(1)}°F</p>
            <p>• Optimal avg: {optimization.optimalSchedule.avgTemp.toFixed(1)}°F</p>
            <p>• Temperature difference: {optimization.savings.tempDiff}°F</p>
            <p>• Estimated savings: {optimization.savings.percent}%</p>
            <p className="text-slate-500 mt-2">
              Based on ASHRAE 55 comfort standards and your home's heat loss characteristics.
            </p>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

