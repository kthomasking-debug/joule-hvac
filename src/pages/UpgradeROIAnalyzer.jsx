import React from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import ComparisonCard from '../components/ComparisonCard';
import BundleUpgradesRecommender from '../components/BundleUpgradesRecommender';
import { computeRoi } from '../lib/roiUtils';
import { estimateAnnualCostReal as estimateAnnualCost } from '../lib/annualAdapter';

const currency = (v) => `$${(v ?? 0).toFixed(0)}`;


export default function UpgradeROIAnalyzer() {
  const outlet = useOutletContext() || {};
  const settings = outlet.userSettings || (typeof outlet.primarySystem !== 'undefined' ? { ...outlet } : {});
  const resultsHistory = (() => {
    try { return JSON.parse(localStorage.getItem('spa_resultsHistory') || '[]'); } catch { return []; }
  })();
  const latestAnalysis = resultsHistory.length ? resultsHistory[resultsHistory.length - 1] : null;
  const userLocation = (() => { try { return JSON.parse(localStorage.getItem('userLocation') || 'null'); } catch { return null; } })();

  const [upgradeType, setUpgradeType] = React.useState('hvac');
  const [upgradeCost, setUpgradeCost] = React.useState(8000);
  const [hspf2, setHspf2] = React.useState(settings.hspf2 || 9);
  const [seer2, setSeer2] = React.useState(settings.efficiency || 15);
  const [improvementLevel, setImprovementLevel] = React.useState('good');
  const [discountRate, setDiscountRate] = React.useState(0.05);
  const [showBundles, setShowBundles] = React.useState(true);

  const baseline = React.useMemo(() => estimateAnnualCost(settings, userLocation, latestAnalysis), [settings, userLocation, latestAnalysis]);

  const scenarioSettings = React.useMemo(() => {
    const s = { ...settings };
    if (upgradeType === 'hvac') {
      s.hspf2 = hspf2;
      s.efficiency = seer2;
    } else {
      // Envelope improvements modeled as insulation/home shape multipliers
      const factors = improvementLevel === 'excellent' ? { ins: 0.75, shape: 0.95, solar: 0.92 } : { ins: 0.85, shape: 0.97, solar: 0.96 };
      s.insulationLevel = (settings.insulationLevel || 1.0) * factors.ins;
      s.homeShape = (settings.homeShape || 1.0) * factors.shape;
      s.solarExposure = (settings.solarExposure || 1.0) * (factors.solar || 1.0);
    }
    return s;
  }, [upgradeType, hspf2, seer2, improvementLevel, settings]);

  const upgraded = React.useMemo(() => estimateAnnualCost(scenarioSettings, userLocation, latestAnalysis), [scenarioSettings, userLocation, latestAnalysis]);

  const annualSavings = baseline && upgraded ? Math.max(0, baseline.total - upgraded.total) : 0;
  const { payback, npv, roi10 } = computeRoi(Number(upgradeCost) || 0, annualSavings, 10, discountRate);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 data-testid="roi-heading" className="text-3xl font-bold text-gray-900 dark:text-white">Upgrade ROI Analyzer</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Simulate upgrades and see annual savings, payback, and 10-year ROI.</p>
        </div>
        <button
          onClick={() => setShowBundles(!showBundles)}
          className="btn btn-outline px-4 py-2"
        >
          {showBundles ? 'Hide Bundles' : 'Show Bundles'}
        </button>
      </div>

      {/* Bundle Recommendations */}
      {showBundles && (
        <div className="mb-8">
          <BundleUpgradesRecommender
            userSettings={settings}
            userLocation={userLocation}
            latestAnalysis={latestAnalysis}
            onSelectBundle={(bundle) => {
              // Auto-fill form with bundle details
              if (bundle.upgrades.find(u => u.type === 'hvac')) {
                setUpgradeType('hvac');
                const hvacUpgrade = bundle.upgrades.find(u => u.type === 'hvac');
                if (hvacUpgrade.hspf2) setHspf2(hvacUpgrade.hspf2);
                if (hvacUpgrade.seer2) setSeer2(hvacUpgrade.seer2);
              } else {
                setUpgradeType('insulation');
              }
              setUpgradeCost(bundle.totalCost);
              setShowBundles(false);
            }}
          />
        </div>
      )}

      {/* Individual Upgrade Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-6 space-y-4">
          <div>
            <label htmlFor="upgrade-type" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Upgrade Type</label>
            <select id="upgrade-type" name="upgradeType" className="w-full p-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700" value={upgradeType} onChange={(e) => setUpgradeType(e.target.value)}>
              <option value="hvac">New Heat Pump / A/C</option>
              <option value="insulation">Attic Insulation</option>
              <option value="windows">New Windows</option>
              <option value="airsealing">Air Sealing</option>
            </select>
          </div>
          <div>
            <label htmlFor="upgrade-cost" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Upgrade Cost</label>
            <input id="upgrade-cost" name="cost" type="number" className="w-full p-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700" value={upgradeCost} onChange={(e) => setUpgradeCost(Number(e.target.value))} />
          </div>
          {upgradeType === 'hvac' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="hspf2" className="block text-xs font-semibold text-gray-700 dark:text-gray-300">HSPF2</label>
                <input id="hspf2" name="hspf2" type="number" step="0.5" className="w-full p-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700" value={hspf2} onChange={(e) => setHspf2(Number(e.target.value))} />
              </div>
              <div>
                <label htmlFor="seer2" className="block text-xs font-semibold text-gray-700 dark:text-gray-300">SEER2</label>
                <input id="seer2" name="seer2" type="number" step="0.5" className="w-full p-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700" value={seer2} onChange={(e) => setSeer2(Number(e.target.value))} />
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="improvement-level" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Improvement Level</label>
              <select id="improvement-level" name="improvementLevel" className="w-full p-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700" value={improvementLevel} onChange={(e) => setImprovementLevel(e.target.value)}>
                <option value="good">Good (typical upgrade)</option>
                <option value="excellent">Excellent (aggressive upgrade)</option>
              </select>
            </div>
          )}
          <div>
            <label htmlFor="discount-rate" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Discount Rate</label>
            <input id="discount-rate" name="discountRate" type="number" step="0.01" min="0" max="0.2" className="w-full p-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700" value={discountRate} onChange={(e) => setDiscountRate(Number(e.target.value))} />
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Assumptions are simplified for MVP and can be tuned later.</div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <ComparisonCard
            title="Annual Energy Cost"
            left={{ label: 'Current', value: baseline ? currency(baseline.total) : '—' }}
            right={{ label: 'With Upgrade', value: upgraded ? currency(upgraded.total) : '—' }}
            deltaLabel="Annual Savings"
            deltaValue={baseline && upgraded ? currency(Math.max(0, baseline.total - upgraded.total)) : undefined}
          />
          {baseline && upgraded && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700 dark:text-gray-300">
              <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-4">
                <div className="font-semibold mb-1">Current breakdown</div>
                <div data-testid="breakdown-heating-current">Heating: {currency(baseline.heating)}</div>
                <div data-testid="breakdown-cooling-current">Cooling: {currency(baseline.cooling)}</div>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-4">
                <div className="font-semibold mb-1">With upgrade</div>
                <div data-testid="breakdown-heating-upgrade">Heating: {currency(upgraded.heating)}</div>
                <div data-testid="breakdown-cooling-upgrade">Cooling: {currency(upgraded.cooling)}</div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div data-testid="metric-payback" className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-4 text-center">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Payback</div>
              <div className="text-2xl font-extrabold text-gray-900 dark:text-white">{isFinite(payback) ? `${payback.toFixed(1)} yrs` : '—'}</div>
            </div>
            <div data-testid="metric-roi10" className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-4 text-center">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">10-Year ROI</div>
              <div className="text-2xl font-extrabold text-gray-900 dark:text-white">{currency(roi10)}</div>
            </div>
            <div data-testid="metric-npv10" className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-4 text-center">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">NPV (10y)</div>
              <div className="text-2xl font-extrabold text-gray-900 dark:text-white">{currency(npv)}</div>
            </div>
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400">
            Baseline uses your current settings{latestAnalysis?.heatLossFactor ? ' and measured Thermal Factor' : ''}. Calculations are estimates and exclude maintenance and equipment degradation.
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Link to="/" className="btn btn-outline px-4 py-2">← Back to Dashboard</Link>
      </div>
    </div>
  );
}
