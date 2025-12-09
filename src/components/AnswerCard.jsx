import React from 'react';
import { Zap, TrendingDown } from 'lucide-react';

const AnswerCard = ({ loading, location, temp, weeklyCost, energyMode, primarySystem, roiSavings }) => {
  return (
    <div className="mt-6 bg-gradient-to-br from-emerald-50 via-teal-50 to-sky-50 dark:from-emerald-900/30 dark:via-teal-900/30 dark:to-sky-900/30 border-2 border-emerald-300 dark:border-emerald-700 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 card-lift">
      {loading ? (
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-shimmer"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-shimmer"></div>
          <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-700 rounded animate-shimmer"></div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-1 w-12 bg-gradient-to-r from-emerald-500 to-sky-500 rounded-full"></div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Quick Answer</p>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
            {location ? `Next 7 days in ${location}` : 'Next 7 days'} at {temp ?? 70}°F:
          </h3>
          <div className="flex items-baseline gap-3 animate-count-up">
            <span className="text-5xl font-black bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
              ${(weeklyCost ?? 0).toFixed(2)}
            </span>
            <span className="text-lg text-gray-500 dark:text-gray-400 font-medium">weekly cost</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/50 dark:bg-gray-800/50 rounded-lg">
              <Zap size={14} className="text-emerald-600 dark:text-emerald-400" />
              {energyMode || 'heating'}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/50 dark:bg-gray-800/50 rounded-lg">
              {primarySystem === 'gasFurnace' ? '🔥 Gas furnace' : '⚡ Heat pump'}
            </span>
          </p>
          {primarySystem === 'heatPump' && energyMode === 'heating' && roiSavings > 0 && (
            <div className="pt-3 border-t border-emerald-200 dark:border-emerald-800">
              <p className="text-sm font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                <TrendingDown size={16} />
                Annual savings vs gas: <span className="text-lg">${roiSavings.toFixed(0)}/yr</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AnswerCard;
