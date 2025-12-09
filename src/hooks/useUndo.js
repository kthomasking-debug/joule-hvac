import { useState, useCallback, useRef } from 'react';

/**
 * Undo/Redo hook for managing state history
 * 
 * @param {any} initialValue - Initial value
 * @param {number} maxHistory - Maximum history size (default: 50)
 * @returns {Object} { value, setValue, undo, redo, canUndo, canRedo }
 */
export function useUndo(initialValue, maxHistory = 50) {
  const [value, setValueState] = useState(initialValue);
  const historyRef = useRef([initialValue]);
  const positionRef = useRef(0);

  const setValue = useCallback((newValue) => {
    // If we're not at the end of history, remove future items
    if (positionRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, positionRef.current + 1);
    }

    // Add new value to history
    historyRef.current.push(newValue);
    
    // Limit history size
    if (historyRef.current.length > maxHistory) {
      historyRef.current.shift();
    } else {
      positionRef.current++;
    }

    setValueState(newValue);
  }, [maxHistory]);

  const undo = useCallback(() => {
    if (positionRef.current > 0) {
      positionRef.current--;
      setValueState(historyRef.current[positionRef.current]);
      return true;
    }
    return false;
  }, []);

  const redo = useCallback(() => {
    if (positionRef.current < historyRef.current.length - 1) {
      positionRef.current++;
      setValueState(historyRef.current[positionRef.current]);
      return true;
    }
    return false;
  }, []);

  const canUndo = positionRef.current > 0;
  const canRedo = positionRef.current < historyRef.current.length - 1;

  return {
    value,
    setValue,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}






