// src/components/optimization/index.js
// Export all optimization components

export { default as OneClickOptimizer } from "./OneClickOptimizer";
export { default as WeatherAlerts } from "./WeatherAlerts";
export { default as SystemHealthCard } from "./SystemHealthCard";
export { default as SavingsTracker } from "./SavingsTracker";
export { default as ForecastAccuracyCard } from "./ForecastAccuracyCard";
export { default as TOURateOptimizer } from "./TOURateOptimizer";
export { default as QuickActionsBar } from "./QuickActionsBar";
export { default as HistoricalComparison } from "./HistoricalComparison";
export { default as MaintenanceReminder } from "./MaintenanceReminder";
export { default as BenchmarkCard } from "./BenchmarkCard";
export { default as OptimizationHistory } from "./OptimizationHistory";
export { default as WasteDetector } from "./WasteDetector";

// Re-export engine functions
export {
  calculateOptimalSchedule,
  analyzeWeatherAnomalies,
  recordPrediction,
  recordActual,
  getAccuracyStats,
  analyzeTOUOptimization,
  analyzeSystemHealth,
  trackMaintenance,
  getMaintenanceStatus,
  getBenchmarks,
  getSavingsProgress,
  recordSavingsEvent,
  getQuickActions,
  trackOptimizationAttempt,
  markOptimizationApplied,
  getOptimizationHistory,
  getOptimizationStats,
} from "../../lib/optimization/OptimizationEngine";

