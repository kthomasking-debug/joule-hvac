// Standalone command parser for Ask Joule
// Extracted logic for natural language commands

const INSULATION_MAP = { poor: 1.4, average: 1.0, typical: 1.0, good: 0.65 };

export function parseCommand(q, context = {}) {
  if (!q) return null;
  const qLower = q.toLowerCase().trim();

  // Allow specific question-format commands BEFORE rejecting generic questions

  // Query temp ("what's the current temperature")
  if (
    /what'?s?\s+(?:the\s+)?(?:current\s+)?(?:temp|temperature)|how\s+(?:hot|cold|warm)\s+is\s+it/i.test(
      q
    )
  )
    return { action: "queryTemp" };

  // Balance point queries
  if (
    /(?:what(?:'s| is)\s+(?:my\s+)?balance\s*point|calculate.*balance|find.*balance|show.*balance)/i.test(
      q
    )
  )
    return { action: "calculateBalancePoint" };

  // What-if efficiency queries
  if (/what\s+if.*?(\d+\.?\d*)\s*hspf/i.test(q)) {
    const match = q.match(/what\s+if.*?(\d+\.?\d*)\s*hspf/i);
    return { action: "whatIfHSPF", value: parseFloat(match[1]) };
  }
  if (/what\s+if.*?(\d+\.?\d*)\s*seer/i.test(q)) {
    const match = q.match(/what\s+if.*?(\d+\.?\d*)\s*seer/i);
    return { action: "whatIfSEER", value: parseFloat(match[1]) };
  }

  // Diagnostics queries with question words
  if (
    /(?:what\s+(?:problems?|issues?)|diagnostics?|check\s+(?:my\s+)?system|system\s+(?:problems?|issues?)|any\s+(?:problems?|issues?))/i.test(
      q
    )
  )
    return { action: "showDiagnostics" };

  // Reject other questions - if it starts with question words, it's NOT a command
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
  // Presets
  if (
    /(?:i'm|im|i\s+am)\s+(?:going\s+to\s+)?(?:sleep|bed)|sleep\s+mode|bedtime/i.test(
      q
    )
  )
    return { action: "presetSleep" };
  if (
    /(?:i'm|im|i\s+am)\s+(?:leaving|going\s+out|gone)|away\s+mode|vacation\s+mode/i.test(
      q
    )
  )
    return { action: "presetAway" };
  if (/(?:i'm|im|i\s+am)\s+(?:home|back)|home\s+mode|normal\s+mode/i.test(q))
    return { action: "presetHome" };

  // Navigation commands
  if (
    /(?:show|open|display)\s+(?:the\s+)?(?:contactor|hardware|relay)(?:\s+demo)?|(?:show|open)\s+hardware\s+demo/i.test(
      q
    )
  )
    return { action: "navigate", target: "contactors" };

  // Direct settings - Winter temperature
  if (
    /set\s+winter\s+(?:temp|temperature|thermostat)\s+(?:to\s+)?(\d{2})/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+winter\s+(?:temp|temperature|thermostat)\s+(?:to\s+)?(\d{2})/i
    );
    return { action: "setWinterTemp", value: parseInt(match[1], 10) };
  }

  // Explicit season targets
  if (
    /set\s+(?:heating|heat)\s*(?:temp|temperature)?\s*(?:to\s+)?(\d{2})/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+(?:heating|heat)\s*(?:temp|temperature)?\s*(?:to\s+)?(\d{2})/i
    );
    return { action: "setWinterTemp", value: parseInt(match[1], 10) };
  }
  if (
    /set\s+(?:cooling|cool)\s*(?:temp|temperature)?\s*(?:to\s+)?(\d{2})/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+(?:cooling|cool)\s*(?:temp|temperature)?\s*(?:to\s+)?(\d{2})/i
    );
    return { action: "setSummerTemp", value: parseInt(match[1], 10) };
  }
  if (
    /set\s+summer\s+(?:temp|temperature|thermostat)\s+(?:to\s+)?(\d{2})/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+summer\s+(?:temp|temperature|thermostat)\s+(?:to\s+)?(\d{2})/i
    );
    return { action: "setSummerTemp", value: parseInt(match[1], 10) };
  }

  // Set HSPF/SEER (not what-if)
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
  if (
    /set\s+(?:my\s+)?(?:location|city)\s+(?:to\s+)?([A-Za-z.\-\s,]+?)$/i.test(q)
  ) {
    const match = q.match(
      /set\s+(?:my\s+)?(?:location|city)\s+(?:to\s+)?([A-Za-z.\-\s,]+?)$/i
    );
    if (match) return { action: "setLocation", cityName: match[1].trim() };
  }
  if (
    /set\s+(?:square\s*feet|sq\s*ft|sqft|square\s*footage|sf)\s+(?:to\s+)?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(k?)\b/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+(?:square\s*feet|sq\s*ft|sqft|square\s*footage|sf)\s+(?:to\s+)?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(k?)\b/i
    );
    if (match) {
      const raw = match[1].replace(/,/g, "");
      const hasK = match[2].toLowerCase() === "k";
      const val = hasK ? Math.round(parseFloat(raw) * 1000) : parseInt(raw, 10);
      return { action: "setSquareFeet", value: Number(val) };
    }
  }
  if (/set\s+insulation\s+to\s+(poor|average|typical|good)/i.test(q)) {
    const m = q.match(/set\s+insulation\s+to\s+(poor|average|typical|good)/i);
    if (m)
      return {
        action: "setInsulationLevel",
        value: INSULATION_MAP[m[1].toLowerCase()],
        raw: m[1],
      };
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
  // Additional setting commands
  // Generic temperature setting (before specific thermostat patterns)
  if (/set\s+(?:the\s+)?temperature\s+(?:to\s+)?(\d{2})/i.test(q)) {
    const match = q.match(/set\s+(?:the\s+)?temperature\s+(?:to\s+)?(\d{2})/i);
    return { action: "setThermostat", value: parseInt(match[1], 10) };
  }
  if (/set\s+(?:my\s+)?thermostat\s+(?:to\s+)?(\d{2})/i.test(q)) {
    const match = q.match(/set\s+(?:my\s+)?thermostat\s+(?:to\s+)?(\d{2})/i);
    return { action: "setThermostat", value: parseInt(match[1], 10) };
  }
  if (/adjust\s+(?:the\s+)?thermostat\s+(?:to\s+)?(\d{2})/i.test(q)) {
    const match = q.match(
      /adjust\s+(?:the\s+)?thermostat\s+(?:to\s+)?(\d{2})/i
    );
    return { action: "setThermostat", value: parseInt(match[1], 10) };
  }
  if (
    /set\s+(?:my\s+)?(?:gas\s+)?(?:cost|price)\s+(?:to\s+)?\$?(\d+(?:\.\d+)?)/i.test(
      q
    )
  ) {
    const match = q.match(
      /set\s+(?:my\s+)?(?:gas\s+)?(?:cost|price)\s+(?:to\s+)?\$?(\d+(?:\.\d+)?)/i
    );
    return { action: "setGasCost", value: parseFloat(match[1]) };
  }
  if (/set\s+(?:my\s+)?(?:ceiling\s+)?height\s+(?:to\s+)?(\d+)/i.test(q)) {
    const match = q.match(
      /set\s+(?:my\s+)?(?:ceiling\s+)?height\s+(?:to\s+)?(\d+)/i
    );
    return { action: "setCeilingHeight", value: parseInt(match[1], 10) };
  }
  if (/(?:enable|turn\s+on)\s+(?:aux(?:iliary)?\s+)?(?:heat|backup)/i.test(q)) {
    return { action: "setAuxHeat", value: true };
  }
  if (
    /(?:disable|turn\s+off)\s+(?:aux(?:iliary)?\s+)?(?:heat|backup)/i.test(q)
  ) {
    return { action: "setAuxHeat", value: false };
  }

  // Other diagnostics queries (non-question format)
  if (
    /(?:short\s+cycl|rapid\s+cycl|turning\s+on\s+and\s+off|cycl.*problem)/i.test(
      q
    )
  )
    return { action: "checkShortCycling" };
  if (
    /(?:thermostat\s+data|csv\s+data|uploaded\s+data|my\s+data|data\s+file)/i.test(
      q
    )
  )
    return { action: "showCsvInfo" };
  if (
    /(?:aux(?:iliary)?\s+heat|emergency\s+heat|backup\s+heat).*(?:problem|issue|high|excessive)/i.test(
      q
    )
  )
    return { action: "checkAuxHeat" };
  if (/(?:temperature\s+swing|temp.*unstable|temperature.*fluctuat)/i.test(q))
    return { action: "checkTempStability" };

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

  // Navigation
  if (
    /(?:forecast|7\s*day|weekly|week|predict|estimate\s+cost)/i.test(q) &&
    !/thermostat/.test(qLower) &&
    !/schedule/.test(qLower)
  )
    return { action: "navigate", target: "forecast" };
  if (
    /(?:take\s+me\s+to|show\s+me|open|go\s+to)\s+(?:the\s+)?(?:home|dashboard)/i.test(
      q
    )
  )
    return { action: "navigate", target: "home" };
  if (
    /(?:take\s+me\s+to|show\s+me|open|go\s+to)\s+(?:the\s+)?(?:forecast|7\s*day)/i.test(
      q
    )
  )
    return { action: "navigate", target: "forecast" };
  if (
    /(?:compar|vs|versus|heat\s*pump\s+vs|gas\s+vs|compare\s+systems|take\s+me\s+to.*compar|show\s+me.*compar)/i.test(
      q
    )
  )
    return { action: "navigate", target: "comparison" };
  if (/(?:balance\s*point|energy\s+flow|performance\s+graph|visualiz)/i.test(q))
    return { action: "navigate", target: "balance" };
  if (
    /(?:charging|subcool|refrigerant|charge\s+calculator|a\/?c\s+charg)/i.test(
      q
    )
  )
    return { action: "navigate", target: "charging" };
  if (
    /(?:performance\s+analyz|thermal\s+factor|building\s+factor|upload\s+thermostat|analyze\s+data)/i.test(
      q
    )
  )
    return { action: "navigate", target: "analyzer" };
  if (
    /(?:methodology|how\s+(?:does|do)\s+(?:the\s+)?(?:math|calculation)|explain\s+(?:the\s+)?(?:math|formula)|formula)/i.test(
      q
    )
  )
    return { action: "navigate", target: "methodology" };
  if (
    /(?:take\s+me\s+to|show\s+me|open|go\s+to)\s+(?:the\s+)?settings/i.test(q)
  )
    return { action: "navigate", target: "settings" };
  if (
    /(?:settings|preferences|configuration|adjust\s+settings|change\s+settings)/i.test(
      q
    ) &&
    !/winter|summer|temp/.test(qLower)
  )
    return { action: "navigate", target: "settings" };
  if (
    /(?:thermostat\s+(?:strategy|analyz)|setback|constant\s+temp|nightly\s+setback|thermostat\s+compar)/i.test(
      q
    )
  )
    return { action: "navigate", target: "thermostat" };
  if (
    /(?:take\s+me\s+to|show\s+me|open|go\s+to)\s+(?:the\s+)?(?:monthly\s+budget|budget)/i.test(
      q
    )
  )
    return { action: "navigate", target: "budget" };
  if (
    /(?:monthly\s+budget|budget\s+plan|track\s+costs|budget\s+tool|plan\s+budget)/i.test(
      q
    )
  )
    return { action: "navigate", target: "budget" };
  if (
    /(?:upgrade|roi|return\s+on\s+investment|payback|should\s+i\s+upgrade)/i.test(
      q
    ) &&
    !qLower.includes("break")
  )
    return { action: "navigate", target: "roi" };

  // Help/info
  if (
    /^(?:help|what\s+can\s+you\s+do|what\s+do\s+you\s+do|how\s+do\s+(?:i|you)\s+(?:use|work)|capabilities|commands?)$/i.test(
      q
    )
  )
    return { action: "showHelp" };
  if (/what\s+can\s+i\s+save|how\s+to\s+save|savings?/i.test(q))
    return { action: "showSavings" };
  if (/my\s+score|joule\s+score/i.test(q)) return { action: "showScore" };
  if (/how'?s?\s+my\s+system|system\s+(?:doing|performance)/i.test(q))
    return { action: "systemStatus" };

  // Educational queries
  if (
    /(?:what\s+is|explain|tell\s+me\s+about)\s+(hspf|seer|cop|hdd|cdd|insulation|aux\s*heat)/i.test(
      q
    )
  ) {
    const match = q.match(
      /(?:what\s+is|explain|tell\s+me\s+about)\s+(hspf|seer|cop|hdd|cdd|insulation|aux\s*heat)/i
    );
    const topic = match[1].toLowerCase().replace(/\s+/g, "");
    return { action: "educate", topic };
  }
  if (/why.*?bill\s+(?:so\s+)?high|high\s+bill/i.test(q))
    return { action: "explainBill" };
  if (/what'?s?\s+normal\s+(?:for|in)\s+([A-Za-z\s,]+)/i.test(q)) {
    const match = q.match(/what'?s?\s+normal\s+(?:for|in)\s+([A-Za-z\s,]+)/i);
    return { action: "normalForCity", cityName: match[1].trim() };
  }

  // Undo
  if (/^undo\b|undo\s+last\s+change|revert\s+last\s+change/i.test(q))
    return { action: "undo", when: "last", isCommand: true };

  return null;
}

export default parseCommand;
