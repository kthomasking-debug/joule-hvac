/* eslint-disable no-unused-vars */
// src/setupTests.js
import "@testing-library/jest-dom";

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {
    // Mock implementation
  }
  unobserve() {
    // Mock implementation
  }
  disconnect() {
    // Mock implementation
  }
};

// Optional: suppress or filter noisy console output during tests to keep CI logs clean.
// We keep the originals so tests can still assert on console functions when needed.
const _origConsoleError = console.error;
const _origConsoleWarn = console.warn;

// Allowlist for console messages we intentionally ignore during unit tests.
const ignoredConsolePatterns = [
  /Bluetooth is not supported/,
  /Invalid state code for EIA API/,
  /Could not find state code for:/,
  /Failed to fetch historical data/,
  /Error fetching historical data/,
  /Groq API error/,
  /Some Joyride targets are not yet mounted/,
  /No match for "/,
  /computeHourlyCoolingPerformance received invalid inputs/,
  /Manifold BLE connection error:/,
  /Failed to fetch or parse utility rates:/,
  /Failed to parse chargingJobHistory/,
];

console.error = (...args) => {
  try {
    const message = String(args[0] || "");
    if (ignoredConsolePatterns.some((rx) => rx.test(message))) return;
  } catch (e) {
    // If anything goes wrong while filtering, fallback to original
  }
  _origConsoleError.apply(console, args);
};

console.warn = (...args) => {
  try {
    const message = String(args[0] || "");
    if (ignoredConsolePatterns.some((rx) => rx.test(message))) return;
  } catch (e) {
    // If anything goes wrong while filtering, fallback to original
  }
  _origConsoleWarn.apply(console, args);
};
