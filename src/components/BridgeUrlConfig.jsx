import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { checkBridgeHealth } from '../lib/jouleBridgeApi';
import { Link } from 'react-router-dom';

export default function BridgeUrlConfig() {
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
      return import.meta.env.VITE_JOULE_BRIDGE_URL || 'http://joule-bridge.local:8080';
    }
  });
  const [bridgeAvailable, setBridgeAvailable] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(false);

  useEffect(() => {
    checkHealth();
  }, [bridgeUrl]);

  const checkHealth = async () => {
    const urlToCheck = bridgeUrl || localStorage.getItem('jouleBridgeUrl') || import.meta.env.VITE_JOULE_BRIDGE_URL || 'http://joule-bridge.local:8080';
    
    if (!urlToCheck || urlToCheck.trim() === '') {
      setBridgeAvailable(false);
      setCheckingHealth(false);
      return;
    }

    setCheckingHealth(true);
    try {
      await checkBridgeHealth();
      setBridgeAvailable(true);
    } catch (error) {
      setBridgeAvailable(false);
    } finally {
      setCheckingHealth(false);
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

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Joule Bridge URL
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={bridgeUrl}
          onChange={(e) => setBridgeUrl(e.target.value)}
          placeholder="http://192.168.0.106:8080"
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
        Usually auto-detected via mDNS. Only enter manually if auto-detection fails. If you need help, contact support at <Link to="/tools/bridge-support" className="text-blue-600 dark:text-blue-400 hover:underline">Bridge Support</Link>.
      </p>
      {!bridgeAvailable && !checkingHealth && bridgeUrl.includes('localhost') && (
        <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-800 dark:text-amber-200">
              <div className="font-semibold mb-1">Using localhost? Bridge might be on another device.</div>
              <div>If your bridge is running on a mini PC or Raspberry Pi, use its IP address instead (e.g., <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">http://192.168.0.106:8080</code>). Find the IP with: <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">hostname -I</code> on the bridge device.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}





