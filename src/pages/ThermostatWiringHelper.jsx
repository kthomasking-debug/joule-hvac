import React, { useState } from "react";

const options = [
  { id: "yes-white", label: "Yes, I see it" },
  { id: "no-white", label: "No white wire" },
  { id: "unsure", label: "Not sure" },
];

const navSections = [
  { id: "wiring", label: "Understanding Your Wiring" },
  { id: "causes", label: "Most Likely Causes" },
  { id: "troubleshooting", label: "Wiring Troubleshooting" },
  { id: "carrier", label: "Carrier/Bryant Systems" },
  { id: "configure", label: "After Wiring: Configure" },
  { id: "safety", label: "Safety First!" },
  { id: "reference", label: "Quick Reference" },
];

export default function ThermostatWiringHelper() {
  const [selected, setSelected] = useState("yes-white");
  const [navOpen, setNavOpen] = useState(false);

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setNavOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-purple-700 px-4 py-8">
      <div className="max-w-6xl mx-auto flex gap-4">
        {/* Sticky Navigation Sidebar */}
        <nav className={`
          fixed left-0 top-0 h-screen bg-white dark:bg-gray-900 shadow-lg z-40 transform transition-transform duration-300 w-64
          ${navOpen ? "translate-x-0" : "-translate-x-full"}
          lg:static lg:translate-x-0 lg:w-56 lg:rounded-tl-2xl lg:rounded-bl-2xl
        `}>
          <div className="h-full overflow-y-auto p-4">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-6">Navigation</h2>
            <ul className="space-y-2">
              {navSections.map((section) => (
                <li key={section.id}>
                  <button
                    onClick={() => scrollToSection(section.id)}
                    className="w-full text-left px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300 transition"
                  >
                    {section.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Overlay for mobile */}
        {navOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setNavOpen(false)}
          />
        )}

        {/* Toggle Button */}
        <button
          onClick={() => setNavOpen(!navOpen)}
          className="fixed bottom-6 right-6 lg:hidden z-50 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-3 shadow-lg"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {navOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {/* Main Content */}
        <div className="flex-1 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden lg:rounded-tr-2xl lg:rounded-br-2xl">
        <header className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white px-8 py-10 text-center">
          <h1 className="text-3xl font-bold mb-2">🔧 Thermostat Wiring Diagnostic</h1>
          <p className="text-lg opacity-90">No heat option? Let's figure out why together</p>
        </header>

        <main className="p-8 space-y-10">
          <section className="bg-amber-50 border-l-4 border-amber-400 rounded-lg p-6 dark:bg-amber-900/20 dark:border-amber-500">
            <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <span>⚠️</span> The Problem
            </h2>
            <p className="mt-2 text-amber-800 dark:text-amber-100">
              Your Ecobee thermostat is only showing "Off" or "Cool" options, but no "Heat" option. This typically means the heating wires aren't connected properly.
            </p>
          </section>

          <section id="wiring">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">📊 Understanding Your Wiring</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                <h3 className="text-center text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Common Terminal Functions</h3>
                <div className="space-y-3">
                  {[
                    { label: "R", color: "bg-red-600", name: "R or Rc (Red)", purpose: "Power - 24V from transformer" },
                    { label: "Y", color: "bg-amber-400 text-black", name: "Y (Yellow)", purpose: "Cooling - Controls A/C compressor" },
                    { label: "G", color: "bg-green-600", name: "G (Green)", purpose: "Fan - Controls air handler fan" },
                    { label: "W", color: "bg-gray-500", name: "W (White)", purpose: "Heating - Controls furnace/heat" },
                    { label: "C", color: "bg-blue-600", name: "C (Blue/Black)", purpose: "Common - Continuous power return" },
                    { label: "O/B", color: "bg-orange-500", name: "O/B (Orange)", purpose: "Heat pump reversing valve" },
                  ].map((t) => (
                    <div key={t.label} className="flex items-center border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg px-3 py-2 shadow-sm">
                      <div className={`w-11 h-11 rounded-lg flex items-center justify-center text-white font-bold mr-3 ${t.color}`}>
                        {t.label}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800 dark:text-gray-100">{t.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{t.purpose}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">What You Need for Heat</h3>
                <div className="mt-4 space-y-6 bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Standard Furnace:</h4>
                    <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                      <li className="bg-gray-50 dark:bg-gray-800 rounded px-3 py-2">✓ R wire (power)</li>
                      <li className="bg-gray-50 dark:bg-gray-800 rounded px-3 py-2">✓ W wire (heat call)</li>
                      <li className="bg-gray-50 dark:bg-gray-800 rounded px-3 py-2">✓ G wire (fan)</li>
                      <li className="bg-gray-50 dark:bg-gray-800 rounded px-3 py-2">○ C wire (recommended)</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Heat Pump:</h4>
                    <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                      <li className="bg-gray-50 dark:bg-gray-800 rounded px-3 py-2">✓ R wire (power)</li>
                      <li className="bg-gray-50 dark:bg-gray-800 rounded px-3 py-2">✓ O/B wire (reversing valve)</li>
                      <li className="bg-gray-50 dark:bg-gray-800 rounded px-3 py-2">✓ Y wire (compressor)</li>
                      <li className="bg-gray-50 dark:bg-gray-800 rounded px-3 py-2">○ W/E wire (aux heat)</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Carrier/Bryant Communicating System:</h4>
                    <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                      <li className="bg-gray-50 dark:bg-gray-800 rounded px-3 py-2">✓ A terminal (Green) - Data +</li>
                      <li className="bg-gray-50 dark:bg-gray-800 rounded px-3 py-2">✓ B terminal (Blue) - Data -</li>
                      <li className="bg-gray-50 dark:bg-gray-800 rounded px-3 py-2">✓ C terminal (White) - 24V Common</li>
                      <li className="bg-gray-50 dark:bg-gray-800 rounded px-3 py-2">✓ D terminal (Red) - 24V Hot</li>
                      <li className="bg-gray-50 dark:bg-gray-800 rounded px-3 py-2">○ S1/S2 terminals (Optional sensors)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="causes" className="bg-cyan-50 dark:bg-cyan-900/20 border-l-4 border-cyan-500 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-cyan-900 dark:text-cyan-100 mb-4">🔍 Most Likely Causes</h2>
            <div className="space-y-3 text-cyan-900 dark:text-cyan-100">
              <div className="pl-6 relative">
                <span className="absolute left-0 text-cyan-600 font-bold">→</span>
                <strong>Missing W wire:</strong> The white wire that controls heating isn't connected to your new Ecobee
              </div>
              <div className="pl-6 relative">
                <span className="absolute left-0 text-cyan-600 font-bold">→</span>
                <strong>Wrong terminal:</strong> The W wire might be connected to the wrong terminal
              </div>
              <div className="pl-6 relative">
                <span className="absolute left-0 text-cyan-600 font-bold">→</span>
                <strong>Wrong system type:</strong> Ecobee might be configured for a heat pump when you have a furnace (or vice versa)
              </div>
              <div className="pl-6 relative">
                <span className="absolute left-0 text-cyan-600 font-bold">→</span>
                <strong>Wire left at furnace:</strong> The W wire might not have been connected at the old thermostat and is tucked behind at the furnace end
              </div>
              <div className="pl-6 relative">
                <span className="absolute left-0 text-cyan-600 font-bold">→</span>
                <strong>Communicating system mismatch:</strong> You may have a Carrier Infinity or Bryant Evolution communicating thermostat that uses ABCD terminals (digital bus) instead of standard R/W/Y/G wiring. This requires special retrofit or adapter installation.
              </div>
            </div>
          </section>

          <section id="troubleshooting" className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-100 dark:border-blue-800">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">🤔 Do you see a WHITE wire at your thermostat wall plate?</h3>
              <div className="flex flex-wrap gap-3">
                {options.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setSelected(o.id)}
                    className={`px-4 py-2 rounded-lg border-2 transition ${
                      selected === o.id
                        ? "bg-indigo-600 border-indigo-600 text-white shadow"
                        : "bg-white dark:bg-gray-900 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-600 dark:text-indigo-200"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 space-y-3">
                <div className={`${selected === "yes-white" ? "block" : "hidden"} bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 rounded-lg p-4`}> 
                  <h4 className="text-lg font-semibold text-green-900 dark:text-green-100 flex items-center gap-2">
                    <span>✅</span> Solution Steps
                  </h4>
                  <ol className="list-decimal list-inside space-y-2 text-green-900 dark:text-green-100">
                    <li>Turn off power at the breaker/furnace switch</li>
                    <li>Connect the white wire to the W terminal on your Ecobee</li>
                    <li>Go to Ecobee settings: Main Menu → Settings → Installation Settings → Equipment</li>
                    <li>Select your heating type: choose Furnace or Boiler (not heat pump)</li>
                    <li>Confirm wiring: ensure it shows W wire detected</li>
                    <li>Restore power and test heating</li>
                  </ol>
                </div>

                <div className={`${selected === "no-white" ? "block" : "hidden"} bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 rounded-lg p-4`}>
                  <h4 className="text-lg font-semibold text-green-900 dark:text-green-100 flex items-center gap-2">
                    <span>🔍</span> Check These Options
                  </h4>
                  <ol className="list-decimal list-inside space-y-2 text-green-900 dark:text-green-100">
                    <li>Look in the wall: the white wire might be tucked inside, unused by your old thermostat</li>
                    <li>Check your furnace: look at the control board — is there a white wire connected there but not at the thermostat?</li>
                    <li>Count your wires: if you only have 2-3 wires total, your old thermostat might have been heat-only or used a different system</li>
                    <li>Heat pump system? If you have a heat pump, you'd use O/B (orange) instead of W for heating</li>
                    <li><strong>Digital communication system?</strong> If you see ABCD terminals instead of R/W/Y/G, you may have a Carrier Infinity or Bryant Evolution communicating thermostat (see below)</li>
                  </ol>
                  <div className="mt-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg p-3">
                    <h5 className="text-red-900 dark:text-red-100 font-semibold mb-1">⚠️ May Need Professional Help</h5>
                    <p className="text-red-900 dark:text-red-100 text-sm">If there's truly no heating wire available, you may need an HVAC technician to run a new wire or install a wire extender kit.</p>
                  </div>
                </div>

                <div className={`${selected === "unsure" ? "block" : "hidden"} bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded-lg p-4`}>
                  <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100">📸 Take Photos to Compare</h4>
                  <ol className="list-decimal list-inside space-y-2 text-blue-900 dark:text-blue-100">
                    <li>Take a clear photo of your old thermostat wiring (before removing it)</li>
                    <li>Take a photo of your current Ecobee wiring</li>
                    <li>Take a photo of the wires at your furnace control board</li>
                    <li>Compare wire colors at both ends to ensure they match</li>
                  </ol>
                  <p className="mt-3 text-blue-900 dark:text-blue-100 text-sm font-semibold">Common wire colors: White = Heating, Yellow = Cooling, Green = Fan, Red = Power</p>
                  <p className="mt-2 text-blue-900 dark:text-blue-100 text-sm"><strong>Special case:</strong> If your old thermostat has a plastic backplate with ABCD terminals instead of color-coded screws, you have a communicating system (see Carrier/Bryant section below).</p>
                </div>
              </div>
            </div>
          </section>

          <section id="carrier" className="bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-500 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-purple-900 dark:text-purple-100 mb-4">🔌 Carrier Infinity / Bryant Evolution Communicating Systems</h2>
            <p className="text-purple-900 dark:text-purple-100 mb-4">If your thermostat backplate uses <strong>ABCD terminals</strong> (not standard R/W/Y/G), you have a communicating system that's incompatible with standard smart thermostats.</p>
            
            <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-purple-200 dark:border-purple-700 mb-4">
              <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-3">Key Identifying Features:</h3>
              <ul className="space-y-2 text-purple-900 dark:text-purple-100 text-sm">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-purple-600">A:</span>
                  <span className="flex-1"><strong>Green wire</strong> — Data +</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-purple-600">B:</span>
                  <span className="flex-1"><strong>Blue wire</strong> — Data - (communication signal)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-purple-600">C:</span>
                  <span className="flex-1"><strong>White wire</strong> — 24V Common</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-purple-600">D:</span>
                  <span className="flex-1"><strong>Red wire</strong> — 24V Hot (power)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-purple-600">S1/S2:</span>
                  <span className="flex-1">Optional remote sensors (outdoor temperature, another room, etc.)</span>
                </li>
              </ul>
              <p className="text-purple-900 dark:text-purple-100 text-sm mt-4 p-3 bg-purple-50 dark:bg-purple-900/30 rounded">
                <strong>System Type:</strong> Uses a digital communication bus (like I2C protocol) instead of individual 24V signals. The furnace/AC "talks" to the thermostat via the A/B data lines.
              </p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 rounded-lg p-4">
              <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">⚠️ Important for Replacement:</h3>
              <p className="text-amber-900 dark:text-amber-100 text-sm mb-3">
                <strong>Cannot swap directly with standard smart thermostats.</strong> You cannot simply remove a Carrier Infinity/Bryant Evolution and plug in an Ecobee, Nest, or standard Honeywell without significant rewiring at your furnace.
              </p>
              <p className="text-amber-900 dark:text-amber-100 text-sm">
                To use a standard smart thermostat, an HVAC technician must bypass the ABCD communication terminals at your furnace/air handler and wire standard R, W, Y, G terminals instead. This is a more complex job than a simple thermostat swap.
              </p>
            </div>
          </section>

          <section id="configure" className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-green-900 dark:text-green-100 mb-3">⚙️ After Wiring: Configure Ecobee</h2>
            <ol className="list-decimal list-inside space-y-2 text-green-900 dark:text-green-100">
              <li>Open the Main Menu on your Ecobee</li>
              <li>Go to Settings → Installation Settings → Equipment</li>
              <li>Select your heating type (Furnace, Boiler, Heat Pump, etc.)</li>
              <li>Verify that the W wire is detected in the wiring configuration screen</li>
              <li>Complete the setup and test your heating</li>
            </ol>
          </section>

          <section id="safety" className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">⚡ Safety First!</h3>
            <p className="text-red-900 dark:text-red-100">Always turn off power at the breaker or furnace switch before touching any wires. If you're uncomfortable working with electrical wiring, contact an HVAC professional or electrician.</p>
          </section>

          <section id="reference" className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">💡 Quick Reference</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[ 
                { title: "No Heat Display?", text: "Check W wire connection" },
                { title: "No C Wire?", text: "Consider PEK adapter" },
                { title: "Heat Pump?", text: "Use O/B, not W wire" },
                { title: "Still Stuck?", text: "Call HVAC tech" },
              ].map((item) => (
                <div key={item.title} className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="font-semibold text-gray-800 dark:text-gray-100">{item.title}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">{item.text}</div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
