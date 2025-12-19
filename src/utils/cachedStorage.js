/**
 * Cached localStorage Utility
 * Reduces redundant localStorage reads by maintaining an in-memory cache
 * with automatic invalidation on storage events
 */

// In-memory cache for localStorage values
const cache = new Map();
const listeners = new Map();

/**
 * Get value from localStorage with caching
 * @param {string} key - localStorage key
 * @param {any} defaultValue - Default value if key doesn't exist
 * @returns {any} - Cached or fetched value
 */
export function getCached(key, defaultValue = null) {
  // Return cached value if available
  if (cache.has(key)) {
    return cache.get(key);
  }

  // Fetch from localStorage
  let value = defaultValue;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const item = localStorage.getItem(key);
      if (item !== null) {
        try {
          value = JSON.parse(item);
        } catch (parseError) {
          // If JSON parse fails, check if it's a valid JSON string that just failed to parse
          // If it looks like JSON (starts/ends with quotes or brackets), use default
          // Otherwise, it might be a plain string value stored directly
          if (item.startsWith('"') && item.endsWith('"')) {
            // It's a JSON string, but parse failed - use default
            return defaultValue;
          }
          // For invalid JSON that doesn't look like a JSON string, return default
          // This handles cases where corrupted data was stored
          return defaultValue;
        }
      } else {
        // Key doesn't exist, return default
        return defaultValue;
      }
    }
  } catch (error) {
    console.warn(`Failed to get cached value for key "${key}":`, error);
    return defaultValue;
  }

  // Cache the value
  cache.set(key, value);
  return value;
}

/**
 * Set value in localStorage and update cache
 * @param {string} key - localStorage key
 * @param {any} value - Value to store
 * @returns {boolean} - Success status
 */
export function setCached(key, value) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
      cache.set(key, value);

      // Notify listeners
      const keyListeners = listeners.get(key);
      if (keyListeners) {
        keyListeners.forEach((listener) => listener(value));
      }

      return true;
    }
  } catch (error) {
    console.warn(`Failed to set cached value for key "${key}":`, error);
    return false;
  }
  return false;
}

/**
 * Remove value from localStorage and cache
 * @param {string} key - localStorage key
 */
export function removeCached(key) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.removeItem(key);
      cache.delete(key);

      // Notify listeners
      const keyListeners = listeners.get(key);
      if (keyListeners) {
        keyListeners.forEach((listener) => listener(null));
      }
    }
  } catch (error) {
    console.warn(`Failed to remove cached value for key "${key}":`, error);
  }
}

/**
 * Clear all cache entries
 */
export function clearCache() {
  cache.clear();
}

/**
 * Invalidate cache for a specific key
 * @param {string} key - localStorage key to invalidate
 */
export function invalidateCache(key) {
  cache.delete(key);
}

/**
 * Subscribe to changes for a specific key
 * @param {string} key - localStorage key to watch
 * @param {Function} callback - Callback function
 * @returns {Function} - Unsubscribe function
 */
export function subscribe(key, callback) {
  if (!listeners.has(key)) {
    listeners.set(key, new Set());
  }
  listeners.get(key).add(callback);

  // Return unsubscribe function
  return () => {
    const keyListeners = listeners.get(key);
    if (keyListeners) {
      keyListeners.delete(callback);
      if (keyListeners.size === 0) {
        listeners.delete(key);
      }
    }
  };
}

// Initialize storage event listener for cross-tab sync
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key) {
      // Invalidate cache for changed key
      invalidateCache(event.key);

      // Try to update cache with new value
      if (event.newValue !== null) {
        try {
          const value = JSON.parse(event.newValue);
          cache.set(event.key, value);
        } catch {
          // If JSON parse fails, try using as plain string
          if (event.newValue && !event.newValue.startsWith('"')) {
            cache.set(event.key, event.newValue);
          }
          // Otherwise ignore parse errors
        }
      } else {
        cache.delete(event.key);
      }

      // Notify listeners
      const keyListeners = listeners.get(event.key);
      if (keyListeners) {
        let newValue = null;
        if (event.newValue) {
          try {
            newValue = JSON.parse(event.newValue);
          } catch {
            // If JSON parse fails, use as plain string
            if (!event.newValue.startsWith('"')) {
              newValue = event.newValue;
            }
          }
        }
        keyListeners.forEach((listener) => listener(newValue));
      }
    }
  });
}

/**
 * Batch read multiple keys efficiently
 * @param {string[]} keys - Array of localStorage keys
 * @returns {Object} - Map of key-value pairs (only includes keys that exist)
 */
export function getCachedBatch(keys) {
  const result = {};
  keys.forEach((key) => {
    // Check if key exists in localStorage first
    if (
      typeof window !== "undefined" &&
      window.localStorage &&
      localStorage.getItem(key) !== null
    ) {
      try {
        result[key] = getCached(key);
      } catch (error) {
        // Skip keys that fail to parse
        console.warn(
          `Failed to get cached value for key "${key}" in batch:`,
          error
        );
      }
    }
    // If key doesn't exist, don't include it in result
  });
  return result;
}

/**
 * Batch write multiple keys efficiently
 * @param {Object} updates - Map of key-value pairs
 */
export function setCachedBatch(updates) {
  Object.entries(updates).forEach(([key, value]) => {
    setCached(key, value);
  });
}
