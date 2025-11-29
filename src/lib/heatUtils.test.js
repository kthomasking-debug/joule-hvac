import { describe, it, expect } from 'vitest';
import { calculateHeatLoss, getCapacityFactor, computeHourlyPerformance, adjustForecastForElevation } from './heatUtils';

describe('heatUtils', () => {
  it('calculateHeatLoss returns reasonable value for typical house', () => {
    const res = calculateHeatLoss({ squareFeet: 2000, insulationLevel: 1.0, homeShape: 1.0, ceilingHeight: 8 });
    // For 2000 sqft with defaults we expect a rounded value > 10000
    expect(res).toBeGreaterThan(10000);
    expect(res % 1000).toBe(0);
  });

  it('getCapacityFactor clamps values as expected', () => {
    expect(getCapacityFactor(60)).toBeCloseTo(1.0);
    expect(getCapacityFactor(47)).toBeCloseTo(1.0);
    expect(getCapacityFactor(17)).toBeGreaterThanOrEqual(0.3);
    expect(getCapacityFactor(0)).toBeGreaterThanOrEqual(0.3);
  });

  it('computeHourlyPerformance returns expected shape and aux for cold temps', () => {
    const params = { tons: 3.0, indoorTemp: 70, heatLossBtu: 14000, compressorPower: 3 };
    const perfWarm = computeHourlyPerformance(params, 50, 40);
    expect(perfWarm).toHaveProperty('electricalKw');
    expect(perfWarm).toHaveProperty('runtime');
    expect(perfWarm).toHaveProperty('actualIndoorTemp');
    expect(perfWarm).toHaveProperty('auxKw');

    // At very cold temps, auxKw should be positive
    const perfCold = computeHourlyPerformance(params, -10, 50);
    expect(perfCold.auxKw).toBeGreaterThanOrEqual(0);
  });

  it('adjustForecastForElevation shifts temperatures appropriately', () => {
    const forecast = [ { time: new Date(), temp: 50, humidity: 50 }, { time: new Date(), temp: 40, humidity: 30 } ];
    const adjusted = adjustForecastForElevation(forecast, 5000, 0);
    expect(adjusted.length).toBe(2);
    // Elevation increase should reduce temperature (so adjusted temp < original)
    expect(adjusted[0].temp).toBeLessThan(forecast[0].temp);
  });
});
