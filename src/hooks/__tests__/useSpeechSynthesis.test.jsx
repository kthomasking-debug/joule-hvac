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
    // wait microtasks
    await new Promise((r) => setTimeout(r, 10));
    expect(utterances.length).toBeGreaterThanOrEqual(1);
    expect(
      utterances[0].text.startsWith("Sure thing! First sentence. Second.")
    ).toBe(true);
  });

  it("immediate speak cancels queue", async () => {
    const { speak, speakImmediate } = globalThis.__TTS_API__;
    act(() => {
      speak("A. B. C.");
      speakImmediate("Only this now.");
    });
    await new Promise((r) => setTimeout(r, 10));
    // First utter after immediate should correspond to new text
    expect(utterances[0].text.includes("Only this now.")).toBe(true);
  });
});
