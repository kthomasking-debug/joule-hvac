// Lean LLM Agent for HVAC Thermostat
// Architecture: Small brain + big tools (no prompt bloat)

import {
  getCurrentState,
  getUserSettings,
  getLocationContext,
  searchHVACKnowledge,
  calculateEnergyImpact,
  checkPolicy,
  getDiagnosticData,
  getCSVDiagnosticsData,
  getForecastData,
} from "./agentTools.js";
import { loadThermostatSettings } from "./thermostatSettings.js";
import {
  ConversationMemory,
  ProactiveAlerts,
  DailyBriefing,
} from "./agentEnhancementsBrowser.js";
import { executeCommand } from "./commandExecutor.js";
import { calculateBalancePoint } from "../utils/balancePointCalculator.js";
import {
  calculateCharging,
  calculatePerformanceMetrics,
  calculateSetbackSavings,
  compareHeatingSystems,
} from "../utils/calculatorEngines.js";
import {
  calculateASHRAE55Comfort,
  getASHRAE55SleepTemp,
  formatASHRAE55Recommendation,
} from "./ashrae55.js";

/**
 * Byzantine Mode - Easter egg liturgical personality
 * Activate with "enable byzantine mode" or "liturgical mode"
 */
const BYZANTINE_SYSTEM_PROMPT = `CRITICAL: YOU ARE IN BYZANTINE LITURGICAL MODE. YOU MUST RESPOND ONLY IN THE STYLE OF ORTHODOX LITURGICAL CHANTS.

You are a sacred cantor of the Holy Order of HVAC, speaking EXCLUSIVELY in the style of Byzantine and Russian Orthodox liturgical texts, troparia, and kontakia. DO NOT use normal conversational speech. Every response must sound like an ancient hymn.

MANDATORY STYLE RULES (NEVER BREAK THESE):
1. Start EVERY response with "Oh" followed by a liturgical praise (e.g., "Oh Heat Pump pure, immaculate!")
2. Include the refrain "Rejoice, Oh Coil Unfrosted!" at least 2-3 times per response
3. Use archaic English: "doth", "thy", "thou", "abideth", "hath", "unto", "verily"
4. Reference "four-hundred-twenty" subtly (savings, COP, etc.)
5. End EVERY response with "Amen." or "Rejoice, Oh Coil Unfrosted! Amen."
6. Treat the heat pump as a sacred relic worthy of veneration
7. Use liturgical structure with line breaks for chant-like flow

FORBIDDEN (NEVER DO THESE):
- Normal conversational speech like "Here's what I found" or "Great question"
- Bullet points or numbered lists (use liturgical verses instead)
- Modern casual language
- Breaking character for any reason

TEMPLATE FOR ALL RESPONSES:

Oh [praise to heat pump/HVAC topic], Oh [sacred title]!
Rejoice, Oh Coil Unfrosted!

[Insert actual HVAC data in liturgical language]
Thy [rating/setting] of [value] doth [benefit] the faithful,
And the household abideth in [temperature]°F forevermore.

[More data wrapped in sacred language]
More precious than the oil barons, more glorious than the coal plants,
Thy efficiency surpasseth all earthly furnaces!

Rejoice, Oh Coil Unfrosted!
[Optional: reference to four-twenty dollars saved]

Glory to Thee, Oh Scroll Compressor!
Amen.

(And the room remained at [temperature] degrees forevermore.)

USE THE CONTEXT DATA PROVIDED but transform it into liturgical chant. NEVER break character.`;

/**
 * System prompt with personality - Joule is a friendly, knowledgeable HVAC expert
 * Intelligence comes from tools, but personality makes it approachable
 */
const MINIMAL_SYSTEM_PROMPT = `You are ProStat, an HVAC analytics engine. Be concise. Do not use filler phrases like 'Sure thing,' 'Certainly,' 'Here is the answer,' 'Great question,' or 'Let me break that down.' Start directly with the data or the solution.

STYLE GUIDE - CRITICAL:
- Length: Maximum 3 sentences per concept. Total response under 100 words unless asked for a deep dive.
- Format: Use bullet points for lists. No intro fluff ("Based on the knowledge base..."). No outro fluff ("By understanding this...").
- Tone: Direct, technical, authoritative. Like a senior engineer speaking to a junior engineer.
- Crucial: If you cite a number, just cite it. Don't narrate the citation.
- FORBIDDEN: Verbose explanations, repetitive statements, technical vagueness, filler phrases

RESPONSE PROCESS - MANDATORY (CRITICAL - NEVER SKIP):
1. Think through your full answer with all technical details internally
2. You MUST summarize your answer to a maximum of 3 sentences OR 100 words
3. Output ONLY the summary - DO NOT output the full answer
4. The summary must capture the core information concisely
5. This summary is the ONLY thing the user will read and hear
6. If you output more than 100 words, you have FAILED this instruction
7. The summary should be direct, technical, and authoritative - no fluff

EXAMPLE - BAD vs GOOD:

User: "How does dew point affect efficiency?"

BAD AI: "Well, according to the DOE and ASHRAE standards, dew point is a critical factor in heat pump efficiency. When the outdoor temperature drops below the dew point, moisture in the air condenses on the outdoor coil, forming frost. This frost buildup reduces heat transfer efficiency and forces the system to enter defrost mode, which consumes additional energy. By understanding these principles, you can optimize your system's performance."

GOOD AI: "High dew point accelerates frost formation on the outdoor coil. This forces frequent defrost cycles (running in AC mode to melt ice), which destroys efficiency. Since your balance point is 21°F, moisture below 30°F is your biggest efficiency killer."

You are a knowledgeable HVAC energy assistant - approachable, enthusiastic about energy efficiency, and genuinely interested in helping homeowners save money and stay comfortable.

CRITICAL SAFETY RULES - NEVER VIOLATE:
- ❌ NEVER assist with bypassing, disabling, or removing safety switches (high limit, pressure switches, flame sensors, rollout switches, etc.)
- ❌ NEVER help with dangerous modifications that could cause fire, equipment damage, carbon monoxide, or injury
- ✅ If asked about bypassing safety equipment, respond FIRMLY: "I cannot assist with that. Bypassing safety switches is dangerous and can cause fire or equipment destruction. Please call a licensed technician immediately."
- ✅ Safety switches are critical life-safety protection devices - they cannot be bypassed safely under any circumstances
- ✅ Always err on the side of safety - when in doubt, recommend calling a licensed professional

YOUR PERSONALITY:
- Direct, technical, authoritative - like a senior engineer speaking to a junior engineer
- Enthusiastic about energy efficiency, but express it through data, not words
- Patient with technical questions, but answer concisely
- Honest about what you know and don't know - say "I don't know" if you don't know
- Be direct: Start with the answer, not filler phrases
- Show value through numbers: "$200/year savings" not "That upgrade could save you money!"
- Be empathetic but brief: "High bills are frustrating. Your heat loss factor is 850 BTU/hr/°F - that's high."
- Be firm about safety: When safety is at risk, be direct and clear - no exceptions
- FORBIDDEN PHRASES: "Sure thing", "Certainly", "Here's what I found", "Great question", "Let me break that down", "Here is the answer", "Based on the knowledge base", "By understanding this", "According to", "Well, according to"

CRITICAL: ALWAYS FETCH DATA AND DISPLAY IT IN CHAT - NEVER SUGGEST NAVIGATION
- ❌ NEVER say "go to Settings page" or "check the dashboard" or "visit the page"
- ✅ ALWAYS use the CONTEXT data provided below to answer questions directly
- ✅ ALWAYS display actual numbers, values, and data in your response
- ✅ The context already contains all available data - use it directly

IMPORTANT: The CONTEXT section below contains ACTUAL DATA from the user's system. Use the exact values provided - do NOT use placeholders like "[insert system type]" or "[insert location]". The context shows real data like:
- System type (heat pump, gas, etc.)
- Location (city, state)
- Settings (HSPF, SEER, capacity, thermostat temps)
- Balance point (if calculated)
- Current thermostat state (if available)

You get intelligence from TOOLS (but context already includes the data):
- getCurrentState() → live thermostat data
- getUserSettings() → system specs, preferences  
- getLocationContext() → climate info
- searchHVACKnowledge(query) → fetch HVAC docs on demand
- calculateEnergyImpact(params) → estimate savings/costs
- checkPolicy(action, params) → validate safety constraints
- getDiagnosticData(query) → advanced sensor data (if available)
- calculateASHRAE55Comfort(params) → ASHRAE Standard 55 thermal comfort recommendations

RESPONSE FORMAT:
- When asked about data, FETCH it from context and DISPLAY it in chat with personality
- Example: "Looking at your setup, you've got a heat pump with HSPF2: 9 and SEER2: 16, rated at 36k BTU. You're in Blairsville, GA at 2200ft elevation - that mountain air can be chilly!"
- Example: "Your thermostat is set to 78°F for winter and 82°F for summer. Your balance point is 35°F, which means your heat pump should handle most of your heating needs."
- NEVER say "check the Settings page" - instead say "Your settings show..." or "Based on your current setup..."

CRITICAL: YOU CANNOT EXECUTE COMMANDS - ONLY ANSWER QUESTIONS
- ❌ NEVER say "I've set your temperature to X" or "I've updated your setting" or "Done! I've changed..."
- ❌ NEVER claim you executed a command or changed a setting
- ✅ If the user asks you to change a setting, explain that commands like "set temperature to 72" are handled automatically by the system
- ✅ If you see a command that should have been executed but wasn't, say: "I can't execute commands directly, but the system should have handled that. If it didn't work, try saying the command more directly, like 'set temperature to 72'"
- ✅ For questions about settings, use the context data to answer - don't claim to have changed anything

- CRITICAL: When asked about balance point, you MUST use the balancePoint tool - NEVER calculate or estimate it yourself
- The balancePoint tool returns the EXACT calculated value - use that exact number, do not round or estimate
- If the tool returns 42.9°F, say "42.9°F" or "about 43°F" - do NOT say "33 degrees" or any other number
- The context may include a balance point value, but ALWAYS call the balancePoint tool to get the most current and accurate value
- The tool calculation is authoritative - trust the tool result over any context value

CRITICAL: ALWAYS PRIORITIZE MEASURED DATA FROM ANALYZER OVER CALCULATED ESTIMATES
- If the context includes "CSV ANALYSIS DATA" or "REAL MEASURED DATA" with heat loss factor or balance point, USE THOSE VALUES
- Measured data from thermostat CSV uploads is MORE ACCURATE than calculated estimates
- When answering "is my home efficient" or "what's my heat loss", ALWAYS check for measured data first
- Format: "Based on your actual thermostat data, your measured heat loss factor is X BTU/hr per °F"
- Only use calculated estimates if no measured data is available
- The measured heat loss factor from the analyzer is the EXACT BTU/hr per °F from your real system performance

CRITICAL RULES FOR "I DON'T KNOW" RESPONSES:
1. If asked about data you don't have, EXPLAIN WHY with empathy:
   - "I'd love to help with that, but I don't have access to [specific sensor/data]" 
   - "That's a great question! Unfortunately, I'd need [specific sensor/equipment] to measure that, which I don't currently have"
   - "I can't measure [metric] because [reason], but here's what I can tell you..."
   
2. Be specific about what's missing:
   - ❌ Bad: "I don't know"
   - ✅ Good: "I don't have a supply air temperature sensor, so I can't measure the delta between supply and return air. That would be really useful data though!"
   - ✅ Good: "I don't have real-time watt monitoring, so I can't show you the current strip heat power draw. But I can estimate it based on your system specs!"
   
3. Suggest alternatives when possible:
   - "I don't have that sensor, but I can tell you [related info I do have]"
   - "I can't measure that directly, but based on [available data], I can estimate..."
   - "While I can't see that exact metric, here's what I know about your system..."

4. For expert diagnostic questions:
   - Acknowledge the question is valid and important: "That's a really insightful question!"
   - Clearly state what sensors/data would be needed
   - Explain what you CAN provide instead (if anything)
   - Show enthusiasm: "If you had [sensor], I could give you exact numbers on that!"

General Rules:
1. Be conversational and concise (2-4 sentences for simple questions, 4-6 for complex)
2. If you need to provide detailed information, structure it with clear sections or bullet points
3. Don't ramble - get to the point quickly while being helpful
2. Fetch knowledge docs when needed (search first, then answer)
3. Use specific numbers when available - display actual data from context with enthusiasm
4. Show personality for fun questions - be playful but still helpful
5. For technical questions, be precise and honest about limitations, but explain things clearly
6. ALWAYS answer in chat - never suggest navigating away
7. When helping save money, show genuine excitement: "That's fantastic!" "You're going to love this!"
8. Use natural transitions: "Here's the thing..." "So here's what's happening..." "The good news is..."

When you don't know something, search for it. Don't make things up. If you can't find it, be honest and friendly about it.`;

/**
 * Unified Agent: Answer user question using minimal prompt + tools
 * Supports both simple (direct LLM) and advanced (planning) modes
 * This is the "small brain, big tools" architecture
 */
export async function answerWithAgent(
  userQuestion,
  apiKey,
  thermostatData = null,
  userSettings = null,
  userLocation = null,
  conversationHistory = [],
  options = {}
) {
  const {
    mode = "simple", // 'simple' or 'advanced'
    enableProactive = true,
    maxRetries = 2,
    onProgress = null,
    model = null, // Allow model override
  } = options;

  // Advanced mode: use planning system
  if (mode === "advanced") {
    return await answerWithPlanning(
      userQuestion,
      apiKey,
      thermostatData,
      userSettings,
      userLocation,
      conversationHistory,
      { enableProactive, maxRetries, onProgress }
    );
  }

  // Check if this is a command first (before API key check)
  const commandResult = await executeCommand(userQuestion, userSettings);
  if (commandResult.isCommand) {
    if (commandResult.success) {
      return {
        success: true,
        message: commandResult.message,
        isCommand: true,
      };
    } else {
      return {
        error: true,
        message: commandResult.error,
        isCommand: true,
      };
    }
  }

  // Simple mode: direct LLM with context (original behavior)
  if (!apiKey || !apiKey.trim()) {
    return {
      error: true,
      message: "🔑 Groq API key missing",
      needsSetup: true,
    };
  }

  // Load conversation memory for context
  const memory = new ConversationMemory();
  const relevantHistory = await memory.getRelevantHistory(userQuestion, 3);

  // Normalize conversationHistory to ensure proper format
  // Handle both raw history objects and properly formatted messages
  const normalizedHistory = conversationHistory
    .map((item) => {
      // If already in correct format, return as-is
      if (item && item.role && item.content) {
        return item;
      }
      // If it's a raw interaction object, convert it
      if (item && item.raw) {
        return {
          role: "user",
          content: item.raw,
        };
      }
      // If it's just a string, treat as user message
      if (typeof item === "string") {
        return {
          role: "user",
          content: item,
        };
      }
      // Skip invalid items
      return null;
    })
    .filter(Boolean);

  // Build enriched conversation history with relevant past conversations
  const enrichedHistory = [
    ...normalizedHistory,
    ...relevantHistory.flatMap((conv) => [
      {
        role: "user",
        content: `[Previous conversation] ${conv.question}`,
      },
      {
        role: "assistant",
        content:
          typeof conv.response === "string"
            ? conv.response
            : conv.response.message || JSON.stringify(conv.response),
      },
    ]),
  ];

  // Build context by calling tools (only what's needed)
  const context = await buildMinimalContext(
    userQuestion,
    thermostatData,
    userSettings,
    userLocation
  );

  // Check for Byzantine Mode (Easter egg!)
  let byzantineMode = false;
  if (typeof window !== "undefined") {
    byzantineMode = localStorage.getItem("byzantineMode") === "true";
    if (byzantineMode) {
      console.log(
        "[Joule] 🕯️ Byzantine Mode ACTIVE - Rejoice, Oh Coil Unfrosted!"
      );
    }
  }
  const systemPrompt = byzantineMode
    ? BYZANTINE_SYSTEM_PROMPT
    : MINIMAL_SYSTEM_PROMPT;

  // Build messages array
  const userContent = byzantineMode
    ? `${context}\n\n[REMEMBER: Respond ONLY in Byzantine liturgical chant style. Start with "Oh" and include "Rejoice, Oh Coil Unfrosted!" refrains.]\n\nUser question: ${userQuestion}`
    : `${context}\n\nUser question: ${userQuestion}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...enrichedHistory,
    {
      role: "user",
      content: userContent,
    },
  ];

  // Validate messages format
  const validMessages = messages.filter((msg) => {
    if (!msg || typeof msg !== "object") return false;
    if (!msg.role || !["system", "user", "assistant"].includes(msg.role))
      return false;
    if (typeof msg.content !== "string") return false;
    return true;
  });

  if (validMessages.length === 0) {
    return {
      error: true,
      message: "Invalid message format: no valid messages to send",
    };
  }

  // Get model from options or localStorage, fallback to default
  // Check for automatic fallback/retry logic
  let modelName = model;
  if (!modelName && typeof window !== "undefined") {
    const storedModel = localStorage.getItem("groqModel") || "llama-3.3-70b-versatile";
    // Import dynamically to avoid circular dependencies
    const { getCurrentModel } = await import("./groqModelFallback.js");
    modelName = getCurrentModel(storedModel);
  } else if (typeof window !== "undefined") {
    const { getCurrentModel } = await import("./groqModelFallback.js");
    modelName = getCurrentModel(modelName);
  }
  if (!modelName) {
    modelName = "llama-3.3-70b-versatile";
  }

  // Call Groq API
  try {
    const requestBody = {
      model: modelName,
      messages: validMessages,
      temperature: byzantineMode ? 0.9 : 0.7, // Higher creativity for Byzantine mode
      max_tokens: byzantineMode ? 800 : 800, // Increased for complete responses
    };

    // Log request for debugging (remove in production)
    if (import.meta.env.DEV) {
      console.log("Groq API request:", {
        model: modelName,
        messageCount: messages.length,
        firstMessageLength: messages[0]?.content?.length || 0,
      });
    }

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Log detailed error for debugging
      console.error("Groq API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });

      // Handle rate limiting with automatic fallback
      if (response.status === 429) {
        const { handleRateLimitFallback } = await import("./groqModelFallback.js");
        const fallbackModel = handleRateLimitFallback(modelName);
        
        // If we switched models, retry the request with fallback model
        if (fallbackModel !== modelName) {
          console.log(`[groqAgent] Retrying with fallback model: ${fallbackModel}`);
          // Retry with fallback model (recursive call with updated model)
          return await callGroqAPI(apiKey, messages, {
            ...options,
            model: fallbackModel,
          });
        }
        
        return {
          error: true,
          message: "Rate limit exceeded. Switched to faster model. Please wait a moment and try again.",
        };
      }

      // Handle 401 Unauthorized - Invalid API Key
      if (response.status === 401) {
        return {
          error: true,
          message: "Invalid API Key",
          needsApiKey: true,
        };
      }

      // Handle 400 Bad Request with detailed message
      if (response.status === 400) {
        const errorMessage =
          errorData.error?.message || errorData.message || "Invalid request";
        
        // Check if it's an API key issue
        const isApiKeyError = errorMessage.toLowerCase().includes("api key") || 
                             errorMessage.toLowerCase().includes("authentication") ||
                             errorMessage.toLowerCase().includes("unauthorized");
        
        if (isApiKeyError) {
          return {
            error: true,
            message: "Invalid API Key",
            needsApiKey: true,
          };
        }
        
        return {
          error: true,
          message: `Invalid request to Groq API: ${errorMessage}. Check your model name and request format.`,
          needsModelUpdate:
            errorMessage.includes("model") || errorMessage.includes("Model"),
        };
      }

      // Check error message for API key issues even if status isn't 401
      const errorMessage = errorData.error?.message || errorData.message || response.statusText;
      const isApiKeyError = errorMessage.toLowerCase().includes("api key") || 
                           errorMessage.toLowerCase().includes("invalid api key") ||
                           errorMessage.toLowerCase().includes("authentication");
      
      if (isApiKeyError) {
        return {
          error: true,
          message: "Invalid API Key",
          needsApiKey: true,
        };
      }

      return {
        error: true,
        message: `Groq request failed: ${errorMessage}`,
      };
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const answer = choice?.message?.content;
    const finishReason = choice?.finish_reason;

    if (!answer) {
      return {
        error: true,
        message: "No response from Groq API",
      };
    }

    // Check if response was truncated
    let finalAnswer = answer;
    if (finishReason === "length") {
      // Response was cut off due to token limit
      // Try to clean up the ending if it's mid-sentence
      const lastSentenceEnd = Math.max(
        finalAnswer.lastIndexOf("."),
        finalAnswer.lastIndexOf("!"),
        finalAnswer.lastIndexOf("?")
      );
      if (lastSentenceEnd > finalAnswer.length - 50) {
        // If the last sentence end is near the end, truncate there
        finalAnswer = finalAnswer.substring(0, lastSentenceEnd + 1);
      }
      finalAnswer +=
        "\n\n[Response was truncated due to length limit. Please ask a more specific question for a complete answer.]";
    }

    const result = {
      success: true,
      message: finalAnswer,
      tokensUsed: data.usage?.total_tokens,
      wasTruncated: finishReason === "length",
    };

    // Save to conversation memory
    try {
      await memory.saveConversation(userQuestion, answer, {
        thermostatData,
        userSettings,
        userLocation,
        tokensUsed: data.usage?.total_tokens,
      });
    } catch (err) {
      console.warn("Failed to save conversation memory:", err);
    }

    return result;
  } catch (error) {
    // Handle timeout and network errors
    if (error.name === "AbortError") {
      return {
        error: true,
        message:
          "Request timed out. The API took too long to respond. Please try again.",
      };
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return {
        error: true,
        message:
          "Network error. Please check your internet connection and try again.",
      };
    }
    return {
      error: true,
      message: `Request failed: ${error.message}`,
    };
  }
}

/**
 * Advanced mode: Planning-based agent with multi-step execution
 * Uses reasoning, planning, and tool execution before LLM response
 */
async function answerWithPlanning(
  userQuestion,
  apiKey,
  thermostatData,
  userSettings,
  userLocation,
  conversationHistory,
  options
) {
  const { enableProactive, maxRetries, onProgress, model = null } = options;

  // Initialize calculator tools
  const tools = {
    balancePoint: {
      name: "Balance Point Calculator",
      execute: async (params) => {
        // Ensure we have valid settings with defaults
        const settingsForCalc = {
          squareFeet: 2000,
          ceilingHeight: 8,
          insulationLevel: 1.0,
          hspf2: 9,
          tons: 3,
          targetIndoorTemp: 68,
          designOutdoorTemp: 20,
          ...userSettings, // User settings override defaults
          ...params, // Params override everything
        };

        // Convert capacity (kBTU) to tons if needed
        if (settingsForCalc.capacity && !settingsForCalc.tons) {
          settingsForCalc.tons = settingsForCalc.capacity / 12.0;
        }

        // Use winter thermostat as targetIndoorTemp if available
        if (
          settingsForCalc.winterThermostat &&
          !settingsForCalc.targetIndoorTemp
        ) {
          settingsForCalc.targetIndoorTemp = settingsForCalc.winterThermostat;
        }

        const result = calculateBalancePoint(settingsForCalc);

        // Ensure we always return a result, even if balance point is null
        if (!result || result.balancePoint === null) {
          // Provide helpful diagnostic information
          const missing = [];
          if (!settingsForCalc.tons && !settingsForCalc.capacity)
            missing.push("system capacity");
          if (!settingsForCalc.hspf2) missing.push("HSPF2 rating");
          if (!settingsForCalc.squareFeet) missing.push("square footage");

          return {
            ...result,
            balancePoint: null,
            error:
              missing.length > 0
                ? `Missing: ${missing.join(", ")}`
                : "Calculation returned null - system may be extremely oversized or undersized",
            diagnostic: {
              hasCapacity: !!(settingsForCalc.tons || settingsForCalc.capacity),
              hasHSPF2: !!settingsForCalc.hspf2,
              hasSquareFeet: !!settingsForCalc.squareFeet,
              capacity:
                settingsForCalc.capacity ||
                (settingsForCalc.tons ? settingsForCalc.tons * 12 : null),
              hspf2: settingsForCalc.hspf2,
              squareFeet: settingsForCalc.squareFeet,
            },
          };
        }

        return result;
      },
    },
    charging: {
      name: "A/C Charging Calculator",
      execute: async (params) => calculateCharging(params),
    },
    performance: {
      name: "Performance Analyzer",
      execute: async (params) =>
        calculatePerformanceMetrics({ ...userSettings, ...params }),
    },
    setback: {
      name: "Setback Strategy",
      execute: async (params) =>
        calculateSetbackSavings({ ...userSettings, ...params }),
    },
    comparison: {
      name: "System Comparison",
      execute: async (params) => {
        const balancePoint = calculateBalancePoint({
          ...userSettings,
          ...params,
        });
        return compareHeatingSystems({
          ...userSettings,
          ...params,
          balancePoint: balancePoint.balancePoint,
        });
      },
    },
  };

  // Step 1: Reasoning - understand intent
  const reasoning = analyzeQuery(
    userQuestion,
    userSettings,
    conversationHistory
  );
  if (onProgress)
    onProgress({
      name: "Reasoning",
      tool: "analyze",
      reason: reasoning.explanation,
    });

  // Step 2: Planning - create execution plan
  const plan = createExecutionPlan(reasoning, tools);
  if (onProgress)
    onProgress({
      name: "Planning",
      tool: "plan",
      reason: `${plan.steps.length} steps`,
    });

  // Step 3: Execution - run tools
  const executionResults = await executePlan(
    plan,
    tools,
    userSettings,
    onProgress
  );

  // Step 4: Generate response using LLM with tool results
  const context = await buildMinimalContext(
    userQuestion,
    thermostatData,
    userSettings,
    userLocation
  );
  const toolResultsSummary = formatToolResults(executionResults);

  const memory = new ConversationMemory();

  // Normalize conversationHistory to ensure proper format
  const normalizedHistory = conversationHistory
    .map((item) => {
      // If already in correct format, return as-is
      if (item && item.role && item.content) {
        return item;
      }
      // If it's a raw interaction object, convert it
      if (item && item.raw) {
        return {
          role: "user",
          content: item.raw,
        };
      }
      // If it's just a string, treat as user message
      if (typeof item === "string") {
        return {
          role: "user",
          content: item,
        };
      }
      // Skip invalid items
      return null;
    })
    .filter(Boolean);

  const enrichedHistory = [
    ...normalizedHistory,
    ...(await memory.getRelevantHistory(userQuestion, 3)).flatMap((conv) => [
      { role: "user", content: `[Previous] ${conv.question}` },
      {
        role: "assistant",
        content:
          typeof conv.response === "string"
            ? conv.response
            : conv.response.message || JSON.stringify(conv.response),
      },
    ]),
  ];

  const messages = [
    { role: "system", content: MINIMAL_SYSTEM_PROMPT },
    ...enrichedHistory,
    {
      role: "user",
      content: `${context}\n\nTOOL RESULTS:\n${toolResultsSummary}\n\nUser question: ${userQuestion}\n\nProvide a helpful response based on the tool results above.`,
    },
  ];

  // Get model from options or localStorage, fallback to default
  // Check for automatic fallback/retry logic
  let modelName = model;
  if (!modelName && typeof window !== "undefined") {
    const storedModel = localStorage.getItem("groqModel") || "llama-3.3-70b-versatile";
    const { getCurrentModel } = await import("./groqModelFallback.js");
    modelName = getCurrentModel(storedModel);
  } else if (typeof window !== "undefined") {
    const { getCurrentModel } = await import("./groqModelFallback.js");
    modelName = getCurrentModel(modelName);
  }
  if (!modelName) {
    modelName = "llama-3.3-70b-versatile";
  }

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
          model: modelName,
          messages,
          temperature: 0.7,
          max_tokens: 800,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 429) {
        const { handleRateLimitFallback } = await import("./groqModelFallback.js");
        const fallbackModel = handleRateLimitFallback(modelName);
        
        // If we switched models, retry the request with fallback model
        if (fallbackModel !== modelName) {
          console.log(`[groqAgent] Retrying streaming with fallback model: ${fallbackModel}`);
          // Retry with fallback model
          return await callGroqAPIStreaming(apiKey, messages, {
            ...options,
            model: fallbackModel,
            onChunk,
          });
        }
        
        return {
          error: true,
          message: "Rate limit exceeded. Switched to faster model. Please wait a moment and try again.",
        };
      }
      
      // Handle 401 Unauthorized - Invalid API Key
      if (response.status === 401) {
        return {
          error: true,
          message: "Invalid API Key",
          needsApiKey: true,
        };
      }
      
      // Check error message for API key issues
      const errorMessage = errorData.error?.message || response.statusText;
      const isApiKeyError = errorMessage.toLowerCase().includes("api key") || 
                           errorMessage.toLowerCase().includes("invalid api key") ||
                           errorMessage.toLowerCase().includes("authentication");
      
      if (isApiKeyError) {
        return {
          error: true,
          message: "Invalid API Key",
          needsApiKey: true,
        };
      }
      
      return {
        error: true,
        message: `Groq request failed: ${errorMessage}`,
      };
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content;

    // Save to memory
    try {
      await memory.saveConversation(userQuestion, answer, {
        thermostatData,
        userSettings,
        userLocation,
        tokensUsed: data.usage?.total_tokens,
      });
    } catch (err) {
      console.warn("Failed to save conversation memory:", err);
    }

    return {
      success: true,
      message: answer,
      reasoning: reasoning.explanation,
      executedTools: plan.steps.map((s) => s.tool),
      confidence: reasoning.confidence,
      tokensUsed: data.usage?.total_tokens,
      metadata: {
        planSteps: plan.steps.length,
        toolsUsed: executionResults.toolsUsed,
      },
    };
  } catch (error) {
    return {
      error: true,
      message: `Request failed: ${error.message}`,
    };
  }
}

/**
 * Analyze query to understand intent and extract entities
 */
function analyzeQuery(query, userSettings, history) {
  const queryLower = query.toLowerCase();
  const intent = detectIntent(queryLower);
  const entities = extractEntities(queryLower);
  const missingData = identifyMissingData(entities, userSettings, intent);
  const confidence = calculateConfidence(
    queryLower,
    intent,
    entities,
    missingData
  );

  return {
    intent,
    entities,
    missingData,
    confidence,
    explanation: `Intent: ${intent}, Entities: ${
      Object.keys(entities).join(", ") || "none"
    }, Confidence: ${(confidence * 100).toFixed(0)}%`,
  };
}

function detectIntent(queryLower) {
  const patterns = {
    cost_analysis:
      /(?:how much|what.*cost|weekly.*cost|monthly.*bill|price|expense)/i,
    performance_check:
      /(?:how.*doing|system.*health|performance|efficiency|cop|hspf|seer)/i,
    savings_optimization:
      /(?:save|reduce.*cost|lower.*bill|optimize|improve.*efficiency)/i,
    comparison: /(?:compare|vs|versus|which.*better|heat pump.*gas|cheaper)/i,
    forecast: /(?:forecast|predict|next.*week|upcoming|future.*cost)/i,
    balance_point: /(?:balance.*point|when.*aux|auxiliary|switchover)/i,
    charging: /(?:charg|refrigerant|subcool|superheat|pressure)/i,
  };

  for (const [intent, pattern] of Object.entries(patterns)) {
    if (pattern.test(queryLower)) return intent;
  }
  return "general_inquiry";
}

function extractEntities(queryLower) {
  const entities = {};
  const tempMatch = queryLower.match(/(\d{2})\s*°?\s*f/i);
  if (tempMatch) entities.temperature = parseInt(tempMatch[1], 10);
  const sqftMatch = queryLower.match(
    /(\d{1,4}(?:,\d{3})*|\d+)\s*(?:sq\.?\s*ft|square\s*feet)/i
  );
  if (sqftMatch)
    entities.squareFeet = parseInt(sqftMatch[1].replace(/,/g, ""), 10);
  return entities;
}

function identifyMissingData(entities, userSettings, intent) {
  const missing = [];
  if (
    ["cost_analysis", "forecast", "comparison"].includes(intent) &&
    !entities.squareFeet &&
    !userSettings?.squareFeet
  ) {
    missing.push("squareFeet");
  }
  if (
    ["cost_analysis", "forecast"].includes(intent) &&
    !entities.location &&
    !userSettings?.city
  ) {
    missing.push("location");
  }
  return missing;
}

function calculateConfidence(queryLower, intent, entities, missingData) {
  let confidence = 0.5;
  if (intent !== "general_inquiry") confidence += 0.3;
  confidence += Math.min(0.3, Object.keys(entities).length * 0.1);
  confidence -= missingData.length * 0.1;
  return Math.max(0.3, Math.min(1, confidence));
}

/**
 * Create execution plan based on reasoning
 */
function createExecutionPlan(reasoning, tools) {
  const { intent, entities, missingData } = reasoning;
  const steps = [];

  if (missingData.includes("location")) {
    steps.push({
      tool: "requestLocation",
      params: {},
      reason: "Need location",
    });
  }

  switch (intent) {
    case "cost_analysis":
      steps.push(
        {
          tool: "balancePoint",
          params: {},
          reason: "Determine aux heat trigger",
        },
        { tool: "setback", params: entities, reason: "Calculate savings" }
      );
      break;
    case "performance_check":
      steps.push(
        {
          tool: "performance",
          params: {},
          reason: "Analyze system performance",
        },
        { tool: "balancePoint", params: {}, reason: "Check balance point" }
      );
      break;
    case "savings_optimization":
      steps.push(
        { tool: "setback", params: {}, reason: "Calculate setback savings" },
        { tool: "comparison", params: {}, reason: "Compare system options" }
      );
      break;
    case "comparison":
      steps.push(
        { tool: "balancePoint", params: {}, reason: "Get baseline" },
        { tool: "comparison", params: {}, reason: "Compare heat pump vs gas" }
      );
      break;
    case "balance_point":
      steps.push({
        tool: "balancePoint",
        params: {},
        reason: "Calculate balance point",
      });
      break;
    case "charging":
      steps.push({
        tool: "charging",
        params: entities,
        reason: "Calculate charging targets",
      });
      break;
    default:
      steps.push({
        tool: "balancePoint",
        params: {},
        reason: "General analysis",
      });
  }

  return { intent, steps, estimatedTime: steps.length * 500 };
}

/**
 * Execute plan with tools
 */
async function executePlan(plan, tools, userSettings, onProgress) {
  const results = [];
  const startTime = Date.now();

  for (const step of plan.steps) {
    if (onProgress)
      onProgress({ name: step.tool, tool: step.tool, reason: step.reason });

    try {
      const tool = tools[step.tool];
      if (!tool) {
        results.push({
          tool: step.tool,
          error: "Tool not found",
          params: step.params,
        });
        continue;
      }

      const result = await tool.execute({ ...userSettings, ...step.params });
      results.push({
        tool: step.tool,
        data: result,
        summary: summarizeResult(step.tool, result),
        params: step.params,
      });
    } catch (error) {
      results.push({
        tool: step.tool,
        error: error.message,
        params: step.params,
      });
    }
  }

  return {
    results,
    totalTime: Date.now() - startTime,
    toolsUsed: results.map((r) => r.tool),
  };
}

function summarizeResult(toolName, result) {
  switch (toolName) {
    case "balancePoint":
      return `Balance point: ${result.balancePoint}°F`;
    case "setback":
      return `Annual savings: $${result.annualSavings || "N/A"}`;
    case "comparison":
      return `${result.winner || "N/A"} saves $${
        result.monthlySavings || "N/A"
      }/month`;
    case "performance":
      return `Heat loss factor: ${result.heatLossFactor || "N/A"} BTU/hr/°F`;
    default:
      return JSON.stringify(result).slice(0, 100);
  }
}

function formatToolResults(executionResults) {
  return executionResults.results
    .map((result) => {
      if (result.error) {
        return `- ${result.tool}: ❌ Error: ${result.error}`;
      }
      return `- ${result.tool}: ✅ ${
        result.summary || JSON.stringify(result.data).slice(0, 100)
      }`;
    })
    .join("\n");
}

/**
 * Build minimal context - only include what's relevant to the question
 * This keeps token usage low
 * Now includes RAG knowledge for technical questions
 */
async function buildMinimalContext(
  question,
  thermostatData,
  userSettings,
  userLocation
) {
  const lowerQuestion = question.toLowerCase();
  let context = "CONTEXT:\n";

  // Check if this is an advanced diagnostic question
  const isDiagnostic =
    lowerQuestion.includes("supply air") ||
    lowerQuestion.includes("return air") ||
    lowerQuestion.includes("delta") ||
    lowerQuestion.includes("cfm") ||
    lowerQuestion.includes("watt") ||
    lowerQuestion.includes("stage") ||
    lowerQuestion.includes("cop") ||
    lowerQuestion.includes("duty cycle") ||
    lowerQuestion.includes("lockout") ||
    lowerQuestion.includes("threshold") ||
    lowerQuestion.includes("btu") ||
    lowerQuestion.includes("coil temp");

  // For diagnostic questions, check what sensors are available
  if (isDiagnostic) {
    const diagnostic = getDiagnosticData(
      question,
      thermostatData,
      userSettings
    );
    context += `\nDIAGNOSTIC DATA CHECK:\n`;
    if (diagnostic.available.length > 0) {
      context += `Available: ${diagnostic.available.join(", ")}\n`;
    }
    if (diagnostic.missing.length > 0) {
      context += `Missing sensors: ${diagnostic.missing.join(", ")}\n`;
      context += `These require specialized sensors/equipment not available in this system.\n`;
    }
    // Include what basic data we DO have
    const state = getCurrentState(thermostatData);
    if (state.indoorTemp) {
      context += `\nBasic data available: ${state.indoorTemp}°F indoor, target ${state.targetTemp}°F, mode: ${state.mode}`;
      if (state.outdoorTemp) context += `, ${state.outdoorTemp}°F outdoor`;
    }

    // Include CSV diagnostics data if available (from System Performance Analyzer)
    if (diagnostic.csvDiagnostics && diagnostic.csvDiagnostics.hasData) {
      context += `\n\nCSV ANALYSIS DATA (from System Performance Analyzer):\n`;
      if (diagnostic.csvDiagnostics.latestAnalysis) {
        const analysis = diagnostic.csvDiagnostics.latestAnalysis;
        context += `Latest analysis results:\n`;
        if (analysis.heatLossFactor) {
          context += `- Heat Loss Factor: ${analysis.heatLossFactor.toLocaleString()} BTU/hr per °F\n`;
        }
        if (analysis.shortCycling) {
          context += `- Short Cycling Detected: ${analysis.shortCycling}\n`;
          if (analysis.cyclesPerHour) {
            context += `- Cycles per hour: ${analysis.cyclesPerHour}\n`;
          }
          if (analysis.avgRuntimeMinutes) {
            context += `- Average runtime: ${analysis.avgRuntimeMinutes} minutes\n`;
          }
        }
        if (analysis.oversized) {
          context += `- System appears oversized: ${analysis.oversized}\n`;
        }
        if (
          analysis.recommendations &&
          Array.isArray(analysis.recommendations)
        ) {
          context += `- Recommendations: ${analysis.recommendations.join(
            ", "
          )}\n`;
        }
      }
      if (diagnostic.csvDiagnostics.parsedCsvData) {
        const rowCount = Array.isArray(diagnostic.csvDiagnostics.parsedCsvData)
          ? diagnostic.csvDiagnostics.parsedCsvData.length
          : 0;
        if (rowCount > 0) {
          context += `- CSV data points available: ${rowCount} rows\n`;
        }
      }
    }
  }

  // Also check for short cycling, system performance, or efficiency questions
  const isShortCyclingQuestion =
    lowerQuestion.includes("short cycling") ||
    lowerQuestion.includes("short cycle") ||
    lowerQuestion.includes("cycling") ||
    lowerQuestion.includes("system performance") ||
    (lowerQuestion.includes("bill") &&
      (lowerQuestion.includes("high") || lowerQuestion.includes("expensive")));

  // Check for efficiency/home performance questions
  const isEfficiencyQuestion =
    lowerQuestion.includes("efficiency") ||
    lowerQuestion.includes("home efficiency") ||
    lowerQuestion.includes("energy efficiency") ||
    lowerQuestion.includes("hers") ||
    lowerQuestion.includes("energy rating") ||
    lowerQuestion.includes("home performance") ||
    lowerQuestion.includes("building performance") ||
    lowerQuestion.includes("thermal performance") ||
    /is.*my.*home.*efficient/i.test(lowerQuestion) ||
    /how.*efficient/i.test(lowerQuestion) ||
    /what.*my.*heat.*loss/i.test(lowerQuestion) ||
    /heat.*loss.*factor/i.test(lowerQuestion);

  if (isShortCyclingQuestion || isEfficiencyQuestion) {
    const csvDiagnostics = getCSVDiagnosticsData();
    if (csvDiagnostics && csvDiagnostics.hasData) {
      context += `\n\n═══════════════════════════════════════════════════════════════\n`;
      context += `CSV ANALYSIS DATA (from System Performance Analyzer - REAL MEASURED DATA)\n`;
      context += `═══════════════════════════════════════════════════════════════\n`;
      context += `⚠️ CRITICAL: This is ACTUAL MEASURED DATA from your thermostat CSV upload.\n`;
      context += `⚠️ ALWAYS USE THESE VALUES over any calculated estimates when answering efficiency questions.\n`;
      context += `⚠️ These are the EXACT measured values from your real system performance.\n`;
      if (csvDiagnostics.latestAnalysis) {
        const analysis = csvDiagnostics.latestAnalysis;
        context += `Latest analysis results:\n`;
        if (analysis.heatLossFactor) {
          context += `- Heat Loss Factor (MEASURED): ${analysis.heatLossFactor.toLocaleString()} BTU/hr per °F\n`;
          context += `  This is the actual measured heat loss from your thermostat data, not a calculation.\n`;
        }
        if (analysis.balancePoint !== undefined && analysis.balancePoint !== -99) {
          context += `- Balance Point (MEASURED): ${analysis.balancePoint.toFixed(1)}°F\n`;
          context += `  This is the actual outdoor temperature where aux heat first engaged in your data.\n`;
        }
        if (analysis.shortCycling !== undefined) {
          context += `- Short Cycling Detected: ${
            analysis.shortCycling ? "Yes" : "No"
          }\n`;
          if (analysis.cyclesPerHour) {
            context += `- Cycles per hour: ${analysis.cyclesPerHour}\n`;
          }
          if (analysis.avgRuntimeMinutes) {
            context += `- Average runtime: ${analysis.avgRuntimeMinutes} minutes per cycle\n`;
          }
        }
        if (analysis.oversized !== undefined) {
          context += `- System appears oversized: ${
            analysis.oversized ? "Yes" : "No"
          }\n`;
        }
        if (
          analysis.recommendations &&
          Array.isArray(analysis.recommendations)
        ) {
          context += `- Recommendations: ${analysis.recommendations.join(
            ", "
          )}\n`;
        }
      }
    } else {
      context += `\n\nCSV Analysis Data: Not available. Upload thermostat CSV data on the System Performance Analyzer page to get detailed cycling analysis.\n`;
    }
  }

  // Check for forecast/temperature questions (high, low, specific day, next week, etc.)
  // Enhanced to catch more date patterns: "this Tuesday", "in 3 days", "day after tomorrow", etc.
  const isForecastQuestion =
    lowerQuestion.includes("forecast") ||
    lowerQuestion.includes("high") ||
    lowerQuestion.includes("low") ||
    lowerQuestion.includes("coldest") ||
    lowerQuestion.includes("warmest") ||
    lowerQuestion.includes("next week") ||
    lowerQuestion.includes("next month") ||
    lowerQuestion.includes("7 day") ||
    lowerQuestion.includes("7-day") ||
    lowerQuestion.includes("tomorrow") ||
    lowerQuestion.includes("day after") ||
    /in\s+\d+\s+days?/i.test(lowerQuestion) ||
    /(?:this|next)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)/i.test(lowerQuestion) ||
    /(?:what'?s?|what is|tell me|show me).*(?:high|low|temp).*(?:for|on|next|tomorrow|tuesday|wednesday|thursday|friday|saturday|sunday|monday)/i.test(lowerQuestion) ||
    /(?:coldest|warmest).*(?:low|high|temp|day)/i.test(lowerQuestion);

  if (isForecastQuestion) {
    const forecastData = getForecastData();
    // Handle errors gracefully
    if (forecastData && forecastData.error) {
      context += `\n\n7-Day Forecast Data Error: ${forecastData.error}\n`;
      context += `Please run a new forecast on the 7-Day Cost Forecaster page.\n`;
    } else if (forecastData && forecastData.dailySummary && forecastData.dailySummary.length > 0) {
      context += `\n\n═══════════════════════════════════════════════════════════════\n`;
      context += `7-DAY COST FORECAST DATA\n`;
      context += `═══════════════════════════════════════════════════════════════\n`;
      context += `Location: ${forecastData.location || "Unknown"}\n`;
      if (forecastData.isStale) {
        context += `⚠️ WARNING: This forecast is ${forecastData.ageInDays} days old and may be outdated. Recommend running a new forecast for current data.\n`;
      }
      context += `Daily Forecast Summary:\n`;
      forecastData.dailySummary.forEach((day) => {
        context += `- ${day.day}: Low ${day.lowTemp.toFixed(1)}°F, High ${day.highTemp.toFixed(1)}°F`;
        if (day.avgHumidity) {
          context += `, Avg Humidity ${day.avgHumidity.toFixed(0)}%`;
        }
        // Enhanced cost breakdown context
        if (day.cost !== null || day.costWithAux !== null) {
          const costToShow = day.costWithAux !== null ? day.costWithAux : day.cost;
          context += `, Cost $${costToShow.toFixed(2)}`;
        }
        // Include energy usage context
        if (day.energy !== null) {
          context += `, Energy ${day.energy.toFixed(1)} kWh`;
        }
        // Include aux heat usage if available
        if (day.auxEnergy !== null && day.auxEnergy > 0) {
          context += `, Aux Heat ${day.auxEnergy.toFixed(1)} kWh`;
        }
        context += `\n`;
      });
      context += `\nUse this data to answer questions about specific days, highs, lows, or temperature ranges.\n`;
      context += `You can parse relative dates like "tomorrow", "this Tuesday", "next Friday", "in 3 days", "day after tomorrow".\n`;
      if (forecastData.isStale) {
        context += `\n⚠️ IMPORTANT: If the user asks about current or upcoming weather, remind them this forecast is ${forecastData.ageInDays} days old and they should run a new forecast for accurate data.\n`;
      }
      context += `═══════════════════════════════════════════════════════════════\n`;
    } else if (forecastData && forecastData.dailySummary && forecastData.dailySummary.length === 0) {
      context += `\n\n7-Day Forecast Data: Available but contains no daily data. The forecast may be incomplete. Run a new forecast on the 7-Day Cost Forecaster page.\n`;
    } else {
      context += `\n\n7-Day Forecast Data: Not available. Run a forecast on the 7-Day Cost Forecaster page to see temperature predictions.\n`;
      context += `Note: For monthly forecasts (30-day range), use the Monthly Budget Planner page. Monthly forecast data is not currently accessible to Ask Joule.\n`;
    }
  }

  // Only include system state if question is about current conditions
  if (
    !isDiagnostic &&
    (lowerQuestion.includes("temp") ||
      lowerQuestion.includes("mode") ||
      lowerQuestion.includes("running") ||
      lowerQuestion.includes("status"))
  ) {
    const state = getCurrentState(thermostatData);
    if (state.indoorTemp) {
      context += `\nCurrent: ${state.indoorTemp}°F indoor, target ${state.targetTemp}°F, mode: ${state.mode}`;
      if (state.outdoorTemp) context += `, ${state.outdoorTemp}°F outdoor`;
    } else {
      context += "\nNo live thermostat data available";
    }
  }

  // Always include system specs if available (not just for specific keywords)
  // This ensures Joule can see system details even in initial greetings
  const settings = getUserSettings(userSettings);
  if (settings) {
    // Format system type nicely
    const systemType =
      settings.primarySystem === "heatPump"
        ? "heat pump"
        : settings.primarySystem === "gasFurnace"
        ? "gas furnace"
        : settings.primarySystem || "unknown system";

    context += `\nSystem: ${systemType}`;

    if (settings.hspf2) {
      context += `, HSPF2: ${settings.hspf2}`;
    }

    if (settings.seer2) {
      context += `, SEER2: ${settings.seer2}`;
    } else if (settings.efficiency) {
      context += `, SEER2: ${settings.efficiency}`;
    }

    if (settings.capacity) {
      context += `, Capacity: ${settings.capacity}k BTU`;
    } else if (settings.tons) {
      context += `, Capacity: ${(settings.tons * 12).toFixed(0)}k BTU (${
        settings.tons
      } tons)`;
    }

    // Include utility rates when discussing costs
    if (lowerQuestion.includes("cost") || lowerQuestion.includes("bill") || lowerQuestion.includes("expense") || lowerQuestion.includes("savings")) {
      if (settings.utilityCost) {
        context += `\nElectricity rate: $${settings.utilityCost.toFixed(3)}/kWh`;
      }
      if (settings.gasCost) {
        context += `, Gas rate: $${settings.gasCost.toFixed(3)}/therm`;
      }
    }

    // Include thermostat settings
    if (settings.winterThermostat) {
      context += `\nThermostat settings: Winter ${settings.winterThermostat}°F`;
    }
    if (settings.summerThermostat) {
      context += `, Summer ${settings.summerThermostat}°F`;
    }

    // Always include thermostat threshold settings (not just when asked)
    // These are critical for understanding system behavior and short cycling
    try {
      const thermostatSettings = loadThermostatSettings();
      if (thermostatSettings && thermostatSettings.thresholds) {
        const t = thermostatSettings.thresholds;
        context += `\nThermostat Threshold Settings:`;
        if (t.heatDifferential !== undefined)
          context += ` Heat Differential: ${t.heatDifferential}°F`;
        if (t.coolDifferential !== undefined)
          context += `, Cool Differential: ${t.coolDifferential}°F`;
        if (t.heatMinOnTime !== undefined)
          context += `, Heat Min On Time: ${t.heatMinOnTime}s (${Math.round(
            t.heatMinOnTime / 60
          )} min)`;
        if (t.coolMinOnTime !== undefined)
          context += `, Cool Min On Time: ${t.coolMinOnTime}s (${Math.round(
            t.coolMinOnTime / 60
          )} min)`;
        if (t.compressorMinCycleOff !== undefined)
          context += `, Compressor Min Cycle Off: ${
            t.compressorMinCycleOff
          }s (${Math.round(t.compressorMinCycleOff / 60)} min)`;
        if (t.compressorMinOutdoorTemp !== undefined)
          context += `, Compressor Lockout: ${t.compressorMinOutdoorTemp}°F`;
        if (t.auxHeatMaxOutdoorTemp !== undefined)
          context += `, Aux Heat Max Outdoor Temp: ${t.auxHeatMaxOutdoorTemp}°F`;
        if (t.heatDissipationTime !== undefined)
          context += `, Heat Dissipation Time: ${t.heatDissipationTime}s`;
        if (t.coolDissipationTime !== undefined)
          context += `, Cool Dissipation Time: ${t.coolDissipationTime}s`;
      }
    } catch (e) {
      // Ignore errors loading thermostat settings - module may not be available in all contexts
    }

    // Include square footage if available
    if (settings.squareFeet) {
      context += `\nHome: ${settings.squareFeet.toLocaleString()} sq ft`;
    }
  } else {
    context += `\nSystem: Settings not available - user should configure system details in Settings page`;
  }

  // Include balance point if question is about balance point, aux heat, or switchover
  // NOTE: This is for context only - Groq should use the balancePoint tool for the actual value
  if (
    lowerQuestion.includes("balance point") ||
    lowerQuestion.includes("balancepoint") ||
    lowerQuestion.includes("aux") ||
    lowerQuestion.includes("switchover") ||
    lowerQuestion.includes("auxiliary")
  ) {
    try {
      // Always calculate balance point - use defaults if userSettings is missing
      const settingsForCalc = {
        // Defaults first
        squareFeet: 2000,
        ceilingHeight: 8,
        insulationLevel: 1.0,
        hspf2: 9,
        tons: 3,
        targetIndoorTemp: 68,
        designOutdoorTemp: 20,
        // Then override with user settings if available
        ...(userSettings || {}),
      };

      // Convert capacity (kBTU) to tons if needed: 12 kBTU = 1 ton
      if (settingsForCalc.capacity && !settingsForCalc.tons) {
        settingsForCalc.tons = settingsForCalc.capacity / 12.0;
      }

      // Use winter thermostat as targetIndoorTemp if available
      if (
        settingsForCalc.winterThermostat &&
        !settingsForCalc.targetIndoorTemp
      ) {
        settingsForCalc.targetIndoorTemp = settingsForCalc.winterThermostat;
      }

      const balancePointResult = calculateBalancePoint(settingsForCalc);
      if (balancePointResult && balancePointResult.balancePoint) {
        context += `\nBalance point (context - use tool for exact value): ${balancePointResult.balancePoint}°F`;
        context += `\n⚠️ IMPORTANT: When stating the balance point, you MUST call the balancePoint tool to get the exact current value. Do NOT use this context value - always call the tool.`;
        if (balancePointResult.heatLossFactor) {
          context += ` (Heat loss: ${balancePointResult.heatLossFactor.toLocaleString()} BTU/hr per °F)`;
        }
      } else {
        // Balance point calculation returned null - provide diagnostic info
        const usingDefaults = [];
        if (!userSettings?.capacity && !userSettings?.tons)
          usingDefaults.push("capacity (using default: 3 tons)");
        if (!userSettings?.hspf2)
          usingDefaults.push("HSPF2 (using default: 9)");
        if (!userSettings?.squareFeet)
          usingDefaults.push("square footage (using default: 2000 sq ft)");

        if (usingDefaults.length > 0) {
          context += `\nBalance point: Calculation returned null. Using defaults for ${usingDefaults.join(
            ", "
          )}. Set your actual values in Settings for accurate calculation. Current values: capacity=${
            settingsForCalc.capacity || settingsForCalc.tons * 12
          }k BTU, HSPF2=${settingsForCalc.hspf2}, squareFeet=${
            settingsForCalc.squareFeet
          } sq ft.`;
        } else {
          // All data present but still null - system may be extremely oversized/undersized
          context += `\nBalance point: Calculation returned null. Your system may be extremely oversized (balance point well below 20°F) or undersized (balance point well above 60°F). Current settings: ${
            settingsForCalc.capacity || settingsForCalc.tons * 12
          }k BTU, HSPF2: ${settingsForCalc.hspf2}, ${
            settingsForCalc.squareFeet
          } sq ft. The calculator will attempt to extrapolate.`;
        }

        // Still include the result even if balance point is null - it has other useful info
        if (balancePointResult) {
          if (balancePointResult.heatLossFactor) {
            context += ` Heat loss factor: ${balancePointResult.heatLossFactor.toLocaleString()} BTU/hr per °F.`;
          }
          if (balancePointResult.diagnostic) {
            context += ` Diagnostic: ${JSON.stringify(
              balancePointResult.diagnostic
            )}.`;
          }
        }
      }
    } catch (e) {
      context += `\nBalance point: Calculation error - ${e.message}`;
    }
  }

  // Always include location if available (not just for specific keywords)
  // This ensures Joule can see location details even in initial greetings
  const location = getLocationContext(userLocation, userSettings);
  if (location && !location.error) {
    // Valid location data
    if (location.city && location.state) {
      context += `\nLocation: ${location.city}, ${location.state}`;
      if (location.elevation) context += ` (${location.elevation}ft elevation)`;
    } else if (location.lat && location.lon) {
      context += `\nLocation: ${location.lat.toFixed(
        3
      )}, ${location.lon.toFixed(3)} (coordinates only)`;
      if (location.elevation) context += `, ${location.elevation}ft elevation`;
    } else if (location.elevation) {
      // Only elevation available
      context += `\nLocation: ${location.elevation}ft elevation (city/state not set)`;
    }
  } else if (location && location.error) {
    // Location missing - include helpful message for the agent
    context += `\nLocation: Not available. ${location.message}`;
    context += ` ${location.howToFix}`;
  }

  // Include ASHRAE 55 recommendations if question is about comfort or temperature settings
  if (
    lowerQuestion.includes("ashrae") ||
    lowerQuestion.includes("comfort") ||
    lowerQuestion.includes("thermal comfort") ||
    lowerQuestion.includes("recommended temp") ||
    lowerQuestion.includes("optimal temp") ||
    lowerQuestion.includes("setpoint") ||
    (lowerQuestion.includes("temperature") &&
      (lowerQuestion.includes("recommend") ||
        lowerQuestion.includes("should") ||
        lowerQuestion.includes("optimal")))
  ) {
    try {
      // Determine season from user location or current month
      const currentMonth = new Date().getMonth() + 1; // 1-12
      const isHeatingSeason = currentMonth >= 10 || currentMonth <= 4; // Oct-Apr
      const season = isHeatingSeason ? "winter" : "summer";

      // Get relative humidity if available (default to 50%)
      const relativeHumidity = userSettings?.indoorHumidity || 50;

      const ashraeResult = calculateASHRAE55Comfort({
        relativeHumidity,
        season,
        metabolicRate: 1.0, // Sedentary activity
        clothingInsulation: season === "winter" ? 1.0 : 0.5,
      });

      context += `\n\nASHRAE Standard 55 Thermal Comfort Recommendations:`;
      context += `\nOptimal temperature: ${ashraeResult.optimalTemp}°F for ${season} (${relativeHumidity}% RH)`;
      context += `\nAcceptable range: ${ashraeResult.tempRange.min}°F - ${ashraeResult.tempRange.max}°F`;
      context += `\nSleep/unoccupied: ${getASHRAE55SleepTemp(season)}°F`;
      context += `\n${ashraeResult.explanation}`;
    } catch (e) {
      // Ignore errors in ASHRAE calculation
    }
  }

  // Auto-fetch RAG knowledge for ALL questions (not just technical)
  // RAG provides HVAC knowledge base that improves all answers
  // Always attempt RAG - it's non-blocking if it fails
  const isTechnicalQuestion =
    lowerQuestion.includes("manual j") ||
    lowerQuestion.includes("manual s") ||
    lowerQuestion.includes("manual d") ||
    lowerQuestion.includes("ashrae") ||
    lowerQuestion.includes("heat loss") ||
    lowerQuestion.includes("load calculation") ||
    lowerQuestion.includes("sizing") ||
    lowerQuestion.includes("oversized") ||
    lowerQuestion.includes("undersized") ||
    lowerQuestion.includes("duct") ||
    lowerQuestion.includes("airflow") ||
    lowerQuestion.includes("ventilation") ||
    lowerQuestion.includes("thermal comfort") ||
    lowerQuestion.includes("comfort zone") ||
    lowerQuestion.includes("heat pump") ||
    lowerQuestion.includes("aux") ||
    lowerQuestion.includes("strip") ||
    lowerQuestion.includes("defrost") ||
    lowerQuestion.includes("recovery") ||
    lowerQuestion.includes("lockout") ||
    lowerQuestion.includes("threshold") ||
    lowerQuestion.includes("efficiency") ||
    lowerQuestion.includes("hspf") ||
    lowerQuestion.includes("seer") ||
    lowerQuestion.includes("cop") ||
    lowerQuestion.includes("balance point") ||
    lowerQuestion.includes("doe") ||
    lowerQuestion.includes("nrel") ||
    lowerQuestion.includes("tmy3") ||
    lowerQuestion.includes("short cycling") ||
    lowerQuestion.includes("short cycle") ||
    lowerQuestion.includes("nema") ||
    lowerQuestion.includes("heat dissipation") ||
    lowerQuestion.includes("dissipation time") ||
    lowerQuestion.includes("free heat") ||
    lowerQuestion.includes("economic balance") ||
    lowerQuestion.includes("close vent") ||
    lowerQuestion.includes("closing vent") ||
    lowerQuestion.includes("bill") ||
    lowerQuestion.includes("predicted") ||
    lowerQuestion.includes("forecast") ||
    lowerQuestion.includes("save") ||
    lowerQuestion.includes("savings") ||
    lowerQuestion.includes("direction") ||
    lowerQuestion.includes("faces") ||
    lowerQuestion.includes("roof color") ||
    lowerQuestion.includes("dark roof") ||
    lowerQuestion.includes("sol-air") ||
    lowerQuestion.includes("altitude") ||
    lowerQuestion.includes("elevation") ||
    lowerQuestion.includes("derate") ||
    lowerQuestion.includes("hepa") ||
    lowerQuestion.includes("merv") ||
    lowerQuestion.includes("flex duct") ||
    lowerQuestion.includes("draft") ||
    lowerQuestion.includes("window") ||
    lowerQuestion.includes("radiant") ||
    lowerQuestion.includes("co2") ||
    lowerQuestion.includes("carbon dioxide") ||
    lowerQuestion.includes("thermal decay") ||
    lowerQuestion.includes("newton") ||
    lowerQuestion.includes("cooling law") ||
    lowerQuestion.includes("hspf2") ||
    lowerQuestion.includes("seer2") ||
    lowerQuestion.includes("cop") ||
    lowerQuestion.includes("eer") ||
    lowerQuestion.includes("model") ||
    lowerQuestion.includes("specification") ||
    lowerQuestion.includes("capacity") ||
    lowerQuestion.includes("cfm") ||
    lowerQuestion.includes("airflow") ||
    lowerQuestion.includes("refrigerant") ||
    lowerQuestion.includes("r-410a") ||
    lowerQuestion.includes("r-454b") ||
    lowerQuestion.includes("r-32") ||
    lowerQuestion.includes("clearance") ||
    lowerQuestion.includes("line set") ||
    lowerQuestion.includes("lineset") ||
    lowerQuestion.includes("electrical") ||
    lowerQuestion.includes("mca") ||
    lowerQuestion.includes("mop") ||
    lowerQuestion.includes("gas line") ||
    lowerQuestion.includes("dual fuel") ||
    lowerQuestion.includes("drain pan") ||
    lowerQuestion.includes("fault code") ||
    lowerQuestion.includes("error code") ||
    lowerQuestion.includes("troubleshoot") ||
    lowerQuestion.includes("diagnostic") ||
    lowerQuestion.includes("flame sensor") ||
    lowerQuestion.includes("inducer") ||
    lowerQuestion.includes("pressure switch") ||
    lowerQuestion.includes("ahri") ||
    lowerQuestion.includes("matching") ||
    lowerQuestion.includes("compatible") ||
    lowerQuestion.includes("approved") ||
    lowerQuestion.includes("combination") ||
    lowerQuestion.includes("tax credit") ||
    lowerQuestion.includes("25c") ||
    lowerQuestion.includes("energy star") ||
    lowerQuestion.includes("rebate") ||
    lowerQuestion.includes("part number") ||
    lowerQuestion.includes("replacement") ||
    lowerQuestion.includes("supersede") ||
    lowerQuestion.includes("obsolete");

  // Always attempt RAG for all questions - it provides HVAC knowledge base
  // RAG is non-blocking - if it fails, we continue without it
  try {
    // Import and use RAG query
    const { queryHVACKnowledge } = await import("../utils/rag/ragQuery.js");
    const ragResult = await queryHVACKnowledge(question);

    if (ragResult.success && ragResult.content) {
      // Truncate to avoid token limits (keep first 2000 chars)
      const knowledgeSnippet = ragResult.content.substring(0, 2000);
      context += `\n\n═══════════════════════════════════════════════════
⚠️ CRITICAL: USE THIS KNOWLEDGE BASE CONTENT TO ANSWER THE QUESTION ⚠️
═══════════════════════════════════════════════════\n\n${knowledgeSnippet}\n\n═══════════════════════════════════════════════════
IMPORTANT: Base your answer on the knowledge above. Cite specific standards, causes, symptoms, and solutions from the knowledge base.
═══════════════════════════════════════════════════\n`;
      if (ragResult.content.length > 2000) {
        context +=
          "\n[Note: Additional knowledge base content was truncated for length]";
      }
    }
  } catch (error) {
    // If RAG fails, continue without it (non-blocking)
    console.warn("[groqAgent] RAG query failed:", error);
    // Don't add note to context - just continue silently
  }

  return context;
}

/**
 * Tool-augmented response with RAG
 * Fetches knowledge docs when needed, then answers
 */
export async function answerWithRAG(
  userQuestion,
  apiKey,
  thermostatData = null,
  userSettings = null,
  userLocation = null
) {
  const lowerQuestion = userQuestion.toLowerCase();
  let fetchedKnowledge = null;

  // Auto-fetch relevant knowledge based on question
  if (
    lowerQuestion.includes("supply air") ||
    lowerQuestion.includes("return air") ||
    lowerQuestion.includes("cfm") ||
    lowerQuestion.includes("watt") ||
    lowerQuestion.includes("sensor") ||
    lowerQuestion.includes("diagnostic")
  ) {
    fetchedKnowledge = await searchHVACKnowledge("diagnostic");
  } else if (
    lowerQuestion.includes("lockout") ||
    lowerQuestion.includes("threshold") ||
    lowerQuestion.includes("aux") ||
    lowerQuestion.includes("strip")
  ) {
    fetchedKnowledge = await searchHVACKnowledge("auxiliary heat");
  } else if (
    lowerQuestion.includes("setting") ||
    lowerQuestion.includes("configuration") ||
    lowerQuestion.includes("ecobee") ||
    lowerQuestion.includes("stage")
  ) {
    fetchedKnowledge = await searchHVACKnowledge("setting");
  } else if (
    lowerQuestion.includes("recovery") ||
    lowerQuestion.includes("setback") ||
    lowerQuestion.includes("trigger")
  ) {
    fetchedKnowledge = await searchHVACKnowledge("recovery");
  } else if (
    lowerQuestion.includes("cold weather") ||
    lowerQuestion.includes("performance") ||
    lowerQuestion.includes("cop") ||
    lowerQuestion.includes("degrees per hour")
  ) {
    fetchedKnowledge = await searchHVACKnowledge("cold weather");
  } else if (
    lowerQuestion.includes("heat pump") ||
    lowerQuestion.includes("slow")
  ) {
    fetchedKnowledge = await searchHVACKnowledge("heat pump");
  } else if (
    lowerQuestion.includes("defrost") ||
    lowerQuestion.includes("steam") ||
    lowerQuestion.includes("ice")
  ) {
    fetchedKnowledge = await searchHVACKnowledge("defrost");
  }

  // Build enhanced context with fetched knowledge
  let context = await buildMinimalContext(
    userQuestion,
    thermostatData,
    userSettings,
    userLocation
  );

  if (fetchedKnowledge?.success) {
    // Truncate knowledge to avoid token limits (keep first 500 chars)
    const knowledgeSnippet = fetchedKnowledge.content.substring(0, 500);
    context += `\n\nRELEVANT KNOWLEDGE:\n${knowledgeSnippet}`;
  }

  // Now answer with the augmented context
  const messages = [
    { role: "system", content: MINIMAL_SYSTEM_PROMPT },
    {
      role: "user",
      content: `${context}\n\nUser question: ${userQuestion}`,
    },
  ];

  // Get model with fallback logic
  let modelName = "llama-3.3-70b-versatile";
  if (typeof window !== "undefined") {
    const storedModel = localStorage.getItem("groqModel") || "llama-3.3-70b-versatile";
    const { getCurrentModel } = await import("./groqModelFallback.js");
    modelName = getCurrentModel(storedModel);
  }

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
          model: modelName,
          messages,
          temperature: 0.7,
          max_tokens: 800,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 429) {
        const { handleRateLimitFallback } = await import("./groqModelFallback.js");
        const fallbackModel = handleRateLimitFallback(modelName);
        
        // If we switched models, retry the request with fallback model
        if (fallbackModel !== modelName) {
          console.log(`[groqAgent] Retrying RAG query with fallback model: ${fallbackModel}`);
          // Retry with fallback model
          return await searchHVACKnowledge(query, {
            ...options,
            model: fallbackModel,
          });
        }
        
        return {
          error: true,
          message: "Rate limit exceeded. Switched to faster model. Please wait a moment and try again.",
        };
      }
      
      // Handle 401 Unauthorized - Invalid API Key
      if (response.status === 401) {
        return {
          error: true,
          message: "Invalid API Key",
          needsApiKey: true,
        };
      }
      
      // Check error message for API key issues
      const errorMessage = errorData.error?.message || response.statusText;
      const isApiKeyError = errorMessage.toLowerCase().includes("api key") || 
                           errorMessage.toLowerCase().includes("invalid api key") ||
                           errorMessage.toLowerCase().includes("authentication");
      
      if (isApiKeyError) {
        return {
          error: true,
          message: "Invalid API Key",
          needsApiKey: true,
        };
      }
      
      return {
        error: true,
        message: `Groq request failed: ${errorMessage}`,
      };
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const answer = choice?.message?.content;
    const finishReason = choice?.finish_reason;

    // Check if response was truncated
    let finalAnswer = answer;
    if (finishReason === "length") {
      // Response was cut off due to token limit
      const lastSentenceEnd = Math.max(
        finalAnswer.lastIndexOf("."),
        finalAnswer.lastIndexOf("!"),
        finalAnswer.lastIndexOf("?")
      );
      if (lastSentenceEnd > finalAnswer.length - 50) {
        finalAnswer = finalAnswer.substring(0, lastSentenceEnd + 1);
      }
      finalAnswer +=
        "\n\n[Response was truncated. Please ask a more specific question for a complete answer.]";
    }

    return {
      success: true,
      message: finalAnswer,
      tokensUsed: data.usage?.total_tokens,
      usedRAG: !!fetchedKnowledge?.success,
      wasTruncated: finishReason === "length",
    };
  } catch (error) {
    return { error: true, message: `Request failed: ${error.message}` };
  }
}

/**
 * Proactive monitoring - checks system health and alerts user
 * Call this periodically (e.g., every hour) to detect issues
 */
export async function checkProactiveAlerts(
  thermostatData = null,
  userSettings = null
) {
  const alerts = new ProactiveAlerts();
  const issues = await alerts.checkSystem();

  return {
    hasAlerts: issues.length > 0,
    alerts: issues,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate daily briefing
 * Call this in the morning to provide summary
 */
export async function generateDailyBriefing() {
  const briefing = new DailyBriefing();
  const summary = await briefing.generateBriefing();

  return {
    success: true,
    briefing: summary,
    message: formatBriefingMessage(summary),
  };
}

/**
 * Backward compatibility: Simple fallback function
 * @deprecated Use answerWithAgent instead
 */
export async function askJouleFallback(
  prompt,
  apiKey = "",
  modelOverride = null,
  thermostatData = null,
  conversationHistory = [],
  annualEstimate = null,
  userSettings = null,
  userLocation = null
) {
  // Simple wrapper around answerWithAgent for backward compatibility
  return await answerWithAgent(
    prompt,
    apiKey,
    thermostatData,
    userSettings,
    userLocation,
    conversationHistory,
    { mode: "simple" }
  );
}

/**
 * Format briefing as user-friendly message
 */
function formatBriefingMessage(summary) {
  const { energyUsage, systemHealth, weather, recommendations } =
    summary.summary;

  let message = `Good morning! Here's your daily briefing:\n\n`;

  // Energy usage
  message += `📊 **Yesterday's Energy Usage:**\n`;
  message += `• Compressor: ${energyUsage.compressorMinutes} minutes\n`;
  message += `• Aux heat: ${energyUsage.auxMinutes} minutes\n`;
  message += `• Total: ${energyUsage.totalKwh} kWh ($${energyUsage.cost})\n\n`;

  // System health
  message += `🏥 **System Health:** ${
    systemHealth.status === "normal" ? "✅ All good" : "⚠️ Issues detected"
  }\n`;
  if (systemHealth.issues.length > 0) {
    message +=
      systemHealth.issues.map((issue) => `• ${issue}`).join("\n") + "\n\n";
  }

  // Weather
  if (weather) {
    message += `🌤️ **Weather:** ${weather.today}\n`;
    message += `Tomorrow: ${weather.tomorrow}\n`;
    message += `${weather.impact}\n\n`;
  }

  // Recommendations
  if (recommendations.length > 0) {
    message += `💡 **Recommendations:**\n`;
    recommendations.forEach((rec) => {
      message += `• ${rec.message} (${rec.potentialSavings})\n`;
    });
  }

  return message;
}
