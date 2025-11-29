/* @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import ShortCycleTest from '../ShortCycleTest';

describe('ShortCycleTest', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    global.localStorage = localStorageMock;
    
    // Mock fetch to prevent real API calls (temperature polling, etc.)
    global.fetch = vi.fn(() => 
      Promise.resolve({
        json: () => Promise.resolve({ error: 'Temperature sensor not available in test' })
      })
    );
    
    // initialize fake system time and provide tick wrapper for timer+Date advances
    const base = Date.now();
    vi.setSystemTime(base);
    global.__fakeNow = base;
    global.tick = async (ms) => {
      global.__fakeNow += ms;
      await act(async () => { vi.advanceTimersByTime(ms); vi.setSystemTime(global.__fakeNow); });
    };
  });
  afterEach(() => {
    vi.useRealTimers();
    if (global.__fakeNow) delete global.__fakeNow;
    if (global.tick) delete global.tick;
  });

  it('toggles cool relay ON once then blocks further toggles for a short protection window (test override)', async () => {
    // Use a short protection window for the unit test to run fast and deterministically
    render(<ShortCycleTest protectMsOverride={2000} />);
    const attemptBtn = screen.getByRole('button', { name: /Attempt Now/i });
    fireEvent.click(attemptBtn);
    
    // Wait for state update
    await act(async () => {
      await global.tick(100);
    });
    
    // Check attempts incremented
    expect(screen.getByText(/Attempts:/)).toHaveTextContent('Attempts: 1');
    expect(screen.getByText(/Blocked:/)).toHaveTextContent('Blocked: 0');
  });

  it('sends backend request when hardware enabled and confirmed', async () => {
    // Use real timers for this test to allow useEffect to run
    vi.useRealTimers();
    
    const fetchMock = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ ok: true }) }));
    global.fetch = fetchMock;
    window.fetch = fetchMock;

    // Set the relay server URL before rendering
    window.__RELAY_SERVER_URL__ = 'http://localhost:3005';

    render(<ShortCycleTest protectMsOverride={2000} />);
    
    // enable hardware in the UI
    const checkbox = screen.getByLabelText(/Enable hardware relay/i);
    fireEvent.click(checkbox);
    
    const secretInput = screen.getByLabelText(/Relay Secret/i);
    fireEvent.change(secretInput, { target: { value: 'abc' } });
    
    const confirmInput = screen.getByLabelText(/Type .*ENABLE-HARDWARE/i);
    fireEvent.change(confirmInput, { target: { value: 'ENABLE-HARDWARE' } });
    
    // Wait a tiny bit for refs to sync via useEffect
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const attemptBtn = screen.getByRole('button', { name: /Attempt Now/i });
    fireEvent.click(attemptBtn);
    
    // Wait for the relay toggle fetch to be called (not just temperature polling)
    await waitFor(() => {
      const relayToggleCalls = fetchMock.mock.calls.filter(call => 
        call[0].includes('/api/relay/toggle')
      );
      expect(relayToggleCalls.length).toBeGreaterThan(0);
    }, { timeout: 1000 });
    
    // Find the relay toggle call and check its body
    const relayToggleCall = fetchMock.mock.calls.find(call => call[0].includes('/api/relay/toggle'));
    expect(relayToggleCall).toBeDefined();
    const body = JSON.parse(relayToggleCall[1].body);
    expect(body.secret).toBe('abc');
    expect(body.on).toBe(true);
    
    // Restore fake timers for other tests
    vi.useFakeTimers();
  });

  it('does not call the backend when hardware not enabled', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ ok: true }) }));
    global.fetch = fetchMock;
    render(<ShortCycleTest protectMsOverride={2000} />);
    const attemptBtn = screen.getByRole('button', { name: /Attempt Now/i });
    fireEvent.click(attemptBtn);
    await global.tick(1000);
    
    // Check that relay toggle endpoint was NOT called (temperature polling is OK)
    const relayToggleCalls = fetchMock.mock.calls.filter(call => 
      call[0] && call[0].includes('/api/relay/toggle')
    );
    expect(relayToggleCalls).toHaveLength(0);
    // No stop necessary
  });
});
