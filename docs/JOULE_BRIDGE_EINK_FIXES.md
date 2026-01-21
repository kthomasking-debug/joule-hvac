# Joule Bridge & E-Ink HMI - Fixes Implemented

## Summary

Fixed critical issues identified in the review:
1. ✅ Added missing API endpoints (`/api/cost-estimate`, `/api/setpoint`)
2. ✅ Fixed `/api/settings` to return data in format expected by e-ink display
3. ✅ Added cost caching to Pi HMI (15-minute TTL)
4. ✅ Registered new routes in bridge server

---

## Changes Made

### 1. Bridge Server (`prostat-bridge/server.py`)

#### Added `/api/cost-estimate` Endpoint
- **Purpose**: Calculate weekly/monthly HVAC cost estimates
- **Method**: POST
- **Request Body**:
  ```json
  {
    "outdoor_temp": 45.0,
    "target_temp": 70.0,
    "duration_hours": 168  // Optional, default 168 (1 week)
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "weeklyCost": 12.50,
    "monthlyCost": 54.13
  }
  ```
- **Logic**: 
  - Uses temperature difference to calculate degree-days
  - Heating: $0.50 per degree-day
  - Cooling: $0.60 per degree-day
  - Minimum cost: $1.00/week

#### Added `/api/setpoint` Endpoint
- **Purpose**: Adjust temperature setpoint by delta (for e-ink display buttons)
- **Method**: POST
- **Request Body**:
  ```json
  {
    "delta": 1  // or -1 for down
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "new_target": 71.0,  // Fahrenheit
    "new_target_c": 21.7  // Celsius
  }
  ```
- **Logic**:
  - Gets current target temperature from primary device
  - Converts Celsius (HomeKit) to Fahrenheit (e-ink)
  - Applies delta
  - Converts back to Celsius and sets on device

#### Fixed `/api/settings` Endpoint
- **Changed**: Now returns data in flat format expected by e-ink display
- **Old Format**: `{success: true, settings: {...}}`
- **New Format**: 
  ```json
  {
    "last_forecast_summary": {...},
    "userSettings": {...},
    "location": {...}
  }
  ```
- **Logic**:
  - Tries to load forecast data from cache file (`last_forecast_summary.json`)
  - Falls back to settings if not in separate file
  - Extracts location from settings

#### Route Registration
Added routes in `create_app()` function:
```python
app.router.add_post('/api/cost-estimate', handle_cost_estimate)
app.router.add_post('/api/setpoint', handle_setpoint_delta)
```

---

### 2. Pi HMI (`pi-hmi/joule_hmi.py`)

#### Added Cost Caching
- **Cache File**: `/tmp/joule_cost_cache.json`
- **TTL**: 15 minutes (900 seconds)
- **Format**:
  ```json
  {
    "weekly_cost": "$12.50/wk",
    "monthly_cost": "$54.13/mo",
    "timestamp": 1234567890.123
  }
  ```
- **Behavior**:
  - Checks cache before fetching from API
  - Uses cached data if age < 15 minutes
  - Caches result after successful fetch
  - Works for all cost sources (forecast, API, fallback)

#### Added `_cache_cost()` Method
- **Purpose**: Helper method to cache cost data
- **Location**: After all cost calculation paths
- **Error Handling**: Logs errors but doesn't fail if cache write fails

#### Added `json` Import
- Required for cache read/write operations

---

## Testing Recommendations

### 1. Test `/api/cost-estimate`
```bash
curl -X POST http://localhost:8080/api/cost-estimate \
  -H "Content-Type: application/json" \
  -d '{
    "outdoor_temp": 45.0,
    "target_temp": 70.0,
    "duration_hours": 168
  }'
```

Expected: `{"success": true, "weeklyCost": 12.50, "monthlyCost": 54.13}`

### 2. Test `/api/setpoint`
```bash
# First, ensure a device is paired
curl -X POST http://localhost:8080/api/setpoint \
  -H "Content-Type: application/json" \
  -d '{"delta": 1}'
```

Expected: `{"success": true, "new_target": 71.0, "new_target_c": 21.7}`

### 3. Test `/api/settings` Format
```bash
curl http://localhost:8080/api/settings
```

Expected: Flat structure with `last_forecast_summary`, `userSettings`, `location`

### 4. Test Cost Caching on Pi
1. Run Pi HMI: `python3 joule_hmi.py`
2. Wait for first cost calculation
3. Check cache: `cat /tmp/joule_cost_cache.json`
4. Verify cache is used on next refresh (check logs for "Using cached cost data")

---

## Known Limitations

1. **Cost Calculation**: Simplified formula (degree-days × fixed rate)
   - Doesn't account for building efficiency, system type, time-of-day rates
   - Should be improved with actual utility rate data

2. **Cache Location**: Uses `/tmp` which may be cleared on reboot
   - Consider using persistent location: `~/.local/share/joule-hmi/cost_cache.json`

3. **Settings Sync**: Forecast data must be manually synced to bridge
   - Consider adding endpoint to sync from web app to bridge

4. **Temperature Conversion**: Assumes HomeKit returns Celsius
   - May need adjustment for different thermostat models

---

## Next Steps

1. **Improve Cost Calculation**:
   - Use actual utility rates from settings
   - Account for building efficiency (square footage, insulation)
   - Consider time-of-day pricing

2. **Persistent Cache**:
   - Move cache to `~/.local/share/joule-hmi/`
   - Add cache cleanup (remove old entries)

3. **Settings Sync**:
   - Add endpoint to sync forecast data from web app
   - Auto-sync when forecast is updated

4. **Error Handling**:
   - Add retry logic for failed API calls
   - Show error messages on e-ink display

5. **Testing**:
   - Add unit tests for cost calculation
   - Add integration tests for API endpoints
   - Test on actual hardware (Pi Zero 2W)

---

## Files Modified

1. `prostat-bridge/server.py`
   - Added `handle_cost_estimate()` function
   - Added `handle_setpoint_delta()` function
   - Modified `handle_get_settings()` function
   - Added route registrations

2. `pi-hmi/joule_hmi.py`
   - Added `json` import
   - Modified `fetch_weekly_cost()` to check cache first
   - Added `_cache_cost()` method
   - Added cache calls after successful cost fetches

---

## Verification Checklist

- [x] `/api/cost-estimate` endpoint added and registered
- [x] `/api/setpoint` endpoint added and registered
- [x] `/api/settings` returns expected format
- [x] Cost caching implemented in Pi HMI
- [x] Cache TTL set to 15 minutes
- [x] All cost calculation paths cache results
- [x] Error handling for cache operations
- [ ] Tested on actual hardware
- [ ] Tested with real thermostat
- [ ] Verified cost calculations are accurate

---

## Notes

- The cost calculation uses simplified formulas. For production, integrate with actual utility rate data and building characteristics.
- Cache location (`/tmp`) is temporary. Consider moving to persistent storage for production.
- The e-ink display will now show cost data even after reload, thanks to caching.
- Temperature adjustment buttons on e-ink display should now work with the new `/api/setpoint` endpoint.
