import React from 'react';

// Minimal placeholder used for upcoming Upgrade ROI Analyzer.
export default function ComparisonCard({
  title = 'Comparison',
  left = { label: 'Current', value: '—' },
  right = { label: 'With Upgrade', value: '—' },
  deltaLabel = 'Difference',
  deltaValue,
  className = ''
}) {
  const showDelta = typeof deltaValue !== 'undefined' && deltaValue !== null;
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-slate-100 dark:border-gray-700 p-6 ${className}`}>
      <h3 className="text-slate-900 dark:text-white text-lg font-bold mb-3">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-gray-700 p-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">{left.label}</p>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{left.value}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-gray-700 p-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">{right.label}</p>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{right.value}</p>
        </div>
      </div>
      {showDelta && (
        <div className="mt-3 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-200 dark:border-emerald-800 p-3">
          <p className="text-xs text-emerald-700 dark:text-emerald-300">{deltaLabel}</p>
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{deltaValue}</p>
        </div>
      )}
    </div>
  );
}
