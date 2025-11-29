import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSpeechRecognition } from "../useSpeechRecognition";

class MockRec {
  constructor() {
    this.lang = "en-US";
    this.continuous = true;
    this.interimResults = true;
    this._listeners = {};
  }
  start() {
    this.onstart && this.onstart();
    // simulate interim then final
    setTimeout(() => {
      const evt = {
        results: [
          { 0: { transcript: "hello " }, isFinal: false },
          { 0: { transcript: "world" }, isFinal: true },
        ],
      };
      this.onresult && this.onresult(evt);
      this.onend && this.onend();
    }, 10);
  }
  stop() {
    this.onend && this.onend();
  }
  abort() {}
}

beforeEach(() => {
  global.webkitSpeechRecognition = MockRec;
  global.SpeechRecognition = MockRec;
});

describe("useSpeechRecognition live flow", () => {
  it("captures interim and final transcripts and auto restarts", async () => {
    const finals = [];
    const interims = [];
    const { result } = renderHook(() =>
      useSpeechRecognition({
        onFinal: (t) => finals.push(t),
        onInterim: (c) => interims.push(c),
      })
    );
    expect(result.current.supported).toBe(true);
    act(() => {
      result.current.startListening();
    });
    // wait for async (wrap updates in act to silence warnings)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40));
    });
    expect(result.current.transcript).toMatch(/hello world/);
    expect(interims.some((c) => c.includes("hello"))).toBe(true);
    expect(finals[0]).toMatch(/hello world/);
  });
});
