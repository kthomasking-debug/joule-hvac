import React from 'react';
import { useTemperature } from '../hooks/useTemperature';
import { celsiusToFahrenheit } from '../hooks/useCpuTemperature';
import { Thermometer, Cpu, AlertCircle, CheckCircle, XCircle, Wifi } from 'lucide-react';

/**
 * Display temperature for thermostat bench testing
 * Supports both CPU and Ecobee sources with source selection
 */
export default function TemperatureDisplay({ compact = false, className = '' }) {
  const { temperature, loading, error, isConnected, source, setSource } = useTemperature('cpu', 2000);

  if (loading) {
    return (
      <div data-testid="temperature-display" className={`flex items-center gap-2 text-gray-500 dark:text-gray-400 ${className}`}>
        <Thermometer className="w-4 h-4 animate-pulse" />
        <span className="text-sm">Reading temperature...</span>
      </div>
    );
  }

  if (error || !isConnected) {
    if (compact) {
      return (
        <div data-testid="temperature-display" className={`flex items-center gap-2 text-gray-400 dark:text-gray-500 ${className}`}>
          <XCircle className="w-4 h-4" />
          <span className="text-xs">{source} temp offline</span>
        </div>
      );
    }
    
    return (
      <div data-testid="temperature-display" className={`p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <AlertCircle className="w-5 h-5" />
          <div className="flex-1">
            <p className="text-sm font-medium">Temperature Offline</p>
            <p className="text-xs mt-1">
              {source === 'ecobee' ? (
                <>Ecobee not connected. Check IFTTT webhook or use manual update.</>
              ) : (
                <>Start server: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">npm run temp-server</code></>
              )}
            </p>
            <div className="mt-2">
              <SourceSelector source={source} setSource={setSource} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isEcobee = source === 'ecobee';
  const mainTemp = isEcobee ? temperature?.temperature : temperature?.main;
  const mainTempC = mainTemp || 0;
  const mainTempF = isEcobee ? mainTemp : celsiusToFahrenheit(mainTempC);
  const maxTempC = temperature?.max || 0;
  const maxTempF = celsiusToFahrenheit(maxTempC);
  const humidity = temperature?.humidity;
  const hvacMode = temperature?.hvacMode;

  if (compact) {
    return (
      <div data-testid="temperature-display" className={`flex items-center gap-2 ${className}`}>
        <CheckCircle className="w-4 h-4 text-green-500" />
        {isEcobee ? <Wifi className="w-4 h-4 text-indigo-500" /> : <Cpu className="w-4 h-4 text-blue-500" />}
        <span data-testid="temperature-value" className="text-sm font-medium">
          {mainTempF?.toFixed(1)}°F
        </span>
        {!isEcobee && <span className="text-xs text-gray-500">({mainTempC?.toFixed(1)}°C)</span>}
        {humidity && <span className="text-xs text-gray-500 ml-2">{humidity}% RH</span>}
      </div>
    );
  }

  return (
    <div data-testid="temperature-display" className={`p-4 bg-gradient-to-br ${isEcobee ? 'from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20' : 'from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20'} rounded-lg border ${isEcobee ? 'border-indigo-200 dark:border-indigo-800' : 'border-blue-200 dark:border-blue-800'} ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {isEcobee ? (
            <Wifi className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          ) : (
            <Cpu className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          )}
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {isEcobee ? 'Ecobee Thermostat' : 'CPU Temperature'} (Bench Test)
          </h3>
        </div>
        <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
          <CheckCircle className="w-4 h-4" />
          <span className="text-xs">Live</span>
        </div>
      </div>

      <SourceSelector source={source} setSource={setSource} />

      <div className="grid grid-cols-2 gap-4 mt-3">
        <div className="bg-white/50 dark:bg-gray-900/30 p-3 rounded-lg">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
            {isEcobee ? 'Temperature' : 'Main Temp'}
          </div>
          <div data-testid="temperature-value" className="text-2xl font-bold text-gray-900 dark:text-white">
            {mainTempF?.toFixed(1)}°F
          </div>
          {!isEcobee && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {mainTempC?.toFixed(1)}°C
            </div>
          )}
        </div>

        {!isEcobee && (
          <div className="bg-white/50 dark:bg-gray-900/30 p-3 rounded-lg">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Max Temp</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {maxTempF?.toFixed(1)}°F
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {maxTempC?.toFixed(1)}°C
            </div>
          </div>
        )}

        {isEcobee && humidity && (
          <div className="bg-white/50 dark:bg-gray-900/30 p-3 rounded-lg">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Humidity</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {humidity}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Relative</div>
          </div>
        )}
      </div>

      {isEcobee && hvacMode && (
        <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
          HVAC Mode: <span className="font-medium">{hvacMode}</span>
        </div>
      )}

      {!isEcobee && temperature?.originalMain && (
        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Original CPU: {temperature.originalMain.toFixed(1)}°C 
          (÷2 for bench test = {mainTempC.toFixed(1)}°C)
        </div>
      )}

      {isEcobee && temperature?.lastUpdate && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Last update: {new Date(temperature.lastUpdate).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

function SourceSelector({ source, setSource }) {
  return (
    <div className="flex gap-2 mb-2">
      <button
        onClick={() => setSource('cpu')}
        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
          source === 'cpu'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
        }`}
      >
        <Cpu className="w-3 h-3 inline mr-1" />
        CPU
      </button>
      <button
        onClick={() => setSource('ecobee')}
        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
          source === 'ecobee'
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
        }`}
      >
        <Wifi className="w-3 h-3 inline mr-1" />
        Ecobee
      </button>
    </div>
  );
}
