// src/lib/bills/billParser.js
// Parse utility bills and calibrate model predictions

export function parseBillText(text) {
  if (!text) return null;

  const result = {
    totalCost: null,
    kwh: null,
    therms: null,
    startDate: null,
    endDate: null,
  };

  // Strategy 1: Try strict patterns first (for common, well-formatted bills)
  const strictPatterns = {
    // Handle both comma-separated and plain numbers
    totalCost: /(?:total|amount due|balance|amount|due)[:\s]+\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+\.?\d*)/i,
    kwh: /(\d+\.?\d*)\s*kWh/i,
    therms: /(\d+\.?\d*)\s*therms?/i,
    billingPeriod:
      /(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/,
  };

  let costMatch = text.match(strictPatterns.totalCost);
  if (costMatch) {
    // Remove commas before parsing
    result.totalCost = parseFloat(costMatch[1].replace(/,/g, ''));
  }

  // Strategy 2: If strict pattern failed, do flexible "total" search
  if (!result.totalCost) {
    // Find all instances of "total" (case-insensitive) and look for numbers nearby
    const totalRegex = /\b(total|amount|due|balance)\b/gi;
    const matches = [...text.matchAll(totalRegex)];
    
    for (const match of matches) {
      const matchIndex = match.index;
      const beforeText = text.substring(Math.max(0, matchIndex - 50), matchIndex);
      const afterText = text.substring(matchIndex, Math.min(text.length, matchIndex + 50));
      
      // Look for dollar amounts in the surrounding text
      // Try multiple patterns, prioritizing more specific ones
      const patterns = [
        // Pattern 1: Numbers with commas and decimals ($1,234.56)
        /\$?\s*(\d{1,3}(?:,\d{3})+\.\d{2})/g,
        // Pattern 2: Numbers with commas but no decimals ($1,234)
        /\$?\s*(\d{1,3}(?:,\d{3})+)/g,
        // Pattern 3: Numbers with decimals ($123.45)
        /\$?\s*(\d+\.\d{2})/g,
        // Pattern 4: Plain numbers ($123 or 123)
        /\$?\s*(\d{3,})/g,
      ];
      
      // Check text after "total"
      for (const pattern of patterns) {
        const matches = [...afterText.matchAll(pattern)];
        if (matches.length > 0) {
          const matchStr = matches[0][0];
          const amount = parseFloat(matchStr.replace(/[$,]/g, ''));
          if (amount > 0 && amount < 100000) {
            result.totalCost = amount;
            break;
          }
        }
      }
      
      // Check text before "total" (for formats like "$123.45 Total")
      if (!result.totalCost) {
        for (const pattern of patterns) {
          const matches = [...beforeText.matchAll(pattern)];
          if (matches.length > 0) {
            // Take the last match (closest to "total")
            const matchStr = matches[matches.length - 1][0];
            const amount = parseFloat(matchStr.replace(/[$,]/g, ''));
            if (amount > 0 && amount < 100000) {
              result.totalCost = amount;
              break;
            }
          }
        }
      }
      
      if (result.totalCost) break;
    }
  }

  // Strategy 3: Last resort - find the largest dollar amount in the text
  // (often the total is the biggest number)
  if (!result.totalCost) {
    const allDollarAmounts = [...text.matchAll(/\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+\.\d{2}|\d{4,}(?:\.\d{2})?)/g)];
    const amounts = allDollarAmounts
      .map(m => parseFloat(m[0].replace(/[$,]/g, '')))
      .filter(amt => amt > 10 && amt < 10000); // Reasonable range for monthly bills
    
    if (amounts.length > 0) {
      // Take the largest amount (likely the total)
      result.totalCost = Math.max(...amounts);
    }
  }

  // Parse kWh
  const kwhMatch = text.match(strictPatterns.kwh);
  if (kwhMatch) {
    result.kwh = parseFloat(kwhMatch[1]);
  }

  // Parse therms
  const thermsMatch = text.match(strictPatterns.therms);
  if (thermsMatch) {
    result.therms = parseFloat(thermsMatch[1]);
  }

  // Parse billing period
  const periodMatch = text.match(strictPatterns.billingPeriod);
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
