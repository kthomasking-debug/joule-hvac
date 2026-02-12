import React, { useMemo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Crown,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  Search,
  Moon,
  Sun,
  Printer,
  Activity,
  BarChart3,
  DollarSign,
  MapPin,
  Home,
} from "lucide-react";
import { routes } from "./navConfig";
import "./App.css"; // Retain any legacy specifics (can prune later)
import TermsAcceptanceModal from "./components/TermsAcceptanceModal";
import { useTermsAcceptance } from "./hooks/useTermsAcceptance";
import AnimatedSplash from "./components/AnimatedSplash";
import AskJoule from "./components/AskJoule";
import JouleFab from "./components/JouleFab";
import ModeToggle from "./components/ModeToggle";
import { ModeProvider, useMode } from "./contexts/ModeContext";
import { AIMode } from "./components/AIMode";
import { ConversationProvider } from "./contexts/ConversationContext";
import { setSetting, getAllSettings, DEFAULT_SETTINGS } from "./lib/unifiedSettingsManager";
import {
  getAnnualHDD,
  getAnnualCDD,
  calculateAnnualHeatingCostFromHDD,
  calculateAnnualCoolingCostFromCDD,
} from "./lib/hddData";
import { useSwipeNavigation } from "./hooks/useSwipeNavigation";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import SearchBar from "./components/SearchBar";
import Breadcrumbs from "./components/Breadcrumbs";
import { initStorageCleanup } from "./utils/storageCleanup";
import { addToRecentlyViewed } from "./utils/recentlyViewed";
import FeatureTour from "./components/FeatureTour";
import { SeasonProvider } from "./features/forecaster/components";
import { JouleBridgeProvider } from "./contexts/JouleBridgeContext";
import { indexMarkdownDocs } from "./utils/rag/loadMarkdownDocs";
import { shouldUseLearnedHeatLoss } from "./utils/billDataUtils";
import { warmLLM, sanitizeOllamaBaseUrl } from "./lib/aiProvider";

function AppInner() {
  // Splash screen state - skip in test mode
  const [showSplash, setShowSplash] = React.useState(() => {
    // Skip splash screen in test mode
    if (typeof window !== 'undefined' && window.__SKIP_SPLASH__) {
      return false;
    }
    return true;
  });
  // State for the "More" menu
  const [showMoreMenu, setShowMoreMenu] = React.useState(false);
  // Single Ask Joule modal state — stays open across navigation so conversation persists
  const [showAskJouleModal, setShowAskJouleModal] = useState(false);
  // State for search bar
  const [showSearch, setShowSearch] = useState(false);
  // State for collapsible Analysis submenu in sidebar
  const [analysisMenuOpen, setAnalysisMenuOpen] = useState(false);

  // Terms acceptance state - auto-accept for Reddit demo
  const { termsAccepted, markTermsAccepted, isLoaded } = useTermsAcceptance();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, setMode } = useMode();
  const queryClient = useQueryClient();
  
  // Migrate old wrong Cloudflare URL to correct default (runs on app load)
  React.useEffect(() => {
    try {
      const url = localStorage.getItem("localAIBaseUrl") || "";
      if (url.includes("tricks-actions-applied-clothing")) {
        const fixed = url.replace(/tricks-actions-applied-clothing\.trycloudflare\.com\/?v1?/, "unexpected-helena-houston-develop.trycloudflare.com/v1");
        localStorage.setItem("localAIBaseUrl", fixed);
      }
      const other = localStorage.getItem("localAIBaseUrlOtherDevice") || "";
      if (other.includes("tricks-actions-applied-clothing")) {
        const fixed = other.replace(/tricks-actions-applied-clothing\.trycloudflare\.com\/?v1?/, "unexpected-helena-houston-develop.trycloudflare.com/v1");
        localStorage.setItem("localAIBaseUrlOtherDevice", fixed);
      }
    } catch { /* ignore */ }
  }, []);

  // Pre-warm local LLM on window focus (user returns after idle — model may have unloaded)
  React.useEffect(() => {
    const handler = () => warmLLM();
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, []);

  // Auto-accept terms on mount (for Reddit demo - skip terms modal)
  React.useEffect(() => {
    if (!termsAccepted && isLoaded) {
      markTermsAccepted();
    }
  }, [termsAccepted, isLoaded, markTermsAccepted]);
  
  // Prefetch forecast data for current and next month on app mount
  React.useEffect(() => {
    const prefetchForecasts = async () => {
      try {
        const userLocation = localStorage.getItem('userLocation');
        if (!userLocation) return;
        
        const location = JSON.parse(userLocation);
        if (!location.latitude || !location.longitude) return;
        
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
        
        const { prefetchMonthlyForecast } = await import('./utils/prefetchForecast.js');
        
        // Prefetch current and next month in parallel
        // Use a separate cache key ('monthlyForecastPrefetch') so this simplified
        // 15-day prefetch doesn't override the full month data (actual + historical)
        // that useMonthlyForecast fetches with the 'monthlyForecast' key.
        await Promise.all([
          queryClient.prefetchQuery({
            queryKey: ['monthlyForecastPrefetch', location.latitude, location.longitude, currentMonth],
            queryFn: ({ signal }) => prefetchMonthlyForecast({
              lat: location.latitude,
              lon: location.longitude,
              month: currentMonth,
              signal,
            }),
            staleTime: 15 * 60 * 1000,
          }),
          queryClient.prefetchQuery({
            queryKey: ['monthlyForecastPrefetch', location.latitude, location.longitude, nextMonth],
            queryFn: ({ signal }) => prefetchMonthlyForecast({
              lat: location.latitude,
              lon: location.longitude,
              month: nextMonth,
              signal,
            }),
            staleTime: 15 * 60 * 1000,
          }),
        ]);
        
        console.log('🚀 Prefetched forecast data for months:', currentMonth, nextMonth);
      } catch (err) {
        console.warn('[App] Forecast prefetch failed:', err);
      }
    };
    
    // Wait a bit before prefetching to not slow down initial load
    const timer = setTimeout(prefetchForecasts, 2000);
    return () => clearTimeout(timer);
  }, [queryClient]);
  
  // Index markdown documentation on app load
  React.useEffect(() => {
    indexMarkdownDocs().catch(err => {
      console.warn('[App] Failed to index markdown docs:', err);
    });
  }, []);
  
  // Apply shared LLM config from URL params (e.g. from QR code for off-network users)
  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("ollamaUrl") || params.get("ollama");
    if (!raw?.trim()) return;
    try {
      const ollamaUrl = sanitizeOllamaBaseUrl(raw.trim()) || raw.trim();
      localStorage.setItem("aiProvider", "local");
      localStorage.setItem("localAIBaseUrl", ollamaUrl);
      const model = params.get("ollamaModel") || params.get("model") || "llama3:latest";
      localStorage.setItem("localAIModel", model);
      try {
        const base = localStorage.getItem("jouleBridgeUrl") || import.meta.env?.VITE_JOULE_BRIDGE_URL || (window.location?.port === "8080" ? window.location.origin : null) || "";
        if (base) {
          ["aiProvider", "localAIBaseUrl", "localAIModel"].forEach((key) => {
            fetch(`${base}/api/settings/${key}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: key === "aiProvider" ? "local" : key === "localAIBaseUrl" ? ollamaUrl.trim() : model }) }).catch(() => {});
          });
        }
      } catch { /* ignore */ }
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new CustomEvent("groqApiKeyUpdated", { detail: {} }));
      navigate(location.pathname || "/", { replace: true });
    } catch { /* ignore */ }
  }, [location.search, location.pathname, navigate]);

  // Hydrate AI config from bridge when app runs on bridge (localStorage is per-origin, so bridge origin starts empty)
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.userSettings) return;
        const s = data.userSettings;
        const keys = ["aiProvider", "localAIBaseUrl", "localAIModel", "groqApiKey", "groqModel"];
        keys.forEach((key) => {
          const v = s[key];
          if (v != null && String(v).trim() !== "") {
            try {
              localStorage.setItem(key === "groqApiKey" ? "groqApiKey" : key, String(v));
            } catch { /* ignore */ }
          }
        });
        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(new CustomEvent("groqApiKeyUpdated", { detail: { apiKey: s.groqApiKey || "" } }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Background sync: keep bridge HMI updated with forecast data every 5 minutes
  React.useEffect(() => {
    const syncToBridge = () => {
      const bridgeUrl = localStorage.getItem('jouleBridgeUrl') || import.meta.env.VITE_JOULE_BRIDGE_URL;
      if (!bridgeUrl) return;
      
      // Get cached forecast from localStorage (set by Monthly/Weekly Forecaster)
      const cached = localStorage.getItem('last_forecast_summary');
      if (!cached) return;
      
      try {
        const payload = JSON.parse(cached);
        // Only sync if we have valid cost data
        if (!payload.totalMonthlyCost && !payload.totalHPCost) return;
        
        // Update timestamp for this sync
        payload.timestamp = Date.now();
        
        fetch(`${bridgeUrl}/api/settings/last_forecast_summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: payload }),
        }).catch(() => {});
        
        if (import.meta.env.DEV) {
          console.log(`🔄 Background sync to bridge: $${(payload.totalMonthlyCost || payload.totalHPCost * 4.33).toFixed(2)}/month`);
        }
      } catch {
        // Ignore parse errors
      }
    };
    
    // Sync on app load
    const initialTimer = setTimeout(syncToBridge, 5000);
    
    // Then sync every 5 minutes
    const interval = setInterval(syncToBridge, 5 * 60 * 1000);
    
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);
  
  // Enable swipe navigation on touch devices
  useSwipeNavigation();
  
  // Preload critical routes on hover/focus
  React.useEffect(() => {
    const preloadRoute = (routePath) => {
      // Find the route component and preload it
      const route = routes.find(r => r.path === routePath);
      if (route && route.Component && route.Component._payload) {
        // Preload the lazy component
        route.Component._payload._result?.then?.();
      }
    };
    
    // Preload critical routes on mouseenter of nav links
    const handleNavHover = (e) => {
      // Check if e.target is a valid element with closest method
      if (e.target && typeof e.target.closest === 'function') {
        const link = e.target.closest('a[href]');
        if (link) {
          const href = link.getAttribute('href');
          if (href && href !== location.pathname) {
            preloadRoute(href);
          }
        }
      }
    };
    
    // Preload home and analysis routes immediately (most common)
    setTimeout(() => {
      preloadRoute('/home');
      preloadRoute('/analysis');
    }, 2000); // After initial load
    
    document.addEventListener('mouseenter', handleNavHover, true);
    return () => document.removeEventListener('mouseenter', handleNavHover, true);
  }, [location.pathname]);
  
  // Global keyboard shortcuts
  useKeyboardShortcuts({
    'ctrl+p': (e) => {
      e.preventDefault();
      window.print();
    },
    'ctrl+k': (e) => {
      e.preventDefault();
      // Open search
      setShowSearch(true);
    },
    'ctrl+shift+k': (e) => {
      e.preventDefault();
      setShowAskJouleModal(true);
    },
    'escape': () => {
      setShowAskJouleModal(false);
      setShowMoreMenu(false);
      setShowSearch(false);
    },
  }, []);

  // Use unified settings manager defaults
  const defaultSettings = useMemo(() => DEFAULT_SETTINGS, []);
  
  // Replace useLocalStorage with explicit state management for userSettings
  // Initialize from unified settings manager
  const [userSettings, setUserSettings] = React.useState(() => {
    try {
      return getAllSettings();
    } catch (_e) {
      console.warn("Failed to get settings from unified manager", _e);
      return defaultSettings;
    }
  });
  
  // Listen to unified settings manager events to sync React state
  React.useEffect(() => {
    const handleSettingsUpdate = (event) => {
      const { key, value, updates } = event.detail;
      if (updates) {
        // Batch update
        setUserSettings((prev) => ({ ...prev, ...updates }));
      } else if (key) {
        // Single update
        setUserSettings((prev) => ({ ...prev, [key]: value }));
      } else {
        // Full refresh (e.g., reset)
        setUserSettings(getAllSettings());
      }
    };
    
    window.addEventListener("userSettingsUpdated", handleSettingsUpdate);
    return () => window.removeEventListener("userSettingsUpdated", handleSettingsUpdate);
  }, []);

  // Note: userSettings persistence is now handled by unifiedSettingsManager
  // The unified manager dispatches 'userSettingsUpdated' events which sync React state

  // Ensure we always pass a merged object with defaults to child routes to avoid missing keys
  const mergedUserSettings = useMemo(
    () => ({ ...defaultSettings, ...(userSettings || {}) }),
    [userSettings, defaultSettings]
  );

  const [userLocation, setUserLocation] = useState(() => {
    try {
      const raw = localStorage.getItem("userLocation");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // Update userLocation state when userSettings changes (e.g., when location is set via UI)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("userLocation");
      const parsed = raw ? JSON.parse(raw) : null;
      setUserLocation(parsed);
    } catch {
      // ignore
    }
  }, [userSettings]);

  // Listen for location updates from onboarding
  useEffect(() => {
    const handleLocationUpdate = () => {
      try {
        const raw = localStorage.getItem("userLocation");
        const parsed = raw ? JSON.parse(raw) : null;
        setUserLocation(parsed);
        // Also trigger settings refresh to pick up elevation changes
        setUserSettings(getAllSettings());
      } catch {
        // ignore
      }
    };
    
    window.addEventListener("userLocationUpdated", handleLocationUpdate);
    return () => window.removeEventListener("userLocationUpdated", handleLocationUpdate);
  }, []);

  // Load analyzer data from localStorage (persisted from previous analyses)
  const [latestAnalysis, setLatestAnalysis] = useState(() => {
    try {
      const resultsHistory = JSON.parse(localStorage.getItem("spa_resultsHistory") || "[]");
      return resultsHistory && resultsHistory.length > 0 
        ? resultsHistory[resultsHistory.length - 1] 
        : null;
    } catch {
      return null;
    }
  });

  // Listen for analyzer data updates (when new analysis is run)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "spa_resultsHistory") {
        try {
          const resultsHistory = JSON.parse(e.newValue || "[]");
          setLatestAnalysis(
            resultsHistory && resultsHistory.length > 0 
              ? resultsHistory[resultsHistory.length - 1] 
              : null
          );
        } catch {
          setLatestAnalysis(null);
        }
      }
    };
    
    window.addEventListener("storage", handleStorageChange);
    // Also listen for same-tab updates via custom event
    const handleCustomStorageChange = () => {
      try {
        const resultsHistory = JSON.parse(localStorage.getItem("spa_resultsHistory") || "[]");
        setLatestAnalysis(
          resultsHistory && resultsHistory.length > 0 
            ? resultsHistory[resultsHistory.length - 1] 
            : null
        );
      } catch {
        setLatestAnalysis(null);
      }
    };
    
    window.addEventListener("analyzerDataUpdated", handleCustomStorageChange);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("analyzerDataUpdated", handleCustomStorageChange);
    };
  }, []);

  // Auto-enable analyzer heat loss usage ONLY on first detection (one-time setup)
  // CRITICAL: Never override user's explicit choice - if they've selected a method, respect it forever
  useEffect(() => {
    if (!latestAnalysis?.heatLossFactor) return;
    
    // Check if user has ever made an explicit choice in Settings
    // This flag is set when user clicks any radio button in the heat loss method selector
    const userHasMadeChoice = localStorage.getItem('heatLossMethodUserChoice') === 'true';
    if (userHasMadeChoice) {
      return; // User has explicitly chosen a method - never auto-select
    }
    
    // Check if user has explicitly disabled analyzer heat loss (they chose a different method)
    // If useAnalyzerHeatLoss is explicitly false, user has chosen NOT to use it - never override
    if (mergedUserSettings.useAnalyzerHeatLoss === false) {
      return; // User explicitly chose not to use analyzer data - respect that choice
    }
    
    // Only auto-enable if:
    // 1. Analyzer data exists
    // 2. User hasn't made an explicit choice
    // 3. We haven't auto-selected before (one-time only)
    if (!mergedUserSettings.useAnalyzerHeatLoss) {
      const hasAutoSelectedBefore = localStorage.getItem('heatLossMethodAutoSelected') === 'true';
      if (!hasAutoSelectedBefore) {
        setSetting("useAnalyzerHeatLoss", true);
        localStorage.setItem('heatLossMethodAutoSelected', 'true');
      }
    }
  }, [latestAnalysis?.heatLossFactor]); // Only trigger when analyzer data appears/changes, not on settings changes

  // Calculate annualEstimate - automatically uses analyzer data when available
  const annualEstimate = useMemo(() => {
    if (!userLocation) return null;

    const settings = mergedUserSettings;
    const useManualHeatLoss = Boolean(settings?.useManualHeatLoss);
    const useCalculatedHeatLoss = settings?.useCalculatedHeatLoss !== false; // Default to true
    const useAnalyzerHeatLoss = Boolean(settings?.useAnalyzerHeatLoss);
    const useLearnedHeatLoss = Boolean(settings?.useLearnedHeatLoss);
    let heatLossFactor;

    // Priority 1: Manual Entry (if enabled)
    if (useManualHeatLoss) {
      const manualHeatLossFactor = Number(settings?.manualHeatLoss);
      if (Number.isFinite(manualHeatLossFactor) && manualHeatLossFactor > 0) {
        heatLossFactor = manualHeatLossFactor;
      }
    }

    // Priority 2: Analyzer Data from CSV (if enabled and available)
    if (!heatLossFactor && useAnalyzerHeatLoss && latestAnalysis?.heatLossFactor) {
      heatLossFactor = latestAnalysis.heatLossFactor;
    }

    // Priority 3: Bill-learned heat loss (if enabled, available, and ≥30 days of bill data)
    if (!heatLossFactor && useLearnedHeatLoss && settings?.learnedHeatLoss > 0 && shouldUseLearnedHeatLoss()) {
      heatLossFactor = Number(settings.learnedHeatLoss);
    }

    // Priority 4: Calculated from Building Characteristics (DoE data)
    if (!heatLossFactor && useCalculatedHeatLoss) {
      const BASE_BTU_PER_SQFT_HEATING = 22.67;
      const ceilingMultiplier = 1 + ((settings.ceilingHeight || 8) - 8) * 0.1;
      const designHeatLoss =
        (settings.squareFeet || 1500) *
        BASE_BTU_PER_SQFT_HEATING *
        (settings.insulationLevel || 1.0) *
        (settings.homeShape || 1.0) *
        ceilingMultiplier;
      heatLossFactor = designHeatLoss / 70;
    }

    // Fallback: Use analyzer data if available (automatically use it even if not explicitly enabled)
    if (!heatLossFactor && latestAnalysis?.heatLossFactor) {
      heatLossFactor = latestAnalysis.heatLossFactor;
    }

    if (!heatLossFactor) {
      return null;
    }

    const homeElevation = settings.homeElevation ?? 0;
    const elevationMultiplierRaw = 1 + ((homeElevation || 0) / 1000) * 0.005;
    const elevationMultiplier = Math.max(
      0.8,
      Math.min(1.3, elevationMultiplierRaw)
    );

    const winterThermostat = settings.winterThermostat;
    const summerThermostat = settings.summerThermostat;

    const annualHDD = getAnnualHDD(
      `${userLocation.city}, ${userLocation.state}`,
      userLocation.state
    );
    const heatingThermostatMultiplier = (winterThermostat || 70) / 70;

    const useElectricAuxHeat = settings.useElectricAuxHeat;
    const annualHeatingCost = calculateAnnualHeatingCostFromHDD(
      annualHDD,
      heatLossFactor,
      settings.hspf2 || 9.0,
      settings.utilityCost || 0.15,
      useElectricAuxHeat
    );
    annualHeatingCost.energy *= heatingThermostatMultiplier;
    annualHeatingCost.cost *= heatingThermostatMultiplier;
    annualHeatingCost.energy *= elevationMultiplier;
    annualHeatingCost.cost *= elevationMultiplier;

    const annualCDD = getAnnualCDD(
      `${userLocation.city}, ${userLocation.state}`,
      userLocation.state
    );
    const BASE_BTU_PER_SQFT_COOLING = 28.0;
    const ceilingMultiplier = 1 + ((settings.ceilingHeight || 8) - 8) * 0.1;
    const designHeatGain =
      (settings.squareFeet || 1500) *
      BASE_BTU_PER_SQFT_COOLING *
      (settings.insulationLevel || 1.0) *
      (settings.homeShape || 1.0) *
      ceilingMultiplier *
      (settings.solarExposure || 1.0);
    const heatGainFactor = designHeatGain / 20;

    const coolingThermostatMultiplier = 74 / (summerThermostat || 74);

    const annualCoolingCost = calculateAnnualCoolingCostFromCDD(
      annualCDD,
      heatGainFactor,
      settings.efficiency || 15.0,
      settings.utilityCost || 0.15
    );
    annualCoolingCost.energy *= coolingThermostatMultiplier;
    annualCoolingCost.cost *= coolingThermostatMultiplier;
    annualCoolingCost.energy *= elevationMultiplier;
    annualCoolingCost.cost *= elevationMultiplier;

    const totalAnnualCost = annualHeatingCost.cost + annualCoolingCost.cost;

    return {
      totalCost: totalAnnualCost,
      elevationDelta: elevationMultiplier,
      homeElevation: homeElevation,
      heatingCost: annualHeatingCost.cost,
      coolingCost: annualCoolingCost.cost,
      auxKwhIncluded: annualHeatingCost.auxKwhIncluded || 0,
      auxKwhExcluded: annualHeatingCost.auxKwhExcluded || 0,
      hdd: annualHDD,
      cdd: annualCDD,
      isEstimated: !latestAnalysis?.heatLossFactor,
      method: "quick",
      winterThermostat: winterThermostat,
      summerThermostat: summerThermostat,
      heatLossFactor: heatLossFactor, // Include for AskJoule queries
    };
  }, [
    latestAnalysis,
    userLocation,
    mergedUserSettings.squareFeet,
    mergedUserSettings.insulationLevel,
    mergedUserSettings.homeShape,
    mergedUserSettings.ceilingHeight,
    mergedUserSettings.homeElevation,
    mergedUserSettings.winterThermostat,
    mergedUserSettings.summerThermostat,
    mergedUserSettings.hspf2,
    mergedUserSettings.efficiency,
    mergedUserSettings.utilityCost,
    mergedUserSettings.useElectricAuxHeat,
    mergedUserSettings.solarExposure,
    mergedUserSettings.useManualHeatLoss,
    mergedUserSettings.useCalculatedHeatLoss,
    mergedUserSettings.useAnalyzerHeatLoss,
    mergedUserSettings.useLearnedHeatLoss,
    mergedUserSettings.manualHeatLoss,
    mergedUserSettings.learnedHeatLoss,
  ]);

  // On mount, if persisted userSettings are missing keys, merge default keys and persist them back.
  React.useEffect(() => {
    try {
      const merged = { ...defaultSettings, ...(userSettings || {}) };
      if (JSON.stringify(merged) !== JSON.stringify(userSettings)) {
        setUserSettings(merged);
      }
    } catch (_e) {
      console.warn("Failed to merge default user settings", _e);
    }
    // Only run once on mount for safety
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Individual state for values not in userSettings
  const [manualTemp, setManualTemp] = React.useState(32);
  const [manualHumidity, setManualHumidity] = React.useState(65);
  const [heatLossFactor, setHeatLossFactor] = React.useState(null);
  // Dark mode persisted
  const [darkMode, setDarkMode] = React.useState(() => {
    try {
      const stored = localStorage.getItem("darkMode");
      return stored ? JSON.parse(stored) : true;
    } catch (error) {
      console.warn("Failed to read darkMode setting from localStorage", error);
      return true;
    }
  });

  const _toggleDarkMode = () => {
    setDarkMode((prevMode) => {
      const newMode = !prevMode;
      try {
        localStorage.setItem("darkMode", JSON.stringify(newMode));
      } catch (error) {
        console.warn("Failed to persist darkMode setting", error);
      }
      return newMode;
    });
  };

  // Also persist darkMode changes via useEffect
  React.useEffect(() => {
    try {
      localStorage.setItem("darkMode", JSON.stringify(darkMode));
    } catch (error) {
      console.warn("Failed to persist dark mode setting", error);
    }
  }, [darkMode]);

  // Global mute state for all speech/audio
  const [isMuted, setIsMuted] = useState(() => {
    try {
      const saved = localStorage.getItem("globalMuted");
      return saved === "true";
    } catch {
      return false;
    }
  });

  const _toggleMute = () => {
    setIsMuted((prev) => {
      const newMuted = !prev;
      try {
        localStorage.setItem("globalMuted", String(newMuted));
        // Also sync with askJouleMuted for compatibility
        localStorage.setItem("askJouleMuted", String(newMuted));
      } catch {
        // Ignore storage errors
      }
      return newMuted;
    });
  };

  // Persist mute state
  React.useEffect(() => {
    try {
      localStorage.setItem("globalMuted", String(isMuted));
      localStorage.setItem("askJouleMuted", String(isMuted));
    } catch {
      // Ignore storage errors
    }
  }, [isMuted]);

  // Restore derived values (heatLoss, tons, compressorPower) after state initializers
  const _heatLoss = useMemo(() => {
    const baseBtuPerSqFt = 22.67;
    const ceilingMultiplier = 1 + (userSettings.ceilingHeight - 8) * 0.1;
    return (
      Math.round(
        (userSettings.squareFeet *
          baseBtuPerSqFt *
          userSettings.insulationLevel *
          userSettings.homeShape *
          ceilingMultiplier) /
          1000
      ) * 1000
    );
  }, [
    userSettings.squareFeet,
    userSettings.insulationLevel,
    userSettings.homeShape,
    userSettings.ceilingHeight,
  ]);

  const capacities = {
    18: 1.5,
    24: 2.0,
    30: 2.5,
    36: 3.0,
    42: 3.5,
    48: 4.0,
    60: 5.0,
  };
  // Backwards compatibility: prefer explicit userSettings.capacity, otherwise fall back to coolingCapacity
  const tons =
    capacities[userSettings.capacity ?? userSettings.coolingCapacity];
  const _compressorPower = useMemo(
    () => tons * 1.0 * (15 / userSettings.efficiency),
    [tons, userSettings.efficiency]
  );

  // Audit log persisted to localStorage (Ask Joule commands and edits)
  const [auditLog, setAuditLog] = React.useState(() => {
    try {
      const raw = localStorage.getItem("askJouleAuditLog");
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn("Failed to parse askJouleAuditLog", e);
      return [];
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem("askJouleAuditLog", JSON.stringify(auditLog));
    } catch {
      /* ignore write errors */
    }
  }, [auditLog]);

  // Helper to push an audit entry. Includes a small unique id.
  const pushAuditLog = (entry) => {
    const now = Date.now();
    const id = `${now}-${Math.floor(Math.random() * 99999)}`;
    const item = { id, timestamp: now, ...entry };
    setAuditLog((prev) => [item, ...prev].slice(0, 250)); // Keep last 250 entries
    return item;
  };

  // Undo a change (reverts to oldValue). The caller must pass the audit entry id.
  const undoChange = (idOrWhen) => {
    const id =
      idOrWhen === "last"
        ? auditLog && auditLog.length > 0
          ? auditLog[0].id
          : null
        : idOrWhen;
    const entry = id ? auditLog.find((e) => e.id === id) : null;
    if (!entry) return false;
    // Only undo entries that are settings updates (have key and oldValue)
    if (typeof entry.key !== "undefined") {
      // Revert by writing the old value back into userSettings if the key maps to userSettings
      setUserSettings((prev) => {
        const merged = { ...prev };
        merged[entry.key] = entry.oldValue;
        return merged;
      });
      // Push an 'undo' record for traceability
      pushAuditLog({
        key: entry.key,
        oldValue: entry.newValue,
        newValue: entry.oldValue,
        source: "undo",
        comment: `Undo ${entry.id}`,
      });
      return true;
    }
    // For other types of audit entries, we don't support undo yet
    return false;
  };

  // Clear audit history
  const _clearAuditLog = () => setAuditLog([]);

  // Helper to update a single user setting
  // Accepts optional meta param: { source: 'AskJoule' | 'ui' | 'script', comment }
  // Now uses unified settings manager with validation
  const setUserSetting = (key, value, meta = {}) => {
    // Use unified settings manager with validation
    const result = setSetting(key, value, meta);
    
    if (result.success) {
      // Get previous value for audit log
      const prevValue = userSettings[key];
      
      // Only push if value changes
      if (JSON.stringify(prevValue) !== JSON.stringify(value)) {
        pushAuditLog({
          key,
          oldValue: prevValue,
          newValue: value,
          source: meta.source || "ui",
          comment: meta.comment || "",
        });
      }
      
      // Special handling for 'location' to keep localStorage userLocation in sync
      try {
        if (key === "location" && typeof value === "string") {
          const raw = localStorage.getItem("userLocation");
          const parsed = raw ? JSON.parse(raw) : {};
          parsed.city = value;
          localStorage.setItem("userLocation", JSON.stringify(parsed));
        }
      } catch {
        /* ignore */
      }
      
      // State will be updated via the event listener from unified manager
      return true;
    } else {
      // Validation failed - log error
      console.warn(`Failed to set ${key}:`, result.error);
      return false;
    }
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Onboarding is now handled via route guards - no automatic redirect here
  // Landing page shows first, then users go to /onboarding when clicking "Launch App"

  // Sync userLocation elevation with userSettings.homeElevation
  useEffect(() => {
    try {
      const raw = localStorage.getItem("userLocation");
      if (!raw) return;
      const loc = JSON.parse(raw);
      if (!loc || typeof loc !== "object") return;
      if (loc.elevation !== userSettings.homeElevation) {
        loc.elevation = userSettings.homeElevation;
        localStorage.setItem("userLocation", JSON.stringify(loc));
      }
    } catch {
      /* ignore */
    }
  }, [userSettings.homeElevation]);

  // Keep capacity and coolingCapacity keys synchronized to avoid mismatch between onboarding and settings
  useEffect(() => {
    try {
      const cap = userSettings.capacity;
      const coolCap = userSettings.coolingCapacity;
      // If they differ (or one is missing), prefer the explicitly set key and mirror it
      if (typeof cap === "number" && cap !== coolCap) {
        setUserSettings((prev) => ({ ...prev, coolingCapacity: cap }));
      } else if (typeof coolCap === "number" && coolCap !== cap) {
        setUserSettings((prev) => ({ ...prev, capacity: coolCap }));
      }
    } catch {
      // ignore
    }
  }, [userSettings.capacity, userSettings.coolingCapacity]);

  // Subscription / Pro flag (used to gate commercial features)
  const _isPro = useMemo(() => {
    try {
      const stored = localStorage.getItem("userSubscription");
      if (stored) {
        const obj = JSON.parse(stored);
        if (obj && obj.isPro) return true;
      }
    } catch {
      // ignore
    }
    return localStorage.getItem("isPro") === "true";
  }, []);

  const _isHome = location.pathname === "/" || location.pathname === "";
  // Hide the persistent/global AskJoule instance on pages that provide their own AskJoule component
  const ASK_JOULE_DISABLED_PATHS = ["/", "/cost-forecaster", "/app"];
  const shouldShowGlobalAskJoule = !ASK_JOULE_DISABLED_PATHS.includes(
    location.pathname
  );

  // Track recently viewed pages
  React.useEffect(() => {
    if (location.pathname && location.pathname !== "/" && location.pathname !== "/home") {
      // Get page title from routes
      const route = routes.find(r => r.path === location.pathname);
      if (route) {
        // Get icon component name if it's a function/component
        let iconName = null;
        if (route.icon) {
          iconName = route.icon.displayName || route.icon.name || (typeof route.icon === 'function' ? 'Icon' : null);
        }
        addToRecentlyViewed(
          location.pathname,
          route.label || route.name || "Page",
          iconName
        );
      }
    }
  }, [location.pathname]);
  // Centralized onboarding redirect: When the terms are accepted and the app has loaded,
  // redirect first-time users (those who haven't completed onboarding) to /cost-forecaster.
  // Onboarding is now handled by the landing page - users see landing page first,
  // then go to /onboarding when they click "Launch App" if not completed
  // No automatic redirect from landing page - let users explore first

  // Splash screen logic
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500); // Splash visible for 2.5s
    return () => clearTimeout(timer);
  }, []);

  // Initialize storage cleanup on app load
  useEffect(() => {
    initStorageCleanup(90); // Keep data for 90 days
  }, []);

  // Ensure scroll container can scroll to top on route changes
  useEffect(() => {
    const scrollContainer = document.querySelector('.app-scale-wrapper');
    if (scrollContainer) {
      // Ensure we can scroll to the top
      scrollContainer.scrollTop = 0;
    }
  }, [location.pathname]);

  // Onboarding requirement removed - app opens directly to /home

  if (showSplash) {
    return <AnimatedSplash />;
  }

  if (!isLoaded) {
    return null; // Or a loading spinner
  }

  // Skip terms modal for Reddit demo - auto-accept
  // if (!termsAccepted) {
  //   return <TermsAcceptanceModal onAccept={markTermsAccepted} />;
  // }

  const navLinks = routes.filter((route) => route.showInNav);
  const moreLinks = routes.filter((route) => route.showInMoreMenu);

  const handleTempChange = (e) => {
    setManualTemp(parseInt(e.target.value, 10));
  };

  const handleHumidityChange = (e) => {
    setManualHumidity(parseInt(e.target.value, 10));
  };

  return (
    <div className="app-scale-wrapper flex min-h-screen md:h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
      {/* Skip Links for Accessibility */}
      <div className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:z-50 focus-within:top-0 focus-within:left-0 focus-within:right-0">
        <a
          href="#main-content"
          className="block p-4 bg-blue-600 text-white text-center font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Skip to main content
        </a>
        <a
          href="#navigation"
          className="block p-4 bg-blue-600 text-white text-center font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Skip to navigation
        </a>
      </div>

      {/* Left Sidebar Navigation */}
      <aside id="navigation" className="hidden md:flex flex-col w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
        {/* Logo */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <NavLink to="/" className="flex items-center">
            <img 
              src="/Logo.svg" 
              alt="Joule Logo" 
              className="h-10 w-auto dark:invert transition-all" 
            />
          </NavLink>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-2">
          {navLinks && navLinks.length > 0 ? (
            <div className="space-y-1">
              {navLinks.map((route) => (
                <NavLink
                  key={route.path}
                  to={route.path}
                  onClick={() => {
                    // Switch to traditional mode when navigating from AI mode
                    if (mode === "ai") {
                      setMode("traditional");
                    }
                  }}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`
                  }
                >
                  {route.icon && React.createElement(route.icon, {
                    className: "w-5 h-5 flex-shrink-0",
                    "aria-hidden": true,
                  })}
                  <span>{route.name}</span>
                </NavLink>
              ))}
              
              {/* Collapsible Analysis Section */}
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setAnalysisMenuOpen(!analysisMenuOpen)}
                  className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-5 h-5 flex-shrink-0" />
                    <span>Analysis</span>
                  </div>
                  {analysisMenuOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                
                {analysisMenuOpen && (
                  <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 dark:border-gray-600 pl-3">
                    <NavLink
                      to="/analysis/energy-flow"
                      onClick={() => mode === "ai" && setMode("traditional")}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`
                      }
                    >
                      <Activity className="w-4 h-4 flex-shrink-0" />
                      <span>Performance</span>
                    </NavLink>
                    <NavLink
                      to="/analysis/analyzer"
                      onClick={() => mode === "ai" && setMode("traditional")}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`
                      }
                    >
                      <BarChart3 className="w-4 h-4 flex-shrink-0" />
                      <span>Analyze System</span>
                    </NavLink>
                    <NavLink
                      to="/tools/heat-pump-vs-gas-furnace"
                      onClick={() => mode === "ai" && setMode("traditional")}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`
                      }
                    >
                      <DollarSign className="w-4 h-4 flex-shrink-0" />
                      <span>System Costs</span>
                    </NavLink>
                    <NavLink
                      to="/tools/city-cost-comparison"
                      onClick={() => mode === "ai" && setMode("traditional")}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`
                      }
                    >
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span>Location Costs</span>
                    </NavLink>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-500 p-3">Loading menu...</div>
          )}
        </nav>

        {/* Bottom Actions - Legal Links */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            <NavLink to="/privacy" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Privacy</NavLink>
            <NavLink to="/terms" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Terms</NavLink>
            <NavLink to="/refund-policy" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Refunds</NavLink>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">© 2026 Joule Bridge</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Main Content */}
        <main id="main-content" className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4" tabIndex={-1}>
        {mode === "ai" ? (
          <AIMode />
        ) : (
          <>
            {/* Mobile: prominent Home link so it's always visible on small screens */}
            {(location.pathname !== "/" && location.pathname !== "/home") && (
              <div className="md:hidden mb-2 -mt-1 -mx-1">
                <NavLink
                  to="/home"
                  className="flex items-center gap-2 text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 py-2 px-2 rounded-lg touch-manipulation min-h-[44px]"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                  aria-label="Back to Home"
                >
                  <Home className="w-5 h-5 shrink-0" aria-hidden />
                  <span className="text-sm font-medium">Home</span>
                </NavLink>
              </div>
            )}
            <Breadcrumbs />
            <Outlet
              context={{
                userSettings: mergedUserSettings,
                setUserSettings,
                setUserSetting,
                manualTemp,
                handleTempChange,
                manualHumidity,
                handleHumidityChange,
                heatLossFactor,
                setHeatLossFactor,
                analyzerHeatLossSource: latestAnalysis?.heatLossSource || null,
                onOpenAskJoule: () => setShowAskJouleModal(true),
              }}
            />
          </>
        )}
        </main>
      </div>

      {/* Floating Action Button for Ask Joule - hidden when global launcher is shown or on checkout page */}
      {!shouldShowGlobalAskJoule && location.pathname !== "/" && (
        <JouleFab onClick={() => setShowAskJouleModal(true)} />
      )}

      {/* Search Bar */}
      {showSearch && (
        <SearchBar onClose={() => setShowSearch(false)} />
      )}

      {/* Bottom Navigation for Mobile */}
      {navLinks && navLinks.length > 0 && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-around z-30 pb-safe" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
          {navLinks.slice(0, 4).map((route) => (
            <NavLink
              key={route.path}
              to={route.path}
              onClick={() => {
                // Switch to traditional mode when navigating from AI mode
                if (mode === "ai") {
                  setMode("traditional");
                }
              }}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center text-center p-2 ${
                  isActive
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-600 dark:text-gray-400"
                }`
              }
            >
              {route.icon
                ? React.createElement(route.icon, {
                    className: "h-5 w-5",
                    "aria-hidden": true,
                  })
                : null}
              <span className="text-xs mt-1">{route.name}</span>
            </NavLink>
          ))}
          {moreLinks && moreLinks.length > 0 && (
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="flex flex-col items-center justify-center text-center p-2 text-gray-600 dark:text-gray-400"
            >
              {showMoreMenu ? <ChevronDown /> : <ChevronUp />}
              <span className="text-xs mt-1">More</span>
            </button>
          )}
        </nav>
      )}

      {/* More Menu Modal */}
      {showMoreMenu && moreLinks && moreLinks.length > 0 && (
        <div className="md:hidden fixed bottom-16 left-0 right-0 bg-white dark:bg-gray-800 p-4 z-20 shadow-lg rounded-t-lg">
          <div className="grid grid-cols-4 gap-4">
            {moreLinks.map((route) => (
              <NavLink
                key={route.path}
                to={route.path}
                onClick={() => {
                  setShowMoreMenu(false);
                  // Switch to traditional mode when navigating from AI mode
                  if (mode === "ai") {
                    setMode("traditional");
                  }
                }}
                className="flex flex-col items-center text-gray-700 dark:text-gray-300"
              >
                {route.icon
                  ? React.createElement(route.icon, {
                      className: "h-5 w-5 mb-1",
                      "aria-hidden": true,
                    })
                  : null}
                <span className="text-xs mt-1 text-center">{route.name}</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {/* Animated Splash Screen */}
      {showSplash && <AnimatedSplash onComplete={() => setShowSplash(false)} />}

      {/* Feature Tour - overlays on top of everything */}
      <FeatureTour />

      {/* Floating Ask Joule Launcher - only in Traditional Mode */}
      {shouldShowGlobalAskJoule && mode === "traditional" && (
        <button
          data-testid="ask-joule-fab"
          aria-label="Open Ask Joule"
          title="Ask Joule"
          className={`fixed right-4 z-50 inline-flex items-center justify-center rounded-full shadow-2xl bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all bottom-20 md:bottom-6 md:right-6 ${
            location.pathname === "/upgrades"
              ? "px-6 py-4 w-20 h-20 text-base font-bold"
              : "w-12 h-12"
          }`}
          onClick={() => setShowAskJouleModal(true)}
        >
          {location.pathname === "/upgrades" ? (
            <span className="text-base font-bold">chat</span>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" fill="currentColor" />
            </svg>
          )}
        </button>
      )}

      {/* Single Ask Joule modal — portaled to body, stays open across navigation so conversation is not cleared */}
      {showAskJouleModal && createPortal(
        <div
          aria-modal="true"
          role="dialog"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        >
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setShowAskJouleModal(false)}
          />
          <div className="relative z-10 w-full max-w-[95vw] sm:max-w-6xl max-h-[90vh] flex flex-col overflow-hidden bg-white dark:bg-gray-900 rounded-xl shadow-xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Ask Joule
              </h2>
              <button
                aria-label="Close"
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900"
                onClick={() => setShowAskJouleModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <AskJoule
                isModal={true}
                hasLocation={!!userLocation}
                userLocation={userLocation}
                userSettings={mergedUserSettings}
                annualEstimate={annualEstimate}
                recommendations={[]}
                onNavigate={(path) => navigate(path)}
                onSettingChange={(key, value, meta) =>
                  setUserSetting(key, value, meta)
                }
                auditLog={auditLog}
                onUndo={(id) => undoChange(id)}
                pushAuditLog={pushAuditLog}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Wrap AppInner with providers
const App = () => (
  <ConversationProvider>
    <ModeProvider>
      <SeasonProvider>
        <JouleBridgeProvider pollInterval={5000}>
          <AppInner />
        </JouleBridgeProvider>
      </SeasonProvider>
    </ModeProvider>
  </ConversationProvider>
);

export default App;
