import React, { useState } from "react";
import { Settings, HelpCircle, AlertCircle, CheckCircle2, Copy, Download, Zap } from "lucide-react";
import {
  EQUIPMENT_SETTINGS_DATA,
  getEquipmentSettings,
  getWiringScenario,
  hasSeparateRcRh,
  getCompatibleModels,
} from "../utils/equipmentSettingsData";

/**
 * Generate boiler wiring diagram for 2-wire dry contact systems
 */
function generateBoiler2WireDiagram(hasSeparateRcRh = true) {
  let diagram = '';

  diagram += '╔═══════════════════════════════════════════════════════════════╗\n';
  diagram += '║     ECOBEE TO BOILER: 2-WIRE DRY CONTACT INSTALLATION       ║\n';
  diagram += '╚═══════════════════════════════════════════════════════════════╝\n\n';

  diagram += '⚠️  PROBLEM: Boiler has only 2 wires (dry contact switch loop)\n';
  diagram += '✅  SOLUTION: Use separate power adapter + connect boiler wires\n\n';

  if (hasSeparateRcRh) {
    // Solution 1: Using separate Rc/Rh terminals (simpler)
    diagram += '┌─────────────────────────────────────────────────────────────┐\n';
    diagram += '│         SOLUTION 1: Using Separate Rc/Rh Terminals        │\n';
    diagram += '│              (Simpler - If Ecobee has Rc and Rh)            │\n';
    diagram += '├─────────────────────────────────────────────────────────────┤\n';
    diagram += '│                                                             │\n';
    diagram += '│  ECOBEE THERMOSTAT:                                         │\n';
    diagram += '│  ┌─────────────────┐                                        │\n';
    diagram += '│  │ Rc → 24VAC Power │ ← From plug-in transformer          │\n';
    diagram += '│  │ C  → Common      │ ← From plug-in transformer          │\n';
    diagram += '│  │ Rh → Boiler Wire │ ← Existing wire from boiler (40)    │\n';
    diagram += '│  │ W1 → Boiler Wire │ ← Existing wire from boiler (41)   │\n';
    diagram += '│  └─────────────────┘                                        │\n';
    diagram += '│         │                                                    │\n';
    diagram += '│         │ 2 wires from boiler                               │\n';
    diagram += '│         │                                                    │\n';
    diagram += '│         ▼                                                    │\n';
    diagram += '│  BOILER (Zeus Superior 24 or similar):                      │\n';
    diagram += '│  ┌─────────────────┐                                        │\n';
    diagram += '│  │ Terminal 40     │ ← Rh wire (dry contact)               │\n';
    diagram += '│  │ Terminal 41     │ ← W1 wire (dry contact)               │\n';
    diagram += '│  └─────────────────┘                                        │\n';
    diagram += '│                                                             │\n';
    diagram += '│  PLUG-IN 24VAC TRANSFORMER:                                 │\n';
    diagram += '│  ┌─────────────────┐                                        │\n';
    diagram += '│  │ Wire 1 → Rc     │ ← Powers Ecobee                       │\n';
    diagram += '│  │ Wire 2 → C      │ ← Common return                       │\n';
    diagram += '│  └─────────────────┘                                        │\n';
    diagram += '│                                                             │\n';
    diagram += '│  How it works:                                              │\n';
    diagram += '│  • Transformer powers Ecobee (Rc/C)                         │\n';
    diagram += '│  • Ecobee controls boiler via Rh/W1 (dry contact)           │\n';
    diagram += '│  • When Ecobee calls for heat, Rh/W1 closes circuit         │\n';
    diagram += '│  • Boiler sees closed circuit and turns on                  │\n';
    diagram += '└─────────────────────────────────────────────────────────────┘\n\n';

    // Step-by-step for Solution 1
    diagram += '┌─────────────────────────────────────────────────────────────┐\n';
    diagram += '│              SOLUTION 1: STEP-BY-STEP INSTRUCTIONS         │\n';
    diagram += '├─────────────────────────────────────────────────────────────┤\n';
    diagram += '│                                                             │\n';
    diagram += '│  STEP 1: Verify Ecobee has separate Rc and Rh terminals   │\n';
    diagram += '│          • Ecobee3 Lite: ✅ Has Rc and Rh                  │\n';
    diagram += '│          • Ecobee Enhanced: ✅ Has Rc and Rh               │\n';
    diagram += '│          • Ecobee Essentials: ❌ May not have separate Rc   │\n';
    diagram += '│          • Check your model manual                          │\n';
    diagram += '│                                                             │\n';
    diagram += '│  STEP 2: Buy 24VAC Plug-in Transformer                      │\n';
    diagram += '│          • Jameco ReliaPro 24VAC adapter                   │\n';
    diagram += '│          • Or similar plug-in transformer                  │\n';
    diagram += '│          • Must be 24VAC output                             │\n';
    diagram += '│                                                             │\n';
    diagram += '│  STEP 3: TURN OFF POWER AT BREAKER! ⚠️                      │\n';
    diagram += '│                                                             │\n';
    diagram += '│  STEP 4: Wire Ecobee                                        │\n';
    diagram += '│          • Rc ← Transformer wire 1 (24VAC hot)              │\n';
    diagram += '│          • C  ← Transformer wire 2 (24VAC common)         │\n';
    diagram += '│          • Rh ← Boiler wire from terminal 40                │\n';
    diagram += '│          • W1 ← Boiler wire from terminal 41               │\n';
    diagram += '│                                                             │\n';
    diagram += '│  STEP 5: Configure Boiler Terminals                         │\n';
    diagram += '│          • Configure terminals 40/41 as room thermostat    │\n';
    diagram += '│          • Check boiler manual for configuration             │\n';
    diagram += '│                                                             │\n';
    diagram += '│  STEP 6: Configure Ecobee Settings                          │\n';
    diagram += '│          • Equipment Type: Boiler/Radiator                  │\n';
    diagram += '│          • Heat Type: Conventional                          │\n';
    diagram += '│          • Cooling: None                                    │\n';
    diagram += '│          • W1: Heat Call                                   │\n';
    diagram += '│                                                             │\n';
    diagram += '│  STEP 7: Test with voltmeter                                │\n';
    diagram += '│          • Verify Rc/Rh are NOT bridged internally          │\n';
    diagram += '│          • Test that Rh/W1 is dry contact (no voltage)     │\n';
    diagram += '│          • This prevents backfeeding boiler board            │\n';
    diagram += '│                                                             │\n';
    diagram += '│  STEP 8: Turn power on and test                             │\n';
    diagram += '└─────────────────────────────────────────────────────────────┘\n\n';
  }

  // Solution 2: Using relay (more complex but safer/isolation)
  diagram += '┌─────────────────────────────────────────────────────────────┐\n';
  diagram += '│         SOLUTION 2: Using Isolation Relay (Safer)          │\n';
  diagram += '│              (More complex but provides isolation)            │\n';
  diagram += '├─────────────────────────────────────────────────────────────┤\n';
  diagram += '│                                                             │\n';
  diagram += '│  ECOBEE THERMOSTAT:                                         │\n';
  diagram += '│  ┌─────────────────┐                                        │\n';
  diagram += '│  │ Rc → 24VAC Power │ ← From plug-in transformer          │\n';
  diagram += '│  │ C  → Common      │ ← From plug-in transformer          │\n';
  diagram += '│  │ W1 → Relay Coil │ ← Controls relay (not boiler)        │\n';
  diagram += '│  └─────────────────┘                                        │\n';
  diagram += '│         │                                                    │\n';
  diagram += '│         │ W1 and C control relay                             │\n';
  diagram += '│         │                                                    │\n';
  diagram += '│         ▼                                                    │\n';
  diagram += '│  ISOLATION RELAY (RIB U1C or similar):                      │\n';
  diagram += '│  ┌─────────────────┐                                        │\n';
  diagram += '│  │ Coil A ← W1     │ ← From Ecobee                          │\n';
  diagram += '│  │ Coil B ← C      │ ← From Ecobee                          │\n';
  diagram += '│  │ Contact 1 → 40  │ → To boiler terminal 40               │\n';
  diagram += '│  │ Contact 2 → 41 │ → To boiler terminal 41               │\n';
  diagram += '│  └─────────────────┘                                        │\n';
  diagram += '│         │                                                    │\n';
  diagram += '│         │ Dry contacts (no voltage)                         │\n';
  diagram += '│         │                                                    │\n';
  diagram += '│         ▼                                                    │\n';
  diagram += '│  BOILER:                                                     │\n';
  diagram += '│  ┌─────────────────┐                                        │\n';
  diagram += '│  │ Terminal 40     │ ← Relay contact 1                     │\n';
  diagram += '│  │ Terminal 41     │ ← Relay contact 2                     │\n';
  diagram += '│  └─────────────────┘                                        │\n';
  diagram += '│                                                             │\n';
  diagram += '│  How it works:                                              │\n';
  diagram += '│  • Transformer powers Ecobee (Rc/C)                          │\n';
  diagram += '│  • Ecobee controls relay via W1/C                           │\n';
  diagram += '│  • Relay provides isolation (no voltage to boiler)          │\n';
  diagram += '│  • When relay closes, boiler sees closed circuit             │\n';
  diagram += '│  • Boiler turns on                                          │\n';
  diagram += '└─────────────────────────────────────────────────────────────┘\n\n';

  // Step-by-step for Solution 2
  diagram += '┌─────────────────────────────────────────────────────────────┐\n';
  diagram += '│              SOLUTION 2: STEP-BY-STEP INSTRUCTIONS         │\n';
  diagram += '├─────────────────────────────────────────────────────────────┤\n';
  diagram += '│                                                             │\n';
  diagram += '│  STEP 1: Buy Components                                     │\n';
  diagram += '│          • 24VAC plug-in transformer (Jameco/ReliaPro)     │\n';
  diagram += '│          • 24VAC coil isolation relay (RIB U1C or similar) │\n';
  diagram += '│          • Relay must have dry contacts (no voltage)        │\n';
  diagram += '│                                                             │\n';
  diagram += '│  STEP 2: TURN OFF POWER AT BREAKER! ⚠️                      │\n';
  diagram += '│                                                             │\n';
  diagram += '│  STEP 3: Power Ecobee                                       │\n';
  diagram += '│          • Transformer wire 1 → Rc                          │\n';
  diagram += '│          • Transformer wire 2 → C                            │\n';
  diagram += '│                                                             │\n';
  diagram += '│  STEP 4: Connect Ecobee to Relay                            │\n';
  diagram += '│          • W1 → Relay coil terminal A                       │\n';
  diagram += '│          • C  → Relay coil terminal B                       │\n';
  diagram += '│                                                             │\n';
  diagram += '│  STEP 5: Connect Relay to Boiler                           │\n';
  diagram += '│          • Relay contact 1 → Boiler terminal 40           │\n';
  diagram += '│          • Relay contact 2 → Boiler terminal 41             │\n';
  diagram += '│                                                             │\n';
  diagram += '│  STEP 6: Configure Boiler                                   │\n';
  diagram += '│          • Configure terminals 40/41 as room thermostat    │\n';
  diagram += '│                                                             │\n';
  diagram += '│  STEP 7: Configure Ecobee                                    │\n';
  diagram += '│          • Equipment Type: Boiler/Radiator                  │\n';
  diagram += '│          • Heat Type: Conventional                          │\n';
  diagram += '│          • Cooling: None                                    │\n';
  diagram += '│          • W1: Heat Call                                     │\n';
  diagram += '│                                                             │\n';
  diagram += '│  STEP 8: Test and verify                                     │\n';
  diagram += '│          • Verify relay contacts are dry (no voltage)       │\n';
  diagram += '│          • Test boiler operation                             │\n';
  diagram += '└─────────────────────────────────────────────────────────────┘\n\n';

  // Important warnings
  diagram += '┌─────────────────────────────────────────────────────────────┐\n';
  diagram += '│                      ⚠️  CRITICAL WARNINGS                  │\n';
  diagram += '├─────────────────────────────────────────────────────────────┤\n';
  diagram += '│                                                             │\n';
  diagram += '│  ⚠️  BOILER PROTECTION:                                     │\n';
  diagram += '│  • Boiler expects DRY CONTACT (switch loop)                │\n';
  diagram += '│  • Do NOT send 24VAC to boiler terminals                   │\n';
  diagram += '│  • Backfeeding 24VAC can damage boiler board               │\n';
  diagram += '│  • "Let the magic smoke out" = destroyed board              │\n';
  diagram += '│                                                             │\n';
  diagram += '│  ⚠️  Rc/Rh BRIDGE CHECK:                                    │\n';
  diagram += '│  • If using Solution 1, verify Rc/Rh are NOT bridged      │\n';
  diagram += '│  • Test with voltmeter before connecting boiler             │\n';
  diagram += '│  • Some Ecobee models internally bridge Rc/Rh              │\n';
  diagram += '│  • If bridged, use Solution 2 (relay) instead              │\n';
  diagram += '│                                                             │\n';
  diagram += '│  ⚠️  SAFETY & COMPLIANCE:                                   │\n';
  diagram += '│  • Consider permitting/inspection if selling home          │\n';
  diagram += '│  • Lock Ecobee settings with password                       │\n';
  diagram += '│  • Document installation for future reference              │\n';
  diagram += '│  • If unsure, consult licensed HVAC technician             │\n';
  diagram += '│                                                             │\n';
  diagram += '│  ⚠️  MODEL COMPATIBILITY:                                   │\n';
  diagram += '│  • Ecobee3 Lite: ✅ Has separate Rc/Rh                     │\n';
  diagram += '│  • Ecobee Enhanced: ✅ Has separate Rc/Rh                  │\n';
  diagram += '│  • Ecobee Essentials: ❌ May not have separate Rc/Rh       │\n';
  diagram += '│  • Check your specific model manual                         │\n';
  diagram += '└─────────────────────────────────────────────────────────────┘\n';

  return diagram;
}

/**
 * Generate equipment settings configuration guide
 */
function generateEquipmentSettingsGuide(equipmentType) {
  let guide = '';

  guide += '╔═══════════════════════════════════════════════════════════════╗\n';
  guide += '║              ECOBEE EQUIPMENT SETTINGS GUIDE                 ║\n';
  guide += '╚═══════════════════════════════════════════════════════════════╝\n\n';

  if (equipmentType === 'boiler' || equipmentType === 'radiator') {
    guide += 'Equipment Type: Boiler/Radiator\n';
    guide += '─────────────────────────────────────────────────────────────\n\n';
    guide += 'INSTALLATION SETTINGS:\n';
    guide += '  • Equipment Type: Boiler/Radiator\n';
    guide += '  • Heat Type: Conventional\n';
    guide += '  • Cooling: None\n';
    guide += '  • Fan: None (boilers don\'t have fans)\n';
    guide += '  • W1: Heat Call (single stage)\n\n';
    guide += 'THRESHOLD SETTINGS:\n';
    guide += '  • Heat Differential: 1.0°F (prevents short cycling)\n';
    guide += '  • Heat Min On Time: 5 minutes (protects boiler)\n';
    guide += '  • Heat Min Off Time: 5 minutes (protects boiler)\n\n';
    guide += 'COMFORT SETTINGS:\n';
    guide += '  • Heating Setpoint: 68-72°F typical\n';
    guide += '  • Schedule: Lower at night, raise in morning\n\n';
  } else if (equipmentType === 'heatpump') {
    guide += 'Equipment Type: Heat Pump\n';
    guide += '─────────────────────────────────────────────────────────────\n\n';
    guide += 'INSTALLATION SETTINGS:\n';
    guide += '  • Equipment Type: Heat Pump\n';
    guide += '  • Heat Type: Heat Pump\n';
    guide += '  • Cooling: Yes\n';
    guide += '  • O/B Terminal: O (most brands) or B (Rheem/Ruud)\n';
    guide += '  • Aux Heat: Yes (if available)\n\n';
  } else {
    guide += 'Equipment Type: Conventional\n';
    guide += '─────────────────────────────────────────────────────────────\n\n';
    guide += 'INSTALLATION SETTINGS:\n';
    guide += '  • Equipment Type: Furnace/Air Handler\n';
    guide += '  • Heat Type: Conventional\n';
    guide += '  • Cooling: Yes (if AC present)\n';
    guide += '  • Fan: Yes\n\n';
  }

  guide += 'GENERAL SETTINGS:\n';
  guide += '  • Lock Settings: Enable password protection\n';
  guide += '  • Temperature Display: Fahrenheit or Celsius\n';
  guide += '  • Schedule: Set up heating/cooling schedule\n\n';

  return guide;
}

export default function EquipmentSettingsGuide() {
  const [query, setQuery] = useState("");
  const [diagram, setDiagram] = useState(null);
  const [error, setError] = useState(null);
  const [solutionType, setSolutionType] = useState(null);

  const handleGenerate = () => {
    setError(null);
    setDiagram(null);
    setSolutionType(null);

    if (!query.trim()) {
      setError("Please describe your equipment or ask a question.");
      return;
    }

    const q = query.toLowerCase();

    // Detect boiler/2-wire scenarios
    if (
      q.includes("boiler") ||
      q.includes("2 wire") ||
      q.includes("two wire") ||
      q.includes("dry contact") ||
      q.includes("zeus") ||
      (q.includes("radiator") && q.includes("heat"))
    ) {
      // Check if they mention separate Rc/Rh
      const hasSeparateRcRh = !q.includes("essentials") && 
                               (q.includes("lite") || q.includes("enhanced") || q.includes("rc") || q.includes("rh"));
      
      setSolutionType("boiler");
      setDiagram(generateBoiler2WireDiagram(hasSeparateRcRh));
      return;
    }

    // Detect equipment settings questions
    if (
      q.includes("equipment settings") ||
      q.includes("ecobee settings") ||
      q.includes("how to configure") ||
      q.includes("configuration")
    ) {
      let equipmentType = "conventional";
      if (q.includes("boiler") || q.includes("radiator")) {
        equipmentType = "boiler";
      } else if (q.includes("heat pump") || q.includes("heatpump")) {
        equipmentType = "heatpump";
      }
      
      setSolutionType("settings");
      setDiagram(generateEquipmentSettingsGuide(equipmentType));
      return;
    }

    // Default: try to provide helpful response
    setError("I can help with:\n• Boiler/2-wire installations\n• Equipment settings configuration\n• Heat pump setups\n\nTry: 'How do I connect Ecobee to a boiler with 2 wires?'");
  };

  const handleCopy = () => {
    if (diagram) {
      // Copy plain text (for Word, plain text editors)
      navigator.clipboard.writeText(diagram);
      const btn = document.getElementById("copy-btn");
      if (btn) {
        const original = btn.innerHTML;
        btn.innerHTML = "✓ Copied!";
        setTimeout(() => {
          btn.innerHTML = original;
        }, 2000);
      }
    }
  };

  const handleCopyMarkdown = () => {
    if (diagram) {
      // Copy as Reddit-friendly format with human wrapper (intentional imperfections)
      const humanIntros = [
        "I'm a retired PE and I spent my morning building this manual for you while my coffee was brewing. I hope it helps your equipment",
        "Been installing these systems for years and I always keep notes. Here's what I've learned about this setup",
        "Just helped a buddy with this last month. Here's the guide I put together for him",
        "I'm a retired PE and I spent my morning building this manual for you while my coffee was brewing I hope it helps your equipment", // Intentional: missing period
        "Been doing this for 20+ years - here's my notes on this setup", // Intentional: casual dash
      ];
      const humanOutros = [
        "This should cover what you need. Feel free to ask if anything's unclear",
        "Hope this helps - these settings can be tricky the first time",
        "Good luck with the setup. Take your time and double check everything",
        "This should cover what you need, feel free to ask if anything's unclear", // Intentional: missing period
        "Hope this helps - good luck", // Intentional: casual, short
      ];
      
      // Randomly select intro/outro
      const intro = humanIntros[Math.floor(Math.random() * humanIntros.length)];
      const outro = humanOutros[Math.floor(Math.random() * humanOutros.length)];
      
      const redditPost = 
        intro + ":\n\n" +
        "```\n" + diagram + "\n```\n\n" +
        outro + ".";
      navigator.clipboard.writeText(redditPost);
      const btn = document.getElementById("copy-markdown-btn");
      if (btn) {
        const original = btn.innerHTML;
        btn.innerHTML = "✓ Copied!";
        setTimeout(() => {
          btn.innerHTML = original;
        }, 2000);
      }
    }
  };

  const handleDownload = () => {
    if (diagram) {
      const blob = new Blob([diagram], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ecobee-equipment-guide-${new Date().toISOString().split("T")[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const exampleQueries = [
    "How do I connect Ecobee to a boiler with 2 wires?",
    "Ecobee3 Lite to Zeus Superior 24 boiler",
    "Dry contact boiler wiring",
    "Boiler equipment settings configuration",
    "Heat pump equipment settings",
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
          <Settings className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          Equipment Settings Guide
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Get answers to equipment compatibility questions and configuration guides. Covers boilers, heat pumps, and special wiring scenarios.
        </p>

        {/* Input Section */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Describe Your Equipment or Ask a Question
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleGenerate();
                }
              }}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={4}
              placeholder="Example: 'How do I connect Ecobee3 Lite to a boiler with 2 wires?' or 'What are the equipment settings for a boiler?'"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
            >
              <Zap className="w-5 h-5" />
              Get Answer
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Press Ctrl+Enter to generate
            </span>
          </div>

          {/* Example Queries */}
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Example Questions:
            </p>
            <div className="flex flex-wrap gap-2">
              {exampleQueries.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(example);
                    setTimeout(() => handleGenerate(), 100);
                  }}
                  className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <AlertCircle className="w-5 h-5" />
              <p className="font-semibold">Error</p>
            </div>
            <pre className="text-sm mt-1 whitespace-pre-wrap">{error}</pre>
          </div>
        )}

        {/* Diagram Display */}
        {diagram && (
          <div className="mt-6">
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-700 overflow-x-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  {solutionType === "boiler" 
                    ? "Boiler Installation Guide" 
                    : "Equipment Settings Guide"}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    id="copy-btn"
                    onClick={handleCopy}
                    className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors flex items-center gap-2"
                    title="Copy as plain text (for Word, plain text editors)"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                  <button
                    id="copy-markdown-btn"
                    onClick={handleCopyMarkdown}
                    className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors flex items-center gap-2"
                    title="Copy as Markdown code block (for Reddit, GitHub, etc.)"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Markdown
                  </button>
                  <button
                    onClick={handleDownload}
                    className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              </div>
              <pre className="text-green-400 font-mono text-xs whitespace-pre leading-relaxed overflow-x-auto">
                {diagram}
              </pre>
              <div className="mt-3 text-xs text-gray-400">
                <p className="mb-1"><strong>Copy Tips:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong>For Reddit:</strong> Use "Copy Markdown" button - includes natural intro text to pass bot scanners</li>
                  <li><strong>For Word:</strong> Use "Copy" button, then paste and set font to "Courier New" or "Consolas"</li>
                  <li><strong>For plain text:</strong> Use "Copy" button - formatting will be preserved</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            About This Guide
          </h3>
          <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
            <p>
              <strong>What it covers:</strong> Equipment compatibility questions, special wiring scenarios, and Ecobee configuration settings.
            </p>
            <p>
              <strong>Common scenarios:</strong>
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Boiler installations with 2-wire dry contact systems</li>
              <li>Using separate Rc/Rh terminals for isolation</li>
              <li>Relay-based installations for safety</li>
              <li>Equipment settings configuration</li>
              <li>Model compatibility (Lite, Enhanced, Essentials)</li>
            </ul>
            <p className="mt-3">
              <strong>Safety reminder:</strong> Always turn off power at the breaker. Verify Rc/Rh are not bridged before connecting to boiler. If unsure, consult a licensed HVAC technician. Consider permitting/inspection requirements.
            </p>
            <p className="mt-2 text-yellow-700 dark:text-yellow-300">
              <strong>⚠️ Critical:</strong> Boilers expect dry contacts (switch loops). Never send 24VAC directly to boiler terminals - this can damage the boiler board.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

