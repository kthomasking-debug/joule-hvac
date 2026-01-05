import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertCircle, Wind, Gauge, TrendingDown } from 'lucide-react';

const HVACStaticPressure = () => {
  const [staticPressure, setStaticPressure] = useState(0.5);
  const [ductSize, setDuctSize] = useState(100);
  
  // Calculate derived values
  const recommendedPressure = 0.5;
  const pressureRatio = staticPressure / recommendedPressure;
  const airflowReduction = Math.min(40, Math.max(0, (staticPressure - 0.5) * 40));
  const efficiencyLoss = Math.min(35, Math.max(0, (staticPressure - 0.5) * 35));
  const motorStrain = Math.min(100, Math.max(0, (staticPressure - 0.5) * 100));
  const expectedAirflow = 100 - airflowReduction;
  const systemEfficiency = 100 - efficiencyLoss;
  
  // Generate airflow curve data
  const airflowData = [];
  for (let pressure = 0; pressure <= 1.5; pressure += 0.05) {
    const flow = 100 - Math.min(40, Math.max(0, (pressure - 0.5) * 40));
    const efficiency = 100 - Math.min(35, Math.max(0, (pressure - 0.5) * 35));
    airflowData.push({
      pressure: pressure.toFixed(2),
      airflow: flow.toFixed(1),
      efficiency: efficiency.toFixed(1)
    });
  }
  
  // Get status color and message
  const getStatus = () => {
    if (staticPressure <= 0.5) return { color: 'green', text: 'Optimal', bg: 'bg-green-100', border: 'border-green-500' };
    if (staticPressure <= 0.8) return { color: 'yellow', text: 'Acceptable', bg: 'bg-yellow-100', border: 'border-yellow-500' };
    if (staticPressure <= 1.0) return { color: 'orange', text: 'High - Concerns', bg: 'bg-orange-100', border: 'border-orange-500' };
    return { color: 'red', text: 'Critical - Damage Risk', bg: 'bg-red-100', border: 'border-red-500' };
  };
  
  const status = getStatus();

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-gray-50">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">HVAC Static Pressure Impact Analyzer</h1>
        <p className="text-gray-600 mb-6">Understanding how static pressure affects your furnace system performance</p>
        
        {/* Key Concept Box */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
          <div className="flex items-start">
            <AlertCircle className="text-blue-500 mr-3 mt-1 flex-shrink-0" size={20} />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">What is Static Pressure?</h3>
              <p className="text-sm text-blue-800">Static pressure measures resistance to airflow in your ductwork, measured in inches of water column (in. w.c.). Higher pressure means your blower motor works harder to push air through restricted ducts, reducing efficiency and lifespan.</p>
            </div>
          </div>
        </div>

        {/* Interactive Controls */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-50 p-6 rounded-lg">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              <Gauge className="inline mr-2" size={18} />
              Static Pressure: {staticPressure.toFixed(2)} in. w.c.
            </label>
            <input
              type="range"
              min="0.2"
              max="1.5"
              step="0.05"
              value={staticPressure}
              onChange={(e) => setStaticPressure(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-300 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-2">
              <span>0.2</span>
              <span className="font-semibold text-green-600">0.5 (Ideal)</span>
              <span className="font-semibold text-orange-600">0.8</span>
              <span>1.5</span>
            </div>
          </div>

          <div className="bg-gray-50 p-6 rounded-lg">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              <Wind className="inline mr-2" size={18} />
              Relative Duct Size: {ductSize}%
            </label>
            <input
              type="range"
              min="60"
              max="140"
              step="5"
              value={ductSize}
              onChange={(e) => setDuctSize(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-300 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-2">
              <span>Undersized</span>
              <span className="font-semibold text-green-600">100% (Proper)</span>
              <span>Oversized</span>
            </div>
          </div>
        </div>

        {/* Status Banner */}
        <div className={`${status.bg} border-2 ${status.border} rounded-lg p-4 mb-6`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg text-gray-800">System Status: {status.text}</h3>
              <p className="text-sm text-gray-700 mt-1">
                {pressureRatio >= 2 
                  ? "⚠️ Pressure is 2x+ recommended - immediate attention needed!"
                  : pressureRatio > 1.6
                  ? "Pressure significantly exceeds recommendations"
                  : pressureRatio > 1.2
                  ? "Pressure above optimal range"
                  : "System operating within acceptable parameters"}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-800">{pressureRatio.toFixed(1)}x</div>
              <div className="text-sm text-gray-600">vs. recommended</div>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-gray-700">Airflow</h4>
              <Wind className="text-blue-600" size={24} />
            </div>
            <div className="text-3xl font-bold text-blue-700">{expectedAirflow.toFixed(0)}%</div>
            <div className="text-sm text-gray-600 mt-1">of design capacity</div>
            {airflowReduction > 0 && (
              <div className="text-xs text-red-600 mt-2">↓ {airflowReduction.toFixed(0)}% reduction</div>
            )}
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-gray-700">Efficiency</h4>
              <TrendingDown className="text-green-600" size={24} />
            </div>
            <div className="text-3xl font-bold text-green-700">{systemEfficiency.toFixed(0)}%</div>
            <div className="text-sm text-gray-600 mt-1">system efficiency</div>
            {efficiencyLoss > 0 && (
              <div className="text-xs text-red-600 mt-2">↓ {efficiencyLoss.toFixed(0)}% loss</div>
            )}
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-lg border border-orange-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-gray-700">Motor Strain</h4>
              <Gauge className="text-orange-600" size={24} />
            </div>
            <div className="text-3xl font-bold text-orange-700">{motorStrain.toFixed(0)}%</div>
            <div className="text-sm text-gray-600 mt-1">excess workload</div>
            {motorStrain > 50 && (
              <div className="text-xs text-red-600 mt-2">⚠️ Premature failure risk</div>
            )}
          </div>
        </div>

        {/* Performance Chart */}
        <div className="bg-white border rounded-lg p-6 mb-6">
          <h3 className="font-bold text-lg text-gray-800 mb-4">System Performance vs. Static Pressure</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={airflowData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="pressure" 
                label={{ value: 'Static Pressure (in. w.c.)', position: 'insideBottom', offset: -5 }}
              />
              <YAxis label={{ value: 'Performance (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="airflow" 
                stroke="#3B82F6" 
                strokeWidth={2}
                name="Airflow Capacity"
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="efficiency" 
                stroke="#10B981" 
                strokeWidth={2}
                name="System Efficiency"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Visual Duct Diagram */}
        <div className="bg-gray-100 border rounded-lg p-6 mb-6">
          <h3 className="font-bold text-lg text-gray-800 mb-4">Airflow Visualization</h3>
          <div className="flex items-center justify-center space-x-4">
            <div className="text-center">
              <div className="bg-blue-500 rounded p-3 mb-2">
                <Wind className="text-white" size={32} />
              </div>
              <div className="text-sm font-semibold">Blower</div>
            </div>
            
            <div className="flex-1 relative">
              <svg width="100%" height="80" viewBox="0 0 400 80">
                {/* Duct representation */}
                <rect 
                  x="0" 
                  y="20" 
                  width="400" 
                  height="40" 
                  fill="#CBD5E0"
                  stroke="#475569"
                  strokeWidth="2"
                />
                
                {/* Airflow particles - fewer if higher pressure */}
                {Array.from({ length: Math.floor(expectedAirflow / 10) }).map((_, i) => (
                  <circle
                    key={i}
                    cx={40 + i * 40}
                    cy={40}
                    r="4"
                    fill="#3B82F6"
                    opacity="0.7"
                  >
                    <animate
                      attributeName="cx"
                      from="-10"
                      to="410"
                      dur={`${2 + (airflowReduction / 20)}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                ))}
                
                {/* Restriction visualization */}
                {staticPressure > 0.6 && (
                  <>
                    <rect 
                      x="180" 
                      y={30 - (staticPressure - 0.6) * 15} 
                      width="40" 
                      height={20 + (staticPressure - 0.6) * 30}
                      fill="#EF4444"
                      opacity="0.3"
                    />
                    <text x="200" y="15" textAnchor="middle" fontSize="12" fill="#DC2626">
                      Restriction
                    </text>
                  </>
                )}
              </svg>
            </div>
            
            <div className="text-center">
              <div className="bg-gray-400 rounded p-3 mb-2 relative">
                <div className="text-white text-2xl">⌂</div>
                {expectedAirflow < 80 && (
                  <div className="absolute -top-2 -right-2 bg-red-500 rounded-full w-6 h-6 flex items-center justify-center text-white text-xs">
                    !
                  </div>
                )}
              </div>
              <div className="text-sm font-semibold">Supply</div>
            </div>
          </div>
          <div className="text-center mt-4 text-sm text-gray-600">
            Current airflow: <span className="font-bold text-blue-600">{expectedAirflow.toFixed(0)}%</span> of design capacity
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-lg">
          <h3 className="font-bold text-lg text-gray-800 mb-3">Understanding Your Situation</h3>
          
          {staticPressure > 1.0 ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                <strong>Critical pressure levels detected.</strong> Your blower motor is working significantly harder than designed, which will lead to:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 ml-4">
                <li>Premature motor failure (months to 1-2 years)</li>
                <li>Increased energy bills (15-35% higher)</li>
                <li>Reduced heating capacity and comfort</li>
                <li>Potential warranty issues</li>
              </ul>
              <p className="text-sm text-gray-700 mt-3">
                <strong>Options to consider:</strong>
              </p>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 ml-4">
                <li>Duct modifications (most effective but costly)</li>
                <li>Replace with properly sized equipment for your ductwork</li>
                <li>Add return air pathways or increase return duct size</li>
                <li>Install dampers or zone controls (limited effectiveness)</li>
              </ul>
            </div>
          ) : staticPressure > 0.8 ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                <strong>Elevated pressure detected.</strong> While not immediately critical, this will reduce system lifespan and efficiency. Monitor closely and consider duct improvements when possible.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                <strong>System operating within acceptable range.</strong> Continue regular maintenance to keep performance optimal.
              </p>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-yellow-200">
            <p className="text-xs text-gray-600">
              <strong>Important:</strong> The contractor should have assessed ductwork capacity before installation. If your old furnace worked fine for 15 years with the same ducts, the new equipment may be oversized or have higher static pressure requirements. Ask for actual static pressure readings and compare to manufacturer specifications.
            </p>
          </div>
        </div>

        {/* Key Questions Section */}
        <div className="mt-6 bg-purple-50 border-l-4 border-purple-500 p-6 rounded-lg">
          <h3 className="font-bold text-lg text-gray-800 mb-3">Questions to Ask Your Technician</h3>
          <ol className="list-decimal list-inside text-sm text-gray-700 space-y-2 ml-2">
            <li>What is the exact static pressure reading in inches of water column?</li>
            <li>What does the manufacturer specify as maximum static pressure for this unit?</li>
            <li>Was a Manual J load calculation performed before equipment selection?</li>
            <li>Why was this size furnace recommended given the existing ductwork?</li>
            <li>What are the BTU ratings of the old furnace vs. the new one?</li>
            <li>Would a smaller, properly-matched unit work with the existing ducts?</li>
            <li>Can high static pressure void the warranty on this equipment?</li>
            <li>What specific duct modifications would bring pressure into spec?</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default HVACStaticPressure;
