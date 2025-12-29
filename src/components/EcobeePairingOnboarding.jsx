import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Search,
  Key,
  Link as LinkIcon,
  X,
  HelpCircle,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import {
  discoverDevices,
  pairDevice,
  unpairDevice,
  getPairedDevices,
  checkBridgeHealth,
} from "../lib/jouleBridgeApi";

/**
 * Ecobee Pairing Onboarding Flow
 * Step-by-step guide to pair your Ecobee device
 */
export default function EcobeePairingOnboarding({ onClose, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [bridgeAvailable, setBridgeAvailable] = useState(false);
  const [checkingBridge, setCheckingBridge] = useState(true);
  const [devices, setDevices] = useState([]);
  const [discovering, setDiscovering] = useState(false);
  const [pairingCode, setPairingCode] = useState("");
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [pairing, setPairing] = useState(false);
  const [pairedDevices, setPairedDevices] = useState([]);
  const [unpairing, setUnpairing] = useState(false);

  // Check bridge availability on mount
  useEffect(() => {
    checkBridge();
    loadPairedDevices();
  }, []);

  const checkBridge = async () => {
    setCheckingBridge(true);
    try {
      const available = await checkBridgeHealth();
      setBridgeAvailable(available);
    } catch (error) {
      setBridgeAvailable(false);
    } finally {
      setCheckingBridge(false);
    }
  };

  const loadPairedDevices = async () => {
    try {
      const paired = await getPairedDevices();
      setPairedDevices(paired);
    } catch (error) {
      console.error("Failed to load paired devices:", error);
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const discovered = await discoverDevices();
      setDevices(discovered);
      if (discovered.length > 0) {
        setSelectedDevice(discovered[0].device_id);
        setCurrentStep(2); // Move to pairing code step
      } else {
        alert("No devices found. Make sure your Ecobee is powered on and on the same network.");
      }
    } catch (error) {
      alert(`Failed to discover devices: ${error.message}`);
      setDevices([]);
    } finally {
      setDiscovering(false);
    }
  };

  const handleUnpair = async (deviceId) => {
    setUnpairing(true);
    try {
      await unpairDevice(deviceId);
      await loadPairedDevices();
      setCurrentStep(1); // Move to discover step
    } catch (error) {
      alert(`Failed to unpair: ${error.message}`);
    } finally {
      setUnpairing(false);
    }
  };

  const formatPairingCode = (code) => {
    // Format as xxx-xx-xxx
    const digits = code.replace(/\D/g, "");
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 5) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    } else {
      return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 8)}`;
    }
  };

  const getPairingErrorDetails = (error) => {
    // Extract error message - handle both direct errors and wrapped errors
    let errorMsg = error.message || String(error);
    
    // If error message contains "Joule Bridge error:", extract the actual error
    if (errorMsg.includes("Joule Bridge error:")) {
      const match = errorMsg.match(/Joule Bridge error: \d+ (.+)/);
      if (match) {
        errorMsg = match[1];
      }
    }
    
    // Try to parse JSON error if present
    try {
      const jsonMatch = errorMsg.match(/\{.*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.error) {
          errorMsg = parsed.error;
        }
      }
    } catch (e) {
      // Not JSON, continue with original message
    }
    
    // Check for specific error patterns
    if (errorMsg.includes("Pairing initialization timed out")) {
      return {
        title: "Device Not Responding",
        mainIssue: "Your Ecobee didn't respond to the pairing request within 10 seconds.",
        possibleCauses: [
          "The Ecobee is not in HomeKit pairing mode",
          "The device is already paired to Apple Home (iPhone/iPad)",
          "Network connectivity issues between bridge and Ecobee",
          "The Ecobee is powered off or disconnected from WiFi"
        ],
        solutions: [
          {
            step: "1. Check HomeKit Pairing Mode",
            details: "On your Ecobee: Menu → Settings → Installation Settings → HomeKit. Make sure you see the 8-digit code on screen."
          },
          {
            step: "2. Unpair from Apple Home (if paired)",
            details: "Open the Home app on iPhone/iPad → Find your Ecobee → Long-press → Settings → Remove Accessory → Wait 30 seconds"
          },
          {
            step: "3. Verify Network Connection",
            details: "Check that both the bridge and Ecobee are on the same WiFi network. Restart your router if needed."
          },
          {
            step: "4. Restart Ecobee",
            details: "Menu → Settings → Reset → Restart. Wait 2 minutes for it to fully boot, then try pairing again."
          },
          {
            step: "5. Verify Bridge is Running",
            details: "Check that the bridge service is running and can reach your network. Try discovering devices again."
          }
        ]
      };
    } else if (errorMsg.includes("already paired") || errorMsg.includes("max peers")) {
      return {
        title: "Device Already Paired",
        mainIssue: "Your Ecobee is already paired to another HomeKit controller (likely Apple Home).",
        possibleCauses: [
          "Device is paired to Apple Home app",
          "Device reached maximum number of paired controllers"
        ],
        solutions: [
          {
            step: "1. Unpair from Apple Home",
            details: "Open Home app → Find Ecobee → Long-press → Settings → Remove Accessory"
          },
          {
            step: "2. Wait 30 seconds",
            details: "Give the device time to reset its pairing state"
          },
          {
            step: "3. Verify Pairing Mode",
            details: "On Ecobee: Menu → Settings → Installation Settings → HomeKit. You should see the 8-digit code."
          },
          {
            step: "4. Try Pairing Again",
            details: "Click 'Discover Devices' again, then enter the pairing code"
          }
        ]
      };
    } else if (errorMsg.includes("not found") || errorMsg.includes("not in cache")) {
      return {
        title: "Device Not Found",
        mainIssue: "The Ecobee device was not found during discovery.",
        possibleCauses: [
          "Device is not powered on",
          "Device is not on the same network",
          "Device ID changed after HomeKit reset",
          "Network discovery issues"
        ],
        solutions: [
          {
            step: "1. Re-discover Devices",
            details: "Click 'Discover Devices' again to find your Ecobee"
          },
          {
            step: "2. Check Network",
            details: "Ensure both bridge and Ecobee are on the same WiFi network"
          },
          {
            step: "3. Power Cycle Ecobee",
            details: "Menu → Settings → Reset → Restart, wait 2 minutes"
          },
          {
            step: "4. Check WiFi Connection",
            details: "On Ecobee: Menu → Settings → Wi-Fi. Verify it's connected."
          }
        ]
      };
    } else if (errorMsg.includes("timed out") && !errorMsg.includes("initialization")) {
      return {
        title: "Pairing Timed Out",
        mainIssue: "The pairing process took too long to complete (over 30 seconds).",
        possibleCauses: [
          "Incorrect pairing code",
          "Network latency issues",
          "Device not fully in pairing mode"
        ],
        solutions: [
          {
            step: "1. Verify Pairing Code",
            details: "Double-check the 8-digit code on your Ecobee screen. It should be in xxx-xx-xxx format."
          },
          {
            step: "2. Re-enter Code",
            details: "Make sure you're entering all 8 digits correctly"
          },
          {
            step: "3. Check Pairing Mode",
            details: "On Ecobee: Menu → Settings → Installation Settings → HomeKit. Code should be visible."
          },
          {
            step: "4. Try Again",
            details: "Wait 30 seconds, then try pairing again with the same code"
          }
        ]
      };
    } else {
      // Generic error
      return {
        title: "Pairing Failed",
        mainIssue: errorMsg,
        possibleCauses: [
          "Incorrect pairing code",
          "Device not in pairing mode",
          "Network connectivity issues",
          "Device already paired elsewhere"
        ],
        solutions: [
          {
            step: "1. Verify Pairing Code",
            details: "Check the 8-digit code on your Ecobee: Menu → Settings → Installation Settings → HomeKit"
          },
          {
            step: "2. Ensure Pairing Mode",
            details: "The Ecobee must show the pairing code on screen"
          },
          {
            step: "3. Check Network",
            details: "Both bridge and Ecobee must be on the same WiFi network"
          },
          {
            step: "4. Unpair from Apple Home",
            details: "If paired to Apple Home, remove it first: Home app → Ecobee → Settings → Remove Accessory"
          }
        ]
      };
    }
  };

  const [pairingError, setPairingError] = useState(null);

  const handlePair = async () => {
    // Remove dashes before sending to API
    const codeWithoutDashes = pairingCode.replace(/\D/g, "");
    
    if (codeWithoutDashes.length !== 8) {
      setPairingError({
        title: "Incomplete Code",
        mainIssue: "Please enter the complete 8-digit pairing code",
        solutions: [{
          step: "Enter Code",
          details: "The pairing code should be 8 digits in xxx-xx-xxx format (e.g., 123-45-678)"
        }]
      });
      return;
    }

    if (!selectedDevice) {
      setPairingError({
        title: "No Device Selected",
        mainIssue: "Please select a device to pair",
        solutions: [{
          step: "Select Device",
          details: "Go back and click 'Discover Devices', then select your Ecobee"
        }]
      });
      return;
    }

    setPairingError(null);
    setPairing(true);
    try {
      await pairDevice(selectedDevice, codeWithoutDashes);
      await loadPairedDevices();
      setCurrentStep(4); // Move to success step (step 4, index 4)
      if (onComplete) {
        setTimeout(() => {
          onComplete();
        }, 2000);
      }
    } catch (error) {
      const errorDetails = getPairingErrorDetails(error);
      setPairingError(errorDetails);
    } finally {
      setPairing(false);
    }
  };

  const steps = [
    {
      title: "Welcome!",
      icon: <HelpCircle className="w-6 h-6" />,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Let's get your Ecobee connected to the Joule Bridge. This will only take a few minutes!
          </p>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1">
              What you'll need:
            </p>
            <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1 ml-4 list-disc">
              <li>Your Ecobee thermostat (powered on)</li>
              <li>The 8-digit pairing code from your Ecobee</li>
              <li>Both devices on the same WiFi network</li>
            </ul>
          </div>
        </div>
      ),
      canProceed: bridgeAvailable,
      action: bridgeAvailable ? null : (
        <button
          onClick={checkBridge}
          disabled={checkingBridge}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {checkingBridge ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Check Bridge Again
            </>
          )}
        </button>
      ),
    },
    {
      title: "Step 1: Unpair Old Device (if needed)",
      icon: <LinkIcon className="w-6 h-6" />,
      content: (
        <div className="space-y-4">
          {pairedDevices.length > 0 ? (
            <>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                You have {pairedDevices.length} device(s) already paired. We need to unpair it first before pairing again.
              </p>
              <div className="space-y-2">
                {pairedDevices.map((deviceId) => (
                  <div
                    key={deviceId}
                    className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <LinkIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Device: {deviceId}
                      </span>
                    </div>
                    <button
                      onClick={() => handleUnpair(deviceId)}
                      disabled={unpairing}
                      className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {unpairing ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Unpairing...
                        </>
                      ) : (
                        "Unpair"
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                <p className="text-sm text-green-800 dark:text-green-200">
                  No devices currently paired. Ready to discover!
                </p>
              </div>
            </div>
          )}
        </div>
      ),
      canProceed: pairedDevices.length === 0,
      action: pairedDevices.length === 0 ? (
        <button
          onClick={() => setCurrentStep(2)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          Continue to Discovery
          <ChevronRight className="w-4 h-4" />
        </button>
      ) : null,
    },
    {
      title: "Step 2: Discover Your Ecobee",
      icon: <Search className="w-6 h-6" />,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Let's find your Ecobee on the network. Make sure it's powered on and connected to WiFi.
          </p>
          <button
            onClick={handleDiscover}
            disabled={discovering}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {discovering ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Discovering devices...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Discover Devices
              </>
            )}
          </button>

          {devices.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Found {devices.length} device(s):
              </p>
              {devices.map((device) => (
                <div
                  key={device.device_id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedDevice === device.device_id
                      ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
                      : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-750"
                  }`}
                  onClick={() => setSelectedDevice(device.device_id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {selectedDevice === device.device_id ? (
                        <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {device.name || "Ecobee Thermostat"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {device.device_id}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
      canProceed: selectedDevice !== null,
      action: selectedDevice && (
        <button
          onClick={() => setCurrentStep(3)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          Continue to Pairing
          <ChevronRight className="w-4 h-4" />
        </button>
      ),
    },
    {
      title: "Step 3: Enter Pairing Code",
      icon: <Key className="w-6 h-6" />,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Enter the 8-digit pairing code from your Ecobee screen.
          </p>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-2">
              Where to find the code:
            </p>
            <ol className="text-xs text-blue-800 dark:text-blue-300 space-y-1 ml-4 list-decimal">
              <li>On your Ecobee, go to <strong>Menu</strong></li>
              <li>Select <strong>Settings</strong></li>
              <li>Select <strong>Installation Settings</strong></li>
              <li>Select <strong>HomeKit</strong></li>
              <li>You'll see an 8-digit code on the screen</li>
            </ol>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Pairing Code (8 digits)
            </label>
            <input
              type="text"
              value={formatPairingCode(pairingCode)}
              onChange={(e) => {
                // Remove all non-digits, then format as xxx-xx-xxx
                const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                setPairingCode(digits);
                setPairingError(null); // Clear error when user types
              }}
              placeholder="123-45-678"
              className={`w-full px-4 py-3 text-2xl text-center tracking-widest border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono ${
                pairingError ? "border-red-300 dark:border-red-700" : "border-gray-300 dark:border-gray-600"
              }`}
              maxLength={10} // 8 digits + 2 dashes
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
              {pairingCode.length}/8 digits
            </p>
          </div>
          
          {/* Error Display */}
          {pairingError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1">
                    {pairingError.title}
                  </h4>
                  <p className="text-xs text-red-800 dark:text-red-300 mb-3">
                    {pairingError.mainIssue}
                  </p>
                  
                  {pairingError.possibleCauses && pairingError.possibleCauses.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-red-900 dark:text-red-200 mb-1">
                        Possible causes:
                      </p>
                      <ul className="text-xs text-red-800 dark:text-red-300 space-y-1 ml-4 list-disc">
                        {pairingError.possibleCauses.map((cause, idx) => (
                          <li key={idx}>{cause}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {pairingError.solutions && pairingError.solutions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-900 dark:text-red-200 mb-2">
                        How to fix:
                      </p>
                      <ol className="text-xs text-red-800 dark:text-red-300 space-y-2 ml-4 list-decimal">
                        {pairingError.solutions.map((solution, idx) => (
                          <li key={idx}>
                            <strong>{solution.step}:</strong> {solution.details}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setPairingError(null)}
                className="text-xs text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100 underline"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      ),
      canProceed: pairingCode.length === 8,
      action: (
        <button
          onClick={handlePair}
          disabled={pairingCode.length !== 8 || pairing}
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {pairing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Pairing... (this may take up to 45 seconds)
            </>
          ) : (
            <>
              <LinkIcon className="w-5 h-5" />
              Pair Device
            </>
          )}
        </button>
      ),
    },
    {
      title: "Success!",
      icon: <CheckCircle2 className="w-6 h-6" />,
      content: (
        <div className="space-y-4">
          <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-green-900 dark:text-green-200 mb-2">
              Device Paired Successfully!
            </h3>
            <p className="text-sm text-green-800 dark:text-green-300">
              Your Ecobee is now connected to the Joule Bridge. You can now control it from the app!
            </p>
          </div>
        </div>
      ),
      canProceed: true,
      action: null,
    },
  ];

  const currentStepData = steps[currentStep];

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              {currentStepData.icon}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {currentStepData.title}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Step {currentStep + 1} of {steps.length}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Step Indicator */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex items-center gap-2">
            {steps.map((_, index) => (
              <React.Fragment key={index}>
                <button
                  onClick={() => setCurrentStep(index)}
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                    index === currentStep
                      ? "bg-blue-600 text-white"
                      : index < currentStep
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {index < currentStep ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    index + 1
                  )}
                </button>
                {index < steps.length - 1 && (
                  <div
                    className={`h-1 flex-1 rounded ${
                      index < currentStep
                        ? "bg-green-500"
                        : "bg-gray-200 dark:bg-gray-700"
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Bridge Status Check (Step 0) */}
          {currentStep === 0 && (
            <div className="mb-4">
              {checkingBridge ? (
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Checking bridge connection...
                  </span>
                </div>
              ) : bridgeAvailable ? (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="text-sm text-green-800 dark:text-green-200">
                    Bridge is connected and ready!
                  </span>
                </div>
              ) : (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 flex items-center gap-3">
                  <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <div className="flex-1">
                    <p className="text-sm text-red-800 dark:text-red-200">
                      Bridge is not available. Make sure it's running.
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                      Go to Settings → Joule Bridge Settings to configure the bridge URL.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStepData.content}

          {/* Action Button */}
          {currentStepData.action && (
            <div className="mt-6">{currentStepData.action}</div>
          )}
        </div>

        {/* Navigation Footer */}
        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          {currentStep < steps.length - 1 && currentStepData.canProceed && !currentStepData.action && (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {currentStep === steps.length - 1 && (
            <button
              onClick={() => {
                if (onComplete) onComplete();
                if (onClose) onClose();
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
            >
              Done
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

