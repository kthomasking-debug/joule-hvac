// src/components/optimization/WasteDetector.jsx
// Detect wasteful settings using only HomeKit data (current temp, target temp, mode)

import React, { useMemo } from "react";
import { AlertTriangle, Zap, TrendingUp, Info } from "lucide-react";
import { checkForWaste, getTimeBasedSuggestion } from "../../lib/optimization/HomeKitOptimizer";
import { useJouleBridgeContext } from "../../contexts/JouleBridgeContext";

export default function WasteDetector({
  outdoorTemp = null,
  electricRate = 0.12,
  heatLossFactor = 200,
  compact = false,
}) {
  const jouleBridge = useJouleBridgeContext();

  const wasteCheck = useMemo(() => {
    if (!jouleBridge.connected || !jouleBridge.targetTemperature) {
      return { hasWaste: false };
    }

    return checkForWaste(
      {
        targetTemperature: jouleBridge.targetTemperature,
        mode: jouleBridge.mode || "heat",
        temperature: jouleBridge.temperature,
      },
      {
        outdoorTemp,
        heatLossFactor,
        electricRate,
      }
    );
  }, [jouleBridge.connected, jouleBridge.targetTemperature, jouleBridge.mode, jouleBridge.temperature, outdoorTemp, heatLossFactor, electricRate]);

  const timeSuggestion = useMemo(() => {
    if (!jouleBridge.connected || !jouleBridge.targetTemperature) {
      return { hasSuggestion: false };
    }

    return getTimeBasedSuggestion(
      jouleBridge.targetTemperature,
      jouleBridge.mode || "heat",
      { userComfortLevel: "balanced" }
    );
  }, [jouleBridge.connected, jouleBridge.targetTemperature, jouleBridge.mode]);

  if (!jouleBridge.connected) {
    return null; // Don't show if not connected
  }

  if (!wasteCheck.hasWaste && !timeSuggestion.hasSuggestion) {
    return null; // No issues detected
  }

  return (
    <div className={`rounded-2xl overflow-hidden bg-slate-900/50 border border-slate-700/50 backdrop-blur-sm ${compact ? "" : "mb-4"}`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Zap className="text-amber-400" size={20} />
          </div>
          <div>
            <h3 className="font-bold text-white">Efficiency Check</h3>
            <p className="text-sm text-slate-400">Based on current thermostat settings</p>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {wasteCheck.warnings && wasteCheck.warnings.length > 0 && (
        <div className="p-4 space-y-3">
          {wasteCheck.warnings.map((warning, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl border ${
                warning.severity === "high"
                  ? "bg-red-900/20 border-red-700/50"
                  : "bg-yellow-900/20 border-yellow-700/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle 
                  className={`flex-shrink-0 mt-0.5 ${
                    warning.severity === "high" ? "text-red-400" : "text-yellow-400"
                  }`} 
                  size={18} 
                />
                <div className="flex-1">
                  <p className="font-medium text-white mb-1">{warning.message}</p>
                  <p className="text-sm text-slate-300 mb-2">{warning.recommendation}</p>
                  {warning.estimatedSavings && (
                    <p className="text-sm font-medium text-green-400">
                      💰 {warning.estimatedSavings}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Time-based Suggestions */}
      {timeSuggestion.hasSuggestion && timeSuggestion.suggestions && (
        <div className="p-4 border-t border-slate-700/50">
          <div className="flex items-center gap-2 mb-3">
            <Info className="text-blue-400" size={16} />
            <h4 className="text-sm font-semibold text-slate-400">Time-Based Suggestion</h4>
          </div>
          {timeSuggestion.suggestions.map((suggestion, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-blue-900/20 border border-blue-700/30"
            >
              <p className="text-sm text-blue-300 mb-1">{suggestion.reason}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">
                  {suggestion.current}°F → {suggestion.suggested}°F
                </span>
                <span className="text-sm font-medium text-green-400">
                  {suggestion.savings}
                </span>
              </div>
            </div>
          ))}
          {timeSuggestion.note && (
            <p className="text-xs text-slate-500 mt-2 italic">{timeSuggestion.note}</p>
          )}
        </div>
      )}

      {/* HomeKit Limitation Note */}
      <div className="p-4 border-t border-slate-700/50 bg-slate-800/30">
        <p className="text-xs text-slate-500">
          ⓘ Analysis based on current settings only. HomeKit doesn't provide schedule data, so we can't see your Ecobee's programmed schedule.
        </p>
      </div>
    </div>
  );
}


