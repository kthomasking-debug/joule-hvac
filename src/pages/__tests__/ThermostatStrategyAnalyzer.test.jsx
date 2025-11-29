/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ThermostatStrategyAnalyzer from '../ThermostatStrategyAnalyzer';

describe('ThermostatStrategyAnalyzer', () => {
  it('renders and calculates results', async () => {
    render(
      <MemoryRouter>
        <ThermostatStrategyAnalyzer />
      </MemoryRouter>
    );

    const calcButton = screen.getByText(/Calculate.*Savings/i);
    expect(calcButton).toBeInTheDocument();

    // Click calculate and expect the verdict hero and results to show
    fireEvent.click(calcButton);
    const verdictCard = await screen.findByTestId('verdict-card');
    expect(verdictCard).toBeInTheDocument();
    const savingsText = await within(verdictCard).findByTestId('savings-value');
    expect(savingsText).toBeInTheDocument();

    // Verify the dynamic equations panel and hour slider/UI are present
    const hourLabel = await screen.findByTestId('detail-hour');
    expect(hourLabel).toBeInTheDocument();
    const outdoorTempLabel = await screen.findByTestId('detail-outdoor-temp');
    expect(outdoorTempLabel).toBeInTheDocument();
  });
});
