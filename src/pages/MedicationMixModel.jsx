import React, { useMemo, useState } from "react";
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

const ACTIVE_PROFILE_ID_STORAGE_KEY = "caffeineTrackerActiveProfileId";
const PROFILE_STORAGE_KEY = "caffeineTrackerProfilesV1";
const CLONAZEPAM_BY_USER_STORAGE_KEY = "clonazepamTrackerByUserV1";
const DOXYLAMINE_BY_USER_STORAGE_KEY = "doxylamineTrackerByUserV1";
const VILAZODONE_BY_USER_STORAGE_KEY = "vilazodoneTrackerByUserV1";
const LAMOTRIGINE_BY_USER_STORAGE_KEY = "lamotrigineTrackerByUserV1";
const TRAZODONE_BY_USER_STORAGE_KEY = "trazodoneTrackerByUserV1";
const LEVOTHYROXINE_BY_USER_STORAGE_KEY = "levothyroxineTrackerByUserV1";

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

function activeCaffeineFromEntry(entry, atMs, referenceMs, halfLifeHours) {
  const startMs = getEntryTakenAtMs(entry, referenceMs);
  const durationMs = (entry.durationMinutes || 0) * 60 * 1000;

  if (durationMs <= 0) {
    if (atMs < startMs) return 0;
    const elapsedHours = (atMs - startMs) / (1000 * 60 * 60);
    return (entry.caffeineMg || 0) * Math.pow(0.5, elapsedHours / halfLifeHours);
  }

  const samples = Math.max(2, Math.round(durationMs / (5 * 60 * 1000)));
  const sipMg = (entry.caffeineMg || 0) / samples;
  let total = 0;
  for (let i = 0; i < samples; i += 1) {
    const sipMs = startMs + (i / (samples - 1)) * durationMs;
    if (atMs < sipMs) continue;
    const elapsedHours = (atMs - sipMs) / (1000 * 60 * 60);
    total += sipMg * Math.pow(0.5, elapsedHours / halfLifeHours);
  }
  return total;
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
    return { entries, halfLifeHours, daysAtCurrentDose };
  } catch {
    return { entries: [], halfLifeHours: fallbackHalfLife, daysAtCurrentDose: 0 };
  }
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

function toleranceFactorFromDays(daysAtDose, maxReduction, tauDays) {
  const days = Math.max(0, Number(daysAtDose) || 0);
  return 1 - maxReduction * (1 - Math.exp(-days / tauDays));
}

function toleranceReductionPercent(factor) {
  return Math.max(0, (1 - factor) * 100);
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

  let clonazActive = activeBolusMg(clonazEntries, clonazHalfLife, atMs, referenceMs);
  let trazodoneActive = activeBolusMg(trazodoneEntries, trazodoneHalfLife, atMs, referenceMs);
  let vilazodoneActive = activeBolusMg(vilazodoneEntries, vilazodoneHalfLife, atMs, referenceMs);
  let congestion = calculateCongestion(clonazActive, trazodoneActive, vilazodoneActive);
  let halfLifeMultiplier = 1;

  for (let i = 0; i < 2; i += 1) {
    halfLifeMultiplier = 1 + (congestion / 100) * 0.85;
    clonazActive = activeBolusMg(clonazEntries, clonazHalfLife * halfLifeMultiplier, atMs, referenceMs);
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
    const saved = localStorage.getItem(ACTIVE_PROFILE_ID_STORAGE_KEY);
    const loaded = loadProfilesFromStorage();
    if (saved && loaded.some((profile) => profile.id === saved)) return saved;
    return loaded[0]?.id || "default";
  });
  const [recalcAt, setRecalcAt] = useState(() => Date.now());

  const switchActiveProfile = (nextProfileId) => {
    if (!profiles.some((profile) => profile.id === nextProfileId)) return;
    setActiveProfileId(nextProfileId);
    localStorage.setItem(ACTIVE_PROFILE_ID_STORAGE_KEY, nextProfileId);
    setProfiles(loadProfilesFromStorage());
    setRecalcAt(Date.now());
  };

  const modelData = useMemo(() => {
    const activeProfile = profiles.find((profile) => profile.id === activeProfileId) || null;

    const clonaz = loadByUserState(CLONAZEPAM_BY_USER_STORAGE_KEY, activeProfileId, 30);
    const doxylamine = loadByUserState(DOXYLAMINE_BY_USER_STORAGE_KEY, activeProfileId, 10);
    const vilazodone = loadByUserState(VILAZODONE_BY_USER_STORAGE_KEY, activeProfileId, 25);
    const lamotrigine = loadByUserState(LAMOTRIGINE_BY_USER_STORAGE_KEY, activeProfileId, 29);
    const trazodone = loadByUserState(TRAZODONE_BY_USER_STORAGE_KEY, activeProfileId, 7);
    const levothyroxine = loadByUserState(LEVOTHYROXINE_BY_USER_STORAGE_KEY, activeProfileId, 168);

    const caffeineEntries = Array.isArray(activeProfile?.entries) ? activeProfile.entries : [];
    const caffeineHalfLife = Number(activeProfile?.halfLifeHours) > 0 ? Number(activeProfile.halfLifeHours) : 5;
    const caffeineDaysAtDose = Math.max(0, Number(activeProfile?.daysAtDose) || 0);
    const weightKg = (() => {
      const w = Number(activeProfile?.weight);
      const unit = activeProfile?.weightUnit || "lb";
      if (!w || w <= 0) return 70;
      return unit === "lb" ? w * 0.45359237 : w;
    })();

    const now = recalcAt;
    const candidateTimes = [
      ...clonaz.entries.map((e) => getEntryTakenAtMs(e, now)),
      ...doxylamine.entries.map((e) => getEntryTakenAtMs(e, now)),
      ...vilazodone.entries.map((e) => getEntryTakenAtMs(e, now)),
      ...lamotrigine.entries.map((e) => getEntryTakenAtMs(e, now)),
      ...trazodone.entries.map((e) => getEntryTakenAtMs(e, now)),
      ...levothyroxine.entries.map((e) => getEntryTakenAtMs(e, now)),
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
        clonazEntries: clonaz.entries,
        clonazHalfLife: clonaz.halfLifeHours,
        trazodoneEntries: trazodone.entries,
        trazodoneHalfLife: trazodone.halfLifeHours,
        vilazodoneEntries: vilazodone.entries,
        vilazodoneHalfLife: vilazodone.halfLifeHours,
        atMs: t,
        referenceMs: now,
      });

      const clonazActive = cypAdjusted.clonazActive;
      const doxActive = activeBolusMg(doxylamine.entries, doxylamine.halfLifeHours, t, now);
      const vilaActive = cypAdjusted.vilazodoneActive;
      const lamoActive = activeBolusMg(lamotrigine.entries, lamotrigine.halfLifeHours, t, now);
      const trazoActive = cypAdjusted.trazodoneActive;
      const levoActive = activeBolusMg(levothyroxine.entries, levothyroxine.halfLifeHours, t, now);

      const clonazPressure = pressureHill(clonazActive, 0.5);
      const doxPressure = pressureHill(doxActive, 6);
      const vilaPressureRaw = pressureHill(vilaActive, 40);
      const lamoPressureRaw = pressureHill(lamoActive, 60);
      const trazoPressureRaw = pressureHill(trazoActive, 25);
      const levoActivationRaw = pressureHill(levoActive, 150) * 0.12;

      const doxToleranceFactor = toleranceFactorFromDays(doxylamine.daysAtCurrentDose, 0.25, 8);
      const vilaToleranceFactor = toleranceFactorFromDays(vilazodone.daysAtCurrentDose, 0.15, 18);
      const lamoToleranceFactor = toleranceFactorFromDays(lamotrigine.daysAtCurrentDose, 0.08, 24);
      const trazoToleranceFactor = toleranceFactorFromDays(trazodone.daysAtCurrentDose, 0.28, 10);
      const levoToleranceFactor = toleranceFactorFromDays(levothyroxine.daysAtCurrentDose, 0.12, 30);

      const clonazPressureAdjusted = clonazPressure * clonazToleranceFactor;
      const doxPressureAdjusted = doxPressure * doxToleranceFactor;
      const vilaPressure = vilaPressureRaw * vilaToleranceFactor * 0.25;
      const lamoPressure = lamoPressureRaw * lamoToleranceFactor * 0.15;
      const trazoPressure = trazoPressureRaw * trazoToleranceFactor * 0.2;
      const levoActivation = levoActivationRaw * levoToleranceFactor;

      const cyp3a4Congestion = cypAdjusted.cyp3a4Congestion;
      const serotoninRisk = clamp(vilaPressureRaw * 0.55 + trazoPressureRaw * 0.7, 0, 100);

      const sedativePressure = clamp(
        0.42 * clonazPressureAdjusted + 0.24 * doxPressureAdjusted + 0.1 * vilaPressure + 0.08 * lamoPressure + 0.16 * trazoPressure,
        0,
        100,
      );

      const caffeineActiveMg = caffeineEntries.reduce((sum, entry) => {
        return sum + activeCaffeineFromEntry(entry, t, now, caffeineHalfLife);
      }, 0);
      const caffeineMgPerKg = weightKg > 0 ? caffeineActiveMg / weightKg : 0;
      const stimulantCounterPressure = pressureHill(caffeineMgPerKg * caffeineToleranceFactor, 2.0);

      const wakefulnessDrive = clamp(100 - circadianPenalty(t, 30, 0) - sedativePressure * 0.25 + stimulantCounterPressure * 0.45 + levoActivation * 0.4, 0, 100);
      const psychomotorImpairment = clamp(
        sedativePressure * 0.88 + cyp3a4Congestion * 0.24 + serotoninRisk * 0.18 - stimulantCounterPressure * 0.12,
        0,
        100,
      );
      const functionalAlertness = clamp(wakefulnessDrive - psychomotorImpairment * 0.72, 0, 100);
      const netCnsLoad = clamp(sedativePressure + psychomotorImpairment * 0.35 - stimulantCounterPressure * 0.18 - levoActivation * 0.1, -100, 100);

      points.push({
        ts: t,
        sedativePressure: Number(sedativePressure.toFixed(1)),
        stimulantCounterPressureNeg: Number((-stimulantCounterPressure).toFixed(1)),
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
        levothyroxineReduction: Number(toleranceReductionPercent(levoToleranceFactor).toFixed(1)),
        caffeineToleranceReduction: Number(toleranceReductionPercent(caffeineToleranceFactor).toFixed(1)),
        netCnsLoad: Number(netCnsLoad.toFixed(1)),
        alertness: Number(functionalAlertness.toFixed(1)),
      });
    }

    const nowPoint = points.reduce((best, point) => {
      if (!best) return point;
      return Math.abs(point.ts - now) < Math.abs(best.ts - now) ? point : best;
    }, null);

    const currentCypAdjusted = computeCyp3a4AdjustedActives({
      clonazEntries: clonaz.entries,
      clonazHalfLife: clonaz.halfLifeHours,
      trazodoneEntries: trazodone.entries,
      trazodoneHalfLife: trazodone.halfLifeHours,
      vilazodoneEntries: vilazodone.entries,
      vilazodoneHalfLife: vilazodone.halfLifeHours,
      atMs: now,
      referenceMs: now,
    });

    const clonazNowMg = currentCypAdjusted.clonazActive;
    const doxylamineNowMg = activeBolusMg(doxylamine.entries, doxylamine.halfLifeHours, now, now);
    const vilazodoneNowMg = currentCypAdjusted.vilazodoneActive;
    const lamotrigineNowMg = activeBolusMg(lamotrigine.entries, lamotrigine.halfLifeHours, now, now);
    const trazodoneNowMg = currentCypAdjusted.trazodoneActive;
    const levothyroxineNowMg = activeBolusMg(levothyroxine.entries, levothyroxine.halfLifeHours, now, now);
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

    const confidence = activeDrugCount >= 5 ? "Medium" : activeDrugCount >= 3 ? "Low" : "Very Low";
    const currentCyp3a4Congestion = currentCypAdjusted.cyp3a4Congestion;
    const currentSerotoninRisk = clamp(
      pressureHill(vilazodoneNowMg, 40) * 0.55 + pressureHill(trazodoneNowMg, 25) * 0.7,
      0,
      100,
    );
    const currentDoxToleranceFactor = toleranceFactorFromDays(doxylamine.daysAtCurrentDose, 0.25, 8);
    const currentVilaToleranceFactor = toleranceFactorFromDays(vilazodone.daysAtCurrentDose, 0.15, 18);
    const currentLamoToleranceFactor = toleranceFactorFromDays(lamotrigine.daysAtCurrentDose, 0.08, 24);
    const currentTrazoToleranceFactor = toleranceFactorFromDays(trazodone.daysAtCurrentDose, 0.28, 10);
    const currentLevoToleranceFactor = toleranceFactorFromDays(levothyroxine.daysAtCurrentDose, 0.12, 30);

    return {
      points,
      nowPoint,
      activeProfileName: activeProfile?.name || "Default",
      nowAmounts: {
        clonazepamMg: Number(clonazNowMg.toFixed(3)),
        doxylamineMg: Number(doxylamineNowMg.toFixed(3)),
        vilazodoneMg: Number(vilazodoneNowMg.toFixed(3)),
        lamotrigineMg: Number(lamotrigineNowMg.toFixed(3)),
        trazodoneMg: Number(trazodoneNowMg.toFixed(3)),
        levothyroxineMg: Number(levothyroxineNowMg.toFixed(3)),
        caffeineMg: Number(caffeineNowMg.toFixed(1)),
        caffeineMgPerKg: Number(caffeineNowMgPerKg.toFixed(3)),
      },
      currentCyp3a4Congestion: Number(currentCyp3a4Congestion.toFixed(1)),
      currentSerotoninRisk: Number(currentSerotoninRisk.toFixed(1)),
      currentCypHalfLifeMultiplier: Number(currentCypAdjusted.halfLifeMultiplier.toFixed(3)),
      toleranceSummary: {
        clonazepamReduction: Number(toleranceReductionPercent(clonazToleranceFactor).toFixed(1)),
        doxylamineReduction: Number(toleranceReductionPercent(currentDoxToleranceFactor).toFixed(1)),
        vilazodoneReduction: Number(toleranceReductionPercent(currentVilaToleranceFactor).toFixed(1)),
        lamotrigineReduction: Number(toleranceReductionPercent(currentLamoToleranceFactor).toFixed(1)),
        trazodoneReduction: Number(toleranceReductionPercent(currentTrazoToleranceFactor).toFixed(1)),
        levothyroxineReduction: Number(toleranceReductionPercent(currentLevoToleranceFactor).toFixed(1)),
        caffeineReduction: Number(toleranceReductionPercent(caffeineToleranceFactor).toFixed(1)),
      },
      confidence,
    };
  }, [recalcAt, activeProfileId, profiles]);

  const chartTicks = useMemo(() => {
    if (!modelData.points.length) return [];
    const s = modelData.points[0].ts;
    const e = modelData.points[modelData.points.length - 1].ts;
    const hr = 3600000;
    const out = [];
    for (let t = Math.ceil(s / hr) * hr; t <= e; t += hr) out.push(t);
    return out;
  }, [modelData.points]);

  return (
    <div className="w-full px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="w-8 h-8 text-fuchsia-600 dark:text-fuchsia-400" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Medication Mix Model</h1>
          <p className="text-gray-600 dark:text-gray-400">Estimate combined impairment, wakefulness, CYP3A4 congestion, and serotonergic overlap from your tracked medications.</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="space-y-1">
            <span className="text-sm text-gray-700 dark:text-gray-300">User</span>
            <select
              value={activeProfileId}
              onChange={(e) => switchActiveProfile(e.target.value)}
              className="w-full sm:w-72 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            >
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.name || "User"}</option>
              ))}
            </select>
          </label>
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
          <div className="space-y-1 text-gray-900 dark:text-white text-sm">
            <p>Estimated sedative pressure now: <strong>{modelData.nowPoint.sedativePressure}%</strong></p>
            <p>Caffeine counter-pressure now: <strong>{Math.abs(modelData.nowPoint.stimulantCounterPressureNeg)}%</strong></p>
            <p>Wakefulness drive now: <strong>{modelData.nowPoint.wakefulnessDrive}%</strong></p>
            <p>Psychomotor impairment now: <strong>{modelData.nowPoint.psychomotorImpairment}%</strong></p>
            <p>Functional alertness now: <strong>{modelData.nowPoint.alertness}%</strong></p>
            <p>Tolerance-adjusted sedative dampening now: <strong>{Math.max(modelData.toleranceSummary?.clonazepamReduction || 0, modelData.toleranceSummary?.doxylamineReduction || 0, modelData.toleranceSummary?.trazodoneReduction || 0)}%</strong></p>
            <p>CYP3A4 congestion now: <strong>{modelData.currentCyp3a4Congestion}%</strong></p>
            <p>CYP-adjusted half-life multiplier now: <strong>×{modelData.currentCypHalfLifeMultiplier}</strong></p>
            <p>Serotonergic overlap now: <strong>{modelData.currentSerotoninRisk}%</strong></p>
            <p>Model confidence: <strong>{modelData.confidence}</strong></p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50/70 dark:bg-red-950/20 p-4 space-y-1">
          <h2 className="font-semibold text-red-900 dark:text-red-200">Wide-awake but Impaired</h2>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">{modelData.nowPoint?.psychomotorImpairment ?? 0}%</p>
          <p className="text-xs text-red-800 dark:text-red-200">Stimulants can raise wakefulness while leaving coordination, reaction time, and judgment impaired.</p>
        </div>
        <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50/70 dark:bg-orange-950/20 p-4 space-y-1">
          <h2 className="font-semibold text-orange-900 dark:text-orange-200">CYP3A4 Traffic</h2>
          <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{modelData.currentCyp3a4Congestion}%</p>
          <p className="text-xs text-orange-800 dark:text-orange-200">Clonazepam, trazodone, and vilazodone are treated as a shared metabolism bottleneck proxy.</p>
        </div>
        <div className="rounded-xl border border-fuchsia-200 dark:border-fuchsia-800 bg-fuchsia-50/70 dark:bg-fuchsia-950/20 p-4 space-y-1">
          <h2 className="font-semibold text-fuchsia-900 dark:text-fuchsia-200">Serotonergic Risk Channel</h2>
          <p className="text-2xl font-bold text-fuchsia-700 dark:text-fuchsia-300">{modelData.currentSerotoninRisk}%</p>
          <p className="text-xs text-fuchsia-800 dark:text-fuchsia-200">Vilazodone and trazodone are tracked separately from sedation to reflect non-sedative interaction risk.</p>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/20 p-4 space-y-3">
        <h2 className="font-semibold text-blue-900 dark:text-blue-200">Tolerance Buildup</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm text-blue-900 dark:text-blue-100">
          <p>Clonazepam effect reduction: <strong>{modelData.toleranceSummary?.clonazepamReduction ?? 0}%</strong></p>
          <p>Doxylamine effect reduction: <strong>{modelData.toleranceSummary?.doxylamineReduction ?? 0}%</strong></p>
          <p>Vilazodone sedation reduction: <strong>{modelData.toleranceSummary?.vilazodoneReduction ?? 0}%</strong></p>
          <p>Lamotrigine modulation reduction: <strong>{modelData.toleranceSummary?.lamotrigineReduction ?? 0}%</strong></p>
          <p>Trazodone effect reduction: <strong>{modelData.toleranceSummary?.trazodoneReduction ?? 0}%</strong></p>
          <p>Levothyroxine activation reduction: <strong>{modelData.toleranceSummary?.levothyroxineReduction ?? 0}%</strong></p>
          <p>Caffeine wakefulness reduction: <strong>{modelData.toleranceSummary?.caffeineReduction ?? 0}%</strong></p>
        </div>
        <p className="text-xs text-blue-800 dark:text-blue-200">
          Clonazepam, doxylamine, vilazodone, lamotrigine, trazodone, and caffeine now use saved tracker tolerance inputs. Tolerance dampens subjective effect, not concentration-based risk.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Combined CNS Load (Estimated)</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Purple = sedative burden, amber = caffeine wakefulness input, rose = psychomotor impairment floor, cyan = wakefulness drive, teal = functional alertness.
        </p>
        {modelData.points.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">Add doses in the medication/caffeine trackers to view the combined model.</p>
        ) : (
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
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
                <YAxis domain={[-100, 100]} tickFormatter={(value) => `${value}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }}
                  labelStyle={{ color: "#f9fafb", fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: "#d1d5db" }}
                  labelFormatter={(value) => `🕐 ${new Date(value).toLocaleString([], { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
                  formatter={(value, name) => {
                    if (name === "sedativePressure") return [`${value}%`, "Sedative pressure"];
                    if (name === "stimulantCounterPressureNeg") return [`${Math.abs(value)}%`, "Caffeine counter-pressure"];
                    if (name === "psychomotorImpairment") return [`${value}%`, "Psychomotor impairment"];
                    if (name === "wakefulnessDrive") return [`${value}%`, "Wakefulness drive"];
                    if (name === "netCnsLoad") return [`${value}%`, "Net CNS load"];
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
                <Line type="monotone" dataKey="stimulantCounterPressureNeg" name="stimulantCounterPressureNeg" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="psychomotorImpairment" name="psychomotorImpairment" stroke="#fb7185" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="wakefulnessDrive" name="wakefulnessDrive" stroke="#06b6d4" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="alertness" name="alertness" stroke="#14b8a6" strokeWidth={2} strokeDasharray="5 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Drug List</h2>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200">Tranquilizing</span>
          <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">Stimulating</span>
          <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">Modulating / mixed</span>
        </div>
        <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
          <li className="text-purple-700 dark:text-purple-300">Clonazepam: {modelData.nowAmounts?.clonazepamMg?.toFixed(3) ?? "0.000"} mg active now</li>
          <li className="text-purple-700 dark:text-purple-300">Doxylamine: {modelData.nowAmounts?.doxylamineMg?.toFixed(3) ?? "0.000"} mg active now</li>
          <li className="text-blue-700 dark:text-blue-300">Vilazodone: {modelData.nowAmounts?.vilazodoneMg?.toFixed(3) ?? "0.000"} mg active now</li>
          <li className="text-blue-700 dark:text-blue-300">Lamotrigine: {modelData.nowAmounts?.lamotrigineMg?.toFixed(3) ?? "0.000"} mg active now</li>
          <li className="text-purple-700 dark:text-purple-300">Trazodone: {modelData.nowAmounts?.trazodoneMg?.toFixed(3) ?? "0.000"} mg active now</li>
          <li className="text-amber-700 dark:text-amber-300">Levothyroxine: {modelData.nowAmounts?.levothyroxineMg?.toFixed(3) ?? "0.000"} mg active now</li>
          <li className="text-amber-700 dark:text-amber-300">Caffeine: {modelData.nowAmounts?.caffeineMg?.toFixed(1) ?? "0.0"} mg active now ({modelData.nowAmounts?.caffeineMgPerKg?.toFixed(3) ?? "0.000"} mg/kg)</li>
        </ul>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Math Model</h2>
        <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 space-y-2">
          <p><strong>Assumptions:</strong> This model is exploratory, not clinical dosing guidance. Values are simplified response proxies, not serum concentration predictions.</p>
          <p><strong>Per-drug elimination:</strong> Active_drug(t) = Σ Dose_i × 0.5^((t − t_i)/halfLife_drug)</p>
          <p><strong>Dynamic CYP feedback:</strong> halfLife_eff = halfLife_base × (1 + 0.85×CYP/100) for clonazepam, trazodone, and vilazodone.</p>
          <p><strong>Pressure transform:</strong> Pressure_drug = 100 × Active_drug / (Active_drug + EC50_drug)</p>
          <p><strong>Tolerance transform:</strong> Effect_drug = Pressure_drug × ToleranceFactor_drug, where ToleranceFactor = 1 − maxReduction×(1 − e^(−days/τ))</p>
          <p><strong>Sedative pressure blend:</strong> Sedative = clamp(0.42×P_clonaz + 0.24×P_dox + 0.1×P_vila + 0.08×P_lamo + 0.16×P_trazo, 0, 100)</p>
          <p><strong>CYP3A4 congestion proxy:</strong> CYP = clamp(0.38×P_clonaz + 0.32×P_trazo_raw + 0.30×P_vila_raw, 0, 100)</p>
          <p><strong>Serotonin overlap proxy:</strong> 5HT = clamp(0.55×P_vila_raw + 0.70×P_trazo_raw, 0, 100)</p>
          <p><strong>Caffeine wakefulness input:</strong> C = ActiveCaffeine_mg / weight_kg × ToleranceFactor_caffeine, Counter = 100 × C/(C + 2.0)</p>
          <p><strong>Levothyroxine activation proxy:</strong> LevoAct = 0.12 × [100 × Active_levo/(Active_levo + 150)] × ToleranceFactor_levo</p>
          <p><strong>Wakefulness drive:</strong> Wake = clamp(100 − SleepPenalty − 0.25×Sedative + 0.45×Counter + 0.4×LevoAct, 0, 100)</p>
          <p><strong>Psychomotor impairment floor:</strong> Impair = clamp(0.88×Sedative + 0.24×CYP + 0.18×5HT − 0.12×Counter, 0, 100)</p>
          <p><strong>Functional alertness:</strong> Functional = clamp(Wake − 0.72×Impair, 0, 100)</p>
          <p><strong>Circadian penalty:</strong> SleepPenalty = 30 × ((cos(2π × (hour−3)/24) + 1)/2)</p>
          <p><strong>Why this differs from a simple cancel-out model:</strong> stimulant inputs can increase wakefulness, but they only minimally reduce impairment in this version.</p>
          <p><strong>Saved tolerance inputs:</strong> clonazepam, doxylamine, vilazodone, lamotrigine, trazodone, and caffeine use stored days-at-dose style values from their tracker pages.</p>
          <p><strong>Default EC50 constants:</strong> clonaz=0.5, doxylamine=6, vilazodone=40, lamotrigine=60, trazodone=25, levothyroxine=150, caffeine(counter)=2.0 mg/kg</p>
        </div>
      </div>

      <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10 p-4 space-y-2">
        <h2 className="font-semibold text-amber-900 dark:text-amber-200">Safety Note</h2>
        <p className="text-sm text-amber-900 dark:text-amber-200">
          This is an educational approximation, not medical guidance. The model now explicitly feeds CYP3A4 congestion back into the effective half-lives of clonazepam, trazodone, and vilazodone, while still treating caffeine as wakefulness input rather than restoration of safe function. Real interaction risk still depends on diagnosis, prescribed regimen, organ function, timing, and other substances including alcohol or opioids.
        </p>
      </div>
    </div>
  );
}
