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
  ChevronDown,
  ChevronUp,
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
  Upload,
  Calendar,
} from "lucide-react";
import { fullInputClasses, selectClasses } from "../lib/uiClasses";
import { US_STATES } from "../lib/usStates";
import needsCommaBetweenCityAndState from "../utils/validateLocation";
import { WELCOME_THEMES, getWelcomeTheme } from "../data/welcomeThemes";
import { setSetting, getAllSettings } from "../lib/unifiedSettingsManager";
import { calculateHeatLoss } from "../lib/heatUtils";
import { setBridgeBase } from "../lib/bridgeApi";
import { AI_PROVIDERS, warmLLM } from "../lib/aiProvider";
import { getBillMonthForComparison, parseBillDateRange, derivePeriodFromByMonth } from "../lib/bills/billParser";
import { extractBillToStorage } from "../lib/billExtractor";
import { QRCodeSVG } from "qrcode.react";

const JOULE_LLM_URL = (import.meta.env.VITE_JOULE_LLM_URL || "https://unexpected-helena-houston-develop.trycloudflare.com/v1").trim();
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
  THERMOSTAT: 3,
  COST_SETTINGS: 4,
  BILL_UPLOAD: 5,
  ANALYZING: 6,
  PAYOFF: 7,
};

// Step labels for progress bar
const STEP_LABELS = ['Welcome', 'Location', 'Building', 'Thermostat', 'Costs', 'Bill', 'Analyzing', 'Done'];

// Step benefits - what each step unlocks
const STEP_BENEFITS = {
  [STEPS.LOCATION]: 'Enables local weather data and utility rates',
  [STEPS.BUILDING]: 'Calculates your home\'s heat loss for accurate costs',
  [STEPS.THERMOSTAT]: 'Makes your cost forecasts match how you actually live',
  [STEPS.COST_SETTINGS]: 'Used for 7-day forecasts, annual estimates, and gas vs heat pump comparisons',
  [STEPS.BILL_UPLOAD]: 'Finally someone will explain this',
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
  const [numberOfThermostats] = useState(() => {
    try {
      const zones = JSON.parse(localStorage.getItem("zones") || "[]");
      return zones.length > 0 ? zones.length : 1;
    } catch {
      return 1;
    }
  });

  // Bill upload state (optional — emotional hook before payoff)
  const [billPasteText, setBillPasteText] = useState("");
  const [billAmountManual, setBillAmountManual] = useState("");
  const [billFlatFee, setBillFlatFee] = useState("");
  const [billMonth, setBillMonth] = useState(() => {
    const d = new Date();
    const last = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return last.getMonth() + 1;
  });
  const [billYear, setBillYear] = useState(() => {
    const d = new Date();
    const last = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return last.getFullYear();
  });
  const [billPdfExtracting, setBillPdfExtracting] = useState(false);
  const [billPdfError, setBillPdfError] = useState("");
  const [billExtracting, setBillExtracting] = useState(false);
  const [showBillExtractorBeta, setShowBillExtractorBeta] = useState(false);
  const billFileInputRef = React.useRef(null);

  // Thermostat state (day/night temperatures — simple, no schedule)
  const [daytimeTemp, setDaytimeTemp] = useState(userSettings.winterThermostatDay ?? 70);
  const [nightTemp, setNightTemp] = useState(userSettings.winterThermostatNight ?? 66);
  const [dropsAtNight, setDropsAtNight] = useState(true);

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
  const [heatLossSource] = useState(() => {
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

  // Auto-populate furnace, heat pump, and AC sizes from building characteristics
  useEffect(() => {
    if (!squareFeet || squareFeet < 100) return;
    const tonOptions = [1.5, 2, 2.5, 3, 3.5, 4, 5];
    if (primarySystem === "heatPump" && calculatedHeatLoss > 0) {
      const rawTons = calculatedHeatLoss / 12000;
      const nearest = tonOptions.reduce((a, b) =>
        Math.abs(a - rawTons) <= Math.abs(b - rawTons) ? a : b
      );
      setHeatPumpTons(nearest);
    }
    if ((primarySystem === "gasFurnace" || primarySystem === "acPlusGas") && calculatedHeatLoss > 0) {
      const standards = [40, 60, 80, 100, 120];
      const hlK = calculatedHeatLoss / 1000;
      const nearest = standards.reduce((a, b) =>
        Math.abs(a - hlK) <= Math.abs(b - hlK) ? a : b
      );
      setFurnaceSizeKbtu(nearest);
    }
    if (primarySystem === "acPlusGas" && squareFeet) {
      const rawAcTons = squareFeet / 500;
      const nearest = tonOptions.reduce((a, b) =>
        Math.abs(a - rawAcTons) <= Math.abs(b - rawAcTons) ? a : b
      );
      setAcTons(nearest);
    }
  }, [calculatedHeatLoss, squareFeet, primarySystem]);

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
  const totalSteps = 8; // Welcome, Location, Building, Thermostat, Cost Settings, Bill, Analyzing, Done
  
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
  // Always default to "joule" so most users get zero-config Ask Joule
  const [onboardingAiChoice, setOnboardingAiChoice] = useState("joule");
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
      // Thermostat (in case user skipped THERMOSTAT step via rerun)
      const day = daytimeTemp;
      const night = dropsAtNight ? nightTemp : daytimeTemp;
      setSetting("winterThermostatDay", day, { source: "onboarding" });
      setSetting("winterThermostatNight", night, { source: "onboarding" });
      if (setUserSetting) {
        setUserSetting("winterThermostatDay", day);
        setUserSetting("winterThermostatNight", night);
      }
      localStorage.setItem("hasCompletedOnboarding", "true");

      // Default AI to Joule (no setup required) — Bridge/AI can be configured from home
      try {
        if (!localStorage.getItem("aiProvider")) {
          localStorage.setItem("aiProvider", AI_PROVIDERS.LOCAL);
          localStorage.setItem("localAIBaseUrl", JOULE_LLM_URL || "http://localhost:11434/v1");
          localStorage.setItem("localAIModel", "llama3:latest");
          window.dispatchEvent(new Event("storage"));
        }
      } catch { /* ignore */ }
      
      // Dispatch event to notify App.jsx to refresh settings and location
      window.dispatchEvent(new CustomEvent("userSettingsUpdated", {
        detail: { key: null, value: null, updates: null } // Full refresh
      }));
      window.dispatchEvent(new Event("userLocationUpdated"));
    } catch {
      // ignore
    }
    
    // Warm local LLM in background so first bill analysis is instant (no cold-start)
    warmLLM();

    // Check if there's a redirect path stored from Mission Control
    const redirectPath = sessionStorage.getItem("onboardingRedirectPath");
    if (redirectPath) {
      sessionStorage.removeItem("onboardingRedirectPath");
      navigate(redirectPath);
    } else {
      navigate("/analysis/monthly#bill-analysis");
    }
  }, [setUserSetting, navigate, squareFeet, insulationLevel, primarySystem, heatPumpTons, furnaceSizeKbtu, afue, acTons, daytimeTemp, nightTemp, dropsAtNight, userSettings]);

  // Handle next step
  const handleNext = useCallback(async () => {
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
      setStep(STEPS.THERMOSTAT);
    } else if (step === STEPS.THERMOSTAT) {
      // Save thermostat settings (Joule uses weighted avg: 16h day + 8h night)
      const day = daytimeTemp;
      const night = dropsAtNight ? nightTemp : daytimeTemp;
      if (setUserSetting) {
        setUserSetting("winterThermostatDay", day);
        setUserSetting("winterThermostatNight", night);
      }
      setSetting("winterThermostatDay", day, { source: "onboarding" });
      setSetting("winterThermostatNight", night, { source: "onboarding" });
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
      // Activate Joule server AI before bill upload/analyzing so LLM is ready
      try {
        if (!localStorage.getItem("aiProvider")) {
          localStorage.setItem("aiProvider", AI_PROVIDERS.LOCAL);
          localStorage.setItem("localAIBaseUrl", JOULE_LLM_URL || "http://localhost:11434/v1");
          localStorage.setItem("localAIModel", "llama3:latest");
          window.dispatchEvent(new Event("storage"));
        }
      } catch { /* ignore */ }
      setStep(STEPS.BILL_UPLOAD);
    } else if (step === STEPS.BILL_UPLOAD) {
      // Extract bill during onboarding so Monthly page opens with correct dates and full data
      if (billPasteText.trim()) {
        setBillExtracting(true);
        try {
          const billMonth = getBillMonthForComparison(billPasteText.trim());
          const byMonth = await extractBillToStorage(billPasteText.trim(), billMonth.year, billMonth.month);
          // Pick target month (most days); store metadata for Monthly page
          let targetMonth = billMonth.month;
          let targetYear = billMonth.year;
          if (byMonth && Object.keys(byMonth).length > 0) {
            const entries = Object.entries(byMonth).map(([m, days]) => ({ month: parseInt(m, 10), count: Object.keys(days).length }));
            const best = entries.reduce((a, b) => (a.count >= b.count ? a : b));
            targetMonth = best.month;
            targetYear = billMonth.year;
          }
          // Use extracted data as source of truth for date range (covers Jan 27 – Feb 10 when bill spans two months)
          const dateRange = parseBillDateRange(billPasteText.trim()) || derivePeriodFromByMonth(byMonth, targetYear);
          localStorage.setItem("onboardingBillMonth", String(targetMonth));
          localStorage.setItem("onboardingBillYear", String(targetYear));
          if (dateRange) localStorage.setItem("onboardingBillDateRange", dateRange);
          localStorage.setItem("onboardingBillExtracted", "1");
        } catch (err) {
          console.warn("Bill extraction failed:", err);
          localStorage.setItem("onboardingBillPaste", billPasteText.trim());
          localStorage.setItem("onboardingBillMonth", String(billMonth));
          localStorage.setItem("onboardingBillYear", String(billYear));
          const dateRange = parseBillDateRange(billPasteText.trim());
          if (dateRange) localStorage.setItem("onboardingBillDateRange", dateRange);
          sessionStorage.setItem("onboardingBillAutoProcess", "extract");
        } finally {
          setBillExtracting(false);
        }
      } else if (billAmountManual.trim()) {
        // Manual bill amount: variable portion. Add flat fee for total. Convert variable to prorated daily kWh.
        const clean = billAmountManual.replace(/[$,]/g, "").trim();
        const amount = parseFloat(clean);
        const flatClean = billFlatFee.replace(/[$,]/g, "").trim();
        const flatFee = parseFloat(flatClean);
        const flatFeeNum = !Number.isNaN(flatFee) && flatFee >= 0 ? flatFee : 0;
        const totalBillAmount = amount + flatFeeNum;
        if (flatFeeNum > 0 && setUserSetting) {
          setUserSetting("fixedElectricCost", flatFeeNum);
        }
        if (!Number.isNaN(amount) && amount > 0 && amount < 10000) {
          const rate = utilityCost > 0 ? utilityCost : 0.10;
          const totalKwh = rate > 0 ? amount / rate : 0;
          const targetMonth = billMonth;
          const targetYear = billYear;
          const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
          const perDay = totalKwh > 0 && daysInMonth > 0 ? Math.round((totalKwh / daysInMonth) * 10) / 10 : 0;
          if (perDay > 0) {
            const byMonth = { [targetMonth]: {} };
            for (let d = 1; d <= daysInMonth; d++) {
              byMonth[targetMonth][String(d)] = perDay;
            }
            for (const [month, days] of Object.entries(byMonth)) {
              const storageKey = `actualKwh_${targetYear}_${month}`;
              const existing = JSON.parse(localStorage.getItem(storageKey) || "{}");
              const updated = { ...existing };
              for (const [day, kwh] of Object.entries(days)) {
                updated[`${month}-${day}`] = kwh;
              }
              localStorage.setItem(storageKey, JSON.stringify(updated));
            }
            const dateRange = derivePeriodFromByMonth(byMonth, targetYear);
            localStorage.setItem("onboardingBillMonth", String(targetMonth));
            localStorage.setItem("onboardingBillYear", String(targetYear));
            if (dateRange) localStorage.setItem("onboardingBillDateRange", dateRange);
            localStorage.setItem("onboardingBillExtracted", "1");
            localStorage.setItem("onboardingBillAmount", String(totalBillAmount.toFixed(2)));
            // Flag: daily values are prorated from total — not real. AI must not cite specific days.
            localStorage.setItem(`billProratedOnly_${targetYear}_${targetMonth}`, "1");
          }
        }
      }
      setStep(STEPS.ANALYZING);
    } else if (step === STEPS.PAYOFF) {
      completeOnboarding();
    }
  }, [step, foundLocation, squareFeet, insulationLevel, homeShape, hasLoft, ceilingHeight, primarySystem, heatPumpTons, furnaceSizeKbtu, afue, acTons, heatLossSource, daytimeTemp, nightTemp, dropsAtNight, utilityCost, gasCost, fixedElectricCost, setUserSetting, calculatedHeatLoss, completeOnboarding, billPasteText, billAmountManual, billFlatFee, billMonth, billYear]);

  // Extract text from PDF bill (for Bill step)
  const extractBillPdf = useCallback(async (file) => {
    if (!file?.name?.toLowerCase().endsWith(".pdf")) {
      setBillPdfError("Please select a PDF file");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setBillPdfError("File too large. Please use a PDF under 50MB.");
      return;
    }
    setBillPdfExtracting(true);
    setBillPdfError("");
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.js";
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => item.str).join(" ");
        fullText += (pageNum > 1 ? "\n" : "") + pageText;
      }
      const trimmed = fullText.trim();
      if (!trimmed || trimmed.length < 20) {
        setBillPdfError("No text found in PDF. Try pasting the bill text instead.");
        return;
      }
      setBillPasteText(trimmed);
    } catch (err) {
      setBillPdfError(err.message || "Failed to extract text from PDF.");
    } finally {
      setBillPdfExtracting(false);
      if (billFileInputRef.current) billFileInputRef.current.value = "";
    }
  }, []);

  // Warm LLM as soon as user reaches Bill step so extraction is fast when they click Continue
  useEffect(() => {
    if (step === STEPS.BILL_UPLOAD) warmLLM();
  }, [step]);

  // ANALYZING step: auto-advance after 1.5–2 seconds so it feels real
  useEffect(() => {
    if (step !== STEPS.ANALYZING) return;
    const t = setTimeout(() => setStep(STEPS.PAYOFF), 1800);
    return () => clearTimeout(t);
  }, [step]);

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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            You're all set!
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-6">
            You've already completed onboarding. Ready to launch the app?
          </p>
          <button
            onClick={() => navigate("/analysis/monthly#bill-analysis")}
            className="btn btn-primary px-8 py-3 text-xl"
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
                className={`flex-1 text-center text-lg font-medium transition-colors ${
                  i <= step ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-600"
                }`}
              >
                {i === step && <span className="hidden sm:inline">{label}</span>}
                {i !== step && <span className="hidden sm:inline text-base">{label}</span>}
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
          {step > 0 && step < STEPS.PAYOFF && STEP_BENEFITS[step] && (
            <p className="text-lg text-center text-gray-500 dark:text-gray-400 mt-2 italic">
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
            
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
              Welcome — let's figure out your bill
            </h2>
            <p className="text-xl text-gray-700 dark:text-gray-300 leading-relaxed mb-4 max-w-xl mx-auto">
              We'll guide you step by step. No rush, no jargon—just a simple path
              to understanding your energy costs.
            </p>
            
            <div className="flex items-center justify-center gap-2 text-lg text-gray-500 dark:text-gray-400 mb-4">
              <Clock size={16} />
              <span>Takes about 2 minutes</span>
            </div>

            <p className="text-lg text-gray-500 dark:text-gray-400 mb-6">
              Uses sensible defaults. You'll still confirm your home details for accurate estimates.
            </p>

            <button onClick={handleNext} className="btn btn-primary px-8 py-3 text-xl">
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
            <p className="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-2">
              STEP {step + 1} OF {totalSteps}
            </p>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
              Where do you live?
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-6">
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
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-3 mt-2">
                Format: <span className="font-semibold">City, State</span>
              </p>

              {locationError && (
                <div className="flex items-center gap-2 mt-3 mb-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/40 dark:border-red-700 dark:text-red-200">
                  <span className="text-xl font-medium">{locationError}</span>
                </div>
              )}

              {foundLocation && !locationLoading && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/30 dark:border-green-700">
                  <p className="text-green-800 text-lg dark:text-green-400 flex items-center justify-center gap-2">
                    <Check size={16} className="text-green-600" />
                    Found: <strong>{foundLocation}</strong>
                    {locationElevation !== null && (
                      <span className="text-lg">({Math.round(locationElevation)} ft elevation)</span>
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
            <p className="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-1">
              STEP {step + 1} OF {totalSteps}
            </p>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
              Tell us about your home
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-3">
              This helps estimate your energy usage and enables personalized answers.
            </p>
            
            {/* Validation error display */}
            {buildingError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/40 dark:border-red-700 dark:text-red-200 text-xl max-w-md mx-auto">
                {buildingError}
              </div>
            )}

            <div className="space-y-3 text-left max-w-md mx-auto">
              {/* Square Feet */}
              <div>
                <label className="block text-xl font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                  Home Size (sq ft)
                  {squareFeet >= 100 && squareFeet <= 20000 && (
                    <Check size={14} className="text-green-500" />
                  )}
                </label>
                <input
                  type="number"
                  value={squareFeet}
                  onChange={(e) => setSquareFeet(Number(e.target.value))}
                  className={`${fullInputClasses} text-2xl py-3`}
                  min="100"
                  max="20000"
                />
              </div>

              {/* Insulation */}
              <div>
                <label className="block text-xl font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                  Insulation Quality
                  {insulationLevel > 0 && <Check size={14} className="text-green-500" />}
                </label>
                <select
                  value={insulationLevel}
                  onChange={(e) => setInsulationLevel(Number(e.target.value))}
                  className={`${selectClasses} text-2xl py-3`}
                >
                  <option value={1.4}>Poor (pre-1980, minimal upgrades)</option>
                  <option value={1.0}>Average (1990s-2000s, code-min)</option>
                  <option value={0.65}>Good (post-2010, ENERGY STAR)</option>
                </select>
              </div>

              {/* Building Shape */}
              <div>
                <label className="block text-xl font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Building Shape
                </label>
                <select
                  value={homeShape}
                  onChange={(e) => setHomeShape(Number(e.target.value))}
                  className={`${selectClasses} text-2xl py-3`}
                >
                  <option value={0.9}>Two-Story</option>
                  <option value={1.0}>Split-Level</option>
                  <option value={1.1}>Ranch</option>
                  <option value={1.15}>Manufactured</option>
                  <option value={1.2}>Cabin</option>
                </select>
                {/* Loft toggle - only show for Cabin */}
                {homeShape >= 1.2 && homeShape < 1.3 && (
                  <label className="flex items-center gap-3 text-xl text-gray-700 dark:text-gray-300 cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      checked={hasLoft}
                      onChange={(e) => setHasLoft(e.target.checked)}
                      className="form-checkbox h-6 w-6 text-blue-600 rounded border-2 border-gray-300 focus:ring-blue-500 focus:ring-2 shrink-0"
                    />
                    Has loft (reduces heat loss)
                  </label>
                )}
              </div>

              {/* Ceiling Height */}
              <div>
                <label className="block text-xl font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ceiling Height
                </label>
                <select
                  value={ceilingHeight}
                  onChange={(e) => setCeilingHeight(Number(e.target.value))}
                  className={`${selectClasses} text-2xl py-3`}
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
                <label className="block text-xl font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Primary Heating System
                </label>
                <select
                  value={primarySystem}
                  onChange={(e) => setPrimarySystem(e.target.value)}
                  className={`${selectClasses} text-2xl py-3`}
                >
                  <option value="heatPump">Heat Pump</option>
                  <option value="gasFurnace">Gas Furnace</option>
                  <option value="acPlusGas">Central AC + Gas Furnace</option>
                </select>
                {primarySystem === "acPlusGas" && (
                  <p className="text-xl text-gray-500 dark:text-gray-400 mt-1">Cooling in summer (condenser), gas heat in winter.</p>
                )}
              </div>

              {/* Heat Pump Size (only show if heat pump is selected) */}
              {primarySystem === "heatPump" && (
                <div>
                  <label className="block text-xl font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                    Heat Pump Size (total system tonnage)
                    <span className="text-gray-400 hover:text-blue-500 cursor-help" title="Enter your total system capacity in tons. Check outdoor unit label — 12k BTU = 1 ton. Single or multi-zone: use the combined tonnage.">
                      <HelpCircle size={12} />
                    </span>
                  </label>
                  <select
                    value={heatPumpTons}
                    onChange={(e) => setHeatPumpTons(Number(e.target.value))}
                    className={`${selectClasses} text-2xl py-3`}
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

              {primarySystem === "gasFurnace" && (
                <>
                  <div>
                    <label className="block text-xl font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                      Furnace Size (total BTUs)
                      <span className="text-gray-400 hover:text-blue-500 cursor-help" title="Enter your total furnace capacity in BTU/hr. Check furnace nameplate or model. Single or multi-zone: use the combined heating output.">
                        <HelpCircle size={12} />
                      </span>
                    </label>
                    <select
                      value={furnaceSizeKbtu}
                      onChange={(e) => setFurnaceSizeKbtu(Number(e.target.value))}
                      className={`${selectClasses} text-2xl py-3`}
                    >
                      {furnaceSizeOptions.map((k) => (
                        <option key={k} value={k}>{k}k BTU</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xl font-medium text-gray-700 dark:text-gray-300 mb-1">
                      AFUE (efficiency)
                    </label>
                    <select
                      value={afue}
                      onChange={(e) => setAfue(Number(e.target.value))}
                      className={`${selectClasses} text-2xl py-3`}
                    >
                      <option value={0.8}>80%</option>
                      <option value={0.9}>90%</option>
                      <option value={0.95}>95%</option>
                    </select>
                  </div>
                </>
              )}

              {primarySystem === "acPlusGas" && (
                <div>
                  <label className="block text-xl font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                    AC / Condenser Size (total system tonnage, summer cooling)
                    <span className="text-gray-400 hover:text-blue-500 cursor-help" title="Enter your total system cooling capacity in tons. 12k BTU = 1 ton. Single or multi-zone: use combined tonnage — this must match your whole-house bill.">
                      <HelpCircle size={12} />
                    </span>
                  </label>
                  <select
                    value={acTons}
                    onChange={(e) => setAcTons(Number(e.target.value))}
                    className={`${selectClasses} text-2xl py-3`}
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

        {/* Step 3: Thermostat — simple day/night temps, no schedule */}
        {step === STEPS.THERMOSTAT && (
          <div className="text-center space-y-8">
            <p className="text-lg font-semibold text-gray-500 dark:text-gray-400">
              STEP {STEPS.THERMOSTAT + 1} OF {totalSteps}
            </p>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              About what temperature do you keep the house?
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
              This helps Joule estimate heating demand. You can change it later.
            </p>

            <div className="max-w-md mx-auto space-y-6 text-left">
              <div>
                <label className="block text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Daytime temperature
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={55}
                    max={85}
                    value={daytimeTemp}
                    onChange={(e) => setDaytimeTemp(Math.min(85, Math.max(55, Number(e.target.value) || 70)))}
                    className={`${fullInputClasses} flex-1 max-w-[140px] text-4xl py-4`}
                  />
                  <span className="text-2xl text-gray-500 dark:text-gray-400">°F</span>
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dropsAtNight}
                  onChange={(e) => setDropsAtNight(e.target.checked)}
                  className="w-6 h-6 rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-xl text-gray-700 dark:text-gray-300">It drops at night</span>
              </label>
              {dropsAtNight && (
                <p className="text-lg text-gray-500 dark:text-gray-400 -mt-2">
                  Most homes drop 3–5°F overnight.
                </p>
              )}

              {dropsAtNight && (
                <div>
                  <label className="block text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Night temperature
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={50}
                      max={80}
                      value={nightTemp}
                      onChange={(e) => setNightTemp(Math.min(80, Math.max(50, Number(e.target.value) || 66)))}
                      className={`${fullInputClasses} flex-1 max-w-[140px] text-4xl py-4`}
                    />
                    <span className="text-2xl text-gray-500 dark:text-gray-400">°F</span>
                  </div>
                </div>
              )}
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
                <p className="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-2">
                  STEP {STEPS.COST_SETTINGS + 1} OF {totalSteps}
                </p>
                <DollarSign size={48} className="mx-auto text-emerald-600 dark:text-emerald-400 mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Cost Settings
                </h2>
                <p className="text-xl text-gray-600 dark:text-gray-400">
                  Used for 7-day cost forecasts, annual estimates, and gas vs heat pump comparisons.
                </p>
                <p className="text-lg text-gray-500 dark:text-gray-400 mt-2 italic">
                  These rates are used for budgeting and comparisons. They do not affect your utility bill or thermostat.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                <div>
                  <label className="block text-xl font-bold text-gray-700 dark:text-gray-300 uppercase mb-2">
                    Cost per kWh ($)
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-4xl text-gray-500 dark:text-gray-400">$</span>
                    <input
                      type="number"
                      min={0.05}
                      max={1.0}
                      step={0.01}
                      value={utilityCost}
                      onChange={(e) => setUtilityCost(Math.min(1.0, Math.max(0.05, Number(e.target.value) || 0.05)))}
                      className={`${fullInputClasses} flex-1 text-4xl py-4`}
                    />
                    <span className="text-4xl text-gray-500 dark:text-gray-400">/kWh</span>
                  </div>
                  {costLocationDisplay && costStateName && (
                    <>
                      <button
                        type="button"
                        onClick={() => setUtilityCost(stateElecRate)}
                        className="mb-2 px-3 py-1.5 text-lg font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        Use State Average
                      </button>
                      <p className="text-lg text-blue-600 dark:text-blue-400 mt-1.5">
                        💡 {costLocationDisplay} average: ${stateElecRate.toFixed(2)}/kWh (EIA data)
                      </p>
                    </>
                  )}
                </div>

                <div>
                  <label className="block text-xl font-bold text-gray-700 dark:text-gray-300 uppercase mb-2">
                    Gas Cost per Therm ($)
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-4xl text-gray-500 dark:text-gray-400">$</span>
                    <input
                      type="number"
                      min={0.5}
                      max={5.0}
                      step={0.01}
                      value={gasCost}
                      onChange={(e) => setGasCost(Math.min(5.0, Math.max(0.5, Number(e.target.value) || 0.5)))}
                      className={`${fullInputClasses} flex-1 text-4xl py-4`}
                    />
                    <span className="text-4xl text-gray-500 dark:text-gray-400">/therm</span>
                  </div>
                  {costLocationDisplay && costStateName && (
                    <>
                      <button
                        type="button"
                        onClick={() => setGasCost(stateGasRate)}
                        className="mb-2 px-3 py-1.5 text-lg font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        Use State Average
                      </button>
                      <p className="text-lg text-blue-600 dark:text-blue-400 mt-1.5">
                        💡 {costLocationDisplay} average: ~${stateGasRate.toFixed(2)}/therm (EIA data)
                      </p>
                    </>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xl font-bold text-gray-700 dark:text-gray-300 uppercase mb-2">
                    Fixed Monthly Charge ($)
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-4xl text-gray-500 dark:text-gray-400">$</span>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      step={0.01}
                      value={fixedElectricCost}
                      onChange={(e) => setFixedElectricCost(Math.min(50, Math.max(0, Number(e.target.value) || 0)))}
                      className={`${fullInputClasses} flex-1 max-w-[140px] text-4xl py-4`}
                    />
                    <span className="text-2xl text-gray-500 dark:text-gray-400">/mo</span>
                  </div>
                  {costLocationDisplay && costStateName && (
                    <>
                      <button
                        type="button"
                        onClick={() => setFixedElectricCost(defaultFixed)}
                        className="mb-2 px-3 py-1.5 text-lg font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        Use State Default
                      </button>
                      <p className="text-lg text-blue-600 dark:text-blue-400 mt-1.5">
                        💡 {costLocationDisplay} default: ${defaultFixed.toFixed(2)}/mo (typical service charge)
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-3 justify-center mt-8">
                <button
                  onClick={() => setStep(STEPS.THERMOSTAT)}
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

        {/* Step 5: Bill Upload — emotional hook */}
        {step === STEPS.BILL_UPLOAD && (
          <div className="text-center space-y-6">
            <p className="text-lg font-semibold text-gray-500 dark:text-gray-400">
              STEP {STEPS.BILL_UPLOAD + 1} OF {totalSteps}
            </p>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Enter your last bill
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
              Finally someone will explain this.
            </p>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 text-left max-w-lg mx-auto space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Bill period</p>
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <select
                  value={billMonth}
                  onChange={(e) => setBillMonth(parseInt(e.target.value, 10))}
                  className={`${selectClasses} w-auto min-w-[140px]`}
                  aria-label="Bill month"
                >
                  {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
                <select
                  value={billYear}
                  onChange={(e) => setBillYear(parseInt(e.target.value, 10))}
                  className={`${selectClasses} w-auto min-w-[100px]`}
                  aria-label="Bill year"
                >
                  {(() => {
                    const y = new Date().getFullYear();
                    const years = [];
                    for (let i = y; i >= y - 3; i--) years.push(i);
                    return years.map((yr) => <option key={yr} value={yr}>{yr}</option>);
                  })()}
                </select>
              </div>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">Bill amount (usage)</p>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl text-gray-700 dark:text-gray-300">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={billAmountManual}
                  onChange={(e) => setBillAmountManual(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="e.g. 150"
                  className="w-28 px-3 py-2 text-lg rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Flat monthly fee (optional)</p>
              <div className="flex items-center gap-2">
                <span className="text-lg text-gray-600 dark:text-gray-400">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={billFlatFee}
                  onChange={(e) => setBillFlatFee(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder={fixedElectricCost != null ? `e.g. ${fixedElectricCost}` : "e.g. 15"}
                  className="w-24 px-3 py-2 text-base rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 border-t border-blue-200 dark:border-blue-800 mt-3">
                <button
                  type="button"
                  onClick={() => setShowBillExtractorBeta(!showBillExtractorBeta)}
                  className="flex items-center gap-2 w-full text-left text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {showBillExtractorBeta ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  Beta: Extract from bill (PDF or paste)
                </button>
                {showBillExtractorBeta && (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <input
                        ref={billFileInputRef}
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) extractBillPdf(f);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => billFileInputRef.current?.click()}
                        disabled={billPdfExtracting}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                      >
                        {billPdfExtracting ? (
                          <><Loader2 size={14} className="animate-spin" /> Extracting...</>
                        ) : (
                          <><Upload size={14} /> Upload PDF</>
                        )}
                      </button>
                      <span className="text-sm text-gray-500 dark:text-gray-400 self-center">or paste below</span>
                    </div>
                    <textarea
                      value={billPasteText}
                      onChange={(e) => { setBillPasteText(e.target.value); setBillPdfError(""); }}
                      placeholder="Paste your bill text here..."
                      className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                    />
                    {billPdfError && (
                      <p className="text-sm text-red-600 dark:text-red-400">❌ {billPdfError}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setStep(STEPS.COST_SETTINGS)}
                className="btn btn-outline px-6 py-3"
                disabled={billExtracting}
              >
                Back
              </button>
              <button onClick={handleNext} disabled={billExtracting} className="btn btn-primary px-8 py-3">
                {billExtracting ? (
                  <><Loader2 size={18} className="animate-spin" /> Extracting...</>
                ) : (
                  <>Continue <ChevronRight size={18} /></>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Analyzing — 1–2 second pause so it feels real */}
        {step === STEPS.ANALYZING && (
          <div className="text-center py-16">
            <Loader2 size={64} className="mx-auto text-blue-600 dark:text-blue-400 animate-spin mb-6" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {localStorage.getItem("onboardingBillExtracted") || localStorage.getItem("onboardingBillPaste") ? "Preparing your forecast" : "Joule is analyzing your home"}
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              {localStorage.getItem("onboardingBillExtracted") || localStorage.getItem("onboardingBillPaste") ? "Preparing your monthly forecast..." : "Comparing to similar homes in your area..."}
            </p>
          </div>
        )}

        {/* Step 7: Payoff — the "oh… now I understand" moment */}
        {step === STEPS.PAYOFF && (() => {
          const heatLossFactor = calculatedHeatLoss > 0 ? Math.round(calculatedHeatLoss / 70) : 600;
          const efficiencyPercentile = (() => {
            if (heatLossFactor < 300) return 98;
            if (heatLossFactor < 400) return 95;
            if (heatLossFactor < 500) return 90;
            if (heatLossFactor < 550) return 80;
            if (heatLossFactor < 600) return 70;
            if (heatLossFactor < 650) return 60;
            if (heatLossFactor < 700) return 50;
            if (heatLossFactor < 800) return 35;
            if (heatLossFactor < 900) return 25;
            if (heatLossFactor < 1100) return 15;
            if (heatLossFactor < 1300) return 10;
            if (heatLossFactor < 1800) return 5;
            return 2;
          })();
          const costPercentile = 100 - efficiencyPercentile;
          return (
          <div className="text-center space-y-6">
            <p className="text-lg font-semibold text-gray-500 dark:text-gray-400">
              STEP {STEPS.PAYOFF + 1} OF {totalSteps}
            </p>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Your heating cost is higher than {costPercentile}% of homes in your area.
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
              Let's find out why.
            </p>

            <div className="flex justify-center pt-4">
              <button onClick={handleNext} className="btn btn-primary px-10 py-3 text-xl">
                Find Out Why <ArrowRight size={20} />
              </button>
            </div>
          </div>
          );
        })()}
      </div>
    </div>
  );
}
