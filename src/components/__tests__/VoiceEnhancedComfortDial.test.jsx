// src/components/__tests__/VoiceEnhancedComfortDial.test.jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import VoiceEnhancedComfortDial from '../VoiceEnhancedComfortDial';
import userEvent from '@testing-library/user-event';

// Mock useVoiceFeedback hook
vi.mock('../../hooks/useVoiceFeedback', () => ({
  default: () => ({
    speak: vi.fn(),
    stop: vi.fn(),
    isSpeaking: false,
    humanize: vi.fn(text => Promise.resolve(text))
  })
}));

describe('VoiceEnhancedComfortDial', () => {
  it('renders with voice toggle button', () => {
    render(<VoiceEnhancedComfortDial winterThermostat={70} />);
    expect(screen.getByTitle(/voice feedback/i)).toBeInTheDocument();
  });

  it('shows voice command hint when enabled', () => {
    render(<VoiceEnhancedComfortDial winterThermostat={70} />);
    expect(screen.getByText(/Say "I want to save money"/i)).toBeInTheDocument();
  });

  it('toggles voice feedback on button click', async () => {
    const user = userEvent.setup();
    render(<VoiceEnhancedComfortDial winterThermostat={70} />);
    
    const toggleButton = screen.getByTitle(/Disable voice feedback/i);
    await user.click(toggleButton);
    
    expect(screen.queryByText(/Say "I want to save money"/i)).not.toBeInTheDocument();
  });

  it('renders underlying ComfortSavingsDial', () => {
    render(<VoiceEnhancedComfortDial winterThermostat={68} summerThermostat={76} />);
    expect(screen.getByText(/Comfort vs Savings/i)).toBeInTheDocument();
  });

  it('calls onThermostatChange when +/- clicked', async () => {
    const onThermostatChange = vi.fn();
    render(<VoiceEnhancedComfortDial winterThermostat={70} onThermostatChange={onThermostatChange} />);
    const minusButton = screen.getByText('-');
    const plusButton = screen.getByText('+');
    minusButton && minusButton.click();
    plusButton && plusButton.click();
    expect(onThermostatChange).toHaveBeenCalledTimes(2);
  });
});
