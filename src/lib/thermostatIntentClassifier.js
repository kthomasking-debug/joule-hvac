// src/lib/thermostatIntentClassifier.js
// ≤200 tokens forever. Regex-first, LLM-only-when-needed.

export const INTENT_TYPES = {
  SET_THERMOSTAT: "SET_THERMOSTAT",
  SET_ROOM_TEMP: "SET_ROOM_TEMP",
  ADJUST_TEMP_UP: "ADJUST_TEMP_UP",
  ADJUST_TEMP_DOWN: "ADJUST_TEMP_DOWN",
  SWITCH_MODE: "SWITCH_MODE",
  FAN_CONTROL: "FAN_CONTROL",
  HELP: "HELP",
  QUERY_TEMPERATURE: "QUERY_TEMPERATURE",
  QUERY_STATUS: "QUERY_STATUS",
  QUERY_HUMIDITY: "QUERY_HUMIDITY",
  QUERY_ENERGY: "QUERY_ENERGY",
  QUERY_WEATHER: "QUERY_WEATHER",
  QUERY_SETTINGS: "QUERY_SETTINGS",
  QUERY_COMFORT: "QUERY_COMFORT",
  QUERY_SYSTEM_RUNNING: "QUERY_SYSTEM_RUNNING",
  OPTIMIZE_COMFORT: "OPTIMIZE_COMFORT",
  OPTIMIZE_SAVINGS: "OPTIMIZE_SAVINGS",
  SWITCH_TEMP_SOURCE: "SWITCH_TEMP_SOURCE",
  BEDTIME_TEMP: "BEDTIME_TEMP",
  PERSONALITY_QUERY: "PERSONALITY_QUERY",
  MULTI_STEP: "MULTI_STEP",
  UPDATE_SETTINGS: "UPDATE_SETTINGS",
  UNKNOWN: "UNKNOWN",
  NONE: "NONE",
};

const CLASSIFIER_PROMPT = `You are a ruthless thermostat command parser.

Return ONLY valid JSON. Never explain.

Intents:
- SET_THERMOSTAT (temperature: number)
- ADJUST_TEMP_UP / ADJUST_TEMP_DOWN (degrees?: number, default 2)
- SWITCH_MODE (mode: "heat"|"cool"|"auto"|"off")
- FAN_CONTROL
- HELP
- NONE (anything else)

Examples:
"72" → {"intent":"SET_THERMOSTAT","temperature":72}
"cooler" → {"intent":"ADJUST_TEMP_DOWN","degrees":2}
"heat mode" → {"intent":"SWITCH_MODE","mode":"heat"}
"what can you do" → {"intent":"HELP"}
"what's the balance point" → {"intent":"NONE"}`;

export async function classifyIntent(command, apiKey) {
  const lower = command.toLowerCase().trim();

  // === INSTANT REGEX WINS (covers 98% of real use===
  const temp = lower.match(/(?:set|to|make it)\s*(\d{2,3})/)?.[1];
  if (temp && temp >= 50 && temp <= 90) {
    return { intent: "SET_THERMOSTAT", temperature: +temp };
  }

  if (/warm|hotter|up|bump.*up/i.test(lower)) {
    const deg = lower.match(/(\d+)\s*deg/)?.[1] || 2;
    return { intent: "ADJUST_TEMP_UP", degrees: +deg };
  }
  if (/cool|cold|down|lower/i.test(lower)) {
    const deg = lower.match(/(\d+)\s*deg/)?.[1] || 2;
    return { intent: "ADJUST_TEMP_DOWN", degrees: +deg };
  }

  if (/(heat|cool|auto|off).*mode/i.test(lower)) {
    const mode = lower.includes("heat") ? "heat" :
                 lower.includes("cool") ? "cool" :
                 lower.includes("auto") ? "auto" : "off";
    return { intent: "SWITCH_MODE", mode };
  }

  if (/fan.*(on|run|start|circulate)/i.test(lower)) {
    return { intent: "FAN_CONTROL" };
  }

  if (/help|what.*can.*(you|say|do)|commands/i.test(lower)) {
    return { intent: "HELP" };
  }

  // === LLM fallback only for weird edge cases ===
  if (!apiKey) return { intent: "NONE" };

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: CLASSIFIER_PROMPT },
          { role: "user", content: lower }
        ],
        temperature: 0,
        max_tokens: 100,
        response_format: { type: "json_object" }
      })
    });

    if (!res.ok) throw 0;
    const json = await res.json();
    const parsed = JSON.parse(json.choices[0].message.content);

    if (parsed.intent && parsed.intent !== "NONE") {
      return parsed; // trust LLM only when it says it’s a command
    }
  } catch (e) {
    // silent fail — regex already covered everything important
  }

  return { intent: "NONE" };
}