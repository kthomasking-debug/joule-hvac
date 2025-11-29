import { describe, it, expect } from 'vitest';
import { getSuggestedRate } from '../rateSuggestions.js';

describe('rateSuggestions', () => {
  it('returns suggestion for known utility', () => {
    expect(getSuggestedRate('Consolidated Edison Co-NY Inc')).toBeCloseTo(0.24);
  });
  it('returns null for unknown utility', () => {
    expect(getSuggestedRate('Unknown Utility Name')).toBeNull();
  });
});
