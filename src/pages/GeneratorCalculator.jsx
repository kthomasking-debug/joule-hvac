import React, { useState, useMemo } from 'react';
import { Fuel, DollarSign, Zap, Clock, AlertTriangle, Droplets } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceDot, ReferenceLine } from 'recharts';

const GeneratorCalculator = () => {
  const [model, setModel] = useState('20kW');
  const [baselineSelections, setBaselineSelections] = useState(['lights-fridge']);
  const [fuelPrice, setFuelPrice] = useState(3.0);
  const [tankSize, setTankSize] = useState(500);
  const [heatPumpRunning, setHeatPumpRunning] = useState(false);
  const [heatPumpKw, setHeatPumpKw] = useState(10);

  const heatPumpOptions = [
    { kw: 5, label: '5 kW (1.5 ton)', desc: 'Milder climates, rarely freezing' },
    { kw: 8, label: '8 kW (2 ton)', desc: 'Moderate climates' },
    { kw: 10, label: '10 kW (3 ton)', desc: 'Colder climates, emergency heating' },
    { kw: 13, label: '13 kW (3.5 ton)', desc: 'Very cold climates' },
    { kw: 15, label: '15 kW (4 ton)', desc: 'Extreme cold/large spaces' },
  ];

  const baselineOptions = [
    { id: 'lights-fridge', kw: 1.5, label: 'Lights + Fridge + Router', desc: 'Core always-on loads' },
    { id: 'well-pump', kw: 1.0, label: 'Well/Sump Pump', desc: 'Intermittent motor load' },
    { id: 'gas-furnace', kw: 0.8, label: 'Gas Furnace Blower', desc: 'Fan + controls (gas/oil furnace)' },
    { id: 'electric-stove', kw: 5.0, label: 'Electric Stove/Oven', desc: 'Cooking on one burner/oven' },
    { id: 'water-heater', kw: 4.5, label: 'Electric Water Heater', desc: 'One element running' },
    { id: 'dryer', kw: 5.0, label: 'Electric Dryer', desc: 'Typical home dryer' },
    { id: 'microwave', kw: 1.5, label: 'Microwave/Dishwasher', desc: 'Kitchen small appliances' },
    { id: 'ev-level1', kw: 1.4, label: 'EV Level-1 (120V)', desc: 'Trickle charge only' },
  ];

  const specs = {
    '14kW': {
      consumption: [0.9, 1.2, 1.7, 2.2, 2.9],
    },
    '20kW': {
      consumption: [1.1, 1.6, 2.3, 3.1, 4.1],
    },
  };

  const getGPH = (loadPercent, modelType) => {
    const data = specs[modelType].consumption;
    let lowerIndex, upperIndex, fraction;

    if (loadPercent === 0) return data[0];
    if (loadPercent <= 25) {
      lowerIndex = 0;
      upperIndex = 1;
      fraction = loadPercent / 25;
    } else if (loadPercent <= 50) {
      lowerIndex = 1;
      upperIndex = 2;
      fraction = (loadPercent - 25) / 25;
    } else if (loadPercent <= 75) {
      lowerIndex = 2;
      upperIndex = 3;
      fraction = (loadPercent - 50) / 25;
    } else {
      lowerIndex = 3;
      upperIndex = 4;
      fraction = (loadPercent - 75) / 25;
    }

    const lowerVal = data[lowerIndex];
    const upperVal = data[upperIndex];
    return (lowerVal + (upperVal - lowerVal) * fraction).toFixed(2);
  };

  // Generator capacity
  const maxGenKw = model === '14kW' ? 14 : 20;

  // Quick preset configurations
  const applyPreset = (presetName) => {
    switch (presetName) {
      case 'essentials':
        setBaselineSelections(['lights-fridge', 'well-pump']);
        setHeatPumpRunning(false);
        break;
      case 'winter':
        setBaselineSelections(['lights-fridge', 'well-pump', 'gas-furnace']);
        setHeatPumpRunning(true);
        break;
      case 'full':
        setBaselineSelections(['lights-fridge', 'well-pump', 'gas-furnace', 'microwave']);
        setHeatPumpRunning(false);
        break;
      default:
        setBaselineSelections([]);
    }
  };

  // Baseline load from selected utilities
  const baselineKw = baselineSelections.reduce((sum, id) => {
    const item = baselineOptions.find((opt) => opt.id === id);
    return sum + (item ? item.kw : 0);
  }, 0);
  const baselineLoadPercent = Math.min(100, Math.round((baselineKw / maxGenKw) * 100));

  // Heat pump load contribution
  const heatPumpLoadPercent = heatPumpRunning ? Math.round((heatPumpKw / maxGenKw) * 100) : 0;
  const totalLoadPercent = Math.min(100, baselineLoadPercent + heatPumpLoadPercent);
  const totalKw = baselineKw + (heatPumpRunning ? heatPumpKw : 0);
  const isOverloaded = totalKw > maxGenKw;

  // Consumption and costs are based on total load
  const gph = parseFloat(getGPH(totalLoadPercent, model));
  const hourlyCost = gph * fuelPrice;
  const dailyCostContinuous = hourlyCost * 24;
  const intervalHours = 5;
  const dailyCostInterval = hourlyCost * intervalHours;

  const usableTank = tankSize * 0.8;
  const daysToEmptyContinuous = gph > 0 ? usableTank / (gph * 24) : 0;
  const daysToEmptyInterval = gph > 0 ? usableTank / (gph * intervalHours) : 0;

  // Cost point at the actual total load (used for the chart marker)
  const totalCostPoint = useMemo(() => {
    const gphAtLoad = parseFloat(getGPH(totalLoadPercent, model));
    const hourlyCostAtLoad = gphAtLoad * fuelPrice;
    const outputKw = (totalLoadPercent / 100) * maxGenKw;
    const costPerKwhAtLoad = outputKw > 0 ? hourlyCostAtLoad / outputKw : 0;
    return {
      load: totalLoadPercent,
      costPerKwh: parseFloat(costPerKwhAtLoad.toFixed(3)),
      gph: gphAtLoad,
      hourlyCost: parseFloat(hourlyCostAtLoad.toFixed(2)),
    };
  }, [totalLoadPercent, model, fuelPrice, maxGenKw]);

  // Calculate cost per kWh for different loads
  const costPerKwhData = useMemo(() => {
    const data = [];
    const modelSpecs = specs[model];
    
    for (let loadPercent = 0; loadPercent <= 100; loadPercent += 5) {
      const gph = parseFloat(getGPH(loadPercent, model));
      const hourlyCost = gph * fuelPrice;
      
      // Estimate kW output (rough estimate: ~10kW at 100% load, ~14kW for 20kW model)
      const maxKw = model === '14kW' ? 14 : 20;
      const outputKw = (loadPercent / 100) * maxKw;
      
      // Cost per kWh = hourly cost / kW output
      const costPerKwh = outputKw > 0 ? (hourlyCost / outputKw) : 0;
      
      data.push({
        load: loadPercent,
        costPerKwh: parseFloat(costPerKwh.toFixed(3)),
        gph: parseFloat(gph.toFixed(2)),
        hourlyCost: parseFloat(hourlyCost.toFixed(2)),
      });
    }
    
    return data;
  }, [model, fuelPrice, getGPH]);

  return (
    <div className="max-w-4xl mx-auto p-4 bg-slate-50 dark:bg-slate-950 min-h-screen font-sans text-slate-900 dark:text-slate-100">
      <div className="bg-blue-900 text-white p-6 rounded-t-lg shadow-lg dark:shadow-blue-900/30">
        <div className="flex items-center gap-3">
          <Zap className="h-8 w-8 text-yellow-400" />
          <h1 className="text-2xl font-bold">Generator Fuel & Cost Estimator</h1>
        </div>
        <p className="text-blue-200 mt-2 text-sm">Typical heat pump backup power requirements</p>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-b-lg shadow-lg dark:shadow-slate-900/40 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-100 mb-2">Generator Model</label>
            <div className="flex gap-2">
              {['14kW', '20kW'].map((m) => (
                <button
                  key={m}
                  onClick={() => setModel(m)}
                  className={`flex-1 py-2 rounded font-medium transition-colors ${
                    model === m
                      ? 'bg-blue-600 text-white shadow'
                      : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-300 mt-2">*Your 26kW unit will burn approx 15-20% more than the 20kW model shown.</p>
          </div>

          <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-100 mb-2 flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Propane Price ($/gal)
            </label>
            <input
              type="number"
              step="0.10"
              value={fuelPrice}
              onChange={(e) => setFuelPrice(parseFloat(e.target.value))}
              className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-100 mb-2 flex items-center gap-2">
              <Fuel className="h-4 w-4" /> Tank Size (Gallons)
            </label>
            <select
              value={tankSize}
              onChange={(e) => setTankSize(Number(e.target.value))}
              className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="250">250 Gallon (Small)</option>
              <option value="500">500 Gallon (Standard)</option>
              <option value="1000">1000 Gallon (Buried)</option>
            </select>
            <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">Assumes 80% max fill ({usableTank.toFixed(0)} gal usable)</p>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/40 border-2 border-blue-200 dark:border-blue-900/50 p-6 rounded-xl">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-blue-600" /> Heat Pump Load
          </h3>
          
          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={heatPumpRunning}
                onChange={(e) => setHeatPumpRunning(e.target.checked)}
                className="w-5 h-5 rounded"
              />
              <span className="font-medium text-slate-700 dark:text-slate-100">Add Heat Pump to Load</span>
            </label>
          </div>

          {heatPumpRunning && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-100 mb-2">Heat Pump Capacity</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {heatPumpOptions.map((option) => (
                  <button
                    key={option.kw}
                    onClick={() => setHeatPumpKw(option.kw)}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      heatPumpKw === option.kw
                        ? 'border-blue-600 bg-blue-100 dark:border-blue-400 dark:bg-blue-900/40'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400 dark:hover:border-blue-500'
                    }`}
                  >
                    <div className="font-semibold text-slate-800 dark:text-slate-100">{option.label}</div>
                    <div className="text-xs text-slate-600 dark:text-slate-300">{option.desc}</div>
                  </button>
                ))}
              </div>
              <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-blue-200 dark:border-blue-900/50 text-sm">
                <p className="text-slate-700 dark:text-slate-200">
                  <span className="font-semibold">Heat Pump Load:</span> {heatPumpLoadPercent}% of generator capacity
                </p>
                <p className="text-slate-700 dark:text-slate-200 mt-1">
                  <span className="font-semibold">Total Load:</span> {totalLoadPercent}% ({baselineLoadPercent}% baseline + {heatPumpLoadPercent}% heat pump)
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border-2 border-blue-100 dark:border-blue-900/60">
          <div className="flex justify-between items-start mb-4">
            <div>
              <label className="font-bold text-xl text-slate-800 dark:text-slate-100">Baseline Electrical Load</label>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Select the household equipment you plan to power</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500 dark:text-slate-300">Using</p>
              <span className="text-3xl font-mono text-blue-600 dark:text-blue-300 font-bold">{baselineKw.toFixed(1)} kW</span>
              {heatPumpRunning && (
                <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">+ {heatPumpKw} kW heat pump</p>
              )}
              <p className="text-lg font-bold text-slate-700 dark:text-slate-200 mt-2">Total: {totalKw.toFixed(1)} kW</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">({totalLoadPercent}% of {maxGenKw}kW)</p>
            </div>
          </div>

          {isOverloaded && (
            <div className="bg-red-100 dark:bg-red-900/30 border-2 border-red-500 dark:border-red-700 p-4 rounded-lg mb-4">
              <p className="text-red-900 dark:text-red-100 font-bold text-lg flex items-center gap-2">
                <AlertTriangle className="h-6 w-6" />
                OVERLOAD WARNING
              </p>
              <p className="text-red-800 dark:text-red-200 mt-1 text-base">
                Your selected load ({totalKw.toFixed(1)} kW) exceeds generator capacity ({maxGenKw} kW). Turn off some appliances or upgrade to a larger generator.
              </p>
            </div>
          )}

          <div className="mb-4">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Quick Presets:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => applyPreset('essentials')}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-base transition-colors"
              >
                Essentials Only
              </button>
              <button
                onClick={() => applyPreset('winter')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-base transition-colors"
              >
                Winter Emergency
              </button>
              <button
                onClick={() => applyPreset('full')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-base transition-colors"
              >
                Full House
              </button>
              <button
                onClick={() => setBaselineSelections([])}
                className="px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg font-semibold text-base transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {baselineOptions.map((item) => {
              const checked = baselineSelections.includes(item.id);
              return (
                <label
                  key={item.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    checked
                      ? 'border-blue-600 bg-blue-100 dark:border-blue-400 dark:bg-blue-900/30'
                      : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400 dark:hover:border-blue-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setBaselineSelections((prev) => [...prev, item.id]);
                      } else {
                        setBaselineSelections((prev) => prev.filter((id) => id !== item.id));
                      }
                    }}
                    className="mt-1 w-5 h-5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-base text-slate-800 dark:text-slate-100">{item.label}</span>
                      <span className="text-sm font-mono font-bold text-blue-700 dark:text-blue-300">{item.kw} kW</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{item.desc}</p>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <StatBox label="Consumption" value={`${gph} gal/hr`} icon={<Droplets className="h-4 w-4 text-blue-500" />} />
            <StatBox label="Hourly Cost" value={`$${hourlyCost.toFixed(2)}`} icon={<DollarSign className="h-4 w-4 text-green-600" />} />
            <StatBox label="Days until Empty" value={`${daysToEmptyContinuous.toFixed(1)} days`} sub="Running 24/7" icon={<AlertTriangle className="h-4 w-4 text-orange-500" />} />
            <StatBox label="24h Cost" value={`$${dailyCostContinuous.toFixed(0)}`} sub="Continuous" highlight />
          </div>
        </div>

        <div className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg p-5">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5" /> Cost Efficiency Analysis
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">Cost per kWh at different load levels (lower is better efficiency)</p>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={costPerKwhData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.25)" />
              <XAxis 
                type="number"
                dataKey="load"
                domain={[0, 100]}
                allowDataOverflow={false}
                label={{ value: 'Load (%)', position: 'insideBottomRight', offset: -5, fill: '#e2e8f0' }}
                stroke="#cbd5e1"
                tick={{ fill: '#e2e8f0' }}
              />
              <YAxis 
                label={{ value: 'Cost ($/kWh)', angle: -90, position: 'insideLeft', fill: '#e2e8f0' }}
                stroke="#cbd5e1"
                tick={{ fill: '#e2e8f0' }}
              />
              <Tooltip 
                formatter={(value) => value.toFixed(3)}
                contentStyle={{ backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #1e293b', borderRadius: '8px' }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px', color: '#cbd5e1' }} />
              <Line 
                type="monotone" 
                dataKey="costPerKwh" 
                stroke="#2563eb" 
                strokeWidth={2}
                dot={{ fill: '#2563eb', r: 4 }}
                activeDot={{ r: 6 }}
                name="Cost per kWh"
              />
              {totalLoadPercent > 0 && (
                <ReferenceLine 
                  x={totalCostPoint.load} 
                  ifOverflow="extendDomain"
                  stroke="#f59e0b" 
                  strokeDasharray="5 5" 
                  label={{ value: `Total: ${totalCostPoint.load}%`, position: 'top', fill: '#f59e0b', fontSize: 12, fontWeight: 'bold' }}
                />
              )}
            {totalLoadPercent > 0 && (
              <ReferenceDot 
                x={totalCostPoint.load} 
                y={totalCostPoint.costPerKwh}
                ifOverflow="extendDomain"
                r={6}
                fill="#f59e0b"
                stroke="#d97706"
                strokeWidth={2}
              />
            )}
            </LineChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-100">
              <p className="font-semibold mb-1">💡 Key Insight:</p>
              <p>The generator is most efficient (lowest $/kWh) at higher loads. At 50-100% load, you're getting better value per kWh than at low idle loads.</p>
            </div>
            {(baselineLoadPercent > 0 || heatPumpRunning) && (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-100">
                <p className="font-semibold mb-1">📍 Your Load:</p>
                <p>At {totalLoadPercent}% total load, your cost efficiency is calculated for the selected utilities{heatPumpRunning ? ' + heat pump' : ''}.</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 rounded-lg p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-100 text-xs font-bold px-2 py-1 rounded-bl">EXPENSIVE</div>
            <h3 className="font-bold text-red-900 dark:text-red-100 flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5" /> Run Continuous (Auto)
            </h3>
            <ul className="text-sm text-red-800 dark:text-red-100 space-y-2 mb-6">
              <li>• Generator runs 24 hours/day</li>
              <li>• Idles while you sleep (wasting fuel)</li>
              <li>• High risk of tank depletion</li>
            </ul>
            <div className="bg-white dark:bg-slate-900 p-4 rounded border border-red-100 dark:border-red-800 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-300 uppercase tracking-wide font-semibold">Cost per Day</p>
              <p className="text-3xl font-black text-red-600 dark:text-red-300">${dailyCostContinuous.toFixed(0)}</p>
              <p className="text-xs text-red-400 dark:text-red-200 mt-1">Burn Rate: {Number(gph * 24).toFixed(0)} gallons/day</p>
            </div>
          </div>

          <div className="border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 rounded-lg p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-100 text-xs font-bold px-2 py-1 rounded-bl">RECOMMENDED</div>
            <h3 className="font-bold text-green-900 dark:text-green-100 flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5" /> Interval Strategy
            </h3>
            <ul className="text-sm text-green-800 dark:text-green-100 space-y-2 mb-6">
              <li>• Run 2 hrs AM, 2 hrs PM (4-5 hrs total)</li>
              <li>• Keep fridge cold & house warm</li>
              <li>• Turn OFF completely between runs</li>
            </ul>
            <div className="bg-white dark:bg-slate-900 p-4 rounded border border-green-100 dark:border-green-800 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-300 uppercase tracking-wide font-semibold">Cost per Day</p>
              <p className="text-3xl font-black text-green-600 dark:text-green-300">${dailyCostInterval.toFixed(0)}</p>
              <p className="text-xs text-green-600 dark:text-green-200 mt-1">
                You save <strong>${(dailyCostContinuous - dailyCostInterval).toFixed(0)}</strong> per day
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-300 mt-2">Tank lasts about {daysToEmptyInterval.toFixed(1)} days with intervals</p>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 dark:bg-amber-900/20 border-l-4 border-orange-400 dark:border-amber-700 p-4 text-sm text-orange-800 dark:text-amber-100">
          <p className="font-bold mb-1">Warning: Deep Freeze Risk</p>
          On very cold nights (e.g., 10°F), you may need to increase runtime to protect pipes. The "Interval" cost above is a baseline for milder days.
        </div>
      </div>
    </div>
  );
};

const StatBox = ({ label, value, sub, icon, highlight }) => (
  <div className={`p-3 rounded-lg border ${highlight ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
    <div className="flex items-center gap-2 mb-1 text-slate-500 dark:text-slate-300 text-xs font-bold uppercase tracking-wider">
      {icon} {label}
    </div>
    <div className={`text-xl font-bold ${highlight ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-100'}`}>
      {value}
    </div>
    {sub && <div className="text-xs text-slate-400 dark:text-slate-300 mt-1">{sub}</div>}
  </div>
);

export default GeneratorCalculator;
