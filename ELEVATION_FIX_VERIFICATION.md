# Elevation Data Fix - Verification Report

## Issue

Denver (and all locations) were showing "Elev: 0 ft" instead of the correct elevation because:

1. The `fetchGeocodeCandidates` utility function wasn't extracting the `elevation` field from the geocoding API
2. The `setLocation` command in AskJoule wasn't saving elevation data

## Fix Applied

### 1. Updated `src/utils/geocode.js`

Added `elevation` field extraction in both functions:

- `fetchGeocodeCandidates`: Now extracts `elevation: r.elevation || 0`
- `reverseGeocode`: Now extracts `elevation: r.elevation || 0`

### 2. Updated `src/components/AskJoule.jsx` `setLocation` action

Now properly extracts and saves elevation:

```javascript
const elevationInFeet = best.elevation
  ? Math.round(best.elevation * 3.28084)
  : 0;

// Save to userLocation
const locationObj = {
  city,
  state,
  latitude,
  longitude,
  elevation: elevationInFeet,
};

// Save to userSettings
userSettings.homeElevation = elevationInFeet;

// Updated confirmation message
message = `Location set to ${city}${
  state ? ", " + state : ""
} (${elevationInFeet} ft).`;
```

## Verification

### Unit Test - ✅ PASSED

```
npm test -- src/utils/__tests__/geocode.test.js

✓ Geocoding Elevation (1)
  ✓ should fetch elevation data for Denver  544ms
```

### Manual Verification - ✅ PASSED

```
node test-elevation-fix.js

=== Testing Geocoding Elevation Extraction ===

Best match: {
  name: 'Denver',
  admin1: 'Colorado',
  latitude: 39.73915,
  longitude: -104.9847,
  elevation_meters: 1609
}

Elevation: 1609 meters = 5279 feet
Expected: ~1609 meters = ~5280 feet
✅ PASS: Elevation is correctly extracted and converted!

=== Simulating AskJoule setLocation ===

userLocation: {
  city: 'Denver',
  state: 'Colorado',
  latitude: 39.73915,
  longitude: -104.9847,
  elevation: 5279
}
userSettings: {
  city: 'Denver, Colorado',
  latitude: 39.73915,
  longitude: -104.9847,
  homeElevation: 5279
}

✅ SUCCESS: Both userLocation and userSettings have elevation data!
```

## What Works Now

1. **Onboarding**: When users enter their location during onboarding in the 7-Day Forecaster, the elevation will be fetched from the geocoding API and saved to both `userLocation.elevation` and `userSettings.homeElevation`

2. **AI setLocation Command**: When users use Ask Joule to set their location (e.g., "set my location to Denver"), the elevation is now:

   - Fetched from the geocoding API
   - Converted from meters to feet
   - Saved to `userLocation.elevation`
   - Saved to `userSettings.homeElevation`
   - Displayed in the confirmation message

3. **Data Format**:
   - API returns elevation in **meters** (e.g., Denver = 1609m)
   - App converts to **feet** (1609m × 3.28084 = 5279 ft)
   - Stores as integer in localStorage

## Files Modified

- `src/utils/geocode.js` - Added elevation extraction
- `src/components/AskJoule.jsx` - Updated setLocation to save elevation
- `src/pages/Home.jsx` - Added "Run Onboarding" link for easy re-setup

## Test Files Created

- `src/utils/__tests__/geocode.test.js` - Unit test for elevation extraction
- `test-elevation-fix.js` - Manual verification script
- `e2e/elevation-data.spec.ts` - E2E tests (requires dev server configuration)
