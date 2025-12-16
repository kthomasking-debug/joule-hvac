# Diagnostic Table Formula - ForecastDebug

## Overview
The diagnostic table shows daily BTU loads and deliveries for 7 days. This document explains how the per-day forecast slice is selected and how each row is calculated.

## Step 1: Group Forecast Hours by Day

```javascript
// Input: forecast = array of hourly forecast objects
// Each hour has: { time: Date, temp: number, humidity: number, dtHours?: number }

const dayMap = new Map();

forecast.forEach(hour => {
  const date = new Date(hour.time);
  // Extract local date components (avoids timezone issues)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(date.getDate()).padStart(2, '0');
  const dayKey = `${year}-${month}-${dayOfMonth}`;  // e.g., "2024-01-15"
  
  if (!dayMap.has(dayKey)) {
    dayMap.set(dayKey, {
      date: dayKey,
      dayName: date.toLocaleDateString('en-US', { weekday: 'short' }), // "Mon", "Tue", etc.
      temps: [],
      hours: [],
    });
  }
  
  const day = dayMap.get(dayKey);
  day.temps.push(hour.temp);
  day.hours.push({
    temp: hour.temp,
    humidity: hour.humidity || 50,
    time: hour.time,
    dtHours: hour.dtHours ?? 1.0,  // Timestep in hours (default 1.0)
  });
});
```

**Key Points:**
- Uses **local date** (not UTC) to group hours into days
- `dayKey` format: `"YYYY-MM-DD"` (e.g., `"2024-01-15"`)
- Each day accumulates all hours that fall within that calendar day
- `day.hours[]` contains the hourly forecast data for that day

## Step 2: Sort Day Keys and Select First 7 Days

```javascript
// Get sorted list of day keys to ensure chronological order
const sortedDayKeys = Array.from(dayMap.keys()).sort();
// sortedDayKeys = ["2024-01-15", "2024-01-16", "2024-01-17", ...]

// Calculate cost for each day with aux heat (only first 7 days)
sortedDayKeys.slice(0, 7).forEach((key, dayIndex) => {
  const day = dayMap.get(key);
  // dayIndex = 0 for first day (Monday), 1 for second day, etc.
  // ...
});
```

**Key Points:**
- `sortedDayKeys.sort()` ensures chronological order (lexicographic sort works for YYYY-MM-DD format)
- `.slice(0, 7)` selects the **first 7 days** from the sorted list
- `dayIndex = 0` corresponds to the **first day** (Monday in the user's case)

## Step 3: Calculate Daily Metrics for Each Day

For each day (key), iterate through `day.hours[]`:

```javascript
// Initialize daily totals
let totalDailyBtuLoad = 0;
let totalHpDeliveredBtu = 0;
let totalAuxDeliveredBtu = 0;
let totalHeatPumpKwh = 0;
let totalAuxKwh = 0;

day.hours.forEach(hour => {
  // Step 3a: Get timestep duration
  const dtHours = hour.dtHours ?? 1.0;  // Usually 1.0 for hourly forecast
  
  // Step 3b: Calculate Daily BTU Load (from hourly loop)
  const dT = Math.max(0, ecobeeTargetTemp - hour.temp);
  const loadBtuHr = heatLossFactor * dT;
  totalDailyBtuLoad += loadBtuHr * dtHours;  // BTU
  
  // Step 3c: Calculate heat pump performance using computeHourlyPerformance()
  // This function models actual heat pump behavior at each hour:
  // - Heat pump output (BTU/hr) based on capacity factor at that temperature
  // - Building heat loss (BTU/hr) based on temperature difference
  // - Delivered heat (HP + Aux) to match building load
  // - HP kWh from delivered heat / COP (removes linear kW scaling assumption)
  // - Aux kWh from deficit when HP output < building load
  const perf = heatUtils.computeHourlyPerformance({
    tons: tons,
    indoorTemp: ecobeeTargetTemp,
    heatLossBtu: heatLossBtu,
    compressorPower: compressorPower,
    hspf2: hspf2,
    cutoffTemp: userSettings?.cutoffTemp ?? -15, // Manufacturer-dependent cutoff temperature
  }, hour.temp, hour.humidity);
  
  // Step 3d: Calculate energy usage
  // Use direct kWh calculation from delivered heat / COP (if available)
  // This removes the linear kW scaling assumption and is more accurate for inverter/variable-speed systems
  const heatPumpKwh = perf.hpKwh !== undefined
    ? perf.hpKwh * dtHours  // kWh (already computed from delivered heat / COP)
    : perf.electricalKw * (perf.runtime / 100) * dtHours; // Fallback for backward compatibility
  totalHeatPumpKwh += heatPumpKwh;
  
  if (useElectricAuxHeat) {
    const auxKwh = perf.auxKw * dtHours;
    totalAuxKwh += auxKwh;
  }
  
  // Step 3e: Calculate BTU deliveries (diagnostic)
  // Use delivered heat from performance calculation if available
  const buildingHeatLossBtuHr = heatLossFactor * Math.max(0, ecobeeTargetTemp - hour.temp);
  const deliveredHpBtuHr = perf.deliveredHpBtuHr !== undefined 
    ? perf.deliveredHpBtuHr 
    : (buildingHeatLossBtuHr * (perf.runtime / 100)); // Fallback
  const deficitBtuHr = perf.deficitBtuHr !== undefined
    ? perf.deficitBtuHr
    : Math.max(0, buildingHeatLossBtuHr - deliveredHpBtuHr); // Fallback
  const deliveredAuxBtuHr = deficitBtuHr;
  
  totalHpDeliveredBtu += deliveredHpBtuHr * dtHours;
  totalAuxDeliveredBtu += deliveredAuxBtuHr * dtHours;
});
```

**Key Formulas:**
- **Daily BTU Load**: `Σ(heatLossFactor × max(0, targetTemp - hour.temp) × dtHours)` over all hours in day
- **HP Delivered BTU**: `Σ(heatpumpOutputBtuHr × runtime × dtHours)` over all hours
- **Aux Delivered BTU**: `Σ(deficitBtuHr × dtHours)` over all hours
- **Invariant**: `totalDailyBtuLoad ≈ totalHpDeliveredBtu + totalAuxDeliveredBtu`

## Step 4: Calculate Display Metrics

```javascript
// Average temperature (for display)
const avgTemp = day.temps.reduce((a, b) => a + b, 0) / day.temps.length;

// Average deltaT (for display)
const avgDeltaT = day.hours.reduce((sum, hour) => {
  return sum + Math.max(0, ecobeeTargetTemp - hour.temp);
}, 0) / day.hours.length;

// Implied average COP (diagnostic)
const impliedAvgCop = totalHeatPumpKwh > 0 
  ? totalHpDeliveredBtu / (totalHeatPumpKwh * 3412.14)
  : null;
```

## Step 5: Build Diagnostic Table Row

```javascript
dailyData.push({
  date: key,                    // "2024-01-15"
  dayName: day.dayName,         // "Mon"
  avgTemp: parseFloat(avgTemp.toFixed(1)),
  minTemp: Math.round(minTemp),
  maxTemp: Math.round(maxTemp),
  deltaT: avgDeltaT.toFixed(1),
  heatPumpKwh: totalHeatPumpKwh.toFixed(1),
  auxKwh: totalAuxKwh.toFixed(1),
  kWh: totalKwh.toFixed(1),
  cost: dailyCost.toFixed(2),
  // Diagnostic data
  totalDailyBtuLoad: totalDailyBtuLoad,        // Used in diagnostic table
  totalHpDeliveredBtu: totalHpDeliveredBtu,    // Used in diagnostic table
  totalAuxDeliveredBtu: totalAuxDeliveredBtu,  // Used in diagnostic table
  impliedAvgCop: impliedAvgCop,                // Used in diagnostic table
});
```

## Step 6: Render Diagnostic Table

```javascript
// In the JSX, the diagnostic table renders:
{dailyCosts.slice(0, 7).map((day, idx) => {
  // day.totalDailyBtuLoad, day.totalHpDeliveredBtu, etc.
  // are displayed in the table
})}
```

## Key Implementation Details

1. **Day Selection**: `sortedDayKeys.slice(0, 7)` selects first 7 days chronologically
   - `dayIndex = 0` = first day (Monday in user's case)
   - All days use the same `heatLossFactor` value

2. **Hour Selection**: `day.hours[]` contains all hours for that calendar day
   - Hours are grouped by **local date** (not UTC)
   - If a day has fewer than 24 hours, it could cause incorrect calculations

3. **BTU Load Calculation**: Computed from hourly loop:
   ```javascript
   totalDailyBtuLoad += heatLossFactor * max(0, targetTemp - hour.temp) * dtHours;
   ```
   - Uses same `heatLossFactor` for all days
   - Uses same formula for all days
   - Should match: `totalDailyBtuLoad ≈ totalHpDeliveredBtu + totalAuxDeliveredBtu`

4. **computeHourlyPerformance() Function**:
   - Models actual heat pump behavior at each hour
   - Calculates delivered heat (HP + Aux) to match building load
   - Computes HP kWh directly from delivered heat / COP (removes linear kW scaling assumption)
   - More accurate for inverter/variable-speed systems than pure "HDD energy estimator" approaches

5. **Potential Issues**:
   - If a day has fewer hours (e.g., forecast starts mid-day), `day.hours.length < 24`
   - If timezone conversion is wrong, hours might be grouped into wrong day
   - If `heatLossFactor` is stale in closure, a day might use old value (fixed by adding to dependency array)

## Debugging Monday Issue

The diagnostic logging now checks:
- `day.hours.length` (should be 24 for full day)
- `heatLossFactor` value used for Day 0
- `totalDailyBtuLoad` vs expected calculation
- Invariant check: `deliveredTotalBtu ≈ totalDailyBtuLoad`

