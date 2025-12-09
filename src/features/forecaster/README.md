# Season-Aware Forecaster Components

This directory contains a season-aware forecasting system that automatically adapts to heating/cooling modes with unified UI components.

## Architecture

### Core Components

1. **`SeasonProvider`** - Context provider that manages seasonal mode state
   - Auto-detects season from thermostat mode, outdoor temp, or date
   - Provides `useSeason()` hook for accessing season state
   - Supports: `"heating" | "cooling" | "both" | "auto"`

2. **`SeasonModeToggle`** - UI toggle for switching between modes
   - Visual buttons with icons (❄️ Heating, ☀️ Cooling, 🔄 Auto, 🌡️ Both)
   - Shows auto-detected mode as tooltip

3. **`AnalysisPage`** - Main page component
   - Wraps all analysis sections
   - Automatically adapts UI based on active season mode

### Hooks

- **`useSeasonalMetrics`** - Calculates season-aware metrics
  - Returns different metrics for heating vs cooling
  - Provides comfort risk detection
  - Generates season-specific recommendations

## Usage Example

```tsx
import { AnalysisPage, SeasonProvider } from "@/features/forecaster/components";

function MyForecastPage() {
  return (
    <AnalysisPage
      thermostatMode="cool" // or "heat", "auto"
      outdoorTemp={78}
      forecastData={forecastData}
      weeklyMetrics={weeklyMetrics}
      userSettings={userSettings}
    />
  );
}
```

## Season Detection Logic

The `SeasonProvider` auto-detects season using this priority:

1. **Thermostat Mode** (highest priority)
   - `"heat"` → Heating mode
   - `"cool"` → Cooling mode
   - `"auto"` → Continue to temp/date detection

2. **Outdoor Temperature** (if available)
   - `< 55°F` → Heating mode
   - `> 65°F` → Cooling mode
   - `55-65°F` → Both mode (swing season)

3. **Date/Month** (fallback)
   - Nov-Mar → Heating mode
   - Jun-Sep → Cooling mode
   - Apr, May, Oct → Both mode

## Component Structure

```
AnalysisPage
├── SeasonProvider (context)
│   ├── AnalysisHeader
│   │   └── SeasonModeToggle
│   ├── KpiRow (season-aware metrics)
│   ├── ComfortAndScheduleSection
│   │   ├── ComfortBandCard (heating)
│   │   └── ComfortBandCard (cooling)
│   ├── DailyBreakdownSection
│   │   └── DailyBreakdownTable (season-aware columns)
│   ├── CostCurveSection
│   ├── CalculationAccordionSection
│   └── SystemUtilitiesSection
```

## Season-Aware Features

### Heating Mode
- Shows heating cost, runtime, aux heat usage
- Displays heat loss calculations
- Warns about auxiliary heat spikes
- Recommends setpoint adjustments to avoid aux heat

### Cooling Mode
- Shows cooling cost, runtime, humidity data
- Displays cooling load (sensible + latent)
- Warns about high humidity days
- Recommends pre-cooling strategies

### Both Mode
- Shows combined heating + cooling metrics
- Tabs to switch between heating/cooling views
- Unified cost curve showing both modes

## Next Steps

1. **Implement placeholder components:**
   - `ComfortBandCard` - Visual comfort zone display
   - `DailyBreakdownTable` - Season-aware table columns
   - `CostCurveChart` - Temperature vs cost visualization

2. **Add cooling calculations:**
   - Latent load (humidity removal)
   - Sensible load (temperature reduction)
   - SEER2/EER2 efficiency curves
   - Cooling COP vs outdoor temp

3. **Enhance recommendations:**
   - Pre-cooling suggestions
   - Humidity management tips
   - Fan mode recommendations
   - Solar load considerations

4. **Visual theming:**
   - Winter theme: Cool blues, frost icons
   - Summer theme: Warm oranges, sun icons
   - Auto theme: Neutral grays

## TypeScript Types

All components are fully typed. Key interfaces:

- `SeasonMode` - `"heating" | "cooling" | "both" | "auto"`
- `SeasonContextValue` - Context value from `useSeason()`
- `WeeklyMetrics` - Weekly cost/energy summary
- `DailyMetrics` - Per-day breakdown with season-specific fields
- `SeasonalMetrics` - Combined metrics with recommendations

