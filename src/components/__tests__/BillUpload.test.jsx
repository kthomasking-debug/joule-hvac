/* @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BillUpload from '../BillUpload';

describe('BillUpload', () => {
  it('renders upload form', () => {
    render(<BillUpload predictedMonthlyCost={150} />);
    expect(screen.getByText('Bill Upload & Verification')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Paste your bill text/i)).toBeInTheDocument();
  });

  it('parses bill text when Parse Bill is clicked', () => {
    render(<BillUpload predictedMonthlyCost={150} />);
    const textarea = screen.getByPlaceholderText(/Paste your bill text/i);
    fireEvent.change(textarea, { target: { value: 'Total Amount Due: $145.50, 850 kWh' } });
    
    const parseBtn = screen.getByRole('button', { name: /parse bill/i });
    fireEvent.click(parseBtn);
    
    // Should display parsed data (appears in multiple places, use getAllByText)
    expect(screen.getByText('Parsed Data')).toBeInTheDocument();
    const amounts = screen.getAllByText(/\$145\.50/);
    expect(amounts.length).toBeGreaterThan(0);
  });

  it('shows calibration feedback with variance', () => {
    render(<BillUpload predictedMonthlyCost={140} />);
    const textarea = screen.getByPlaceholderText(/Paste your bill text/i);
    fireEvent.change(textarea, { target: { value: 'Total: $150.00' } });
    
    fireEvent.click(screen.getByRole('button', { name: /parse bill/i }));
    
    // Should show model calibration section
    expect(screen.getByText('Model Calibration')).toBeInTheDocument();
    expect(screen.getByText(/Variance:/i)).toBeInTheDocument();
  });

  it('shows photo upload and displays error when parsing photo', async () => {
    render(<BillUpload predictedMonthlyCost={150} />);
    const takePhotoBtn = screen.getByRole('button', { name: /Take Photo/i });
    expect(takePhotoBtn).toBeInTheDocument();

    // Simulate file selection
    const file = new File(['dummy content'], 'bill.jpg', { type: 'image/jpeg' });
    const input = document.getElementById('bill-photo-input');
    expect(input).toBeTruthy();
    await fireEvent.change(input, { target: { files: [file] } });

    // Parse Photo appears after file preview
    const parseBtn = await screen.findByText(/Parse Photo/i);
    expect(parseBtn).toBeTruthy();
    fireEvent.click(parseBtn);
    // Photo parsing is not ready yet - should show error message
    expect(screen.getByText(/Photo parsing is not ready yet/i)).toBeInTheDocument();
  });
});
