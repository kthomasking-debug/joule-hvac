// src/lib/bills/billParser.js
// Parse utility bills and calibrate model predictions

export function parseBillText(text) {
  if (!text) return null;

  // Simple pattern matching for common bill formats
  const patterns = {
    totalCost: /(?:total|amount due|balance)[:\s]+\$?(\d+\.?\d*)/i,
    kwh: /(\d+\.?\d*)\s*kWh/i,
    therms: /(\d+\.?\d*)\s*therms?/i,
    billingPeriod:
      /(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/,
  };

  const result = {
    totalCost: null,
    kwh: null,
    therms: null,
    startDate: null,
    endDate: null,
  };

  const costMatch = text.match(patterns.totalCost);
  if (costMatch) {
    result.totalCost = parseFloat(costMatch[1]);
  }

  const kwhMatch = text.match(patterns.kwh);
  if (kwhMatch) {
    result.kwh = parseFloat(kwhMatch[1]);
  }

  const thermsMatch = text.match(patterns.therms);
  if (thermsMatch) {
    result.therms = parseFloat(thermsMatch[1]);
  }

  const periodMatch = text.match(patterns.billingPeriod);
  if (periodMatch) {
    result.startDate = periodMatch[1];
    result.endDate = periodMatch[2];
  }

  return result;
}

export function calibrateModel(actual, predicted) {
  if (!actual || !predicted || predicted === 0)
    return { variance: 0, calibrationFactor: 1 };

  const variance = ((actual - predicted) / predicted) * 100;
  const calibrationFactor = actual / predicted;

  return {
    variance: Math.round(variance * 10) / 10,
    calibrationFactor: Math.round(calibrationFactor * 100) / 100,
    suggestion:
      variance > 10
        ? "Model is under-predicting. Consider adjusting inputs."
        : variance < -10
        ? "Model is over-predicting. Check for recent efficiency improvements."
        : "Model accuracy is good.",
  };
}

const BILLS_STORAGE_KEY = "uploadedBills";

export function saveBill(bill) {
  try {
    const bills = JSON.parse(localStorage.getItem(BILLS_STORAGE_KEY) || "[]");
    bills.push({
      ...bill,
      id: Date.now(),
      uploadedAt: new Date().toISOString(),
    });
    localStorage.setItem(BILLS_STORAGE_KEY, JSON.stringify(bills.slice(-24))); // keep last 24
    return bills;
  } catch {
    return [];
  }
}

export function loadBills() {
  try {
    return JSON.parse(localStorage.getItem(BILLS_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}
