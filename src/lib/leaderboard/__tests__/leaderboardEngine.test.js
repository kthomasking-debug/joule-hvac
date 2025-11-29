import { describe, it, expect } from "vitest";
import {
  getRegionFromState,
  computePercentile,
  getLeaderboardData,
} from "../leaderboardEngine";

describe("leaderboardEngine", () => {
  it("maps states to correct regions", () => {
    expect(getRegionFromState("CA")).toBe("Pacific");
    expect(getRegionFromState("NY")).toBe("Northeast");
    expect(getRegionFromState("TX")).toBe("Southwest");
    expect(getRegionFromState("IL")).toBe("Midwest");
  });

  it("computes percentile from regional data", () => {
    const regional = { p25: 50, p50: 70, p75: 85, p90: 95 };
    expect(computePercentile(50, regional)).toBe(25);
    expect(computePercentile(70, regional)).toBe(50);
    expect(computePercentile(85, regional)).toBeGreaterThanOrEqual(75);
  });

  it("returns full leaderboard data for a given score and state", () => {
    const data = getLeaderboardData(80, "CA");
    expect(data.region).toBe("Pacific");
    expect(data.jouleScore).toBe(80);
    expect(data.percentile).toBeGreaterThan(0);
    expect(data.regionalAvg).toBeGreaterThan(0);
    expect(data.participantCount).toBeGreaterThan(0);
  });
});
