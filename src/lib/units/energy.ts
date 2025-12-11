// --- Constants --------------------------------------------------------------

export const J_PER_WH = 3600;            // 1 Wh  = 3,600 J
export const J_PER_KWH = 3.6e6;         // 1 kWh = 3,600,000 J
export const J_PER_MJ = 1e6;            // 1 MJ  = 1,000,000 J
export const J_PER_GJ = 1e9;            // 1 GJ  = 1,000,000,000 J

export type EnergyDisplayMode = "user" | "nerd";

export interface FormatEnergyOptions {
  /** "user" = normal people, "nerd" = Joule / SI view */
  mode?: EnergyDisplayMode;
  /** Number of decimals for the primary unit */
  precision?: number;
  /** If true, also include raw Joules at the end (nerd mode only) */
  includeJoules?: boolean;
}

/**
 * Format an energy quantity stored in Joules.
 *
 * Internally you always use Joules. This helper outputs:
 *
 * - mode="user":   `12.4 kWh`
 * - mode="nerd":   `44.6 MJ (12.4 kWh)` or `3.21 GJ (892.0 kWh)`
 */
export function formatEnergy(
  joules: number,
  options: FormatEnergyOptions = {}
): string {
  const {
    mode = "user",
    precision = 1,
    includeJoules = false,
  } = options;

  if (!Number.isFinite(joules) || joules === 0) {
    return `0 kWh`;
  }

  const kWh = joules / J_PER_KWH;

  if (mode === "user") {
    // Normal people: keep it simple, always kWh
    return `${kWh.toFixed(precision)} kWh`;
  }

  // --- Nerd / Joule mode ---------------------------------------------------

  // Pick a sensible Joule-based unit
  let primaryValue: number;
  let primaryUnit: "MJ" | "GJ";

  if (joules >= 5 * J_PER_GJ) {
    // Very large seasonal / annual totals in GJ
    primaryValue = joules / J_PER_GJ;
    primaryUnit = "GJ";
  } else {
    // Most things in MJ
    primaryValue = joules / J_PER_MJ;
    primaryUnit = "MJ";
  }

  const parts = [
    `${primaryValue.toFixed(precision)} ${primaryUnit}`,
    `(${kWh.toFixed(precision)} kWh)`,
  ];

  if (includeJoules) {
    parts.push(`${joules.toFixed(0)} J`);
  }

  return parts.join(" ");
}

// --- Optional little helpers if you want them ------------------------------

export function kWhToJ(kWh: number): number {
  return kWh * J_PER_KWH;
}

export function jToKWh(joules: number): number {
  return joules / J_PER_KWH;
}






