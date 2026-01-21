# HomeKit Thermostat Capabilities

## What HomeKit CAN Do ✅

HomeKit (via Joule Bridge) supports the following thermostat operations:

### 1. **Read Current State**
- ✅ Current temperature
- ✅ Target temperature
- ✅ Current HVAC mode (heating, cooling, idle)
- ✅ Target HVAC mode (off, heat, cool, auto)

### 2. **Set Target Temperature**
- ✅ Set a single target temperature
- ✅ Works in heat, cool, or auto mode
- ⚠️ **Limitation**: Only ONE target temperature at a time (not separate heat/cool setpoints)

### 3. **Set HVAC Mode**
- ✅ `off` - Turn HVAC off
- ✅ `heat` - Heating mode only
- ✅ `cool` - Cooling mode only
- ✅ `auto` - Auto mode (uses single target temp)

## What HomeKit CANNOT Do ❌

HomeKit does **NOT** support Ecobee-specific features:

### 1. **Comfort Settings/Climates**
- ❌ Cannot set separate "home", "away", or "sleep" comfort settings
- ❌ Cannot configure different temperatures for each comfort setting
- ❌ Cannot switch between comfort settings programmatically

**Why?** HomeKit uses a simple thermostat model with a single target temperature. Ecobee's comfort settings are a proprietary feature that requires the Ecobee API.

### 2. **Separate Heat/Cool Setpoints**
- ❌ Cannot set different heat and cool setpoints simultaneously
- ❌ In auto mode, HomeKit uses a single target temperature (Ecobee may interpret this differently)

### 3. **Schedules**
- ❌ Cannot read or set Ecobee schedules
- ❌ Cannot configure time-based temperature changes

### 4. **Advanced Features**
- ❌ Cannot access remote sensors
- ❌ Cannot set vacation holds
- ❌ Cannot configure fan mode independently
- ❌ Cannot access energy usage data
- ❌ Cannot configure follow-me or smart recovery

## Comparison: HomeKit vs Ecobee API

| Feature | HomeKit | Ecobee API |
|---------|---------|------------|
| Current temperature | ✅ | ✅ |
| Target temperature | ✅ (single) | ✅ (heat + cool) |
| HVAC mode | ✅ | ✅ |
| Comfort settings | ❌ | ✅ |
| Schedules | ❌ | ✅ |
| Remote sensors | ❌ | ✅ |
| Vacation holds | ❌ | ✅ |
| Fan control | ❌ | ✅ |
| Energy data | ❌ | ✅ |

## Practical Implications

### For Comfort Settings:
- **HomeKit**: Can only set the current target temperature. You cannot push separate home/away/sleep settings.
- **Ecobee API**: Can read and write all comfort settings, schedules, and advanced features.

### For Temperature Control:
- **HomeKit**: Simple "set to 72°F" - works great for basic control
- **Ecobee API**: Can set heat to 70°F and cool to 74°F separately, plus configure schedules

## Recommendation

- **Use HomeKit** for:
  - Simple temperature adjustments
  - Reading current state
  - Basic mode changes (heat/cool/off/auto)
  - Local-only control (no cloud)

- **Use Ecobee API** for:
  - Managing comfort settings
  - Configuring schedules
  - Accessing remote sensors
  - Advanced features

## Workaround for Comfort Settings

If you want to use HomeKit but need comfort settings:

1. **Pull from Ecobee API once**: Use the "Pull from Thermostat" button to sync comfort settings from Ecobee API
2. **Store locally**: The app stores these settings locally
3. **Use HomeKit for control**: Use HomeKit to set temperatures, but the app uses your local comfort settings for recommendations

This gives you the best of both worlds: local control via HomeKit + access to comfort settings via Ecobee API.

