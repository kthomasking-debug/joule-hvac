// src/lib/heatUtils.js

// --- Constants ---
export const KW_PER_TON_OUTPUT = 3.517;
export const BTU_PER_KWH = 3412.14;
// Standard atmospheric lapse rates (similar to mountain-forecast.com)
// Dry Adiabatic Lapse Rate: temperature decreases ~5.4°F per 1000ft in dry air
const DRY_LAPSE_RATE_F_PER_1000FT = 5.4;
// Saturated/Moist Adiabatic Lapse Rate: temperature decreases ~2.7-3.5°F per 1000ft in moist air
const SATURATED_LAPSE_RATE_F_PER_1000FT = 3.0; // Updated to 3.0 for more accurate moist air adjustment
// Standard Environmental Lapse Rate: average ~3.5°F per 1000ft (used as baseline)
const STANDARD_LAPSE_RATE_F_PER_1000FT = 3.5;

// --- Core Calculation Functions ---

/**
 * Calculates effective square footage accounting for lofts
 * Lofts have less exterior surface area per sqft (similar to upper floors in 2-story homes)
 * @param {number} squareFeet - Total square footage
 * @param {boolean} hasLoft - Whether the home has a loft
 * @param {number} homeShape - Home shape multiplier (1.2 for Cabin)
 * @returns {number} Effective square footage for heat loss calculation
 */
export function getEffectiveSquareFeet(squareFeet, hasLoft = false, homeShape = 1.0) {
  let effectiveSqft = Number(squareFeet);
  
  // Account for lofts: lofts have less exterior surface area per sqft
  // Typical cabin loft is ~30-40% of total sqft, and has ~50% less exterior exposure
  if (hasLoft && homeShape >= 1.2 && homeShape < 1.3) {
    // Assume 35% of square footage is in the loft
    const loftSqft = effectiveSqft * 0.35;
    const mainFloorSqft = effectiveSqft - loftSqft;
    // Loft has ~50% less heat loss per sqft due to reduced exterior exposure
    // Effective sqft = main floor (100%) + loft (50% reduction)
    effectiveSqft = mainFloorSqft + (loftSqft * 0.5);
  }
  
  return effectiveSqft;
}

/**
 * Calculates the building's estimated heat loss in BTU/hr at a 70°F delta-T.
 */
export function calculateHeatLoss({
  squareFeet,
  insulationLevel,
  homeShape,
  ceilingHeight,
  wallHeight = null,
  hasLoft = false,
}) {
  const baseBtuPerSqFt = 22.67;
  const sf = Number(squareFeet);
  const ins = Number(insulationLevel);
  const shape = Number(homeShape);
  const ceil = Number(ceilingHeight);
  const wallH = wallHeight !== null ? Number(wallHeight) : null;
  if (
    !Number.isFinite(sf) ||
    !Number.isFinite(ins) ||
    !Number.isFinite(shape) ||
    !Number.isFinite(ceil) ||
    (wallH !== null && !Number.isFinite(wallH))
  ) {
    console.warn("calculateHeatLoss received invalid inputs", {
      squareFeet,
      insulationLevel,
      homeShape,
      ceilingHeight,
      wallHeight,
    });
    return 0;
  }
  const ceilingMultiplier = 1 + (ceil - 8) * 0.1;
  // Geometry-based shape multiplier for cabins (shape >= 1.2)
  // Calculates actual envelope area ratio: (walls + gable + roof) / (walls + flat ceiling)
  let adjustedShape = shape;
  if (shape >= 1.2 && shape < 1.3) {
    const effectiveWallHeight = wallH !== null ? wallH : 0;
    const peakHeight = ceil; // Peak ceiling height
    
    // Assume square footprint for simplicity: L = W = sqrt(squareFeet)
    const L = Math.sqrt(sf); // Building length (ridge direction)
    const W = Math.sqrt(sf); // Building width (gable end)
    const hw = effectiveWallHeight; // Vertical wall height
    const hp = peakHeight; // Peak ceiling height
    const deltaH = hp - hw; // Gable rise above wall
    
    // Calculate surface areas
    // Vertical walls: 2(L+W) * hw
    const A_walls = 2 * (L + W) * hw;
    
    // Two gable triangles together: W * deltaH
    const A_gable = W * deltaH;
    
    // Roof area (two planes): 2L * s, where s = sqrt((W/2)^2 + deltaH^2)
    const roofHalfSpan = W / 2;
    const roofSlopeLength = Math.sqrt(roofHalfSpan * roofHalfSpan + deltaH * deltaH);
    const A_roof = 2 * L * roofSlopeLength;
    
    // Flat ceiling reference area: L * W
    const A_flatCeiling = L * W;
    
    // Shape multiplier = envelope area ratio
    // M_shape = (A_walls + A_gable + A_roof) / (A_walls + A_flatCeiling)
    const numerator = A_walls + A_gable + A_roof;
    const denominator = A_walls + A_flatCeiling;
    
    if (denominator > 0) {
      adjustedShape = numerator / denominator;
    } else {
      // Fallback if denominator is zero (shouldn't happen, but safety)
      adjustedShape = shape;
    }
  }
  // For standard buildings (shape < 2.0), wall height is already accounted for in ceiling height
  const effectiveSqft = getEffectiveSquareFeet(sf, hasLoft, shape);
  const rawHeatLoss = effectiveSqft * baseBtuPerSqFt * ins * adjustedShape * ceilingMultiplier;
  return Math.round(rawHeatLoss / 1000) * 1000;
}

/**
 * Calculate capacity factor (0.0 to 1.0) as a function of outdoor temperature.
 * 
 * Capacity factor represents what fraction of rated capacity the heat pump can deliver
 * at a given outdoor temperature. Below the cutoff temperature, capacity is 0 (system
 * is locked out or cannot produce useful heat).
 * 
 * @param {number} tempOut - Outdoor temperature in °F
 * @param {number} cutoffTemp - Cutoff temperature in °F (manufacturer-dependent, typically -10°F to -20°F)
 *                              Below this temperature, capacity = 0 (lockout/defrost/no-heat condition)
 * @returns {number} Capacity factor (0.0 to 1.0), where 0.0 means no heat available
 */
export function getCapacityFactor(tempOut, cutoffTemp = -15) {
  // Below cutoff temperature: system is locked out or cannot produce useful heat
  // This explicitly models lockouts, defrost-driven net heating reduction,
  // extreme low-temp performance collapse, and bad sizing signals
  if (tempOut <= cutoffTemp) {
    return 0.0;
  }
  
  if (tempOut >= 47) return 1.0;
  
  if (tempOut < 17) {
    // Below 17°F: 0.64 at 17°F, then 0.01 per °F below 17°F
    // At 17°F: 0.64, at 5°F: 0.64 - (17-5)*0.01 = 0.52
    // No longer clamped to 0.3 - can go to 0 at cutoff temp
    const factor = 0.64 - (17 - tempOut) * 0.01;
    return Math.max(0.0, factor); // Clamp to 0 minimum (cutoff handles lockout)
  }
  
  // Between 17°F and 47°F: linear derate from 1.0 @ 47°F to 0.64 @ 17°F
  // Slope = (1.0 - 0.64) / (47 - 17) = 0.36 / 30 = 0.012 per °F
  return 1.0 - (47 - tempOut) * 0.012;
}

/**
 * Get the base COP curve (unscaled) at a given temperature.
 * This is the shape of the COP curve before scaling to match HSPF2.
 * 
 * @param {number} tempOut - Outdoor temperature in °F
 * @returns {number} Base COP (unscaled)
 */
function getBaseCOPUnscaled(tempOut) {
  if (tempOut >= 47) {
    // Warm conditions: high efficiency
    // COP ≈ 4.5-5.0 at 47°F+ for modern systems
    return 4.8;
  } else if (tempOut >= 17) {
    // Between 17°F and 47°F: linear derate from 4.8 @ 47°F to 2.2 @ 17°F
    // Slope = (4.8 - 2.2) / (47 - 17) = 2.6 / 30 = 0.0867 per °F
    return 4.8 - (47 - tempOut) * 0.0867;
  } else {
    // Below 17°F: steeper derate
    // At 17°F: 2.2, at 5°F: ~1.8, at -10°F: ~1.4
    // Slope ≈ 0.02 per °F below 17°F
    const baseCOP = 2.2 - (17 - tempOut) * 0.02;
    // Clamp minimum COP to 1.2 (still better than resistance heat at 1.0)
    return Math.max(1.2, baseCOP);
  }
}

/**
 * Standard HSPF2 bin hours (representative distribution based on AHRI Standard 210/240).
 * These are the weighted hours at each temperature bin used for HSPF2 calculation.
 * The distribution represents a typical heating season.
 * 
 * Format: [{ temp: temperature, hours: weighted hours }, ...]
 */
const HSPF2_BIN_HOURS = [
  { temp: 62, hours: 87 },   // Very warm (minimal heating)
  { temp: 57, hours: 183 },  // Warm
  { temp: 52, hours: 294 },  // Mild
  { temp: 47, hours: 358 },  // Moderate
  { temp: 42, hours: 415 },  // Cool
  { temp: 37, hours: 460 },   // Cold
  { temp: 33, hours: 430 },   // Very cold
  { temp: 28, hours: 407 },   // Freezing
  { temp: 23, hours: 311 },   // Below freezing
  { temp: 18, hours: 239 },   // Very cold
  { temp: 13, hours: 152 },   // Extremely cold
  { temp: 8, hours: 91 },     // Very extreme
  { temp: 3, hours: 47 },     // Near design temp
  { temp: -2, hours: 20 },     // Design temp range
  { temp: -7, hours: 8 },     // Below design
  { temp: -13, hours: 3 },     // Extreme cold
];

/**
 * Calculate the seasonal average COP of the base curve under standard HSPF2 bin hours.
 * This computes what the base curve's seasonal average COP would be if tested
 * under the same conditions as HSPF2.
 * 
 * @returns {number} Seasonal average COP of the base curve
 */
function computeSeasonalAverageCOP() {
  let totalWeightedCOP = 0;
  let totalHours = 0;
  
  for (const bin of HSPF2_BIN_HOURS) {
    const baseCOP = getBaseCOPUnscaled(bin.temp);
    totalWeightedCOP += baseCOP * bin.hours;
    totalHours += bin.hours;
  }
  
  return totalWeightedCOP / totalHours;
}

/**
 * Calculate COP (Coefficient of Performance) derate factor as a function of outdoor temperature.
 * 
 * Real heat pumps lose efficiency (COP drops) as temperature drops, independent of capacity loss.
 * This function provides a piecewise COP curve that derates with temperature.
 * 
 * The curve is scaled so that when weighted by standard HSPF2 bin hours,
 * the seasonal average COP matches HSPF2/3.412 (since HSPF2 is BTU/Wh).
 * 
 * This ensures the curve matches HSPF2 under the same test conditions, making it
 * valid across climates and runtimes.
 * 
 * Typical COP values:
 * - At 47°F (warm): ~4.5-5.0 (high efficiency)
 * - At 17°F (cold): ~2.0-2.5 (low efficiency)
 * - Below 17°F: continues to drop
 * 
 * @param {number} tempOut - Outdoor temperature in °F
 * @param {number} hspf2 - HSPF2 rating (seasonal average, typically 6-13)
 * @returns {number} COP (Coefficient of Performance, dimensionless)
 */
export function getCOPFactor(tempOut, hspf2 = 9.0) {
  // Get the base COP curve (unscaled)
  const baseCOP = getBaseCOPUnscaled(tempOut);
  
  // Compute seasonal average COP of base curve under standard HSPF2 bin hours
  // Cache this calculation (it's constant for a given base curve)
  if (!getCOPFactor._cachedBaseSeasonalCOP) {
    getCOPFactor._cachedBaseSeasonalCOP = computeSeasonalAverageCOP();
  }
  const baseSeasonalCOP = getCOPFactor._cachedBaseSeasonalCOP;
  
  // Target seasonal COP from HSPF2
  // HSPF2 = BTU/Wh, so seasonal COP = HSPF2 * (1000 Wh/kWh) / (3412.14 BTU/kWh)
  const targetSeasonalCOP = (hspf2 * 1000) / BTU_PER_KWH;
  
  // Scale factor: scale the base curve so its seasonal average matches target
  const scaleFactor = targetSeasonalCOP / baseSeasonalCOP;
  
  // Return scaled COP
  return baseCOP * scaleFactor;
}

/**
 * Calculate defrost penalty for heat pump operation
 * 
 * Accounts for energy waste during defrost cycles when outdoor coils ice up.
 * Defrost frequency depends on frosting potential (wet-bulb / coil temp / runtime),
 * not just outdoor RH alone.
 * 
 * Critical "Defrost Death Zone": 36-40°F with high humidity (90%+) causes rapid
 * ice buildup, requiring defrost cycles every 45-60 minutes (15-20% penalty).
 * 
 * Defrost can occur below 20°F too (less moisture available, but still happens
 * depending on coil conditions). The penalty tapers down at very cold temps due
 * to reduced moisture, but doesn't hard-disable.
 * 
 * **Direction**: defrostPenalty >= 1.0 means "more kW for same heat" (effective COP drop).
 * - defrostPenalty = 1.0: No penalty (normal operation)
 * - defrostPenalty = 1.15: 15% more electrical power needed (15% COP reduction)
 * - defrostPenalty = 1.25: 25% more electrical power needed (25% COP reduction)
 * 
 * Applied as: electricalKw = baseElectricalKw * defrostPenalty
 * 
 * @param {number} outdoorTemp - Outdoor temperature in °F
 * @param {number} humidity - Relative humidity as percentage (0-100)
 * @returns {number} Defrost penalty multiplier (clamped to 1.0-2.0, where 1.0 = no penalty, >1.0 = COP reduction)
 */
export function getDefrostPenalty(outdoorTemp, humidity) {
  const humidityRatio = humidity / 100;
  
  // Temperature-based penalty scaling
  // Peak penalty in "Defrost Death Zone" (36-40°F), tapers above and below
  let tempMultiplier = 1.0;
  
  if (outdoorTemp >= 36 && outdoorTemp <= 40) {
    // Death zone: full penalty
    tempMultiplier = 1.0;
  } else if (outdoorTemp > 40 && outdoorTemp <= 45) {
    // Taper above 40°F: less moisture, warmer air
    // Linear taper from 1.0 @ 40°F to 0.5 @ 45°F
    tempMultiplier = 1.0 - ((outdoorTemp - 40) / 5) * 0.5;
  } else if (outdoorTemp >= 32 && outdoorTemp < 36) {
    // Below death zone but still critical: slight taper
    // Linear taper from 1.0 @ 36°F to 0.9 @ 32°F
    tempMultiplier = 1.0 - ((36 - outdoorTemp) / 4) * 0.1;
  } else if (outdoorTemp >= 20 && outdoorTemp < 32) {
    // Below critical range: taper down
    // Linear taper from 0.9 @ 32°F to 0.6 @ 20°F
    tempMultiplier = 0.9 - ((32 - outdoorTemp) / 12) * 0.3;
  } else if (outdoorTemp < 20) {
    // Below 20°F: taper further (less moisture, but defrost still possible)
    // Linear taper from 0.6 @ 20°F to 0.2 @ -10°F
    // At very cold temps, defrost is less frequent but can still occur
    const taperRange = 20 - (-10); // 30°F range
    const tempBelow20 = 20 - outdoorTemp;
    tempMultiplier = Math.max(0.2, 0.6 - (tempBelow20 / taperRange) * 0.4);
  } else if (outdoorTemp > 45) {
    // Above 45°F: taper to near-zero (very little defrost risk)
    // Linear taper from 0.5 @ 45°F to 0.1 @ 50°F
    if (outdoorTemp <= 50) {
      tempMultiplier = 0.5 - ((outdoorTemp - 45) / 5) * 0.4;
    } else {
      tempMultiplier = 0.1; // Minimal defrost risk above 50°F
    }
  }
  
  // Base penalty depends on temperature band and humidity
  let basePenalty = 0.15; // Default 15% max penalty
  
  // Defrost Death Zone: 36-40°F with high humidity
  if (outdoorTemp >= 36 && outdoorTemp <= 40) {
    // In death zone, increase base penalty for high humidity
    if (humidityRatio >= 0.90) {
      basePenalty = 0.20; // 20% base penalty for 90%+ RH in death zone
    } else if (humidityRatio >= 0.80) {
      basePenalty = 0.18; // 18% for 80-90% RH in death zone
    }
  }
  
  // Apply humidity scaling and temperature multiplier
  let penalty = basePenalty * humidityRatio * tempMultiplier;
  
  // Additional penalty for extreme humidity (95%+) in critical range
  if (humidityRatio >= 0.95 && outdoorTemp >= 32 && outdoorTemp <= 42) {
    // Add extra 2-5% for extreme conditions (98% RH at 38°F = ~3-5% extra)
    // Scale from 0% extra at 95% to 5% extra at 100%
    const extremeBonus = (humidityRatio - 0.95) * 0.10; // 95% = 0%, 98% = 0.3%, 100% = 0.5%
    penalty = penalty + (extremeBonus * tempMultiplier); // Scale extreme bonus by temp too
  }
  
  // Clamp to sane bounds: 1.0 (no penalty) to 2.0 (100% penalty = 50% effective COP)
  const defrostPenalty = 1 + penalty;
  return Math.max(1.0, Math.min(2.0, defrostPenalty));
}

let _invalidPerfLogged = false;
/**
 * Compute heat pump performance for a timestep.
 * 
 * @param {Object} params - System parameters
 * @param {number} params.tons - System capacity in tons
 * @param {number} params.indoorTemp - Indoor temperature (°F)
 * @param {number} params.designHeatLossBtuHrAt70F - Design heat loss (BTU/hr at 70°F delta-T)
 * @param {number} params.compressorPower - Compressor power (kW)
 * @param {number} params.hspf2 - HSPF2 rating
 * @param {number} params.cutoffTemp - Cutoff temperature (°F, default -15)
 * @param {number} outdoorTemp - Outdoor temperature (°F)
 * @param {number} humidity - Relative humidity (%)
 * @param {number} dtHours - Timestep duration in hours (default 1.0)
 * @returns {Object} Performance metrics
 * @returns {number} returns.hpKwh - Heat pump energy (kWh) already scaled for dtHours
 *   Contract: This is ENERGY (kWh) already multiplied by dtHours. Do NOT multiply by dtHours in aggregations.
 * @returns {number} returns.auxKwh - Aux heat energy (kWh) already scaled for dtHours
 *   Contract: This is ENERGY (kWh) already multiplied by dtHours. Do NOT multiply by dtHours in aggregations.
 * @returns {number} returns.deliveredHpBtuHr - Delivered heat (BTU/hr)
 * @returns {number} returns.deficitBtuHr - Deficit requiring aux heat (BTU/hr)
 * @returns {number} returns.availableCapacityBtuHr - Available capacity (BTU/hr)
 */
export function computeHourlyPerformance(
  { tons, indoorTemp, designHeatLossBtuHrAt70F, compressorPower, hspf2, cutoffTemp = -15 },
  outdoorTemp,
  humidity,
  dtHours = 1.0
) {
  // Defensive numeric parsing to avoid NaNs
  let _tons = Number(tons);
  let _indoorTemp = Number(indoorTemp);
  let _heatLossBtu = Number(designHeatLossBtuHrAt70F);
  let _compressorPower = Number(compressorPower);
  let _hspf2 = Number(hspf2) || 9.0; // Default to 9.0 if not provided
  let _outdoorTemp = Number(outdoorTemp);
  // Default humidity to 70% if undefined/invalid to prevent NaN in defrost penalty
  // This prevents NaN propagation: undefined humidity → NaN defrost penalty → NaN hpKwh → NaN totals
  const rh = Number.isFinite(humidity) ? Number(humidity) : 70;

  if (
    !Number.isFinite(_tons) ||
    !Number.isFinite(_indoorTemp) ||
    !Number.isFinite(_heatLossBtu) ||
    !Number.isFinite(_compressorPower) ||
    !Number.isFinite(_outdoorTemp)
  ) {
    if (!_invalidPerfLogged) {
      console.warn(
        "computeHourlyPerformance received invalid inputs (logging once)",
        {
          tons: _tons,
          indoorTemp: _indoorTemp,
          designHeatLossBtuHrAt70F: _heatLossBtu,
          compressorPower: _compressorPower,
          outdoorTemp: _outdoorTemp,
          humidity: rh,
        }
      );
      _invalidPerfLogged = true;
    }
  }

  const btuLossPerDegreeF = _heatLossBtu > 0 ? _heatLossBtu / 70 : 0;
  // Heating mode: ΔT = max(0, target - outdoor) to handle rapid schedule swings
  // Prevents negative ΔT from producing negative kWh when outdoor > indoor
  const tempDiff = Math.max(0, _indoorTemp - _outdoorTemp);
  const buildingHeatLossBtuHr = btuLossPerDegreeF * tempDiff;

  // CAPACITY DERATE: Separate from efficiency derate
  // cutoffTemp is manufacturer-dependent (typically -10°F to -20°F)
  // Below cutoff, capacity = 0 (lockout/no-heat condition)
  const _cutoffTemp = Number(cutoffTemp) || -15;
  const capacityFactor = getCapacityFactor(_outdoorTemp, _cutoffTemp);
  // Correct formula: tons × 12,000 BTU/ton × capacity factor
  // (NOT tons × 3.517 × capacityFactor × 3412 - that multiplies two conversion factors incorrectly)
  const BTU_PER_TON = 12000;
  // Available capacity can be 0 below cutoff temperature (lockout condition)
  // This is "available capacity" (full-tilt output), not necessarily delivered
  const availableCapacityBtuHr = _tons * BTU_PER_TON * capacityFactor;

  // EFFICIENCY DERATE: Separate COP derate curve (independent of capacity)
  const cop = getCOPFactor(_outdoorTemp, _hspf2);
  
  // DEFROST PENALTY: Additional efficiency loss from defrost cycles
  // Direction: defrostPenalty >= 1.0 means "more kW for same heat" (effective COP drop)
  // Clamped to 1.0-2.0 (1.0 = no penalty, 2.0 = 100% penalty = 50% effective COP)
  // Note: rh is already validated above (defaults to 70% if undefined/invalid)
  const defrostPenalty = getDefrostPenalty(_outdoorTemp, rh);
  
  // Calculate base electrical power at full-tilt (for debug only - not used in hpKwh calculation)
  // This is the power needed if running at 100% capacity (before defrost penalty)
  // Full-tilt kW = availableCapacityBtuHr / (COP × 3412.14) × defrostPenalty
  // Note: This is kept for debugging/debugging purposes only. The actual hpKwh is computed
  // from delivered heat / COP, not from this full-tilt power × runtime.
  const baseElectricalKw = (availableCapacityBtuHr > 0 && cop > 0)
    ? availableCapacityBtuHr / (cop * BTU_PER_KWH)
    : 0; // No electrical power if capacity is 0 (below cutoff)
  const fullTiltKw = baseElectricalKw * defrostPenalty; // Full-tilt kW if running at 100% capacity (debug only)
  
  // For backward compatibility, initialize electricalKw (will be reassigned to actual power used below)
  let electricalKw = fullTiltKw;

  // DELIVERED HEAT: Treat availableCapacityBtuHr as delivered load up to capacity
  // This removes the linear kW scaling assumption and makes units cleaner
  // Delivered heat = min(building load, available capacity)
  // If capacity is 0 (below cutoff), all heat must come from aux
  const deliveredHpBtuHr = availableCapacityBtuHr > 0 
    ? Math.min(buildingHeatLossBtuHr, availableCapacityBtuHr)
    : 0; // No heat pump output below cutoff temperature
  const deficitBtuHr = Math.max(0, buildingHeatLossBtuHr - deliveredHpBtuHr);
  const auxKw = deficitBtuHr / BTU_PER_KWH;

  // Calculate capacity utilization (0-1) for display purposes
  // Capacity utilization = delivered / available capacity
  // If capacity is 0, capacity utilization is 0 (system is locked out)
  const capacityUtilization = availableCapacityBtuHr > 0 ? deliveredHpBtuHr / availableCapacityBtuHr : 0;
  let capacityUtilizationPercentage = Math.min(100, capacityUtilization * 100);

  // INVARIANT CHECK: Delivered heat should match building load (within rounding)
  // Use energy (BTU) instead of power (BTU/hr) for safety with sub-hour timesteps
  const _dtHours = Number.isFinite(dtHours) && dtHours > 0 ? dtHours : 1.0;
  
  // COMPUTE kWh DIRECTLY FROM DELIVERED HEAT / COP
  // This removes the linear kW scaling assumption and makes units cleaner
  // hpKwh = (deliveredHpBtuHr * dtHours) / (effectiveCop * 3412.14)
  // Note: defrostPenalty reduces effective COP (increases electrical input for same heat)
  // Effective COP = cop / defrostPenalty
  // Clamp to minimum 0.5 to avoid divide-by-zero blowups from bad inputs
  const effectiveCop = Math.max(0.5, cop / defrostPenalty);
  // Contract: hpKwh is already scaled by dtHours (energy for the timestep)
  // No need to check availableCapacityBtuHr - deliveredHpBtuHr already encodes capacity
  const hpKwh = deliveredHpBtuHr > 0
    ? (deliveredHpBtuHr * _dtHours) / (effectiveCop * BTU_PER_KWH)
    : 0;
  
  // Contract: auxKwh is already scaled by dtHours (energy for the timestep)
  const auxKwh = auxKw * _dtHours; // kW × hours = kWh
  
  // Convert rates to energy for invariant check
  const deliveredHpBtu = deliveredHpBtuHr * _dtHours; // Delivered HP energy
  const deliveredAuxBtu = deficitBtuHr * _dtHours; // Delivered aux energy
  const loadBtu = buildingHeatLossBtuHr * _dtHours; // Building load energy
  
  const deliveredTotalBtu = deliveredHpBtu + deliveredAuxBtu;
  const loadMismatch = Math.abs(deliveredTotalBtu - loadBtu);
  
  if (loadMismatch > 0.1) { // Allow 0.1 BTU rounding tolerance (scales with dtHours)
    console.warn(`Heat balance mismatch: delivered=${deliveredTotalBtu.toFixed(1)} BTU, load=${loadBtu.toFixed(1)} BTU, diff=${loadMismatch.toFixed(1)} (dtHours=${_dtHours})`);
  }
  
  // For backward compatibility, reassign electricalKw to match hpKwh/dtHours (kWh per hour = kW)
  // Note: This is the actual electrical power used, not the full-tilt power
  // Full-tilt power (if running at 100% capacity) would be baseElectricalKw * defrostPenalty
  electricalKw = _dtHours > 0 ? hpKwh / _dtHours : 0; // kWh per hour = kW (actual power used, not full-tilt)

  let actualIndoorTemp = indoorTemp;
  if (capacityUtilization >= 1.0) {
    if (btuLossPerDegreeF > 0) {
      actualIndoorTemp = availableCapacityBtuHr / btuLossPerDegreeF + outdoorTemp;
    }
  }
  capacityUtilizationPercentage = Math.max(0, capacityUtilizationPercentage);

  // Ensure final values are finite numbers
  const _electricalKw = Number.isFinite(electricalKw) ? electricalKw : 0;
  const _capacityUtilization = Number.isFinite(capacityUtilizationPercentage) ? capacityUtilizationPercentage : 0;
  const _actualIndoorTemp = Number.isFinite(actualIndoorTemp)
    ? actualIndoorTemp
    : _indoorTemp;
  const _auxKw = Number.isFinite(auxKw) ? auxKw : 0;
  const _auxKwh = Number.isFinite(auxKwh) ? auxKwh : 0;
  const _defrostPenalty = Number.isFinite(defrostPenalty)
    ? defrostPenalty
    : 1.0;
  const _hpKwh = Number.isFinite(hpKwh) ? hpKwh : 0;
  const _deliveredHpBtuHr = Number.isFinite(deliveredHpBtuHr) ? deliveredHpBtuHr : 0;
  const _fullTiltKw = Number.isFinite(fullTiltKw) ? fullTiltKw : 0;
  
  return {
    electricalKw: _electricalKw, // Actual power used (hpKwh/dtHours), kept for backward compatibility
    fullTiltKw: _fullTiltKw, // Full-tilt kW if running at 100% capacity (debug only)
    capacityUtilization: _capacityUtilization, // Capacity utilization (0-100%), not time-based
    runtime: _capacityUtilization, // Backward compatibility alias (deprecated: use capacityUtilization)
    actualIndoorTemp: _actualIndoorTemp,
    auxKw: _auxKw, // Aux heat power (kW) - INFORMATIONAL ONLY, do not aggregate power, aggregate auxKwh
    auxKwh: _auxKwh, // Aux heat energy (kWh) already scaled for dtHours
    defrostPenalty: _defrostPenalty,
    hpKwh: _hpKwh, // Heat pump energy (kWh) already scaled for dtHours
                   // Contract: This is ENERGY (kWh) already multiplied by dtHours
                   // Do NOT multiply by dtHours in aggregations - it would double-count
    deliveredHpBtuHr: _deliveredHpBtuHr, // Delivered heat (BTU/hr)
    deficitBtuHr: deficitBtuHr,
  };
}

/**
 * Cooling-mode performance (simplified seasonal approximation).
 * Treats buildingLoadPerDegF = designHeatLossBtuHrAt70F/70 as a universal load factor.
 * Heat gain uses (outdoorTemp - indoorTemp) when outdoor hotter; applies a solar exposure multiplier.
 * electricalKw derived from removed BTU / (SEER2 * 1000). Runtime capped at 100%.
 */
export function computeHourlyCoolingPerformance(
  { tons, indoorTemp, designHeatLossBtuHrAt70F, seer2, solarExposure = 1.0 },
  outdoorTemp,
  humidity
) {
  // Defensive numeric parsing
  let _tons = Number(tons);
  let _indoorTemp = Number(indoorTemp);
  let _heatLossBtu = Number(designHeatLossBtuHrAt70F);
  let _seer2 = Number(seer2);
  let _solarExposure = Number(solarExposure);
  let _outdoorTemp = Number(outdoorTemp);
  let _humidity = Number(humidity);

  if (
    !Number.isFinite(_outdoorTemp) ||
    !Number.isFinite(_indoorTemp) ||
    !Number.isFinite(_heatLossBtu)
  ) {
    console.warn("computeHourlyCoolingPerformance received invalid inputs", {
      tons: _tons,
      indoorTemp: _indoorTemp,
      designHeatLossBtuHrAt70F: _heatLossBtu,
      seer2: _seer2,
      solarExposure: _solarExposure,
      outdoorTemp: _outdoorTemp,
          humidity: rh,
    });
  }

  const buildingLoadPerDegF = _heatLossBtu > 0 ? _heatLossBtu / 70 : 0;
  const tempDiff = Math.max(0, _outdoorTemp - _indoorTemp); // only positive when cooling needed
  // Base sensible heat gain (BTU/hr)
  let buildingHeatGainBtu = buildingLoadPerDegF * tempDiff * solarExposure;
  // Light latent adjustment with humidity (simple add-on)
  const latentFactor = 1 + (humidity / 100) * 0.05; // up to +5%
  buildingHeatGainBtu *= latentFactor;

  // Nominal cooling capacity (approx same tons * KW_PER_TON_OUTPUT)
  const nominalCapacityBtu = tons * KW_PER_TON_OUTPUT * BTU_PER_KWH; // (tons * kW/ton * BTU/kWh)

  // Assume mild derate above 95°F ( -1% per °F over 95 )
  let capacityDerate = 1.0;
  if (outdoorTemp > 95)
    capacityDerate = Math.max(0.75, 1 - (outdoorTemp - 95) * 0.01);
  // Clamp availableCapacityBtu away from zero to avoid divide-by-zero
  const availableCapacityBtu = Math.max(0.001, nominalCapacityBtu * capacityDerate);

  const deficitBtu = Math.max(0, buildingHeatGainBtu - availableCapacityBtu);
  // availableCapacityBtu is now guaranteed > 0, so safe to divide
  let runtimePercentage = (buildingHeatGainBtu / availableCapacityBtu) * 100;
  runtimePercentage = Math.min(100, Math.max(0, runtimePercentage));

  // Electrical use (BTU removed / EER). SEER2 approximates seasonal EER: kWh = BTU / (SEER2 * 1000)
  const electricalKw = buildingHeatGainBtu / Math.max(1, (_seer2 || 1) * 1000);

  // Actual indoor temp drift if undersized
  let actualIndoorTemp = indoorTemp;
  if (deficitBtu > 0 && buildingLoadPerDegF > 0) {
    // Temp rises until heat gain equals available capacity
    const equilibriumGain = availableCapacityBtu; // BTU/hr system can remove
    const requiredDiff = equilibriumGain / buildingLoadPerDegF;
    actualIndoorTemp = outdoorTemp - requiredDiff; // indoor temp higher than setpoint
  }

  return {
    electricalKw: Number.isFinite(electricalKw) ? electricalKw : 0,
    runtime: Number.isFinite(runtimePercentage) ? runtimePercentage : 0,
    actualIndoorTemp: Number.isFinite(actualIndoorTemp)
      ? actualIndoorTemp
      : _indoorTemp,
    auxKw: 0, // no auxiliary for cooling (deficit indicates unmet load)
    deficitBtu: Number.isFinite(deficitBtu) ? deficitBtu : 0,
    capacityDerate,
  };
}

/**
 * Adjusts forecast temperatures based on elevation difference between home and weather station.
 * Uses humidity-adjusted lapse rate similar to mountain-forecast.com approach.
 *
 * When home elevation > station elevation: temperatures decrease (colder at higher elevation)
 * When home elevation < station elevation: temperatures increase (warmer at lower elevation)
 *
 * @param {Array} forecast - Array of hourly forecast objects with {time, temp, humidity}
 * @param {number} homeElevation - Elevation of the home in feet
 * @param {number} locationElevation - Elevation of the weather station in feet
 * @returns {Array} Adjusted forecast array with modified temperatures
 */
export function adjustForecastForElevation(
  forecast,
  homeElevation,
  locationElevation
) {
  if (!forecast || !Array.isArray(forecast) || forecast.length === 0) {
    return forecast;
  }

  const elevationDifference = homeElevation - locationElevation;

  // Only adjust if elevation difference is significant (≥10ft for accuracy)
  // Small differences (<10ft) have minimal temperature impact (~0.03-0.05°F)
  if (Math.abs(elevationDifference) < 10) {
    if (typeof window !== "undefined" && import.meta?.env?.DEV) {
      console.log("🌡️ Elevation Adjustment Skipped:", {
        homeElevation,
        locationElevation,
        elevationDifference,
        reason: "Difference < 10ft (minimal impact)",
      });
    }
    return forecast;
  }

  // Debug logging
  if (typeof window !== "undefined" && import.meta?.env?.DEV) {
    console.log("🌡️ Elevation Adjustment Applied:", {
      homeElevation,
      locationElevation,
      elevationDifference,
      direction: elevationDifference > 0 ? "Higher (colder)" : "Lower (warmer)",
      sampleTempBefore: forecast[0]?.temp,
    });
  }

  return forecast.map((hour, index) => {
    // Ensure humidity is a valid number (default to 50% if missing)
    const humidity =
      typeof hour.humidity === "number" &&
      hour.humidity >= 0 &&
      hour.humidity <= 100
        ? hour.humidity
        : 50;
    const humidityRatio = humidity / 100;

    // Calculate humidity-adjusted lapse rate
    // Higher humidity = closer to saturated rate (slower temp change)
    // Lower humidity = closer to dry rate (faster temp change)
    // This interpolation provides more accurate adjustments than a fixed rate
    const lapseRate =
      SATURATED_LAPSE_RATE_F_PER_1000FT +
      (DRY_LAPSE_RATE_F_PER_1000FT - SATURATED_LAPSE_RATE_F_PER_1000FT) *
        (1 - humidityRatio);

    // Calculate temperature adjustment based on elevation difference
    // Positive elevationDifference (home higher) = negative temp adjustment (colder)
    // Negative elevationDifference (home lower) = positive temp adjustment (warmer)
    const tempAdjustment = (elevationDifference / 1000) * lapseRate;
    const adjustedTemp = hour.temp - tempAdjustment;

    // Debug first adjustment for verification
    if (typeof window !== "undefined" && import.meta?.env?.DEV && index === 0) {
      console.log("🌡️ First Hour Temperature Adjustment:", {
        originalTemp: hour.temp.toFixed(1),
        humidity: humidity,
        humidityRatio: humidityRatio.toFixed(2),
        lapseRate: lapseRate.toFixed(2) + "°F/1000ft",
        elevationDifference: elevationDifference.toFixed(0) + "ft",
        tempAdjustment: tempAdjustment.toFixed(2) + "°F",
        adjustedTemp: adjustedTemp.toFixed(1),
        formula: `${hour.temp.toFixed(1)} - ${tempAdjustment.toFixed(
          2
        )} = ${adjustedTemp.toFixed(1)}°F`,
      });
    }

    return { ...hour, temp: adjustedTemp };
  });
}

/**
 * Compute weekly/day summaries from an adjusted forecast array.
 * forecast: array of { time: Date, temp: number, humidity: number }
 * getPerformanceAtTemp: function(outdoorTemp, humidity) => { electricalKw, runtime, actualIndoorTemp, auxKw }
 * utilityCost: number ($/kWh)
 * indoorTemp: setpoint
 */
import { computeHourlyCost } from "./costUtils";

export function computeWeeklyMetrics(
  adjustedForecast,
  getPerformanceAtTemp,
  utilityCost,
  indoorTemp,
  useElectricAuxHeat = true,
  rateSchedule = []
) {
  if (!adjustedForecast) return null;
  const dailyData = {};
  adjustedForecast.forEach((hour) => {
    const day = hour.time.toLocaleDateString();
    if (!dailyData[day]) {
      dailyData[day] = {
        temps: [],
        humidities: [],
        totalEnergy: 0,
        totalCost: 0, // HP-only cost
        totalCostWithAux: 0, // HP + aux cost
        actualIndoorTemps: [],
        achievedIndoorTemps: [],
        auxEnergy: 0,
      };
    }
    // Pass hour.time to getPerformanceAtTemp so it can use schedule-aware temperature
    const perf = getPerformanceAtTemp(hour.temp, hour.humidity, hour.time);
    const energyForHour = perf.electricalKw * ((perf.capacityUtilization || perf.runtime || 0) / 100); // Using capacityUtilization, not time-based runtime
    const auxEnergyForHour = perf.auxKw;

    // Note: The actual indoor temp used is determined inside getPerformanceAtTemp
    // We use the default indoorTemp for achieved temp calculation
    const hourIndoorTemp = indoorTemp;

    dailyData[day].temps.push(hour.temp);
    dailyData[day].humidities.push(hour.humidity);
    dailyData[day].totalEnergy += energyForHour;
    // compute hourly cost using TOU schedule when provided
    const hourCost = computeHourlyCost(
      energyForHour,
      hour.time,
      rateSchedule,
      utilityCost
    );
    // HP-only cost (never includes aux)
    dailyData[day].totalCost += hourCost;
    dailyData[day].actualIndoorTemps.push(perf.actualIndoorTemp);
    dailyData[day].achievedIndoorTemps.push(
      perf.auxKw && perf.auxKw > 0 ? hourIndoorTemp : perf.actualIndoorTemp
    );
    dailyData[day].auxEnergy += auxEnergyForHour;
    // aux energy cost (also charged at TOU rate) - track separately
    const auxHourCost = computeHourlyCost(
      auxEnergyForHour,
      hour.time,
      rateSchedule,
      utilityCost
    );
    // totalCostWithAux = HP cost + aux cost
    // Always calculate both so view mode can switch between them
    dailyData[day].totalCostWithAux += hourCost; // Always add HP cost
    dailyData[day].totalCostWithAux += auxHourCost; // Always add aux cost (view mode will decide whether to show it)
  });

  const summary = Object.keys(dailyData).map((day) => {
    const dayData = dailyData[day];
    const totalEnergyWithAux = dayData.totalEnergy + dayData.auxEnergy; // Always include aux energy for display
    // cost is HP-only, costWithAux always includes aux (view mode decides which to display)
    return {
      day: new Date(day).toLocaleDateString([], {
        weekday: "short",
        month: "numeric",
        day: "numeric",
      }),
      dayDateString: day, // Original date string for away mode matching
      lowTemp: Math.min(...dayData.temps),
      highTemp: Math.max(...dayData.temps),
      avgHumidity:
        dayData.humidities.reduce((a, b) => a + b, 0) /
        dayData.humidities.length,
      energy: dayData.totalEnergy,
      cost: dayData.totalCost, // HP-only cost (never includes aux)
      minIndoorTemp: Math.min(...dayData.achievedIndoorTemps),
      minNoAuxIndoorTemp: Math.min(...dayData.actualIndoorTemps),
      auxEnergy: dayData.auxEnergy,
      costWithAux: dayData.totalCostWithAux, // HP + aux cost (always calculated)
      energyWithAux: totalEnergyWithAux,
    };
  });

  const totalEnergy = summary.reduce((acc, day) => acc + day.energy, 0);
  const totalCost = summary.reduce((acc, day) => acc + day.cost, 0);
  const totalCostWithAux = summary.reduce(
    (acc, day) => acc + day.costWithAux,
    0
  );

  return { summary, totalEnergy, totalCost, totalCostWithAux };
}
