// src/pages/OptimizationHub.jsx
// Dedicated page for all optimization features

import React, { useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import OptimizationDashboard from "../components/optimization/OptimizationDashboard";
import { useJouleBridgeContext } from "../contexts/JouleBridgeContext";

export default function OptimizationHub() {
  const outletContext = useOutletContext() || {};
  const { userSettings = {}, setUserSetting } = outletContext;
  
  const { thermostatStatus } = useJouleBridgeContext();

  // Get weather forecast from the forecast hook or context
  // For now, we'll pass an empty array and let the components handle it
  const weatherForecast = useMemo(() => {
    // This would come from your weather API
    return [];
  }, []);

  // Get current temperatures from thermostat or user settings
  const currentDayTemp = thermostatStatus?.targetTemp || userSettings?.winterThermostatDay || 70;
  const currentNightTemp = userSettings?.winterThermostatNight || 68;
  
  // Determine mode based on current conditions
  const month = new Date().getMonth();
  const mode = month >= 5 && month <= 8 ? "cooling" : "heating";

  // System parameters
  const heatLossFactor = userSettings?.analyzerHeatLoss || userSettings?.estimatedHeatLoss || 200;
  const hspf2 = userSettings?.hspf2 || 9;
  const seer2 = userSettings?.seer2 || 16;
  const squareFeet = userSettings?.squareFeet || 1000;
  const electricRate = userSettings?.electricRate || 0.12;
  
  // TOU rates (if configured)
  const touRates = userSettings?.touRates || null;

  // Callbacks
  const handleApplySchedule = (schedule) => {
    if (setUserSetting) {
      setUserSetting("winterThermostatDay", schedule.dayTemp);
      setUserSetting("winterThermostatNight", schedule.nightTemp);
    }
  };

  const handleOptimize = (suggestedTemp) => {
    if (setUserSetting) {
      setUserSetting("winterThermostatDay", suggestedTemp);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <OptimizationDashboard
          currentDayTemp={currentDayTemp}
          currentNightTemp={currentNightTemp}
          mode={mode}
          weatherForecast={weatherForecast}
          electricRate={electricRate}
          monthlyCost={userSettings?.lastMonthCost || 100}
          monthlyKWh={userSettings?.lastMonthKWh || 500}
          touRates={touRates}
          heatLossFactor={heatLossFactor}
          hspf2={hspf2}
          seer2={seer2}
          squareFeet={squareFeet}
          climateZone={userSettings?.climateZone || "mixed"}
          systemAge={userSettings?.systemAge || 0}
          auxHeatHours={userSettings?.auxHeatHours || 0}
          totalHeatHours={userSettings?.totalHeatHours || 100}
          cyclesPerHour={userSettings?.cyclesPerHour || 3}
          lastMaintenanceDate={userSettings?.lastMaintenanceDate}
          filterLastChanged={userSettings?.filterLastChanged}
          onApplySchedule={handleApplySchedule}
          onOptimize={handleOptimize}
          layout="full"
        />
      </div>
    </div>
  );
}


