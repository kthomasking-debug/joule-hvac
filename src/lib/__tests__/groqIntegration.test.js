import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import * as groqAgent from "../groqAgent";
import { setupFetchMock, cleanupAllMocks } from "../../test/testHelpers";

 
let okResponse;
let cleanup;

describe("askJouleFallback", () => {
  beforeEach(() => {
    const mock = setupFetchMock();
    okResponse = mock.okResponse;
    // errorResponse from mock not currently used in tests
    cleanup = mock.cleanup;
  });

  afterEach(() => {
    cleanup();
    cleanupAllMocks();
  });

  test("returns text from SDK generateText", async () => {
    globalThis.fetch = vi.fn(async () =>
      okResponse({ choices: [{ message: { content: "mocked answer" } }] })
    );
    const ans = await groqAgent.askJouleFallback(
      "hello world",
      "SOME_KEY"
    );
    expect(ans.success).toBe(true);
    expect(ans.message).toBe("mocked answer");
  });

  test("returns friendly error when SDK throws", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("boom");
    });
    const ans = await groqAgent.askJouleFallback(
      "hello world",
      "SOME_KEY"
    );
    expect(ans.error).toBe(true);
    expect(typeof ans.message).toBe("string");
    expect(ans.message).toMatch(/request failed|failed/i);
  });

  test("returns missing key message when no key provided", async () => {
    // Pass empty string explicitly - function now respects explicit empty vs missing arg
    const ans = await groqAgent.askJouleFallback("hello world", "");
    expect(ans.error).toBe(true);
    expect(ans.needsSetup).toBe(true);
    expect(ans.message).toMatch(/key missing/i);
  });
});
