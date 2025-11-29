// src/components/__tests__/TranscriptOverlay.test.jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TranscriptOverlay from '../TranscriptOverlay';

describe('TranscriptOverlay', () => {
  it('renders nothing when not visible', () => {
    const { container } = render(<TranscriptOverlay isVisible={false} transcript="test" />);
    expect(container.firstChild).toBeNull();
  });

  it('displays transcript when visible', () => {
    render(<TranscriptOverlay isVisible={true} transcript="How much did I spend?" />);
    expect(screen.getByText(/How much did I spend?/i)).toBeInTheDocument();
  });

  it('shows interim transcript in italics', () => {
    render(
      <TranscriptOverlay 
        isVisible={true} 
        transcript="How much" 
        interimTranscript="did I spend" 
      />
    );
    
    expect(screen.getByText(/How much/)).toBeInTheDocument();
    expect(screen.getByText(/did I spend/)).toBeInTheDocument();
  });
});
