// src/components/optimization/WeatherAlerts.jsx
// Proactive weather alerts for cost-impacting weather events

import React, { useMemo } from "react";
import { AlertTriangle, Snowflake, Flame, Wind, TrendingUp, TrendingDown, Info } from "lucide-react";
import { analyzeWeatherAnomalies } from "../../lib/optimization/OptimizationEngine";

export default function WeatherAlerts({
  forecast = [],
  mode = "heating",
  electricRate = 0.12,
  heatLossFactor = 200,
  onDismiss,
  compact = false,
}) {
  const analysis = useMemo(() => {
    if (!forecast || !Array.isArray(forecast) || forecast.length === 0) {
      return { hasAnomaly: false, anomalies: [], warnings: [] };
    }
    return analyzeWeatherAnomalies(forecast, {
      mode,
      electricRate,
      heatLossFactor,
    });
  }, [forecast, mode, electricRate, heatLossFactor]);

  if (!analysis || (!analysis.hasAnomaly && (!analysis.warnings || analysis.warnings.length === 0))) {
    return null;
  }

  const severityStyles = {
    extreme: {
      bg: "from-red-900/30 to-red-800/20",
      border: "border-red-500/50",
      icon: "text-red-400",
      shadow: "shadow-red-900/20",
    },
    high: {
      bg: "from-orange-900/30 to-orange-800/20",
      border: "border-orange-500/50",
      icon: "text-orange-400",
      shadow: "shadow-orange-900/20",
    },
    medium: {
      bg: "from-yellow-900/30 to-yellow-800/20",
      border: "border-yellow-500/50",
      icon: "text-yellow-400",
      shadow: "shadow-yellow-900/20",
    },
  };

  const getIcon = (type) => {
    switch (type) {
      case "cold_snap":
        return <Snowflake className="text-blue-400" size={24} />;
      case "heat_wave":
        return <Flame className="text-orange-400" size={24} />;
      case "temperature_swing":
        return <Wind className="text-cyan-400" size={20} />;
      default:
        return <AlertTriangle className="text-yellow-400" size={24} />;
    }
  };

  return (
    <div className={`space-y-3 ${compact ? "" : "mb-4"}`}>
      {/* Critical Anomalies */}
      {analysis.anomalies.map((anomaly, idx) => {
        const style = severityStyles[anomaly.severity] || severityStyles.medium;
        
        return (
          <div
            key={`anomaly-${idx}`}
            className={`relative overflow-hidden rounded-2xl border ${style.border} ${style.shadow} shadow-lg transition-all duration-300 hover:scale-[1.01]`}
          >
            {/* Animated gradient background */}
            <div className={`absolute inset-0 bg-gradient-to-r ${style.bg} opacity-80`} />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
            
            <div className="relative p-4">
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-slate-900/50 flex items-center justify-center ${style.icon}`}>
                  {getIcon(anomaly.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-lg text-white">{anomaly.title}</h4>
                    {anomaly.severity === "extreme" && (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-bold animate-pulse">
                        EXTREME
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-slate-300 mb-2">{anomaly.description}</p>
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="flex items-center gap-1.5 text-green-400 font-medium">
                      <TrendingUp size={14} />
                      {anomaly.impact}
                    </span>
                    
                    {anomaly.startDate && (
                      <span className="text-slate-500">
                        Starts: {new Date(anomaly.startDate).toLocaleDateString()} • {anomaly.duration}
                      </span>
                    )}
                  </div>
                  
                  {anomaly.advice && (
                    <p className="mt-2 text-sm text-amber-300/80 italic">
                      💡 {anomaly.advice}
                    </p>
                  )}
                </div>

                {onDismiss && (
                  <button
                    onClick={() => onDismiss(anomaly)}
                    className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <span className="text-slate-500 hover:text-slate-300">✕</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Informational Warnings */}
      {analysis.warnings && analysis.warnings.map((warning, idx) => (
        <div
          key={`warning-${idx}`}
          className="relative overflow-hidden rounded-xl p-3 bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm"
        >
          <div className="flex items-start gap-3">
            <Info className="text-blue-400 flex-shrink-0 mt-0.5" size={18} />
            <div>
              <p className="font-medium text-slate-200">{warning.title}</p>
              <p className="text-sm text-slate-400 mt-0.5">
                {warning.description} {warning.impact}
              </p>
            </div>
          </div>
        </div>
      ))}

      {/* Weather Stats Summary (if not compact) */}
      {!compact && analysis.stats && (
        <div className="grid grid-cols-4 gap-2 p-3 rounded-xl bg-slate-900/50 border border-slate-700/30">
          <div className="text-center">
            <div className="text-xs text-slate-500">Avg</div>
            <div className="font-bold text-slate-200">{analysis.stats.avgTemp}°F</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500">Low</div>
            <div className="font-bold text-blue-400">{analysis.stats.minTemp}°F</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500">High</div>
            <div className="font-bold text-orange-400">{analysis.stats.maxTemp}°F</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500">vs Normal</div>
            <div className={`font-bold ${analysis.stats.deviation > 0 ? "text-green-400" : "text-red-400"}`}>
              {analysis.stats.deviation > 0 ? "+" : ""}{analysis.stats.deviation}°F
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

