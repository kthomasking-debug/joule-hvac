/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import GlobalAlertBanner from '../GlobalAlertBanner';
import { vi } from 'vitest';

describe('GlobalAlertBanner', () => {
  it('renders and dismisses the banner', () => {
    localStorage.removeItem('dismissedWeatherBanner');
    const onDismiss = vi.fn();
    render(<GlobalAlertBanner id="test" message="Storm Thursday" kind="warn" onDismiss={onDismiss} actionLabel="View Forecast" onAction={() => {}} />);
    expect(screen.getByText(/Storm Thursday/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Dismiss/i));
    expect(onDismiss).toHaveBeenCalled();
  });
});
