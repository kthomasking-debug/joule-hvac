// src/components/optimization/BenchmarkCard.jsx
// Compare user's efficiency to benchmarks

import React, { useMemo } from "react";
import { 
  Users, 
  TrendingUp, 
  TrendingDown,
  Award,
  Target,
  Info
} from "lucide-react";
import { getBenchmarks } from "../../lib/optimization/OptimizationEngine";

export default function BenchmarkCard({
  monthlyCost = 100,
  monthlyKWh = 500,
  squareFeet = 1000,
  climateZone = "mixed",
  heatPumpType = "standard",
  compact = false,
}) {
  const benchmarks = useMemo(() => {
    return getBenchmarks({
      monthlyCost,
      monthlyKWh,
      squareFeet,
      climateZone,
      heatPumpType,
    });
  }, [monthlyCost, monthlyKWh, squareFeet, climateZone, heatPumpType]);

  const percentileColors = {
    "Top 10%": "text-green-400",
    "Top 25%": "text-green-400",
    "Better than average": "text-blue-400",
    "Average": "text-slate-400",
    "Below average": "text-yellow-400",
    "Needs improvement": "text-red-400",
  };

  const percentileBg = {
    "Top 10%": "from-green-600/20 to-emerald-600/20 border-green-500/50",
    "Top 25%": "from-green-600/20 to-emerald-600/20 border-green-500/50",
    "Better than average": "from-blue-600/20 to-indigo-600/20 border-blue-500/50",
    "Average": "from-slate-700/20 to-slate-600/20 border-slate-500/50",
    "Below average": "from-yellow-600/20 to-amber-600/20 border-yellow-500/50",
    "Needs improvement": "from-red-600/20 to-orange-600/20 border-red-500/50",
  };

  return (
    <div className="rounded-2xl overflow-hidden bg-slate-900/50 border border-slate-700/50 backdrop-blur-sm">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <Users className="text-cyan-400" size={20} />
          </div>
          <div>
            <h3 className="font-bold text-white">How You Compare</h3>
            <p className="text-sm text-slate-400">vs similar homes in your area</p>
          </div>
        </div>
      </div>

      {/* Percentile Badge */}
      <div className={`mx-4 mt-4 p-4 rounded-xl bg-gradient-to-r ${percentileBg[benchmarks.comparison.percentile]} border`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Award className={percentileColors[benchmarks.comparison.percentile]} size={28} />
            <div>
              <p className={`text-lg font-bold ${percentileColors[benchmarks.comparison.percentile]}`}>
                {benchmarks.comparison.percentile}
              </p>
              <p className="text-sm text-slate-400">Efficiency ranking</p>
            </div>
          </div>
          {benchmarks.comparison.isAboveAverage && (
            <div className="flex items-center gap-1 text-green-400">
              <TrendingUp size={18} />
              <span className="text-sm font-medium">{benchmarks.comparison.costDiff}% better</span>
            </div>
          )}
          {!benchmarks.comparison.isAboveAverage && (
            <div className="flex items-center gap-1 text-red-400">
              <TrendingDown size={18} />
              <span className="text-sm font-medium">{Math.abs(parseFloat(benchmarks.comparison.costDiff))}% higher cost</span>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Comparison */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
            <div className="text-xs text-slate-500 mb-1">Your Cost/sqft</div>
            <div className="text-lg font-bold text-white">
              ${benchmarks.userMetrics.costPerSqFt}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
            <div className="text-xs text-slate-500 mb-1">Average Cost/sqft</div>
            <div className="text-lg font-bold text-slate-400">
              ${benchmarks.benchmarkMetrics.costPerSqFt}
            </div>
          </div>
        </div>

        {/* Energy Usage Comparison */}
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-400">Energy Usage vs Average</span>
            <span className={parseFloat(benchmarks.comparison.kWhDiff) > 0 ? "text-green-400" : "text-red-400"}>
              {parseFloat(benchmarks.comparison.kWhDiff) > 0 ? "-" : "+"}{Math.abs(parseFloat(benchmarks.comparison.kWhDiff))}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-slate-800 overflow-hidden relative">
            <div 
              className={`h-full rounded-full absolute left-1/2 transition-all ${
                parseFloat(benchmarks.comparison.kWhDiff) > 0 
                  ? "bg-gradient-to-r from-green-500 to-emerald-400" 
                  : "bg-gradient-to-l from-red-500 to-orange-400"
              }`}
              style={{ 
                width: `${Math.min(50, Math.abs(parseFloat(benchmarks.comparison.kWhDiff)))}%`,
                transform: parseFloat(benchmarks.comparison.kWhDiff) > 0 
                  ? "translateX(-100%)" 
                  : "none"
              }}
            />
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/50" />
          </div>
          <div className="flex justify-between text-xs text-slate-600 mt-1">
            <span>Better than avg</span>
            <span>Avg</span>
            <span>Worse than avg</span>
          </div>
        </div>
      </div>

      {/* Insights */}
      {benchmarks.insights.length > 0 && !compact && (
        <div className="p-4 border-t border-slate-700/50">
          {benchmarks.insights.map((insight, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2 p-3 rounded-lg ${
                insight.type === "positive" 
                  ? "bg-green-900/20 border border-green-700/30" 
                  : insight.type === "attention"
                  ? "bg-amber-900/20 border border-amber-700/30"
                  : "bg-slate-800/30"
              }`}
            >
              <Info className={
                insight.type === "positive" 
                  ? "text-green-400" 
                  : insight.type === "attention"
                  ? "text-amber-400"
                  : "text-blue-400"
              } size={16} />
              <p className="text-sm text-slate-300">{insight.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Climate Zone Info */}
      {!compact && (
        <div className="p-4 border-t border-slate-700/50 bg-slate-800/30">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Target size={12} />
            <span>
              Benchmarks based on {climateZone} climate zone • {heatPumpType.replace("_", " ")} system
            </span>
          </div>
        </div>
      )}
    </div>
  );
}


