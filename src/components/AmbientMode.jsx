// src/components/AmbientMode.jsx
// Far-field readable display for wall-mounted tablets

import React, { useState, useEffect } from 'react';
import { Mic } from 'lucide-react';
import { useUnitSystem, formatTemperatureFromF } from '../lib/units';

export default function AmbientMode({ 
  currentTemp = 72,
  targetTemp = 68,
  isActive = false,
  onTap 
}) {
  const [showDetails, setShowDetails] = useState(false);
  const { unitSystem } = useUnitSystem();

  useEffect(() => {
    if (!isActive) return;

    // Auto-hide details after 3 seconds of inactivity
    const timer = setTimeout(() => {
      setShowDetails(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [showDetails, isActive]);

  if (!isActive) return null;

  const tempDiff = currentTemp - targetTemp;
  const statusColor = Math.abs(tempDiff) < 2 ? 'text-green-400' : 'text-orange-400';

  return (
    <div 
      className="fixed inset-0 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 z-50 flex flex-col items-center justify-center cursor-pointer"
      onClick={() => {
        if (onTap) onTap();
        setShowDetails(true);
      }}
    >
      {/* Current temperature - massive display */}
      <div className="text-center mb-8">
        <div className={`text-[12rem] font-bold leading-none ${statusColor}`}>
          {formatTemperatureFromF(currentTemp, unitSystem, { decimals: 0, withUnit: false })}
          <span className="text-[6rem]">{unitSystem === "intl" ? "°C" : "°F"}</span>
        </div>
        <div className="text-4xl text-gray-400 mt-4">
          Current Temperature
        </div>
      </div>

      {/* Target temperature */}
      <div className="text-center mb-12">
        <div className="text-5xl text-gray-500">
          Target: <span className="text-white font-semibold">
            {formatTemperatureFromF(targetTemp, unitSystem, { decimals: 0 })}
          </span>
        </div>
      </div>

      {/* Microphone prompt - pulsing */}
      <div className="flex flex-col items-center gap-6 animate-pulse">
        <div className="w-32 h-32 rounded-full bg-blue-600/30 flex items-center justify-center">
          <Mic size={64} className="text-blue-400" />
        </div>
        <div className="text-3xl text-gray-400 font-light">
          Say "Hey Joule" or tap screen
        </div>
      </div>

      {/* Status details (fade in on interaction) */}
      {showDetails && (
        <div className="absolute bottom-12 left-0 right-0 text-center animate-fadeIn">
          <div className="text-2xl text-gray-400">
            {tempDiff > 0 && `${formatTemperatureFromF(tempDiff, unitSystem, { decimals: 0, withUnit: false })}°${unitSystem === "intl" ? "C" : "F"} warmer than target`}
            {tempDiff < 0 && `${formatTemperatureFromF(Math.abs(tempDiff), unitSystem, { decimals: 0, withUnit: false })}°${unitSystem === "intl" ? "C" : "F"} cooler than target`}
            {tempDiff === 0 && 'Right on target'}
          </div>
        </div>
      )}
    </div>
  );
}
