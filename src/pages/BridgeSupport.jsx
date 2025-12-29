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
  FileText
} from 'lucide-react';

/**
 * Bridge Support Page
 * Remote administration and troubleshooting for the Joule Bridge
 * Designed for support staff to help users without SSH access
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
    }
    
    setStatus(prev => ({ ...prev, ...results, checking: false }));
  }, [bridgeUrl, fetchWithTimeout]);

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
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="w-8 h-8 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold">Bridge Support</h1>
              <p className="text-slate-400 text-sm">Remote administration & troubleshooting</p>
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
                <p className="font-medium text-white">Admin Manual</p>
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
              <p className="font-medium text-white mb-2">1. Check Physical Connection</p>
              <ul className="list-disc list-inside text-slate-400 space-y-1">
                <li>Ensure the mini PC is powered on (check lights)</li>
                <li>Verify Ethernet cable is connected to router</li>
                <li>Try unplugging and replugging power (wait 2 min)</li>
              </ul>
            </div>
            
            <div className="p-4 bg-slate-900 rounded-lg">
              <p className="font-medium text-white mb-2">2. Try Alternative URLs</p>
              <ul className="list-disc list-inside text-slate-400 space-y-1">
                <li><code className="bg-slate-700 px-1 rounded">http://joule-bridge.local:8080</code> (mDNS)</li>
                <li><code className="bg-slate-700 px-1 rounded">http://192.168.0.106:8080</code> (common IP)</li>
                <li><code className="bg-slate-700 px-1 rounded">http://192.168.1.100:8080</code> (alt subnet)</li>
                <li>Check router's connected devices for "Joule Bridge"</li>
              </ul>
            </div>
            
            <div className="p-4 bg-slate-900 rounded-lg">
              <p className="font-medium text-white mb-2">3. If Nothing Works</p>
              <ul className="list-disc list-inside text-slate-400 space-y-1">
                <li>The service may have crashed and needs manual restart</li>
                <li>User may need to connect a monitor/keyboard to the mini PC</li>
                <li>Or SSH in: <code className="bg-slate-700 px-1 rounded">ssh user@IP</code></li>
                <li>Then run: <code className="bg-slate-700 px-1 rounded">sudo systemctl restart prostat-bridge</code></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

