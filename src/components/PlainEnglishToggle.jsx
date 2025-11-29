// src/components/PlainEnglishToggle.jsx
// Natural language translation for technical metrics

import React, { useState } from 'react';
import { BookOpen, Wrench } from 'lucide-react';

export default function PlainEnglishToggle({ 
  technicalValue,
  technicalLabel,
  plainEnglishValue,
  plainEnglishLabel,
  unit = ''
}) {
  const [isPlainEnglish, setIsPlainEnglish] = useState(false);

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      {/* Toggle buttons */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setIsPlainEnglish(false)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            !isPlainEnglish
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          <Wrench size={14} />
          Technical
        </button>
        <button
          onClick={() => setIsPlainEnglish(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            isPlainEnglish
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          <BookOpen size={14} />
          Plain English
        </button>
      </div>

      {/* Value display */}
      <div className="transition-all duration-300">
        {!isPlainEnglish ? (
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {technicalValue} {unit}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {technicalLabel}
            </div>
          </div>
        ) : (
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {plainEnglishValue}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {plainEnglishLabel}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
