/**
 * Intent Classifier for Thermostat Commands
 * Uses Groq LLM to classify user commands into structured intents
 * Falls back to regex patterns if API key is unavailable
 */

// Intent types that the classifier can recognize
export const INTENT_TYPES = {
  SET_THERMOSTAT: "SET_THERMOSTAT",
  SET_ROOM_TEMP: "SET_ROOM_TEMP",
  ADJUST_TEMP_UP: "ADJUST_TEMP_UP",
  ADJUST_TEMP_DOWN: "ADJUST_TEMP_DOWN",
  QUERY_TEMPERATURE: "QUERY_TEMPERATURE",
  QUERY_STATUS: "QUERY_STATUS",
  SWITCH_MODE: "SWITCH_MODE",
  OPTIMIZE_COMFORT: "OPTIMIZE_COMFORT",
  OPTIMIZE_SAVINGS: "OPTIMIZE_SAVINGS",
  QUERY_COMFORT: "QUERY_COMFORT",
  QUERY_SYSTEM_RUNNING: "QUERY_SYSTEM_RUNNING",
  SWITCH_TEMP_SOURCE: "SWITCH_TEMP_SOURCE",
  BEDTIME_TEMP: "BEDTIME_TEMP",
  PERSONALITY_QUERY: "PERSONALITY_QUERY",
  MULTI_STEP: "MULTI_STEP", // Multiple actions in one command
  QUERY_HUMIDITY: "QUERY_HUMIDITY",
  QUERY_ENERGY: "QUERY_ENERGY",
  QUERY_WEATHER: "QUERY_WEATHER",
  FAN_CONTROL: "FAN_CONTROL",
  HELP: "HELP", // User asking what commands are available
  QUERY_SETTINGS: "QUERY_SETTINGS", // Query thermostat settings
  UPDATE_SETTINGS: "UPDATE_SETTINGS", // Update a setting
  UNKNOWN: "UNKNOWN",
};

/**
 * Classify user command using Groq LLM
 * Returns structured intent with type and extracted parameters
 */
export async function classifyIntent(
  command,
  apiKey,
  model = "llama-3.1-8b-instant"
) {
  if (!apiKey || !apiKey.trim()) {
    // Fallback to regex if no API key
    return classifyIntentRegex(command);
  }

  const systemPrompt = `You are an intent classifier for a smart thermostat system. Classify user commands into intents and extract parameters.

CRITICAL RULES:
1. SET_ROOM_TEMP vs SET_THERMOSTAT: If user says "room temp" or "room temperature", use SET_ROOM_TEMP. Otherwise use SET_THERMOSTAT for setpoint changes.
2. ADJUST vs SET: "make it warmer/cooler" or "turn up/down" = ADJUST. "set to X" or "change to X" = SET.
3. MULTI_STEP: If command contains multiple actions (e.g., "set to 72 and switch to cool"), use MULTI_STEP and extract all parameters.
4. Temperature ranges: SET_THERMOSTAT (60-80°F), SET_ROOM_TEMP (50-90°F), ADJUST (default 2° if not specified).

Available intents:
- SET_THERMOSTAT: Set thermostat setpoint (e.g., "set to 72", "change temperature to 70", "make it 68 degrees")
- SET_ROOM_TEMP: Set room temperature for simulation (e.g., "set room temp to 65", "room temperature 60")
- ADJUST_TEMP_UP: Increase temperature (e.g., "make it warmer", "turn up by 2", "increase 3 degrees", "bump it up")
- ADJUST_TEMP_DOWN: Decrease temperature (e.g., "make it cooler", "turn down by 2", "decrease 3 degrees", "lower it")
- QUERY_TEMPERATURE: Ask current temperature (e.g., "what's the temp", "how hot is it", "current temperature")
- QUERY_STATUS: Full status report (e.g., "status", "what's the status", "give me a report", "system status")
- SWITCH_MODE: Change HVAC mode (e.g., "switch to heat", "cool mode", "turn on auto", "set to off")
- OPTIMIZE_COMFORT: Optimize for comfort (e.g., "optimize for comfort", "make it comfortable", "comfort mode")
- OPTIMIZE_SAVINGS: Optimize for savings (e.g., "save energy", "optimize for savings", "efficiency mode")
- QUERY_COMFORT: Ask about comfort level (e.g., "how comfortable", "is it comfortable", "comfort level")
- QUERY_SYSTEM_RUNNING: Ask if system is running (e.g., "is it running", "system running", "hvac active")
- SWITCH_TEMP_SOURCE: Switch temperature source (e.g., "use CPU temp", "switch to manual", "CPU mode")
- BEDTIME_TEMP: Set sleep temperature (e.g., "bedtime temp", "sleep mode", "night temperature")
- PERSONALITY_QUERY: Fun questions (e.g., "how are you", "Gordon Ramsay mode", "how you feeling")
- MULTI_STEP: Multiple actions (e.g., "set to 72 and cool mode", "72 degrees and switch to auto")
- QUERY_HUMIDITY: Ask about humidity (e.g., "what's the humidity", "humidity level")
- QUERY_ENERGY: Ask about energy usage (e.g., "energy use", "how much energy", "cost")
- QUERY_WEATHER: Ask about outside weather (e.g., "outside temp", "weather", "outdoor temperature")
- FAN_CONTROL: Control fan (e.g., "start fan", "fan for 10 minutes", "run fan")
- HELP: Ask for help/commands (e.g., "what can you do", "help", "commands", "what commands")
- QUERY_SETTINGS: Query thermostat settings (e.g., "what are my thresholds", "show comfort settings", "current differential")
- UPDATE_SETTINGS: Update a setting (e.g., "set heat differential to 1", "change compressor off time to 5 minutes", "set heat min on time to 10 minutes", "change temperature correction to 2 degrees")
- UNKNOWN: Doesn't match any intent

For UPDATE_SETTINGS, extract:
- settingName: the setting to update (e.g., "heatDifferential", "compressorMinCycleOff", "temperatureCorrection")
- settingValue: the numeric value or string value to set
- settingUnit: if applicable (e.g., "degrees", "minutes", "seconds", "fahrenheit")

Respond ONLY with valid JSON:
{
  "intent": "INTENT_TYPE",
  "parameters": {
    "temperature": 72,     // Temperature value if mentioned (null otherwise)
    "degrees": 2,          // Adjustment amount if mentioned (null otherwise, default 2 for ADJUST)
    "mode": "heat",        // Mode: "heat", "cool", "auto", "off" (null if not mentioned)
    "source": "cpu",       // Source: "cpu" or "manual" (null if not mentioned)
    "actions": [],         // For MULTI_STEP: array of action objects with intent and params
    "settingName": "heatDifferential",  // For UPDATE_SETTINGS: name of setting to update
    "settingValue": 1,     // For UPDATE_SETTINGS: value to set
    "settingUnit": "degrees"  // For UPDATE_SETTINGS: unit (degrees, minutes, seconds, fahrenheit)
  },
  "confidence": 0.95       // Confidence 0-1
}

For MULTI_STEP, parameters.actions should be an array like:
[{"intent": "SET_THERMOSTAT", "temperature": 72}, {"intent": "SWITCH_MODE", "mode": "cool"}]

Be accurate and confident. If uncertain, use UNKNOWN.`;

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: command },
          ],
          temperature: 0.1, // Low temperature for consistent classification
          max_tokens: 200,
          // Only use JSON mode if model supports it (llama-3.1+)
          ...(model.includes("llama-3.1") || model.includes("llama-3.3")
            ? { response_format: { type: "json_object" } }
            : {}),
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return classifyIntentRegex(command);
    }

    try {
      // Try to extract JSON from response (handles both pure JSON and text with JSON)
      let jsonStr = content.trim();
      // If response contains JSON in code blocks, extract it
      const jsonMatch =
        jsonStr.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) ||
        jsonStr.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const result = JSON.parse(jsonStr);
      // Validate intent type
      if (Object.values(INTENT_TYPES).includes(result.intent)) {
        return {
          intent: result.intent,
          parameters: {
            temperature: result.parameters?.temperature ?? null,
            degrees: result.parameters?.degrees ?? null,
            mode: result.parameters?.mode ?? null,
            source: result.parameters?.source ?? null,
            actions: result.parameters?.actions ?? null, // For MULTI_STEP
          },
          confidence: result.confidence ?? 0.8,
          method: "llm",
        };
      }
    } catch (parseError) {
      console.warn(
        "Failed to parse LLM response, falling back to regex:",
        parseError
      );
      if (import.meta.env.DEV) {
        console.log("LLM response content:", content);
      }
    }
  } catch (error) {
    console.warn("LLM classification failed, falling back to regex:", error);
  }

  // Fallback to regex
  return classifyIntentRegex(command);
}

/**
 * Fallback regex-based intent classification
 * Used when API key is unavailable or LLM fails
 */
function classifyIntentRegex(command) {
  const lower = command.toLowerCase();

  // SET_ROOM_TEMP - must check before SET_THERMOSTAT
  const roomMatch = lower.match(/(?:set|change).*?room.*?temp.*?(\d+)/);
  if (roomMatch) {
    const temp = parseInt(roomMatch[1]);
    if (temp >= 50 && temp <= 90) {
      return {
        intent: INTENT_TYPES.SET_ROOM_TEMP,
        parameters: {
          temperature: temp,
          degrees: null,
          mode: null,
          source: null,
        },
        confidence: 0.9,
        method: "regex",
      };
    }
  }

  // SET_THERMOSTAT
  const tempMatch = lower.match(
    /(?:set|change|adjust).*?(?:thermostat|temperature|setting|setpoint).*?(\d+)/
  );
  if (tempMatch && !/room/i.test(lower)) {
    const temp = parseInt(tempMatch[1]);
    if (temp >= 60 && temp <= 80) {
      return {
        intent: INTENT_TYPES.SET_THERMOSTAT,
        parameters: {
          temperature: temp,
          degrees: null,
          mode: null,
          source: null,
        },
        confidence: 0.9,
        method: "regex",
      };
    }
  }

  // ADJUST_TEMP_UP
  const adjustUpMatch = lower.match(
    /(?:make.*(?:warmer|hotter)|increase.*temp|turn.*up).*?(\d+)/
  );
  if (adjustUpMatch) {
    return {
      intent: INTENT_TYPES.ADJUST_TEMP_UP,
      parameters: {
        temperature: null,
        degrees: parseInt(adjustUpMatch[1]),
        mode: null,
        source: null,
      },
      confidence: 0.85,
      method: "regex",
    };
  }
  if (/make.*(?:warmer|hotter)|increase.*temp|turn.*up/i.test(lower)) {
    return {
      intent: INTENT_TYPES.ADJUST_TEMP_UP,
      parameters: { temperature: null, degrees: 2, mode: null, source: null },
      confidence: 0.8,
      method: "regex",
    };
  }

  // ADJUST_TEMP_DOWN
  const adjustDownMatch = lower.match(
    /(?:make.*(?:cooler|colder)|decrease.*temp|turn.*down).*?(\d+)/
  );
  if (adjustDownMatch) {
    return {
      intent: INTENT_TYPES.ADJUST_TEMP_DOWN,
      parameters: {
        temperature: null,
        degrees: parseInt(adjustDownMatch[1]),
        mode: null,
        source: null,
      },
      confidence: 0.85,
      method: "regex",
    };
  }
  if (/make.*(?:cooler|colder)|decrease.*temp|turn.*down/i.test(lower)) {
    return {
      intent: INTENT_TYPES.ADJUST_TEMP_DOWN,
      parameters: { temperature: null, degrees: 2, mode: null, source: null },
      confidence: 0.8,
      method: "regex",
    };
  }

  // QUERY_TEMPERATURE
  if (
    /what.*(?:current|is).*temp|current.*temp|temp.*(?:in|here)/i.test(lower)
  ) {
    return {
      intent: INTENT_TYPES.QUERY_TEMPERATURE,
      parameters: {
        temperature: null,
        degrees: null,
        mode: null,
        source: null,
      },
      confidence: 0.9,
      method: "regex",
    };
  }

  // SWITCH_MODE
  if (/(?:switch|change|set).*?(?:to|mode).*?(heat|heating)/i.test(lower)) {
    return {
      intent: INTENT_TYPES.SWITCH_MODE,
      parameters: {
        temperature: null,
        degrees: null,
        mode: "heat",
        source: null,
      },
      confidence: 0.9,
      method: "regex",
    };
  }
  if (/(?:switch|change|set).*?(?:to|mode).*?(cool|cooling)/i.test(lower)) {
    return {
      intent: INTENT_TYPES.SWITCH_MODE,
      parameters: {
        temperature: null,
        degrees: null,
        mode: "cool",
        source: null,
      },
      confidence: 0.9,
      method: "regex",
    };
  }
  if (/(?:switch|change|set).*?(?:to|mode).*?auto/i.test(lower)) {
    return {
      intent: INTENT_TYPES.SWITCH_MODE,
      parameters: {
        temperature: null,
        degrees: null,
        mode: "auto",
        source: null,
      },
      confidence: 0.9,
      method: "regex",
    };
  }
  if (/(?:turn|switch).*?off/i.test(lower)) {
    return {
      intent: INTENT_TYPES.SWITCH_MODE,
      parameters: {
        temperature: null,
        degrees: null,
        mode: "off",
        source: null,
      },
      confidence: 0.9,
      method: "regex",
    };
  }

  // QUERY_STATUS
  if (/status|status.*report|what.*status|current.*status/i.test(lower)) {
    return {
      intent: INTENT_TYPES.QUERY_STATUS,
      parameters: {
        temperature: null,
        degrees: null,
        mode: null,
        source: null,
      },
      confidence: 0.9,
      method: "regex",
    };
  }

  // OPTIMIZE_COMFORT
  if (/optimize.*comfort/i.test(lower)) {
    return {
      intent: INTENT_TYPES.OPTIMIZE_COMFORT,
      parameters: {
        temperature: null,
        degrees: null,
        mode: null,
        source: null,
      },
      confidence: 0.9,
      method: "regex",
    };
  }

  // OPTIMIZE_SAVINGS
  if (/optimize.*(?:cost|savings|energy)/i.test(lower)) {
    return {
      intent: INTENT_TYPES.OPTIMIZE_SAVINGS,
      parameters: {
        temperature: null,
        degrees: null,
        mode: null,
        source: null,
      },
      confidence: 0.9,
      method: "regex",
    };
  }

  // QUERY_COMFORT
  if (/how.*comfort/i.test(lower)) {
    return {
      intent: INTENT_TYPES.QUERY_COMFORT,
      parameters: {
        temperature: null,
        degrees: null,
        mode: null,
        source: null,
      },
      confidence: 0.9,
      method: "regex",
    };
  }

  // QUERY_SYSTEM_RUNNING
  if (/(?:is|are).*system.*running|system.*status|hvac.*running/i.test(lower)) {
    return {
      intent: INTENT_TYPES.QUERY_SYSTEM_RUNNING,
      parameters: {
        temperature: null,
        degrees: null,
        mode: null,
        source: null,
      },
      confidence: 0.85,
      method: "regex",
    };
  }

  // SWITCH_TEMP_SOURCE
  if (/use.*cpu|cpu.*temp/i.test(lower)) {
    return {
      intent: INTENT_TYPES.SWITCH_TEMP_SOURCE,
      parameters: {
        temperature: null,
        degrees: null,
        mode: null,
        source: "cpu",
      },
      confidence: 0.9,
      method: "regex",
    };
  }
  if (/use.*manual|manual.*temp/i.test(lower)) {
    return {
      intent: INTENT_TYPES.SWITCH_TEMP_SOURCE,
      parameters: {
        temperature: null,
        degrees: null,
        mode: null,
        source: "manual",
      },
      confidence: 0.9,
      method: "regex",
    };
  }

  // BEDTIME_TEMP
  if (/bedtime.*temp|sleep.*temp/i.test(lower)) {
    return {
      intent: INTENT_TYPES.BEDTIME_TEMP,
      parameters: {
        temperature: null,
        degrees: null,
        mode: null,
        source: null,
      },
      confidence: 0.9,
      method: "regex",
    };
  }

  // PERSONALITY_QUERY
  if (/how.*(?:you|are you).*feel|gordon.*ramsay|ramsay/i.test(lower)) {
    return {
      intent: INTENT_TYPES.PERSONALITY_QUERY,
      parameters: {
        temperature: null,
        degrees: null,
        mode: null,
        source: null,
      },
      confidence: 0.85,
      method: "regex",
    };
  }

  // QUERY_HUMIDITY
  if (/humidity/i.test(lower)) {
    return {
      intent: INTENT_TYPES.QUERY_HUMIDITY,
      parameters: {
        temperature: null,
        degrees: null,
        mode: null,
        source: null,
      },
      confidence: 0.9,
      method: "regex",
    };
  }

  // QUERY_ENERGY
  if (
    /(?:energy.*use|how.*much.*energy|cost.*month|energy.*cost)/i.test(lower)
  ) {
    return {
      intent: INTENT_TYPES.QUERY_ENERGY,
      parameters: {
        temperature: null,
        degrees: null,
        mode: null,
        source: null,
      },
      confidence: 0.85,
      method: "regex",
    };
  }

  // QUERY_WEATHER
  if (/(?:outside.*temp|weather.*outside|outdoor.*temp)/i.test(lower)) {
    return {
      intent: INTENT_TYPES.QUERY_WEATHER,
      parameters: {
        temperature: null,
        degrees: null,
        mode: null,
        source: null,
      },
      confidence: 0.85,
      method: "regex",
    };
  }

  // FAN_CONTROL
  if (/start.*fan|fan.*(\d+).*min|run.*fan/i.test(lower)) {
    return {
      intent: INTENT_TYPES.FAN_CONTROL,
      parameters: {
        temperature: null,
        degrees: null,
        mode: null,
        source: null,
      },
      confidence: 0.8,
      method: "regex",
    };
  }

  // HELP
  if (
    /(?:what.*can.*you.*do|help|commands|what.*commands|how.*do.*i)/i.test(
      lower
    )
  ) {
    return {
      intent: INTENT_TYPES.HELP,
      parameters: {
        temperature: null,
        degrees: null,
        mode: null,
        source: null,
      },
      confidence: 0.9,
      method: "regex",
    };
  }

  // QUERY_SETTINGS
  if (
    /(?:what.*(?:are|is).*threshold|show.*settings|current.*differential|what.*differential|settings.*status)/i.test(
      lower
    )
  ) {
    return {
      intent: INTENT_TYPES.QUERY_SETTINGS,
      parameters: {
        temperature: null,
        degrees: null,
        mode: null,
        source: null,
      },
      confidence: 0.85,
      method: "regex",
    };
  }

  // UPDATE_SETTINGS (basic patterns)
  if (
    /(?:set|change|update).*(?:threshold|differential|setting)/i.test(lower)
  ) {
    return {
      intent: INTENT_TYPES.UPDATE_SETTINGS,
      parameters: {
        temperature: null,
        degrees: null,
        mode: null,
        source: null,
      },
      confidence: 0.8,
      method: "regex",
    };
  }

  // MULTI_STEP - check for "and" or comma-separated commands
  if (/\sand\s|,\s*(?:and|then)/i.test(lower)) {
    // This is complex - let LLM handle it, but regex can catch simple cases
    // For now, return UNKNOWN and let LLM classify
  }

  // UNKNOWN
  return {
    intent: INTENT_TYPES.UNKNOWN,
    parameters: { temperature: null, degrees: null, mode: null, source: null },
    confidence: 0.5,
    method: "regex",
  };
}
