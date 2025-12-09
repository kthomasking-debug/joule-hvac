/**
 * Heat Loss Resolution System
 * Priority stack: Coast-down (measured) → Manual J (RAG) → Generic default
 */

/**
 * Query RAG system for Manual J / design heat loss from onboarding data
 * @param {Object} userSettings - User settings including onboarding data
 * @returns {Promise<{success: boolean, heatLossFactor?: number, source?: string, explanation?: string}>}
 */
export async function queryRAGForManualJHeatLoss(userSettings = {}) {
  try {
    // Import RAG query function
    const { queryHVACKnowledge } = await import("./rag/ragQuery.js");

    // Build context from onboarding data
    const onboardingContext = {
      squareFeet: userSettings.squareFeet,
      stories: userSettings.stories || 2,
      yearBuilt: userSettings.yearBuilt,
      homeType: userSettings.homeType,
      insulationLevel: userSettings.insulationLevel,
      ceilingHeight: userSettings.ceilingHeight || 8,
      homeShape: userSettings.homeShape || 1.0,
      windows: userSettings.windows || "double_pane",
      climateZone: userSettings.climateZone,
      zipCode: userSettings.zipCode,
      equipmentSize: userSettings.capacity || userSettings.tons,
      designHeatLoss: userSettings.designHeatLoss, // If user manually entered
      manualJReport: userSettings.manualJReport, // If user uploaded
    };

    // Create RAG prompt
    const ragPrompt = `You are an HVAC engineer analyzing this home's design data.

Onboarding data:
- Square footage: ${onboardingContext.squareFeet || "not specified"} sq ft
- Stories: ${onboardingContext.stories || "not specified"}
- Year built: ${onboardingContext.yearBuilt || "not specified"}
- Home type: ${onboardingContext.homeType || "not specified"}
- Insulation level: ${onboardingContext.insulationLevel || "not specified"}
- Ceiling height: ${onboardingContext.ceilingHeight || 8} ft
- Home shape: ${onboardingContext.homeShape || 1.0}
- Windows: ${onboardingContext.windows || "not specified"}
- Climate zone: ${onboardingContext.climateZone || "not specified"}
- Equipment size: ${onboardingContext.equipmentSize || "not specified"}
${
  onboardingContext.designHeatLoss
    ? `- Design heat loss (user provided): ${onboardingContext.designHeatLoss} BTU/hr`
    : ""
}
${onboardingContext.manualJReport ? `- Manual J report available: Yes` : ""}

From this context, find the best estimate of this home's HEATING DESIGN HEAT LOSS.

Return:
- design_heat_loss_btu_per_hr: number (BTU/hr at design winter conditions, typically 70°F delta-T)
- design_delta_t_f: number (°F difference used, typically 70°F)
- btu_per_hr_per_f: number (design_heat_loss_btu_per_hr / design_delta_t_f)
- source: "manual_j_report" | "contractor_note" | "inferred_from_equipment" | "calculated_from_onboarding" | "none"
- explanation: 1–2 sentences in plain language.

Only answer if you're confident within ±25%. If not, set source="none".`;

    // Query RAG
    const ragResult = await queryHVACKnowledge(ragPrompt);

    if (!ragResult.success || !ragResult.content) {
      return {
        success: false,
        source: "none",
        explanation: "Could not extract design heat loss from onboarding data.",
      };
    }

    // Parse RAG response for heat loss values
    // The RAG should return structured data, but we'll also try to extract from text
    const content = ragResult.content.toLowerCase();

    // Try to extract numbers from response
    const btuPerHrPerFMatch =
      content.match(/btu.*per.*hr.*per.*[°f|f].*?(\d+(?:\.\d+)?)/i) ||
      content.match(/btu\/hr\/°f.*?(\d+(?:\.\d+)?)/i) ||
      content.match(/(\d+(?:\.\d+)?).*btu.*per.*hr.*per.*[°f|f]/i);

    const designHeatLossMatch =
      content.match(/design.*heat.*loss.*?(\d+(?:,\d+)?(?:\d+)?)/i) ||
      content.match(/(\d+(?:,\d+)?(?:\d+)?).*btu.*hr.*design/i);

    // Determine source
    let source = "calculated_from_onboarding";
    if (content.includes("manual j") || content.includes("manualj")) {
      source = "manual_j_report";
    } else if (
      content.includes("contractor") ||
      content.includes("design report")
    ) {
      source = "contractor_note";
    } else if (content.includes("equipment") || content.includes("sizing")) {
      source = "inferred_from_equipment";
    }

    // If we found a value, use it
    if (btuPerHrPerFMatch) {
      const heatLossFactor = parseFloat(btuPerHrPerFMatch[1].replace(/,/g, ""));
      if (heatLossFactor > 0 && heatLossFactor < 5000) {
        // Sanity check
        return {
          success: true,
          heatLossFactor: heatLossFactor,
          source: source,
          explanation: ragResult.content.substring(0, 200) + "...",
        };
      }
    }

    // Fallback: Use Manual J calculator if we have enough data
    if (onboardingContext.squareFeet && onboardingContext.homeType) {
      const { getManualJHeatLossFactor } = await import("./manualJHeatLoss.js");
      const manualJFactor = getManualJHeatLossFactor({
        squareFeet: onboardingContext.squareFeet,
        homeType: onboardingContext.homeType,
        ceilingHeight: onboardingContext.ceilingHeight,
        homeShape: onboardingContext.homeShape,
      });

      return {
        success: true,
        heatLossFactor: manualJFactor,
        source: "calculated_from_onboarding",
        explanation: `Calculated from Manual J methodology using your home size (${onboardingContext.squareFeet} sq ft) and construction type.`,
      };
    }

    return {
      success: false,
      source: "none",
      explanation:
        "Insufficient onboarding data to calculate design heat loss.",
    };
  } catch (error) {
    console.error(
      "[heatLossResolution] Error querying RAG for Manual J:",
      error
    );
    return {
      success: false,
      source: "none",
      explanation: "Error extracting design heat loss data.",
    };
  }
}

/**
 * Choose heat loss factor based on priority stack
 * @param {Object} options
 * @param {Object} options.analyzer - Analyzer results with heatLossFactor
 * @param {Object} options.ragManualJ - RAG/Manual J results
 * @param {Object} options.fallback - Fallback generic calculation
 * @returns {{source: string, value: number, explanation?: string}}
 */
export function chooseHeatLossFactor({ analyzer, ragManualJ, fallback }) {
  // Priority 1: Analyzer (coast-down measured)
  if (
    analyzer?.heatLossFactor &&
    typeof analyzer.heatLossFactor === "number" &&
    analyzer.heatLossFactor > 0 &&
    analyzer.heatLossFactor < 5000
  ) {
    return {
      source: "measured",
      value: analyzer.heatLossFactor,
      explanation: "Measured from thermostat data using coast-down method.",
    };
  }

  // Priority 2: Design / Manual J from RAG
  if (
    ragManualJ?.heatLossFactor &&
    typeof ragManualJ.heatLossFactor === "number" &&
    ragManualJ.heatLossFactor > 0 &&
    ragManualJ.heatLossFactor < 5000
  ) {
    return {
      source: "design",
      value: ragManualJ.heatLossFactor,
      explanation:
        ragManualJ.explanation ||
        "Estimated from design data and Manual J methodology.",
      ragSource: ragManualJ.source,
    };
  }

  // Priority 3: Generic default (quiet fallback)
  return {
    source: "default",
    value: fallback?.heatLossFactor || 400, // Conservative default
    explanation: "Using typical value based on square footage and home type.",
  };
}

/**
 * Get heat loss factor with full resolution stack
 * @param {Object} options
 * @param {Object} options.userSettings - User settings
 * @param {Object} options.analyzerResults - Analyzer results (if available)
 * @returns {Promise<{source: string, value: number, explanation?: string}>}
 */
export async function resolveHeatLossFactor({
  userSettings = {},
  analyzerResults = null,
}) {
  // Check analyzer first
  const analyzer = analyzerResults?.heatLossFactor
    ? {
        heatLossFactor: analyzerResults.heatLossFactor,
      }
    : null;

  // Query RAG for Manual J
  const ragManualJ = await queryRAGForManualJHeatLoss(userSettings);

  // Calculate fallback
  const { getManualJHeatLossFactor } = await import("./manualJHeatLoss.js");
  const fallback = {
    heatLossFactor: getManualJHeatLossFactor(userSettings),
  };

  // Choose based on priority
  return chooseHeatLossFactor({ analyzer, ragManualJ, fallback });
}


