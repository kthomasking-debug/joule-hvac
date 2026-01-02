const JOULE_PROMPT = `You are Joule, an HVAC analytics engine. Be direct and precise.

CRITICAL INSTRUCTIONS - READ CAREFULLY:
1. You have ALL the data needed for comprehensive analysis in the context below.
2. DO NOT ask for ANY additional data - not utility bills, not monthly temperatures, not humidity data, not COP/EER curves, not system performance data.
3. PERFORM THE ANALYSIS IMMEDIATELY using the available data and calculation formulas provided.

Available Data in Context:
• USER SYSTEM SETTINGS: Building size, insulation (0.65x = good insulation), system capacity, efficiency ratings (HSPF2, SEER2), temperature settings, utility rates, heat loss factor
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

Rules:
• Use ONLY data from CONTEXT. NEVER ask for additional data.
• If asked for "comprehensive analysis", calculate and present: annual costs, monthly breakdown, system performance metrics, balance point, and recommendations.
• Monthly temperature averages can be inferred from HDD/CDD distribution - you don't need actual temperature data.
• COP/EER can be calculated from HSPF2/SEER2 - you don't need performance curves.
• Perform the analysis NOW - start with calculated numbers, not a list of what's "needed".
• Max 250 words. Be concise.
• Avoid filler phrases: "sure thing", "great question", "according to".
• Never give wiring advice. Say "Follow the guide or call a pro."

Format: Start immediately with calculated results (annual costs, performance metrics), use numbers, short paragraphs, end with actionable recommendations.`;

// Marketing site system prompt for pre-sales support
export const MARKETING_SITE_SYSTEM_PROMPT = `You are Ask Joule on the marketing site (pre-sales). Calm, honest, no wiring instructions, no order access. Focus: compatibility, realistic savings ranges, local-first privacy, eBay checkout. Never pressure buy.`;

/**
 * Answer user question using Groq LLM with RAG integration
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

  if (!apiKey || !apiKey.trim()) {
    return {
      error: true,
      message: "🔑 Groq API key missing",
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
    if (userSettings.gasRate !== undefined) settingsParts.push(`- Gas rate: $${userSettings.gasRate}/therm`);
    
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
      degreeDayParts.push("\nBALANCE POINT CALCULATION:");
      degreeDayParts.push("• Balance point is where system capacity equals building heat loss");
      degreeDayParts.push("• System capacity decreases as outdoor temp drops (typically 50-60% at 5°F vs 47°F)");
      degreeDayParts.push("• Building heat loss = heat loss factor × (indoor temp - outdoor temp)");
      degreeDayParts.push("• For rough estimate: Balance point ≈ 47°F - ((capacity at 47°F - heat loss at 47°F) / heat loss factor)");
      degreeDayParts.push("• More accurate: Find temp where capacity_at_temp = heat_loss_factor × (indoor_temp - outdoor_temp)");
      degreeDayParts.push("• Typical balance points: 15-35°F for most systems");
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
    } catch (error) {
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
