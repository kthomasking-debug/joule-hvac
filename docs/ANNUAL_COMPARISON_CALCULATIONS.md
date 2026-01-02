# Annual Budget Comparison - Calculation Methodology

## Overview

The annual budget comparison calculates HVAC costs for two locations over 12 months using:
- **Thermostat settings** (winter/summer, day/night temperatures)
- **Schedule times** (when day/night modes are active)
- **Sinusoidal temperature patterns** (hourly temperature variations)
- **Auto-mode logic** (heating and cooling available year-round)

---

## Input Settings

### Temperature Setpoints

| Setting | Default | Range | Used For |
|---------|---------|-------|----------|
| **Winter Daytime** (`winterThermostatDay`) | 70°F | 60-78°F | Heating setpoint during "home" mode hours |
| **Winter Nighttime** (`winterThermostatNight`) | 66°F | 60-78°F | Heating setpoint during "sleep" mode hours |
| **Summer Daytime** (`summerThermostat`) | 76°F | 68-82°F | Cooling setpoint during "home" mode hours |
| **Summer Nighttime** (`summerThermostatNight`) | 78°F | 68-82°F | Cooling setpoint during "sleep" mode hours |

**Important:** These setpoints are used for ALL 12 months (auto-mode logic). The system decides whether to heat or cool based on outdoor temperature relative to these setpoints.

### Schedule Times

| Setting | Default | Format | Effect |
|---------|---------|--------|--------|
| **Daytime Start** (`daytimeTime`) | 06:00 | HH:MM | When "home" mode begins (uses daytime setpoints) |
| **Setback Start** (`nighttimeTime`) | 22:00 | HH:MM | When "sleep" mode begins (uses nighttime setpoints) |

**Mode Determination:**
- Hours between `daytimeTime` and `nighttimeTime` → **"home" mode** (uses daytime setpoints)
- Hours outside this range → **"sleep" mode** (uses nighttime setpoints)

---

## How Settings Affect Costs

### Winter Daytime Temperature
- **Lower value** (e.g., 65°F) → More hours need heating → **Higher heating costs**
- **Higher value** (e.g., 72°F) → Fewer hours need heating → **Lower heating costs**
- **Formula:** `needsHeating = outdoorTemp < winterThermostatDay` (when in home mode)

### Winter Nighttime Temperature
- **Lower value** (e.g., 60°F) → More hours need heating → **Higher heating costs**
- **Higher value** (e.g., 68°F) → Fewer hours need heating → **Lower heating costs**
- **Formula:** `needsHeating = outdoorTemp < winterThermostatNight` (when in sleep mode)

### Summer Daytime Temperature
- **Lower value** (e.g., 72°F) → More hours need cooling → **Higher cooling costs**
- **Higher value** (e.g., 78°F) → Fewer hours need cooling → **Lower cooling costs**
- **Formula:** `needsCooling = outdoorTemp > summerThermostat` (when in home mode)

### Summer Nighttime Temperature
- **Lower value** (e.g., 74°F) → More hours need cooling → **Higher cooling costs**
- **Higher value** (e.g., 80°F) → Fewer hours need cooling → **Lower cooling costs**
- **Formula:** `needsCooling = outdoorTemp > summerThermostatNight` (when in sleep mode)

### Schedule Times
- **Earlier daytime start** (e.g., 5 AM) → More hours use daytime setpoints → Different cost profile
- **Later daytime start** (e.g., 7 AM) → Fewer hours use daytime setpoints → Different cost profile
- **Earlier setback** (e.g., 9 PM) → More hours use nighttime setpoints → Different cost profile
- **Later setback** (e.g., 11 PM) → Fewer hours use nighttime setpoints → Different cost profile

---

## Calculation Flow

### Step 1: Initialize Setpoints

At the start of calculation, setpoints are determined once and used for all 12 months:

```javascript
homeHeatSetPoint = winterThermostatDay      // e.g., 67°F
sleepHeatSetPoint = winterThermostatNight   // e.g., 64°F
homeCoolSetPoint = summerThermostat          // e.g., 69°F
sleepCoolSetPoint = summerThermostatNight   // e.g., 71°F
```

### Step 2: Process Each Month

For each of the 12 months (January = 0, December = 11):

#### 2.1 Calculate Monthly Climate Data

```javascript
// Monthly HDD/CDD distribution (typical pattern)
monthlyHDDDist = [1200, 1000, 600, 200, 50, 10, 0, 0, 20, 200, 500, 1100]
monthlyCDDDist = [0, 0, 10, 60, 150, 300, 400, 350, 200, 80, 10, 0]

// Scale to location's annual totals
monthHDD = (monthlyHDDDist[month] / totalTypicalHDD) * annualHDD
monthCDD = (monthlyCDDDist[month] / totalTypicalCDD) * annualCDD
```

#### 2.2 Generate Daily Temperature Range

```javascript
baseTemp = 50°F
tempRange = 20°F

if (monthHDD > 0) {
  // Heating month: colder temperatures
  dailyLow = baseTemp - (monthHDD / 30)
} else if (monthCDD > 0) {
  // Cooling month: warmer temperatures
  dailyLow = baseTemp + (monthCDD / 20) - tempRange
} else {
  // Transition month
  dailyLow = baseTemp - 5
}

dailyHigh = dailyLow + tempRange
```

#### 2.3 Generate Hourly Sinusoidal Temperatures

For each day in the month, generate 24 hourly temperatures using a sinusoidal pattern:

```javascript
avgTemp = (dailyHigh + dailyLow) / 2
tempRange = dailyHigh - dailyLow

for (hour = 0; hour < 24; hour++) {
  // Phase shift: temperature lowest at 6 AM, highest at 6 PM
  phase = ((hour - 6) / 12) * π
  tempOffset = cos(phase - π) * (tempRange / 2)
  hourlyTemp = avgTemp + tempOffset
}
```

**Result:** Temperature follows a smooth curve, lowest around 6 AM, highest around 6 PM.

### Step 3: Process Each Hour

For each hour in the month:

#### 3.1 Determine Active Mode

```javascript
dayStartHour = parseInt(daytimeTime.split(':')[0])    // e.g., 6
nightStartHour = parseInt(nighttimeTime.split(':')[0]) // e.g., 22

if (dayStartHour < nightStartHour) {
  // Normal schedule (e.g., 6 AM to 10 PM)
  activeMode = (hour >= dayStartHour && hour < nightStartHour) ? "home" : "sleep"
} else {
  // Wrapped schedule (e.g., 10 PM to 6 AM)
  activeMode = (hour >= nightStartHour || hour < dayStartHour) ? "sleep" : "home"
}
```

#### 3.2 Get Setpoints for Active Mode

```javascript
if (activeMode === "home") {
  heatSetpoint = homeHeatSetPoint      // winterThermostatDay
  coolSetpoint = homeCoolSetPoint      // summerThermostat
} else if (activeMode === "sleep") {
  heatSetpoint = sleepHeatSetPoint     // winterThermostatNight
  coolSetpoint = sleepCoolSetPoint     // summerThermostatNight
}
```

#### 3.3 Determine HVAC Needs

```javascript
needsHeating = hourlyTemp < heatSetpoint
needsCooling = hourlyTemp > coolSetpoint
```

**Auto-Mode Logic:**
- If `needsHeating` → Calculate heating energy
- If `needsCooling` → Calculate cooling energy
- If neither → No HVAC needed (no cost)
- Both cannot be true simultaneously

### Step 4: Calculate Hourly Energy

#### 4.1 Heating Energy Calculation

**For Heat Pumps:**
```javascript
indoorTemp = heatSetpoint  // Use the setpoint that triggered heating

// Calculate heat pump performance
perf = computeHourlyPerformance({
  tons: systemTons,
  indoorTemp: indoorTemp,
  designHeatLossBtuHrAt70F: estimatedDesignHeatLoss,
  outdoorTemp: hourlyTemp,
  humidity: 50
})

monthHeatingKwh += perf.hpKwh

// Add auxiliary heat if below balance point
if (hourlyTemp < balancePoint && useElectricAuxHeat) {
  monthHeatingKwh += perf.auxKwh
}
```

**For Non-Heat-Pump Electric:**
```javascript
indoorTemp = heatSetpoint
tempDiff = max(0, indoorTemp - hourlyTemp)
buildingHeatLossBtu = btuLossPerDegF * tempDiff
kwhPerHour = buildingHeatLossBtu / (hspf2 * 1000)
monthHeatingKwh += kwhPerHour
```

**For Gas Furnace:**
```javascript
indoorTemp = heatSetpoint
tempDiff = max(0, indoorTemp - hourlyTemp)
buildingHeatLossBtu = btuLossPerDegF * tempDiff
thermsPerHour = buildingHeatLossBtu / (100000 * afue)
// Gas cost calculated separately (not in kWh)
```

#### 4.2 Cooling Energy Calculation

```javascript
indoorTemp = coolSetpoint  // Use the setpoint that triggered cooling

// 1. Calculate temperature-dependent efficiency
tempDiffFromRating = hourlyTemp - 95  // SEER2 rated at 95°F
efficiencyMultiplier = 1.0 - (tempDiffFromRating * 0.015)  // 1.5% per °F
adjustedSeer2 = clamp(
  seer2Rating * efficiencyMultiplier,
  seer2Rating * 0.5,   // Minimum 50% of rated
  seer2Rating * 1.5    // Maximum 150% of rated
)

// 2. Calculate building heat gain
tempDiff = max(0, hourlyTemp - indoorTemp)
designHeatGain = squareFeet * 28.0 * insulationLevel * homeShape * 
                 ceilingMultiplier * solarExposure
btuGainPerDegF = designHeatGain / 20.0
buildingHeatGainBtuPerHour = btuGainPerDegF * tempDiff * latentFactor

// 3. Apply capacity derate above 95°F
if (hourlyTemp > 95) {
  capacityDerate = max(0.75, 1 - (hourlyTemp - 95) * 0.01)  // -1% per °F
} else {
  capacityDerate = 1.0
}
availableCapacityBtu = (tons * 12000) * capacityDerate

// 4. Calculate actual energy
actualHeatRemovedBtu = min(buildingHeatGainBtuPerHour, availableCapacityBtu)
actualHourlyKwh = actualHeatRemovedBtu / (adjustedSeer2 * 1000)
monthCoolingKwh += actualHourlyKwh
```

### Step 5: Calculate Monthly Costs

```javascript
monthHeatingCost = monthHeatingKwh * electricityRate
monthCoolingCost = monthCoolingKwh * electricityRate

// Fixed costs (prorated monthly)
if (primarySystem === "gasFurnace" && monthHDD > 0) {
  monthlyFixed = fixedGasCost
} else {
  monthlyFixed = fixedElectricCost
}

monthTotal = monthHeatingCost + monthCoolingCost + monthlyFixed
```

### Step 6: Sum Annual Costs

```javascript
totalHeatingCost = sum(monthHeatingCost for all 12 months)
totalCoolingCost = sum(monthCoolingCost for all 12 months)
totalFixedCost = sum(monthlyFixed for all 12 months)
totalAnnual = totalHeatingCost + totalCoolingCost + totalFixedCost
```

---

## Complete Formula Reference

### Sinusoidal Temperature Generation

```
Given:
  dailyLow = average low temperature for the month
  dailyHigh = average high temperature for the month
  hour = hour of day (0-23)

Calculate:
  avgTemp = (dailyHigh + dailyLow) / 2
  tempRange = dailyHigh - dailyLow
  phase = ((hour - 6) / 12) * π
  tempOffset = cos(phase - π) * (tempRange / 2)
  hourlyTemp = avgTemp + tempOffset
```

**Result:** Temperature is lowest at 6 AM, highest at 6 PM, following a smooth sinusoidal curve.

### Heating Energy (Non-Heat-Pump Electric)

```
Given:
  indoorTemp = heating setpoint (from thermostat settings)
  outdoorTemp = hourly outdoor temperature
  btuLossPerDegF = building heat loss per degree Fahrenheit
  hspf2 = heating system performance factor

Calculate:
  tempDiff = max(0, indoorTemp - outdoorTemp)
  buildingHeatLossBtu = btuLossPerDegF * tempDiff
  kwhPerHour = buildingHeatLossBtu / (hspf2 * 1000)
```

### Cooling Energy

```
Given:
  indoorTemp = cooling setpoint (from thermostat settings)
  outdoorTemp = hourly outdoor temperature
  squareFeet = home square footage
  seer2Rating = SEER2 efficiency rating
  tons = cooling system capacity in tons

Step 1: Temperature-Dependent Efficiency
  tempDiffFromRating = outdoorTemp - 95
  efficiencyMultiplier = 1.0 - (tempDiffFromRating * 0.015)
  adjustedSeer2 = clamp(seer2Rating * efficiencyMultiplier, 
                        seer2Rating * 0.5, 
                        seer2Rating * 1.5)

Step 2: Building Heat Gain
  tempDiff = max(0, outdoorTemp - indoorTemp)
  designHeatGain = squareFeet * 28.0 * insulationLevel * 
                   homeShape * ceilingMultiplier * solarExposure
  btuGainPerDegF = designHeatGain / 20.0
  buildingHeatGainBtuPerHour = btuGainPerDegF * tempDiff * latentFactor

Step 3: Capacity Derate (above 95°F)
  if (outdoorTemp > 95) {
    capacityDerate = max(0.75, 1 - (outdoorTemp - 95) * 0.01)
  } else {
    capacityDerate = 1.0
  }
  availableCapacityBtu = (tons * 12000) * capacityDerate

Step 4: Energy Calculation
  actualHeatRemovedBtu = min(buildingHeatGainBtuPerHour, availableCapacityBtu)
  kwhPerHour = actualHeatRemovedBtu / (adjustedSeer2 * 1000)
```

### Balance Point (Heat Pumps)

```
Given:
  tons = heat pump capacity in tons
  btuLossPerDegF = building heat loss per degree Fahrenheit

Calculate:
  ratedCapacityBtu = tons * 12000  // BTU/hr at 47°F
  balancePoint = 70 - (ratedCapacityBtu / btuLossPerDegF)
```

**Meaning:** The outdoor temperature where heat pump capacity equals building heat loss. Below this temperature, auxiliary heat may be needed.

---

## Example Calculation

### Scenario
- **Winter Daytime:** 67°F
- **Winter Nighttime:** 64°F
- **Summer Daytime:** 69°F
- **Summer Nighttime:** 71°F
- **Daytime Start:** 6:00 AM
- **Setback Start:** 10:00 PM

### January 15th at 2:00 PM (Hour 14)

1. **Determine Active Mode:**
   - Hour 14 is between 6 AM and 10 PM → **"home" mode**

2. **Get Setpoints:**
   - `heatSetpoint = 67°F` (winterThermostatDay)
   - `coolSetpoint = 69°F` (summerThermostat)

3. **Check HVAC Needs:**
   - Assume `hourlyTemp = 45°F`
   - `needsHeating = 45 < 67` → **true**
   - `needsCooling = 45 > 69` → **false**

4. **Calculate Heating Energy:**
   - `indoorTemp = 67°F`
   - `tempDiff = 67 - 45 = 22°F`
   - Calculate heat loss and energy consumption based on system type

### January 15th at 11:00 PM (Hour 23)

1. **Determine Active Mode:**
   - Hour 23 is after 10 PM → **"sleep" mode**

2. **Get Setpoints:**
   - `heatSetpoint = 64°F` (winterThermostatNight)
   - `coolSetpoint = 71°F` (summerThermostatNight)

3. **Check HVAC Needs:**
   - Assume `hourlyTemp = 30°F`
   - `needsHeating = 30 < 64` → **true**
   - `needsCooling = 30 > 71` → **false**

4. **Calculate Heating Energy:**
   - `indoorTemp = 64°F`
   - `tempDiff = 64 - 30 = 34°F`
   - Calculate heat loss and energy consumption

---

## Constants and Reference Values

| Constant | Value | Description |
|----------|-------|-------------|
| `BTU_PER_KWH` | 3,412.14 | BTU per kilowatt-hour |
| `BTU_PER_THERM` | 100,000 | BTU per therm (gas) |
| `TONS_TO_BTU_PER_HR` | 12,000 | BTU per hour per ton |
| `BASE_COOLING_LOAD` | 28.0 BTU/(hr·ft²) | Base cooling load factor |
| `BASE_HEAT_LOSS` | 22.67 BTU/(hr·ft²) | Base heat loss factor at 70°F ΔT |
| `SEER2_RATING_TEMP` | 95°F | SEER2 rating temperature |
| `EFFICIENCY_CHANGE` | 0.015 (1.5%) | Efficiency change per °F from rating temp |
| `CAPACITY_DERATE` | 0.01 (1%) | Capacity derate per °F above 95°F |

---

## Key Concepts

### Auto-Mode Logic
Both heating and cooling setpoints are active year-round. The system decides based on outdoor temperature:
- **Heating runs** when `outdoorTemp < heatSetpoint`
- **Cooling runs** when `outdoorTemp > coolSetpoint`
- **No HVAC** when `heatSetpoint ≤ outdoorTemp ≤ coolSetpoint`

### Sinusoidal Temperature Pattern
Hourly temperatures follow a sinusoidal curve to model real-world day/night temperature variations:
- **Lowest temperature:** Around 6 AM
- **Highest temperature:** Around 6 PM
- **Smooth transition:** Between day and night temperatures

This pattern is critical for accurate cost calculations, especially for heat pumps where nighttime auxiliary heat needs significantly impact costs.

### Temperature-Dependent Cooling Efficiency
Cooling systems are more efficient when outdoor temperatures are cooler:
- **At 95°F:** 100% of rated SEER2 efficiency
- **At 85°F:** ~115% efficiency (15% more efficient)
- **At 105°F:** ~85% efficiency (15% less efficient)

This adjustment ensures cooling costs reflect real-world system performance.
