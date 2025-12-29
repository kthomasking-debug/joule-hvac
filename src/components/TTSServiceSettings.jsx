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
        <strong>Advanced Feature:</strong> Self-hosted TTS service for power users.
        Most users should use "Browser TTS" (toggle above) or ElevenLabs instead.
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
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Optional advanced feature - not required for normal use.
            </p>
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>💡 Most users don't need this:</strong>
                  <br />
                  • Use "Browser TTS" (toggle above) for built-in voice synthesis
                  <br />
                  • Or use ElevenLabs for premium quality
                  <br />
                  <br />
                  This Coqui TTS service is only for advanced users who want to run their own TTS server.
                  Contact support if you need help setting this up.
                </span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

