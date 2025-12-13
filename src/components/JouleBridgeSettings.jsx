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
import { CheckCircle2, XCircle, Loader2, AlertCircle, RefreshCw, Trash2, Server, ExternalLink, Info, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function JouleBridgeSettings() {
  const [bridgeUrl, setBridgeUrl] = useState(() => {
    try {
      return localStorage.getItem('jouleBridgeUrl') || 'http://localhost:8080';
    } catch {
      return 'http://localhost:8080';
    }
  });
  const [bridgeAvailable, setBridgeAvailable] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [healthError, setHealthError] = useState(null);
  const [duplicateProcesses, setDuplicateProcesses] = useState(null);
  const [killingDuplicates, setKillingDuplicates] = useState(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridgeUrl]);

  // Sync bridge URL with Local LLM settings
  useEffect(() => {
    if (bridgeUrl) {
      try {
        localStorage.setItem('localBackendUrl', bridgeUrl);
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [bridgeUrl]);

  const loadState = async () => {
    setPairedDevices(getPairedDevices());
    const primaryId = await getPrimaryDeviceId();
    setPrimaryDeviceIdState(primaryId);
  };

  const checkHealth = async () => {
    setCheckingHealth(true);
    setHealthError(null);
    setDuplicateProcesses(null);
    try {
      const available = await checkBridgeHealth();
      setBridgeAvailable(available);
      if (!available) {
        setHealthError('Bridge did not respond. Make sure it is running and accessible.');
      } else {
        // Clear any previous errors on success
        setHealthError(null);
        // Check for duplicate processes
        await checkDuplicateProcesses();
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
        errorMessage = 'Invalid URL format. Use format: http://hostname:port (e.g., http://localhost:8080)';
      }
      setHealthError(errorMessage);
    } finally {
      setCheckingHealth(false);
    }
  };

  const checkDuplicateProcesses = async () => {
    try {
      const currentUrl = localStorage.getItem('jouleBridgeUrl') || bridgeUrl;
      const response = await fetch(`${currentUrl}/api/bridge/processes`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'omit',
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.has_duplicates) {
          setDuplicateProcesses(data);
        } else {
          setDuplicateProcesses(null);
        }
      }
    } catch (error) {
      // Silently fail - this is just a check
      console.debug('Could not check for duplicate processes:', error);
    }
  };

  const handleKillDuplicates = async () => {
    setKillingDuplicates(true);
    try {
      const currentUrl = localStorage.getItem('jouleBridgeUrl') || bridgeUrl;
      const response = await fetch(`${currentUrl}/api/bridge/kill-duplicates`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        credentials: 'omit',
      });
      
      if (response.ok) {
        const data = await response.json();
        setDuplicateProcesses(null);
        // Refresh health check after killing duplicates
        setTimeout(() => {
          checkHealth();
        }, 1000);
        alert(`Success: ${data.message}`);
      } else {
        const error = await response.json();
        alert(`Failed to kill duplicate processes: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error killing duplicates:', error);
      alert(`Failed to kill duplicate processes: ${error.message}`);
    } finally {
      setKillingDuplicates(false);
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
      } catch {
        alert('Please enter a valid URL (e.g., http://192.168.1.100:8080)');
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
    } catch {
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
        Joule Bridge provides <strong>local, private access</strong> to basic thermostat controls via HomeKit.
        No cloud, no accounts, no remote access.
      </div>
      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
        <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-2">HomeKit Limitations:</p>
        <p className="text-xs text-blue-800 dark:text-blue-300 mb-1">Joule can read and change:</p>
        <ul className="text-xs text-blue-800 dark:text-blue-300 list-disc list-inside ml-2 space-y-0.5 mb-2">
          <li>Mode (Heat / Cool / Auto / Off)</li>
          <li>Target temperature</li>
        </ul>
        <p className="text-xs text-blue-800 dark:text-blue-300">
          HomeKit does <strong>not</strong> expose schedules, comfort profiles, or occupancy data.
        </p>
      </div>
      
      {/* Documentation Link */}
      <div className="mb-4">
        <Link
          to="/hardware"
          className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
        >
          <FileText className="w-4 h-4" />
          <span className="text-sm font-medium">
            View Setup Documentation & Guides
          </span>
          <ExternalLink className="w-3 h-3" />
        </Link>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 ml-6">
          Step-by-step instructions for flashing the Bridge and setting it up
        </p>
      </div>
      
      {/* Demo Mode Override Toggle */}
      <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Debug: Disable Demo Mode
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Manually disable demo mode to see raw data from your Ecobee via HomeKit. Useful for debugging.
            </p>
          </div>
          <label className="inline-flex items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={(() => {
                try {
                  return localStorage.getItem("demoModeDisabled") === "true";
                } catch {
                  return false;
                }
              })()}
              onChange={(e) => {
                try {
                  if (e.target.checked) {
                    localStorage.setItem("demoModeDisabled", "true");
                  } else {
                    localStorage.removeItem("demoModeDisabled");
                  }
                  // Trigger a re-check
                  window.dispatchEvent(new Event("demo-mode-changed"));
                  // Also trigger storage event for other tabs
                  window.dispatchEvent(new StorageEvent("storage", {
                    key: "demoModeDisabled",
                    newValue: e.target.checked ? "true" : null,
                  }));
                  // Force page refresh to apply changes
                  setTimeout(() => window.location.reload(), 500);
                } catch (err) {
                  console.error("Error toggling demo mode:", err);
                }
              }}
            />
          </label>
        </div>
      </div>

      {/* Info box about auto-start */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg mb-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
            <div className="font-semibold">📦 On Bridge Hardware:</div>
            <div>The server auto-starts on boot. No manual start needed! If you need to restart it, use: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">sudo systemctl restart prostat-bridge</code></div>
            <div className="font-semibold mt-2">💻 Development/Testing:</div>
            <div>Use the "Start Server" button below to copy the manual start command.</div>
          </div>
        </div>
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
            placeholder="http://localhost:8080"
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
          Enter your Joule Bridge's IP address or hostname (e.g., http://192.168.1.100:8080)
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
          <div className="flex items-center gap-2">
            <button
              onClick={checkHealth}
              className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            {/* Always show Start Server button - for development/testing only */}
            <button
              onClick={() => {
                const command = 'cd prostat-bridge && source venv/bin/activate && python3 server.py';
                const backgroundCommand = 'cd prostat-bridge && source venv/bin/activate && nohup python3 server.py > /tmp/prostat-bridge.log 2>&1 &';
                const systemdCommand = 'sudo systemctl start prostat-bridge';
                const fullInstructions = `How to start the Joule Bridge server:

📦 ON BRIDGE HARDWARE ($129 device):
   The server auto-starts on boot. No action needed!
   If it's not running, use: ${systemdCommand}

💻 FOR DEVELOPMENT/TESTING (manual start):
   Foreground (see logs): ${command}
   
   Background (logs to file): ${backgroundCommand}
   
   After starting, click "Refresh" above.`;
                
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(command).then(() => {
                    alert('Start command copied to clipboard!\n\n' + fullInstructions);
                  }).catch(() => {
                    // Fallback if clipboard fails
                    const textarea = document.createElement('textarea');
                    textarea.value = command;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    alert('Start command copied to clipboard!\n\n' + fullInstructions);
                  });
                } else {
                  // Fallback for older browsers
                  const textarea = document.createElement('textarea');
                  textarea.value = command;
                  document.body.appendChild(textarea);
                  textarea.select();
                  document.execCommand('copy');
                  document.body.removeChild(textarea);
                  alert('Start command copied to clipboard!\n\n' + fullInstructions);
                }
              }}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
              title="Copy command to start the bridge server (for development/testing)"
            >
              <Server className="w-4 h-4" />
              Start Server
            </button>
          </div>
        </div>
        {duplicateProcesses && duplicateProcesses.has_duplicates && (
          <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Multiple bridge processes detected!
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  Found {duplicateProcesses.duplicate_processes} duplicate process(es) (PIDs: {duplicateProcesses.other_pids.join(', ')}).
                  This can cause connection issues and port conflicts.
                </p>
                <button
                  onClick={handleKillDuplicates}
                  disabled={killingDuplicates}
                  className="mt-2 px-3 py-1.5 text-xs bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-1"
                >
                  {killingDuplicates ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Killing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3 h-3" />
                      Kill Duplicate Processes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
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
            <div className="mt-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-2">
                📦 On Bridge Hardware ($129 device):
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                The server auto-starts on boot. If it's not running, use:
              </p>
              <div className="flex items-center gap-2 mb-3">
                <code className="flex-1 px-2 py-1.5 bg-gray-800 dark:bg-gray-900 text-green-400 text-xs rounded font-mono break-all">
                  sudo systemctl start prostat-bridge
                </code>
                <button
                  onClick={() => {
                    const command = 'sudo systemctl start prostat-bridge';
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(command);
                    } else {
                      const textarea = document.createElement('textarea');
                      textarea.value = command;
                      document.body.appendChild(textarea);
                      textarea.select();
                      document.execCommand('copy');
                      document.body.removeChild(textarea);
                    }
                    alert('Command copied to clipboard!');
                  }}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-2 mt-3">
                💻 For Development/Testing (manual start):
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-2 py-1.5 bg-gray-800 dark:bg-gray-900 text-green-400 text-xs rounded font-mono break-all">
                  cd prostat-bridge && source venv/bin/activate && python3 server.py
                </code>
                <button
                  onClick={() => {
                    const command = 'cd prostat-bridge && source venv/bin/activate && python3 server.py';
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(command).then(() => {
                        alert('Command copied to clipboard!');
                      }).catch(() => {
                        const textarea = document.createElement('textarea');
                        textarea.value = command;
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textarea);
                        alert('Command copied to clipboard!');
                      });
                    } else {
                      const textarea = document.createElement('textarea');
                      textarea.value = command;
                      document.body.appendChild(textarea);
                      textarea.select();
                      document.execCommand('copy');
                      document.body.removeChild(textarea);
                      alert('Command copied to clipboard!');
                    }
                  }}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  title="Copy command to clipboard"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Background: <code className="bg-gray-800 dark:bg-gray-900 text-green-400 px-1 rounded">nohup python3 server.py &gt; /tmp/prostat-bridge.log 2&gt;&amp;1 &amp;</code>
              </p>
            </div>
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

          {devices.length > 0 ? (
            <div className="space-y-2">
              {devices.length > 1 && (
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                  <strong>Note:</strong> If you see multiple devices with the same name, they're likely different accessories from the same physical device. Try pairing with the first one listed.
                </div>
              )}
              {devices.map((device) => {
                // Check if this device is already paired
                const isPaired = pairedDevices.some(p => p.device_id === device.device_id);
                return (
                <div
                  key={device.device_id}
                  className={`p-3 border rounded-lg ${
                    isPaired 
                      ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20' 
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {device.name || 'Unknown Device'}
                        {isPaired && (
                          <span className="text-xs bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                            Already Paired
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{device.device_id}</div>
                    </div>
                    {selectedDevice === device.device_id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={pairingCode}
                          onChange={(e) => {
                            // Auto-format pairing code as XXX-XX-XXX
                            let value = e.target.value.replace(/[^\d]/g, ''); // Remove all non-digits
                            if (value.length > 0) {
                              if (value.length > 5) {
                                value = value.slice(0, 3) + '-' + value.slice(3, 5) + '-' + value.slice(5, 8);
                              } else if (value.length > 3) {
                                value = value.slice(0, 3) + '-' + value.slice(3);
                              }
                              // If length <= 3, keep value as-is (no formatting needed)
                            }
                            setPairingCode(value);
                          }}
                          placeholder="123-45-678"
                          maxLength={10}
                          className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
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
                );
              })}
            </div>
          ) : !discovering ? (
            <div className="p-3 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg">
              {pairedDevices.length > 0 ? (
                <div className="space-y-2">
                  <p>No new devices found.</p>
                  <p className="text-xs">Your paired devices are shown below. Make sure your Ecobee has HomeKit pairing enabled (Menu → Settings → HomeKit) to discover new devices.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p>No devices found.</p>
                  <p className="text-xs">Make sure your Ecobee has HomeKit pairing enabled (Menu → Settings → HomeKit).</p>
                </div>
              )}
            </div>
          ) : null}
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

