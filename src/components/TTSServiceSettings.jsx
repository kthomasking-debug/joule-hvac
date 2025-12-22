import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Server,
  Volume2,
  AlertCircle,
} from "lucide-react";

// TTS service URL - defaults to same host as temperature-server.js
// In production, this should point to wherever temperature-server.js is running
// (e.g., if temp-server runs on bridge server at http://bridge.local:3001, 
//  then TTS should be at http://bridge.local:3001/api/tts)
const getTTSServiceUrl = () => {
  // Check for explicit TTS service URL
  if (import.meta.env.VITE_TTS_SERVICE_URL) {
    return import.meta.env.VITE_TTS_SERVICE_URL;
  }
  
  // Check for backend URL (where temperature-server.js runs)
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 
                     (typeof localStorage !== 'undefined' ? localStorage.getItem('localBackendUrl') : null);
  
  if (backendUrl) {
    // Remove trailing slash and add /api/tts
    const baseUrl = backendUrl.replace(/\/$/, '');
    // If backendUrl is like http://bridge.local:8080, we need to use port 3001 for temp-server
    // But if it's already pointing to temp-server, use that
    if (backendUrl.includes(':3001')) {
      return `${baseUrl}/api/tts`;
    }
    // Otherwise assume temp-server is on same host, different port
    const url = new URL(backendUrl);
    return `${url.protocol}//${url.hostname}:3001/api/tts`;
  }
  
  // Fallback to localhost (for development)
  return "http://localhost:3001/api/tts";
};

const TTS_SERVICE_URL = getTTSServiceUrl();

export default function TTSServiceSettings() {
  const [ttsAvailable, setTtsAvailable] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [healthError, setHealthError] = useState(null);

  const checkHealth = async () => {
    setCheckingHealth(true);
    setHealthError(null);
    
    try {
      const response = await fetch(`${TTS_SERVICE_URL}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(3000), // 3 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        setTtsAvailable(data.model_loaded === true);
        if (!data.model_loaded) {
          setHealthError("TTS service is running but model is not loaded. Check service logs.");
        }
      } else {
        setTtsAvailable(false);
        setHealthError(`Service returned status ${response.status}`);
      }
    } catch (error) {
      setTtsAvailable(false);
      if (error.name === 'AbortError') {
        setHealthError("Connection timeout - service may not be running");
      } else {
        setHealthError(error.message || "Failed to connect to TTS service");
      }
    } finally {
      setCheckingHealth(false);
    }
  };

  // Check health on mount
  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            Open-Source TTS Service (Coqui TTS)
          </h3>
        </div>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
        High-quality, natural-sounding speech synthesis using open-source Coqui TTS.
        No API keys required. Runs locally on your machine.
      </p>

      {/* Service Status */}
      <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {checkingHealth ? (
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            ) : ttsAvailable ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
            <span className="font-medium">
              Service Status: {checkingHealth ? 'Checking...' : ttsAvailable ? 'Available' : 'Not Available'}
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
          </div>
        </div>

        {ttsAvailable && !checkingHealth && (
          <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-700 dark:text-green-300">
              ✅ Coqui TTS service is running and ready. Ask Joule will automatically use it for natural-sounding speech.
            </p>
          </div>
        )}

        {!ttsAvailable && !checkingHealth && (
          <div className="mt-2">
            <p className="text-sm text-red-600 dark:text-red-400">
              TTS service is not available. Start the service to enable open-source TTS.
            </p>
            {healthError && (
              <p className="text-xs text-red-500 dark:text-red-500 mt-1">
                Error: {healthError}
              </p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Service URL: {TTS_SERVICE_URL}
            </p>
            <div className="mt-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-2">
                🚀 How to Start the TTS Service:
              </p>
              <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>📍 Run on Bridge Server (Recommended):</strong>
                    <br /><br />
                    The TTS service should run on your <strong>bridge server</strong> (the same device running <code className="px-1 bg-blue-100 dark:bg-blue-900 rounded">prostat-bridge/server.py</code>). This ensures it's always available and doesn't depend on the user's device.
                    <br /><br />
                    <strong>Steps:</strong>
                    <ol className="list-decimal list-inside ml-2 mt-1 space-y-1">
                      <li>SSH into your bridge server</li>
                      <li>Navigate to the project directory (where <code className="px-1 bg-blue-100 dark:bg-blue-900 rounded">server/tts-service.py</code> is located)</li>
                      <li>Run the command below</li>
                      <li>Optionally set it up as a systemd service to auto-start on boot</li>
                    </ol>
                  </span>
                </p>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    <strong>Option 1: Using NPM script (recommended):</strong>
                  </p>
                  <div className="flex items-center gap-2 mb-2">
                    <code className="flex-1 px-2 py-1.5 bg-gray-800 dark:bg-gray-900 text-green-400 text-xs rounded font-mono break-all">
                      npm run tts-service
                    </code>
                    <button
                      onClick={() => {
                        const command = 'npm run tts-service';
                        if (navigator.clipboard) {
                          navigator.clipboard.writeText(command).then(() => {
                            alert('Command copied to clipboard!');
                          });
                        }
                      }}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    <strong>Option 2: Direct Python command:</strong>
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1.5 bg-gray-800 dark:bg-gray-900 text-green-400 text-xs rounded font-mono break-all">
                      python3 server/tts-service.py
                    </code>
                    <button
                      onClick={() => {
                        const command = 'python3 server/tts-service.py';
                        if (navigator.clipboard) {
                          navigator.clipboard.writeText(command).then(() => {
                            alert('Command copied to clipboard!');
                          });
                        }
                      }}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                <p className="text-xs text-yellow-700 dark:text-yellow-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>First time setup on bridge server:</strong>
                    <ol className="list-decimal list-inside ml-2 mt-1 space-y-1">
                      <li>Install Python dependencies:
                        <code className="block mt-1 px-2 py-1 bg-gray-800 dark:bg-gray-900 text-green-400 rounded font-mono text-xs">
                          pip install -r requirements.txt
                        </code>
                      </li>
                      <li>Make sure the service is accessible from your bridge server's IP/port</li>
                    </ol>
                  </span>
                </p>
              </div>
              <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                <p className="text-xs text-green-700 dark:text-green-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>💡 Optional: Auto-start on boot (systemd service):</strong>
                    <br />
                    To make the TTS service start automatically when the bridge server boots, create a systemd service file:
                    <code className="block mt-1 px-2 py-1 bg-gray-800 dark:bg-gray-900 text-green-400 rounded font-mono text-xs whitespace-pre-wrap">
{`sudo nano /etc/systemd/system/joule-tts.service

[Unit]
Description=Joule HVAC TTS Service
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/path/to/joule-hvac
ExecStart=/usr/bin/python3 server/tts-service.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target

# Then enable and start:
sudo systemctl enable joule-tts
sudo systemctl start joule-tts`}
                    </code>
                    (Replace <code className="px-1 bg-green-100 dark:bg-green-900 rounded">/path/to/joule-hvac</code> with your actual project path and <code className="px-1 bg-green-100 dark:bg-green-900 rounded">pi</code> with your username)
                  </span>
                </p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                After starting the service, click "Refresh" above to check status.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

