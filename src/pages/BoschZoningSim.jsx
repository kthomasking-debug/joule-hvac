import React, { useState, useEffect } from 'react';
import { Wind, Thermometer, Activity, Clock, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';

const BoschZoningSim = () => {
  const [zones, setZones] = useState([
    { id: 1, name: 'Living Room', active: false },
    { id: 2, name: 'Master Bed', active: false },
    { id: 3, name: 'Guest Wing', active: false },
  ]);
  
  const [differential, setDifferential] = useState(0.5); // 0.5 or 1.5
  const [lockoutTimer, setLockoutTimer] = useState(0);
  const [systemState, setSystemState] = useState('OFF'); 
  const [displayCode, setDisplayCode] = useState('0'); 

  useEffect(() => {
    const anyZoneActive = zones.some(z => z.active);
    if (!anyZoneActive) {
      setSystemState('OFF');
      setDisplayCode('0');
    } else {
      if (lockoutTimer > 0) {
        setSystemState('STANDBY');
        setDisplayCode('0');
      } else {
        setSystemState('HEATING');
        setDisplayCode('3');
      }
    }
  }, [zones, lockoutTimer]);

  useEffect(() => {
    let interval;
    if (lockoutTimer > 0) {
      interval = setInterval(() => setLockoutTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  const toggleZone = (id) => {
    setZones(zones.map(z => z.id === id ? { ...z, active: !z.active } : z));
  };

  const simulateSatisfaction = () => {
    setZones(zones.map(z => ({ ...z, active: false })));
    // Narrow differential causes a much higher chance of immediate restart
    setLockoutTimer(30); 
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-xl shadow-2xl font-sans border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-8 bg-blue-900 dark:bg-blue-950 p-6 rounded-lg text-white">
        <div>
          <h1 className="text-2xl font-bold">Bosch IDS + Ecobee Threshold Simulator</h1>
          <p className="text-blue-200 text-sm italic underline">Preventing "Fan-Only" Standby Cycles</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-blue-300 uppercase tracking-widest font-bold">Inverter Status</div>
          <div className="text-4xl font-mono bg-black px-4 py-1 rounded border-2 border-blue-500 text-blue-400">
            {displayCode}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg border border-slate-300 dark:border-slate-600">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase mb-3 flex items-center gap-2">
              <ChevronRight size={16}/> Essential Ecobee Thresholds
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold block mb-1 text-slate-700 dark:text-slate-300">Cooling/Heating Differential</label>
                <div className="flex gap-2">
                  {[0.5, 1.0, 1.5].map(val => (
                    <button 
                      key={val}
                      onClick={() => setDifferential(val)}
                      className={`flex-1 py-2 text-sm rounded font-bold transition-all ${differential === val ? 'bg-blue-600 text-white shadow-inner' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600'}`}
                    >
                      {val}°F
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 italic">
                  {differential === 0.5 ? "🔴 Default. Causes high frequency cycling." : "🟢 Recommended. Forces long, modulated runs."}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {zones.map(zone => (
              <button
                key={zone.id}
                onClick={() => toggleZone(zone.id)}
                className={`w-full p-4 rounded-lg flex justify-between items-center transition-all border-b-4 ${
                  zone.active ? 'bg-orange-500 border-orange-700 text-white' : 'bg-slate-200 dark:bg-slate-700 border-slate-400 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                }`}
              >
                <span className="font-bold">{zone.name}</span>
                <span className="text-xs font-mono">{zone.active ? 'CALLING' : 'IDLE'}</span>
              </button>
            ))}
          </div>

          <button onClick={simulateSatisfaction} className="w-full py-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded border border-red-200 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/50 font-bold transition-colors">
            End All Calls (Triggers Safety Timer)
          </button>
        </div>

        <div className="space-y-6">
          <div className="p-6 bg-slate-900 dark:bg-slate-950 rounded-xl text-white">
            <h3 className="text-xs font-bold text-blue-400 uppercase mb-4">Real-Time Mechanical Output</h3>
            
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Wind className={`${systemState !== 'OFF' ? 'text-blue-400 animate-spin' : 'text-slate-600'}`} size={32} />
                <div>
                  <div className="text-xs text-slate-400 uppercase">Indoor Blower (Fan)</div>
                  <div className="text-xl font-bold">{systemState !== 'OFF' ? 'RUNNING' : 'STOPPED'}</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Activity className={`${systemState === 'HEATING' ? 'text-orange-500 animate-pulse' : 'text-slate-600'}`} size={32} />
                <div>
                  <div className="text-xs text-slate-400 uppercase">Outdoor Compressor</div>
                  <div className={`text-xl font-bold ${systemState === 'STANDBY' ? 'text-orange-400' : ''}`}>
                    {systemState === 'HEATING' ? 'MODULATING' : systemState === 'STANDBY' ? 'STANDBY / LOCKED' : 'OFF'}
                  </div>
                </div>
              </div>
            </div>

            {lockoutTimer > 0 && (
              <div className="mt-6 flex items-center justify-center gap-2 bg-orange-500/20 p-3 rounded border border-orange-500/50 text-orange-400 animate-pulse">
                <Clock size={18} /> <span className="font-mono font-bold text-lg">Safety Timer: {lockoutTimer}s</span>
              </div>
            )}
          </div>

          <div className={`p-4 rounded-lg border-2 ${systemState === 'STANDBY' ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-400 dark:border-amber-600' : 'bg-green-50 dark:bg-green-900/30 border-green-400 dark:border-green-600'}`}>
            <div className="flex gap-3 text-slate-800 dark:text-slate-200 font-medium leading-tight">
              {systemState === 'STANDBY' ? (
                <>
                  <AlertTriangle className="text-amber-600 dark:text-amber-500 shrink-0" />
                  <p className="text-sm">
                    <strong>The Conflict:</strong> You have a call for heat, but the <strong>Minimum Compressor Off-Time</strong> is still active. 
                    The fan is blowing room-temp air because the Smart Thermostat and the Inverter aren't synced.
                  </p>
                </>
              ) : systemState === 'HEATING' ? (
                <>
                  <CheckCircle2 className="text-green-600 dark:text-green-500 shrink-0" />
                  <p className="text-sm">
                    <strong>The Fix:</strong> Larger differentials (1.0°F+) force the system to stay off longer, clearing the safety timer before the next call occurs.
                  </p>
                </>
              ) : (
                <p className="text-sm italic text-slate-500 dark:text-slate-400">Enable a zone to see system logic.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoschZoningSim;
