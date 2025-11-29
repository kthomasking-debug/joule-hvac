// src/components/__tests__/PlainEnglishToggle.test.jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PlainEnglishToggle from '../PlainEnglishToggle';
import userEvent from '@testing-library/user-event';

describe('PlainEnglishToggle', () => {
  it('shows technical view by default', () => {
    render(
      <PlainEnglishToggle
        technicalValue="905.1"
        technicalLabel="Thermal Factor"
        plainEnglishValue="Average"
        plainEnglishLabel="Your home loses heat about as fast as a typical 1990s home"
        unit="BTU/hr/°F"
      />
    );

    expect(screen.getByText(/905.1/)).toBeInTheDocument();
    expect(screen.getByText(/BTU\/hr\/°F/)).toBeInTheDocument();
  });

  it('toggles to plain english view', async () => {
    const user = userEvent.setup();
    render(
      <PlainEnglishToggle
        technicalValue="905.1"
        technicalLabel="Thermal Factor"
        plainEnglishValue="Average"
        plainEnglishLabel="Your home loses heat about as fast as a typical 1990s home"
        unit="BTU/hr/°F"
      />
    );

    await user.click(screen.getByRole('button', { name: /Plain English/i }));

    expect(screen.getByText('Average')).toBeInTheDocument();
    expect(screen.getByText(/typical 1990s home/i)).toBeInTheDocument();
  });
});
