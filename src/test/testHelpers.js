/**
 * Centralized test helpers for mocking browser APIs
 */
import { vi } from "vitest";

/**
 * Setup SpeechSynthesis and SpeechSynthesisUtterance mocks
 * Returns cleanup function to restore original state
 */
export function setupSpeechSynthesisMock() {
  const originalSpeechSynthesis = globalThis.speechSynthesis;
  const originalSpeechSynthesisUtterance = globalThis.SpeechSynthesisUtterance;

  const utterances = [];

  // Polyfill SpeechSynthesisUtterance for test environments
  globalThis.SpeechSynthesisUtterance = function (text) {
    this.text = text;
    this.rate = 1;
    this.pitch = 1;
    this.onend = null;
  };

  globalThis.speechSynthesis = {
    speak: (utter) => {
      utterances.push(utter);
      // Simulate async completion
      setTimeout(() => utter.onend && utter.onend(), 0);
    },
    cancel: () => {
      // Clear pending utterances when cancel is called
      utterances.length = 0;
    },
    getVoices: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  const originalTtsPref =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("askJouleSpeechEnabled")
      : null;
  try {
    localStorage.setItem("askJouleSpeechEnabled", "true");
  } catch (e) {
    /* ignore */
  }

  // Cleanup function
  const cleanup = () => {
    globalThis.speechSynthesis = originalSpeechSynthesis;
    globalThis.SpeechSynthesisUtterance = originalSpeechSynthesisUtterance;
    try {
      if (originalTtsPref === null || originalTtsPref === undefined) {
        localStorage.removeItem("askJouleSpeechEnabled");
      } else {
        localStorage.setItem("askJouleSpeechEnabled", originalTtsPref);
      }
    } catch (e) {
      /* ignore */
    }
  };

  return { utterances, cleanup };
}

/**
 * Setup fetch mock with helper functions for common response patterns
 * Returns cleanup function to restore original fetch
 */
export function setupFetchMock() {
  const originalFetch = globalThis.fetch;

  // Helper to create successful JSON responses
  const okResponse = (data) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
    });

  // Helper to create error responses
  const errorResponse = (status = 500, text = "Internal Server Error") =>
    Promise.resolve({
      ok: false,
      status,
      text: () => Promise.resolve(text),
      json: () => Promise.reject(new Error("Failed to parse JSON")),
    });

  // Default mock that can be overridden
  globalThis.fetch = vi.fn(async () =>
    okResponse({ message: "mock response" })
  );

  // Cleanup function
  const cleanup = () => {
    globalThis.fetch = originalFetch;
  };

  return { okResponse, errorResponse, cleanup };
}

/**
 * Combined cleanup for all mocks - call in afterEach
 */
export function cleanupAllMocks() {
  // Restore fetch if it was mocked
  if (globalThis.fetch && globalThis.fetch.mockRestore) {
    globalThis.fetch.mockRestore();
  }

  // Clear any vitest mocks
  vi.clearAllMocks();
}
