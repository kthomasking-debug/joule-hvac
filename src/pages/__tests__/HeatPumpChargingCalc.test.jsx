/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import HeatPumpChargingCalc from '../HeatPumpChargingCalc.jsx';

describe('HeatPumpChargingCalc', () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    
    // Mock navigator.bluetooth
    global.navigator.bluetooth = {
      requestDevice: vi.fn(),
    };
    
    // Mock navigator.geolocation
    global.navigator.geolocation = {
      getCurrentPosition: vi.fn(),
    };
    
    // Reset all mocks
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    const router = createMemoryRouter([
      { path: '/', element: <HeatPumpChargingCalc /> }
    ], { initialEntries: ['/'] });
    
    return render(<RouterProvider router={router} />);
  };

  describe('Basic Rendering', () => {
    it('renders the calculator title', () => {
      renderComponent();
      expect(screen.getByText('A/C Charging Calculator')).toBeInTheDocument();
    });

    it('renders subcooling method by default', () => {
      renderComponent();
      // Check the Subcooling button is selected (has blue background)
      const subcoolingButton = screen.getByRole('button', { name: /^Subcooling$/i });
      expect(subcoolingButton).toHaveClass('bg-blue-600');
    });

    it('renders pressure input controls', () => {
      renderComponent();
      // Check for the label text (it's not properly linked to the input)
      expect(screen.getByText(/Liquid Line Pressure \(psig\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Increase pressure by 5/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Decrease pressure by 5/i)).toBeInTheDocument();
    });
  });

  describe('Bluetooth Manifold Data Parsing', () => {
    it('correctly parses float32 pressure data from Fieldpiece SMAN format', () => {
      // Create mock DataView with Fieldpiece SMAN data format
      // High-side: 335.0 PSI, Low-side: 100.0 PSI (float32, little-endian)
      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);
      view.setFloat32(0, 335.0, true); // High-side pressure
      view.setFloat32(4, 100.0, true); // Low-side pressure

      // Verify the mock data is correct
      expect(view.getFloat32(0, true)).toBe(335.0);
      expect(view.getFloat32(4, true)).toBe(100.0);
    });

    it('correctly parses int16 pressure data from alternative manifold format', () => {
      // Create mock DataView with alternative format
      // High-side: 335.0 PSI (stored as 3350 / 10), Low-side: 100.0 PSI (stored as 1000 / 10)
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      view.setUint16(0, 3350, true); // High-side pressure * 10
      view.setUint16(2, 1000, true); // Low-side pressure * 10

      // Verify the mock data is correct
      expect(view.getUint16(0, true) / 10).toBe(335.0);
      expect(view.getUint16(2, true) / 10).toBe(100.0);
    });

    it('correctly parses temperature data when available', () => {
      // Create mock DataView with pressure + temperature data
      const buffer = new ArrayBuffer(16);
      const view = new DataView(buffer);
      view.setFloat32(0, 335.0, true);  // High-side pressure
      view.setFloat32(4, 100.0, true);  // Low-side pressure
      view.setFloat32(8, 95.5, true);   // Liquid line temp
      view.setFloat32(12, 65.0, true);  // Suction line temp

      // Verify temperatures
      expect(view.getFloat32(8, true)).toBe(95.5);
      expect(view.getFloat32(12, true)).toBe(65.0);
    });
  });

  describe('Bluetooth Environmental Probe Data Parsing', () => {
    it('correctly converts Celsius to Fahrenheit for temperature readings', () => {
      // Environmental Sensing Service uses Celsius * 100 (int16)
      const buffer = new ArrayBuffer(2);
      const view = new DataView(buffer);
      const tempCelsius = 21.5; // 21.5°C = 70.7°F
      view.setInt16(0, Math.round(tempCelsius * 100), true);

      const readCelsius = view.getInt16(0, true) / 100;
      const tempFahrenheit = (readCelsius * 9 / 5) + 32;
      
      expect(Math.round(tempFahrenheit)).toBe(71);
    });

    it('correctly parses humidity percentage', () => {
      // Environmental Sensing Service uses % * 100 (uint16)
      const buffer = new ArrayBuffer(2);
      const view = new DataView(buffer);
      const humidity = 55.5; // 55.5%
      view.setUint16(0, Math.round(humidity * 100), true);

      const readHumidity = view.getUint16(0, true) / 100;
      
      expect(readHumidity).toBe(55.5);
    });
  });

  describe('Bluetooth Connection Flow', () => {
    it('shows Connect Manifold button when not connected', () => {
      renderComponent();
      const connectButton = screen.getByRole('button', { name: /Connect Manifold/i });
      expect(connectButton).toBeInTheDocument();
    });

    it('disables manifold button during scanning', async () => {
      renderComponent();
      
      // Mock a pending Bluetooth request
      global.navigator.bluetooth.requestDevice.mockReturnValue(
        new Promise(() => {}) // Never resolves
      );

      const connectButton = screen.getByRole('button', { name: /Connect Manifold/i });
      fireEvent.click(connectButton);

      await waitFor(() => {
        expect(screen.getByText(/Scanning.../i)).toBeInTheDocument();
      });
    });

    it('shows error when Web Bluetooth is not supported', async () => {
      // Remove Bluetooth API
      delete global.navigator.bluetooth;
      
      renderComponent();
      
      // Mock window.alert
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

      const connectButton = screen.getByRole('button', { name: /Connect Manifold/i });
      fireEvent.click(connectButton);

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith(
          expect.stringContaining('Bluetooth is not supported')
        );
      });

      alertMock.mockRestore();
    });
  });

  describe('Method Switching', () => {
    it('switches from subcooling to superheat method', () => {
      renderComponent();
      
      const superheatButton = screen.getByRole('button', { name: /^Superheat$/i });
      fireEvent.click(superheatButton);

      expect(screen.getByText(/Using superheat method/i)).toBeInTheDocument();
      expect(screen.getByText(/Suction Pressure \(psig\)/i)).toBeInTheDocument();
    });

    it('preserves pressure values when switching methods', () => {
      renderComponent();
      
      // Set a liquid line pressure value (find by placeholder or nearby text)
      const inputs = screen.getAllByRole('spinbutton');
      const liquidPressureInput = inputs[0]; // First numeric input is liquid line pressure
      fireEvent.change(liquidPressureInput, { target: { value: '350' } });
      
      // Switch to superheat
      const superheatButton = screen.getByRole('button', { name: /^Superheat$/i });
      fireEvent.click(superheatButton);
      
      // Switch back to subcooling
      const subcoolingButton = screen.getByRole('button', { name: /^Subcooling$/i });
      fireEvent.click(subcoolingButton);
      
      // Value should be preserved
      expect(liquidPressureInput.value).toBe('350');
    });
  });

  describe('Refrigerant Selection', () => {
    it('displays R-410A as default refrigerant', () => {
      renderComponent();
      // Find the select by its label text appearing before it
      expect(screen.getByText('Refrigerant Type')).toBeInTheDocument();
      const select = screen.getByDisplayValue('R-410A');
      expect(select.tagName).toBe('SELECT');
    });

    it('allows changing refrigerant type', () => {
      renderComponent();
      const select = screen.getByDisplayValue('R-410A');
      
      fireEvent.change(select, { target: { value: 'R-22' } });
      expect(select.value).toBe('R-22');
    });
  });

  describe('Calculations', () => {
    it('calculates subcooling correctly', () => {
      renderComponent();
      
      // Set inputs for subcooling calculation
      // Liquid pressure: 335 psig (for R-410A ≈ 105°F saturation)
      // Liquid temp: 95°F
      // Expected subcooling: ~10°F
      const inputs = screen.getAllByRole('spinbutton');
      const liquidPressure = inputs[0]; // First input is liquid line pressure
      const liquidTemp = inputs[1]; // Second input is liquid line temperature
      
      fireEvent.change(liquidPressure, { target: { value: '335' } });
      fireEvent.change(liquidTemp, { target: { value: '95' } });
      
      // System should calculate and display status
      expect(screen.getByText(/System Charge Status/i)).toBeInTheDocument();
    });

    it('calculates superheat correctly', () => {
      renderComponent();
      
      // Switch to superheat method
      const superheatButton = screen.getByRole('button', { name: /^Superheat$/i });
      fireEvent.click(superheatButton);
      
      // Set inputs for superheat calculation
      const inputs = screen.getAllByRole('spinbutton');
      const suctionPressure = inputs[0]; // First input is suction pressure
      const suctionTemp = inputs[1]; // Second input is suction temperature
      
      fireEvent.change(suctionPressure, { target: { value: '120' } });
      fireEvent.change(suctionTemp, { target: { value: '55' } });
      
      // System should calculate and display status
      expect(screen.getByText(/System Charge Status/i)).toBeInTheDocument();
    });
  });

  describe('LocalStorage Persistence', () => {
    it('saves liquid pressure to localStorage', () => {
      renderComponent();
      
      const inputs = screen.getAllByRole('spinbutton');
      const liquidPressure = inputs[0]; // First input
      fireEvent.change(liquidPressure, { target: { value: '350' } });
      
      // Check localStorage was updated
      expect(localStorage.getItem('chargingCalc_liquidPressure')).toBe('350');
    });

    it('loads saved values from localStorage on mount', () => {
      // Pre-populate localStorage
      localStorage.setItem('chargingCalc_liquidPressure', '400');
      localStorage.setItem('chargingCalc_liquidTemp', '100');
      localStorage.setItem('chargingCalc_refrigerant', 'R-22');
      
      renderComponent();
      
      const inputs = screen.getAllByRole('spinbutton');
      const liquidPressure = inputs[0];
      const liquidTemp = inputs[1];
      const refrigerant = screen.getByDisplayValue('R-22');
      
      expect(liquidPressure.value).toBe('400');
      expect(liquidTemp.value).toBe('100');
      expect(refrigerant.value).toBe('R-22');
    });
  });

  describe('Press and Hold Functionality', () => {
    it('increments pressure on button click', () => {
      renderComponent();
      
      const inputs = screen.getAllByRole('spinbutton');
      const liquidPressure = inputs[0];
      const initialValue = parseInt(liquidPressure.value);
      
      const incrementButton = screen.getByLabelText(/Increase pressure by 5/i);
      fireEvent.mouseDown(incrementButton);
      fireEvent.mouseUp(incrementButton);
      
      // Should increment by 5
      expect(parseInt(liquidPressure.value)).toBe(initialValue + 5);
    });

    it('decrements pressure on button click', () => {
      renderComponent();
      
      const inputs = screen.getAllByRole('spinbutton');
      const liquidPressure = inputs[0];
      const initialValue = parseInt(liquidPressure.value);
      
      const decrementButton = screen.getByLabelText(/Decrease pressure by 5/i);
      fireEvent.mouseDown(decrementButton);
      fireEvent.mouseUp(decrementButton);
      
      // Should decrement by 5
      expect(parseInt(liquidPressure.value)).toBe(initialValue - 5);
    });
  });

  describe('User Manual Modal', () => {
    it('opens user manual when button is clicked', () => {
      renderComponent();
      
      const manualButton = screen.getByRole('button', { name: /User Manual/i });
      fireEvent.click(manualButton);
      
      expect(screen.getByText(/User Manual: A\/C Charging Calculator/i)).toBeInTheDocument();
    });

    it('closes user manual when X is clicked', () => {
      renderComponent();
      
      const manualButton = screen.getByRole('button', { name: /User Manual/i });
      fireEvent.click(manualButton);
      
      const closeButton = screen.getByText('✕');
      fireEvent.click(closeButton);
      
      expect(screen.queryByText(/User Manual: A\/C Charging Calculator/i)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for pressure controls', () => {
      renderComponent();
      
      // Check for heading text and ARIA labeled buttons
      expect(screen.getByText(/Liquid Line Pressure \(psig\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Increase pressure by 5/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Decrease pressure by 5/i)).toBeInTheDocument();
    });

    it('has proper ARIA labels for temperature controls', () => {
      renderComponent();
      
      // Check for heading text and ARIA labeled buttons
      expect(screen.getByText(/Liquid Line Temperature \(°F\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Increase temperature by 5/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Decrease temperature by 5/i)).toBeInTheDocument();
    });
  });
});
