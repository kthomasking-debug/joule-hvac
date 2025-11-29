import React, { useState } from "react";
import { Plus, Trash2, Clock } from "lucide-react";
import {
  loadThermostatSettings,
  saveThermostatSettings,
} from "../lib/thermostatSettings";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const DAY_KEYS = [0, 1, 2, 3, 4, 5, 6];
const COMFORT_SETTINGS = ["home", "away", "sleep"];

export default function ScheduleEditor() {
  const [settings, setSettings] = useState(loadThermostatSettings());
  const [selectedDay] = useState(null);

  const updateSchedule = (dayKey, schedule) => {
    const updated = { ...settings };
    updated.schedule.weekly[dayKey] = schedule;
    saveThermostatSettings(updated);
    setSettings(updated);
  };

  const addScheduleEntry = (dayKey) => {
    const daySchedule = settings.schedule.weekly[dayKey] || [];
    const newEntry = {
      time: "12:00",
      comfortSetting: "home",
    };
    const updated = [...daySchedule, newEntry].sort((a, b) =>
      a.time.localeCompare(b.time)
    );
    updateSchedule(dayKey, updated);
  };

  const removeScheduleEntry = (dayKey, index) => {
    const daySchedule = settings.schedule.weekly[dayKey] || [];
    const updated = daySchedule.filter((_, i) => i !== index);
    updateSchedule(dayKey, updated);
  };

  const updateScheduleEntry = (dayKey, index, field, value) => {
    const daySchedule = settings.schedule.weekly[dayKey] || [];
    const updated = daySchedule.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry
    );
    updateSchedule(dayKey, updated);
  };

  const copyDaySchedule = (fromDay, toDay) => {
    const fromSchedule = settings.schedule.weekly[fromDay] || [];
    updateSchedule(toDay, [...fromSchedule]);
  };

  const clearDaySchedule = (dayKey) => {
    updateSchedule(dayKey, []);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Weekly Schedule
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Set times when comfort settings change throughout the week
          </p>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.schedule.enabled}
            onChange={(e) => {
              const updated = { ...settings };
              updated.schedule.enabled = e.target.checked;
              saveThermostatSettings(updated);
              setSettings(updated);
            }}
            className="rounded"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Enable Schedule
          </span>
        </label>
      </div>

      {!settings.schedule.enabled && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Schedule is disabled. Enable it to use automatic comfort setting
            changes.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DAY_KEYS.map((dayKey) => {
          const daySchedule = settings.schedule.weekly[dayKey] || [];
          const isSelected = selectedDay === dayKey;

          return (
            <div
              key={dayKey}
              className={`bg-white dark:bg-gray-800 border rounded-lg p-4 ${
                isSelected
                  ? "border-blue-500 dark:border-blue-400 shadow-lg"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-800 dark:text-gray-100">
                  {DAYS[dayKey]}
                </h4>
                <div className="flex gap-1">
                  {dayKey > 0 && (
                    <button
                      onClick={() => copyDaySchedule(dayKey - 1, dayKey)}
                      className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      title="Copy from previous day"
                    >
                      Copy
                    </button>
                  )}
                  <button
                    onClick={() => clearDaySchedule(dayKey)}
                    className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
                    title="Clear all entries"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {daySchedule.length === 0 ? (
                <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                  No schedule entries
                </div>
              ) : (
                <div className="space-y-2">
                  {daySchedule.map((entry, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded"
                    >
                      <div className="flex items-center gap-1 flex-1">
                        <Clock size={14} className="text-gray-400" />
                        <input
                          type="time"
                          value={entry.time}
                          onChange={(e) =>
                            updateScheduleEntry(
                              dayKey,
                              index,
                              "time",
                              e.target.value
                            )
                          }
                          className="flex-1 px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                        />
                      </div>
                      <select
                        value={entry.comfortSetting}
                        onChange={(e) =>
                          updateScheduleEntry(
                            dayKey,
                            index,
                            "comfortSetting",
                            e.target.value
                          )
                        }
                        className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 capitalize"
                      >
                        {COMFORT_SETTINGS.map((setting) => (
                          <option key={setting} value={setting}>
                            {setting}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeScheduleEntry(dayKey, index)}
                        className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => addScheduleEntry(dayKey)}
                className="mt-3 w-full px-3 py-2 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex items-center justify-center gap-1"
              >
                <Plus size={14} />
                Add Entry
              </button>
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Tip:</strong> Schedule entries are automatically sorted by
          time. The comfort setting will change at each scheduled time
          throughout the day.
        </p>
      </div>
    </div>
  );
}
