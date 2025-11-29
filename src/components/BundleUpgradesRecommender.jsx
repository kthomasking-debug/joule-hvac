import React, { useMemo } from 'react';
import { TrendingUp, Package, DollarSign, Calendar, Zap } from 'lucide-react';
import { computeRoi } from '../lib/roiUtils';
import { estimateAnnualCostReal as estimateAnnualCost } from '../lib/annualAdapter';

const currency = (v) => `$${(v ?? 0).toFixed(0)}`;

// Define upgrade bundles with typical costs and efficiency gains
const UPGRADE_BUNDLES = {
  starter: {
    name: 'Starter Bundle',
    description: 'Quick wins for immediate savings',
    upgrades: [
      { type: 'airsealing', name: 'Air Sealing', cost: 1500, insulationFactor: 0.92 },
      { type: 'thermostat', name: 'Smart Thermostat', cost: 250, tempAdjust: -1 }
    ],
    totalCost: 1750,
    icon: '🌱'
  },
  comfort: {
    name: 'Comfort Bundle',
    description: 'Balance efficiency and comfort',
    upgrades: [
      { type: 'insulation', name: 'Attic Insulation R-49', cost: 2500, insulationFactor: 0.82 },
      { type: 'airsealing', name: 'Air Sealing', cost: 1500, insulationFactor: 0.92 },
      { type: 'ductseal', name: 'Duct Sealing', cost: 800, heatLossFactor: 0.95 }
    ],
    totalCost: 4800,
    icon: '🏠'
  },
  premium: {
    name: 'Premium Bundle',
    description: 'Maximum efficiency upgrade',
    upgrades: [
      { type: 'hvac', name: 'High-Efficiency Heat Pump', cost: 12000, hspf2: 10.5, seer2: 20 },
      { type: 'insulation', name: 'Full Envelope Insulation', cost: 5000, insulationFactor: 0.75 },
      { type: 'windows', name: 'Triple-Pane Windows', cost: 8000, insulationFactor: 0.88, homeShape: 0.93 }
    ],
    totalCost: 25000,
    icon: '⚡'
  },
  hvacPlus: {
    name: 'HVAC+ Bundle',
    description: 'New system + envelope improvements',
    upgrades: [
      { type: 'hvac', name: 'Mid-Range Heat Pump', cost: 8500, hspf2: 9.5, seer2: 18 },
      { type: 'insulation', name: 'Attic Insulation', cost: 2500, insulationFactor: 0.82 },
      { type: 'airsealing', name: 'Air Sealing', cost: 1500, insulationFactor: 0.92 },
      { type: 'ductseal', name: 'Duct Sealing', cost: 800, heatLossFactor: 0.95 }
    ],
    totalCost: 13300,
    icon: '🔥'
  }
};

/**
 * Calculate combined impact of multiple upgrades
 * Applies upgrades sequentially with compounding effects
 */
function calculateBundleImpact(settings, upgrades) {
  let modifiedSettings = { ...settings };
  
  upgrades.forEach(upgrade => {
    if (upgrade.hspf2) modifiedSettings.hspf2 = upgrade.hspf2;
    if (upgrade.seer2) modifiedSettings.efficiency = upgrade.seer2;
    if (upgrade.insulationFactor) {
      modifiedSettings.insulationLevel = (modifiedSettings.insulationLevel || 1.0) * upgrade.insulationFactor;
    }
    if (upgrade.homeShape) {
      modifiedSettings.homeShape = (modifiedSettings.homeShape || 1.0) * upgrade.homeShape;
    }
    if (upgrade.heatLossFactor) {
      // Heat loss factor improvement (applied to analysis factor if available)
      modifiedSettings._heatLossMultiplier = (modifiedSettings._heatLossMultiplier || 1.0) * upgrade.heatLossFactor;
    }
    if (upgrade.tempAdjust) {
      modifiedSettings.winterThermostat = (modifiedSettings.winterThermostat || 70) + upgrade.tempAdjust;
      modifiedSettings.summerThermostat = (modifiedSettings.summerThermostat || 74) - upgrade.tempAdjust;
    }
  });
  
  return modifiedSettings;
}

export default function BundleUpgradesRecommender({ userSettings, userLocation, latestAnalysis, onSelectBundle }) {
  const baseline = useMemo(
    () => estimateAnnualCost(userSettings, userLocation, latestAnalysis),
    [userSettings, userLocation, latestAnalysis]
  );

  const bundleResults = useMemo(() => {
    if (!baseline) return [];

    return Object.entries(UPGRADE_BUNDLES).map(([key, bundle]) => {
      const upgradedSettings = calculateBundleImpact(userSettings, bundle.upgrades);
      const upgraded = estimateAnnualCost(upgradedSettings, userLocation, latestAnalysis);
      const annualSavings = baseline && upgraded ? Math.max(0, baseline.total - upgraded.total) : 0;
      const { payback, npv, roi10 } = computeRoi(bundle.totalCost, annualSavings, 10, 0.05);

      return {
        key,
        bundle,
        annualSavings,
        payback,
        npv,
        roi10,
        upgradedCost: upgraded?.total || 0,
        baselineCost: baseline?.total || 0
      };
    });
  }, [userSettings, userLocation, latestAnalysis, baseline]);

  // Sort by ROI (best first)
  const sortedResults = [...bundleResults].sort((a, b) => b.roi10 - a.roi10);

  if (!baseline) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-6">
        <p className="text-yellow-800 dark:text-yellow-200">
          Complete your settings and run an analysis to see bundle upgrade recommendations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border-2 border-purple-200 dark:border-purple-700 p-6">
        <div className="flex items-center gap-3 mb-3">
          <Package size={28} className="text-purple-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Bundle Upgrades</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Maximize savings by combining complementary upgrades
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Current Annual Cost</span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">{currency(baseline.total)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sortedResults.map(({ key, bundle, annualSavings, payback, npv, roi10, upgradedCost }) => (
          <div
            key={key}
            className="bg-white dark:bg-gray-900 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 transition-all shadow-lg hover:shadow-xl cursor-pointer"
            onClick={() => onSelectBundle && onSelectBundle(bundle)}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{bundle.icon}</span>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{bundle.name}</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{bundle.description}</p>
                  </div>
                </div>
                {roi10 > 0 && (
                  <div className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded-full text-xs font-bold">
                    {roi10.toFixed(0)}% ROI
                  </div>
                )}
              </div>

              {/* Upgrade Items */}
              <div className="space-y-1 mb-4 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                {bundle.upgrades.map((upgrade, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-gray-700 dark:text-gray-300">{upgrade.name}</span>
                    <span className="text-gray-500 dark:text-gray-400">{currency(upgrade.cost)}</span>
                  </div>
                ))}
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mb-1">
                    <DollarSign size={12} />
                    <span>Total Cost</span>
                  </div>
                  <div className="text-lg font-bold text-blue-900 dark:text-blue-200">{currency(bundle.totalCost)}</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mb-1">
                    <TrendingUp size={12} />
                    <span>Annual Savings</span>
                  </div>
                  <div className="text-lg font-bold text-green-900 dark:text-green-200">{currency(annualSavings)}</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 mb-1">
                    <Calendar size={12} />
                    <span>Payback</span>
                  </div>
                  <div className="text-lg font-bold text-purple-900 dark:text-purple-200">
                    {payback < 100 ? `${payback.toFixed(1)} yrs` : 'N/A'}
                  </div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 mb-1">
                    <Zap size={12} />
                    <span>New Annual</span>
                  </div>
                  <div className="text-lg font-bold text-orange-900 dark:text-orange-200">{currency(upgradedCost)}</div>
                </div>
              </div>

              {/* 10-Year NPV */}
              {npv > 0 && (
                <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">10-Year Net Present Value</div>
                  <div className="text-xl font-black text-green-700 dark:text-green-300">+{currency(npv)}</div>
                </div>
              )}

              {/* Action Button */}
              <button
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectBundle && onSelectBundle(bundle);
                }}
              >
                Explore This Bundle →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison Summary */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Bundle Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="text-left py-2 font-semibold text-gray-700 dark:text-gray-300">Bundle</th>
                <th className="text-right py-2 font-semibold text-gray-700 dark:text-gray-300">Cost</th>
                <th className="text-right py-2 font-semibold text-gray-700 dark:text-gray-300">Annual Savings</th>
                <th className="text-right py-2 font-semibold text-gray-700 dark:text-gray-300">Payback</th>
                <th className="text-right py-2 font-semibold text-gray-700 dark:text-gray-300">10-Yr ROI</th>
              </tr>
            </thead>
            <tbody>
              {sortedResults.map(({ key, bundle, annualSavings, payback, roi10 }) => (
                <tr key={key} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="py-3">
                    <span className="mr-2">{bundle.icon}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{bundle.name}</span>
                  </td>
                  <td className="text-right text-gray-700 dark:text-gray-300">{currency(bundle.totalCost)}</td>
                  <td className="text-right text-green-600 dark:text-green-400 font-semibold">{currency(annualSavings)}</td>
                  <td className="text-right text-gray-700 dark:text-gray-300">
                    {payback < 100 ? `${payback.toFixed(1)} yrs` : 'N/A'}
                  </td>
                  <td className="text-right font-bold text-gray-900 dark:text-white">{roi10.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
