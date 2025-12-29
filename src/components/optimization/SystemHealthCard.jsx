// src/components/optimization/SystemHealthCard.jsx
// System health overview with recommendations

import React, { useMemo, useState } from "react";
import { 
  Heart, 
  AlertTriangle, 
  CheckCircle, 
  ChevronDown, 
  ChevronUp,
  Thermometer,
  Zap,
  Wrench,
  Gauge,
  Shield,
  TrendingUp
} from "lucide-react";
import { analyzeSystemHealth } from "../../lib/optimization/OptimizationEngine";

export default function SystemHealthCard({
  heatLossFactor = 200,
  squareFeet = 1000,
  auxHeatHours = 0,
  totalHeatHours = 100,
  cyclesPerHour = 3,
  lastMaintenanceDate = null,
  filterLastChanged = null,
  systemAge = 0,
  hspf2 = 9,
  seer2 = 16,
  compact = false,
}) {
  const [expanded, setExpanded] = useState(false);

  const health = useMemo(() => {
    return analyzeSystemHealth({
      heatLossFactor,
      squareFeet,
      auxHeatHours,
      totalHeatHours,
      cyclesPerHour,
      lastMaintenanceDate,
      filterLastChanged,
      systemAge,
      hspf2,
      seer2,
    });
  }, [heatLossFactor, squareFeet, auxHeatHours, totalHeatHours, cyclesPerHour, lastMaintenanceDate, filterLastChanged, systemAge, hspf2, seer2]);

  const scoreColor = health.score >= 80 ? "text-green-400" : health.score >= 60 ? "text-yellow-400" : "text-red-400";
  const scoreGradient = health.score >= 80 
    ? "from-green-500 to-emerald-500" 
    : health.score >= 60 
    ? "from-yellow-500 to-amber-500" 
    : "from-red-500 to-orange-500";

  const priorityIcons = {
    high: <AlertTriangle className="text-red-400" size={16} />,
    medium: <AlertTriangle className="text-yellow-400" size={16} />,
    low: <Gauge className="text-blue-400" size={16} />,
  };

  const categoryIcons = {
    Insulation: <Thermometer size={16} />,
    "Aux Heat": <Zap size={16} />,
    Cycling: <Gauge size={16} />,
    Maintenance: <Wrench size={16} />,
    Equipment: <Shield size={16} />,
  };

  return (
    <div className="rounded-2xl overflow-hidden bg-slate-900/50 border border-slate-700/50 backdrop-blur-sm">
      {/* Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Health Score Circle */}
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                  className="text-slate-700"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="url(#scoreGradient)"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray={`${(health.score / 100) * 176} 176`}
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" className={`${health.score >= 80 ? "stop-green-500" : health.score >= 60 ? "stop-yellow-500" : "stop-red-500"}`} stopColor={health.score >= 80 ? "#22c55e" : health.score >= 60 ? "#eab308" : "#ef4444"} />
                    <stop offset="100%" className={`${health.score >= 80 ? "stop-emerald-500" : health.score >= 60 ? "stop-amber-500" : "stop-orange-500"}`} stopColor={health.score >= 80 ? "#10b981" : health.score >= 60 ? "#f59e0b" : "#f97316"} />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-xl font-bold ${scoreColor}`}>{health.score}</span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Heart className={scoreColor} size={18} />
                <h3 className="font-bold text-white">System Health</h3>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">
                {health.recommendations.length === 0 
                  ? "All systems running well" 
                  : `${health.recommendations.length} recommendation${health.recommendations.length > 1 ? "s" : ""}`
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick stats */}
            {!compact && health.positives.length > 0 && (
              <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg bg-green-900/30 text-green-400 text-xs">
                <CheckCircle size={12} />
                {health.positives.length} positive
              </div>
            )}
            
            {expanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-slate-700/50">
          {/* Recommendations */}
          {health.recommendations.length > 0 && (
            <div className="p-4 space-y-3">
              <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Recommendations</h4>
              {health.recommendations.map((rec, idx) => (
                <div 
                  key={idx}
                  className={`p-3 rounded-xl border ${
                    rec.priority === "high" 
                      ? "bg-red-900/20 border-red-700/50" 
                      : rec.priority === "medium"
                      ? "bg-yellow-900/20 border-yellow-700/50"
                      : "bg-blue-900/20 border-blue-700/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {categoryIcons[rec.category] || priorityIcons[rec.priority]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h5 className="font-medium text-white">{rec.title}</h5>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          rec.priority === "high" 
                            ? "bg-red-500/20 text-red-400" 
                            : rec.priority === "medium"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-blue-500/20 text-blue-400"
                        }`}>
                          {rec.priority}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-slate-400 space-y-0.5">
                        <p><span className="text-slate-500">Current:</span> {rec.current}</p>
                        <p><span className="text-slate-500">Expected:</span> {rec.expected}</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-300">{rec.action}</p>
                      {rec.savings && (
                        <p className="mt-1 text-sm text-green-400 flex items-center gap-1">
                          <TrendingUp size={12} /> {rec.savings}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Positives */}
          {health.positives.length > 0 && (
            <div className="p-4 border-t border-slate-700/50">
              <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">What's Working Well</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {health.positives.map((pos, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-lg bg-green-900/20 border border-green-700/30"
                  >
                    <CheckCircle className="text-green-400 flex-shrink-0" size={16} />
                    <div>
                      <p className="text-sm font-medium text-green-300">{pos.title}</p>
                      <p className="text-xs text-green-400/70">{pos.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metrics */}
          <div className="p-4 border-t border-slate-700/50 bg-slate-800/30">
            <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">System Metrics</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(health.metrics).map(([key, value]) => (
                <div key={key} className="text-center p-2 rounded-lg bg-slate-900/50">
                  <div className="text-xs text-slate-500 capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</div>
                  <div className="font-bold text-white">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


