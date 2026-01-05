import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import AIExplanation from "../components/AIExplanation";

// A single-page visualizer for the "Warmup step" schedule solution:
// Sleep 68°F → Warmup 70°F → Home 72°F

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  return clamp(h * 60 + m, 0, 24 * 60 - 1);
}

function toHHMM(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function minutesBetween(a, b) {
  // assumes same-day and a<=b; for this UI we keep it simple.
  return Math.max(0, b - a);
}

function SegmentBar({ seg, dayStart, dayEnd }) {
  const total = Math.max(1, dayEnd - dayStart);
  const left = ((seg.start - dayStart) / total) * 100;
  const width = ((seg.end - seg.start) / total) * 100;

  const bg =
    seg.name === "Sleep"
      ? "bg-slate-300"
      : seg.name === "Warmup"
      ? "bg-amber-300"
      : "bg-emerald-300";

  return (
    <div
      className={`absolute top-0 h-full ${bg} rounded-xl shadow-sm border border-black/5`}
      style={{ left: `${left}%`, width: `${width}%` }}
      title={`${seg.name}: ${toHHMM(seg.start)}–${toHHMM(seg.end)} @ ${seg.temp}°F`}
    >
      <div className="h-full flex items-center px-3">
        <div className="text-sm font-semibold text-black/80">
          {seg.name}
          <span className="ml-2 font-normal text-black/60">
            {toHHMM(seg.start)}–{toHHMM(seg.end)}
          </span>
          <span className="ml-2 inline-flex items-center rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold text-black/70">
            {seg.temp}°F
          </span>
        </div>
      </div>
    </div>
  );
}

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-900/5 px-2.5 py-1 text-xs font-semibold text-slate-800">
      {children}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-slate-700">{label}</div>
      {children}
    </div>
  );
}

function Input({ ...props }) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-slate-300 ${
        props.className ?? ""
      }`}
    />
  );
}

function Slider({ value, onChange, min, max, step }) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full"
    />
  );
}

function formatF(n) {
  return `${Math.round(n * 10) / 10}`;
}

export default function EcobeeTransitionPlannerPage() {
  // Defaults based on the recommended schedule
  const [sleepTemp, setSleepTemp] = useState(68);
  const [warmupTemp, setWarmupTemp] = useState(70);
  const [homeTemp, setHomeTemp] = useState(72);

  const [sleepStart, setSleepStart] = useState("23:30");
  const [warmupStart, setWarmupStart] = useState("05:45");
  const [homeStart, setHomeStart] = useState("06:30");

  const [heatDiff, setHeatDiff] = useState(2.5);
  const [minOffGoal, setMinOffGoal] = useState(10); // "desired rest time" guideline

  const dayWindowStart = useMemo(() => toMinutes("00:00"), []);
  const dayWindowEnd = useMemo(() => toMinutes("09:00"), []);

  // Build segments for the morning window
  const segments = useMemo(() => {
    const sStart = toMinutes(sleepStart);
    const wStart = toMinutes(warmupStart);
    const hStart = toMinutes(homeStart);

    // For the visualization window (00:00–09:00), we treat Sleep as active until Warmup
    // If sleepStart is the prior day (e.g., 23:30), we assume sleep is active at midnight.

    const sleepSeg = {
      name: "Sleep",
      start: dayWindowStart,
      end: clamp(wStart, dayWindowStart, dayWindowEnd),
      temp: sleepTemp,
    };

    const warmupSeg = {
      name: "Warmup",
      start: clamp(wStart, dayWindowStart, dayWindowEnd),
      end: clamp(hStart, dayWindowStart, dayWindowEnd),
      temp: warmupTemp,
    };

    const homeSeg = {
      name: "Home",
      start: clamp(hStart, dayWindowStart, dayWindowEnd),
      end: dayWindowEnd,
      temp: homeTemp,
    };

    return [sleepSeg, warmupSeg, homeSeg].filter((x) => x.end > x.start);
  }, [sleepStart, warmupStart, homeStart, sleepTemp, warmupTemp, homeTemp, dayWindowStart, dayWindowEnd]);

  const chartData = useMemo(() => {
    // 15-minute points from 00:00 to 09:00
    const points = [];
    for (let m = dayWindowStart; m <= dayWindowEnd; m += 15) {
      const seg = segments.find((s) => m >= s.start && m < s.end) ?? segments[segments.length - 1];
      points.push({ t: toHHMM(m), setpoint: seg?.temp ?? homeTemp });
    }
    return points;
  }, [segments, homeTemp, dayWindowStart, dayWindowEnd]);

  const analysis = useMemo(() => {
    const sleepToHomeJump = homeTemp - sleepTemp;
    const sleepToWarmJump = warmupTemp - sleepTemp;
    const warmToHomeJump = homeTemp - warmupTemp;

    const riskImmediateRestart = sleepToHomeJump >= heatDiff;

    // The "solution intent": keep the controller from fully satisfying Sleep right before Home.
    // So we estimate whether warmup reduces the sharp jump.
    const reducedRisk = warmToHomeJump < heatDiff;

    // "Rest time" between likely cycle end and next call is hard without runtime data.
    // We provide a guideline: ensure Home start is at least minOffGoal minutes after the *end* of the last likely cycle.
    // Here we proxy with schedule spacing between warmup start and home start.
    const spacing = minutesBetween(toMinutes(warmupStart), toMinutes(homeStart));

    return {
      sleepToHomeJump,
      sleepToWarmJump,
      warmToHomeJump,
      riskImmediateRestart,
      reducedRisk,
      spacing,
    };
  }, [sleepTemp, warmupTemp, homeTemp, heatDiff, warmupStart, homeStart]);

  const hint = useMemo(() => {
    const lines = [];

    if (analysis.riskImmediateRestart) {
      lines.push(
        `Your Sleep→Home jump is ${formatF(analysis.sleepToHomeJump)}°F, which is ≥ your ${formatF(heatDiff)}°F differential. That's the scenario that can cause a quick re-fire.`
      );
    } else {
      lines.push(
        `Your Sleep→Home jump is ${formatF(analysis.sleepToHomeJump)}°F, which is < your ${formatF(heatDiff)}°F differential. Immediate restarts are less likely.`
      );
    }

    if (analysis.reducedRisk) {
      lines.push(
        `Warmup helps because Warmup→Home is only ${formatF(analysis.warmToHomeJump)}°F (below your differential), so the controller is less likely to stop and then instantly need another call at Home time.`
      );
    } else {
      lines.push(
        `Warmup→Home is still ${formatF(analysis.warmToHomeJump)}°F (≥ differential). Consider either raising Warmup temp closer to Home (e.g., 71°F), or delaying Home by 10–20 minutes.`
      );
    }

    if (analysis.spacing < minOffGoal) {
      lines.push(
        `Your Warmup window is only ${analysis.spacing} minutes. If you want more "rest time" margin, try making Warmup earlier or delaying Home (aim ≥ ${minOffGoal} minutes window).`
      );
    } else {
      lines.push(
        `Your Warmup window is ${analysis.spacing} minutes, which gives a reasonable cushion to avoid short off/on flips.`
      );
    }

    return lines;
  }, [analysis, heatDiff, minOffGoal]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Ecobee Transition Planner</h1>
            <Badge>Visual fix for "stop → immediate restart"</Badge>
          </div>
          <p className="text-slate-700 max-w-3xl">
            If your schedule jumps from a low Sleep setpoint to a higher Home setpoint right after a cycle ends, the thermostat can call for heat again almost immediately. The usual workaround is a short <b>Warmup</b> step that bridges the jump.
          </p>
        </motion.div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Controls */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="lg:col-span-2 rounded-2xl bg-white shadow-sm border border-slate-200 p-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Inputs</h2>
              <span className="text-xs text-slate-500">Morning window: 00:00–09:00</span>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Sleep temp (°F)">
                <div className="flex items-center gap-3">
                  <div className="w-14 text-sm font-semibold text-slate-900">{sleepTemp}°</div>
                  <Slider value={sleepTemp} onChange={(v) => setSleepTemp(Math.round(v))} min={55} max={75} step={1} />
                </div>
              </Field>
              <Field label="Warmup temp (°F)">
                <div className="flex items-center gap-3">
                  <div className="w-14 text-sm font-semibold text-slate-900">{warmupTemp}°</div>
                  <Slider value={warmupTemp} onChange={(v) => setWarmupTemp(Math.round(v))} min={55} max={75} step={1} />
                </div>
              </Field>
              <Field label="Home temp (°F)">
                <div className="flex items-center gap-3">
                  <div className="w-14 text-sm font-semibold text-slate-900">{homeTemp}°</div>
                  <Slider value={homeTemp} onChange={(v) => setHomeTemp(Math.round(v))} min={55} max={80} step={1} />
                </div>
              </Field>

              <Field label="Heat differential (°F)">
                <div className="flex items-center gap-3">
                  <div className="w-14 text-sm font-semibold text-slate-900">{formatF(heatDiff)}°</div>
                  <Slider value={heatDiff} onChange={(v) => setHeatDiff(Math.round(v * 10) / 10)} min={0.5} max={4.0} step={0.1} />
                </div>
              </Field>

              <Field label="Sleep starts (for context)">
                <Input type="time" value={sleepStart} onChange={(e) => setSleepStart(e.target.value)} />
              </Field>
              <Field label="Warmup starts">
                <Input type="time" value={warmupStart} onChange={(e) => setWarmupStart(e.target.value)} />
              </Field>
              <Field label="Home starts">
                <Input type="time" value={homeStart} onChange={(e) => setHomeStart(e.target.value)} />
              </Field>
              <Field label="Min off-time goal (min)">
                <div className="flex items-center gap-3">
                  <div className="w-14 text-sm font-semibold text-slate-900">{minOffGoal}</div>
                  <Slider value={minOffGoal} onChange={(v) => setMinOffGoal(Math.round(v))} min={0} max={30} step={1} />
                </div>
              </Field>
            </div>

            <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-200 p-4">
              <div className="text-sm font-bold text-slate-900">Quick read</div>
              <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Sleep → Home jump</span>
                  <span className={`font-semibold ${analysis.riskImmediateRestart ? "text-rose-700" : "text-emerald-700"}`}>
                    {formatF(analysis.sleepToHomeJump)}°F {analysis.riskImmediateRestart ? "(risk)" : "(ok)"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Warmup → Home jump</span>
                  <span className={`font-semibold ${analysis.reducedRisk ? "text-emerald-700" : "text-rose-700"}`}>
                    {formatF(analysis.warmToHomeJump)}°F {analysis.reducedRisk ? "(smoothed)" : "(still sharp)"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Warmup window</span>
                  <span className={`font-semibold ${analysis.spacing < minOffGoal ? "text-amber-700" : "text-slate-900"}`}>
                    {analysis.spacing} min
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {hint.map((h, i) => (
                <div key={i} className="text-sm text-slate-700 leading-relaxed">
                  • {h}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Visuals */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="lg:col-span-3 space-y-6"
          >
            <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Schedule blocks</h2>
                  <p className="text-sm text-slate-600">The Warmup step bridges the setpoint jump so you don't finish a cycle at Sleep, then immediately need Home.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>Sleep</Badge>
                  <Badge>Warmup</Badge>
                  <Badge>Home</Badge>
                </div>
              </div>

              <div className="mt-5 relative h-14 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden">
                {segments.map((seg) => (
                  <SegmentBar key={seg.name} seg={seg} dayStart={dayWindowStart} dayEnd={dayWindowEnd} />
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>00:00</span>
                <span>03:00</span>
                <span>06:00</span>
                <span>09:00</span>
              </div>
            </div>

            <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-5">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Setpoint over time</h2>
                  <p className="text-sm text-slate-600">What the thermostat is being asked to do, visually.</p>
                </div>
              </div>

              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 18, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" minTickGap={28} />
                    <YAxis domain={[55, 80]} tickCount={6} />
                    <Tooltip
                      formatter={(v) => [`${v}°F`, "Setpoint"]}
                      labelFormatter={(l) => `Time: ${l}`}
                    />
                    <ReferenceLine y={sleepTemp + heatDiff} strokeDasharray="4 4" />
                    <Line type="stepAfter" dataKey="setpoint" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 text-xs text-slate-500 leading-relaxed">
                Dashed line = Sleep temp + differential ({sleepTemp}°F + {formatF(heatDiff)}°F). A big step above that line right at the Home transition is where quick restarts commonly happen.
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900 text-white shadow-sm p-5">
              <div className="text-sm font-semibold text-white/80">Recommended template</div>
              <div className="mt-2 text-xl font-bold">Sleep {sleepTemp}°F → Warmup {warmupTemp}°F → Home {homeTemp}°F</div>
              <div className="mt-2 text-sm text-white/80">
                Try making Warmup start 30–60 minutes before Home. If Warmup→Home is still ≥ differential, set Warmup closer to Home (e.g., 71°F) or delay Home by 10–20 minutes.
              </div>
            </div>
          </motion.div>
        </div>

        <AIExplanation
          title="Explanation (Plain English)"
          prompt={`My Ecobee thermostat schedule has the following configuration:

- Sleep: ${sleepTemp}°F (starts at ${sleepStart})
- Warmup: ${warmupTemp}°F (starts at ${warmupStart})
- Home: ${homeTemp}°F (starts at ${homeStart})
- Heat Differential: ${heatDiff}°F
- Target Minimum Off Time: ${minOffGoal} minutes

Please explain in 3-4 paragraphs for a homeowner:

1. Why creating a "Warmup" comfort setting between Sleep and Home prevents excessive furnace cycling
2. How the heat differential setting affects when the furnace turns on and off, and why large temperature jumps cause problems
3. The relationship between schedule transition times and giving the furnace adequate rest periods
4. Practical tips for optimizing my schedule to balance comfort, equipment longevity, and energy efficiency

Use plain English and help me understand the "why" behind the three-step Sleep→Warmup→Home approach.`}
        />

        <div className="mt-8 text-xs text-slate-500">
          Note: This tool visualizes setpoints (what Ecobee is asked to do). Actual cycling also depends on your furnace board logic, room heat-up rate, and Ecobee thresholds.
        </div>
      </div>
    </div>
  );
}