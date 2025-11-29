import { useState, useEffect } from "react";

/**
 * useLocalStorage React Hook
 * @param {string} key - The localStorage key
 * @param {any} initialValue - The default value if nothing is in localStorage
 * @returns {[any, function]} - [value, setValue]
 */
export function useLocalStorage(key, initialValue) {
  // Read from localStorage once on mount
  const readValue = () => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      if (import.meta.env.DEV) {
        try {
          console.info(
            `useLocalStorage: key='${key}' readValue:`,
            item ? JSON.parse(item) : item
          );
        } catch {
          /* ignore */
        }
      }
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  };

  const [storedValue, setStoredValue] = useState(readValue);

  // Update localStorage when state changes
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (_error) {
      console.warn("useLocalStorage: failed to set item", key, _error);
    }
  }, [key, storedValue]);

  // Always re-read from localStorage on mount (fixes E2E reload race)
  useEffect(() => {
    const value = readValue();
    setStoredValue((prev) => {
      // Avoid unnecessary state updates (prevents infinite loop)
      if (JSON.stringify(prev) !== JSON.stringify(value)) {
        return value;
      }
      return prev;
    });
    const handleStorage = (event) => {
      if (event.key === key) {
        const newVal = event.newValue
          ? JSON.parse(event.newValue)
          : initialValue;
        if (import.meta.env.DEV) {
          try {
            console.info(
              `useLocalStorage: key='${key}' storage event - newValue:`,
              newVal
            );
          } catch (_e) {
            if (import.meta.env.DEV) console.debug(_e);
          }
        }
        setStoredValue(newVal);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [key, initialValue]);

  return [storedValue, setStoredValue];
}
