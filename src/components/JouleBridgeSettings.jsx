import React, { useState, useEffect } from 'react';
import {
  discoverDevices,
  pairDevice,
  unpairDevice,
  getPairedDevices,
  getPrimaryDeviceId,
  setPrimaryDeviceId,
  checkBridgeHealth,
} from '../lib/jouleBridgeApi';
import { CheckCircle2, XCircle, Loader2, AlertCircle, RefreshCw, Trash2, Server, ExternalLink } from 'lucide-react';

export default function JouleBridgeSettings() {
  const [bridgeUrl, setBridgeUrl] = useState(() => {
    try {
      return localStorage.getItem('jouleBridgeUrl') || 'http://localhost:3002';
    } catch {
      return 'http://localhost:3002';
    }
  });
  const [bridgeAvailable, setBridgeAvailable] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [healthError, setHealthError] = useState(null);
  const [devices, setDevices] = useState([]);
  const [discovering, setDiscovering] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [pairedDevices, setPairedDevices] = useState([]);
  const [primaryDeviceId, setPrimaryDeviceIdState] = useState(null);
  const [localLLMEnabled, setLocalLLMEnabled] = useState(() => {
    try {
      return localStorage.getItem('useLocalBackend') === 'true' || localStorage.getItem('useLocalLLM') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    loadState();
    checkHealth();
  }, [bridgeUrl]);

  // Sync bridge URL with Local LLM settings
  useEffect(() => {
    if (bridgeUrl) {
      try {
        localStorage.setItem('localBackendUrl', bridgeUrl);
      } catch (e) {
        // Ignore localStorage errors
      }
    }
  }, [bridgeUrl]);

  const loadState = () => {
    setPairedDevices(getPairedDevices());
    setPrimaryDeviceIdState(getPrimaryDeviceId());
  };

  const checkHealth = async () => {
    setCheckingHealth(true);
    setHealthError(null);
    try {
      // Ensure we're using the latest URL from localStorage
      const currentUrl = localStorage.getItem('jouleBridgeUrl') || bridgeUrl;
      const available = await checkBridgeHealth();
      setBridgeAvailable(available);
      if (!available) {
        setHealthError('Bridge did not respond. Make sure it is running and accessible.');
      } else {
        // Clear any previous errors on success
        setHealthError(null);
      }
    } catch (error) {
      console.error('Health check error:', error);
      setBridgeAvailable(false);
      // Provide more helpful error messages
      let errorMessage = error.message || 'Connection failed.';
      if (errorMessage.includes('timeout')) {
        errorMessage = 'Connection timeout. The bridge may be slow to respond or not running.';
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('ERR_CONNECTION_REFUSED')) {
        errorMessage = 'Cannot connect to bridge. Make sure it is running on ' + (localStorage.getItem('jouleBridgeUrl') || bridgeUrl);
      } else if (errorMessage.includes('Invalid URL')) {
        errorMessage = 'Invalid URL format. Use format: http://hostname:port (e.g., http://localhost:3002)';
      }
      setHealthError(errorMessage);
    } finally {
      setCheckingHealth(false);
    }
  };

  const handleSaveUrl = () => {
    try {
      // Validate URL format
      const url = bridgeUrl.trim();
      if (!url) {
        alert('Please enter a valid URL');
        return;
      }
      
      // Basic URL validation
      try {
        new URL(url);
      } catch (e) {
        alert('Please enter a valid URL (e.g., http://192.168.1.100:3002)');
        return;
      }
      
      localStorage.setItem('jouleBridgeUrl', url);
      // Update state to match saved value
      setBridgeUrl(url);
      // Check health with new URL
      checkHealth();
    } catch (error) {
      console.error('Failed to save URL:', error);
      alert('Failed to save URL: ' + error.message);
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const discovered = await discoverDevices();
      setDevices(discovered);
    } catch (error) {
      alert(`Failed to discover devices: ${error.message}`);
      setDevices([]);
    } finally {
      setDiscovering(false);
    }
  };

  const handlePair = async (deviceId) => {
    if (!pairingCode.trim()) {
      alert('Please enter the pairing code from your Ecobee');
      return;
    }

    setPairing(true);
    try {
      await pairDevice(deviceId, pairingCode);
      loadState();
      setPairingCode('');
      setSelectedDevice(null);
      alert('Successfully paired!');
    } catch (error) {
      alert(`Pairing failed: ${error.message}`);
    } finally {
      setPairing(false);
    }
  };

  const handleUnpair = async (deviceId) => {
    if (!confirm('Are you sure you want to unpair this device?')) {
      return;
    }

    try {
      await unpairDevice(deviceId);
      loadState();
      if (primaryDeviceId === deviceId) {
        setPrimaryDeviceId(null);
        setPrimaryDeviceIdState(null);
      }
    } catch (error) {
      alert(`Failed to unpair: ${error.message}`);
    }
  };

  const handleSetPrimary = (deviceId) => {
    setPrimaryDeviceId(deviceId);
    setPrimaryDeviceIdState(deviceId);
  };

  const handleToggleLocalLLM = (enabled) => {
    setLocalLLMEnabled(enabled);
    try {
      localStorage.setItem('useLocalBackend', enabled ? 'true' : 'false');
      localStorage.setItem('useLocalLLM', enabled ? 'true' : 'false'); // Backward compatibility
    } catch (e) {
      // Ignore localStorage errors
    }
  };

  const scrollToLocalLLMSettings = () => {
    // Scroll to advanced settings and expand if needed
    const advancedSection = document.querySelector('[data-advanced-settings]');
    if (advancedSection) {
      advancedSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Try to expand advanced settings
      const expandButton = advancedSection.querySelector('button');
      if (expandButton && !expandButton.getAttribute('aria-expanded')) {
        expandButton.click();
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Joule Bridge enables <strong>local-only</strong> thermostat control using HomeKit HAP protocol.
        No cloud, no APIs, just pure local control with millisecond latency.
      </div>

      {/* Local LLM Quick Toggle */}
      <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-medium text-gray-900 dark:text-gray-100">Local AI (Ask Joule)</h3>
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={localLLMEnabled}
              onChange={(e) => handleToggleLocalLLM(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {localLLMEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          Enable local AI queries using the same Joule Bridge server. Keeps your data private and runs completely offline.
        </p>
        <button
          onClick={scrollToLocalLLMSettings}
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
        >
          Advanced settings <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {/* Bridge URL Configuration */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Joule Bridge URL
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={bridgeUrl}
            onChange={(e) => setBridgeUrl(e.target.value)}
            placeholder="http://localhost:3002"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <button
            onClick={handleSaveUrl}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Enter your Joule Bridge's IP address or hostname (e.g., http://192.168.1.100:3002)
        </p>
      </div>

      {/* Bridge Status */}
      <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {checkingHealth ? (
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            ) : bridgeAvailable ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
            <span className="font-medium">
              Bridge Status: {checkingHealth ? 'Checking...' : bridgeAvailable ? 'Connected' : 'Not Available'}
            </span>
          </div>
          <button
            onClick={checkHealth}
            className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
        {!bridgeAvailable && !checkingHealth && (
          <div className="mt-2">
            <p className="text-sm text-red-600 dark:text-red-400">
              Make sure your Joule Bridge is running and the service is started.
            </p>
            {healthError && (
              <p className="text-xs text-red-500 dark:text-red-500 mt-1">
                Error: {healthError}
              </p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Current URL: {bridgeUrl}
            </p>
          </div>
        )}
      </div>

      {/* Discover Devices */}
      {bridgeAvailable && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Discover Devices</h3>
            <button
              onClick={handleDiscover}
              disabled={discovering}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {discovering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Discovering...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Discover
                </>
              )}
            </button>
          </div>

          {devices.length > 0 && (
            <div className="space-y-2">
              {devices.map((device) => (
                <div
                  key={device.device_id}
                  className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{device.name || 'Unknown Device'}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{device.device_id}</div>
                    </div>
                    {selectedDevice === device.device_id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={pairingCode}
                          onChange={(e) => setPairingCode(e.target.value)}
                          placeholder="123-45-678"
                          className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
                        />
                        <button
                          onClick={() => handlePair(device.device_id)}
                          disabled={pairing || !pairingCode.trim()}
                          className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {pairing ? 'Pairing...' : 'Pair'}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedDevice(null);
                            setPairingCode('');
                          }}
                          className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedDevice(device.device_id)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Pair
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Paired Devices */}
      {pairedDevices.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Paired Devices</h3>
          <div className="space-y-2">
            {pairedDevices.map((deviceId) => (
              <div
                key={deviceId}
                className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="font-medium">{deviceId}</div>
                    {primaryDeviceId === deviceId && (
                      <div className="text-xs text-blue-600 dark:text-blue-400">Primary Device</div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {primaryDeviceId !== deviceId && (
                    <button
                      onClick={() => handleSetPrimary(deviceId)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Set Primary
                    </button>
                  )}
                  <button
                    onClick={() => handleUnpair(deviceId)}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Unpair
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {bridgeAvailable && pairedDevices.length === 0 && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">No devices paired</p>
              <p>1. Click "Discover" to find your Ecobee</p>
              <p>2. Enable HomeKit pairing on your Ecobee (Menu → Settings → HomeKit)</p>
              <p>3. Enter the 8-digit pairing code and click "Pair"</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

