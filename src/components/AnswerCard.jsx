import React from 'react';
import { Zap, TrendingDown } from 'lucide-react';

const AnswerCard = ({ loading, location, temp, weeklyCost, energyMode, primarySystem, roiSavings }) => {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/20 via-teal-500/20 to-sky-500/20 dark:from-emerald-900/40 dark:via-teal-900/40 dark:to-sky-900/40 border-2 border-emerald-400/50 dark:border-emerald-600/50 rounded-2xl p-5 shadow-2xl shadow-emerald-500/20 dark:shadow-emerald-900/30 backdrop-blur-sm">
      {/* Animated background glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/10 via-teal-400/10 to-sky-400/10 animate-pulse" />
      <div className="relative z-10">
      {loading ? (
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-shimmer"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-shimmer"></div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-1 w-10 bg-gradient-to-r from-emerald-500 to-sky-500 rounded-full"></div>
              <p className="text-sm font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Quick Answer</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/50 dark:bg-gray-800/50 rounded">
                <Zap size={14} className="text-emerald-600 dark:text-emerald-400" />
                {energyMode || 'heating'}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/50 dark:bg-gray-800/50 rounded">
                {primarySystem === 'gasFurnace' ? '🔥 Gas' : '⚡ HP'}
              </span>
            </div>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-black bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
              ${(weeklyCost ?? 0).toFixed(2)}
            </span>
            <span className="text-lg text-gray-500 dark:text-gray-400 font-medium">for this week</span>
            {location && (
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
                {location.split('(')[0].trim()} at {temp ?? 70}°F
              </span>
            )}
          </div>
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
