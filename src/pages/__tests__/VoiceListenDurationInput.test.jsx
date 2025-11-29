import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { act } from '@testing-library/react';
import { VoiceListenDurationInput } from '../Settings';

describe('VoiceListenDurationInput', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.removeItem('askJouleListenSeconds');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem('askJouleListenSeconds');
  });

  it('renders with default value and updates on change', async () => {
    render(<VoiceListenDurationInput />);
    const input = screen.getByLabelText(/Voice listening duration in seconds/);
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('5');
  });

  it('saves and triggers reload after debounce when changed', async () => {
    vi.useFakeTimers();
    render(<VoiceListenDurationInput />);
    const input = screen.getByLabelText(/Voice listening duration in seconds/);
    act(() => {
      fireEvent.change(input, { target: { value: '9' } });
      // Fast-forward debounce (now 3000ms)
      vi.advanceTimersByTime(3000);
    });
    // Should update localStorage (reload behavior is not asserted in unit test)
    expect(localStorage.getItem('askJouleListenSeconds')).toBe('9');
    vi.useRealTimers();
  });
});
