import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ModeContext = createContext({ mode: 'traditional', setMode: () => {}, toggleMode: () => {} });

export function ModeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    if (typeof window === 'undefined') return 'traditional';
    try {
      const stored = localStorage.getItem('thermostatMode');
      // Always default to traditional mode, ignore stored 'ai' mode
      return stored === 'ai' ? 'traditional' : (stored || 'traditional');
    } catch {
      return 'traditional';
    }
  });

  useEffect(() => {
    try { localStorage.setItem('thermostatMode', mode); } catch { /* ignore */ }
  }, [mode]);

  const toggleMode = useCallback(() => {
    setMode(m => (m === 'ai' ? 'traditional' : 'ai'));
  }, []);

  return (
    <ModeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </ModeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMode() {
  return useContext(ModeContext);
}
