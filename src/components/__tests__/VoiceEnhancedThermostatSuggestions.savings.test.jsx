import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import VoiceEnhancedThermostatSuggestions from '../VoiceEnhancedThermostatSuggestions';
import { getAccount, resetAccount } from '../../lib/savings/savingsAccount';

// Mock learning events to trigger suggestion
const mockEvents = [
  { kind: 'winter', ts: new Date().toISOString(), hour: 6, prev: 68, next: 71 },
  { kind: 'winter', ts: new Date(Date.now() - 2*24*60*60*1000).toISOString(), hour: 6, prev: 68, next: 71 },
  { kind: 'winter', ts: new Date(Date.now() - 4*24*60*60*1000).toISOString(), hour: 6, prev: 68, next: 71 },
];

// Patch hook import target
vi.mock('../../hooks/useThermostatLearning', () => ({
  getThermostatLearningEvents: () => mockEvents
}));

// Voice feedback mock
vi.mock('../../hooks/useVoiceFeedback', () => ({
  default: () => ({ speak: () => {}, humanize: async (t) => t, isSpeaking: false })
}));

const store = {};

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  global.localStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k,v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; }
  };
  resetAccount();
});

describe('VoiceEnhancedThermostatSuggestions savings hook', () => {
  it('records a savings event when automation applied', () => {
    render(<VoiceEnhancedThermostatSuggestions currentWinter={70} estimatedSavings={8} onApply={() => {}} />);
    const btn = screen.getByText('Yes, Automate It');
    fireEvent.click(btn);
    const acct = getAccount();
    expect(acct.events.length).toBe(1);
    expect(acct.events[0].meta.kind).toBe('morning-warmup');
    expect(acct.totalSavings).toBeGreaterThan(0);
  });
});
