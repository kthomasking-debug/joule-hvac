# Typical Year Hourly Temperature Generation - Analysis & Issues

## Current Implementation: `generateTypicalYearHourlyTemps()`

**Location:** `src/pages/BudgetDebug.jsx` (lines 69-140)

```javascript
function generateTypicalYearHourlyTemps(monthHDD, monthCDD, daysInMonth, heatingBaseF, coolingBaseF, avgTemp, minTemp, maxTemp) {
  const hoursInMonth = daysInMonth * 24;
  const hourlyTemps = [];
  
  // Create a sinusoidal daily temperature cycle
  // Peak at 2 PM (hour 14), minimum at 6 AM (hour 6)
  for (let hour = 0; hour < hoursInMonth; hour++) {
    const dayOfMonth = Math.floor(hour / 24);
    const hourOfDay = hour % 24;
    
    // Daily temperature cycle: sinusoidal with peak at 2 PM, minimum at 6 AM
    const hourAngle = ((hourOfDay - 6 + 24) % 24) * (Math.PI / 12);
    const dailyCycle = Math.cos(hourAngle); // -1 at 6 AM, +1 at 2 PM
    
    // Temperature range: min to max
    const tempRange = maxTemp - minTemp;
    const dailyAmplitude = tempRange > 0 ? tempRange * 0.4; // 40% of range for daily variation
    
    // Base temperature varies slightly by day (add some monthly variation)
    const dayVariation = Math.sin((dayOfMonth / daysInMonth) * Math.PI * 2) * (tempRange * 0.1);
    
    // Calculate hourly temperature
    let temp = avgTemp + (dailyCycle * dailyAmplitude) + dayVariation;
    
    // Clamp to min/max bounds
    temp = Math.max(minTemp, Math.min(maxTemp, temp));
    
    // Typical humidity: higher at night (6 AM), lower during day (2 PM)
    const humidityCycle = -dailyCycle; // Inverted: high at night, low during day
    const humidity = 60 + (humidityCycle * 10); // 50-70% range
    
    hourlyTemps.push({ temp, humidity });
  }
  
  // Adjust temperatures to match HDD/CDD exactly
  // Calculate actual HDD/CDD from generated temps
  let actualHDD = 0;
  let actualCDD = 0;
  hourlyTemps.forEach(({ temp }) => {
    if (temp < heatingBaseF) {
      actualHDD += (heatingBaseF - temp) / 24;
    }
    if (temp > coolingBaseF) {
      actualCDD += (temp - coolingBaseF) / 24;
    }
  });
  
  // Scale temperatures to match target HDD/CDD
  if (monthHDD > 0 && actualHDD > 0) {
    const hddScale = monthHDD / actualHDD;
    hourlyTemps.forEach(hour => {
      if (hour.temp < heatingBaseF) {
        const delta = heatingBaseF - hour.temp;
        hour.temp = heatingBaseF - (delta * hddScale);
      }
    });
  }
  
  if (monthCDD > 0 && actualCDD > 0) {
    const cddScale = monthCDD / actualCDD;
    hourlyTemps.forEach(hour => {
      if (hour.temp > coolingBaseF) {
        const delta = hour.temp - coolingBaseF;
        hour.temp = coolingBaseF + (delta * tempScale);
      }
    });
  }
  
  return hourlyTemps;
}
```

## Critical Issues Identified

### 1. **Underdetermined Tail Distribution (HIGH RISK)**

**Problem:** HDD/CDD only constrain the *average* temperature deficit/surplus, not the *distribution* of cold hours. Aux heat depends critically on:
- How many hours fall below balance point (e.g., < 32°F)
- How low those hours go
- How long cold spells last

**Current behavior:**
- Synthetic temps use sinusoidal daily cycle (40% amplitude)
- Temps are clamped to min/max bounds
- HDD scaling preserves average but not tail distribution
- **Result:** Aux kWh (795 kWh) may look authoritative but is sensitive to generator assumptions

**Example:** Two different temp distributions can have identical HDD:
- **Distribution A:** Many hours just below base (e.g., 31°F), few very cold hours → Low aux
- **Distribution B:** Few hours just below base, many very cold hours (e.g., 10°F) → High aux

**Recommendation:**
- Use actual **TMY hourly dataset** (NREL TMY3) if available
- If synthesizing, validate by reporting:
  - Hours below balance point (e.g., `< 32.2°F`)
  - Monthly min temp
  - Distribution percentiles (p5, p50, p95)
  - Cold spell duration statistics

### 2. **Humidity is Synthetic and Constant**

**Problem:** Defrost penalty depends on hourly humidity, but current implementation:
- Uses simple sinusoidal cycle (50-70% range)
- No monthly climatology
- No correlation with temperature extremes

**Impact:** Defrost penalties in "typical year" mode may be arbitrary if:
- Humidity is constant
- Borrowed from forecast window
- Missing and defaulted

**Recommendation:**
- Use **monthly climatology RH** (or dewpoint) alongside temps
- Or disable humidity-driven defrost in typical year mode (use temp-only curve)
- Document the method used

### 3. **Dead Code: `electricalKw` Computed But Not Used**

**Problem:** `computeHourlyPerformance()` computes:
```javascript
const baseElectricalKw = heatpumpOutputBtuHr / (cop * 3412.14);
const electricalKw = baseElectricalKw * defrostPenalty;
```

But then calculates kWh from `deliveredBtu / effectiveCop` and never uses `electricalKw`.

**Fix:** 
- Delete unused `baseElectricalKw` / `electricalKw` calculations, OR
- Use them only for "max kW draw" display field
- Update code to use `perf.hpKwh` directly (already computed correctly)

### 4. **Outdated Runtime Wording**

**Problem:** Documentation says "Runtime is capped at 1.0; if Runtime > 1.0 aux supplements..."

But new runtime is:
```javascript
runtime = delivered / available
```

which **cannot exceed 1** by construction.

**Fix:** Update narrative to match new model:
- "Runtime = delivered heat / available capacity (0-1)"
- "When delivered < load, aux heat supplements the deficit"

### 5. **COP/HSPF2 Calibration Claims vs Reality**

**Problem:** Documentation claims COP curve is "scaled so its seasonal average matches HSPF2 under standard bin hours."

**Reality check:** Current implementation in `getCOPFactor()`:
```javascript
// Compute seasonal average COP of base curve under standard HSPF2 bin hours
const baseSeasonalCOP = computeSeasonalAverageCOP();
const targetSeasonalCOP = (hspf2 * 1000) / BTU_PER_KWH;
const scaleFactor = targetSeasonalCOP / baseSeasonalCOP;
return baseCOP * scaleFactor;
```

**Verification needed:**
- Does `computeSeasonalAverageCOP()` actually use HSPF2 test bin distribution?
- Or is it just `scaleFactor = hspf2/9` (rough proportional scaling)?

**Fix:**
- If truly calibrated: document the bin distribution used
- If rough scaling: call it "proportional scaling" not "standards-calibrated match"

### 6. **Missing Sanity Checks**

**Recommended assertions/tests:**

1. **Energy balance per timestep:**
   ```javascript
   assert(abs(deliveredHP + deliveredAux - load) < tolerance);
   ```

2. **No free heat:**
   ```javascript
   if (loadBtuHr == 0) assert(hpKwh == 0 && auxKwh == 0);
   ```

3. **No negative COP / divide-by-zero:**
   ```javascript
   const effectiveCop = Math.max(0.5, cop / defrostPenalty); // Clamp minimum
   ```

4. **TMY generator stability:**
   ```javascript
   // Report diagnostic stats
   const hoursBelowBalancePoint = hourlyTemps.filter(t => t.temp < balancePoint).length;
   const monthlyMinTemp = Math.min(...hourlyTemps.map(t => t.temp));
   const percentiles = computePercentiles(hourlyTemps.map(t => t.temp), [5, 50, 95]);
   ```

## Recommended Fixes

### Priority 1: Fix Dead Code
- Update `BudgetDebug.jsx` to use `perf.hpKwh` instead of `perf.electricalKw * (perf.runtime / 100)`
- Remove or repurpose unused `baseElectricalKw` calculations

### Priority 2: Add Validation
- Add sanity checks (energy balance, no free heat, COP clamping)
- Report TMY generator diagnostics (hours below balance point, min temp, percentiles)

### Priority 3: Improve Typical Year Generation
- Use actual TMY hourly dataset if available
- If synthesizing, use monthly climatology for humidity
- Document method and validate tail distribution

### Priority 4: Update Documentation
- Fix runtime wording
- Clarify COP/HSPF2 calibration method
- Document typical year limitations






















