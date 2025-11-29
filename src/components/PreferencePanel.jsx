import React, { useEffect, useState } from 'react';
import { getPreferenceSummary } from '../utils/learning/preferenceLearner';
import { executeCommand } from '../utils/nlp/commandExecutor';

// Simple personalization panel showing learned schedule + suggestions
export default function PreferencePanel() {
  const [summary, setSummary] = useState(() => getPreferenceSummary());
  const [lastAction, setLastAction] = useState('');

  useEffect(() => {
    // Refresh summary on mount; could later poll or subscribe
    setSummary(getPreferenceSummary());
  }, []);

  function applyNightSetback() {
    try {
      const raw = localStorage.getItem('thermostatState');
      let current = 72;
      if (raw) {
        const obj = JSON.parse(raw);
        if (typeof obj.targetTemp === 'number') current = obj.targetTemp;
      }
      const newTemp = Math.max(current - 2, 45);
      const res = executeCommand({ intent: 'setTemperature', entities: { value: newTemp }, });
      setLastAction(res.message);
      setSummary(getPreferenceSummary());
    } catch { /* ignore */ }
  }
  function applyDayLower() {
    try {
      const raw = localStorage.getItem('thermostatState');
      let current = 72;
      if (raw) {
        const obj = JSON.parse(raw);
        if (typeof obj.targetTemp === 'number') current = obj.targetTemp;
      }
      const newTemp = Math.max(current - 1, 45);
      const res = executeCommand({ intent: 'setTemperature', entities: { value: newTemp }, });
      setLastAction(res.message);
      setSummary(getPreferenceSummary());
    } catch { /* ignore */ }
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900 space-y-4" data-testid="preference-panel">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Personalization</h3>
      {summary.schedule && summary.schedule.length > 0 ? (
        <div className="text-xs max-h-32 overflow-auto pr-1">
          {summary.schedule.slice(0,24).map(s => (
            <div key={s.hour} className="flex justify-between py-0.5"><span>{s.hour}:00</span><span>{s.setpoint}°</span></div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500">Insufficient data yet. Adjust temperature to begin learning.</p>
      )}
      <div className="space-y-2">
        {(summary.suggestions || []).map((sg, i) => (
          <div key={i} className="text-[11px] text-gray-700 dark:text-gray-300 flex items-start gap-2">
            <span>•</span><span>{sg}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={applyNightSetback}
          className="text-xs px-3 py-1 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 bg-blue-600 text-white dark:bg-blue-500 dark:text-white hover:bg-blue-700 dark:hover:bg-blue-600 shadow-sm"
        >Apply Night Setback</button>
        <button
          onClick={applyDayLower}
          className="text-xs px-3 py-1 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white hover:bg-indigo-700 dark:hover:bg-indigo-600 shadow-sm"
        >Lower Day 1°F</button>
      </div>
      {lastAction && <div className="text-[11px] text-blue-600 dark:text-blue-300" data-testid="preference-last-action">{lastAction}</div>}
    </div>
  );
}
