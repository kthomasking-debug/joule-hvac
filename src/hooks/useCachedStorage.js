import { useState, useEffect, useCallback } from 'react';
import { getCached, setCached, subscribe } from '../utils/cachedStorage';

/**
 * React hook for cached localStorage access
 * Reduces redundant reads by using in-memory cache
 * 
 * @param {string} key - localStorage key
 * @param {any} initialValue - Default value if key doesn't exist
 * @returns {[any, Function, Function]} - [value, setValue, removeValue]
 */
export function useCachedStorage(key, initialValue = null) {
  // Initialize state from cache
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    return getCached(key, initialValue);
  });

  // Update state when storage changes (cross-tab sync)
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const unsubscribe = subscribe(key, (newValue) => {
      setStoredValue(newValue !== null ? newValue : initialValue);
    });

    return unsubscribe;
  }, [key, initialValue]);

  // Setter function
  const setValue = useCallback((value) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      setStoredValue(valueToStore);
      setCached(key, valueToStore);
    } catch (error) {
      console.warn(`Failed to set cached storage for key "${key}":`, error);
    }
  }, [key, storedValue]);

  // Remover function
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue);
      setCached(key, null);
      // Actually remove from localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn(`Failed to remove cached storage for key "${key}":`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}

/**
 * React hook for reading multiple cached localStorage keys
 * Useful for batch loading on component mount
 * 
 * @param {string[]} keys - Array of localStorage keys
 * @returns {Object} - Map of key-value pairs
 */
export function useCachedStorageBatch(keys) {
  const [values, setValues] = useState(() => {
    if (typeof window === 'undefined') {
      return {};
    }
    const result = {};
    keys.forEach(key => {
      result[key] = getCached(key);
    });
    return result;
  });

  // Subscribe to all keys
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const unsubscribes = keys.map(key =>
      subscribe(key, (newValue) => {
        setValues(prev => ({ ...prev, [key]: newValue }));
      })
    );

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [keys]);

  return values;
}






