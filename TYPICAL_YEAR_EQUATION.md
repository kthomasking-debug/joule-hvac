# `generateTypicalYearHourlyTemps()` Equation

## Function Signature
```javascript
function generateTypicalYearHourlyTemps(
  monthHDD,      // Monthly HDD (heating degree days)
  monthCDD,      // Monthly CDD (cooling degree days)
  daysInMonth,   // Number of days in month (28-31)
  heatingBaseF,  // Base temperature for HDD (heating setpoint)
  coolingBaseF,  // Base temperature for CDD (cooling setpoint)
  avgTemp,       // Average outdoor temperature for the month
  minTemp,       // Minimum outdoor temperature for the month
  maxTemp        // Maximum outdoor temperature for the month
)
```

## Step-by-Step Equation

### Step 1: Generate Base Hourly Temperatures (Sinusoidal Daily Cycle)

For each hour `h` in the month (0 to `hoursInMonth - 1`):

```javascript
dayOfMonth = floor(h / 24)
hourOfDay = h % 24

// Daily temperature cycle: sinusoidal with peak at 2 PM (hour 14), minimum at 6 AM (hour 6)
hourAngle = ((hourOfDay - 6 + 24) % 24) * (π / 12)
dailyCycle = cos(hourAngle)  // -1 at 6 AM, +1 at 2 PM

// Temperature range and amplitude
tempRange = maxTemp - minTemp
dailyAmplitude = tempRange * 0.4  // 40% of range for daily variation

// Monthly variation (slight day-to-day variation)
dayVariation = sin((dayOfMonth / daysInMonth) * 2π) * (tempRange * 0.1)

// Initial hourly temperature
temp = avgTemp + (dailyCycle * dailyAmplitude) + dayVariation

// Clamp to min/max bounds
temp = max(minTemp, min(maxTemp, temp))
```

### Step 2: Generate Synthetic Humidity

```javascript
humidityCycle = -dailyCycle  // Inverted: high at night, low during day
humidity = 60 + (humidityCycle * 10)  // 50-70% range
```

### Step 3: Calculate Actual HDD/CDD from Generated Temps

```javascript
actualHDD = 0
actualCDD = 0

for each hour in hourlyTemps:
  if temp < heatingBaseF:
    actualHDD += (heatingBaseF - temp) / 24
  if temp > coolingBaseF:
    actualCDD += (temp - coolingBaseF) / 24
```

### Step 4: Scale Temperatures to Match Target HDD/CDD Exactly

**For Heating (HDD scaling):**
```javascript
if monthHDD > 0 and actualHDD > 0:
  hddScale = monthHDD / actualHDD
  
  for each hour in hourlyTemps:
    if hour.temp < heatingBaseF:
      delta = heatingBaseF - hour.temp
      hour.temp = heatingBaseF - (delta * hddScale)
```

**For Cooling (CDD scaling):**
```javascript
if monthCDD > 0 and actualCDD > 0:
  cddScale = monthCDD / actualCDD
  
  for each hour in hourlyTemps:
    if hour.temp > coolingBaseF:
      delta = hour.temp - coolingBaseF
      hour.temp = coolingBaseF + (delta * cddScale)
```

### Step 5: Compute Diagnostic Statistics

```javascript
temps = hourlyTemps.map(h => h.temp)
monthlyMinTemp = min(temps)
monthlyMaxTemp = max(temps)
sortedTemps = sort(temps)
p5 = sortedTemps[floor(length * 0.05)]
p50 = sortedTemps[floor(length * 0.50)]
p95 = sortedTemps[floor(length * 0.95)]
hoursBelow32F = count(temps where t < 32)
```

## Mathematical Summary

**Base temperature generation:**
```
T(h) = T_avg + 0.4 * (T_max - T_min) * cos((h_of_day - 6) * π/12) 
       + 0.1 * (T_max - T_min) * sin(2π * day_of_month / days_in_month)
T(h) = clamp(T(h), T_min, T_max)
```

**HDD scaling (for hours below heating base):**
```
T_scaled(h) = T_base - (T_base - T(h)) * (HDD_target / HDD_actual)
```

**CDD scaling (for hours above cooling base):**
```
T_scaled(h) = T_base + (T(h) - T_base) * (CDD_target / CDD_actual)
```

## Key Characteristics

1. **Preserves monthly averages**: After scaling, the generated temps match `monthHDD` and `monthCDD` exactly
2. **Sinusoidal daily cycle**: Peak at 2 PM, minimum at 6 AM (40% amplitude)
3. **Monthly variation**: Slight day-to-day variation (10% amplitude)
4. **Synthetic humidity**: 50-70% range, inverted daily cycle (high at night, low during day)
5. **Tail distribution risk**: HDD/CDD only constrain averages, not tail distribution (cold hour extremes)

## Limitations

- **Tail distribution is underdetermined**: Two different temp distributions can have identical HDD but very different aux heat requirements
- **Humidity is synthetic**: Not based on climatology, may affect defrost penalty accuracy
- **No cold spell modeling**: Doesn't model multi-day cold snaps that drive aux heat





















