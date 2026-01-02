import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';

const ThermostatDiagrams = () => {
  const navigate = useNavigate();
  
  const handleDocClick = (filename) => {
    // Remove .md extension if present, the route will handle it
    const name = filename.replace('.md', '').replace('/docs/', '');
    navigate(`/docs/${name}`);
  };

  return (
    <div className="w-full min-h-screen bg-gray-900 flex flex-col">
      <div className="bg-gray-800 p-4 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">Drawings</h1>
          <div className="flex gap-2 flex-wrap">
            <Link
              to="/smart-thermostat-build-guide"
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold transition flex items-center gap-2"
            >
              📐 Construction Drawings
            </Link>
            <Link
              to="/smart-thermostat-build-guide"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold transition flex items-center gap-2"
            >
              📘 Step-by-Step Guide
            </Link>
            <a
              href="/docs/SMART_THERMOSTAT_BUILD_GUIDE.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold transition flex items-center gap-2"
            >
              📄 Thermostat Build Guide
            </a>
            <a
              href="/docs/drawing-set.pdf"
              download="drawing-set.pdf"
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold transition flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Drawing Set
            </a>
          </div>
        </div>
        
        {/* Documentation Guides Section */}
        <div className="mt-4 p-4 bg-gray-700 rounded-lg">
          <h2 className="text-lg font-bold text-white mb-3">📚 Documentation Guides</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            <button
              onClick={() => handleDocClick('SMART_THERMOSTAT_BUILD_GUIDE.md')}
              className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm font-medium transition flex items-center gap-2"
            >
              📖 Build Guide
            </button>
            <button
              onClick={() => handleDocClick('SHOPPING-LIST-FINAL.md')}
              className="px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded text-sm font-medium transition flex items-center gap-2"
            >
              🛒 Shopping List
            </button>
            <button
              onClick={() => handleDocClick('DEHUMIDIFIER-WIRING-GUIDE.md')}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm font-medium transition flex items-center gap-2"
            >
              💧 Dehumidifier Wiring
            </button>
            <button
              onClick={() => handleDocClick('CH340-RELAY-SETUP.md')}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium transition flex items-center gap-2"
            >
              🔌 Relay Setup
            </button>
            <button
              onClick={() => handleDocClick('USB-RELAY-OPTIONS.md')}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm font-medium transition flex items-center gap-2"
            >
              🔌 USB Relay Options
            </button>
            <button
              onClick={() => handleDocClick('WINDOW-AC-TESTING.md')}
              className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-sm font-medium transition flex items-center gap-2"
            >
              ❄️ Window AC Testing
            </button>
            <button
              onClick={() => handleDocClick('USB-TEMPERATURE-HUMIDITY-SENSORS.md')}
              className="px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded text-sm font-medium transition flex items-center gap-2"
            >
              🌡️ Temperature Sensors
            </button>
            <button
              onClick={() => handleDocClick('FURNACE-POWER-SETUP.md')}
              className="px-3 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded text-sm font-medium transition flex items-center gap-2"
            >
              ⚡ Power Setup
            </button>
            <button
              onClick={() => handleDocClick('THERMOSTAT-ENCLOSURE-SPEC.md')}
              className="px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded text-sm font-medium transition flex items-center gap-2"
            >
              📦 Enclosure Specs
            </button>
            <button
              onClick={() => handleDocClick('ANDROID-TABLET-THERMOSTAT.md')}
              className="px-3 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded text-sm font-medium transition flex items-center gap-2"
            >
              📱 Tablet Setup
            </button>
            <button
              onClick={() => handleDocClick('BUILD_GUIDE_YOUR_PARTS.md')}
              className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded text-sm font-medium transition flex items-center gap-2"
            >
              🔧 Build Guide (Your Parts)
            </button>
            <button
              onClick={() => handleDocClick('relay-setup.md')}
              className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm font-medium transition flex items-center gap-2"
            >
              🔌 Relay Setup (Alt)
            </button>
            <button
              onClick={() => handleDocClick('COST-REDUCTION.md')}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm font-medium transition flex items-center gap-2"
            >
              💰 Cost Reduction
            </button>
            <button
              onClick={() => handleDocClick('INSTALLATION-GUIDE.md')}
              className="px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded text-sm font-medium transition flex items-center gap-2"
            >
              📖 Installation Guide
            </button>
          </div>
        </div>
      </div>

      {/* Wiring Diagram Images */}
      <div className="bg-gray-800 p-6 border-t border-gray-700">
        <h2 className="text-xl font-bold text-white mb-6 text-center">System Wiring Diagrams</h2>
        
        {/* Hardware Components Overview */}
        <div className="mb-8 pb-8 border-b border-gray-700">
          <div className="flex flex-col items-center">
            <h3 className="text-xl font-semibold text-white mb-4">Hardware Components</h3>
            <div className="flex justify-center w-full">
              <img
                src="/images/thermostat/hardware-components.png"
                alt="Hardware components diagram showing all the physical components of the smart thermostat system"
                className="max-w-full h-auto rounded-lg shadow-lg border border-gray-600"
                style={{ maxHeight: '700px' }}
              />
            </div>
            <p className="text-sm text-gray-400 text-center mt-4 max-w-2xl">
              Overview of all hardware components used in the smart thermostat system
            </p>
          </div>
        </div>

        {/* Wiring Schematic */}
        <div className="mb-8 pb-8 border-b border-gray-700">
          <div className="flex flex-col items-center">
            <h3 className="text-xl font-semibold text-white mb-4">Wiring Schematic</h3>
            <div className="flex justify-center w-full">
              <img
                src="/images/thermostat/wiring-schematic.png"
                alt="Wiring schematic diagram showing detailed electrical connections"
                className="max-w-full h-auto rounded-lg shadow-lg border border-gray-600"
                style={{ maxHeight: '800px' }}
              />
            </div>
            <p className="text-sm text-gray-400 text-center mt-4 max-w-2xl">
              Detailed wiring schematic showing all electrical connections and component interconnections
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
          {/* Complete System Wiring Diagram */}
          <div className="flex flex-col items-center">
            <h3 className="text-lg font-semibold text-white mb-3">Complete System Wiring Diagram</h3>
            <div className="flex justify-center">
              <img
                src="/images/thermostat/wiring-diagram.png"
                alt="Smart Thermostat Complete System Wiring Diagram showing power distribution, USB connections, and control wiring"
                className="max-w-full h-auto rounded-lg shadow-lg border border-gray-600"
                style={{ maxHeight: '600px' }}
              />
            </div>
            <p className="text-sm text-gray-400 text-center mt-3">
              Complete wiring and connection layout for the smart thermostat system
            </p>
          </div>

          {/* Low Voltage Wiring Diagram */}
          <div className="flex flex-col items-center">
            <h3 className="text-lg font-semibold text-white mb-3">Low Voltage Wiring Diagram</h3>
            <div className="flex justify-center">
              <img
                src="/images/thermostat/low-voltage-wiring.png"
                alt="Low voltage wiring diagram for smart thermostat system"
                className="max-w-full h-auto rounded-lg shadow-lg border border-gray-600"
                style={{ maxHeight: '600px' }}
              />
            </div>
            <p className="text-sm text-gray-400 text-center mt-3">
              Low voltage connections and control wiring details
            </p>
          </div>

          {/* Wall Power Wiring Diagram */}
          <div className="flex flex-col items-center">
            <h3 className="text-lg font-semibold text-white mb-3">Wall Power Connection</h3>
            <div className="flex justify-center">
              <img
                src="/images/thermostat/wall-power.png"
                alt="Wall power connection diagram showing how the system plugs into the wall outlet"
                className="max-w-full h-auto rounded-lg shadow-lg border border-gray-600"
                style={{ maxHeight: '600px' }}
              />
            </div>
            <p className="text-sm text-gray-400 text-center mt-3">
              How the system connects to wall power outlet
            </p>
          </div>

          {/* Internal Component Layout */}
          <div className="flex flex-col items-center">
            <h3 className="text-lg font-semibold text-white mb-3">Internal Component Layout</h3>
            <div className="flex justify-center w-full bg-white p-4 rounded-lg">
              <img
                src="/images/thermostat/internal-component-layout.svg"
                alt="Internal component layout showing arrangement of relay module, converters, and USB hub inside the enclosure"
                className="max-w-full h-auto"
                style={{ maxHeight: '600px' }}
              />
            </div>
            <p className="text-sm text-gray-400 text-center mt-3">
              Sheet 2: Layout of components inside the enclosure
            </p>
          </div>
        </div>

        {/* Relay Module and USB Connection Diagrams - Larger Section */}
        <div className="mt-8 pt-8 border-t border-gray-700">
          <h3 className="text-2xl font-bold text-white mb-6 text-center">Detailed Connection Diagrams</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Relay Module Wiring Diagram */}
            <div className="flex flex-col items-center">
              <h4 className="text-xl font-semibold text-white mb-4">Relay Module Wiring</h4>
              <div className="flex justify-center w-full">
                <img
                  src="/images/thermostat/relay-module.png"
                  alt="Relay module wiring diagram showing how to wire up the relay module"
                  className="max-w-full h-auto rounded-lg shadow-lg border border-gray-600"
                  style={{ maxHeight: '900px' }}
                />
              </div>
              <p className="text-sm text-gray-400 text-center mt-4">
                Detailed wiring diagram showing how to wire up the relay module connections for furnace control
              </p>
            </div>

            {/* USB Connection Diagram */}
            <div className="flex flex-col items-center">
              <h4 className="text-xl font-semibold text-white mb-4">USB Connection</h4>
              <div className="flex justify-center w-full">
                <img
                  src="/images/thermostat/usb-connection.png"
                  alt="USB connection diagram showing how to connect USB devices to the system"
                  className="max-w-full h-auto rounded-lg shadow-lg border border-gray-600"
                  style={{ maxHeight: '900px' }}
                />
              </div>
              <p className="text-sm text-gray-400 text-center mt-4">
                USB connection diagram showing how to connect USB devices to the tablet and system
              </p>
            </div>
          </div>
        </div>

        {/* Installation Templates */}
        <div className="mt-8 pt-8 border-t border-gray-700">
          <h3 className="text-2xl font-bold text-white mb-6 text-center">Installation Templates</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Drilling Template */}
            <div className="flex flex-col items-center">
              <h4 className="text-xl font-semibold text-white mb-4">Wall Mount Drilling Template</h4>
              <div className="flex justify-center w-full bg-white p-4 rounded-lg">
                <img
                  src="/images/thermostat/drilling-template.svg"
                  alt="Drilling template showing hole positions for wall mounting the thermostat enclosure"
                  className="max-w-full h-auto"
                  style={{ maxHeight: '400px' }}
                />
              </div>
              <p className="text-sm text-gray-400 text-center mt-4">
                Print at 100% scale (216mm × 165mm) to mark drilling holes for wall mounting. 
                The four black circles indicate mounting hole positions.
              </p>
              <a
                href="/images/thermostat/drilling-template.svg"
                download="drilling-template.svg"
                className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold transition flex items-center gap-2"
              >
                📥 Download Template
              </a>
            </div>

            {/* Enclosure Template */}
            <div className="flex flex-col items-center">
              <h4 className="text-xl font-semibold text-white mb-4">Enclosure Cutout Template</h4>
              <div className="flex justify-center w-full bg-white p-4 rounded-lg">
                <img
                  src="/images/thermostat/enclosure-template.svg"
                  alt="Enclosure template showing tablet cutout, USB slot, vents, and HVAC pass-through"
                  className="max-w-full h-auto"
                  style={{ maxHeight: '400px' }}
                />
              </div>
              <p className="text-sm text-gray-400 text-center mt-4">
                Print at 100% scale (216mm × 200mm) for enclosure fabrication. 
                Red: tablet cutout, Blue: USB slot, Black: mounting holes & HVAC pass-through.
              </p>
              <a
                href="/images/thermostat/enclosure-template.svg"
                download="enclosure-template.svg"
                className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold transition flex items-center gap-2"
              >
                📥 Download Template
              </a>
            </div>
          </div>
        </div>

        {/* Dehumidifier Wiring Diagrams */}
        <div className="mt-8 pt-8 border-t border-gray-700">
          <h3 className="text-2xl font-bold text-white mb-6 text-center">Dehumidifier Wiring Diagrams</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Dehumidifier Diagram 2 */}
            <div className="flex flex-col items-center">
              <h4 className="text-lg font-semibold text-white mb-4">Dehumidifier DIY Diagram</h4>
              <div className="flex justify-center w-full">
                <img
                  src="/images/thermostat/dehumidifier diagram from diy.png"
                  alt="DIY-friendly dehumidifier wiring diagram"
                  className="max-w-full h-auto rounded-lg shadow-lg border border-gray-600"
                  style={{ maxHeight: '600px' }}
                />
              </div>
              <p className="text-sm text-gray-400 text-center mt-4">
                DIY-friendly wiring diagram with component labels
              </p>
            </div>

            {/* ChatGPT Diagram 1 */}
            <div className="flex flex-col items-center">
              <h4 className="text-lg font-semibold text-white mb-4">Component Layout - Diagram 1</h4>
              <div className="flex justify-center w-full">
                <img
                  src="/images/thermostat/ChatGPT Image Nov 26, 2025, 11_55_45 AM.png"
                  alt="Dehumidifier component layout and connections diagram 1"
                  className="max-w-full h-auto rounded-lg shadow-lg border border-gray-600"
                  style={{ maxHeight: '600px' }}
                />
              </div>
              <p className="text-sm text-gray-400 text-center mt-4">
                Component layout and connections - Diagram 1
              </p>
            </div>

            {/* ChatGPT Diagram 2 */}
            <div className="flex flex-col items-center">
              <h4 className="text-lg font-semibold text-white mb-4">Component Layout - Diagram 2</h4>
              <div className="flex justify-center w-full">
                <img
                  src="/images/thermostat/ChatGPT Image Nov 26, 2025, 12_00_46 PM.png"
                  alt="Dehumidifier component layout and connections diagram 2"
                  className="max-w-full h-auto rounded-lg shadow-lg border border-gray-600"
                  style={{ maxHeight: '600px' }}
                />
              </div>
              <p className="text-sm text-gray-400 text-center mt-4">
                Component layout and connections - Diagram 2
              </p>
            </div>

            {/* ChatGPT Diagram 3 */}
            <div className="flex flex-col items-center">
              <h4 className="text-lg font-semibold text-white mb-4">Component Layout - Diagram 3</h4>
              <div className="flex justify-center w-full">
                <img
                  src="/images/thermostat/ChatGPT Image Nov 26, 2025, 12_04_44 PM.png"
                  alt="Dehumidifier component layout and connections diagram 3"
                  className="max-w-full h-auto rounded-lg shadow-lg border border-gray-600"
                  style={{ maxHeight: '600px' }}
                />
              </div>
              <p className="text-sm text-gray-400 text-center mt-4">
                Component layout and connections - Diagram 3
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThermostatDiagrams;
