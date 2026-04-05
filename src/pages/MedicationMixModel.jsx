import React, { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
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
  CLONAZEPAM_ONSET_FULL_EFFECT_MINUTES,
  CLONAZEPAM_ONSET_LAG_MINUTES,
  CLONAZEPAM_ONSET_RAMP_MINUTES,
} from "../utils/clonazepamModel";

const ACTIVE_PROFILE_ID_STORAGE_KEY = "caffeineTrackerActiveProfileId";
const PROFILE_STORAGE_KEY = "caffeineTrackerProfilesV1";
const WELLNESS_GLOBAL_USER_NAME_KEY = "wellnessGlobalUserName";
const CLONAZEPAM_BY_USER_STORAGE_KEY = "clonazepamTrackerByUserV1";
const CLONAZEPAM_STORAGE_KEY = "clonazepamTrackerEntries";
const CLONAZEPAM_HALF_LIFE_STORAGE_KEY = "clonazepamTrackerHalfLifeHours";
const CLONAZEPAM_DAYS_AT_DOSE_STORAGE_KEY = "clonazepamTrackerDaysAtCurrentDose";
const CLONAZEPAM_CARRYOVER_CADENCE_STORAGE_KEY = "clonazepamTrackerCarryoverCadence";
const DOXYLAMINE_BY_USER_STORAGE_KEY = "doxylamineTrackerByUserV1";
const VILAZODONE_BY_USER_STORAGE_KEY = "vilazodoneTrackerByUserV1";
const LAMOTRIGINE_BY_USER_STORAGE_KEY = "lamotrigineTrackerByUserV1";
const TRAZODONE_BY_USER_STORAGE_KEY = "trazodoneTrackerByUserV1";
const LEVOTHYROXINE_BY_USER_STORAGE_KEY = "levothyroxineTrackerByUserV1";
const DEFAULT_CLONAZEPAM_HALF_LIFE_HOURS = 30;
const DEFAULT_MAINTENANCE_DOSE_MG = 0.25;

const MIX_RESEARCH_LINKS = [
  {
    label: "Polypharmacy overview and risk concepts (NIGMS)",
    url: "https://nigms.nih.gov/education/fact-sheets/Pages/polypharmacy.aspx",
    evidence: "Reference",
  },
  {
    label: "Benzodiazepines: uses, dangers, and clinical considerations (PubMed Central)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8629021/",
    evidence: "Review",
  },
  {
    label: "Caffeine and sleep disruption timing effects (PubMed)",
    url: "https://pubmed.ncbi.nlm.nih.gov/24235903/",
    evidence: "Clinical study",
  },
  {
    label: "Drug interaction resources and labeling (DailyMed search)",
    url: "https://dailymed.nlm.nih.gov/dailymed/",
    evidence: "Regulatory",
  },
];

const MIX_COMMUNITY_LINKS = [
  {
    label: "ADAA Anxiety and Depression Support Community",
    url: "https://healthunlocked.com/anxiety-depression-support",
    type: "Moderated community",
    summary: "Peer discussion for anxiety/depression trends, sleep, and medication routines.",
  },
  {
    label: "NAMI Connection Recovery Support Group",
    url: "https://www.nami.org/Support-Education/Support-Groups/NAMI-Connection",
    type: "Peer-led group",
    summary: "Structured support groups for mental health conditions and treatment navigation.",
  },
  {
    label: "BenzoBuddies",
    url: "https://benzobuddies.org/",
    type: "Community forum",
    summary: "Peer forum for benzodiazepine use, tapering, and recovery discussions.",
  },
  {
    label: "r/caffeine (Reddit)",
    url: "https://www.reddit.com/r/caffeine/",
    type: "Community forum",
    summary: "Discussion on caffeine timing, tolerance, and interaction experiences.",
  },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

  if (typeof entry?.time === "string") {
    const [h, m] = (entry.time || "00:00").split(":").map(Number);
    const now = new Date(referenceMs);
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, m || 0, 0, 0);
    if (d.getTime() > now.getTime()) d.setDate(d.getDate() - 1);
    return d.getTime();
  }

  return referenceMs;
}

function toLocalDateTimeInputValue(valueMs) {
  const d = new Date(valueMs);
  if (!Number.isFinite(d.getTime())) return "";
  const offsetMs = d.getTimezoneOffset() * 60 * 1000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
}

function localDayKeyFromMs(valueMs) {
  const d = new Date(valueMs);
  if (!Number.isFinite(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function activeBolusMg(entries, halfLifeHours, atMs, nowRef) {
  if (!Array.isArray(entries) || !entries.length || !halfLifeHours) return 0;
  return entries.reduce((sum, entry) => {
    const takenAt = getEntryTakenAtMs(entry, nowRef);
    if (atMs < takenAt) return sum;
    const elapsedHours = (atMs - takenAt) / (1000 * 60 * 60);
    const remainingFraction = Math.pow(0.5, elapsedHours / halfLifeHours);
    return sum + (Number(entry.doseMg) || 0) * remainingFraction;
  }, 0);
}

function activeClonazepamEntriesMg(entries, halfLifeHours, atMs, nowRef) {
  if (!Array.isArray(entries) || !entries.length || !halfLifeHours) return 0;
  return entries.reduce((sum, entry) => {
    return sum + activeClonazepamAmountAtTime({
      doseMg: entry?.doseMg,
      takenAtMs: getEntryTakenAtMs(entry, nowRef),
      atMs,
      halfLifeHours,
    });
  }, 0);
}

function activeCaffeineFromEntry(entry, atMs, referenceMs, halfLifeHours) {
  return activeCaffeineAmountAtTime({
    caffeineMg: entry?.caffeineMg,
    startMs: getEntryTakenAtMs(entry, referenceMs),
    durationMinutes: entry?.durationMinutes,
    atMs,
    halfLifeHours,
  });
}

function loadByUserState(storageKey, activeProfileId, fallbackHalfLife) {
  try {
    const byUser = JSON.parse(localStorage.getItem(storageKey) || "{}");
    const state = byUser?.[activeProfileId] || {};
    const entries = Array.isArray(state.entries) ? state.entries : [];
    const parsedHalfLife = Number(state.halfLifeHours);
    const halfLifeHours = Number.isFinite(parsedHalfLife) && parsedHalfLife > 0 ? parsedHalfLife : fallbackHalfLife;
    const parsedDaysAtCurrentDose = Number(state.daysAtCurrentDose);
    const daysAtCurrentDose = Number.isFinite(parsedDaysAtCurrentDose) && parsedDaysAtCurrentDose >= 0 ? parsedDaysAtCurrentDose : 0;
    const carryoverCadence = state?.carryoverCadence === "twice" ? "twice" : "once";
    return { entries, halfLifeHours, daysAtCurrentDose, carryoverCadence };
  } catch {
    return { entries: [], halfLifeHours: fallbackHalfLife, daysAtCurrentDose: 0, carryoverCadence: "once" };
  }
}

function sanitizeClonazepamState(raw) {
  const entries = Array.isArray(raw?.entries) ? raw.entries : [];
  const parsedHalfLife = Number(raw?.halfLifeHours);
  const halfLifeHours = Number.isFinite(parsedHalfLife) && parsedHalfLife > 0
    ? parsedHalfLife
    : DEFAULT_CLONAZEPAM_HALF_LIFE_HOURS;
  const parsedDaysAtCurrentDose = Number(raw?.daysAtCurrentDose);
  const daysAtCurrentDose = Number.isFinite(parsedDaysAtCurrentDose) && parsedDaysAtCurrentDose >= 0
    ? parsedDaysAtCurrentDose
    : 0;
  const carryoverCadence = raw?.carryoverCadence === "twice" ? "twice" : "once";
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

  return {
    entries,
    halfLifeHours,
    daysAtCurrentDose,
    carryoverCadence,
    maintenanceDoseMg,
    lastMaintenanceDoseAt: toLocalDateTimeInputValue(safeLastMaintenanceDoseAtMs),
  };
}

function loadClonazepamState(activeProfileId) {
  try {
    const byUser = JSON.parse(localStorage.getItem(CLONAZEPAM_BY_USER_STORAGE_KEY) || "{}");
    if (activeProfileId && byUser?.[activeProfileId]) {
      return sanitizeClonazepamState(byUser[activeProfileId]);
    }
  } catch {
    // Fall back to legacy storage below.
  }

  let legacyEntries = [];
  try {
    legacyEntries = JSON.parse(localStorage.getItem(CLONAZEPAM_STORAGE_KEY) || "[]");
  } catch {
    legacyEntries = [];
  }

  return sanitizeClonazepamState({
    entries: legacyEntries,
    halfLifeHours: Number(localStorage.getItem(CLONAZEPAM_HALF_LIFE_STORAGE_KEY)),
    daysAtCurrentDose: Number(localStorage.getItem(CLONAZEPAM_DAYS_AT_DOSE_STORAGE_KEY)),
    carryoverCadence: localStorage.getItem(CLONAZEPAM_CARRYOVER_CADENCE_STORAGE_KEY) || "once",
  });
}

function buildModeledEntries(entries, daysAtCurrentDose, referenceMs, cadence = "once") {
  const priorDays = Math.max(0, Math.round(Number(daysAtCurrentDose) || 0));
  if (!Array.isArray(entries) || !entries.length || priorDays <= 0) return Array.isArray(entries) ? entries : [];

  const sorted = [...entries].sort((a, b) => getEntryTakenAtMs(b, referenceMs) - getEntryTakenAtMs(a, referenceMs));
  const latest = sorted[0];
  const carryoverDoseMg = Number(latest?.doseMg) || 0;
  if (carryoverDoseMg <= 0) return entries;

  const carryoverTakenAtMs = getEntryTakenAtMs(latest, referenceMs);
  const dayMs = 24 * 60 * 60 * 1000;
  const halfDayMs = 12 * 60 * 60 * 1000;
  const earliestRealTakenAt = Math.min(...entries.map((entry) => getEntryTakenAtMs(entry, referenceMs)));

  const synthetic = [];
  for (let day = 1; day <= priorDays; day += 1) {
    const primaryTakenAtMs = carryoverTakenAtMs - day * dayMs;
    if (primaryTakenAtMs < earliestRealTakenAt - 60 * 1000) {
      synthetic.push({
        id: `mix-carryover-${day}-a`,
        doseMg: carryoverDoseMg,
        takenAtMs: primaryTakenAtMs,
        takenAtIso: new Date(primaryTakenAtMs).toISOString(),
        synthetic: true,
      });
    }

    if (cadence === "twice") {
      const secondTakenAtMs = primaryTakenAtMs - halfDayMs;
      if (secondTakenAtMs < earliestRealTakenAt - 60 * 1000) {
        synthetic.push({
          id: `mix-carryover-${day}-b`,
          doseMg: carryoverDoseMg,
          takenAtMs: secondTakenAtMs,
          takenAtIso: new Date(secondTakenAtMs).toISOString(),
          synthetic: true,
        });
      }
    }
  }

  return [...entries, ...synthetic];
}

function buildClonazepamModeledEntries(state, referenceMs) {
  const entries = Array.isArray(state?.entries) ? state.entries : [];
  const priorDays = Math.max(0, Math.round(Number(state?.daysAtCurrentDose) || 0));
  const parsedLastMaintenanceDoseAt = new Date(state?.lastMaintenanceDoseAt || "").getTime();
  const carryoverDoseMg = Math.max(0, Number(state?.maintenanceDoseMg) || 0);

  if (priorDays <= 0 || carryoverDoseMg <= 0 || !Number.isFinite(parsedLastMaintenanceDoseAt) || parsedLastMaintenanceDoseAt <= 0) {
    return entries;
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const halfDayMs = 12 * 60 * 60 * 1000;
  const cadence = state?.carryoverCadence === "twice" ? "twice" : "once";
  const realDoseDayKeys = new Set(
    entries
      .map((entry) => localDayKeyFromMs(getEntryTakenAtMs(entry, referenceMs)))
      .filter(Boolean)
  );
  const synthetic = [];

  for (let day = 1; day <= priorDays; day += 1) {
    const primaryTakenAtMs = parsedLastMaintenanceDoseAt - day * dayMs;
    const primaryDayKey = localDayKeyFromMs(primaryTakenAtMs);
    if (primaryDayKey && !realDoseDayKeys.has(primaryDayKey)) {
      synthetic.push({
        id: `mix-carryover-${day}-a`,
        doseMg: carryoverDoseMg,
        takenAtMs: primaryTakenAtMs,
        takenAtIso: new Date(primaryTakenAtMs).toISOString(),
        synthetic: true,
      });
    }

    if (cadence === "twice") {
      const secondTakenAtMs = primaryTakenAtMs - halfDayMs;
      const secondDayKey = localDayKeyFromMs(secondTakenAtMs);
      if (secondDayKey && !realDoseDayKeys.has(secondDayKey)) {
        synthetic.push({
          id: `mix-carryover-${day}-b`,
          doseMg: carryoverDoseMg,
          takenAtMs: secondTakenAtMs,
          takenAtIso: new Date(secondTakenAtMs).toISOString(),
          synthetic: true,
        });
      }
    }
  }

  return [...entries, ...synthetic];
}

function loadProfilesFromStorage() {
  try {
    const profiles = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "[]");
    if (Array.isArray(profiles) && profiles.length > 0) return profiles;
    return [{ id: "default", name: "Default" }];
  } catch {
    return [{ id: "default", name: "Default" }];
  }
}

function pressureHill(activeValue, ec50) {
  if (activeValue <= 0) return 0;
  return (activeValue / (activeValue + ec50)) * 100;
}

function weightedBlissPercent(values) {
  const normalized = values
    .map((value) => clamp(Number(value) || 0, 0, 100) / 100)
    .filter((value) => value > 0);

  if (!normalized.length) return 0;
  return (1 - normalized.reduce((product, value) => product * (1 - value), 1)) * 100;
}

function toleranceFactorFromDays(daysAtDose, maxReduction, tauDays) {
  const days = Math.max(0, Number(daysAtDose) || 0);
  return 1 - maxReduction * (1 - Math.exp(-days / tauDays));
}

function toleranceReductionPercent(factor) {
  return Math.max(0, (1 - factor) * 100);
}

function riskBand(value) {
  if (value >= 75) return "Very High";
  if (value >= 50) return "High";
  if (value >= 25) return "Moderate";
  return "Low";
}

function riskInterpretation(value) {
  const band = riskBand(value);
  if (band === "Very High") return "Interpretation: high caution now; avoid safety-critical tasks.";
  if (band === "High") return "Interpretation: elevated modeled risk; use extra caution.";
  if (band === "Moderate") return "Interpretation: meaningful modeled risk; monitor trends.";
  return "Interpretation: lower modeled risk right now.";
}

function formatTopContributors(items) {
  if (!Array.isArray(items) || !items.length) return "None";
  return items.map((item) => `${item.label} (${item.share.toFixed(0)}%)`).join(", ");
}

function formatEtaToLowRisk(targetTs, nowTs) {
  if (!Number.isFinite(targetTs) || !Number.isFinite(nowTs)) return "Not within forecast";
  const diffMinutes = Math.max(0, Math.round((targetTs - nowTs) / (1000 * 60)));
  if (diffMinutes <= 0) return "Already Low";

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  const duration = [
    hours > 0 ? `${hours}h` : null,
    minutes > 0 ? `${minutes}m` : null,
  ].filter(Boolean).join(" ") || "<1m";

  return `${duration} (${new Date(targetTs).toLocaleString([], {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })})`;
}

function topContributors(contributors, count = 2) {
  const positive = contributors.filter((item) => Number(item.value) > 0);
  const total = positive.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return [];

  return positive
    .sort((a, b) => b.value - a.value)
    .slice(0, count)
    .map((item) => ({
      ...item,
      share: (item.value / total) * 100,
    }));
}

function formatPercentByConfidence(value, confidence) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "N/A";

  const bounded = clamp(numeric, 0, 100);
  if (confidence === "Very Low") {
    const low = Math.max(0, Math.round(bounded - 8));
    const high = Math.min(100, Math.round(bounded + 8));
    return `${low}-${high}%`;
  }
  if (confidence === "Low") {
    const low = Math.max(0, Math.round(bounded - 5));
    const high = Math.min(100, Math.round(bounded + 5));
    return `${low}-${high}%`;
  }
  return `${bounded.toFixed(1)}%`;
}

function confidenceExplanation(confidence, activeDrugCount, hoursSinceLatestLog) {
  const freshness = Number.isFinite(hoursSinceLatestLog)
    ? hoursSinceLatestLog <= 6
      ? "recent logs"
      : hoursSinceLatestLog <= 24
        ? "same-day logs"
        : "stale logs"
    : "limited logs";

  if (confidence === "Very Low") {
    return `Very low confidence due to sparse tracker coverage (${activeDrugCount} active sources) and ${freshness}.`;
  }
  if (confidence === "Low") {
    return `Low confidence with partial tracker coverage (${activeDrugCount} active sources) and ${freshness}.`;
  }
  return `Moderate confidence with broader tracker coverage (${activeDrugCount} active sources) and ${freshness}.`;
}

function actionSummaryLine({ impairment, wakefulness, confidence, dominant }) {
  const imp = Number(impairment) || 0;
  const wake = Number(wakefulness) || 0;
  const contributor = dominant || "current sedative load";

  if (imp >= 50) {
    return `High modeled impairment now. Avoid driving and delay safety-critical tasks. Top driver: ${contributor}.`;
  }
  if (imp >= 25) {
    return `Moderate modeled impairment now. Use caution with coordination-heavy tasks. Top driver: ${contributor}.`;
  }
  if (wake < 55) {
    return `Lower wakefulness despite lower impairment band. Consider rest before demanding tasks. Top driver: ${contributor}.`;
  }
  if (confidence === "Very Low") {
    return `Current model reads lower risk, but confidence is very low. Update trackers before relying on this estimate.`;
  }
  return `Lower modeled risk right now. Continue monitoring trend changes and contributor shifts.`;
}

function computeCyp3a4AdjustedActives({
  clonazEntries,
  clonazHalfLife,
  trazodoneEntries,
  trazodoneHalfLife,
  vilazodoneEntries,
  vilazodoneHalfLife,
  atMs,
  referenceMs,
}) {
  const calculateCongestion = (clonazActive, trazodoneActive, vilazodoneActive) => {
    return weightedBlissPercent([
      pressureHill(clonazActive, 0.5) * 0.38,
      pressureHill(trazodoneActive, 25) * 0.32,
      pressureHill(vilazodoneActive, 40) * 0.3,
    ]);
  };

  let clonazActive = activeClonazepamEntriesMg(clonazEntries, clonazHalfLife, atMs, referenceMs);
  let trazodoneActive = activeBolusMg(trazodoneEntries, trazodoneHalfLife, atMs, referenceMs);
  let vilazodoneActive = activeBolusMg(vilazodoneEntries, vilazodoneHalfLife, atMs, referenceMs);
  let congestion = calculateCongestion(clonazActive, trazodoneActive, vilazodoneActive);
  let halfLifeMultiplier = 1;

  for (let i = 0; i < 2; i += 1) {
    halfLifeMultiplier = 1 + (congestion / 100) * 0.2;
    clonazActive = activeClonazepamEntriesMg(clonazEntries, clonazHalfLife * halfLifeMultiplier, atMs, referenceMs);
    trazodoneActive = activeBolusMg(trazodoneEntries, trazodoneHalfLife * halfLifeMultiplier, atMs, referenceMs);
    vilazodoneActive = activeBolusMg(vilazodoneEntries, vilazodoneHalfLife * halfLifeMultiplier, atMs, referenceMs);
    congestion = calculateCongestion(clonazActive, trazodoneActive, vilazodoneActive);
  }

  return {
    clonazActive,
    trazodoneActive,
    vilazodoneActive,
    cyp3a4Congestion: congestion,
    halfLifeMultiplier,
  };
}

function circadianPenalty(atMs, strengthPercent = 30, shiftHours = 0) {
  const d = new Date(atMs);
  const hour = d.getHours() + d.getMinutes() / 60;
  const radians = ((hour - (3 + shiftHours)) / 24) * 2 * Math.PI;
  const overnightDrive = (Math.cos(radians) + 1) / 2;
  return overnightDrive * strengthPercent;
}

export default function MedicationMixModel() {
  const [profiles, setProfiles] = useState(() => loadProfilesFromStorage());
  const [activeProfileId, setActiveProfileId] = useState(() => {
    const loaded = loadProfilesFromStorage();

    const globalUserName = localStorage.getItem(WELLNESS_GLOBAL_USER_NAME_KEY);
    if (globalUserName) {
      const globalProfile = loaded.find((profile) => profile.name === globalUserName);
      if (globalProfile) return globalProfile.id;
    }

    const saved = localStorage.getItem(ACTIVE_PROFILE_ID_STORAGE_KEY);
    if (saved && loaded.some((profile) => profile.id === saved)) return saved;
    return loaded[0]?.id || "default";
  });
  const [recalcAt, setRecalcAt] = useState(() => Date.now());
  const [showAdvancedMath, setShowAdvancedMath] = useState(false);
  const [cnsExplanation, setCnsExplanation] = useState("");
  const [cnsExplanationBusy, setCnsExplanationBusy] = useState(false);
  const [cnsExplanationError, setCnsExplanationError] = useState("");
  const [cnsFollowup, setCnsFollowup] = useState("");

  useEffect(() => {
    const globalUserName = localStorage.getItem(WELLNESS_GLOBAL_USER_NAME_KEY);
    if (!globalUserName) return;

    setProfiles((prevProfiles) => {
      const existingProfile = prevProfiles.find((profile) => profile.name === globalUserName);
      if (existingProfile) {
        setActiveProfileId(existingProfile.id);
        localStorage.setItem(ACTIVE_PROFILE_ID_STORAGE_KEY, existingProfile.id);
        return prevProfiles;
      }

      const newProfile = {
        id: `mix-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: globalUserName,
      };
      const nextProfiles = [...prevProfiles, newProfile];
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(nextProfiles));
      localStorage.setItem(ACTIVE_PROFILE_ID_STORAGE_KEY, newProfile.id);
      setActiveProfileId(newProfile.id);
      return nextProfiles;
    });
  }, []);

  const modelData = useMemo(() => {
    const activeProfile = profiles.find((profile) => profile.id === activeProfileId) || null;

    const clonaz = loadClonazepamState(activeProfileId);
    const doxylamine = loadByUserState(DOXYLAMINE_BY_USER_STORAGE_KEY, activeProfileId, 10);
    const vilazodone = loadByUserState(VILAZODONE_BY_USER_STORAGE_KEY, activeProfileId, 25);
    const lamotrigine = loadByUserState(LAMOTRIGINE_BY_USER_STORAGE_KEY, activeProfileId, 29);
    const trazodone = loadByUserState(TRAZODONE_BY_USER_STORAGE_KEY, activeProfileId, 7);
    const levothyroxine = loadByUserState(LEVOTHYROXINE_BY_USER_STORAGE_KEY, activeProfileId, 168);
    const now = recalcAt;

    const clonazModeledEntries = buildClonazepamModeledEntries(clonaz, now);
    const doxylamineModeledEntries = buildModeledEntries(doxylamine.entries, doxylamine.daysAtCurrentDose, now, "once");
    const vilazodoneModeledEntries = buildModeledEntries(vilazodone.entries, vilazodone.daysAtCurrentDose, now, "once");
    const lamotrigineModeledEntries = buildModeledEntries(lamotrigine.entries, lamotrigine.daysAtCurrentDose, now, "once");
    const trazodoneModeledEntries = buildModeledEntries(trazodone.entries, trazodone.daysAtCurrentDose, now, "once");
    const levothyroxineModeledEntries = buildModeledEntries(levothyroxine.entries, levothyroxine.daysAtCurrentDose, now, "once");

    const caffeineEntries = Array.isArray(activeProfile?.entries) ? activeProfile.entries : [];
    const caffeineHalfLife = Number(activeProfile?.halfLifeHours) > 0 ? Number(activeProfile.halfLifeHours) : 5;
    const caffeineDaysAtDose = Math.max(0, Number(activeProfile?.daysAtDose) || 0);
    const weightKg = (() => {
      const w = Number(activeProfile?.weight);
      const unit = activeProfile?.weightUnit || "lb";
      if (!w || w <= 0) return 70;
      return unit === "lb" ? w * 0.45359237 : w;
    })();
    const candidateTimes = [
      ...clonazModeledEntries.map((e) => getEntryTakenAtMs(e, now)),
      ...doxylamineModeledEntries.map((e) => getEntryTakenAtMs(e, now)),
      ...vilazodoneModeledEntries.map((e) => getEntryTakenAtMs(e, now)),
      ...lamotrigineModeledEntries.map((e) => getEntryTakenAtMs(e, now)),
      ...trazodoneModeledEntries.map((e) => getEntryTakenAtMs(e, now)),
      ...levothyroxineModeledEntries.map((e) => getEntryTakenAtMs(e, now)),
      ...caffeineEntries.map((e) => getEntryTakenAtMs(e, now)),
    ].filter((v) => Number.isFinite(v));

    const earliest = candidateTimes.length ? Math.min(...candidateTimes) : now - 24 * 60 * 60 * 1000;
    const start = Math.max(earliest - 4 * 60 * 60 * 1000, now - 36 * 60 * 60 * 1000);
    const end = now + 72 * 60 * 60 * 1000;
    const stepMs = 60 * 60 * 1000;

    const points = [];

    const clonazToleranceFactor = toleranceFactorFromDays(clonaz.daysAtCurrentDose, 0.35, 10);
    const caffeineToleranceFactor = toleranceFactorFromDays(caffeineDaysAtDose, 0.4, 14);

    for (let t = start; t <= end; t += stepMs) {
      const cypAdjusted = computeCyp3a4AdjustedActives({
        clonazEntries: clonazModeledEntries,
        clonazHalfLife: clonaz.halfLifeHours,
        trazodoneEntries: trazodoneModeledEntries,
        trazodoneHalfLife: trazodone.halfLifeHours,
        vilazodoneEntries: vilazodoneModeledEntries,
        vilazodoneHalfLife: vilazodone.halfLifeHours,
        atMs: t,
        referenceMs: now,
      });

      const clonazActive = cypAdjusted.clonazActive;
      const doxActive = activeBolusMg(doxylamineModeledEntries, doxylamine.halfLifeHours, t, now);
      const vilaActive = cypAdjusted.vilazodoneActive;
      const lamoActive = activeBolusMg(lamotrigineModeledEntries, lamotrigine.halfLifeHours, t, now);
      const trazoActive = cypAdjusted.trazodoneActive;
      const levothyroxineActiveMcg = activeBolusMg(levothyroxineModeledEntries, levothyroxine.halfLifeHours, t, now);

      const clonazPressure = pressureHill(clonazActive, 0.5);
      const doxPressure = pressureHill(doxActive, 6);
      const vilaPressureRaw = pressureHill(vilaActive, 40);
      const lamoPressureRaw = pressureHill(lamoActive, 60);
      const trazoPressureRaw = pressureHill(trazoActive, 25);
      const levothyroxineActivationRaw = pressureHill(levothyroxineActiveMcg, 150) * 0.12;

      const doxToleranceFactor = toleranceFactorFromDays(doxylamine.daysAtCurrentDose, 0.25, 8);
      const vilaToleranceFactor = toleranceFactorFromDays(vilazodone.daysAtCurrentDose, 0.15, 18);
      const lamoToleranceFactor = toleranceFactorFromDays(lamotrigine.daysAtCurrentDose, 0.08, 24);
      const trazoToleranceFactor = toleranceFactorFromDays(trazodone.daysAtCurrentDose, 0.28, 10);
      const levothyroxineToleranceFactor = toleranceFactorFromDays(levothyroxine.daysAtCurrentDose, 0.12, 30);

      const clonazPressureAdjusted = clonazPressure * clonazToleranceFactor;
      const doxPressureAdjusted = doxPressure * doxToleranceFactor;
      const vilaPressure = vilaPressureRaw * vilaToleranceFactor * 0.25;
      const lamoPressure = lamoPressureRaw * lamoToleranceFactor * 0.15;
      const trazoPressure = trazoPressureRaw * trazoToleranceFactor * 0.2;
      const levothyroxineActivation = levothyroxineActivationRaw * levothyroxineToleranceFactor;

      const cyp3a4Congestion = cypAdjusted.cyp3a4Congestion;
      const serotoninRisk = weightedBlissPercent([vilaPressureRaw * 0.55, trazoPressureRaw * 0.7]);

      const sedativePressure = weightedBlissPercent([
        0.42 * clonazPressureAdjusted,
        0.24 * doxPressureAdjusted,
        0.1 * vilaPressure,
        0.08 * lamoPressure,
        0.16 * trazoPressure,
      ]);

      const caffeineActiveMg = caffeineEntries.reduce((sum, entry) => {
        return sum + activeCaffeineFromEntry(entry, t, now, caffeineHalfLife);
      }, 0);
      const caffeineMgPerKg = weightKg > 0 ? caffeineActiveMg / weightKg : 0;
      const stimulantCounterPressure = pressureHill(caffeineMgPerKg * caffeineToleranceFactor, 2.0);

      const wakefulnessDrive = clamp(100 - circadianPenalty(t, 30, 0) - sedativePressure * 0.25 + stimulantCounterPressure * 0.45 + levothyroxineActivation * 0.4, 0, 100);
      const psychomotorImpairment = clamp(
        sedativePressure * 0.88 + serotoninRisk * 0.18 - stimulantCounterPressure * 0.12,
        0,
        100,
      );
      const functionalAlertness = clamp(wakefulnessDrive - psychomotorImpairment * 0.72, 0, 100);
      const netCnsLoad = clamp(sedativePressure + psychomotorImpairment * 0.35 - stimulantCounterPressure * 0.18 - levothyroxineActivation * 0.1, -100, 100);

      points.push({
        ts: t,
        sedativePressure: Number(sedativePressure.toFixed(1)),
          stimulantCounterPressure: Number(stimulantCounterPressure.toFixed(1)),
        wakefulnessDrive: Number(wakefulnessDrive.toFixed(1)),
        psychomotorImpairment: Number(psychomotorImpairment.toFixed(1)),
        cyp3a4Congestion: Number(cyp3a4Congestion.toFixed(1)),
        serotoninRisk: Number(serotoninRisk.toFixed(1)),
        cypHalfLifeMultiplier: Number(cypAdjusted.halfLifeMultiplier.toFixed(3)),
        clonazToleranceReduction: Number(toleranceReductionPercent(clonazToleranceFactor).toFixed(1)),
        doxToleranceReduction: Number(toleranceReductionPercent(doxToleranceFactor).toFixed(1)),
        vilaToleranceReduction: Number(toleranceReductionPercent(vilaToleranceFactor).toFixed(1)),
        lamoToleranceReduction: Number(toleranceReductionPercent(lamoToleranceFactor).toFixed(1)),
        trazoToleranceReduction: Number(toleranceReductionPercent(trazoToleranceFactor).toFixed(1)),
        levothyroxineReduction: Number(toleranceReductionPercent(levothyroxineToleranceFactor).toFixed(1)),
        caffeineToleranceReduction: Number(toleranceReductionPercent(caffeineToleranceFactor).toFixed(1)),
        netCnsLoad: Number(netCnsLoad.toFixed(1)),
        alertness: Number(functionalAlertness.toFixed(1)),
      });
    }

    const nowPoint = points.reduce((best, point) => {
      if (!best) return point;
      return Math.abs(point.ts - now) < Math.abs(best.ts - now) ? point : best;
    }, null);

    const awakeButImpairedLowPoint = nowPoint?.psychomotorImpairment < 25
      ? nowPoint
      : points.find((point) => point.ts >= now && point.psychomotorImpairment < 25) || null;

    const currentCypAdjusted = computeCyp3a4AdjustedActives({
      clonazEntries: clonazModeledEntries,
      clonazHalfLife: clonaz.halfLifeHours,
      trazodoneEntries: trazodoneModeledEntries,
      trazodoneHalfLife: trazodone.halfLifeHours,
      vilazodoneEntries: vilazodoneModeledEntries,
      vilazodoneHalfLife: vilazodone.halfLifeHours,
      atMs: now,
      referenceMs: now,
    });

    const clonazNowMg = currentCypAdjusted.clonazActive;
    const clonazNowMgTracked = activeClonazepamEntriesMg(clonazModeledEntries, clonaz.halfLifeHours, now, now);
    const doxylamineNowMg = activeBolusMg(doxylamineModeledEntries, doxylamine.halfLifeHours, now, now);
    const vilazodoneNowMg = currentCypAdjusted.vilazodoneActive;
    const vilazodoneNowMgTracked = activeBolusMg(vilazodoneModeledEntries, vilazodone.halfLifeHours, now, now);
    const lamotrigineNowMg = activeBolusMg(lamotrigineModeledEntries, lamotrigine.halfLifeHours, now, now);
    const trazodoneNowMg = currentCypAdjusted.trazodoneActive;
    const trazodoneNowMgTracked = activeBolusMg(trazodoneModeledEntries, trazodone.halfLifeHours, now, now);
    const levothyroxineNowMcg = activeBolusMg(levothyroxineModeledEntries, levothyroxine.halfLifeHours, now, now);
    const caffeineNowMg = caffeineEntries.reduce((sum, entry) => {
      return sum + activeCaffeineFromEntry(entry, now, now, caffeineHalfLife);
    }, 0);
    const caffeineNowMgPerKg = weightKg > 0 ? caffeineNowMg / weightKg : 0;

    const activeDrugCount = [
      clonaz.entries,
      doxylamine.entries,
      vilazodone.entries,
      lamotrigine.entries,
      trazodone.entries,
      levothyroxine.entries,
      caffeineEntries,
    ].filter((arr) => Array.isArray(arr) && arr.length > 0).length;

    const allEntries = [
      ...clonaz.entries,
      ...doxylamine.entries,
      ...vilazodone.entries,
      ...lamotrigine.entries,
      ...trazodone.entries,
      ...levothyroxine.entries,
      ...caffeineEntries,
    ];
    const latestEntryMs = allEntries.reduce((latest, entry) => {
      const ms = getEntryTakenAtMs(entry, now);
      return Number.isFinite(ms) && ms > latest ? ms : latest;
    }, 0);
    const hoursSinceLatestLog = latestEntryMs > 0
      ? Number(((now - latestEntryMs) / (1000 * 60 * 60)).toFixed(1))
      : null;

    const confidence = activeDrugCount >= 5 ? "Medium" : activeDrugCount >= 3 ? "Low" : "Very Low";
    const currentCyp3a4Congestion = currentCypAdjusted.cyp3a4Congestion;
    const currentCypContributorsRaw = [
      { label: "Clonazepam", value: pressureHill(clonazNowMg, 0.5) * 0.38 },
      { label: "Trazodone", value: pressureHill(trazodoneNowMg, 25) * 0.32 },
      { label: "Vilazodone", value: pressureHill(vilazodoneNowMg, 40) * 0.3 },
    ];
    const currentSerotoninRisk = weightedBlissPercent([
      pressureHill(vilazodoneNowMg, 40) * 0.55,
      pressureHill(trazodoneNowMg, 25) * 0.7,
    ]);
    const currentSerotoninContributorsRaw = [
      { label: "Vilazodone", value: pressureHill(vilazodoneNowMg, 40) * 0.55 },
      { label: "Trazodone", value: pressureHill(trazodoneNowMg, 25) * 0.7 },
    ];
    const currentDoxToleranceFactor = toleranceFactorFromDays(doxylamine.daysAtCurrentDose, 0.25, 8);
    const currentVilaToleranceFactor = toleranceFactorFromDays(vilazodone.daysAtCurrentDose, 0.15, 18);
    const currentLamoToleranceFactor = toleranceFactorFromDays(lamotrigine.daysAtCurrentDose, 0.08, 24);
    const currentTrazoToleranceFactor = toleranceFactorFromDays(trazodone.daysAtCurrentDose, 0.28, 10);
    const currentLevothyroxineToleranceFactor = toleranceFactorFromDays(levothyroxine.daysAtCurrentDose, 0.12, 30);

    const currentClonazPressure = pressureHill(clonazNowMg, 0.5);
    const currentDoxPressure = pressureHill(doxylamineNowMg, 6);
    const currentVilaPressureRaw = pressureHill(vilazodoneNowMg, 40);
    const currentLamoPressureRaw = pressureHill(lamotrigineNowMg, 60);
    const currentTrazoPressureRaw = pressureHill(trazodoneNowMg, 25);
    const currentLevothyroxinePressureRaw = pressureHill(levothyroxineNowMcg, 150);
    const currentClonazAdjusted = currentClonazPressure * clonazToleranceFactor;
    const currentDoxAdjusted = currentDoxPressure * currentDoxToleranceFactor;
    const currentVilaAdjusted = currentVilaPressureRaw * currentVilaToleranceFactor * 0.25;
    const currentLamoAdjusted = currentLamoPressureRaw * currentLamoToleranceFactor * 0.15;
    const currentTrazoAdjusted = currentTrazoPressureRaw * currentTrazoToleranceFactor * 0.2;
    const currentLevothyroxineActivation = currentLevothyroxinePressureRaw * 0.12 * currentLevothyroxineToleranceFactor;
    const currentStimulantCounterPressure = pressureHill(caffeineNowMgPerKg * caffeineToleranceFactor, 2.0);
    const currentSedativeComponents = [
      { label: "Clonazepam", value: currentClonazAdjusted * 0.42 },
      { label: "Doxylamine", value: currentDoxAdjusted * 0.24 },
      { label: "Vilazodone", value: currentVilaAdjusted * 0.1 },
      { label: "Lamotrigine", value: currentLamoAdjusted * 0.08 },
      { label: "Trazodone", value: currentTrazoAdjusted * 0.16 },
    ];
    const currentSedativePressure = weightedBlissPercent(currentSedativeComponents.map((item) => item.value));
    const currentCircadianPenalty = circadianPenalty(now, 30, 0);
    const currentWakefulnessDrive = clamp(
      100 - currentCircadianPenalty - currentSedativePressure * 0.25 + currentStimulantCounterPressure * 0.45 + currentLevothyroxineActivation * 0.4,
      0,
      100,
    );
    const currentPsychomotorImpairment = clamp(
      currentSedativePressure * 0.88 + currentSerotoninRisk * 0.18 - currentStimulantCounterPressure * 0.12,
      0,
      100,
    );
    const currentFunctionalAlertness = clamp(currentWakefulnessDrive - currentPsychomotorImpairment * 0.72, 0, 100);

    const awakeContributorsRaw = [
      { label: "Clonazepam", value: currentClonazAdjusted * 0.42 * 0.88 },
      { label: "Doxylamine", value: currentDoxAdjusted * 0.24 * 0.88 },
      { label: "Trazodone", value: currentTrazoAdjusted * 0.16 * 0.88 },
      { label: "Vilazodone", value: currentVilaAdjusted * 0.1 * 0.88 },
      { label: "Lamotrigine", value: currentLamoAdjusted * 0.08 * 0.88 },
      { label: "5-HT overlap", value: currentSerotoninRisk * 0.18 },
    ];

    const dominantAwake = topContributors(awakeContributorsRaw, 1)[0]?.label || "None";
    const summaryText = actionSummaryLine({
      impairment: currentPsychomotorImpairment,
      wakefulness: currentWakefulnessDrive,
      confidence,
      dominant: dominantAwake,
    });
    const confidenceText = confidenceExplanation(confidence, activeDrugCount, hoursSinceLatestLog);

    return {
      points,
      nowPoint,
      activeProfileName: activeProfile?.name || "Default",
      nowAmounts: {
        clonazepamMg: Number(clonazNowMgTracked.toFixed(3)),
        clonazepamCypAdjustedMg: Number(clonazNowMg.toFixed(3)),
        doxylamineMg: Number(doxylamineNowMg.toFixed(3)),
        vilazodoneMg: Number(vilazodoneNowMgTracked.toFixed(3)),
        vilazodoneCypAdjustedMg: Number(vilazodoneNowMg.toFixed(3)),
        lamotrigineMg: Number(lamotrigineNowMg.toFixed(3)),
        trazodoneMg: Number(trazodoneNowMgTracked.toFixed(3)),
        trazodoneCypAdjustedMg: Number(trazodoneNowMg.toFixed(3)),
        levothyroxineMcg: Number(levothyroxineNowMcg.toFixed(3)),
        caffeineMg: Number(caffeineNowMg.toFixed(1)),
        caffeineMgPerKg: Number(caffeineNowMgPerKg.toFixed(3)),
      },
      liveMath: {
        activeNow: {
          clonazepamMg: Number(clonazNowMg.toFixed(3)),
          doxylamineMg: Number(doxylamineNowMg.toFixed(3)),
          vilazodoneMg: Number(vilazodoneNowMg.toFixed(3)),
          lamotrigineMg: Number(lamotrigineNowMg.toFixed(3)),
          trazodoneMg: Number(trazodoneNowMg.toFixed(3)),
          levothyroxineMcg: Number(levothyroxineNowMcg.toFixed(3)),
          caffeineMg: Number(caffeineNowMg.toFixed(1)),
          caffeineMgPerKg: Number(caffeineNowMgPerKg.toFixed(3)),
        },
        toleranceFactors: {
          clonazepam: Number(clonazToleranceFactor.toFixed(3)),
          doxylamine: Number(currentDoxToleranceFactor.toFixed(3)),
          vilazodone: Number(currentVilaToleranceFactor.toFixed(3)),
          lamotrigine: Number(currentLamoToleranceFactor.toFixed(3)),
          trazodone: Number(currentTrazoToleranceFactor.toFixed(3)),
          levothyroxine: Number(currentLevothyroxineToleranceFactor.toFixed(3)),
          caffeine: Number(caffeineToleranceFactor.toFixed(3)),
        },
        pressures: {
          clonazepam: Number(currentClonazPressure.toFixed(1)),
          doxylamine: Number(currentDoxPressure.toFixed(1)),
          vilazodoneRaw: Number(currentVilaPressureRaw.toFixed(1)),
          lamotrigineRaw: Number(currentLamoPressureRaw.toFixed(1)),
          trazodoneRaw: Number(currentTrazoPressureRaw.toFixed(1)),
          levothyroxineRaw: Number(currentLevothyroxinePressureRaw.toFixed(1)),
          stimulantCounter: Number(currentStimulantCounterPressure.toFixed(1)),
        },
        weightedComponents: {
          sedative: currentSedativeComponents.map((item) => ({ label: item.label, value: Number(item.value.toFixed(1)) })),
          cyp: currentCypContributorsRaw.map((item) => ({ label: item.label, value: Number(item.value.toFixed(1)) })),
          serotonin: currentSerotoninContributorsRaw.map((item) => ({ label: item.label, value: Number(item.value.toFixed(1)) })),
        },
        levothyroxineActivation: Number(currentLevothyroxineActivation.toFixed(1)),
        circadianPenalty: Number(currentCircadianPenalty.toFixed(1)),
        currentSedativePressure: Number(currentSedativePressure.toFixed(1)),
        currentWakefulnessDrive: Number(currentWakefulnessDrive.toFixed(1)),
        currentPsychomotorImpairment: Number(currentPsychomotorImpairment.toFixed(1)),
        currentFunctionalAlertness: Number(currentFunctionalAlertness.toFixed(1)),
      },
      currentCyp3a4Congestion: Number(currentCyp3a4Congestion.toFixed(1)),
      currentSerotoninRisk: Number(currentSerotoninRisk.toFixed(1)),
      currentCypHalfLifeMultiplier: Number(currentCypAdjusted.halfLifeMultiplier.toFixed(3)),
      riskTopContributors: {
        awakeButImpaired: topContributors(awakeContributorsRaw),
        cyp3a4: topContributors(currentCypContributorsRaw),
        serotonin: topContributors(currentSerotoninContributorsRaw),
      },
      awakeButImpairedEta: {
        targetTs: awakeButImpairedLowPoint?.ts ?? null,
        label: formatEtaToLowRisk(awakeButImpairedLowPoint?.ts ?? NaN, now),
      },
      summaryText,
      confidenceText,
      activeDrugCount,
      totalEntryCount: allEntries.length,
      hoursSinceLatestLog,
      toleranceSummary: {
        clonazepamReduction: Number(toleranceReductionPercent(clonazToleranceFactor).toFixed(1)),
        doxylamineReduction: Number(toleranceReductionPercent(currentDoxToleranceFactor).toFixed(1)),
        vilazodoneReduction: Number(toleranceReductionPercent(currentVilaToleranceFactor).toFixed(1)),
        lamotrigineReduction: Number(toleranceReductionPercent(currentLamoToleranceFactor).toFixed(1)),
        trazodoneReduction: Number(toleranceReductionPercent(currentTrazoToleranceFactor).toFixed(1)),
        levothyroxineReduction: Number(toleranceReductionPercent(currentLevothyroxineToleranceFactor).toFixed(1)),
        caffeineReduction: Number(toleranceReductionPercent(caffeineToleranceFactor).toFixed(1)),
      },
      confidence,
    };
  }, [recalcAt, activeProfileId, profiles]);

  const chartTicks = useMemo(() => {
    if (!modelData.points.length) return [];
    const s = modelData.points[0].ts;
    const e = modelData.points[modelData.points.length - 1].ts;
    const intervalMs = 6 * 3600000; // every 6 hours
    const out = [];
    for (let t = Math.ceil(s / intervalMs) * intervalMs; t <= e; t += intervalMs) out.push(t);
    return out;
  }, [modelData.points]);

  const sendCnsFollowup = async (prevExplanation, question) => {
    const groqApiKey = (localStorage.getItem("groqApiKey") || import.meta.env?.VITE_GROQ_API_KEY || "").trim();
    if (!groqApiKey) { setCnsExplanationError("Groq API key not found. Add it in Settings."); return; }
    setCnsExplanationBusy(true); setCnsExplanationError("");
    const prompt = `Previous analysis:\n${prevExplanation}\n\n---\n\nFollow-up question: ${question}`;
    try {
      const model = (localStorage.getItem("groqModel") || "llama-3.3-70b-versatile").trim();
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqApiKey}` },
        body: JSON.stringify({ model, temperature: 0.3, messages: [{ role: "user", content: prompt }] }),
      });
      if (!res.ok) throw new Error(`Groq API error ${res.status}`);
      const payload = await res.json();
      const content = String(payload?.choices?.[0]?.message?.content || "").trim();
      if (!content) throw new Error("Empty response from AI.");
      setCnsExplanation((prev) => prev + "\n\n---\n\n**Follow-up:** " + question + "\n\n" + content);
    } catch (err) { setCnsExplanationError(String(err.message || "Unknown error")); }
    finally { setCnsExplanationBusy(false); }
  };

  const explainCnsChart = async () => {
    const groqApiKey = (localStorage.getItem("groqApiKey") || import.meta.env?.VITE_GROQ_API_KEY || "").trim();
    if (!groqApiKey) { setCnsExplanationError("Groq API key not found. Add it in Settings first."); return; }
    if (cnsExplanationBusy) return;
    setCnsExplanationBusy(true); setCnsExplanationError(""); setCnsExplanation("");
    const nowPt = modelData.points.find((p) => p.ts >= recalcAt) || modelData.points[modelData.points.length - 1];
    const sedative = nowPt?.sedativePressure ?? 0;
    const caffeine = nowPt?.stimulantCounterPressure ?? 0;
    const psychomotor = nowPt?.psychomotorImpairment ?? 0;
    const alertness = nowPt?.alertness ?? 0;
    const drugs = Object.entries(modelData.nowAmounts || {}).filter(([, v]) => typeof v === "number" && v > 0).map(([k, v]) => `${k}: ${v.toFixed(3)}`).join(", ");
    const prompt = [
      `COMBINED CNS LOAD MODEL — CURRENT SNAPSHOT`,
      `Active drug amounts right now: ${drugs || "none logged"}.`,
      `Modeled values at this moment: Sedative pressure ${sedative.toFixed(0)}%, Caffeine counter-pressure ${caffeine.toFixed(0)}%, Psychomotor impairment ${psychomotor.toFixed(0)}%, Functional alertness ${alertness.toFixed(0)}%.`,
      ``,
      `In 3–4 bullet points, explain what these CNS load numbers mean in plain language:`,
      `1. What the combined sedative pressure of ${sedative.toFixed(0)}% and caffeine counter-pressure of ${caffeine.toFixed(0)}% indicates for functional state right now`,
      `2. What psychomotor impairment of ${psychomotor.toFixed(0)}% means for activities like driving or precision tasks`,
      `3. How the interaction between the sedating drugs and caffeine affects the net alertness of ${alertness.toFixed(0)}%`,
      `4. One practical safety consideration given this combination`,
      `End with: "Not medical advice."`,
    ].join("\n");
    try {
      const model = (localStorage.getItem("groqModel") || "llama-3.3-70b-versatile").trim();
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqApiKey}` },
        body: JSON.stringify({ model, temperature: 0.2, messages: [{ role: "user", content: prompt }] }),
      });
      if (!res.ok) { const t = await res.text(); throw new Error(`Groq API error ${res.status}: ${t.slice(0, 200)}`); }
      const payload = await res.json();
      const content = String(payload?.choices?.[0]?.message?.content || "").trim();
      if (!content) throw new Error("Empty response from AI.");
      setCnsExplanation(content);
    } catch (err) { setCnsExplanationError(String(err.message || "Unknown error")); }
    finally { setCnsExplanationBusy(false); }
  };

  return (
    <div className="w-full px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="w-8 h-8 text-fuchsia-600 dark:text-fuchsia-400" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Medication Mix Model</h1>
          <p className="text-gray-600 dark:text-gray-400">Estimate combined impairment, wakefulness, CYP3A4 overlap proxy, and serotonergic overlap from your tracked medications.</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Saving to:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-fuchsia-100 dark:bg-fuchsia-900 text-fuchsia-700 dark:text-fuchsia-300 text-sm font-semibold">{modelData.activeProfileName}</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">Manage users in Wellness Hub</span>
          </div>
          <button
            type="button"
            onClick={() => setRecalcAt(Date.now())}
            className="px-3 py-1.5 rounded-lg border border-fuchsia-300 dark:border-fuchsia-700 text-fuchsia-700 dark:text-fuchsia-300 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/20 text-sm"
          >
            Recalculate
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Last recalculated: {new Date(recalcAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>

        {modelData.nowPoint && (
          <div className="rounded-lg border border-fuchsia-200 dark:border-fuchsia-800 bg-fuchsia-50/50 dark:bg-fuchsia-950/20 p-3 space-y-2">
            <h2 className="font-semibold text-fuchsia-900 dark:text-fuchsia-100">Now Summary</h2>
            <p className="text-sm text-fuchsia-900 dark:text-fuchsia-100">{modelData.summaryText}</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm text-fuchsia-900 dark:text-fuchsia-100">
              <p>Impairment: <strong>{formatPercentByConfidence(modelData.nowPoint.psychomotorImpairment, modelData.confidence)}</strong></p>
              <p>Wakefulness: <strong>{formatPercentByConfidence(modelData.nowPoint.wakefulnessDrive, modelData.confidence)}</strong></p>
              <p>Functional alertness: <strong>{formatPercentByConfidence(modelData.nowPoint.alertness, modelData.confidence)}</strong></p>
              <p>ETA to low risk: <strong>{modelData.awakeButImpairedEta?.label ?? "Not within forecast"}</strong></p>
            </div>
            <p className="text-xs text-fuchsia-800 dark:text-fuchsia-200">{modelData.confidenceText}</p>
            <p className="text-xs text-fuchsia-800 dark:text-fuchsia-200">Stimulants can increase wakefulness without restoring coordination, judgment, or reaction time.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50/70 dark:bg-red-950/20 p-4 space-y-1">
          <h2 className="font-semibold text-red-900 dark:text-red-200">Awake but Impaired</h2>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">{formatPercentByConfidence(modelData.nowPoint?.psychomotorImpairment ?? 0, modelData.confidence)}</p>
          <p className="text-xs font-medium text-red-900 dark:text-red-200">Risk band: {riskBand(modelData.nowPoint?.psychomotorImpairment ?? 0)}</p>
          <p className="text-xs text-red-800 dark:text-red-200">Dominant contributors: {formatTopContributors(modelData.riskTopContributors?.awakeButImpaired)}</p>
          <p className="text-xs text-red-800 dark:text-red-200">{riskInterpretation(modelData.nowPoint?.psychomotorImpairment ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50/70 dark:bg-orange-950/20 p-4 space-y-1">
          <h2 className="font-semibold text-orange-900 dark:text-orange-200">CYP3A4 Overlap Proxy</h2>
          <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{formatPercentByConfidence(modelData.currentCyp3a4Congestion ?? 0, modelData.confidence)}</p>
          <p className="text-xs font-medium text-orange-900 dark:text-orange-200">Risk band: {riskBand(modelData.currentCyp3a4Congestion)}</p>
          <p className="text-xs text-orange-800 dark:text-orange-200">Dominant contributors: {formatTopContributors(modelData.riskTopContributors?.cyp3a4)}</p>
          <p className="text-xs text-orange-800 dark:text-orange-200">Half-life multiplier: ×{modelData.currentCypHalfLifeMultiplier}</p>
          <p className="text-xs text-orange-800 dark:text-orange-200">Exploratory signal only; not proof of a clinically significant interaction.</p>
        </div>
        <div className="rounded-xl border border-fuchsia-200 dark:border-fuchsia-800 bg-fuchsia-50/70 dark:bg-fuchsia-950/20 p-4 space-y-1">
          <h2 className="font-semibold text-fuchsia-900 dark:text-fuchsia-200">Serotonergic Overlap</h2>
          <p className="text-2xl font-bold text-fuchsia-700 dark:text-fuchsia-300">{formatPercentByConfidence(modelData.currentSerotoninRisk ?? 0, modelData.confidence)}</p>
          <p className="text-xs font-medium text-fuchsia-900 dark:text-fuchsia-200">Risk band: {riskBand(modelData.currentSerotoninRisk)}</p>
          <p className="text-xs text-fuchsia-800 dark:text-fuchsia-200">Dominant contributors: {formatTopContributors(modelData.riskTopContributors?.serotonin)}</p>
          <p className="text-xs text-fuchsia-800 dark:text-fuchsia-200">Vilazodone + trazodone are treated as a separate clinical-risk channel.</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 p-4 space-y-2">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">Confidence & Coverage</h2>
        <p className="text-sm text-slate-700 dark:text-slate-300">Model confidence (current scale max: Medium): <strong>{modelData.confidence}</strong> · Active sources: <strong>{modelData.activeDrugCount}</strong> · Logged entries: <strong>{modelData.totalEntryCount}</strong></p>
        <p className="text-sm text-slate-700 dark:text-slate-300">Latest log age: <strong>{Number.isFinite(modelData.hoursSinceLatestLog) ? `${modelData.hoursSinceLatestLog}h ago` : "No recent logs"}</strong>. When confidence is low, values are shown as ranges rather than precise decimals.</p>
        <p className="text-sm text-slate-700 dark:text-slate-300">Band thresholds: <strong>Low</strong> (0-24), <strong>Moderate</strong> (25-49), <strong>High</strong> (50-74), <strong>Very High</strong> (75-100).</p>
      </div>

      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/20 p-4 space-y-3">
        <h2 className="font-semibold text-blue-900 dark:text-blue-200">Tolerance Buildup</h2>
        {["clonazepamReduction", "doxylamineReduction", "vilazodoneReduction", "lamotrigineReduction", "trazodoneReduction", "levothyroxineReduction", "caffeineReduction"].some(
          (key) => (modelData.toleranceSummary?.[key] ?? 0) > 0
        ) ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm text-blue-900 dark:text-blue-100">
            {(modelData.toleranceSummary?.clonazepamReduction ?? 0) > 0 && <p>Clonazepam effect reduction: <strong>{modelData.toleranceSummary.clonazepamReduction}%</strong></p>}
            {(modelData.toleranceSummary?.doxylamineReduction ?? 0) > 0 && <p>Doxylamine effect reduction: <strong>{modelData.toleranceSummary.doxylamineReduction}%</strong></p>}
            {(modelData.toleranceSummary?.vilazodoneReduction ?? 0) > 0 && <p>Vilazodone sedation reduction: <strong>{modelData.toleranceSummary.vilazodoneReduction}%</strong></p>}
            {(modelData.toleranceSummary?.lamotrigineReduction ?? 0) > 0 && <p>Lamotrigine modulation reduction: <strong>{modelData.toleranceSummary.lamotrigineReduction}%</strong></p>}
            {(modelData.toleranceSummary?.trazodoneReduction ?? 0) > 0 && <p>Trazodone effect reduction: <strong>{modelData.toleranceSummary.trazodoneReduction}%</strong></p>}
            {(modelData.toleranceSummary?.levothyroxineReduction ?? 0) > 0 && <p>Levothyroxine activation reduction: <strong>{modelData.toleranceSummary.levothyroxineReduction}%</strong></p>}
            {(modelData.toleranceSummary?.caffeineReduction ?? 0) > 0 && <p>Caffeine wakefulness reduction: <strong>{modelData.toleranceSummary.caffeineReduction}%</strong></p>}
          </div>
        ) : (
          <p className="text-sm text-blue-800 dark:text-blue-200">No tolerance buildup recorded yet. Set "Days at current dose" in each medication tracker to enable tolerance dampening.</p>
        )}
        <p className="text-xs text-blue-800 dark:text-blue-200">
          Clonazepam, doxylamine, vilazodone, lamotrigine, trazodone, levothyroxine, and caffeine now use saved tracker tolerance inputs. Tolerance dampens subjective effect, not concentration-based risk.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Combined CNS Load (Estimated)</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
           Purple = sedative burden, amber = caffeine counter-pressure (reduces sedative load), rose = psychomotor impairment floor, cyan = wakefulness drive, teal = functional alertness.
        </p>
        {modelData.points.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">Add doses in the medication/caffeine trackers to view the combined model.</p>
        ) : (
          <div className="w-full min-w-0 min-h-[18rem]">
            <ResponsiveContainer width="100%" height={288} minWidth={1} minHeight={1}>
              <LineChart data={modelData.points} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
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
                <YAxis domain={[-35, 100]} tickFormatter={(value) => `${value}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }}
                  labelStyle={{ color: "#f9fafb", fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: "#d1d5db" }}
                  labelFormatter={(value) => `🕐 ${new Date(value).toLocaleString([], { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
                  formatter={(value, name) => {
                    if (name === "sedativePressure") return [`${value}%`, "Sedative pressure"];
                    if (name === "stimulantCounterPressure") return [`${value}%`, "Caffeine counter-pressure"];
                    if (name === "psychomotorImpairment") return [`${value}%`, "Psychomotor impairment"];
                    if (name === "wakefulnessDrive") return [`${value}%`, "Wakefulness drive"];
                    return [`${value}%`, "Functional alertness"];
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
                <Line type="monotone" dataKey="sedativePressure" name="sedativePressure" stroke="#a855f7" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="stimulantCounterPressure" name="stimulantCounterPressure" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="psychomotorImpairment" name="psychomotorImpairment" stroke="#fb7185" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="wakefulnessDrive" name="wakefulnessDrive" stroke="#06b6d4" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="alertness" name="alertness" stroke="#14b8a6" strokeWidth={2} strokeDasharray="5 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={explainCnsChart}
            disabled={cnsExplanationBusy || modelData.points.length === 0}
            className="px-3 py-1 rounded text-xs bg-indigo-700 text-white hover:bg-indigo-600 disabled:opacity-50"
          >
            {cnsExplanationBusy ? "…" : "Ask AI"}
          </button>
        </div>
        {cnsExplanationError && <p className="text-xs text-red-400">{cnsExplanationError}</p>}
        {cnsExplanation && (
          <div className="text-xs text-slate-300 bg-slate-800 rounded-xl p-3 border border-slate-600 space-y-2">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">AI Analysis</span>
              <button onClick={() => { setCnsExplanation(""); setCnsFollowup(""); }} className="text-slate-400 hover:text-red-400 text-xs px-1.5 py-0.5 rounded border border-slate-600 hover:border-red-400 transition-colors">✕ Close</button>
            </div>
            {cnsExplanation.split("\n").map((line, i) => {
              const t = line.trim();
              if (!t) return null;
              if (t === "Not medical advice.") return <p key={i} className="text-slate-500 mt-1">{t}</p>;
              if (t === "---") return <hr key={i} className="border-slate-600 my-1" />;
              if (t.startsWith("**Follow-up:")) return <p key={i} className="font-semibold text-blue-200 mt-2">{t.replace(/\*\*/g, "")}</p>;
              return <p key={i} className="leading-relaxed">{t}</p>;
            })}
            <div className="mt-3 pt-2 border-t border-slate-700 space-y-1">
              <p className="text-[10px] text-slate-400">Ask a follow-up question:</p>
              <div className="flex gap-2">
                <input type="text" value={cnsFollowup} onChange={(e) => setCnsFollowup(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && cnsFollowup.trim()) { sendCnsFollowup(cnsExplanation, cnsFollowup); setCnsFollowup(""); } }}
                  placeholder="e.g. Is it safe to drive with these levels?"
                  className="flex-1 px-2 py-1 text-xs rounded border border-slate-600 bg-slate-900 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <button disabled={cnsExplanationBusy || !cnsFollowup.trim()}
                  onClick={() => { sendCnsFollowup(cnsExplanation, cnsFollowup); setCnsFollowup(""); }}
                  className="px-2 py-1 rounded bg-blue-700 hover:bg-blue-600 text-white text-xs disabled:opacity-50">
                  {cnsExplanationBusy ? "…" : "Ask"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Drug List</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          “Active now” is a modeled residual body-pool estimate from current plus prior logged doses, not a statement of today’s single administered dose.
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Clonazepam uses the same maintenance-dose carryover and last-maintenance anchor configured in Clonazepam Tracker.
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200">Tranquilizing</span>
          <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">Stimulating</span>
          <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">Modulating / mixed</span>
        </div>
        <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
          <li className="text-purple-700 dark:text-purple-300">
            Clonazepam: {modelData.nowAmounts?.clonazepamMg?.toFixed(3) ?? "0.000"} mg active now
            {modelData.nowAmounts?.clonazepamCypAdjustedMg !== modelData.nowAmounts?.clonazepamMg && (
              <span className="text-orange-600 dark:text-orange-400">; CYP-adjusted in model: {modelData.nowAmounts?.clonazepamCypAdjustedMg?.toFixed(3) ?? "0.000"} mg</span>
            )}
          </li>
          {(modelData.nowAmounts?.doxylamineMg ?? 0) > 0
            ? <li className="text-purple-700 dark:text-purple-300">Doxylamine: {modelData.nowAmounts.doxylamineMg.toFixed(3)} mg active now</li>
            : <li className="text-gray-400 dark:text-gray-600">Doxylamine: <span className="italic">(no logs)</span></li>}
          {(modelData.nowAmounts?.vilazodoneMg ?? 0) > 0
            ? <li className="text-blue-700 dark:text-blue-300">
                Vilazodone: {modelData.nowAmounts.vilazodoneMg.toFixed(3)} mg active now
                {modelData.nowAmounts?.vilazodoneCypAdjustedMg !== modelData.nowAmounts?.vilazodoneMg && (
                  <span className="text-orange-600 dark:text-orange-400">; CYP-adjusted in model: {modelData.nowAmounts.vilazodoneCypAdjustedMg.toFixed(3)} mg</span>
                )}
              </li>
            : null}
          {(modelData.nowAmounts?.lamotrigineMg ?? 0) > 0
            ? <li className="text-blue-700 dark:text-blue-300">Lamotrigine: {modelData.nowAmounts.lamotrigineMg.toFixed(3)} mg active now</li>
            : null}
          {(modelData.nowAmounts?.trazodoneMg ?? 0) > 0
            ? <li className="text-purple-700 dark:text-purple-300">
                Trazodone: {modelData.nowAmounts.trazodoneMg.toFixed(3)} mg active now
                {modelData.nowAmounts?.trazodoneCypAdjustedMg !== modelData.nowAmounts?.trazodoneMg && (
                  <span className="text-orange-600 dark:text-orange-400">; CYP-adjusted in model: {modelData.nowAmounts.trazodoneCypAdjustedMg.toFixed(3)} mg</span>
                )}
              </li>
            : <li className="text-gray-400 dark:text-gray-600">Trazodone: <span className="italic">(no logs)</span></li>}
          {(modelData.nowAmounts?.levothyroxineMcg ?? 0) > 0
            ? <li className="text-amber-700 dark:text-amber-300">Levothyroxine: {modelData.nowAmounts.levothyroxineMcg.toFixed(3)} mcg active now</li>
            : <li className="text-gray-400 dark:text-gray-600">Levothyroxine: <span className="italic">(no logs)</span></li>}
          <li className="text-amber-700 dark:text-amber-300">Caffeine: {modelData.nowAmounts?.caffeineMg?.toFixed(1) ?? "0.0"} mg active now ({modelData.nowAmounts?.caffeineMgPerKg?.toFixed(3) ?? "0.000"} mg/kg)</li>
          {(modelData.nowAmounts?.vilazodoneMg ?? 0) <= 0 && (
            <li className="text-gray-400 dark:text-gray-600">Vilazodone: <span className="italic">(no logs)</span></li>
          )}
          {(modelData.nowAmounts?.lamotrigineMg ?? 0) <= 0 && (
            <li className="text-gray-400 dark:text-gray-600">Lamotrigine: <span className="italic">(no logs)</span></li>
          )}
        </ul>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-gray-900 dark:text-white">Math Model</h2>
          <button
            type="button"
            onClick={() => setShowAdvancedMath((prev) => !prev)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {showAdvancedMath ? "Hide Advanced" : "Show Advanced"}
          </button>
        </div>
        {modelData.liveMath && (
          <div className="rounded-lg border border-fuchsia-200 dark:border-fuchsia-800 bg-fuchsia-50/40 dark:bg-fuchsia-950/10 p-3 space-y-2 text-xs sm:text-sm text-fuchsia-950 dark:text-fuchsia-100">
            <h3 className="font-semibold">Live calculations using your current tracker inputs</h3>
            <p><strong>Active inputs now:</strong> clonaz {modelData.liveMath.activeNow.clonazepamMg} mg, dox {modelData.liveMath.activeNow.doxylamineMg} mg, vila {modelData.liveMath.activeNow.vilazodoneMg} mg, lamo {modelData.liveMath.activeNow.lamotrigineMg} mg, trazo {modelData.liveMath.activeNow.trazodoneMg} mg, levo {modelData.liveMath.activeNow.levothyroxineMcg} mcg, caffeine {modelData.liveMath.activeNow.caffeineMg} mg ({modelData.liveMath.activeNow.caffeineMgPerKg} mg/kg).</p>
            <p><strong>Wakefulness drive:</strong> {formatPercentByConfidence(modelData.liveMath.currentWakefulnessDrive, modelData.confidence)}.</p>
            <p><strong>Psychomotor impairment:</strong> {formatPercentByConfidence(modelData.liveMath.currentPsychomotorImpairment, modelData.confidence)}.</p>
            <p><strong>Functional alertness:</strong> {formatPercentByConfidence(modelData.liveMath.currentFunctionalAlertness, modelData.confidence)}.</p>
          </div>
        )}
        {showAdvancedMath && (
          <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 space-y-2">
            <p><strong>Assumptions:</strong> This model is exploratory, not clinical dosing guidance. Values are simplified response proxies, not serum concentration predictions.</p>
            <p><strong>Per-drug elimination:</strong> Active_drug(t) = Σ Dose_i × 0.5^((t − t_i)/halfLife_drug)</p>
            <p><strong>Clonazepam absorption timing:</strong> clonazepam uses a fixed {CLONAZEPAM_ONSET_LAG_MINUTES} min lag plus {CLONAZEPAM_ONSET_RAMP_MINUTES} min smooth ramp to full effect, so concentration-driven clonazepam effects typically peak around {CLONAZEPAM_ONSET_FULL_EFFECT_MINUTES} min instead of immediately.</p>
            <p><strong>Dynamic CYP feedback:</strong> halfLife_eff = halfLife_base × (1 + 0.20×CYP/100) for clonazepam, trazodone, and vilazodone as a deliberately light exploratory sensitivity model, not a claim of established interaction magnitude.</p>
            <p><strong>Pressure transform:</strong> Pressure_drug = 100 × Active_drug / (Active_drug + EC50_drug)</p>
            <p><strong>Tolerance transform:</strong> Effect_drug = Pressure_drug × ToleranceFactor_drug, where ToleranceFactor = 1 − maxReduction×(1 − e^(−days/τ))</p>
            <p><strong>Sedative pressure blend:</strong> Sedative = 100 × [1 − Π(1 − weighted sedative components)] using a Bliss-style saturation blend of clonazepam, doxylamine, vilazodone, lamotrigine, and trazodone.</p>
            <p><strong>CYP3A4 overlap proxy:</strong> CYP = 100 × [1 − Π(1 − weighted CYP components)] using clonazepam, trazodone, and vilazodone substrate pressure as a soft exploratory overlap signal.</p>
            <p><strong>Serotonin overlap proxy:</strong> 5HT = 100 × [1 − Π(1 − weighted serotonergic components)] for vilazodone and trazodone.</p>
            <p><strong>Caffeine wakefulness input:</strong> each caffeine entry uses a fixed {CAFFEINE_ONSET_LAG_MINUTES} min lag plus {CAFFEINE_ONSET_RAMP_MINUTES} min smooth ramp to full effect, so wakefulness support typically peaks around {CAFFEINE_ONSET_FULL_EFFECT_MINUTES} min after each sip; C = ActiveCaffeine_mg / weight_kg × ToleranceFactor_caffeine, Counter = 100 × C/(C + 2.0)</p>
            <p><strong>Levothyroxine activation proxy:</strong> LevoAct = 0.12 × [100 × Active_levo/(Active_levo + 150 mcg)] × ToleranceFactor_levo</p>
            <p><strong>Wakefulness drive:</strong> Wake = clamp(100 − SleepPenalty − 0.25×Sedative + 0.45×Counter + 0.4×LevoAct, 0, 100)</p>
            <p><strong>Psychomotor impairment floor:</strong> Impair = clamp(0.88×Sedative + 0.18×5HT − 0.12×Counter, 0, 100)</p>
            <p><strong>Functional alertness:</strong> Functional = clamp(Wake − 0.72×Impair, 0, 100)</p>
            <p><strong>Circadian penalty:</strong> SleepPenalty = 30 × ((cos(2π × (hour−3)/24) + 1)/2)</p>
            <p><strong>Why this differs from a simple cancel-out model:</strong> stimulant inputs can increase wakefulness, but they only minimally reduce impairment in this version. CYP overlap changes modeled concentration persistence upstream instead of being added again as a direct impairment term.</p>
            <p><strong>Saved tolerance inputs:</strong> clonazepam, doxylamine, vilazodone, lamotrigine, trazodone, levothyroxine, and caffeine use stored days-at-dose style values from their tracker pages.</p>
            <p><strong>Default EC50 constants:</strong> clonaz=0.5 mg, doxylamine=6 mg, vilazodone=40 mg, lamotrigine=60 mg, trazodone=25 mg, levothyroxine=150 mcg, caffeine(counter)=2.0 mg/kg</p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10 p-4 space-y-2">
        <h2 className="font-semibold text-amber-900 dark:text-amber-200">Safety Note</h2>
        <p className="text-sm text-amber-900 dark:text-amber-200">
          This is an educational approximation, not medical guidance. Clonazepam is metabolized by CYP3A4, but clinically significant drug-drug interactions with vilazodone are not commonly reported. Here, a CYP3A4 overlap proxy is used as a conservative exploratory signal that feeds back into the modeled half-lives of clonazepam, trazodone, and vilazodone, while caffeine remains a wakefulness input rather than restoration of safe function. Real interaction risk still depends on diagnosis, prescribed regimen, organ function, timing, and other substances including alcohol or opioids.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Further Research & Online Discussion</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Helpful references for multi-medication interaction context and peer discussion spaces for day-to-day self-tracking questions.
        </p>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Research</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
            {MIX_RESEARCH_LINKS.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-700 dark:text-indigo-300 hover:underline"
                >
                  {link.label}
                </a>
                <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/20">
                  {link.evidence}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Forums & Communities</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
            {MIX_COMMUNITY_LINKS.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-700 dark:text-indigo-300 hover:underline"
                >
                  {link.label}
                </a>
                <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/20">
                  {link.type}
                </span>
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{link.summary}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Online communities can be helpful for lived-experience tips, but they are not individualized medical advice for diagnosis, medication changes, or urgent concerns.
        </p>
      </div>
    </div>
  );
}
