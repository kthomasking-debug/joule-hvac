/* @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import HistoricalDashboard from '../HistoricalDashboard';
import { recordMonth } from '../../lib/history/historyEngine';

describe('HistoricalDashboard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders message when no historical data exists', () => {
    render(<HistoricalDashboard />);
    expect(screen.getByText('Historical Comparison')).toBeInTheDocument();
    expect(screen.getByText(/No data for/i)).toBeInTheDocument();
  });

  it('displays year-over-year comparison when data exists', () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    
    recordMonth(year - 1, month, { predictedCost: 140, actualCost: 138 });
    recordMonth(year, month, { predictedCost: 130, actualCost: 128 });
    
    render(<HistoricalDashboard />);
    expect(screen.getByText('This Year')).toBeInTheDocument();
    expect(screen.getByText('Last Year')).toBeInTheDocument();
    // Should show actual costs
    expect(screen.getByText(/\$128\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\$138\.00/)).toBeInTheDocument();
  });

  it('shows savings indicator when cost decreased', () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    
    recordMonth(year - 1, month, { predictedCost: 150, actualCost: 150 });
    recordMonth(year, month, { predictedCost: 140, actualCost: 140 });
    
    render(<HistoricalDashboard />);
    expect(screen.getByText(/Saved/i)).toBeInTheDocument();
  });
});
