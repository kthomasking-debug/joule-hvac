import { describe, it, expect } from 'vitest';
import { parseOpenEiData } from '../rateFinder.js';

describe('parseOpenEiData', () => {
  it('parses IURDB-style items with a TOU schedule', () => {
    const data = {
      items: [
        {
          utility: 'Consolidated Edison Co-NY Inc',
          uri: 'https://apps.openei.org/IURDB/rate/view/59bc04315457a3200842da68',
          energyratestructure: [
            {
              rate_type: 'SC-2 - General Small Time-Of-Day [NYC]',
              schedule: [
                {
                  month: 7,
                  day_of_week: 'weekday',
                  tiers: [
                    { tier_name: 'OnPeak', rate: 0.30, start_hour: 14, end_hour: 20 },
                    { tier_name: 'OffPeak', rate: 0.12, start_hour: 0, end_hour: 14 }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };

    const parsed = parseOpenEiData(data);
    expect(parsed).not.toBeNull();
    expect(parsed.touRates).toBeDefined();
    expect(parsed.touRates.length).toBeGreaterThan(0);
    expect(parsed.utilityName).toContain('Consolidated Edison');
  });

  it('parses a top-level flat rate from items', () => {
    const data = {
      items: [
        {
          utility_name: 'Example Utility',
          flatratebuy: 0.15
        }
      ]
    };

    const parsed = parseOpenEiData(data);
    expect(parsed).not.toBeNull();
    expect(parsed.flatRate).toBeCloseTo(0.15);
  });
  it('should return the most recent expired rate with an "outdated" flag if all rates are expired', () => {
    const now = new Date();
    const oneYearAgo = new Date(now.getTime());
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    const twoYearsAgo = new Date(now.getTime());
    twoYearsAgo.setFullYear(now.getFullYear() - 2);
    const threeYearsAgo = new Date(now.getTime());
    threeYearsAgo.setFullYear(now.getFullYear() - 3);

    const mockApiResponse = {
      items: [
        {
          utility: 'Older Expired Utility',
          sector: 'Residential',
          approved: true,
          enddate: Math.floor(twoYearsAgo.getTime() / 1000), // Expired 2 years ago
          energyrates: { flatrate: 0.10 }
        },
        {
          utility: 'Most Recent Expired Utility',
          sector: 'Residential',
          approved: true,
          enddate: Math.floor(oneYearAgo.getTime() / 1000), // Expired 1 year ago
          energyrates: { flatrate: 0.15 }
        },
        {
          utility: 'Current Commercial Rate',
          sector: 'Commercial', // Should be ignored
          approved: true,
          enddate: Math.floor(threeYearsAgo.getTime() / 1000), // Expired 3 years ago
        }
      ]
    };

    const result = parseOpenEiData(mockApiResponse);
    console.log('DEBUG parseOpenEiData result:', result);

    expect(result).not.toBeNull();
    // Key Assertions for the new logic
    expect(result.outdated).toBe(true);
    expect(result.utilityName).toBe('Most Recent Expired Utility');
    // Compare lastKnownEnd up to seconds, ignore milliseconds
    const expectedEnd = new Date(oneYearAgo.getTime()).toISOString().split('.')[0];
    const actualEnd = result.lastKnownEnd.split('.')[0];
    expect(actualEnd).toBe(expectedEnd);
    // Ensure it still parsed the data from the chosen rate
    expect(result.flatRate).toBe(0.15);
  });
});
