import { useEffect, useMemo, useState } from "react";
import {
  Thermometer,
  Sliders,
  Snowflake,
  Flame,
  Zap,
  Info,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import AIExplanation from "../components/AIExplanation";

/**
 * EcobeeReplayLastNight
 * MVP: zero external integration.
 *
 * What it simulates:
 * - Outdoor temp curve over an overnight window
 * - Indoor temp response based on:
 *   - heat loss factor
 *   - HP heating rate
 *   - AUX heating rate
 * - Staging logic using thresholds:
 *   - AUTO (conservative defaults)
 *   - MANUAL (user-controlled)
 *
 * What it shows:
 * - Actual vs Simulated compare (Auto vs Manual) timeline
 * - Line chart of temps
 * - Metrics: AUX hours, cost index, comfort hold
 */

// ---------- Utilities ----------
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function fmtHourLabel(date) {
  const h = date.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = ((h + 11) % 12) + 1;
  return `${hr}${ampm}`;
}

function hoursBetween(startMs, endMs, stepMin) {
  const out = [];
  const stepMs = stepMin * 60 * 1000;
  for (let t = startMs; t <= endMs; t += stepMs) out.push(t);
  return out;
}

function buildTypicalNightOutdoorCurve({
  startMs,
  endMs,
  stepMin = 15,
  startOutdoorF = 38,
  overnightLowF = 26,
  lowAtHourLocal = 6,
  morningReboundF = 32,
}) {
  // Simple "U-shaped" curve: cools down to low near 6AM then rebounds.
  const times = hoursBetween(startMs, endMs, stepMin);
  const start = new Date(startMs);
  const end = new Date(endMs);

  // find index closest to lowAtHourLocal
  const lowIdx = (() => {
    let best = 0;
    let bestDiff = Infinity;
    times.forEach((t, i) => {
      const d = new Date(t);
      const diff = Math.abs(d.getHours() + d.getMinutes() / 60 - lowAtHourLocal);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = i;
      }
    });
    return best;
  })();

  const series = times.map((t, i) => {
    // piecewise linear: start -> low, then low -> end
    let outdoor;
    if (i <= lowIdx) {
      const a = i / Math.max(1, lowIdx);
      outdoor = startOutdoorF + a * (overnightLowF - startOutdoorF);
    } else {
      const a = (i - lowIdx) / Math.max(1, times.length - 1 - lowIdx);
      outdoor = overnightLowF + a * (morningReboundF - overnightLowF);
    }
    return {
      t,
      label: fmtHourLabel(new Date(t)),
      outdoorF: Number(outdoor.toFixed(1)),
    };
  });

  // add a small smoothing "wiggle" so it doesn't look fake-flat
  return series.map((p, idx) => {
    const wiggle = Math.sin(idx / 3) * 0.4;
    return { ...p, outdoorF: Number((p.outdoorF + wiggle).toFixed(1)) };
  });
}

function stageDecision({
  needHeat,
  outdoorF,
  setpointF,
  indoorF,
  thresholds,
}) {
  const {
    compressorMinOutdoorF,
    auxMaxOutdoorF,
    auxSimultaneous,
    auxDeltaF,
  } = thresholds;

  const compressorAllowed = outdoorF >= compressorMinOutdoorF;
  const auxAllowed = outdoorF <= auxMaxOutdoorF;

  if (!needHeat) return { hp: false, aux: false, reason: "Satisfied" };

  // If compressor locked out, and aux is allowed -> aux only
  if (!compressorAllowed && auxAllowed) {
    return {
      hp: false,
      aux: true,
      reason: `Compressor locked out (outdoor ${outdoorF}°F < min ${compressorMinOutdoorF}°F)`,
    };
  }

  // If compressor allowed, run HP
  if (compressorAllowed) {
    const delta = setpointF - indoorF; // positive if behind setpoint
    const wantsAuxAssist =
      auxAllowed && auxSimultaneous && delta >= auxDeltaF;

    if (wantsAuxAssist) {
      return {
        hp: true,
        aux: true,
        reason: `Aux assist: delta ${delta.toFixed(1)}°F ≥ ${auxDeltaF}°F and auxSimultaneous ON`,
      };
    }

    return {
      hp: true,
      aux: false,
      reason: compressorAllowed
        ? "Heat pump running (compressor allowed)"
        : "Heat pump not allowed",
    };
  }

  // If compressor not allowed and aux not allowed, nothing can run (bad settings)
  return {
    hp: false,
    aux: false,
    reason: `No heat available (outdoor ${outdoorF}°F, compressor min ${compressorMinOutdoorF}°F, aux max ${auxMaxOutdoorF}°F)`,
  };
}

function simulateNight({
  curve,
  initialIndoorF,
  setpointF,
  heatDifferentialF,
  thresholds,
  calibration,
}) {
  const {
    heatLossFPerHrPerDeltaF, // e.g. 0.12 °F/hr per °F delta
    hpHeatGainFPerHr, // e.g. 2.0 °F/hr when HP runs
    auxHeatGainFPerHr, // e.g. 6.0 °F/hr when AUX runs
  } = calibration;

  // Determine step size from curve spacing
  const stepMin =
    curve.length >= 2 ? (curve[1].t - curve[0].t) / (60 * 1000) : 15;
  const dtHr = stepMin / 60;

  let indoor = initialIndoorF;

  const rows = curve.map((p, idx) => {
    const needHeat = indoor < setpointF - heatDifferentialF;

    const decision = stageDecision({
      needHeat,
      outdoorF: p.outdoorF,
      setpointF,
      indoorF: indoor,
      thresholds,
    });

    // Simple thermal model:
    // - heat loss proportional to (indoor - outdoor)
    // - heat gain based on which stage is running
    const deltaToOutside = Math.max(0, indoor - p.outdoorF);
    const loss = heatLossFPerHrPerDeltaF * deltaToOutside * dtHr;

    let gain = 0;
    if (decision.hp) gain += hpHeatGainFPerHr * dtHr;
    if (decision.aux) gain += auxHeatGainFPerHr * dtHr;

    const nextIndoor = indoor + gain - loss;

    const mode = decision.hp && decision.aux
      ? "BOTH"
      : decision.aux
      ? "AUX"
      : decision.hp
      ? "HP"
      : "IDLE";

    const row = {
      ...p,
      setpointF,
      indoorF: Number(indoor.toFixed(2)),
      mode,
      hp: decision.hp,
      aux: decision.aux,
      reason: decision.reason,
      // For the chart we want "after" too, to make it feel continuous:
      indoorNextF: Number(nextIndoor.toFixed(2)),
    };

    indoor = nextIndoor;
    return row;
  });

  return rows;
}

function summarizeRun(rows) {
  if (!rows?.length) return null;
  const stepMin =
    rows.length >= 2 ? (rows[1].t - rows[0].t) / (60 * 1000) : 15;
  const hoursPerStep = stepMin / 60;

  const hpHours = rows.reduce((a, r) => a + (r.hp ? hoursPerStep : 0), 0);
  const auxHours = rows.reduce((a, r) => a + (r.aux ? hoursPerStep : 0), 0);
  const bothHours = rows.reduce(
    (a, r) => a + (r.hp && r.aux ? hoursPerStep : 0),
    0
  );

  // Cost index: HP=1.0, AUX=3.0 baseline, BOTH = sum (HP + AUX)
  // This is intentionally "relative." Users can later plug kW + $/kWh.
  const costIndex = rows.reduce((a, r) => {
    const hp = r.hp ? 1.0 : 0;
    const aux = r.aux ? 3.0 : 0;
    return a + (hp + aux) * hoursPerStep;
  }, 0);

  const minIndoor = Math.min(...rows.map((r) => r.indoorF));
  const endedIndoor = rows[rows.length - 1]?.indoorNextF ?? rows[rows.length - 1]?.indoorF;

  // "Held setpoint" if indoor didn't fall more than ~1.5°F below setpoint
  const setpoint = rows[0].setpointF;
  const worstBehind = setpoint - minIndoor;
  const holds = worstBehind <= 1.5;

  return {
    hpHours,
    auxHours,
    bothHours,
    costIndex,
    minIndoor,
    endedIndoor,
    worstBehind,
    holds,
  };
}

function modeColor(mode) {
  // Tailwind classes (no inline colors needed)
  switch (mode) {
    case "HP":
      return "bg-orange-500";
    case "AUX":
      return "bg-red-600";
    case "BOTH":
      return "bg-purple-600";
    default:
      return "bg-slate-300 dark:bg-slate-700";
  }
}

function ModeBar({ rows }) {
  return (
    <div className="w-full rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
      <div className="flex h-6">
        {rows.map((r, idx) => (
          <div
            key={idx}
            className={`${modeColor(r.mode)} flex-1`}
            title={`${fmtHourLabel(new Date(r.t))} • ${r.mode}\n${r.reason}`}
          />
        ))}
      </div>
    </div>
  );
}

// ---------- Page ----------
export default function EcobeeReplayLastNight() {
  // Time window defaults: 10PM -> 8AM local
  const now = new Date();
  const start = new Date(now);
  start.setHours(22, 0, 0, 0);
  start.setDate(start.getDate() - 1);

  const end = new Date(now);
  end.setHours(8, 0, 0, 0);

  const [stepMin, setStepMin] = useState(15);

  // "Typical night" curve knobs
  const [startOutdoorF, setStartOutdoorF] = useState(38);
  const [overnightLowF, setOvernightLowF] = useState(26);
  const [morningReboundF, setMorningReboundF] = useState(32);

  // Basic thermostat knobs
  const [setpointF, setSetpointF] = useState(70);
  const [initialIndoorF, setInitialIndoorF] = useState(70);
  const [heatDifferentialF, setHeatDifferentialF] = useState(0.5);

  // Staging toggle
  const [stagingMode, setStagingMode] = useState("AUTO"); // AUTO | MANUAL

  // Manual thresholds
  const [compressorMinOutdoorF, setCompressorMinOutdoorF] = useState(10);
  const [auxMaxOutdoorF, setAuxMaxOutdoorF] = useState(25);
  const [auxSimultaneous, setAuxSimultaneous] = useState(false);
  const [auxDeltaF, setAuxDeltaF] = useState(5);

  // Calibration knobs
  const [heatLossFPerHrPerDeltaF, setHeatLossFPerHrPerDeltaF] = useState(0.10);
  const [hpHeatGainFPerHr, setHpHeatGainFPerHr] = useState(2.0);
  const [auxHeatGainFPerHr, setAuxHeatGainFPerHr] = useState(6.0);

  // AUTO conservative defaults (mimic "overly conservative" installer/ecobee behavior)
  const autoThresholds = useMemo(
    () => ({
      compressorMinOutdoorF: 30,
      auxMaxOutdoorF: 40,
      auxSimultaneous: true, // commonly $$$ if left on
      auxDeltaF: 2, // aggressive assist
    }),
    []
  );

  const manualThresholds = useMemo(
    () => ({
      compressorMinOutdoorF,
      auxMaxOutdoorF,
      auxSimultaneous,
      auxDeltaF,
    }),
    [compressorMinOutdoorF, auxMaxOutdoorF, auxSimultaneous, auxDeltaF]
  );

  const activeThresholds = stagingMode === "AUTO" ? autoThresholds : manualThresholds;

  // Build curve
  const curve = useMemo(() => {
    return buildTypicalNightOutdoorCurve({
      startMs: start.getTime(),
      endMs: end.getTime(),
      stepMin,
      startOutdoorF,
      overnightLowF,
      morningReboundF,
      lowAtHourLocal: 6,
    });
  }, [stepMin, startOutdoorF, overnightLowF, morningReboundF]);

  const calibration = useMemo(
    () => ({
      heatLossFPerHrPerDeltaF,
      hpHeatGainFPerHr,
      auxHeatGainFPerHr,
    }),
    [heatLossFPerHrPerDeltaF, hpHeatGainFPerHr, auxHeatGainFPerHr]
  );

  // Compare: AUTO vs MANUAL always, because that's the "aha"
  const simAuto = useMemo(() => {
    return simulateNight({
      curve,
      initialIndoorF,
      setpointF,
      heatDifferentialF,
      thresholds: autoThresholds,
      calibration,
    });
  }, [curve, initialIndoorF, setpointF, heatDifferentialF, autoThresholds, calibration]);

  const simManual = useMemo(() => {
    return simulateNight({
      curve,
      initialIndoorF,
      setpointF,
      heatDifferentialF,
      thresholds: manualThresholds,
      calibration,
    });
  }, [curve, initialIndoorF, setpointF, heatDifferentialF, manualThresholds, calibration]);

  const sumAuto = useMemo(() => summarizeRun(simAuto), [simAuto]);
  const sumManual = useMemo(() => summarizeRun(simManual), [simManual]);

  const costDeltaPct = useMemo(() => {
    if (!sumAuto || !sumManual) return 0;
    if (sumAuto.costIndex <= 0) return 0;
    return ((sumManual.costIndex - sumAuto.costIndex) / sumAuto.costIndex) * 100;
  }, [sumAuto, sumManual]);

  const auxAvoidedHours = useMemo(() => {
    if (!sumAuto || !sumManual) return 0;
    return sumAuto.auxHours - sumManual.auxHours;
  }, [sumAuto, sumManual]);

  const chartData = useMemo(() => {
    // Merge to single chart: outdoor, indoor auto, indoor manual, setpoint
    return curve.map((p, idx) => {
      const a = simAuto[idx];
      const m = simManual[idx];
      return {
        label: p.label,
        outdoorF: p.outdoorF,
        setpointF: setpointF,
        indoorAutoF: a?.indoorF ?? null,
        indoorManualF: m?.indoorF ?? null,
      };
    });
  }, [curve, simAuto, simManual, setpointF]);

  // "Reset manual to sane defaults"
  const resetManual = () => {
    setCompressorMinOutdoorF(10);
    setAuxMaxOutdoorF(25);
    setAuxSimultaneous(false);
    setAuxDeltaF(5);
  };

  // If user flips staging mode to AUTO, reflect (but keep manual values for later)
  useEffect(() => {
    // no-op; placeholder if you later want UI hints
  }, [stagingMode]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white dark:bg-slate-800 shadow">
              <Zap className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                Replay Last Night: Aux Heat Simulator
              </h1>
              <p className="text-slate-600 dark:text-slate-300">
                See why "Aux starts at 40°F" nukes your bill — then slide thresholds until the house still holds setpoint.
              </p>
            </div>
          </div>
        </div>

        {/* Staging Mode */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5 mb-6 border border-slate-200 dark:border-slate-700">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <Sliders className="w-5 h-5 mt-1 text-slate-700 dark:text-slate-200" />
              <div>
                <div className="text-lg font-semibold text-slate-900 dark:text-white">
                  Configure Staging
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  AUTO mimics conservative defaults. MANUAL lets you stop ecobee from being overly conservative.
                </div>
              </div>
            </div>

            <button
              onClick={() => setStagingMode((p) => (p === "AUTO" ? "MANUAL" : "AUTO"))}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition border ${
                stagingMode === "MANUAL"
                  ? "bg-blue-600 text-white border-blue-700"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-600"
              }`}
              title="Toggle staging mode"
            >
              {stagingMode === "MANUAL" ? (
                <ToggleRight className="w-5 h-5" />
              ) : (
                <ToggleLeft className="w-5 h-5" />
              )}
              {stagingMode}
            </button>
          </div>

          {/* Auto defaults callout */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900/40">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Info className="w-4 h-4" />
                AUTO baseline (conservative)
              </div>
              <div className="mt-2 text-sm text-slate-700 dark:text-slate-200 space-y-1">
                <div>• Compressor Min Outdoor: <span className="font-mono font-semibold">30°F</span></div>
                <div>• Aux Heat Max Outdoor: <span className="font-mono font-semibold">40°F</span></div>
                <div>• Aux Simultaneous: <span className="font-mono font-semibold">ON</span></div>
                <div>• Aux Delta Assist: <span className="font-mono font-semibold">2°F</span></div>
              </div>
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                This is the "why is aux running so much?" starter pack.
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-blue-50 dark:bg-blue-900/20">
              <div className="text-sm font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                <Flame className="w-4 h-4" />
                MANUAL starting point (reasonable)
              </div>
              <div className="mt-2 text-sm text-blue-900 dark:text-blue-100 space-y-1">
                <div>• Compressor Min Outdoor: <span className="font-mono font-semibold">5–15°F</span></div>
                <div>• Aux Heat Max Outdoor: <span className="font-mono font-semibold">20–30°F</span></div>
                <div>• Aux Simultaneous: <span className="font-mono font-semibold">OFF (usually)</span></div>
                <div>• Then: test a cold night. If it can't hold, allow more aux (delta), not "aux at 40°F."</div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    setStagingMode("MANUAL");
                    resetManual();
                  }}
                  className="px-3 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700"
                >
                  Apply sane manual defaults
                </button>
                <button
                  onClick={resetManual}
                  className="px-3 py-2 rounded-lg text-sm font-semibold bg-white/80 dark:bg-slate-800/60 border border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200 hover:bg-white"
                >
                  Reset manual sliders
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Controls grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Threshold panel */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5 border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
              Thresholds (MANUAL)
            </h2>

            <div className="space-y-4">
              <SliderRow
                icon={<Snowflake className="w-4 h-4" />}
                label="Compressor Min Outdoor Temp"
                value={compressorMinOutdoorF}
                unit="°F"
                min={-20}
                max={40}
                step={1}
                disabled={stagingMode === "AUTO"}
                onChange={setCompressorMinOutdoorF}
                hint="Lower = heat pump runs in colder weather (if your unit supports it)."
              />

              <SliderRow
                icon={<Flame className="w-4 h-4" />}
                label="Aux Heat Max Outdoor Temp"
                value={auxMaxOutdoorF}
                unit="°F"
                min={-20}
                max={60}
                step={1}
                disabled={stagingMode === "AUTO"}
                onChange={setAuxMaxOutdoorF}
                hint="Higher = aux allowed more often (expensive)."
              />

              <ToggleRow
                label="Aux Heat Simultaneous Operation"
                value={auxSimultaneous}
                disabled={stagingMode === "AUTO"}
                onChange={setAuxSimultaneous}
                hint="If ON, aux can run *with* compressor (often $$$)."
              />

              <SliderRow
                icon={<Zap className="w-4 h-4" />}
                label="Aux Assist Delta"
                value={auxDeltaF}
                unit="°F"
                min={1}
                max={12}
                step={0.5}
                disabled={stagingMode === "AUTO"}
                onChange={setAuxDeltaF}
                hint="How far behind setpoint before aux assists (when simultaneous is ON)."
              />
            </div>

            <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
              <div className="text-xs text-slate-600 dark:text-slate-300">
                Active thresholds right now:
              </div>
              <div className="mt-1 text-sm font-mono text-slate-900 dark:text-white">
                CompMin {activeThresholds.compressorMinOutdoorF}°F • AuxMax {activeThresholds.auxMaxOutdoorF}°F • Simul{" "}
                {activeThresholds.auxSimultaneous ? "ON" : "OFF"} • Delta {activeThresholds.auxDeltaF}°F
              </div>
            </div>
          </div>

          {/* Night curve */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5 border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
              "Typical Night" Weather Curve
            </h2>

            <div className="space-y-4">
              <SliderRow
                icon={<Thermometer className="w-4 h-4" />}
                label="Start Outdoor Temp (10PM)"
                value={startOutdoorF}
                unit="°F"
                min={-10}
                max={60}
                step={1}
                onChange={setStartOutdoorF}
              />
              <SliderRow
                icon={<Snowflake className="w-4 h-4" />}
                label="Overnight Low (≈6AM)"
                value={overnightLowF}
                unit="°F"
                min={-20}
                max={50}
                step={1}
                onChange={setOvernightLowF}
              />
              <SliderRow
                icon={<Thermometer className="w-4 h-4" />}
                label="Morning Rebound (8AM)"
                value={morningReboundF}
                unit="°F"
                min={-20}
                max={60}
                step={1}
                onChange={setMorningReboundF}
              />
              <SliderRow
                icon={<Sliders className="w-4 h-4" />}
                label="Simulation Step"
                value={stepMin}
                unit="min"
                min={5}
                max={30}
                step={5}
                onChange={setStepMin}
                hint="15 min is a good default."
              />
            </div>

            <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              Later (Phase 2): swap this curve for "Paste beestat CSV" or "Record tonight" localStorage logging.
            </div>
          </div>

          {/* House model / comfort */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5 border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
              House + Comfort Calibration
            </h2>

            <div className="space-y-4">
              <SliderRow
                icon={<Flame className="w-4 h-4" />}
                label="Heating Setpoint"
                value={setpointF}
                unit="°F"
                min={60}
                max={78}
                step={0.5}
                onChange={setSetpointF}
              />
              <SliderRow
                icon={<Thermometer className="w-4 h-4" />}
                label="Indoor Temp at 10PM"
                value={initialIndoorF}
                unit="°F"
                min={55}
                max={78}
                step={0.5}
                onChange={setInitialIndoorF}
              />
              <SliderRow
                icon={<Sliders className="w-4 h-4" />}
                label="Heat Differential"
                value={heatDifferentialF}
                unit="°F"
                min={0.5}
                max={3}
                step={0.5}
                onChange={setHeatDifferentialF}
                hint="How far below setpoint before it calls for heat."
              />

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700" />

              <SliderRow
                icon={<Info className="w-4 h-4" />}
                label="Heat Loss Factor"
                value={heatLossFPerHrPerDeltaF}
                unit="°F/hr/°F"
                min={0.03}
                max={0.25}
                step={0.01}
                onChange={setHeatLossFPerHrPerDeltaF}
                hint="Higher = leakier / less insulated."
              />
              <SliderRow
                icon={<Snowflake className="w-4 h-4" />}
                label="Heat Pump Warm-Up Rate"
                value={hpHeatGainFPerHr}
                unit="°F/hr"
                min={0.5}
                max={5}
                step={0.1}
                onChange={setHpHeatGainFPerHr}
                hint="How fast indoor temp rises when compressor runs."
              />
              <SliderRow
                icon={<Zap className="w-4 h-4" />}
                label="Aux Heat Warm-Up Rate"
                value={auxHeatGainFPerHr}
                unit="°F/hr"
                min={2}
                max={12}
                step={0.2}
                onChange={setAuxHeatGainFPerHr}
                hint="How fast indoor temp rises on strips."
              />
            </div>
          </div>
        </div>

        {/* Compare timelines + metrics */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5 border border-slate-200 dark:border-slate-700 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                What happens overnight (AUTO vs MANUAL)
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                The exact Reddit advice, but in a replay: lower compressor lockout, lower aux allowance, and avoid simultaneous aux unless necessary.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={resetManual}
                className="px-3 py-2 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-600 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reset MANUAL sliders
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">
                AUTO (conservative baseline)
              </div>
              <ModeBar rows={simAuto} />
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">
                MANUAL (your chosen thresholds)
              </div>
              <ModeBar rows={simManual} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <MetricCard
                title="Aux hours avoided"
                value={`${auxAvoidedHours >= 0 ? "+" : ""}${auxAvoidedHours.toFixed(1)} h`}
                subtitle="Manual vs Auto"
                tone={auxAvoidedHours >= 0 ? "good" : "warn"}
              />
              <MetricCard
                title="Cost index change"
                value={`${costDeltaPct >= 0 ? "+" : ""}${costDeltaPct.toFixed(1)}%`}
                subtitle="Relative (HP=1, Aux=3)"
                tone={costDeltaPct <= 0 ? "good" : "warn"}
              />
              <MetricCard
                title="Manual held setpoint?"
                value={sumManual?.holds ? "YES" : "NO"}
                subtitle={
                  sumManual
                    ? `Worst behind: ${sumManual.worstBehind.toFixed(1)}°F`
                    : "-"
                }
                tone={sumManual?.holds ? "good" : "warn"}
              />
              <MetricCard
                title="Why aux happens"
                value="Thresholds"
                subtitle="Hover bars to see reasons"
                tone="neutral"
              />
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5 border border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Temperature replay (outdoor + indoor)
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            If MANUAL holds setpoint with less red/purple, you just saved money without freezing the house.
          </p>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis domain={["dataMin - 2", "dataMax + 2"]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="outdoorF" name="Outdoor (°F)" dot={false} />
                <Line type="monotone" dataKey="setpointF" name="Setpoint (°F)" dot={false} />
                <Line type="monotone" dataKey="indoorAutoF" name="Indoor AUTO (°F)" dot={false} />
                <Line type="monotone" dataKey="indoorManualF" name="Indoor MANUAL (°F)" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-600 dark:text-slate-300">
            <LegendPill label="HP (compressor)" className="bg-orange-500" />
            <LegendPill label="AUX (heat strips)" className="bg-red-600" />
            <LegendPill label="BOTH (simultaneous)" className="bg-purple-600" />
            <LegendPill label="IDLE" className="bg-slate-300 dark:bg-slate-700" />
          </div>

          {/* Bottom guidance */}
          <div className="mt-5 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
            <div className="text-sm font-bold text-amber-900 dark:text-amber-100 mb-1">
              How to use this like a pro (without joining the Aux Cult)
            </div>
            <ol className="text-sm text-amber-900 dark:text-amber-100 list-decimal pl-5 space-y-1">
              <li>Switch to <b>MANUAL</b> staging.</li>
              <li>Drop <b>Compressor Min Outdoor</b> to <b>5–15°F</b> (lower if cold-climate rated).</li>
              <li>Drop <b>Aux Heat Max Outdoor</b> to <b>20–30°F</b> (lower if your system carries the house).</li>
              <li>Consider <b>disabling Aux Simultaneous</b> unless you truly need fast recovery.</li>
              <li>Test a cold night: if it can't hold, increase aux *slightly* via delta/allowance—don't go back to "aux at 40°F."</li>
            </ol>
          </div>
        </div>

        {/* AI Explanation */}
        <AIExplanation
          title="Explanation (Plain English)"
          prompt={`Explain this heat pump auxiliary heat staging comparison in plain, conversational English:

Simulation Setup:
- Outdoor temp overnight: ${overnightLowF}°F low
- Setpoint: ${setpointF}°F
- Heat loss factor: ${heatLossFPerHrPerDeltaF.toFixed(2)} °F/hr/°F
- HP heating rate: ${hpHeatGainFPerHr.toFixed(1)} °F/hr
- Aux heating rate: ${auxHeatGainFPerHr.toFixed(1)} °F/hr

AUTO Mode (Conservative):
- Compressor minimum outdoor: ${autoThresholds.compressorMinOutdoorF}°F
- Aux maximum outdoor: ${autoThresholds.auxMaxOutdoorF}°F
- Aux simultaneous: ${autoThresholds.auxSimultaneous ? "Enabled" : "Disabled"}

MANUAL Mode (User-Controlled):
- Compressor minimum outdoor: ${manualThresholds.compressorMinOutdoorF}°F
- Aux maximum outdoor: ${manualThresholds.auxMaxOutdoorF}°F
- Aux simultaneous: ${manualThresholds.auxSimultaneous ? "Enabled" : "Disabled"}

Results:
- Aux hours avoided (MANUAL vs AUTO): ${auxAvoidedHours >= 0 ? "+" : ""}${auxAvoidedHours.toFixed(1)} hours
- Cost index change: ${costDeltaPct >= 0 ? "+" : ""}${costDeltaPct.toFixed(1)}%
- MANUAL held setpoint: ${sumManual?.holds ? "YES" : "NO"}
- Worst behind setpoint: ${sumManual ? sumManual.worstBehind.toFixed(1) : "N/A"}°F

Write a conversational 3-4 paragraph explanation covering:
1. What the AUTO vs MANUAL staging modes mean and why the defaults are conservative
2. How the compressor min/aux max thresholds affect when aux heat engages
3. What the results show about cost savings vs comfort (holding setpoint)
4. Practical recommendations for homeowners trying to reduce aux heat usage

Be specific about THESE numbers and explain why "aux at 40°F" is expensive.`}
        />
      </div>
    </div>
  );
}

// ---------- Small UI components ----------
function SliderRow({
  icon,
  label,
  value,
  unit,
  min,
  max,
  step,
  onChange,
  hint,
  disabled,
}) {
  return (
    <div className={`${disabled ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <span className="text-slate-500 dark:text-slate-300">{icon}</span>
          {label}
        </div>
        <div className="text-sm font-mono font-bold text-slate-900 dark:text-white">
          {typeof value === "number" ? value : value} {unit}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
      />
      <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
      {hint && (
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </div>
      )}
    </div>
  );
}

function ToggleRow({ label, value, onChange, hint, disabled }) {
  return (
    <div className={`${disabled ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {label}
        </div>
        <button
          disabled={disabled}
          onClick={() => onChange(!value)}
          className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
            value
              ? "bg-green-600 text-white border-green-700"
              : "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-600"
          }`}
        >
          {value ? "ON" : "OFF"}
        </button>
      </div>
      {hint && (
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, subtitle, tone = "neutral" }) {
  const toneClasses =
    tone === "good"
      ? "border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20"
      : tone === "warn"
      ? "border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20"
      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/20";

  return (
    <div className={`rounded-xl border p-4 ${toneClasses}`}>
      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
        {title}
      </div>
      <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
        {subtitle}
      </div>
    </div>
  );
}

function LegendPill({ label, className }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block w-3 h-3 rounded ${className}`} />
      <span>{label}</span>
    </div>
  );
}
