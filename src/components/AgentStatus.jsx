import React from 'react';
import { Activity } from 'lucide-react';

export default function AgentStatus({ lastGoal, isActive }) {
  if (!lastGoal && !isActive) return null;

  return (
    <div className="fixed bottom-20 right-4 z-40 max-w-xs">
      <div className={`rounded-lg shadow-lg p-3 ${isActive ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700' : 'bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700'}`}>
        <div className="flex items-center gap-2">
          <Activity className={`w-4 h-4 ${isActive ? 'animate-pulse text-blue-600 dark:text-blue-400' : 'text-gray-500'}`} />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {isActive ? 'Agent Running' : 'Last Agent Task'}
            </div>
            {lastGoal && (
              <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                {lastGoal}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
