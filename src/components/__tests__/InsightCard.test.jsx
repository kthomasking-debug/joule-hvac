// src/components/__tests__/InsightCard.test.jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import InsightCard from '../InsightCard';
import userEvent from '@testing-library/user-event';

describe('InsightCard', () => {
  it('renders default message when no insight provided', () => {
    const { container } = render(<InsightCard />);
    expect(container.firstChild).not.toBeNull();
    expect(screen.getByText('No insights today')).toBeInTheDocument();
    expect(screen.getByText('Everything looks good. Check back tomorrow!')).toBeInTheDocument();
  });

  it('displays provided title and message', () => {
    render(<InsightCard title={'Last Week'} message={'Energy cost \n $26.22'} />);
    expect(screen.getByText('Last Week')).toBeInTheDocument();
    expect(screen.getByText(/\$26\.22/)).toBeInTheDocument();
    expect(screen.getByText(/Energy cost/)).toBeInTheDocument();
  });

  it('calls onAction when action button clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<InsightCard title={'Test'} message={'$10'} actionLabel={'Dismiss'} onAction={onAction} />);
    await user.click(screen.getByRole('button', { name: /Dismiss/ }));
    expect(onAction).toHaveBeenCalled();
  });
});
