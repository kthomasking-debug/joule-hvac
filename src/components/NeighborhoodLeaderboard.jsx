import React from 'react';
import { TrendingUp, Users, Award } from 'lucide-react';
import getLeaderboardData from '../lib/leaderboard/leaderboardEngine';

export default function NeighborhoodLeaderboard({ jouleScore, userState }) {
  const data = React.useMemo(() => getLeaderboardData(jouleScore, userState), [jouleScore, userState]);

  if (!data) return null;

  const percentileColor = data.percentile >= 75 ? 'text-green-600' : data.percentile >= 50 ? 'text-yellow-600' : 'text-gray-600';
  const percentileLabel = data.percentile >= 75 ? 'Top Performer' : data.percentile >= 50 ? 'Above Average' : 'Room to Improve';

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
        <Award className="text-purple-600" size={20} />
        Neighborhood Leaderboard
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        See how you compare to {data.participantCount.toLocaleString()} homes in the {data.region} region (anonymous).
      </p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 text-xs font-semibold mb-1">
            <TrendingUp size={14} />
            Your Percentile
          </div>
          <div className={`text-3xl font-bold ${percentileColor} dark:${percentileColor.replace('600', '400')}`}>
            {data.percentile}th
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{percentileLabel}</div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 text-xs font-semibold mb-1">
            <Users size={14} />
            Regional Average
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {data.regionalAvg}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Joule Score</div>
        </div>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
        <strong>Privacy Note:</strong> Comparisons use coarse regional bins. No personal data is shared.
      </div>
    </div>
  );
}
