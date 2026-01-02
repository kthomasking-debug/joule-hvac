# Cards Documentation

This document lists and defines all card components and card-like UI elements used throughout the Joule HVAC project.

## Table of Contents

1. [Reusable Card Components](#reusable-card-components)
2. [Page-Specific Cards](#page-specific-cards)
3. [Card Styling Classes](#card-styling-classes)
4. [Card Patterns](#card-patterns)

---

## Reusable Card Components

### AnswerCard
**Location:** `src/components/AnswerCard.jsx`

**Purpose:** Displays quick cost estimates and answers for heating/cooling queries.

**Features:**
- Shows weekly/monthly cost estimates
- Displays location and temperature context
- Shows energy mode (heating/cooling) and system type (Gas/Heat Pump)
- Displays ROI savings for heat pumps vs gas
- Animated gradient background with emerald/teal/sky colors
- Loading state with shimmer animation

**Props:**
- `loading` - Boolean for loading state
- `location` - Location string
- `temp` - Temperature value
- `weeklyCost` - Weekly cost estimate
- `energyMode` - "heating" or "cooling"
- `primarySystem` - "gasFurnace" or "heatPump"
- `roiSavings` - Annual savings vs gas (for heat pumps)
- `timePeriod` - "week" or other period (default: "week")

**Usage:** Used in Ask Joule and quick answer interfaces.

---

### ComparisonCard
**Location:** `src/components/ComparisonCard.jsx`

**Purpose:** Compares two values side-by-side (e.g., current vs upgraded system).

**Features:**
- Two-column layout for comparison
- Optional delta/difference display
- Gradient highlight for difference section
- Clean, minimal design

**Props:**
- `title` - Card title
- `left` - Object with `label` and `value` for left side
- `right` - Object with `label` and `value` for right side
- `deltaLabel` - Label for difference (default: "Difference")
- `deltaValue` - Value to display in difference section
- `className` - Additional CSS classes

**Usage:** Used in upgrade ROI analyzers and comparison views.

---

### ShareableSavingsCard
**Location:** `src/components/ShareableSavingsCard.jsx`

**Purpose:** Creates a shareable social media card (1200x630px) showing annual savings.

**Features:**
- Fixed 1200x630px dimensions (OG image size)
- Branded gradient background (green to blue)
- Large savings amount display
- Location context
- "Calculated with Joule HVAC" branding

**Props:**
- `savings` - Annual savings amount
- `location` - Optional location string

**Usage:** Used for generating shareable images of savings calculations.

---

### WeatherMiniCard
**Location:** `src/components/WeatherMiniCard.jsx`

**Purpose:** Displays daily weather forecast with cost index visualization.

**Features:**
- Day label and date
- Weather icon (Sun/Cloud/Snowflake based on temperature)
- High/low temperature display
- Cost index bar chart (green/yellow/orange)
- Responsive design

**Props:**
- `dayLabel` - Day name (e.g., "Monday")
- `dateLabel` - Date string
- `low` - Low temperature
- `high` - High temperature
- `costIndex` - Cost index value (0-1, default: 0.4)
- `costDisplay` - Optional custom cost display string

**Usage:** Used in weekly forecast displays and weather overview sections.

---

### ThermostatScheduleCard
**Location:** `src/components/ThermostatScheduleCard.jsx`

**Purpose:** Interactive dual-period thermostat schedule with day/night clocks.

**Features:**
- 24-hour timeline preview showing day/night periods
- Two thermostat clocks (daytime and nighttime)
- Current time indicator on timeline
- Temperature controls for each period
- Time controls for period start times
- Active period highlighting
- Integrates with thermostat settings storage

**Props:**
- `indoorTemp` - Daytime temperature setting
- `daytimeTime` - Daytime period start time (HH:MM)
- `nighttimeTime` - Nighttime period start time (HH:MM)
- `nighttimeTemp` - Nighttime temperature setting
- `onDaytimeTimeChange` - Callback for daytime time changes
- `onNighttimeTimeChange` - Callback for nighttime time changes
- `onNighttimeTempChange` - Callback for nighttime temp changes
- `onIndoorTempChange` - Callback for daytime temp changes
- `setUserSetting` - User settings setter from outlet context
- `daytimeSettingKey` - Setting key for daytime temp (default: "winterThermostat")
- `skipComfortSettingsUpdate` - Skip updating comfort settings (for Annual Budget Planner)

**Usage:** Used in SevenDayCostForecaster, MonthlyBudgetPlanner, and thermostat configuration pages.

---

### InsightCard
**Location:** `src/components/InsightCard.jsx`

**Purpose:** Displays insights, tips, and recommendations to users.

**Features:**
- Variant-based styling (info, alert, tip)
- Gradient backgrounds (slate, red/rose, purple/indigo)
- Optional action button
- Icon display area
- Backdrop blur effects

**Props:**
- `title` - Card title (default: "No insights today")
- `message` - Message text (default: "Everything looks good. Check back tomorrow!")
- `actionLabel` - Optional action button label
- `onAction` - Optional action button callback
- `variant` - "info", "alert", or "tip" (default: "info")
- `className` - Additional CSS classes

**Usage:** Used throughout the app for displaying recommendations and alerts.

---

### TypicalBuildingFallbackCard
**Location:** `src/components/TypicalBuildingFallbackCard.jsx`

**Purpose:** Explains when coast-down analysis fails and shows fallback heat loss estimation.

**Features:**
- Warning-style design with amber colors
- Explains why analysis failed
- Shows fallback heat loss calculation
- RAG integration for Manual J data lookup
- Expandable technical details
- Action buttons for continuing or uploading new file

**Props:**
- `squareFeet` - Home square footage
- `fallbackHeatLoss` - Fallback heat loss factor (BTU/hr/°F)
- `onUploadBetterFile` - Callback for uploading new file
- `userSettings` - User settings object for RAG lookup

**Usage:** Shown when heat loss analysis cannot be performed from uploaded data.

---

### ComfortOptimizerCard
**Location:** `src/components/ComfortOptimizerCard.jsx`

**Purpose:** AI-powered comfort optimizer that suggests 24-hour thermostat schedules.

**Features:**
- Generates optimized schedule blocks
- Shows setpoint and rationale for each time window
- "Apply This" buttons for individual blocks
- "Apply Plan" button for full schedule
- Auto-pilot toggle
- Active plan indicator
- Estimated savings display
- Table layout for schedule blocks

**Props:**
- `settings` - User settings object
- `forecast` - Weather forecast data
- `learningEvents` - Learning events array
- `onApplyBlock` - Optional callback for applying individual blocks

**Usage:** Used in optimization dashboards and comfort settings pages.

---

### BenchmarkCard
**Location:** `src/components/optimization/BenchmarkCard.jsx`

**Purpose:** Compares user's efficiency metrics to benchmarks for similar homes.

**Features:**
- Percentile ranking display (Top 10%, Top 25%, Average, etc.)
- Color-coded percentile badges
- Cost per square foot comparison
- Energy usage comparison with visual bar
- Insights list
- Climate zone and system type context

**Props:**
- `monthlyCost` - Monthly energy cost (default: 100)
- `monthlyKWh` - Monthly energy usage in kWh (default: 500)
- `squareFeet` - Home square footage (default: 1000)
- `climateZone` - Climate zone (default: "mixed")
- `heatPumpType` - Heat pump type (default: "standard")
- `compact` - Boolean for compact display (default: false)

**Usage:** Used in optimization dashboards and performance analysis pages.

---

### ForecastAccuracyCard
**Location:** `src/components/optimization/ForecastAccuracyCard.jsx`

**Purpose:** Tracks and displays forecast accuracy over time.

**Features:**
- Average error percentage
- Percentage within 5% and 10% accuracy
- Trend indicator (improving, declining, stable)
- Recent accuracy comparisons
- Modal for entering actual costs
- Color-coded accuracy indicators

**Props:**
- `onRecordActual` - Callback when actual cost is recorded
- `compact` - Boolean for compact display (default: false)

**Usage:** Used in optimization dashboards to track forecast quality.

---

### SystemHealthCard
**Location:** `src/components/optimization/SystemHealthCard.jsx`

**Purpose:** System health overview with recommendations and metrics.

**Features:**
- Health score (0-100) with circular progress indicator
- Color-coded score (green/yellow/red)
- Expandable/collapsible design
- Recommendations list with priority levels
- Positive aspects display
- System metrics grid
- Category icons (Insulation, Aux Heat, Cycling, Maintenance, Equipment)

**Props:**
- `heatLossFactor` - Heat loss factor (BTU/hr/°F, default: 200)
- `squareFeet` - Home square footage (default: 1000)
- `auxHeatHours` - Auxiliary heat hours (default: 0)
- `totalHeatHours` - Total heating hours (default: 100)
- `cyclesPerHour` - System cycles per hour (default: 3)
- `lastMaintenanceDate` - Last maintenance date (default: null)
- `filterLastChanged` - Filter last changed date (default: null)
- `systemAge` - System age in years (default: 0)
- `hspf2` - HSPF2 rating (default: 9)
- `seer2` - SEER2 rating (default: 16)
- `compact` - Boolean for compact display (default: false)

**Usage:** Used in optimization dashboards and system analysis pages.

---

## Page-Specific Cards

### MonthlyBudgetPlanner Cards

#### Total Annual HVAC Cost Card
**Location:** Top of annual forecast page (after breadcrumbs)

**Purpose:** Displays total annual HVAC costs with breakdown.

**Features:**
- Green card styling (matches simulator pages)
- Total annual cost in large text
- Breakdown: heating + cooling + fixed costs
- Monthly average display
- Positioned at top of page

**Data Shown:**
- Total annual cost (energy + fixed)
- Annual heating cost
- Annual cooling cost
- Annual fixed costs only
- Monthly averages

---

#### City Comparison Savings Card
**Location:** Top of city comparison page (after breadcrumbs)

**Purpose:** Highlights annual savings when comparing two cities.

**Features:**
- Dark green background (`bg-[#0f2b1c]`)
- Large savings amount in green text
- "Living where air doesn't hurt your face" tagline
- Only shown when Location A is warmer and savings > $10

**Data Shown:**
- Annual savings amount
- Calculated from cost difference between two locations

---

#### Annual Budget Comparison Card
**Location:** City comparison page

**Purpose:** Side-by-side comparison of annual costs for two locations.

**Features:**
- Two-column grid layout
- Location A (blue border) and Location B (green border)
- Annual cost for each location
- Map pin icons
- Calculated from monthly HDD/CDD distributions

**Data Shown:**
- Location A annual cost
- Location B annual cost
- City and state names

---

#### Climate Flex Card
**Location:** City comparison page (within Annual Budget Comparison section)

**Purpose:** Shows climate comparison with HDD values and heat load ratio.

**Features:**
- Gradient background (green/emerald)
- Two-column HDD comparison
- Heat load ratio display
- "Physics: saves money before you touch your thermostat" note
- Only shown when Location A is warmer and savings are meaningful

**Data Shown:**
- Location A winter HDD
- Location B winter HDD
- Heat load ratio (× multiplier)
- Note: Savings card was moved to top, removed from this section

---

#### Thermostat Settings Card
**Location:** City comparison page

**Purpose:** Allows users to configure thermostat settings for comparison.

**Features:**
- Winter and Summer sections
- Daytime and Nighttime temperature sliders
- Time range labels
- Grid layout (2 columns on desktop)

**Settings:**
- Winter Heating (Dec-Feb): Daytime and Nighttime setpoints
- Summer Cooling (Jun-Aug): Daytime and Nighttime setpoints

---

### HeatPumpEnergyFlow Cards

#### System Balance Point Card
**Location:** Top of page (after breadcrumbs)

**Purpose:** Displays the system balance point temperature.

**Features:**
- Large temperature display (7xl/8xl font)
- Indigo color scheme
- Explanation of what the balance point means
- Shortfall at design temperature display
- Only shown when balance point is valid and below design temperature

**Data Shown:**
- Balance point temperature (°F)
- Design temperature
- Shortfall at design temperature (BTU/hr)
- Explanation text

---

## Card Styling Classes

### Glass Card Classes

#### `.glass-card`
Base glass card styling with subtle background and border.

**Properties:**
- Background: `var(--bg-layer-1)`
- Border: Transparent (becomes visible on hover)
- Border radius: 12px
- Box shadow: Small
- Hover: Background changes to `var(--bg-layer-2)`, border becomes visible

**Usage:** Standard card container throughout the app.

---

#### `.glass-card-gradient`
Glass card with gradient accent bar at top.

**Properties:**
- Background: `var(--glass-bg-light)` (light mode) / `var(--glass-bg-dark)` (dark mode)
- Backdrop filter: Blur effect
- Border: Glass border color
- Border radius: Extra large (xl)
- Top accent bar: 3px gradient accent

**Usage:** Prominent cards that need visual emphasis.

---

#### `.glass-card-strong`
Stronger glass effect with more opacity.

**Properties:**
- Background: 15% white (light) / 90% black (dark)
- Backdrop filter: Strong blur
- Border: 30% white (light) / 20% white (dark)

**Usage:** Cards that need stronger visual separation.

---

### Color-Coded Cards

#### Green Cards
Used for positive metrics, savings, and success states.

**Examples:**
- Total Annual HVAC Cost Card
- City Comparison Savings Card
- Climate Flex Card

**Styling:**
- Background: `bg-green-50 dark:bg-green-900/20` or `bg-[#0f2b1c]`
- Border: `border-green-200 dark:border-green-800`
- Text: `text-green-700/800 dark:text-green-300/400`

---

#### Blue Cards
Used for informational content and primary actions.

**Examples:**
- Location A in comparisons
- Temperature Data Source cards
- Info cards

**Styling:**
- Background: `bg-blue-50 dark:bg-blue-900/20`
- Border: `border-blue-200 dark:border-blue-800`
- Text: `text-blue-700/800 dark:text-blue-300/400`

---

#### Indigo Cards
Used for system metrics and technical information.

**Examples:**
- System Balance Point Card
- System performance metrics

**Styling:**
- Background: Indigo gradients
- Text: `text-indigo-600/700 dark:text-indigo-400`

---

#### Amber/Orange Cards
Used for warnings and attention-grabbing information.

**Examples:**
- TypicalBuildingFallbackCard
- Warning messages

**Styling:**
- Background: `bg-amber-50 dark:bg-amber-900/20` or `bg-[#0C1118]`
- Border: `border-amber-500/40`
- Text: `text-amber-300/400`

---

#### Red Cards
Used for errors, alerts, and critical information.

**Examples:**
- Error states
- High-priority recommendations

**Styling:**
- Background: Red gradients or `bg-red-900/20`
- Border: `border-red-700/50`
- Text: `text-red-400`

---

## Card Patterns

### Information Cards
Cards that display static or calculated information.

**Pattern:**
- Header with title/icon
- Main content area
- Optional footer with additional context

**Examples:**
- System Balance Point Card
- Total Annual HVAC Cost Card
- WeatherMiniCard

---

### Interactive Cards
Cards with user controls and inputs.

**Pattern:**
- Header with title
- Input controls (sliders, inputs, buttons)
- Real-time updates
- State persistence

**Examples:**
- ThermostatScheduleCard
- Thermostat Settings Card
- ComfortOptimizerCard

---

### Comparison Cards
Cards that compare two or more values.

**Pattern:**
- Side-by-side layout
- Clear labels for each value
- Difference/delta display
- Visual indicators (colors, icons)

**Examples:**
- ComparisonCard
- Annual Budget Comparison Card
- Climate Flex Card

---

### Status Cards
Cards that show system status or health.

**Pattern:**
- Score/metric display
- Status indicators (colors, icons)
- Recommendations or actions
- Expandable details

**Examples:**
- SystemHealthCard
- BenchmarkCard
- ForecastAccuracyCard

---

### Alert/Warning Cards
Cards that communicate important information or warnings.

**Pattern:**
- Prominent styling (amber/red)
- Clear message
- Action buttons
- Expandable technical details

**Examples:**
- TypicalBuildingFallbackCard
- InsightCard (alert variant)

---

## Card Layout Guidelines

### Spacing
- Cards typically use `mb-4` or `mb-6` for bottom margin
- Internal padding: `p-4`, `p-6`, or `p-glass-lg`
- Gap between card elements: `gap-2`, `gap-4`, or `gap-6`

### Responsive Design
- Cards use responsive grid layouts: `grid-cols-1 md:grid-cols-2`
- Text sizes adjust: `text-sm md:text-base`
- Padding adjusts: `p-4 md:p-6`

### Dark Mode
- All cards support dark mode via Tailwind dark: classes
- Backgrounds become darker/more transparent
- Text colors adjust for contrast
- Borders become more visible

---

## Best Practices

1. **Consistency:** Use established card classes (`.glass-card`, `.glass-card-gradient`) for visual consistency.

2. **Accessibility:** Include proper ARIA labels, semantic HTML, and keyboard navigation support.

3. **Performance:** Use `useMemo` for expensive calculations in card components.

4. **Responsive:** Always test cards on mobile, tablet, and desktop viewports.

5. **Loading States:** Provide loading/skeleton states for cards that fetch data.

6. **Error Handling:** Show error states gracefully within cards.

7. **Color Coding:** Use color consistently (green for positive, red for negative, blue for info).

8. **Typography:** Maintain consistent font sizes and weights within cards.

---

## Future Card Components

Potential new card components to consider:

- **Energy Usage Card:** Daily/weekly energy consumption visualization
- **Maintenance Reminder Card:** System maintenance schedule and reminders
- **Weather Alert Card:** Extreme weather warnings and recommendations
- **Savings Tracker Card:** Historical savings over time
- **Equipment Status Card:** Real-time equipment status and diagnostics
- **Community Comparison Card:** Compare to neighborhood averages

---

*Last Updated: 2025-01-27*

