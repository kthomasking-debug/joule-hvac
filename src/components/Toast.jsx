import React, { useEffect } from 'react';
import { CheckCircle2, Info, X } from 'lucide-react';

export const Toast = ({ message, type = 'success', onClose, duration = 3000 }) => {
  useEffect(() => {
    if (duration && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle2 size={18} className="text-green-600 dark:text-green-400" />,
    info: <Info size={18} className="text-blue-600 dark:text-blue-400" />,
  };

  const bgColors = {
    success: 'bg-green-50 dark:bg-green-900 dark:bg-opacity-30 border-green-200 dark:border-green-700',
    info: 'bg-blue-50 dark:bg-blue-900 dark:bg-opacity-30 border-blue-200 dark:border-blue-700',
  };

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${bgColors[type]} min-w-[280px] max-w-md`}>
        {icons[type]}
        <p className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100">{message}</p>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};
