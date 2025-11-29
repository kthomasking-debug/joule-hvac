import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PreferencePanel from '../PreferencePanel';

// Seed preference data to simulate learning
function seedPrefs() {
  const now = Date.now();
  const base = [];
  // Daytime temps ~72
  for (let h = 9; h <= 17; h += 2) {
    base.push({ ts: now - h*3600000, hour: h, day: 2, intent: 'setTemperature', targetTemp: 72 });
  }
  // Nighttime temps ~69
  for (let h = 22; h <= 23; h++) {
    base.push({ ts: now - h*3600000, hour: h, day: 2, intent: 'setTemperature', targetTemp: 69 });
  }
  for (let h = 0; h <= 5; h += 2) {
    base.push({ ts: now - h*3600000, hour: h, day: 3, intent: 'setTemperature', targetTemp: 69 });
  }
  localStorage.setItem('preferenceLearningData', JSON.stringify(base));
  localStorage.setItem('thermostatState', JSON.stringify({ targetTemp: 72, mode: 'heat', preset: 'home' }));
}

describe('PreferencePanel', () => {
  beforeEach(() => {
    seedPrefs();
  });
  it('renders schedule and suggestions', () => {
    render(<PreferencePanel />);
    expect(screen.getByTestId('preference-panel')).toBeTruthy();
    // Should have some hour entries
    expect(screen.getByText('9:00')).toBeTruthy();
  });
  it('applies night setback', () => {
    render(<PreferencePanel />);
    const btn = screen.getByText(/Night Setback/i);
    fireEvent.click(btn);
    // Action message appears
    expect(screen.getByTestId('preference-last-action').textContent).toMatch(/Temperature set to/);
  });
});
