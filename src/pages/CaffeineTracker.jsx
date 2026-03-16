import React, { useMemo, useState } from "react";
import { Coffee, Trash2 } from "lucide-react";
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

const STORAGE_KEY = "caffeineTrackerEntries";
const WEIGHT_STORAGE_KEY = "caffeineTrackerWeight";
const WEIGHT_UNIT_STORAGE_KEY = "caffeineTrackerWeightUnit";
const SLEEP_TARGET_STORAGE_KEY = "caffeineTrackerSleepTarget";
const HALF_LIFE_STORAGE_KEY = "caffeineTrackerHalfLifeHours";
const DRINK_DURATION_STORAGE_KEY = "caffeineTrackerDrinkDuration";
const WAKE_TIME_STORAGE_KEY = "caffeineTrackerWakeTime";
const ACTIVITY_STORAGE_KEY = "caffeineTrackerActivityLevel";
const DAYS_AT_DOSE_STORAGE_KEY = "caffeineTrackerDaysAtDose";
const PROFILE_STORAGE_KEY = "caffeineTrackerProfilesV1";
const ACTIVE_PROFILE_ID_STORAGE_KEY = "caffeineTrackerActiveProfileId";

// Adenosine receptor occupancy via Hill equation (Kd ~2 mg/kg approximation)
const ADENOSINE_KD_MG_PER_KG = 2.0;
// Baseline waking hours to reach full adenosine pressure at resting metabolism
const ADENOSINE_FULL_BUILDUP_HOURS = 16;

// Activity level multipliers on ATP turnover rate (= adenosine production rate).
// More physical/mental work → more ATP hydrolysis → faster adenosine accumulation.
// Sedentary brain metabolic rate ~0.7x vs a moderate-activity day baseline.
const ACTIVITY_LEVELS = [
  { id: "sedentary",  label: "Sedentary",   multiplier: 0.7,  description: "Desk work, minimal movement (~1,400 kcal/day)" },
  { id: "moderate",  label: "Moderate",    multiplier: 1.0,  description: "Normal daily activity, light walking (~1,900 kcal/day)" },
  { id: "active",    label: "Active",      multiplier: 1.4,  description: "Exercise or physically demanding day (~2,600 kcal/day)" },
  { id: "very",      label: "Very Active", multiplier: 1.9,  description: "Hard training or heavy labor (~3,500+ kcal/day)" },
];

const CAFFEINE_PER_CUP_MG = {
  greenTea: 30,
  earlGray: 47,
  coffee: 95,
  instantCoffee: 55,
  coldBrew: 12,
};

const DRINK_LABELS = {
  greenTea: "Green Tea",
  earlGray: "Earl Grey Black Tea",
  coffee: "Coffee",
  instantCoffee: "Instant Coffee",
  coldBrew: "Cold Brew",
};

const DRINK_UNITS = {
  greenTea: { singular: "cup", plural: "cups", short: "cup" },
  earlGray: { singular: "cup", plural: "cups", short: "cup" },
  coffee: { singular: "cup", plural: "cups", short: "cup" },
  instantCoffee: { singular: "tbsp", plural: "tbsp", short: "tbsp" },
  coldBrew: { singular: "oz", plural: "oz", short: "oz" },
};

const DEFAULT_HALF_LIFE_HOURS = 5;
const HALF_LIFE_OPTIONS = [4, 5, 6];
const DISTRIBUTION_VOLUME_L_PER_KG = 0.7;
const MAX_DAYS_AT_DOSE = 365;

function toKg(weight, unit) {
  if (!weight || weight <= 0) return 0;
  return unit === "lb" ? weight * 0.45359237 : weight;
}

function receptorImpact(mgPerKg) {
  if (mgPerKg < 1) {
    return {
      level: "Low",
      text: "Mild adenosine receptor blockade. You may feel subtle alertness.",
      tone: "text-green-700 dark:text-green-300",
    };
  }
  if (mgPerKg < 2) {
    return {
      level: "Moderate",
      text: "Noticeable adenosine receptor blockade. Typical focused/alert range.",
      tone: "text-blue-700 dark:text-blue-300",
    };
  }
  if (mgPerKg < 4) {
    return {
      level: "High",
      text: "Strong adenosine receptor blockade. Sleep pressure can be delayed.",
      tone: "text-amber-700 dark:text-amber-300",
    };
  }
  return {
    level: "Very High",
    text: "Heavy adenosine receptor blockade. Higher chance of jitters and sleep disruption.",
    tone: "text-red-700 dark:text-red-300",
  };
}

function getNowLocalTime() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
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

function parseNextLocalTimeToDate(time, referenceMs = Date.now()) {
  const [h, m] = (time || "22:30").split(":").map(Number);
  const now = new Date(referenceMs);
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, m || 0, 0, 0);
  if (d.getTime() <= now.getTime()) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

// Spreads caffeine absorption uniformly across a drinking window.
// If durationMinutes is 0, treats it as an instant gulp.
function activeMgFromEntry(entry, atMs, referenceMs, halfLifeHours) {
  const startMs = parseLocalTimeToDate(entry.time, referenceMs).getTime();
  const durationMs = (entry.durationMinutes || 0) * 60 * 1000;

  if (durationMs <= 0) {
    if (atMs < startMs) return 0;
    const elapsedHours = (atMs - startMs) / (1000 * 60 * 60);
    return (entry.caffeineMg || 0) * Math.pow(0.5, elapsedHours / halfLifeHours);
  }

  // Divide into sips every 5 minutes across the drinking window
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

function bedtimeRisk(mgPerKgAtBedtime) {
  if (mgPerKgAtBedtime < 0.5) {
    return {
      level: "Low",
      tone: "text-green-700 dark:text-green-300",
      text: "Lower chance of sleep disruption at target bedtime.",
    };
  }
  if (mgPerKgAtBedtime < 1.0) {
    return {
      level: "Caution",
      tone: "text-amber-700 dark:text-amber-300",
      text: "Some adenosine blockade may remain near bedtime.",
    };
  }
  return {
    level: "High",
    tone: "text-red-700 dark:text-red-300",
    text: "Likely meaningful adenosine blockade at bedtime.",
  };
}

function caffeineToleranceFactor(daysAtDose) {
  const days = Math.max(0, Number(daysAtDose) || 0);
  const maxReduction = 0.4;
  const tauDays = 14;
  return 1 - maxReduction * (1 - Math.exp(-days / tauDays));
}

function caffeineToleranceReductionPercent(daysAtDose) {
  return (1 - caffeineToleranceFactor(daysAtDose)) * 100;
}

function buildProfileId() {
  return `caffeine-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultProfile(name = "Default") {
  return {
    id: buildProfileId(),
    name,
    weight: 170,
    weightUnit: "lb",
    wakeTime: "06:30",
    activityLevel: "moderate",
    drinkType: "greenTea",
    cups: 1,
    time: getNowLocalTime(),
    drinkDuration: 15,
    sleepTarget: "22:30",
    halfLifeHours: DEFAULT_HALF_LIFE_HOURS,
    daysAtDose: 0,
    entries: [],
  };
}

function sanitizeProfile(raw, fallbackName = "Default") {
  const base = createDefaultProfile(fallbackName);
  const safeActivity = ACTIVITY_LEVELS.some((a) => a.id === raw?.activityLevel) ? raw.activityLevel : base.activityLevel;
  const safeHalfLife = HALF_LIFE_OPTIONS.includes(Number(raw?.halfLifeHours)) ? Number(raw.halfLifeHours) : base.halfLifeHours;
  const safeEntries = Array.isArray(raw?.entries) ? raw.entries : base.entries;
  const rawDays = Number(raw?.daysAtDose);
  const safeDaysAtDose = Number.isFinite(rawDays) && rawDays >= 0
    ? Math.min(MAX_DAYS_AT_DOSE, Math.round(rawDays))
    : base.daysAtDose;

  return {
    ...base,
    ...raw,
    id: raw?.id || base.id,
    name: (raw?.name || fallbackName || base.name).trim() || base.name,
    weight: Number.isFinite(Number(raw?.weight)) && Number(raw.weight) > 0 ? Number(raw.weight) : base.weight,
    weightUnit: raw?.weightUnit === "kg" ? "kg" : "lb",
    wakeTime: raw?.wakeTime || base.wakeTime,
    activityLevel: safeActivity,
    drinkType: DRINK_LABELS[raw?.drinkType] ? raw.drinkType : base.drinkType,
    cups: Number.isFinite(Number(raw?.cups)) && Number(raw.cups) > 0 ? Number(raw.cups) : base.cups,
    time: raw?.time || base.time,
    drinkDuration: Number.isFinite(Number(raw?.drinkDuration)) && Number(raw.drinkDuration) >= 0
      ? Math.round(Number(raw.drinkDuration))
      : base.drinkDuration,
    sleepTarget: raw?.sleepTarget || base.sleepTarget,
    halfLifeHours: safeHalfLife,
    daysAtDose: safeDaysAtDose,
    entries: safeEntries,
  };
}

function loadProfilesFromStorage() {
  try {
    const rawProfiles = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "[]");
    if (Array.isArray(rawProfiles) && rawProfiles.length > 0) {
      return rawProfiles.map((profile, idx) => sanitizeProfile(profile, profile?.name || `User ${idx + 1}`));
    }
  } catch {
    // fallback to migration from legacy keys
  }

  let legacyEntries = [];
  try {
    const rawEntries = localStorage.getItem(STORAGE_KEY);
    legacyEntries = rawEntries ? JSON.parse(rawEntries) : [];
  } catch {
    legacyEntries = [];
  }

  const migrated = sanitizeProfile({
    id: "caffeine-user-default",
    name: "Default",
    weight: Number(localStorage.getItem(WEIGHT_STORAGE_KEY) || 170),
    weightUnit: localStorage.getItem(WEIGHT_UNIT_STORAGE_KEY) || "lb",
    wakeTime: localStorage.getItem(WAKE_TIME_STORAGE_KEY) || "06:30",
    activityLevel: localStorage.getItem(ACTIVITY_STORAGE_KEY) || "moderate",
    drinkType: "greenTea",
    cups: 1,
    time: getNowLocalTime(),
    drinkDuration: Number(localStorage.getItem(DRINK_DURATION_STORAGE_KEY) || 15),
    sleepTarget: localStorage.getItem(SLEEP_TARGET_STORAGE_KEY) || "22:30",
    halfLifeHours: Number(localStorage.getItem(HALF_LIFE_STORAGE_KEY) || DEFAULT_HALF_LIFE_HOURS),
    daysAtDose: Number(localStorage.getItem(DAYS_AT_DOSE_STORAGE_KEY) || 0),
    entries: Array.isArray(legacyEntries) ? legacyEntries : [],
  });

  return [migrated];
}

export default function CaffeineTracker() {
  const [profiles, setProfiles] = useState(() => loadProfilesFromStorage());
  const [activeProfileId, setActiveProfileId] = useState(() => {
    const saved = localStorage.getItem(ACTIVE_PROFILE_ID_STORAGE_KEY);
    const loaded = loadProfilesFromStorage();
    if (saved && loaded.some((profile) => profile.id === saved)) return saved;
    return loaded[0]?.id || "caffeine-user-default";
  });
  const [newUserName, setNewUserName] = useState("");

  const initialActiveProfile = profiles.find((profile) => profile.id === activeProfileId) || profiles[0] || createDefaultProfile("Default");

  const [weight, setWeight] = useState(() => {
    return initialActiveProfile.weight;
  });
  const [weightUnit, setWeightUnit] = useState(() => {
    return initialActiveProfile.weightUnit;
  });
  const [wakeTime, setWakeTime] = useState(() => {
    return initialActiveProfile.wakeTime;
  });
  const [activityLevel, setActivityLevel] = useState(() => {
    return initialActiveProfile.activityLevel;
  });
  const [drinkType, setDrinkType] = useState(initialActiveProfile.drinkType);
  const [cups, setCups] = useState(initialActiveProfile.cups);
  const [time, setTime] = useState(initialActiveProfile.time);
  const [drinkDuration, setDrinkDuration] = useState(() => {
    return initialActiveProfile.drinkDuration;
  });
  const [sleepTarget, setSleepTarget] = useState(() => {
    return initialActiveProfile.sleepTarget;
  });
  const [halfLifeHours, setHalfLifeHours] = useState(() => {
    return initialActiveProfile.halfLifeHours;
  });
  const [entries, setEntries] = useState(() => {
    return Array.isArray(initialActiveProfile.entries) ? initialActiveProfile.entries : [];
  });
  const [daysAtDose, setDaysAtDose] = useState(() => {
    return Number(initialActiveProfile.daysAtDose) || 0;
  });
  const [recalcAt, setRecalcAt] = useState(() => Date.now());
  const selectedDrinkUnit = DRINK_UNITS[drinkType] || DRINK_UNITS.coffee;

  const activeProfile = useMemo(() => {
    return profiles.find((profile) => profile.id === activeProfileId) || profiles[0] || null;
  }, [profiles, activeProfileId]);

  const syncLegacyStorage = (profile) => {
    if (!profile) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile.entries || []));
    localStorage.setItem(WEIGHT_STORAGE_KEY, String(profile.weight || ""));
    localStorage.setItem(WEIGHT_UNIT_STORAGE_KEY, profile.weightUnit || "lb");
    localStorage.setItem(SLEEP_TARGET_STORAGE_KEY, profile.sleepTarget || "22:30");
    localStorage.setItem(HALF_LIFE_STORAGE_KEY, String(profile.halfLifeHours || DEFAULT_HALF_LIFE_HOURS));
    localStorage.setItem(DRINK_DURATION_STORAGE_KEY, String(profile.drinkDuration || 0));
    localStorage.setItem(WAKE_TIME_STORAGE_KEY, profile.wakeTime || "06:30");
    localStorage.setItem(ACTIVITY_STORAGE_KEY, profile.activityLevel || "moderate");
    localStorage.setItem(DAYS_AT_DOSE_STORAGE_KEY, String(profile.daysAtDose || 0));
  };

  const saveProfiles = (nextProfiles, nextActiveProfileId = activeProfileId) => {
    setProfiles(nextProfiles);
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(nextProfiles));
    localStorage.setItem(ACTIVE_PROFILE_ID_STORAGE_KEY, nextActiveProfileId);
  };

  const saveActiveProfile = (partialUpdates) => {
    if (!activeProfile) return;
    const updatedProfile = sanitizeProfile({
      ...activeProfile,
      weight,
      weightUnit,
      wakeTime,
      activityLevel,
      drinkType,
      cups,
      time,
      drinkDuration,
      sleepTarget,
      halfLifeHours,
      daysAtDose,
      entries,
      ...partialUpdates,
    }, activeProfile.name);

    const nextProfiles = profiles.map((profile) => (profile.id === activeProfile.id ? updatedProfile : profile));
    saveProfiles(nextProfiles, activeProfile.id);
    syncLegacyStorage(updatedProfile);
  };

  const applyProfileToState = (profile) => {
    if (!profile) return;
    setWeight(profile.weight);
    setWeightUnit(profile.weightUnit);
    setWakeTime(profile.wakeTime);
    setActivityLevel(profile.activityLevel);
    setDrinkType(profile.drinkType);
    setCups(profile.cups);
    setTime(profile.time);
    setDrinkDuration(profile.drinkDuration);
    setSleepTarget(profile.sleepTarget);
    setHalfLifeHours(profile.halfLifeHours);
    setDaysAtDose(Number(profile.daysAtDose) || 0);
    setEntries(Array.isArray(profile.entries) ? profile.entries : []);
    syncLegacyStorage(profile);
  };

  const switchActiveProfile = (nextProfileId) => {
    const nextProfile = profiles.find((profile) => profile.id === nextProfileId);
    if (!nextProfile) return;
    setActiveProfileId(nextProfileId);
    localStorage.setItem(ACTIVE_PROFILE_ID_STORAGE_KEY, nextProfileId);
    applyProfileToState(nextProfile);
    setRecalcAt(Date.now());
  };

  const addUserProfile = () => {
    const name = newUserName.trim();
    if (!name) return;

    const newProfile = createDefaultProfile(name);
    const nextProfiles = [...profiles, newProfile];
    setActiveProfileId(newProfile.id);
    saveProfiles(nextProfiles, newProfile.id);
    applyProfileToState(newProfile);
    setNewUserName("");
    setRecalcAt(Date.now());
  };

  const saveWeight = (nextWeight, nextUnit = weightUnit) => {
    localStorage.setItem(WEIGHT_STORAGE_KEY, String(nextWeight || ""));
    localStorage.setItem(WEIGHT_UNIT_STORAGE_KEY, nextUnit);
    saveActiveProfile({ weight: Number(nextWeight), weightUnit: nextUnit });
  };

  const saveSleepTarget = (next) => {
    setSleepTarget(next);
    localStorage.setItem(SLEEP_TARGET_STORAGE_KEY, next);
    saveActiveProfile({ sleepTarget: next });
  };

  const saveWakeTime = (next) => {
    setWakeTime(next);
    localStorage.setItem(WAKE_TIME_STORAGE_KEY, next);
    saveActiveProfile({ wakeTime: next });
  };

  const saveActivityLevel = (next) => {
    setActivityLevel(next);
    localStorage.setItem(ACTIVITY_STORAGE_KEY, next);
    saveActiveProfile({ activityLevel: next });
  };

  const saveDrinkDuration = (next) => {
    const value = Math.max(0, Math.round(Number(next) || 0));
    setDrinkDuration(value);
    localStorage.setItem(DRINK_DURATION_STORAGE_KEY, String(value));
    saveActiveProfile({ drinkDuration: value });
  };

  const saveHalfLifeHours = (next) => {
    const value = Number(next);
    const safeValue = HALF_LIFE_OPTIONS.includes(value) ? value : DEFAULT_HALF_LIFE_HOURS;
    setHalfLifeHours(safeValue);
    localStorage.setItem(HALF_LIFE_STORAGE_KEY, String(safeValue));
    saveActiveProfile({ halfLifeHours: safeValue });
  };

  const saveDaysAtDose = (next) => {
    const value = Math.min(MAX_DAYS_AT_DOSE, Math.max(0, Math.round(Number(next) || 0)));
    setDaysAtDose(value);
    localStorage.setItem(DAYS_AT_DOSE_STORAGE_KEY, String(value));
    saveActiveProfile({ daysAtDose: value });
  };

  const saveEntries = (nextEntries) => {
    setEntries(nextEntries);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries));
    saveActiveProfile({ entries: nextEntries });
  };

  const addEntry = (e) => {
    e.preventDefault();
    const cupsNumber = Number(cups);
    if (!cupsNumber || cupsNumber <= 0) return;
    const caffeineMg = cupsNumber * (CAFFEINE_PER_CUP_MG[drinkType] || 0);
    const next = [
      {
        id: crypto.randomUUID(),
        drinkType,
        cups: cupsNumber,
        caffeineMg,
        time,
        durationMinutes: drinkDuration,
        createdAt: Date.now(),
      },
      ...entries,
    ];
    saveEntries(next);
    setCups(1);
    setTime(getNowLocalTime());
    setRecalcAt(Date.now());
  };

  const clearEntry = (id) => {
    saveEntries(entries.filter((entry) => entry.id !== id));
  };

  const clearAll = () => {
    saveEntries([]);
  };

  const recalculateNow = () => {
    const now = Date.now();
    setRecalcAt((prev) => (now <= prev ? prev + 1 : now));
  };

  const metrics = useMemo(() => {
    const totalMg = entries.reduce((sum, entry) => sum + (entry.caffeineMg || 0), 0);
    const kg = toKg(Number(weight), weightUnit);
    const mgPerKg = kg > 0 ? totalMg / kg : 0;

    const now = recalcAt;
    const remainingMg = entries.reduce((sum, entry) => sum + activeMgFromEntry(entry, now, now, halfLifeHours), 0);

    const remainingMgPerKg = kg > 0 ? remainingMg / kg : 0;
    const toleranceFactor = caffeineToleranceFactor(daysAtDose);
    const effectiveRemainingMgPerKg = remainingMgPerKg * toleranceFactor;
    const bloodMgPerL = kg > 0 ? remainingMg / (DISTRIBUTION_VOLUME_L_PER_KG * kg) : 0;
    return {
      totalMg,
      mgPerKg,
      remainingMg,
      remainingMgPerKg,
      effectiveRemainingMgPerKg,
      bloodMgPerL,
      impact: receptorImpact(effectiveRemainingMgPerKg),
    };
  }, [entries, weight, weightUnit, recalcAt, halfLifeHours, daysAtDose]);

  const bloodChartData = useMemo(() => {
    if (!entries.length) return [];

    const kg = toKg(Number(weight), weightUnit);
    if (kg <= 0) return [];

    const now = recalcAt;
    const consumedTimes = entries.map((entry) => parseLocalTimeToDate(entry.time, now).getTime());
    const earliest = Math.min(...consumedTimes);

    const start = Math.max(earliest - 60 * 60 * 1000, now - 24 * 60 * 60 * 1000);
    const end = now + 8 * 60 * 60 * 1000;
    const stepMs = 30 * 60 * 1000;

    const rawPoints = [];

    for (let t = start; t <= end; t += stepMs) {
      const activeMg = entries.reduce((sum, entry) => sum + activeMgFromEntry(entry, t, now, halfLifeHours), 0);

      const pointTimeLabel = new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const bloodValue = Number((activeMg / (DISTRIBUTION_VOLUME_L_PER_KG * kg)).toFixed(3));
      const activeMgPerKg = Number((activeMg / kg).toFixed(3));
      let band = "low";
      if (activeMgPerKg >= 3) band = "high";
      else if (activeMgPerKg >= 2) band = "elevated";
      else if (activeMgPerKg >= 1) band = "moderate";

      rawPoints.push({
        ts: t,
        time: pointTimeLabel,
        bloodMgPerL: bloodValue,
        activeMg: Number(activeMg.toFixed(1)),
        activeMgPerKg,
        band,
      });
    }

    const thresholds = [1, 2, 3];
    const expanded = [];

    for (let i = 0; i < rawPoints.length; i++) {
      const current = rawPoints[i];
      const previous = rawPoints[i - 1];

      if (!previous) {
        expanded.push(current);
        continue;
      }

      const low = Math.min(previous.activeMgPerKg, current.activeMgPerKg);
      const high = Math.max(previous.activeMgPerKg, current.activeMgPerKg);
      const crossed = thresholds.filter((t) => t > low && t < high);

      if (crossed.length > 0 && current.activeMgPerKg !== previous.activeMgPerKg) {
        const sortedCrossed = previous.activeMgPerKg < current.activeMgPerKg ? crossed : crossed.reverse();

        for (const t of sortedCrossed) {
          const ratio = (t - previous.activeMgPerKg) / (current.activeMgPerKg - previous.activeMgPerKg);
          const transitionTs = Math.round(previous.ts + ratio * (current.ts - previous.ts));
          const transitionBlood = Number((previous.bloodMgPerL + ratio * (current.bloodMgPerL - previous.bloodMgPerL)).toFixed(3));

          expanded.push({
            ...current,
            ts: transitionTs,
            time: new Date(transitionTs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
            bloodMgPerL: transitionBlood,
            activeMgPerKg: t,
            band: t < 1 ? "low" : t < 2 ? "moderate" : t < 3 ? "elevated" : "high",
            transitionThreshold: t,
          });
        }
      }

      expanded.push(current);
    }

    return expanded.map((point) => {
      let bloodLow = point.band === "low" ? point.bloodMgPerL : null;
      let bloodModerate = point.band === "moderate" ? point.bloodMgPerL : null;
      let bloodElevated = point.band === "elevated" ? point.bloodMgPerL : null;
      let bloodHigh = point.band === "high" ? point.bloodMgPerL : null;

      if (point.transitionThreshold === 1) {
        bloodLow = point.bloodMgPerL;
        bloodModerate = point.bloodMgPerL;
      } else if (point.transitionThreshold === 2) {
        bloodModerate = point.bloodMgPerL;
        bloodElevated = point.bloodMgPerL;
      } else if (point.transitionThreshold === 3) {
        bloodElevated = point.bloodMgPerL;
        bloodHigh = point.bloodMgPerL;
      }

      return {
        ...point,
        bloodLow,
        bloodModerate,
        bloodElevated,
        bloodHigh,
      };
    });
  }, [entries, weight, weightUnit, sleepTarget, recalcAt, halfLifeHours]);

  const timeToLow = useMemo(() => {
    const current = metrics.remainingMgPerKg;
    const target = 1.0;
    if (!Number.isFinite(current) || current <= 0) {
      return null;
    }
    if (current <= target) {
      return {
        label: "Now",
        at: new Date(recalcAt),
      };
    }

    const hoursToTarget = halfLifeHours * (Math.log(target / current) / Math.log(0.5));
    const etaMs = recalcAt + Math.max(0, hoursToTarget) * 60 * 60 * 1000;
    const eta = new Date(etaMs);
    return {
      label: eta.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      at: eta,
    };
  }, [metrics.remainingMgPerKg, recalcAt, halfLifeHours]);

  const bedtimeProjection = useMemo(() => {
    const kg = toKg(Number(weight), weightUnit);
    if (!entries.length || kg <= 0) return null;

    const bedtime = parseNextLocalTimeToDate(sleepTarget, recalcAt);
    const bedtimeMs = bedtime.getTime();

    const activeMgAtBedtime = entries.reduce((sum, entry) => sum + activeMgFromEntry(entry, bedtimeMs, recalcAt, halfLifeHours), 0);

    const mgPerKgAtBedtime = activeMgAtBedtime / kg;
    const effectiveMgPerKgAtBedtime = mgPerKgAtBedtime * caffeineToleranceFactor(daysAtDose);
    return {
      bedtime,
      activeMgAtBedtime,
      mgPerKgAtBedtime,
      effectiveMgPerKgAtBedtime,
      risk: bedtimeRisk(effectiveMgPerKgAtBedtime),
    };
  }, [entries, weight, weightUnit, sleepTarget, recalcAt, halfLifeHours, daysAtDose]);

  const sleepMarkerColor = useMemo(() => {
    const level = bedtimeProjection?.risk?.level;
    if (level === "Low") return "#16a34a";
    if (level === "Caution") return "#d97706";
    return "#ef4444";
  }, [bedtimeProjection]);

  // Adenosine buildup chart: natural (ATP-scaled) vs perceived (caffeine-modulated)
  const adenosineChartData = useMemo(() => {
    const kg = toKg(Number(weight), weightUnit);
    const now = recalcAt;
    const wakeMs = parseLocalTimeToDate(wakeTime, now).getTime();
    const bedtimeMs = parseNextLocalTimeToDate(sleepTarget, now).getTime();
    const activityMultiplier = ACTIVITY_LEVELS.find((a) => a.id === activityLevel)?.multiplier ?? 1.0;
    const toleranceFactor = caffeineToleranceFactor(daysAtDose);

    // Span from wake to bedtime, step every 30 min
    const stepMs = 30 * 60 * 1000;
    const points = [];

    for (let t = wakeMs; t <= bedtimeMs; t += stepMs) {
      const hoursAwake = (t - wakeMs) / (1000 * 60 * 60);
      // Natural adenosine scales with ATP turnover rate (activity multiplier).
      // Higher activity = more ATP hydrolysis = faster adenosine accumulation.
      const natural = Math.min(100, (hoursAwake * activityMultiplier / ADENOSINE_FULL_BUILDUP_HOURS) * 100);

      // Active caffeine at this moment, expressed as mg/kg
      const activeMg = kg > 0
        ? entries.reduce((sum, entry) => sum + activeMgFromEntry(entry, t, now, halfLifeHours), 0)
        : 0;
      const activeMgPerKg = kg > 0 ? activeMg / kg : 0;
      const effectiveMgPerKg = activeMgPerKg * toleranceFactor;

      // Caffeine receptor blockade fraction (Hill / Michaelis–Menten)
      const blockade = effectiveMgPerKg / (effectiveMgPerKg + ADENOSINE_KD_MG_PER_KG);
      const blockadeNoTolerance = activeMgPerKg / (activeMgPerKg + ADENOSINE_KD_MG_PER_KG);

      // Perceived pressure = natural pressure that gets through unblocked receptors
      const perceived = natural * (1 - blockade);
      const perceivedNoTolerance = natural * (1 - blockadeNoTolerance);

      points.push({
        ts: t,
        time: new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        natural: Number(natural.toFixed(1)),
        perceivedNoTolerance: Number(perceivedNoTolerance.toFixed(1)),
        perceived: Number(perceived.toFixed(1)),
      });
    }

    return points;
  }, [entries, weight, weightUnit, wakeTime, sleepTarget, activityLevel, recalcAt, halfLifeHours, daysAtDose]);

  const sharedXAxis = useMemo(() => {
    const hourMs = 60 * 60 * 1000;
    const starts = [];
    const ends = [];

    if (bloodChartData.length) {
      starts.push(bloodChartData[0].ts);
      ends.push(bloodChartData[bloodChartData.length - 1].ts);
    }
    if (adenosineChartData.length) {
      starts.push(adenosineChartData[0].ts);
      ends.push(adenosineChartData[adenosineChartData.length - 1].ts);
    }

    if (!starts.length || !ends.length) {
      return {
        domain: ["dataMin", "dataMax"],
        ticks: [],
      };
    }

    const minTs = Math.min(...starts);
    const maxTs = Math.max(...ends);
    const domainStart = Math.floor(minTs / hourMs) * hourMs;
    const domainEnd = Math.ceil(maxTs / hourMs) * hourMs;

    const ticks = [];
    for (let t = domainStart; t <= domainEnd; t += hourMs) {
      ticks.push(t);
    }

    return {
      domain: [domainStart, domainEnd],
      ticks,
    };
  }, [bloodChartData, adenosineChartData]);

  return (
    <div className="w-full px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Coffee className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Caffeine Tracker</h1>
          <p className="text-gray-600 dark:text-gray-400">Track green tea, Earl Grey black tea, coffee, and cold brew relative to your body weight.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">Your Inputs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 items-end">
            <label className="space-y-1">
              <span className="text-sm text-gray-700 dark:text-gray-300">User</span>
              <select
                value={activeProfileId}
                onChange={(e) => switchActiveProfile(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm text-gray-700 dark:text-gray-300">New User</span>
              <input
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addUserProfile();
                  }
                }}
                placeholder="Name"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              />
            </label>
            <button
              type="button"
              onClick={addUserProfile}
              className="px-4 py-2 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
            >
              Add User
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-sm text-gray-700 dark:text-gray-300">Weight</span>
              <input
                type="number"
                min="1"
                step="0.1"
                value={weight}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setWeight(next);
                  saveWeight(next, weightUnit);
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-gray-700 dark:text-gray-300">Unit</span>
              <select
                value={weightUnit}
                onChange={(e) => {
                  const nextUnit = e.target.value;
                  setWeightUnit(nextUnit);
                  saveWeight(weight, nextUnit);
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              >
                <option value="lb">lb</option>
                <option value="kg">kg</option>
              </select>
            </label>
          </div>

          <form onSubmit={addEntry} className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="space-y-1 sm:col-span-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Drink</span>
                <select
                  value={drinkType}
                  onChange={(e) => setDrinkType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                >
                  <option value="greenTea">Green Tea (~30 mg/cup)</option>
                  <option value="earlGray">Earl Grey Black Tea (~47 mg/cup)</option>
                  <option value="coffee">Coffee (~95 mg/cup)</option>
                  <option value="instantCoffee">Instant Coffee (~55 mg/tbsp)</option>
                  <option value="coldBrew">Cold Brew (~12 mg/oz)</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-sm text-gray-700 dark:text-gray-300">Amount ({selectedDrinkUnit.short})</span>
                <input
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={cups}
                  onChange={(e) => setCups(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                />
              </label>
            </div>

            {drinkType === "coldBrew" && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-600 dark:text-gray-400">Cold brew presets:</span>
                {[8, 12, 16, 20].map((oz) => (
                  <button
                    key={oz}
                    type="button"
                    onClick={() => setCups(oz)}
                    className="px-2.5 py-1 rounded-md border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-xs"
                  >
                    {oz} oz
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-end gap-3 flex-wrap">
              <label className="space-y-1">
                <span className="text-sm text-gray-700 dark:text-gray-300">Start time</span>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm text-gray-700 dark:text-gray-300" title="How long did you spend drinking it? 0 = instant gulp.">Drinking duration (min)</span>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={drinkDuration}
                  onChange={(e) => saveDrinkDuration(e.target.value)}
                  className="w-24 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                />
              </label>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium"
              >
                Add Intake
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">Adenosine Receptor Snapshot</h2>
          <div className="text-sm text-gray-600 dark:text-gray-400">Using a {halfLifeHours}-hour caffeine half-life estimate.</div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={recalculateNow}
              className="px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-sm"
            >
              Recalculate
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Last recalculated: {new Date(recalcAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
          <div className="flex items-end gap-3">
            <label className="space-y-1">
               <span
                 className="text-sm text-gray-700 dark:text-gray-300 cursor-help"
                 title="Lower half-life (e.g. 4h) = faster clearance, common in people who smoke or take certain meds. Higher half-life (e.g. 6h) = slower clearance, common with oral contraceptives, pregnancy, or certain medications."
               >Half-life</span>
              <select
                value={halfLifeHours}
                onChange={(e) => saveHalfLifeHours(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              >
                {HALF_LIFE_OPTIONS.map((hours) => (
                  <option key={hours} value={hours}>{hours} hours</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400">Lower half-life means faster caffeine clearance.</p>
            </label>
            <label className="space-y-1">
              <span className="text-sm text-gray-700 dark:text-gray-300">Days at this caffeine dose</span>
              <input
                type="number"
                min="0"
                max={MAX_DAYS_AT_DOSE}
                step="1"
                value={daysAtDose}
                onChange={(e) => saveDaysAtDose(e.target.value)}
                className="w-28 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">Tolerance adjustment: {caffeineToleranceReductionPercent(daysAtDose).toFixed(1)}% reduction in modeled receptor impact.</p>
            </label>
            <label className="space-y-1">
              <span className="text-sm text-gray-700 dark:text-gray-300">Wake Time</span>
              <input
                type="time"
                value={wakeTime}
                onChange={(e) => saveWakeTime(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              />
            </label>
            <label className="space-y-1">
              <span
                className="text-sm text-gray-700 dark:text-gray-300 cursor-help"
                title="Adenosine is a byproduct of ATP hydrolysis. More physical or mental work burns more ATP, producing adenosine faster. Higher activity = steeper sleep pressure curve."
              >Activity Level</span>
              <select
                value={activityLevel}
                onChange={(e) => saveActivityLevel(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              >
                {ACTIVITY_LEVELS.map((a) => (
                  <option key={a.id} value={a.id} title={a.description}>{a.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {ACTIVITY_LEVELS.find((a) => a.id === activityLevel)?.description}
              </p>
            </label>
            <label className="space-y-1">
              <span className="text-sm text-gray-700 dark:text-gray-300">Sleep Target</span>
              <input
                type="time"
                value={sleepTarget}
                onChange={(e) => saveSleepTarget(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              />
            </label>
          </div>
          <div className="space-y-1 text-gray-900 dark:text-white">
            <p>Total today: <strong>{metrics.totalMg.toFixed(0)} mg</strong></p>
            <p>Total today by weight: <strong>{metrics.mgPerKg.toFixed(2)} mg/kg</strong></p>
            <p>Estimated active now: <strong>{metrics.remainingMg.toFixed(0)} mg</strong></p>
            <p>Active now by weight: <strong>{metrics.remainingMgPerKg.toFixed(2)} mg/kg</strong></p>
            <p>Tolerance-adjusted active by weight: <strong>{metrics.effectiveRemainingMgPerKg.toFixed(2)} mg/kg</strong></p>
            <p>Estimated caffeine in blood: <strong>{metrics.bloodMgPerL.toFixed(3)} mg/L</strong></p>
            <p>
              Estimated time to Low (&lt; 1.00 mg/kg): <strong>{timeToLow?.label ?? "-"}</strong>
            </p>
            {bedtimeProjection && (
              <>
                <p>
                  Estimated active at bedtime ({bedtimeProjection.bedtime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}): <strong>{bedtimeProjection.activeMgAtBedtime.toFixed(0)} mg</strong>
                </p>
                <p>
                  Bedtime active by weight: <strong>{bedtimeProjection.mgPerKgAtBedtime.toFixed(2)} mg/kg</strong>
                </p>
                <p>
                  Bedtime tolerance-adjusted by weight: <strong>{bedtimeProjection.effectiveMgPerKgAtBedtime.toFixed(2)} mg/kg</strong>
                </p>
              </>
            )}
          </div>
          {bedtimeProjection && (
            <div className={`rounded-lg p-3 bg-gray-50 dark:bg-gray-800 ${bedtimeProjection.risk.tone}`}>
              <p className="font-semibold">Bedtime risk: {bedtimeProjection.risk.level}</p>
              <p className="text-sm">{bedtimeProjection.risk.text}</p>
            </div>
          )}
          <div className={`rounded-lg p-3 bg-gray-50 dark:bg-gray-800 ${metrics.impact.tone}`}>
            <p className="font-semibold">Impact: {metrics.impact.level}</p>
            <p className="text-sm">{metrics.impact.text}</p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            This is educational tracking, not medical advice. Individual sensitivity, tolerance, and metabolism vary.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Caffeine in Blood (Estimated)</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Curve shows estimated blood concentration (mg/L) from your logged servings, including future decay.
        </p>
        {bloodChartData.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">Add at least one intake entry to view the graph.</p>
        ) : (
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart syncId="caffeine-timeline" data={bloodChartData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" opacity={0.25} />
                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={sharedXAxis.domain}
                  ticks={sharedXAxis.ticks}
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
                  labelFormatter={(value) => `🕐 ${new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
                  formatter={(value, name, item) => {
                    const mgPerKg = item?.payload?.activeMgPerKg ?? 0;
                    let likelihood = "Low";
                    if (mgPerKg >= 3) likelihood = "High";
                    else if (mgPerKg >= 2) likelihood = "Elevated";
                    else if (mgPerKg >= 1) likelihood = "Moderate";
                    return [`${value} mg/L (${mgPerKg.toFixed(2)} mg/kg, ${likelihood} anxiety likelihood)`, "Blood concentration"];
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
                {bedtimeProjection && (
                  <ReferenceLine
                    x={bedtimeProjection.bedtime.getTime()}
                    stroke={sleepMarkerColor}
                    strokeDasharray="4 4"
                    ifOverflow="extendDomain"
                    isFront
                    label={{
                      value: `Sleep ${bedtimeProjection.bedtime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
                      position: "top",
                      fill: sleepMarkerColor,
                      fontSize: 12,
                    }}
                  />
                )}
                <Line type="monotone" dataKey="bloodLow" name="bloodMgPerL" stroke="#22c55e" strokeWidth={2.5} dot={false} connectNulls={false} />
                <Line type="monotone" dataKey="bloodModerate" name="bloodMgPerL" stroke="#eab308" strokeWidth={2.5} dot={false} connectNulls={false} />
                <Line type="monotone" dataKey="bloodElevated" name="bloodMgPerL" stroke="#f97316" strokeWidth={2.5} dot={false} connectNulls={false} />
                <Line type="monotone" dataKey="bloodHigh" name="bloodMgPerL" stroke="#ef4444" strokeWidth={2.5} dot={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Anxiety likelihood coloring by active caffeine dose: <span className="text-green-500">Low (&lt;1 mg/kg)</span> · <span className="text-yellow-500">Moderate (1-2 mg/kg)</span> · <span className="text-orange-500">Elevated (2-3 mg/kg)</span> · <span className="text-red-500">High (&ge;3 mg/kg)</span>
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Adenosine Buildup (Estimated)</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <span className="inline-block w-3 h-0.5 bg-emerald-400 mr-1 align-middle"></span> Natural adenosine accumulates as cells burn ATP — faster with higher activity.
          {" "}<span className="inline-block w-3 h-0.5 bg-amber-400 mr-1 align-middle"></span> Perceived pressure (no tolerance) is a baseline.
          {" "}<span className="inline-block w-3 h-0.5 bg-violet-500 mr-1 align-middle"></span> Perceived pressure (tolerance-adjusted) reflects days at this caffeine dose.
          Caffeine masks the signal, not the buildup — the gap closes as caffeine clears, causing rebound fatigue. Perceived line is tolerance-adjusted using days at this caffeine dose.
        </p>
        {adenosineChartData.length < 2 ? (
          <p className="text-gray-500 dark:text-gray-400">Set a wake time and sleep target to view the graph.</p>
        ) : (
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart syncId="caffeine-timeline" data={adenosineChartData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" opacity={0.25} />
                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={sharedXAxis.domain}
                  ticks={sharedXAxis.ticks}
                  angle={-40}
                  textAnchor="end"
                  height={52}
                  tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }}
                  labelStyle={{ color: "#f9fafb", fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: "#d1d5db" }}
                  labelFormatter={(value) => `🕐 ${new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
                  formatter={(value, name) => {
                    if (name === "natural") return [`${value}%`, "Natural pressure"];
                    if (name === "perceivedNoTolerance") return [`${value}%`, "Perceived pressure (no tolerance)"];
                    return [`${value}%`, "Perceived pressure (tolerance-adjusted)"];
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
                  dataKey="natural"
                  name="natural"
                  stroke="#34d399"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="perceivedNoTolerance"
                  name="perceivedNoTolerance"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="perceived"
                  name="perceived"
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">Today&apos;s Intake Log</h2>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-sm px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Clear All
            </button>
          )}
        </div>

        {entries.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No entries yet. Add your first drink above.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
              >
                <div className="text-sm text-gray-900 dark:text-white">
                  <strong>{DRINK_LABELS[entry.drinkType]}</strong> · {entry.cups} {(DRINK_UNITS[entry.drinkType] || DRINK_UNITS.coffee)[entry.cups === 1 ? "singular" : "plural"]} · {entry.caffeineMg.toFixed(0)} mg · {entry.time}{entry.durationMinutes > 0 ? ` over ${entry.durationMinutes} min` : ""}
                </div>
                <button
                  type="button"
                  onClick={() => clearEntry(entry.id)}
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
          <li>Caffeine (tracked)</li>
        </ul>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Math Model</h2>
        <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 space-y-2">
          <p><strong>Caffeine elimination:</strong> Active(t) = Dose × 0.5^((t − t_start) / halfLifeHours)</p>
          <p><strong>Drinking window model:</strong> each dose is split into 5-minute sip segments and decayed independently; Active_total(t) = Σ Active_sips(t)</p>
          <p><strong>Weight normalization:</strong> mg/kg = Active_mg / bodyWeight_kg</p>
          <p><strong>Blood concentration estimate:</strong> Blood_mg/L = Active_mg / (0.7 × bodyWeight_kg)</p>
          <p><strong>Tolerance factor:</strong> Tol(days) = 1 − 0.4 × (1 − e^(−days/14)); effective mg/kg = mg/kg × Tol(days)</p>
          <p><strong>Adenosine blockade:</strong> Blockade = effectiveMgPerKg / (effectiveMgPerKg + 2.0)</p>
          <p><strong>Perceived pressure:</strong> Perceived = NaturalPressure × (1 − Blockade)</p>
        </div>
      </div>
    </div>
  );
}
