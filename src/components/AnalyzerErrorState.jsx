import React, { useState } from "react";
import { AlertTriangle, Info, RefreshCcw, FolderOpen, Sigma, ChevronDown } from "lucide-react";

const AnalyzerErrorState = ({
  stats,
  onRetry,
  onChooseDifferentFile,
  onRunFallbackEstimate,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const requiredOff = stats?.requiredOffHours != null ? stats.requiredOffHours : 3;
  const longestOff = stats?.longestOffHours != null ? stats.longestOffHours : 1;

  return (
    <div className="bg-[#0C1118] border border-red-500/40 rounded-xl p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <AlertTriangle className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-red-100">
            We couldn't measure your home's heat loss from this file.
          </h2>
          <p className="mt-1 text-sm text-[#A7B0BA] max-w-2xl">
            The heat never stayed off long enough for Joule to watch the house
            cool down. The coast-down method needs a long stretch of time with
            the system basically off.
          </p>
        </div>
      </div>

      {/* What happened */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 flex gap-3">
        <Info className="w-4 h-4 mt-0.5 text-slate-300 shrink-0" />
        <div className="text-sm text-[#C7D1DD] space-y-1">
          <p className="font-medium text-slate-100">
            What went wrong in plain language
          </p>
          <p>
            Joule looks for at least{" "}
            <span className="font-semibold">{requiredOff} hours</span> in a row
            where the heat is off, so it can see how quickly your house loses
            heat. In this file the longest "heat off" stretch is only{" "}
            <span className="font-semibold">
              {longestOff.toFixed(1)} hour
              {longestOff !== 1 ? "s" : ""}
            </span>
            .
          </p>
        </div>
      </div>

      {/* What to do next */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
        <p className="text-sm font-semibold text-slate-100 mb-2">
          How to get a usable file
        </p>
        <ul className="list-disc list-inside text-sm text-[#A7B0BA] space-y-1.5">
          <li>
            Export a{" "}
            <span className="font-medium text-slate-100">
              longer date range
            </span>{" "}
            that includes at least one night where the heat stayed off for a
            few hours.
          </li>
          <li>
            Best is a{" "}
            <span className="font-medium text-slate-100">
              cool, cloudy night
            </span>{" "}
            (around 40–50°F outside) when you lowered the setpoint, used Away /
            Vacation mode, or simply turned the heat off.
          </li>
          <li>
            Then upload that new CSV here and Joule will re-run the analysis.
          </li>
        </ul>

        <div className="mt-4 flex flex-wrap gap-2">
          {onChooseDifferentFile && (
            <button
              type="button"
              onClick={onChooseDifferentFile}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1E4CFF] hover:bg-blue-500 text-sm font-semibold text-white transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              Choose a different file
            </button>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm font-semibold text-[#E8EDF3] transition-colors"
            >
              <RefreshCcw className="w-4 h-4" />
              Retry with this file
            </button>
          )}
          {onRunFallbackEstimate && (
            <button
              type="button"
              onClick={onRunFallbackEstimate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-500/60 bg-amber-500/10 hover:bg-amber-500/20 text-sm font-semibold text-amber-200 transition-colors"
            >
              <Sigma className="w-4 h-4" />
              Rough estimate instead
            </button>
          )}
        </div>

        {onRunFallbackEstimate && (
          <p className="mt-2 text-xs text-amber-300 max-w-xl">
            Rough estimate uses duty cycle and nameplate capacity instead of a
            full coast-down. It's less precise, but still useful for spotting
            big efficiency problems.
          </p>
        )}
      </div>

      {/* Nerdy technical details */}
      <button
        type="button"
        onClick={() => setShowDetails((s) => !s)}
        className="text-xs text-[#7C8894] hover:text-slate-200 flex items-center gap-1 transition-colors"
      >
        <span>{showDetails ? "Hide" : "Show"} technical details</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
      </button>

      {showDetails && (
        <div className="text-xs text-[#9BA7B6] bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-1.5">
          <p className="font-semibold text-slate-200 mb-1">
            Coast-down method details
          </p>
          <p>
            • Interval: 5-minute samples from your thermostat CSV.{" "}
          </p>
          <p>
            • "Heat Stage 1 (sec)" is the number of seconds the compressor ran
            in each 5-minute window.
          </p>
          <p>
            • Joule searches for ≥ {requiredOff} hours (≥{" "}
            {requiredOff * 12} consecutive rows) where Heat Stage 1 ≈ 0 so it
            can fit a temperature-vs-time slope with the system off and compute
            BTU/hr/°F.
          </p>
          {stats && (
            <>
              <p className="mt-2">
                This file contains {stats.totalPoints ?? "…"} rows total, with{" "}
                {stats.offRows ?? "…"} rows where Heat Stage 1 = 0. The longest
                consecutive "off" stretch is {longestOff.toFixed(1)} hour
                {longestOff !== 1 ? "s" : ""}.
              </p>
              <p>
                Because that's shorter than the required coast-down window, Joule
                skips the heat-loss calculation rather than giving you a noisy
                result.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AnalyzerErrorState;



