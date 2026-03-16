import React, { useMemo, useState } from "react";
import { Pill, Trash2 } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

const STORAGE_KEY = "clonazepamTrackerEntries";
const HALF_LIFE_STORAGE_KEY = "clonazepamTrackerHalfLifeHours";
const DAYS_AT_DOSE_STORAGE_KEY = "clonazepamTrackerDaysAtCurrentDose";
const CARRYOVER_CADENCE_STORAGE_KEY = "clonazepamTrackerCarryoverCadence";
const CIRCADIAN_STRENGTH_STORAGE_KEY = "clonazepamTrackerCircadianStrength";
const CIRCADIAN_SHIFT_STORAGE_KEY = "clonazepamTrackerCircadianShift";
const CAFFEINE_STORAGE_KEY = "caffeineTrackerEntries";
const CAFFEINE_WEIGHT_STORAGE_KEY = "caffeineTrackerWeight";
const CAFFEINE_WEIGHT_UNIT_STORAGE_KEY = "caffeineTrackerWeightUnit";
const CAFFEINE_HALF_LIFE_STORAGE_KEY = "caffeineTrackerHalfLifeHours";
const PROFILE_STORAGE_KEY = "caffeineTrackerProfilesV1";
const ACTIVE_PROFILE_ID_STORAGE_KEY = "caffeineTrackerActiveProfileId";
const CLONAZEPAM_BY_USER_STORAGE_KEY = "clonazepamTrackerByUserV1";

const HALF_LIFE_OPTIONS = [18, 30, 40];
const DEFAULT_HALF_LIFE_HOURS = 30;
const MAX_DAYS_AT_DOSE = 365;
const DEFAULT_CIRCADIAN_STRENGTH_PERCENT = 35;
const DEFAULT_CIRCADIAN_SHIFT_HOURS = 0;
const SEDATION_EC50_MG = 0.5;
const CAFFEINE_STIM_KD_MG_PER_KG = 2.0;

function toKg(weight, unit) {
  if (!weight || weight <= 0) return 0;
  return unit === "lb" ? weight * 0.45359237 : weight;
}

function getNowLocalTime() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function getNowLocalDateTimeValue() {
  const d = new Date();
  const offsetMs = d.getTimezoneOffset() * 60 * 1000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
}

function parseLocalTimeToDate(time, referenceMs = Date.now()) {
  const [h, m] = (time || "00:00").split(":").map(Number);
  const now = new Date(referenceMs);
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, m || 0, 0, 0);
  if (d.getTime() > now.getTime()) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

function sedationBand(pressurePercent) {
  if (pressurePercent < 25) return { level: "Low", tone: "text-green-700 dark:text-green-300" };
  if (pressurePercent < 55) return { level: "Moderate", tone: "text-amber-700 dark:text-amber-300" };
  return { level: "High", tone: "text-red-700 dark:text-red-300" };
}

function getEntryTakenAtMs(entry, referenceMs = Date.now()) {
  const explicitMs = Number(entry?.takenAtMs);
  if (Number.isFinite(explicitMs) && explicitMs > 0) return explicitMs;

  if (entry?.takenAtIso) {
    const isoMs = new Date(entry.takenAtIso).getTime();
    if (Number.isFinite(isoMs) && isoMs > 0) return isoMs;
  }

  if (typeof entry?.time === "string" && entry.time.includes("T")) {
    const directMs = new Date(entry.time).getTime();
    if (Number.isFinite(directMs) && directMs > 0) return directMs;
  }

  return parseLocalTimeToDate(entry?.time, referenceMs).getTime();
}

function formatDoseLogTimestamp(entry, referenceMs = Date.now()) {
  const takenAtMs = getEntryTakenAtMs(entry, referenceMs);
  if (!Number.isFinite(takenAtMs) || takenAtMs <= 0) return entry?.time || "--:--";
  return new Date(takenAtMs).toLocaleString([], {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCaffeineLogTimestamp(entry, referenceMs = Date.now()) {
  const takenAtMs = parseLocalTimeToDate(entry?.time, referenceMs).getTime();
  if (!Number.isFinite(takenAtMs) || takenAtMs <= 0) return entry?.time || "--:--";
  return new Date(takenAtMs).toLocaleString([], {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatChartTooltipDateTime(value) {
  return new Date(value).toLocaleString([], {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function acuteSedationFromEntry(entry, atMs, referenceMs = Date.now()) {
  const takenAtMs = getEntryTakenAtMs(entry, referenceMs);
  if (atMs < takenAtMs) return 0;

  const elapsedHours = (atMs - takenAtMs) / (1000 * 60 * 60);
  const onsetTauHours = 1.1;
  const offsetTauHours = 6.5;
  const onset = 1 - Math.exp(-elapsedHours / onsetTauHours);
  const decay = Math.exp(-elapsedHours / offsetTauHours);

  const doseMg = Number(entry?.doseMg) || 0;
  const doseScale = doseMg > 0 ? doseMg / (doseMg + 0.25) : 0;
  return 100 * doseScale * onset * decay;
}

function toleranceFactorFromDays(daysAtCurrentDose) {
  const days = Math.max(0, Number(daysAtCurrentDose) || 0);
  const maxReduction = 0.35;
  const tauDays = 10;
  return 1 - maxReduction * (1 - Math.exp(-days / tauDays));
}

function toleranceReductionPercent(daysAtCurrentDose) {
  const factor = toleranceFactorFromDays(daysAtCurrentDose);
  return Math.max(0, (1 - factor) * 100);
}

function modeledSedationPressure(activeMg, acuteSedationPressure, daysAtCurrentDose = 0) {
  const concentrationPressure = (activeMg / (activeMg + SEDATION_EC50_MG)) * 100;
  const toleranceFactor = toleranceFactorFromDays(daysAtCurrentDose);
  const blended = 0.4 * concentrationPressure + 0.6 * Math.min(100, acuteSedationPressure);
  const adjusted = blended * toleranceFactor;
  return Math.max(0, Math.min(100, adjusted));
}

function circadianSleepPenaltyPercent(atMs, strengthPercent = DEFAULT_CIRCADIAN_STRENGTH_PERCENT, shiftHours = DEFAULT_CIRCADIAN_SHIFT_HOURS) {
  const d = new Date(atMs);
  const hour = d.getHours() + d.getMinutes() / 60;
  const circadianCenterHour = 3 + shiftHours;
  const radians = ((hour - circadianCenterHour) / 24) * 2 * Math.PI;
  const overnightDrive = (Math.cos(radians) + 1) / 2;
  const safeStrength = Math.max(0, Math.min(50, Number(strengthPercent) || 0));
  return overnightDrive * safeStrength;
}

function clonazepamActiveMgAtTime(entry, atMs, referenceMs, halfLifeHours) {
  const takenAt = getEntryTakenAtMs(entry, referenceMs);
  if (atMs < takenAt) return 0;
  const elapsedHours = (atMs - takenAt) / (1000 * 60 * 60);
  const remainingFraction = Math.pow(0.5, elapsedHours / halfLifeHours);
  return (entry.doseMg || 0) * remainingFraction;
}

function estimateWithdrawalThresholdMg({
  daysAtCurrentDose,
  carryoverCadence,
  carryoverDoseMg,
  halfLifeHours,
}) {
  const days = Math.max(0, Number(daysAtCurrentDose) || 0);
  if (days < 7) return null;

  const doseMg = Math.max(0, Number(carryoverDoseMg) || 0);
  if (doseMg <= 0) return null;

  const intervalHours = carryoverCadence === "twice" ? 12 : 24;
  const decayPerInterval = Math.pow(0.5, intervalHours / halfLifeHours);

  const estimatedSteadyStateTroughMg = doseMg * (decayPerInterval / (1 - decayPerInterval));
  const thresholdFraction = 0.45;
  const threshold = estimatedSteadyStateTroughMg * thresholdFraction;

  return Number(Math.max(0.05, threshold).toFixed(3));
}

function activeCaffeineMgFromEntry(entry, atMs, referenceMs, halfLifeHours) {
  const startMs = parseLocalTimeToDate(entry.time, referenceMs).getTime();
  const durationMs = (entry.durationMinutes || 0) * 60 * 1000;

  if (durationMs <= 0) {
    if (atMs < startMs) return 0;
    const elapsedHours = (atMs - startMs) / (1000 * 60 * 60);
    return (entry.caffeineMg || 0) * Math.pow(0.5, elapsedHours / halfLifeHours);
  }

  const N = Math.max(2, Math.round(durationMs / (5 * 60 * 1000)));
  const sipMg = (entry.caffeineMg || 0) / N;
  let total = 0;

  for (let i = 0; i < N; i++) {
    const sipMs = startMs + (i / (N - 1)) * durationMs;
    if (atMs < sipMs) continue;
    const elapsedHours = (atMs - sipMs) / (1000 * 60 * 60);
    total += sipMg * Math.pow(0.5, elapsedHours / halfLifeHours);
  }

  return total;
}

function loadProfiles() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "[]");
    if (Array.isArray(raw) && raw.length > 0) return raw;
  } catch {
    // fallback below
  }

  return [
    {
      id: "caffeine-user-default",
      name: "Default",
      weight: Number(localStorage.getItem(CAFFEINE_WEIGHT_STORAGE_KEY) || 170),
      weightUnit: localStorage.getItem(CAFFEINE_WEIGHT_UNIT_STORAGE_KEY) || "lb",
      halfLifeHours: Number(localStorage.getItem(CAFFEINE_HALF_LIFE_STORAGE_KEY) || 5),
      entries: (() => {
        try {
          const rawEntries = localStorage.getItem(CAFFEINE_STORAGE_KEY);
          return rawEntries ? JSON.parse(rawEntries) : [];
        } catch {
          return [];
        }
      })(),
    },
  ];
}

function loadClonazepamByUser() {
  try {
    const raw = JSON.parse(localStorage.getItem(CLONAZEPAM_BY_USER_STORAGE_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function sanitizeClonazepamState(raw) {
  const entries = Array.isArray(raw?.entries) ? raw.entries : [];
  const parsedHalfLife = Number(raw?.halfLifeHours);
  const halfLifeHours = HALF_LIFE_OPTIONS.includes(parsedHalfLife) ? parsedHalfLife : DEFAULT_HALF_LIFE_HOURS;
  const parsedDays = Number(raw?.daysAtCurrentDose);
  const daysAtCurrentDose = Number.isFinite(parsedDays) && parsedDays >= 0
    ? Math.min(MAX_DAYS_AT_DOSE, Math.round(parsedDays))
    : 0;
  const carryoverCadence = raw?.carryoverCadence === "twice" ? "twice" : "once";
  const parsedStrength = Number(raw?.circadianStrengthPercent);
  const circadianStrengthPercent = Number.isFinite(parsedStrength)
    ? Math.max(0, Math.min(50, parsedStrength))
    : DEFAULT_CIRCADIAN_STRENGTH_PERCENT;
  const parsedShift = Number(raw?.circadianShiftHours);
  const circadianShiftHours = Number.isFinite(parsedShift)
    ? Math.max(-3, Math.min(3, parsedShift))
    : DEFAULT_CIRCADIAN_SHIFT_HOURS;
  return { entries, halfLifeHours, daysAtCurrentDose, carryoverCadence, circadianStrengthPercent, circadianShiftHours };
}

function getClonazepamStateForUser(profileId) {
  const byUser = loadClonazepamByUser();
  if (profileId && byUser[profileId]) {
    return sanitizeClonazepamState(byUser[profileId]);
  }

  let legacyEntries = [];
  try {
    const rawEntries = localStorage.getItem(STORAGE_KEY);
    legacyEntries = rawEntries ? JSON.parse(rawEntries) : [];
  } catch {
    legacyEntries = [];
  }

  const legacyHalfLife = Number(localStorage.getItem(HALF_LIFE_STORAGE_KEY));
  const legacyDaysAtDose = Number(localStorage.getItem(DAYS_AT_DOSE_STORAGE_KEY));
  const legacyCarryoverCadence = localStorage.getItem(CARRYOVER_CADENCE_STORAGE_KEY) || "once";
  const legacyCircadianStrength = Number(localStorage.getItem(CIRCADIAN_STRENGTH_STORAGE_KEY));
  const legacyCircadianShift = Number(localStorage.getItem(CIRCADIAN_SHIFT_STORAGE_KEY));
  return sanitizeClonazepamState({
    entries: legacyEntries,
    halfLifeHours: legacyHalfLife,
    daysAtCurrentDose: legacyDaysAtDose,
    carryoverCadence: legacyCarryoverCadence,
    circadianStrengthPercent: legacyCircadianStrength,
    circadianShiftHours: legacyCircadianShift,
  });
}

function saveClonazepamStateForUser(profileId, nextState) {
  if (!profileId) return;
  const byUser = loadClonazepamByUser();
  const safeState = sanitizeClonazepamState(nextState);
  byUser[profileId] = safeState;
  localStorage.setItem(CLONAZEPAM_BY_USER_STORAGE_KEY, JSON.stringify(byUser));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safeState.entries));
  localStorage.setItem(HALF_LIFE_STORAGE_KEY, String(safeState.halfLifeHours));
  localStorage.setItem(DAYS_AT_DOSE_STORAGE_KEY, String(safeState.daysAtCurrentDose || 0));
  localStorage.setItem(CARRYOVER_CADENCE_STORAGE_KEY, safeState.carryoverCadence || "once");
  localStorage.setItem(CIRCADIAN_STRENGTH_STORAGE_KEY, String(safeState.circadianStrengthPercent));
  localStorage.setItem(CIRCADIAN_SHIFT_STORAGE_KEY, String(safeState.circadianShiftHours));
}

export default function ClonazepamTracker() {
  const [profiles, setProfiles] = useState(() => loadProfiles());
  const [activeProfileId, setActiveProfileId] = useState(() => {
    const saved = localStorage.getItem(ACTIVE_PROFILE_ID_STORAGE_KEY);
    const loadedProfiles = loadProfiles();
    if (saved && loadedProfiles.some((profile) => profile.id === saved)) return saved;
    return loadedProfiles[0]?.id || "caffeine-user-default";
  });
  const [doseMg, setDoseMg] = useState(0.25);
  const [time, setTime] = useState(getNowLocalDateTimeValue());
  const initialClonazState = getClonazepamStateForUser(activeProfileId);
  const [entries, setEntries] = useState(() => {
    return initialClonazState.entries;
  });
  const [halfLifeHours, setHalfLifeHours] = useState(() => {
    return initialClonazState.halfLifeHours;
  });
  const [daysAtCurrentDose, setDaysAtCurrentDose] = useState(() => {
    return Number(initialClonazState.daysAtCurrentDose) || 0;
  });
  const [carryoverCadence, setCarryoverCadence] = useState(() => {
    return initialClonazState.carryoverCadence === "twice" ? "twice" : "once";
  });
  const [circadianStrengthPercent, setCircadianStrengthPercent] = useState(() => {
    return Number.isFinite(Number(initialClonazState.circadianStrengthPercent))
      ? Number(initialClonazState.circadianStrengthPercent)
      : DEFAULT_CIRCADIAN_STRENGTH_PERCENT;
  });
  const [circadianShiftHours, setCircadianShiftHours] = useState(() => {
    return Number.isFinite(Number(initialClonazState.circadianShiftHours))
      ? Number(initialClonazState.circadianShiftHours)
      : DEFAULT_CIRCADIAN_SHIFT_HOURS;
  });
  const [recalcAt, setRecalcAt] = useState(() => Date.now());

  const activeProfile = useMemo(() => {
    return profiles.find((profile) => profile.id === activeProfileId) || profiles[0] || null;
  }, [profiles, activeProfileId]);

  const updateActiveClonazepamState = (partialUpdates) => {
    const nextState = {
      entries,
      halfLifeHours,
      daysAtCurrentDose,
      carryoverCadence,
      circadianStrengthPercent,
      circadianShiftHours,
      ...partialUpdates,
    };
    saveClonazepamStateForUser(activeProfileId, nextState);
  };

  const switchActiveUser = (nextProfileId) => {
    if (!profiles.some((profile) => profile.id === nextProfileId)) return;
    setActiveProfileId(nextProfileId);
    localStorage.setItem(ACTIVE_PROFILE_ID_STORAGE_KEY, nextProfileId);

    const userState = getClonazepamStateForUser(nextProfileId);
    setEntries(userState.entries);
    setHalfLifeHours(userState.halfLifeHours);
    setDaysAtCurrentDose(Number(userState.daysAtCurrentDose) || 0);
    setCarryoverCadence(userState.carryoverCadence === "twice" ? "twice" : "once");
    setCircadianStrengthPercent(Number(userState.circadianStrengthPercent));
    setCircadianShiftHours(Number(userState.circadianShiftHours));

    const refreshedProfiles = loadProfiles();
    setProfiles(refreshedProfiles);
    const nextProfile = refreshedProfiles.find((profile) => profile.id === nextProfileId);
    if (nextProfile) {
      localStorage.setItem(CAFFEINE_STORAGE_KEY, JSON.stringify(Array.isArray(nextProfile.entries) ? nextProfile.entries : []));
      localStorage.setItem(CAFFEINE_WEIGHT_STORAGE_KEY, String(nextProfile.weight || ""));
      localStorage.setItem(CAFFEINE_WEIGHT_UNIT_STORAGE_KEY, nextProfile.weightUnit || "lb");
      localStorage.setItem(CAFFEINE_HALF_LIFE_STORAGE_KEY, String(nextProfile.halfLifeHours || 5));
    }

    setRecalcAt(Date.now());
  };

  const saveEntries = (nextEntries) => {
    setEntries(nextEntries);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries));
    updateActiveClonazepamState({ entries: nextEntries });
  };

  const saveHalfLifeHours = (next) => {
    const value = Number(next);
    const safeValue = HALF_LIFE_OPTIONS.includes(value) ? value : DEFAULT_HALF_LIFE_HOURS;
    setHalfLifeHours(safeValue);
    localStorage.setItem(HALF_LIFE_STORAGE_KEY, String(safeValue));
    updateActiveClonazepamState({ halfLifeHours: safeValue });
  };

  const saveDaysAtCurrentDose = (next) => {
    const value = Math.min(MAX_DAYS_AT_DOSE, Math.max(0, Math.round(Number(next) || 0)));
    setDaysAtCurrentDose(value);
    localStorage.setItem(DAYS_AT_DOSE_STORAGE_KEY, String(value));
    updateActiveClonazepamState({ daysAtCurrentDose: value });
  };

  const saveCarryoverCadence = (next) => {
    const value = next === "twice" ? "twice" : "once";
    setCarryoverCadence(value);
    localStorage.setItem(CARRYOVER_CADENCE_STORAGE_KEY, value);
    updateActiveClonazepamState({ carryoverCadence: value });
  };

  const saveCircadianStrengthPercent = (next) => {
    const value = Math.max(0, Math.min(50, Number(next) || 0));
    setCircadianStrengthPercent(value);
    localStorage.setItem(CIRCADIAN_STRENGTH_STORAGE_KEY, String(value));
    updateActiveClonazepamState({ circadianStrengthPercent: value });
  };

  const saveCircadianShiftHours = (next) => {
    const value = Math.max(-3, Math.min(3, Number(next) || 0));
    setCircadianShiftHours(value);
    localStorage.setItem(CIRCADIAN_SHIFT_STORAGE_KEY, String(value));
    updateActiveClonazepamState({ circadianShiftHours: value });
  };

  const resetCircadianDefaults = () => {
    saveCircadianStrengthPercent(DEFAULT_CIRCADIAN_STRENGTH_PERCENT);
    saveCircadianShiftHours(DEFAULT_CIRCADIAN_SHIFT_HOURS);
    setRecalcAt(Date.now());
  };

  const caffeineEntries = useMemo(() => {
    if (Array.isArray(activeProfile?.entries)) {
      return activeProfile.entries;
    }
    try {
      const raw = localStorage.getItem(CAFFEINE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [activeProfile, recalcAt]);

  const combinedDoseLogEntries = useMemo(() => {
    const clonazepamLog = entries.map((entry) => ({
      ...entry,
      source: "clonazepam",
      sortAt: getEntryTakenAtMs(entry, recalcAt) || Number(entry.createdAt) || recalcAt,
    }));

    const caffeineLog = caffeineEntries.map((entry) => ({
      ...entry,
      source: "caffeine",
      sortAt: Number(entry.createdAt) || parseLocalTimeToDate(entry.time).getTime(),
    }));

    return [...clonazepamLog, ...caffeineLog].sort((a, b) => b.sortAt - a.sortAt);
  }, [entries, caffeineEntries]);

  const carryoverDoseTemplate = useMemo(() => {
    const sorted = [...entries].sort((a, b) => getEntryTakenAtMs(b, recalcAt) - getEntryTakenAtMs(a, recalcAt));
    const latest = sorted[0] || null;
    const fallbackTakenAt = Number.isFinite(new Date(time).getTime()) ? new Date(time).getTime() : recalcAt;
    return {
      doseMg: Number(latest?.doseMg) || Number(doseMg) || 0.25,
      takenAtMs: latest ? getEntryTakenAtMs(latest, recalcAt) : fallbackTakenAt,
    };
  }, [entries, recalcAt, doseMg, time]);

  const modeledEntries = useMemo(() => {
    const priorDays = Math.max(0, Math.round(Number(daysAtCurrentDose) || 0));
    if (priorDays <= 0 || carryoverDoseTemplate.doseMg <= 0) return entries;

    const dayMs = 24 * 60 * 60 * 1000;
    const halfDayMs = 12 * 60 * 60 * 1000;
    const earliestRealTakenAt = entries.length
      ? Math.min(...entries.map((entry) => getEntryTakenAtMs(entry, recalcAt)))
      : Infinity;
    const syntheticCarryover = [];
    for (let day = 1; day <= priorDays; day += 1) {
      const primaryTakenAtMs = carryoverDoseTemplate.takenAtMs - day * dayMs;
      if (primaryTakenAtMs < earliestRealTakenAt - 60 * 1000) {
        syntheticCarryover.push({
          id: `carryover-${day}-a`,
          doseMg: carryoverDoseTemplate.doseMg,
          takenAtMs: primaryTakenAtMs,
          takenAtIso: new Date(primaryTakenAtMs).toISOString(),
          synthetic: true,
        });
      }

      if (carryoverCadence === "twice") {
        const secondTakenAtMs = primaryTakenAtMs - halfDayMs;
        if (secondTakenAtMs < earliestRealTakenAt - 60 * 1000) {
          syntheticCarryover.push({
            id: `carryover-${day}-b`,
            doseMg: carryoverDoseTemplate.doseMg,
            takenAtMs: secondTakenAtMs,
            takenAtIso: new Date(secondTakenAtMs).toISOString(),
            synthetic: true,
          });
        }
      }
    }

    return [...entries, ...syntheticCarryover];
  }, [entries, daysAtCurrentDose, carryoverDoseTemplate, carryoverCadence, recalcAt]);

  const withdrawalThresholdMg = useMemo(() => {
    return estimateWithdrawalThresholdMg({
      daysAtCurrentDose,
      carryoverCadence,
      carryoverDoseMg: carryoverDoseTemplate.doseMg,
      halfLifeHours,
    });
  }, [daysAtCurrentDose, carryoverCadence, carryoverDoseTemplate, halfLifeHours]);

  const addEntry = (e) => {
    e.preventDefault();
    const doseNumber = Number(doseMg);
    if (!doseNumber || doseNumber <= 0) return;

    const parsedTakenAt = new Date(time).getTime();
    const takenAtMs = Number.isFinite(parsedTakenAt) ? parsedTakenAt : Date.now();

    const next = [
      {
        id: crypto.randomUUID(),
        doseMg: doseNumber,
        time: getNowLocalTime(),
        takenAtMs,
        takenAtIso: new Date(takenAtMs).toISOString(),
        createdAt: Date.now(),
      },
      ...entries,
    ];

    saveEntries(next);
    setDoseMg(0.25);
    setTime(getNowLocalDateTimeValue());
    setRecalcAt(Date.now());
  };

  const clearClonazepamEntry = (id) => {
    saveEntries(entries.filter((entry) => entry.id !== id));
    setRecalcAt(Date.now());
  };

  const clearCaffeineEntry = (id) => {
    if (activeProfile) {
      const next = caffeineEntries.filter((entry) => entry.id !== id);
      const nextProfiles = profiles.map((profile) => (
        profile.id === activeProfile.id ? { ...profile, entries: next } : profile
      ));
      setProfiles(nextProfiles);
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(nextProfiles));
      localStorage.setItem(CAFFEINE_STORAGE_KEY, JSON.stringify(next));
    }
    setRecalcAt(Date.now());
  };

  const clearEntry = (entry) => {
    if (entry.source === "caffeine") {
      clearCaffeineEntry(entry.id);
      return;
    }
    clearClonazepamEntry(entry.id);
  };

  const clearAll = () => {
    saveEntries([]);
    if (activeProfile) {
      const nextProfiles = profiles.map((profile) => (
        profile.id === activeProfile.id ? { ...profile, entries: [] } : profile
      ));
      setProfiles(nextProfiles);
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(nextProfiles));
    }
    localStorage.setItem(CAFFEINE_STORAGE_KEY, JSON.stringify([]));
    setRecalcAt(Date.now());
  };

  const recalculateNow = () => {
    const now = Date.now();
    setRecalcAt((prev) => (now <= prev ? prev + 1 : now));
  };

  const metrics = useMemo(() => {
    const totalMg = entries.reduce((sum, entry) => sum + (entry.doseMg || 0), 0);
    const now = recalcAt;

    const activeMg = modeledEntries.reduce((sum, entry) => {
      return sum + clonazepamActiveMgAtTime(entry, now, now, halfLifeHours);
    }, 0);

    const acuteSedationPressure = entries.reduce((sum, entry) => {
      return sum + acuteSedationFromEntry(entry, now, now);
    }, 0);

    const sedationPressure = modeledSedationPressure(activeMg, acuteSedationPressure, daysAtCurrentDose);

    return {
      totalMg,
      activeMg,
      sedationPressure,
      band: sedationBand(sedationPressure),
    };
  }, [entries, modeledEntries, recalcAt, halfLifeHours, daysAtCurrentDose]);

  const chartData = useMemo(() => {
    if (!modeledEntries.length) return [];

    const now = recalcAt;
    const doseTimes = modeledEntries.map((entry) => getEntryTakenAtMs(entry, now));
    const earliest = Math.min(...doseTimes);

    const start = Math.max(earliest - 4 * 60 * 60 * 1000, now - 48 * 60 * 60 * 1000);
    const end = now + 72 * 60 * 60 * 1000;
    const stepMs = 60 * 60 * 1000;

    const points = [];
    for (let t = start; t <= end; t += stepMs) {
      const activeMg = modeledEntries.reduce((sum, entry) => {
        return sum + clonazepamActiveMgAtTime(entry, t, now, halfLifeHours);
      }, 0);

      points.push({
        ts: t,
        activeMg: Number(activeMg.toFixed(3)),
      });
    }
    return points;
  }, [modeledEntries, recalcAt, halfLifeHours]);

  const chartTicks = useMemo(() => {
    if (!chartData.length) return [];
    const s = chartData[0].ts;
    const e = chartData[chartData.length - 1].ts;
    const hr = 3600000;
    const out = [];
    for (let t = Math.ceil(s / hr) * hr; t <= e; t += hr) out.push(t);
    return out;
  }, [chartData]);

  const withdrawalCrossingInfo = useMemo(() => {
    if (withdrawalThresholdMg === null || !chartData.length) return null;

    const crossingPoint = chartData.find((point) => point.ts >= recalcAt && point.activeMg <= withdrawalThresholdMg);
    if (!crossingPoint) {
      return {
        label: "Beyond 72h projection",
        hoursFromNow: null,
      };
    }

    return {
      label: formatChartTooltipDateTime(crossingPoint.ts),
      hoursFromNow: (crossingPoint.ts - recalcAt) / (1000 * 60 * 60),
    };
  }, [withdrawalThresholdMg, chartData, recalcAt]);

  const sedationPressureData = useMemo(() => {
    return chartData.map((point) => {
      const acuteSedationPressure = entries.reduce((sum, entry) => {
        return sum + acuteSedationFromEntry(entry, point.ts, recalcAt);
      }, 0);

      const pressureNoTolerance = modeledSedationPressure(point.activeMg, acuteSedationPressure, 0);
      const pressure = modeledSedationPressure(point.activeMg, acuteSedationPressure, daysAtCurrentDose);
      const circadianPenalty = circadianSleepPenaltyPercent(point.ts, circadianStrengthPercent, circadianShiftHours);
      const alertness = Math.max(0, 100 - pressure - circadianPenalty);
      return {
        ts: point.ts,
        pressureNoTolerance: Number(pressureNoTolerance.toFixed(1)),
        pressure: Number(pressure.toFixed(1)),
        circadianPenalty: Number(circadianPenalty.toFixed(1)),
        alertness: Number(alertness.toFixed(1)),
      };
    });
  }, [chartData, entries, recalcAt, daysAtCurrentDose, circadianStrengthPercent, circadianShiftHours]);

  const interactionData = useMemo(() => {
    if (!sedationPressureData.length) return [];

    const activeCaffeineEntries = Array.isArray(activeProfile?.entries) ? activeProfile.entries : caffeineEntries;
    const caffeineHalfLifeRaw = Number(activeProfile?.halfLifeHours ?? localStorage.getItem(CAFFEINE_HALF_LIFE_STORAGE_KEY));
    const caffeineHalfLifeHours = Number.isFinite(caffeineHalfLifeRaw) && caffeineHalfLifeRaw > 0 ? caffeineHalfLifeRaw : 5;

    const caffeineWeightRaw = Number(activeProfile?.weight ?? localStorage.getItem(CAFFEINE_WEIGHT_STORAGE_KEY));
    const caffeineWeightUnit = activeProfile?.weightUnit || localStorage.getItem(CAFFEINE_WEIGHT_UNIT_STORAGE_KEY) || "lb";
    const caffeineKg = toKg(caffeineWeightRaw, caffeineWeightUnit) || 70;

    const now = recalcAt;

    return sedationPressureData.map((point) => {
      const activeCaffeineMg = activeCaffeineEntries.reduce((sum, entry) => {
        return sum + activeCaffeineMgFromEntry(entry, point.ts, now, caffeineHalfLifeHours);
      }, 0);

      const activeCaffeineMgPerKg = caffeineKg > 0 ? activeCaffeineMg / caffeineKg : 0;
      const caffeineCounterPressure = (activeCaffeineMgPerKg / (activeCaffeineMgPerKg + CAFFEINE_STIM_KD_MG_PER_KG)) * 100;
      const netPressure = point.pressure - caffeineCounterPressure;

      return {
        ts: point.ts,
        sedationPressure: Number(point.pressure.toFixed(1)),
        caffeineCounterPressure: Number(caffeineCounterPressure.toFixed(1)),
        caffeineCounterPressureNeg: Number((-caffeineCounterPressure).toFixed(1)),
        netPressure: Number(netPressure.toFixed(1)),
      };
    });
  }, [sedationPressureData, recalcAt, activeProfile, caffeineEntries]);

  return (
    <div className="w-full px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Pill className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Clonazepam Tracker</h1>
          <p className="text-gray-600 dark:text-gray-400">Track clonazepam doses over time using half-life and tolerance-adjusted sedation modeling.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">Dose Input</h2>
          <label className="space-y-1 block">
            <span className="text-sm text-gray-700 dark:text-gray-300">User</span>
            <select
              value={activeProfileId}
              onChange={(e) => switchActiveUser(e.target.value)}
              className="w-full sm:w-72 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            >
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.name || "User"}</option>
              ))}
            </select>
          </label>
          <form onSubmit={addEntry} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-sm text-gray-700 dark:text-gray-300">Dose (mg)</span>
                <input
                  type="number"
                  min="0.125"
                  step="0.125"
                  value={doseMg}
                  onChange={(e) => setDoseMg(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm text-gray-700 dark:text-gray-300">Date & time taken</span>
                <input
                  type="datetime-local"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                />
              </label>
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            >
              Add Dose
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">Snapshot</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1">
              <span className="text-sm text-gray-700 dark:text-gray-300">Half-life</span>
              <select
                value={halfLifeHours}
                onChange={(e) => saveHalfLifeHours(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              >
                {HALF_LIFE_OPTIONS.map((hours) => (
                  <option key={hours} value={hours}>{hours} hours</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm text-gray-700 dark:text-gray-300">Days at today&apos;s dose</span>
              <input
                type="number"
                min="0"
                max={MAX_DAYS_AT_DOSE}
                step="1"
                value={daysAtCurrentDose}
                onChange={(e) => saveDaysAtCurrentDose(e.target.value)}
                className="w-28 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-gray-700 dark:text-gray-300">Carryover cadence</span>
              <select
                value={carryoverCadence}
                onChange={(e) => saveCarryoverCadence(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              >
                <option value="once">Once daily</option>
                <option value="twice">Twice daily</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm text-gray-700 dark:text-gray-300">Night penalty</span>
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={circadianStrengthPercent}
                onChange={(e) => saveCircadianStrengthPercent(e.target.value)}
                className="w-28"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">{Number(circadianStrengthPercent).toFixed(0)}%</p>
            </label>
            <label className="space-y-1">
              <span className="text-sm text-gray-700 dark:text-gray-300">Chronotype shift</span>
              <input
                type="range"
                min="-3"
                max="3"
                step="0.5"
                value={circadianShiftHours}
                onChange={(e) => saveCircadianShiftHours(e.target.value)}
                className="w-28"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">{Number(circadianShiftHours) > 0 ? "+" : ""}{Number(circadianShiftHours).toFixed(1)}h</p>
            </label>
            <button
              type="button"
              onClick={resetCircadianDefaults}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm"
            >
              Defaults
            </button>
            <button
              type="button"
              onClick={recalculateNow}
              className="px-3 py-2 rounded-lg border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-sm"
            >
              Recalculate
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Days at dose is capped at {MAX_DAYS_AT_DOSE} for stability. Carryover cadence should match your usual dosing schedule.
          </p>
          <div className="space-y-1 text-gray-900 dark:text-white">
            <p>Total logged: <strong>{metrics.totalMg.toFixed(3)} mg</strong></p>
            <p>Estimated active now: <strong>{metrics.activeMg.toFixed(3)} mg</strong></p>
            <p>Estimated sedation pressure now: <strong>{metrics.sedationPressure.toFixed(1)}%</strong></p>
            <p>Tolerance reduction from days at dose: <strong>{toleranceReductionPercent(daysAtCurrentDose).toFixed(1)}%</strong></p>
            {withdrawalThresholdMg !== null && (
              <p>
                Estimated time to withdrawal-risk threshold: <strong>{withdrawalCrossingInfo?.label || "-"}{withdrawalCrossingInfo?.hoursFromNow !== null && Number.isFinite(withdrawalCrossingInfo?.hoursFromNow) ? ` (~${withdrawalCrossingInfo.hoursFromNow.toFixed(1)}h)` : ""}</strong>
              </p>
            )}
            <p>Last recalculated: <strong>{new Date(recalcAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}</strong></p>
          </div>
          <div className={`rounded-lg p-3 bg-gray-50 dark:bg-gray-800 ${metrics.band.tone}`}>
            <p className="font-semibold">Sedation likelihood (rough): {metrics.band.level}</p>
            <p className="text-sm">Educational estimate only; individual response, tolerance, and interaction risk vary.</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Estimated Active Clonazepam</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">Decay curve based on selected half-life with estimated carryover from prior days at dose ({carryoverCadence === "twice" ? "twice daily" : "once daily"}). Timeline includes 72-hour projection.</p>
        {withdrawalThresholdMg !== null && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Dashed red line marks an estimated risk zone based on chronic exposure assumptions (not a diagnostic cutoff).
          </p>
        )}
        {chartData.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">Add at least one dose to view the graph.</p>
        ) : (
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" opacity={0.25} />
                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  ticks={chartTicks}
                  angle={-40}
                  textAnchor="end"
                  height={52}
                  tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                />
                <YAxis />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }}
                  labelStyle={{ color: "#f9fafb", fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: "#d1d5db" }}
                  labelFormatter={(value) => `🕐 ${formatChartTooltipDateTime(value)}`}
                  formatter={(value) => [`${value} mg`, "Estimated active"]}
                />
                <ReferenceLine
                  x={recalcAt}
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  isFront
                  label={{
                    value: `Now ${new Date(recalcAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
                    position: "insideTopRight",
                    fill: "#94a3b8",
                    fontSize: 11,
                  }}
                />
                {withdrawalThresholdMg !== null && (
                  <ReferenceLine
                    y={withdrawalThresholdMg}
                    stroke="#ef4444"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    ifOverflow="extendDomain"
                    label={{
                      value: `Est. risk zone ${withdrawalThresholdMg.toFixed(2)} mg`,
                      position: "insideBottomRight",
                      fill: "#ef4444",
                      fontSize: 11,
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="activeMg"
                  name="activeMg"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Sedation Pressure (Estimated)</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Gray shows baseline pressure with no tolerance; purple shows pressure adjusted by days at current dose ({daysAtCurrentDose}, {toleranceReductionPercent(daysAtCurrentDose).toFixed(1)}% reduction); cyan shows effective alertness.
        </p>
        {sedationPressureData.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">Add at least one dose to view the graph.</p>
        ) : (
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sedationPressureData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" opacity={0.25} />
                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  ticks={chartTicks}
                  angle={-40}
                  textAnchor="end"
                  height={52}
                  tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                />
                <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }}
                  labelStyle={{ color: "#f9fafb", fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: "#d1d5db" }}
                  labelFormatter={(value) => `🕐 ${formatChartTooltipDateTime(value)}`}
                  formatter={(value, name) => {
                    if (name === "pressureNoTolerance") return [`${value}%`, "Sedation pressure (no tolerance)"];
                    if (name === "pressure") return [`${value}%`, `Sedation pressure (${daysAtCurrentDose} days)`];
                    if (name === "circadianPenalty") return [`${value}%`, "Circadian sleep pressure"];
                    return [`${value}%`, "Effective alertness"];
                  }}
                />
                <ReferenceLine
                  x={recalcAt}
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  isFront
                  label={{
                    value: `Now ${new Date(recalcAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
                    position: "insideTopRight",
                    fill: "#94a3b8",
                    fontSize: 11,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="pressureNoTolerance"
                  name="pressureNoTolerance"
                  stroke="#9ca3af"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="pressure"
                  name="pressure"
                  stroke="#a855f7"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="circadianPenalty"
                  name="circadianPenalty"
                  stroke="#64748b"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="alertness"
                  name="alertness"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Caffeine × Clonazepam Interaction (Estimated)</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Purple is clonazepam sedation pressure, amber is caffeine counter-pressure (plotted negative), and cyan is net pressure (sedation minus stimulation).
        </p>
        {interactionData.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">Add at least one dose to view the graph.</p>
        ) : (
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={interactionData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" opacity={0.25} />
                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  ticks={chartTicks}
                  angle={-40}
                  textAnchor="end"
                  height={52}
                  tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                />
                <YAxis domain={[-100, 100]} tickFormatter={(value) => `${value}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }}
                  labelStyle={{ color: "#f9fafb", fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: "#d1d5db" }}
                  itemSorter={(item) => {
                    if (item?.name === "sedationPressure") return 0;
                    if (item?.name === "caffeineCounterPressureNeg") return 1;
                    return 2;
                  }}
                  labelFormatter={(value) => `🕐 ${formatChartTooltipDateTime(value)}`}
                  formatter={(value, name) => {
                    if (name === "sedationPressure") return [`${value}%`, "Clonazepam sedation pressure"];
                    if (name === "caffeineCounterPressureNeg") return [`${Math.abs(value)}%`, "Caffeine counter-pressure"];
                    return [`${value}%`, "Net pressure"];
                  }}
                />
                <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                <ReferenceLine
                  x={recalcAt}
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  isFront
                  label={{
                    value: `Now ${new Date(recalcAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
                    position: "insideTopRight",
                    fill: "#94a3b8",
                    fontSize: 11,
                  }}
                />
                <Line type="monotone" dataKey="sedationPressure" name="sedationPressure" stroke="#a855f7" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="caffeineCounterPressureNeg" name="caffeineCounterPressureNeg" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="netPressure" name="netPressure" stroke="#06b6d4" strokeWidth={2} strokeDasharray="5 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">Dose Log</h2>
          {combinedDoseLogEntries.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-sm px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Clear All
            </button>
          )}
        </div>

        {combinedDoseLogEntries.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No entries yet. Add your first dose above.</p>
        ) : (
          <div className="space-y-2">
            {combinedDoseLogEntries.map((entry) => (
              <div
                key={`${entry.source}-${entry.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
              >
                <div className="text-sm text-gray-900 dark:text-white">
                  {entry.source === "caffeine" ? (
                    <>
                      <strong>Caffeine</strong> · {Number(entry.caffeineMg || 0).toFixed(0)} mg · {formatCaffeineLogTimestamp(entry, recalcAt)}
                    </>
                  ) : (
                    <>
                      <strong>{entry.doseMg} mg</strong> · {formatDoseLogTimestamp(entry, recalcAt)}
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => clearEntry(entry)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                  aria-label="Delete entry"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Drug List</h2>
        <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
          <li>Clonazepam (tracked)</li>
          <li>Caffeine (interaction layer from Caffeine Tracker)</li>
        </ul>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Math Model</h2>
        <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 space-y-2">
          <p><strong>Clonazepam elimination:</strong> Active(t) = Dose × 0.5^((t − t_dose) / halfLifeHours)</p>
          <p><strong>Acute sedation kernel:</strong> Acute(t) = 100 × [Dose/(Dose + 0.25)] × (1 − e^(−elapsed/1.1)) × e^(−elapsed/6.5)</p>
          <p><strong>Tolerance factor:</strong> Tol(days) = 1 − 0.35 × (1 − e^(−days/10))</p>
          <p><strong>Sedation pressure:</strong> P_conc = 100 × Active/(Active + 0.5), P_blend = 0.4 × P_conc + 0.6 × min(100, Acute), P = clamp(P_blend × Tol, 0, 100)</p>
          <p><strong>Circadian sleep pressure:</strong> SleepPenalty = S × ((cos(2π × (hour − (3 + shift))/24) + 1)/2), where S = Night penalty (0–50%)</p>
          <p><strong>Effective alertness:</strong> Alertness = clamp(100 − P − SleepPenalty, 0, 100)</p>
          <p><strong>Caffeine counter-pressure:</strong> C = ActiveCaffeine_mg / weight_kg, Counter = 100 × C/(C + 2.0), Net = SedationPressure − Counter</p>
          <p><strong>Withdrawal risk threshold (estimated):</strong> decay = 0.5^(interval/halfLife), Trough_ss = Dose × [decay/(1 − decay)], Threshold = max(0.05, 0.45 × Trough_ss)</p>
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Educational tracker only and not medical advice. Benzodiazepines can cause dependence, withdrawal risks, sedation, and serious interactions (especially with opioids, alcohol, or other sedatives). Use only as prescribed and consult your clinician.
      </p>
    </div>
  );
}
