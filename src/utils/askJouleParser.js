// Consolidated Ask Joule Query Parser
// Unified parser for natural language commands and queries
// Exported functions: parseAskJoule, parseCommand

import {
  hasSalesIntent,
  searchSalesFAQ,
  getSalesFallbackResponse,
} from "./rag/salesFAQ.js";

// Map common words to insulation coefficients
const INSULATION_MAP = {
  poor: 1.4,
  average: 1.0,
  typical: 1.0,
  good: 0.65,
};

function parseSquareFeet(q) {
  // Matches: 2,000 sq ft | 1800 square feet | 1.8k sf
  const re =
    /((?:\d{1,3}(?:,\d{3})+)|\d{3,6}|\d+(?:\.\d+)?\s*k)\s*(?:sq\s*?ft|square\s*feet|sf)\b/i;
  const m = q.match(re);
  if (!m) return undefined;
  let raw = m[1].toLowerCase().replace(/,/g, "").trim();
  if (raw.endsWith("k")) {
    const n = parseFloat(raw.slice(0, -1));
    if (!isNaN(n)) return Math.round(n * 1000);
  }
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseTemperature(q) {
  // Match "at 72", "to 72", or "72 degrees" (multi-turn context)
  const re =
    /(?:at|to|set(?:\s*it)?\s*to)\s*(\d{2})(?:\s*°?\s*F|\s*F)?\b|(\d{2})\s*(?:degrees|°)/i;
  const m = q.match(re);
  if (!m) return undefined;
  const n = parseInt(m[1] || m[2], 10);
  if (!Number.isFinite(n)) return undefined;
  if (n < 45 || n > 85) return undefined; // guard against year numbers, etc.
  return n;
}

function parseInsulation(q) {
  const re =
    /(poor|average|typical|good)\s+insulation|\b(poor|average|typical|good)\b/i;
  const m = q.match(re);
  const word = m && (m[1] || m[2]) ? (m[1] || m[2]).toLowerCase() : undefined;
  return word && INSULATION_MAP[word] ? INSULATION_MAP[word] : undefined;
}

function parseSystem(q) {
  if (/heat\s*pump|hp\b/i.test(q)) return "heatPump";
  if (/gas\s*(?:furnace)?|furnace/i.test(q)) return "gasFurnace";
  return undefined;
}

function parseMode(q) {
  if (/\bheating\b|keep\s*it\s*w?arm/i.test(q)) return "heating";
  if (/\bcooling\b|keep\s*it\s*cool/i.test(q)) return "cooling";
  return undefined;
}

function parseCity(q) {
  // Prefer explicit "in City, ST"
  const inComma = q.match(/\bin\s+([A-Za-z.\-\s]+?,\s*[A-Z]{2})\b/i);
  if (inComma) return inComma[1].trim();
  // Bare "City, ST" (avoid capturing leading words before city)
  const bareComma = q.match(/(^|\s)([A-Z][A-Za-z.\s-]+?,\s*[A-Z]{2})\b/);
  if (bareComma) return bareComma[2].trim();
  // Fallback: "in City" form (stop at comma or common keywords/numbers)
  const inCity = q.match(
    /\bin\s+([A-Za-z.\s-]+?)(?:,|\s+(?:at|to|set|with|for|on|keep|good|poor|excellent|bad|\d|$))/i
  );
  if (inCity) return inCity[1].trim();
  // Start-of-string city heuristic: leading capitalized words before a stop word
  const startCity = q.match(
    /^([A-Z][A-Za-z.-]*(?:\s+[A-Z][A-Za-z.-]*)*)\b(?=\s+(?:keep|set|at|to|with|for|on|\d|$))/
  );
  if (startCity) return startCity[1].trim();
  return undefined;
}

// Offline Intelligence Knowledge Base (RAG Lite)
const OFFLINE_KNOWLEDGE = {
  "short cycling": "Short cycling occurs when your HVAC system turns on and off too frequently (typically less than 5 minutes). This wastes energy, increases wear, and reduces efficiency. Common causes: oversized equipment, incorrect differential settings, or thermostat placement issues.",
  "setback": "A setback is lowering your thermostat temperature during unoccupied hours (typically 1-2°F for 8 hours). Lowering the temp by 1°F for 8 hours saves approximately 1% on heating costs. Nighttime setbacks are especially effective.",
  "differential": "A differential (dead band) is the temperature range where your HVAC doesn't run. Standard is 0.5°F. ProStat recommends 1.0°F for efficiency - it reduces short cycling and saves energy while maintaining comfort.",
  "weather models": "The Big 4 weather models are: EC (European Centre/ECMWF) - most accurate globally, CMC (Canadian Meteorological Centre) - excellent for North America, GEFS (Global Ensemble Forecast System) - NOAA's ensemble with 30+ members, and AI ensembles (machine learning models like GraphCast, FourCastNet). ProStat uses NWS (National Weather Service) forecasts which blend these models for US locations. Ensemble forecasts average multiple model runs to reduce uncertainty.",
  "weather model": "The Big 4 weather models are: EC (European Centre/ECMWF) - most accurate globally, CMC (Canadian Meteorological Centre) - excellent for North America, GEFS (Global Ensemble Forecast System) - NOAA's ensemble with 30+ members, and AI ensembles (machine learning models like GraphCast, FourCastNet). ProStat uses NWS (National Weather Service) forecasts which blend these models for US locations. Ensemble forecasts average multiple model runs to reduce uncertainty.",
  "EC model": "EC (European Centre for Medium-Range Weather Forecasts, ECMWF) is considered the most accurate global weather model. It uses advanced data assimilation and has the highest resolution. Often used as the gold standard for forecast accuracy.",
  "CMC model": "CMC (Canadian Meteorological Centre) is Canada's weather model, excellent for North American forecasts. It's part of the Global Environmental Multiscale (GEM) model system and performs well for continental weather patterns.",
  "GEFS": "GEFS (Global Ensemble Forecast System) is NOAA's ensemble forecast system with 30+ ensemble members. It runs multiple model variations to show forecast uncertainty and probability. More reliable than single-model forecasts because it accounts for model uncertainty.",
  "AI ensemble": "AI ensembles use machine learning models like Google's GraphCast, NVIDIA's FourCastNet, and Huawei's Pangu-Weather. These models learn patterns from historical weather data and can be faster than traditional physics-based models, but may struggle with extreme events not seen in training data.",
};

// Offline Intelligence Calculator Functions
function calculateOfflineAnswer(query, context = {}) {
  const q = String(query).trim().toLowerCase();
  
  // 1. State of the Union (Data Fetching)
  if (/what'?s?\s+(?:the\s+)?(?:current\s+)?(?:temp|temperature)/i.test(query)) {
    return { action: "offlineAnswer", type: "temperature", needsContext: true };
  }
  if (/is\s+(?:the\s+)?(?:heat|hvac)\s+(?:on|running)/i.test(query)) {
    return { action: "offlineAnswer", type: "hvacStatus", needsContext: true };
  }
  if (/what'?s?\s+(?:the\s+)?(?:current\s+)?humidity/i.test(query)) {
    return { action: "offlineAnswer", type: "humidity", needsContext: true };
  }
  if (/what'?s?\s+(?:my\s+)?balance\s+point/i.test(query)) {
    return { action: "offlineAnswer", type: "balancePoint", needsContext: true };
  }
  if (/(?:calculate|show|tell\s+me|what\s+is)\s+(?:my\s+)?balance\s+point/i.test(query)) {
    return { action: "offlineAnswer", type: "balancePoint", needsContext: true };
  }
  if (/how\s+much\s+did\s+i\s+spend\s+yesterday/i.test(query)) {
    return { action: "offlineAnswer", type: "yesterdayCost", needsContext: true };
  }
  
  // 2. Pre-Canned Engineering Knowledge
  if (/what\s+is\s+short\s+cycl/i.test(query)) {
    return { action: "offlineAnswer", type: "knowledge", answer: OFFLINE_KNOWLEDGE["short cycling"] };
  }
  if (/why\s+should\s+i\s+use\s+(?:a\s+)?setback/i.test(query)) {
    return { action: "offlineAnswer", type: "knowledge", answer: OFFLINE_KNOWLEDGE["setback"] };
  }
  if (/what\s+is\s+(?:a\s+)?(?:good\s+)?differential/i.test(query)) {
    return { action: "offlineAnswer", type: "knowledge", answer: OFFLINE_KNOWLEDGE["differential"] };
  }
  
  // Weather model questions
  if (/(?:what|explain|tell\s+me\s+about|how\s+do|what\s+are)\s+(?:the\s+)?(?:big\s+4|weather\s+models?|forecast\s+models?)/i.test(query) ||
      /(?:EC|CMC|GEFS|AI\s+ensemble|weather\s+model)/i.test(query)) {
    if (/\bEC\b/i.test(query) && !/(?:CMC|GEFS|AI)/i.test(query)) {
      return { action: "offlineAnswer", type: "knowledge", answer: OFFLINE_KNOWLEDGE["EC model"] };
    }
    if (/\bCMC\b/i.test(query) && !/(?:EC|GEFS|AI)/i.test(query)) {
      return { action: "offlineAnswer", type: "knowledge", answer: OFFLINE_KNOWLEDGE["CMC model"] };
    }
    if (/\bGEFS\b/i.test(query) && !/(?:EC|CMC|AI)/i.test(query)) {
      return { action: "offlineAnswer", type: "knowledge", answer: OFFLINE_KNOWLEDGE["GEFS"] };
    }
    if (/(?:AI\s+ensemble|machine\s+learning\s+model)/i.test(query)) {
      return { action: "offlineAnswer", type: "knowledge", answer: OFFLINE_KNOWLEDGE["AI ensemble"] };
    }
    // Default to general weather models answer
    return { action: "offlineAnswer", type: "knowledge", answer: OFFLINE_KNOWLEDGE["weather models"] };
  }
  
  // 3. Calculator Queries
  const celsiusMatch = query.match(/convert\s+(\d+(?:\.\d+)?)\s+celsius\s+to\s+fahrenheit/i);
  if (celsiusMatch) {
    const c = parseFloat(celsiusMatch[1]);
    const f = (c * 9/5) + 32;
    return { action: "offlineAnswer", type: "calculator", answer: `${c}°C = ${f.toFixed(1)}°F` };
  }
  const fahrenheitMatch = query.match(/convert\s+(\d+(?:\.\d+)?)\s+fahrenheit\s+to\s+celsius/i);
  if (fahrenheitMatch) {
    const f = parseFloat(fahrenheitMatch[1]);
    const c = (f - 32) * 5/9;
    return { action: "offlineAnswer", type: "calculator", answer: `${f}°F = ${c.toFixed(1)}°C` };
  }
  const btuMatch = query.match(/how\s+many\s+btus?\s+is\s+(\d+(?:\.\d+)?)\s+tons?/i);
  if (btuMatch) {
    const tons = parseFloat(btuMatch[1]);
    const btus = tons * 12000;
    return { action: "offlineAnswer", type: "calculator", answer: `${tons} ton${tons !== 1 ? 's' : ''} = ${btus.toLocaleString()} BTU/hr` };
  }
  const costMatch = query.match(/if\s+i\s+pay\s+(\d+(?:\.\d+)?)\s+cents?\s+per\s+kwh,?\s+how\s+much\s+is\s+(\d+(?:\.\d+)?)\s+kwh/i);
  if (costMatch) {
    const rateCents = parseFloat(costMatch[1]);
    const kwh = parseFloat(costMatch[2]);
    const cost = (rateCents / 100) * kwh;
    return { action: "offlineAnswer", type: "calculator", answer: `${kwh} kWh at ${rateCents}¢/kWh = $${cost.toFixed(2)}` };
  }
  
  // 4. System Status Checks
  if (/is\s+(?:my\s+)?firmware\s+up\s+to\s+date/i.test(query)) {
    return { action: "offlineAnswer", type: "systemStatus", check: "firmware" };
  }
  if (/is\s+(?:the\s+)?bridge\s+connected/i.test(query)) {
    return { action: "offlineAnswer", type: "systemStatus", check: "bridge" };
  }
  // More flexible pattern to catch variations like "when was your last data update"
  // Matches: "when was your/the/my/a last data update" or "when was last data update"
  if (/when\s+was\s+(?:your|the|my|a)?\s*last\s+data\s+update/i.test(query) || 
      /when\s+was\s+the\s+last\s+update/i.test(query) ||
      /when\s+was\s+your\s+last\s+update/i.test(query)) {
    return { action: "offlineAnswer", type: "systemStatus", check: "lastUpdate" };
  }
  
  // 5. Easter Egg
  if (/open\s+(?:the\s+)?pod\s+bay\s+doors/i.test(query)) {
    return { action: "offlineAnswer", type: "easterEgg", answer: "I'm sorry, Dave. I can't do that. But I can turn on the fan." };
  }
  
  return null;
}

// Parse context-aware commands (local version used by parseAskJoule)
function parseCommandLocal(query, context = {}) {
  if (!query) return null;
  const q = String(query).trim();
  const qLower = q.toLowerCase();

  // === HIGH-PRIORITY LOCAL COMMANDS ===
  // These are handled locally even if they start with question words
  // because we have exact answers for them without needing AI

  // Joule Score - local calculation
  if (
    /(?:what(?:'s|\s+is)?\s+)?my\s+score|joule\s+score|show\s+(?:me\s+)?(?:my\s+)?score/i.test(
      q
    )
  ) {
    return { action: "showScore" };
  }

  // Savings potential - local analysis
  if (
    /what\s+can\s+i\s+save|how\s+(?:much\s+)?(?:can\s+i|to)\s+save|show\s+(?:me\s+)?(?:my\s+)?savings/i.test(
      q
    )
  ) {
    return { action: "showSavings" };
  }

  // System status - local data display
  // Only match actual status queries, not questions about specific problems
  // Match: "how is my system", "my system status", "system status"
  // Don't match: "why is my system short cycling", "is my system broken"
  // Exclude questions that start with "why", "what", "is", etc. about problems
  if (/^(?:why|what|is|are)\s+(?:my\s+)?system/i.test(q)) {
    // This is a question about a problem, not a status query - let it go to AI
    // Do nothing, continue parsing
  } else if (
    /^(?:how(?:'s|\s+is)?\s+)?my\s+system(?:\s+doing)?\s*$|^system\s+status\s*$|^(?:show|what'?s?)\s+(?:my\s+)?system\s+status$/i.test(
      q
    ) ||
    /^my\s+system$/i.test(q)
  ) {
    return { action: "systemStatus" };
  }

  // Help command
  if (
    /^(?:help|what\s+can\s+you\s+do|what\s+do\s+you\s+do|how\s+do\s+(?:i|you)\s+(?:use|work)|capabilities|commands?)$/i.test(
      q
    )
  ) {
    return { action: "help" };
  }

  // Byzantine Mode Easter Egg 🕯️
  if (
    /(?:enable|activate|turn\s+on)\s+(?:byzantine|liturgical|orthodox|chant)\s*mode/i.test(
      q
    )
  ) {
    return { action: "setByzantineMode", value: true };
  }
  if (
    /(?:disable|deactivate|turn\s+off)\s+(?:byzantine|liturgical|orthodox|chant)\s*mode/i.test(
      q
    )
  ) {
    return { action: "setByzantineMode", value: false };
  }
  if (/rejoice,?\s*o(?:h)?\s+coil\s+unfrosted/i.test(q)) {
    // Secret activation phrase!
    return { action: "setByzantineMode", value: true };
  }

  // Query advanced settings
  if (
    /(?:what|show|tell\s+me)\s+(?:is\s+)?(?:my\s+)?(?:groq\s+)?(?:api\s+)?key/i.test(
      q
    )
  ) {
    return { action: "queryGroqApiKey" };
  }
  if (/(?:what|show|tell\s+me)\s+(?:is\s+)?(?:my\s+)?groq\s+model/i.test(q)) {
    return { action: "queryGroqModel" };
  }
  if (
    /(?:what|show|tell\s+me)\s+(?:is\s+)?(?:my\s+)?(?:voice\s+)?(?:listening\s+)?duration/i.test(
      q
    )
  ) {
    return { action: "queryVoiceListenDuration" };
  }

  // === GENERAL QUESTION REJECTION ===
  // Reject other questions starting with question words - these should go to AI
  if (
    /^(how|what|why|when|where|who|which|can\s+i|should\s+i|do\s+i|does|is|are|will|would|could)\b/i.test(
      qLower
    )
  ) {
    return null;
  }

  // Relative temperature adjustments
  if (
    /(?:make\s+it\s+|turn\s+it\s+)?(?:warmer|hotter|heat\s+up)(?:\s+by\s+(\d+))?/i.test(
      q
    )
  ) {
    const match = q.match(/(?:warmer|hotter|heat\s+up)(?:\s+by\s+(\d+))?/i);
    const delta = match && match[1] ? parseInt(match[1], 10) : 2;
    return { action: "increaseTemp", value: delta };
  }
  if (
    /(?:make\s+it\s+|turn\s+it\s+)?(?:cooler|colder|cool\s+down)(?:\s+by\s+(\d+))?/i.test(
      q
    )
  ) {
    const match = q.match(/(?:cooler|colder|cool\s+down)(?:\s+by\s+(\d+))?/i);
    const delta = match && match[1] ? parseInt(match[1], 10) : 2;
    return { action: "decreaseTemp", value: delta };
  }
  if (
    /(?:increase|raise|turn\s+up|up)\s+(?:the\s+)?(?:temp|temperature|heat)(?:\s+by\s+(\d+))?/i.test(
      q
    )
  ) {
    const match = q.match(/(?:by\s+)?(\d+)/i);
    const delta = match ? parseInt(match[1], 10) : 2;
    return { action: "increaseTemp", value: delta };
  }
  if (
    /(?:decrease|lower|turn\s+down|down)\s+(?:the\s+)?(?:temp|temperature|heat)(?:\s+by\s+(\d+))?/i.test(
      q
    )
  ) {
    const match = q.match(/(?:by\s+)?(\d+)/i);
    const delta = match ? parseInt(match[1], 10) : 2;
    return { action: "decreaseTemp", value: delta };
  }

  // Preset modes for thermostat
  if (
    /(?:i'm|im|i\s+am)\s+(?:going\s+to\s+)?(?:sleep|bed)|sleep\s+mode|bedtime/i.test(
      q
    )
  ) {
    return { action: "presetSleep" };
  }
  if (
    /(?:i'm|im|i\s+am)\s+(?:leaving|going\s+out|gone)|away\s+mode|vacation\s+mode/i.test(
      q
    )
  ) {
    return { action: "presetAway" };
  }
  // More specific: only match explicit "home mode" or "I'm home/back" (not "home's" or questions about "home")
  if (
    /(?:i'm|im|i\s+am)\s+(?:home|back)\b|^home\s+mode\b|^normal\s+mode\b/i.test(
      q
    )
  ) {
    return { action: "presetHome" };
  }

  // Query temperature (supports pronouns from context)
  if (
    /what'?s?\s+(?:the\s+)?(?:current\s+)?(?:temp|temperature)|how\s+(?:hot|cold|warm)\s+is\s+it/i.test(
      q
    )
  ) {
    return { action: "queryTemp" };
  }

  // Direct setting commands
  // Generic "set my temp to X" or "set temp to X" - defaults to winter thermostat
  if (
    /set\s+(?:my\s+)?(?:temp|temperature|thermostat)(?:\s+to)?\s+(\d{2})\b/i.test(
      q
    ) &&
    !/(?:winter|summer|nighttime|daytime|night|day|sleep|home)/i.test(q)
  ) {
    const match = q.match(
      /set\s+(?:my\s+)?(?:temp|temperature|thermostat)(?:\s+to)?\s+(\d{2})\b/i
    );
    if (match) {
      return { action: "setWinterTemp", value: parseInt(match[1], 10) };
    }
  }

  // Winter-specific - handle "winter thermostat", "winter thermostat setting", "winter temp", etc.
  if (
    /(?:set\s+winter(?:\s+(?:thermostat|temp|thermo|setting))?|set\s+(?:thermostat\s+)?winter(?:\s+setting)?|set\s+winter\s+thermostat\s+setting)\s*(?:to\s+)?(\d{2})/i.test(
      q
    )
  ) {
    const match = q.match(
      /(?:set\s+winter(?:\s+(?:thermostat|temp|thermo|setting))?|set\s+(?:thermostat\s+)?winter(?:\s+setting)?|set\s+winter\s+thermostat\s+setting)\s*(?:to\s+)?(\d{2})/i
    );
    if (match && match[1]) {
      return { action: "setWinterTemp", value: parseInt(match[1], 10) };
    }
  }
  // Summer-specific - handle "summer thermostat", "summer thermostat setting", "summer temp", etc.
  if (
    /(?:set\s+summer(?:\s+(?:thermostat|temp|thermo|setting))?|set\s+(?:thermostat\s+)?summer(?:\s+setting)?|set\s+summer\s+thermostat\s+setting)\s*(?:to\s+)?(\d{2})/i.test(
      q
    )
  ) {
    const match = q.match(
      /(?:set\s+summer(?:\s+(?:thermostat|temp|thermo|setting))?|set\s+(?:thermostat\s+)?summer(?:\s+setting)?|set\s+summer\s+thermostat\s+setting)\s*(?:to\s+)?(\d{2})/i
    );
    if (match && match[1]) {
      return { action: "setSummerTemp", value: parseInt(match[1], 10) };
    }
  }

  // What-if scenarios (check BEFORE navigation to avoid "upgrade" matching roi)
  if (/what\s+if.*?(\d+\.?\d*)\s*hspf/i.test(q)) {
    const match = q.match(/what\s+if.*?(\d+\.?\d*)\s*hspf/i);
    return { action: "whatIfHSPF", value: parseFloat(match[1]) };
  }
  if (/set\s+(?:hspf|hspf2?)\s+(?:to\s+)?(\d+\.?\d*)/i.test(q)) {
    const match = q.match(/set\s+(?:hspf|hspf2?)\s+(?:to\s+)?(\d+\.?\d*)/i);
    return { action: "setHSPF", value: parseFloat(match[1]) };
  }
  if (/set\s+(?:seer|efficiency)\s+(?:to\s+)?(\d+\.?\d*)/i.test(q)) {
    const match = q.match(/set\s+(?:seer|efficiency)\s+(?:to\s+)?(\d+\.?\d*)/i);
    return { action: "setSEER", value: parseFloat(match[1]) };
  }
  // Electric rate variants (cents or $/kWh)
  if (
    /set\s+(?:electric|electricity|power|kwh)\s*(?:rate|price|cost)?\s*(?:to\s+)?\$?(\d+(?:\.\d+)?)(?:\s*cents?|\s*¢)?/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+(?:electric|electricity|power|kwh)\s*(?:rate|price|cost)?\s*(?:to\s+)?\$?(\d+(?:\.\d+)?)(?:\s*(cents?|¢))?/i
    );
    let val = parseFloat(m[1]);
    const isCents = !!m[2];
    if (isCents || val > 2) val = val / 100; // treat numbers >2 as cents (e.g., 12 => $0.12)
    return { action: "setUtilityCost", value: val };
  }
  if (
    /set\s+(?:utility\s*cost|utility)\s+(?:to\s+)?\$?(\d+(?:\.\d+)?)(?:\s*cents?)?/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+(?:utility\s*cost|utility)\s+(?:to\s+)?\$?(\d+(?:\.\d+)?)(?:\s*(cents?))?/i
    );
    let val = parseFloat(match[1]);
    const isCents = !!match[2];
    if (isCents || val > 2) val = val / 100;
    return { action: "setUtilityCost", value: val };
  }
  if (/set\s+(?:location|city)\s+(?:to\s+)?([A-Za-z.\-\s,]+?)$/i.test(q)) {
    const match = q.match(
      /set\s+(?:location|city)\s+(?:to\s+)?([A-Za-z.\-\s,]+?)$/i
    );
    if (match) return { action: "setLocation", cityName: match[1].trim() };
  }
  // Set square-feet
  if (
    /set\s+(?:square\s*feet|sq\s*ft|sqft|square\s*footage|sf)\s+(?:to\s+)?(\d{1,3}(?:,\d{3})?|\d+(?:\.\d+)?k?)\b/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+(?:square\s*feet|sq\s*ft|sqft|square\s*footage|sf)\s+(?:to\s+)?(\d{1,3}(?:,\d{3})?|\d+(?:\.\d+)?k?)\b/i
    );
    if (match) {
      const raw = match[1].replace(/,/g, "").toLowerCase();
      const val = raw.endsWith("k")
        ? Math.round(parseFloat(raw.slice(0, -1)) * 1000)
        : parseInt(raw, 10);
      return { action: "setSquareFeet", value: Number(val) };
    }
  }
  // Insulation
  if (/set\s+insulation\s+to\s+(poor|average|typical|good)/i.test(q)) {
    const m = q.match(/set\s+insulation\s+to\s+(poor|average|typical|good)/i);
    if (m)
      return {
        action: "setInsulationLevel",
        value: INSULATION_MAP[m[1].toLowerCase()],
        raw: m[1],
      };
  }
  // Capacity (kBTU) and Cooling capacity
  if (/set\s+(?:cooling\s+)?capacity\s+(?:to\s+)?(\d{1,2})k?/i.test(q)) {
    const m = q.match(/set\s+(?:cooling\s+)?capacity\s+(?:to\s+)?(\d{1,2})k?/i);
    if (m) return { action: "setCapacity", value: Number(m[1]) };
  }
  // AFUE
  if (
    /set\s+(?:afue|furnace\s*efficiency)\s+(?:to\s+)?(\d+(?:\.\d+)?)/i.test(q)
  ) {
    const m = q.match(
      /set\s+(?:afue|furnace\s*efficiency)\s+(?:to\s+)?(\d+(?:\.\d+)?)/i
    );
    if (m) return { action: "setAFUE", value: parseFloat(m[1]) };
  }
  // Home shape (multiplier)
  if (/set\s+home\s+shape\s+(?:to\s+)?(\d+(?:\.\d+)?)/i.test(q)) {
    const m = q.match(/set\s+home\s+shape\s+(?:to\s+)?(\d+(?:\.\d+)?)/i);
    if (m) return { action: "setHomeShape", value: parseFloat(m[1]) };
  }
  // Solar exposure
  if (/set\s+solar\s+exposure\s+(?:to\s+)?(\d+(?:\.\d+)?)/i.test(q)) {
    const m = q.match(/set\s+solar\s+exposure\s+(?:to\s+)?(\d+(?:\.\d+)?)/i);
    if (m) return { action: "setSolarExposure", value: parseFloat(m[1]) };
  }
  // Energy mode
  if (/set\s+energy\s+mode\s+(?:to\s+)?(heating|cooling)/i.test(q)) {
    const m = q.match(/set\s+energy\s+mode\s+(?:to\s+)?(heating|cooling)/i);
    if (m) return { action: "setEnergyMode", value: m[1].toLowerCase() };
  }
  // Primary system - heat pump or gas furnace
  if (
    /set\s+primary\s+system\s+(?:to\s+)?(heat\s*pump|gas\s*furnace)/i.test(q)
  ) {
    const m = q.match(
      /set\s+primary\s+system\s+(?:to\s+)?(heat\s*pump|gas\s*furnace)/i
    );
    if (m)
      return {
        action: "setPrimarySystem",
        value: m[1].toLowerCase().includes("heat") ? "heatPump" : "gasFurnace",
      };
  }
  // Gas cost
  if (/set\s+gas\s+cost\s+(?:to\s+)?\$?(\d+(?:\.\d+)?)/i.test(q)) {
    const m = q.match(/set\s+gas\s+cost\s+(?:to\s+)?\$?(\d+(?:\.\d+)?)/i);
    if (m) return { action: "setGasCost", value: parseFloat(m[1]) };
  }
  if (
    /set\s+(?:gas)\s*(?:rate|price|cost)\s*(?:to\s+)?\$?(\d+(?:\.\d+)?)/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+(?:gas)\s*(?:rate|price|cost)\s*(?:to\s+)?\$?(\d+(?:\.\d+)?)/i
    );
    return { action: "setGasCost", value: parseFloat(match[1]) };
  }
  // Combined rates: "set rates to 12 cents and 1.20"
  if (
    /set\s+rates?\s+(?:to\s+)?([^,]+?)(?:\s*(?:and|,|&)\s*([^,]+))$/i.test(q)
  ) {
    const m = q.match(
      /set\s+rates?\s+(?:to\s+)?([^,]+?)(?:\s*(?:and|,|&)\s*([^,]+))$/i
    );
    const parseRate = (s) => {
      if (!s) return null;
      const mm = s.match(/\$?(\d+(?:\.\d+)?)(?:\s*(cents?|¢|\/kwh|kwh))?/i);
      if (!mm) return null;
      let v = parseFloat(mm[1]);
      const unit = (mm[2] || "").toLowerCase();
      if (unit.includes("cent") || unit.includes("¢") || (!unit && v > 2))
        v = v / 100; // assume cents
      return v;
    };
    const electricRate = parseRate(m[1]);
    const gasRate = parseRate(m[2]);
    if (electricRate != null && gasRate != null)
      return { action: "setRates", electricRate, gasRate };
  }
  // Set cooling system
  if (
    /set\s+cooling\s+system\s+(?:to\s+)?(centralAC|central\s*A\/C|dual\s*fuel|none|other|dual-fuel)/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+cooling\s+system\s+(?:to\s+)?(centralAC|central\s*A\/C|dual\s*fuel|none|other|dual-fuel)/i
    );
    if (m) {
      let val = m[1];
      if (/central/i.test(val)) val = "centralAC";
      if (/dual/i.test(val)) val = "dualFuel";
      if (/none|other/i.test(val)) val = "none";
      return { action: "setCoolingSystem", value: val };
    }
  }
  // Ceiling height (ft)
  if (
    /set\s+ceiling\s+(?:height\s+)?(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:ft|feet)?\b/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+ceiling\s+(?:height\s+)?(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:ft|feet)?\b/i
    );
    if (m) return { action: "setCeilingHeight", value: parseFloat(m[1]) };
  }
  // Home elevation
  if (/set\s+(?:home\s+)?elevation\s+(?:to\s+)?(\d+(?:,\d{3})?)/i.test(q)) {
    const m = q.match(
      /set\s+(?:home\s+)?elevation\s+(?:to\s+)?(\d+(?:,\d{3})?)/i
    );
    if (m)
      return {
        action: "setHomeElevation",
        value: Number(m[1].replace(/,/g, "")),
      };
  }
  // Aux heat toggle
  if (
    /\bturn\s+(?:on|off)\s+aux(?:iliary)?\s*heat\b/i.test(q) ||
    /\b(use|enable|disable)\s+electric\s+aux\s*heat\b/i.test(q)
  ) {
    const enable =
      /\b(turn|use|enable)\b\s+on?/.test(q) || /\b(use|enable)\b/i.test(q);
    const disable = /\b(turn\s+off|disable)\b/i.test(q);
    if (disable) return { action: "setUseElectricAuxHeat", value: false };
    if (enable) return { action: "setUseElectricAuxHeat", value: true };
  }
  // set cooling capacity explicitly
  if (/set\s+cooling\s+capacity\s+(?:to\s+)?(\d{1,2})k?/i.test(q)) {
    const m = q.match(/set\s+cooling\s+capacity\s+(?:to\s+)?(\d{1,2})k?/i);
    if (m) return { action: "setCoolingCapacity", value: Number(m[1]) };
  }
  // Heat loss source selection
  if (
    /(?:use|set\s+heat\s+loss\s+source\s+to|enable)\s+(?:manual|manually\s+entered)\s+heat\s+loss/i.test(
      q
    )
  ) {
    return { action: "setUseManualHeatLoss", value: true };
  }
  if (
    /(?:use|set\s+heat\s+loss\s+source\s+to|enable)\s+(?:calculated|doe|department\s+of\s+energy)\s+heat\s+loss/i.test(
      q
    )
  ) {
    return { action: "setUseCalculatedHeatLoss", value: true };
  }
  if (
    /(?:use|set\s+heat\s+loss\s+source\s+to|enable)\s+(?:analyzer|analyzer\s+data|csv|uploaded)\s+heat\s+loss/i.test(
      q
    )
  ) {
    return { action: "setUseAnalyzerHeatLoss", value: true };
  }
  // Manual heat loss value
  if (
    /set\s+manual\s+heat\s+loss\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:btu\/hr\/°f|btu\/hr\/deg|btu\/hr\/f)/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+manual\s+heat\s+loss\s+(?:to\s+)?(\d+(?:\.\d+)?)/i
    );
    if (m) return { action: "setManualHeatLoss", value: parseFloat(m[1]) };
  }
  // Analyzer heat loss value (read-only via parser, but can be set programmatically)
  if (
    /set\s+analyzer\s+heat\s+loss\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:btu\/hr\/°f|btu\/hr\/deg|btu\/hr\/f)/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+analyzer\s+heat\s+loss\s+(?:to\s+)?(\d+(?:\.\d+)?)/i
    );
    if (m) return { action: "setAnalyzerHeatLoss", value: parseFloat(m[1]) };
  }
  // Use detailed annual estimate
  if (/(?:use|enable|turn\s+on)\s+(?:detailed\s+)?annual\s+estimate/i.test(q)) {
    return { action: "setUseDetailedAnnualEstimate", value: true };
  }
  if (
    /(?:don'?t\s+use|disable|turn\s+off)\s+(?:detailed\s+)?annual\s+estimate/i.test(
      q
    )
  ) {
    return { action: "setUseDetailedAnnualEstimate", value: false };
  }
  // Voice listening duration
  if (
    /set\s+(?:voice\s+)?(?:listening\s+)?duration\s+(?:to\s+)?(\d+)\s*(?:seconds?|secs?)/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+(?:voice\s+)?(?:listening\s+)?duration\s+(?:to\s+)?(\d+)\s*(?:seconds?|secs?)/i
    );
    if (m) {
      const val = Math.max(2, Math.min(30, Number(m[1])));
      return { action: "setVoiceListenDuration", value: val };
    }
  }
  // Groq API Key (handle carefully - sensitive data)
  if (/set\s+groq\s+(?:api\s+)?key\s+(?:to\s+)?(gsk_[a-zA-Z0-9]+)/i.test(q)) {
    const m = q.match(
      /set\s+groq\s+(?:api\s+)?key\s+(?:to\s+)?(gsk_[a-zA-Z0-9]+)/i
    );
    if (m) return { action: "setGroqApiKey", value: m[1] };
  }
  // Groq Model
  if (
    /set\s+groq\s+model\s+(?:to\s+)?(llama-3\.\d+-\d+b-[a-z-]+|mixtral-\d+-\d+b-[a-z-]+)/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+groq\s+model\s+(?:to\s+)?(llama-3\.\d+-\d+b-[a-z-]+|mixtral-\d+-\d+b-[a-z-]+)/i
    );
    if (m) return { action: "setGroqModel", value: m[1] };
  }
  // Dark mode
  if (
    /(?:switch\s+to|enable|turn\s+on|use)\s+dark\s+mode/i.test(q) ||
    /dark\s+mode\s+on/i.test(q)
  ) {
    return { action: "setDarkMode", value: true };
  }
  if (
    /(?:switch\s+to|enable|turn\s+on|use)\s+light\s+mode/i.test(q) ||
    /dark\s+mode\s+off/i.test(q)
  ) {
    return { action: "setDarkMode", value: false };
  }
  if (/toggle\s+dark\s+mode/i.test(q)) {
    return { action: "toggleDarkMode" };
  }
  // Compressor min runtime (threshold)
  if (
    /set\s+compressor\s+(?:min\s+)?(?:runtime|cycle\s+off|min\s+cycle)\s+(?:to\s+)?(\d+)\s*(?:minutes?|mins?|min)/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+compressor\s+(?:min\s+)?(?:runtime|cycle\s+off|min\s+cycle)\s+(?:to\s+)?(\d+)\s*(?:minutes?|mins?|min)/i
    );
    if (m)
      return { action: "setCompressorMinRuntime", value: Number(m[1]) * 60 }; // Convert minutes to seconds
  }
  if (
    /set\s+compressor\s+(?:min\s+)?(?:runtime|cycle\s+off|min\s+cycle)\s+(?:to\s+)?(\d+)\s*(?:seconds?|secs?)/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+compressor\s+(?:min\s+)?(?:runtime|cycle\s+off|min\s+cycle)\s+(?:to\s+)?(\d+)\s*(?:seconds?|secs?)/i
    );
    if (m) return { action: "setCompressorMinRuntime", value: Number(m[1]) };
  }
  // Heat Differential
  if (/set\s+heat\s+differential\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*°?f?/i.test(q)) {
    const m = q.match(
      /set\s+heat\s+differential\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*°?f?/i
    );
    if (m) return { action: "setHeatDifferential", value: parseFloat(m[1]) };
  }
  // Cool Differential
  if (/set\s+cool\s+differential\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*°?f?/i.test(q)) {
    const m = q.match(
      /set\s+cool\s+differential\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*°?f?/i
    );
    if (m) return { action: "setCoolDifferential", value: parseFloat(m[1]) };
  }
  // Sleep mode schedule start time (12-hour format with PM/AM)
  if (
    /set\s+sleep\s+mode\s+(?:to\s+)?(?:start\s+at|begins?\s+at|starts?\s+at)\s+(\d{1,2})(?::(\d{2}))?\s*(pm|am)/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+sleep\s+mode\s+(?:to\s+)?(?:start\s+at|begins?\s+at|starts?\s+at)\s+(\d{1,2})(?::(\d{2}))?\s*(pm|am)/i
    );
    if (m) {
      let hours = Number(m[1]);
      const minutes = m[2] ? Number(m[2]) : 0;
      const ampm = m[3]?.toLowerCase();
      if (ampm === "pm" && hours !== 12) hours += 12;
      if (ampm === "am" && hours === 12) hours = 0;
      const timeStr = `${String(hours).padStart(2, "0")}:${String(
        minutes
      ).padStart(2, "0")}`;
      return { action: "setNighttimeStartTime", value: timeStr };
    }
  }
  // Sleep mode schedule start time (24-hour format)
  if (
    /set\s+sleep\s+mode\s+(?:to\s+)?(?:start\s+at|begins?\s+at|starts?\s+at)\s+(\d{1,2}):(\d{2})/i.test(
      q
    ) &&
    !/(am|pm)/i.test(q)
  ) {
    const m = q.match(
      /set\s+sleep\s+mode\s+(?:to\s+)?(?:start\s+at|begins?\s+at|starts?\s+at)\s+(\d{1,2}):(\d{2})/i
    );
    if (m) {
      const hours = Number(m[1]);
      const minutes = Number(m[2]);
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        const timeStr = `${String(hours).padStart(2, "0")}:${String(
          minutes
        ).padStart(2, "0")}`;
        return { action: "setNighttimeStartTime", value: timeStr };
      }
    }
  }
  // Set sleep time / bedtime (simpler patterns)
  if (
    /set\s+(?:sleep\s+time|bedtime|sleep\s+start)\s+(?:to\s+)?(\d{1,2})(?::(\d{2}))?\s*(pm|am)/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+(?:sleep\s+time|bedtime|sleep\s+start)\s+(?:to\s+)?(\d{1,2})(?::(\d{2}))?\s*(pm|am)/i
    );
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      const isPM = match[3].toLowerCase() === "pm";
      if (isPM && hours !== 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
      const timeStr = `${String(hours).padStart(2, "0")}:${String(
        minutes
      ).padStart(2, "0")}`;
      return { action: "setSleepTime", value: timeStr };
    }
  }
  if (
    /set\s+(?:sleep\s+time|bedtime|sleep\s+start)\s+(?:to\s+)?(\d{1,2}):(\d{2})/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+(?:sleep\s+time|bedtime|sleep\s+start)\s+(?:to\s+)?(\d{1,2}):(\d{2})/i
    );
    if (match) {
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        const timeStr = `${String(hours).padStart(2, "0")}:${String(
          minutes
        ).padStart(2, "0")}`;
        return { action: "setSleepTime", value: timeStr };
      }
    }
  }

  // Set wake time / wake up time
  if (
    /set\s+(?:wake\s+time|wake\s+up\s+time|wake\s+time)\s+(?:to\s+)?(\d{1,2})(?::(\d{2}))?\s*(pm|am)/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+(?:wake\s+time|wake\s+up\s+time|wake\s+time)\s+(?:to\s+)?(\d{1,2})(?::(\d{2}))?\s*(pm|am)/i
    );
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      const isPM = match[3].toLowerCase() === "pm";
      if (isPM && hours !== 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
      const timeStr = `${String(hours).padStart(2, "0")}:${String(
        minutes
      ).padStart(2, "0")}`;
      return { action: "setWakeTime", value: timeStr };
    }
  }
  if (
    /set\s+(?:wake\s+time|wake\s+up\s+time|wake\s+time)\s+(?:to\s+)?(\d{1,2}):(\d{2})/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+(?:wake\s+time|wake\s+up\s+time|wake\s+time)\s+(?:to\s+)?(\d{1,2}):(\d{2})/i
    );
    if (match) {
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        const timeStr = `${String(hours).padStart(2, "0")}:${String(
          minutes
        ).padStart(2, "0")}`;
        return { action: "setWakeTime", value: timeStr };
      }
    }
  }

  // Set nighttime temperature / sleep temperature
  if (
    /set\s+(?:nighttime|night|sleep)\s+temp(?:erature)?\s+(?:to\s+)?(\d{2})/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+(?:nighttime|night|sleep)\s+temp(?:erature)?\s+(?:to\s+)?(\d{2})/i
    );
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= 45 && temp <= 85) {
        return { action: "setNighttimeTemperature", value: temp };
      }
    }
  }

  // Set daytime temperature / home temperature
  if (
    /set\s+(?:daytime|day|home)\s+temp(?:erature)?\s+(?:to\s+)?(\d{2})/i.test(q)
  ) {
    const match = q.match(
      /set\s+(?:daytime|day|home)\s+temp(?:erature)?\s+(?:to\s+)?(\d{2})/i
    );
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= 45 && temp <= 85) {
        return { action: "setDaytimeTemperature", value: temp };
      }
    }
  }

  // Set daytime start time / wake time
  if (
    /set\s+(?:daytime|day|wake|home)\s+(?:start\s+)?time\s+(?:to\s+)?(\d{1,2}):?(\d{2})?\s*(am|pm)?/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+(?:daytime|day|wake|home)\s+(?:start\s+)?time\s+(?:to\s+)?(\d{1,2}):?(\d{2})?\s*(am|pm)?/i
    );
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      const period = (match[3] || "").toLowerCase();

      // Convert to 24-hour format
      if (period === "pm" && hours !== 12) hours += 12;
      if (period === "am" && hours === 12) hours = 0;

      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        const timeStr = `${String(hours).padStart(2, "0")}:${String(
          minutes
        ).padStart(2, "0")}`;
        return { action: "setDaytimeStartTime", value: timeStr };
      }
    }
  }

  // Undo commands
  if (/^undo\b|undo\s+last\s+change|revert\s+last\s+change/i.test(q)) {
    return { action: "undo", when: "last", isCommand: true };
  }
  if (/what\s+if.*?(\d+\.?\d*)\s*seer/i.test(q)) {
    const match = q.match(/what\s+if.*?(\d+\.?\d*)\s*seer/i);
    return { action: "whatIfSEER", value: parseFloat(match[1]) };
  }
  if (/break\s?[-\s]?even|payback/i.test(q)) {
    const match = q.match(/\$?(\d+[,\d]*)/);
    const cost = match ? parseInt(match[1].replace(/,/g, ""), 10) : 8000;
    return { action: "breakEven", cost };
  }

  // Helper: Check if this is a question (should not navigate)
  const isQuestion = /^(?:what|how|why|when|where|is|are|can|does|do|will|would|should|tell\s+me|explain|describe)/i.test(q.trim());
  
  // Navigation commands - comprehensive tool support
  // Only navigate if it's an explicit navigation intent, not a question
  // 1. 7-Day Cost Forecaster
  if (
    !isQuestion &&
    (/(?:open|show|go\s+to|navigate\s+to|view|see)\s+(?:the\s+)?(?:forecast|7\s*day|weekly|cost\s+forecast)/i.test(q) ||
     /(?:forecast|7\s*day|weekly)\s+(?:page|tool|calculator)/i.test(q)) &&
    !/thermostat/.test(qLower)
  ) {
    return { action: "navigate", target: "forecast" };
  }

  // 2. System Comparison (heat pump vs gas furnace)
  if (
    !isQuestion &&
    (/(?:open|show|go\s+to|navigate\s+to|view|see)\s+(?:the\s+)?(?:comparison|compare|vs|versus)/i.test(q) ||
     /(?:comparison|compare)\s+(?:page|tool|calculator)/i.test(q) ||
     /(?:heat\s*pump\s+vs|gas\s+vs)\s+(?:page|tool|calculator)/i.test(q))
  ) {
    return { action: "navigate", target: "comparison" };
  }

  // 3. Balance Point Analyzer / Energy Flow
  // Only navigate if it's explicitly about viewing/opening the page, not calculating
  if (
    /(?:open|show|go\s+to|view|see)\s+(?:the\s+)?(?:balance\s*point\s+)?(?:analyzer|page|graph|visualization)/i.test(q) ||
    /(?:energy\s+flow|performance\s+graph|visualiz)/i.test(q)
  ) {
    return { action: "navigate", target: "balance" };
  }
  // If just "balance point" without calculate/show/open, check if it's a calculation request
  if (/(?:balance\s*point)/i.test(q) && !/(?:calculate|show|tell\s+me|what\s+is)/i.test(q)) {
    // Default to showing the answer, not navigating (unless explicitly asked to open page)
    return { action: "offlineAnswer", type: "balancePoint", needsContext: true };
  }

  // 4. A/C Charging Calculator
  if (
    !isQuestion &&
    (/(?:open|show|go\s+to|navigate\s+to|view|see)\s+(?:the\s+)?(?:charging|subcool|refrigerant|charge\s+calculator|a\/?c\s+charg)/i.test(q) ||
     /(?:charging|charge\s+calculator)\s+(?:page|tool|calculator)/i.test(q))
  ) {
    return { action: "navigate", target: "charging" };
  }

  // 5. Performance Analyzer (thermal factor from thermostat data)
  if (
    !isQuestion &&
    (/(?:open|show|go\s+to|navigate\s+to|view|see)\s+(?:the\s+)?(?:performance\s+analyz|analyzer|upload\s+thermostat)/i.test(q) ||
     /(?:performance\s+analyz|analyzer)\s+(?:page|tool)/i.test(q) ||
     /upload\s+thermostat\s+(?:data|csv)/i.test(q))
  ) {
    return { action: "navigate", target: "analyzer" };
  }

  // 6. Calculation Methodology
  if (
    !isQuestion &&
    (/(?:open|show|go\s+to|navigate\s+to|view|see)\s+(?:the\s+)?(?:methodology|formula|math)/i.test(q) ||
     /(?:methodology|formula)\s+(?:page|document)/i.test(q))
  ) {
    return { action: "navigate", target: "methodology" };
  }

  // 7. Settings
  if (
    !isQuestion &&
    (/(?:open|show|go\s+to|navigate\s+to|view|see)\s+(?:the\s+)?(?:settings|preferences|configuration)/i.test(q) ||
     /(?:settings|preferences|configuration)\s+(?:page|menu)/i.test(q) ||
     /(?:adjust|change)\s+settings/i.test(q)) &&
    !/winter|summer|temp/.test(qLower)
  ) {
    return { action: "navigate", target: "settings" };
  }

  // 8. Thermostat Strategy Analyzer
  if (
    !isQuestion &&
    (/(?:open|show|go\s+to|navigate\s+to|view|see)\s+(?:the\s+)?(?:thermostat\s+(?:strategy|analyz)|setback\s+analyz)/i.test(q) ||
     /(?:thermostat\s+(?:strategy|analyz)|setback\s+analyz)\s+(?:page|tool)/i.test(q))
  ) {
    return { action: "navigate", target: "thermostat" };
  }

  // 9. Monthly Budget Planner
  if (
    !isQuestion &&
    (/(?:open|show|go\s+to|navigate\s+to|view|see)\s+(?:the\s+)?(?:monthly\s+budget|budget\s+plan)/i.test(q) ||
     /(?:monthly\s+budget|budget\s+plan)\s+(?:page|tool)/i.test(q))
  ) {
    return { action: "navigate", target: "budget" };
  }

  // 10. Contactor/Hardware Demo
  if (
    /(?:show|open|display)\s+(?:the\s+)?(?:contactor|hardware|relay)(?:\s+demo)?|(?:show|open)\s+hardware\s+demo/i.test(
      q
    )
  ) {
    return { action: "navigate", target: "contactors" };
  }

  // Energy usage queries
  if (
    /(?:how\s+much\s+energy|energy\s+used|electricity\s+used|kwh\s+used).*(?:last|past)\s+(\d+)\s+days?/i.test(
      q
    )
  ) {
    const match = q.match(/(?:last|past)\s+(\d+)\s+days?/i);
    return { action: "energyUsage", days: parseInt(match[1], 10) };
  }
  if (
    /(?:average\s+(?:daily\s+)?(?:energy|electricity|kwh)|daily\s+average|how\s+much.*per\s+day)/i.test(
      q
    )
  ) {
    return { action: "averageDaily" };
  }
  if (
    /(?:monthly\s+(?:cost|spend|bill)|how\s+much.*month|cost.*month)/i.test(q)
  ) {
    return { action: "monthlySpend" };
  }

  // Agentic multi-tool commands
  if (
    /(?:run|do|give|show)\s+(?:a\s+)?(?:comprehensive|complete|full)\s+(?:analysis|report|assessment|review)/i.test(
      q
    )
  ) {
    return { action: "fullAnalysis" };
  }

  if (
    /(?:analyze|check|inspect|review)\s+(?:my\s+)?(?:system|performance|efficiency)/i.test(
      q
    )
  ) {
    return { action: "systemAnalysis" };
  }

  if (
    /(?:show|tell)\s+(?:me\s+)?(?:the\s+)?(?:cost\s+)?forecast|(?:cost|expense|bill)\s+(?:forecast|prediction|estimate|next\s+week|this\s+week)/i.test(
      q
    )
  ) {
    return { action: "costForecast" };
  }

  if (
    /(?:all\s+my\s+savings|total\s+savings|how\s+much.*save|savings\s+potential|calculate.*savings)/i.test(
      q
    )
  ) {
    return { action: "savingsAnalysis" };
  }

  // Calculator queries
  if (
    /(?:calculate|check|what'?s?)\s+(?:my\s+)?(?:charging|subcool|superheat|target\s+subcool)/i.test(
      q
    )
  ) {
    // Extract refrigerant type if mentioned
    const refMatch = q.match(/r[-\s]?(\d{3}[a-z]?)/i);
    const refrigerant = refMatch ? `R-${refMatch[1].toUpperCase()}` : "R-410A";

    // Extract outdoor temp if mentioned
    const tempMatch = q.match(
      /(\d{2,3})\s*°?f?\s*(?:outdoor|outside|ambient)/i
    );
    const outdoorTemp = tempMatch ? parseInt(tempMatch[1], 10) : null;

    return {
      action: "calculateCharging",
      refrigerant,
      outdoorTemp,
    };
  }

  if (
    /(?:what'?s?\s+(?:my\s+)?(?:heat\s+loss|thermal)\s+factor|calculate.*performance|system\s+performance)/i.test(
      q
    )
  ) {
    return { action: "calculatePerformance" };
  }

  // Heat loss at specific temperature query
  // Matches: "What is my heat loss at 25 degrees?" or "heat loss at 30F" or "heat loss when it's 20°F"
  const heatLossTempMatch = q.match(
    /(?:what'?s?|what\s+is|calculate|show\s+me)\s+(?:my\s+)?(?:heat\s+loss|heat\s+loss\s+rate)\s+(?:at|when|when\s+it'?s?|when\s+outside\s+is)\s+(\d+)\s*°?\s*f?/i
  );
  if (heatLossTempMatch) {
    const outdoorTemp = parseInt(heatLossTempMatch[1], 10);
    if (outdoorTemp >= -20 && outdoorTemp <= 100) {
      return { action: "calculateHeatLoss", outdoorTemp };
    }
  }

  if (
    /(?:setback\s+savings|thermostat\s+(?:strategy|schedule)|how\s+much.*setback|savings.*setback)/i.test(
      q
    )
  ) {
    return { action: "calculateSetback" };
  }

  if (
    /(?:compare.*(?:heat\s+pump|gas)|heat\s+pump\s+vs|gas\s+vs|which\s+is\s+cheaper)/i.test(
      q
    )
  ) {
    return { action: "compareSystem" };
  }

  // CSV Data & Diagnostics queries - MUST come before broader patterns
  if (
    /(?:what\s+(?:problems?|issues?)|diagnostics?|check\s+(?:my\s+)?system|system\s+(?:problems?|issues?)|any\s+(?:problems?|issues?))/i.test(
      q
    )
  ) {
    return { action: "showDiagnostics" };
  }
  if (
    /(?:short\s+cycl|rapid\s+cycl|turning\s+on\s+and\s+off|cycl.*problem)/i.test(
      q
    )
  ) {
    return { action: "checkShortCycling" };
  }
  if (
    /(?:thermostat\s+data|csv\s+data|uploaded\s+data|my\s+data|data\s+file)/i.test(
      q
    )
  ) {
    return { action: "showCsvInfo" };
  }
  if (
    /(?:aux(?:iliary)?\s+heat|emergency\s+heat|backup\s+heat).*(?:problem|issue|high|excessive)/i.test(
      q
    )
  ) {
    return { action: "checkAuxHeat" };
  }
  if (/(?:temperature\s+swing|temp.*unstable|temperature.*fluctuat)/i.test(q)) {
    return { action: "checkTempStability" };
  }

  // 10. Upgrade ROI Analyzer
  if (
    !isQuestion &&
    (/(?:open|show|go\s+to|navigate\s+to|view|see)\s+(?:the\s+)?(?:upgrade|roi|return\s+on\s+investment)/i.test(q) ||
     /(?:upgrade|roi)\s+(?:page|tool|calculator)/i.test(q)) &&
    !qLower.includes("break")
  ) {
    return { action: "navigate", target: "roi" };
  }

  // Fallback: "show me" commands
  if (/show\s+(?:me\s+)?(.+)/i.test(q)) {
    const match = q.match(/show\s+(?:me\s+)?(.+)/i);
    const target = match[1].toLowerCase();
    if (target.includes("forecast"))
      return { action: "navigate", target: "forecast" };
    if (target.includes("compar"))
      return { action: "navigate", target: "comparison" };
    if (target.includes("balanc") || target.includes("flow"))
      return { action: "navigate", target: "balance" };
    if (target.includes("charg"))
      return { action: "navigate", target: "charging" };
    if (target.includes("analyz") || target.includes("performance"))
      return { action: "navigate", target: "analyzer" };
    if (target.includes("method") || target.includes("math"))
      return { action: "navigate", target: "methodology" };
    if (target.includes("setting"))
      return { action: "navigate", target: "settings" };
    if (target.includes("thermostat") || target.includes("setback"))
      return { action: "navigate", target: "thermostat" };
    if (target.includes("budget"))
      return { action: "navigate", target: "budget" };
    if (target.includes("upgrade") || target.includes("roi"))
      return { action: "navigate", target: "roi" };
    // If unknown, try to interpret as city for forecast
    return {
      action: "navigate",
      target: "forecast",
      cityName: match[1].trim(),
    };
  }

  // NOTE: Help, score, savings, and system status are handled at the top of this function
  // to ensure they work even when phrased as questions

  // Educational queries
  if (
    /(?:what\s+is|explain|tell\s+me\s+about|how\s+is.*calculated)\s+(hspf|seer|cop|hdd|cdd|insulation|aux\s*heat|energy\s+factor|thermal\s+factor|building\s+factor)/i.test(
      q
    )
  ) {
    const match = q.match(
      /(?:what\s+is|explain|tell\s+me\s+about|how\s+is.*calculated)\s+(hspf|seer|cop|hdd|cdd|insulation|aux\s*heat|energy\s+factor|thermal\s+factor|building\s+factor)/i
    );
    if (match) {
      let topic = match[1].toLowerCase().replace(/\s+/g, "");
      // Map energy factor variations to a known topic
      if (
        topic.includes("energyfactor") ||
        topic.includes("thermalfactor") ||
        topic.includes("buildingfactor")
      ) {
        topic = "thermalFactor"; // or create a new action for this
      }
      return { action: "educate", topic };
    }
  }
  // Energy factor / thermal factor calculation questions
  if (
    /(?:how\s+is|how\s+do\s+you\s+calculate|what\s+is)\s+(?:my\s+)?(?:home'?s?\s+)?(?:energy\s+factor|thermal\s+factor|building\s+factor)/i.test(
      q
    )
  ) {
    return { action: "educate", topic: "thermalFactor" };
  }
  if (/why.*?bill\s+(?:so\s+)?high|high\s+bill/i.test(q)) {
    return { action: "explainBill" };
  }
  if (/what'?s?\s+normal\s+(?:for|in)\s+([A-Za-z\s,]+)/i.test(q)) {
    const match = q.match(/what'?s?\s+normal\s+(?:for|in)\s+([A-Za-z\s,]+)/i);
    return { action: "normalForCity", cityName: match[1].trim() };
  }

  return null;
}

// Enhanced parsing with context
// Main parsing function - enhanced with context support
export function parseAskJoule(query, context = {}) {
  if (!query) return {};
  const q = String(query).trim();

  // Check for sales intent first (Presales RAG capability)
  if (hasSalesIntent(q)) {
    const salesMatch = searchSalesFAQ(q);
    if (salesMatch) {
      return {
        isSalesQuery: true,
        salesAnswer: salesMatch.answer,
        salesQuestion: salesMatch.question,
        salesCategory: salesMatch.category,
      };
    } else {
      // No match found - return fallback response
      return {
        isSalesQuery: true,
        salesAnswer: getSalesFallbackResponse(),
        salesFallback: true,
      };
    }
  }

  // Check for offline intelligence queries FIRST (before commands)
  // These work without API key and should be prioritized
  const offlineAnswer = calculateOfflineAnswer(q, context);
  if (offlineAnswer) {
    return { ...offlineAnswer, isCommand: true };
  }

  // Check for commands
  const command = parseCommandLocal(q, context);
  if (command) {
    return { ...command, isCommand: true };
  }

  // Original parsing logic for query extraction
  const squareFeet = parseSquareFeet(q);
  const indoorTemp = parseTemperature(q);
  const insulationLevel = parseInsulation(q);
  const primarySystem = parseSystem(q);
  const energyMode = parseMode(q);
  const cityName = parseCity(q);
  return {
    cityName,
    squareFeet,
    insulationLevel,
    indoorTemp,
    primarySystem,
    energyMode,
  };
}

// Backward compatible export - parseCommand is an alias for the command parsing logic
export function parseCommand(query, context = {}) {
  return parseCommandLocal(query);
}

export default parseAskJoule;
