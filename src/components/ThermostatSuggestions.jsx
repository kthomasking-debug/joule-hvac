import React from 'react';
import { getThermostatLearningEvents } from '../hooks/useThermostatLearning';
import { Lightbulb } from 'lucide-react';

function analyzeMorningWarmup(events) {
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const morning = events.filter(e => e.kind === 'winter' && new Date(e.ts).getTime() >= twoWeeksAgo && e.hour >= 5 && e.hour <= 8 && e.next > e.prev + 1);
  const byHour = new Map();
  for (const e of morning) {
    byHour.set(e.hour, (byHour.get(e.hour) || 0) + 1);
  }
  let bestHour = null;
  let count = 0;
  for (const [h, c] of byHour.entries()) {
    if (c > count) { count = c; bestHour = h; }
  }
  if (count >= 3) {
    // suggest +2°F at bestHour
    return { hour: bestHour, delta: 2, count };
  }
  return null;
}

export default function ThermostatSuggestions({ currentWinter, onApply }) {
  const [dismissed, setDismissed] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('suggestionDismiss') || 'false'); } catch { return false; }
  });
  const events = getThermostatLearningEvents();
  const morning = analyzeMorningWarmup(events);

  if (dismissed || !morning) return null;

  const applyNow = () => {
    const next = (Number(currentWinter) || 70) + morning.delta;
    try {
      onApply?.(next);
    } catch {
      // Ignore apply errors
    }
    setDismissed(true);
    try { localStorage.setItem('suggestionDismiss', 'true'); } catch {
      // Ignore localStorage errors
    }
  };

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem('suggestionDismiss', 'true'); } catch {
      // Ignore localStorage errors
    }
  };

  return (
    <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-4 flex items-start gap-3">
      <Lightbulb className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={20} />
      <div className="flex-1">
        <div className="font-semibold text-amber-900 dark:text-amber-100">Suggestion: Morning Pre‑Warm</div>
        <div className="text-sm text-amber-800 dark:text-amber-200 mt-1">
          Noticed you turn up the heat around {String(morning.hour).padStart(2,'0')}:00. Try an automatic +{morning.delta}°F pre‑warm to start the day cozy.
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={applyNow} className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700">Apply now</button>
          <button onClick={dismiss} className="px-3 py-1.5 text-xs font-semibold rounded border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200">Dismiss</button>
        </div>
      </div>
    </div>
  );
}
