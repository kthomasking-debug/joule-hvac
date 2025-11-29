import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';

const ConversationContext = createContext(null);
const MAX_HISTORY = 10;
const INACTIVITY_MS = 5 * 60 * 1000; // 5 minutes

export function ConversationProvider({ children }) {
  const [history, setHistory] = useState(() => []);
  const lastActiveRef = useRef(Date.now());

  // Prune on inactivity
  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() - lastActiveRef.current > INACTIVITY_MS) {
        setHistory([]);
      }
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const addInteraction = useCallback((interaction) => {
    lastActiveRef.current = Date.now();
    setHistory(prev => {
      const next = [...prev, { ...interaction, ts: Date.now() }];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
  }, []);

  const value = { history, addInteraction };
  return <ConversationContext.Provider value={value}>{children}</ConversationContext.Provider>;
}

// Warn once if hook used without provider (tests or non-conversational areas)
let conversationContextWarned = false;
// eslint-disable-next-line react-refresh/only-export-components
export function useConversationContext() {
  const ctx = useContext(ConversationContext);
  if (!ctx) {
    if (!conversationContextWarned && typeof console !== 'undefined') {
      console.warn('ConversationContext: missing provider; using no-op fallback.');
      conversationContextWarned = true;
    }
    return { history: [], addInteraction: () => {} };
  }
  return ctx;
}
