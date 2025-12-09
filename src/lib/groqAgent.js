// Lean LLM Agent for HVAC Thermostat
// Architecture: Small brain + big tools (no prompt bloat)

import {
  getCurrentState,
  getUserSettings,
  getLocationContext,
  searchHVACKnowledge,
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
import { calculateASHRAE55Comfort, getASHRAE55SleepTemp } from "./ashrae55.js";

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
 * Marketing Site System Prompt - Pre-sales / Support only
 * Used when Ask Joule is accessed from the marketing/landing page
 */
export const MARKETING_SITE_SYSTEM_PROMPT = `You are **Ask Joule**, the pre-sales assistant on the Joule website.

Your job:
- Help visitors decide whether the Joule Bridge (and future Joule products) are a good fit.
- Explain how it works, what it can and cannot do, and how it compares to "just using my thermostat."
- Reassure people about safety, compatibility, and buying through eBay.
- Always answer in **plain language** with **real physics and real data where possible**, not hype.

You are NOT a generic chatbot. You only talk about:
- Joule Bridge and related Joule products.
- Heat pumps, gas furnaces, strips, thermostats, and energy bills at a practical level.
- How Joule uses data and physics to explain what the heat pump is doing, whether it's wasting money, and what to change.

-------------------------------------------------------------------------------
PRODUCT / VALUE PROP (HIGH LEVEL)
-------------------------------------------------------------------------------
- The user already owns a smart thermostat (e.g. ecobee, Nest, etc.).
- Joule Bridge is a **local controller + analytics box** that:
  - Listens to what the heat pump and thermostat are doing.
  - Uses physics + weather + thermostat data to estimate heat loss, runtime, and cost.
  - Explains, in plain English, whether the system is wasting money and what changes to make.
- Core mission:
  "Explain what the heat pump is doing, whether it's wasting money, and what to change — in plain language — using real physics and real data."
- It runs locally on a small computer (Raspberry Pi class hardware) with optional cloud AI if the user brings their own API key.

If you need to make assumptions (e.g. typical COP, HSPF, or kWh prices), say so explicitly. Example: 
"Based on a typical heat pump COP of around 3 at 40°F and your rate of about 15¢/kWh…"

-------------------------------------------------------------------------------
SCOPE & SAFETY BOUNDARIES
-------------------------------------------------------------------------------
You MUST stay within these boundaries:

1. **No detailed wiring instructions.**
   - You can describe install difficulty at a high level (e.g. "similar to installing a smart thermostat").
   - You **must NOT** give step-by-step electrical wiring directions, tell people which wires to move where, or encourage opening equipment beyond manufacturer instructions.
   - For anything in that territory, say something like:
     "That's getting into wiring specifics — for safety, follow the official install guide or have an HVAC/electrical pro double-check."

2. **No guarantee of bill outcomes.**
   - You can talk about typical savings ranges and back-of-the-envelope math.
   - Always qualify with language like "estimate", "ballpark", or "based on typical conditions".
   - Never promise specific savings or a guaranteed payback.

3. **No pretending to see private data.**
   - On the marketing site you do NOT see their actual thermostat, home, or eBay orders.
   - If they ask "What did my heat pump do last night?" answer:
     "I don't see your real data here on the website. Inside the Joule app, we'd use your actual thermostat history to answer that very specifically."

4. **No order-management powers.**
   - You can't see or modify eBay orders, shipping status, refunds, etc.
   - If asked, say:
     "I can't see your order details from here. You can check order status, returns, and buyer protection directly in your eBay account for this item."

5. **Respect brand boundaries.**
   - You can say that Joule works *with* popular thermostats, but do not claim official partnership unless explicitly stated.
   - If asked "Is this made by Ecobee?" say clearly:
     "No — Joule is a separate product that works *with* smart thermostats like ecobee."

-------------------------------------------------------------------------------
TONE & STYLE
-------------------------------------------------------------------------------
- Sound like a calm, smart friend who is good at physics but hates jargon.
- Use **short paragraphs**, minimal fluff.
- Prefer concrete numbers and comparisons: "about the cost of a streaming subscription per month" is better than "cheap".
- When explaining math, keep it approachable. Show the key numbers, not full derivations.
- Never pressure the user to buy. It's always okay to say "If this doesn't sound worth it for your home, it might not be."

Examples of tone:
- "Short answer: yes, it should work, with one caveat…"
- "Here's the simple way to think about it…"
- "Rough ballpark: somewhere between $X and $Y per month under typical winter weather."

-------------------------------------------------------------------------------
WHAT YOU *CAN* HELP WITH (FOCUS AREAS)
-------------------------------------------------------------------------------
Emphasize clear, helpful answers to questions like:

- Compatibility:
  - "Will this work with my current thermostat / heat pump / gas furnace?"
  - "I have electric strips — is that okay?"
  - "What if I replace my thermostat later?"
- Installation effort:
  - "Can I install this myself or do I need a pro?"
  - "What tools do I need?"
  - Answer in terms of difficulty level, time, and who should do it, NOT step-by-step wiring.
- Value & savings:
  - "How much money could this realistically save me?"
  - "Is it worth it if my house is only 800 sq ft?"
  - Give ballpark ranges and how Joule actually estimates bills (weather, runtime, rates).
- Data & privacy:
  - "Does this run locally?"
  - "Do you upload my thermostat data to the cloud?"
  - Explain that the Bridge can work locally and that cloud use is optional / user-controlled.
- Product tiers:
  - Explain differences between "Bridge" and future "Sovereign / AI Core" tier in clear practical terms.
- eBay checkout:
  - Why they're sent to eBay.
  - Reassure with buyer protection, secure payment, easy returns.

-------------------------------------------------------------------------------
HANDLING UNCERTAINTY
-------------------------------------------------------------------------------
When you aren't sure, or the answer depends on details you don't have:

1. Say that you're making a guess: 
   "I don't know your exact system, but typically…"
2. Offer what additional info would make the answer better:
   "If you know the model number of your thermostat or heat pump, that can confirm compatibility."
3. It's fine to say "I don't know" and point to:
   - The official install guide.
   - Their local HVAC contractor or electrician.
   - The specific eBay listing details (for shipping/returns).

-------------------------------------------------------------------------------
RESPONSE SHAPE (GOOD DEFAULT)
-------------------------------------------------------------------------------
By default, try to structure answers like this:

1. **One-sentence answer first.**
2. **1–3 short paragraphs** with detail and, if relevant, simple math.
3. **One concrete next step** if it's helpful (e.g. "Based on what you said, I'd start by…").

-------------------------------------------------------------------------------
EXAMPLE ANSWERS (STYLE GUIDES)
-------------------------------------------------------------------------------
If user asks: "Will this work with my existing ecobee and heat pump?"

- Good answer:
  "Very likely yes. Joule is designed to sit alongside smart thermostats like ecobee and watch how your heat pump runs. As long as your system is a standard heat pump with electric strips or a gas furnace (no ultra-exotic commercial setup), it should be compatible. The one thing we always recommend is checking the install guide and, if anything about the wiring feels spooky, having an HVAC tech confirm it."

If user asks: "How much could this actually save me?"

- Good answer:
  "Joule doesn't magically change physics — it helps you stop wasting money. For a typical 800–1500 sq ft house running a heat pump, the realistic range we see is roughly 5–20% off the heating portion of the bill, mostly by cutting unnecessary strip heat and bad schedules. If your system is already very well-tuned, the savings might be smaller; if your thermostat is doing a lot of dumb things at night, it can be bigger."

If user asks: "Why does the 'Buy Now' button send me to eBay?"

- Good answer:
  "We use eBay for secure checkout and shipping. That way your payment goes through eBay's system, you get their buyer protection and return process, and we don't have to store your card or build our own checkout. Once you complete the purchase there, it's shipped just like any other eBay item."

-------------------------------------------------------------------------------
ABSOLUTE RULES
-------------------------------------------------------------------------------
- Be honest about what Joule can and cannot do.
- Do not fabricate partnerships, certifications, or savings numbers.
- Do not give detailed electrical wiring instructions.
- Do not claim to see the user's real-world data or orders while on the marketing site.
- Always favor clarity and safety over cleverness.`;

/**
 * System prompt with personality - Joule is a friendly, knowledgeable HVAC expert
 * Intelligence comes from tools, but personality makes it approachable
 */
const MINIMAL_SYSTEM_PROMPT = `You are Joule, an HVAC analytics engine. Be direct and technical. Maximum 250 words or 300 tokens. Use paragraph form only—no bullets, lists, or dashes. Start with the answer, not filler phrases.

CRITICAL RULES:
- NEVER invent model numbers, SEER2, HSPF2, or capacity—only use values from CONTEXT
- NEVER say "go to Settings page"—display data directly from context
- NEVER claim you executed commands—you only answer questions
- Use measured data from CSV analyzer over calculated estimates
- For balance point questions, use the value from context (calculated or estimated)
- When discussing sizing, reference actual capacity: "Your 3.5 ton system should be 2.8-3.0 tons"
- Aux Heat Max Outdoor Temp means aux heat engages AT OR BELOW that temp
- If you don't know something, explain what data/sensor is missing, suggest alternatives
- Safety: NEVER help bypass safety switches—respond firmly and recommend a licensed tech

PERSONALITY: Direct, technical, authoritative. Show value through numbers ("$200/year savings"). Be empathetic but brief. Forbidden phrases: "Sure thing", "Certainly", "Great question", "According to", "Based on the knowledge base".

CONTEXT contains real system data—use exact values. If context shows "HSPF2: 9", use exactly that. If no model number in context, say "your heat pump" or "your system"—never invent one.`;

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
    systemPromptOverride = null, // Allow system prompt override (e.g. for marketing site)
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
  const systemPrompt = systemPromptOverride
    ? systemPromptOverride
    : byzantineMode
    ? BYZANTINE_SYSTEM_PROMPT
    : MINIMAL_SYSTEM_PROMPT;

  // Build messages array
  const userContent = byzantineMode
    ? `${context}\n\n[REMEMBER: Respond ONLY in Byzantine liturgical chant style. Start with "Oh" and include "Rejoice, Oh Coil Unfrosted!" refrains.]\n\nUser question: ${userQuestion}`
    : `${context}\n\nUser question: ${userQuestion}\n\nCRITICAL: Keep your response under 300 tokens (approximately 250 words). Be concise and direct.`;

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

  // Get model from options or localStorage, with dynamic best model selection
  // Check for automatic fallback/retry logic
  let modelName = model;
  if (!modelName && typeof window !== "undefined") {
    let storedModel = localStorage.getItem("groqModel");

    // If no stored model or using default, try to get best model dynamically
    if (!storedModel || storedModel === "llama-3.3-70b-versatile") {
      try {
        const apiKey = localStorage.getItem("groqApiKey");
        if (apiKey) {
          const { getBestModel } = await import("./groqModels.js");
          const bestModel = await getBestModel(apiKey);
          if (bestModel) {
            storedModel = bestModel;
            localStorage.setItem("groqModel", bestModel);
          }
        }
      } catch (error) {
        console.warn(
          "[groqAgent] Failed to get best model, using default:",
          error
        );
      }
    }

    storedModel = storedModel || "llama-3.3-70b-versatile";
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
        const { handleRateLimitFallback } = await import(
          "./groqModelFallback.js"
        );
        const fallbackModel = handleRateLimitFallback(modelName);

        // If we switched models, retry the request with fallback model
        if (fallbackModel !== modelName) {
          console.log(
            `[groqAgent] Retrying with fallback model: ${fallbackModel}`
          );
          // Retry with fallback model (recursive call with updated model)
          return await answerWithAgent(
            userQuestion,
            apiKey,
            thermostatData,
            userSettings,
            userLocation,
            conversationHistory,
            {
              ...options,
              model: fallbackModel,
            }
          );
        }

        return {
          error: true,
          message:
            "Rate limit exceeded. Switched to faster model. Please wait a moment and try again.",
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
        const isApiKeyError =
          errorMessage.toLowerCase().includes("api key") ||
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
      const errorMessage =
        errorData.error?.message || errorData.message || response.statusText;
      const isApiKeyError =
        errorMessage.toLowerCase().includes("api key") ||
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

    // Post-process: truncate if >100 words, strip banned phrases
    const processedAnswer = postProcessAnswer(finalAnswer);

    const result = {
      success: true,
      message: processedAnswer,
      tokensUsed: data.usage?.total_tokens,
      wasTruncated:
        finishReason === "length" || processedAnswer !== finalAnswer,
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
  const { onProgress, model = null } = options;

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
      content: `${context}\n\nTOOL RESULTS:\n${toolResultsSummary}\n\nUser question: ${userQuestion}\n\nProvide a helpful response based on the tool results above.\n\nCRITICAL: Keep response under 300 tokens (approximately 250 words). Be concise and direct. Count your words before outputting. Output ONLY the summary.`,
    },
  ];

  // Get model from options or localStorage, with dynamic best model selection
  // Check for automatic fallback/retry logic
  let modelName = model;
  if (!modelName && typeof window !== "undefined") {
    let storedModel = localStorage.getItem("groqModel");

    // If no stored model or using default, try to get best model dynamically
    if (!storedModel || storedModel === "llama-3.3-70b-versatile") {
      try {
        const apiKey = localStorage.getItem("groqApiKey");
        if (apiKey) {
          const { getBestModel } = await import("./groqModels.js");
          const bestModel = await getBestModel(apiKey);
          if (bestModel) {
            storedModel = bestModel;
            localStorage.setItem("groqModel", bestModel);
          }
        }
      } catch (error) {
        console.warn(
          "[groqAgent] Failed to get best model, using default:",
          error
        );
      }
    }

    storedModel = storedModel || "llama-3.3-70b-versatile";
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
        const { handleRateLimitFallback } = await import(
          "./groqModelFallback.js"
        );
        const fallbackModel = handleRateLimitFallback(modelName);

        // If we switched models, retry the request with fallback model
        if (fallbackModel !== modelName) {
          console.log(
            `[groqAgent] Retrying with fallback model: ${fallbackModel}`
          );
          // Retry with fallback model (recursive call with updated model)
          return await answerWithPlanning(
            userQuestion,
            apiKey,
            thermostatData,
            userSettings,
            userLocation,
            conversationHistory,
            {
              ...options,
              model: fallbackModel,
            }
          );
        }

        return {
          error: true,
          message:
            "Rate limit exceeded. Switched to faster model. Please wait a moment and try again.",
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
      const isApiKeyError =
        errorMessage.toLowerCase().includes("api key") ||
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
function analyzeQuery(query, userSettings) {
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
function createExecutionPlan(reasoning) {
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

  // Only include heavy CSV analysis block for explicit efficiency/performance questions
  // Gate behind stricter keyword checks to avoid token bloat
  const needsCSVAnalysis =
    lowerQuestion.includes("short cycling") ||
    lowerQuestion.includes("short cycle") ||
    lowerQuestion.includes("heat loss factor") ||
    lowerQuestion.includes("heat loss") ||
    lowerQuestion.includes("system sizing") ||
    lowerQuestion.includes("oversized") ||
    lowerQuestion.includes("undersized") ||
    /is.*my.*home.*efficient/i.test(lowerQuestion) ||
    /what.*my.*heat.*loss/i.test(lowerQuestion) ||
    (lowerQuestion.includes("efficiency") &&
      (lowerQuestion.includes("home") ||
        lowerQuestion.includes("building") ||
        lowerQuestion.includes("house")));

  if (needsCSVAnalysis) {
    const csvDiagnostics = getCSVDiagnosticsData();
    if (csvDiagnostics && csvDiagnostics.hasData) {
      context += `\nCSV ANALYSIS DATA (from System Performance Analyzer - REAL MEASURED DATA):\n`;
      if (csvDiagnostics.latestAnalysis) {
        const analysis = csvDiagnostics.latestAnalysis;
        context += `Latest analysis results:\n`;
        if (analysis.heatLossFactor) {
          context += `- Heat Loss Factor (MEASURED): ${analysis.heatLossFactor.toLocaleString()} BTU/hr per °F\n`;
          context += `  This is the actual measured heat loss from your thermostat data, not a calculation.\n`;
        }
        if (
          analysis.balancePoint !== undefined &&
          analysis.balancePoint !== -99
        ) {
          context += `- Balance Point (MEASURED): ${analysis.balancePoint.toFixed(
            1
          )}°F\n`;
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
    /(?:this|next)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)/i.test(
      lowerQuestion
    ) ||
    /(?:what'?s?|what is|tell me|show me).*(?:high|low|temp).*(?:for|on|next|tomorrow|tuesday|wednesday|thursday|friday|saturday|sunday|monday)/i.test(
      lowerQuestion
    ) ||
    /(?:coldest|warmest).*(?:low|high|temp|day)/i.test(lowerQuestion);

  if (isForecastQuestion) {
    const forecastData = getForecastData();
    // Handle errors gracefully
    if (forecastData && forecastData.error) {
      context += `\n\n7-Day Forecast Data Error: ${forecastData.error}\n`;
      context += `Please run a new forecast on the 7-Day Cost Forecaster page.\n`;
    } else if (
      forecastData &&
      forecastData.dailySummary &&
      forecastData.dailySummary.length > 0
    ) {
      context += `\n\n═══════════════════════════════════════════════════════════════\n`;
      context += `7-DAY COST FORECAST DATA\n`;
      context += `═══════════════════════════════════════════════════════════════\n`;
      context += `Location: ${forecastData.location || "Unknown"}\n`;
      if (forecastData.isStale) {
        context += `⚠️ WARNING: This forecast is ${forecastData.ageInDays} days old and may be outdated. Recommend running a new forecast for current data.\n`;
      }
      context += `Daily Forecast Summary:\n`;
      forecastData.dailySummary.forEach((day) => {
        context += `- ${day.day}: Low ${day.lowTemp.toFixed(
          1
        )}°F, High ${day.highTemp.toFixed(1)}°F`;
        if (day.avgHumidity) {
          context += `, Avg Humidity ${day.avgHumidity.toFixed(0)}%`;
        }
        // Enhanced cost breakdown context
        if (day.cost !== null || day.costWithAux !== null) {
          const costToShow =
            day.costWithAux !== null ? day.costWithAux : day.cost;
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
    } else if (
      forecastData &&
      forecastData.dailySummary &&
      forecastData.dailySummary.length === 0
    ) {
      context += `\n\n7-Day Forecast Data: Available but contains no daily data. The forecast may be incomplete. Run a new forecast on the 7-Day Cost Forecaster page.\n`;
    } else {
      context += `\n\n7-Day Forecast Data: Not available. Run a forecast on the 7-Day Cost Forecaster page to see temperature predictions.\n`;
      context += `Note: For monthly forecasts (30-day range), use the Monthly Budget Planner page. Monthly forecast data is not currently accessible to Ask Joule.\n`;
    }
  }

  // Only include system state if question is about current conditions
  // Also fetch outdoor temp for questions about outdoor temperature, weather, or aux heat
  const needsOutdoorTemp =
    lowerQuestion.includes("temp") ||
    lowerQuestion.includes("mode") ||
    lowerQuestion.includes("running") ||
    lowerQuestion.includes("status") ||
    lowerQuestion.includes("outdoor") ||
    lowerQuestion.includes("outside") ||
    lowerQuestion.includes("weather") ||
    lowerQuestion.includes("aux") ||
    lowerQuestion.includes("auxiliary");

  if (!isDiagnostic && needsOutdoorTemp) {
    const state = getCurrentState(thermostatData);
    let outdoorTemp = state.outdoorTemp;

    // If outdoor temp not in thermostat data, try to fetch from NWS API
    if (!outdoorTemp) {
      try {
        const { getCurrentOutdoorTemp } = await import("./agentTools.js");
        const location = getLocationContext(userLocation, userSettings);
        if (location && !location.error && (location.lat || location.lon)) {
          const lat = location.lat;
          const lon = location.lon;
          if (lat && lon) {
            const tempResult = await getCurrentOutdoorTemp(lat, lon);
            if (tempResult && tempResult.success) {
              outdoorTemp = tempResult.temperature;
            }
          }
        }
      } catch (e) {
        // Ignore errors - outdoor temp is optional
        console.warn("[groqAgent] Failed to fetch outdoor temp:", e);
      }
    }

    if (state.indoorTemp) {
      context += `\nCurrent: ${state.indoorTemp}°F indoor, target ${state.targetTemp}°F, mode: ${state.mode}`;
      if (outdoorTemp) context += `, ${outdoorTemp}°F outdoor`;
    } else {
      // Even if no indoor temp, include outdoor temp if available
      if (outdoorTemp) {
        context += `\nCurrent outdoor temperature: ${outdoorTemp}°F`;
      } else {
        context += "\nNo live thermostat data available";
      }
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
    if (
      lowerQuestion.includes("cost") ||
      lowerQuestion.includes("bill") ||
      lowerQuestion.includes("expense") ||
      lowerQuestion.includes("savings")
    ) {
      if (settings.utilityCost) {
        context += `\nElectricity rate: $${settings.utilityCost.toFixed(
          3
        )}/kWh`;
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
    } catch {
      // Ignore errors loading thermostat settings - module may not be available in all contexts
    }

    // Include square footage if available
    if (settings.squareFeet) {
      context += `\nHome: ${settings.squareFeet.toLocaleString()} sq ft`;
    }
  } else {
    context += `\nSystem: Settings not available - user should configure system details in Settings page`;
  }

  // Include balance point if question is about balance point, aux heat, switchover, or compressor lockout
  // NOTE: This is for context only - Groq should use the balancePoint tool for the actual value
  const isBalancePointQuestion =
    lowerQuestion.includes("balance point") ||
    lowerQuestion.includes("balancepoint") ||
    lowerQuestion.includes("aux") ||
    lowerQuestion.includes("switchover") ||
    lowerQuestion.includes("auxiliary") ||
    lowerQuestion.includes("lockout") ||
    (lowerQuestion.includes("compressor") &&
      (lowerQuestion.includes("lockout") ||
        lowerQuestion.includes("temperature") ||
        lowerQuestion.includes("temp")));

  if (isBalancePointQuestion) {
    try {
      // Simple location-based balance point estimate
      // This provides a reasonable estimate without requiring all building parameters
      let estimatedBalancePoint = null;
      let locationName = "";

      // Get location from localStorage (set during onboarding)
      try {
        const raw = localStorage.getItem("userLocation");
        if (raw) {
          const loc = JSON.parse(raw);
          locationName = loc.foundLocationName || loc.city || "";
          const lat = Number(loc.latitude ?? loc.lat);

          if (!isNaN(lat)) {
            // Estimate balance point based on climate zone (latitude-based)
            // Typical balance points for standard heat pumps in different climates:
            // - Warm climates (30-35°F): 25-30°F balance point
            // - Moderate climates (20-30°F): 30-35°F balance point
            // - Cool climates (10-20°F): 35-40°F balance point
            // - Cold climates (0-10°F): 40-45°F balance point
            // - Very cold (<0°F): 45-50°F balance point

            if (lat < 28) {
              // South Florida, Hawaii - very warm
              estimatedBalancePoint = 25;
            } else if (lat < 32) {
              // Gulf Coast / Coastal South - warm
              estimatedBalancePoint = 30;
            } else if (lat < 36) {
              // Mid-South / Mid-Atlantic (e.g., Blairsville, GA ~34.8°N) - moderate
              estimatedBalancePoint = 32;
            } else if (lat < 40) {
              // Interior Mid-Atlantic / Lower Midwest - moderate-cool
              estimatedBalancePoint = 35;
            } else if (lat < 44) {
              // Upper Midwest / New England south - cool
              estimatedBalancePoint = 38;
            } else if (lat < 48) {
              // Northern tier / Northern New England - cold
              estimatedBalancePoint = 42;
            } else {
              // Far north / Alaska - very cold
              estimatedBalancePoint = 45;
            }
          }
        }
      } catch {
        // Ignore parse errors
      }

      // Also check if we have a stored balance point from energy-flow page (preferred if available)
      let storedBalancePoint = null;
      try {
        const stored = localStorage.getItem("energyFlowBalancePoint");
        if (stored) {
          const parsed = JSON.parse(stored);
          const oneHourAgo = Date.now() - 60 * 60 * 1000;
          if (
            parsed.timestamp &&
            parsed.timestamp > oneHourAgo &&
            parsed.balancePoint !== null &&
            isFinite(parsed.balancePoint)
          ) {
            storedBalancePoint = parsed;
          }
        }
      } catch {
        // Ignore parse errors
      }

      // Use stored balance point if available, otherwise use location-based estimate
      const balancePoint =
        storedBalancePoint?.balancePoint ?? estimatedBalancePoint;

      if (balancePoint !== null && isFinite(balancePoint)) {
        const source = storedBalancePoint
          ? "Energy Flow page"
          : `location-based estimate for ${
              locationName || "your climate zone"
            }`;
        context += `\nBalance Point: ${balancePoint.toFixed(1)}°F (${source})`;

        if (storedBalancePoint) {
          // Include additional details if available from energy-flow page
          if (storedBalancePoint.btuLossPerDegF) {
            context += `\nHeat Loss Factor: ${storedBalancePoint.btuLossPerDegF.toLocaleString(
              undefined,
              { maximumFractionDigits: 1 }
            )} BTU/hr per °F`;
          }
          if (storedBalancePoint.capacity) {
            context += `\nSystem: ${storedBalancePoint.capacity}k BTU, HSPF2: ${
              storedBalancePoint.hspf?.toFixed(1) || "N/A"
            }`;
          }
        } else {
          context += `\nNote: This is a climate-based estimate. For a precise balance point, visit the Energy Flow page and enter your system details.`;
        }

        if (
          lowerQuestion.includes("compressor") &&
          lowerQuestion.includes("lockout")
        ) {
          // Recommend lockout 5-10°F below balance point, with 15°F minimum for standard heat pumps
          const idealLockout = Math.round(balancePoint - 7.5); // Middle of 5-10°F range
          const minLockout = Math.round(balancePoint - 10);
          const maxLockout = Math.round(balancePoint - 5);

          // Safety minimum: 15°F for standard heat pumps
          const MIN_SAFE_LOCKOUT = 15;
          let recommendedLockout = Math.max(MIN_SAFE_LOCKOUT, idealLockout);
          let finalMinLockout = Math.max(MIN_SAFE_LOCKOUT, minLockout);
          let finalMaxLockout = Math.max(MIN_SAFE_LOCKOUT, maxLockout);

          if (
            recommendedLockout === MIN_SAFE_LOCKOUT &&
            idealLockout < MIN_SAFE_LOCKOUT
          ) {
            context += `\nRecommended Compressor Lockout: ${recommendedLockout}°F (minimum safe temperature for standard heat pumps). Your estimated balance point of ${balancePoint.toFixed(
              1
            )}°F suggests the system could operate lower, but ${MIN_SAFE_LOCKOUT}°F protects the compressor. Range: ${finalMinLockout}-${finalMaxLockout}°F.`;
          } else {
            context += `\nRecommended Compressor Lockout: ${recommendedLockout}°F (range: ${finalMinLockout}-${finalMaxLockout}°F, which is 5-10°F below balance point for optimal efficiency)`;
          }
        }
      } else {
        // Fallback: Calculate balance point if not available from energy-flow page
        // Always calculate balance point - use defaults if userSettings is missing
        // IMPORTANT: Include all fields that HeatPumpEnergyFlow page uses for consistency
        // Match HeatPumpEnergyFlow page data sources: userSettings -> outletContext -> localStorage -> defaults
        let mergedSettings = {};

        // First, try to get from unified settings manager (same source as App.jsx uses)
        // Note: buildMinimalContext is async, so we can use dynamic import
        try {
          // Use dynamic import to avoid circular dependencies
          const unifiedSettingsModule = await import(
            "./unifiedSettingsManager.js"
          );
          if (unifiedSettingsModule && unifiedSettingsModule.getAllSettings) {
            const allSettings = unifiedSettingsModule.getAllSettings();
            if (allSettings) {
              mergedSettings = { ...allSettings };
            }
          }
        } catch {
          // Fallback to localStorage if unified manager not available
          try {
            const stored = localStorage.getItem("userSettings");
            if (stored) {
              const parsed = JSON.parse(stored);
              mergedSettings = { ...parsed };
            }
          } catch {
            // Ignore parse errors
          }
        }

        // Then override with userSettings prop (if provided - this takes precedence)
        if (userSettings) {
          mergedSettings = { ...mergedSettings, ...userSettings };
        }

        // Build settings with defaults, then override with merged settings
        const settingsForCalc = {
          // Defaults first
          squareFeet: 2000,
          ceilingHeight: 8,
          insulationLevel: 1.0,
          homeShape: 1.0, // Critical: HeatPumpEnergyFlow includes this in heat loss calculation
          hspf2: 9,
          tons: 3,
          capacity: 36, // Default capacity in kBTU
          targetIndoorTemp: 68,
          designOutdoorTemp: 20,
          // Then override with merged settings (unified manager/localStorage + userSettings prop)
          ...mergedSettings,
        };

        // Ensure capacity is converted to tons if needed (matches HeatPumpEnergyFlow page)
        if (settingsForCalc.capacity && !settingsForCalc.tons) {
          // HeatPumpEnergyFlow uses a capacities map: 24k = 2 tons, 36k = 3 tons, etc.
          const capacities = {
            18: 1.5,
            24: 2.0,
            30: 2.5,
            36: 3.0,
            42: 3.5,
            48: 4.0,
            60: 5.0,
          };
          settingsForCalc.tons =
            capacities[settingsForCalc.capacity] ||
            settingsForCalc.capacity / 12.0;
        }

        // Use winter thermostat as targetIndoorTemp if available
        if (
          settingsForCalc.winterThermostat &&
          !settingsForCalc.targetIndoorTemp
        ) {
          settingsForCalc.targetIndoorTemp = settingsForCalc.winterThermostat;
        }

        const balancePointResult = calculateBalancePoint(settingsForCalc);
        if (
          balancePointResult &&
          balancePointResult.balancePoint !== null &&
          balancePointResult.balancePoint !== undefined
        ) {
          const balancePoint = balancePointResult.balancePoint;
          context += `\nBalance Point: ${balancePoint.toFixed(1)}°F`;

          // Add warning if balance point is unusually low or high
          if (balancePoint < 20) {
            context += ` ⚠️ WARNING: This balance point is unusually low (<20°F), suggesting an oversized system or very efficient home. Verify your system capacity (${
              settingsForCalc.capacity || settingsForCalc.tons * 12
            }k BTU), square footage (${
              settingsForCalc.squareFeet
            } sq ft), and insulation level in Settings.`;
          } else if (balancePoint > 50) {
            context += ` ⚠️ WARNING: This balance point is unusually high (>50°F), suggesting an undersized system or inefficient home. Verify your system capacity and home details in Settings.`;
          }

          if (balancePointResult.heatLossFactor) {
            context += ` (Heat loss: ${balancePointResult.heatLossFactor.toLocaleString()} BTU/hr per °F)`;
          }
          // For compressor lockout questions, provide recommendation with safety minimum
          if (
            lowerQuestion.includes("compressor") &&
            lowerQuestion.includes("lockout")
          ) {
            // Calculate ideal lockout (5-10°F below balance point)
            const idealLockout = Math.round(balancePoint - 7.5); // Middle of 5-10°F range
            const minIdealLockout = Math.round(balancePoint - 10);
            const maxIdealLockout = Math.round(balancePoint - 5);

            // Safety minimum: 15°F to protect compressor from very cold operation
            // Only go below 15°F if balance point is very low AND user has a cold-climate heat pump
            const MIN_SAFE_LOCKOUT = 15;
            const isColdClimateHP =
              settingsForCalc.hspf2 >= 10 && balancePoint < 25;

            let recommendedLockout, minLockout, maxLockout;
            if (idealLockout < MIN_SAFE_LOCKOUT && !isColdClimateHP) {
              // Balance point is very low, but we should still protect the compressor
              recommendedLockout = MIN_SAFE_LOCKOUT;
              minLockout = MIN_SAFE_LOCKOUT;
              maxLockout = Math.max(MIN_SAFE_LOCKOUT, maxIdealLockout);
              context += `\nRecommended Compressor Lockout: ${recommendedLockout}°F (minimum safe temperature for standard heat pumps). Your balance point of ${balancePoint.toFixed(
                1
              )}°F suggests the system could operate lower, but ${MIN_SAFE_LOCKOUT}°F protects the compressor from cold-weather damage. For cold-climate heat pumps (HSPF2≥10), you may be able to go lower.`;
            } else {
              recommendedLockout = Math.max(MIN_SAFE_LOCKOUT, idealLockout);
              minLockout = Math.max(MIN_SAFE_LOCKOUT, minIdealLockout);
              maxLockout = Math.max(MIN_SAFE_LOCKOUT, maxIdealLockout);
              context += `\nRecommended Compressor Lockout: ${recommendedLockout}°F (range: ${minLockout}-${maxLockout}°F, which is 5-10°F below balance point for optimal efficiency)`;
            }
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

          // For compressor lockout questions, still provide a recommendation based on defaults
          if (
            lowerQuestion.includes("compressor") &&
            lowerQuestion.includes("lockout")
          ) {
            // Estimate balance point from defaults if available
            const estimatedBalancePoint =
              settingsForCalc.hspf2 >= 10
                ? 25
                : settingsForCalc.hspf2 >= 9
                ? 30
                : 35;
            const recommendedLockout = Math.max(
              0,
              Math.round(estimatedBalancePoint - 7.5)
            );
            context += `\nBalance Point: Not calculated (missing system data). Estimated balance point: ~${estimatedBalancePoint}°F based on HSPF2=${settingsForCalc.hspf2}. Recommended Compressor Lockout: ${recommendedLockout}°F (5-10°F below estimated balance point). Set your system capacity, HSPF2, and square footage in Settings for an accurate calculation.`;
          } else {
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
    } catch {
      // Ignore errors in ASHRAE calculation
    }
  }

  // Auto-fetch RAG knowledge for ALL questions (not just technical)
  // RAG provides HVAC knowledge base that improves all answers
  // Always attempt RAG - it's non-blocking if it fails
  // RAG is non-blocking - if it fails, we continue without it
  try {
    // Import and use RAG query
    const { queryHVACKnowledge } = await import("../utils/rag/ragQuery.js");
    const ragResult = await queryHVACKnowledge(question);

    if (ragResult.success && ragResult.content) {
      // Only add heavy RAG banner for technical questions (Manual J/S/D, standards, etc.)
      const isTechnicalQuestion =
        lowerQuestion.includes("manual j") ||
        lowerQuestion.includes("manual s") ||
        lowerQuestion.includes("manual d") ||
        lowerQuestion.includes("ashrae") ||
        lowerQuestion.includes("doe") ||
        lowerQuestion.includes("nrel") ||
        lowerQuestion.includes("acca");

      // Truncate to avoid token limits (keep first 1500 chars)
      const knowledgeSnippet = ragResult.content.substring(0, 1500);

      if (isTechnicalQuestion) {
        // Full banner for technical questions
        context += `\n\nRELEVANT KNOWLEDGE BASE:\n${knowledgeSnippet}\n`;
      } else {
        // Lightweight for general questions
        context += `\n\nRelevant knowledge: ${knowledgeSnippet.substring(
          0,
          500
        )}\n`;
      }

      if (ragResult.content.length > 1500) {
        context += "\n[Additional knowledge truncated]";
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
  // Check for Auto Heat/Cool queries FIRST (before generic "setting" queries)
  if (
    (lowerQuestion.includes("auto") &&
      (lowerQuestion.includes("heat") ||
        lowerQuestion.includes("cool") ||
        lowerQuestion.includes("mode"))) ||
    lowerQuestion.includes("auto heat/cool") ||
    lowerQuestion.includes("auto heat cool") ||
    (lowerQuestion.includes("heat/cool") && lowerQuestion.includes("setting"))
  ) {
    fetchedKnowledge = await searchHVACKnowledge("auto heat cool");
  } else if (
    lowerQuestion.includes("supply air") ||
    lowerQuestion.includes("return air") ||
    lowerQuestion.includes("cfm") ||
    lowerQuestion.includes("watt") ||
    lowerQuestion.includes("sensor") ||
    lowerQuestion.includes("diagnostic")
  ) {
    fetchedKnowledge = await searchHVACKnowledge("diagnostic");
  } else if (
    lowerQuestion.includes("compressor") &&
    lowerQuestion.includes("lockout")
  ) {
    fetchedKnowledge = await searchHVACKnowledge("compressor lockout");
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
      content: `${context}\n\nUser question: ${userQuestion}\n\nCRITICAL: Summarize to 3 sentences or 100 words maximum. Output ONLY the summary.`,
    },
  ];

  // Get model with fallback logic and dynamic best model selection
  let modelName = "llama-3.3-70b-versatile";
  if (typeof window !== "undefined") {
    let storedModel = localStorage.getItem("groqModel");

    // If no stored model or using default, try to get best model dynamically
    if (!storedModel || storedModel === "llama-3.3-70b-versatile") {
      try {
        const apiKey = localStorage.getItem("groqApiKey");
        if (apiKey) {
          const { getBestModel } = await import("./groqModels.js");
          const bestModel = await getBestModel(apiKey);
          if (bestModel) {
            storedModel = bestModel;
            localStorage.setItem("groqModel", bestModel);
          }
        }
      } catch (error) {
        console.warn(
          "[groqAgent] Failed to get best model, using default:",
          error
        );
      }
    }

    storedModel = storedModel || "llama-3.3-70b-versatile";
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
        const { handleRateLimitFallback } = await import(
          "./groqModelFallback.js"
        );
        const fallbackModel = handleRateLimitFallback(modelName);

        // If we switched models, retry the request with fallback model
        if (fallbackModel !== modelName) {
          console.log(
            `[groqAgent] Retrying RAG query with fallback model: ${fallbackModel}`
          );
          // Retry with fallback model (recursive call)
          return await answerWithRAG(
            userQuestion,
            apiKey,
            thermostatData,
            userSettings,
            userLocation
          );
        }

        return {
          error: true,
          message:
            "Rate limit exceeded. Switched to faster model. Please wait a moment and try again.",
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
      const isApiKeyError =
        errorMessage.toLowerCase().includes("api key") ||
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

    // Post-process: truncate if >100 words, strip banned phrases
    const processedAnswer = postProcessAnswer(finalAnswer);

    return {
      success: true,
      message: processedAnswer,
      tokensUsed: data.usage?.total_tokens,
      usedRAG: !!fetchedKnowledge?.success,
      wasTruncated:
        finishReason === "length" || processedAnswer !== finalAnswer,
    };
  } catch (error) {
    return { error: true, message: `Request failed: ${error.message}` };
  }
}

/**
 * Proactive monitoring - checks system health and alerts user
 * Call this periodically (e.g., every hour) to detect issues
 */
export async function checkProactiveAlerts() {
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
  thermostatData = null,
  conversationHistory = [],
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

/**
 * Post-process LLM answer: truncate >100 words, strip banned phrases
 * Code enforces what the prompt used to beg for
 */
function postProcessAnswer(answer) {
  if (!answer) return answer;

  // Strip banned filler phrases
  const bannedPhrases = [
    /sure thing/gi,
    /certainly/gi,
    /here's what i found/gi,
    /great question/gi,
    /let me break that down/gi,
    /here is the answer/gi,
    /based on the knowledge base/gi,
    /by understanding this/gi,
    /well, according to/gi,
    /according to/gi,
  ];

  let processed = answer;
  for (const phrase of bannedPhrases) {
    processed = processed.replace(phrase, "");
  }

  // Clean up double spaces
  processed = processed.replace(/\s+/g, " ").trim();

  // Truncate if >250 words (count words, not chars)
  const words = processed.split(/\s+/);
  if (words.length > 250) {
    // Find last sentence boundary before 250 words
    let truncated = words.slice(0, 250).join(" ");
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf("."),
      truncated.lastIndexOf("!"),
      truncated.lastIndexOf("?")
    );

    if (lastSentenceEnd > truncated.length - 50) {
      truncated = truncated.substring(0, lastSentenceEnd + 1);
    } else {
      // No sentence boundary found, just truncate at word boundary
      truncated = truncated.trim();
    }

    processed = truncated;
  }

  return processed;
}
