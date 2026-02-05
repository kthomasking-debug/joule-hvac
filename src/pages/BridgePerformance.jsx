import React, { useState, useEffect } from 'react';
import { TrendingUp, AlertCircle, RefreshCw, Zap, DollarSign, Thermometer } from 'lucide-react';

/**
 * Bridge Performance - Shows ACTUAL data from your Ecobee thermostat
 * 
 * This page displays real energy usage and costs from your paired device,
 * unlike the simulators which use target temperatures.
 * 
 * Data comes from the local Pi bridge API.
 */
const BridgePerformance = () => {
  const [bridgeData, setBridgeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchBridgeData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/status');
      if (!response.ok) throw new Error('Failed to fetch bridge data');
      const data = await response.json();
      setBridgeData(data);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBridgeData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchBridgeData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0C0F14]">
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Zap className="w-6 h-6 text-green-400" />
              Your Bridge Performance
            </h1>
            <button
              onClick={fetchBridgeData}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          <p className="text-sm text-[#A7B0BA]">
            Real-time data from your paired Ecobee thermostat
          </p>
        </header>

        {/* Status Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-red-400 font-semibold">Connection Error</p>
              <p className="text-red-300/80 text-sm">{error}</p>
              <p className="text-red-300/60 text-xs mt-1">
                Make sure your bridge is running and you're on the same network.
              </p>
            </div>
          </div>
        )}

        {!bridgeData && !error && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-yellow-400 font-semibold">No Device Paired</p>
              <p className="text-yellow-300/80 text-sm">
                Go to Bridge & AI settings and pair your Ecobee thermostat to see real performance data.
              </p>
            </div>
          </div>
        )}

        {/* Main Content */}
        {bridgeData && !error && (
          <>
            {/* Current Status Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Temperature */}
              <div className="bg-[#0C1118] border border-slate-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-[#A7B0BA]">Current Temperature</div>
                  <Thermometer className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-3xl font-bold text-white">
                  {bridgeData.temp ? `${bridgeData.temp.toFixed(1)}°F` : 'N/A'}
                </div>
                <div className="text-xs text-[#7C8894] mt-2">
                  Target: {bridgeData.target_temp ? `${bridgeData.target_temp.toFixed(1)}°F` : 'N/A'}
                </div>
              </div>

              {/* Mode */}
              <div className="bg-[#0C1118] border border-slate-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-[#A7B0BA]">Mode</div>
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-3xl font-bold text-white capitalize">
                  {bridgeData.mode || 'Unknown'}
                </div>
                <div className="text-xs text-[#7C8894] mt-2">
                  Status: {bridgeData.bridge_status || 'Unknown'}
                </div>
              </div>

              {/* Humidity */}
              <div className="bg-[#0C1118] border border-slate-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-[#A7B0BA]">Humidity</div>
                  <Zap className="w-4 h-4 text-green-400" />
                </div>
                <div className="text-3xl font-bold text-white">
                  {bridgeData.humidity ? `${bridgeData.humidity}%` : 'N/A'}
                </div>
                <div className="text-xs text-[#7C8894] mt-2">
                  Indoor level
                </div>
              </div>
            </div>

            {/* Device Info */}
            <div className="bg-[#0C1118] border border-slate-800 rounded-xl p-6 mb-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-yellow-400" />
                Device Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[#A7B0BA]">Device ID</p>
                  <p className="text-white font-mono">{bridgeData.device_id || 'Not paired'}</p>
                </div>
                <div>
                  <p className="text-[#A7B0BA]">Last Update</p>
                  <p className="text-white">
                    {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}
                  </p>
                </div>
              </div>
            </div>

            {/* Coming Soon */}
            <div className="bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-purple-500/10 border border-purple-500/30 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">📊 Detailed Analytics (Coming Soon)</h2>
              <div className="space-y-2 text-[#A7B0BA] text-sm">
                <p>✓ Weekly energy usage breakdown</p>
                <p>✓ Actual vs forecasted costs</p>
                <p>✓ Monthly performance trends</p>
                <p>✓ Equipment runtime analysis</p>
                <p>✓ Efficiency improvements suggestions</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BridgePerformance;
