import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

export default function GlobalAlertBanner({ id, message, kind = 'info', onDismiss, actionLabel, onAction }) {
  if (!message) return null;
  const bg = kind === 'warn' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200';
  return (
    <div className={`w-full mb-4 p-3 rounded-lg text-sm border ${bg} flex items-center justify-between gap-4`} role="status">
      <div className="flex items-center gap-3">
        <AlertTriangle size={18} className="flex-shrink-0" />
        <div>{message}</div>
      </div>
      <div className="flex items-center gap-2">
        {actionLabel && onAction && (
          <button onClick={() => onAction && onAction()} className="px-3 py-1.5 bg-transparent text-sm font-semibold rounded border border-transparent hover:border-current">
            {actionLabel}
          </button>
        )}
        <button aria-label="Dismiss" onClick={() => onDismiss && onDismiss(id)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
