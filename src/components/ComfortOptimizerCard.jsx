import React from "react";
const formatCurrency = (v) => `$${(Number(v) || 0).toFixed(2)}`;
import generateSchedule from "../lib/optimizer/comfortOptimizer";
import { CheckCircle, X } from 'lucide-react';

export default function ComfortOptimizerCard({ settings, forecast, learningEvents, onApplyBlock = null }) {
  const [applied, setApplied] = React.useState(false);
  const [hasActiveSchedule, setHasActiveSchedule] = React.useState(() => {
    try {
      return !!localStorage.getItem('optimizerSchedule');
    } catch {
      return false;
    }
  });
  const schedule = React.useMemo(() => generateSchedule(settings, forecast, learningEvents), [settings, forecast, learningEvents]);
  const [autoPilot, setAutoPilot] = React.useState(() => {
    try { return localStorage.getItem('optimizerAutoPilot') === 'true'; } catch { return false; }
  });

  const applyPlan = () => {
    try {
      localStorage.setItem("optimizerSchedule", JSON.stringify(schedule));
      localStorage.setItem("optimizerScheduleAppliedAt", new Date().toISOString());
      setApplied(true);
      setHasActiveSchedule(true);
      setTimeout(() => setApplied(false), 2000);
    } catch {
      // Ignore localStorage errors
    }
  };

  const clearPlan = () => {
    try {
      localStorage.removeItem('optimizerSchedule');
      localStorage.removeItem('optimizerScheduleAppliedAt');
      setHasActiveSchedule(false);
    } catch {
      // Ignore localStorage errors
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl p-6 mb-6">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">AI Comfort Optimizer</h2>
          {hasActiveSchedule && (
            <div className="flex items-center gap-1.5 mt-1">
              <CheckCircle className="text-emerald-600 dark:text-emerald-400" size={16} />
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Plan Active</span>
            </div>
          )}
        </div>
        {hasActiveSchedule && (
          <button
            type="button"
            onClick={clearPlan}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            title="Clear active plan"
          >
            <X size={20} />
          </button>
        )}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-300">Auto-pilot</label>
          <button
            onClick={() => {
              const next = !autoPilot;
              setAutoPilot(next);
              try { localStorage.setItem('optimizerAutoPilot', next ? 'true' : 'false'); } catch { /* ignore */ }
            }}
            className={`px-3 py-1 rounded text-sm ${autoPilot ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-900'}`}
          >{autoPilot ? 'On' : 'Off'}</button>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">A suggested 24‑hour schedule balancing comfort and cost.</p>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600 dark:text-gray-300">
              <th className="py-2 pr-4">Window</th>
              <th className="py-2 pr-4">Setpoint</th>
              <th className="py-2">Rationale</th>
            </tr>
          </thead>
          <tbody>
            {schedule.blocks.map((b, idx) => (
              <tr key={idx} className="border-t border-gray-100 dark:border-gray-700">
                <td className="py-2 pr-4">{String(b.startHour).padStart(2, '0')}:00–{String(b.endHour).padStart(2, '0')}:00</td>
                <td className="py-2 pr-4">{Math.round(b.setpoint)}°F</td>
                <td className="py-2 text-gray-500">{b.rationale.join(", ")}</td>
                <td className="py-2 pr-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        if (onApplyBlock && typeof onApplyBlock === 'function') onApplyBlock(b);
                        else {
                          // Fallback: write single-setpoint override to localStorage
                          localStorage.setItem('overrideSetpoint', JSON.stringify({ startHour: b.startHour, endHour: b.endHour, setpoint: b.setpoint }));
                        }
                        setApplied(true);
                        setTimeout(() => setApplied(false), 1200);
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                  >Apply This</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={applyPlan}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold"
        >
          Apply Plan
        </button>
        {applied && <span className="text-sm text-emerald-600">Applied ✓</span>}
        <div className="text-sm text-gray-600 ml-auto">Estimated Savings: {formatCurrency( ((schedule.blocks.reduce((s,b)=>s+b.setpoint, 0)/schedule.blocks.length - 70) * -1 * 0.5).toFixed(2) )}</div>
      </div>
    </div>
  );
}
