import React, { useState, useMemo } from 'react';
import { Fuel, DollarSign, Zap, Clock, AlertTriangle, Droplets } from 'lucide-react';

const GeneratorCalculator = () => {
  const [model, setModel] = useState('20kW');
  const [baselineSelections, setBaselineSelections] = useState(['lights-fridge']);
  const [fuelPrice, setFuelPrice] = useState(3.0);
  const [tankSize, setTankSize] = useState(500);
  const [heatPumpRunning, setHeatPumpRunning] = useState(false);
  const [heatPumpKw, setHeatPumpKw] = useState(10);

  const heatPumpOptions = [
    { kw: 5, label: '5 kW (1.5 ton)' },
    { kw: 8, label: '8 kW (2 ton)' },
    { kw: 10, label: '10 kW (3 ton)' },
    { kw: 13, label: '13 kW (3.5 ton)' },
    { kw: 15, label: '15 kW (4 ton)' },
  ];

  const baselineOptions = [
    { id: 'lights-fridge', kw: 1.5, label: 'Lights + Fridge' },
    { id: 'well-pump', kw: 1.0, label: 'Well/Sump Pump' },
    { id: 'gas-furnace', kw: 0.8, label: 'Gas Furnace Fan' },
    { id: 'electric-stove', kw: 5.0, label: 'Electric Stove' },
    { id: 'water-heater', kw: 4.5, label: 'Water Heater' },
    { id: 'dryer', kw: 5.0, label: 'Electric Dryer' },
    { id: 'microwave', kw: 1.5, label: 'Microwave/Dishwasher' },
    { id: 'ev-level1', kw: 1.4, label: 'EV Level-1' },
  ];

  const specs = {
    '14kW': { consumption: [0.9, 1.2, 1.7, 2.2, 2.9] },
    '20kW': { consumption: [1.1, 1.6, 2.3, 3.1, 4.1] },
  };

  const getGPH = (loadPercent, modelType) => {
    const data = specs[modelType].consumption;
    let lowerIndex, upperIndex, fraction;
    if (loadPercent === 0) return data[0];
    if (loadPercent <= 25) { lowerIndex = 0; upperIndex = 1; fraction = loadPercent / 25; }
    else if (loadPercent <= 50) { lowerIndex = 1; upperIndex = 2; fraction = (loadPercent - 25) / 25; }
    else if (loadPercent <= 75) { lowerIndex = 2; upperIndex = 3; fraction = (loadPercent - 50) / 25; }
    else { lowerIndex = 3; upperIndex = 4; fraction = (loadPercent - 75) / 25; }
    const lowerVal = data[lowerIndex];
    const upperVal = data[upperIndex];
    return (lowerVal + (upperVal - lowerVal) * fraction).toFixed(2);
  };

  const maxGenKw = model === '14kW' ? 14 : 20;
  const baselineKw = baselineSelections.reduce((sum, id) => sum + (baselineOptions.find(opt => opt.id === id)?.kw || 0), 0);
  const heatPumpLoadKw = heatPumpRunning ? heatPumpKw : 0;
  const totalKw = baselineKw + heatPumpLoadKw;
  const totalLoadPercent = Math.min(100, Math.round((totalKw / maxGenKw) * 100));
  const isOverloaded = totalKw > maxGenKw;

  const gph = parseFloat(getGPH(totalLoadPercent, model));
  const hourlyCost = gph * fuelPrice;
  const dailyCostContinuous = hourlyCost * 24;
  const dailyCostInterval = hourlyCost * 5;
  const usableTank = tankSize * 0.8;
  const daysToEmptyContinuous = gph > 0 ? usableTank / (gph * 24) : 0;
  const daysToEmptyInterval = gph > 0 ? usableTank / (gph * 5) : 0;

  const applyPreset = (name) => {
    const presets = {
      essentials: { sel: ['lights-fridge', 'well-pump'], hp: false },
      winter: { sel: ['lights-fridge', 'well-pump', 'gas-furnace'], hp: true },
      full: { sel: ['lights-fridge', 'well-pump', 'gas-furnace', 'microwave'], hp: false },
    };
    if (presets[name]) {
      setBaselineSelections(presets[name].sel);
      setHeatPumpRunning(presets[name].hp);
    } else {
      setBaselineSelections([]);
    }
  };

  return (
    <div className="w-full h-screen overflow-hidden p-3 bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="bg-blue-900 text-white p-3 rounded-lg mb-3">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Zap className="h-7 w-7 text-yellow-400" />
          Generator Fuel & Cost Estimator
        </h1>
      </div>

      {/* Main Grid: 3 columns */}
      <div className="grid grid-cols-3 gap-3" style={{height: 'calc(100vh - 120px)'}}>
        
        {/* LEFT COLUMN - Controls */}
        <div className="space-y-3 overflow-auto">
          {/* Top Controls */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-semibold mb-2">Generator</label>
              <div className="flex gap-1">
                {['14kW', '20kW'].map(m => (
                  <button key={m} onClick={() => setModel(m)}
                    className={`flex-1 py-2 px-2 rounded text-base font-medium ${model === m ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-semibold mb-2">Price</label>
              <input type="number" step="0.1" value={fuelPrice} onChange={e => setFuelPrice(parseFloat(e.target.value))}
                className="w-full p-2 text-2xl rounded border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" />
            </div>

            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-semibold mb-2">Tank</label>
              <select value={tankSize} onChange={e => setTankSize(Number(e.target.value))}
                className="w-full p-2 text-base rounded border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                <option value="250">250 gal</option>
                <option value="500">500 gal</option>
                <option value="1000">1000 gal</option>
              </select>
            </div>

            <div className="bg-green-100 dark:bg-green-950/30 p-3 rounded border-2 border-green-600 dark:border-green-700 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-300">Load</p>
              <p className="text-5xl font-bold text-green-700 dark:text-green-400">{totalKw.toFixed(1)} kW</p>
              <p className="text-base text-slate-600 dark:text-slate-400">{totalLoadPercent}% of {maxGenKw}kW</p>
            </div>
          </div>

          {isOverloaded && (
            <div className="bg-red-100 dark:bg-red-900/30 border-2 border-red-600 p-3 rounded">
              <p className="text-red-900 dark:text-red-100 font-bold text-base flex items-center gap-1">
                <AlertTriangle className="h-5 w-5" />OVERLOAD
              </p>
            </div>
          )}

          {/* Quick Presets */}
          <div className="bg-white dark:bg-slate-900 p-3 rounded border dark:border-slate-700">
            <p className="text-sm font-semibold mb-2">Quick Presets:</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'essentials', label: 'Essentials', color: 'green' },
                { name: 'winter', label: 'Winter', color: 'blue' },
                { name: 'full', label: 'Full House', color: 'purple' },
                { name: 'clear', label: 'Clear', color: 'slate' },
              ].map(({ name, label, color }) => (
                <button key={name} onClick={() => applyPreset(name)}
                  className={`px-2 py-2 bg-${color}-600 hover:bg-${color}-700 text-white rounded text-sm font-semibold`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Heat Pump */}
          <div className={`border p-3 rounded ${baselineSelections.includes('gas-furnace') && heatPumpRunning ? 'bg-red-100 dark:bg-red-950/50 border-red-400 dark:border-red-600' : 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-900'}`}>
            {baselineSelections.includes('gas-furnace') && heatPumpRunning && (
              <p className="text-sm font-bold text-red-600 dark:text-red-400 mb-2 p-1 bg-red-100 dark:bg-red-900/30 rounded">
                ⚠️ Conflict: You've selected both Gas Furnace Fan AND Heat Pump. Choose ONE heating method.
              </p>
            )}
            <p className="text-sm font-bold text-amber-700 dark:text-amber-300 mb-2 px-1 py-0.5">
              ⚠️ HEAT PUMP ONLY — Not for Gas/Oil Furnace
            </p>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input type="checkbox" checked={heatPumpRunning} onChange={e => setHeatPumpRunning(e.target.checked)} className="w-5 h-5" />
              <span className="text-base font-semibold">Add Heat Pump to Load</span>
            </label>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Use if your home has an air-source or ground-source heat pump for heating. Do not use if you have a gas/oil furnace.</p>
            {heatPumpRunning && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {heatPumpOptions.map(opt => (
                  <button key={opt.kw} onClick={() => setHeatPumpKw(opt.kw)}
                    className={`p-2 rounded border text-sm ${heatPumpKw === opt.kw ? 'bg-blue-200 dark:bg-blue-900 border-blue-600' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Baseline Checkboxes */}
          <div className="bg-white dark:bg-slate-900 p-3 rounded border dark:border-slate-700">
            <p className="text-base font-semibold mb-2">Baseline Load ({baselineKw.toFixed(1)} kW)</p>
            <div className="space-y-2">
              {baselineOptions.map(item => (
                <label key={item.id} className="flex items-center gap-2 text-base cursor-pointer">
                  <input type="checkbox" checked={baselineSelections.includes(item.id)}
                    onChange={e => {
                      if (e.target.checked) setBaselineSelections(prev => [...prev, item.id]);
                      else setBaselineSelections(prev => prev.filter(id => id !== item.id));
                    }}
                    className="w-5 h-5" />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-sm font-mono text-blue-600 dark:text-blue-300">{item.kw} kW</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN - Stats */}
        <div className="space-y-3 overflow-auto">
          <div className="grid grid-cols-2 gap-3">
            <StatBox label="Consumption" value={`${gph} gal/hr`} icon={<Droplets className="h-5 w-5 text-blue-500" />} />
            <StatBox label="Hourly Cost" value={`$${hourlyCost.toFixed(2)}`} icon={<DollarSign className="h-5 w-5 text-green-600" />} />
            <StatBox label="Days to Empty" value={`${daysToEmptyContinuous.toFixed(1)} days`} sub="24/7" icon={<AlertTriangle className="h-5 w-5 text-orange-500" />} />
            <StatBox label="24h Cost" value={`$${dailyCostContinuous.toFixed(0)}`} sub="Continuous" highlight />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="border-2 border-red-300 bg-red-50 dark:bg-red-950/30 rounded p-4">
              <div className="flex justify-between items-center mb-3">
                <div className="text-sm font-bold text-red-900 dark:text-red-100 uppercase">Continuous (24/7)</div>
                <div className="bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-100 text-sm font-bold px-3 py-1 rounded">EXPENSIVE</div>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-600 dark:text-slate-300">Cost per Day</p>
                <p className="text-6xl font-black text-red-600 dark:text-red-300">${dailyCostContinuous.toFixed(0)}</p>
                <p className="text-base text-red-500 dark:text-red-300 mt-2">{(gph * 24).toFixed(0)} gal/day</p>
              </div>
            </div>

            <div className="border-2 border-green-300 bg-green-50 dark:bg-green-950/30 rounded p-4">
              <div className="flex justify-between items-center mb-3">
                <div className="text-sm font-bold text-green-900 dark:text-green-100 uppercase">Interval (5hrs/day)</div>
                <div className="bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-100 text-sm font-bold px-3 py-1 rounded">RECOMMENDED</div>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-600 dark:text-slate-300">Cost per Day</p>
                <p className="text-6xl font-black text-green-600 dark:text-green-300">${dailyCostInterval.toFixed(0)}</p>
                <p className="text-base text-green-600 dark:text-green-200 mt-2">Save ${(dailyCostContinuous - dailyCostInterval).toFixed(0)}/day</p>
                <p className="text-base text-slate-500 dark:text-slate-300 mt-2">Tank lasts {daysToEmptyInterval.toFixed(1)} days</p>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 dark:bg-amber-900/20 border-l-4 border-orange-400 p-3 text-sm text-orange-800 dark:text-amber-100">
            <p className="font-bold text-base">Deep Freeze Risk</p>
            On very cold nights (e.g., 10°F), increase runtime to protect pipes.
          </div>
        </div>

        {/* RIGHT COLUMN - Tips */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded border dark:border-slate-700 overflow-auto">
          <h3 className="font-bold text-2xl mb-3">💡 Tips</h3>
          <div className="space-y-3 text-base">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded p-3">
              <p className="font-semibold text-blue-900 dark:text-blue-100 mb-2 text-lg">Efficiency</p>
              <p className="text-sm text-blue-800 dark:text-blue-200">Generator is most efficient at 50-100% load. Running at low loads wastes fuel.</p>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded p-3">
              <p className="font-semibold text-green-900 dark:text-green-100 mb-2 text-lg">Interval Strategy</p>
              <p className="text-sm text-green-800 dark:text-green-200">Run 2hrs morning + 2hrs evening. Turn completely OFF between runs. Saves massive fuel.</p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded p-3">
              <p className="font-semibold text-amber-900 dark:text-amber-100 mb-2 text-lg">Prioritize Loads</p>
              <p className="text-sm text-amber-800 dark:text-amber-200">Always: lights, fridge. Optional: stove, dryer (can wait). Never run all at once.</p>
            </div>

            {isOverloaded && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded p-3">
                <p className="font-semibold text-red-900 dark:text-red-100 mb-2 text-lg">⚠️ Overloaded!</p>
                <p className="text-sm text-red-800 dark:text-red-200">Turn off some appliances or upgrade generator. Running overloaded will trip breakers or damage generator.</p>
              </div>
            )}

            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded p-3">
              <p className="font-semibold text-purple-900 dark:text-purple-100 mb-2 text-lg">Tank Planning</p>
              <p className="text-sm text-purple-800 dark:text-purple-200">At {totalKw.toFixed(1)} kW load, your {tankSize} gal tank ({usableTank} usable) will last {daysToEmptyInterval.toFixed(1)} days with interval strategy.</p>
            </div>

            <div className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-3">
              <p className="font-semibold text-slate-900 dark:text-slate-100 mb-2 text-lg">Fuel Refill</p>
              <p className="text-sm text-slate-700 dark:text-slate-200">Continuous: refill in {daysToEmptyContinuous.toFixed(1)} days<br/>
              Interval: refill in {daysToEmptyInterval.toFixed(1)} days<br/>
              Cost: ${(usableTank * fuelPrice).toFixed(0)} to fill tank</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

const StatBox = ({ label, value, sub, icon, highlight }) => (
  <div className={`p-3 rounded border ${highlight ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
    <div className="flex items-center gap-1 mb-2 text-slate-500 dark:text-slate-300 text-sm font-bold uppercase">
      {icon} {label}
    </div>
    <div className={`text-3xl font-bold ${highlight ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-100'}`}>
      {value}
    </div>
    {sub && <div className="text-sm text-slate-400 dark:text-slate-300">{sub}</div>}
  </div>
);

export default GeneratorCalculator;
