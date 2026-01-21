# Settings Refactoring Summary

## What Was Done

### 1. ✅ Created Unified Settings Manager (`src/lib/unifiedSettingsManager.js`)

A single source of truth for all application settings that provides:

- **Single Source of Truth**: All settings defined in `DEFAULT_SETTINGS`
- **Validation**: Every setting has a validator that checks ranges, types, and valid values
- **Reactive Updates**: Custom events (`userSettingsUpdated`) for same-tab changes
- **Type Safety**: Validators ensure correct data types
- **Error Handling**: Returns success/error objects with helpful messages

**Key Functions:**
- `getAllSettings()` - Get all settings from localStorage
- `getSetting(key)` - Get a specific setting
- `setSetting(key, value, meta)` - Set a setting with validation
- `validateSetting(key, value)` - Validate a setting without setting it
- `setSeparateSetting(key, value)` - For settings not in userSettings (darkMode, isMuted)
- `setSettings(updates, meta)` - Batch update multiple settings
- `resetSetting(key)` - Reset to default
- `resetAllSettings()` - Reset all to defaults

### 2. ✅ Added Missing Settings Support

**Parser Rules Added** (`src/utils/askJouleParser.js`):
- `setUseDetailedAnnualEstimate` - Enable/disable detailed annual estimates
- `setDarkMode` - Switch to dark/light mode
- `toggleDarkMode` - Toggle between dark and light mode

**Executor Cases Added** (`src/components/AskJoule.jsx`):
- `setUseDetailedAnnualEstimate` - Updates `useDetailedAnnualEstimate` setting
- `setDarkMode` / `toggleDarkMode` - Updates dark mode (separate setting, not in userSettings)

### 3. ✅ Added Validation for All Settings

**Validation Rules** (in `SETTING_VALIDATORS`):
- **Capacity**: Must be one of [18, 24, 30, 36, 42, 48, 60]
- **Efficiency (SEER)**: Must be between 13 and 22
- **HSPF2**: Must be between 6 and 13
- **AFUE**: Must be between 0.6 and 0.99
- **Thermostat Settings**: Must be between 50 and 85°F
- **Square Feet**: Must be between 100 and 10,000
- **Insulation Level**: Must be between 0.3 and 2.0
- **Home Elevation**: Must be between -500 and 15,000 feet
- **Utility Cost**: Must be between $0.05 and $1.00 per kWh
- **Gas Cost**: Must be between $0.50 and $5.00 per therm
- **And more...**

**Error Messages**: Each validator returns helpful error messages when validation fails.

### 4. ✅ Refactored App.jsx

**Changes:**
- Imports `DEFAULT_SETTINGS` from unified settings manager
- Initializes `userSettings` from `getAllSettings()`
- Listens to `userSettingsUpdated` events to sync React state
- `setUserSetting()` now uses `setSetting()` from unified manager with validation
- Removed redundant `useEffect` that persisted userSettings (unified manager handles it)
- Maintains audit log functionality

### 5. ✅ Updated AskJoule Component

**Changes:**
- Imports unified settings manager functions
- Key setting update cases now use `setSetting()` with validation:
  - `setWinterTemp`
  - `setSummerTemp`
  - `setHSPF`
  - `setSEER`
  - `setHomeElevation`
- Shows validation errors to user when settings fail validation
- Still calls `onSettingChange` prop for backward compatibility

## Why This Was Difficult Before

The elevation update problem exposed several architectural issues:

1. **Multiple State Sources**: Settings stored in 4+ places (localStorage.userSettings, localStorage.userLocation, React state, reducer state)
2. **No Single Source of Truth**: Unclear which source takes precedence
3. **State Synchronization Issues**: Storage events don't fire for same-tab changes
4. **No Validation**: Invalid values could be set, causing bugs
5. **Component-Specific State**: Some components had their own state management

## How This Fixes It

1. **Single Source of Truth**: All settings defined in `DEFAULT_SETTINGS` in unified manager
2. **Reactive Updates**: Custom events ensure all components stay in sync
3. **Validation**: Invalid values are rejected with helpful error messages
4. **Type Safety**: Validators ensure correct data types
5. **Centralized Logic**: All setting updates go through one function

## Settings the AI Can Now Control

### ✅ Fully Supported (with validation):
- Thermostat: `winterThermostat`, `summerThermostat`
- System: `capacity`, `efficiency` (SEER), `hspf2`, `afue`, `primarySystem`, `coolingSystem`, `coolingCapacity`
- Building: `squareFeet`, `insulationLevel`, `homeShape`, `ceilingHeight`, `homeElevation`, `solarExposure`
- Energy: `energyMode`, `useElectricAuxHeat`
- Cost: `utilityCost`, `gasCost`
- UI: `useDetailedAnnualEstimate`
- Theme: `darkMode` (separate setting)

### ⚠️ Settings Not Yet Supported:
- `location` (city/state string) - Has special handling in App.jsx
- Other settings in `defaultSettings` that don't have parser rules yet

## Testing Recommendations

1. **Test Validation**: Try setting invalid values (e.g., "set winter to 200") and verify error messages
2. **Test Missing Settings**: Try "enable detailed annual estimate" and "switch to dark mode"
3. **Test State Sync**: Update a setting in Ask Joule and verify it updates in other components
4. **Test Elevation**: Update elevation via Ask Joule and verify it reflects in forecast section
5. **Test Cross-Tab**: Open app in two tabs, update a setting in one, verify it updates in the other

## Next Steps

1. Add parser rules for remaining settings (if needed)
2. Add more comprehensive validation rules (if needed)
3. Add unit tests for unified settings manager
4. Add integration tests for settings updates
5. Document all available settings and their valid ranges

