/**
 * CSV data processing utilities
 */

// Helper: return averaged rows per hour (grouping by date & hour)
export const averageHourlyRows = (rows) => {
  if (!rows || rows.length === 0) return [];
  const keys = Object.keys(rows[0]);
  const groups = {};
  // Helper to attempt numeric parsing
  const asNum = (v) => {
    const s = ("" + v).trim();
    // If there are no digits, treat as non-numeric
    if (!/\d/.test(s)) return NaN;
    const n = Number(s.replace(/[^\d\-.]/g, ""));
    return Number.isFinite(n) ? n : NaN;
  };
  rows.forEach((row) => {
    const dateVal = row.Date || row.date || "";
    const timeVal = row.Time || row.time || "";
    // parse hour from time string allowing formats like 0:00:00, 00:05:00, 1:05:00
    const parts = ("" + timeVal).split(":");
    const hour = parts.length > 0 ? String(parts[0]).padStart(2, "0") : "00";
    const key = `${dateVal} ${hour}`;
    groups[key] = groups[key] || { count: 0, sums: {}, freqs: {}, rows: [] };
    groups[key].count += 1;
    groups[key].rows.push(row);
    keys.forEach((k) => {
      const v = row[k];
      const n = asNum(v);
      if (!Number.isNaN(n)) {
        groups[key].sums[k] = (groups[key].sums[k] || 0) + n;
      } else {
        // track freqs for non-numeric
        const freq = (groups[key].freqs[k] = groups[key].freqs[k] || {});
        const vv = v == null ? "" : String(v);
        freq[vv] = (freq[vv] || 0) + 1;
      }
    });
  });
  const result = [];
  for (const gkey of Object.keys(groups).sort()) {
    const g = groups[gkey];
    const avgRow = {};
    keys.forEach((k) => {
      if (k in g.sums) {
        avgRow[k] = g.sums[k] / g.count;
      } else {
        // pick mode
        const freq = g.freqs[k] || {};
        const entries = Object.entries(freq);
        if (entries.length === 0) {
          avgRow[k] = "";
        } else {
          entries.sort((a, b) => b[1] - a[1]);
          avgRow[k] = entries[0][0];
        }
      }
    });
    // Ensure Date and Time are strings extracted from group key
    const [dateStr, hourStr] = gkey.split(" ");
    avgRow.Date = dateStr;
    avgRow.Time = `${hourStr}:00:00`;
    result.push(avgRow);
  }
  return result;
};
