/* @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ShareableSavingsExport from '../ShareableSavingsExport';

// Mock html2canvas
vi.mock('html2canvas', () => ({
  default: vi.fn(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    canvas.toBlob = (callback) => {
      callback(new Blob(['fake'], { type: 'image/png' }));
    };
    return Promise.resolve(canvas);
  }),
}));

describe('ShareableSavingsExport', () => {
  it('renders the preview card and action buttons', () => {
    render(<ShareableSavingsExport savings={450} location="Denver, CO" />);
    expect(screen.getByText('Share Your Savings')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download png/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy image/i })).toBeInTheDocument();
  });

  it('triggers download when Download PNG is clicked', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    const mockClick = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = vi.fn((tag) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') {
        el.click = mockClick;
      }
      return el;
    });

    render(<ShareableSavingsExport savings={450} location="Denver, CO" />);
    const btn = screen.getByRole('button', { name: /download png/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalled();
    });

    document.createElement = originalCreateElement;
  });
});
