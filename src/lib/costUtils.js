// src/lib/costUtils.js
// Helpers for Time-of-Use (TOU) rate schedules and hourly cost computation

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function timeToMinutes(t) {
  // t expected as "HH:MM" or Date
  if (t instanceof Date) return t.getHours() * 60 + t.getMinutes();
  const parts = String(t || "00:00").split(":");
  const hh = Number(parts[0] || 0);
  const mm = Number(parts[1] || 0);
  return hh * 60 + mm;
}

function dayNameFromDate(d) {
  return DAY_NAMES[d.getDay()];
}

function entryMatchesDatetime(entry, datetime) {
  // entry: { start: '16:00', end: '21:00', days: ['Mon','Tue'], price: 0.4 }
  const dayName = dayNameFromDate(datetime);
  if (entry.days && Array.isArray(entry.days) && entry.days.length > 0) {
    if (!entry.days.includes(dayName)) return false;
  }

  const startMin = timeToMinutes(entry.start);
  const endMin = timeToMinutes(entry.end);
  const tMin = timeToMinutes(datetime);

  if (startMin <= endMin) {
    return tMin >= startMin && tMin < endMin;
  }
  // crosses midnight: e.g., 22:00 - 06:00
  return tMin >= startMin || tMin < endMin;
}

export function computeHourlyRate(datetime, schedule = [], flatRate = 0.0) {
  if (!schedule || schedule.length === 0) return flatRate;
  // Last-defined wins: iterate and when match, set rate (later entries override earlier)
  let rate = flatRate;
  for (let i = 0; i < schedule.length; i++) {
    const entry = schedule[i];
    try {
      if (entryMatchesDatetime(entry, datetime)) {
        rate = Number(entry.price) || rate;
      }
    } catch {
      // ignore malformed entry
    }
  }
  return rate;
}

export function computeHourlyCost(
  kWh,
  datetime,
  schedule = [],
  flatRate = 0.0
) {
  const dt = datetime instanceof Date ? datetime : new Date(datetime);
  const rate = computeHourlyRate(dt, schedule, flatRate);
  return kWh * rate;
}

export default { computeHourlyRate, computeHourlyCost };
