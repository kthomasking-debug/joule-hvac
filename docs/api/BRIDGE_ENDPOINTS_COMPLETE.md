# Bridge Endpoints - Implementation Complete

## Status: ✅ ALL ENDPOINTS IMPLEMENTED

The bridge now has all the endpoints needed for the HMI to function.

---

## Implemented Endpoints

### 1. GET `/api/status` 
**Purpose:** Get current HVAC state

**Response:**
```json
{
  "temperature": 68.5,
  "humidity": 45,
  "hvacMode": "heat",
  "targetTemp": 70,
  "connected": true,
  "timestamp": "2026-01-20T10:30:00Z"
}
```

**What it does:**
- Returns current temperature (from thermostat/cached)
- Returns humidity (from thermostat/cached)
- Returns HVAC mode (off, heat, cool, auto)
- Returns target setpoint
- Returns connection status
- Reads from `joule-settings.json` device object

---

### 2. GET `/api/wifi/signal`
**Purpose:** Get WiFi signal strength

**Response:**
```json
{
  "bars": 3,
  "signal": "ok"
}
```

**What it does:**
- Returns WiFi strength as 0-3 bars
- Tries to use `iwconfig wlan0` on Linux/Pi
- Converts dBm to bars: -30 = 3, -60 = 2, -80 = 1, -90+ = 0
- Defaults to 3 bars if detection fails

---

### 3. POST `/api/setpoint`
**Purpose:** Change target temperature

**Request:**
```json
{
  "targetTemp": 72
}
```

**Response:**
```json
{
  "success": true,
  "targetTemp": 72,
  "message": "Setpoint changed to 72°F"
}
```

**Validation:**
- Must be between 60-85°F
- Updates `joule-settings.json` device.targetTemp
- Records timestamp of change

---

### 4. POST `/api/mode`
**Purpose:** Change HVAC mode

**Request:**
```json
{
  "mode": "heat"
}
```

**Valid modes:** `off`, `heat`, `cool`, `auto`

**Response:**
```json
{
  "success": true,
  "mode": "heat",
  "message": "HVAC mode changed to heat"
}
```

**What it does:**
- Validates mode is one of: off, heat, cool, auto
- Updates `joule-settings.json` device.hvacMode
- Records timestamp of change

---

## How They Work Together

### HMI Display Update Flow:
```
1. HMI calls GET /api/status
   ↓
2. Gets: temperature, humidity, mode, setpoint
   ↓
3. Displays on 250x122 e-ink screen
   ↓
4. User presses button for mode/temp change
   ↓
5. HMI sends POST /api/setpoint or POST /api/mode
   ↓
6. Bridge updates joule-settings.json
   ↓
7. HMI refreshes by calling GET /api/status again
   ↓
8. Display updates with new values
```

---

## Data Persistence

All changes persist in `joule-settings.json`:
```json
{
  "device": {
    "temperature": 68.5,
    "humidity": 45,
    "hvacMode": "heat",
    "targetTemp": 72,
    "connected": true,
    "lastSetpointChange": "2026-01-20T10:30:00Z",
    "lastModeChange": "2026-01-20T10:29:00Z"
  }
}
```

---

## Integration with HMI

The HMI (`pi-hmi/joule_hmi.py`) now:

✅ Calls `/api/status` to get HVAC state  
✅ Calls `/api/wifi/signal` to show signal bars  
✅ Calls `/api/setpoint` when user presses ±1° buttons  
✅ Calls `/api/mode` when user switches modes  
✅ Calls `/api/cost-estimate` for dynamic cost calculation  

---

## Testing

### Run all tests:
```bash
node test-bridge-endpoints.js 192.168.1.50 3002
```

### Manual tests:
```bash
# Get status
curl http://192.168.1.50:3002/api/status

# Get WiFi signal
curl http://192.168.1.50:3002/api/wifi/signal

# Change setpoint to 72°F
curl -X POST http://192.168.1.50:3002/api/setpoint \
  -H "Content-Type: application/json" \
  -d '{"targetTemp": 72}'

# Change mode to heat
curl -X POST http://192.168.1.50:3002/api/mode \
  -H "Content-Type: application/json" \
  -d '{"mode": "heat"}'
```

---

## Architecture

### Bridge Pattern:
```
┌─────────────────────────────────────────┐
│ Pi Bridge (Node.js server on 3002)      │
├─────────────────────────────────────────┤
│ • /api/status      → reads device state │
│ • /api/wifi/signal → system info        │
│ • /api/setpoint    → updates settings   │
│ • /api/mode        → updates settings   │
│ • /api/cost-estimate → calculates cost  │
│ • /api/settings    → r/w config         │
├─────────────────────────────────────────┤
│ Storage: joule-settings.json (local)    │
└─────────────────────────────────────────┘
       ↑ ↓
  ┌────────────┐
  │ HMI (Pi)   │
  │ e-ink      │
  │ display    │
  └────────────┘
```

---

## What's Cached vs Real-Time

### Cached (from joule-settings.json):
- Temperature
- Humidity  
- HVAC mode
- Target setpoint
- Connection status

### Real-Time:
- WiFi signal strength (calculated each request)

### Both:
- Cost estimates (calculated on-demand, but uses cached heat loss)

---

## Future Enhancements

To make the bridge truly smart:

1. **Ecobee Integration**
   - Read real temperature/humidity from Ecobee API
   - Send setpoint changes to Ecobee
   - Get real-time HVAC cycling data

2. **HomeKit Integration**
   - Use HomeKit API for accessory control
   - Read actual device state from HomeKit

3. **Database Backend**
   - Replace JSON file storage with SQLite
   - Track historical temperature/cost data
   - Enable analytics and trending

4. **Machine Learning**
   - Predict optimal setpoints
   - Learn user preferences
   - Enable adaptive scheduling

---

## Files Modified

- ✅ `pi-zero-bridge/server.js` - Added 4 new endpoints
- ✅ `pi-hmi/joule_hmi.py` - Updated to use `/api/cost-estimate`
- ✅ `test-bridge-endpoints.js` - Created test suite (new file)

---

## Summary

**Bridge is now COMPLETE** with all endpoints needed for HMI operation. The system follows a cache-first pattern with real-time WiFi detection, and all state changes persist to `joule-settings.json`. The HMI can now:

- Display live HVAC state
- Show WiFi signal strength
- Change temperature via buttons
- Change HVAC mode
- See cost estimates with dynamic calculation

Everything is integrated and ready for testing! 🎯
