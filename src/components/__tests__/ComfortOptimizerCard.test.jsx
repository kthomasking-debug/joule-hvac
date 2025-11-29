/* @vitest-environment jsdom */
import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ComfortOptimizerCard from "../ComfortOptimizerCard";

describe("ComfortOptimizerCard", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders a schedule and applies it to localStorage", () => {
    const settings = { winterThermostat: 70, summerThermostat: 74 };
    const learning = [
      { kind: "winter", hour: 6, prev: 68, next: 70, ts: new Date().toISOString() },
      { kind: "winter", hour: 7, prev: 68, next: 70, ts: new Date().toISOString() },
      { kind: "winter", hour: 5, prev: 67, next: 69, ts: new Date().toISOString() },
    ];
    render(<ComfortOptimizerCard settings={settings} forecast={null} learningEvents={learning} />);

    // Verify rows rendered
    expect(screen.getByText(/AI Comfort Optimizer/i)).toBeInTheDocument();
    expect(screen.getByText(/morning_prewarm/)).toBeInTheDocument();

    // Apply
    fireEvent.click(screen.getByRole('button', { name: /apply plan/i }));
    const raw = localStorage.getItem('optimizerSchedule');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(Array.isArray(parsed.blocks)).toBe(true);
  });

  it("shows Plan Active indicator when schedule exists in localStorage", () => {
    localStorage.setItem("optimizerSchedule", JSON.stringify({ blocks: [{ hour: 0, setpoint: 68 }] }));
    const settings = { winterThermostat: 70 };
    render(<ComfortOptimizerCard settings={settings} forecast={null} learningEvents={[]} />);
    expect(screen.getByText(/Plan Active/i)).toBeInTheDocument();
  });

  it("allows clearing active plan", () => {
    localStorage.setItem("optimizerSchedule", JSON.stringify({ blocks: [{ hour: 0, setpoint: 68 }] }));
    localStorage.setItem("optimizerScheduleAppliedAt", new Date().toISOString());
    const settings = { winterThermostat: 70 };
    render(<ComfortOptimizerCard settings={settings} forecast={null} learningEvents={[]} />);
    
    const clearBtn = screen.getByTitle(/Clear active plan/i);
    fireEvent.click(clearBtn);
    
    expect(localStorage.getItem("optimizerSchedule")).toBeNull();
    expect(localStorage.getItem("optimizerScheduleAppliedAt")).toBeNull();
  });

  it('calls onApplyBlock when applying a single block', () => {
    const settings = { winterThermostat: 70 };
    const learning = [];
    const onApplyBlock = vi.fn();
    render(<ComfortOptimizerCard settings={settings} forecast={null} learningEvents={learning} onApplyBlock={onApplyBlock} />);
    // Assuming at least one Apply This button exists
    const applyThisBtn = screen.getAllByText(/Apply This/i)[0];
    expect(applyThisBtn).toBeTruthy();
    fireEvent.click(applyThisBtn);
    expect(onApplyBlock).toHaveBeenCalled();
  });

  it('toggles auto-pilot and persists in localStorage', () => {
    const settings = { winterThermostat: 70 };
    render(<ComfortOptimizerCard settings={settings} forecast={null} learningEvents={[]} />);
    const toggleBtn = screen.getByText(/Auto-pilot/i).nextSibling; // The button
    expect(toggleBtn).toBeTruthy();
    fireEvent.click(toggleBtn);
    expect(localStorage.getItem('optimizerAutoPilot')).toBe('true');
    fireEvent.click(toggleBtn);
    expect(localStorage.getItem('optimizerAutoPilot')).toBe('false');
  });
});
