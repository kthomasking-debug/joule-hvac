import { useEffect, useRef } from 'react';
import logger from '../utils/logger';

/**
 * Auto-save hook for form inputs
 * Automatically saves draft values to localStorage with debouncing
 * 
 * @param {string} key - localStorage key to save to
 * @param {any} value - Current value to save
 * @param {number} delay - Debounce delay in milliseconds (default: 1000)
 * @param {Function} transform - Optional function to transform value before saving
 */
export function useAutoSave(key, value, delay = 1000, transform = null) {
  const timeoutRef = useRef(null);
  const lastSavedRef = useRef(null);

  useEffect(() => {
    // Skip if value hasn't changed
    if (value === lastSavedRef.current) {
      return;
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      try {
        const valueToSave = transform ? transform(value) : value;
        const serialized = JSON.stringify(valueToSave);
        localStorage.setItem(key, serialized);
        lastSavedRef.current = value;
        logger.debug(`Auto-saved ${key}`);
      } catch (error) {
        logger.warn(`Failed to auto-save ${key}:`, error);
      }
    }, delay);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [key, value, delay, transform]);
}

/**
 * Load auto-saved draft from localStorage
 * 
 * @param {string} key - localStorage key
 * @param {any} defaultValue - Default value if nothing is saved
 * @returns {any} Saved value or default
 */
export function loadAutoSave(key, defaultValue = null) {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    logger.warn(`Failed to load auto-save ${key}:`, error);
  }
  return defaultValue;
}

/**
 * Clear auto-saved draft
 * 
 * @param {string} key - localStorage key
 */
export function clearAutoSave(key) {
  try {
    localStorage.removeItem(key);
    logger.debug(`Cleared auto-save ${key}`);
  } catch (error) {
    logger.warn(`Failed to clear auto-save ${key}:`, error);
  }
}






