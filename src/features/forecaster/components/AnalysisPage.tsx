/**
 * AnalysisPage - Main season-aware analysis page component
 * Handles both heating and cooling modes with unified UI
 */
import React from "react";
import { SeasonProvider, useSeason } from "./SeasonProvider";
import { SeasonModeToggle } from "./SeasonModeToggle";
import { AnalysisHeader } from "./AnalysisHeader";
import { KpiRow } from "./KpiRow";
import { ComfortAndScheduleSection } from "./ComfortAndScheduleSection";
import { DailyBreakdownSection } from "./DailyBreakdownSection";
import { CostCurveSection } from "./CostCurveSection";
import { CalculationAccordionSection } from "./CalculationAccordionSection";
import { SystemUtilitiesSection } from "./SystemUtilitiesSection";

interface AnalysisPageProps {
  // Thermostat state
  thermostatMode?: "heat" | "cool" | "auto" | "off";
  outdoorTemp?: number;
  // Forecast data
  forecastData?: any; // Replace with proper type
  weeklyMetrics?: any; // Replace with proper type
  // User settings
  userSettings?: any; // Replace with proper type
}

export const AnalysisPage: React.FC<AnalysisPageProps> = ({
  thermostatMode = "auto",
  outdoorTemp,
  forecastData,
  weeklyMetrics,
  userSettings,
}) => {
  return (
    <SeasonProvider thermostatMode={thermostatMode} outdoorTemp={outdoorTemp}>
      <div className="min-h-screen bg-[#0C0F14] text-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-8">
          {/* Page Header */}
          <AnalysisHeader>
            <SeasonModeToggle />
          </AnalysisHeader>

          {/* High-level KPIs */}
          <KpiRow weeklyMetrics={weeklyMetrics} />

          {/* Comfort & Schedule Section */}
          <ComfortAndScheduleSection userSettings={userSettings} />

          {/* Daily Breakdown Table */}
          <DailyBreakdownSection forecastData={forecastData} weeklyMetrics={weeklyMetrics} />

          {/* Cost vs Temperature Curve */}
          <CostCurveSection forecastData={forecastData} weeklyMetrics={weeklyMetrics} />

          {/* Calculation Methodology */}
          <CalculationAccordionSection userSettings={userSettings} />

          {/* System Utilities */}
          <SystemUtilitiesSection />
        </div>
      </div>
    </SeasonProvider>
  );
};

// Placeholder components - implement these next
const AnalysisHeader: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="mb-8">
    <h1 className="text-3xl font-bold text-white mb-2">This Week's Forecast</h1>
    <p className="text-gray-400 mb-4">Based on your thermostat schedule and last 7 days weather</p>
    {children}
  </div>
);

const KpiRow: React.FC<{ weeklyMetrics?: any }> = () => {
  const { isHeatingView, isCoolingView } = useSeason();
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {/* Cost KPI */}
      <div className="bg-[#151A21] border border-[#222A35] rounded-xl p-6">
        <div className="text-sm text-gray-400 mb-1">
          {isHeatingView && !isCoolingView ? "Heating Cost" : isCoolingView && !isHeatingView ? "Cooling Cost" : "Energy Cost"}
        </div>
        <div className="text-3xl font-bold text-white">$0.00</div>
        <div className="text-xs text-gray-500 mt-1">This week</div>
      </div>
      {/* Energy KPI */}
      <div className="bg-[#151A21] border border-[#222A35] rounded-xl p-6">
        <div className="text-sm text-gray-400 mb-1">Energy Use</div>
        <div className="text-3xl font-bold text-white">0 kWh</div>
        <div className="text-xs text-gray-500 mt-1">This week</div>
      </div>
      {/* Comfort Risk KPI */}
      <div className="bg-[#151A21] border border-[#222A35] rounded-xl p-6">
        <div className="text-sm text-gray-400 mb-1">Comfort Risk</div>
        <div className="text-lg font-semibold text-yellow-400">None</div>
        <div className="text-xs text-gray-500 mt-1">All days comfortable</div>
      </div>
    </div>
  );
};

const ComfortAndScheduleSection: React.FC<{ userSettings?: any }> = () => {
  const { isHeatingView, isCoolingView } = useSeason();
  return (
    <div className="mb-8 bg-[#151A21] border border-[#222A35] rounded-xl p-6">
      <h2 className="text-xl font-semibold text-white mb-4">Comfort vs Schedule</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isHeatingView && (
          <div className="bg-[#0C0F14] rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-2">Heating Schedule</div>
            <div className="text-lg font-semibold text-white">70°F day / 68°F night</div>
          </div>
        )}
        {isCoolingView && (
          <div className="bg-[#0C0F14] rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-2">Cooling Schedule</div>
            <div className="text-lg font-semibold text-white">76°F day / 78°F night</div>
          </div>
        )}
      </div>
    </div>
  );
};

const DailyBreakdownSection: React.FC<{ forecastData?: any; weeklyMetrics?: any }> = () => {
  const { isHeatingView, isCoolingView } = useSeason();
  return (
    <div className="mb-8 bg-[#151A21] border border-[#222A35] rounded-xl p-6">
      <h2 className="text-xl font-semibold text-white mb-4">Daily Breakdown</h2>
      <div className="text-sm text-gray-400">
        {isHeatingView && !isCoolingView && "Showing heating costs and runtime"}
        {isCoolingView && !isHeatingView && "Showing cooling costs and runtime"}
        {isHeatingView && isCoolingView && "Showing both heating and cooling"}
      </div>
      {/* Table implementation goes here */}
    </div>
  );
};

const CostCurveSection: React.FC<{ forecastData?: any; weeklyMetrics?: any }> = () => (
  <div className="mb-8 bg-[#151A21] border border-[#222A35] rounded-xl p-6">
    <h2 className="text-xl font-semibold text-white mb-4">Cost vs Outdoor Temperature</h2>
    {/* Chart implementation goes here */}
  </div>
);

const CalculationAccordionSection: React.FC<{ userSettings?: any }> = () => (
  <div className="mb-8 bg-[#151A21] border border-[#222A35] rounded-xl p-6">
    <h2 className="text-xl font-semibold text-white mb-4">Calculation Methodology</h2>
    {/* Accordion implementation goes here */}
  </div>
);

const SystemUtilitiesSection: React.FC = () => (
  <div className="mb-8 bg-[#151A21] border border-[#222A35] rounded-xl p-6">
    <h2 className="text-xl font-semibold text-white mb-4">System Utilities</h2>
    {/* Utilities grid goes here */}
  </div>
);

