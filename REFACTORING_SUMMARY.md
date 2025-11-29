# Refactoring Summary: Ask Joule Command Parsing & Diagnostics Integration

## Overview

This refactor extracted and integrated a unified natural-language command parser (`parseCommand`) for Ask Joule, added comprehensive unit + integration tests, and stabilized the diagnostics + CSV persistence workflow.

## Goals Achieved

- Eliminate duplicated parsing logic inside `AskJoule.jsx`.
- Provide isolated test coverage for all command patterns.
- Ensure Ask Joule component emits structured command objects prior to fallback structured parameter parsing.
- Validate CSV persistence and diagnostics linkage in System Performance Analyzer.

## 1. ✅ Extracted & Integrated `parseCommand` Module

**File Created:** `src/components/askJouleParser.js` (recreated from earlier simplified version)
**Integration:** `AskJoule.jsx` imports `parseCommand` and prioritizes command parsing before structured parameter extraction via internal `parseAskJoule`.
**Command Object:** Shape example: `{ action: 'increaseTemp', value: 3, raw: 'raise temp 3 degrees', isCommand: true }`
**Benefits:**

- Centralized command syntax—easy extension.
- Pure function enables fast isolated testing.
- Reduced complexity in `AskJoule.jsx` submit handler.
- Future-ready for routing/side-effect mapping.

## 2. ✅ Comprehensive Parser Unit Tests

**File:** `src/components/__tests__/askJouleParser.test.js`
**Count:** 51 tests.
**Coverage Areas:**

- Temperature adjustments (raise/lower/set).
- Presets (comfort/eco/night/sleep/etc.).
- Efficiency upgrades (SEER/HSPF what-if scenarios).
- Direct property sets (square feet with commas or k suffix, insulation, temp).
- Navigation commands (forecast, comparison, balance, charging, analyzer, methodology, settings, strategies, budget, ROI).
- Diagnostics queries (short cycling, aux heat, temp stability, show diagnostics, CSV info).
- Educational queries (HVAC concepts, efficiency metrics).
- Help/status/undo fallback.
- Edge cases (commas, suffixes, flexible phrasing).

## 3. ✅ Integration Tests Added

**Files:**

- `src/pages/__tests__/SystemPerformanceAnalyzerIntegration.test.jsx`
- `src/components/__tests__/AskJouleIntegration.test.jsx`
  **Coverage:**
- Persistence of parsed CSV & diagnostics across remount.
- Analyzer flow sanity: localStorage keys, timestamp, filename.
- Ask Joule command emission & fallback structured parsing.
- Location optionality for direct commands vs. structured queries.

## Test Summary

```
Parser Unit Tests: 51 passed
Analyzer Integration Tests: 2 passed
AskJoule Component Integration Tests: 4 passed
Total (affected): 57 passed
```

## Key Implementation Details

- `AskJoule.jsx` submit handler now: (1) run `parseCommand`; if `isCommand`, emit immediately; else (2) run internal structured parsing for parameters like cityName, squareFeet, insulationLevel, indoorTemp.
- LocalStorage keys touched (Analyzer): `spa_parsedCsvData`, `spa_diagnostics`, `spa_uploadTimestamp`, `spa_filename`.
- Diagnostics taxonomy currently includes: `short_cycling`, `excessive_aux_heat`, `temperature_instability`, `inefficient_runtime`.

## Regex Enhancements

- Added optional `k` suffix for square footage (e.g., "2k sq ft").
- Comma-separated number normalization ("2,400" → 2400).
- Broadened what-if phrasing for HSPF/SEER upgrades ("what if I upgraded to 16 seer").
- Aux heat detection without requiring problem word coupling.

## Benefits Realized

- Faster iteration: adding a new command requires only editing `askJouleParser.js` + a new test.
- Cleaner component: minimal branching logic; easier UI evolution.
- Stronger reliability: 57 green tests across command & integration layers.

## Pending / Next Steps

1. Add user-facing help modal listing supported command phrases.
2. TypeScript migration for parser return types (`ParseCommandResult` interface).
3. Wire command actions to routed navigation (e.g., `action: 'openForecast'` triggers route change).
4. Surface diagnostics summaries directly in Ask Joule responses for diagnostic queries.
5. Add end-to-end diagnostic activation test (parse → action → UI state change).
6. Implement optional debouncing to prevent rapid consecutive command spam.
7. Add streaming Groq responses & partial TTS output.

## Voice & AI Mode Enhancements (Restored)

**AI Mode**: LocalStorage flag `askJouleAiMode` (on/off). If enabled and Groq API key present, ambiguous queries auto-fallback without user prompt.

**Text-to-Speech (TTS)**: Toggle `askJouleTts` (on/off). Command confirmations and Groq answers spoken; error messages are not.

**Microphone Input**: Uses Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`) when available. Interim transcripts update the input; final transcript auto-submits. Graceful degradation when unsupported.

**Answer vs Error Separation**: `answer` state (green) vs `error` state (red) improves clarity for visual users and screen readers. TTS only speaks `answer`.

**Persistence Keys**:

- `askJouleAiMode`: 'on' | 'off'
- `askJouleTts`: 'on' | 'off'

**Follow-up Ideas**:

- Language selection for recognition/synthesis.
- Audible start/stop chime honoring reduced motion preferences.
- Command-to-setting side effects (e.g., adjust thermostat setpoints directly).

## Future Enhancements (Optional)

- Introduce semantic intent classification layer to transition away from pure regex if complexity grows.
- Allow multi-command chaining ("raise temp 2 then show diagnostics").
- Add analytics logging for command categories (performance tuning & feature prioritization).

## Maintenance Notes

- Keep parser pure: avoid side-effects (no direct localStorage or routing calls).
- Component should remain the orchestration layer mapping `action` to UI changes.
- When extending patterns, add tests first to guard against regressions.

## Changelog Snapshot

- Added: `askJouleParser.js`
- Added: parser unit tests (51)
- Added: Ask Joule integration tests (4)
- Added: Analyzer integration tests (2)
- Updated: `AskJoule.jsx` submit logic; removed exported parsing helper to satisfy fast refresh.

## Validation Status

All tests are passing; no current failing cases; parser covers documented command classes.

---

Last Updated: (pending auto-update)
