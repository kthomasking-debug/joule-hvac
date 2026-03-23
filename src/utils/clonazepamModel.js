export const CLONAZEPAM_ONSET_LAG_MINUTES = 15;
export const CLONAZEPAM_ONSET_RAMP_MINUTES = 105;
export const CLONAZEPAM_ONSET_FULL_EFFECT_MINUTES = CLONAZEPAM_ONSET_LAG_MINUTES + CLONAZEPAM_ONSET_RAMP_MINUTES;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(progress) {
  const x = clamp(progress, 0, 1);
  return x * x * (3 - 2 * x);
}

export function clonazepamOnsetFraction(elapsedMs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;

  const lagMs = CLONAZEPAM_ONSET_LAG_MINUTES * MINUTE_MS;
  const rampMs = CLONAZEPAM_ONSET_RAMP_MINUTES * MINUTE_MS;

  if (elapsedMs <= lagMs) return 0;
  if (rampMs <= 0) return 1;

  return smoothstep((elapsedMs - lagMs) / rampMs);
}

export function clonazepamEffectPhase(elapsedMs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return "pre-dose";

  const lagMs = CLONAZEPAM_ONSET_LAG_MINUTES * MINUTE_MS;
  const fullEffectMs = CLONAZEPAM_ONSET_FULL_EFFECT_MINUTES * MINUTE_MS;

  if (elapsedMs <= lagMs) return "onset";
  if (elapsedMs < fullEffectMs) return "ramping";
  return "full effect";
}

export function activeClonazepamAmountAtTime({ doseMg, takenAtMs, atMs, halfLifeHours }) {
  const dose = Number(doseMg) || 0;
  const doseTimeMs = Number(takenAtMs);
  const pointTimeMs = Number(atMs);

  if (dose <= 0 || !Number.isFinite(doseTimeMs) || !Number.isFinite(pointTimeMs) || pointTimeMs < doseTimeMs) {
    return 0;
  }

  if (!Number.isFinite(halfLifeHours) || halfLifeHours <= 0) {
    return 0;
  }

  const elapsedMs = pointTimeMs - doseTimeMs;
  const onsetFraction = clonazepamOnsetFraction(elapsedMs);
  if (onsetFraction <= 0) return 0;

  const elapsedHours = elapsedMs / HOUR_MS;
  return dose * onsetFraction * Math.pow(0.5, elapsedHours / halfLifeHours);
}