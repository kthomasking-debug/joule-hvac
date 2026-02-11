/**
 * Shared bill extraction for onboarding and MonthlyBudgetPlanner.
 * Extracts daily kWh from bill text using AI and stores to the correct month(s).
 */

import { isAIAvailable, callLLM } from "./aiProvider";

/**
 * Extract daily kWh from bill text. Returns a promise that resolves to
 * { entriesByMonth: { "2026-1": {"27": 57, "28": 37}, "2026-2": {"1": 50, "2": 48} }, ... }
 * Keys are "year-month" for the month, and "day" within each month.
 * Also supports legacy format: single-month {"1": 50, "2": 48} for the given targetMonth.
 */
export async function extractBillToStorage(billText, year, targetMonth) {
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
If the bill has only one month, use that month's number. Return ONLY valid JSON, no explanation.`,
      },
      {
        role: "user",
        content: `Extract daily kWh from this utility bill. Use month-day keys (e.g. "1-27", "2-1") so each date goes to the correct month:\n\n${billText.trim()}`,
      },
    ],
    temperature: 0.1,
    maxTokens: 2000,
  });

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Could not parse AI response. Try reformatting your bill data.");
  const parsed = JSON.parse(jsonMatch[0]);

  // Group by month: {"1-27": 57, "2-1": 50} -> {"1": {"27": 57}, "2": {"1": 50}}
  const byMonth = {};
  for (const [key, kwh] of Object.entries(parsed)) {
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
