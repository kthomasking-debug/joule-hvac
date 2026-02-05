# Ask Joule Parser - Thermostat Settings Test Results

## Summary
- **Total Tests**: 154
- **Passed**: 81 (52.6%)
- **Failed**: 73 (47.4%)

## Issues Found

### 1. Query Patterns Missing
Many "what is" and "what's" queries are not recognized. The parser needs query patterns for:
- Auto Heat/Cool
- Heat/Cool Min Delta
- Heat/Cool Dissipation Time
- Heat/Cool Differential
- Heat Min On Time
- AC Overcool Max
- Temperature/Humidity Correction
- Thermal Protect
- Compressor settings (min cycle off, min on time, min outdoor temp, stage 2 delta, reverse staging, stage 1 max runtime)
- Heat settings (reverse staging, stage 2 delta, stage 1 max runtime)
- Aux Heat settings (max outdoor temp, min on time, compressor to aux delta/runtime, stage 2 delta, reverse staging, stage 1 max runtime)

### 2. Command Patterns Missing
Several command patterns need to be added:
- `set auto heat cool to true` / `enable auto heat cool`
- `set auto min delta to X` (alias for heat/cool min delta)
- `set heat dissipation to X` (without "seconds")
- `set cool dissipation to X` (without "seconds")
- `set heat min on time to X` (without "minutes" or "seconds")
- `set temp correction to X` (short form)
- `set compressor min cycle off to X` (without "seconds")
- `set compressor min on time to X` (without "minutes" or "seconds")
- `set aux heat lockout to X` (alias)
- `set aux heat min on time to X` (without "minutes" or "seconds")
- `set compressor reverse staging to true/false`
- `set heat reverse staging to true/false`
- `set aux reverse staging to true/false`

### 3. Bug Found
- **Humidity Correction commands are incorrectly matching AC Overcool patterns**
  - "set humidity correction to 0" → incorrectly returns `setACOvercool` action
  - This is a regex pattern conflict that needs to be fixed

## Working Patterns

### Commands That Work ✓
- `set heat cool min delta to X`
- `set heat/cool min delta to X`
- `set heat-cool min delta to X`
- `set heat dissipation to X seconds`
- `set cool dissipation to X seconds`
- `set heat differential to X`
- `set cool differential to X`
- `set heat min on time to X minutes/seconds`
- `set ac overcool to X`
- `set temperature correction to X`
- `calibrate temperature by X`
- `set thermal protect to X`
- `set compressor min outdoor temp to X`
- `set compressor lockout to X`
- `lock out compressor below X`
- `set compressor stage 2 delta to X`
- `enable/turn on compressor reverse staging`
- `set compressor stage 1 max runtime to X minutes/seconds`
- `enable/turn on heat reverse staging`
- `set heat stage 2 delta to X`
- `set heat stage 1 max runtime to X minutes/seconds`
- `set aux heat max outdoor temp to X`
- `lock out aux heat above X`
- `set aux heat min on time to X minutes/seconds`
- `set compressor to aux delta to X`
- `set compressor to aux runtime to X minutes/seconds`
- `set aux stage 2 delta to X`
- `enable/turn on aux reverse staging`
- `set aux stage 1 max runtime to X minutes/seconds`

### Queries That Work ✓
- `show me [setting]` - works for most settings via navigation
- `show me heat differential` - returns `queryThreshold` action
- `show me cool differential` - returns `queryThreshold` action
- `show me heat-cool min delta` - returns `queryThreshold` action
- `show me temperature correction` - returns `queryThreshold` action
- `show me thermal protect` - returns `queryThreshold` action
- `show me compressor lockout` - returns `queryThreshold` action
- `show me aux heat lockout` - returns `queryThreshold` action
- `show me compressor stage 2 delta` - returns `queryThreshold` action
- `show me heat stage 2 delta` - returns `queryThreshold` action
- `show me aux stage 2 delta` - returns `queryThreshold` action

## Recommendations

1. **Add query patterns** for all settings using the existing `queryThreshold` pattern
2. **Fix the humidity correction bug** - ensure it doesn't match AC Overcool patterns
3. **Add missing command patterns** for all the variations listed above
4. **Add support for "what is" queries** - these are very common user queries
5. **Add support for boolean settings** - "set X to true/false" patterns
6. **Add support for numeric-only commands** - commands without units should default to appropriate units

## Next Steps

1. Add query patterns for all missing settings
2. Fix the humidity correction regex conflict
3. Add missing command patterns
4. Re-run tests to verify fixes


