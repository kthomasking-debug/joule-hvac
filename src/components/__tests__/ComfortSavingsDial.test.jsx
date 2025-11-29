/* @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { computeSavingsIndex } from '../../components/ComfortSavingsDial';

describe('ComfortSavingsDial.computeSavingsIndex', () => {
  it('returns ~50 for baseline 70/74, SEER 15, HSPF 9', () => {
    const idx = computeSavingsIndex({ winterThermostat: 70, summerThermostat: 74, seer: 15, hspf: 9 });
    expect(idx).toBeGreaterThanOrEqual(48);
    expect(idx).toBeLessThanOrEqual(52);
  });

  it('increases with colder winter and warmer summer settings', () => {
    const base = computeSavingsIndex({ winterThermostat: 70, summerThermostat: 74, seer: 15, hspf: 9 });
    const better = computeSavingsIndex({ winterThermostat: 66, summerThermostat: 76, seer: 15, hspf: 9 });
    expect(better).toBeGreaterThan(base);
  });

  it('nudges up with higher efficiency', () => {
    const base = computeSavingsIndex({ winterThermostat: 70, summerThermostat: 74, seer: 15, hspf: 9 });
    const eff = computeSavingsIndex({ winterThermostat: 70, summerThermostat: 74, seer: 18, hspf: 10 });
    expect(eff).toBeGreaterThan(base);
  });
});
