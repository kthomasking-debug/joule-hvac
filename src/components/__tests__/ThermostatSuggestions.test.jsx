/* @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ThermostatSuggestions from '../../components/ThermostatSuggestions';

function seedEvents(hours = [6,6,6]) {
  const now = Date.now();
  const events = hours.map((h, i) => ({
    kind: 'winter', prev: 66, next: 70, ts: new Date(now - i * 24*60*60*1000).toISOString(), hour: h, dow: 1,
  }));
  localStorage.setItem('learningEvents', JSON.stringify(events));
  localStorage.removeItem('suggestionDismiss');
}

describe('ThermostatSuggestions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders a morning pre-warm suggestion and applies on click', () => {
    seedEvents();
    const onApply = vi.fn();
    render(<ThermostatSuggestions currentWinter={68} onApply={onApply} />);
    expect(screen.getByText(/Suggestion: Morning Pre‑Warm/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Apply now/i));
    expect(onApply).toHaveBeenCalled();
    const applied = onApply.mock.calls[0][0];
    expect(applied).toBe(70); // 68 + 2°F
  });

  it('does not render when not enough pattern found', () => {
    seedEvents([10, 12, 14]);
    render(<ThermostatSuggestions currentWinter={68} />);
    expect(screen.queryByText(/Morning Pre‑Warm/i)).toBeNull();
  });
});
