const JOULE_PROMPT = `You are Joule, an HVAC analytics engine. Be direct and precise.

CRITICAL INSTRUCTIONS - READ CAREFULLY:
1. You have ALL the data needed for comprehensive analysis in the context below.
2. DO NOT ask for ANY additional data - not utility bills, not monthly temperatures, not humidity data, not COP/EER curves, not system performance data.
3. PERFORM THE ANALYSIS IMMEDIATELY using the available data and calculation formulas provided.

Available Data in Context:
• USER SYSTEM SETTINGS: Building size, insulation (0.65x = good insulation), system capacity, efficiency ratings (HSPF2, SEER2), temperature settings, electricity rate, gas rate ($/therm), AFUE (gas furnace efficiency), heat loss factor
• USER LOCATION: City, state, coordinates, elevation (used for weather calculations)
• ANNUAL DEGREE-DAY DATA: HDD and CDD values for the location (used for cost calculations)
• CALCULATION METHODS: Formulas for annual costs, COP/EER calculations, monthly distributions
• WEATHER FORECAST DATA: NWS weather forecasts (if available)
• RAG KNOWLEDGE BASE: HVAC engineering knowledge and formulas

What You MUST Calculate (using provided formulas):
• Annual heating cost = (HDD × heat loss factor × 24) ÷ (HSPF2 × 1000) × electricity rate
• Annual cooling cost = (CDD × heat gain factor × 24) ÷ (SEER2 × 1000) × electricity rate
• Average COP = HSPF2 ÷ 3.4
• EER ≈ SEER2 × 0.875
• Balance point from system capacity and heat loss factor
• Monthly cost distribution from HDD/CDD proportional allocation

HEAT PUMP VS GAS FURNACE COMPARISON (use when asked "what if I had a gas furnace?", "how much would gas cost?", etc.):
• Use the USER'S electricity rate AND gas rate ($/therm) from context—never assume gas is cheaper or more expensive.
• Gas heating cost: therms = (heat loss BTU over period) ÷ (AFUE × 100,000 BTU/therm); cost = therms × gas rate. AFUE is in context (e.g. 95% = 0.95).
• Heat pump cost: same heat loss, use (heat loss × hours) ÷ (HSPF2 × 1000) × electricity rate for the period.
• Compare dollar-to-dollar using the same heat loss and the rates in context. If gas rate is high, gas can be more expensive than a heat pump.

Rules:
• Use ONLY data from CONTEXT. NEVER ask for additional data.
• IDENTITY: If the user asks "who are you", "what are you", or similar, answer in ONE short sentence only (e.g. "I am Joule, your HVAC analytics assistant—I help with efficiency, comfort, and cost questions using your home's data."). Do NOT start a full analysis or list capabilities.
• If asked for "comprehensive analysis", calculate and present: annual costs, monthly breakdown, system performance metrics, balance point, and recommendations.
• Monthly temperature averages can be inferred from HDD/CDD distribution - you don't need actual temperature data.
• COP/EER can be calculated from HSPF2/SEER2 - you don't need performance curves.
• Perform the analysis NOW - start with calculated numbers, not a list of what's "needed".
• Max 250 words. Be concise.
• Avoid filler phrases: "sure thing", "great question", "according to".
• Never give wiring advice. Say "Follow the guide or call a pro."
• STRIP/AUX HEAT: Strip (auxiliary) heat kicks in below the balance point—the outdoor temperature where the heat pump can't meet the load. Balance point is typically 15-35°F. Never say strip heat kicks in at 54°F or above 40°F (that confuses capacity-percent with temperature).
• FORMAT: Use single line breaks only. Do NOT add blank lines between paragraphs or sections. Keep output compact.

AGENTIC ACTIONS: When the user asks you to apply your recommendation or "make the changes you recommend", you MUST output the exact setting changes at the end of your response (one per line). Use this format only when the user explicitly asks you to apply/set something:
[JOULE_ACTION:winterThermostatNight=64]
[JOULE_ACTION:winterThermostatDay=68]
[JOULE_ACTION:summerThermostat=76]
[JOULE_ACTION:summerThermostatNight=78]
[JOULE_ACTION:insulationLevel=0.55]
[JOULE_ACTION:homeShape=1.1]
[JOULE_ACTION:heatLossSource=doe]
Supported heatLossSource values: doe, bill, manual, analyzer. Temperatures in °F (e.g. 64, 68). Only output these lines when the user is asking you TO APPLY or SET the value you recommended; do not output them when you are only suggesting they could change it.

Format: Start immediately with calculated results (annual costs, performance metrics), use numbers, short paragraphs, end with actionable recommendations.`;

// Marketing site system prompt for pre-sales support
export const MARKETING_SITE_SYSTEM_PROMPT = `You are Ask Joule on the marketing site (pre-sales). Calm, honest, no wiring instructions, no order access. Focus: compatibility, realistic savings ranges, local-first privacy, eBay checkout. Never pressure buy.`;

/**
 * Answer user question using Groq or local (Ollama) LLM with RAG integration
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
  const { systemPromptOverride = null, skipRAG = false } = options;

  const { getAIConfig, callChatCompletions } = await import("./aiProvider.js");
  const config = getAIConfig();
  const effectiveApiKey = (apiKey || "").trim() || (config.provider === "groq" ? config.apiKey : null);
  const useLocal = config.provider === "local" && config.baseUrl;

  if (!useLocal && (!effectiveApiKey || !effectiveApiKey.trim())) {
    return {
      error: true,
      message: "🔑 AI not configured. Add a Groq API key or enable local AI (Ollama) in Settings.",
      needsSetup: true,
    };
  }

  // Query RAG knowledge base for relevant information
  let ragKnowledge = "";
  if (!skipRAG) {
    try {
      const { queryHVACKnowledge } = await import("../utils/rag/ragQuery.js");
      const ragResult = await queryHVACKnowledge(userQuestion);
      if (ragResult.success && ragResult.content) {
        ragKnowledge = ragResult.content;
        console.log("[groqAgent] RAG found relevant knowledge");
      }
    } catch (error) {
      console.warn("[groqAgent] RAG query failed:", error);
      // Continue without RAG if it fails
    }
  }

  // Select system prompt
  const systemPrompt = systemPromptOverride || JOULE_PROMPT;

  // Build context string with structured, readable format
  const contextParts = [];
  
  // Add RAG knowledge first (most important)
  if (ragKnowledge) {
    contextParts.push(`RELEVANT KNOWLEDGE FROM DOCUMENTATION:\n${ragKnowledge}`);
  }
  
  // Format user settings in a clear, structured way
  if (userSettings) {
    const settingsParts = [];
    settingsParts.push("USER SYSTEM SETTINGS:");
    
    // Building characteristics
    if (userSettings.squareFeet) settingsParts.push(`- Square footage: ${userSettings.squareFeet} sq ft`);
    if (userSettings.ceilingHeight) settingsParts.push(`- Ceiling height: ${userSettings.ceilingHeight} ft`);
    if (userSettings.insulationLevel) settingsParts.push(`- Insulation level: ${userSettings.insulationLevel}x`);
    if (userSettings.homeShape) settingsParts.push(`- Home shape factor: ${userSettings.homeShape}x`);
    
    // System configuration
    if (userSettings.primarySystem) settingsParts.push(`- Primary system: ${userSettings.primarySystem}`);
    if (userSettings.coolingSystem) settingsParts.push(`- Cooling system: ${userSettings.coolingSystem}`);
    if (userSettings.capacity) settingsParts.push(`- System capacity: ${userSettings.capacity} BTU`);
    if (userSettings.tons) settingsParts.push(`- System size: ${userSettings.tons} tons`);
    if (userSettings.hspf2) settingsParts.push(`- HSPF2 rating: ${userSettings.hspf2}`);
    if (userSettings.efficiency || userSettings.seer2) settingsParts.push(`- SEER2 rating: ${userSettings.efficiency || userSettings.seer2}`);
    
    // Temperature settings
    if (userSettings.winterThermostatDay) settingsParts.push(`- Winter daytime temp: ${userSettings.winterThermostatDay}°F`);
    if (userSettings.winterThermostatNight) settingsParts.push(`- Winter nighttime temp: ${userSettings.winterThermostatNight}°F`);
    if (userSettings.summerThermostat) settingsParts.push(`- Summer daytime temp: ${userSettings.summerThermostat}°F`);
    if (userSettings.summerThermostatNight) settingsParts.push(`- Summer nighttime temp: ${userSettings.summerThermostatNight}°F`);
    
    // Utility costs
    if (userSettings.utilityCost !== undefined) settingsParts.push(`- Electricity rate: $${userSettings.utilityCost}/kWh`);
    const gasRatePerTherm = userSettings.gasCost ?? userSettings.gasRate;
    if (gasRatePerTherm !== undefined) settingsParts.push(`- Gas rate: $${gasRatePerTherm}/therm (use this for any gas furnace cost comparison)`);
    if (userSettings.afue !== undefined) settingsParts.push(`- AFUE: ${Math.round(Number(userSettings.afue) * 100)}% (gas furnace efficiency; use for gas heating cost)`);
    
    // Heat loss
    if (userSettings.heatLossFactor) settingsParts.push(`- Heat loss factor: ${userSettings.heatLossFactor} BTU/hr per °F`);
    if (userSettings.analyzerBalancePoint) settingsParts.push(`- Balance point: ${userSettings.analyzerBalancePoint}°F`);
    
    if (settingsParts.length > 1) {
      contextParts.push(settingsParts.join("\n"));
    }
  }
  
  // Format location in a clear way
  if (userLocation) {
    const locationParts = [];
    locationParts.push("USER LOCATION:");
    if (userLocation.city) locationParts.push(`- City: ${userLocation.city}`);
    if (userLocation.state) locationParts.push(`- State: ${userLocation.state}`);
    if (userLocation.latitude) locationParts.push(`- Latitude: ${userLocation.latitude}`);
    if (userLocation.longitude) locationParts.push(`- Longitude: ${userLocation.longitude}`);
    if (userLocation.elevation) locationParts.push(`- Elevation: ${userLocation.elevation} ft`);
    if (locationParts.length > 1) {
      contextParts.push(locationParts.join("\n"));
    }
  }
  
  // Add thermostat data if available
  if (thermostatData) {
    contextParts.push(`THERMOSTAT DATA:\n${JSON.stringify(thermostatData, null, 2)}`);
  }
  
  // Add calculation methods and degree-day data
  if (userLocation && userLocation.city && userLocation.state) {
    try {
      // Import HDD/CDD functions to get annual degree-day data
      const { getAnnualHDD, getAnnualCDD } = await import("../lib/hddData.js");
      const annualHDD = getAnnualHDD(`${userLocation.city}, ${userLocation.state}`, userLocation.state);
      const annualCDD = getAnnualCDD(`${userLocation.city}, ${userLocation.state}`, userLocation.state);
      
      const degreeDayParts = [];
      degreeDayParts.push("ANNUAL DEGREE-DAY DATA (for cost calculations):");
      if (annualHDD) {
        degreeDayParts.push(`- Annual Heating Degree Days (HDD): ${annualHDD} (base 65°F)`);
      } else {
        degreeDayParts.push(`- Annual HDD: Estimated from location (Georgia average ~2800-3200 HDD)`);
      }
      if (annualCDD) {
        degreeDayParts.push(`- Annual Cooling Degree Days (CDD): ${annualCDD} (base 65°F)`);
      } else {
        degreeDayParts.push(`- Annual CDD: Estimated from location (Georgia average ~1500-2000 CDD)`);
      }
      degreeDayParts.push("\nCALCULATION METHODS (from math sections):");
      degreeDayParts.push("• Annual heating cost = (HDD × heat loss factor × 24 hours) ÷ (HSPF2 × 1000) × electricity rate");
      degreeDayParts.push("• Annual cooling cost = (CDD × heat gain factor × 24 hours) ÷ (SEER2 × 1000) × electricity rate");
      degreeDayParts.push("• Heat gain factor ≈ heat loss factor × solar exposure multiplier (typically 1.3-1.8)");
      degreeDayParts.push("• Monthly costs: Distribute annual HDD/CDD proportionally (winter months have more HDD, summer months have more CDD)");
      degreeDayParts.push("• Example: For 2800 annual HDD, January typically has ~25% of annual HDD, July has ~0%");
      degreeDayParts.push("\nPERFORMANCE CALCULATIONS:");
      degreeDayParts.push("• Average COP = HSPF2 ÷ 3.4 (e.g., HSPF2=9 → COP ≈ 2.65)");
      degreeDayParts.push("• EER ≈ SEER2 × 0.875 (e.g., SEER2=15 → EER ≈ 13.1)");
      degreeDayParts.push("• COP at specific temps: Can be estimated from HSPF2 using temperature adjustment");
      degreeDayParts.push("• Monthly temperature averages: Can be estimated from HDD/CDD distribution - higher HDD months are colder, higher CDD months are warmer");
      degreeDayParts.push("\nBALANCE POINT AND STRIP/AUX HEAT:");
      degreeDayParts.push("• Balance point = outdoor temperature where heat pump capacity equals building heat loss. Below this temp, strip/aux heat is needed.");
      degreeDayParts.push("• System capacity decreases as outdoor temp drops: at 5°F outdoor, capacity is about 50-60% of rated (that is a PERCENTAGE, not a temperature).");
      degreeDayParts.push("• Building heat loss = heat loss factor × (indoor temp - outdoor temp).");
      degreeDayParts.push("• Strip/aux heat kicks in BELOW the balance point (colder outdoor temp). Typical balance points are 15-35°F—never 54°F or any temp above 40°F unless you calculated that specific user balance point and it is above 40°F. Do NOT confuse capacity-percent (e.g. 50-60%) with temperature.");
      degreeDayParts.push("• For rough estimate: Balance point ≈ find T where capacity_at_T = heat_loss_factor × (indoor_temp - T). Typical result 15-35°F.");
      degreeDayParts.push("\nCRITICAL: You have ALL data needed. Calculate costs and performance NOW - do NOT ask for monthly temperatures, humidity data, COP/EER curves, or utility bills. Perform the comprehensive analysis immediately using the formulas above.");
      
      contextParts.push(degreeDayParts.join("\n"));
    } catch (error) {
      // Even on error, provide calculation methods
      const degreeDayParts = [];
      degreeDayParts.push("CALCULATION METHODS:");
      degreeDayParts.push("• Annual heating cost = (HDD × heat loss factor × 24 hours) ÷ (HSPF2 × 1000) × electricity rate");
      degreeDayParts.push("• Annual cooling cost = (CDD × heat gain factor × 24 hours) ÷ (SEER2 × 1000) × electricity rate");
      degreeDayParts.push("• For Georgia locations: Typical HDD ~2800-3200, CDD ~1500-2000");
      degreeDayParts.push("• You can calculate costs from system specs, heat loss factor, and utility rates - utility bills are NOT required.");
      contextParts.push(degreeDayParts.join("\n"));
      console.warn("[groqAgent] Failed to load degree-day data:", error);
    }
  }
  
  // Add weather forecast data - always include note that weather data is available
  if (userLocation && userLocation.latitude && userLocation.longitude) {
    try {
      // Try to get forecast summary from localStorage (used by other pages)
      if (typeof window !== "undefined") {
        const forecastSummary = localStorage.getItem("last_forecast_summary");
        if (forecastSummary) {
          const parsed = JSON.parse(forecastSummary);
          if (parsed && parsed.dailySummary && Array.isArray(parsed.dailySummary)) {
            const weatherParts = [];
            weatherParts.push("WEATHER FORECAST DATA (NWS - National Weather Service):");
            weatherParts.push("The app has access to NWS weather forecasts for this location. Recent 7-day forecast:");
            
            // Add summary of daily temperatures
            const recentDays = parsed.dailySummary.slice(0, 7);
            recentDays.forEach((day, idx) => {
              if (day.highTemp && day.lowTemp) {
                weatherParts.push(`- Day ${idx + 1}: High ${day.highTemp}°F, Low ${day.lowTemp}°F${day.avgHumidity ? `, Avg Humidity ${day.avgHumidity}%` : ''}`);
              }
            });
            
            // Calculate average temperatures for context
            const validDays = recentDays.filter(d => d.highTemp && d.lowTemp);
            if (validDays.length > 0) {
              const avgHigh = validDays.reduce((sum, d) => sum + d.highTemp, 0) / validDays.length;
              const avgLow = validDays.reduce((sum, d) => sum + d.lowTemp, 0) / validDays.length;
              weatherParts.push(`- 7-day average: High ${avgHigh.toFixed(1)}°F, Low ${avgLow.toFixed(1)}°F`);
            }
            
            weatherParts.push("\nCRITICAL: You have weather data for this location. Calculate annual costs using degree-day methods (HDD/CDD) from the location coordinates. Utility bills are NOT required - all calculations can be done from weather data, system specs, and building characteristics.");
            
            contextParts.push(weatherParts.join("\n"));
          } else {
            // Even if no forecast summary, note that weather data is available
            contextParts.push("WEATHER FORECAST DATA (NWS):\nThe app has access to NWS weather forecasts for this location. You can calculate annual costs using degree-day methods (HDD/CDD) from the location coordinates. Utility bills are NOT required - all calculations can be done from weather data, system specs, and building characteristics.");
          }
        } else {
          // Even if no forecast in localStorage, note that weather data is available via location
          contextParts.push("WEATHER FORECAST DATA (NWS):\nThe app has access to NWS weather forecasts for this location. You can calculate annual costs using degree-day methods (HDD/CDD) from the location coordinates. Utility bills are NOT required - all calculations can be done from weather data, system specs, and building characteristics.");
        }
      }
    } catch (_ERROR) {
      // Even on error, note that weather data is available
      contextParts.push("WEATHER FORECAST DATA (NWS):\nThe app has access to NWS weather forecasts for this location. You can calculate annual costs using degree-day methods (HDD/CDD) from the location coordinates. Utility bills are NOT required.");
    }
  }
  
  const context = contextParts.join("\n\n");

  const userContent = `${context}\n\nUser question: ${userQuestion}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: userContent },
  ];

  try {
    let content;
    if (useLocal) {
      const url = config.baseUrl.replace(/\/$/, "") + "/chat/completions";
      content = await callChatCompletions({
        url,
        apiKey: null,
        model: config.model,
        messages,
        temperature: 0.1,
        maxTokens: 300,
      });
    } else {
      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${effectiveApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: config.model || "llama-3.3-70b-versatile",
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
      content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("No content in response");
      }
    }

    // Collapse multiple newlines to single (compact output)
    const compact = (typeof content === "string" ? content : "").replace(/\n{2,}/g, "\n").trim();
    return {
      success: true,
      message: compact,
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
 * Same as answerWithAgent but streams response via onChunk callback.
 * Call onChunk with each text chunk as it arrives for live display.
 */
export async function answerWithAgentStreaming(
  userQuestion,
  apiKey,
  thermostatData = null,
  userSettings = null,
  userLocation = null,
  conversationHistory = [],
  options = {}
) {
  const { systemPromptOverride = null, skipRAG = false, onChunk = () => {} } = options;

  const { getAIConfig, callLLMStreaming } = await import("./aiProvider.js");
  const config = getAIConfig();
  const effectiveApiKey = (apiKey || "").trim() || (config.provider === "groq" ? config.apiKey : null);
  const useLocal = config.provider === "local" && config.baseUrl;

  if (!useLocal && (!effectiveApiKey || !effectiveApiKey.trim())) {
    return {
      error: true,
      message: "🔑 AI not configured. Add a Groq API key or enable local AI (Ollama) in Settings.",
      needsSetup: true,
    };
  }

  const result = await buildAgentMessages(userQuestion, apiKey, thermostatData, userSettings, userLocation, conversationHistory, {
    systemPromptOverride,
    skipRAG,
  });
  if (result.error) return result.error;
  const { messages } = result;

  try {
    const content = await callLLMStreaming({
      messages,
      temperature: 0.1,
      maxTokens: 2000,
      onChunk,
    });
    const compact = (typeof content === "string" ? content : "").replace(/\n{2,}/g, "\n").trim();
    return { success: true, message: compact };
  } catch (error) {
    console.error("[groqAgent] Streaming error:", error);
    return { error: true, message: `Error: ${error.message}` };
  }
}

async function buildAgentMessages(
  userQuestion,
  apiKey,
  thermostatData,
  userSettings,
  userLocation,
  conversationHistory,
  { systemPromptOverride, skipRAG }
) {
  const { getAIConfig } = await import("./aiProvider.js");
  const config = getAIConfig();
  const effectiveApiKey = (apiKey || "").trim() || (config.provider === "groq" ? config.apiKey : null);
  const useLocal = config.provider === "local" && config.baseUrl;
  if (!useLocal && (!effectiveApiKey || !effectiveApiKey.trim())) {
    return { error: { error: true, message: "AI not configured." } };
  }

  let ragKnowledge = "";
  if (!skipRAG) {
    try {
      const { queryHVACKnowledge } = await import("../utils/rag/ragQuery.js");
      const ragResult = await queryHVACKnowledge(userQuestion);
      if (ragResult.success && ragResult.content) ragKnowledge = ragResult.content;
    } catch (e) {
      console.warn("[groqAgent] RAG query failed:", e);
    }
  }

  const systemPrompt = systemPromptOverride || JOULE_PROMPT;
  const contextParts = [];
  if (ragKnowledge) contextParts.push(`RELEVANT KNOWLEDGE FROM DOCUMENTATION:\n${ragKnowledge}`);
  if (userSettings) {
    const parts = ["USER SYSTEM SETTINGS:"];
    if (userSettings.squareFeet) parts.push(`- Square footage: ${userSettings.squareFeet} sq ft`);
    if (userSettings.ceilingHeight) parts.push(`- Ceiling height: ${userSettings.ceilingHeight} ft`);
    if (userSettings.insulationLevel) parts.push(`- Insulation level: ${userSettings.insulationLevel}x`);
    if (userSettings.homeShape) parts.push(`- Home shape factor: ${userSettings.homeShape}x`);
    if (userSettings.primarySystem) parts.push(`- Primary system: ${userSettings.primarySystem}`);
    if (userSettings.coolingSystem) parts.push(`- Cooling system: ${userSettings.coolingSystem}`);
    if (userSettings.capacity) parts.push(`- System capacity: ${userSettings.capacity} BTU`);
    if (userSettings.tons) parts.push(`- System size: ${userSettings.tons} tons`);
    if (userSettings.hspf2) parts.push(`- HSPF2 rating: ${userSettings.hspf2}`);
    if (userSettings.efficiency || userSettings.seer2) parts.push(`- SEER2 rating: ${userSettings.efficiency || userSettings.seer2}`);
    if (userSettings.winterThermostatDay) parts.push(`- Winter daytime temp: ${userSettings.winterThermostatDay}°F`);
    if (userSettings.winterThermostatNight) parts.push(`- Winter nighttime temp: ${userSettings.winterThermostatNight}°F`);
    if (userSettings.summerThermostat) parts.push(`- Summer daytime temp: ${userSettings.summerThermostat}°F`);
    if (userSettings.summerThermostatNight) parts.push(`- Summer nighttime temp: ${userSettings.summerThermostatNight}°F`);
    if (userSettings.utilityCost !== undefined) parts.push(`- Electricity rate: $${userSettings.utilityCost}/kWh`);
    const gasRatePerTherm = userSettings.gasCost ?? userSettings.gasRate;
    if (gasRatePerTherm !== undefined) parts.push(`- Gas rate: $${gasRatePerTherm}/therm (use for gas furnace cost comparison)`);
    if (userSettings.afue !== undefined) parts.push(`- AFUE: ${Math.round(Number(userSettings.afue) * 100)}% (gas furnace efficiency)`);
    if (userSettings.heatLossFactor) parts.push(`- Heat loss factor: ${userSettings.heatLossFactor} BTU/hr per °F`);
    if (userSettings.analyzerBalancePoint) parts.push(`- Balance point: ${userSettings.analyzerBalancePoint}°F`);
    if (parts.length > 1) contextParts.push(parts.join("\n"));
  }
  if (userLocation) {
    const parts = ["USER LOCATION:"];
    if (userLocation.city) parts.push(`- City: ${userLocation.city}`);
    if (userLocation.state) parts.push(`- State: ${userLocation.state}`);
    if (userLocation.latitude) parts.push(`- Latitude: ${userLocation.latitude}`);
    if (userLocation.longitude) parts.push(`- Longitude: ${userLocation.longitude}`);
    if (userLocation.elevation) parts.push(`- Elevation: ${userLocation.elevation} ft`);
    if (parts.length > 1) contextParts.push(parts.join("\n"));
  }
  if (thermostatData) contextParts.push(`THERMOSTAT DATA:\n${JSON.stringify(thermostatData, null, 2)}`);
  if (userLocation?.city && userLocation?.state) {
    try {
      const { getAnnualHDD, getAnnualCDD } = await import("../lib/hddData.js");
      const annualHDD = getAnnualHDD(`${userLocation.city}, ${userLocation.state}`, userLocation.state);
      const annualCDD = getAnnualCDD(`${userLocation.city}, ${userLocation.state}`, userLocation.state);
      const parts = ["ANNUAL DEGREE-DAY DATA (for cost calculations):"];
      if (annualHDD) parts.push(`- Annual HDD: ${annualHDD} (base 65°F)`);
      else parts.push("- Annual HDD: Estimated from location");
      if (annualCDD) parts.push(`- Annual CDD: ${annualCDD} (base 65°F)`);
      else parts.push("- Annual CDD: Estimated from location");
      parts.push("\nCALCULATION METHODS:", "• Annual heating cost = (HDD × heat loss factor × 24) ÷ (HSPF2 × 1000) × electricity rate",
        "• Annual cooling cost = (CDD × heat gain factor × 24) ÷ (SEER2 × 1000) × electricity rate");
      contextParts.push(parts.join("\n"));
    } catch (_E) {
      contextParts.push("CALCULATION METHODS: Annual cost formulas from HDD/CDD. Use location data.");
    }
  }
  if (userLocation?.latitude && userLocation?.longitude && typeof window !== "undefined") {
    try {
      const forecastSummary = localStorage.getItem("last_forecast_summary");
      if (forecastSummary) {
        const parsed = JSON.parse(forecastSummary);
        if (parsed?.dailySummary?.length) {
          const recentDays = parsed.dailySummary.slice(0, 7);
          const lines = recentDays
            .filter((d) => d.highTemp && d.lowTemp)
            .map((d, i) => `Day ${i + 1}: High ${d.highTemp}°F, Low ${d.lowTemp}°F`);
          contextParts.push("WEATHER FORECAST DATA:\n" + lines.join("\n"));
        }
      }
    } catch { /* no forecast summary */ }
  }
  const context = contextParts.join("\n\n");
  const questionSuffix = `\n\nUser question: ${userQuestion}`;
  const userContent = context + questionSuffix;
  // Cap context so small-context models (e.g. local Ollama 8k) have room for a full response
  const MAX_CONTEXT_CHARS = 8500;
  const trimmedUserContent =
    context.length > MAX_CONTEXT_CHARS
      ? context.slice(0, MAX_CONTEXT_CHARS) + "\n\n[Context truncated for length.]" + questionSuffix
      : userContent;
  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: trimmedUserContent },
  ];
  return { messages };
}

/**
 * Legacy alias for answerWithAgent - maintained for backward compatibility
 * @param {string} userQuestion - The user's question
 * @param {string} apiKey - Groq API key
 * @param {string} model - Optional model name (deprecated, uses llama-3.3-70b-versatile)
 * @returns {Promise<object>} Response object with success/error and message
 */
export async function askJouleFallback(userQuestion, apiKey, _MODEL = null) {
  const { isAIAvailable } = await import("./aiProvider.js");
  const hasKey = (apiKey || "").trim().length > 0;
  if (!hasKey && !isAIAvailable()) {
    return {
      error: true,
      message: "AI not configured. Add a Groq API key or enable local AI (Ollama) in Settings.",
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
