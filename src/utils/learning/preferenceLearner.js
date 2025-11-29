// preferenceLearner.js
// Records thermostat-related interactions and infers a simple schedule + suggestions.
// Persistence: localStorage key 'preferenceLearningData'

const PREF_KEY = "preferenceLearningData";

function loadData() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveData(data) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function recordPreferenceEvent({ intent, updates }) {
  // Only record temperature/mode/preset modifications
  if (!intent) return;
  if (
    ![
      "setTemperature",
      "increaseTemperature",
      "decreaseTemperature",
      "setMode",
      "applyPreset",
    ].includes(intent)
  )
    return;
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0-6
  const entry = {
    ts: now.getTime(),
    hour,
    day,
    intent,
    targetTemp: updates?.targetTemp,
    mode: updates?.mode,
    preset: updates?.preset,
  };
  const data = loadData();
  data.push(entry);
  // Cap size for memory
  if (data.length > 500) data.shift();
  saveData(data);
}

export function analyzePreferences() {
  const data = loadData();
  if (data.length === 0)
    return {
      schedule: [],
      sleepStart: null,
      wakeTime: null,
      avgDayTemp: null,
      avgNightTemp: null,
      suggestions: [],
    };
  // Aggregate temps by hour
  const tempsByHour = new Map();
  for (const d of data) {
    if (typeof d.targetTemp === "number") {
      if (!tempsByHour.has(d.hour)) tempsByHour.set(d.hour, []);
      tempsByHour.get(d.hour).push(d.targetTemp);
    }
  }
  const hourAverages = [...tempsByHour.entries()].map(([h, arr]) => ({
    hour: h,
    avg: arr.reduce((a, b) => a + b, 0) / arr.length,
  }));
  hourAverages.sort((a, b) => a.hour - b.hour);

  // Compute day vs night temps (day: 7-21)
  const dayTemps = hourAverages
    .filter((h) => h.hour >= 7 && h.hour <= 21)
    .map((h) => h.avg);
  const nightTemps = hourAverages
    .filter((h) => h.hour < 7 || h.hour > 21)
    .map((h) => h.avg);
  const avgDayTemp = dayTemps.length
    ? dayTemps.reduce((a, b) => a + b, 0) / dayTemps.length
    : null;
  const avgNightTemp = nightTemps.length
    ? nightTemps.reduce((a, b) => a + b, 0) / nightTemps.length
    : null;

  // Sleep detection: look for sustained lower temp between 22-5
  const nightLowHours = hourAverages.filter(
    (h) =>
      (h.hour >= 22 || h.hour <= 5) &&
      avgDayTemp !== null &&
      h.avg <= avgDayTemp - 2
  );
  let sleepStart = null;
  if (nightLowHours.length) {
    // earliest hour considered sleep start
    sleepStart = nightLowHours.reduce(
      (min, h) => (min === null || h.hour < min ? h.hour : min),
      null
    );
  }
  // Wake time: first hour after 4 with temp >= (avgNightTemp + 1)
  let wakeTime = null;
  if (avgNightTemp !== null) {
    const candidate = hourAverages.find(
      (h) => h.hour >= 5 && h.avg >= avgNightTemp + 1
    );
    if (candidate) wakeTime = candidate.hour;
  }

  // Suggestions heuristics
  const suggestions = [];
  if (avgDayTemp !== null && avgNightTemp !== null) {
    const delta = avgDayTemp - avgNightTemp;
    if (delta < 1.5)
      suggestions.push("Consider a 2-3°F nighttime setback to save energy.");
    if (delta > 5)
      suggestions.push(
        "Large day/night temperature swing detected; verify comfort levels."
      );
  }
  if (sleepStart !== null && wakeTime !== null) {
    suggestions.push(
      `Detected sleep window around ${formatHour(sleepStart)}–${formatHour(
        wakeTime
      )}; you can automate this.`
    );
  }
  if (avgDayTemp !== null && avgDayTemp > 72)
    suggestions.push(
      "Daytime temperature above 72°F; lowering 1-2°F could reduce costs."
    );

  const schedule = hourAverages.map((h) => ({
    hour: h.hour,
    setpoint: Math.round(h.avg),
  }));

  return {
    schedule,
    sleepStart,
    wakeTime,
    avgDayTemp: round1(avgDayTemp),
    avgNightTemp: round1(avgNightTemp),
    suggestions,
  };
}

function round1(v) {
  return v === null ? null : Math.round(v * 10) / 10;
}
function formatHour(h) {
  if (h === null) return "";
  const suffix = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${suffix}`;
}

export function getPreferenceSummary() {
  return analyzePreferences();
}

export default {
  recordPreferenceEvent,
  analyzePreferences,
  getPreferenceSummary,
};
