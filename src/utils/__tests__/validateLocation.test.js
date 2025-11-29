import { describe, it, expect } from 'vitest';
import needsCommaBetweenCityAndState from '../validateLocation';

describe('needsCommaBetweenCityAndState', () => {
    it('returns true for "Blairsville GA" (missing comma)', () => {
        expect(needsCommaBetweenCityAndState('Blairsville GA')).toBe(true);
    });

    it('returns true for lowercase "blairsville ga"', () => {
        expect(needsCommaBetweenCityAndState('blairsville ga')).toBe(true);
    });

    it('returns false for "Blairsville, GA"', () => {
        expect(needsCommaBetweenCityAndState('Blairsville, GA')).toBe(false);
    });

    it('returns false for single-token city "Denver"', () => {
        expect(needsCommaBetweenCityAndState('Denver')).toBe(false);
    });

    it('returns false for international 2-letter token (Paris FR)', () => {
        expect(needsCommaBetweenCityAndState('Paris FR')).toBe(false);
    });

    it('returns true for "Charleston South Carolina" (last token full state name missing comma)', () => {
            expect(needsCommaBetweenCityAndState('Charleston South Carolina')).toBe(true);
    });

    it('returns false for "Charleston, South Carolina"', () => {
        expect(needsCommaBetweenCityAndState('Charleston, South Carolina')).toBe(false);
    });
        it('returns true for "Washington DC" (abbrev)', () => {
            expect(needsCommaBetweenCityAndState('Washington DC')).toBe(true);
        });
        it('returns false for "Washington, DC"', () => {
            expect(needsCommaBetweenCityAndState('Washington, DC')).toBe(false);
        });
});
