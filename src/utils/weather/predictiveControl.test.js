import { describe, it, expect } from "vitest";
import { computePreheatRecommendation } from "./predictiveControl";

describe("computePreheatRecommendation", () => {
  it("recommends preheat when temps dropping and need heating", () => {
    const outdoor = [38, 39, 37, 36, 35, 34];
    const rec = computePreheatRecommendation(68, 71, outdoor);
    expect(rec?.action).toBe("preheat");
    expect(rec.leadMinutes).toBe(45);
  });

  it("recommends precool when hot temps incoming and need cooling", () => {
    const outdoor = [86, 87, 88, 90, 89, 88];
    const rec = computePreheatRecommendation(76, 72, outdoor);
    expect(rec?.action).toBe("precool");
    expect(rec.leadMinutes).toBe(40);
  });

  it("returns null when no action needed", () => {
    const outdoor = [60, 61, 62, 63, 64, 65];
    const rec = computePreheatRecommendation(70, 70, outdoor);
    expect(rec).toBeNull();
  });

  it("handles insufficient data", () => {
    const outdoor = [40, 41];
    const rec = computePreheatRecommendation(68, 70, outdoor);
    expect(rec).toBeNull();
  });
});
