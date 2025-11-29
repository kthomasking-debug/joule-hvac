import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import AskJoule from '../AskJoule.jsx';
import { MemoryRouter } from 'react-router-dom';

/**
 * Integration test: AskJoule component uses parseCommand to emit command objects.
 */

describe('AskJoule component command integration', () => {
  function setup(value, { hasLocation = true } = {}) {
    const onParsed = vi.fn();
    const utils = render(<MemoryRouter><AskJoule onParsed={onParsed} hasLocation={hasLocation} disabled={false} /></MemoryRouter>);
    const input = utils.getByLabelText(/ask joule/i);
    fireEvent.change(input, { target: { value } });
    fireEvent.submit(input.closest('form'));
    return { onParsed, ...utils };
  }

  it('emits increaseTemp command', () => {
    const { onParsed } = setup('make it warmer by 5');
    expect(onParsed).toHaveBeenCalledTimes(1);
    expect(onParsed.mock.calls[0][0]).toMatchObject({ action: 'increaseTemp', value: 5, isCommand: true });
  });

  it('emits setSquareFeet command', () => {
    const { onParsed } = setup('set square feet to 2,500');
    expect(onParsed).toHaveBeenCalledTimes(1);
    expect(onParsed.mock.calls[0][0]).toMatchObject({ action: 'setSquareFeet', value: 2500, isCommand: true });
  });

  it('falls back to structured parsing when no command matches', () => {
    const { onParsed } = setup('Boston, MA 1800 sq ft good insulation at 68');
    expect(onParsed).toHaveBeenCalledTimes(1);
    const payload = onParsed.mock.calls[0][0];
    expect(payload.isCommand).toBeUndefined();
    expect(payload.cityName).toBe('Boston, MA');
    expect(payload.squareFeet).toBe(1800);
    expect(payload.insulationLevel).toBeCloseTo(0.65, 4);
    expect(payload.indoorTemp).toBe(68);
  });

  it('allows commands without location when hasLocation=false', () => {
    const { onParsed } = setup('set winter thermostat to 68', { hasLocation: false });
    expect(onParsed).toHaveBeenCalledTimes(1);
    expect(onParsed.mock.calls[0][0]).toMatchObject({ action: 'setWinterTemp', value: 68 });
  });
});
