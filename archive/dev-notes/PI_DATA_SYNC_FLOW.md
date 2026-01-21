# Pi Data Sync Flow: Joule HVAC E-Ink Display

## Overview
This document explains how data flows from your React app (running on your main PC) to the Pi Zero 2W e-ink display.

```
┌─────────────────────────┐
│   React App (Browser)   │
│   - SevenDayForecaster  │
│   - Calculates costs    │
│   - Saves to localStorage
└────────┬────────────────┘
         │ "Share with Pi"
         │ button click
         ▼
┌──────────────────────────┐
│   Pi Bridge (port 3002)  │
│   - Receives POST        │
│   - Stores to JSON file  │
│   - Serves via GET       │
└────────┬─────────────────┘
         │ Local network
         │ (same Pi)
         ▼
┌──────────────────────────┐
│   Python HMI (Pi Zero 2W)│
│   - Reads from /api/...  │
│   - Displays on e-ink    │
└──────────────────────────┘
```

## Components

### 1. React App (Main PC - localhost:5173)
**File:** `src/pages/SevenDayCostForecaster.jsx`

**What it does:**
- User completes onboarding and runs forecaster
- Calculates weekly heating/cooling costs
- **Saves to browser localStorage:**
  - `last_forecast_summary`: Contains `totalHPCost` (base) + `totalHPCostWithAux` (with aux heat)
  - `userSettings`: Contains utility rates, building specs, system info
- **User action:** Clicks "Share with Pi" button
- **Button calls:** `shareSettingsWithPi('http://<pi-ip>:3002')`

**Data saved in localStorage:**
```javascript
{
  "last_forecast_summary": {
    "location": "City, State",
    "totalHPCost": 33.32,           // Base HP cost
    "totalHPCostWithAux": 43.64,    // With aux heat
    "timestamp": 1705779600000,
    "dailySummary": [...]
  },
  "userSettings": {
    "utilityCost": 0.1234,
    "capacity": 36,
    "squareFeet": 1500,
    "indoorTemp": 70,
    ...
  }
}
```

### 2. Pi Bridge Server (Port 3002)
**File:** `pi-zero-bridge/server.js`

**Endpoints added:**

#### GET /api/settings
Returns the last saved settings from file.
```bash
curl http://192.168.1.50:3002/api/settings
```
Returns:
```json
{
  "last_forecast_summary": {...},
  "userSettings": {...},
  "timestamp": "2026-01-20T..."
}
```

#### POST /api/settings
Receives settings from React app and stores locally.
```bash
curl -X POST http://192.168.1.50:3002/api/settings \
  -H "Content-Type: application/json" \
  -d '{"last_forecast_summary": {...}, "userSettings": {...}}'
```

**File storage:** `pi-zero-bridge/joule-settings.json`

**Why this works:**
- Pi bridge is already running on the Pi
- Stores settings in local JSON file
- No external database needed
- Python HMI can read from localhost

### 3. Python HMI (Pi Zero 2W)
**File:** `pi-hmi/joule_hmi.py`

**What it does:**
- Runs periodically (every 15 minutes by default)
- **Calls** `fetch_weekly_cost()`:
  1. **First:** Tries to read from bridge: `http://localhost:3002/api/settings`
  2. **Extracts:** `totalHPCostWithAux` (preferred) or `totalHPCost`
  3. **If no forecast data:** Falls back to degree-day estimation
- **Displays on e-ink:** Shows "$X.XX/wk" and "$Y.YY/mo"

**Flow in `fetch_weekly_cost()`:**
```python
# 1. Try localStorage data from bridge
response = GET http://localhost:3002/api/settings
  └─> Extract totalHPCostWithAux or totalHPCost

# 2. If not available, try /api/weekly-cost endpoint
response = GET http://localhost:3002/api/weekly-cost
  └─> Use weeklyCost field

# 3. If all else fails, estimate from temps
temp_diff = indoor_temp - outdoor_temp
estimate = temp_diff * 7 * 0.50  # rough estimation
```

## Data Sync Workflow

### Step 1: User Completes Forecaster
- User enters location, building specs, system info
- Forecaster calculates 7-day cost forecast
- **Saves automatically to browser localStorage**

### Step 2: User Shares with Pi (NEW)
- User opens "Share Settings" modal in Forecaster
- Enters Pi IP address (e.g., `192.168.1.50`)
- Clicks "Share with Pi" button
- React app POSTs to `http://<pi-ip>:3002/api/settings`
- Bridge server saves to `joule-settings.json`

### Step 3: Python HMI Fetches Data
- Python script runs on Pi (systemd timer or cron)
- Calls `fetch_weekly_cost()` 
- GETs from `http://localhost:3002/api/settings`
- Reads `totalHPCostWithAux` (with aux heat)
- Falls back to `totalHPCost` (base cost only)
- **Displays on e-ink display**

### Step 4: E-ink Display Shows Cost
- Shows `$43.64/wk` and `$189.27/mo`
- Refreshes every 15 minutes
- Matches Quick Answer display in React app

## Cost Priority Logic

**All three systems now use the same priority:**
1. **First choice:** `totalHPCostWithAux` (heat pump + auxiliary heat)
2. **Fallback:** `totalHPCost` (heat pump only)
3. **Last resort:** Degree-day estimation

This ensures consistency:
- Quick Answer shows `$43.64/wk` ✓
- E-ink display shows `$43.64/wk` ✓
- Python HMI shows `$43.64/wk` ✓

## Setting Up Pi IP

### Find your Pi's IP address:

**On Pi:**
```bash
hostname -I
# Output: 192.168.1.50
```

**From your main PC:**
```bash
ping raspberrypi.local
# or
arp -a | grep -i raspberry
```

### Test connectivity:
```bash
curl http://192.168.1.50:3002/health
# Should return: {"status":"ok","mode":"groq-powered",...}
```

## Troubleshooting

### "Connection refused" on Pi bridge
- Ensure `pi-zero-bridge/server.js` is running
- Check that port 3002 is not blocked by firewall
- Verify Pi IP address is correct

### E-ink still shows old cost
- Click "Share with Pi" again to force sync
- Check that `joule-settings.json` exists on Pi: `cat /root/pi-zero-bridge/joule-settings.json`
- Restart Python HMI: `sudo systemctl restart joule-hmi`

### Getting "--" on e-ink display
- Bridge API call failed (check /api/settings endpoint)
- localStorage data is empty (run Forecaster first)
- Fallback estimation didn't work (check temps from bridge)

## Security Note

⚠️ **WARNING:** The `/api/settings` endpoint accepts POST from any origin (due to CORS headers). This allows any device on your network to overwrite settings. 

For production, you might want to:
1. Add authentication token to POST requests
2. Restrict to specific IP ranges
3. Add input validation for settings

## Future Improvements

- [ ] Add periodic auto-sync (React app sends updates every hour)
- [ ] Add delete/reset settings button
- [ ] Log sync history for debugging
- [ ] Add status indicator showing last successful sync
- [ ] Support multiple Pi devices (each with own settings)
