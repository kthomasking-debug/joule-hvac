// src/hooks/__tests__/useVoiceFeedback.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import useVoiceFeedback from "../useVoiceFeedback";

describe("useVoiceFeedback", () => {
  beforeEach(() => {
    // Mock SpeechSynthesisUtterance
    global.SpeechSynthesisUtterance = vi.fn(function (text) {
      this.text = text;
      this.rate = 1.0;
      this.pitch = 1.0;
      this.volume = 1.0;
      this.onstart = null;
      this.onend = null;
      this.onerror = null;
    });

    // Mock speechSynthesis
    global.speechSynthesis = {
      cancel: vi.fn(),
      speak: vi.fn(),
    };

    // Mock localStorage
    global.localStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    };
  });

  it("initializes with isSpeaking false", () => {
    const { result } = renderHook(() => useVoiceFeedback());
    expect(result.current.isSpeaking).toBe(false);
  });

  it("provides speak and stop functions", () => {
    const { result } = renderHook(() => useVoiceFeedback());
    expect(typeof result.current.speak).toBe("function");
    expect(typeof result.current.stop).toBe("function");
    expect(typeof result.current.humanize).toBe("function");
  });

  it("calls speechSynthesis.speak when speak is called", async () => {
    const { result } = renderHook(() => useVoiceFeedback());

    await result.current.speak("Test message");

    expect(global.speechSynthesis.speak).toHaveBeenCalled();
  });

  it("cancels speech when stop is called", () => {
    const { result } = renderHook(() => useVoiceFeedback());

    result.current.stop();

    expect(global.speechSynthesis.cancel).toHaveBeenCalled();
  });
});
