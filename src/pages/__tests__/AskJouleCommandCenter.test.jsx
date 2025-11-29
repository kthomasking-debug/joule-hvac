import React from 'react';
import { render, screen } from '@testing-library/react';
import AskJouleCommandCenter from '../AskJouleCommandCenter';
import * as rr from 'react-router-dom';
import { MemoryRouter } from 'react-router-dom';

const renderWithOutlet = (context) => {
  const mock = vi.fn(() => context);
  vi.spyOn(rr, 'useOutletContext').mockImplementation(mock);
  return render(
    <MemoryRouter>
      <AskJouleCommandCenter />
    </MemoryRouter>
  );
};

test('renders empty view when no audit entries', () => {
  renderWithOutlet({});
  expect(screen.getByText(/Ask Joule Command Center/i)).toBeInTheDocument();
  expect(screen.getByText(/No audit entries found/)).toBeInTheDocument();
});

test('renders audit entries', () => {
  const now = Date.now();
  const entries = [
    { id: '1', timestamp: now, key: 'utilityCost', oldValue: 0.10, newValue: 0.12, source: 'AskJoule' }
  ];
  renderWithOutlet({ auditLog: entries, undoChange: () => {}, clearAuditLog: () => {} });
  expect(screen.getByText(/utilityCost/)).toBeInTheDocument();
  expect(screen.getByText(/0.12/)).toBeInTheDocument();
});
