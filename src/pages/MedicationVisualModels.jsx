import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Atom } from "lucide-react";
import { activeCaffeineAmountAtTime } from "../utils/caffeineModel";
import {
  activeClonazepamAmountAtTime,
  CLONAZEPAM_ONSET_FULL_EFFECT_MINUTES,
  CLONAZEPAM_ONSET_LAG_MINUTES,
  CLONAZEPAM_ONSET_RAMP_MINUTES,
} from "../utils/clonazepamModel";

const ACTIVE_PROFILE_ID_STORAGE_KEY = "caffeineTrackerActiveProfileId";
const PROFILE_STORAGE_KEY = "caffeineTrackerProfilesV1";
const WELLNESS_GLOBAL_USER_NAME_KEY = "wellnessGlobalUserName";

const MED_CONFIG = [
  {
    id: "clonazepam",
    name: "Clonazepam",
    storageKey: "clonazepamTrackerByUserV1",
    halfLifeFallback: 30,
    unit: "mg",
    ec50: 0.5,
    model: `Absorption lag/ramp (~${CLONAZEPAM_ONSET_FULL_EFFECT_MINUTES} min to full effect) + exponential half-life + sedative pressure transform`,
  },
  {
    id: "doxylamine",
    name: "Doxylamine",
    storageKey: "doxylamineTrackerByUserV1",
    halfLifeFallback: 10,
    unit: "mg",
    ec50: 6,
    model: "Exponential half-life + sedative pressure transform",
  },
  {
    id: "vilazodone",
    name: "Vilazodone",
    storageKey: "vilazodoneTrackerByUserV1",
    halfLifeFallback: 25,
    unit: "mg",
    ec50: 40,
    model: "Exponential half-life + weighted modulation",
  },
  {
    id: "lamotrigine",
    name: "Lamotrigine",
    storageKey: "lamotrigineTrackerByUserV1",
    halfLifeFallback: 29,
    unit: "mg",
    ec50: 60,
    model: "Exponential half-life + weighted modulation",
  },
  {
    id: "trazodone",
    name: "Trazodone",
    storageKey: "trazodoneTrackerByUserV1",
    halfLifeFallback: 7,
    unit: "mg",
    ec50: 25,
    model: "Exponential half-life + sedative modulation",
  },
  {
    id: "levothyroxine",
    name: "Levothyroxine",
    storageKey: "levothyroxineTrackerByUserV1",
    halfLifeFallback: 168,
    unit: "mcg",
    ec50: 150,
    model: "Exponential half-life + activation proxy",
  },
];

const VISUAL_RESEARCH_LINKS = [
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
    label: "Drug interaction resources and labeling (DailyMed)",
    url: "https://dailymed.nlm.nih.gov/dailymed/",
    evidence: "Regulatory",
  },
];

const VISUAL_COMMUNITY_LINKS = [
  {
    label: "ADAA Anxiety and Depression Support Community",
    url: "https://healthunlocked.com/anxiety-depression-support",
    type: "Moderated community",
    summary: "Peer discussion around anxiety, sleep, and medication routines.",
  },
  {
    label: "NAMI Connection Recovery Support Group",
    url: "https://www.nami.org/Support-Education/Support-Groups/NAMI-Connection",
    type: "Peer-led group",
    summary: "Structured mental health support groups for ongoing care and coping.",
  },
  {
    label: "BenzoBuddies",
    url: "https://benzobuddies.org/",
    type: "Community forum",
    summary: "Peer forum with benzodiazepine-focused taper and recovery discussions.",
  },
  {
    label: "r/caffeine (Reddit)",
    url: "https://www.reddit.com/r/caffeine/",
    type: "Community forum",
    summary: "Community discussions on caffeine use patterns, tolerance, and timing.",
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

function activeBolus(entries, halfLifeHours, atMs, referenceMs) {
  if (!Array.isArray(entries) || !entries.length || !halfLifeHours) return 0;
  return entries.reduce((sum, entry) => {
    const takenAt = getEntryTakenAtMs(entry, referenceMs);
    if (atMs < takenAt) return sum;
    const elapsedHours = (atMs - takenAt) / 3600000;
    const remaining = Math.pow(0.5, elapsedHours / halfLifeHours);
    return sum + (Number(entry.doseMg) || 0) * remaining;
  }, 0);
}

function activeClonazepamEntries(entries, halfLifeHours, atMs, referenceMs) {
  if (!Array.isArray(entries) || !entries.length || !halfLifeHours) return 0;
  return entries.reduce((sum, entry) => {
    return sum + activeClonazepamAmountAtTime({
      doseMg: entry?.doseMg,
      takenAtMs: getEntryTakenAtMs(entry, referenceMs),
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

function loadProfiles() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "[]");
    if (Array.isArray(parsed) && parsed.length) return parsed;
    return [{ id: "default", name: "Default" }];
  } catch {
    return [{ id: "default", name: "Default" }];
  }
}

function loadByUserState(storageKey, activeProfileId, halfLifeFallback) {
  try {
    const byUser = JSON.parse(localStorage.getItem(storageKey) || "{}");
    const state = byUser?.[activeProfileId] || {};
    const entries = Array.isArray(state.entries) ? state.entries : [];
    const parsedHalfLife = Number(state.halfLifeHours);
    const halfLifeHours = Number.isFinite(parsedHalfLife) && parsedHalfLife > 0 ? parsedHalfLife : halfLifeFallback;
    const parsedDaysAtCurrentDose = Number(state.daysAtCurrentDose);
    const daysAtCurrentDose = Number.isFinite(parsedDaysAtCurrentDose) && parsedDaysAtCurrentDose >= 0 ? parsedDaysAtCurrentDose : 0;
    const carryoverCadence = state?.carryoverCadence === "twice" ? "twice" : "once";
    return { entries, halfLifeHours, daysAtCurrentDose, carryoverCadence };
  } catch {
    return { entries: [], halfLifeHours: halfLifeFallback, daysAtCurrentDose: 0, carryoverCadence: "once" };
  }
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
        id: `visual-carryover-${day}-a`,
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
          id: `visual-carryover-${day}-b`,
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

function contributorsFromWeightedValues(values, count = 2) {
  if (!Array.isArray(values)) return [];
  return topContributors(
    values.map((item) => ({
      label: item.label,
      value: Number(item.value) || 0,
    })),
    count,
  );
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

  let clonazActive = activeClonazepamEntries(clonazEntries, clonazHalfLife, atMs, referenceMs);
  let trazodoneActive = activeBolus(trazodoneEntries, trazodoneHalfLife, atMs, referenceMs);
  let vilazodoneActive = activeBolus(vilazodoneEntries, vilazodoneHalfLife, atMs, referenceMs);
  let congestion = calculateCongestion(clonazActive, trazodoneActive, vilazodoneActive);
  let halfLifeMultiplier = 1;

  for (let i = 0; i < 2; i += 1) {
    halfLifeMultiplier = 1 + (congestion / 100) * 0.2;
    clonazActive = activeClonazepamEntries(clonazEntries, clonazHalfLife * halfLifeMultiplier, atMs, referenceMs);
    trazodoneActive = activeBolus(trazodoneEntries, trazodoneHalfLife * halfLifeMultiplier, atMs, referenceMs);
    vilazodoneActive = activeBolus(vilazodoneEntries, vilazodoneHalfLife * halfLifeMultiplier, atMs, referenceMs);
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

function formatPercentByConfidence(value, confidence) {
  if (confidence === "Very Low") {
    const low = Math.max(0, Math.round(value) - 8);
    const high = Math.min(100, Math.round(value) + 8);
    return `${low}\u2013${high}%`;
  }
  if (confidence === "Low") {
    const low = Math.max(0, Math.round(value) - 5);
    const high = Math.min(100, Math.round(value) + 5);
    return `${low}\u2013${high}%`;
  }
  return `${value.toFixed(1)}%`;
}

function confidenceExplanation(confidence, activeDrugCount, hoursSinceLatestLog) {
  const freshness =
    hoursSinceLatestLog == null
      ? "no entries logged yet"
      : hoursSinceLatestLog < 1
        ? "entries logged within the last hour"
        : hoursSinceLatestLog < 6
          ? `last entry ${Math.round(hoursSinceLatestLog)}h ago`
          : hoursSinceLatestLog < 24
            ? `last entry ${Math.round(hoursSinceLatestLog)}h ago \u2014 some data may be stale`
            : `last entry ${Math.round(hoursSinceLatestLog / 24)}d ago \u2014 consider refreshing logs`;
  return `${confidence} confidence \u2014 ${activeDrugCount} of 7 medications logged; ${freshness}.`;
}

function actionSummaryLine({ awakeButImpaired, cyp3a4Congestion, serotoninRisk, confidence }) {
  const impairBand = riskBand(awakeButImpaired);
  const cypBand = riskBand(cyp3a4Congestion);
  const seroBand = riskBand(serotoninRisk);
  if (impairBand === "Very High" || impairBand === "High") {
    return "High modeled impairment \u2014 avoid safety-critical tasks; stimulants don\u2019t restore coordination.";
  }
  if (cypBand === "High" || cypBand === "Very High") {
    return "Elevated CYP3A4 metabolic load \u2014 active compounds may clear more slowly than usual.";
  }
  if (seroBand === "High" || seroBand === "Very High") {
    return "Elevated serotonergic overlap \u2014 consult your prescriber if you notice unusual symptoms.";
  }
  if (confidence === "Very Low") {
    return "Too few medications logged for reliable modeling \u2014 add entries to improve accuracy.";
  }
  if (impairBand === "Moderate") {
    return "Moderate impairment modeled \u2014 use caution with driving or precision tasks.";
  }
  return "Lower risk signals at this time \u2014 continue monitoring and logging doses.";
}

function MoleculeGlyph({ intensity }) {
  const normalized = clamp(intensity / 100, 0.08, 1);
  const duration = 4 - normalized * 2;

  return (
    <motion.div
      className="relative h-24 w-24"
      animate={{ rotate: 360 }}
      transition={{ duration: duration, repeat: Infinity, ease: "linear" }}
    >
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-fuchsia-400/70"
        animate={{ scale: [1, 1 + normalized * 0.15, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-500/80" />
      <div className="absolute -left-1 top-8 h-4 w-4 rounded-full bg-cyan-500/80" />
      <div className="absolute right-0 top-3 h-3 w-3 rounded-full bg-emerald-500/80" />
      <div className="absolute right-2 bottom-1 h-4 w-4 rounded-full bg-amber-500/80" />
      <div className="absolute left-3 bottom-0 h-3 w-3 rounded-full bg-blue-500/80" />
    </motion.div>
  );
}

export default function MedicationVisualModels() {
  const [profiles, setProfiles] = useState(() => loadProfiles());
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [showAdvancedMath, setShowAdvancedMath] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState(() => {
    const saved = localStorage.getItem(ACTIVE_PROFILE_ID_STORAGE_KEY);
    const loaded = loadProfiles();
    if (saved && loaded.some((profile) => profile.id === saved)) return saved;
    return loaded[0]?.id || "default";
  });

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) || profiles[0] || { id: "default", name: "Default" };

  useEffect(() => {
    const globalName = localStorage.getItem(WELLNESS_GLOBAL_USER_NAME_KEY);
    if (!globalName) return;
    const match = profiles.find((p) => p.name === globalName);
    if (match && match.id !== activeProfileId) {
      setActiveProfileId(match.id);
      localStorage.setItem(ACTIVE_PROFILE_ID_STORAGE_KEY, match.id);
    }
  }, []);

  const modelCards = useMemo(() => {
    const now = Date.now();

    const clonazState = loadByUserState("clonazepamTrackerByUserV1", activeProfile.id, 30);
    const doxylamineState = loadByUserState("doxylamineTrackerByUserV1", activeProfile.id, 10);
    const vilazodoneState = loadByUserState("vilazodoneTrackerByUserV1", activeProfile.id, 25);
    const lamotrigineState = loadByUserState("lamotrigineTrackerByUserV1", activeProfile.id, 29);
    const trazodoneState = loadByUserState("trazodoneTrackerByUserV1", activeProfile.id, 7);
    const levothyroxineState = loadByUserState("levothyroxineTrackerByUserV1", activeProfile.id, 168);

    const clonazModeledEntries = buildModeledEntries(clonazState.entries, clonazState.daysAtCurrentDose, now, clonazState.carryoverCadence);
    const doxylamineModeledEntries = buildModeledEntries(doxylamineState.entries, doxylamineState.daysAtCurrentDose, now, "once");
    const vilazodoneModeledEntries = buildModeledEntries(vilazodoneState.entries, vilazodoneState.daysAtCurrentDose, now, "once");
    const lamotrigineModeledEntries = buildModeledEntries(lamotrigineState.entries, lamotrigineState.daysAtCurrentDose, now, "once");
    const trazodoneModeledEntries = buildModeledEntries(trazodoneState.entries, trazodoneState.daysAtCurrentDose, now, "once");
    const levothyroxineModeledEntries = buildModeledEntries(levothyroxineState.entries, levothyroxineState.daysAtCurrentDose, now, "once");

    const cypAdjusted = computeCyp3a4AdjustedActives({
      clonazEntries: clonazModeledEntries,
      clonazHalfLife: clonazState.halfLifeHours,
      trazodoneEntries: trazodoneModeledEntries,
      trazodoneHalfLife: trazodoneState.halfLifeHours,
      vilazodoneEntries: vilazodoneModeledEntries,
      vilazodoneHalfLife: vilazodoneState.halfLifeHours,
      atMs: now,
      referenceMs: now,
    });

    const meds = MED_CONFIG.map((med) => {
      const stateMap = {
        clonazepam: clonazState,
        doxylamine: doxylamineState,
        vilazodone: vilazodoneState,
        lamotrigine: lamotrigineState,
        trazodone: trazodoneState,
        levothyroxine: levothyroxineState,
      };
      const state = stateMap[med.id];
      const activeAmountTracked =
        med.id === "clonazepam"
          ? activeClonazepamEntries(clonazModeledEntries, state.halfLifeHours, now, now)
          : med.id === "trazodone"
            ? activeBolus(trazodoneModeledEntries, state.halfLifeHours, now, now)
            : med.id === "vilazodone"
              ? activeBolus(vilazodoneModeledEntries, state.halfLifeHours, now, now)
              : med.id === "doxylamine"
                ? activeBolus(doxylamineModeledEntries, state.halfLifeHours, now, now)
                : med.id === "lamotrigine"
                  ? activeBolus(lamotrigineModeledEntries, state.halfLifeHours, now, now)
                  : activeBolus(levothyroxineModeledEntries, state.halfLifeHours, now, now);
      const activeAmountModeled =
        med.id === "clonazepam"
          ? cypAdjusted.clonazActive
          : med.id === "trazodone"
            ? cypAdjusted.trazodoneActive
            : med.id === "vilazodone"
              ? cypAdjusted.vilazodoneActive
              : activeAmountTracked;
      const pressure = pressureHill(activeAmountModeled, med.ec50);

      return {
        ...med,
        halfLifeHours: state.halfLifeHours,
        effectiveHalfLifeHours: ["clonazepam", "trazodone", "vilazodone"].includes(med.id)
          ? Number((state.halfLifeHours * cypAdjusted.halfLifeMultiplier).toFixed(1))
          : state.halfLifeHours,
        entryCount: state.entries.length,
        activeAmount: Number(activeAmountTracked.toFixed(3)),
        cypAdjustedActiveAmount: Number(activeAmountModeled.toFixed(3)),
        pressure: Number(clamp(pressure, 0, 100).toFixed(1)),
      };
    });

    const caffeineEntries = Array.isArray(activeProfile.entries) ? activeProfile.entries : [];
    const caffeineHalfLife = Number(activeProfile.halfLifeHours) > 0 ? Number(activeProfile.halfLifeHours) : 5;
    const caffeineDaysAtDose = Math.max(0, Number(activeProfile?.daysAtDose) || 0);
    const weightValue = Number(activeProfile.weight);
    const weightUnit = activeProfile.weightUnit || "lb";
    const weightKg = weightValue > 0 ? (weightUnit === "lb" ? weightValue * 0.45359237 : weightValue) : 70;

    const caffeineActiveMg = caffeineEntries.reduce((sum, entry) => {
      return sum + activeCaffeineFromEntry(entry, now, now, caffeineHalfLife);
    }, 0);

    const caffeineMgPerKg = weightKg > 0 ? caffeineActiveMg / weightKg : 0;
    const caffeinePressure = (caffeineMgPerKg / (caffeineMgPerKg + 2.0)) * 100;

    meds.push({
      id: "caffeine",
      name: "Caffeine",
      model: "Sip-aware elimination + counter-pressure model",
      unit: "mg",
      entryCount: caffeineEntries.length,
      halfLifeHours: caffeineHalfLife,
      effectiveHalfLifeHours: caffeineHalfLife,
      activeAmount: Number(caffeineActiveMg.toFixed(1)),
      pressure: Number(clamp(caffeinePressure, 0, 100).toFixed(1)),
      ec50: 2.0,
    });

    const clonazPressure = pressureHill(cypAdjusted.clonazActive, 0.5);
    const doxylamineActiveMg = activeBolus(doxylamineModeledEntries, doxylamineState.halfLifeHours, now, now);
    const doxylaminePressure = pressureHill(doxylamineActiveMg, 6);
    const vilazodonePressureRaw = pressureHill(cypAdjusted.vilazodoneActive, 40);
    const lamotrigineActiveMg = activeBolus(lamotrigineModeledEntries, lamotrigineState.halfLifeHours, now, now);
    const lamotriginePressureRaw = pressureHill(lamotrigineActiveMg, 60);
    const trazodonePressureRaw = pressureHill(cypAdjusted.trazodoneActive, 25);
    const levothyroxineActiveMcg = activeBolus(levothyroxineModeledEntries, levothyroxineState.halfLifeHours, now, now);
    const levothyroxinePressureRaw = pressureHill(levothyroxineActiveMcg, 150);
    const clonazToleranceFactor = 1 - 0.35 * (1 - Math.exp(-(Math.max(0, Number(clonazState.daysAtCurrentDose) || 0)) / 10));
    const doxToleranceFactor = 1 - 0.25 * (1 - Math.exp(-(Math.max(0, Number(doxylamineState.daysAtCurrentDose) || 0)) / 8));
    const vilazodoneToleranceFactor = 1 - 0.15 * (1 - Math.exp(-(Math.max(0, Number(vilazodoneState.daysAtCurrentDose) || 0)) / 18));
    const lamotrigineToleranceFactor = 1 - 0.08 * (1 - Math.exp(-(Math.max(0, Number(lamotrigineState.daysAtCurrentDose) || 0)) / 24));
    const trazodoneToleranceFactor = 1 - 0.28 * (1 - Math.exp(-(Math.max(0, Number(trazodoneState.daysAtCurrentDose) || 0)) / 10));
    const levothyroxineToleranceFactor = 1 - 0.12 * (1 - Math.exp(-(Math.max(0, Number(levothyroxineState.daysAtCurrentDose) || 0)) / 30));
    const caffeineToleranceFactor = 1 - 0.4 * (1 - Math.exp(-(caffeineDaysAtDose / 14)));
    const stimulantCounterPressure = pressureHill(caffeineMgPerKg * caffeineToleranceFactor, 2.0);
    const clonazAdjusted = clonazPressure * clonazToleranceFactor;
    const doxAdjusted = doxylaminePressure * doxToleranceFactor;
    const vilazodoneAdjusted = vilazodonePressureRaw * vilazodoneToleranceFactor * 0.25;
    const lamotrigineAdjusted = lamotriginePressureRaw * lamotrigineToleranceFactor * 0.15;
    const trazodoneAdjusted = trazodonePressureRaw * trazodoneToleranceFactor * 0.2;
    const levothyroxineActivation = levothyroxinePressureRaw * 0.12 * levothyroxineToleranceFactor;
    const sedativeComponents = [
      { label: "Clonazepam", value: clonazAdjusted * 0.42 },
      { label: "Doxylamine", value: doxAdjusted * 0.24 },
      { label: "Vilazodone", value: vilazodoneAdjusted * 0.1 },
      { label: "Lamotrigine", value: lamotrigineAdjusted * 0.08 },
      { label: "Trazodone", value: trazodoneAdjusted * 0.16 },
    ];
    const serotoninComponents = [
      { label: "Vilazodone", value: vilazodonePressureRaw * 0.55 },
      { label: "Trazodone", value: trazodonePressureRaw * 0.7 },
    ];
    const cypComponents = [
      { label: "Clonazepam", value: clonazPressure * 0.38 },
      { label: "Trazodone", value: trazodonePressureRaw * 0.32 },
      { label: "Vilazodone", value: vilazodonePressureRaw * 0.3 },
    ];
    const sedativeNow = weightedBlissPercent(sedativeComponents.map((item) => item.value));
    const serotoninNow = weightedBlissPercent(serotoninComponents.map((item) => item.value));
    const cypNow = weightedBlissPercent(cypComponents.map((item) => item.value));
    const nowDate = new Date(now);
    const nowHour = nowDate.getHours() + nowDate.getMinutes() / 60;
    const circadianPenalty = 30 * ((Math.cos(((nowHour - 3) / 24) * 2 * Math.PI) + 1) / 2);
    const wakeDrive = clamp(100 - circadianPenalty - sedativeNow * 0.25 + stimulantCounterPressure * 0.45 + levothyroxineActivation * 0.4, 0, 100);
    const awakeButImpaired = clamp(sedativeNow * 0.88 + serotoninNow * 0.18 - stimulantCounterPressure * 0.12, 0, 100);
    const functionalAlertness = clamp(wakeDrive - awakeButImpaired * 0.72, 0, 100);

    const allRawTimestamps = [
      ...clonazState.entries,
      ...doxylamineState.entries,
      ...vilazodoneState.entries,
      ...lamotrigineState.entries,
      ...trazodoneState.entries,
      ...levothyroxineState.entries,
      ...caffeineEntries,
    ].map((e) => getEntryTakenAtMs(e, now)).filter((t) => Number.isFinite(t) && t > 0 && t <= now);
    const latestEntryMs = allRawTimestamps.length > 0 ? Math.max(...allRawTimestamps) : null;
    const activeDrugCount = meds.filter((med) => med.entryCount > 0).length;
    const totalEntryCount = meds.reduce((sum, med) => sum + med.entryCount, 0);
    const hoursSinceLatestLog = latestEntryMs != null ? (now - latestEntryMs) / 3600000 : null;

    return {
      meds,
      activeDrugCount,
      totalEntryCount,
      hoursSinceLatestLog,
      currentCyp3a4Congestion: Number(cypAdjusted.cyp3a4Congestion.toFixed(1)),
      currentCypHalfLifeMultiplier: Number(cypAdjusted.halfLifeMultiplier.toFixed(3)),
      liveMath: {
        activeNow: {
          clonazepamMg: Number(cypAdjusted.clonazActive.toFixed(3)),
          doxylamineMg: Number(doxylamineActiveMg.toFixed(3)),
          vilazodoneMg: Number(cypAdjusted.vilazodoneActive.toFixed(3)),
          lamotrigineMg: Number(lamotrigineActiveMg.toFixed(3)),
          trazodoneMg: Number(cypAdjusted.trazodoneActive.toFixed(3)),
          levothyroxineMcg: Number(levothyroxineActiveMcg.toFixed(3)),
          caffeineMg: Number(caffeineActiveMg.toFixed(1)),
          caffeineMgPerKg: Number(caffeineMgPerKg.toFixed(3)),
        },
        toleranceFactors: {
          clonazepam: Number(clonazToleranceFactor.toFixed(3)),
          doxylamine: Number(doxToleranceFactor.toFixed(3)),
          vilazodone: Number(vilazodoneToleranceFactor.toFixed(3)),
          lamotrigine: Number(lamotrigineToleranceFactor.toFixed(3)),
          trazodone: Number(trazodoneToleranceFactor.toFixed(3)),
          levothyroxine: Number(levothyroxineToleranceFactor.toFixed(3)),
          caffeine: Number(caffeineToleranceFactor.toFixed(3)),
        },
        pressures: {
          clonazepam: Number(clonazPressure.toFixed(1)),
          doxylamine: Number(doxylaminePressure.toFixed(1)),
          vilazodoneRaw: Number(vilazodonePressureRaw.toFixed(1)),
          lamotrigineRaw: Number(lamotriginePressureRaw.toFixed(1)),
          trazodoneRaw: Number(trazodonePressureRaw.toFixed(1)),
          levothyroxineRaw: Number(levothyroxinePressureRaw.toFixed(1)),
          stimulantCounter: Number(stimulantCounterPressure.toFixed(1)),
        },
        weightedComponents: {
          sedative: sedativeComponents.map((item) => ({ label: item.label, value: Number(item.value.toFixed(1)) })),
          cyp: cypComponents.map((item) => ({ label: item.label, value: Number(item.value.toFixed(1)) })),
          serotonin: serotoninComponents.map((item) => ({ label: item.label, value: Number(item.value.toFixed(1)) })),
        },
        levothyroxineActivation: Number(levothyroxineActivation.toFixed(1)),
        circadianPenalty: Number(circadianPenalty.toFixed(1)),
        currentSedativePressure: Number(sedativeNow.toFixed(1)),
        currentWakefulnessDrive: Number(wakeDrive.toFixed(1)),
        currentPsychomotorImpairment: Number(awakeButImpaired.toFixed(1)),
        currentFunctionalAlertness: Number(functionalAlertness.toFixed(1)),
        currentSerotoninRisk: Number(serotoninNow.toFixed(1)),
        currentCypOverlap: Number(cypNow.toFixed(1)),
      },
    };
  }, [activeProfile]);

  const riskSignals = useMemo(() => {
    const cyp3a4Congestion = modelCards.liveMath.currentCypOverlap;
    const serotoninRisk = modelCards.liveMath.currentSerotoninRisk;
    const sedativeBurden = modelCards.liveMath.currentSedativePressure;
    const wakeDrive = modelCards.liveMath.currentWakefulnessDrive;
    const awakeButImpaired = modelCards.liveMath.currentPsychomotorImpairment;

    const awakeContributorsRaw = [
      ...modelCards.liveMath.weightedComponents.sedative.map((item) => ({
        label: item.label,
        value: item.value * 0.88,
      })),
      { label: "5-HT overlap", value: serotoninRisk * 0.18 },
    ];

    const confidence = modelCards.activeDrugCount >= 5 ? "Medium" : modelCards.activeDrugCount >= 3 ? "Low" : "Very Low";
    const summaryText = actionSummaryLine({ awakeButImpaired, cyp3a4Congestion, serotoninRisk, confidence });
    const confidenceText = confidenceExplanation(confidence, modelCards.activeDrugCount, modelCards.hoursSinceLatestLog);

    return {
      cyp3a4Congestion,
      serotoninRisk,
      sedativeBurden,
      wakeDrive,
      awakeButImpaired,
      confidence,
      summaryText,
      confidenceText,
      cypTopContributors: contributorsFromWeightedValues(modelCards.liveMath.weightedComponents.cyp),
      serotoninTopContributors: contributorsFromWeightedValues(modelCards.liveMath.weightedComponents.serotonin),
      awakeTopContributors: topContributors(awakeContributorsRaw),
    };
  }, [modelCards]);

  const networkData = useMemo(() => {
    const lookup = Object.fromEntries(modelCards.meds.map((item) => [item.id, item]));
    const nodes = [
      { id: "clonazepam", x: 18, y: 22, group: "sedative" },
      { id: "doxylamine", x: 34, y: 12, group: "sedative" },
      { id: "trazodone", x: 52, y: 16, group: "sedative" },
      { id: "vilazodone", x: 70, y: 24, group: "modulator" },
      { id: "lamotrigine", x: 76, y: 45, group: "modulator" },
      { id: "levothyroxine", x: 55, y: 66, group: "activator" },
      { id: "caffeine", x: 28, y: 64, group: "counter" },
    ].map((node) => ({ ...node, card: lookup[node.id] || null }));

    const sedativeIds = ["clonazepam", "doxylamine", "trazodone", "vilazodone", "lamotrigine"];
    const links = [];

    for (let i = 0; i < sedativeIds.length; i += 1) {
      for (let j = i + 1; j < sedativeIds.length; j += 1) {
        const a = lookup[sedativeIds[i]];
        const b = lookup[sedativeIds[j]];
        const signal = (((a?.pressure || 0) + (b?.pressure || 0)) / 2) * 0.6;
        links.push({ source: sedativeIds[i], target: sedativeIds[j], signal, type: "synergy" });
      }
    }

    const cypClusterIds = ["clonazepam", "trazodone", "vilazodone"];
    for (let i = 0; i < cypClusterIds.length; i += 1) {
      for (let j = i + 1; j < cypClusterIds.length; j += 1) {
        const a = lookup[cypClusterIds[i]];
        const b = lookup[cypClusterIds[j]];
        const signal = (((a?.pressure || 0) + (b?.pressure || 0)) / 2) * 0.72;
        links.push({ source: cypClusterIds[i], target: cypClusterIds[j], signal, type: "cyp3a4" });
      }
    }

    const serotoninSignal = (((lookup.trazodone?.pressure || 0) + (lookup.vilazodone?.pressure || 0)) / 2) * 0.9;
    links.push({ source: "trazodone", target: "vilazodone", signal: serotoninSignal, type: "serotonin" });

    for (const sedativeId of sedativeIds) {
      const sedative = lookup[sedativeId];
      const caffeine = lookup.caffeine;
      const levo = lookup.levothyroxine;

      links.push({
        source: "caffeine",
        target: sedativeId,
        signal: (((caffeine?.pressure || 0) + (sedative?.pressure || 0)) / 2) * 0.5,
        type: "counter",
      });

      links.push({
        source: "levothyroxine",
        target: sedativeId,
        signal: (((levo?.pressure || 0) + (sedative?.pressure || 0)) / 2) * 0.35,
        type: "counter",
      });
    }

    return { nodes, links };
  }, [modelCards]);

  return (
    <div className="w-full px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Atom className="w-8 h-8 text-fuchsia-600 dark:text-fuchsia-400" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Medication Visual Models</h1>
          <p className="text-gray-600 dark:text-gray-400">Animated visual model cards for clonazepam, doxylamine, vilazodone, lamotrigine, trazodone, levothyroxine, and caffeine.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-fuchsia-700 dark:text-fuchsia-300 bg-fuchsia-50 dark:bg-fuchsia-950/30 border border-fuchsia-200 dark:border-fuchsia-800 rounded-lg px-3 py-2 w-fit">
        <span className="font-medium">Saving to: {activeProfile.name || "Default"}</span>
        <span className="text-fuchsia-400 dark:text-fuchsia-600">·</span>
        <span className="text-fuchsia-600 dark:text-fuchsia-400">Manage users in Wellness Hub</span>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 p-4 space-y-2">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">How To Read This Page</h2>
        <p className="text-sm text-slate-700 dark:text-slate-300">Top cards now use the same full-model snapshot shown in Advanced Math, so headline values stay consistent across the page.</p>
        <p className="text-sm text-slate-700 dark:text-slate-300">Use the Advanced Math panel for formula-level detail, weighted contributors, and active-input breakdowns.</p>
      </div>

      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/20 p-4 space-y-3">
        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">{riskSignals.summaryText}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="text-center">
            <p className="text-xs text-blue-700 dark:text-blue-400 mb-0.5">Impairment</p>
            <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{formatPercentByConfidence(riskSignals.awakeButImpaired, riskSignals.confidence)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-blue-700 dark:text-blue-400 mb-0.5">Wakefulness (full)</p>
            <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{formatPercentByConfidence(riskSignals.wakeDrive, riskSignals.confidence)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-blue-700 dark:text-blue-400 mb-0.5">CYP3A4 Load</p>
            <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{formatPercentByConfidence(modelCards.currentCyp3a4Congestion, riskSignals.confidence)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-blue-700 dark:text-blue-400 mb-0.5">5-HT Overlap</p>
            <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{formatPercentByConfidence(riskSignals.serotoninRisk, riskSignals.confidence)}</p>
          </div>
        </div>
        <p className="text-xs text-blue-700 dark:text-blue-400">{riskSignals.confidenceText}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50/70 dark:bg-red-950/20 p-4 space-y-1">
          <h2 className="font-semibold text-red-900 dark:text-red-200">Awake but Impaired</h2>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">{formatPercentByConfidence(riskSignals.awakeButImpaired, riskSignals.confidence)}</p>
          <p className="text-xs font-medium text-red-900 dark:text-red-200">Risk band: {riskBand(riskSignals.awakeButImpaired)}</p>
          <p className="text-xs text-red-800 dark:text-red-200">
            Dominant contributors: {formatTopContributors(riskSignals.awakeTopContributors)}
          </p>
          <p className="text-xs text-red-800 dark:text-red-200">{riskInterpretation(riskSignals.awakeButImpaired)}</p>
          <p className="text-xs text-red-800 dark:text-red-200">Stimulants can increase wakefulness without restoring coordination, judgment, or reaction time.</p>
        </div>
        <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50/70 dark:bg-orange-950/20 p-4 space-y-1">
          <h2 className="font-semibold text-orange-900 dark:text-orange-200">CYP3A4 Overlap Proxy</h2>
          <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{formatPercentByConfidence(modelCards.currentCyp3a4Congestion, riskSignals.confidence)}</p>
          <p className="text-xs font-medium text-orange-900 dark:text-orange-200">Risk band: {riskBand(modelCards.currentCyp3a4Congestion)}</p>
          <p className="text-xs text-orange-800 dark:text-orange-200">
            Dominant contributors: {formatTopContributors(riskSignals.cypTopContributors)}
          </p>
          <p className="text-xs text-orange-800 dark:text-orange-200">{riskInterpretation(modelCards.currentCyp3a4Congestion)}</p>
          <p className="text-xs text-orange-800 dark:text-orange-200">This is an exploratory CYP3A4 load proxy that feeds back into the model as an effective half-life multiplier of ×{modelCards.currentCypHalfLifeMultiplier} for clonazepam, trazodone, and vilazodone; it should not be read as proof of a clinically significant clonazepam-vilazodone interaction.</p>
        </div>
        <div className="rounded-xl border border-fuchsia-200 dark:border-fuchsia-800 bg-fuchsia-50/70 dark:bg-fuchsia-950/20 p-4 space-y-1">
          <h2 className="font-semibold text-fuchsia-900 dark:text-fuchsia-200">Serotonergic Overlap</h2>
          <p className="text-2xl font-bold text-fuchsia-700 dark:text-fuchsia-300">{formatPercentByConfidence(riskSignals.serotoninRisk, riskSignals.confidence)}</p>
          <p className="text-xs font-medium text-fuchsia-900 dark:text-fuchsia-200">Risk band: {riskBand(riskSignals.serotoninRisk)}</p>
          <p className="text-xs text-fuchsia-800 dark:text-fuchsia-200">
            Dominant contributors: {formatTopContributors(riskSignals.serotoninTopContributors)}
          </p>
          <p className="text-xs text-fuchsia-800 dark:text-fuchsia-200">{riskInterpretation(riskSignals.serotoninRisk)}</p>
          <p className="text-xs text-fuchsia-800 dark:text-fuchsia-200">Vilazodone + trazodone are treated as a separate clinical-risk channel, not just sedation.</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 p-4 space-y-2">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">Confidence &amp; Coverage</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <div><span className="text-slate-500 dark:text-slate-400">Confidence: </span><span className="font-medium text-slate-800 dark:text-slate-200">{riskSignals.confidence}</span></div>
          <div><span className="text-slate-500 dark:text-slate-400">Active medications: </span><span className="font-medium text-slate-800 dark:text-slate-200">{modelCards.activeDrugCount} / 7</span></div>
          <div><span className="text-slate-500 dark:text-slate-400">Total log entries: </span><span className="font-medium text-slate-800 dark:text-slate-200">{modelCards.totalEntryCount}</span></div>
        </div>
        <p className="text-xs text-slate-700 dark:text-slate-300">{riskSignals.confidenceText}</p>
        <p className="text-xs text-slate-600 dark:text-slate-400">Band thresholds: <strong>Low</strong> (0–24), <strong>Moderate</strong> (25–49), <strong>High</strong> (50–74), <strong>Very High</strong> (75–100). “Active now” is a modeled residual body-pool estimate from current plus prior logged doses.</p>
      </div>

      {modelCards.liveMath && (
        <div className="rounded-xl border border-fuchsia-200 dark:border-fuchsia-800 bg-fuchsia-50/40 dark:bg-fuchsia-950/10 p-4 space-y-2">
          <button
            type="button"
            onClick={() => setShowAdvancedMath((prev) => !prev)}
            className="text-sm font-semibold text-fuchsia-900 dark:text-fuchsia-100 flex items-center gap-2"
          >
            <span>{showAdvancedMath ? "▾ Hide Advanced Math" : "▸ Show Advanced Math"}</span>
          </button>
          {!showAdvancedMath && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-fuchsia-950 dark:text-fuchsia-100">
              <div><span className="text-fuchsia-600 dark:text-fuchsia-400">Sedative pressure: </span><strong>{modelCards.liveMath.currentSedativePressure}%</strong></div>
              <div><span className="text-fuchsia-600 dark:text-fuchsia-400">Model wakefulness (full): </span><strong>{modelCards.liveMath.currentWakefulnessDrive}%</strong></div>
              <div><span className="text-fuchsia-600 dark:text-fuchsia-400">Impairment: </span><strong>{formatPercentByConfidence(modelCards.liveMath.currentPsychomotorImpairment, riskSignals.confidence)}</strong></div>
              <div><span className="text-fuchsia-600 dark:text-fuchsia-400">CYP multiplier: </span><strong>×{modelCards.currentCypHalfLifeMultiplier}</strong></div>
              <div><span className="text-fuchsia-600 dark:text-fuchsia-400">Serotonin risk: </span><strong>{formatPercentByConfidence(modelCards.liveMath.currentSerotoninRisk, riskSignals.confidence)}</strong></div>
              <div><span className="text-fuchsia-600 dark:text-fuchsia-400">Functional alertness: </span><strong>{formatPercentByConfidence(modelCards.liveMath.currentFunctionalAlertness, riskSignals.confidence)}</strong></div>
            </div>
          )}
          {showAdvancedMath && (
            <div className="space-y-1 text-xs sm:text-sm text-fuchsia-950 dark:text-fuchsia-100">
              <p><strong>Active inputs now:</strong> clonaz {modelCards.liveMath.activeNow.clonazepamMg} mg, dox {modelCards.liveMath.activeNow.doxylamineMg} mg, vila {modelCards.liveMath.activeNow.vilazodoneMg} mg, lamo {modelCards.liveMath.activeNow.lamotrigineMg} mg, trazo {modelCards.liveMath.activeNow.trazodoneMg} mg, levo {modelCards.liveMath.activeNow.levothyroxineMcg} mcg, caffeine {modelCards.liveMath.activeNow.caffeineMg} mg ({modelCards.liveMath.activeNow.caffeineMgPerKg} mg/kg).</p>
              <p><strong>Tolerance factors:</strong> clonaz {modelCards.liveMath.toleranceFactors.clonazepam}, dox {modelCards.liveMath.toleranceFactors.doxylamine}, vila {modelCards.liveMath.toleranceFactors.vilazodone}, lamo {modelCards.liveMath.toleranceFactors.lamotrigine}, trazo {modelCards.liveMath.toleranceFactors.trazodone}, levo {modelCards.liveMath.toleranceFactors.levothyroxine}, caffeine {modelCards.liveMath.toleranceFactors.caffeine}.</p>
              <p><strong>Pressure transform right now:</strong> P_clonaz {modelCards.liveMath.pressures.clonazepam}%, P_dox {modelCards.liveMath.pressures.doxylamine}%, P_vila_raw {modelCards.liveMath.pressures.vilazodoneRaw}%, P_lamo_raw {modelCards.liveMath.pressures.lamotrigineRaw}%, P_trazo_raw {modelCards.liveMath.pressures.trazodoneRaw}%, P_levo_raw {modelCards.liveMath.pressures.levothyroxineRaw}%, Counter {modelCards.liveMath.pressures.stimulantCounter}%.</p>
              <p><strong>Sedative weighted components:</strong> {modelCards.liveMath.weightedComponents.sedative.map((item) => `${item.label} ${item.value}%`).join(", ")} → Sedative {modelCards.liveMath.currentSedativePressure}%.</p>
              <p><strong>CYP weighted components:</strong> {modelCards.liveMath.weightedComponents.cyp.map((item) => `${item.label} ${item.value}%`).join(", ")} → CYP {modelCards.liveMath.currentCypOverlap}% → half-life multiplier ×{modelCards.currentCypHalfLifeMultiplier}.</p>
              <p><strong>Serotonin weighted components:</strong> {modelCards.liveMath.weightedComponents.serotonin.map((item) => `${item.label} ${item.value}%`).join(", ")} → 5HT {modelCards.liveMath.currentSerotoninRisk}%.</p>
              <p><strong>Levothyroxine activation:</strong> {modelCards.liveMath.levothyroxineActivation}%.</p>
              <p><strong>Wakefulness drive:</strong> 100 − SleepPenalty {modelCards.liveMath.circadianPenalty}% − 0.25×Sedative + 0.45×Counter + 0.4×LevoAct = {modelCards.liveMath.currentWakefulnessDrive}%.</p>
              <p><strong>Psychomotor impairment:</strong> 0.88×Sedative + 0.18×5HT − 0.12×Counter = {modelCards.liveMath.currentPsychomotorImpairment}%.</p>
              <p><strong>Functional alertness:</strong> Wake − 0.72×Impair = {modelCards.liveMath.currentFunctionalAlertness}%.</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="md:col-span-2 xl:col-span-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3">
          <p className="text-xs text-gray-600 dark:text-gray-400">Card glyph motion is visual only. Quantitative values are in <strong>Active now</strong>, <strong>half-life</strong>, and <strong>Model signal</strong>.</p>
        </div>
        {modelCards.meds.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => setSelectedNodeId((current) => (current === item.id ? null : item.id))}
            className={`text-left rounded-xl border bg-white dark:bg-gray-900 p-4 space-y-3 transition ${selectedNodeId === item.id ? "border-fuchsia-500 ring-2 ring-fuchsia-300 dark:ring-fuchsia-800" : "border-gray-200 dark:border-gray-700"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-gray-900 dark:text-white">{item.name}</h2>
              <span className="text-xs px-2 py-1 rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                {item.entryCount} log{item.entryCount === 1 ? "" : "s"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <MoleculeGlyph intensity={item.pressure} />
              <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                <p>Active now (tracked): <strong>{item.activeAmount.toFixed(item.id === "caffeine" ? 1 : 3)} {item.unit}</strong></p>
                <p>Model signal: <strong>{item.pressure}%</strong></p>
              </div>
            </div>

            {selectedNodeId === item.id && (
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <p>Half-life: <strong>{item.halfLifeHours} h</strong></p>
                {item.effectiveHalfLifeHours !== item.halfLifeHours && (
                  <p>Effective half-life: <strong>{item.effectiveHalfLifeHours} h</strong></p>
                )}
                {item.cypAdjustedActiveAmount !== undefined && item.cypAdjustedActiveAmount !== item.activeAmount && (
                  <p>CYP-adjusted in model: <strong>{item.cypAdjustedActiveAmount.toFixed(3)} {item.unit}</strong></p>
                )}
                <p>{item.model}</p>
              </div>
            )}
            {selectedNodeId !== item.id && (
              <p className="text-xs text-gray-500 dark:text-gray-400">Click card for details</p>
            )}
            <div className="flex flex-wrap gap-2">
              {["clonazepam", "trazodone", "vilazodone"].includes(item.id) && (
                <span className="text-[11px] px-2 py-1 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200">CYP3A4</span>
              )}
              {["trazodone", "vilazodone"].includes(item.id) && (
                <span className="text-[11px] px-2 py-1 rounded-full bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-200">Serotonergic</span>
              )}
              {["caffeine", "levothyroxine"].includes(item.id) && (
                <span className="text-[11px] px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">Wakefulness only</span>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Interaction Network (Estimated)</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Node size reflects current model signal. Click a node or card to isolate its neighborhood. Counter-pressure links do not imply reversal of psychomotor impairment.
        </p>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3 space-y-1">
          <p className="text-xs text-slate-700 dark:text-slate-300"><strong>How to read:</strong> Bigger circles mean a stronger modeled signal for that medication right now.</p>
          <p className="text-xs text-slate-700 dark:text-slate-300"><strong>Line thickness:</strong> Thicker links represent stronger modeled coupling in that channel.</p>
          <p className="text-xs text-slate-700 dark:text-slate-300"><strong>Focus mode:</strong> Click any node or medication card to dim unrelated links and isolate that neighborhood.</p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200">Node: sedative</span>
          <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">Node: modulator</span>
          <span className="px-2 py-1 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200">Node: activator</span>
          <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">Node: counter</span>
          <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200">Sedative stack</span>
          <span className="px-2 py-1 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200">Counter-pressure only</span>
          <span className="px-2 py-1 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200">CYP3A4 overlap proxy</span>
          <span className="px-2 py-1 rounded-full bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-200">Serotonergic risk</span>
        </div>

        {selectedNodeId && (
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-full bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-200">
              Selected: {networkData.nodes.find((node) => node.id === selectedNodeId)?.card?.name || selectedNodeId}
            </span>
            <button
              type="button"
              onClick={() => setSelectedNodeId(null)}
              className="px-2 py-1 rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Clear focus
            </button>
          </div>
        )}

        <div className="w-full overflow-x-auto">
          <svg viewBox="0 0 100 80" className="w-full min-w-[700px] h-[360px] rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950/50">
            {networkData.links.map((link, index) => {
              const source = networkData.nodes.find((node) => node.id === link.source);
              const target = networkData.nodes.find((node) => node.id === link.target);
              if (!source || !target) return null;

              const width = 0.4 + (link.signal / 100) * 2.8;
              const relatedToSelection = !selectedNodeId || link.source === selectedNodeId || link.target === selectedNodeId;
              const baseOpacity = 0.2 + (link.signal / 100) * 0.75;
              const opacity = relatedToSelection ? baseOpacity : 0.08;
              const stroke =
                link.type === "synergy"
                  ? "#a855f7"
                  : link.type === "cyp3a4"
                    ? "#fb7185"
                    : link.type === "serotonin"
                      ? "#d946ef"
                      : "#f59e0b";

              return (
                <motion.line
                  key={`${link.source}-${link.target}-${index}`}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={stroke}
                  strokeWidth={width}
                  strokeOpacity={opacity}
                  strokeLinecap="round"
                  initial={{ pathLength: 0.2, opacity: 0.1 }}
                  animate={{ pathLength: 1, opacity }}
                  transition={{ duration: 1.2, delay: index * 0.01, ease: "easeOut" }}
                />
              );
            })}

            {networkData.nodes.map((node, index) => {
              const pressure = node.card?.pressure || 0;
              const radius = 2.5 + (pressure / 100) * 4.5;
              const relatedToSelection = !selectedNodeId || node.id === selectedNodeId || networkData.links.some((link) => (link.source === selectedNodeId && link.target === node.id) || (link.target === selectedNodeId && link.source === node.id));
              const fill =
                node.group === "counter"
                  ? "#f59e0b"
                  : node.group === "activator"
                    ? "#14b8a6"
                    : node.group === "modulator"
                      ? "#3b82f6"
                      : "#a855f7";

              return (
                <g key={node.id}>
                  <motion.circle
                    cx={node.x}
                    cy={node.y}
                    r={radius}
                    fill={fill}
                    fillOpacity={relatedToSelection ? 0.92 : 0.18}
                    stroke="#111827"
                    strokeOpacity={selectedNodeId === node.id ? 0.8 : 0.2}
                    strokeWidth={selectedNodeId === node.id ? 0.7 : 0.3}
                    initial={{ scale: 0.85 }}
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ repeat: Infinity, duration: 2.6 + index * 0.2, ease: "easeInOut" }}
                    onClick={() => setSelectedNodeId((current) => (current === node.id ? null : node.id))}
                    style={{ cursor: "pointer" }}
                  />
                  <text
                    x={node.x}
                    y={node.y + radius + 3.8}
                    textAnchor="middle"
                    fontSize="2.9"
                    fill={relatedToSelection ? "#e2e8f0" : "#94a3b8"}
                    style={{ fontWeight: 600 }}
                  >
                    {node.card?.name || node.id}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10 p-4 space-y-2">
        <h2 className="font-semibold text-amber-900 dark:text-amber-200">Safety Note</h2>
        <p className="text-sm text-amber-900 dark:text-amber-200">
          This visualization is educational and uses simplified math models from your tracker logs. Clonazepam is metabolized by CYP3A4, but clinically significant drug-drug interactions with vilazodone are not commonly reported. Here, CYP3A4 is shown as an exploratory overlap proxy rather than proof of a clinically significant interaction, while caffeine and levothyroxine remain wakefulness inputs rather than antidotes to sedative impairment.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Further Research & Online Discussion</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Helpful references for interaction-model context and peer communities where people discuss tracking patterns and practical routines.
        </p>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Research</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
            {VISUAL_RESEARCH_LINKS.map((link) => (
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
            {VISUAL_COMMUNITY_LINKS.map((link) => (
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
          Community content may be useful for peer support and practical ideas, but it is not individualized medical advice.
        </p>
      </div>
    </div>
  );
}
