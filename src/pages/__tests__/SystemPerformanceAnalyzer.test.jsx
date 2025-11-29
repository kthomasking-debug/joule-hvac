/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { averageHourlyRows } from '../../lib/csvUtils';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

// Partial mock of react-router-dom to provide a working useOutletContext while keeping MemoryRouter
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useOutletContext: vi.fn(() => ({ setHeatLossFactor: vi.fn() })),
    };
});
import * as rr from 'react-router-dom';
import SystemPerformanceAnalyzer from '../SystemPerformanceAnalyzer';

describe('averageHourlyRows helper', () => {
    it('averages numeric columns and picks the mode for non-numeric columns per hour', () => {
        const rows = [
            { Date: '2025-01-01', Time: '00:00:00', 'Outdoor Temp (F)': '20', 'Thermostat Temperature (F)': '70', Mode: 'heat' },
            { Date: '2025-01-01', Time: '00:15:00', 'Outdoor Temp (F)': '21', 'Thermostat Temperature (F)': '69.9', Mode: 'heat' },
            { Date: '2025-01-01', Time: '01:00:00', 'Outdoor Temp (F)': '18', 'Thermostat Temperature (F)': '70.5', Mode: 'heat' },
            { Date: '2025-01-02', Time: '00:30:00', 'Outdoor Temp (F)': '22', 'Thermostat Temperature (F)': '70.1', Mode: 'heat' }
        ];

        const averaged = averageHourlyRows(rows);

        // We expect 3 groups: 2025-01-01 00, 2025-01-01 01, 2025-01-02 00
        expect(averaged.length).toBe(3);

        // Find the 2025-01-01 00 group
        const g00 = averaged.find(r => r.Date === '2025-01-01' && r.Time.startsWith('00'));
        expect(g00).toBeDefined();
        expect(Number(g00['Outdoor Temp (F)'])).toBeCloseTo(20.5, 2);
        expect(Number(g00['Thermostat Temperature (F)'])).toBeCloseTo(69.95, 2);
        expect(g00.Mode).toBe('heat');

        const g0101 = averaged.find(r => r.Date === '2025-01-01' && r.Time.startsWith('01'));
        expect(Number(g0101['Outdoor Temp (F)'])).toBeCloseTo(18, 2);

        const g0200 = averaged.find(r => r.Date === '2025-01-02' && r.Time.startsWith('00'));
        expect(Number(g0200['Outdoor Temp (F)'])).toBeCloseTo(22, 2);
    });

    it('shows heat loss tooltip content when toggled', async () => {
        // Provide a mocked outlet context so useOutletContext() returns a valid object
        const mockUseOutletContext = vi.fn(() => ({ setHeatLossFactor: vi.fn() }));
        vi.spyOn(rr, 'useOutletContext').mockImplementation(mockUseOutletContext);
        render(
            <MemoryRouter>
                <SystemPerformanceAnalyzer />
            </MemoryRouter>
        );

        // Expand the manual estimator
        const toggle = await screen.findByText(/Use Manual Estimator/i);
        fireEvent.click(toggle);

        // Find the help button and click it
        const helpButton = await screen.findByLabelText(/More about dynamic effects/i);
        expect(helpButton).toBeInTheDocument();
        fireEvent.click(helpButton);

        // Tooltip content should be visible after clicking
        const tooltip = await screen.findByText(/Why this is an estimate/i);
        expect(tooltip).toBeInTheDocument();
    });
});
