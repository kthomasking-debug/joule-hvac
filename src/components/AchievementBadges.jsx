import React from 'react';

const Badge = ({ unlocked, title, subtitle, color = 'emerald', progress = null }) => {
  const colors = {
    emerald: 'from-emerald-500 to-emerald-600',
    blue: 'from-blue-500 to-blue-600',
    amber: 'from-amber-500 to-amber-600',
    violet: 'from-violet-500 to-violet-600',
    gray: 'from-gray-400 to-gray-500'
  };
  const ring = unlocked ? 'ring-2 ring-offset-2 ring-emerald-400 dark:ring-emerald-500' : 'opacity-60';
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ${ring}`}>
      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${colors[color]} text-white flex items-center justify-center font-bold`}>{unlocked ? '✓' : '?'}</div>
      <div>
        <div className="text-sm font-semibold text-gray-900 dark:text-white">{title}</div>
        <div className="text-xs text-gray-600 dark:text-gray-400">{subtitle}</div>
      </div>
      {progress !== null && progress < 1 && (
        <div className="w-full mt-2">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-2 bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default function AchievementBadges({ weeklySavings = 0, jouleScore = 50, hasElevation = false, useDetailed = false }) {
  const badges = [
    {
      key: 'rookie-saver',
      unlocked: weeklySavings >= 10,
      progress: Math.min(1, weeklySavings / 10),
      title: 'Rookie Saver',
      subtitle: 'Saved $10+ this week vs gas',
      color: 'emerald'
    },
    {
      key: 'efficient-operator',
      unlocked: jouleScore >= 75,
      progress: Math.min(1, jouleScore / 75),
      title: 'Efficient Operator',
      subtitle: 'Joule Score 75 or higher',
      color: 'amber'
    },
    {
      key: 'elevation-dialed',
      unlocked: hasElevation,
      progress: hasElevation ? 1 : 0,
      title: 'Elevation Dialed',
      subtitle: 'Home elevation detected and applied',
      color: 'blue'
    },
    {
      key: 'detail-mode',
      unlocked: useDetailed,
      progress: useDetailed ? 1 : 0.3,
      title: 'Detail Mode',
      subtitle: 'Using full precision estimates',
      color: 'violet'
    }
  ];

  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Achievements</h3>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-500">Earn achievements to track progress and unlock rewards</div>
        <button className="text-sm text-blue-600 hover:underline">View All</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {badges.map(b => (
          <Badge key={b.key} unlocked={b.unlocked} title={b.title} subtitle={b.subtitle} color={b.color} progress={b.progress} />
        ))}
      </div>
    </div>
  );
}
