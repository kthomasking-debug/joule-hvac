import React, { useMemo, useState } from "react";
import { Shield, Activity, ThermometerSnowflake, Info, SlidersHorizontal, Droplets } from "lucide-react";
import AIExplanation from "../components/AIExplanation";

// Basic UI components (simplified versions for this component)
const Card = ({ children, className = "" }) => (
  <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl ${className}`}>
    {children}
  </div>
);

const CardContent = ({ children, className = "" }) => (
  <div className={`p-5 ${className}`}>
    {children}
  </div>
);

const Button = ({ children, variant = "default", className = "", onClick, ...props }) => {
  const baseClasses = "px-4 py-2 rounded-xl font-medium transition-colors";
  const variants = {
    default: "bg-blue-600 hover:bg-blue-700 text-white",
    outline: "border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700",
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
};

const Badge = ({ children, variant = "default", className = "" }) => {
  const variants = {
    default: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200",
    outline: "border border-gray-300 dark:border-gray-600",
  };

  return (
    <span className={`inline-flex items-center rounded-xl px-2.5 py-1 text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

const Switch = ({ checked, onCheckedChange, className = "" }) => (
  <button
    type="button"
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      checked ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
    } ${className}`}
    onClick={() => onCheckedChange(!checked)}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        checked ? "translate-x-6" : "translate-x-1"
      }`}
    />
  </button>
);

const Slider = ({ value, min, max, step = 1, onValueChange, className = "" }) => {
  const [currentValue] = value;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={currentValue}
        onChange={(e) => onValueChange([parseFloat(e.target.value)])}
        className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
      />
      <span className="text-sm font-medium min-w-[3rem]">{currentValue}</span>
    </div>
  );
};

const Select = ({ value, onValueChange, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = React.useRef(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (newValue) => {
    onValueChange(newValue);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={selectRef}>
      {React.Children.map(children, (child) =>
        React.cloneElement(child, {
          isOpen,
          setIsOpen,
          onSelect: handleSelect,
          currentValue: value
        })
      )}
    </div>
  );
};

const SelectTrigger = ({ children, className = "", isOpen, setIsOpen, currentValue }) => (
  <button
    type="button"
    className={`flex h-10 w-full items-center justify-between rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    onClick={() => setIsOpen(!isOpen)}
  >
    {React.Children.map(children, (child) =>
      React.cloneElement(child, { currentValue })
    )}
    <svg
      className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  </button>
);

const SelectValue = ({ placeholder, currentValue }) => {
  // Find the display text for the current value
  const displayText = currentValue || placeholder || "Select...";
  return (
    <span className="text-gray-900 dark:text-gray-100">{displayText}</span>
  );
};

const SelectContent = ({ children, isOpen }) => (
  isOpen ? (
    <div className="absolute top-full z-50 mt-1 max-h-60 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-md">
      <div className="overflow-auto p-1">
        {children}
      </div>
    </div>
  ) : null
);

const SelectItem = ({ value, children, onSelect }) => (
  <div
    className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-gray-100 dark:hover:bg-gray-700"
    onClick={() => onSelect && onSelect(value)}
  >
    {children}
  </div>
);

const Separator = () => (
  <div className="my-4 h-px bg-gray-200 dark:bg-gray-700" />
);

/**
 * Ecobee Premium Settings Sandbox
 *
 * Goal: let users "virtually play" with Ecobee-style Installation Settings + Thresholds,
 * and explicitly visualize conditional UI/feature availability.
 *
 * Notes:
 * - This is not affiliated with ecobee.
 * - Behavior rules are modeled from common field observations and user reports.
 */

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function LabeledRow({ label, children, hint }) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-5 md:items-center">
      <div className="md:col-span-2">
        <div className="flex items-center gap-2">
          <div className="font-medium">{label}</div>
          {hint ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3.5 w-3.5" /> {hint}
            </span>
          ) : null}
        </div>
      </div>
      <div className="md:col-span-3">{children}</div>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1">{icon}</div>
      <div>
        <div className="text-lg font-semibold">{title}</div>
        {subtitle ? <div className="text-sm text-muted-foreground">{subtitle}</div> : null}
      </div>
    </div>
  );
}

function Pill({ children, tone = "default" }) {
  const tones = {
    default: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200",
    good: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
    warn: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
    bad: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ${tones[tone]}`}>{children}</span>;
}

export default function EcobeeSettingsSandbox() {
  // --- Global "firmware" / UI behavior model ---
  const [uiModel, setUiModel] = useState("new"); // "legacy" | "new"
  const [device, setDevice] = useState("premium"); // expand later

  // --- Wiring / equipment presence ---
  const [hasHeatPump, setHasHeatPump] = useState(true);
  const [hasFurnaceAux, setHasFurnaceAux] = useState(false);

  const [humidifierPresent, setHumidifierPresent] = useState(true);
  const [humidifierType, setHumidifierType] = useState("evap"); // evap|steam
  const [humidifierWiring, setHumidifierWiring] = useState("oneWire"); // oneWire|twoWire
  const [humidifierMinRunDelta, setHumidifierMinRunDelta] = useState(2); // percent

  const [dehumidifierPresent, setDehumidifierPresent] = useState(false);
  const [dehumWithFan, setDehumWithFan] = useState(false);
  const [dehumMinRunDelta, setDehumMinRunDelta] = useState(2);
  const [dehumInHeatModeOnly, setDehumInHeatModeOnly] = useState(false);

  // --- Humidity / frost / overcool ---
  const [acOvercoolEnabled, setAcOvercoolEnabled] = useState(false);
  const [acOvercoolMax, setAcOvercoolMax] = useState(2); // F

  // Simple humidity control (what many users see)
  const [humidityLow, setHumidityLow] = useState(30);
  const [humidityHigh, setHumidityHigh] = useState(45);

  // Legacy-ish window efficiency (what users miss)
  const [windowEfficiency, setWindowEfficiency] = useState(4); // 1..7

  // Outdoor conditions for simulation
  const [outdoorTemp, setOutdoorTemp] = useState(30); // F

  // --- Thresholds (subset) ---
  const [compMinOffTime, setCompMinOffTime] = useState(300); // seconds
  const [compMinOutdoorTemp, setCompMinOutdoorTemp] = useState(35); // F
  const [heatDiff, setHeatDiff] = useState(1.0); // F
  const [coolDiff, setCoolDiff] = useState(1.0); // F
  const [heatMinOn, setHeatMinOn] = useState(5); // minutes
  const [coolMinOn, setCoolMinOn] = useState(5); // minutes
  const [auxHeatMaxTemp, setAuxHeatMaxTemp] = useState(70); // F

  // --- New features: Wiring diagram, installer lock, runtime simulator ---
  const [installerMode, setInstallerMode] = useState(false);
  const [installerCode, setInstallerCode] = useState("4110");
  const [installerLocked, setInstallerLocked] = useState(true);

  // Runtime simulation
  const [indoorTemp, setIndoorTemp] = useState(72);
  const [targetTemp, setTargetTemp] = useState(70);
  const [currentMode, setCurrentMode] = useState("heat"); // heat | cool | off

  // --- Derived rules: "why did the setting disappear?" ---
  const derived = useMemo(() => {
    // Modeled rule observed in the wild:
    // If AC Overcool is enabled, Ecobee hides Frost Control / Window Efficiency UI.
    // Additionally, in many setups, adding a dehumidifier pushes the UI into a different humidity path.
    // We model both as gating factors.

    const overcoolGatesFrostUI = acOvercoolEnabled;
    const dehumGatesFrostUI = dehumidifierPresent;

    // In "new" UI model, we assume the window-efficiency control is hidden more aggressively,
    // and a 1-wire humidifier tends to get the simplified UI.
    const oneWireSimplifies = humidifierPresent && humidifierWiring === "oneWire";

    // When does the user see Window Efficiency?
    let windowEfficiencyVisible = false;

    if (!humidifierPresent) {
      windowEfficiencyVisible = false;
    } else if (uiModel === "legacy") {
      // Legacy: show it whenever humidifier is present AND Frost path is not gated
      windowEfficiencyVisible = !(overcoolGatesFrostUI || dehumGatesFrostUI);
    } else {
      // New: show only when humidifier present AND not gated AND setup is "complex" enough
      // (steam or 2-wire), otherwise prefer simplified humidity controls.
      const complexHumidifier = humidifierType === "steam" || humidifierWiring === "twoWire";
      windowEfficiencyVisible = complexHumidifier && !(overcoolGatesFrostUI || dehumGatesFrostUI);
    }

    // Frost control available (conceptually) if humidifier present and not gated.
    const frostControlAvailable = humidifierPresent && !(overcoolGatesFrostUI || dehumGatesFrostUI);

    // Estimated "auto" humidity target from window efficiency + outdoor temp.
    // This is a toy curve for education: higher window efficiency => higher target; colder outside => lower target.
    // Output is clamped to 15..50%.
    const eff = clamp(windowEfficiency, 1, 7);
    const t = clamp(outdoorTemp, -20, 80);

    // Base from window efficiency: 1->25, 7->45
    const base = 25 + (eff - 1) * (20 / 6);
    // Cold penalty: below 40F, reduce target progressively down to -20F
    const coldPenalty = t < 40 ? ((40 - t) / 60) * 18 : 0; // up to ~18% reduction
    const frostAutoTarget = clamp(Math.round((base - coldPenalty) * 2) / 2, 15, 50);

    // What humidity target is "active"?
    // If window efficiency UI visible and frost control available: use auto target within user's high/low guardrails.
    // Otherwise use manual high/low band.
    let activeTarget;
    let controlModeLabel;

    if (windowEfficiencyVisible && frostControlAvailable) {
      activeTarget = clamp(frostAutoTarget, humidityLow, humidityHigh);
      controlModeLabel = "Frost Control (auto target)";
    } else {
      // simplified
      activeTarget = clamp(humidityHigh, 15, 60);
      controlModeLabel = "Manual humidity band";
    }

    // Explanations for what is hiding what
    const hideReasons = [];
    if (humidifierPresent) {
      if (overcoolGatesFrostUI) hideReasons.push("AC Overcool is enabled → Frost Control / Window Efficiency UI is suppressed.");
      if (dehumGatesFrostUI) hideReasons.push("Dehumidifier is configured → humidity controls take a different path; Frost UI often disappears.");
      if (uiModel === "new" && oneWireSimplifies && !windowEfficiencyVisible) hideReasons.push("Newer UI model + 1-wire humidifier → simplified humidity controls are favored.");
    }

    return {
      overcoolGatesFrostUI,
      dehumGatesFrostUI,
      oneWireSimplifies,
      windowEfficiencyVisible,
      frostControlAvailable,
      frostAutoTarget,
      activeTarget,
      controlModeLabel,
      hideReasons,
    };
  }, [
    uiModel,
    humidifierPresent,
    humidifierType,
    humidifierWiring,
    dehumidifierPresent,
    acOvercoolEnabled,
    humidityLow,
    humidityHigh,
    windowEfficiency,
    outdoorTemp,
  ]);

  // --- Runtime simulation calculations ---
  const runtimeSim = useMemo(() => {
    if (currentMode === "off") return { compressor: 0, auxHeat: 0, humidifier: 0, dehumidifier: 0 };

    const tempDiff = currentMode === "heat" ? targetTemp - indoorTemp : indoorTemp - targetTemp;
    const differential = currentMode === "heat" ? heatDiff : coolDiff;
    const minOnTime = currentMode === "heat" ? heatMinOn : coolMinOn;

    // Compressor logic
    let compressorOn = false;
    if (currentMode === "heat" && hasHeatPump) {
      compressorOn = tempDiff >= differential && outdoorTemp >= compMinOutdoorTemp;
    } else if (currentMode === "cool" && hasHeatPump) {
      compressorOn = tempDiff >= differential;
    }

    // Aux heat logic (only in heat mode)
    let auxHeatOn = false;
    if (currentMode === "heat" && hasFurnaceAux && tempDiff >= differential) {
      auxHeatOn = outdoorTemp <= auxHeatMaxTemp && (!hasHeatPump || !compressorOn);
    }

    // Humidifier logic (simplified)
    let humidifierOn = false;
    if (humidifierPresent && currentMode === "heat") {
      // Simplified: runs when heating and humidity is low
      humidifierOn = true; // In reality this would check humidity sensors
    }

    // Dehumidifier logic (simplified)
    let dehumidifierOn = false;
    if (dehumidifierPresent) {
      if (dehumInHeatModeOnly && currentMode !== "heat") {
        dehumidifierOn = false;
      } else {
        // Simplified: runs when cooling or when fan is running
        dehumidifierOn = currentMode === "cool" || dehumWithFan;
      }
    }

    // Calculate duty cycles (simplified percentages)
    const totalTime = 60; // 1 hour simulation
    const compressorDuty = compressorOn ? Math.min(80, minOnTime * 2) : 0; // Rough estimate
    const auxHeatDuty = auxHeatOn ? Math.min(60, minOnTime * 1.5) : 0;
    const humidifierDuty = humidifierOn ? 30 : 0; // Simplified
    const dehumidifierDuty = dehumidifierOn ? 25 : 0; // Simplified

    return {
      compressor: compressorDuty,
      auxHeat: auxHeatDuty,
      humidifier: humidifierDuty,
      dehumidifier: dehumidifierDuty,
      mode: currentMode,
      tempDiff: tempDiff.toFixed(1),
      differential: differential.toFixed(1)
    };
  }, [
    currentMode, indoorTemp, targetTemp, outdoorTemp, hasHeatPump, hasFurnaceAux,
    heatDiff, coolDiff, heatMinOn, coolMinOn, compMinOutdoorTemp, auxHeatMaxTemp,
    humidifierPresent, dehumidifierPresent, dehumInHeatModeOnly, dehumWithFan
  ]);

  const reset = () => {
    setUiModel("new");
    setDevice("premium");

    setHasHeatPump(true);
    setHasFurnaceAux(false);

    setHumidifierPresent(true);
    setHumidifierType("evap");
    setHumidifierWiring("oneWire");
    setHumidifierMinRunDelta(2);

    setDehumidifierPresent(false);
    setDehumWithFan(false);
    setDehumMinRunDelta(2);
    setDehumInHeatModeOnly(false);

    setAcOvercoolEnabled(false);
    setAcOvercoolMax(2);

    setHumidityLow(30);
    setHumidityHigh(45);
    setWindowEfficiency(4);

    setOutdoorTemp(30);

    setCompMinOffTime(300);
    setCompMinOutdoorTemp(35);
    setHeatDiff(1.0);
    setCoolDiff(1.0);
    setHeatMinOn(5);
    setCoolMinOn(5);
    setAuxHeatMaxTemp(70);

    // Reset new features
    setInstallerMode(false);
    setInstallerCode("4110");
    setInstallerLocked(true);
    setIndoorTemp(72);
    setTargetTemp(70);
    setCurrentMode("heat");
  };

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-2xl font-bold">Ecobee Premium • Installation Settings Sandbox</div>
          <div className="text-sm text-muted-foreground">
            Virtually play with equipment + thresholds and see which settings appear/disappear (including Window Efficiency / Frost Control).
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT: Controls */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-5">
              <SectionHeader
                icon={<SlidersHorizontal className="h-5 w-5" />}
                title="UI Behavior Model"
                subtitle="Use this to mimic older vs newer firmware/UI behavior (where some settings get hidden)."
              />

              <LabeledRow label="Device" hint="Modeled as Ecobee Premium">
                <Select value={device} onValueChange={setDevice}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select device" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="premium">Ecobee Premium</SelectItem>
                    <SelectItem value="enhanced">Ecobee Enhanced (modeled)</SelectItem>
                    <SelectItem value="ecobee3">ecobee3 (modeled)</SelectItem>
                  </SelectContent>
                </Select>
              </LabeledRow>

              <LabeledRow label="UI model" hint="Legacy shows more knobs; New hides more">
                <Select value={uiModel} onValueChange={setUiModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select UI model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="legacy">Legacy (more settings visible)</SelectItem>
                    <SelectItem value="new">New (simplified / hidden settings)</SelectItem>
                  </SelectContent>
                </Select>
              </LabeledRow>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-5">
              <SectionHeader
                icon={<Shield className="h-5 w-5" />}
                title="Equipment Presence"
                subtitle="Toggle what the thermostat thinks is installed. Availability updates instantly."
              />

              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center justify-between rounded-2xl border p-4">
                  <div>
                    <div className="font-medium">Heat Pump</div>
                    <div className="text-sm text-muted-foreground">Up to 2 heat / 2 cool stages</div>
                  </div>
                  <Switch checked={hasHeatPump} onCheckedChange={setHasHeatPump} />
                </div>

                <div className="flex items-center justify-between rounded-2xl border p-4">
                  <div>
                    <div className="font-medium">Furnace / Aux heat source</div>
                    <div className="text-sm text-muted-foreground">Conventional furnace or boiler / aux stage</div>
                  </div>
                  <Switch checked={hasFurnaceAux} onCheckedChange={setHasFurnaceAux} />
                </div>

                <div className="flex items-center justify-between rounded-2xl border p-4">
                  <div>
                    <div className="font-medium">Humidifier</div>
                    <div className="text-sm text-muted-foreground">Accessory on ACC+/ACC-</div>
                  </div>
                  <Switch checked={humidifierPresent} onCheckedChange={setHumidifierPresent} />
                </div>

                <div className="flex items-center justify-between rounded-2xl border p-4">
                  <div>
                    <div className="font-medium">Dehumidifier</div>
                    <div className="text-sm text-muted-foreground">Accessory or dehumidify logic</div>
                  </div>
                  <Switch checked={dehumidifierPresent} onCheckedChange={setDehumidifierPresent} />
                </div>
              </div>

              {humidifierPresent ? (
                <div className="space-y-4">
                  <Separator />
                  <div className="text-sm font-semibold">Humidifier details</div>

                  <LabeledRow label="Humidifier type" hint="Evaporative vs steam">
                    <Select value={humidifierType} onValueChange={setHumidifierType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="evap">Evaporative</SelectItem>
                        <SelectItem value="steam">Steam</SelectItem>
                      </SelectContent>
                    </Select>
                  </LabeledRow>

                  <LabeledRow label="Accessory wiring" hint="1-wire often used with ACC+ only">
                    <Select value={humidifierWiring} onValueChange={setHumidifierWiring}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select wiring" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="oneWire">1-wire (ACC+ only)</SelectItem>
                        <SelectItem value="twoWire">2-wire (ACC+ & ACC-)</SelectItem>
                      </SelectContent>
                    </Select>
                  </LabeledRow>

                  <LabeledRow label={`Min Run Time Delta (${humidifierMinRunDelta}%)`} hint="Reduces short cycling">
                    <Slider
                      value={[humidifierMinRunDelta]}
                      min={2}
                      max={10}
                      step={1}
                      onValueChange={(v) => setHumidifierMinRunDelta(v[0])}
                    />
                  </LabeledRow>
                </div>
              ) : null}

              {dehumidifierPresent ? (
                <div className="space-y-4">
                  <Separator />
                  <div className="text-sm font-semibold">Dehumidifier details</div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center justify-between rounded-2xl border p-4">
                      <div>
                        <div className="font-medium">Dehumidify with fan</div>
                        <div className="text-sm text-muted-foreground">Run when fan is running</div>
                      </div>
                      <Switch checked={dehumWithFan} onCheckedChange={setDehumWithFan} />
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border p-4">
                      <div>
                        <div className="font-medium">Dehumidify in heat mode only</div>
                        <div className="text-sm text-muted-foreground">Restrict operation to heat calls</div>
                      </div>
                      <Switch checked={dehumInHeatModeOnly} onCheckedChange={setDehumInHeatModeOnly} />
                    </div>
                  </div>

                  <LabeledRow label={`Min Run Time Delta (${dehumMinRunDelta}%)`} hint="Reduces short cycling">
                    <Slider
                      value={[dehumMinRunDelta]}
                      min={2}
                      max={10}
                      step={1}
                      onValueChange={(v) => setDehumMinRunDelta(v[0])}
                    />
                  </LabeledRow>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-5">
              <SectionHeader
                icon={<Droplets className="h-5 w-5" />}
                title="Humidity Controls"
                subtitle="See how AC Overcool + Dehumidifier can hide Window Efficiency/Frost Control UI."
              />

              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center justify-between rounded-2xl border p-4">
                  <div>
                    <div className="font-medium">AC Overcool</div>
                    <div className="text-sm text-muted-foreground">Uses cooling to reduce humidity below setpoint</div>
                  </div>
                  <Switch checked={acOvercoolEnabled} onCheckedChange={setAcOvercoolEnabled} />
                </div>

                {acOvercoolEnabled ? (
                  <LabeledRow label={`AC Overcool Max (${acOvercoolMax}°F)`} hint="How far below cooling setpoint it may cool">
                    <Slider value={[acOvercoolMax]} min={0} max={5} step={0.5} onValueChange={(v) => setAcOvercoolMax(v[0])} />
                  </LabeledRow>
                ) : null}

                <LabeledRow label={`Humidity Low (${humidityLow}%)`} hint="Lower bound of manual band">
                  <Slider value={[humidityLow]} min={15} max={55} step={1} onValueChange={(v) => setHumidityLow(Math.min(v[0], humidityHigh - 1))} />
                </LabeledRow>

                <LabeledRow label={`Humidity High (${humidityHigh}%)`} hint="Upper bound of manual band">
                  <Slider value={[humidityHigh]} min={16} max={60} step={1} onValueChange={(v) => setHumidityHigh(Math.max(v[0], humidityLow + 1))} />
                </LabeledRow>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Window Efficiency (Frost Control)</div>
                  {derived.windowEfficiencyVisible ? <Pill tone="good">Visible</Pill> : <Pill tone="warn">Hidden</Pill>}
                </div>
                <div className="text-sm text-muted-foreground">
                  This knob is intentionally modeled to disappear when humidity control is routed through other features (e.g., AC Overcool).
                </div>

                {derived.windowEfficiencyVisible ? (
                  <LabeledRow label={`Window Efficiency (${windowEfficiency}/7)`} hint="7 = best windows">
                    <Slider value={[windowEfficiency]} min={1} max={7} step={1} onValueChange={(v) => setWindowEfficiency(v[0])} />
                  </LabeledRow>
                ) : (
                  <div className="rounded-2xl border p-4 text-sm">
                    <div className="flex items-center gap-2 font-medium">
                      <ThermometerSnowflake className="h-4 w-4" /> Why it's hidden
                    </div>
                    <ul className="mt-2 list-disc pl-5 text-muted-foreground space-y-1">
                      {derived.hideReasons.length ? derived.hideReasons.map((r, idx) => <li key={idx}>{r}</li>) : <li>No humidifier detected.</li>}
                    </ul>
                    <div className="mt-3 text-xs text-muted-foreground">
                      Tip: You discovered the real-world behavior—turning <span className="font-semibold">AC Overcool</span> off often brings this back.
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              <LabeledRow label={`Outdoor Temperature (${outdoorTemp}°F)`} hint="Used to visualize frost/auto targets">
                <Slider value={[outdoorTemp]} min={-20} max={80} step={1} onValueChange={(v) => setOutdoorTemp(v[0])} />
              </LabeledRow>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-5">
              <SectionHeader
                icon={<Shield className="h-5 w-5" />}
                title="Installer Code Lock"
                subtitle="Simulate installer-only settings access"
              />

              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl border p-4">
                  <div>
                    <div className="font-medium">Installer Mode</div>
                    <div className="text-sm text-muted-foreground">Unlock advanced settings</div>
                  </div>
                  <Switch checked={installerMode} onCheckedChange={setInstallerMode} />
                </div>

                {installerMode && (
                  <div className="space-y-3">
                    <LabeledRow label="Installer Code" hint="Default: 4110">
                      <input
                        type="text"
                        value={installerCode}
                        onChange={(e) => setInstallerCode(e.target.value)}
                        className="flex h-10 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Enter code"
                      />
                    </LabeledRow>

                    <Button
                      variant="outline"
                      onClick={() => setInstallerLocked(installerCode !== "4110")}
                      className="w-full"
                    >
                      {installerLocked ? "Unlock Settings" : "Lock Settings"}
                    </Button>
                  </div>
                )}

                <div className="rounded-2xl border p-4">
                  <div className="text-sm font-semibold mb-2">Settings Access</div>
                  <div className="flex flex-wrap gap-2">
                    <Pill tone={installerLocked ? "warn" : "good"}>
                      {installerLocked ? "Basic Settings Only" : "All Settings Unlocked"}
                    </Pill>
                    {installerLocked && (
                      <Pill tone="warn">Thresholds Locked</Pill>
                    )}
                  </div>
                  {installerLocked && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Installer code required to access compressor timing, differentials, and aux heat settings.
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-5">
              <SectionHeader
                icon={<Activity className="h-5 w-5" />}
                title="Equipment Runtime Simulator"
                subtitle="See how your settings affect equipment duty cycles"
              />

              <div className="space-y-4">
                <LabeledRow label="Current Mode">
                  <Select value={currentMode} onValueChange={setCurrentMode}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="off">Off</SelectItem>
                      <SelectItem value="heat">Heating</SelectItem>
                      <SelectItem value="cool">Cooling</SelectItem>
                    </SelectContent>
                  </Select>
                </LabeledRow>

                <div className="grid grid-cols-2 gap-4">
                  <LabeledRow label={`Indoor Temp (${indoorTemp}°F)`}>
                    <Slider value={[indoorTemp]} min={50} max={90} step={1} onValueChange={(v) => setIndoorTemp(v[0])} />
                  </LabeledRow>

                  <LabeledRow label={`Target Temp (${targetTemp}°F)`}>
                    <Slider value={[targetTemp]} min={50} max={90} step={1} onValueChange={(v) => setTargetTemp(v[0])} />
                  </LabeledRow>
                </div>

                <div className="rounded-2xl border p-4 space-y-3">
                  <div className="text-sm font-semibold">Simulated Duty Cycles (1 hour)</div>

                  <div className="space-y-2">
                    {hasHeatPump && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Compressor</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${runtimeSim.compressor}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium min-w-[3rem]">{runtimeSim.compressor}%</span>
                        </div>
                      </div>
                    )}

                    {hasFurnaceAux && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Aux Heat</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-orange-600 h-2 rounded-full"
                              style={{ width: `${runtimeSim.auxHeat}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium min-w-[3rem]">{runtimeSim.auxHeat}%</span>
                        </div>
                      </div>
                    )}

                    {humidifierPresent && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Humidifier</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-cyan-600 h-2 rounded-full"
                              style={{ width: `${runtimeSim.humidifier}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium min-w-[3rem]">{runtimeSim.humidifier}%</span>
                        </div>
                      </div>
                    )}

                    {dehumidifierPresent && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Dehumidifier</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-purple-600 h-2 rounded-full"
                              style={{ width: `${runtimeSim.dehumidifier}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium min-w-[3rem]">{runtimeSim.dehumidifier}%</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    Mode: {runtimeSim.mode} | Temp diff: {runtimeSim.tempDiff}°F | Differential: {runtimeSim.differential}°F
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-5">
              <SectionHeader
                icon={<ThermometerSnowflake className="h-5 w-5" />}
                title="Thresholds (Playground Subset)"
                subtitle="A focused subset of installation thresholds people actually tweak."
              />

              {installerLocked ? (
                <div className="rounded-2xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-yellow-600" />
                    <div className="font-medium text-yellow-800 dark:text-yellow-200">Installer Settings Locked</div>
                  </div>
                  <div className="text-sm text-yellow-700 dark:text-yellow-300">
                    These advanced settings require installer code access. Enable installer mode and enter code "4110" to unlock.
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <LabeledRow label={`Compressor Min Cycle Off Time (${compMinOffTime}s)`}>
                    <Slider value={[compMinOffTime]} min={240} max={900} step={30} onValueChange={(v) => setCompMinOffTime(v[0])} />
                  </LabeledRow>

                  <LabeledRow label={`Compressor Min Outdoor Temp (${compMinOutdoorTemp}°F)`} hint="Below this, compressor is disabled">
                    <Slider value={[compMinOutdoorTemp]} min={0} max={65} step={1} onValueChange={(v) => setCompMinOutdoorTemp(v[0])} />
                  </LabeledRow>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-4">
                      <div className="text-sm font-semibold">Heat</div>
                      <LabeledRow label={`Heat Differential (${heatDiff.toFixed(1)}°F)`}>
                        <Slider value={[heatDiff]} min={0} max={3} step={0.5} onValueChange={(v) => setHeatDiff(v[0])} />
                      </LabeledRow>
                      <LabeledRow label={`Heat Min On Time (${heatMinOn} min)`}>
                        <Slider value={[heatMinOn]} min={1} max={20} step={1} onValueChange={(v) => setHeatMinOn(v[0])} />
                      </LabeledRow>
                      <LabeledRow label={`Aux Heat Max Temp (${auxHeatMaxTemp}°F)`} hint="Above this, aux won't engage">
                        <Slider value={[auxHeatMaxTemp]} min={0} max={80} step={0.5} onValueChange={(v) => setAuxHeatMaxTemp(v[0])} />
                      </LabeledRow>
                    </div>

                    <div className="space-y-4">
                      <div className="text-sm font-semibold">Cool</div>
                      <LabeledRow label={`Cool Differential (${coolDiff.toFixed(1)}°F)`}>
                        <Slider value={[coolDiff]} min={0} max={3} step={0.5} onValueChange={(v) => setCoolDiff(v[0])} />
                      </LabeledRow>
                      <LabeledRow label={`Cool Min On Time (${coolMinOn} min)`}>
                        <Slider value={[coolMinOn]} min={1} max={20} step={1} onValueChange={(v) => setCoolMinOn(v[0])} />
                      </LabeledRow>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Live "thermostat" preview */}
        <div className="space-y-6">
          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Live Preview</div>
                <Badge variant="outline" className="rounded-xl">{device.toUpperCase()} • {uiModel === "new" ? "UI: NEW" : "UI: LEGACY"}</Badge>
              </div>

              <div className="rounded-2xl border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Humidity control mode</div>
                  <Pill tone={derived.windowEfficiencyVisible ? "good" : "warn"}>{derived.controlModeLabel}</Pill>
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Active humidity target</div>
                    <div className="text-3xl font-bold">{derived.activeTarget}%</div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    Band: {humidityLow}%–{humidityHigh}%
                    <br />
                    Outdoor: {outdoorTemp}°F
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Auto estimate (toy): <span className="font-semibold">{derived.frostAutoTarget}%</span> based on Window Efficiency + outdoor temp.
                </div>
              </div>

              <div className="rounded-2xl border p-4 space-y-2">
                <div className="text-sm font-semibold">What shows up in the menu?</div>

                <div className="flex flex-wrap gap-2">
                  {humidifierPresent ? <Pill tone="good">Humidifier menu</Pill> : <Pill tone="warn">Humidifier menu hidden</Pill>}
                  {dehumidifierPresent ? <Pill tone="good">Dehumidifier menu</Pill> : <Pill tone="default">No dehumidifier</Pill>}
                  {acOvercoolEnabled ? <Pill tone="warn">AC Overcool ON</Pill> : <Pill tone="default">AC Overcool OFF</Pill>}
                  {derived.windowEfficiencyVisible ? <Pill tone="good">Window Efficiency visible</Pill> : <Pill tone="warn">Window Efficiency hidden</Pill>}
                </div>

                {!derived.windowEfficiencyVisible && humidifierPresent ? (
                  <div className="mt-2 text-xs text-muted-foreground">
                    If you're trying to reproduce the "missing Window Rating" issue: enable <span className="font-semibold">AC Overcool</span> or add a <span className="font-semibold">dehumidifier</span>, or switch to <span className="font-semibold">New UI</span> + <span className="font-semibold">1-wire humidifier</span>.
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-3">
              <div className="font-semibold">Quick Scenarios</div>
              <div className="text-sm text-muted-foreground">One-click toggles to reproduce common complaints.</div>

              <div className="grid grid-cols-1 gap-3">
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => {
                    setUiModel("new");
                    setHumidifierPresent(true);
                    setHumidifierType("evap");
                    setHumidifierWiring("oneWire");
                    setDehumidifierPresent(false);
                    setAcOvercoolEnabled(true);
                  }}
                >
                  "My Window Efficiency disappeared" (Overcool ON)
                </Button>

                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => {
                    setUiModel("new");
                    setHumidifierPresent(true);
                    setHumidifierType("evap");
                    setHumidifierWiring("oneWire");
                    setDehumidifierPresent(false);
                    setAcOvercoolEnabled(false);
                  }}
                >
                  Bring it back (Overcool OFF)
                </Button>

                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => {
                    setUiModel("legacy");
                    setHumidifierPresent(true);
                    setHumidifierType("evap");
                    setHumidifierWiring("twoWire");
                    setDehumidifierPresent(false);
                    setAcOvercoolEnabled(false);
                  }}
                >
                  "Old-school" full knobs (Legacy + 2-wire)
                </Button>

                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => {
                    setUiModel("new");
                    setHumidifierPresent(true);
                    setHumidifierType("steam");
                    setHumidifierWiring("twoWire");
                    setDehumidifierPresent(true);
                    setAcOvercoolEnabled(false);
                  }}
                >
                  Dehumidifier present (often hides frost UI)
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Wiring Diagram Preview</div>
                <Badge variant="outline" className="rounded-xl">ACC+ / ACC-</Badge>
              </div>

              <div className="rounded-2xl border p-4 font-mono text-xs bg-gray-50 dark:bg-gray-900">
                <div className="text-center mb-2 text-gray-600 dark:text-gray-400">Thermostat Wiring</div>
                <pre className="whitespace-pre-wrap leading-tight">
{`Ecobee Thermostat
┌─────────────────┐
│  ACC+  ACC-     │
│  ${humidifierPresent ? (humidifierWiring === "twoWire" ? "●─────●" : "●──────") : "○──────"}     │
│                 │
│  W1   W2   Y    │
│  ${hasFurnaceAux ? "●" : "○"}────${hasHeatPump ? "●" : "○"}────${hasHeatPump ? "●" : "○"}     │
└─────────────────┘

Equipment Connections:
${humidifierPresent ? `ACC+ → Humidifier (${humidifierType})
${humidifierWiring === "twoWire" ? "ACC- → Humidifier (return)" : "ACC- → Not used"}` : `ACC+ → Not connected
ACC- → Not connected`}

${dehumidifierPresent ? `
ACC+ → Dehumidifier
ACC- → Dehumidifier (return)` : ""}

${hasHeatPump ? `
Y → Heat Pump Compressor
W1 → Heat Pump Aux Heat` : hasFurnaceAux ? `
W1 → Furnace/Boiler` : `
No heating equipment`}`}
                </pre>
              </div>

              <div className="text-xs text-muted-foreground">
                This shows how ACC+ and ACC- terminals are used based on your equipment configuration.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AIExplanation
        title="Explanation (Plain English)"
        prompt={`I have an Ecobee thermostat with the following equipment configuration:

- Heat Pump: ${hasHeatPump ? 'Yes' : 'No'}
- Furnace/Aux Heat: ${hasFurnaceAux ? 'Yes' : 'No'}
- Humidifier: ${humidifierPresent ? `Yes (${humidifierType}, ${humidifierWiring} wiring)` : 'No'}
- Dehumidifier: ${dehumidifierPresent ? 'Yes' : 'No'}
- Humidity Control Range: ${humidityLow}% - ${humidityHigh}%
- AC Overcool Enabled: ${acOvercoolEnabled ? `Yes (max ${acOvercoolMax}°F)` : 'No'}

Please explain in 3-4 paragraphs for a homeowner:
1. How this equipment configuration affects which settings and features are available on my Ecobee
2. Why certain humidity or temperature control options appear or disappear based on my wiring
3. How the humidifier/dehumidifier settings interact with my HVAC calls
4. Any important considerations or common mistakes with this configuration

Use plain English without technical jargon where possible.`}
      />

      <div className="text-xs text-muted-foreground">
        Disclaimer: This UI is an educational simulator. Real ecobee firmware behavior varies by model, wiring detection, region, and software versions.
      </div>
    </div>
  );
}