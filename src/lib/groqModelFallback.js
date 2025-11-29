/**
 * Automatic model fallback on rate limits
 * Falls back to llama-3.1-8b-instant on rate limit, then retries original model after delay
 */

const FALLBACK_MODEL = "llama-3.1-8b-instant";
const PRIMARY_MODEL = "llama-3.3-70b-versatile";
const RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes

const STORAGE_KEY_ORIGINAL_MODEL = "groqModelOriginal";
const STORAGE_KEY_FALLBACK_TIMESTAMP = "groqModelFallbackTimestamp";

/**
 * Handle rate limit by falling back to a faster model
 * @param {string} currentModel - Current model that hit rate limit
 * @returns {string} Fallback model to use
 */
export function handleRateLimitFallback(currentModel) {
  // If already using fallback model, keep using it
  if (currentModel === FALLBACK_MODEL) {
    return FALLBACK_MODEL;
  }

  // Store original model and timestamp
  try {
    localStorage.setItem(STORAGE_KEY_ORIGINAL_MODEL, currentModel);
    localStorage.setItem(STORAGE_KEY_FALLBACK_TIMESTAMP, Date.now().toString());
    localStorage.setItem("groqModel", FALLBACK_MODEL);
    
    // Trigger storage event so other components pick up the change
    window.dispatchEvent(new Event("storage"));
    
    console.log(`[Model Fallback] Rate limit hit. Falling back to ${FALLBACK_MODEL}`);
    return FALLBACK_MODEL;
  } catch (error) {
    console.warn("[Model Fallback] Failed to store fallback state:", error);
    return FALLBACK_MODEL;
  }
}

/**
 * Check if we should retry the primary model after fallback
 * @returns {string|null} Model to use, or null if should keep fallback
 */
export function checkRetryPrimaryModel() {
  try {
    const fallbackTimestamp = localStorage.getItem(STORAGE_KEY_FALLBACK_TIMESTAMP);
    const originalModel = localStorage.getItem(STORAGE_KEY_ORIGINAL_MODEL);
    
    if (!fallbackTimestamp || !originalModel) {
      return null; // No fallback in progress
    }

    const timestamp = parseInt(fallbackTimestamp, 10);
    const elapsed = Date.now() - timestamp;

    if (elapsed >= RETRY_DELAY_MS) {
      // Time to retry primary model
      localStorage.removeItem(STORAGE_KEY_ORIGINAL_MODEL);
      localStorage.removeItem(STORAGE_KEY_FALLBACK_TIMESTAMP);
      localStorage.setItem("groqModel", originalModel);
      
      // Trigger storage event
      window.dispatchEvent(new Event("storage"));
      
      console.log(`[Model Fallback] Retrying primary model: ${originalModel}`);
      return originalModel;
    }

    // Still in fallback period
    return FALLBACK_MODEL;
  } catch (error) {
    console.warn("[Model Fallback] Failed to check retry:", error);
    return null;
  }
}

/**
 * Get the current model, checking if we should retry primary
 * @param {string} requestedModel - Model requested by caller
 * @returns {string} Model to actually use
 */
export function getCurrentModel(requestedModel) {
  // Check if we're in fallback mode and should retry
  const retryModel = checkRetryPrimaryModel();
  if (retryModel) {
    return retryModel;
  }

  // Check if we're currently in fallback mode
  try {
    const fallbackTimestamp = localStorage.getItem(STORAGE_KEY_FALLBACK_TIMESTAMP);
    if (fallbackTimestamp) {
      // We're in fallback mode, use fallback model
      return FALLBACK_MODEL;
    }
  } catch (error) {
    // Ignore errors, just use requested model
  }

  // Use requested model (or default)
  return requestedModel || PRIMARY_MODEL;
}

/**
 * Clear fallback state (e.g., when user manually changes model)
 */
export function clearFallbackState() {
  try {
    localStorage.removeItem(STORAGE_KEY_ORIGINAL_MODEL);
    localStorage.removeItem(STORAGE_KEY_FALLBACK_TIMESTAMP);
  } catch (error) {
    console.warn("[Model Fallback] Failed to clear fallback state:", error);
  }
}

