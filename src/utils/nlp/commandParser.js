// Thermostat-specific natural language parsing
// Returns a structured intent object { intent, entities, confidence, suggestions }

const NUM = "(?:\\d{1,2})";

function parseTemperatureCommand(q) {
  // set temperature to 72 / set temp 70 / adjust to 68 degrees
  const reSet =
    /(set|adjust|change)\s+(?:the\s*)?(?:temp|temperature|thermostat)(?:\s*to)?\s*(\d{2})\b/iu;
  const mSet = q.match(reSet);
  if (mSet) {
    const value = parseInt(mSet[2], 10);
    if (value >= 45 && value <= 85)
      return {
        intent: "setTemperature",
        entities: { value },
        confidence: 0.95,
      };
  }
  // increase / decrease temperature by X
  const reDelta =
    /(make|set|change|adjust).*?(warmer|cooler|colder|higher|lower)(?:\s*by\s*(\d{1,2}))?/iu;
  const mDelta = q.match(reDelta);
  if (mDelta) {
    const direction = mDelta[2].toLowerCase();
    const raw = mDelta[3] ? parseInt(mDelta[3], 10) : 1;
    const value = Math.min(Math.max(raw, 1), 10);
    return {
      intent:
        direction.includes("warm") || direction.includes("higher")
          ? "increaseTemperature"
          : "decreaseTemperature",
      entities: { value },
      confidence: 0.9,
    };
  }
  // plain number + degrees
  const rePlain = /(\d{2})\s*degrees?\b/iu;
  const mPlain = q.match(rePlain);
  if (mPlain) {
    const value = parseInt(mPlain[1], 10);
    if (value >= 45 && value <= 85)
      return {
        intent: "setTemperature",
        entities: { value },
        confidence: 0.7,
        suggestions: ['Say "set temperature to ' + value + '" for clarity'],
      };
  }
  return null;
}

function parseMode(q) {
  // Reject questions - if it starts with question words, it's NOT a mode command
  if (
    /^(how|what|why|when|where|who|which|can\s+i|should\s+i|do\s+i|does|is|are|will|would|could)\b/i.test(
      q
    )
  ) {
    return null;
  }

  // Reject cost/energy queries that happen to contain mode words
  if (/(cost|price|bill|save|saving|energy|kwh|usage|use|spend)/i.test(q)) {
    return null;
  }

  const reMode = /\b(heat|heating|cool|cooling|auto|off)\b(?:\s*mode)?/iu;
  const m = q.match(reMode);
  if (!m) return null;
  let mode = m[1].toLowerCase();
  if (mode === "heating") mode = "heat";
  if (mode === "cooling") mode = "cool";
  return { intent: "setMode", entities: { mode }, confidence: 0.9 };
}

function parsePreset(q) {
  const rePreset = /\b(sleep|away|home)\b(?:\s*(?:mode|preset))?/iu;
  const m = q.match(rePreset);
  if (!m) return null;
  return {
    intent: "applyPreset",
    entities: { preset: m[1].toLowerCase() },
    confidence: 0.88,
  };
}

function parseNavigation(q) {
  const reNav =
    /(open|show|go to|navigate to)\s+(forecast|settings|home|dashboard|cost|energy|thermostat)/iu;
  const m = q.match(reNav);
  if (!m) return null;
  const target = m[2].toLowerCase();
  return { intent: "navigate", entities: { target }, confidence: 0.85 };
}

function parseHelp(q) {
  if (/\b(help|what can i (do|ask)|commands?)\b/iu.test(q)) {
    return { intent: "help", entities: {}, confidence: 0.9 };
  }
  return null;
}

export function parseThermostatCommand(input) {
  if (!input) return { intent: "unknown", confidence: 0 };
  const q = String(input).trim();
  const handlers = [
    parseTemperatureCommand,
    parseMode,
    parsePreset,
    parseNavigation,
    parseHelp,
  ];
  for (const fn of handlers) {
    const res = fn(q);
    if (res) return res;
  }
  return { intent: "unknown", confidence: 0 };
}

export default parseThermostatCommand;
