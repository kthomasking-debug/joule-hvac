// src/components/optimization/OptimizationDashboard.jsx
// Comprehensive dashboard combining all optimization features

import React, { useState, useMemo } from "react";
import { 
  Sparkles, 
  ChevronDown, 
  ChevronUp,
  LayoutGrid,
  List
} from "lucide-react";

import OneClickOptimizer from "./OneClickOptimizer";
import WeatherAlerts from "./WeatherAlerts";
import SystemHealthCard from "./SystemHealthCard";
import SavingsTracker from "./SavingsTracker";
import ForecastAccuracyCard from "./ForecastAccuracyCard";
import TOURateOptimizer from "./TOURateOptimizer";
import QuickActionsBar from "./QuickActionsBar";
import HistoricalComparison from "./HistoricalComparison";
import MaintenanceReminder from "./MaintenanceReminder";
import BenchmarkCard from "./BenchmarkCard";
import OptimizationHistory from "./OptimizationHistory";
import WasteDetector from "./WasteDetector";

export default function OptimizationDashboard({
  // Schedule & Temperature
  currentDayTemp = 70,
  currentNightTemp = 68,
  mode = "heating",
  
  // Weather
  weatherForecast = [],
  
  // Rates & Costs
  electricRate = 0.12,
  monthlyCost = 100,
  monthlyKWh = 500,
  touRates = null,
  
  // System
  heatLossFactor = 200,
  hspf2 = 9,
  seer2 = 16,
  squareFeet = 1000,
  climateZone = "mixed",
  systemAge = 0,
  
  // Usage Stats
  auxHeatHours = 0,
  totalHeatHours = 100,
  cyclesPerHour = 3,
  
  // Maintenance
  lastMaintenanceDate = null,
  filterLastChanged = null,
  
  // Callbacks
  onApplySchedule,
  onConfigureTOU,
  onOptimize,
  
  // Display options
  layout = "full", // "full", "compact", "minimal"
  showSections = null, // Array of section IDs to show, null = all
}) {
  const [expandedSection, setExpandedSection] = useState(null);
  const [viewMode, setViewMode] = useState("grid"); // "grid" or "list"

  // Determine which sections to show
  const allSections = [
    { id: "quick-actions", label: "Quick Actions", component: QuickActionsBar },
    { id: "weather", label: "Weather Alerts", component: WeatherAlerts },
    { id: "optimizer", label: "Smart Optimizer", component: OneClickOptimizer },
    { id: "savings", label: "Savings Tracker", component: SavingsTracker },
    { id: "health", label: "System Health", component: SystemHealthCard },
    { id: "accuracy", label: "Forecast Accuracy", component: ForecastAccuracyCard },
    { id: "tou", label: "TOU Optimization", component: TOURateOptimizer },
    { id: "history", label: "Historical", component: HistoricalComparison },
    { id: "maintenance", label: "Maintenance", component: MaintenanceReminder },
    { id: "benchmark", label: "Benchmarks", component: BenchmarkCard },
    { id: "history", label: "Optimization History", component: OptimizationHistory },
  ];

  const visibleSections = showSections 
    ? allSections.filter(s => showSections.includes(s.id))
    : allSections;

  // Minimal layout - just quick actions and weather alerts
  if (layout === "minimal") {
    return (
      <div className="space-y-4">
        <QuickActionsBar
          hasWeatherAlert={weatherForecast.length > 0}
          currentTemp={currentDayTemp}
          optimalTemp={currentDayTemp - 1}
          onOptimize={onOptimize}
          compact
        />
        <WeatherAlerts
          forecast={weatherForecast}
          mode={mode}
          electricRate={electricRate}
          heatLossFactor={heatLossFactor}
          compact
        />
      </div>
    );
  }

  // Compact layout - key features in a horizontal strip
  if (layout === "compact") {
    return (
      <div className="space-y-4">
        <QuickActionsBar
          hasWeatherAlert={weatherForecast.length > 0}
          currentTemp={currentDayTemp}
          optimalTemp={currentDayTemp - 1}
          onOptimize={onOptimize}
          compact
        />
        
        <WeatherAlerts
          forecast={weatherForecast}
          mode={mode}
          electricRate={electricRate}
          heatLossFactor={heatLossFactor}
          compact
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <OneClickOptimizer
            currentDayTemp={currentDayTemp}
            currentNightTemp={currentNightTemp}
            mode={mode}
            weatherForecast={weatherForecast}
            electricRate={electricRate}
            heatLossFactor={heatLossFactor}
            hspf2={hspf2}
            onApplySchedule={onApplySchedule}
            compact
          />
          
          <SavingsTracker compact />
          
          <MaintenanceReminder compact />
        </div>
      </div>
    );
  }

  // Full layout - all features in a comprehensive dashboard
  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Sparkles className="text-white" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Optimization Hub</h2>
            <p className="text-sm text-slate-400">
              All your energy-saving tools in one place
            </p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded-md transition-colors ${
              viewMode === "grid" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 rounded-md transition-colors ${
              viewMode === "list" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Quick Actions - Always visible */}
      <QuickActionsBar
        hasWeatherAlert={weatherForecast.length > 0}
        currentTemp={currentDayTemp}
        optimalTemp={currentDayTemp - 1}
        onOptimize={onOptimize}
      />

      {/* Weather Alerts - Priority display */}
      <WeatherAlerts
        forecast={weatherForecast}
        mode={mode}
        electricRate={electricRate}
        heatLossFactor={heatLossFactor}
      />

      {/* Waste Detector - HomeKit-aware efficiency check */}
      <WasteDetector
        outdoorTemp={weatherForecast?.[0]?.temp || weatherForecast?.[0]?.temperature || null}
        electricRate={electricRate}
        heatLossFactor={heatLossFactor}
      />

      {/* Main Dashboard Grid */}
      <div className={viewMode === "grid" 
        ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" 
        : "space-y-4"
      }>
        {/* Smart Optimizer */}
        <div className={viewMode === "grid" ? "md:col-span-2" : ""}>
          <OneClickOptimizer
            currentDayTemp={currentDayTemp}
            currentNightTemp={currentNightTemp}
            mode={mode}
            weatherForecast={weatherForecast}
            electricRate={electricRate}
            heatLossFactor={heatLossFactor}
            hspf2={hspf2}
            onApplySchedule={onApplySchedule}
          />
        </div>

        {/* Savings Tracker */}
        <SavingsTracker />

        {/* System Health */}
        <SystemHealthCard
          heatLossFactor={heatLossFactor}
          squareFeet={squareFeet}
          auxHeatHours={auxHeatHours}
          totalHeatHours={totalHeatHours}
          cyclesPerHour={cyclesPerHour}
          lastMaintenanceDate={lastMaintenanceDate}
          filterLastChanged={filterLastChanged}
          systemAge={systemAge}
          hspf2={hspf2}
          seer2={seer2}
        />

        {/* Forecast Accuracy */}
        <ForecastAccuracyCard />

        {/* TOU Optimizer */}
        <TOURateOptimizer
          touRates={touRates}
          currentSchedule={{ dayTemp: currentDayTemp, nightTemp: currentNightTemp }}
          mode={mode}
          heatLossFactor={heatLossFactor}
          weatherForecast={weatherForecast}
          onConfigureTOU={onConfigureTOU}
        />

        {/* Historical Comparison */}
        <HistoricalComparison />

        {/* Maintenance Reminder */}
        <MaintenanceReminder />

        {/* Benchmarks */}
        <BenchmarkCard
          monthlyCost={monthlyCost}
          monthlyKWh={monthlyKWh}
          squareFeet={squareFeet}
          climateZone={climateZone}
        />

        {/* Optimization History */}
        <OptimizationHistory />
      </div>
    </div>
  );
}

