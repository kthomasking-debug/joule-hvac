// src/components/InsightCard.jsx
// Component for displaying insights and recommendations

import React from 'react';

export default function InsightCard({
  title = 'No insights today',
  message = 'Everything looks good. Check back tomorrow!',
  actionLabel,
  onAction,
  variant = 'info',
  className = ''
}) {
  const gradient = variant === 'alert'
    ? 'from-red-500 to-rose-600'
    : variant === 'tip'
      ? 'from-purple-500 to-indigo-600'
      : 'from-slate-500 to-slate-600';

  return (
    <div className={`bg-gradient-to-r ${gradient} rounded-2xl p-6 shadow-lg text-white ${className}`}>
      <div className="flex items-start gap-4">
        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
          <span aria-hidden>💡</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-bold">{title}</h3>
          </div>
          <p className="text-white/90 mb-3">{message}</p>
          {actionLabel && (
            <button className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg backdrop-blur-sm transition-all text-sm font-medium" onClick={onAction}>
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
