/* @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BeforeAfterSlider from '../../components/BeforeAfterSlider';

function dollars(text) {
  return Number(text.replace(/[^0-9.-]/g, ''));
}

describe('BeforeAfterSlider', () => {
  it('interpolates cost as slider moves', () => {
    render(
      <BeforeAfterSlider
        titleLeft="Constant"
        titleRight="Setback"
        left={{ cost: 10.0, energy: 30, aux: 1 }}
        right={{ cost: 7.0, energy: 25, aux: 0.5 }}
        defaultValue={0}
      />
    );

    // helper: read the cost value inside the Cost card
    const readCost = () => {
      const label = screen.getByText('Cost');
      const amountDiv = label.nextElementSibling; // sibling contains the $ amount
      return dollars(amountDiv.textContent);
    };

    // initial should be left
    expect(readCost()).toBeCloseTo(10.0, 2);

    const slider = screen.getByLabelText('Before/After slider');

    // move to right end
    fireEvent.change(slider, { target: { value: 1 } });
    expect(readCost()).toBeCloseTo(7.0, 2);

    // middle
    fireEvent.change(slider, { target: { value: 0.5 } });
    expect(readCost()).toBeCloseTo(8.5, 2);
  });
});
