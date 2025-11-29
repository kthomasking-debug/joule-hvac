/* @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import useThermostatLearning, {
  getThermostatLearningEvents,
} from "../../hooks/useThermostatLearning";

function Wrapper({ winter, summer }) {
  useThermostatLearning({ winterThermostat: winter, summerThermostat: summer });
  return <div>ok</div>;
}

describe("useThermostatLearning", () => {
  it("records an event when winter thermostat changes", () => {
    localStorage.removeItem("learningEvents");
    const { rerender } = render(<Wrapper winter={70} summer={74} />);
    rerender(<Wrapper winter={72} summer={74} />);
    const events = getThermostatLearningEvents();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
    expect(events[events.length - 1].kind).toBe("winter");
    expect(events[events.length - 1].next).toBe(72);
  });
});
