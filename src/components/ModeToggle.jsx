import React from 'react';
import { Sparkles, LayoutGrid } from 'lucide-react';

/**
 * Mode Toggle Component
 * Switches between AI Mode (conversational, voice-first) and Traditional Mode (detailed dashboard)
 */
const ModeToggle = ({ currentMode, onToggle }) => {
  const isAIMode = currentMode === 'ai';

  return (
    <button
      onClick={onToggle}
      className="fixed top-4 right-4 z-50 group"
      title={isAIMode ? 'Switch to Traditional Mode' : 'Switch to AI Mode'}
      aria-label={isAIMode ? 'Switch to Traditional Mode' : 'Switch to AI Mode'}
    >
      <div className={`
        relative flex items-center gap-2 px-4 py-3 rounded-full
        backdrop-blur-lg border-2 transition-all duration-300 shadow-lg
        ${isAIMode 
          ? 'bg-purple-600/90 border-purple-400 hover:bg-purple-500' 
          : 'bg-blue-600/90 border-blue-400 hover:bg-blue-500'
        }
      `}>
        {/* Icon that changes based on mode */}
        <div className="relative">
          {isAIMode ? (
            <LayoutGrid className="text-white" size={20} />
          ) : (
            <Sparkles className="text-white animate-pulse" size={20} />
          )}
        </div>

        {/* Mode label */}
        <span className="text-white font-medium text-sm hidden sm:inline">
          {isAIMode ? 'Traditional' : 'AI Mode'}
        </span>

        {/* Animated background glow */}
        <div className={`
          absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300
          ${isAIMode ? 'bg-purple-400' : 'bg-blue-400'}
          blur-xl -z-10
        `} />
      </div>

      {/* Tooltip for mobile */}
      <div className="absolute top-full mt-2 right-0 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap sm:hidden">
        {isAIMode ? 'Switch to Traditional Mode' : 'Switch to AI Mode'}
      </div>
    </button>
  );
};

export default ModeToggle;
