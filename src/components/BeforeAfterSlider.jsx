import React from 'react';
import { useUnitSystem, formatEnergyFromKwh } from '../lib/units';

function lerp(a, b, t) { return a + (b - a) * t; }

export default function BeforeAfterSlider({
  left,
  right,
  titleLeft = 'Constant',
  titleRight = 'Setback',
  defaultValue = 0,
}) {
  const { unitSystem } = useUnitSystem();
  const [t, setT] = React.useState(defaultValue);
  const cost = lerp(left.cost, right.cost, t);
  const energy = lerp(left.energy, right.energy, t);
  const aux = lerp(left.aux, right.aux, t);

  const savingsVsLeft = left.cost - cost;
  const pct = left.cost > 0 ? (savingsVsLeft / left.cost) * 100 : 0;

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Before/After Comparison</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">Drag to blend: {titleLeft} → {titleRight}</div>
      </div>
      <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-4">
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-400 via-amber-400 to-emerald-500"
          style={{ width: `${t * 100}%` }}
        />
        <input
          aria-label="Before/After slider"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={t}
          onChange={(e) => setT(Number(e.target.value))}
          className="absolute inset-0 w-full h-3 opacity-0 cursor-pointer"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">Cost</div>
          <div className="text-3xl font-black text-gray-900 dark:text-white">${cost.toFixed(2)}</div>
        </div>
        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">Energy</div>
          <div className="text-3xl font-black text-blue-600 dark:text-blue-400">{formatEnergyFromKwh(energy, unitSystem, { decimals: 2 })}</div>
        </div>
        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">Aux Heat</div>
          <div className="text-3xl font-black text-orange-600 dark:text-orange-400">{formatEnergyFromKwh(aux, unitSystem, { decimals: 2 })}</div>
        </div>
      </div>
      <div className="mt-4 text-center text-sm">
        <span className="text-gray-700 dark:text-gray-200 font-semibold">vs {titleLeft}:</span>
        <span className={`ml-2 font-bold ${savingsVsLeft >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {savingsVsLeft >= 0 ? '+' : ''}${savingsVsLeft.toFixed(2)} ({pct.toFixed(1)}%)
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{titleLeft}: ${left.cost.toFixed(2)}, {formatEnergyFromKwh(left.energy, unitSystem, { decimals: 2 })}, {formatEnergyFromKwh(left.aux, unitSystem, { decimals: 2 })} aux</span>
        <span>{titleRight}: ${right.cost.toFixed(2)}, {formatEnergyFromKwh(right.energy, unitSystem, { decimals: 2 })}, {formatEnergyFromKwh(right.aux, unitSystem, { decimals: 2 })} aux</span>
      </div>
    </div>
  );
}
