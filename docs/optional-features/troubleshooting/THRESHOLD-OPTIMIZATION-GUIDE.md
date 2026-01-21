# ProStat Threshold Optimization Guide

These are the "Threshold" settings that separate the rookies from the pros.

Here is your ProStat Optimization Guide for each setting, based on maximizing comfort and equipment longevity.

## 1. The "Comfort vs. Savings" Group

### Heat/Cool Min Delta (°F): 3 (Default is usually 5)

**What it does:** The deadband between heating and cooling in Auto mode.

**Recommendation:** Keep at 3°F or 4°F.

**Why:** If it's too tight (e.g., 2°F), you risk "fighting" (AC turns on right after Heat turns off). 3°F is safe.

**CSV Analysis:**

- Extract: `Heat Set Temp (F)` vs `Cool Set Temp (F)` when in Auto mode
- Calculate: `Setpoint Spread = Cool Set Temp (F) - Heat Set Temp (F)`
- If spread drops below 3°F and system flips back and forth → raise to 4–5°F

### AC Overcool Max (°F): 2 (Maximize this)

**What it does:** Allows the AC to cool below the setpoint to remove humidity.

**Recommendation:** Set to 2°F or 3°F.

**Why:** This is "free" dehumidification. If your humidity is high, let the AC run longer. It feels better to be 72°F/45% RH than 74°F/60% RH.

**CSV Analysis:**

- Look for rows where `Current Temp (F) < Cool Set Temp (F)` while `Cool Stage 1 (sec) > 0`
- If zero overcool events → humidity never high enough or feature not triggering
- Safe to leave at 2°F or raise to 3°F for more aggressive dehumidification

## 2. The "Equipment Protection" Group (Critical)

### Compressor Min Cycle-Off (sec): 300 → 600

**Recommendation:** INCREASE to 600 (10 minutes).

**Why:** 5 minutes (300s) is the industry bare minimum. 10 minutes allows pressure to equalize fully. This one setting adds years to your compressor life.

**CSV Analysis:**

- Find rows where `Cool Stage 1 (sec) > 0` or `Heat Stage 1 (sec) > 0`
- Check time since previous cycle ended
- If any off-to-on gaps < 240 sec → short cycling is happening → increase to 360–480 sec
- If zero short cycles → 300 sec is already perfect

### Heat/Cool Min On Time (sec): 300 → 600

**Recommendation:** INCREASE to 600 (10 minutes).

**Why:** Short runs don't reach steady-state efficiency. Force the system to run for at least 10 minutes to actually move heat.

**CSV Analysis:**

- Calculate: `df[df['Heat Stage 1 (sec)'] > 0]['Heat Stage 1 (sec)'].describe()`
- If many runs < 180 sec → increase to 360–420 sec
- If average runtime is 8–12 minutes → 300 sec is perfect

### Heat/Cool Differential (°F): 0.5 → 1.0

**Recommendation:** INCREASE to 1.0°F or 1.5°F.

**Why:** 0.5°F is too tight. It causes short cycling. 1.0°F is imperceptible to humans but drastically reduces cycle counts.

**CSV Analysis:**

- **Heat Differential:** Calculate `Heat Error = Heat Set Temp (F) - Current Temp (F)`
- Look at max positive value right before heat starts
- If max error regularly >1.0°F → room feels cold → lower to 0.8–1.0°F
- If only drops 0.6–0.8°F before recovering → 0.5°F is already aggressive enough

- **Cool Differential:** Calculate `Cool Error = Current Temp (F) - Cool Set Temp (F)`
- Same analysis for cooling mode

## 3. The "Financial Savings" Group (Heat Pump Specific)

### Compressor Min Outdoor Temp (°F): 0 → 30-35

**What it does:** Locks out the heat pump below this temp.

**Recommendation:** Set to your "Balance Point" (e.g., 20°F) or 30-35°F.

**Why:** Below 20°F, your heat pump might be less efficient than gas (if dual fuel) or just ineffective. Don't run it if it can't keep up.

**CSV Analysis:**

- Find: `df[(df['Heat Stage 1 (sec)'] > 0) & (df['Outdoor Temp (F)'] < 35)]`
- If compressor ran below 30–35°F and aux never kicked in → you're stressing the heat pump
- Raise to 30–35°F and force aux below that

### Aux Heat Max Outdoor Temp (°F): 40 → 35

**What it does:** Prevents expensive electric strips/gas furnace from running above this temp.

**Recommendation:** LOWER to 35°F.

**Why:** 40°F is too warm to waste money on Aux heat. Your heat pump can easily handle 35°F–40°F. Make it work for its money.

**CSV Analysis:**

- Find: `df[(df['Aux Heat 1 (sec)'] > 0)]['Outdoor Temp (F)'].max()`
- If aux ran above 45–50°F → you're wasting money
- If aux never ran → can safely raise to 50°F or disable aux entirely for max savings

### Configure Staging: Auto → Manual

**Recommendation:** CHANGE TO MANUAL.

**Why:** "Auto" logic is often dumb (it engages Aux heat too early if the temp drops 1 degree). Manual lets you set "Compressor to Aux Temp Delta" (e.g., don't fire Aux unless we are 3°F behind).

## 4. The "Physics Tweaks" Group

### Heat/Cool Dissipation Time (sec): 0 → 60

**What it does:** Runs the fan after the compressor turns off to blow remaining cold/hot air out of the ducts.

**Recommendation:** Set to 60 seconds (Auto usually does this, but forcing it ensures it).

**Why:** You paid to heat/cool that air. Don't leave it in the ducts. Blow it into the room.

**CSV Analysis:**

- Look at temperature 5–15 minutes after heat cycle ends
- Calculate coast-up: temperature rise after heat turns off
- If coast-up is typically +0.4 to +0.7°F → setting to 30–60 seconds will capture free heat
- This reduces next cycle length by ~10–15%. Huge savings win.

### Cool Dissipation Time (sec): 0 → 30-45

**Same idea for cooling**

**CSV Analysis:**

- Same method as heat dissipation
- Not relevant in winter, but worth setting to 30–45 sec in summer

### Compressor Reverse Staging: Checked

**Recommendation:** KEEP CHECKED.

**Why:** If you have a 2-stage unit, this allows it to downshift from Stage 2 (High) to Stage 1 (Low) as it gets close to the setpoint, rather than just shutting off. This is smoother and more efficient.

**CSV Analysis:**

- Look for stage-2 runtime followed by stage-1 only near setpoint
- If Stage 2 columns are always zero → single-stage unit → this setting does nothing

## Summary of Changes for "ProStat Mode"

- **Cycle Off:** 300 → 600s (Save the compressor)
- **Differentials:** 0.5 → 1.0°F (Stop short cycling)
- **Aux Lockout:** 40 → 35°F (Save money)
- **Dissipation:** 0 → 60s (Free energy)

Apply these, and your graph will smooth out instantly.

## Quick CSV Analysis Queries

### 1. Are you short cycling?

```python
short_cycles = df[(df['Heat Stage 1 (sec)'] > 0) & (df['Heat Stage 1 (sec)'] < 240)]
print(len(short_cycles))  # → should be 0 or very close
```

### 2. How much free heat are you throwing away?

```python
coast_up = df[df['Heat Stage 1 (sec)'] == 0].groupby(df['Date'])['Current Temp (F)'].max() - df[df['Heat Stage 1 (sec)'] > 0].groupby('Date')['Current Temp (F)'].max()
print(coast_up)  # → this is the heat you could capture with 30–60 sec dissipation
```

### 3. When did the heat pump run in money-wasting territory?

```python
cold_compressor = df[(df['Heat Stage 1 (sec)'] > 0) & (df['Outdoor Temp (F)'] < 35)]
print(cold_compressor[['Date','Outdoor Temp (F)','Heat Stage 1 (sec)']])
```

Run those three snippets and you'll know within 30 seconds whether you should:

- Raise Compressor Min Outdoor Temp to 35°F
- Turn on 45–60 sec Heat Dissipation Time (biggest free savings)
- Leave everything else exactly as-is because your system is already running near perfect
