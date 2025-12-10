import React from "react";
import { AlertTriangle, CheckCircle2, Activity, ArrowRight } from "lucide-react";

const HomeTopSection = ({
  verdict,              // "wasting" | "ok"
  verdictText,          // e.g. "You're probably wasting money tonight."
  savingsEstimateText,  // e.g. "Fixing your schedule could save about $3.80 tonight."
  onOptimizeClick,      // handler for main CTA
  isOptimizing,         // loading state
  wastingSummaryText,   // short, human explanation
  changeTitle,          // title for recommended change
  changeBody,           // 2–4 lines of detail text
  changeFootnote,       // optional footnote / disclaimer
  lastOptimization,     // { ranAt, resultSummary } or null
  todaySummary,         // { indoor, outdoor, stripsStatus } etc
  onQuestionClick,      // handler for seed question clicks
  askJouleComponent,    // React element for AskJoule component
}) => {
  const isWasting = verdict === "wasting";

  return (
    <section className="space-y-6">
      {/* Row 1: Hero verdict + CTA */}
      <div className="bg-[#0C1118] border border-slate-800 rounded-xl px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 rounded-full p-2 ${
              isWasting ? "bg-amber-500/10" : "bg-emerald-500/10"
            }`}
          >
            {isWasting ? (
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            )}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
              🌙 Tonight's Verdict
            </div>
            <p className="text-[15px] sm:text-[16px] font-semibold text-slate-50">
              {verdictText}
            </p>
            {savingsEstimateText && (
              <p className="text-xs text-slate-400 mt-1">
                {savingsEstimateText}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-stretch sm:flex-row sm:items-center gap-2">
          <button
            type="button"
            onClick={onOptimizeClick}
            disabled={isOptimizing}
            className="inline-flex items-center justify-center rounded-lg bg-[#1E4CFF] hover:bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isOptimizing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                ✨ Let Joule tune my settings
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </button>
          {lastOptimization && (
            <div className="text-[11px] text-slate-400 text-left sm:text-right">
              <div>Last tune: {lastOptimization.ranAt}</div>
              <div className="text-slate-300">
                {lastOptimization.resultSummary}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Explanation + one change vs Ask Joule / Today */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* LEFT COLUMN – "What's happening" + "One change" */}
        <div className="space-y-4">
          {/* Are we wasting money? */}
          <div className="bg-[#0C1118] border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-50">
                💸 Are We Wasting Money?
              </h2>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  isWasting
                    ? "bg-amber-500/15 text-amber-300"
                    : "bg-emerald-500/15 text-emerald-300"
                }`}
              >
                {isWasting ? "Things look good" : "Things look good"}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {wastingSummaryText}
            </p>
          </div>

          {/* One recommended change */}
          <div className="bg-[#0C1118] border border-slate-800 rounded-xl p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
              🔧 One Gentle Recommendation
            </div>
            <h3 className="text-sm font-semibold text-slate-50 mb-1">
              {changeTitle}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
              {changeBody}
            </p>
            {changeFootnote && (
              <p className="mt-2 text-[11px] text-slate-500 italic">{changeFootnote}</p>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN – Ask Joule + Today summary */}
        <div className="space-y-4">
          {/* Ask Joule */}
          <div className="bg-[#0C1118] border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                  💬 Ask Joule
                </div>
                <h2 className="text-sm font-semibold text-slate-50">
                  Plain-language answers about what's happening and what you can do.
                </h2>
              </div>
            </div>

            {/* Starter questions */}
            <div className="flex flex-wrap gap-2 mt-1">
              {[
                "Why did my strips run last night?",
                "Can I lower my bill without making guests cold?",
                "What should I set my nighttime temp to?",
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onQuestionClick?.(q)}
                  className="text-[11px] px-2 py-1 rounded-full border border-slate-700 text-slate-300 hover:bg-slate-900 hover:border-slate-600 transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* AskJoule component will be rendered here by parent */}
            <div className="mt-2" id="ask-joule-top-section">
              {askJouleComponent}
            </div>
          </div>

          {/* Today snapshot – very small, at-a-glance */}
          {todaySummary && (
            <div className="bg-[#0C1118] border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-400" />
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">
                    🌤 Today at a Glance
                  </div>
                  <div className="text-xs text-slate-200">
                    {todaySummary.indoor}°F inside · {todaySummary.outdoor}°F outside
                  </div>
                  {todaySummary.stripsStatus && (
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Aux heat: {todaySummary.stripsStatus.toLowerCase()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default HomeTopSection;

