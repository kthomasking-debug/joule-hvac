import React, { useMemo, useState, useEffect, useRef } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Home,
  Calendar,
  TrendingUp,
  Activity,
  Zap,
  BarChart3,
  Info,
  X,
  Lightbulb,
  Settings as SettingsIcon,
  CheckCircle2,
  Flame,
  Snowflake,
  Fan,
  Circle,
  Cpu,
  Sparkles,
  AlertCircle,
  Clock,
  XCircle,
  ChevronRight,
  Wifi,
  ArrowRight,
  AlertTriangle,
  ThermometerSun,
  DollarSign,
  MapPin,
  UserPlus,
  Cloud,
  KeyRound,
  RefreshCw,
} from "lucide-react";
import AskJoule from "../components/AskJoule";
import HomeTopSection from "../components/HomeTopSection";
import DemoModeBanner from "../components/DemoModeBanner";
import SystemHealthAlerts from "../components/SystemHealthAlerts";
import SavingsDashboard from "../components/SavingsDashboard";
import { useDemoMode } from "../hooks/useDemoMode";
import { useJouleBridgeContext } from "../contexts/JouleBridgeContext";
import { QuickActionsBar, OneClickOptimizer, SavingsTracker, SystemHealthCard, WasteDetector } from "../components/optimization";
import AutoSettingsMathEquations from "../components/AutoSettingsMathEquations";
import { EBAY_STORE_URL } from "../utils/rag/salesFAQ";
import {
  getAnnualHDD,
  getAnnualCDD,
  calculateAnnualHeatingCostFromHDD,
  calculateAnnualCoolingCostFromCDD,
} from "../lib/hddData";
import { calculateBalancePoint } from "../utils/balancePointCalculator";
import computeAnnualPrecisionEstimate from "../lib/fullPrecisionEstimate";
import { getRecentlyViewed, removeFromRecentlyViewed } from "../utils/recentlyViewed";
import { getAllSettings } from "../lib/unifiedSettingsManager";
import * as heatUtils from "../lib/heatUtils";
import { routes } from "../navConfig";
import { getCached, getCachedBatch } from "../utils/cachedStorage";
import { shouldUseLearnedHeatLoss } from "../utils/billDataUtils";
import { warmLLM } from "../lib/aiProvider";

const currency = (v) => `$${(v ?? 0).toFixed(2)}`;

const APP_CLOUD_SYNC_ENDPOINT = "/.netlify/functions/wellness-sync";
const APP_CLOUD_SYNC_ENABLED_KEY = "appCloudSyncEnabledV1";
const APP_CLOUD_SYNC_SECRET_KEY = "appCloudSyncSecretV1";
const LEGACY_WELLNESS_CLOUD_SYNC_ENABLED_KEY = "wellnessCloudSyncEnabledV1";
const LEGACY_WELLNESS_CLOUD_SYNC_SECRET_KEY = "wellnessCloudSyncSecretV1";
const APP_CLOUD_SYNC_VERSION = 1;
const WELLNESS_GLOBAL_USER_NAME_KEY = "wellnessGlobalUserName";
const WELLNESS_USER_CHANGED_EVENT = "wellness-user-changed";
const WELLNESS_SAVED_USERS_KEY = "wellnessSavedUsersV1";
const PROFILE_STORAGE_KEY = "caffeineTrackerProfilesV1";
const ACTIVE_PROFILE_ID_STORAGE_KEY = "caffeineTrackerActiveProfileId";
const CALORIE_PROFILES_STORAGE_KEY = "dailyCalorieProfilesV1";
const CALORIE_ACTIVE_PROFILE_STORAGE_KEY = "dailyCalorieActiveProfileId";
const TRACKER_USER_STORAGE_KEYS = [
  "clonazepamTrackerByUserV1",
  "vilazodoneTrackerByUserV1",
  "lamotrigineTrackerByUserV1",
  "doxylamineTrackerByUserV1",
  "trazodoneTrackerByUserV1",
  "levothyroxineTrackerByUserV1",
];
const DASHBOARD_WELLNESS_PANEL_OPEN_KEY = "dashboardWellnessPanelOpenV1";
const DASHBOARD_CLOUD_SYNC_PANEL_OPEN_KEY = "dashboardCloudSyncPanelOpenV1";
const DASHBOARD_WELLNESS_SAVED_DATA_PANEL_OPEN_KEY = "dashboardWellnessSavedDataPanelOpenV1";

function createCloudSyncSecret() {
  try {
    if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
      return `${globalThis.crypto.randomUUID()}${globalThis.crypto.randomUUID()}`.replace(/-/g, "");
    }
  } catch {
    // Fallback below.
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function buildAppCloudSnapshot() {
  const storage = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (
      key === APP_CLOUD_SYNC_ENABLED_KEY
      || key === APP_CLOUD_SYNC_SECRET_KEY
      || key === LEGACY_WELLNESS_CLOUD_SYNC_ENABLED_KEY
      || key === LEGACY_WELLNESS_CLOUD_SYNC_SECRET_KEY
    ) {
      continue;
    }
    storage[key] = localStorage.getItem(key);
  }

  return {
    type: "joule-app-cloud-export",
    version: APP_CLOUD_SYNC_VERSION,
    exportedAt: new Date().toISOString(),
    storage,
  };
}

function hasMeaningfulAppData(snapshot) {
  return Boolean(snapshot && snapshot.storage && Object.keys(snapshot.storage).length > 0);
}

async function pullAppCloudSnapshot(syncKey) {
  const response = await fetch(APP_CLOUD_SYNC_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "pull", syncKey }),
  });

  if (response.status === 404) {
    return { found: false, payload: null };
  }

  const rawText = await response.text();
  const body = rawText ? (() => {
    try {
      return JSON.parse(rawText);
    } catch {
      return null;
    }
  })() : null;
  if (!response.ok) {
    throw new Error(body?.error || rawText || "Could not restore cloud data.");
  }

  if (!body || typeof body !== "object") {
    throw new Error("Cloud response was empty or invalid.");
  }

  return body;
}

async function pushAppCloudSnapshot(syncKey, payload) {
  const response = await fetch(APP_CLOUD_SYNC_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "push", syncKey, payload }),
  });

  const rawText = await response.text();
  const body = rawText ? (() => {
    try {
      return JSON.parse(rawText);
    } catch {
      return null;
    }
  })() : null;
  if (!response.ok) {
    throw new Error(body?.error || rawText || "Could not sync cloud data.");
  }

  return body || { ok: true };
}

function applyAppCloudSnapshot(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Cloud payload is not valid.");
  }

  if (payload.type !== "joule-app-cloud-export" || !payload.storage || typeof payload.storage !== "object") {
    throw new Error("Cloud payload is not an app-wide export.");
  }

  let restored = 0;
  Object.entries(payload.storage).forEach(([key, value]) => {
    if (
      key === APP_CLOUD_SYNC_ENABLED_KEY
      || key === APP_CLOUD_SYNC_SECRET_KEY
      || key === LEGACY_WELLNESS_CLOUD_SYNC_ENABLED_KEY
      || key === LEGACY_WELLNESS_CLOUD_SYNC_SECRET_KEY
    ) {
      return;
    }
    localStorage.setItem(key, String(value ?? ""));
    restored += 1;
  });

  window.dispatchEvent(new Event("storage"));
  window.dispatchEvent(new CustomEvent("groqApiKeyUpdated", { detail: { apiKey: localStorage.getItem("groqApiKey") || "" } }));

  return restored;
}

function sanitizeUserName(value) {
  return String(value || "").trim();
}

function safeParseJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function loadSavedUsers() {
  const users = safeParseJson(WELLNESS_SAVED_USERS_KEY, []);
  return Array.isArray(users) ? users.map(sanitizeUserName).filter(Boolean) : [];
}

function findUserProfile(profiles, activeId, userName) {
  if (!Array.isArray(profiles)) return null;
  const normalizedName = sanitizeUserName(userName);
  if (normalizedName) {
    const byName = profiles.find((profile) => sanitizeUserName(profile?.name) === normalizedName);
    if (byName) return byName;
  }
  if (activeId) {
    const byId = profiles.find((profile) => profile?.id === activeId);
    if (byId) return byId;
  }
  return profiles[0] || null;
}

function buildUserSavedDataSnapshot(userName) {
  const caffeineProfiles = safeParseJson(PROFILE_STORAGE_KEY, []);
  const calorieProfiles = safeParseJson(CALORIE_PROFILES_STORAGE_KEY, []);
  const activeCaffeineProfileId = localStorage.getItem(ACTIVE_PROFILE_ID_STORAGE_KEY) || "";
  const activeCalorieProfileId = localStorage.getItem(CALORIE_ACTIVE_PROFILE_STORAGE_KEY) || "";

  const caffeineProfile = findUserProfile(caffeineProfiles, activeCaffeineProfileId, userName);
  const calorieProfile = findUserProfile(calorieProfiles, activeCalorieProfileId, userName);

  const userProfileIds = [
    caffeineProfile?.id,
    calorieProfile?.id,
    activeCaffeineProfileId,
    activeCalorieProfileId,
  ].filter(Boolean);

  const medicationTrackersByUserState = TRACKER_USER_STORAGE_KEYS.reduce((acc, storageKey) => {
    const byUser = safeParseJson(storageKey, {});
    let state = null;

    for (const profileId of userProfileIds) {
      if (byUser && typeof byUser === "object" && byUser[profileId]) {
        state = byUser[profileId];
        break;
      }
    }

    if (!state && byUser && typeof byUser === "object") {
      state = Object.values(byUser)[0] || null;
    }

    acc[storageKey] = state;
    return acc;
  }, {});

  return {
    userName: sanitizeUserName(userName),
    profileLinks: {
      caffeineProfileId: caffeineProfile?.id || null,
      calorieProfileId: calorieProfile?.id || null,
    },
    caffeineTracker: caffeineProfile,
    dailyCalorieIntake: calorieProfile,
    medicationTrackersByUserState,
  };
}

// Stable empty object for outlet context fallback to prevent unnecessary re-renders
const EMPTY_OUTLET = {};

const HomeDashboard = () => {
  // Mouse position for glassmorphic glow effect
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const toolsSectionRef = useRef(null);

  const hasCompletedOnboarding = localStorage.getItem("hasCompletedOnboarding") === "true";

  // Warm local LLM on Home load so bill analysis is instant (no cold-start latency)
  useEffect(() => {
    warmLLM();
  }, []);

  // Handle clicks on main feature buttons - require onboarding first
  const handleFeatureClick = (targetPath, event) => {
    event.preventDefault();
    try {
      const userLocation = localStorage.getItem("userLocation");
      const settings = getAllSettings?.();
      
      // Check if user has truly completed onboarding with required data
      const hasValidOnboarding = hasCompletedOnboarding && 
        userLocation && 
        JSON.parse(userLocation)?.city && 
        JSON.parse(userLocation)?.state &&
        settings?.squareFeet && 
        settings?.squareFeet > 0;
      
      if (!hasValidOnboarding) {
        // Store the target path so onboarding can redirect after completion
        sessionStorage.setItem("onboardingRedirectPath", targetPath);
        navigate("/onboarding?rerun=true");
      } else {
        navigate(targetPath);
      }
    } catch (error) {
      // If there's any error checking onboarding, require it
      sessionStorage.setItem("onboardingRedirectPath", targetPath);
      navigate("/onboarding?rerun=true");
    }
  };

  // Track mouse position for glassmorphic glow (relative to tools section)
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (toolsSectionRef.current) {
        const rect = toolsSectionRef.current.getBoundingClientRect();
        setMousePosition({ 
          x: e.clientX - rect.left, 
          y: e.clientY - rect.top 
        });
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Optimized: Batch load all localStorage values in a single pass using cached storage
  // This reduces redundant localStorage reads from 5+ to a single batch operation
  const cachedData = useMemo(() => {
    const activeZoneId = getCached("activeZoneId", "zone1");
    const zoneKey = `spa_resultsHistory_${activeZoneId}`;
    
    // Batch read all needed keys at once
    const batch = getCachedBatch([
      "last_forecast_summary",
      zoneKey,
      "spa_resultsHistory",
      "userLocation",
      "activeZoneId"
    ]);
    
    return batch;
  }, []);

  const lastForecast = useMemo(
    () => cachedData["last_forecast_summary"] || null,
    [cachedData]
  );

  // Multi-zone support: Check active zone or all zones
  const resultsHistory = useMemo(() => {
    const activeZoneId = cachedData["activeZoneId"] || "zone1";
    const zoneKey = `spa_resultsHistory_${activeZoneId}`;
    const zoneHistory = cachedData[zoneKey];
    
    if (zoneHistory && Array.isArray(zoneHistory) && zoneHistory.length > 0) {
      return zoneHistory;
    }
    // Fallback to legacy single-zone storage
    return cachedData["spa_resultsHistory"] || [];
  }, [cachedData]);

  const latestAnalysis =
    resultsHistory && resultsHistory.length > 0
      ? resultsHistory[resultsHistory.length - 1]
      : null;
  const userLocation = useMemo(() => cachedData["userLocation"] || null, [cachedData]);

  // Retrieve outlet context (routing state). Memoized to provide stable reference for useMemo dependencies.
  const outletContext = useOutletContext();
  const outlet = useMemo(() => outletContext || EMPTY_OUTLET, [outletContext]);
  // Support both new userSettings shape and legacy direct setters
  const { userSettings: ctxUserSettings, setUserSetting } = outlet;
  const userSettings = React.useMemo(() => {
    return (
      ctxUserSettings ||
      (typeof outlet.primarySystem !== "undefined" ? { ...outlet } : {})
    );
  }, [ctxUserSettings, outlet]);
  const globalHomeElevation =
    typeof userSettings?.homeElevation === "number"
      ? userSettings.homeElevation
      : typeof outlet.homeElevation === "number"
      ? outlet.homeElevation
      : userLocation && typeof userLocation.elevation === "number"
      ? userLocation.elevation
      : undefined;
  const [precisionEstimate, setPrecisionEstimate] = React.useState(null);
  const [precisionLoading, setPrecisionLoading] = React.useState(false);
  const [precisionError, setPrecisionError] = React.useState(null);

  // Memoize settings object to avoid hook dependency churn warnings
  const settings = React.useMemo(() => userSettings || {}, [userSettings]);

  // Mission Control Center State
  // Joule Bridge integration - use shared context (persists across navigation)
  const jouleBridge = useJouleBridgeContext();
  const bridgeAvailable = jouleBridge.bridgeAvailable;
  
  // Use Joule Bridge temperature if available, otherwise use simulated
  const [simulatedCurrentTemp, setSimulatedCurrentTemp] = useState(72);
  const currentTemp = bridgeAvailable && jouleBridge.connected && jouleBridge.temperature !== null
    ? jouleBridge.temperature
    : simulatedCurrentTemp;
  
  // Initialize systemStatus from localStorage or default to "HEAT ON"
  const [systemStatus, setSystemStatus] = useState(() => {
    try {
      const savedMode = localStorage.getItem("hvacMode") || "heat";
      const modeLabels = {
        heat: "HEAT ON",
        cool: "COOL ON",
        auto: "AUTO ON",
        off: "SYSTEM OFF",
      };
      return modeLabels[savedMode] || "HEAT ON";
    } catch {
      return "HEAT ON";
    }
  });
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showOptimizeModal, setShowOptimizeModal] = useState(false);
  const [optimizationResults, setOptimizationResults] = useState(null);
  const [eventLog, setEventLog] = useState([
    { 
      time: "10:30 AM", 
      message: "Short cycle prevented", 
      type: "info", 
      icon: "⚡",
      details: "Saved ~$0.15 in energy waste by preventing rapid on/off cycling",
      expanded: false
    },
    { 
      time: "10:15 AM", 
      message: "Heat pump locked out - outdoor temp 32°F", 
      type: "warning", 
      icon: "⚠️",
      details: "Switched to aux heat (balance point: 41°F). Heat pump efficiency drops below threshold.",
      expanded: false
    },
    { 
      time: "10:00 AM", 
      message: "System check passed", 
      type: "success", 
      icon: "✓",
      details: "All parameters within optimal range. System operating efficiently.",
      expanded: false
    },
  ]);
  const [outdoorTemp, setOutdoorTemp] = useState(32); // Simulated outdoor temp
  const eventLogRef = useRef(null);
  const navigate = useNavigate();
  // Optimized: Use cached storage for banner state
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    return getCached('demoBannerDismissed', false) === true || 
           getCached('demoBannerDismissed', 'false') === 'true';
  });
  
  // Recently viewed pages state
  const [recentlyViewed, setRecentlyViewed] = useState(() => {
    try {
      return getRecentlyViewed();
    } catch {
      return [];
    }
  });
  const [appCloudSyncEnabled, setAppCloudSyncEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem(APP_CLOUD_SYNC_ENABLED_KEY);
      const legacy = localStorage.getItem(LEGACY_WELLNESS_CLOUD_SYNC_ENABLED_KEY);
      if (stored !== null) return stored === "true";
      if (legacy !== null) return legacy === "true";
      return true; // default on
    } catch {
      return true;
    }
  });
  const [appCloudSyncSecret, setAppCloudSyncSecret] = useState(() => {
    try {
      return (
        localStorage.getItem(APP_CLOUD_SYNC_SECRET_KEY)
        || localStorage.getItem(LEGACY_WELLNESS_CLOUD_SYNC_SECRET_KEY)
        || ""
      ).trim();
    } catch {
      return "";
    }
  });
  const [appCloudSyncBusy, setAppCloudSyncBusy] = useState(false);
  const [appCloudSyncMessage, setAppCloudSyncMessage] = useState("");
  const [appCloudSyncError, setAppCloudSyncError] = useState("");
  const [globalUserName, setGlobalUserName] = useState(() => sanitizeUserName(localStorage.getItem(WELLNESS_GLOBAL_USER_NAME_KEY) || ""));
  const [savedUsers, setSavedUsers] = useState(() => loadSavedUsers());
  const [newUserInput, setNewUserInput] = useState("");
  const [showLoginSyncPanel, setShowLoginSyncPanel] = useState(false);
  const [wellnessPanelOpen, setWellnessPanelOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(DASHBOARD_WELLNESS_PANEL_OPEN_KEY);
      if (stored == null) return true;
      return stored === "1";
    } catch {
      return true;
    }
  });
  const [cloudSyncPanelOpen, setCloudSyncPanelOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(DASHBOARD_CLOUD_SYNC_PANEL_OPEN_KEY);
      if (stored == null) return false;
      return stored === "1";
    } catch {
      return false;
    }
  });
  const [wellnessSavedDataPanelOpen, setWellnessSavedDataPanelOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(DASHBOARD_WELLNESS_SAVED_DATA_PANEL_OPEN_KEY);
      if (stored == null) return false;
      return stored === "1";
    } catch {
      return false;
    }
  });
  const appImportInputRef = useRef(null);
  const appCloudSyncInitializedRef = useRef(false);
  const lastCloudSnapshotRef = useRef("");
  const loginSyncPanelRef = useRef(null);

  // Listen for updates to recently viewed
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        setRecentlyViewed(getRecentlyViewed());
      } catch {
        setRecentlyViewed([]);
      }
    };

    // Listen for custom event from recentlyViewed utils
    window.addEventListener('recentlyViewedUpdated', handleStorageChange);
    // Also listen for storage events (cross-tab updates)
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('recentlyViewedUpdated', handleStorageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(APP_CLOUD_SYNC_ENABLED_KEY, appCloudSyncEnabled ? "true" : "false");
  }, [appCloudSyncEnabled]);

  useEffect(() => {
    localStorage.setItem(APP_CLOUD_SYNC_SECRET_KEY, appCloudSyncSecret.trim());
  }, [appCloudSyncSecret]);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_WELLNESS_PANEL_OPEN_KEY, wellnessPanelOpen ? "1" : "0");
  }, [wellnessPanelOpen]);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_CLOUD_SYNC_PANEL_OPEN_KEY, cloudSyncPanelOpen ? "1" : "0");
  }, [cloudSyncPanelOpen]);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_WELLNESS_SAVED_DATA_PANEL_OPEN_KEY, wellnessSavedDataPanelOpen ? "1" : "0");
  }, [wellnessSavedDataPanelOpen]);

  useEffect(() => {
    localStorage.setItem(WELLNESS_GLOBAL_USER_NAME_KEY, globalUserName);
    localStorage.setItem(WELLNESS_SAVED_USERS_KEY, JSON.stringify(savedUsers));
    window.dispatchEvent(new CustomEvent(WELLNESS_USER_CHANGED_EVENT, {
      detail: { userName: globalUserName },
    }));
    window.dispatchEvent(new Event("storage"));
  }, [globalUserName, savedUsers]);

  const runAppCloudSync = async ({ forcePull = false, forcePush = false } = {}) => {
    const syncKey = appCloudSyncSecret.trim();
    if (!appCloudSyncEnabled || !syncKey) return;

    setAppCloudSyncBusy(true);
    setAppCloudSyncError("");

    try {
      const localSnapshot = buildAppCloudSnapshot();
      const localSnapshotString = JSON.stringify(localSnapshot);
      const localHasData = hasMeaningfulAppData(localSnapshot);

      if (forcePull || (!appCloudSyncInitializedRef.current && !localHasData)) {
        const response = await pullAppCloudSnapshot(syncKey);
        if (response?.found && response?.payload) {
          const restoredCount = applyAppCloudSnapshot(response.payload);
          lastCloudSnapshotRef.current = JSON.stringify(response.payload);
          setAppCloudSyncMessage(`Cloud restore complete. Restored ${restoredCount} key${restoredCount === 1 ? "" : "s"}.`);
        } else if (forcePull) {
          setAppCloudSyncMessage("No cloud backup was found for this sync key.");
        }
        appCloudSyncInitializedRef.current = true;
        return;
      }

      if (forcePush || !appCloudSyncInitializedRef.current || lastCloudSnapshotRef.current !== localSnapshotString) {
        await pushAppCloudSnapshot(syncKey, localSnapshot);
        lastCloudSnapshotRef.current = localSnapshotString;
        setAppCloudSyncMessage("Automatic cloud sync is up to date.");
      }

      appCloudSyncInitializedRef.current = true;
    } catch (error) {
      setAppCloudSyncError(error?.message || "Cloud sync failed.");
    } finally {
      setAppCloudSyncBusy(false);
    }
  };

  useEffect(() => {
    if (!appCloudSyncEnabled || !appCloudSyncSecret.trim()) return;

    runAppCloudSync();
    const intervalId = window.setInterval(() => {
      runAppCloudSync();
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [appCloudSyncEnabled, appCloudSyncSecret]);

  useEffect(() => {
    if (!showLoginSyncPanel) return;

    const handlePointerDown = (event) => {
      if (!loginSyncPanelRef.current?.contains(event.target)) {
        setShowLoginSyncPanel(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowLoginSyncPanel(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showLoginSyncPanel]);

  const toggleAppCloudSync = () => {
    setAppCloudSyncEnabled((prev) => !prev);
    setAppCloudSyncMessage("");
    setAppCloudSyncError("");
  };

  const generateAppCloudSyncSecret = () => {
    const nextSecret = createCloudSyncSecret();
    setAppCloudSyncSecret(nextSecret);
    setAppCloudSyncError("");
    setAppCloudSyncMessage("Generated a new sync key. Save it somewhere safe so another browser can restore the full app data.");
  };

  const downloadAppJson = () => {
    try {
      const payload = buildAppCloudSnapshot();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const dateStamp = new Date().toISOString().slice(0, 10);
      anchor.href = url;
      anchor.download = `joule-app-data-${dateStamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setAppCloudSyncError("");
      setAppCloudSyncMessage("Downloaded app-wide JSON backup.");
    } catch (error) {
      setAppCloudSyncMessage("");
      setAppCloudSyncError(error?.message || "Could not download app JSON backup.");
    }
  };

  const triggerAppImportPicker = () => {
    setAppCloudSyncMessage("");
    setAppCloudSyncError("");
    appImportInputRef.current?.click();
  };

  const handleAppImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const restoredCount = applyAppCloudSnapshot(payload);
      setAppCloudSyncError("");
      setAppCloudSyncMessage(`Imported app-wide JSON backup. Restored ${restoredCount} key${restoredCount === 1 ? "" : "s"}.`);
    } catch (error) {
      setAppCloudSyncMessage("");
      setAppCloudSyncError(error?.message || "Could not import the selected JSON file.");
    } finally {
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const saveGlobalWellnessUser = () => {
    const name = sanitizeUserName(newUserInput) || sanitizeUserName(globalUserName);
    if (!name) return;
    setSavedUsers((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setGlobalUserName(name);
    setNewUserInput("");
    setShowLoginSyncPanel(false);
  };

  const selectGlobalWellnessUser = (name) => {
    setGlobalUserName(sanitizeUserName(name));
    setNewUserInput("");
    setShowLoginSyncPanel(false);
  };

  const removeGlobalWellnessUser = (name) => {
    const normalized = sanitizeUserName(name);
    setSavedUsers((prev) => prev.filter((user) => user !== normalized));
    if (globalUserName === normalized) {
      setGlobalUserName("");
    }
  };

  const dashboardUserSnapshot = useMemo(() => {
    return buildUserSavedDataSnapshot(globalUserName);
  }, [globalUserName]);

  const dashboardMedicationTrackerCount = useMemo(() => {
    return Object.values(dashboardUserSnapshot.medicationTrackersByUserState || {}).filter((state) => {
      return Array.isArray(state?.entries) && state.entries.length > 0;
    }).length;
  }, [dashboardUserSnapshot]);

  // Listen for HVAC mode changes from Ask Joule commands
  useEffect(() => {
    const handleHvacModeChange = (event) => {
      const newMode = event.detail?.mode;
      if (newMode && ["heat", "cool", "auto", "off"].includes(newMode)) {
        const modeLabels = {
          heat: "HEAT ON",
          cool: "COOL ON",
          auto: "AUTO ON",
          off: "SYSTEM OFF",
        };
        setSystemStatus(modeLabels[newMode] || "HEAT ON");
      }
    };

    window.addEventListener("hvacModeChanged", handleHvacModeChange);
    return () => {
      window.removeEventListener("hvacModeChanged", handleHvacModeChange);
    };
  }, []);

  // Listen for target temperature changes from Ask Joule commands
  // Force re-render of target temperature display
  const [targetTempUpdate, setTargetTempUpdate] = useState(0);
  useEffect(() => {
    const handleTargetTempChange = (event) => {
      const newTemp = event.detail?.temp || event.detail?.temperature;
      if (typeof newTemp === "number") {
        // Update thermostatState if not already updated
        try {
          const currentState = JSON.parse(
            localStorage.getItem("thermostatState") || '{"targetTemp": 70, "mode": "heat", "preset": "home"}'
          );
          currentState.targetTemp = newTemp;
          localStorage.setItem("thermostatState", JSON.stringify(currentState));
        } catch (error) {
          console.warn("[Home] Failed to update thermostatState:", error);
        }
        // Force re-render by updating state
        setTargetTempUpdate(prev => prev + 1);
      }
    };

    window.addEventListener("targetTempChanged", handleTargetTempChange);
    return () => {
      window.removeEventListener("targetTempChanged", handleTargetTempChange);
    };
  }, []);

  // Compute target temperature reactively
  const targetTemp = useMemo(() => {
    // targetTempUpdate dependency forces recomputation when event fires
    let temp = null;
    
    // Priority 1: Use Joule Bridge data when demo mode is disabled and bridge is connected
    const demoModeDisabled = localStorage.getItem("demoModeDisabled") === "true";
    if (demoModeDisabled && bridgeAvailable && jouleBridge.connected) {
      const bridgeTarget = jouleBridge.targetTemperature;
      if (bridgeTarget !== null && bridgeTarget !== undefined) {
        return bridgeTarget;
      }
    }
    
    // Priority 2: localStorage thermostatState
    try {
      const thermostatState = localStorage.getItem('thermostatState');
      if (thermostatState) {
        const state = JSON.parse(thermostatState);
        if (typeof state.targetTemp === 'number') {
          temp = state.targetTemp;
        }
      }
    } catch {
      // Ignore localStorage errors
    }
    
    // Fallback to settings if no thermostat state
    if (temp === null) {
      // Use winter or summer thermostat based on current mode
      if (systemStatus === "COOL ON" || systemStatus === "AUTO ON") {
        temp = settings?.summerThermostat || null;
      } else {
        temp = settings?.winterThermostat || null;
      }
    }
    
    return temp;
  }, [targetTempUpdate, systemStatus, settings?.winterThermostat, settings?.summerThermostat, bridgeAvailable, jouleBridge.connected, jouleBridge.targetTemperature]);
  
  // Demo mode hook
  const { isDemo, demoData, proAccess } = useDemoMode();

  // Simulate temperature changes (only if not using Joule Bridge)
  useEffect(() => {
    if (bridgeAvailable && jouleBridge.connected) {
      // Don't simulate if we have real data
      return;
    }
    const interval = setInterval(() => {
      setSimulatedCurrentTemp((prev) => {
        const change = (Math.random() - 0.5) * 0.5;
        return Math.max(68, Math.min(76, prev + change));
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [bridgeAvailable, jouleBridge.connected]);

  // Auto-scroll event log
  useEffect(() => {
    if (eventLogRef.current) {
      eventLogRef.current.scrollTop = 0;
    }
  }, [eventLog]);

  // Generate sparkline data (last 4 hours, 48 points)
  const sparklineData = useMemo(() => {
    const data = [];
    const baseTemp = currentTemp;
    for (let i = 47; i >= 0; i--) {
      const variance = (Math.sin(i / 8) + Math.random() * 0.3) * 1.5;
      data.push(baseTemp + variance);
    }
    return data;
  }, [currentTemp]);

  const handleOptimize = async () => {
    setIsOptimizing(true);
    setTimeout(() => {
      setIsOptimizing(false);
      setOptimizationResults({
        inefficiencies: 3,
        savings: 42,
        fixes: [
          "Lockout temperature set too high",
          "Short cycle protection disabled",
          "Aux heat threshold needs adjustment",
        ],
      });
      setShowOptimizeModal(true);
      
      // Calculate optimized setpoints based on recommendation (68°F day / 66°F night)
      const currentWinter = settings.winterThermostat || 70;
      const optimizedDay = Math.max(68, currentWinter - 2); // 68°F day
      const optimizedNight = Math.max(66, optimizedDay - 2); // 66°F night
      
      // Determine current time and which setpoint to apply
      const now = new Date();
      const currentHour = now.getHours();
      const isNighttime = currentHour >= 22 || currentHour < 6;
      const targetSetpoint = isNighttime ? optimizedNight : optimizedDay;
      
      // Save optimizer schedule to localStorage so verdict can detect it
      try {
        const optimizedSchedule = {
          blocks: [
            { start: "00:00", end: "06:00", setpoint: optimizedNight },
            { start: "06:00", end: "22:00", setpoint: optimizedDay },
            { start: "22:00", end: "24:00", setpoint: optimizedNight },
          ],
          appliedAt: new Date().toISOString(),
        };
        localStorage.setItem("optimizerSchedule", JSON.stringify(optimizedSchedule));
        localStorage.setItem("optimizerScheduleAppliedAt", new Date().toISOString());
        
        // Update actual thermostat target temperature
        // Update userSettings.winterThermostat (used by Control page)
        try {
          // Try outlet.setUserSetting first (if available)
          if (outlet?.setUserSetting) {
            outlet.setUserSetting("winterThermostat", targetSetpoint, {
              source: "Optimizer",
              comment: "Applied optimized schedule",
            });
          } else {
            // Fallback: update directly in localStorage
            const userSettings = JSON.parse(localStorage.getItem("userSettings") || "{}");
            userSettings.winterThermostat = targetSetpoint;
            localStorage.setItem("userSettings", JSON.stringify(userSettings));
          }
        } catch (e) {
          console.warn("Failed to update userSettings:", e);
        }
        
        // Update thermostatState.targetTemp (used by Control page)
        try {
          const thermostatState = JSON.parse(
            localStorage.getItem("thermostatState") || '{"targetTemp": 70, "mode": "heat", "preset": "home"}'
          );
          thermostatState.targetTemp = targetSetpoint;
          localStorage.setItem("thermostatState", JSON.stringify(thermostatState));
          
          // Dispatch event to notify other components
          window.dispatchEvent(new CustomEvent("targetTempChanged", {
            detail: { temp: targetSetpoint, temperature: targetSetpoint, source: "optimizer" }
          }));
        } catch (e) {
          console.warn("Failed to update thermostatState:", e);
        }
      } catch (e) {
        console.warn("Failed to save optimizer schedule:", e);
      }
      
      // Add event to log
      setEventLog((prev) => [
        { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), message: `Applied 3 optimizations. Target set to ${targetSetpoint}°F. Estimated savings: $42/year.`, type: "success", icon: "✅" },
        ...prev,
      ]);
    }, 2000);
  };

  // Debugging hook: log when the detailed precision flag changes to help detect E2E flakiness
  React.useEffect(() => {
    if (import.meta.env.DEV) {
      console.info(
        "Home: useDetailedAnnualEstimate",
        settings.useDetailedAnnualEstimate
      );
    }
  }, [settings.useDetailedAnnualEstimate]);

  // Debug the full settings object when it changes to verify area prop syncing
  React.useEffect(() => {
    if (import.meta.env.DEV) {
      console.info("Home: full settings snapshot", settings);
    }
  }, [settings]);

  const annualEstimate = useMemo(() => {
    const useManualHeatLoss = Boolean(settings?.useManualHeatLoss);
    const useCalculatedHeatLoss = settings?.useCalculatedHeatLoss !== false; // Default to true
    const useAnalyzerHeatLoss = Boolean(settings?.useAnalyzerHeatLoss);
    const useLearnedHeatLoss = Boolean(settings?.useLearnedHeatLoss);
    let heatLossFactor;
    
    // Calculate ceiling multiplier once for use in both heating and cooling calculations
    const ceilingMultiplier = 1 + ((settings.ceilingHeight || 8) - 8) * 0.1;
    
    // Priority 1: Manual Entry (if enabled)
    if (useManualHeatLoss) {
      const manualHeatLossFactor = Number(settings?.manualHeatLoss);
      if (Number.isFinite(manualHeatLossFactor) && manualHeatLossFactor > 0) {
        // manualHeatLoss is already stored as BTU/hr/°F (heat loss factor)
        heatLossFactor = manualHeatLossFactor;
      }
    }
    
    // Priority 2: Analyzer Data from CSV (if enabled and available)
    if (!heatLossFactor && useAnalyzerHeatLoss && latestAnalysis?.heatLossFactor) {
      heatLossFactor = latestAnalysis.heatLossFactor;
    }
    
    // Priority 3: Bill-learned heat loss (if enabled and ≥30 days of bill data)
    if (!heatLossFactor && useLearnedHeatLoss && settings?.learnedHeatLoss > 0 && shouldUseLearnedHeatLoss()) {
      heatLossFactor = Number(settings.learnedHeatLoss);
    }
    
    // Priority 4: Calculated from Building Characteristics (DoE data)
    if (!heatLossFactor && useCalculatedHeatLoss) {
      const BASE_BTU_PER_SQFT_HEATING = 22.67;
      const effectiveSquareFeet = heatUtils.getEffectiveSquareFeet(
        settings.squareFeet || 1500,
        settings.hasLoft || false,
        settings.homeShape || 1.0
      );
      const designHeatLoss =
        effectiveSquareFeet *
        BASE_BTU_PER_SQFT_HEATING *
        (settings.insulationLevel || 1.0) *
        (settings.homeShape || 1.0) *
        ceilingMultiplier;
      heatLossFactor = designHeatLoss / 70;
    }
    
    // Fallback: Use analyzer data if available (for backwards compatibility)
    if (!heatLossFactor && latestAnalysis?.heatLossFactor) {
      heatLossFactor = latestAnalysis.heatLossFactor;
    }

    if (!userLocation || !heatLossFactor) {
      return null;
    }

    const homeElevation =
      typeof globalHomeElevation === "number"
        ? globalHomeElevation
        : settings.homeElevation ?? 0;
    const elevationMultiplierRaw = 1 + ((homeElevation || 0) / 1000) * 0.005;
    const elevationMultiplier = Math.max(
      0.8,
      Math.min(1.3, elevationMultiplierRaw)
    );

    const winterThermostat = settings.winterThermostat;
    const summerThermostat = settings.summerThermostat;
    const useDetailed = settings.useDetailedAnnualEstimate;

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
    
    // Heat gain factor derived from heat loss factor with solar exposure multiplier
    // This is a UA-like term (BTU/hr/°F), consistent with heatLossFactor
    // Default range: 1.3-1.8 (unless user explicitly selects "shaded/minimal windows" which allows 1.0-1.2)
    let solarExposureMultiplier = settings.solarExposure || 1.5;
    
    // If it's a percent (>= 1 and <= 100), divide by 100
    if (solarExposureMultiplier >= 1 && solarExposureMultiplier <= 100) {
      solarExposureMultiplier = solarExposureMultiplier / 100;
    }
    
    // Clamp to [1.0, 2.5] range
    // Note: Shaded/minimal windows allows 1.0-1.2, typical range is 1.3-1.8
    solarExposureMultiplier = Math.max(1.0, Math.min(2.5, solarExposureMultiplier));
    
    // Derive heat gain from heat loss: heatGainFactor = heatLossFactor * solarExposureMultiplier
    // This ensures consistency - heat gain is always proportional to heat loss
    const heatGainFactor = heatLossFactor * solarExposureMultiplier;

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

    const quickEstimate = {
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
      method: useDetailed ? "detailed" : "quick",
      winterThermostat: winterThermostat,
      summerThermostat: summerThermostat,
    };

    if (useDetailed && precisionEstimate) {
      return {
        ...quickEstimate,
        totalCost: precisionEstimate.totalCost,
        heatingCost: precisionEstimate.heatingCost,
        coolingCost: precisionEstimate.coolingCost,
        totalEnergy: precisionEstimate.totalEnergy,
        totalAux: precisionEstimate.totalAux,
        method: "fullPrecision",
      };
    }

    return quickEstimate;
  }, [
    latestAnalysis,
    userLocation,
    // --- FIX: ADD ALL SETTINGS FROM CONTEXT TO THE DEPENDENCY ARRAY ---
    settings.squareFeet,
    settings.insulationLevel,
    settings.homeShape,
    settings.ceilingHeight,
    settings.utilityCost,
    settings.homeElevation,
    settings.hspf2,
    settings.efficiency,
    settings.solarExposure,
    settings.useElectricAuxHeat,
    settings.winterThermostat,
    settings.summerThermostat,
    settings.useDetailedAnnualEstimate,
    settings.useManualHeatLoss,
    settings.useCalculatedHeatLoss,
    settings.useAnalyzerHeatLoss,
    settings.manualHeatLoss,
    precisionEstimate,
    globalHomeElevation, // Also add the global elevation
  ]);

  React.useEffect(() => {
    let mounted = true;
    async function runPrecision() {
      if (!settings.useDetailedAnnualEstimate || !userLocation) {
        setPrecisionEstimate(null);
        return;
      }
      try {
        setPrecisionLoading(true);
        setPrecisionError(null);
        const res = await computeAnnualPrecisionEstimate(settings, {
          monthlyProfile: optionsMonthlyProfileFromUserLocation(userLocation),
        });
        if (mounted) {
          setPrecisionEstimate(res);
        }
      } catch (error) {
        console.warn("computeAnnualPrecisionEstimate failed", error);
        if (mounted) setPrecisionError("Failed to compute detailed estimate.");
      } finally {
        if (mounted) setPrecisionLoading(false);
      }
    }
    runPrecision();
    return () => {
      mounted = false;
    };
  }, [
    settings,
    settings.useDetailedAnnualEstimate,
    userLocation,
    settings.winterThermostat,
    settings.summerThermostat,
    settings.squareFeet,
    settings.insulationLevel,
    settings.homeShape,
    settings.ceilingHeight,
    settings.hspf2,
    settings.efficiency,
    settings.utilityCost,
    settings.useElectricAuxHeat,
  ]);

  function optionsMonthlyProfileFromUserLocation() {
    const defaultHighs = [42, 45, 55, 65, 75, 85, 88, 86, 78, 66, 55, 45];
    return defaultHighs.map((h) => ({ high: h, low: h - 14 }));
  }

  // Determine ambient gradient based on system status - Lightened for clarity
  // Using inline styles for precise color control
  const ambientGradientStyle = useMemo(() => {
    if (systemStatus === "COOL ON") {
      // Light, crisp blue - much lighter for clarity
      return {
        background: 'linear-gradient(to bottom, rgba(30, 58, 138, 0.08), rgba(30, 64, 175, 0.05), transparent)'
      };
    } else if (systemStatus === "HEAT ON") {
      // Light, warm amber - much lighter for clarity
      return {
        background: 'linear-gradient(to bottom, rgba(124, 45, 18, 0.08), rgba(154, 52, 18, 0.05), transparent)'
      };
    } else if (systemStatus === "AUTO ON") {
      return {
        background: 'linear-gradient(to bottom, rgba(88, 28, 135, 0.06), rgba(67, 56, 202, 0.04), transparent)'
      };
    }
    return {
      background: 'linear-gradient(to bottom, rgba(17, 24, 39, 0.04), transparent)'
    };
  }, [systemStatus]);

  const isCooling = systemStatus === "COOL ON";
  const isHeating = systemStatus === "HEAT ON";

  // Page background gradient based on system status - Flattened for clarity
  const pageBackgroundStyle = useMemo(() => {
    if (systemStatus === "COOL ON") {
      return {
        background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.03) 0%, transparent 100%)'
      };
    } else if (systemStatus === "HEAT ON") {
      return {
        background: 'linear-gradient(135deg, rgba(124, 45, 18, 0.03) 0%, transparent 100%)'
      };
    }
    return {
      background: 'transparent'
    };
  }, [systemStatus]);

  return (
    <div className="min-h-screen bg-[#050B10]">
      <div className="w-full px-6 lg:px-8 py-6">
        {/* Page Header - Always show */}
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-[28px] font-semibold text-white mb-2">
              Mission Control
            </h1>
            <p className="text-sm text-[#A7B0BA]">
              Quick overview of your system status
            </p>
          </div>
          <div ref={loginSyncPanelRef} className="relative flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowLoginSyncPanel((prev) => !prev)}
              className="px-4 py-2 text-sm border border-fuchsia-500/40 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-100 rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <span className="font-medium">Login & Sync</span>
              {globalUserName && (
                <span className="rounded-full border border-fuchsia-300/40 bg-fuchsia-500/20 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-50">
                  {globalUserName}
                </span>
              )}
              {appCloudSyncEnabled && (
                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-100">
                  On
                </span>
              )}
            </button>
            <Link
              to="/onboarding?rerun=true"
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <SettingsIcon className="w-4 h-4" />
              Re-run Onboarding
            </Link>

            {showLoginSyncPanel && (
              <div className="absolute right-0 top-full z-40 mt-3 w-[min(42rem,calc(100vw-3rem))] rounded-2xl border border-slate-800 bg-[#0C1118] p-5 shadow-2xl shadow-black/40">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Login & Sync</h2>
                    <p className="text-sm text-[#A7B0BA]">
                      Manage your active wellness user and optional private cloud sync in one place.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-fuchsia-300/40 bg-fuchsia-500/10 px-2.5 py-1 font-semibold text-fuchsia-100">
                      {globalUserName ? `Active: ${globalUserName}` : "No user selected"}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 font-semibold ${appCloudSyncEnabled ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200" : "border-slate-500/60 bg-slate-700/40 text-slate-200"}`}>
                      Cloud Sync {appCloudSyncEnabled ? "On" : "Off"}
                    </span>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <details
                    className="rounded-xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-900/20 to-violet-900/20 p-5"
                    open={wellnessPanelOpen}
                    onToggle={(event) => setWellnessPanelOpen(event.currentTarget.open)}
                  >
                    <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2 rounded-lg -m-2 p-2 hover:bg-white/5 transition-colors">
                      <div>
                        <p className="text-base font-semibold text-fuchsia-100">Wellness User</p>
                        <p className="text-xs text-fuchsia-200/90">{globalUserName ? `Active: ${globalUserName}` : "No active wellness user selected"}</p>
                      </div>
                      <div className="inline-flex items-center gap-2">
                        <span className="rounded-full border border-fuchsia-300/50 bg-fuchsia-600/20 px-2 py-1 text-[11px] font-semibold text-fuchsia-100">
                          {savedUsers.length} saved user{savedUsers.length === 1 ? "" : "s"}
                        </span>
                        <ChevronRight className={`w-4 h-4 text-fuchsia-200 transition-transform ${wellnessPanelOpen ? "rotate-90" : ""}`} />
                      </div>
                    </summary>

                    <div className="mt-3 space-y-3">
                      {globalUserName && (
                        <p className="text-xs text-fuchsia-200">
                          Active user: <strong>{globalUserName}</strong> · All wellness tools will use this user's settings.
                        </p>
                      )}

                      {savedUsers.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {savedUsers.map((name) => (
                            <div
                              key={name}
                              className={`flex items-center gap-1 pl-3 pr-1 py-1 rounded-full text-sm border ${
                                globalUserName === name
                                  ? "bg-fuchsia-600 text-white border-fuchsia-500"
                                  : "bg-slate-900 text-slate-200 border-slate-600 hover:border-fuchsia-400"
                              }`}
                            >
                              <button type="button" onClick={() => selectGlobalWellnessUser(name)} className="font-medium">
                                {name}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeGlobalWellnessUser(name)}
                                className={`ml-1 rounded-full p-0.5 hover:bg-black/20 ${globalUserName === name ? "text-fuchsia-100" : "text-gray-400 hover:text-red-400"}`}
                                title={`Remove ${name}`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newUserInput}
                          onChange={(e) => setNewUserInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveGlobalWellnessUser()}
                          placeholder={globalUserName ? `Active: ${globalUserName}` : "Enter a user name..."}
                          className="flex-1 px-3 py-2 rounded-lg border border-fuchsia-400/40 bg-[#0C1118] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/60 text-sm"
                        />
                        <button
                          type="button"
                          onClick={saveGlobalWellnessUser}
                          disabled={!sanitizeUserName(newUserInput) && !sanitizeUserName(globalUserName)}
                          className="flex items-center gap-1 px-3 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700 disabled:bg-slate-700 text-white text-sm font-medium"
                        >
                          <UserPlus className="w-4 h-4" />
                          Save
                        </button>
                      </div>

                      <details className="group rounded-lg border border-fuchsia-400/30 bg-black/20 p-3" open={wellnessSavedDataPanelOpen} onToggle={(event) => setWellnessSavedDataPanelOpen(event.currentTarget.open)}>
                        <summary className="cursor-pointer list-none flex items-center justify-between gap-3 rounded-md -m-1 p-1 text-sm font-semibold text-fuchsia-100 hover:bg-white/5 transition-colors">
                          <span>Saved Data For Current User</span>
                          <ChevronRight className="w-4 h-4 text-fuchsia-200 transition-transform group-open:rotate-90" />
                        </summary>
                        <div className="mt-3 space-y-1 text-xs text-slate-200">
                          <p><strong>User:</strong> {dashboardUserSnapshot.userName || "-"}</p>
                          <p><strong>Caffeine profile ID:</strong> {dashboardUserSnapshot.profileLinks?.caffeineProfileId || "-"}</p>
                          <p><strong>Calorie profile ID:</strong> {dashboardUserSnapshot.profileLinks?.calorieProfileId || "-"}</p>
                          <p><strong>Caffeine entries:</strong> {Array.isArray(dashboardUserSnapshot.caffeineTracker?.entries) ? dashboardUserSnapshot.caffeineTracker.entries.length : 0}</p>
                          <p><strong>Calorie meal logs:</strong> {Array.isArray(dashboardUserSnapshot.dailyCalorieIntake?.mealLog) ? dashboardUserSnapshot.dailyCalorieIntake.mealLog.length : 0}</p>
                          <p><strong>Medication trackers with entries:</strong> {dashboardMedicationTrackerCount}</p>
                        </div>
                      </details>
                    </div>
                  </details>

                  <details
                    className="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-900/20 to-blue-900/20 p-5"
                    open={cloudSyncPanelOpen}
                    onToggle={(event) => setCloudSyncPanelOpen(event.currentTarget.open)}
                  >
                    <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2 rounded-lg -m-2 p-2 hover:bg-white/5 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Cloud className="w-5 h-5 text-cyan-300" />
                          <h2 className="text-lg font-semibold text-white">Automatic Cloud Sync</h2>
                        </div>
                        <p className="text-sm text-cyan-100/90">Sync this app across browsers with a private key.</p>
                      </div>
                      <div className="inline-flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${appCloudSyncEnabled ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200" : "border-slate-500/60 bg-slate-700/40 text-slate-200"}`}>
                          {appCloudSyncEnabled ? "On" : "Off"}
                        </span>
                        <ChevronRight className={`w-4 h-4 text-cyan-200 transition-transform ${cloudSyncPanelOpen ? "rotate-90" : ""}`} />
                      </div>
                    </summary>

                    <div className="mt-3 space-y-3">
                      <p className="text-sm text-[#A7B0BA]">
                        Stores your full app data bundle in Netlify cloud storage using a private sync key. Any browser with the same key can restore and keep syncing automatically.
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleAppCloudSync}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${appCloudSyncEnabled ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-slate-700 hover:bg-slate-600 text-slate-100"}`}
                      >
                        {appCloudSyncEnabled ? "Cloud Sync On" : "Cloud Sync Off"}
                      </button>
                      <button
                        type="button"
                        onClick={generateAppCloudSyncSecret}
                        className="px-3 py-2 rounded-lg border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/10 text-sm font-medium"
                      >
                        Generate Sync Key
                      </button>
                      <button
                        type="button"
                        onClick={downloadAppJson}
                        className="px-3 py-2 rounded-lg border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/10 text-sm font-medium"
                      >
                        Download JSON
                      </button>
                      <button
                        type="button"
                        onClick={triggerAppImportPicker}
                        className="px-3 py-2 rounded-lg border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/10 text-sm font-medium"
                      >
                        Upload JSON
                      </button>
                      <button
                        type="button"
                        onClick={() => runAppCloudSync({ forcePush: true })}
                        disabled={!appCloudSyncEnabled || !appCloudSyncSecret.trim() || appCloudSyncBusy}
                        className="px-3 py-2 rounded-lg border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/10 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                      >
                        <RefreshCw className={`w-4 h-4 ${appCloudSyncBusy ? "animate-spin" : ""}`} />
                        {appCloudSyncBusy ? "Syncing..." : "Sync Now"}
                      </button>
                      <button
                        type="button"
                        onClick={() => runAppCloudSync({ forcePull: true })}
                        disabled={!appCloudSyncEnabled || !appCloudSyncSecret.trim() || appCloudSyncBusy}
                        className="px-3 py-2 rounded-lg border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/10 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Restore From Cloud
                      </button>
                      <input
                        ref={appImportInputRef}
                        type="file"
                        accept="application/json,.json"
                        onChange={handleAppImportFile}
                        className="hidden"
                      />
                      </div>

                      <label className="space-y-1 block">
                        <span className="text-sm text-slate-200 inline-flex items-center gap-1">
                          <KeyRound className="w-4 h-4" />
                          Sync key
                        </span>
                        <input
                          type="text"
                          value={appCloudSyncSecret}
                          onChange={(e) => setAppCloudSyncSecret(e.target.value.trim())}
                          placeholder="Paste or generate a sync key"
                          className="w-full px-3 py-2 rounded-lg border border-cyan-400/40 bg-[#0C1118] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                        />
                      </label>

                      <p className="text-xs text-slate-400">
                        Keep this key private. Anyone with the same key can restore your synced app data bundle.
                      </p>

                      {appCloudSyncMessage && <p className="text-xs text-emerald-300">{appCloudSyncMessage}</p>}
                      {appCloudSyncError && <p className="text-xs text-rose-300">{appCloudSyncError}</p>}
                    </div>
                  </details>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Quick Status Card - Only show when Ecobee is paired AND onboarding complete */}
        {hasCompletedOnboarding && bridgeAvailable && jouleBridge.connected && (
          <div className="mb-6 bg-[#0C1118] border border-slate-800 rounded-xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-[#A7B0BA] mb-1">Current Temperature</div>
                <div className="text-3xl font-bold text-white">{currentTemp.toFixed(1)}°F</div>
                <div className="text-xs text-[#7C8894] mt-1">Target: {targetTemp}°F</div>
              </div>
              <div>
                <div className="text-sm text-[#A7B0BA] mb-1">System Status</div>
                <div className="text-xl font-semibold text-white">{systemStatus}</div>
                <div className="text-xs text-[#7C8894] mt-1">Outdoor: {outdoorTemp}°F</div>
              </div>
              <div>
                <div className="text-sm text-[#A7B0BA] mb-1">Bridge Connection</div>
                <div className={`text-lg font-semibold ${bridgeAvailable && jouleBridge.connected ? 'text-green-400' : 'text-amber-400'}`}>
                  {bridgeAvailable && jouleBridge.connected ? 'Connected' : 'Demo Mode'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Budget Section ──────────────────────────────────────── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#6B7785]">Budget</p>
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={(e) => {
                const now = new Date();
                const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
                const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
                handleFeatureClick(`/analysis/monthly?month=${lastMonth}&year=${lastYear}`, e);
              }}
              className="bg-gradient-to-br from-orange-600/20 to-amber-700/20 border-2 border-orange-500/40 rounded-xl p-5 hover:border-orange-400/60 transition-colors text-left w-full"
            >
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-7 h-7 text-orange-400" />
                <h3 className="text-lg font-semibold text-white">Why is my bill so high?</h3>
              </div>
              <p className="text-sm text-[#A7B0BA]">Compare last month&apos;s bill to forecast — runs onboarding if needed</p>
            </button>
            <button
              onClick={(e) => {
                const now = new Date();
                handleFeatureClick(`/analysis/monthly?month=${now.getMonth() + 1}&year=${now.getFullYear()}`, e);
              }}
              className="bg-gradient-to-br from-emerald-600/20 to-teal-700/20 border-2 border-emerald-500/40 rounded-xl p-5 hover:border-emerald-400/60 transition-colors text-left w-full"
            >
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="w-7 h-7 text-emerald-400" />
                <h3 className="text-lg font-semibold text-white">This month&apos;s bill forecast</h3>
              </div>
              <p className="text-sm text-[#A7B0BA]">See expected cost for this month — runs onboarding if needed</p>
            </button>
          </div>
        </div>

        {/* ── Tools Section ───────────────────────────────────────── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#6B7785]">Tools</p>
          <Link
            to="/tools"
            className="flex items-center gap-4 bg-gradient-to-br from-sky-600/20 to-blue-700/20 border-2 border-sky-500/40 rounded-xl p-5 hover:border-sky-400/60 transition-colors"
          >
            <div className="p-2.5 rounded-lg bg-sky-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">HVAC &amp; Electrical Tools</h3>
              <p className="text-sm text-[#A7B0BA]">Load calcs, wiring tools, equipment guides, and more</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-sky-400 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </Link>
        </div>

        {/* ── Wellness Section ─────────────────────────────────────── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#6B7785]">Wellness</p>
          <Link
            to="/wellness"
            className="flex items-center gap-4 bg-gradient-to-br from-violet-600/20 to-purple-700/20 border-2 border-violet-500/40 rounded-xl p-5 hover:border-violet-400/60 transition-colors"
          >
            <div className="p-2.5 rounded-lg bg-violet-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Wellness Hub</h3>
              <p className="text-sm text-[#A7B0BA]">Sleep, anxiety tools, clonazepam tracker, CBT, and AI chat</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-violet-400 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </Link>
        </div>

        {/* Savings Dashboard - Only show after onboarding complete */}
        {hasCompletedOnboarding && (
          <div className="mt-8">
            <SavingsDashboard />
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeDashboard;
