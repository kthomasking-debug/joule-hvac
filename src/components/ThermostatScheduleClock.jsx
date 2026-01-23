// src/components/ThermostatScheduleClock.jsx
// Visual clock interface for setting thermostat schedule times

import React from "react";

// Helper component for easy time selection with dropdowns
function TimeSelector({ value, onChange, color = "yellow" }) {
  // Parse 24-hour time string to components
  const parseTime = (timeStr) => {
    const [h, m] = (timeStr || "12:00").split(":").map(Number);
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h < 12 ? "AM" : "PM";
    return { hour: hour12, minute: m, ampm };
  };

  // Convert components back to 24-hour format
  const formatTime24 = (hour, minute, ampm) => {
    let h24 = hour;
    if (ampm === "AM") {
      h24 = hour === 12 ? 0 : hour;
    } else {
      h24 = hour === 12 ? 12 : hour + 12;
    }
    return `${h24.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  };

  const { hour, minute, ampm } = parseTime(value);

  const handleHourChange = (newHour) => {
    onChange(formatTime24(parseInt(newHour), minute, ampm));
  };

  const handleMinuteChange = (newMinute) => {
    onChange(formatTime24(hour, parseInt(newMinute), ampm));
  };

  const handleAmpmChange = (newAmpm) => {
    onChange(formatTime24(hour, minute, newAmpm));
  };

  const borderColor = color === "yellow" ? "border-yellow-500/50" : "border-blue-500/50";
  const focusColor = color === "yellow" ? "focus:ring-yellow-500/50" : "focus:ring-blue-500/50";
  const bgColor = "bg-slate-800/80";

  const selectClass = `${bgColor} ${borderColor} ${focusColor} text-slate-100 text-2xl font-bold rounded-lg px-3 py-3 focus:outline-none focus:ring-2 cursor-pointer appearance-none`;

  return (
    <div className="flex items-center justify-center gap-1">
      {/* Hour */}
      <select
        value={hour}
        onChange={(e) => handleHourChange(e.target.value)}
        className={`${selectClass} w-20`}
      >
        {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="text-slate-400 font-bold text-3xl">:</span>
      {/* Minute */}
      <select
        value={minute}
        onChange={(e) => handleMinuteChange(e.target.value)}
        className={`${selectClass} w-24`}
      >
        {[0, 15, 30, 45].map((m) => (
          <option key={m} value={m}>{m.toString().padStart(2, "0")}</option>
        ))}
      </select>
      {/* AM/PM */}
      <select
        value={ampm}
        onChange={(e) => handleAmpmChange(e.target.value)}
        className={`${selectClass} w-20`}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

export default function ThermostatScheduleClock({
  daytimeStart = "06:00",
  setbackStart = "22:00",
  onDaytimeStartChange,
  onSetbackStartChange,
  compact = false,
}) {
  return (
    <div className="relative">
      {/* Time Inputs */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-6">
          {/* Daytime Start */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="w-4 h-4 rounded-full bg-yellow-400"></div>
              <span className="text-lg font-semibold text-slate-300">
                Daytime Start
              </span>
            </div>
            <TimeSelector
              value={daytimeStart || "06:00"}
              onChange={(newTime) => {
                if (onDaytimeStartChange) {
                  onDaytimeStartChange(newTime);
                }
              }}
              color="yellow"
            />
            <p className="text-sm text-slate-400 mt-2">When warmer temp starts</p>
          </div>

          {/* Setback Start */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="w-4 h-4 rounded-full bg-blue-400"></div>
              <span className="text-lg font-semibold text-slate-300">
                Setback Start
              </span>
            </div>
            <TimeSelector
              value={setbackStart || "22:00"}
              onChange={(newTime) => {
                if (onSetbackStartChange) {
                  onSetbackStartChange(newTime);
                }
              }}
              color="blue"
            />
            <p className="text-sm text-slate-400 mt-2">When cooler temp starts</p>
          </div>
        </div>
      </div>
    </div>
  );
}

