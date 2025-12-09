/**
 * OFFLINE PARSER - The Backup Brain (Lizard Brain)
 * 
 * Purpose: Pattern Matching for the Pi Zero Bridge
 * 
 * This is the regex-based parser that runs completely offline.
 * It's the "Lizard Brain" - fast, pattern-matching, no internet required.
 * 
 * Used by:
 * - Pi Zero Bridge ($129 tier) - runs offline, no Groq API access
 * - Fallback when LLM classification fails or API key unavailable
 * 
 * Architecture:
 * - Pattern Matching (Regex Hell) - 1200+ lines of regex patterns
 * - Zero latency, zero cost, zero internet dependency
 * - Handles all commands through pattern matching
 * 
 * Evolution:
 * - This is the "before" state (Pattern Matching)
 * - The "after" state is llmIntentClassifier.js (Semantic Understanding)
 * 
 * Keep this file. The Bridge needs it to function offline.
 */

// Lazy load RAG data for fun responses
let funResponsesModule = null;
let funResponsesLoading = null;

async function loadFunResponses() {
  if (funResponsesModule) return funResponsesModule;
  if (funResponsesLoading) return funResponsesLoading;
  funResponsesLoading = import("./rag/funResponses.js").then((module) => {
    funResponsesModule = module;
    funResponsesLoading = null;
    return module;
  });
  return funResponsesLoading;
}

// Preload in background
if (typeof window !== "undefined") {
  setTimeout(() => {
    loadFunResponses().catch(() => {});
  }, 2000);
}

// Map common words to insulation coefficients
const INSULATION_MAP = {
  poor: 1.4,
  average: 1.0,
  typical: 1.0,
  good: 0.65,
};

// Helper parsing functions
export function parseSquareFeet(q) {
  // Matches: 2,000 sq ft | 1800 square feet | 1.8k sf
  const re =
    /((?:\d{1,3}(?:,\d{3})+)|\d{3,6}|\d+(?:\.\d+)?\s*k)\s*(?:sq\s*?ft|square\s*feet|sf)\b/i;
  const m = q.match(re);
  if (!m) return undefined;
  let raw = m[1].toLowerCase().replace(/,/g, "").trim();
  if (raw.endsWith("k")) {
    const n = parseFloat(raw.slice(0, -1));
    if (!isNaN(n)) return Math.round(n * 1000);
  }
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

export function parseTemperature(q) {
  // Match "at 72", "to 72", or "72 degrees" (multi-turn context)
  const re =
    /(?:at|to|set(?:\s*it)?\s*to)\s*(\d{2})(?:\s*°?\s*F|\s*F)?\b|(\d{2})\s*(?:degrees|°)/i;
  const m = q.match(re);
  if (!m) return undefined;
  const n = parseInt(m[1] || m[2], 10);
  if (!Number.isFinite(n)) return undefined;
  if (n < 45 || n > 85) return undefined; // guard against year numbers, etc.
  return n;
}

export function parseInsulation(q) {
  const re =
    /(poor|average|typical|good)\s+insulation|\b(poor|average|typical|good)\b/i;
  const m = q.match(re);
  const word = m && (m[1] || m[2]) ? (m[1] || m[2]).toLowerCase() : undefined;
  return word && INSULATION_MAP[word] ? INSULATION_MAP[word] : undefined;
}

export function parseSystem(q) {
  if (/heat\s*pump|hp\b/i.test(q)) return "heatPump";
  if (/gas\s*(?:furnace)?|furnace/i.test(q)) return "gasFurnace";
  return undefined;
}

export function parseMode(q) {
  if (/\bheating\b|keep\s*it\s*w?arm/i.test(q)) return "heating";
  if (/\bcooling\b|keep\s*it\s*cool/i.test(q)) return "cooling";
  return undefined;
}

export function parseCity(q) {
  // Prefer explicit "in City, ST"
  const inComma = q.match(/\bin\s+([A-Za-z.\-\s]+?,\s*[A-Z]{2})\b/i);
  if (inComma) return inComma[1].trim();
  // Bare "City, ST" (avoid capturing leading words before city)
  const bareComma = q.match(/(^|\s)([A-Z][A-Za-z.\s-]+?,\s*[A-Z]{2})\b/);
  if (bareComma) return bareComma[2].trim();
  // Fallback: "in City" form (stop at comma or common keywords/numbers)
  const inCity = q.match(
    /\bin\s+([A-Za-z.\s-]+?)(?:,|\s+(?:at|to|set|with|for|on|keep|good|poor|excellent|bad|\d|$))/i
  );
  if (inCity) return inCity[1].trim();
  // Start-of-string city heuristic: leading capitalized words before a stop word
  const startCity = q.match(
    /^([A-Z][A-Za-z.-]*(?:\s+[A-Z][A-Za-z.-]*)*)\b(?=\s+(?:keep|set|at|to|with|for|on|\d|$))/
  );
  if (startCity) return startCity[1].trim();
  return undefined;
}

// Note: The actual parseCommandLocal function (1200+ lines of regex) 
// is defined in askJouleParser.js and exported from there.
// This file serves as documentation and a clear entry point for the "Backup Brain".
//
// To use the offline parser directly:
// import { parseCommandLocal } from "./askJouleParser.js";
//
// Or use the main parser which automatically falls back to it:
// import { parseAskJoule } from "./askJouleParser.js";

