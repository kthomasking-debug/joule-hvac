# Playwright Tests Update Summary

## Overview
Updated Playwright E2E tests to match the current application structure after large-scale code changes.

## Changes Made

### 1. Route Updates in `app.spec.js`

Updated all route paths to match the new navigation structure:

| Old Route | New Route | Notes |
|-----------|-----------|-------|
| `/` | `/home` | Home page moved to dedicated route |
| `/settings` | `/config` | Settings renamed to Config |
| `/forecast` | `/analysis/forecast` | Forecast moved under Analysis section |
| `/analyzer` | `/analysis/analyzer` | Analyzer moved under Analysis section |
| `/budget` | `/analysis/budget` | Budget moved under Analysis section |
| `/upgrade` | `/upgrade-roi` | Upgrade ROI route updated |
| `/energy-flow` | `/energy-flow` | No change |

### 2. Ask Joule Parser Tests

The Ask Joule parser tests (`ask-joule-questions.spec.js`, `ask-joule-commands.spec.js`, `ask-joule-100-questions.spec.js`) are **still compatible** with the current parser API:

- ✅ Parser still exports `parseAskJoule` as default and named export
- ✅ Parser still returns objects with `isCommand`, `action`, `isSalesQuery` properties
- ✅ Tests correctly handle `offlineAnswer` action type
- ⚠️ Linter warnings about import paths are false positives (browser-side imports work at runtime)

### 3. Test Structure

All tests maintain their original structure and logic:
- Terms acceptance modal handling
- Firefox-specific retry logic
- Browser compatibility checks
- Parser validation logic

## Files Modified

1. `tests/e2e/app.spec.js` - Updated all route paths

## Files Unchanged (Still Compatible)

1. `tests/e2e/ask-joule-questions.spec.js` - No changes needed
2. `tests/e2e/ask-joule-commands.spec.js` - No changes needed
3. `tests/e2e/ask-joule-100-questions.spec.js` - No changes needed
4. `playwright.config.js` - No changes needed

## Next Steps

1. Run the tests to verify they pass:
   ```bash
   npm run test:e2e
   # or
   npx playwright test
   ```

2. If any tests fail, check:
   - Server is running on `http://localhost:5173`
   - All routes are accessible
   - Ask Joule parser is loading correctly

3. Consider adding tests for new routes:
   - `/analysis/compare` (Gas vs Heat Pump)
   - `/control` (Thermostat and Air Quality)
   - `/hardware` (Documentation)

## Notes

- Legacy routes (like `/settings` → `/config`) still work via redirects, but tests now use the canonical routes
- The parser tests use browser-side imports (`/src/utils/askJouleParser.js`) which work correctly at runtime despite linter warnings
- All tests maintain backward compatibility with the existing test infrastructure



