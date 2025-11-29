import { describe, it, expect } from "vitest";
import { resolvePronouns } from "../contextResolver";

describe("resolvePronouns", () => {
  const history = [
    { intent: "setTemperature", response: "Temperature set to 70" },
    { intent: "setMode", response: "Switched to cool mode" },
  ];
  it("replaces it with temperature", () => {
    const out = resolvePronouns("Increase it by 2", history.slice(0, 1));
    expect(out).toBe("Increase temperature by 2");
  });
  it("replaces that with mode", () => {
    const out = resolvePronouns("Change that to heat", history);
    expect(out).toBe("Change mode to heat");
  });
  it("no replacement when no pronoun", () => {
    expect(resolvePronouns("Set temperature to 72", history)).toBe(
      "Set temperature to 72"
    );
  });
  it("no replacement if no referent found", () => {
    expect(resolvePronouns("Change it now", [])).toBe("Change it now");
  });
});
