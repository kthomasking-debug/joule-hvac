// predictiveControl.js
// Fetches forecast and computes simple preheat/cool recommendations.
// Uses Open-Meteo public API (no key required) as default.

export async function fetchForecast(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m&forecast_days=2`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Forecast HTTP ${res.status}`);
    const data = await res.json();
    return data?.hourly?.temperature_2m?.slice(0, 48) || [];
  } catch (e) {
    return { error: e.message };
  }
}

// Returns recommendation object { action, leadMinutes, reason }
export function computePreheatRecommendation(
  currentIndoor,
  targetIndoor,
  outdoorTemps
) {
  if (!Array.isArray(outdoorTemps) || outdoorTemps.length < 6) return null;
  // Simple heuristic: look at next 6 hours average outdoor temp
  const nextAvg = outdoorTemps.slice(0, 6).reduce((a, b) => a + b, 0) / 6;
  // If heating and outdoor is dropping, start early
  if (targetIndoor > currentIndoor) {
    const diff = targetIndoor - currentIndoor;
    if (nextAvg < 40 && diff >= 2) {
      return {
        action: "preheat",
        leadMinutes: 45,
        reason: "Outdoor temps falling below 40°F soon.",
      };
    }
    if (nextAvg < 50 && diff >= 3) {
      return {
        action: "preheat",
        leadMinutes: 30,
        reason: "Cooler temps ahead; moderate ramp needed.",
      };
    }
  }
  // Cooling scenario
  if (targetIndoor < currentIndoor) {
    const diff = currentIndoor - targetIndoor;
    if (nextAvg > 85 && diff >= 2) {
      return {
        action: "precool",
        leadMinutes: 40,
        reason: "Hot period incoming (>85°F).",
      };
    }
    if (nextAvg > 78 && diff >= 3) {
      return {
        action: "precool",
        leadMinutes: 25,
        reason: "Warm temps ahead; mild precool beneficial.",
      };
    }
  }
  return null;
}

export async function predictiveControl(lat, lon, currentIndoor, targetIndoor) {
  const outdoorTemps = await fetchForecast(lat, lon);
  if (outdoorTemps.error) return { error: outdoorTemps.error };
  const rec = computePreheatRecommendation(
    currentIndoor,
    targetIndoor,
    outdoorTemps
  );
  return { outdoorTemps, recommendation: rec };
}

export default predictiveControl;
