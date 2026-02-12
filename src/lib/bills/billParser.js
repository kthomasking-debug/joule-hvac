// src/lib/bills/billParser.js
// Parse utility bills and calibrate model predictions

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december"
];

const MONTH_ABBR = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec"
];

/**
 * Parse bill month from text. Returns { month: 1-12, year: number } or null.
 * Default to last month when in doubt. Used to align bill vs weather for comparison.
 */
export function parseBillMonthFromText(text) {
  if (!text || typeof text !== "string") return null;
  const t = text.toLowerCase().trim();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Try explicit date ranges: "1/3/2025 - 2/1/2025", "Jan 3 – Feb 1", "Start date: 1/27/2026 End date: 2/10/2026"
  const rangePatterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*[-–]\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i,
    /(?:start\s*date|from)[:\s]*\d{1,2}\/\d{1,2}\/\d{2,4}[^\d]*end\s*date[:\s]*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i,
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{1,2}\s*[-–]\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{1,2}\s*(?:(\d{4}))?/i,
  ];
  for (const re of rangePatterns) {
    const m = t.match(re);
    if (!m) continue;
    // "Start date: X End date: Y" (3 groups: end month, day, year) — only when m[1] is numeric
    if (m[1] && m[2] && m[3] && !Number.isNaN(parseInt(m[1], 10)) && parseInt(m[1], 10) >= 1 && parseInt(m[1], 10) <= 12) {
      const month = parseInt(m[1], 10);
      const year = parseInt(m[3], 10) < 100 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
      return { month, year };
    }
    // Numeric format: 1/3/2025 - 2/1/2025 (6 groups)
    if (m[4] !== undefined && !Number.isNaN(parseInt(m[1], 10))) {
      const m2 = parseInt(m[4], 10);
      const y2 = m[6] ? (parseInt(m[6], 10) < 100 ? 2000 + parseInt(m[6], 10) : parseInt(m[6], 10)) : currentYear;
      return { month: m2, year: y2 };
    }
    // Month names: Jan 3 – Feb 1
    if (m[1] && m[2]) {
      const endIdx = MONTH_ABBR.findIndex((mo) => m[2].toLowerCase().startsWith(mo.slice(0, 3)));
      if (endIdx >= 0) return { month: endIdx + 1, year: m[3] ? parseInt(m[3], 10) : currentYear };
    }
  }

  // Try "billing period", "service period", "for period", "statement date"
  const periodPatterns = [
    /(?:billing|service|for)\s*(?:period|dates?)?\s*:?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?/i,
    /(?:statement|bill)\s*date\s*:?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(?:(\d{1,2}),?\s*)?(\d{4})?/i,
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{4})/i,
  ];
  for (const re of periodPatterns) {
    const m = t.match(re);
    if (m) {
      const monthIdx = MONTH_ABBR.findIndex((mo) => m[1].toLowerCase().startsWith(mo));
      if (monthIdx >= 0) {
        let year = m[3] ? parseInt(m[3], 10) : (m[2] && m[2].length === 4 ? parseInt(m[2], 10) : currentYear);
        if (year === currentYear && monthIdx + 1 > currentMonth) year = currentYear - 1; // Cross-year: Dec in Jan → last year
        return { month: monthIdx + 1, year };
      }
    }
  }

  // Try standalone month mention: "January bill", "February 2025"
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    if (t.includes(MONTH_NAMES[i]) || t.includes(MONTH_ABBR[i])) {
      const yearMatch = t.match(/(\d{4})/);
      let year = yearMatch ? parseInt(yearMatch[1], 10) : currentYear;
      // Cross-year: "December" in Jan 2026 → Dec 2025, not Dec 2026
      if (!yearMatch && i + 1 > currentMonth) year = currentYear - 1;
      return { month: i + 1, year };
    }
  }

  return null;
}

const MONTH_DISPLAY = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Derive bill period display from byMonth (extractBillToStorage format).
 * byMonth: { "1": {"27": 57, "28": 37}, "2": {"1": 50} }
 * Returns "Jan 27 – Feb 10" or null when no entries.
 */
export function derivePeriodFromByMonth(byMonth, year) {
  if (!byMonth || typeof byMonth !== "object" || !year) return null;
  const entries = {};
  for (const [month, days] of Object.entries(byMonth)) {
    if (typeof days !== "object") continue;
    for (const [day, kwh] of Object.entries(days)) {
      if (typeof kwh === "number" && kwh > 0) {
        entries[`${month}-${day}`] = kwh;
      }
    }
  }
  return derivePeriodFromActualKeys(entries, year);
}

/**
 * Derive bill period display from actualKwhEntries keys (format "month-day").
 * Returns "Jan 27 – Feb 10" or null when no entries.
 */
export function derivePeriodFromActualKeys(actualKwhEntries, year) {
  if (!actualKwhEntries || typeof actualKwhEntries !== "object" || !year) return null;
  const keysWithValues = Object.entries(actualKwhEntries)
    .filter(([, v]) => typeof v === "number" && v > 0)
    .map(([k]) => k);
  if (keysWithValues.length === 0) return null;
  const parsed = keysWithValues
    .map((k) => {
      const parts = k.split("-");
      if (parts.length !== 2) return null;
      const m = parseInt(parts[0], 10);
      const d = parseInt(parts[1], 10);
      if (m < 1 || m > 12 || d < 1 || d > 31) return null;
      return { m, d, sort: m * 100 + d };
    })
    .filter(Boolean);
  if (parsed.length === 0) return null;
  const min = parsed.reduce((a, b) => (a.sort <= b.sort ? a : b));
  const max = parsed.reduce((a, b) => (a.sort >= b.sort ? a : b));
  const startStr = min.m !== max.m ? `${MONTH_DISPLAY[min.m - 1]} ${min.d}` : `${MONTH_DISPLAY[min.m - 1]} ${min.d}`;
  const endStr = min.m !== max.m ? `${MONTH_DISPLAY[max.m - 1]} ${max.d}` : `${MONTH_DISPLAY[max.m - 1]} ${max.d}`;
  return startStr === endStr ? startStr : `${startStr} – ${endStr}`;
}

/**
 * Derive bill period bounds (start/end Date) from actualKwhEntries keys.
 * Returns { startDate, endDate } or null when no entries.
 */
export function derivePeriodBounds(actualKwhEntries, year) {
  if (!actualKwhEntries || typeof actualKwhEntries !== "object" || !year) return null;
  const keysWithValues = Object.entries(actualKwhEntries)
    .filter(([, v]) => typeof v === "number" && v > 0)
    .map(([k]) => k);
  if (keysWithValues.length === 0) return null;
  const parsed = keysWithValues
    .map((k) => {
      const parts = k.split("-");
      if (parts.length !== 2) return null;
      const m = parseInt(parts[0], 10);
      const d = parseInt(parts[1], 10);
      if (m < 1 || m > 12 || d < 1 || d > 31) return null;
      return { m, d, sort: m * 100 + d };
    })
    .filter(Boolean);
  if (parsed.length === 0) return null;
  const min = parsed.reduce((a, b) => (a.sort <= b.sort ? a : b));
  const max = parsed.reduce((a, b) => (a.sort >= b.sort ? a : b));
  const startDate = new Date(year, min.m - 1, min.d);
  const endDate = new Date(year, max.m - 1, max.d);
  return { startDate, endDate };
}

/**
 * Parse bill date range display string (e.g. "Jan 27 – Feb 10") to { startDate, endDate }.
 * Uses year for both dates when not specified in string.
 */
export function parseBillDateRangeToBounds(rangeStr, year) {
  if (!rangeStr || typeof rangeStr !== "string" || !year) return null;
  const t = rangeStr.trim().replace(/\s*,\s*\d{4}\s*$/, ""); // Strip optional ", 2026" suffix
  const match = t.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s*[-–]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/i);
  if (!match) return null;
  const startIdx = MONTH_ABBR.findIndex((mo) => match[1].toLowerCase().startsWith(mo));
  const endIdx = MONTH_ABBR.findIndex((mo) => match[3].toLowerCase().startsWith(mo));
  if (startIdx < 0 || endIdx < 0) return null;
  const startDate = new Date(year, startIdx, parseInt(match[2], 10));
  const endDate = new Date(year, endIdx, parseInt(match[4], 10));
  return { startDate, endDate };
}

/**
 * Parse billing date range from bill text. Returns display string like "Jan 3 – Feb 1" or null.
 * Used to show "Comparing your bill (Jan 3 – Feb 1) to weather during that period."
 */
export function parseBillDateRange(text) {
  if (!text || typeof text !== "string") return null;
  const t = text.trim();
  const now = new Date();
  const currentYear = now.getFullYear();

  // Numeric: 1/3/2025 - 2/1/2025 or "Start date: 1/27/2026 End date: 2/10/2026"
  const numericRe = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*[-–]\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i;
  let numMatch = t.match(numericRe);
  if (!numMatch) {
    const startEndRe = /(?:start\s*date|from)[:\s]*(\d{1,2})\/(\d{1,2})\/(\d{2,4})[^\d]*end\s*date[:\s]*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i;
    numMatch = t.match(startEndRe);
    if (numMatch) {
      const parseY = (y) => (parseInt(y, 10) < 100 ? 2000 + parseInt(y, 10) : parseInt(y, 10));
      const m1 = parseInt(numMatch[1], 10);
      const d1 = parseInt(numMatch[2], 10);
      const y1 = parseY(numMatch[3]);
      const m2 = parseInt(numMatch[4], 10);
      const d2 = parseInt(numMatch[5], 10);
      const y2 = parseY(numMatch[6]);
      const startStr = y1 !== y2 ? `${MONTH_DISPLAY[m1 - 1]} ${d1}, ${y1}` : `${MONTH_DISPLAY[m1 - 1]} ${d1}`;
      const endStr = y1 !== y2 ? `${MONTH_DISPLAY[m2 - 1]} ${d2}, ${y2}` : `${MONTH_DISPLAY[m2 - 1]} ${d2}`;
      return `${startStr} – ${endStr}`;
    }
  }
  if (numMatch) {
    const parseY = (y) => (parseInt(y, 10) < 100 ? 2000 + parseInt(y, 10) : parseInt(y, 10));
    const m1 = parseInt(numMatch[1], 10);
    const d1 = parseInt(numMatch[2], 10);
    const y1 = parseY(numMatch[3]);
    const m2 = parseInt(numMatch[4], 10);
    const d2 = parseInt(numMatch[5], 10);
    const y2 = parseY(numMatch[6]);
    const startStr = y1 !== y2 ? `${MONTH_DISPLAY[m1 - 1]} ${d1}, ${y1}` : `${MONTH_DISPLAY[m1 - 1]} ${d1}`;
    const endStr = y1 !== y2 ? `${MONTH_DISPLAY[m2 - 1]} ${d2}, ${y2}` : `${MONTH_DISPLAY[m2 - 1]} ${d2}`;
    return `${startStr} – ${endStr}`;
  }

  // Month names: Jan 3 – Feb 1 or Jan 3 – Feb 1, 2025
  const nameRe = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{1,2})\s*[-–]\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{1,2})\s*(?:,?\s*(\d{4}))?/i;
  const nameMatch = t.match(nameRe);
  if (nameMatch) {
    const startIdx = MONTH_ABBR.findIndex((mo) => nameMatch[1].toLowerCase().startsWith(mo));
    const endIdx = MONTH_ABBR.findIndex((mo) => nameMatch[3].toLowerCase().startsWith(mo));
    if (startIdx >= 0 && endIdx >= 0) {
      const yearSuffix = nameMatch[5] ? `, ${nameMatch[5]}` : "";
      return `${MONTH_DISPLAY[startIdx]} ${nameMatch[2]} – ${MONTH_DISPLAY[endIdx]} ${nameMatch[4]}${yearSuffix}`;
    }
  }

  return null;
}

/** Get month to use for bill comparison. Default: last month (80% of users). */
export function getBillMonthForComparison(text) {
  const parsed = parseBillMonthFromText(text);
  if (parsed) return parsed;
  const now = new Date();
  const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  return { month: lastMonth, year: lastYear };
}

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
