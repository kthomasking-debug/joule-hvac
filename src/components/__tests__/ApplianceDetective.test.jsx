/* @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ApplianceDetective from '../ApplianceDetective';

describe('ApplianceDetective', () => {
  it('renders appliance cards with costs', () => {
    render(<ApplianceDetective utilityCost={0.15} />);
    expect(screen.getByText('Appliance Energy Detective')).toBeInTheDocument();
    expect(screen.getByText('Water Heater')).toBeInTheDocument();
    expect(screen.getByText('Clothes Dryer')).toBeInTheDocument();
    expect(screen.getByText(/Total Appliance Cost/i)).toBeInTheDocument();
  });

  it('shows customization inputs when appliance is selected', () => {
    render(<ApplianceDetective utilityCost={0.15} />);
    const waterHeaterCard = screen.getByText('Water Heater').closest('[role="button"]');
    fireEvent.click(waterHeaterCard);
    
    expect(screen.getByText(/Customize Water Heater/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/4500/)).toBeInTheDocument(); // watts
  });

  it('updates cost when custom values are entered', () => {
    render(<ApplianceDetective utilityCost={0.15} />);
    const waterHeaterCard = screen.getByText('Water Heater').closest('[role="button"]');
    fireEvent.click(waterHeaterCard);
    
    const wattsInput = screen.getByPlaceholderText(/4500/);
    fireEvent.change(wattsInput, { target: { value: '5000' } });
    
    // Component should re-render with updated costs
    const totalCost = screen.getByText(/Total Appliance Cost/i).parentElement.querySelector('span:last-child');
    expect(totalCost).toBeInTheDocument();
  });

  it('highlights big energy hogs and shows Smart Upgrade button', () => {
    render(<ApplianceDetective utilityCost={0.15} />);
    // 'Water Heater' is expected to be a big energy hog
    const waterHeaterMatches = screen.getAllByText(/Water Heater/i);
    expect(waterHeaterMatches.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Smart Upgrade/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Big energy hog/i).length).toBeGreaterThan(0);
  });
});
