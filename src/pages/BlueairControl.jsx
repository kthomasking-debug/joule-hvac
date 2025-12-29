import React, { useState, useEffect } from 'react';
import { 
  Wind, 
  Lightbulb, 
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Power,
  PowerOff,
  Settings,
} from 'lucide-react';
import { useBlueair } from '../hooks/useBlueair';
import { useJouleBridgeContext } from '../contexts/JouleBridgeContext';
import { Link } from 'react-router-dom';

/**
 * Blueair Air Purifier Control Page
 * Dedicated page for controlling Blueair air purifiers via Joule Bridge
 */
export default function BlueairControl() {
  const jouleBridge = useJouleBridgeContext();
  const [bridgeAvailable, setBridgeAvailable] = useState(jouleBridge.bridgeAvailable);
  
  const [deviceIndex, setDeviceIndex] = useState(0);
  const blueair = useBlueair(deviceIndex, 5000); // Poll every 5 seconds
  
  // Configuration form state
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [configType, setConfigType] = useState('local'); // 'local' or 'cloud'
  const [macAddress, setMacAddress] = useState('');
  const [localIp, setLocalIp] = useState('');
  const [cloudUsername, setCloudUsername] = useState('');
  const [cloudPassword, setCloudPassword] = useState('');
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState(null);
  const [configSuccess, setConfigSuccess] = useState(false);
  
  // Recheck bridge availability when page loads (in case URL was just configured)
  useEffect(() => {
    // Update local state when context changes
    setBridgeAvailable(jouleBridge.bridgeAvailable);
    
    // Also trigger a fresh health check
    if (jouleBridge.checkHealth) {
      jouleBridge.checkHealth().then(available => {
        setBridgeAvailable(available);
      });
    }
  }, [jouleBridge.bridgeAvailable, jouleBridge.checkHealth]);
  
  const [isChanging, setIsChanging] = useState(false);
  const [lastAction, setLastAction] = useState(null);

  const handleFanSpeed = async (speed) => {
    setIsChanging(true);
    setLastAction(null);
    try {
      await blueair.setFan(speed);
      setLastAction({ type: 'fan', value: speed, success: true });
      setTimeout(() => setLastAction(null), 2000);
    } catch (err) {
      setLastAction({ type: 'fan', value: speed, success: false, error: err.message });
    } finally {
      setIsChanging(false);
    }
  };

  const handleLEDBrightness = async (brightness) => {
    setIsChanging(true);
    setLastAction(null);
    try {
      await blueair.setLED(brightness);
      setLastAction({ type: 'led', value: brightness, success: true });
      setTimeout(() => setLastAction(null), 2000);
    } catch (err) {
      setLastAction({ type: 'led', value: brightness, success: false, error: err.message });
    } finally {
      setIsChanging(false);
    }
  };

  const handleDustKicker = async () => {
    setIsChanging(true);
    setLastAction(null);
    try {
      await blueair.startDustKicker();
      setLastAction({ type: 'dust-kicker', success: true });
      setTimeout(() => setLastAction(null), 3000);
    } catch (err) {
      setLastAction({ type: 'dust-kicker', success: false, error: err.message });
    } finally {
      setIsChanging(false);
    }
  };

  const getSpeedLabel = (speed) => {
    switch (speed) {
      case 0: return 'Off';
      case 1: return 'Low';
      case 2: return 'Medium';
      case 3: return 'Max';
      default: return 'Unknown';
    }
  };

  const getSpeedColor = (speed) => {
    switch (speed) {
      case 0: return 'text-gray-500';
      case 1: return 'text-blue-500';
      case 2: return 'text-purple-500';
      case 3: return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  // Load existing configuration when form opens
  useEffect(() => {
    if (showConfigForm && bridgeAvailable) {
      const loadConfig = async () => {
        try {
          const config = await getBlueairCredentials();
          if (config) {
            if (config.mac_address) {
              setMacAddress(config.mac_address);
              setConfigType('local');
            }
            if (config.local_ip) {
              setLocalIp(config.local_ip);
              setConfigType('local');
            }
            if (config.username) {
              setCloudUsername(config.username);
              setConfigType('cloud');
            }
          }
        } catch (err) {
          // Ignore errors - form will start empty
        }
      };
      loadConfig();
    }
  }, [showConfigForm, bridgeAvailable]);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setConfigLoading(true);
    setConfigError(null);
    setConfigSuccess(false);

    try {
      if (configType === 'local') {
        // Local ESP32 configuration
        if (!macAddress && !localIp) {
          setConfigError('Please enter either MAC address or IP address');
          setConfigLoading(false);
          return;
        }
        await setBlueairLocalConfig(macAddress || null, localIp || null);
        setConfigSuccess(true);
        setTimeout(() => {
          setShowConfigForm(false);
          blueair.refresh();
        }, 2000);
      } else {
        // Cloud API configuration
        if (!cloudUsername || !cloudPassword) {
          setConfigError('Username and password are required');
          setConfigLoading(false);
          return;
        }
        await setBlueairCredentials(cloudUsername, cloudPassword);
        setConfigSuccess(true);
        setTimeout(() => {
          setShowConfigForm(false);
          blueair.refresh();
        }, 2000);
      }
    } catch (err) {
      setConfigError(err.message || 'Failed to save configuration');
    } finally {
      setConfigLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
            <Wind className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            Blueair Air Purifier Control
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Control your Blueair air purifier connected via Joule Bridge
          </p>
        </div>

        {/* Bridge Connection Status */}
        {!bridgeAvailable && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Joule Bridge is not connected. Go to{' '}
                <Link to="/config#joule-bridge" className="underline font-semibold hover:text-yellow-900 dark:hover:text-yellow-100">
                  Settings → Joule Bridge Settings
                </Link>
                {' '}to configure your bridge.
              </p>
            </div>
          </div>
        )}

        {/* Device Selection */}
        {blueair.devicesCount > 1 && (
          <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Device ({blueair.devicesCount} available)
            </label>
            <select
              value={deviceIndex}
              onChange={(e) => setDeviceIndex(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {Array.from({ length: blueair.devicesCount }, (_, i) => (
                <option key={i} value={i}>
                  Device {i + 1}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Connection Status */}
        <div className={`mb-6 p-4 rounded-lg border ${
          blueair.connected
            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
            : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {blueair.connected ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              )}
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {blueair.connected ? 'Connected' : 'Not Connected'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {blueair.connected 
                    ? `Device ${deviceIndex + 1} is connected and ready`
                    : (
                      <>
                        {blueair.error || 'Blueair not configured. '}
                        <button
                          onClick={() => setShowConfigForm(true)}
                          className="inline-flex items-center gap-1 underline font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                        >
                          <Settings className="w-4 h-4" />
                          Configure Blueair Device
                        </button>
                      </>
                    )}
                </p>
              </div>
            </div>
            <button
              onClick={() => blueair.refresh()}
              disabled={blueair.loading}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 text-gray-600 dark:text-gray-400 ${blueair.loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Main Control Panel */}
        {blueair.connected && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fan Speed Control */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Wind className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Fan Speed
                </h2>
              </div>

              {/* Current Speed Display */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Current Speed</span>
                  <span className={`text-2xl font-bold ${getSpeedColor(blueair.fanSpeed)}`}>
                    {getSpeedLabel(blueair.fanSpeed)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-4 rounded-full transition-all duration-300"
                    style={{ width: `${(blueair.fanSpeed / 3) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
                  <span>Off</span>
                  <span>Low</span>
                  <span>Medium</span>
                  <span>Max</span>
                </div>
              </div>

              {/* Speed Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleFanSpeed(0)}
                  disabled={isChanging || !blueair.connected}
                  className={`px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    blueair.fanSpeed === 0
                      ? 'bg-gray-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <PowerOff className="w-4 h-4 inline mr-2" />
                  Off
                </button>
                <button
                  onClick={() => handleFanSpeed(1)}
                  disabled={isChanging || !blueair.connected}
                  className={`px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    blueair.fanSpeed === 1
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                  }`}
                >
                  Low
                </button>
                <button
                  onClick={() => handleFanSpeed(2)}
                  disabled={isChanging || !blueair.connected}
                  className={`px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    blueair.fanSpeed === 2
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50'
                  }`}
                >
                  Medium
                </button>
                <button
                  onClick={() => handleFanSpeed(3)}
                  disabled={isChanging || !blueair.connected}
                  className={`px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    blueair.fanSpeed === 3
                      ? 'bg-red-600 text-white'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
                  }`}
                >
                  Max
                </button>
              </div>
            </div>

            {/* LED Brightness Control */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Lightbulb className="w-6 h-6 text-yellow-500 dark:text-yellow-400" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  LED Brightness
                </h2>
              </div>

              {/* Current Brightness Display */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Current Brightness</span>
                  <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {blueair.ledBrightness}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                  <div
                    className="bg-gradient-to-r from-yellow-400 to-yellow-500 h-4 rounded-full transition-all duration-300"
                    style={{ width: `${blueair.ledBrightness}%` }}
                  />
                </div>
              </div>

              {/* Brightness Slider */}
              <div className="mb-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={blueair.ledBrightness}
                  onChange={(e) => handleLEDBrightness(Number(e.target.value))}
                  disabled={isChanging || !blueair.connected}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  style={{
                    background: `linear-gradient(to right, #fbbf24 0%, #fbbf24 ${blueair.ledBrightness}%, #e5e7eb ${blueair.ledBrightness}%, #e5e7eb 100%)`
                  }}
                />
              </div>

              {/* Quick Brightness Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleLEDBrightness(0)}
                  disabled={isChanging || !blueair.connected}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    blueair.ledBrightness === 0
                      ? 'bg-gray-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Off
                </button>
                <button
                  onClick={() => handleLEDBrightness(50)}
                  disabled={isChanging || !blueair.connected}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    blueair.ledBrightness === 50
                      ? 'bg-yellow-500 text-white'
                      : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/50'
                  }`}
                >
                  50%
                </button>
                <button
                  onClick={() => handleLEDBrightness(100)}
                  disabled={isChanging || !blueair.connected}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    blueair.ledBrightness === 100
                      ? 'bg-yellow-500 text-white'
                      : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/50'
                  }`}
                >
                  100%
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dust Kicker Feature */}
        {blueair.connected && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Dust Kicker Cycle
              </h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              The Dust Kicker cycle stirs up dust with your HVAC fan, then captures it with the Blueair at maximum speed.
            </p>
            <button
              onClick={handleDustKicker}
              disabled={isChanging || !blueair.connected}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isChanging ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Start Dust Kicker Cycle
                </>
              )}
            </button>
          </div>
        )}

        {/* Action Feedback */}
        {lastAction && (
          <div className={`mt-4 p-4 rounded-lg border ${
            lastAction.success
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-center gap-2">
              {lastAction.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              )}
              <p className={`text-sm ${
                lastAction.success
                  ? 'text-green-800 dark:text-green-200'
                  : 'text-red-800 dark:text-red-200'
              }`}>
                {lastAction.success
                  ? lastAction.type === 'fan'
                    ? `Fan speed set to ${getSpeedLabel(lastAction.value)}`
                    : lastAction.type === 'led'
                    ? `LED brightness set to ${lastAction.value}%`
                    : 'Dust Kicker cycle started'
                  : `Error: ${lastAction.error || 'Failed to execute command'}`}
              </p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {blueair.loading && !blueair.connected && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Connecting to Blueair...</p>
          </div>
        )}

        {/* Error State */}
        {blueair.error && blueair.error !== 'Blueair not configured' && (
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-800 dark:text-red-200">
                {blueair.error}
              </p>
            </div>
          </div>
        )}

        {/* Configuration Form Modal */}
        {showConfigForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Configure Blueair Device
                </h2>
                <button
                  onClick={() => {
                    setShowConfigForm(false);
                    setConfigError(null);
                    setConfigSuccess(false);
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              {/* Config Type Selector */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Device Type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfigType('local')}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                      configType === 'local'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Local ESP32 Device
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfigType('cloud')}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                      configType === 'cloud'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Cloud API
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveConfig} className="space-y-4">
                {configType === 'local' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        MAC Address <span className="text-gray-500 font-normal">(recommended for auto-discovery)</span>
                      </label>
                      <input
                        type="text"
                        value={macAddress}
                        onChange={(e) => {
                          // Auto-format MAC address as user types
                          let value = e.target.value.toUpperCase().replace(/[^0-9A-F:-]/g, '');
                          // Auto-add colons/dashes
                          if (value.length > 2 && !value.includes(':') && !value.includes('-')) {
                            value = value.match(/.{1,2}/g)?.join(':') || value;
                          }
                          setMacAddress(value);
                        }}
                        placeholder="D0-EF-76-1B-B8-1C"
                        maxLength={17}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Find this in your router's connected devices list. Format: XX-XX-XX-XX-XX-XX or XX:XX:XX:XX:XX:XX
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        IP Address <span className="text-gray-500 font-normal">(optional, if you have a static IP)</span>
                      </label>
                      <input
                        type="text"
                        value={localIp}
                        onChange={(e) => setLocalIp(e.target.value)}
                        placeholder="192.168.0.107"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Leave empty to use MAC address auto-discovery (recommended). The bridge will automatically find your device even if its IP changes.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Username
                      </label>
                      <input
                        type="text"
                        value={cloudUsername}
                        onChange={(e) => setCloudUsername(e.target.value)}
                        placeholder="Your Blueair account email"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Password
                      </label>
                      <input
                        type="password"
                        value={cloudPassword}
                        onChange={(e) => setCloudPassword(e.target.value)}
                        placeholder="Your Blueair account password"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </>
                )}

                {configError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-800 dark:text-red-200">{configError}</p>
                  </div>
                )}

                {configSuccess && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      Configuration saved! Reconnecting...
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowConfigForm(false);
                      setConfigError(null);
                      setConfigSuccess(false);
                    }}
                    className="flex-1 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={configLoading}
                    className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {configLoading ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
            About Blueair Control
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
            <li>Fan speeds: Off (0), Low (1), Medium (2), Max (3)</li>
            <li>LED brightness: 0% (off) to 100% (full brightness)</li>
            <li>Dust Kicker: Runs HVAC fan for 30 seconds, then Blueair at max for 10 minutes</li>
            <li>Device status updates every 5 seconds</li>
            <li>Supports both local ESP32 devices (via MAC address auto-discovery) and cloud API</li>
          </ul>
        </div>
      </div>
    </div>
  );
}


