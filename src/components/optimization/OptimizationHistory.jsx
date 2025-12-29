// src/components/optimization/OptimizationHistory.jsx
// Display optimization history and statistics

import React, { useMemo } from "react";
import { 
  History, 
  TrendingUp, 
  CheckCircle, 
  Clock,
  DollarSign,
  Calendar
} from "lucide-react";
import { getOptimizationHistory, getOptimizationStats } from "../../lib/optimization/OptimizationEngine";

export default function OptimizationHistory({ limit = 10, compact = false }) {
  const history = useMemo(() => getOptimizationHistory(limit), [limit]);
  const stats = useMemo(() => getOptimizationStats(), []);

  if (history.length === 0) {
    return (
      <div className="rounded-2xl p-4 bg-slate-900/50 border border-slate-700/50 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <History className="text-indigo-400" size={20} />
          </div>
          <div>
            <h3 className="font-bold text-white">Optimization History</h3>
            <p className="text-sm text-slate-400">Track your optimization journey</p>
          </div>
        </div>

        <div className="text-center py-6">
          <Clock className="mx-auto text-slate-600 mb-3" size={48} />
          <p className="text-slate-400">
            No optimizations yet. Use the Smart Optimizer to get started!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden bg-slate-900/50 border border-slate-700/50 backdrop-blur-sm">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <History className="text-indigo-400" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white">Optimization History</h3>
              <p className="text-sm text-slate-400">
                {stats.appliedCount} of {stats.totalAttempts} applied
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      {!compact && (
        <div className="p-4 border-b border-slate-700/50 bg-slate-800/30">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{stats.acceptanceRate}%</div>
              <div className="text-xs text-slate-500">Acceptance Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">${stats.totalProjectedSavings}</div>
              <div className="text-xs text-slate-500">Total Projected</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">${stats.averageSavings}</div>
              <div className="text-xs text-slate-500">Avg per Optimization</div>
            </div>
          </div>
        </div>
      )}

      {/* History List */}
      <div className="p-4">
        <div className="space-y-3">
          {history.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-xl border ${
                item.applied
                  ? "bg-green-900/20 border-green-700/30"
                  : "bg-slate-800/30 border-slate-700/30"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {item.applied ? (
                      <CheckCircle className="text-green-400" size={16} />
                    ) : (
                      <Clock className="text-slate-500" size={16} />
                    )}
                    <span className="text-sm font-medium text-white">
                      {item.before.dayTemp}°F / {item.before.nightTemp}°F → {item.after.dayTemp}°F / {item.after.nightTemp}°F
                    </span>
                  </div>
                  
                  {item.reasoning && (
                    <p className="text-xs text-slate-400 mb-1">
                      {item.reasoning.primary}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <span className="flex items-center gap-1 text-green-400">
                      <DollarSign size={12} />
                      ${item.projectedSavings.toFixed(2)}/mo projected
                    </span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <Calendar size={12} />
                      {new Date(item.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                {item.applied && (
                  <div className="ml-2 px-2 py-1 rounded bg-green-500/20 text-green-400 text-xs font-medium">
                    Applied
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


