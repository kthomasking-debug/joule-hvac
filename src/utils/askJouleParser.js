// Utility functions for parsing Ask Joule queries
// Extracted from AskJoule.jsx to fix fast refresh linting error

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
  const re = /(?:at|to|set(?:\s*it)?\s*to)\s*(\d{2})(?:\s*°?\s*F|\s*F)?\b|(\d{2})\s*(?:degrees|°)/i;
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
  const inCity = q.match(/\bin\s+([A-Za-z.\s-]+?)(?:,|\s+(?:at|to|set|with|for|on|keep|good|poor|excellent|bad|\d|$))/i);
  if (inCity) return inCity[1].trim();
  // Start-of-string city heuristic: leading capitalized words before a stop word
  const startCity = q.match(
    /^([A-Z][A-Za-z.-]*(?:\s+[A-Z][A-Za-z.-]*)*)\b(?=\s+(?:keep|set|at|to|with|for|on|\d|$))/
  );
  if (startCity) return startCity[1].trim();
  return undefined;
}

// Parse context-aware commands (local version used by parseAskJoule)
function parseCommandLocal(query) {
  if (!query) return null;
  const q = String(query).trim();
  const qLower = q.toLowerCase();
  
  // Relative temperature adjustments
  if (/(?:make\s+it\s+|turn\s+it\s+)?(?:warmer|hotter|heat\s+up)(?:\s+by\s+(\d+))?/i.test(q)) {
    const match = q.match(/(?:warmer|hotter|heat\s+up)(?:\s+by\s+(\d+))?/i);
    const delta = match && match[1] ? parseInt(match[1], 10) : 2;
    return { action: 'increaseTemp', value: delta };
  }
  if (/(?:make\s+it\s+|turn\s+it\s+)?(?:cooler|colder|cool\s+down)(?:\s+by\s+(\d+))?/i.test(q)) {
    const match = q.match(/(?:cooler|colder|cool\s+down)(?:\s+by\s+(\d+))?/i);
    const delta = match && match[1] ? parseInt(match[1], 10) : 2;
    return { action: 'decreaseTemp', value: delta };
  }
  if (/(?:increase|raise|turn\s+up|up)\s+(?:the\s+)?(?:temp|temperature|heat)(?:\s+by\s+(\d+))?/i.test(q)) {
    const match = q.match(/(?:by\s+)?(\d+)/i);
    const delta = match ? parseInt(match[1], 10) : 2;
    return { action: 'increaseTemp', value: delta };
  }
  if (/(?:decrease|lower|turn\s+down|down)\s+(?:the\s+)?(?:temp|temperature|heat)(?:\s+by\s+(\d+))?/i.test(q)) {
    const match = q.match(/(?:by\s+)?(\d+)/i);
    const delta = match ? parseInt(match[1], 10) : 2;
    return { action: 'decreaseTemp', value: delta };
  }
  
  // Preset modes for thermostat
  if (/(?:i'm|im|i\s+am)\s+(?:going\s+to\s+)?(?:sleep|bed)|sleep\s+mode|bedtime/i.test(q)) {
    return { action: 'presetSleep' };
  }
  if (/(?:i'm|im|i\s+am)\s+(?:leaving|going\s+out|gone)|away\s+mode|vacation\s+mode/i.test(q)) {
    return { action: 'presetAway' };
  }
  if (/(?:i'm|im|i\s+am)\s+(?:home|back)|home\s+mode|normal\s+mode/i.test(q)) {
    return { action: 'presetHome' };
  }
  
  // Query temperature (supports pronouns from context)
  if (/what'?s?\s+(?:the\s+)?(?:current\s+)?(?:temp|temperature)|how\s+(?:hot|cold|warm)\s+is\s+it/i.test(q)) {
    return { action: 'queryTemp' };
  }
  
  // Direct setting commands
  if (/(?:set\s+winter(?:\s+(?:thermostat|temp|thermo))?|set\s+thermostat\s+winter)\s*(?:to\s+)?(\d{2})/i.test(q)) {
    const match = q.match(/(?:set\s+winter(?:\s+(?:thermostat|temp|thermo))?|set\s+thermostat\s+winter)\s*(?:to\s+)?(\d{2})/i);
    return { action: 'setWinterTemp', value: parseInt(match[1], 10) };
  }
  if (/(?:set\s+summer(?:\s+(?:thermostat|temp|thermo))?|set\s+thermostat\s+summer)\s*(?:to\s+)?(\d{2})/i.test(q)) {
    const match = q.match(/(?:set\s+summer(?:\s+(?:thermostat|temp|thermo))?|set\s+thermostat\s+summer)\s*(?:to\s+)?(\d{2})/i);
    return { action: 'setSummerTemp', value: parseInt(match[1], 10) };
  }
  
  // What-if scenarios (check BEFORE navigation to avoid "upgrade" matching roi)
  if (/what\s+if.*?(\d+\.?\d*)\s*hspf/i.test(q)) {
    const match = q.match(/what\s+if.*?(\d+\.?\d*)\s*hspf/i);
    return { action: 'whatIfHSPF', value: parseFloat(match[1]) };
  }
  if (/set\s+(?:hspf|hspf2?)\s+(?:to\s+)?(\d+\.?\d*)/i.test(q)) {
    const match = q.match(/set\s+(?:hspf|hspf2?)\s+(?:to\s+)?(\d+\.?\d*)/i);
    return { action: 'setHSPF', value: parseFloat(match[1]) };
  }
  if (/set\s+(?:seer|efficiency)\s+(?:to\s+)?(\d+\.?\d*)/i.test(q)) {
    const match = q.match(/set\s+(?:seer|efficiency)\s+(?:to\s+)?(\d+\.?\d*)/i);
    return { action: 'setSEER', value: parseFloat(match[1]) };
  }
  if (/set\s+(?:utility\s*cost|utility)\s+(?:to\s+)?\$?(\d+(?:\.\d+)?)/i.test(q)) {
    const match = q.match(/set\s+(?:utility\s*cost|utility)\s+(?:to\s+)?\$?(\d+(?:\.\d+)?)/i);
    return { action: 'setUtilityCost', value: parseFloat(match[1]) };
  }
  if (/set\s+(?:location|city)\s+(?:to\s+)?([A-Za-z.\-\s,]+?)$/i.test(q)) {
    const match = q.match(/set\s+(?:location|city)\s+(?:to\s+)?([A-Za-z.\-\s,]+?)$/i);
    if (match) return { action: 'setLocation', cityName: match[1].trim() };
  }
  // Set square-feet
  if (/set\s+(?:square\s*feet|sq\s*ft|sqft|square\s*footage|sf)\s+(?:to\s+)?(\d{1,3}(?:,\d{3})?|\d+(?:\.\d+)?k?)\b/i.test(q)) {
    const match = q.match(/set\s+(?:square\s*feet|sq\s*ft|sqft|square\s*footage|sf)\s+(?:to\s+)?(\d{1,3}(?:,\d{3})?|\d+(?:\.\d+)?k?)\b/i);
    if (match) {
      const raw = match[1].replace(/,/g, '').toLowerCase();
      const val = raw.endsWith('k') ? Math.round(parseFloat(raw.slice(0, -1)) * 1000) : parseInt(raw, 10);
      return { action: 'setSquareFeet', value: Number(val) };
    }
  }
  // Insulation
  if (/set\s+insulation\s+to\s+(poor|average|typical|good)/i.test(q)) {
    const m = q.match(/set\s+insulation\s+to\s+(poor|average|typical|good)/i);
    if (m) return { action: 'setInsulationLevel', value: INSULATION_MAP[m[1].toLowerCase()], raw: m[1] };
  }
  // Capacity (kBTU) and Cooling capacity
  if (/set\s+(?:cooling\s+)?capacity\s+(?:to\s+)?(\d{1,2})k?/i.test(q)) {
    const m = q.match(/set\s+(?:cooling\s+)?capacity\s+(?:to\s+)?(\d{1,2})k?/i);
    if (m) return { action: 'setCapacity', value: Number(m[1]) };
  }
  // AFUE
  if (/set\s+(?:afue|furnace\s*efficiency)\s+(?:to\s+)?(\d+(?:\.\d+)?)/i.test(q)) {
    const m = q.match(/set\s+(?:afue|furnace\s*efficiency)\s+(?:to\s+)?(\d+(?:\.\d+)?)/i);
    if (m) return { action: 'setAFUE', value: parseFloat(m[1]) };
  }
  // Home shape (multiplier)
  if (/set\s+home\s+shape\s+(?:to\s+)?(\d+(?:\.\d+)?)/i.test(q)) {
    const m = q.match(/set\s+home\s+shape\s+(?:to\s+)?(\d+(?:\.\d+)?)/i);
    if (m) return { action: 'setHomeShape', value: parseFloat(m[1]) };
  }
  // Solar exposure
  if (/set\s+solar\s+exposure\s+(?:to\s+)?(\d+(?:\.\d+)?)/i.test(q)) {
    const m = q.match(/set\s+solar\s+exposure\s+(?:to\s+)?(\d+(?:\.\d+)?)/i);
    if (m) return { action: 'setSolarExposure', value: parseFloat(m[1]) };
  }
  // Energy mode
  if (/set\s+energy\s+mode\s+(?:to\s+)?(heating|cooling)/i.test(q)) {
    const m = q.match(/set\s+energy\s+mode\s+(?:to\s+)?(heating|cooling)/i);
    if (m) return { action: 'setEnergyMode', value: m[1].toLowerCase() };
  }
  // Primary system - heat pump or gas furnace
  if (/set\s+primary\s+system\s+(?:to\s+)?(heat\s*pump|gas\s*furnace)/i.test(q)) {
    const m = q.match(/set\s+primary\s+system\s+(?:to\s+)?(heat\s*pump|gas\s*furnace)/i);
    if (m) return { action: 'setPrimarySystem', value: m[1].toLowerCase().includes('heat') ? 'heatPump' : 'gasFurnace' };
  }
  // Gas cost
  if (/set\s+gas\s+cost\s+(?:to\s+)?\$?(\d+(?:\.\d+)?)/i.test(q)) {
    const m = q.match(/set\s+gas\s+cost\s+(?:to\s+)?\$?(\d+(?:\.\d+)?)/i);
    if (m) return { action: 'setGasCost', value: parseFloat(m[1]) };
  }
  // Set cooling system
  if (/set\s+cooling\s+system\s+(?:to\s+)?(centralAC|central\s*A\/C|dual\s*fuel|none|other|dual-fuel)/i.test(q)) {
    const m = q.match(/set\s+cooling\s+system\s+(?:to\s+)?(centralAC|central\s*A\/C|dual\s*fuel|none|other|dual-fuel)/i);
    if (m) {
      let val = m[1];
      if (/central/i.test(val)) val = 'centralAC';
      if (/dual/i.test(val)) val = 'dualFuel';
      if (/none|other/i.test(val)) val = 'none';
      return { action: 'setCoolingSystem', value: val };
    }
  }
  // Ceiling height (ft)
  if (/set\s+ceiling\s+(?:height\s+)?(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:ft|feet)?\b/i.test(q)) {
    const m = q.match(/set\s+ceiling\s+(?:height\s+)?(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:ft|feet)?\b/i);
    if (m) return { action: 'setCeilingHeight', value: parseFloat(m[1]) };
  }
  // Home elevation
  if (/set\s+(?:home\s+)?elevation\s+(?:to\s+)?(\d+(?:,\d{3})?)/i.test(q)) {
    const m = q.match(/set\s+(?:home\s+)?elevation\s+(?:to\s+)?(\d+(?:,\d{3})?)/i);
    if (m) return { action: 'setHomeElevation', value: Number(m[1].replace(/,/g, '')) };
  }
  // Aux heat toggle
  if (/\bturn\s+(?:on|off)\s+aux(?:iliary)?\s*heat\b/i.test(q) || /\b(use|enable|disable)\s+electric\s+aux\s*heat\b/i.test(q)) {
    const enable = /\b(turn|use|enable)\b\s+on?/.test(q) || /\b(use|enable)\b/i.test(q);
    const disable = /\b(turn\s+off|disable)\b/i.test(q);
    if (disable) return { action: 'setUseElectricAuxHeat', value: false };
    if (enable) return { action: 'setUseElectricAuxHeat', value: true };
  }
  // set cooling capacity explicitly
  if (/set\s+cooling\s+capacity\s+(?:to\s+)?(\d{1,2})k?/i.test(q)) {
    const m = q.match(/set\s+cooling\s+capacity\s+(?:to\s+)?(\d{1,2})k?/i);
    if (m) return { action: 'setCoolingCapacity', value: Number(m[1]) };
  }
  // Undo commands
  if (/^undo\b|undo\s+last\s+change|revert\s+last\s+change/i.test(q)) {
    return { action: 'undo', when: 'last', isCommand: true };
  }
  if (/what\s+if.*?(\d+\.?\d*)\s*seer/i.test(q)) {
    const match = q.match(/what\s+if.*?(\d+\.?\d*)\s*seer/i);
    return { action: 'whatIfSEER', value: parseFloat(match[1]) };
  }
  if (/break\s?[-\s]?even|payback/i.test(q)) {
    const match = q.match(/\$?(\d+[,\d]*)/);
    const cost = match ? parseInt(match[1].replace(/,/g, ''), 10) : 8000;
    return { action: 'breakEven', cost };
  }
  
  // Navigation commands - comprehensive tool support
  // 1. 7-Day Cost Forecaster
  if (/(?:forecast|7\s*day|weekly|week|predict|estimate\s+cost)/i.test(q) && !/thermostat/.test(qLower)) {
    return { action: 'navigate', target: 'forecast' };
  }
  
  // 2. System Comparison (heat pump vs gas furnace)
  if (/(?:compar|vs|versus|heat\s*pump\s+vs|gas\s+vs|compare\s+systems)/i.test(q)) {
    return { action: 'navigate', target: 'comparison' };
  }
  
  // 3. Balance Point Analyzer / Energy Flow
  if (/(?:balance\s*point|energy\s+flow|performance\s+graph|visualiz)/i.test(q)) {
    return { action: 'navigate', target: 'balance' };
  }
  
  // 4. A/C Charging Calculator
  if (/(?:charging|subcool|refrigerant|charge\s+calculator|a\/?c\s+charg)/i.test(q)) {
    return { action: 'navigate', target: 'charging' };
  }
  
  // 5. Performance Analyzer (thermal factor from thermostat data)
  if (/(?:performance\s+analyz|thermal\s+factor|building\s+factor|upload\s+thermostat|analyze\s+data)/i.test(q)) {
    return { action: 'navigate', target: 'analyzer' };
  }
  
  // 6. Calculation Methodology
  if (/(?:methodology|how\s+(?:does|do)\s+(?:the\s+)?(?:math|calculation)|explain\s+(?:the\s+)?(?:math|formula)|formula)/i.test(q)) {
    return { action: 'navigate', target: 'methodology' };
  }
  
  // 7. Settings
  if (/(?:settings|preferences|configuration|adjust\s+settings|change\s+settings)/i.test(q) && !/winter|summer|temp/.test(qLower)) {
    return { action: 'navigate', target: 'settings' };
  }
  
  // 8. Thermostat Strategy Analyzer
  if (/(?:thermostat\s+(?:strategy|analyz)|setback|constant\s+temp|nightly\s+setback|thermostat\s+compar)/i.test(q)) {
    return { action: 'navigate', target: 'thermostat' };
  }
  
  // 9. Monthly Budget Planner
  if (/(?:monthly\s+budget|budget\s+plan|track\s+costs|budget\s+tool|plan\s+budget)/i.test(q)) {
    return { action: 'navigate', target: 'budget' };
  }
  
  // CSV Data & Diagnostics queries - MUST come before broader patterns
  if (/(?:what\s+(?:problems?|issues?)|diagnostics?|check\s+(?:my\s+)?system|system\s+(?:problems?|issues?)|any\s+(?:problems?|issues?))/i.test(q)) {
    return { action: 'showDiagnostics' };
  }
  if (/(?:short\s+cycl|rapid\s+cycl|turning\s+on\s+and\s+off|cycl.*problem)/i.test(q)) {
    return { action: 'checkShortCycling' };
  }
  if (/(?:thermostat\s+data|csv\s+data|uploaded\s+data|my\s+data|data\s+file)/i.test(q)) {
    return { action: 'showCsvInfo' };
  }
  if (/(?:aux(?:iliary)?\s+heat|emergency\s+heat|backup\s+heat).*(?:problem|issue|high|excessive)/i.test(q)) {
    return { action: 'checkAuxHeat' };
  }
  if (/(?:temperature\s+swing|temp.*unstable|temperature.*fluctuat)/i.test(q)) {
    return { action: 'checkTempStability' };
  }
  
  // 10. Upgrade ROI Analyzer
  if (/(?:upgrade|roi|return\s+on\s+investment|payback|should\s+i\s+upgrade)/i.test(q) && !qLower.includes('break')) {
    return { action: 'navigate', target: 'roi' };
  }
  
  // Fallback: "show me" commands
  if (/show\s+(?:me\s+)?(.+)/i.test(q)) {
    const match = q.match(/show\s+(?:me\s+)?(.+)/i);
    const target = match[1].toLowerCase();
    if (target.includes('forecast')) return { action: 'navigate', target: 'forecast' };
    if (target.includes('compar')) return { action: 'navigate', target: 'comparison' };
    if (target.includes('balanc') || target.includes('flow')) return { action: 'navigate', target: 'balance' };
    if (target.includes('charg')) return { action: 'navigate', target: 'charging' };
    if (target.includes('analyz') || target.includes('performance')) return { action: 'navigate', target: 'analyzer' };
    if (target.includes('method') || target.includes('math')) return { action: 'navigate', target: 'methodology' };
    if (target.includes('setting')) return { action: 'navigate', target: 'settings' };
    if (target.includes('thermostat') || target.includes('setback')) return { action: 'navigate', target: 'thermostat' };
    if (target.includes('budget')) return { action: 'navigate', target: 'budget' };
    if (target.includes('upgrade') || target.includes('roi')) return { action: 'navigate', target: 'roi' };
    // If unknown, try to interpret as city for forecast
    return { action: 'navigate', target: 'forecast', cityName: match[1].trim() };
  }
  
  // Help/capabilities query
  if (/^(?:help|what\s+can\s+you\s+do|what\s+do\s+you\s+do|how\s+do\s+(?:i|you)\s+(?:use|work)|capabilities|commands?)$/i.test(q)) {
    return { action: 'showHelp' };
  }
  
  // Info queries
  if (/what\s+can\s+i\s+save|how\s+to\s+save|savings?/i.test(q)) {
    return { action: 'showSavings' };
  }
  if (/my\s+score|joule\s+score/i.test(q)) {
    return { action: 'showScore' };
  }
  if (/how'?s?\s+my\s+system|system\s+(?:doing|performance)/i.test(q)) {
    return { action: 'systemStatus' };
  }
  
  // Educational queries
  if (/(?:what\s+is|explain|tell\s+me\s+about)\s+(hspf|seer|cop|hdd|cdd|insulation|aux\s*heat)/i.test(q)) {
    const match = q.match(/(?:what\s+is|explain|tell\s+me\s+about)\s+(hspf|seer|cop|hdd|cdd|insulation|aux\s*heat)/i);
    const topic = match[1].toLowerCase().replace(/\s+/g, '');
    return { action: 'educate', topic };
  }
  if (/why.*?bill\s+(?:so\s+)?high|high\s+bill/i.test(q)) {
    return { action: 'explainBill' };
  }
  if (/what'?s?\s+normal\s+(?:for|in)\s+([A-Za-z\s,]+)/i.test(q)) {
    const match = q.match(/what'?s?\s+normal\s+(?:for|in)\s+([A-Za-z\s,]+)/i);
    return { action: 'normalForCity', cityName: match[1].trim() };
  }
  
  return null;
}

// Enhanced parsing with context
export function parseAskJoule(query, context = {}) {
  if (!query) return {};
  const q = String(query).trim();
  
  // Check for commands first
  const command = parseCommandLocal(q);
  if (command) {
    return { ...command, isCommand: true };
  }
  
  // Original parsing logic
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



