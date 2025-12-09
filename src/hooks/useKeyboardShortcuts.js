import { useEffect } from 'react';

/**
 * Custom hook for keyboard shortcuts
 * 
 * @param {Object} shortcuts - Object mapping key combinations to callbacks
 * @param {Array} deps - Dependencies array (optional)
 * 
 * @example
 * useKeyboardShortcuts({
 *   'ctrl+s': (e) => { e.preventDefault(); handleSave(); },
 *   'ctrl+p': (e) => { e.preventDefault(); window.print(); },
 *   'ctrl+k': (e) => { e.preventDefault(); openSearch(); },
 *   'escape': (e) => { closeModal(); }
 * });
 */
export function useKeyboardShortcuts(shortcuts, deps = []) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Build key string (e.g., "ctrl+s", "ctrl+shift+p")
      const parts = [];
      
      if (event.ctrlKey || event.metaKey) parts.push('ctrl');
      if (event.altKey) parts.push('alt');
      if (event.shiftKey) parts.push('shift');
      
      // Get the main key
      const key = event.key.toLowerCase();
      
      // Skip modifier keys alone
      if (['control', 'alt', 'shift', 'meta'].includes(key)) {
        return;
      }
      
      // Map special keys
      const keyMap = {
        ' ': 'space',
        'arrowup': 'up',
        'arrowdown': 'down',
        'arrowleft': 'left',
        'arrowright': 'right',
        'escape': 'escape',
        'enter': 'enter',
        'tab': 'tab',
      };
      
      const normalizedKey = keyMap[key] || key;
      parts.push(normalizedKey);
      
      const keyString = parts.join('+');
      
      // Check if we have a handler for this combination
      const handler = shortcuts[keyString];
      
      if (handler) {
        handler(event);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts, ...deps]);
}

/**
 * Common keyboard shortcuts for the app
 */
export const COMMON_SHORTCUTS = {
  PRINT: 'ctrl+p',
  SAVE: 'ctrl+s',
  SEARCH: 'ctrl+k',
  ESCAPE: 'escape',
  HELP: 'ctrl+?',
  NEW: 'ctrl+n',
  OPEN: 'ctrl+o',
};






