// src/components/UpgradeROICalculator.jsx
import React, { useState, useMemo } from 'react';
import { UPGRADE_SCENARIOS, compareScenarios } from '../lib/upgrades/roiCalculator';
import { DollarSign, TrendingUp, Calendar, Zap } from 'lucide-react';

export default function UpgradeROICalculator() {
  const [selectedScenarios, setSelectedScenarios] = useState(['heatPump', 'insulation']);
  const [customInputs] = useState({});

  const availableScenarios = Object.keys(UPGRADE_SCENARIOS);

  const comparison = useMemo(() => {
    return compareScenarios(selectedScenarios, customInputs);
  }, [selectedScenarios, customInputs]);

  const handleToggleScenario = (key) => {
    setSelectedScenarios(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
        <TrendingUp className="inline mr-2" size={24} />
        Upgrade ROI Calculator
      </h2>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        Compare payback and lifetime savings for energy efficiency upgrades. Select scenarios to compare side-by-side.
      </p>

      {/* Scenario Selector */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-200">Select Upgrades to Compare</h3>
        <div className="flex flex-wrap gap-2">
          {availableScenarios.map(key => (
            <button
              key={key}
              onClick={() => handleToggleScenario(key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedScenarios.includes(key)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
              }`}
            >
              {UPGRADE_SCENARIOS[key].name}
            </button>
          ))}
        </div>
      </div>

      {/* Comparison Table */}
      {selectedScenarios.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300 dark:border-gray-700">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Upgrade</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Upfront Cost</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Rebates</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Net Cost</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Annual Savings</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Payback (yrs)</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Lifetime ROI</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((scenario, idx) => (
                <tr key={scenario.key} className={idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-750'}>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-gray-800 dark:text-gray-100">{scenario.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{scenario.description}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">${scenario.upfrontCost.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-green-600 dark:text-green-400">-${scenario.totalRebates.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-800 dark:text-gray-100">${scenario.netCost.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">${scenario.annualSavings.toLocaleString()}/yr</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={scenario.simplePayback < 10 ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-gray-700 dark:text-gray-300'}>
                      {scenario.simplePayback} yrs
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={scenario.roi > 100 ? 'text-green-600 dark:text-green-400 font-bold' : 'text-gray-700 dark:text-gray-300'}>
                      {scenario.roi}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Custom Input Panel (Optional Enhancement) */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
        <p className="text-sm text-blue-800 dark:text-blue-200 flex items-center">
          <Zap size={16} className="mr-2" />
          <strong>Tip:</strong> Default values are based on national averages. Future updates will allow custom inputs for your specific situation.
        </p>
      </div>
    </div>
  );
}
