/**
 * Pre-generated TTS Response System
 * Maps text responses to pre-generated audio files for offline, instant playback
 */

// Base path for pre-generated audio files
const AUDIO_BASE_PATH = "/audio/pre-generated";

// Cache for loaded mapping
let mappingCache = null;

/**
 * Load the mapping file that maps text to audio filenames
 */
async function loadMapping() {
  if (mappingCache) {
    return mappingCache;
  }

  try {
    const response = await fetch(`${AUDIO_BASE_PATH}/mapping.json`);
    if (response.ok) {
      const contentType = response.headers.get("content-type");
      // Check if response is actually JSON (not HTML from 404 page)
      if (contentType && contentType.includes("application/json")) {
        mappingCache = await response.json();
        return mappingCache;
      } else {
        // Response is not JSON (likely HTML 404 page)
        if (import.meta.env.DEV) {
          console.warn("TTS mapping file not found or not JSON. Skipping pre-generated TTS.");
        }
      }
    }
  } catch (error) {
    // Silently fail - pre-generated TTS is optional
    if (import.meta.env.DEV) {
      console.warn("Failed to load pre-generated TTS mapping:", error);
    }
  }

  return {};
}

/**
 * Normalize text for matching (remove punctuation, lowercase, trim)
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:]/g, "") // Remove punctuation
    .replace(/\s+/g, " "); // Normalize whitespace
}

/**
 * Check if text contains dynamic content (numbers, variables, etc.)
 */
export function hasDynamicContent(text) {
  // Check for numbers
  if (/\d+/.test(text)) {
    return true;
  }

  // Check for common variable patterns
  const variablePatterns = [
    /\$\d+/, // Dollar amounts
    /\d+°F/, // Temperatures
    /\d+%/, // Percentages
    /\d+\s*(degrees|percent|dollars?|hours?|minutes?)/i, // Numbered units
  ];

  return variablePatterns.some((pattern) => pattern.test(text));
}

/**
 * Find a pre-generated audio file for the given text
 * Returns the audio file path or null if not found
 */
export async function findPreGeneratedAudio(text) {
  if (!text) return null;

  // Don't use pre-generated for dynamic content
  if (hasDynamicContent(text)) {
    return null;
  }

  const mapping = await loadMapping();
  if (!mapping || Object.keys(mapping).length === 0) {
    return null;
  }

  const normalized = normalizeText(text);

  // Try exact match first
  if (mapping[normalized]) {
    return `${AUDIO_BASE_PATH}/${mapping[normalized]}`;
  }

  // Try partial match (for responses that might have slight variations)
  const normalizedNoPunct = normalized.replace(/[.,!?;:]/g, "");
  if (mapping[normalizedNoPunct]) {
    return `${AUDIO_BASE_PATH}/${mapping[normalizedNoPunct]}`;
  }

  // Try to find a close match (fuzzy matching for common variations)
  const textWords = normalized.split(" ");
  for (const [key, filename] of Object.entries(mapping)) {
    const keyWords = key.split(" ");

    // If 80% of words match, consider it a match
    const matchingWords = textWords.filter((word) => keyWords.includes(word));
    if (matchingWords.length / textWords.length >= 0.8) {
      return `${AUDIO_BASE_PATH}/${filename}`;
    }
  }

  return null;
}

/**
 * Check if pre-generated audio files are available
 */
export async function hasPreGeneratedAudio() {
  const mapping = await loadMapping();
  return mapping && Object.keys(mapping).length > 0;
}

/**
 * Play a pre-generated audio file
 */
export function playPreGeneratedAudio(audioPath) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(audioPath);

    audio.onended = () => {
      resolve();
    };

    audio.onerror = (error) => {
      reject(error);
    };

    audio.play().catch(reject);
  });
}

/**
 * Extract dynamic parts from text for Browser TTS
 * Returns the text with numbers/variables formatted for TTS
 */
export function formatDynamicTextForTTS(text) {
  // This will be handled by the existing TTS formatting in useSpeechSynthesis
  // This function is here for future extensibility
  return text;
}
