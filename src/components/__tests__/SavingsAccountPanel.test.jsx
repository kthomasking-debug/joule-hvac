import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import SavingsAccountPanel from '../SavingsAccountPanel';
import { recordSavings, resetAccount } from '../../lib/savings/savingsAccount';

const store = {};
beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  global.localStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k,v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; }
  };
  resetAccount();
});

describe('SavingsAccountPanel', () => {
  it('renders total saved and next goal', () => {
    recordSavings(25);
    render(<SavingsAccountPanel />);
    expect(screen.getByTestId('total-saved').textContent).toContain('$25.00');
    expect(screen.getByTestId('next-goal').textContent).toBeTruthy();
  });

  it('adds a new goal via form', () => {
    render(<SavingsAccountPanel />);
    const amountInput = screen.getByPlaceholderText('100');
    fireEvent.change(amountInput, { target: { value: '150' } });
    const labelInput = screen.getByPlaceholderText('Insulation Upgrade');
    fireEvent.change(labelInput, { target: { value: 'Seal Ducts' } });
    fireEvent.submit(screen.getByTestId('add-goal-form'));
    // Re-render to reflect changes
    expect(screen.getByText('$150.00')).toBeTruthy();
  });

  it('lists recent events', () => {
    recordSavings(10); recordSavings(5); recordSavings(3);
    render(<SavingsAccountPanel />);
    const recentList = screen.getByTestId('recent-events');
    expect(recentList.textContent).toContain('$10.00');
  });
});
