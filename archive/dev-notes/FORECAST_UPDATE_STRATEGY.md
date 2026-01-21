# Forecast Update Strategy - Regular Updates & Automatic Synchronization

## Quick Answer

**YES, forecast updates happen automatically!** Here's how:

### Three-Level Update Strategy

```
Level 1: SevenDayCostForecaster.jsx
  ↓ Fetches forecast when user enters location
  ↓ Saves to localStorage (last_forecast_summary)
  ↓ Updates when location changes

Level 2: E-Ink Display (EInkBridgeDisplay.jsx)
  ↓ Reads from localStorage every 15 minutes
  ↓ Auto-refreshes cost calculations
  ↓ Shows latest data to user

Level 3: Pi Bridge
  ↓ Receives data via POST /api/settings
  ↓ Stores in joule-settings.json
  ↓ Python HMI reads on refresh cycle
```

---

## How Updates Currently Work

### 1. Initial Setup (One-Time)

When user completes onboarding:

```
PiZeroOnboarding.jsx
  ↓ handleSearchLocation() calls Open-Meteo APIs
  ↓ Saves location to localStorage
  ↓ Forecast data saved to last_forecast_summary
  ↓ Status: ✅ Ready
```

### 2. E-Ink Display Updates (Every 15 minutes)

[EInkBridgeDisplay.jsx, lines 301-309]

```javascript
useEffect(() => {
  fetchWeeklyCost();
  
  // Auto-refresh every 15 minutes (matching e-ink update cycle)
  const interval = setInterval(() => {
    fetchWeeklyCost();
  }, 15 * 60 * 1000);  // 15 * 60 * 1000 = 900,000 ms
  
  return () => clearInterval(interval);
}, [fetchWeeklyCost]);
```

**What happens every 15 minutes:**
1. `fetchWeeklyCost()` is called automatically
2. Reads latest forecast from localStorage
3. Recalculates costs based on current temperature
4. Updates display with new values
5. Triggered without user interaction

### 3. Weather Forecast Refresh (On-Demand)

When user visits `/analysis/forecast`:

```
useForecast.js hook
  ↓ Fetches 7-day hourly forecast from NWS API
  ↓ Falls back to Open-Meteo if NWS unavailable
  ↓ Automatically refetches if latitude/longitude change
  ↓ Caches data in localStorage
```

**Triggers for forecast refetch:**
- User enters a new location (coordinates change)
- Hook detects lat/lon dependency changed
- Manual refresh button (if implemented)
- No automatic periodic refresh (intentional - weather doesn't change often)

### 4. Pi Synchronization

When forecast is shared with Pi:

```
shareSettingsWithPi() in bridgeApi.js
  ↓ POSTs to http://{piIp}/api/settings
  ↓ Shares: last_forecast_summary + userSettings
  ↓ Pi stores in joule-settings.json
  ↓ Python HMI reads on next refresh
  
Pi-side refresh cycle:
  ↓ joule_hmi.py polls bridge every 5 minutes
  ↓ Reads settings from /api/settings
  ↓ Updates display with latest data
```

---

## Current Update Cycles

| Component | Update Interval | Trigger | Auto? |
|-----------|-----------------|---------|-------|
| **SevenDayCostForecaster** | On-demand | User enters location OR clicks search | ✅ Auto (on location change) |
| **E-Ink Display Cost** | 15 minutes | Timer interval | ✅ Auto (every 15 min) |
| **Weather Forecast** | On-demand | User visits page OR location changes | ✅ Auto (on coord change) |
| **Pi Bridge Data** | 5 minutes | Python HMI poll cycle | ✅ Auto (Pi-side) |
| **E-Ink Display Render** | Real-time | Cost/temp changes | ✅ Auto (React state) |

---

## Flow Diagram: Complete Update Cycle

```
┌─────────────────────────────────────────────────────────────┐
│                    USER ENTERS LOCATION                     │
│            (in onboarding or /analysis/forecast)            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │  Geocoding & Elevation     │
        │  (Open-Meteo API)          │
        │  ~500ms                    │
        └────────────┬───────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │  Save to localStorage      │
        │  - userLocation            │
        │  - userSettings            │
        └────────────┬───────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │  Fetch 7-Day Weather       │
        │  (NWS or Open-Meteo)       │
        │  ~1-2 seconds              │
        └────────────┬───────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │  Calculate Heating/Cooling │
        │  Costs from Weather        │
        │  ~milliseconds             │
        └────────────┬───────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │  Save to localStorage      │
        │  - last_forecast_summary   │
        │  - totalHPCost, etc        │
        └────────────┬───────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │  Share with Pi (Optional)  │
        │  POST /api/settings        │
        │  ~200ms                    │
        └────────────┬───────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │  Pi Stores in JSON File    │
        │  joule-settings.json       │
        └────────────┬───────────────┘
                     │
        ┌────────────┴────────────────┐
        │                             │
        ▼                             ▼
    ┌─────────────┐            ┌──────────────┐
    │   Every 15  │            │  Every 5 min │
    │   Minutes:  │            │   (Pi-side): │
    │  E-Ink Auto │            │   Python HMI │
    │  Recalculate│            │   Poll Bridge│
    │  & Refresh  │            │  & Update    │
    └─────────────┘            └──────────────┘
        │                             │
        ▼                             ▼
    ┌─────────────┐            ┌──────────────┐
    │  Display    │            │  E-Ink Shows │
    │  Monthly    │            │  Live Cost   │
    │  Cost       │            │  Data        │
    └─────────────┘            └──────────────┘
```

---

## What Triggers Updates

### Automatic (No User Action Required)

✅ **E-Ink display refreshes cost every 15 minutes**
- Timer in EInkBridgeDisplay.jsx
- Recalculates from localStorage data
- Updates display automatically

✅ **Pi syncs every 5 minutes**
- Python HMI polling cycle
- Checks bridge for new settings
- Updates display on Pi

✅ **Weather forecast re-fetches on location change**
- useForecast.js dependency tracking
- When latitude/longitude changes
- New forecast fetched automatically

### Manual (User Triggered)

🖱️ **User enters new location**
- Onboarding modal or /analysis/forecast page
- Triggers forecast fetch
- Saves new forecast to localStorage

🖱️ **User shares with Pi**
- "Share with Pi" button (or onboarding modal)
- POSTs current forecast data
- Pi stores immediately

🖱️ **User adjusts temperature**
- ±1° buttons on e-ink display
- Recalculates cost locally
- Updates display immediately

---

## Where Forecast Data Comes From

### Primary Source: National Weather Service (NWS)

```javascript
// useForecast.js
const pointsUrl = `https://api.weather.gov/points/${latitude},${longitude}`;
const forecastUrl = `https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/forecast/hourly`;
```

**Why NWS?**
- US government official source
- Highly accurate
- Free, no API key needed
- Detailed hourly data

### Fallback: Open-Meteo

```javascript
// If NWS unavailable or outside US:
const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=...`;
```

**Why Open-Meteo?**
- Works worldwide
- No API key needed
- Accurate alternative
- Covers non-US locations

---

## Update Schedule in Detail

### Minute 0: User enters location
```
Action: User enters "Atlanta, Georgia"
Result: Forecast fetched and saved
Status: Ready to display
```

### Minutes 1-14: E-Ink display shows data
```
Display: Monthly cost updated on screen
Action: None (reading from cache)
Network: Idle
```

### Minute 15: First auto-refresh
```
Action: Timer fires (15 * 60 * 1000 ms)
Result: Cost recalculated from stored forecast
Network: Reads from localStorage only
Effect: Display might update if calculations changed
```

### Minute 30: Second auto-refresh
```
Action: Timer fires again
Result: Cost recalculated
Network: Reads from localStorage only
```

### Ongoing (every 15 minutes): Auto-refresh continues
```
Timeline:
  0 min   - User enters location
  15 min  - Auto-refresh #1
  30 min  - Auto-refresh #2
  45 min  - Auto-refresh #3
  60 min  - Auto-refresh #4
  ...continues indefinitely
```

### Pi-side (every 5 minutes)
```
Timeline:
  0:00   - Data shared with Pi
  5:00   - Pi polls bridge
  5:01   - Python HMI reads settings
  5:02   - E-ink updates (if data changed)
  10:00  - Pi polls again
  ...continues indefinitely
```

---

## How to Manually Force Updates

### Refresh Forecast Data

**In browser console:**
```javascript
// Clear and refetch
localStorage.removeItem("last_forecast_summary");
location.reload();
```

Or visit `/analysis/forecast` and re-enter location.

### Refresh E-Ink Display

**Option 1: Wait 15 minutes** (automatic)

**Option 2: Manual refresh** (if button available)
```javascript
// Manually call refresh
bridge?.refresh?.();
```

**Option 3: Reload page**
```javascript
location.reload();
```

### Refresh Pi Data

**On Pi terminal:**
```bash
# Restart Python HMI
systemctl restart joule-hmi

# Or manually trigger read:
curl http://localhost:3002/api/settings | jq
```

---

## Troubleshooting: Data Not Updating

### Symptom: E-Ink shows old cost

**Check 1: Has 15 minutes passed?**
- Automatic refresh is every 15 minutes
- If less than 15 min, this is normal

**Check 2: Did location change?**
```javascript
JSON.parse(localStorage.getItem("userLocation"))
```

**Check 3: Is forecast data cached?**
```javascript
JSON.parse(localStorage.getItem("last_forecast_summary"))
```

**Check 4: Manual refresh**
```javascript
// Force recalculation
localStorage.removeItem("last_forecast_summary");
location.reload();
```

### Symptom: Pi shows old cost

**Check 1: Is Python HMI running?**
```bash
ps aux | grep joule_hmi.py
```

**Check 2: Did data reach Pi?**
```bash
curl http://localhost:3002/api/settings | jq
```

**Check 3: Pi last synced data**
```bash
cat pi-zero-bridge/joule-settings.json | jq .timestamp
```

**Check 4: Manual Pi refresh**
```bash
systemctl restart joule-hmi
```

### Symptom: Weather not updating

**Check 1: Is location set?**
```javascript
localStorage.getItem("userLocation")
```

**Check 2: Did forecast fetch?**
```javascript
localStorage.getItem("last_forecast_summary")
```

**Check 3: Manual refetch**
- Visit `/analysis/forecast`
- Re-enter location
- Wait 2-3 seconds for fetch

---

## Configuration Options

### Change E-Ink Refresh Interval

[EInkBridgeDisplay.jsx, line 307]

Current: `15 * 60 * 1000` = 15 minutes

```javascript
// To change to 5 minutes:
const interval = setInterval(() => {
  fetchWeeklyCost();
}, 5 * 60 * 1000);  // 5 minutes

// To change to 30 minutes:
const interval = setInterval(() => {
  fetchWeeklyCost();
}, 30 * 60 * 1000);  // 30 minutes
```

### Change Pi Sync Interval

Controlled by Python HMI on Pi, typically 5 minutes.

**Modify on Pi:**
```python
# In pi-hmi/joule_hmi.py
while True:
    # Update display
    sleep(300)  # 5 minutes - change this value
```

---

## Future Enhancement Ideas

### 1. Manual Refresh Button
```jsx
<button onClick={() => {
  localStorage.removeItem("last_forecast_summary");
  fetchWeeklyCost();
}}>
  🔄 Refresh Now
</button>
```

### 2. Configurable Refresh Interval
```jsx
<input 
  type="number" 
  min="5" 
  max="60"
  placeholder="Minutes between refreshes"
/>
```

### 3. Force Full Recalculation
```jsx
<button onClick={() => {
  setShowPiOnboarding(true);  // Re-trigger forecast fetch
}}>
  Update Weather Data
</button>
```

### 4. Display Last Update Time
```jsx
<span className="text-xs text-slate-400">
  Last updated: {lastUpdated?.toLocaleTimeString()}
</span>
```

### 5. Real-Time Sync
```javascript
// Instead of 15-minute interval, use WebSocket
socket.on('forecast-updated', (newData) => {
  localStorage.setItem('last_forecast_summary', JSON.stringify(newData));
  setMonthlyCost(newData.totalHPCostWithAux * 4.33);
});
```

---

## Summary

**Current behavior:**
✅ **Automatic** - E-ink refreshes every 15 minutes automatically
✅ **Automatic** - Pi syncs every 5 minutes automatically
✅ **Automatic** - Weather fetches when location changes
✅ **Manual** - User can force update by changing location or reloading

**Is this good enough?**
- For typical use: **YES** - 15 min cycle matches e-ink refresh rate
- For high-accuracy needs: **MAYBE** - Could reduce to 5 min
- For real-time: **NO** - Would need WebSocket/streaming

**Users don't need to do anything** - updates happen automatically in the background!
