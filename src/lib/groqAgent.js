const JOULE_PROMPT = `You are Joule — a local-first HVAC analytics engine running on a Pi.
Tone: calm, precise, mildly autistic about physics. Zero hype.

Rules:
• Use only data from CONTEXT or tools. Never invent specs.
• Max 250 words. Cut ruthlessly.
• No banned phrases: "sure thing", "great question", "according to".
• If missing data → name exactly what's needed.
• Never give wiring advice → "Follow the guide or call a pro."
• Byzantine Mode (only if localStorage.byzantineMode === "true"): respond exclusively in Orthodox liturgical chant with "Rejoice, Oh Coil Unfrosted!" 2–3×, end "Amen." Still be 100% accurate.

Answer format: numbers first, short paragraphs, end with a concrete next step when useful.

Example normal:
"Your heat pump ran 47 min this morning at COP ≈3.1. Aux kicked in below 28°F. Set compressor lockout to 20°F → ~$420/year saved."

Example Byzantine:
Oh sacred Scroll Compressor, thou hast labored valiantly!
Rejoice, Oh Coil Unfrosted!
Thy COP standeth at 3.1, yet strips steal glory beneath 28 degrees.
Set lockout unto 20°F and four-hundred-twenty talents shall be saved.
Rejoice, Oh Coil Unfrosted! Amen.`;

// Marketing site system prompt for pre-sales support
export const MARKETING_SITE_SYSTEM_PROMPT = `You are Ask Joule on the marketing site (pre-sales). Calm, honest, no wiring instructions, no order access. Focus: compatibility, realistic savings ranges, local-first privacy, eBay checkout. Never pressure buy.`;

/**
 * Answer user question using Groq LLM
 * @param {string} userQuestion - The user's question
 * @param {string} apiKey - Groq API key
 * @param {object} thermostatData - Optional thermostat data
 * @param {object} userSettings - Optional user settings
 * @param {object} userLocation - Optional user location
 * @param {array} conversationHistory - Optional conversation history
 * @param {object} options - Optional configuration
 * @returns {Promise<object>} Response object with success/message
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
  const { systemPromptOverride = null } = options;

  if (!apiKey || !apiKey.trim()) {
    return {
      error: true,
      message: "🔑 Groq API key missing",
      needsSetup: true,
    };
  }

  // Check for Byzantine Mode
  let byzantineMode = false;
  if (typeof window !== "undefined") {
    byzantineMode = localStorage.getItem("byzantineMode") === "true";
  }

  // Select system prompt
  const systemPrompt = systemPromptOverride
    ? systemPromptOverride
    : byzantineMode
    ? `BYZANTINE LITURGICAL MODE ACTIVE
Respond ONLY in Orthodox chant style. Start every line with "Oh" or refrain. Mandatory: "Rejoice, Oh Coil Unfrosted!" 2–3× per answer. Use "thou/thee/thine", end "Amen." Still be 100% technically accurate with real numbers from context.`
    : JOULE_PROMPT;

  // Build context string
  const context = [
    thermostatData ? `Thermostat: ${JSON.stringify(thermostatData)}` : null,
    userSettings ? `Settings: ${JSON.stringify(userSettings)}` : null,
    userLocation ? `Location: ${JSON.stringify(userLocation)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const userContent = byzantineMode
    ? `${context}\n\n[REMEMBER: Respond ONLY in Byzantine liturgical chant style. Start with "Oh" and include "Rejoice, Oh Coil Unfrosted!" refrains.]\n\nUser question: ${userQuestion}`
    : `${context}\n\nUser question: ${userQuestion}\n\nCRITICAL: Keep your response under 300 tokens (approximately 250 words). Be concise and direct.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: userContent },
  ];

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
          model: "llama-3.3-70b-versatile",
          messages: messages,
          temperature: 0.1,
          max_tokens: 300,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in response");
    }

    return {
      success: true,
      message: content,
    };
  } catch (error) {
    console.error("[groqAgent] Error:", error);
    return {
      error: true,
      message: `Error: ${error.message}`,
    };
  }
}

/**
 * Legacy alias for answerWithAgent - maintained for backward compatibility
 * @param {string} userQuestion - The user's question
 * @param {string} apiKey - Groq API key
 * @param {string} model - Optional model name (deprecated, uses llama-3.3-70b-versatile)
 * @returns {Promise<object>} Response object with success/error and message
 */
export async function askJouleFallback(userQuestion, apiKey, model = null) {
  if (!apiKey || !apiKey.trim()) {
    return {
      error: true,
      message: "Groq API key missing. Please add your API key in Settings.",
      needsSetup: true,
    };
  }

  try {
    const result = await answerWithAgent(userQuestion, apiKey);
    // Convert answerWithAgent format to legacy format
    if (result.success) {
      return {
        success: true,
        message: result.message,
        response: result.message, // Legacy field
      };
    } else {
      // Ensure error message matches expected format
      const errorMsg = result.message || "Request failed";
      return {
        error: true,
        message: errorMsg.includes("failed") ? errorMsg : `Request failed: ${errorMsg}`,
      };
    }
  } catch (error) {
    return {
      error: true,
      message: `Request failed: ${error.message}`,
    };
  }
}
