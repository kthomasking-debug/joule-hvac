import React, { useMemo, useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
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
  // State for Ask Joule modal
  const [isJouleModalOpen, setIsJouleModalOpen] = useState(false);
  // State for search bar
  const [showSearch, setShowSearch] = useState(false);

  // Terms acceptance state - auto-accept for Reddit demo
  const { termsAccepted, markTermsAccepted, isLoaded } = useTermsAcceptance();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, setMode } = useMode();
  
  // Auto-accept terms on mount (for Reddit demo - skip terms modal)
  React.useEffect(() => {
    if (!termsAccepted && isLoaded) {
      markTermsAccepted();
    }
  }, [termsAccepted, isLoaded, markTermsAccepted]);
  
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
      // Open Ask Joule if available
      if (setIsJouleModalOpen) {
        setIsJouleModalOpen(true);
      }
    },
    'escape': () => {
      // Close modals
      setIsJouleModalOpen(false);
      setShowMoreMenu(false);
      setShowSearch(false);
    },
  }, [setIsJouleModalOpen]);

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
    } catch (_e) {
      return null;
    }
  });

  // Update userLocation state when userSettings changes (e.g., when location is set via UI)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("userLocation");
      const parsed = raw ? JSON.parse(raw) : null;
      setUserLocation(parsed);
    } catch (_e) {
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
      } catch (_e) {
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

    // Priority 3: Calculated from Building Characteristics (DoE data)
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
    mergedUserSettings.manualHeatLoss,
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

  const toggleDarkMode = () => {
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

  const toggleMute = () => {
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
  const heatLoss = useMemo(() => {
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
  const compressorPower = useMemo(
    () => tons * 1.0 * (15 / userSettings.efficiency),
    [tons, userSettings.efficiency]
  );

  // Audit log persisted to localStorage (Ask Joule commands and edits)
  const [auditLog, setAuditLog] = React.useState(() => {
    try {
      const raw = localStorage.getItem("askJouleAuditLog");
      return raw ? JSON.parse(raw) : [];
    } catch (_e) {
      console.warn("Failed to parse askJouleAuditLog", _e);
      return [];
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem("askJouleAuditLog", JSON.stringify(auditLog));
    } catch (_e) {
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
  const clearAuditLog = () => setAuditLog([]);

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
      } catch (err) {
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
  const isPro = useMemo(() => {
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

  const isHome = location.pathname === "/" || location.pathname === "";
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
  const [showAskModal, setShowAskModal] = React.useState(false);

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

  // Check if onboarding is completed and redirect if not
  // MUST be called before any early returns to follow Rules of Hooks
  React.useEffect(() => {
    if (termsAccepted && isLoaded) {
      try {
        const hasCompletedOnboarding = localStorage.getItem("hasCompletedOnboarding") === "true";
        // Only redirect if we're not already on onboarding or landing page
        if (!hasCompletedOnboarding && 
            location.pathname !== "/onboarding" && 
            location.pathname !== "/" &&
            !location.pathname.startsWith("/legal")) {
          navigate("/onboarding");
        }
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [termsAccepted, isLoaded, location.pathname, navigate]);

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
    <div className="app-scale-wrapper flex flex-col h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
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

      {/* Header */}
      <header id="navigation" className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <NavLink to="/" className="flex items-center">
            <img 
              src="/Logo.svg" 
              alt="Joule Logo" 
              className="h-12 w-auto dark:invert transition-all" 
            />
          </NavLink>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden sm:flex items-center space-x-1">
          {navLinks && navLinks.length > 0 ? (
            navLinks.map((route) => (
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
                  `px-3 py-2 rounded-md text-sm font-medium ${
                    isActive
                      ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`
                }
              >
                {route.name}
              </NavLink>
            ))
          ) : (
            <div className="text-xs text-gray-500">Loading menu...</div>
          )}
        </nav>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowSearch(true)}
            className="p-2 rounded-full hover:bg-[#1D232C] transition-colors"
            aria-label="Search (Ctrl+K)"
            title="Search (Ctrl+K)"
          >
            <Search size={20} className="text-[#A7B0BA]" />
          </button>
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full hover:bg-[#1D232C] transition-colors"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun size={20} className="text-[#A7B0BA]" /> : <Moon size={20} className="text-[#A7B0BA]" />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="flex-1 overflow-y-auto p-4" tabIndex={-1}>
        {mode === "ai" ? (
          <AIMode />
        ) : (
          <>
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
              }}
            />
          </>
        )}
      </main>

      {/* Floating Action Button for Ask Joule - hidden when global button is shown or on checkout page */}
      {!shouldShowGlobalAskJoule && location.pathname !== "/" && (
        <JouleFab onClick={() => setIsJouleModalOpen(true)} />
      )}

      {/* Search Bar */}
      {showSearch && (
        <SearchBar onClose={() => setShowSearch(false)} />
      )}

      {/* Ask Joule Modal */}
      {isJouleModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center"
          onClick={() => setIsJouleModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-4xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <AskJoule
              userSettings={mergedUserSettings}
              userLocation={userLocation}
              annualEstimate={annualEstimate}
              recommendations={[]}
              isModal={true}
              onClose={() => setIsJouleModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Bottom Navigation for Mobile */}
      {navLinks && navLinks.length > 0 && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-around z-30">
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
        <>
          <button
            data-testid="ask-joule-fab"
            aria-label="Open Ask Joule"
            title="Ask Joule"
            className={`fixed bottom-6 right-6 z-50 inline-flex items-center justify-center rounded-full shadow-2xl bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all ${
              location.pathname === "/upgrades"
                ? "px-6 py-4 w-20 h-20 text-base font-bold"
                : "w-12 h-12"
            }`}
            onClick={() => setShowAskModal(true)}
          >
            {location.pathname === "/upgrades" ? (
              <span className="text-base font-bold">chat</span>
            ) : (
              /* Icon - use lightning or chat */
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
          {showAskModal && (
            <div
              aria-modal="true"
              role="dialog"
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            >
              <div
                className="fixed inset-0 bg-black/50"
                onClick={() => setShowAskModal(false)}
              />
              <div className="relative z-10 w-full max-w-4xl bg-white dark:bg-gray-900 rounded-xl shadow-xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Ask Joule
                  </h2>
                  <button
                    aria-label="Close"
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900"
                    onClick={() => setShowAskModal(false)}
                  >
                    ✕
                  </button>
                </div>
                <AskJoule
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
          )}
        </>
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
