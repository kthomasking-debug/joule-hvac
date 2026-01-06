import React, { useState, useMemo } from 'react';
import { AlertTriangle, CheckCircle, Info, Zap, TrendingDown, Thermometer } from 'lucide-react';

export default function HotTubWireCalculator() {
  const [wireGauge, setWireGauge] = useState(8);
  const [runLength, setRunLength] = useState(100);
  const [actualCurrent, setActualCurrent] = useState(37);
  const [voltage, setVoltage] = useState(240);
  const [temperature, setTemperature] = useState(75);

  // Wire resistance per 1000ft at 75°C (ohms)
  const wireResistance = {
    6: 0.410,
    8: 0.628,
    10: 1.018
  };

  // Ampacity ratings (NEC Table 310.16, 75°C column)
  const ampacityRatings = {
    6: 65,
    8: 50,
    10: 35
  };

  const calculations = useMemo(() => {
    const resistance = wireResistance[wireGauge];
    const ampacity = ampacityRatings[wireGauge];
    
    // Total resistance (round trip = 2x length)
    const totalResistance = (resistance * runLength * 2) / 1000;
    
    // Voltage drop calculation
    const voltageDrop = actualCurrent * totalResistance;
    const voltageDropPercent = (voltageDrop / voltage) * 100;
    
    // Voltage at load
    const voltageAtLoad = voltage - voltageDrop;
    
    // Check if wire meets ampacity requirements
    const meetsAmpacity = actualCurrent <= ampacity;
    
    // NEC recommends max 3% for branch circuits, 5% total
    const meetsVoltageDrop = voltageDropPercent <= 3;
    
    // Overall safety check
    const isSafe = meetsAmpacity && meetsVoltageDrop;
    
    return {
      totalResistance: totalResistance.toFixed(4),
      voltageDrop: voltageDrop.toFixed(2),
      voltageDropPercent: voltageDropPercent.toFixed(2),
      voltageAtLoad: voltageAtLoad.toFixed(1),
      ampacity,
      meetsAmpacity,
      meetsVoltageDrop,
      isSafe
    };
  }, [wireGauge, runLength, actualCurrent, voltage]);

  return (
    <div className="min-h-screen bg-gray-900 dark:bg-gray-950 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-gray-800 dark:bg-gray-850 rounded-2xl shadow-2xl overflow-hidden border border-gray-700 dark:border-gray-800">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Zap size={36} />
              <h1 className="text-3xl font-bold">Hot Tub Wire Size Calculator</h1>
            </div>
            <p className="text-blue-100">Check if your existing wire meets code requirements with voltage drop analysis</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 p-8">
            {/* Input Panel */}
            <div className="space-y-6">
              <div className="bg-blue-900/20 dark:bg-blue-900/30 border-2 border-blue-700 dark:border-blue-600 rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-100 dark:text-gray-100">
                  <Info className="text-blue-400 dark:text-blue-500" />
                  Your Installation
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-200 dark:text-gray-300">Wire Gauge (AWG)</label>
                    <select 
                      value={wireGauge}
                      onChange={(e) => setWireGauge(Number(e.target.value))}
                      className="w-full p-3 border-2 border-gray-600 dark:border-gray-700 rounded-lg bg-gray-700 dark:bg-gray-800 text-gray-100 dark:text-gray-200 font-medium"
                    >
                      <option value={6}>#6 AWG</option>
                      <option value={8}>#8 AWG</option>
                      <option value={10}>#10 AWG</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-200 dark:text-gray-300">One-Way Run Length (feet)</label>
                    <input 
                      type="number"
                      value={runLength}
                      onChange={(e) => setRunLength(Number(e.target.value))}
                      className="w-full p-3 border-2 border-gray-600 dark:border-gray-700 rounded-lg bg-gray-700 dark:bg-gray-800 text-gray-100 dark:text-gray-200 font-medium"
                      min="1"
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Distance from panel to hot tub</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-200 dark:text-gray-300">Actual Current Draw (amps)</label>
                    <input 
                      type="number"
                      value={actualCurrent}
                      onChange={(e) => setActualCurrent(Number(e.target.value))}
                      className="w-full p-3 border-2 border-gray-600 dark:border-gray-700 rounded-lg bg-gray-700 dark:bg-gray-800 text-gray-100 dark:text-gray-200 font-medium"
                      min="1"
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">From hot tub nameplate</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-200 dark:text-gray-300">System Voltage</label>
                    <select 
                      value={voltage}
                      onChange={(e) => setVoltage(Number(e.target.value))}
                      className="w-full p-3 border-2 border-gray-600 dark:border-gray-700 rounded-lg bg-gray-700 dark:bg-gray-800 text-gray-100 dark:text-gray-200 font-medium"
                    >
                      <option value={240}>240V</option>
                      <option value={208}>208V</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-200 dark:text-gray-300">Ambient Temperature (°F)</label>
                    <input 
                      type="number"
                      value={temperature}
                      onChange={(e) => setTemperature(Number(e.target.value))}
                      className="w-full p-3 border-2 border-gray-600 dark:border-gray-700 rounded-lg bg-gray-700 dark:bg-gray-800 text-gray-100 dark:text-gray-200 font-medium"
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Underground conduit temp</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Panel */}
            <div className="space-y-6">
              {/* Overall Result */}
              <div className={`border-2 rounded-lg p-6 ${calculations.isSafe ? 'bg-green-900/20 dark:bg-green-900/30 border-green-600 dark:border-green-500' : 'bg-red-900/20 dark:bg-red-900/30 border-red-600 dark:border-red-500'}`}>
                <div className="flex items-start gap-3 mb-4">
                  {calculations.isSafe ? (
                    <CheckCircle className="text-green-500 dark:text-green-400 flex-shrink-0" size={32} />
                  ) : (
                    <AlertTriangle className="text-red-500 dark:text-red-400 flex-shrink-0" size={32} />
                  )}
                  <div>
                    <h2 className="text-xl font-bold mb-1 text-gray-100 dark:text-gray-100">
                      {calculations.isSafe ? 'Wire Size is Adequate ✓' : 'Wire Size Needs Upgrade ✗'}
                    </h2>
                    <p className={`text-sm ${calculations.isSafe ? 'text-green-300 dark:text-green-400' : 'text-red-300 dark:text-red-400'}`}>
                      {calculations.isSafe 
                        ? 'Your #' + wireGauge + ' wire meets NEC requirements'
                        : 'Consider upgrading to larger wire gauge'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Detailed Calculations */}
              <div className="bg-gray-900 dark:bg-gray-900 border-2 border-gray-700 dark:border-gray-800 rounded-lg p-6">
                <h3 className="font-bold text-lg mb-4 text-gray-100 dark:text-gray-100">Calculations</h3>
                
                <div className="space-y-3">
                  <div className="bg-gray-800 dark:bg-gray-850 rounded-lg p-4 border border-gray-700 dark:border-gray-800">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-gray-200 dark:text-gray-300">Wire Ampacity</span>
                      {calculations.meetsAmpacity ? (
                        <CheckCircle className="text-green-500 dark:text-green-400" size={20} />
                      ) : (
                        <AlertTriangle className="text-red-500 dark:text-red-400" size={20} />
                      )}
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-2xl font-bold text-gray-100 dark:text-gray-100">{calculations.ampacity}A</span>
                      <span className="text-sm text-gray-400 dark:text-gray-500">vs {actualCurrent}A load</span>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-600">
                      NEC Table 310.16 (75°C rating)
                    </div>
                  </div>

                  <div className="bg-gray-800 dark:bg-gray-850 rounded-lg p-4 border border-gray-700 dark:border-gray-800">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold flex items-center gap-2 text-gray-200 dark:text-gray-300">
                        <TrendingDown size={16} />
                        Voltage Drop
                      </span>
                      {calculations.meetsVoltageDrop ? (
                        <CheckCircle className="text-green-500 dark:text-green-400" size={20} />
                      ) : (
                        <AlertTriangle className="text-red-500 dark:text-red-400" size={20} />
                      )}
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-2xl font-bold text-gray-100 dark:text-gray-100">{calculations.voltageDropPercent}%</span>
                      <span className="text-sm text-gray-400 dark:text-gray-500">{calculations.voltageDrop}V drop</span>
                    </div>
                    <div className="mt-2">
                      <div className="w-full bg-gray-700 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
                        <div 
                          className={`h-full transition-all ${
                            parseFloat(calculations.voltageDropPercent) <= 3 ? 'bg-green-500' :
                            parseFloat(calculations.voltageDropPercent) <= 5 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(parseFloat(calculations.voltageDropPercent) * 20, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-600 mt-1">
                        <span>0%</span>
                        <span className="text-green-500 dark:text-green-400 font-semibold">3% (recommended)</span>
                        <span className="text-yellow-500 dark:text-yellow-400">5% (max)</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-800 dark:bg-gray-850 rounded-lg p-4 border border-gray-700 dark:border-gray-800">
                    <div className="text-sm font-semibold mb-2 text-gray-200 dark:text-gray-300">Voltage at Hot Tub</div>
                    <div className="text-2xl font-bold text-gray-100 dark:text-gray-100">{calculations.voltageAtLoad}V</div>
                    <div className="text-xs text-gray-500 dark:text-gray-600 mt-1">
                      Starting voltage: {voltage}V
                    </div>
                  </div>

                  <div className="bg-gray-800 dark:bg-gray-850 rounded-lg p-4 border border-gray-700 dark:border-gray-800">
                    <div className="text-sm font-semibold mb-2 text-gray-200 dark:text-gray-300">Wire Resistance</div>
                    <div className="text-2xl font-bold text-gray-100 dark:text-gray-100">{calculations.totalResistance}Ω</div>
                    <div className="text-xs text-gray-500 dark:text-gray-600 mt-1">
                      Round trip ({runLength * 2}ft total)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Explanation Section */}
          <div className="bg-gray-900 dark:bg-gray-900 p-8 border-t-2 border-gray-700 dark:border-gray-800">
            <h3 className="text-xl font-bold mb-4 text-gray-100 dark:text-gray-100">Understanding the Results</h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-800 dark:bg-gray-850 rounded-lg p-5 border-2 border-blue-700 dark:border-blue-600">
                <h4 className="font-bold mb-2 flex items-center gap-2 text-gray-100 dark:text-gray-100">
                  <Thermometer className="text-blue-400 dark:text-blue-500" size={20} />
                  Ampacity Check
                </h4>
                <p className="text-sm text-gray-300 dark:text-gray-400">
                  The wire must be rated to safely carry the continuous current. For a 50A breaker with 37A actual draw, 
                  #8 AWG (50A rating) meets this requirement. The wire ampacity must exceed the actual load.
                </p>
              </div>

              <div className="bg-gray-800 dark:bg-gray-850 rounded-lg p-5 border-2 border-blue-700 dark:border-blue-600">
                <h4 className="font-bold mb-2 flex items-center gap-2 text-gray-100 dark:text-gray-100">
                  <TrendingDown className="text-blue-400 dark:text-blue-500" size={20} />
                  Voltage Drop
                </h4>
                <p className="text-sm text-gray-300 dark:text-gray-400">
                  Long wire runs cause voltage drop due to resistance. The NEC recommends keeping voltage drop under 3% 
                  for branch circuits. Excessive drop reduces efficiency and can damage equipment.
                </p>
              </div>

              <div className="bg-gray-800 dark:bg-gray-850 rounded-lg p-5 border-2 border-orange-700 dark:border-orange-600">
                <h4 className="font-bold mb-2 flex items-center gap-2 text-gray-100 dark:text-gray-100">
                  <AlertTriangle className="text-orange-500 dark:text-orange-400" size={20} />
                  Why This Matters
                </h4>
                <p className="text-sm text-gray-300 dark:text-gray-400">
                  While #8 wire is technically rated for 50A, at 100 feet it may have excessive voltage drop. 
                  The wire might be code-compliant for ampacity but fail voltage drop requirements, causing the hot tub 
                  to underperform or have a shortened lifespan.
                </p>
              </div>

              <div className="bg-gray-800 dark:bg-gray-850 rounded-lg p-5 border-2 border-green-700 dark:border-green-600">
                <h4 className="font-bold mb-2 flex items-center gap-2 text-gray-100 dark:text-gray-100">
                  <CheckCircle className="text-green-500 dark:text-green-400" size={20} />
                  Recommendations
                </h4>
                <ul className="text-sm text-gray-300 dark:text-gray-400 space-y-1">
                  <li>• #6 AWG: Good for runs up to 150ft</li>
                  <li>• #8 AWG: Good for runs up to 80ft</li>
                  <li>• Always check manufacturer specs</li>
                  <li>• Consult a licensed electrician</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Your Specific Case */}
          <div className="bg-yellow-900/30 dark:bg-yellow-900/40 border-t-4 border-yellow-600 dark:border-yellow-500 p-6">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-gray-100 dark:text-gray-100">
              <Info className="text-yellow-500 dark:text-yellow-400" size={24} />
              Your Specific Case: 100ft Run with #8 AWG
            </h3>
            <div className="space-y-2 text-sm text-gray-300 dark:text-gray-400">
              <p><strong className="text-gray-200 dark:text-gray-300">The Issue:</strong> While #8 THHN is rated for 50A in the ampacity table, at 100 feet with a 37A load, 
              you're experiencing approximately 2.32% voltage drop, which is acceptable under the 3% NEC recommendation.</p>
              
              <p><strong className="text-gray-200 dark:text-gray-300">Code Compliance:</strong> Your wire meets both ampacity requirements (50A rating vs 37A load) and 
              voltage drop guidelines (2.32% vs 3% max recommended).</p>
              
              <p><strong className="text-gray-200 dark:text-gray-300">Best Practice:</strong> While your #8 wire is technically adequate, many electricians prefer #6 for 
              50A hot tub circuits as it provides better voltage drop margin and future-proofs the installation. However, 
              your current setup should work fine.</p>
              
              <p className="pt-2 font-semibold text-yellow-400 dark:text-yellow-300">⚠️ Always have a licensed electrician verify your specific installation 
              and local code requirements before making any decisions.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
