import React, { useMemo, useState, useEffect } from "react";
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

export default function WellnessTools() {
  const [searchQuery, setSearchQuery] = useState("");
  const [globalUserName, setGlobalUserName] = useState(() => {
    return localStorage.getItem(WELLNESS_GLOBAL_USER_NAME_KEY) || "";
  });
  const [savedUsers, setSavedUsers] = useState(() => loadSavedUsers());
  const [newUserInput, setNewUserInput] = useState("");

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

  const saveCurrentUser = () => {
    const name = newUserInput.trim() || globalUserName.trim();
    if (!name) return;
    setSavedUsers((prev) =>
      prev.includes(name) ? prev : [...prev, name]
    );
    setGlobalUserName(name);
    setNewUserInput("");
  };

  const removeUser = (name) => {
    setSavedUsers((prev) => prev.filter((u) => u !== name));
    if (globalUserName === name) setGlobalUserName("");
  };

  const selectUser = (name) => {
    setGlobalUserName(name);
    setNewUserInput("");
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
    </div>
  );
}
