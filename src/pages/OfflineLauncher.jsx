import React, { useState, useEffect } from 'react';
import { Download, Chrome, Wifi, WifiOff, CheckCircle, AlertCircle, ExternalLink, Info } from 'lucide-react';

/**
 * Offline Launcher Tool
 * Helps users launch the app in Chrome with offline capabilities
 */
export default function OfflineLauncher() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [appUrl, setAppUrl] = useState(window.location.origin);
  const [isChrome, setIsChrome] = useState(false);

  useEffect(() => {
    // Check if browser is Chrome
    const isChromeBrowser = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    setIsChrome(isChromeBrowser);

    // Monitor online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const launchChrome = () => {
    // Get the bridge URL from localStorage or use default
    const bridgeUrl = localStorage.getItem('jouleBridgeUrl') || 
                     import.meta.env.VITE_JOULE_BRIDGE_URL || 
                     'http://joule-bridge.local:8080';
    
    // Construct Chrome command with app URL
    const chromeCommand = `google-chrome --app=${appUrl} --new-window`;
    
    // For web browsers, we can't directly execute system commands
    // Instead, we'll provide instructions and open in a new window
    const newWindow = window.open(appUrl, '_blank', 'noopener,noreferrer');
    
    if (newWindow) {
      // Store instructions in localStorage for the new window
      localStorage.setItem('offlineModeInstructions', 'true');
    }
  };

  const checkServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration !== undefined;
      } catch (error) {
        console.error('Error checking service worker:', error);
        return false;
      }
    }
    return false;
  };

  const [hasServiceWorker, setHasServiceWorker] = useState(false);

  useEffect(() => {
    checkServiceWorker().then(setHasServiceWorker);
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
            <Chrome className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Offline Launcher
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Launch the app in Chrome for offline access
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className={`p-4 rounded-lg border ${
            isOnline 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' 
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
          }`}>
            <div className="flex items-center gap-3">
              {isOnline ? (
                <>
                  <Wifi className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="font-semibold text-green-900 dark:text-green-100">Online</p>
                    <p className="text-sm text-green-700 dark:text-green-300">Internet connection active</p>
                  </div>
                </>
              ) : (
                <>
                  <WifiOff className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="font-semibold text-red-900 dark:text-red-100">Offline</p>
                    <p className="text-sm text-red-700 dark:text-red-300">No internet connection</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className={`p-4 rounded-lg border ${
            hasServiceWorker 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' 
              : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700'
          }`}>
            <div className="flex items-center gap-3">
              {hasServiceWorker ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="font-semibold text-green-900 dark:text-green-100">Cached</p>
                    <p className="text-sm text-green-700 dark:text-green-300">App is cached for offline use</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                  <div>
                    <p className="font-semibold text-yellow-900 dark:text-yellow-100">Not Cached</p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">App needs to be cached first</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {/* How It Works */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-700">
          <div className="flex items-start gap-3 mb-4">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                How Offline Mode Works
              </h2>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span>The web app runs in <strong>your browser</strong> (not on the internet)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span>All API calls go <strong>directly from your browser to the mini PC</strong> (same network)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span>The mini PC connects to your <strong>Ecobee thermostat</strong> via HomeKit</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span><strong>Nothing goes through the internet</strong> after the initial app download</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span><strong>Works offline</strong> once the app is loaded and cached</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Quick Launch */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Quick Launch
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                App URL
              </label>
              <input
                type="text"
                value={appUrl}
                onChange={(e) => setAppUrl(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="https://your-app-url.com"
              />
            </div>
            <button
              onClick={launchChrome}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
            >
              <Chrome className="w-5 h-5" />
              Open in New Window
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Opens the app in a new window. Make sure to visit all pages while online to cache them.
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Step-by-Step Instructions
          </h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold">
                1
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  Cache the App (Do this while online)
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Visit all the pages you want to use offline. Chrome will automatically cache them.
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4 list-disc">
                  <li>Home page</li>
                  <li>Settings page</li>
                  <li>What If page</li>
                  <li>Budget page</li>
                  <li>Any other pages you use frequently</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold">
                2
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  Enable Offline Mode in Chrome
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Chrome DevTools can help you test offline mode:
                </p>
                <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4 list-decimal">
                  <li>Press <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">F12</kbd> to open DevTools</li>
                  <li>Go to the <strong>Network</strong> tab</li>
                  <li>Check the <strong>"Offline"</strong> checkbox</li>
                  <li>The app should continue working!</li>
                </ol>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold">
                3
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  Use the App Offline
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Once cached, the app will work even when your internet connection is down. 
                  All communication happens directly between your browser and the mini PC bridge on your local network.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Important Notes */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-6 border border-yellow-200 dark:border-yellow-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            Important Notes
          </h2>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-yellow-600 dark:text-yellow-400">•</span>
              <span>You must be on the <strong>same network</strong> as your mini PC bridge for the app to work</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-600 dark:text-yellow-400">•</span>
              <span>The mini PC bridge must be <strong>powered on and connected</strong> to your network</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-600 dark:text-yellow-400">•</span>
              <span>If you change your network (e.g., switch WiFi networks), you may need to update the bridge URL in Settings</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-600 dark:text-yellow-400">•</span>
              <span>Some features that require internet (like weather data) won't work offline, but core thermostat control will</span>
            </li>
          </ul>
        </div>

        {/* Browser Compatibility */}
        {!isChrome && (
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-6 border border-orange-200 dark:border-orange-700">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">
                  Chrome Recommended
                </h3>
                <p className="text-sm text-orange-700 dark:text-orange-300 mb-3">
                  This tool works best with Google Chrome. Chrome has the best support for offline web apps and service workers.
                </p>
                <a
                  href="https://www.google.com/chrome/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400 hover:underline font-medium"
                >
                  Download Chrome
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

