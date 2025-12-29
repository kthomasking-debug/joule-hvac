// src/components/optimization/HistoricalComparison.jsx
// Compare current period to historical data

import React, { useMemo } from "react";
import { 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  BarChart2,
  ChevronRight
} from "lucide-react";
import { getComparison, getRecentTrend } from "../../lib/history/historyEngine";

export default function HistoricalComparison({
  currentYear = new Date().getFullYear(),
  currentMonth = new Date().getMonth() + 1,
  compact = false,
}) {
  const comparison = useMemo(() => {
    return getComparison(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  const trend = useMemo(() => {
    return getRecentTrend(6);
  }, []);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // No historical data
  if (!comparison && trend.length === 0) {
    return (
      <div className="rounded-2xl p-4 bg-slate-900/50 border border-slate-700/50 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <Calendar className="text-indigo-400" size={20} />
          </div>
          <div>
            <h3 className="font-bold text-white">Historical Comparison</h3>
            <p className="text-sm text-slate-400">Compare to previous periods</p>
          </div>
        </div>

        <div className="text-center py-6">
          <BarChart2 className="mx-auto text-slate-600 mb-3" size={48} />
          <p className="text-slate-400">
            No historical data yet. Keep tracking your costs to see year-over-year comparisons.
          </p>
        </div>
      </div>
    );
  }

  const getTrendIcon = (delta) => {
    if (delta === null) return <Minus className="text-slate-500" size={16} />;
    if (delta < -5) return <TrendingDown className="text-green-400" size={16} />;
    if (delta > 5) return <TrendingUp className="text-red-400" size={16} />;
    return <Minus className="text-slate-400" size={16} />;
  };

  const formatChange = (delta, pctChange) => {
    if (delta === null) return "No data";
    const sign = delta > 0 ? "+" : "";
    return `${sign}$${delta.toFixed(2)} (${sign}${pctChange?.toFixed(1) || 0}%)`;
  };

  return (
    <div className="rounded-2xl overflow-hidden bg-slate-900/50 border border-slate-700/50 backdrop-blur-sm">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <Calendar className="text-indigo-400" size={20} />
          </div>
          <div>
            <h3 className="font-bold text-white">Historical Comparison</h3>
            <p className="text-sm text-slate-400">
              {monthNames[currentMonth - 1]} {currentYear} vs {currentYear - 1}
            </p>
          </div>
        </div>
      </div>

      {/* Year-over-Year Comparison */}
      {comparison && (
        <div className="p-4 border-b border-slate-700/50">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
              <div className="text-xs text-slate-500 mb-1">This Year</div>
              <div className="text-xl font-bold text-white">
                ${comparison.current.actualCost?.toFixed(2) || "N/A"}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
              <div className="text-xs text-slate-500 mb-1">Last Year</div>
              <div className="text-xl font-bold text-slate-400">
                ${comparison.lastYear.actualCost?.toFixed(2) || "N/A"}
              </div>
            </div>
          </div>

          {comparison.actualDelta !== null && (
            <div className={`mt-4 p-3 rounded-xl flex items-center justify-between ${
              comparison.actualDelta < 0
                ? "bg-green-900/20 border border-green-700/30"
                : comparison.actualDelta > 0
                ? "bg-red-900/20 border border-red-700/30"
                : "bg-slate-800/30 border border-slate-700/30"
            }`}>
              <div className="flex items-center gap-2">
                {getTrendIcon(comparison.actualPctChange)}
                <span className={`font-medium ${
                  comparison.actualDelta < 0 ? "text-green-400" : 
                  comparison.actualDelta > 0 ? "text-red-400" : 
                  "text-slate-300"
                }`}>
                  {formatChange(comparison.actualDelta, comparison.actualPctChange)}
                </span>
              </div>
              <span className="text-sm text-slate-500">vs same month last year</span>
            </div>
          )}
        </div>
      )}

      {/* Recent Trend */}
      {!compact && trend.length > 0 && (
        <div className="p-4">
          <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Recent Months
          </h4>
          <div className="space-y-2">
            {trend.map((month, idx) => (
              <div
                key={month.label}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-800/30"
              >
                <span className="text-sm text-slate-400">{month.label}</span>
                <div className="flex items-center gap-4">
                  {month.actual !== undefined && (
                    <span className="text-sm font-medium text-white">
                      ${month.actual.toFixed(2)}
                    </span>
                  )}
                  {month.predicted !== undefined && (
                    <span className="text-xs text-slate-500">
                      (predicted: ${month.predicted.toFixed(2)})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mini Trend Chart (visual bar representation) */}
      {!compact && trend.length >= 3 && (
        <div className="px-4 pb-4">
          <div className="flex items-end gap-1 h-16">
            {trend.slice().reverse().map((month, idx) => {
              const maxCost = Math.max(...trend.map(m => m.actual || 0));
              const height = maxCost > 0 ? ((month.actual || 0) / maxCost) * 100 : 0;
              
              return (
                <div 
                  key={month.label}
                  className="flex-1 bg-gradient-to-t from-indigo-500 to-purple-500 rounded-t opacity-70 hover:opacity-100 transition-opacity"
                  style={{ height: `${Math.max(10, height)}%` }}
                  title={`${month.label}: $${month.actual?.toFixed(2) || "N/A"}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-1 text-xs text-slate-600">
            <span>{trend[trend.length - 1]?.label}</span>
            <span>{trend[0]?.label}</span>
          </div>
        </div>
      )}
    </div>
  );
}


