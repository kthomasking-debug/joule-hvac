/**
 * Shared bill extraction for onboarding and MonthlyBudgetPlanner.
 * Extracts daily kWh from bill text using AI and stores to the correct month(s).
 */

import { isAIAvailable, callLLM } from "./aiProvider";
import { parseBillText } from "./bills/billParser";

/**
 * Parse bills with only total kWh (no daily breakdown). Prorates evenly across the period.
 * Handles "COMPARE YOUR USAGE Current 664" and date pairs like 01/07/2026, 02/03/2026.
 * Returns byMonth or null.
 */
function parseBillTotalsOnly(text) {
  if (!text?.trim()) return null;
  const parsed = parseBillText(text);
  let kwh = parsed?.kwh;
  let startDate = null;
  let endDate = null;

  if (!kwh || kwh < 10) {
    const currentMatch = text.match(/(?:current|usage|usage\s*\(kwh\))\s*(\d{2,})/i);
    if (currentMatch) kwh = parseFloat(currentMatch[1]);
    const compareMatch = text.match(/compare\s+your\s+usage[\s\S]{0,120}?current\s*(\d{2,})/i);
    if (compareMatch && !kwh) kwh = parseFloat(compareMatch[1]);
    const compareFirstNum = text.match(/compare\s+your\s+usage[\s\S]{0,200}?(\d{3,})\s+\d{2,}\s+\d{2,}/i);
    if (compareFirstNum && !kwh) kwh = parseFloat(compareFirstNum[1]);
  }
  if (!kwh || kwh < 10) return null;

  const dateRe = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g;
  const dates = [];
  let m;
  while ((m = dateRe.exec(text)) !== null) {
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    const y = parseInt(m[3], 10);
    const year = y < 100 ? 2000 + y : y;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      dates.push(new Date(year, month - 1, day));
    }
  }
  if (dates.length < 2) {
    if (parsed?.startDate && parsed?.endDate) {
      const [m1, d1, y1] = parsed.startDate.split("/").map(Number);
      const [m2, d2, y2] = parsed.endDate.split("/").map(Number);
      startDate = new Date(y1 < 100 ? 2000 + y1 : y1, m1 - 1, d1);
      endDate = new Date(y2 < 100 ? 2000 + y2 : y2, m2 - 1, d2);
    } else return null;
  } else {
    dates.sort((a, b) => a.getTime() - b.getTime());
    startDate = dates[0];
    endDate = dates[dates.length - 1];
  }
  if (!startDate || !endDate || endDate < startDate) return null;

  const days = Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (days < 1 || days > 62) return null;
  const perDay = Math.round((kwh / days) * 10) / 10;

  const byMonth = {};
  const d = new Date(startDate);
  for (let i = 0; i < days; i++) {
    const m = d.getMonth() + 1;
    const day = d.getDate();
    if (!byMonth[m]) byMonth[m] = {};
    byMonth[m][String(day)] = perDay;
    d.setDate(d.getDate() + 1);
  }
  return byMonth;
}

/**
 * Deterministic parser for table format: rows with Date (m/d/yyyy) and Usage (kWh).
 * Handles tab/space-separated:
 *   Date	Meter Reading	Usage (kWh)	Max Demand	...
 *   2/12/2026	12279	 	2.9208	10:00 PM
 *   1/29/2026	11883	29	6.774	6:45 PM
 * Usage column is typically 3rd (index 2). Also tries finding first 1-500 number after date.
 */
function parseStructuredBillTable(text) {
  if (!text?.trim()) return null;
  const byMonth = {};
  const lines = text.trim().split(/\r?\n/);
  const dateRe = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/;
  for (const line of lines) {
    if (line.includes(":") && /\d{1,2}:\d{2}\s*(?:AM|PM)?/i.test(line)) continue;
    const dateMatch = line.match(dateRe);
    if (!dateMatch) continue;
    const m = parseInt(dateMatch[1], 10);
    const d = parseInt(dateMatch[2], 10);
    if (m < 1 || m > 12 || d < 1 || d > 31) continue;
    const rest = line.slice(dateMatch[0].length);
    const tabCols = rest.split(/\t/).map((c) => c.trim());
    const spaceTokens = rest.split(/[\s\t]+/).filter(Boolean);
    let usage = null;
    if (tabCols.length >= 3 && tabCols[2] && !tabCols[2].includes(":")) {
      const n = parseFloat(tabCols[2]);
      if (!Number.isNaN(n) && n >= 1 && n <= 500) {
        usage = Number.isInteger(n) ? n : Math.round(n * 10) / 10;
      }
    }
    if (usage == null) {
      for (const t of spaceTokens) {
        const n = parseFloat(t);
        if (!Number.isNaN(n) && n >= 5 && n <= 500 && n < 1000 && !t.includes(":") && (Number.isInteger(n) || n >= 10)) {
          usage = Number.isInteger(n) ? n : Math.round(n * 10) / 10;
          break;
        }
      }
    }
    if (usage == null) continue;
    if (!byMonth[m]) byMonth[m] = {};
    byMonth[m][String(d)] = usage;
  }
  const totalDays = Object.values(byMonth).reduce((s, days) => s + Object.keys(days).length, 0);
  return totalDays >= 1 ? byMonth : null;
}

/**
 * Extract daily kWh from bill text. Returns a promise that resolves to
 * { entriesByMonth: { "2026-1": {"27": 57, "28": 37}, "2026-2": {"1": 50, "2": 48} }, ... }
 * Keys are "year-month" for the month, and "day" within each month.
 * Also supports legacy format: single-month {"1": 50, "2": 48} for the given targetMonth.
 */
export async function extractBillToStorage(billText, year, targetMonth) {
  const parsed = parseStructuredBillTable(billText);
  if (parsed && Object.keys(parsed).length > 0) {
    const totalDays = Object.values(parsed).reduce((s, days) => s + Object.keys(days).length, 0);
    if (totalDays >= 3) {
      for (const [month, days] of Object.entries(parsed)) {
        const storageKey = `actualKwh_${year}_${month}`;
        const existing = JSON.parse(localStorage.getItem(storageKey) || "{}");
        const updated = { ...existing };
        for (const [day, kwh] of Object.entries(days)) {
          updated[`${month}-${day}`] = kwh;
        }
        localStorage.setItem(storageKey, JSON.stringify(updated));
      }
      return parsed;
    }
  }

  const totalsParsed = parseBillTotalsOnly(billText);
  if (totalsParsed && Object.keys(totalsParsed).length > 0) {
    const totalDays = Object.values(totalsParsed).reduce((s, days) => s + Object.keys(days).length, 0);
    if (totalDays >= 3) {
      for (const [month, days] of Object.entries(totalsParsed)) {
        const storageKey = `actualKwh_${year}_${month}`;
        const existing = JSON.parse(localStorage.getItem(storageKey) || "{}");
        const updated = { ...existing };
        for (const [day, kwh] of Object.entries(days)) {
          updated[`${month}-${day}`] = kwh;
        }
        localStorage.setItem(storageKey, JSON.stringify(updated));
      }
      return totalsParsed;
    }
  }

  if (!isAIAvailable()) {
    throw new Error("AI not configured. Add a Groq API key or enable Local AI in Settings.");
  }
  if (!billText?.trim()) {
    throw new Error("No bill text to extract.");
  }

  const targetMonthName = new Date(year, targetMonth - 1).toLocaleString("en-US", { month: "long" });

  const content = await callLLM({
    messages: [
      {
        role: "system",
        content: `You extract daily electricity usage from utility bills. Return ONLY valid JSON.

CRITICAL - DATE FORMAT: Bills often span two months (e.g. Jan 27 - Feb 10). You MUST use "month-day" keys for each date so we store data in the correct month.

Examples:
- Single month (all Feb): {"2-1": 50, "2-2": 48, "2-3": 27, ...}
- Two months (Jan 27 - Feb 10): {"1-27": 57, "1-28": 37, "1-29": 29, "1-30": 30, "1-31": 42, "2-1": 50, "2-2": 48, ...}

Use "month-day" format (e.g. "1-27" for Jan 27, "2-1" for Feb 1). NEVER put January dates in February or vice versa.
If the bill has only one month, use that month's number.

BILLS WITH NO DAILY BREAKDOWN: If the bill only shows total kWh (e.g. "Current 664" or "664 kWh") and service period dates (e.g. 01/07/2026 - 02/03/2026), PRORATE the total evenly across each day in the period. Example: 664 kWh over 28 days = ~23.7 per day: {"1-7": 23.7, "1-8": 23.7, ... "2-3": 23.7}.

Return ONLY valid JSON, no explanation.`,
      },
      {
        role: "user",
        content: `Extract daily kWh from this utility bill. Use month-day keys (e.g. "1-27", "2-1"). If the bill has no daily breakdown, prorate the total kWh evenly across the service period:\n\n${billText.trim()}`,
      },
    ],
    temperature: 0.1,
    maxTokens: 2000,
  });

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Could not parse AI response. Try reformatting your bill data.");
  const aiParsed = JSON.parse(jsonMatch[0]);

  // Group by month: {"1-27": 57, "2-1": 50} -> {"1": {"27": 57}, "2": {"1": 50}}
  const byMonth = {};
  for (const [key, kwh] of Object.entries(aiParsed)) {
    if (typeof kwh !== "number" || kwh < 0) continue;
    const val = Math.round(kwh * 10) / 10;
    const parts = key.split("-");
    if (parts.length === 2) {
      // "month-day" format
      const [m, d] = parts.map((x) => parseInt(x, 10));
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        if (!byMonth[m]) byMonth[m] = {};
        byMonth[m][String(d)] = val;
      }
    } else if (parts.length === 1) {
      // Legacy: just day number - assume target month
      const d = parseInt(key, 10);
      if (d >= 1 && d <= 31) {
        if (!byMonth[targetMonth]) byMonth[targetMonth] = {};
        byMonth[targetMonth][String(d)] = val;
      }
    }
  }

  // Store each month's data to its localStorage key
  for (const [month, days] of Object.entries(byMonth)) {
    const storageKey = `actualKwh_${year}_${month}`;
    const existing = JSON.parse(localStorage.getItem(storageKey) || "{}");
    const updated = { ...existing };
    for (const [day, kwh] of Object.entries(days)) {
      updated[`${month}-${day}`] = kwh;
    }
    localStorage.setItem(storageKey, JSON.stringify(updated));
  }

  return byMonth;
}

/** Call before extraction to signal we're extracting from onboarding (avoids double-run on monthly page) */
export function setOnboardingExtractionFlag() {
  sessionStorage.setItem("onboardingExtractionFromContinue", "1");
}

/** Call when extraction completes - clears flag so monthly page can run if needed */
export function clearOnboardingExtractionFlag() {
  sessionStorage.removeItem("onboardingExtractionFromContinue");
}

export function isOnboardingExtractionFromContinue() {
  return !!sessionStorage.getItem("onboardingExtractionFromContinue");
}
