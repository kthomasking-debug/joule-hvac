import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
// Mock speech hook to test TTS behavior
const speakSpy = vi.fn();
vi.mock('../../hooks/useSpeechSynthesis', () => ({
  useSpeechSynthesis: () => ({
    speak: speakSpy,
    stop: vi.fn(),
    isSpeaking: false,
    isEnabled: true,
    toggleEnabled: vi.fn(),
    isSupported: true,
  }),
}));
import AskJoule from '../../components/AskJoule';
import { MemoryRouter } from 'react-router-dom';

describe('AskJoule Integration', () => {
  it('allows setting winter thermostat without location and calls onSettingChange', async () => {
    const user = userEvent.setup();
    const onSettingChange = vi.fn();
    render(
      <MemoryRouter>
        <AskJoule
          onSettingChange={onSettingChange}
          hasLocation={false}
          userSettings={{ winterThermostat: 70 }}
          userLocation={null}
          annualEstimate={null}
          recommendations={[]}
        />
      </MemoryRouter>
    );

    const input = screen.getByLabelText('Ask Joule');
    await user.type(input, 'set winter thermostat to 72');
    const askButton = screen.getByRole('button', { name: /ask/i });
    await user.click(askButton);

    // onSettingChange should be called
    expect(onSettingChange).toHaveBeenCalledWith('winterThermostat', 72, expect.any(Object));

    // Output area should contain success message
    expect(screen.getByTestId('ask-joule-output')).toBeDefined();
    expect(screen.getByTestId('ask-joule-output').textContent).toContain('✓ Winter thermostat set to 72°F');
  });

  it('speaks response when TTS enabled', async () => {
    const user = userEvent.setup();
    const onSettingChange = vi.fn();
    // Use the same speakSpy to verify it was called
    const tts = { speak: speakSpy };
    render(
      <MemoryRouter>
        <AskJoule
          onSettingChange={onSettingChange}
          hasLocation={false}
          userSettings={{ winterThermostat: 70 }}
        />
      </MemoryRouter>
    );

    const input = screen.getByLabelText('Ask Joule');
    await user.type(input, 'set winter thermostat to 72');
    const askButton = screen.getByRole('button', { name: /ask/i });
    await user.click(askButton);

    // Ensure TTS speak is called with the success message
    expect(speakSpy).toHaveBeenCalled();
  });
});
