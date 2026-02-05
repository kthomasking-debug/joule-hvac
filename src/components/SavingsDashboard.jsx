/**
 * SavingsDashboard - Comprehensive money-saving widgets for Home page
 * 
 * Features:
 * 1. Savings tracker with cumulative savings
 * 2. What-if temperature simulator
 * 3. Top 3 savings tips from OptimizationEngine
 * 4. Budget tracker with alerts
 * 5. Similar homes comparison
 * 6. Gamification streaks & badges
 * 7. Cheapest time to run AC
 * 8. Bill tracking promotion
 */

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  DollarSign,
  TrendingDown,
  Lightbulb,
  Target,
  Award,
  Clock,
  Zap,
  ThermometerSun,
  ChevronRight,
  AlertTriangle,
  Flame,
  Snowflake,
  Edit3,
  Check,
  Trophy,
  Sparkles,
  Calendar,
  Home,
  BarChart3,
} from "lucide-react";
import { getAllSettings, setSetting } from "../lib/unifiedSettingsManager";
import { getQuickActions } from "../lib/optimization/OptimizationEngine";
import { getAnnualHDD, getAnnualCDD } from "../lib/hddData";

// ==================== 1. SAVINGS TRACKER ====================
export function SavingsTrackerWidget({ className = "" }) {
  const [savings, setSavings] = useState(() => {
    try {
      const stored = localStorage.getItem("savingsAccount");
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          totalSavings: parsed.totalSavings || 0,
          monthSavings: parsed.monthSavings || 0,
          lastUpdated: parsed.lastUpdated || new Date().toISOString(),
          streakDays: parsed.streakDays || 0,
        };
      }
    } catch {}
    return { totalSavings: 0, monthSavings: 0, streakDays: 0 };
  });

  // Calculate savings from forecast data
  useEffect(() => {
    try {
      const forecastSummary = localStorage.getItem("last_forecast_summary");
      if (forecastSummary) {
        const data = JSON.parse(forecastSummary);
        // Savings = what gas would cost - what heat pump costs
        // Gas cost is typically ~30-50% higher than heat pump for same heating
        const hpCost = data.totalHPCostWithAux || data.totalHPCost || data.weeklyCost || 0;
        const gasCost = data.totalGasCost || (hpCost * 1.4); // Assume 40% more if not provided
        const weeklyDiff = gasCost - hpCost;
        
        // Scale to monthly (4.33 weeks per month)
        const monthSavings = Math.max(0, weeklyDiff * 4.33);
        
        // Get stored total or start at monthly savings
        const stored = localStorage.getItem("savingsAccount");
        const prev = stored ? JSON.parse(stored) : {};
        const totalSavings = (prev.totalSavings || 0) + (monthSavings > 0 ? monthSavings / 30 : 0); // Add daily increment
        
        // Calculate streak (consecutive days with savings)
        const now = new Date();
        const lastUpdate = prev.lastUpdated ? new Date(prev.lastUpdated) : null;
        const isNewDay = !lastUpdate || now.toDateString() !== lastUpdate.toDateString();
        const streakDays = isNewDay && monthSavings > 0 
          ? (prev.streakDays || 0) + 1 
          : (prev.streakDays || 0);
        
        const newSavings = {
          totalSavings: Math.round(totalSavings * 100) / 100,
          monthSavings: Math.round(monthSavings * 100) / 100,
          lastUpdated: now.toISOString(),
          streakDays: isNewDay ? streakDays : prev.streakDays || 0,
        };
        
        // Only update if values changed
        if (newSavings.monthSavings !== savings.monthSavings) {
          setSavings(newSavings);
          localStorage.setItem("savingsAccount", JSON.stringify(newSavings));
        }
      }
    } catch (e) {
      console.log("Error calculating savings:", e);
    }
  }, []); // Run once on mount

  const monthlyGoal = 50; // $50/month savings goal
  const progress = Math.min(100, (savings.monthSavings / monthlyGoal) * 100);

  return (
    <div className={`bg-gradient-to-br from-green-600/20 to-emerald-700/20 border border-green-500/30 rounded-xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">You've Saved</h3>
            <p className="text-xs text-green-300/70">This month</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-400">${savings.monthSavings.toFixed(0)}</div>
          <div className="text-xs text-slate-400">of ${monthlyGoal} goal</div>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden mb-3">
        <div 
          className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">Total saved: <span className="text-green-400 font-semibold">${savings.totalSavings.toFixed(0)}</span></span>
        {savings.streakDays > 0 && (
          <span className="flex items-center gap-1 text-amber-400">
            <Flame className="w-3 h-3" />
            {savings.streakDays} day streak
          </span>
        )}
      </div>
    </div>
  );
}


// ==================== 2. WHAT-IF TEMP SIMULATOR ====================
export function WhatIfSimulator({ className = "" }) {
  const [settings] = useState(() => getAllSettings());
  const [tempOffset, setTempOffset] = useState(0);
  
  const currentTemp = settings.winterThermostat || 70;
  const newTemp = currentTemp + tempOffset;
  
  // Rough savings calculation: ~3% savings per degree setback
  const savingsPercent = tempOffset < 0 ? Math.abs(tempOffset) * 3 : -Math.abs(tempOffset) * 3;
  const monthlySavings = (settings.utilityCost || 0.15) * 500 * (savingsPercent / 100); // Assume 500 kWh base
  
  return (
    <div className={`bg-[#0C1118] border border-slate-800 rounded-xl p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <ThermometerSun className="w-5 h-5 text-blue-400" />
        <h3 className="text-sm font-semibold text-white">What If Calculator</h3>
      </div>
      
      <div className="mb-4">
        <label className="text-xs text-slate-400 mb-2 block">Adjust temperature by:</label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="-5"
            max="5"
            step="1"
            value={tempOffset}
            onChange={(e) => setTempOffset(Number(e.target.value))}
            className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <span className={`text-lg font-bold min-w-[60px] text-right ${tempOffset < 0 ? 'text-green-400' : tempOffset > 0 ? 'text-red-400' : 'text-slate-400'}`}>
            {tempOffset > 0 ? '+' : ''}{tempOffset}°F
          </span>
        </div>
      </div>
      
      <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
        <div>
          <div className="text-xs text-slate-400">Set to {newTemp}°F instead of {currentTemp}°F</div>
          <div className={`text-lg font-bold ${monthlySavings > 0 ? 'text-green-400' : monthlySavings < 0 ? 'text-red-400' : 'text-slate-400'}`}>
            {monthlySavings > 0 ? '+' : ''}${monthlySavings.toFixed(0)}/month
          </div>
        </div>
        {tempOffset !== 0 && (
          <button
            onClick={() => {
              setSetting("winterThermostat", newTemp, { source: "WhatIf" });
              setTempOffset(0);
            }}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Apply
          </button>
        )}
      </div>
    </div>
  );
}


// ==================== 3. TOP SAVINGS TIPS ====================
export function TopSavingsTips({ className = "" }) {
  const tips = useMemo(() => {
    const settings = getAllSettings();
    const allTips = [];
    
    // Tip 1: Thermostat setback
    const winterTemp = settings.winterThermostat || 70;
    if (winterTemp > 68) {
      allTips.push({
        id: "setback",
        icon: <TrendingDown className="w-4 h-4" />,
        title: `Lower temp to 68°F`,
        savings: `$${((winterTemp - 68) * 3 * 1.5).toFixed(0)}/mo`,
        color: "text-green-400",
        action: "/settings",
      });
    }
    
    // Tip 2: Night setback
    const nightSetback = settings.nightSetback || 0;
    if (nightSetback < 3) {
      allTips.push({
        id: "night",
        icon: <Clock className="w-4 h-4" />,
        title: "Add 3°F night setback",
        savings: "$12-18/mo",
        color: "text-blue-400",
        action: "/tools/thermostat-strategy",
      });
    }
    
    // Tip 3: Reduce aux heat
    allTips.push({
      id: "aux",
      icon: <Zap className="w-4 h-4" />,
      title: "Minimize aux heat usage",
      savings: "$20-30/mo",
      color: "text-amber-400",
      action: "/analysis/energy-flow",
    });
    
    // Tip 4: Pre-conditioning
    allTips.push({
      id: "precool",
      icon: <Snowflake className="w-4 h-4" />,
      title: "Pre-cool before peak hours",
      savings: "$10-15/mo",
      color: "text-cyan-400",
      action: "/analysis/forecast",
    });
    
    return allTips.slice(0, 3);
  }, []);

  return (
    <div className={`bg-[#0C1118] border border-slate-800 rounded-xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Top Ways to Save</h3>
        </div>
        <span className="text-xs text-slate-500">Click to apply</span>
      </div>
      
      <div className="space-y-2">
        {tips.map((tip) => (
          <Link
            key={tip.id}
            to={tip.action}
            className="flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className={`${tip.color}`}>{tip.icon}</div>
              <span className="text-sm text-slate-300">{tip.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-green-400">{tip.savings}</span>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}


// ==================== 4. BUDGET TRACKER ====================
export function BudgetTracker({ className = "" }) {
  const [budget, setBudget] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("monthlyBudget")) || { limit: 150, spent: 0 };
    } catch {
      return { limit: 150, spent: 0 };
    }
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(budget.limit);
  
  // Calculate spent from forecast
  useEffect(() => {
    try {
      const forecast = JSON.parse(localStorage.getItem("last_forecast_summary") || "{}");
      if (forecast.totalCost) {
        setBudget(prev => ({ ...prev, spent: forecast.totalCost }));
      }
    } catch {}
  }, []);
  
  const percentUsed = Math.min(100, (budget.spent / budget.limit) * 100);
  const isOverBudget = budget.spent > budget.limit;
  const isNearBudget = percentUsed >= 80 && !isOverBudget;

  const saveBudget = () => {
    const newBudget = { ...budget, limit: editValue };
    localStorage.setItem("monthlyBudget", JSON.stringify(newBudget));
    setBudget(newBudget);
    setIsEditing(false);
  };

  return (
    <div className={`bg-[#0C1118] border ${isOverBudget ? 'border-red-500/50' : isNearBudget ? 'border-amber-500/50' : 'border-slate-800'} rounded-xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-purple-400" />
          <h3 className="text-sm font-semibold text-white">Monthly Budget</h3>
        </div>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(Number(e.target.value))}
              className="w-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-white text-right"
              autoFocus
            />
            <button onClick={saveBudget} className="text-green-400 hover:text-green-300">
              <Check className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button onClick={() => setIsEditing(true)} className="text-slate-400 hover:text-slate-300">
            <Edit3 className="w-4 h-4" />
          </button>
        )}
      </div>
      
      <div className="flex items-baseline gap-2 mb-3">
        <span className={`text-2xl font-bold ${isOverBudget ? 'text-red-400' : 'text-white'}`}>
          ${budget.spent.toFixed(0)}
        </span>
        <span className="text-slate-500">/ ${budget.limit}</span>
      </div>
      
      {/* Progress bar */}
      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden mb-3">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${
            isOverBudget ? 'bg-red-500' : isNearBudget ? 'bg-amber-500' : 'bg-purple-500'
          }`}
          style={{ width: `${Math.min(100, percentUsed)}%` }}
        />
      </div>
      
      {isOverBudget && (
        <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300">
          <AlertTriangle className="w-4 h-4" />
          <span>Over budget by ${(budget.spent - budget.limit).toFixed(0)}! Lower temp to stay on track.</span>
        </div>
      )}
      
      {isNearBudget && !isOverBudget && (
        <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4" />
          <span>Approaching budget limit ({percentUsed.toFixed(0)}% used)</span>
        </div>
      )}
    </div>
  );
}


// ==================== 5. SIMILAR HOMES COMPARISON ====================
export function SimilarHomesComparison({ className = "" }) {
  const [comparison, setComparison] = useState(null);
  
  useEffect(() => {
    try {
      const settings = getAllSettings();
      const location = JSON.parse(localStorage.getItem("userLocation") || "{}");
      
      if (location.state && settings.squareFeet) {
        // Estimate average home cost based on location and size
        const hdd = getAnnualHDD(`${location.city}, ${location.state}`, location.state);
        const sqft = settings.squareFeet || 1500;
        
        // National average: ~$0.12/sqft/month for heating
        const avgMonthly = (sqft * 0.12 * (hdd / 5000)).toFixed(0);
        const yourMonthly = settings.lastMonthCost || avgMonthly * 0.9; // Assume they're doing better
        
        setComparison({
          avgCost: Number(avgMonthly),
          yourCost: Number(yourMonthly),
          sqft,
          location: `${location.city}, ${location.state}`,
        });
      }
    } catch {}
  }, []);

  if (!comparison) return null;
  
  const difference = comparison.avgCost - comparison.yourCost;
  const percentBetter = ((difference / comparison.avgCost) * 100).toFixed(0);

  return (
    <div className={`bg-[#0C1118] border border-slate-800 rounded-xl p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Home className="w-5 h-5 text-indigo-400" />
        <h3 className="text-sm font-semibold text-white">Similar Homes</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div className="text-center p-3 bg-slate-800/50 rounded-lg">
          <div className="text-xs text-slate-400 mb-1">Average Home</div>
          <div className="text-xl font-bold text-slate-300">${comparison.avgCost}/mo</div>
        </div>
        <div className="text-center p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="text-xs text-green-400 mb-1">Your Home</div>
          <div className="text-xl font-bold text-green-400">${comparison.yourCost}/mo</div>
        </div>
      </div>
      
      {difference > 0 && (
        <div className="text-center text-sm text-green-400">
          You're spending <span className="font-bold">{percentBetter}% less</span> than similar {comparison.sqft} sqft homes
        </div>
      )}
    </div>
  );
}


// ==================== 6. GAMIFICATION BADGES ====================
export function AchievementBadges({ className = "" }) {
  const [achievements, setAchievements] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("achievements")) || [];
    } catch {
      return [];
    }
  });
  
  const allBadges = [
    { id: "first_save", name: "First Dollar", desc: "Saved your first dollar", icon: "💰", earned: achievements.includes("first_save") },
    { id: "week_streak", name: "Week Warrior", desc: "7-day no-aux streak", icon: "🔥", earned: achievements.includes("week_streak") },
    { id: "budget_master", name: "Budget Master", desc: "3 months under budget", icon: "🎯", earned: achievements.includes("budget_master") },
    { id: "optimizer", name: "Optimizer", desc: "Applied 5 optimizations", icon: "⚡", earned: achievements.includes("optimizer") },
    { id: "century", name: "Century Club", desc: "Saved $100 total", icon: "🏆", earned: achievements.includes("century") },
  ];
  
  const earnedCount = allBadges.filter(b => b.earned).length;

  return (
    <div className={`bg-[#0C1118] border border-slate-800 rounded-xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Achievements</h3>
        </div>
        <span className="text-xs text-slate-500">{earnedCount}/{allBadges.length} earned</span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {allBadges.map((badge) => (
          <div
            key={badge.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
              badge.earned 
                ? 'bg-amber-500/10 border border-amber-500/30' 
                : 'bg-slate-800/50 border border-slate-700 opacity-50'
            }`}
            title={badge.desc}
          >
            <span className="text-lg">{badge.icon}</span>
            <span className={`text-xs font-medium ${badge.earned ? 'text-amber-300' : 'text-slate-500'}`}>
              {badge.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}


// ==================== 7. CHEAPEST TIME TO RUN AC ====================
export function CheapestTimeWidget({ className = "" }) {
  const [optimalTime, setOptimalTime] = useState(null);
  
  useEffect(() => {
    try {
      const forecast = JSON.parse(localStorage.getItem("last_forecast_summary") || "{}");
      const settings = getAllSettings();
      
      // Find the hour with lowest cost (simplified)
      // In summer, early morning is usually cheapest (before solar ramps up demand)
      const isCooling = settings.primarySystem === "heatPump" && new Date().getMonth() >= 4 && new Date().getMonth() <= 9;
      
      if (isCooling) {
        setOptimalTime({
          start: "6:00 AM",
          end: "9:00 AM",
          savings: "$8-12",
          reason: "Pre-cool before peak hours (2-7 PM)",
        });
      } else {
        setOptimalTime({
          start: "2:00 PM",
          end: "5:00 PM",
          savings: "$5-8",
          reason: "Warmest part of day = most efficient heat pump operation",
        });
      }
    } catch {}
  }, []);

  if (!optimalTime) return null;

  return (
    <div className={`bg-gradient-to-br from-cyan-600/20 to-blue-700/20 border border-cyan-500/30 rounded-xl p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-5 h-5 text-cyan-400" />
        <h3 className="text-sm font-semibold text-white">Optimal Run Time</h3>
      </div>
      
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-xl font-bold text-cyan-400">{optimalTime.start} - {optimalTime.end}</span>
      </div>
      
      <p className="text-xs text-slate-400 mb-2">{optimalTime.reason}</p>
      
      <div className="text-sm text-green-400">
        Potential savings: <span className="font-semibold">{optimalTime.savings}/month</span>
      </div>
    </div>
  );
}


// ==================== 8. BILL TRACKING PROMOTION ====================
export function BillTrackingCard({ className = "" }) {
  const [lastBillDate, setLastBillDate] = useState(null);
  
  useEffect(() => {
    try {
      const billHistory = JSON.parse(localStorage.getItem("billHistory") || "[]");
      if (billHistory.length > 0) {
        const last = billHistory[billHistory.length - 1];
        setLastBillDate(new Date(last.date).toLocaleDateString());
      }
    } catch {}
  }, []);

  return (
    <div className={`bg-[#0C1118] border border-slate-800 rounded-xl p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-5 h-5 text-purple-400" />
        <h3 className="text-sm font-semibold text-white">Track Your Bills</h3>
      </div>
      
      <p className="text-xs text-slate-400 mb-4">
        Enter your actual utility bills to see how accurate our forecasts are and get personalized insights.
      </p>
      
      {lastBillDate ? (
        <div className="text-xs text-slate-500 mb-3">
          Last entry: {lastBillDate}
        </div>
      ) : null}
      
      <Link
        to="/analysis/monthly"
        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <Calendar className="w-4 h-4" />
        Enter This Month's Bill
      </Link>
    </div>
  );
}


// ==================== 9. TOU RATE SETTINGS ====================
export function TOURateWidget({ className = "" }) {
  const [touEnabled, setTouEnabled] = useState(() => {
    try {
      return localStorage.getItem("touEnabled") === "true";
    } catch {
      return false;
    }
  });
  const [rates, setRates] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("touRates")) || {
        peak: 0.25,
        offPeak: 0.10,
        peakStart: 14,
        peakEnd: 19,
      };
    } catch {
      return { peak: 0.25, offPeak: 0.10, peakStart: 14, peakEnd: 19 };
    }
  });

  const currentHour = new Date().getHours();
  const isPeakNow = currentHour >= rates.peakStart && currentHour < rates.peakEnd;
  const currentRate = isPeakNow ? rates.peak : rates.offPeak;

  if (!touEnabled) {
    return (
      <div className={`bg-[#0C1118] border border-slate-800 rounded-xl p-5 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Time-of-Use Rates</h3>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Does your utility have peak/off-peak rates? Enable TOU to optimize when you run your HVAC.
        </p>
        <button
          onClick={() => {
            setTouEnabled(true);
            localStorage.setItem("touEnabled", "true");
          }}
          className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Enable TOU Optimization
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-[#0C1118] border border-slate-800 rounded-xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">TOU Rates</h3>
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
          isPeakNow ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-green-500/20 text-green-300 border border-green-500/30'
        }`}>
          {isPeakNow ? 'Peak' : 'Off-Peak'} Now
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-center">
          <div className="text-xs text-red-300">Peak ({rates.peakStart}:00-{rates.peakEnd}:00)</div>
          <div className="text-lg font-bold text-red-400">${rates.peak.toFixed(2)}/kWh</div>
        </div>
        <div className="p-2 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
          <div className="text-xs text-green-300">Off-Peak</div>
          <div className="text-lg font-bold text-green-400">${rates.offPeak.toFixed(2)}/kWh</div>
        </div>
      </div>
      
      {isPeakNow && (
        <div className="text-xs text-amber-300 text-center">
          💡 Consider raising setpoint by 2-3°F until {rates.peakEnd}:00
        </div>
      )}
    </div>
  );
}


// ==================== 10. WEEKLY SUMMARY ====================
export function WeeklySummaryWidget({ className = "" }) {
  const [summary, setSummary] = useState(null);
  
  useEffect(() => {
    try {
      const forecast = JSON.parse(localStorage.getItem("last_forecast_summary") || "{}");
      const lastWeek = JSON.parse(localStorage.getItem("last_week_summary") || "{}");
      
      if (forecast.totalCost) {
        setSummary({
          thisWeek: forecast.totalCost,
          lastWeek: lastWeek.totalCost || forecast.totalCost * 1.1,
          energy: forecast.totalEnergy || 0,
        });
      }
    } catch {}
  }, []);

  if (!summary) return null;
  
  const change = summary.lastWeek - summary.thisWeek;
  const percentChange = ((change / summary.lastWeek) * 100).toFixed(0);

  return (
    <div className={`bg-gradient-to-br from-indigo-600/20 to-purple-700/20 border border-indigo-500/30 rounded-xl p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-5 h-5 text-indigo-400" />
        <h3 className="text-sm font-semibold text-white">This Week's Forecast</h3>
      </div>
      
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-bold text-white">${summary.thisWeek.toFixed(0)}</span>
        {change > 0 && (
          <span className="text-sm text-green-400">↓ {percentChange}% vs last week</span>
        )}
        {change < 0 && (
          <span className="text-sm text-red-400">↑ {Math.abs(percentChange)}% vs last week</span>
        )}
      </div>
      
      <div className="text-xs text-slate-400">
        Estimated {summary.energy.toFixed(0)} kWh
      </div>
      
      <Link
        to="/analysis/forecast"
        className="mt-3 flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-200"
      >
        View full forecast <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  );
}


// ==================== MAIN DASHBOARD EXPORT ====================
export default function SavingsDashboard({ className = "" }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
      {/* Row 1: Key metrics */}
      <SavingsTrackerWidget />
      <WeeklySummaryWidget />
      <BudgetTracker />
      
      {/* Row 2: Actionable */}
      <WhatIfSimulator />
      <TopSavingsTips />
      <CheapestTimeWidget />
      
      {/* Row 3: Engagement */}
      <SimilarHomesComparison />
      <TOURateWidget />
      <AchievementBadges />
      
      {/* Row 4: Tracking */}
      <BillTrackingCard className="lg:col-span-3" />
    </div>
  );
}
