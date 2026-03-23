export const CAFFEINE_ONSET_LAG_MINUTES = 10;
export const CAFFEINE_ONSET_RAMP_MINUTES = 35;
export const CAFFEINE_ONSET_FULL_EFFECT_MINUTES = CAFFEINE_ONSET_LAG_MINUTES + CAFFEINE_ONSET_RAMP_MINUTES;

const SIP_INTERVAL_MS = 5 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(progress) {
  const x = clamp(progress, 0, 1);
  return x * x * (3 - 2 * x);
}

export function caffeineOnsetFraction(elapsedMs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;

  const lagMs = CAFFEINE_ONSET_LAG_MINUTES * MINUTE_MS;
  const rampMs = CAFFEINE_ONSET_RAMP_MINUTES * MINUTE_MS;

  if (elapsedMs <= lagMs) return 0;
  if (rampMs <= 0) return 1;

  return smoothstep((elapsedMs - lagMs) / rampMs);
}

export function caffeineEffectPhase(elapsedMs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return "pre-dose";

  const lagMs = CAFFEINE_ONSET_LAG_MINUTES * MINUTE_MS;
  const fullEffectMs = CAFFEINE_ONSET_FULL_EFFECT_MINUTES * MINUTE_MS;

  if (elapsedMs <= lagMs) return "onset";
  if (elapsedMs < fullEffectMs) return "ramping";
  return "full effect";
}

function remainingCaffeineFromSip(sipMg, sipMs, atMs, halfLifeHours) {
  if (!Number.isFinite(sipMg) || sipMg <= 0) return 0;
  if (!Number.isFinite(sipMs) || !Number.isFinite(atMs) || atMs < sipMs) return 0;
  if (!Number.isFinite(halfLifeHours) || halfLifeHours <= 0) return 0;

  const elapsedMs = atMs - sipMs;
  const onsetFraction = caffeineOnsetFraction(elapsedMs);
  if (onsetFraction <= 0) return 0;

  const elapsedHours = elapsedMs / HOUR_MS;
  return sipMg * onsetFraction * Math.pow(0.5, elapsedHours / halfLifeHours);
}

export function activeCaffeineAmountAtTime({ caffeineMg, startMs, durationMinutes = 0, atMs, halfLifeHours }) {
  const doseMg = Number(caffeineMg) || 0;
  const drinkStartMs = Number(startMs);
  const pointMs = Number(atMs);
  const drinkDurationMs = Math.max(0, (Number(durationMinutes) || 0) * MINUTE_MS);

  if (doseMg <= 0 || !Number.isFinite(drinkStartMs) || !Number.isFinite(pointMs) || pointMs < drinkStartMs) {
    return 0;
  }

  if (drinkDurationMs <= 0) {
    return remainingCaffeineFromSip(doseMg, drinkStartMs, pointMs, halfLifeHours);
  }

  const samples = Math.max(2, Math.round(drinkDurationMs / SIP_INTERVAL_MS));
  const sipMg = doseMg / samples;
  let total = 0;

  for (let i = 0; i < samples; i += 1) {
    const sipMs = drinkStartMs + (i / (samples - 1)) * drinkDurationMs;
    total += remainingCaffeineFromSip(sipMg, sipMs, pointMs, halfLifeHours);
  }

  return total;
}