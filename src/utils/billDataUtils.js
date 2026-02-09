/**
 * Bill data utilities for actual kWh entries stored per month in localStorage.
 * Keys: actualKwh_${year}_${month}, value: { [dayKey]: number, ... }
 */

export const MIN_BILL_DAYS_FOR_LEARNED = 30;

/**
 * Total number of days with actual bill data (kWh > 0) across all months.
 * Used to gate "From Bill Data (Auto-learned)" heat loss until enough data exists.
 * @returns {number}
 */
export function getTotalBillDaysEntered() {
  if (typeof localStorage === "undefined") return 0;
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith("actualKwh_")) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        const count = Object.values(data).filter(
          (v) => typeof v === "number" && v > 0
        ).length;
        total += count;
      }
    } catch {
      // ignore malformed entries
    }
  }
  return total;
}

/**
 * Whether learned heat loss from bill data should be used (≥ MIN_BILL_DAYS_FOR_LEARNED).
 * @returns {boolean}
 */
export function shouldUseLearnedHeatLoss() {
  return getTotalBillDaysEntered() >= MIN_BILL_DAYS_FOR_LEARNED;
}
