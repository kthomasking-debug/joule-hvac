import React from 'react';
import { Sun, Cloud, Snowflake } from 'lucide-react';

function iconFor(low, high) {
  const avg = (Number(low) + Number(high)) / 2;
  if (avg < 40) return <Snowflake className="w-6 h-6 text-blue-400" />;
  if (avg < 55) return <Cloud className="w-6 h-6 text-gray-400" />;
  return <Sun className="w-6 h-6 text-yellow-400" />;
}

function costColor(costIndex) {
  if (costIndex < 0.35) return 'bg-green-500';
  if (costIndex < 0.6) return 'bg-yellow-500';
  return 'bg-orange-500';
}

export default function WeatherMiniCard({ dayLabel, dateLabel, low, high, costIndex = 0.4, costDisplay }) {
  const barHeight = Math.max(8, Math.min(100, Math.round(costIndex * 100)));
  return (
    <div className="bg-gradient-to-br from-blue-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-xl p-4 text-center border-2 border-blue-100 dark:border-gray-700 hover:border-blue-300 transition-all">
      <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">{dayLabel}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">{dateLabel}</div>
      <div className="my-3 flex justify-center">{iconFor(low, high)}</div>
      <div className="text-xs text-gray-600 dark:text-gray-300 mb-3">
        <div>{Math.round(high)}°</div>
        <div className="text-gray-400">{Math.round(low)}°</div>
      </div>
      <div className="relative h-12 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
        <div className={`absolute bottom-0 w-full ${costColor(costIndex)} transition-all`} style={{ height: `${barHeight}%` }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{costDisplay ?? `${Math.round(costIndex * 100)}%`}</span>
        </div>
      </div>
    </div>
  );
}
