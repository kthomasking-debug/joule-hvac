import React, { useState } from 'react';
import { Zap, TrendingDown, Info } from 'lucide-react';
import { APPLIANCE_PROFILES, getAllAppliancesCost } from '../lib/appliances/applianceDetective';

export default function ApplianceDetective({ utilityCost = 0.15 }) {
  const [customInputs, setCustomInputs] = useState({});
  const [selectedAppliance, setSelectedAppliance] = useState(null);

  const allCosts = getAllAppliancesCost(
    Object.fromEntries(
      Object.entries(customInputs).map(([key, val]) => [key, { ...val, utilityCost }])
    )
  );

  const handleInputChange = (applianceKey, field, value) => {
    setCustomInputs(prev => ({
      ...prev,
      [applianceKey]: {
        ...prev[applianceKey],
        [field]: parseFloat(value) || 0,
      },
    }));
  };

  const bigHogThreshold = 100;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
        <Zap className="text-amber-600" size={20} />
        Appliance Energy Detective
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Estimate energy costs for major appliances. Adjust usage hours to see personalized estimates.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        {allCosts.appliances.map(({ key, applianceName, annualCost, annualKwh }) => (
          <div role="button"
            key={key}
            onClick={() => setSelectedAppliance(selectedAppliance === key ? null : key)}
            className={`p-4 border rounded-lg text-left transition-all ${
              selectedAppliance === key
                ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-600'
            } ${annualCost > bigHogThreshold ? 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/20' : ''}`}
          >
            <div className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{applianceName}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">{annualKwh} kWh/yr</div>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">
              ${annualCost}/yr
            </div>
            {annualCost > bigHogThreshold && (
              <div className="mt-2 text-xs text-red-600 font-semibold">Big energy hog</div>
            )}
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setSelectedAppliance(key); /* Could open 'Smart Upgrade' modal */ }}
                className="px-2 py-1 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-500"
              >Smart Upgrade</button>
            </div>
          </div>
        ))}
      </div>

      {selectedAppliance && (
        <div className="border border-amber-200 dark:border-amber-700 rounded-lg p-4 bg-amber-50 dark:bg-amber-900/20 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Customize {APPLIANCE_PROFILES[selectedAppliance].name}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                Watts
              </label>
              <input
                type="number"
                placeholder={APPLIANCE_PROFILES[selectedAppliance].avgWatts}
                value={customInputs[selectedAppliance]?.watts || ''}
                onChange={(e) => handleInputChange(selectedAppliance, 'watts', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                Hours/Day
              </label>
              <input
                type="number"
                step="0.1"
                placeholder={APPLIANCE_PROFILES[selectedAppliance].avgHoursPerDay}
                value={customInputs[selectedAppliance]?.hoursPerDay || ''}
                onChange={(e) => handleInputChange(selectedAppliance, 'hoursPerDay', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Total Appliance Cost</span>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            ${allCosts.totalAnnualCost}/year
          </span>
        </div>
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg text-sm flex items-start gap-2">
          <Info className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
          <div className="text-gray-700 dark:text-gray-300">
            <strong>Tip:</strong> Water heater and dryer are often the biggest energy users. Consider heat pump versions for 50-70% savings.
          </div>
        </div>
      </div>
    </div>
  );
}
