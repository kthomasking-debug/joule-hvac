// src/components/optimization/ForecastAccuracyCard.jsx
// Track and display forecast accuracy over time

import React, { useMemo, useState } from "react";
import { 
  Target, 
  TrendingUp, 
  TrendingDown,
  Minus,
  CheckCircle,
  AlertCircle,
  Plus,
  BarChart2
} from "lucide-react";
import { getAccuracyStats, recordActual } from "../../lib/optimization/OptimizationEngine";

export default function ForecastAccuracyCard({ onRecordActual, compact = false }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [actualCost, setActualCost] = useState("");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 10));

  const stats = useMemo(() => getAccuracyStats(), []);

  const handleRecordActual = () => {
    if (actualCost && parseFloat(actualCost) > 0) {
      recordActual({
        date: period,
        cost: parseFloat(actualCost),
      });
      setActualCost("");
      setShowAddModal(false);
      if (onRecordActual) onRecordActual();
    }
  };

  const trendIcon = {
    improving: <TrendingUp className="text-green-400" size={16} />,
    declining: <TrendingDown className="text-red-400" size={16} />,
    stable: <Minus className="text-slate-400" size={16} />,
    insufficient_data: <BarChart2 className="text-slate-500" size={16} />,
  };

  const trendLabel = {
    improving: "Accuracy improving",
    declining: "Accuracy declining",
    stable: "Accuracy stable",
    insufficient_data: "Need more data",
  };

  if (!stats.hasData) {
    return (
      <div className="rounded-2xl p-4 bg-slate-900/50 border border-slate-700/50 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Target className="text-blue-400" size={20} />
          </div>
          <div>
            <h3 className="font-bold text-white">Forecast Accuracy</h3>
            <p className="text-sm text-slate-400">Track how accurate our predictions are</p>
          </div>
        </div>

        <div className="text-center py-6">
          <BarChart2 className="mx-auto text-slate-600 mb-3" size={48} />
          <p className="text-slate-400 mb-4">{stats.message}</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors flex items-center gap-2 mx-auto"
          >
            <Plus size={16} /> Enter Actual Cost
          </button>
        </div>

        {/* Add Actual Modal */}
        {showAddModal && (
          <ActualCostModal
            actualCost={actualCost}
            setActualCost={setActualCost}
            period={period}
            setPeriod={setPeriod}
            onSubmit={handleRecordActual}
            onClose={() => setShowAddModal(false)}
          />
        )}
      </div>
    );
  }

  const accuracyColor = stats.avgErrorPercent < 5 
    ? "text-green-400" 
    : stats.avgErrorPercent < 10 
    ? "text-yellow-400" 
    : "text-orange-400";

  return (
    <div className="rounded-2xl overflow-hidden bg-slate-900/50 border border-slate-700/50 backdrop-blur-sm">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Target className="text-blue-400" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white">Forecast Accuracy</h3>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                {trendIcon[stats.trend]}
                <span>{trendLabel[stats.trend]}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm transition-colors flex items-center gap-1"
          >
            <Plus size={14} /> Add Actual
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="p-4">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
            <div className={`text-2xl font-bold ${accuracyColor}`}>
              ±{stats.avgErrorPercent}%
            </div>
            <div className="text-xs text-slate-500">Avg Error</div>
          </div>
          
          <div className="text-center p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
            <div className="text-2xl font-bold text-green-400">{stats.within5Pct}%</div>
            <div className="text-xs text-slate-500">Within 5%</div>
          </div>
          
          <div className="text-center p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
            <div className="text-2xl font-bold text-blue-400">{stats.within10Pct}%</div>
            <div className="text-xs text-slate-500">Within 10%</div>
          </div>
        </div>

        {/* Accuracy Indicator */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-700/30">
          {parseFloat(stats.avgErrorPercent) < 10 ? (
            <>
              <CheckCircle className="text-green-400 flex-shrink-0" size={20} />
              <p className="text-sm text-green-300">
                Our forecasts are typically within {stats.avgErrorPercent}% of actual costs. 
                That's {parseFloat(stats.avgErrorPercent) < 5 ? "excellent" : "good"} accuracy!
              </p>
            </>
          ) : (
            <>
              <AlertCircle className="text-yellow-400 flex-shrink-0" size={20} />
              <p className="text-sm text-yellow-300">
                Forecasts are averaging {stats.avgErrorPercent}% off. We're working to improve accuracy 
                as we learn more about your home.
              </p>
            </>
          )}
        </div>

        {/* Recent Comparisons */}
        {!compact && stats.recentAccuracy.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-slate-400 mb-2">Recent Comparisons</h4>
            <div className="space-y-2">
              {stats.recentAccuracy.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/30"
                >
                  <span className="text-sm text-slate-400">{item.date}</span>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-500">
                      Predicted: ${item.predictedCost.toFixed(2)}
                    </span>
                    <span className="text-white">
                      Actual: ${item.actualCost.toFixed(2)}
                    </span>
                    <span className={`font-medium ${
                      item.errorPercent < 5 
                        ? "text-green-400" 
                        : item.errorPercent < 10 
                        ? "text-yellow-400" 
                        : "text-orange-400"
                    }`}>
                      {item.direction === "over" ? "+" : "-"}{item.errorPercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Actual Modal */}
      {showAddModal && (
        <ActualCostModal
          actualCost={actualCost}
          setActualCost={setActualCost}
          period={period}
          setPeriod={setPeriod}
          onSubmit={handleRecordActual}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

function ActualCostModal({ actualCost, setActualCost, period, setPeriod, onSubmit, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 w-full max-w-sm">
        <h3 className="text-lg font-bold text-white mb-4">Enter Actual Cost</h3>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Week ending</label>
            <input
              type="date"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm text-slate-400 mb-2">Actual cost ($)</label>
            <input
              type="number"
              value={actualCost}
              onChange={(e) => setActualCost(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <p className="text-xs text-slate-500 mt-1">
              Enter the actual energy cost for this period from your utility bill.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            className="flex-1 px-4 py-2 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}


