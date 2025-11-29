import React from 'react';
import { useCpuTemperature, celsiusToFahrenheit } from '../hooks/useCpuTemperature';
import { Thermometer, Cpu, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

/**
 * Display CPU temperature for thermostat bench testing
 * Shows both Celsius and Fahrenheit with connection status
 */
export default function CpuTemperatureDisplay({ compact = false, className = '' }) {
  const { temperature, loading, error, isConnected } = useCpuTemperature(2000);

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-gray-500 dark:text-gray-400 ${className}`}>
        <Thermometer className="w-4 h-4 animate-pulse" />
        <span className="text-sm">Reading CPU temp...</span>
      </div>
    );
  }

  if (error || !isConnected) {
    if (compact) {
      return (
        <div className={`flex items-center gap-2 text-gray-400 dark:text-gray-500 ${className}`}>
          <XCircle className="w-4 h-4" />
          <span className="text-xs">CPU temp offline</span>
        </div>
      );
    }
    
    return (
      <div className={`p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <AlertCircle className="w-5 h-5" />
          <div className="flex-1">
            <p className="text-sm font-medium">CPU Temperature Offline</p>
            <p className="text-xs mt-1">
              Start server: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">node server/temperature-server.js</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const mainTempC = temperature?.main || 0;
  const mainTempF = celsiusToFahrenheit(mainTempC);
  const maxTempC = temperature?.max || 0;
  const maxTempF = celsiusToFahrenheit(maxTempC);

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <CheckCircle className="w-4 h-4 text-green-500" />
        <Thermometer className="w-4 h-4 text-blue-500" />
        <span className="text-sm font-medium">
          {mainTempF?.toFixed(1)}°F
        </span>
        <span className="text-xs text-gray-500">({mainTempC?.toFixed(1)}°C)</span>
      </div>
    );
  }

  return (
    <div className={`p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800 ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            CPU Temperature (Bench Test)
          </h3>
        </div>
        <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
          <CheckCircle className="w-4 h-4" />
          <span className="text-xs">Live</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/50 dark:bg-gray-900/30 p-3 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Main Temp</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {mainTempF?.toFixed(1)}°F
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              ({mainTempC?.toFixed(1)}°C)
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Original: {temperature?.originalMain?.toFixed(1)}°C
          </p>
        </div>

        <div className="bg-white/50 dark:bg-gray-900/30 p-3 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Max Temp</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {maxTempF?.toFixed(1)}°F
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              ({maxTempC?.toFixed(1)}°C)
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Original: {temperature?.originalMax?.toFixed(1)}°C
          </p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          <span className="font-medium">Bench Test Mode:</span> Temperature ÷ 2 for thermostat simulation
        </p>
      </div>
    </div>
  );
}
