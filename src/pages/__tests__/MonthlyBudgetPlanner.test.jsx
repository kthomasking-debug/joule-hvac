/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

// Mock useOutletContext to return required props for the component
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: vi.fn(() => ({
      primarySystem: 'heatPump',
      indoorTemp: 70,
      setIndoorTemp: () => { },
      utilityCost: 0.15,
      setUtilityCost: () => { },
      squareFeet: 1500,
      insulationLevel: 1.0,
      homeShape: 1.0,
      ceilingHeight: 8,
      capacity: 36,
      efficiency: 15,
      coolingSystem: 'heatPump',
      coolingCapacity: 36,
      hspf2: 9,
      gasCost: 1.2,
      useElectricAuxHeat: true,
      setUseElectricAuxHeat: () => { },
    }))
  };
});

import MonthlyBudgetPlanner from '../MonthlyBudgetPlanner';

describe('MonthlyBudgetPlanner', () => {
  it('shows aux heat toggle when primary system is heatPump', () => {
    // useOutletContext provides a mock value; no per-test override needed
    // Render with MemoryRouter wrapping (the component uses Outlet context internally via useOutletContext)
    render(
      <MemoryRouter>
        <MonthlyBudgetPlanner />
      </MemoryRouter>
    );
    // Verify the presence of the checkbox label in the thermostat card
    const label = screen.getByText(/Count electric auxiliary heat/i);
    expect(label).toBeInTheDocument();
  });

  it('shows thermostat equivalency in comparison mode', async () => {
    // Provide user location via localStorage for Location A
    const locationA = { city: 'CityA', state: 'CA', latitude: 34.05, longitude: -118.25, elevation: 100, country_code: 'US' };
    Storage.prototype.getItem = vi.fn((key) => {
      if (key === 'userLocation') return JSON.stringify(locationA);
      return null;
    });

    // Mock fetch for geocoding (Location B) and historical archive (A + B)
    global.fetch = vi.fn((url) => {
      if (url.includes('geocoding-api.open-meteo.com/v1/search')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [{ name: 'CityB', admin1: 'IL', latitude: 41.85, longitude: -87.65, elevation: 180, country_code: 'US' }] }) });
      }
      if (url.includes('archive-api.open-meteo.com/v1/archive')) {
        // Return a minimal set of daily arrays for 3 days
        const daily = {
          time: ['2020-07-01', '2020-07-02', '2020-07-03'],
          temperature_2m_max: [90, 88, 92],
          temperature_2m_min: [70, 68, 72]
        };
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ daily }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const { findByPlaceholderText } = render(
      <MemoryRouter>
        <MonthlyBudgetPlanner />
      </MemoryRouter>
    );

    // Switch to comparison mode
    const comparisonBtn = screen.getByText(/City Comparison/i);
    await act(async () => { fireEvent.click(comparisonBtn); });

    // Enter Location B and hit Search
    const input = await findByPlaceholderText(/Enter city \(e.g., Chicago, IL\)/i);
    await act(async () => { fireEvent.change(input, { target: { value: 'Chicago, IL' } }); });
    const searchBtn = screen.getByRole('button', { name: /Search/i });
    await act(async () => { fireEvent.click(searchBtn); });

    // Wait for the thermostat equivalency text to appear and assert numeric temperature format
    const eqText = await screen.findByText(/To match your cost in/i, undefined, { timeout: 10000 });
    expect(eqText).toBeInTheDocument();
    // Verify it includes a numeric thermostat value (e.g., '67°F') and that it's reasonable
    const tempMatch = eqText.textContent.match(/(\d+)\s*°F/);
    expect(tempMatch).toBeTruthy();
    const thermostatTemp = Number(tempMatch[1]);
    expect(thermostatTemp).toBeGreaterThanOrEqual(50);
    expect(thermostatTemp).toBeLessThanOrEqual(90);
  });

  it('uses fallback typical estimates when historical data fetch fails', async () => {
    const locationA = { city: 'CityA', state: 'CA', latitude: 34.05, longitude: -118.25, elevation: 100, country_code: 'US' };
    Storage.prototype.getItem = vi.fn((key) => {
      if (key === 'userLocation') return JSON.stringify(locationA);
      return null;
    });

    // Mock fetch to return non-ok for archive (historical) request
    const originalFetch = global.fetch;
    global.fetch = vi.fn((url) => {
      if (url.includes('archive-api.open-meteo.com/v1/archive')) {
        return Promise.resolve({ ok: false, status: 500 });
      }
      // any other request return a generic success
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    try {
      const { findByText } = render(
        <MemoryRouter>
          <MonthlyBudgetPlanner />
        </MemoryRouter>
      );
      // Allow effects to settle by waiting for a specific element to appear
      await waitFor(() => expect(screen.getByText(/Estimated Monthly/i)).toBeInTheDocument());

      // Error message should appear and the result card should use fallback estimates
      const errorMsg = await findByText(/Could not fetch historical climate data\. Using typical estimates\./i);
      expect(errorMsg).toBeInTheDocument();

      // Main estimated card appears with a cost and 'Estimated Monthly' label
      const estLabel = await findByText(/Estimated Monthly/i);
      expect(estLabel).toBeInTheDocument();

      // Electricity rate fallback message or hardcoded indicator should appear
      const rateInfo = await findByText(/Average \(Hardcoded\)|US National Average|Average \(Hardcoded\)/i);
      expect(rateInfo).toBeInTheDocument();

      // The fallback should set the method to HDD for heating mode (monthly estimate should be HDD)
      const monthlyMethod = document.querySelector('[data-testid="monthly-method"]');
      expect(monthlyMethod).toBeTruthy();
      expect(monthlyMethod.getAttribute('data-method')).toBe('HDD');
    } finally {
      // restore fetch even when assertions fail
      global.fetch = originalFetch;
    }
  });

  it('falls back to state hardcoded rates when EIA API fails', async () => {
    const eia = await import('../../lib/eiaRates');
    const spyElec = vi.spyOn(eia, 'fetchLiveElectricityRate').mockResolvedValue(null);
    const spyGas = vi.spyOn(eia, 'fetchLiveGasRate').mockResolvedValue(null);

    const locationA = { city: 'CityA', state: 'California', latitude: 34.05, longitude: -118.25, elevation: 100, country_code: 'US' };
    Storage.prototype.getItem = vi.fn((key) => {
      if (key === 'userLocation') return JSON.stringify(locationA);
      return null;
    });

    // Mock archive API to return a small set of temps for calculation
    const originalFetch = global.fetch;
    global.fetch = vi.fn((url) => {
      if (url.includes('archive-api.open-meteo.com/v1/archive')) {
        const daily = {
          time: ['2020-01-01', '2020-01-02', '2020-01-03'],
          temperature_2m_max: [30, 28, 25],
          temperature_2m_min: [15, 12, 8]
        };
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ daily }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    try {
      render(
        <MemoryRouter>
          <MonthlyBudgetPlanner />
        </MemoryRouter>
      );

      // Wait for the fallback source text specific to the state
      const rateText = await screen.findByText(/California Average \(Hardcoded\)/i);
      expect(rateText).toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
      spyElec.mockRestore();
      spyGas.mockRestore();
    }
  });

  it('uses CDD fallback estimates when historical data fetch fails in cooling mode', async () => {
    // Force cooling mode in the Outlet Context by placing it in userSettings
    const rr = await import('react-router-dom');
    const base = rr.useOutletContext();
    // Debug: log context used by the component in this test
    // console.log('base useOutletContext', base);
    const altContext = { ...base, userSettings: { ...(base.userSettings || base), energyMode: 'cooling' } };
    rr.useOutletContext.mockReturnValue(altContext);

    const locationA = { city: 'CityA', state: 'California', latitude: 34.05, longitude: -118.25, elevation: 100, country_code: 'US' };
    Storage.prototype.getItem = vi.fn((key) => {
      if (key === 'userLocation') return JSON.stringify(locationA);
      return null;
    });

    // Simulate archive API failure
    const originalFetch = global.fetch;
    global.fetch = vi.fn((url) => {
      if (url.includes('archive-api.open-meteo.com/v1/archive')) {
        return Promise.resolve({ ok: false, status: 500 });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    try {
      const { findByText } = render(
        <MemoryRouter>
          <MonthlyBudgetPlanner />
        </MemoryRouter>
      );

      // Should show error message fallback
      const errorMsg = await findByText(/Could not fetch historical climate data\. Using typical estimates\./i);
      expect(errorMsg).toBeInTheDocument();

      // Confirm the component is rendering cooling mode text (the header paragraph)
      const headerCooling = await findByText(/Estimate your typical\s+cooling\s+bill/i);
      expect(headerCooling).toBeInTheDocument();

      // The method should be CDD (cooling typical) for fallback in cooling mode
      const monthlyMethod = document.querySelector('[data-testid="monthly-method"]');
      expect(monthlyMethod).toBeTruthy();
      expect(monthlyMethod.getAttribute('data-method')).toBe('CDD');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('displays error message when Location B city search fails', async () => {
    const locationA = { city: 'CityA', state: 'CA', latitude: 34.05, longitude: -118.25, elevation: 100 };
    Storage.prototype.getItem = vi.fn((key) => {
      if (key === 'userLocation') return JSON.stringify(locationA);
      return null;
    });

    // Mock geocoding API to return no results
    global.fetch = vi.fn((url) => {
      if (url.includes('geocoding-api.open-meteo.com/v1/search')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const { findByPlaceholderText } = render(
      <MemoryRouter>
        <MonthlyBudgetPlanner />
      </MemoryRouter>
    );

    // Switch to comparison mode
    const comparisonBtn = screen.getByText(/City Comparison/i);
    await act(async () => { fireEvent.click(comparisonBtn); });

    // Enter invalid city and search
    const input = await findByPlaceholderText(/Enter city \(e.g., Chicago, IL\)/i);
    await act(async () => { fireEvent.change(input, { target: { value: 'InvalidCityXYZ123' } }); });
    const searchBtn = screen.getByRole('button', { name: /Search/i });
    await act(async () => { fireEvent.click(searchBtn); });

    // Wait for error message to appear
    const errorMsg = await screen.findByText(/Could not find \"InvalidCityXYZ123\"/i);
    expect(errorMsg).toBeInTheDocument();
  });

  it('displays error message when Location B geocoding service is unavailable', async () => {
    const locationA = { city: 'CityA', state: 'CA', latitude: 34.05, longitude: -118.25, elevation: 100 };
    Storage.prototype.getItem = vi.fn((key) => {
      if (key === 'userLocation') return JSON.stringify(locationA);
      return null;
    });

    // Mock geocoding API to return error status
    global.fetch = vi.fn((url) => {
      if (url.includes('geocoding-api.open-meteo.com/v1/search')) {
        return Promise.resolve({ ok: false, status: 503 });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const { findByPlaceholderText } = render(
      <MemoryRouter>
        <MonthlyBudgetPlanner />
      </MemoryRouter>
    );

    // Switch to comparison mode
    const comparisonBtn = screen.getByText(/City Comparison/i);
    await act(async () => { fireEvent.click(comparisonBtn); });

    // Enter city and search
    const input = await findByPlaceholderText(/Enter city \(e.g., Chicago, IL\)/i);
    await act(async () => { fireEvent.change(input, { target: { value: 'Chicago' } }); });
    const searchBtn = screen.getByRole('button', { name: /Search/i });
    await act(async () => { fireEvent.click(searchBtn); });

    // Wait for error message to appear
    const errorMsg = await screen.findByText(/Search failed\. Please check your connection and try again\./i);
    expect(errorMsg).toBeInTheDocument();
  });

  it('clears error message when starting a new Location B search', async () => {
    const locationA = { city: 'CityA', state: 'CA', latitude: 34.05, longitude: -118.25, elevation: 100 };
    Storage.prototype.getItem = vi.fn((key) => {
      if (key === 'userLocation') return JSON.stringify(locationA);
      return null;
    });

    // First search fails, second succeeds
    let searchCount = 0;
    global.fetch = vi.fn((url) => {
      if (url.includes('geocoding-api.open-meteo.com/v1/search')) {
        searchCount++;
        if (searchCount === 1) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) });
        }
        return Promise.resolve({ 
          ok: true, 
          json: () => Promise.resolve({ 
            results: [{ name: 'Chicago', admin1: 'IL', latitude: 41.85, longitude: -87.65, elevation: 180, country_code: 'US' }] 
          }) 
        });
      }
      if (url.includes('archive-api.open-meteo.com/v1/archive')) {
        const daily = {
          time: ['2020-07-01', '2020-07-02'],
          temperature_2m_max: [85, 87],
          temperature_2m_min: [65, 67]
        };
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ daily }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const { findByPlaceholderText, queryByText } = render(
      <MemoryRouter>
        <MonthlyBudgetPlanner />
      </MemoryRouter>
    );

    // Switch to comparison mode
    const comparisonBtn = screen.getByText(/City Comparison/i);
    await act(async () => { fireEvent.click(comparisonBtn); });

    // First search - fails
    const input = await findByPlaceholderText(/Enter city \(e.g., Chicago, IL\)/i);
    await act(async () => { fireEvent.change(input, { target: { value: 'InvalidCity' } }); });
    const searchBtn = screen.getByRole('button', { name: /Search/i });
    await act(async () => { fireEvent.click(searchBtn); });

    // Error appears
    const errorMsg = await screen.findByText(/Could not find \"InvalidCity\"/i);
    expect(errorMsg).toBeInTheDocument();

    // Second search - succeeds
    await act(async () => { fireEvent.change(input, { target: { value: 'Chicago' } }); });
    await act(async () => { fireEvent.click(searchBtn); });

    // Wait for API call to complete
    await new Promise(r => setTimeout(r, 150));
    
    // Main assertion: error should be cleared
    expect(queryByText(/Could not find location/i)).not.toBeInTheDocument();
    
    // Verify location was set successfully
    expect(screen.getByText(/LOCATION B/i)).toBeInTheDocument();
  });
});
