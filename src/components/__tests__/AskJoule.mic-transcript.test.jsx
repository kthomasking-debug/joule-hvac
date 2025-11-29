import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AskJoule from '../AskJoule';

// Mock speech recognition hook to simulate listening state & transcript
vi.mock('../../hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: () => ({
    supported: true,
    isListening: true,
    transcript: 'set temperature to 70',
    startListening: () => {},
    stopListening: () => {},
  })
}));

// Mock TTS hook minimal
vi.mock('../../hooks/useSpeechSynthesis', () => ({
  useSpeechSynthesis: () => ({ speak: () => {} })
}));

describe('AskJoule microphone UI', () => {
  it('shows live transcript while listening', () => {
    render(<MemoryRouter><AskJoule /></MemoryRouter>);
    const micBtn = screen.getByTestId('askjoule-mic-btn');
    expect(micBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('askjoule-live-transcript').textContent).toMatch(/set temperature to 70/i);
  });
});
