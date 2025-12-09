/**
 * UpgradeModal - Equipment Upgrade Comparison Modal
 * Extracted from SevenDayCostForecaster for maintainability
 */
import React from "react";

const UpgradeModal = ({
  show,
  onClose,
  upgradeScenario,
  currentSystem = {},
}) => {
  if (!show || !upgradeScenario) return null;

  const { capacity, tons, efficiency } = currentSystem;

  // Calculate annual metrics
  const currentAnnualCost = upgradeScenario.currentCost * (365 / 7);
  const upgradedAnnualCost = upgradeScenario.upgradedCost * (365 / 7);
  const annualSavings = currentAnnualCost - upgradedAnnualCost;
  const percentageReduction =
    currentAnnualCost > 0 ? (annualSavings / currentAnnualCost) * 100 : 0;
  const UPGRADE_COST_PER_TON = 3500;
  const estimatedUpgradeCost = (upgradeScenario.tons || 1) * UPGRADE_COST_PER_TON;
  const paybackYears =
    annualSavings > 0 ? estimatedUpgradeCost / annualSavings : null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2
              id="upgrade-modal-title"
              className="text-2xl font-bold text-gray-800 dark:text-gray-100"
            >
              Upgrade Scenario Comparison
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              &times;
            </button>
          </div>

          {/* System Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Current System Card */}
            <div className="border-2 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-4">
              <h3 className="font-semibold text-gray-700 dark:text-gray-100 mb-2">
                Current System
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Capacity:{" "}
                <span className="font-bold">
                  {capacity}k BTU ({tons} tons)
                </span>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Efficiency: <span className="font-bold">{efficiency} SEER2</span>
              </p>
              <div className="mt-3 pt-3 border-t dark:border-gray-600">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  ${upgradeScenario.currentCost.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  7-day cost
                </p>
              </div>
            </div>

            {/* Upgraded System Card */}
            <div className="border-2 border-purple-400 dark:border-purple-700 bg-purple-50 dark:bg-purple-900 rounded-lg p-4">
              <h3 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">
                Upgraded System
              </h3>
              <p className="text-sm text-purple-700 dark:text-purple-200">
                Capacity:{" "}
                <span className="font-bold">
                  {upgradeScenario.capacity}k BTU ({upgradeScenario.tons} tons)
                </span>
              </p>
              <p className="text-sm text-purple-700 dark:text-purple-200">
                Efficiency:{" "}
                <span className="font-bold">
                  {upgradeScenario.efficiency} SEER2
                </span>
              </p>
              <div className="mt-3 pt-3 border-t border-purple-300 dark:border-purple-600">
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-200">
                  ${upgradeScenario.upgradedCost.toFixed(2)}
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-300">
                  7-day cost
                </p>
              </div>
            </div>
          </div>

          {/* Annual Savings - Primary KPI */}
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg p-6 mb-4 text-center">
            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
              Projected Annual Savings
            </h4>
            <p className="text-6xl font-extrabold text-green-700 dark:text-green-200 my-2">
              ${Math.max(0, Math.round(annualSavings))}
            </p>
            <p className="text-sm text-green-600 dark:text-green-200 mb-3">
              That's a{" "}
              {percentageReduction ? `${percentageReduction.toFixed(0)}%` : "—"}{" "}
              reduction in yearly costs
            </p>
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Estimated Payback Period
                </p>
                <p className="font-semibold text-gray-700 dark:text-gray-100">
                  {paybackYears && isFinite(paybackYears)
                    ? `${Math.round(paybackYears)} years`
                    : "—"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Upgrade Cost Estimate
                </p>
                <p className="font-semibold text-gray-700 dark:text-gray-100">
                  ${estimatedUpgradeCost.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Annual Cost Comparison */}
          <div className="p-6">
            <h4 className="font-semibold text-gray-700 dark:text-white mb-4 text-center">
              Annual Cost Comparison
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-center p-4 border rounded-lg dark:border-gray-700">
                <p className="font-semibold">Current System</p>
                <p className="text-xs text-gray-500 mt-1">
                  {capacity}k BTU ({tons} tons) · {efficiency} SEER2
                </p>
                <p className="text-2xl font-bold mt-2">
                  ${Math.round(currentAnnualCost).toLocaleString()}/yr
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  ${upgradeScenario.currentCost.toFixed(2)}/week
                </p>
              </div>

              <div className="text-center p-4 border rounded-lg dark:border-gray-700 bg-purple-50 dark:bg-purple-900/30">
                <p className="font-semibold text-purple-700 dark:text-purple-300">
                  Upgraded System
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                  {upgradeScenario.capacity}k BTU ({upgradeScenario.tons} tons) ·{" "}
                  {upgradeScenario.efficiency} SEER2
                </p>
                <p className="text-2xl font-bold mt-2">
                  ${Math.round(upgradedAnnualCost).toLocaleString()}/yr
                </p>
                <p className="text-xs text-purple-600 mt-1">
                  ${upgradeScenario.upgradedCost.toFixed(2)}/week
                </p>
              </div>
            </div>

            {/* Weekly Details */}
            {upgradeScenario.metrics && (
              <div className="mt-4 text-sm text-gray-700 dark:text-white">
                <h5 className="font-semibold mb-2">
                  Upgraded System Summary (weekly)
                </h5>
                <p>
                  Total Energy:{" "}
                  <span className="font-bold">
                    {upgradeScenario.metrics.summary
                      .reduce((acc, d) => acc + d.energyWithAux, 0)
                      .toFixed(1)}{" "}
                    kWh
                  </span>
                </p>
                <p>
                  Aux Heat Energy:{" "}
                  <span className="font-bold">
                    {upgradeScenario.metrics.summary
                      .reduce((acc, d) => acc + d.auxEnergy, 0)
                      .toFixed(1)}{" "}
                    kWh
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Disclaimers */}
          <div className="mt-6 pt-4 border-t">
            <p className="text-xs text-gray-500 italic">
              Note: Savings estimate based on current 7-day forecast. Actual
              savings vary with weather, usage patterns, and installation
              quality. Consult a qualified HVAC professional for detailed
              assessment and installation costs.
            </p>
            <p className="text-xs text-gray-500 italic mt-2">
              *Estimated payback uses an assumed upgrade cost of $3,500 per ton.
              Actual installation costs vary widely by location and installer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;

