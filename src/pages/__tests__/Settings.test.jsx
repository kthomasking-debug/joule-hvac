/** @vitest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// Mock useOutletContext so the Settings page renders with heat pump selected
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: vi.fn(() => ({
      primarySystem: 'heatPump',
      setPrimarySystem: vi.fn(),
      winterThermostat: 70,
      setWinterThermostat: vi.fn(),
      summerThermostat: 74,
      setSummerThermostat: vi.fn(),
      useDetailedAnnualEstimate: false,
      setUseDetailedAnnualEstimate: vi.fn(),
      useElectricAuxHeat: true,
      setUseElectricAuxHeat: vi.fn(),
    }))
  };
});

import SettingsPage from '../Settings';
import { describe, it, expect } from 'vitest';

describe('Settings placeholder', () => {
  it('has a passing placeholder', () => {
    expect(true).toBe(true);
  });
  it('renders useElectricAuxHeat toggle', async () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    const label = await screen.findByText(/Use electric auxiliary heat in heat pump mode/i);
    expect(label).toBeInTheDocument();
    // Verify checkbox has proper aria-label for accessibility
    const checkbox = await screen.findByRole('checkbox', { name: /Include electric auxiliary resistance heat in energy and cost estimates|Use electric auxiliary heat in heat pump mode/i });
    expect(checkbox).toBeInTheDocument();
  });
});
