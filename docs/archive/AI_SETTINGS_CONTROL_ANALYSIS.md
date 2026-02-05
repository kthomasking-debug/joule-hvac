# AI Settings Control Analysis

## Why Was the Elevation Update Problem So Difficult?

The elevation update issue exposed several architectural problems that made it difficult to fix:

### 1. **Multiple State Sources (No Single Source of Truth)**

The `homeElevation` value was stored in **4 different places**:

- `localStorage.userSettings.homeElevation` (primary source)
- `localStorage.userLocation.elevation` (legacy/fallback)
- React state in `App.jsx` (`userSettings` state)
- Reducer state in `SevenDayCostForecaster.jsx` (`locHomeElevation`)

When Ask Joule updated `localStorage`, the component needed to:

1. Detect the change (storage events don't fire for same-tab changes)
2. Read from localStorage
3. Update React state
4. Sync reducer state
5. Re-render the UI

### 2. **State Synchronization Issues**

- **Storage events only fire for cross-tab changes** - same-tab updates require polling or custom events
- **Initialization order matters** - reducer state was being set before `localUserSettings` was fully initialized
- **Race conditions** - multiple `useEffect` hooks competing to set the same value

### 3. **Component-Specific State Management**

`SevenDayCostForecaster` uses its own reducer for location state, which created a disconnect:

- Ask Joule updates `localStorage.userSettings.homeElevation`
- Component reads from `localStorage.userLocation.elevation` on mount
- Reducer state (`locHomeElevation`) needs to sync with both sources
- `globalHomeElevation` calculation needs to prioritize the right source

### 4. **No Clear Hierarchy**

There was no clear precedence order:

- Should `userSettings.homeElevation` override `userLocation.elevation`?
- Should reducer state override both?
- What happens on page reload?

## Settings the AI CAN Control ✅

Based on `executeAskJouleCommand` and `askJouleParser.js`, the AI can control:

### Thermostat Settings

- ✅ `winterThermostat` - "Set winter to 68"
- ✅ `summerThermostat` - "Set summer to 74"
- ✅ Relative adjustments - "Make it warmer", "Turn it down 2 degrees"

### System Settings

- ✅ `capacity` - "Set capacity to 36"
- ✅ `coolingCapacity` - "Set cooling capacity to 30"
- ✅ `efficiency` (SEER) - "Set SEER to 18"
- ✅ `hspf2` - "Set HSPF to 10"
- ✅ `afue` - "Set AFUE to 0.95"
- ✅ `primarySystem` - "Set primary system to heat pump"
- ✅ `coolingSystem` - "Set cooling system to central AC"

### Building Settings

- ✅ `squareFeet` - "Set square feet to 2000"
- ✅ `insulationLevel` - "Set insulation to good"
- ✅ `ceilingHeight` - "Set ceiling height to 9"
- ✅ `homeShape` - "Set home shape to 1.0"
- ✅ `homeElevation` - "Set home elevation to 10000" ⚠️ (had sync issues, now fixed)
- ✅ `solarExposure` - "Set solar exposure to 1.2"

### Energy Settings

- ✅ `energyMode` - "Set energy mode to cooling"
- ✅ `useElectricAuxHeat` - "Turn on aux heat" / "Turn off aux heat"

### Cost Settings

- ✅ `utilityCost` - "Set utility cost to $0.12"
- ✅ `gasCost` - "Set gas cost to $1.20"

### Location Settings

- ✅ `location` (city/state) - "Set location to Denver, CO"

## Settings the AI CANNOT Control ❌

### Missing from Parser/Executor

1. **`useDetailedAnnualEstimate`** - Exists in `defaultSettings` but no parser rule or executor case
   - Impact: Low (UI-only setting)

### Separate State (Not in userSettings)

2. **`darkMode`** - Stored separately in `localStorage.darkMode`

   - Impact: Medium (user preference, but could be useful for AI to control)

3. **`isMuted` / `globalMuted`** - Stored separately in `localStorage.globalMuted`

   - Impact: Low (UI preference)

4. **`heatLossFactor`** - Separate React state, calculated from thermostat data

   - Impact: High (important for calculations, but derived, not directly settable)

5. **`manualTemp` / `manualHumidity`** - Separate React state for manual testing
   - Impact: Low (testing only)

### Thermostat-Specific Settings (from `thermostatSettings.js`)

6. **Equipment settings** - Wiring, heat pump type, reversing valve, etc.

   - Impact: Medium (advanced users might want AI control)

7. **Thresholds** - Compressor min/max runtime, aux heat lockout, etc.

   - Impact: Medium (advanced configuration)

8. **Comfort settings** - Home/away/sleep temperature presets

   - Impact: Low (AI can set temps directly)

9. **Schedule** - Daily schedule with time-based comfort settings

   - Impact: Medium (useful for automation)

10. **Sensor settings** - Temperature/humidity corrections, sensor enable/disable
    - Impact: Low (advanced configuration)

## Recommendations

### High Priority Fixes

1. **Add `useDetailedAnnualEstimate` control** - Simple parser rule + executor case
2. **Add `heatLossFactor` read access** - AI should be able to query this (it's calculated from data)

### Medium Priority Enhancements

3. **Add `darkMode` control** - "Switch to dark mode" / "Switch to light mode"
4. **Add threshold controls** - "Set compressor min runtime to 10 minutes"
5. **Add schedule controls** - "Set sleep mode to start at 10 PM"

### Architecture Improvements

6. **Create a unified settings manager** - Single source of truth for all settings
7. **Standardize state synchronization** - Use a consistent pattern for localStorage → React state → UI
8. **Add settings validation** - Ensure AI can't set invalid values
9. **Add settings audit log** - Track all AI-initiated changes (partially implemented)

## Current State

The elevation issue is **fixed** by:

- Prioritizing `localUserSettings.homeElevation` in `globalHomeElevation` calculation
- Adding polling + custom events for same-tab localStorage changes
- Syncing reducer state when `globalHomeElevation` changes
- Ensuring initialization order respects localStorage values

However, the **root cause** (multiple state sources, no single source of truth) still exists for other settings and could cause similar issues in the future.
