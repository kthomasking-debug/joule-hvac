// src/components/optimization/TOURateOptimizer.jsx
// Time-of-Use rate optimization strategies

import React, { useMemo, useState } from "react";
import { 
  Clock, 
  Zap, 
  DollarSign, 
  Sun, 
  Moon,
  ArrowRight,
  Settings,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { analyzeTOUOptimization } from "../../lib/optimization/OptimizationEngine";

export default function TOURateOptimizer({
  touRates = null,
  currentSchedule = { dayTemp: 70, nightTemp: 68 },
  mode = "heating",
  heatLossFactor = 200,
  weatherForecast = [],
  onConfigureTOU,
  compact = false,
}) {
  const [selectedStrategy, setSelectedStrategy] = useState(null);

  const analysis = useMemo(() => {
    return analyzeTOUOptimization({
      touRates,
      currentSchedule,
      mode,
      heatLossFactor,
      weatherForecast,
    });
  }, [touRates, currentSchedule, mode, heatLossFactor, weatherForecast]);

  // No TOU rates configured
  if (!analysis.hasTOU) {
    return (
      <div className="rounded-2xl p-4 bg-slate-900/50 border border-slate-700/50 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Clock className="text-purple-400" size={20} />
          </div>
          <div>
            <h3 className="font-bold text-white">Time-of-Use Optimization</h3>
            <p className="text-sm text-slate-400">Save more with TOU rate strategies</p>
          </div>
        </div>

        <div className="text-center py-6">
          <Zap className="mx-auto text-slate-600 mb-3" size={48} />
          <p className="text-slate-400 mb-4">{analysis.message}</p>
          {onConfigureTOU && (
            <button
              onClick={onConfigureTOU}
              className="px-4 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 transition-colors flex items-center gap-2 mx-auto"
            >
              <Settings size={16} /> Configure TOU Rates
            </button>
          )}
        </div>

        {/* TOU Explainer */}
        <div className="mt-4 p-3 rounded-xl bg-slate-800/50 text-sm text-slate-400">
          <p className="font-medium text-slate-300 mb-2">What are TOU rates?</p>
          <p>
            Time-of-Use rates charge different prices based on when you use electricity. 
            Peak hours (usually 2-7pm) cost more, while off-peak hours are cheaper. 
            By shifting energy use, you can save significantly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden bg-slate-900/50 border border-slate-700/50 backdrop-blur-sm">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-purple-600/20 via-violet-600/20 to-indigo-600/20 border-b border-purple-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Clock className="text-white" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white">TOU Rate Optimizer</h3>
              <p className="text-sm text-purple-300">
                Save up to {analysis.summary.potentialMonthlySavings}/month
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Rate Summary */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-red-900/20 border border-red-700/30">
            <div className="text-xs text-red-400/70 mb-1">Peak Rate</div>
            <div className="font-bold text-red-400">{analysis.summary.peakRate}</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-green-900/20 border border-green-700/30">
            <div className="text-xs text-green-400/70 mb-1">Off-Peak</div>
            <div className="font-bold text-green-400">{analysis.summary.offPeakRate}</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-slate-800/50 border border-slate-700/30">
            <div className="text-xs text-slate-500 mb-1">Peak Hours</div>
            <div className="font-bold text-white">{analysis.summary.peakHours}</div>
          </div>
        </div>
      </div>

      {/* Strategies */}
      <div className="p-4">
        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Optimization Strategies
        </h4>
        
        <div className="space-y-3">
          {analysis.strategies.map((strategy, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                selectedStrategy === idx
                  ? "bg-purple-900/30 border-purple-500/50"
                  : "bg-slate-800/30 border-slate-700/30 hover:border-slate-600/50"
              }`}
              onClick={() => setSelectedStrategy(selectedStrategy === idx ? null : idx)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {mode === "heating" ? (
                    <Sun className="text-orange-400" size={16} />
                  ) : (
                    <Moon className="text-blue-400" size={16} />
                  )}
                  <span className="font-medium text-white">{strategy.name}</span>
                </div>
                <span className="text-sm font-bold text-green-400">
                  {strategy.savingsEstimate}
                </span>
              </div>
              
              <p className="text-sm text-slate-400 mb-2">{strategy.description}</p>
              
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1 text-slate-500">
                  <Clock size={12} /> {strategy.timing}
                </span>
                <span className={`px-1.5 py-0.5 rounded ${
                  strategy.difficulty === "Easy" 
                    ? "bg-green-500/20 text-green-400"
                    : "bg-yellow-500/20 text-yellow-400"
                }`}>
                  {strategy.difficulty}
                </span>
              </div>

              {selectedStrategy === idx && strategy.comfortImpact && (
                <div className="mt-3 p-2 rounded-lg bg-yellow-900/20 border border-yellow-700/30 text-xs">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="text-yellow-400 flex-shrink-0 mt-0.5" size={12} />
                    <span className="text-yellow-300">Comfort note: {strategy.comfortImpact}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Total Savings */}
        <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-700/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="text-green-400" size={18} />
              <span className="font-medium text-green-300">Potential Monthly Savings</span>
            </div>
            <span className="text-xl font-bold text-green-400">
              {analysis.summary.potentialMonthlySavings}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}


