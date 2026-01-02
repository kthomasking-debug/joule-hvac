import React, { useState, useMemo, lazy, Suspense, memo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Upload, Zap, Home, TrendingUp, HelpCircle, Ruler, BarChart3, AlertTriangle, Calculator, ChevronDown, ChevronUp, Settings, Copy, Check, Wind, Fan } from 'lucide-react';
import AnalyzerErrorState from '../components/AnalyzerErrorState';
import TypicalBuildingFallbackCard from '../components/TypicalBuildingFallbackCard';
import { calculateBalancePoint } from '../utils/balancePointCalculator';
import { resolveHeatLossFactor } from '../utils/heatLossResolution';
import { fullInputClasses } from '../lib/uiClasses'
import { DashboardLink } from '../components/DashboardLink';
import { normalizeCsvData } from '../lib/csvNormalization';
import { averageHourlyRows } from '../lib/csvUtils';
import { analyzeThermostatIssues } from '../lib/thermostatDiagnostics';
import { calculateHeatLoss } from '../utils/calculatorEngines';
import { calculateThresholdRecommendations } from '../lib/thresholdRecommendations';
import logger from '../utils/logger';
import { analyzeThermostatData } from '../utils/coastDownPhysics';
import ErrorBoundary from '../components/ErrorBoundary';
import AnalysisGraphs from '../components/SystemPerformanceAnalyzer/AnalysisGraphs';
import CopyToClipboard from '../components/CopyToClipboard';
import { AnalysisResultsSkeleton } from '../components/SkeletonLoader';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import IconTooltip from '../components/IconTooltip';
import ShareButtons from '../components/ShareButtons';
import { createShareableLink, getSharedDataFromURL } from '../utils/shareableLink';
import BillCalibration from '../components/BillCalibration';
import { getCached } from '../utils/cachedStorage';
import { getAnnualHDD, getAnnualCDD, calculateAnnualHeatingCostFromHDD, calculateAnnualCoolingCostFromCDD } from '../lib/hddData';
import { saveCsvData, loadCsvData, hasCsvData, getCsvMetadata, getStorageStats, listAllCsvData } from '../lib/csvDatabase';
import '../styles/print.css';

// NOTE: Recharts is dynamically imported by AnalysisGraphs component using useEffect
// to avoid bundler initialization order issues ("Cannot access 'Q' before initialization")

// analyzeThermostatData has been moved to src/utils/coastDownPhysics.js
// Imported at the top of the file

// Component to display coast-down period data points
const CoastDownDataViewer = ({ coastDownData, result, squareFeet, userSettings }) => {
  if (!coastDownData || !Array.isArray(coastDownData) || coastDownData.length === 0) {
    return null;
  }
  
  try {
    const startRow = coastDownData[0];
    const endRow = coastDownData[coastDownData.length - 1];
    if (!startRow || !endRow) return null;
    
    const startIndoor = Number(startRow?.indoorTemp) || 0;
    const endIndoor = Number(endRow?.indoorTemp) || 0;
    const startOutdoor = Number(startRow?.outdoorTemp) || 0;
    const endOutdoor = Number(endRow?.outdoorTemp) || 0;
    const tempDrop = startIndoor - endIndoor;
    const avgIndoor = coastDownData.reduce((sum, r) => sum + (Number(r?.indoorTemp) || 0), 0) / coastDownData.length;
    const avgOutdoor = coastDownData.reduce((sum, r) => sum + (Number(r?.outdoorTemp) || 0), 0) / coastDownData.length;
    const avgDeltaT = avgIndoor - avgOutdoor;
    
    // Calculate theoretical heat loss for comparison
    const theoreticalFactor = (squareFeet * 22.67 * (userSettings?.insulationLevel || 1.0) * (userSettings?.homeShape || 1.0) * (1 + ((userSettings?.ceilingHeight || 8) - 8) * 0.1)) / 70;
    const measuredFactor = Number(result?.heatLossFactor) || 0;
    const isSuspiciouslyLow = measuredFactor > 0 && measuredFactor < theoreticalFactor * 0.5;
    
    return (
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-2">
          <span>📊 View Ecobee Data Points Used in Calculation</span>
        </summary>
        <div className="mt-3 bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-300 dark:border-gray-700">
          {/* Summary Statistics */}
          <div className="mb-4 p-3 bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600">
            <h5 className="font-semibold text-sm mb-2 text-gray-900 dark:text-gray-100">Coast-Down Period Summary</h5>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Start:</span> {startRow.date || 'N/A'} {startRow.time || 'N/A'}
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">End:</span> {endRow.date || 'N/A'} {endRow.time || 'N/A'}
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Duration:</span> {coastDownData.length} data points
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Indoor Temp Drop:</span> {!isNaN(startIndoor) ? startIndoor.toFixed(1) : 'N/A'}°F → {!isNaN(endIndoor) ? endIndoor.toFixed(1) : 'N/A'}°F ({!isNaN(tempDrop) ? (tempDrop > 0 ? '-' : '+') + Math.abs(tempDrop).toFixed(2) : 'N/A'}°F)
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Avg Indoor Temp:</span> {!isNaN(avgIndoor) ? avgIndoor.toFixed(1) : 'N/A'}°F
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Avg Outdoor Temp:</span> {!isNaN(avgOutdoor) ? avgOutdoor.toFixed(1) : 'N/A'}°F
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Avg ΔT:</span> {!isNaN(avgDeltaT) ? avgDeltaT.toFixed(1) : 'N/A'}°F
              </div>
            </div>
          </div>
          
          {/* Data Quality Warning */}
          {isSuspiciouslyLow && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-400 dark:border-yellow-600 rounded">
              <p className="font-semibold text-sm text-yellow-800 dark:text-yellow-200 mb-2">⚠️ Data Quality Warning</p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-2">
                Your measured heat loss factor ({measuredFactor.toFixed(1)} BTU/hr/°F) is significantly lower than the theoretical estimate ({theoreticalFactor.toFixed(1)} BTU/hr/°F). 
                This could indicate:
              </p>
              <ul className="text-xs text-yellow-700 dark:text-yellow-300 list-disc list-inside space-y-1">
                <li>Data quality issues (missing or incorrect temperature readings)</li>
                <li>System was not completely off during coast-down period</li>
                <li>Significant solar gain or internal heat sources during measurement</li>
                <li>Temperature sensor calibration issues</li>
              </ul>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
                <strong>Recommendation:</strong> Review the data points below. Check that Heat Stage = 0 and Aux Heat = 0 for all rows, 
                and verify temperature readings are reasonable.
              </p>
            </div>
          )}
          
          {/* Sample Data Points (First 10 and Last 10) */}
          <div className="mb-3">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Sample Data Points (showing first 10 and last 10 rows):</p>
            <div className="overflow-x-auto max-h-64 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded">
              <table className="min-w-full text-xs border-collapse">
                <thead className="bg-gray-200 dark:bg-gray-800 sticky top-0">
                  <tr>
                    <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left">#</th>
                    <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left">Date</th>
                    <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left">Time</th>
                    <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right">Indoor (°F)</th>
                    <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right">Outdoor (°F)</th>
                    <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right">ΔT (°F)</th>
                    <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right">Heat</th>
                    <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right">Aux</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900">
                  {/* First 10 rows */}
                  {coastDownData.slice(0, 10).map((row, idx) => {
                    const deltaT = (Number(row?.indoorTemp) || 0) - (Number(row?.outdoorTemp) || 0);
                    return (
                      <tr key={`start-${idx}`} className={idx === 0 ? "bg-yellow-50 dark:bg-yellow-900/20" : ""}>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">{idx + 1}</td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">{row.date || 'N/A'}</td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">{row.time || 'N/A'}</td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right font-mono">
                          {!isNaN(row.indoorTemp) ? Number(row.indoorTemp).toFixed(1) : 'N/A'}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right font-mono">
                          {!isNaN(row.outdoorTemp) ? Number(row.outdoorTemp).toFixed(1) : 'N/A'}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right font-mono">
                          {!isNaN(deltaT) ? deltaT.toFixed(1) : 'N/A'}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right">
                          {!isNaN(row.heatStage) ? Number(row.heatStage).toFixed(0) : '0'}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right">
                          {!isNaN(row.auxHeat) ? Number(row.auxHeat).toFixed(0) : '0'}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Separator if more than 20 rows */}
                  {coastDownData.length > 20 && (
                    <tr>
                      <td colSpan="8" className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center text-gray-500 dark:text-gray-400 italic">
                        ... ({coastDownData.length - 20} more rows) ...
                      </td>
                    </tr>
                  )}
                  {/* Last 10 rows */}
                  {coastDownData.slice(-10).map((row, idx) => {
                    const actualIdx = coastDownData.length - 10 + idx;
                    const deltaT = (Number(row?.indoorTemp) || 0) - (Number(row?.outdoorTemp) || 0);
                    return (
                      <tr key={`end-${idx}`} className={actualIdx === coastDownData.length - 1 ? "bg-yellow-50 dark:bg-yellow-900/20" : ""}>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">{actualIdx + 1}</td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">{row.date || 'N/A'}</td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">{row.time || 'N/A'}</td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right font-mono">
                          {!isNaN(row.indoorTemp) ? Number(row.indoorTemp).toFixed(1) : 'N/A'}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right font-mono">
                          {!isNaN(row.outdoorTemp) ? Number(row.outdoorTemp).toFixed(1) : 'N/A'}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right font-mono">
                          {!isNaN(deltaT) ? deltaT.toFixed(1) : 'N/A'}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right">
                          {!isNaN(row.heatStage) ? Number(row.heatStage).toFixed(0) : '0'}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right">
                          {!isNaN(row.auxHeat) ? Number(row.auxHeat).toFixed(0) : '0'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Full Data Table (Collapsible) */}
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
              View All {coastDownData.length} Data Points
            </summary>
            <div className="mt-2 overflow-x-auto max-h-96 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded">
              <table className="min-w-full text-xs border-collapse">
                <thead className="bg-gray-200 dark:bg-gray-800 sticky top-0">
                  <tr>
                    <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left">#</th>
                    <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left">Date</th>
                    <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left">Time</th>
                    <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right">Indoor (°F)</th>
                    <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right">Outdoor (°F)</th>
                    <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right">ΔT (°F)</th>
                    <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right">Heat</th>
                    <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right">Aux</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900">
                  {coastDownData.map((row, idx) => {
                    const deltaT = (Number(row?.indoorTemp) || 0) - (Number(row?.outdoorTemp) || 0);
                    return (
                      <tr key={idx} className={idx === 0 || idx === coastDownData.length - 1 ? "bg-yellow-50 dark:bg-yellow-900/20" : ""}>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">{idx + 1}</td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">{row.date || 'N/A'}</td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">{row.time || 'N/A'}</td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right font-mono">
                          {!isNaN(row.indoorTemp) ? Number(row.indoorTemp).toFixed(1) : 'N/A'}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right font-mono">
                          {!isNaN(row.outdoorTemp) ? Number(row.outdoorTemp).toFixed(1) : 'N/A'}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right font-mono">
                          {!isNaN(deltaT) ? deltaT.toFixed(1) : 'N/A'}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right">
                          {!isNaN(row.heatStage) ? Number(row.heatStage).toFixed(0) : '0'}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right">
                          {!isNaN(row.auxHeat) ? Number(row.auxHeat).toFixed(0) : '0'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
          
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            <strong>Note:</strong> Highlighted rows (yellow) are the start and end of the coast-down period. 
            All rows should have Heat Stage = 0 and Aux Heat = 0 (system completely off). 
            Check for any non-zero values which would indicate the system was running during the measurement period.
          </p>
        </div>
      </details>
    );
  } catch (error) {
    console.error('Error rendering coast-down data:', error);
    return (
      <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded text-sm text-red-700 dark:text-red-300">
        Error displaying data points: {error.message}
      </div>
    );
  }
};

// Inline help component for thermostat data acquisition
const ThermostatHelp = () => (
  <details className="w-full bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900 dark:to-pink-900 rounded-xl shadow-md border-2 border-purple-200 dark:border-purple-700 p-5 mt-3 transition-all duration-200 hover:shadow-lg">
    <summary className="cursor-pointer font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-3">
      <div className="p-2 bg-purple-600 text-white rounded-lg">
        <HelpCircle size={20} />
      </div>
      How do I get my thermostat data?
    </summary>
    <div className="mt-5 text-gray-700 dark:text-gray-200 leading-relaxed space-y-5">
      <p className="text-base">
        Most modern smart thermostats allow you to download your detailed usage history as a CSV file. This data is essential for calculating your home's unique heat loss factor.
      </p>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <h4 className="font-bold text-purple-900 dark:text-purple-300 mb-3 text-lg">Export Your Data:</h4>
        <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <strong>ProStat is purpose-built for Ecobee.</strong> For the Free tier CSV analyzer, Ecobee provides instant downloads with the data quality our algorithms require.
          </p>
        </div>
        <ul className="list-disc ml-5 space-y-3">
          <li>
            <b className="text-gray-900 dark:text-gray-100">ecobee:</b> Log in to the <a href="https://www.ecobee.com/login/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700">ecobee web portal</a>. Navigate to <b>Home IQ → System Monitor → Download Data</b>. Choose a date range with cold winter weather.
          </li>
        </ul>
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            <strong>Have a Nest or Honeywell?</strong> We focus on Ecobee because it provides superior data fidelity. <a href="#waitlist" className="underline font-semibold">Join the waitlist</a> if you'd like us to add support for other brands.
          </p>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <h4 className="font-bold text-purple-900 dark:text-purple-300 mb-2 text-lg">Required Data Format:</h4>
        <p>
          For the analyzer to work, your CSV must include temperature and runtime columns. We normalize common names automatically.
        </p>
        <p className="mt-2 text-sm">
          Canonical fields we map to:
        </p>
        <code className="block mt-2 bg-gray-100 dark:bg-gray-700 p-3 rounded text-sm font-mono">
          "Date", "Time" (or combined "Timestamp"), "Outdoor Temp (F)", "Thermostat Temperature (F)", "Heat Stage 1 (sec)", "Aux Heat 1 (sec)"
        </code>
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          Notes: If temperatures are in °C, we convert to °F. If you provide a combined <em>Timestamp/Datetime</em>, we split it into Date and Time automatically. If runtimes are in minutes or milliseconds, we automatically convert to seconds.
        </p>
      </div>
    </div>
  </details>
);

const SystemPerformanceAnalyzer = () => {
  // Call context hooks FIRST to ensure consistent hook order
  // Hooks must always be called unconditionally in the same order
  const outletContext = useOutletContext();
  const { setHeatLossFactor, userSettings, setUserSetting } = outletContext || {};
  const navigate = useNavigate();
  
  // Multi-zone support
  const [zones, setZones] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("zones") || "[]");
    } catch {
      return [];
    }
  });
  const [activeZoneId, setActiveZoneId] = useState(() => {
    try {
      const savedZones = JSON.parse(localStorage.getItem("zones") || "[]");
      return localStorage.getItem("activeZoneId") || (savedZones.length > 0 ? savedZones[0].id : "zone1");
    } catch {
      return "zone1";
    }
  });
  
  // Initialize zones if empty (backwards compatibility)
  React.useEffect(() => {
    if (zones.length === 0) {
      const defaultZone = {
        id: "zone1",
        name: "Main Zone",
        squareFeet: userSettings?.squareFeet || 1500,
        insulationLevel: userSettings?.insulationLevel || 1.0,
        primarySystem: userSettings?.primarySystem || "heatPump",
        capacity: userSettings?.capacity || 36,
        hasCSV: false,
      };
      setZones([defaultZone]);
      localStorage.setItem("zones", JSON.stringify([defaultZone]));
      localStorage.setItem("activeZoneId", defaultZone.id);
    }
  }, [userSettings]);
  
  const activeZone = zones.find(z => z.id === activeZoneId) || zones[0];
  
  // Zone-specific localStorage keys
  const getZoneStorageKey = (key) => {
    return `${key}_${activeZoneId}`;
  };
  
  // For labeling results
  const [labels, setLabels] = useState(() => {
    const zoneKey = `spa_labels_${activeZoneId}`;
    const saved = localStorage.getItem(zoneKey);
    return saved ? JSON.parse(saved) : [];
  });
  
  // Get userLocation from cached storage for BillCalibration
  const userLocation = React.useMemo(() => getCached('userLocation', null), []);
  
  // Initialize resultsHistory state BEFORE it's used in useMemo
  // Use activeZoneId directly in initializer since getZoneStorageKey depends on it
  const [resultsHistory, setResultsHistory] = useState(() => {
    const zoneKey = `spa_resultsHistory_${activeZoneId}`;
    const saved = localStorage.getItem(zoneKey);
    return saved ? JSON.parse(saved) : [];
  });
  
  // Get latest analysis result (used throughout component)
  const latestAnalysis = React.useMemo(() => {
    return resultsHistory && resultsHistory.length > 0 ? resultsHistory[0] : null;
  }, [resultsHistory]);
  
  // Calculate annualEstimate for BillCalibration
  const annualEstimate = React.useMemo(() => {
    if (!userLocation || !userSettings) return null;
    
    const useManualHeatLoss = Boolean(userSettings?.useManualHeatLoss);
    const useAnalyzerHeatLoss = Boolean(userSettings?.useAnalyzerHeatLoss);
    
    let heatLossFactor;
    
    // Priority 1: Manual Entry
    if (useManualHeatLoss && userSettings?.manualHeatLoss) {
      heatLossFactor = Number(userSettings.manualHeatLoss);
    }
    // Priority 2: Analyzer Data from CSV
    else if (useAnalyzerHeatLoss && latestAnalysis?.heatLossFactor) {
      heatLossFactor = latestAnalysis.heatLossFactor;
    }
    // Priority 3: Calculated from Building Characteristics
    else {
      const BASE_BTU_PER_SQFT_HEATING = 22.67;
      const ceilingMultiplier = 1 + ((userSettings.ceilingHeight || 8) - 8) * 0.1;
      const designHeatLoss =
        (userSettings.squareFeet || 1500) *
        BASE_BTU_PER_SQFT_HEATING *
        (userSettings.insulationLevel || 1.0) *
        (userSettings.homeShape || 1.0) *
        ceilingMultiplier;
      heatLossFactor = designHeatLoss / 70;
    }
    
    if (!heatLossFactor) return null;
    
    const homeElevation = userSettings.homeElevation ?? 0;
    const elevationMultiplierRaw = 1 + ((homeElevation || 0) / 1000) * 0.005;
    const elevationMultiplier = Math.max(0.8, Math.min(1.3, elevationMultiplierRaw));
    
    const winterThermostat = userSettings.winterThermostat || 70;
    const summerThermostat = userSettings.summerThermostat || 74;
    const heatingThermostatMultiplier = winterThermostat / 70;
    
    const annualHDD = getAnnualHDD(
      `${userLocation.city}, ${userLocation.state}`,
      userLocation.state
    );
    const annualHeatingCost = calculateAnnualHeatingCostFromHDD(
      annualHDD,
      heatLossFactor,
      userSettings.hspf2 || 9.0,
      userSettings.utilityCost || 0.15,
      userSettings.useElectricAuxHeat
    );
    annualHeatingCost.energy *= heatingThermostatMultiplier;
    annualHeatingCost.cost *= heatingThermostatMultiplier;
    annualHeatingCost.energy *= elevationMultiplier;
    annualHeatingCost.cost *= elevationMultiplier;
    
    const annualCDD = getAnnualCDD(
      `${userLocation.city}, ${userLocation.state}`,
      userLocation.state
    );
    const BASE_BTU_PER_SQFT_COOLING = 28.0;
    const ceilingMultiplierCooling = 1 + ((userSettings.ceilingHeight || 8) - 8) * 0.1;
    const designHeatGain =
      (userSettings.squareFeet || 1500) *
      BASE_BTU_PER_SQFT_COOLING *
      (userSettings.insulationLevel || 1.0) *
      (userSettings.homeShape || 1.0) *
      ceilingMultiplierCooling *
      (userSettings.solarExposure || 1.0);
    const heatGainFactor = designHeatGain / 20;
    const coolingThermostatMultiplier = 74 / summerThermostat;
    
    const annualCoolingCost = calculateAnnualCoolingCostFromCDD(
      annualCDD,
      heatGainFactor,
      userSettings.efficiency || 15.0,
      userSettings.utilityCost || 0.15
    );
    annualCoolingCost.energy *= coolingThermostatMultiplier;
    annualCoolingCost.cost *= coolingThermostatMultiplier;
    annualCoolingCost.energy *= elevationMultiplier;
    annualCoolingCost.cost *= elevationMultiplier;
    
    const totalAnnualCost = annualHeatingCost.cost + annualCoolingCost.cost;
    const totalEnergy = annualHeatingCost.energy + annualCoolingCost.energy;
    
    return {
      totalCost: totalAnnualCost,
      totalEnergy: totalEnergy,
      heatingCost: annualHeatingCost.cost,
      coolingCost: annualCoolingCost.cost,
      auxKwhIncluded: annualHeatingCost.auxKwhIncluded || 0,
      auxKwhExcluded: annualHeatingCost.auxKwhExcluded || 0,
      hdd: annualHDD,
      cdd: annualCDD,
      isEstimated: !latestAnalysis?.heatLossFactor,
      method: "quick",
      winterThermostat: winterThermostat,
      summerThermostat: summerThermostat,
    };
  }, [userLocation, userSettings, resultsHistory]);

  const [file, setFile] = useState(null);
  const [, setAnalysisResults] = useState(null);
  const [parsedCsvRows, setParsedCsvRows] = useState(null); // Will be loaded from IndexedDB on mount
  const [dataForAnalysisRows, setDataForAnalysisRows] = useState(null); // Will be loaded from IndexedDB on mount
  const [fileTooLargeForStorage, setFileTooLargeForStorage] = useState(false);
  const [showNerdMode, setShowNerdMode] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = React.useRef(null);
  
  // Auto-restore CSV data from IndexedDB on mount and when zone changes
  React.useEffect(() => {
    let isMounted = true;
    
    async function restoreCsvData() {
      try {
        console.log(`[SystemPerformanceAnalyzer] Attempting to restore CSV data for zone: ${activeZoneId}`);
        
        // Check if data exists in IndexedDB
        const hasData = await hasCsvData(activeZoneId);
        console.log(`[SystemPerformanceAnalyzer] Has CSV data in IndexedDB: ${hasData}`);
        
        if (!hasData) {
          // Fallback: Try to migrate from localStorage (one-time migration)
          try {
            const zoneKey = `spa_parsedCsvData_${activeZoneId}`;
            const saved = localStorage.getItem(zoneKey);
            if (saved) {
              const parsed = JSON.parse(saved);
              if (parsed && Array.isArray(parsed) && parsed.length > 0) {
                console.log(`[SystemPerformanceAnalyzer] Migrating ${parsed.length} rows from localStorage to IndexedDB`);
                // Migrate to IndexedDB
                const filename = localStorage.getItem(`spa_filename_${activeZoneId}`) || localStorage.getItem(`spa_parsedCsvData_${activeZoneId}_filename`) || 'migrated_data.csv';
                await saveCsvData(parsed, activeZoneId, filename);
                // Clear localStorage after successful migration
                localStorage.removeItem(zoneKey);
                if (isMounted) {
                  console.log(`[SystemPerformanceAnalyzer] ✅ Migrated and restored ${parsed.length} rows`);
                  setParsedCsvRows(parsed);
                  setDataForAnalysisRows(parsed);
                }
                return;
              }
            }
          } catch (migrationError) {
            console.warn('[SystemPerformanceAnalyzer] Failed to migrate from localStorage:', migrationError);
          }
          console.log(`[SystemPerformanceAnalyzer] No CSV data found in IndexedDB or localStorage for zone ${activeZoneId}`);
          return;
        }

        // Load from IndexedDB
        const data = await loadCsvData(activeZoneId, true);
        console.log(`[SystemPerformanceAnalyzer] Loaded data from IndexedDB:`, data ? `${data.length} rows` : 'null');
        
        if (data && Array.isArray(data) && data.length > 0 && isMounted) {
          console.log(`[SystemPerformanceAnalyzer] ✅ Restored ${data.length} rows of CSV data from IndexedDB`);
          setParsedCsvRows(data);
          setDataForAnalysisRows(data);
        } else if (isMounted) {
          console.warn(`[SystemPerformanceAnalyzer] No valid CSV data restored (data: ${data ? 'empty array' : 'null'})`);
          setParsedCsvRows(null);
          setDataForAnalysisRows(null);
        }
      } catch (error) {
        console.error('[SystemPerformanceAnalyzer] Failed to restore CSV data from IndexedDB:', error);
        if (isMounted) {
          setParsedCsvRows(null);
          setDataForAnalysisRows(null);
        }
      }
    }

    // Always attempt restore on mount or zone change
    restoreCsvData();

    return () => {
      isMounted = false;
    };
  }, [activeZoneId]); // Only run when zone changes or on mount

  // Also restore CSV data if analysis exists but CSV data is missing (common after page refresh)
  React.useEffect(() => {
    if (latestAnalysis && latestAnalysis.heatLossFactor && (!parsedCsvRows || parsedCsvRows.length === 0)) {
      console.log('[SystemPerformanceAnalyzer] Analysis exists but CSV data missing - attempting restore');
      let isMounted = true;
      
      async function restoreForAnalysis() {
        try {
          // Try IndexedDB first
          const data = await loadCsvData(activeZoneId, true);
          if (data && Array.isArray(data) && data.length > 0 && isMounted) {
            console.log(`[SystemPerformanceAnalyzer] ✅ Restored ${data.length} rows for existing analysis`);
            setParsedCsvRows(data);
            setDataForAnalysisRows(data);
            return;
          }
          
          // Fallback to localStorage
          const zoneKey = `spa_parsedCsvData_${activeZoneId}`;
          const saved = localStorage.getItem(zoneKey);
          if (saved && isMounted) {
            try {
              const parsed = JSON.parse(saved);
              if (parsed && Array.isArray(parsed) && parsed.length > 0) {
                console.log(`[SystemPerformanceAnalyzer] ✅ Restored ${parsed.length} rows from localStorage for existing analysis`);
                setParsedCsvRows(parsed);
                setDataForAnalysisRows(parsed);
                // Also migrate to IndexedDB for future
                const filename = localStorage.getItem(`spa_filename_${activeZoneId}`) || 'migrated_data.csv';
                await saveCsvData(parsed, activeZoneId, filename);
              }
            } catch (e) {
              console.warn('[SystemPerformanceAnalyzer] Failed to restore from localStorage:', e);
            }
          }
        } catch (error) {
          console.error('[SystemPerformanceAnalyzer] Failed to restore CSV for analysis:', error);
        }
      }
      
      restoreForAnalysis();
      
      return () => {
        isMounted = false;
      };
    }
  }, [latestAnalysis, activeZoneId]); // Run when analysis exists but CSV is missing

  // Update state when zone changes - Consolidated version
  React.useEffect(() => {
    if (!activeZoneId) return;

    const zoneKey = (key) => `${key}_${activeZoneId}`;

    // 1. Restore Labels
    const savedLabels = localStorage.getItem(zoneKey('spa_labels'));
    setLabels(savedLabels ? JSON.parse(savedLabels) : []);
    
    // 2. Restore Results History
    const savedHistory = localStorage.getItem(zoneKey('spa_resultsHistory'));
    if (savedHistory) {
      try {
        const history = JSON.parse(savedHistory);
        setResultsHistory(history && Array.isArray(history) ? history : []);
      } catch (e) {
        setResultsHistory([]);
      }
    } else {
      setResultsHistory([]);
    }
    
    // 3. Restore Thresholds
    const savedRecommendations = localStorage.getItem(zoneKey('spa_thresholdRecommendations'));
    if (savedRecommendations) {
      try {
        setThresholdRecommendations(JSON.parse(savedRecommendations));
      } catch (e) { 
        setThresholdRecommendations(null); 
      }
    } else {
      setThresholdRecommendations(null);
    }

    // 4. CSV Data is now restored via IndexedDB in the separate useEffect above
    // This section is kept for backward compatibility but will be empty if IndexedDB has the data

    // Clear session-specific inputs
    setFile(null);
    setAnalysisResults(null);
    setFileTooLargeForStorage(false);
  }, [activeZoneId]);

  // Auto-run analysis on page load/refresh if stored CSV data exists in IndexedDB
  const hasAutoRunRef = React.useRef(false);
  React.useEffect(() => {
    // Only run once per zone change
    if (hasAutoRunRef.current) return;
    if (!parsedCsvRows || parsedCsvRows.length === 0) return;
    
    // If we have CSV data loaded from IndexedDB, auto-run analysis
    async function autoRunAnalysis() {
      try {
        const storedData = parsedCsvRows;
        if (storedData && Array.isArray(storedData) && storedData.length > 0) {
          console.log(`[SystemPerformanceAnalyzer] Auto-running analysis on ${storedData.length} rows of stored CSV data`);
          hasAutoRunRef.current = true;
          
          // Sample data for analysis (same logic as file upload)
          const timeCol = 'Time';
          const sampledData = storedData.filter(row => {
            const t = (row[timeCol] || '').toString();
            const parts = t.split(':');
            if (parts.length < 2) return false;
            const minutes = parseInt(parts[1].replace(/^0+/, '') || '0', 10);
            return [0, 15, 30, 45].includes(minutes);
          });
          const dataForAnalysis = sampledData.length >= 4 ? sampledData : storedData;
          
          // Run analysis automatically
          setIsLoading(true);
          setProgress({ stage: 'Re-analyzing stored data...', percent: 10 });
          
          // Run analysis on stored data (will set isLoading to false when complete)
          setTimeout(async () => {
            await runAnalysisOnData(storedData, dataForAnalysis);
          }, 100);
        }
      } catch (e) {
        console.warn('[SystemPerformanceAnalyzer] Failed to auto-run analysis on stored data:', e);
        setIsLoading(false);
      }
    }
    
    autoRunAnalysis();
    
    // Reset ref when zone changes
    return () => {
      hasAutoRunRef.current = false;
    };
  }, [activeZoneId, parsedCsvRows]); // Run once on mount and when zone/CSV data changes
  
  // Close export menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (showExportMenu && exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportMenu]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [lastAnalysisWasMeasured, setLastAnalysisWasMeasured] = useState(false);
  const [progress, setProgress] = useState({ stage: '', percent: 0 });
  // Manual estimator UI state
  const [showManualEstimator, setShowManualEstimator] = useState(false);
  const [manualSqft, setManualSqft] = useState(() => userSettings?.squareFeet || 800);
  const [manualCeiling, setManualCeiling] = useState(() => userSettings?.ceilingHeight || 8);
  const [manualInsulation, setManualInsulation] = useState(() => userSettings?.insulationLevel || 1.0);
  const [manualShape, setManualShape] = useState(() => userSettings?.homeShape || 0.9);
  const [showHeatLossTooltip, setShowHeatLossTooltip] = useState(false);
  const [showCalculations, setShowCalculations] = useState(false);
  const [copiedThresholdSettings, setCopiedThresholdSettings] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState([]);
  
  // Threshold recommendations state - persisted in localStorage
  const [thresholdRecommendations, setThresholdRecommendations] = useState(() => {
    try {
      // Use activeZoneId directly in initializer to avoid dependency on getZoneStorageKey
      const zoneKey = `spa_thresholdRecommendations_${activeZoneId}`;
      const saved = localStorage.getItem(zoneKey);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // Check for shared data in URL on mount
  React.useEffect(() => {
    const sharedData = getSharedDataFromURL();
    if (sharedData && sharedData.heatLossFactor) {
      // Display shared analysis result
      setResultsHistory(prev => [sharedData, ...prev]);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []); // Only run on mount


  // Keyboard shortcuts
  useKeyboardShortcuts({
    'ctrl+p': (e) => {
      e.preventDefault();
      window.print();
    },
    'ctrl+s': (e) => {
      e.preventDefault();
      // Export current analysis results if available
      if (resultsHistory.length > 0) {
        const result = resultsHistory[0];
        const dataStr = JSON.stringify(result, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analysis-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    },
    'escape': () => {
      setError(null);
      setSuccessMessage("");
    },
  }, [resultsHistory]);

  // Helper: Find column names (handle both normalized and raw ecobee formats)
  const findColumn = useMemo(() => {
    return (patterns) => {
      if (!parsedCsvRows || parsedCsvRows.length === 0) {
        return null;
      }
      const sampleRow = parsedCsvRows[0];
      if (!sampleRow) {
        return null;
      }
      const availableCols = Object.keys(sampleRow);
      for (const pattern of patterns) {
        const found = availableCols.find(col => pattern.test(col));
        if (found) {
          return found;
        }
      }
      return null;
    };
  }, [parsedCsvRows]);

  // Find all column names at top level (always called)
  const currentTempCol = useMemo(() => findColumn([
    /^Current Ten$/i,
    /^(thermostat|indoor|current).*temp/i,
    /^Thermostat Temperature \(F\)$/i,
    /^Thermostat Temperature/i,
  ]), [findColumn]);

  const heatSetTempCol = useMemo(() => findColumn([
    /^Heat Set$/i,
    /^Heat Setpoint$/i,
    /^Heat Set Temp$/i,
    /heat.*set.*temp/i,
    /heat.*setpoint/i,
  ]), [findColumn]);

  const coolSetTempCol = useMemo(() => findColumn([
    /^Cool Set$/i,
    /^Cool Setpoint$/i,
    /^Cool Set Temp$/i,
    /cool.*set.*temp/i,
    /cool.*setpoint/i,
  ]), [findColumn]);

  const heatStageCol = useMemo(() => findColumn([
    /^Heat Stage$/i,
    /^Heat Stage 1$/i,
    /heat.*stage.*sec/i,
    /^Heat Stage 1 \(sec\)$/i,
  ]), [findColumn]);

  const coolStageCol = useMemo(() => findColumn([
    /^Cool Stage$/i,
    /^Cool Stage 1$/i,
    /cool.*stage.*sec/i,
    /^Cool Stage 1 \(sec\)$/i,
  ]), [findColumn]);

  const compressorStageCol = useMemo(() => findColumn([
    /^Compressor Stage$/i,
    /^Compressor Stage 1$/i,
    /compressor.*stage.*sec/i,
    /^Compressor Stage 1 \(sec\)$/i,
  ]), [findColumn]);

  const auxHeatCol = useMemo(() => findColumn([
    /^Aux Heat 1$/i,
    /aux.*heat.*sec/i,
    /^Aux Heat 1 \(sec\)$/i,
    /^Aux Heat 1\s*\(Fan\s*\(sec\)\)$/i,
  ]), [findColumn]);

  const outdoorTempCol = useMemo(() => findColumn([
    /^Outdoor Tel$/i,
    /outdoor.*temp/i,
    /^Outdoor Temp \(F\)$/i,
  ]), [findColumn]);

  const dateCol = useMemo(() => findColumn([/^Date$/i]), [findColumn]);
  const timeCol = useMemo(() => findColumn([/^Time$/i]), [findColumn]);
  
  // Additional columns for advanced analysis
  const humidityCol = useMemo(() => findColumn([
    /^Current Humidity$/i,
    /^Thermostat.*Humidity$/i,
    /humidity/i,
  ]), [findColumn]);
  
  const windSpeedCol = useMemo(() => findColumn([
    /^Wind Speed$/i,
    /wind.*speed/i,
  ]), [findColumn]);
  
  const fanCol = useMemo(() => findColumn([
    /^Fan$/i,
    /^Fan \(sec\)$/i,
    /fan.*sec/i,
  ]), [findColumn]);
  
  // Remote sensor columns
  const bunnyNestTempCol = useMemo(() => findColumn([
    /^Bunny Nest.*Temp$/i,
    /Bunny Nest \(Temp\)$/i,
    /^Bunny Nest \(F\)$/i,
    /^Bunny Nest.*\(F\)$/i,
    /^Bunny Nest/i,
  ]), [findColumn]);
  
  const couchTempCol = useMemo(() => findColumn([
    /^Couch.*Temp$/i,
    /Couch \(F\) \(Temp\)$/i,
    /^Couch \(F\)$/i,
    /^Couch.*\(F\)$/i,
    /^Couch/i,
  ]), [findColumn]);

  // Debug: Log detected columns when parsedCsvRows changes
  React.useEffect(() => {
    if (parsedCsvRows && parsedCsvRows.length > 0) {
      const availableCols = Object.keys(parsedCsvRows[0] || {});
      console.log('[SystemPerformanceAnalyzer] Available columns:', availableCols);
      console.log('[SystemPerformanceAnalyzer] Detected columns:', {
        currentTempCol,
        bunnyNestTempCol,
        couchTempCol,
        outdoorTempCol,
        heatStageCol,
        compressorStageCol,
      });
    }
  }, [parsedCsvRows, currentTempCol, bunnyNestTempCol, couchTempCol, outdoorTempCol, heatStageCol, compressorStageCol]);

  // Calculate metrics - moved to top level
  const SHORT_CYCLE_THRESHOLD = 300; // seconds

  // 1. Heat/Cool Differential Analysis
  const heatDifferentialData = useMemo(() => {
    if (!parsedCsvRows || parsedCsvRows.length === 0 || !currentTempCol) return null;
    // Need at least one setpoint column (heat or cool)
    if (!heatSetTempCol && !coolSetTempCol) return null;
    
    return parsedCsvRows
      .filter(row => {
        const current = parseFloat(row[currentTempCol]);
        if (isNaN(current) || current <= 0) return false;
        
        // Check if we have at least one valid setpoint
        const heatSet = heatSetTempCol ? parseFloat(row[heatSetTempCol]) : null;
        const coolSet = coolSetTempCol ? parseFloat(row[coolSetTempCol]) : null;
        const hasHeatSet = !isNaN(heatSet) && heatSet > 0;
        const hasCoolSet = !isNaN(coolSet) && coolSet > 0;
        
        return hasHeatSet || hasCoolSet;
      })
      .slice(0, 500) // Limit to 500 points for performance
      .map((row, idx) => {
        const current = parseFloat(row[currentTempCol]);
        const heatSet = heatSetTempCol ? parseFloat(row[heatSetTempCol]) : null;
        const coolSet = coolSetTempCol ? parseFloat(row[coolSetTempCol]) : null;
        
        // Determine which setpoint to use:
        // - If both exist, use the one that's closer to current temp (active mode)
        // - Otherwise use whichever exists
        let activeSetpoint = null;
        let setpointType = null;
        
        if (!isNaN(heatSet) && heatSet > 0 && !isNaN(coolSet) && coolSet > 0) {
          // Both exist - use the one closer to current temp (active mode)
          const heatDiff = Math.abs(current - heatSet);
          const coolDiff = Math.abs(current - coolSet);
          if (heatDiff <= coolDiff) {
            activeSetpoint = heatSet;
            setpointType = 'heat';
          } else {
            activeSetpoint = coolSet;
            setpointType = 'cool';
          }
        } else if (!isNaN(heatSet) && heatSet > 0) {
          activeSetpoint = heatSet;
          setpointType = 'heat';
        } else if (!isNaN(coolSet) && coolSet > 0) {
          activeSetpoint = coolSet;
          setpointType = 'cool';
        }
        
        if (activeSetpoint === null) return null;
        
        // Create timestamp
        const timestamp = dateCol && timeCol 
          ? `${row[dateCol]} ${row[timeCol]}` 
          : `Point ${idx + 1}`;
        
        return {
          timestamp,
          currentTemp: current,
          setTemp: activeSetpoint,
          differential: current - activeSetpoint,
          setpointType, // 'heat' or 'cool' for reference
        };
      })
      .filter(Boolean); // Remove any null entries
  }, [parsedCsvRows, currentTempCol, heatSetTempCol, coolSetTempCol, dateCol, timeCol]);

  // 2. Short Cycling Analysis with Differential Recommendations
  const shortCyclingData = useMemo(() => {
    if (!parsedCsvRows || parsedCsvRows.length === 0 || (!heatStageCol && !coolStageCol && !compressorStageCol)) return null;
    const shortCycles = [];
    const heatShortCycles = [];
    const coolShortCycles = [];
    
    parsedCsvRows.forEach((row, idx) => {
      const heatRuntime = heatStageCol ? parseFloat(row[heatStageCol]) || 0 : 0;
      const coolRuntime = coolStageCol ? parseFloat(row[coolStageCol]) || 0 : 0;
      const compressorRuntime = compressorStageCol ? parseFloat(row[compressorStageCol]) || 0 : 0;
      
      const totalRuntime = heatRuntime + coolRuntime + compressorRuntime;
      if (totalRuntime > 0 && totalRuntime < SHORT_CYCLE_THRESHOLD) {
        // Format timestamp to HH:MM for cleaner X-axis
        let timestamp = `Point ${idx + 1}`;
        if (dateCol && timeCol && row[timeCol]) {
          const timeStr = String(row[timeCol]);
          const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
          if (timeMatch) {
            timestamp = `${timeMatch[1]}:${timeMatch[2]}`;
          } else {
            timestamp = timeStr;
          }
        }
        
        const cycleData = {
          timestamp,
          heatRuntime,
          coolRuntime,
          compressorRuntime,
          totalRuntime,
          idx,
        };
        
        shortCycles.push(cycleData);
        
        // Track heat and cool cycles separately for differential calculation
        if (heatRuntime > 0) {
          heatShortCycles.push({ ...cycleData, runtime: heatRuntime });
        }
        if (coolRuntime > 0) {
          coolShortCycles.push({ ...cycleData, runtime: coolRuntime });
        }
      }
    });
    
    if (shortCycles.length === 0) return null;
    
    // Calculate recommended differentials based on short cycling patterns
    let recommendedHeatDifferential = null;
    let recommendedCoolDifferential = null;
    
    // Analyze heat short cycles - look at temperature drops before cycles start
    if (heatShortCycles.length > 0 && currentTempCol && heatSetTempCol) {
      const tempDrops = [];
      heatShortCycles.forEach(cycle => {
        const cycleIdx = cycle.idx;
        // Look at temperature before cycle started (when system was off)
        for (let i = Math.max(0, cycleIdx - 5); i < cycleIdx; i++) {
          const prevRow = parsedCsvRows[i];
          const prevRuntime = heatStageCol ? parseFloat(prevRow[heatStageCol]) || 0 : 0;
          if (prevRuntime === 0) {
            const currentTemp = parseFloat(prevRow[currentTempCol]);
            const setTemp = parseFloat(prevRow[heatSetTempCol]);
            if (!isNaN(currentTemp) && !isNaN(setTemp) && currentTemp > 0 && setTemp > 0) {
              const drop = setTemp - currentTemp;
              if (drop > 0) {
                tempDrops.push(drop);
                break; // Only need one measurement per cycle
              }
            }
          }
        }
      });
      
      if (tempDrops.length > 0) {
        const avgDrop = tempDrops.reduce((sum, d) => sum + d, 0) / tempDrops.length;
        // Recommend differential that's 25% larger than average drop to prevent short cycles
        // But ensure it's at least 0.5°F and at most 2.0°F
        recommendedHeatDifferential = Math.max(0.5, Math.min(2.0, parseFloat((avgDrop * 1.25).toFixed(1))));
      } else {
        // Fallback: if we can't measure temp drops, use cycle frequency
        // Assuming 5-minute intervals, calculate cycles per hour
        const totalHours = parsedCsvRows.length / 12; // 12 five-minute intervals per hour
        const cyclesPerHour = heatShortCycles.length / totalHours;
        if (cyclesPerHour > 6) {
          recommendedHeatDifferential = 1.5;
        } else if (cyclesPerHour > 4) {
          recommendedHeatDifferential = 1.0;
        } else {
          recommendedHeatDifferential = 0.75;
        }
      }
    }
    
    // Analyze cool short cycles - look at temperature rises before cycles start
    if (coolShortCycles.length > 0 && currentTempCol && coolSetTempCol) {
      const tempRises = [];
      coolShortCycles.forEach(cycle => {
        const cycleIdx = cycle.idx;
        // Look at temperature before cycle started (when system was off)
        for (let i = Math.max(0, cycleIdx - 5); i < cycleIdx; i++) {
          const prevRow = parsedCsvRows[i];
          const prevRuntime = coolStageCol ? parseFloat(prevRow[coolStageCol]) || 0 : 0;
          if (prevRuntime === 0) {
            const currentTemp = parseFloat(prevRow[currentTempCol]);
            const setTemp = parseFloat(prevRow[coolSetTempCol]);
            if (!isNaN(currentTemp) && !isNaN(setTemp) && currentTemp > 0 && setTemp > 0) {
              const rise = currentTemp - setTemp;
              if (rise > 0) {
                tempRises.push(rise);
                break; // Only need one measurement per cycle
              }
            }
          }
        }
      });
      
      if (tempRises.length > 0) {
        const avgRise = tempRises.reduce((sum, r) => sum + r, 0) / tempRises.length;
        // Recommend differential that's 25% larger than average rise to prevent short cycles
        recommendedCoolDifferential = Math.max(0.5, Math.min(2.0, parseFloat((avgRise * 1.25).toFixed(1))));
      } else {
        // Fallback: use cycle frequency
        const totalHours = parsedCsvRows.length / 12;
        const cyclesPerHour = coolShortCycles.length / totalHours;
        if (cyclesPerHour > 6) {
          recommendedCoolDifferential = 1.5;
        } else if (cyclesPerHour > 4) {
          recommendedCoolDifferential = 1.0;
        } else {
          recommendedCoolDifferential = 0.75;
        }
      }
    }
    
    return {
      cycles: shortCycles.slice(0, 100), // Limit for display
      recommendedHeatDifferential,
      recommendedCoolDifferential,
      heatShortCycles: heatShortCycles.length,
      coolShortCycles: coolShortCycles.length,
      totalShortCycles: shortCycles.length,
    };
  }, [parsedCsvRows, heatStageCol, coolStageCol, compressorStageCol, dateCol, timeCol, currentTempCol, heatSetTempCol, coolSetTempCol]);

  // 3. Runtime Analysis (per day)
  const runtimeAnalysisData = useMemo(() => {
    if (!parsedCsvRows || parsedCsvRows.length === 0 || (!heatStageCol && !coolStageCol && !compressorStageCol) || !dateCol) return null;
    const dailyRuntimes = {};
    parsedCsvRows.forEach(row => {
      const date = row[dateCol];
      if (!date) return;
      if (!dailyRuntimes[date]) {
        dailyRuntimes[date] = { date, heat: 0, cool: 0, compressor: 0, auxHeat: 0 };
      }
      const heatRuntime = heatStageCol ? parseFloat(row[heatStageCol]) || 0 : 0;
      const coolRuntime = coolStageCol ? parseFloat(row[coolStageCol]) || 0 : 0;
      const compressorRuntime = compressorStageCol ? parseFloat(row[compressorStageCol]) || 0 : 0;
      const auxHeatRuntime = auxHeatCol ? parseFloat(row[auxHeatCol]) || 0 : 0;
      dailyRuntimes[date].heat += heatRuntime;
      dailyRuntimes[date].cool += coolRuntime;
      dailyRuntimes[date].compressor += compressorRuntime;
      dailyRuntimes[date].auxHeat += auxHeatRuntime;
    });
    return Object.values(dailyRuntimes)
      .map(day => ({
        date: day.date,
        heatHours: day.heat / 3600,
        coolHours: day.cool / 3600,
        compressorHours: day.compressor / 3600,
        auxHeatHours: day.auxHeat / 3600,
        totalHours: (day.heat + day.cool + day.compressor + day.auxHeat) / 3600,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [parsedCsvRows, heatStageCol, coolStageCol, compressorStageCol, auxHeatCol, dateCol]);

  // 4. Low Outdoor Temp Analysis (Compressor Min Outdoor Temp behavior)
  const lowTempAnalysisData = useMemo(() => {
    if (!parsedCsvRows || parsedCsvRows.length === 0) {
      console.log('[lowTempAnalysisData] No parsedCsvRows available');
      return null;
    }
    if (!outdoorTempCol) {
      console.log('[lowTempAnalysisData] Missing outdoorTempCol. Available columns:', parsedCsvRows[0] ? Object.keys(parsedCsvRows[0]) : []);
      return null;
    }
    // Use compressorStageCol if available, otherwise fall back to heatStageCol
    const runtimeCol = compressorStageCol || heatStageCol;
    if (!runtimeCol) {
      console.log('[lowTempAnalysisData] Missing both compressorStageCol and heatStageCol. Available columns:', parsedCsvRows[0] ? Object.keys(parsedCsvRows[0]) : []);
      return null;
    }
    return parsedCsvRows
      .filter(row => {
        const outdoorTemp = parseFloat(row[outdoorTempCol]);
        return !isNaN(outdoorTemp) && outdoorTemp < 40; // Focus on cold weather
      })
      .slice(0, 200) // Limit for display
      .map((row, idx) => {
        const outdoorTemp = parseFloat(row[outdoorTempCol]);
        const compressorRuntime = parseFloat(row[runtimeCol]) || 0;
        const timestamp = dateCol && timeCol 
          ? `${row[dateCol]} ${row[timeCol]}` 
          : `Point ${idx + 1}`;
        return {
          timestamp,
          outdoorTemp,
          compressorRuntime,
          compressorHours: (compressorRuntime / 3600).toFixed(2),
        };
      })
      .sort((a, b) => a.outdoorTemp - b.outdoorTemp);
  }, [parsedCsvRows, outdoorTempCol, compressorStageCol, heatStageCol, dateCol, timeCol]);

  // 5. Remote Sensor Comparison (Comfort Balance)
  // Dynamically detect all remote sensor columns
  const remoteSensorColumns = useMemo(() => {
    if (!parsedCsvRows || parsedCsvRows.length === 0 || !currentTempCol) return [];
    
    const allColumns = Object.keys(parsedCsvRows[0] || {});
    const remoteSensors = [];
    
    // Known remote sensor patterns
    const knownPatterns = [
      { pattern: /bunny.*nest/i, name: 'Bunny Nest' },
      { pattern: /couch/i, name: 'Couch' },
    ];
    
    // Check for known patterns first
    knownPatterns.forEach(({ pattern, name }) => {
      const col = allColumns.find(c => pattern.test(c) && /temp|\(F\)|\(°F\)/i.test(c));
      if (col && col !== currentTempCol) {
        remoteSensors.push({ column: col, name, key: col.toLowerCase().replace(/[^a-z0-9]/g, '_') });
      }
    });
    
    // Find other temperature columns that might be remote sensors
    // Look for columns with "temp" or temperature indicators that aren't the main thermostat
    allColumns.forEach(col => {
      if (col === currentTempCol) return;
      
      // Skip if already found
      if (remoteSensors.some(s => s.column === col)) return;
      
      // Check if it looks like a temperature column
      const isTempCol = /temp|\(F\)|\(°F\)|temperature/i.test(col);
      if (isTempCol) {
        // Check if it has actual data
        const hasData = parsedCsvRows.some(row => {
          const val = parseFloat(row[col]);
          return !isNaN(val) && val > 0;
        });
        
        if (hasData) {
          // Extract a friendly name from the column name
          const friendlyName = col
            .replace(/\(F\)|\(°F\)|temp|temperature/gi, '')
            .trim()
            .replace(/[()]/g, '')
            .trim() || col;
          
          remoteSensors.push({ 
            column: col, 
            name: friendlyName, 
            key: col.toLowerCase().replace(/[^a-z0-9]/g, '_') 
          });
        }
      }
    });
    
    return remoteSensors;
  }, [parsedCsvRows, currentTempCol]);

  const remoteSensorData = useMemo(() => {
    if (!parsedCsvRows || parsedCsvRows.length === 0) {
      console.log('[remoteSensorData] No parsedCsvRows available');
      return null;
    }
    if (!currentTempCol) {
      console.log('[remoteSensorData] Missing currentTempCol. Available columns:', parsedCsvRows[0] ? Object.keys(parsedCsvRows[0]) : []);
      return null;
    }
    
    // If no remote sensors found, we can still show the main thermostat data
    // (useful for single-zone systems)
    if (remoteSensorColumns.length === 0) {
      console.log('[remoteSensorData] No remote sensor columns found. Available columns:', parsedCsvRows[0] ? Object.keys(parsedCsvRows[0]) : []);
      // Return null to show "no data" message, or return main thermostat only
      // For now, return null to maintain current behavior
      return null;
    }
    
    // Helper function to parse date/time into a Date object
    const parseDateTime = (dateStr, timeStr) => {
      if (!dateStr || !timeStr) return null;
      try {
        // Try common date formats: YYYY-MM-DD, MM/DD/YYYY, etc.
        const datePart = dateStr.trim();
        const timePart = timeStr.trim();
        const dateTimeStr = `${datePart} ${timePart}`;
        const date = new Date(dateTimeStr);
        return isNaN(date.getTime()) ? null : date;
      } catch (e) {
        return null;
      }
    };
    
    // Find the most recent date/time in the data
    let mostRecentDate = null;
    parsedCsvRows.forEach(row => {
      if (dateCol && timeCol && row[dateCol] && row[timeCol]) {
        const date = parseDateTime(row[dateCol], row[timeCol]);
        if (date && (!mostRecentDate || date > mostRecentDate)) {
          mostRecentDate = date;
        }
      }
    });
    
    // Calculate 48 hours before the most recent date
    const cutoffDate = mostRecentDate ? new Date(mostRecentDate.getTime() - 48 * 60 * 60 * 1000) : null;
    
    return parsedCsvRows
      .filter(row => {
        const mainTemp = parseFloat(row[currentTempCol]);
        if (isNaN(mainTemp) || mainTemp <= 0) return false;
        
        // Filter to last 48 hours if we have date/time columns
        if (cutoffDate && dateCol && timeCol && row[dateCol] && row[timeCol]) {
          const rowDate = parseDateTime(row[dateCol], row[timeCol]);
          if (rowDate && rowDate < cutoffDate) return false;
        }
        
        return true;
      })
      .slice(0, 500) // Limit for performance
      .map((row, idx) => {
        const mainTemp = parseFloat(row[currentTempCol]);
        const timestamp = dateCol && timeCol 
          ? `${row[dateCol]} ${row[timeCol]}` 
          : `Point ${idx + 1}`;
        
        const dataPoint = {
          timestamp,
          main: !isNaN(mainTemp) ? mainTemp : null,
        };
        
        // Add all remote sensor temperatures dynamically
        remoteSensorColumns.forEach(sensor => {
          const temp = parseFloat(row[sensor.column]);
          const isValid = temp != null && !isNaN(temp);
          dataPoint[sensor.key] = isValid ? temp : null;
          dataPoint[`${sensor.key}Diff`] = isValid && !isNaN(mainTemp) 
            ? (temp - mainTemp).toFixed(1) 
            : null;
        });
        
        return dataPoint;
      });
  }, [parsedCsvRows, currentTempCol, remoteSensorColumns, dateCol, timeCol]);

  // 6. Mold Risk Analysis (Humidity vs Outdoor Temp)
  const moldRiskData = useMemo(() => {
    if (!parsedCsvRows || parsedCsvRows.length === 0 || !humidityCol || !outdoorTempCol) return null;
    return parsedCsvRows
      .filter(row => {
        const humidity = parseFloat(row[humidityCol]);
        const outdoorTemp = parseFloat(row[outdoorTempCol]);
        return !isNaN(humidity) && !isNaN(outdoorTemp) && humidity > 0;
      })
      .slice(0, 500)
      .map((row, idx) => {
        const humidity = parseFloat(row[humidityCol]);
        const outdoorTemp = parseFloat(row[outdoorTempCol]);
        const timestamp = dateCol && timeCol 
          ? `${row[dateCol]} ${row[timeCol]}` 
          : `Point ${idx + 1}`;
        const riskLevel = humidity > 60 && outdoorTemp < 40 ? 'high' : 
                         humidity > 60 ? 'medium' : 
                         humidity < 30 ? 'low' : 'safe';
        
        return {
          timestamp,
          humidity,
          outdoorTemp,
          riskLevel,
        };
      });
  }, [parsedCsvRows, humidityCol, outdoorTempCol, dateCol, timeCol]);

  // 7. Infiltration Check (Wind Speed vs Runtime)
  const infiltrationData = useMemo(() => {
    if (!parsedCsvRows || parsedCsvRows.length === 0 || !windSpeedCol || !heatStageCol || !outdoorTempCol) return null;
    
    // Helper function to parse date/time into a Date object
    const parseDateTime = (dateStr, timeStr) => {
      if (!dateStr || !timeStr) return null;
      try {
        const datePart = dateStr.trim();
        const timePart = timeStr.trim();
        const dateTimeStr = `${datePart} ${timePart}`;
        const date = new Date(dateTimeStr);
        return isNaN(date.getTime()) ? null : date;
      } catch (e) {
        return null;
      }
    };
    
    // Find the most recent date/time in the data
    let mostRecentDate = null;
    parsedCsvRows.forEach(row => {
      if (dateCol && timeCol && row[dateCol] && row[timeCol]) {
        const date = parseDateTime(row[dateCol], row[timeCol]);
        if (date && (!mostRecentDate || date > mostRecentDate)) {
          mostRecentDate = date;
        }
      }
    });
    
    // Calculate 48 hours before the most recent date
    const cutoffDate = mostRecentDate ? new Date(mostRecentDate.getTime() - 48 * 60 * 60 * 1000) : null;
    
    return parsedCsvRows
      .filter(row => {
        const windSpeed = parseFloat(row[windSpeedCol]);
        const outdoorTemp = parseFloat(row[outdoorTempCol]);
        const runtime = parseFloat(row[heatStageCol]) || 0;
        if (isNaN(windSpeed) || isNaN(outdoorTemp) || runtime <= 0) return false;
        
        // Filter to last 48 hours if we have date/time columns
        if (cutoffDate && dateCol && timeCol && row[dateCol] && row[timeCol]) {
          const rowDate = parseDateTime(row[dateCol], row[timeCol]);
          if (rowDate && rowDate < cutoffDate) return false;
        }
        
        return true;
      })
      .slice(0, 500)
      .map((row) => {
        const windSpeed = parseFloat(row[windSpeedCol]);
        const outdoorTemp = parseFloat(row[outdoorTempCol]);
        const runtime = parseFloat(row[heatStageCol]) || 0;
        const tempDiff = 70 - outdoorTemp; // Assume 70°F indoor
        const runtimePerDegree = tempDiff > 0 ? runtime / tempDiff : 0;
        
        return {
          windSpeed,
          outdoorTemp,
          runtime,
          runtimePerDegree,
          runtimeHours: runtime / 3600,
        };
      });
  }, [parsedCsvRows, windSpeedCol, heatStageCol, outdoorTempCol, dateCol, timeCol]);

  // 8. Air Circulation Efficiency (Fan vs Heat Runtime)
  const fanEfficiencyData = useMemo(() => {
    if (!parsedCsvRows || parsedCsvRows.length === 0 || !fanCol || !heatStageCol) return null;
    
    // Helper function to parse date/time into a Date object
    const parseDateTime = (dateStr, timeStr) => {
      if (!dateStr || !timeStr) return null;
      try {
        const datePart = dateStr.trim();
        const timePart = timeStr.trim();
        const dateTimeStr = `${datePart} ${timePart}`;
        const date = new Date(dateTimeStr);
        return isNaN(date.getTime()) ? null : date;
      } catch (e) {
        return null;
      }
    };
    
    // Find the most recent date/time in the data
    let mostRecentDate = null;
    parsedCsvRows.forEach(row => {
      if (dateCol && timeCol && row[dateCol] && row[timeCol]) {
        const date = parseDateTime(row[dateCol], row[timeCol]);
        if (date && (!mostRecentDate || date > mostRecentDate)) {
          mostRecentDate = date;
        }
      }
    });
    
    // Calculate 48 hours before the most recent date
    const cutoffDate = mostRecentDate ? new Date(mostRecentDate.getTime() - 48 * 60 * 60 * 1000) : null;
    
    return parsedCsvRows
      .filter(row => {
        const fanRuntime = parseFloat(row[fanCol]) || 0;
        const heatRuntime = parseFloat(row[heatStageCol]) || 0;
        if (fanRuntime <= 0 && heatRuntime <= 0) return false;
        
        // Filter to last 48 hours if we have date/time columns
        if (cutoffDate && dateCol && timeCol && row[dateCol] && row[timeCol]) {
          const rowDate = parseDateTime(row[dateCol], row[timeCol]);
          if (rowDate && rowDate < cutoffDate) return false;
        }
        
        return true;
      })
      .slice(0, 500)
      .map((row, idx) => {
        const fanRuntime = parseFloat(row[fanCol]) || 0;
        const heatRuntime = parseFloat(row[heatStageCol]) || 0;
        const timestamp = dateCol && timeCol 
          ? `${row[dateCol]} ${row[timeCol]}` 
          : `Point ${idx + 1}`;
        
        return {
          timestamp,
          fanHours: fanRuntime / 3600,
          heatHours: heatRuntime / 3600,
          ratio: heatRuntime > 0 ? (fanRuntime / heatRuntime).toFixed(2) : null,
        };
      });
  }, [parsedCsvRows, fanCol, heatStageCol, dateCol, timeCol]);

  const systemConfig = { 
    capacity: activeZone?.capacity || userSettings?.capacity || 24, 
    efficiency: 15, 
    tons: (activeZone?.capacity || userSettings?.capacity || 24) / 12,
    squareFeet: activeZone?.squareFeet || userSettings?.squareFeet || 2000 // Add square feet for thermal mass estimation
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;
    
    // Validate file size (max 10MB)
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > maxSizeBytes) {
      const fileSizeMB = (selectedFile.size / (1024 * 1024)).toFixed(2);
      setError(`File size (${fileSizeMB} MB) exceeds the maximum allowed size of 10 MB. Please use a smaller file or split your data into multiple files.`);
      setFile(null);
      setFileTooLargeForStorage(false);
      // Reset file input
      event.target.value = '';
      return;
    }
    
    // Validate file type
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a CSV file (.csv extension required).');
      setFile(null);
      setFileTooLargeForStorage(false);
      event.target.value = '';
      return;
    }
    
    setFile(selectedFile);
    setAnalysisResults(null);
    setError(null);
    setSuccessMessage("");
    // Clear threshold recommendations when new file is selected
    setThresholdRecommendations(null);
    try {
      localStorage.removeItem(getZoneStorageKey('spa_thresholdRecommendations'));
    } catch (e) {
      // Ignore errors
    }
  };

  // Reusable function to run analysis on CSV data (can be called from file upload or stored data)
  const runAnalysisOnData = async (fullData, dataForAnalysis) => {
    try {
      setProgress({ stage: 'Analyzing heat loss...', percent: 70 });
      let results;
      try {
        results = analyzeThermostatData(dataForAnalysis, systemConfig);
      } catch (coastDownError) {
        // If coast-down fails, use resolution stack: RAG/Manual J → Generic fallback
        if (coastDownError.message && (coastDownError.message.includes('coast-down') || coastDownError.message.includes('Could not find a suitable'))) {
          logger.info('Coast-down analysis failed, using heat loss resolution stack');
          
          // Use resolution stack: RAG/Manual J → Generic fallback
          const resolved = await resolveHeatLossFactor({
            userSettings: userSettings || {},
            analyzerResults: null, // No analyzer data since coast-down failed
          });
          
          const squareFeet = systemConfig.squareFeet || userSettings?.squareFeet || 2000;
          const homeShape = userSettings?.homeShape || 1.0;
          const ceilingHeight = userSettings?.ceilingHeight || 8;
          const resolvedHeatLossFactor = resolved.value;
          const totalHeatLossAt70 = resolvedHeatLossFactor * 70;
          
          // Calculate balance point using the utility function
          // This uses the heat loss factor and system capacity to find where HP output = heat loss
          let calculatedBalancePoint = null;
          try {
            const balancePointResult = calculateBalancePoint({
              heatLossFactor: resolvedHeatLossFactor,
              capacity: systemConfig.capacity || userSettings?.capacity || 24,
              tons: systemConfig.tons || userSettings?.tons || (systemConfig.capacity || userSettings?.capacity || 24) / 12,
              squareFeet: squareFeet,
              insulationLevel: userSettings?.insulationLevel || 1.0,
              homeShape: homeShape,
              ceilingHeight: ceilingHeight,
              hspf2: userSettings?.hspf2 || 9,
              winterThermostat: userSettings?.winterThermostat || 68,
              useCustomEquipmentProfile: userSettings?.useCustomEquipmentProfile || false,
              capacity47: userSettings?.capacity47,
              capacity17: userSettings?.capacity17,
              capacity5: userSettings?.capacity5,
              cop47: userSettings?.cop47,
              cop17: userSettings?.cop17,
              cop5: userSettings?.cop5,
            });
            if (balancePointResult && balancePointResult.balancePoint != null && isFinite(balancePointResult.balancePoint)) {
              calculatedBalancePoint = balancePointResult.balancePoint;
            }
          } catch (bpError) {
            logger.warn('Failed to calculate balance point for DOE fallback:', bpError);
            // Continue with null balance point
          }
          
          // Create fallback result object
          results = {
            heatLossFactor: resolvedHeatLossFactor,
            balancePoint: calculatedBalancePoint,
            tempDiff: 70,
            heatpumpOutputBtu: null,
            heatLossTotal: totalHeatLossAt70,
            usingDoeFallback: resolved.source === 'default', // Only true for generic fallback
            usingRAGFallback: resolved.source === 'design', // True if from RAG/Manual J
            heatLossSource: resolved.source, // 'measured' | 'design' | 'default'
            heatLossExplanation: resolved.explanation,
            doeHeatLossFactor: resolvedHeatLossFactor,
            squareFeet: squareFeet,
            coastDownPeriod: null,
          };
          
          logger.info('Using resolved heat loss factor:', {
            source: resolved.source,
            squareFeet,
            heatLossFactor: resolvedHeatLossFactor.toFixed(1),
            totalHeatLossAt70: totalHeatLossAt70.toFixed(0),
            explanation: resolved.explanation,
          });
        } else {
          // Re-throw non-coast-down errors
          throw coastDownError;
        }
      }
      setAnalysisResults(results);
      
      setProgress({ stage: 'Running diagnostics...', percent: 85 });
      
      // Run diagnostic analysis (zone-specific)
      const diagnostics = analyzeThermostatIssues(fullData);
      try {
        localStorage.setItem(getZoneStorageKey('spa_diagnostics'), JSON.stringify(diagnostics));
      } catch (e) {
        logger.warn('Failed to store diagnostics in localStorage:', e);
      }
      
      // Calculate additional metrics for history display
      let totalRuntimeHours = 0;
      let minIndoorTemp = null;
      let maxIndoorTemp = null;
      let heatSetpoint = null;
      let coolSetpoint = null;
      let systemMode = null;
      
      if (fullData && fullData.length > 0) {
        // Local helper to find columns in current data
        const findColInData = (patterns) => {
          if (!fullData || fullData.length === 0) return null;
          const sampleRow = fullData[0];
          const availableCols = Object.keys(sampleRow);
          for (const pattern of patterns) {
            const found = availableCols.find(col => pattern.test(col));
            if (found) return found;
          }
          return null;
        };
        
        const currentTempCol = findColInData([
          /^Current Ten$/i,
          /^(thermostat|indoor|current).*temp/i,
          /^Thermostat Temperature \(F\)$/i,
        ]);
        const heatSetTempCol = findColInData([
          /^Heat Set$/i,
          /^Heat Setpoint$/i,
          /^Heat Set Temp$/i,
          /heat.*set.*temp/i,
          /heat.*setpoint/i,
          /^Heat Set Tel$/i,
        ]);
        const coolSetTempCol = findColInData([
          /^Cool Set$/i,
          /^Cool Setpoint$/i,
          /^Cool Set Temp$/i,
          /cool.*set.*temp/i,
          /cool.*setpoint/i,
          /^Cool Set Tei$/i,
        ]);
        const systemModeCol = findColInData([
          /^System Sett$/i,
          /^System Mode$/i,
          /^System Setting$/i,
          /system.*mode/i,
        ]);
        const heatStageColLocal = findColInData([
          /^Heat Stage$/i,
          /^Heat Stage 1$/i,
          /heat.*stage.*sec/i,
          /^Heat Stage 1 \(sec\)$/i,
        ]);
        const auxHeatColLocal = findColInData([
          /^Aux Heat 1$/i,
          /aux.*heat.*sec/i,
          /^Aux Heat 1 \(sec\)$/i,
          /^Aux Heat 1\s*\(Fan\s*\(sec\)\)$/i,
        ]);
        
        let totalHeatSeconds = 0;
        let totalAuxSeconds = 0;
        
        fullData.forEach(row => {
          // Calculate runtime
          if (heatStageColLocal && row[heatStageColLocal]) {
            totalHeatSeconds += parseFloat(row[heatStageColLocal]) || 0;
          }
          if (auxHeatColLocal && row[auxHeatColLocal]) {
            totalAuxSeconds += parseFloat(row[auxHeatColLocal]) || 0;
          }
          
          // Track min/max indoor temp
          if (currentTempCol && row[currentTempCol]) {
            const temp = parseFloat(row[currentTempCol]);
            if (!isNaN(temp)) {
              if (minIndoorTemp === null || temp < minIndoorTemp) minIndoorTemp = temp;
              if (maxIndoorTemp === null || temp > maxIndoorTemp) maxIndoorTemp = temp;
            }
          }
          
          // Get setpoints (use first non-null value)
          if (heatSetTempCol && row[heatSetTempCol] && heatSetpoint === null) {
            const setpoint = parseFloat(row[heatSetTempCol]);
            if (!isNaN(setpoint)) heatSetpoint = setpoint;
          }
          if (coolSetTempCol && row[coolSetTempCol] && coolSetpoint === null) {
            const setpoint = parseFloat(row[coolSetTempCol]);
            if (!isNaN(setpoint)) coolSetpoint = setpoint;
          }
          
          // Get system mode (use first non-null value)
          if (systemModeCol && row[systemModeCol] && systemMode === null) {
            systemMode = String(row[systemModeCol]).trim();
          }
        });
        
        totalRuntimeHours = (totalHeatSeconds + totalAuxSeconds) / 3600;
      }
      
      // Save analysis to history with timestamp (zone-specific)
      const analysisEntry = {
        ...results,
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        label: `Analysis ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        // Additional metrics
        totalRuntimeHours: totalRuntimeHours > 0 ? totalRuntimeHours : null,
        minIndoorTemp: minIndoorTemp !== null ? minIndoorTemp : null,
        maxIndoorTemp: maxIndoorTemp !== null ? maxIndoorTemp : null,
        heatSetpoint: heatSetpoint !== null ? heatSetpoint : null,
        coolSetpoint: coolSetpoint !== null ? coolSetpoint : null,
        systemMode: systemMode || null,
      };
      
      // Get existing history and prepend new entry (keep last 20)
      const existingHistory = resultsHistory || [];
      const updatedHistory = [analysisEntry, ...existingHistory].slice(0, 20);
      setResultsHistory(updatedHistory);
      
      try {
        localStorage.setItem(getZoneStorageKey('spa_resultsHistory'), JSON.stringify(updatedHistory));
      } catch (e) {
        logger.warn('Failed to store results history in localStorage:', e);
      }
      // Dispatch custom event so AskJoule can update immediately
      window.dispatchEvent(new CustomEvent('analyzerDataUpdated'));
      // Add corresponding label - only keep one (zone-specific)
      setLabels(['']);
      try {
        localStorage.setItem(getZoneStorageKey('spa_labels'), JSON.stringify(['']));
      } catch (e) {
        logger.warn('Failed to store labels in localStorage:', e);
      }
      
      // Calculate and store threshold recommendations
      try {
        const recommendations = calculateThresholdRecommendations(
          results,
          fullData,
          { squareFeet: userSettings?.squareFeet || 2000 }
        );
        if (recommendations && recommendations.settings && Object.keys(recommendations.settings).length > 0) {
          setThresholdRecommendations(recommendations);
          localStorage.setItem(getZoneStorageKey('spa_thresholdRecommendations'), JSON.stringify(recommendations));
        }
      } catch (e) {
        logger.warn('Failed to calculate/store threshold recommendations:', e);
      }
      
      setHeatLossFactor(results.heatLossFactor);
      // ☦️ LOAD-BEARING: Also store in userSettings so it persists across page reloads
      // Why this exists: heatLossFactor in React state (App.jsx) doesn't persist. If user
      // refreshes page or navigates away, the value is lost. Storing in userSettings ensures
      // it's available when useAnalyzerHeatLoss is checked in the forecaster.
      // Edge case: If setUserSetting is not available, we still set the React state, but
      // it won't persist. This is handled gracefully by the forecaster's fallback logic.
      if (setUserSetting) {
        setUserSetting("analyzerHeatLoss", results.heatLossFactor);
        // Also store the source so Settings page knows if it's measured or fallback
        setUserSetting("analyzerHeatLossSource", results.heatLossSource || 'default');
      }
      setProgress({ stage: 'Complete!', percent: 100 });
      
      // Track whether this analysis was from a measured coast-down
      const wasMeasured = results.heatLossSource === 'measured';
      setLastAnalysisWasMeasured(wasMeasured);
      
      if (results.usingDoeFallback || !wasMeasured) {
        setSuccessMessage("Analysis complete! Tip (optional): If your data includes a long \"system off\" stretch (about 3 hours), Joule can measure your home's heat loss more accurately. If not, you'll still get a solid estimate using standard building assumptions.");
      } else {
        setSuccessMessage("Success! The calculated Heat Loss Factor is now available in the other calculator tools.");
      }
      
      // Clear progress after a short delay and set loading to false
      setTimeout(() => {
        setProgress({ stage: '', percent: 0 });
        setIsLoading(false);
      }, 1000);
    } catch (err) {
      logger.error('Analysis error:', err);
      setError(`Failed to analyze data: ${err.message}`);
      setProgress({ stage: '', percent: 0 });
      setIsLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError("Please select a file to analyze.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccessMessage("");
    // Clear threshold recommendations when starting new analysis
    setThresholdRecommendations(null);
    try {
      localStorage.removeItem(getZoneStorageKey('spa_thresholdRecommendations'));
    } catch (e) {
      // Ignore errors
    }
    setProgress({ stage: 'Reading file...', percent: 10 });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        setProgress({ stage: 'Parsing CSV data...', percent: 20 });
        const csvText = e.target.result;
        
        // Proper CSV parsing that handles quoted fields with commas
        const parseCSVLine = (line) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                // Escaped quote
                current += '"';
                i++; // Skip next quote
              } else {
                // Toggle quote state
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              // Field separator
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          // Add last field
          result.push(current.trim());
          return result;
        };
        
        const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
        let headerIndex = -1;
        
        // Find header row (skip comment lines and empty lines)
        for (let i = 0; i < lines.length; i++) {
          const trimmed = lines[i].trim();
          if (trimmed && !trimmed.startsWith('#')) {
            // Check if this looks like a header (has common column names)
            const testFields = parseCSVLine(trimmed);
            if (testFields.some(f => /^(Date|Time|Outdoor|Current|Heat|Aux)/i.test(f))) {
              headerIndex = i;
              break;
            }
          }
        }
        
        if (headerIndex === -1) throw new Error("Could not find a valid header row. Make sure your CSV has a header row with column names like 'Date', 'Time', etc.");
        
        const headerLine = lines[headerIndex];
        const headers = parseCSVLine(headerLine).map(h => h.replace(/^"|"$/g, '').trim());
        
        // Validate header alignment - check that Date and Time columns exist
        const dateColIdx = headers.findIndex(h => /^Date$/i.test(h.trim()));
        const timeColIdx = headers.findIndex(h => /^Time$/i.test(h.trim()));
        
        if (dateColIdx === -1 || timeColIdx === -1) {
          logger.warn('CSV header validation:', {
            headers: headers.slice(0, 10),
            dateColIdx,
            timeColIdx,
            headerLine: headerLine.substring(0, 200)
          });
        }
        
        const dataRows = lines.slice(headerIndex + 1);
        const raw = dataRows.map((line) => {
          const values = parseCSVLine(line);
          let row = {};
          headers.forEach((header, index) => {
            const value = values[index] ? values[index].replace(/^"|"$/g, '').trim() : '';
            row[header] = value;
          });
          return row;
        });

        // Detect if this is ecobee data (has characteristic truncated column names)
        const isEcobeeData = headers.some(h => 
          /^Outdoor Tel$/i.test(h.trim()) || 
          /^Current Ten$/i.test(h.trim()) || 
          /^Heat Stage$/i.test(h.trim())
        );

        // For ecobee data, use raw columns directly; otherwise normalize
        setProgress({ stage: 'Normalizing data format...', percent: 40 });
        let data;
        if (isEcobeeData) {
          // Use raw ecobee data directly - no normalization
          data = raw.filter(row => row.Date && row.Time);
          logger.debug('Using raw ecobee data format');
        } else {
          // Normalize headers/rows (adds Date/Time if only Timestamp present; maps synonyms; converts °C→°F)
          data = normalizeCsvData(headers, raw).filter(row => row.Date && row.Time);
        }
        if (data.length === 0) throw new Error("No valid data rows found after the header.");
        
        // ☦️ CRITICAL FIX: Sort data by timestamp to ensure chronological order
        // This prevents column misalignment issues and ensures coast-down detection works correctly
        data.sort((a, b) => {
          const dateA = a.Date || '';
          const dateB = b.Date || '';
          const timeA = a.Time || '';
          const timeB = b.Time || '';
          
          // Compare dates first
          if (dateA !== dateB) {
            // Try to parse as date strings (handles formats like "11/29/2025" or "2025-11-29")
            const dateAObj = new Date(dateA);
            const dateBObj = new Date(dateB);
            if (!isNaN(dateAObj.getTime()) && !isNaN(dateBObj.getTime())) {
              return dateAObj.getTime() - dateBObj.getTime();
            }
            // Fallback to string comparison
            return dateA.localeCompare(dateB);
          }
          
          // Same date, compare times
          const parseTime = (timeStr) => {
            const parts = String(timeStr).split(':');
            if (parts.length < 2) return 0;
            const hours = parseInt(parts[0], 10) || 0;
            const minutes = parseInt(parts[1], 10) || 0;
            const seconds = parseInt(parts[2], 10) || 0;
            return hours * 3600 + minutes * 60 + seconds;
          };
          
          return parseTime(timeA) - parseTime(timeB);
        });
        
        logger.debug('CSV data sorted chronologically:', {
          totalRows: data.length,
          firstRow: { date: data[0]?.Date, time: data[0]?.Time },
          lastRow: { date: data[data.length - 1]?.Date, time: data[data.length - 1]?.Time }
        });
        
        setProgress({ stage: 'Saving CSV data to IndexedDB...', percent: 50 });

        // Save CSV data to IndexedDB (handles large datasets)
        try {
          const filename = file ? file.name : 'uploaded_data.csv';
          await saveCsvData(data, activeZoneId, filename);
          setFileTooLargeForStorage(false);
          console.log(`[SystemPerformanceAnalyzer] ✅ Saved ${data.length} rows to IndexedDB`);
        } catch (storageErr) {
          console.error('[SystemPerformanceAnalyzer] Failed to save CSV data to IndexedDB:', storageErr);
          // IndexedDB should handle large files, but if it fails, we'll still use the data in memory
          // Don't set fileTooLargeForStorage - IndexedDB handles large datasets
        }

        // Store CSV data summary for Ask Joule to use (still use localStorage for small metadata)
        try {
          const dates = data.map(r => r.Date).filter(Boolean);
          // Handle both normalized and raw ecobee column names
          const indoorTemps = data.map(r => {
            const val = r['Current Ten'] || r['Indoor Temp'] || r['Indoor Temperature'] || r['Thermostat Temperature (F)'] || 0;
            return parseFloat(val);
          }).filter(t => t > 0);
          const outdoorTemps = data.map(r => {
            const val = r['Outdoor Tel'] || r['Outdoor Temp'] || r['Outdoor Temperature'] || r['Outdoor Temp (F)'] || 0;
            return parseFloat(val);
          }).filter(t => t);
          const runtimes = data.map(r => {
            const val = r['Heat Stage'] || r['Runtime'] || r['Total Runtime'] || r['Heat Stage 1 (sec)'] || 0;
            return parseFloat(val);
          }).filter(t => t >= 0);
          
          const thermostatSummary = {
            rowCount: data.length,
            dateRange: dates.length > 0 ? `${dates[0]} to ${dates[dates.length - 1]}` : 'unknown',
            avgIndoor: indoorTemps.length > 0 ? (indoorTemps.reduce((a, b) => a + b, 0) / indoorTemps.length).toFixed(1) : 'N/A',
            avgOutdoor: outdoorTemps.length > 0 ? (outdoorTemps.reduce((a, b) => a + b, 0) / outdoorTemps.length).toFixed(1) : 'N/A',
            totalRuntime: runtimes.length > 0 ? runtimes.reduce((a, b) => a + b, 0).toFixed(1) : 'N/A',
            uploadedAt: new Date().toISOString()
          };
          
          localStorage.setItem('thermostatCSVData', JSON.stringify(thermostatSummary));
        } catch (storageErr) {
          // Storage is optional - analysis works fine without it
          logger.debug('Could not store CSV summary (optional):', storageErr);
        }

        // Performance: sample every 15 minutes (0, 15, 30, 45) to speed analysis on long CSVs
        const timeCol = 'Time';
        const sampledData = data.filter(row => {
          const t = (row[timeCol] || '').toString();
          // Expect formats like '0:00:00', '00:00:00', '12:00:00', '0:15:00', etc.
          const parts = t.split(':');
          if (parts.length < 2) return false; // can't parse
          const minutes = parseInt(parts[1].replace(/^0+/, '') || '0', 10);
          return minutes === 0 || minutes === 15 || minutes === 30 || minutes === 45;
        });
        // If the CSV doesn't contain 15-minute marks (too few sampled rows), fall back to full data
        const dataForAnalysis = sampledData.length >= 4 ? sampledData : data;
        if (sampledData.length > 0 && sampledData.length < data.length) {
          logger.debug(`analyzeThermostatData: sampled ${sampledData.length} rows at 15-min intervals (of ${data.length}) for faster analysis`);
        }
        
        // Set the data in state for charts and display (always use full data for current session)
        setParsedCsvRows(data);
        setDataForAnalysisRows(data);
        
        // Update zone to mark it as having CSV data
        const updatedZones = zones.map(z => 
          z.id === activeZoneId ? { ...z, hasCSV: true } : z
        );
        setZones(updatedZones);
        try {
          localStorage.setItem("zones", JSON.stringify(updatedZones));
        } catch (e) {
          logger.warn('Failed to store zones in localStorage:', e);
        }
        
        // Run the analysis on the stored data (this handles everything: analysis, diagnostics, history, recommendations)
        await runAnalysisOnData(data, dataForAnalysis);

      } catch (err) {
        // Provide user-friendly error messages based on error type
        let errorMessage = 'Failed to parse or analyze the file.';
        let errorDetails = err.message;
        
        if (err.message.includes('header')) {
          errorMessage = 'Could not find a valid header row in your CSV file.';
          errorDetails = 'Please ensure your CSV file has a header row with column names.';
        } else if (err.message.includes('No valid data')) {
          errorMessage = 'No valid data rows found in your CSV file.';
          errorDetails = 'Please check that your CSV file contains data rows after the header.';
        } else if (err.message.includes('quota')) {
          errorMessage = 'Storage quota exceeded.';
          errorDetails = 'Your browser storage is full. Please clear some data or use a different browser.';
        } else if (err.message.includes('Invalid indoor temperature')) {
          errorMessage = 'Invalid temperature data detected.';
          errorDetails = 'The CSV file contains invalid temperature values. Please check your data format.';
        } else if (err.message.includes('coast-down')) {
          errorMessage = 'Could not find suitable data for heat loss calculation.';
          errorDetails = 'Your CSV file needs periods where the heating system is off to calculate heat loss. Try uploading data with longer time periods.';
        } else {
          errorDetails = err.message || 'Unknown error occurred.';
        }
        
        setError(`${errorMessage} ${errorDetails}`);
        logger.error('CSV parsing error:', err);
      } finally {
        setIsLoading(false);
        setProgress({ stage: '', percent: 0 });
      }
    };
    reader.readAsText(file);
  };

  // Helper: download CSV given rows (objects)
  const downloadCsvRows = (rows, defaultName = 'parsed.csv') => {
    if (!rows || rows.length === 0) return;
    const keys = Object.keys(rows[0]);
    const header = keys.join(',');
    const csvRows = rows.map(r => keys.map(k => {
      const v = r[k] == null ? '' : String(r[k]);
      const escaped = v.replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(','));
    const csv = [header, ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    a.click();
    URL.revokeObjectURL(url);
  };


  return (
    <div className="w-full mx-auto px-4 py-6 pb-20">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Analyze System</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-3">
            Upload a thermostat CSV to get a simple checkup: how your system's doing, what's normal, and what might be worth fixing.
          </p>
          <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
            <p>Joule turns your thermostat history into plain English: what your system is doing, whether it looks normal, and a few safe next steps.</p>
            <p className="mt-2">Think of Joule as a translator between your thermostat and your power bill. It:</p>
            <ul className="list-disc list-inside ml-2 space-y-0.5">
              <li><strong>Looks at</strong> your thermostat history and local weather</li>
              <li><strong>Estimates</strong> how quickly your home loses heat</li>
              <li><strong>Flags common issues</strong> (like excessive aux heat) and suggests simple adjustments</li>
            </ul>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DashboardLink />
        </div>
      </div>

      {/* Step 1: Download Data Banner */}
      <div className="mb-6 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 shadow-sm dark:border-blue-800 dark:from-blue-950 dark:to-indigo-950">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-2 bg-blue-600 rounded-lg">
            <span className="text-white font-bold text-lg">1</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Step 1: Download Your Thermostat Data</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              In the ecobee app, export your thermostat history as a CSV, then upload it here.
            </p>
            <div className="flex flex-wrap gap-3">
              <a className="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg text-sm font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-gray-700 transition-colors shadow-sm" href="https://www.ecobee.com/login/" target="_blank" rel="noopener noreferrer">
                ecobee →
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <Upload size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          Upload Data File {zones.length > 1 && activeZone && `(${activeZone.name})`}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Your CSV stays on your device unless you choose to share it.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={isLoading}
            className="flex-grow p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100 hover:border-blue-400 dark:hover:border-blue-500 transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Select CSV file to upload"
          />
          <button
            onClick={handleAnalyze}
            disabled={!file || isLoading}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 dark:from-blue-700 dark:to-indigo-700 dark:hover:from-blue-600 dark:hover:to-indigo-600 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-md disabled:transform-none disabled:shadow-none flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                Analyzing...
              </>
            ) : (
              'Analyze Data'
            )}
          </button>
          {isLoading && progress.stage && (
            <div className="w-full mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{progress.stage}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{progress.percent}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress.percent}%` }}
                  role="progressbar"
                  aria-valuenow={progress.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={progress.stage}
                />
              </div>
            </div>
          )}
          {/* Export Data Dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={!parsedCsvRows || isLoading}
              className="px-4 py-2 bg-white border rounded text-sm hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              aria-label="Export diagnostic data"
              aria-expanded={showExportMenu}
            >
              Debug Tools
              <ChevronDown size={16} className={showExportMenu ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 z-50">
                <button
                  onClick={async () => {
                    try {
                      console.log('[SystemPerformanceAnalyzer] Manual restore triggered for zone:', activeZoneId);
                      
                      // Debug: Show what's in the database
                      const stats = await getStorageStats();
                      console.log('[SystemPerformanceAnalyzer] IndexedDB stats:', stats);
                      const allData = await listAllCsvData();
                      console.log('[SystemPerformanceAnalyzer] All CSV records:', allData);
                      
                      const data = await loadCsvData(activeZoneId, true);
                      if (data && Array.isArray(data) && data.length > 0) {
                        setParsedCsvRows(data);
                        setDataForAnalysisRows(data);
                        setSuccessMessage(`✅ Restored ${data.length} rows from IndexedDB`);
                        console.log(`[SystemPerformanceAnalyzer] ✅ Manually restored ${data.length} rows`);
                      } else {
                        const errorMsg = `No CSV data found in IndexedDB for zone "${activeZoneId}". Found ${stats.totalRecords} total records in zones: ${stats.zones.join(', ')}. Please upload a CSV file.`;
                        setError(errorMsg);
                        console.warn('[SystemPerformanceAnalyzer] No data found:', { activeZoneId, stats, allData });
                      }
                    } catch (err) {
                      setError(`Failed to restore: ${err.message}`);
                      console.error('[SystemPerformanceAnalyzer] Manual restore failed:', err);
                    }
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  aria-label="Restore CSV data from IndexedDB"
                >
                  🔄 Restore CSV Data
                </button>
                <button
                  onClick={() => {
                    downloadCsvRows(parsedCsvRows, `${file?.name?.replace(/\.[^.]+$/, '') || 'parsed-data'}-parsed.csv`);
                    setShowExportMenu(false);
                  }}
                  disabled={!parsedCsvRows || isLoading}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Download parsed CSV data"
                >
                  📄 Download Parsed CSV
                </button>
                <button
                  onClick={() => {
                    downloadCsvRows(dataForAnalysisRows, `${file?.name?.replace(/\.[^.]+$/, '') || 'sampled-data'}-hourly.csv`);
                    setShowExportMenu(false);
                  }}
                  disabled={!dataForAnalysisRows || isLoading}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Download sampled CSV data"
                >
                  📊 Download Sampled CSV
                </button>
                <button
                  onClick={() => {
                    const averaged = averageHourlyRows(parsedCsvRows);
                    downloadCsvRows(averaged, `${file?.name?.replace(/\.[^.]+$/, '') || 'parsed-data'}-averaged-hourly.csv`);
                    setShowExportMenu(false);
                  }}
                  disabled={!parsedCsvRows || isLoading}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Download averaged CSV data"
                >
                  📈 Download Averaged CSV
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Note: For large CSV files, data is sampled to one row per hour (top-of-hour) to speed analysis.</p>
        <div className="mt-4 space-y-2">
          <a href="/sample-thermostat-data.csv" download className="text-sm text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 underline">
            Download a sample CSV file
          </a>
          <ThermostatHelp />
        </div>

        {error && !resultsHistory.length && (() => {
          // Only show error if we don't have results (including fallback results)
          // Parse error message to extract diagnostic info
          const isCoastDownError = error.includes('coast-down') || error.includes('Could not find a suitable');
          const isParseError = error.includes('header') || error.includes('parse') || error.includes('CSV');
          
          // Extract diagnostic data from coast-down errors for AnalyzerErrorState
          let errorStats = null;
          if (isCoastDownError) {
            const totalMatch = error.match(/Total data points: (\d+)/);
            const zeroMatch = error.match(/Rows with Heat Stage = 0: (\d+) \(([\d.]+)%\)/);
            const longestMatch = error.match(/Longest consecutive "off" period: (\d+) data points \(([\d.]+) hours\)/);
            
            if (totalMatch || zeroMatch || longestMatch) {
              errorStats = {
                totalPoints: totalMatch ? parseInt(totalMatch[1]) : undefined,
                offRows: zeroMatch ? parseInt(zeroMatch[1]) : undefined,
                longestOffHours: longestMatch ? parseFloat(longestMatch[2]) : undefined,
                requiredOffHours: 3,
              };
            }
          }
          
          // Use AnalyzerErrorState component for coast-down errors
          if (isCoastDownError && errorStats) {
            return (
              <div className="mt-6">
                <AnalyzerErrorState
                  stats={errorStats}
                  onRetry={file ? () => {
                    setError(null);
                    handleAnalyze();
                  } : undefined}
                  onChooseDifferentFile={() => {
                    setError(null);
                    setFile(null);
                    setFileTooLargeForStorage(false);
                    const fileInput = document.querySelector('input[type="file"]');
                    if (fileInput) fileInput.value = '';
                  }}
                  // onRunFallbackEstimate can be added later when fallback is implemented
                />
              </div>
            );
          }
          
          // Fallback for other error types (parse errors, etc.)
          return (
            <div className="mt-6 bg-[#0C1118] border border-red-500/40 rounded-xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-100 mb-1">
                    {isParseError ? "Couldn't read your file" : "Analysis failed"}
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {error.split('\n')[0] || error}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    setError(null);
                    setFile(null);
                    setFileTooLargeForStorage(false);
                    const fileInput = document.querySelector('input[type="file"]');
                    if (fileInput) fileInput.value = '';
                  }}
                  className="px-4 py-2 bg-[#1E4CFF] hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                >
                  Try a different file
                </button>
                {file && (
                  <button
                    onClick={() => {
                      setError(null);
                      handleAnalyze();
                    }}
                    disabled={isLoading}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Retry Analysis
                  </button>
                )}
              </div>
              {isParseError && (
                <p className="text-sm text-slate-400">
                  <strong>Tips:</strong> Ensure your CSV file has a header row, contains valid data, and is in the correct format. Download a sample CSV file above for reference.
                </p>
              )}
            </div>
          );
        })()}

        {successMessage && (
          <div className={`mt-6 ${lastAnalysisWasMeasured 
            ? 'bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950 dark:to-green-950 border-2 border-emerald-300 dark:border-emerald-700' 
            : 'bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950 border-2 border-amber-300 dark:border-amber-700'} rounded-lg p-6 space-y-4`}>
            <p className={`text-lg font-semibold ${lastAnalysisWasMeasured 
              ? 'text-emerald-700 dark:text-emerald-300' 
              : 'text-amber-700 dark:text-amber-300'}`}>{successMessage}</p>
            
            {lastAnalysisWasMeasured ? (
              <>
                <button
                  onClick={() => navigate('/cost-forecaster', { state: { useCalculatedFactor: true } })}
                  className="w-full inline-flex items-center justify-center px-6 py-4 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg font-bold text-lg hover:from-emerald-700 hover:to-green-700 dark:from-emerald-600 dark:to-green-600 dark:hover:from-emerald-500 dark:hover:to-green-500 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <span className="mr-2">→</span>
                  Use this data in the 7-Day Cost Forecaster
                </button>
                <p className="text-sm text-emerald-600 dark:text-emerald-400">Your calculated heat loss factor will be imported automatically</p>
              </>
            ) : (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                <strong>Note:</strong> Some advanced features need a longer "system off" window to measure heat loss directly. If your file doesn't have one, Joule will use a conservative estimate instead.
              </p>
            )}
            <button
              onClick={() => setSuccessMessage("")}
              className={`px-4 py-2 ${lastAnalysisWasMeasured 
                ? 'bg-emerald-600 hover:bg-emerald-700' 
                : 'bg-amber-600 hover:bg-amber-700'} text-white rounded-lg font-medium transition-colors`}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Bill Calibration - Compact widget in status strip (moved to status strip above) */}
      </div>

      {/* Analysis History - Compact Top-Right Position */}
      {resultsHistory.length > 0 && (
        <details className="bg-white dark:bg-gray-800 rounded-xl shadow-lg mb-6 border dark:border-gray-700 no-print">
          <summary className="p-4 cursor-pointer font-semibold text-base text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-900/50 rounded-lg transition-colors flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-600 dark:text-blue-400" />
              <span>Saved Reports</span>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400 font-normal">
              {resultsHistory.length} {resultsHistory.length === 1 ? 'report' : 'reports'}
            </span>
          </summary>
          <div className="px-6 pb-6 space-y-2">
            {resultsHistory.slice(0, 3).map((entry, idx) => {
              const isLatest = idx === 0;
              const heatLoss = entry.heatLossFactor?.toFixed(1) || 'N/A';
              const balancePoint = entry.balancePoint != null && isFinite(entry.balancePoint) 
                ? entry.balancePoint.toFixed(1) 
                : 'N/A';
              
              // Calculate trend (compare to previous entry)
              const previousEntry = resultsHistory[idx + 1];
              const trend = previousEntry && entry.heatLossFactor && previousEntry.heatLossFactor
                ? entry.heatLossFactor - previousEntry.heatLossFactor
                : null;
              
              // Format date and generate descriptive title
              const entryDate = entry.timestamp ? new Date(entry.timestamp) : null;
              const displayDate = entry.date || (entryDate ? entryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : `Run ${idx + 1}`);
              
              // Generate weather-based title if we have outdoor temp data
              let weatherContext = '';
              if (entry.minOutdoorTemp != null && entry.maxOutdoorTemp != null) {
                const avgTemp = (entry.minOutdoorTemp + entry.maxOutdoorTemp) / 2;
                if (avgTemp < 30) weatherContext = ' (Cold Snap)';
                else if (avgTemp < 45) weatherContext = ' (Cold)';
                else if (avgTemp > 70) weatherContext = ' (Warm)';
                else weatherContext = ' (Mild)';
              }
              const displayTitle = displayDate + weatherContext;
              
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border transition-colors ${
                    isLatest
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                      : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-900'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {displayTitle}
                        </span>
                        {isLatest && (
                          <span className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded-full font-medium">
                            Latest
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300 space-y-0.5">
                        <div>
                          <span className="font-medium">Heat Loss:</span>{' '}
                          <span className="font-mono">{heatLoss} BTU/hr/°F</span>
                          {trend !== null && trend !== 0 && (
                            <span className={`ml-2 text-xs ${trend < 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              ({trend < 0 ? '↓' : '↑'} {Math.abs(trend).toFixed(1)})
                            </span>
                          )}
                        </div>
                        {balancePoint !== 'N/A' && (
                          <div>
                            <span className="font-medium">Balance Point:</span>{' '}
                            <span className="font-mono">{balancePoint}°F</span>
                          </div>
                        )}
                        {/* Additional metrics */}
                        {entry.totalRuntimeHours != null && typeof entry.totalRuntimeHours === 'number' && !isNaN(entry.totalRuntimeHours) && (
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            <span className="font-medium">Runtime:</span>{' '}
                            <span className="font-mono">{entry.totalRuntimeHours.toFixed(1)} hrs</span>
                          </div>
                        )}
                        {(entry.minIndoorTemp != null || entry.maxIndoorTemp != null) && (
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            <span className="font-medium">Indoor Temp:</span>{' '}
                            <span className="font-mono">
                              {entry.minIndoorTemp != null && typeof entry.minIndoorTemp === 'number' && !isNaN(entry.minIndoorTemp) 
                                ? entry.minIndoorTemp.toFixed(1) 
                                : 'N/A'}°F
                              {entry.minIndoorTemp != null && entry.maxIndoorTemp != null && 
                               typeof entry.minIndoorTemp === 'number' && typeof entry.maxIndoorTemp === 'number' &&
                               !isNaN(entry.minIndoorTemp) && !isNaN(entry.maxIndoorTemp) &&
                               entry.minIndoorTemp !== entry.maxIndoorTemp && (
                                <> - {entry.maxIndoorTemp.toFixed(1)}°F</>
                              )}
                            </span>
                          </div>
                        )}
                        {(entry.minOutdoorTemp != null || entry.maxOutdoorTemp != null) && (
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            <span className="font-medium">Outdoor Temp Range:</span>{' '}
                            <span className="font-mono">
                              {entry.minOutdoorTemp != null && typeof entry.minOutdoorTemp === 'number' && !isNaN(entry.minOutdoorTemp) 
                                ? entry.minOutdoorTemp.toFixed(1) 
                                : 'N/A'}°F
                              {entry.minOutdoorTemp != null && entry.maxOutdoorTemp != null && 
                               typeof entry.minOutdoorTemp === 'number' && typeof entry.maxOutdoorTemp === 'number' &&
                               !isNaN(entry.minOutdoorTemp) && !isNaN(entry.maxOutdoorTemp) &&
                               entry.minOutdoorTemp !== entry.maxOutdoorTemp && (
                                <> - {entry.maxOutdoorTemp.toFixed(1)}°F</>
                              )}
                            </span>
                          </div>
                        )}
                        {(entry.heatSetpoint != null || entry.coolSetpoint != null) && (
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            <span className="font-medium">Setpoints:</span>{' '}
                            <span className="font-mono">
                              {entry.heatSetpoint != null && typeof entry.heatSetpoint === 'number' && !isNaN(entry.heatSetpoint) 
                                ? `Heat: ${entry.heatSetpoint.toFixed(0)}°F` 
                                : ''}
                              {entry.heatSetpoint != null && entry.coolSetpoint != null && 
                               typeof entry.heatSetpoint === 'number' && typeof entry.coolSetpoint === 'number' &&
                               !isNaN(entry.heatSetpoint) && !isNaN(entry.coolSetpoint) && ', '}
                              {entry.coolSetpoint != null && typeof entry.coolSetpoint === 'number' && !isNaN(entry.coolSetpoint) 
                                ? `Cool: ${entry.coolSetpoint.toFixed(0)}°F` 
                                : ''}
                            </span>
                          </div>
                        )}
                        {entry.systemMode && typeof entry.systemMode === 'string' && (
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            <span className="font-medium">Mode:</span>{' '}
                            <span className="font-mono capitalize">{entry.systemMode.toLowerCase()}</span>
                          </div>
                        )}
                      </div>
                      {trend !== null && trend < -10 && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
                          ✓ Improvement detected! Your heat loss decreased.
                        </p>
                      )}
                      {trend !== null && trend > 10 && (
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-medium">
                          ⚠ Heat loss increased. Check for insulation issues.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {resultsHistory.length > 3 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
                Showing most recent 3 of {resultsHistory.length} analyses
              </p>
            )}
          </div>
        </details>
      )}

      {/* Zone Selector (if multiple zones) */}
      {zones.length > 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-6 border dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Zone for CSV Upload
          </label>
          <p id="zone-selector-description" className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Choose which zone this CSV data belongs to for multi-zone analysis
          </p>
          <select
            value={activeZoneId}
            onChange={(e) => {
              setActiveZoneId(e.target.value);
              localStorage.setItem("activeZoneId", e.target.value);
            }}
            disabled={isLoading}
            className="w-full max-w-md p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Select zone for CSV upload"
            aria-describedby="zone-selector-description"
          >
            {zones.map(zone => (
              <option key={zone.id} value={zone.id}>
                {zone.name} {zone.hasCSV ? "✓" : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {activeZone ? (
              <>
                {activeZone.name}: {activeZone.squareFeet} sq ft
                {activeZone.hasCSV ? " • CSV data uploaded" : " • No CSV data yet"}
              </>
            ) : (
              "Select a zone to upload CSV data for that specific area"
            )}
          </p>
        </div>
      )}

      {/* Loading State with Enhanced Progress Messages */}
      {isLoading && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 mb-6 border-2 border-gray-200 dark:border-gray-700">
          <div className="text-center mb-6">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mb-4"></div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Physics Engine Processing...</h3>
            <p className="text-lg text-gray-700 dark:text-gray-300 font-medium">{progress.stage || 'Initializing analysis...'}</p>
            {progress.percent > 0 && (
              <div className="mt-4 max-w-md mx-auto">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 h-3 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress.percent}%` }}
                    role="progressbar"
                    aria-valuenow={progress.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{progress.percent}% complete</p>
              </div>
            )}
          </div>
          <AnalysisResultsSkeleton />
        </div>
      )}

      {/* Aria-live region for screen readers */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="analysis-results-announcement"
      >
        {resultsHistory.length > 0 && !isLoading && (
          <div>
            Analysis complete. Heat loss factor: {resultsHistory[0]?.heatLossFactor?.toFixed(1) || 'N/A'} BTU per hour per degree Fahrenheit.
            {resultsHistory[0]?.balancePoint != null && isFinite(resultsHistory[0].balancePoint) && (
              <> Balance point: {resultsHistory[0].balancePoint.toFixed(1)} degrees Fahrenheit.</>
            )}
          </div>
        )}
        {isLoading && (
          <div>Processing analysis. {progress.stage || 'Please wait...'}</div>
        )}
      </div>

      {!isLoading && resultsHistory.length > 0 && (
        <ErrorBoundary name="Analysis Results">
          {(() => {
            const result = resultsHistory[0];
            if (!result) return null;
            const squareFeet = userSettings?.squareFeet || 2000;
            
            // Calculate percentile for hero section
            const calculatePercentile = (heatLossFactor) => {
              if (heatLossFactor < 300) return 98;
              if (heatLossFactor < 400) return 95;
              if (heatLossFactor < 500) return 90;
              if (heatLossFactor < 550) return 80;
              if (heatLossFactor < 600) return 70;
              if (heatLossFactor < 650) return 60;
              if (heatLossFactor < 700) return 50;
              if (heatLossFactor < 800) return 35;
              if (heatLossFactor < 900) return 25;
              if (heatLossFactor < 1100) return 15;
              if (heatLossFactor < 1300) return 10;
              if (heatLossFactor < 1800) return 5;
              return 2;
            };
            const percentile = result.heatLossFactor ? calculatePercentile(result.heatLossFactor) : 50;
            const efficiencyStatus = percentile >= 70 ? 'Elite' : percentile >= 40 ? 'Average' : 'Needs Work';
            const efficiencyColor = percentile >= 70 ? 'text-green-600 dark:text-green-400' : percentile >= 40 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';
            
            // Calculate annual waste estimate
            const calculateWaste = () => {
              if (!annualEstimate || !userSettings) return null;
              
              const totalCost = typeof annualEstimate.totalCost === 'number'
                ? annualEstimate.totalCost
                : null;
              
              if (totalCost == null) return null;
              
              const optimalCost = totalCost * 0.9; // assume 10% improvement
              const waste = totalCost - optimalCost;
              return waste > 0 ? waste : 0;
            };
            const annualWaste = calculateWaste();
            
            // Get comfort risk based on balance point and efficiency
            const getComfortRisk = () => {
              if (result.balancePoint != null && isFinite(result.balancePoint)) {
                if (result.balancePoint >= 35) return 'High';
                if (result.balancePoint >= 30) return 'Medium';
                return 'Low';
              }
              if (percentile < 40) return 'Medium';
              return 'Low';
            };
            const comfortRisk = getComfortRisk();
            
            // Get primary recommendation
            const getPrimaryRecommendation = () => {
              if (result.balancePoint != null && isFinite(result.balancePoint) && result.balancePoint >= 30) {
                return {
                  title: "Don't drop the setpoint more than 2°F at night when it's below 30°F",
                  body: "This prevents strips from kicking on at 5–7am, which costs 3x more than your heat pump.",
                  showWhy: true
                };
              }
              if (percentile < 40) {
                return {
                  title: "Consider a deeper nighttime setback when it's above 35°F outside",
                  body: "Your system can handle it, and you'll save money without sacrificing comfort.",
                  showWhy: true
                };
              }
              return {
                title: "Your system is running efficiently",
                body: "Keep your current schedule. You're in the top tier for homes like yours.",
                showWhy: false
              };
            };
            const primaryRecommendation = getPrimaryRecommendation();
            
            // Get system description in plain English
            const getSystemDescription = () => {
              const buildingAge = userSettings?.homeAge || 'typical';
              const buildingDesc = buildingAge < 2000 ? '90s house' : buildingAge < 2010 ? '2000s house' : 'modern house';
              const stripUsage = result.balancePoint != null && result.balancePoint < 25 ? 'almost no strip heat' : 
                                result.balancePoint != null && result.balancePoint < 30 ? 'minimal strip heat' : 
                                'some strip heat';
              const efficiencyDesc = percentile >= 70 ? `top ${percentile}%` : percentile >= 40 ? `top ${percentile}%` : `bottom ${100 - percentile}%`;
              return `Your heat pump is running efficiently for a ${buildingDesc}, with ${stripUsage}. You're in the ${efficiencyDesc} for systems like yours.`;
            };
            
            // Calculate performance score (0-100)
            const calculatePerformanceScore = () => {
              let score = 50; // Base score
              
              // Balance point contribution (lower is better, max 30 points)
              if (result.balancePoint != null && isFinite(result.balancePoint)) {
                if (result.balancePoint < 20) score += 30;
                else if (result.balancePoint < 25) score += 25;
                else if (result.balancePoint < 30) score += 15;
                else if (result.balancePoint < 35) score += 5;
                else score -= 10; // Penalty for high balance point
              }
              
              // Heat loss percentile contribution (higher is better, max 20 points)
              if (percentile >= 90) score += 20;
              else if (percentile >= 80) score += 15;
              else if (percentile >= 70) score += 10;
              else if (percentile >= 50) score += 5;
              else if (percentile >= 30) score -= 5;
              else score -= 15; // Penalty for low percentile
              
              // Clamp to 0-100
              return Math.max(0, Math.min(100, Math.round(score)));
            };
            const performanceScore = calculatePerformanceScore();
            
            // Get score label and color
            const getScoreLabel = (score) => {
              if (score >= 85) return { label: 'Excellent', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30', borderColor: 'border-green-300 dark:border-green-700' };
              if (score >= 70) return { label: 'Good', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30', borderColor: 'border-blue-300 dark:border-blue-700' };
              if (score >= 55) return { label: 'Fair', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', borderColor: 'border-yellow-300 dark:border-yellow-700' };
              return { label: 'Needs Improvement', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/30', borderColor: 'border-orange-300 dark:border-orange-700' };
            };
            const scoreInfo = getScoreLabel(performanceScore);
            
            return (
              <>
                {/* Performance Score Card - Top */}
                <div className={`bg-gradient-to-br ${scoreInfo.bgColor} rounded-xl shadow-lg p-6 mb-6 border-2 ${scoreInfo.borderColor}`}>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Performance Score</div>
                      <div className="flex items-baseline gap-3">
                        <div className={`text-5xl font-bold ${scoreInfo.color}`}>
                          {performanceScore}
                        </div>
                        <div className={`text-xl font-semibold ${scoreInfo.color}`}>
                          / 100
                        </div>
                      </div>
                      <div className={`text-lg font-medium mt-2 ${scoreInfo.color}`}>
                        {scoreInfo.label}
                      </div>
                    </div>
                    <div className="text-right">
                      {result.balancePoint != null && isFinite(result.balancePoint) && (
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Balance Point: <span className="font-semibold text-gray-900 dark:text-white">{result.balancePoint.toFixed(1)}°F</span>
                        </div>
                      )}
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Efficiency: <span className="font-semibold text-gray-900 dark:text-white">Top {percentile}%</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* CIVILIAN MODE: 4 Simple Blocks */}
                
                {/* Block 1: Headline Verdict */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-6 border border-gray-200 dark:border-gray-700">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Your system in plain English</h2>
                  <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                    {getSystemDescription()}
                  </p>
                </div>

                {/* Block 2: Money & Comfort Summary */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-xl p-6 mb-6 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
                      <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Annual waste</div>
                        <div className="text-3xl font-bold text-gray-900 dark:text-white">
                          {typeof annualWaste === 'number'
                            ? `~$${Math.round(annualWaste)}/year`
                            : 'Minimal'}
                        </div>
                      </div>
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Comfort risk</div>
                      <div className={`text-3xl font-bold ${
                        comfortRisk === 'Low' ? 'text-green-600 dark:text-green-400' :
                        comfortRisk === 'Medium' ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {comfortRisk}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Based on your thermostat data and typical weather for your area.
                  </p>
                </div>

                {/* Block 3: One Primary Recommendation */}
                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950 rounded-xl p-8 mb-6 border-2 border-amber-300 dark:border-amber-700 shadow-lg">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Suggested adjustments</h3>
                      <p className="text-lg text-gray-800 dark:text-gray-200 mb-2 font-semibold">
                        {primaryRecommendation.title}
                      </p>
                      <p className="text-gray-700 dark:text-gray-300">
                        {primaryRecommendation.body}
                      </p>
                    </div>
                  </div>
                  {primaryRecommendation.showWhy && (
                    <button
                      onClick={() => {
                        setShowNerdMode(true);
                        setTimeout(() => {
                          document.getElementById('balance-point-explanation')?.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                      }}
                      className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold transition-colors shadow-md"
                    >
                      Show me why
                    </button>
                  )}
                </div>

                {/* Block 4: Bill Calibration Hint */}
                {latestAnalysis && latestAnalysis.heatLossFactor && annualEstimate && (() => {
                  // Calculate variance if we have bill data
                  const billVariance = null; // Would need bill data to calculate
                  const varianceText = billVariance ? 
                    (Math.abs(billVariance) <= 0.1 ? 
                      `Our physics estimate is within ${Math.round(Math.abs(billVariance) * 100)}% of your real bill. This looks dialed in 👍` :
                      `We're off by ~${Math.round(Math.abs(billVariance) * 100)}%. Something else is using power — we'll help you hunt it down.`) :
                    null;
                  
                  if (!varianceText) return null;
                  
                  return (
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 mb-6 border border-gray-200 dark:border-gray-800">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {varianceText}
                      </p>
                    </div>
                  );
                })()}

                {/* NERD MODE TOGGLE */}
                <div className="text-center mb-6">
                  <button
                    id="nerd-mode-toggle"
                    onClick={() => setShowNerdMode(!showNerdMode)}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 underline"
                  >
                    {showNerdMode ? 'Hide technical details ↑' : 'Show technical details ↓'}
                  </button>
                </div>

                {/* NERD MODE: All Technical Details */}
                {showNerdMode && (
                  <div className="mb-6">
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-800 mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        Nerd Mode: Engineering Details
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Stuff your inspector, engineer, or Reddit friend will ask about.
                      </p>
                    </div>
                    
                    <div className="space-y-6">
                    {/* Status strip for nerds */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
                      <div className="flex items-center justify-between flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-4">
                          {file && (
                            <div className="text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Last upload:</span> {file.name}
                            </div>
                          )}
                          {result.heatLossSource !== 'measured' && (
                            <details className="group">
                              <summary className="cursor-pointer text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 list-none">
                                <span className="flex items-center gap-1">
                                  🔍 <span>We couldn't find a long "system OFF" period in your data.</span>
                                  <ChevronDown size={14} className="inline group-open:rotate-180 transition-transform" />
                                </span>
                              </summary>
                              <div className="mt-2 pl-5 text-xs text-gray-600 dark:text-gray-400 border-l-2 border-amber-300 dark:border-amber-700">
                                We used a typical heat-loss curve for a {squareFeet}-sq-ft home instead. 
                                Upload data with longer "off" periods to get a measured value.
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>

                      {/* Technical Analysis Results */}
                      <div id="analysis-details" className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700 mb-6">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                          <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-3">
                        <BarChart3 size={24} className="text-blue-600 dark:text-blue-400" />
                        📊 Analysis Results
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {result.heatLossSource === 'measured' 
                          ? "Measured from your thermostat data"
                          : result.heatLossSource === 'design'
                          ? "Using design / Manual J estimate"
                          : "Using estimated heat loss"}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {result && (
                        <ShareButtons
                          title={`Analysis Results - ${labels[0] || 'Heat Loss Analysis'}`}
                          text={`Heat Loss Factor: ${result?.heatLossFactor?.toFixed(1) || 'N/A'} BTU/hr/°F. Balance Point: ${result?.balancePoint != null && isFinite(result.balancePoint) ? result.balancePoint.toFixed(1) : 'N/A'}°F`}
                          url={createShareableLink(result)}
                          data={result}
                        />
                      )}
                <button
                  onClick={() => {
                    const result = resultsHistory[0];
                    if (!result) return;
                    const exportData = {
                      ...result,
                      exportedAt: new Date().toISOString(),
                      homeInfo: {
                        squareFeet: userSettings?.squareFeet,
                        buildingType: userSettings?.homeShape >= 2.0 ? 'Cabin/A-Frame' : 
                                     userSettings?.homeShape >= 1.12 ? 'Manufactured' :
                                     userSettings?.homeShape >= 1.05 ? 'Ranch' :
                                     userSettings?.homeShape >= 0.95 ? 'Split-Level' : 'Two-Story',
                        insulationLevel: userSettings?.insulationLevel,
                        ceilingHeight: userSettings?.ceilingHeight,
                      }
                    };
                    const dataStr = JSON.stringify(exportData, null, 2);
                    const blob = new Blob([dataStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `analysis-${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  aria-label="Export analysis as JSON"
                >
                  <Copy size={16} />
                  Export JSON
                </button>
                      <button
                        onClick={() => {
                          if (!result) return;
                          const csv = `Metric,Value,Unit
Heat Loss Factor,${result.heatLossFactor?.toFixed(1) || 'N/A'},BTU/hr/°F
Balance Point,${result.balancePoint != null && isFinite(result.balancePoint) ? result.balancePoint.toFixed(1) : 'N/A'},°F
Total Heat Loss (Design),${result.heatLossTotal?.toFixed(0) || 'N/A'},BTU/hr
Temperature Difference,${result.tempDiff?.toFixed(1) || 'N/A'},°F
Analysis Date,${result.date || new Date(result.timestamp).toLocaleDateString()},
Square Feet,${userSettings?.squareFeet || 'N/A'},sq ft
Heat Loss per Sq Ft,${result.heatLossFactor && userSettings?.squareFeet ? (result.heatLossFactor / userSettings.squareFeet).toFixed(3) : 'N/A'},BTU/hr/°F per sq ft`;
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `analysis-${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  aria-label="Export analysis as CSV"
                >
                      <Copy size={16} />
                      Export CSV
                    </button>
                  </div>
                </div>

                  {/* Building vs System Metrics - Side by Side */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Left: Your Building */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Home size={20} className="text-blue-600 dark:text-blue-400" />
                        Your Building
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Heat Loss Factor</div>
                          <div className="text-3xl font-bold text-gray-900 dark:text-white">
                            {result.heatLossFactor?.toFixed(1) || 'N/A'}
                            <span className="text-lg font-normal ml-2 text-gray-500 dark:text-gray-400">BTU/hr/°F</span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {result.heatLossSource === 'measured' ? 'Measured from thermostat data' : 
                             result.heatLossSource === 'design' ? 'From Manual J / design estimate' : 
                             'Estimated from home characteristics'}
                          </div>
                        </div>
                        {result.heatLossTotal && (
                          <div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Heat Loss (Design)</div>
                            <div className="text-xl font-semibold text-gray-900 dark:text-white">
                              {result.heatLossTotal.toFixed(0)} BTU/hr
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Your System */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Zap size={20} className="text-green-600 dark:text-green-400" />
                        Your System
                      </h3>
                      <div className="space-y-4">
                        {result.balancePoint != null && isFinite(result.balancePoint) && (
                          <div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Balance Point</div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white">
                              {result.balancePoint.toFixed(1)}°F
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {result.balancePoint < 25 ? 'Excellent - handles most cold days' :
                               result.balancePoint < 30 ? 'Good - aux heat runs occasionally' :
                               'High - aux heat runs frequently'}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Efficiency Comparison Bar */}
                  {(() => {
                    const calculatePercentile = (heatLossFactor) => {
                      if (heatLossFactor < 300) return 98;
                      if (heatLossFactor < 400) return 95;
                      if (heatLossFactor < 500) return 90;
                      if (heatLossFactor < 550) return 80;
                      if (heatLossFactor < 600) return 70;
                      if (heatLossFactor < 650) return 60;
                      if (heatLossFactor < 700) return 50;
                      if (heatLossFactor < 800) return 35;
                      if (heatLossFactor < 900) return 25;
                      if (heatLossFactor < 1100) return 15;
                      if (heatLossFactor < 1300) return 10;
                      if (heatLossFactor < 1800) return 5;
                      return 2;
                    };
                    const percentile = result.heatLossFactor ? calculatePercentile(result.heatLossFactor) : 50;
                    const positionPercent = percentile >= 50 ? percentile : (100 - percentile);
                    const clampedPosition = Math.max(0, Math.min(100, positionPercent));
                    
                    return (
                      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">How You Compare</h3>
                        <div className="mb-4">
                          <div className="text-2xl font-extrabold mb-1" style={{
                            color: percentile >= 70 ? '#22c55e' : percentile >= 40 ? '#f59e0b' : '#ef4444'
                          }}>
                            {percentile >= 50 ? `Top ${percentile}%` : `Bottom ${100 - percentile}%`}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {percentile >= 70 ? 'More efficient than most homes' : 
                             percentile >= 40 ? 'Average efficiency compared to typical homes' : 
                             'Less efficient than most homes - consider insulation upgrades'}
                          </p>
                        </div>
                        <div className="w-full">
                          <div className="flex justify-between mb-2 text-xs font-semibold">
                            <span className="text-red-600 dark:text-red-400">Worse than peers</span>
                            <span className="text-gray-500 dark:text-gray-400">Average</span>
                            <span className="text-green-600 dark:text-green-400">Efficient</span>
                            <span className="text-green-700 dark:text-green-500">Elite</span>
                          </div>
                          <div className="relative w-full h-8 rounded-full overflow-hidden shadow-inner bg-gray-200 dark:bg-gray-700" aria-label="Home efficiency percentile bar">
                            <div className="absolute inset-0 rounded-full"
                                 style={{ background: 'linear-gradient(90deg, #ef4444 0%, #ef4444 30%, #f59e0b 30%, #f59e0b 80%, #22c55e 80%, #22c55e 100%)' }}
                            />
                            <div
                              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-700"
                              style={{ left: `${clampedPosition}%` }}
                            >
                              <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-sm font-bold px-3 py-1 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-lg whitespace-nowrap border-2 border-blue-500">
                                You
                              </div>
                              <div className="w-8 h-8 rounded-full border-4 border-white dark:border-gray-900 bg-blue-600 dark:bg-blue-500 shadow-lg"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                      
                      {/* Real-Time Heat Loss Card */}
              {result.heatLossFactor != null && (() => {
                const indoorTemp = userSettings?.winterThermostat || 68;
                const currentOutdoorTemp = 35; // Could fetch from weather API, default to 35°F
                const designTemp = 30;
                const extremeTemp = 0;
                
                const currentHeatLoss = calculateHeatLoss({
                  outdoorTemp: currentOutdoorTemp,
                  indoorTemp,
                  heatLossFactor: result.heatLossFactor,
                });
                
                const designHeatLoss = calculateHeatLoss({
                  outdoorTemp: designTemp,
                  indoorTemp,
                  heatLossFactor: result.heatLossFactor,
                });
                
                const extremeHeatLoss = calculateHeatLoss({
                  outdoorTemp: extremeTemp,
                  indoorTemp,
                  heatLossFactor: result.heatLossFactor,
                });

                return (
                  <div className="bg-gradient-to-br from-purple-900/50 to-indigo-900/50 dark:from-purple-950/50 dark:to-indigo-950/50 border-2 border-purple-700 dark:border-purple-600 rounded-xl p-6 mb-6 shadow-lg">
                    <h3 className="text-lg font-bold text-purple-200 dark:text-purple-300 mb-4 flex items-center gap-2">
                      <Zap size={20} />
                      Estimated Heat Loss per Hour
                    </h3>
                    <p className="text-sm text-purple-200/80 dark:text-purple-300/80 mb-4">
                      Based on your building's Thermal Factor of {result.heatLossFactor.toFixed(1)} BTU/hr/°F
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white/10 dark:bg-gray-900/30 rounded-lg p-4 border border-purple-600/50">
                        <div className="text-xs text-purple-200/70 dark:text-purple-300/70 mb-1">
                          Current Conditions
                        </div>
                        <div className="text-2xl font-bold text-white mb-1">
                          {currentHeatLoss.heatLossBtuPerHour?.toLocaleString() || 'N/A'}
                          <span className="text-sm font-normal ml-1">BTU/hr</span>
                        </div>
                        <div className="text-xs text-purple-200/60 dark:text-purple-300/60">
                          {currentOutdoorTemp}°F outdoor, {indoorTemp}°F indoor
                        </div>
                      </div>
                      <div className="bg-white/10 dark:bg-gray-900/30 rounded-lg p-4 border border-purple-600/50">
                        <div className="text-xs text-purple-200/70 dark:text-purple-300/70 mb-1">
                          Design Conditions
                        </div>
                        <div className="text-2xl font-bold text-white mb-1">
                          {designHeatLoss.heatLossBtuPerHour?.toLocaleString() || 'N/A'}
                          <span className="text-sm font-normal ml-1">BTU/hr</span>
                        </div>
                        <div className="text-xs text-purple-200/60 dark:text-purple-300/60">
                          {designTemp}°F outdoor, {indoorTemp}°F indoor
                        </div>
                      </div>
                      <div className="bg-white/10 dark:bg-gray-900/30 rounded-lg p-4 border border-purple-600/50">
                        <div className="text-xs text-purple-200/70 dark:text-purple-300/70 mb-1">
                          Extreme Conditions
                        </div>
                        <div className="text-2xl font-bold text-white mb-1">
                          {extremeHeatLoss.heatLossBtuPerHour?.toLocaleString() || 'N/A'}
                          <span className="text-sm font-normal ml-1">BTU/hr</span>
                        </div>
                        <div className="text-xs text-purple-200/60 dark:text-purple-300/60">
                          {extremeTemp}°F outdoor, {indoorTemp}°F indoor
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-purple-200/60 dark:text-purple-300/60 mt-4">
                      Ask Joule: "What is my heat loss at [temperature] degrees?" for specific calculations
                    </p>
                  </div>
                );
              })()}

              {/* Recommendations Section - New */}
              <details className="bg-green-900/30 dark:bg-green-950/30 rounded-lg border-2 border-green-700 dark:border-green-600 shadow-lg mb-4">
                <summary className="p-4 cursor-pointer font-semibold text-lg text-green-200 hover:bg-green-800/30 dark:hover:bg-green-900/30 rounded-lg transition-colors flex items-center gap-2">
                  💡 Recommendations
                </summary>
                <div className="p-6 border-t border-green-700/50 space-y-4 text-sm">
                  {(() => {
                    const recommendations = [];
                    const positiveFeedback = [];
                    const heatLossPerSqFt = result.heatLossFactor != null && squareFeet > 0 
                      ? result.heatLossFactor / squareFeet 
                      : null;
                    const homeShape = userSettings?.homeShape || 0.9;
                    const insulationLevel = userSettings?.insulationLevel || 1.0;
                    const ceilingHeight = userSettings?.ceilingHeight || 8;
                    
                    // Calculate baseline factor using the same formula as Home.jsx
                    const BASE_BTU_PER_SQFT_HEATING = 22.67;
                    const ceilingMultiplier = 1 + ((ceilingHeight - 8) * 0.1);
                    const designHeatLoss = squareFeet * BASE_BTU_PER_SQFT_HEATING * insulationLevel * homeShape * ceilingMultiplier;
                    const baselineFactor = designHeatLoss / 70; // Convert to BTU/hr/°F
                    const shapeAdjustedFactor = baselineFactor; // Already includes homeShape
                    
                    // Master check: If heat loss is very high, fire ONE comprehensive insulation recommendation
                    // Don't fire sub-checks (per-sqft, geometry) if main check already failed
                    const hasHighHeatLoss = result.heatLossFactor != null && result.heatLossFactor >= 800;
                    const hasMediumHeatLoss = result.heatLossFactor != null && result.heatLossFactor >= 500 && result.heatLossFactor < 800;
                    
                    // Heat Loss Factor Recommendations (Master Check)
                    if (hasHighHeatLoss) {
                      recommendations.push({
                        priority: 'high',
                        title: 'Insulation & Air Sealing',
                        description: 'Your heat loss is high. Consider adding insulation, sealing air leaks, and upgrading windows to reduce heating costs.',
                        impact: 'High - Can reduce heating costs by 20-30%'
                      });
                    } else if (hasMediumHeatLoss) {
                      recommendations.push({
                        priority: 'medium',
                        title: 'Targeted Improvements',
                        description: 'Your home has room for improvement. Focus on attic insulation, air sealing around windows/doors, and weatherstripping.',
                        impact: 'Medium - Can reduce heating costs by 10-20%'
                      });
                    }
                    
                    // Per Square Foot Recommendations (ONLY if main check didn't fire)
                    if (!hasHighHeatLoss && heatLossPerSqFt != null) {
                      if (heatLossPerSqFt >= 0.45) {
                        recommendations.push({
                          priority: 'high',
                          title: 'Insulation Upgrade Priority',
                          description: `Your normalized heat loss (${heatLossPerSqFt.toFixed(3)} BTU/hr/°F per sq ft) indicates poor insulation quality. Prioritize attic and wall insulation.`,
                          impact: 'High - Address insulation quality'
                        });
                      } else if (heatLossPerSqFt >= 0.35) {
                        recommendations.push({
                          priority: 'medium',
                          title: 'Insulation Quality',
                          description: `Your normalized heat loss (${heatLossPerSqFt.toFixed(3)} BTU/hr/°F per sq ft) is average. Consider targeted insulation improvements.`,
                          impact: 'Medium - Improve insulation in key areas'
                        });
                      }
                    }
                    
                    // Building Geometry Recommendations (ONLY if main check didn't fire)
                    if (!hasHighHeatLoss && result.heatLossFactor != null && result.heatLossFactor > shapeAdjustedFactor * 1.1) {
                      recommendations.push({
                        priority: 'high',
                        title: 'Above Expected for Building Type',
                        description: 'Your heat loss is higher than expected for your building type. This suggests insulation or air sealing issues beyond normal geometry factors.',
                        impact: 'High - Address insulation/air sealing gaps'
                      });
                    }
                    
                    // Percentile-based Recommendations - Only show if we don't already have specific insulation recommendations
                    // Avoid redundancy: if we already said "fix insulation", don't also say "you're bad, fix insulation"
                    if (percentile < 40 && !hasHighHeatLoss && !hasMediumHeatLoss) {
                      // Only show generic "below average" if we haven't already flagged specific issues
                      // If heat loss is high, we've already covered it with specific recommendations
                      recommendations.push({
                        priority: 'high',
                        title: 'Window & HVAC System Check',
                        description: `Your home ranks in the bottom ${100 - percentile}% for efficiency. Beyond insulation, consider window upgrades (double/triple pane) and verify your HVAC system is properly sized and maintained.`,
                        impact: 'High - Address windows and HVAC system efficiency'
                      });
                    } else if (percentile >= 90) {
                      // Level 99: Elite Optimization Advice for Super Users
                      // Replace generic "good job" with advanced optimization strategies
                      
                      // 1. Aggressive Setback Play
                      if (result.heatLossFactor != null && result.heatLossFactor < 400) {
                        recommendations.push({
                          priority: 'medium',
                          title: 'Enable Deep Setbacks',
                          description: `Your thermal factor is ${result.heatLossFactor.toFixed(1)} BTU/hr/°F—excellent heat retention. You can turn heat OFF for 4 hours at night, lose only 2°F, and save money without discomfort. Most houses can't do this; yours can.`,
                          impact: 'Medium - Save 15-25% on heating costs with aggressive setbacks'
                        });
                      }
                      
                      // 2. Time-of-Use Arbitrage
                      recommendations.push({
                        priority: 'medium',
                        title: 'Pre-Cool/Pre-Heat Strategy',
                        description: 'Your thermal mass is excellent. Over-cool the house by 2°F before 4 PM (peak rates) and coast through expensive hours for free. Your house holds temperature so well that you can arbitrage time-of-use rates.',
                        impact: 'Medium - Reduce peak rate costs by 30-40%'
                      });
                      
                      // 3. Hardware Longevity Check
                      recommendations.push({
                        priority: 'low',
                        title: 'Check Static Pressure',
                        description: 'Your system is efficient, but is it breathing? High-efficiency systems often suffer from restrictive filters. Verify filter MERV rating is <11 to protect blower motor life. Your excellent insulation means the system runs less, but when it runs, ensure it\'s not fighting a dirty/restrictive filter.',
                        impact: 'Low - Protect equipment longevity, maintain efficiency'
                      });
                      
                    } else if (percentile >= 70 && !hasHighHeatLoss && !hasMediumHeatLoss) {
                      // Only show "Top Performer" if we haven't already flagged insulation issues
                      recommendations.push({
                        priority: 'low',
                        title: 'Top Performer',
                        description: `Your home ranks in the top ${percentile}% for efficiency. Focus on maintaining this performance with regular maintenance.`,
                        impact: 'Low - Maintain excellent efficiency'
                      });
                    }
                    
                    // Balance Point Recommendations - ACTIONABLE ONLY (high balance point = problem)
                    if (result.balancePoint != null && isFinite(result.balancePoint) && result.balancePoint >= 30) {
                      recommendations.push({
                        priority: 'medium',
                        title: 'High Balance Point',
                        description: `Your balance point is ${result.balancePoint.toFixed(1)}°F, meaning auxiliary heat runs frequently. Consider a larger heat pump or better insulation to lower this.`,
                        impact: 'Medium - Reduce auxiliary heat usage'
                      });
                    }
                    
                    // Positive Feedback - Separate from actionable recommendations
                    if (result.balancePoint != null && isFinite(result.balancePoint) && result.balancePoint < 25) {
                      positiveFeedback.push({
                        title: 'Excellent Balance Point',
                        description: `Your balance point of ${result.balancePoint.toFixed(1)}°F is excellent. Your heat pump handles most cold days efficiently.`
                      });
                    }
                    
                    if (result.heatLossFactor != null && result.heatLossFactor < 500 && percentile >= 70) {
                      positiveFeedback.push({
                        title: 'Excellent Insulation',
                        description: 'Your home has excellent thermal efficiency. Keep up with regular maintenance to maintain this performance.'
                      });
                    }
                    
                    // Sort by priority (high, medium, low)
                    const priorityOrder = { high: 0, medium: 1, low: 2 };
                    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
                    
                    return (
                      <div className="space-y-4">
                        {/* Positive Feedback Section - Separate from actionable items */}
                        {positiveFeedback.length > 0 && (
                          <div className="mb-4">
                            <h4 className="font-bold text-green-300 mb-2 text-base">✅ What's Working Well</h4>
                            <div className="space-y-2">
                              {positiveFeedback.map((feedback, idx) => (
                                <div
                                  key={idx}
                                  className="p-3 rounded-lg bg-green-900/20 border border-green-700/50"
                                >
                                  <h5 className="font-semibold text-green-200 mb-1">{feedback.title}</h5>
                                  <p className="text-green-300 text-sm">{feedback.description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Actionable Recommendations */}
                        {recommendations.length === 0 ? (
                          <div className="text-center py-4 text-gray-400">
                            <p>No specific recommendations available. Review the detailed analysis below for more information.</p>
                          </div>
                        ) : (
                          <div>
                            <h4 className="font-bold text-gray-200 mb-3 text-base">🔧 Action Items</h4>
                            <div className="space-y-3">
                              {recommendations.map((rec, idx) => (
                                <div
                                  key={idx}
                                  className={`p-4 rounded-lg border-2 ${
                                    rec.priority === 'high'
                                      ? 'bg-red-900/20 border-red-700/50'
                                      : rec.priority === 'medium'
                                      ? 'bg-yellow-900/20 border-yellow-700/50'
                                      : 'bg-green-900/20 border-green-700/50'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm ${
                                      rec.priority === 'high'
                                        ? 'bg-red-600 text-white'
                                        : rec.priority === 'medium'
                                        ? 'bg-yellow-600 text-white'
                                        : 'bg-green-600 text-white'
                                    }`}>
                                      {idx + 1}
                                    </div>
                                    <div className="flex-1">
                                      <h4 className="font-bold text-gray-200 mb-1">{rec.title}</h4>
                                      <p className="text-gray-300 mb-2">{rec.description}</p>
                                      <p className={`text-xs font-semibold ${
                                        rec.priority === 'high'
                                          ? 'text-red-300'
                                          : rec.priority === 'medium'
                                          ? 'text-yellow-300'
                                          : 'text-green-300'
                                      }`}>
                                        Impact: {rec.impact}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Recommended Threshold Settings */}
                {(() => {
                // Use stored recommendations if available, otherwise calculate on-the-fly
                let recommendations = thresholdRecommendations;
                
                // If no stored recommendations, try to calculate from current data
                if (!recommendations && result && parsedCsvRows) {
                  recommendations = calculateThresholdRecommendations(
                    result,
                    parsedCsvRows,
                    { squareFeet: userSettings?.squareFeet || 2000 }
                  );
                }

                if (!recommendations || !recommendations.settings || Object.keys(recommendations.settings).length === 0) {
                  return null;
                }

                const copyToClipboard = () => {
                  const jsonStr = JSON.stringify({
                    profile: recommendations.profile,
                    reason: recommendations.reason,
                    settings: recommendations.settings,
                  }, null, 2);
                  navigator.clipboard.writeText(jsonStr).then(() => {
                    setCopiedThresholdSettings(true);
                    setTimeout(() => setCopiedThresholdSettings(false), 2000);
                  });
                };

                return (
                  <div className="mt-6 pt-6 border-t border-green-700/50">
                    <h3 className="text-xl font-bold text-green-200 mb-4 flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-lg">
                        <Settings size={24} />
                      </div>
                      Recommended Threshold Settings
                    </h3>
                    <div className="space-y-4">
                      <p className="text-indigo-200 dark:text-indigo-300 mb-2">{recommendations.reason}</p>
                      <p className="text-sm text-indigo-300/80 dark:text-indigo-400/80 mb-4">
                        Based on your CSV analysis. Go to your ecobee thermostat: <strong>Main Menu → Settings → Installation Settings → Thresholds</strong>
                      </p>
                      
                      <div className="bg-gray-900/50 dark:bg-gray-950/50 rounded-lg p-4 mb-4 border border-indigo-600/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          {Object.entries(recommendations.settings).map(([key, value]) => (
                            <div key={key} className="flex justify-between items-center py-2 border-b border-gray-700/50 last:border-b-0">
                              <span className="text-gray-300 dark:text-gray-400 capitalize">
                                {key.replace(/_/g, ' ')}
                              </span>
                              <span className="font-bold text-indigo-300 dark:text-indigo-400">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* JSON Config - Hidden in collapsed details for advanced users */}
                      <details className="bg-gray-900/30 dark:bg-gray-950/30 rounded-lg border border-indigo-600/30">
                        <summary className="cursor-pointer p-4 list-none">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-300 dark:text-gray-400">Advanced: View/Copy JSON for Automation</span>
                            <ChevronDown size={16} className="text-gray-400" />
                          </div>
                        </summary>
                        <div className="px-4 pb-4 pt-0">
                          <div className="flex items-center justify-end mb-2">
                            <button
                              onClick={copyToClipboard}
                              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors"
                            >
                              {copiedThresholdSettings ? (
                                <>
                                  <Check size={16} />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy size={16} />
                                  Copy JSON
                                </>
                              )}
                            </button>
                          </div>
                          <pre className="text-xs text-gray-300 dark:text-gray-400 bg-gray-950/50 p-3 rounded overflow-x-auto">
                            {JSON.stringify({
                              profile: recommendations.profile,
                              reason: recommendations.reason,
                              settings: recommendations.settings,
                            }, null, 2)}
                          </pre>
                        </div>
                      </details>

                      {recommendations.metadata && (
                        <div className="text-xs text-indigo-300/70 dark:text-indigo-400/70 space-y-1">
                          <p><strong>Analysis Data:</strong> Balance Point: {recommendations.metadata.balancePoint || 'N/A'}°F | Heat Loss Factor: {recommendations.metadata.heatLossFactor || 'N/A'} BTU/hr/°F | Cycles/Hour: {recommendations.metadata.cyclesPerHour}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
              </details>

              {/* Understanding These Numbers - Collapsed by Default */}
              <details className="mt-6 pt-6 border-t border-green-700/50">
                <summary className="cursor-pointer list-none">
                  <h3 className="text-xl font-bold text-green-200 mb-4 inline-flex items-center gap-2">
                    📊 Understanding These Numbers
                    <ChevronDown size={20} className="text-green-300" />
                  </h3>
                </summary>
                <div className="mt-4">
                <div className="space-y-4 text-sm text-gray-300 dark:text-gray-400">
                  
                  {/* Total Heat Loss */}
                  <div>
                    <p className="font-bold text-gray-200 mb-2">Total Heat Loss at Design Conditions</p>
                    <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                      Total Heat Loss = Heat Loss Factor * 70°F ΔT<br />
                      = {result.heatLossFactor?.toFixed(1) || 'N/A'} BTU/hr/°F * 70°F<br />
                      = <strong>{(result.heatLossFactor !== null && result.heatLossFactor !== undefined) 
                        ? (result.heatLossFactor * 70).toLocaleString(undefined, { maximumFractionDigits: 0 }) 
                        : 'N/A'} BTU/hr</strong><br />
                      <br />
                      (70°F indoor / 0°F outdoor design condition)
                    </code>
                  </div>

                  {/* What is ΔT */}
                  <div>
                    <p className="font-bold text-gray-200 mb-2">📐 What is ΔT (70°F)?</p>
                    <p>We report heat loss at a standardized temperature difference of 70°F (indoor 70°F vs outdoor 0°F). This makes results comparable between homes and useful for sizing heating equipment. To estimate heat loss at other conditions, multiply the BTU/hr/°F factor by your actual temperature difference.</p>
                  </div>

                  {/* Per Square Foot Analysis */}
                  {result.heatLossFactor != null && (() => {
                    const sqFt = userSettings?.squareFeet || activeZone?.squareFeet || 0;
                    const heatLossPerSqFt = result.heatLossFactor && sqFt > 0
                      ? result.heatLossFactor / sqFt
                      : null;
                    if (heatLossPerSqFt == null) return null;
                    return (
                    <div>
                      <p className="font-bold text-gray-200 mb-2">📏 Normalized Per-Square-Foot Factor</p>
                      <p className="mb-2">
                        <strong>Your home (from CSV analysis):</strong> {heatLossPerSqFt.toFixed(3)} BTU/hr/°F per sq ft
                        {heatLossPerSqFt < 0.25 && <span className="text-green-400 ml-2">✓ Excellent insulation</span>}
                        {heatLossPerSqFt >= 0.25 && heatLossPerSqFt < 0.35 && <span className="text-blue-400 ml-2">✓ Good insulation</span>}
                        {heatLossPerSqFt >= 0.35 && heatLossPerSqFt < 0.45 && <span className="text-yellow-400 ml-2">○ Average insulation</span>}
                        {heatLossPerSqFt >= 0.45 && <span className="text-orange-400 ml-2">! Consider upgrades</span>}
                      </p>
                      <code className="block p-3 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700 mb-2" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                        Normalized Factor = Heat Loss Factor / Square Feet<br />
                        = {result.heatLossFactor.toFixed(1)} BTU/hr/°F / {sqFt.toLocaleString()} sq ft<br />
                        = <strong>{heatLossPerSqFt.toFixed(3)} BTU/hr/°F per sq ft</strong>
                      </code>
                      <div className="bg-gray-800/40 p-3 rounded-lg text-sm space-y-1 mb-2">
                        <p className="font-semibold text-gray-200 mb-1">📊 Benchmarks:</p>
                        <p>• <strong>Modern new build:</strong> &lt;0.5 BTU/hr/°F per sq ft</p>
                        <p>• <strong>Well-insulated (2010+):</strong> 0.25-0.35 BTU/hr/°F per sq ft</p>
                        <p>• <strong>Average (1980-2010):</strong> 0.35-0.45 BTU/hr/°F per sq ft</p>
                        <p>• <strong>Older home (pre-1980):</strong> &gt;0.45 BTU/hr/°F per sq ft</p>
                        {heatLossPerSqFt >= 0.5 && (
                          <p className="text-orange-400 font-semibold mt-2">
                            ⚠️ Your home is losing {((heatLossPerSqFt / 0.5).toFixed(1))}x the heat of a modern new build.
                          </p>
                        )}
                        {heatLossPerSqFt >= 0.45 && heatLossPerSqFt < 0.5 && (
                          <p className="text-yellow-400 font-semibold mt-2">
                            Your home is losing {((heatLossPerSqFt / 0.5).toFixed(1))}x the heat of a modern new build.
                          </p>
                        )}
                        {heatLossPerSqFt < 0.5 && heatLossPerSqFt >= 0.35 && (
                          <p className="text-blue-400 font-semibold mt-2">
                            ✓ Your home performs better than average, but modern builds achieve &lt;0.5.
                          </p>
                        )}
                        {heatLossPerSqFt < 0.35 && (
                          <p className="text-green-400 font-semibold mt-2">
                            ✓ Excellent! Your home matches or exceeds modern build standards.
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">To compare homes of different sizes fairly, we divide your heat loss factor by your floor area. This normalized metric is a better indicator of insulation quality than the raw factor.</p>
                    </div>
                    );
                  })()}

                  {/* Building Geometry Context - Enhanced */}
                  {result.heatLossFactor != null && (
                    <div className="p-4 bg-blue-900/20 dark:bg-blue-950/20 border border-blue-700/30 rounded-lg space-y-3">
                      <p className="font-bold text-blue-300 mb-2">🏠 Building Geometry Matters</p>
                      
                      {/* Size-based context */}
                      <div>
                        <p className="font-semibold text-gray-200 text-sm mb-1">Your Home Size: {squareFeet.toLocaleString()} sq ft</p>
                        <p className="text-sm">
                          {squareFeet < 1500 ? (
                            <>⚠️ <strong>Smaller homes</strong> naturally have higher heat loss factors because they have more exterior surface area relative to their interior volume. A 1,000 sq ft home has nearly the same roof and foundation area as a 2,000 sq ft home, but half the living space—meaning more heat escapes per square foot of floor area.</>
                          ) : squareFeet > 3000 ? (
                            <>✓ <strong>Larger homes</strong> benefit from better surface-area-to-volume ratios. As homes get bigger, the ratio of exterior walls, roof, and foundation to interior volume decreases, resulting in lower heat loss per square foot. This geometric advantage can make large homes appear more efficient even with average insulation.</>
                          ) : (
                            <>ℹ️ <strong>Medium-sized homes</strong> like yours fall in the middle of the efficiency spectrum. Your total heat loss is influenced more by insulation quality and building shape than by size alone.</>
                          )}
                        </p>
                      </div>

                      {/* Building shape analysis */}
                      {(() => {
                        const homeShape = userSettings?.homeShape || 0.9;
                        const insulationLevel = userSettings?.insulationLevel || 1.0;
                        const ceilingHeight = userSettings?.ceilingHeight || 8;
                        
                        const buildingType = 
                          homeShape >= 2.0 ? 'Cabin / A-Frame' :
                          homeShape >= 1.12 ? 'Manufactured Home' :
                          homeShape >= 1.05 ? 'Ranch / Single-Story' :
                          homeShape >= 0.95 ? 'Split-Level' :
                          'Two-Story';
                        
                        // Calculate baseline factor using the same formula as Home.jsx
                        // BASE_BTU_PER_SQFT_HEATING = 22.67 BTU/hr per sq ft at 70°F ΔT
                        // Then divide by 70 to get BTU/hr/°F
                        const BASE_BTU_PER_SQFT_HEATING = 22.67;
                        const ceilingMultiplier = 1 + ((ceilingHeight - 8) * 0.1);
                        const designHeatLoss = squareFeet * BASE_BTU_PER_SQFT_HEATING * insulationLevel * homeShape * ceilingMultiplier;
                        const baselineFactor = designHeatLoss / 70; // Convert to BTU/hr/°F
                        
                        // Shape-adjusted factor is the same as baseline since homeShape is already included
                        const shapeAdjustedFactor = baselineFactor;
                        
                        return (
                          <div className="border-t border-blue-700/30 pt-3">
                            <p className="font-semibold text-gray-200 text-sm mb-1">Building Type: {buildingType}</p>
                            <p className="text-sm mb-2">
                              {homeShape >= 2.0 ? (
                                <>🏔️ <strong>Cabins and A-Frames</strong> have the <strong>highest surface-area-to-volume ratios</strong> due to steep roofs and complex geometries. The large sloped roof area adds significant heat loss compared to a conventional home. Expected multiplier: ~2.2× typical heat loss.</>
                              ) : homeShape >= 1.12 ? (
                                <>🏭 <strong>Manufactured homes</strong> often have higher heat loss due to thinner walls, minimal insulation in floor systems, and gaps from assembly. The elongated rectangular shape also increases exterior wall area. Expected multiplier: ~1.15× typical heat loss.</>
                              ) : homeShape >= 1.05 ? (
                                <>🏡 <strong>Ranch-style homes</strong> (single-story) have more roof and foundation area exposed to temperature extremes compared to their floor space. While convenient for living, this spread-out footprint increases heat loss. Expected multiplier: ~1.1× typical heat loss.</>
                              ) : homeShape >= 0.95 ? (
                                <>🏘️ <strong>Split-level homes</strong> have moderate efficiency—better than ranches due to stacked living spaces, but not as good as full two-stories. Expected multiplier: ~1.0× typical heat loss.</>
                              ) : (
                                <>🏢 <strong>Two-story homes</strong> have the <strong>most efficient geometry</strong>. By stacking living spaces vertically, you minimize roof and foundation area while maximizing interior volume. Less exterior surface area means less heat loss. Expected multiplier: ~0.9× typical heat loss.</>
                              )}
                            </p>
                            <div>
                              <p className="font-semibold text-gray-200 text-sm mb-2">For a {squareFeet.toLocaleString()} sq ft {buildingType.toLowerCase()}:</p>
                              <code className="block p-3 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700 mb-2" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                                Expected Factor (theoretical):<br />
                                = sq ft * 22.67 * insulation * shape * ceiling / 70<br />
                                = {squareFeet.toLocaleString()} * 22.67 * {insulationLevel.toFixed(2)} * {homeShape.toFixed(2)} * {ceilingMultiplier.toFixed(2)} / 70<br />
                                = <strong>~{baselineFactor.toFixed(0)} BTU/hr/°F</strong><br />
                                <br />
                                Actual Factor (from CSV analysis):<br />
                                = <strong>{result.heatLossFactor.toFixed(1)} BTU/hr/°F</strong><br />
                                (Derived from actual runtime data and temperature changes)
                              </code>
                              {result.heatLossFactor < shapeAdjustedFactor * 0.9 ? (
                                <>
                                  <p className="text-green-400 text-sm mt-2">✓ Better than expected—excellent insulation and air sealing!</p>
                                  {result.heatLossFactor < shapeAdjustedFactor * 0.5 && (
                                    <p className="text-yellow-400 text-xs mt-1 italic">
                                      ⚠️ Note: Exceptionally low measured heat loss may indicate significant solar gain or internal loads (electronics, occupants, appliances) assisting the heating system. This can make your actual heat loss appear lower than the building envelope alone would suggest.
                                    </p>
                                  )}
                                </>
                              ) : result.heatLossFactor > shapeAdjustedFactor * 1.1 ? (
                                <p className="text-orange-400 text-sm mt-2">⚠️ Higher than expected—consider insulation upgrades or air sealing.</p>
                              ) : (
                                <p className="text-blue-300 text-sm mt-2">→ Within expected range for your building type and size.</p>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Surface area explanation */}
                      <div className="border-t border-blue-700/30 pt-3">
                        <p className="font-semibold text-gray-200 text-sm mb-1">Why Surface Area Matters More Than Volume</p>
                        <p className="text-sm">
                          Heat loss occurs through the building envelope—walls, roof, windows, doors, and foundation. A compact, two-story design has less total surface area than a sprawling ranch of the same square footage. Think of it like wrapping a gift: a cube uses less wrapping paper than a flat, wide box of the same volume. The "wrapping paper" is where your heat escapes.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Benchmarks - Square Footage Adjusted */}
                  <div>
                    <p className="font-bold text-gray-200 mb-2">📊 Typical Heat Loss Factor Ranges</p>
                    <p className="text-xs text-gray-400 mb-3 italic">
                      Based on U.S. Department of Energy residential building data and ASHRAE standards. Ranges are calibrated for your home size ({squareFeet.toLocaleString()} sq ft).
                    </p>
                    
                    {(() => {
                      const homeShape = userSettings?.homeShape || 0.9;
                      const buildingType = 
                        homeShape >= 2.0 ? 'Cabin / A-Frame' :
                        homeShape >= 1.12 ? 'Manufactured Home' :
                        homeShape >= 1.05 ? 'Ranch / Single-Story' :
                        homeShape >= 0.95 ? 'Split-Level' :
                        'Two-Story';
                      
                      // Per-square-foot benchmarks (BTU/hr/°F per sq ft)
                      const perSqFtRanges = [
                        { label: 'Highly efficient (Passive House, net-zero)', min: 0.10, max: 0.15 },
                        { label: 'Well-insulated modern homes', min: 0.15, max: 0.25 },
                        { label: 'Average existing homes', min: 0.25, max: 0.50 },
                        { label: 'Older or poorly insulated', min: 0.50, max: 1.00 }
                      ];
                      
                      // Convert to absolute ranges based on square footage
                      const absoluteRanges = perSqFtRanges.map(range => ({
                        ...range,
                        min: Math.round(range.min * squareFeet),
                        max: Math.round(range.max * squareFeet)
                      }));
                      
                      return (
                        <>
                          <div>
                            <p className="text-sm font-semibold text-gray-200 mb-2">
                              For your {squareFeet.toLocaleString()} sq ft {buildingType.toLowerCase()}:
                            </p>
                            <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700 mb-3" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                              {absoluteRanges.map((range, i) => (
                                <span key={i}>
                                  ~{range.min}-{range.max} BTU/hr/°F: {range.label}
                                  {result.heatLossFactor >= range.min && result.heatLossFactor <= range.max && (
                                    <span className="text-blue-400"> &lt;-- You are here</span>
                                  )}
                                  {i < absoluteRanges.length - 1 && <><br /></>}
                                </span>
                              ))}
                              {result.heatLossFactor < absoluteRanges[0].min && (
                                <>
                                  <br />
                                  <br />
                                  <span className="text-green-400">
                                    Exceptional! Your measured heat loss ({result.heatLossFactor.toFixed(1)} BTU/hr/°F) is below Passive House levels. This may indicate significant solar gain or internal loads (electronics, occupants) assisting your heating system.
                                  </span>
                                </>
                              )}
                            </code>
                          </div>
                          
                          <details className="text-xs">
                            <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
                              View per-square-foot benchmarks
                            </summary>
                            <code className="block p-3 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700 mt-2" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                              {perSqFtRanges.map((range, i) => (
                                <span key={i}>
                                  ~{range.min.toFixed(2)}-{range.max.toFixed(2)} BTU/hr/°F per sq ft: {range.label}
                                  {i < perSqFtRanges.length - 1 && <><br /></>}
                                </span>
                              ))}
                              <br />
                              <br />
                              These per-square-foot values are multiplied by your home size ({squareFeet.toLocaleString()} sq ft) to generate the ranges above. This ensures fair comparison across homes of different sizes.
                            </code>
                          </details>
                        </>
                      );
                    })()}
                  </div>

                </div>
              </div>
              </details>

              {/* View Calculation Methodology */}
              {result.heatLossFactor != null && (
                <div className="mt-6 pt-6 border-t border-green-700/50">
                  <button
                    onClick={() => setShowCalculations(!showCalculations)}
                    className="w-full flex items-center justify-between p-4 hover:bg-green-800/20 rounded-lg transition-colors mb-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                        <Calculator size={24} className="text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-green-200">View Calculation Methodology</h3>
                    </div>
                    {showCalculations ? (
                      <ChevronUp className="w-6 h-6 text-green-300" />
                    ) : (
                      <ChevronDown className="w-6 h-6 text-green-300" />
                    )}
                  </button>

                  {showCalculations && (
                    <div className="space-y-6">
                      {/* Heat Loss Factor Calculation */}
                      <div>
                        <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Heat Loss Factor Calculation (Coast-Down Method)</h4>
                        <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                          Method: Coast-down thermal decay analysis<br />
                          <br />
                          1. Find periods where heating is OFF:<br />
                          &nbsp;&nbsp;Identify time periods in CSV where heat pump/auxiliary heat = 0 seconds<br />
                          <br />
                          2. Measure temperature decay:<br />
                          &nbsp;&nbsp;Calculate thermal decay rate K from indoor temperature drop over time<br />
                          <br />
                          3. Estimate thermal mass:<br />
                          &nbsp;&nbsp;Thermal Mass = 8 BTU/°F per sq ft * {squareFeet.toLocaleString()} sq ft = <strong>{(8 * squareFeet).toLocaleString()} BTU/°F</strong><br />
                          <br />
                          4. Calculate heat loss factor:<br />
                          &nbsp;&nbsp;Heat Loss Factor = Thermal Mass * Decay Rate<br />
                          &nbsp;&nbsp;Your Result: <strong>{result.heatLossFactor.toFixed(1)} BTU/hr/°F</strong><br />
                          <br />
                          Total Heat Loss at 70°F ΔT:<br />
                          &nbsp;&nbsp;<strong>{result.heatLossFactor.toFixed(1)} * 70 = {(result.heatLossFactor * 70).toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr</strong>
                        </code>
                        
                        {/* Data Points Used Dropdown */}
                        <CoastDownDataViewer 
                          coastDownData={result?.coastDownPeriod}
                          result={result}
                          squareFeet={squareFeet}
                          userSettings={userSettings}
                        />
                      </div>

                      {/* Balance Point Calculation */}
                      {result.balancePoint != null && isFinite(result.balancePoint) && (
                        <div>
                          <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Balance Point Calculation</h4>
                          <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                            Method: Find outdoor temperature where auxiliary heat activates<br />
                            <br />
                            1. Find auxiliary heat events:<br />
                            &nbsp;&nbsp;Identify CSV rows where auxiliary heat runtime &gt; 0 seconds<br />
                            <br />
                            2. Find maximum outdoor temp with aux heat:<br />
                            &nbsp;&nbsp;Balance Point = max(outdoor temp where aux heat was used)<br />
                            <br />
                            Your Balance Point: <strong>{result.balancePoint.toFixed(1)}°F</strong><br />
                            &nbsp;&nbsp;Below this temperature, your heat pump needs auxiliary heat to maintain indoor temperature
                          </code>
                        </div>
                      )}

                      {/* Percentile Calculation */}
                      {(() => {
                        const calculatePercentile = (factor) => {
                          // Simplified percentile calculation based on typical distribution
                          if (factor < 400) return 95;
                          if (factor < 500) return 85;
                          if (factor < 600) return 70;
                          if (factor < 700) return 50;
                          if (factor < 800) return 35;
                          if (factor < 1000) return 20;
                          return 10;
                        };
                        const percentile = calculatePercentile(result.heatLossFactor);
                        return (
                          <div>
                            <h4 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Efficiency Percentile</h4>
                            <code className="block p-4 bg-[#1a1a1a] text-[#00ff9d] rounded-lg text-xs overflow-x-auto border border-gray-700" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Menlo', 'Courier New', monospace" }}>
                              Your Heat Loss Factor: <strong>{result.heatLossFactor.toFixed(1)} BTU/hr/°F</strong><br />
                              <br />
                              Percentile Rank: <strong>{percentile >= 50 ? `Top ${percentile}%` : `Bottom ${100 - percentile}%`}</strong><br />
                              <br />
                              Based on typical U.S. residential building distribution. Lower heat loss factor = higher efficiency percentile.
                            </code>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons - Outside details element */}
              <div className="flex flex-col gap-3 mt-6">
                <input
                  type="text"
                  value={labels[0] || ''}
                  onChange={e => {
                    const newLabels = [...labels];
                    newLabels[0] = e.target.value;
                    setLabels(newLabels);
                    localStorage.setItem(getZoneStorageKey('spa_labels'), JSON.stringify(newLabels));
                  }}
                  placeholder="Name this analysis (e.g., 'Post-Insulation Upgrade')"
                  className={fullInputClasses}
                  aria-label="Analysis label"
                />
                <div className="flex flex-wrap gap-3">
                    <button
                      className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg transform hover:scale-105 transition-all"
                      onClick={() => {
                        setAnalysisResults(result);
                        setHeatLossFactor(result.heatLossFactor);
                        // ☦️ LOAD-BEARING: Store in userSettings and enable analyzer heat loss option
                        // Why this exists: The forecaster checks useAnalyzerHeatLoss flag to decide
                        // which heat loss source to use. Without setting this, the analyzer value
                        // won't be used even though it's stored.
                        if (setUserSetting) {
                          setUserSetting("analyzerHeatLoss", result.heatLossFactor);
                          setUserSetting("useAnalyzerHeatLoss", true);
                          // Disable other heat loss sources to ensure analyzer takes priority
                          setUserSetting("useManualHeatLoss", false);
                          setUserSetting("useCalculatedHeatLoss", false);
                        }
                        setSuccessMessage(`Loaded analysis from "${labels[0] || 'Heat Loss Analysis'}". Use it in the forecaster now!`);
                        setError(null);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      Use this Data
                    </button>
                    <button
                      className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-semibold hover:from-red-700 hover:to-red-800 shadow-md hover:shadow-lg transform hover:scale-105 transition-all"
                      onClick={() => {
                        setResultsHistory([]);
                        setLabels([]);
                        localStorage.removeItem(getZoneStorageKey('spa_resultsHistory'));
                        localStorage.removeItem(getZoneStorageKey('spa_labels'));
                      }}
                    >
                      Delete
                    </button>
                    <button
                      className="px-5 py-2.5 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg font-semibold hover:from-gray-700 hover:to-gray-800 shadow-md hover:shadow-lg transform hover:scale-105 transition-all"
                      onClick={() => {
                        const label = labels[0] || 'Heat Loss Analysis';
                        const csv = `Label,Heat Loss Factor,Balance Point\n"${label}",${result.heatLossFactor.toFixed(1)},${result.balancePoint.toFixed(1)}`;
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${label.replace(/\s+/g, '_')}-analysis.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}>Export CSV</button>
                          </div>
                        </div>
                      </div>
                    
                    {/* Data Analysis Graphs - Inside Nerd Mode */}
                    <ErrorBoundary name="Data Analysis Graphs">
                        <AnalysisGraphs
                          heatDifferentialData={heatDifferentialData}
                          shortCyclingData={shortCyclingData}
                          runtimeAnalysisData={runtimeAnalysisData}
                          lowTempAnalysisData={lowTempAnalysisData}
                          remoteSensorData={remoteSensorData}
                          moldRiskData={moldRiskData}
                          infiltrationData={infiltrationData}
                          fanEfficiencyData={fanEfficiencyData}
                          remoteSensorColumns={remoteSensorColumns}
                          currentTempCol={currentTempCol}
                          parsedCsvRows={parsedCsvRows}
                        />
                      </ErrorBoundary>
                    
                    {/* ------------------------------------------------------- */}
                    {/* CLOSING TAGS FOR NERD MODE SECTION                      */}
                    {/* ------------------------------------------------------- */}
                    </div> 
                  </div>
                )} 
                
                {/* ------------------------------------------------------- */}
                {/* END OF NERD MODE SECTION                                */}
                {/* ------------------------------------------------------- */}
              </>
            );
          })()}
        </ErrorBoundary>
      )}

      {/* Manual Estimator */}
      <div className="mt-8">
        <div className="card card-hover p-6 fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">Estimate your home's heat loss (optional)</h2>
            <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline" onClick={() => setShowManualEstimator(v => !v)}>{showManualEstimator ? 'Hide' : 'Use Manual Estimator'}</button>
          </div>
          {showManualEstimator && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Square Footage</label>
                  <input type="range" min="800" max="4000" step="100" value={manualSqft} onChange={e => setManualSqft(Number(e.target.value))} className="w-full" />
                  <div className="font-bold text-gray-900 dark:text-gray-100">{manualSqft.toLocaleString()} sq ft</div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Ceiling Height</label>
                  <input type="range" min="7" max="20" step="1" value={manualCeiling} onChange={e => setManualCeiling(Number(e.target.value))} className="w-full" />
                  <div className="font-bold text-gray-900 dark:text-gray-100">{manualCeiling.toFixed(1)} ft</div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Insulation</label>
                  <select value={manualInsulation} onChange={e => setManualInsulation(Number(e.target.value))} className="w-full p-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
                    <option value={1.4}>Poor</option>
                    <option value={1.0}>Average</option>
                    <option value={0.65}>Good</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Home Shape</label>
                  <select value={manualShape} onChange={e => setManualShape(Number(e.target.value))} className="w-full p-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
                    <option value={1.1}>Ranch / Single-Story</option>
                    <option value={0.9}>Two-Story</option>
                    <option value={1.0}>Split-Level</option>
                    <option value={2.2}>Cabin / A-Frame</option>
                    <option value={1.15}>Manufactured Home</option>
                  </select>
                </div>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                {(() => {
                  const manualHeatLoss = Math.round(manualSqft * manualCeiling * manualInsulation * manualShape);
                  return (
                    <>
                      <div>
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          <strong>Calculated Heat Loss:</strong> {manualHeatLoss.toLocaleString()} BTU/hr at 70°F ΔT ({(manualHeatLoss / 70).toFixed(1)} BTU/hr/°F)
                        </p>
                        <div className="flex items-start gap-2">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">This is an estimate — real-world dynamic effects like solar gains, infiltration, or internal heat loads can change results.</p>
                          <button type="button" onClick={() => setShowHeatLossTooltip(!showHeatLossTooltip)} className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors mt-1" aria-label="More about dynamic effects">
                            <HelpCircle size={14} />
                          </button>
                        </div>
                        {showHeatLossTooltip && (
                          <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg text-xs text-gray-700 dark:text-gray-300">
                            <p className="font-semibold text-blue-700 dark:text-blue-300 mb-2">Why this is an estimate</p>
                            <ul className="ml-4 list-disc space-y-1">
                              <li><strong>Solar gains:</strong> Sunlight through windows and glazing can reduce heating demand during the day.</li>
                              <li><strong>Infiltration:</strong> Air leakage (drafts) introduces additional heating load, especially in cold/windy conditions.</li>
                              <li><strong>Internal loads:</strong> Occupancy, appliances, and lighting add heat that affects the net load.</li>
                            </ul>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-700 dark:text-gray-300">
                        <strong>Why ΔT=70?</strong> Using a standard indoor 70°F and outdoor 0°F (ΔT = 70°F) provides a consistent reference for building heat loss so results are comparable and useful for sizing heating equipment. Multiply the BTU/hr/°F value by any other ΔT to estimate heat loss at different conditions.
                      </p>
                      <div className="mt-3 flex gap-3">
                        <button className="btn btn-primary" onClick={() => { setHeatLossFactor(manualHeatLoss / 70); setSuccessMessage('Manual heat loss applied.'); setTimeout(() => setSuccessMessage(''), 3000); }}>Use this Data</button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Calculation breakdown and variable definitions */}
      <div className="bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-900 dark:to-gray-800 rounded-xl shadow-xl p-8 mt-8 border-2 border-slate-300 dark:border-slate-700">
        <details className="bg-gray-800 dark:bg-gray-900/50 rounded-lg border border-gray-700 dark:border-gray-600 shadow-lg mb-6">
          <summary className="p-4 cursor-pointer font-semibold text-lg text-gray-100 hover:bg-gray-700/50 dark:hover:bg-gray-800/50 rounded-lg transition-colors flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-slate-600 to-gray-700 text-white rounded-lg">
              <TrendingUp size={20} />
            </div>
            <span>How Heat Loss Is Calculated</span>
          </summary>
          
          <div className="p-6 border-t border-gray-600 space-y-5">
            {/* Blue section for heat loss - Coast-Down Method */}
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-l-4 border-blue-600 rounded-r-lg p-5 shadow-md">
              <h4 className="font-bold text-lg text-blue-900 dark:text-blue-300 mb-3">📐 Coast-Down Method Formulas</h4>
              <div className="space-y-3 text-gray-800 dark:text-gray-200">
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                  <p className="font-mono text-sm mb-2"><strong>Step 1:</strong> Hourly Loss Rate</p>
                  <p className="font-mono">Hourly Loss Rate = Temperature Drop ÷ Duration</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Units: °F per hour</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                  <p className="font-mono text-sm mb-2"><strong>Step 2:</strong> Thermal Decay Rate</p>
                  <p className="font-mono">Thermal Decay Rate (K) = Hourly Loss Rate ÷ Average ΔT</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Units: °F per hour per °F difference</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                  <p className="font-mono text-sm mb-2"><strong>Step 3:</strong> Thermal Mass</p>
                  <p className="font-mono">Thermal Mass = Square Feet × 8 BTU/°F per sq ft</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Units: BTU per °F</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 italic">
                    Note: Assumes standard furnishings and drywall mass. Wood frame homes typically range 4-6 BTU/°F per sq ft (minimal mass) to 10-15 BTU/°F per sq ft (heavy masonry/log construction). The 8 BTU/°F per sq ft value is a reasonable average for typical residential construction.
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border-2 border-blue-400">
                  <p className="font-mono text-sm mb-2"><strong>Final:</strong> Heat Loss Factor</p>
                  <p className="font-mono font-bold">Heat Loss Factor = Thermal Mass × Thermal Decay Rate</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Units: BTU/hr/°F</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                  <p className="font-mono text-sm mb-2"><strong>Total Heat Loss</strong> (at 70°F ΔT)</p>
                  <p className="font-mono">Total Heat Loss = Heat Loss Factor × 70°F</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Units: BTU/hr</p>
                </div>
              </div>
            </div>

            {/* Green section for units */}
            <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950 dark:to-green-950 border-l-4 border-emerald-600 rounded-r-lg p-5 mb-5 shadow-md">
              <h4 className="font-bold text-lg text-emerald-900 dark:text-emerald-300 mb-3"><Ruler size={18} className="inline mr-2" /> Units</h4>
              <div className="space-y-2 text-gray-800 dark:text-gray-200">
                <p className="font-mono bg-white dark:bg-gray-800 p-2 rounded-lg">Heat Loss Factor: <span className="text-emerald-700 dark:text-emerald-400 font-bold">BTU/hr/°F</span></p>
                <p className="font-mono bg-white dark:bg-gray-800 p-2 rounded-lg">Total Heat Loss: <span className="text-emerald-700 dark:text-emerald-400 font-bold">BTU/hr</span></p>
                <p className="font-mono bg-white dark:bg-gray-800 p-2 rounded-lg">Temperature Drop: <span className="text-emerald-700 dark:text-emerald-400 font-bold">°F</span> (Start - End during coast-down)</p>
                <p className="font-mono bg-white dark:bg-gray-800 p-2 rounded-lg">Average ΔT: <span className="text-emerald-700 dark:text-emerald-400 font-bold">°F</span> (Average Indoor - Average Outdoor during period)</p>
                <p className="font-mono bg-white dark:bg-gray-800 p-2 rounded-lg">Duration: <span className="text-emerald-700 dark:text-emerald-400 font-bold">hours</span> (Time system was OFF)</p>
                <p className="font-mono bg-white dark:bg-gray-800 p-2 rounded-lg">Thermal Mass: <span className="text-emerald-700 dark:text-emerald-400 font-bold">BTU/°F</span> (Estimated: 8 BTU/°F per sq ft, assumes standard furnishings and drywall)</p>
              </div>
            </div>

            {/* Purple section for variables */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-l-4 border-purple-600 rounded-r-lg p-5 mb-5 shadow-md">
              <h4 className="font-bold text-lg text-purple-900 dark:text-purple-300 mb-3">🔢 Variables & Method</h4>
              <div className="space-y-3 text-gray-800 dark:text-gray-200">
                <p><span className="font-mono font-bold text-purple-700 dark:text-purple-400">Temperature Drop:</span> Change in indoor temperature during the coast-down period when heating is OFF (°F)</p>
                <p><span className="font-mono font-bold text-purple-700 dark:text-purple-400">Duration:</span> Length of time the heating system was completely OFF (hours, minimum 3 hours)</p>
                <p><span className="font-mono font-bold text-purple-700 dark:text-purple-400">Average ΔT:</span> Average temperature difference (indoor - outdoor) during the coast-down period (°F)</p>
                <p><span className="font-mono font-bold text-purple-700 dark:text-purple-400">Thermal Mass:</span> Estimated heat capacity of the building (8 BTU/°F per square foot, assumes standard furnishings and drywall mass)</p>
                <div className="mt-3 pt-3 border-t border-purple-300 dark:border-purple-700">
                  <p className="mb-2">
                    <span className="font-semibold text-purple-700 dark:text-purple-400">Coast-Down Method:</span> This method measures natural temperature decay when the heating system is OFF, rather than estimating heat pump output. It works universally, even for well-insulated homes that rarely have long heating cycles.
                  </p>
                  <p className="font-semibold text-purple-800 dark:text-purple-300 mt-3 mb-2">
                    ⚡ Why This Method Is Superior:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                    <li><strong>Independent of Equipment Efficiency:</strong> Unlike methods that calculate heat loss from runtime × capacity, the coast-down method measures the building envelope directly. It removes the equipment variable entirely—no need to know COP, capacity factors, or defrost penalties.</li>
                    <li><strong>Direct Envelope Measurement:</strong> By measuring temperature drop when heating is OFF, we derive a pure Building Envelope Performance Metric from thermostat logs alone.</li>
                    <li><strong>Universal Applicability:</strong> Works for any home, regardless of insulation level or climate. Well-insulated homes in mild climates may never have long heating cycles, making steady-state methods impossible—coast-down works everywhere.</li>
                  </ul>
                  <p className="mt-3 text-sm font-semibold text-purple-900 dark:text-purple-200">
                    🎯 Core Innovation: Deriving building envelope performance purely from thermostat logs—this is the fundamental IP of this software.
                  </p>
                </div>
              </div>
            </div>
            {resultsHistory.length > 0 && resultsHistory[0] && (
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950 border-l-4 border-amber-600 rounded-r-lg p-5 shadow-md">
                <h4 className="font-bold text-lg text-amber-900 dark:text-amber-300 mb-3">✨ Latest Example (Your Data)</h4>
                {labels[0] && <p className="font-bold text-amber-800 dark:text-amber-400 mb-2">{labels[0]}</p>}
                {(() => {
              const r = resultsHistory[0];
              if (!r || r.heatLossFactor == null || r.heatLossTotal == null || r.tempDiff == null) {
                return <span className="text-gray-600 dark:text-gray-400">N/A</span>;
              }
              
              // Calculate values for display (coast-down method)
              const squareFeet = userSettings?.squareFeet || 2000;
              const thermalMass = squareFeet * 8;
              
              // Reverse-calculate thermal decay rate from heat loss factor
              const thermalDecayRate = r.heatLossFactor / thermalMass;
              
              return (
                <div className="space-y-2 text-gray-800 dark:text-gray-200">
                  <p className="font-mono bg-white dark:bg-gray-800 p-2 rounded-lg text-sm">
                    <strong>Coast-Down Period:</strong> System OFF, temperature naturally decayed
                  </p>
                  <p className="font-mono bg-white dark:bg-gray-800 p-2 rounded-lg">
                    Average ΔT (Indoor − Outdoor) = <span className="text-amber-700 dark:text-amber-400 font-bold">{r.tempDiff.toFixed(1)} °F</span>
                  </p>
                  <p className="font-mono bg-white dark:bg-gray-800 p-2 rounded-lg">
                    Thermal Mass = {squareFeet.toLocaleString()} sq ft × 8 = <span className="text-amber-700 dark:text-amber-400 font-bold">{thermalMass.toLocaleString()} BTU/°F</span>
                  </p>
                  <p className="font-mono bg-white dark:bg-gray-800 p-2 rounded-lg">
                    Thermal Decay Rate (K) = {thermalDecayRate.toFixed(6)} °F/hr per °F
                  </p>
                  <p className="font-mono bg-white dark:bg-gray-800 p-2 rounded-lg border-2 border-amber-400">
                    Heat Loss Factor = {thermalMass.toLocaleString()} × {thermalDecayRate.toFixed(6)} = <span className="text-amber-700 dark:text-amber-400 font-bold">{r.heatLossFactor.toFixed(1)} BTU/hr/°F</span>
                  </p>
                  <p className="font-mono bg-white dark:bg-gray-800 p-2 rounded-lg">
                    Total Heat Loss (at 70°F ΔT) = {r.heatLossFactor.toFixed(1)} × 70 = <span className="text-amber-700 dark:text-amber-400 font-bold">{r.heatLossTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr</span>
                  </p>
                </div>
              );
            })()}
              </div>
            )}
          </div>
        </details>
      </div>
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default memo(SystemPerformanceAnalyzer);