/**
 * RAG Query Utility – Now With Better Manners and Smarter Standards Detection
 * Used by Ask Joule to pull real HVAC knowledge instead of hallucinating
 * 
 * UNIFIED RAG SEARCH: Combines all knowledge sources into a single search
 * - HVAC Knowledge Base (Manual J/S/D, ASHRAE standards, equipment specs)
 * - User Knowledge (uploaded PDFs, markdown docs)
 * - Sales FAQ (presales questions, compatibility, pricing)
 */

import {
  searchKnowledgeBase,
  formatKnowledgeForLLM,
} from "./hvacKnowledgeBase.js";
import { addUserKnowledge } from "./userKnowledge.js";

/**
 * Unified RAG search - combines all knowledge sources into a single search
 * 
 * This function searches across all available RAG engines:
 * 1. HVAC Knowledge Base (Manual J/S/D, ASHRAE standards, equipment specs, troubleshooting)
 * 2. User Knowledge (uploaded PDFs, markdown docs, custom content)
 * 3. Sales FAQ (presales questions, compatibility, pricing, shipping)
 * 
 * All results are normalized to a 0-100 relevance score and ranked together.
 * 
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @param {boolean} options.includeSalesFAQ - Include sales FAQ in search (default: true)
 * @param {boolean} options.includeUserKnowledge - Include user knowledge (default: true)
 * @returns {Promise<Array>} Combined and ranked search results with normalized scores
 */
export async function queryUnifiedRAG(query, options = {}) {
  const { includeSalesFAQ = true, includeUserKnowledge = true } = options;
  
  if (!query?.trim()) {
    return [];
  }

  const trimmedQuery = query.trim();
  const allResults = [];

  // 1. Search main HVAC knowledge base (includes user knowledge if enabled)
  try {
    const hvacResults = await searchKnowledgeBase(trimmedQuery, includeUserKnowledge);
    hvacResults.forEach(result => {
      allResults.push({
        ...result,
        sourceType: result.section === 'userKnowledge' ? 'userKnowledge' : 'hvacKnowledge',
        // Normalize relevance scores (HVAC knowledge base uses 0-10 scale)
        normalizedScore: (result.relevanceScore || 0) * 10,
      });
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("[RAG] HVAC knowledge search failed:", error);
    }
  }

  // 2. Search Sales FAQ if enabled
  if (includeSalesFAQ) {
    try {
      const { searchSalesFAQ } = await import("./salesFAQ.js");
      const salesResult = searchSalesFAQ(trimmedQuery);
      
      if (salesResult) {
        // Calculate relevance score for sales FAQ (0-100 scale)
        const lowerQuery = trimmedQuery.toLowerCase();
        let score = 0;
        salesResult.keywords.forEach(kw => {
          if (lowerQuery.includes(kw)) score += 10;
        });
        if (lowerQuery.includes(salesResult.question.toLowerCase().slice(0, 30))) {
          score += 30; // Strong question match
        }
        
        allResults.push({
          section: "salesFAQ",
          topic: salesResult.category || "sales",
          title: salesResult.question,
          source: "Sales FAQ",
          summary: salesResult.answer,
          keyConcepts: [salesResult.answer],
          relevanceScore: Math.min(score, 100),
          normalizedScore: Math.min(score, 100),
          sourceType: "salesFAQ",
          isSalesFAQ: true,
        });
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("[RAG] Sales FAQ search failed:", error);
      }
    }
  }

  // 3. Sort all results by normalized score (highest first)
  allResults.sort((a, b) => (b.normalizedScore || 0) - (a.normalizedScore || 0));

  // 4. Return top results (limit to prevent token bloat)
  return allResults.slice(0, 10);
}

/**
 * Main RAG lookup – returns clean, LLM-ready context
 * Now uses unified RAG search that combines all knowledge sources
 */
export async function queryHVACKnowledge(query, options = {}) {
  if (!query?.trim()) {
    return {
      success: false,
      message: "I didn't catch that — could you try asking again?",
    };
  }

  try {
    // Use unified RAG search
    const results = await queryUnifiedRAG(query.trim(), options);

    if (results.length === 0) {
      return {
        success: false,
        message:
          "I looked everywhere in my HVAC brain and couldn't find a solid answer for that one. Try rephrasing or ask me something weird — I love weird.",
      };
    }

    const content = formatKnowledgeForLLM(results);

    return {
      success: true,
      content,
      sources: results.map((r) => ({
        title: r.title,
        score: r.normalizedScore || r.relevanceScore,
        sourceType: r.sourceType,
      })), // helpful for debugging / future UI
    };
  } catch (error) {
    // Fail quietly in production, loud in dev
    if (import.meta.env.DEV) {
      console.error("[RAG] Search failed:", error);
    }

    return {
      success: false,
      message:
        "Something hiccuped on my end while digging through the knowledge base. I'll get it fixed — try again in a minute?",
    };
  }
}

/**
 * Enhanced version that also tells you which engineering standards apply
 * Perfect for when someone asks "am I oversized?" or "what's the right airflow?"
 */
export async function queryWithStandards(query) {
  const q = query.toLowerCase().trim();

  const relevantStandards = new Set();

  // Manual J – Load Calculation
  if (
    /manual\s*j|load\s*calc|heat\s*loss.*\d+|sizing|btu.*sizing|right\s*size/i.test(
      q
    )
  ) {
    relevantStandards.add("ACCA Manual J (Residential Load Calculation)");
  }

  // Manual S – Equipment Selection
  if (
    /manual\s*s|oversized|undersized|short\s*cycl|equipment\s*selection|too\s*big|too\s*small/i.test(
      q
    )
  ) {
    relevantStandards.add("ACCA Manual S (Equipment Selection)");
  }

  // Manual D – Duct Design
  if (
    /manual\s*d|duct.*(design|size|cfm)|air\s*flow|static\s*pressure|velocity/i.test(
      q
    )
  ) {
    relevantStandards.add("ACCA Manual D (Residential Duct Design)");
  }

  // ASHRAE 55 – Thermal Comfort
  if (
    /ashrae\s*55|thermal\s*comfort|comfort\s*zone|pmv|ppd|too\s*hot.*humidity|feels\s*like/i.test(
      q
    )
  ) {
    relevantStandards.add(
      "ASHRAE Standard 55 (Thermal Environmental Conditions for Human Occupancy)"
    );
  }

  // ASHRAE 62.2 – Ventilation & IAQ
  if (
    /ashrae\s*62|ventilation|fresh\s*air|iaq|indoor\s*air|co2|air\s*changes?|erv|hrv/i.test(
      q
    )
  ) {
    relevantStandards.add(
      "ASHRAE 62.2 (Ventilation and Acceptable Indoor Air Quality)"
    );
  }

  // Bonus: Building America / ENERGY STAR references
  if (/energy\s*star|building\s*america|zero\s*energy|net\s*zero/i.test(q)) {
    relevantStandards.add(
      "Building America Solution Center & ENERGY STAR guidelines"
    );
  }

  const knowledge = await queryHVACKnowledge(query);

  return {
    ...knowledge,
    relevantStandards:
      relevantStandards.size > 0 ? Array.from(relevantStandards) : undefined,
  };
}

/**
 * Add text content to user knowledge base
 * @param {string} title - Title for the knowledge entry
 * @param {string} content - Text content to add
 * @param {string} source - Source identifier (default: "user-uploaded")
 * @returns {Object} Result with success status
 */
export async function addToUserKnowledge(title, content, source = "user-uploaded") {
  if (!content || !content.trim()) {
    return { success: false, error: "Content cannot be empty" };
  }
  
  try {
    const { addUserKnowledge } = await import("./userKnowledge.js");
    const result = addUserKnowledge(title, content.trim(), source);
    // addUserKnowledge already returns { success: boolean, ... }
    return result;
  } catch (error) {
    console.error("[RAG] Failed to add to user knowledge:", error);
    return { success: false, error: error.message };
  }
}
