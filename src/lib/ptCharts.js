// src/lib/ptCharts.js

// Refrigerant charts container. Each refrigerant can contain its own
// subcooling table (liquid pressure -> liquid line temps for targets)
// and a PT table for saturation lookups used by superheat calculations.
// NOTE: Only R-410A has real subcooling data here. Other refrigerants are
// seeded with the same table as a placeholder and should be replaced with
// authoritative PT/subcooling tables for production.
export const refrigerantCharts = {
  'R-410A': {
    subcoolingChart: {
      // Target Subcooling (°F) -> Column Index
      subcoolingTargets: { 6: 0, 8: 1, 10: 2, 12: 3, 14: 4, 16: 5 },
      // Pressure (psig) -> [Liquid Line Temps for each Target Subcooling]
      data: [
        { p: 251, temps: [78, 76, 74, 72, 70, 68] },
        { p: 259, temps: [80, 78, 76, 74, 72, 70] },
        { p: 266, temps: [82, 80, 78, 76, 74, 72] },
        { p: 274, temps: [84, 82, 80, 78, 76, 74] },
        { p: 283, temps: [86, 84, 82, 80, 78, 76] },
        { p: 291, temps: [88, 86, 84, 82, 80, 78] },
        { p: 299, temps: [90, 88, 86, 84, 82, 80] },
        { p: 308, temps: [92, 90, 88, 86, 84, 82] },
        { p: 317, temps: [94, 92, 90, 88, 86, 84] },
        { p: 326, temps: [96, 94, 92, 90, 88, 86] },
        { p: 335, temps: [98, 96, 94, 92, 90, 88] },
        { p: 345, temps: [100, 98, 96, 94, 92, 90] },
        { p: 364, temps: [104, 102, 100, 98, 96, 94] },
        { p: 374, temps: [106, 104, 102, 100, 98, 96] },
        { p: 384, temps: [108, 106, 104, 102, 100, 98] },
        { p: 395, temps: [110, 108, 106, 104, 102, 100] },
        { p: 406, temps: [112, 110, 108, 106, 104, 102] },
        { p: 416, temps: [114, 112, 110, 108, 106, 104] },
        { p: 427, temps: [116, 114, 112, 110, 108, 106] },
        { p: 439, temps: [118, 116, 114, 112, 110, 108] },
        { p: 450, temps: [120, 118, 116, 114, 112, 110] },
        { p: 462, temps: [122, 120, 118, 116, 114, 112] },
        { p: 474, temps: [124, 122, 120, 118, 116, 114] },
      ]
    },
    // PT table for R-410A (saturation pressure psig -> temperature °F) - ASHRAE Standard
    ptTable: [
      { p: 20, t: -20.2 }, { p: 30, t: -10.7 }, { p: 40, t: -3.5 }, { p: 50, t: 2.7 },
      { p: 60, t: 8.0 }, { p: 70, t: 12.8 }, { p: 80, t: 17.0 }, { p: 90, t: 21.0 },
      { p: 100, t: 31.8 }, { p: 110, t: 35.4 }, { p: 120, t: 38.8 }, { p: 130, t: 42.0 },
      { p: 140, t: 45.1 }, { p: 150, t: 48.1 }, { p: 160, t: 50.9 }, { p: 170, t: 53.7 },
      { p: 180, t: 56.4 }, { p: 190, t: 59.0 }, { p: 200, t: 61.5 }, { p: 210, t: 63.9 },
      { p: 220, t: 66.3 }, { p: 230, t: 68.6 }, { p: 240, t: 70.9 }, { p: 250, t: 73.1 },
      { p: 260, t: 75.2 }, { p: 270, t: 77.3 }, { p: 280, t: 79.3 }, { p: 290, t: 81.3 },
      { p: 300, t: 83.2 }, { p: 310, t: 85.1 }, { p: 320, t: 86.9 }, { p: 330, t: 88.7 },
      { p: 340, t: 90.5 }, { p: 350, t: 92.2 }, { p: 360, t: 93.9 }, { p: 370, t: 95.6 },
      { p: 380, t: 97.2 }, { p: 390, t: 98.8 }, { p: 400, t: 100.4 }, { p: 410, t: 101.9 },
      { p: 420, t: 103.5 }, { p: 430, t: 105.0 }, { p: 440, t: 106.5 }, { p: 450, t: 108.0 }
    ]
  },
  'R-22': {
    subcoolingChart: {
      subcoolingTargets: { 6: 0, 8: 1, 10: 2, 12: 3, 14: 4, 16: 5 },
      data: [
        { p: 150, temps: [68, 66, 64, 62, 60, 58] },
        { p: 160, temps: [72, 70, 68, 66, 64, 62] },
        { p: 170, temps: [76, 74, 72, 70, 68, 66] },
        { p: 180, temps: [80, 78, 76, 74, 72, 70] },
        { p: 190, temps: [84, 82, 80, 78, 76, 74] },
        { p: 200, temps: [88, 86, 84, 82, 80, 78] },
        { p: 210, temps: [92, 90, 88, 86, 84, 82] },
        { p: 220, temps: [96, 94, 92, 90, 88, 86] },
        { p: 230, temps: [100, 98, 96, 94, 92, 90] },
        { p: 240, temps: [104, 102, 100, 98, 96, 94] },
        { p: 250, temps: [108, 106, 104, 102, 100, 98] },
        { p: 260, temps: [112, 110, 108, 106, 104, 102] },
        { p: 270, temps: [116, 114, 112, 110, 108, 106] },
        { p: 280, temps: [120, 118, 116, 114, 112, 110] }
      ]
    },
    ptTable: [
      { p: 20, t: -10.2 }, { p: 30, t: 0.2 }, { p: 40, t: 8.5 }, { p: 50, t: 15.5 },
      { p: 60, t: 21.6 }, { p: 70, t: 27.1 }, { p: 80, t: 32.0 }, { p: 90, t: 36.6 },
      { p: 100, t: 39.8 }, { p: 110, t: 43.7 }, { p: 120, t: 47.4 }, { p: 130, t: 50.9 },
      { p: 140, t: 54.2 }, { p: 150, t: 57.3 }, { p: 160, t: 60.3 }, { p: 170, t: 63.2 },
      { p: 180, t: 66.0 }, { p: 190, t: 68.7 }, { p: 200, t: 71.3 }, { p: 210, t: 73.8 },
      { p: 220, t: 76.3 }, { p: 230, t: 78.7 }, { p: 240, t: 81.0 }, { p: 250, t: 83.3 },
      { p: 260, t: 85.5 }, { p: 270, t: 87.6 }, { p: 280, t: 89.7 }, { p: 290, t: 91.7 },
      { p: 300, t: 93.7 }, { p: 310, t: 95.6 }, { p: 320, t: 97.5 }
    ]
  },
  'R-134a': {
    subcoolingChart: {
      subcoolingTargets: { 6: 0, 8: 1, 10: 2, 12: 3, 14: 4, 16: 5 },
      data: [
        { p: 80, temps: [62, 60, 58, 56, 54, 52] },
        { p: 90, temps: [68, 66, 64, 62, 60, 58] },
        { p: 100, temps: [74, 72, 70, 68, 66, 64] },
        { p: 110, temps: [80, 78, 76, 74, 72, 70] },
        { p: 120, temps: [86, 84, 82, 80, 78, 76] },
        { p: 130, temps: [92, 90, 88, 86, 84, 82] },
        { p: 140, temps: [98, 96, 94, 92, 90, 88] },
        { p: 150, temps: [104, 102, 100, 98, 96, 94] }
      ]
    },
    ptTable: [
      { p: 10, t: -16.0 }, { p: 15, t: -7.4 }, { p: 20, t: 0.1 }, { p: 25, t: 6.7 },
      { p: 30, t: 12.6 }, { p: 35, t: 18.0 }, { p: 40, t: 23.0 }, { p: 45, t: 27.6 },
      { p: 50, t: 32.0 }, { p: 55, t: 36.1 }, { p: 60, t: 40.0 }, { p: 65, t: 43.7 },
      { p: 70, t: 47.3 }, { p: 75, t: 50.7 }, { p: 80, t: 54.0 }, { p: 85, t: 57.2 },
      { p: 90, t: 60.3 }, { p: 95, t: 63.3 }, { p: 100, t: 60.4 }, { p: 105, t: 69.1 },
      { p: 110, t: 72.0 }, { p: 115, t: 74.8 }, { p: 120, t: 77.6 }, { p: 125, t: 80.3 },
      { p: 130, t: 83.0 }, { p: 135, t: 85.6 }, { p: 140, t: 88.2 }, { p: 145, t: 90.7 },
      { p: 150, t: 93.2 }
    ]
  },
  'R-32': {
    subcoolingChart: {
      subcoolingTargets: { 6: 0, 8: 1, 10: 2, 12: 3, 14: 4, 16: 5 },
      data: [
        { p: 200, temps: [78, 76, 74, 72, 70, 68] },
        { p: 220, temps: [86, 84, 82, 80, 78, 76] },
        { p: 240, temps: [94, 92, 90, 88, 86, 84] },
        { p: 260, temps: [102, 100, 98, 96, 94, 92] }
      ]
    },
    ptTable: [
      { p: 30, t: -8.3 }, { p: 40, t: 1.9 }, { p: 50, t: 10.8 }, { p: 60, t: 18.6 },
      { p: 70, t: 25.5 }, { p: 80, t: 31.7 }, { p: 90, t: 37.4 }, { p: 100, t: 36.5 },
      { p: 110, t: 48.0 }, { p: 120, t: 52.9 }, { p: 130, t: 57.5 }, { p: 140, t: 61.9 },
      { p: 150, t: 66.1 }, { p: 160, t: 70.2 }, { p: 170, t: 74.1 }, { p: 180, t: 77.9 },
      { p: 190, t: 81.6 }, { p: 200, t: 85.2 }, { p: 220, t: 92.0 }, { p: 240, t: 98.4 },
      { p: 260, t: 104.4 }, { p: 280, t: 110.1 }, { p: 300, t: 115.5 }
    ]
  },
  'R-407C': {
    subcoolingChart: {
      subcoolingTargets: { 6: 0, 8: 1, 10: 2, 12: 3, 14: 4, 16: 5 },
      data: [
        { p: 200, temps: [78, 76, 74, 72, 70, 68] },
        { p: 220, temps: [86, 84, 82, 80, 78, 76] },
        { p: 240, temps: [94, 92, 90, 88, 86, 84] },
        { p: 260, temps: [102, 100, 98, 96, 94, 92] }
      ]
    },
    ptTable: [
      { p: 20, t: -7.0 }, { p: 30, t: 4.0 }, { p: 40, t: 13.0 }, { p: 50, t: 21.0 },
      { p: 60, t: 27.8 }, { p: 70, t: 33.9 }, { p: 80, t: 39.5 }, { p: 90, t: 44.7 },
      { p: 100, t: 41.0 }, { p: 110, t: 54.2 }, { p: 120, t: 58.6 }, { p: 130, t: 62.8 },
      { p: 140, t: 66.8 }, { p: 150, t: 70.7 }, { p: 160, t: 74.4 }, { p: 170, t: 78.0 },
      { p: 180, t: 81.5 }, { p: 190, t: 84.9 }, { p: 200, t: 88.2 }, { p: 220, t: 94.6 },
      { p: 240, t: 100.7 }, { p: 260, t: 106.5 }, { p: 280, t: 112.0 }, { p: 300, t: 117.3 }
    ]
  }
};

// Utility: interpolate value in a table of {p, ...} by pressure and column
export const interpolateFromTable = (table, pressure, colIndex) => {
  if (!table || table.length === 0) return null;
  let lower = table[0];
  let upper = table[table.length - 1];
  for (let i = 0; i < table.length; i++) {
    if (table[i].p <= pressure) lower = table[i];
    if (table[i].p >= pressure) { upper = table[i]; break; }
  }
  if (lower.p === upper.p) {
    return colIndex != null ? lower.temps[colIndex] : lower.t;
  }
  const pRange = upper.p - lower.p;
  const pDiff = pressure - lower.p;
  if (colIndex != null) {
    const tRange = upper.temps[colIndex] - lower.temps[colIndex];
    return lower.temps[colIndex] + (pDiff / pRange) * tRange;
  }
  // For PT table entries that use 't' instead of temps array
  return lower.t + (pDiff / pRange) * (upper.t - lower.t);
};

// Get target liquid line temp for subcooling using selected refrigerant chart
export const getTargetLiquidLineTemp = (refrigerant, pressure, targetSubcooling) => {
  const chart = refrigerantCharts[refrigerant]?.subcoolingChart;
  if (!chart) return null;
  const colIndex = chart.subcoolingTargets[targetSubcooling];
  if (colIndex === undefined) return null;
  return interpolateFromTable(chart.data, pressure, colIndex);
};

// Get saturation pressure (°F -> psig) from a refrigerant PT table (reverse lookup)
export const getSaturationPressure = (refrigerant, temperature) => {
  const ptTable = refrigerantCharts[refrigerant]?.ptTable;
  if (!ptTable || ptTable.length === 0) return null;

  // Find the two closest temperature rows for interpolation
  let lower = ptTable[0];
  let upper = ptTable[ptTable.length - 1];

  // Handle case where temperature is outside the table range
  if (temperature <= lower.t) return lower.p;
  if (temperature >= upper.t) return upper.p;

  for (let i = 0; i < ptTable.length; i++) {
    if (ptTable[i].t <= temperature) {
      lower = ptTable[i];
    }
    if (ptTable[i].t >= temperature) {
      upper = ptTable[i];
      break;
    }
  }

  // If temperature is exact, return the pressure
  if (lower.t === upper.t) {
    return lower.p;
  }

  // Linear interpolation for pressure
  const tempRange = upper.t - lower.t;
  const pressureRange = upper.p - lower.p;
  const tempDiff = temperature - lower.t;

  const interpolatedPressure = lower.p + (tempDiff / tempRange) * pressureRange;
  return interpolatedPressure;
};

// Get saturation temperature (°F) from a refrigerant PT table (psig -> °F)
export const getSaturationTemp = (refrigerant, pressure) => {
  const pt = refrigerantCharts[refrigerant]?.ptTable;
  if (!pt || pt.length === 0) return null;
  return interpolateFromTable(pt, pressure, null);
};