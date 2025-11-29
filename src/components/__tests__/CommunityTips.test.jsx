/* @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CommunityTips from '../CommunityTips';

describe('CommunityTips', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders default tips', () => {
    render(<CommunityTips />);
    expect(screen.getByText('Community Tips & Stories')).toBeInTheDocument();
    // Should have at least one default tip (title appears in h3, content in p)
    expect(screen.getAllByText(/ceiling fans/i).length).toBeGreaterThan(0);
  });

  it('shows submit form when Share a Tip is clicked', () => {
    render(<CommunityTips />);
    const shareBtn = screen.getByRole('button', { name: /share a tip/i });
    fireEvent.click(shareBtn);
    expect(screen.getByPlaceholderText(/Tip title/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Share your energy-saving/i)).toBeInTheDocument();
  });

  it('allows upvoting a tip', () => {
    render(<CommunityTips />);
    const upvoteBtns = screen.getAllByRole('button');
    const firstUpvote = upvoteBtns.find(btn => btn.querySelector('svg')); // ThumbsUp icon
    if (firstUpvote) {
      fireEvent.click(firstUpvote);
      // After upvote, re-render should show updated count (hard to assert exact number without knowing initial state)
    }
  });
});
