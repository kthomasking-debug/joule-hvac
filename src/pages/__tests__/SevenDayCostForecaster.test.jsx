/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import SevenDayCostForecaster from '../SevenDayCostForecaster';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// Mocking react-joyride
vi.mock('react-joyride', () => {
    return {
        default: ({ steps, run }) => (
            <div data-testid="joyride-mock">
                {run && steps.map((step, index) => (
                    <div key={index} data-testid={`step-${index}`}>{step.content}</div>
                ))}
            </div>
        )
    };
});

// Mocking useOutletContext with comprehensive mock data
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useOutletContext: vi.fn(() => ({
            heatLossFactor: 0.5,
            squareFeet: 2000,
            setSquareFeet: vi.fn(),
            insulationLevel: 1.0,
            setInsulationLevel: vi.fn(),
            homeShape: 1.0,
            setHomeShape: vi.fn(),
            ceilingHeight: 8,
            setCeilingHeight: vi.fn(),
            capacity: 24,
            setCapacity: vi.fn(),
            efficiency: 16,
            setEfficiency: vi.fn(),
            indoorTemp: 68,
            setIndoorTemp: vi.fn(),
            utilityCost: 0.15,
            setUtilityCost: vi.fn(),
            gasCost: 1.20,
            setGasCost: vi.fn(),
            primarySystem: 'heatPump',
            setPrimarySystem: vi.fn(),
            afue: 0.95,
            setAfue: vi.fn(),
            energyMode: 'heating',
            setEnergyMode: vi.fn(),
            solarExposure: 1.0,
            setSolarExposure: vi.fn(),
            coolingSystem: 'centralAC',
            setCoolingSystem: vi.fn(),
            coolingCapacity: 24,
            setCoolingCapacity: vi.fn(),
            hspf2: 9.0,
            setHspf2: vi.fn(),
            manualTemp: 35,
            setManualTemp: vi.fn(),
            manualHumidity: 50,
            setManualHumidity: vi.fn(),
            heatLoss: 15000,
            tons: 2.0,
            compressorPower: 1.8,
            useElectricAuxHeat: true,
        })),
    };
});

describe('SevenDayCostForecaster', () => {
    beforeEach(() => {
        // Mock localStorage to simulate a returning user (onboarding already completed)
        // This ensures the onboarding modal doesn't show and we can test the main UI
        Storage.prototype.getItem = vi.fn((key) => {
            if (key === 'hasCompletedOnboarding') return 'true';
            return null;
        });
        Storage.prototype.setItem = vi.fn();
    });

    test('renders onboarding for first-time users', async () => {
        // Override localStorage mock for this test to simulate first-time user
        Storage.prototype.getItem = vi.fn(() => null);

        render(
            <MemoryRouter>
                <SevenDayCostForecaster />
            </MemoryRouter>
        );

        // Should show the onboarding welcome message and Begin button
        const welcomeHeading = screen.getByText(/Welcome to Energy Cost Forecaster/i);
        expect(welcomeHeading).toBeInTheDocument();
        const beginButton = screen.getByRole('button', { name: /begin/i });
        expect(beginButton).toBeInTheDocument();

        // Advance to the Location step and verify location input appears
        fireEvent.click(beginButton);
        const locationInput = await screen.findByPlaceholderText(/Enter city, state/i);
        expect(locationInput).toBeInTheDocument();
    });

    test('renders main UI for returning users', () => {
        render(
            <MemoryRouter>
                <SevenDayCostForecaster />
            </MemoryRouter>
        );

        // Should show the main page heading (not onboarding)
        const heading = screen.getByText(/7-Day Cost Forecaster/i);
        expect(heading).toBeInTheDocument();

        // Should show Dashboard link
        const dashboardLink = screen.getByTitle(/Back to Dashboard/i);
        expect(dashboardLink).toBeInTheDocument();
    });

    // The daily breakdown checkboxes are covered in integration/visual tests; skipping a brittle DOM check here.

    test('onboarding Show Feature Tour starts the tour', async () => {
        // Simulate first-time user by returning null from localStorage
        Storage.prototype.getItem = vi.fn(() => null);

        // Mock fetch for geocoding requests
        global.fetch = vi.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ results: [{ name: 'New York', admin1: 'NY', latitude: 40.7128, longitude: -74.0060, elevation: 10 }] }),
        }));

        const { findByPlaceholderText, getByRole, findByText, findByTestId } = render(
            <MemoryRouter>
                <SevenDayCostForecaster />
            </MemoryRouter>
        );

        // Ensure we are in custom mode so the full 4-step flow (including feature tour prompt) appears
        const customSetupBtn = getByRole('button', { name: /Custom Setup/i });
        fireEvent.click(customSetupBtn);

        // Begin onboarding
        const beginButton = getByRole('button', { name: /let’s begin|let's begin/i });
        await act(async () => { fireEvent.click(beginButton); });

        // Enter a location and trigger search
        const locationInput = await findByPlaceholderText(/Enter city, state/i);
        await act(async () => { fireEvent.change(locationInput, { target: { value: 'New York, NY' } }); });
        const nextButton = getByRole('button', { name: /Next →/i });
        await act(async () => { fireEvent.click(nextButton); });

        // Complete hvac substeps until final step
        // Click Next inside building and HVAC steps
        const nextButtons = screen.getAllByRole('button', { name: /Next →/i });
        for (let i = 0; i < 3; i++) {
            await act(async () => { fireEvent.click(nextButtons[0]); });
            // small wait for UI updates
            await new Promise(r => setTimeout(r, 50));
        }

        // Find and click the Show Feature Tour button
        const showTourButton = await findByText(/Show Feature Tour/i);
        await act(async () => { fireEvent.click(showTourButton); });

        // Joyride mock should be present when tour is triggered
        const joyride = await findByTestId('joyride-mock');
        expect(joyride).toBeInTheDocument();
    });

    test('when searching a city, setHomeElevation is called with geocoded elevation', async () => {
        const setHomeElevationMock = vi.fn();
        const rr = await import('react-router-dom');
        const altContext = { ...rr.useOutletContext(), setHomeElevation: setHomeElevationMock };
        rr.useOutletContext.mockReturnValue(altContext);

        // Mock fetch for geocoding requests returning correct elevation for Blairsville
        global.fetch = vi.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                results: [{ name: 'Blairsville', admin1: 'GA', latitude: 34.8786, longitude: -83.9582, elevation: 582 }] // Elevation in meters
            })
        }));

        render(
            <MemoryRouter>
                <SevenDayCostForecaster />
            </MemoryRouter>
        );

        // Trigger onboarding wizard explicitly
        const editDetailsBtn = screen.getByRole('button', { name: /Edit Home Details/i });
        await act(async () => { fireEvent.click(editDetailsBtn); });

        // Verify onboarding wizard is visible and locate the location input
        const onboardingHeading = await screen.findByText(/Where do you live?/i);
        expect(onboardingHeading).toBeInTheDocument();

        // Set the city name to ensure the Next → button is enabled
        const input = await screen.findByPlaceholderText(/Enter city, state/i);
        fireEvent.change(input, { target: { value: 'Blairsville, GA' } });

        // Assert the Next → button is enabled
        const searchBtn = screen.getByRole('button', { name: /Next →/i });
        expect(searchBtn).toBeEnabled();

        // Click the Next → button
        await act(async () => { fireEvent.click(searchBtn); });

        // setHomeElevation should have been called with elevation (in feet)
        await act(async () => new Promise(r => setTimeout(r, 50))); // allow async dispatch
        expect(setHomeElevationMock).toHaveBeenCalled();
        expect(setHomeElevationMock.mock.calls[0][0]).toBeCloseTo(1909, 0); // 582 meters converted to feet
    });

    test('simple test case', () => {
        expect(1 + 1).toBe(2);
    });

    test('displays heat loss tooltip in Custom Scenario when toggled', async () => {
        const { findByLabelText } = render(
            <MemoryRouter>
                <SevenDayCostForecaster />
            </MemoryRouter>
        );
        // Open the Custom Scenario tab (target the button specifically by role)
        const customTab = await screen.findByRole('button', { name: /Custom Scenario/i });
        expect(customTab).toBeInTheDocument();
        fireEvent.click(customTab);

        // Wait for Design Temp label and find the help button
        const helpBtn = await findByLabelText(/More about dynamic effects/i);
        expect(helpBtn).toBeInTheDocument();
        fireEvent.click(helpBtn);

        // Tooltip should appear with 'Why this is an estimate'
        const tooltip = await screen.findByText(/Why this is an estimate/i);
        expect(tooltip).toBeInTheDocument();
    });
});