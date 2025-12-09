import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, AlertTriangle, BarChart3, Zap, Home, Settings, ChevronDown, Wind, Fan } from 'lucide-react';

const SHORT_CYCLE_THRESHOLD = 300; // seconds

export default function AnalysisGraphs({
  heatDifferentialData,
  shortCyclingData,
  runtimeAnalysisData,
  lowTempAnalysisData,
  remoteSensorData,
  moldRiskData,
  infiltrationData,
  fanEfficiencyData,
  remoteSensorColumns,
  currentTempCol,
  parsedCsvRows,
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700 mt-8">
      {/* Note: Warning removed - CSV data now persists in IndexedDB and auto-restores */}
      {/* Note: fileTooLargeForStorage warning removed - IndexedDB handles large datasets automatically */}
      {((heatDifferentialData && heatDifferentialData.length > 0) ||
        (shortCyclingData && shortCyclingData.cycles && shortCyclingData.cycles.length > 0) ||
        (runtimeAnalysisData && runtimeAnalysisData.length > 0) ||
        (lowTempAnalysisData && lowTempAnalysisData.length > 0) ||
        (remoteSensorData && remoteSensorData.length > 0)) && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Visual analysis of your thermostat data to identify short cycling, differential patterns, runtime trends, and edge cases.
        </p>
      )}

      {(() => {
        // All hooks are now at the top level - just return the JSX
        return (
          <div className="space-y-8">
            {/* Heat Differential Graph - Only show if data available */}
            {heatDifferentialData && heatDifferentialData.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <TrendingUp size={20} className="text-blue-600" />
                  Heat Differential Analysis
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Current Temperature vs. Setpoint (Heat/Cool) over time. Shows the difference between current temperature and the active setpoint. Positive values indicate room is above setpoint, negative values indicate below setpoint.
                </p>
                <>
                  {/* Text alternative for screen readers */}
                  <div className="sr-only" role="region" aria-label="Heat Differential Data Table">
                    <table>
                      <caption>Heat Differential Analysis Data</caption>
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Current Temperature (°F)</th>
                          <th>Set Temperature (°F)</th>
                          <th>Differential (°F)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {heatDifferentialData.slice(0, 20).map((row, idx) => (
                          <tr key={idx}>
                            <td>{row.timestamp}</td>
                            <td>{row.currentTemp?.toFixed(1)}</td>
                            <td>{row.setTemp?.toFixed(1)}</td>
                            <td>{row.differential?.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ResponsiveContainer width="100%" height={300} role="img" aria-label="Line chart showing heat differential over time">
                    <LineChart data={heatDifferentialData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        dataKey="timestamp"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tick={{ fontSize: 10 }}
                        interval="preserveStartEnd"
                        tickFormatter={(value) => {
                          // If it's already formatted as HH:MM, return as-is
                          if (typeof value === 'string' && /^\d{1,2}:\d{2}$/.test(value)) {
                            return value;
                          }
                          // Otherwise try to extract time from full timestamp
                          const timeMatch = String(value).match(/(\d{1,2}):(\d{2})/);
                          return timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : value;
                        }}
                      />
                      <YAxis
                        label={{ value: 'Temperature (°F)', angle: -90, position: 'insideLeft' }}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }}
                        formatter={(value, name) => {
                          if (name === 'differential') {
                            return [`${value.toFixed(1)}°F`, 'Differential'];
                          }
                          return [`${value.toFixed(1)}°F`, name === 'currentTemp' ? 'Current Temp' : 'Set Temp'];
                        }}
                      />
                      <Legend />
                      <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" label="Setpoint" />
                      <Line
                        type="monotone"
                        dataKey="differential"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        name="Differential"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                    <p><strong>Interpretation:</strong> The differential line shows how far the current temperature deviates from the setpoint. Large swings may indicate short cycling or system sizing issues.</p>
                  </div>
                </>
              </div>
            )}

            {/* Short Cycling Detection - Only show if data available */}
            {shortCyclingData && shortCyclingData.cycles && shortCyclingData.cycles.length > 0 ? (
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                {(() => {
                  // Calculate severity for verdict banner
                  const totalShortCycles = shortCyclingData.totalShortCycles || shortCyclingData.cycles.length;
                  // Estimate total cycles from parsedCsvRows if available
                  let totalCycles = 0;
                  let shortCyclePercentage = 0;
                  if (parsedCsvRows && parsedCsvRows.length > 0) {
                    // Count all rows with any runtime - check for any numeric value that might be runtime
                    totalCycles = parsedCsvRows.filter(row => {
                      // Check all values in the row for potential runtime values
                      return Object.values(row).some(val => {
                        const num = parseFloat(val);
                        return !isNaN(num) && num > 0 && num < 3600; // Runtime should be between 0 and 3600 seconds (1 hour)
                      });
                    }).length;
                    shortCyclePercentage = totalCycles > 0 ? (totalShortCycles / totalCycles) * 100 : 0;
                  }
                  
                  // Determine severity
                  const isHealthy = totalShortCycles < 10 || shortCyclePercentage < 5;
                  const isMinor = !isHealthy && (totalShortCycles < 30 || shortCyclePercentage < 15);
                  
                  // Calculate current differentials from heatDifferentialData if available
                  let currentHeatDifferential = null;
                  let currentCoolDifferential = null;
                  if (heatDifferentialData && heatDifferentialData.length > 0) {
                    // Try to infer current differential from the data
                    // Look for the most common differential value when system is running
                    const heatDiffs = heatDifferentialData
                      .filter(d => d.differential != null && d.differential < 0) // Negative = below setpoint (heating)
                      .map(d => Math.abs(d.differential));
                    const coolDiffs = heatDifferentialData
                      .filter(d => d.differential != null && d.differential > 0) // Positive = above setpoint (cooling)
                      .map(d => d.differential);
                    
                    if (heatDiffs.length > 0) {
                      // Use median to avoid outliers
                      heatDiffs.sort((a, b) => a - b);
                      currentHeatDifferential = heatDiffs[Math.floor(heatDiffs.length / 2)];
                    }
                    if (coolDiffs.length > 0) {
                      coolDiffs.sort((a, b) => a - b);
                      currentCoolDifferential = coolDiffs[Math.floor(coolDiffs.length / 2)];
                    }
                  }
                  
                  return (
                    <>
                      {/* Top Verdict Banner */}
                      {isHealthy ? (
                        <div className="bg-green-900/30 border-l-4 border-green-500 p-4 mb-6 rounded-r-lg">
                          <p className="text-lg font-semibold text-green-300">
                            ✅ Your system looks healthy.
                            <span className="font-normal text-green-200 ml-2">
                              {totalShortCycles > 0 
                                ? `Found ${totalShortCycles} short cycle${totalShortCycles !== 1 ? 's' : ''}, but this is within normal range.`
                                : 'No short cycling detected in your data.'}
                            </span>
                          </p>
                        </div>
                      ) : isMinor ? (
                        <div className="bg-yellow-900/30 border-l-4 border-yellow-500 p-4 mb-6 rounded-r-lg">
                          <p className="text-lg font-semibold text-yellow-300">
                            ⚠️ Heads up:
                            <span className="font-normal text-yellow-200 ml-2">
                              Your system is short-cycling more than ideal. A small thermostat change can help reduce wear and save energy.
                            </span>
                          </p>
                        </div>
                      ) : (
                        <div className="bg-orange-900/30 border-l-4 border-orange-500 p-4 mb-6 rounded-r-lg">
                          <p className="text-lg font-semibold text-orange-300">
                            🔧 Action needed:
                            <span className="font-normal text-orange-200 ml-2">
                              Your system is short-cycling frequently. Adjusting your thermostat settings will reduce compressor wear and can save $15-30/year.
                            </span>
                          </p>
                        </div>
                      )}
                      
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                        <AlertTriangle size={20} className="text-orange-600" />
                        Short Cycling Detection
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Runtime periods less than {SHORT_CYCLE_THRESHOLD} seconds (5 minutes). Short cycling can reduce efficiency and increase wear on equipment.
                      </p>
                      
                      {/* Tightened Warning Copy */}
                      <div className="mb-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border-l-4 border-orange-500 dark:border-orange-600">
                        <p className="text-base font-semibold text-orange-900 dark:text-orange-200 mb-2">
                          We're seeing a lot of short heating cycles.
                        </p>
                        <p className="text-sm text-orange-800 dark:text-orange-300 leading-relaxed">
                          That usually means <strong>more wear and slightly higher bills</strong> than necessary. 
                          {shortCyclingData.heatShortCycles > 0 && shortCyclingData.coolShortCycles > 0 && (
                            <> Found {shortCyclingData.heatShortCycles} heating and {shortCyclingData.coolShortCycles} cooling cycles under {SHORT_CYCLE_THRESHOLD} seconds.</>
                          )}
                          {shortCyclingData.heatShortCycles > 0 && shortCyclingData.coolShortCycles === 0 && (
                            <> Found {shortCyclingData.heatShortCycles} heating cycle{shortCyclingData.heatShortCycles !== 1 ? 's' : ''} under {SHORT_CYCLE_THRESHOLD} seconds.</>
                          )}
                          {shortCyclingData.heatShortCycles === 0 && shortCyclingData.coolShortCycles > 0 && (
                            <> Found {shortCyclingData.coolShortCycles} cooling cycle{shortCyclingData.coolShortCycles !== 1 ? 's' : ''} under {SHORT_CYCLE_THRESHOLD} seconds.</>
                          )}
                        </p>
                      </div>

                      {/* Billboard Key Number Section */}
                      {(shortCyclingData.recommendedHeatDifferential !== null || shortCyclingData.recommendedCoolDifferential !== null) && (
                        <div className="mb-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl border-2 border-blue-400 dark:border-blue-600 shadow-lg">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-600 rounded-lg">
                              <Settings size={24} className="text-white" />
                            </div>
                            <h4 className="text-xl font-bold text-blue-900 dark:text-blue-100">
                              🔧 Recommended Change
                            </h4>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {shortCyclingData.recommendedHeatDifferential !== null && (
                              <div className="bg-white dark:bg-gray-800 rounded-lg p-5 border-2 border-blue-300 dark:border-blue-600 shadow-md">
                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                                  Heating Differential
                                </p>
                                
                                {/* Before/After Comparison */}
                                <div className="flex items-center justify-between mb-4">
                                  <div className="text-center flex-1">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current</p>
                                    <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                                      <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">
                                        {currentHeatDifferential !== null 
                                          ? `${currentHeatDifferential.toFixed(1)}°F`
                                          : '?'}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  <div className="mx-4 text-2xl text-blue-600 dark:text-blue-400 font-bold">
                                    →
                                  </div>
                                  
                                  <div className="text-center flex-1">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Recommended</p>
                                    <div className="bg-blue-600 rounded-lg p-3 shadow-lg">
                                      <p className="text-3xl font-bold text-white">
                                        {shortCyclingData.recommendedHeatDifferential.toFixed(1)}°F
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                
                                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                  This small change reduces compressor wear and can save <strong className="text-blue-600 dark:text-blue-400">$15-30/year</strong>.
                                </p>
                              </div>
                            )}
                            
                            {shortCyclingData.recommendedCoolDifferential !== null && (
                              <div className="bg-white dark:bg-gray-800 rounded-lg p-5 border-2 border-blue-300 dark:border-blue-600 shadow-md">
                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                                  Cooling Differential
                                </p>
                                
                                {/* Before/After Comparison */}
                                <div className="flex items-center justify-between mb-4">
                                  <div className="text-center flex-1">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current</p>
                                    <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                                      <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">
                                        {currentCoolDifferential !== null 
                                          ? `${currentCoolDifferential.toFixed(1)}°F`
                                          : '?'}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  <div className="mx-4 text-2xl text-blue-600 dark:text-blue-400 font-bold">
                                    →
                                  </div>
                                  
                                  <div className="text-center flex-1">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Recommended</p>
                                    <div className="bg-blue-600 rounded-lg p-3 shadow-lg">
                                      <p className="text-3xl font-bold text-white">
                                        {shortCyclingData.recommendedCoolDifferential.toFixed(1)}°F
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                
                                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                  This small change reduces compressor wear and can save <strong className="text-blue-600 dark:text-blue-400">$15-30/year</strong>.
                                </p>
                              </div>
                            )}
                          </div>
                          
                          <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-800/30 rounded-lg border border-blue-200 dark:border-blue-600">
                            <p className="text-xs text-blue-800 dark:text-blue-200">
                              <strong>How to change:</strong> Go to your ecobee thermostat → <strong>Main Menu → Settings → Installation Settings → Thresholds</strong>
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Text alternative for screen readers */}
                      <div className="sr-only" role="region" aria-label="Short Cycling Data Table">
                    <table>
                      <caption>Short Cycling Detection - Runtime periods less than {SHORT_CYCLE_THRESHOLD} seconds</caption>
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Runtime (seconds)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shortCyclingData.cycles.slice(0, 20).map((row, idx) => (
                          <tr key={idx}>
                            <td>{row.timestamp}</td>
                            <td>{row.totalRuntime}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                      </div>
                      <ResponsiveContainer width="100%" height={300} role="img" aria-label={`Bar chart showing ${shortCyclingData.totalShortCycles || shortCyclingData.cycles.length} short cycles detected`}>
                    <BarChart data={shortCyclingData.cycles.slice(0, 50)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        dataKey="timestamp"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tick={{ fontSize: 10 }}
                        interval="preserveStartEnd"
                        tickFormatter={(value) => {
                          // If it's already formatted as HH:MM, return as-is
                          if (typeof value === 'string' && /^\d{1,2}:\d{2}$/.test(value)) {
                            return value;
                          }
                          // Otherwise try to extract time from full timestamp
                          const timeMatch = String(value).match(/(\d{1,2}):(\d{2})/);
                          return timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : value;
                        }}
                      />
                      <YAxis
                        label={{ value: 'Runtime (seconds)', angle: -90, position: 'insideLeft' }}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }}
                        formatter={(value) => [`${value}s`, 'Runtime']}
                      />
                      <Legend />
                      <ReferenceLine y={SHORT_CYCLE_THRESHOLD} stroke="#ef4444" strokeDasharray="3 3" label="Threshold" />
                      <Bar dataKey="totalRuntime" fill="#f59e0b" name="Total Runtime" />
                    </BarChart>
                      </ResponsiveContainer>
                      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                        {shortCyclingData.recommendedHeatDifferential === null && shortCyclingData.recommendedCoolDifferential === null && (
                          <p><strong>Recommendation:</strong> If you see many short cycles, consider adjusting your heat/cool differential settings or checking for oversized equipment.</p>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <AlertTriangle size={48} className="mx-auto mb-4 opacity-50" />
                <p className="font-semibold">No data available</p>
                <p className="text-sm mt-2">Upload a CSV file to see short cycling detection</p>
              </div>
            )}

            {/* Runtime Analysis per Day - Accordion for power users */}
            {runtimeAnalysisData && runtimeAnalysisData.length > 0 && (
              <details className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <summary className="cursor-pointer p-4 list-none hover:bg-gray-100 dark:hover:bg-gray-800 rounded-t-lg transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 size={20} className="text-gray-600 dark:text-gray-400" />
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        Runtime per Day Analysis
                      </h3>
                    </div>
                    <ChevronDown size={20} className="text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 ml-7">
                    For power users: Daily heating/cooling runtime trends
                  </p>
                </summary>
                <div className="p-6 pt-0">
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Total runtime hours per day. <strong className="text-red-600">Red = Heat</strong> (includes heat pump compressor), <strong className="text-red-700">Dark Red = Aux Heat</strong> (electric strip/backup), <strong className="text-blue-500">Blue = Cooling</strong>, <strong className="text-green-500">Green = Compressor</strong> (standalone).
                  </p>
                  {/* Text alternative for screen readers */}
                  <div className="sr-only" role="region" aria-label="Daily Runtime Analysis Data Table">
                    <table>
                      <caption>Daily Runtime Analysis - Total runtime hours per day by system type</caption>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Heat Hours</th>
                          <th>Aux Heat Hours</th>
                          <th>Cool Hours</th>
                          <th>Compressor Hours</th>
                          <th>Total Hours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {runtimeAnalysisData.slice(0, 20).map((row, idx) => (
                          <tr key={idx}>
                            <td>{row.date}</td>
                            <td>{row.heatHours?.toFixed(2)}</td>
                            <td>{row.auxHeatHours?.toFixed(2)}</td>
                            <td>{row.coolHours?.toFixed(2)}</td>
                            <td>{row.compressorHours?.toFixed(2)}</td>
                            <td>{row.totalHours?.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ResponsiveContainer width="100%" height={300} role="img" aria-label="Stacked bar chart showing daily runtime hours by system type">
                    <BarChart data={runtimeAnalysisData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        dataKey="date"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis
                        label={{ value: 'Runtime (hours)', angle: -90, position: 'insideLeft' }}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }}
                        formatter={(value) => [`${value} hours`, 'Runtime']}
                      />
                      <Legend />
                      <Bar dataKey="heatHours" stackId="a" fill="#ef4444" name="Heat (hrs)" />
                      <Bar dataKey="auxHeatHours" stackId="a" fill="#dc2626" name="Aux Heat (hrs)" />
                      <Bar dataKey="coolHours" stackId="a" fill="#3b82f6" name="Cool (hrs)" />
                      <Bar dataKey="compressorHours" stackId="a" fill="#10b981" name="Compressor (hrs)" />
                    </BarChart>
                  </ResponsiveContainer>
                </>
                </div>
              </details>
            )}

            {/* Low Outdoor Temp Analysis - Accordion for power users */}
            {lowTempAnalysisData && lowTempAnalysisData.length > 0 && (
              <details className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <summary className="cursor-pointer p-4 list-none hover:bg-gray-100 dark:hover:bg-gray-800 rounded-t-lg transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={20} className="text-gray-600 dark:text-gray-400" />
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        Low Outdoor Temperature Analysis
                      </h3>
                    </div>
                    <ChevronDown size={20} className="text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 ml-7">
                    For power users: System performance at cold temperatures
                  </p>
                </summary>
                <div className="p-6 pt-0">
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Compressor runtime behavior at low outdoor temperatures (&lt;40°F). Useful for checking Compressor Min Outdoor Temp threshold behavior.
                  </p>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={lowTempAnalysisData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        dataKey="outdoorTemp"
                        label={{ value: 'Outdoor Temp (°F)', position: 'insideBottom', offset: -5 }}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        label={{ value: 'Compressor Runtime (hours)', angle: -90, position: 'insideLeft' }}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }}
                        formatter={(value, name) => {
                          if (name === 'compressorHours') {
                            return [`${value} hours`, 'Compressor Runtime'];
                          }
                          return [`${value}°F`, 'Outdoor Temp'];
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="compressorHours"
                        stroke="#a855f7"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="Compressor Runtime (hrs)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                    <p><strong>Interpretation:</strong> If compressor runtime drops to zero below a certain outdoor temperature, your Compressor Min Outdoor Temp setting is likely active. This protects the compressor from running in very cold conditions.</p>
                  </div>
                </>
                </div>
              </details>
            )}

            {/* Remote Sensor Comparison - Comfort Balance - Only show if data available */}
            {remoteSensorData && remoteSensorData.length > 0 ? (
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <Home size={20} className="text-indigo-600" />
                  Comfort Balance - Room Temperature Comparison
                </h3>
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Compare temperatures across different rooms. Large differences indicate airflow or insulation issues.
                  </p>
                  {(() => {
                    // Calculate average differences for all remote sensors dynamically
                    const insights = remoteSensorColumns.map((sensor, idx) => {
                      const diffKey = `${sensor.key}Diff`;
                      const dataWithDiff = remoteSensorData.filter(d => d[diffKey] != null);
                      if (dataWithDiff.length === 0) return null;

                      const avgDiff = dataWithDiff.reduce((sum, d) => sum + parseFloat(d[diffKey]), 0) / dataWithDiff.length;
                      if (isNaN(avgDiff)) return null;

                      // Color rotation for multiple sensors
                      const colors = [
                        { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', text: 'text-yellow-800 dark:text-yellow-200', textLight: 'text-yellow-700 dark:text-yellow-300' },
                        { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-800 dark:text-blue-200', textLight: 'text-blue-700 dark:text-blue-300' },
                        { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', text: 'text-green-800 dark:text-green-200', textLight: 'text-green-700 dark:text-green-300' },
                        { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-800 dark:text-purple-200', textLight: 'text-purple-700 dark:text-purple-300' },
                        { bg: 'bg-pink-50 dark:bg-pink-900/20', border: 'border-pink-200 dark:border-pink-800', text: 'text-pink-800 dark:text-pink-200', textLight: 'text-pink-700 dark:text-pink-300' },
                      ];
                      const color = colors[idx % colors.length];

                      const isOutdoor = sensor.name.toLowerCase().includes('outdoor');
                      const insightMessage = isOutdoor
                        ? `💡 Insight: The outdoor temperature is consistently ${Math.abs(avgDiff).toFixed(1)}°F ${avgDiff < 0 ? 'colder' : 'warmer'} than the main room.`
                        : `💡 Insight: Your "${sensor.name}" room is consistently ${Math.abs(avgDiff).toFixed(1)}°F ${avgDiff < 0 ? 'colder' : 'warmer'} than the main room.`;

                      return (
                        <div key={sensor.key} className={`mb-4 p-3 ${color.bg} rounded-lg border ${color.border}`}>
                          <p className={`text-sm font-semibold ${color.text}`}>
                            {insightMessage}
                          </p>
                          <p className={`text-xs ${color.textLight} mt-1`}>
                            {Math.abs(avgDiff) > 3 ?
                              (isOutdoor
                                ? "This is expected—outdoor temperatures naturally differ from indoor temperatures."
                                : "Consider balancing your dampers or adding insulation to that room.") :
                              "Temperature difference is within normal range."}
                          </p>
                        </div>
                      );
                    }).filter(Boolean);

                    return insights.length > 0 ? <>{insights}</> : null;
                  })()}
                  <ResponsiveContainer width="100%" height={300} role="img" aria-label="Line chart comparing room temperatures">
                    <LineChart data={remoteSensorData.slice(0, 200)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        dataKey="timestamp"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tick={{ fontSize: 10 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        label={{ value: 'Temperature (°F)', angle: -90, position: 'insideLeft' }}
                        tick={{ fontSize: 12 }}
                        domain={[60, 80]}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }}
                        formatter={(value) => [`${value}°F`, 'Temperature']}
                      />
                      <Legend />
                      {remoteSensorData.some(d => d.main != null) && (
                        <Line type="monotone" dataKey="main" stroke="#3b82f6" strokeWidth={2} name="Main Thermostat" dot={false} />
                      )}
                      {remoteSensorColumns.map((sensor, idx) => {
                        // Color palette for multiple sensors
                        const colors = [
                          '#8b5cf6', // purple
                          '#10b981', // green
                          '#f59e0b', // amber
                          '#ef4444', // red
                          '#06b6d4', // cyan
                          '#ec4899', // pink
                        ];
                        const color = colors[idx % colors.length];

                        return remoteSensorData.some(d => d[sensor.key] != null) ? (
                          <Line
                            key={sensor.key}
                            type="monotone"
                            dataKey={sensor.key}
                            stroke={color}
                            strokeWidth={2}
                            name={sensor.name}
                            dot={false}
                          />
                        ) : null;
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Home size={48} className="mx-auto mb-4 opacity-50" />
                <p className="font-semibold">No data available</p>
                <p className="text-sm mt-2">
                  {parsedCsvRows && parsedCsvRows.length > 0 ? (
                    <>
                      CSV data loaded, but no remote sensor columns detected. This graph needs:<br />
                      • Current/Thermostat temperature column (found: {currentTempCol || 'not found'})<br />
                      • At least one remote sensor temperature column<br />
                      <br />
                      <span className="text-xs">
                        Remote sensors are temperature columns that aren't the main thermostat.<br />
                        Common names: "Bunny Nest (F)", "Couch (F)", "Bedroom Temp", etc.
                      </span>
                    </>
                  ) : (
                    "Upload a CSV file to see remote sensor comparison"
                  )}
                </p>
              </div>
            )}

            {/* Mold Risk Analysis - Collapsible */}
            <details className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <summary className="cursor-pointer p-6 list-none">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <AlertTriangle size={20} className="text-red-600" />
                    Mold Risk Analysis
                  </h3>
                  <ChevronDown size={20} className="text-gray-400" />
                </div>
              </summary>
              <div className="px-6 pb-6 pt-0">
                {moldRiskData && moldRiskData.length > 0 ? (
                  <>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Indoor humidity vs. outdoor temperature. High humidity (&gt;60%) when outdoor temp &lt;40°F indicates condensation risk on windows/walls.
                    </p>
                    {(() => {
                      const highRiskCount = moldRiskData.filter(d => d.riskLevel === 'high').length;
                      const mediumRiskCount = moldRiskData.filter(d => d.riskLevel === 'medium').length;
                      return highRiskCount > 0 || mediumRiskCount > 0 ? (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                          <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                            ⚠️ Condensation Risk Detected: {highRiskCount} data points with high risk (humidity &gt;60% when outdoor &lt;40°F)
                          </p>
                          <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                            Consider using a dehumidifier or improving ventilation to prevent window/wall condensation.
                          </p>
                        </div>
                      ) : null;
                    })()}
                    <ResponsiveContainer width="100%" height={300} role="img" aria-label="Scatter plot showing humidity vs outdoor temperature">
                      <LineChart data={moldRiskData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                          dataKey="outdoorTemp"
                          label={{ value: 'Outdoor Temp (°F)', position: 'insideBottom', offset: -5 }}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis
                          label={{ value: 'Indoor Humidity (%)', angle: -90, position: 'insideLeft' }}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }}
                          formatter={(value, name) => {
                            if (name === 'humidity') return [`${value}%`, 'Humidity'];
                            return [`${value}°F`, 'Outdoor Temp'];
                          }}
                        />
                        <Legend />
                        <ReferenceLine y={60} stroke="#ef4444" strokeDasharray="3 3" label="Mold Risk Threshold (60%)" />
                        <ReferenceLine x={40} stroke="#f59e0b" strokeDasharray="3 3" label="Cold Threshold (40°F)" />
                        <Line
                          type="monotone"
                          dataKey="humidity"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          name="Humidity (%)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </>
                ) : (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    <AlertTriangle size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="font-semibold">No data available</p>
                    <p className="text-sm mt-2">Upload a CSV file to see mold risk analysis</p>
                  </div>
                )}
              </div>
            </details>

            {/* Infiltration Check - Wind vs Runtime - Collapsible */}
            <details className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <summary className="cursor-pointer p-6 list-none">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Wind size={20} className="text-cyan-600" />
                    Infiltration Check - Air Leak Detection
                  </h3>
                  <ChevronDown size={20} className="text-gray-400" />
                </div>
              </summary>
              <div className="px-6 pb-6 pt-0">
                {infiltrationData && infiltrationData.length > 0 ? (
                  <>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Correlate heating runtime with wind speed (at constant outdoor temp). Higher runtime on windy days indicates air leaks.
                    </p>
                    {(() => {
                      const windyData = infiltrationData.filter(d => d.windSpeed >= 20);
                      const calmData = infiltrationData.filter(d => d.windSpeed < 10);
                      if (windyData.length > 0 && calmData.length > 0) {
                        const avgWindyRuntime = windyData.reduce((sum, d) => sum + d.runtimePerDegree, 0) / windyData.length;
                        const avgCalmRuntime = calmData.reduce((sum, d) => sum + d.runtimePerDegree, 0) / calmData.length;
                        const increasePercent = avgCalmRuntime > 0 ? ((avgWindyRuntime - avgCalmRuntime) / avgCalmRuntime * 100).toFixed(0) : 0;

                        return increasePercent > 10 ? (
                          <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                            <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">
                              💡 Insight: On windy days (20km/h+), your heating load increases by {increasePercent}%.
                            </p>
                            <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                              This proves you have air leaks (drafty windows/doors). Consider caulking and weatherstripping.
                            </p>
                          </div>
                        ) : null;
                      }
                      return null;
                    })()}
                    <ResponsiveContainer width="100%" height={300} role="img" aria-label="Scatter plot showing wind speed vs runtime per degree">
                      <LineChart data={infiltrationData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                          dataKey="windSpeed"
                          label={{ value: 'Wind Speed (km/h)', position: 'insideBottom', offset: -5 }}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis
                          label={{ value: 'Runtime per Degree (sec/°F)', angle: -90, position: 'insideLeft' }}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }}
                          formatter={(value, name) => {
                            if (name === 'runtimePerDegree') return [`${value.toFixed(1)} sec/°F`, 'Runtime per Degree'];
                            return [`${value} km/h`, 'Wind Speed'];
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="runtimePerDegree"
                          stroke="#06b6d4"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          name="Runtime per Degree"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </>
                ) : (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    <Wind size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="font-semibold">No data available</p>
                    <p className="text-sm mt-2">Upload a CSV file to see infiltration check</p>
                  </div>
                )}
              </div>
            </details>

            {/* Air Circulation Efficiency - Fan vs Heat - Always visible */}
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Fan size={20} className="text-teal-600" />
                Air Circulation Efficiency
              </h3>
              {fanEfficiencyData && fanEfficiencyData.length > 0 ? (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Compare fan runtime to heat runtime. If fan runs way longer than heat, you might have "Dissipation Time" set too high (blowing cold air) or unnecessary "Fan On" mode.
                  </p>
                  {(() => {
                    const avgRatio = fanEfficiencyData
                      .filter(d => d.ratio != null)
                      .reduce((sum, d) => sum + parseFloat(d.ratio), 0) /
                      fanEfficiencyData.filter(d => d.ratio != null).length;

                    return avgRatio > 1.5 ? (
                      <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                          ⚠️ Warning: Fan runs {avgRatio.toFixed(1)}× longer than heat.
                        </p>
                        <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                          This may indicate "Dissipation Time" is set too high (blowing cold air) or "Fan On" mode is running unnecessarily, wasting energy.
                        </p>
                      </div>
                    ) : null;
                  })()}
                  <ResponsiveContainer width="100%" height={300} role="img" aria-label="Line chart comparing fan and heat runtime">
                    <LineChart data={fanEfficiencyData.slice(0, 200)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        dataKey="timestamp"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tick={{ fontSize: 10 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        label={{ value: 'Runtime (hours)', angle: -90, position: 'insideLeft' }}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }}
                        formatter={(value) => [`${value.toFixed(2)} hrs`, 'Runtime']}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="fanHours" stroke="#14b8a6" strokeWidth={2} name="Fan (hrs)" dot={false} />
                      <Line type="monotone" dataKey="heatHours" stroke="#ef4444" strokeWidth={2} name="Heat (hrs)" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <Fan size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="font-semibold">No data available</p>
                  <p className="text-sm mt-2">Upload a CSV file to see air circulation efficiency</p>
                </div>
              )}
            </div>

            {/* Summary Statistics */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Summary Statistics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                {shortCyclingData && shortCyclingData.cycles && shortCyclingData.cycles.length > 0 && (
                  <div>
                    <p className="font-semibold text-gray-700 dark:text-gray-300">Short Cycles Detected</p>
                    <p className="text-2xl font-bold text-orange-600">{shortCyclingData.totalShortCycles || shortCyclingData.cycles.length}</p>
                    <p className="text-xs text-gray-500">Runtime &lt; {SHORT_CYCLE_THRESHOLD}s</p>
                  </div>
                )}
                {runtimeAnalysisData && runtimeAnalysisData.length > 0 && (
                  <div>
                    <p className="font-semibold text-gray-700 dark:text-gray-300">Average Daily Runtime</p>
                    <p className="text-2xl font-bold text-green-600">
                      {(
                        runtimeAnalysisData.reduce((sum, day) => sum + parseFloat(day.totalHours), 0) /
                        runtimeAnalysisData.length
                      ).toFixed(1)} hrs
                    </p>
                    <p className="text-xs text-gray-500">Across {runtimeAnalysisData.length} day{runtimeAnalysisData.length !== 1 ? 's' : ''}</p>
                  </div>
                )}
                {heatDifferentialData && heatDifferentialData.length > 0 && (() => {
                  const avgDifferential = heatDifferentialData.reduce((sum, d) => sum + d.differential, 0) / heatDifferentialData.length;
                  const isNegative = avgDifferential < 0;
                  return (
                    <div>
                      <p className="font-semibold text-gray-700 dark:text-gray-300">
                        {isNegative ? 'Avg Droop' : 'Avg Heat Differential'}
                      </p>
                      <p className={`text-2xl font-bold ${isNegative ? 'text-red-600' : 'text-blue-600'}`}>
                        {Math.abs(avgDifferential).toFixed(1)}°F
                        {isNegative && <span className="text-base font-normal ml-1">below target</span>}
                      </p>
                      <p className="text-xs text-gray-500">
                        {isNegative ? 'Room temperature below setpoint' : 'Current - Setpoint'}
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

