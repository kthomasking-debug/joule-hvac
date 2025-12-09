/**
 * SeasonModeToggle - Toggle between Heating/Cooling/Both/Auto modes
 */
import React from "react";
import { useSeason, SeasonMode } from "./SeasonProvider";
import { Thermometer, Snowflake, Sun, RefreshCw } from "lucide-react";

interface SeasonModeToggleProps {
  /** Hide the "Season:" label - just show buttons */
  compact?: boolean;
}

export const SeasonModeToggle: React.FC<SeasonModeToggleProps> = ({ compact = false }) => {
  const { seasonMode, setSeasonMode, autoDetectedMode } = useSeason();

  const modes: { value: SeasonMode; label: string; icon: React.ReactNode; color: string }[] = [
    {
      value: "auto",
      label: "Auto",
      icon: <RefreshCw size={16} />,
      color: "text-gray-400",
    },
    {
      value: "heating",
      label: "Heating",
      icon: <Snowflake size={16} />,
      color: "text-blue-400",
    },
    {
      value: "cooling",
      label: "Cooling",
      icon: <Sun size={16} />,
      color: "text-orange-400",
    },
    {
      value: "both",
      label: "Both",
      icon: <Thermometer size={16} />,
      color: "text-purple-400",
    },
  ];

  return (
    <div className="flex items-center gap-2">
      {!compact && <span className="text-xs text-gray-400 dark:text-gray-500 mr-1">Season:</span>}
      <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800">
        {modes.map((mode) => {
          const isActive = seasonMode === mode.value || (mode.value === "auto" && seasonMode === "auto");
          return (
            <button
              key={mode.value}
              onClick={() => setSeasonMode(mode.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                isActive
                  ? "bg-blue-600 text-white dark:bg-blue-500"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
              title={
                mode.value === "auto"
                  ? `Auto-detected: ${autoDetectedMode === "heating" ? "Heating" : autoDetectedMode === "cooling" ? "Cooling" : "Both"}`
                  : undefined
              }
            >
              {mode.icon}
              {mode.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

