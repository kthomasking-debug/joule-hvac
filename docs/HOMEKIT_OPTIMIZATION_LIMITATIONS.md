# HomeKit Optimization Limitations

## Overview

Joule HVAC optimizations are designed to work with the **limited data available from Ecobee via HomeKit**. This document explains what data is available, what's not, and how optimizations adapt.

## Available Data via HomeKit ✅

- **Current Temperature** - Real-time indoor temperature
- **Target Temperature** - Current setpoint (single value)
- **HVAC Mode** - `heat`, `cool`, `off`, or `auto`
- **Current State** - `idle`, `heating`, or `cooling`

## NOT Available via HomeKit ❌

- **Schedules** - Cannot read or set Ecobee schedules
- **Comfort Settings** - Cannot access home/away/sleep settings
- **Separate Setpoints** - Only one target temperature (not separate heat/cool)
- **Energy Usage** - No runtime hours, kWh, or cost data
- **Aux Heat Status** - Cannot detect when aux heat is running
- **Remote Sensors** - Cannot access remote sensor data
- **Historical Data** - No access to past usage patterns

## How Optimizations Adapt

### 1. **Simple Temperature Optimization**

When only HomeKit data is available, optimizations:
- Focus on the **current target temperature** only
- Suggest optimal temperature based on:
  - ASHRAE 55 comfort standards
  - Current mode (heating/cooling)
  - Outdoor temperature (from weather API)
  - User comfort preference (comfort/balanced/savings)

**Example:**
- Current: 72°F target
- Optimal: 70°F target
- Action: Set to 70°F (single temperature, not a schedule)

### 2. **Time-Based Suggestions**

Since we can't see schedules, we provide time-based suggestions:
- **Nighttime (10pm-6am)**: Suggest lower for heating, higher for cooling
- **Daytime (6am-10pm)**: Suggest optimal comfort temperatures

**Note:** These are general recommendations. Your Ecobee may have its own schedule that we can't see.

### 3. **Waste Detection**

Using only current state, we detect:
- **Extreme Temperatures** - Very high heating or very low cooling
- **Large Temperature Gaps** - System working hard to reach target
- **Unnecessary Operation** - Heating when it's warm, cooling when it's cool

### 4. **Conservative Estimates**

Without energy usage data:
- Savings estimates are **conservative** (may be higher in reality)
- Based on temperature differences and heat loss calculations
- Cannot account for actual runtime or aux heat usage

## Optimization Components

### `HomeKitOptimizer.js`
- `calculateSimpleOptimization()` - Works with single target temp
- `getImmediateOptimization()` - Quick recommendation based on current state
- `checkForWaste()` - Detect wasteful settings
- `getTimeBasedSuggestion()` - Time-of-day recommendations

### `OneClickOptimizer.jsx`
- Automatically detects if HomeKit-only or full schedule data available
- Uses appropriate optimization method
- Shows limitation notice when HomeKit-only

### `WasteDetector.jsx`
- Real-time efficiency checking using only HomeKit data
- Warns about extreme settings or unnecessary operation

## Best Practices

1. **Set Realistic Expectations**
   - Optimizations are based on current state, not full schedule
   - Savings estimates are conservative

2. **Use Time-Based Suggestions**
   - Apply suggestions appropriate for current time of day
   - Remember: Ecobee may have its own schedule running

3. **Monitor Waste Detector**
   - Check for extreme settings
   - Adjust if system is working unnecessarily hard

4. **Combine with User Settings**
   - App can use locally-stored schedule preferences
   - HomeKit provides real-time control

## Future Enhancements

If Ecobee API access becomes available:
- Full schedule optimization
- Comfort setting management
- Energy usage tracking
- Historical pattern analysis
- More accurate savings calculations

## Technical Details

### Data Flow

```
Ecobee (HomeKit) → Joule Bridge → Frontend
  ├─ Current Temp
  ├─ Target Temp (single)
  └─ Mode

Weather API → Frontend
  └─ Outdoor Temp

User Settings (localStorage) → Frontend
  ├─ Heat Loss Factor
  ├─ System Capacity
  └─ Comfort Preferences

Optimization Engine → Recommendations
  └─ Based on available data only
```

### Optimization Logic

1. **Check Available Data**
   - HomeKit connected? → Use HomeKit optimizer
   - Schedule data available? → Use full schedule optimizer
   - Fallback → Use conservative estimates

2. **Calculate Optimization**
   - Use only available data
   - Apply ASHRAE 55 standards
   - Consider weather conditions
   - Respect user comfort level

3. **Apply Optimization**
   - Set single target temperature (HomeKit limitation)
   - Update local settings
   - Track optimization attempt

## Limitations Summary

| Feature | HomeKit | Full Schedule |
|---------|---------|---------------|
| Current Temp | ✅ | ✅ |
| Target Temp | ✅ (single) | ✅ (day/night) |
| Mode | ✅ | ✅ |
| Schedule | ❌ | ✅ |
| Energy Data | ❌ | ✅ |
| Savings Accuracy | Conservative | More Accurate |

## User Communication

The app clearly communicates:
- When using HomeKit-only data
- What limitations exist
- Why recommendations are conservative
- How to get better results (if Ecobee API available)


