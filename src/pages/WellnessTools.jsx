import React, { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, X, Coffee, Pill, Thermometer, Heart, Scale, Trash2 } from "lucide-react";

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
              content: "You are a wellness assistant inside Joule Wellness Hub. Use ONLY the provided user context JSON to answer. Be concise, clearly separate observations from suggestions, and include a safety note that this is not medical advice.",
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
        <div className="flex items-center gap-2 mb-2">
          <Heart className="w-7 h-7 text-fuchsia-600 dark:text-fuchsia-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Wellness Hub</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">Medication and caffeine tracking, interaction modeling, and wellness visualizations.</p>
      </div>

      <div className="mb-6 rounded-lg border border-fuchsia-200 dark:border-fuchsia-800 bg-fuchsia-50/50 dark:bg-fuchsia-950/20 p-3">
        <p className="text-sm text-fuchsia-800 dark:text-fuchsia-200">
          Wellness user management is now global on the dashboard.
          <Link to="/" className="ml-1 underline decoration-fuchsia-400 underline-offset-2 hover:text-fuchsia-600 dark:hover:text-fuchsia-100">
            Open Mission Control
          </Link>
          {" "}
          to set the active user and view saved data.
        </p>
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
              Try: "Summarize my current wellness snapshot", "Which tracker looks most active this week?", or "What trends should I discuss with my clinician?"
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
      
    </div>
  );
}
