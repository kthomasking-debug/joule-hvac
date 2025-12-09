/**
 * LLM-Based Intent Classifier
 * Replaces regex hell with AI paradise
 * Uses Groq (Llama 3) to classify user intents into structured JSON
 */

/**
 * Comprehensive command schema for intent classification
 * This defines all available commands the system can handle
 */
const INTENT_SCHEMA = {
  // Temperature Control
  setTemp: {
    description: "Set thermostat temperature",
    parameters: {
      value: { type: "number", range: [45, 85], description: "Temperature in Fahrenheit" },
      entity: { 
        type: "string", 
        enum: ["winter_thermostat", "summer_thermostat", "winter_thermostat_night", "summer_thermostat_night"],
        description: "Which temperature setting to modify"
      }
    }
  },
  increaseTemp: {
    description: "Increase temperature",
    parameters: {
      value: { type: "number", range: [1, 10], description: "Amount to increase" }
    }
  },
  decreaseTemp: {
    description: "Decrease temperature",
    parameters: {
      value: { type: "number", range: [1, 10], description: "Amount to decrease" }
    }
  },
  
  // Mode Control
  setMode: {
    description: "Set HVAC mode",
    parameters: {
      value: { type: "string", enum: ["heat", "cool", "auto", "off"] }
    }
  },
  
  // Presets
  presetHome: { description: "Set to home preset" },
  presetAway: { description: "Set to away preset" },
  presetSleep: { description: "Set to sleep preset" },
  
  // Navigation
  navigate: {
    description: "Navigate to a page",
    parameters: {
      target: {
        type: "string",
        enum: [
          "home", "analysis", "control", "config", "forecast", "comparison",
          "balance", "charging", "analyzer", "methodology", "settings",
          "thermostat", "budget", "roi"
        ]
      }
    }
  },
  
  // Information Queries
  getStatus: { description: "Get system status" },
  showScore: { description: "Show Joule efficiency score" },
  systemStatus: { description: "Show detailed system status" },
  
  // Calculations
  calculateHeatLoss: {
    description: "Calculate heat loss at specific outdoor temperature",
    parameters: {
      outdoorTemp: { type: "number", range: [-20, 100], description: "Outdoor temperature in Fahrenheit" }
    }
  },
  calculateSetback: { description: "Calculate setback savings" },
  calculateBalancePoint: { description: "Calculate system balance point" },
  showSavings: { description: "Show potential savings" },
  compareSystem: { description: "Compare heating systems" },
  
  // Diagnostics
  showDiagnostics: { description: "Show system diagnostics" },
  checkShortCycling: { description: "Check for short cycling issues" },
  checkAuxHeat: { description: "Check auxiliary heat usage" },
  checkTempStability: { description: "Check temperature stability" },
  showCsvInfo: { description: "Show CSV data information" },
  
  // Educational
  explain: {
    description: "Explain a concept",
    parameters: {
      topic: {
        type: "string",
        enum: [
          "hspf", "seer", "cop", "hdd", "cdd", "insulation", "aux_heat",
          "thermal_factor", "heat_loss_factor", "balance_point", "short_cycling",
          "differential", "setback", "defrost_cycle", "reversing_valve"
        ]
      }
    }
  },
  
  // Settings (Advanced)
  setCompressorMinRuntime: {
    description: "Set compressor minimum runtime",
    parameters: { value: { type: "number", range: [300, 1800] } }
  },
  setHeatDifferential: {
    description: "Set heating differential",
    parameters: { value: { type: "number", range: [0.5, 3.0] } }
  },
  setCoolDifferential: {
    description: "Set cooling differential",
    parameters: { value: { type: "number", range: [0.5, 3.0] } }
  },
  
  // Help
  help: { description: "Show help information" },
  
  // Dark Mode
  toggleDarkMode: { description: "Toggle dark mode" },
  setDarkMode: {
    description: "Set dark mode",
    parameters: { value: { type: "boolean" } }
  },
  
  // Question (not a command - send to LLM)
  question: {
    description: "General question that needs LLM response",
    parameters: {
      topic: { type: "string", description: "Topic of the question" }
    }
  }
};

/**
 * Generate the system prompt for intent classification
 */
function getIntentClassificationPrompt() {
  const commandsList = Object.entries(INTENT_SCHEMA)
    .map(([intent, schema]) => {
      const params = schema.parameters 
        ? Object.entries(schema.parameters)
            .map(([name, param]) => {
              const enumStr = param.enum ? ` (options: ${param.enum.join(", ")})` : "";
              const rangeStr = param.range ? ` (range: ${param.range[0]}-${param.range[1]})` : "";
              return `  - ${name}: ${param.type}${enumStr}${rangeStr} - ${param.description || ""}`;
            })
            .join("\n")
        : "";
      return `- ${intent}: ${schema.description}${params ? `\n  Parameters:\n${params}` : ""}`;
    })
    .join("\n");

  return `You are the intent classifier for a smart thermostat system (Joule).

Your job is to classify user queries into structured JSON intents.

AVAILABLE COMMANDS:
${commandsList}

CLASSIFICATION RULES:
1. If the user is asking a question (not giving a command), use intent: "question"
2. Extract all relevant parameters from the query
3. Be resilient to polite language ("please", "can you", "would you")
4. Understand synonyms:
   - "warmer" / "hotter" = increaseTemp
   - "colder" / "cooler" = decreaseTemp
   - "turn up" = increaseTemp
   - "turn down" = decreaseTemp
5. For temperature values, extract the number even if phrased differently
6. For navigation, match common page names to the target enum values

OUTPUT FORMAT:
Return ONLY valid JSON. No explanation, no markdown, no code blocks.
{
  "intent": "command_name",
  "parameters": {
    "param1": value1,
    "param2": "value2"
  },
  "confidence": 0.0-1.0
}

If intent is "question", return:
{
  "intent": "question",
  "parameters": {
    "topic": "brief description of what they're asking about"
  },
  "confidence": 0.0-1.0
}

EXAMPLES:
User: "Set temperature to 72"
Output: {"intent": "setTemp", "parameters": {"value": 72, "entity": "winter_thermostat"}, "confidence": 0.95}

User: "Can you please make it warmer?"
Output: {"intent": "increaseTemp", "parameters": {"value": 2}, "confidence": 0.9}

User: "How much will heating cost this month?"
Output: {"intent": "question", "parameters": {"topic": "monthly heating cost"}, "confidence": 0.95}

User: "What's my balance point?"
Output: {"intent": "calculateBalancePoint", "parameters": {}, "confidence": 0.95}

User: "Show me the forecast"
Output: {"intent": "navigate", "parameters": {"target": "forecast"}, "confidence": 0.95}`;
}

/**
 * Classify user intent using Groq LLM
 * @param {string} userQuery - The user's input query
 * @param {string} groqApiKey - Groq API key
 * @returns {Promise<Object|null>} Parsed intent object or null on error
 */
export async function classifyIntentWithLLM(userQuery, groqApiKey) {
  if (!userQuery || !groqApiKey) {
    return null;
  }

  try {
    const systemPrompt = getIntentClassificationPrompt();
    const userPrompt = `User Input: "${userQuery}"\n\nOutput: Return ONLY valid JSON. No text.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant", // Fast model for classification
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1, // Low temperature for consistent classification
        max_tokens: 200, // Short response for JSON only
        response_format: { type: "json_object" } // Force JSON output
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[llmIntentClassifier] Groq API error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error("[llmIntentClassifier] No content in response");
      return null;
    }

    // Parse JSON response
    let parsed;
    try {
      // Remove markdown code blocks if present
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error("[llmIntentClassifier] JSON parse error:", parseError, "Content:", content);
      return null;
    }

    // Handle question intent (not a command - goes to LLM for answering)
    if (parsed.intent === "question") {
      return {
        isCommand: false,
        intent: "question",
        topic: parsed.parameters?.topic || "general",
        ...parsed.parameters
      };
    }
    
    // Validate intent exists in schema
    if (!INTENT_SCHEMA[parsed.intent]) {
      console.warn("[llmIntentClassifier] Unknown intent:", parsed.intent);
      return null;
    }

    // Convert to format expected by existing parser
    // Map LLM intents to actual action names used in command handlers
    let action = parsed.intent;
    const params = parsed.parameters || {};
    
    // Map intents to actual action names used in the codebase
    const actionMap = {
      setTemp: "setWinterThermostat", // Default to winter, can be overridden
      increaseTemp: "increaseTemp",
      decreaseTemp: "decreaseTemp",
      setMode: "setMode",
      presetHome: "home",
      presetAway: "away",
      presetSleep: "sleep",
      navigate: "navigate",
      getStatus: "systemStatus",
      showScore: "showScore",
      systemStatus: "systemStatus",
      calculateHeatLoss: "calculateHeatLoss",
      calculateSetback: "showSavings",
      calculateBalancePoint: "balancePoint", // Handled by offlineAnswer
      showSavings: "showSavings",
      compareSystem: "compareSystem",
      showDiagnostics: "showDiagnostics",
      checkShortCycling: "checkShortCycling",
      checkAuxHeat: "checkAuxHeat",
      checkTempStability: "checkTempStability",
      showCsvInfo: "showCsvInfo",
      explain: "explain",
      help: "help",
      toggleDarkMode: "toggleDarkMode",
      setDarkMode: "setDarkMode",
    };
    
    action = actionMap[parsed.intent] || parsed.intent;
    
    // Handle temperature setting with entity mapping
    if (parsed.intent === "setTemp" && params.entity) {
      if (params.entity === "winter_thermostat") {
        action = "setWinterThermostat";
      } else if (params.entity === "summer_thermostat") {
        action = "setSummerThermostat";
      } else if (params.entity === "winter_thermostat_night") {
        action = "setWinterThermostatNight";
      } else if (params.entity === "summer_thermostat_night") {
        action = "setSummerThermostatNight";
      }
    }
    
    // Extract value for temperature commands
    if (parsed.intent === "setTemp" && params.value) {
      params.value = params.value;
    }
    
    // Build result object
    const result = {
      action,
      ...params,
      confidence: parsed.confidence || 0.8,
      isCommand: parsed.intent !== "question"
    };
    
    // Rename 'value' to match expected parameter names
    if (result.value !== undefined && action === "setWinterThermostat") {
      // Value is already in params, keep it
    }

    return result;

  } catch (error) {
    console.error("[llmIntentClassifier] Error:", error);
    return null;
  }
}

/**
 * Check if LLM classification should be used
 * @param {boolean} useLLM - Explicit flag to use LLM
 * @param {string} groqApiKey - Groq API key availability
 * @returns {boolean}
 */
export function shouldUseLLMClassification(useLLM = true, groqApiKey = null) {
  // For Bridge tier (Pi Zero), skip LLM (too slow)
  // For web app, use LLM if API key is available
  if (typeof window !== "undefined") {
    const isBridgeMode = localStorage.getItem("jouleBridgeMode") === "true";
    if (isBridgeMode) {
      return false; // Bridge uses regex for speed
    }
  }
  
  return useLLM && !!groqApiKey;
}

export default classifyIntentWithLLM;

