import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Droplet, 
  Wind, 
  Activity, 
  Gauge, 
  Eye, 
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { useProstatRelay } from '../hooks/useProstatRelay';
import { useBlueair } from '../hooks/useBlueair';
import { useJouleBridgeContext } from '../contexts/JouleBridgeContext';
import { useEcobee } from '../hooks/useEcobee';
import { getEcobeeCredentials } from '../lib/ecobeeApi';
import { getPollenData } from '../lib/pollenApi';
import { fetchGeocodeCandidates, chooseBestCandidate } from '../utils/geocode';

/**
 * Air Quality HMI - Control and monitor dehumidifier and Blueair
 * Displays pollen count, humidity, motion, and provides controls
 */
export default function AirQualityHMI() {
  const navigate = useNavigate();
  
  // Integration hooks - use shared context (persists across navigation)
  const jouleBridge = useJouleBridgeContext();
  const bridgeAvailable = jouleBridge.bridgeAvailable;
  const prostatRelay = useProstatRelay(2, 5000);
  const blueair = useBlueair(0, 10000);
  const ecobeeCredentials = getEcobeeCredentials();
  const useEcobeeIntegration = !!(ecobeeCredentials.apiKey && ecobeeCredentials.accessToken);
  const ecobee = useEcobee(null, 30000);
  
  // Pollen/AQI data
  const [pollenData, setPollenData] = useState(null);
  const [pollenLoading, setPollenLoading] = useState(false);
  const [pollenError, setPollenError] = useState(null);
  const [aqiData, setAqiData] = useState(null);
  const [locationQuery, setLocationQuery] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  
  // Motion sensor data
  const [motionDetected, setMotionDetected] = useState(false);
  const [lastMotionTime, setLastMotionTime] = useState(null);
  
  // Fetch pollen count and AQI
  const fetchPollenData = useCallback(async () => {
    setPollenLoading(true);
    setPollenError(null);
    
    try {
      const data = await getPollenData();
      setPollenData(data);
    } catch (error) {
      console.error('Error fetching pollen data:', error);
      setPollenError(error.message);
      // Fallback to mock data on error
      setPollenData({
        pollen: {
          tree: Math.floor(Math.random() * 5) + 1,
          grass: Math.floor(Math.random() * 5) + 1,
          weed: Math.floor(Math.random() * 5) + 1,
        },
        aqi: Math.floor(Math.random() * 50) + 50,
        timestamp: new Date().toISOString(),
        source: 'mock',
      });
    } finally {
      setPollenLoading(false);
    }
  }, []);

  // Load saved location (if present)
  useEffect(() => {
    try {
      const locRaw = localStorage.getItem('userLocation');
      if (locRaw) {
        const loc = JSON.parse(locRaw);
        if (loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
          setUserLocation(loc);
        }
      }
    } catch {}
  }, []);
  
  // Fetch pollen data on mount and periodically
  useEffect(() => {
    fetchPollenData();
    const interval = setInterval(fetchPollenData, 300000); // Every 5 minutes
    return () => clearInterval(interval);
  }, [fetchPollenData]);

  // Fetch AQI via Open-Meteo Air Quality API when location is available
  const fetchAQIOpenMeteo = useCallback(async (lat, lon) => {
    try {
      const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm2_5,pm10,us_aqi&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Open-Meteo AQ failed');
      const data = await res.json();
      const hourly = data?.hourly || {};
      const idx = (hourly.time && Array.isArray(hourly.time)) ? hourly.time.length - 1 : -1;
      const pm25 = idx >= 0 && hourly.pm2_5 ? hourly.pm2_5[idx] : null;
      const pm10 = idx >= 0 && hourly.pm10 ? hourly.pm10[idx] : null;
      const usAqi = idx >= 0 && hourly.us_aqi ? hourly.us_aqi[idx] : null;
      setAqiData({ pm25, pm10, usAqi, source: 'open-meteo' });
      // If our pollenData exists, merge AQI value in for unified display
      setPollenData(prev => {
        if (!prev) return { pollen: {}, aqi: usAqi ?? null, timestamp: new Date().toISOString(), source: 'open-meteo' };
        return { ...prev, aqi: usAqi ?? prev.aqi, source: prev.source || 'open-meteo' };
      });
    } catch (e) {
      console.warn('Open-Meteo AQ fetch failed:', e);
    }
  }, []);

  useEffect(() => {
    if (userLocation?.latitude && userLocation?.longitude) {
      fetchAQIOpenMeteo(userLocation.latitude, userLocation.longitude);
    }
  }, [userLocation, fetchAQIOpenMeteo]);
  
  // Get humidity from active integration
  const indoorHumidity = bridgeAvailable && jouleBridge.connected
    ? jouleBridge.humidity
    : (useEcobeeIntegration && ecobee.humidity !== null
      ? ecobee.humidity
      : null);
  
  // Get motion data from Ecobee sensors
  useEffect(() => {
    if (useEcobeeIntegration && ecobee.thermostatData) {
      const motion = ecobee.thermostatData.motionDetected || false;
      setMotionDetected(motion);
      if (motion && ecobee.thermostatData.motionSensors) {
        // Get most recent motion timestamp
        const sensors = ecobee.thermostatData.motionSensors.filter(s => s.motion);
        if (sensors.length > 0) {
          const latest = sensors.sort((a, b) => 
            new Date(b.lastUpdate || 0) - new Date(a.lastUpdate || 0)
          )[0];
          if (latest.lastUpdate) {
            setLastMotionTime(new Date(latest.lastUpdate));
          }
        }
      }
    } else if (bridgeAvailable && jouleBridge.connected && jouleBridge.thermostatData) {
      // Get motion from Joule Bridge (if available)
      const motion = jouleBridge.thermostatData.motionDetected || false;
      setMotionDetected(motion);
    } else {
      // Fallback: simulate based on time of day
      const hour = new Date().getHours();
      const simulatedMotion = hour >= 7 && hour <= 22; // Active during day
      setMotionDetected(simulatedMotion);
      if (simulatedMotion) {
        setLastMotionTime(new Date());
      }
    }
  }, [useEcobeeIntegration, ecobee.thermostatData, bridgeAvailable, jouleBridge.connected, jouleBridge.thermostatData]);
  
  // Calculate overall air quality score
  const airQualityScore = useCallback(() => {
    let score = 100;
    
    // Deduct points for high humidity
    if (indoorHumidity !== null) {
      if (indoorHumidity > 60) score -= 20;
      else if (indoorHumidity > 55) score -= 10;
    }
    
    // Deduct points for high pollen
    if (pollenData) {
      const maxPollen = Math.max(
        pollenData.pollen?.tree || 0,
        pollenData.pollen?.grass || 0,
        pollenData.pollen?.weed || 0
      );
      if (maxPollen >= 5) score -= 30;
      else if (maxPollen >= 4) score -= 20;
      else if (maxPollen >= 3) score -= 10;
    }
    
    // Deduct points for high AQI
    if (pollenData?.aqi) {
      if (pollenData.aqi > 100) score -= 30;
      else if (pollenData.aqi > 75) score -= 15;
    }
    
    return Math.max(0, Math.min(100, score));
  }, [indoorHumidity, pollenData]);
  
  const score = airQualityScore();
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };
  
  const getScoreLabel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-2">
            Air Quality Control Center
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor and control dehumidifier, air purifier, and environmental conditions
          </p>
        </div>
        
        {/* Overall Air Quality Score */}
        <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                Overall Air Quality
              </h2>
              <div className="flex items-baseline gap-3">
                <span className={`text-5xl font-bold ${getScoreColor(score)}`}>
                  {score}
                </span>
                <span className="text-xl text-gray-600 dark:text-gray-400">
                  / 100
                </span>
              </div>
              <p className={`text-lg font-semibold mt-2 ${getScoreColor(score)}`}>
                {getScoreLabel(score)}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Status
              </div>
              <div className="flex items-center gap-2">
                {bridgeAvailable && jouleBridge.connected ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                )}
                <span className="text-sm font-medium">
                  {bridgeAvailable ? 'ProStat Bridge Connected' : 'Bridge Offline'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Dehumidifier Control */}
          <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <Droplet className="w-6 h-6 text-blue-600" />
                Dehumidifier
              </h2>
              {prostatRelay.connected ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              )}
            </div>
            
            {/* Humidity Display */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Indoor Humidity</span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {indoorHumidity !== null ? `${indoorHumidity}%` : 'N/A'}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (indoorHumidity || 0))}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span className="font-semibold">Target: 50%</span>
                <span>100%</span>
              </div>
            </div>
            
            {/* Relay Status */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Relay Status
                </span>
                <span className={`text-sm font-bold ${
                  prostatRelay.relayOn 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-gray-500'
                }`}>
                  {prostatRelay.relayOn ? 'ON' : 'OFF'}
                </span>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {prostatRelay.connected 
                  ? 'Connected to ProStat Bridge' 
                  : 'Not connected'}
              </div>
            </div>
            
            {/* Controls */}
            <div className="space-y-2">
              <button
                onClick={() => prostatRelay.turnOn()}
                disabled={!prostatRelay.connected || prostatRelay.relayOn}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Turn On
              </button>
              <button
                onClick={() => prostatRelay.turnOff()}
                disabled={!prostatRelay.connected || !prostatRelay.relayOn}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Turn Off
              </button>
            </div>
            
            {prostatRelay.error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-300">
                  {prostatRelay.error}
                </p>
              </div>
            )}
          </div>
          
          {/* Blueair Control */}
          <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <Wind className="w-6 h-6 text-purple-600" />
                Air Purifier
              </h2>
              {blueair.connected ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              )}
            </div>
            
            {/* Fan Speed Display */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Fan Speed</span>
                <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                  {blueair.fanSpeed === 0 ? 'Off' :
                   blueair.fanSpeed === 1 ? 'Low' :
                   blueair.fanSpeed === 2 ? 'Medium' : 'Max'}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-purple-500 to-purple-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${(blueair.fanSpeed / 3) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Off</span>
                <span>Low</span>
                <span>Medium</span>
                <span>Max</span>
              </div>
            </div>
            
            {/* LED Brightness */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">LED Brightness</span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {blueair.ledBrightness}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-yellow-400 to-yellow-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${blueair.ledBrightness}%` }}
                />
              </div>
            </div>
            
            {/* Controls */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={() => blueair.setLow()}
                disabled={!blueair.connected}
                className="px-3 py-2 bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-200 rounded-lg hover:bg-purple-300 dark:hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Low
              </button>
              <button
                onClick={() => blueair.setMedium()}
                disabled={!blueair.connected}
                className="px-3 py-2 bg-purple-300 dark:bg-purple-700 text-purple-800 dark:text-purple-100 rounded-lg hover:bg-purple-400 dark:hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Medium
              </button>
              <button
                onClick={() => blueair.setMax()}
                disabled={!blueair.connected}
                className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Max
              </button>
              <button
                onClick={() => blueair.setOff()}
                disabled={!blueair.connected}
                className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Off
              </button>
            </div>
            
            {/* LED Controls */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={() => blueair.setLEDOff()}
                disabled={!blueair.connected}
                className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                LED Off
              </button>
              <button
                onClick={() => blueair.setLEDOn()}
                disabled={!blueair.connected}
                className="px-3 py-2 bg-yellow-200 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-200 rounded-lg hover:bg-yellow-300 dark:hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                LED On
              </button>
            </div>
            
            {/* Dust Kicker */}
            <button
              onClick={() => blueair.startDustKicker()}
              disabled={!blueair.connected}
              className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              🧹 Start Dust Kicker Cycle
            </button>
            
            {blueair.error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-300">
                  {blueair.error}
                </p>
              </div>
            )}
          </div>
          
          {/* Environmental Data */}
          <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <Activity className="w-6 h-6 text-green-600" />
                Environment
              </h2>
              <button
                onClick={fetchPollenData}
                disabled={pollenLoading}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-gray-400 ${pollenLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Location input (optional) */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Location</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  placeholder={userLocation ? `${userLocation.name || 'Saved location'}` : 'City, State or ZIP'}
                  className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-100"
                />
                <button
                  onClick={async () => {
                    try {
                      if (!locationQuery.trim()) return;
                      const candidates = await fetchGeocodeCandidates(locationQuery.trim());
                      const best = chooseBestCandidate(candidates);
                      if (best) {
                        const loc = { name: `${best.name}, ${best.admin1 || best.country || ''}`.trim(), latitude: best.latitude, longitude: best.longitude };
                        setUserLocation(loc);
                        localStorage.setItem('userLocation', JSON.stringify(loc));
                        fetchAQIOpenMeteo(best.latitude, best.longitude);
                      }
                    } catch (e) {
                      console.warn('Location search failed:', e);
                    }
                  }}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Set
                </button>
              </div>
              {userLocation && (
                <div className="mt-1 text-xs text-gray-500">
                  Using: {userLocation.name || `${userLocation.latitude.toFixed(3)}, ${userLocation.longitude.toFixed(3)}`}
                </div>
              )}
            </div>
            
            {/* Pollen Count */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Pollen Count
              </h3>
              {pollenLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : pollenError ? (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {pollenError}
                  </p>
                </div>
              ) : pollenData ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Tree</span>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${
                              i < (pollenData.pollen?.tree || 0)
                                ? 'bg-yellow-500'
                                : 'bg-gray-200 dark:bg-gray-700'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {pollenData.pollen?.tree || 0}/5
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Grass</span>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${
                              i < (pollenData.pollen?.grass || 0)
                                ? 'bg-green-500'
                                : 'bg-gray-200 dark:bg-gray-700'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {pollenData.pollen?.grass || 0}/5
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Weed</span>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${
                              i < (pollenData.pollen?.weed || 0)
                                ? 'bg-red-500'
                                : 'bg-gray-200 dark:bg-gray-700'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {pollenData.pollen?.weed || 0}/5
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No data available</p>
              )}
            </div>
            
            {/* AQI */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Air Quality Index (AQI)
              </h3>
              {pollenData?.aqi ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                      {pollenData.aqi}
                    </span>
                    <span className={`text-sm font-medium ${
                      pollenData.aqi <= 50 ? 'text-green-600' :
                      pollenData.aqi <= 100 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {pollenData.aqi <= 50 ? 'Good' :
                       pollenData.aqi <= 100 ? 'Moderate' :
                       'Unhealthy'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        pollenData.aqi <= 50 ? 'bg-green-500' :
                        pollenData.aqi <= 100 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, (pollenData.aqi / 200) * 100)}%` }}
                    />
                  </div>
                  {aqiData && (
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded">
                        PM2.5: <span className="font-semibold text-gray-800 dark:text-gray-200">{aqiData.pm25 ?? 'N/A'}</span>
                      </div>
                      <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded">
                        PM10: <span className="font-semibold text-gray-800 dark:text-gray-200">{aqiData.pm10 ?? 'N/A'}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No data available</p>
              )}
            </div>
            
            {/* Motion Sensor */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Motion Detection
              </h3>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center gap-2">
                  {motionDetected ? (
                    <Activity className="w-5 h-5 text-green-600 animate-pulse" />
                  ) : (
                    <Minus className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {motionDetected ? 'Motion Detected' : 'No Motion'}
                  </span>
                </div>
                {lastMotionTime && (
                  <span className="text-xs text-gray-500">
                    {new Date(lastMotionTime).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Status Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Dehumidifier Status */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Dehumidifier
              </span>
              <span className={`text-xs font-bold px-2 py-1 rounded ${
                prostatRelay.relayOn
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                {prostatRelay.relayOn ? 'ACTIVE' : 'IDLE'}
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
              {prostatRelay.relayOn ? 'Running' : 'Stopped'}
            </div>
            {prostatRelay.systemState && (
              <div className="text-xs text-gray-500 mt-1">
                {prostatRelay.systemState.interlock_result?.reason || 'Normal operation'}
              </div>
            )}
          </div>
          
          {/* Blueair Status */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Air Purifier
              </span>
              <span className={`text-xs font-bold px-2 py-1 rounded ${
                blueair.fanSpeed > 0
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                {blueair.fanSpeed > 0 ? 'ACTIVE' : 'IDLE'}
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
              {blueair.fanSpeed === 0 ? 'Off' :
               blueair.fanSpeed === 1 ? 'Low' :
               blueair.fanSpeed === 2 ? 'Medium' : 'Max'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              LED: {blueair.ledBrightness}%
            </div>
          </div>
          
          {/* System Health */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                System Health
              </span>
              <Gauge className="w-5 h-5 text-blue-600" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Bridge</span>
                <span className={bridgeAvailable ? 'text-green-600' : 'text-red-600'}>
                  {bridgeAvailable ? '✓' : '✗'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Relay</span>
                <span className={prostatRelay.connected ? 'text-green-600' : 'text-red-600'}>
                  {prostatRelay.connected ? '✓' : '✗'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Blueair</span>
                <span className={blueair.connected ? 'text-green-600' : 'text-red-600'}>
                  {blueair.connected ? '✓' : '✗'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

