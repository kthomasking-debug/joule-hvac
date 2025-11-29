import { describe, it, expect } from 'vitest';
import { computeHourlyRate, computeHourlyCost } from './costUtils';

describe('costUtils', () => {
  it('returns flat rate when no schedule provided', () => {
    const dt = new Date('2025-11-07T12:00:00');
    const flat = 0.12;
    expect(computeHourlyRate(dt, [], flat)).toBe(flat);
    expect(computeHourlyCost(2.5, dt, [], flat)).toBeCloseTo(2.5 * flat, 8);
  });

  it('handles overnight spans (start > end) and applies price across midnight', () => {
    const schedule = [{ start: '22:00', end: '06:00', price: 0.50 }];
    const flat = 0.10;

    const late = new Date('2025-11-07T23:30:00'); // 23:30 should match
    const early = new Date('2025-11-08T05:15:00'); // 05:15 next day should match
    const midday = new Date('2025-11-08T12:00:00'); // midday should not match

    expect(computeHourlyRate(late, schedule, flat)).toBe(0.50);
    expect(computeHourlyRate(early, schedule, flat)).toBe(0.50);
    expect(computeHourlyRate(midday, schedule, flat)).toBe(flat);

    expect(computeHourlyCost(1.2, late, schedule, flat)).toBeCloseTo(1.2 * 0.50, 8);
  });

  it('resolves overlaps using last-defined-wins', () => {
    const schedule = [
      { start: '16:00', end: '20:00', price: 0.20, days: ['Mon','Tue','Wed','Thu','Fri'] },
      { start: '17:00', end: '19:00', price: 0.40, days: ['Mon','Tue','Wed','Thu','Fri'] }, // overlaps and should win
    ];
    // pick a Wednesday at 17:30
    const dt = new Date('2025-11-05T17:30:00');
    const flat = 0.08;
    expect(computeHourlyRate(dt, schedule, flat)).toBe(0.40);
    expect(computeHourlyCost(3, dt, schedule, flat)).toBeCloseTo(3 * 0.40, 8);
  });
});
