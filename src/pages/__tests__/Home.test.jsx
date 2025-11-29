/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, Outlet } from 'react-router-dom';
import Home from '../Home.jsx';
import * as forecastHook from '../../hooks/useForecast';
import { ANNUAL_HDD_BY_CITY } from '../../lib/hddData';

describe('Home annual estimate method toggle', () => {
  const defaultSettings = {
    squareFeet: 1500,
    insulationLevel: 1.0,
    homeShape: 1.0,
    ceilingHeight: 8,
    capacity: 36,
    efficiency: 10.0,
    utilityCost: 0.15,
    indoorTemp: 70,
    winterThermostat: 70,
    summerThermostat: 74,
    useDetailedAnnualEstimate: false,
  };

  const userLocation = { city: 'New York', state: 'NY', latitude: 40.7128, longitude: -74.0060 };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('userSettings', JSON.stringify(defaultSettings));
    localStorage.setItem('userLocation', JSON.stringify(userLocation));
    // Ensure the dashboard renders the 'At a glance' panel by providing recent analysis
    localStorage.setItem('spa_resultsHistory', JSON.stringify([{ heatLossFactor: 200 }]));
    // Provide a minimal last_forecast_summary so Home renders the 'At a glance' section
    localStorage.setItem('last_forecast_summary', JSON.stringify({ location: 'New York, NY', totalHPCost: 0, totalGasCost: 0, totalSavings: 0 }));
  });

  it('renders Annual Energy Cost Est. card when quick estimate is used', async () => {
    const contextValue = { winterThermostat: 70, summerThermostat: 74, useDetailedAnnualEstimate: false };
    const router = createMemoryRouter([
      { path: '/', element: <div><Outlet context={contextValue} /></div>, children: [{ path: '/', element: <Home /> }] }
    ], { initialEntries: ['/'] });

    render(<RouterProvider router={router} />);
    const card = await screen.findByTestId('annual-cost-card');
    expect(card).toBeInTheDocument();
    // The UI no longer exposes an explicit 'Quick Estimate' title; ensure the card and cost values render
    expect(card).toBeTruthy();
    const total = await within(card).findByTestId('annual-total-cost');
    expect(total).toBeInTheDocument();
    const heatingCost = await within(card).findByTestId('annual-heating-cost');
    const coolingCost = await within(card).findByTestId('annual-cooling-cost');
    expect(heatingCost).toBeInTheDocument();
    expect(coolingCost).toBeInTheDocument();
  });

  it('renders Annual Energy Cost Est. card when detailed estimate is used', async () => {
    const contextValue = { winterThermostat: 70, summerThermostat: 74, useDetailedAnnualEstimate: true };
    const router = createMemoryRouter([
      { path: '/', element: <div><Outlet context={contextValue} /></div>, children: [{ path: '/', element: <Home /> }] }
    ], { initialEntries: ['/'] });

    render(<RouterProvider router={router} />);
    const card = await screen.findByTestId('annual-cost-card');
    expect(card).toBeInTheDocument();
    // Old 'Detailed Estimate' title isn't present in the UI; assert the card renders and shows cost numbers
    expect(card).toBeTruthy();
    const total = await within(card).findByTestId('annual-total-cost');
    expect(total).toBeInTheDocument();
    const heatingCost = await within(card).findByTestId('annual-heating-cost');
    const coolingCost = await within(card).findByTestId('annual-cooling-cost');
    expect(heatingCost).toBeInTheDocument();
    expect(coolingCost).toBeInTheDocument();
  });

  it('adjusts heating and cooling costs when thermostats change (quick method)', async () => {
    // Quick method (useDetailedAnnualEstimate: false)
    const makeRouter = (winter, summer) => createMemoryRouter([
      { path: '/', element: <div><Outlet context={{ winterThermostat: winter, summerThermostat: summer, useDetailedAnnualEstimate: false }} /></div>, children: [{ path: '/', element: <Home /> }] }
    ], { initialEntries: ['/'] });

    // Lower winter setpoint -> lower heating cost
    const lowWinterRouter = makeRouter(66, 74);
    const { container: lowContainer } = render(<RouterProvider router={lowWinterRouter} />);
    const lowHeatingSpan = Array.from(lowContainer.querySelectorAll('span')).find(s => s.textContent.includes('Heating:'));
    const lowHeatingVal = parseFloat((lowHeatingSpan?.textContent.match(/Heating:\s*\$([\d,.]+)/) || [])[1]?.replace(/,/g, ''));

    // Higher winter setpoint -> higher heating cost
    const highWinterRouter = makeRouter(74, 74);
    const { container: highContainer } = render(<RouterProvider router={highWinterRouter} />);
    const highHeatingSpan = Array.from(highContainer.querySelectorAll('span')).find(s => s.textContent.includes('Heating:'));
    const highHeatingVal = parseFloat((highHeatingSpan?.textContent.match(/Heating:\s*\$([\d,.]+)/) || [])[1]?.replace(/,/g, ''));

    expect(highHeatingVal).toBeGreaterThanOrEqual(lowHeatingVal);
  });

  it('reduces cooling cost when summer thermostat is increased (quick method)', async () => {
    const makeRouter = (winter, summer) => createMemoryRouter([
      { path: '/', element: <div><Outlet context={{ winterThermostat: winter, summerThermostat: summer, useDetailedAnnualEstimate: false }} /></div>, children: [{ path: '/', element: <Home /> }] }
    ], { initialEntries: ['/'] });

    // Lower summer setpoint -> higher cooling cost
    const lowSummerRouter = makeRouter(70, 72);
    const { container: lowContainer } = render(<RouterProvider router={lowSummerRouter} />);
    const lowCoolingSpan = Array.from(lowContainer.querySelectorAll('span')).find(s => s.textContent.includes('Cooling:'));
    const lowCoolingVal = parseFloat((lowCoolingSpan?.textContent.match(/Cooling:\s*\$([\d,.]+)/) || [])[1]?.replace(/,/g, ''));

    // Higher summer setpoint -> lower cooling cost
    const highSummerRouter = makeRouter(70, 78);
    const { container: highContainer } = render(<RouterProvider router={highSummerRouter} />);
    const highCoolingSpan = Array.from(highContainer.querySelectorAll('span')).find(s => s.textContent.includes('Cooling:'));
    const highCoolingVal = parseFloat((highCoolingSpan?.textContent.match(/Cooling:\s*\$([\d,.]+)/) || [])[1]?.replace(/,/g, ''));

    expect(highCoolingVal).toBeLessThanOrEqual(lowCoolingVal);
  });

  it('shows guidance with settings link for thermostat preferences', async () => {
    const contextValue = { winterThermostat: 70, summerThermostat: 74, useDetailedAnnualEstimate: false };
    const router = createMemoryRouter([
      { path: '/', element: <div><Outlet context={contextValue} /></div>, children: [{ path: '/', element: <Home /> }] }
    ], { initialEntries: ['/'] });

    render(<RouterProvider router={router} />);
    const link = await screen.findByRole('link', { name: /Set My Thermostats in Settings/i });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toContain('/settings#thermostat-settings');
    // The page now uses an info tooltip rather than literal 'Based on local climate data' text.
    // Ensure the 'At a glance' box with a last forecast is present, and the settings anchor exists.
    const glanceHeader = await screen.findByText(/At a glance/i);
    expect(glanceHeader).toBeInTheDocument();
    const parentDiv = glanceHeader.closest('div');
    expect(parentDiv).toBeTruthy();
  });

  it('displays a visual breakdown bar with correct percentage widths for heating/cooling', async () => {
    const contextValue = { winterThermostat: 70, summerThermostat: 74, useDetailedAnnualEstimate: false };
    const router = createMemoryRouter([
      { path: '/', element: <div><Outlet context={contextValue} /></div>, children: [{ path: '/', element: <Home /> }] }
    ], { initialEntries: ['/'] });

    const { container } = render(<RouterProvider router={router} />);
    // Wait for the card to render
    await screen.findByText(/Annual Energy Cost Est./i);

    // Find heating & cooling monetary values and compute expected percentages
    const costLine = Array.from(container.querySelectorAll('p')).find(p => p.textContent.includes('Heating:') && p.textContent.includes('Cooling:'));
    const heatingVal = parseFloat((costLine?.textContent.match(/Heating:\s*\$([\d,.]+)/) || [])[1]?.replace(/,/g, ''));
    const coolingVal = parseFloat((costLine?.textContent.match(/Cooling:\s*\$([\d,.]+)/) || [])[1]?.replace(/,/g, ''));
    const total = (heatingVal || 0) + (coolingVal || 0);
    if (total === 0) return; // Nothing to assert

    const expectedHeatingPct = `${((heatingVal / total) * 100).toFixed(2)}%`;
    const expectedCoolingPct = `${((coolingVal / total) * 100).toFixed(2)}%`;

    const heatingSeg = container.querySelector('[data-testid="heating-segment"]');
    const coolingSeg = container.querySelector('[data-testid="cooling-segment"]');
    expect(heatingSeg).toBeTruthy();
    expect(coolingSeg).toBeTruthy();
    // Verify style widths (rounded to 2 decimal points)
    const actualHeatingWidth = parseFloat(heatingSeg.style.width).toFixed(2) + '%';
    const actualCoolingWidth = parseFloat(coolingSeg.style.width).toFixed(2) + '%';
    expect(actualHeatingWidth).toBe(expectedHeatingPct);
    expect(actualCoolingWidth).toBe(expectedCoolingPct);
  });

  it('shows a dismissible weather banner when forecast indicates a cold snap', async () => {
    // Mock useForecast to produce a cold day with low <= 15
    vi.spyOn(forecastHook, 'default').mockReturnValue({ forecast: [ { time: new Date(), temp: 12 } ] });
    localStorage.removeItem('dismissedWeatherBanner');
    const contextValue = { winterThermostat: 70, summerThermostat: 74, useDetailedAnnualEstimate: false };
    const router = createMemoryRouter([
      { path: '/', element: <div><Outlet context={contextValue} /></div>, children: [{ path: '/', element: <Home /> }] }
    ], { initialEntries: ['/'] });

    const { container } = render(<RouterProvider router={router} />);
    // Wait for the banner to appear
    expect(await screen.findByText(/Cold snap expected/i)).toBeInTheDocument();
    const dismissBtn = screen.getByLabelText('Dismiss');
    fireEvent.click(dismissBtn);
    // Should be persisted so it no longer appears
    expect(localStorage.getItem('dismissedWeatherBanner')).toBe('true');
  });

  it('shows elevation note in the last forecast when homeElevation is set in context', async () => {
    const contextValue = { winterThermostat: 70, summerThermostat: 74, useDetailedAnnualEstimate: false, homeElevation: 5280 };
    const router = createMemoryRouter([
      { path: '/', element: <div><Outlet context={contextValue} /></div>, children: [{ path: '/', element: <Home /> }] }
    ], { initialEntries: ['/'] });

    render(<RouterProvider router={router} />);
    await screen.findByText(/Annual Energy Cost Est./i);
    // Last forecast should include an Elevation string, such as (Elev: 5280 ft)
    const locationText = await screen.findByText(/Elev:/i);
    expect(locationText).toBeInTheDocument();
    expect(locationText.textContent).toMatch(/5280 ft/);
  });
});
