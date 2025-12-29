// src/components/optimization/SavingsTracker.jsx
// Gamified savings progress with achievements

import React, { useMemo, useState } from "react";
import { 
  Trophy, 
  Flame, 
  Target, 
  TrendingUp, 
  Star,
  Sparkles,
  ChevronRight,
  Plus
} from "lucide-react";
import { getSavingsProgress, recordSavingsEvent } from "../../lib/optimization/OptimizationEngine";

export default function SavingsTracker({ onRecordSavings, compact = false }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [amount, setAmount] = useState("");

  const progress = useMemo(() => getSavingsProgress(), []);

  const handleAddSavings = () => {
    if (amount && parseFloat(amount) > 0) {
      recordSavingsEvent(parseFloat(amount), "manual");
      setAmount("");
      setShowAddModal(false);
      if (onRecordSavings) onRecordSavings();
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden">
      {/* Header with animated gradient */}
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-600/20 via-orange-600/20 to-yellow-600/20 p-4 border-b border-amber-500/30">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Trophy className="text-white" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white">Savings Tracker</h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">
                  Level {progress.level}
                </span>
              </div>
              <p className="text-sm text-amber-300/80">
                {progress.streak > 0 ? `🔥 ${progress.streak} day streak!` : "Start your savings journey"}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors flex items-center gap-1"
          >
            <Plus size={16} /> Log Savings
          </button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="bg-slate-900/50 p-4 backdrop-blur-sm border border-amber-500/20">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 rounded-xl bg-gradient-to-br from-green-900/30 to-emerald-900/20 border border-green-700/30">
            <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
              ${progress.totalSavings}
            </div>
            <div className="text-xs text-green-400/70">Total Saved</div>
          </div>
          
          <div className="text-center p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
            <div className="text-2xl font-bold text-white">${progress.thisMonth}</div>
            <div className="text-xs text-slate-500">This Month</div>
          </div>
          
          <div className="text-center p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
            <div className="text-2xl font-bold text-orange-400 flex items-center justify-center gap-1">
              <Flame size={20} /> {progress.streak}
            </div>
            <div className="text-xs text-slate-500">Day Streak</div>
          </div>
        </div>

        {/* Progress to Next Badge */}
        {progress.nextBadge && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-slate-400">Next: {progress.nextBadge.name}</span>
              <span className="text-amber-400">{progress.progressToNext}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                style={{ width: `${progress.progressToNext}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">{progress.nextBadge.description}</p>
          </div>
        )}

        {/* Earned Badges */}
        {progress.earnedBadges.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-slate-400 mb-2">Achievements</h4>
            <div className="flex flex-wrap gap-2">
              {progress.earnedBadges.map((badge) => (
                <div
                  key={badge.id}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-900/30 to-orange-900/20 border border-amber-700/30"
                  title={badge.description}
                >
                  <span className="text-lg">{badge.icon}</span>
                  <span className="text-sm font-medium text-amber-300">{badge.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Savings Events */}
        {!compact && progress.recentEvents.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-400 mb-2">Recent Activity</h4>
            <div className="space-y-1">
              {progress.recentEvents.slice(0, 5).map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-800/50"
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp className="text-green-400" size={14} />
                    <span className="text-sm text-slate-300">
                      {event.source === "manual" ? "Manual entry" : "Optimization"}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-green-400">+${event.amount.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Savings Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-4">Log Savings</h3>
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-2">Amount saved ($)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSavings}
                className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold hover:shadow-lg hover:shadow-amber-500/30"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


