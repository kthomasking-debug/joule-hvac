import React from 'react';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export default function ScoreRing({ score = 70, label = 'Joule Score', sublabel = 'out of 100', ringSize = 160, className = '' }) {
  const s = clamp(Number(score) || 0, 0, 100);
  const r = (ringSize / 2) - 10;
  const c = 2 * Math.PI * r;

  const ringColor = s >= 80
    ? 'stroke-emerald-500'
    : s >= 60
      ? 'stroke-amber-500'
      : s >= 40
        ? 'stroke-orange-500'
        : 'stroke-red-500';

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-slate-100 dark:border-gray-700 p-6 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-slate-600 dark:text-slate-300 text-sm font-medium mb-1">Home Efficiency</p>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{label}</h2>
        </div>
      </div>
      <div className="relative flex items-center justify-center my-4">
        <svg className="transform -rotate-90" width={ringSize} height={ringSize}>
          <circle cx={ringSize/2} cy={ringSize/2} r={r} stroke="currentColor" strokeWidth="12" fill="none" className="text-slate-100 dark:text-gray-800" />
          <circle cx={ringSize/2} cy={ringSize/2} r={r} stroke="currentColor" strokeWidth="12" fill="none" strokeDasharray={`${c}`} strokeDashoffset={`${c * (1 - s / 100)}`} className={`${ringColor} transition-all duration-700`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className="text-4xl font-extrabold bg-gradient-to-br from-blue-600 to-indigo-600 bg-clip-text text-transparent">{Math.round(s)}</span>
          <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">{sublabel}</span>
        </div>
      </div>
    </div>
  );
}
