/**
 * PairingWizard - Step-by-step guided pairing flow for Ecobee via HomeKit
 * 
 * Features:
 * - Step-by-step wizard with clear instructions
 * - QR code scanner for pairing codes
 * - Auto-retry with clear stale pairing prompt
 * - Device ID change detection
 * - Video call prompt on failure
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Wifi,
  Camera,
  Video,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Smartphone,
  Settings,
  Zap,
} from 'lucide-react';

// Bridge API functions
const getBridgeUrl = () => {
  try {
    const saved = localStorage.getItem('jouleBridgeUrl');
    return saved || import.meta.env.VITE_JOULE_BRIDGE_URL || 'http://joule-bridge.local:8080';
  } catch {
    return 'http://joule-bridge.local:8080';
  }
};

const WIZARD_STEPS = [
  { id: 'connect', title: 'Connect to Bridge', icon: Wifi },
  { id: 'prepare', title: 'Prepare Ecobee', icon: Settings },
  { id: 'discover', title: 'Find Devices', icon: Smartphone },
  { id: 'pair', title: 'Enter Code & Pair', icon: Zap },
  { id: 'done', title: 'Done', icon: CheckCircle },
];

export default function PairingWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isRemote = searchParams.get('remote') === 'true';
  const remoteToken = searchParams.get('token');
  
  const [currentStep, setCurrentStep] = useState(0);
  const [bridgeUrl, setBridgeUrl] = useState(getBridgeUrl());
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [bridgeChecking, setBridgeChecking] = useState(false);
  const [bridgeError, setBridgeError] = useState(null);
  
  const [devices, setDevices] = useState([]);
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState(null);
  const [previousDeviceIds, setPreviousDeviceIds] = useState([]);
  
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [pairingCode, setPairingCode] = useState('');
  const [pairing, setPairing] = useState(false);
  const [pairingError, setPairingError] = useState(null);
  const [pairingSuccess, setPairingSuccess] = useState(false);
  
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [showVideoCallPrompt, setShowVideoCallPrompt] = useState(false);
  const [clearingStalePairings, setClearingStalePairings] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // Check bridge connection
  const checkBridge = useCallback(async () => {
    setBridgeChecking(true);
    setBridgeError(null);
    try {
      const response = await fetch(`${bridgeUrl}/health`, { 
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });
      if (response.ok) {
        setBridgeConnected(true);
        // Also notify HMI about pairing mode
        try {
          await fetch(`${bridgeUrl}/api/pairing/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'wizard_started' })
          });
        } catch (e) {
          // Ignore - endpoint may not exist yet
        }
        return true;
      } else {
        throw new Error(`Bridge returned ${response.status}`);
      }
    } catch (error) {
      setBridgeConnected(false);
      setBridgeError(error.message || 'Cannot connect to bridge');
      return false;
    } finally {
      setBridgeChecking(false);
    }
  }, [bridgeUrl]);

  // Discover devices
  const discoverDevices = useCallback(async () => {
    setDiscovering(true);
    setDiscoverError(null);
    try {
      // Store current device IDs for change detection
      if (devices.length > 0) {
        setPreviousDeviceIds(devices.map(d => d.device_id));
      }
      
      const response = await fetch(`${bridgeUrl}/api/discover`, {
        signal: AbortSignal.timeout(65000)
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = await response.json();
      const newDevices = data.devices || [];
      setDevices(newDevices);
      
      // Check for device ID changes
      if (previousDeviceIds.length > 0 && newDevices.length > 0) {
        const newIds = newDevices.map(d => d.device_id);
        const changedDevices = previousDeviceIds.filter(id => !newIds.includes(id));
        if (changedDevices.length > 0) {
          setDiscoverError(
            `Device ID changed! This usually happens after a HomeKit reset on the Ecobee. ` +
            `Old ID: ${changedDevices[0].substring(0, 8)}... → New ID: ${newIds[0]?.substring(0, 8)}... ` +
            `Please use the new device for pairing.`
          );
        }
      }
      
      // Notify HMI about discovery results
      try {
        await fetch(`${bridgeUrl}/api/pairing/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            mode: 'discovered',
            device_count: newDevices.length
          })
        });
      } catch (e) {
        // Ignore
      }
      
      return newDevices;
    } catch (error) {
      setDiscoverError(error.message || 'Discovery failed');
      return [];
    } finally {
      setDiscovering(false);
    }
  }, [bridgeUrl, devices, previousDeviceIds]);

  // Clear stale pairings
  const clearStalePairings = async () => {
    setClearingStalePairings(true);
    try {
      const response = await fetch(`${bridgeUrl}/api/pairing/clear-stale`, {
        method: 'POST'
      });
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (error) {
      console.error('Failed to clear stale pairings:', error);
    } finally {
      setClearingStalePairings(false);
    }
  };

  // Pair device with auto-retry
  const pairDevice = async (deviceId, code, isRetry = false) => {
    setPairing(true);
    setPairingError(null);
    
    // Notify HMI
    try {
      await fetch(`${bridgeUrl}/api/pairing/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mode: 'pairing',
          code: code.replace(/[^0-9]/g, '').substring(0, 3) + '-XX-XXX' // Partial code for display
        })
      });
    } catch (e) {
      // Ignore
    }
    
    try {
      const response = await fetch(`${bridgeUrl}/api/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          pairing_code: code.replace(/[^0-9]/g, '')
        }),
        signal: AbortSignal.timeout(45000)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        throw new Error(errorData.error || errorText);
      }
      
      setPairingSuccess(true);
      setCurrentStep(4); // Done step
      
      // Notify HMI of success
      try {
        await fetch(`${bridgeUrl}/api/pairing/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'success' })
        });
      } catch (e) {
        // Ignore
      }
      
      return true;
    } catch (error) {
      const errorMsg = error.message || 'Pairing failed';
      setPairingError(errorMsg);
      setRetryCount(prev => prev + 1);
      
      // Check for specific error types
      if (errorMsg.includes('already paired') || errorMsg.includes('another controller')) {
        // Offer to clear stale pairings
        setPairingError(
          `${errorMsg}\n\n` +
          `This device appears to be paired to another controller (like Apple Home). You need to:\n` +
          `1. Open the Home app on your iPhone/iPad\n` +
          `2. Find your Ecobee and remove it\n` +
          `3. Or reset HomeKit on the Ecobee: Menu → Settings → Installation Settings → HomeKit → Reset`
        );
      } else if (errorMsg.includes('not found') && !isRetry) {
        // Device ID might have changed - auto-discover and retry
        setPairingError('Device not found. Re-discovering devices...');
        const newDevices = await discoverDevices();
        if (newDevices.length > 0) {
          // Find a matching device or use the first one
          const newDevice = newDevices[0];
          setPairingError(`Device ID changed. Found new device: ${newDevice.name}. Please try pairing again.`);
          setSelectedDevice(newDevice);
        }
      }
      
      // Show video call prompt after 2 failures
      if (retryCount >= 1) {
        setShowVideoCallPrompt(true);
      }
      
      // Notify HMI of failure
      try {
        await fetch(`${bridgeUrl}/api/pairing/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'error', error: errorMsg.substring(0, 50) })
        });
      } catch (e) {
        // Ignore
      }
      
      return false;
    } finally {
      setPairing(false);
    }
  };

  // QR Code Scanner
  const startQRScanner = async () => {
    setShowQRScanner(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        
        // Start scanning
        scanIntervalRef.current = setInterval(() => {
          if (canvasRef.current && videoRef.current) {
            const canvas = canvasRef.current;
            const video = videoRef.current;
            const ctx = canvas.getContext('2d');
            
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            
            // Try to decode QR code using simple pattern matching for HomeKit codes
            // HomeKit codes are 8 digits in XXX-XX-XXX format
            // For full QR scanning, you'd use a library like jsQR
            // This is a placeholder - in production, import jsQR
          }
        }, 500);
      }
    } catch (error) {
      console.error('Camera access denied:', error);
      setShowQRScanner(false);
      alert('Camera access is required for QR scanning. Please enter the code manually.');
    }
  };

  const stopQRScanner = () => {
    setShowQRScanner(false);
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
  };

  // Format pairing code as XXX-XX-XXX
  const formatPairingCode = (value) => {
    const digits = value.replace(/[^0-9]/g, '').slice(0, 8);
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  };

  // Initial bridge check
  useEffect(() => {
    checkBridge();
    return () => {
      stopQRScanner();
    };
  }, []);

  // Step navigation
  const canProceed = () => {
    switch (currentStep) {
      case 0: return bridgeConnected;
      case 1: return true; // User confirms they've prepared Ecobee
      case 2: return devices.length > 0 && selectedDevice;
      case 3: return pairingCode.replace(/[^0-9]/g, '').length === 8;
      default: return true;
    }
  };

  const handleNext = async () => {
    if (currentStep === 2 && !selectedDevice && devices.length > 0) {
      setSelectedDevice(devices[0]);
    }
    if (currentStep === 3) {
      // Attempt pairing
      await pairDevice(selectedDevice.device_id, pairingCode);
      return; // Don't advance - pairDevice will set step on success
    }
    setCurrentStep(prev => Math.min(prev + 1, WIZARD_STEPS.length - 1));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const startVideoCall = () => {
    // Open Jitsi Meet with a unique room name
    const roomName = `joule-support-${Date.now().toString(36)}`;
    window.open(`https://meet.jit.si/${roomName}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Ecobee Pairing Wizard</h1>
          <p className="text-slate-400">Follow these steps to connect your Ecobee to Joule Bridge</p>
          {isRemote && (
            <div className="mt-2 px-3 py-1 bg-purple-900/50 border border-purple-700 rounded-lg inline-block">
              <span className="text-purple-300 text-sm">🌐 Remote Support Mode</span>
            </div>
          )}
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2">
          {WIZARD_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isComplete = index < currentStep;
            return (
              <div key={step.id} className="flex items-center">
                <div className={`flex flex-col items-center ${index < WIZARD_STEPS.length - 1 ? 'mr-2' : ''}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    isComplete ? 'bg-green-600' :
                    isActive ? 'bg-blue-600' :
                    'bg-slate-700'
                  }`}>
                    {isComplete ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <span className={`text-xs mt-1 whitespace-nowrap ${isActive ? 'text-white' : 'text-slate-500'}`}>
                    {step.title}
                  </span>
                </div>
                {index < WIZARD_STEPS.length - 1 && (
                  <div className={`w-8 h-0.5 mx-1 ${isComplete ? 'bg-green-600' : 'bg-slate-700'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 mb-6">
          {/* Step 0: Connect to Bridge */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Connect to Joule Bridge</h2>
              <p className="text-slate-400 text-sm">
                First, let's make sure we can communicate with your Joule Bridge.
              </p>
              
              <div className="space-y-3">
                <label className="block text-sm text-slate-400">Bridge URL</label>
                <input
                  type="text"
                  value={bridgeUrl}
                  onChange={(e) => setBridgeUrl(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2"
                  placeholder="http://joule-bridge.local:8080"
                />
                <button
                  onClick={checkBridge}
                  disabled={bridgeChecking}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 rounded-lg transition-colors flex items-center gap-2"
                >
                  {bridgeChecking ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    'Test Connection'
                  )}
                </button>
              </div>

              {bridgeConnected && (
                <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                  <span className="text-green-300">Bridge connected successfully!</span>
                </div>
              )}

              {bridgeError && (
                <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <XCircle className="w-6 h-6 text-red-400" />
                    <span className="text-red-300">Connection failed</span>
                  </div>
                  <p className="text-sm text-red-400">{bridgeError}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Prepare Ecobee */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Prepare Your Ecobee</h2>
              <p className="text-slate-400 text-sm">
                Make sure HomeKit is enabled and ready on your Ecobee thermostat.
              </p>
              
              <div className="space-y-4">
                <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                  <h3 className="font-medium text-blue-300 mb-3">On your Ecobee thermostat:</h3>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300">
                    <li>Go to <strong>Menu</strong> (hamburger icon)</li>
                    <li>Select <strong>Settings</strong></li>
                    <li>Select <strong>Installation Settings</strong></li>
                    <li>Select <strong>HomeKit</strong></li>
                    <li>Make sure it shows <strong>"Unpaired"</strong> or <strong>"Pairing mode"</strong></li>
                    <li>Note the <strong>8-digit pairing code</strong> (or QR code)</li>
                  </ol>
                </div>

                <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-yellow-300 mb-1">If it shows "Paired"</h3>
                      <p className="text-sm text-yellow-200/80">
                        The Ecobee is connected to another controller (like Apple Home). 
                        You'll need to reset HomeKit on the Ecobee by selecting <strong>Reset</strong> on the HomeKit screen.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Discover Devices */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Find Your Ecobee</h2>
              <p className="text-slate-400 text-sm">
                Searching for HomeKit devices on your network. This may take up to 60 seconds.
              </p>
              
              <button
                onClick={discoverDevices}
                disabled={discovering}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 rounded-lg transition-colors flex items-center gap-2"
              >
                {discovering ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Searching... (up to 60 sec)
                  </>
                ) : (
                  <>
                    <Wifi className="w-4 h-4" />
                    Discover Devices
                  </>
                )}
              </button>

              {discoverError && (
                <div className="p-4 bg-yellow-900/30 border border-yellow-700 rounded-lg">
                  <p className="text-sm text-yellow-300">{discoverError}</p>
                </div>
              )}

              {devices.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm text-slate-400">Select your device:</label>
                  {devices.map((device) => (
                    <button
                      key={device.device_id}
                      onClick={() => setSelectedDevice(device)}
                      className={`w-full p-4 rounded-lg border text-left transition-colors ${
                        selectedDevice?.device_id === device.device_id
                          ? 'bg-blue-900/30 border-blue-600'
                          : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{device.name || 'Unknown Device'}</p>
                          <p className="text-xs text-slate-400 font-mono">{device.device_id}</p>
                        </div>
                        {selectedDevice?.device_id === device.device_id && (
                          <CheckCircle className="w-5 h-5 text-blue-400" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {devices.length === 0 && !discovering && (
                <div className="p-4 bg-slate-700/50 rounded-lg">
                  <p className="text-sm text-slate-400">
                    No devices found yet. Make sure your Ecobee is in pairing mode and on the same network.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Enter Code & Pair */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Enter Pairing Code</h2>
              <p className="text-slate-400 text-sm">
                Enter the 8-digit code shown on your Ecobee's HomeKit screen.
              </p>

              {selectedDevice && (
                <div className="p-3 bg-slate-700/50 rounded-lg">
                  <p className="text-sm">
                    <span className="text-slate-400">Pairing with: </span>
                    <span className="font-medium">{selectedDevice.name}</span>
                  </p>
                </div>
              )}
              
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pairingCode}
                    onChange={(e) => setPairingCode(formatPairingCode(e.target.value))}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-2xl font-mono text-center tracking-widest"
                    placeholder="XXX-XX-XXX"
                    maxLength={11}
                  />
                  <button
                    onClick={startQRScanner}
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors"
                    title="Scan QR Code"
                  >
                    <Camera className="w-6 h-6" />
                  </button>
                </div>
                <p className="text-xs text-slate-500">Format: XXX-XX-XXX (e.g., 123-45-678)</p>
              </div>

              {/* QR Scanner Modal */}
              {showQRScanner && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                  <div className="bg-slate-800 rounded-xl p-4 max-w-md w-full">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold">Scan QR Code</h3>
                      <button onClick={stopQRScanner} className="text-slate-400 hover:text-white">
                        <XCircle className="w-6 h-6" />
                      </button>
                    </div>
                    <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
                      <video ref={videoRef} className="w-full h-full object-cover" />
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="absolute inset-0 border-2 border-blue-500/50 m-8 rounded-lg" />
                    </div>
                    <p className="text-sm text-slate-400 mt-4 text-center">
                      Point camera at the QR code on your Ecobee
                    </p>
                  </div>
                </div>
              )}

              {pairingError && (
                <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-red-300 whitespace-pre-line">{pairingError}</p>
                      
                      {pairingError.includes('already paired') && (
                        <button
                          onClick={async () => {
                            await clearStalePairings();
                            setPairingError(null);
                          }}
                          disabled={clearingStalePairings}
                          className="mt-3 px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-sm"
                        >
                          {clearingStalePairings ? 'Clearing...' : 'Clear Stale Pairings'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Video Call Prompt */}
              {showVideoCallPrompt && (
                <div className="p-4 bg-purple-900/30 border border-purple-700 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Video className="w-5 h-5 text-purple-400 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-purple-300 mb-1">Need help?</h3>
                      <p className="text-sm text-purple-200/80 mb-3">
                        Having trouble pairing? Start a video call so support can see your Ecobee screen.
                      </p>
                      <button
                        onClick={startVideoCall}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-sm flex items-center gap-2"
                      >
                        <Video className="w-4 h-4" />
                        Start Video Call
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Done */}
          {currentStep === 4 && (
            <div className="space-y-4 text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-green-600 flex items-center justify-center">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-semibold text-green-400">Pairing Successful!</h2>
              <p className="text-slate-400">
                Your Ecobee is now connected to Joule Bridge. You can control it from the app.
              </p>
              
              <div className="pt-4 space-y-3">
                <button
                  onClick={() => navigate('/settings')}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                >
                  Go to Settings
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                >
                  Go to Home
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        {currentStep < 4 && (
          <div className="flex justify-between">
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={!canProceed() || pairing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
            >
              {pairing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Pairing...
                </>
              ) : currentStep === 3 ? (
                <>
                  Pair Device
                  <Zap className="w-4 h-4" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
