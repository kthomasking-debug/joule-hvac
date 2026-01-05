import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";

/**
 * Whole-Home Ventilator + Ecobee Premium (Single-Page Explainer)
 * - Wiring diagrams (G-tied "dumb" vs ACC-controlled "smart-ish")
 * - Interactive contactors/relays that open/close based on inputs & settings
 * - Ecobee settings navigation (menu path + checklist)
 *
 * Drop this into a React app (Vite/Next). Tailwind optional; it looks fine without it.
 */

const WiringMode = {
  G_TIED: "G_TIED",
  ACC_DRY_CONTACT: "ACC_DRY_CONTACT",
  ACC_WITH_RELAY_24V: "ACC_WITH_RELAY_24V"
};

const VentType = {
  FRESH_AIR_DAMPER: "FRESH_AIR_DAMPER",
  HRV_ERV: "HRV_ERV",
  INLINE_FAN: "INLINE_FAN"
};

const AccBehavior = {
  VENTILATOR: "VENTILATOR",
  HUMIDIFIER: "HUMIDIFIER",
  DEHUMIDIFIER: "DEHUMIDIFIER",
  NONE: "NONE"
};

// CallState interface
// {
//   callHeat: boolean;
//   callCool: boolean;
//   callFan: boolean;
//   callVent: boolean; // only meaningful in ACC modes
// };

// EcobeeConfig interface
// {
//   wiringMode: WiringMode;
//   ventType: VentType;
//   accessoryConfiguredAs: AccBehavior;
//   minVentMinutesPerHour: number; // target runtime
//   allowVentWithHVAC: boolean; // allow ventilation to piggyback on HVAC fan/calls
//   lockoutBelowOutdoorF: number | null; // optional simplistic lockout
//   lockoutAboveOutdoorF: number | null;
//   useEcobeeToControlVent: boolean;
//   pekInstalled: boolean;
//   hasSpareConductors: boolean;
//   outdoorTempF: number;
// };

// Relay interface
// {
//   name: string;
//   coilEnergized: boolean;
//   contactClosed: boolean; // assume N.O. contact closes when coil energized
//   notes: string;
// };

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function Label({ title, children }) {
  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded-xl p-3.5 bg-white dark:bg-gray-800">
      <div className="font-bold mb-2">{title}</div>
      <div className="opacity-95">{children}</div>
    </div>
  );
}

function Pill({ on, text }) {
  return (
    <span
      className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full border font-semibold ${
        on
          ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800"
          : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800"
      }`}
    >
      <span
        className={`w-2.5 h-2.5 rounded-full ${
          on ? "bg-emerald-500" : "bg-gray-400 dark:bg-gray-500"
        }`}
      />
      {text}
    </span>
  );
}

function Step({ n, title, sub }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-7 h-7 rounded-lg border border-gray-300 dark:border-gray-600 grid place-items-center font-extrabold bg-gray-50 dark:bg-gray-800">
        {n}
      </div>
      <div>
        <div className="font-extrabold">{title}</div>
        {sub ? <div className="opacity-80 mt-0.5">{sub}</div> : null}
      </div>
    </div>
  );
}

function DiagramBox({ title, ascii, footer }) {
  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 font-bold">{title}</div>
      <pre className="m-0 p-3.5 text-xs leading-5 overflow-x-auto bg-gray-50 dark:bg-gray-900">
        {ascii}
      </pre>
      {footer ? <div className="p-3 border-t border-gray-200 dark:border-gray-700">{footer}</div> : null}
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
  hint,
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="font-bold">{label}</div>
        {hint ? <div className="opacity-75 mt-0.5 text-sm">{hint}</div> : null}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`border rounded-full px-3 py-2 font-extrabold cursor-pointer min-w-[5.625rem] transition-colors ${
          value
            ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800"
            : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800"
        }`}
      >
        {value ? "ON" : "OFF"}
      </button>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
  hint,
}) {
  return (
    <div className="grid gap-2">
      <div>
        <div className="font-bold">{label}</div>
        {hint ? <div className="opacity-75 mt-0.5 text-sm">{hint}</div> : null}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  hint,
  suffix,
}) {
  return (
    <div className="grid gap-2">
      <div>
        <div className="font-bold">{label}</div>
        {hint ? <div className="opacity-75 mt-0.5 text-sm">{hint}</div> : null}
      </div>
      <div className="flex items-center gap-2.5">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1"
        />
        <div className="min-w-[4.875rem] text-right font-extrabold border border-gray-300 dark:border-gray-600 rounded-xl px-2.5 py-2 bg-white dark:bg-gray-800">
          {value}
          {suffix ? ` ${suffix}` : ""}
        </div>
      </div>
    </div>
  );
}

function Tabs({
  tabs,
  active,
  setActive,
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setActive(t.id)}
          className={`border border-gray-300 dark:border-gray-600 rounded-full px-3 py-2 font-extrabold cursor-pointer transition-colors ${
            active === t.id
              ? "border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800"
              : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function buildAsciiDiagram(mode, ventType, pekInstalled) {
  // Keep diagrams simple, accurate, and "conceptual" (not brand-specific terminal numbers)
  const header = `Legend: R=24V hot, C=24V common, G=Fan call, Y=Cool, W=Heat, ACC=Accessory output (dry contact or 24V depending config)\n`;

  if (mode === "G_TIED") {
    return (
      header +
      `
   +-----------------+                        +----------------------+
   |   Ecobee        |                        |  HVAC / Air Handler  |
   |                 |                        |  (control board)     |
   |  R  C  Y  W  G  |----------------------->| R  C  Y  W  G        |
   +-----------------+                        +----------------------+
                         |
                         |  (ventilator tied into G / blower circuit)
                         v
                   +------------------+
                   | Whole-home vent  |
                   | / fresh-air damper|
                   | "RUN when FAN"   |
                   +------------------+

What happens:
- Ventilator runs ONLY when G is energized (fan call).
- No independent ventilation schedule / minutes-per-hour target.
- Simple, but not "smart ventilation".
` +
      (pekInstalled
        ? `\nPEK note: PEK often appears when you don't have enough conductors. In this mode, you can still "piggyback on G", but you won't get independent ACC control without more wires.\n`
        : "")
    );
  }

  if (mode === "ACC_DRY_CONTACT") {
    return (
      header +
      `
   +-----------------+                     +----------------------+
   |   Ecobee        |                     |  HVAC / Air Handler  |
   |                 |                     |  (control board)     |
   |  R  C  Y  W  G  |-------------------->| R  C  Y  W  G        |
   |  ACC+     ACC-  |----(dry contact)----> Vent/IAQ input OR ----+
   +-----------------+                      (to accessory relay coil)

                   +----------------------------+
                   | Vent / damper / HRV / ERV  |
                   | Control input expects      |
                   | "dry contact closure"      |
                   +----------------------------+

What happens:
- Ecobee closes ACC contacts to call ventilation (independent of G).
- Ecobee can target X minutes per hour (vent schedule).
- If your accessory expects 24V instead of dry contact, use a relay (see next diagram).
`
    );
  }

  // ACC_WITH_RELAY_24V
  return (
    header +
    `
   +-----------------+                          +----------------------+
   |   Ecobee        |                          |  HVAC / Air Handler  |
   |                 |                          |  (control board)     |
   |  R  C  Y  W  G  |------------------------->| R  C  Y  W  G        |
   |  ACC+     ACC-  |----(dry contact)----+    +----------------------+
   +-----------------+                     |
                                           v
                                    +-------------+
                                    |   RELAY     |
                                    |  coil: 24V  |
  R (24V) ----+-------------------->|  contacts:  |
             (fused)               |  N.O. close  |----> Vent 24V input
  C (common)--+-------------------->|  when coil  |----> Vent common
                                    +-------------+

Accessory expects 24V control:
- Ecobee ACC closes -> relay coil energizes -> relay contacts switch 24V to the ventilator control input.
- This preserves Ecobee's independent ventilation scheduling.
`
  );
}

function computeRelays(config, calls) {
  // Interpret Ecobee output behavior conceptually.
  // - In G_TIED mode: vent runs when fan call is active (G energized).
  // - In ACC modes: vent runs when callVent is active AND accessoryConfiguredAs==VENTILATOR AND useEcobeeToControlVent.
  // - Lockouts apply to ventilation call.
  const lockout =
    (config.lockoutBelowOutdoorF != null && config.outdoorTempF < config.lockoutBelowOutdoorF) ||
    (config.lockoutAboveOutdoorF != null && config.outdoorTempF > config.lockoutAboveOutdoorF);

  const ventEnabledByConfig =
    config.useEcobeeToControlVent && config.accessoryConfiguredAs === "VENTILATOR" && !lockout;

  const ecobeeAccActive =
    config.wiringMode !== "G_TIED" ? (calls.callVent && ventEnabledByConfig) : false;

  const fanGActive = calls.callFan || calls.callHeat || calls.callCool; // typical: heat/cool implies fan, but varies by system
  // We'll show fan call separately so users can toggle it.

  const ventRunning =
    config.wiringMode === "G_TIED" ? fanGActive : ecobeeAccActive || (config.allowVentWithHVAC && fanGActive && ventEnabledByConfig);

  const relays = [];

  // Fan relay (inside air handler)
  relays.push({
    name: "Air-handler FAN relay (G → blower)",
    coilEnergized: fanGActive,
    contactClosed: fanGActive,
    notes:
      "When energized, blower runs. If your ventilator is tied to G, this also triggers ventilation.",
  });

  if (config.wiringMode === "G_TIED") {
    relays.push({
      name: "Vent interlock (tied to G)",
      coilEnergized: fanGActive,
      contactClosed: ventRunning,
      notes:
        "This is the 'dumb' method: ventilation follows blower calls (no independent schedule).",
    });
  } else if (config.wiringMode === "ACC_DRY_CONTACT") {
    relays.push({
      name: "Ecobee ACC dry-contact output",
      coilEnergized: ecobeeAccActive,
      contactClosed: ecobeeAccActive,
      notes:
        "Ecobee closes ACC contact to request ventilation. Accessory must accept dry contact closure.",
    });
    relays.push({
      name: "Ventilator control input",
      coilEnergized: ventRunning,
      contactClosed: ventRunning,
      notes:
        "Accessory runs when its control input is asserted. Some units want dry contact; others want 24V.",
    });
  } else {
    relays.push({
      name: "Ecobee ACC dry-contact output (drives relay coil)",
      coilEnergized: ecobeeAccActive,
      contactClosed: ecobeeAccActive,
      notes:
        "ACC contact closure energizes a separate relay coil (using R/C).",
    });
    relays.push({
      name: "External RELAY (coil + N.O. contact)",
      coilEnergized: ecobeeAccActive,
      contactClosed: ecobeeAccActive,
      notes:
        "When coil energizes, N.O. contact closes and switches 24V to the ventilator's control input.",
    });
    relays.push({
      name: "Ventilator 24V control input",
      coilEnergized: ventRunning,
      contactClosed: ventRunning,
      notes:
        "Accessory sees 24V across its control terminals when relay closes.",
    });
  }

  // Add "lockout" as a pseudo relay/info
  relays.push({
    name: "Vent lockout logic (temp-based)",
    coilEnergized: lockout,
    contactClosed: lockout,
    notes:
      lockout
        ? "Lockout is ACTIVE: Ecobee should avoid calling ventilation at this outdoor temperature."
        : "No lockout: ventilation calls are permitted.",
  });

  return relays;
}

function computeGuidance(config) {
  const issues = [];

  if (config.wiringMode !== "G_TIED" && config.pekInstalled) {
    issues.push({
      level: "warn",
      text:
        "You selected ACC control but PEK is marked installed. In many real installs, PEK indicates not enough conductors—ACC control often requires additional wires or re-pull cable.",
    });
  }

  if (config.wiringMode !== "G_TIED" && !config.hasSpareConductors) {
    issues.push({
      level: "warn",
      text:
        "ACC control generally needs available conductors/terminals. If you don't have spare wires, consider pulling 18/7 (or at least 18/5 + accessory pair).",
    });
  }

  if (config.accessoryConfiguredAs !== "VENTILATOR" && config.useEcobeeToControlVent) {
    issues.push({
      level: "bad",
      text:
        "Ecobee accessory is not configured as 'Ventilator'. If you want Ecobee to manage fresh-air minutes-per-hour, set accessory type to Ventilator/HRV/ERV (as applicable).",
    });
  }

  if (config.wiringMode === "G_TIED") {
    issues.push({
      level: "warn",
      text:
        "G-tied ventilation runs only when the blower runs. You won't get independent ventilation targets (minutes per hour) and the ventilator may under- or over-ventilate depending on HVAC runtime.",
    });
  } else {
    issues.push({
      level: "good",
      text:
        "ACC-based control enables independent ventilation scheduling (minutes per hour) and better coordination with HVAC.",
    });
  }

  if (config.minVentMinutesPerHour < 5 && config.useEcobeeToControlVent) {
    issues.push({
      level: "warn",
      text:
        "Ventilation target is very low (<5 min/hr). Many homes target higher, but you should follow local code, IAQ needs, and the ventilator manufacturer guidance.",
    });
  }

  if (config.lockoutBelowOutdoorF != null && config.lockoutBelowOutdoorF > 45) {
    issues.push({
      level: "warn",
      text:
        "Your low-temp lockout is set fairly high. That may prevent ventilation on many winter days. Consider your climate, humidity, and whether your ventilator is HRV/ERV.",
    });
  }

  return issues;
}

export default function EcobeeVentilatorExplainerPage() {
  const [tab, setTab] = useState("overview");

  const [config, setConfig] = useState({
    wiringMode: WiringMode.G_TIED,
    ventType: VentType.FRESH_AIR_DAMPER,
    accessoryConfiguredAs: AccBehavior.VENTILATOR,
    minVentMinutesPerHour: 20,
    allowVentWithHVAC: true,
    lockoutBelowOutdoorF: 10,
    lockoutAboveOutdoorF: null,
    useEcobeeToControlVent: true,
    pekInstalled: true,
    hasSpareConductors: false,
    outdoorTempF: 32,
  });

  const [calls, setCalls] = useState({
    callHeat: false,
    callCool: false,
    callFan: false,
    callVent: true,
  });

  const ascii = useMemo(
    () => buildAsciiDiagram(config.wiringMode, config.ventType, config.pekInstalled),
    [config.wiringMode, config.ventType, config.pekInstalled]
  );

  const relays = useMemo(() => computeRelays(config, calls), [config, calls]);
  const guidance = useMemo(() => computeGuidance(config), [config]);

  const tabs = [
    { id: "overview", label: "Answer (Plain English)" },
    { id: "wiring", label: "Wiring Diagrams" },
    { id: "sim", label: "Relays / Contactors Simulator" },
    { id: "menus", label: "Ecobee Settings Navigation" },
    { id: "troubleshooting", label: "Troubleshooting + What to Post" },
  ];

  const bannerStyle = "border border-gray-300 dark:border-gray-600 rounded-2xl p-4 bg-gradient-to-b from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800";

  const page = "font-sans p-4.5 text-slate-900 dark:text-slate-100";

  return (
    <div className={page}>
      <div className={bannerStyle}>
        <div className="flex justify-between gap-3 flex-wrap">
          <div>
            <div className="text-2xl font-black">Whole-Home Ventilator + Ecobee Premium</div>
            <div className="opacity-80 mt-1.5">
              Does it "just run whenever"? Or does Ecobee control it? (With diagrams + a relay simulator.)
            </div>
            <div className="mt-3">
              <Link
                to="/tools/ecobee-ventilator-wizard"
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-white font-bold rounded-lg transition-colors"
              >
                🚀 Try the Interactive Setup Wizard
              </Link>
            </div>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <Pill on={config.wiringMode === "G_TIED"} text="G-tied mode" />
            <Pill on={config.wiringMode !== "G_TIED"} text="ACC-controlled mode" />
            <Pill on={!config.pekInstalled} text="No PEK" />
            <Pill on={config.pekInstalled} text="PEK installed" />
          </div>
        </div>
      </div>

      <div className="mt-3.5">
        <Tabs tabs={tabs} active={tab} setActive={setTab} />
      </div>

      {/* GLOBAL QUICK CONTROLS */}
      <div className="mt-3.5 grid grid-cols-[1.2fr_0.8fr] gap-3.5">
        <Label title="Your Setup (adjust to match the OP)">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Wiring approach"
              value={config.wiringMode}
              onChange={(v) => setConfig((c) => ({ ...c, wiringMode: v }))}
              options={[
                { value: WiringMode.G_TIED, label: "Vent tied to G (runs with blower/fan) — simple but dumb" },
                { value: WiringMode.ACC_DRY_CONTACT, label: "Vent on ACC dry-contact — true Ecobee ventilation control" },
                { value: WiringMode.ACC_WITH_RELAY_24V, label: "ACC drives a relay to switch 24V — for vents needing 24V control" },
              ]}
              hint="If your vent is spliced into the green wire, you're likely in G-tied mode right now."
            />

            <Select
              label="Ventilation device"
              value={config.ventType}
              onChange={(v) => setConfig((c) => ({ ...c, ventType: v }))}
              options={[
                { value: VentType.FRESH_AIR_DAMPER, label: "Fresh air damper (opens/closes)" },
                { value: VentType.HRV_ERV, label: "HRV / ERV (balanced ventilation unit)" },
                { value: VentType.INLINE_FAN, label: "Inline supply fan / ventilator" },
              ]}
            />

            <Select
              label="Ecobee accessory configured as"
              value={config.accessoryConfiguredAs}
              onChange={(v) => setConfig((c) => ({ ...c, accessoryConfiguredAs: v }))}
              options={[
                { value: AccBehavior.VENTILATOR, label: "Ventilator / HRV / ERV (recommended for fresh-air control)" },
                { value: AccBehavior.HUMIDIFIER, label: "Humidifier (not for ventilation)" },
                { value: AccBehavior.DEHUMIDIFIER, label: "Dehumidifier (not for ventilation)" },
                { value: AccBehavior.NONE, label: "Not configured" },
              ]}
              hint="If you want minutes-per-hour ventilation, this must be Ventilator/HRV/ERV."
            />

            <div className="grid gap-2.5">
              <Toggle
                label="Use Ecobee to control ventilation"
                value={config.useEcobeeToControlVent}
                onChange={(v) => setConfig((c) => ({ ...c, useEcobeeToControlVent: v }))}
                hint="If OFF, the vent will only run due to external wiring logic (like G-tied)."
              />
              <Toggle
                label="Allow vent to piggyback on HVAC runtime"
                value={config.allowVentWithHVAC}
                onChange={(v) => setConfig((c) => ({ ...c, allowVentWithHVAC: v }))}
                hint="Some setups allow ventilation to run while heating/cooling to avoid extra fan-only cycles."
              />
            </div>

            <div className="grid gap-2.5">
              <Toggle
                label="PEK installed"
                value={config.pekInstalled}
                onChange={(v) => setConfig((c) => ({ ...c, pekInstalled: v }))}
                hint="PEK usually means you were short on wires. ACC control often needs more conductors."
              />
              <Toggle
                label="Spare conductors available (or you will pull new cable)"
                value={config.hasSpareConductors}
                onChange={(v) => setConfig((c) => ({ ...c, hasSpareConductors: v }))}
                hint="For clean installs: pull 18/7 (or at least enough for R,C,Y,W,G + ACC)."
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <NumberField
              label="Ventilation target"
              value={config.minVentMinutesPerHour}
              onChange={(v) => setConfig((c) => ({ ...c, minVentMinutesPerHour: clamp(v, 0, 60) }))}
              min={0}
              max={60}
              step={1}
              suffix="min/hr"
              hint="Ecobee-style: 'Run ventilator X minutes per hour.'"
            />
            <NumberField
              label="Outdoor temp"
              value={config.outdoorTempF}
              onChange={(v) => setConfig((c) => ({ ...c, outdoorTempF: clamp(v, -10, 110) }))}
              min={-10}
              max={110}
              step={1}
              suffix="°F"
              hint="Used only to demonstrate lockouts."
            />
            <NumberField
              label="Lockout below"
              value={config.lockoutBelowOutdoorF ?? 0}
              onChange={(v) => setConfig((c) => ({ ...c, lockoutBelowOutdoorF: v }))} // keep simple
              min={-10}
              max={60}
              step={1}
              suffix="°F"
              hint="Optional: disable ventilation when it's too cold (example logic)."
            />
            <NumberField
              label="Lockout above"
              value={config.lockoutAboveOutdoorF ?? 110}
              onChange={(v) => setConfig((c) => ({ ...c, lockoutAboveOutdoorF: v }))} // keep simple
              min={60}
              max={110}
              step={1}
              suffix="°F"
              hint="Optional: disable ventilation when it's too hot (example logic)."
            />
          </div>
        </Label>

        <Label title="Live Status (based on your toggles)">
          <div className="grid gap-2.5">
            <div className="flex gap-2 flex-wrap">
              <Pill on={calls.callHeat} text="Heat call (W)" />
              <Pill on={calls.callCool} text="Cool call (Y)" />
              <Pill on={calls.callFan} text="Fan call (G)" />
              <Pill on={calls.callVent} text="Vent call (ACC)" />
            </div>

            <div className="mt-2 grid gap-2.5">
              <Toggle
                label="Simulate: Thermostat calling HEAT (W)"
                value={calls.callHeat}
                onChange={(v) => setCalls((s) => ({ ...s, callHeat: v }))}
              />
              <Toggle
                label="Simulate: Thermostat calling COOL (Y)"
                value={calls.callCool}
                onChange={(v) => setCalls((s) => ({ ...s, callCool: v }))}
              />
              <Toggle
                label="Simulate: Thermostat calling FAN (G)"
                value={calls.callFan}
                onChange={(v) => setCalls((s) => ({ ...s, callFan: v }))}
                hint="In many systems, heat/cool implies fan. Here it's explicit so you can see cause/effect."
              />
              <Toggle
                label="Simulate: Ecobee wants VENT minutes right now (ACC)"
                value={calls.callVent}
                onChange={(v) => setCalls((s) => ({ ...s, callVent: v }))}
                hint="Only matters in ACC modes + when accessory is configured as Ventilator."
              />
            </div>

            <div className="mt-2.5 border-t border-gray-200 dark:border-gray-700 pt-2.5">
              <div className="font-extrabold mb-1.5">Interpretation</div>
              <ul className="m-0 pl-4.5 opacity-90">
                <li>
                  <b>If your vent is tied to G:</b> it runs when the blower runs (fan/heating/cooling runtime).
                </li>
                <li>
                  <b>If your vent is on ACC:</b> it can run independently to hit a minutes-per-hour target.
                </li>
                <li>
                  Temp lockouts can prevent ventilation calls at extremes (demonstration logic here).
                </li>
              </ul>
            </div>
          </div>
        </Label>
      </div>

      {/* TAB CONTENT */}
      <div className="mt-3.5">
        {tab === "overview" ? (
          <div className="grid gap-3.5">
            <Label title="So… does the whole-home ventilator just run whenever?">
              <div className="grid gap-2.5 text-[15.5px] leading-[1.55]">
                <div>
                  <b>No</b> — not in a useful "smart ventilation" way.
                </div>
                <div>
                  If your ventilator is currently tied into the <b>green (G) wire</b>, then it runs{" "}
                  <b>only when the blower/fan runs</b>. That means:
                  <ul className="mt-2 mb-0 pl-4.5">
                    <li>No independent "fresh air minutes per hour" target</li>
                    <li>Ventilation depends on how much heat/cool/fan runtime you happen to get</li>
                    <li>Bedrooms that run cooler can cause extra fan/heat cycles → extra "vent" runtime too</li>
                  </ul>
                </div>

                <div>
                  If you want Ecobee to truly manage it, the ventilator should be controlled via{" "}
                  <b>ACC terminals (Accessory)</b> as a <b>Ventilator / HRV / ERV</b>.
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-2.5">
                  <div className="font-extrabold mb-1.5">Quick rule</div>
                  <div>
                    <b>G-tied:</b> "Vent runs when fan runs." (simple, dumb)
                  </div>
                  <div>
                    <b>ACC:</b> "Vent runs when Ecobee says so (minutes-per-hour)." (smart-ish)
                  </div>
                </div>
              </div>
            </Label>

            <Label title="What the OP (green wire + PEK) should do next">
              <div className="grid gap-2.5">
                <Step
                  n={1}
                  title="Identify what the ventilator expects for control"
                  sub="Dry contact closure? Or 24V control input? (Model number + manual usually says.)"
                />
                <Step
                  n={2}
                  title="Decide: keep G-tied (easy) or move to ACC (recommended)"
                  sub="ACC lets you schedule/run X min/hr. G-tied cannot."
                />
                <Step
                  n={3}
                  title="If PEK is in use, plan for more wires"
                  sub="Clean solution: pull 18/7 (or at least enough for R,C,Y,W,G plus ACC pair). Then remove PEK."
                />
                <Step
                  n={4}
                  title="Configure Ecobee accessory as Ventilator/HRV/ERV"
                  sub="Then set the minutes-per-hour target and lockouts (optional)."
                />
              </div>
            </Label>

            <Label title="What your current settings imply (live)">
              <div className="grid gap-2.5">
                {guidance.map((g, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl border font-bold ${
                      g.level === "good"
                        ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800"
                        : g.level === "warn"
                        ? "border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800"
                        : "border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800"
                    }`}
                  >
                    {g.text}
                  </div>
                ))}
              </div>
            </Label>
          </div>
        ) : null}

        {tab === "wiring" ? (
          <div className="grid grid-cols-2 gap-3.5">
            <DiagramBox
              title="Wiring Diagram (conceptual)"
              ascii={ascii}
              footer={
                <div className="text-sm opacity-85">
                  Tip: If your ventilator is currently "wired into green," you're in <b>G-tied</b> mode. To get true
                  control, move ventilation to <b>ACC</b> (dry contact or via relay).
                </div>
              }
            />

            <Label title="Which diagram should you use?">
              <div className="grid gap-2.5 leading-[1.55]">
                <div>
                  <b>Use "ACC dry-contact"</b> if the ventilator/HRV/ERV accepts a simple contact closure (like a
                  switch).
                </div>
                <div>
                  <b>Use "ACC with relay 24V"</b> if the unit expects a 24V signal to run/open (many dampers and some
                  fans do).
                </div>
                <div>
                  <b>Keep "G-tied"</b> only if you're okay with ventilation being a side-effect of blower runtime.
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-2.5">
                  <div className="font-black mb-1.5">PEK reality check</div>
                  <div>
                    If you need PEK, you were short on conductors. ACC control often means you'll{" "}
                    <b>pull new thermostat cable</b> (18/7 is a great "do it once" choice).
                  </div>
                </div>
              </div>
            </Label>

            <DiagramBox
              title="What the OP described (typical 'green wire' splice)"
              ascii={`(common real-world pattern)

Thermostat cable:
  R  C*  Y  W  G  (and maybe others)

Ventilator is spliced into G:
  G from thermostat ---> HVAC G terminal
                    \--> Ventilator "run" or damper input

Result:
  Vent runs whenever fan runs (and often whenever heat/cool runs too).
`}
            />

            <DiagramBox
              title="Recommended 'clean' pull (for future-proofing)"
              ascii={`Pull 18/7 (or 18/8) thermostat wire:

Ecobee <--> HVAC:
  R, C, Y, W, G

Ecobee <--> Vent accessory:
  ACC+ and ACC-  (dry contact OR to a relay coil)

This removes the PEK and enables proper accessory control.
`}
            />
          </div>
        ) : null}

        {tab === "sim" ? (
          <div className="grid gap-3.5">
            <Label title="Relays / Contactors (open/close based on your calls + config)">
              <div className="grid grid-cols-2 gap-3">
                {relays.map((r) => (
                  <div
                    key={r.name}
                    className="border border-gray-300 dark:border-gray-600 rounded-2xl p-3 bg-white dark:bg-gray-800"
                  >
                    <div className="flex justify-between gap-2">
                      <div className="font-black">{r.name}</div>
                      <div className="flex gap-2 items-center">
                        <Pill on={r.coilEnergized} text={`Coil ${r.coilEnergized ? "Energized" : "Off"}`} />
                        <Pill on={r.contactClosed} text={`Contact ${r.contactClosed ? "CLOSED" : "OPEN"}`} />
                      </div>
                    </div>
                    <div className="opacity-85 mt-2 leading-6">{r.notes}</div>
                  </div>
                ))}
              </div>

              <div className="mt-2.5 border-t border-gray-200 dark:border-gray-700 pt-2.5 opacity-90">
                <div className="font-black mb-1.5">What to look for</div>
                <ul className="m-0 pl-4.5">
                  <li>
                    In <b>G-tied</b> mode, "Vent interlock" follows the blower relay — you can't schedule ventilation
                    independently.
                  </li>
                  <li>
                    In <b>ACC</b> modes, "Ecobee ACC output" closes only when accessory is configured as{" "}
                    <b>Ventilator</b> and lockouts allow it.
                  </li>
                  <li>
                    If you flip accessory type away from Ventilator, the ACC relay should stop closing (by design).
                  </li>
                </ul>
              </div>
            </Label>

            <Label title="Mini FAQ (for the OP's follow-up)">
              <div className="grid gap-2 leading-[1.55]">
                <div>
                  <b>Q: Do I need a new wire run?</b>
                  <div className="opacity-85">
                    If you want ACC-based ventilation control and you currently rely on PEK / short conductors:{" "}
                    <b>very likely yes</b>. Pulling a bigger thermostat cable is the clean fix.
                  </div>
                </div>
                <div>
                  <b>Q: Can I keep PEK and still do ventilation?</b>
                  <div className="opacity-85">
                    Sometimes with enough conductors or re-termination, but usually PEK means you're already at the wire
                    limit. ACC control is where "one more pair" often becomes necessary.
                  </div>
                </div>
                <div>
                  <b>Q: Why not just keep it on G?</b>
                  <div className="opacity-85">
                    You can — but you're accepting "ventilation is a side-effect of blower runtime," not a controlled IAQ
                    strategy.
                  </div>
                </div>
              </div>
            </Label>
          </div>
        ) : null}

        {tab === "menus" ? (
          <div className="grid gap-3.5">
            <Label title="Ecobee: where to configure ventilator control (menu path)">
              <div className="grid gap-2.5">
                <div className="grid gap-2.5">
                  <Step n={1} title="Main screen" sub="Tap the Menu (≡)" />
                  <Step n={2} title="Settings" sub="Open thermostat settings" />
                  <Step n={3} title="Installation Settings" sub="You may be prompted for an installer code" />
                  <Step n={4} title="Equipment" sub="View wired equipment and accessories" />
                  <Step n={5} title="Accessories" sub="Add / configure accessory" />
                  <Step
                    n={6}
                    title="Configure as Ventilator / HRV / ERV"
                    sub="Set how it runs and the minutes-per-hour target"
                  />
                </div>

                <div className="border-t border-gray-300 dark:border-gray-600 pt-2.5">
                  <div className="font-black mb-1.5">Settings checklist</div>
                  <ul className="m-0 pl-4.5 leading-relaxed">
                    <li>
                      Accessory type is <b>Ventilator/HRV/ERV</b> (not humidifier/dehumidifier)
                    </li>
                    <li>
                      Run-time target: <b>{config.minVentMinutesPerHour} min/hr</b> (adjust to needs/code)
                    </li>
                    <li>
                      Lockouts: <b>Below {config.lockoutBelowOutdoorF ?? "—"}°F</b> /{" "}
                      <b>Above {config.lockoutAboveOutdoorF ?? "—"}°F</b>
                    </li>
                    <li>
                      Decide if vent can piggyback on HVAC calls: <b>{config.allowVentWithHVAC ? "Yes" : "No"}</b>
                    </li>
                  </ul>
                </div>
              </div>
            </Label>

            <Label title="What the OP should say in the Reddit follow-up (copy/paste)">
              <pre
                className="m-0 p-3.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 overflow-x-auto text-sm leading-tight"
              >{`Right now my whole-home vent is spliced into the thermostat G (green) wire, and I'm using the PEK.
So the vent runs whenever the blower/fan runs (not independently).

I want Ecobee to control it as a Ventilator/HRV/ERV (minutes-per-hour target).
Questions:
1) Does my vent control input expect a dry contact closure or a 24V signal?
2) If I move it to Ecobee ACC terminals, do I need to pull new thermostat wire (likely 18/7) so I can remove the PEK?
3) Any recommended settings for min minutes/hr and lockouts for my climate/device?`}</pre>
            </Label>
          </div>
        ) : null}

        {tab === "troubleshooting" ? (
          <div className="grid gap-3.5">
            <Label title="Troubleshooting decision tree (fast)">
              <div className="grid gap-2.5 leading-relaxed">
                <div>
                  <b>1) Is the ventilator tied into G?</b>
                  <div className="opacity-85">
                    If yes: it only runs with the blower. If you're seeing "it runs whenever," that usually means your
                    fan runs frequently (heat/cool calls, circulation, or comfort setting transitions).
                  </div>
                </div>
                <div>
                  <b>2) Do you want independent ventilation minutes-per-hour?</b>
                  <div className="opacity-85">
                    If yes: move to ACC. That may require pulling new cable and removing PEK.
                  </div>
                </div>
                <div>
                  <b>3) Dry contact vs 24V control?</b>
                  <div className="opacity-85">
                    If your vent expects 24V input, use ACC to drive a relay. If it expects a switch closure, wire ACC
                    directly.
                  </div>
                </div>
              </div>
            </Label>

            <Label title="What pictures / info solve this in one comment thread">
              <ul className="m-0 pl-4.5 leading-relaxed">
                <li>Photo of HVAC control board with thermostat wires landed (R/C/Y/W/G)</li>
                <li>Photo of PEK wiring at the air handler</li>
                <li>Ventilator model number + manual page showing the control input type</li>
                <li>Photo of where the ventilator ties into thermostat wiring (the green splice)</li>
                <li>Ecobee: Equipment → Accessories screen (shows what Ecobee thinks is connected)</li>
              </ul>
            </Label>

            <Label title="Safety / sanity notes (because HVAC wiring loves surprises)">
              <ul className="m-0 pl-4.5 leading-relaxed">
                <li>Turn off power to the air handler/furnace before moving low-voltage wires.</li>
                <li>Some ventilators/HRVs require interlocks, fusing, or manufacturer-specific terminals.</li>
                <li>
                  If unsure whether a terminal is "dry contact" or "powered," do not guess—check the manual or measure
                  with a meter.
                </li>
              </ul>
            </Label>
          </div>
        ) : null}
      </div>

    </div>
  );
}

function recFromWizard(a) {
  const redFlags = [];
  const parts = [];
  const wiringNotes = [];

  const needsIndependent = a.wantsIndependentMinutesPerHour;

  // Determine recommended mode
  let recommendedMode = "G_TIED";

  if (needsIndependent) {
    if (a.controlInput === "DRY_CONTACT") recommendedMode = "ACC_DRY_CONTACT";
    else if (a.controlInput === "NEEDS_24V") recommendedMode = "ACC_WITH_RELAY_24V";
    else {
      // unknown control input: still recommend ACC path, but requires manual check
      recommendedMode = "ACC_DRY_CONTACT";
      redFlags.push("Control input type is UNKNOWN. You must confirm if the device expects dry contact or 24V.");
    }
  } else {
    recommendedMode = "G_TIED";
  }

  // PEK / conductors flags
  if ((recommendedMode !== "G_TIED") && a.usesPEK) {
    redFlags.push("PEK is in use. ACC control usually means you're short on conductors—plan to pull new thermostat wire.");
  }
  if ((recommendedMode !== "G_TIED") && !a.hasSpareConductors) {
    redFlags.push("No spare conductors available. Pull 18/7 (or add a new cable) to do ACC control cleanly.");
  }

  // Device-specific notes
  if (a.deviceType === "HRV_ERV") {
    wiringNotes.push("HRVs/ERVs often have low-voltage control terminals labeled like 'T/T', 'SW', 'R/C', or 'Timer'. Use the manufacturer's guide.");
    if (a.hasDedicatedVentTerminals) {
      wiringNotes.push("If your HRV/ERV has dedicated dry-contact 'timer' terminals, Ecobee ACC dry-contact is often the cleanest integration.");
    }
  } else if (a.deviceType === "FRESH_AIR_DAMPER") {
    wiringNotes.push("Many motorized dampers require 24V and may need a relay/transformer depending on current draw and control scheme.");
  } else {
    wiringNotes.push("Inline fans vary: some accept a dry-contact closure, others need switched 24V (or line-voltage via a proper rated relay/contactor).");
  }

  // Parts suggestions
  if (recommendedMode === "ACC_WITH_RELAY_24V") {
    parts.push({
      name: "24V SPST relay (N.O.) with isolation (ex: common HVAC fan center relay)",
      why: "Ecobee ACC closes dry contact; relay converts that to switched 24V for devices that require 24V input."
    });
    if (a.voltageSource === "AIR_HANDLER_R_C") {
      parts.push({
        name: "Inline fuse or board-provided low-voltage fused output (if available)",
        why: "Protects the air handler's transformer and controls from shorts on accessory wiring."
      });
    } else {
      wiringNotes.push("If you use a separate 24V transformer for the ventilator/damper, keep commons isolated unless manual says otherwise.");
    }
  }

  if (recommendedMode === "ACC_DRY_CONTACT") {
    parts.push({
      name: "No extra parts (usually)",
      why: "If the ventilator accepts dry-contact closure, Ecobee ACC can drive it directly."
    });
  }

  if (recommendedMode === "G_TIED") {
    parts.push({
      name: "No extra parts",
      why: "Ventilator simply runs with blower call, but you lose independent ventilation control."
    });
    wiringNotes.push("G-tied mode may under-ventilate (mild weather) or over-ventilate (high HVAC runtime).");
  }

  // Common red flags
  if (a.controlInput === "NEEDS_24V" && a.voltageSource === "UNKNOWN") {
    redFlags.push("You indicated the device needs 24V control but the 24V source is UNKNOWN. Confirm where 24V should come from.");
  }

  if (!a.wantsVentToRunWithHVAC && recommendedMode === "G_TIED") {
    redFlags.push("You selected 'do not run with HVAC', but G-tied mode inherently runs with HVAC fan runtime.");
  }

  const summary = [];
  if (recommendedMode === "G_TIED") {
    summary.push("Recommended: Keep ventilator tied to G (simple).");
    summary.push("Result: Vent runs only when blower runs; no minutes-per-hour target.");
  }
  if (recommendedMode === "ACC_DRY_CONTACT") {
    summary.push("Recommended: Wire ventilator to Ecobee ACC (dry-contact).");
    summary.push("Result: Ecobee can control fresh-air minutes-per-hour independently.");
  }
  if (recommendedMode === "ACC_WITH_RELAY_24V") {
    summary.push("Recommended: Ecobee ACC drives a 24V relay to switch 24V to the vent/damper control input.");
    summary.push("Result: Ecobee still controls minutes-per-hour, but your device gets the 24V signal it needs.");
  }

  return { recommendedMode, summary, wiringNotes, parts, redFlags };
}

function Card({
  title,
  children,
}) {
  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded-xl p-3.5 bg-white dark:bg-gray-800">
      <div className="font-black mb-2">{title}</div>
      {children}
    </div>
  );
}

function RadioRow({
  label,
  value,
  options,
  onChange,
  hint,
}) {
  return (
    <div className="grid gap-2">
      <div>
        <div className="font-black">{label}</div>
        {hint ? <div className="opacity-75 text-sm mt-0.5">{hint}</div> : null}
      </div>
      <div className="grid gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex gap-2.5 items-center border border-gray-300 dark:border-gray-600 rounded-xl p-2.5 cursor-pointer ${
              value === o.value ? "bg-blue-50 dark:bg-blue-900/20" : "bg-gray-50 dark:bg-gray-700"
            }`}
          >
            <input
              type="radio"
              name={label}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="text-blue-600"
            />
            <div className="font-bold">{o.label}</div>
          </label>
        ))}
      </div>
    </div>
  );
}

function BoolRow({
  label,
  value,
  onChange,
  hint,
}) {
  return (
    <div className="flex justify-between gap-3 items-start">
      <div>
        <div className="font-black">{label}</div>
        {hint ? <div className="opacity-75 text-sm mt-0.5">{hint}</div> : null}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`border border-gray-300 dark:border-gray-600 rounded-full py-2 px-3 font-black cursor-pointer min-w-[5.625rem] ${
          value ? "bg-green-50 dark:bg-green-900/20" : "bg-gray-50 dark:bg-gray-700"
        }`}
      >
        {value ? "YES" : "NO"}
      </button>
    </div>
  );
}

/** WIRING WIZARD COMPONENT */
export function WiringWizard({
  value,
  onChange,
}) {
  const rec = React.useMemo(() => recFromWizard(value), [value]);

  return (
    <div className="grid gap-3.5">
      <Card title="Wiring Wizard (answer a few questions → get the right wiring path)">
        <div className="grid gap-3.5">
          <RadioRow
            label="What device is it?"
            value={value.deviceType}
            onChange={(v) => onChange({ ...value, deviceType: v })}
            options={[
              { value: "FRESH_AIR_DAMPER", label: "Fresh-air damper (opens/closes to bring outside air)" },
              { value: "HRV_ERV", label: "HRV/ERV (balanced ventilation unit)" },
              { value: "INLINE_FAN", label: "Inline fan / ventilator" },
            ]}
          />

          <RadioRow
            label="What does the control input expect?"
            value={value.controlInput}
            onChange={(v) => onChange({ ...value, controlInput: v })}
            hint="Check the manual: look for 'dry contact', 'switch closure', 'timer terminals', or '24V input'."
            options={[
              { value: "DRY_CONTACT", label: "Dry contact closure (like a simple switch)" },
              { value: "NEEDS_24V", label: "Switched 24V input (needs 24V applied to run/open)" },
              { value: "UNKNOWN", label: "Not sure yet" },
            ]}
          />

          <div className="grid gap-2.5">
            <BoolRow
              label="Does the device have dedicated low-voltage control terminals?"
              value={value.hasDedicatedVentTerminals}
              onChange={(v) => onChange({ ...value, hasDedicatedVentTerminals: v })}
              hint="Many HRVs/ERVs do; dampers sometimes do (depends on controller)."
            />
            <BoolRow
              label="Do you want Ecobee to run X minutes per hour independently?"
              value={value.wantsIndependentMinutesPerHour}
              onChange={(v) => onChange({ ...value, wantsIndependentMinutesPerHour: v })}
              hint="If YES → you'll want ACC control, not G-tied."
            />
            <BoolRow
              label="Do you want ventilation to piggyback when heating/cooling is already running?"
              value={value.wantsVentToRunWithHVAC}
              onChange={(v) => onChange({ ...value, wantsVentToRunWithHVAC: v })}
            />
            <BoolRow
              label="Are you currently using the PEK?"
              value={value.usesPEK}
              onChange={(v) => onChange({ ...value, usesPEK: v })}
              hint="PEK often means you're short on conductors."
            />
            <BoolRow
              label="Do you have spare conductors (or will you pull new wire)?"
              value={value.hasSpareConductors}
              onChange={(v) => onChange({ ...value, hasSpareConductors: v })}
              hint="For a clean install: pull 18/7 and remove PEK."
            />
          </div>

          <RadioRow
            label="Where does the 24V come from? (only matters if your device needs 24V)"
            value={value.voltageSource}
            onChange={(v) => onChange({ ...value, voltageSource: v })}
            options={[
              { value: "AIR_HANDLER_R_C", label: "Air handler/furnace R & C (board transformer)" },
              { value: "VENTILATOR_INTERNAL", label: "Ventilator has its own 24V transformer/controller" },
              { value: "UNKNOWN", label: "Not sure" },
            ]}
          />
        </div>
      </Card>

      <Card title="Recommendation">
        <div className="grid gap-2.5">
          <div className="p-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-blue-50 dark:bg-blue-900/20">
            <div className="font-black mb-1.5">Suggested wiring mode</div>
            <div className="font-bold">
              {rec.recommendedMode === "G_TIED"
                ? "G-tied (runs with blower)"
                : rec.recommendedMode === "ACC_DRY_CONTACT"
                ? "ACC dry-contact (true Ecobee ventilation control)"
                : "ACC + relay (switch 24V to the device input)"}
            </div>
          </div>

          <div>
            <div className="font-black mb-1.5">Summary</div>
            <ul className="m-0 pl-4.5 leading-relaxed">
              {rec.summary.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>

          <div>
            <div className="font-black mb-1.5">Wiring notes</div>
            <ul className="m-0 pl-4.5 leading-relaxed">
              {rec.wiringNotes.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>

          <div>
            <div className="font-black mb-1.5">Parts list (generic)</div>
            <ul className="m-0 pl-4.5 leading-relaxed">
              {rec.parts.map((p, i) => (
                <li key={i}>
                  <b>{p.name}</b> — <span className="opacity-85">{p.why}</span>
                </li>
              ))}
            </ul>
          </div>

          {rec.redFlags.length ? (
            <div className="p-3 rounded-xl border border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20">
              <div className="font-black mb-1.5">Red flags / must-check</div>
              <ul className="m-0 pl-4.5 leading-relaxed">
                {rec.redFlags.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

/** EC0BEE MENU SIMULATOR (fake UI steps) */
const MENU = {
  id: "root",
  title: "Home Screen",
  children: [
    {
      id: "menu",
      title: "Menu (≡)",
      children: [
        {
          id: "settings",
          title: "Settings",
          children: [
            {
              id: "install",
              title: "Installation Settings",
              description: "Installer-level wiring & equipment configuration.",
              children: [
                {
                  id: "equipment",
                  title: "Equipment",
                  children: [
                    {
                      id: "accessories",
                      title: "Accessories",
                      description: "Add/configure Ventilator / HRV / ERV (or other accessories).",
                      children: [
                        {
                          id: "addAcc",
                          title: "Add Accessory",
                          children: [
                            {
                              id: "chooseVent",
                              title: "Choose: Ventilator / HRV / ERV",
                              tips: [
                                "If your accessory is wired to ACC terminals, it should show up here.",
                                "Set minutes-per-hour target and any lockouts if available.",
                              ],
                            },
                          ],
                        },
                      ],
                    },
                    {
                      id: "wiring",
                      title: "Wiring",
                      description: "Shows what Ecobee thinks is connected (R,C,Y,W,G,ACC...).",
                      tips: ["If you used PEK, confirm R/C/Y/W/G mapping looks sane.", "ACC should appear when used."],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

function findNode(root, id, path = []) {
  if (root.id === id) return { node: root, path: [...path, root] };
  for (const c of root.children ?? []) {
    const hit = findNode(c, id, [...path, root]);
    if (hit.node) return hit;
  }
  return { node: null, path };
}

export function EcobeeMenuSimulator({
  highlightAccessory = true,
}) {
  const [active, setActive] = React.useState("root");
  const { node, path } = React.useMemo(() => findNode(MENU, active), [active]);

  const breadcrumb = path.map((p) => p.title).join(" → ");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
      <Card title="Ecobee Settings Navigator (interactive)">
        <div className="opacity-80 text-sm mb-2.5">
          Breadcrumb: <b>{breadcrumb}</b>
        </div>

        <div className="grid gap-2.5">
          <div className="font-black text-lg">{node?.title}</div>
          {node?.description ? <div className="opacity-85">{node.description}</div> : null}

          {node?.tips?.length ? (
            <div className="p-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
              <div className="font-black mb-1.5">Tips</div>
              <ul className="m-0 pl-4.5 leading-relaxed">
                {node.tips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-2">
            {(node?.children ?? []).map((c) => {
              const isAccessories = c.id === "accessories";
              return (
                <button
                  key={c.id}
                  onClick={() => setActive(c.id)}
                  className={`text-left p-3 rounded-xl border border-gray-300 dark:border-gray-600 cursor-pointer font-black ${
                    highlightAccessory && isAccessories ? "bg-green-50 dark:bg-green-900/20" : "bg-white dark:bg-gray-800"
                  }`}
                >
                  {c.title}
                  {c.description ? <div className="opacity-75 font-semibold mt-1">{c.description}</div> : null}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2 mt-2.5 flex-wrap">
            <button
              onClick={() => {
                // go up one level
                const parent = path.length >= 2 ? path[path.length - 2].id : "root";
                setActive(parent);
              }}
              className="border border-gray-300 dark:border-gray-600 rounded-full py-2 px-3 font-black cursor-pointer bg-gray-50 dark:bg-gray-700"
            >
              Up
            </button>
            <button
              onClick={() => setActive("root")}
              className="border border-gray-300 dark:border-gray-600 rounded-full py-2 px-3 font-black cursor-pointer bg-gray-50 dark:bg-gray-700"
            >
              Home
            </button>
            <button
              onClick={() => setActive("accessories")}
              className="border border-gray-300 dark:border-gray-600 rounded-full py-2 px-3 font-black cursor-pointer bg-blue-50 dark:bg-blue-900/20"
            >
              Jump to Accessories
            </button>
          </div>
        </div>
      </Card>

      <Card title="What to set (once wiring is correct)">
        <div className="grid gap-2.5 leading-relaxed">
          <div>
            <b>Accessories → Ventilator/HRV/ERV</b>
            <div className="opacity-85">
              Make sure it's identified as ventilation (not humidifier/dehumidifier). Otherwise Ecobee won't treat it as fresh-air control.
            </div>
          </div>
          <div>
            <b>Minutes per hour</b>
            <div className="opacity-85">
              Set a target runtime (e.g., 15–30 min/hr is common in discussions, but follow your local code/IAQ goals).
            </div>
          </div>
          <div>
            <b>Lockouts (optional)</b>
            <div className="opacity-85">
              If available, set temp/humidity lockouts to avoid bringing in air when it's extremely cold/hot or too humid/dry.
            </div>
          </div>
          <div>
            <b>Run with HVAC (optional)</b>
            <div className="opacity-85">
              Decide whether ventilation can piggyback during heating/cooling calls, reducing extra fan-only cycles.
            </div>
          </div>
          <div className="p-2.5 rounded-xl border border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20">
            <b>Most common mistake:</b> ventilator is physically wired into G, but user expects Ecobee "ventilation minutes-per-hour" features.
            Those features generally require ACC wiring + accessory configuration.
          </div>
        </div>
      </Card>
    </div>
  );
}