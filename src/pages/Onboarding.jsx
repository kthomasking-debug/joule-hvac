// src/pages/Onboarding.jsx
// Standalone onboarding flow for first-time users

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useOutletContext, Link, useSearchParams } from "react-router-dom";
import {
  MapPin,
  Home,
  Thermometer,
  CheckCircle2,
  ChevronRight,
  Zap,
  ArrowRight,
  Network,
  Lock,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { fullInputClasses, selectClasses } from "../lib/uiClasses";
import { US_STATES } from "../lib/usStates";
import needsCommaBetweenCityAndState from "../utils/validateLocation";
import { WELCOME_THEMES, getWelcomeTheme } from "../data/welcomeThemes";
import { setSetting, getAllSettings } from "../lib/unifiedSettingsManager";
import { calculateHeatLoss } from "../lib/heatUtils";
import UnitSystemToggle from "../components/UnitSystemToggle";
import { useUnitSystem, UNIT_SYSTEMS } from "../lib/units";
import { setBridgeBase } from "../lib/bridgeApi";

// Build public path helper
function buildPublicPath(path) {
  const base = import.meta.env.BASE_URL || "/";
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

// Step definitions
const STEPS = {
  WELCOME: 0,
  LOCATION: 1,
  BUILDING: 2,
  BRIDGE: 3,
  CONFIRMATION: 4,
};

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const outlet = useOutletContext() || {};
  const { userSettings = {}, setUserSetting } = outlet;
  
  // Check if this is a forced re-run
  const isRerun = searchParams.get("rerun") === "true";

  // Check if onboarding should be shown
  // ONLY show onboarding if explicitly triggered with rerun=true parameter
  // This means onboarding is skipped on app startup but can be manually triggered from Mission Control
  const hasCompletedOnboarding = useMemo(() => {
    if (isRerun) {
      return false; // Force show onboarding flow if rerun parameter is present
    }
    // For all other cases (direct navigation without rerun param), skip onboarding
    // Users will be redirected to home via the conditional render below
    return true;
  }, [isRerun]);

  // Onboarding state
  const [step, setStep] = useState(STEPS.WELCOME);
  const [welcomeTheme, setWelcomeTheme] = useState(() => {
    try {
      return localStorage.getItem("welcomeTheme") || "winter";
    } catch {
      return "winter";
    }
  });

  // Location state
  const [cityInput, setCityInput] = useState("");
  const [locationError, setLocationError] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [foundLocation, setFoundLocation] = useState(null);
  const [locationElevation, setLocationElevation] = useState(null);
  
  // Building validation errors
  const [buildingError, setBuildingError] = useState(null);

  // Unit system
  const { unitSystem } = useUnitSystem();

  // Building state (for custom mode)
  const [squareFeet, setSquareFeet] = useState(userSettings.squareFeet || 1500);
  const [insulationLevel, setInsulationLevel] = useState(userSettings.insulationLevel || 1.0);
  const [homeShape, setHomeShape] = useState(userSettings.homeShape || 1.0);
  const [hasLoft, setHasLoft] = useState(userSettings.hasLoft || false);
  const [ceilingHeight, setCeilingHeight] = useState(userSettings.ceilingHeight || 8);
  const [primarySystem, setPrimarySystem] = useState(userSettings.primarySystem || "heatPump");
  // Heat pump size in tons (convert to kBTU: tons * 12)
  const defaultCapacity = userSettings.capacity || userSettings.coolingCapacity || 36; // 36 kBTU = 3 tons
  const defaultTons = defaultCapacity / 12;
  const [heatPumpTons, setHeatPumpTons] = useState(Math.round(defaultTons * 10) / 10); // Round to 1 decimal
  
  // Multi-zone support
  const [numberOfThermostats, setNumberOfThermostats] = useState(() => {
    try {
      const zones = JSON.parse(localStorage.getItem("zones") || "[]");
      return zones.length > 0 ? zones.length : 1;
    } catch {
      return 1;
    }
  });

  // Heat Loss Source
  const [heatLossSource, setHeatLossSource] = useState(() => {
    try {
      const settings = getAllSettings();
      if (settings.useAnalyzerHeatLoss) return "analyzer";
      if (settings.useManualHeatLoss) return "manual";
      return "calculated"; // Default
    } catch {
      return "calculated";
    }
  });

  // Memoize calculated heat loss for display
  const calculatedHeatLoss = useMemo(() => {
    if (heatLossSource === "calculated" && squareFeet && insulationLevel) {
      return calculateHeatLoss({
        squareFeet,
        insulationLevel,
        homeShape: homeShape || 1.0,
        ceilingHeight: ceilingHeight || 8,
        hasLoft: hasLoft || false,
      });
    }
    return 0;
  }, [squareFeet, insulationLevel, homeShape, ceilingHeight, hasLoft, heatLossSource]);

  // Check if analyzer data exists
  const hasAnalyzerData = useMemo(() => {
    try {
      const settings = getAllSettings();
      return !!(settings.useAnalyzerHeatLoss && settings.analyzerHeatLoss && settings.analyzerHeatLoss > 0);
    } catch {
      return false;
    }
  }, []);

  // Building details are now REQUIRED in all modes for Ask Joule to work properly
  const totalSteps = 5; // Always 5 steps: Welcome, Location, Building, Bridge, Confirmation
  
  // Bridge Setup State
  const [bridgeIp, setBridgeIp] = useState(localStorage.getItem('bridgeIp') || '');
  const [pairingCode, setPairingCode] = useState('');
  const [bridgeConnecting, setBridgeConnecting] = useState(false);
  const [bridgeError, setBridgeError] = useState(null);
  const [bridgeConnected, setBridgeConnected] = useState(false);

  // Load saved location on mount
  useEffect(() => {
    try {
      const savedLocation = localStorage.getItem("userLocation");
      if (savedLocation) {
        const loc = JSON.parse(savedLocation);
        if (loc.city && loc.state) {
          setCityInput(`${loc.city}, ${loc.state}`);
          setFoundLocation(`${loc.city}, ${loc.state}`);
          if (loc.elevation) setLocationElevation(loc.elevation);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Geocode location
  const searchLocation = useCallback(async () => {
    if (!cityInput.trim()) {
      setLocationError("Please enter a city and state");
      return;
    }

    // Validate format
    const needsComma = needsCommaBetweenCityAndState(cityInput);
    if (needsComma) {
      setLocationError('Please separate city and state with a comma (e.g., "Denver, CO")');
      return;
    }

    if (!cityInput.includes(",")) {
      setLocationError('Please enter both city and state (e.g., "Denver, Colorado")');
      return;
    }

    setLocationError(null);
    setLocationLoading(true);

    try {
      const inputParts = cityInput.split(",").map(s => s.trim());
      let cityPart = inputParts[0];
      const statePart = inputParts[1]?.toUpperCase();
      
      // Capitalize city name properly (title case) for better API matching
      // Convert "blairsville" to "Blairsville"
      cityPart = cityPart
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      // Expand state abbreviation to full name if needed
      const stateFullName = US_STATES[statePart] || statePart;
      
      // Try multiple query formats for better results
      // Include original input as fallback in case capitalization changes the name
      const originalCityPart = inputParts[0];
      const queries = [
        `${cityPart}, ${stateFullName}`, // Full state name (e.g., "Blairsville, Georgia")
        `${cityPart}, ${statePart}`,     // Abbreviation (e.g., "Blairsville, GA")
        `${originalCityPart}, ${stateFullName}`, // Original case with full state
        `${originalCityPart}, ${statePart}`,     // Original case with abbreviation
        `${cityPart}`,                   // Just city capitalized (fallback)
        `${originalCityPart}`,           // Just city original case (last resort)
      ];
      
      let data = null;
      let lastError = null;
      
      // Try each query until we get results
      for (const query of queries) {
        try {
          const response = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
              query
            )}&count=10&language=en&format=json`
          );
          
          if (!response.ok) {
            continue; // Try next query
          }
          
          data = await response.json();
          
          if (data.results && data.results.length > 0) {
            break; // Found results, stop trying
          }
        } catch (err) {
          lastError = err;
          continue;
        }
      }

      if (!data || !data.results || data.results.length === 0) {
        setLocationError("Location not found. Please check the spelling.");
        setLocationLoading(false);
        return;
      }

      // Find best US match
      const usResults = data.results.filter(
        (r) => (r.country_code || "").toLowerCase() === "us"
      );
      
      if (usResults.length === 0) {
        setLocationError("Location not found in the United States. Please check the spelling.");
        setLocationLoading(false);
        return;
      }
      
      const inputStateLower = statePart?.toLowerCase() || "";
      const stateFullNameLower = stateFullName?.toLowerCase() || "";
      
      // Improved matching: check both abbreviation and full name
      let bestResult = usResults.find((r) => {
        const adminLower = (r.admin1 || "").toLowerCase();
        return (
          adminLower === inputStateLower ||
          adminLower === stateFullNameLower ||
          adminLower.startsWith(stateFullNameLower) ||
          stateFullNameLower.startsWith(adminLower) ||
          (inputStateLower.length === 2 && adminLower.includes(inputStateLower))
        );
      });
      
      // If no state match found but we have results, and state was specified, show selection
      if (!bestResult && statePart && usResults.length > 1) {
        // Multiple cities with same name in different states - show selection
        setLocationError(`Multiple locations found. Please be more specific or select from results.`);
        setLocationLoading(false);
        // TODO: Could show a selection UI here
        return;
      }
      
      // Fallback to first US result if no state match
      bestResult = bestResult || usResults[0];

      if (bestResult) {
        const locationName = `${bestResult.name}, ${bestResult.admin1 || bestResult.country}`;
        // Convert elevation from meters to feet (geocoding APIs typically return meters)
        const elevationInFeet = bestResult.elevation 
          ? Math.round(bestResult.elevation * 3.28084)
          : 0;
        setFoundLocation(locationName);
        setLocationElevation(elevationInFeet);

        // Save to localStorage (include both lat/lon and latitude/longitude for backwards compatibility)
        const locationData = {
          city: bestResult.name,
          state: bestResult.admin1,
          country: bestResult.country,
          lat: bestResult.latitude,
          lon: bestResult.longitude,
          latitude: bestResult.latitude,
          longitude: bestResult.longitude,
          elevation: elevationInFeet,
        };
        localStorage.setItem("userLocation", JSON.stringify(locationData));
        
        // Update userSettings using unified settings manager (for Ask Joule access)
        setSetting("homeElevation", elevationInFeet, { source: "onboarding" });
        
        // Also update via outlet context if available (for backwards compatibility)
        if (setUserSetting) {
          setUserSetting("cityName", locationName);
          setUserSetting("homeElevation", elevationInFeet);
        }
        
        // Dispatch custom event to notify App.jsx to reload location
        window.dispatchEvent(new Event("userLocationUpdated"));
      }
    } catch (err) {
      console.error("Geocoding error:", err);
      setLocationError("Failed to search location. Please try again.");
    }

    setLocationLoading(false);
  }, [cityInput, setUserSetting]);

  // Complete onboarding - defined before handleNext since handleNext references it
  const completeOnboarding = useCallback(() => {
    try {
      // Ensure building details are saved (should already be saved in BUILDING step)
      if (setUserSetting) {
        // Double-check required settings are set
        if (!userSettings.squareFeet) {
          setUserSetting("squareFeet", squareFeet || 1500);
        }
        if (!userSettings.insulationLevel) {
          setUserSetting("insulationLevel", insulationLevel || 1.0);
        }
        if (!userSettings.primarySystem) {
          setUserSetting("primarySystem", primarySystem || "heatPump");
        }
        // Set capacity if missing
        if (!userSettings.capacity && primarySystem === "heatPump") {
          const capacityKBTU = Math.round((heatPumpTons || 3) * 12);
          setSetting("capacity", capacityKBTU, { source: "onboarding" });
          setSetting("coolingCapacity", capacityKBTU, { source: "onboarding" });
          if (setUserSetting) {
            setUserSetting("capacity", capacityKBTU);
            setUserSetting("coolingCapacity", capacityKBTU);
          }
        }
      }
      // Also save using unified settings manager for final completion
      const currentSettings = getAllSettings();
      if (!currentSettings.squareFeet || currentSettings.squareFeet === 800) {
        setSetting("squareFeet", squareFeet || 1500, { source: "onboarding" });
      }
      if (!currentSettings.insulationLevel || currentSettings.insulationLevel === 0.65) {
        setSetting("insulationLevel", insulationLevel || 1.0, { source: "onboarding" });
      }
      localStorage.setItem("hasCompletedOnboarding", "true");
      
      // Dispatch event to notify App.jsx to refresh settings and location
      window.dispatchEvent(new CustomEvent("userSettingsUpdated", {
        detail: { key: null, value: null, updates: null } // Full refresh
      }));
      window.dispatchEvent(new Event("userLocationUpdated"));
    } catch {
      // ignore
    }
    
    // Check if there's a redirect path stored from Mission Control
    const redirectPath = sessionStorage.getItem("onboardingRedirectPath");
    if (redirectPath) {
      sessionStorage.removeItem("onboardingRedirectPath");
      navigate(redirectPath);
    } else {
      navigate("/home");
    }
  }, [setUserSetting, navigate, squareFeet, insulationLevel, primarySystem, heatPumpTons, userSettings]);

  // Handle next step
  const handleNext = useCallback(() => {
    if (step === STEPS.WELCOME) {
      setStep(STEPS.LOCATION);
    } else if (step === STEPS.LOCATION) {
      if (!foundLocation) {
        setLocationError("Please search for and confirm your location first");
        return;
      }
      // Always go to building step - required for Ask Joule
      setStep(STEPS.BUILDING);
    } else if (step === STEPS.BUILDING) {
      // Validate required fields for Ask Joule
      if (!squareFeet || squareFeet < 100 || squareFeet > 20000) {
        setBuildingError("Please enter a valid home size between 100 and 20,000 sq ft");
        return;
      }
      if (!insulationLevel || insulationLevel <= 0) {
        setBuildingError("Please select an insulation quality");
        return;
      }
      if (!numberOfThermostats || numberOfThermostats < 1) {
        setBuildingError("Please select the number of thermostats");
        return;
      }
      if (!heatLossSource) {
        setBuildingError("Please select a heat loss source");
        return;
      }
      
      // Save building settings using unified settings manager (for Ask Joule access)
      setSetting("squareFeet", squareFeet, { source: "onboarding" });
      setSetting("insulationLevel", insulationLevel, { source: "onboarding" });
      setSetting("homeShape", homeShape, { source: "onboarding" });
      setSetting("hasLoft", hasLoft, { source: "onboarding" });
      setSetting("ceilingHeight", ceilingHeight, { source: "onboarding" });
      setSetting("primarySystem", primarySystem, { source: "onboarding" });
      
      // Save heat loss source selection
      setSetting("useCalculatedHeatLoss", heatLossSource === "calculated", { source: "onboarding" });
      setSetting("useManualHeatLoss", heatLossSource === "manual", { source: "onboarding" });
      setSetting("useAnalyzerHeatLoss", heatLossSource === "analyzer", { source: "onboarding" });
      
      // If calculated, compute and save the heat loss value
      if (heatLossSource === "calculated") {
        const heatLossFactor = Math.round(calculatedHeatLoss / 70);
        setSetting("heatLossFactor", heatLossFactor, { source: "onboarding" });
      }
      // Convert tons to kBTU (capacity): 1 ton = 12 kBTU
      if (primarySystem === "heatPump") {
        const capacityKBTU = Math.round(heatPumpTons * 12);
        // Set both capacity and coolingCapacity for compatibility
        setSetting("capacity", capacityKBTU, { source: "onboarding" });
        setSetting("coolingCapacity", capacityKBTU, { source: "onboarding" });
      }
      // Also try outlet context if available (for backwards compatibility)
      if (setUserSetting) {
        setUserSetting("squareFeet", squareFeet);
        setUserSetting("insulationLevel", insulationLevel);
        setUserSetting("homeShape", homeShape);
        setUserSetting("hasLoft", hasLoft);
        setUserSetting("ceilingHeight", ceilingHeight);
        setUserSetting("primarySystem", primarySystem);
        if (primarySystem === "heatPump") {
          const capacityKBTU = Math.round(heatPumpTons * 12);
          setUserSetting("capacity", capacityKBTU);
          setUserSetting("coolingCapacity", capacityKBTU);
        }
      }
      
      setBuildingError(null); // Clear any errors
      setStep(STEPS.BRIDGE);
    } else if (step === STEPS.BRIDGE) {
      setStep(STEPS.CONFIRMATION);
    } else if (step === STEPS.CONFIRMATION) {
      completeOnboarding();
    }
  }, [step, foundLocation, squareFeet, insulationLevel, homeShape, hasLoft, ceilingHeight, primarySystem, heatPumpTons, numberOfThermostats, heatLossSource, setUserSetting, calculatedHeatLoss, completeOnboarding]);

  // Skip onboarding removed - users must complete building details for Ask Joule to work

  const themeData = getWelcomeTheme(welcomeTheme);

  // Generate pairing code
  const generatePairingCode = useCallback(() => {
    const code = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    setPairingCode(code);
    return code;
  }, []);

  // Test bridge connection
  const testBridgeConnection = useCallback(async () => {
    if (!bridgeIp.trim()) {
      setBridgeError('Please enter a bridge IP address');
      return;
    }
    
    setBridgeConnecting(true);
    setBridgeError(null);
    
    try {
      const code = pairingCode || generatePairingCode();
      const bridgeUrl = `http://${bridgeIp.trim()}:8090`;
      
      // Test connectivity
      const testRes = await fetch(`${bridgeUrl}/status`, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      if (!testRes.ok) throw new Error('Bridge not responding');
      
      // Send forecast data to bridge
      const forecastData = localStorage.getItem('last_forecast_summary');
      const configPayload = {
        pairingCode: code,
        timestamp: new Date().toISOString(),
        forecast_summary: forecastData ? JSON.parse(forecastData) : null,
        location: foundLocation ? {
          city: foundLocation.city,
          state: foundLocation.state,
          latitude: foundLocation.latitude,
          longitude: foundLocation.longitude,
          elevation: locationElevation,
        } : null,
      };
      
      const configRes = await fetch(`${bridgeUrl}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configPayload),
        signal: AbortSignal.timeout(5000)
      });
      
      if (!configRes.ok) throw new Error('Failed to send configuration');
      
      // Store bridge settings
      setBridgeBase(bridgeUrl);
      localStorage.setItem('bridgeIp', bridgeIp);
      localStorage.setItem('pairingCode', code);
      
      setBridgeConnected(true);
    } catch (err) {
      setBridgeError(err.message || 'Failed to connect to bridge');
      setBridgeConnected(false);
    } finally {
      setBridgeConnecting(false);
    }
  }, [bridgeIp, pairingCode, generatePairingCode, foundLocation, locationElevation]);

  // If already completed, show a quick redirect message
  if (hasCompletedOnboarding) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full p-8 text-center">
          <CheckCircle2 size={64} className="mx-auto text-green-600 dark:text-green-400 mb-4" />
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            You're all set!
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
            You've already completed onboarding. Ready to launch the app?
          </p>
          <button
            onClick={() => navigate("/analysis/weekly-forecast")}
            className="btn btn-primary px-8 py-3 text-lg"
          >
            Launch App <ArrowRight size={20} className="inline ml-2" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 relative dark:border dark:border-gray-700"
      >
        {/* Skip button - Removed: Building details are required for Ask Joule to function */}
        {/* Users must complete onboarding to ensure Ask Joule has necessary data */}

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-2 w-16 rounded-full transition-all ${
                i <= step ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
              }`}
            />
          ))}
        </div>

        {/* Step 0: Welcome */}
        {step === STEPS.WELCOME && (
          <div className="text-center">
            <div className="rounded-2xl overflow-hidden mb-6 border dark:border-gray-800 h-48 md:h-56">
              {themeData?.file ? (
                <img
                  src={buildPublicPath(themeData.file)}
                  alt={`${themeData.label} background`}
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                  <Zap size={64} />
                </div>
              )}
            </div>
            
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
              Welcome — take a breath
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400 mb-4">
              to the Energy Cost Forecaster
            </p>
            <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed mb-6 max-w-xl mx-auto">
              We'll guide you step by step. No rush, no jargon—just a simple path
              to understanding your energy costs.
            </p>

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
              Uses sensible defaults. You'll still confirm your home details for accurate estimates.
            </p>

            <button onClick={handleNext} className="btn btn-primary px-8 py-3 text-lg">
              Let's Begin
            </button>
          </div>
        )}

        {/* Step 1: Location */}
        {step === STEPS.LOCATION && (
          <div className="text-center">
            <div className="mb-4">
              <MapPin size={48} className="mx-auto text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
              STEP {step + 1} OF {totalSteps}
            </p>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
              Where do you live?
            </h2>
            <p className="text-base text-gray-600 dark:text-gray-400 mb-6">
              We use this for local weather and utility rate data.
            </p>

            <div className="bg-blue-50 dark:bg-blue-950 dark:border dark:border-blue-800 rounded-xl p-6 mb-6">
              <input
                type="text"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                placeholder="Enter city, state (e.g., Denver, CO)"
                className={fullInputClasses}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    searchLocation();
                  }
                }}
              />
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-3 mt-2">
                Format: <span className="font-semibold">City, State</span>
              </p>

              {locationError && (
                <div className="flex items-center gap-2 mt-3 mb-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/40 dark:border-red-700 dark:text-red-200">
                  <span className="text-sm font-medium">{locationError}</span>
                </div>
              )}

              {foundLocation && !locationLoading && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/30 dark:border-green-700">
                  <p className="text-green-800 text-sm dark:text-green-400">
                    ✓ Found: {foundLocation}
                    {locationElevation !== null && (
                      <span className="ml-2 text-xs">({Math.round(locationElevation)} ft elevation)</span>
                    )}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setStep(STEPS.WELCOME)}
                className="btn btn-outline px-6 py-3"
              >
                Back
              </button>
              <button
                onClick={foundLocation ? handleNext : searchLocation}
                disabled={locationLoading}
                className="btn btn-primary px-8 py-3"
              >
                {locationLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Searching...
                  </span>
                ) : foundLocation ? (
                  <span className="flex items-center gap-1">
                    Continue <ChevronRight size={18} />
                  </span>
                ) : (
                  "Search Location"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Building (Required for all modes - needed for Ask Joule) */}
        {step === STEPS.BUILDING && (
          <div className="text-center">
            <div className="mb-4">
              <Home size={48} className="mx-auto text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
              STEP {step + 1} OF {totalSteps}
            </p>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
              Tell us about your home
            </h2>
            <p className="text-base text-gray-600 dark:text-gray-400 mb-4">
              This helps us estimate your energy usage accurately and enables Ask Joule to provide personalized answers.
            </p>
            
            {/* Validation error display */}
            {buildingError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/40 dark:border-red-700 dark:text-red-200 text-sm max-w-md mx-auto">
                {buildingError}
              </div>
            )}

            <div className="space-y-6 text-left max-w-md mx-auto">
              {/* Square Feet */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Home Size (sq ft)
                </label>
                <input
                  type="number"
                  value={squareFeet}
                  onChange={(e) => setSquareFeet(Number(e.target.value))}
                  className={fullInputClasses}
                  min="100"
                  max="20000"
                />
              </div>

              {/* Insulation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Insulation Quality
                </label>
                <select
                  value={insulationLevel}
                  onChange={(e) => setInsulationLevel(Number(e.target.value))}
                  className={selectClasses}
                >
                  <option value={1.4}>Poor (pre-1980, minimal upgrades)</option>
                  <option value={1.0}>Average (1990s-2000s, code-min)</option>
                  <option value={0.65}>Good (post-2010, ENERGY STAR)</option>
                </select>
              </div>

              {/* Building Shape */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Building Shape
                </label>
                <select
                  value={homeShape}
                  onChange={(e) => setHomeShape(Number(e.target.value))}
                  className={selectClasses}
                >
                  <option value={0.9}>Two-Story (less exterior surface)</option>
                  <option value={1.0}>Split-Level / Standard</option>
                  <option value={1.1}>Ranch / Single-Story (more exterior surface)</option>
                  <option value={1.15}>Manufactured Home</option>
                  <option value={1.2}>Cabin</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Affects surface area exposure and heat loss.
                </p>
                {/* Loft toggle - only show for Cabin */}
                {homeShape >= 1.2 && homeShape < 1.3 && (
                  <div className="mt-3">
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasLoft}
                        onChange={(e) => setHasLoft(e.target.checked)}
                        className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 mr-2"
                      />
                      Has Loft (reduces effective square footage for heat loss)
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                      For cabins with lofts, this adjusts the heat loss calculation to account for reduced exterior surface area, similar to a two-story home.
                    </p>
                  </div>
                )}
              </div>

              {/* Ceiling Height */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Average Ceiling Height
                </label>
                <select
                  value={ceilingHeight}
                  onChange={(e) => setCeilingHeight(Number(e.target.value))}
                  className={selectClasses}
                >
                  <option value={8}>8 feet (standard)</option>
                  <option value={9}>9 feet</option>
                  <option value={10}>10 feet</option>
                  <option value={12}>12 feet (vaulted)</option>
                  <option value={16}>16 feet</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Higher ceilings increase heating volume and energy needs.
                </p>
              </div>

              {/* Primary System */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Primary Heating System
                </label>
                <select
                  value={primarySystem}
                  onChange={(e) => setPrimarySystem(e.target.value)}
                  className={selectClasses}
                >
                  <option value="heatPump">Heat Pump</option>
                  <option value="gasFurnace">Gas Furnace</option>
                </select>
              </div>

              {/* Heat Pump Size (only show if heat pump is selected) */}
              {primarySystem === "heatPump" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Heat Pump Size (Tons)
                  </label>
                  <select
                    value={heatPumpTons}
                    onChange={(e) => setHeatPumpTons(Number(e.target.value))}
                    className={selectClasses}
                  >
                    <option value={1.5}>1.5 tons (18k BTU)</option>
                    <option value={2.0}>2.0 tons (24k BTU)</option>
                    <option value={2.5}>2.5 tons (30k BTU)</option>
                    <option value={3.0}>3.0 tons (36k BTU)</option>
                    <option value={3.5}>3.5 tons (42k BTU)</option>
                    <option value={4.0}>4.0 tons (48k BTU)</option>
                    <option value={5.0}>5.0 tons (60k BTU)</option>
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Standard residential sizes. Check your unit's nameplate or manual.
                  </p>
                </div>
              )}

              {/* Number of Thermostats/Zones */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  How many thermostats do you have?
                </label>
                <select
                  value={numberOfThermostats}
                  onChange={(e) => setNumberOfThermostats(Number(e.target.value))}
                  className={selectClasses}
                >
                  <option value={1}>1 thermostat (single zone)</option>
                  <option value={2}>2 thermostats (multi-zone)</option>
                  <option value={3}>3 thermostats (multi-zone)</option>
                  <option value={4}>4+ thermostats (multi-zone)</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {numberOfThermostats > 1 ? (
                    <span>You can configure each zone separately in Settings. Each zone can have its own CSV data upload.</span>
                  ) : (
                    <span>If you have multiple thermostats, select the correct number to enable multi-zone analysis.</span>
                  )}
                </p>
              </div>

              {/* Heat Loss Source Selection Card */}
              <div className="mt-6 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl border border-blue-200 dark:border-blue-800 shadow-sm">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                  Heat Loss Source
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                  Select which method to use for heat loss calculations. Only one option can be active at a time.
                </p>

                <div className="space-y-3">
                  {/* Calculated Option */}
                  <label className="flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all hover:bg-white/50 dark:hover:bg-white/5"
                    style={{ borderColor: heatLossSource === "calculated" ? "#3b82f6" : "transparent", backgroundColor: heatLossSource === "calculated" ? "rgba(59, 130, 246, 0.1)" : "transparent" }}>
                    <input
                      type="radio"
                      name="heatLossSource"
                      value="calculated"
                      checked={heatLossSource === "calculated"}
                      onChange={(e) => setHeatLossSource(e.target.value)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          Calculated (DOE Data)
                        </span>
                        <span className="px-2 py-0.5 text-xs font-bold bg-emerald-500 text-white rounded uppercase">
                          Recommended
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        Most accurate for typical homes. Based on square footage, insulation, home shape, and ceiling height.
                      </p>
                      {heatLossSource === "calculated" && calculatedHeatLoss > 0 && (
                        <p className="text-xs font-mono text-gray-700 dark:text-gray-300 bg-white/50 dark:bg-gray-800/50 px-2 py-1 rounded">
                          Current value: {Math.round(calculatedHeatLoss / 70)} BTU/hr/°F ({calculatedHeatLoss.toLocaleString()} BTU/hr @ 70°F ΔT)
                        </p>
                      )}
                    </div>
                  </label>

                  {/* Manual Entry Option */}
                  <label className="flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all hover:bg-white/50 dark:hover:bg-white/5"
                    style={{ borderColor: heatLossSource === "manual" ? "#3b82f6" : "transparent", backgroundColor: heatLossSource === "manual" ? "rgba(59, 130, 246, 0.1)" : "transparent" }}>
                    <input
                      type="radio"
                      name="heatLossSource"
                      value="manual"
                      checked={heatLossSource === "manual"}
                      onChange={(e) => setHeatLossSource(e.target.value)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white block mb-1">
                        Manual Entry
                      </span>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        For users with professional energy audits. Enter exact heat loss in BTU/hr/°F.
                      </p>
                    </div>
                  </label>

                  {/* CSV Analyzer Option */}
                  <label className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all ${
                    hasAnalyzerData 
                      ? "cursor-pointer hover:bg-white/50 dark:hover:bg-white/5" 
                      : "cursor-not-allowed opacity-60"
                  }`}
                    style={{ borderColor: heatLossSource === "analyzer" ? "#3b82f6" : "transparent", backgroundColor: heatLossSource === "analyzer" ? "rgba(59, 130, 246, 0.1)" : "transparent" }}>
                    <input
                      type="radio"
                      name="heatLossSource"
                      value="analyzer"
                      checked={heatLossSource === "analyzer"}
                      onChange={(e) => hasAnalyzerData && setHeatLossSource(e.target.value)}
                      disabled={!hasAnalyzerData}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white block mb-1">
                        From CSV Analyzer
                      </span>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        Uses your uploaded thermostat data from System Performance Analyzer for data-driven accuracy.
                      </p>
                      {hasAnalyzerData ? (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                          ✓ Using analyzer-based heat loss ({userSettings.analyzerHeatLoss?.toFixed(1) || "N/A"} BTU/hr/°F)
                        </p>
                      ) : (
                        <p className="text-xs text-amber-600 dark:text-amber-400 italic">
                          No analyzer data available. Upload CSV in <Link to="/performance-analyzer" className="underline font-semibold">System Performance Analyzer</Link> →
                        </p>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {/* Unit System Selection */}
              <div className="mt-6 p-5 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-2xl border border-indigo-200 dark:border-indigo-800 shadow-sm">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                  Display Preferences
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                  Choose your preferred unit system for temperatures, energy, and capacity.
                </p>
                <div className="flex items-center justify-center">
                  <UnitSystemToggle />
                </div>
                <p className="mt-3 text-xs text-gray-600 dark:text-gray-400 text-center">
                  US mode: °F, kBTU/h, BTU/hr/°F, kWh. International mode: °C, kW, W/K, Joules (with kWh in parentheses).
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-center mt-8">
              <button
                onClick={() => setStep(STEPS.LOCATION)}
                className="btn btn-outline px-6 py-3"
              >
                Back
              </button>
              <button onClick={handleNext} className="btn btn-primary px-8 py-3">
                <span className="flex items-center gap-1">
                  Continue <ChevronRight size={18} />
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Bridge Setup (Optional) */}
        {step === STEPS.BRIDGE && (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <Network size={48} className="mx-auto text-blue-600 dark:text-blue-400 mb-4" />
              <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Connect Joule Bridge
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Set up your backup power monitoring system
              </p>
            </div>

            <div className="space-y-6">
              {/* Bridge IP Input */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 uppercase mb-2 flex items-center gap-2">
                  <Network size={16} /> Bridge IP Address
                </label>
                <input 
                  type="text" 
                  placeholder="192.168.1.100" 
                  value={bridgeIp} 
                  onChange={(e) => setBridgeIp(e.target.value)}
                  className={fullInputClasses}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Find this on your Pi bridge device or router</p>
              </div>

              {/* Pairing Code Display */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 uppercase mb-2 flex items-center gap-2">
                  <Lock size={16} /> Pairing Code
                </label>
                <div className="flex gap-3">
                  <div className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg py-4 px-4 text-3xl font-black text-blue-600 dark:text-blue-400 font-mono text-center">
                    {pairingCode || '----'}
                  </div>
                  <button
                    onClick={() => generatePairingCode()}
                    className="btn btn-primary px-6"
                  >
                    Generate
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Share this code with your bridge for verification</p>
              </div>

              {/* Error Message */}
              {bridgeError && (
                <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 rounded-lg p-4 flex gap-3 text-sm text-red-700 dark:text-red-200">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <span>{bridgeError}</span>
                </div>
              )}

              {/* Connection Status */}
              {bridgeConnected && (
                <div className="bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 rounded-lg p-4 flex gap-3 text-sm text-green-700 dark:text-green-200">
                  <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
                  <span>Bridge connected successfully! Configuration sent.</span>
                </div>
              )}

              {/* Test Connection Button */}
              <button
                onClick={testBridgeConnection}
                disabled={bridgeConnecting || !bridgeIp.trim()}
                className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {bridgeConnecting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" /> Connecting...
                  </>
                ) : (
                  <>
                    <Network size={20} /> Test Connection & Send Config
                  </>
                )}
              </button>
            </div>

            <div className="flex gap-3 justify-center mt-8">
              <button
                onClick={() => setStep(STEPS.BUILDING)}
                className="btn btn-outline px-6 py-3"
              >
                Back
              </button>
              <button onClick={handleNext} className="btn btn-primary px-8 py-3">
                <span className="flex items-center gap-1">
                  {bridgeConnected ? 'Continue' : 'Skip & Continue'} <ChevronRight size={18} />
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Confirmation (Required for all modes) */}
        {step === STEPS.CONFIRMATION && (
          <div className="text-center">
            <div className="mb-4">
              <CheckCircle2 size={48} className="mx-auto text-green-600 dark:text-green-400" />
            </div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
              STEP {step + 1} OF {totalSteps}
            </p>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
              You're all set!
            </h2>
            <p className="text-base text-gray-600 dark:text-gray-400 mb-6">
              Here's a summary of your setup:
            </p>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 mb-6 text-left max-w-md mx-auto">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Location</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{foundLocation}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Home Size</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{squareFeet.toLocaleString()} sq ft</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Insulation</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {insulationLevel >= 1.2 ? "Poor" : insulationLevel >= 0.9 ? "Average" : insulationLevel >= 0.6 ? "Good" : "Excellent"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Building Shape</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {homeShape <= 0.9 ? "Two-Story" : homeShape <= 1.0 ? "Split-Level" : homeShape <= 1.1 ? "Ranch" : homeShape <= 1.15 ? "Manufactured" : "Cabin"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Ceiling Height</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{ceilingHeight} ft</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Heating System</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {primarySystem === "heatPump" ? "Heat Pump" : "Gas Furnace"}
                  </span>
                </div>
                {primarySystem === "heatPump" && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Heat Pump Size</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {heatPumpTons} tons ({Math.round(heatPumpTons * 12)}k BTU)
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Thermostats/Zones</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {numberOfThermostats} {numberOfThermostats === 1 ? "zone" : "zones"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Unit System</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {unitSystem === UNIT_SYSTEMS.INTL ? "International" : "US"}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              You can adjust these settings anytime in <Link to="/settings" className="text-blue-600 hover:underline">Settings</Link>.
            </p>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setStep(STEPS.BUILDING)}
                className="btn btn-outline px-6 py-3"
              >
                Back
              </button>
              <button onClick={handleNext} className="btn btn-primary px-8 py-3">
                <span className="flex items-center gap-1">
                  Start Exploring <Zap size={18} />
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
