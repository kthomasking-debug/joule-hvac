/**
 * RAG Query Utility – Now With Better Manners and Smarter Standards Detection
 * Used by Ask Joule to pull real HVAC knowledge instead of hallucinating
 */

import {
  searchKnowledgeBase,
  formatKnowledgeForLLM,
} from "./hvacKnowledgeBase.js";
import { addUserKnowledge } from "./userKnowledge.js";

/**
 * Main RAG lookup – returns clean, LLM-ready context
 */
export async function queryHVACKnowledge(query) {
  if (!query?.trim()) {
    return {
      success: false,
      message: "I didn't catch that — could you try asking again?",
    };
  }

  try {
    const results = await searchKnowledgeBase(query.trim());

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
        score: r.relevanceScore,
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
