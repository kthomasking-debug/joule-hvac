/* @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import NeighborhoodLeaderboard from '../NeighborhoodLeaderboard';

describe('NeighborhoodLeaderboard', () => {
  it('renders percentile and regional average', () => {
    render(<NeighborhoodLeaderboard jouleScore={85} userState="CA" />);
    expect(screen.getByText('Neighborhood Leaderboard')).toBeInTheDocument();
    expect(screen.getByText(/Your Percentile/i)).toBeInTheDocument();
    expect(screen.getByText(/Regional Average/i)).toBeInTheDocument();
    // Should show percentile value ending in "th"
    expect(screen.getByText(/\d+th/)).toBeInTheDocument();
  });

  it('displays privacy note', () => {
    render(<NeighborhoodLeaderboard jouleScore={65} userState="NY" />);
    expect(screen.getByText(/Privacy Note/i)).toBeInTheDocument();
    expect(screen.getByText(/No personal data is shared/i)).toBeInTheDocument();
  });
});
