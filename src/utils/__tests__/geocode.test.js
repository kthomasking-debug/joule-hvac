import { describe, it, expect } from "vitest";
import { fetchGeocodeCandidates } from "../geocode";

describe("Geocoding Elevation", () => {
  it("should fetch elevation data for Denver", async () => {
    const candidates = await fetchGeocodeCandidates("Denver");

    expect(candidates).toBeDefined();
    expect(candidates.length).toBeGreaterThan(0);

    const denver = candidates[0];
    expect(denver.name).toBe("Denver");
    expect(denver.elevation).toBeDefined();
    expect(denver.elevation).toBeGreaterThan(1500); // ~1609 meters
    expect(denver.elevation).toBeLessThan(1700);

    // Convert to feet to verify
    const elevationInFeet = Math.round(denver.elevation * 3.28084);
    expect(elevationInFeet).toBeGreaterThan(5000);
    expect(elevationInFeet).toBeLessThan(6000);
  });
});
