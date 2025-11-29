import React, { useEffect, useRef, useState } from 'react';

export default function ShortCycleTest({ protectMsOverride = null }) {
  const [isRunning, setIsRunning] = useState(false);
  const [coolRelayOn, setCoolRelayOn] = useState(false);
  const coolRelayOnRef = useRef(false);
  const [heatRelayOn, setHeatRelayOn] = useState(false);
  const heatRelayOnRef = useRef(false);
  const [fanRelayOn, setFanRelayOn] = useState(false);
  const fanRelayOnRef = useRef(false);
  const [attempts, setAttempts] = useState(0);
  const [blockedAttempts, setBlockedAttempts] = useState(0);
  const [protectionUntil, setProtectionUntil] = useState(null);
  const protectionUntilRef = useRef(null);
  const intervalRef = useRef(null);
  const [events, setEvents] = useState([]);
  // unique IDs used in logs are generated via crypto.randomUUID() or a fallback
  const PROTECT_MS = typeof protectMsOverride === 'number' ? protectMsOverride : 5 * 60 * 1000;
  const humanProtect = PROTECT_MS >= 60000 ? `${Math.round(PROTECT_MS/60000)} minute(s)` : `${Math.round(PROTECT_MS/1000)} second(s)`;
  // Hardware gating: UI-controlled safety for toggle-on-hardware behavior
  const [hardwareEnabled, setHardwareEnabled] = useState(false);
  const [hwConfirmText, setHwConfirmText] = useState('');
  const [relayServerUrl, setRelayServerUrl] = useState(() => window.__RELAY_SERVER_URL__ || 'http://localhost:3005');
  const [relaySecret, setRelaySecret] = useState(() => window.__RELAY_SECRET__ || '');
  // Refs to keep latest values accessible to interval callbacks
  const hardwareEnabledRef = useRef(hardwareEnabled);
  const hwConfirmTextRef = useRef(hwConfirmText);
  const relayServerUrlRef = useRef(relayServerUrl);
  const relaySecretRef = useRef(relaySecret);

  // Temperature sensor state
  const [currentTemp, setCurrentTemp] = useState(null);
  const [tempUnit, setTempUnit] = useState('F');
  const [tempError, setTempError] = useState(null);
  const tempPollIntervalRef = useRef(null);

  // Auto thermostat mode
  const [autoMode, setAutoMode] = useState(false);
  const [autoModeType, setAutoModeType] = useState('heat'); // 'heat' or 'cool'
  const [targetTemp, setTargetTemp] = useState(70);
  const [hysteresis, setHysteresis] = useState(2);
  const autoModeRef = useRef(autoMode);
  const autoModeTypeRef = useRef(autoModeType);
  const targetTempRef = useRef(targetTemp);
  const hysteresisRef = useRef(hysteresis);

  useEffect(() => {
    if (isRunning) {
      // Immediately attempt a toggle
      attemptToggle();
      // Then every 1 second attempt
      intervalRef.current = setInterval(attemptToggle, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  function logEvent(msg) {
    try {
      const uid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
      setEvents((prev) => [{ id: uid, ts: Date.now(), msg }, ...prev].slice(0, 20));
    } catch { /* ignore */ }
  }

  function setRelayOn(next) {
    coolRelayOnRef.current = next;
    setCoolRelayOn(next);
    syncContactorState();
  }

  function setHeatRelay(next) {
    heatRelayOnRef.current = next;
    setHeatRelayOn(next);
    syncContactorState();
  }

  function setFanRelay(next) {
    fanRelayOnRef.current = next;
    setFanRelayOn(next);
    syncContactorState();
  }

  function syncContactorState() {
    // Sync contactor state to localStorage for ContactorDemo visualization
    try {
      const now = Date.now();
      const until = protectionUntilRef.current;
      const isLocked = until && now < until;
      const contactorState = { 
        Y: coolRelayOnRef.current, 
        W: heatRelayOnRef.current, 
        G: fanRelayOnRef.current,
        lockoutUntil: until || null,
        isLocked 
      };
      localStorage.setItem('shortCycleContactorState', JSON.stringify(contactorState));
    } catch {
      // ignore
    }
  }

  // Keep refs in sync with state
  useEffect(() => { hardwareEnabledRef.current = hardwareEnabled; }, [hardwareEnabled]);
  useEffect(() => { hwConfirmTextRef.current = hwConfirmText; }, [hwConfirmText]);
  useEffect(() => { relayServerUrlRef.current = relayServerUrl; }, [relayServerUrl]);
  useEffect(() => { relaySecretRef.current = relaySecret; }, [relaySecret]);
  useEffect(() => { protectionUntilRef.current = protectionUntil; }, [protectionUntil]);
  useEffect(() => { autoModeRef.current = autoMode; }, [autoMode]);
  useEffect(() => { autoModeTypeRef.current = autoModeType; }, [autoModeType]);
  useEffect(() => { targetTempRef.current = targetTemp; }, [targetTemp]);
  useEffect(() => { hysteresisRef.current = hysteresis; }, [hysteresis]);

  // Poll temperature sensor every 3 seconds
  useEffect(() => {
    function pollTemperature() {
      if (!relayServerUrlRef.current) return;
      
      fetch(`${relayServerUrlRef.current}/api/temperature`)
        .then(r => r.json())
        .then(data => {
          if (data.ok) {
            const temp = tempUnit === 'F' ? data.temperatureF : data.temperatureC;
            setCurrentTemp(temp);
            setTempError(null);
          } else {
            setTempError(data.error || 'Failed to read temperature');
          }
        })
        .catch(err => {
          setTempError(err.message || 'Temperature sensor unavailable');
        });
    }

    // Poll immediately and then every 3 seconds
    pollTemperature();
    tempPollIntervalRef.current = setInterval(pollTemperature, 3000);

    return () => {
      if (tempPollIntervalRef.current) {
        clearInterval(tempPollIntervalRef.current);
        tempPollIntervalRef.current = null;
      }
    };
  }, [relayServerUrl, tempUnit]);

  // Auto mode: check thermostat logic every 5 seconds
  useEffect(() => {
    if (!autoMode) return;

    function checkThermostatLogic() {
      if (!relayServerUrlRef.current || !autoModeRef.current) return;

      const body = {
        mode: autoModeTypeRef.current,
        targetTemp: targetTempRef.current,
        unit: tempUnit,
        hysteresis: hysteresisRef.current
      };

      fetch(`${relayServerUrlRef.current}/api/thermostat/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
        .then(r => r.json())
        .then(data => {
          if (data.ok) {
            const shouldBeOn = data.shouldBeOn;
            const terminal = autoModeTypeRef.current === 'heat' ? 'W' : 'Y';
            
            // Update the appropriate relay based on mode
            if (terminal === 'W' && shouldBeOn !== heatRelayOnRef.current) {
              setHeatRelayOn(shouldBeOn);
              logEvent(`Auto ${terminal}: ${shouldBeOn ? 'ON' : 'OFF'} - ${data.reason}`);
            } else if (terminal === 'Y' && shouldBeOn !== coolRelayOnRef.current) {
              setCoolRelayOn(shouldBeOn);
              logEvent(`Auto ${terminal}: ${shouldBeOn ? 'ON' : 'OFF'} - ${data.reason}`);
            }
          }
        })
        .catch(err => {
          logEvent(`Auto mode error: ${err.message}`);
        });
    }

    const autoInterval = setInterval(checkThermostatLogic, 5000);
    checkThermostatLogic(); // Check immediately

    return () => clearInterval(autoInterval);
  }, [autoMode, autoModeType, targetTemp, hysteresis, tempUnit]);

  function attemptToggle() {
    const now = Date.now();
    setAttempts((s) => s + 1);
    if (protectionUntil && now < protectionUntil) {
      setBlockedAttempts((s) => s + 1);
      logEvent(`Attempt blocked (protection until ${(new Date(protectionUntil)).toLocaleTimeString()})`);
      return;
    }

    // Toggle relay in UI state
    const next = !coolRelayOnRef.current;
    setRelayOn(next);
    // If hardware is enabled and confirmed, attempt to call relay server
    if (hardwareEnabledRef.current && hwConfirmTextRef.current === 'ENABLE-HARDWARE' && relayServerUrlRef.current && relaySecretRef.current) {
      // Non-blocking; log results
      const idx = 0;
      fetch(`${relayServerUrlRef.current}/api/relay/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: idx, on: next, secret: relaySecretRef.current }),
      }).then((r) => r.json()).then((json) => {
        if (json && json.ok) logEvent(`Hardware toggled ${next ? 'ON' : 'OFF'}`);
        else logEvent(`Hardware toggle failed: ${JSON.stringify(json)}`);
      }).catch((err) => {
        logEvent(`Hardware toggle error: ${err?.message || String(err)}`);
      });
    }
    logEvent(`Relay toggled ${next ? 'ON' : 'OFF'}`);

    // If we turned it ON, start protection for 5 minutes
    if (next) {
      const until = now + PROTECT_MS;
      setProtectionUntil(until);
      const humanDur = PROTECT_MS >= 60000 ? `${Math.round(PROTECT_MS/60000)} minute(s)` : `${Math.round(PROTECT_MS/1000)} second(s)`;
      logEvent(`Protection started for ${humanDur}`);
    }
  }

  const resetLogs = () => { setEvents([]); setAttempts(0); setBlockedAttempts(0); };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Short Cycle Test (Professional)</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">This test will attempt to toggle the 'Cool' compressor relay once per second. Safety protection will prevent repeated starts for {humanProtect} after a successful start (default 5 minutes).</p>

      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => setIsRunning(r => !r)}
          className={`px-3 py-2 rounded ${isRunning ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}
        >{isRunning ? 'Stop Test' : 'Start Test'}</button>
        <button onClick={() => attemptToggle()} className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-700">Attempt Now (Y)</button>

        <div className="text-sm">Y (Cool): <strong>{coolRelayOn ? 'ON' : 'OFF'}</strong></div>
        <div className="text-sm">Attempts: <strong>{attempts}</strong></div>
        <div className="text-sm">Blocked: <strong>{blockedAttempts}</strong></div>
      </div>

      {/* Manual contactor controls */}
      <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Manual Toggles:</span>
        <button
          onClick={() => setHeatRelay(!heatRelayOnRef.current)}
          className={`px-2 py-1 text-sm rounded ${heatRelayOn ? 'bg-orange-500 text-white' : 'bg-gray-300 dark:bg-gray-600'}`}
        >W (Heat): {heatRelayOn ? 'ON' : 'OFF'}</button>
        <button
          onClick={() => setRelayOn(!coolRelayOnRef.current)}
          className={`px-2 py-1 text-sm rounded ${coolRelayOn ? 'bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-600'}`}
        >Y (Cool): {coolRelayOn ? 'ON' : 'OFF'}</button>
        <button
          onClick={() => setFanRelay(!fanRelayOnRef.current)}
          className={`px-2 py-1 text-sm rounded ${fanRelayOn ? 'bg-green-500 text-white' : 'bg-gray-300 dark:bg-gray-600'}`}
        >G (Fan): {fanRelayOn ? 'ON' : 'OFF'}</button>
      </div>

      {/* Temperature Display */}
      <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            🌡️ Temperature: 
            {currentTemp !== null && typeof currentTemp === 'number' ? (
              <span className="ml-2 text-lg font-bold text-green-700 dark:text-green-400">
                {currentTemp.toFixed(1)}°{tempUnit}
              </span>
            ) : (
              <span className="ml-2 text-gray-500">--°{tempUnit}</span>
            )}
          </div>
          <button
            onClick={() => setTempUnit(tempUnit === 'F' ? 'C' : 'F')}
            className="px-2 py-1 text-xs bg-white dark:bg-gray-700 border rounded"
          >
            Switch to °{tempUnit === 'F' ? 'C' : 'F'}
          </button>
        </div>
        {tempError && (
          <div className="text-xs text-red-600 dark:text-red-400 mt-1">
            ⚠️ {tempError}
          </div>
        )}
      </div>

      {/* Auto Thermostat Mode */}
      <div className="mb-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-800">
        <div className="flex items-center gap-2 mb-2">
          <input 
            id="autoMode" 
            type="checkbox" 
            checked={autoMode} 
            onChange={(e) => setAutoMode(e.target.checked)} 
          />
          <label htmlFor="autoMode" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            🤖 Auto Thermostat Mode
          </label>
        </div>
        
        {autoMode && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400">Mode</label>
              <select 
                value={autoModeType} 
                onChange={(e) => setAutoModeType(e.target.value)}
                className="block w-full px-2 py-1 text-sm bg-white dark:bg-gray-800 border rounded"
              >
                <option value="heat">🔥 Heat (W)</option>
                <option value="cool">❄️ Cool (Y)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400">Target °{tempUnit}</label>
              <input 
                type="number" 
                value={targetTemp} 
                onChange={(e) => setTargetTemp(Number(e.target.value))}
                className="block w-full px-2 py-1 text-sm bg-white dark:bg-gray-800 border rounded"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400">Hysteresis °{tempUnit}</label>
              <input 
                type="number" 
                value={hysteresis} 
                onChange={(e) => setHysteresis(Number(e.target.value))}
                step="0.5"
                min="0.5"
                max="10"
                className="block w-full px-2 py-1 text-sm bg-white dark:bg-gray-800 border rounded"
              />
            </div>
            <div className="flex items-end">
              <div className="text-xs text-purple-700 dark:text-purple-300">
                {autoModeType === 'heat' ? '🔥 Heating' : '❄️ Cooling'} to {targetTemp}°{tempUnit}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 p-3 border rounded bg-gray-50 dark:bg-gray-900">
        <div className="flex gap-2 items-center mb-2">
          <input id="hardwareEnabled" type="checkbox" checked={hardwareEnabled} onChange={(e) => setHardwareEnabled(e.target.checked)} />
          <label htmlFor="hardwareEnabled" className="text-sm">Enable hardware relay (DEV ONLY)</label>
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">When enabled, toggles will be sent to the configured relay server. This is dangerous - only use in lab environments.</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label htmlFor="relayServerUrl" className="text-xs">Relay Server URL</label>
            <input id="relayServerUrl" value={relayServerUrl} onChange={(e) => setRelayServerUrl(e.target.value)} className="block w-full px-2 py-1 bg-white dark:bg-gray-800 border rounded" />
          </div>
          <div>
            <label htmlFor="relaySecret" className="text-xs">Relay Secret</label>
            <input id="relaySecret" value={relaySecret} onChange={(e) => setRelaySecret(e.target.value)} type="password" className="block w-full px-2 py-1 bg-white dark:bg-gray-800 border rounded" />
          </div>
        </div>
        <div className="mt-2">
          <label htmlFor="hwConfirmText" className="text-xs">Type <code>ENABLE-HARDWARE</code> to confirm: </label>
          <input id="hwConfirmText" className="ml-2 px-2 py-1 border rounded w-60" value={hwConfirmText} onChange={(e) => setHwConfirmText(e.target.value)} />
        </div>
      </div>

      <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">
        <div>Protection: {protectionUntil ? new Date(protectionUntil).toLocaleTimeString() : 'None'}</div>
      </div>

      <div className="mt-3">
        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Recent Events</div>
        <div className="max-h-40 overflow-auto text-xs text-gray-700 dark:text-gray-300">
          {events.map((l) => (
            <div key={l.id} className="py-1 border-b border-gray-100 dark:border-gray-700">{new Date(l.ts).toLocaleTimeString()} — {l.msg}</div>
          ))}
          {events.length === 0 && <div className="text-xs text-gray-500">No events yet</div>}
        </div>
      </div>

      <div className="mt-3">
        <button onClick={resetLogs} className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded">Reset</button>
      </div>
    </div>
  );
}
