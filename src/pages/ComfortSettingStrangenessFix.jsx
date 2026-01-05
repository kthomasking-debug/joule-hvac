import React, { useMemo, useState } from "react";
import {
  Moon,
  Home as HomeIcon,
  MapPin,
  Info,
  AlertTriangle,
  CheckCircle2,
  Cable,
  Settings as SettingsIcon,
  Copy,
} from "lucide-react";
import AIExplanation from "../components/AIExplanation";

/**
 * Comfort Setting Strangeness — Sensor participation changes 5–10 min early
 *
 * This page explains the likely causes and gives "what to change" steps:
 * - Smart Recovery (even if user thinks it's off)
 * - Follow Me / Smart Home & Away / sensor participation prefetch behavior
 * - Schedule boundary behavior vs "participation" display lag
 * - Workarounds: adjust Sleep start, create a buffer comfort setting, lock participation,
 *   disable Follow Me, disable Smart Home/Away, re-save schedule, reboot, etc.
 *
 * Includes:
 * - Settings checklist (with recommended values)
 * - Wiring diagrams (conventional furnace, heat pump + aux) to answer the "how wired?" questions
 *   that always come up in HVAC threads
 */

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function toHHMM(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ---- Minimal UI atoms (Joule-style dark cards) ----
const Card = ({ children, className = "" }) => (
  <div className={cx("rounded-2xl border border-[#222A35] bg-[#151A21]", className)}>{children}</div>
);

const CardHeader = ({ title, subtitle, icon }) => (
  <div className="p-4 border-b border-[#222A35]">
    <div className="flex items-start gap-3">
      {icon ? <div className="mt-1 text-blue-400">{icon}</div> : null}
      <div>
        <div className="text-lg font-semibold text-white">{title}</div>
        {subtitle ? <div className="text-sm text-gray-400 mt-0.5">{subtitle}</div> : null}
      </div>
    </div>
  </div>
);

const CardBody = ({ children }) => <div className="p-4">{children}</div>;

const Pill = ({ children, tone = "default" }) => {
  const tones = {
    default: "bg-[#0C0F14] border-[#2A3543] text-gray-200",
    good: "bg-emerald-900/30 border-emerald-700/60 text-emerald-200",
    warn: "bg-amber-900/30 border-amber-700/60 text-amber-200",
    bad: "bg-red-900/30 border-red-700/60 text-red-200",
    blue: "bg-blue-900/30 border-blue-700/60 text-blue-200",
  };
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
};

const Button = ({ children, onClick, variant = "default", className = "" }) => {
  const variants = {
    default: "bg-blue-600 hover:bg-blue-700 text-white",
    outline: "border border-[#2A3543] bg-[#0C0F14] hover:bg-[#121824] text-gray-200",
    ghost: "hover:bg-[#121824] text-gray-200",
  };
  return (
    <button
      onClick={onClick}
      className={cx("inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors", variants[variant], className)}
    >
      {children}
    </button>
  );
};

const Toggle = ({ checked, onChange, label, hint }) => (
  <div className="flex items-center justify-between rounded-xl border border-[#222A35] bg-[#0C0F14] p-3">
    <div className="pr-3">
      <div className="text-sm font-medium text-white">{label}</div>
      {hint ? <div className="text-xs text-gray-400 mt-0.5">{hint}</div> : null}
    </div>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
        checked ? "bg-blue-600" : "bg-gray-700"
      )}
      aria-label={label}
    >
      <span
        className={cx(
          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  </div>
);

const Slider = ({ value, min, max, step = 1, onChange, label, suffix = "" }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <div className="text-sm font-medium text-white">{label}</div>
      <Pill tone="blue">
        {value}
        {suffix}
      </Pill>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full"
    />
    <div className="flex justify-between text-xs text-gray-500">
      <span>{min}{suffix}</span>
      <span>{max}{suffix}</span>
    </div>
  </div>
);

function MonoBlock({ text }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-[#222A35] bg-[#0C0F14] p-4 text-xs leading-relaxed text-gray-100">
      {text}
    </pre>
  );
}

// ---- Wiring diagrams (generic) ----
const LEGEND = `Legend:
  Rc/Rh = 24VAC hot, C = common
  Y1/Y2 = compressor stages, G = fan
  W1/W2/AUX = heat call / aux heat
  O/B = reversing valve for heat pump
`;

const DIAGRAMS = [
  {
    id: "conv_1h1c",
    title: "Wiring: Conventional Furnace + A/C (1H/1C)",
    diagram: `Conventional 1H/1C
==================
HVAC Control Board                      ecobee Premium
-----------------                      -------------
R  (24V hot)   ----------------------> Rc (or Rh)
C  (common)    ----------------------> C
Y1 (cool)      ----------------------> Y1
G  (fan)       ----------------------> G
W1 (heat)      ----------------------> W1

${LEGEND}`,
  },
  {
    id: "hp_aux",
    title: "Wiring: Heat Pump + Electric Aux (strips)",
    diagram: `Heat Pump + Aux Electric
=======================
Air Handler / Control Board             ecobee Premium
-------------------------               -------------
R  ------------------------------->     Rc
C  ------------------------------->     C
Y1 (compressor) ------------------>     Y1
G  (fan)        ------------------>     G
O/B (rev valve) ------------------>     O/B
AUX/W1 (strips) ------------------>     W1 (AUX)

(Optional)
Y2 ------------------------------->     Y2
W2/AUX (2nd strips) -------------->     W2/AUX

${LEGEND}`,
  },
];

const DEFAULT_SENSORS = [
  { key: "thermostat", label: "Thermostat", tempBiasF: 0.0 },
  { key: "living", label: "Living Room", tempBiasF: -0.3 },
  { key: "bedroom", label: "Bedroom", tempBiasF: -1.2 },
];

function fmtTime(minFromMidnight) {
  const h = Math.floor(minFromMidnight / 60);
  const m = minFromMidnight % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function ComfortSettingStrangenessFix() {
  // Sim controls (to make the behavior visual + explainable)
  const [sleepStartMin, setSleepStartMin] = useState(22 * 60); // 10:00 PM
  const [preWindowMin, setPreWindowMin] = useState(7); // 5–10 min typical
  const [bedroomCoolerBy, setBedroomCoolerBy] = useState(1.5); // °F cooler
  const [heatDiff, setHeatDiff] = useState(0.5); // thermostat heat differential
  const [targetHomeF, setTargetHomeF] = useState(70);
  const [targetSleepF, setTargetSleepF] = useState(68);

  // "Features" that can influence early behavior
  const [smartRecovery, setSmartRecovery] = useState(false);
  const [followMe, setFollowMe] = useState(true);
  const [smartHomeAway, setSmartHomeAway] = useState(true);
  const [participationPrefetch, setParticipationPrefetch] = useState(true); // modeled behavior
  const [holdParticipation, setHoldParticipation] = useState(false);

  // Setup described in the question
  const homeSensors = useMemo(() => ["thermostat", "living"], []);
  const sleepSensors = useMemo(() => ["bedroom"], []);
  const awaySensors = useMemo(() => ["thermostat"], []);

  // Modeled "effective active sensors" a few minutes before schedule switch
  const timeline = useMemo(() => {
    const t0 = sleepStartMin - preWindowMin; // "a few minutes before"
    const t1 = sleepStartMin;

    // At t0, user reports: comfort setting still Home, BUT bedroom sensor appears active too
    // We'll model causes:
    // - Smart Recovery would start early AND often uses *next* comfort profile logic
    // - Even if Smart Recovery off, ecobee may "prefetch" next comfort participation for UI/display,
    //   and/or Follow Me can temporarily add sensors.
    const earlyAddsBedroom =
      (smartRecovery && true) ||
      (participationPrefetch && !holdParticipation) ||
      (followMe && true);

    const activeAtT0 = earlyAddsBedroom
      ? Array.from(new Set([...homeSensors, "bedroom"]))
      : homeSensors;

    const activeAtT1 = sleepSensors;

    return [
      { label: "Before switch", timeMin: t0, comfort: "Home", sensors: activeAtT0 },
      { label: "At switch", timeMin: t1, comfort: "Sleep", sensors: activeAtT1 },
    ];
  }, [
    sleepStartMin,
    preWindowMin,
    smartRecovery,
    participationPrefetch,
    holdParticipation,
    followMe,
    homeSensors,
    sleepSensors,
  ]);

  // Determine when furnace might kick on due to bedroom pulling average down
  const furnaceEffect = useMemo(() => {
    // Assume thermostat reads ~targetHomeF, living is close, bedroom cooler by X.
    // We'll compute the average of active sensors, compare to Home target (pre-switch)
    const t0 = timeline[0];
    const activeKeys = t0.sensors;

    const sensorTemps = {
      thermostat: targetHomeF,
      living: targetHomeF - 0.2,
      bedroom: targetHomeF - bedroomCoolerBy,
    };

    const avg =
      activeKeys.reduce((sum, k) => sum + (sensorTemps[k] ?? targetHomeF), 0) /
      Math.max(1, activeKeys.length);

    const callHeat = avg <= targetHomeF - heatDiff;

    return { avg, callHeat };
  }, [timeline, targetHomeF, bedroomCoolerBy, heatDiff]);

  const [copiedId, setCopiedId] = useState(null);

  const copyDiagram = async (id, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      setCopiedId("fail");
      setTimeout(() => setCopiedId(null), 1200);
    }
  };

  return (
    <div className="min-h-screen bg-[#0C0F14] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Moon className="h-7 w-7 text-blue-400" />
            Comfort Setting Strangeness Fix
          </h1>
          <p className="mt-2 max-w-4xl text-gray-300">
            Why sensor participation changes 5–10 minutes early, and how to fix it.
            Interactive simulation of the behavior + wiring diagrams for context.
          </p>

          <div className="mt-4 rounded-xl border border-blue-700/50 bg-blue-900/20 p-4">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 text-blue-400" />
              <div className="text-sm text-blue-200">
                This page models the "comfort setting strangeness" where sensors appear to
                switch participation early. Adjust the controls below to see how different
                settings affect the behavior.
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* LEFT: Controls */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader title="Scenario Setup" subtitle="Based on your description" />
              <CardBody className="space-y-4">
                <div className="text-sm text-gray-300">
                  <strong>Home:</strong> Thermostat + Living Room sensors
                  <br />
                  <strong>Sleep:</strong> Bedroom sensor only
                  <br />
                  <strong>Away:</strong> Thermostat only
                </div>

                <Slider
                  label="Sleep schedule starts at"
                  value={sleepStartMin}
                  min={18 * 60}
                  max={24 * 60}
                  step={15}
                  onChange={setSleepStartMin}
                  suffix=""
                />

                <Slider
                  label="Early behavior window (min)"
                  value={preWindowMin}
                  min={1}
                  max={15}
                  onChange={setPreWindowMin}
                />

                <Slider
                  label="Bedroom cooler by (°F)"
                  value={bedroomCoolerBy}
                  min={0}
                  max={5}
                  step={0.1}
                  onChange={setBedroomCoolerBy}
                />

                <Slider
                  label="Heat differential (°F)"
                  value={heatDiff}
                  min={0.5}
                  max={2}
                  step={0.1}
                  onChange={setHeatDiff}
                />

                <Slider
                  label="Home target (°F)"
                  value={targetHomeF}
                  min={65}
                  max={75}
                  onChange={setTargetHomeF}
                />

                <Slider
                  label="Sleep target (°F)"
                  value={targetSleepF}
                  min={60}
                  max={72}
                  onChange={setTargetSleepF}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Feature Toggles" subtitle="That can cause early behavior" />
              <CardBody className="space-y-3">
                <Toggle
                  checked={smartRecovery}
                  onChange={setSmartRecovery}
                  label="Smart Recovery"
                  hint="Starts heating/cooling early to reach target on time"
                />
                <Toggle
                  checked={followMe}
                  onChange={setFollowMe}
                  label="Follow Me"
                  hint="Adds sensors based on occupancy/activity"
                />
                <Toggle
                  checked={smartHomeAway}
                  onChange={setSmartHomeAway}
                  label="Smart Home/Away"
                  hint="Auto-detects occupancy to adjust participation"
                />
                <Toggle
                  checked={participationPrefetch}
                  onChange={setParticipationPrefetch}
                  label="Participation prefetch"
                  hint="UI shows next comfort's sensors early (modeled)"
                />
                <Toggle
                  checked={holdParticipation}
                  onChange={setHoldParticipation}
                  label="Hold participation"
                  hint="Locks current sensor participation"
                />
              </CardBody>
            </Card>
          </div>

          {/* RIGHT: Results + Explanations */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader title="Timeline Simulation" subtitle="What happens before/after switch" />
              <CardBody>
                <div className="space-y-4">
                  {timeline.map((t, i) => (
                    <div key={i} className="rounded-xl border border-[#222A35] bg-[#0C0F14] p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-white">{t.label}</div>
                        <Pill tone="blue">{fmtTime(t.timeMin)}</Pill>
                      </div>
                      <div className="text-sm text-gray-300 mb-2">
                        Comfort: <Pill tone={t.comfort === "Home" ? "good" : "warn"}>{t.comfort}</Pill>
                      </div>
                      <div className="text-sm text-gray-300">
                        Active sensors: {t.sensors.join(", ")}
                      </div>
                      {i === 0 && furnaceEffect.callHeat && (
                        <div className="mt-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-400" />
                          <span className="text-sm text-amber-200">
                            Furnace may kick on early! Avg temp: {furnaceEffect.avg.toFixed(1)}°F
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Likely Causes" subtitle="Why bedroom sensor appears early" />
              <CardBody>
                <div className="space-y-3 text-sm text-gray-300">
                  <div className="flex items-start gap-3">
                    {smartRecovery ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-400" />
                    ) : (
                      <div className="mt-0.5 h-4 w-4 rounded-full border border-gray-600" />
                    )}
                    <div>
                      <strong>Smart Recovery:</strong> Even if you think it's off, it might be
                      enabled. It starts early and uses the *next* comfort profile's logic.
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    {followMe ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-400" />
                    ) : (
                      <div className="mt-0.5 h-4 w-4 rounded-full border border-gray-600" />
                    )}
                    <div>
                      <strong>Follow Me:</strong> Can temporarily add sensors based on
                      occupancy/activity, even before schedule switch.
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    {participationPrefetch ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-400" />
                    ) : (
                      <div className="mt-0.5 h-4 w-4 rounded-full border border-gray-600" />
                    )}
                    <div>
                      <strong>Participation prefetch:</strong> Ecobee may load next comfort's
                      sensor participation early for UI/display purposes.
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    {smartHomeAway ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-400" />
                    ) : (
                      <div className="mt-0.5 h-4 w-4 rounded-full border border-gray-600" />
                    )}
                    <div>
                      <strong>Smart Home/Away:</strong> Occupancy detection can change
                      participation before schedule boundaries.
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Fixes & Workarounds" subtitle="What to try first" />
              <CardBody>
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#222A35] bg-[#0C0F14] p-4">
                    <div className="text-sm font-medium text-white mb-2">Quick fixes</div>
                    <ul className="list-disc pl-5 text-sm text-gray-300 space-y-1">
                      <li>Disable Follow Me temporarily</li>
                      <li>Disable Smart Home/Away</li>
                      <li>Enable "Hold participation" in comfort settings</li>
                      <li>Re-save your schedule (sometimes fixes prefetch bugs)</li>
                      <li>Reboot the thermostat</li>
                    </ul>
                  </div>

                  <div className="rounded-xl border border-[#222A35] bg-[#0C0F14] p-4">
                    <div className="text-sm font-medium text-white mb-2">Schedule adjustments</div>
                    <ul className="list-disc pl-5 text-sm text-gray-300 space-y-1">
                      <li>Move Sleep start 10–15 min earlier</li>
                      <li>Create a "Buffer" comfort setting between Home and Sleep</li>
                      <li>Use Away mode instead of Sleep if appropriate</li>
                    </ul>
                  </div>

                  <div className="rounded-xl border border-[#222A35] bg-[#0C0F14] p-4">
                    <div className="text-sm font-medium text-white mb-2">Advanced settings</div>
                    <ul className="list-disc pl-5 text-sm text-gray-300 space-y-1">
                      <li>Check Smart Recovery is truly off (re-toggle if needed)</li>
                      <li>Adjust sensor participation manually per comfort setting</li>
                      <li>Consider firmware update if available</li>
                    </ul>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Wiring Diagrams" subtitle="For context (conventional vs heat pump)" />
              <CardBody>
                <div className="space-y-4">
                  {DIAGRAMS.map((d) => (
                    <div key={d.id} className="rounded-xl border border-[#222A35] bg-[#0C0F14] p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-medium text-white">{d.title}</div>
                        <Button
                          variant="outline"
                          onClick={() => copyDiagram(d.id, d.diagram)}
                        >
                          <Copy className="h-4 w-4" />
                          Copy
                        </Button>
                      </div>
                      <MonoBlock text={d.diagram} />
                      {copiedId === d.id && <Pill tone="good" className="mt-2">Copied!</Pill>}
                      {copiedId === "fail" && <Pill tone="bad" className="mt-2">Clipboard failed</Pill>}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        <AIExplanation
          title="Explanation (Plain English)"
          prompt={`My Ecobee thermostat has the following schedule configuration:

- Home Comfort Setting: ${targetHomeF}°F (sensors: thermostat, living room)
- Sleep Comfort Setting: ${targetSleepF}°F (sensors: bedroom only)
- Sleep starts at: ${toHHMM(sleepStartMin)}
- Pre-transition window: ${preWindowMin} minutes before Sleep
- Bedroom is typically ${bedroomCoolerBy.toFixed(1)}°F cooler than other rooms

Features enabled:
- Smart Recovery: ${smartRecovery ? 'On' : 'Off'}
- Follow Me: ${followMe ? 'On' : 'Off'}
- Smart Home & Away: ${smartHomeAway ? 'On' : 'Off'}
- Hold Participation: ${holdParticipation ? 'On' : 'Off'}

I'm experiencing sensor participation changes 5-10 minutes BEFORE my scheduled comfort setting transition. Please explain in 3-4 paragraphs for a homeowner:

1. Why sensor participation changes early (before the scheduled time) and what causes this behavior
2. How Smart Recovery, Follow Me, and Smart Home & Away features can affect schedule transitions
3. The interaction between schedule boundaries, sensor participation, and temperature thresholds
4. Practical solutions to prevent early transitions (adjusting schedule times, disabling features, hold participation, etc.)

Use plain English and focus on actionable steps I can take to fix this issue.`}
        />
      </div>
    </div>
  );
}