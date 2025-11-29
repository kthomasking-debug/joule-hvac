import { describe, it, expect } from 'vitest';
import { calculateAnnualHeatingCostFromHDD } from './hddData';

describe('hddData', () => {
  it('includes aux energy when useElectricAuxHeat is true and excludes when false', () => {
    const annualHDD = 6000;
    const heatLossFactor = 500; // BTU/hr/°F
    const hspf2 = 8; // HSPF2
    const utilityCost = 0.1; // $/kWh

    const resIncluded = calculateAnnualHeatingCostFromHDD(annualHDD, heatLossFactor, hspf2, utilityCost, true);
    const resExcluded = calculateAnnualHeatingCostFromHDD(annualHDD, heatLossFactor, hspf2, utilityCost, false);

    // Basic sanity
    expect(resIncluded.energy).toBeGreaterThan(resExcluded.energy);
    expect(resIncluded.auxKwhIncluded).toBeGreaterThan(0);
    expect(resIncluded.auxKwhExcluded).toBeCloseTo(0);
    expect(resExcluded.auxKwhExcluded).toBeGreaterThan(0);
    expect(resExcluded.auxKwhIncluded).toBeCloseTo(0);

    // Recompute expected values using the same formula as the module
    const annualDegreeHours = annualHDD * 24;
    const annualHeatLossBtu = annualDegreeHours * heatLossFactor;
    const baselineHpKwh = annualHeatLossBtu / (hspf2 * 1000);
    const auxFraction = Math.min(0.5, Math.max(0, (annualHDD - 3000) / 12000));
    const hpKwh = (1 - auxFraction) * baselineHpKwh;
    const auxKwh = (auxFraction * annualHeatLossBtu) / 3412.14;

    const expectedIncluded = hpKwh + auxKwh;
    const expectedExcluded = hpKwh;

    expect(resIncluded.energy).toBeCloseTo(expectedIncluded, 2);
    expect(resExcluded.energy).toBeCloseTo(expectedExcluded, 2);
  });

  it('returns zero energy for missing inputs', () => {
    const res = calculateAnnualHeatingCostFromHDD(null, null, null, null, true);
    expect(res.cost).toBe(0);
    expect(res.energy).toBe(0);
  });
});
