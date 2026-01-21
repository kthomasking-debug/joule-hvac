import React, { useState, useEffect } from 'react';
import { 
  Zap, Clock, Flame, BarChart3, Thermometer, 
  Power, Activity, ChevronUp, ChevronDown,
  Droplets, X, Settings, ArrowRight, CheckCircle2,
  Wand2, DollarSign, Wind, Snowflake // Added Wind/Snowflake for Heat Pump
} from 'lucide-react';

const GeneratorDashboard = () => {
  // --- STATE ---
  const [onboarding, setOnboarding] = useState(true); 
  const [step, setStep] = useState(1);
  
  // Configuration State
  const [model, setModel] = useState('20kW');
  const [heatingType, setHeatingType] = useState('gas'); // 'gas' or 'heatpump'
  const [fuelPrice, setFuelPrice] = useState(3.0);
  const [tankSize, setTankSize] = useState(500);
  const [runtimeHours, setRuntimeHours] = useState(5);
  
  const [showMath, setShowMath] = useState(false);
  const [selectedLoads, setSelectedLoads] = useState(['fridge', 'well', 'lights']);

  // --- CONFIG DATA ---
  const specs = {
    '14kW': { max: 14, consumption: [0.9, 1.2, 1.7, 2.2, 2.9] }, 
    '20kW': { max: 20, consumption: [1.1, 1.6, 2.3, 3.1, 4.1] },
  };

  const loads = [
    { id: 'lights', label: 'LED Lights Zone A', kw: 0.3, icon: <Zap size={18} /> },
    { id: 'lights2', label: 'LED Lights Zone B', kw: 0.3, icon: <Zap size={18} /> },
    { id: 'fridge', label: 'Fridge/Freezer', kw: 1.2, icon: <Thermometer size={18} /> },
    { id: 'well', label: 'Well Pump', kw: 1.5, icon: <Droplets size={18} /> },
    { id: 'furnace', label: 'Gas Furnace Fan', kw: 0.6, icon: <Flame size={18} /> },
    { id: 'heatpump', label: 'Heat Pump (Heating)', kw: 4.0, icon: <Wind size={18} /> }, // New Item
    { id: 'microwave', label: 'Microwave', kw: 1.5, icon: <Zap size={18} /> },
    { id: 'water', label: 'Elec. Water Heater', kw: 4.5, icon: <Droplets size={18} /> },
    { id: 'stove', label: 'Electric Stove', kw: 3.0, icon: <Activity size={18} /> },
    { id: 'ac', label: 'Central A/C', kw: 3.5, icon: <Snowflake size={18} /> },
    { id: 'dryer', label: 'Electric Dryer', kw: 5.0, icon: <Zap size={18} /> },
    { id: 'sump', label: 'Sump Pump', kw: 1.0, icon: <Droplets size={18} /> },
  ];

  // --- CALCULATIONS ---
  const maxKw = specs[model].max;
  const baseKw = selectedLoads.reduce((acc, id) => {
    const item = loads.find(l => l.id === id);
    return acc + (item ? item.kw : 0);
  }, 0);

  const totalKw = baseKw;
  const loadPercent = (totalKw / maxKw) * 100;
  const isOverloaded = totalKw > maxKw;

  // Efficiency Curve Logic
  const getGPH = (pct) => {
    const data = specs[model].consumption;
    const p = Math.min(Math.max(pct, 0), 100);
    let idx = Math.floor(p / 25);
    let ratio = (p % 25) / 25;
    if (idx >= 4) { idx = 3; ratio = 1; }
    return data[idx] + (data[idx + 1] - data[idx]) * ratio;
  };

  const currentGPH = getGPH(loadPercent);
  const currentEfficiency = totalKw > 0 ? (totalKw / currentGPH) : 0;
  const dailyCost = currentGPH * fuelPrice * runtimeHours;
  const usableTank = tankSize * 0.8;
  const daysUntilEmpty = usableTank / (currentGPH * runtimeHours || 0.001);

  // --- LOGIC: Apply Onboarding Choices ---
  useEffect(() => {
    if (!onboarding) return; // Only run during onboarding changes

    // Auto-update selected loads based on Heating Type choice
    setSelectedLoads(prev => {
      const basic = prev.filter(id => id !== 'furnace' && id !== 'heatpump');
      if (heatingType === 'heatpump') return [...basic, 'heatpump'];
      return [...basic, 'furnace'];
    });
  }, [heatingType, onboarding]);

  const setPreset = (type) => {
    const heat = heatingType === 'heatpump' ? 'heatpump' : 'furnace';
    if (type === 'survival') setSelectedLoads(['fridge', 'well', 'lights', heat]);
    if (type === 'comfort') setSelectedLoads(['fridge', 'well', 'lights', 'lights2', 'microwave', heat]);
    if (type === 'reset') setSelectedLoads([]);
  };

  // --- ONBOARDING RENDERER ---
  if (onboarding) {
    const totalSteps = 5; // Model, Heating, Fuel, Runtime, Confirm

    return (
      <div className="h-screen w-screen bg-[#0f172a] text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Accents */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
           <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500 rounded-full blur-[128px]"></div>
           <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500 rounded-full blur-[128px]"></div>
        </div>

        <div className="max-w-2xl w-full z-10">
          {/* Progress Bar */}
          <div className="flex justify-between items-center mb-8 px-2">
             {Array.from({length: totalSteps}).map((_, i) => (
               <div key={i} className={`h-2 flex-1 rounded-full mx-1 transition-all duration-500 ${i + 1 <= step ? 'bg-cyan-400' : 'bg-slate-800'}`}></div>
             ))}
          </div>

          <div className="bg-slate-900/50 border border-slate-700/50 p-8 md:p-12 rounded-3xl shadow-2xl backdrop-blur-xl min-h-[500px] flex flex-col justify-between">
            
            {/* STEP 1: MODEL */}
            {step === 1 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center">
                  <h2 className="text-4xl font-black text-white mb-2">Select Generator</h2>
                  <p className="text-slate-400">Which Kohler model are you analyzing?</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {['14kW', '20kW'].map((m) => (
                    <button 
                      key={m}
                      onClick={() => setModel(m)}
                      className={`p-8 rounded-2xl border-2 transition-all ${model === m ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.2)]' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                    >
                      <div className="text-3xl font-black text-white mb-1">{m}</div>
                      <div className="text-xs uppercase font-bold text-slate-500">Air Cooled / Propane</div>
                      {model === m && <div className="mt-4 flex justify-center"><CheckCircle2 className="text-cyan-400" size={32}/></div>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 2: HEATING SYSTEM (NEW) */}
            {step === 2 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center">
                  <h2 className="text-4xl font-black text-white mb-2">Primary Heating</h2>
                  <p className="text-slate-400">Heating is a major factor in fuel consumption.</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Option A: Gas Furnace */}
                  <button 
                    onClick={() => setHeatingType('gas')}
                    className={`p-6 rounded-2xl border-2 text-left transition-all ${heatingType === 'gas' ? 'bg-amber-600/20 border-amber-500' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}
                  >
                    <div className="bg-amber-500/20 w-12 h-12 rounded-full flex items-center justify-center mb-4 text-amber-500">
                      <Flame size={24} />
                    </div>
                    <div className="font-bold text-xl text-white mb-1">Gas / Propane</div>
                    <div className="text-xs text-slate-400">Uses mostly fuel. Low electrical load (fan only).</div>
                    <div className="mt-3 font-mono text-xs font-bold text-amber-500">~0.6 kW Load</div>
                  </button>

                  {/* Option B: Heat Pump */}
                  <button 
                    onClick={() => setHeatingType('heatpump')}
                    className={`p-6 rounded-2xl border-2 text-left transition-all ${heatingType === 'heatpump' ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}
                  >
                    <div className="bg-blue-500/20 w-12 h-12 rounded-full flex items-center justify-center mb-4 text-blue-400">
                      <Wind size={24} />
                    </div>
                    <div className="font-bold text-xl text-white mb-1">Elec. Heat Pump</div>
                    <div className="text-xs text-slate-400">Uses electricity to move heat. High load.</div>
                    <div className="mt-3 font-mono text-xs font-bold text-blue-400">~4.0 kW Load</div>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: FUEL & TANK */}
            {step === 3 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center">
                  <h2 className="text-4xl font-black text-white mb-2">Fuel Config</h2>
                  <p className="text-slate-400">Set propane costs and tank capacity.</p>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-400 uppercase mb-2">Price per Gallon</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"/>
                      <input 
                        type="number" 
                        value={fuelPrice} 
                        onChange={(e) => setFuelPrice(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-600 rounded-xl py-4 pl-12 pr-4 text-3xl font-bold text-white focus:outline-none focus:border-cyan-400 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-400 uppercase mb-2">Tank Size</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[250, 500, 1000].map(size => (
                        <button
                          key={size}
                          onClick={() => setTankSize(size)}
                          className={`py-4 rounded-xl font-bold text-lg border-2 transition-all ${tankSize === size ? 'bg-indigo-500/20 border-indigo-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                        >
                          {size} gal
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: RUNTIME */}
            {step === 4 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <div className="text-center">
                  <h2 className="text-4xl font-black text-white mb-2">Runtime Strategy</h2>
                  <p className="text-slate-400">In an outage, how many hours per day will it run?</p>
                </div>

                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                  <div className="flex justify-between items-end mb-6">
                    <span className="text-indigo-300 font-bold uppercase tracking-wider">Hours / Day</span>
                    <span className="text-5xl font-black text-white">{runtimeHours}</span>
                  </div>
                  <input 
                    type="range" min="1" max="24" step="1"
                    value={runtimeHours}
                    onChange={(e) => setRuntimeHours(Number(e.target.value))}
                    className="w-full h-4 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-400 mb-4"
                  />
                  <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                    <span>Conservative (1h)</span>
                    <span>Continuous (24h)</span>
                  </div>
                </div>

                {/* Preview Calculation based on current state (including heating choice) */}
                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 text-center">
                      <div className="text-xs text-slate-500 uppercase font-bold">Est. Daily Cost</div>
                      <div className="text-2xl font-black text-emerald-400">
                        ${dailyCost.toFixed(0)}
                      </div>
                   </div>
                   <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 text-center">
                      <div className="text-xs text-slate-500 uppercase font-bold">Est. Duration</div>
                      <div className={`text-2xl font-black ${daysUntilEmpty < 3 ? 'text-red-400' : 'text-white'}`}>
                        {daysUntilEmpty.toFixed(0)} Days
                      </div>
                   </div>
                </div>
                {heatingType === 'heatpump' && (
                  <div className="bg-blue-500/10 text-blue-300 text-xs text-center p-2 rounded border border-blue-500/20">
                     <Wind size={12} className="inline mr-1"/> Heat Pump selected. High power draw expected.
                  </div>
                )}
              </div>
            )}

            {/* STEP 5: CONFIRMATION */}
            {step === 5 && (
              <div className="text-center space-y-8 animate-in fade-in zoom-in duration-500">
                <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 size={48} className="text-green-400" />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-white mb-4">Setup Complete</h2>
                  <p className="text-slate-400 max-w-md mx-auto">
                    Your {model} dashboard is configured with <strong>{heatingType === 'gas' ? 'Gas Heating' : 'Electric Heat Pump'}</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* NAVIGATION BUTTONS */}
            <div className="flex gap-4 mt-8 pt-8 border-t border-slate-700/50">
              {step > 1 && (
                <button 
                  onClick={() => setStep(s => s - 1)}
                  className="px-6 py-4 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Back
                </button>
              )}
              
              <button 
                onClick={() => {
                  if (step < 5) setStep(s => s + 1);
                  else setOnboarding(false);
                }}
                className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-slate-900 text-lg font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-cyan-500/25"
              >
                {step === 5 ? 'Launch Dashboard' : 'Next Step'} <ArrowRight size={20}/>
              </button>
            </div>

          </div>
        </div>
      </div>
    )
  }

  // --- MAIN DASHBOARD ---
  return (
    <div className="h-screen w-screen bg-[#0f172a] text-slate-100 font-sans overflow-hidden flex flex-col selection:bg-cyan-500/30">
      
      {/* HEADER */}
      <header className="h-20 px-6 border-b border-slate-700/50 flex items-center justify-between shrink-0 bg-[#0f172a] z-20 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="bg-cyan-500/10 p-2 rounded-xl border border-cyan-500/20">
            <Activity size={28} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight leading-none">
              GENERATOR<span className="text-slate-500">COMMAND</span>
            </h1>
            <p className="text-xs text-slate-400 font-bold tracking-widest mt-1">FUEL MODELING SYSTEM</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
           {/* Recalibrate */}
           <button 
             onClick={() => { setStep(1); setOnboarding(true); }}
             className="p-3 rounded-xl bg-slate-800 text-slate-400 hover:text-cyan-400 border border-slate-600 hover:border-cyan-400 transition-all"
             title="Run Setup Wizard"
           >
             <Wand2 size={20} />
           </button>

           <div className="h-8 w-px bg-slate-700 mx-2"></div>

           <ControlBox label="MODEL">
              <select value={model} onChange={(e) => setModel(e.target.value)} className="bg-transparent text-lg font-bold outline-none text-white cursor-pointer">
                <option value="14kW">14kW</option>
                <option value="20kW">20kW</option>
              </select>
           </ControlBox>
           <ControlBox label="FUEL PRICE">
              <span className="text-slate-400 text-lg font-bold mr-1">$</span>
              <input type="number" value={fuelPrice} onChange={(e) => setFuelPrice(Number(e.target.value))} className="bg-transparent text-lg font-bold outline-none w-16 text-white" />
           </ControlBox>
           <ControlBox label="TANK SIZE">
              <select value={tankSize} onChange={(e) => setTankSize(Number(e.target.value))} className="bg-transparent text-lg font-bold outline-none text-white cursor-pointer">
                <option value="250">250 gal</option>
                <option value="500">500 gal</option>
                <option value="1000">1000 gal</option>
              </select>
           </ControlBox>
        </div>
      </header>

      {/* BODY */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* LEFT PANEL */}
        <div className="flex-1 flex flex-col p-6 gap-6 overflow-hidden relative z-10">
          
          {/* Row 1: Metrics */}
          <div className="grid grid-cols-3 gap-6 shrink-0 h-32">
            <MetricBox 
              label="CURRENT LOAD" 
              value={totalKw.toFixed(1)} 
              unit="kW" 
              sub={`${loadPercent.toFixed(0)}% CAPACITY`} 
              color={isOverloaded ? "text-red-500" : "text-white"} 
            />
            <MetricBox 
              label="BURN RATE" 
              value={currentGPH.toFixed(2)} 
              unit="GPH" 
              sub="GALLONS / HOUR" 
              color="text-amber-400" 
            />
            <MetricBox 
              label="EFFICIENCY" 
              value={currentEfficiency.toFixed(2)} 
              unit="kWh/G" 
              sub="KILOWATTS PER GALLON" 
              color="text-cyan-400" 
            />
          </div>

          {/* Row 2: Chart */}
          <div className="flex-1 bg-slate-800/40 rounded-3xl border border-slate-700/50 p-6 relative min-h-0 flex flex-col shadow-inner">
             <div className="flex justify-between items-start mb-4 shrink-0">
               <h2 className="text-lg font-bold flex items-center gap-2 text-slate-200">
                 <BarChart3 size={20} className="text-cyan-500"/> EFFICIENCY CURVE
               </h2>
               <div className="text-xs font-bold bg-slate-900/80 px-3 py-1.5 rounded-full text-cyan-400 border border-slate-700">
                 PEAK PERFORMANCE @ ~50% LOAD
               </div>
             </div>
             <div className="flex-1 w-full relative min-h-0">
               <EfficiencyCurve 
                 model={model} 
                 specs={specs} 
                 currentLoad={loadPercent} 
                 currentEff={currentEfficiency}
                 isOverloaded={isOverloaded}
               />
             </div>
          </div>

          {/* Row 3: Controls */}
          <div className="h-auto shrink-0 grid grid-cols-12 gap-6">
             {/* Runtime Slider */}
             <div className="col-span-6 bg-indigo-900/20 rounded-3xl p-6 border border-indigo-500/20 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Clock size={100} /></div>
                <div className="flex justify-between items-end mb-3 relative z-10">
                  <span className="text-sm font-bold text-indigo-300 uppercase tracking-wider">Runtime Strategy</span>
                  <span className="text-4xl font-black text-white leading-none">{runtimeHours} <span className="text-lg text-indigo-300 font-bold">hrs/day</span></span>
                </div>
                <input 
                  type="range" min="1" max="24" step="1"
                  value={runtimeHours}
                  onChange={(e) => setRuntimeHours(Number(e.target.value))}
                  className="w-full h-4 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-400 relative z-10"
                />
                <div className="flex justify-between mt-2 text-xs text-indigo-300 font-bold uppercase tracking-widest relative z-10">
                  <span>Emergency (1h)</span>
                  <span>Continuous (24h)</span>
                </div>
             </div>

             {/* Cost */}
             <div className="col-span-3 bg-slate-800 rounded-3xl p-5 border border-slate-700 flex flex-col justify-center shadow-lg">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Daily Cost</div>
                <div className="text-5xl font-black text-emerald-400 tracking-tight">${dailyCost.toFixed(0)}</div>
             </div>

             {/* Tank */}
             <div className={`col-span-3 rounded-3xl p-5 border flex flex-col justify-center shadow-lg transition-colors ${daysUntilEmpty < 3 ? 'bg-red-950/80 border-red-500' : 'bg-slate-800 border-slate-700'}`}>
                <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${daysUntilEmpty < 3 ? 'text-red-300' : 'text-slate-400'}`}>Tank Life</div>
                <div className={`text-5xl font-black tracking-tight ${daysUntilEmpty < 3 ? 'text-red-400' : 'text-white'}`}>
                  {daysUntilEmpty.toFixed(0)} <span className="text-lg font-bold text-slate-500">Days</span>
                </div>
             </div>
          </div>
        </div>

        {/* RIGHT PANEL: Load Center */}
        <div className="w-96 border-l border-slate-800 bg-slate-900/80 flex flex-col shrink-0 z-10 shadow-2xl">
          <div className="p-6 border-b border-slate-800 bg-slate-900">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-lg text-slate-200 flex items-center gap-2">
                <Power size={20} className="text-green-400"/> LOAD CENTER
              </h3>
            </div>
            {/* Presets */}
            <div className="flex gap-3 h-10">
              <button onClick={() => setPreset('survival')} className="flex-1 bg-amber-600/20 text-amber-500 border border-amber-600/50 hover:bg-amber-600 hover:text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all">
                Survival
              </button>
              <button onClick={() => setPreset('comfort')} className="flex-1 bg-blue-600/20 text-blue-500 border border-blue-600/50 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all">
                Comfort
              </button>
              <button onClick={() => setPreset('reset')} className="px-3 bg-slate-800 text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-700 hover:text-white transition-all">
                <X size={16}/>
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
             {loads.map(item => {
                const active = selectedLoads.includes(item.id);
                // Highlight the user's primary heating choice specially
                const isPrimaryHeating = (item.id === 'heatpump' && heatingType === 'heatpump') || (item.id === 'furnace' && heatingType === 'gas');
                
                return (
                  <button 
                    key={item.id}
                    onClick={() => setSelectedLoads(prev => prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id])}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all group ${
                      active 
                      ? 'bg-slate-800 border-green-500/50 shadow-lg translate-x-1' 
                      : 'bg-transparent border-slate-800 opacity-50 hover:opacity-100 hover:bg-slate-800/50 hover:border-slate-700'
                    } ${isPrimaryHeating && active ? 'border-cyan-400/80' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${active ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
                        {item.icon}
                      </div>
                      <div className="text-left">
                        <div className={`text-sm font-bold ${active ? 'text-white' : 'text-slate-400'}`}>{item.label}</div>
                      </div>
                    </div>
                    <div className={`text-base font-mono font-bold ${active ? 'text-green-400' : 'text-slate-600'}`}>
                      {item.kw} <span className="text-xs">kW</span>
                    </div>
                  </button>
                )
             })}
          </div>
          <div className="p-4 border-t border-slate-800 bg-slate-900 text-center">
            <div className="text-slate-500 font-bold text-xs uppercase tracking-widest">Total Consumption</div>
            <div className={`text-4xl font-black ${isOverloaded ? 'text-red-500 animate-pulse' : 'text-white'}`}>
              {totalKw.toFixed(1)} <span className="text-xl text-slate-600">kW</span>
            </div>
          </div>
        </div>

        {/* --- LOGIC DRAWER --- */}
        <div 
          className={`absolute bottom-0 left-0 right-96 bg-[#0b1221] border-t-2 border-cyan-500/30 transition-transform duration-300 ease-in-out z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] ${showMath ? 'translate-y-0' : 'translate-y-[100%]'}`}
          style={{ height: '340px' }}
        >
           <button 
             onClick={() => setShowMath(!showMath)}
             className="absolute -top-10 right-6 bg-slate-800 border-t border-x border-slate-600 text-white text-sm font-bold px-6 py-2 rounded-t-xl flex items-center gap-2 hover:bg-slate-700 transition-colors shadow-lg"
           >
             {showMath ? <ChevronDown size={18}/> : <ChevronUp size={18}/>} 
             {showMath ? 'HIDE MATH' : 'SHOW MATH'}
           </button>

           <div className="p-8 grid grid-cols-3 gap-10 h-full">
              <MathColumn title="Fuel Efficiency" result={`${currentEfficiency.toFixed(2)} kWh/gal`}>
                <div className="flex justify-between text-base"><span>Total Load:</span> <span className="text-white font-bold">{totalKw.toFixed(2)} kW</span></div>
                <div className="flex justify-between text-base"><span>Burn Rate:</span> <span className="text-amber-400 font-bold">÷ {currentGPH.toFixed(2)} gph</span></div>
                <p className="text-xs text-slate-500 mt-2 italic">Efficiency = Power Output divided by Fuel Input.</p>
              </MathColumn>
              <MathColumn title="Daily Cost" result={`$${dailyCost.toFixed(2)}`}>
                 <div className="flex justify-between text-base"><span>Burn Rate:</span> <span className="font-bold">{currentGPH.toFixed(2)} gph</span></div>
                 <div className="flex justify-between text-base"><span>Runtime:</span> <span className="font-bold">x {runtimeHours} hrs</span></div>
                 <div className="flex justify-between text-base"><span>Price:</span> <span className="font-bold">x ${fuelPrice.toFixed(2)}</span></div>
              </MathColumn>
              <MathColumn title="Tank Duration" result={`${daysUntilEmpty.toFixed(1)} Days`}>
                 <div className="flex justify-between text-base"><span>Capacity:</span> <span className="font-bold">{tankSize} gal</span></div>
                 <div className="flex justify-between text-base"><span>Usable:</span> <span className="font-bold">x 0.80</span></div>
                 <div className="flex justify-between text-base"><span>Daily Burn:</span> <span className="text-red-400 font-bold">÷ {(currentGPH * runtimeHours).toFixed(1)} gal</span></div>
              </MathColumn>
           </div>
        </div>

      </div>
    </div>
  );
};

// --- SUB COMPONENTS ---

const ControlBox = ({ label, children }) => (
  <div className="flex flex-col bg-slate-800 px-4 py-2 rounded-xl border border-slate-600 shadow-sm">
    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-0.5">{label}</label>
    <div className="flex items-center">
      {children}
    </div>
  </div>
);

const MetricBox = ({ label, value, unit, sub, color }) => (
  <div className="bg-slate-800 rounded-3xl p-5 border border-slate-700 flex flex-col justify-between shadow-lg relative overflow-hidden group hover:border-slate-600 transition-colors">
    <div className="text-xs font-black text-slate-500 uppercase tracking-widest z-10">{label}</div>
    <div className="z-10">
      <div className={`text-5xl xl:text-6xl font-black ${color} tracking-tighter`}>{value}</div>
      <div className="flex items-baseline gap-2 mt-1">
         <span className="text-lg font-bold text-slate-400">{unit}</span>
         <span className="text-xs font-mono text-slate-600 uppercase border-l border-slate-600 pl-2">{sub}</span>
      </div>
    </div>
    <div className="absolute right-[-20px] bottom-[-20px] opacity-5 scale-150 rotate-12 text-white pointer-events-none">
       <Settings size={100} />
    </div>
  </div>
);

const MathColumn = ({ title, children, result }) => (
  <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 h-full flex flex-col justify-between">
    <div>
      <h4 className="text-cyan-400 font-black uppercase text-sm mb-4 border-b border-slate-700 pb-3 tracking-wider">{title}</h4>
      <div className="space-y-3 font-mono text-slate-400">
        {children}
      </div>
    </div>
    <div className="text-right">
       <div className="text-xs text-slate-500 uppercase font-bold mb-1">Calculated Result</div>
       <div className="font-black text-3xl text-white">{result}</div>
    </div>
  </div>
);

const EfficiencyCurve = ({ model, specs, currentLoad, currentEff, isOverloaded }) => {
  const spec = specs[model];
  
  const points = Array.from({ length: 101 }, (_, i) => {
    const loadPct = i; 
    const kw = (loadPct / 100) * spec.max;
    
    // Smooth GPH curve
    const data = spec.consumption;
    let idx = Math.floor(loadPct / 25);
    let ratio = (loadPct % 25) / 25;
    
    if (idx >= 4) {
      idx = 3;
      ratio = 1;
    }
    const gph = data[idx] + (data[idx + 1] - data[idx]) * ratio;

    if (loadPct === 0) return { x: 0, y: 0 };
    let eff = kw / gph;
    
    if (loadPct > 50) {
      const dropOff = (loadPct - 50) * 0.005;
      eff = eff - dropOff;
    }
    return { x: loadPct, y: eff };
  });

  const maxY = 7; 
  const svgPoints = points.map(p => `${p.x},${100 - ((p.y / maxY) * 100)}`).join(' ');
  const areaPath = `M 0,100 ${svgPoints} L 100,100 Z`;
  const dotY = 100 - ((currentEff / maxY) * 100);

  return (
    <div className="w-full h-full relative group">
      <div className="absolute top-4 left-[50%] transform -translate-x-1/2 text-xs font-bold text-slate-500 bg-slate-900/90 px-3 py-1 rounded border border-slate-700 shadow-xl pointer-events-none whitespace-nowrap z-20">
        PEAK EFFICIENCY ZONE
      </div>
      
      <div className="absolute top-0 bottom-0 left-[50%] border-l-2 border-dashed border-slate-700/50 pointer-events-none z-0"></div>

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible z-10 relative">
        <line x1="0" y1="25" x2="100" y2="25" stroke="#334155" strokeWidth="0.2" strokeDasharray="2" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="#334155" strokeWidth="0.2" strokeDasharray="2" />
        <line x1="0" y1="75" x2="100" y2="75" stroke="#334155" strokeWidth="0.2" strokeDasharray="2" />
        
        <path d={areaPath} className="fill-cyan-500/10" />
        <polyline points={svgPoints} fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        
        <circle cx={currentLoad} cy={dotY} r="2" className="fill-white stroke-cyan-400 stroke-[0.5px] shadow-lg" />
        
        {isOverloaded && <rect x="100" y="0" width="5" height="100" className="fill-red-500/20" />}
      </svg>
      
      <div className="absolute bottom-[-20px] left-0 right-0 flex justify-between text-xs font-bold text-slate-500 font-mono">
        <span>0%</span>
        <span>25%</span>
        <span className="text-cyan-500">50%</span>
        <span>75%</span>
        <span>100% LOAD</span>
      </div>
    </div>
  );
};

export default GeneratorDashboard;