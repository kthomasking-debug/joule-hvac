// src/components/optimization/QuickActionsBar.jsx
// Quick action buttons for common tasks

import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Zap, 
  Calendar, 
  MapPin, 
  TrendingDown, 
  AlertTriangle,
  DollarSign,
  Thermometer,
  ArrowRight
} from "lucide-react";
import { getQuickActions } from "../../lib/optimization/OptimizationEngine";

export default function QuickActionsBar({
  hasWeatherAlert = false,
  weatherAlertType = null,
  currentTemp = 70,
  optimalTemp = 69,
  auxHeatRunning = false,
  costSoFar = 0,
  budgetLimit = null,
  onOptimize,
  compact = false,
}) {
  const navigate = useNavigate();

  const actions = useMemo(() => {
    return getQuickActions({
      hasWeatherAlert,
      weatherAlertType,
      currentTemp,
      optimalTemp,
      auxHeatRunning,
      costSoFar,
      budgetLimit,
    });
  }, [hasWeatherAlert, weatherAlertType, currentTemp, optimalTemp, auxHeatRunning, costSoFar, budgetLimit]);

  const handleAction = (action) => {
    if (action.action === "navigate") {
      navigate(action.target);
    } else if (action.action === "optimize" && onOptimize) {
      onOptimize(action.suggestedTemp);
    }
  };

  const iconMap = {
    "❄️": <Thermometer className="text-blue-400" size={18} />,
    "🔥": <Thermometer className="text-orange-400" size={18} />,
    "💡": <Zap className="text-yellow-400" size={18} />,
    "⚠️": <AlertTriangle className="text-red-400" size={18} />,
    "💰": <DollarSign className="text-green-400" size={18} />,
    "📊": <TrendingDown className="text-purple-400" size={18} />,
    "🏙️": <MapPin className="text-cyan-400" size={18} />,
  };

  if (compact) {
    // Horizontal scrollable bar for compact mode
    return (
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {actions.slice(0, 4).map((action) => (
          <button
            key={action.id}
            onClick={() => handleAction(action)}
            className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
              action.priority === 1
                ? "bg-gradient-to-r from-amber-600/30 to-orange-600/30 border border-amber-500/50 hover:border-amber-400"
                : "bg-slate-800/50 border border-slate-700/50 hover:border-slate-600"
            }`}
          >
            {iconMap[action.icon] || <Zap size={16} />}
            <span className="text-sm font-medium text-white whitespace-nowrap">{action.label}</span>
          </button>
        ))}
      </div>
    );
  }

  // Full grid for non-compact mode
  return (
    <div className="rounded-2xl overflow-hidden bg-slate-900/50 border border-slate-700/50 backdrop-blur-sm">
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <Zap className="text-yellow-400" size={18} />
          <h3 className="font-bold text-white">Quick Actions</h3>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => handleAction(action)}
            className={`group flex items-center justify-between p-3 rounded-xl transition-all ${
              action.priority === 1
                ? "bg-gradient-to-r from-amber-900/30 to-orange-900/20 border border-amber-500/50 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-900/20"
                : action.priority === 2
                ? "bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border border-blue-500/30 hover:border-blue-400"
                : "bg-slate-800/30 border border-slate-700/30 hover:border-slate-600"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                action.priority === 1
                  ? "bg-amber-500/20"
                  : action.priority === 2
                  ? "bg-blue-500/20"
                  : "bg-slate-700/50"
              }`}>
                {iconMap[action.icon] || <Zap size={18} />}
              </div>
              <div className="text-left">
                <p className="font-medium text-white">{action.label}</p>
                <p className="text-xs text-slate-400">{action.description}</p>
              </div>
            </div>
            <ArrowRight 
              className="text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" 
              size={18} 
            />
          </button>
        ))}
      </div>
    </div>
  );
}


