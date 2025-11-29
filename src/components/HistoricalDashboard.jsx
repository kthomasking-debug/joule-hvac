import React, { useState, useMemo } from 'react';
import { TrendingDown, TrendingUp, Calendar, Info } from 'lucide-react';
import { getComparison, getRecentTrend, recordMonth } from '../lib/history/historyEngine';

export default function HistoricalDashboard() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  const [selectedYear] = useState(currentYear);
  const [selectedMonth] = useState(currentMonth);
  
  const comparison = useMemo(
    () => getComparison(selectedYear, selectedMonth),
    [selectedYear, selectedMonth]
  );
  
  const trend = useMemo(() => getRecentTrend(6), []);
  
  // Demo: auto-record current month if not present (in production, trigger on actual bill entry)
  React.useEffect(() => {
    const current = comparison?.current;
    if (!current) {
      recordMonth(currentYear, currentMonth, {
        predictedCost: 145.5,
        actualCost: undefined, // user hasn't entered yet
      });
    }
  }, [currentYear, currentMonth, comparison]);
  
  if (!comparison) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
          <Calendar className="text-indigo-600" size={20} />
          Historical Comparison
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          No data for {selectedYear}-{String(selectedMonth).padStart(2, '0')} or the previous year. Start tracking your monthly bills to see comparisons.
        </p>
      </div>
    );
  }
  
  const deltaColor = comparison.actualDelta !== null
    ? comparison.actualDelta < 0 ? 'text-green-600' : 'text-red-600'
    : 'text-gray-600';
  
  const deltaIcon = comparison.actualDelta !== null && comparison.actualDelta < 0
    ? <TrendingDown className={deltaColor} size={18} />
    : <TrendingUp className={deltaColor} size={18} />;
  
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
        <Calendar className="text-indigo-600" size={20} />
        Historical Comparison
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Compare {selectedYear}-{String(selectedMonth).padStart(2, '0')} vs the same month last year.
      </p>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg p-4">
          <div className="text-xs text-indigo-700 dark:text-indigo-300 font-semibold mb-1">This Year</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            ${comparison.current.actualCost !== undefined ? comparison.current.actualCost.toFixed(2) : '—'}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Predicted: ${comparison.current.predictedCost?.toFixed(2) || '—'}
          </div>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
          <div className="text-xs text-gray-700 dark:text-gray-300 font-semibold mb-1">Last Year</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            ${comparison.lastYear.actualCost !== undefined ? comparison.lastYear.actualCost.toFixed(2) : '—'}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Predicted: ${comparison.lastYear.predictedCost?.toFixed(2) || '—'}
          </div>
        </div>
      </div>
      
      {comparison.actualDelta !== null && (
        <div className="flex items-center gap-2 mb-4">
          {deltaIcon}
          <span className={`text-sm font-semibold ${deltaColor}`}>
            {comparison.actualDelta < 0 ? 'Saved' : 'Increased'} ${Math.abs(comparison.actualDelta).toFixed(2)} ({Math.abs(comparison.actualPctChange || 0).toFixed(1)}%)
          </span>
        </div>
      )}
      
      {comparison.current.upgradeName && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg text-sm flex items-start gap-2">
          <Info className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
          <div>
            <strong>Upgrade Note:</strong> {comparison.current.upgradeName} installed this period.
          </div>
        </div>
      )}
      
      {trend.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">6-Month Trend</h3>
          <div className="flex items-end gap-2 h-24">
            {trend.reverse().map((t, i) => {
              const maxVal = Math.max(...trend.map(x => x.predicted || 0));
              const height = t.predicted ? (t.predicted / maxVal) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-indigo-400 rounded-t"
                    style={{ height: `${height}%` }}
                    title={`${t.label}: $${t.predicted?.toFixed(2) || '—'}`}
                  />
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 rotate-45 origin-top-left whitespace-nowrap">
                    {t.label.slice(5)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
