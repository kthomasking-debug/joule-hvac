import React, { useState, useEffect } from 'react';
import {
  discoverDevices,
  pairDevice,
  unpairDevice,
  getPairedDevices,
  getPrimaryDeviceId,
  setPrimaryDeviceId,
  checkBridgeHealth,
  diagnoseBridge,
  autoFixPairing,
  getBlueairCredentials,
  setBlueairCredentials,
  getHomeKitBridgePairingInfo,
} from '../lib/jouleBridgeApi';
import { CheckCircle2, XCircle, Loader2, AlertCircle, RefreshCw, Trash2, ExternalLink, Info, FileText, Eye, EyeOff, Home, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Link } from 'react-router-dom';
import EcobeePairingOnboarding from './EcobeePairingOnboarding';

export default function JouleBridgeSettings() {
  const [bridgeUrl, setBridgeUrl] = useState(() => {
    try {
      // Check saved URL first
      const savedUrl = localStorage.getItem('jouleBridgeUrl');
      if (savedUrl) return savedUrl;
      
      // Check environment variable
      const envUrl = import.meta.env.VITE_JOULE_BRIDGE_URL;
      if (envUrl) return envUrl;
      
      // Try mDNS hostname first (joule-bridge.local), then fallback to common IPs
      // The bridge server advertises itself via mDNS/Bonjour
      return 'http://joule-bridge.local:8080';
    } catch {
      return import.meta.env.VITE_JOULE_BRIDGE_URL || 'http://192.168.0.106:8080';
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
  const [deviceReachability, setDeviceReachability] = useState({});
  const [diagnostics, setDiagnostics] = useState(null);
  const [autoFixing, setAutoFixing] = useState(false);
  const [blueairUsername, setBlueairUsername] = useState('');
  const [blueairPassword, setBlueairPassword] = useState('');
  const [showBlueairPassword, setShowBlueairPassword] = useState(false);
  const [blueairCredentialsStatus, setBlueairCredentialsStatus] = useState(null);
  const [savingBlueair, setSavingBlueair] = useState(false);
  const [showPairingOnboarding, setShowPairingOnboarding] = useState(false);
  const [bridgeInfo, setBridgeInfo] = useState(null);
  const [homekitBridgeInfo, setHomekitBridgeInfo] = useState(null);
  const [loadingHomekitInfo, setLoadingHomekitInfo] = useState(false);
  const [blueairExpanded, setBlueairExpanded] = useState(false);
  const [homekitExpanded, setHomekitExpanded] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    loadState();
    checkHealth();
    runDiagnostics();
    loadBlueairCredentials();
    loadBridgeInfo();
    loadHomeKitBridgeInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridgeUrl]);

  const loadBridgeInfo = async () => {
    // Don't check bridgeAvailable here - we might be calling this after setting it to true
    try {
      const urlToCheck = bridgeUrl || localStorage.getItem('jouleBridgeUrl') || import.meta.env.VITE_JOULE_BRIDGE_URL || 'http://joule-bridge.local:8080';
      if (!urlToCheck) {
        setBridgeInfo(null);
        return;
      }
      const response = await fetch(`${urlToCheck}/api/bridge/info`, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const info = await response.json();
        setBridgeInfo(info);
      } else {
        setBridgeInfo(null);
      }
    } catch (error) {
      console.debug('Error loading bridge info:', error);
      setBridgeInfo(null);
    }
  };

  const loadBlueairCredentials = async () => {
    if (!bridgeAvailable) return;
    try {
      const status = await getBlueairCredentials();
      setBlueairCredentialsStatus(status);
      if (status?.username) {
        setBlueairUsername(status.username);
      }
    } catch (error) {
      console.debug('Error loading Blueair credentials:', error);
    }
  };

  const loadHomeKitBridgeInfo = async () => {
    if (!bridgeAvailable) return;
    setLoadingHomekitInfo(true);
    try {
      const info = await getHomeKitBridgePairingInfo();
      console.log('HomeKit bridge info loaded:', info);
      setHomekitBridgeInfo(info);
    } catch (error) {
      console.error('Error loading HomeKit bridge info:', error);
      // Set error state so UI can display it
      setHomekitBridgeInfo({
        available: false,
        error: error.message || 'Failed to load pairing information'
      });
    } finally {
      setLoadingHomekitInfo(false);
    }
  };

  const handleSaveBlueairCredentials = async () => {
    if (!blueairUsername || !blueairPassword) {
      alert('Please enter both username and password');
      return;
    }
    setSavingBlueair(true);
    try {
      const result = await setBlueairCredentials(blueairUsername, blueairPassword);
      if (result.success) {
        alert(`Blueair credentials saved successfully! Found ${result.devices_count || 0} device(s).`);
        await loadBlueairCredentials();
        setBlueairPassword(''); // Clear password field
      } else {
        alert(`Failed to connect: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`Error saving credentials: ${error.message || error}`);
    } finally {
      setSavingBlueair(false);
    }
  };

  const runDiagnostics = async () => {
    // Skip diagnostics if no URL is configured
    const urlToCheck = bridgeUrl || localStorage.getItem('jouleBridgeUrl') || import.meta.env.VITE_JOULE_BRIDGE_URL;
    if (!urlToCheck || urlToCheck.trim() === '') {
      setDiagnostics(null);
      return null;
    }
    
    try {
      const diag = await diagnoseBridge();
      setDiagnostics(diag);
      return diag;
    } catch (error) {
      console.error('Diagnostic error:', error);
      setDiagnostics(null);
      return null;
    }
  };

  const handleAutoFix = async () => {
    setAutoFixing(true);
    try {
      const result = await autoFixPairing();
      console.log('Auto-fix result:', result);
      // Reload state after auto-fix
      await loadState();
      await runDiagnostics();
      alert(`Auto-fix complete!\n\n${result.actions_taken.join('\n')}\n\n${result.recommendation || ''}`);
    } catch (error) {
      console.error('Auto-fix error:', error);
      alert(`Auto-fix failed: ${error.message}`);
    } finally {
      setAutoFixing(false);
    }
  };

  const loadState = async () => {
    // Skip loading state if no URL is configured
    const urlToCheck = bridgeUrl || localStorage.getItem('jouleBridgeUrl') || import.meta.env.VITE_JOULE_BRIDGE_URL;
    if (!urlToCheck || urlToCheck.trim() === '') {
      setPairedDevices([]);
      setPrimaryDeviceIdState(null);
      setDeviceReachability({});
      return;
    }
    
    try {
      const paired = await getPairedDevices();
      console.log('🔄 Loaded paired devices:', paired);
      setPairedDevices(paired);
      const primaryId = await getPrimaryDeviceId();
      console.log('🔄 Primary device ID:', primaryId);
      setPrimaryDeviceIdState(primaryId);
      
      // Check reachability of each paired device
      if (paired.length > 0) {
        const { getThermostatStatus } = await import('../lib/jouleBridgeApi');
        const reachability = {};
        for (const deviceId of paired) {
          try {
            await getThermostatStatus(deviceId);
            reachability[deviceId] = true;
          } catch (error) {
            reachability[deviceId] = false;
          }
        }
        setDeviceReachability(reachability);
      } else {
        setDeviceReachability({});
      }
    } catch (error) {
      // If there's an error loading state, just set empty defaults
      console.error('Error loading state:', error);
      setPairedDevices([]);
      setPrimaryDeviceIdState(null);
      setDeviceReachability({});
    }
  };

  const checkHealth = async () => {
    // Use current bridgeUrl state (from input field or saved value)
    // Try mDNS hostname first, then fallback to common IPs
    const urlToCheck = bridgeUrl || localStorage.getItem('jouleBridgeUrl') || import.meta.env.VITE_JOULE_BRIDGE_URL || 'http://joule-bridge.local:8080';
    
    if (!urlToCheck || urlToCheck.trim() === '') {
      setBridgeAvailable(false);
      setHealthError('Joule Bridge URL not configured. Please enter the URL above and click "Save".');
      setCheckingHealth(false);
      return;
    }

    setCheckingHealth(true);
    setHealthError(null);
    setDuplicateProcesses(null);
    
    try {
      // Validate URL format
      try {
        new URL(urlToCheck);
      } catch (e) {
        throw new Error(`Invalid URL format: ${urlToCheck}. Use format: http://hostname:port (e.g., http://192.168.0.106:8080)`);
      }

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const response = await fetch(`${urlToCheck}/health`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          credentials: 'omit',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const available = true;
          setBridgeAvailable(available);
          // Load HomeKit bridge info after confirming bridge is available
          loadHomeKitBridgeInfo();
          setHealthError(null);
          // Check for duplicate processes
          await checkDuplicateProcesses();
          // Load bridge info (hostname, IP, etc.)
          await loadBridgeInfo();
        } else {
          setBridgeAvailable(false);
          setHealthError('Bridge did not respond. Make sure it is running and accessible.');
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Connection timeout. The bridge may be slow to respond or not running.');
        }
        throw fetchError;
      }
    } catch (error) {
      console.error('Health check error:', error);
      setBridgeAvailable(false);
      // Provide more helpful error messages
      let errorMessage = error.message || 'Connection failed.';
      if (errorMessage.includes('timeout')) {
        errorMessage = 'Connection timeout. The bridge may be slow to respond or not running.';
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('ERR_CONNECTION_REFUSED')) {
        errorMessage = 'Cannot connect to bridge. Make sure it is running on ' + urlToCheck;
      } else if (errorMessage.includes('Invalid URL')) {
        errorMessage = 'Invalid URL format. Use format: http://hostname:port (e.g., http://192.168.0.106:8080)';
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
    setDevices([]); // Clear previous results
    try {
      // HomeKit discovery can take 30-60 seconds
      const discovered = await discoverDevices();
      if (discovered && discovered.length > 0) {
        setDevices(discovered);
      } else {
        alert('No HomeKit devices found.\n\nMake sure:\n1. Your Ecobee has HomeKit pairing enabled (Menu → Settings → Installation Settings → HomeKit)\n2. Both the bridge and Ecobee are on the same network\n3. Try clicking Discover again - discovery can take up to 60 seconds');
        setDevices([]);
      }
    } catch (error) {
      console.error('Discovery error:', error);
      const errorMsg = error.message || 'Failed to discover devices';
      alert(`Failed to discover devices: ${errorMsg}\n\nIf this persists, check:\n1. Bridge is running and accessible\n2. Ecobee has HomeKit pairing enabled\n3. Both devices are on the same network`);
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

    // Get the bridge URL that will be used (from localStorage or current input)
    const savedBridgeUrl = localStorage.getItem('jouleBridgeUrl');
    const currentBridgeUrl = savedBridgeUrl || bridgeUrl;
    
    // Warn if trying to pair on localhost
    if (currentBridgeUrl.includes('localhost') || currentBridgeUrl.includes('127.0.0.1')) {
      const useLocalhost = confirm(
        `⚠️ Warning: You are about to pair on LOCALHOST (${currentBridgeUrl}).\n\n` +
        `If your bridge is running on a remote device (mini PC, Raspberry Pi), you need to:\n` +
        `1. Enter the remote bridge URL in "Joule Bridge URL" above\n` +
        `2. Click "Save"\n` +
        `3. Then try pairing again\n\n` +
        `Continue pairing on localhost?`
      );
      if (!useLocalhost) {
        return;
      }
    }
    
    // If URL in input field differs from saved URL, warn user to save first
    if (savedBridgeUrl && bridgeUrl !== savedBridgeUrl) {
      const saveFirst = confirm(
        `⚠️ The bridge URL has been changed but not saved.\n\n` +
        `Current input: ${bridgeUrl}\n` +
        `Saved URL: ${savedBridgeUrl}\n\n` +
        `Pairing will use the SAVED URL (${savedBridgeUrl}).\n\n` +
        `Click "Save" first if you want to use the new URL.\n\n` +
        `Continue with saved URL?`
      );
      if (!saveFirst) {
        return;
      }
    }

    setPairing(true);
    try {
      // Always use the saved URL (or current input if not saved)
      const pairingBridgeUrl = savedBridgeUrl || bridgeUrl;
      console.log(`Pairing device ${deviceId} on bridge: ${pairingBridgeUrl}`);
      
      await pairDevice(deviceId, pairingCode);
      
      // Wait a moment for backend to fully save the pairing
      console.log('⏳ Waiting for backend to save pairing...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      console.log('🔄 Reloading state after pairing...');
      await loadState();
      setPairingCode('');
      setSelectedDevice(null);
      alert(`✅ Successfully paired on ${pairingBridgeUrl}!`);
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



  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Joule Bridge provides <strong>local, private access</strong> to basic thermostat controls via HomeKit.
        No cloud, no accounts, no remote access.
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
            <div className="flex flex-col">
              <span className="font-medium">
                Bridge Status: {checkingHealth ? 'Checking...' : bridgeAvailable ? 'Connected' : 'Not Available'}
              </span>
              {bridgeAvailable && bridgeInfo && (
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 space-y-0.5">
                  <div><strong>Bridge IP Address:</strong> {bridgeInfo.local_ip || 'Unknown'}</div>
                  <div>
                    {bridgeInfo.hostname || 'Unknown'}
                    {bridgeInfo.username && ` (${bridgeInfo.username})`}
                    {bridgeInfo.tailscale_ip && ` • Tailscale: ${bridgeInfo.tailscale_ip}`}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={checkHealth}
              className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
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
          {/* Show which bridge will be used for pairing */}
          {(() => {
            const savedUrl = localStorage.getItem('jouleBridgeUrl');
            const envUrl = import.meta.env.VITE_JOULE_BRIDGE_URL;
            const urlToUse = savedUrl || envUrl || bridgeUrl;
            const needsSave = savedUrl && bridgeUrl !== savedUrl;
            const isLocalhost = urlToUse && (urlToUse.includes('localhost') || urlToUse.includes('127.0.0.1'));
            const isEmpty = !urlToUse || urlToUse.trim() === '';
            
            if (isEmpty) {
              return (
                <div className="p-3 border rounded-lg bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                    <div className="text-xs text-red-800 dark:text-red-200">
                      <span className="font-semibold">⚠️ Bridge URL not configured!</span>
                      <span className="ml-2">Please set the Joule Bridge URL above (e.g., http://192.168.0.106:8080)</span>
                    </div>
                  </div>
                </div>
              );
            }
            
            return (
              <div className={`p-3 border rounded-lg ${
                needsSave 
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
                  : isLocalhost
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700'
                  : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
              }`}>
                <div className="flex items-center gap-2">
                  {needsSave ? (
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  ) : isLocalhost ? (
                    <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  )}
                  <div className={`text-xs ${
                    needsSave 
                      ? 'text-amber-800 dark:text-amber-200'
                      : isLocalhost
                      ? 'text-yellow-800 dark:text-yellow-200'
                      : 'text-green-800 dark:text-green-200'
                  }`}>
                    <span className="font-semibold">Pairing will use:</span>{' '}
                    <code className={`px-1.5 py-0.5 rounded font-mono ${
                      needsSave
                        ? 'bg-amber-100 dark:bg-amber-900'
                        : isLocalhost
                        ? 'bg-yellow-100 dark:bg-yellow-900'
                        : 'bg-green-100 dark:bg-green-900'
                    }`}>
                      {urlToUse}
                    </code>
                    {needsSave && (
                      <span className="ml-2 font-semibold">
                        ⚠️ URL changed - Click "Save" above to update!
                      </span>
                    )}
                    {!needsSave && isLocalhost && (
                      <span className="ml-2">
                        ⚠️ Make sure this is your remote bridge, not localhost!
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
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

      {/* Diagnostic & Auto-Fix - Show only if there's a mismatch AND advanced mode is on */}
      {showAdvanced && bridgeAvailable && diagnostics && diagnostics.mismatch_detected && (
        <div className="p-4 rounded-lg border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 mb-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Pairing Mismatch Detected</h3>
            </div>
            <button
              onClick={runDiagnostics}
              className="px-2 py-1 text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded hover:bg-yellow-300 dark:hover:bg-yellow-700 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
          <div className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1 mb-3">
            {diagnostics.issues.map((issue, idx) => (
              <div key={idx}>• {issue}</div>
            ))}
          </div>
          {diagnostics.recommendations.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-200 mb-1">Recommendations:</p>
              <div className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                {diagnostics.recommendations.map((rec, idx) => (
                  <div key={idx}>• {rec}</div>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={handleAutoFix}
            disabled={autoFixing}
            className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {autoFixing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Fixing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Auto-Fix Pairing Issues
              </>
            )}
          </button>
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
              <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                <a
                  href="/pairing-wizard"
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Launch Pairing Wizard
                </a>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Step-by-step guide with QR scanner
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Settings Toggle */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
        >
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
          <span>{showAdvanced ? 'Hide' : 'Show'} Advanced Settings</span>
        </button>
        
        {showAdvanced && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Additional integrations and debugging options for power users.
          </p>
        )}
      </div>

      {/* Debug: Disable Demo Mode - Advanced */}
      {showAdvanced && (
        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Debug: Disable Demo Mode
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Manually disable demo mode to see raw data from your Ecobee via HomeKit.
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
                    window.dispatchEvent(new Event("demo-mode-changed"));
                    window.dispatchEvent(new StorageEvent("storage", {
                      key: "demoModeDisabled",
                      newValue: e.target.checked ? "true" : null,
                    }));
                    setTimeout(() => window.location.reload(), 500);
                  } catch (err) {
                    console.error("Error toggling demo mode:", err);
                  }
                }}
              />
            </label>
          </div>
        </div>
      )}

      {/* Blueair Credentials Configuration - Collapsible (Advanced) */}
      {showAdvanced && bridgeAvailable && (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-4">
          <button
            onClick={() => setBlueairExpanded(!blueairExpanded)}
            className="w-full flex items-center justify-between mb-2"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <span>🌬️</span>
              Blueair Air Purifier Credentials
            </h3>
            {blueairExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Configure your Blueair account credentials to enable air purifier control.
          </p>
          
          {blueairExpanded && (
            <>
              {blueairCredentialsStatus && (
                <div className={`mb-4 p-3 rounded-lg border ${
                  blueairCredentialsStatus.connected
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                }`}>
                  <div className="flex items-center gap-2">
                    {blueairCredentialsStatus.connected ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    )}
                    <div className="text-sm">
                      {blueairCredentialsStatus.connected ? (
                        <span className="text-green-800 dark:text-green-200">
                          Connected: {blueairCredentialsStatus.devices_count || 0} device(s) found
                        </span>
                      ) : (
                        <span className="text-yellow-800 dark:text-yellow-200">
                          {blueairCredentialsStatus.has_credentials 
                            ? 'Credentials saved but not connected. Check username/password.'
                            : 'No credentials configured'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email / Username
                  </label>
                  <input
                    type="text"
                    value={blueairUsername}
                    onChange={(e) => setBlueairUsername(e.target.value)}
                    placeholder="bunnyrita@gmail.com"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showBlueairPassword ? "text" : "password"}
                      value={blueairPassword}
                      onChange={(e) => setBlueairPassword(e.target.value)}
                      placeholder="Enter Blueair password"
                      className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBlueairPassword(!showBlueairPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1"
                      aria-label={showBlueairPassword ? "Hide password" : "Show password"}
                    >
                      {showBlueairPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleSaveBlueairCredentials}
                  disabled={savingBlueair || !blueairUsername || !blueairPassword}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {savingBlueair ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Credentials & Test Connection'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* HomeKit Bridge Pairing Info - Collapsible - Advanced */}
      {showAdvanced && bridgeAvailable && (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-4">
          <button
            onClick={() => setHomekitExpanded(!homekitExpanded)}
            className="w-full flex items-center justify-between mb-2"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Home className="w-5 h-5" />
              HomeKit Bridge Pairing
            </h3>
            {homekitExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Pair your Joule Bridge with HomeKit controllers (like Apple Home app) to control devices as HomeKit accessories.
          </p>
          
          {homekitExpanded && (
            <>
              {loadingHomekitInfo ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading pairing information...</span>
                </div>
              ) : homekitBridgeInfo?.available ? (
                <div className="space-y-4">
                  {homekitBridgeInfo.paired ? (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                        <span className="text-sm font-medium text-green-800 dark:text-green-200">
                          Bridge is paired ({homekitBridgeInfo.paired_clients_count} client{homekitBridgeInfo.paired_clients_count !== 1 ? 's' : ''})
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                        <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                          Bridge is not paired yet
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    {/* QR Code */}
                    <div className="flex-shrink-0">
                      <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                        <QRCodeSVG
                          value={homekitBridgeInfo.qr_data}
                          size={200}
                          level="M"
                          includeMargin={true}
                        />
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 text-center">
                        Scan with HomeKit app
                      </p>
                    </div>

                    {/* Pairing Info */}
                    <div className="flex-1 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Pairing Code
                        </label>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600">
                            <span className="text-2xl font-mono font-bold text-gray-900 dark:text-white tracking-wider">
                              {homekitBridgeInfo.pincode}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(homekitBridgeInfo.pincode);
                              alert('Pairing code copied to clipboard!');
                            }}
                            className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
                            title="Copy pairing code"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                        <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-2">How to Pair:</p>
                        <ol className="text-xs text-blue-800 dark:text-blue-300 list-decimal list-inside space-y-1">
                          <li>Open your HomeKit controller app (e.g., Apple Home app)</li>
                          <li>Tap the "+" button to add an accessory</li>
                          <li>Scan the QR code above, or enter the pairing code manually</li>
                          <li>Follow the on-screen instructions to complete pairing</li>
                        </ol>
                      </div>

                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        <p><strong>Port:</strong> {homekitBridgeInfo.port}</p>
                        <p><strong>Setup ID:</strong> {homekitBridgeInfo.setup_id}</p>
                      </div>

                      <button
                        onClick={loadHomeKitBridgeInfo}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-2 text-sm"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Refresh Info
                      </button>
                    </div>
                  </div>
                </div>
              ) : homekitBridgeInfo && !homekitBridgeInfo.available ? (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    <div className="text-sm text-yellow-800 dark:text-yellow-200">
                      <p className="font-medium">HomeKit bridge is not available</p>
                      <p className="text-xs mt-1">{homekitBridgeInfo.error || 'Bridge may not be started or HAP-python is not installed'}</p>
                    </div>
                  </div>
                  <button
                    onClick={loadHomeKitBridgeInfo}
                    className="mt-2 px-3 py-1.5 text-xs bg-yellow-200 dark:bg-yellow-800 hover:bg-yellow-300 dark:hover:bg-yellow-700 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry
                  </button>
                </div>
              ) : homekitBridgeInfo === null && !loadingHomekitInfo ? (
                <div className="p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <p>Pairing information not loaded. Click to load.</p>
                    </div>
                    <button
                      onClick={loadHomeKitBridgeInfo}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Load Pairing Info
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
      
      {/* Show button to start pairing onboarding if device is paired but not reachable */}
      {bridgeAvailable && pairedDevices.length > 0 && (() => {
        const unreachableDevices = pairedDevices.filter(id => deviceReachability[id] === false);
        const hasUnreachable = unreachableDevices.length > 0;
        if (!hasUnreachable) return null;
        
        return (
          <div className="mb-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Device Offline
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Your Ecobee is paired but not responding. The bridge will automatically try to reconnect, but if it doesn't work within 30 seconds, you may need to re-pair.
                </p>
                <button
                  onClick={() => setShowPairingOnboarding(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  <HelpCircle className="w-4 h-4 mr-2" />
                  Re-pair Device (Step-by-Step Guide)
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Pairing Onboarding Modal */}
      {showPairingOnboarding && (
        <EcobeePairingOnboarding
          onClose={() => {
            setShowPairingOnboarding(false);
            loadState(); // Refresh state after pairing
          }}
          onComplete={() => {
            setShowPairingOnboarding(false);
            loadState(); // Refresh state after pairing
          }}
        />
      )}
    </div>
  );
}

