import { computeAnnualPrecisionEstimate } from '../fullPrecisionEstimate';

test('returns near-zero energy and cost when indoor equals outdoor for all hours', async () => {
  const settings = {
    tons: 2.5,
    compressorPower: 2.0,
    utilityCost: 0.15,
    seer2: 15.0,
    hspf2: 9.0,
    useElectricAuxHeat: true,
  };
  // Create a monthly profile where high==low==70, matching indoor setpoint
  const monthlyProfile = Array(12).fill({ low: 70, high: 70 });
  const res = await computeAnnualPrecisionEstimate(settings, { monthlyProfile, winterThermostat: 70, summerThermostat: 70 });
  expect(res.totalEnergy).toBeGreaterThanOrEqual(0);
  expect(res.totalEnergy).toBeLessThan(0.1); // negligible energy
  expect(res.totalCost).toBeGreaterThanOrEqual(0);
  expect(res.totalCost).toBeLessThan(0.1); // negligible cost
});
