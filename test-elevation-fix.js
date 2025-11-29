// Manual test: Verify elevation is correctly extracted and converted
import {
  fetchGeocodeCandidates,
  chooseBestCandidate,
} from "./src/utils/geocode.js";

async function testElevation() {
  console.log("\n=== Testing Geocoding Elevation Extraction ===\n");

  // Test Denver
  const candidates = await fetchGeocodeCandidates("Denver");
  const best = chooseBestCandidate(candidates);

  console.log("Best match:", {
    name: best.name,
    admin1: best.admin1,
    latitude: best.latitude,
    longitude: best.longitude,
    elevation_meters: best.elevation,
  });

  // Convert to feet like the app does
  const elevationInFeet = best.elevation
    ? Math.round(best.elevation * 3.28084)
    : 0;

  console.log(
    `\nElevation: ${best.elevation} meters = ${elevationInFeet} feet`
  );
  console.log(`Expected: ~1609 meters = ~5280 feet`);

  if (elevationInFeet > 5000 && elevationInFeet < 6000) {
    console.log("✅ PASS: Elevation is correctly extracted and converted!");
  } else {
    console.log("❌ FAIL: Elevation is incorrect");
  }

  // Simulate what AskJoule setLocation does
  console.log("\n=== Simulating AskJoule setLocation ===\n");

  const city = best.name;
  const state = best.admin1 || "";
  const latitude = best.latitude;
  const longitude = best.longitude;
  const elevation = elevationInFeet;

  const locationObj = { city, state, latitude, longitude, elevation };
  const userSettings = {
    city: `${city}${state ? ", " + state : ""}`,
    latitude,
    longitude,
    homeElevation: elevation,
  };

  console.log("userLocation:", locationObj);
  console.log("userSettings:", userSettings);

  if (locationObj.elevation > 5000 && userSettings.homeElevation > 5000) {
    console.log(
      "\n✅ SUCCESS: Both userLocation and userSettings have elevation data!"
    );
  } else {
    console.log("\n❌ FAILURE: Missing elevation data");
  }
}

testElevation().catch(console.error);
