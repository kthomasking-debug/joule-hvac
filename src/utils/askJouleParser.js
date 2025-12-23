/**
 * Consolidated Ask Joule Query Parser
 * Unified parser for natural language commands and queries
 *
 * ARCHITECTURE - Fast Commands, Smart Answers:
 *
 * 1. Regex Parser (parseCommandLocal)
 *    - Fast: 0ms latency, $0 cost
 *    - Accurate: 100% for simple commands like "set temp to 72"
 *    - Used FIRST for all commands
 *    - Handles 99% of command use cases
 *
 * 2. LLM Function Calling (llmIntentClassifier.js)
 *    - Used ONLY when regex fails but input looks like a command
 *    - Handles complex commands: "Set temp to 72 and turn on fan for 10 minutes"
 *    - Extracts intent and parameters using structured function calling
 *
 * 3. LLM Question Answering (answerWithAgent)
 *    - Used for questions: "Why is my bill high?"
 *    - Needs context, synthesis, and reasoning
 *    - Only called when input is NOT a command
 *
 * FLOW:
 * Input → Regex (is this a command?)
 *   → Yes: Execute immediately
 *   → No: Looks like command? → LLM Function Calling
 *   → No: It's a question → LLM Question Answering
 *
 * Exported functions: parseAskJoule, parseCommand, parseCommandLocal
 */

// Lazy load RAG data - only fetch when actually needed
// This prevents loading massive knowledge bases on startup
let salesFAQModule = null;
let funResponsesModule = null;
let salesFAQLoading = null;
let funResponsesLoading = null;

async function loadSalesFAQ() {
  if (salesFAQModule) return salesFAQModule;
  if (salesFAQLoading) return salesFAQLoading;
  salesFAQLoading = import("./rag/salesFAQ.js")
    .then((module) => {
      // Ensure we have the module with all exports
      if (module && (module.hasSalesIntent || module.default)) {
        salesFAQModule = module.default || module;
      } else {
        salesFAQModule = module;
      }
      salesFAQLoading = null;
      return salesFAQModule;
    })
    .catch((error) => {
      console.warn("Failed to load sales FAQ module", error);
      salesFAQLoading = null;
      return null;
    });
  return salesFAQLoading;
}

async function loadFunResponses() {
  if (funResponsesModule) return funResponsesModule;
  if (funResponsesLoading) return funResponsesLoading;
  funResponsesLoading = import("./rag/funResponses.js").then((module) => {
    funResponsesModule = module;
    funResponsesLoading = null;
    return module;
  });
  return funResponsesLoading;
}

// Preload RAG data in background after a delay (non-blocking)
if (typeof window !== "undefined") {
  setTimeout(() => {
    loadSalesFAQ().catch(() => {});
    loadFunResponses().catch(() => {});
  }, 2000); // Load 2 seconds after app starts
}

// Map common words to insulation coefficients
const INSULATION_MAP = {
  poor: 1.4,
  average: 1.0,
  typical: 1.0,
  good: 0.65,
};

// Temperature limits - used throughout parser for validation
const TEMP_LIMITS = {
  MIN: 45, // Minimum valid temperature (°F)
  MAX: 85, // Maximum valid temperature (°F)
  MIN_EXTENDED: 40, // Extended minimum (for some commands)
  MAX_EXTENDED: 100, // Extended maximum (for some commands)
  MIN_OUTDOOR: -20, // Minimum outdoor temperature
  MAX_OUTDOOR: 60, // Maximum outdoor temperature
  MIN_AUX_LOCKOUT: 20, // Minimum aux heat lockout
  MAX_AUX_LOCKOUT: 50, // Maximum aux heat lockout
};

// Common regex pattern components - extracted for maintainability
// These patterns are used repeatedly throughout the parser
const REGEX_PATTERNS = {
  // Temperature-related keywords
  TEMP_KEYWORDS: "(?:temp|temperature|thermostat)",

  // Common prefixes for commands
  SET_PREFIX: "(?:set|change)\\s+(?:my\\s+|the\\s+)?",
  MAKE_PREFIX: "(?:make|turn)\\s+(?:it|the)?\\s*",

  // Temperature value patterns
  TEMP_VALUE: "(\\d{2})", // Two-digit temperature
  TEMP_VALUE_EXTENDED: "(\\d{2,3})", // Two or three-digit temperature

  // Mode keywords
  MODE_KEYWORDS: "(?:heat|cool|auto|off)",

  // Action verbs
  ACTION_VERBS:
    "(?:set|change|make|turn|switch|activate|enable|disable|drop|lower|raise|increase|decrease|optimize|keep|put|run|stop|start|reset|undo|use|show|tell|explain|calculate|check|analyze|adjust|bump)",

  // Question words
  QUESTION_WORDS:
    "(?:how|what|why|when|where|who|which|can\\s+i|should\\s+i|do\\s+i|does|is|are|will|would|could|can\\s+you)",

  // Polite prefixes
  POLITE_PREFIX: "(?:can\\s+you\\s+|please\\s+)?",

  // Time patterns
  TIME_12H: "(\\d{1,2})\\s*(am|pm)",
  TIME_24H: "(\\d{1,2}):(\\d{2})",

  // Square footage keywords
  SQFT_KEYWORDS: "(?:sq\\s*?ft|square\\s*feet|sf|sq\\.\\s*ft\\.?)",
};

/**
 * Pattern builder functions - construct regex patterns from components
 * This makes patterns more maintainable and readable
 */
function buildSetTempPattern(includePolite = false) {
  const polite = includePolite ? REGEX_PATTERNS.POLITE_PREFIX : "";
  return new RegExp(
    `${polite}${REGEX_PATTERNS.SET_PREFIX}${REGEX_PATTERNS.TEMP_KEYWORDS}(?:\\s+to)?\\s+${REGEX_PATTERNS.TEMP_VALUE}\\b`,
    "i"
  );
}

function buildModePattern() {
  // Mode pattern with capture group for the mode value
  return new RegExp(
    `(?:set\\s+(?:it|mode|thermostat|system)\\s+to|switch\\s+to|change\\s+to|turn\\s+on)\\s+(${REGEX_PATTERNS.MODE_KEYWORDS})\\b`,
    "i"
  );
}

function parseSquareFeet(q) {
  // Matches: 2,000 sq ft | 1800 square feet | 1.8k sf | 2200sqft | 2.3ksqft | squarefeet (one word)
  // Pattern 1: With space: "2,000 sq ft", "1800 square feet", "1.8k sf"
  let re =
    /((?:\d{1,3}(?:,\d{3})+)|\d{3,6}|\d+(?:\.\d+)?\s*k)\s+(?:sq\s*?ft|square\s*feet|sf|sq\.\s*ft\.?)\b/i;
  let m = q.match(re);
  if (m) {
    let raw = m[1].toLowerCase().replace(/,/g, "").trim();
    if (raw.endsWith("k")) {
      const n = parseFloat(raw.slice(0, -1));
      if (!isNaN(n)) return Math.round(n * 1000);
    }
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) return n;
  }

  // Pattern 2: No space: "2200sqft", "2.3ksqft", "1800squarefeet", "2,100sq ft", "2k sqft"
  // Handle comma-separated numbers: "2,100sqft", "2,100sq ft"
  // Also handle "2k sqft" (k with optional space before sqft)
  re =
    /(\d{1,3}(?:,\d{3})+|\d{3,6}|\d+(?:\.\d+)?)\s*k(?:\s+)?(?:sqft|squarefeet|sf)/i;
  m = q.match(re);
  if (m) {
    let raw = m[1].toLowerCase().replace(/,/g, "").trim();
    if (raw.endsWith("k")) {
      const n = parseFloat(raw.slice(0, -1));
      if (!isNaN(n)) return Math.round(n * 1000);
    }
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) return n;
  }

  // Pattern 3: "square foot" (singular)
  re = /((?:\d{1,3}(?:,\d{3})+)|\d{3,6}|\d+(?:\.\d+)?\s*k)\s+square\s+foot\b/i;
  m = q.match(re);
  if (m) {
    let raw = m[1].toLowerCase().replace(/,/g, "").trim();
    if (raw.endsWith("k")) {
      const n = parseFloat(raw.slice(0, -1));
      if (!isNaN(n)) return Math.round(n * 1000);
    }
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) return n;
  }

  return undefined;
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
  // "City ST" (no comma) - e.g., "Dallas TX", "Miami,FL"
  const cityStateNoComma = q.match(
    /(?:^|\s|in\s+)([A-Z][A-Za-z.\s-]+?)\s+([A-Z]{2})\b/
  );
  if (
    cityStateNoComma &&
    !/(?:set|to|at|turn|change|make)/i.test(cityStateNoComma[1])
  ) {
    return `${cityStateNoComma[1].trim()} ${cityStateNoComma[2]}`;
  }
  // Fallback: "in City" form (stop at comma or common keywords/numbers)
  const inCity = q.match(
    /\bin\s+([A-Za-z.\s-]+?)(?:,|\s+(?:at|to|set|with|for|on|keep|good|poor|excellent|bad|\d|$))/i
  );
  if (inCity) return inCity[1].trim();
  // Start-of-string city heuristic: leading capitalized words before a stop word
  const startCity = q.match(
    /^([A-Z][A-Za-z.-]*(?:\s+[A-Z][A-Za-z.-]*)*)\b(?=\s+(?:keep|set|at|to|with|for|on|turn|change|make|\d|$))/
  );
  if (startCity && !/(?:set|to|at|turn|change|make)/i.test(startCity[1])) {
    return startCity[1].trim();
  }
  return undefined;
}

// Offline Intelligence Knowledge Base (RAG Lite)
const OFFLINE_KNOWLEDGE = {
  "short cycling":
    "Short cycling occurs when your HVAC system turns on and off too frequently (typically less than 5 minutes). This wastes energy, increases wear, and reduces efficiency. Common causes: oversized equipment, incorrect differential settings, or thermostat placement issues.",
  setback:
    "A setback is lowering your thermostat temperature during unoccupied hours (typically 1-2°F for 8 hours). Lowering the temp by 1°F for 8 hours saves approximately 1% on heating costs. Nighttime setbacks are especially effective.",
  differential:
    "A differential (dead band) is the temperature range where your HVAC doesn't run. Standard is 0.5°F. Joule recommends 1.0°F for efficiency - it reduces short cycling and saves energy while maintaining comfort.",
  "weather models":
    "The Big 4 weather models are: EC (European Centre/ECMWF) - most accurate globally, CMC (Canadian Meteorological Centre) - excellent for North America, GEFS (Global Ensemble Forecast System) - NOAA's ensemble with 30+ members, and AI ensembles (machine learning models like GraphCast, FourCastNet). Joule uses NWS (National Weather Service) forecasts which blend these models for US locations. Ensemble forecasts average multiple model runs to reduce uncertainty.",
  "weather model":
    "The Big 4 weather models are: EC (European Centre/ECMWF) - most accurate globally, CMC (Canadian Meteorological Centre) - excellent for North America, GEFS (Global Ensemble Forecast System) - NOAA's ensemble with 30+ members, and AI ensembles (machine learning models like GraphCast, FourCastNet). Joule uses NWS (National Weather Service) forecasts which blend these models for US locations. Ensemble forecasts average multiple model runs to reduce uncertainty.",
  "EC model":
    "EC (European Centre for Medium-Range Weather Forecasts, ECMWF) is considered the most accurate global weather model. It uses advanced data assimilation and has the highest resolution. Often used as the gold standard for forecast accuracy.",
  "CMC model":
    "CMC (Canadian Meteorological Centre) is Canada's weather model, excellent for North American forecasts. It's part of the Global Environmental Multiscale (GEM) model system and performs well for continental weather patterns.",
  GEFS: "GEFS (Global Ensemble Forecast System) is NOAA's ensemble forecast system with 30+ ensemble members. It runs multiple model variations to show forecast uncertainty and probability. More reliable than single-model forecasts because it accounts for model uncertainty.",
  "AI ensemble":
    "AI ensembles use machine learning models like Google's GraphCast, NVIDIA's FourCastNet, and Huawei's Pangu-Weather. These models learn patterns from historical weather data and can be faster than traditional physics-based models, but may struggle with extreme events not seen in training data.",
  "defrost cycle":
    "Your heat pump is likely in Defrost Mode. It has to run in AC mode for a few minutes to melt ice off the outdoor unit. The backup heat should kick in momentarily. This is normal operation.",
  "balance point":
    "If your system is running but the temperature isn't going up, you've likely reached your Balance Point - the outdoor temperature where your heat pump's capacity equals your home's heat loss. At this point, the system runs continuously but can't raise the temperature. Consider using auxiliary heat if you're cold.",
  "filter importance":
    "Yes, you need to change the filter. A dirty filter increases static pressure, which overheats your blower motor and can crack your heat exchanger. A $20 filter saves a $2,000 repair. Change it every 1-3 months depending on usage.",
  "filter recommendation":
    "Get a MERV 8 filter. Do not buy MERV 13 unless you have a 4-inch media cabinet. MERV 13 restricts airflow too much for standard 1-inch slots and can damage your system.",
  "reversing valve":
    "That 'swoosh' sound is the Reversing Valve shifting pressure during a Defrost Cycle. It's the sound of your heat pump working correctly. This happens when the system switches from heating to cooling mode to defrost the outdoor coil.",
  "stack effect":
    "Heat rises. Your system likely doesn't have zone dampers. The upstairs gets hot because warm air naturally rises (stack effect/stratification). Try running the fan on 'On' instead of 'Auto' to mix the air between floors.",
  // Note: Weather terminology (SSW, Polar Vortex, AO, NAO, PNA, MJO, dew point, wet bulb, enthalpy, psychrometrics, HDD, CDD)
  // is handled natively by Llama 3.3 70B - no need for dictionary definitions.
  // RAG is used only for current forecast data (via getForecastData).
};

// Offline Intelligence Calculator Functions
// Note: query should be cleaned (lowercase, trimmed) before being passed to this function
function calculateOfflineAnswer(query) {
  // Normalize query to lowercase for pattern matching
  const q = query.toLowerCase().trim();

  // 1. State of the Union (Data Fetching)
  // Only match queries asking for CURRENT temperature, not "what temperature should X be"
  // Match: "what's the temperature", "what's the current temp", "how hot is it"
  // Don't match: "at what temperature should", "what temperature should X be", "what temperature is recommended"
  // Check for "should" or "recommended" first - these are knowledge questions, not current temp queries
  if (
    /(?:at\s+)?what\s+temp(?:erature)?\s+should/.test(q) ||
    /what\s+temp(?:erature)?\s+(?:is\s+)?(?:recommended|optimal|best)/.test(q)
  ) {
    // This is a knowledge question, let it go to the Groq agent
    return null;
  }
  if (
    /what'?s?\s+(?:the\s+)?(?:current\s+)?(?:temp|temperature)(?:\s+now)?\s*[?]?$/.test(
      q
    ) ||
    /how\s+(?:hot|cold|warm)\s+is\s+(?:it|the\s+room)/.test(q) ||
    /(?:current|right\s+now|now)\s+(?:temp|temperature)/.test(q)
  ) {
    return { action: "offlineAnswer", type: "temperature", needsContext: true };
  }
  if (/^is\s+the\s+heat\s+on\s*[?]?$/.test(q)) {
    return { action: "queryHvacStatus" };
  }
  if (/is\s+(?:the\s+)?(?:heat|hvac)\s+(?:on|running)/.test(q)) {
    return { action: "offlineAnswer", type: "hvacStatus", needsContext: true };
  }
  // Handle all humidity queries as offline answers for consistency
  if (
    /^what\s+is\s+the\s+humidity\s*[?]?$/.test(q) ||
    /^what'?s?\s+(?:my\s+)?(?:humidity|relative\s+humidity)\s*[?]?$/.test(q)
  ) {
    return { action: "offlineAnswer", type: "humidity", needsContext: true };
  }
  if (/what'?s?\s+(?:the\s+)?(?:current\s+)?humidity/.test(q)) {
    return { action: "offlineAnswer", type: "humidity", needsContext: true };
  }
  if (/what'?s?\s+(?:my\s+)?balance\s+point/.test(q)) {
    return {
      action: "offlineAnswer",
      type: "balancePoint",
      needsContext: true,
    };
  }
  if (
    /(?:calculate|show|tell\s+me|what\s+is)\s+(?:my\s+)?balance\s+point/.test(q)
  ) {
    return {
      action: "offlineAnswer",
      type: "balancePoint",
      needsContext: true,
    };
  }

  // Filter/Coil Efficiency Questions
  // Match questions about dirty filters/coils causing efficiency issues
  // Also match statements like "my coils are iced up"
  // Must be recognized as commands (isCommand: true)
  if (
    /(?:could|can|would|does|is)\s+(?:a\s+)?(?:dirty|clogged|filthy|old|worn)\s+(?:filter|air\s+filter|furnace\s+filter|hvac\s+filter)/.test(
      q
    ) ||
    /(?:could|can|would|does|is)\s+(?:the|a|my)\s+(?:filter|air\s+filter|furnace\s+filter|hvac\s+filter)\s+(?:be\s+)?(?:clogged|dirty|filthy|old|worn)/.test(
      q
    ) || // "could the filter be clogged" (note: cleanInput removes "could" so this won't match after cleaning)
    /^(?:the|a|my)\s+(?:filter|air\s+filter|furnace\s+filter|hvac\s+filter)\s+(?:be\s+)?(?:clogged|dirty|filthy|old|worn)/.test(
      q
    ) || // "the filter be clogged" (after cleanInput removes "could")
    /(?:why|how)\s+(?:am\s+i|do\s+i)\s+using\s+so\s+much\s+energy.*filter/i.test(q) ||
    /dirty\s+(?:fliter|filter).*question/i.test(q) ||
    /(?:could|can|would|does|is)\s+(?:a\s+)?(?:dirty|clogged|filthy|iced|frozen)\s+(?:coil|evaporator\s+coil|condenser\s+coil|indoor\s+coil|outdoor\s+coil)/.test(
      q
    ) ||
    /(?:my|the)\s+(?:coils?|filter).*?(?:are|is)\s+(?:iced\s+up|frozen|dirty|clogged)/i.test(
      q
    ) ||
    /(?:dirty|clogged|filthy)\s+(?:filter|coil).*?(?:cause|explain|affect|impact|reduce|lower|decrease|hurt|waste|increase\s+energy|use\s+more\s+energy|efficiency|performance)/.test(
      q
    ) ||
    /(?:why|how).*?(?:using\s+more\s+energy|energy\s+usage|efficiency\s+drop|working\s+harder|consuming\s+more).*?(?:filter|coil)/.test(
      q
    ) ||
    /(?:filter|coil).*?(?:explain|cause|why).*?(?:more\s+energy|efficiency|kwh|energy\s+usage)/.test(
      q
    )
  ) {
    return {
      action: "offlineAnswer",
      type: "filterCoilEfficiency",
      isCommand: true,
      needsContext: true,
    };
  }
  if (/how\s+much\s+did\s+i\s+spend\s+yesterday/.test(q)) {
    return {
      action: "offlineAnswer",
      type: "yesterdayCost",
      needsContext: true,
    };
  }

  // 2. Pre-Canned Engineering Knowledge
  // Short cycling - catch general knowledge questions, but NOT specific problem questions
  // Match: "what causes short cycling", "what is short cycling", "explain short cycling", "short cycling???"
  // Don't match: "why is my system short cycling" (specific problem - needs LLM context)
  // Must check this BEFORE other short cycling patterns - check for question marks first
  // Note: cleanInput removes trailing ? so "short cycling???" becomes "short cycling"
  // So we need to match standalone "short cycling" as a knowledge question
  if (
    /^short\s+cycl.*\?+$/i.test(q) || // "short cycling???" with question marks (if not cleaned yet)
    /^short\s+cycl(?:ing)?\s*$/i.test(q) || // "short cycling" or "short cycle" as standalone phrase (after cleaning)
    (/^what\s+(?:is|causes?|does)\s+short\s+cycl/.test(q) ||
      /^explain\s+short\s+cycl/.test(q) ||
      (/short\s+cycl/.test(q) && /^what\s+(?:is|causes?)/.test(q))) &&
    !/^(?:why|how)\s+(?:is|are|does)\s+(?:my|the|your)/.test(q) && // Exclude "why is my..." questions
    !/(?:my|the|your|this|system|furnace|ac|unit)\s+short\s+cycl/i.test(q) // Exclude "my system short cycling" (specific problem)
  ) {
    return {
      action: "offlineAnswer",
      type: "knowledge",
      isCommand: true,
      answer: OFFLINE_KNOWLEDGE["short cycling"],
    };
  }
  // Setback - catch more variations including "how does a setback save money"
  if (
    /(?:why|how|what|should)\s+(?:should\s+)?i\s+use\s+(?:a\s+)?setback/.test(
      q
    ) ||
    /(?:how|what|why)\s+does?\s+(?:a\s+)?setback/.test(q) ||
    /(?:what|explain)\s+(?:is|is\s+a)\s+setback/.test(q)
  ) {
    return {
      action: "offlineAnswer",
      type: "knowledge",
      answer: OFFLINE_KNOWLEDGE["setback"],
    };
  }
  // Differential - catch more variations
  if (
    /(?:what|which|how|should)\s+(?:is|should|do|can)\s+(?:i\s+use\s+)?(?:a\s+)?(?:good\s+)?differential/.test(
      q
    ) ||
    /(?:what|explain)\s+(?:is|is\s+a)\s+(?:good\s+)?differential/.test(q) ||
    /(?:optimal|best)\s+differential/.test(q)
  ) {
    return {
      action: "offlineAnswer",
      type: "knowledge",
      answer: OFFLINE_KNOWLEDGE["differential"],
    };
  }
  // Defrost cycle questions - catch more variations including "what does defrost mode mean"
  if (
    /(?:what|why|how|explain)\s+(?:is|does|do)\s+(?:a\s+)?(?:defrost\s+cycle|defrost\s+mode)/.test(
      q
    ) ||
    /(?:what|explain)\s+(?:does|is)\s+(?:defrost\s+cycle|defrost\s+mode)\s+(?:mean|do)/.test(
      q
    ) ||
    (/(?:defrost\s+cycle|defrost\s+mode)/.test(q) &&
      /(?:what|why|how|explain|mean)/.test(q))
  ) {
    return {
      action: "offlineAnswer",
      type: "knowledge",
      answer: OFFLINE_KNOWLEDGE["defrost cycle"],
    };
  }
  // Balance point questions - catch "what is balance point" (without "a")
  if (
    /(?:what|explain)\s+(?:is|is\s+a)\s+(?:balance\s+point|balance\s+point\s+temp)/.test(
      q
    ) ||
    /^what\s+is\s+balance\s+point/.test(q) ||
    /(?:what|explain)\s+balance\s+point/.test(q)
  ) {
    return {
      action: "offlineAnswer",
      type: "knowledge",
      answer: OFFLINE_KNOWLEDGE["balance point"],
    };
  }
  // Filter questions - catch "which filter should I buy" but NOT "how often should I change my filter" (that's a question for LLM)
  if (
    /(?:which|what)\s+(?:filter|air\s+filter)\s+(?:should|do|can)\s+i\s+(?:buy|get|use)/.test(
      q
    )
  ) {
    return {
      action: "offlineAnswer",
      type: "knowledge",
      answer: OFFLINE_KNOWLEDGE["filter recommendation"],
    };
  }
  // Reversing valve questions
  if (
    /(?:what|why|explain)\s+(?:is|does)\s+(?:a\s+)?(?:reversing\s+valve|swoosh\s+sound)/.test(
      q
    )
  ) {
    return {
      action: "offlineAnswer",
      type: "knowledge",
      answer: OFFLINE_KNOWLEDGE["reversing valve"],
    };
  }
  // Stack effect questions
  if (
    /(?:why|how)\s+(?:is|are)\s+(?:the\s+)?(?:upstairs|second\s+floor)\s+(?:so\s+)?(?:hot|cold)/.test(
      q
    ) ||
    /(?:what|explain)\s+(?:is|is\s+the)\s+(?:stack\s+effect|stratification)/.test(
      q
    )
  ) {
    return {
      action: "offlineAnswer",
      type: "knowledge",
      answer: OFFLINE_KNOWLEDGE["stack effect"],
    };
  }

  // Weather model questions - only match explicit questions about models themselves
  // Don't match questions about weather events that happen to mention models
  const isExplicitModelQuestion =
    /(?:what|explain|tell\s+me\s+about|how\s+do|what\s+are)\s+(?:the\s+)?(?:big\s+4|weather\s+models?|forecast\s+models?)/.test(
      q
    ) ||
    /\b(?:EC|CMC|GEFS)\s+(?:model|forecast)/.test(q) ||
    /(?:AI\s+ensemble|machine\s+learning\s+model)/.test(q) ||
    /weather\s+model\s+(?:is|are|work|used|use)/.test(q);

  if (isExplicitModelQuestion) {
    if (/\bEC\b/.test(q) && !/(?:CMC|GEFS|AI)/.test(q)) {
      return {
        action: "offlineAnswer",
        type: "knowledge",
        answer: OFFLINE_KNOWLEDGE["EC model"],
      };
    }
    if (/\bCMC\b/.test(q) && !/(?:EC|GEFS|AI)/.test(q)) {
      return {
        action: "offlineAnswer",
        type: "knowledge",
        answer: OFFLINE_KNOWLEDGE["CMC model"],
      };
    }
    if (/\bGEFS\b/.test(q) && !/(?:EC|CMC|AI)/.test(q)) {
      return {
        action: "offlineAnswer",
        type: "knowledge",
        answer: OFFLINE_KNOWLEDGE["GEFS"],
      };
    }
    if (/(?:AI\s+ensemble|machine\s+learning\s+model)/.test(q)) {
      return {
        action: "offlineAnswer",
        type: "knowledge",
        answer: OFFLINE_KNOWLEDGE["AI ensemble"],
      };
    }
    // Default to general weather models answer
    return {
      action: "offlineAnswer",
      type: "knowledge",
      answer: OFFLINE_KNOWLEDGE["weather models"],
    };
  }

  // Weather terminology questions (SSW, Polar Vortex, AO, NAO, PNA, MJO, dew point, wet bulb, etc.)
  // Note: These are now handled natively by Llama 3.3 70B - no offline dictionary needed.
  // The LLM understands meteorology jargon from training. RAG is used only for current forecast data.

  // 3. Calculator Queries
  const celsiusMatch = q.match(
    /convert\s+(\d+(?:\.\d+)?)\s+celsius\s+to\s+fahrenheit/
  );
  if (celsiusMatch) {
    const c = parseFloat(celsiusMatch[1]);
    const f = (c * 9) / 5 + 32;
    return {
      action: "offlineAnswer",
      type: "calculator",
      answer: `${c}°C = ${f.toFixed(1)}°F`,
    };
  }
  const fahrenheitMatch = q.match(
    /convert\s+(\d+(?:\.\d+)?)\s+fahrenheit\s+to\s+celsius/
  );
  if (fahrenheitMatch) {
    const f = parseFloat(fahrenheitMatch[1]);
    const c = ((f - 32) * 5) / 9;
    return {
      action: "offlineAnswer",
      type: "calculator",
      answer: `${f}°F = ${c.toFixed(1)}°C`,
    };
  }
  const btuMatch = q.match(/how\s+many\s+btus?\s+is\s+(\d+(?:\.\d+)?)\s+tons?/);
  if (btuMatch) {
    const tons = parseFloat(btuMatch[1]);
    const btus = tons * 12000;
    return {
      action: "offlineAnswer",
      type: "calculator",
      answer: `${tons} ton${
        tons !== 1 ? "s" : ""
      } = ${btus.toLocaleString()} BTU/hr`,
    };
  }
  const costMatch = q.match(
    /if\s+i\s+pay\s+(\d+(?:\.\d+)?)\s+cents?\s+per\s+kwh,?\s+how\s+much\s+is\s+(\d+(?:\.\d+)?)\s+kwh/
  );
  if (costMatch) {
    const rateCents = parseFloat(costMatch[1]);
    const kwh = parseFloat(costMatch[2]);
    const cost = (rateCents / 100) * kwh;
    return {
      action: "offlineAnswer",
      type: "calculator",
      answer: `${kwh} kWh at ${rateCents}¢/kWh = $${cost.toFixed(2)}`,
    };
  }

  // 4. System Status Checks
  if (/is\s+(?:my\s+)?firmware\s+up\s+to\s+date/.test(q)) {
    return { action: "offlineAnswer", type: "systemStatus", check: "firmware" };
  }
  if (/is\s+(?:the\s+)?bridge\s+connected/.test(q)) {
    return { action: "offlineAnswer", type: "systemStatus", check: "bridge" };
  }
  // More flexible pattern to catch variations like "when was your last data update"
  // Matches: "when was your/the/my/a last data update" or "when was last data update"
  if (
    /when\s+was\s+(?:your|the|my|a)?\s*last\s+data\s+update/.test(q) ||
    /when\s+was\s+the\s+last\s+update/.test(q) ||
    /when\s+was\s+your\s+last\s+update/.test(q)
  ) {
    return {
      action: "offlineAnswer",
      type: "systemStatus",
      check: "lastUpdate",
    };
  }

  // 5. Easter Egg - but this should NOT be a command (isCommand: false)
  // Return null so it goes to LLM instead
  if (/open\s+(?:the\s+)?pod\s+bay\s+doors/.test(q)) {
    return null; // Not a command, let LLM handle it
  }

  return null;
}

/**
 * Clean and normalize user input
 * Removes polite prefixes, wake words, and other fluff that confuses command parsing
 * Also adds basic input validation for security
 */
function cleanInput(q) {
  if (!q) return "";

  // Input validation: limit length to prevent DoS attacks
  const MAX_INPUT_LENGTH = 500;
  if (q.length > MAX_INPUT_LENGTH) {
    q = q.substring(0, MAX_INPUT_LENGTH);
  }

  let clean = String(q).toLowerCase().trim();

  // Remove Wake Words
  clean = clean.replace(/^(hey|hi|ok|hello)\s+joule\s*,?\s*/i, "");

  // Remove Polite Prefixes (The "Can you" trap)
  // We turn "Can you set..." into "set..."
  clean = clean.replace(/^(can|could|will|would|please)\s+(you\s+)?/i, "");

  // Remove trailing punctuation that might confuse parsing
  clean = clean.replace(/[.!?]+$/, "");

  // Remove null bytes and other control characters (security)
  // Use String.fromCharCode to avoid linter issues with control chars in regex
  const controlChars = Array.from({ length: 32 }, (_, i) =>
    String.fromCharCode(i)
  ).concat([String.fromCharCode(127)]);
  controlChars.forEach((char) => {
    clean = clean.replace(
      new RegExp(char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
      ""
    );
  });

  return clean.trim();
}

/**
 * Check if input is an instructional question (How do I...)
 * These should NOT be treated as commands
 */
function _isInstructionalQuestion(cleanedQuery) {
  if (!cleanedQuery) return false;

  // Check for instructional intent patterns
  // "How do I set..." -> instructional (question)
  // "Set the temp..." -> not instructional (command)
  const isInstruction =
    /^(how|why|when|where|should)\s+(do|can|should|would|is|are|does|did)/i.test(
      cleanedQuery
    );

  // Exception: "What if..." is a scenario command, not a question
  if (/^what\s+if/i.test(cleanedQuery)) {
    return false; // This is a scenario command
  }

  return isInstruction;
}

/**
 * OFFLINE PARSER - The Backup Brain (Lizard Brain)
 *
 * This is the regex-based parser (Regex Hell) - 1200+ lines of pattern matching.
 *
 * Purpose: Pattern Matching for offline operation
 * - Pi Zero Bridge ($129 tier) - runs offline, no Groq API access
 * - Fallback when LLM classification fails or API key unavailable
 *
 * Evolution:
 * - BEFORE: Pattern Matching (this function) - Lizard Brain
 * - AFTER: Semantic Understanding (llmIntentClassifier.js) - Human Brain
 *
 * This function is also referenced in offlineParser.js for documentation.
 * Keep this code - the Bridge needs it to function offline.
 *
 * See: offlineParser.js for architecture documentation
 */
function parseCommandLocal(query, context = {}) {
  if (!query) return null;

  // Step 1: Clean the input (Polite Stripper)
  // Note: parseAskJoule already cleans the input, but we clean again here
  // in case this function is called directly (for backward compatibility)
  const cleaned = cleanInput(query);
  if (!cleaned) return null;

  const q = cleaned;
  const qLower = q.toLowerCase();

  // Context is available for future use (e.g., user settings, location)
  // Currently unused in regex parser but kept for API compatibility
  void context; // Suppress lint warning - context reserved for future enhancements

  // === FAST-PATH ROUTING (Future Optimization) ===
  // TODO: Route to specific pattern groups based on first word to improve performance
  // This would avoid testing all 100+ patterns for every query
  // Example: if (q.startsWith('set ')) { /* only test set patterns */ }
  // For now, we continue with full pattern matching for accuracy

  // === HIGH-PRIORITY LOCAL COMMANDS ===
  // Check commands FIRST before fun responses
  // This prevents fun response fallbacks from intercepting valid commands
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
  // Only match explicit savings queries, not general "how can I save money" questions
  // Match: "how much can I save", "what can I save", "show me savings"
  // Don't match: "how can I save money", "how to save money", "how do I save money"
  // Require "much" for "how" queries to avoid matching general advice questions
  if (
    /^what\s+can\s+i\s+save\b|^how\s+much\s+(?:can\s+i|do\s+i)\s+save\b|^show\s+(?:me\s+)?(?:my\s+)?savings\b/i.test(
      q
    )
  ) {
    return { action: "showSavings" };
  }

  // System status - local data display
  // Only match actual status queries, not questions about specific problems
  // Match: "how is my system", "my system status", "system status", "what is the status"
  // Don't match: "why is my system short cycling", "is my system broken"
  // Exclude questions that start with "why", "what", "is", etc. about problems
  // BUT allow "what is the status" as a command
  if (/^what\s+is\s+the\s+status\s*$/i.test(q)) {
    return { action: "systemStatus" };
  }
  if (
    /^(?:why|what|is|are)\s+(?:my\s+)?system/i.test(q) &&
    !/^what\s+is\s+the\s+status/i.test(q)
  ) {
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
    // Secret activation phrase! (case-insensitive)
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

  // Schedule queries
  // "what's the schedule for tomorrow" / "what is my weekly schedule" / "schedule"
  if (
    /what'?s?\s+(?:the\s+)?schedule\s+(?:for\s+tomorrow|this\s+week)?/i.test(q) ||
    /what\s+is\s+my\s+weekly\s+schedule/i.test(q) ||
    /^schedule\s*$/i.test(q)
  ) {
    return { action: "querySchedule", isCommand: true };
  }
  
  // "show me monday's schedule" / "schedule on friday" / "schedule for wed"
  const dayMatch = q.match(/(?:show\s+me\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)'?s?\s+schedule|schedule\s+(?:on|for)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)/i);
  if (dayMatch) {
    const dayName = (dayMatch[1] || dayMatch[2]).toLowerCase();
    const dayMap = {
      sunday: 0, sun: 0,
      monday: 1, mon: 1,
      tuesday: 2, tue: 2,
      wednesday: 3, wed: 3,
      thursday: 4, thu: 4,
      friday: 5, fri: 5,
      saturday: 6, sat: 6,
    };
    const dayNum = dayMap[dayName];
    if (dayNum !== undefined) {
      return { action: "queryScheduleDay", day: dayNum, isCommand: true };
    }
  }

  // === EARLY QUESTION DETECTION ===
  // Check for questions FIRST, before command matching
  // This prevents questions from being intercepted as commands
  // Return null for questions so parseAskJoule knows to send them to LLM

  // Check for "change to what" or "set to what" patterns - these are questions
  if (/^(change|set|switch|turn)\s+to\s+what/i.test(qLower)) {
    return null; // Send to LLM
  }

  // CRITICAL: Check if it starts with an action verb FIRST - these are almost always commands
  // This prevents commands like "Set temp = 68f in the living room" from being misclassified as questions
  const startsWithActionVerb =
    /^(set|change|make|turn|switch|activate|enable|disable|drop|lower|raise|increase|decrease|optimize|keep|put|run|stop|start|reset|undo|use|show|tell|explain|calculate|check|analyze|adjust|bump|heat|cool|auto|off|fan)\s+/i.test(
      q
    );

  const isQuestionPattern =
    /^(how|what|why|when|where|who|which|can\s+i|should\s+i|do\s+i|does|is|are|will|would|could|can\s+you)\b/i.test(
      qLower
    );
  const isInstructionalQuestion =
    /^(how\s+(do|can|should|to)|what\s+(should|happens|is|does|can)|should\s+i|can\s+i)\s+/i.test(
      qLower
    );

  // If it starts with an action verb, it's almost certainly a command, not a question
  // Skip question detection for these
  const isLikelyCommand = startsWithActionVerb;

  // Special case: "can you" can be a polite command OR a question
  // "can you set temp to 70" = command (polite request) - BUT "can you set the temperature to 70" might be a question
  // "can you tell me..." = question
  // Early return: If query only contains square feet or city (no command), treat as question
  // This prevents "2200sqft" or "in dallas texas" from being treated as commands
  const squareFeet = parseSquareFeet(q);
  const cityName = parseCity(q);
  // Check for command words (not at start, anywhere in string)
  const hasCommandWord =
    /\b(set|change|make|turn|switch|activate|enable|disable|show|query|explain|tell|calculate|check|analyze|optimize|start|stop|toggle|bump|drop|lower|raise|increase|decrease|heat|cool|auto|off|fan|schedule|keep|adjust)\b/i.test(
      q
    );
  // Check for temperature values
  const hasTemperature =
    /\d+\s*(?:degrees?|°|F|C)/i.test(q) || /^(\d{2})\s*$/.test(q.trim());
  // Check for action verbs
  const hasAction = hasCommandWord || hasTemperature;

  // If only square feet or city (no command), return data for context but not as command
  // But allow if there's also a command word or temperature
  if ((squareFeet || cityName) && !hasAction) {
    // Return the data but mark as not a command (will be treated as question/context)
    const result = {};
    if (squareFeet) result.squareFeet = squareFeet;
    if (cityName) result.cityName = cityName;
    return result; // Return data, not null - let caller decide if it's a command
  }

  // "can I switch to auto mode" = question (asking permission)
  const isCanYouQuestion =
    /^can\s+you\s+(tell|explain|show|what|how|why)/i.test(qLower);
  const isCanIQuestion =
    /^can\s+i\s+(switch|activate|set|change|turn|open|show|go|navigate)/i.test(
      qLower
    );

  // "can you set the temperature to X" vs "can you set temp to X"
  // The longer form with "the temperature" is more likely to be a question
  const isCanYouSetQuestion =
    /^can\s+you\s+set\s+(?:the\s+)?temperature\s+to/i.test(qLower);

  // "can I switch to auto mode" = question (asking permission)
  // "can I set..." = question (asking permission)
  const isCanICommandQuestion =
    /^can\s+i\s+(switch|set|change|turn|activate)\s+/i.test(qLower);

  // Explicitly check for "can you set the temperature to X" - this is ALWAYS a question
  if (/^can\s+you\s+set\s+(?:the\s+)?temperature\s+to/i.test(qLower)) {
    return null; // Always a question, send to LLM
  }

  // Explicitly check for "can I switch to X mode" or "can I switch to X" - this is ALWAYS a question (asking permission)
  // Must check BEFORE any mode switching patterns can match
  if (
    /^can\s+i\s+switch\s+to\s+(?:auto|heat|cool|off)(?:\s+mode)?/i.test(qLower)
  ) {
    return null; // Always a question, send to LLM
  }

  // Also catch "can you show me" patterns early - these are questions, not navigation commands
  if (/^can\s+(?:you|i)\s+show\s+me/i.test(qLower)) {
    return null; // Always a question, send to LLM
  }

  // If it's clearly a question asking HOW/SHOULD/CAN I/WHAT HAPPENS, reject it early
  // BUT skip this check if it starts with an action verb (it's a command, not a question)
  if (
    !isLikelyCommand &&
    isQuestionPattern &&
    (isInstructionalQuestion ||
      isCanIQuestion ||
      isCanICommandQuestion ||
      isCanYouQuestion ||
      isCanYouSetQuestion)
  ) {
    // But allow "can you set temp to X" as a polite command (short form, without "the temperature")
    const isPoliteCommand =
      /^can\s+you\s+(set|change|make|turn|switch|activate|open|go|navigate)\s+(?:temp|it|mode)\s+/i.test(
        qLower
      ) &&
      !isCanYouQuestion &&
      !isCanYouSetQuestion;

    if (!isPoliteCommand) {
      // Return null so parseAskJoule knows this is a question and should go to LLM
      return null;
    }
  }

  // === COMMAND PATTERNS THAT MIGHT BE MISCLASSIFIED AS QUESTIONS ===
  // These commands don't start with obvious action verbs, so add them early

  // "Make it run more efficiently" / "Make my system run better"
  if (
    /make\s+(?:it|my\s+system)\s+run\s+(?:more\s+)?(?:efficiently|better)/i.test(
      q
    )
  ) {
    return { action: "optimizeForEfficiency" };
  }

  // "Make sure strips stay off above X°F" / "Don't use aux heat unless it's below X°F"
  if (/make\s+sure\s+strips?\s+stay\s+off\s+above\s+(\d+)\s*°?f?/i.test(q)) {
    const match = q.match(
      /make\s+sure\s+strips?\s+stay\s+off\s+above\s+(\d+)\s*°?f?/i
    );
    if (match) {
      const temp = parseInt(match[1], 10);
      return { action: "setAuxHeatMaxOutdoorTemp", value: temp };
    }
  }
  if (
    /don'?t\s+use\s+aux\s+heat\s+unless\s+it'?s\s+below\s+(\d+)\s*°?f?/i.test(q)
  ) {
    const match = q.match(
      /don'?t\s+use\s+aux\s+heat\s+unless\s+it'?s\s+below\s+(\d+)\s*°?f?/i
    );
    if (match) {
      const temp = parseInt(match[1], 10);
      return { action: "setAuxHeatMaxOutdoorTemp", value: temp };
    }
  }

  // Fan control removed - HomeKit bridge doesn't support fan control

  // "Don't preheat before Xam" / "Pre-warm the house to X by Yam" / "Pre-cool to X by Yam"
  if (/don'?t\s+preheat\s+before\s+(\d{1,2})\s*(am|pm)/i.test(q)) {
    // This is a schedule constraint - could be handled by schedule system
    return { action: "setScheduleConstraint", noPreheatBefore: true };
  }
  if (
    /pre-?warm\s+(?:the\s+house\s+to\s+)?(\d{2})\s+by\s+(\d{1,2})\s*(am|pm)/i.test(
      q
    )
  ) {
    const match = q.match(
      /pre-?warm\s+(?:the\s+house\s+to\s+)?(\d{2})\s+by\s+(\d{1,2})\s*(am|pm)/i
    );
    if (match) {
      const temp = parseInt(match[1], 10);
      const hour = parseInt(match[2], 10);
      const period = match[3].toLowerCase();
      return { action: "setPreWarmSchedule", temp, hour, period };
    }
  }
  if (/pre-?cool\s+to\s+(\d{2})\s+by\s+(\d{1,2})\s*(am|pm)/i.test(q)) {
    const match = q.match(
      /pre-?cool\s+to\s+(\d{2})\s+by\s+(\d{1,2})\s*(am|pm)/i
    );
    if (match) {
      const temp = parseInt(match[1], 10);
      const hour = parseInt(match[2], 10);
      const period = match[3].toLowerCase();
      return { action: "setPreCoolSchedule", temp, hour, period };
    }
  }

  // "Use weather forecast to plan my schedule" / "Adjust tonight's schedule based on the cold front"
  if (/use\s+weather\s+forecast\s+to\s+plan\s+(?:my\s+)?schedule/i.test(q)) {
    return { action: "enableWeatherBasedScheduling" };
  }
  if (/adjust\s+(?:tonight'?s|today'?s)\s+schedule\s+based\s+on/i.test(q)) {
    return { action: "adjustScheduleForWeather" };
  }

  // "Set upstairs to X and downstairs to Y"
  if (
    /set\s+upstairs\s+to\s+(\d{2})\s+and\s+downstairs\s+to\s+(\d{2})/i.test(q)
  ) {
    const match = q.match(
      /set\s+upstairs\s+to\s+(\d{2})\s+and\s+downstairs\s+to\s+(\d{2})/i
    );
    if (match) {
      const upstairs = parseInt(match[1], 10);
      const downstairs = parseInt(match[2], 10);
      return { action: "setZoneTemperatures", upstairs, downstairs };
    }
  }

  // "Reset all thermostat settings to default"
  if (/reset\s+all\s+thermostat\s+settings\s+to\s+default/i.test(q)) {
    return { action: "resetToDefaults" };
  }

  // "Turn everything off when I say \"goodnight\"" - this is a voice command trigger
  if (/turn\s+everything\s+off\s+when\s+i\s+say/i.test(q)) {
    return {
      action: "setVoiceCommand",
      trigger: "goodnight",
      commandAction: "setMode",
      mode: "off",
    };
  }

  // "When I say \"I'm cold\", raise temp by 2 degrees" - voice command triggers
  if (/when\s+i\s+say\s+["']i'?m\s+cold["']/i.test(q)) {
    const match = q.match(/raise\s+temp\s+by\s+(\d+)\s+degrees?/i);
    const delta = match ? parseInt(match[1], 10) : 2;
    return {
      action: "setVoiceCommand",
      trigger: "i'm cold",
      commandAction: "increaseTemp",
      value: delta,
    };
  }
  if (/when\s+i\s+say\s+["']i'?m\s+hot["']/i.test(q)) {
    const match = q.match(/lower\s+temp\s+by\s+(\d+)\s+degrees?/i);
    const delta = match ? parseInt(match[1], 10) : 2;
    return {
      action: "setVoiceCommand",
      trigger: "i'm hot",
      commandAction: "decreaseTemp",
      value: delta,
    };
  }

  // "Stop learning my behavior for now" / "Start learning again"
  if (/stop\s+learning\s+(?:my\s+)?behavior/i.test(q)) {
    return { action: "disableLearning" };
  }
  if (/start\s+learning\s+again/i.test(q)) {
    return { action: "enableLearning" };
  }

  // "Help me tune settings for a heat pump, not a furnace"
  if (/help\s+me\s+tune\s+settings\s+for\s+a\s+heat\s+pump/i.test(q)) {
    return { action: "configureForHeatPump" };
  }

  // "Make my system \"run better\" today"
  if (/make\s+my\s+system\s+["']run\s+better["']/i.test(q)) {
    return { action: "optimizeForEfficiency" };
  }

  // === TEMPERATURE SETTING COMMANDS ===

  // "Set heat to X" or "Set cool to X" - interpret as temperature setting (not mode)
  // Also handles "heat to X please", "set heat X" (without "to"), "heat to72" (no space)
  // BUT NOT questions like "should I set heat to 70" or "what happens if I set heat to 70"
  // Skip question check if it starts with action verb (it's a command)
  if (
    (isLikelyCommand || !isQuestionPattern) &&
    (/set\s+(?:heat|cool|ac)\s+(?:to\s+)?(\d{2})\b/i.test(q) ||
      /^(?:heat|cool|ac)\s+to\s*(\d{2})\b/i.test(q) ||
      /^(?:heat|cool|ac)\s+to(\d{2})\b/i.test(q)) // "heat to72" (no space)
  ) {
    const match =
      q.match(/set\s+(?:heat|cool|ac)\s+(?:to\s+)?(\d{2})\b/i) ||
      q.match(/^(?:heat|cool|ac)\s+to\s*(\d{2})\b/i) ||
      q.match(/^(?:heat|cool|ac)\s+to(\d{2})\b/i);
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= TEMP_LIMITS.MIN && temp <= TEMP_LIMITS.MAX) {
        // If it says "heat", set winter temp; if "cool" or "ac", set summer temp
        const isHeat = /(?:^|set\s+)heat/i.test(q);
        return {
          action: isHeat ? "setWinterTemp" : "setSummerTemp",
          value: temp,
        };
      }
    }
  }

  // "Set AC to X" - summer temp
  if (/set\s+ac\s+to\s+(\d{2})\b/i.test(q)) {
    const match = q.match(/set\s+ac\s+to\s+(\d{2})\b/i);
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= TEMP_LIMITS.MIN && temp <= TEMP_LIMITS.MAX) {
        return { action: "setSummerTemp", value: temp };
      }
    }
  }

  // Generic "set my temp to X" or "set temp to X" - defaults to winter thermostat
  // Also handles "set the temperature to X", "can you set it to X"
  // BUT NOT "how do I set..." or "should I set..." or "what happens if I set..." - those are questions
  // BUT NOT "can you set the temperature to X" (longer form = question)
  // Allow out-of-bounds temps (like 100) - they'll be clamped by the handler
  // Also handle "set temp to 68" (without "the" or "my")
  // Explicitly reject "can you set the temperature to X" - this is a question, not a command
  if (
    // Check it's NOT a question first
    (isLikelyCommand || !isQuestionPattern) &&
    !/^(should\s+i|what\s+happens|can\s+i)\s+/i.test(q) &&
    // Reject "can you set the temperature to X" (longer form = question)
    !/^can\s+you\s+set\s+(?:the\s+)?temperature\s+to/i.test(q) &&
    // Also reject if it starts with "can you set" and has "temperature" (not just "temp")
    !(/^can\s+you\s+set/i.test(q) && /temperature/i.test(q)) &&
    buildSetTempPattern(true).test(q) &&
    !/(?:winter|summer|nighttime|daytime|night|day|sleep|home|compressor)/i.test(
      q
    )
  ) {
    const match = q.match(buildSetTempPattern(true));
    if (match) {
      const temp = parseInt(match[1], 10);
      // Allow out-of-bounds temps - they'll be clamped by the handler
      if (
        temp >= TEMP_LIMITS.MIN_EXTENDED &&
        temp <= TEMP_LIMITS.MAX_EXTENDED
      ) {
        if (import.meta.env?.DEV) {
          console.log("[parseCommandLocal] Matched 'set temp' command:", {
            action: "setWinterTemp",
            value: temp,
            input: q,
          });
        }
        return { action: "setWinterTemp", value: temp };
      }
    }
  }

  // Also handle bare "set temp to X" pattern (more flexible)
  if (
    /^set\s+temp(?:\s+to)?\s+(\d{2,3})\b/i.test(q) &&
    !/(?:winter|summer|nighttime|daytime|night|day|sleep|home|compressor)/i.test(
      q
    )
  ) {
    const match = q.match(/^set\s+temp(?:\s+to)?\s+(\d{2,3})\b/i);
    if (match) {
      const temp = parseInt(match[1], 10);
      if (
        temp >= TEMP_LIMITS.MIN_EXTENDED &&
        temp <= TEMP_LIMITS.MAX_EXTENDED
      ) {
        if (import.meta.env?.DEV) {
          console.log("[parseCommandLocal] Matched bare 'set temp' command:", {
            action: "setWinterTemp",
            value: temp,
            input: q,
          });
        }
        return { action: "setWinterTemp", value: temp };
      }
    }
  }

  // "set to X" - bare "set to 72" (assume winter temp for now, could be smarter with context)
  // Also: "set temp = 68f" (with equals sign)
  if (/^set\s+to\s+(\d{2})\b/i.test(q)) {
    const match = q.match(/^set\s+to\s+(\d{2})\b/i);
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= TEMP_LIMITS.MIN && temp <= TEMP_LIMITS.MAX) {
        return { action: "setWinterTemp", value: temp };
      }
    }
  }
  // "set temp = 68f" or "set temp=68f" (with equals sign)
  if (/set\s+temp\s*=\s*(\d{2})\s*f?\b/i.test(q)) {
    const match = q.match(/set\s+temp\s*=\s*(\d{2})\s*f?\b/i);
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= TEMP_LIMITS.MIN && temp <= TEMP_LIMITS.MAX) {
        return { action: "setWinterTemp", value: temp };
      }
    }
  }

  // "change to X" or "change temperature to X" or "change temp to X"
  if (/^change\s+(?:temperature|temp)\s+to\s+(\d{2})\b/i.test(q)) {
    const match = q.match(/^change\s+(?:temperature|temp)\s+to\s+(\d{2})\b/i);
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= TEMP_LIMITS.MIN && temp <= TEMP_LIMITS.MAX) {
        return { action: "setWinterTemp", value: temp };
      }
    }
  }
  // "change to X" (without "temperature" or "temp")
  if (/^change\s+to\s+(\d{2})\b/i.test(q)) {
    const match = q.match(/^change\s+to\s+(\d{2})\b/i);
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= TEMP_LIMITS.MIN && temp <= TEMP_LIMITS.MAX) {
        return { action: "setWinterTemp", value: temp };
      }
    }
  }

  // "make it X" or "make it X degrees"
  if (/^make\s+it\s+(\d{2})(?:\s+degrees?)?\b/i.test(q)) {
    const match = q.match(/^make\s+it\s+(\d{2})(?:\s+degrees?)?\b/i);
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= TEMP_LIMITS.MIN && temp <= TEMP_LIMITS.MAX) {
        return { action: "setWinterTemp", value: temp };
      }
    }
  }

  // Bare number "73" - handle standalone temperature numbers
  if (/^(\d{2})\s*$/.test(q.trim())) {
    const temp = parseInt(q.trim(), 10);
    if (temp >= TEMP_LIMITS.MIN && temp <= 90) {
      return { action: "setWinterTemp", value: temp };
    }
  }

  // "set it to X degrees fahrenheit" or similar
  if (
    /set\s+it\s+to\s+(\d{2})(?:\s+degrees?\s+(?:fahrenheit|f|celsius|c))?/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+it\s+to\s+(\d{2})(?:\s+degrees?\s+(?:fahrenheit|f|celsius|c))?/i
    );
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= TEMP_LIMITS.MIN && temp <= TEMP_LIMITS.MAX) {
        return { action: "setWinterTemp", value: temp };
      }
    }
  }

  // "68F" or "72F" (no space, no degree symbol) - must come before other patterns
  // Match standalone or with trailing text
  if (/^(\d{2})F\b/i.test(q.trim())) {
    const match = q.match(/^(\d{2})F\b/i);
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= TEMP_LIMITS.MIN && temp <= TEMP_LIMITS.MAX) {
        return { action: "setWinterTemp", value: temp };
      }
    }
  }

  // "72 degrees Farenheit" (misspelling) or "72 degrees Fahrenheit"
  if (/(\d{2})\s+degrees?\s+(?:farenheit|fahrenheit)/i.test(q)) {
    const match = q.match(/(\d{2})\s+degrees?\s+(?:farenheit|fahrenheit)/i);
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= TEMP_LIMITS.MIN && temp <= TEMP_LIMITS.MAX) {
        return { action: "setWinterTemp", value: temp };
      }
    }
  }

  // "72° F" or "72 ° F" (space before F) - more flexible matching
  if (/(\d{2})\s*°\s*F\b/i.test(q)) {
    const match = q.match(/(\d{2})\s*°\s*F\b/i);
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= TEMP_LIMITS.MIN && temp <= TEMP_LIMITS.MAX) {
        return { action: "setWinterTemp", value: temp };
      }
    }
  }

  // Reject Celsius explicitly
  if (/\d+\s+degrees?\s+celsius/i.test(q)) {
    return null; // Send to LLM to explain conversion
  }

  // Bare number "72" or "set 68" - only if it's a standalone command (not part of a question)
  if (
    /^(\d{2})\s*$/i.test(q) &&
    !/^(how|what|why|when|where|who|which|can|should|do|does|is|are|will|would|could)\b/i.test(
      q
    )
  ) {
    const match = q.match(/^(\d{2})\s*$/i);
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= TEMP_LIMITS.MIN && temp <= TEMP_LIMITS.MAX) {
        return { action: "setWinterTemp", value: temp };
      }
    }
  }
  // "set 68" pattern
  if (/^set\s+(\d{2})\s*$/i.test(q)) {
    const match = q.match(/^set\s+(\d{2})\s*$/i);
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= TEMP_LIMITS.MIN && temp <= TEMP_LIMITS.MAX) {
        return { action: "setWinterTemp", value: temp };
      }
    }
  }
  // "set 68" pattern
  if (/^set\s+(\d{2})\s*$/i.test(q)) {
    const match = q.match(/^set\s+(\d{2})\s*$/i);
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= TEMP_LIMITS.MIN && temp <= TEMP_LIMITS.MAX) {
        return { action: "setWinterTemp", value: temp };
      }
    }
  }

  // === GENERAL QUESTION REJECTION ===
  // Reject other questions starting with question words - these should go to AI
  // BUT exclude commands that we've already handled above (like "how do I set...")
  if (
    /^(how|what|why|when|where|who|which|can\s+i|should\s+i|do\s+i|does|is|are|will|would|could)\b/i.test(
      qLower
    ) &&
    !/(?:how\s+do\s+i\s+set|how\s+can\s+i\s+set|how\s+to\s+set)/i.test(qLower)
  ) {
    return null;
  }

  // Relative temperature adjustments
  // These must come BEFORE "make it comfortable" patterns to avoid conflicts

  // "turn it up" / "turn it down" - simple directional commands
  if (/^turn\s+it\s+(up|down)\s*$/i.test(q)) {
    const isUp = /up/i.test(q);
    return { action: isUp ? "increaseTemp" : "decreaseTemp", value: 2 };
  }

  // "bump it up" / "lower it" - simple commands
  if (/^bump\s+it\s+up\s*$/i.test(q)) {
    return { action: "increaseTemp", value: 2 };
  }
  // "bump it up X degrees" - with number (check BEFORE simple version to catch numbers)
  if (/bump\s+it\s+up\s+(\d+)(?:\s+degrees?)?/i.test(q)) {
    const match = q.match(/bump\s+it\s+up\s+(\d+)(?:\s+degrees?)?/i);
    if (match) {
      const delta = parseInt(match[1], 10);
      return { action: "increaseTemp", value: delta };
    }
  }
  if (/^lower\s+it\s*$/i.test(q)) {
    return { action: "decreaseTemp", value: 2 };
  }

  // "drop it down X" or "drop it down by X" - handle "drop it down 2"
  if (/drop\s+it\s+down(?:\s+by)?\s+(\d+)(?:\s+degrees?)?/i.test(q)) {
    const match = q.match(
      /drop\s+it\s+down(?:\s+by)?\s+(\d+)(?:\s+degrees?)?/i
    );
    if (match) {
      const delta = parseInt(match[1], 10);
      return { action: "decreaseTemp", value: delta };
    }
  }
  // "drop it down" without number - default to 2
  if (/^drop\s+it\s+down\s*$/i.test(q)) {
    return { action: "decreaseTemp", value: 2 };
  }

  // "lower it by X" or "lower temperature by X" (not just "lower by X")
  if (
    /lower\s+(?:it|the\s+temp|temperature)\s+by\s+(\d+|five|four|three|two|one|six|seven|eight|nine|ten)/i.test(
      q
    )
  ) {
    const match = q.match(
      /lower\s+(?:it|the\s+temp|temperature)\s+by\s+(\d+|five|four|three|two|one|six|seven|eight|nine|ten)/i
    );
    if (match) {
      const numWords = {
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
        ten: 10,
      };
      const delta = numWords[match[1].toLowerCase()] || parseInt(match[1], 10);
      return { action: "decreaseTemp", value: delta };
    }
  }

  // "cooler pls" or "cooler please" - default 2
  if (/^cooler\s+(?:pls|please)?\s*$/i.test(q)) {
    return { action: "decreaseTemp", value: 2 };
  }

  // "yo turn it down" or casual variations
  if (/^(?:yo|hey|ok|alright)\s+turn\s+it\s+(up|down)/i.test(q)) {
    const isUp = /up/i.test(q);
    return { action: isUp ? "increaseTemp" : "decreaseTemp", value: 2 };
  }

  // "make it warmer/cooler" with optional "by X" or "X degrees" or "like X degrees"
  if (
    /(?:make\s+it|turn\s+it|make|turn)\s+(?:warmer|hotter|heat\s+up)(?:\s+by\s+(\d+)(?:\s+degrees?)?)?/i.test(
      q
    ) ||
    /^(?:warmer|hotter|heat\s+up)(?:\s+by\s+(\d+)(?:\s+degrees?)?)?$/i.test(
      q
    ) ||
    /make\s+it\s+(\d+)\s+degrees?\s+warmer/i.test(q) ||
    /make\s+it\s+warmer.*?like\s+(\d+)\s+degrees?/i.test(q) ||
    /make\s+it\s+warmer[^\d]*(\d+)\s+degrees?/i.test(q) // Handle "warmer… like 5 degrees" with ellipsis
  ) {
    let match = q.match(/make\s+it\s+(\d+)\s+degrees?\s+warmer/i);
    if (!match) {
      match = q.match(/make\s+it\s+warmer.*?like\s+(\d+)\s+degrees?/i);
    }
    if (!match) {
      match = q.match(/make\s+it\s+warmer[^\d]*(\d+)\s+degrees?/i); // Catch "warmer… like 5"
    }
    if (!match) {
      match = q.match(
        /(?:warmer|hotter|heat\s+up)(?:\s+by\s+(\d+)(?:\s+degrees?)?)?/i
      );
    }
    const delta = match && match[1] ? parseInt(match[1], 10) : 2;
    return { action: "increaseTemp", value: delta };
  }
  if (
    /(?:make\s+it|turn\s+it|make|turn)\s+(?:cooler|colder|cool\s+down)(?:\s+by\s+(\d+)(?:\s+degrees?)?)?/i.test(
      q
    ) ||
    /^(?:cooler|colder|cool\s+down)(?:\s+by\s+(\d+)(?:\s+degrees?)?)?$/i.test(
      q
    ) ||
    /make\s+it\s+(\d+)\s+degrees?\s+cooler/i.test(q)
  ) {
    let match = q.match(/make\s+it\s+(\d+)\s+degrees?\s+cooler/i);
    if (!match) {
      match = q.match(
        /(?:cooler|colder|cool\s+down)(?:\s+by\s+(\d+)(?:\s+degrees?)?)?/i
      );
    }
    const delta = match && match[1] ? parseInt(match[1], 10) : 2;
    return { action: "decreaseTemp", value: delta };
  }

  // Emergency comfort patterns - "I'm freezing" / "I'm roasting"
  // Also: "it's getting hot in here", "yo it's getting hot", "it's getting cold"
  if (
    /i'?m\s+(?:freezing|dying\s+of\s+cold|so\s+cold|cold)/i.test(q) ||
    /it'?s\s+getting\s+(?:really\s+)?cold/i.test(q) ||
    /getting\s+(?:really\s+)?cold\s+(?:in\s+here|in\s+this\s+room)?/i.test(q)
  ) {
    return { action: "emergencyHeatBoost", value: +5 };
  }
  if (
    /i'?m\s+(?:roasting|dying\s+of\s+heat|so\s+hot|sweating|hot)/i.test(q) ||
    /it'?s\s+getting\s+(?:really\s+)?hot/i.test(q) ||
    /getting\s+(?:really\s+)?hot\s+(?:in\s+here|in\s+this\s+room)?/i.test(q)
  ) {
    return { action: "emergencyCoolBoost", value: 5 };
  }

  // "heat it up by X degrees"
  if (/heat\s+it\s+up\s+by\s+(\d+)(?:\s+degrees?)?/i.test(q)) {
    const match = q.match(/heat\s+it\s+up\s+by\s+(\d+)(?:\s+degrees?)?/i);
    const delta = match ? parseInt(match[1], 10) : 2;
    return { action: "increaseTemp", value: delta };
  }

  // "turn it down by X" or "turn down by X"
  if (/turn\s+(?:it\s+)?down\s+by\s+(\d+)(?:\s+degrees?)?/i.test(q)) {
    const match = q.match(
      /turn\s+(?:it\s+)?down\s+by\s+(\d+)(?:\s+degrees?)?/i
    );
    const delta = match ? parseInt(match[1], 10) : 2;
    return { action: "decreaseTemp", value: delta };
  }
  // "turn up" (without "by X") - default to 2 degrees
  // Handle casual prefixes: "yo turn it up", "hey turn it up"
  if (
    /^(?:yo|hey|ok|alright|well)\s+turn\s+(?:it\s+)?up\s*$/i.test(q) ||
    /^turn\s+(?:it\s+)?up\s*$/i.test(q)
  ) {
    return { action: "increaseTemp", value: 2 };
  }
  // "turn down" (without "by X") - default to 2 degrees
  // Handle casual prefixes: "yo turn it down", "hey turn it down"
  if (
    /^(?:yo|hey|ok|alright|well)\s+turn\s+(?:it\s+)?down\s*$/i.test(q) ||
    /^turn\s+(?:it\s+)?down\s*$/i.test(q)
  ) {
    return { action: "decreaseTemp", value: 2 };
  }

  // "turn up by X" or "turn it up by X"
  if (/turn\s+(?:it\s+)?up\s+by\s+(\d+)(?:\s+degrees?)?/i.test(q)) {
    const match = q.match(/turn\s+(?:it\s+)?up\s+by\s+(\d+)(?:\s+degrees?)?/i);
    const delta = match ? parseInt(match[1], 10) : 2;
    return { action: "increaseTemp", value: delta };
  }

  // "increase by X" / "decrease by X"
  if (/^increase\s+by\s+(\d+)(?:\s+degrees?)?\s*$/i.test(q)) {
    const match = q.match(/^increase\s+by\s+(\d+)(?:\s+degrees?)?\s*$/i);
    const delta = match ? parseInt(match[1], 10) : 2;
    return { action: "increaseTemp", value: delta };
  }
  if (/^decrease\s+by\s+(\d+)(?:\s+degrees?)?\s*$/i.test(q)) {
    const match = q.match(/^decrease\s+by\s+(\d+)(?:\s+degrees?)?\s*$/i);
    const delta = match ? parseInt(match[1], 10) : 2;
    return { action: "decreaseTemp", value: delta };
  }

  // "increase temperature" / "decrease temperature" / "raise the temperature"
  if (
    /(?:increase|raise|turn\s+up|up)\s+(?:the\s+)?(?:temp|temperature|heat)(?:\s+by\s+(\d+)(?:\s+degrees?)?)?/i.test(
      q
    )
  ) {
    // Match "by 2", "by 2 degrees", or just "2" after "temperature"
    const match = q.match(/(?:by\s+)?(\d+)(?:\s+degrees?)?/i);
    const delta = match ? parseInt(match[1], 10) : 2;
    return { action: "increaseTemp", value: delta };
  }
  if (
    /(?:decrease|lower|turn\s+down|down)\s+(?:the\s+)?(?:temp|temperature|heat)(?:\s+by\s+(\d+)(?:\s+degrees?)?)?/i.test(
      q
    )
  ) {
    // Match "by 2", "by 2 degrees", "2 degrees", or extract number from the full phrase
    // Try to match the number after "by" first, then fall back to any number after "temperature"
    let match = q.match(/by\s+(\d+)(?:\s+degrees?)?/i);
    if (!match) {
      match = q.match(
        /(?:decrease|lower|turn\s+down|down).*?(\d+)(?:\s+degrees?)?/i
      );
    }
    const delta = match ? parseInt(match[1], 10) : 2;
    return { action: "decreaseTemp", value: delta };
  }

  // === HUMAN LANGUAGE PROBLEM DETECTION ===
  // These patterns detect user problems and translate them to solutions
  // Must come before technical commands to prioritize natural language

  // 1. Comfort Tuning - Problem Detection
  // "The heat turns on and off too much" / "It's cycling constantly"
  // Only match if it's clearly a problem description, not a question
  // Exclude questions like "short cycling???" which should go to knowledge base
  if (
    !/\?/.test(q) && // Don't match if it's a question (has question mark)
    !/^short\s+cycl/i.test(q) && // Don't match "short cycling" questions (handled by offlineAnswer above)
    (/(?:heat|system|it|furnace|ac|air)\s+(?:turns?\s+)?(?:on\s+and\s+off|cycles?|cycling)\s+(?:too\s+)?(?:much|often|constantly|frequently)/i.test(
      q
    ) ||
      /(?:short\s+)?cycling|turns?\s+on\s+and\s+off\s+too\s+much|cycles?\s+constantly/i.test(
        q
      ))
  ) {
    return {
      action: "setHeatDifferential",
      value: 1.5,
      reason: "Short cycling detected - widening differential",
    };
  }

  // "It feels sticky in here" / "It's humid"
  // Exclude "humidity correction" queries - they should go to queryThreshold handler
  if (
    !/humidity\s+correction/i.test(q) &&
    /(?:feels?\s+)?(?:sticky|humid|clammy|muggy)|(?:it'?s|it\s+is)\s+(?:sticky|humid|clammy|muggy)|too\s+much\s+humidity/i.test(
      q
    )
  ) {
    return {
      action: "setACOvercool",
      value: 3,
      reason: "Humidity issue detected - enabling aggressive dehumidification",
    };
  }

  // "The thermostat says 72 but my thermometer says 70"
  if (
    /thermostat\s+says?\s+(\d+)\s+but\s+(?:my\s+)?(?:thermometer|gauge|sensor)\s+says?\s+(\d+)/i.test(
      q
    )
  ) {
    const match = q.match(
      /thermostat\s+says?\s+(\d+)\s+but\s+(?:my\s+)?(?:thermometer|gauge|sensor)\s+says?\s+(\d+)/i
    );
    if (match) {
      const thermostatReading = parseInt(match[1], 10);
      const actualReading = parseInt(match[2], 10);
      const correction = actualReading - thermostatReading;
      if (correction >= -10 && correction <= 10) {
        return {
          action: "setTemperatureCorrection",
          value: correction,
          reason: `Thermostat reads ${thermostatReading}°F but actual is ${actualReading}°F`,
        };
      }
    }
  }

  // 2. Hardware Protection - Fear Detection
  // "I'm worried about my compressor dying"
  if (
    /(?:worried|concerned|afraid|scared)\s+(?:about|that)\s+(?:my\s+)?(?:compressor|unit|system)/i.test(
      q
    ) ||
    /(?:compressor|unit|system)\s+(?:dying|failing|breaking|dying|wearing\s+out)/i.test(
      q
    )
  ) {
    return {
      action: "setCompressorMinCycleOff",
      value: 600,
      reason: "Compressor protection - setting min off time to 10 minutes",
    };
  }

  // "The AC barely runs for 2 minutes"
  if (
    /(?:ac|air|cooling|compressor)\s+(?:barely|only|just)\s+runs?\s+(?:for\s+)?(\d+)\s+minutes?/i.test(
      q
    ) ||
    /runs?\s+(?:for\s+)?(?:only|just|barely)\s+(\d+)\s+minutes?/i.test(q)
  ) {
    const match =
      q.match(
        /(?:ac|air|cooling|compressor)\s+(?:barely|only|just)\s+runs?\s+(?:for\s+)?(\d+)\s+minutes?/i
      ) ||
      q.match(/runs?\s+(?:for\s+)?(?:only|just|barely)\s+(\d+)\s+minutes?/i);
    if (match) {
      const runtime = parseInt(match[1], 10);
      if (runtime < 5) {
        // If it's running less than 5 minutes, increase min on time
        return {
          action: "setCoolMinOnTime",
          value: 300,
          reason: `Short runtime detected (${runtime} min) - setting min on time to 5 minutes`,
        };
      }
    }
  }

  // 3. Efficiency & Savings - Money Problems
  // "Stop blowing cold air after the heat turns off"
  if (
    /(?:stop|don'?t|no)\s+(?:blowing|blow)\s+(?:cold\s+)?air\s+(?:after|when)\s+(?:the\s+)?(?:heat|furnace)\s+(?:turns?\s+off|stops?)/i.test(
      q
    ) ||
    /(?:blowing|blow)\s+(?:cold\s+)?air\s+(?:after|when)\s+(?:heat|furnace)\s+(?:turns?\s+off|stops?)/i.test(
      q
    )
  ) {
    return {
      action: "setHeatDissipation",
      value: 0,
      reason: "Cold air after heat stops - disabling heat dissipation",
    };
  }

  // "I want to squeeze every BTU out of the furnace"
  if (
    /(?:squeeze|get|extract|maximize)\s+(?:every|all|more)\s+(?:btu|heat|energy)\s+(?:out\s+of|from)\s+(?:the\s+)?(?:furnace|system)/i.test(
      q
    ) ||
    /(?:maximize|get\s+more)\s+(?:heat|btu|energy)/i.test(q)
  ) {
    return {
      action: "setHeatDissipation",
      value: 60,
      reason: "Maximizing heat extraction - setting dissipation to 60 seconds",
    };
  }

  // "My bill is huge. Stop the electric strips."
  if (
    /(?:bill|cost|expensive|huge|high)\s+(?:is|are|too)\s+(?:huge|high|expensive)/i.test(
      q
    ) ||
    /(?:stop|don'?t|no)\s+(?:the\s+)?(?:electric\s+)?(?:strips?|aux|auxiliary\s+heat)/i.test(
      q
    ) ||
    /(?:save|saving)\s+(?:money|energy|cost)/i.test(q)
  ) {
    return {
      action: "setAuxHeatMaxOutdoorTemp",
      value: 35,
      reason: "High bills detected - locking out aux heat above 35°F",
    };
  }

  // "The heat pump is making a weird noise in the extreme cold"
  if (
    /(?:heat\s+pump|compressor|unit)\s+(?:is\s+)?(?:making|making\s+a)\s+(?:weird|strange|loud|bad)\s+(?:noise|sound)/i.test(
      q
    ) ||
    /(?:weird|strange|loud|bad)\s+(?:noise|sound)\s+(?:in|when|during)\s+(?:extreme\s+)?(?:cold|freezing)/i.test(
      q
    )
  ) {
    return {
      action: "setCompressorLockout",
      value: 20,
      reason: "Straining in extreme cold - setting compressor lockout to 20°F",
    };
  }

  // 4. Advanced Staging - Complaints
  // "The aux heat turns on too fast" / "It gives up on the heat pump too easily"
  if (
    /(?:aux|auxiliary|electric\s+strips?)\s+heat\s+(?:turns?\s+on|comes?\s+on)\s+too\s+(?:fast|quick|soon|early)/i.test(
      q
    ) ||
    /(?:gives?\s+up|switches?)\s+(?:on|to)\s+(?:the\s+)?(?:aux|auxiliary|backup)\s+heat\s+too\s+(?:fast|quick|soon|easily)/i.test(
      q
    )
  ) {
    return {
      action: "setCompressorToAuxDelta",
      value: 4,
      reason: "Aux heat engaging too quickly - increasing delta to 4°F",
    };
  }

  // "It's too loud when it runs." (For 2-stage units)
  if (
    /(?:it'?s|it\s+is|too)\s+(?:too\s+)?(?:loud|noisy)\s+(?:when|while)\s+(?:it\s+)?runs?/i.test(
      q
    ) ||
    /(?:too\s+)?(?:loud|noisy)\s+(?:when|while)\s+(?:running|it\s+runs?)/i.test(
      q
    )
  ) {
    return {
      action: "setCompressorReverseStaging",
      value: true,
      reason: "Too loud - enabling reverse staging to run on low stage longer",
    };
  }

  // 5. One-Shot Optimization - Vibe Detection
  // "Make it cheap" / "Save money"
  // NOTE: These patterns must NOT match "make it cooler/warmer" - those are temperature commands
  // So we check for specific optimization words, excluding temperature-related words
  if (
    /(?:make\s+it|make|optimize\s+for)\s+(?:cheap|cheaper|efficient|efficiency)\b/i.test(
      q
    ) &&
    !/(?:make\s+it|make)\s+(?:cooler|colder|warmer|hotter)/i.test(q) // Exclude temperature commands
  ) {
    return { action: "optimizeForEfficiency" };
  }
  if (/(?:save|saving)\s+(?:money|energy|cost)/i.test(q)) {
    return { action: "optimizeForEfficiency" };
  }

  // "Make it precise" / "Make it comfortable"
  // NOTE: Must NOT match "make it cooler/warmer" - those are temperature commands
  if (
    /(?:make\s+it|make|optimize\s+for)\s+(?:precise|comfortable|comfort|accurate)\b/i.test(
      q
    ) &&
    !/(?:make\s+it|make)\s+(?:cooler|colder|warmer|hotter)/i.test(q) // Exclude temperature commands
  ) {
    return { action: "optimizeForComfort" };
  }
  if (/(?:better|more)\s+(?:comfort|precision|accuracy)/i.test(q)) {
    return { action: "optimizeForComfort" };
  }

  // "Fix the short cycling" / "Check for short cycling"
  if (
    /(?:fix|stop|prevent|solve|check\s+for)\s+(?:the\s+)?(?:short\s+)?cycling/i.test(
      q
    ) ||
    /(?:short\s+)?cycling\s+(?:problem|issue|fix)/i.test(q)
  ) {
    // Apply short cycle fix: widen differential + increase min off time
    return { action: "fixShortCycling" };
  }

  // === ROUND 2: SPECIFIC FRUSTRATION PATTERNS ===

  // 1. Drafty House Complaints
  // "It gets cold immediately after the heat stops"
  if (
    /(?:it|house|room)\s+gets?\s+(?:cold|chilly)\s+(?:immediately|right away|quickly)\s+(?:after|when)\s+(?:the\s+)?(?:heat|furnace)\s+stops?/i.test(
      q
    ) ||
    /(?:cold|chilly)\s+(?:immediately|right away|quickly)\s+(?:after|when)\s+(?:heat|furnace)\s+stops?/i.test(
      q
    )
  ) {
    return {
      action: "setHeatDifferential",
      value: 0.5,
      reason:
        "House gets cold quickly after heat stops - tightening differential to maintain temperature better",
    };
  }

  // "The floors are cold"
  if (
    /(?:the\s+)?(?:floors?|floor)\s+(?:are|is|feel)\s+(?:cold|chilly)/i.test(
      q
    ) ||
    /(?:cold|chilly)\s+(?:floors?|floor)/i.test(q)
  ) {
    return {
      action: "setFanMinOnTime",
      value: 30,
      reason:
        "Cold floors detected - enabling fan circulation to mix air and reduce stratification",
    };
  }

  // 2. Oversized System Problems
  // "The AC blasts me with arctic air for 5 minutes then stops"
  if (
    /(?:ac|air|cooling)\s+(?:blasts?|blows?)\s+(?:me\s+with\s+)?(?:arctic|cold|freezing)\s+air\s+(?:for\s+)?(\d+)\s+minutes?\s+then\s+stops?/i.test(
      q
    ) ||
    /(?:blasts?|blows?)\s+(?:arctic|cold|freezing)\s+air\s+(?:for\s+)?(\d+)\s+minutes?\s+then\s+stops?/i.test(
      q
    )
  ) {
    return {
      action: "fixOversizedAC",
      reason:
        "Oversized AC detected - forcing longer runtime for better dehumidification",
    };
  }

  // "The furnace sounds like a jet engine taking off every 10 minutes"
  if (
    /(?:furnace|heat|system)\s+sounds?\s+like\s+(?:a\s+)?(?:jet\s+engine|airplane|rocket)/i.test(
      q
    ) ||
    /(?:jet\s+engine|airplane|rocket)\s+(?:sound|noise|taking\s+off)/i.test(q)
  ) {
    return {
      action: "setHeatDifferential",
      value: 2.0,
      reason:
        "Furnace running too frequently - widening differential to reduce cycles and noise",
    };
  }

  // 3. Aux Heat Anxiety
  // "I smell burning dust" (The smell of Aux strips)
  if (
    /(?:i\s+)?(?:smell|smelling)\s+(?:burning\s+)?(?:dust|plastic|electrical|burning)/i.test(
      q
    ) ||
    /(?:burning\s+)?(?:dust|plastic|electrical)\s+smell/i.test(q) ||
    /it\s+smells?\s+like\s+burning/i.test(q)
  ) {
    return {
      action: "checkAuxHeatUsage",
      reason:
        "Burning smell detected - likely aux heat running unnecessarily. Checking aux heat lockout setting.",
    };
  }

  // Defrost Cycle Detection - "Why is it blowing cold air when heat is on?"
  if (
    /(?:why\s+is\s+it|why'?s?\s+it|it'?s)\s+(?:blowing|blow)\s+(?:cold\s+)?air\s+(?:when|while)\s+(?:the\s+)?(?:heat|heating)\s+(?:is\s+)?(?:on|running)/i.test(
      q
    ) ||
    /(?:blowing|blow)\s+(?:cold\s+)?air\s+(?:when|while)\s+(?:heat|heating)\s+(?:is\s+)?(?:on|running)/i.test(
      q
    )
  ) {
    return {
      action: "explainDefrostCycle",
      reason:
        "User asking about cold air during heating - likely defrost cycle",
    };
  }

  // Balance Point / Load > Capacity - "It's running but the temp isn't going up"
  if (
    /(?:it'?s|it\s+is)\s+(?:running|on)\s+but\s+(?:the\s+)?(?:temp|temperature)\s+(?:isn'?t|is\s+not|won'?t)\s+(?:going\s+up|rising|increasing)/i.test(
      q
    ) ||
    /(?:running|on)\s+but\s+(?:temp|temperature)\s+(?:isn'?t|is\s+not|won'?t)\s+(?:going\s+up|rising|increasing)/i.test(
      q
    ) ||
    /(?:temp|temperature)\s+(?:isn'?t|is\s+not|won'?t)\s+(?:going\s+up|rising|increasing)/i.test(
      q
    )
  ) {
    return {
      action: "explainBalancePoint",
      reason:
        "System running but not heating - likely at balance point or load > capacity",
    };
  }

  // Cost Fear - "Is this going to cost a fortune?"
  if (
    /(?:is\s+this|will\s+this|is\s+it)\s+(?:going\s+to\s+)?(?:cost|costing)\s+(?:a\s+)?(?:fortune|lot|too\s+much|much)/i.test(
      q
    ) ||
    /(?:how\s+much\s+will\s+this|how\s+much\s+is\s+this)\s+(?:cost|costing)/i.test(
      q
    )
  ) {
    return {
      action: "checkCurrentCost",
      reason: "User concerned about cost - checking current usage vs budget",
    };
  }

  // Setback Strategy - "Should I turn it off when I leave?"
  if (
    /(?:should\s+i|do\s+i\s+need\s+to|can\s+i)\s+(?:turn\s+it\s+off|shut\s+it\s+off|turn\s+off)\s+(?:when|while)\s+(?:i\s+)?(?:leave|away|gone)/i.test(
      q
    ) ||
    /(?:turn\s+it\s+off|shut\s+it\s+off)\s+(?:when|while)\s+(?:i\s+)?(?:leave|away|gone)/i.test(
      q
    )
  ) {
    return {
      action: "explainSetbackStrategy",
      reason:
        "User asking about turning off when away - needs setback strategy advice",
    };
  }

  // Filter Questions - "Do I really need to change the filter?"
  if (
    /(?:do\s+i\s+really\s+need\s+to|should\s+i|do\s+i\s+need\s+to)\s+(?:change|replace)\s+(?:the\s+)?(?:filter|air\s+filter)/i.test(
      q
    ) ||
    /(?:when|how\s+often)\s+(?:should|do)\s+i\s+(?:change|replace)\s+(?:the\s+)?(?:filter|air\s+filter)/i.test(
      q
    )
  ) {
    return {
      action: "explainFilterImportance",
      reason:
        "User asking about filter changes - needs static pressure warning explanation",
    };
  }

  // Filter Recommendations - "Which filter should I buy?"
  if (
    /(?:which|what)\s+(?:filter|air\s+filter)\s+(?:should\s+i\s+)?(?:buy|get|use|purchase)/i.test(
      q
    ) ||
    /(?:filter|air\s+filter)\s+(?:recommendation|suggestion|advice)/i.test(q)
  ) {
    return {
      action: "recommendFilter",
      reason: "User asking which filter to buy - needs MERV rating advice",
    };
  }

  // Reversing Valve Sound - "The outside unit made a swoosh sound"
  if (
    /(?:the\s+)?(?:outside|outdoor)\s+(?:unit|compressor)\s+(?:made|making|makes?)\s+(?:a\s+)?(?:swoosh|whoosh|hiss|click|sound|noise)/i.test(
      q
    ) ||
    /(?:swoosh|whoosh|hiss)\s+(?:sound|noise)\s+(?:from|on|at)\s+(?:the\s+)?(?:outside|outdoor)\s+(?:unit|compressor)/i.test(
      q
    )
  ) {
    return {
      action: "explainReversingValve",
      reason:
        "User hearing swoosh sound - likely reversing valve during defrost cycle",
    };
  }

  // Stack Effect / Stratification - "Why is the upstairs so hot?"
  if (
    /(?:why\s+is|why'?s)\s+(?:the\s+)?(?:upstairs|upstairs|second\s+floor|top\s+floor)\s+(?:so\s+)?(?:hot|warm|cold|cool)/i.test(
      q
    ) ||
    /(?:upstairs|second\s+floor|top\s+floor)\s+(?:is\s+)?(?:so\s+)?(?:hot|warm|cold|cool)/i.test(
      q
    ) ||
    /(?:why\s+is|why'?s)\s+(?:one\s+)?(?:floor|room)\s+(?:hotter|colder)\s+than\s+(?:the\s+)?(?:other|another)/i.test(
      q
    )
  ) {
    return {
      action: "explainStackEffect",
      reason:
        "User asking about temperature differences between floors - likely stack effect/stratification",
    };
  }

  // "Why is the little red flame icon on when it's 50 degrees out?"
  if (
    /(?:why\s+is|why'?s)\s+(?:the\s+)?(?:little\s+)?(?:red\s+)?(?:flame|fire)\s+icon\s+(?:on|lit)/i.test(
      q
    ) ||
    /(?:red\s+)?(?:flame|fire)\s+icon\s+(?:on|lit)\s+(?:when|at)\s+(\d+)\s+degrees?/i.test(
      q
    )
  ) {
    const match = q.match(
      /(?:red\s+)?(?:flame|fire)\s+icon\s+(?:on|lit)\s+(?:when|at)\s+(\d+)\s+degrees?/i
    );
    const temp = match ? parseInt(match[1], 10) : 50;
    if (temp >= 35) {
      return {
        action: "setAuxHeatMaxOutdoorTemp",
        value: 35,
        reason: `Aux heat running at ${temp}°F - locking out aux heat above 35°F to save money`,
      };
    }
    return {
      action: "checkAuxHeatUsage",
      reason: "Aux heat icon on - checking if it's running unnecessarily",
    };
  }

  // 4. Sleep Preferences
  // "The clicking keeps waking me up"
  if (
    /(?:the\s+)?(?:clicking|click|clicks)\s+(?:keeps?|kept)\s+(?:waking|wake|woke)\s+(?:me\s+)?(?:up|awake)/i.test(
      q
    ) ||
    /(?:waking|wake|woke)\s+(?:me\s+)?(?:up|awake)\s+(?:with|from)\s+(?:the\s+)?(?:clicking|click|clicks)/i.test(
      q
    )
  ) {
    return {
      action: "fixSleepCycling",
      reason:
        "Clicking noise waking you up - reducing cycles at night for quieter operation",
    };
  }

  // "I wake up sweating"
  if (
    /(?:i\s+)?(?:wake|waking)\s+(?:up\s+)?(?:sweating|sweaty|hot)/i.test(q) ||
    /(?:wake|waking)\s+up\s+(?:sweating|sweaty|hot)/i.test(q)
  ) {
    return {
      action: "setACOvercool",
      value: 4,
      reason:
        "Waking up sweaty - increasing AC overcool to 4°F for better nighttime dehumidification",
    };
  }

  // 5. Weird Physics Edge Cases
  // "My windows are fogging up inside"
  if (
    /(?:my|the)\s+(?:windows?|window)\s+(?:are|is)\s+(?:fogging|fogged|foggy)\s+(?:up\s+)?(?:inside|on\s+the\s+inside)/i.test(
      q
    ) ||
    /(?:windows?|window)\s+(?:fogging|fogged|foggy)\s+(?:inside|on\s+the\s+inside)/i.test(
      q
    )
  ) {
    return {
      action: "fixWindowFogging",
      reason:
        "Windows fogging up - humidity too high. Increasing dehumidification.",
    };
  }

  // "The air feels lukewarm" (Heat Pump complaint)
  if (
    /(?:the\s+)?air\s+feels?\s+(?:lukewarm|warm\s+but\s+not\s+hot|not\s+hot\s+enough)/i.test(
      q
    ) ||
    /(?:lukewarm|warm\s+but\s+not\s+hot)\s+air/i.test(q)
  ) {
    return {
      action: "setHeatDissipation",
      value: 60,
      reason:
        "Air feels lukewarm - heat pumps blow cooler air (95°F) than gas (130°F). Increasing fan runtime to mix air better.",
    };
  }

  // HVAC Mode Changes - Must come before generic "set temperature" patterns
  // Match: "turn off", "shut it down", "turn everything off", "turn off the furnace", "turn off thermostat", "set thermostat to off" (special case - must come first)
  if (
    /^turn\s+off\b/i.test(q) ||
    /^shut\s+it\s+down\s*$/i.test(q) ||
    /^turn\s+everything\s+off\s*$/i.test(q) ||
    /^turn\s+off\s+(?:the\s+)?(?:furnace|thermostat|system)\s*$/i.test(q) ||
    /^set\s+thermostat\s+to\s+off\s*$/i.test(q) ||
    /^turn\s+the\s+system\s+off/i.test(q)
  ) {
    return { action: "setMode", value: "off" };
  }
  
  // "turn on fan" - fan mode maps to auto
  if (/^turn\s+on\s+fan\s*$/i.test(q)) {
    return { action: "setMode", value: "auto", isCommand: true };
  }

  // "turn on AC" - AC means cool mode (MUST come before "turn on system")
  if (/^turn\s+on\s+ac\b/i.test(q)) {
    return { action: "setMode", value: "cool" };
  }

  // Fan control removed - HomeKit bridge doesn't support fan control

  // "turn the heat on" / "turn the heat off"
  if (/^turn\s+(?:the\s+)?heat\s+on\s*$/i.test(q)) {
    return { action: "setMode", value: "heat" };
  }
  if (/^turn\s+(?:the\s+)?heat\s+off\s*$/i.test(q)) {
    return { action: "setMode", value: "off" };
  }

  // "auto mode please" or "auto mode" (MUST come before "turn on system")
  // Also: "put the system in AUTO", "put system in auto"
  if (
    /^auto\s+mode(?:\s+please)?\s*$/i.test(q) ||
    /^switch\s+back\s+to\s+auto\s*$/i.test(q) ||
    /^put\s+(?:the\s+)?system\s+in\s+auto\s*$/i.test(q)
  ) {
    return { action: "setMode", value: "auto" };
  }

  // Match: "turn on the system" or "turn the system on" - defaults to "heat" mode (per test expectation)
  // This must come AFTER "turn on AC" and "turn on fan" to avoid conflicts
  // Only match if NOT followed by a mode word (heat, cool, auto)
  if (
    /^turn\s+on\s+(?:the\s+)?(?:system|hvac|thermostat)\b/i.test(q) ||
    /^turn\s+(?:the\s+)?(?:system|hvac|thermostat)\s+on\b/i.test(q) ||
    (/^turn\s+on\b/i.test(q) &&
      !/^turn\s+on\s+(?:heat|cool|auto|ac|fan)\b/i.test(q)) // Simple "turn on" without mode specified
  ) {
    return { action: "setMode", value: "heat" };
  }

  // Match: "set it to heat", "set mode to heat", "switch to heat", "change to heat", "turn on heat"
  // BUT NOT questions like "can I switch to auto mode" or "should I switch to heat"

  if (
    (isLikelyCommand || !isQuestionPattern) &&
    !/^(can\s+i|should\s+i)\s+/i.test(q) &&
    // Explicitly reject "can I switch to" patterns - these are questions
    !/^can\s+i\s+switch\s+to/i.test(q) &&
    // Also reject "can I" followed by any mode-changing verb
    !(
      /^can\s+i\s+(switch|change|set|turn|activate)/i.test(q) &&
      /(?:to|mode)/i.test(q)
    ) &&
    (buildModePattern().test(q) ||
      new RegExp(
        `^set\\s+system\\s+mode\\s+to\\s+${REGEX_PATTERNS.MODE_KEYWORDS}\\s*$`,
        "i"
      ).test(q))
  ) {
    let match = q.match(buildModePattern());
    if (!match) {
      const systemModePattern = new RegExp(
        `^set\\s+system\\s+mode\\s+to\\s+${REGEX_PATTERNS.MODE_KEYWORDS}\\s*$`,
        "i"
      );
      match = q.match(systemModePattern);
    }
    if (match) {
      const mode = match[1].toLowerCase();
      if (["heat", "cool", "auto", "off"].includes(mode)) {
        return { action: "setMode", value: mode };
      }
    }
  }

  // "change to cooling" - cooling = cool mode
  if (/^change\s+to\s+cooling\b/i.test(q)) {
    return { action: "setMode", value: "cool" };
  }
  // Also match: "set to heat", "go to heat", "put it in heat mode"
  if (
    /(?:set\s+to|go\s+to|put\s+(?:it|thermostat|system)\s+in)\s+(heat|cool|auto|off)\s*(?:mode)?\b/i.test(
      q
    )
  ) {
    const match = q.match(
      /(?:set\s+to|go\s+to|put\s+(?:it|thermostat|system)\s+in)\s+(heat|cool|auto|off)\s*(?:mode)?\b/i
    );
    if (match) {
      const mode = match[1].toLowerCase();
      if (["heat", "cool", "auto", "off"].includes(mode)) {
        return { action: "setMode", value: mode };
      }
    }
  }
  // Bare mode names: "heat mode", "cool mode", "auto mode"
  // BUT NOT "can I switch to auto mode" - that's a question
  if (
    !/^(can\s+i|should\s+i|how\s+do\s+i|how\s+can\s+i)\s+/i.test(q) &&
    /^(heat|cool|auto)\s+mode\s*$/i.test(q)
  ) {
    const match = q.match(/^(heat|cool|auto)\s+mode\s*$/i);
    if (match) {
      const mode = match[1].toLowerCase();
      return { action: "setMode", value: mode };
    }
  }

  // Preset modes (away/home/sleep) - these set temperature presets
  // Sleep mode
  if (
    /^(?:set\s+to\s+)?sleep\s+mode\s*$/i.test(q) ||
    /^go\s+to\s+sleep\s+mode\s*$/i.test(q) ||
    /^i'?m\s+going\s+to\s+sleep\s*$/i.test(q) ||
    /^goodnight\s*$/i.test(q)
  ) {
    return { action: "presetSleep", isCommand: true };
  }
  
  // Away mode
  if (
    /^(?:set\s+to\s+)?away\s+mode\s*$/i.test(q) ||
    /^go\s+to\s+away\s+mode\s*$/i.test(q) ||
    /^activate\s+away\s+mode\s*$/i.test(q) ||
    /^i'?m\s+leaving\s*$/i.test(q)
  ) {
    return { action: "presetAway", isCommand: true };
  }
  
  // Home mode
  if (
    /^(?:set\s+to\s+)?home\s+mode\s*$/i.test(q) ||
    /^go\s+to\s+home\s+mode\s*$/i.test(q) ||
    /^activate\s+home\s+mode\s*$/i.test(q) ||
    /^i'?m\s+home\s*$/i.test(q)
  ) {
    return { action: "presetHome", isCommand: true };
  }

  // Query current HVAC mode (must come before other queries)
  if (
    /what'?s?\s+(?:the\s+)?(?:current\s+)?(?:hvac\s+)?mode/i.test(q) ||
    /(?:current\s+)?(?:hvac\s+)?mode\s*[?]?$/i.test(q) ||
    /what\s+mode\s+(?:is\s+)?(?:it|the\s+system|the\s+thermostat)/i.test(q)
  ) {
    return { action: "queryMode" };
  }
  // Query HVAC status: "is the heat on" / "Is the heat on?"
  if (/^is\s+the\s+heat\s+on\s*[?]?$/i.test(q)) {
    return { action: "queryHvacStatus" };
  }
  // Query humidity: "what is the humidity" / "What is the humidity?"
  if (
    /^what\s+is\s+the\s+humidity\s*[?]?$/i.test(q) ||
    /^what'?s?\s+(?:my\s+)?(?:humidity|relative\s+humidity)\s*[?]?$/i.test(q)
  ) {
    return { action: "queryHumidity" };
  }

  // Query target/setpoint temperature (must come before current temp query)
  if (
    /what'?s?\s+(?:the\s+)?(?:target|setpoint|set\s+point|thermostat)\s+(?:temp|temperature)/i.test(
      q
    ) ||
    /(?:target|setpoint|set\s+point)\s+(?:temp|temperature)\s*[?]?$/i.test(q)
  ) {
    return { action: "queryTargetTemp" };
  }

  // Query temperature (supports pronouns from context)
  // Only match queries asking for CURRENT temperature, not "what temperature should X be"
  if (
    /what'?s?\s+(?:the\s+)?(?:current\s+)?(?:temp|temperature)(?:\s+now)?\s*[?]?$/i.test(
      q
    ) ||
    /how\s+(?:hot|cold|warm)\s+is\s+(?:it|the\s+room)/i.test(q) ||
    /(?:current|right\s+now|now)\s+(?:temp|temperature)/i.test(q)
  ) {
    return { action: "queryTemp" };
  }
  // Query current location
  if (
    /(?:what'?s?|show|tell\s+me|what\s+is)\s+(?:my\s+)?(?:current\s+)?location/i.test(
      q
    ) ||
    /(?:my\s+)?(?:current\s+)?location/i.test(q)
  ) {
    return { action: "queryLocation" };
  }

  // Query comfort settings - must come before threshold queries
  // Only match if it's a question (starts with question words), not a "set" command
  // Sleep Heat Setpoint
  if (
    !/^set\s+/i.test(q) &&
    (/(?:what'?s?|what\s+is|show\s+me|tell\s+me)\s+(?:my\s+)?(?:sleep|nighttime|night)\s+(?:heat\s+)?(?:setpoint|set\s+point|temp(?:erature)?)/i.test(
      q
    ) ||
      /^(?:my\s+)?(?:sleep|nighttime|night)\s+(?:heat\s+)?(?:setpoint|set\s+point|temp(?:erature)?)\s*$/i.test(
        q
      ))
  ) {
    return { action: "queryComfortSetting", setting: "sleep.heatSetPoint" };
  }
  // Sleep Cool Setpoint
  if (
    !/^set\s+/i.test(q) &&
    (/(?:what'?s?|what\s+is|show\s+me|tell\s+me)\s+(?:my\s+)?(?:sleep|nighttime|night)\s+(?:cool\s+)?(?:setpoint|set\s+point|temp(?:erature)?)/i.test(
      q
    ) ||
      /^(?:my\s+)?(?:sleep|nighttime|night)\s+(?:cool\s+)?(?:setpoint|set\s+point|temp(?:erature)?)\s*$/i.test(
        q
      ))
  ) {
    return { action: "queryComfortSetting", setting: "sleep.coolSetPoint" };
  }
  // Home Heat Setpoint
  if (
    !/^set\s+/i.test(q) &&
    (/(?:what'?s?|what\s+is|show\s+me|tell\s+me)\s+(?:my\s+)?(?:home|daytime|day)\s+(?:heat\s+)?(?:setpoint|set\s+point|temp(?:erature)?)/i.test(
      q
    ) ||
      /^(?:my\s+)?(?:home|daytime|day)\s+(?:heat\s+)?(?:setpoint|set\s+point|temp(?:erature)?)\s*$/i.test(
        q
      ))
  ) {
    return { action: "queryComfortSetting", setting: "home.heatSetPoint" };
  }
  // Home Cool Setpoint
  if (
    !/^set\s+/i.test(q) &&
    (/(?:what'?s?|what\s+is|show\s+me|tell\s+me)\s+(?:my\s+)?(?:home|daytime|day)\s+(?:cool\s+)?(?:setpoint|set\s+point|temp(?:erature)?)/i.test(
      q
    ) ||
      /^(?:my\s+)?(?:home|daytime|day)\s+(?:cool\s+)?(?:setpoint|set\s+point|temp(?:erature)?)\s*$/i.test(
        q
      ))
  ) {
    return { action: "queryComfortSetting", setting: "home.coolSetPoint" };
  }
  // Away Heat Setpoint
  if (
    !/^set\s+/i.test(q) &&
    (/(?:what'?s?|what\s+is|show\s+me|tell\s+me)\s+(?:my\s+)?(?:away)\s+(?:heat\s+)?(?:setpoint|set\s+point|temp(?:erature)?)/i.test(
      q
    ) ||
      /^(?:my\s+)?(?:away)\s+(?:heat\s+)?(?:setpoint|set\s+point|temp(?:erature)?)\s*$/i.test(
        q
      ))
  ) {
    return { action: "queryComfortSetting", setting: "away.heatSetPoint" };
  }
  // Away Cool Setpoint
  if (
    !/^set\s+/i.test(q) &&
    (/(?:what'?s?|what\s+is|show\s+me|tell\s+me)\s+(?:my\s+)?(?:away)\s+(?:cool\s+)?(?:setpoint|set\s+point|temp(?:erature)?)/i.test(
      q
    ) ||
      /^(?:my\s+)?(?:away)\s+(?:cool\s+)?(?:setpoint|set\s+point|temp(?:erature)?)\s*$/i.test(
        q
      ))
  ) {
    return { action: "queryComfortSetting", setting: "away.coolSetPoint" };
  }
  // Fan Mode queries (for all comfort settings)
  if (
    !/^set\s+/i.test(q) &&
    (/(?:what'?s?|what\s+is|show\s+me|tell\s+me)\s+(?:my\s+)?(?:sleep|nighttime|night)\s+fan\s+mode/i.test(
      q
    ) ||
      /^(?:my\s+)?(?:sleep|nighttime|night)\s+fan\s+mode\s*$/i.test(q))
  ) {
    return { action: "queryComfortSetting", setting: "sleep.fanMode" };
  }
  if (
    !/^set\s+/i.test(q) &&
    (/(?:what'?s?|what\s+is|show\s+me|tell\s+me)\s+(?:my\s+)?(?:home|daytime|day)\s+fan\s+mode/i.test(
      q
    ) ||
      /^(?:my\s+)?(?:home|daytime|day)\s+fan\s+mode\s*$/i.test(q))
  ) {
    return { action: "queryComfortSetting", setting: "home.fanMode" };
  }
  if (
    !/^set\s+/i.test(q) &&
    (/(?:what'?s?|what\s+is|show\s+me|tell\s+me)\s+(?:my\s+)?(?:away)\s+fan\s+mode/i.test(
      q
    ) ||
      /^(?:my\s+)?(?:away)\s+fan\s+mode\s*$/i.test(q))
  ) {
    return { action: "queryComfortSetting", setting: "away.fanMode" };
  }

  // Query threshold settings - must come before generic "what is" patterns
  // Only match if it's a question (starts with question words), not a "set" command
  // AC Overcool Max
  if (
    !/^set\s+/i.test(q) &&
    (/(?:what'?s?|what\s+is|show\s+me|tell\s+me)\s+(?:my\s+)?(?:ac\s+)?overcool\s+(?:max|setting)?/i.test(
      q
    ) ||
      /^(?:my\s+)?(?:ac\s+)?overcool\s*$/i.test(q))
  ) {
    return { action: "queryThreshold", setting: "acOvercoolMax" };
  }
  // Heat Differential
  if (
    !/^set\s+/i.test(q) &&
    (/(?:what'?s?|what\s+is|show\s+me|tell\s+me)\s+(?:my\s+)?heat\s+differential/i.test(
      q
    ) ||
      /^(?:my\s+)?heat\s+differential\s*$/i.test(q))
  ) {
    return { action: "queryThreshold", setting: "heatDifferential" };
  }
  // Cool Differential
  if (
    !/^set\s+/i.test(q) &&
    (/(?:what'?s?|what\s+is|show\s+me|tell\s+me)\s+(?:my\s+)?cool\s+differential/i.test(
      q
    ) ||
      /^(?:my\s+)?cool\s+differential\s*$/i.test(q))
  ) {
    return { action: "queryThreshold", setting: "coolDifferential" };
  }
  // Compressor Lockout
  if (
    !/^set\s+/i.test(q) &&
    (/(?:what'?s?|what\s+is|show\s+me|tell\s+me)\s+(?:my\s+)?(?:compressor\s+)?(?:lockout|min\s+outdoor\s+temp)/i.test(
      q
    ) ||
      /^(?:my\s+)?(?:compressor\s+)?lockout\s*$/i.test(q))
  ) {
    return { action: "queryThreshold", setting: "compressorMinOutdoorTemp" };
  }
  // Aux Heat Max Outdoor Temp
  if (
    !/^set\s+/i.test(q) &&
    (/(?:what'?s?|what\s+is|show\s+me|tell\s+me)\s+(?:my\s+)?(?:aux\s+heat\s+max\s+outdoor\s+temp|aux\s+heat\s+lockout)/i.test(
      q
    ) ||
      /^(?:my\s+)?aux\s+heat\s+lockout\s*$/i.test(q))
  ) {
    return { action: "queryThreshold", setting: "auxHeatMaxOutdoorTemp" };
  }
  // Heat/Cool Min Delta
  if (
    !/^set\s+/i.test(q) &&
    (/(?:what'?s?|what\s+is|show\s+me|tell\s+me)\s+(?:my\s+)?(?:heat[/\s-]?cool\s+min\s+delta|auto\s+min\s+delta)/i.test(
      q
    ) ||
      /^(?:my\s+)?(?:heat[/\s-]?cool\s+min\s+delta|auto\s+min\s+delta)\s*$/i.test(
        q
      ))
  ) {
    return { action: "queryThreshold", setting: "heatCoolMinDelta" };
  }
  // Temperature Correction (also handles "temp correct" variations)
  if (
    !/^set\s+/i.test(q) &&
    (/(?:what'?s?|what\s+is|show\s+me|tell\s+me)\s+(?:my\s+)?(?:temperature|temp)\s+(?:correction|correct)/i.test(
      q
    ) ||
      /^(?:my\s+)?(?:temperature|temp)\s+(?:correction|correct)\s*$/i.test(q) ||
      /temp\s+correct/i.test(q))
  ) {
    return { action: "queryThreshold", setting: "temperatureCorrection" };
  }
  // Humidity Correction (also handles "humidity correct" variations)
  if (
    !/^set\s+/i.test(q) &&
    (/(?:what'?s?|what\s+is|show\s+me|tell\s+me)\s+(?:my\s+)?humidity\s+(?:correction|correct)/i.test(
      q
    ) ||
      /^(?:my\s+)?humidity\s+(?:correction|correct)\s*$/i.test(q) ||
      /humidity\s+(?:correction|correct)/i.test(q))
  ) {
    return { action: "queryThreshold", setting: "humidityCorrection" };
  }
  // Thermal Protect (also handles "thermal correct" and "thermal correction")
  if (
    !/^set\s+/i.test(q) &&
    (/(?:what'?s?|what\s+is|show\s+me|tell\s+me)\s+(?:my\s+)?thermal\s+(?:protect|correct|correction)/i.test(
      q
    ) ||
      /^(?:my\s+)?thermal\s+(?:protect|correct|correction)\s*$/i.test(q) ||
      /thermal\s+correct/i.test(q))
  ) {
    // "thermal correct" or "thermal correction" likely refers to Thermal Protect
    // (the setting that ignores bad sensor readings based on temperature difference)
    return { action: "queryThreshold", setting: "thermalProtect" };
  }
  // Compressor Stage 2 Delta
  if (
    !/^set\s+/i.test(q) &&
    (/(?:what'?s?|what\s+is|show\s+me|tell\s+me)\s+(?:my\s+)?compressor\s+stage\s+2\s+delta/i.test(
      q
    ) ||
      /^(?:my\s+)?compressor\s+stage\s+2\s+delta\s*$/i.test(q))
  ) {
    return { action: "queryThreshold", setting: "compressorStage2Delta" };
  }
  // Heat Stage 2 Delta
  if (
    !/^set\s+/i.test(q) &&
    (/(?:what'?s?|what\s+is|show\s+me|tell\s+me)\s+(?:my\s+)?heat\s+stage\s+2\s+delta/i.test(
      q
    ) ||
      /^(?:my\s+)?heat\s+stage\s+2\s+delta\s*$/i.test(q))
  ) {
    return { action: "queryThreshold", setting: "heatStage2Delta" };
  }
  // Aux Stage 2 Delta
  if (
    !/^set\s+/i.test(q) &&
    (/(?:what'?s?|what\s+is|show\s+me|tell\s+me)\s+(?:my\s+)?aux\s+stage\s+2\s+delta/i.test(
      q
    ) ||
      /^(?:my\s+)?aux\s+stage\s+2\s+delta\s*$/i.test(q))
  ) {
    return { action: "queryThreshold", setting: "auxStage2Delta" };
  }

  // Plain number + degrees (e.g., "72 degrees" - ambiguous but common)
  // Only match if it's a standalone command, not part of a question
  if (
    !/^(how|what|why|when|where|who|which|can|should|do|does|is|are|will|would|could)/i.test(
      q
    )
  ) {
    const rePlain = /^(\d{2})\s*degrees?\s*$/iu;
    const mPlain = q.match(rePlain);
    if (mPlain) {
      const value = parseInt(mPlain[1], 10);
      if (value >= 45 && value <= 85) {
        return { action: "setWinterTemp", value, confidence: 0.7 };
      }
    }
  }

  // Direct setting commands
  // Compressor lockout/cutoff temperature - MUST come before generic "set temperature" patterns
  if (
    /set\s+(?:compressor\s+)?(?:lockout|cutoff|min\s+outdoor\s+temp)(?:\s+temp(?:erature)?)?\s+(?:to\s+)?(-?\d{1,2})/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+(?:compressor\s+)?(?:lockout|cutoff|min\s+outdoor\s+temp)(?:\s+temp(?:erature)?)?\s+(?:to\s+)?(-?\d{1,2})/i
    );
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= TEMP_LIMITS.MIN_OUTDOOR && temp <= TEMP_LIMITS.MAX_OUTDOOR) {
        return { action: "setCompressorLockout", value: temp };
      }
    }
  }
  // Also handle "set temperature compressor cutoff" format
  if (
    /set\s+temp(?:erature)?\s+compressor\s+(?:lockout|cutoff|min\s+outdoor\s+temp)\s+(?:to\s+)?(-?\d{1,2})/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+temp(?:erature)?\s+compressor\s+(?:lockout|cutoff|min\s+outdoor\s+temp)\s+(?:to\s+)?(-?\d{1,2})/i
    );
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= TEMP_LIMITS.MIN_OUTDOOR && temp <= TEMP_LIMITS.MAX_OUTDOOR) {
        return { action: "setCompressorLockout", value: temp };
      }
    }
  }

  // These patterns are now handled earlier (before question rejection)
  // Keeping this as a fallback for edge cases
  if (
    /set\s+(?:my\s+)?(?:temp|temperature|thermostat)(?:\s+to)?\s+(\d{2})\b/i.test(
      q
    ) &&
    !/(?:winter|summer|nighttime|daytime|night|day|sleep|home|compressor|heat|cool)/i.test(
      q
    )
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
  // "what if HSPF was X" variation
  if (/what\s+if\s+(?:hspf|hspf2?)\s+(?:was|is)\s+(\d+\.?\d*)/i.test(q)) {
    const match = q.match(
      /what\s+if\s+(?:hspf|hspf2?)\s+(?:was|is)\s+(\d+\.?\d*)/i
    );
    return { action: "whatIfHSPF", value: parseFloat(match[1]) };
  }
  if (/set\s+(?:hspf|hspf2?)\s+(?:to\s+)?(\d+\.?\d*)/i.test(q)) {
    const match = q.match(/set\s+(?:hspf|hspf2?)\s+(?:to\s+)?(\d+\.?\d*)/i);
    return { action: "setHSPF", value: parseFloat(match[1]) };
  }
  // "what if SEER was X" variation
  if (/what\s+if\s+(?:seer|efficiency)\s+(?:was|is)\s+(\d+\.?\d*)/i.test(q)) {
    const match = q.match(
      /what\s+if\s+(?:seer|efficiency)\s+(?:was|is)\s+(\d+\.?\d*)/i
    );
    return { action: "whatIfSEER", value: parseFloat(match[1]) };
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
  // Set square-feet / home size
  if (
    /set\s+(?:square\s*feet|sq\s*ft|sqft|square\s*footage|sf|home\s+size)\s+(?:to\s+)?(\d{1,3}(?:,\d{3})?|\d+(?:\.\d+)?k?)\b/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+(?:square\s*feet|sq\s*ft|sqft|square\s*footage|sf|home\s+size)\s+(?:to\s+)?(\d{1,3}(?:,\d{3})?|\d+(?:\.\d+)?k?)\b/i
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
  // "change to X tons" variation
  if (
    /(?:change|set|update)\s+(?:to|capacity\s+to)\s+(\d{1,2})\s+tons?/i.test(q)
  ) {
    const m = q.match(
      /(?:change|set|update)\s+(?:to|capacity\s+to)\s+(\d{1,2})\s+tons?/i
    );
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
  // Compressor min runtime (threshold) and cycle off time
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
  // "set cycle off time to X minutes" / "set min off time to X seconds"
  if (
    /set\s+cycle\s+off\s+time\s+(?:to\s+)?(\d+)\s*(?:minutes?|mins?|min)/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+cycle\s+off\s+time\s+(?:to\s+)?(\d+)\s*(?:minutes?|mins?|min)/i
    );
    if (m)
      return { action: "setCompressorMinCycleOff", value: Number(m[1]) * 60 };
  }
  if (
    /set\s+min\s+off\s+time\s+(?:to\s+)?(\d+)\s*(?:seconds?|secs?)/i.test(q)
  ) {
    const m = q.match(
      /set\s+min\s+off\s+time\s+(?:to\s+)?(\d+)\s*(?:seconds?|secs?)/i
    );
    if (m) return { action: "setCompressorMinCycleOff", value: Number(m[1]) };
  }
  // Heat Differential - handle "set differential", "set heat differential", "change heat diff"
  if (/set\s+differential\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*°?f?/i.test(q)) {
    const m = q.match(/set\s+differential\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*°?f?/i);
    if (m) return { action: "setHeatDifferential", value: parseFloat(m[1]) };
  }
  if (/set\s+heat\s+differential\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*°?f?/i.test(q)) {
    const m = q.match(
      /set\s+heat\s+differential\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*°?f?/i
    );
    if (m) return { action: "setHeatDifferential", value: parseFloat(m[1]) };
  }
  if (/change\s+heat\s+diff\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*°?f?/i.test(q)) {
    const m = q.match(
      /change\s+heat\s+diff\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*°?f?/i
    );
    if (m) return { action: "setHeatDifferential", value: parseFloat(m[1]) };
  }
  // Cool Differential
  if (
    /set\s+cool(?:ing)?\s+differential\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*°?f?/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+cool(?:ing)?\s+differential\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*°?f?/i
    );
    if (m) return { action: "setCoolDifferential", value: parseFloat(m[1]) };
  }
  // AC Overcool Max - handle both "set AC overcool" and "set AC Overcool Max"
  if (
    /set\s+ac\s+overcool\s+(?:max\s+)?(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:degrees?|°f?)?/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+ac\s+overcool\s+(?:max\s+)?(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:degrees?|°f?)?/i
    );
    if (m) return { action: "setACOvercool", value: parseFloat(m[1]) };
  }
  // Temperature Correction
  // Handles: "calibrate temperature by X", "calibrate temp by X", "set temperature correction to X", "set temp correct to X"
  if (
    /calibrate\s+(?:temperature|temp)\s+by\s+(-?\d+(?:\.\d+)?)\s*(?:degrees?|°f?)?/i.test(
      q
    )
  ) {
    const m = q.match(
      /calibrate\s+(?:temperature|temp)\s+by\s+(-?\d+(?:\.\d+)?)\s*(?:degrees?|°f?)?/i
    );
    if (m)
      return { action: "setTemperatureCorrection", value: parseFloat(m[1]) };
  }
  if (
    /set\s+(?:temperature|temp)\s+(?:correction|correct)\s+(?:to\s+)?(-?\d+(?:\.\d+)?)\s*(?:degrees?|°f?)?/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+(?:temperature|temp)\s+(?:correction|correct)\s+(?:to\s+)?(-?\d+(?:\.\d+)?)\s*(?:degrees?|°f?)?/i
    );
    if (m)
      return { action: "setTemperatureCorrection", value: parseFloat(m[1]) };
  }
  // Heat Min On Time
  if (
    /set\s+heat\s+min\s+on\s+time\s+(?:to\s+)?(\d+)\s*(?:minutes?|mins?|min)/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+heat\s+min\s+on\s+time\s+(?:to\s+)?(\d+)\s*(?:minutes?|mins?|min)/i
    );
    if (m) return { action: "setHeatMinOnTime", value: Number(m[1]) * 60 }; // Convert to seconds
  }
  if (
    /set\s+heat\s+min\s+on\s+time\s+(?:to\s+)?(\d+)\s*(?:seconds?|secs?)/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+heat\s+min\s+on\s+time\s+(?:to\s+)?(\d+)\s*(?:seconds?|secs?)/i
    );
    if (m) return { action: "setHeatMinOnTime", value: Number(m[1]) };
  }
  // Compressor Min On Time
  if (
    /set\s+compressor\s+min\s+on\s+time\s+(?:to\s+)?(\d+)\s*(?:minutes?|mins?|min)/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+compressor\s+min\s+on\s+time\s+(?:to\s+)?(\d+)\s*(?:minutes?|mins?|min)/i
    );
    if (m)
      return { action: "setCompressorMinOnTime", value: Number(m[1]) * 60 }; // Convert to seconds
  }
  if (
    /set\s+compressor\s+min\s+on\s+time\s+(?:to\s+)?(\d+)\s*(?:seconds?|secs?)/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+compressor\s+min\s+on\s+time\s+(?:to\s+)?(\d+)\s*(?:seconds?|secs?)/i
    );
    if (m) return { action: "setCompressorMinOnTime", value: Number(m[1]) };
  }
  // Compressor Min Off Time (already exists as setCompressorMinRuntime, but add alias)
  if (
    /set\s+compressor\s+min\s+off\s+time\s+(?:to\s+)?(\d+)\s*(?:minutes?|mins?|min)/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+compressor\s+min\s+off\s+time\s+(?:to\s+)?(\d+)\s*(?:minutes?|mins?|min)/i
    );
    if (m)
      return { action: "setCompressorMinCycleOff", value: Number(m[1]) * 60 }; // Convert to seconds
  }
  if (
    /set\s+compressor\s+min\s+off\s+time\s+(?:to\s+)?(\d+)\s*(?:seconds?|secs?)/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+compressor\s+min\s+off\s+time\s+(?:to\s+)?(\d+)\s*(?:seconds?|secs?)/i
    );
    if (m) return { action: "setCompressorMinCycleOff", value: Number(m[1]) };
  }
  // Cool Min On Time
  if (
    /set\s+cool\s+min\s+on\s+time\s+(?:to\s+)?(\d+)\s*(?:minutes?|mins?|min)/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+cool\s+min\s+on\s+time\s+(?:to\s+)?(\d+)\s*(?:minutes?|mins?|min)/i
    );
    if (m) return { action: "setCoolMinOnTime", value: Number(m[1]) * 60 }; // Convert to seconds
  }
  if (
    /set\s+cool\s+min\s+on\s+time\s+(?:to\s+)?(\d+)\s*(?:seconds?|secs?)/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+cool\s+min\s+on\s+time\s+(?:to\s+)?(\d+)\s*(?:seconds?|secs?)/i
    );
    if (m) return { action: "setCoolMinOnTime", value: Number(m[1]) };
  }
  // AC Min On Time (alias for cool)
  if (
    /set\s+ac\s+min\s+on\s+time\s+(?:to\s+)?(\d+)\s*(?:minutes?|mins?|min)/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+ac\s+min\s+on\s+time\s+(?:to\s+)?(\d+)\s*(?:minutes?|mins?|min)/i
    );
    if (m) return { action: "setCoolMinOnTime", value: Number(m[1]) * 60 };
  }
  if (
    /set\s+ac\s+min\s+on\s+time\s+(?:to\s+)?(\d+)\s*(?:seconds?|secs?)/i.test(q)
  ) {
    const m = q.match(
      /set\s+ac\s+min\s+on\s+time\s+(?:to\s+)?(\d+)\s*(?:seconds?|secs?)/i
    );
    if (m) return { action: "setCoolMinOnTime", value: Number(m[1]) };
  }
  // Heat Dissipation Time - handle "set dissipation to 60s"
  if (
    /set\s+(?:heat\s+)?dissipation\s+(?:to\s+)?(\d+)\s*(?:seconds?|secs?|s\b)/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+(?:heat\s+)?dissipation\s+(?:to\s+)?(\d+)\s*(?:seconds?|secs?|s\b)/i
    );
    if (m) return { action: "setHeatDissipation", value: Number(m[1]) };
  }
  // Aux Heat Max Outdoor Temperature (lock out aux heat above X)
  if (/lock\s+out\s+aux\s+heat\s+above\s+(\d+)\s*(?:degrees?|°f?)?/i.test(q)) {
    const m = q.match(
      /lock\s+out\s+aux\s+heat\s+above\s+(\d+)\s*(?:degrees?|°f?)?/i
    );
    if (m) return { action: "setAuxHeatMaxOutdoorTemp", value: Number(m[1]) };
  }
  if (
    /set\s+aux\s+(?:heat\s+)?lockout\s+(?:to\s+)?(\d+)\s*(?:degrees?|°f?)?/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+aux\s+(?:heat\s+)?lockout\s+(?:to\s+)?(\d+)\s*(?:degrees?|°f?)?/i
    );
    if (m) return { action: "setAuxHeatMaxOutdoorTemp", value: Number(m[1]) };
  }
  if (
    /set\s+aux\s+heat\s+max\s+outdoor\s+temp(?:erature)?\s+(?:to\s+)?(\d+)\s*(?:degrees?|°f?)?/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+aux\s+heat\s+max\s+outdoor\s+temp(?:erature)?\s+(?:to\s+)?(\d+)\s*(?:degrees?|°f?)?/i
    );
    if (m) return { action: "setAuxHeatMaxOutdoorTemp", value: Number(m[1]) };
  }
  // Compressor Min Outdoor Temperature (lock out compressor below X)
  // Also handle "set balance point to X" (balance point = compressor lockout)
  if (
    /set\s+balance\s+point\s+(?:to\s+)?(-?\d+)\s*(?:degrees?|°f?)?/i.test(q)
  ) {
    const m = q.match(
      /set\s+balance\s+point\s+(?:to\s+)?(-?\d+)\s*(?:degrees?|°f?)?/i
    );
    if (m) return { action: "setCompressorLockout", value: Number(m[1]) };
  }
  if (
    /lock\s+out\s+compressor\s+below\s+(-?\d+)\s*(?:degrees?|°f?)?/i.test(q)
  ) {
    const m = q.match(
      /lock\s+out\s+compressor\s+below\s+(-?\d+)\s*(?:degrees?|°f?)?/i
    );
    if (m) return { action: "setCompressorLockout", value: Number(m[1]) };
  }
  // Compressor to Aux Temperature Delta
  if (
    /set\s+compressor\s+to\s+aux\s+delta\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:degrees?|°f?)?/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+compressor\s+to\s+aux\s+delta\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:degrees?|°f?)?/i
    );
    if (m)
      return { action: "setCompressorToAuxDelta", value: parseFloat(m[1]) };
  }
  // Compressor to Aux Runtime
  if (
    /set\s+compressor\s+to\s+aux\s+runtime\s+(?:to\s+)?(\d+)\s*(?:minutes?|mins?|min|seconds?|secs?)/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+compressor\s+to\s+aux\s+runtime\s+(?:to\s+)?(\d+)\s*(?:minutes?|mins?|min|seconds?|secs?)/i
    );
    if (m) {
      const val = Number(m[1]);
      const unit = q.match(/(?:minutes?|mins?|min)/i) ? val * 60 : val;
      return { action: "setCompressorToAuxRuntime", value: unit };
    }
  }
  // Aux Stage 2 Temperature Delta
  if (
    /set\s+aux\s+stage\s+2\s+delta\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:degrees?|°f?)?/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+aux\s+stage\s+2\s+delta\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:degrees?|°f?)?/i
    );
    if (m) return { action: "setAuxStage2Delta", value: parseFloat(m[1]) };
  }
  // Aux Stage 1 Max Runtime
  if (
    /set\s+aux\s+stage\s+1\s+max\s+runtime\s+(?:to\s+)?(\d+)\s*(?:minutes?|mins?|min|seconds?|secs?)/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+aux\s+stage\s+1\s+max\s+runtime\s+(?:to\s+)?(\d+)\s*(?:minutes?|mins?|min|seconds?|secs?)/i
    );
    if (m) {
      const val = Number(m[1]);
      const unit = q.match(/(?:minutes?|mins?|min)/i) ? val * 60 : val;
      return { action: "setAuxStage1MaxRuntime", value: unit };
    }
  }
  // Aux Heat Min On Time
  if (
    /set\s+aux\s+heat\s+min\s+on\s+time\s+(?:to\s+)?(\d+)\s*(?:minutes?|mins?|min)/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+aux\s+heat\s+min\s+on\s+time\s+(?:to\s+)?(\d+)\s*(?:minutes?|mins?|min)/i
    );
    if (m) return { action: "setAuxHeatMinOnTime", value: Number(m[1]) * 60 };
  }
  if (
    /set\s+aux\s+heat\s+min\s+on\s+time\s+(?:to\s+)?(\d+)\s*(?:seconds?|secs?)/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+aux\s+heat\s+min\s+on\s+time\s+(?:to\s+)?(\d+)\s*(?:seconds?|secs?)/i
    );
    if (m) return { action: "setAuxHeatMinOnTime", value: Number(m[1]) };
  }
  // Heat/Cool Min Delta (Auto mode) - handles "heat/cool", "heat cool", "heat-cool"
  if (
    /set\s+heat[/\s-]?cool\s+min\s+delta\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:degrees?|°f?)?/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+heat[/\s-]?cool\s+min\s+delta\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:degrees?|°f?)?/i
    );
    if (m) return { action: "setHeatCoolMinDelta", value: parseFloat(m[1]) };
  }
  // Cool Dissipation Time
  if (
    /set\s+cool\s+dissipation\s+(?:to\s+)?(\d+)\s*(?:seconds?|secs?)/i.test(q)
  ) {
    const m = q.match(
      /set\s+cool\s+dissipation\s+(?:to\s+)?(\d+)\s*(?:seconds?|secs?)/i
    );
    if (m) return { action: "setCoolDissipation", value: Number(m[1]) };
  }
  // Heat Stage 2 Temperature Delta
  if (
    /set\s+heat\s+stage\s+2\s+delta\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:degrees?|°f?)?/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+heat\s+stage\s+2\s+delta\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:degrees?|°f?)?/i
    );
    if (m) return { action: "setHeatStage2Delta", value: parseFloat(m[1]) };
  }
  // Heat Stage 1 Max Runtime
  if (
    /set\s+heat\s+stage\s+1\s+max\s+runtime\s+(?:to\s+)?(\d+)\s*(?:minutes?|mins?|min|seconds?|secs?)/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+heat\s+stage\s+1\s+max\s+runtime\s+(?:to\s+)?(\d+)\s*(?:minutes?|mins?|min|seconds?|secs?)/i
    );
    if (m) {
      const val = Number(m[1]);
      const unit = q.match(/(?:minutes?|mins?|min)/i) ? val * 60 : val;
      return { action: "setHeatStage1MaxRuntime", value: unit };
    }
  }
  // Compressor Stage 2 Temperature Delta
  if (
    /set\s+compressor\s+stage\s+2\s+delta\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:degrees?|°f?)?/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+compressor\s+stage\s+2\s+delta\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:degrees?|°f?)?/i
    );
    if (m)
      return { action: "setCompressorStage2Delta", value: parseFloat(m[1]) };
  }
  // Compressor Stage 1 Max Runtime
  if (
    /set\s+compressor\s+stage\s+1\s+max\s+runtime\s+(?:to\s+)?(\d+)\s*(?:minutes?|mins?|min|seconds?|secs?)/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+compressor\s+stage\s+1\s+max\s+runtime\s+(?:to\s+)?(\d+)\s*(?:minutes?|mins?|min|seconds?|secs?)/i
    );
    if (m) {
      const val = Number(m[1]);
      const unit = q.match(/(?:minutes?|mins?|min)/i) ? val * 60 : val;
      return { action: "setCompressorStage1MaxRuntime", value: unit };
    }
  }
  // Heat Reverse Staging
  if (/(?:enable|turn\s+on)\s+heat\s+reverse\s+staging/i.test(q)) {
    return { action: "setHeatReverseStaging", value: true };
  }
  if (/(?:disable|turn\s+off)\s+heat\s+reverse\s+staging/i.test(q)) {
    return { action: "setHeatReverseStaging", value: false };
  }
  // Aux Reverse Staging
  if (/(?:enable|turn\s+on)\s+aux\s+reverse\s+staging/i.test(q)) {
    return { action: "setAuxReverseStaging", value: true };
  }
  if (/(?:disable|turn\s+off)\s+aux\s+reverse\s+staging/i.test(q)) {
    return { action: "setAuxReverseStaging", value: false };
  }
  // Humidity Correction (also handles "humidity correct" variations)
  if (
    /set\s+humidity\s+(?:correction|correct)\s+(?:to\s+)?(-?\d+(?:\.\d+)?)\s*(?:percent|%)?/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+humidity\s+(?:correction|correct)\s+(?:to\s+)?(-?\d+(?:\.\d+)?)\s*(?:percent|%)?/i
    );
    if (m) return { action: "setHumidityCorrection", value: parseFloat(m[1]) };
  }
  // Thermal Protect (enable/disable or set value)
  // Also handles "thermal correct" and "thermal correction" variations
  if (
    /(?:enable|turn\s+on)\s+thermal\s+(?:protect|correct|correction)/i.test(q)
  ) {
    return { action: "setThermalProtect", value: true };
  }
  if (
    /(?:disable|turn\s+off)\s+thermal\s+(?:protect|correct|correction)/i.test(q)
  ) {
    return { action: "setThermalProtect", value: false };
  }
  // Set Thermal Protect value (temperature difference threshold)
  // Handles: "set thermal protect to X", "set thermal correct to X", "set thermal correction to X"
  if (
    /set\s+thermal\s+(?:protect|correct|correction)\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:degrees?|°f?)?/i.test(
      q
    )
  ) {
    const m = q.match(
      /set\s+thermal\s+(?:protect|correct|correction)\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:degrees?|°f?)?/i
    );
    if (m) return { action: "setThermalProtectValue", value: parseFloat(m[1]) };
  }
  // Compressor Reverse Staging
  if (/(?:enable|turn\s+on)\s+compressor\s+reverse\s+staging/i.test(q)) {
    return { action: "setCompressorReverseStaging", value: true };
  }
  if (/(?:disable|turn\s+off)\s+compressor\s+reverse\s+staging/i.test(q)) {
    return { action: "setCompressorReverseStaging", value: false };
  }
  // Optimization Commands
  // "optimize my schedule for comfort first" / "optimize my schedule for savings first"
  if (
    /optimize\s+(?:my\s+)?schedule\s+for\s+(?:comfort|savings|efficiency)\s+(?:first)?/i.test(
      q
    )
  ) {
    const match = q.match(
      /optimize\s+(?:my\s+)?schedule\s+for\s+(comfort|savings|efficiency)/i
    );
    if (match) {
      const mode = match[1].toLowerCase();
      if (mode === "comfort") {
        return { action: "optimizeForComfort" };
      } else {
        return { action: "optimizeForEfficiency" };
      }
    }
  }
  if (/optimize\s+for\s+efficiency/i.test(q)) {
    return { action: "optimizeForEfficiency" };
  }
  if (/optimize\s+for\s+comfort/i.test(q)) {
    return { action: "optimizeForComfort" };
  }
  if (/protect\s+(?:my\s+)?compressor/i.test(q)) {
    return { action: "protectCompressor" };
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
  // Also: "drop my nighttime setpoint to 65"
  if (
    /set\s+(?:nighttime|night|sleep)\s+temp(?:erature)?\s+(?:to\s+)?(\d{2})/i.test(
      q
    ) ||
    /drop\s+(?:my\s+)?(?:nighttime|night|sleep)\s+setpoint\s+(?:to\s+)?(\d{2})/i.test(
      q
    )
  ) {
    let match = q.match(
      /set\s+(?:nighttime|night|sleep)\s+temp(?:erature)?\s+(?:to\s+)?(\d{2})/i
    );
    if (!match) {
      match = q.match(
        /drop\s+(?:my\s+)?(?:nighttime|night|sleep)\s+setpoint\s+(?:to\s+)?(\d{2})/i
      );
    }
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= TEMP_LIMITS.MIN && temp <= TEMP_LIMITS.MAX) {
        return { action: "setNighttimeTemperature", value: temp };
      }
    }
  }

  // Set daytime temperature / home temperature
  // Also: "set day temp to 70 and night temp to 66"
  if (
    /set\s+(?:daytime|day|home)\s+temp(?:erature)?\s+(?:to\s+)?(\d{2})/i.test(
      q
    ) ||
    /set\s+day\s+temp\s+to\s+(\d{2})\s+and\s+night\s+temp\s+to\s+(\d{2})/i.test(
      q
    )
  ) {
    // Check for combined "day temp to X and night temp to Y" first
    const combinedMatch = q.match(
      /set\s+day\s+temp\s+to\s+(\d{2})\s+and\s+night\s+temp\s+to\s+(\d{2})/i
    );
    if (combinedMatch) {
      const dayTemp = parseInt(combinedMatch[1], 10);
      const nightTemp = parseInt(combinedMatch[2], 10);
      if (
        dayTemp >= 45 &&
        dayTemp <= 85 &&
        nightTemp >= 45 &&
        nightTemp <= 85
      ) {
        // Return both - this might need special handling in the action handler
        return { action: "setDayAndNightTemp", dayTemp, nightTemp };
      }
    }
    const match = q.match(
      /set\s+(?:daytime|day|home)\s+temp(?:erature)?\s+(?:to\s+)?(\d{2})/i
    );
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= TEMP_LIMITS.MIN && temp <= TEMP_LIMITS.MAX) {
        return { action: "setDaytimeTemperature", value: temp };
      }
    }
  }

  // Set sleep heat setpoint (explicit)
  if (
    /set\s+(?:sleep|nighttime|night)\s+heat\s+(?:setpoint|set\s+point|temp(?:erature)?)\s+(?:to\s+)?(\d{2})/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+(?:sleep|nighttime|night)\s+heat\s+(?:setpoint|set\s+point|temp(?:erature)?)\s+(?:to\s+)?(\d{2})/i
    );
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= TEMP_LIMITS.MIN && temp <= TEMP_LIMITS.MAX) {
        return { action: "setNighttimeTemperature", value: temp };
      }
    }
  }

  // Set sleep cool setpoint
  if (
    /set\s+(?:sleep|nighttime|night)\s+cool\s+(?:setpoint|set\s+point|temp(?:erature)?)\s+(?:to\s+)?(\d{2})/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+(?:sleep|nighttime|night)\s+cool\s+(?:setpoint|set\s+point|temp(?:erature)?)\s+(?:to\s+)?(\d{2})/i
    );
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= TEMP_LIMITS.MIN && temp <= TEMP_LIMITS.MAX) {
        return { action: "setSleepCoolSetpoint", value: temp };
      }
    }
  }

  // Set home heat setpoint (explicit)
  if (
    /set\s+(?:home|daytime|day)\s+heat\s+(?:setpoint|set\s+point|temp(?:erature)?)\s+(?:to\s+)?(\d{2})/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+(?:home|daytime|day)\s+heat\s+(?:setpoint|set\s+point|temp(?:erature)?)\s+(?:to\s+)?(\d{2})/i
    );
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= TEMP_LIMITS.MIN && temp <= TEMP_LIMITS.MAX) {
        return { action: "setDaytimeTemperature", value: temp };
      }
    }
  }

  // Set home cool setpoint
  if (
    /set\s+(?:home|daytime|day)\s+cool\s+(?:setpoint|set\s+point|temp(?:erature)?)\s+(?:to\s+)?(\d{2})/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+(?:home|daytime|day)\s+cool\s+(?:setpoint|set\s+point|temp(?:erature)?)\s+(?:to\s+)?(\d{2})/i
    );
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= TEMP_LIMITS.MIN && temp <= TEMP_LIMITS.MAX) {
        return { action: "setHomeCoolSetpoint", value: temp };
      }
    }
  }

  // Set away heat setpoint
  if (
    /set\s+away\s+heat\s+(?:setpoint|set\s+point|temp(?:erature)?)\s+(?:to\s+)?(\d{2})/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+away\s+heat\s+(?:setpoint|set\s+point|temp(?:erature)?)\s+(?:to\s+)?(\d{2})/i
    );
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= TEMP_LIMITS.MIN && temp <= TEMP_LIMITS.MAX) {
        return { action: "setAwayHeatSetpoint", value: temp };
      }
    }
  }

  // Set away cool setpoint
  if (
    /set\s+away\s+cool\s+(?:setpoint|set\s+point|temp(?:erature)?)\s+(?:to\s+)?(\d{2})/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+away\s+cool\s+(?:setpoint|set\s+point|temp(?:erature)?)\s+(?:to\s+)?(\d{2})/i
    );
    if (match) {
      const temp = parseInt(match[1], 10);
      if (temp >= TEMP_LIMITS.MIN && temp <= TEMP_LIMITS.MAX) {
        return { action: "setAwayCoolSetpoint", value: temp };
      }
    }
  }

  // Set fan mode for comfort settings
  if (
    /set\s+(?:sleep|nighttime|night)\s+fan\s+mode\s+(?:to\s+)?(auto|on)/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+(?:sleep|nighttime|night)\s+fan\s+mode\s+(?:to\s+)?(auto|on)/i
    );
    if (match) {
      return { action: "setSleepFanMode", value: match[1].toLowerCase() };
    }
  }
  if (
    /set\s+(?:home|daytime|day)\s+fan\s+mode\s+(?:to\s+)?(auto|on)/i.test(q)
  ) {
    const match = q.match(
      /set\s+(?:home|daytime|day)\s+fan\s+mode\s+(?:to\s+)?(auto|on)/i
    );
    if (match) {
      return { action: "setHomeFanMode", value: match[1].toLowerCase() };
    }
  }
  if (/set\s+away\s+fan\s+mode\s+(?:to\s+)?(auto|on)/i.test(q)) {
    const match = q.match(/set\s+away\s+fan\s+mode\s+(?:to\s+)?(auto|on)/i);
    if (match) {
      return { action: "setAwayFanMode", value: match[1].toLowerCase() };
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

  // Enable/Disable Schedule
  if (/(?:enable|turn\s+on)\s+(?:the\s+)?schedule/i.test(q)) {
    return { action: "setScheduleEnabled", value: true };
  }
  if (/(?:disable|turn\s+off)\s+(?:the\s+)?schedule/i.test(q)) {
    return { action: "setScheduleEnabled", value: false };
  }

  // Add schedule entry: "set schedule for monday at 8am to home"
  if (
    /(?:add|set)\s+(?:schedule\s+entry\s+for\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+to\s+(home|away|sleep)/i.test(
      q
    )
  ) {
    const match = q.match(
      /(?:add|set)\s+(?:schedule\s+entry\s+for\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+to\s+(home|away|sleep)/i
    );
    if (match) {
      const dayName = match[1].toLowerCase();
      let hours = parseInt(match[2], 10);
      const minutes = match[3] ? parseInt(match[3], 10) : 0;
      const period = (match[4] || "").toLowerCase();
      const comfortSetting = match[5].toLowerCase();

      const dayMap = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      };

      // Convert to 24-hour format
      if (period === "pm" && hours !== 12) hours += 12;
      if (period === "am" && hours === 12) hours = 0;

      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        const timeStr = `${String(hours).padStart(2, "0")}:${String(
          minutes
        ).padStart(2, "0")}`;
        return {
          action: "addScheduleEntry",
          day: dayMap[dayName],
          time: timeStr,
          comfortSetting,
        };
      }
    }
  }

  // Clear schedule for a day: "clear schedule for monday"
  if (
    /clear\s+(?:schedule\s+for\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i.test(
      q
    )
  ) {
    const match = q.match(
      /clear\s+(?:schedule\s+for\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i
    );
    if (match) {
      const dayName = match[1].toLowerCase();
      const dayMap = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      };
      return { action: "clearScheduleDay", day: dayMap[dayName] };
    }
  }

  // Copy schedule: "copy schedule from monday to tuesday"
  if (
    /copy\s+schedule\s+from\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+to\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i.test(
      q
    )
  ) {
    const match = q.match(
      /copy\s+schedule\s+from\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+to\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i
    );
    if (match) {
      const dayMap = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      };
      return {
        action: "copyScheduleDay",
        fromDay: dayMap[match[1].toLowerCase()],
        toDay: dayMap[match[2].toLowerCase()],
      };
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
    // Also check for "in X years" pattern
    const yearsMatch = q.match(/(?:in|within)\s+(\d+)\s+years?/i);
    const years = yearsMatch ? parseInt(yearsMatch[1], 10) : null;
    return { action: "breakEven", cost, years };
  }

  // Step 2: How-To Firewall (The Guardrail) - Check AFTER command patterns
  // This prevents "How do I set the temp to 72?" from being executed as a command
  // BUT only if no command pattern matched above
  // Check for instructional intent patterns
  const isInstructionalPattern =
    /^(how\s+(do|can|should|to)|what\s+(should|happens|is|does|can)|should\s+i|can\s+i)\s+/i.test(
      cleaned
    );
  if (isInstructionalPattern) {
    // This is a question asking HOW to do something, not a command
    // Return null to send it to the LLM
    return null;
  }

  // Helper: Check if this is a question (should not navigate)
  // Include "can you" and "can I" patterns as questions when they're asking, not commanding
  const isQuestion =
    /^(?:what|how|why|when|where|is|are|can|does|do|will|would|should|tell\s+me|explain|describe)/i.test(
      q.trim()
    ) ||
    // "can you show me..." or "can I see..." are questions, not commands
    /^can\s+(?:you|i)\s+(?:show|tell|explain|what|how|why)/i.test(q.trim());

  // Navigation commands - comprehensive tool support
  // Only navigate if it's an explicit navigation intent, not a question
  // 1. 7-Day Cost Forecaster
  // Explicitly reject "can you show me" patterns - these are questions
  const isCanYouShowQuestion = /^can\s+(?:you|i)\s+show\s+me/i.test(q.trim());
  if (
    !isQuestion &&
    !isCanYouShowQuestion &&
    (/(?:open|show|go\s+to|navigate\s+to|view|see)\s+(?:me\s+)?(?:the\s+)?(?:forecast|7\s*day|weekly|cost\s+forecast)/i.test(
      q
    ) ||
      /(?:forecast|7\s*day|weekly)\s+(?:page|tool|calculator)/i.test(q) ||
      /show\s+me\s+([A-Za-z\s,]+)\s+forecast/i.test(q)) &&
    !/thermostat/.test(qLower)
  ) {
    // Check if a city name is mentioned
    const cityMatch = q.match(/show\s+me\s+([A-Za-z\s,]+)\s+forecast/i);
    if (cityMatch) {
      return {
        action: "navigate",
        target: "forecast",
        cityName: cityMatch[1].trim(),
      };
    }
    return { action: "navigate", target: "forecast" };
  }

  // 2. System Comparison (heat pump vs gas furnace) / Analysis
  // Only navigate if explicitly asking to open/show the page, not for calculations
  if (
    !isQuestion &&
    (/(?:open|show|go\s+to|navigate\s+to|view|see|run)\s+(?:the\s+)?(?:comparison|compare|vs|versus|analysis)/i.test(
      q
    ) ||
      /(?:comparison|compare|analysis)\s+(?:page|tool|calculator)/i.test(q) ||
      /(?:heat\s*pump\s+vs|gas\s+vs)\s+(?:page|tool|calculator)/i.test(q) ||
      /^go\s+to\s+analysis\s*$/i.test(q))
  ) {
    return { action: "navigate", target: "comparison" };
  }

  // 3. Balance Point Analyzer / Energy Flow
  // Only navigate if it's explicitly about viewing/opening the page, not calculating
  if (
    /(?:open|show|go\s+to|view|see)\s+(?:the\s+)?(?:balance\s*point\s+)?(?:analyzer|page|graph|visualization)/i.test(
      q
    ) ||
    /(?:energy\s+flow|performance\s+graph|visualiz)/i.test(q)
  ) {
    return { action: "navigate", target: "balance" };
  }
  // If just "balance point" without calculate/show/open, check if it's a calculation request
  if (
    /(?:balance\s*point)/i.test(q) &&
    !/(?:calculate|show|tell\s+me|what\s+is)/i.test(q)
  ) {
    // Default to showing the answer, not navigating (unless explicitly asked to open page)
    return {
      action: "offlineAnswer",
      type: "balancePoint",
      needsContext: true,
    };
  }

  // 4. A/C Charging Calculator
  if (
    !isQuestion &&
    (/(?:open|show|go\s+to|navigate\s+to|view|see)\s+(?:the\s+)?(?:charging|subcool|refrigerant|charge\s+calculator|a\/?c\s+charg)/i.test(
      q
    ) ||
      /(?:charging|charge\s+calculator)\s+(?:page|tool|calculator)/i.test(q))
  ) {
    return { action: "navigate", target: "charging" };
  }

  // 5. Performance Analyzer (thermal factor from thermostat data)
  if (
    !isQuestion &&
    (/(?:open|show|go\s+to|navigate\s+to|view|see|run|analyze)\s+(?:my\s+)?(?:the\s+)?(?:performance\s+analyz|analyzer|upload\s+thermostat|system)/i.test(
      q
    ) ||
      /(?:performance\s+analyz|analyzer)\s+(?:page|tool)/i.test(q) ||
      /upload\s+thermostat\s+(?:data|csv)/i.test(q) ||
      /^run\s+analyzer$/i.test(q) ||
      /^(?:open|show)\s+analyzer\s*$/i.test(q) ||
      /show\s+me\s+the\s+graphs/i.test(q))
  ) {
    return { action: "navigate", target: "analyzer" };
  }

  // 6. Calculation Methodology
  if (
    !isQuestion &&
    (/(?:open|show|go\s+to|navigate\s+to|view|see)\s+(?:the\s+)?(?:methodology|formula|math)/i.test(
      q
    ) ||
      /(?:methodology|formula)\s+(?:page|document)/i.test(q))
  ) {
    return { action: "navigate", target: "methodology" };
  }

  // 7. Settings / Thermostat Settings
  if (
    !isQuestion &&
    (/(?:open|show|go\s+to|navigate\s+to|view|see)\s+(?:the\s+)?(?:settings|preferences|configuration|thermostat\s+settings)/i.test(
      q
    ) ||
      /(?:settings|preferences|configuration|thermostat\s+settings)\s+(?:page|menu)/i.test(
        q
      ) ||
      /(?:adjust|change)\s+settings/i.test(q) ||
      /^open\s+thermostat\s+settings\s*$/i.test(q)) &&
    !/winter|summer|temp/.test(qLower)
  ) {
    return { action: "navigate", target: "settings" };
  }

  // 8. Thermostat Strategy Analyzer
  if (
    !isQuestion &&
    (/(?:open|show|go\s+to|navigate\s+to|view|see)\s+(?:the\s+)?(?:thermostat\s+(?:strategy|analyz)|setback\s+analyz)/i.test(
      q
    ) ||
      /(?:thermostat\s+(?:strategy|analyz)|setback\s+analyz)\s+(?:page|tool)/i.test(
        q
      ))
  ) {
    return { action: "navigate", target: "thermostat" };
  }

  // 9. Monthly Budget Planner
  if (
    !isQuestion &&
    (/(?:open|show|go\s+to|navigate\s+to|view|see)\s+(?:the\s+)?(?:monthly\s+budget|budget\s+plan|budget)/i.test(
      q
    ) ||
      /(?:monthly\s+budget|budget\s+plan|budget)\s+(?:page|tool)/i.test(q) ||
      /^navigate\s+to\s+budget\s*$/i.test(q))
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
    /(?:what'?s?\s+(?:my\s+)?(?:heat\s+loss\s+factor|thermal\s+factor|energy\s+factor)|calculate.*performance|system\s+performance)/i.test(
      q
    )
  ) {
    return { action: "calculatePerformance" };
  }

  // Calculate heat loss (general)
  if (
    /^calculate\s+heat\s+loss\s*$/i.test(q) ||
    /^calculate\s+my\s+heat\s+loss\s*$/i.test(q)
  ) {
    return { action: "calculateHeatLoss" };
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

  // "compare systems" - exact match for command
  if (/^compare\s+systems?\s*$/i.test(q)) {
    return { action: "compareSystem" };
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
    ) ||
    /^check\s+aux\s+heat\s*$/i.test(q) ||
    /^check\s+auxiliary\s+heat\s*$/i.test(q)
  ) {
    return { action: "checkAuxHeat" };
  }
  if (/(?:temperature\s+swing|temp.*unstable|temperature.*fluctuat)/i.test(q)) {
    return { action: "checkTempStability" };
  }

  // 10. Upgrade ROI Analyzer
  if (
    !isQuestion &&
    (/(?:open|show|go\s+to|navigate\s+to|view|see|run)\s+(?:the\s+)?(?:upgrade|roi|return\s+on\s+investment)/i.test(
      q
    ) ||
      /(?:upgrade|roi)\s+(?:page|tool|calculator)/i.test(q) ||
      /^upgrade\s+roi$/i.test(q)) &&
    !qLower.includes("break")
  ) {
    return { action: "navigate", target: "roi" };
  }

  // Fallback: "show me" commands
  // But skip if it's a question like "show me what" or "can you show me..."
  if (/show\s+(?:me\s+)?(.+)/i.test(q)) {
    const match = q.match(/show\s+(?:me\s+)?(.+)/i);
    const target = match[1].toLowerCase();
    // If target is a question word, this is a question, not a navigation command
    if (/^(what|how|why|when|where|which|who)\b/i.test(target.trim())) {
      return null; // Send to LLM as a question
    }
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

  // Wiring diagram queries
  if (
    /(?:show|display|generate|create|draw|give\s+me|i\s+need|how\s+do\s+i\s+wire|wiring\s+diagram|wire\s+diagram|ecobee\s+wiring|thermostat\s+wiring|how\s+to\s+wire\s+(?:an\s+)?ecobee)/i.test(
      q
    ) ||
    /(?:what\s+(?:are\s+)?(?:the\s+)?wires?|which\s+wires?|where\s+do\s+(?:the\s+)?wires?|how\s+are\s+wires?\s+connected)/i.test(
      q
    )
  ) {
    return { action: "wiringDiagram", isCommand: true, query: q };
  }

  // Educational queries
  if (
    /(?:what\s+is|explain|tell\s+me\s+about|how\s+is.*calculated)\s+(hspf|seer|cop|hdd|cdd|insulation|aux\s*heat|energy\s+factor|thermal\s+factor|building\s+factor)/i.test(
      q
    )
  ) {
    const match = q.match(
      /(?:what\s+is|explain|tell\s+me\s+about|how\s+is.*calculated)\s+(hspf|seer|cop|hdd|cdd|insulation|aux\s*heat|energy\s+factor|thermal\s+factor|heat\s+loss\s+factor|building\s+factor)/i
    );
    if (match) {
      let topic = match[1].toLowerCase().replace(/\s+/g, "");
      // Map energy factor variations to a known topic
      if (
        topic.includes("energyfactor") ||
        topic.includes("thermalfactor") ||
        topic.includes("heatlossfactor") ||
        topic.includes("buildingfactor")
      ) {
        topic = "thermalFactor"; // or create a new action for this
      }
      return { action: "educate", topic };
    }
  }
  // Energy factor / thermal factor / heat loss factor calculation questions
  if (
    /(?:how\s+is|how\s+do\s+you\s+calculate|what\s+is)\s+(?:my\s+)?(?:home'?s?\s+)?(?:energy\s+factor|thermal\s+factor|heat\s+loss\s+factor|building\s+factor)/i.test(
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

  // === FUN RESPONSES - Check LAST (after all commands) ===
  // Only check fun responses if no command was found
  // This prevents fun response fallbacks from intercepting valid commands or technical questions
  {
    // Lazy load fun responses - if not loaded yet, skip (will be available on next query)
    if (funResponsesModule) {
      const funResponse = funResponsesModule.checkFunResponse(q);
      if (funResponse) {
        // Check if it looks like a command - if so, don't return fun response
        const looksLikeCommand =
          /^(set|change|make|turn|switch|activate|enable|disable|open|show|go|navigate|run|calculate|check|analyze|optimize|start|stop|toggle)/i.test(
            q
          );

        // Check if it's a technical HVAC question (should go to LLM, not joke fallback)
        const looksLikeTechnicalQuestion =
          /\b(filter|coil|efficiency|energy|kwh|hspf|seer|heat pump|thermostat|aux|auxiliary|balance point|defrost|refrigerant|btu|capacity|performance|consumption|usage|cost|bill|savings|waste|wasting|optimize|optimization|maintenance|dirty|clogged|frozen|icing|lockout|setback|setpoint|temperature|temp|heating|cooling|hvac|system|equipment)\b/i.test(
            q
          );

        // Only return fun response if:
        // 1. It's an actual match (not a fallback), OR
        // 2. It's a fallback but doesn't look like a command AND doesn't look like a technical question
        if (funResponse.key !== "fallback") {
          // Actual fun response match - return it
          if (!looksLikeCommand) {
            return funResponse;
          }
          // Command-like but matched a fun response - let LLM handle it
          return null;
        } else {
          // Fallback fun response - only use for casual questions, not technical ones
          if (looksLikeCommand || looksLikeTechnicalQuestion) {
            // This is a command or technical question - send to LLM instead
            return null;
          }
          // Casual question with no match - use fallback joke
          return funResponse;
        }
      }
    } else {
      // Load in background for next time
      loadFunResponses().catch(() => {});
    }
  }

  return null;
}

// Enhanced parsing with context
// Main parsing function - enhanced with context support
// Now supports LLM-based intent classification (AI Paradise) with regex fallback (Regex Hell)
/**
 * Helper function to detect if input looks like a command vs a question
 * Used to determine if we should try LLM function calling for complex commands
 */
function looksLikeCommand(input) {
  const q = input.toLowerCase().trim();

  // Commands typically start with action verbs
  const commandPatterns = [
    /^(set|change|make|turn|switch|activate|enable|disable|open|show|go|navigate|run|calculate|check|analyze|optimize|start|stop|toggle)/i,
    /^(set|change|make|turn|switch|activate|enable|disable)\s+(?:the\s+)?(?:temp|temperature|mode|fan|system)/i,
    /^(set|change)\s+(?:to|at)\s+\d+/i, // "set to 72", "change at 70"
    /^(make|turn)\s+(?:it|the)\s+(?:warmer|cooler|hotter|colder|up|down)/i,
    /^(sleep|away|home)\s+mode/i,
    /^(optimize|save|calculate|check|analyze|show|run)/i,
  ];

  // Questions typically start with question words
  const questionPatterns = [
    /^(what|how|why|when|where|is|are|can|does|do|will|would|should|tell\s+me|explain|describe)/i,
    /\?$/, // Ends with question mark
  ];

  // If it matches question patterns strongly, it's likely a question
  if (questionPatterns.some((pattern) => pattern.test(q))) {
    // Exception: "How do I set..." is instructional, not a command
    if (
      /^(how\s+do\s+i|how\s+can\s+i|how\s+to)\s+(set|change|make|turn|switch)/i.test(
        q
      )
    ) {
      return false; // Instructional question, not a command
    }
    // If it has a question word but also has command-like structure, it might be a command
    // e.g., "What is my score?" -> command (showScore)
    // e.g., "Why is my bill high?" -> question
    if (commandPatterns.some((pattern) => pattern.test(q))) {
      return true; // Has command structure despite question word
    }
    return false; // Pure question
  }

  // If it matches command patterns, it's likely a command
  if (commandPatterns.some((pattern) => pattern.test(q))) {
    return true;
  }

  // Default: if it's short and doesn't have question words, might be a command
  // e.g., "72 degrees" -> command (setTemp)
  if (q.length < 50 && !/\?/.test(q)) {
    // Check for temperature values or mode names
    if (
      /\d+\s*(?:degrees?|°f?|°c?)/i.test(q) ||
      /^(heat|cool|auto|off)$/i.test(q)
    ) {
      return true;
    }
  }

  // Default to false (treat as question if uncertain)
  return false;
}

export async function parseAskJoule(query, context = {}) {
  if (!query) return {};

  // Step 0: Check for explicit question patterns BEFORE cleaning
  // "Can you set the temperature to X" is always a question (not a command)
  const originalLower = query.toLowerCase().trim();
  if (/^can\s+you\s+set\s+(?:the\s+)?temperature\s+to/i.test(originalLower)) {
    // This is a question, not a command - return empty to send to LLM
    return { isCommand: false };
  }

  // Step 1: Clean the input (Polite Stripper)
  const cleaned = cleanInput(query);
  if (!cleaned) return {};

  const q = cleaned;

  // Check for sales intent first (Presales RAG capability)
  // Lazy load sales FAQ - if not loaded yet, skip (will be available on next query)
  if (salesFAQModule && typeof salesFAQModule.hasSalesIntent === "function") {
    if (salesFAQModule.hasSalesIntent(q)) {
      const salesMatch =
        salesFAQModule.searchSalesFAQ &&
        typeof salesFAQModule.searchSalesFAQ === "function"
          ? salesFAQModule.searchSalesFAQ(q)
          : null;
      if (salesMatch) {
        return {
          isSalesQuery: true,
          salesAnswer: salesMatch.answer,
          salesQuestion: salesMatch.question,
          salesCategory: salesMatch.category,
        };
      } else {
        // No match found - return fallback response
        const fallbackResponse =
          salesFAQModule.getSalesFallbackResponse &&
          typeof salesFAQModule.getSalesFallbackResponse === "function"
            ? salesFAQModule.getSalesFallbackResponse()
            : "I don't have the specific answer for that. Please check the settings or contact support.";
        return {
          isSalesQuery: true,
          salesAnswer: fallbackResponse,
          salesFallback: true,
        };
      }
    }
  } else {
    // Load in background for next time
    loadSalesFAQ().catch(() => {});
  }

  // Check for offline intelligence queries (before commands)
  // These work without API key and should be prioritized
  // Use cleaned input for consistency
  // Always check for offline answers first - they handle knowledge questions
  // Only skip if it's a specific instructional question that needs LLM context
  const isChangeToWhat = /^(change|set|switch|turn)\s+to\s+what/i.test(
    cleaned.toLowerCase()
  );
  const isInstructionalHowTo =
    /^how\s+(do|can|should|to)\s+i\s+(set|change|make|turn|switch|activate|open|show|go|navigate)/i.test(
      cleaned.toLowerCase()
    );
  const isCanICommandQuestion =
    /^can\s+i\s+(switch|activate|set|change|turn|open|show|go|navigate)/i.test(
      cleaned.toLowerCase()
    );

  // Check offline answers for all questions - they handle knowledge questions
  // Only skip if it's a specific instructional question that needs LLM context
  if (!isChangeToWhat && !isInstructionalHowTo && !isCanICommandQuestion) {
    const offlineAnswer = calculateOfflineAnswer(cleaned);
    if (offlineAnswer) {
      return { ...offlineAnswer, isCommand: true };
    }
  }

  // ARCHITECTURE: Regex FIRST (Fast, Free, Accurate)
  // Try regex parser for simple commands like "set temp to 72"
  // This is 100% accurate, 0ms latency, $0 cost
  const regexCommand = parseCommandLocal(cleaned, context);
  if (regexCommand) {
    // Regex found a command or data (like city/squareFeet)
    // Only mark as command if there's an action
    const cityName = parseCity(cleaned);
    const result = { ...regexCommand, ...(cityName && { cityName }) };
    // Only set isCommand: true if there's an actual action
    if (regexCommand.action) {
      result.isCommand = true;
    }
    return result;
  }

  // Regex didn't find a command - check if it looks like a command
  // If it does, try LLM with function calling for complex commands
  // If it doesn't, treat it as a question and send to LLM
  const groqApiKey =
    context?.groqApiKey ||
    (typeof window !== "undefined"
      ? localStorage.getItem("groqApiKey")
      : null) ||
    import.meta.env?.VITE_GROQ_API_KEY;

  if (groqApiKey && looksLikeCommand(q)) {
    // Looks like a command but regex didn't catch it
    // This might be a complex command like "Set the temp to 72 and turn on the fan for 10 minutes"
    // Use LLM with function calling to extract the intent
    try {
      const { classifyIntentWithLLM, shouldUseLLMClassification } =
        await import("./llmIntentClassifier.js");

      if (shouldUseLLMClassification(true, groqApiKey)) {
        const llmResult = await classifyIntentWithLLM(q, groqApiKey);

        if (llmResult && llmResult.isCommand) {
          // LLM successfully extracted a command - return it
          return llmResult;
        }
        // LLM didn't find a command - fall through to question handling
      }
    } catch (error) {
      // LLM classification failed - fall through to question handling
      console.warn(
        "[parseAskJoule] LLM function calling failed, treating as question:",
        error
      );
    }
  }

  // No command found - this is a question for the LLM
  // Return an object with isCommand: false to explicitly mark it as a question
  // Original parsing logic for query extraction (for questions, not commands)
  const squareFeet = parseSquareFeet(q);
  const indoorTemp = parseTemperature(q);
  const insulationLevel = parseInsulation(q);
  const primarySystem = parseSystem(q);
  const energyMode = parseMode(q);
  const cityName = parseCity(q);

  // Return query extraction result (this is a question, not a command)
  // Don't set isCommand: true here - this is for LLM processing
  return {
    cityName,
    squareFeet,
    insulationLevel,
    indoorTemp,
    primarySystem,
    energyMode,
    // Explicitly mark as NOT a command
    isCommand: false,
  };
}

// Backward compatible export - parseCommand is an alias for the command parsing logic
export function parseCommand(query) {
  return parseCommandLocal(query);
}

// Export parseCommandLocal for offlineParser.js
// This allows offlineParser.js to re-export it as the "Backup Brain"
export { parseCommandLocal };

export default parseAskJoule;
