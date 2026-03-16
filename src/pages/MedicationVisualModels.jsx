import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Atom } from "lucide-react";

const ACTIVE_PROFILE_ID_STORAGE_KEY = "caffeineTrackerActiveProfileId";
const PROFILE_STORAGE_KEY = "caffeineTrackerProfilesV1";

const MED_CONFIG = [
  {
    id: "clonazepam",
    name: "Clonazepam",
    storageKey: "clonazepamTrackerByUserV1",
    halfLifeFallback: 30,
    unit: "mg",
    ec50: 0.5,
    model: "Exponential half-life + sedative pressure transform",
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
    unit: "mg",
    ec50: 150,
    model: "Exponential half-life + activation proxy",
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

function activeCaffeineFromEntry(entry, atMs, referenceMs, halfLifeHours) {
  const startMs = getEntryTakenAtMs(entry, referenceMs);
  const durationMs = (entry.durationMinutes || 0) * 60 * 1000;

  if (durationMs <= 0) {
    if (atMs < startMs) return 0;
    const elapsedHours = (atMs - startMs) / 3600000;
    return (entry.caffeineMg || 0) * Math.pow(0.5, elapsedHours / halfLifeHours);
  }

  const samples = Math.max(2, Math.round(durationMs / (5 * 60 * 1000)));
  const sipMg = (entry.caffeineMg || 0) / samples;
  let total = 0;

  for (let i = 0; i < samples; i += 1) {
    const sipMs = startMs + (i / (samples - 1)) * durationMs;
    if (atMs < sipMs) continue;
    const elapsedHours = (atMs - sipMs) / 3600000;
    total += sipMg * Math.pow(0.5, elapsedHours / halfLifeHours);
  }

  return total;
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
    return { entries, halfLifeHours };
  } catch {
    return { entries: [], halfLifeHours: halfLifeFallback };
  }
}

function pressureHill(activeValue, ec50) {
  if (activeValue <= 0) return 0;
  return (activeValue / (activeValue + ec50)) * 100;
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
    return clamp(
      pressureHill(clonazActive, 0.5) * 0.38 + pressureHill(trazodoneActive, 25) * 0.32 + pressureHill(vilazodoneActive, 40) * 0.3,
      0,
      100,
    );
  };

  let clonazActive = activeBolus(clonazEntries, clonazHalfLife, atMs, referenceMs);
  let trazodoneActive = activeBolus(trazodoneEntries, trazodoneHalfLife, atMs, referenceMs);
  let vilazodoneActive = activeBolus(vilazodoneEntries, vilazodoneHalfLife, atMs, referenceMs);
  let congestion = calculateCongestion(clonazActive, trazodoneActive, vilazodoneActive);
  let halfLifeMultiplier = 1;

  for (let i = 0; i < 2; i += 1) {
    halfLifeMultiplier = 1 + (congestion / 100) * 0.85;
    clonazActive = activeBolus(clonazEntries, clonazHalfLife * halfLifeMultiplier, atMs, referenceMs);
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
  const [activeProfileId, setActiveProfileId] = useState(() => {
    const saved = localStorage.getItem(ACTIVE_PROFILE_ID_STORAGE_KEY);
    const loaded = loadProfiles();
    if (saved && loaded.some((profile) => profile.id === saved)) return saved;
    return loaded[0]?.id || "default";
  });

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) || profiles[0] || { id: "default", name: "Default" };

  const modelCards = useMemo(() => {
    const now = Date.now();

    const clonazState = loadByUserState("clonazepamTrackerByUserV1", activeProfile.id, 30);
    const doxylamineState = loadByUserState("doxylamineTrackerByUserV1", activeProfile.id, 10);
    const vilazodoneState = loadByUserState("vilazodoneTrackerByUserV1", activeProfile.id, 25);
    const lamotrigineState = loadByUserState("lamotrigineTrackerByUserV1", activeProfile.id, 29);
    const trazodoneState = loadByUserState("trazodoneTrackerByUserV1", activeProfile.id, 7);
    const levothyroxineState = loadByUserState("levothyroxineTrackerByUserV1", activeProfile.id, 168);

    const cypAdjusted = computeCyp3a4AdjustedActives({
      clonazEntries: clonazState.entries,
      clonazHalfLife: clonazState.halfLifeHours,
      trazodoneEntries: trazodoneState.entries,
      trazodoneHalfLife: trazodoneState.halfLifeHours,
      vilazodoneEntries: vilazodoneState.entries,
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
      const activeAmount =
        med.id === "clonazepam"
          ? cypAdjusted.clonazActive
          : med.id === "trazodone"
            ? cypAdjusted.trazodoneActive
            : med.id === "vilazodone"
              ? cypAdjusted.vilazodoneActive
              : activeBolus(state.entries, state.halfLifeHours, now, now);
      const pressure = pressureHill(activeAmount, med.ec50);

      return {
        ...med,
        halfLifeHours: state.halfLifeHours,
        effectiveHalfLifeHours: ["clonazepam", "trazodone", "vilazodone"].includes(med.id)
          ? Number((state.halfLifeHours * cypAdjusted.halfLifeMultiplier).toFixed(1))
          : state.halfLifeHours,
        entryCount: state.entries.length,
        activeAmount: Number(activeAmount.toFixed(3)),
        pressure: Number(clamp(pressure, 0, 100).toFixed(1)),
      };
    });

    const caffeineEntries = Array.isArray(activeProfile.entries) ? activeProfile.entries : [];
    const caffeineHalfLife = Number(activeProfile.halfLifeHours) > 0 ? Number(activeProfile.halfLifeHours) : 5;
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

    return {
      meds,
      currentCyp3a4Congestion: Number(cypAdjusted.cyp3a4Congestion.toFixed(1)),
      currentCypHalfLifeMultiplier: Number(cypAdjusted.halfLifeMultiplier.toFixed(3)),
    };
  }, [activeProfile]);

  const riskSignals = useMemo(() => {
    const lookup = Object.fromEntries(modelCards.meds.map((item) => [item.id, item]));
    const cyp3a4Congestion = clamp(
      ((lookup.clonazepam?.pressure || 0) * 0.38) +
      ((lookup.trazodone?.pressure || 0) * 0.32) +
      ((lookup.vilazodone?.pressure || 0) * 0.3),
      0,
      100,
    );
    const serotoninRisk = clamp(
      ((lookup.vilazodone?.pressure || 0) * 0.55) + ((lookup.trazodone?.pressure || 0) * 0.7),
      0,
      100,
    );
    const sedativeBurden = clamp(
      ((lookup.clonazepam?.pressure || 0) * 0.42) +
      ((lookup.doxylamine?.pressure || 0) * 0.24) +
      ((lookup.trazodone?.pressure || 0) * 0.16) +
      ((lookup.vilazodone?.pressure || 0) * 0.1) +
      ((lookup.lamotrigine?.pressure || 0) * 0.08),
      0,
      100,
    );
    const wakeDrive = clamp(((lookup.caffeine?.pressure || 0) * 0.75) + ((lookup.levothyroxine?.pressure || 0) * 0.45), 0, 100);
    const awakeButImpaired = clamp((sedativeBurden * 0.88) + (cyp3a4Congestion * 0.25) - (wakeDrive * 0.12), 0, 100);

    return { cyp3a4Congestion, serotoninRisk, sedativeBurden, wakeDrive, awakeButImpaired };
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

  const switchActiveProfile = (nextProfileId) => {
    if (!profiles.some((profile) => profile.id === nextProfileId)) return;
    setActiveProfileId(nextProfileId);
    localStorage.setItem(ACTIVE_PROFILE_ID_STORAGE_KEY, nextProfileId);
    setProfiles(loadProfiles());
    setSelectedNodeId(null);
  };

  return (
    <div className="w-full px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Atom className="w-8 h-8 text-fuchsia-600 dark:text-fuchsia-400" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Medication Visual Models</h1>
          <p className="text-gray-600 dark:text-gray-400">Animated visual model cards for clonazepam, doxylamine, vilazodone, lamotrigine, trazodone, levothyroxine, and caffeine.</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <label className="space-y-1 block max-w-sm">
          <span className="text-sm text-gray-700 dark:text-gray-300">User</span>
          <select
            value={activeProfileId}
            onChange={(e) => switchActiveProfile(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.name || "User"}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50/70 dark:bg-red-950/20 p-4 space-y-1">
          <h2 className="font-semibold text-red-900 dark:text-red-200">Awake but Impaired</h2>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">{riskSignals.awakeButImpaired.toFixed(1)}%</p>
          <p className="text-xs text-red-800 dark:text-red-200">Stimulants can increase wakefulness without restoring coordination, judgment, or reaction time.</p>
        </div>
        <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50/70 dark:bg-orange-950/20 p-4 space-y-1">
          <h2 className="font-semibold text-orange-900 dark:text-orange-200">CYP3A4 Congestion</h2>
          <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{modelCards.currentCyp3a4Congestion.toFixed(1)}%</p>
          <p className="text-xs text-orange-800 dark:text-orange-200">This now feeds back into elimination as an effective half-life multiplier of ×{modelCards.currentCypHalfLifeMultiplier} for clonazepam, trazodone, and vilazodone.</p>
        </div>
        <div className="rounded-xl border border-fuchsia-200 dark:border-fuchsia-800 bg-fuchsia-50/70 dark:bg-fuchsia-950/20 p-4 space-y-1">
          <h2 className="font-semibold text-fuchsia-900 dark:text-fuchsia-200">Serotonergic Overlap</h2>
          <p className="text-2xl font-bold text-fuchsia-700 dark:text-fuchsia-300">{riskSignals.serotoninRisk.toFixed(1)}%</p>
          <p className="text-xs text-fuchsia-800 dark:text-fuchsia-200">Vilazodone + trazodone are treated as a separate clinical-risk channel, not just sedation.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
                <p>Active now: <strong>{item.activeAmount.toFixed(item.id === "caffeine" ? 1 : 3)} {item.unit}</strong></p>
                <p>Half-life: <strong>{item.halfLifeHours} h</strong></p>
                {item.effectiveHalfLifeHours !== item.halfLifeHours && (
                  <p>Effective half-life: <strong>{item.effectiveHalfLifeHours} h</strong></p>
                )}
                <p>Model signal: <strong>{item.pressure}%</strong></p>
              </div>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-400">{item.model}</p>
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

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200">Sedative stack</span>
          <span className="px-2 py-1 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200">Counter-pressure only</span>
          <span className="px-2 py-1 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200">CYP3A4 congestion</span>
          <span className="px-2 py-1 rounded-full bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-200">Serotonergic risk</span>
        </div>

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
                    fill={relatedToSelection ? "#111827" : "#6b7280"}
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
          This visualization is educational and uses simplified math models from your tracker logs. It now treats caffeine and levothyroxine as wakefulness inputs, not antidotes to sedative impairment, and surfaces CYP3A4 and serotonergic overlap as separate risk channels.
        </p>
      </div>
    </div>
  );
}
