import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomeDashboard from '../Home.jsx';

function seedDiagnostics(issueOverrides = []) {
  const diagnostics = {
    issues: issueOverrides.length ? issueOverrides : [
      { type: 'short_cycling', severity: 'high', description: 'Short cycling detected: 8 cycles in 60 minutes' }
    ],
    summary: { totalIssues: issueOverrides.length || 1, critical: 0, high: 1, medium: 0, timestamp: new Date().toISOString(), dataRows: 120 }
  };
  localStorage.setItem('spa_diagnostics', JSON.stringify(diagnostics));
  localStorage.setItem('spa_uploadTimestamp', new Date().toISOString());
}

describe('HomeDiagnosticsBanner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows system performance issues banner when issues exist', () => {
    seedDiagnostics();
    render(<MemoryRouter><HomeDashboard /></MemoryRouter>);
    expect(screen.getByText(/System Performance Issues Detected/i)).toBeTruthy();
  });

  it('does not show banner when no diagnostics', () => {
    render(<MemoryRouter><HomeDashboard /></MemoryRouter>);
    expect(screen.queryByText(/System Performance Issues Detected/i)).toBeNull();
  });
});
