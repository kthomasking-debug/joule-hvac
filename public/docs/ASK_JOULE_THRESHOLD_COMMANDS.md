# Ask Joule Threshold Commands - Test Guide

This document lists all threshold commands that Ask Joule can execute. Ask Joule understands both **technical commands** and **human problem descriptions**. Test each command to verify it works correctly.

## Human Language Problem Detection

Ask Joule can understand problems and automatically fix them. These patterns are checked **first** before technical commands.

### Comfort Tuning - Problem Detection

#### ✅ Short Cycling Problem
- **Problem**: "The heat turns on and off too much"
- **Problem**: "It's cycling constantly"
- **Problem**: "It cycles too frequently"
- **Solution**: Automatically sets Heat Differential to 1.5°F
- **Test**: Try saying "the heat turns on and off too much"

#### ✅ Humidity Problem
- **Problem**: "It feels sticky in here"
- **Problem**: "It's humid"
- **Problem**: "It's too muggy"
- **Solution**: Automatically sets AC Overcool Max to 3°F
- **Test**: Try saying "it feels sticky in here"

#### ✅ Temperature Calibration Problem
- **Problem**: "The thermostat says 72 but my thermometer says 70"
- **Solution**: Automatically calculates and sets Temperature Correction
- **Test**: Try saying "the thermostat says 72 but my thermometer says 70"

### Hardware Protection - Fear Detection

#### ✅ Compressor Worry
- **Problem**: "I'm worried about my compressor dying"
- **Problem**: "I'm concerned about my compressor"
- **Solution**: Automatically sets Compressor Min Cycle Off to 10 minutes
- **Test**: Try saying "I'm worried about my compressor dying"

#### ✅ Short Runtime Problem
- **Problem**: "The AC barely runs for 2 minutes"
- **Problem**: "It only runs for 3 minutes"
- **Solution**: Automatically sets Cool Min On Time to 5 minutes
- **Test**: Try saying "the AC barely runs for 2 minutes"

### Efficiency & Savings - Money Problems

#### ✅ Cold Air After Heat Stops
- **Problem**: "Stop blowing cold air after the heat turns off"
- **Problem**: "It blows cold air when the heat stops"
- **Solution**: Automatically sets Heat Dissipation Time to 0 seconds
- **Test**: Try saying "stop blowing cold air after the heat turns off"

#### ✅ Maximize Heat Extraction
- **Problem**: "I want to squeeze every BTU out of the furnace"
- **Problem**: "Get more heat from the furnace"
- **Solution**: Automatically sets Heat Dissipation Time to 60 seconds
- **Test**: Try saying "I want to squeeze every BTU out of the furnace"

#### ✅ High Bills / Stop Electric Strips
- **Problem**: "My bill is huge. Stop the electric strips"
- **Problem**: "It's too expensive"
- **Problem**: "Save money"
- **Solution**: Automatically sets Aux Heat Max Outdoor Temp to 35°F
- **Test**: Try saying "my bill is huge. stop the electric strips"

#### ✅ Compressor Noise in Cold
- **Problem**: "The heat pump is making a weird noise in the extreme cold"
- **Problem**: "It's making a strange sound when it's freezing"
- **Solution**: Automatically sets Compressor Min Outdoor Temp to 20°F
- **Test**: Try saying "the heat pump is making a weird noise in the extreme cold"

### Advanced Staging - Complaints

#### ✅ Aux Heat Too Fast
- **Problem**: "The aux heat turns on too fast"
- **Problem**: "It gives up on the heat pump too easily"
- **Solution**: Automatically sets Compressor to Aux Delta to 4°F
- **Test**: Try saying "the aux heat turns on too fast"

#### ✅ Too Loud
- **Problem**: "It's too loud when it runs"
- **Problem**: "It's too noisy"
- **Solution**: Automatically enables Compressor Reverse Staging
- **Test**: Try saying "it's too loud when it runs"

### One-Shot Optimization - Vibe Detection

#### ✅ Make It Cheap
- **Command**: "Make it cheap"
- **Command**: "Save money"
- **Command**: "Optimize for efficiency"
- **Solution**: Applies efficiency optimization profile
- **Test**: Try saying "make it cheap"

#### ✅ Make It Precise
- **Command**: "Make it precise"
- **Command**: "Make it comfortable"
- **Command**: "Optimize for comfort"
- **Solution**: Applies comfort optimization profile
- **Test**: Try saying "make it precise"

#### ✅ Fix Short Cycling
- **Command**: "Fix the short cycling"
- **Command**: "Stop the cycling"
- **Solution**: Applies short cycle fix (widen differential + increase min off time)
- **Test**: Try saying "fix the short cycling"

### Round 2: Specific Frustration Patterns

#### ✅ Drafty House Complaints

**"It gets cold immediately after the heat stops"**
- **Problem**: House has low thermal mass/high leakage
- **Solution**: Sets Heat Differential to 0.5°F (keeps it tight)
- **Test**: Try saying "it gets cold immediately after the heat stops"

**"The floors are cold"**
- **Problem**: Air stratification
- **Solution**: Sets Fan Min On Time to 30 min/hr (circulates air)
- **Test**: Try saying "the floors are cold"

#### ✅ Oversized System Problems

**"The AC blasts me with arctic air for 5 minutes then stops"**
- **Problem**: Oversized unit
- **Solution**: Sets Cool Min On Time to 600s AND AC Overcool Max to 3°F
- **Test**: Try saying "the AC blasts me with arctic air for 5 minutes then stops"

**"The furnace sounds like a jet engine taking off every 10 minutes"**
- **Problem**: Furnace running too frequently
- **Solution**: Sets Heat Differential to 2.0°F (runs less often, longer periods)
- **Test**: Try saying "the furnace sounds like a jet engine taking off"

#### ✅ Aux Heat Anxiety

**"I smell burning dust"**
- **Problem**: The smell of Aux strips running unnecessarily
- **Solution**: Checks aux heat lockout and reduces it if above 40°F
- **Test**: Try saying "I smell burning dust"

**"Why is the little red flame icon on when it's 50 degrees out?"**
- **Problem**: Aux heat running when it shouldn't
- **Solution**: Sets Aux Heat Max Outdoor Temp to 35°F
- **Test**: Try saying "why is the little red flame icon on when it's 50 degrees out"

#### ✅ Sleep Preferences

**"The clicking keeps waking me up"**
- **Problem**: System cycling too frequently at night
- **Solution**: Sets Compressor Min Cycle Off to 900s (15 min) and Differential to 2°F
- **Test**: Try saying "the clicking keeps waking me up"

**"I wake up sweating"**
- **Problem**: Humidity too high at night
- **Solution**: Sets AC Overcool to 4°F (dries out the air at night)
- **Test**: Try saying "I wake up sweating"

#### ✅ Weird Physics Edge Cases

**"My windows are fogging up inside"**
- **Problem**: Humidity too high vs outdoor cold
- **Solution**: Increases AC Overcool Max to 3°F for aggressive dehumidification
- **Test**: Try saying "my windows are fogging up inside"

**"The air feels lukewarm"**
- **Problem**: Heat pump complaint - heat pumps blow cooler air (95°F) than gas (130°F)
- **Solution**: Sets Heat Dissipation to 60s (increases fan runtime to mix air better)
- **Test**: Try saying "the air feels lukewarm"

---

## Technical Commands

These are the direct technical commands that Ask Joule also understands.

## Comfort Tuning Commands

### ✅ Set Heat Differential
- **Command**: "Set heat differential to 1.0 degrees"
- **Maps to**: `thresholds.heatDifferential`
- **Action**: Widens the deadband to stop short cycling
- **Test**: `set heat differential to 1.0`

### ✅ Set Cool Differential
- **Command**: "Set cool differential to 1.5 degrees"
- **Maps to**: `thresholds.coolDifferential`
- **Action**: Keeps AC running longer for dehumidification
- **Test**: `set cool differential to 1.5`

### ✅ Set AC Overcool
- **Command**: "Set AC overcool to 3 degrees"
- **Maps to**: `thresholds.acOvercoolMax`
- **Action**: Aggressive dehumidification mode
- **Test**: `set ac overcool to 3`

### ✅ Calibrate Temperature
- **Command**: "Calibrate temperature by -2 degrees"
- **Maps to**: `thresholds.temperatureCorrection`
- **Action**: Aligns the sensor with a wall thermometer
- **Test**: `calibrate temperature by -2 degrees`
- **Alternative**: `set temperature correction to -2`

## Hardware Protection Commands (Safety)

### ✅ Set Compressor Min Off Time
- **Command**: "Set compressor min off time to 10 minutes"
- **Maps to**: `thresholds.compressorMinCycleOff`
- **Action**: Critical for compressor longevity
- **Test**: `set compressor min off time to 10 minutes`
- **Alternative**: `set compressor min cycle off to 10 minutes`

### ✅ Set Heat Min On Time
- **Command**: "Set heat min on time to 5 minutes"
- **Maps to**: `thresholds.heatMinOnTime`
- **Action**: Ensures furnace reaches steady-state efficiency
- **Test**: `set heat min on time to 5 minutes`

### ✅ Set Compressor Min On Time
- **Command**: "Set compressor min on time to 5 minutes"
- **Maps to**: `thresholds.compressorMinOnTime`
- **Action**: Ensures oil return to the compressor
- **Test**: `set compressor min on time to 5 minutes`

## Efficiency & Savings Commands

### ✅ Set Heat Dissipation
- **Command**: "Set heat dissipation to 60 seconds"
- **Maps to**: `thresholds.heatDissipationTime`
- **Action**: Extracts free heat from the ducts
- **Test**: `set heat dissipation to 60 seconds`

### ✅ Lock Out Aux Heat
- **Command**: "Lock out aux heat above 35 degrees"
- **Maps to**: `thresholds.auxHeatMaxOutdoorTemp`
- **Action**: Prevents expensive strips from running on mild days
- **Test**: `lock out aux heat above 35 degrees`
- **Alternative**: `set aux heat max outdoor temp to 35`

### ✅ Lock Out Compressor
- **Command**: "Lock out compressor below 15 degrees"
- **Maps to**: `thresholds.compressorMinOutdoorTemp`
- **Action**: Prevents heat pump from running when it's inefficient (COP < 1)
- **Test**: `lock out compressor below 15 degrees`
- **Alternative**: `set compressor lockout to 15`

## Advanced Staging Commands (Pro Mode)

### ✅ Set Compressor to Aux Delta
- **Command**: "Set compressor to aux delta to 3 degrees"
- **Maps to**: `thresholds.compressorToAuxTempDelta`
- **Action**: Forces heat pump to try harder before calling for backup
- **Test**: `set compressor to aux delta to 3 degrees`
- **Note**: Only available if staging is set to "manual"

### ✅ Enable/Disable Compressor Reverse Staging
- **Command**: "Enable compressor reverse staging"
- **Maps to**: `thresholds.compressorReverseStaging`
- **Action**: Allows 2-stage units to downshift instead of shutting off
- **Test**: `enable compressor reverse staging`
- **Test**: `disable compressor reverse staging`

## One-Shot Optimization Commands

### ✅ Optimize for Efficiency
- **Command**: "Optimize for efficiency"
- **Action**: Sets Differential to 1.5°F, Dissipation to 60s, Overcool to 2°F
- **Test**: `optimize for efficiency`
- **Changes**:
  - Heat/Cool differential: → 1.5°F
  - Heat dissipation: → 60 seconds
  - AC overcool: → 2°F

### ✅ Optimize for Comfort
- **Command**: "Optimize for comfort"
- **Action**: Sets Differential to 0.5°F, Dissipation to 0s (to avoid drafts)
- **Test**: `optimize for comfort`
- **Changes**:
  - Heat/Cool differential: → 0.5°F
  - Heat dissipation: → 0 seconds

### ✅ Protect My Compressor
- **Command**: "Protect my compressor"
- **Action**: Sets Cycle Off to 600s, Min On to 300s
- **Test**: `protect my compressor`
- **Changes**:
  - Compressor min off time: → 10 minutes (600 seconds)
  - Compressor min on time: → 5 minutes (300 seconds)

## Testing Instructions

1. Open Ask Joule in the app
2. Try each command listed above
3. Verify the response confirms the setting was changed
4. Check that the setting is actually saved (you can verify in Settings → Thermostat Settings → Thresholds)

## Implementation Status

All commands are implemented and ready for testing. The parser recognizes natural language variations, and handlers update the thermostat settings accordingly.

## Notes

- All time values can be specified in minutes or seconds
- Temperature values can include "degrees" or "°F" or just the number
- Commands are case-insensitive
- The parser handles variations like "set it to X" vs "set X to Y"

