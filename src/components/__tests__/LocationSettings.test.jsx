import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LocationSettings from '../LocationSettings';

beforeEach(() => {
  localStorage.clear();
});

describe('LocationSettings', () => {
  it('saves latitude and longitude', () => {
    render(<LocationSettings />);
    const latInput = screen.getByPlaceholderText(/39\.7392/i);
    const lonInput = screen.getByPlaceholderText(/-104\.9903/i);
    fireEvent.change(latInput, { target: { value: '12.345' } });
    fireEvent.change(lonInput, { target: { value: '-98.765' } });
    fireEvent.click(screen.getByText(/Save/i));
    expect(localStorage.getItem('userLat')).toBe('12.345');
    expect(localStorage.getItem('userLon')).toBe('-98.765');
    expect(screen.getByTestId('location-status').textContent).toMatch(/Location saved/);
  });
});
