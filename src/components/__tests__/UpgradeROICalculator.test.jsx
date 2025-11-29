// src/components/__tests__/UpgradeROICalculator.test.jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import UpgradeROICalculator from '../UpgradeROICalculator';
import userEvent from '@testing-library/user-event';

describe('UpgradeROICalculator', () => {
  it('renders component with default selected scenarios', () => {
    render(<UpgradeROICalculator />);

    expect(screen.getByText(/Upgrade ROI Calculator/i)).toBeInTheDocument();
    // Heat Pump appears both as button and table row, check for multiple
    expect(screen.getAllByText(/Heat Pump Upgrade/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Attic Insulation/i).length).toBeGreaterThan(0);
  });

  it('displays comparison table with payback and ROI', () => {
    render(<UpgradeROICalculator />);

    // Check table headers
    expect(screen.getByText(/Payback \(yrs\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Lifetime ROI/i)).toBeInTheDocument();
    expect(screen.getByText(/Net Cost/i)).toBeInTheDocument();

    // Check for default scenarios in table
    const heatPumpRows = screen.getAllByText(/Heat Pump Upgrade/i);
    expect(heatPumpRows.length).toBeGreaterThan(0);
  });

  it('allows toggling scenarios on and off', async () => {
    const user = userEvent.setup();
    render(<UpgradeROICalculator />);

    // Find the Solar Panel System button (not selected by default)
    const solarButton = screen.getByRole('button', { name: /Solar Panel System/i });

    // Initially should have muted styling
    expect(solarButton).toHaveClass('bg-gray-200');

    // Click to select
    await user.click(solarButton);

    // Now should have active styling
    expect(solarButton).toHaveClass('bg-blue-600');
  });
});
