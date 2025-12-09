/**
 * Manual J Heat Loss Calculator
 * Based on ACCA Manual J methodology from the RAG knowledge base
 * Uses U-values, infiltration, and construction type to calculate heat loss
 */

/**
 * Calculate heat loss factor using Manual J methodology
 * @param {Object} params - Home characteristics
 * @param {number} params.squareFeet - Home square footage
 * @param {string} params.homeType - 'new_tight' | 'decent_90s' | 'older_avg' | 'leaky_old'
 * @param {number} params.ceilingHeight - Ceiling height in feet (default 8)
 * @param {number} params.homeShape - Shape multiplier (default 1.0)
 * @returns {number} Heat loss factor in BTU/hr/°F
 */
export function calculateManualJHeatLoss({
  squareFeet = 2000,
  homeType = 'decent_90s',
  ceilingHeight = 8,
  homeShape = 1.0,
}) {
  // Manual J U-values by construction type (from RAG knowledge base)
  // R-13 wall = U-0.077, R-30 roof = U-0.033
  // These are typical values - actual Manual J uses detailed component-by-component calculation
  
  const homeTypeConfig = {
    new_tight: {
      // New & Well Insulated (~2015+)
      wallU: 0.05,        // R-20+ walls (U-0.05)
      roofU: 0.025,       // R-40+ roof (U-0.025)
      floorU: 0.04,       // R-25+ floor (U-0.04)
      windowU: 0.25,      // Double-pane low-E (U-0.25)
      infiltrationACH: 0.25, // Tight: ACH50 < 3 → 0.15-0.25 ACH normal
      windowAreaRatio: 0.15,  // 15% of wall area is windows
    },
    decent_90s: {
      // Decent 1990-2010 Home
      wallU: 0.077,       // R-13 walls (U-0.077 per Manual J)
      roofU: 0.033,       // R-30 roof (U-0.033 per Manual J)
      floorU: 0.05,       // R-20 floor (U-0.05)
      windowU: 0.35,      // Double-pane standard (U-0.35)
      infiltrationACH: 0.4,  // Average: ACH50 3-7 → 0.35-0.5 ACH normal
      windowAreaRatio: 0.18,  // 18% of wall area is windows
    },
    older_avg: {
      // Older, Average Insulation (1960-1990)
      wallU: 0.10,        // R-11 walls (U-0.10)
      roofU: 0.05,        // R-19 roof (U-0.05)
      floorU: 0.08,       // R-12 floor (U-0.08)
      windowU: 0.50,      // Older double-pane or single-pane (U-0.50)
      infiltrationACH: 0.6,  // Average to loose: ACH50 5-8 → 0.5-0.7 ACH normal
      windowAreaRatio: 0.20,  // 20% of wall area is windows
    },
    leaky_old: {
      // Leaky or Very Old Home (Pre-1960)
      wallU: 0.15,        // R-7 walls or uninsulated (U-0.15)
      roofU: 0.10,        // R-10 roof or minimal (U-0.10)
      floorU: 0.12,       // R-8 floor or uninsulated (U-0.12)
      windowU: 0.80,      // Single-pane or storm windows (U-0.80)
      infiltrationACH: 0.9,  // Loose: ACH50 > 7 → 0.5-1.0+ ACH normal
      windowAreaRatio: 0.22,  // 22% of wall area is windows
    },
  };

  const config = homeTypeConfig[homeType] || homeTypeConfig.decent_90s;
  
  // Estimate surface areas based on square footage and shape
  // Typical home: 2-story, rectangular footprint
  // Surface area estimation (simplified Manual J approach)
  const volume = squareFeet * ceilingHeight;
  const footprintArea = squareFeet / 2; // Assume 2-story average
  
  // Estimate wall area (perimeter × height)
  // For rectangular home: perimeter ≈ 4 × sqrt(area) for square, adjust for shape
  const perimeter = 4 * Math.sqrt(footprintArea) * homeShape; // homeShape adjusts for non-square
  const wallArea = perimeter * ceilingHeight;
  
  // Window area (percentage of wall area)
  const windowArea = wallArea * config.windowAreaRatio;
  const netWallArea = wallArea - windowArea; // Wall area minus windows
  
  // Roof area (same as footprint for flat roof, adjust for pitch)
  const roofArea = footprintArea * 1.1; // 10% increase for typical roof pitch
  
  // Floor area (assume slab-on-grade or crawlspace)
  const floorArea = footprintArea;
  
  // Manual J heat loss calculation: Q = U × A × ΔT
  // We'll calculate per °F difference (ΔT = 1°F) to get BTU/hr/°F
  
  // Conduction losses (U × A)
  const wallLoss = config.wallU * netWallArea;
  const windowLoss = config.windowU * windowArea;
  const roofLoss = config.roofU * roofArea;
  const floorLoss = config.floorU * floorArea;
  const conductionLoss = wallLoss + windowLoss + roofLoss + floorLoss;
  
  // Infiltration loss (from RAG knowledge base)
  // Q_inf = 1.08 × CFM × ΔT × ACH × Volume / 60
  // Simplified: CFM ≈ Volume × ACH / 60
  // Q_inf = 1.08 × (Volume × ACH / 60) × ΔT
  // For ΔT = 1°F: Q_inf = 1.08 × Volume × ACH / 60
  const infiltrationLoss = 1.08 * volume * config.infiltrationACH / 60;
  
  // Total heat loss factor (BTU/hr/°F)
  const totalHeatLossFactor = conductionLoss + infiltrationLoss;
  
  return Math.round(totalHeatLossFactor * 10) / 10; // Round to 1 decimal
}

/**
 * Get heat loss factor using Manual J for DOE fallback
 * This replaces the simple 22.67 BTU/sqft formula with proper Manual J methodology
 */
export function getManualJHeatLossFactor(userSettings = {}) {
  const squareFeet = userSettings.squareFeet || 2000;
  const homeType = userSettings.homeType || 'decent_90s';
  const ceilingHeight = userSettings.ceilingHeight || 8;
  const homeShape = userSettings.homeShape || 1.0;
  
  return calculateManualJHeatLoss({
    squareFeet,
    homeType,
    ceilingHeight,
    homeShape,
  });
}



