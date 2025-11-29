import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Minus, Info, X, MapPin, BookOpen } from 'lucide-react';
import ShortCycleTest from '../components/ShortCycleTest';

// Import calculation helpers (adjust paths as needed)
import { getSaturationTemp, getTargetLiquidLineTemp, getSaturationPressure } from '../lib/ptCharts.js';

const refrigerants = ['R-410A', 'R-22', 'R-134a', 'R-32', 'R-407C'];

const DisplayScreen = ({
  method,
  pressure,
  saturationTemp,
  actualSuperheat,
  targetSuperheat,
  actualSubcooling,
  targetSubcooling,
  statusText,
  statusLevel,
}) => {
  const statusColorClass = {
    good: 'text-green-400',
    caution: 'text-yellow-400',
    critical: 'text-red-500',
  }[statusLevel] || 'text-gray-400';

  const formatNumber = (num, digits = 1) => {
    return typeof num === 'number' ? num.toFixed(digits) : '---';
  };

  const leftValue = method === 'superheat' ? formatNumber(actualSuperheat) : formatNumber(actualSubcooling);
  const leftLabel = method === 'superheat' ? 'SH' : 'SC';
  const rightValue = method === 'superheat' ? formatNumber(targetSuperheat) : formatNumber(targetSubcooling);
  const rightLabel = method === 'superheat' ? 'TSH' : 'TSC';

  return (
    <div className="bg-blue-900/80 dark:bg-black/50 border-4 border-gray-700 dark:border-gray-600 rounded-2xl p-4 shadow-inner">
      {/* Top Row: Primary Metrics */}
      <div className="grid grid-cols-3 text-center mb-3">
        <div>
          <div className="font-mono text-3xl text-white tracking-wider">{leftValue}°F</div>
          <div className="text-xs font-semibold text-gray-300">{leftLabel}</div>
        </div>
        <div>
          <div className="font-mono text-3xl text-white tracking-wider">{formatNumber(pressure, 0)} PSIG</div>
          <div className="text-xs font-semibold text-gray-300">PRESSURE</div>
        </div>
        <div>
          <div className="font-mono text-3xl text-white tracking-wider">{rightValue}°F</div>
          <div className="text-xs font-semibold text-gray-300">{rightLabel}</div>
        </div>
      </div>
      {/* Short Cycle Test (hardware safety) */}
      <div className="mt-6">
        <ShortCycleTest />
      </div>
      {/* Secondary Row */}
      <div className="grid grid-cols-3 text-center mb-4 border-t border-blue-800/50 pt-3">
        <div>
          <div className="font-mono text-lg text-gray-300">{formatNumber(saturationTemp)}°F</div>
          <div className="text-xs font-semibold text-gray-400">VSAT</div>
        </div>
        <div className="flex items-center justify-center">
          <div className={`text-xs font-extrabold uppercase tracking-wider ${statusColorClass}`}>{statusText}</div>
        </div>
        <div>
          <div className="font-mono text-lg text-gray-300">{method === 'superheat' ? (actualSuperheat != null && targetSuperheat != null ? (actualSuperheat - targetSuperheat).toFixed(1) : '---') : (actualSubcooling != null && targetSubcooling != null ? (actualSubcooling - targetSubcooling).toFixed(1) : '---')}°F</div>
          <div className="text-xs font-semibold text-gray-400">DIFF</div>
        </div>
      </div>
    </div>
  );
};

const InputControls = ({
  method,
  pressure,
  temperature,
  onPressureChange,
  onTemperatureChange,
}) => {
  const pressureLabel = method === 'superheat' ? 'Suction Pressure' : 'Liquid Pressure';
  const tempLabel = method === 'superheat' ? 'Suction Line Temp' : 'Liquid Line Temp';

  return (
    <div className="bg-gray-200 dark:bg-gray-800 p-4 rounded-b-2xl space-y-4">
      {/* Pressure Input */}
      <div>
        <label className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 block text-center">
          {pressureLabel}
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPressureChange(Math.max(0, pressure - 1))}
            className="p-3 bg-gray-300 dark:bg-gray-700 rounded-lg active:scale-95 transition-transform"
          >
            <Minus size={20} />
          </button>
          <input
            type="number"
            value={pressure}
            onChange={(e) => onPressureChange(Number(e.target.value))}
            className="w-full text-center text-3xl font-mono bg-gray-100 dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 rounded-lg p-2"
          />
          <button
            onClick={() => onPressureChange(pressure + 1)}
            className="p-3 bg-gray-300 dark:bg-gray-700 rounded-lg active:scale-95 transition-transform"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* Temperature Input */}
      <div>
        <label className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 block text-center">
          {tempLabel}
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onTemperatureChange(temperature - 1)}
            className="p-3 bg-gray-300 dark:bg-gray-700 rounded-lg active:scale-95 transition-transform"
          >
            <Minus size={20} />
          </button>
          <input
            type="number"
            value={temperature}
            onChange={(e) => onTemperatureChange(Number(e.target.value))}
            className="w-full text-center text-3xl font-mono bg-gray-100 dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 rounded-lg p-2"
          />
          <button
            onClick={() => onTemperatureChange(temperature + 1)}
            className="p-3 bg-gray-300 dark:bg-gray-700 rounded-lg active:scale-95 transition-transform"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

const ControlButton = ({ children, active = false, ...props }) => (
  <button
    className={`w-full px-2 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-extrabold rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-xs tracking-tight ${active ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''}`}
    {...props}
  >
    {children}
  </button>
);

const ControlPanel = ({
  refrigerant,
  onRefrigerantNext,
  onMethodToggle,
  onShowPtChart,
  onShowTargets,
  onShowHistory,
  onSaveReading,
  onShowUserManual,
}) => {
  return (
    <div className="mt-4 space-y-2">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Control Panel</span>
        <span className="text-[10px] text-gray-400 dark:text-gray-500">(Digital Manifold)</span>
      </div>
      <div className="grid grid-cols-6 gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl p-2 border border-gray-300 dark:border-gray-700 shadow-sm">
        <ControlButton onClick={onRefrigerantNext}>
          <div className="flex flex-col items-center">
            <div className="text-xs">▲</div>
            <div className="text-sm font-black" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{refrigerant}</div>
            <div className="text-xs">▼</div>
          </div>
        </ControlButton>
        <ControlButton onClick={onMethodToggle}>
          <div className="font-black text-lg" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>SC/SH</div>
        </ControlButton>
        <ControlButton onClick={onShowPtChart}>
          <div className="font-black text-sm" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>PT CHART</div>
        </ControlButton>
        <ControlButton onClick={onShowTargets}>
          <div className="font-black text-sm" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>TARGET</div>
        </ControlButton>
        <ControlButton onClick={onShowHistory}>
          <div className="font-black text-sm" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>HISTORY</div>
        </ControlButton>
        <ControlButton active onClick={onSaveReading}>
          <div className="font-black text-lg" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>ENTER</div>
        </ControlButton>
      </div>

      {/* Bottom Row: Utility Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <ControlButton onClick={onShowUserManual}>
          <div className="flex items-center justify-center gap-2">
            <BookOpen size={16} />
            <span className="font-black text-sm">MANUAL</span>
          </div>
        </ControlButton>
        <Link to="/charging-calculator" className="w-full">
          <ControlButton>
            <div className="flex items-center justify-center gap-2">
              <MapPin size={16} />
              <span className="font-black text-sm">BACK</span>
            </div>
          </ControlButton>
        </Link>
      </div>
    </div>
  );
};

const ProfessionalMode = () => {
  const [refrigerantIndex, setRefrigerantIndex] = useState(0);
  const [method, setMethod] = useState('superheat');
  const [pressure, setPressure] = useState(100);
  const [temperature, setTemperature] = useState(80); // suction line temp OR liquid line temp depending on method
  const [targetSuperheat] = useState(10);
  const [targetSubcooling] = useState(12);

  // Additional modal states
  const [showUserManualModal, setShowUserManualModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');

  // Pro status check
  const isPro = useMemo(() => {
    try {
      const stored = localStorage.getItem('userSubscription');
      if (stored) {
        const obj = JSON.parse(stored);
        if (obj && obj.isPro) return true;
      }
    } catch {
      // ignore parse errors
    }
    return localStorage.getItem('isPro') === 'true';
  }, []);
  // Unified Job History: read from shared key, migrate old proMode entries if found
  const [jobHistory, setJobHistory] = useState(() => {
    const readJson = (key) => {
      try {
        const s = localStorage.getItem(key);
        return s ? JSON.parse(s) : [];
      } catch (error) {
        console.warn('Failed to parse job history key', key, error);
        return [];
      }
    };

    const unified = readJson('chargingJobHistory');
    const legacyPro = readJson('proModeJobHistory');

    // If legacy entries exist and unified is empty, migrate a simple mapping
    if (Array.isArray(legacyPro) && legacyPro.length && (!Array.isArray(unified) || unified.length === 0)) {
      const migrated = legacyPro.map((r) => {
        const isSH = r.method === 'superheat';
        const inputs = isSH
          ? { suctionPressure: r.pressure, suctionTemp: r.temperature, targetSuperheat: r.targetSuperheat ?? 0 }
          : { liquidLinePressure: r.pressure, liquidLineTemp: r.temperature, targetSubcooling: r.targetSubcooling ?? 0 };

        // Best-effort results mapping
        const results = isSH
          ? {
            method: 'superheat',
            refrigerant: r.refrigerant,
            targetSuperheat: r.targetSuperheat ?? null,
            actualSuperheat: r.actualSuperheat ?? null,
            chargeStatus: r.status || 'Charge is Good',
            statusLevel: 'good',
            action: '',
            difference: r.actualSuperheat != null && r.targetSuperheat != null ? (r.actualSuperheat - r.targetSuperheat) : null,
            satTemp: r.saturationTemp ?? null,
            targetSuctionPressure: null,
            targetSaturationTemp: null,
          }
          : {
            method: 'subcooling',
            refrigerant: r.refrigerant,
            targetTemp: null,
            chargeStatus: r.status || 'Charge is Good',
            statusLevel: 'good',
            action: '',
            difference: null,
          };

        return {
          id: r.id || Date.now(),
          timestamp: r.ts || new Date().toISOString(),
          clientName: 'Pro Mode Reading',
          refrigerant: r.refrigerant,
          method: r.method,
          inputs,
          results,
        };
      });
      try {
        localStorage.setItem('chargingJobHistory', JSON.stringify(migrated));
        localStorage.removeItem('proModeJobHistory');
      } catch (error) { console.warn('Failed to migrate proMode job history', error); }
      return migrated;
    }

    return Array.isArray(unified) ? unified : [];
  });

  // Modal states
  const [showHistory, setShowHistory] = useState(false);
  const [showPtChart, setShowPtChart] = useState(false);
  const [showTargetsModal, setShowTargetsModal] = useState(false);

  // Environmental conditions for target calculation
  const [indoorWetBulb, setIndoorWetBulb] = useState('');
  const [outdoorDryBulb, setOutdoorDryBulb] = useState('');
  const [indoorDryBulb, setIndoorDryBulb] = useState('');
  const [fetchingConditions, setFetchingConditions] = useState(false);
  const [locationName, setLocationName] = useState('');

  const refrigerant = refrigerants[refrigerantIndex];

  // Calculations
  const calculatedValues = useMemo(() => {
    const satTemp = getSaturationTemp(refrigerant, pressure);

    if (method === 'superheat') {
      const actualSuperheat = satTemp != null ? temperature - satTemp : null;
      const diff = (actualSuperheat != null && targetSuperheat != null) ? actualSuperheat - targetSuperheat : null;
      let chargeStatus = 'CHARGE IS GOOD';
      let statusLevel = 'good';
      if (diff != null) {
        if (diff > 5) { chargeStatus = 'SIGNIFICANTLY UNDERCHARGED'; statusLevel = 'critical'; }
        else if (diff > 2) { chargeStatus = 'SLIGHTLY UNDERCHARGED'; statusLevel = 'caution'; }
        else if (diff < -5) { chargeStatus = 'SIGNIFICANTLY OVERCHARGED'; statusLevel = 'critical'; }
        else if (diff < -2) { chargeStatus = 'SLIGHTLY OVERCHARGED'; statusLevel = 'caution'; }
      }
      return {
        method,
        pressure,
        saturationTemp: satTemp,
        actualSuperheat,
        targetSuperheat,
        actualSubcooling: null,
        targetSubcooling: null,
        statusText: chargeStatus,
        statusLevel,
      };
    } else {
      // Subcooling: actual = condensing sat temp - measured liquid line temp
      const actualSubcooling = satTemp != null ? satTemp - temperature : null;
      const diff = (actualSubcooling != null && targetSubcooling != null) ? actualSubcooling - targetSubcooling : null;
      let chargeStatus = 'CHARGE IS GOOD';
      let statusLevel = 'good';
      if (diff != null) {
        if (diff > 5) { chargeStatus = 'SIGNIFICANTLY UNDERCHARGED'; statusLevel = 'critical'; }
        else if (diff > 2) { chargeStatus = 'SLIGHTLY UNDERCHARGED'; statusLevel = 'caution'; }
        else if (diff < -5) { chargeStatus = 'SIGNIFICANTLY OVERCHARGED'; statusLevel = 'critical'; }
        else if (diff < -2) { chargeStatus = 'SLIGHTLY OVERCHARGED'; statusLevel = 'caution'; }
      }
      return {
        method,
        pressure,
        saturationTemp: satTemp,
        actualSuperheat: null,
        targetSuperheat: null,
        actualSubcooling,
        targetSubcooling,
        statusText: chargeStatus,
        statusLevel,
      };
    }
  }, [method, pressure, temperature, refrigerant, targetSuperheat, targetSubcooling]);

  const handleRefrigerantPrev = () => {
    setRefrigerantIndex(prev => (prev - 1 + refrigerants.length) % refrigerants.length);
  };
  const handleRefrigerantNext = () => {
    setRefrigerantIndex(prev => (prev + 1) % refrigerants.length);
  };

  const handleMethodToggle = () => {
    setMethod(prev => prev === 'superheat' ? 'subcooling' : 'superheat');
  };

  // Build results object matching the shared schema used in HeatPumpChargingCalc
  const buildResultsForSave = () => {
    if (method === 'superheat') {
      const satTemp = getSaturationTemp(refrigerant, pressure);
      const actualSuperheat = satTemp != null ? (temperature - satTemp) : null;
      const diff = actualSuperheat != null ? (actualSuperheat - Number(targetSuperheat)) : null;
      let chargeStatus = 'Charge is Good';
      let statusLevel = 'good';
      let action = 'System is properly charged. No action needed.';
      if (diff != null) {
        if (diff > 5) { chargeStatus = 'Significantly Undercharged'; statusLevel = 'critical'; action = 'Add refrigerant immediately'; }
        else if (diff > 2) { chargeStatus = 'Slightly Undercharged'; statusLevel = 'caution'; action = 'Add small amount of refrigerant'; }
        else if (diff < -5) { chargeStatus = 'Significantly Overcharged'; statusLevel = 'critical'; action = 'Recover refrigerant immediately'; }
        else if (diff < -2) { chargeStatus = 'Slightly Overcharged'; statusLevel = 'caution'; action = 'Recover small amount of refrigerant'; }
      }
      return {
        method: 'superheat',
        refrigerant,
        targetSuperheat: Number(targetSuperheat),
        actualSuperheat,
        chargeStatus,
        statusLevel,
        action,
        difference: diff,
        satTemp,
        targetSuctionPressure: null,
        targetSaturationTemp: null,
      };
    } else {
      const targetTemp = getTargetLiquidLineTemp(refrigerant, pressure, Number(targetSubcooling));
      if (targetTemp == null) {
        return { method: 'subcooling', refrigerant, targetTemp: null, chargeStatus: 'Invalid Subcooling Chart', statusLevel: 'error', action: '', difference: null };
      }
      const difference = temperature - targetTemp;
      let chargeStatus = 'Charge is Good';
      let statusLevel = 'good';
      let action = 'System is properly charged. No action needed.';
      if (difference > 5) { chargeStatus = 'Significantly Undercharged'; statusLevel = 'critical'; action = 'Add refrigerant immediately'; }
      else if (difference > 2) { chargeStatus = 'Slightly Undercharged'; statusLevel = 'caution'; action = 'Add small amount of refrigerant'; }
      else if (difference < -5) { chargeStatus = 'Significantly Overcharged'; statusLevel = 'critical'; action = 'Recover refrigerant immediately'; }
      else if (difference < -2) { chargeStatus = 'Slightly Overcharged'; statusLevel = 'caution'; action = 'Recover small amount of refrigerant'; }
      return { method: 'subcooling', refrigerant, targetTemp, chargeStatus, statusLevel, action, difference };
    }
  };

  const handleSaveReading = () => {
    const clientName = prompt('Enter Client Name or Job ID (optional):');
    if (clientName === null) return; // cancel

    const results = buildResultsForSave();
    const inputs = method === 'superheat'
      ? { suctionPressure: pressure, suctionTemp: temperature, targetSuperheat: Number(targetSuperheat) }
      : { liquidLinePressure: pressure, liquidLineTemp: temperature, targetSubcooling: Number(targetSubcooling) };

    const entry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      clientName: clientName || 'Untitled Job',
      refrigerant,
      method,
      inputs,
      results,
    };
    const updated = [entry, ...jobHistory].slice(0, 50);
    setJobHistory(updated);
    try { localStorage.setItem('chargingJobHistory', JSON.stringify(updated)); } catch (error) { console.warn('Failed to persist chargingJobHistory (save)', error); }
  };

  const handleShowHistory = () => setShowHistory(true);
  const handleShowPtChart = () => setShowPtChart(true);
  const handleShowUserManual = () => setShowUserManualModal(true);
  const handleShowTargets = () => setShowTargetsModal(true);
  const closeHistory = () => setShowHistory(false);
  const closePtChart = () => setShowPtChart(false);
  const closeUserManual = () => setShowUserManualModal(false);
  const closeTargets = () => setShowTargetsModal(false);

  // Fetch local weather conditions via GPS
  const fetchLocalConditions = async () => {
    setFetchingConditions(true);
    setLocationName('');

    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by your device.');
      }

      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;

      const weatherResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m&temperature_unit=fahrenheit&timezone=auto`
      );

      if (!weatherResponse.ok) {
        throw new Error('Unable to fetch weather data.');
      }

      const weatherData = await weatherResponse.json();
      const currentTemp = weatherData.current.temperature_2m;

      const reverseGeoResponse = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
      );

      if (reverseGeoResponse.ok) {
        const reverseGeoData = await reverseGeoResponse.json();
        const city = reverseGeoData.city || reverseGeoData.locality || '';
        const state = reverseGeoData.principalSubdivisionCode || '';
        setLocationName(`${city}, ${state}`.trim().replace(/,$/, ''));
      }

      setOutdoorDryBulb(Math.round(currentTemp).toString());
      alert(`✓ Local conditions fetched!\n\nLocation: ${locationName || 'Current location'}\nOutdoor Temp: ${Math.round(currentTemp)}°F`);

    } catch (error) {
      let errorMessage = 'Unable to fetch local conditions.';

      if (error.code === 1) {
        errorMessage = 'Location access denied. Please enable location permissions.';
      } else if (error.code === 2) {
        errorMessage = 'Location unavailable. Please check your device\'s location services.';
      } else if (error.code === 3) {
        errorMessage = 'Location request timed out. Please try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      alert(errorMessage);
      console.error('Fetch local conditions error:', error);
    } finally {
      setFetchingConditions(false);
    }
  };

  // Calculate and apply targets based on environmental conditions
  const calculateAndApplyTargets = () => {
    // For now, just close the modal - calculation logic can be enhanced later
    // In a full implementation, this would calculate target SH based on indoor/outdoor conditions
    closeTargets();
  };
  const deleteHistoryItem = (id) => {
    const updated = jobHistory.filter(e => e.id !== id);
    setJobHistory(updated);
    try { localStorage.setItem('chargingJobHistory', JSON.stringify(updated)); } catch (error) { console.warn('Failed to persist chargingJobHistory (delete)', error); }
  };

  // Export job to PDF (lazy-load jsPDF when needed)
  const handleExportJob = async (job) => {
    if (!isPro) {
      setUpgradeReason('PDF export is a Pro feature. Upgrade to generate branded service reports and share with clients.');
      setShowUpgradeModal(true);
      return;
    }
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Service Report', 20, 20);
      doc.setFontSize(12);
      doc.text(`Client: ${job.clientName}`, 20, 34);
      doc.text(`Date: ${new Date(job.timestamp).toLocaleString()}`, 20, 42);
      doc.text(`Refrigerant: ${job.refrigerant}`, 20, 50);
      doc.text(`Method: ${job.method}`, 20, 58);
      // Add readings
      let y = 70;
      Object.entries(job.inputs).forEach(([k, v]) => {
        doc.text(`${k}: ${v}`, 20, y);
        y += 8;
      });
      y += 4;
      doc.text('Results:', 20, y);
      y += 8;
      doc.text(`Status: ${job.results.chargeStatus}`, 20, y);
      y += 8;
      doc.text(`Notes: ${job.results.action || 'N/A'}`, 20, y);
      doc.save(`service-report-${job.id}.pdf`);
    } catch (e) {
      console.error('Failed to export PDF', e);
      setUpgradeReason('Unable to generate PDF at this time. Please try again later.');
      setShowUpgradeModal(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-sm mx-auto">
        <div className="flex justify-between items-center mb-4">
          <Link to="/charging-calculator" className="text-blue-600 dark:text-blue-400">← Back to Calculator</Link>
          <h1 className="text-2xl font-bold">Professional Mode</h1>
        </div>

        <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-3xl shadow-lg">
          <DisplayScreen {...calculatedValues} />
          <InputControls
            method={method}
            pressure={pressure}
            temperature={temperature}
            onPressureChange={setPressure}
            onTemperatureChange={setTemperature}
          />
          <ControlPanel
            refrigerant={refrigerant}
            method={method}
            onRefrigerantPrev={handleRefrigerantPrev}
            onRefrigerantNext={handleRefrigerantNext}
            onMethodToggle={handleMethodToggle}
            onShowPtChart={handleShowPtChart}
            onShowTargets={handleShowTargets}
            onShowHistory={handleShowHistory}
            onSaveReading={handleSaveReading}
            onShowUserManual={handleShowUserManual}
          />
        </div>

        {/* History Modal (shared schema with main calculator) */}
        {showHistory && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-xl p-4 shadow-xl border border-gray-300 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold">Job History ({jobHistory.length})</h2>
                <button onClick={closeHistory} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"><X size={18} /></button>
              </div>
              {jobHistory.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">No readings saved yet. Press ENTER to save current reading.</p>
              )}
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {jobHistory.map(job => (
                  <div key={job.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-xs">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <div className="font-semibold">{job.clientName || 'Service Reading'}</div>
                        <div className="text-gray-600 dark:text-gray-400">{new Date(job.timestamp).toLocaleString()}</div>
                        <div className="text-gray-700 dark:text-gray-300">{job.refrigerant} • {job.method === 'superheat' ? 'SH' : 'SC'} • {job.results?.chargeStatus || '—'}</div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleExportJob(job)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 px-1">📄</button>
                        <button onClick={() => deleteHistoryItem(job.id)} className="text-red-500 hover:text-red-700">✕</button>
                      </div>
                    </div>
                    <div className="mt-1 text-gray-700 dark:text-gray-300">
                      {job.method === 'superheat' ? (
                        <div>
                          Suction {job.inputs?.suctionPressure} psig • {job.inputs?.suctionTemp}°F • Target {job.inputs?.targetSuperheat}°F
                          {job.results?.actualSuperheat != null && (
                            <> • Actual {job.results.actualSuperheat.toFixed ? job.results.actualSuperheat.toFixed(1) : job.results.actualSuperheat}°F</>
                          )}
                        </div>
                      ) : (
                        <div>
                          Liquid {job.inputs?.liquidLinePressure} psig • {job.inputs?.liquidLineTemp}°F • Target SC {job.inputs?.targetSubcooling}°F
                          {job.results?.targetTemp != null && (
                            <> • Req LLT {job.results.targetTemp.toFixed ? job.results.targetTemp.toFixed(1) : job.results.targetTemp}°F</>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PT Chart Modal */}
        {showPtChart && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-xl p-4 shadow-xl border border-gray-300 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold">{refrigerant} PT Chart (Excerpt)</h2>
                <button onClick={closePtChart} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"><X size={18} /></button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Showing key points for quick reference.</p>
              <table className="w-full text-xs border border-gray-300 dark:border-gray-700">
                <thead>
                  <tr className="bg-gray-200 dark:bg-gray-700">
                    <th className="p-1 text-left">Pressure (psig)</th>
                    <th className="p-1 text-left">Sat Temp (°F)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(getSaturationPressure(refrigerant) || {}).slice(0, 12).map(([temp, press]) => (
                    <tr key={temp} className="odd:bg-gray-50 dark:odd:bg-gray-900">
                      <td className="p-1">{press}</td>
                      <td className="p-1">{temp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 text-xs text-center text-gray-500 dark:text-gray-400">Full chart available in main calculator.</div>
            </div>
          </div>
        )}

        <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          Digital Manifold Interface - EPA 608 Certified Technicians Only
        </div>

        {/* Set Targets Modal */}
        {showTargetsModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-xl p-6 shadow-xl border border-gray-300 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Calculate Targets</h2>
                <button onClick={closeTargets} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"><X size={20} /></button>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Enter environmental conditions to calculate target superheat and system parameters.
                </p>

                {/* Environmental Inputs */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Indoor Wet Bulb (°F)
                  </label>
                  <input
                    type="number"
                    value={indoorWetBulb}
                    onChange={(e) => setIndoorWetBulb(e.target.value)}
                    placeholder="e.g., 63"
                    className="w-full px-4 py-2 text-lg bg-gray-100 dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Outdoor Dry Bulb (°F)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={outdoorDryBulb}
                      onChange={(e) => setOutdoorDryBulb(e.target.value)}
                      placeholder="e.g., 85"
                      className="flex-1 px-4 py-2 text-lg bg-gray-100 dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      onClick={fetchLocalConditions}
                      disabled={fetchingConditions}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2 whitespace-nowrap"
                      title="Fetch outdoor temperature via GPS"
                    >
                      {fetchingConditions ? (
                        <>
                          <span className="animate-spin">⟳</span>
                          Fetching...
                        </>
                      ) : (
                        <>
                          <MapPin size={16} />
                          Fetch
                        </>
                      )}
                    </button>
                  </div>
                  {locationName && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <MapPin size={12} className="inline mr-1" /> {locationName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Indoor Dry Bulb (°F)
                  </label>
                  <input
                    type="number"
                    value={indoorDryBulb}
                    onChange={(e) => setIndoorDryBulb(e.target.value)}
                    placeholder="e.g., 75"
                    className="w-full px-4 py-2 text-lg bg-gray-100 dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Calculated Targets Preview */}
                {method === 'superheat' && indoorWetBulb && outdoorDryBulb && (
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Calculated Targets:</h3>
                    <div className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                      <div><strong>Target Superheat:</strong> {targetSuperheat}°F</div>
                      {indoorDryBulb && (
                        <>
                          <div><strong>Target Sat Temp:</strong> {(Number(indoorDryBulb) - 35).toFixed(1)}°F (TD = 35°F)</div>
                          <div><strong>Target Suction Pressure:</strong> {
                            (() => {
                              const targetSatTemp = Number(indoorDryBulb) - 35;
                              const targetPress = getSaturationPressure(refrigerant, targetSatTemp);
                              return targetPress != null ? `${targetPress.toFixed(0)} psig` : 'N/A';
                            })()
                          }</div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {method === 'subcooling' && (
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Current Target:</h3>
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Target Subcooling:</strong> {targetSubcooling}°F
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                      Subcooling method uses manufacturer-specified target (typically 8-15°F).
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={closeTargets}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={calculateAndApplyTargets}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  ✨ Apply Targets
                </button>
              </div>
            </div>
          </div>
        )}

        {/* User Manual Modal */}
        {showUserManualModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 w-full max-w-4xl rounded-xl p-6 shadow-xl border border-gray-300 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Professional Mode - User Manual</h2>
                <button onClick={closeUserManual} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl"><X size={24} /></button>
              </div>

              <div className="space-y-6 text-sm">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Welcome to Professional Mode</h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    Professional Mode provides a streamlined, digital manifold-style interface designed for experienced HVAC technicians who need fast, accurate charge assessments in the field.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Display Screen</h3>
                  <ul className="space-y-2 ml-4 text-gray-700 dark:text-gray-300">
                    <li><strong>SH/SC:</strong> Actual Superheat or Subcooling (depending on method)</li>
                    <li><strong>PRESSURE:</strong> Current pressure reading in PSIG</li>
                    <li><strong>TSH/TSC:</strong> Target Superheat or Target Subcooling</li>
                    <li><strong>VSAT:</strong> Vapor Saturation Temperature at current pressure</li>
                    <li><strong>DIFF:</strong> Difference between actual and target (positive = undercharged)</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Input Controls</h3>
                  <p className="text-gray-700 dark:text-gray-300 mb-2">
                    Use the +/- buttons or tap the values directly to adjust:
                  </p>
                  <ul className="space-y-1 ml-4 text-gray-700 dark:text-gray-300">
                    <li>• <strong>Pressure:</strong> Suction (SH mode) or Liquid (SC mode) line pressure</li>
                    <li>• <strong>Temperature:</strong> Measured line temperature at the same location</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Control Panel</h3>
                  <ul className="space-y-1 ml-4 text-gray-700 dark:text-gray-300">
                    <li><strong>▲ REF ▼:</strong> Cycle through refrigerant types</li>
                    <li><strong>SC / SH:</strong> Toggle between Subcooling and Superheat methods</li>
                    <li><strong>PT CHART:</strong> View Pressure-Temperature reference table</li>
                    <li><strong>TARGETS:</strong> Set environmental conditions and calculate target values</li>
                    <li><strong>HISTORY:</strong> Access saved job readings</li>
                    <li><strong>ENTER:</strong> Save current reading to job history</li>
                    <li><strong><BookOpen size={12} className="inline mr-1" /> USER MANUAL:</strong> Open this help guide</li>
                    <li><strong><MapPin size={12} className="inline mr-1" /> BACK:</strong> Return to traditional calculator view</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Professional Workflow</h3>
                  <div className="space-y-2 ml-4 text-gray-700 dark:text-gray-300">
                    <p className="font-semibold">Step 1: Set Your Targets</p>
                    <ol className="list-decimal ml-4 space-y-1">
                      <li>Tap <strong>TARGETS</strong> to open the environmental conditions modal</li>
                      <li>Enter Indoor Wet Bulb and Indoor Dry Bulb readings from inside the building</li>
                      <li>Tap <strong>🛰️ Fetch</strong> to auto-populate outdoor temperature via GPS</li>
                      <li>Review the calculated target values</li>
                      <li>Tap <strong>✨ Apply Targets</strong> to update the display</li>
                    </ol>
                    <p className="font-semibold mt-3">Step 2: Take Live Readings</p>
                    <ol className="list-decimal ml-4 space-y-1">
                      <li>Connect your manifold gauges to the system</li>
                      <li>Use the +/- buttons to enter pressure and temperature readings</li>
                      <li>Watch the status indicator update in real-time</li>
                    </ol>
                    <p className="font-semibold mt-3">Step 3: Save Your Work</p>
                    <ol className="list-decimal ml-4 space-y-1">
                      <li>Once satisfied with the charge, tap <strong>ENTER</strong></li>
                      <li>Enter a client name or job ID</li>
                      <li>Reading is saved to unified job history</li>
                    </ol>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Reading the Results</h3>
                  <div className="space-y-2 ml-4">
                    <p className="text-gray-700 dark:text-gray-300">
                      The status indicator shows your charge status:
                    </p>
                    <ul className="space-y-1 text-gray-700 dark:text-gray-300">
                      <li>• <span className="text-green-600 font-bold">CHARGE IS GOOD:</span> System is properly charged</li>
                      <li>• <span className="text-yellow-600 font-bold">SLIGHTLY UNDER/OVERCHARGED:</span> Minor adjustment needed</li>
                      <li>• <span className="text-red-600 font-bold">SIGNIFICANTLY UNDER/OVERCHARGED:</span> Immediate action required</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                    ⚠️ <strong>Safety Notice:</strong> This tool is for EPA 608 Certified Technicians only. Always follow manufacturer guidelines and safety protocols when handling refrigerants.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button onClick={closeUserManual} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Close Manual
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upgrade Modal */}
        {showUpgradeModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowUpgradeModal(false)}>
            <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-xl p-8 shadow-xl border border-gray-300 dark:border-gray-700" onClick={e => e.stopPropagation()}>
              <div className="text-center">
                <div className="text-5xl mb-4">🔓</div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-3">Upgrade to Pro</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-6">{upgradeReason}</p>

                <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 mb-6">
                  <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-2">Pro Features Include:</h3>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 text-left space-y-1">
                    <li>✓ All refrigerants (R-134a, R-32, R-407C & more)</li>
                    <li>✓ Unlimited job history saves</li>
                    <li>✓ PDF export for professional reports</li>
                    <li>✓ Priority support</li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowUpgradeModal(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Maybe Later</button>
                  <Link to="/settings" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" onClick={() => setShowUpgradeModal(false)}>Upgrade Now</Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfessionalMode;
