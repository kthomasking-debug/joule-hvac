import { describe, test, expect } from 'vitest';
import { parseAskJoule } from '../../components/AskJoule.jsx';

describe('parseAskJoule', () => {
  test('parses city, sqft, insulation, temp', () => {
    const q = 'I live in Atlanta, GA in a 2,000 sq ft house with average insulation, keep it at 70 next week';
    const r = parseAskJoule(q);
    expect(r.cityName).toBe('Atlanta, GA');
    expect(r.squareFeet).toBe(2000);
    expect(r.insulationLevel).toBe(1.0);
    expect(r.indoorTemp).toBe(70);
  });

  test('parses k-suffix sqft and good insulation and explicit °F', () => {
    const q = 'in Boston 1.8k square feet good insulation set it to 68°F';
    const r = parseAskJoule(q);
    expect(r.cityName).toBe('Boston');
    expect(r.squareFeet).toBe(1800);
    expect(r.insulationLevel).toBe(0.65);
    expect(r.indoorTemp).toBe(68);
  });

  test('parses system and mode hints', () => {
    const q = 'keep it warm in Denver, CO with poor insulation and 2500 sf gas furnace';
    const r = parseAskJoule(q);
    expect(r.cityName).toBe('Denver, CO');
    expect(r.squareFeet).toBe(2500);
    expect(r.insulationLevel).toBe(1.4);
    expect(r.primarySystem).toBe('gasFurnace');
    expect(r.energyMode).toBe('heating');
  });

  test('parses cooling and heat pump', () => {
    const q = 'Austin keep it cool 2000 sqft heat pump at 72';
    const r = parseAskJoule(q);
    expect(r.cityName).toBe('Austin');
    expect(r.squareFeet).toBe(2000);
    expect(r.primarySystem).toBe('heatPump');
    expect(r.energyMode).toBe('cooling');
    expect(r.indoorTemp).toBe(72);
  });

  test('leaves temperature undefined if out-of-range', () => {
    const q = 'in Reno at 40 F 1800 sf';
    const r = parseAskJoule(q);
    expect(r.cityName).toBe('Reno');
    expect(r.indoorTemp).toBeUndefined();
  });

  test('handles missing location without failing', () => {
    const q = '2000 sq ft average insulation set to 70';
    const r = parseAskJoule(q);
    expect(r.cityName).toBeUndefined();
    expect(r.squareFeet).toBe(2000);
    expect(r.insulationLevel).toBe(1.0);
    expect(r.indoorTemp).toBe(70);
  });
});
