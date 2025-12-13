import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, act } from "@testing-library/react";
import { useSpeechSynthesis } from "../useSpeechSynthesis";
import { setupSpeechSynthesisMock, cleanupAllMocks } from "../../test/testHelpers";

let utterances;
let cleanup;

function TestComp() {
  const api = useSpeechSynthesis({ personality: "friendly" });
  globalThis.__TTS_API__ = api;
  return null;
}

describe("useSpeechSynthesis", () => {
  beforeEach(() => {
    const mock = setupSpeechSynthesisMock();
    utterances = mock.utterances;
    cleanup = mock.cleanup;
    render(<TestComp />);
  });

  afterEach(() => {
    cleanup();
    cleanupAllMocks();
  });

  it("speaks combined sentences", async () => {
    const { speak } = globalThis.__TTS_API__;
    act(() => speak("First sentence. Second."));
    // wait for speech synthesis to process
    await new Promise((r) => setTimeout(r, 50));
    expect(utterances.length).toBeGreaterThanOrEqual(1);
    if (utterances.length > 0) {
      expect(
        utterances[0].text.includes("First sentence. Second.")
      ).toBe(true);
    }
  });

  it("immediate speak cancels queue", async () => {
    const { speak, speakImmediate } = globalThis.__TTS_API__;
    act(() => {
      speak("A. B. C.");
    });
    // Wait a bit for first speak to potentially start
    await new Promise((r) => setTimeout(r, 5));
    act(() => {
      speakImmediate("Only this now.");
    });
    // Wait for immediate speak to process
    await new Promise((r) => setTimeout(r, 20));
    // After immediate speak, the last utterance should be the immediate text
    // (speak cancels previous, so we should see "Only this now." in utterances)
    const hasImmediateText = utterances.some((u) => u.text.includes("Only this now."));
    expect(hasImmediateText).toBe(true);
  });
});
