import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  Server, 
  RefreshCw, 
  Download, 
  Play, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Terminal,
  Wifi,
  HardDrive,
  Clock,
  Cpu,
  Copy,
  ExternalLink,
  FileText,
  Volume2,
  Zap,
  Settings,
  Eye,
  EyeOff,
  Wind
} from 'lucide-react';
import TTSServiceSettings from '../components/TTSServiceSettings';
import { getBlueairCredentials, setBlueairCredentials } from '../lib/jouleBridgeApi';
import AskJoule from '../components/AskJoule';
import { indexMarkdownDocs } from '../utils/rag/loadMarkdownDocs';

// Voice Persona Selector Component (extracted from Settings.jsx)
const VoicePersonaSelector = () => {
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(() => {
    try {
      return localStorage.getItem("askJouleVoice") || "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    const loadVoices = () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const voices = window.speechSynthesis.getVoices();
        const englishVoices = voices
          .filter((v) => v.lang.startsWith("en"))
          .sort((a, b) => {
            const aIsGB = a.lang === "en-GB" || a.name.toLowerCase().includes("uk") || a.name.toLowerCase().includes("british");
            const bIsGB = b.lang === "en-GB" || b.name.toLowerCase().includes("uk") || b.name.toLowerCase().includes("british");
            if (aIsGB && !bIsGB) return -1;
            if (!aIsGB && bIsGB) return 1;
            const aIsMale = a.name.toLowerCase().includes("male");
            const bIsMale = b.name.toLowerCase().includes("male");
            if (aIsMale && !bIsMale) return -1;
            if (!aIsMale && bIsMale) return 1;
            return a.name.localeCompare(b.name);
          });
        setAvailableVoices(englishVoices);
      }
    };

    loadVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const handleVoiceChange = (e) => {
    const voiceName = e.target.value;
    setSelectedVoice(voiceName);
    try {
      if (voiceName) {
        localStorage.setItem("askJouleVoice", voiceName);
      } else {
        localStorage.removeItem("askJouleVoice");
      }
    } catch (err) {
      console.warn("Failed to save voice preference:", err);
    }
  };

  const getVoiceLabel = (voice) => {
    const lang = voice.lang === "en-GB" ? "🇬🇧 British" : voice.lang === "en-US" ? "🇺🇸 American" : "🇬🇧/🇺🇸";
    const gender = voice.name.toLowerCase().includes("male") ? "♂ Male" : voice.name.toLowerCase().includes("female") ? "♀ Female" : "";
    return `${lang} ${gender ? `- ${gender}` : ""} - ${voice.name}`;
  };

  if (availableVoices.length === 0) {
    return (
      <div className="text-sm text-slate-400">
        Loading voices...
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor="voice-picker-bridge"
        className="block text-sm font-medium text-slate-300 mb-2"
      >
        Voice Persona
      </label>
      <select
        id="voice-picker-bridge"
        value={selectedVoice}
        onChange={handleVoiceChange}
        className="w-full px-3 py-2 rounded-lg border border-slate-600 bg-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Voice persona selection"
      >
        <option value="">Default (Auto-select best voice)</option>
        {availableVoices.map((voice) => (
          <option key={voice.name} value={voice.name}>
            {getVoiceLabel(voice)}
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-xs text-slate-400 max-w-2xl leading-relaxed">
        Choose a voice for Ask Joule. British English voices sound more formal and authoritative (JARVIS-like).
      </p>
    </div>
  );
};

/**
 * Bridge Diagnostics Page
 * Self-service diagnostics and troubleshooting for the Joule Bridge
 * Check status, view logs, and perform basic maintenance tasks
 */
export default function BridgeSupport() {
  const [bridgeUrl, setBridgeUrl] = useState(() => {
    try {
      return localStorage.getItem('jouleBridgeUrl') || 
             import.meta.env.VITE_JOULE_BRIDGE_URL || 
             'http://joule-bridge.local:8080';
    } catch {
      return 'http://joule-bridge.local:8080';
    }
  });
  
  const [status, setStatus] = useState({
    connected: false,
    checking: false,
    error: null,
    health: null,
    version: null,
    updateAvailable: null,
    diagnostics: null,
    processes: null,
    logs: [],
    systemInfo: null,
    serviceStatus: null,
  });
  
  const [actions, setActions] = useState({
    updating: false,
    restarting: false,
    killing: false,
  });
  
  const [copyFeedback, setCopyFeedback] = useState('');
  
  // Remote pairing state
  const [pairingCode, setPairingCode] = useState('');
  const [selectedDevice, setSelectedDevice] = useState('');
  const [pairingStatus, setPairingStatus] = useState({ 
    loading: false, 
    success: false, 
    error: null 
  });
  
  // WiFi configuration state
  const [wifiStatus, setWifiStatus] = useState(null);
  const [wifiNetworks, setWifiNetworks] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiError, setWifiError] = useState(null);
  const [wifiSuccess, setWifiSuccess] = useState(null);
  
  // Blueair credentials state
  const [blueairUsername, setBlueairUsername] = useState('');
  const [blueairPassword, setBlueairPassword] = useState('');
  const [showBlueairPassword, setShowBlueairPassword] = useState(false);
  const [blueairCredentialsStatus, setBlueairCredentialsStatus] = useState(null);
  const [savingBlueair, setSavingBlueair] = useState(false);
  
  // Index markdown docs on mount
  useEffect(() => {
    indexMarkdownDocs().catch(err => {
      console.warn('[BridgeSupport] Failed to index markdown docs:', err);
    });
  }, []);

  // Voice settings state
  const [useBrowserTTS, setUseBrowserTTS] = useState(() => {
    try {
      return localStorage.getItem("useBrowserTTS") === "true";
    } catch {
      return false;
    }
  });

  // Fetch helper with timeout
  const fetchWithTimeout = useCallback(async (url, options = {}, timeout = 10000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }, []);

  // Check bridge status
  const checkStatus = useCallback(async () => {
    setStatus(prev => ({ ...prev, checking: true, error: null }));
    
    const results = {
      connected: false,
      health: null,
      version: null,
      updateAvailable: null,
      diagnostics: null,
      processes: null,
      error: null,
    };
    
    try {
      // Health check
      const healthRes = await fetchWithTimeout(`${bridgeUrl}/health`);
      if (healthRes.ok) {
        results.health = await healthRes.json();
        results.connected = true;
      }
    } catch (e) {
      results.error = `Cannot connect to bridge at ${bridgeUrl}`;
    }
    
    if (results.connected) {
      try {
        // Version info
        const versionRes = await fetchWithTimeout(`${bridgeUrl}/api/ota/version`);
        if (versionRes.ok) {
          results.version = await versionRes.json();
        }
      } catch (e) {
        console.debug('Version check failed:', e);
      }
      
      try {
        // Update check
        const updateRes = await fetchWithTimeout(`${bridgeUrl}/api/ota/check`);
        if (updateRes.ok) {
          results.updateAvailable = await updateRes.json();
        }
      } catch (e) {
        console.debug('Update check failed:', e);
      }
      
      try {
        // Diagnostics
        const diagRes = await fetchWithTimeout(`${bridgeUrl}/api/pairing/diagnostics`);
        if (diagRes.ok) {
          results.diagnostics = await diagRes.json();
        }
      } catch (e) {
        console.debug('Diagnostics failed:', e);
      }
      
      try {
        // Process check
        const procRes = await fetchWithTimeout(`${bridgeUrl}/api/bridge/processes`);
        if (procRes.ok) {
          results.processes = await procRes.json();
        }
      } catch (e) {
        console.debug('Process check failed:', e);
      }
      
      try {
        // System info
        const infoRes = await fetchWithTimeout(`${bridgeUrl}/api/bridge/info`);
        if (infoRes.ok) {
          results.systemInfo = await infoRes.json();
        }
      } catch (e) {
        console.debug('System info failed:', e);
      }
      
      try {
        // Logs (last 50 lines)
        const logsRes = await fetchWithTimeout(`${bridgeUrl}/api/bridge/logs?lines=50`);
        if (logsRes.ok) {
          const logsData = await logsRes.json();
          results.logs = logsData.logs || [];
        }
      } catch (e) {
        console.debug('Logs fetch failed:', e);
      }
      
      try {
        // WiFi status
        const wifiRes = await fetchWithTimeout(`${bridgeUrl}/api/wifi/status`);
        if (wifiRes.ok) {
          const wifiData = await wifiRes.json();
          setWifiStatus(wifiData);
        }
      } catch (e) {
        console.debug('WiFi status failed:', e);
      }
      
      try {
        // Blueair credentials status
        const blueairRes = await getBlueairCredentials();
        setBlueairCredentialsStatus(blueairRes);
        if (blueairRes.username) {
          setBlueairUsername(blueairRes.username);
        }
      } catch (e) {
        console.debug('Blueair credentials check failed:', e);
      }
      
      try {
        // Systemd service status
        const serviceRes = await fetchWithTimeout(`${bridgeUrl}/api/bridge/service-status`);
        if (serviceRes.ok) {
          results.serviceStatus = await serviceRes.json();
        }
      } catch (e) {
        console.debug('Service status check failed:', e);
      }
    }
    
    setStatus(prev => ({ ...prev, ...results, checking: false }));
  }, [bridgeUrl, fetchWithTimeout]);
  
  // Scan for WiFi networks
  const scanWiFi = async () => {
    if (!status.connected) return;
    setScanning(true);
    setWifiError(null);
    try {
      const res = await fetchWithTimeout(`${bridgeUrl}/api/wifi/scan`, {}, 15000);
      const data = await res.json();
      if (data.networks) {
        setWifiNetworks(data.networks);
      } else {
        setWifiError(data.error || 'Failed to scan networks');
      }
    } catch (e) {
      setWifiError(e.message || 'Failed to scan WiFi networks');
    } finally {
      setScanning(false);
    }
  };
  
  // Connect to WiFi network
  const connectWiFi = async () => {
    if (!status.connected || !selectedNetwork) return;
    setConnecting(true);
    setWifiError(null);
    setWifiSuccess(null);
    try {
      const res = await fetchWithTimeout(
        `${bridgeUrl}/api/wifi/connect`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ssid: selectedNetwork,
            password: wifiPassword
          })
        },
        35000
      );
      const data = await res.json();
      if (data.success) {
        setWifiSuccess(data.message || `Connected to ${selectedNetwork}`);
        setWifiPassword('');
        // Refresh WiFi status after connection
        setTimeout(() => {
          loadStatus();
        }, 2000);
      } else {
        setWifiError(data.error || 'Connection failed');
      }
    } catch (e) {
      setWifiError(e.message || 'Failed to connect to WiFi');
    } finally {
      setConnecting(false);
    }
  };
  
  // Save Blueair credentials
  const handleSaveBlueairCredentials = async () => {
    if (!status.connected || !blueairUsername || !blueairPassword) return;
    setSavingBlueair(true);
    try {
      const result = await setBlueairCredentials(blueairUsername, blueairPassword);
      if (result.success) {
        setBlueairCredentialsStatus({
          ...blueairCredentialsStatus,
          connected: true,
          devices_count: result.devices_count || 0,
          has_credentials: true
        });
        setBlueairPassword(''); // Clear password field
        // Refresh status
        setTimeout(() => {
          loadStatus();
        }, 1000);
      } else {
        setBlueairCredentialsStatus({
          ...blueairCredentialsStatus,
          connected: false,
          has_credentials: true,
          error: result.error || 'Connection failed'
        });
      }
    } catch (error) {
      setBlueairCredentialsStatus({
        ...blueairCredentialsStatus,
        connected: false,
        has_credentials: true,
        error: error.message || 'Failed to save credentials'
      });
    } finally {
      setSavingBlueair(false);
    }
  };

  // Trigger OTA update
  const triggerUpdate = async () => {
    if (!status.connected) return;
    
    setActions(prev => ({ ...prev, updating: true }));
    try {
      const res = await fetchWithTimeout(
        `${bridgeUrl}/api/ota/update`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } },
        120000 // 2 minute timeout for updates
      );
      const data = await res.json();
      if (data.success) {
        alert('✅ Update successful! The bridge will restart shortly.');
        // Wait for restart and re-check
        setTimeout(checkStatus, 15000);
      } else {
        alert(`❌ Update failed: ${data.error || 'Unknown error'}`);
      }
    } catch (e) {
      // Connection may drop during restart - this is expected
      alert('Update initiated. The bridge is restarting - please wait 30 seconds and refresh.');
      setTimeout(checkStatus, 30000);
    } finally {
      setActions(prev => ({ ...prev, updating: false }));
    }
  };

  // Trigger restart
  const triggerRestart = async () => {
    if (!status.connected) return;
    
    setActions(prev => ({ ...prev, restarting: true }));
    try {
      const res = await fetchWithTimeout(
        `${bridgeUrl}/api/bridge/restart`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } },
        30000
      );
      const data = await res.json();
      alert('🔄 Restart initiated. Please wait 15 seconds.');
      setTimeout(checkStatus, 15000);
    } catch (e) {
      // Connection may drop during restart - this is expected
      alert('Restart initiated. Please wait 15 seconds and refresh.');
      setTimeout(checkStatus, 15000);
    } finally {
      setActions(prev => ({ ...prev, restarting: false }));
    }
  };

  // Kill duplicate processes
  const killDuplicates = async () => {
    if (!status.connected || !status.processes?.has_duplicates) return;
    
    setActions(prev => ({ ...prev, killing: true }));
    try {
      const res = await fetchWithTimeout(
        `${bridgeUrl}/api/bridge/kill-duplicates`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );
      const data = await res.json();
      if (data.success) {
        alert(`✅ Killed ${data.killed_count || 0} duplicate process(es).`);
        checkStatus();
      } else {
        alert(`❌ Failed: ${data.error || 'Unknown error'}`);
      }
    } catch (e) {
      alert(`❌ Error: ${e.message}`);
    } finally {
      setActions(prev => ({ ...prev, killing: false }));
    }
  };

  // Remote pairing - pair a device with the bridge using user-provided code
  const handleRemotePairing = async () => {
    if (!selectedDevice || !pairingCode) {
      alert('Please select a device and enter the pairing code.');
      return;
    }
    
    // Validate pairing code format (must be xxx-xx-xxx)
    if (!/^\d{3}-\d{2}-\d{3}$/.test(pairingCode)) {
      alert('Pairing code must be in format xxx-xx-xxx (e.g., 123-45-678)');
      return;
    }
    // Remove dashes for the API call
    const cleanCode = pairingCode.replace(/-/g, '');
    
    setPairingStatus({ loading: true, success: false, error: null });
    
    try {
      const res = await fetchWithTimeout(
        `${bridgeUrl}/api/pair`,
        { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_id: selectedDevice,
            pairing_code: cleanCode
          })
        },
        60000 // 60 second timeout for pairing
      );
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setPairingStatus({ loading: false, success: true, error: null });
        setPairingCode('');
        setSelectedDevice('');
        alert('✅ Pairing successful! The device is now paired with the bridge.');
        checkStatus(); // Refresh to show new pairing
      } else {
        setPairingStatus({ 
          loading: false, 
          success: false, 
          error: data.error || data.detail || 'Pairing failed' 
        });
      }
    } catch (e) {
      setPairingStatus({ 
        loading: false, 
        success: false, 
        error: e.message || 'Connection error during pairing' 
      });
    }
  };

  // Copy diagnostic report to clipboard
  const copyDiagnosticReport = () => {
    const report = generateDiagnosticReport();
    navigator.clipboard.writeText(report).then(() => {
      setCopyFeedback('Copied!');
      setTimeout(() => setCopyFeedback(''), 2000);
    }).catch(() => {
      setCopyFeedback('Failed to copy');
      setTimeout(() => setCopyFeedback(''), 2000);
    });
  };

  // Generate diagnostic report for support tickets
  const generateDiagnosticReport = () => {
    const lines = [
      '=== JOULE BRIDGE DIAGNOSTIC REPORT ===',
      `Generated: ${new Date().toISOString()}`,
      '',
      '--- Connection ---',
      `Bridge URL: ${bridgeUrl}`,
      `Connected: ${status.connected ? 'Yes' : 'No'}`,
      `Error: ${status.error || 'None'}`,
      '',
    ];
    
    if (status.version) {
      lines.push('--- Version ---');
      lines.push(`Current Version: ${status.version.version}`);
      lines.push(`Service Path: ${status.version.service_path}`);
      lines.push('');
    }
    
    if (status.updateAvailable) {
      lines.push('--- Updates ---');
      lines.push(`Current: ${status.updateAvailable.current_version}`);
      lines.push(`Latest: ${status.updateAvailable.latest_version}`);
      lines.push(`Update Available: ${status.updateAvailable.update_available ? 'Yes' : 'No'}`);
      lines.push('');
    }
    
    if (status.diagnostics) {
      lines.push('--- Pairing Diagnostics ---');
      lines.push(`Status: ${status.diagnostics.status}`);
      lines.push(`Discovered Devices: ${status.diagnostics.discovered_devices?.join(', ') || 'None'}`);
      lines.push(`Stored Pairings: ${status.diagnostics.stored_pairings?.join(', ') || 'None'}`);
      if (status.diagnostics.issues?.length > 0) {
        const issueStrings = status.diagnostics.issues.map(i => typeof i === 'string' ? i : i?.message || JSON.stringify(i));
        lines.push(`Issues: ${issueStrings.join('; ')}`);
      }
      if (status.diagnostics.recommendations?.length > 0) {
        const recStrings = status.diagnostics.recommendations.map(r => typeof r === 'string' ? r : r?.message || JSON.stringify(r));
        lines.push(`Recommendations: ${recStrings.join('; ')}`);
      }
      lines.push('');
    }
    
    if (status.processes) {
      lines.push('--- Processes ---');
      lines.push(`Total Processes: ${status.processes.total_processes}`);
      lines.push(`Has Duplicates: ${status.processes.has_duplicates ? 'Yes' : 'No'}`);
      lines.push(`PIDs: ${status.processes.pids?.join(', ') || 'None'}`);
      lines.push('');
    }
    
    if (status.systemInfo) {
      lines.push('--- System Info ---');
      lines.push(`Hostname: ${status.systemInfo.hostname}`);
      lines.push(`Local IP: ${status.systemInfo.local_ip}`);
      if (status.systemInfo.tailscale_ip) {
        lines.push(`Tailscale IP: ${status.systemInfo.tailscale_ip} (REMOTE ACCESS AVAILABLE)`);
        lines.push(`Remote URL: http://${status.systemInfo.tailscale_ip}:8080`);
      } else {
        lines.push(`Tailscale: Not installed or not running`);
      }
      lines.push(`Platform: ${status.systemInfo.platform}`);
      lines.push(`Uptime: ${status.systemInfo.uptime || 'N/A'}`);
      if (status.systemInfo.memory) {
        lines.push(`Memory: ${status.systemInfo.memory.available_mb}MB free (${status.systemInfo.memory.used_percent}% used)`);
      }
      if (status.systemInfo.disk) {
        lines.push(`Disk: ${status.systemInfo.disk.free_gb}GB free (${status.systemInfo.disk.used_percent}% used)`);
      }
      lines.push('');
    }
    
    if (status.logs.length > 0) {
      lines.push('--- Recent Logs (last 10 lines) ---');
      status.logs.slice(-10).forEach(log => lines.push(log));
      lines.push('');
    }
    
    lines.push('=== END REPORT ===');
    return lines.join('\n');
  };

  // Initial check on mount
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Auto-refresh every 30 seconds when connected
  useEffect(() => {
    if (status.connected) {
      const interval = setInterval(checkStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [status.connected, checkStatus]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 md:p-8">
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="w-8 h-8 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold">Bridge Diagnostics</h1>
              <p className="text-slate-400 text-sm">Check status, view logs, and troubleshoot issues</p>
            </div>
          </div>
          <button
            onClick={checkStatus}
            disabled={status.checking}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${status.checking ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Connection URL */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <label className="block text-sm text-slate-400 mb-2">Bridge URL</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={bridgeUrl}
              onChange={(e) => setBridgeUrl(e.target.value)}
              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
              placeholder="http://joule-bridge.local:8080"
            />
            <button
              onClick={() => {
                localStorage.setItem('jouleBridgeUrl', bridgeUrl);
                checkStatus();
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
            >
              Save & Check
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Try: <code className="bg-slate-700 px-1 rounded">http://joule-bridge.local:8080</code> or the IP address
          </p>
        </div>

        {/* Status Card */}
        <div className={`rounded-xl p-6 border ${
          status.connected 
            ? 'bg-green-900/20 border-green-700' 
            : 'bg-red-900/20 border-red-700'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            {status.connected ? (
              <>
                <CheckCircle className="w-6 h-6 text-green-400" />
                <span className="text-lg font-semibold text-green-400">Bridge Connected</span>
              </>
            ) : (
              <>
                <XCircle className="w-6 h-6 text-red-400" />
                <span className="text-lg font-semibold text-red-400">Bridge Offline</span>
              </>
            )}
          </div>
          
          {status.error && (
            <p className="text-red-300 text-sm mb-4">{status.error}</p>
          )}
          
          {/* Service Status Diagnostics */}
          {status.serviceStatus && (
            <div className="mb-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Systemd Service Status
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-slate-400">Installed</p>
                  <p className={status.serviceStatus.installed ? 'text-green-400' : 'text-red-400'}>
                    {status.serviceStatus.installed ? '✅ Yes' : '❌ No'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Enabled</p>
                  <p className={status.serviceStatus.enabled ? 'text-green-400' : 'text-yellow-400'}>
                    {status.serviceStatus.enabled ? '✅ Yes' : '⚠️ No'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Running</p>
                  <p className={status.serviceStatus.running ? 'text-green-400' : 'text-red-400'}>
                    {status.serviceStatus.running ? '✅ Yes' : '❌ No'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Failed</p>
                  <p className={status.serviceStatus.failed ? 'text-red-400' : 'text-green-400'}>
                    {status.serviceStatus.failed ? '❌ Yes' : '✅ No'}
                  </p>
                </div>
              </div>
              
              {!status.serviceStatus.running && (
                <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                  <p className="text-yellow-300 text-sm font-semibold mb-2">⚠️ Service Not Running</p>
                  <p className="text-yellow-200 text-xs mb-3">
                    The bridge service should auto-start on boot. If it's not running, try these steps:
                  </p>
                  <ol className="text-yellow-200 text-xs space-y-1 list-decimal list-inside">
                    {!status.serviceStatus.installed && (
                      <li>Service not installed. Run: <code className="bg-slate-700 px-1 rounded">cd ~/prostat-bridge && ./install-service.sh</code></li>
                    )}
                    {status.serviceStatus.installed && !status.serviceStatus.enabled && (
                      <li>Service not enabled. Run: <code className="bg-slate-700 px-1 rounded">sudo systemctl enable prostat-bridge</code></li>
                    )}
                    {status.serviceStatus.enabled && !status.serviceStatus.running && (
                      <li>Start the service: <code className="bg-slate-700 px-1 rounded">sudo systemctl start prostat-bridge</code></li>
                    )}
                    {status.serviceStatus.failed && (
                      <li>Service failed. Check logs: <code className="bg-slate-700 px-1 rounded">sudo journalctl -u prostat-bridge -n 50</code></li>
                    )}
                    <li>Check service status: <code className="bg-slate-700 px-1 rounded">sudo systemctl status prostat-bridge</code></li>
                  </ol>
                  {status.serviceStatus.status_text && (
                    <details className="mt-3">
                      <summary className="text-yellow-300 text-xs cursor-pointer">View service status output</summary>
                      <pre className="mt-2 text-xs bg-slate-900 p-2 rounded overflow-auto max-h-40 text-slate-300">
                        {status.serviceStatus.status_text}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
          
          {status.connected && status.version && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-slate-400">Version</p>
                <p className="font-mono">{status.version.version}</p>
              </div>
              <div>
                <p className="text-slate-400">Service Path</p>
                <p className="font-mono text-xs truncate">{status.version.service_path}</p>
              </div>
              {status.updateAvailable && (
                <>
                  <div>
                    <p className="text-slate-400">Latest Version</p>
                    <p className="font-mono">{status.updateAvailable.latest_version}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Update Status</p>
                    <p className={status.updateAvailable.update_available ? 'text-yellow-400' : 'text-green-400'}>
                      {status.updateAvailable.update_available ? '⚠️ Update Available' : '✅ Up to Date'}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {status.connected && (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              Remote Actions
            </h2>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={triggerUpdate}
                disabled={actions.updating || !status.updateAvailable?.update_available}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className={`w-4 h-4 ${actions.updating ? 'animate-bounce' : ''}`} />
                {actions.updating ? 'Updating...' : 'OTA Update'}
              </button>
              
              <button
                onClick={triggerRestart}
                disabled={actions.restarting}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${actions.restarting ? 'animate-spin' : ''}`} />
                {actions.restarting ? 'Restarting...' : 'Restart Service'}
              </button>
              
              {status.processes?.has_duplicates && (
                <button
                  onClick={killDuplicates}
                  disabled={actions.killing}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
                >
                  <AlertTriangle className="w-4 h-4" />
                  {actions.killing ? 'Killing...' : `Kill ${status.processes.total_processes - 1} Duplicates`}
                </button>
              )}
            </div>
            
            <p className="text-xs text-slate-500 mt-4">
              ⚠️ OTA Update pulls latest code from GitHub and restarts the service. Connection will drop briefly.
            </p>
          </div>
        )}

        {/* Diagnostics */}
        {status.connected && status.diagnostics && (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Cpu className="w-5 h-5" />
              Pairing Diagnostics
            </h2>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Status</span>
                <span className={status.diagnostics.status === 'ok' ? 'text-green-400' : 'text-yellow-400'}>
                  {status.diagnostics.status}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-slate-400">Discovered Devices</span>
                <span>{status.diagnostics.discovered_devices?.length || 0}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-slate-400">Stored Pairings</span>
                <span>{status.diagnostics.stored_pairings?.length || 0}</span>
              </div>
              
              {status.diagnostics.issues?.length > 0 && (
                <div className="mt-4 p-3 bg-yellow-900/30 rounded-lg border border-yellow-700">
                  <p className="text-yellow-400 font-medium mb-2">⚠️ Issues Found:</p>
                  <ul className="list-disc list-inside text-yellow-300 text-xs space-y-1">
                    {status.diagnostics.issues.map((issue, i) => (
                      <li key={i}>{typeof issue === 'string' ? issue : issue?.message || JSON.stringify(issue)}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {status.diagnostics.recommendations?.length > 0 && (
                <div className="mt-4 p-3 bg-blue-900/30 rounded-lg border border-blue-700">
                  <p className="text-blue-400 font-medium mb-2">💡 Recommendations:</p>
                  <ul className="list-disc list-inside text-blue-300 text-xs space-y-1">
                    {status.diagnostics.recommendations.map((rec, i) => (
                      <li key={i}>{typeof rec === 'string' ? rec : rec?.message || JSON.stringify(rec)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Remote Pairing - for support staff to pair on behalf of user */}
        {status.connected && status.diagnostics?.discovered_devices?.length > 0 && status.diagnostics?.stored_pairings?.length === 0 && (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-green-700">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Wifi className="w-5 h-5 text-green-400" />
              🎯 Remote Pairing
              <span className="text-xs font-normal text-green-400 bg-green-900/50 px-2 py-0.5 rounded">Support Tool</span>
            </h2>
            
            <p className="text-sm text-slate-300 mb-4">
              Pair the user's Ecobee on their behalf. Have the user read you the 8-digit pairing code from their thermostat.
            </p>
            
            <div className="space-y-4">
              {/* Device Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Select Device to Pair
                </label>
                <select
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">-- Select a discovered device --</option>
                  {status.diagnostics.discovered_devices.map((deviceId) => (
                    <option key={deviceId} value={deviceId}>
                      {deviceId}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Pairing Code Input */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  8-Digit Pairing Code (xxx-xx-xxx)
                </label>
                <input
                  type="text"
                  value={pairingCode}
                  onChange={(e) => {
                    // Auto-format as xxx-xx-xxx
                    let value = e.target.value.replace(/[^0-9]/g, ''); // Keep only digits
                    if (value.length > 8) value = value.slice(0, 8);
                    
                    // Add dashes at correct positions
                    if (value.length > 5) {
                      value = value.slice(0, 3) + '-' + value.slice(3, 5) + '-' + value.slice(5);
                    } else if (value.length > 3) {
                      value = value.slice(0, 3) + '-' + value.slice(3);
                    }
                    
                    setPairingCode(value);
                  }}
                  placeholder="123-45-678"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-2xl tracking-widest text-center"
                  maxLength={10}
                />
                <p className="text-xs text-slate-400 mt-1">
                  The user can find this code on their Ecobee: Menu → Settings → HomeKit → Start Pairing
                </p>
              </div>
              
              {/* Pairing Button */}
              <button
                onClick={handleRemotePairing}
                disabled={pairingStatus.loading || !selectedDevice || !pairingCode}
                className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {pairingStatus.loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Pairing... (this may take up to 60 seconds)
                  </>
                ) : (
                  <>
                    <Wifi className="w-5 h-5" />
                    Pair Device Remotely
                  </>
                )}
              </button>
              
              {/* Status Messages */}
              {pairingStatus.success && (
                <div className="p-3 bg-green-900/50 border border-green-600 rounded-lg">
                  <p className="text-green-400 font-medium flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Pairing successful! The device is now connected.
                  </p>
                </div>
              )}
              
              {pairingStatus.error && (
                <div className="p-3 bg-red-900/50 border border-red-600 rounded-lg">
                  <p className="text-red-400 font-medium flex items-center gap-2">
                    <XCircle className="w-5 h-5" />
                    Pairing failed: {pairingStatus.error}
                  </p>
                  <p className="text-red-300 text-xs mt-2">
                    Common issues: Wrong code, code expired (try generating a new one on the Ecobee), or device already paired elsewhere.
                  </p>
                </div>
              )}
              
              {/* Instructions */}
              <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                <p className="text-slate-300 font-medium mb-2">📞 Instructions for the user:</p>
                <ol className="list-decimal list-inside text-xs text-slate-400 space-y-1">
                  <li>On your Ecobee, go to <strong>Menu → Settings → HomeKit</strong></li>
                  <li>If it says "Paired", tap <strong>Unpair</strong> first</li>
                  <li>Tap <strong>Start Pairing</strong></li>
                  <li>Read me the 8-digit code on screen</li>
                  <li>Wait for me to confirm pairing is complete</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Already Paired Message */}
        {status.connected && status.diagnostics?.stored_pairings?.length > 0 && (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-green-700">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Device Already Paired
            </h2>
            <p className="text-sm text-slate-300">
              This bridge already has a paired device. No additional pairing is needed.
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Paired device(s): {status.diagnostics.stored_pairings.join(', ')}
            </p>
          </div>
        )}

        {/* Process Info */}
        {status.connected && status.processes && (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              Process Information
            </h2>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Running Instances</span>
                <span className={status.processes.has_duplicates ? 'text-red-400' : 'text-green-400'}>
                  {status.processes.total_processes}
                  {status.processes.has_duplicates && ' (duplicates!)'}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-slate-400">Process IDs</span>
                <span className="font-mono">{status.processes.pids?.join(', ') || 'None'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tailscale Remote Access */}
        {status.connected && status.systemInfo && (
          <div className={`rounded-xl p-6 border ${
            status.systemInfo.tailscale_ip 
              ? 'bg-purple-900/20 border-purple-700' 
              : 'bg-slate-800/50 border-slate-700'
          }`}>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Wifi className="w-5 h-5 text-purple-400" />
              Remote Support Access (Tailscale)
            </h2>
            
            {status.systemInfo.tailscale_ip ? (
              <div className="space-y-4">
                <div className="p-4 bg-purple-900/30 rounded-lg border border-purple-600">
                  <p className="text-purple-300 text-sm mb-2">🎉 Tailscale is active! You can access this bridge remotely:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-slate-900 rounded-lg text-purple-200 font-mono">
                      http://{status.systemInfo.tailscale_ip}:8080
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`http://${status.systemInfo.tailscale_ip}:8080`);
                        setCopyFeedback('Copied!');
                        setTimeout(() => setCopyFeedback(''), 2000);
                      }}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  {status.systemInfo.tailscale?.dns_name && (
                    <p className="text-xs text-purple-400 mt-2">
                      Also available at: <code className="bg-slate-900 px-1 rounded">{status.systemInfo.tailscale.dns_name}</code>
                    </p>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  As long as you're on the same Tailscale network, you can paste this URL into the Bridge URL field above to access this bridge remotely.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-slate-900 rounded-lg">
                  <p className="text-slate-400 text-sm mb-2">
                    {status.systemInfo.tailscale?.installed === false 
                      ? '❌ Tailscale is not installed on this bridge'
                      : status.systemInfo.tailscale?.running === false
                        ? '⏸️ Tailscale is installed but not running'
                        : '⚠️ Tailscale IP not available'}
                  </p>
                  <p className="text-xs text-slate-500">
                    To enable remote support access, the user needs to install Tailscale on their bridge.
                  </p>
                </div>
                
                <div className="p-4 bg-blue-900/20 rounded-lg border border-blue-700">
                  <p className="text-blue-400 font-medium mb-2">📋 Setup Instructions for User:</p>
                  <ol className="list-decimal list-inside text-xs text-blue-300 space-y-1">
                    <li>SSH into bridge: <code className="bg-slate-900 px-1 rounded">ssh user@{status.systemInfo.local_ip}</code></li>
                    <li>Install Tailscale: <code className="bg-slate-900 px-1 rounded">curl -fsSL https://tailscale.com/install.sh | sh</code></li>
                    <li>Authenticate: <code className="bg-slate-900 px-1 rounded">sudo tailscale up</code></li>
                    <li>Share the Tailscale IP with support</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        )}

        {/* WiFi Configuration */}
        {status.connected && (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Wifi className="w-5 h-5" />
              WiFi Configuration
              <span className="text-xs font-normal text-blue-400 bg-blue-900/50 px-2 py-0.5 rounded">Remote Setup</span>
            </h2>
            
            {/* Current WiFi Status */}
            {wifiStatus && (
              <div className="mb-6 p-4 bg-slate-900 rounded-lg border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-300">Current Connection</span>
                  {wifiStatus.connected ? (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      wifiStatus.is_2_4ghz 
                        ? 'bg-green-900/50 text-green-400 border border-green-700' 
                        : 'bg-yellow-900/50 text-yellow-400 border border-yellow-700'
                    }`}>
                      {wifiStatus.is_2_4ghz ? '✅ 2.4 GHz' : '⚠️ 5 GHz'}
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-red-900/50 text-red-400 border border-red-700">
                      Not Connected
                    </span>
                  )}
                </div>
                {wifiStatus.connected ? (
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Network:</span>
                      <span className="font-mono text-slate-200">{wifiStatus.ssid || 'Unknown'}</span>
                    </div>
                    {wifiStatus.frequency_ghz && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Frequency:</span>
                        <span className="font-mono text-slate-200">{wifiStatus.frequency_ghz.toFixed(2)} GHz</span>
                      </div>
                    )}
                    {wifiStatus.ip_address && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">IP Address:</span>
                        <span className="font-mono text-slate-200">{wifiStatus.ip_address}</span>
                      </div>
                    )}
                    {!wifiStatus.is_2_4ghz && wifiStatus.frequency_ghz && (
                      <div className="mt-2 p-2 bg-yellow-900/30 border border-yellow-700 rounded text-xs text-yellow-300">
                        ⚠️ Warning: Connected to 5 GHz. Ecobee and Blueair require 2.4 GHz WiFi. Please connect to a 2.4 GHz network.
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No WiFi connection detected</p>
                )}
              </div>
            )}
            
            {/* Scan and Connect */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={scanWiFi}
                  disabled={scanning}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
                  {scanning ? 'Scanning...' : 'Scan for Networks'}
                </button>
                {wifiNetworks.length > 0 && (
                  <span className="text-sm text-slate-400">
                    Found {wifiNetworks.length} network{wifiNetworks.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              
              {/* Network List */}
              {wifiNetworks.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {wifiNetworks.map((network, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedNetwork === network.ssid
                          ? 'bg-blue-900/30 border-blue-600'
                          : 'bg-slate-900 border-slate-700 hover:border-slate-600'
                      }`}
                      onClick={() => {
                        setSelectedNetwork(network.ssid);
                        setWifiError(null);
                        setWifiSuccess(null);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{network.ssid}</span>
                            {network.is_2_4ghz !== null && (
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                network.is_2_4ghz
                                  ? 'bg-green-900/50 text-green-400 border border-green-700'
                                  : 'bg-yellow-900/50 text-yellow-400 border border-yellow-700'
                              }`}>
                                {network.is_2_4ghz ? '2.4 GHz' : '5 GHz'}
                              </span>
                            )}
                            {network.security && network.security !== 'open' && (
                              <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300">
                                🔒 {network.security}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 bg-slate-700 rounded-full h-2">
                              <div
                                className="bg-green-500 h-2 rounded-full"
                                style={{ width: `${network.signal}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-400">{network.signal}%</span>
                          </div>
                        </div>
                        {selectedNetwork === network.ssid && (
                          <CheckCircle className="w-5 h-5 text-blue-400 ml-2" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Password Input */}
              {selectedNetwork && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">
                    Password for "{selectedNetwork}"
                  </label>
                  <input
                    type="password"
                    value={wifiPassword}
                    onChange={(e) => setWifiPassword(e.target.value)}
                    placeholder={wifiNetworks.find(n => n.ssid === selectedNetwork)?.security === 'open' ? 'Open network (no password)' : 'Enter WiFi password'}
                    disabled={wifiNetworks.find(n => n.ssid === selectedNetwork)?.security === 'open'}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  />
                  <button
                    onClick={connectWiFi}
                    disabled={connecting || !selectedNetwork}
                    className="w-full px-4 py-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {connecting ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Connecting... (this may take 30 seconds)
                      </>
                    ) : (
                      <>
                        <Wifi className="w-5 h-5" />
                        Connect to {selectedNetwork}
                      </>
                    )}
                  </button>
                </div>
              )}
              
              {/* Status Messages */}
              {wifiSuccess && (
                <div className="p-3 bg-green-900/50 border border-green-600 rounded-lg">
                  <p className="text-green-400 font-medium flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    {wifiSuccess}
                  </p>
                </div>
              )}
              
              {wifiError && (
                <div className="p-3 bg-red-900/50 border border-red-600 rounded-lg">
                  <p className="text-red-400 font-medium flex items-center gap-2">
                    <XCircle className="w-5 h-5" />
                    {wifiError}
                  </p>
                </div>
              )}
              
              {/* Important Notice */}
              <div className="p-4 bg-yellow-900/20 rounded-lg border border-yellow-700">
                <p className="text-yellow-300 text-sm font-medium mb-2">⚠️ Important: 2.4 GHz Required</p>
                <p className="text-yellow-200 text-xs">
                  Ecobee and Blueair devices require 2.4 GHz WiFi. If your router has separate networks, 
                  connect to the <strong>2.4 GHz network</strong> (e.g., "YourNetwork-2.4GHz"). 
                  Networks marked with "5 GHz" will not work with these devices.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Blueair Credentials Configuration */}
        {status.connected && (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Wind className="w-5 h-5" />
              Blueair Air Purifier Credentials
              <span className="text-xs font-normal text-blue-400 bg-blue-900/50 px-2 py-0.5 rounded">Remote Setup</span>
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              Configure your Blueair account credentials to enable air purifier control. These are the same credentials you use in the Blueair mobile app.
            </p>
            
            {/* Connection Status */}
            {blueairCredentialsStatus && (
              <div className={`mb-4 p-3 rounded-lg border ${
                blueairCredentialsStatus.connected
                  ? 'bg-green-900/30 border-green-600'
                  : 'bg-yellow-900/30 border-yellow-600'
              }`}>
                <div className="flex items-center gap-2">
                  {blueairCredentialsStatus.connected ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  )}
                  <div className="text-sm">
                    {blueairCredentialsStatus.connected ? (
                      <span className="text-green-300">
                        ✅ Connected: {blueairCredentialsStatus.devices_count || 0} device(s) found
                      </span>
                    ) : (
                      <span className="text-yellow-300">
                        {blueairCredentialsStatus.has_credentials 
                          ? '⚠️ Credentials saved but not connected. Check username/password.'
                          : 'No credentials configured'}
                      </span>
                    )}
                  </div>
                </div>
                {blueairCredentialsStatus.error && (
                  <p className="text-xs text-red-300 mt-2 ml-7">
                    Error: {blueairCredentialsStatus.error}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Email / Username
                </label>
                <input
                  type="text"
                  value={blueairUsername}
                  onChange={(e) => setBlueairUsername(e.target.value)}
                  placeholder="bunnyrita@gmail.com"
                  className="w-full px-3 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showBlueairPassword ? "text" : "password"}
                    value={blueairPassword}
                    onChange={(e) => setBlueairPassword(e.target.value)}
                    placeholder="Enter Blueair password"
                    className="w-full px-3 py-2 pr-10 rounded-lg border border-slate-600 bg-slate-700 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowBlueairPassword(!showBlueairPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
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
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {savingBlueair ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving & Testing Connection...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Save Credentials & Test Connection
                  </>
                )}
              </button>
              
              {/* Help Text */}
              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <p className="text-xs text-slate-400">
                  <strong className="text-slate-300">Note:</strong> These are the same credentials you use to log into the Blueair mobile app. 
                  If you're having trouble connecting, verify the credentials work in the Blueair app first.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* System Info */}
        {status.connected && status.systemInfo && (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Cpu className="w-5 h-5" />
              System Information
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-slate-400">Hostname</p>
                <p className="font-mono">{status.systemInfo.hostname}</p>
              </div>
              <div>
                <p className="text-slate-400">Local IP</p>
                <p className="font-mono">{status.systemInfo.local_ip}</p>
              </div>
              <div>
                <p className="text-slate-400">Uptime</p>
                <p>{status.systemInfo.uptime || 'N/A'}</p>
              </div>
              {status.systemInfo.memory && (
                <div>
                  <p className="text-slate-400">Memory</p>
                  <p>{status.systemInfo.memory.available_mb}MB free ({100 - status.systemInfo.memory.used_percent}%)</p>
                </div>
              )}
              {status.systemInfo.disk && (
                <div>
                  <p className="text-slate-400">Disk</p>
                  <p>{status.systemInfo.disk.free_gb}GB free ({100 - status.systemInfo.disk.used_percent}%)</p>
                </div>
              )}
              <div className="col-span-2 md:col-span-3">
                <p className="text-slate-400">Platform</p>
                <p className="font-mono text-xs truncate">{status.systemInfo.platform}</p>
              </div>
            </div>
          </div>
        )}

        {/* Live Logs */}
        {status.connected && status.logs.length > 0 && (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              Recent Logs ({status.logs.length} lines)
            </h2>
            
            <pre className="p-4 bg-slate-900 rounded-lg text-xs overflow-x-auto max-h-64 overflow-y-auto font-mono text-slate-300 whitespace-pre-wrap">
              {status.logs.join('\n')}
            </pre>
          </div>
        )}

        {/* Voice Settings */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Volume2 className="w-5 h-5" />
            Voice Settings
          </h2>
          
          <div className="space-y-6">
            {/* Browser TTS Toggle */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useBrowserTTS}
                  onChange={(e) => {
                    const useBrowser = e.target.checked;
                    setUseBrowserTTS(useBrowser);
                    try {
                      localStorage.setItem("useBrowserTTS", useBrowser.toString());
                      window.dispatchEvent(new Event("ttsEngineChanged"));
                    } catch (err) {
                      console.warn("Failed to save TTS engine preference:", err);
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-sm font-medium text-slate-300">
                  Use Browser TTS (instead of Premium TTS)
                </span>
              </label>
              <p className="mt-1 text-xs text-slate-400 ml-6">
                {useBrowserTTS
                  ? "Using browser's built-in text-to-speech. Free and unlimited."
                  : "Using premium TTS service (ElevenLabs) - requires monthly subscription. High-quality voice synthesis with natural-sounding speech."}
              </p>
            </div>

            {/* Coqui TTS Service */}
            <div>
              <TTSServiceSettings />
            </div>

            {/* Voice Persona Selector */}
            <VoicePersonaSelector />
          </div>
        </div>

        {/* Remote Settings Configuration */}
        {status.connected && (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Remote Settings Configuration
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              Configure all user settings remotely via Tailscale. Access the full settings page to modify system, building, thermostat, and energy settings.
            </p>
            <Link
              to="/remote-settings"
              state={{ bridgeUrl }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors text-white font-medium"
            >
              <Settings className="w-4 h-4" />
              Open Remote Settings
            </Link>
          </div>
        )}

        {/* Ask Joule - RAG Prompt */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Ask Joule - Documentation Search
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Ask questions about bridge setup, troubleshooting, or any documentation. Joule will search through all indexed markdown files to find answers.
          </p>
          <div className="bg-slate-900/50 rounded-lg p-4">
            <AskJoule
              hasLocation={false}
              userSettings={{}}
              userLocation={null}
              onParsed={() => {}}
              onNavigate={() => {}}
              onSettingChange={() => {}}
              auditLog={[]}
              onUndo={() => {}}
            />
          </div>
        </div>

        {/* Documentation Links */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Documentation
          </h2>
          
          <div className="space-y-3">
            <Link
              to="/docs/USER_MANUAL.md"
              className="flex items-center gap-3 p-3 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
            >
              <FileText className="w-5 h-5 text-blue-400" />
              <div>
                <p className="font-medium text-white">User Manual</p>
                <p className="text-xs text-slate-400">Complete setup and usage guide for end users</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 ml-auto" />
            </Link>
            
            <Link
              to="/docs/ADMIN_MANUAL.md"
              className="flex items-center gap-3 p-3 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
            >
              <FileText className="w-5 h-5 text-purple-400" />
              <div>
                <p className="font-medium text-white">Support Manual</p>
                <p className="text-xs text-slate-400">Remote support and troubleshooting for support staff</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 ml-auto" />
            </Link>
          </div>
        </div>

        {/* Diagnostic Report */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Copy className="w-5 h-5" />
            Support Ticket
          </h2>
          
          <p className="text-sm text-slate-400 mb-4">
            Copy the diagnostic report below and include it in your support ticket.
          </p>
          
          <div className="flex gap-2">
            <button
              onClick={copyDiagnosticReport}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              <Copy className="w-4 h-4" />
              {copyFeedback || 'Copy Diagnostic Report'}
            </button>
          </div>
          
          <pre className="mt-4 p-4 bg-slate-900 rounded-lg text-xs overflow-x-auto max-h-64 overflow-y-auto font-mono text-slate-300">
            {generateDiagnosticReport()}
          </pre>
        </div>

        {/* Troubleshooting Guide */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            If Bridge is Offline
          </h2>
          
          <div className="space-y-4 text-sm">
            <div className="p-4 bg-slate-900 rounded-lg">
              <p className="font-medium text-white mb-2">1. Check Service Status (Most Common Issue)</p>
              <p className="text-slate-400 mb-2 text-xs">
                The bridge should auto-start on boot. If it didn't, the service may not be installed, enabled, or may have failed to start.
              </p>
              <ul className="list-disc list-inside text-slate-400 space-y-1">
                <li>If you can connect to the bridge, check the "Systemd Service Status" section above</li>
                <li>If you can't connect, SSH into the mini PC and check: <code className="bg-slate-700 px-1 rounded">sudo systemctl status prostat-bridge</code></li>
                <li>If service is not installed: <code className="bg-slate-700 px-1 rounded">cd ~/prostat-bridge && ./install-service.sh</code></li>
                <li>If service is not enabled: <code className="bg-slate-700 px-1 rounded">sudo systemctl enable prostat-bridge</code></li>
                <li>If service failed: <code className="bg-slate-700 px-1 rounded">sudo journalctl -u prostat-bridge -n 50</code> to see errors</li>
                <li>To start manually: <code className="bg-slate-700 px-1 rounded">sudo systemctl start prostat-bridge</code></li>
              </ul>
            </div>
            
            <div className="p-4 bg-slate-900 rounded-lg">
              <p className="font-medium text-white mb-2">2. Check Physical Connection</p>
              <ul className="list-disc list-inside text-slate-400 space-y-1">
                <li>Ensure the mini PC is powered on (check lights)</li>
                <li>Verify Ethernet cable is connected to router</li>
                <li>Try unplugging and replugging power (wait 2 min)</li>
              </ul>
            </div>
            
            <div className="p-4 bg-slate-900 rounded-lg">
              <p className="font-medium text-white mb-2">3. Try Alternative URLs</p>
              <ul className="list-disc list-inside text-slate-400 space-y-1">
                <li><code className="bg-slate-700 px-1 rounded">http://joule-bridge.local:8080</code> (mDNS)</li>
                <li><code className="bg-slate-700 px-1 rounded">http://192.168.0.106:8080</code> (common IP)</li>
                <li><code className="bg-slate-700 px-1 rounded">http://192.168.1.100:8080</code> (alt subnet)</li>
                <li>Check router's connected devices for "Joule Bridge"</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

