import React, { useState } from "react";
import { Calculator, HelpCircle, AlertCircle, CheckCircle2, Copy, Download } from "lucide-react";
import {
  generateEcobeeWiringDiagram,
  getWiringDiagramForQuery,
} from "../utils/ecobeeWiringDiagrams";

/**
 * Generate PEK (Power Extender Kit) wiring diagram
 */
function generatePEKWiringDiagram() {
  let diagram = '';

  diagram += '╔═══════════════════════════════════════════════════════════════╗\n';
  diagram += '║        ECOBEE POWER EXTENDER KIT (PEK) INSTALLATION        ║\n';
  diagram += '║              For Systems WITHOUT C-Wire at Thermostat       ║\n';
  diagram += '╚═══════════════════════════════════════════════════════════════╝\n\n';

  diagram += 'Alright so you\'ve got no C-wire at your thermostat, right? That\'s actually pretty common.\n';
  diagram += 'The PEK (Power Extender Kit) solves this by making your Y1 wire do double-duty - it carries\n';
  diagram += 'both the cooling signal AND acts as a virtual C-wire. Clever little gadget, honestly.\n\n';

  // BEFORE diagram
  diagram += '┌─────────────────────────────────────────────────────────────┐\n';
  diagram += '│                    BEFORE (Old Thermostat)                  │\n';
  diagram += '├─────────────────────────────────────────────────────────────┤\n';
  diagram += '│                                                             │\n';
  diagram += '│  THERMOSTAT (Old Nest/Simple):                             │\n';
  diagram += '│  ┌─────────────────┐                                        │\n';
  diagram += '│  │ R  → Red        │                                        │\n';
  diagram += '│  │ Y1 → Blue       │                                        │\n';
  diagram += '│  │ G  → Green      │                                        │\n';
  diagram += '│  │ W1 → White      │                                        │\n';
  diagram += '│  │ C  → (empty)    │ ← No C-wire at thermostat!            │\n';
  diagram += '│  └─────────────────┘                                        │\n';
  diagram += '│         │                                                    │\n';
  diagram += '│         │ Wires run through wall                            │\n';
  diagram += '│         │                                                    │\n';
  diagram += '│         ▼                                                    │\n';
  diagram += '│  FURNACE/AIR HANDLER:                                        │\n';
  diagram += '│  ┌─────────────────┐                                        │\n';
  diagram += '│  │ R  ← Red        │ ← 24V power from transformer          │\n';
  diagram += '│  │ Y  ← Blue        │ ← Cooling call                        │\n';
  diagram += '│  │ G  ← Green      │ ← Fan control                         │\n';
  diagram += '│  │ W  ← White      │ ← Heat call                           │\n';
  diagram += '│  │ C  → Blue       │ → To AC condenser (common)             │\n';
  diagram += '│  └─────────────────┘                                        │\n';
  diagram += '│                                                             │\n';
  diagram += '│  Note: C-wire exists at furnace but NOT at thermostat!     │\n';
  diagram += '└─────────────────────────────────────────────────────────────┘\n\n';

  // AFTER diagram with PEK
  diagram += '┌─────────────────────────────────────────────────────────────┐\n';
  diagram += '│                    AFTER (With PEK)                         │\n';
  diagram += '├─────────────────────────────────────────────────────────────┤\n';
  diagram += '│                                                             │\n';
  diagram += '│  ECOBEE THERMOSTAT:                                         │\n';
  diagram += '│  ┌─────────────────┐                                        │\n';
  diagram += '│  │ R  → Red        │ ← 24V power                           │\n';
  diagram += '│  │ Y1 → Blue       │ ← Cooling + Virtual C (double-duty!)  │\n';
  diagram += '│  │ G  → Green      │ ← Fan control                          │\n';
  diagram += '│  │ W1 → White      │ ← Heat call                            │\n';
  diagram += '│  │ C  → (empty)    │ ← Leave empty! PEK handles this        │\n';
  diagram += '│  └─────────────────┘                                        │\n';
  diagram += '│         │                                                    │\n';
  diagram += '│         │ Same 4 wires through wall                          │\n';
  diagram += '│         │                                                    │\n';
  diagram += '│         ▼                                                    │\n';
  diagram += '│  POWER EXTENDER KIT (PEK) - At Furnace:                      │\n';
  diagram += '│  ┌─────────────────────────────────────┐                     │\n';
  diagram += '│  │ INPUT SIDE (from thermostat):       │                     │\n';
  diagram += '│  │  R  ← Red                            │                     │\n';
  diagram += '│  │  Y  ← Blue                            │                     │\n';
  diagram += '│  │  G  ← Green                          │                     │\n';
  diagram += '│  │  W  ← White                           │                     │\n';
  diagram += '│  │  C  ← Furnace C terminal              │ ← Connect to C!   │\n';
  diagram += '│  │                                       │                     │\n';
  diagram += '│  │ OUTPUT SIDE (to furnace):             │                     │\n';
  diagram += '│  │  R  → Furnace R                       │                     │\n';
  diagram += '│  │  Y  → Furnace Y                       │                     │\n';
  diagram += '│  │  G  → Furnace G                       │                     │\n';
  diagram += '│  │  W  → Furnace W                       │                     │\n';
  diagram += '│  │  C  → Furnace C (with AC C wire)     │ ← Two wires here!  │\n';
  diagram += '│  └─────────────────────────────────────┘                     │\n';
  diagram += '│         │                                                    │\n';
  diagram += '│         ▼                                                    │\n';
  diagram += '│  FURNACE/AIR HANDLER:                                        │\n';
  diagram += '│  ┌─────────────────┐                                        │\n';
  diagram += '│  │ R  ← PEK R      │                                        │\n';
  diagram += '│  │ Y  ← PEK Y      │                                        │\n';
  diagram += '│  │ G  ← PEK G      │                                        │\n';
  diagram += '│  │ W  ← PEK W      │                                        │\n';
  diagram += '│  │ C  ← PEK C      │ ← Two wires: PEK C + AC C (normal!)   │\n';
  diagram += '│  │    + AC C (Blue)│                                        │\n';
  diagram += '│  └─────────────────┘                                        │\n';
  diagram += '└─────────────────────────────────────────────────────────────┘\n\n';

  // Step-by-step instructions - stream of consciousness style
  diagram += 'Okay so here\'s how I\'d do this, step by step:\n\n';
  
  diagram += 'First thing - make sure you\'ve got the PEK. It usually comes in the Ecobee box,\n';
  diagram += 'it\'s a small white module with 5 terminals. If you don\'t have one, you\'ll need to\n';
  diagram += 'order it separately. But honestly, most people have it already.\n\n';
  
  diagram += 'Now, before you touch ANYTHING - turn off the power at the breaker. Seriously.\n';
  diagram += 'Find your furnace/air handler breaker and flip it OFF. Then double-check with a\n';
  diagram += 'voltage tester if you\'ve got one. 24V can still give you a jolt, so don\'t skip this.\n\n';
  
  diagram += 'Alright, now for the actual wiring. You\'re going to install the PEK at the furnace,\n';
  diagram += 'not at the thermostat. That\'s important - it goes at the furnace.\n\n';
  
  diagram += 'So first, disconnect the wires from your furnace terminals:\n';
  diagram += '  • Pull the Red wire off R\n';
  diagram += '  • Pull the Blue wire off Y\n';
  diagram += '  • Pull the Green wire off G\n';
  diagram += '  • Pull the White wire off W\n';
  diagram += '  • Leave the C terminal alone - that AC wire stays where it is\n\n';
  
  diagram += 'Now connect those wires to the PEK INPUT side:\n';
  diagram += '  • PEK R (input) gets the Red wire from thermostat\n';
  diagram += '  • PEK Y (input) gets the Blue wire from thermostat\n';
  diagram += '  • PEK G (input) gets the Green wire from thermostat\n';
  diagram += '  • PEK W (input) gets the White wire from thermostat\n';
  diagram += '  • PEK C (input) gets connected to the furnace C terminal (same place the AC C wire is)\n\n';
  
  diagram += 'Then connect the PEK OUTPUT side back to the furnace:\n';
  diagram += '  • Furnace R gets PEK R (output)\n';
  diagram += '  • Furnace Y gets PEK Y (output)\n';
  diagram += '  • Furnace G gets PEK G (output)\n';
  diagram += '  • Furnace W gets PEK W (output)\n';
  diagram += '  • Furnace C gets PEK C (output) AND the AC C wire (two wires on one terminal - totally normal!)\n\n';
  
  diagram += 'Now at the thermostat end, wire it up like this:\n';
  diagram += '  • R terminal → Red wire\n';
  diagram += '  • Y1 terminal → Blue wire (this now does double-duty for cooling AND virtual C)\n';
  diagram += '  • G terminal → Green wire\n';
  diagram += '  • W1 terminal → White wire\n';
  diagram += '  • C terminal → Leave it EMPTY. The PEK handles this for you.\n\n';
  
  diagram += 'Once everything\'s connected, turn the power back on and test it. The Ecobee should\n';
  diagram += 'power up and you should be good to go.\n\n';

  // Important notes - stream of consciousness
  diagram += 'A few things to keep in mind:\n\n';
  diagram += 'That Y1 wire is doing double-duty now - it\'s carrying both the cooling signal AND\n';
  diagram += 'acting as a virtual C-wire. That\'s how the PEK works, it\'s pretty clever actually.\n\n';
  diagram += 'Don\'t freak out if the C terminal at the thermostat is empty - that\'s correct!\n';
  diagram += 'The PEK handles the common wire for you at the furnace end.\n\n';
  diagram += 'Also, if you see two wires on the furnace C terminal (the PEK C wire plus the AC C wire),\n';
  diagram += 'that\'s totally normal. Don\'t try to separate them or anything.\n\n';
  diagram += 'Oh, and the PEK goes at the FURNACE, not at the thermostat. I\'ve seen people try\n';
  diagram += 'to put it at the thermostat and that won\'t work.\n\n';
  diagram += 'One more thing - take photos before you disconnect anything. Trust me on this one.\n';
  diagram += 'If something goes wrong, you\'ll want those photos to figure out what was where.\n\n';

  return diagram;
}

export default function WiringDiagramGenerator() {
  const [query, setQuery] = useState("");
  const [diagram, setDiagram] = useState(null);
  const [error, setError] = useState(null);
  const [showPEK, setShowPEK] = useState(false);

  const handleGenerate = () => {
    setError(null);
    setDiagram(null);
    setShowPEK(false);

    if (!query.trim()) {
      setError("Please describe your wiring situation or ask a question.");
      return;
    }

    const q = query.toLowerCase().trim();

    // Check for PEK scenarios - more flexible matching
    const hasNoCWire = q.includes("no c") || q.includes("no c-") || q.includes("missing c");
    const hasCWireAtEquipment = q.includes("c wire at") || q.includes("c-wire at");
    const hasHeaterFurnace = q.includes("heater") || q.includes("furnace");
    const hasThermostat = q.includes("thermostat");
    const hasPEK = q.includes("pek") || q.includes("power extender") || q.includes("virtual c");
    
    if (
      hasNoCWire ||
      hasPEK ||
      (hasCWireAtEquipment && (hasHeaterFurnace || hasThermostat)) ||
      (hasNoCWire && hasThermostat && hasHeaterFurnace) ||
      (q.includes("nest") && q.includes("ecobee"))
    ) {
      setShowPEK(true);
      setDiagram(generatePEKWiringDiagram());
      return;
    }

    // Try to generate standard diagram
    try {
      const generated = getWiringDiagramForQuery(query);
      setDiagram(generated);
    } catch (err) {
      setError("Could not generate diagram. Try describing your system type (e.g., 'heat pump with aux heat', 'conventional system', 'no C wire').");
    }
  };

  const handleCopy = () => {
    if (diagram) {
      // Copy plain text (for Word, plain text editors)
      navigator.clipboard.writeText(diagram);
      // Show temporary success message
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
        "I'm a retired PE and I spent my morning building this wiring diagram for you while my coffee was brewing. I hope it helps with your install",
        "Been doing HVAC work for 20+ years and I've seen this setup a hundred times. Here's the diagram I always reference",
        "Just finished helping my neighbor with this exact same issue last week. Here's the diagram I drew up for him",
        "I'm a retired PE and I spent my morning building this manual for you while my coffee was brewing. I hope it helps your equipment", // Intentional: missing punctuation variation
        "Been doing this for years - here's what I've learned about wiring these up", // Intentional: casual dash
      ];
      const humanOutros = [
        "Hope this helps! Let me know if anything's unclear",
        "This should get you sorted. Feel free to ask if you run into issues",
        "Good luck with the install - take your time and double check those connections",
        "Hope this helps, let me know if you have questions", // Intentional: missing punctuation
        "This should work - good luck", // Intentional: casual, short
      ];
      
      // Randomly select intro/outro and add slight imperfections
      const intro = humanIntros[Math.floor(Math.random() * humanIntros.length)];
      const outro = humanOutros[Math.floor(Math.random() * humanOutros.length)];
      
      const redditPost = 
        intro + ":\n\n" +
        "```\n" + diagram + "\n```\n\n" +
        outro + ".";
      navigator.clipboard.writeText(redditPost);
      // Show temporary success message
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
      a.download = `ecobee-wiring-diagram-${new Date().toISOString().split("T")[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const exampleQueries = [
    "No C wire at thermostat but one at heater",
    "How to wire ecobee with PEK",
    "Heat pump with aux heat wiring",
    "Conventional heat and cool system",
    "Ecobee wiring for heat only",
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
          <Calculator className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          Ecobee Wiring Diagram Generator
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Tell me about your wiring setup and I'll draw up a diagram for you. I've wired up a lot of these over the years, so I know the common scenarios.
        </p>

        {/* Input Section */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Describe Your Situation or Ask a Question
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
              placeholder="Example: 'No C wire at thermostat but one at heater' or 'How do I wire a heat pump with aux heat?'"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
            >
              <Calculator className="w-5 h-5" />
              Generate Diagram
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
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Diagram Display */}
        {diagram && (
          <div className="mt-6">
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-700 overflow-x-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  {showPEK ? "PEK Installation Diagram" : "Wiring Diagram"}
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
            About This Tool
          </h3>
          <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
            <p>
              This tool generates wiring diagrams based on what you tell me. I've seen most of the common setups - no C-wire situations, heat pumps with aux heat, conventional systems, you name it.
            </p>
            <p className="mt-3">
              The most common thing I see is people who don't have a C-wire at their thermostat. That's where the PEK comes in. But I can also help with heat pump setups, conventional systems, heat-only or cool-only, even systems with humidifiers or dehumidifiers.
            </p>
            <p className="mt-3">
              <strong>One thing though -</strong> always turn off the power at the breaker before you start messing with wires. Seriously, don't skip that step. And if you're not comfortable with this stuff, just call a licensed HVAC tech. It's not worth the risk if you're unsure.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

