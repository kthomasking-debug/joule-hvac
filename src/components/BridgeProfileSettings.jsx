import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Server, DollarSign, Save, RefreshCw } from 'lucide-react';
import { getBridgeBase, setBridgeBase, saveHomeProfile, getHomeProfile, getWeeklyCost } from '../lib/bridgeApi';

export default function BridgeProfileSettings({ setToast }) {
  const [bridgeUrl, setBridgeUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [testStatus, setTestStatus] = useState(null);
  const [profile, setProfile] = useState({
    electric_rate_cents_kwh: 15.0,
    gas_rate_per_therm: 1.12,
    weekly_kwh: 0,
    weekly_therms: 0,
    notes: '',
  });
  const [weeklyCost, setWeeklyCost] = useState(null);

  // Load bridge URL and profile on mount
  useEffect(() => {
    const base = getBridgeBase();
    setBridgeUrl(base);
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const result = await getHomeProfile();
      if (result.ok && result.profile) {
        setProfile(result.profile);
      }
    } catch (e) {
      console.warn('Failed to load profile:', e);
    }
  };

  const handleTestConnection = async () => {
    setLoading(true);
    setTestStatus(null);
    try {
      const result = await getHomeProfile();
      if (result.ok) {
        setTestStatus('success');
        setToast?.({ message: 'Bridge connection successful!', type: 'success' });
      } else {
        setTestStatus('error');
        setToast?.({ message: 'Bridge responded but returned an error', type: 'error' });
      }
    } catch (e) {
      setTestStatus('error');
      setToast?.({ message: `Connection failed: ${e.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const result = await saveHomeProfile(profile);
      if (result.ok) {
        setToast?.({ message: 'Profile saved to bridge!', type: 'success' });
        // Compute weekly cost
        const costResult = await getWeeklyCost();
        if (costResult.ok) {
          setWeeklyCost(costResult);
        }
      } else {
        setToast?.({ message: 'Failed to save profile', type: 'error' });
      }
    } catch (e) {
      setToast?.({ message: `Save failed: ${e.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleComputeCost = async () => {
    setLoading(true);
    try {
      const result = await getWeeklyCost(profile);
      if (result.ok) {
        setWeeklyCost(result);
        setToast?.({ message: 'Weekly cost computed!', type: 'success' });
      } else {
        setToast?.({ message: 'Failed to compute cost', type: 'error' });
      }
    } catch (e) {
      setToast?.({ message: `Compute failed: ${e.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Bridge URL Configuration */}
      <div>
        <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
          Bridge URL
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={bridgeUrl}
            onChange={(e) => setBridgeUrl(e.target.value)}
            placeholder="http://127.0.0.1:8090 or http://bridge.local:8080"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
          />
          <button
            onClick={() => {
              setBridgeBase(bridgeUrl);
              setToast?.({ message: 'Bridge URL saved', type: 'success' });
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors text-sm"
          >
            Save
          </button>
          <button
            onClick={handleTestConnection}
            disabled={loading}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors text-sm disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Test'}
          </button>
        </div>
        {testStatus === 'success' && (
          <div className="mt-2 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>Connected</span>
          </div>
        )}
        {testStatus === 'error' && (
          <div className="mt-2 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span>Connection failed</span>
          </div>
        )}
      </div>

      {/* Home Profile Form */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
          Home Energy Profile
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Send your rates and usage estimates to the Pi bridge for cost calculations on the HMI display.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Electric Rate (¢/kWh)
            </label>
            <input
              type="number"
              min={5}
              max={50}
              step={0.1}
              value={profile.electric_rate_cents_kwh}
              onChange={(e) => setProfile({ ...profile, electric_rate_cents_kwh: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Gas Rate ($/therm)
            </label>
            <input
              type="number"
              min={0.5}
              max={5}
              step={0.01}
              value={profile.gas_rate_per_therm}
              onChange={(e) => setProfile({ ...profile, gas_rate_per_therm: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Weekly kWh (optional)
            </label>
            <input
              type="number"
              min={0}
              max={10000}
              step={1}
              value={profile.weekly_kwh}
              onChange={(e) => setProfile({ ...profile, weekly_kwh: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="Leave 0 for bridge to calculate"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Weekly Therms (optional)
            </label>
            <input
              type="number"
              min={0}
              max={1000}
              step={0.1}
              value={profile.weekly_therms}
              onChange={(e) => setProfile({ ...profile, weekly_therms: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="Leave 0 for bridge to calculate"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Notes (optional)
          </label>
          <input
            type="text"
            value={profile.notes}
            onChange={(e) => setProfile({ ...profile, notes: e.target.value })}
            placeholder="e.g., '3-ton HP, 92% AFUE furnace'"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
          />
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSaveProfile}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Save to Bridge
          </button>
          <button
            onClick={handleComputeCost}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            <DollarSign className="w-4 h-4" />
            Compute Weekly Cost
          </button>
        </div>

        {weeklyCost && (
          <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
            <h4 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2">
              Weekly Cost Estimate
            </h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs text-green-700 dark:text-green-300">Electric</div>
                <div className="text-lg font-bold text-green-900 dark:text-green-100">
                  ${weeklyCost.electric_cost_usd?.toFixed(2) || '0.00'}
                </div>
              </div>
              <div>
                <div className="text-xs text-green-700 dark:text-green-300">Gas</div>
                <div className="text-lg font-bold text-green-900 dark:text-green-100">
                  ${weeklyCost.gas_cost_usd?.toFixed(2) || '0.00'}
                </div>
              </div>
              <div>
                <div className="text-xs text-green-700 dark:text-green-300">Total</div>
                <div className="text-xl font-bold text-green-900 dark:text-green-100">
                  ${weeklyCost.total_usd?.toFixed(2) || '0.00'}
                </div>
              </div>
            </div>
            {weeklyCost.inputs && (
              <div className="mt-3 text-xs text-green-700 dark:text-green-300">
                Based on: {weeklyCost.inputs.weekly_kwh?.toFixed(0) || 0} kWh @ {weeklyCost.inputs.electric_rate_cents_kwh?.toFixed(1)}¢/kWh, {weeklyCost.inputs.weekly_therms?.toFixed(1) || 0} therms @ ${weeklyCost.inputs.gas_rate_per_therm?.toFixed(2)}/therm
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg text-xs">
        <p className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
          💡 How it works:
        </p>
        <ul className="space-y-1 text-blue-700 dark:text-blue-300 ml-4 list-disc">
          <li>Enter your utility rates and optionally your weekly usage</li>
          <li>Click "Save to Bridge" to send data to your Pi</li>
          <li>The bridge stores this data and can compute weekly/monthly costs</li>
          <li>Your Pi E-Ink HMI can display cost estimates on its status screen</li>
          <li>All data stays local on your network—never sent to the cloud</li>
        </ul>
      </div>
    </div>
  );
}
