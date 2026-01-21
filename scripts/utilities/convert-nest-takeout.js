#!/usr/bin/env node
/**
 * convert-nest-takeout.js
 *
 * Convert Google Nest Takeout JSON into the canonical CSV shape expected by SystemPerformanceAnalyzer:
 *   Date,Time,Outdoor Temp (F),Thermostat Temperature (F),Heat Stage 1 (sec),Aux Heat 1 (sec)
 *
 * Usage:
 *   node scripts/convert-nest-takeout.js --input path/to/nest.json --output out.csv
 *   node scripts/convert-nest-takeout.js -i nest.json -o out.csv
 *
 * Notes:
 * - This script uses heuristics to detect common Nest fields. If your export differs, use --map-* flags.
 * - If your data contains Celsius fields, they will be converted to Fahrenheit automatically.
 * - When only boolean heater flags are present (e.g. heater on/off per sample), we assume 300s (5 min)
 *   per sample when the flag is true; adjust via --sampleSeconds if your cadence differs.
 * - If outdoor temperature is missing in your export, you may pass a constant via --fallbackOutdoorF 35
 */

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const args = { sampleSeconds: 300 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    switch (a) {
      case "--input":
      case "-i":
        args.input = next;
        i++;
        break;
      case "--output":
      case "-o":
        args.output = next;
        i++;
        break;
      case "--sampleSeconds":
        args.sampleSeconds = Number(next) || 300;
        i++;
        break;
      case "--fallbackOutdoorF":
        args.fallbackOutdoorF = Number(next);
        i++;
        break;
      case "--mapTimestamp":
        args.mapTimestamp = next;
        i++;
        break;
      case "--mapIndoorC":
        args.mapIndoorC = next;
        i++;
        break;
      case "--mapIndoorF":
        args.mapIndoorF = next;
        i++;
        break;
      case "--mapOutdoorC":
        args.mapOutdoorC = next;
        i++;
        break;
      case "--mapOutdoorF":
        args.mapOutdoorF = next;
        i++;
        break;
      case "--mapHeatSec":
        args.mapHeatSec = next;
        i++;
        break;
      case "--mapHeatFlag":
        args.mapHeatFlag = next;
        i++;
        break;
      case "--mapAuxSec":
        args.mapAuxSec = next;
        i++;
        break;
      case "--mapAuxFlag":
        args.mapAuxFlag = next;
        i++;
        break;
      default:
        // ignore unknown flags
        break;
    }
  }
  if (!args.input) {
    console.error("Error: --input path/to/nest.json is required");
    process.exit(1);
  }
  if (!args.output) {
    const base = path.basename(args.input).replace(/\.json$/i, "") || "nest";
    args.output = path.join(process.cwd(), `${base}-converted.csv`);
  }
  return args;
}

function readJsonAny(inputPath) {
  const txt = fs.readFileSync(inputPath, "utf8").trim();
  try {
    return JSON.parse(txt);
  } catch (e) {
    // try JSON Lines
    const lines = txt
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const arr = [];
    for (const line of lines) {
      try {
        arr.push(JSON.parse(line));
      } catch {
        /* ignore malformed JSON line */
      }
    }
    if (arr.length) return arr;
    throw e;
  }
}

function flatten(obj, prefix = "", out = {}) {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      const p = prefix ? `${prefix}.${k}` : k;
      flatten(v, p, out);
    }
  } else {
    out[prefix] = obj;
  }
  return out;
}

function findKey(flat, candidates) {
  for (const c of candidates) {
    for (const key of Object.keys(flat)) {
      if (c.test(key)) return key;
    }
  }
  return null;
}

function cToF(c) {
  return (c * 9) / 5 + 32;
}

function toDateTimeParts(ts) {
  const s = String(ts);
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}:${ss}` };
  }
  // try naive split
  const p = s.includes("T") ? s.split("T") : s.split(" ");
  return {
    date: p[0] || "",
    time: (p[1] || "").replace(/Z$/, "") || "00:00:00",
  };
}

function extractRecords(data) {
  const records = [];
  const arr = Array.isArray(data) ? data : data?.records || data?.events || [];
  const visit = (item) => {
    if (!item) return;
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    const flat = flatten(item);
    records.push({ raw: item, flat });
  };
  visit(arr);
  // If empty, flatten top-level object
  if (records.length === 0 && data && typeof data === "object") {
    records.push({ raw: data, flat: flatten(data) });
  }
  return records;
}

function buildCsv(args, data) {
  const recs = extractRecords(data);
  const out = [];

  const defaultKeys = {
    ts: [
      /(^|\.)timestamp$/i,
      /(^|\.)time$/i,
      /(^|\.)eventTime$/i,
      /(^|\.)startTime$/i,
    ],
    indoorC: [/(ambient|indoor|inside).*temperature.*c/i],
    indoorF: [
      /(ambient|indoor|inside).*temperature.*f/i,
      /temperature.*fahrenheit/i,
    ],
    outdoorC: [/(outdoor|outside).*temperature.*c/i],
    outdoorF: [/(outdoor|outside).*temperature.*f/i],
    heatSec: [/(heat|heating).*?(sec|seconds|duration|runtime)/i],
    heatFlag: [/(heat|heating).*?(on|active|state)$/i],
    auxSec: [/(aux|auxiliary).*?(sec|seconds|duration|runtime)/i],
    auxFlag: [/(aux|auxiliary).*?(on|active|state)$/i],
  };

  for (const { flat } of recs) {
    const tsKey = args.mapTimestamp || findKey(flat, defaultKeys.ts);
    if (!tsKey) continue;
    const tsVal = flat[tsKey];
    const { date, time } = toDateTimeParts(tsVal);

    // indoor temp
    let indoorF = null;
    if (args.mapIndoorF && flat[args.mapIndoorF] != null)
      indoorF = Number(flat[args.mapIndoorF]);
    else if (args.mapIndoorC && flat[args.mapIndoorC] != null)
      indoorF = cToF(Number(flat[args.mapIndoorC]));
    else {
      const kF = findKey(flat, defaultKeys.indoorF);
      const kC = findKey(flat, defaultKeys.indoorC);
      if (kF) indoorF = Number(flat[kF]);
      else if (kC) indoorF = cToF(Number(flat[kC]));
    }

    // outdoor temp
    let outdoorF = null;
    if (args.mapOutdoorF && flat[args.mapOutdoorF] != null)
      outdoorF = Number(flat[args.mapOutdoorF]);
    else if (args.mapOutdoorC && flat[args.mapOutdoorC] != null)
      outdoorF = cToF(Number(flat[args.mapOutdoorC]));
    else {
      const kF = findKey(flat, defaultKeys.outdoorF);
      const kC = findKey(flat, defaultKeys.outdoorC);
      if (kF) outdoorF = Number(flat[kF]);
      else if (kC) outdoorF = cToF(Number(flat[kC]));
      else if (typeof args.fallbackOutdoorF === "number")
        outdoorF = args.fallbackOutdoorF;
    }

    // heat stage 1 seconds
    let heatSec = null;
    if (args.mapHeatSec && flat[args.mapHeatSec] != null)
      heatSec = Number(flat[args.mapHeatSec]);
    else {
      const k = findKey(flat, defaultKeys.heatSec);
      if (k) heatSec = Number(flat[k]);
      else if (
        args.mapHeatFlag &&
        typeof flat[args.mapHeatFlag] !== "undefined"
      ) {
        heatSec = flat[args.mapHeatFlag] ? Number(args.sampleSeconds) : 0;
      } else {
        const kf = findKey(flat, defaultKeys.heatFlag);
        if (kf) heatSec = flat[kf] ? Number(args.sampleSeconds) : 0;
      }
    }

    // aux heat seconds
    let auxSec = 0;
    if (args.mapAuxSec && flat[args.mapAuxSec] != null)
      auxSec = Number(flat[args.mapAuxSec]);
    else {
      const k = findKey(flat, defaultKeys.auxSec);
      if (k) auxSec = Number(flat[k]);
      else if (
        args.mapAuxFlag &&
        typeof flat[args.mapAuxFlag] !== "undefined"
      ) {
        auxSec = flat[args.mapAuxFlag] ? Number(args.sampleSeconds) : 0;
      } else {
        const kf = findKey(flat, defaultKeys.auxFlag);
        if (kf) auxSec = flat[kf] ? Number(args.sampleSeconds) : 0;
      }
    }

    if (!date || !time) continue;
    if (outdoorF == null || indoorF == null) continue; // require temps
    if (heatSec == null) heatSec = 0;
    if (auxSec == null) auxSec = 0;

    out.push({ date, time, outdoorF, indoorF, heatSec, auxSec });
  }

  // Sort by date+time
  out.sort((a, b) =>
    (a.date + " " + a.time).localeCompare(b.date + " " + b.time)
  );
  return out;
}

function toCsv(rows) {
  const header =
    "Date,Time,Outdoor Temp (F),Thermostat Temperature (F),Heat Stage 1 (sec),Aux Heat 1 (sec)";
  const body = rows.map((r) =>
    [
      r.date,
      r.time,
      String(r.outdoorF),
      String(r.indoorF),
      String(r.heatSec),
      String(r.auxSec),
    ]
      .map((v) => '"' + String(v).replace(/"/g, '""') + '"')
      .join(",")
  );
  return [header, ...body].join("\n");
}

(function main() {
  const args = parseArgs(process.argv);
  const data = readJsonAny(args.input);
  const rows = buildCsv(args, data);
  if (!rows.length) {
    console.error(
      "No convertible rows found. Use --map* flags to specify field names, or provide a fallback outdoor temp via --fallbackOutdoorF."
    );
    process.exit(2);
  }
  const csv = toCsv(rows);
  fs.writeFileSync(args.output, csv, "utf8");
  console.log(`Wrote ${rows.length} rows -> ${args.output}`);
})();
