import React, { useMemo, useState } from "react";

/**
 * Ecobee Aux Heat Visual Simulator
 * --------------------------------
 * Goal: make the thermostat/threshold logic visible.
 *
 * This is NOT a physics-perfect model. It's a deliberately simple, explainable
 * state-machine + first-order thermal model that is good enough to show:
 * - why conservative thresholds (Aux at 40°F / Compressor lockout at 30°F) burn money
 * - what changes when you switch Configure Staging to MANUAL
 * - how Aux Simultaneous Operation can spike cost
 * - how to "test": does the house hold setpoint overnight?
 */

// Helpers
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Very simple outdoor temperature profile (night-time dip)
function outdoorTempAtHour(hour, startF, endF) {
  // hour: 0..(N-1)
  // We make a gentle curve with the coldest point near the middle.
  const t = hour / 11; // assuming 12h by default
  const mid = (startF + endF) / 2 - 3; // dip a little below linear
  // Quadratic-ish blend: start -> mid -> end
  const a = (1 - t) * (1 - t);
  const b = 2 * (1 - t) * t;
  const c = t * t;
  return a * startF + b * mid + c * endF;
}

function modeColor(mode) {
  switch (mode) {
    case "HP":
      return "bg-orange-400";
    case "AUX":
      return "bg-red-500";
    case "BOTH":
      return "bg-fuchsia-500";
    default:
      return "bg-slate-400";
  }
}

function modeLabel(mode) {
  switch (mode) {
    case "HP":
      return "Heat Pump";
    case "AUX":
      return "Aux Heat";
    case "BOTH":
      return "HP + Aux";
    default:
      return "Off";
  }
}

function fmt(n, digits = 0) {
  return n.toFixed(digits);
}

function MiniChart({
  data,
  yMin,
  yMax,
  height = 140,
  title,
  unit,
}) {
  const w = 520;
  const h = height;
  const pad = 22;

  const points = useMemo(() => {
    const n = data.length;
    const xStep = (w - pad * 2) / (n - 1);
    return data
      .map((v, i) => {
        const x = pad + i * xStep;
        const y = pad + (1 - (v - yMin) / (yMax - yMin)) * (h - pad * 2);
        return [x, y];
      })
      .map(([x, y]) => `${x},${clamp(y, pad, h - pad)}`)
      .join(" ");
  }, [data, yMin, yMax, w, h, pad]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        <div className="text-xs text-slate-500">
          {fmt(yMin)}{unit} → {fmt(yMax)}{unit}
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        {/* grid */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={pad}
            x2={w - pad}
            y1={pad + t * (h - pad * 2)}
            y2={pad + t * (h - pad * 2)}
            className="stroke-slate-100"
            strokeWidth="1"
          />
        ))}

        {/* axis */}
        <line x1={pad} x2={pad} y1={pad} y2={h - pad} className="stroke-slate-200" strokeWidth="2" />
        <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} className="stroke-slate-200" strokeWidth="2" />

        {/* line */}
        <polyline
          points={points}
          fill="none"
          className="stroke-slate-700"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* last value */}
        <text x={w - pad} y={pad + 10} textAnchor="end" className="fill-slate-500" fontSize="12">
          last: {fmt(data[data.length - 1], 1)}{unit}
        </text>
      </svg>
    </div>
  );
}

function ModeStrip({ modes }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-800">Equipment mode over the night</div>
        <div className="text-xs text-slate-500">(each block = 1 hour)</div>
      </div>
      <div className="flex gap-1">
        {modes.map((m, i) => (
          <div key={i} className={`h-7 flex-1 rounded ${modeColor(m)}`} title={`Hour ${i}: ${modeLabel(m)}`} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700 sm:grid-cols-4">
        {([
          ["HP", "Heat Pump", "bg-orange-400"],
          ["AUX", "Aux Heat", "bg-red-500"],
          ["BOTH", "HP + Aux", "bg-fuchsia-500"],
          ["OFF", "Off", "bg-slate-400"],
        ]).map(([k, label, c]) => (
          <div key={k} className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded ${c}`} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
  hint,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-800">{label}</div>
          {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
        </div>
        <div className="text-sm font-mono text-slate-700">
          {fmt(value, step && step < 1 ? 1 : 0)}{suffix ?? ""}
        </div>
      </div>
      <input
        className="mt-3 w-full"
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="mt-2 flex justify-between text-xs text-slate-400">
        <span>
          {min}
          {suffix}
        </span>
        <span>
          {max}
          {suffix}
        </span>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  hint,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-800">{label}</div>
          {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
        </div>
        <button
          onClick={() => onChange(!checked)}
          className={`h-7 w-12 rounded-full border transition ${
            checked ? "border-slate-300 bg-slate-900" : "border-slate-300 bg-slate-200"
          }`}
          aria-pressed={checked}
          title={checked ? "On" : "Off"}
        >
          <div
            className={`h-6 w-6 translate-y-[1px] rounded-full bg-white shadow-sm transition ${
              checked ? "translate-x-5" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

export default function EcobeeAuxHeatSimulatorPage() {
  // "House" knobs (abstracted)
  const [setpointF, setSetpointF] = useState(70);
  const [initialIndoorF, setInitialIndoorF] = useState(70);
  const [outdoorStartF, setOutdoorStartF] = useState(38);
  const [outdoorEndF, setOutdoorEndF] = useState(26);

  // Building model knobs (made-up units, but consistent)
  const [heatLossFactor, setHeatLossFactor] = useState(0.55); // higher = leakier / more heat loss
  const [thermalMass, setThermalMass] = useState(22); // higher = slower indoor temp changes

  // Equipment model knobs (also abstract)
  const [hpCapacity, setHpCapacity] = useState(9.0); // "units of heat"
  const [auxCapacity, setAuxCapacity] = useState(12.0);

  // Thermostat settings
  const [stagingManual, setStagingManual] = useState(true);
  const [compressorMinOutdoor, setCompressorMinOutdoor] = useState(15);
  const [auxMaxOutdoor, setAuxMaxOutdoor] = useState(30);
  const [auxSimultaneous, setAuxSimultaneous] = useState(false);
  const [auxDelta, setAuxDelta] = useState(4); // if indoor is this far below setpoint, allow aux (when aux is allowed)

  const [deadband, setDeadband] = useState(0.7);

  // "Auto" (overly conservative) defaults to demonstrate the common complaint
  const autoDefaults = {
    compressorMinOutdoor: 30,
    auxMaxOutdoor: 40,
    auxSimultaneous: true,
    auxDelta: 2,
  };

  const sim = useMemo(() => {
    const hours = 12;
    let Tin = initialIndoorF;

    const outdoor = [];
    const indoor = [];
    const modes = [];
    const cost = [];

    // Used for a simple "money pain" score
    // We treat HP as 1 cost unit per capacity-hour and Aux as 3.5 cost units per capacity-hour.
    // (This mimics COP-ish behavior without pretending it's exact.)
    const hpCostPer = 1.0;
    const auxCostPer = 3.5;

    const cfg = stagingManual
      ? {
          compressorMinOutdoor,
          auxMaxOutdoor,
          auxSimultaneous,
          auxDelta,
        }
      : autoDefaults;

    for (let h = 0; h < hours; h++) {
      const Tout = outdoorTempAtHour(h, outdoorStartF, outdoorEndF);
      outdoor.push(Tout);

      // Does thermostat call for heat?
      const callHeat = Tin < setpointF - deadband;

      const compressorAllowed = Tout >= cfg.compressorMinOutdoor;
      const auxAllowed = Tout <= cfg.auxMaxOutdoor;

      // Base capacities (could be made temp-dependent, but we keep it simple)
      let hpOut = 0;
      let auxOut = 0;
      let mode = "OFF";

      if (callHeat) {
        // First: try heat pump if allowed
        if (compressorAllowed) {
          hpOut = hpCapacity;
          mode = "HP";
        }

        // Compute current heat loss rate
        const loss = heatLossFactor * (Tin - Tout); // "units of heat per hour"

        // If HP alone cannot keep up OR we are far from setpoint, consider aux (if allowed)
        const needAuxForCapacity = hpOut > 0 ? hpOut < loss : true;
        const needAuxForRecovery = setpointF - Tin >= cfg.auxDelta;

        if (auxAllowed && (needAuxForCapacity || needAuxForRecovery)) {
          // If compressor is not running, aux is the only heat.
          // If compressor is running:
          //   - if simultaneous enabled: use both
          //   - if not: keep HP only (more efficient) and accept slower recovery
          if (hpOut <= 0) {
            auxOut = auxCapacity;
            mode = "AUX";
          } else if (cfg.auxSimultaneous) {
            auxOut = auxCapacity;
            mode = "BOTH";
          }
        }

        // If compressor not allowed, but aux allowed, aux takes over
        if (!compressorAllowed && auxAllowed) {
          hpOut = 0;
          auxOut = auxCapacity;
          mode = "AUX";
        }
      }

      // Update indoor temp with a first-order model
      const loss = heatLossFactor * (Tin - Tout);
      const heatIn = hpOut + auxOut;
      const dT = (heatIn - loss) / thermalMass;
      Tin = Tin + dT;

      indoor.push(Tin);
      modes.push(mode);

      // Cost score
      const hourCost = hpOut * hpCostPer + auxOut * auxCostPer;
      cost.push(hourCost);
    }

    const totalCost = cost.reduce((a, b) => a + b, 0);
    const hpHours = modes.filter((m) => m === "HP").length;
    const auxHours = modes.filter((m) => m === "AUX").length;
    const bothHours = modes.filter((m) => m === "BOTH").length;

    const heldSetpoint = indoor[indoor.length - 1] >= setpointF - deadband;

    return {
      outdoor,
      indoor,
      modes,
      cost,
      totalCost,
      hpHours,
      auxHours,
      bothHours,
      heldSetpoint,
      cfg,
    };
  }, [
    setpointF,
    initialIndoorF,
    outdoorStartF,
    outdoorEndF,
    heatLossFactor,
    thermalMass,
    hpCapacity,
    auxCapacity,
    stagingManual,
    compressorMinOutdoor,
    auxMaxOutdoor,
    auxSimultaneous,
    auxDelta,
    deadband,
  ]);

  const pain = useMemo(() => {
    // Make it human-readable: normalize to a "relative cost" baseline
    // where 100 = this run; lower is better.
    // We'll also compute a comparison run: conservative Auto.
    const hours = 12;

    function runWith(cfg) {
      let Tin = initialIndoorF;
      let total = 0;
      for (let h = 0; h < hours; h++) {
        const Tout = outdoorTempAtHour(h, outdoorStartF, outdoorEndF);
        const callHeat = Tin < setpointF - deadband;
        const compressorAllowed = Tout >= cfg.compressorMinOutdoor;
        const auxAllowed = Tout <= cfg.auxMaxOutdoor;

        let hpOut = 0;
        let auxOut = 0;

        if (callHeat) {
          if (compressorAllowed) hpOut = hpCapacity;

          const loss = heatLossFactor * (Tin - Tout);
          const needAuxForCapacity = hpOut > 0 ? hpOut < loss : true;
          const needAuxForRecovery = setpointF - Tin >= cfg.auxDelta;

          if (auxAllowed && (needAuxForCapacity || needAuxForRecovery)) {
            if (hpOut <= 0) {
              auxOut = auxCapacity;
            } else if (cfg.auxSimultaneous) {
              auxOut = auxCapacity;
            }
          }

          if (!compressorAllowed && auxAllowed) {
            hpOut = 0;
            auxOut = auxCapacity;
          }
        }

        const loss = heatLossFactor * (Tin - Tout);
        const heatIn = hpOut + auxOut;
        const dT = (heatIn - loss) / thermalMass;
        Tin += dT;

        total += hpOut * 1.0 + auxOut * 3.5;
      }
      return total;
    }

    const auto = runWith(autoDefaults);
    const chosen = runWith(sim.cfg);

    const idx = auto > 0 ? (chosen / auto) * 100 : 100;
    return {
      relativeVsAuto: idx,
      auto,
      chosen,
    };
  }, [
    autoDefaults,
    sim.cfg,
    initialIndoorF,
    outdoorStartF,
    outdoorEndF,
    setpointF,
    deadband,
    hpCapacity,
    auxCapacity,
    heatLossFactor,
    thermalMass,
  ]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
            Ecobee / Heat Pump / Aux Heat
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Why did my electric bill explode? (Visual simulator)
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Most "6× bill" stories are the same: the thermostat is letting <span className="font-semibold">aux heat (resistance strips)</span> do
            the heavy lifting because thresholds are conservative (often <span className="font-mono">Aux max = 40°F</span> and
            <span className="font-mono"> Compressor min = 30°F</span>). This page turns that logic into a simple overnight simulation.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">The recommended moves</div>
              <ol className="mt-3 space-y-2 text-sm text-slate-700">
                <li>
                  <span className="font-semibold">1)</span> Set <span className="font-mono">Configure Staging → MANUAL</span> (stop "overly conservative" auto behavior).
                </li>
                <li>
                  <span className="font-semibold">2)</span> Lower <span className="font-mono">Compressor Min Outdoor Temp</span> (start ~5–15°F; lower if cold-climate).
                </li>
                <li>
                  <span className="font-semibold">3)</span> Lower <span className="font-mono">Aux Heat Max Outdoor Temp</span> (start ~20–30°F; lower if it still holds setpoint).
                </li>
                <li>
                  <span className="font-semibold">4)</span> Consider disabling <span className="font-mono">Aux Heat Simultaneous Operation</span> (can be $$$).
                </li>
                <li>
                  <span className="font-semibold">5)</span> Watch a cold night: <span className="font-semibold">does indoor temp hold setpoint?</span> If not, allow a little aux.
                </li>
              </ol>
              <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                This sim is intentionally simplified. It's meant to teach the *shape* of the logic, not replace your installer.
              </div>
            </div>

            <Toggle
              label="Configure Staging: MANUAL"
              checked={stagingManual}
              onChange={setStagingManual}
              hint={
                stagingManual
                  ? "Manual = you control the thresholds below."
                  : "Auto = we force the common conservative defaults (Comp min 30°F, Aux max 40°F, Aux+HP allowed)."
              }
            />

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
              <Slider
                label="Compressor Min Outdoor Temp"
                value={stagingManual ? compressorMinOutdoor : autoDefaults.compressorMinOutdoor}
                min={-10}
                max={45}
                step={1}
                suffix="°F"
                onChange={setCompressorMinOutdoor}
                hint="Below this, the heat pump compressor is locked out (no HP)."
              />
              <Slider
                label="Aux Heat Max Outdoor Temp"
                value={stagingManual ? auxMaxOutdoor : autoDefaults.auxMaxOutdoor}
                min={-10}
                max={55}
                step={1}
                suffix="°F"
                onChange={setAuxMaxOutdoor}
                hint="Above this, aux heat is not allowed to run."
              />
            </div>

            <Toggle
              label="Aux Heat Simultaneous Operation"
              checked={stagingManual ? auxSimultaneous : autoDefaults.auxSimultaneous}
              onChange={setAuxSimultaneous}
              hint="If enabled, the thermostat can run HP + aux together (fast recovery, often expensive)."
            />

            <Slider
              label="Aux engagement delta (soft trigger)"
              value={stagingManual ? auxDelta : autoDefaults.auxDelta}
              min={1}
              max={10}
              step={1}
              suffix="°F"
              onChange={setAuxDelta}
              hint="If indoor temp is this far below setpoint (and aux is allowed), the thermostat may use aux to recover faster."
            />
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Slider
                label="Setpoint"
                value={setpointF}
                min={60}
                max={76}
                step={1}
                suffix="°F"
                onChange={setSetpointF}
                hint="Target indoor temperature."
              />
              <Slider
                label="Initial indoor temp"
                value={initialIndoorF}
                min={55}
                max={76}
                step={1}
                suffix="°F"
                onChange={setInitialIndoorF}
                hint="Indoor temperature at the start of the 12-hour night."
              />
              <Slider
                label="Outdoor temp (start of night)"
                value={outdoorStartF}
                min={-5}
                max={55}
                step={1}
                suffix="°F"
                onChange={setOutdoorStartF}
                hint="We simulate a gradual dip across the night."
              />
              <Slider
                label="Outdoor temp (end of night)"
                value={outdoorEndF}
                min={-10}
                max={55}
                step={1}
                suffix="°F"
                onChange={setOutdoorEndF}
                hint="Lower end temp = more stress test."
              />
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <Slider
                label="House heat loss (leakiness)"
                value={heatLossFactor}
                min={0.2}
                max={1.2}
                step={0.05}
                onChange={setHeatLossFactor}
                hint="Higher = more heat needed to maintain temperature."
              />
              <Slider
                label="Thermal mass"
                value={thermalMass}
                min={10}
                max={40}
                step={1}
                onChange={setThermalMass}
                hint="Higher = indoor temp changes slower (heavier building)."
              />
              <Slider
                label="Deadband"
                value={deadband}
                min={0.2}
                max={1.5}
                step={0.1}
                suffix="°F"
                onChange={setDeadband}
                hint="How far below setpoint before heat is called."
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Slider
                label="Heat pump capacity"
                value={hpCapacity}
                min={3}
                max={16}
                step={0.5}
                onChange={setHpCapacity}
                hint="Higher = stronger heat pump (can carry house lower)."
              />
              <Slider
                label="Aux heat capacity"
                value={auxCapacity}
                min={4}
                max={24}
                step={0.5}
                onChange={setAuxCapacity}
                hint="Higher = bigger strips (more heat, more cost)."
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <MiniChart
                data={sim.outdoor}
                yMin={Math.min(...sim.outdoor) - 2}
                yMax={Math.max(...sim.outdoor) + 2}
                title="Outdoor temperature (simulated night)"
                unit="°F"
              />
              <MiniChart
                data={sim.indoor}
                yMin={Math.min(...sim.indoor, setpointF - 8)}
                yMax={Math.max(...sim.indoor, setpointF + 2)}
                title="Indoor temperature (sim result)"
                unit="°F"
              />
            </div>

            <ModeStrip modes={sim.modes} />

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">What happened?</div>
                  <div className="mt-2 text-sm text-slate-700">
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      <span>
                        HP hours: <span className="font-mono font-semibold">{sim.hpHours}</span>
                      </span>
                      <span>
                        Aux hours: <span className="font-mono font-semibold">{sim.auxHours}</span>
                      </span>
                      <span>
                        Both hours: <span className="font-mono font-semibold">{sim.bothHours}</span>
                      </span>
                      <span>
                        End indoor: <span className="font-mono font-semibold">{fmt(sim.indoor[sim.indoor.length - 1], 1)}°F</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-700">Relative cost vs conservative Auto</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">{fmt(pain.relativeVsAuto, 0)}%</div>
                  <div className="mt-1 text-xs text-slate-600">
                    {pain.relativeVsAuto < 100
                      ? `~${fmt(100 - pain.relativeVsAuto, 0)}% cheaper than the "aux party starts at 40°F" setup.`
                      : `More expensive than the conservative defaults (usually because aux is running a lot).`}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl p-4 text-sm text-slate-800 ring-1 ring-slate-200">
                <div className="font-semibold">Interpretation</div>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-slate-700">
                  <li>
                    If the mode strip is mostly <span className="font-semibold">red</span> at outdoor temps in the 30s, your thresholds are
                    almost certainly too conservative.
                  </li>
                  <li>
                    The only real test is: <span className="font-semibold">does indoor temp hold setpoint overnight</span>? If yes, you can
                    push aux lower.
                  </li>
                  <li>
                    If indoor temp falls below setpoint for hours, you either need more heat capacity (bigger HP / better envelope) or you
                    need to allow some aux.
                  </li>
                </ul>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div
                    className={`rounded-xl p-3 text-sm ring-1 ${
                      sim.heldSetpoint ? "bg-emerald-50 ring-emerald-200" : "bg-amber-50 ring-amber-200"
                    }`}
                  >
                    <div className="font-semibold">
                      Setpoint hold: {sim.heldSetpoint ? "✅ Held" : "⚠️ Did not hold"}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      {sim.heldSetpoint
                        ? "Nice. Try lowering Aux Max (or disabling simultaneous) to reduce aux usage further."
                        : "If this matches reality, either raise aux usage slightly (or enable simultaneous temporarily) OR address envelope/heat pump capacity."}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 ring-1 ring-slate-200">
                    <div className="font-semibold text-slate-700">Quick calibration trick</div>
                    <div className="mt-1">
                      Set outdoor temps to match last night, then move <span className="font-mono">House heat loss</span> until the mode strip
                      "feels like" your beestat runtime. Now the sim becomes a decent twin for experimenting safely.
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-500">
                Disclaimer: This is an educational simulator. Real systems have defrost cycles, variable capacity, temperature-dependent
                COP/capacity, duct losses, and installer-specific wiring/staging.
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-10 text-center text-xs text-slate-500">
          Built for "why is aux running so much?" threads. Make the hidden thermostat logic visible.
        </footer>
      </div>
    </div>
  );
}
