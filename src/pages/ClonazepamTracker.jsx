import React, { useEffect, useMemo, useState } from "react";
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
import {
  activeCaffeineAmountAtTime,
  CAFFEINE_ONSET_FULL_EFFECT_MINUTES,
  CAFFEINE_ONSET_LAG_MINUTES,
  CAFFEINE_ONSET_RAMP_MINUTES,
} from "../utils/caffeineModel";
import {
  activeClonazepamAmountAtTime,
  clonazepamEffectPhase,
  CLONAZEPAM_ONSET_FULL_EFFECT_MINUTES,
  CLONAZEPAM_ONSET_LAG_MINUTES,
  CLONAZEPAM_ONSET_RAMP_MINUTES,
} from "../utils/clonazepamModel";

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
const CALORIE_PROFILES_STORAGE_KEY = "dailyCalorieProfilesV1";
const CALORIE_ACTIVE_PROFILE_STORAGE_KEY = "dailyCalorieActiveProfileId";
const CLONAZEPAM_BY_USER_STORAGE_KEY = "clonazepamTrackerByUserV1";
const TAPER_START_DATE_STORAGE_KEY = "clonazepamTaperStartDateV1";
const TAPER_STEP_MG_STORAGE_KEY = "clonazepamTaperStepMgV1";
const TAPER_HOLD_DAYS_STORAGE_KEY = "clonazepamTaperHoldDaysV1";
const TAPER_MINIMUM_DOSE_MG_STORAGE_KEY = "clonazepamTaperMinimumDoseMgV1";
const WELLNESS_GLOBAL_USER_NAME_KEY = "wellnessGlobalUserName";
const WELLNESS_USER_CHANGED_EVENT = "wellness-user-changed";

const HALF_LIFE_OPTIONS = [18, 30, 40];
const DEFAULT_HALF_LIFE_HOURS = 30;
const MAX_DAYS_AT_DOSE = 365;
const DEFAULT_CIRCADIAN_STRENGTH_PERCENT = 35;
const DEFAULT_CIRCADIAN_SHIFT_HOURS = 0;
const DEFAULT_MAINTENANCE_DOSE_MG = 1;
const SEDATION_REFERENCE_WEIGHT_KG = 70;
const SEDATION_EC50_MG = 0.5;
const SEDATION_EC50_MG_PER_KG = SEDATION_EC50_MG / SEDATION_REFERENCE_WEIGHT_KG;
const CAFFEINE_STIM_KD_MG_PER_KG = 2.0;

const RESEARCH_REFERENCE_GROUPS = [
  {
    title: "1) 30-hour half-life and withdrawal timing",
    summary: "Long elimination half-life supports multi-day carryover and delayed withdrawal onset windows.",
    links: [
      {
        label: "Clonazepam (StatPearls, NCBI Bookshelf)",
        url: "https://www.ncbi.nlm.nih.gov/books/NBK556010/",
        evidence: "Reference",
      },
      {
        label: "Klonopin prescribing information (FDA label)",
        url: "https://www.accessdata.fda.gov/drugsatfda_docs/label/2017/017533s059lbl.pdf",
        evidence: "Regulatory",
      },
      {
        label: "Klonopin Withdrawal: Symptoms, Timeline, and Treatment (Verywell Mind)",
        url: "https://www.verywellmind.com/klonopin-withdrawal-symptoms-timeline-and-treatment-4176203",
        evidence: "Patient education",
      },
    ],
  },
  {
    title: "2) GABA-A receptor downregulation and tolerance",
    summary: "Neuroadaptation and receptor-level changes explain tolerance and withdrawal vulnerability.",
    links: [
      {
        label: "Benzodiazepine dependence, toxicity and abuse (PubMed)",
        url: "https://pubmed.ncbi.nlm.nih.gov/7841856/",
        evidence: "Review",
      },
      {
        label: "GABA-A receptor overview (ScienceDirect Topics)",
        url: "https://www.sciencedirect.com/topics/neuroscience/gabaa-receptor",
        evidence: "Reference",
      },
      {
        label: "Benzodiazepines: uses, dangers, and clinical considerations (PubMed Central)",
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8629021/",
        evidence: "Review",
      },
    ],
  },
  {
    title: "3) Taper schedules and outcomes",
    summary: "Guideline-consistent tapering often uses slower reductions with symptom-guided pacing.",
    links: [
      {
        label: "Benzodiazepine Tapering Guideline (ASAM)",
        url: "https://www.asam.org/quality-care/clinical-guidelines/benzodiazepine-tapering",
        evidence: "Guideline",
      },
      {
        label: "How to approach a benzodiazepine taper (Oregon Health Authority)",
        url: "https://www.oregon.gov/oha/HPA/DSI-Pharmacy/MHCAGDocs/Tapering-Benzodiazepines.pdf",
        evidence: "Protocol",
      },
      {
        label: "Slow tapering clonazepam in panic disorder patients after long-term treatment (PubMed)",
        url: "https://pubmed.ncbi.nlm.nih.gov/20473065/",
        evidence: "Clinical study",
      },
      {
        label: "Benzodiazepine tapering strategies (Benzodiazepine Information Coalition)",
        url: "https://www.benzoinfo.com/benzodiazepine-tapering-strategies/",
        evidence: "Advocacy resource",
      },
    ],
  },
  {
    title: "4) Rebound effects and withdrawal symptom patterns",
    summary: "Distinguishes short-term rebound from broader withdrawal syndrome progression.",
    links: [
      {
        label: "Chapter 3: Benzodiazepine withdrawal symptoms (Ashton Manual)",
        url: "https://www.benzo.org.uk/manual/bzcha03.htm",
        evidence: "Clinical resource",
      },
      {
        label: "Benzodiazepine withdrawal and rebound resources (withdrawal.net)",
        url: "https://withdrawal.net/benzodiazepine-withdrawal/",
        evidence: "Community resource",
      },
      {
        label: "Benzodiazepine withdrawal syndrome (review article, PubMed)",
        url: "https://pubmed.ncbi.nlm.nih.gov/7841856/",
        evidence: "Review",
      },
      {
        label: "Ashton Manual taper schedules and individualized pacing",
        url: "https://www.benzo.org.uk/manual/bzsched.htm",
        evidence: "Clinical resource",
      },
    ],
  },
  {
    title: "5) Low-dose taper protocols and supportive care",
    summary: "Late-stage low-dose reductions and behavioral support are commonly discussed for long-term users.",
    links: [
      {
        label: "Discontinuation of benzodiazepine treatment: CBT for panic disorder patients (PubMed)",
        url: "https://pubmed.ncbi.nlm.nih.gov/14754783/",
        evidence: "Clinical study",
      },
      {
        label: "Benzodiazepine tapering and deprescribing guidance (NCBI Bookshelf)",
        url: "https://www.ncbi.nlm.nih.gov/books/NBK310652/",
        evidence: "Reference",
      },
      {
        label: "Benzodiazepines: uses, dangers, and clinical considerations (PubMed Central)",
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8629021/",
        evidence: "Review",
      },
    ],
  },
];

const SUGGESTED_COMMUNITIES = [
  {
    label: "BenzoBuddies",
    url: "https://benzobuddies.org/",
    tag: "Peer forum",
    summary: "Large benzodiazepine-focused forum with taper, withdrawal, recovery, and clonazepam discussion spaces.",
  },
  {
    label: "ADAA Anxiety and Depression Support Community",
    url: "https://healthunlocked.com/anxiety-depression-support",
    tag: "Moderated community",
    summary: "Active anxiety and depression discussion community hosted with ADAA and oriented toward peer support.",
  },
  {
    label: "NAMI Connection Recovery Support Group",
    url: "https://www.nami.org/Support-Education/Support-Groups/NAMI-Connection",
    tag: "Peer-led group",
    summary: "Free peer-led support groups for adults with mental health conditions, including anxiety-related concerns; many are virtual.",
  },
  {
    label: "Benzodiazepine Information Coalition Support Resources",
    url: "https://www.benzoinfo.com/resources/#support-forums",
    tag: "Support directory",
    summary: "Curated gateway to benzodiazepine support forums, Zoom groups, and international peer-support resources.",
  },
];

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

function toLocalDateTimeInputValue(valueMs) {
  const d = new Date(valueMs);
  if (!Number.isFinite(d.getTime())) return getNowLocalDateTimeValue();
  const offsetMs = d.getTimezoneOffset() * 60 * 1000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
}

function createEntryId() {
  try {
    if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // Fall back below when crypto API is unavailable in this runtime.
  }

  return `clonaz-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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

function splitActiveSeriesBySedationBand(points) {
  if (!Array.isArray(points) || points.length === 0) return [];

  const bandForPressure = (pressure) => {
    if (pressure < 25) return "low";
    if (pressure < 55) return "moderate";
    return "high";
  };

  const thresholds = [25, 55];
  const expanded = [];

  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const previous = points[i - 1];

    if (!previous) {
      expanded.push({ ...current, band: bandForPressure(current.sedationPressure || 0) });
      continue;
    }

    const prevPressure = Number(previous.sedationPressure) || 0;
    const currPressure = Number(current.sedationPressure) || 0;
    const low = Math.min(prevPressure, currPressure);
    const high = Math.max(prevPressure, currPressure);
    const crossed = thresholds.filter((t) => t > low && t < high);

    if (crossed.length > 0 && currPressure !== prevPressure) {
      const orderedCrossed = prevPressure < currPressure ? crossed : [...crossed].reverse();

      for (const threshold of orderedCrossed) {
        const ratio = (threshold - prevPressure) / (currPressure - prevPressure);
        const transitionTs = Math.round(previous.ts + ratio * (current.ts - previous.ts));
        const transitionActive = Number((previous.activeMg + ratio * (current.activeMg - previous.activeMg)).toFixed(3));

        expanded.push({
          ...current,
          ts: transitionTs,
          activeMg: transitionActive,
          sedationPressure: threshold,
          band: bandForPressure(threshold),
          transitionThreshold: threshold,
        });
      }
    }

    expanded.push({ ...current, band: bandForPressure(currPressure) });
  }

  return expanded.map((point) => {
    let activeLow = point.band === "low" ? point.activeMg : null;
    let activeModerate = point.band === "moderate" ? point.activeMg : null;
    let activeHigh = point.band === "high" ? point.activeMg : null;

    if (point.transitionThreshold === 25) {
      activeLow = point.activeMg;
      activeModerate = point.activeMg;
    } else if (point.transitionThreshold === 55) {
      activeModerate = point.activeMg;
      activeHigh = point.activeMg;
    }

    return {
      ...point,
      activeLow,
      activeModerate,
      activeHigh,
    };
  });
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
  const takenAtMs = getEntryTakenAtMs(entry, referenceMs);
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

function formatScheduleDate(value) {
  return new Date(value).toLocaleString([], {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function localDayKeyFromMs(valueMs) {
  const d = new Date(valueMs);
  if (!Number.isFinite(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Returns the target taper dose (mg) for a given timestamp based on the taper
// schedule rows. For days before the schedule started we use the first step's
// dose as the reference. Returns null when no schedule is configured.
function taperStepDoseForTs(ts, taperRows) {
  if (!taperRows || !taperRows.length) return null;
  const row = taperRows.find((r) => ts >= r.startMs && ts < r.endMs);
  if (row) return row.doseMg;
  if (ts < taperRows[0].startMs) return taperRows[0].doseMg;
  // After schedule completes the target is 0
  return 0;
}

function normalizeLastMaintenanceToPast({
  anchorMs,
  referenceMs = Date.now(),
  cadence = "once",
}) {
  if (!Number.isFinite(anchorMs) || anchorMs <= 0) return null;

  const cadenceIntervalMs = cadence === "twice"
    ? 12 * 60 * 60 * 1000
    : 24 * 60 * 60 * 1000;
  const safeReferenceMs = Number.isFinite(referenceMs) && referenceMs > 0 ? referenceMs : Date.now();

  let normalizedMs = anchorMs;
  let safetyGuard = 0;
  while (normalizedMs > safeReferenceMs && safetyGuard < 2000) {
    normalizedMs -= cadenceIntervalMs;
    safetyGuard += 1;
  }

  return normalizedMs;
}

function acuteSedationFromEntry(entry, atMs, referenceMs = Date.now()) {
  const takenAtMs = getEntryTakenAtMs(entry, referenceMs);
  if (atMs < takenAtMs) return 0;

  const elapsedMs = atMs - takenAtMs;
  const lagMs = CLONAZEPAM_ONSET_LAG_MINUTES * 60 * 1000;
  if (elapsedMs <= lagMs) return 0;

  const elapsedHours = (elapsedMs - lagMs) / (1000 * 60 * 60);
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

function modeledSedationPressure(activeMg, acuteSedationPressure, daysAtCurrentDose = 0, weightKg = SEDATION_REFERENCE_WEIGHT_KG) {
  const safeWeightKg = Number.isFinite(Number(weightKg)) && Number(weightKg) > 0
    ? Number(weightKg)
    : SEDATION_REFERENCE_WEIGHT_KG;
  const activeMgPerKg = activeMg / safeWeightKg;
  const concentrationPressure = (activeMgPerKg / (activeMgPerKg + SEDATION_EC50_MG_PER_KG)) * 100;
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
  return activeClonazepamAmountAtTime({
    doseMg: entry?.doseMg,
    takenAtMs: getEntryTakenAtMs(entry, referenceMs),
    atMs,
    halfLifeHours,
  });
}

function dominantClonazepamEffectPhase(entries, atMs, referenceMs, halfLifeHours) {
  if (!Array.isArray(entries) || !entries.length) return "pre-dose";

  let dominantEntry = null;
  let dominantActiveMg = 0;

  for (const entry of entries) {
    const activeMg = clonazepamActiveMgAtTime(entry, atMs, referenceMs, halfLifeHours);
    if (activeMg > dominantActiveMg) {
      dominantActiveMg = activeMg;
      dominantEntry = entry;
    }
  }

  if (!dominantEntry) return "pre-dose";

  return clonazepamEffectPhase(atMs - getEntryTakenAtMs(dominantEntry, referenceMs));
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

  if (decayPerInterval >= 0.95) return null;

  const estimatedSteadyStateTroughMg = doseMg * (decayPerInterval / (1 - decayPerInterval));
  const thresholdFraction = 0.45;
  const threshold = estimatedSteadyStateTroughMg * thresholdFraction;

  return Number(Math.max(0.05, threshold).toFixed(3));
}

function activeCaffeineMgFromEntry(entry, atMs, referenceMs, halfLifeHours) {
  return activeCaffeineAmountAtTime({
    caffeineMg: entry?.caffeineMg,
    startMs: getEntryTakenAtMs(entry, referenceMs),
    durationMinutes: entry?.durationMinutes,
    atMs,
    halfLifeHours,
  });
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

function createCaffeineLinkedProfile(name = "Default") {
  return {
    id: `caffeine-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    weight: Number(localStorage.getItem(CAFFEINE_WEIGHT_STORAGE_KEY) || 170),
    weightUnit: localStorage.getItem(CAFFEINE_WEIGHT_UNIT_STORAGE_KEY) || "lb",
    halfLifeHours: Number(localStorage.getItem(CAFFEINE_HALF_LIFE_STORAGE_KEY) || 5),
    entries: (() => {
      try {
        const rawEntries = localStorage.getItem(CAFFEINE_STORAGE_KEY);
        const parsed = rawEntries ? JSON.parse(rawEntries) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })(),
  };
}

function loadProfilesForWellnessUser() {
  const profiles = loadProfiles();
  const globalUserName = (localStorage.getItem(WELLNESS_GLOBAL_USER_NAME_KEY) || "").trim();

  if (!globalUserName) {
    return profiles;
  }

  const existing = profiles.find((profile) => profile?.name === globalUserName);
  if (existing) {
    localStorage.setItem(ACTIVE_PROFILE_ID_STORAGE_KEY, existing.id);
    return profiles;
  }

  const created = createCaffeineLinkedProfile(globalUserName);
  const nextProfiles = [...profiles, created];
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(nextProfiles));
  localStorage.setItem(ACTIVE_PROFILE_ID_STORAGE_KEY, created.id);
  return nextProfiles;
}

function loadClonazepamByUser() {
  try {
    const raw = JSON.parse(localStorage.getItem(CLONAZEPAM_BY_USER_STORAGE_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function resolveInteractionWeightKg({ activeProfile }) {
  let calorieWeightKg = 0;
  let sourceLabel = "";

  try {
    const rawCalorieProfiles = JSON.parse(localStorage.getItem(CALORIE_PROFILES_STORAGE_KEY) || "[]");
    const calorieProfiles = Array.isArray(rawCalorieProfiles) ? rawCalorieProfiles : [];
    const globalUserName = localStorage.getItem(WELLNESS_GLOBAL_USER_NAME_KEY) || "";
    const activeCalorieId = localStorage.getItem(CALORIE_ACTIVE_PROFILE_STORAGE_KEY) || "";

    const calorieProfile = calorieProfiles.find((p) => p?.id === activeCalorieId)
      || calorieProfiles.find((p) => p?.name === globalUserName)
      || calorieProfiles.find((p) => p?.name === activeProfile?.name)
      || null;

    if (calorieProfile?.form) {
      const rawWeight = Number(calorieProfile.form.weight);
      const unitSystem = calorieProfile.form.unitSystem === "metric" ? "kg" : "lb";
      if (Number.isFinite(rawWeight) && rawWeight > 0) {
        calorieWeightKg = toKg(rawWeight, unitSystem);
        sourceLabel = "Daily Calorie Intake";
      }
    }
  } catch {
    // Fall through to caffeine profile/legacy storage.
  }

  if (calorieWeightKg > 0) {
    return { kg: calorieWeightKg, source: sourceLabel };
  }

  const caffeineWeightRaw = Number(activeProfile?.weight ?? localStorage.getItem(CAFFEINE_WEIGHT_STORAGE_KEY));
  const caffeineWeightUnit = activeProfile?.weightUnit || localStorage.getItem(CAFFEINE_WEIGHT_UNIT_STORAGE_KEY) || "lb";
  const caffeineKg = toKg(caffeineWeightRaw, caffeineWeightUnit);

  if (caffeineKg > 0) {
    return { kg: caffeineKg, source: "Caffeine Tracker" };
  }

  return { kg: 70, source: "Default (70 kg)" };
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
  const parsedMaintenanceDose = Number(raw?.maintenanceDoseMg);
  const latestEntryDose = Number(entries?.[0]?.doseMg);
  const maintenanceDoseMg = Number.isFinite(parsedMaintenanceDose) && parsedMaintenanceDose > 0
    ? Number(parsedMaintenanceDose.toFixed(3))
    : Number.isFinite(latestEntryDose) && latestEntryDose > 0
      ? Number(latestEntryDose.toFixed(3))
      : DEFAULT_MAINTENANCE_DOSE_MG;
  const parsedLastMaintenanceDoseAtMs = new Date(raw?.lastMaintenanceDoseAt || "").getTime();
  const fallbackMaintenanceDoseAtMs = entries.length
    ? Math.max(...entries.map((entry) => getEntryTakenAtMs(entry)).filter((ms) => Number.isFinite(ms) && ms > 0))
    : Date.now();
  const safeLastMaintenanceDoseAtMs = Number.isFinite(parsedLastMaintenanceDoseAtMs) && parsedLastMaintenanceDoseAtMs > 0
    ? parsedLastMaintenanceDoseAtMs
    : fallbackMaintenanceDoseAtMs;
  const normalizedLastMaintenanceDoseAtMs = normalizeLastMaintenanceToPast({
    anchorMs: safeLastMaintenanceDoseAtMs,
    referenceMs: Date.now(),
    cadence: carryoverCadence,
  });
  const lastMaintenanceDoseAt = toLocalDateTimeInputValue(normalizedLastMaintenanceDoseAtMs || safeLastMaintenanceDoseAtMs);

  return {
    entries,
    halfLifeHours,
    daysAtCurrentDose,
    carryoverCadence,
    circadianStrengthPercent,
    circadianShiftHours,
    maintenanceDoseMg,
    lastMaintenanceDoseAt,
  };
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
  const [profiles, setProfiles] = useState(() => loadProfilesForWellnessUser());
  const [activeProfileId, setActiveProfileId] = useState(() => {
    const globalUserName = localStorage.getItem(WELLNESS_GLOBAL_USER_NAME_KEY);
    const loadedProfiles = loadProfilesForWellnessUser();
    if (globalUserName) {
      const existingProfile = loadedProfiles.find((p) => p.name === globalUserName);
      if (existingProfile) {
        return existingProfile.id;
      }
    }
    const saved = localStorage.getItem(ACTIVE_PROFILE_ID_STORAGE_KEY);
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
  const [maintenanceDoseMg, setMaintenanceDoseMg] = useState(() => {
    return Number(initialClonazState.maintenanceDoseMg) || DEFAULT_MAINTENANCE_DOSE_MG;
  });
  const [lastMaintenanceDoseAt, setLastMaintenanceDoseAt] = useState(() => {
    return initialClonazState.lastMaintenanceDoseAt || getNowLocalDateTimeValue();
  });
  const taperStartDoseMg = maintenanceDoseMg;
  const [taperStartDate, setTaperStartDate] = useState(() => {
    try {
      const stored = localStorage.getItem(TAPER_START_DATE_STORAGE_KEY);
      if (stored) return stored;
      // Default to earliest logged dose date
      const profileId = localStorage.getItem(ACTIVE_PROFILE_ID_STORAGE_KEY) || "";
      const state = getClonazepamStateForUser(profileId);
      const times = (state.entries || [])
        .map((e) => getEntryTakenAtMs(e))
        .filter((ms) => Number.isFinite(ms) && ms > 0);
      if (times.length) return toLocalDateTimeInputValue(Math.min(...times));
      return getNowLocalDateTimeValue();
    } catch {
      return getNowLocalDateTimeValue();
    }
  });
  const [taperStepMg, setTaperStepMg] = useState(() => {
    const stored = localStorage.getItem(TAPER_STEP_MG_STORAGE_KEY);
    return stored !== null ? Number(stored) : 0.125;
  });
  const [taperHoldDays, setTaperHoldDays] = useState(() => {
    const stored = localStorage.getItem(TAPER_HOLD_DAYS_STORAGE_KEY);
    return stored !== null ? Number(stored) : 14;
  });
  const [taperMinimumDoseMg, setTaperMinimumDoseMg] = useState(() => {
    const stored = localStorage.getItem(TAPER_MINIMUM_DOSE_MG_STORAGE_KEY);
    return stored !== null ? Number(stored) : 0.125;
  });
  const [recalcAt, setRecalcAt] = useState(() => Date.now());
  const [liveCalcAt, setLiveCalcAt] = useState(() => Date.now());
  const [liveCalcPreset, setLiveCalcPreset] = useState("current");
  const [trendExplanation, setTrendExplanation] = useState("");
  const [trendExplanationBusy, setTrendExplanationBusy] = useState(false);
  const [trendExplanationError, setTrendExplanationError] = useState("");
  const [diazepamZoomDays, setDiazepamZoomDays] = useState(7);
  const [diazExplanation, setDiazExplanation] = useState("");
  const [diazExplanationBusy, setDiazExplanationBusy] = useState(false);
  const [diazExplanationError, setDiazExplanationError] = useState("");
  const [anxietyExplanation, setAnxietyExplanation] = useState("");
  const [anxietyExplanationBusy, setAnxietyExplanationBusy] = useState(false);
  const [anxietyExplanationError, setAnxietyExplanationError] = useState("");
  const [cbtMessages, setCbtMessages] = useState([]);
  const [cbtInput, setCbtInput] = useState("");
  const [cbtBusy, setCbtBusy] = useState(false);
  const [cbtError, setCbtError] = useState("");

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
      maintenanceDoseMg,
      lastMaintenanceDoseAt,
      ...partialUpdates,
    };
    saveClonazepamStateForUser(activeProfileId, nextState);
  };

  const switchActiveUser = (nextProfileId, sourceProfiles = profiles) => {
    if (!sourceProfiles.some((profile) => profile.id === nextProfileId)) return;
    setActiveProfileId(nextProfileId);
    localStorage.setItem(ACTIVE_PROFILE_ID_STORAGE_KEY, nextProfileId);

    const userState = getClonazepamStateForUser(nextProfileId);
    setEntries(userState.entries);
    setHalfLifeHours(userState.halfLifeHours);
    setDaysAtCurrentDose(Number(userState.daysAtCurrentDose) || 0);
    setCarryoverCadence(userState.carryoverCadence === "twice" ? "twice" : "once");
    setCircadianStrengthPercent(Number(userState.circadianStrengthPercent));
    setCircadianShiftHours(Number(userState.circadianShiftHours));
    setMaintenanceDoseMg(Number(userState.maintenanceDoseMg) || DEFAULT_MAINTENANCE_DOSE_MG);
    setLastMaintenanceDoseAt(userState.lastMaintenanceDoseAt || getNowLocalDateTimeValue());

    const refreshedProfiles = loadProfilesForWellnessUser();
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

  useEffect(() => {
    const syncFromGlobalUser = () => {
      const globalUserName = (localStorage.getItem(WELLNESS_GLOBAL_USER_NAME_KEY) || "").trim();
      if (!globalUserName) return;

      const existing = profiles.find((profile) => profile.name === globalUserName);
      if (existing) {
        if (existing.id !== activeProfileId) {
          switchActiveUser(existing.id);
        }
        return;
      }

      const created = createCaffeineLinkedProfile(globalUserName);
      const nextProfiles = [...profiles, created];
      setProfiles(nextProfiles);
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(nextProfiles));
      localStorage.setItem(ACTIVE_PROFILE_ID_STORAGE_KEY, created.id);
      switchActiveUser(created.id, nextProfiles);
    };

    const onStorage = (event) => {
      if (!event?.key || event.key === WELLNESS_GLOBAL_USER_NAME_KEY) {
        syncFromGlobalUser();
      }
    };

    syncFromGlobalUser();
    window.addEventListener(WELLNESS_USER_CHANGED_EVENT, syncFromGlobalUser);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(WELLNESS_USER_CHANGED_EVENT, syncFromGlobalUser);
      window.removeEventListener("storage", onStorage);
    };
  }, [profiles, activeProfileId]);

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

  const saveMaintenanceDoseMg = (next) => {
    const rounded = Number((Number(next) || 0).toFixed(3));
    const value = Math.max(0, rounded);
    setMaintenanceDoseMg(value);
    updateActiveClonazepamState({ maintenanceDoseMg: value });
  };

  const saveLastMaintenanceDoseAt = (next) => {
    const parsedMs = new Date(next).getTime();
    if (!Number.isFinite(parsedMs) || parsedMs <= 0) return;
    const normalizedMs = normalizeLastMaintenanceToPast({
      anchorMs: parsedMs,
      referenceMs: recalcAt,
      cadence: carryoverCadence,
    });
    const value = toLocalDateTimeInputValue(normalizedMs || parsedMs);
    setLastMaintenanceDoseAt(value);
    updateActiveClonazepamState({ lastMaintenanceDoseAt: value });
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
      sortAt: getEntryTakenAtMs(entry, recalcAt) || Number(entry.createdAt) || recalcAt,
    }));

    return [...clonazepamLog, ...caffeineLog].sort((a, b) => b.sortAt - a.sortAt);
  }, [entries, caffeineEntries]);

  const combinedDoseLogGroups = useMemo(() => {
    const groups = [];

    for (const entry of combinedDoseLogEntries) {
      const entryTs = Number(entry.sortAt) || getEntryTakenAtMs(entry, recalcAt) || recalcAt;
      const dayKey = localDayKeyFromMs(entryTs);
      if (!dayKey) continue;

      const lastGroup = groups[groups.length - 1];
      if (!lastGroup || lastGroup.dayKey !== dayKey) {
        const label = new Date(`${dayKey}T00:00:00`).toLocaleDateString([], {
          month: "numeric",
          day: "numeric",
          year: "numeric",
        });
        groups.push({ dayKey, label, entries: [entry] });
      } else {
        lastGroup.entries.push(entry);
      }
    }

    return groups;
  }, [combinedDoseLogEntries, recalcAt]);

  // Sum of logged clonazepam doses per local day (not counting maintenance carryover)
  const dailyClonazepamTotals = useMemo(() => {
    const totals = {};
    for (const entry of entries) {
      const ts = getEntryTakenAtMs(entry, recalcAt);
      const dayKey = localDayKeyFromMs(ts);
      if (dayKey) totals[dayKey] = (totals[dayKey] || 0) + Math.max(0, Number(entry.doseMg || 0));
    }
    return totals;
  }, [entries, recalcAt]);

  const carryoverDoseTemplate = useMemo(() => {
    const parsedLastMaintenanceDoseAt = new Date(lastMaintenanceDoseAt).getTime();
    const normalizedAnchorMs = normalizeLastMaintenanceToPast({
      anchorMs: parsedLastMaintenanceDoseAt,
      referenceMs: recalcAt,
      cadence: carryoverCadence,
    });
    const hasValidAnchor = Number.isFinite(normalizedAnchorMs) && normalizedAnchorMs > 0;
    return {
      doseMg: hasValidAnchor ? Math.max(0, Number(maintenanceDoseMg) || 0) : 0,
      takenAtMs: hasValidAnchor ? normalizedAnchorMs : null,
    };
  }, [maintenanceDoseMg, lastMaintenanceDoseAt, recalcAt, carryoverCadence]);

  const modeledCarryover = useMemo(() => {
    const priorDays = Math.max(0, Math.round(Number(daysAtCurrentDose) || 0));
    if (priorDays <= 0 || carryoverDoseTemplate.doseMg <= 0 || !Number.isFinite(carryoverDoseTemplate.takenAtMs)) {
      return {
        entries,
        skippedSameDayOverrides: 0,
        overriddenDayKeys: [],
      };
    }

    const dayMs = 24 * 60 * 60 * 1000;
    const halfDayMs = 12 * 60 * 60 * 1000;
    const cadenceIntervalMs = carryoverCadence === "twice" ? halfDayMs : dayMs;
    const realDoseDayKeys = new Set(
      entries
        .map((entry) => localDayKeyFromMs(getEntryTakenAtMs(entry, recalcAt)))
        .filter(Boolean)
    );
    const syntheticCarryover = [];
    let skippedSameDayOverrides = 0;
    const overriddenDayKeys = new Set();

    const markSameDayOverrideIfNeeded = (takenAtMs) => {
      const dayKey = localDayKeyFromMs(takenAtMs);
      if (!dayKey || !realDoseDayKeys.has(dayKey)) return false;
      skippedSameDayOverrides += 1;
      overriddenDayKeys.add(dayKey);
      return true;
    };

    // Treat the anchor day itself as overridable when real doses exist on that calendar day.
    markSameDayOverrideIfNeeded(carryoverDoseTemplate.takenAtMs);

    // Also treat elapsed expected cadence slots after the anchor as overridable for badging/debug.
    if (Number.isFinite(cadenceIntervalMs) && cadenceIntervalMs > 0 && recalcAt > carryoverDoseTemplate.takenAtMs) {
      for (
        let expectedTakenAtMs = carryoverDoseTemplate.takenAtMs + cadenceIntervalMs;
        expectedTakenAtMs <= recalcAt;
        expectedTakenAtMs += cadenceIntervalMs
      ) {
        markSameDayOverrideIfNeeded(expectedTakenAtMs);
      }
    }

    // Calendar-day override: badge "today" as soon as any real dose exists that day,
    // even if today's expected maintenance slot has not elapsed yet.
    const todayDayKey = localDayKeyFromMs(recalcAt);
    if (todayDayKey && realDoseDayKeys.has(todayDayKey) && !overriddenDayKeys.has(todayDayKey)) {
      skippedSameDayOverrides += 1;
      overriddenDayKeys.add(todayDayKey);
    }

    for (let day = 1; day <= priorDays; day += 1) {
      const primaryTakenAtMs = carryoverDoseTemplate.takenAtMs - day * dayMs;
      const primaryDayKey = localDayKeyFromMs(primaryTakenAtMs);
      if (primaryDayKey && !realDoseDayKeys.has(primaryDayKey)) {
        syntheticCarryover.push({
          id: `carryover-${day}-a`,
          doseMg: carryoverDoseTemplate.doseMg,
          takenAtMs: primaryTakenAtMs,
          takenAtIso: new Date(primaryTakenAtMs).toISOString(),
          synthetic: true,
        });
      } else {
        markSameDayOverrideIfNeeded(primaryTakenAtMs);
      }

      if (carryoverCadence === "twice") {
        const secondTakenAtMs = primaryTakenAtMs - halfDayMs;
        const secondDayKey = localDayKeyFromMs(secondTakenAtMs);
        if (secondDayKey && !realDoseDayKeys.has(secondDayKey)) {
          syntheticCarryover.push({
            id: `carryover-${day}-b`,
            doseMg: carryoverDoseTemplate.doseMg,
            takenAtMs: secondTakenAtMs,
            takenAtIso: new Date(secondTakenAtMs).toISOString(),
            synthetic: true,
          });
        } else {
          markSameDayOverrideIfNeeded(secondTakenAtMs);
        }
      }
    }

    return {
      entries: [...entries, ...syntheticCarryover],
      skippedSameDayOverrides,
      overriddenDayKeys: Array.from(overriddenDayKeys),
    };
  }, [entries, daysAtCurrentDose, carryoverDoseTemplate, carryoverCadence, recalcAt]);

  const modeledEntries = modeledCarryover.entries;
  const modeledCarryoverSkippedSameDay = modeledCarryover.skippedSameDayOverrides;
  const modeledCarryoverOverriddenDayKeys = useMemo(() => new Set(modeledCarryover.overriddenDayKeys || []), [modeledCarryover.overriddenDayKeys]);

  const effectiveLastMaintenanceDoseAtMs = useMemo(() => {
    const anchorMs = Number(carryoverDoseTemplate?.takenAtMs);
    if (!Number.isFinite(anchorMs) || anchorMs <= 0) return null;

    const cadenceIntervalMs = carryoverCadence === "twice"
      ? 12 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000;

    let candidateMs = anchorMs;
    let safetyGuard = 0;

    while (safetyGuard < 2000) {
      const dayKey = localDayKeyFromMs(candidateMs);
      if (!dayKey || !modeledCarryoverOverriddenDayKeys.has(dayKey)) {
        return candidateMs;
      }
      candidateMs -= cadenceIntervalMs;
      safetyGuard += 1;
    }

    return anchorMs;
  }, [carryoverDoseTemplate, carryoverCadence, modeledCarryoverOverriddenDayKeys]);

  const modeledCarryoverCount = useMemo(() => {
    return modeledEntries.filter((entry) => entry?.synthetic).length;
  }, [modeledEntries]);

  const withdrawalThresholdMg = useMemo(() => {
    return estimateWithdrawalThresholdMg({
      daysAtCurrentDose,
      carryoverCadence,
      carryoverDoseMg: Math.max(0, Number(maintenanceDoseMg) || 0),
      halfLifeHours,
    });
  }, [daysAtCurrentDose, carryoverCadence, maintenanceDoseMg, halfLifeHours]);

  const addEntry = (e) => {
    e.preventDefault();
    const doseNumber = Number(doseMg);
    if (!doseNumber || doseNumber <= 0) return;

    const parsedTakenAt = new Date(time).getTime();
    const takenAtMs = Number.isFinite(parsedTakenAt) ? parsedTakenAt : Date.now();

    const next = [
      {
        id: createEntryId(),
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
    setLiveCalcAt(now);
    setLiveCalcPreset("current");
  };

  const saveLiveCalcAt = (next) => {
    const parsedMs = new Date(next).getTime();
    if (!Number.isFinite(parsedMs) || parsedMs <= 0) return;
    setLiveCalcAt(parsedMs);
    setLiveCalcPreset("custom");
  };

  const resetLiveCalcAtNow = () => {
    setLiveCalcAt(recalcAt);
    setLiveCalcPreset("current");
  };

  const setLiveCalcToRelativeDay = (dayOffset, presetId) => {
    const selected = new Date(liveCalcAt);
    const anchor = new Date(recalcAt);
    const source = Number.isFinite(selected.getTime()) ? selected : anchor;
    const next = new Date(anchor);
    next.setHours(source.getHours(), source.getMinutes(), 0, 0);
    next.setDate(next.getDate() + dayOffset);
    setLiveCalcAt(next.getTime());
    setLiveCalcPreset(presetId);
  };

  const setLiveCalcToLastMaintenanceDose = () => {
    const effectiveMs = Number(effectiveLastMaintenanceDoseAtMs);
    if (!Number.isFinite(effectiveMs) || effectiveMs <= 0) return;
    setLiveCalcAt(effectiveMs);
    setLiveCalcPreset("lastMaintenance");
  };

  const setLiveCalcToLastLoggedDose = () => {
    const latestClonazMs = entries.reduce((maxMs, entry) => {
      const entryMs = getEntryTakenAtMs(entry, recalcAt);
      return Number.isFinite(entryMs) ? Math.max(maxMs, entryMs) : maxMs;
    }, 0);
    const latestCaffeineMs = caffeineEntries.reduce((maxMs, entry) => {
      const entryMs = getEntryTakenAtMs(entry, recalcAt);
      return Number.isFinite(entryMs) ? Math.max(maxMs, entryMs) : maxMs;
    }, 0);
    const latestEntryMs = Math.max(latestClonazMs, latestCaffeineMs);
    if (!Number.isFinite(latestEntryMs) || latestEntryMs <= 0) return;
    setLiveCalcAt(latestEntryMs);
    setLiveCalcPreset("lastLogged");
  };

  const liveCalcPresetButtonClass = (presetId) => {
    const isActive = liveCalcPreset === presetId;
    if (isActive) {
      return "px-2 py-1 rounded-lg border border-indigo-600 dark:border-indigo-500 bg-indigo-600 dark:bg-indigo-500 text-white font-semibold";
    }
    return "px-2 py-1 rounded-lg border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/30";
  };

  useEffect(() => {
    if (liveCalcPreset !== "lastMaintenance") return;
    const effectiveMs = Number(effectiveLastMaintenanceDoseAtMs);
    if (!Number.isFinite(effectiveMs) || effectiveMs <= 0) return;
    if (effectiveMs !== liveCalcAt) {
      setLiveCalcAt(effectiveMs);
    }
  }, [liveCalcPreset, effectiveLastMaintenanceDoseAtMs, liveCalcAt]);

  const metrics = useMemo(() => {
    const totalMg = entries.reduce((sum, entry) => sum + (entry.doseMg || 0), 0);
    const now = recalcAt;
    const modelWeight = resolveInteractionWeightKg({ activeProfile });
    const modelWeightKg = modelWeight.kg;

    const activeMg = modeledEntries.reduce((sum, entry) => {
      return sum + clonazepamActiveMgAtTime(entry, now, now, halfLifeHours);
    }, 0);

    const acuteSedationPressure = entries.reduce((sum, entry) => {
      return sum + acuteSedationFromEntry(entry, now, now);
    }, 0);

    const sedationPressure = modeledSedationPressure(activeMg, acuteSedationPressure, daysAtCurrentDose, modelWeightKg);

    return {
      totalMg,
      activeMg,
      modelWeightKg,
      modelWeightSource: modelWeight.source,
      sedationPressure,
      band: sedationBand(sedationPressure),
    };
  }, [entries, modeledEntries, recalcAt, halfLifeHours, daysAtCurrentDose, activeProfile]);

  const chartData = useMemo(() => {
    if (!modeledEntries.length) return [];

    const now = recalcAt;
    const doseTimes = modeledEntries.map((entry) => getEntryTakenAtMs(entry, now));
    const earliest = Math.min(...doseTimes);

    const start = Math.max(earliest - 4 * 60 * 60 * 1000, now - 21 * 24 * 60 * 60 * 1000);
    const end = now + 72 * 60 * 60 * 1000;
    const stepMs = 60 * 60 * 1000;

    const points = [];
    for (let t = start; t <= end; t += stepMs) {
      const activeMg = modeledEntries.reduce((sum, entry) => {
        return sum + clonazepamActiveMgAtTime(entry, t, now, halfLifeHours);
      }, 0);
      const effectPhaseLabel = dominantClonazepamEffectPhase(modeledEntries, t, now, halfLifeHours);

      points.push({
        ts: t,
        activeMg: Number(activeMg.toFixed(3)),
        effectPhaseLabel,
      });
    }
    return points;
  }, [modeledEntries, recalcAt, halfLifeHours]);

  const chartTicks = useMemo(() => {
    if (!chartData.length) return [];
    const s = chartData[0].ts;
    const e = chartData[chartData.length - 1].ts;
    const hr = 3600000;
    const tickIntervalHours = 12;
    const out = [];
    for (let t = Math.ceil(s / (tickIntervalHours * hr)) * (tickIntervalHours * hr); t <= e; t += tickIntervalHours * hr) out.push(t);
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
    const modelWeight = resolveInteractionWeightKg({ activeProfile });
    const modelWeightKg = modelWeight.kg;
    return chartData.map((point) => {
      const acuteSedationPressure = entries.reduce((sum, entry) => {
        return sum + acuteSedationFromEntry(entry, point.ts, recalcAt);
      }, 0);

      const pressureNoTolerance = modeledSedationPressure(point.activeMg, acuteSedationPressure, 0, modelWeightKg);
      const pressure = modeledSedationPressure(point.activeMg, acuteSedationPressure, daysAtCurrentDose, modelWeightKg);
      const circadianPenalty = circadianSleepPenaltyPercent(point.ts, circadianStrengthPercent, circadianShiftHours);
      const alertness = Math.max(0, 100 - pressure - circadianPenalty);
      return {
        ts: point.ts,
        pressureNoTolerance: Number(pressureNoTolerance.toFixed(1)),
        pressure: Number(pressure.toFixed(1)),
        circadianPenalty: Number(circadianPenalty.toFixed(1)),
        alertness: Number(alertness.toFixed(1)),
        effectPhaseLabel: point.effectPhaseLabel,
      };
    });
  }, [chartData, entries, recalcAt, daysAtCurrentDose, circadianStrengthPercent, circadianShiftHours, activeProfile]);

  const gabaDownregulationData = useMemo(() => {
    const safeCurrentDays = Math.max(0, Math.round(Number(daysAtCurrentDose) || 0));
    const horizonDays = Math.min(MAX_DAYS_AT_DOSE, Math.max(60, safeCurrentDays + 30));

    const points = [];
    for (let day = 0; day <= horizonDays; day += 1) {
      const toleranceFactor = toleranceFactorFromDays(day);
      const receptorSensitivity = Math.max(0, Math.min(100, toleranceFactor * 100));
      const downregulation = Math.max(0, 100 - receptorSensitivity);
      points.push({
        day,
        receptorSensitivity: Number(receptorSensitivity.toFixed(1)),
        downregulation: Number(downregulation.toFixed(1)),
      });
    }

    return points;
  }, [daysAtCurrentDose]);

  const activeBySedationChartData = useMemo(() => {
    if (!chartData.length) return [];
    const pressureByTs = new Map(sedationPressureData.map((point) => [point.ts, point.pressure]));
    const merged = chartData.map((point) => ({
      ...point,
      sedationPressure: Number((pressureByTs.get(point.ts) ?? 0).toFixed(1)),
    }));

    // Linear regression trend line over historical daily samples
    const dayMs = 24 * 60 * 60 * 1000;
    const historicalPoints = merged.filter((p) => p.ts <= recalcAt);
    // Sample once per day (noon-ish) to smooth oscillations
    const samples = [];
    if (historicalPoints.length) {
      const startDay = Math.floor(historicalPoints[0].ts / dayMs);
      const endDay = Math.floor(recalcAt / dayMs);
      for (let d = startDay; d <= endDay; d++) {
        const dayStart = d * dayMs;
        const dayEnd = dayStart + dayMs;
        const dayPts = historicalPoints.filter((p) => p.ts >= dayStart && p.ts < dayEnd);
        if (dayPts.length) {
          const avgMg = dayPts.reduce((s, p) => s + p.activeMg, 0) / dayPts.length;
          samples.push({ ts: dayStart + dayMs / 2, activeMg: avgMg });
        }
      }
    }
    let trendSlope = 0, trendIntercept = 0;
    if (samples.length >= 2) {
      const n = samples.length;
      const meanTs = samples.reduce((s, p) => s + p.ts, 0) / n;
      const meanMg = samples.reduce((s, p) => s + p.activeMg, 0) / n;
      const num = samples.reduce((s, p) => s + (p.ts - meanTs) * (p.activeMg - meanMg), 0);
      const den = samples.reduce((s, p) => s + (p.ts - meanTs) ** 2, 0);
      trendSlope = den !== 0 ? num / den : 0;
      trendIntercept = meanMg - trendSlope * meanTs;
    }

    const withTrend = merged.map((point) => ({
      ...point,
      trendMg: samples.length >= 2 ? Number((trendIntercept + trendSlope * point.ts).toFixed(3)) : undefined,
    }));

    const result = splitActiveSeriesBySedationBand(withTrend);
    result._slope = trendSlope * 86400000; // mg/day
    return result;
  }, [chartData, sedationPressureData, recalcAt]);

  // Diazepam equivalence chart: 1 mg clonazepam ≈ 20 mg diazepam (BZD equivalency tables)
  // Diazepam PK: ~30 min lag, ~60 min ramp to full effect, parent half-life ~72 h
  const DIAZEPAM_EQUIVALENCE_RATIO = 20; // clonazepam mg × 20 = diazepam mg
  const DIAZEPAM_HALF_LIFE_HOURS = 72;
  const DIAZEPAM_ONSET_LAG_MS = 30 * 60 * 1000;
  const DIAZEPAM_RAMP_MS = 60 * 60 * 1000;

  const diazepamEquivalentChartData = useMemo(() => {
    if (!modeledEntries.length || !chartData.length) return [];
    const now = recalcAt;

    // Both series use modeledEntries so the 100 days of carryover applies to both.
    // Clonazepam PK: actual halfLifeHours.
    // Diazepam PK: 72 h HL, 30 min lag, 60 min ramp.
    // Both expressed in clonazepam-equivalent mg (doseMg × 20 ÷ 20 = doseMg).
    function diazepamActiveMgAt(takenAtMs, doseClonazepamMg, atMs) {
      const elapsedMs = atMs - takenAtMs;
      if (elapsedMs < 0) return 0;
      let onsetFraction = 0;
      if (elapsedMs >= DIAZEPAM_ONSET_LAG_MS + DIAZEPAM_RAMP_MS) {
        onsetFraction = 1;
      } else if (elapsedMs > DIAZEPAM_ONSET_LAG_MS) {
        const rampProgress = (elapsedMs - DIAZEPAM_ONSET_LAG_MS) / DIAZEPAM_RAMP_MS;
        const x = Math.max(0, Math.min(1, rampProgress));
        onsetFraction = x * x * (3 - 2 * x);
      }
      if (onsetFraction <= 0) return 0;
      const elapsedHours = elapsedMs / (1000 * 60 * 60);
      return doseClonazepamMg * onsetFraction * Math.pow(0.5, elapsedHours / DIAZEPAM_HALF_LIFE_HOURS);
    }

    const points = chartData.map((point) => {
      const clonazepamMg = modeledEntries.reduce((sum, entry) => {
        return sum + clonazepamActiveMgAtTime(entry, point.ts, now, halfLifeHours);
      }, 0);
      const diazepamEquivMg = modeledEntries.reduce((sum, entry) => {
        const takenAtMs = getEntryTakenAtMs(entry, now);
        return sum + diazepamActiveMgAt(takenAtMs, entry.doseMg || 0, point.ts);
      }, 0);
      return {
        ts: point.ts,
        clonazepamMg: Number(clonazepamMg.toFixed(3)),
        diazepamEquivMg: Number(diazepamEquivMg.toFixed(3)),
      };
    });

    // Volatility stats computed over historical hourly points
    const historicalPoints = points.filter((p) => p.ts <= now);
    const hn = historicalPoints.length;

    function volatilityStats(getY) {
      if (hn < 2) return null;
      const ys = historicalPoints.map(getY);
      const mean = ys.reduce((s, v) => s + v, 0) / hn;
      const variance = ys.reduce((s, v) => s + (v - mean) ** 2, 0) / hn;
      const stdDev = Math.sqrt(variance);
      const min = Math.min(...ys);
      const max = Math.max(...ys);
      const cv = mean > 0 ? (stdDev / mean) * 100 : 0;
      return { mean: Number(mean.toFixed(3)), stdDev: Number(stdDev.toFixed(3)), min: Number(min.toFixed(3)), max: Number(max.toFixed(3)), range: Number((max - min).toFixed(3)), cv: Number(cv.toFixed(1)) };
    }

    // Linear regression trend lines over historical points, extended across full range
    function regression(getY) {
      if (hn < 2) return null;
      const xs = historicalPoints.map((p) => p.ts);
      const ys = historicalPoints.map(getY);
      const meanX = xs.reduce((s, v) => s + v, 0) / hn;
      const meanY = ys.reduce((s, v) => s + v, 0) / hn;
      const num = xs.reduce((s, x, i) => s + (x - meanX) * (ys[i] - meanY), 0);
      const den = xs.reduce((s, x) => s + (x - meanX) ** 2, 0);
      const slope = den !== 0 ? num / den : 0;
      return { slope, intercept: meanY - slope * meanX };
    }

    const clonazepamReg = regression((p) => p.clonazepamMg);
    const diazepamReg = regression((p) => p.diazepamEquivMg);
    const clonazepamVol = volatilityStats((p) => p.clonazepamMg);
    const diazepamVol = volatilityStats((p) => p.diazepamEquivMg);

    const data = points.map((point) => ({
      ...point,
      clonazepamTrend: clonazepamReg ? Number((clonazepamReg.intercept + clonazepamReg.slope * point.ts).toFixed(3)) : undefined,
      diazepamTrend: diazepamReg ? Number((diazepamReg.intercept + diazepamReg.slope * point.ts).toFixed(3)) : undefined,
    }));

    const dayMs = 24 * 60 * 60 * 1000;
    data._stats = {
      clonazepamVol,
      diazepamVol,
      cloSlopeMgPerDay: clonazepamReg ? Number((clonazepamReg.slope * dayMs).toFixed(5)) : 0,
      diazSlopeMgPerDay: diazepamReg ? Number((diazepamReg.slope * dayMs).toFixed(5)) : 0,
    };
    return data;
  }, [modeledEntries, chartData, recalcAt, halfLifeHours]);

  const interactionData = useMemo(() => {
    if (!sedationPressureData.length) return [];

    const activeCaffeineEntries = Array.isArray(activeProfile?.entries) ? activeProfile.entries : caffeineEntries;
    const caffeineHalfLifeRaw = Number(activeProfile?.halfLifeHours ?? localStorage.getItem(CAFFEINE_HALF_LIFE_STORAGE_KEY));
    const caffeineHalfLifeHours = Number.isFinite(caffeineHalfLifeRaw) && caffeineHalfLifeRaw > 0 ? caffeineHalfLifeRaw : 5;

    const interactionWeight = resolveInteractionWeightKg({ activeProfile });
    const caffeineKg = interactionWeight.kg;

    const now = recalcAt;

    return sedationPressureData.map((point) => {
      const activeCaffeineMg = activeCaffeineEntries.reduce((sum, entry) => {
        return sum + activeCaffeineMgFromEntry(entry, point.ts, now, caffeineHalfLifeHours);
      }, 0);

      const activeCaffeineMgPerKg = caffeineKg > 0 ? activeCaffeineMg / caffeineKg : 0;
      const caffeineCounterPressure = (activeCaffeineMgPerKg / (activeCaffeineMgPerKg + CAFFEINE_STIM_KD_MG_PER_KG)) * 100;
      const alertnessWithCaffeine = Math.max(0, Math.min(100, point.alertness + caffeineCounterPressure));

      return {
        ts: point.ts,
        sedationPressure: Number(point.pressure.toFixed(1)),
        caffeineCounterPressure: Number(caffeineCounterPressure.toFixed(1)),
        alertnessBaseline: Number(point.alertness.toFixed(1)),
        alertnessWithCaffeine: Number(alertnessWithCaffeine.toFixed(1)),
        effectPhaseLabel: point.effectPhaseLabel,
      };
    });
  }, [sedationPressureData, recalcAt, activeProfile, caffeineEntries]);

  // Anxiety index: combines caffeine excitatory pressure (anxiogenic), clonazepam sedation pressure (anxiolytic),
  // and a withdrawal rebound term that fires when active mg drops below the withdrawal threshold.
  // Withdrawal rebound = sqrt(deficit) × downregulation × dependenceDepth × 90
  //   deficit          = (threshold − activeMg) / threshold  [0→1 below threshold]
  //   downregulation   = 1 − toleranceFactorFromDays(daysAtCurrentDose)  [GABA-A receptor adaptation depth]
  //   dependenceDepth  = clamp(daysAtCurrentDose / 180, 0, 1)  [ramps to full severity at ~6 months]
  // Low < 35 · Moderate 35–65 · High > 65
  const ANXIETY_LOW_THRESHOLD = 35;
  const ANXIETY_HIGH_THRESHOLD = 65;

  const anxietyChartData = useMemo(() => {
    if (!interactionData.length) return [];

    // activeMg by timestamp (chartData spans historical + 72h projection)
    const activeMgByTs = new Map(chartData.map((p) => [p.ts, p.activeMg]));
    const downregulation = Math.max(0, 1 - toleranceFactorFromDays(daysAtCurrentDose));
    const dependenceDepth = Math.min(1, daysAtCurrentDose / 180);

    const data = interactionData.map((point) => {
      const baseIdx = 40 + point.caffeineCounterPressure * 0.75 - point.sedationPressure * 0.6;

      // Withdrawal rebound: exponential surge when active level falls below clinical threshold
      let withdrawalBoost = 0;
      if (withdrawalThresholdMg !== null && daysAtCurrentDose > 14 && withdrawalThresholdMg > 0) {
        const activeMg = activeMgByTs.get(point.ts) ?? 0;
        if (activeMg < withdrawalThresholdMg) {
          const deficit = (withdrawalThresholdMg - activeMg) / withdrawalThresholdMg; // 0→1
          // sqrt curve: even a 10% deficit below threshold gives a noticeable boost (~28%)
          withdrawalBoost = Math.sqrt(deficit) * downregulation * dependenceDepth * 90;
        }
      }

      const idx = Math.max(0, Math.min(100, baseIdx + withdrawalBoost));
      const level = idx < ANXIETY_LOW_THRESHOLD ? "low" : idx < ANXIETY_HIGH_THRESHOLD ? "moderate" : "high";
      return { ts: point.ts, idx: Number(idx.toFixed(1)), level };
    });

    // Split into three color-keyed series with bridging points for smooth transitions
    const LOW = ANXIETY_LOW_THRESHOLD, HIGH = ANXIETY_HIGH_THRESHOLD;
    return data.map((point, i) => {
      const { ts, idx, level } = point;
      const prev = data[i - 1];
      const next = data[i + 1];
      // A point belongs to a band if it is in that band OR adjacent to a same-band point (bridging)
      const inLow    = level === "low"      || (prev?.level === "low"      && level !== "high")  || (next?.level === "low"      && level !== "high");
      const inMod    = level === "moderate" || (prev?.level === "moderate")                       || (next?.level === "moderate");
      const inHigh   = level === "high"     || (prev?.level === "high"     && level !== "low")   || (next?.level === "high"     && level !== "low");
      return {
        ts,
        anxietyLow:      inLow  ? idx : null,
        anxietyModerate: inMod  ? idx : null,
        anxietyHigh:     inHigh ? idx : null,
      };
    });
  }, [interactionData, chartData, withdrawalThresholdMg, daysAtCurrentDose]);

  const liveMath = useMemo(() => {
    const selectedActiveMg = modeledEntries.reduce((sum, entry) => {
      return sum + clonazepamActiveMgAtTime(entry, liveCalcAt, recalcAt, halfLifeHours);
    }, 0);
    const acuteSedationPressure = entries.reduce((sum, entry) => sum + acuteSedationFromEntry(entry, liveCalcAt, recalcAt), 0);
    const modelWeight = resolveInteractionWeightKg({ activeProfile });
    const modelWeightKg = modelWeight.kg;
    const concentrationMgPerKg = modelWeightKg > 0 ? selectedActiveMg / modelWeightKg : 0;
    const concentrationPressure = concentrationMgPerKg > 0
      ? (concentrationMgPerKg / (concentrationMgPerKg + SEDATION_EC50_MG_PER_KG)) * 100
      : 0;
    const toleranceFactor = toleranceFactorFromDays(daysAtCurrentDose);
    const blendedPressure = 0.4 * concentrationPressure + 0.6 * Math.min(100, acuteSedationPressure);
    const selectedSedationPressure = modeledSedationPressure(selectedActiveMg, acuteSedationPressure, daysAtCurrentDose, modelWeightKg);
    const circadianPenalty = circadianSleepPenaltyPercent(liveCalcAt, circadianStrengthPercent, circadianShiftHours);
    const activeCaffeineEntries = Array.isArray(activeProfile?.entries) ? activeProfile.entries : caffeineEntries;
    const caffeineHalfLifeRaw = Number(activeProfile?.halfLifeHours ?? localStorage.getItem(CAFFEINE_HALF_LIFE_STORAGE_KEY));
    const caffeineHalfLifeHours = Number.isFinite(caffeineHalfLifeRaw) && caffeineHalfLifeRaw > 0 ? caffeineHalfLifeRaw : 5;
    const activeCaffeineMg = activeCaffeineEntries.reduce((sum, entry) => {
      return sum + activeCaffeineMgFromEntry(entry, liveCalcAt, recalcAt, caffeineHalfLifeHours);
    }, 0);
    const activeCaffeineMgPerKg = modelWeightKg > 0 ? activeCaffeineMg / modelWeightKg : 0;
    const caffeineCounterPressure = (activeCaffeineMgPerKg / (activeCaffeineMgPerKg + CAFFEINE_STIM_KD_MG_PER_KG)) * 100;
    return {
      activeMg: Number(selectedActiveMg.toFixed(3)),
      concentrationMgPerKg: Number(concentrationMgPerKg.toFixed(5)),
      sedationEc50MgPerKg: Number(SEDATION_EC50_MG_PER_KG.toFixed(5)),
      concentrationPressure: Number(concentrationPressure.toFixed(1)),
      acuteSedationPressure: Number(acuteSedationPressure.toFixed(1)),
      blendedPressure: Number(blendedPressure.toFixed(1)),
      toleranceFactor: Number(toleranceFactor.toFixed(3)),
      toleranceReduction: Number(toleranceReductionPercent(daysAtCurrentDose).toFixed(1)),
      receptorSensitivity: Number((toleranceFactor * 100).toFixed(1)),
      gabaDownregulation: Number((100 - toleranceFactor * 100).toFixed(1)),
      sedationPressure: Number(selectedSedationPressure.toFixed(1)),
      circadianPenalty: Number(circadianPenalty.toFixed(1)),
      alertness: Number(Math.max(0, 100 - selectedSedationPressure - circadianPenalty).toFixed(1)),
      caffeineCounterPressure: Number(caffeineCounterPressure.toFixed(1)),
      alertnessWithCaffeine: Number(Math.max(0, Math.min(100, 100 - selectedSedationPressure - circadianPenalty + caffeineCounterPressure)).toFixed(1)),
      withdrawalThresholdMg: withdrawalThresholdMg !== null ? Number(withdrawalThresholdMg.toFixed(3)) : null,
      interactionWeightKg: Number(modelWeightKg.toFixed(2)),
      interactionWeightSource: modelWeight.source,
      evaluatedAt: liveCalcAt,
    };
  }, [entries, modeledEntries, liveCalcAt, recalcAt, halfLifeHours, daysAtCurrentDose, circadianStrengthPercent, circadianShiftHours, withdrawalThresholdMg, activeProfile, caffeineEntries]);

  const taperSchedule = useMemo(() => {
    const startDose = Math.max(0, Number(taperStartDoseMg) || 0);
    const stepDose = Math.max(0.125, Number(taperStepMg) || 0.125);
    const holdDays = Math.max(1, Math.round(Number(taperHoldDays) || 1));
    const minimumDose = Math.max(0, Number(taperMinimumDoseMg) || 0);

    if (startDose <= 0 || stepDose <= 0) {
      return { rows: [], totalDays: 0, completedAt: null };
    }

    const rows = [];
    let currentDose = startDose;
    if (startDose > minimumDose) {
      const firstCutDose = Math.max(0, startDose - stepDose);
      currentDose = firstCutDose < minimumDose ? minimumDose : firstCutDose;
    }
    const parsedStartMs = new Date(taperStartDate).getTime();
    const effectiveStartMs = Number.isFinite(parsedStartMs) && parsedStartMs > 0 ? parsedStartMs : recalcAt;

    let stepIndex = 0;
    let stepStartMs = effectiveStartMs;
    const maxSteps = 60;

    while (currentDose > 0 && stepIndex < maxSteps) {
      const roundedDose = Number(currentDose.toFixed(3));
      const stepEndMs = stepStartMs + holdDays * 24 * 60 * 60 * 1000;
      rows.push({
        id: `taper-step-${stepIndex + 1}`,
        stepNumber: stepIndex + 1,
        doseMg: roundedDose,
        startMs: stepStartMs,
        endMs: stepEndMs,
        holdDays,
      });

      if (roundedDose <= minimumDose) {
        currentDose = 0;
      } else {
        const nextDose = Math.max(0, roundedDose - stepDose);
        currentDose = nextDose < minimumDose ? minimumDose : nextDose;
        if (Number(currentDose.toFixed(3)) === roundedDose) break;
      }

      stepIndex += 1;
      stepStartMs = stepEndMs;

      if (currentDose === 0) break;
      if (rows.length >= maxSteps) break;
      if (rows.length > 1 && rows[rows.length - 1].doseMg === rows[rows.length - 2].doseMg) break;
    }

    const completedAt = rows.length ? rows[rows.length - 1].endMs : null;
    return {
      rows,
      totalDays: rows.length * holdDays,
      completedAt,
    };
  }, [taperStartDoseMg, taperStepMg, taperHoldDays, taperMinimumDoseMg, taperStartDate, recalcAt]);

  const currentTaperStep = useMemo(() => {
    if (!taperSchedule.rows.length) {
      return { rowId: null, isStop: false };
    }

    const now = recalcAt;
    const activeRow = taperSchedule.rows.find((row) => now >= row.startMs && now < row.endMs);
    if (activeRow) {
      return { rowId: activeRow.id, isStop: false };
    }

    if (taperSchedule.completedAt && now >= taperSchedule.completedAt) {
      return { rowId: null, isStop: true };
    }
    // If we haven't reached the start date yet, don't highlight any step
    if (now < taperSchedule.rows[0].startMs) {
      return { rowId: null, isStop: false };
    }

    return { rowId: taperSchedule.rows[0].id, isStop: false };
  }, [taperSchedule, recalcAt]);

  // Diazepam equivalency for each taper step: expected steady-state trough and step slopes.
  // Steady-state trough for once-daily dosing = doseMg × (decay / (1 − decay))
  // decay = 0.5^(24/HL)
  const taperDiazepamProjection = useMemo(() => {
    if (!taperSchedule.rows.length) return { rows: [], summary: null };

    const cloDecay = Math.pow(0.5, 24 / halfLifeHours);
    const cloAccum = cloDecay / (1 - cloDecay); // SS trough multiplier for clonazepam
    const diazDecay = Math.pow(0.5, 24 / DIAZEPAM_HALF_LIFE_HOURS);
    const diazAccum = diazDecay / (1 - diazDecay); // SS trough multiplier for diazepam-equiv

    const allStepDoses = [taperStartDoseMg, ...taperSchedule.rows.map((r) => r.doseMg), 0];

    const rows = taperSchedule.rows.map((row, i) => {
      const prevDoseMg = allStepDoses[i];       // dose before this step started
      const nextDoseMg = allStepDoses[i + 2];   // dose after this step ends

      const diazepamMg = Number((row.doseMg * DIAZEPAM_EQUIVALENCE_RATIO).toFixed(2));
      const cloSSTrough = Number((row.doseMg * cloAccum).toFixed(3));
      const diazSSTroughEquiv = Number((row.doseMg * diazAccum).toFixed(3));

      // Slope during this hold: transition from previous SS to this step's SS
      // Diazepam HL 72h → after 14 days ≈ 96% settled. Linearize across holdDays.
      const prevDiazSS = Number((prevDoseMg * diazAccum).toFixed(3));
      const slopeThisStepMgPerDay = Number(((diazSSTroughEquiv - prevDiazSS) / row.holdDays).toFixed(4));

      // Slope going into next step (what happens when next step starts)
      const nextDiazSS = nextDoseMg !== undefined ? Number((nextDoseMg * diazAccum).toFixed(3)) : null;
      const slopeNextStepMgPerDay = nextDiazSS !== null
        ? Number(((nextDiazSS - diazSSTroughEquiv) / row.holdDays).toFixed(4))
        : null;

      return { id: row.id, diazepamMg, cloSSTrough, diazSSTroughEquiv, slopeThisStepMgPerDay, slopeNextStepMgPerDay };
    });

    // Overall taper slope: first step SS → last step SS over total duration
    const firstCloSS = taperSchedule.rows[0].doseMg * cloAccum;
    const lastCloSS = taperSchedule.rows[taperSchedule.rows.length - 1].doseMg * cloAccum;
    const firstDiazSS = taperSchedule.rows[0].doseMg * diazAccum;
    const lastDiazSS = taperSchedule.rows[taperSchedule.rows.length - 1].doseMg * diazAccum;
    const totalDays = taperSchedule.totalDays || 1;

    const summary = {
      cloOverallSlope: Number(((lastCloSS - firstCloSS) / totalDays).toFixed(4)),
      diazOverallSlope: Number(((lastDiazSS - firstDiazSS) / totalDays).toFixed(4)),
      firstDiazSS: Number(firstDiazSS.toFixed(3)),
      lastDiazSS: Number(lastDiazSS.toFixed(3)),
      firstCloSS: Number(firstCloSS.toFixed(3)),
      lastCloSS: Number(lastCloSS.toFixed(3)),
      totalDays,
    };

    return { rows, summary };
  }, [taperSchedule, halfLifeHours, taperStartDoseMg]);

  const explainTrend = async () => {
    const groqApiKey = (localStorage.getItem("groqApiKey") || import.meta.env?.VITE_GROQ_API_KEY || "").trim();
    if (!groqApiKey) {
      setTrendExplanationError("Groq API key not found. Add it in Settings first.");
      return;
    }
    if (trendExplanationBusy) return;
    setTrendExplanationBusy(true);
    setTrendExplanationError("");
    setTrendExplanation("");

    const slopeMgPerDay = activeBySedationChartData._slope ?? 0;
    const direction = slopeMgPerDay < -0.0005 ? "declining" : slopeMgPerDay > 0.0005 ? "increasing" : "stable";

    // Use already-computed dailyClonazepamTotals (dayKey -> mg) — avoids raw entry timestamp issues
    const dayMs = 24 * 60 * 60 * 1000;
    const windowStartMs = recalcAt - 21 * dayMs;
    const tol = 0.001;
    const taperRows = taperSchedule?.rows || [];

    const dailyTotals = Object.entries(dailyClonazepamTotals)
      .map(([key, total]) => {
        const dayNoonMs = new Date(`${key}T12:00:00`).getTime();
        const stepTarget = taperStepDoseForTs(dayNoonMs, taperRows) ?? maintenanceDoseMg;
        return { date: key, total: Number(total.toFixed(3)), stepTarget, dayNoonMs };
      })
      .filter(({ dayNoonMs }) => Number.isFinite(dayNoonMs) && dayNoonMs >= windowStartMs)
      .sort((a, b) => a.dayNoonMs - b.dayNoonMs);

    const overDays = dailyTotals.filter(({ total, stepTarget }) => total > stepTarget + tol).length;
    const underDays = dailyTotals.filter(({ total, stepTarget }) => total < stepTarget - tol).length;
    const atDays = dailyTotals.length - overDays - underDays;
    const avgDailyTotal = dailyTotals.length
      ? Number((dailyTotals.reduce((s, d) => s + d.total, 0) / dailyTotals.length).toFixed(3))
      : 0;
    const currentStep = taperRows.find((r) => recalcAt >= r.startMs && recalcAt < r.endMs);
    const currentStepTarget = currentStep?.doseMg ?? maintenanceDoseMg;

    // Current active mg from metrics (calculated at recalcAt)
    const currentActiveMgVal = Number(metrics.activeMg.toFixed(3));
    const stats = diazepamEquivalentChartData._stats?.clonazepamVol;

    const dailyTotalsText = dailyTotals.map(({ date, total, stepTarget }) => {
      const flag = total > stepTarget + tol ? "OVER" : total < stepTarget - tol ? "under" : "at";
      return `  ${date}: ${total} mg (target ${stepTarget} mg → ${flag})`;
    }).join("\n");

    const taperSummary = taperRows.length
      ? `Taper: ${taperRows.length} steps of ${taperStepMg} mg each, ${taperHoldDays} days/step. Current step target: ${currentStepTarget} mg. Full schedule: ${taperRows.map((r) => `step${r.stepNumber}=${r.doseMg}mg (${new Date(r.startMs).toLocaleDateString()}–${new Date(r.endMs).toLocaleDateString()})`).join(", ")}.`
      : "No taper plan configured.";

    const prompt = [
      `CLONAZEPAM TRACKER — TREND ANALYSIS`,
      ``,
      `Regression slope over 21-day daily-average chart: ${slopeMgPerDay.toFixed(4)} mg/day (${direction}).`,
      `Half-life: ${halfLifeHours} h. Days at dose (tolerance model): ${daysAtCurrentDose}. Current estimated active level: ${currentActiveMgVal} mg. Maintenance dose setting: ${maintenanceDoseMg} mg.`,
      stats ? `21-day PK stats: mean active ${stats.mean} mg, std dev ${stats.stdDev} mg, CV ${stats.cv}%, range ${stats.min}–${stats.max} mg.` : "",
      ``,
      taperSummary,
      ``,
      `DAILY LOGGED DOSE TOTALS — last ${dailyTotals.length} days (with per-day taper target):`,
      dailyTotalsText || "  (no logged doses in window)",
      ``,
      `Summary: ${overDays} days over target, ${atDays} at target, ${underDays} under target. Average daily logged total: ${avgDailyTotal} mg vs current step target ${currentStepTarget} mg.`,
      ``,
      `Instructions: Using ONLY the specific numbers above, write exactly 4 bullet points, then a dosing schedule table.`,
      `1. WHY the 21-day regression slope is ${direction} — reference the specific dates from the daily totals that pulled it that direction (e.g. "4/4 at 1.5 mg was the highest day and elevated the slope")`,
      `2. What averaging ${avgDailyTotal} mg/day against a target of ${currentStepTarget} mg/day means for steady-state trough level at ${halfLifeHours}h half-life — compute the expected SS trough using the formula Trough = Dose × (0.5^(24/HL))/(1 − 0.5^(24/HL))`,
      `3. What spreading doses across multiple smaller entries per day does to peak-to-trough swing vs. a single daily dose of the same total`,
      `4. One specific numbered finding that would be useful to mention to a prescriber. When counting over/under days, use each day's own step target from the table above (e.g. "On ${overDays} of ${dailyTotals.length} days the logged dose exceeded that day's step target", naming the step targets involved)`,
      ``,
      `DAILY DOSING SCHEDULE`,
      `After the 4 bullets, output a section titled "Suggested Daily Schedule to Maintain Stable Levels" with a plain-text table showing how to split the target dose of ${currentStepTarget} mg across up to 5 administration times to minimize peak-to-trough swing.`,
      `Rules for the schedule:`,
      `- Minimum dose per administration: 0.125 mg`,
      `- All doses must be multiples of 0.125 mg`,
      `- Maximum 5 doses per day`,
      `- Total must sum exactly to ${currentStepTarget} mg`,
      `- Prefer equal dose sizes and equal time spacing to minimize swing`,
      `- Half-life is ${halfLifeHours}h so evenly spaced doses flatten the trough best`,
      `- Use realistic waking hours (e.g. 8 AM to 10 PM window)`,
      `- Show the table as: Time | Dose | Cumulative | Notes`,
      `- After the table, show the estimated trough level this schedule would produce using the formula above, and how it compares to the target trough for ${currentStepTarget} mg once daily`,
      ``,
      `TAPER EVALUATION & PRESCRIBER TALKING POINTS`,
      `After the schedule table, add a section titled "Taper Pace Evaluation" and address ALL of these:`,
      `- Is the current 21-day slope (${slopeMgPerDay.toFixed(4)} mg/day = ${metrics.activeMg > 0.001 ? ((slopeMgPerDay * 14 / metrics.activeMg) * 100).toFixed(1) : "N/A"}% per 2 weeks) too fast, appropriately paced, or too slow for a safe benzo taper? Clinical guideline: 5–10% reduction per 2–4 weeks is generally considered the maximum safe pace for long-term users.`,
      `- Based on ${daysAtCurrentDose} days at current dose and the Ashton Manual / NICE guidelines framework, what symptoms should the patient monitor?`,
      `- Provide 2–3 specific numbered talking points the patient can bring to their prescriber to have a productive conversation about the taper pace.`,
      `- If the slope is too steep, suggest the specific next step dose that would be appropriate (must be a multiple of 0.125 mg, must be above minimum dose ${Number(taperMinimumDoseMg) || 0.125} mg).`,
      `End with exactly: "Not medical advice."`,
    ].filter(Boolean).join("\n");

    try {
      const model = (localStorage.getItem("groqModel") || "llama-3.3-70b-versatile").trim() || "llama-3.3-70b-versatile";
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API error ${response.status}: ${errorText.slice(0, 200)}`);
      }
      const payload = await response.json();
      const content = String(payload?.choices?.[0]?.message?.content || "").trim();
      if (!content) throw new Error("Empty response from AI.");
      setTrendExplanation(content);
    } catch (err) {
      setTrendExplanationError(String(err.message || "Unknown error"));
    } finally {
      setTrendExplanationBusy(false);
    }
  };

  const explainDiazepam = async () => {
    const groqApiKey = (localStorage.getItem("groqApiKey") || import.meta.env?.VITE_GROQ_API_KEY || "").trim();
    if (!groqApiKey) { setDiazExplanationError("Groq API key not found. Add it in Settings first."); return; }
    if (diazExplanationBusy) return;
    setDiazExplanationBusy(true);
    setDiazExplanationError("");
    setDiazExplanation("");
    const stats = diazepamEquivalentChartData._stats;
    const cvol = stats?.clonazepamVol, dvol = stats?.diazepamVol;
    const prompt = [
      `DIAZEPAM EQUIVALENCY CHART ANALYSIS`,
      `Clonazepam (${halfLifeHours}h HL): mean active ${cvol?.mean ?? "?"} mg, CV ${cvol?.cv ?? "?"}%, range ${cvol?.min ?? "?"}–${cvol?.max ?? "?"} mg, slope ${stats?.cloSlopeMgPerDay?.toFixed(4) ?? "?"} mg/day.`,
      `Diazepam equiv (72h HL): mean active ${dvol?.mean ?? "?"} mg-equiv, CV ${dvol?.cv ?? "?"}%, range ${dvol?.min ?? "?"}–${dvol?.max ?? "?"} mg-equiv, slope ${stats?.diazSlopeMgPerDay?.toFixed(4) ?? "?"} mg/day.`,
      `Both lines use clonazepam-equivalent mg scale (20:1 ratio already applied). Days at current dose: ${daysAtCurrentDose}. Current dose: ${maintenanceDoseMg} mg.`,
      ``,
      `Write 3 concise bullet points:`,
      `1. What the CV difference (${dvol && cvol ? Math.abs(cvol.cv - dvol.cv).toFixed(1) : "?"} percentage points) means practically — explain peak-to-trough smoothing in clinical terms.`,
      `2. Whether the higher steady-state diazepam level observed in the chart is a benefit or risk for this patient profile. Reference the accumulation math.`,
      `3. If this data would justify a clonazepam→diazepam crossover taper to a prescriber — name the specific clinical advantages and risks given these PK numbers.`,
      `End with exactly: "Not medical advice."`,
    ].join("\n");
    try {
      const model = (localStorage.getItem("groqModel") || "llama-3.3-70b-versatile").trim();
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqApiKey}` },
        body: JSON.stringify({ model, temperature: 0.2, messages: [{ role: "user", content: prompt }] }),
      });
      if (!res.ok) throw new Error(`Groq API error ${res.status}`);
      const payload = await res.json();
      setDiazExplanation(String(payload?.choices?.[0]?.message?.content || "").trim());
    } catch (err) { setDiazExplanationError(String(err.message || "Unknown error")); }
    finally { setDiazExplanationBusy(false); }
  };

  const explainAnxiety = async () => {
    const groqApiKey = (localStorage.getItem("groqApiKey") || import.meta.env?.VITE_GROQ_API_KEY || "").trim();
    if (!groqApiKey) { setAnxietyExplanationError("Groq API key not found. Add it in Settings first."); return; }
    if (anxietyExplanationBusy) return;
    setAnxietyExplanationBusy(true);
    setAnxietyExplanationError("");
    setAnxietyExplanation("");
    const currentPoint = anxietyChartData.length ? anxietyChartData.filter((p) => p.ts <= recalcAt).at(-1) : null;
    const currentIdx = currentPoint ? (currentPoint.anxietyHigh ?? currentPoint.anxietyModerate ?? currentPoint.anxietyLow ?? 0) : 0;
    const currentLevel = currentIdx >= ANXIETY_HIGH_THRESHOLD ? "High" : currentIdx >= ANXIETY_LOW_THRESHOLD ? "Moderate" : "Low";
    const slopeMgPerDay = activeBySedationChartData._slope ?? 0;
    const taperRows = taperSchedule?.rows || [];
    const currentStep = taperRows.find((r) => recalcAt >= r.startMs && recalcAt < r.endMs);
    const prompt = [
      `ANXIETY LEVEL MODEL ANALYSIS`,
      `Current anxiety index: ${currentIdx.toFixed(1)}/100 (${currentLevel}). Formula: 40 + caffeineStimPressure×0.75 − sedationPressure×0.6 + withdrawalBoost.`,
      `Days at current dose: ${daysAtCurrentDose}. Clonazepam slope: ${slopeMgPerDay.toFixed(4)} mg/day. Current active: ${metrics.activeMg.toFixed(3)} mg.`,
      `Taper: ${currentStep ? `currently on step ${currentStep.stepNumber} (${currentStep.doseMg} mg, ${new Date(currentStep.startMs).toLocaleDateString()}–${new Date(currentStep.endMs).toLocaleDateString()})` : "no taper configured"}.`,
      `Withdrawal threshold: ${withdrawalThresholdMg !== null ? withdrawalThresholdMg.toFixed(3) + " mg" : "not configured"}.`,
      ``,
      `Write 3 focused bullet points:`,
      `1. Interpret the current anxiety index — what factors are driving it up or down the most right now based on the specific values?`,
      `2. If the user is on a taper with a declining slope, how is the withdrawal rebound component of the model expected to change over the next 2–4 weeks, and what non-pharmacological strategies help mitigate it?`,
      `3. One specific actionable recommendation the user can try today to improve their anxiety index score (dose timing, caffeine reduction, schedule change, etc.).`,
      `End with exactly: "Not medical advice."`,
    ].join("\n");
    try {
      const model = (localStorage.getItem("groqModel") || "llama-3.3-70b-versatile").trim();
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqApiKey}` },
        body: JSON.stringify({ model, temperature: 0.2, messages: [{ role: "user", content: prompt }] }),
      });
      if (!res.ok) throw new Error(`Groq API error ${res.status}`);
      const payload = await res.json();
      setAnxietyExplanation(String(payload?.choices?.[0]?.message?.content || "").trim());
    } catch (err) { setAnxietyExplanationError(String(err.message || "Unknown error")); }
    finally { setAnxietyExplanationBusy(false); }
  };

  const sendCbtMessage = async () => {
    const groqApiKey = (localStorage.getItem("groqApiKey") || import.meta.env?.VITE_GROQ_API_KEY || "").trim();
    if (!groqApiKey) { setCbtError("Groq API key not found. Add it in Settings first."); return; }
    if (cbtBusy || !cbtInput.trim()) return;
    const userMsg = { role: "user", content: cbtInput.trim() };
    const updatedHistory = [...cbtMessages, userMsg];
    setCbtMessages(updatedHistory);
    setCbtInput("");
    setCbtBusy(true);
    setCbtError("");
    const slopeMgPerDay = activeBySedationChartData._slope ?? 0;
    const systemPrompt = `You are a supportive Cognitive Behavioral Therapy (CBT) assistant specializing in anxiety management during benzodiazepine tapers. You have context about the user's clonazepam taper:
- Current active level: ${metrics.activeMg.toFixed(3)} mg, days at dose: ${daysAtCurrentDose}
- 21-day slope: ${slopeMgPerDay.toFixed(4)} mg/day (${slopeMgPerDay < 0 ? "declining/tapering" : slopeMgPerDay > 0 ? "increasing" : "stable"})
- Taper: ${taperSchedule?.rows?.length ? `${taperSchedule.rows.length} steps configured` : "not configured"}

Use standard CBT techniques: thought challenging, cognitive restructuring, behavioral activation, exposure hierarchy, relaxation response. Always clarify this is supportive guidance and not a replacement for a licensed therapist or prescriber. Keep responses warm, concise, and practical.`;
    try {
      const model = (localStorage.getItem("groqModel") || "llama-3.3-70b-versatile").trim();
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqApiKey}` },
        body: JSON.stringify({ model, temperature: 0.5, messages: [{ role: "system", content: systemPrompt }, ...updatedHistory.slice(-10)] }),
      });
      if (!res.ok) throw new Error(`Groq API error ${res.status}`);
      const payload = await res.json();
      const reply = String(payload?.choices?.[0]?.message?.content || "").trim();
      setCbtMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) { setCbtError(String(err.message || "Unknown error")); }
    finally { setCbtBusy(false); }
  };

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
          {activeProfile && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Saving to:</span>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-sm font-semibold">{activeProfile.name || "User"}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">Manage users in Wellness Hub</span>
            </div>
          )}
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
          <h2
            className="font-semibold text-gray-900 dark:text-white cursor-help"
            title="Snapshot shows the model's current assumptions and current-state outputs for clonazepam carryover, sedation, and circadian pressure."
          >
            Snapshot
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1">
              <span
                className="text-sm text-gray-700 dark:text-gray-300 cursor-help"
                title="Half-life is the time it takes the modeled active clonazepam amount to fall by 50 percent after absorption."
              >
                Half-life
              </span>
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
              <span
                className="text-sm text-gray-700 dark:text-gray-300 cursor-help"
                title="Days at today's dose is used as a tolerance proxy. Higher values reduce the modeled sedation effect, up to the stability cap."
              >
                Days at today&apos;s dose
              </span>
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
              <span
                className="text-sm text-gray-700 dark:text-gray-300 cursor-help"
                title="Carryover cadence tells the model how often doses usually recur, so it can estimate residual clonazepam from prior days."
              >
                Carryover cadence
              </span>
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
              <span
                className="text-sm text-gray-700 dark:text-gray-300 cursor-help"
                title="Daily maintenance dose is the baseline dose amount used to model carryover from previous days."
              >
                Daily maintenance dose
              </span>
              <input
                type="number"
                min="0"
                step="0.125"
                value={maintenanceDoseMg}
                onChange={(e) => saveMaintenanceDoseMg(e.target.value)}
                className="w-28 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              />
            </label>
            <label className="space-y-1">
              <span
                className="text-sm text-gray-700 dark:text-gray-300 cursor-help"
                title="Date and time of your most recent maintenance dose. This anchors carryover and withdrawal-threshold timing."
              >
                Last maintenance dose
              </span>
              <input
                type="datetime-local"
                value={lastMaintenanceDoseAt}
                onChange={(e) => saveLastMaintenanceDoseAt(e.target.value)}
                required
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              />
            </label>
            <label className="space-y-1">
              <span
                className="text-sm text-gray-700 dark:text-gray-300 cursor-help"
                title="Night penalty is the added circadian sleep-pressure strength applied during your biological night, from 0 to 50 percent."
              >
                Night penalty
              </span>
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
              <span
                className="text-sm text-gray-700 dark:text-gray-300 cursor-help"
                title="Chronotype shift moves the circadian sleep-pressure curve earlier or later to match whether you are more of a morning or evening type."
              >
                Chronotype shift
              </span>
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
              title="Restore the night-penalty and chronotype-shift controls to their default values."
            >
              Defaults
            </button>
            <button
              type="button"
              onClick={recalculateNow}
              className="px-3 py-2 rounded-lg border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-sm"
              title="Refresh the model using the current time so all active, sedation, and threshold values update immediately."
            >
              Recalculate
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Days at dose is capped at {MAX_DAYS_AT_DOSE} for stability. Carryover cadence should match your usual dosing schedule. Carryover baseline uses your daily maintenance dose and exact entered last maintenance dose date/time.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Logged doses override modeled maintenance carryover for that same calendar day.
          </p>
          <div className="space-y-1 text-gray-900 dark:text-white">
            <p>Total logged: <strong>{metrics.totalMg.toFixed(3)} mg</strong></p>
            {(() => {
              const days = Object.keys(dailyClonazepamTotals).length;
              if (!days) return null;
              const avg = metrics.totalMg / days;
              return <p>Avg dose/day: <strong>{avg.toFixed(3)} mg</strong> <span className="text-xs text-gray-500 dark:text-gray-400">({days} logged day{days !== 1 ? "s" : ""})</span></p>;
            })()}
            <p>Estimated active now: <strong>{metrics.activeMg.toFixed(3)} mg</strong></p>
            <p>Modeled carryover doses: <strong>{modeledCarryoverCount}</strong></p>
            <p>Skipped carryover doses (same-day override): <strong>{modeledCarryoverSkippedSameDay}</strong></p>
            <p>Estimated sedation pressure now: <strong>{metrics.sedationPressure.toFixed(1)}%</strong></p>
            <p>Tolerance reduction from days at dose: <strong>{toleranceReductionPercent(daysAtCurrentDose).toFixed(1)}%</strong></p>
            {withdrawalThresholdMg !== null && (
              <p>
                Estimated time to withdrawal-risk threshold: <strong>{withdrawalCrossingInfo?.label || "-"}{withdrawalCrossingInfo?.hoursFromNow !== null && Number.isFinite(withdrawalCrossingInfo?.hoursFromNow) ? ` (~${withdrawalCrossingInfo.hoursFromNow.toFixed(1)}h)` : ""}</strong>
              </p>
            )}
            <p>Last recalculated: <strong>{new Date(recalcAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}</strong></p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Active now includes modeled carryover doses from prior days based on your selected cadence.
          </p>
          <div className={`rounded-lg p-3 bg-gray-50 dark:bg-gray-800 ${metrics.band.tone}`}>
            <p className="font-semibold">Sedation likelihood (rough): {metrics.band.level}</p>
            <p className="text-sm">Educational estimate only; individual response, tolerance, and interaction risk vary.</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Estimated Active Clonazepam</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">Curve uses a fixed {CLONAZEPAM_ONSET_LAG_MINUTES}-minute absorption lag plus {CLONAZEPAM_ONSET_RAMP_MINUTES}-minute ramp to full effect, then selected half-life decay with estimated carryover from prior days at dose ({carryoverCadence === "twice" ? "twice daily" : "once daily"}). Timeline shows up to 3 weeks of history plus a 72-hour projection. Days without a logged dose use the daily maintenance dose as modeled carryover. Dashed white line is a linear regression trend over daily average levels.</p>
        {withdrawalThresholdMg !== null && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <span className="text-red-600 dark:text-red-400 font-semibold">Dashed red line</span> marks an estimated risk zone based on chronic exposure assumptions (not a diagnostic cutoff).
          </p>
        )}
        {activeBySedationChartData.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">Add at least one dose to view the graph.</p>
        ) : (
          <>
            {(() => {
              const historical = activeBySedationChartData.filter((p) => p.ts <= recalcAt);
              const total = historical.length;
              if (!total) return null;
              const low = historical.filter((p) => (p.sedationPressure ?? 0) < 25).length;
              const high = historical.filter((p) => (p.sedationPressure ?? 0) >= 55).length;
              const mod = total - low - high;
              const pct = (n) => `${((n / total) * 100).toFixed(0)}%`;
              const slopeMgPerDay = activeBySedationChartData._slope ?? 0;
              const slopeDir = slopeMgPerDay < -0.0005 ? "↓" : slopeMgPerDay > 0.0005 ? "↑" : "→";
              const slopeColor = slopeMgPerDay < -0.0005 ? "text-green-400" : slopeMgPerDay > 0.0005 ? "text-red-400" : "text-gray-400";
              return (
                <>
                  <div className="flex flex-wrap gap-4 text-xs font-semibold items-center">
                    <span className="text-green-500">Low: {pct(low)}</span>
                    <span className="text-yellow-500">Moderate: {pct(mod)}</span>
                    <span className="text-red-500">High: {pct(high)}</span>
                    <span className={`${slopeColor} ml-2`}>
                      Trend: {slopeDir} {Math.abs(slopeMgPerDay).toFixed(4)} mg/day
                      {metrics.activeMg > 0.001 && (
                        <span className="text-gray-400 font-normal ml-1">
                          ({slopeMgPerDay >= 0 ? "+" : ""}{((slopeMgPerDay * 14 / metrics.activeMg) * 100).toFixed(1)}% / 2wk)
                        </span>
                      )}
                    </span>
                    <button
                      onClick={explainTrend}
                      disabled={trendExplanationBusy}
                      className="ml-1 px-2 py-0.5 rounded text-xs bg-indigo-700 text-white hover:bg-indigo-600 disabled:opacity-50"
                    >
                      {trendExplanationBusy ? "…" : "Explain with AI"}
                    </button>
                  </div>
                  {trendExplanationError && <p className="text-xs text-red-400">{trendExplanationError}</p>}
                  {trendExplanation && (
                    <div className="text-xs text-gray-300 bg-gray-800 rounded p-3 border border-gray-700 space-y-2">
                      {trendExplanation.split("\n").map((line, i) => {
                        const trimmed = line.trim();
                        if (!trimmed) return null;
                        // Section header
                        if (trimmed.startsWith("Suggested Daily Schedule") || trimmed.startsWith("SUGGESTED")) {
                          return <p key={i} className="font-semibold text-indigo-300 mt-2">{trimmed}</p>;
                        }
                        // Table header row (Time | Dose | ...)
                        if (/^Time\s*\|/.test(trimmed)) {
                          const cols = trimmed.split("|").map((c) => c.trim());
                          return (
                            <div key={i} className="overflow-x-auto">
                              <table className="text-xs w-full border-collapse mt-1">
                                <thead>
                                  <tr>{cols.map((c, j) => <th key={j} className="border border-gray-600 px-2 py-1 text-left text-indigo-300">{c}</th>)}</tr>
                                </thead>
                              </table>
                            </div>
                          );
                        }
                        // Table divider row (---|---|...)
                        if (/^-+\s*\|/.test(trimmed)) return null;
                        // Table data row (starts with a time like "8:00 AM |" or "8 AM |")
                        if (/^\d/.test(trimmed) && trimmed.includes("|")) {
                          const cols = trimmed.split("|").map((c) => c.trim());
                          return (
                            <div key={i} className="overflow-x-auto -mt-1">
                              <table className="text-xs w-full border-collapse">
                                <tbody>
                                  <tr>{cols.map((c, j) => <td key={j} className="border border-gray-700 px-2 py-0.5">{c}</td>)}</tr>
                                </tbody>
                              </table>
                            </div>
                          );
                        }
                        // Safety footer
                        if (trimmed === "Not medical advice.") {
                          return <p key={i} className="text-gray-500 mt-1">{trimmed}</p>;
                        }
                        return <p key={i} className="leading-relaxed">{trimmed}</p>;
                      })}
                    </div>
                  )}
                </>
              );
            })()}
            <div className="w-full overflow-x-auto">
              <div style={{ minWidth: "900px" }} className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activeBySedationChartData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" opacity={0.25} />
                    <XAxis
                      dataKey="ts"
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      ticks={chartTicks}
                      angle={-40}
                      textAnchor="end"
                      height={52}
                      tickFormatter={(value) => { const d = new Date(value); return `${d.getMonth()+1}/${d.getDate()} ${d.toLocaleTimeString([], { hour: "numeric" })}`; }}
                    />
                    <YAxis />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }}
                      labelStyle={{ color: "#f9fafb", fontWeight: 600, marginBottom: 4 }}
                      itemStyle={{ color: "#d1d5db" }}
                      labelFormatter={(value) => `🕐 ${formatChartTooltipDateTime(value)}`}
                      formatter={(value, _name, item) => {
                        const sedation = item?.payload?.sedationPressure ?? 0;
                        const effectPhaseLabel = item?.payload?.effectPhaseLabel || "pre-dose";
                        let level = "Low";
                        if (sedation >= 55) level = "High";
                        else if (sedation >= 25) level = "Moderate";
                        return [`${value} mg (${Number(sedation).toFixed(1)}% sedation, ${level}, ${effectPhaseLabel})`, "Estimated active"];
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
                    <Line type="monotone" dataKey="activeLow" name="activeMg" stroke="#22c55e" strokeWidth={2.5} dot={false} connectNulls={false} />
                    <Line type="monotone" dataKey="activeModerate" name="activeMg" stroke="#eab308" strokeWidth={2.5} dot={false} connectNulls={false} />
                    <Line type="monotone" dataKey="activeHigh" name="activeMg" stroke="#ef4444" strokeWidth={2.5} dot={false} connectNulls={false} />
                    <Line type="monotone" dataKey="trendMg" name="trend" stroke="#ffffff" strokeWidth={1.5} strokeDasharray="6 3" dot={false} connectNulls={true} strokeOpacity={0.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Sedation color bands (tolerance-adjusted pressure): <span className="text-green-500">Low (&lt;25%)</span> · <span className="text-yellow-500">Moderate (25-55%)</span> · <span className="text-red-500">High (&ge;55%)</span>
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Diazepam Equivalent Comparison (Educational)</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Shows how blood levels would look if the same doses (including carryover from {daysAtCurrentDose} days at dose) were taken as diazepam instead. Uses the standard benzodiazepine equivalency ratio: <strong>1 mg clonazepam ≈ 20 mg diazepam</strong>. Both lines use the <strong>clonazepam-equivalent mg scale</strong> — the 20:1 conversion is already applied, so a 20 mg diazepam dose is plotted as 1 mg-equiv, the same starting height as 1 mg clonazepam. A single isolated dose would produce identical peak heights on both lines. The diazepam line runs approximately 2× higher at steady state not because of a scaling discrepancy, but because diazepam&apos;s 72 h half-life allows far more accumulation between daily doses (steady-state trough ≈ 3.85× one dose) compared to clonazepam&apos;s {halfLifeHours} h half-life (trough ≈ 1.35× one dose). Dashed lines are linear regression trends for each.
        </p>
        {diazepamEquivalentChartData.length > 0 && diazepamEquivalentChartData._stats?.clonazepamVol && (() => {
          // Compute stats for the selected zoom window (historical points only)
          const zoomMs = diazepamZoomDays ? diazepamZoomDays * 24 * 60 * 60 * 1000 : Infinity;
          const windowPoints = diazepamEquivalentChartData.filter((p) => p.ts <= recalcAt && p.ts >= recalcAt - zoomMs);

          function windowStats(getY) {
            const pts = windowPoints.length >= 2 ? windowPoints : [];
            if (!pts.length) return null;
            const ys = pts.map(getY);
            const mean = ys.reduce((s, v) => s + v, 0) / ys.length;
            const variance = ys.reduce((s, v) => s + (v - mean) ** 2, 0) / ys.length;
            const stdDev = Math.sqrt(variance);
            const min = Math.min(...ys), max = Math.max(...ys);
            const cv = mean > 0 ? (stdDev / mean) * 100 : 0;
            return { mean: +mean.toFixed(3), stdDev: +stdDev.toFixed(3), min: +min.toFixed(3), max: +max.toFixed(3), range: +(max - min).toFixed(3), cv: +cv.toFixed(1) };
          }

          const cvol = windowStats((p) => p.clonazepamMg) ?? diazepamEquivalentChartData._stats.clonazepamVol;
          const dvol = windowStats((p) => p.diazepamEquivMg) ?? diazepamEquivalentChartData._stats.diazepamVol;
          const cvLess = dvol && dvol.cv < cvol.cv;
          const cvDiff = dvol ? Math.abs(cvol.cv - dvol.cv).toFixed(1) : null;

          return (
            <>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="text-gray-500 dark:text-gray-400">Stats window:</span>
                {[5, 7, 14, null].map((d) => (
                  <button key={d ?? "all"} onClick={() => setDiazepamZoomDays(d)}
                    className={`px-2 py-0.5 rounded border ${diazepamZoomDays === d ? "bg-indigo-600 border-indigo-600 text-white" : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"}`}>
                    {d ? `${d}d` : "All"}
                  </button>
                ))}
                <span className="text-gray-400 dark:text-gray-500">
                  {diazepamZoomDays ? `— stats + chart zoomed to last ${diazepamZoomDays} days` : "— full 21-day window (taper trend dominates CV)"}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-sm">
                <div className="space-y-1">
                  <p className="font-semibold text-purple-500">Clonazepam ({halfLifeHours}h HL)</p>
                  <p>Mean active: <strong>{cvol.mean} mg</strong></p>
                  <p>Std dev: <strong>{cvol.stdDev} mg</strong></p>
                  <p>Range (max−min): <strong>{cvol.range} mg</strong> ({cvol.min}–{cvol.max})</p>
                  <p>Coefficient of variation: <strong>{cvol.cv}%</strong></p>
                </div>
                {dvol && (
                  <div className="space-y-1">
                    <p className="font-semibold text-sky-400">Diazepam equiv (72h HL)</p>
                    <p>Mean active: <strong>{dvol.mean} mg-equiv</strong></p>
                    <p>Std dev: <strong>{dvol.stdDev} mg</strong></p>
                    <p>Range (max−min): <strong>{dvol.range} mg</strong> ({dvol.min}–{dvol.max})</p>
                    <p>Coefficient of variation: <strong>{dvol.cv}%</strong></p>
                  </div>
                )}
                {dvol && (
                  <div className="sm:col-span-2 pt-1 border-t border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                    {cvLess
                      ? <>Diazepam is <strong className="text-green-500">{cvDiff}% less volatile</strong> than clonazepam (lower CV = more stable blood levels between doses).</>
                      : <>Clonazepam and diazepam show similar volatility in this window (<strong>{cvDiff}%</strong> CV difference).</>
                    }
                    {!diazepamZoomDays && (
                      <p className="text-xs text-amber-500 dark:text-amber-400 mt-1">
                        Tip: Over 21 days of a taper, the downward trend dominates the variance and compresses the CV gap. Switch to a 5–7 day window to see the within-day peak-trough oscillation difference more clearly.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          );
        })()}

        <div className="rounded-lg bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800 p-3 space-y-1.5">
          <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">Why switch to diazepam for tapering?</p>
          <ul className="text-xs text-sky-800 dark:text-sky-300 list-disc list-inside space-y-1">
            <li><strong>Finer dose increments:</strong> Diazepam is available as 2 mg tablets (and oral liquid) — enabling 0.5 mg or smaller reductions. Clonazepam&apos;s smallest tablet is 0.5 mg, making small cuts impractical.</li>
            <li><strong>Interdose cushion:</strong> The 72 h HL means the trough is much closer to the peak (~1.26× ratio at q.d. dosing vs ~1.74× for clonazepam). Each dose interval is smoother, reducing the &quot;wearing off&quot; sensation between doses.</li>
            <li><strong>Missed-dose buffer:</strong> Because half the drug is still present 3 days later, a delayed dose causes a far smaller % drop in blood level than clonazepam would — reducing rebound anxiety risk.</li>
            <li><strong>Gentler final exit:</strong> The accumulation visible in the chart also means diazepam&apos;s steady-state level clears slowly and linearly at the end of the taper, rather than clonazepam&apos;s faster exponential drop.</li>
          </ul>
          <p className="text-xs text-sky-600 dark:text-sky-400">The CV difference alone understates the benefit — interdose smoothness and dose granularity are the primary clinical reasons.</p>
        </div>

        {diazepamEquivalentChartData.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">Add at least one dose to view the graph.</p>
        ) : (() => {
          const zoomMs = diazepamZoomDays ? diazepamZoomDays * 24 * 60 * 60 * 1000 : null;
          const diazepamDisplayData = zoomMs
            ? diazepamEquivalentChartData.filter((p) => p.ts >= recalcAt - zoomMs)
            : diazepamEquivalentChartData;
          const hr = 3600000;
          const tickStep = diazepamZoomDays && diazepamZoomDays <= 7 ? 12 * hr : 24 * hr;
          const s = diazepamDisplayData[0]?.ts ?? 0;
          const e = diazepamDisplayData[diazepamDisplayData.length - 1]?.ts ?? 0;
          const diazTicks = [];
          for (let t = Math.ceil(s / tickStep) * tickStep; t <= e; t += tickStep) diazTicks.push(t);
          const maxVal = Math.max(...diazepamDisplayData.filter((p) => p.ts <= recalcAt).map((p) => p.diazepamEquivMg), 0);
          return (
            <div className="overflow-x-auto">
              <div style={{ minWidth: 700 }}>
                <div className="w-full h-64 min-w-0 min-h-[16rem]">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <LineChart data={diazepamDisplayData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" opacity={0.25} />
                      <XAxis
                        dataKey="ts"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        ticks={diazTicks}
                        angle={-40}
                        textAnchor="end"
                        height={52}
                        tickFormatter={(value) => { const d = new Date(value); return `${d.getMonth()+1}/${d.getDate()} ${d.toLocaleTimeString([], { hour: "numeric" })}`; }}
                      />
                      <YAxis
                        tickFormatter={(value) => `${value} mg`}
                        domain={[0, maxVal > 0 ? Number((maxVal * 1.1).toFixed(1)) : "auto"]}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }}
                        labelStyle={{ color: "#f9fafb", fontWeight: 600, marginBottom: 4 }}
                        itemStyle={{ color: "#d1d5db" }}
                        labelFormatter={(value) => `🕐 ${formatChartTooltipDateTime(value)}`}
                        formatter={(value, name) => {
                          if (name === "clonazepamMg") return [`${value} mg`, `Clonazepam active (${halfLifeHours}h HL)`];
                          if (name === "diazepamEquivMg") {
                            const diaz = Number((value * DIAZEPAM_EQUIVALENCE_RATIO).toFixed(1));
                            return [`${value} mg-equiv (= ${diaz} mg diazepam)`, "Active if diazepam used (72h HL)"];
                          }
                          if (name === "clonazepamTrend") return [`${value} mg`, "Clonazepam trend"];
                          if (name === "diazepamTrend") return [`${value} mg-equiv`, "Diazepam trend"];
                          return [value, name];
                        }}
                      />
                      <ReferenceLine
                        x={recalcAt}
                        stroke="#94a3b8"
                        strokeWidth={1.5}
                        isFront
                        label={{
                          value: `Now`,
                          position: "insideTopRight",
                          fill: "#94a3b8",
                          fontSize: 11,
                        }}
                      />
                      {withdrawalThresholdMg !== null && (
                        <ReferenceLine
                          y={withdrawalThresholdMg}
                          stroke="#ef4444"
                          strokeDasharray="6 3"
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
                      <Line type="monotone" dataKey="clonazepamMg" name="clonazepamMg" stroke="#a855f7" strokeWidth={2.5} dot={false} connectNulls />
                      <Line type="monotone" dataKey="diazepamEquivMg" name="diazepamEquivMg" stroke="#38bdf8" strokeWidth={2.5} dot={false} connectNulls />
                      <Line type="monotone" dataKey="clonazepamTrend" name="clonazepamTrend" stroke="#a855f7" strokeWidth={1.5} strokeDasharray="6 3" dot={false} connectNulls={true} strokeOpacity={0.5} />
                      <Line type="monotone" dataKey="diazepamTrend" name="diazepamTrend" stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="6 3" dot={false} connectNulls={true} strokeOpacity={0.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          );
        })()}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Educational comparison only — not medical advice. Diazepam PK model: 30 min absorption lag, 60 min ramp, 72 h half-life (no active-metabolite layer). Equivalency ratio is approximate; individual response varies. Discuss any medication decisions with your prescriber.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={explainDiazepam}
            disabled={diazExplanationBusy}
            className="px-3 py-1.5 rounded text-xs bg-sky-700 text-white hover:bg-sky-600 disabled:opacity-50"
          >
            {diazExplanationBusy ? "…" : "Explain with AI"}
          </button>
          {diazExplanationError && <p className="text-xs text-red-400">{diazExplanationError}</p>}
        </div>
        {diazExplanation && (
          <div className="text-xs text-gray-300 bg-gray-800 rounded p-3 border border-gray-700 space-y-1.5">
            {diazExplanation.split("\n").map((line, i) => {
              const t = line.trim();
              if (!t) return null;
              if (t === "Not medical advice.") return <p key={i} className="text-gray-500">{t}</p>;
              return <p key={i} className="leading-relaxed">{t}</p>;
            })}
          </div>
        )}
      </div>

      {/* ── Anxiety Level Chart ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Estimated Anxiety Level</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Modeled composite of caffeine&apos;s excitatory (anxiogenic) pressure and clonazepam&apos;s anxiolytic effect.
          <strong className="text-green-500"> Low</strong> (&lt;35) ·
          <strong className="text-yellow-500"> Moderate</strong> (35–65) ·
          <strong className="text-red-500"> High</strong> (&gt;65).
          Higher caffeine lifts the index; higher clonazepam active level drops it.
          Not a clinical anxiety score — educational model only.
        </p>
        {anxietyChartData.length > 0 ? (() => {
          const now = recalcAt;
          const historical = anxietyChartData.filter((p) => p.ts <= now);
          const currentIdx = historical.length ? historical[historical.length - 1] : null;
          const currentVal = currentIdx ? (currentIdx.anxietyHigh ?? currentIdx.anxietyModerate ?? currentIdx.anxietyLow ?? 0) : 0;
          const currentLevel = currentVal >= ANXIETY_HIGH_THRESHOLD ? "high" : currentVal >= ANXIETY_LOW_THRESHOLD ? "moderate" : "low";
          const levelColor = { low: "text-green-500", moderate: "text-yellow-500", high: "text-red-500" }[currentLevel];
          const levelLabel = { low: "Low", moderate: "Moderate", high: "High" }[currentLevel];
          return (
            <>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-500 dark:text-gray-400">Now:</span>
                <span className={`font-semibold ${levelColor}`}>{levelLabel}</span>
                <span className="text-gray-400 dark:text-gray-500">({currentVal.toFixed(1)} / 100)</span>
              </div>
              <div className="overflow-x-auto">
                <div style={{ minWidth: 700 }}>
                  <div className="w-full h-56 min-w-0 min-h-[14rem]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                      <LineChart data={anxietyChartData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" opacity={0.25} />
                        <XAxis
                          dataKey="ts"
                          type="number"
                          domain={["dataMin", "dataMax"]}
                          ticks={chartTicks}
                          angle={-40}
                          textAnchor="end"
                          height={52}
                          tickFormatter={(value) => { const d = new Date(value); return `${d.getMonth()+1}/${d.getDate()} ${d.toLocaleTimeString([], { hour: "numeric" })}`; }}
                        />
                        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}`} width={30} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }}
                          labelStyle={{ color: "#f9fafb", fontWeight: 600, marginBottom: 4 }}
                          itemStyle={{ color: "#d1d5db" }}
                          labelFormatter={(value) => `🕐 ${formatChartTooltipDateTime(value)}`}
                          formatter={(value, name) => {
                            const labels = { anxietyLow: "Low", anxietyModerate: "Moderate", anxietyHigh: "High" };
                            return value !== null ? [`${value}`, `Anxiety ${labels[name] ?? name}`] : [null, null];
                          }}
                        />
                        <ReferenceLine y={ANXIETY_LOW_THRESHOLD} stroke="#eab308" strokeDasharray="4 2" strokeWidth={1} strokeOpacity={0.5} />
                        <ReferenceLine y={ANXIETY_HIGH_THRESHOLD} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1} strokeOpacity={0.5} />
                        <ReferenceLine
                          x={recalcAt}
                          stroke="#94a3b8"
                          strokeWidth={1.5}
                          isFront
                          label={{ value: "Now", position: "insideTopRight", fill: "#94a3b8", fontSize: 11 }}
                        />
                        <Line type="monotone" dataKey="anxietyLow"      name="anxietyLow"      stroke="#22c55e" strokeWidth={2.5} dot={false} connectNulls={false} />
                        <Line type="monotone" dataKey="anxietyModerate" name="anxietyModerate" stroke="#eab308" strokeWidth={2.5} dot={false} connectNulls={false} />
                        <Line type="monotone" dataKey="anxietyHigh"     name="anxietyHigh"     stroke="#ef4444" strokeWidth={2.5} dot={false} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          );
        })() : (
          <p className="text-gray-500 dark:text-gray-400">Add at least one dose to view anxiety estimate.</p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={explainAnxiety}
            disabled={anxietyExplanationBusy}
            className="px-3 py-1.5 rounded text-xs bg-yellow-700 text-white hover:bg-yellow-600 disabled:opacity-50"
          >
            {anxietyExplanationBusy ? "…" : "Explain with AI"}
          </button>
          {anxietyExplanationError && <p className="text-xs text-red-400">{anxietyExplanationError}</p>}
        </div>
        {anxietyExplanation && (
          <div className="text-xs text-gray-300 bg-gray-800 rounded p-3 border border-gray-700 space-y-1.5">
            {anxietyExplanation.split("\n").map((line, i) => {
              const t = line.trim();
              if (!t) return null;
              if (t === "Not medical advice.") return <p key={i} className="text-gray-500">{t}</p>;
              return <p key={i} className="leading-relaxed">{t}</p>;
            })}
          </div>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Formula: anxietyIndex = clamp(40 + caffeineStimPressure × 0.75 − sedationPressure × 0.6 + withdrawalBoost, 0, 100). withdrawalBoost = √(deficit) × downregulation × dependenceDepth × 90, active only when clonazepam level falls below the withdrawal threshold. Stimulant and sedation pressures use sigmoid pharmacodynamic models. Not a clinical anxiety score — not medical advice.
        </p>
      </div>

      {/* ── CBT Support + Worksheets ─────────────────────────────────────── */}
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10 p-4 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🧠</span>
          <div>
            <h2 className="font-semibold text-emerald-900 dark:text-emerald-100">CBT Support for Taper Anxiety</h2>
            <p className="text-sm text-emerald-700 dark:text-emerald-300">Cognitive Behavioral Therapy tools and an AI chat assistant — not a replacement for a licensed therapist.</p>
          </div>
        </div>

        {/* CBT AI Chat */}
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-gray-900 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">CBT AI Assistant</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Supports thought challenging, cognitive restructuring, and coping strategies. Uses your current taper context. Requires Groq API key.</p>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {cbtMessages.map((msg, i) => (
              <div key={i} className={`text-xs rounded p-2 ${msg.role === "user" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100 text-right ml-8" : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 mr-8"}`}>
                {msg.content}
              </div>
            ))}
            {cbtBusy && <div className="text-xs text-gray-400 animate-pulse">Thinking…</div>}
          </div>
          <div className="flex gap-2 flex-wrap">
            {["I'm feeling anxious right now", "Help me challenge a negative thought", "What is a grounding exercise?", "I missed a dose — how do I cope?"].map((q) => (
              <button key={q} onClick={() => setCbtInput(q)} className="px-2 py-1 text-xs rounded-full border border-emerald-300 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">{q}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <textarea
              value={cbtInput}
              onChange={(e) => setCbtInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendCbtMessage(); } }}
              rows={2}
              placeholder="Ask about a CBT technique, share a thought to challenge…"
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
            <div className="flex flex-col gap-1">
              <button onClick={sendCbtMessage} disabled={cbtBusy || !cbtInput.trim()} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium">{cbtBusy ? "…" : "Send"}</button>
              <button onClick={() => { setCbtMessages([]); setCbtError(""); }} disabled={cbtMessages.length === 0} className="px-3 py-1 rounded-lg border border-emerald-300 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-xs disabled:opacity-50">Clear</button>
            </div>
          </div>
          {cbtError && <p className="text-xs text-red-400">{cbtError}</p>}
        </div>

        {/* CBT Worksheets */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">CBT Worksheets & Tools</h3>
          <div className="space-y-2">
            <details className="rounded-lg border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-gray-900 p-3">
              <summary className="cursor-pointer text-sm font-medium text-emerald-800 dark:text-emerald-200 list-none flex items-center justify-between">
                📝 Thought Record (3-Column)
                <span className="text-xs text-emerald-500">▼</span>
              </summary>
              <div className="mt-3 space-y-3 text-xs text-gray-700 dark:text-gray-300">
                <p className="text-gray-500 dark:text-gray-400">Identify the automatic thought, the emotion it creates, and a balanced alternative.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[["Situation / Trigger", "What happened? When and where?"], ["Automatic Thought", "What went through your mind? (rate belief 0–100%)"], ["Balanced Response", "What would be a more balanced way to see this?"]].map(([label, hint]) => (
                    <label key={label} className="space-y-1">
                      <span className="font-semibold text-emerald-700 dark:text-emerald-300">{label}</span>
                      <textarea rows={4} placeholder={hint} className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none text-xs" />
                    </label>
                  ))}
                </div>
              </div>
            </details>

            <details className="rounded-lg border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-gray-900 p-3">
              <summary className="cursor-pointer text-sm font-medium text-emerald-800 dark:text-emerald-200 list-none flex items-center justify-between">
                📊 Anxiety Hierarchy (SUD Scale)
                <span className="text-xs text-emerald-500">▼</span>
              </summary>
              <div className="mt-3 space-y-2 text-xs text-gray-700 dark:text-gray-300">
                <p className="text-gray-500 dark:text-gray-400">List anxiety-triggering situations ordered from least (10) to most (100) distressing. Use this to plan gradual exposure.</p>
                {[10, 25, 40, 55, 70, 85, 100].map((sud) => (
                  <div key={sud} className="flex items-center gap-2">
                    <span className={`w-10 text-right font-bold ${sud >= 70 ? "text-red-500" : sud >= 40 ? "text-yellow-500" : "text-green-500"}`}>{sud}</span>
                    <input type="text" placeholder={`SUD ${sud} — describe situation`} className="flex-1 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs" />
                  </div>
                ))}
              </div>
            </details>

            <details className="rounded-lg border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-gray-900 p-3">
              <summary className="cursor-pointer text-sm font-medium text-emerald-800 dark:text-emerald-200 list-none flex items-center justify-between">
                ✅ Behavioral Activation Planner
                <span className="text-xs text-emerald-500">▼</span>
              </summary>
              <div className="mt-3 space-y-2 text-xs text-gray-700 dark:text-gray-300">
                <p className="text-gray-500 dark:text-gray-400">Schedule activities that provide mastery or pleasure — a core antidepressant and anti-anxiety strategy during withdrawal.</p>
                {["Morning", "Afternoon", "Evening"].map((time) => (
                  <div key={time} className="space-y-1">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">{time}</span>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" placeholder="Mastery activity (accomplishment)" className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs" />
                      <input type="text" placeholder="Pleasure activity (enjoyment)" className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs" />
                    </div>
                  </div>
                ))}
              </div>
            </details>

            <details className="rounded-lg border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-gray-900 p-3">
              <summary className="cursor-pointer text-sm font-medium text-emerald-800 dark:text-emerald-200 list-none flex items-center justify-between">
                🌬️ Grounding Techniques (5-4-3-2-1)
                <span className="text-xs text-emerald-500">▼</span>
              </summary>
              <div className="mt-3 space-y-2 text-xs text-gray-700 dark:text-gray-300">
                <p className="text-gray-500 dark:text-gray-400">Use during acute anxiety or dissociation. Name things you can perceive with each sense right now.</p>
                {[["👁️ 5 things you can SEE", 5], ["🤲 4 things you can TOUCH", 4], ["👂 3 things you can HEAR", 3], ["👃 2 things you can SMELL", 2], ["👅 1 thing you can TASTE", 1]].map(([label, n]) => (
                  <div key={label} className="space-y-1">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">{label}</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                      {Array.from({ length: n }).map((_, j) => (
                        <input key={j} type="text" placeholder={`${j + 1}.`} className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">CBT worksheets are educational tools only. Not a replacement for a licensed therapist. If you are in crisis, call or text 988 (Suicide & Crisis Lifeline) or contact your prescriber.</p>
      </div>

      <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/10 p-4 space-y-3">
        <h2 className="font-semibold text-indigo-950 dark:text-indigo-100">Educational Taper Schedule Preview</h2>
        <p className="text-sm text-indigo-900 dark:text-indigo-200">
          Enter a clinician-agreed taper pattern below to preview dates and dose steps. The first reduction is applied immediately at schedule start. This does not recommend a taper and is not medical advice.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <label className="space-y-1">
            <span className="text-sm text-indigo-900 dark:text-indigo-200">Start date</span>
            <input
              type="datetime-local"
              value={taperStartDate}
              onChange={(e) => {
                setTaperStartDate(e.target.value);
                try { localStorage.setItem(TAPER_START_DATE_STORAGE_KEY, e.target.value); } catch { /* ignore */ }
              }}
              className="w-full px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-gray-900"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-indigo-900 dark:text-indigo-200">Start dose (mg)</span>
            <input
              type="number"
              min="0.125"
              step="0.125"
              value={taperStartDoseMg}
              readOnly
              className="w-full px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-gray-900"
            />
            <p className="text-xs text-indigo-800 dark:text-indigo-300">Auto-linked to Daily maintenance dose.</p>
          </label>
          <label className="space-y-1">
            <span className="text-sm text-indigo-900 dark:text-indigo-200">Reduce by (mg)</span>
            <input
              type="number"
              min="0.125"
              step="0.125"
              value={taperStepMg}
              onChange={(e) => { setTaperStepMg(e.target.value); try { localStorage.setItem(TAPER_STEP_MG_STORAGE_KEY, e.target.value); } catch { /* ignore */ } }}
              className="w-full px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-gray-900"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-indigo-900 dark:text-indigo-200">Hold each step (days)</span>
            <input
              type="number"
              min="1"
              step="1"
              value={taperHoldDays}
              onChange={(e) => { setTaperHoldDays(e.target.value); try { localStorage.setItem(TAPER_HOLD_DAYS_STORAGE_KEY, e.target.value); } catch { /* ignore */ } }}
              className="w-full px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-gray-900"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-indigo-900 dark:text-indigo-200">Lowest non-zero dose (mg)</span>
            <input
              type="number"
              min="0"
              step="0.125"
              value={taperMinimumDoseMg}
              onChange={(e) => { setTaperMinimumDoseMg(e.target.value); try { localStorage.setItem(TAPER_MINIMUM_DOSE_MG_STORAGE_KEY, e.target.value); } catch { /* ignore */ } }}
              className="w-full px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-gray-900"
            />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-indigo-950 dark:text-indigo-100">
          <p>Total taper steps: <strong>{taperSchedule.rows.length}</strong></p>
          <p>Total planned duration: <strong>{taperSchedule.totalDays} days</strong></p>
          <p>Projected end date: <strong>{taperSchedule.completedAt ? formatScheduleDate(taperSchedule.completedAt) : "-"}</strong></p>
        </div>
        {taperSchedule.rows.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-indigo-200 dark:border-indigo-800">
            <table className="min-w-full text-sm">
              <thead className="bg-indigo-100/70 dark:bg-indigo-900/30 text-indigo-950 dark:text-indigo-100">
                <tr>
                  <th className="px-3 py-2 text-left">Step</th>
                  <th className="px-3 py-2 text-left">Dose</th>
                  <th className="px-3 py-2 text-left">Diazepam equiv</th>
                  <th className="px-3 py-2 text-left">Diazepam SS trough</th>
                  <th className="px-3 py-2 text-left">Step slope</th>
                  <th className="px-3 py-2 text-left">Start</th>
                  <th className="px-3 py-2 text-left">Hold until</th>
                  <th className="px-3 py-2 text-left">Days</th>
                </tr>
              </thead>
              <tbody>
                {taperSchedule.rows.map((row) => {
                  const isCurrentStep = currentTaperStep.rowId === row.id;
                  return (
                  <tr
                    key={row.id}
                    className={`border-t border-indigo-100 dark:border-indigo-900/40 text-gray-900 dark:text-gray-100 ${isCurrentStep ? "bg-indigo-100/70 dark:bg-indigo-900/40" : ""}`}
                  >
                    <td className="px-3 py-2">
                      {row.stepNumber}
                      {isCurrentStep && <span className="ml-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300">Current</span>}
                    </td>
                    <td className="px-3 py-2">{row.doseMg.toFixed(3)} mg</td>
                    {(() => {
                      const proj = taperDiazepamProjection.rows.find((r) => r.id === row.id);
                      const slope = proj?.slopeThisStepMgPerDay;
                      const slopeDir = slope > 0.0001 ? "↑" : slope < -0.0001 ? "↓" : "→";
                      const slopeColor = slope > 0.0001 ? "text-red-500" : slope < -0.0001 ? "text-green-500" : "text-gray-400";
                      return (
                        <>
                          <td className="px-3 py-2 text-sky-600 dark:text-sky-400">{proj ? `${proj.diazepamMg} mg` : "—"}</td>
                          <td className="px-3 py-2 text-sky-600 dark:text-sky-400">{proj ? `${proj.diazSSTroughEquiv} mg-eq` : "—"}</td>
                          <td className={`px-3 py-2 font-mono text-xs ${slopeColor}`}>{proj ? `${slopeDir} ${Math.abs(slope).toFixed(4)} mg/d` : "—"}</td>
                        </>
                      );
                    })()}
                    <td className="px-3 py-2">{formatScheduleDate(row.startMs)}</td>
                    <td className="px-3 py-2">{formatScheduleDate(row.endMs)}</td>
                    <td className="px-3 py-2">{row.holdDays}</td>
                  </tr>
                  );
                })}
                <tr className={`border-t border-indigo-100 dark:border-indigo-900/40 text-gray-900 dark:text-gray-100 ${currentTaperStep.isStop ? "bg-indigo-100/70 dark:bg-indigo-900/40" : ""}`}>
                  <td className="px-3 py-2 font-semibold">
                    Stop
                    {currentTaperStep.isStop && <span className="ml-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300">Current</span>}
                  </td>
                  <td className="px-3 py-2">0 mg</td>
                  <td className="px-3 py-2 text-sky-600 dark:text-sky-400">0 mg</td>
                  <td className="px-3 py-2 text-sky-600 dark:text-sky-400">0 mg-eq</td>
                  <td className="px-3 py-2">—</td>
                  <td className="px-3 py-2">{taperSchedule.completedAt ? formatScheduleDate(taperSchedule.completedAt) : "-"}</td>
                  <td className="px-3 py-2">—</td>
                  <td className="px-3 py-2">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-indigo-900 dark:text-indigo-200">Enter a starting dose and step size to preview a schedule.</p>
        )}
        {taperDiazepamProjection.summary && (
          <div className="rounded-lg bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 p-3 space-y-1.5 text-sm text-indigo-950 dark:text-indigo-100">
            <p className="font-semibold text-indigo-800 dark:text-indigo-200">Taper trajectory (steady-state estimate, once-daily dosing)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-0.5">
                <p className="font-medium text-purple-600 dark:text-purple-400">Clonazepam ({halfLifeHours}h HL)</p>
                <p>First step SS trough: <strong>{taperDiazepamProjection.summary.firstCloSS} mg</strong></p>
                <p>Last step SS trough: <strong>{taperDiazepamProjection.summary.lastCloSS} mg</strong></p>
                <p>Overall slope: <strong className={taperDiazepamProjection.summary.cloOverallSlope < 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}>{taperDiazepamProjection.summary.cloOverallSlope > 0 ? "↑" : "↓"} {Math.abs(taperDiazepamProjection.summary.cloOverallSlope).toFixed(4)} mg/day</strong> over {taperDiazepamProjection.summary.totalDays} days</p>
              </div>
              <div className="space-y-0.5">
                <p className="font-medium text-sky-500 dark:text-sky-400">Diazepam equivalent (72h HL)</p>
                <p>First step SS trough: <strong>{taperDiazepamProjection.summary.firstDiazSS} mg-equiv</strong></p>
                <p>Last step SS trough: <strong>{taperDiazepamProjection.summary.lastDiazSS} mg-equiv</strong></p>
                <p>Overall slope: <strong className={taperDiazepamProjection.summary.diazOverallSlope < 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}>{taperDiazepamProjection.summary.diazOverallSlope > 0 ? "↑" : "↓"} {Math.abs(taperDiazepamProjection.summary.diazOverallSlope).toFixed(4)} mg-equiv/day</strong> over {taperDiazepamProjection.summary.totalDays} days</p>
              </div>
            </div>
            <p className="text-xs text-indigo-800 dark:text-indigo-400 pt-1">SS trough = estimated steady-state trough level with once-daily dosing. Step slope = rate of change in blood level as body adjusts to each new dose. Clonazepam adjusts faster (30h HL); diazepam transitions span ~3–4 days (72h HL) but ultimately reaches a lower relative trough per mg due to accumulation.</p>
          </div>
        )}
        <p className="text-xs text-indigo-900 dark:text-indigo-200">
          Safety note: benzodiazepine tapers should be planned with your prescriber. This preview is only a date-and-dose worksheet for an already-decided plan.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Sedation Pressure (Estimated)</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <span className="text-purple-600 dark:text-purple-400 font-semibold">Purple</span> shows sedation pressure adjusted by days at current dose ({daysAtCurrentDose}, {toleranceReductionPercent(daysAtCurrentDose).toFixed(1)}% reduction); <span className="text-cyan-500 dark:text-cyan-300 font-semibold">cyan</span> shows effective alertness.
        </p>
        {sedationPressureData.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">Add at least one dose to view the graph.</p>
        ) : (
          <div className="w-full h-64 min-w-0 min-h-[16rem]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
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
                  tickFormatter={(value) => { const d = new Date(value); return `${d.getMonth()+1}/${d.getDate()} ${d.toLocaleTimeString([], { hour: "numeric" })}`; }}
                />
                <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }}
                  labelStyle={{ color: "#f9fafb", fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: "#d1d5db" }}
                  labelFormatter={(value) => `🕐 ${formatChartTooltipDateTime(value)}`}
                  formatter={(value, name, item) => {
                    const effectPhaseLabel = item?.payload?.effectPhaseLabel || "pre-dose";
                    if (name === "pressureNoTolerance") return [`${value}% (${effectPhaseLabel})`, "Sedation pressure (no tolerance)"];
                    if (name === "pressure") return [`${value}% (${effectPhaseLabel})`, `Sedation pressure (${daysAtCurrentDose} days)`];
                    if (name === "circadianPenalty") return [`${value}% (${effectPhaseLabel})`, "Circadian sleep pressure"];
                    return [`${value}% (${effectPhaseLabel})`, "Effective alertness"];
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
                  dataKey="pressure"
                  name="pressure"
                  stroke="#a855f7"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="alertness"
                  name="alertness"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">GABA-A Downregulation (Modeled)</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Modeled receptor adaptation from your tolerance setting. <span className="text-green-600 dark:text-green-400 font-semibold">Green</span> is estimated receptor sensitivity, <span className="text-red-600 dark:text-red-400 font-semibold">red</span> is estimated downregulation. Current setting: {daysAtCurrentDose} days at dose.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-800 dark:text-gray-200">
          <p>Current receptor sensitivity: <strong>{liveMath.receptorSensitivity}%</strong></p>
          <p>Current modeled downregulation: <strong>{liveMath.gabaDownregulation}%</strong></p>
        </div>
        {gabaDownregulationData.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No tolerance data available.</p>
        ) : (
          <div className="w-full h-64 min-w-0 min-h-[16rem]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <LineChart data={gabaDownregulationData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" opacity={0.25} />
                <XAxis dataKey="day" type="number" domain={[0, "dataMax"]} label={{ value: "Days at dose", position: "insideBottom", offset: -10 }} />
                <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }}
                  labelStyle={{ color: "#f9fafb", fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: "#d1d5db" }}
                  labelFormatter={(value) => `Day ${value}`}
                  formatter={(value, name) => {
                    if (name === "receptorSensitivity") return [`${value}%`, "GABA-A receptor sensitivity"];
                    return [`${value}%`, "GABA-A downregulation"];
                  }}
                />
                <ReferenceLine
                  x={Math.max(0, Math.round(Number(daysAtCurrentDose) || 0))}
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  isFront
                  label={{ value: `Current day ${Math.max(0, Math.round(Number(daysAtCurrentDose) || 0))}`, position: "insideTopRight", fill: "#94a3b8", fontSize: 11 }}
                />
                <Line type="monotone" dataKey="receptorSensitivity" name="receptorSensitivity" stroke="#22c55e" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="downregulation" name="downregulation" stroke="#ef4444" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          This is a simplified educational model linked to your tolerance setting, not a direct biomarker measurement.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Caffeine × Clonazepam Interaction (Estimated)</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <span className="text-purple-600 dark:text-purple-400 font-semibold">Purple</span> is clonazepam sedation pressure, <span className="text-amber-500 dark:text-amber-300 font-semibold">amber</span> is caffeine wakefulness support. Caffeine does not reduce the modeled clonazepam impairment signal.
        </p>
        {interactionData.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">Add at least one dose to view the graph.</p>
        ) : (
          <div className="w-full h-64 min-w-0 min-h-[16rem]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
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
                  tickFormatter={(value) => { const d = new Date(value); return `${d.getMonth()+1}/${d.getDate()} ${d.toLocaleTimeString([], { hour: "numeric" })}`; }}
                />
                <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }}
                  labelStyle={{ color: "#f9fafb", fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: "#d1d5db" }}
                  itemSorter={(item) => {
                    if (item?.name === "sedationPressure") return 0;
                    if (item?.name === "caffeineCounterPressure") return 1;
                    return 2;
                  }}
                  labelFormatter={(value) => `🕐 ${formatChartTooltipDateTime(value)}`}
                  formatter={(value, name, item) => {
                    const effectPhaseLabel = item?.payload?.effectPhaseLabel || "pre-dose";
                    if (name === "sedationPressure") return [`${value}% (${effectPhaseLabel})`, "Clonazepam sedation pressure"];
                    if (name === "caffeineCounterPressure") return [`${value}% (${effectPhaseLabel})`, "Caffeine wakefulness support"];
                    if (name === "alertnessBaseline") return [`${value}% (${effectPhaseLabel})`, "Baseline alertness (no caffeine)"];
                    return [`${value}% (${effectPhaseLabel})`, "Effective alertness with caffeine"];
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
                <Line type="monotone" dataKey="sedationPressure" name="sedationPressure" stroke="#a855f7" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="caffeineCounterPressure" name="caffeineCounterPressure" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
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
            {combinedDoseLogGroups.map((group) => {
              const dayEndTs = new Date(`${group.dayKey}T23:59:59`).getTime();
              const stepDoseMg = taperStepDoseForTs(dayEndTs, taperSchedule.rows);
              const dayTotalMg = dailyClonazepamTotals[group.dayKey] || 0;
              const exceedsStep = stepDoseMg !== null && dayTotalMg > stepDoseMg + 0.0005;
              const underStep = stepDoseMg !== null && !exceedsStep && dayTotalMg > 0 && dayTotalMg < stepDoseMg - 0.0005;
              const dayTotalLabel = parseFloat(dayTotalMg.toFixed(3));
              const stepDoseLabel = stepDoseMg !== null ? parseFloat(stepDoseMg.toFixed(3)) : null;
              const dayBorderClass = exceedsStep
                ? "rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-900/10 p-2"
                : underStep
                ? "rounded-lg border border-green-300 dark:border-green-700 bg-green-50/30 dark:bg-green-900/10 p-2"
                : "";
              return (
              <div key={group.dayKey} className={`space-y-2 ${dayBorderClass}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{group.label}</p>
                  {modeledCarryoverOverriddenDayKeys.has(group.dayKey) && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                      Maintenance overridden
                    </span>
                  )}
                  {exceedsStep && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" title={`Total logged: ${dayTotalLabel} mg — taper step target: ${stepDoseLabel} mg`}>
                      ⚠ {dayTotalLabel} mg · over step ({stepDoseLabel} mg)
                    </span>
                  )}
                  {underStep && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" title={`Total logged: ${dayTotalLabel} mg — taper step target: ${stepDoseLabel} mg`}>
                      ✓ {dayTotalLabel} mg · under step ({stepDoseLabel} mg)
                    </span>
                  )}
                </div>
                {group.entries.map((entry) => (
                  <div
                    key={`${entry.source}-${entry.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
                  >
                    <div className="text-sm text-gray-900 dark:text-white">
                      {entry.source === "caffeine" ? (
                        <>
                          {getEntryTakenAtMs(entry, recalcAt) > recalcAt && (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 mr-2 text-[11px] font-semibold bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                              Future
                            </span>
                          )}
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
              );
            })}
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
        <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/10 p-3 space-y-2 text-xs sm:text-sm text-indigo-950 dark:text-indigo-100">
          <h3 className="font-semibold">Live calculations using your current tracker inputs</h3>
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-indigo-800 dark:text-indigo-300">Calculation time</span>
              <input
                type="datetime-local"
                value={toLocalDateTimeInputValue(liveCalcAt)}
                onChange={(e) => saveLiveCalcAt(e.target.value)}
                className="px-2 py-1 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-gray-900"
              />
            </label>
            <button
              type="button"
              onClick={resetLiveCalcAtNow}
              className={liveCalcPresetButtonClass("current")}
            >
              Use current time
            </button>
            <button
              type="button"
              onClick={() => setLiveCalcToRelativeDay(0, "today")}
              className={liveCalcPresetButtonClass("today")}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setLiveCalcToRelativeDay(-1, "yesterday")}
              className={liveCalcPresetButtonClass("yesterday")}
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => setLiveCalcToRelativeDay(1, "tomorrow")}
              className={liveCalcPresetButtonClass("tomorrow")}
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={setLiveCalcToLastMaintenanceDose}
              className={liveCalcPresetButtonClass("lastMaintenance")}
            >
              Last maintenance dose
            </button>
            <button
              type="button"
              onClick={setLiveCalcToLastLoggedDose}
              className={liveCalcPresetButtonClass("lastLogged")}
            >
              Last logged dose
            </button>
          </div>
          {Number.isFinite(Number(effectiveLastMaintenanceDoseAtMs)) && Number(effectiveLastMaintenanceDoseAtMs) > 0 && (
            <p className="text-[11px] text-indigo-800 dark:text-indigo-300">
              Resolved last maintenance: {formatChartTooltipDateTime(effectiveLastMaintenanceDoseAtMs)}.
            </p>
          )}
          <p><strong>Evaluated at:</strong> {formatChartTooltipDateTime(liveMath.evaluatedAt)}.</p>
          <p><strong>Current active:</strong> {liveMath.activeMg} mg.</p>
          <p><strong>Skipped carryover doses (same-day override):</strong> {modeledCarryoverSkippedSameDay}.</p>
          <p><strong>Concentration pressure:</strong> 100 × (Active/Weight)/(Active/Weight + {liveMath.sedationEc50MgPerKg}) = {liveMath.concentrationPressure}%.</p>
          <p><strong>Acute sedation kernel:</strong> summed acute entry effects at selected time = {liveMath.acuteSedationPressure}%.</p>
          <p><strong>Blended sedation before tolerance:</strong> 0.4×P_conc + 0.6×min(100, Acute) = {liveMath.blendedPressure}%.</p>
          <p><strong>Tolerance factor:</strong> {liveMath.toleranceFactor} → {liveMath.toleranceReduction}% reduction from {daysAtCurrentDose} days at dose.</p>
          <p><strong>GABA-A adaptation (modeled):</strong> receptor sensitivity {liveMath.receptorSensitivity}%, downregulation {liveMath.gabaDownregulation}%.</p>
          <p><strong>Final sedation pressure:</strong> blended × tolerance = {liveMath.sedationPressure}%.</p>
          <p><strong>Circadian penalty:</strong> {liveMath.circadianPenalty}% → effective alertness {liveMath.alertness}%.</p>
          <p><strong>Body weight used in model:</strong> {liveMath.interactionWeightKg} kg ({liveMath.interactionWeightSource}).</p>
          <p><strong>Caffeine interaction layer:</strong> wakefulness support {liveMath.caffeineCounterPressure}% → effective alertness with caffeine {liveMath.alertnessWithCaffeine}%.</p>
          {liveMath.withdrawalThresholdMg !== null && (
            <p><strong>Withdrawal-risk threshold estimate:</strong> {liveMath.withdrawalThresholdMg} mg.</p>
          )}
          {(() => {
            const slope = activeBySedationChartData._slope ?? 0;
            const dir = slope < -0.0005 ? "declining" : slope > 0.0005 ? "increasing" : "stable";
            const days = Object.keys(dailyClonazepamTotals);
            const n = days.length;
            return (
              <p><strong>21-day trend slope (linear regression on daily averages):</strong> {slope >= 0 ? "+" : ""}{slope.toFixed(5)} mg/day ({dir}). Computed over {n} logged day{n !== 1 ? "s" : ""} sampled once per day (daily noon average). Formula: slope = Σ[(tᵢ − t̄)(yᵢ − ȳ)] / Σ(tᵢ − t̄)², where tᵢ is day timestamp and yᵢ is daily average active mg.</p>
            );
          })()}
        </div>
        <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 space-y-2">
          <p><strong>Clonazepam elimination:</strong> Active(t) = Dose × Onset(t) × 0.5^((t − t_dose) / halfLifeHours)</p>
          <p><strong>Absorption lag/ramp:</strong> Onset(t) = 0 for the first {CLONAZEPAM_ONSET_LAG_MINUTES} min, then a fixed smooth ramp rises over the next {CLONAZEPAM_ONSET_RAMP_MINUTES} min to full effect, so concentration-driven effects typically peak around {CLONAZEPAM_ONSET_FULL_EFFECT_MINUTES} min instead of immediately.</p>
          <p><strong>Acute sedation kernel:</strong> Acute(t) = 100 × [Dose/(Dose + 0.25)] × (1 − e^(−elapsed/1.1)) × e^(−elapsed/6.5)</p>
          <p><strong>Tolerance factor:</strong> Tol(days) = 1 − 0.35 × (1 − e^(−days/10))</p>
          <p><strong>GABA-A adaptation (simplified):</strong> Sensitivity% = 100 × Tol(days), Downregulation% = 100 − Sensitivity%</p>
          <p><strong>Sedation pressure:</strong> P_conc = 100 × (Active_mg/kg)/(Active_mg/kg + {liveMath.sedationEc50MgPerKg}), P_blend = 0.4 × P_conc + 0.6 × min(100, Acute), P = clamp(P_blend × Tol, 0, 100)</p>
          <p><strong>Circadian sleep pressure:</strong> SleepPenalty = S × ((cos(2π × (hour − (3 + shift))/24) + 1)/2), where S = Night penalty (0–50%)</p>
          <p><strong>Effective alertness:</strong> Alertness = clamp(100 − P − SleepPenalty, 0, 100)</p>
          <p><strong>Caffeine wakefulness support:</strong> each caffeine entry uses a fixed {CAFFEINE_ONSET_LAG_MINUTES} min lag plus {CAFFEINE_ONSET_RAMP_MINUTES} min smooth ramp to full effect, so wakefulness support typically peaks around {CAFFEINE_ONSET_FULL_EFFECT_MINUTES} min after each sip; C = ActiveCaffeine_mg / weight_kg, Support = 100 × C/(C + 2.0), Alertness_with_caffeine = clamp(Alertness + Support, 0, 100); sedation pressure itself is unchanged.</p>
          <p><strong>Withdrawal risk threshold (estimated):</strong> decay = 0.5^(interval/halfLife), Trough_ss = MaintenanceDose × [decay/(1 − decay)], Threshold = max(0.05, 0.45 × Trough_ss)</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Further Research</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          External references for pharmacokinetics, tolerance biology, taper planning, and withdrawal symptom patterns.
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Evidence tags help distinguish guideline and trial sources from educational or community references.
        </p>
        <div className="space-y-3">
          {RESEARCH_REFERENCE_GROUPS.map((group) => (
            <div key={group.title} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{group.title}</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{group.summary}</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                {group.links.map((link) => (
                  <li key={link.url}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-700 dark:text-indigo-300 hover:underline"
                    >
                      {link.label}
                    </a>
                    {link.evidence && (
                      <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/20">
                        {link.evidence}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Educational information only, not medical advice. Benzodiazepine tapering should be individualized and supervised by a qualified clinician.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Suggested Communities</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Peer-support spaces for clonazepam, benzodiazepine withdrawal, and anxiety disorder discussion.
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Community advice can be useful for lived experience and coping ideas, but it should not replace clinician guidance for dosing, taper changes, or urgent symptoms.
        </p>
        <div className="space-y-3">
          {SUGGESTED_COMMUNITIES.map((community) => (
            <div key={community.url} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <div className="flex flex-wrap items-start gap-2">
                <a
                  href={community.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 hover:underline"
                >
                  {community.label}
                </a>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/20">
                  {community.tag}
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{community.summary}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          If a discussion starts to feel destabilizing or urgent, pause the thread and contact your clinician or local crisis resources instead.
        </p>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Educational tracker only and not medical advice. Benzodiazepines can cause dependence, withdrawal risks, sedation, and serious interactions (especially with opioids, alcohol, or other sedatives). Use only as prescribed and consult your clinician.
      </p>
    </div>
  );
}
