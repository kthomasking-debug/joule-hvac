// src/components/optimization/MaintenanceReminder.jsx
// Predictive maintenance reminders and tracking

import React, { useMemo, useState } from "react";
import { 
  Wrench, 
  Filter, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  Plus,
  Clock
} from "lucide-react";
import { getMaintenanceStatus, trackMaintenance } from "../../lib/optimization/OptimizationEngine";

export default function MaintenanceReminder({ onUpdate, compact = false }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [eventType, setEventType] = useState("filter_change");
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const status = useMemo(() => getMaintenanceStatus(), []);

  const handleAddEvent = () => {
    trackMaintenance({
      type: eventType,
      date: eventDate,
      notes,
    });
    setShowAddModal(false);
    setNotes("");
    if (onUpdate) onUpdate();
  };

  const iconMap = {
    filter_change: <Filter size={18} />,
    tune_up: <Wrench size={18} />,
    seasonal: <Calendar size={18} />,
  };

  return (
    <div className="rounded-2xl overflow-hidden bg-slate-900/50 border border-slate-700/50 backdrop-blur-sm">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              status.needsAttention 
                ? "bg-amber-500/20" 
                : "bg-green-500/20"
            }`}>
              <Wrench className={status.needsAttention ? "text-amber-400" : "text-green-400"} size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white">Maintenance</h3>
              <p className="text-sm text-slate-400">
                {status.needsAttention 
                  ? `${status.overdue.length} item${status.overdue.length > 1 ? "s" : ""} need attention` 
                  : "All caught up!"
                }
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
            title="Log maintenance"
          >
            <Plus className="text-slate-400" size={18} />
          </button>
        </div>
      </div>

      {/* Overdue Items */}
      {status.overdue.length > 0 && (
        <div className="p-4 border-b border-slate-700/50 bg-amber-900/10">
          <h4 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
            <AlertTriangle size={14} /> Overdue
          </h4>
          <div className="space-y-2">
            {status.overdue.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-lg bg-amber-900/20 border border-amber-700/30"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-sm font-medium text-amber-300">{item.title}</span>
                </div>
                <span className="text-xs text-amber-400/70">
                  {item.daysPast} days overdue
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Items */}
      {status.upcoming.length > 0 && (
        <div className="p-4">
          <h4 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
            <Clock size={14} /> Coming Up
          </h4>
          <div className="space-y-2">
            {status.upcoming.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{item.icon}</span>
                  <div>
                    <span className="text-sm font-medium text-white">{item.title}</span>
                    {item.description && (
                      <p className="text-xs text-slate-500">{item.description}</p>
                    )}
                  </div>
                </div>
                {item.daysUntil !== null && (
                  <span className="text-xs text-slate-500">
                    in {item.daysUntil} days
                  </span>
                )}
                {item.action && (
                  <span className="text-xs text-blue-400">{item.action}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Events */}
      {!compact && status.recentEvents.length > 0 && (
        <div className="p-4 border-t border-slate-700/50">
          <h4 className="text-sm font-semibold text-slate-400 mb-3">Recent Maintenance</h4>
          <div className="space-y-2">
            {status.recentEvents.map((event, idx) => (
              <div
                key={event.id || idx}
                className="flex items-center justify-between py-1.5 text-sm"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle className="text-green-500" size={14} />
                  <span className="text-slate-300 capitalize">
                    {event.type.replace("_", " ")}
                  </span>
                </div>
                <span className="text-slate-500">
                  {new Date(event.date).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Summary */}
      {status.lastFilter && !compact && (
        <div className="p-4 border-t border-slate-700/50 bg-slate-800/30">
          <div className="grid grid-cols-2 gap-4 text-center text-sm">
            <div>
              <div className="text-slate-500">Last Filter</div>
              <div className="font-medium text-white">
                {status.lastFilter 
                  ? new Date(status.lastFilter).toLocaleDateString()
                  : "Not tracked"
                }
              </div>
            </div>
            <div>
              <div className="text-slate-500">Last Tune-Up</div>
              <div className="font-medium text-white">
                {status.lastTuneUp 
                  ? new Date(status.lastTuneUp).toLocaleDateString()
                  : "Not tracked"
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-4">Log Maintenance</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Type</label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="filter_change">Filter Change</option>
                  <option value="tune_up">Tune-Up / Service</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="repair">Repair</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">Date</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any details about the maintenance..."
                  className="w-full px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddEvent}
                className="flex-1 px-4 py-2 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600"
              >
                Log Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


