import React from 'react';

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

export default function SavingsThermometer({ savings = 0, target = 40, label = 'saved' }) {
  const pct = clamp(target > 0 ? (savings / target) * 100 : 0, 0, 100);
  const gradient = 'bg-gradient-to-r from-green-400 to-green-600';
  return (
    <div className="mt-4 bg-gray-100 dark:bg-gray-800 rounded-full h-8 overflow-hidden relative border border-gray-200 dark:border-gray-700">
      <div
        className={`${gradient} h-full transition-all duration-500 flex items-center justify-end pr-3`}
        style={{ width: `${pct}%` }}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={savings}
        role="progressbar"
      >
        <span className="text-white text-sm font-bold">💰 ${savings.toFixed?.(2) ?? savings} {label}</span>
      </div>
    </div>
  );
}
