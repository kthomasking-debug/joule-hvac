// src/components/__tests__/VoiceOrb.test.jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import VoiceOrb from '../VoiceOrb';
import userEvent from '@testing-library/user-event';

describe('VoiceOrb', () => {
  it('renders with score when not listening', () => {
    render(<VoiceOrb score={87} isListening={false} />);

    expect(screen.getByText('87')).toBeInTheDocument();
    expect(screen.getByText(/Joule Score/i)).toBeInTheDocument();
    expect(screen.getByText(/Tap to ask Joule/i)).toBeInTheDocument();
  });

  it('shows microphone icon when listening', () => {
    render(<VoiceOrb isListening={true} />);

    expect(screen.queryByText('87')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Stop listening/i })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    let clicked = false;
    render(<VoiceOrb onClick={() => { clicked = true; }} />);

    await user.click(screen.getByRole('button'));
    expect(clicked).toBe(true);
  });
});
