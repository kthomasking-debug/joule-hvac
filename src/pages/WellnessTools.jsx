import React, { useMemo, useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Search, X, Coffee, Pill, Thermometer, Heart, Scale, UserPlus, Trash2 } from "lucide-react";

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

const WELLNESS_EXPORT_VERSION = 1;
const WELLNESS_CLOUD_SYNC_ENABLED_KEY = "wellnessCloudSyncEnabledV1";
const WELLNESS_CLOUD_SYNC_SECRET_KEY = "wellnessCloudSyncSecretV1";
const WELLNESS_CLOUD_SYNC_ENDPOINT = "/.netlify/functions/wellness-sync";
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

function uniqueNonEmptyStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(sanitizeUserName).filter(Boolean)));
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

function buildWellnessExportPayload({ savedUsers, globalUserName }) {
  const userNames = uniqueNonEmptyStrings([...savedUsers, globalUserName]);
  return {
    type: "joule-wellness-export",
    version: WELLNESS_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    activeUserName: sanitizeUserName(globalUserName),
    savedUsers: uniqueNonEmptyStrings(savedUsers),
    users: userNames.map((userName) => buildUserSavedDataSnapshot(userName)),
  };
}

function hasMeaningfulWellnessData() {
  const savedUsers = loadSavedUsers();
  const globalUserName = sanitizeUserName(localStorage.getItem(WELLNESS_GLOBAL_USER_NAME_KEY) || "");
  const caffeineProfiles = safeParseJson(PROFILE_STORAGE_KEY, []);
  const calorieProfiles = safeParseJson(CALORIE_PROFILES_STORAGE_KEY, []);

  if (savedUsers.length > 0 || globalUserName) return true;

  const hasCaffeineData = Array.isArray(caffeineProfiles) && caffeineProfiles.some((profile) => {
    return sanitizeUserName(profile?.name) || (Array.isArray(profile?.entries) && profile.entries.length > 0);
  });
  if (hasCaffeineData) return true;

  const hasCalorieData = Array.isArray(calorieProfiles) && calorieProfiles.some((profile) => {
    return sanitizeUserName(profile?.name)
      || (Array.isArray(profile?.weightHistory) && profile.weightHistory.length > 0)
      || (Array.isArray(profile?.mealLog) && profile.mealLog.length > 0);
  });
  if (hasCalorieData) return true;

  return TRACKER_USER_STORAGE_KEYS.some((storageKey) => {
    const trackerMap = safeParseJson(storageKey, {});
    return Object.values(trackerMap || {}).some((state) => {
      return Array.isArray(state?.entries) && state.entries.length > 0;
    });
  });
}

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

async function pullWellnessFromCloud(syncKey) {
  const response = await fetch(WELLNESS_CLOUD_SYNC_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "pull",
      syncKey,
    }),
  });

  if (response.status === 404) {
    return { found: false, payload: null };
  }

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error || "Could not restore cloud data.");
  }

  return body;
}

async function pushWellnessToCloud(syncKey, payload) {
  const response = await fetch(WELLNESS_CLOUD_SYNC_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "push",
      syncKey,
      payload,
    }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error || "Could not sync cloud data.");
  }

  return body;
}

function importWellnessPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Import file is not valid JSON data.");
  }

  if (payload.type !== "joule-wellness-export") {
    throw new Error("Import file is not a wellness export.");
  }

  const importedUsers = Array.isArray(payload.users) ? payload.users : [];
  if (!importedUsers.length) {
    throw new Error("Import file does not contain any users.");
  }

  const existingCaffeineProfiles = safeParseJson(PROFILE_STORAGE_KEY, []);
  const existingCalorieProfiles = safeParseJson(CALORIE_PROFILES_STORAGE_KEY, []);
  const trackerMaps = TRACKER_USER_STORAGE_KEYS.reduce((acc, storageKey) => {
    acc[storageKey] = safeParseJson(storageKey, {});
    return acc;
  }, {});

  const nextCaffeineProfiles = Array.isArray(existingCaffeineProfiles) ? [...existingCaffeineProfiles] : [];
  const nextCalorieProfiles = Array.isArray(existingCalorieProfiles) ? [...existingCalorieProfiles] : [];
  const nextSavedUsers = uniqueNonEmptyStrings([...(safeParseJson(WELLNESS_SAVED_USERS_KEY, [])), ...(payload.savedUsers || []), ...importedUsers.map((user) => user?.userName)]);

  let lastImportedCaffeineProfileId = "";
  let lastImportedCalorieProfileId = "";

  for (const importedUser of importedUsers) {
    const userName = sanitizeUserName(importedUser?.userName);
    if (!userName) continue;

    const filteredCaffeineProfiles = nextCaffeineProfiles.filter((profile) => sanitizeUserName(profile?.name) !== userName);
    const filteredCalorieProfiles = nextCalorieProfiles.filter((profile) => sanitizeUserName(profile?.name) !== userName);

    nextCaffeineProfiles.length = 0;
    nextCaffeineProfiles.push(...filteredCaffeineProfiles);
    nextCalorieProfiles.length = 0;
    nextCalorieProfiles.push(...filteredCalorieProfiles);

    const caffeineProfile = createImportedCaffeineProfile(userName, importedUser?.caffeineTracker);
    const calorieProfile = createImportedCalorieProfile(userName, importedUser?.dailyCalorieIntake);

    nextCaffeineProfiles.push(caffeineProfile);
    nextCalorieProfiles.push(calorieProfile);

    for (const storageKey of TRACKER_USER_STORAGE_KEYS) {
      const currentMap = trackerMaps[storageKey] && typeof trackerMaps[storageKey] === "object" ? trackerMaps[storageKey] : {};
      const nextMap = { ...currentMap };

      delete nextMap[caffeineProfile.id];
      delete nextMap[calorieProfile.id];

      const importedState = importedUser?.medicationTrackersByUserState?.[storageKey];
      if (importedState && typeof importedState === "object") {
        nextMap[caffeineProfile.id] = importedState;
        nextMap[calorieProfile.id] = importedState;
      }

      trackerMaps[storageKey] = nextMap;
    }

    lastImportedCaffeineProfileId = caffeineProfile.id;
    lastImportedCalorieProfileId = calorieProfile.id;
  }

  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(nextCaffeineProfiles));
  localStorage.setItem(CALORIE_PROFILES_STORAGE_KEY, JSON.stringify(nextCalorieProfiles));
  for (const storageKey of TRACKER_USER_STORAGE_KEYS) {
    localStorage.setItem(storageKey, JSON.stringify(trackerMaps[storageKey] || {}));
  }

  localStorage.setItem(WELLNESS_SAVED_USERS_KEY, JSON.stringify(nextSavedUsers));

  const activeUserName = sanitizeUserName(payload.activeUserName) || sanitizeUserName(importedUsers[0]?.userName);
  localStorage.setItem(WELLNESS_GLOBAL_USER_NAME_KEY, activeUserName);
  if (lastImportedCaffeineProfileId) {
    localStorage.setItem(ACTIVE_PROFILE_ID_STORAGE_KEY, lastImportedCaffeineProfileId);
  }
  if (lastImportedCalorieProfileId) {
    localStorage.setItem(CALORIE_ACTIVE_PROFILE_STORAGE_KEY, lastImportedCalorieProfileId);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(WELLNESS_USER_CHANGED_EVENT, {
      detail: { userName: activeUserName },
    }));
    window.dispatchEvent(new Event("storage"));
  }

  return {
    savedUsers: nextSavedUsers,
    activeUserName,
    importedUserCount: importedUsers.length,
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
    },
    {
      path: "/wellness/caffeine-tracker",
      name: "Caffeine Tracker",
      label: "Caffeine Tracker",
      icon: Coffee,
      description: "Track green tea, Earl Grey black tea, and coffee intake using your body weight to estimate active caffeine and adenosine receptor impact.",
      color: "green",
    },
    {
      path: "/wellness/clonazepam-tracker",
      name: "Clonazepam Tracker",
      label: "Clonazepam Tracker",
      icon: Pill,
      description: "Track clonazepam dose timing and estimated active amount over time using a configurable half-life model.",
      color: "purple",
      storageKey: "clonazepamTrackerByUserV1",
    },
    {
      path: "/wellness/vilazodone-tracker",
      name: "Vilazodone Tracker",
      label: "Vilazodone Tracker",
      icon: Pill,
      description: "Track vilazodone dose timing and estimated active amount over time using a configurable half-life model.",
      color: "purple",
      storageKey: "vilazodoneTrackerByUserV1",
    },
    {
      path: "/wellness/lamotrigine-tracker",
      name: "Lamotrigine Tracker",
      label: "Lamotrigine Tracker",
      icon: Pill,
      description: "Track lamotrigine dose timing and estimated active amount over time using a configurable half-life model.",
      color: "purple",
      storageKey: "lamotrigineTrackerByUserV1",
    },
    {
      path: "/wellness/doxylamine-tracker",
      name: "Doxylamine Tracker",
      label: "Doxylamine Tracker",
      icon: Pill,
      description: "Track doxylamine dose timing and estimated active amount over time using a configurable half-life model.",
      color: "purple",
      storageKey: "doxylamineTrackerByUserV1",
    },
    {
      path: "/wellness/trazodone-tracker",
      name: "Trazodone Tracker",
      label: "Trazodone Tracker",
      icon: Pill,
      description: "Track trazodone dose timing and estimated active amount over time using a configurable half-life model.",
      color: "purple",
      storageKey: "trazodoneTrackerByUserV1",
    },
    {
      path: "/wellness/levothyroxine-tracker",
      name: "Levothyroxine Tracker",
      label: "Levothyroxine Tracker",
      icon: Pill,
      description: "Track levothyroxine dose timing and estimated active amount over time using a configurable half-life model.",
      color: "purple",
      storageKey: "levothyroxineTrackerByUserV1",
    },
    {
      path: "/wellness/medication-visual-models",
      name: "Medication Visual Models",
      label: "Medication Visual Models",
      icon: Thermometer,
      description: "Animated visual model cards for clonazepam, doxylamine, vilazodone, lamotrigine, trazodone, levothyroxine, and caffeine.",
      color: "purple",
    },
    {
      path: "/wellness/medication-mix-model",
      name: "Medication Mix Model",
      label: "Medication Mix Model",
      icon: Thermometer,
      description: "Estimate combined CNS load from clonazepam, doxylamine, vilazodone, lamotrigine, trazodone, levothyroxine, and caffeine using your existing tracker logs.",
      color: "purple",
    },
  ],
};

const colorClasses = {
  blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  green: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400",
  purple: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400",
  orange: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/30 text-orange-600 dark:text-orange-400",
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

export default function WellnessTools() {
  const [searchQuery, setSearchQuery] = useState("");
  const [globalUserName, setGlobalUserName] = useState(() => {
    return localStorage.getItem(WELLNESS_GLOBAL_USER_NAME_KEY) || "";
  });
  const [savedUsers, setSavedUsers] = useState(() => loadSavedUsers());
  const [newUserInput, setNewUserInput] = useState("");
  const [transferMessage, setTransferMessage] = useState("");
  const [transferError, setTransferError] = useState("");
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(() => localStorage.getItem(WELLNESS_CLOUD_SYNC_ENABLED_KEY) === "1");
  const [cloudSyncSecret, setCloudSyncSecret] = useState(() => localStorage.getItem(WELLNESS_CLOUD_SYNC_SECRET_KEY) || "");
  const [cloudSyncBusy, setCloudSyncBusy] = useState(false);
  const [wellnessAiInput, setWellnessAiInput] = useState("");
  const [wellnessAiMessages, setWellnessAiMessages] = useState([]);
  const [wellnessAiBusy, setWellnessAiBusy] = useState(false);
  const [wellnessAiError, setWellnessAiError] = useState("");
  const importInputRef = useRef(null);
  const cloudSyncInitializedRef = useRef(false);
  const lastCloudSyncedPayloadRef = useRef("");

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

  useEffect(() => {
    localStorage.setItem(WELLNESS_CLOUD_SYNC_ENABLED_KEY, cloudSyncEnabled ? "1" : "0");
  }, [cloudSyncEnabled]);

  useEffect(() => {
    localStorage.setItem(WELLNESS_CLOUD_SYNC_SECRET_KEY, cloudSyncSecret);
    cloudSyncInitializedRef.current = false;
    lastCloudSyncedPayloadRef.current = "";
  }, [cloudSyncSecret]);

  const saveCurrentUser = () => {
    const name = newUserInput.trim() || globalUserName.trim();
    if (!name) return;
    setTransferMessage("");
    setTransferError("");
    setSavedUsers((prev) =>
      prev.includes(name) ? prev : [...prev, name]
    );
    setGlobalUserName(name);
    setNewUserInput("");
  };

  const removeUser = (name) => {
    setTransferMessage("");
    setTransferError("");
    setSavedUsers((prev) => prev.filter((u) => u !== name));
    if (globalUserName === name) setGlobalUserName("");
  };

  const selectUser = (name) => {
    setTransferMessage("");
    setTransferError("");
    setGlobalUserName(name);
    setNewUserInput("");
  };

  const downloadWellnessJson = () => {
    const payload = buildWellnessExportPayload({ savedUsers, globalUserName });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const dateStamp = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `wellness-users-${dateStamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setTransferError("");
    setTransferMessage(`Downloaded ${payload.users.length} user${payload.users.length === 1 ? "" : "s"} as JSON.`);
  };

  const triggerImportPicker = () => {
    setTransferMessage("");
    setTransferError("");
    importInputRef.current?.click();
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const result = importWellnessPayload(payload);
      setSavedUsers(result.savedUsers);
      setGlobalUserName(result.activeUserName);
      setTransferError("");
      setTransferMessage(`Imported ${result.importedUserCount} user${result.importedUserCount === 1 ? "" : "s"} from JSON.`);
    } catch (error) {
      setTransferMessage("");
      setTransferError(error?.message || "Could not import the selected JSON file.");
    } finally {
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const syncSnapshotPayload = useMemo(() => {
    return buildWellnessExportPayload({ savedUsers, globalUserName });
  }, [savedUsers, globalUserName]);

  const syncSnapshotString = useMemo(() => {
    return JSON.stringify(syncSnapshotPayload);
  }, [syncSnapshotPayload]);

  const runCloudSync = async ({ forcePull = false, forcePush = false } = {}) => {
    const secret = cloudSyncSecret.trim();
    if (!cloudSyncEnabled || !secret) return;

    setCloudSyncBusy(true);
    setTransferError("");

    try {
      const localHasData = hasMeaningfulWellnessData();

      if (forcePull || (!cloudSyncInitializedRef.current && !localHasData)) {
        const response = await pullWellnessFromCloud(secret);
        if (response?.found && response?.payload) {
          const result = importWellnessPayload(response.payload);
          setSavedUsers(result.savedUsers);
          setGlobalUserName(result.activeUserName);
          lastCloudSyncedPayloadRef.current = JSON.stringify(response.payload);
          setTransferMessage(`Cloud restore complete for ${result.importedUserCount} user${result.importedUserCount === 1 ? "" : "s"}.`);
        } else if (forcePull) {
          setTransferMessage("No cloud backup was found for this sync key.");
        }
        cloudSyncInitializedRef.current = true;
        return;
      }

      if (forcePush || !cloudSyncInitializedRef.current || lastCloudSyncedPayloadRef.current !== syncSnapshotString) {
        await pushWellnessToCloud(secret, syncSnapshotPayload);
        lastCloudSyncedPayloadRef.current = syncSnapshotString;
        setTransferMessage("Automatic cloud sync is up to date.");
      }

      cloudSyncInitializedRef.current = true;
    } catch (error) {
      setTransferError(error?.message || "Cloud sync failed.");
    } finally {
      setCloudSyncBusy(false);
    }
  };

  useEffect(() => {
    if (!cloudSyncEnabled || !cloudSyncSecret.trim()) return;

    runCloudSync();
    const intervalId = window.setInterval(() => {
      runCloudSync();
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [cloudSyncEnabled, cloudSyncSecret, syncSnapshotString]);

  const generateCloudSyncSecret = () => {
    const nextSecret = createCloudSyncSecret();
    setCloudSyncSecret(nextSecret);
    setTransferError("");
    setTransferMessage("Generated a new cloud sync key. Save it somewhere safe so another browser can restore your wellness data.");
  };

  const toggleCloudSync = () => {
    setCloudSyncEnabled((prev) => !prev);
    setTransferError("");
    setTransferMessage("");
  };

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

  const userSavedDataSnapshot = useMemo(() => {
    return buildUserSavedDataSnapshot(globalUserName);
  }, [globalUserName]);

  const medicationTrackerCards = useMemo(() => {
    const states = userSavedDataSnapshot.medicationTrackersByUserState || {};
    return Object.entries(states).map(([storageKey, state]) => {
      const baseName = storageKey.replace("TrackerByUserV1", "");
      const toolName = `${baseName.charAt(0).toUpperCase()}${baseName.slice(1)} Tracker`;
      const entriesCount = Array.isArray(state?.entries) ? state.entries.length : 0;

      return {
        storageKey,
        toolName,
        entriesCount,
        halfLifeHours: Number.isFinite(Number(state?.halfLifeHours)) ? Number(state.halfLifeHours) : null,
        daysAtDose: Number.isFinite(Number(state?.daysAtCurrentDose)) ? Number(state.daysAtCurrentDose) : null,
        rawState: state,
      };
    });
  }, [userSavedDataSnapshot]);

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

      <div className="mb-8 rounded-lg border border-fuchsia-200 dark:border-fuchsia-800 bg-fuchsia-50/50 dark:bg-fuchsia-950/20 p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Wellness User</p>

        {savedUsers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {savedUsers.map((name) => (
              <div
                key={name}
                className={`flex items-center gap-1 pl-3 pr-1 py-1 rounded-full text-sm border ${
                  globalUserName === name
                    ? "bg-fuchsia-600 text-white border-fuchsia-600 dark:bg-fuchsia-500 dark:border-fuchsia-500"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-fuchsia-400"
                }`}
              >
                <button
                  type="button"
                  onClick={() => selectUser(name)}
                  className="font-medium"
                >
                  {name}
                </button>
                <button
                  type="button"
                  onClick={() => removeUser(name)}
                  className={`ml-1 rounded-full p-0.5 hover:bg-black/10 ${
                    globalUserName === name ? "text-fuchsia-100" : "text-gray-400 hover:text-red-500"
                  }`}
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
            onKeyDown={(e) => e.key === "Enter" && saveCurrentUser()}
            placeholder={globalUserName ? `Active: ${globalUserName}` : "Enter a user name…"}
            className="flex-1 px-3 py-2 rounded-lg border border-fuchsia-300 dark:border-fuchsia-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 text-sm"
          />
          <button
            type="button"
            onClick={saveCurrentUser}
            disabled={!newUserInput.trim() && !globalUserName.trim()}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white text-sm font-medium"
            title="Save user"
          >
            <UserPlus className="w-4 h-4" />
            Save
          </button>
        </div>

        {globalUserName && (
          <p className="text-xs text-fuchsia-700 dark:text-fuchsia-300">
            Active user: <strong>{globalUserName}</strong> · All wellness tools will use this user's settings.
          </p>
        )}

        <div className="rounded-lg border border-fuchsia-200 dark:border-fuchsia-800 bg-white/70 dark:bg-gray-900/40 p-3 space-y-3">
          <div>
            <p className="text-sm font-semibold text-fuchsia-800 dark:text-fuchsia-200">Backup / Transfer</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Download saved wellness users and their linked data as JSON, or upload a previous export to restore it into this browser.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadWellnessJson}
              className="px-3 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-sm font-medium"
              title="Download saved wellness users, calorie profiles, caffeine profiles, and medication tracker data as a JSON backup file."
            >
              Download JSON
            </button>
            <button
              type="button"
              onClick={triggerImportPicker}
              className="px-3 py-2 rounded-lg border border-fuchsia-300 dark:border-fuchsia-700 text-fuchsia-700 dark:text-fuchsia-300 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/20 text-sm font-medium"
              title="Upload a previously exported wellness JSON file and restore it into this browser's local storage."
            >
              Upload JSON
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>
          {transferMessage && (
            <p className="text-xs text-emerald-700 dark:text-emerald-300">{transferMessage}</p>
          )}
          {transferError && (
            <p className="text-xs text-red-700 dark:text-red-300">{transferError}</p>
          )}
        </div>

        <div className="rounded-lg border border-fuchsia-200 dark:border-fuchsia-800 bg-white/70 dark:bg-gray-900/40 p-3 space-y-3">
          <div>
            <p className="text-sm font-semibold text-fuchsia-800 dark:text-fuchsia-200">Automatic Cloud Sync</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Stores your wellness JSON bundle in Netlify cloud storage using a private sync key. Any browser with the same key can restore and keep syncing automatically.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleCloudSync}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${cloudSyncEnabled ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"}`}
              title="Enable or disable automatic cloud sync for wellness data in this browser."
            >
              {cloudSyncEnabled ? "Cloud Sync On" : "Cloud Sync Off"}
            </button>
            <button
              type="button"
              onClick={generateCloudSyncSecret}
              className="px-3 py-2 rounded-lg border border-fuchsia-300 dark:border-fuchsia-700 text-fuchsia-700 dark:text-fuchsia-300 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/20 text-sm font-medium"
              title="Generate a new sync key for automatic cloud sync. You need the same key on another browser to restore the same wellness data."
            >
              Generate Sync Key
            </button>
            <button
              type="button"
              onClick={() => runCloudSync({ forcePush: true })}
              disabled={!cloudSyncEnabled || !cloudSyncSecret.trim() || cloudSyncBusy}
              className="px-3 py-2 rounded-lg border border-fuchsia-300 dark:border-fuchsia-700 text-fuchsia-700 dark:text-fuchsia-300 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/20 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              title="Push the current browser's wellness data to cloud storage immediately."
            >
              {cloudSyncBusy ? "Syncing..." : "Sync Now"}
            </button>
            <button
              type="button"
              onClick={() => runCloudSync({ forcePull: true })}
              disabled={!cloudSyncEnabled || !cloudSyncSecret.trim() || cloudSyncBusy}
              className="px-3 py-2 rounded-lg border border-fuchsia-300 dark:border-fuchsia-700 text-fuchsia-700 dark:text-fuchsia-300 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/20 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              title="Restore wellness data from cloud storage using the current sync key. This is useful on a new browser or device."
            >
              Restore From Cloud
            </button>
          </div>
          <label className="space-y-1 block">
            <span className="text-sm text-gray-700 dark:text-gray-300">Sync key</span>
            <input
              type="text"
              value={cloudSyncSecret}
              onChange={(e) => setCloudSyncSecret(e.target.value.trim())}
              placeholder="Paste or generate a sync key"
              className="w-full px-3 py-2 rounded-lg border border-fuchsia-300 dark:border-fuchsia-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Keep this key private. Anyone with the same key can restore the synced wellness JSON bundle.
          </p>
        </div>

        <details className="rounded-lg border border-fuchsia-200 dark:border-fuchsia-800 bg-white/70 dark:bg-gray-900/40 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-fuchsia-800 dark:text-fuchsia-200">
            Saved Data For Current User
          </summary>
          <div className="mt-3 space-y-3">
            <div className="rounded-md border border-fuchsia-100 dark:border-fuchsia-900/60 bg-fuchsia-50/60 dark:bg-fuchsia-950/20 p-3 text-xs">
              <p className="text-gray-700 dark:text-gray-300">
                <strong>User:</strong> {userSavedDataSnapshot.userName || "-"}
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                <strong>Caffeine profile ID:</strong> {userSavedDataSnapshot.profileLinks?.caffeineProfileId || "-"}
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                <strong>Calorie profile ID:</strong> {userSavedDataSnapshot.profileLinks?.calorieProfileId || "-"}
              </p>
            </div>

            <details className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-gray-800 dark:text-gray-200">
                Caffeine Tracker Data
              </summary>
              <div className="mt-2 text-xs text-gray-700 dark:text-gray-300 space-y-1">
                <p><strong>Name:</strong> {userSavedDataSnapshot.caffeineTracker?.name || "-"}</p>
                <p><strong>Weight:</strong> {userSavedDataSnapshot.caffeineTracker?.weight || "-"} {userSavedDataSnapshot.caffeineTracker?.weightUnit || ""}</p>
                <p><strong>Half-life:</strong> {userSavedDataSnapshot.caffeineTracker?.halfLifeHours || "-"} h</p>
                <p><strong>Days at dose:</strong> {userSavedDataSnapshot.caffeineTracker?.daysAtDose ?? "-"}</p>
                <p><strong>Entries:</strong> {Array.isArray(userSavedDataSnapshot.caffeineTracker?.entries) ? userSavedDataSnapshot.caffeineTracker.entries.length : 0}</p>
              </div>
            </details>

            <details className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-gray-800 dark:text-gray-200">
                Daily Calorie Intake Data
              </summary>
              <div className="mt-2 text-xs text-gray-700 dark:text-gray-300 space-y-1">
                <p><strong>Name:</strong> {userSavedDataSnapshot.dailyCalorieIntake?.name || "-"}</p>
                <p><strong>Unit:</strong> {userSavedDataSnapshot.dailyCalorieIntake?.form?.unitSystem || "-"}</p>
                <p><strong>Weight:</strong> {userSavedDataSnapshot.dailyCalorieIntake?.form?.weight || "-"} {userSavedDataSnapshot.dailyCalorieIntake?.form?.unitSystem === "metric" ? "kg" : "lb"}</p>
                <p><strong>Height:</strong> {userSavedDataSnapshot.dailyCalorieIntake?.form?.unitSystem === "metric"
                  ? `${userSavedDataSnapshot.dailyCalorieIntake?.form?.heightCm || "-"} cm`
                  : `${userSavedDataSnapshot.dailyCalorieIntake?.form?.heightFeet || "-"} ft ${userSavedDataSnapshot.dailyCalorieIntake?.form?.heightInches || "-"} in`}</p>
                <p><strong>Steps:</strong> {userSavedDataSnapshot.dailyCalorieIntake?.form?.steps || "-"}</p>
                <p><strong>Current calories:</strong> {userSavedDataSnapshot.dailyCalorieIntake?.form?.currentCalories || "-"}</p>
              </div>
            </details>

            <details className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-gray-800 dark:text-gray-200">
                Medication Tracker Data
              </summary>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                {medicationTrackerCards.map((card) => (
                  <details key={card.storageKey} className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2">
                    <summary className="cursor-pointer text-xs font-semibold text-gray-800 dark:text-gray-200">
                      {card.toolName}
                    </summary>
                    <div className="mt-2 text-xs text-gray-700 dark:text-gray-300 space-y-1">
                      <p><strong>Entries:</strong> {card.entriesCount}</p>
                      <p><strong>Half-life:</strong> {card.halfLifeHours ?? "-"} h</p>
                      <p><strong>Days at dose:</strong> {card.daysAtDose ?? "-"}</p>
                    </div>
                  </details>
                ))}
              </div>
            </details>
          </div>
        </details>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredTools.map((tool) => {
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
              Requires a configured Groq API key.
            </a>{" "}
            AI responses are informational only and not medical advice.
          </p>
        </div>
      </div>
    </div>
  );
}
