import React, { useState, useMemo, useEffect } from 'react';
import { FileText, AlertTriangle, Zap, TrendingDown, TrendingUp, Lightbulb, CheckCircle2, Calendar, BarChart3 } from 'lucide-react';
import { getCached, setCached } from '../utils/cachedStorage';
import { TYPICAL_HDD, TYPICAL_CDD } from '../lib/budgetUtils';
import { recordMonth, loadHistory } from '../lib/history/historyEngine';

/**
 * Bill Calibration - "Truth Serum"
 * 
 * Compares actual utility bills to physics simulation to identify:
 * - Hidden loads (Tesla charger, hot tub, gaming PC farm)
 * - Thermostat setting differences
 * - Broken equipment (heat pump running on aux)
 * - Other energy leaks
 */
export default function BillCalibration({ 
  annualEstimate, 
  userSettings = {},
  userLocation = null 
}) {
  const [billMonth, setBillMonth] = useState(() => {
    const now = new Date();
    return now.getMonth() + 1; // 1-12
  });
  const [actualKwh, setActualKwh] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [saved, setSaved] = useState(false);
  const [billHistory, setBillHistory] = useState([]);

  // Load bill history from history engine
  useEffect(() => {
    const history = loadHistory();
    // Filter and format bills for display
    const bills = history
      .filter(h => h.actualKwh !== undefined && h.actualKwh !== null)
      .sort((a, b) => {
        const dateA = new Date(a.year, a.month - 1);
        const dateB = new Date(b.year, b.month - 1);
        return dateB - dateA; // Most recent first
      })
      .slice(0, 6); // Last 6 months
    
    setBillHistory(bills);
  }, [saved]);

  // Load saved bill data for current month
  const savedBill = useMemo(() => {
    try {
      const history = loadHistory();
      const now = new Date();
      const currentYear = now.getFullYear();
      const monthKey = `${currentYear}-${String(billMonth).padStart(2, '0')}`;
      return history.find(h => h.key === monthKey && h.actualKwh !== undefined) || null;
    } catch {
      return null;
    }
  }, [billMonth]);

  // Calculate expected monthly usage from annual estimate using HDD/CDD seasonal ratios
  // "The HDD Curve" approach: Use monthly HDD/CDD ratios to proportionally distribute annual estimates
  const expectedMonthly = useMemo(() => {
    if (!annualEstimate) return null;
    
    const utilityCost = userSettings.utilityCost || 0.15;
    
    // Get annual heating and cooling energy in kWh
    const annualHeatingKwh = annualEstimate.heatingCost / utilityCost;
    const annualCoolingKwh = annualEstimate.coolingCost / utilityCost;
    
    // Calculate total annual HDD/CDD from typical distribution pattern
    // This represents the typical seasonal distribution curve
    const totalTypicalHDD = Object.values(TYPICAL_HDD).reduce((sum, hdd) => sum + hdd, 0);
    const totalTypicalCDD = Object.values(TYPICAL_CDD).reduce((sum, cdd) => sum + cdd, 0);
    
    // Get this month's HDD/CDD values (billMonth is 1-12)
    const monthHDD = TYPICAL_HDD[billMonth] || 0;
    const monthCDD = TYPICAL_CDD[billMonth] || 0;
    
    // Calculate the ratio: this month's share of annual heating/cooling
    // Example: January HDD (750) / Total Annual HDD (3000) = 25% of annual heating
    const heatingRatio = totalTypicalHDD > 0 ? monthHDD / totalTypicalHDD : 0;
    const coolingRatio = totalTypicalCDD > 0 ? monthCDD / totalTypicalCDD : 0;
    
    // Apply ratios to annual estimates
    // Example: Annual heating (5000 kWh) × 25% = 1250 kWh for January
    const monthlyHeatingKwh = annualHeatingKwh * heatingRatio;
    const monthlyCoolingKwh = annualCoolingKwh * coolingRatio;
    
    // Base load (non-HVAC appliances, lighting, etc.) - distribute evenly across months
    // Calculate as remainder after HVAC: annual total - (heating + cooling)
    const annualTotalKwh = annualEstimate.totalEnergy || 
      (annualHeatingKwh + annualCoolingKwh) * 1.15; // Add 15% for base load if not available
    
    const annualBaseLoadKwh = annualTotalKwh - annualHeatingKwh - annualCoolingKwh;
    const monthlyBaseLoadKwh = Math.max(0, annualBaseLoadKwh / 12);
    
    // Total monthly estimate = seasonal HVAC + base load
    const monthlyTotalKwh = monthlyHeatingKwh + monthlyCoolingKwh + monthlyBaseLoadKwh;
    const monthlyCost = monthlyTotalKwh * utilityCost;
    
    return {
      kwh: monthlyTotalKwh,
      cost: monthlyCost,
      heatingKwh: monthlyHeatingKwh,
      coolingKwh: monthlyCoolingKwh,
      baseLoadKwh: monthlyBaseLoadKwh,
      heatingRatio,
      coolingRatio,
    };
  }, [annualEstimate, userSettings.utilityCost, billMonth]);

  // Calculate gap and diagnosis
  const diagnosis = useMemo(() => {
    if (!actualKwh || !expectedMonthly) return null;
    
    const actual = parseFloat(actualKwh);
    const expected = expectedMonthly.kwh;
    
    if (isNaN(actual) || actual <= 0 || expected <= 0) return null;
    
    const gap = actual - expected;
    const gapPercent = ((actual - expected) / expected) * 100;
    const isSummer = billMonth >= 6 && billMonth <= 8;
    const isWinter = billMonth >= 12 || billMonth <= 2;
    
    // Determine severity
    const isLargeGap = Math.abs(gapPercent) > 30;
    const isMediumGap = Math.abs(gapPercent) > 15;
    
    // Generate diagnosis
    const diagnoses = [];
    const recommendations = [];
    
    if (gap > 0) {
      // Higher than expected
      if (isLargeGap) {
        diagnoses.push({
          type: 'critical',
          title: 'Large Energy Gap Detected',
          message: `Your usage is ${gapPercent.toFixed(0)}% higher than expected.`,
        });
        
        if (isWinter) {
          diagnoses.push({
            type: 'warning',
            title: 'Possible Heat Pump Issue',
            message: 'Your usage is 2x expected during heating season. Your heat pump might be broken and running on resistance heat.',
            action: 'Check the outdoor unit fan - is it spinning?',
          });
          recommendations.push('Check outdoor heat pump unit for proper operation');
          recommendations.push('Verify aux heat is not running unnecessarily');
        } else if (isSummer) {
          diagnoses.push({
            type: 'info',
            title: 'Potential Hidden Loads',
            message: 'You used significantly more energy than AC should need. Possible sources:',
            items: [
              'Pool pump running continuously',
              'Hot tub or spa',
              'Electric vehicle charging',
              'Gaming PC or server farm',
              'Electric water heater issues',
            ],
          });
          recommendations.push('Use smart plugs to identify phantom loads');
          recommendations.push('Check for appliances running 24/7');
        }
      } else if (isMediumGap) {
        diagnoses.push({
          type: 'warning',
          title: 'Moderate Energy Gap',
          message: `You're using ${gap.toFixed(0)} kWh more than expected this month.`,
        });
        
        if (isWinter) {
          recommendations.push('Check thermostat settings - are you keeping it warmer than 70°F?');
          recommendations.push('Review recent temperature settings in your thermostat app');
        } else {
          recommendations.push('Check for seasonal appliances (pool pump, dehumidifier)');
        }
      }
      
      // Always suggest checking thermostat
      if (!recommendations.find(r => r.includes('thermostat'))) {
        diagnoses.push({
          type: 'info',
          title: 'Thermostat Setting Check',
          message: `Your simulation assumed ${isWinter ? userSettings.winterThermostat || 70 : userSettings.summerThermostat || 74}°F. Are you keeping it ${isWinter ? 'warmer' : 'cooler'}?`,
        });
        recommendations.push(`Verify your thermostat matches the ${isWinter ? 'winter' : 'summer'} setting used in estimates`);
      }
      
      // Cost implications
      const costGap = gap * (userSettings.utilityCost || 0.15);
      if (costGap > 20) {
        recommendations.push(`This gap costs approximately $${costGap.toFixed(0)}/month (${gap.toFixed(0)} kWh × $${(userSettings.utilityCost || 0.15).toFixed(2)}/kWh)`);
      }
    } else {
      // Lower than expected
      diagnoses.push({
        type: 'success',
        title: 'Great Efficiency!',
        message: `Your usage is ${Math.abs(gapPercent).toFixed(0)}% lower than expected.`,
      });
      
      if (Math.abs(gapPercent) > 20) {
        recommendations.push('Consider sharing your settings - you may have optimized better than expected!');
      }
    }
    
    return {
      gap,
      gapPercent,
      gapKwh: gap,
      gapCost: gap * (userSettings.utilityCost || 0.15),
      diagnoses,
      recommendations,
      isLargeGap,
      isMediumGap,
    };
  }, [actualKwh, expectedMonthly, billMonth, userSettings]);

  const handleSave = () => {
    if (!actualKwh || !expectedMonthly) return;
    
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Determine year: if month is in the future, use previous year
    let billYear = currentYear;
    if (billMonth > now.getMonth() + 1) {
      billYear = currentYear - 1;
    }
    
    // Save to history engine
    recordMonth(billYear, billMonth, {
      actualKwh: parseFloat(actualKwh),
      actualCost: actualCost ? parseFloat(actualCost) : null,
      predictedCost: expectedMonthly.cost,
      predictedKwh: expectedMonthly.kwh,
      gapKwh: diagnosis?.gap || 0,
      gapPercent: diagnosis?.gapPercent || 0,
      gapCost: diagnosis?.gapCost || 0,
    });
    
    // Also save to cache for quick access
    const billData = {
      month: billMonth,
      year: billYear,
      actualKwh: parseFloat(actualKwh),
      actualCost: actualCost ? parseFloat(actualCost) : null,
      expectedKwh: expectedMonthly.kwh,
      expectedCost: expectedMonthly.cost,
      diagnosis: diagnosis,
      timestamp: new Date().toISOString(),
    };
    
    setCached('billCalibration', billData);
    setSaved(true);
    
    // Refresh history
    const history = loadHistory();
    const bills = history
      .filter(h => h.actualKwh !== undefined && h.actualKwh !== null)
      .sort((a, b) => {
        const dateA = new Date(a.year, a.month - 1);
        const dateB = new Date(b.year, b.month - 1);
        return dateB - dateA;
      })
      .slice(0, 6);
    setBillHistory(bills);
    
    setTimeout(() => {
      setSaved(false);
    }, 2000);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Calculate trend summary from history
  const trendSummary = useMemo(() => {
    if (billHistory.length === 0) return null;
    
    const validBills = billHistory.filter(b => b.gapPercent !== undefined && b.gapPercent !== null);
    if (validBills.length === 0) return null;
    
    const avgGapPercent = validBills.reduce((sum, b) => sum + (b.gapPercent || 0), 0) / validBills.length;
    const avgGapCost = validBills.reduce((sum, b) => sum + (b.gapCost || 0), 0) / validBills.length;
    const monthsWithGap = validBills.filter(b => (b.gapPercent || 0) > 10).length;
    
    return {
      avgGapPercent,
      avgGapCost,
      monthsWithGap,
      totalMonths: validBills.length,
    };
  }, [billHistory]);

  return (
    <div className="glass-card p-glass animate-fade-in-up">
      <div className="flex items-center gap-3 mb-4">
        <div className="icon-container">
          <FileText className="w-5 h-5 text-purple-500" />
        </div>
        <div className="flex-1">
          <h3 className="heading-tertiary">Bill Calibration</h3>
          <p className="text-xs text-muted mt-1">
            Compare your actual bill to physics simulation - find hidden loads and issues
          </p>
        </div>
      </div>

      {/* Bill History Timeline */}
      {billHistory.length > 0 && (
        <div className="mb-6 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-500" />
              <h4 className="font-semibold text-high-contrast">Bill History</h4>
            </div>
            <div className="text-xs text-muted">
              {billHistory.length} month{billHistory.length !== 1 ? 's' : ''} tracked
            </div>
          </div>
          
          <div className="space-y-2 mb-3">
            {billHistory.map((bill) => (
              <div
                key={bill.key}
                className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-high-contrast">
                    {monthNames[bill.month - 1]} {bill.year}
                  </div>
                  <div className="text-xs text-muted">
                    {bill.actualKwh?.toFixed(0) || 0} kWh
                    {bill.actualCost && ` • $${bill.actualCost.toFixed(2)}`}
                  </div>
                </div>
                <div className="text-right">
                  {bill.gapPercent !== undefined && bill.gapPercent !== null && (
                    <div className={`text-sm font-semibold ${
                      bill.gapPercent > 10 
                        ? 'text-red-600 dark:text-red-400'
                        : bill.gapPercent > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      {bill.gapPercent > 0 ? '+' : ''}{bill.gapPercent.toFixed(0)}%
                    </div>
                  )}
                  {bill.gapCost > 0 && (
                    <div className="text-xs text-muted">
                      ~${bill.gapCost.toFixed(0)}/mo
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Trend Summary */}
          {trendSummary && (
            <div className={`mt-3 p-3 rounded-lg border ${
              trendSummary.avgGapPercent > 15
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
                : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-semibold text-high-contrast">Trend Analysis</span>
              </div>
              <div className="text-sm text-muted space-y-1">
                <div>
                  Average gap: <strong className="text-high-contrast">
                    {trendSummary.avgGapPercent > 0 ? '+' : ''}{trendSummary.avgGapPercent.toFixed(0)}%
                  </strong> over {trendSummary.totalMonths} month{trendSummary.totalMonths !== 1 ? 's' : ''}
                </div>
                {trendSummary.avgGapCost > 0 && (
                  <div>
                    Unaccounted energy: <strong className="text-high-contrast">
                      ~${trendSummary.avgGapCost.toFixed(0)}/month
                    </strong>
                  </div>
                )}
                {trendSummary.monthsWithGap > 0 && (
                  <div>
                    {trendSummary.monthsWithGap} of {trendSummary.totalMonths} month{trendSummary.totalMonths !== 1 ? 's' : ''} with gaps &gt;10%
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {!expectedMonthly && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>No estimate available.</strong> Complete your home setup to see expected monthly usage.
              </p>
            </div>
          </div>
        </div>
      )}

      {expectedMonthly && (
        <>
          {/* Input Form */}
          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Bill Month
              </label>
              <select
                value={billMonth}
                onChange={(e) => setBillMonth(Number(e.target.value))}
                className="w-full p-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              >
                {monthNames.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Actual Usage (kWh)
                </label>
                <input
                  type="number"
                  value={actualKwh}
                  onChange={(e) => setActualKwh(e.target.value)}
                  placeholder="800"
                  className="w-full p-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Actual Cost ($)
                  <span className="text-xs font-normal text-gray-500 ml-1">(optional)</span>
                </label>
                <input
                  type="number"
                  value={actualCost}
                  onChange={(e) => setActualCost(e.target.value)}
                  placeholder="120.00"
                  className="w-full p-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
              </div>
            </div>
          </div>

          {/* Comparison Display */}
          {actualKwh && expectedMonthly && diagnosis && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4 bg-gray-50 dark:bg-gray-800/50">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-xs text-muted mb-1">Physics Simulation</div>
                  <div className="text-2xl font-bold text-high-contrast">
                    {expectedMonthly.kwh.toFixed(0)} kWh
                  </div>
                  <div className="text-sm text-muted">
                    ${expectedMonthly.cost.toFixed(2)} estimated
                  </div>
                  <div className="text-xs text-muted mt-1 italic">
                    (Seasonally adjusted for {monthNames[billMonth - 1]})
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted mb-1">Your Actual Bill</div>
                  <div className="text-2xl font-bold text-high-contrast">
                    {parseFloat(actualKwh).toFixed(0)} kWh
                  </div>
                  {actualCost && (
                    <div className="text-sm text-muted">
                      ${parseFloat(actualCost).toFixed(2)}
                    </div>
                  )}
                </div>
              </div>

              {/* Gap Display */}
              <div className={`p-3 rounded-lg ${
                diagnosis.gap > 0 
                  ? diagnosis.isLargeGap 
                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
                    : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700'
                  : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  {diagnosis.gap > 0 ? (
                    diagnosis.isLargeGap ? (
                      <AlertTriangle className="text-red-600 dark:text-red-400" size={18} />
                    ) : (
                      <TrendingUp className="text-amber-600 dark:text-amber-400" size={18} />
                    )
                  ) : (
                    <TrendingDown className="text-green-600 dark:text-green-400" size={18} />
                  )}
                  <span className="font-semibold text-high-contrast">
                    Gap: {diagnosis.gap > 0 ? '+' : ''}{diagnosis.gap.toFixed(0)} kWh
                    {' '}({diagnosis.gapPercent > 0 ? '+' : ''}{diagnosis.gapPercent.toFixed(0)}%)
                  </span>
                </div>
                {diagnosis.gapCost > 0 && (
                  <div className="text-sm text-muted">
                    Unaccounted Energy: ~${diagnosis.gapCost.toFixed(2)}/month
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Diagnoses */}
          {diagnosis && diagnosis.diagnoses && diagnosis.diagnoses.length > 0 && (
            <div className="space-y-3 mb-4">
              {diagnosis.diagnoses.map((diag, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${
                    diag.type === 'critical'
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
                      : diag.type === 'warning'
                      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
                      : diag.type === 'success'
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {diag.type === 'critical' && <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />}
                    {diag.type === 'warning' && <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />}
                    {diag.type === 'success' && <CheckCircle2 className="text-green-600 flex-shrink-0 mt-0.5" size={18} />}
                    {diag.type === 'info' && <Lightbulb className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />}
                    <div className="flex-1">
                      <h4 className="font-semibold text-high-contrast mb-1">
                        {diag.title}
                      </h4>
                      <p className="text-sm text-muted mb-2">{diag.message}</p>
                      {diag.action && (
                        <p className="text-sm font-medium text-high-contrast">{diag.action}</p>
                      )}
                      {diag.items && (
                        <ul className="list-disc list-inside text-sm text-muted mt-2 space-y-1">
                          {diag.items.map((item, itemIdx) => (
                            <li key={itemIdx}>{item}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {diagnosis && diagnosis.recommendations && diagnosis.recommendations.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2 mb-2">
                <Zap className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                    Recommended Actions
                  </h4>
                  <ul className="space-y-1">
                    {diagnosis.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-sm text-blue-800 dark:text-blue-300 flex items-start gap-2">
                        <span className="text-blue-600 mt-1">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          {actualKwh && (
            <button
              onClick={handleSave}
              className={`w-full px-4 py-2 rounded-lg font-semibold transition-colors ${
                saved
                  ? 'bg-green-600 text-white'
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              {saved ? '✓ Saved!' : 'Save Bill Data'}
            </button>
          )}
        </>
      )}

      {/* Saved Bill Display */}
      {savedBill && !actualKwh && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-muted mb-2">Last saved bill:</div>
          <div className="text-sm">
            <strong>{monthNames[savedBill.month - 1]}:</strong> {savedBill.actualKwh.toFixed(0)} kWh
            {' '}(Gap: {savedBill.diagnosis?.gapPercent > 0 ? '+' : ''}{savedBill.diagnosis?.gapPercent.toFixed(0)}%)
          </div>
          <button
            onClick={() => {
              setBillMonth(savedBill.month);
              setActualKwh(savedBill.actualKwh.toString());
              if (savedBill.actualCost) setActualCost(savedBill.actualCost.toString());
            }}
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            Load this data
          </button>
        </div>
      )}
    </div>
  );
}

