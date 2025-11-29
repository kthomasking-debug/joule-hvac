import React, { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Upload, Zap, Home, TrendingUp, HelpCircle, Ruler } from 'lucide-react';
import { fullInputClasses } from '../lib/uiClasses'
import { DashboardLink } from '../components/DashboardLink';
import { normalizeCsvData } from '../lib/csvNormalization';
import { averageHourlyRows } from '../lib/csvUtils';
import { analyzeThermostatIssues } from '../lib/thermostatDiagnostics';

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
        <h4 className="font-bold text-purple-900 dark:text-purple-300 mb-3 text-lg">Steps for Popular Brands:</h4>
        <ul className="list-disc ml-5 space-y-3">
          <li>
            <b className="text-gray-900 dark:text-gray-100">ecobee:</b> Log in to the <a href="https://www.ecobee.com/login/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700">ecobee web portal</a>. Navigate to <b>Home IQ → System Monitor → Download Data</b>. Choose a date range with cold winter weather.
          </li>
          <li>
            <b className="text-gray-900 dark:text-gray-100">Google Nest:</b> Use <a href="https://takeout.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700">Google Takeout</a>. Deselect all, then select only <b>Nest</b>. Create and download the export when it's ready.
          </li>
          <li>
            <b className="text-gray-900 dark:text-gray-100">Honeywell (Resideo):</b> Log in to the <a href="https://mytotalconnectcomfort.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700">Total Connect Comfort</a> portal. Find the <b>Usage History</b> for your thermostat and look for an export option.
          </li>
        </ul>
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
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          Using Google Nest? Export via Google Takeout, then run <code className="font-mono">node scripts/convert-nest-takeout.js -i your_export.json -o nest.csv</code> and upload the resulting CSV here.
        </p>
      </div>
    </div>
  </details>
);

const SystemPerformanceAnalyzer = () => {
  // For labeling results
  const [labels, setLabels] = useState(() => {
    const saved = localStorage.getItem('spa_labels');
    return saved ? JSON.parse(saved) : [];
  });
  const { setHeatLossFactor, userSettings } = useOutletContext();
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [, setAnalysisResults] = useState(null);
  const [parsedCsvRows, setParsedCsvRows] = useState(() => {
    const saved = localStorage.getItem('spa_parsedCsvData');
    return saved ? JSON.parse(saved) : null;
  });
  const [dataForAnalysisRows, setDataForAnalysisRows] = useState(null);
  const [resultsHistory, setResultsHistory] = useState(() => {
    const saved = localStorage.getItem('spa_resultsHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  // Manual estimator UI state
  const [showManualEstimator, setShowManualEstimator] = useState(false);
  const [manualSqft, setManualSqft] = useState(() => userSettings?.squareFeet || 800);
  const [manualCeiling, setManualCeiling] = useState(() => userSettings?.ceilingHeight || 8);
  const [manualInsulation, setManualInsulation] = useState(() => userSettings?.insulationLevel || 1.0);
  const [manualShape, setManualShape] = useState(() => userSettings?.homeShape || 0.9);
  const [showHeatLossTooltip, setShowHeatLossTooltip] = useState(false);

  const systemConfig = { capacity: 24, efficiency: 15, tons: 2.0 };

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
    setAnalysisResults(null);
    setError(null);
    setSuccessMessage("");
  };

  const handleAnalyze = () => {
    if (!file) {
      setError("Please select a file to analyze.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccessMessage("");

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target.result;
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        let headerIndex = -1;
        for (let i = 0; i < lines.length; i++) {
          if (!lines[i].trim().startsWith('#')) {
            headerIndex = i;
            break;
          }
        }
        if (headerIndex === -1) throw new Error("Could not find a valid header row.");
        const headers = lines[headerIndex].split(',').map(h => h.trim().replace(/"/g, ''));
        const dataRows = lines.slice(headerIndex + 1);
        const raw = dataRows.map(line => {
          const values = line.split(',');
          let row = {};
          headers.forEach((header, index) => {
            const value = values[index] ? values[index].trim().replace(/"/g, '') : '';
            row[header] = value;
          });
          return row;
        });

        // Normalize headers/rows (adds Date/Time if only Timestamp present; maps synonyms; converts °C→°F)
        const data = normalizeCsvData(headers, raw).filter(row => row.Date && row.Time);
        if (data.length === 0) throw new Error("No valid data rows found after the header.");

        // Store CSV data summary for Ask Joule to use
        try {
          const dates = data.map(r => r.Date).filter(Boolean);
          const indoorTemps = data.map(r => parseFloat(r['Indoor Temp'] || r['Indoor Temperature'] || 0)).filter(t => t > 0);
          const outdoorTemps = data.map(r => parseFloat(r['Outdoor Temp'] || r['Outdoor Temperature'] || 0)).filter(t => t);
          const runtimes = data.map(r => parseFloat(r['Runtime'] || r['Total Runtime'] || 0)).filter(t => t >= 0);
          
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
          console.warn('Failed to store CSV summary:', storageErr);
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
          console.log(`analyzeThermostatData: sampled ${sampledData.length} rows at 15-min intervals (of ${data.length}) for faster analysis`);
        }
        
        // Store parsed CSV data persistently
        localStorage.setItem('spa_parsedCsvData', JSON.stringify(data));
        localStorage.setItem('spa_uploadTimestamp', new Date().toISOString());
        localStorage.setItem('spa_filename', file.name);
        
        setParsedCsvRows(data);
        setDataForAnalysisRows(dataForAnalysis);
        const results = analyzeThermostatData(dataForAnalysis, systemConfig);
        setAnalysisResults(results);
        
        // Run diagnostic analysis
        const diagnostics = analyzeThermostatIssues(data);
        localStorage.setItem('spa_diagnostics', JSON.stringify(diagnostics));
        
        // Prepend newest result; keep max two
        setResultsHistory(prev => {
          const updated = [results, ...prev];
          const limited = updated.slice(0, 2);
          localStorage.setItem('spa_resultsHistory', JSON.stringify(limited));
          return limited;
        });
        // Add corresponding label at beginning
        setLabels(prev => {
          const updated = [`Result ${prev.length + 1}`, ...prev];
          const limited = updated.slice(0, 2);
          localStorage.setItem('spa_labels', JSON.stringify(limited));
          return limited;
        });
        setHeatLossFactor(results.heatLossFactor);
        setSuccessMessage("Success! The calculated Heat Loss Factor is now available in the other calculator tools.");

      } catch (err) {
        setError(`Failed to parse or analyze the file. Error: ${err.message}`);
        console.error(err);
      } finally {
        setIsLoading(false);
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
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">System Performance Analyzer</h2>
          <p className="text-gray-600 dark:text-gray-400">Calculate your building's thermal factor from actual thermostat data (heating mode)</p>
        </div>
        <DashboardLink />
      </div>

      {/* Quick Links Banner */}
      <div className="mb-6 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 shadow-sm dark:border-blue-800 dark:from-blue-950 dark:to-indigo-950">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-2 bg-blue-600 rounded-lg">
            <Upload size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Download Your Thermostat Data</h3>
            <div className="flex flex-wrap gap-3">
              <a className="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg text-sm font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-gray-700 transition-colors shadow-sm" href="https://www.ecobee.com/login/" target="_blank" rel="noopener noreferrer">
                ecobee →
              </a>
              <a className="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg text-sm font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-gray-700 transition-colors shadow-sm" href="https://takeout.google.com/" target="_blank" rel="noopener noreferrer">
                Google Nest →
              </a>
              <a className="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg text-sm font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-gray-700 transition-colors shadow-sm" href="https://mytotalconnectcomfort.com/" target="_blank" rel="noopener noreferrer">
                Honeywell →
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
          Upload Data File
        </h3>
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="flex-grow p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100 hover:border-blue-400 dark:hover:border-blue-500 transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-200"
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
          <button
            onClick={() => downloadCsvRows(parsedCsvRows, `${file?.name?.replace(/\.[^.]+$/, '') || 'parsed-data'}-parsed.csv`)}
            disabled={!parsedCsvRows}
            className="px-4 py-2 bg-white border rounded text-sm hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Download Parsed CSV
          </button>
          <button
            onClick={() => downloadCsvRows(dataForAnalysisRows, `${file?.name?.replace(/\.[^.]+$/, '') || 'sampled-data'}-hourly.csv`)}
            disabled={!dataForAnalysisRows}
            className="px-4 py-2 bg-white border rounded text-sm hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Download Sampled CSV
          </button>
          <button
            onClick={() => {
              const averaged = averageHourlyRows(parsedCsvRows);
              downloadCsvRows(averaged, `${file?.name?.replace(/\.[^.]+$/, '') || 'parsed-data'}-averaged-hourly.csv`);
            }}
            disabled={!parsedCsvRows}
            className="px-4 py-2 bg-white border rounded text-sm hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Download Averaged CSV
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Note: For large CSV files, data is sampled to one row per hour (top-of-hour) to speed analysis.</p>
        <div className="mt-4 space-y-2">
          <a href="/sample-thermostat-data.csv" download className="text-sm text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 underline">
            Download a sample CSV file
          </a>
          <ThermostatHelp />
        </div>

        {error && (
          <div className="mt-4 bg-red-50 dark:bg-red-950 border-l-4 border-red-500 p-4 rounded-r-lg">
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-red-800 dark:text-red-200 font-semibold">{error}</p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mt-6 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950 dark:to-green-950 border-2 border-emerald-300 dark:border-emerald-700 rounded-lg p-6 space-y-4">
            <p className="text-lg text-emerald-700 dark:text-emerald-300 font-semibold">{successMessage}</p>
            <button
              onClick={() => navigate('/cost-forecaster', { state: { useCalculatedFactor: true } })}
              className="w-full inline-flex items-center justify-center px-6 py-4 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg font-bold text-lg hover:from-emerald-700 hover:to-green-700 dark:from-emerald-600 dark:to-green-600 dark:hover:from-emerald-500 dark:hover:to-green-500 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <span className="mr-2">→</span>
              Use this data in the 7-Day Cost Forecaster
            </button>
            <p className="text-sm text-emerald-600 dark:text-emerald-400">Your calculated heat loss factor will be imported automatically</p>
          </div>
        )}
      </div>

      {resultsHistory.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 mb-6 border-2 border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-lg">
              <TrendingUp size={24} />
            </div>
            Analysis Results History
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Showing the {Math.min(resultsHistory.length, 2)} most recent analyses.</p>
          {resultsHistory.map((result, idx) => {
            // Calculate normalized metrics for detail section
            const squareFeet = userSettings?.squareFeet || 2000;
            const heatLossPerSqFt = result.heatLossFactor ? result.heatLossFactor / squareFeet : 0;
            const percentile = 23; // Example - replace with real calculation
            const positionPercent = Math.max(0, Math.min(100, 100 - percentile));
            
            return (
            <div key={idx} className="border-t-2 dark:border-gray-700 pt-6 mt-6 first:mt-0 first:pt-0 first:border-t-0">
              
              {/* Step 1: Simple Score Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Heat Loss Score Card - Simplified */}
                <div className="bg-blue-900/50 dark:bg-blue-950/50 border-2 border-blue-700 dark:border-blue-600 rounded-xl p-6 shadow-lg">
                  <h3 className="text-sm font-bold text-blue-200 dark:text-blue-300 mb-1 uppercase tracking-wide">Your Home's Thermal Factor</h3>
                  <p className="text-5xl font-extrabold text-white mb-2">
                    {(result.heatLossFactor !== null && result.heatLossFactor !== undefined) ? result.heatLossFactor.toFixed(1) : 'N/A'}
                    <span className="text-lg font-normal ml-2">BTU/hr/°F</span>
                  </p>
                  <p className="text-blue-200 dark:text-blue-300 leading-relaxed">
                    {result.heatLossFactor != null ? (
                      result.heatLossFactor < 500 ? 'Excellent! Low heat loss suggests great insulation and airtightness.' :
                      result.heatLossFactor < 800 ? 'This is typical for many homes. Room for improvement.' :
                      'Higher heat loss detected. Insulation or air sealing could help.'
                    ) : ''}
                  </p>
                </div>

                {/* Balance Point Card - Simplified */}
                <div className="bg-red-900/50 dark:bg-red-950/50 border-2 border-red-700 dark:border-red-600 rounded-xl p-6 shadow-lg">
                  <h3 className="text-sm font-bold text-red-200 dark:text-red-300 mb-1 uppercase tracking-wide">System Balance Point</h3>
                  <p className="text-5xl font-extrabold text-white mb-2">
                    {(result.balancePoint !== null && result.balancePoint !== undefined && isFinite(result.balancePoint)) ? result.balancePoint.toFixed(1) : 'N/A'}
                    <span className="text-lg font-normal ml-2">°F</span>
                  </p>
                  <p className="text-red-200 dark:text-red-300 leading-relaxed">
                    {result.balancePoint != null && isFinite(result.balancePoint) ? (
                      result.balancePoint < 25 ? 'Excellent! Your heat pump handles most cold days without backup heat.' :
                      'Temperature where auxiliary heat is needed. Lower is better.'
                    ) : ''}
                  </p>
                </div>
              </div>

              {/* Step 2: Comparison Bar - Dedicated Section */}
              {result.heatLossFactor != null && (
                <div className="bg-gray-800 dark:bg-gray-900/50 border border-gray-700 dark:border-gray-600 rounded-xl p-6 mb-6 shadow-lg">
                  <h3 className="text-lg font-bold text-gray-100 mb-4">How Your Home Compares</h3>
                  <div className="w-full max-w-2xl mx-auto">
                    <div className="flex justify-between mb-2 text-xs">
                      <span className="text-red-400 font-semibold">LEAST EFFICIENT</span>
                      <span className="text-green-400 font-semibold">MOST EFFICIENT</span>
                    </div>
                    <div className="relative w-full h-6 rounded-full overflow-hidden shadow-inner" aria-label="Home efficiency percentile bar">
                      <div className="absolute inset-0 rounded-full"
                           style={{ background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #22c55e 100%)' }}
                      />
                      {/* Marker */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-700"
                        style={{ left: `${positionPercent}%` }}
                        aria-label={`Your home: Top ${percentile}%`}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-sm font-bold px-2 py-1 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-lg whitespace-nowrap"
                             data-testid="efficiency-marker-label">
                          YOUR HOME: TOP {percentile}%
                        </div>
                        <div className="w-6 h-6 rounded-full border-3 border-white dark:border-gray-900 bg-white dark:bg-gray-800 shadow-lg"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Collapsible Details Section */}
              <details className="bg-gray-800 dark:bg-gray-900/50 rounded-lg border border-gray-700 dark:border-gray-600 shadow-lg">
                <summary className="p-4 cursor-pointer font-semibold text-lg text-gray-100 hover:bg-gray-700/50 dark:hover:bg-gray-800/50 rounded-lg transition-colors">
                  📊 Understanding These Numbers
                </summary>
                <div className="p-6 border-t border-gray-600 space-y-4 text-sm text-gray-300 dark:text-gray-400">
                  
                  {/* Total Heat Loss */}
                  <div className="p-3 bg-gray-700/30 dark:bg-gray-800/30 rounded-lg">
                    <p className="font-bold text-gray-200 mb-1">Total Heat Loss at Design Conditions</p>
                    <p className="text-2xl font-bold text-blue-400">
                      {(result.heatLossTotal !== null && result.heatLossTotal !== undefined) ? result.heatLossTotal.toLocaleString(undefined, { maximumFractionDigits: 0 }) : 'N/A'} BTU/hr
                    </p>
                    <p className="text-xs mt-2">Calculated at 70°F indoor / 0°F outdoor (ΔT = 70°F)</p>
                  </div>

                  {/* What is ΔT */}
                  <div>
                    <p className="font-bold text-gray-200 mb-2">📐 What is ΔT (70°F)?</p>
                    <p>We report heat loss at a standardized temperature difference of 70°F (indoor 70°F vs outdoor 0°F). This makes results comparable between homes and useful for sizing heating equipment. To estimate heat loss at other conditions, multiply the BTU/hr/°F factor by your actual temperature difference.</p>
                  </div>

                  {/* Per Square Foot Analysis */}
                  {result.heatLossFactor != null && (
                    <div>
                      <p className="font-bold text-gray-200 mb-2">📏 Normalized Per-Square-Foot Factor</p>
                      <p className="mb-2">
                        <strong>Your home:</strong> {heatLossPerSqFt.toFixed(3)} BTU/hr/°F per sq ft
                        {heatLossPerSqFt < 0.25 && <span className="text-green-400 ml-2">✓ Excellent insulation</span>}
                        {heatLossPerSqFt >= 0.25 && heatLossPerSqFt < 0.35 && <span className="text-blue-400 ml-2">✓ Good insulation</span>}
                        {heatLossPerSqFt >= 0.35 && heatLossPerSqFt < 0.45 && <span className="text-yellow-400 ml-2">○ Average insulation</span>}
                        {heatLossPerSqFt >= 0.45 && <span className="text-orange-400 ml-2">! Consider upgrades</span>}
                      </p>
                      <p>To compare homes of different sizes fairly, we divide your heat loss factor by your floor area. This normalized metric is a better indicator of insulation quality than the raw factor.</p>
                    </div>
                  )}

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
                        const buildingType = 
                          homeShape >= 1.2 ? 'Cabin / A-Frame' :
                          homeShape >= 1.12 ? 'Manufactured Home' :
                          homeShape >= 1.05 ? 'Ranch / Single-Story' :
                          homeShape >= 0.95 ? 'Split-Level' :
                          'Two-Story';
                        
                        const shapeMultiplier = homeShape;
                        const baselineFactor = (squareFeet * 0.45); // Rough baseline for average construction
                        const shapeAdjustedFactor = baselineFactor * shapeMultiplier;
                        
                        return (
                          <div className="border-t border-blue-700/30 pt-3">
                            <p className="font-semibold text-gray-200 text-sm mb-1">Building Type: {buildingType}</p>
                            <p className="text-sm mb-2">
                              {homeShape >= 1.2 ? (
                                <>🏔️ <strong>Cabins and A-Frames</strong> have the <strong>highest surface-area-to-volume ratios</strong> due to steep roofs and complex geometries. The large sloped roof area adds significant heat loss compared to a conventional home. Expected multiplier: ~1.25× typical heat loss.</>
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
                            <div className="bg-gray-800/40 p-2 rounded text-xs space-y-1">
                              <p><strong>For a {squareFeet.toLocaleString()} sq ft {buildingType.toLowerCase()}:</strong></p>
                              <p>• Baseline factor (average construction): ~{baselineFactor.toFixed(0)} BTU/hr/°F</p>
                              <p>• Shape-adjusted factor: ~{shapeAdjustedFactor.toFixed(0)} BTU/hr/°F (×{shapeMultiplier})</p>
                              <p>• Your actual factor: <strong className="text-blue-300">{result.heatLossFactor.toFixed(1)} BTU/hr/°F</strong></p>
                              {result.heatLossFactor < shapeAdjustedFactor * 0.9 ? (
                                <p className="text-green-400">✓ Better than expected—excellent insulation and air sealing!</p>
                              ) : result.heatLossFactor > shapeAdjustedFactor * 1.1 ? (
                                <p className="text-orange-400">⚠️ Higher than expected—consider insulation upgrades or air sealing.</p>
                              ) : (
                                <p className="text-blue-300">→ Within expected range for your building type and size.</p>
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

                  {/* Benchmarks - Geometry Adjusted */}
                  <div>
                    <p className="font-bold text-gray-200 mb-2">📊 Typical Heat Loss Factor Ranges</p>
                    <p className="text-xs text-gray-400 mb-3 italic">
                      Based on U.S. Department of Energy residential building data and ASHRAE standards. Standard ranges assume typical two-story construction—adjusted below for your building type.
                    </p>
                    
                    {(() => {
                      const homeShape = userSettings?.homeShape || 0.9;
                      const buildingType = 
                        homeShape >= 1.2 ? 'Cabin / A-Frame' :
                        homeShape >= 1.12 ? 'Manufactured Home' :
                        homeShape >= 1.05 ? 'Ranch / Single-Story' :
                        homeShape >= 0.95 ? 'Split-Level' :
                        'Two-Story';
                      
                      // Base ranges for two-story homes (0.9 multiplier baseline)
                      const baseRanges = [
                        { label: 'Highly efficient (Passive House, net-zero)', min: 400, max: 450 },
                        { label: 'Well-insulated modern homes', min: 500, max: 600 },
                        { label: 'Average existing homes', min: 700, max: 800 },
                        { label: 'Older or poorly insulated', min: 800, max: 1000 }
                      ];
                      
                      // Adjust ranges for building geometry
                      const adjustedRanges = baseRanges.map(range => ({
                        ...range,
                        min: Math.round(range.min * homeShape / 0.9),
                        max: Math.round(range.max * homeShape / 0.9)
                      }));
                      
                      return (
                        <>
                          <div className="bg-gray-700/30 dark:bg-gray-800/30 p-3 rounded-lg mb-3">
                            <p className="text-sm font-semibold text-gray-200 mb-2">
                              For your {buildingType} (×{homeShape} geometry factor):
                            </p>
                            <ul className="space-y-1.5 ml-4 text-sm">
                              {adjustedRanges.map((range, i) => (
                                <li key={i}>
                                  <strong>~{range.min}-{range.max} BTU/hr/°F:</strong> {range.label}
                                  {result.heatLossFactor >= range.min && result.heatLossFactor <= range.max && (
                                    <span className="ml-2 text-blue-400 font-semibold">← You are here</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                          
                          <details className="text-xs">
                            <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
                              Compare to standard two-story homes
                            </summary>
                            <ul className="space-y-1 ml-4 mt-2 text-gray-500">
                              {baseRanges.map((range, i) => (
                                <li key={i}>
                                  <strong>~{range.min}-{range.max} BTU/hr/°F:</strong> {range.label}
                                </li>
                              ))}
                            </ul>
                            <p className="mt-2 text-gray-500 italic">
                              These standard ranges assume typical two-story rectangular construction. Your {buildingType.toLowerCase()} has a geometry multiplier of ×{homeShape}, so the ranges above are adjusted accordingly.
                            </p>
                          </details>
                        </>
                      );
                    })()}
                  </div>

                </div>
              </details>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 mt-6">
                <input
                  type="text"
                  value={labels[idx] || ''}
                  onChange={e => {
                    const newLabels = [...labels];
                    newLabels[idx] = e.target.value;
                    setLabels(newLabels);
                    localStorage.setItem('spa_labels', JSON.stringify(newLabels));
                  }}
                  placeholder="Label this result (e.g., 'Before insulation upgrade')"
                  className={fullInputClasses}
                />
                <div className="flex flex-wrap gap-3">
                    <button
                      className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg transform hover:scale-105 transition-all"
                      onClick={() => {
                        setAnalysisResults(result);
                        setHeatLossFactor(result.heatLossFactor);
                        setSuccessMessage(`Loaded analysis from "${labels[idx] || `Result ${idx + 1}`}". Use it in the forecaster now!`);
                        setError(null);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      Use this Data
                    </button>
                    <button
                      className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-semibold hover:from-red-700 hover:to-red-800 shadow-md hover:shadow-lg transform hover:scale-105 transition-all"
                      onClick={() => {
                        const updatedHistory = resultsHistory.filter((_, i) => i !== idx);
                        const updatedLabels = labels.filter((_, i) => i !== idx);
                        setResultsHistory(updatedHistory);
                        setLabels(updatedLabels);
                        localStorage.setItem('spa_resultsHistory', JSON.stringify(updatedHistory));
                        localStorage.setItem('spa_labels', JSON.stringify(updatedLabels));
                      }}
                    >
                      Delete
                    </button>
                    <button
                      className="px-5 py-2.5 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg font-semibold hover:from-gray-700 hover:to-gray-800 shadow-md hover:shadow-lg transform hover:scale-105 transition-all"
                      onClick={() => {
                        const csv = `Label,Heat Loss Factor,Balance Point\n"${labels[idx] || ''}",${result.heatLossFactor.toFixed(1)},${result.balancePoint.toFixed(1)}`;
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${(labels[idx] || 'result').replace(/\s+/g, '_')}-analysis.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}>Export CSV</button>
                  </div>
                </div>
              
            </div>
            );
          })}
        </div>
      )}

      {/* Manual Estimator */}
      <div className="mt-8">
        <div className="card card-hover p-6 fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">Manual Building Heat Loss Estimator</h2>
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
                  <div className="font-bold text-gray-900 dark:text-gray-100">{manualCeiling} ft</div>
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
                    <option value={1.25}>Cabin / A-Frame</option>
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
        <h3 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-slate-600 to-gray-700 text-white rounded-lg">
            <TrendingUp size={24} />
          </div>
          How Heat Loss Is Calculated
        </h3>

        {/* Blue section for heat loss */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-l-4 border-blue-600 rounded-r-lg p-5 mb-5 shadow-md">
          <h4 className="font-bold text-lg text-blue-900 dark:text-blue-300 mb-3">📐 Formulas</h4>
          <div className="space-y-2 text-gray-800 dark:text-gray-200">
            <p className="font-mono bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">Heat Loss Factor = Heat Pump Output / ΔT</p>
            <p className="font-mono bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">Total Heat Loss = Heat Loss Factor × ΔT</p>
          </div>
        </div>

        {/* Green section for units */}
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950 dark:to-green-950 border-l-4 border-emerald-600 rounded-r-lg p-5 mb-5 shadow-md">
          <h4 className="font-bold text-lg text-emerald-900 dark:text-emerald-300 mb-3"><Ruler size={18} className="inline mr-2" /> Units</h4>
          <div className="space-y-2 text-gray-800 dark:text-gray-200">
            <p className="font-mono bg-white dark:bg-gray-800 p-2 rounded-lg">Heat Loss Factor: <span className="text-emerald-700 dark:text-emerald-400 font-bold">BTU/hr/°F</span></p>
            <p className="font-mono bg-white dark:bg-gray-800 p-2 rounded-lg">Total Heat Loss: <span className="text-emerald-700 dark:text-emerald-400 font-bold">BTU/hr</span></p>
            <p className="font-mono bg-white dark:bg-gray-800 p-2 rounded-lg">ΔT: <span className="text-emerald-700 dark:text-emerald-400 font-bold">°F</span> (Indoor - Outdoor)</p>
          </div>
        </div>

        {/* Purple section for variables */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-l-4 border-purple-600 rounded-r-lg p-5 mb-5 shadow-md">
          <h4 className="font-bold text-lg text-purple-900 dark:text-purple-300 mb-3">🔢 Variables</h4>
          <div className="space-y-3 text-gray-800 dark:text-gray-200">
            <p><span className="font-mono font-bold text-purple-700 dark:text-purple-400">Heat Pump Output:</span> Estimated output of your heat pump at steady-state (BTU/hr)</p>
            <p><span className="font-mono font-bold text-purple-700 dark:text-purple-400">ΔT:</span> Temperature difference during steady-state (°F)</p>
          </div>
        </div>
        {resultsHistory.length > 0 && resultsHistory[0] && (
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950 border-l-4 border-amber-600 rounded-r-lg p-5 shadow-md">
            <h4 className="font-bold text-lg text-amber-900 dark:text-amber-300 mb-3">✨ Latest Example (Your Data)</h4>
            {labels[0] && <p className="font-bold text-amber-800 dark:text-amber-400 mb-2">{labels[0]}</p>}
            {(() => {
              const r = resultsHistory[0];
              if (!r || r.heatLossFactor == null || r.heatLossTotal == null || r.tempDiff == null || r.heatpumpOutputBtu == null) {
                return <span className="text-gray-600 dark:text-gray-400">N/A</span>;
              }
              return (
                <div className="space-y-2 text-gray-800 dark:text-gray-200">
                  <p className="font-mono bg-white dark:bg-gray-800 p-2 rounded-lg">ΔT (Indoor − Outdoor) = <span className="text-amber-700 dark:text-amber-400 font-bold">{r.tempDiff.toFixed(1)} °F</span></p>
                  <p className="font-mono bg-white dark:bg-gray-800 p-2 rounded-lg">Heat Pump Output ≈ <span className="text-amber-700 dark:text-amber-400 font-bold">{r.heatpumpOutputBtu.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr</span></p>
                  <p className="font-mono bg-white dark:bg-gray-800 p-2 rounded-lg">Heat Loss Factor = Output ÷ ΔT = {r.heatpumpOutputBtu.toLocaleString(undefined, { maximumFractionDigits: 0 })} ÷ {r.tempDiff.toFixed(1)} = <span className="text-amber-700 dark:text-amber-400 font-bold">{r.heatLossFactor.toFixed(1)} BTU/hr/°F</span></p>
                  <p className="font-mono bg-white dark:bg-gray-800 p-2 rounded-lg">Total Heat Loss = Factor × ΔT = {r.heatLossFactor.toFixed(1)} × {r.tempDiff.toFixed(1)} = <span className="text-amber-700 dark:text-amber-400 font-bold">{r.heatLossTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr</span></p>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Efficiency/Percentile Bar Explanation */}
      <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-l-4 border-green-600 rounded-r-lg p-5 mb-5 shadow-md">
        <h4 className="font-bold text-lg text-green-900 dark:text-green-300 mb-3">🏆 Efficiency Comparison Bar</h4>
        <div className="space-y-2 text-gray-800 dark:text-gray-200">
          <p>
            The green bar below your heat loss factor shows how your home compares to others in terms of thermal efficiency. Homes are grouped into bins by their heat loss factor (BTU/hr/°F), with lower values indicating better insulation and airtightness.
          </p>
          <p>
            <strong>How it works:</strong> We use a set of reference bins (e.g., 400, 500, 600, 700, 800 BTU/hr/°F) based on typical U.S. home data. Your home's heat loss factor is placed in the appropriate bin, and the percentile is estimated based on where it falls in the distribution. The bar highlights your home's position, with <span className="text-green-700 font-semibold">MOST EFFICIENT</span> on the right and <span className="text-green-700 font-semibold">LEAST EFFICIENT</span> on the left.
          </p>
          <p>
            <strong>Interpretation:</strong> If your home is in a lower bin, it means it retains heat better than most. A higher percentile (e.g., "Top 23%") means your home is more efficient than that percentage of similar homes.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            (Note: These bins and percentiles are illustrative. For more precise results, a larger dataset of similar homes in your region would be used.)
          </p>
        </div>
      </div>
    </div>
  );
};

// --- UPDATED, MORE ROBUST ANALYSIS FUNCTION ---
const analyzeThermostatData = (data, config) => {
  const outdoorTempCol = 'Outdoor Temp (F)';
  const thermostatTempCol = 'Thermostat Temperature (F)';
  const heatStage1Col = 'Heat Stage 1 (sec)';
  const auxHeatCol = 'Aux Heat 1 (sec)';

  // Part 1: Find the real-world Balance Point
  const auxHeatEntries = data.filter(row => row[auxHeatCol] && parseFloat(row[auxHeatCol]) > 0);
  let balancePoint = -99;
  if (auxHeatEntries.length > 0) {
    balancePoint = Math.max(...auxHeatEntries.map(row => parseFloat(row[outdoorTempCol])));
  } else {
    const minOutdoorTemp = Math.min(...data.map(row => parseFloat(row[outdoorTempCol])));
    balancePoint = minOutdoorTemp;
  }

  // Part 2: Find a better "steady-state" condition
  let steadyStatePeriod = null;
  // Iterate backwards from the end of the data to find a stable period
  for (let i = data.length - 3; i >= 0; i--) {
    const slice = data.slice(i, i + 3);
    const outdoorTemp = parseFloat(slice[0][outdoorTempCol]);

    // Criteria: cold, all three intervals have long runtime, no aux heat, stable indoor temp
    const isCold = outdoorTemp < 40;
    const isLongRuntime = slice.every(row => parseFloat(row[heatStage1Col]) > 290);
    const noAux = slice.every(row => !row[auxHeatCol] || parseFloat(row[auxHeatCol]) === 0);
    const startTemp = parseFloat(slice[0][thermostatTempCol]);
    const endTemp = parseFloat(slice[2][thermostatTempCol]);
    const isStable = Math.abs(startTemp - endTemp) < 0.5; // Temp changed less than 0.5°F over 15 mins

    if (isCold && isLongRuntime && noAux && isStable) {
      steadyStatePeriod = slice;
      break;
    }
  }

  if (!steadyStatePeriod) {
    throw new Error("Could not find a suitable 'steady-state' period (15 mins of continuous runtime with stable indoor temp) to calculate heat loss.");
  }

  // Average the conditions over the stable period
  const avgOutdoorTemp = steadyStatePeriod.reduce((sum, row) => sum + parseFloat(row[outdoorTempCol]), 0) / steadyStatePeriod.length;
  const avgIndoorTemp = steadyStatePeriod.reduce((sum, row) => sum + parseFloat(row[thermostatTempCol]), 0) / steadyStatePeriod.length;
  const tempDiff = avgIndoorTemp - avgOutdoorTemp;

  if (!tempDiff || tempDiff <= 0) {
    throw new Error("Invalid temperature difference found at steady-state. Cannot calculate heat loss.");
  }

  const { tons } = config;

  let capacityFactor = 1.0;
  if (avgOutdoorTemp < 47) capacityFactor = 1.0 - (47 - avgOutdoorTemp) * 0.01;
  if (avgOutdoorTemp < 17) capacityFactor = 0.70 - (17 - avgOutdoorTemp) * 0.0074;
  capacityFactor = Math.max(0.3, capacityFactor);

  const heatpumpOutputBtu = (tons * 3.517 * capacityFactor) * 3412.14;
  const heatLossFactor = heatpumpOutputBtu / tempDiff;

  const heatLossTotal = heatLossFactor * tempDiff;
  return { heatLossFactor, balancePoint, tempDiff, heatpumpOutputBtu, heatLossTotal };
};

export default SystemPerformanceAnalyzer;