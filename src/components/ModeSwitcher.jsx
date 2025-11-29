import React from 'react';
import { useMode } from '../contexts/ModeContext';

// Accessible toggle between Voice (AI) and Manual (Traditional) modes
export default function ModeSwitcher() {
  const { mode, toggleMode, setMode } = useMode();
  const isAi = mode === 'ai';

  return (
    <div
      className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700"
      role="group"
      aria-label="Interface mode"
      data-testid="mode-switcher"
    >
      <button
        type="button"
        onClick={() => setMode('traditional')}
        aria-pressed={mode === 'traditional'}
        className={`text-xs font-semibold px-2 py-1 rounded ${mode === 'traditional' ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}
      >Manual</button>
      <button
        type="button"
        onClick={() => setMode('ai')}
        aria-pressed={isAi}
        className={`text-xs font-semibold px-2 py-1 rounded ${isAi ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}
      >Voice</button>
      <button
        type="button"
        onClick={toggleMode}
        aria-label={isAi ? 'Switch to manual mode' : 'Switch to voice mode'}
        className="ml-1 text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-500 hover:bg-gray-300 dark:hover:bg-gray-400"
      >{isAi ? '🎤' : '👆'}</button>
    </div>
  );
}
