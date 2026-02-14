import React from 'react';
import { Zap, TrendingDown } from 'lucide-react';

const AnswerCard = ({ loading, location, temp, weeklyCost, energyMode, primarySystem, roiSavings, timePeriod = "week", periodLabel, compact = false, contextSubtitle, breakdown }) => {
  const padding = compact ? "p-3" : "p-4 sm:p-5";
  const rounded = compact ? "rounded-xl" : "rounded-2xl";
  const titleSize = compact ? "text-sm" : "text-sm";
  const costSize = compact ? "text-3xl sm:text-4xl" : "text-3xl sm:text-4xl md:text-5xl";
  const periodSize = compact ? "text-base" : "text-base sm:text-lg";
  const locationSize = compact ? "text-sm" : "text-sm";
  
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-emerald-500/20 via-teal-500/20 to-sky-500/20 dark:from-emerald-900/40 dark:via-teal-900/40 dark:to-sky-900/40 border-2 border-emerald-400/50 dark:border-emerald-600/50 ${rounded} ${padding} shadow-2xl shadow-emerald-500/20 dark:shadow-emerald-900/30 backdrop-blur-sm`}>
      {/* Animated background glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/10 via-teal-400/10 to-sky-400/10 animate-pulse" />
      <div className="relative z-10">
      {loading ? (
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-shimmer"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-shimmer"></div>
        </div>
      ) : (
        <div className={compact ? "space-y-1" : "space-y-2"}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-1 ${compact ? "w-8" : "w-10"} bg-gradient-to-r from-emerald-500 to-sky-500 rounded-full`}></div>
              <p className={`${titleSize} font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300`}>Quick Answer</p>
            </div>
            <div className={`flex items-center gap-2 ${compact ? "text-xs" : "text-sm"}`}>
              <span className={`inline-flex items-center gap-1 ${compact ? "px-1.5 py-0.5" : "px-2 py-1"} bg-white/50 dark:bg-gray-800/50 rounded`}>
                <Zap size={compact ? 12 : 14} className="text-emerald-600 dark:text-emerald-400" />
                {energyMode || 'heating'}
              </span>
              <span className={`inline-flex items-center gap-1 ${compact ? "px-1.5 py-0.5" : "px-2 py-1"} bg-white/50 dark:bg-gray-800/50 rounded`}>
                {primarySystem === 'gasFurnace' ? '🔥 Gas' : '⚡ HP'}
              </span>
            </div>
          </div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className={`${costSize} font-black bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent`}>
              ${(weeklyCost ?? 0).toFixed(2)}
            </span>
            <span className={`${periodSize} text-gray-500 dark:text-gray-400 font-medium`}>{periodLabel ? `for ${periodLabel}` : `for this ${timePeriod}`}</span>
            {location && (
              <span className={`${locationSize} text-gray-500 dark:text-gray-400 ml-auto`}>
                {location.split('(')[0].trim()} at {temp ?? 70}°F
              </span>
            )}
          </div>
          {contextSubtitle && (
            <p className={`${compact ? "text-xs" : "text-sm"} text-gray-500 dark:text-gray-400 mt-1`}>
              {contextSubtitle}
            </p>
          )}
          {breakdown && (breakdown.hvac != null || breakdown.homeUsage != null || breakdown.fees != null) && (
            <p className={`${compact ? "text-xs" : "text-sm"} text-gray-600 dark:text-gray-400 mt-2 flex flex-wrap gap-x-3 gap-y-0`}>
              {breakdown.hvac != null && <span>{breakdown.hvacLabel || 'HVAC'}: ${breakdown.hvac.toFixed(2)}</span>}
              {breakdown.homeUsage != null && <span>Home usage: ${breakdown.homeUsage.toFixed(2)}</span>}
              {breakdown.fees != null && <span>Fees: ${breakdown.fees.toFixed(2)}</span>}
            </p>
          )}
          {primarySystem === 'heatPump' && energyMode === 'heating' && roiSavings > 0 && (
            <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800">
              <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                <TrendingDown size={12} />
                Annual savings vs gas: ${roiSavings.toFixed(0)}/yr
              </p>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
};

export default AnswerCard;
