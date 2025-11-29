import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import AskJoule from '../AskJoule';
import { parseAskJoule } from '../../utils/askJouleParser';

// Mock useSpeechSynthesis hook
vi.mock('../../hooks/useSpeechSynthesis', () => ({
  useSpeechSynthesis: () => ({
    speak: vi.fn(),
    stop: vi.fn(),
    isSpeaking: false,
    isEnabled: true,
    toggleEnabled: vi.fn(),
    isSupported: true,
  }),
}));

describe('AskJoule - Enhanced Voice Commands', () => {
  const mockOnSettingChange = vi.fn();
  const mockUserSettings = {
    winterThermostat: 68,
    summerThermostat: 74,
    hspf2: 9.5,
    efficiency: 16,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Relative temperature adjustments', () => {
    it('handles "make it warmer"', async () => {
      const user = userEvent.setup();
      render(
        <BrowserRouter>
          <AskJoule
            hasLocation={true}
            userSettings={mockUserSettings}
            onSettingChange={mockOnSettingChange}
          />
        </BrowserRouter>
      );

      const inputs = screen.getAllByLabelText('Ask Joule');
      expect(inputs.length).toBe(1);
      const input = inputs[0];
      await user.type(input, 'make it warmer');
      // Assert input reflected the typed text
      expect(input).toHaveValue('make it warmer');
      // Verify parser identifies this as increaseTemp command
      expect(parseAskJoule('make it warmer').action).toBe('increaseTemp');
      await user.click(screen.getByText('Ask'));

      expect(mockOnSettingChange).toHaveBeenCalledWith(
        'winterThermostat',
        70, // 68 + 2
        expect.objectContaining({ source: 'AskJoule' })
      );
    });

    it('handles "make it cooler by 3"', async () => {
      const user = userEvent.setup();
      render(
        <BrowserRouter>
          <AskJoule
            hasLocation={true}
            userSettings={mockUserSettings}
            onSettingChange={mockOnSettingChange}
          />
        </BrowserRouter>
      );

      const input = screen.getByLabelText('Ask Joule');
      await user.type(input, 'make it cooler by 3');
      await user.click(screen.getByText('Ask'));

      expect(mockOnSettingChange).toHaveBeenCalledWith(
        'winterThermostat',
        65, // 68 - 3
        expect.objectContaining({ source: 'AskJoule' })
      );
    });

    it('handles "turn up the heat by 5"', async () => {
      const user = userEvent.setup();
      render(
        <BrowserRouter>
          <AskJoule
            hasLocation={true}
            userSettings={mockUserSettings}
            onSettingChange={mockOnSettingChange}
          />
        </BrowserRouter>
      );

      const input = screen.getByLabelText('Ask Joule');
      await user.type(input, 'turn up the heat by 5');
      await user.click(screen.getByText('Ask'));

      expect(mockOnSettingChange).toHaveBeenCalledWith(
        'winterThermostat',
        73, // 68 + 5
        expect.objectContaining({ source: 'AskJoule' })
      );
    });
  });

  describe('Preset modes', () => {
    it('handles "I\'m going to sleep" (sleep mode)', async () => {
      const user = userEvent.setup();
      render(
        <BrowserRouter>
          <AskJoule
            hasLocation={true}
            userSettings={mockUserSettings}
            onSettingChange={mockOnSettingChange}
          />
        </BrowserRouter>
      );

      const input = screen.getByLabelText('Ask Joule');
      await user.type(input, "I'm going to sleep");
      await user.click(screen.getByText('Ask'));

      expect(mockOnSettingChange).toHaveBeenCalledWith(
        'winterThermostat',
        65,
        expect.objectContaining({ comment: 'Sleep mode preset' })
      );
    });

    it('handles "I\'m leaving" (away mode)', async () => {
      const user = userEvent.setup();
      render(
        <BrowserRouter>
          <AskJoule
            hasLocation={true}
            userSettings={mockUserSettings}
            onSettingChange={mockOnSettingChange}
          />
        </BrowserRouter>
      );

      const input = screen.getByLabelText('Ask Joule');
      await user.type(input, "I'm leaving");
      await user.click(screen.getByText('Ask'));

      expect(mockOnSettingChange).toHaveBeenCalledWith(
        'winterThermostat',
        60,
        expect.objectContaining({ comment: 'Away mode preset' })
      );
    });

    it('handles "I\'m home" (home mode)', async () => {
      const user = userEvent.setup();
      render(
        <BrowserRouter>
          <AskJoule
            hasLocation={true}
            userSettings={mockUserSettings}
            onSettingChange={mockOnSettingChange}
          />
        </BrowserRouter>
      );

      const input = screen.getByLabelText('Ask Joule');
      await user.type(input, "I'm home");
      await user.click(screen.getByText('Ask'));

      expect(mockOnSettingChange).toHaveBeenCalledWith(
        'winterThermostat',
        70,
        expect.objectContaining({ comment: 'Home mode preset' })
      );
    });
  });

  describe('Temperature queries', () => {
    it('handles "what\'s the temperature"', async () => {
      const user = userEvent.setup();
      render(
        <BrowserRouter>
          <AskJoule
            hasLocation={true}
            userSettings={mockUserSettings}
            onSettingChange={mockOnSettingChange}
          />
        </BrowserRouter>
      );

      const input = screen.getByLabelText('Ask Joule');
      await user.type(input, "what's the temperature");
      await user.click(screen.getByText('Ask'));

      // Should display current temp without changing settings
      expect(mockOnSettingChange).not.toHaveBeenCalled();
      const output = await screen.findByTestId('ask-joule-output');
      expect(output.textContent).toMatch(/68/);
    });
  });

  describe('Natural language variations', () => {
    it('handles "how cold is it"', async () => {
      const user = userEvent.setup();
      render(
        <BrowserRouter>
          <AskJoule
            hasLocation={true}
            userSettings={mockUserSettings}
            onSettingChange={mockOnSettingChange}
          />
        </BrowserRouter>
      );

      const input = screen.getByLabelText('Ask Joule');
      await user.type(input, 'how cold is it');
      await user.click(screen.getByText('Ask'));

      expect(mockOnSettingChange).not.toHaveBeenCalled();
      const output = await screen.findByTestId('ask-joule-output');
      expect(output.textContent).toMatch(/68/);
    });

    it('handles "sleep mode"', async () => {
      const user = userEvent.setup();
      render(
        <BrowserRouter>
          <AskJoule
            hasLocation={true}
            userSettings={mockUserSettings}
            onSettingChange={mockOnSettingChange}
          />
        </BrowserRouter>
      );

      const input = screen.getByLabelText('Ask Joule');
      await user.type(input, 'sleep mode');
      await user.click(screen.getByText('Ask'));

      expect(mockOnSettingChange).toHaveBeenCalledWith(
        'winterThermostat',
        65,
        expect.objectContaining({ comment: 'Sleep mode preset' })
      );
    });
  });
});
