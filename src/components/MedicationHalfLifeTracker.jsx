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

const PROFILE_STORAGE_KEY = "caffeineTrackerProfilesV1";
const ACTIVE_PROFILE_ID_STORAGE_KEY = "caffeineTrackerActiveProfileId";
const WELLNESS_GLOBAL_USER_NAME_KEY = "wellnessGlobalUserName";

function getNowLocalDateTimeValue() {
  const d = new Date();
  const offsetMs = d.getTimezoneOffset() * 60 * 1000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
}

function getEntryTakenAtMs(entry, referenceMs = Date.now()) {
  const explicitMs = Number(entry?.takenAtMs);
  if (Number.isFinite(explicitMs) && explicitMs > 0) return explicitMs;
  if (entry?.takenAtIso) {
    const isoMs = new Date(entry.takenAtIso).getTime();
    if (Number.isFinite(isoMs) && isoMs > 0) return isoMs;
  }
  if (typeof entry?.time === "string" && entry.time.includes("T")) {
    const parsed = new Date(entry.time).getTime();
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return referenceMs;
}

function formatDoseTimestamp(entry, referenceMs = Date.now()) {
  const ts = getEntryTakenAtMs(entry, referenceMs);
  return new Date(ts).toLocaleString([], {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function loadProfiles() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "[]");
    if (Array.isArray(raw) && raw.length > 0) return raw;
  } catch {
    // no-op
  }
  return [{ id: "default", name: "Default" }];
}

function toleranceFactorFromDays(daysAtCurrentDose, maxReduction = 0.25, tauDays = 10) {
  const days = Math.max(0, Number(daysAtCurrentDose) || 0);
  return 1 - maxReduction * (1 - Math.exp(-days / tauDays));
}

function buildModeledEntries(entries, daysAtCurrentDose, referenceMs) {
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) => getEntryTakenAtMs(b, referenceMs) - getEntryTakenAtMs(a, referenceMs));
  const latest = sorted[0];
  const latestTs = getEntryTakenAtMs(latest, referenceMs);
  const latestDate = new Date(latestTs);
  const h = latestDate.getHours();
  const m = latestDate.getMinutes();
  const doseMg = Number(latest?.doseMg) || 0;
  if (doseMg <= 0) return entries;

  const priorDays = Math.max(0, Math.round(Number(daysAtCurrentDose) || 0));
  if (priorDays <= 0) return entries;

  const maxSyntheticDays = 120;
  const syntheticCount = Math.min(priorDays, maxSyntheticDays);
  const syntheticEntries = [];

  for (let day = 1; day <= syntheticCount; day += 1) {
    const d = new Date(referenceMs);
    d.setDate(d.getDate() - day);
    d.setHours(h, m, 0, 0);
    syntheticEntries.push({
      id: `synthetic-${day}`,
      doseMg,
      takenAtMs: d.getTime(),
      takenAtIso: d.toISOString(),
      synthetic: true,
    });
  }

  return [...entries, ...syntheticEntries];
}

export default function MedicationHalfLifeTracker({
  title,
  subtitle,
  storagePrefix,
  halfLifeOptions,
  defaultHalfLifeHours,
  defaultDoseMg = 0.25,
  doseUnit = "mg",
  doseStep = "0.125",
  doseMin = "0.125",
  showToleranceTracking = false,
  toleranceMaxReduction = 0.25,
  toleranceTauDays = 10,
  toleranceReductionLabel = "Estimated effect reduction",
}) {
  const STORAGE_BY_USER_KEY = `${storagePrefix}ByUserV1`;

  const [profiles, setProfiles] = useState(() => loadProfiles());
  const [activeProfileId, setActiveProfileId] = useState(() => {
    const globalUserName = localStorage.getItem(WELLNESS_GLOBAL_USER_NAME_KEY);
    const loaded = loadProfiles();

    if (globalUserName) {
      const existingProfile = loaded.find((p) => p.name === globalUserName);
      if (existingProfile) {
        return existingProfile.id;
      }
    }

    const saved = localStorage.getItem(ACTIVE_PROFILE_ID_STORAGE_KEY);
    if (saved && loaded.some((p) => p.id === saved)) return saved;
    return loaded[0]?.id || "default";
  });

  const loadStateForUser = (profileId) => {
    try {
      const byUser = JSON.parse(localStorage.getItem(STORAGE_BY_USER_KEY) || "{}");
      const state = byUser?.[profileId] || {};
      const entries = Array.isArray(state.entries) ? state.entries : [];
      const parsedHalfLife = Number(state.halfLifeHours);
      const halfLifeHours = halfLifeOptions.includes(parsedHalfLife) ? parsedHalfLife : defaultHalfLifeHours;
      const parsedDaysAtCurrentDose = Number(state.daysAtCurrentDose);
      const daysAtCurrentDose = Number.isFinite(parsedDaysAtCurrentDose) && parsedDaysAtCurrentDose >= 0 ? parsedDaysAtCurrentDose : 0;
      return { entries, halfLifeHours, daysAtCurrentDose };
    } catch {
      return { entries: [], halfLifeHours: defaultHalfLifeHours, daysAtCurrentDose: 0 };
    }
  };

  const initialState = loadStateForUser(activeProfileId);
  const [doseMg, setDoseMg] = useState(defaultDoseMg);
  const [time, setTime] = useState(getNowLocalDateTimeValue());
  const [entries, setEntries] = useState(initialState.entries);
  const [halfLifeHours, setHalfLifeHours] = useState(initialState.halfLifeHours);
  const [daysAtCurrentDose, setDaysAtCurrentDose] = useState(initialState.daysAtCurrentDose);
  const [recalcAt, setRecalcAt] = useState(() => Date.now());

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId) || profiles[0] || null,
    [profiles, activeProfileId],
  );

  useEffect(() => {
    const refreshStartTimeToNow = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      setTime(getNowLocalDateTimeValue());
    };

    window.addEventListener("focus", refreshStartTimeToNow);
    document.addEventListener("visibilitychange", refreshStartTimeToNow);

    return () => {
      window.removeEventListener("focus", refreshStartTimeToNow);
      document.removeEventListener("visibilitychange", refreshStartTimeToNow);
    };
  }, []);

  const saveUserState = (
    nextEntries,
    nextHalfLife = halfLifeHours,
    profileId = activeProfileId,
    nextDaysAtCurrentDose = daysAtCurrentDose,
  ) => {
    try {
      const byUser = JSON.parse(localStorage.getItem(STORAGE_BY_USER_KEY) || "{}");
      byUser[profileId] = {
        entries: nextEntries,
        halfLifeHours: nextHalfLife,
        daysAtCurrentDose: nextDaysAtCurrentDose,
      };
      localStorage.setItem(STORAGE_BY_USER_KEY, JSON.stringify(byUser));
    } catch {
      // no-op
    }
  };

  const switchUser = (nextProfileId) => {
    if (!profiles.some((p) => p.id === nextProfileId)) return;
    setActiveProfileId(nextProfileId);
    localStorage.setItem(ACTIVE_PROFILE_ID_STORAGE_KEY, nextProfileId);
    const nextState = loadStateForUser(nextProfileId);
    setTime(getNowLocalDateTimeValue());
    setEntries(nextState.entries);
    setHalfLifeHours(nextState.halfLifeHours);
    setDaysAtCurrentDose(nextState.daysAtCurrentDose);
    setRecalcAt(Date.now());

    const refreshed = loadProfiles();
    setProfiles(refreshed);
  };

  const addEntry = (e) => {
    e.preventDefault();
    const doseNumber = Number(doseMg);
    if (!doseNumber || doseNumber <= 0) return;
    const parsedTakenAt = new Date(time).getTime();
    const takenAtMs = Number.isFinite(parsedTakenAt) ? parsedTakenAt : Date.now();

    const nextEntries = [
      {
        id: crypto.randomUUID(),
        doseMg: doseNumber,
        takenAtMs,
        takenAtIso: new Date(takenAtMs).toISOString(),
        createdAt: Date.now(),
      },
      ...entries,
    ];

    setEntries(nextEntries);
    saveUserState(nextEntries);
    setDoseMg(defaultDoseMg);
    setTime(getNowLocalDateTimeValue());
    setRecalcAt(Date.now());
  };

  const saveHalfLife = (next) => {
    const value = Number(next);
    const safe = halfLifeOptions.includes(value) ? value : defaultHalfLifeHours;
    setHalfLifeHours(safe);
    saveUserState(entries, safe);
  };

  const saveDaysAtCurrentDose = (next) => {
    const value = Math.max(0, Number(next) || 0);
    setDaysAtCurrentDose(value);
    saveUserState(entries, halfLifeHours, activeProfileId, value);
    setRecalcAt(Date.now());
  };

  const clearEntry = (id) => {
    const nextEntries = entries.filter((entry) => entry.id !== id);
    setEntries(nextEntries);
    saveUserState(nextEntries);
    setRecalcAt(Date.now());
  };

  const clearAll = () => {
    setEntries([]);
    saveUserState([]);
    setRecalcAt(Date.now());
  };

  const activeMgAtTime = (entry, atMs, nowRef) => {
    const takenAt = getEntryTakenAtMs(entry, nowRef);
    if (atMs < takenAt) return 0;
    const elapsedHours = (atMs - takenAt) / (1000 * 60 * 60);
    return (entry.doseMg || 0) * Math.pow(0.5, elapsedHours / halfLifeHours);
  };

  const modeledEntries = useMemo(() => {
    return buildModeledEntries(entries, daysAtCurrentDose, recalcAt);
  }, [entries, daysAtCurrentDose, recalcAt]);

  const metrics = useMemo(() => {
    const totalMg = entries.reduce((sum, entry) => sum + (entry.doseMg || 0), 0);
    const now = recalcAt;
    const activeMg = modeledEntries.reduce((sum, entry) => sum + activeMgAtTime(entry, now, now), 0);
    const toleranceFactor = toleranceFactorFromDays(daysAtCurrentDose, toleranceMaxReduction, toleranceTauDays);
    const effectReductionPercent = Math.max(0, (1 - toleranceFactor) * 100);
    return { totalMg, activeMg, effectReductionPercent };
  }, [entries, modeledEntries, recalcAt, halfLifeHours, daysAtCurrentDose, toleranceMaxReduction, toleranceTauDays]);

  const chartData = useMemo(() => {
    if (!modeledEntries.length) return [];
    const now = recalcAt;
    const times = modeledEntries.map((entry) => getEntryTakenAtMs(entry, now));
    const earliest = Math.min(...times);
    const start = Math.max(earliest - 4 * 60 * 60 * 1000, now - 48 * 60 * 60 * 1000);
    const end = now + 72 * 60 * 60 * 1000;
    const stepMs = 60 * 60 * 1000;

    const points = [];
    for (let t = start; t <= end; t += stepMs) {
      const activeMg = modeledEntries.reduce((sum, entry) => sum + activeMgAtTime(entry, t, now), 0);
      points.push({ ts: t, activeMg: Number(activeMg.toFixed(3)) });
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

  const liveMath = useMemo(() => {
    const now = recalcAt;
    const toleranceFactor = toleranceFactorFromDays(daysAtCurrentDose, toleranceMaxReduction, toleranceTauDays);
    const realEntries = [...entries]
      .map((entry) => ({ ...entry, takenAt: getEntryTakenAtMs(entry, now) }))
      .sort((a, b) => b.takenAt - a.takenAt);
    const mostRecentEntry = realEntries[0] || null;
    const mostRecentElapsedHours = mostRecentEntry ? Math.max(0, (now - mostRecentEntry.takenAt) / (1000 * 60 * 60)) : null;
    const mostRecentRemaining = mostRecentEntry ? activeMgAtTime(mostRecentEntry, now, now) : null;

    return {
      totalLogged: Number(metrics.totalMg.toFixed(3)),
      activeNow: Number(metrics.activeMg.toFixed(3)),
      halfLifeHours: Number(halfLifeHours),
      toleranceFactor: Number(toleranceFactor.toFixed(3)),
      toleranceReductionPercent: Number(metrics.effectReductionPercent.toFixed(1)),
      realDoseCount: entries.length,
      modeledDoseCount: modeledEntries.length,
      syntheticDoseCount: Math.max(0, modeledEntries.length - entries.length),
      mostRecentDose: mostRecentEntry ? Number((mostRecentEntry.doseMg || 0).toFixed(3)) : null,
      mostRecentElapsedHours: mostRecentElapsedHours !== null ? Number(mostRecentElapsedHours.toFixed(2)) : null,
      mostRecentRemaining: mostRecentRemaining !== null ? Number(mostRecentRemaining.toFixed(3)) : null,
    };
  }, [recalcAt, daysAtCurrentDose, toleranceMaxReduction, toleranceTauDays, entries, modeledEntries, metrics, halfLifeHours]);

  const primaryDrug = title.replace(/\s*Tracker\s*$/i, "");

  return (
    <div className="w-full px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Pill className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{title}</h1>
          <p className="text-gray-600 dark:text-gray-400">{subtitle}</p>
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
                <span className="text-sm text-gray-700 dark:text-gray-300">Dose ({doseUnit})</span>
                <input
                  type="number"
                  min={doseMin}
                  step={doseStep}
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
            <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium">Add Dose</button>
          </form>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">Snapshot</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1">
              <span className="text-sm text-gray-700 dark:text-gray-300">Half-life</span>
              <select
                value={halfLifeHours}
                onChange={(e) => saveHalfLife(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              >
                {halfLifeOptions.map((hours) => (
                  <option key={hours} value={hours}>{hours} hours</option>
                ))}
              </select>
            </label>
            {showToleranceTracking && (
              <label className="space-y-1">
                <span className="text-sm text-gray-700 dark:text-gray-300">Days at current dose</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={daysAtCurrentDose}
                  onChange={(e) => saveDaysAtCurrentDose(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                />
              </label>
            )}
            <button
              type="button"
              onClick={() => setRecalcAt(Date.now())}
              className="px-3 py-2 rounded-lg border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-sm"
            >
              Recalculate
            </button>
          </div>
          <div className="space-y-1 text-gray-900 dark:text-white">
            <p>Total logged: <strong>{metrics.totalMg.toFixed(3)} {doseUnit}</strong></p>
            <p>Estimated active now: <strong>{metrics.activeMg.toFixed(3)} {doseUnit}</strong></p>
            {showToleranceTracking && (
              <>
                <p>Days at current dose: <strong>{daysAtCurrentDose}</strong></p>
                <p>{toleranceReductionLabel}: <strong>{metrics.effectReductionPercent.toFixed(1)}%</strong></p>
                {daysAtCurrentDose > 0 && entries.length > 0 && (
                  <p>Synthetic carryover doses: <strong>{Math.max(0, modeledEntries.length - entries.length)}</strong></p>
                )}
              </>
            )}
            <p>Last recalculated: <strong>{new Date(recalcAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}</strong></p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Estimated Active Level</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">Decay curve based on selected half-life. Timeline includes 72-hour projection.</p>
        {chartData.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">Add at least one dose to view the graph.</p>
        ) : (
          <div className="w-full h-72 min-w-0 min-h-[18rem]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
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
                  labelFormatter={(value) => `🕐 ${new Date(value).toLocaleString([], { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
                  formatter={(value) => [`${value} ${doseUnit}`, "Estimated active"]}
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
                <Line type="monotone" dataKey="activeMg" name="activeMg" stroke="#6366f1" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">Dose Log</h2>
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
          <p className="text-gray-500 dark:text-gray-400">No entries yet. Add your first dose above.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
              >
                <div className="text-sm text-gray-900 dark:text-white">
                  <strong>{entry.doseMg} {doseUnit}</strong> · {formatDoseTimestamp(entry, recalcAt)}
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
          <li>{primaryDrug} (tracked)</li>
        </ul>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Math Model</h2>
        <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/10 p-3 space-y-2 text-xs sm:text-sm text-indigo-950 dark:text-indigo-100">
          <h3 className="font-semibold">Live calculations using your current tracker inputs</h3>
          <p><strong>Logged doses:</strong> {liveMath.realDoseCount} real, {liveMath.syntheticDoseCount} synthetic carryover, {liveMath.modeledDoseCount} total modeled doses.</p>
          <p><strong>Current elimination inputs:</strong> half-life {liveMath.halfLifeHours} h, active now {liveMath.activeNow} {doseUnit}, total logged {liveMath.totalLogged} {doseUnit}.</p>
          {liveMath.mostRecentDose !== null && (
            <p><strong>Most recent dose contribution:</strong> {liveMath.mostRecentDose} {doseUnit} logged {liveMath.mostRecentElapsedHours} h ago → {liveMath.mostRecentRemaining} {doseUnit} remaining by Dose × 0.5^(elapsed/halfLife).</p>
          )}
          {showToleranceTracking && (
            <p><strong>Tolerance right now:</strong> factor {liveMath.toleranceFactor} → {liveMath.toleranceReductionPercent}% modeled reduction from {daysAtCurrentDose} days at dose.</p>
          )}
        </div>
        <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 space-y-2">
          <p><strong>Elimination model:</strong> Active(t) = Dose × 0.5^((t − t_dose) / halfLifeHours)</p>
          <p><strong>Total active level:</strong> Active_total(t) = Σ Active_i(t) over all logged doses</p>
          {showToleranceTracking && (
            <p><strong>Tolerance effect model:</strong> ToleranceFactor = 1 − maxReduction×(1 − e^(−days/τ)); EffectReduction = (1 − ToleranceFactor) × 100%</p>
          )}
          {showToleranceTracking && (
            <p><strong>Carryover model:</strong> Prior daily doses are synthesized from the most recent logged dose/time using days at current dose to estimate non-zero baseline.</p>
          )}
          <p><strong>Time axis:</strong> 1-hour steps from recent history through 72-hour projection</p>
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Educational tracker only and not medical advice. Individual metabolism and response vary. Use medication only as prescribed and consult your clinician.
      </p>
    </div>
  );
}
