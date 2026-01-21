import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Wifi,
  MapPin,
  Zap,
  ArrowRight,
  X,
} from "lucide-react";
import { shareSettingsWithPi } from "../lib/bridgeApi";

/**
 * Complete Pi Zero 2W Onboarding Flow
 * 
 * DEPRECATED: Pi onboarding is now integrated into the main /onboarding page.
 * This component is kept as a fallback modal for users who access e-ink display
 * without going through the main onboarding first.
 * 
 * Recommended: Use /onboarding?rerun=true for a complete setup experience.
 * 
 * Handles: Location → Forecast Calculation → Data Save → Pi Sharing Setup
 * All-in-one frictionless experience
 */
export default function PiZeroOnboarding({ onComplete, onSkip }) {
  const [step, setStep] = useState(0); // 0: Welcome | 1: Location | 2: Pi Setup | 3: Complete
  const [locationInput, setLocationInput] = useState("");
  const [locationError, setLocationError] = useState(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [foundLocation, setFoundLocation] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [piIp, setPiIp] = useState(localStorage.getItem("piIpAddress") || "");
  const [piError, setPiError] = useState(null);
  const [piLoading, setPiLoading] = useState(false);
  const [piConnected, setPiConnected] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  // Handle location search (mirrors SevenDayCostForecaster logic)
  const handleSearchLocation = async () => {
    if (!locationInput.trim()) {
      setLocationError("Please enter a city and state (e.g., 'Atlanta, Georgia')");
      return;
    }

    setLocationError(null);
    setLoadingForecast(true);

    try {
      const input = locationInput.trim();
      let cityPart = input;
      let statePart = null;

      if (input.includes(",")) {
        [cityPart, statePart] = input.split(",").map((s) => s.trim());
      }

      // Geocode location
      const geoResponse = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          cityPart
        )}${statePart ? `&country=United%20States` : ""}&count=10&language=en&format=json`
      );
      const geoData = await geoResponse.json();

      if (!geoData.results || geoData.results.length === 0) {
        throw new Error("Location not found");
      }

      let selectedResult = geoData.results[0];

      // If state was specified, try to find matching state
      if (statePart) {
        const stateMatch = geoData.results.find((r) => {
          const adminName = r.admin1 || "";
          return (
            adminName.toLowerCase() === statePart.toLowerCase() ||
            adminName.substring(0, 2).toLowerCase() === statePart.toLowerCase()
          );
        });
        if (stateMatch) selectedResult = stateMatch;
      }

      const latitude = selectedResult.latitude;
      const longitude = selectedResult.longitude;
      const locationName = selectedResult.name;
      const adminName = selectedResult.admin1 || "";

      // Fetch elevation
      const elevResponse = await fetch(
        `https://api.open-meteo.com/v1/elevation?latitude=${latitude}&longitude=${longitude}`
      );
      const elevData = await elevResponse.json();
      const elevation = Math.round(
        (elevData.elevation ? elevData.elevation[0] : 0) * 3.28084
      ); // Convert to feet

      // Update location state
      const locationData = {
        city: locationName,
        state: adminName,
        latitude,
        longitude,
        elevation,
      };
      setFoundLocation(locationData);

      // Save to localStorage (this will populate userLocation for the forecaster)
      localStorage.setItem("userLocation", JSON.stringify(locationData));

      // Fetch 7-day forecast (to show it was successful)
      const forecastResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,relative_humidity_2m&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto`
      );
      const forecastJson = await forecastResponse.json();
      setForecastData(forecastJson);

      // Advance to next step after showing success
      setTimeout(() => {
        setStep(2); // Go to Pi setup
      }, 500);
    } catch (error) {
      setLocationError(`Failed to find location: ${error.message}`);
    } finally {
      setLoadingForecast(false);
    }
  };

  // Handle Pi connection
  const handleConnectPi = async () => {
    if (!piIp.trim()) {
      setPiError("Please enter the Pi's IP address");
      return;
    }

    setPiError(null);
    setPiLoading(true);

    try {
      // Validate IP format (basic check)
      const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/;
      if (!ipPattern.test(piIp.trim())) {
        throw new Error("Invalid IP address format (e.g., 192.168.1.100:3002)");
      }

      // Health check
      const healthUrl = `http://${piIp}/health`;
      const healthResponse = await fetch(healthUrl, { timeout: 5000 });
      if (!healthResponse.ok) {
        throw new Error("Pi not responding. Check IP address and that bridge is running.");
      }

      // Save Pi IP
      localStorage.setItem("piIpAddress", piIp);

      // Share forecast data and settings with Pi
      const forecastSummary = localStorage.getItem("last_forecast_summary");
      const userSettings = localStorage.getItem("userSettings");

      if (forecastSummary || userSettings) {
        const piUrl = `http://${piIp}`;
        await shareSettingsWithPi(piUrl);
      }

      setPiConnected(true);

      // Advance to complete step
      setTimeout(() => {
        setStep(3);
      }, 1000);
    } catch (error) {
      setPiError(`Connection failed: ${error.message}`);
    } finally {
      setPiLoading(false);
    }
  };

  // Handle skip
  const handleSkip = () => {
    localStorage.setItem("hasCompletedPiOnboarding", "true");
    onSkip?.();
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-800/95 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600/90 to-blue-700/90 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wifi className="w-6 h-6 text-white" />
            <h1 className="text-2xl font-bold text-white">
              Set Up Pi Zero 2W
            </h1>
          </div>
          <button
            onClick={handleSkip}
            className="text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 min-h-[400px] flex flex-col justify-between">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-3">
                  Welcome! Let's set up your system.
                </h2>
                <p className="text-slate-300 text-lg mb-4">
                  In just a few steps, you'll have your e-ink display synced with your Pi Zero 2W and getting real-time cost data.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 bg-slate-700/50 rounded-lg border border-slate-600/50">
                  <MapPin className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-white">Step 1: Location</p>
                    <p className="text-sm text-slate-300">Enter your location to calculate accurate heating/cooling costs</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-slate-700/50 rounded-lg border border-slate-600/50">
                  <Zap className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-white">Step 2: Pi Connection</p>
                    <p className="text-sm text-slate-300">Connect to your Pi Zero 2W and share your settings</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-slate-700/50 rounded-lg border border-slate-600/50">
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-white">Step 3: Done!</p>
                    <p className="text-sm text-slate-300">Your e-ink display will start showing live cost data</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowSkipConfirm(true)}
                  className="px-4 py-3 bg-slate-700/50 text-slate-300 font-medium rounded-lg hover:bg-slate-600/50 transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Location Search */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Where are you located?
                </h2>
                <p className="text-slate-300">
                  We'll use this to fetch accurate weather and calculate your heating/cooling costs.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    City and State
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g., Atlanta, Georgia"
                      value={locationInput}
                      onChange={(e) => {
                        setLocationInput(e.target.value);
                        setLocationError(null);
                      }}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") handleSearchLocation();
                      }}
                      className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50"
                      disabled={loadingForecast}
                    />
                    <button
                      onClick={handleSearchLocation}
                      disabled={loadingForecast || !locationInput.trim()}
                      className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {loadingForecast ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <MapPin className="w-4 h-4" />
                          Search
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {locationError && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-sm text-red-300">{locationError}</p>
                  </div>
                )}

                {foundLocation && (
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-white">
                        {foundLocation.city}, {foundLocation.state}
                      </p>
                      <p className="text-sm text-slate-300">
                        Elevation: {foundLocation.elevation} ft • Forecast data ready
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setStep(0)}
                  className="flex-1 px-4 py-3 bg-slate-700/50 text-slate-300 font-semibold rounded-lg hover:bg-slate-600/50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!foundLocation}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Continue to Pi Setup
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Pi Connection */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Connect your Pi Zero 2W
                </h2>
                <p className="text-slate-300 mb-4">
                  Enter your Pi's IP address to share your settings. The bridge server should already be running.
                </p>
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-sm text-blue-300">
                    💡 Tip: You can find your Pi's IP by running <code className="bg-slate-900 px-2 py-1 rounded text-yellow-300 text-xs">hostname -I</code> on the Pi.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Pi Bridge IP Address
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 192.168.1.50:3002"
                    value={piIp}
                    onChange={(e) => {
                      setPiIp(e.target.value);
                      setPiError(null);
                    }}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") handleConnectPi();
                    }}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50"
                    disabled={piLoading}
                  />
                </div>

                {piError && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-sm text-red-300">{piError}</p>
                  </div>
                )}

                {piConnected && (
                  <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <p className="text-sm text-green-300">
                      ✓ Connected! Settings will be synced to your Pi.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 px-4 py-3 bg-slate-700/50 text-slate-300 font-semibold rounded-lg hover:bg-slate-600/50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleConnectPi}
                  disabled={piLoading || !piIp.trim()}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {piLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Wifi className="w-4 h-4" />
                      Connect
                    </>
                  )}
                </button>
              </div>

              <button
                onClick={() => setShowSkipConfirm(true)}
                className="w-full px-4 py-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
              >
                I'll set this up later
              </button>
            </div>
          )}

          {/* Step 3: Complete */}
          {step === 3 && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-green-500/20 border-2 border-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-green-400" />
                </div>
              </div>

              <div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  You're all set!
                </h2>
                <p className="text-slate-300 text-lg">
                  Your location is configured and your Pi Zero 2W has been connected.
                </p>
              </div>

              <div className="space-y-2 p-4 bg-slate-700/50 rounded-lg border border-slate-600/50 text-left">
                <p className="text-white font-semibold">What happens next:</p>
                <ul className="text-slate-300 text-sm space-y-1 list-disc list-inside">
                  <li>Your e-ink display will sync with the Pi bridge</li>
                  <li>Real-time cost calculations will appear on the display</li>
                  <li>You can adjust temperature with ±1° buttons instantly</li>
                  <li>Data updates automatically every 5 minutes</li>
                </ul>
              </div>

              <button
                onClick={() => {
                  localStorage.setItem("hasCompletedPiOnboarding", "true");
                  onComplete?.();
                }}
                className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Go to Home
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Skip confirmation modal */}
      {showSkipConfirm && (
        <div className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-6 space-y-4">
            <h3 className="text-xl font-bold text-white">Skip setup?</h3>
            <p className="text-slate-300">
              You can always complete this setup later from the settings. Your e-ink display will work offline without a Pi connection.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSkipConfirm(false)}
                className="flex-1 px-4 py-2 bg-slate-700/50 text-slate-300 font-medium rounded-lg hover:bg-slate-600/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSkip}
                className="flex-1 px-4 py-2 bg-red-600/50 text-red-300 font-medium rounded-lg hover:bg-red-600 transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
