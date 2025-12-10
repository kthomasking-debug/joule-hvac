import React, { useMemo, useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, X, MessageSquare } from "lucide-react";
import { getSystemHealthAlerts, filterActiveAlerts } from "../utils/alertDetector";
import { loadSnoozedAlerts, snoozeAlert } from "../utils/alertStorage";

/**
 * System Health Alerts Component
 * 
 * Displays data-driven alerts from Ask Joule that don't conflict with tech advice.
 * Uses humble language and allows users to dismiss/snooze alerts.
 */
export default function SystemHealthAlerts({
  settings,
  latestAnalysis,
  systemStatus,
  outdoorTemp,
  onAskJoule, // Callback when user clicks "Ask Joule" button
}) {
  const [snoozedAlerts, setSnoozedAlerts] = useState(() => loadSnoozedAlerts());

  // Detect alerts from current metrics
  const allAlerts = useMemo(() => {
    if (!settings || typeof outdoorTemp !== 'number') return [];
    try {
      return getSystemHealthAlerts(settings, latestAnalysis, systemStatus, outdoorTemp);
    } catch (error) {
      console.warn("Failed to detect alerts:", error);
      return [];
    }
  }, [settings, latestAnalysis, systemStatus, outdoorTemp]);

  // Filter active alerts (not snoozed)
  const activeAlerts = useMemo(() => {
    return filterActiveAlerts(allAlerts, snoozedAlerts, 2);
  }, [allAlerts, snoozedAlerts]);

  // Handle "Got it" - snooze for 14 days
  const handleGotIt = (alert) => {
    if (alert.muteKey) {
      snoozeAlert(alert.muteKey, 14);
      setSnoozedAlerts(loadSnoozedAlerts());
    }
  };

  // Handle "My tech is handling this" - snooze for 60 days
  const handleTechHandling = (alert) => {
    if (alert.muteKey) {
      snoozeAlert(alert.muteKey, 60);
      setSnoozedAlerts(loadSnoozedAlerts());
    }
  };

  // Handle "Ask Joule" - open chat with pre-filled question
  const handleAskJoule = (alert) => {
    if (onAskJoule && alert.suggestedQuestion) {
      onAskJoule(alert.suggestedQuestion);
    }
  };

  // If no active alerts, show "all good" state
  if (activeAlerts.length === 0) {
    return (
      <div className="bg-[#0C1118] border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full p-2 bg-emerald-500/10">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-50">💙 System Health</h3>
            <p className="text-xs text-slate-400 mt-0.5 italic">
              Everything looks normal based on recent data.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show active alerts
  return (
    <div className="bg-[#0C1118] border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="rounded-full p-2 bg-amber-500/10">
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-50">💙 System Health</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              <strong className="text-slate-200">{activeAlerts.length}</strong> {activeAlerts.length === 1 ? "thing" : "things"} worth a look
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {activeAlerts.map((alert) => (
          <div
            key={alert.id}
            className="border-b border-slate-800 pb-4 last:border-b-0 last:pb-0"
          >
            {/* Alert Header */}
            <div className="flex items-start gap-2 mb-2">
              <div
                className={`mt-0.5 rounded-full p-1 ${
                  alert.severity === "critical"
                    ? "bg-red-500/10"
                    : alert.severity === "warn"
                    ? "bg-amber-500/10"
                    : "bg-blue-500/10"
                }`}
              >
                <AlertCircle
                  className={`w-3 h-3 ${
                    alert.severity === "critical"
                      ? "text-red-400"
                      : alert.severity === "warn"
                      ? "text-amber-400"
                      : "text-blue-400"
                  }`}
                />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-50">
                  {alert.message}
                </div>
                {alert.metricSummary && (
                  <div className="text-xs text-slate-400 mt-0.5">
                    {alert.metricSummary}
                  </div>
                )}
              </div>
            </div>

            {/* Alert Detail */}
            {alert.detail && (
              <p className="text-xs text-slate-300 leading-relaxed mb-2 ml-6">
                {alert.detail}
              </p>
            )}

            {/* Escape Hatch */}
            <p className="text-[11px] text-slate-500 mb-3 ml-6">
              If your contractor already checked this, you can dismiss it.
            </p>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 ml-6">
              {alert.suggestedQuestion && (
                <button
                  onClick={() => handleAskJoule(alert)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                >
                  <MessageSquare className="w-3 h-3" />
                  Ask Joule
                </button>
              )}
              <button
                onClick={() => handleGotIt(alert)}
                className="px-2.5 py-1.5 text-[11px] font-medium text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Got it
              </button>
              <button
                onClick={() => handleTechHandling(alert)}
                className="px-2.5 py-1.5 text-[11px] font-medium text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                My tech is handling this
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

