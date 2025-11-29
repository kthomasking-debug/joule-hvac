// src/lib/optimizer/comfortOptimizer.js
// Pure schedule generation for AI Comfort Optimizer (MVP)

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function average(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function computeModeFromForecast(forecast) {
  if (!forecast || forecast.length === 0) return "heating"; // default bias
  const next24 = forecast.slice(0, 24);
  const avgT = average(next24.map((p) => Number(p.temp) || 0));
  return avgT < 65 ? "heating" : "cooling";
}

function hasMorningWinterBump(learningEvents, now = new Date()) {
  if (!Array.isArray(learningEvents) || learningEvents.length === 0)
    return false;
  const cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const bumps = learningEvents.filter((e) => {
    if (!e || e.kind !== "winter") return false;
    const h = Number(e.hour);
    if (!(h >= 5 && h <= 8)) return false;
    if (e.ts) {
      try {
        const ts = new Date(e.ts);
        if (ts < cutoff) return false;
      } catch {
        // Ignore invalid timestamp
      }
    }
    return Number(e.next) > Number(e.prev);
  });
  return bumps.length >= 3;
}

function safeBounds(mode) {
  return mode === "cooling" ? { min: 68, max: 78 } : { min: 60, max: 74 };
}

export function generateSchedule(
  settings = {},
  forecast,
  learningEvents = [],
  now = new Date()
) {
  const mode = computeModeFromForecast(forecast);
  const bounds = safeBounds(mode);
  const base =
    mode === "cooling"
      ? settings.summerThermostat ?? 74
      : settings.winterThermostat ?? 70;

  const blocks = [];

  // Night setback: 22:00 - 05:00
  const nightDelta = mode === "cooling" ? +2 : -2;
  const nightSet = clamp(base + nightDelta, bounds.min, bounds.max);
  blocks.push({
    startHour: 22,
    endHour: 5,
    setpoint: nightSet,
    rationale: ["night_setback"],
  });

  // Morning pre-warm if pattern suggests (heating only)
  if (mode === "heating" && hasMorningWinterBump(learningEvents, now)) {
    const prewarmSet = clamp(base + 2, bounds.min, bounds.max);
    blocks.push({
      startHour: 5,
      endHour: 7,
      setpoint: prewarmSet,
      rationale: ["morning_prewarm", "learned_pattern"],
    });
  }

  // Midday cost-aware nudge (12:00 - 16:00)
  let middaySet = base;
  if (forecast && forecast.length > 0) {
    const midday = forecast.slice(12, 16);
    const avgMid = average(midday.map((p) => Number(p.temp) || 0));
    if (mode === "heating" && avgMid < 30) {
      middaySet = clamp(base - 1, bounds.min, bounds.max); // save a bit on very cold days
    } else if (mode === "cooling" && avgMid > 88) {
      middaySet = clamp(base - 1, bounds.min, bounds.max); // cool slightly earlier for comfort
    }
  }
  blocks.push({
    startHour: 12,
    endHour: 16,
    setpoint: middaySet,
    rationale: ["midday_adjust"],
  });

  // Default all other hours -> base setpoint
  // Represent as catch-all block for clarity
  blocks.push({
    startHour: 0,
    endHour: 24,
    setpoint: clamp(base, bounds.min, bounds.max),
    rationale: ["baseline"],
  });

  // Sort blocks by start time to aid consumers
  blocks.sort((a, b) => a.startHour - b.startHour);

  const date = new Date(now);
  const isoDate = date.toISOString().slice(0, 10);
  return {
    date: isoDate,
    mode,
    baseSetpoint: clamp(base, bounds.min, bounds.max),
    bounds,
    blocks,
  };
}

export default generateSchedule;
