/**
 * Debounced localStorage Writes
 * Reduces storage fragmentation by batching writes
 */

const writeQueue = new Map();
let flushTimer = null;
const FLUSH_DELAY = 300; // ms

/**
 * Debounced write to localStorage
 * Batches multiple writes within FLUSH_DELAY ms
 * 
 * @param {string} key - localStorage key
 * @param {any} value - Value to write
 */
export function debouncedWrite(key, value) {
  // Add to write queue
  writeQueue.set(key, value);

  // Clear existing timer
  if (flushTimer) {
    clearTimeout(flushTimer);
  }

  // Set new timer to flush queue
  flushTimer = setTimeout(() => {
    flushWrites();
  }, FLUSH_DELAY);
}

/**
 * Flush all queued writes immediately
 */
export function flushWrites() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (writeQueue.size === 0) {
    return;
  }

  try {
    // Write all queued items
    writeQueue.forEach((value, key) => {
      try {
        const serialized = JSON.stringify(value);
        localStorage.setItem(key, serialized);
      } catch (error) {
        console.warn(`Failed to write ${key} to localStorage:`, error);
      }
    });

    writeQueue.clear();
  } catch (error) {
    console.warn('Failed to flush localStorage writes:', error);
    // Clear queue on error to prevent memory leak
    writeQueue.clear();
  }
}

/**
 * Immediate write (bypasses debouncing)
 * Use for critical writes that must happen immediately
 * 
 * @param {string} key - localStorage key
 * @param {any} value - Value to write
 */
export function immediateWrite(key, value) {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    
    // Remove from queue if it was queued
    writeQueue.delete(key);
  } catch (error) {
    console.warn(`Failed to write ${key} to localStorage:`, error);
  }
}

// Flush on page unload to prevent data loss
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushWrites);
  window.addEventListener('pagehide', flushWrites);
}






