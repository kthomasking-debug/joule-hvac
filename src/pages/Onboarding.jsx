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
  AlertTriangle,
  Loader2,
  Search,
  Edit3,
  Clock,
  HelpCircle,
  Cloud,
  Check,
  DollarSign,
  Cpu,
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
import { AI_PROVIDERS } from "../lib/aiProvider";

const JOULE_LLM_URL = (import.meta.env.VITE_JOULE_LLM_URL || "https://tricks-actions-applied-clothing.trycloudflare.com/v1").trim();
import { getStateElectricityRate, getStateGasRate } from "../data/stateRates";
import {
  defaultFixedChargesByState,
  defaultFallbackFixedCharges,
  normalizeStateToAbbreviation,
} from "../data/fixedChargesByState";

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
  COST_SETTINGS: 3,
  BRIDGE: 4,
  AI: 5,
  CONFIRMATION: 6,
};

// Step labels for progress bar
const STEP_LABELS = ['Welcome', 'Location', 'Building', 'Costs', 'Bridge', 'AI', 'Done'];

// Step benefits - what each step unlocks
const STEP_BENEFITS = {
  [STEPS.LOCATION]: 'Enables local weather data and utility rates',
  [STEPS.BUILDING]: 'Calculates your home\'s heat loss for accurate costs',
  [STEPS.COST_SETTINGS]: 'Used for 7-day forecasts, annual estimates, and gas vs heat pump comparisons',
  [STEPS.BRIDGE]: 'Streams real-time data from your Ecobee thermostat',
  [STEPS.AI]: 'Optional: set up Ask Joule — use Joule (free), Groq, or your computer',
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
  const [welcomeTheme, _setWelcomeTheme] = useState(() => {
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
  // Gas furnace: size in kBTU and AFUE (only used when primarySystem === "gasFurnace")
  const furnaceSizeOptions = [40, 60, 80, 100, 120];
  const defaultFurnaceKbtu = furnaceSizeOptions.includes(defaultCapacity) ? defaultCapacity : 80;
  const [furnaceSizeKbtu, setFurnaceSizeKbtu] = useState(userSettings.primarySystem === "gasFurnace" || userSettings.primarySystem === "acPlusGas" ? (userSettings.capacity || defaultFurnaceKbtu) : defaultFurnaceKbtu);
  const [afue, setAfue] = useState(userSettings.afue ?? 0.9);
  // Central AC tons (only when primarySystem === "acPlusGas"): cooling in summer
  const defaultAcTons = (userSettings.coolingCapacity || 36) / 12;
  const [acTons, setAcTons] = useState(userSettings.primarySystem === "acPlusGas" ? Math.round(defaultAcTons * 10) / 10 : 3);

  // Multi-zone support
  const [numberOfThermostats, setNumberOfThermostats] = useState(() => {
    try {
      const zones = JSON.parse(localStorage.getItem("zones") || "[]");
      return zones.length > 0 ? zones.length : 1;
    } catch {
      return 1;
    }
  });

  // Cost settings state (for Cost Settings onboarding step)
  const [utilityCost, setUtilityCost] = useState(
    userSettings.utilityCost != null ? Number(userSettings.utilityCost) : 0.10
  );
  const [gasCost, setGasCost] = useState(
    userSettings.gasCost != null ? Number(userSettings.gasCost) : 1.2
  );
  const [fixedElectricCost, setFixedElectricCost] = useState(
    userSettings.fixedElectricCost != null ? Number(userSettings.fixedElectricCost) : 15
  );

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
  const totalSteps = 7; // Welcome, Location, Building, Cost Settings, Bridge, AI (optional), Confirmation
  
  // Bridge Setup State
  const [bridgeIp, setBridgeIp] = useState(localStorage.getItem('bridgeIp') || '');
  const [pairingCode, setPairingCode] = useState(localStorage.getItem('pairingCode') || '');
  const [dismissedPairingNotice, setDismissedPairingNotice] = useState(false);
  const [bridgeConnecting, setBridgeConnecting] = useState(false);
  const [searchingBridge, setSearchingBridge] = useState(false);
  const [bridgeError, setBridgeError] = useState(null);
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [bridgeDeviceId, setBridgeDeviceId] = useState(localStorage.getItem('bridgeDeviceId') || '');
  const [ecobeeAlreadyPaired, setEcobeeAlreadyPaired] = useState(false);
  const [pairedEcobeeInfo, setPairedEcobeeInfo] = useState(null);

  // AI step: "joule" = Use Joule (free, default), "groq" = Groq Cloud, "local" = Local (Ollama / your computer)
  const [onboardingAiChoice, setOnboardingAiChoice] = useState(() => {
    try {
      const p = localStorage.getItem("aiProvider");
      if (p === AI_PROVIDERS.LOCAL) return "local";
      if (p === AI_PROVIDERS.GROQ && (localStorage.getItem("groqApiKey") || "").trim()) return "groq";
    } catch { /* ignore */ }
    return "joule";
  });
  const [onboardingGroqKey, setOnboardingGroqKey] = useState(() => (localStorage.getItem("groqApiKey") || "").trim());
  const [onboardingLocalUrl, setOnboardingLocalUrl] = useState(() =>
    (localStorage.getItem("localAIBaseUrl") || "http://localhost:11434/v1").trim()
  );
  const [onboardingLocalModel, setOnboardingLocalModel] = useState(() =>
    (localStorage.getItem("localAIModel") || "llama3:latest").trim()
  );
  const [onboardingOllamaOnThisDevice, setOnboardingOllamaOnThisDevice] = useState(true);

  // Derive state name and abbreviation from foundLocation for cost settings
  const { costStateName, costStateAbbr, costLocationDisplay } = useMemo(() => {
    if (!foundLocation || !foundLocation.includes(",")) {
      return { costStateName: null, costStateAbbr: null, costLocationDisplay: null };
    }
    const parts = foundLocation.split(",").map((s) => s.trim());
    const cityPart = parts[0];
    const statePart = parts[1];
    if (!statePart) return { costStateName: null, costStateAbbr: null, costLocationDisplay: foundLocation };
    // State can be "Georgia" or "GA"
    const stateName = statePart.length === 2 ? US_STATES[statePart.toUpperCase()] || statePart : statePart;
    const stateAbbr = normalizeStateToAbbreviation(statePart);
    return {
      costStateName: stateName,
      costStateAbbr: stateAbbr,
      costLocationDisplay: `${cityPart}, ${stateName}`,
    };
  }, [foundLocation]);

  // Auto-populate cost settings from state when entering Cost Settings step (once per step visit)
  const appliedCostStateDefaultsRef = React.useRef(false);
  useEffect(() => {
    if (step !== STEPS.COST_SETTINGS || !costStateName || !costStateAbbr) {
      if (step !== STEPS.COST_SETTINGS) appliedCostStateDefaultsRef.current = false;
      return;
    }
    if (appliedCostStateDefaultsRef.current) return;
    appliedCostStateDefaultsRef.current = true;
    const stateElec = getStateElectricityRate(costStateName);
    const stateGas = getStateGasRate(costStateName);
    const defaultFixed = defaultFixedChargesByState[costStateAbbr]
      ? defaultFixedChargesByState[costStateAbbr].electric
      : defaultFallbackFixedCharges.electric;
    setUtilityCost(stateElec);
    setGasCost(stateGas);
    setFixedElectricCost(defaultFixed);
  }, [step, costStateName, costStateAbbr]);

  // When entering AI step with "Use Joule (free)" selected, ensure Local config uses Joule server
  const appliedJouleDefaultsRef = React.useRef(false);
  useEffect(() => {
    if (step !== STEPS.AI || onboardingAiChoice !== "joule") {
      if (step !== STEPS.AI) appliedJouleDefaultsRef.current = false;
      return;
    }
    if (appliedJouleDefaultsRef.current) return;
    appliedJouleDefaultsRef.current = true;
    setOnboardingOllamaOnThisDevice(false);
    if (JOULE_LLM_URL) setOnboardingLocalUrl(JOULE_LLM_URL);
    setOnboardingLocalModel("llama3:latest");
  }, [step, onboardingAiChoice]);

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
      
      // For rerun, skip to cost settings step if location and building are already set
      if (isRerun) {
        const hasLocation = savedLocation && JSON.parse(savedLocation).city;
        const settings = getAllSettings();
        const hasBuilding = settings.squareFeet && settings.squareFeet > 0;
        if (hasLocation && hasBuilding) {
          setStep(STEPS.COST_SETTINGS);
        }
      }
    } catch {
      // ignore
    }
  }, [isRerun]);

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
        } catch {
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
        if (!userSettings.capacity && primarySystem === "heatPump") {
          const capacityKBTU = Math.round((heatPumpTons || 3) * 12);
          setSetting("capacity", capacityKBTU, { source: "onboarding" });
          setSetting("coolingCapacity", capacityKBTU, { source: "onboarding" });
          if (setUserSetting) {
            setUserSetting("capacity", capacityKBTU);
            setUserSetting("coolingCapacity", capacityKBTU);
          }
        }
        if (primarySystem === "gasFurnace") {
          setSetting("capacity", furnaceSizeKbtu, { source: "onboarding" });
          setSetting("afue", afue, { source: "onboarding" });
          if (setUserSetting) {
            setUserSetting("capacity", furnaceSizeKbtu);
            setUserSetting("afue", afue);
          }
        }
        if (primarySystem === "acPlusGas") {
          setSetting("capacity", furnaceSizeKbtu, { source: "onboarding" });
          setSetting("coolingCapacity", Math.round((acTons || 3) * 12), { source: "onboarding" });
          setSetting("afue", afue, { source: "onboarding" });
          if (setUserSetting) {
            setUserSetting("capacity", furnaceSizeKbtu);
            setUserSetting("coolingCapacity", Math.round((acTons || 3) * 12));
            setUserSetting("afue", afue);
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
      // If pairing code was entered, go to monthly budget (needs bridge connection)
      // Otherwise, go to weekly forecast (works without bridge)
      const hasPairingCode = localStorage.getItem('pairingCode');
      navigate(hasPairingCode ? "/analysis/monthly" : "/analysis/weekly");
    }
  }, [setUserSetting, navigate, squareFeet, insulationLevel, primarySystem, heatPumpTons, furnaceSizeKbtu, afue, acTons, userSettings]);

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
      // Convert tons to kBTU (capacity): 1 ton = 12 kBTU for heat pump; furnace size in kBTU for gas
      if (primarySystem === "heatPump") {
        const capacityKBTU = Math.round(heatPumpTons * 12);
        setSetting("capacity", capacityKBTU, { source: "onboarding" });
        setSetting("coolingCapacity", capacityKBTU, { source: "onboarding" });
      } else if (primarySystem === "gasFurnace") {
        setSetting("capacity", furnaceSizeKbtu, { source: "onboarding" });
        setSetting("afue", afue, { source: "onboarding" });
      } else if (primarySystem === "acPlusGas") {
        setSetting("capacity", furnaceSizeKbtu, { source: "onboarding" });
        setSetting("coolingCapacity", Math.round(acTons * 12), { source: "onboarding" });
        setSetting("afue", afue, { source: "onboarding" });
      }
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
        } else if (primarySystem === "gasFurnace") {
          setUserSetting("capacity", furnaceSizeKbtu);
          setUserSetting("afue", afue);
        } else if (primarySystem === "acPlusGas") {
          setUserSetting("capacity", furnaceSizeKbtu);
          setUserSetting("coolingCapacity", Math.round(acTons * 12));
          setUserSetting("afue", afue);
        }
      }
      
      setBuildingError(null); // Clear any errors
      setStep(STEPS.COST_SETTINGS);
    } else if (step === STEPS.COST_SETTINGS) {
      // Save cost settings
      setSetting("utilityCost", utilityCost, { source: "onboarding" });
      setSetting("gasCost", gasCost, { source: "onboarding" });
      setSetting("fixedElectricCost", fixedElectricCost, { source: "onboarding" });
      if (setUserSetting) {
        setUserSetting("utilityCost", utilityCost);
        setUserSetting("gasCost", gasCost);
        setUserSetting("fixedElectricCost", fixedElectricCost);
      }
      setStep(STEPS.BRIDGE);
    } else if (step === STEPS.BRIDGE) {
      setStep(STEPS.AI);
    } else if (step === STEPS.AI) {
      // Persist AI choice to localStorage
      try {
        if (onboardingAiChoice === "local" || onboardingAiChoice === "joule") {
          localStorage.setItem("aiProvider", AI_PROVIDERS.LOCAL);
          const url = onboardingAiChoice === "joule"
            ? (onboardingLocalUrl || JOULE_LLM_URL)
            : (onboardingLocalUrl || "http://localhost:11434/v1");
          localStorage.setItem("localAIBaseUrl", url);
          localStorage.setItem("localAIModel", onboardingLocalModel || "llama3:latest");
          localStorage.removeItem("groqApiKey");
        } else {
          localStorage.setItem("aiProvider", AI_PROVIDERS.GROQ);
          if ((onboardingGroqKey || "").trim()) localStorage.setItem("groqApiKey", (onboardingGroqKey || "").trim());
          else localStorage.removeItem("groqApiKey");
        }
        window.dispatchEvent(new Event("storage"));
      } catch { /* ignore */ }
      setStep(STEPS.CONFIRMATION);
    } else if (step === STEPS.CONFIRMATION) {
      completeOnboarding();
    }
  }, [step, foundLocation, squareFeet, insulationLevel, homeShape, hasLoft, ceilingHeight, primarySystem, heatPumpTons, furnaceSizeKbtu, afue, acTons, numberOfThermostats, heatLossSource, utilityCost, gasCost, fixedElectricCost, setUserSetting, calculatedHeatLoss, completeOnboarding, onboardingAiChoice, onboardingGroqKey, onboardingLocalUrl, onboardingLocalModel]);

  // Skip onboarding removed - users must complete building details for Ask Joule to work

  const themeData = getWelcomeTheme(welcomeTheme);

  // Test bridge connection
  const testBridgeConnection = useCallback(async () => {
    if (!bridgeIp.trim()) {
      setBridgeError('Please enter a bridge IP address');
      return;
    }
    
    setBridgeConnecting(true);
    setBridgeError(null);
    
    try {
      const code = pairingCode?.replace(/-/g, '').length === 8 ? pairingCode : null;
      const bridgeUrl = `http://${bridgeIp.trim()}:8080`;
      
      // Test connectivity and get bridge info (including device ID)
      const testRes = await fetch(`${bridgeUrl}/api/bridge/info`, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      if (!testRes.ok) throw new Error('Bridge not responding');
      
      // Extract device ID from bridge info
      const bridgeInfo = await testRes.json().catch(() => ({}));
      if (bridgeInfo.device_id) {
        setBridgeDeviceId(bridgeInfo.device_id);
        localStorage.setItem('bridgeDeviceId', bridgeInfo.device_id);
      }
      
      // Check if Ecobee is already paired by checking /api/status
      try {
        const statusRes = await fetch(`${bridgeUrl}/api/status`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
        if (statusRes.ok) {
          const status = await statusRes.json();
          // If we have thermostat data, Ecobee is already paired
          if (status.current_temperature !== undefined && status.target_temperature !== undefined) {
            setEcobeeAlreadyPaired(true);
            setPairedEcobeeInfo({
              currentTemp: status.current_temperature,
              targetTemp: status.target_temperature,
              mode: status.mode,
              humidity: status.humidity
            });
            // Mark as connected since Ecobee is working
            setBridgeConnected(true);
            localStorage.setItem('bridgeIp', bridgeIp.trim());
            localStorage.setItem('jouleBridgeUrl', bridgeUrl);
            setBridgeConnecting(false);
            return; // Skip the pairing flow since already paired
          }
        }
      } catch {
        // Status check failed - continue with normal pairing flow
      }
      
      // If pairing code provided, do the actual Ecobee pairing
      if (code) {
        // First discover devices to get the Ecobee device_id
        const discoverRes = await fetch(`${bridgeUrl}/api/discover`, {
          method: 'GET',
          signal: AbortSignal.timeout(15000) // Discovery can take a while
        });
        
        if (!discoverRes.ok) {
          throw new Error('Failed to discover Ecobee devices. Make sure your Ecobee is on the same network.');
        }
        
        const discovered = await discoverRes.json();
        if (!discovered.devices || discovered.devices.length === 0) {
          throw new Error('No Ecobee devices found. Make sure HomeKit is enabled on your Ecobee (Menu → Settings → Installation Settings → HomeKit).');
        }
        
        // Use the first discovered device (usually there's only one Ecobee)
        const ecobeeDevice = discovered.devices[0];
        
        // Now pair with the Ecobee
        const pairRes = await fetch(`${bridgeUrl}/api/pair`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_id: ecobeeDevice.device_id,
            pairing_code: code
          }),
          signal: AbortSignal.timeout(30000) // Pairing can take up to 30 seconds
        });
        
        if (!pairRes.ok) {
          const pairError = await pairRes.json().catch(() => ({}));
          throw new Error(pairError.error || 'Failed to pair with Ecobee. Check that the pairing code is correct and try again.');
        }
      }
      
      // Send location and forecast data to bridge settings (optional, won't fail if it doesn't work)
      try {
        const forecastData = localStorage.getItem('last_forecast_summary');
        const configPayload = {
          settings: {
            timestamp: new Date().toISOString(),
            forecast_summary: forecastData ? JSON.parse(forecastData) : null,
            location: foundLocation ? {
              city: foundLocation.city,
              state: foundLocation.state,
              latitude: foundLocation.latitude,
              longitude: foundLocation.longitude,
              elevation: locationElevation,
            } : null,
          }
        };
        
        await fetch(`${bridgeUrl}/api/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configPayload),
          signal: AbortSignal.timeout(5000)
        });
      } catch (settingsErr) {
        console.log('Settings sync skipped:', settingsErr.message);
      }
      
      // Store bridge settings
      setBridgeBase(bridgeUrl);
      localStorage.setItem('bridgeIp', bridgeIp);
      if (code) localStorage.setItem('pairingCode', code);
      
      setBridgeConnected(true);
    } catch (err) {
      // Provide helpful error messages
      let errorMessage = err.message || 'Failed to connect to bridge';
      if (errorMessage === 'Failed to fetch' || errorMessage.includes('NetworkError') || errorMessage.includes('fetch')) {
        errorMessage = `Cannot reach bridge at ${bridgeIp}:8080. Check that:\n• The bridge is powered on\n• You're on the same WiFi network\n• The IP address is correct`;
      } else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        errorMessage = `Bridge at ${bridgeIp} is not responding. It may be offline or the IP has changed.`;
      }
      setBridgeError(errorMessage);
      setBridgeConnected(false);
    } finally {
      setBridgeConnecting(false);
    }
  }, [bridgeIp, pairingCode, foundLocation, locationElevation]);

  // Search for Joule-Bridge on the network (mDNS: joule-bridge.local)
  const handleSearchBridge = useCallback(async () => {
    setSearchingBridge(true);
    setBridgeError(null);
    console.log('[Bridge Search] Starting search...');
    
    // Try mDNS first
    try {
      const url = 'http://joule-bridge.local:8080/api/bridge/info';
      console.log('[Bridge Search] Trying mDNS:', url);
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const info = await res.json();
        console.log('[Bridge Search] mDNS response:', info);
        // Prioritize lan_ip over local_ip (lan_ip is the actual local network IP, not Tailscale)
        const ip = info?.lan_ip || info?.local_ip;
        if (ip && typeof ip === 'string') {
          // Skip Tailscale IPs (10.x.x.x range used by Tailscale)
          if (!ip.startsWith('10.') && !ip.startsWith('100.')) {
            console.log('[Bridge Search] Found via mDNS:', ip);
            setBridgeIp(ip.trim());
            setSearchingBridge(false);
            return;
          } else {
            console.log('[Bridge Search] Skipping Tailscale IP:', ip);
            // If we got a Tailscale IP, try to use the actual local IP from the response
            if (info?.local_ip && !info.local_ip.startsWith('10.') && !info.local_ip.startsWith('100.')) {
              console.log('[Bridge Search] Using alternate local IP:', info.local_ip);
              setBridgeIp(info.local_ip.trim());
              setSearchingBridge(false);
              return;
            }
          }
        }
      }
    } catch (err) {
      console.log('[Bridge Search] mDNS failed:', err.message);
    }
    
    // If mDNS fails, try scanning common subnets and IPs
    try {
      // Try multiple common subnets
      const subnets = ['192.168.0', '192.168.1', '10.0.0', '10.0.1'];
      const commonLastOctets = [103, 100, 101, 102, 104, 105, 110, 150, 200];
      
      console.log('[Bridge Search] Scanning subnets:', subnets);
      
      for (const subnet of subnets) {
        for (const octet of commonLastOctets) {
          const ip = `${subnet}.${octet}`;
          const testUrl = `http://${ip}:8080/api/bridge/info`;
          
          try {
            console.log('[Bridge Search] Trying:', ip);
            const res = await fetch(testUrl, { 
              signal: AbortSignal.timeout(800),
              mode: 'cors'
            });
            
            if (res.ok) {
              const info = await res.json();
              console.log('[Bridge Search] Response from', ip, ':', info);
              
              // Verify it's actually a Joule bridge
              if (info?.device_name?.toLowerCase().includes('joule') || 
                  info?.hostname?.toLowerCase().includes('joule') ||
                  info?.lan_ip || info?.local_ip) {
                console.log('[Bridge Search] ✓ Found bridge at:', ip);
                setBridgeIp(ip);
                setSearchingBridge(false);
                return;
              }
            }
          } catch {
            // Silent continue for failed IPs
            continue;
          }
        }
      }
      
      throw new Error('Bridge not found on network');
    } catch (err) {
      console.log('[Bridge Search] Scan failed:', err.message);
      setBridgeError(
        'Joule-Bridge not found. Check your router for a device named "Joule-Bridge" or manually enter the IP address (typically 192.168.0.103).'
      );
    } finally {
      setSearchingBridge(false);
      console.log('[Bridge Search] Search complete');
    }
  }, []);

  // Auto-search for bridge when entering Bridge step (once, if no IP)
  const autoSearchedBridgeRef = React.useRef(false);
  useEffect(() => {
    if (step !== STEPS.BRIDGE) {
      autoSearchedBridgeRef.current = false;
      return;
    }
    if (bridgeIp.trim() || searchingBridge || autoSearchedBridgeRef.current) return;
    autoSearchedBridgeRef.current = true;
    handleSearchBridge();
  }, [step, bridgeIp, searchingBridge, handleSearchBridge]);

  // Auto-test and send config when bridge IP is set (no user action needed)
  useEffect(() => {
    if (step !== STEPS.BRIDGE || !bridgeIp.trim() || bridgeConnected || bridgeConnecting || bridgeError) return;
    const timer = setTimeout(() => {
      testBridgeConnection();
    }, 800); // Short delay after search finds IP
    return () => clearTimeout(timer);
  }, [step, bridgeIp, bridgeConnected, bridgeConnecting, bridgeError, testBridgeConnection]);

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
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl min-h-[80vh] overflow-y-auto p-8 md:p-12 relative dark:border dark:border-gray-700 transition-all duration-300"
        key={step}
        style={{ animation: 'fadeSlideIn 0.3s ease-out' }}
      >
        <style>{`
          @keyframes fadeSlideIn {
            from {
              opacity: 0.7;
              transform: translateX(10px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        `}</style>
        {/* Skip button - Removed: Building details are required for Ask Joule to function */}
        {/* Users must complete onboarding to ensure Ask Joule has necessary data */}

        {/* Progress indicator with step labels */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-1 mb-2">
            {STEP_LABELS.map((label, i) => (
              <div
                key={i}
                className={`flex-1 text-center text-xs font-medium transition-colors ${
                  i <= step ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-600"
                }`}
              >
                {i === step && <span className="hidden sm:inline">{label}</span>}
                {i !== step && <span className="hidden sm:inline text-[10px]">{label}</span>}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                  i < step ? "bg-green-500" : i === step ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
            ))}
          </div>
          {step > 0 && step < STEPS.CONFIRMATION && STEP_BENEFITS[step] && (
            <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2 italic">
              {STEP_BENEFITS[step]}
            </p>
          )}
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
            <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed mb-4 max-w-xl mx-auto">
              We'll guide you step by step. No rush, no jargon—just a simple path
              to understanding your energy costs.
            </p>
            
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
              <Clock size={16} />
              <span>Takes about 2 minutes</span>
            </div>

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
                  <p className="text-green-800 text-sm dark:text-green-400 flex items-center justify-center gap-2">
                    <Check size={16} className="text-green-600" />
                    Found: <strong>{foundLocation}</strong>
                    {locationElevation !== null && (
                      <span className="text-xs">({Math.round(locationElevation)} ft elevation)</span>
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
            <div className="mb-2">
              <Home size={36} className="mx-auto text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
              STEP {step + 1} OF {totalSteps}
            </p>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
              Tell us about your home
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              This helps estimate your energy usage and enables personalized answers.
            </p>
            
            {/* Validation error display */}
            {buildingError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/40 dark:border-red-700 dark:text-red-200 text-sm max-w-md mx-auto">
                {buildingError}
              </div>
            )}

            <div className="space-y-3 text-left max-w-md mx-auto">
              {/* Square Feet */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                  Home Size (sq ft)
                  {squareFeet >= 100 && squareFeet <= 20000 && (
                    <Check size={14} className="text-green-500" />
                  )}
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                  Insulation Quality
                  {insulationLevel > 0 && <Check size={14} className="text-green-500" />}
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Building Shape
                </label>
                <select
                  value={homeShape}
                  onChange={(e) => setHomeShape(Number(e.target.value))}
                  className={selectClasses}
                >
                  <option value={0.9}>Two-Story</option>
                  <option value={1.0}>Split-Level</option>
                  <option value={1.1}>Ranch</option>
                  <option value={1.15}>Manufactured</option>
                  <option value={1.2}>Cabin</option>
                </select>
                {/* Loft toggle - only show for Cabin */}
                {homeShape >= 1.2 && homeShape < 1.3 && (
                  <label className="flex items-center text-xs text-gray-700 dark:text-gray-300 cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      checked={hasLoft}
                      onChange={(e) => setHasLoft(e.target.checked)}
                      className="form-checkbox h-3 w-3 text-blue-600 rounded border-gray-300 focus:ring-blue-500 mr-1.5"
                    />
                    Has loft (reduces heat loss)
                  </label>
                )}
              </div>

              {/* Ceiling Height */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ceiling Height
                </label>
                <select
                  value={ceilingHeight}
                  onChange={(e) => setCeilingHeight(Number(e.target.value))}
                  className={selectClasses}
                >
                  <option value={8}>8 ft</option>
                  <option value={9}>9 ft</option>
                  <option value={10}>10 ft</option>
                  <option value={12}>12 ft (vaulted)</option>
                  <option value={16}>16 ft</option>
                </select>
              </div>

              {/* Primary System */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Primary Heating System
                </label>
                <select
                  value={primarySystem}
                  onChange={(e) => setPrimarySystem(e.target.value)}
                  className={selectClasses}
                >
                  <option value="heatPump">Heat Pump</option>
                  <option value="gasFurnace">Gas Furnace</option>
                  <option value="acPlusGas">Central AC + Gas Furnace</option>
                </select>
                {primarySystem === "acPlusGas" && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Cooling in summer (condenser), gas heat in winter.</p>
                )}
              </div>

              {/* Heat Pump Size (only show if heat pump is selected) */}
              {primarySystem === "heatPump" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                    Heat Pump Size
                    <span className="text-gray-400 hover:text-blue-500 cursor-help" title="Check outdoor unit label for BTU. 12k BTU = 1 ton.">
                      <HelpCircle size={12} />
                    </span>
                  </label>
                  <select
                    value={heatPumpTons}
                    onChange={(e) => setHeatPumpTons(Number(e.target.value))}
                    className={selectClasses}
                  >
                    <option value={1.5}>1.5 ton (18k)</option>
                    <option value={2.0}>2 ton (24k)</option>
                    <option value={2.5}>2.5 ton (30k)</option>
                    <option value={3.0}>3 ton (36k)</option>
                    <option value={3.5}>3.5 ton (42k)</option>
                    <option value={4.0}>4 ton (48k)</option>
                    <option value={5.0}>5 ton (60k)</option>
                  </select>
                </div>
              )}

              {(primarySystem === "gasFurnace" || primarySystem === "acPlusGas") && (
                <>
                  {primarySystem === "acPlusGas" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                        AC / Condenser Size (summer cooling)
                        <span className="text-gray-400 hover:text-blue-500 cursor-help" title="Outdoor unit cooling capacity. 12k BTU = 1 ton.">
                          <HelpCircle size={12} />
                        </span>
                      </label>
                      <select
                        value={acTons}
                        onChange={(e) => setAcTons(Number(e.target.value))}
                        className={selectClasses}
                      >
                        <option value={1.5}>1.5 ton (18k)</option>
                        <option value={2.0}>2 ton (24k)</option>
                        <option value={2.5}>2.5 ton (30k)</option>
                        <option value={3.0}>3 ton (36k)</option>
                        <option value={3.5}>3.5 ton (42k)</option>
                        <option value={4.0}>4 ton (48k)</option>
                        <option value={5.0}>5 ton (60k)</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                      Furnace Size {primarySystem === "acPlusGas" && "(winter heat)"}
                      <span className="text-gray-400 hover:text-blue-500 cursor-help" title="Heating capacity in BTU/hr. Check furnace nameplate or model.">
                        <HelpCircle size={12} />
                      </span>
                    </label>
                    <select
                      value={furnaceSizeKbtu}
                      onChange={(e) => setFurnaceSizeKbtu(Number(e.target.value))}
                      className={selectClasses}
                    >
                      {furnaceSizeOptions.map((k) => (
                        <option key={k} value={k}>{k}k BTU</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      AFUE (efficiency)
                    </label>
                    <select
                      value={afue}
                      onChange={(e) => setAfue(Number(e.target.value))}
                      className={selectClasses}
                    >
                      <option value={0.8}>80%</option>
                      <option value={0.9}>90%</option>
                      <option value={0.95}>95%</option>
                    </select>
                  </div>
                </>
              )}

              {/* Number of Thermostats/Zones */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Thermostats
                </label>
                <select
                  value={numberOfThermostats}
                  onChange={(e) => setNumberOfThermostats(Number(e.target.value))}
                  className={selectClasses}
                >
                  <option value={1}>1 (single zone)</option>
                  <option value={2}>2 (multi-zone)</option>
                  <option value={3}>3 (multi-zone)</option>
                  <option value={4}>4+ (multi-zone)</option>
                </select>
              </div>

              {/* Heat Loss Source Selection Card */}
              <div className="mt-3 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-xl border border-blue-200 dark:border-blue-800">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Heat Loss Source
                </h3>
                <div className="space-y-2">
                  {/* Calculated Option */}
                  <label className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all hover:bg-white/50 dark:hover:bg-white/5"
                    style={{ borderColor: heatLossSource === "calculated" ? "#3b82f6" : "#e5e7eb", backgroundColor: heatLossSource === "calculated" ? "rgba(59, 130, 246, 0.1)" : "transparent" }}>
                    <input type="radio" name="heatLossSource" value="calculated" checked={heatLossSource === "calculated"} onChange={(e) => setHeatLossSource(e.target.value)} />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Calculated</span>
                      <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500 text-white rounded">REC</span>
                      {heatLossSource === "calculated" && calculatedHeatLoss > 0 && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{Math.round(calculatedHeatLoss / 70)} BTU/hr/°F</span>
                      )}
                    </div>
                  </label>

                  {/* Manual Entry Option */}
                  <label className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all hover:bg-white/50 dark:hover:bg-white/5"
                    style={{ borderColor: heatLossSource === "manual" ? "#3b82f6" : "#e5e7eb", backgroundColor: heatLossSource === "manual" ? "rgba(59, 130, 246, 0.1)" : "transparent" }}>
                    <input type="radio" name="heatLossSource" value="manual" checked={heatLossSource === "manual"} onChange={(e) => setHeatLossSource(e.target.value)} />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Manual Entry</span>
                  </label>

                  {/* CSV Analyzer Option */}
                  <label className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${hasAnalyzerData ? "cursor-pointer hover:bg-white/50 dark:hover:bg-white/5" : "cursor-not-allowed opacity-50"}`}
                    style={{ borderColor: heatLossSource === "analyzer" ? "#3b82f6" : "#e5e7eb", backgroundColor: heatLossSource === "analyzer" ? "rgba(59, 130, 246, 0.1)" : "transparent" }}>
                    <input type="radio" name="heatLossSource" value="analyzer" checked={heatLossSource === "analyzer"} onChange={(e) => hasAnalyzerData && setHeatLossSource(e.target.value)} disabled={!hasAnalyzerData} />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">From CSV Analyzer</span>
                      {hasAnalyzerData ? (
                        <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">✓ {userSettings.analyzerHeatLoss?.toFixed(0)} BTU/hr/°F</span>
                      ) : (
                        <span className="ml-2 text-xs text-gray-400">No data</span>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {/* Unit System Selection */}
              <div className="mt-3 p-3 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Units</span>
                  <UnitSystemToggle />
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-center mt-4">
              <button
                onClick={() => setStep(STEPS.LOCATION)}
                className="btn btn-outline px-4 py-2"
              >
                Back
              </button>
              <button onClick={handleNext} className="btn btn-primary px-6 py-2">
                <span className="flex items-center gap-1">
                  Continue <ChevronRight size={16} />
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Cost Settings */}
        {step === STEPS.COST_SETTINGS && (() => {
          const stateElecRate = costStateName ? getStateElectricityRate(costStateName) : 0.10;
          const stateGasRate = costStateName ? getStateGasRate(costStateName) : 1.2;
          const defaultFixed = costStateAbbr && defaultFixedChargesByState[costStateAbbr]
            ? defaultFixedChargesByState[costStateAbbr].electric
            : defaultFallbackFixedCharges.electric;
          return (
            <div className="space-y-8">
              <div className="text-center mb-6">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                  STEP {STEPS.COST_SETTINGS + 1} OF {totalSteps}
                </p>
                <DollarSign size={48} className="mx-auto text-emerald-600 dark:text-emerald-400 mb-4" />
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Cost Settings
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Used for 7-day cost forecasts, annual estimates, and gas vs heat pump comparisons.
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                  These rates are used for budgeting and comparisons. They do not affect your utility bill or thermostat.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 uppercase mb-2">
                    Cost per kWh ($)
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-gray-500 dark:text-gray-400">$</span>
                    <input
                      type="number"
                      min={0.05}
                      max={1.0}
                      step={0.01}
                      value={utilityCost}
                      onChange={(e) => setUtilityCost(Math.min(1.0, Math.max(0.05, Number(e.target.value) || 0.05)))}
                      className={`${fullInputClasses} flex-1`}
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400">/kWh</span>
                  </div>
                  {costLocationDisplay && costStateName && (
                    <>
                      <button
                        type="button"
                        onClick={() => setUtilityCost(stateElecRate)}
                        className="mb-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        Use State Average
                      </button>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">
                        💡 {costLocationDisplay} average: ${stateElecRate.toFixed(2)}/kWh (EIA data)
                      </p>
                    </>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 uppercase mb-2">
                    Gas Cost per Therm ($)
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-gray-500 dark:text-gray-400">$</span>
                    <input
                      type="number"
                      min={0.5}
                      max={5.0}
                      step={0.01}
                      value={gasCost}
                      onChange={(e) => setGasCost(Math.min(5.0, Math.max(0.5, Number(e.target.value) || 0.5)))}
                      className={`${fullInputClasses} flex-1`}
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400">/therm</span>
                  </div>
                  {costLocationDisplay && costStateName && (
                    <>
                      <button
                        type="button"
                        onClick={() => setGasCost(stateGasRate)}
                        className="mb-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        Use State Average
                      </button>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">
                        💡 {costLocationDisplay} average: ~${stateGasRate.toFixed(2)}/therm (EIA data)
                      </p>
                    </>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 uppercase mb-2">
                    Fixed Monthly Charge ($)
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-gray-500 dark:text-gray-400">$</span>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      step={0.01}
                      value={fixedElectricCost}
                      onChange={(e) => setFixedElectricCost(Math.min(50, Math.max(0, Number(e.target.value) || 0)))}
                      className={`${fullInputClasses} flex-1 max-w-[140px]`}
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400">/mo</span>
                  </div>
                  {costLocationDisplay && costStateName && (
                    <>
                      <button
                        type="button"
                        onClick={() => setFixedElectricCost(defaultFixed)}
                        className="mb-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        Use State Default
                      </button>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">
                        💡 {costLocationDisplay} default: ${defaultFixed.toFixed(2)}/mo (typical service charge)
                      </p>
                    </>
                  )}
                </div>
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
                    Continue <ChevronRight size={18} />
                  </span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* Step 5: Bridge Setup (Optional) */}
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
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="192.168.1.100"
                    value={bridgeIp}
                    onChange={(e) => setBridgeIp(e.target.value)}
                    className={`${fullInputClasses} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={handleSearchBridge}
                    disabled={searchingBridge}
                    className="btn btn-outline px-4 flex items-center gap-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Search for Joule-Bridge on your network (shows as Joule-Bridge in router)"
                  >
                    {searchingBridge ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Search size={18} />
                    )}
                    Search
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Go to the IP address shown on your bridge screen, or scan the QR code on the device.</p>
              </div>

              {/* Pairing Code Input - from Ecobee (hidden if already paired) */}
              {!ecobeeAlreadyPaired ? (
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 uppercase mb-2 flex items-center gap-2">
                    <Lock size={16} /> Ecobee Pairing Code
                  </label>
                  <input
                    type="text"
                    placeholder="XXX-XX-XXX"
                    value={pairingCode}
                    onChange={(e) => {
                      let value = e.target.value.replace(/[^\d]/g, '');
                      if (value.length > 8) value = value.slice(0, 8);
                      if (value.length > 5) {
                        value = value.slice(0, 3) + '-' + value.slice(3, 5) + '-' + value.slice(5);
                      } else if (value.length > 3) {
                        value = value.slice(0, 3) + '-' + value.slice(3);
                      }
                      setPairingCode(value);
                    }}
                    className={fullInputClasses}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Enter the 8-digit code from your Ecobee (Menu → Settings → Installation Settings → HomeKit)</p>
                </div>
              ) : (
                <div className="bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-200 font-semibold">
                    <CheckCircle2 size={18} />
                    Ecobee Already Paired
                  </div>
                  {pairedEcobeeInfo && (
                    <div className="mt-2 text-sm text-green-600 dark:text-green-300 space-y-1">
                      <div>🌡️ Current: {pairedEcobeeInfo.currentTemp?.toFixed(1)}°C → Target: {pairedEcobeeInfo.targetTemp?.toFixed(1)}°C</div>
                      <div>📍 Mode: {pairedEcobeeInfo.mode || 'Unknown'}</div>
                      {pairedEcobeeInfo.humidity && <div>💧 Humidity: {pairedEcobeeInfo.humidity}%</div>}
                    </div>
                  )}
                  <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-2">Your Ecobee is connected and streaming live data.</p>
                </div>
              )}

              {/* Error Message */}
              {bridgeError && (
                <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 rounded-lg p-4 flex gap-3 text-sm text-red-700 dark:text-red-200">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <span>{bridgeError}</span>
                </div>
              )}

              {/* Connection Status */}
              {bridgeConnected && (
                <div className="bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 rounded-lg p-4 text-sm text-green-700 dark:text-green-200">
                  <div className="flex gap-3 items-start">
                    <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-semibold">Bridge connected successfully!</div>
                      {bridgeDeviceId && (
                        <div className="mt-2 text-xs font-mono bg-green-200/50 dark:bg-green-800/30 px-2 py-1 rounded inline-block">
                          Device ID: {bridgeDeviceId}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Device ID display when known but not yet connected */}
              {bridgeDeviceId && !bridgeConnected && !bridgeError && (
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-200">
                  <span className="font-medium">Device ID:</span>{' '}
                  <span className="font-mono">{bridgeDeviceId}</span>
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

            {!pairingCode?.replace(/-/g, '') && !dismissedPairingNotice && !ecobeeAlreadyPaired && (
              <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-3">
                <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold">Pairing required for streamed data</div>
                  <div className="mt-1">You can skip for now, but live Ecobee data won’t stream until a pairing code is entered.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setDismissedPairingNotice(true)}
                  className="text-amber-700 dark:text-amber-200 hover:text-amber-900 dark:hover:text-amber-100 font-medium"
                >
                  Got it
                </button>
              </div>
            )}

            <div className="flex gap-3 justify-center mt-8">
              <button
                onClick={() => setStep(STEPS.COST_SETTINGS)}
                className="btn btn-outline px-6 py-3"
              >
                Back
              </button>
              <button onClick={handleNext} className="btn btn-primary px-8 py-3">
                <span className="flex items-center gap-1">
                  {(bridgeConnected || (bridgeIp.trim() && pairingCode?.replace(/-/g, '').length >= 8)) ? 'Continue' : 'Skip & Continue'} <ChevronRight size={18} />
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Step 6: AI Integration (Optional, skippable) */}
        {step === STEPS.AI && (
          <div className="text-left">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
              STEP {step + 1} OF {totalSteps}
            </p>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
              AI Integration
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Optional — you can set this up later in Settings.
            </p>
            <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 md:p-6 max-h-[60vh] overflow-y-auto">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                How do you want to run Ask Joule?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setOnboardingAiChoice("joule");
                    setOnboardingOllamaOnThisDevice(false);
                    setOnboardingLocalUrl(JOULE_LLM_URL || "");
                    setOnboardingLocalModel("llama3:latest");
                  }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-left transition-colors ${
                    onboardingAiChoice === "joule"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                  }`}
                >
                  <Zap className="w-8 h-8 text-amber-500" />
                  <span className="font-semibold text-gray-900 dark:text-gray-100">Use Joule (free)</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400 text-center">Uses shared Joule LLM server via Cloudflare Tunnel — no setup, no credit card.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOnboardingAiChoice("groq")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-left transition-colors ${
                    onboardingAiChoice === "groq"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                  }`}
                >
                  <Cloud className="w-8 h-8 text-slate-500" />
                  <span className="font-semibold text-gray-900 dark:text-gray-100">Groq Cloud</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400 text-center">Bring your own API key for fast responses.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOnboardingAiChoice("local")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-left transition-colors ${
                    onboardingAiChoice === "local"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                  }`}
                >
                  <Cpu className="w-8 h-8 text-indigo-500" />
                  <span className="font-semibold text-gray-900 dark:text-gray-100">Your computer</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400 text-center">Run Ollama on your gaming PC — nothing leaves your network.</span>
                </button>
              </div>

              {onboardingAiChoice === "groq" && (
                <div className="mt-4 space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Groq API Key
                  </label>
                  <input
                    type="password"
                    value={onboardingGroqKey}
                    onChange={(e) => setOnboardingGroqKey(e.target.value)}
                    placeholder="gsk_..."
                    className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono"
                    aria-label="Groq API Key"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Get a free key at <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">groq.com</a> — no credit card.
                  </p>
                </div>
              )}

              {(onboardingAiChoice === "joule" || onboardingAiChoice === "local") && (
                <div className="mt-4 space-y-3">
                  {onboardingAiChoice === "joule" ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Using the shared Joule LLM server via Cloudflare Tunnel. No setup needed.
                    </p>
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Do this once: install Ollama, start it, then download a model. Where is Ollama running?
                    </p>
                  )}
                  <div className="flex flex-wrap gap-4">
                    {onboardingAiChoice === "local" && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="onboardingOllamaLocation"
                          checked={onboardingOllamaOnThisDevice}
                          onChange={() => {
                            setOnboardingOllamaOnThisDevice(true);
                            setOnboardingLocalUrl("http://localhost:11434/v1");
                          }}
                          className="rounded-full"
                        />
                        <span className="text-sm">On this device</span>
                      </label>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="onboardingOllamaLocation"
                        checked={!onboardingOllamaOnThisDevice}
                        onChange={() => {
                          setOnboardingOllamaOnThisDevice(false);
                          if (onboardingAiChoice === "local" && (onboardingLocalUrl.includes("localhost") || onboardingLocalUrl.includes("127.0.0.1"))) {
                            setOnboardingLocalUrl("http://192.168.0.108:11434/v1");
                          }
                          if (onboardingAiChoice === "joule" && JOULE_LLM_URL) {
                            setOnboardingLocalUrl(JOULE_LLM_URL);
                          }
                        }}
                        className="rounded-full"
                      />
                      <span className="text-sm">{onboardingAiChoice === "joule" ? "Joule server (Cloudflare Tunnel)" : "On another device or shared server (local IP or public URL)"}</span>
                    </label>
                  </div>
                  {!onboardingOllamaOnThisDevice && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        {onboardingAiChoice === "joule" ? "Address of the Joule LLM server" : "Address of the computer running Ollama"}
                      </label>
                      <input
                        type="url"
                        value={onboardingLocalUrl}
                        onChange={(e) => setOnboardingLocalUrl(e.target.value.trim())}
                        placeholder={onboardingAiChoice === "joule" ? "https://your-subdomain.trycloudflare.com/v1" : "http://192.168.0.108:11434/v1"}
                        className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono"
                        aria-label={onboardingAiChoice === "joule" ? "Joule LLM URL" : "Ollama base URL"}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {onboardingAiChoice === "joule"
                          ? "Set VITE_JOULE_LLM_URL when building, or enter the Cloudflare Tunnel URL (e.g. https://your-subdomain.trycloudflare.com/v1). See "
                          : "Same network: use the other computer's IP (e.g. 192.168.0.108). Add /v1 at the end. Shared server (off-network): use a public URL (ngrok/Cloudflare Tunnel). See "}
                        <Link to="/tools/shared-llm-server" className="text-blue-600 dark:text-blue-400 hover:underline">Tools → Shared LLM Server Wizard</Link>
                        {onboardingAiChoice === "joule" ? " for setup." : " for setup."}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Model to use
                    </label>
                    <input
                      type="text"
                      value={onboardingLocalModel}
                      onChange={(e) => setOnboardingLocalModel(e.target.value.trim())}
                      placeholder="llama3:latest"
                      className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                      aria-label="Ollama model"
                    />
                  </div>
                </div>
              )}

              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                🔒 All AI calls run from your browser. Groq keys stay local; local AI never leaves your machine.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Want to share your LLM with others off-network? See <Link to="/tools/shared-llm-server" className="text-blue-600 dark:text-blue-400 hover:underline">Tools → Shared LLM Server Wizard</Link> after setup.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => setStep(STEPS.BRIDGE)}
                className="btn btn-outline px-6 py-3"
              >
                Back
              </button>
              <button
                onClick={() => setStep(STEPS.CONFIRMATION)}
                className="btn btn-outline px-6 py-3"
              >
                Skip for now
              </button>
              <button onClick={handleNext} className="btn btn-primary px-8 py-3">
                Continue <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Confirmation (Required for all modes) */}
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
            <p className="text-base text-gray-600 dark:text-gray-400 mb-2">
              Here's a summary of your setup:
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Click any row to edit
            </p>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-6 text-left max-w-md mx-auto">
              <div className="space-y-1">
                <button
                  onClick={() => setStep(STEPS.LOCATION)}
                  className="w-full flex justify-between items-center py-2 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                >
                  <span className="text-gray-600 dark:text-gray-400">Location</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    {foundLocation}
                    <Edit3 size={14} className="opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                  </span>
                </button>
                <button
                  onClick={() => setStep(STEPS.BUILDING)}
                  className="w-full flex justify-between items-center py-2 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                >
                  <span className="text-gray-600 dark:text-gray-400">Home Size</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    {squareFeet.toLocaleString()} sq ft
                    <Edit3 size={14} className="opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                  </span>
                </button>
                <button
                  onClick={() => setStep(STEPS.BUILDING)}
                  className="w-full flex justify-between items-center py-2 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                >
                  <span className="text-gray-600 dark:text-gray-400">Insulation</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    {insulationLevel >= 1.2 ? "Poor" : insulationLevel >= 0.9 ? "Average" : insulationLevel >= 0.6 ? "Good" : "Excellent"}
                    <Edit3 size={14} className="opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                  </span>
                </button>
                <button
                  onClick={() => setStep(STEPS.BUILDING)}
                  className="w-full flex justify-between items-center py-2 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                >
                  <span className="text-gray-600 dark:text-gray-400">Building Shape</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    {homeShape <= 0.9 ? "Two-Story" : homeShape <= 1.0 ? "Split-Level" : homeShape <= 1.1 ? "Ranch" : homeShape <= 1.15 ? "Manufactured" : "Cabin"}
                    <Edit3 size={14} className="opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                  </span>
                </button>
                <button
                  onClick={() => setStep(STEPS.BUILDING)}
                  className="w-full flex justify-between items-center py-2 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                >
                  <span className="text-gray-600 dark:text-gray-400">Ceiling Height</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    {ceilingHeight} ft
                    <Edit3 size={14} className="opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                  </span>
                </button>
                <button
                  onClick={() => setStep(STEPS.BUILDING)}
                  className="w-full flex justify-between items-center py-2 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                >
                  <span className="text-gray-600 dark:text-gray-400">Heating System</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    {primarySystem === "heatPump" ? "Heat Pump" : primarySystem === "acPlusGas" ? "Central AC + Gas" : "Gas Furnace"}
                    <Edit3 size={14} className="opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                  </span>
                </button>
                {primarySystem === "heatPump" && (
                  <button
                    onClick={() => setStep(STEPS.BUILDING)}
                    className="w-full flex justify-between items-center py-2 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                  >
                    <span className="text-gray-600 dark:text-gray-400">Heat Pump Size</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      {heatPumpTons} tons ({Math.round(heatPumpTons * 12)}k BTU)
                      <Edit3 size={14} className="opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                    </span>
                  </button>
                )}
                {(primarySystem === "gasFurnace" || primarySystem === "acPlusGas") && (
                  <>
                    {primarySystem === "acPlusGas" && (
                      <button
                        onClick={() => setStep(STEPS.BUILDING)}
                        className="w-full flex justify-between items-center py-2 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                      >
                        <span className="text-gray-600 dark:text-gray-400">AC Size</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                          {acTons} tons ({Math.round(acTons * 12)}k BTU)
                          <Edit3 size={14} className="opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => setStep(STEPS.BUILDING)}
                      className="w-full flex justify-between items-center py-2 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                    >
                      <span className="text-gray-600 dark:text-gray-400">Furnace Size</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        {furnaceSizeKbtu}k BTU
                        <Edit3 size={14} className="opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                      </span>
                    </button>
                    <button
                      onClick={() => setStep(STEPS.BUILDING)}
                      className="w-full flex justify-between items-center py-2 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                    >
                      <span className="text-gray-600 dark:text-gray-400">AFUE</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        {(afue * 100).toFixed(0)}%
                        <Edit3 size={14} className="opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                      </span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => setStep(STEPS.BUILDING)}
                  className="w-full flex justify-between items-center py-2 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                >
                  <span className="text-gray-600 dark:text-gray-400">Thermostats/Zones</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    {numberOfThermostats} {numberOfThermostats === 1 ? "zone" : "zones"}
                    <Edit3 size={14} className="opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                  </span>
                </button>
                <button
                  onClick={() => setStep(STEPS.COST_SETTINGS)}
                  className="w-full flex justify-between items-center py-2 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                >
                  <span className="text-gray-600 dark:text-gray-400">Cost Settings</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    ${utilityCost.toFixed(2)}/kWh, ${gasCost.toFixed(2)}/therm, ${fixedElectricCost.toFixed(2)}/mo
                    <Edit3 size={14} className="opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                  </span>
                </button>
                <button
                  onClick={() => setStep(STEPS.BRIDGE)}
                  className="w-full flex justify-between items-center py-2 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                >
                  <span className="text-gray-600 dark:text-gray-400">Bridge Connection</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    {bridgeConnected ? (
                      <span className="text-green-600 dark:text-green-400">Connected</span>
                    ) : bridgeIp ? (
                      <span className="text-yellow-600 dark:text-yellow-400">Configured</span>
                    ) : (
                      <span className="text-gray-400">Not set up</span>
                    )}
                    <Edit3 size={14} className="opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                  </span>
                </button>
                <button
                  onClick={() => setStep(STEPS.AI)}
                  className="w-full flex justify-between items-center py-2 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                >
                  <span className="text-gray-600 dark:text-gray-400">AI (Ask Joule)</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    {(() => {
                      try {
                        const provider = localStorage.getItem("aiProvider") || "groq";
                        const hasKey = !!localStorage.getItem("groqApiKey")?.trim();
                        const hasLocal = !!localStorage.getItem("localAIBaseUrl")?.trim();
                        if (provider === "local" && hasLocal) return <span className="text-green-600 dark:text-green-400">Local (Ollama)</span>;
                        if (provider === "groq" && hasKey) return <span className="text-green-600 dark:text-green-400">Groq</span>;
                        return <span className="text-gray-400">Not set up</span>;
                      } catch {
                        return <span className="text-gray-400">Not set up</span>;
                      }
                    })()}
                    <Edit3 size={14} className="opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                  </span>
                </button>
                <div className="flex justify-between items-center py-2 px-2">
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
                onClick={() => setStep(STEPS.AI)}
                className="btn btn-outline px-6 py-3"
              >
                Back
              </button>
              <button onClick={handleNext} className="btn btn-primary px-8 py-3">
                <span className="flex items-center gap-1">
                  {localStorage.getItem('pairingCode') ? 'Start Monthly Forecast' : 'Start Weekly Forecast'} <Zap size={18} />
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
