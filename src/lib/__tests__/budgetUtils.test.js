import { describe, it, expect } from 'vitest';
import { estimateMonthlyCoolingCostFromCDD, estimateAnnualCoolingCostFromTypicalCDD, estimateMonthlyHeatingCostFromHDD, estimateAnnualCostFromMonthlyTypical } from '../budgetUtils';

describe('budgetUtils', () => {
  it('estimateMonthlyCoolingCostFromCDD returns numeric cost and energy', () => {
    const res = estimateMonthlyCoolingCostFromCDD({ cdd: 300, squareFeet: 1500, insulationLevel: 1.0, homeShape: 1.0, ceilingHeight: 8, capacity: 36, seer2: 10, electricityRate: 0.15, solarExposure: 1.0 });
    expect(res).toHaveProperty('cost');
    expect(res.cost).toBeGreaterThan(0);
    expect(res.energy).toBeGreaterThan(0);
  });

  it('estimateAnnualCoolingCostFromTypicalCDD sums months and returns cost', () => {
    const res = estimateAnnualCoolingCostFromTypicalCDD({ squareFeet: 1500, insulationLevel: 1.0, homeShape: 1.0, ceilingHeight: 8, capacity: 36, seer2: 10, electricityRate: 0.15, solarExposure: 1.0 });
    expect(res.cost).toBeGreaterThan(0);
    expect(res.monthsCounted).toBeGreaterThan(0);
  });

  it('estimateMonthlyHeatingCostFromHDD returns numeric cost and energy', () => {
    const res = estimateMonthlyHeatingCostFromHDD({ hdd: 800, squareFeet: 1500, insulationLevel: 1.0, homeShape: 1.0, ceilingHeight: 8, hspf: 10, electricityRate: 0.15 });
    expect(res).toHaveProperty('cost');
    expect(res.cost).toBeGreaterThan(0);
    expect(res.energy).toBeGreaterThan(0);
    expect(res.days).toBe(30);
  });

  it('estimateAnnualCostFromMonthlyTypical sums monthly estimates', () => {
    const res = estimateAnnualCostFromMonthlyTypical({ squareFeet: 1500, insulationLevel: 1.0, homeShape: 1.0, ceilingHeight: 8, capacity: 36, seer2: 10, electricityRate: 0.15, solarExposure: 1.0 });
    expect(res).toHaveProperty('cost');
    expect(res.cost).toBeGreaterThan(0);
    expect(res).toHaveProperty('heatingCost');
    expect(res).toHaveProperty('coolingCost');
  });
});
