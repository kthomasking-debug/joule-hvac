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
} from "lucide-react";
import { fullInputClasses, selectClasses } from "../lib/uiClasses";
import { US_STATES } from "../lib/usStates";
import needsCommaBetweenCityAndState from "../utils/validateLocation";
import { WELCOME_THEMES, getWelcomeTheme } from "../data/welcomeThemes";
import { setSetting, getAllSettings } from "../lib/unifiedSettingsManager";

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
  CONFIRMATION: 3,
};

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const outlet = useOutletContext() || {};
  const { userSettings = {}, setUserSetting } = outlet;
  
  // Check if this is a forced re-run
  const isRerun = searchParams.get("rerun") === "true";

  // Check if onboarding is already completed (but allow re-running if rerun param is set)
  const hasCompletedOnboarding = useMemo(() => {
    if (isRerun) {
      return false; // Force show onboarding flow if rerun parameter is present
    }
    try {
      return localStorage.getItem("hasCompletedOnboarding") === "true";
    } catch {
      return false;
    }
  }, [isRerun]);

  // Onboarding state
  const [step, setStep] = useState(STEPS.WELCOME);
  const [mode, setMode] = useState("quick"); // 'quick' | 'custom'
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

  // Building state (for custom mode)
  const [squareFeet, setSquareFeet] = useState(userSettings.squareFeet || 1500);
  const [insulationLevel, setInsulationLevel] = useState(userSettings.insulationLevel || 1.0);
  const [primarySystem, setPrimarySystem] = useState(userSettings.primarySystem || "heatPump");
  // Heat pump size in tons (convert to kBTU: tons * 12)
  const defaultCapacity = userSettings.capacity || userSettings.coolingCapacity || 36; // 36 kBTU = 3 tons
  const defaultTons = defaultCapacity / 12;
  const [heatPumpTons, setHeatPumpTons] = useState(Math.round(defaultTons * 10) / 10); // Round to 1 decimal

  // Building details are now REQUIRED in all modes for Ask Joule to work properly
  const totalSteps = 4; // Always 4 steps: Welcome, Location, Building, Confirmation

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
      const cityPart = inputParts[0];
      const statePart = inputParts[1]?.toUpperCase();
      
      // Expand state abbreviation to full name if needed
      const stateFullName = US_STATES[statePart] || statePart;
      
      // Try multiple query formats for better results
      const queries = [
        `${cityPart}, ${stateFullName}`, // Full state name
        `${cityPart}, ${statePart}`,     // Abbreviation
        cityPart,                        // Just city (fallback)
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
      }) || usResults[0] || data.results[0];

      if (bestResult) {
        const locationName = `${bestResult.name}, ${bestResult.admin1 || bestResult.country}`;
        setFoundLocation(locationName);
        setLocationElevation(bestResult.elevation || 0);

        // Save to localStorage
        const locationData = {
          city: bestResult.name,
          state: bestResult.admin1,
          country: bestResult.country,
          lat: bestResult.latitude,
          lon: bestResult.longitude,
          elevation: bestResult.elevation || 0,
        };
        localStorage.setItem("userLocation", JSON.stringify(locationData));
        
        // Update userSettings using unified settings manager (for Ask Joule access)
        setSetting("homeElevation", bestResult.elevation || 0, { source: "onboarding" });
        
        // Also update via outlet context if available (for backwards compatibility)
        if (setUserSetting) {
          setUserSetting("cityName", locationName);
          setUserSetting("homeElevation", bestResult.elevation || 0);
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
      if (!squareFeet || squareFeet < 100 || squareFeet > 50000) {
        setBuildingError("Please enter a valid home size between 100 and 50,000 sq ft");
        return;
      }
      if (!insulationLevel || insulationLevel <= 0) {
        setBuildingError("Please select an insulation quality");
        return;
      }
      
      // Save building settings using unified settings manager (for Ask Joule access)
      setSetting("squareFeet", squareFeet, { source: "onboarding" });
      setSetting("insulationLevel", insulationLevel, { source: "onboarding" });
      setSetting("primarySystem", primarySystem, { source: "onboarding" });
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
        setUserSetting("primarySystem", primarySystem);
        if (primarySystem === "heatPump") {
          const capacityKBTU = Math.round(heatPumpTons * 12);
          setUserSetting("capacity", capacityKBTU);
          setUserSetting("coolingCapacity", capacityKBTU);
        }
      }
      setBuildingError(null); // Clear any errors
      setStep(STEPS.CONFIRMATION);
    } else if (step === STEPS.CONFIRMATION) {
      completeOnboarding();
    }
  }, [step, mode, foundLocation, squareFeet, insulationLevel, primarySystem, heatPumpTons, setUserSetting]);

  // Complete onboarding
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
    navigate("/app");
  }, [setUserSetting, navigate, squareFeet, insulationLevel, primarySystem, heatPumpTons, userSettings]);

  // Skip onboarding - REMOVED: Users must complete building details for Ask Joule to work
  // If skip is needed for testing, it should still set minimum required fields
  const handleSkip = useCallback(() => {
    // Set minimum required fields for Ask Joule even when skipping
    if (setUserSetting) {
      setUserSetting("squareFeet", squareFeet || 1500);
      setUserSetting("insulationLevel", insulationLevel || 1.0);
      setUserSetting("primarySystem", primarySystem || "heatPump");
      if (primarySystem === "heatPump" || !primarySystem) {
        const capacityKBTU = Math.round((heatPumpTons || 3) * 12);
        setUserSetting("capacity", capacityKBTU);
        setUserSetting("coolingCapacity", capacityKBTU);
      }
    }
    try {
      localStorage.setItem("hasCompletedOnboarding", "true");
    } catch {
      // ignore
    }
    navigate("/app");
  }, [navigate, setUserSetting, squareFeet, insulationLevel, primarySystem, heatPumpTons]);

  const themeData = getWelcomeTheme(welcomeTheme);

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
            onClick={() => navigate("/app")}
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

            {/* Quick vs Custom toggle - Both modes now collect building details for Ask Joule */}
            <div className="mb-6">
              <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
                <button
                  onClick={() => setMode("quick")}
                  className={`px-4 py-2 text-sm font-semibold transition-colors ${
                    mode === "quick"
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  Quick Setup
                </button>
                <button
                  onClick={() => setMode("custom")}
                  className={`px-4 py-2 text-sm font-semibold transition-colors ${
                    mode === "custom"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  Custom Setup
                </button>
              </div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {mode === "quick" ? (
                  <span>Uses sensible defaults. You'll still confirm your home details for accurate estimates.</span>
                ) : (
                  <span>Walk through all building and system inputs for best accuracy.</span>
                )}
              </div>
            </div>

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
                  <option value={1.3}>Poor (older home, drafty)</option>
                  <option value={1.0}>Average (typical construction)</option>
                  <option value={0.7}>Good (modern, well-sealed)</option>
                  <option value={0.5}>Excellent (energy star certified)</option>
                </select>
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

        {/* Step 3: Confirmation (Required for all modes) */}
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
