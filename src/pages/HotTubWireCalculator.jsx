import React, { useState, useMemo } from 'react';
import { AlertTriangle, CheckCircle, Info, Zap, TrendingDown, Thermometer } from 'lucide-react';

export default function HotTubWireCalculator() {
  const [wireGauge, setWireGauge] = useState(8);
  const [runLength, setRunLength] = useState(100);
  const [actualCurrent, setActualCurrent] = useState(37);
  const [voltage, setVoltage] = useState(240);
  const [temperature, setTemperature] = useState(75);
  const [insulationType, setInsulationType] = useState('THHN');

  // Wire resistance per 1000ft at 75°C (ohms)
  const wireResistance = {
    6: 0.410,
    8: 0.628,
    10: 1.018
  };

  // Insulation types with their temperature ratings
  const insulationTypes = {
    '60C': {
      types: ['TW', 'UF'],
      temp: 60,
      label: '60°C',
      color: 'bg-yellow-100 border-yellow-300'
    },
    '75C': {
      types: ['RHW', 'THHW', 'THW', 'THWN', 'XHHW', 'USE'],
      temp: 75,
      label: '75°C',
      color: 'bg-blue-100 border-blue-300'
    },
    '90C': {
      types: ['RHW-2', 'THWN-2', 'THW-2', 'XHHW', 'XHHW-2', 'THHN', 'USE-2'],
      temp: 90,
      label: '90°C',
      color: 'bg-green-100 border-green-300'
    }
  };

  // Ampacity ratings by temperature (NEC Table 310.16)
  const ampacityByTemp = {
    6: { 60: 55, 75: 65, 90: 75 },
    8: { 60: 40, 75: 50, 90: 55 },
    10: { 60: 30, 75: 35, 90: 40 }
  };

  // Get temperature rating for selected insulation
  const getTempRating = (insulation) => {
    for (const [key, value] of Object.entries(insulationTypes)) {
      if (value.types.includes(insulation)) {
        return value.temp;
      }
    }
    return 75; // default
  };

  const calculations = useMemo(() => {
    const resistance = wireResistance[wireGauge];
    const tempRating = getTempRating(insulationType);
    
    // Use 75°C column ampacity per NEC 110.14(C) for terminations
    // Even if wire is 90°C rated, terminations are typically 75°C
    const ampacity = ampacityByTemp[wireGauge][75];
    const wireRatedAmpacity = ampacityByTemp[wireGauge][tempRating];
    
    // Total resistance (round trip = 2x length)
    const totalResistance = (resistance * runLength * 2) / 1000;
    
    // Voltage drop calculation
    const voltageDrop = actualCurrent * totalResistance;
    const voltageDropPercent = (voltageDrop / voltage) * 100;
    
    // Voltage at load
    const voltageAtLoad = voltage - voltageDrop;
    
    // Check if wire meets ampacity requirements
    // Use 75°C rating due to termination requirements
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
      wireRatedAmpacity,
      tempRating,
      meetsAmpacity,
      meetsVoltageDrop,
      isSafe
    };
  }, [wireGauge, runLength, actualCurrent, voltage, insulationType]);

  // Get insulation category for styling
  const getInsulationCategory = (insulation) => {
    for (const [key, value] of Object.entries(insulationTypes)) {
      if (value.types.includes(insulation)) {
        return value;
      }
    }
    return insulationTypes['75C'];
  };

  const currentCategory = getInsulationCategory(insulationType);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-950 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Zap size={36} />
              <h1 className="text-3xl font-bold">Hot Tub Wire Size Calculator</h1>
            </div>
            <p className="text-blue-100">Calculate ampacity and voltage drop based on wire type and insulation rating</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 p-8">
            {/* Input Panel */}
            <div className="space-y-6">
              <div className="bg-gray-700 border-2 border-blue-500 rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
                  <Info className="text-blue-400" />
                  Your Installation
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-200">Wire Gauge (AWG)</label>
                    <select 
                      value={wireGauge}
                      onChange={(e) => setWireGauge(Number(e.target.value))}
                      className="w-full p-3 border-2 border-gray-600 rounded-lg bg-gray-800 text-white font-medium"
                    >
                      <option value={6}>#6 AWG</option>
                      <option value={8}>#8 AWG</option>
                      <option value={10}>#10 AWG</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-200">Insulation Type</label>
                    <select 
                      value={insulationType}
                      onChange={(e) => setInsulationType(e.target.value)}
                      className={`w-full p-3 border-2 rounded-lg font-medium ${currentCategory.color}`}
                    >
                      <optgroup label="60°C Rated (Lower ampacity)">
                        <option value="TW">TW (Thermoplastic Wet)</option>
                        <option value="UF">UF (Underground Feeder)</option>
                      </optgroup>
                      <optgroup label="75°C Rated (Standard)">
                        <option value="RHW">RHW (Rubber Heat & Water)</option>
                        <option value="THHW">THHW (Thermoplastic High Heat Wet)</option>
                        <option value="THW">THW (Thermoplastic Heat & Water)</option>
                        <option value="THWN">THWN (Thermoplastic Heat & Water Nylon)</option>
                        <option value="XHHW">XHHW (75°C Crosslinked Polyethylene)</option>
                        <option value="USE">USE (Underground Service Entrance)</option>
                      </optgroup>
                      <optgroup label="90°C Rated (Higher ampacity)">
                        <option value="RHW-2">RHW-2 (Rubber Heat & Water)</option>
                        <option value="THWN-2">THWN-2 (Thermoplastic High Heat Wet Nylon)</option>
                        <option value="THW-2">THW-2 (Thermoplastic Heat & Water)</option>
                        <option value="XHHW-2">XHHW-2 (Crosslinked Polyethylene)</option>
                        <option value="THHN">THHN (Thermoplastic High Heat Nylon)</option>
                        <option value="USE-2">USE-2 (Underground Service Entrance)</option>
                      </optgroup>
                    </select>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${currentCategory.color}`}>
                        {currentCategory.label} Wire Rating
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-200">One-Way Run Length (feet)</label>
                    <input 
                      type="number"
                      value={runLength}
                      onChange={(e) => setRunLength(Number(e.target.value))}
                      className="w-full p-3 border-2 border-gray-600 rounded-lg bg-gray-800 text-white font-medium"
                      min="1"
                    />
                    <p className="text-xs text-gray-400 mt-1">Distance from panel to hot tub</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-200">Actual Current Draw (amps)</label>
                    <input 
                      type="number"
                      value={actualCurrent}
                      onChange={(e) => setActualCurrent(Number(e.target.value))}
                      className="w-full p-3 border-2 border-gray-600 rounded-lg bg-gray-800 text-white font-medium"
                      min="1"
                    />
                    <p className="text-xs text-gray-400 mt-1">From hot tub nameplate</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-200">System Voltage</label>
                    <select 
                      value={voltage}
                      onChange={(e) => setVoltage(Number(e.target.value))}
                      className="w-full p-3 border-2 border-gray-600 rounded-lg bg-gray-800 text-white font-medium"
                    >
                      <option value={240}>240V</option>
                      <option value={208}>208V</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-200">Ambient Temperature (°F)</label>
                    <input 
                      type="number"
                      value={temperature}
                      onChange={(e) => setTemperature(Number(e.target.value))}
                      className="w-full p-3 border-2 border-gray-600 rounded-lg bg-gray-800 text-white font-medium"
                    />
                    <p className="text-xs text-gray-400 mt-1">Underground conduit temp</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Panel */}
            <div className="space-y-6">
              {/* Overall Result */}
              <div className={`border-2 rounded-lg p-6 ${calculations.isSafe ? 'bg-green-900 border-green-500' : 'bg-red-900 border-red-500'}`}>
                <div className="flex items-start gap-3 mb-4">
                  {calculations.isSafe ? (
                    <CheckCircle className="text-green-400 flex-shrink-0" size={32} />
                  ) : (
                    <AlertTriangle className="text-red-400 flex-shrink-0" size={32} />
                  )}
                  <div>
                    <h2 className="text-xl font-bold mb-1 text-white">
                      {calculations.isSafe ? 'Wire Size is Adequate ✓' : 'Wire Size Needs Upgrade ✗'}
                    </h2>
                    <p className={`text-sm ${calculations.isSafe ? 'text-green-200' : 'text-red-200'}`}>
                      {calculations.isSafe 
                        ? `Your #${wireGauge} ${insulationType} wire meets NEC requirements`
                        : 'Consider upgrading wire gauge or insulation type'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Detailed Calculations */}
              <div className="bg-gray-700 border-2 border-gray-600 rounded-lg p-6">
                <h3 className="font-bold text-lg mb-4 text-white">Calculations</h3>
                
                <div className="space-y-3">
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-gray-200">Wire Ampacity</span>
                      {calculations.meetsAmpacity ? (
                        <CheckCircle className="text-green-400" size={20} />
                      ) : (
                        <AlertTriangle className="text-red-400" size={20} />
                      )}
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-2xl font-bold text-white">{calculations.ampacity}A</span>
                      <span className="text-sm text-gray-400">vs {actualCurrent}A load</span>
                    </div>
                    <div className="mt-2 text-xs space-y-1">
                      <div className="flex justify-between text-gray-400">
                        <span>Wire rating ({calculations.tempRating}°C):</span>
                        <span className="font-semibold">{calculations.wireRatedAmpacity}A</span>
                      </div>
                      <div className="flex justify-between text-blue-400 font-semibold">
                        <span>Used (75°C terminations):</span>
                        <span>{calculations.ampacity}A</span>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-600 text-xs text-gray-400">
                      NEC 110.14(C) requires 75°C termination rating
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold flex items-center gap-2 text-gray-200">
                        <TrendingDown size={16} />
                        Voltage Drop
                      </span>
                      {calculations.meetsVoltageDrop ? (
                        <CheckCircle className="text-green-400" size={20} />
                      ) : (
                        <AlertTriangle className="text-red-400" size={20} />
                      )}
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-2xl font-bold text-white">{calculations.voltageDropPercent}%</span>
                      <span className="text-sm text-gray-400">{calculations.voltageDrop}V drop</span>
                    </div>
                    <div className="mt-2">
                      <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div 
                          className={`h-full transition-all ${
                            parseFloat(calculations.voltageDropPercent) <= 3 ? 'bg-green-500' :
                            parseFloat(calculations.voltageDropPercent) <= 5 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(parseFloat(calculations.voltageDropPercent) * 20, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>0%</span>
                        <span className="text-green-400 font-semibold">3% (recommended)</span>
                        <span className="text-yellow-400">5% (max)</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
                    <div className="text-sm font-semibold mb-2 text-gray-200">Voltage at Hot Tub</div>
                    <div className="text-2xl font-bold text-white">{calculations.voltageAtLoad}V</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Starting voltage: {voltage}V
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
                    <div className="text-sm font-semibold mb-2 text-gray-200">Wire Resistance</div>
                    <div className="text-2xl font-bold text-white">{calculations.totalResistance}Ω</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Round trip ({runLength * 2}ft total)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Insulation Type Reference */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-8 border-t-2 border-gray-700">
            <h3 className="text-xl font-bold mb-4 text-white">Wire Insulation Temperature Ratings</h3>
            
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-yellow-900 border-2 border-yellow-600 rounded-lg p-5">
                <h4 className="font-bold mb-2 text-yellow-200">60°C Rated</h4>
                <div className="space-y-1 text-sm">
                  <p className="font-semibold mb-2 text-yellow-100">Lower ampacity</p>
                  <p className="text-xs text-gray-300 mb-2">TW, UF</p>
                  <p className="text-xs text-gray-400">Older installations, limited use</p>
                </div>
              </div>

              <div className="bg-blue-900 border-2 border-blue-600 rounded-lg p-5">
                <h4 className="font-bold mb-2 text-blue-200">75°C Rated</h4>
                <div className="space-y-1 text-sm">
                  <p className="font-semibold mb-2 text-blue-100">Standard ampacity</p>
                  <p className="text-xs text-gray-300 mb-2">RHW, THHW, THW, THWN, XHHW, USE</p>
                  <p className="text-xs text-gray-400">Common for most applications</p>
                </div>
              </div>

              <div className="bg-green-900 border-2 border-green-600 rounded-lg p-5">
                <h4 className="font-bold mb-2 text-green-200">90°C Rated</h4>
                <div className="space-y-1 text-sm">
                  <p className="font-semibold mb-2 text-green-100">Higher ampacity</p>
                  <p className="text-xs text-gray-300 mb-2">RHW-2, THWN-2, THW-2, XHHW-2, THHN, USE-2</p>
                  <p className="text-xs text-gray-400">Modern installations, best performance</p>
                </div>
              </div>
            </div>

            <div className="mt-4 bg-orange-900 border-2 border-orange-600 rounded-lg p-4">
              <p className="text-sm text-orange-100">
                <strong>Important:</strong> Even if your wire is rated for 90°C, NEC 110.14(C) requires you to use the 75°C ampacity column 
                for most terminations unless specifically marked for 90°C. This calculator uses the 75°C rating for terminations.
              </p>
            </div>
          </div>

          {/* Explanation Section */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-8 border-t-2 border-gray-700">
            <h3 className="text-xl font-bold mb-4 text-white">Understanding the Results</h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-lg p-5 border-2 border-blue-600">
                <h4 className="font-bold mb-2 flex items-center gap-2 text-white">
                  <Thermometer className="text-blue-400" size={20} />
                  Temperature Derating
                </h4>
                <p className="text-sm text-gray-300">
                  Wire insulation has temperature limits. While 90°C wire has higher rated ampacity, you must use 75°C values 
                  at terminations (breakers, devices) per NEC 110.14(C). This prevents overheating at connection points.
                </p>
              </div>

              <div className="bg-gray-800 rounded-lg p-5 border-2 border-blue-600">
                <h4 className="font-bold mb-2 flex items-center gap-2 text-white">
                  <TrendingDown className="text-blue-400" size={20} />
                  Voltage Drop
                </h4>
                <p className="text-sm text-gray-300">
                  Long wire runs cause voltage drop due to resistance. The NEC recommends keeping voltage drop under 3% 
                  for branch circuits. Excessive drop reduces efficiency and can damage equipment. Insulation type doesn't affect resistance.
                </p>
              </div>

              <div className="bg-gray-800 rounded-lg p-5 border-2 border-orange-600">
                <h4 className="font-bold mb-2 flex items-center gap-2 text-white">
                  <AlertTriangle className="text-orange-400" size={20} />
                  THHN vs THWN
                </h4>
                <p className="text-sm text-gray-300">
                  THHN (dry locations) and THWN (wet locations) are commonly dual-rated as THHN/THWN. For buried conduit, 
                  you need wet-rated wire. THHN alone is not suitable for wet/buried applications. Look for THWN, THWN-2, 
                  XHHW, or other wet-rated types.
                </p>
              </div>

              <div className="bg-gray-800 rounded-lg p-5 border-2 border-green-600">
                <h4 className="font-bold mb-2 flex items-center gap-2 text-white">
                  <CheckCircle className="text-green-400" size={20} />
                  Recommendations
                </h4>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• #6 THWN-2: Best for 50A, 100ft+ runs</li>
                  <li>• #8 THWN-2: Good for 50A, runs under 80ft</li>
                  <li>• Use wet-rated wire for buried conduit</li>
                  <li>• Always consult a licensed electrician</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Your Specific Case */}
          <div className="bg-yellow-900 border-t-4 border-yellow-600 p-6">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-yellow-100">
              <Info className="text-yellow-400" size={24} />
              Your Specific Case: 100ft Run with #8 AWG THHN/THWN
            </h3>
            <div className="space-y-2 text-sm text-gray-200">
              <p><strong className="text-white">The Issue:</strong> Your #8 THHN/THWN wire is rated for 50A at 75°C terminations (55A at 90°C wire rating, 
              but you use 75°C due to terminations). At 100 feet with a 37A load, you're experiencing approximately 2.32% voltage drop, 
              which is acceptable under the 3% NEC recommendation.</p>
              
              <p><strong className="text-white">Code Compliance:</strong> Your wire meets both ampacity requirements (50A rating at 75°C vs 37A load) and 
              voltage drop guidelines (2.32% vs 3% max recommended). The THHN/THWN or THWN designation means it's suitable for 
              wet locations like buried conduit.</p>
              
              <p><strong className="text-white">Best Practice:</strong> While your #8 wire is technically adequate, many electricians prefer #6 THWN-2 for 
              50A hot tub circuits because it provides:</p>
              <ul className="ml-4 space-y-1 text-gray-300">
                <li>• Better voltage drop margin (only ~1.5% at 100ft)</li>
                <li>• Future-proofing for higher current loads</li>
                <li>• More forgiving for slight overcurrent conditions</li>
                <li>• Reduced heat generation in the wire</li>
              </ul>
              
              <p><strong className="text-white">Your Current Setup:</strong> Should work fine for a 37A load. The 50A breaker provides proper overcurrent 
              protection, and you're well within voltage drop limits. However, if you're already pulling new wire or the existing 
              run is difficult, upgrading to #6 would be the safer long-term choice.</p>
              
              <p className="pt-2 font-semibold text-yellow-200">⚠️ Always have a licensed electrician verify your specific installation 
              and local code requirements before making any decisions. Some jurisdictions may have stricter requirements.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
