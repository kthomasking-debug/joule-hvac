// src/lib/units.js

/**
 * Unit system:
 * - "us"   → °F, kBTU/h, BTU/hr/°F, kWh, therms
 * - "intl" → °C, kW,   W/K,        Joules, kWh (secondary)
 */

import { useState, useEffect } from "react";

export const UNIT_SYSTEMS = {
  US: "us",
  INTL: "intl",
};

/** ---------- persistence ---------- **/

export function getInitialUnitSystem() {
  if (typeof window === "undefined") return UNIT_SYSTEMS.US;
  try {
    const stored = window.localStorage.getItem("unitSystem");
    return stored === UNIT_SYSTEMS.INTL ? UNIT_SYSTEMS.INTL : UNIT_SYSTEMS.US;
  } catch {
    return UNIT_SYSTEMS.US;
  }
}

export function saveUnitSystem(system) {
  try {
    window.localStorage.setItem("unitSystem", system);
  } catch {
    // ignore
  }
}

/** ---------- temperature ---------- **/

export function fToC(f) {
  return ((f - 32) * 5) / 9;
}

export function cToF(c) {
  return (c * 9) / 5 + 32;
}

/**
 * Format a temperature where the internal value is °F.
 * Example: formatTemperatureFromF(70, 'us') → "70°F"
 *          formatTemperatureFromF(70, 'intl') → "21°C"
 */
export function formatTemperatureFromF(fValue, unitSystem = UNIT_SYSTEMS.US, opts = {}) {
  const { decimals = 0, withUnit = true } = opts;
  if (fValue == null || Number.isNaN(fValue)) return "";

  if (unitSystem === UNIT_SYSTEMS.INTL) {
    const c = fToC(fValue);
    const v = c.toFixed(decimals);
    return withUnit ? `${v}°C` : v;
  }

  const v = fValue.toFixed(decimals);
  return withUnit ? `${v}°F` : v;
}

/** ---------- capacity / power ---------- **/

// 1 BTU/hr ≈ 0.29307107 W
const W_PER_BTUH = 1055.06 / 3600;

/**
 * Capacity is typically stored as kBTU/h in this app.
 * Example: 36 → 36k BTU/h (≈ 10.6 kW)
 */
export function formatCapacityFromKbtuh(kbtuh, unitSystem = UNIT_SYSTEMS.US, opts = {}) {
  const { decimals = 1 } = opts;
  if (kbtuh == null || Number.isNaN(kbtuh)) return "";

  if (unitSystem === UNIT_SYSTEMS.INTL) {
    const kw = kbtuh * 1000 * W_PER_BTUH / 1000; // kBTU/h → BTU/h → W → kW
    return `${kw.toFixed(decimals)} kW`;
  }

  return `${kbtuh.toFixed(decimals)}k BTU/h`;
}

/**
 * Tons (1 ton = 12k BTU/h) → display in tons or kW depending on system.
 */
export function formatCapacityFromTons(tons, unitSystem = UNIT_SYSTEMS.US, opts = {}) {
  const { decimals = 1 } = opts;
  if (tons == null || Number.isNaN(tons)) return "";

  const kbtuh = tons * 12;

  if (unitSystem === UNIT_SYSTEMS.INTL) {
    return formatCapacityFromKbtuh(kbtuh, unitSystem, opts); // will show kW
  }

  return `${tons.toFixed(decimals)} tons`;
}

/** ---------- heat loss factor ---------- **/

// 1 BTU/hr/°F ≈ 0.5275 W/K
const WK_PER_BTUH_PER_F = W_PER_BTUH * (9 / 5);

/**
 * heatLossFactor is usually stored as BTU/hr/°F.
 */
export function formatHeatLossFactor(btuhPerF, unitSystem = UNIT_SYSTEMS.US, opts = {}) {
  const { decimals = 0 } = opts;
  if (btuhPerF == null || Number.isNaN(btuhPerF)) return "";

  if (unitSystem === UNIT_SYSTEMS.INTL) {
    const wPerK = btuhPerF * WK_PER_BTUH_PER_F;
    return `${wPerK.toFixed(decimals)} W/K`;
  }

  return `${btuhPerF.toFixed(decimals)} BTU/hr/°F`;
}

/** ---------- energy (kWh / Joules) ---------- **/

// 1 kWh = 3.6e6 J
const J_PER_KWH = 3_600_000;

/**
 * Convert kWh → Joules
 */
export function kwhToJ(kwh) {
  return (kwh || 0) * J_PER_KWH;
}

/**
 * Format energy, leaning into Joules for 'intl'.
 * Example:
 *   formatEnergyFromKwh(123, 'us')   → "123.0 kWh"
 *   formatEnergyFromKwh(123, 'intl') → "0.44 GJ (123.0 kWh)"
 */
export function formatEnergyFromKwh(kwh, unitSystem = UNIT_SYSTEMS.US, opts = {}) {
  const { decimals = 1 } = opts;
  if (kwh == null || Number.isNaN(kwh)) return "";

  if (unitSystem === UNIT_SYSTEMS.INTL) {
    const joules = kwhToJ(kwh);
    const { value, unit } = formatJoulesParts(joules);
    return `${value} ${unit} (${kwh.toFixed(decimals)} kWh)`;
  }

  return `${kwh.toFixed(decimals)} kWh`;
}

/**
 * Helper: format a Joule value into J / kJ / MJ / GJ.
 */
export function formatJoulesParts(joulesRaw) {
  const joules = joulesRaw || 0;

  if (Math.abs(joules) < 1_000) {
    return { value: joules.toFixed(0), unit: "J" };
  }
  if (Math.abs(joules) < 1_000_000) {
    return { value: (joules / 1_000).toFixed(1), unit: "kJ" };
  }
  if (Math.abs(joules) < 1_000_000_000) {
    return { value: (joules / 1_000_000).toFixed(2), unit: "MJ" };
  }
  return { value: (joules / 1_000_000_000).toFixed(3), unit: "GJ" };
}

/** ---------- tiny React hook (optional but handy) ---------- **/

// You can import this in React components:
//   const { unitSystem, setUnitSystem } = useUnitSystem();

export function useUnitSystem() {
  const [unitSystem, setUnitSystem] = useState(() => getInitialUnitSystem());

  useEffect(() => {
    saveUnitSystem(unitSystem);
  }, [unitSystem]);

  return { unitSystem, setUnitSystem };
}

