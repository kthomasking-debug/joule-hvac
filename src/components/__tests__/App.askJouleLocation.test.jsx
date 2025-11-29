import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import App from '../../App';
import { MemoryRouter } from 'react-router-dom';

describe('App-level Ask Joule Location', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('accepts thermostat command using existing onboarding location', async () => {
    // Pre-populate localStorage with a userLocation (like onboarding)
    localStorage.setItem('userLocation', JSON.stringify({ city: 'Denver', state: 'CO' }));

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/monthly-budget"]}>
        <App />
      </MemoryRouter>
    );

    // Open the Ask Joule modal
    const fab = await screen.findByTestId('ask-joule-fab');
    await user.click(fab);

    const input = await screen.findByLabelText('Ask Joule');
    await user.type(input, 'set winter thermostat to 72');
    const modal = await screen.findByRole('dialog');
    const { getByRole } = within(modal);
    const askButton = getByRole('button', { name: /ask/i });
    await user.click(askButton);

    // Output area should show success message
    const output = await screen.findByTestId('ask-joule-output');
    expect(output.textContent).toContain('✓ Winter thermostat set to 72°F');
  });

  it('allows setting location then setting thermostat in the same session', async () => {
    const user = userEvent.setup();
    // Ensure no pre-existing location is set
    localStorage.removeItem('userLocation');

    render(
      <MemoryRouter initialEntries={["/monthly-budget"]}>
        <App />
      </MemoryRouter>
    );

    // Initially no location
    localStorage.removeItem('userLocation');

    // Open FAB and set location via Ask Joule
    const fab = await screen.findByTestId('ask-joule-fab');
    await user.click(fab);
    const modal = await screen.findByRole('dialog');
    const { getByRole } = within(modal);
    const input = await screen.findByLabelText('Ask Joule');
    const askButton = getByRole('button', { name: /ask/i });
    await user.type(input, 'set location to Denver, CO');
    await user.click(askButton);
    // Ensure localStorage updated
    const stored = JSON.parse(localStorage.getItem('userLocation') || 'null');
    expect(stored).toBeTruthy();
    expect(stored.city).toContain('Denver');
    // Now set winter thermostat again - re-open modal if closed by the set location command
    // The set location command triggers a navigation to /cost-forecaster; click Budget to go back
    const allBudgetNavs = screen.getAllByTestId('nav-link-monthly-budget');
    await user.click(allBudgetNavs[0]);
    const fab2 = await screen.findByTestId('ask-joule-fab');
    await user.click(fab2);
    const modal2 = await screen.findByRole('dialog');
    const { getByRole: getByRole2 } = within(modal2);
    const input2 = await screen.findByLabelText('Ask Joule');
    await user.click(input2);
    await user.clear(input2);
    await user.type(input2, 'set winter thermostat to 72');
    const askButton2 = getByRole2('button', { name: /ask/i });
    await user.click(askButton2);
    const output2 = await within(modal2).findByTestId('ask-joule-output');
    expect(output2.textContent).toContain('✓ Winter thermostat set to 72°F');
  });
});
