import React, { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, X, Coffee, Pill, Thermometer, Heart, Scale, Trash2 } from "lucide-react";
import { activeClonazepamAmountAtTime } from "../utils/clonazepamModel";

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

const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const WELLNESS_AI_QUICK_PROMPTS = [
  "Summarize my current wellness snapshot.",
  "How consistent is my clonazepam dosing? What would help?",
  "How does my caffeine intake interact with my taper? What should I adjust?",
  "Which tracker changed most recently?",
  "Which tracker looks most active this week?",
  "Do I have any overdue or reminder-style signals right now?",
  "What trends should I discuss with my clinician?",
];

function sanitizeUserName(value) {
  return String(value || "").trim();
}

function createImportedCaffeineProfile(userName, importedProfile) {
  const profile = importedProfile && typeof importedProfile === "object" ? importedProfile : {};
  return {
    id: `caffeine-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: userName,
    weight: Number(profile.weight) || 170,
    weightUnit: profile.weightUnit === "kg" ? "kg" : "lb",
    halfLifeHours: Number(profile.halfLifeHours) > 0 ? Number(profile.halfLifeHours) : 5,
    daysAtDose: Math.max(0, Number(profile.daysAtDose) || 0),
    entries: Array.isArray(profile.entries) ? profile.entries : [],
  };
}

function createImportedCalorieProfile(userName, importedProfile) {
  const profile = importedProfile && typeof importedProfile === "object" ? importedProfile : {};
  return {
    id: `calorie-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: userName,
    form: profile?.form && typeof profile.form === "object" ? profile.form : {},
    createdAt: profile.createdAt || new Date().toISOString(),
    lastModified: new Date().toISOString(),
    weightHistory: Array.isArray(profile.weightHistory) ? profile.weightHistory : [],
    mealLog: Array.isArray(profile.mealLog) ? profile.mealLog : [],
  };
}

function loadSavedUsers() {
  try {
    const parsed = JSON.parse(localStorage.getItem(WELLNESS_SAVED_USERS_KEY) || "[]");
    if (Array.isArray(parsed)) return parsed.filter((u) => typeof u === "string" && u.trim());
  } catch {
    // no-op
  }
  return [];
}

function safeParseJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function findUserProfile(profiles, activeId, userName) {
  if (!Array.isArray(profiles)) return null;
  const normalizedName = String(userName || "").trim();
  if (normalizedName) {
    const byName = profiles.find((profile) => profile?.name === normalizedName);
    if (byName) return byName;
  }
  if (activeId) {
    const byActiveId = profiles.find((profile) => profile?.id === activeId);
    if (byActiveId) return byActiveId;
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

  const trackerByUserData = TRACKER_USER_STORAGE_KEYS.reduce((acc, storageKey) => {
    const byUser = safeParseJson(storageKey, {});
    let state = null;

    for (const profileId of userProfileIds) {
      if (byUser && typeof byUser === "object" && byUser[profileId]) {
        state = byUser[profileId];
        break;
      }
    }

    if (!state && byUser && typeof byUser === "object") {
      const first = Object.values(byUser)[0];
      state = first || null;
    }

    acc[storageKey] = state;
    return acc;
  }, {});

  return {
    userName: userName || "",
    profileLinks: {
      caffeineProfileId: caffeineProfile?.id || null,
      calorieProfileId: calorieProfile?.id || null,
      activeCaffeineProfileId: activeCaffeineProfileId || null,
      activeCalorieProfileId: activeCalorieProfileId || null,
    },
    caffeineTracker: caffeineProfile,
    dailyCalorieIntake: calorieProfile,
    medicationTrackersByUserState: trackerByUserData,
  };
}

const wellnessSection = {
  title: "Wellness",
  description: "Personal health and lifestyle tracking tools",
  tools: [
    {
      path: "/wellness/daily-calorie-intake",
      name: "Daily Calorie Intake Tool",
      label: "Daily Calorie Intake Tool",
      icon: Scale,
      description: "Calculate daily calories and macro targets from height, weight, and daily steps.",
      color: "green",
      category: null,
    },
    {
      path: "/wellness/caffeine-tracker",
      name: "Caffeine Tracker",
      label: "Caffeine Tracker",
      icon: Coffee,
      description: "Track green tea, Earl Grey black tea, and coffee intake using your body weight to estimate active caffeine and adenosine receptor impact.",
      color: "orange",
      category: "Stimulating",
    },
    {
      path: "/wellness/clonazepam-tracker",
      name: "Clonazepam Tracker",
      label: "Clonazepam Tracker",
      icon: Pill,
      description: "Track clonazepam dose timing and estimated active amount over time using a configurable half-life model.",
      color: "purple",
      storageKey: "clonazepamTrackerByUserV1",
      category: "Tranquilizing",
    },
    {
      path: "/wellness/vilazodone-tracker",
      name: "Vilazodone Tracker",
      label: "Vilazodone Tracker",
      icon: Pill,
      description: "Track vilazodone dose timing and estimated active amount over time using a configurable half-life model.",
      color: "blue",
      storageKey: "vilazodoneTrackerByUserV1",
      category: "Modulating / mixed models",
    },
    {
      path: "/wellness/lamotrigine-tracker",
      name: "Lamotrigine Tracker",
      label: "Lamotrigine Tracker",
      icon: Pill,
      description: "Track lamotrigine dose timing and estimated active amount over time using a configurable half-life model.",
      color: "blue",
      storageKey: "lamotrigineTrackerByUserV1",
      category: "Modulating / mixed models",
    },
    {
      path: "/wellness/doxylamine-tracker",
      name: "Doxylamine Tracker",
      label: "Doxylamine Tracker",
      icon: Pill,
      description: "Track doxylamine dose timing and estimated active amount over time using a configurable half-life model.",
      color: "purple",
      storageKey: "doxylamineTrackerByUserV1",
      category: "Tranquilizing",
    },
    {
      path: "/wellness/trazodone-tracker",
      name: "Trazodone Tracker",
      label: "Trazodone Tracker",
      icon: Pill,
      description: "Track trazodone dose timing and estimated active amount over time using a configurable half-life model.",
      color: "purple",
      storageKey: "trazodoneTrackerByUserV1",
      category: "Tranquilizing",
    },
    {
      path: "/wellness/levothyroxine-tracker",
      name: "Levothyroxine Tracker",
      label: "Levothyroxine Tracker",
      icon: Pill,
      description: "Track levothyroxine dose timing and estimated active amount over time using a configurable half-life model.",
      color: "orange",
      storageKey: "levothyroxineTrackerByUserV1",
      category: "Stimulating",
    },
    {
      path: "/wellness/medication-visual-models",
      name: "Medication Visual Models",
      label: "Medication Visual Models",
      icon: Thermometer,
      description: "Animated visual model cards for clonazepam, doxylamine, vilazodone, lamotrigine, trazodone, levothyroxine, and caffeine.",
      color: "fuchsia",
      category: "Combined / visualization models",
    },
    {
      path: "/wellness/medication-mix-model",
      name: "Medication Mix Model",
      label: "Medication Mix Model",
      icon: Thermometer,
      description: "Estimate combined CNS load from clonazepam, doxylamine, vilazodone, lamotrigine, trazodone, levothyroxine, and caffeine using your existing tracker logs.",
      color: "fuchsia",
      category: "Combined / visualization models",
    },
  ],
};

const WELLNESS_TOOL_CATEGORY_ORDER = [
  "Tranquilizing",
  "Stimulating",
  "Modulating / mixed models",
  "Combined / visualization models",
];

const colorClasses = {
  blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  fuchsia: "bg-fuchsia-50 dark:bg-fuchsia-900/20 border-fuchsia-200 dark:border-fuchsia-700 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400",
  green: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400",
  purple: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400",
  orange: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/30 text-orange-600 dark:text-orange-400",
};

const categoryStyles = {
  Tranquilizing: {
    section: "border-purple-200 dark:border-purple-800 bg-purple-50/40 dark:bg-purple-950/15",
    title: "text-purple-900 dark:text-purple-100",
    badge: "border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 bg-purple-100/80 dark:bg-purple-900/40",
  },
  Stimulating: {
    section: "border-orange-200 dark:border-orange-800 bg-orange-50/40 dark:bg-orange-950/15",
    title: "text-orange-900 dark:text-orange-100",
    badge: "border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 bg-orange-100/80 dark:bg-orange-900/40",
  },
  "Modulating / mixed models": {
    section: "border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/15",
    title: "text-blue-900 dark:text-blue-100",
    badge: "border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 bg-blue-100/80 dark:bg-blue-900/40",
  },
  "Combined / visualization models": {
    section: "border-fuchsia-200 dark:border-fuchsia-800 bg-fuchsia-50/40 dark:bg-fuchsia-950/15",
    title: "text-fuchsia-900 dark:text-fuchsia-100",
    badge: "border-fuchsia-300 dark:border-fuchsia-700 text-fuchsia-700 dark:text-fuchsia-300 bg-fuchsia-100/80 dark:bg-fuchsia-900/40",
  },
};

function getEntryTakenAtMs(entry, referenceMs = Date.now()) {
  const explicitMs = Number(entry?.takenAtMs);
  if (Number.isFinite(explicitMs) && explicitMs > 0) return explicitMs;
  if (entry?.takenAtIso) {
    const isoMs = new Date(entry.takenAtIso).getTime();
    if (Number.isFinite(isoMs) && isoMs > 0) return isoMs;
  }
  if (typeof entry?.time === "string" && entry.time.includes("T")) {
    const parsedMs = new Date(entry.time).getTime();
    if (Number.isFinite(parsedMs) && parsedMs > 0) return parsedMs;
  }
  return referenceMs;
}

function getActiveProfileId() {
  const saved = localStorage.getItem(ACTIVE_PROFILE_ID_STORAGE_KEY);
  if (saved) return saved;

  try {
    const profiles = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "[]");
    if (Array.isArray(profiles) && profiles.length > 0 && profiles[0]?.id) {
      return profiles[0].id;
    }
  } catch {
    // no-op
  }

  return "default";
}

function loadEntriesForProfile(storageKey, profileId) {
  try {
    const byUser = JSON.parse(localStorage.getItem(storageKey) || "{}");
    const state = byUser?.[profileId] || {};
    return Array.isArray(state.entries) ? state.entries : [];
  } catch {
    return [];
  }
}

function detectPotentialMissedRepeatedDose(entries, nowMs = Date.now()) {
  if (!Array.isArray(entries) || entries.length < 2) return null;

  const sorted = [...entries]
    .map((entry) => ({ ...entry, ts: getEntryTakenAtMs(entry, nowMs) }))
    .filter((entry) => Number.isFinite(entry.ts) && entry.ts > 0)
    .sort((a, b) => b.ts - a.ts);

  if (sorted.length < 2) return null;

  const latest = sorted[0];
  const latestDose = Number(latest?.doseMg);
  if (!Number.isFinite(latestDose) || latestDose <= 0) return null;

  const sameDose = sorted.filter((entry) => Math.abs((Number(entry?.doseMg) || 0) - latestDose) < 0.001);
  if (sameDose.length < 2) return null;

  const intervalsHours = [];
  for (let i = 0; i < Math.min(sameDose.length - 1, 5); i += 1) {
    const newer = sameDose[i].ts;
    const older = sameDose[i + 1].ts;
    const hours = (newer - older) / (1000 * 60 * 60);
    if (hours >= 6 && hours <= 72) intervalsHours.push(hours);
  }

  if (intervalsHours.length === 0) return null;

  const sortedIntervals = [...intervalsHours].sort((a, b) => a - b);
  const medianIntervalHours = sortedIntervals[Math.floor(sortedIntervals.length / 2)];
  const graceHours = Math.max(2, medianIntervalHours * 0.25);
  const elapsedSinceLatestHours = (nowMs - latest.ts) / (1000 * 60 * 60);
  const overdueByHours = elapsedSinceLatestHours - (medianIntervalHours + graceHours);

  if (overdueByHours <= 0) return null;

  return {
    latestDose,
    elapsedSinceLatestHours,
    expectedIntervalHours: medianIntervalHours,
  };
}

function summarizeMedicationState(storageKey, state) {
  const entries = Array.isArray(state?.entries) ? state.entries : [];
  const latestEntryMs = entries.reduce((maxMs, entry) => {
    const ts = getEntryTakenAtMs(entry, 0);
    if (!Number.isFinite(ts) || ts <= 0) return maxMs;
    return Math.max(maxMs, ts);
  }, 0);

  return {
    tracker: storageKey.replace("TrackerByUserV1", ""),
    entriesCount: entries.length,
    latestEntryAt: latestEntryMs > 0 ? new Date(latestEntryMs).toISOString() : null,
    halfLifeHours: Number.isFinite(Number(state?.halfLifeHours)) ? Number(state.halfLifeHours) : null,
    daysAtCurrentDose: Number.isFinite(Number(state?.daysAtCurrentDose)) ? Number(state.daysAtCurrentDose) : null,
    maintenanceDoseMg: Number.isFinite(Number(state?.maintenanceDoseMg)) ? Number(state.maintenanceDoseMg) : null,
    carryoverCadence: typeof state?.carryoverCadence === "string" ? state.carryoverCadence : null,
  };
}

async function persistAIConfigToBridge(key, value) {
  try {
    await fetch(`/api/settings/${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
  } catch {
    // Ignore bridge persistence errors in browser-only mode.
  }
}

export default function WellnessTools() {
  const [searchQuery, setSearchQuery] = useState("");
  const [globalUserName, setGlobalUserName] = useState(() => {
    return localStorage.getItem(WELLNESS_GLOBAL_USER_NAME_KEY) || "";
  });
  const [savedUsers, setSavedUsers] = useState(() => loadSavedUsers());
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [newUserInput, setNewUserInput] = useState("");
  const [wellnessAiInput, setWellnessAiInput] = useState("");
  const [wellnessAiMessages, setWellnessAiMessages] = useState([]);
  const [wellnessAiBusy, setWellnessAiBusy] = useState(false);
  const [wellnessAiError, setWellnessAiError] = useState("");
  const [wellnessGroqApiKey, setWellnessGroqApiKey] = useState(() => (localStorage.getItem("groqApiKey") || "").trim());
  const [wellnessGroqStatus, setWellnessGroqStatus] = useState("");
  useEffect(() => {
    const syncGroqKeyFromStorage = () => {
      try {
        setWellnessGroqApiKey((localStorage.getItem("groqApiKey") || "").trim());
      } catch {
        // Ignore storage read issues.
      }
    };

    const handleGroqApiKeyUpdate = (event) => {
      const nextKey = typeof event?.detail?.apiKey === "string"
        ? event.detail.apiKey.trim()
        : (localStorage.getItem("groqApiKey") || "").trim();
      setWellnessGroqApiKey(nextKey);
    };

    window.addEventListener("storage", syncGroqKeyFromStorage);
    window.addEventListener("groqApiKeyUpdated", handleGroqApiKeyUpdate);

    return () => {
      window.removeEventListener("storage", syncGroqKeyFromStorage);
      window.removeEventListener("groqApiKeyUpdated", handleGroqApiKeyUpdate);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(WELLNESS_GLOBAL_USER_NAME_KEY, globalUserName);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(WELLNESS_USER_CHANGED_EVENT, {
        detail: { userName: globalUserName },
      }));
    }
  }, [globalUserName]);

  useEffect(() => {
    localStorage.setItem(WELLNESS_SAVED_USERS_KEY, JSON.stringify(savedUsers));
  }, [savedUsers]);

  const doseAlertsByPath = useMemo(() => {
    const activeProfileId = getActiveProfileId();
    const now = Date.now();
    const alerts = {};

    wellnessSection.tools.forEach((tool) => {
      if (!tool.storageKey) return;
      const entries = loadEntriesForProfile(tool.storageKey, activeProfileId);
      const missed = detectPotentialMissedRepeatedDose(entries, now);
      if (!missed) return;

      alerts[tool.path] = `${missed.latestDose} mg looks overdue based on your recent pattern (${Math.round(missed.expectedIntervalHours)}h cadence).`;
    });

    return alerts;
  }, []);

  const alertTools = useMemo(() => {
    return wellnessSection.tools.filter((tool) => Boolean(doseAlertsByPath[tool.path]));
  }, [doseAlertsByPath]);

  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return wellnessSection.tools;
    const query = searchQuery.toLowerCase();
    return wellnessSection.tools.filter((tool) =>
      tool.name.toLowerCase().includes(query) ||
      tool.label.toLowerCase().includes(query) ||
      tool.description.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const groupedFilteredTools = useMemo(() => {
    const ungrouped = filteredTools.filter((tool) => !tool.category);
    const grouped = WELLNESS_TOOL_CATEGORY_ORDER
      .map((category) => ({
        category,
        tools: filteredTools.filter((tool) => tool.category === category),
      }))
      .filter((group) => group.tools.length > 0);

    return { ungrouped, grouped };
  }, [filteredTools]);

  const userSavedDataSnapshot = useMemo(() => {
    return buildUserSavedDataSnapshot(globalUserName);
  }, [globalUserName]);

  const wellnessAiContext = useMemo(() => {
    const caffeineEntries = Array.isArray(userSavedDataSnapshot.caffeineTracker?.entries)
      ? userSavedDataSnapshot.caffeineTracker.entries
      : [];
    const latestCaffeineMs = caffeineEntries.reduce((maxMs, entry) => {
      const ts = getEntryTakenAtMs(entry, 0);
      if (!Number.isFinite(ts) || ts <= 0) return maxMs;
      return Math.max(maxMs, ts);
    }, 0);

    const medicationSummaries = TRACKER_USER_STORAGE_KEYS.map((storageKey) => {
      const state = userSavedDataSnapshot.medicationTrackersByUserState?.[storageKey] || null;
      return summarizeMedicationState(storageKey, state);
    });

    const calorieForm = userSavedDataSnapshot.dailyCalorieIntake?.form || {};

    // ── Caffeine analytics ─────────────────────────────────────────────────
    const caffeineAnalytics = (() => {
      if (!caffeineEntries.length) return null;
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const validEntries = caffeineEntries
        .map((e) => ({ ts: getEntryTakenAtMs(e, now), mg: Number(e.mg || e.caffeineMg || e.caffeineAmount || 0) }))
        .filter((e) => e.ts > 0 && e.mg > 0)
        .sort((a, b) => a.ts - b.ts);

      if (!validEntries.length) return null;

      // Group by calendar day
      const byDay = {};
      validEntries.forEach((e) => {
        const key = new Date(e.ts).toISOString().slice(0, 10);
        byDay[key] = (byDay[key] || 0) + e.mg;
      });
      const dayKeys = Object.keys(byDay).sort();
      const dailyTotals = dayKeys.map((k) => byDay[k]);
      const avgDailyMg = dailyTotals.length ? Number((dailyTotals.reduce((s, v) => s + v, 0) / dailyTotals.length).toFixed(1)) : 0;
      const maxDailyMg = dailyTotals.length ? Math.max(...dailyTotals) : 0;
      const minDailyMg = dailyTotals.length ? Math.min(...dailyTotals) : 0;

      // Consistency: std dev of daily totals (lower = more consistent)
      const meanD = avgDailyMg;
      const stdDev = dailyTotals.length > 1
        ? Number(Math.sqrt(dailyTotals.reduce((s, v) => s + (v - meanD) ** 2, 0) / dailyTotals.length).toFixed(1))
        : 0;
      const cvPercent = meanD > 0 ? Number(((stdDev / meanD) * 100).toFixed(1)) : null;
      const consistencyRating = cvPercent === null ? "unknown" : cvPercent < 15 ? "high" : cvPercent < 35 ? "moderate" : "low";

      // Time-of-day pattern: average hour of first entry per day
      const firstEntryByDay = {};
      validEntries.forEach((e) => {
        const key = new Date(e.ts).toISOString().slice(0, 10);
        if (!firstEntryByDay[key] || e.ts < firstEntryByDay[key]) firstEntryByDay[key] = e.ts;
      });
      const avgFirstHour = (() => {
        const hours = Object.values(firstEntryByDay).map((ts) => new Date(ts).getHours() + new Date(ts).getMinutes() / 60);
        return hours.length ? Number((hours.reduce((s, h) => s + h, 0) / hours.length).toFixed(1)) : null;
      })();

      // Recent 14-day entries
      const fourteenDaysAgo = now - 14 * dayMs;
      const recentEntries = validEntries
        .filter((e) => e.ts >= fourteenDaysAgo)
        .map((e) => ({ takenAt: new Date(e.ts).toISOString(), mg: e.mg }));

      return {
        daysWithData: dayKeys.length,
        avgDailyMg,
        maxDailyMg: Number(maxDailyMg.toFixed(1)),
        minDailyMg: Number(minDailyMg.toFixed(1)),
        stdDevDailyMg: stdDev,
        cvPercent,
        consistencyRating,
        avgFirstCaffeineHour: avgFirstHour,
        recentEntries,
        note: `Average daily caffeine: ${avgDailyMg} mg over ${dayKeys.length} days (consistency: ${consistencyRating}, CV ${cvPercent ?? "?"}%). First caffeine typically around ${avgFirstHour !== null ? `${Math.floor(avgFirstHour)}:${String(Math.round((avgFirstHour % 1) * 60)).padStart(2, "0")}` : "unknown"}.`,
      };
    })();

    // ── Clonazepam detail context ──────────────────────────────────────────
    const clonazepamDetail = (() => {
      const state = userSavedDataSnapshot.medicationTrackersByUserState?.["clonazepamTrackerByUserV1"];
      if (!state) return null;

      const entries = Array.isArray(state.entries) ? state.entries : [];
      const halfLifeHours = Number(state.halfLifeHours) > 0 ? Number(state.halfLifeHours) : 30;
      const maintenanceDoseMg = Number(state.maintenanceDoseMg) || 0;
      const daysAtCurrentDose = Number(state.daysAtCurrentDose) || 0;
      const carryoverCadence = state.carryoverCadence || "once";

      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const fourteenDaysAgo = now - 14 * dayMs;

      // Current active mg
      const currentActiveMg = entries.reduce((sum, entry) => {
        const takenAtMs = getEntryTakenAtMs(entry, now);
        return sum + activeClonazepamAmountAtTime({ doseMg: entry.doseMg, takenAtMs, atMs: now, halfLifeHours });
      }, 0);

      // Daily average activeMg samples over last 14 days (sampled at noon)
      const samples = [];
      for (let d = 0; d < 14; d++) {
        const dayNoon = fourteenDaysAgo + d * dayMs + dayMs / 2;
        if (dayNoon > now) break;
        const avgActiveMg = entries.reduce((sum, entry) => {
          const takenAtMs = getEntryTakenAtMs(entry, now);
          return sum + activeClonazepamAmountAtTime({ doseMg: entry.doseMg, takenAtMs, atMs: dayNoon, halfLifeHours });
        }, 0);
        samples.push({ date: new Date(dayNoon).toISOString().slice(0, 10), avgActiveMg: Number(avgActiveMg.toFixed(3)) });
      }

      // Linear regression trend slope (mg/day)
      let trendSlopeMgPerDay = 0;
      if (samples.length >= 2) {
        const n = samples.length;
        const tsValues = samples.map((_, i) => i); // day index as x
        const mgValues = samples.map((s) => s.avgActiveMg);
        const meanX = (n - 1) / 2;
        const meanMg = mgValues.reduce((s, v) => s + v, 0) / n;
        const num = tsValues.reduce((s, x, i) => s + (x - meanX) * (mgValues[i] - meanMg), 0);
        const den = tsValues.reduce((s, x) => s + (x - meanX) ** 2, 0);
        trendSlopeMgPerDay = den !== 0 ? num / den : 0;
      }
      const trendDirection = trendSlopeMgPerDay > 0.002 ? "increasing" : trendSlopeMgPerDay < -0.002 ? "decreasing" : "stable";

      // Recent dose log (last 14 days)
      const recentDoses = entries
        .filter((e) => getEntryTakenAtMs(e, now) >= fourteenDaysAgo)
        .sort((a, b) => getEntryTakenAtMs(a, now) - getEntryTakenAtMs(b, now))
        .map((e) => ({
          takenAt: new Date(getEntryTakenAtMs(e, now)).toISOString(),
          doseMg: e.doseMg,
          note: e.note || null,
        }));

      // Taper settings from localStorage
      const taperStartDate = localStorage.getItem("clonazepamTaperStartDateV1") || "";
      const taperStepMg = Number(localStorage.getItem("clonazepamTaperStepMgV1")) || 0.125;
      const taperHoldDays = Number(localStorage.getItem("clonazepamTaperHoldDaysV1")) || 14;
      const taperMinimumDoseMg = Number(localStorage.getItem("clonazepamTaperMinimumDoseMgV1")) || 0.125;

      // Compute taper schedule rows
      const taperScheduleRows = [];
      const startDose = maintenanceDoseMg;
      if (startDose > 0 && taperStepMg > 0 && taperStartDate) {
        const parsedStartMs = new Date(taperStartDate).getTime();
        const effectiveStartMs = Number.isFinite(parsedStartMs) && parsedStartMs > 0 ? parsedStartMs : now;
        let currentDose = startDose > taperMinimumDoseMg
          ? Math.max(0, startDose - taperStepMg) < taperMinimumDoseMg ? taperMinimumDoseMg : Math.max(0, startDose - taperStepMg)
          : startDose;
        let stepStartMs = effectiveStartMs;
        const maxSteps = 60;
        while (currentDose > 0 && taperScheduleRows.length < maxSteps) {
          const roundedDose = Number(currentDose.toFixed(3));
          const stepEndMs = stepStartMs + taperHoldDays * dayMs;
          taperScheduleRows.push({
            step: taperScheduleRows.length + 1,
            doseMg: roundedDose,
            start: new Date(stepStartMs).toISOString().slice(0, 10),
            end: new Date(stepEndMs).toISOString().slice(0, 10),
            holdDays: taperHoldDays,
          });
          if (roundedDose <= taperMinimumDoseMg) break;
          const nextDose = Math.max(0, roundedDose - taperStepMg);
          currentDose = nextDose < taperMinimumDoseMg ? taperMinimumDoseMg : nextDose;
          if (Number(currentDose.toFixed(3)) === roundedDose) break;
          stepStartMs = stepEndMs;
        }
      }

      return {
        currentActiveMg: Number(currentActiveMg.toFixed(3)),
        halfLifeHours,
        maintenanceDoseMg,
        daysAtCurrentDose,
        carryoverCadence,
        trendSlopeMgPerDay: Number(trendSlopeMgPerDay.toFixed(5)),
        trendDirection,
        trendInterpretation: `Over the last ${samples.length} days, estimated active clonazepam is ${trendDirection} at ${Math.abs(trendSlopeMgPerDay).toFixed(4)} mg/day.`,
        dailySamples: samples,
        recentDoses,
        taper: {
          startDate: taperStartDate || null,
          startDoseMg: startDose,
          stepMg: taperStepMg,
          holdDays: taperHoldDays,
          minimumDoseMg: taperMinimumDoseMg,
          totalSteps: taperScheduleRows.length,
          projectedEndDate: taperScheduleRows.length ? taperScheduleRows[taperScheduleRows.length - 1].end : null,
          schedule: taperScheduleRows,
        },
      };
    })();

    return {
      userName: userSavedDataSnapshot.userName || "",
      generatedAt: new Date().toISOString(),
      caffeineTracker: {
        entriesCount: caffeineEntries.length,
        latestEntryAt: latestCaffeineMs > 0 ? new Date(latestCaffeineMs).toISOString() : null,
        weight: Number.isFinite(Number(userSavedDataSnapshot.caffeineTracker?.weight))
          ? Number(userSavedDataSnapshot.caffeineTracker.weight)
          : null,
        weightUnit: userSavedDataSnapshot.caffeineTracker?.weightUnit || null,
        halfLifeHours: Number.isFinite(Number(userSavedDataSnapshot.caffeineTracker?.halfLifeHours))
          ? Number(userSavedDataSnapshot.caffeineTracker.halfLifeHours)
          : null,
      },
      dailyCalorieIntake: {
        unitSystem: calorieForm.unitSystem || null,
        weight: Number.isFinite(Number(calorieForm.weight)) ? Number(calorieForm.weight) : null,
        steps: Number.isFinite(Number(calorieForm.steps)) ? Number(calorieForm.steps) : null,
        goal: calorieForm.goal || null,
        currentCalories: Number.isFinite(Number(calorieForm.currentCalories)) ? Number(calorieForm.currentCalories) : null,
      },
      medicationTrackers: medicationSummaries,
      clonazepamDetail,
      caffeineAnalytics,
      doseReminders: Object.entries(doseAlertsByPath).map(([path, detail]) => ({ path, detail })),
    };
  }, [userSavedDataSnapshot, doseAlertsByPath]);

  const clearWellnessAiChat = () => {
    setWellnessAiMessages([]);
    setWellnessAiError("");
  };

  const saveWellnessGroqApiKey = async () => {
    const trimmedKey = wellnessGroqApiKey.trim();
    setWellnessGroqStatus("");

    try {
      if (trimmedKey) {
        localStorage.setItem("groqApiKey", trimmedKey);
        localStorage.setItem("aiProvider", "groq");
        await Promise.all([
          persistAIConfigToBridge("groqApiKey", trimmedKey),
          persistAIConfigToBridge("aiProvider", "groq"),
        ]);
        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(new CustomEvent("groqApiKeyUpdated", { detail: { apiKey: trimmedKey } }));
        setWellnessGroqStatus("Groq API key saved. Settings will reflect the update.");
      } else {
        localStorage.removeItem("groqApiKey");
        await persistAIConfigToBridge("groqApiKey", "");
        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(new CustomEvent("groqApiKeyUpdated", { detail: { apiKey: "" } }));
        setWellnessGroqStatus("Groq API key cleared.");
      }
    } catch {
      setWellnessGroqStatus("Unable to save the Groq API key right now.");
    }
  };

  const sendWellnessAiMessage = async (promptOverride = "") => {
    const prompt = String(promptOverride || wellnessAiInput).trim();
    if (!prompt || wellnessAiBusy) return;

    const groqApiKey = (localStorage.getItem("groqApiKey") || import.meta.env?.VITE_GROQ_API_KEY || "").trim();
    if (!groqApiKey) {
      setWellnessAiError("Groq API key not found. Add it in Settings/Onboarding first.");
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: "user",
      content: prompt,
    };

    const nextHistory = [...wellnessAiMessages, userMessage].slice(-8);
    setWellnessAiMessages((prev) => [...prev, userMessage]);
    if (!promptOverride) {
      setWellnessAiInput("");
    }
    setWellnessAiBusy(true);
    setWellnessAiError("");

    try {
      const model = (localStorage.getItem("groqModel") || DEFAULT_GROQ_MODEL).trim() || DEFAULT_GROQ_MODEL;
      const contextJson = JSON.stringify(wellnessAiContext);

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: "You are a wellness assistant inside Joule Wellness Hub. Use ONLY the provided user context JSON to answer. Be concise and actionable: when patterns or trends are visible in the data, offer specific, practical suggestions (e.g. target dose timing, caffeine mg adjustments, consistency improvements). Clearly separate observations from suggestions. Always include a safety note that this is not medical advice and important decisions should be made with a clinician. The context includes a `clonazepamDetail` field with: currentActiveMg, trendSlopeMgPerDay, trendDirection, trendInterpretation, dailySamples, recentDoses, and taper (startDate, stepMg, holdDays, minimumDoseMg, schedule). It also includes a `caffeineAnalytics` field with: avgDailyMg, consistencyRating, cvPercent, avgFirstCaffeineHour, and recentEntries. Use these to give specific advice about dose timing consistency, caffeine reduction strategies in the context of the taper, and whether the active level trend is on track with the taper plan.",
            },
            {
              role: "system",
              content: `Current user context JSON:\n${contextJson}`,
            },
            ...nextHistory.map((message) => ({
              role: message.role,
              content: message.content,
            })),
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API error ${response.status}: ${errorText.slice(0, 200)}`);
      }

      const payload = await response.json();
      const content = String(payload?.choices?.[0]?.message?.content || "").trim();
      if (!content) {
        throw new Error("The AI assistant returned an empty response.");
      }

      setWellnessAiMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: "assistant",
          content,
        },
      ]);
    } catch (error) {
      setWellnessAiError(error?.message || "Failed to get an AI response.");
    } finally {
      setWellnessAiBusy(false);
    }
  };

  

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
          <div className="flex items-center gap-2">
            <Heart className="w-7 h-7 text-fuchsia-600 dark:text-fuchsia-400" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Wellness Hub</h1>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowUserPanel((p) => !p)}
              className="px-4 py-2 text-sm border border-fuchsia-500/40 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-800 dark:text-fuchsia-100 rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <span className="font-medium">Login &amp; Sync</span>
              {globalUserName && (
                <span className="rounded-full border border-fuchsia-300/40 bg-fuchsia-500/20 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-800 dark:text-fuchsia-50">
                  {globalUserName}
                </span>
              )}
            </button>
            {showUserPanel && (
              <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-fuchsia-300 dark:border-fuchsia-800 bg-white dark:bg-gray-900 shadow-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-fuchsia-800 dark:text-fuchsia-200">
                  {globalUserName ? `Active: ${globalUserName}` : "No active user"}
                </p>
                {savedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {savedUsers.map((name) => (
                      <div key={name} className={`flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs border ${globalUserName === name ? "bg-fuchsia-600 text-white border-fuchsia-500" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"}`}>
                        <button type="button" onClick={() => { setGlobalUserName(name); setShowUserPanel(false); }} className="font-medium">{name}</button>
                        <button type="button" onClick={() => setSavedUsers((u) => u.filter((n) => n !== name))} className="ml-0.5 hover:text-red-500">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newUserInput}
                    onChange={(e) => setNewUserInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newUserInput.trim()) {
                        const name = sanitizeUserName(newUserInput);
                        if (name && !savedUsers.includes(name)) setSavedUsers((u) => [...u, name]);
                        setGlobalUserName(name);
                        setNewUserInput("");
                        setShowUserPanel(false);
                      }
                    }}
                    placeholder="Add / switch user…"
                    className="flex-1 px-2 py-1.5 text-sm rounded border border-fuchsia-300 dark:border-fuchsia-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const name = sanitizeUserName(newUserInput);
                      if (!name) return;
                      if (!savedUsers.includes(name)) setSavedUsers((u) => [...u, name]);
                      setGlobalUserName(name);
                      setNewUserInput("");
                      setShowUserPanel(false);
                    }}
                    className="px-3 py-1.5 rounded bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-sm font-medium"
                  >
                    Set
                  </button>
                </div>
                <p className="text-xs text-gray-400">Full sync controls on <Link to="/home" className="underline text-fuchsia-600 dark:text-fuchsia-400">Mission Control</Link>.</p>
                <div className="border-t border-fuchsia-100 dark:border-fuchsia-900 pt-3 space-y-2">
                  <p className="text-xs font-semibold text-fuchsia-700 dark:text-fuchsia-300">Export &amp; Sync</p>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const allKeys = Object.keys(localStorage);
                        const hvacKeys = allKeys.filter((k) =>
                          k.startsWith("userSetting") || k.startsWith("onboarding") ||
                          k.startsWith("hvac") || k === "squareFeet" || k === "insulationLevel" ||
                          k === "primarySystem" || k === "heatPumpTons" || k === "furnaceSizeKbtu" ||
                          k === "afue" || k === "acTons" || k === "daytimeTemp" || k === "nightTemp" ||
                          k.startsWith("analysis") || k.startsWith("bill")
                        );
                        const wellnessKeys = allKeys.filter((k) =>
                          k.startsWith("wellness") || k.startsWith("caffeine") || k.startsWith("calorie") ||
                          k.startsWith("clonazepam") || k.startsWith("taper") || k.startsWith("medication")
                        );
                        const snapshot = {
                          exportedAt: new Date().toISOString(),
                          user: globalUserName || "unknown",
                          todo: (() => { try { return JSON.parse(localStorage.getItem("toolsToDoV1") || "[]"); } catch { return []; } })(),
                          hvacOnboarding: Object.fromEntries(hvacKeys.map((k) => [k, (() => { try { return JSON.parse(localStorage.getItem(k)); } catch { return localStorage.getItem(k); } })()])),
                          wellness: Object.fromEntries(wellnessKeys.map((k) => [k, (() => { try { return JSON.parse(localStorage.getItem(k)); } catch { return localStorage.getItem(k); } })()])),
                          groqModel: localStorage.getItem("groqModel") || "llama-3.3-70b-versatile",
                        };
                        const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `joule-data-${globalUserName || "export"}-${new Date().toISOString().slice(0, 10)}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch (err) {
                        alert("Export failed: " + (err?.message || "unknown error"));
                      }
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg bg-fuchsia-50 dark:bg-fuchsia-900/20 border border-fuchsia-200 dark:border-fuchsia-700 text-xs text-fuchsia-800 dark:text-fuchsia-200 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/40 transition-colors"
                  >
                    ⬇ Download all data as JSON
                    <span className="block text-[10px] text-fuchsia-500 dark:text-fuchsia-400 mt-0.5">Includes todo, HVAC onboarding, wellness, and tracker data</span>
                  </button>
                  <label className="block">
                    <span className="text-xs text-fuchsia-700 dark:text-fuchsia-300 block mb-1">⬆ Restore from JSON backup</span>
                    <input
                      type="file"
                      accept=".json"
                      className="text-xs text-gray-600 dark:text-gray-400 w-full"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          try {
                            const data = JSON.parse(ev.target.result);
                            let count = 0;
                            if (data.todo) { localStorage.setItem("toolsToDoV1", JSON.stringify(data.todo)); count++; }
                            if (data.hvacOnboarding) { Object.entries(data.hvacOnboarding).forEach(([k, v]) => { localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v)); count++; }); }
                            if (data.wellness) { Object.entries(data.wellness).forEach(([k, v]) => { localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v)); count++; }); }
                            alert(`Restored ${count} items. Reload the page to apply.`);
                            e.target.value = "";
                          } catch (err) { alert("Restore failed: " + (err?.message || "invalid JSON")); }
                        };
                        reader.readAsText(file);
                      }}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
        <p className="text-gray-600 dark:text-gray-400">Medication and caffeine tracking, interaction modeling, and wellness visualizations.</p>
      </div>

      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search wellness tools by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Clear search"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        {searchQuery && filteredTools.length === 0 && (
          <p className="text-gray-600 dark:text-gray-400 mt-4 text-center">
            No wellness tools found matching "{searchQuery}".
          </p>
        )}
      </div>

      {alertTools.length > 0 && (
        <div className="mb-6 rounded-lg border border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 p-4">
          <h2 className="text-base font-semibold text-orange-800 dark:text-orange-200 mb-2">Dose reminders</h2>
          <ul className="space-y-2">
            {alertTools.map((tool) => (
              <li key={`alert-${tool.path}`} className="text-sm text-orange-900 dark:text-orange-100">
                <Link to={tool.path} className="underline decoration-orange-500 underline-offset-2 hover:text-orange-700 dark:hover:text-orange-200">
                  {tool.label}
                </Link>
                : {doseAlertsByPath[tool.path]}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4">
        <h2 className="text-2xl font-semibold mb-1 text-gray-900 dark:text-white">{wellnessSection.title}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">{wellnessSection.description}</p>
      </div>

      {groupedFilteredTools.ungrouped.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {groupedFilteredTools.ungrouped.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.path}
                to={tool.path}
                className={`block rounded-lg border p-6 transition-all hover:shadow-lg ${colorClasses[tool.color]}`}
                title={tool.description}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg border bg-white dark:bg-gray-800 ${colorClasses[tool.color].split(" ")[0]}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">{tool.label}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{tool.description}</p>
                    {doseAlertsByPath[tool.path] && (
                      <p className="mt-2 text-sm font-medium text-orange-700 dark:text-orange-300">
                        Dose reminder: {doseAlertsByPath[tool.path]}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="space-y-8">
        {groupedFilteredTools.grouped.map((group) => (
          <section key={group.category} className={`space-y-4 rounded-xl border p-4 ${categoryStyles[group.category]?.section || "border-gray-200 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-900/20"}`}>
            <div className="flex items-center gap-3">
              <h3 className={`text-lg font-semibold ${categoryStyles[group.category]?.title || "text-gray-900 dark:text-white"}`}>{group.category}</h3>
              <span className={`text-xs px-2 py-1 rounded-full border ${categoryStyles[group.category]?.badge || "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900"}`}>
                {group.tools.length} tool{group.tools.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {group.tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.path}
                    to={tool.path}
                    className={`block rounded-lg border p-6 transition-all hover:shadow-lg ${colorClasses[tool.color]}`}
                    title={tool.description}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg border bg-white dark:bg-gray-800 ${colorClasses[tool.color].split(" ")[0]}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">{tool.label}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{tool.description}</p>
                        {doseAlertsByPath[tool.path] && (
                          <p className="mt-2 text-sm font-medium text-orange-700 dark:text-orange-300">
                            Dose reminder: {doseAlertsByPath[tool.path]}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-10 rounded-lg border border-fuchsia-200 dark:border-fuchsia-800 bg-fuchsia-50/50 dark:bg-fuchsia-950/20 p-4 space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">AI Wellness Chat</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Ask questions about the active user&apos;s tracker data. Responses are grounded in this page&apos;s current user snapshot.
          </p>
          <p className="text-xs text-fuchsia-700 dark:text-fuchsia-300 mt-1">
            Active user context: <strong>{wellnessAiContext.userName || "No active user"}</strong> · {wellnessAiContext.medicationTrackers.filter((item) => item.entriesCount > 0).length} trackers with entries · {wellnessAiContext.caffeineTracker.entriesCount} caffeine entries.
          </p>
        </div>

        {wellnessAiError && (
          <p className="text-xs text-red-700 dark:text-red-300">{wellnessAiError}</p>
        )}

        <div className="rounded-lg border border-fuchsia-200 dark:border-fuchsia-800 bg-white dark:bg-gray-900 p-3 h-72 overflow-y-auto space-y-3">
          {wellnessAiMessages.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Try: <em>"How consistent is my clonazepam dosing?"</em>, <em>"How does my caffeine intake interact with my taper?"</em>, or <em>"What trends should I discuss with my clinician?"</em>
            </p>
          ) : (
            wellnessAiMessages.map((message) => (
              <div
                key={message.id}
                className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${message.role === "assistant"
                  ? "bg-fuchsia-100/70 dark:bg-fuchsia-900/30 text-gray-900 dark:text-gray-100"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"}`}
              >
                <p className="text-[11px] uppercase tracking-wide font-semibold mb-1 text-fuchsia-700 dark:text-fuchsia-300">
                  {message.role === "assistant" ? "Assistant" : "You"}
                </p>
                <p>{message.content}</p>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2">
          <div className="rounded-lg border border-fuchsia-200 dark:border-fuchsia-800 bg-white dark:bg-gray-900 p-3 space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <label className="flex-1 min-w-[240px] space-y-1">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Groq API key</span>
                <input
                  type="password"
                  value={wellnessGroqApiKey}
                  onChange={(event) => {
                    setWellnessGroqApiKey(event.target.value);
                    setWellnessGroqStatus("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      saveWellnessGroqApiKey();
                    }
                  }}
                  placeholder="Paste your Groq API key here"
                  className="w-full px-3 py-2 rounded-lg border border-fuchsia-300 dark:border-fuchsia-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={saveWellnessGroqApiKey}
                className="px-3 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-sm font-medium"
              >
                Save key
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Saving here updates the same Groq key used by Settings and other AI-powered features.
            </p>
            {wellnessGroqStatus && (
              <p className="text-xs text-fuchsia-700 dark:text-fuchsia-300">{wellnessGroqStatus}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {WELLNESS_AI_QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={wellnessAiBusy}
                onClick={() => sendWellnessAiMessage(prompt)}
                className="px-2.5 py-1.5 rounded-full border border-fuchsia-300 dark:border-fuchsia-700 text-fuchsia-700 dark:text-fuchsia-300 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/20 text-xs font-medium disabled:opacity-50"
                title={prompt}
              >
                {prompt}
              </button>
            ))}
          </div>
          <textarea
            value={wellnessAiInput}
            onChange={(event) => setWellnessAiInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendWellnessAiMessage();
              }
            }}
            placeholder="Ask about this user's wellness trends, reminders, and tracker summaries..."
            className="w-full min-h-[92px] px-3 py-2 rounded-lg border border-fuchsia-300 dark:border-fuchsia-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 text-sm"
            disabled={wellnessAiBusy}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={sendWellnessAiMessage}
              disabled={wellnessAiBusy || !wellnessAiInput.trim()}
              className="px-3 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white text-sm font-medium"
            >
              {wellnessAiBusy ? "Thinking..." : "Send"}
            </button>
            <button
              type="button"
              onClick={clearWellnessAiChat}
              disabled={wellnessAiBusy || wellnessAiMessages.length === 0}
              className="px-3 py-2 rounded-lg border border-fuchsia-300 dark:border-fuchsia-700 text-fuchsia-700 dark:text-fuchsia-300 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/20 text-sm font-medium disabled:opacity-50"
            >
              Clear chat
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noreferrer"
              className="text-fuchsia-700 dark:text-fuchsia-300 hover:underline"
            >
              Get a Groq API key.
            </a>{" "}
            AI responses are informational only and not medical advice.
          </p>
        </div>
      </div>

      {/* ── Find a Therapist ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/30 dark:bg-teal-950/10 p-4 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🩺</span>
          <div>
            <h2 className="font-semibold text-teal-900 dark:text-teal-100 text-lg">Find a Therapist</h2>
            <p className="text-sm text-teal-700 dark:text-teal-300">Find mental health support covered under your ACA Marketplace or employer insurance plan.</p>
          </div>
        </div>

        <div className="rounded-lg bg-teal-100/60 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-700 p-3 space-y-1 text-sm text-teal-800 dark:text-teal-200">
          <p className="font-semibold">Quick steps to find in-network therapy under ACA plans:</p>
          <ol className="list-decimal list-inside space-y-0.5 text-xs">
            <li>Log in to your insurance portal (included in the links below by insurer).</li>
            <li>Search for <strong>mental health / behavioral health</strong> providers in your ZIP code.</li>
            <li>Filter by specialty: <em>anxiety, depression, trauma, substance use, benzo tapering</em>.</li>
            <li>Confirm they accept your plan tier (Bronze/Silver/Gold) before booking.</li>
            <li>ACA plans are required to cover mental health services at parity with medical services (Mental Health Parity Act).</li>
          </ol>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              name: "MDLive (Telehealth)",
              desc: "Accepts most major ACA plans. Therapy, psychiatry, and medication management available online same-day.",
              url: "https://www.mdlive.com/",
              tag: "Telehealth · Same-day",
              color: "blue",
            },
            {
              name: "SAMHSA National Helpline",
              desc: "Free, confidential, 24/7 treatment referral. Call 1-800-662-4357 or search the national locator.",
              url: "https://findtreatment.gov/",
              tag: "Free · 24/7",
              color: "green",
            },
            {
              name: "Psychology Today Therapist Finder",
              desc: "Filter by insurance, specialty (anxiety, benzo taper, withdrawal), and in-person or telehealth.",
              url: "https://www.psychologytoday.com/us/therapists",
              tag: "Insurance filter",
              color: "purple",
            },
            {
              name: "Open Path Collective",
              desc: "Sliding scale $30–$80/session for uninsured or underinsured. Many therapists specialize in anxiety.",
              url: "https://openpathcollective.org/",
              tag: "Sliding scale",
              color: "orange",
            },
            {
              name: "HealthCare.gov Plan Finder",
              desc: "Find or compare ACA Marketplace plans that include mental health coverage in your state.",
              url: "https://www.healthcare.gov/see-plans/",
              tag: "ACA Marketplace",
              color: "sky",
            },
            {
              name: "NAMI Help Line",
              desc: "National Alliance on Mental Illness. Call 1-800-950-6264 or text 'NAMI' to 741741 for crisis support.",
              url: "https://www.nami.org/help",
              tag: "Crisis support",
              color: "red",
            },
            {
              name: "In Crisis? Text or Call 988",
              desc: "Suicide & Crisis Lifeline. Call or text 988 anytime. Free, confidential, available 24/7.",
              url: "https://988lifeline.org/",
              tag: "Crisis · 988",
              color: "red",
            },
            {
              name: "Zocdoc (Insurance Search)",
              desc: "Book in-person or telehealth therapists filtered by your specific insurance plan and availability.",
              url: "https://www.zocdoc.com/search/?reason_visit=Mental+health&insurance_carrier=",
              tag: "Book online",
              color: "teal",
            },
          ].map(({ name, desc, url, tag, color }) => {
            const colorMap = {
              blue: "border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20",
              green: "border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20",
              purple: "border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20",
              orange: "border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20",
              sky: "border-sky-200 dark:border-sky-700 bg-sky-50 dark:bg-sky-900/20",
              red: "border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20",
              teal: "border-teal-200 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/20",
            };
            const tagMap = {
              blue: "bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200",
              green: "bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200",
              purple: "bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-200",
              orange: "bg-orange-100 dark:bg-orange-800 text-orange-700 dark:text-orange-200",
              sky: "bg-sky-100 dark:bg-sky-800 text-sky-700 dark:text-sky-200",
              red: "bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200",
              teal: "bg-teal-100 dark:bg-teal-800 text-teal-700 dark:text-teal-200",
            };
            return (
              <a key={name} href={url} target="_blank" rel="noreferrer" className={`block rounded-lg border p-3 hover:shadow-md transition-shadow ${colorMap[color]}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-semibold text-sm text-gray-900 dark:text-white">{name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${tagMap[color]}`}>{tag}</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">{desc}</p>
              </a>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          This is a curated list of public resources — not a medical referral. Verify coverage with your insurer before booking. If you are in crisis, call or text <strong>988</strong>.
        </p>
      </div>
      
    </div>
  );
}
