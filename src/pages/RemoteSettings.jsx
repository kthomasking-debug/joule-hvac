import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Settings, 
  Save, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Loader2,
  Server
} from 'lucide-react';
import { getAllSettings, DEFAULT_SETTINGS, setSetting } from '../lib/unifiedSettingsManager';
import { jouleBridgeApi } from '../lib/jouleBridgeApi';

/**
 * Remote Settings Configuration Page
 * Allows remote configuration of all user settings via Tailscale
 * Accessible through Bridge Diagnostics page
 */
export default function RemoteSettings() {
  const location = useLocation();
  const bridgeUrl = location.state?.bridgeUrl || 
    localStorage.getItem('jouleBridgeUrl') || 
    import.meta.env.VITE_JOULE_BRIDGE_URL || 
    'http://joule-bridge.local:8080';
  
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [localSettings, setLocalSettings] = useState({});

  // Load settings from bridge server
  const loadRemoteSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${bridgeUrl}/api/settings`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load settings: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setSettings(data.settings || {});
      } else {
        throw new Error(data.error || 'Failed to load settings');
      }
    } catch (err) {
      console.error('Error loading remote settings:', err);
      setError(err.message);
      // Fallback to local settings
      setLocalSettings(getAllSettings());
    } finally {
      setLoading(false);
    }
  };

  // Save settings to bridge server
  const saveRemoteSettings = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch(`${bridgeUrl}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save settings: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setSuccess('Settings saved successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        throw new Error(data.error || 'Failed to save settings');
      }
    } catch (err) {
      console.error('Error saving remote settings:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Update a single setting
  const updateSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Reset to defaults
  const resetToDefaults = () => {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      setSettings({ ...DEFAULT_SETTINGS });
    }
  };

  useEffect(() => {
    loadRemoteSettings();
  }, [bridgeUrl]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0C0F14] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-slate-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0C0F14] py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Server className="w-8 h-8 text-blue-500" />
            <h1 className="text-3xl font-bold text-white">Remote Settings Configuration</h1>
          </div>
          <p className="text-slate-400">
            Configure all user settings remotely via Tailscale. Changes are saved to the bridge server.
          </p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-300">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-900/50 border border-green-700 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-green-300">{success}</span>
          </div>
        )}

        {/* Actions Bar */}
        <div className="mb-6 flex gap-3">
          <button
            onClick={loadRemoteSettings}
            disabled={loading}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Reload
          </button>
          <button
            onClick={saveRemoteSettings}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save All Settings'}
          </button>
          <button
            onClick={resetToDefaults}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors"
          >
            Reset to Defaults
          </button>
        </div>

        {/* Settings Form */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 space-y-6">
          {/* System Settings */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">System Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SettingInput
                label="Capacity (BTU)"
                key="capacity"
                value={settings.capacity || DEFAULT_SETTINGS.capacity}
                onChange={(v) => updateSetting('capacity', Number(v))}
                type="number"
                options={[18, 24, 30, 36, 42, 48, 60]}
              />
              <SettingInput
                label="Efficiency (SEER)"
                key="efficiency"
                value={settings.efficiency || DEFAULT_SETTINGS.efficiency}
                onChange={(v) => updateSetting('efficiency', Number(v))}
                type="number"
                min={13}
                max={22}
              />
              <SettingInput
                label="HSPF2"
                key="hspf2"
                value={settings.hspf2 || DEFAULT_SETTINGS.hspf2}
                onChange={(v) => updateSetting('hspf2', Number(v))}
                type="number"
                min={6}
                max={13}
                step={0.1}
              />
              <SettingInput
                label="AFUE"
                key="afue"
                value={settings.afue || DEFAULT_SETTINGS.afue}
                onChange={(v) => updateSetting('afue', Number(v))}
                type="number"
                min={0.6}
                max={0.99}
                step={0.01}
              />
            </div>
          </div>

          {/* Building Settings */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Building Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SettingInput
                label="Square Feet"
                key="squareFeet"
                value={settings.squareFeet || DEFAULT_SETTINGS.squareFeet}
                onChange={(v) => updateSetting('squareFeet', Number(v))}
                type="number"
                min={100}
                max={10000}
              />
              <SettingInput
                label="Insulation Level"
                key="insulationLevel"
                value={settings.insulationLevel || DEFAULT_SETTINGS.insulationLevel}
                onChange={(v) => updateSetting('insulationLevel', Number(v))}
                type="number"
                min={0.3}
                max={2.0}
                step={0.05}
              />
              <SettingInput
                label="Ceiling Height (ft)"
                key="ceilingHeight"
                value={settings.ceilingHeight || DEFAULT_SETTINGS.ceilingHeight}
                onChange={(v) => updateSetting('ceilingHeight', Number(v))}
                type="number"
                min={6}
                max={20}
              />
              <SettingInput
                label="Home Elevation (ft)"
                key="homeElevation"
                value={settings.homeElevation || DEFAULT_SETTINGS.homeElevation}
                onChange={(v) => updateSetting('homeElevation', Number(v))}
                type="number"
                min={-500}
                max={15000}
              />
            </div>
          </div>

          {/* Thermostat Settings */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Thermostat Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SettingInput
                label="Winter Thermostat (°F)"
                key="winterThermostat"
                value={settings.winterThermostat || DEFAULT_SETTINGS.winterThermostat}
                onChange={(v) => updateSetting('winterThermostat', Number(v))}
                type="number"
                min={50}
                max={85}
              />
              <SettingInput
                label="Summer Thermostat (°F)"
                key="summerThermostat"
                value={settings.summerThermostat || DEFAULT_SETTINGS.summerThermostat}
                onChange={(v) => updateSetting('summerThermostat', Number(v))}
                type="number"
                min={50}
                max={85}
              />
            </div>
          </div>

          {/* Energy Settings */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Energy Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SettingInput
                label="Utility Cost ($/kWh)"
                key="utilityCost"
                value={settings.utilityCost || DEFAULT_SETTINGS.utilityCost}
                onChange={(v) => updateSetting('utilityCost', Number(v))}
                type="number"
                min={0.05}
                max={1.0}
                step={0.01}
              />
              <SettingInput
                label="Gas Cost ($/therm)"
                key="gasCost"
                value={settings.gasCost || DEFAULT_SETTINGS.gasCost}
                onChange={(v) => updateSetting('gasCost', Number(v))}
                type="number"
                min={0.5}
                max={5.0}
                step={0.1}
              />
              <SettingInput
                label="Use Electric Aux Heat"
                key="useElectricAuxHeat"
                value={settings.useElectricAuxHeat ?? DEFAULT_SETTINGS.useElectricAuxHeat}
                onChange={(v) => updateSetting('useElectricAuxHeat', v === 'true' || v === true)}
                type="checkbox"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Setting Input Component
function SettingInput({ label, value, onChange, type, options, min, max, step }) {
  if (type === 'checkbox') {
    return (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label className="text-sm font-medium text-slate-300">{label}</label>
      </div>
    );
  }

  if (options) {
    return (
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
        >
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        step={step}
        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

