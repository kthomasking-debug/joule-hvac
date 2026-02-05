/**
 * RemotePairingLink - A simple page customers can access for remote pairing
 * 
 * When support sends a link like /remote-pairing?bridge=https://abc123.ngrok.io
 * the customer opens it and can enter their Ecobee's pairing code.
 * The pairing happens through the bridge URL provided in the query params.
 */
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Wifi,
  AlertTriangle,
  Phone,
} from 'lucide-react';

export default function RemotePairingLink() {
  const [searchParams] = useSearchParams();
  const bridgeUrlParam = searchParams.get('bridge');
  
  const [bridgeUrl, setBridgeUrl] = useState(bridgeUrlParam || '');
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);
  
  const [devices, setDevices] = useState([]);
  const [discovering, setDiscovering] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  
  const [pairingCode, setPairingCode] = useState('');
  const [pairing, setPairing] = useState(false);
  const [pairingSuccess, setPairingSuccess] = useState(false);
  const [pairingError, setPairingError] = useState(null);

  // Check bridge connection
  const checkBridge = async () => {
    if (!bridgeUrl) {
      setError('No bridge URL provided. Please contact support.');
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const response = await fetch(`${bridgeUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });
      if (response.ok) {
        setBridgeConnected(true);
        // Auto-discover devices
        discoverDevices();
      } else {
        throw new Error('Bridge is not responding');
      }
    } catch (e) {
      setError('Cannot connect to bridge. The support link may have expired. Please contact support for a new link.');
      setBridgeConnected(false);
    } finally {
      setChecking(false);
    }
  };

  // Discover devices
  const discoverDevices = async () => {
    setDiscovering(true);
    try {
      const response = await fetch(`${bridgeUrl}/api/discover`, {
        signal: AbortSignal.timeout(65000)
      });
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
        if (data.devices?.length === 1) {
          setSelectedDevice(data.devices[0]);
        }
      }
    } catch (e) {
      console.error('Discovery error:', e);
    } finally {
      setDiscovering(false);
    }
  };

  // Pair device
  const handlePair = async () => {
    if (!selectedDevice || !pairingCode) return;
    
    setPairing(true);
    setPairingError(null);
    
    try {
      const response = await fetch(`${bridgeUrl}/api/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: selectedDevice.device_id,
          pairing_code: pairingCode.replace(/[^0-9]/g, '')
        }),
        signal: AbortSignal.timeout(45000)
      });
      
      if (response.ok) {
        setPairingSuccess(true);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Pairing failed');
      }
    } catch (e) {
      setPairingError(e.message || 'Pairing failed. Please try again.');
    } finally {
      setPairing(false);
    }
  };

  // Format pairing code
  const formatCode = (value) => {
    const digits = value.replace(/[^0-9]/g, '').slice(0, 8);
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  };

  // Auto-check on mount if bridge URL is provided
  useEffect(() => {
    if (bridgeUrlParam) {
      checkBridge();
    }
  }, [bridgeUrlParam]);

  // Success screen
  if (pairingSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-24 h-24 mx-auto rounded-full bg-green-600 flex items-center justify-center mb-6">
            <CheckCircle className="w-14 h-14" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Pairing Complete!</h1>
          <p className="text-green-200 mb-8">
            Your Ecobee is now connected to your Joule Bridge. You can close this page.
          </p>
          <div className="p-4 bg-green-800/50 rounded-lg">
            <p className="text-sm text-green-300">
              Support has been notified. They will verify the connection and follow up with you.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 md:p-8">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-full bg-blue-600 flex items-center justify-center mb-4">
            <Wifi className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Connect Your Ecobee</h1>
          <p className="text-slate-400">
            Your support agent has sent you this link to help connect your Ecobee thermostat.
          </p>
        </div>

        {/* No bridge URL */}
        {!bridgeUrl && (
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-6 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
            <h2 className="text-lg font-semibold mb-2">Link Missing</h2>
            <p className="text-slate-400 text-sm mb-4">
              This link appears to be incomplete. Please contact support for a new link.
            </p>
            <a
              href="tel:+1-800-SUPPORT"
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg transition-colors"
            >
              <Phone className="w-4 h-4" />
              Contact Support
            </a>
          </div>
        )}

        {/* Connection status */}
        {bridgeUrl && !bridgeConnected && (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 mb-6">
            <h2 className="font-semibold mb-4">Connecting to your bridge...</h2>
            {checking ? (
              <div className="flex items-center gap-3 text-blue-400">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Connecting...</span>
              </div>
            ) : error ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 text-red-400">
                  <XCircle className="w-5 h-5 mt-0.5" />
                  <span className="text-sm">{error}</span>
                </div>
                <button
                  onClick={checkBridge}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <button
                onClick={checkBridge}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
              >
                Connect
              </button>
            )}
          </div>
        )}

        {/* Pairing form */}
        {bridgeConnected && (
          <div className="space-y-6">
            {/* Step 1: Discovery */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-sm">1</span>
                Find Your Ecobee
              </h2>
              
              {discovering ? (
                <div className="flex items-center gap-3 text-blue-400">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Searching for your Ecobee (up to 60 seconds)...</span>
                </div>
              ) : devices.length > 0 ? (
                <div className="space-y-2">
                  {devices.map((device) => (
                    <button
                      key={device.device_id}
                      onClick={() => setSelectedDevice(device)}
                      className={`w-full p-4 rounded-lg border text-left transition-colors ${
                        selectedDevice?.device_id === device.device_id
                          ? 'bg-blue-900/30 border-blue-600'
                          : 'bg-slate-700/50 border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{device.name || 'Ecobee'}</span>
                        {selectedDevice?.device_id === device.device_id && (
                          <CheckCircle className="w-5 h-5 text-blue-400" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-slate-400 text-sm">
                    Click the button below to search for your Ecobee on the network.
                  </p>
                  <button
                    onClick={discoverDevices}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                  >
                    Search for Ecobee
                  </button>
                </div>
              )}
            </div>

            {/* Step 2: Pairing code */}
            {selectedDevice && (
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-sm">2</span>
                  Enter Pairing Code
                </h2>
                
                <div className="space-y-4">
                  <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                    <h3 className="font-medium text-blue-300 mb-2">On your Ecobee thermostat:</h3>
                    <ol className="list-decimal list-inside text-sm text-slate-300 space-y-1">
                      <li>Go to <strong>Menu</strong> → <strong>Settings</strong></li>
                      <li>Select <strong>Installation Settings</strong></li>
                      <li>Select <strong>HomeKit</strong></li>
                      <li>Find the <strong>8-digit code</strong> (like 123-45-678)</li>
                    </ol>
                  </div>
                  
                  <input
                    type="text"
                    value={pairingCode}
                    onChange={(e) => setPairingCode(formatCode(e.target.value))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-4 text-2xl font-mono text-center tracking-widest"
                    placeholder="XXX-XX-XXX"
                    maxLength={11}
                  />
                  
                  {pairingError && (
                    <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg">
                      <p className="text-sm text-red-300">{pairingError}</p>
                    </div>
                  )}
                  
                  <button
                    onClick={handlePair}
                    disabled={pairing || pairingCode.replace(/[^0-9]/g, '').length !== 8}
                    className="w-full px-4 py-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 rounded-lg transition-colors font-semibold flex items-center justify-center gap-2"
                  >
                    {pairing ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      'Connect Ecobee'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Help section */}
            <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
              <h3 className="font-medium mb-2">Need help?</h3>
              <p className="text-sm text-slate-400">
                If you're having trouble, contact your support agent. They can see your screen and guide you through the process.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
