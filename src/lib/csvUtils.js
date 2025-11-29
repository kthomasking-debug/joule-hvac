// CSV utilities used by analyzers and tests

export const averageHourlyRows = (rows) => {
  if (!rows || rows.length === 0) return [];
  const keys = Object.keys(rows[0]);
  const groups = {};
  // Helper to attempt numeric parsing
  const asNum = (v) => {
    const s = ("" + v).trim();
    if (!/\d/.test(s)) return NaN;
    const n = Number(s.replace(/[^\d\-.]/g, ""));
    return Number.isFinite(n) ? n : NaN;
  };
  rows.forEach((row) => {
    const dateVal = row.Date || row.date || "";
    const timeVal = row.Time || row.time || "";
    const parts = ("" + timeVal).split(":");
    const hour = parts.length > 0 ? String(parts[0]).padStart(2, "0") : "00";
    const key = `${dateVal} ${hour}`;
    groups[key] = groups[key] || { count: 0, sums: {}, freqs: {}, rows: [] };
    groups[key].count += 1;
    groups[key].rows.push(row);
    keys.forEach((k) => {
      const v = row[k];
      const n = asNum(v);
      if (Number.isFinite(n)) {
        groups[key].sums[k] = (groups[key].sums[k] || 0) + n;
      } else {
        const s = (v == null ? "" : String(v)).trim();
        groups[key].freqs[k] = groups[key].freqs[k] || {};
        groups[key].freqs[k][s] = (groups[key].freqs[k][s] || 0) + 1;
      }
    });
  });

  const averaged = Object.keys(groups).map((key) => {
    const [datePart, hourPart] = key.split(" ");
    const g = groups[key];
    const out = {};
    keys.forEach((k) => {
      if (g.sums && k in g.sums) {
        if (g.freqs && g.freqs[k]) {
          const freqKeys = Object.keys(g.freqs[k]);
          const hasNonNumericKey = freqKeys.some(
            (str) => /\D/.test(str) && str.trim() !== ""
          );
          if (hasNonNumericKey) {
            const entries = Object.entries(g.freqs[k]);
            entries.sort((a, b) => b[1] - a[1]);
            out[k] = entries[0][0];
            return;
          }
        }
        const avg = g.sums[k] / g.count;
        out[k] =
          Math.abs(avg - Math.round(avg)) < 0.0001
            ? String(Math.round(avg))
            : String(Number(avg.toFixed(2)));
      } else if (g.freqs && g.freqs[k]) {
        const freq = g.freqs[k];
        const entries = Object.entries(freq);
        if (entries.length === 0) out[k] = "";
        else {
          entries.sort((a, b) => b[1] - a[1]);
          out[k] = entries[0][0];
        }
      } else {
        out[k] = "";
      }
    });
    if ("Date" in out) out.Date = datePart;
    if ("Time" in out) out.Time = `${hourPart}:00:00`;
    return out;
  });
  return averaged;
};

export default {
  averageHourlyRows,
};
