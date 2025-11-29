// src/components/__tests__/LearningAcknowledgment.test.jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LearningAcknowledgment from '../LearningAcknowledgment';
import userEvent from '@testing-library/user-event';

// Mock useVoiceFeedback
vi.mock('../../hooks/useVoiceFeedback', () => ({
  default: () => ({
    speak: vi.fn(),
    stop: vi.fn(),
    isSpeaking: false
  })
}));

describe('LearningAcknowledgment', () => {
  const mockPattern = {
    type: 'morning-warmup',
    hour: 7,
    period: 'AM',
    description: 'You often turn up the heat around 7:00 AM',
    details: {
      action: 'Increase temperature by 2°F at 7:00 AM',
      frequency: 5,
      period: 'last 2 weeks'
    }
  };

  it('renders nothing when no pattern provided', () => {
    const { container } = render(<LearningAcknowledgment pattern={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('displays pattern description', () => {
    render(<LearningAcknowledgment pattern={mockPattern} />);
    expect(screen.getByText(/You often turn up the heat around 7:00 AM/i)).toBeInTheDocument();
  });

  it('shows pattern details', () => {
    render(<LearningAcknowledgment pattern={mockPattern} />);
    expect(screen.getByText(/5 times in last 2 weeks/i)).toBeInTheDocument();
  });

  it('calls onAccept when Yes button clicked', async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    render(<LearningAcknowledgment pattern={mockPattern} onAccept={onAccept} />);
    
    await user.click(screen.getByRole('button', { name: /Yes, Automate/i }));
    expect(onAccept).toHaveBeenCalledWith(mockPattern);
  });

  it('calls onDismiss when dismiss button clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<LearningAcknowledgment pattern={mockPattern} onDismiss={onDismiss} />);
    
    await user.click(screen.getByTitle('Dismiss'));
    expect(onDismiss).toHaveBeenCalledWith(mockPattern);
  });
});
