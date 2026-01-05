import React, { useMemo, useState } from "react";
import {
  Cable,
  Search,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Filter,
  Info,
} from "lucide-react";

/**
 * Ecobee Premium — Equipment Config Matrix + Wiring Diagrams
 *
 * What this page does:
 * - Shows common/valid equipment configurations ecobee Premium can support
 * - Provides a simple ASCII wiring diagram for each configuration
 * - Lets you filter by system type + accessories, and search keywords
 *
 * Notes:
 * - Diagrams are educational and intentionally generic (every HVAC brand/wiring can differ).
 * - Always verify with your equipment control board labels and the ecobee on-screen "Wiring" detection page.
 */

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

const Pill = ({ children, tone = "default" }) => {
  const tones = {
    default: "bg-gray-800/60 border-gray-700 text-gray-200",
    good: "bg-emerald-900/30 border-emerald-700/60 text-emerald-200",
    warn: "bg-amber-900/30 border-amber-700/60 text-amber-200",
    bad: "bg-red-900/30 border-red-700/60 text-red-200",
    blue: "bg-blue-900/30 border-blue-700/60 text-blue-200",
    purple: "bg-purple-900/30 border-purple-700/60 text-purple-200",
  };
  return (
    <span
      className={classNames(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
};

const Card = ({ children, className = "" }) => (
  <div
    className={classNames(
      "rounded-2xl border border-[#222A35] bg-[#151A21] shadow-sm",
      className
    )}
  >
    {children}
  </div>
);

const Button = ({
  children,
  onClick,
  className = "",
  variant = "default",
  ...props
}) => {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors";
  const variants = {
    default: "bg-blue-600 hover:bg-blue-700 text-white",
    outline:
      "border border-[#2A3543] bg-[#0C0F14] hover:bg-[#121824] text-gray-200",
    ghost: "hover:bg-[#121824] text-gray-200",
  };
  return (
    <button
      className={classNames(base, variants[variant], className)}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
};

const Input = ({ value, onChange, placeholder }) => (
  <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-[#222A35] bg-[#0C0F14] py-2 pl-9 pr-3 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
    />
  </div>
);

function MonoBlock({ text }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-[#222A35] bg-[#0C0F14] p-4 text-xs leading-relaxed text-gray-100">
      {text}
    </pre>
  );
}

function ToggleChip({ active, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className={classNames(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-blue-600 bg-blue-600/20 text-blue-200"
          : "border-[#2A3543] bg-[#0C0F14] text-gray-300 hover:bg-[#121824]"
      )}
    >
      {label}
    </button>
  );
}

// -----------------------------------------------------------------------------
// Wiring diagrams (simple/consistent legend)
// -----------------------------------------------------------------------------
const LEGEND = `Legend:
  Thermostat terminals: Rc Rh C Y1 Y2 G O/B W1 W2/AUX ACC+ ACC-
  "R" = 24VAC hot, "C" = 24VAC common
  "Y" = compressor/cooling call, "G" = fan, "W/AUX" = heat / aux heat
  "O/B" = reversing valve (heat pump)
  "ACC" = accessory relay output (humidifier / dehumidifier / ventilator depending on setup)
`;

// Small helper to compose diagrams with a header + legend
function withHeader(title, body) {
  return `${title}\n${"=".repeat(Math.min(78, title.length))}\n${body}\n\n${LEGEND}`;
}

// -----------------------------------------------------------------------------
// Config matrix (curated "common valid" setups for ecobee Premium)
// -----------------------------------------------------------------------------
const CONFIGS = [
  {
    id: "conventional_1h1c",
    title: "Conventional Furnace + A/C (1 Heat / 1 Cool)",
    tags: ["conventional", "furnace", "ac", "basic"],
    required: ["R", "C", "Y1", "G", "W1"],
    optional: ["Y2", "W2", "HUM (ACC)", "DEHUM (ACC)", "VENT (ACC)"],
    notes: [
      "Most common setup. Furnace controls heat, A/C controls cool.",
      "If you have separate Rc/Rh, ecobee can internally jumper unless your system requires separate transformers.",
    ],
    diagram: withHeader(
      "Conventional 1H/1C",
      String.raw`
   HVAC / Air Handler Control Board                 ecobee Premium
   ---------------------------                      ----------------
   R  (24VAC hot)  ------------------------------->  Rc (or Rh)
   C  (common)     ------------------------------->  C
   Y1 (compressor) ------------------------------->  Y1
   G  (fan)        ------------------------------->  G
   W1 (heat)       ------------------------------->  W1

   (Optional)
   Y2 (2nd cool)   ------------------------------->  Y2
   W2 (2nd heat)   ------------------------------->  W2/AUX
`
    ),
  },

  {
    id: "conventional_2h2c",
    title: "Conventional Furnace + A/C (2 Heat / 2 Cool)",
    tags: ["conventional", "furnace", "ac", "staging"],
    required: ["R", "C", "Y1", "G", "W1"],
    optional: ["Y2", "W2"],
    notes: [
      "Two-stage systems use Y2 and/or W2.",
      "Check whether staging is controlled by thermostat or equipment (some furnaces stage internally).",
    ],
    diagram: withHeader(
      "Conventional 2H/2C",
      String.raw`
   HVAC / Air Handler Control Board                 ecobee Premium
   ---------------------------                      ----------------
   R  ------------------------->  Rc (or Rh)
   C  ------------------------->  C
   Y1 ------------------------->  Y1
   Y2 ------------------------->  Y2
   G  ------------------------->  G
   W1 ------------------------->  W1
   W2 ------------------------->  W2/AUX
`
    ),
  },

  {
    id: "heatpump_1h1c_aux_electric",
    title: "Heat Pump (1H/1C) + Electric Aux (Heat Strips)",
    tags: ["heatpump", "aux", "electric", "o/b"],
    required: ["R", "C", "Y1", "G", "O/B", "AUX/W1"],
    optional: ["Y2", "W2/AUX (stage 2 strips)"],
    notes: [
      "Very common modern setup: compressor does most heating; strips assist when needed.",
      "Make sure O/B orientation matches the outdoor unit (energized on cool vs heat).",
    ],
    diagram: withHeader(
      "Heat Pump + Aux Electric (1-stage compressor)",
      String.raw`
   Air Handler / Heat Pump Control Board            ecobee Premium
   -------------------------------                  ----------------
   R  ------------------------->  Rc
   C  ------------------------->  C
   Y1 (compressor) ------------>  Y1
   G  (fan) ------------------->  G
   O/B (reversing valve) ------>  O/B
   AUX / W1 (heat strips) ----->  W1 (AUX)

   (Optional)
   Y2 (2nd stage compressor) -->  Y2
   W2 (2nd stage strips) ----->  W2/AUX
`
    ),
  },

  {
    id: "heatpump_2h2c_aux_electric",
    title: "Heat Pump (2H/2C) + Electric Aux (1–2 Stage Strips)",
    tags: ["heatpump", "aux", "electric", "staging", "o/b"],
    required: ["R", "C", "Y1", "Y2", "G", "O/B", "AUX/W1"],
    optional: ["W2/AUX"],
    notes: [
      "2-stage compressor uses Y2. Aux strips usually land on W1/AUX (and sometimes W2).",
      "If you have equipment-driven staging, Y2 may be unused even if the unit is 2-stage.",
    ],
    diagram: withHeader(
      "Heat Pump 2-stage + Aux Electric",
      String.raw`
   Air Handler / Heat Pump Control Board            ecobee Premium
   -------------------------------                  ----------------
   R  ------------------------->  Rc
   C  ------------------------->  C
   Y1 ------------------------->  Y1
   Y2 ------------------------->  Y2
   G  ------------------------->  G
   O/B ------------------------->  O/B
   AUX/W1 (strips stage1) ----->  W1 (AUX)
   W2 (strips stage2) --------->  W2/AUX (optional)
`
    ),
  },

  {
    id: "dual_fuel_heatpump_furnace",
    title: "Dual Fuel: Heat Pump + Gas Furnace (as Aux/Backup)",
    tags: ["dual-fuel", "heatpump", "furnace", "o/b", "advanced"],
    required: ["R", "C", "Y1", "G", "O/B", "W1"],
    optional: ["Y2", "W2"],
    notes: [
      "In dual-fuel, the furnace replaces electric strips as backup heat.",
      "Critical: wiring and configuration must ensure compressor and furnace don't fight each other (lockouts / simultaneous settings).",
      "Many installers use an external dual-fuel kit; some systems allow thermostat-managed changeover.",
    ],
    diagram: withHeader(
      "Dual Fuel (Heat Pump + Gas Furnace)",
      String.raw`
   Furnace / Air Handler Board                       ecobee Premium
   ---------------------------                       ----------------
   R  ------------------------->  Rc
   C  ------------------------->  C
   G  ------------------------->  G
   W1 (furnace heat) ---------->  W1

   Outdoor Unit / HP Board
   ---------------------
   Y1 (compressor call) ------->  ecobee Y1  <------ (tie through air handler board if combined)
   O/B (rev valve) ------------>  ecobee O/B

   (Optional stages)
   Y2 ------------------------->  ecobee Y2
   W2 (2nd heat) -------------->  ecobee W2/AUX
`
    ),
  },

  {
    id: "boiler_2wire",
    title: "Boiler / Hydronic Heat (2-wire, Heat Only)",
    tags: ["boiler", "heat-only", "2-wire", "simple"],
    required: ["R", "W1"],
    optional: ["C (if available)", "PEK (if no C)"],
    notes: [
      "Classic 2-wire thermostat loop: R and W.",
      "If no C-wire, ecobee may require PEK or a proper C from the boiler transformer depending on your setup.",
    ],
    diagram: withHeader(
      "Boiler (Heat Only, 2-wire)",
      String.raw`
   Boiler / Zone Controller                           ecobee Premium
   -------------------------                          ----------------
   R (24VAC hot)  ------------------------------->     Rc
   W (call for heat) ---------------------------->     W1

   (Optional if you have it)
   C (common)     ------------------------------->     C
`
    ),
  },

  {
    id: "humidifier_1wire_accplus",
    title: "Humidifier (1-wire accessory on ACC+)",
    tags: ["humidifier", "accessory", "acc", "1-wire"],
    required: ["ACC+ (to humidifier control)", "C (common reference often via HVAC)"],
    optional: ["ACC- (if 2-wire)", "External relay depending on humidifier type"],
    notes: [
      "Many humidifiers use a single control lead + shared common.",
      "Depending on humidifier and whether it needs dry-contact closure, you may need an isolation relay.",
      "This is the setup that often correlates with simplified UI in newer firmware.",
    ],
    diagram: withHeader(
      "Humidifier 1-wire (ACC+)",
      String.raw`
   ecobee Premium                                  Humidifier / Relay / Control
   -------------                                   -----------------------------
   ACC+  --------------------------------------->  HUM control input (or relay coil)
   (Common path typically via HVAC C)              (other side of coil/common handled per device)

   Notes:
   - If your humidifier expects a dry-contact closure, use an isolation relay.
`
    ),
  },

  {
    id: "humidifier_2wire_acc",
    title: "Humidifier (2-wire accessory on ACC+ / ACC-)",
    tags: ["humidifier", "accessory", "acc", "2-wire"],
    required: ["ACC+", "ACC-"],
    optional: ["Isolation relay depending on humidifier"],
    notes: [
      "2-wire accessory wiring is often used when ecobee drives a relay circuit directly.",
      "Confirm whether ecobee is configured for 1-wire vs 2-wire accessory in installation settings.",
    ],
    diagram: withHeader(
      "Humidifier 2-wire (ACC+/ACC-)",
      String.raw`
   ecobee Premium                                  Humidifier / Relay / Control
   -------------                                   -----------------------------
   ACC+  --------------------------------------->  Relay coil / input +
   ACC-  --------------------------------------->  Relay coil / input -

   Notes:
   - Dry-contact requirements vary. Use relay if needed.
`
    ),
  },

  {
    id: "dehumidifier_acc",
    title: "Dehumidifier (Accessory via ACC)",
    tags: ["dehumidifier", "accessory", "acc"],
    required: ["ACC+ (or ACC+/ACC- depending)", "Dehumidifier control input"],
    optional: ["Dehumidify with fan", "AC overcool interactions"],
    notes: [
      "When a dehumidifier is configured, ecobee may route humidity UI differently (and hide frost/window efficiency controls).",
      "Some dehumidifiers want dry contact; use relay if required.",
    ],
    diagram: withHeader(
      "Dehumidifier (ACC)",
      String.raw`
   ecobee Premium                                  Dehumidifier / Relay / Control
   -------------                                   -----------------------------
   ACC+  --------------------------------------->  DEHUM call input (or relay)
   (ACC- used if 2-wire required)

   Optional:
   G (fan) may be called during dehumidify-with-fan, depending on settings.
`
    ),
  },

  {
    id: "ventilator_acc",
    title: "Ventilator / HRV / ERV (Accessory via ACC)",
    tags: ["ventilator", "hrv", "erv", "accessory", "acc"],
    required: ["ACC output to ventilator control", "R/C power handled per ventilator controller"],
    optional: ["Free cooling logic (temp/humidity deltas)"],
    notes: [
      "Often an HRV/ERV is controlled by a separate controller; ecobee may provide an enable signal via ACC.",
      "Confirm your ventilator expects a dry-contact or powered signal.",
    ],
    diagram: withHeader(
      "Ventilator (ACC)",
      String.raw`
   ecobee Premium                                  HRV/ERV Controller
   -------------                                   -------------------
   ACC+  --------------------------------------->  Vent enable / dry contact input
   (ACC- if 2-wire)

   Notes:
   - Many HRV/ERV controllers want a dry contact. Use relay if needed.
`
    ),
  },

  {
    id: "pek_no_cwire_conventional",
    title: "No C-Wire (Conventional) using PEK",
    tags: ["pek", "no-c-wire", "conventional", "adapter"],
    required: ["PEK kit", "R/Y/G/W wires at thermostat"],
    optional: ["Depends on system"],
    notes: [
      "If you don't have a C-wire at the thermostat, ecobee often uses its Power Extender Kit (PEK) on conventional systems.",
      "Heat pumps typically need a true C-wire; PEK may not be supported for all heat pump configs.",
    ],
    diagram: withHeader(
      "Conventional + PEK (No C at thermostat)",
      String.raw`
   HVAC Control Board                    PEK (at HVAC)                          ecobee Premium
   -----------------                     -------------                          -------------
   R  -----------\                       R  --------------------------------->   Rc
   C  ------------\                      C  --------------------------------->   C
   Y1 ------------->  into PEK  ------->  Y  --------------------------------->   Y1
   G  -------------->             ----->  G  --------------------------------->   G
   W1 -------------->             ----->  W  --------------------------------->   W1
                         PEK output
                         to ecobee: PEK terminal --------------------------->   PEK

   Notes:
   - Follow ecobee PEK instructions exactly (wire mapping matters).
`
    ),
  },
];

const TAG_GROUPS = [
  { key: "conventional", label: "Conventional" },
  { key: "heatpump", label: "Heat Pump" },
  { key: "dual-fuel", label: "Dual Fuel" },
  { key: "boiler", label: "Boiler" },
  { key: "accessory", label: "Accessories" },
  { key: "humidifier", label: "Humidifier" },
  { key: "dehumidifier", label: "Dehumidifier" },
  { key: "ventilator", label: "Ventilator" },
  { key: "pek", label: "PEK / No C-wire" },
  { key: "staging", label: "Staging" },
];

export default function EcobeeEquipmentMatrix() {
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState([]);
  const [expandedId, setExpandedId] = useState(CONFIGS[0]?.id ?? null);
  const [copiedId, setCopiedId] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CONFIGS.filter((c) => {
      const matchesQuery =
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)) ||
        c.required.some((t) => t.toLowerCase().includes(q)) ||
        c.optional.some((t) => t.toLowerCase().includes(q));

      const matchesTags =
        activeTags.length === 0 || activeTags.every((t) => c.tags.includes(t));

      return matchesQuery && matchesTags;
    });
  }, [query, activeTags]);

  const toggleTag = (tag) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setActiveTags([]);
    setQuery("");
  };

  const copyDiagram = async (id, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      // Clipboard may fail in some contexts (HTTP, permissions). No hard fail.
      setCopiedId("fail");
      setTimeout(() => setCopiedId(null), 1200);
    }
  };

  return (
    <div className="min-h-screen bg-[#0C0F14] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Cable className="h-7 w-7 text-blue-400" />
            Ecobee Premium • Equipment Configurations & Wiring
          </h1>
          <p className="mt-2 max-w-4xl text-gray-300">
            A "menu of what's possible" for the ecobee Premium: common equipment
            configurations plus a wiring diagram for each. Filters let you zoom
            in on heat pumps, dual-fuel, boilers, and accessories.
          </p>

          <div className="mt-4 rounded-xl border border-blue-700/50 bg-blue-900/20 p-4">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 text-blue-400" />
              <div className="text-sm text-blue-200">
                These diagrams are generic. Your control board labels and
                accessory requirements may differ (especially humidifiers,
                dehumidifiers, HRVs/ERVs, and "dry contact" vs powered inputs).
                Always verify against your equipment manuals and ecobee's
                on-thermostat <span className="font-semibold">Wiring</span>{" "}
                screen.
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* LEFT: Filters */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <div className="p-4 border-b border-[#222A35] flex items-center justify-between">
                <div className="font-semibold flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-300" />
                  Filters
                </div>
                <Button variant="ghost" onClick={clearFilters}>
                  Clear
                </Button>
              </div>

              <div className="p-4 space-y-4">
                <Input
                  value={query}
                  onChange={setQuery}
                  placeholder="Search: heat pump, boiler, ACC, W2, PEK…"
                />

                <div className="text-sm font-medium text-gray-200">
                  Categories
                </div>
                <div className="flex flex-wrap gap-2">
                  {TAG_GROUPS.map((t) => (
                    <ToggleChip
                      key={t.key}
                      active={activeTags.includes(t.key)}
                      label={t.label}
                      onClick={() => toggleTag(t.key)}
                    />
                  ))}
                </div>

                <div className="pt-2 text-xs text-gray-400">
                  Showing{" "}
                  <span className="font-semibold text-gray-200">
                    {filtered.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-gray-200">
                    {CONFIGS.length}
                  </span>{" "}
                  configurations.
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-4 border-b border-[#222A35] font-semibold">
                Quick picks
              </div>
              <div className="p-4 space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setActiveTags(["heatpump"]);
                    setExpandedId("heatpump_1h1c_aux_electric");
                    setQuery("");
                  }}
                >
                  Heat pump + electric aux (most common)
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setActiveTags(["dual-fuel"]);
                    setExpandedId("dual_fuel_heatpump_furnace");
                    setQuery("");
                  }}
                >
                  Dual fuel (HP + gas furnace)
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setActiveTags(["boiler"]);
                    setExpandedId("boiler_2wire");
                    setQuery("");
                  }}
                >
                  Boiler (2-wire heat only)
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setActiveTags(["humidifier"]);
                    setExpandedId("humidifier_1wire_accplus");
                    setQuery("");
                  }}
                >
                  Humidifier via ACC (1-wire)
                </Button>
              </div>
            </Card>
          </div>

          {/* RIGHT: List + Details */}
          <div className="lg:col-span-2 space-y-4">
            {filtered.length === 0 ? (
              <Card>
                <div className="p-6 text-center">
                  <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-amber-400" />
                  <div className="text-lg font-semibold">
                    No matches found
                  </div>
                  <div className="mt-1 text-sm text-gray-400">
                    Try clearing filters or searching for terminals like "O/B",
                    "W2", "ACC", or "PEK".
                  </div>
                </div>
              </Card>
            ) : null}

            {filtered.map((cfg) => {
              const expanded = expandedId === cfg.id;
              return (
                <Card key={cfg.id}>
                  <div
                    className="p-4 flex flex-col gap-3 cursor-pointer"
                    onClick={() => setExpandedId(expanded ? null : cfg.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold">
                          {cfg.title}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {cfg.tags.slice(0, 6).map((t) => (
                            <Pill
                              key={t}
                              tone={
                                t === "heatpump"
                                  ? "blue"
                                  : t === "dual-fuel"
                                  ? "purple"
                                  : t === "boiler"
                                  ? "warn"
                                  : t === "accessory" ||
                                    t === "humidifier" ||
                                    t === "dehumidifier" ||
                                    t === "ventilator"
                                  ? "good"
                                  : "default"
                              }
                            >
                              {t}
                            </Pill>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Pill tone={expanded ? "good" : "default"}>
                          {expanded ? "Open" : "Closed"}
                        </Pill>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-[#222A35] bg-[#0C0F14] p-3">
                        <div className="text-xs text-gray-400 mb-2">
                          Required terminals
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {cfg.required.map((t) => (
                            <Pill key={t} tone="good">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {t}
                            </Pill>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#222A35] bg-[#0C0F14] p-3">
                        <div className="text-xs text-gray-400 mb-2">
                          Optional / common add-ons
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {cfg.optional.map((t) => (
                            <Pill key={t} tone="default">
                              {t}
                            </Pill>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {expanded ? (
                    <div className="border-t border-[#222A35] p-4 space-y-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="rounded-xl border border-[#222A35] bg-[#0C0F14] p-4">
                          <div className="text-sm font-semibold mb-2">
                            Notes / gotchas
                          </div>
                          <ul className="list-disc pl-5 text-sm text-gray-300 space-y-1">
                            {cfg.notes.map((n, idx) => (
                              <li key={idx}>{n}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="rounded-xl border border-[#222A35] bg-[#0C0F14] p-4">
                          <div className="text-sm font-semibold mb-2">
                            Copy wiring diagram
                          </div>
                          <div className="text-xs text-gray-400 mb-3">
                            Paste into Reddit, notes, or your Joule docs.
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyDiagram(cfg.id, cfg.diagram);
                              }}
                            >
                              <Copy className="h-4 w-4" />
                              Copy
                            </Button>
                            {copiedId === cfg.id ? (
                              <Pill tone="good">Copied</Pill>
                            ) : null}
                            {copiedId === "fail" ? (
                              <Pill tone="warn">
                                Clipboard blocked (try HTTPS)
                              </Pill>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <MonoBlock text={cfg.diagram} />
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        </div>

        <div className="mt-8 text-xs text-gray-500">
          Tip: If you want, I can extend this page to auto-generate diagrams from
          a "selected wires" checklist (so you can model weird edge cases), or
          add an "ecobee menu simulator" that shows which installation menus
          appear for each configuration.
        </div>
      </div>
    </div>
  );
}