// Brand-agnostic CSV normalization for System Performance Analyzer

const HEADER_SYNONYMS = {
  Date: [/^date$/i],
  Time: [/^time$/i],
  Timestamp: [/^(timestamp|date\s*time|datetime|date_time|date-time)$/i],
  "Outdoor Temp (F)": [
    /^(out|outside|outdoor)[^a-zA-Z0-9_]*temp/i,
    /^outdoor temperature\s*\(f\)/i,
    /^outdoor temperature$/i,
    /^outside temperature$/i,
    /^outdoor tel$/i, // Ecobee truncated: "Outdoor Tel"
    /^outdoor\s*tel/i,
  ],
  "Thermostat Temperature (F)": [
    /^(thermostat|indoor|inside)[^a-zA-Z0-9_]*temp/i,
    /^indoor temperature\s*\(f\)/i,
    /^thermostat temperature$/i,
    /^temperature\s*\(f\)$/i,
    /^current ten$/i, // Ecobee truncated: "Current Ten" (Current Temperature)
    /^current\s*ten/i,
    /^current temp/i,
  ],
  "Heat Stage 1 (sec)": [
    /^(heat|compressor|stage\s*1|hp stage 1).*?(sec|seconds|runtime|run time|time)$/i,
    /^heat stage 1$/i,
    /^heat stage$/i, // Ecobee: "Heat Stage" (without "1" or units)
    /^heat\s*stage$/i,
  ],
  "Aux Heat 1 (sec)": [
    /^(aux|auxiliary).*?(heat).*?(sec|seconds|runtime|run time|time)$/i,
    /^aux heat 1$/i,
    /^aux heat 1\s*\(fan\s*\(sec\)\)$/i, // Ecobee: "Aux Heat 1 (Fan (sec))"
    /^aux heat 1\s*\(fan/i,
  ],
};

const tryFindHeader = (headers, patterns) => {
  for (const h of headers) {
    const clean = h.trim().replace(/"/g, "");
    for (const p of patterns) {
      if (p.test(clean)) return h; // return the original header token
    }
  }
  return null;
};

const buildHeaderMap = (headers) => {
  // Map canonical -> original header as found in file
  const map = {};
  for (const canonical of Object.keys(HEADER_SYNONYMS)) {
    const found = tryFindHeader(headers, HEADER_SYNONYMS[canonical]);
    if (found) map[canonical] = found;
  }
  return map;
};

const parseDateTimeParts = (value) => {
  if (!value) return { date: "", time: "" };
  const s = String(value).trim();
  // Try ISO-like split by 'T'
  let datePart = "",
    timePart = "";
  if (s.includes("T")) {
    const [d, t] = s.split("T");
    datePart = d || "";
    timePart = (t || "").replace(/Z$/i, "");
  } else if (s.includes(" ")) {
    const [d, t] = s.split(" ");
    datePart = d || "";
    timePart = t || "";
  } else {
    // Fallback: only date or only time? Assume date
    datePart = s;
  }
  // Normalize time to HH:MM:SS if possible
  const m = timePart.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const hh = String(m[1]).padStart(2, "0");
    const mm = String(m[2]).padStart(2, "0");
    const ss = m[3] ? String(m[3]).padStart(2, "0") : "00";
    timePart = `${hh}:${mm}:${ss}`;
  } else if (timePart) {
    // Could not parse; default to 00:00:00 to avoid crashes
    timePart = "00:00:00";
  }
  return { date: datePart, time: timePart };
};

const detectCelsius = (rows, outdoorKey, indoorKey, headerHints = {}) => {
  // Explicit headers win - if it says (C), it's Celsius
  if (/\(c\)/i.test(outdoorKey) || /\(c\)/i.test(indoorKey)) return true;
  if (headerHints.outdoorHasC) return true;

  // ☦️ CRITICAL: If header explicitly says (F), NEVER auto-convert
  // This prevents converting valid Fahrenheit winter data (30-50°F) to Celsius
  if (/\(f\)/i.test(outdoorKey) || /\(f\)/i.test(indoorKey)) return false;

  // Sample up to 50 values
  const outdoorVals = [];
  const indoorVals = [];
  for (
    let i = 0;
    i < rows.length && (outdoorVals.length < 50 || indoorVals.length < 50);
    i++
  ) {
    const o = parseFloat(rows[i][outdoorKey]);
    const inn = parseFloat(rows[i][indoorKey]);
    if (Number.isFinite(o)) outdoorVals.push(o);
    if (Number.isFinite(inn)) indoorVals.push(inn);
  }

  if (outdoorVals.length === 0 && indoorVals.length === 0) return false;

  const allVals = [...outdoorVals, ...indoorVals];
  const avg = allVals.reduce((a, b) => a + b, 0) / allVals.length;
  const max = Math.max(...allVals);
  const min = Math.min(...allVals);

  // ☦️ SAFETY CHECK: If indoor temps ever go above 80, they're almost certainly °F
  // (Nobody's house is 80°C / 176°F - that would be a sauna)
  // This catches cases where we'd incorrectly convert 70-80°F indoor temps
  if (indoorVals.length > 0) {
    const maxIndoor = Math.max(...indoorVals);
    if (maxIndoor >= 80) return false; // Definitely Fahrenheit
  }

  // ☦️ NARROWED BAND: Only treat as Celsius if:
  // - Average is between 5-35°C (41-95°F equivalent, but we're checking raw values)
  // - Max is ≤ 50°C (122°F equivalent)
  // - Min is ≥ -30°C (-22°F equivalent)
  // This prevents converting legitimate cold Fahrenheit data (e.g., 30-45°F winter temps)
  // which would fall in the old range but are clearly not Celsius
  return avg >= 5 && avg <= 35 && max <= 50 && min >= -30;
};

export const normalizeCsvData = (headers, data) => {
  const headerMap = buildHeaderMap(headers);
  const outKey =
    headerMap["Outdoor Temp (F)"] ||
    headers.find((h) => /outdoor.*temp|outdoor\s*tel/i.test(h)) ||
    "Outdoor Temp (F)";
  const inKey =
    headerMap["Thermostat Temperature (F)"] ||
    headers.find((h) =>
      /(thermostat|indoor|current\s*ten).*temp|current\s*ten/i.test(h)
    ) ||
    "Thermostat Temperature (F)";
  const stageKey =
    headerMap["Heat Stage 1 (sec)"] ||
    headers.find((h) => /(heat|compressor).*stage/i.test(h)) ||
    "Heat Stage 1 (sec)";
  const auxKey =
    headerMap["Aux Heat 1 (sec)"] ||
    headers.find((h) => /(aux|auxiliary).*heat/i.test(h)) ||
    "Aux Heat 1 (sec)";
  const dateKey = headerMap["Date"];
  const timeKey = headerMap["Time"];
  const tsKey = headerMap["Timestamp"];

  // Build normalized rows with canonical keys
  const normalized = data.map((row) => {
    const nr = { ...row };
    // Split timestamp if needed
    if (!nr.Date || !nr.Time) {
      const tsVal = tsKey
        ? row[tsKey]
        : row.Timestamp ||
          row.Datetime ||
          row["Date Time"] ||
          row["date time"] ||
          row.datetime;
      if (tsVal) {
        const { date, time } = parseDateTimeParts(tsVal);
        if (!nr.Date) nr.Date = date;
        if (!nr.Time) nr.Time = time;
      } else {
        if (dateKey && !nr.Date) nr.Date = row[dateKey];
        if (timeKey && !nr.Time) nr.Time = row[timeKey];
      }
    }

    // Map temps and runtimes to canonical keys
    if (!nr["Outdoor Temp (F)"] && outKey && row[outKey] != null)
      nr["Outdoor Temp (F)"] = row[outKey];
    if (!nr["Thermostat Temperature (F)"] && inKey && row[inKey] != null)
      nr["Thermostat Temperature (F)"] = row[inKey];
    if (!nr["Heat Stage 1 (sec)"] && stageKey && row[stageKey] != null)
      nr["Heat Stage 1 (sec)"] = row[stageKey];
    if (!nr["Aux Heat 1 (sec)"] && auxKey && row[auxKey] != null)
      nr["Aux Heat 1 (sec)"] = row[auxKey];
    return nr;
  });

  // Detect Celsius and convert to Fahrenheit if needed
  const outHeaderForDetect = outKey || "Outdoor Temp (F)";
  const inHeaderForDetect = inKey || "Thermostat Temperature (F)";

  // Store original values before conversion for sanity checking
  const originalOutdoorVals = normalized
    .map((r) => parseFloat(r["Outdoor Temp (F)"] ?? r[outHeaderForDetect]))
    .filter((v) => Number.isFinite(v))
    .slice(0, 10); // Sample first 10 for comparison

  const isC = detectCelsius(normalized, outHeaderForDetect, inHeaderForDetect, {
    outdoorHasC: /\(c\)/i.test(outHeaderForDetect),
  });

  if (isC) {
    for (const r of normalized) {
      const o = parseFloat(r["Outdoor Temp (F)"] ?? r[outHeaderForDetect]);
      const inn = parseFloat(
        r["Thermostat Temperature (F)"] ?? r[inHeaderForDetect]
      );
      if (Number.isFinite(o)) r["Outdoor Temp (F)"] = String((o * 9) / 5 + 32);
      if (Number.isFinite(inn))
        r["Thermostat Temperature (F)"] = String((inn * 9) / 5 + 32);
    }

    // ☦️ SANITY CHECK: After conversion, check if temps jumped dramatically
    // This catches cases where we incorrectly converted Fahrenheit data
    const convertedOutdoorVals = normalized
      .map((r) => parseFloat(r["Outdoor Temp (F)"] ?? r[outHeaderForDetect]))
      .filter((v) => Number.isFinite(v))
      .slice(0, 10);

    if (originalOutdoorVals.length > 0 && convertedOutdoorVals.length > 0) {
      const originalAvg =
        originalOutdoorVals.reduce((a, b) => a + b, 0) /
        originalOutdoorVals.length;
      const convertedAvg =
        convertedOutdoorVals.reduce((a, b) => a + b, 0) /
        convertedOutdoorVals.length;
      const jump = Math.abs(convertedAvg - originalAvg);

      // If average temp jumped by more than 30°F, something is wrong
      // (Celsius to Fahrenheit conversion should add ~32°F, but if original was already °F,
      // we'd see a jump of ~50-60°F which is a red flag)
      if (jump > 30) {
        console.warn(
          "[CSV Normalization] Suspicious temperature conversion detected:",
          {
            originalAvg: originalAvg.toFixed(1) + "°",
            convertedAvg: convertedAvg.toFixed(1) + "°F",
            jump: jump.toFixed(1) + "°F",
            header: outHeaderForDetect,
            message:
              "Temperature values may have been incorrectly converted. Check if data was already in Fahrenheit.",
          }
        );
      }
    }
  }

  // Detect runtime units (sec/min/ms) and normalize to seconds
  // ☦️ NOTE: Header-based detection is preferred; value-based heuristics are fallback only
  // For Ecobee files with explicit "(sec)" in headers, this works correctly.
  // For other vendors, consider: "if max > 5*60 and header doesn't mention min/ms, assume sec"
  const inferRuntimeUnit = (rows, key, originalHeader) => {
    const header = String(originalHeader || key || "").toLowerCase();
    // Header-based detection (most reliable)
    if (/\b(min|minutes)\b|\(min\)/.test(header)) return "min";
    if (/\b(ms|millisecond)\b|\(ms\)/.test(header)) return "ms";
    if (/\b(sec|seconds)\b|\(sec\)/.test(header)) return "sec";

    // Heuristic based on values (fallback - can be fragile for edge cases)
    const samples = [];
    for (let i = 0; i < rows.length && samples.length < 100; i++) {
      const v = rows[i][key];
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) samples.push(n);
    }
    if (!samples.length) return "sec";
    const max = Math.max(...samples);
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    if (max >= 10000) return "ms"; // very likely milliseconds
    if (max <= 10 && avg <= 5) return "min"; // likely minutes (fragile - could misfire on sparse data)
    return "sec";
  };

  const stageUnit = inferRuntimeUnit(
    normalized,
    "Heat Stage 1 (sec)",
    stageKey
  );
  const auxUnit = inferRuntimeUnit(normalized, "Aux Heat 1 (sec)", auxKey);

  if (stageUnit !== "sec" || auxUnit !== "sec") {
    for (const r of normalized) {
      if (r["Heat Stage 1 (sec)"] != null && r["Heat Stage 1 (sec)"] !== "") {
        let n = Number(r["Heat Stage 1 (sec)"]);
        if (Number.isFinite(n)) {
          if (stageUnit === "min") n = n * 60;
          else if (stageUnit === "ms") n = n / 1000;
          r["Heat Stage 1 (sec)"] = String(Math.round(n));
        }
      }
      if (r["Aux Heat 1 (sec)"] != null && r["Aux Heat 1 (sec)"] !== "") {
        let n = Number(r["Aux Heat 1 (sec)"]);
        if (Number.isFinite(n)) {
          if (auxUnit === "min") n = n * 60;
          else if (auxUnit === "ms") n = n / 1000;
          r["Aux Heat 1 (sec)"] = String(Math.round(n));
        }
      }
    }
  }

  return normalized;
};

export default normalizeCsvData;
