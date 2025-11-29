import React from 'react';

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function computeSavingsIndex({ winterThermostat = 70, summerThermostat = 74, seer = 15, hspf = 9 }) {
  const winterDelta = clamp((70 - (Number(winterThermostat) || 70)) / 6, -1, 1); // colder saves
  const summerDelta = clamp(((Number(summerThermostat) || 74) - 74) / 6, -1, 1); // warmer saves
  const effDelta = clamp((((Number(seer) || 15) - 15) / 5 + ((Number(hspf) || 9) - 9) / 2) / 2, -1, 1);
  // Weighting: thermostats drive most savings; efficiency provides a bonus
  const raw = 0.5 + 0.35 * winterDelta + 0.35 * summerDelta + 0.3 * (effDelta * 0.5);
  return clamp(Math.round(raw * 100), 0, 100);
}

const ComfortSavingsDial = ({
  winterThermostat = 70,
  summerThermostat = 74,
  seer,
  hspf,
  size = 220,
  className = ''
}) => {
  const savings = computeSavingsIndex({ winterThermostat, summerThermostat, seer, hspf });
  const comfort = 100 - savings;

  // Map 0..100 to -100..100 degrees for a wide semicircle
  const angle = (savings / 100) * 200 - 100; // -100deg (comfort) to +100deg (savings)
  const radius = size / 2 - 12;
  const center = { x: size / 2, y: size / 2 };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Comfort vs Savings</div>
      <div className="relative" style={{ width: size, height: size / 1.2 }}>
        {/* Arc background */}
        <svg width={size} height={size / 1.2} viewBox={`0 0 ${size} ${size / 1.2}`}>
          {/* Gradient arc from comfort (left, blue) to savings (right, green) */}
          <defs>
            <linearGradient id="csv-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
          {/* Semicircle path */}
          <path
            d={`M ${center.x - radius} ${center.y} A ${radius} ${radius} 0 0 1 ${center.x + radius} ${center.y}`}
            fill="none"
            stroke="url(#csv-gradient)"
            strokeWidth="14"
            strokeLinecap="round"
            opacity="0.35"
          />
          {/* Tick marks */}
          {Array.from({ length: 9 }).map((_, i) => {
            const t = i / 8; // 0..1
            const a = (-100 + t * 200) * (Math.PI / 180);
            const x1 = center.x + (radius - 8) * Math.cos(a);
            const y1 = center.y + (radius - 8) * Math.sin(a);
            const x2 = center.x + radius * Math.cos(a);
            const y2 = center.y + radius * Math.sin(a);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9ca3af" strokeWidth={i % 2 === 0 ? 2 : 1} />;
          })}
          {/* Needle */}
          <g transform={`translate(${center.x}, ${center.y}) rotate(${angle})`}>
            <line x1="0" y1="0" x2={radius - 16} y2="0" stroke="#111827" strokeWidth="3" strokeLinecap="round" />
            <circle cx="0" cy="0" r="5" fill="#111827" />
          </g>
        </svg>
        {/* Labels */}
        <div className="absolute left-0 bottom-0 text-xs text-blue-500 font-semibold">Comfort</div>
        <div className="absolute right-0 bottom-0 text-xs text-emerald-600 font-semibold">Savings</div>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>Savings: <span className="font-semibold text-gray-900 dark:text-white">{savings}</span></div>
        <div className="w-px h-3 bg-gray-300 dark:bg-gray-600" />
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"/>Comfort: <span className="font-semibold text-gray-900 dark:text-white">{comfort}</span></div>
      </div>
      <div className="mt-1 text-[11px] text-gray-500">
        Winter {winterThermostat}°F • Summer {summerThermostat ?? 74}°F • SEER {seer ?? '—'} • HSPF {hspf ?? '—'}
      </div>
    </div>
  );
};

export default ComfortSavingsDial;
// eslint-disable-next-line react-refresh/only-export-components
export { computeSavingsIndex };
