# Heat Loss Data Flow - From Forecaster to Bridge to Pi

## Quick Answer

The bridge gets heat loss data **indirectly through userSettings that are shared from the React Forecaster app**. Here's the complete path:

```
User enters building info (sqft, insulation)
                ↓
React Forecaster calculates heat loss
                ↓
Saved in localStorage as userSettings
                ↓
Posted to Pi Bridge via /api/settings
                ↓
Pi HMI reads from bridge
                ↓
Used in cost calculations on e-ink display
```

---

## Complete Data Flow

### Step 1: User Input (Settings Page or Onboarding)

User provides building characteristics:
```
- Square Feet: 1500
- Insulation Level: 1.0 (poor to excellent scale)
- Ceiling Height: 8 ft
- Home Shape: 1.0 (cube to cabin)
- Has Loft: yes/no
```

### Step 2: React Forecaster Calculates Heat Loss

**File:** `src/lib/heatUtils.js`

```javascript
export function calculateHeatLoss({
  squareFeet,        // 1500
  insulationLevel,   // 1.0
  homeShape,         // 1.0
  ceilingHeight,     // 8
  wallHeight,        // (optional, for cabins)
  hasLoft            // true/false
}) {
  const baseBtuPerSqFt = 22.67;
  // Multiply by insulation level, shape, ceiling adjustments
  // Returns: ~850 BTU/hr at 70°F temperature difference
}
```

**Formula breakdown:**
```
Base heat loss = 22.67 BTU/hr/sqft
Adjusted for:
  + Insulation level (1.0 = no adjustment, 0.5 = better insulated, 2.0 = worse)
  + Ceiling height multiplier (8 ft = base, each foot = 10% more loss)
  + Home shape (1.0 = cube, 1.2+ = cabin with pitched roof)
  + Wall height (for cabin calculations)

Result: Heat loss factor (BTU/hr per °F delta)
        E.g., 850 BTU/hr per degree difference between inside and outside
```

### Step 3: Three-Tier Priority System

**File:** `src/pages/SevenDayCostForecaster.jsx` (lines 978-1022)

Heat loss is determined in this priority order:

```javascript
const effectiveHeatLoss = useMemo(() => {
  // Priority 1: Manual Entry (if user explicitly entered it)
  if (useManualHeatLoss) {
    return userSettings.manualHeatLoss * 70;  // Convert per-degree to 70°F delta
  }
  
  // Priority 2: From Heat Loss Analyzer (coast-down test)
  if (useAnalyzerHeatLoss && analyzerHeatLoss) {
    return userSettings.analyzerHeatLoss * 70;
  }
  
  // Priority 3: Calculated from Building Characteristics (DEFAULT)
  if (useCalculatedHeatLoss) {
    return heatUtils.calculateHeatLoss({
      squareFeet: userSettings.squareFeet,
      insulationLevel: userSettings.insulationLevel,
      homeShape: userSettings.homeShape,
      ceilingHeight: userSettings.ceilingHeight,
      wallHeight: userSettings.wallHeight,
      hasLoft: userSettings.hasLoft,
    });
  }
}, [userSettings, heatLossFactor]);
```

**Example values:**
```
Poor insulation, large house:   ~1200 BTU/hr per °F
Average home:                    ~850 BTU/hr per °F  
Well insulated, compact home:    ~600 BTU/hr per °F
```

### Step 4: Saved to localStorage

**File:** `src/pages/SevenDayCostForecaster.jsx` (lines 1460-1467)

```javascript
// Save to localStorage for sharing with Pi
localStorage.setItem('userSettings', JSON.stringify({
  squareFeet: 1500,
  insulationLevel: 1.0,
  homeShape: 1.0,
  ceilingHeight: 8,
  wallHeight: null,
  hasLoft: false,
  manualHeatLoss: null,              // Only if user entered manually
  analyzerHeatLoss: null,            // Only if from coast-down test
  useManualHeatLoss: false,
  useCalculatedHeatLoss: true,       // Use calculated by default
  useAnalyzerHeatLoss: false,
  // ... other settings (capacity, hspf2, efficiency, etc)
}));
```

### Step 5: Posted to Pi Bridge

**File:** `src/lib/bridgeApi.js` (lines 48-68)

When user clicks "Share with Pi" (or completes onboarding):

```javascript
export async function shareSettingsWithPi(piUrl) {
  const userSettings = localStorage.getItem('userSettings');
  const forecastData = localStorage.getItem('last_forecast_summary');
  
  const payload = {
    userSettings: JSON.parse(userSettings),       // ← Contains heat loss settings
    last_forecast_summary: JSON.parse(forecastData),
    timestamp: new Date().toISOString(),
  };
  
  // POST to Pi Bridge
  await fetch(`${piUrl}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
```

**What gets sent:**
```json
{
  "userSettings": {
    "squareFeet": 1500,
    "insulationLevel": 1.0,
    "homeShape": 1.0,
    "ceilingHeight": 8,
    "wallHeight": null,
    "hasLoft": false,
    "capacity": 36,
    "hspf2": 9.0,
    "utilityCost": 0.15,
    "gasCost": 1.20,
    ...
  },
  "last_forecast_summary": {
    "totalHPCost": 33.32,
    "totalHPCostWithAux": 43.64,
    "dailySummary": [...],
    ...
  }
}
```

### Step 6: Pi Bridge Stores Data

**File:** `pi-zero-bridge/server.js` (lines 170-189)

```javascript
// POST /api/settings endpoint
app.post('/api/settings', (req, res) => {
  try {
    const settings = req.body;
    
    // Save to file for persistence
    fs.writeFileSync(
      'joule-settings.json',
      JSON.stringify(settings, null, 2)
    );
    
    console.log('Settings saved');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**File created:** `pi-zero-bridge/joule-settings.json`
```json
{
  "userSettings": {...},
  "last_forecast_summary": {...},
  "timestamp": "2026-01-20T10:30:00Z"
}
```

### Step 7: Pi HMI Reads Settings

**File:** `pi-hmi/joule_hmi.py` (lines 175-196)

```python
def fetch_weekly_cost(self):
    """Fetch weekly HVAC cost estimate"""
    # First try to read from Forecaster's localStorage data (via bridge)
    try:
        response = requests.get(f'{BRIDGE_URL}/api/settings', timeout=5)
        if response.status_code == 200:
            settings = response.json()
            
            # Extract forecast data shared from React app
            if 'last_forecast_summary' in settings:
                forecast_data = settings['last_forecast_summary']
                # Cost already calculated by React using heat loss
                cost = (forecast_data.get('totalHPCostWithAux') or 
                       forecast_data.get('totalHPCost'))
                
                if cost and isinstance(cost, (int, float)):
                    self.weekly_cost = f"${cost:.2f}/wk"
                    self.monthly_cost = f"${cost * 4.33:.2f}/mo"
                    return
    except Exception as e:
        print(f"Bridge settings fetch error: {e}")
    
    # Fallback: Use outdoor temp with degree-days
    # (uses basic estimate, doesn't use heat loss factor)
```

### Step 8: E-Ink Display Shows Cost

**File:** `src/pages/EInkBridgeDisplay.jsx` (lines 130-168)

```javascript
// E-ink reads from localStorage
const forecastData = localStorage.getItem('last_forecast_summary');
const forecastSummary = JSON.parse(forecastData);

// Display monthly cost
const monthlyCost = forecastSummary.totalHPCostWithAux * 4.33;
// Renders: "$189.27 per month"
```

---

## Where Heat Loss Is Actually Used

### In Cost Calculations

**SevenDayCostForecaster.jsx** (lines 1077-1091)

```javascript
// For heating calculations
const params = {
  tons: 2.0,                          // System capacity
  indoorTemp: 70,                     // Setpoint
  designHeatLossBtuHrAt70F: 850,      // ← HEAT LOSS HERE
  compressorPower: 1.5,               // System efficiency
  hspf2: 9.0,                         // Seasonal efficiency rating
};
const performance = heatUtils.computeHourlyPerformance(params, outdoorTemp, humidity);
```

**Formula for hourly heating load:**
```
Load = Heat Loss Factor × (Indoor Temp - Outdoor Temp)
     = 850 × (70 - 45)
     = 850 × 25
     = 21,250 BTU/hr
     = 6.2 kWh of heating needed per hour
     = ~$0.93 at $0.15/kWh
```

### Per-Day Calculation

```
Monday outdoor temps: [45°, 46°, 47°, 48°, 50°, 52°, 55°, 58°]

For each hour:
  Load = 850 × (70 - outdoor_temp)
  
Hour 1: 850 × (70-45) = 21,250 BTU/hr
Hour 2: 850 × (70-46) = 20,400 BTU/hr
... (etc for all 24 hours)

Daily Total: Sum of hourly loads
           = ~425,000 BTU for the day
           = ~125 kWh equivalent
           = ~$18.75 cost for heating
```

### Week Total

```
Sum of all 7 days with actual forecast
= Weekly cost displayed ($43.64 with aux heat)
= Monthly cost (× 4.33) = $189.27
```

---

## Data Sources for Heat Loss

### 1. Calculated (Most Common)

Uses **Department of Energy** building standards:
- Base loss: 22.67 BTU/hr/sqft
- Adjusted by insulation level, shape, ceiling height
- Formula: `DOE_Base × Insulation × Shape_Factor × Ceiling_Factor`

**Pros:**
- No special equipment needed
- Quick estimate
- Works without user's historical data

**Cons:**
- Generic (doesn't account for actual construction quality)
- May be 10-30% off from real value

### 2. Manual Entry

User manually calculates or estimates heat loss:
```
If user knows their home lost X BTUs/hr per degree
(from manual calculations, engineering audit, etc)
```

**Pros:**
- Most accurate if user has good data
- Can be verified by professional

**Cons:**
- Requires user to know this value
- Not typical for homeowners

### 3. Analyzer (Heat Loss Test)

Derived from **coast-down test** (how fast house temperature drops):

```
1. Heat house to 75°F
2. Turn off HVAC
3. Watch temperature drop
4. Calculate: Heat_Loss = (Temperature_Drop_Per_Hour) × Thermal_Mass

Example:
  House drops 2°F per hour after heating stopped
  Thermal mass ≈ 20 BTU/°F (rough estimate)
  Heat loss ≈ 2 × 20 = 40 BTU/hr per °F
```

**Pros:**
- Based on actual home behavior
- Very accurate

**Cons:**
- Requires test to be performed
- Takes 4-6 hours minimum
- Must be done in stable weather

---

## How Bridge Uses Heat Loss

### Scenario 1: React App Calculates, Pi Displays

```
┌─────────────────────┐
│  React Forecaster   │
│  Calculates:        │
│  - Heat loss: 850   │
│  - Weekly: $43.64   │
│  - Monthly: $189    │
└──────────┬──────────┘
           │ Saves to localStorage
           ▼
┌─────────────────────┐
│  User clicks        │
│  "Share with Pi"    │
└──────────┬──────────┘
           │ POST /api/settings
           ▼
┌─────────────────────┐
│  Pi Bridge stores   │
│  settings.json      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Pi HMI reads       │
│  Bridge for cost    │
│  (doesn't use HL)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  E-ink displays:    │
│  "$189 per month"   │
└─────────────────────┘
```

**Result:** Heat loss is *calculated* but not *used* by Pi. Pi just reads the final cost.

### Scenario 2: Bridge Uses Heat Loss (Future)

```
┌─────────────────────┐
│  Bridge API with    │
│  /cost-weekly POST  │
│  {temp, humidity}   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Bridge reads       │
│  settings.json      │
│  Gets heat loss     │
│  (850 BTU/hr)       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Bridge calculates: │
│  Load = HL × ΔT     │
│  = 850 × 31        │
│  Cost per hour      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Returns to Pi HMI  │
│  or E-ink Display   │
│  with cost          │
└─────────────────────┘
```

---

## Current Bridge Behavior

The Pi bridge **currently doesn't use heat loss directly**. Instead:

1. **Best case:** Pi reads `last_forecast_summary` from bridge
   - Uses cost already calculated by React
   - Heat loss was already used in React calculation
   - Result: Accurate cost displayed

2. **Fallback case:** Pi estimates from outdoor temperature
   - Uses simple degree-days formula
   - Ignores actual heat loss data
   - Result: Rough estimate, might be 50% off

```python
# Current fallback in joule_hmi.py
if outdoor_temp < target_temp - 2:  # Heating
    weekly_dd = temp_diff * 7
    estimate = weekly_dd * 0.50  # ← Hardcoded $0.50/DD
else:  # Cooling
    estimate = weekly_dd * 0.60  # ← Hardcoded $0.60/DD
```

---

## Enhancement: Bridge Could Use Heat Loss

To make the bridge more intelligent, we could:

### Option 1: Bridge Calculates Cost

```javascript
// In pi-zero-bridge/server.js
app.post('/api/cost-weekly', (req, res) => {
  const { temperature, humidity, outdoor_temps } = req.body;
  const settings = JSON.parse(fs.readFileSync('joule-settings.json'));
  
  // Extract heat loss from userSettings
  const heatLoss = settings.userSettings.calculatedHeatLoss || 850;
  
  // Calculate week's cost using actual heat loss
  let totalCost = 0;
  for (const hour of outdoor_temps) {
    const load = heatLoss * (temperature - hour.temp);
    const kwh = load / 3412;  // Convert BTU to kWh
    totalCost += kwh * settings.userSettings.utilityCost;
  }
  
  res.json({ weeklyCost: totalCost });
});
```

### Option 2: Pi HMI Uses Heat Loss

```python
# In pi-hmi/joule_hmi.py
def fetch_weekly_cost(self):
    try:
        response = requests.get(f'{BRIDGE_URL}/api/settings', timeout=5)
        settings = response.json()
        
        # Extract heat loss from settings
        heat_loss = settings['userSettings'].get('calculatedHeatLoss', 850)
        outdoor_temp = float(self.outdoor_temp.replace('°', '').strip())
        target_temp = float(self.bridge_data['target'].replace('°', '').strip())
        
        # Calculate load for a typical week
        weekly_load = heat_loss * (target_temp - outdoor_temp) * 24 * 7
        weekly_kwh = weekly_load / 3412
        weekly_cost = weekly_kwh * 0.15  # $0.15/kWh
        
        self.weekly_cost = f"${weekly_cost:.2f}/wk"
        self.monthly_cost = f"${weekly_cost * 4.33:.2f}/mo"
    except Exception as e:
        print(f"Error: {e}")
```

---

## Summary

**Heat Loss Data Flow:**

```
Building Info (sqft, insulation, etc)
    ↓ Input by user or defaults
React Forecaster
    ↓ Calculates using heatUtils.calculateHeatLoss()
Saved as userSettings
    ↓ In localStorage
Shared with Pi
    ↓ Via POST /api/settings
Pi Bridge stores
    ↓ In joule-settings.json
Pi HMI reads
    ↓ Via GET /api/settings
E-ink Display shows
    ↓ Final monthly cost calculated from heat loss
"$189 per month"
```

**Key Points:**
- ✅ Heat loss is **calculated** in React
- ✅ Heat loss is **saved** to localStorage
- ✅ Heat loss is **shared** with Pi bridge
- ⚠️ Heat loss is **read** by Pi but not currently **used** (just caches final cost)
- 🔮 Future: Bridge could use heat loss to recalculate costs dynamically

**Users don't need to do anything** - heat loss calculation happens automatically from the building info they enter!
