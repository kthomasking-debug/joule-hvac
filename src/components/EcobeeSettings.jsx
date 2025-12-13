import React, { useState, useEffect } from 'react';
import { useEcobeeAuth } from '../hooks/useEcobee';
import { getEcobeeCredentials, clearEcobeeCredentials } from '../lib/ecobeeApi';
import { CheckCircle2, XCircle, ExternalLink, Loader2, AlertCircle } from 'lucide-react';

export default function EcobeeSettings() {
  const [apiKey, setApiKey] = useState('');
  const [pin, setPin] = useState('');
  const { authState, startAuth, completeAuth, isAuthenticated } = useEcobeeAuth();
  const [credentials, setCredentials] = useState(null);

  useEffect(() => {
    const creds = getEcobeeCredentials();
    setCredentials(creds);
    if (creds.apiKey) {
      setApiKey(creds.apiKey);
    }
  }, []);

  const handleSetApiKey = () => {
    if (!apiKey.trim()) {
      alert('Please enter your Ecobee API key');
      return;
    }
    localStorage.setItem('ecobeeApiKey', apiKey.trim());
    setCredentials(getEcobeeCredentials());
  };

  const handleStartAuth = async () => {
    if (!apiKey.trim()) {
      alert('Please enter your Ecobee API key first');
      return;
    }
    try {
      await startAuth(apiKey.trim());
    } catch (error) {
      alert(`Failed to start authentication: ${error.message}`);
    }
  };

  const handleCompleteAuth = async () => {
    if (!pin.trim()) {
      alert('Please enter the PIN from Ecobee');
      return;
    }
    try {
      await completeAuth(apiKey.trim(), pin.trim());
      setCredentials(getEcobeeCredentials());
      setPin('');
      // Dispatch event to notify other components of connection change
      window.dispatchEvent(new Event('ecobee-connection-changed'));
    } catch (error) {
      alert(`Failed to complete authentication: ${error.message}`);
    }
  };

  const handleDisconnect = () => {
    if (confirm('Are you sure you want to disconnect from Ecobee?')) {
      clearEcobeeCredentials();
      setCredentials(getEcobeeCredentials());
      setPin('');
      // Dispatch event to notify other components of disconnection
      window.dispatchEvent(new Event('ecobee-connection-changed'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        This is optional and only needed for advanced features HomeKit doesn't expose.
        Connect your Ecobee thermostat to control it directly from the app. 
        Get your API key from{' '}
        <a
          href="https://www.ecobee.com/developers/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
        >
          ecobee.com/developers
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* API Key Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Ecobee API Key
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Ecobee API key"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            disabled={isAuthenticated}
          />
          {!isAuthenticated && (
            <button
              onClick={handleSetApiKey}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
          )}
        </div>
      </div>

      {/* Authentication Status */}
      {credentials?.apiKey && (
        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          {isAuthenticated ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Connected to Ecobee</span>
              </div>
              <button
                onClick={handleDisconnect}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <XCircle className="w-5 h-5" />
                <span>Not connected</span>
              </div>
              
              {authState.step === 'idle' && (
                <button
                  onClick={handleStartAuth}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Start Authentication
                </button>
              )}

              {authState.step === 'requesting-pin' && (
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Requesting PIN...</span>
                </div>
              )}

              {authState.step === 'waiting-auth' && authState.pin && (
                <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                        Enter this PIN on Ecobee:
                      </p>
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 text-center py-2 bg-white dark:bg-gray-800 rounded border-2 border-blue-300 dark:border-blue-700">
                        {authState.pin}
                      </div>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-2 text-center">
                        Go to{' '}
                        <a
                          href={authState.authUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline font-medium"
                        >
                          ecobee.com
                          <ExternalLink className="w-3 h-3 inline ml-1" />
                        </a>{' '}
                        and enter this PIN
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-blue-900 dark:text-blue-100">
                      After entering PIN on Ecobee, click below:
                    </label>
                    <button
                      onClick={handleCompleteAuth}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      I've Entered the PIN
                    </button>
                  </div>
                </div>
              )}

              {authState.step === 'exchanging' && (
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Completing authentication...</span>
                </div>
              )}

              {authState.step === 'error' && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    <strong>Error:</strong> {authState.error}
                  </p>
                  <button
                    onClick={handleStartAuth}
                    className="mt-2 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isAuthenticated && (
        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <p className="text-sm text-green-700 dark:text-green-300">
            ✓ Your thermostat is now connected. You can control it from the main thermostat page.
          </p>
        </div>
      )}
    </div>
  );
}

