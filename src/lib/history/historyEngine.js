// src/lib/history/historyEngine.js
// Track historical energy usage and compare actuals vs predictions

const HISTORY_KEY = "energyHistory";

export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Ignore localStorage errors
  }
}

export function recordMonth(year, month, data) {
  const history = loadHistory();
  const key = `${year}-${String(month).padStart(2, "0")}`;
  const existing = history.find((h) => h.key === key);

  if (existing) {
    Object.assign(existing, { ...data, updatedAt: new Date().toISOString() });
  } else {
    history.push({
      key,
      year,
      month,
      ...data,
      createdAt: new Date().toISOString(),
    });
  }

  // Keep last 24 months
  const sorted = history
    .sort((a, b) => b.key.localeCompare(a.key))
    .slice(0, 24);
  saveHistory(sorted);
  return sorted;
}

export function getMonthData(year, month) {
  const history = loadHistory();
  const key = `${year}-${String(month).padStart(2, "0")}`;
  return history.find((h) => h.key === key);
}

export function getComparison(currentYear, currentMonth) {
  const current = getMonthData(currentYear, currentMonth);
  const lastYear = getMonthData(currentYear - 1, currentMonth);

  if (!current || !lastYear) return null;

  const actualDelta =
    current.actualCost !== undefined && lastYear.actualCost !== undefined
      ? current.actualCost - lastYear.actualCost
      : null;

  const predictedDelta =
    current.predictedCost !== undefined && lastYear.predictedCost !== undefined
      ? current.predictedCost - lastYear.predictedCost
      : null;

  return {
    current,
    lastYear,
    actualDelta,
    predictedDelta,
    actualPctChange:
      actualDelta !== null && lastYear.actualCost
        ? (actualDelta / lastYear.actualCost) * 100
        : null,
    predictedPctChange:
      predictedDelta !== null && lastYear.predictedCost
        ? (predictedDelta / lastYear.predictedCost) * 100
        : null,
  };
}

export function getRecentTrend(months = 6) {
  const history = loadHistory();
  const sorted = history
    .sort((a, b) => b.key.localeCompare(a.key))
    .slice(0, months);
  return sorted.map((h) => ({
    label: `${h.year}-${String(h.month).padStart(2, "0")}`,
    actual: h.actualCost,
    predicted: h.predictedCost,
    upgrade: h.upgradeName,
  }));
}
