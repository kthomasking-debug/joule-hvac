const averageHourlyRows = (rows) => {
  if (!rows || rows.length === 0) return [];
  const keys = Object.keys(rows[0]);
  const groups = {};
  const asNum = (v) => {
    const s = ('' + v).trim();
    if (!/\d/.test(s)) return NaN;
    const n = Number(s.replace(/[^\d\-.]/g, ''));
    return Number.isFinite(n) ? n : NaN;
  };
  rows.forEach(row => {
    const dateVal = row.Date || row.date || '';
    const timeVal = row.Time || row.time || '';
    const parts = ('' + timeVal).split(':');
    const hour = parts.length > 0 ? String(parts[0]).padStart(2, '0') : '00';
    const key = `${dateVal} ${hour}`;
    groups[key] = groups[key] || { count: 0, sums: {}, freqs: {}, rows: [] };
    groups[key].count += 1;
    groups[key].rows.push(row);
    keys.forEach(k => {
      const v = row[k];
      const n = asNum(v);
      if (!Number.isNaN(n)) {
        groups[key].sums[k] = (groups[key].sums[k] || 0) + n;
      } else {
        const freq = groups[key].freqs[k] = groups[key].freqs[k] || {};
        const vv = v == null ? '' : String(v);
        freq[vv] = (freq[vv] || 0) + 1;
      }
    });
  });
  const averaged = Object.keys(groups).map(key => {
    const [datePart, hourPart] = key.split(' ');
    const g = groups[key];
    const out = {};
    keys.forEach(k => {
      if (g.sums && k in g.sums) {
        const avg = g.sums[k] / g.count;
        out[k] = Math.abs(avg - Math.round(avg)) < 0.0001 ? String(Math.round(avg)) : String(Number(avg.toFixed(2)));
      } else if (g.freqs && g.freqs[k]) {
        const freq = g.freqs[k];
        const entries = Object.entries(freq);
        if (entries.length === 0) out[k] = '';
        else {
          entries.sort((a, b) => b[1] - a[1]);
          out[k] = entries[0][0];
        }
      } else {
        out[k] = '';
      }
    });
    if ('Date' in out) out.Date = datePart;
    if ('Time' in out) out.Time = `${hourPart}:00:00`;
    return out;
  });
  return averaged;
};

const rows = [
  { Date: '2025-01-01', Time: '00:00:00', 'Outdoor Temp (F)': '20', 'Thermostat Temperature (F)': '70', Mode: 'heat' },
  { Date: '2025-01-01', Time: '00:15:00', 'Outdoor Temp (F)': '21', 'Thermostat Temperature (F)': '69.9', Mode: 'heat' },
  { Date: '2025-01-01', Time: '01:00:00', 'Outdoor Temp (F)': '18', 'Thermostat Temperature (F)': '70.5', Mode: 'heat' },
  { Date: '2025-01-02', Time: '00:30:00', 'Outdoor Temp (F)': '22', 'Thermostat Temperature (F)': '70.1', Mode: 'heat' }
];

const result = averageHourlyRows(rows);
console.log('result', result);
