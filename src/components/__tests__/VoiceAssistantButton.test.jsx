// src/components/__tests__/VoiceAssistantButton.test.jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import VoiceAssistantButton from '../VoiceAssistantButton';
import userEvent from '@testing-library/user-event';

describe('VoiceAssistantButton', () => {
  it('renders enabled button', () => {
    render(<VoiceAssistantButton isEnabled={true} />);
    expect(screen.getByLabelText(/Start voice assistant/i)).toBeInTheDocument();
  });

  it('shows listening state', () => {
    render(<VoiceAssistantButton isListening={true} />);
    expect(screen.getByLabelText(/Stop listening/i)).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<VoiceAssistantButton onClick={onClick} isEnabled={true} />);

    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });

  it('is disabled when isEnabled is false', () => {
    render(<VoiceAssistantButton isEnabled={false} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
