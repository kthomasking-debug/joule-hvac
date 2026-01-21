# Joule Bridge & E-Ink HMI Review

## Executive Summary

The Joule Bridge is a Raspberry Pi-based HomeKit HAP controller that provides local, low-latency control of Ecobee thermostats. The e-ink HMI provides a wall-mounted display interface optimized for the Waveshare 2.13" e-paper display.

**Overall Assessment:** ✅ Well-architected system with good separation of concerns. Some areas need optimization and bug fixes.

### 🔴 Critical Issues Found

1. **Missing API Endpoints**: `/api/cost-estimate` and `/api/setpoint` don't exist in bridge server
2. **Settings API Format Mismatch**: E-ink expects different response format than bridge provides
3. **Cost Data Not Persisting**: Cost calculations aren't cached, causing blank displays on reload
4. **Touch Controls Broken**: Temperature adjustment buttons won't work without `/api/setpoint` endpoint

### ✅ What Works Well

- HomeKit HAP integration is solid
- Display layout is well-designed for 250x122 pixels
- Error handling and fallbacks are comprehensive
- Partial refresh support reduces ghosting

---

## Architecture Overview

### Components

1. **Bridge Server** (`prostat-bridge/server.py`)
   - Python async HTTP server (aiohttp)
   - HomeKit HAP controller (aiohomekit)
   - Relay control (USB serial)
   - Blueair integration
   - TP-Link device support
   - HomeKit bridge (exposes devices as accessories)

2. **E-Ink HMI (Web Preview)** (`src/pages/EInkBridgeDisplay.jsx`)
   - React component simulating the e-ink display
   - 250x122 pixel layout (2.13" Waveshare)
   - Three pages: Status, Actions, Guide
   - Real-time bridge data integration

3. **Pi HMI (Python)** (`pi-hmi/joule_hmi.py`)
   - Actual e-ink display driver
   - Waveshare EPD library integration
   - Touch input handling
   - 15-minute auto-refresh cycle

4. **API Client** (`src/lib/jouleBridgeApi.js`)
   - Bridge communication layer
   - Device discovery and pairing
   - Status polling
   - Control functions

5. **React Context** (`src/contexts/JouleBridgeContext.jsx`)
   - Shared bridge state across app
   - Automatic polling (5s default)
   - Error handling and reconnection

---

## Strengths

### ✅ Architecture
- **Clean separation**: Bridge server, API client, React components, Pi HMI are well-separated
- **Local-first**: No cloud dependencies for core functionality
- **Low latency**: HomeKit HAP provides millisecond response times
- **Offline-capable**: Works without internet connection

### ✅ E-Ink Display Design
- **Optimized layout**: Efficient use of 250x122 pixel space
- **Three-page navigation**: Status, Actions, Guide
- **Cost display**: Prominently shows monthly/weekly costs
- **Connection status**: Clear WiFi signal and bridge status indicators
- **Partial refresh support**: Reduces ghosting and improves responsiveness

### ✅ Data Integration
- **Multiple data sources**: Bridge status, weather API, cost calculations
- **Fallback logic**: Graceful degradation when APIs fail
- **Cost calculation**: Smart fallback from forecaster → bridge API → local estimate

### ✅ Error Handling
- **Connection errors**: Proper handling of bridge unavailability
- **Device offline**: Automatic reconnection attempts
- **API failures**: Fallback to cached/estimated values

---

## Issues & Recommendations

### 🔴 Critical Issues

#### 1. **E-Ink Display Cost Data Not Persisting**
**Problem:** The e-ink display shows cost data, but it's not being cached/persisted properly.

**Location:** 
- `src/pages/EInkBridgeDisplay.jsx` - `fetchWeeklyCost()` function
- `pi-hmi/joule_hmi.py` - `fetch_weekly_cost()` method

**Issue:** 
- Web preview relies on `localStorage.getItem("last_forecast_summary")` which may not be available
- Pi HMI tries to fetch from bridge `/api/settings` endpoint which may not exist
- No caching on the Pi side - recalculates every 15 minutes

**Recommendation:**
```python
# Add caching to pi-hmi/joule_hmi.py
def fetch_weekly_cost(self):
    # Check cache first (15-minute TTL)
    cache_file = '/tmp/joule_cost_cache.json'
    try:
        if os.path.exists(cache_file):
            with open(cache_file, 'r') as f:
                cached = json.load(f)
                age = time.time() - cached.get('timestamp', 0)
                if age < 900:  # 15 minutes
                    self.weekly_cost = cached.get('weekly_cost')
                    self.monthly_cost = cached.get('monthly_cost')
                    return
    except:
        pass
    
    # ... existing fetch logic ...
    
    # Cache the result
    try:
        with open(cache_file, 'w') as f:
            json.dump({
                'weekly_cost': self.weekly_cost,
                'monthly_cost': self.monthly_cost,
                'timestamp': time.time()
            }, f)
    except:
        pass
```

#### 2. **Bridge API Endpoint Mismatch** 🔴 CRITICAL
**Problem:** The e-ink display expects specific data format and endpoints that don't match the bridge implementation.

**Issues Found:**

1. **`/api/settings` Response Format Mismatch**
   - **Expected by e-ink:** `{last_forecast_summary: {...}, userSettings: {...}, location: {...}}`
   - **Actual response:** `{success: true, settings: {...}}`
   - **Location:** `pi-hmi/joule_hmi.py:177`, `prostat-bridge/server.py:3701-3708`
   - **Fix:** Update e-ink code to read from `response.settings` OR update bridge to return expected format

2. **`/api/cost-estimate` Endpoint Missing**
   - **Expected by e-ink:** `POST /api/cost-estimate` with `{outdoor_temp, target_temp, duration_hours}`
   - **Status:** ❌ **DOES NOT EXIST** in `server.py`
   - **Location:** `pi-hmi/joule_hmi.py:205`
   - **Impact:** E-ink falls back to simplified calculation, may show inaccurate costs

3. **`/api/setpoint` Endpoint Missing**
   - **Expected by e-ink:** `POST /api/setpoint` with `{delta: +1 | -1}`
   - **Status:** ❌ **DOES NOT EXIST** in `server.py`
   - **Location:** `pi-hmi/joule_hmi.py:626`
   - **Impact:** Temperature adjustment buttons on e-ink won't work
   - **Note:** Bridge has `/api/set-temperature` but expects `{device_id, temperature}`, not `{delta}`

**Recommendation:**
```python
# Add to prostat-bridge/server.py

async def handle_get_settings(request):
    """GET /api/settings - Return settings in format expected by e-ink"""
    try:
        settings = load_settings()
        
        # Also try to load forecast data if available
        forecast_data = None
        try:
            # Try to read from shared location or cache
            forecast_file = os.path.join(get_data_directory(), 'last_forecast_summary.json')
            if os.path.exists(forecast_file):
                with open(forecast_file, 'r') as f:
                    forecast_data = json.load(f)
        except:
            pass
        
        # Return in format expected by e-ink display
        return web.json_response({
            'last_forecast_summary': forecast_data,
            'userSettings': settings,
            'location': settings.get('location')  # If stored in settings
        })
    except Exception as e:
        logger.error(f"Error getting settings: {e}")
        return web.json_response({'error': str(e)}, status=500)

async def handle_cost_estimate(request):
    """POST /api/cost-estimate - Calculate weekly/monthly cost"""
    try:
        data = await request.json()
        outdoor_temp = data.get('outdoor_temp')
        target_temp = data.get('target_temp')
        duration_hours = data.get('duration_hours', 168)  # Default 1 week
        
        # Get device status for accurate calculation
        device_id = await get_primary_device_id()
        if device_id:
            status = await get_thermostat_status(device_id)
            # Use status data for more accurate calculation
            # ... implement cost calculation logic ...
        
        # Simplified calculation (should be improved)
        temp_diff = abs(target_temp - outdoor_temp)
        if outdoor_temp < target_temp - 2:  # Heating
            weekly_cost = temp_diff * 7 * 0.50
        elif outdoor_temp > target_temp + 2:  # Cooling
            weekly_cost = temp_diff * 7 * 0.60
        else:
            weekly_cost = 2.00
        
        return web.json_response({
            'success': True,
            'weeklyCost': weekly_cost,
            'monthlyCost': weekly_cost * 4.33
        })
    except Exception as e:
        logger.error(f"Error calculating cost: {e}")
        return web.json_response({'error': str(e)}, status=500)

async def handle_setpoint_delta(request):
    """POST /api/setpoint - Adjust temperature by delta"""
    try:
        data = await request.json()
        delta = data.get('delta', 0)
        
        device_id = await get_primary_device_id()
        if not device_id:
            return web.json_response({'error': 'No device paired'}, status=400)
        
        # Get current target
        status = await get_thermostat_status(device_id)
        current_target = status.get('target_temperature', 70)
        
        # Convert to Fahrenheit if needed (HomeKit returns Celsius)
        if current_target < 50:  # Likely Celsius
            current_target = (current_target * 9/5) + 32
        
        new_target = current_target + delta
        
        # Set new temperature
        await set_temperature(device_id, new_target)
        
        return web.json_response({'success': True, 'new_target': new_target})
    except Exception as e:
        logger.error(f"Error adjusting setpoint: {e}")
        return web.json_response({'error': str(e)}, status=500)

# Register routes
app.router.add_post('/api/cost-estimate', handle_cost_estimate)
app.router.add_post('/api/setpoint', handle_setpoint_delta)
```

#### 3. **Status Page Layout Issue**
**Problem:** The status page in `EInkBridgeDisplay.jsx` shows monthly cost prominently, but the actual Pi HMI (`joule_hmi.py`) shows a different layout.

**Location:**
- `src/pages/EInkBridgeDisplay.jsx:362-401` - Status page render
- `pi-hmi/joule_hmi.py:439-483` - Status page render

**Issue:** Layouts don't match - web preview shows large monthly cost, Pi HMI shows compact list format.

**Recommendation:** Align the layouts or document that they're intentionally different (web preview vs. actual hardware).

---

### 🟡 Medium Priority Issues

#### 4. **Cost Calculation Inconsistency**
**Problem:** Multiple fallback methods for cost calculation with different formulas.

**Locations:**
- `src/pages/EInkBridgeDisplay.jsx:128-296` - Complex fallback chain
- `pi-hmi/joule_hmi.py:173-260` - Similar but different fallback logic

**Issues:**
- Web preview uses `getWeeklyCost()` from `bridgeApi.js` which calls `/cost-weekly` endpoint
- Pi HMI uses different fallback formulas
- Results may differ between web preview and actual display

**Recommendation:**
- Standardize on one cost calculation method
- Use bridge API as single source of truth
- Document the fallback chain clearly

#### 5. **Touch Input Calibration**
**Problem:** Touch coordinates need calibration, but the calibration process could be improved.

**Location:**
- `pi-hmi/touch_calibrate.py`
- `pi-hmi/joule_hmi.py:596-621` - Touch processing

**Recommendation:**
- Add visual feedback during calibration
- Store calibration in persistent location (not just `/tmp`)
- Add calibration verification step

#### 6. **Partial Refresh Reliability**
**Problem:** Partial refresh may cause ghosting if not used correctly.

**Location:**
- `pi-hmi/joule_hmi.py:570-594` - Display update logic
- `pi-hmi/app.py:309-325` - Display update

**Recommendation:**
- Add ghosting detection
- Force full refresh after N partial refreshes (already implemented, but could be configurable)
- Add visual indicator when ghosting is detected

#### 7. **WiFi Signal Strength Display**
**Problem:** WiFi signal is fetched but may not be accurate.

**Location:**
- `pi-hmi/joule_hmi.py:136-171` - WiFi signal fetch
- `src/pages/EInkBridgeDisplay.jsx:208-222` - WiFi signal fetch

**Recommendation:**
- Cache WiFi signal (doesn't change frequently)
- Add signal strength smoothing (average over time)
- Handle cases where `iwconfig` output format varies

---

### 🟢 Low Priority / Enhancements

#### 8. **Display Refresh Optimization**
**Current:** 15-minute auto-refresh
**Enhancement:** 
- Smart refresh: Only refresh when data actually changes
- Event-driven updates: Refresh immediately when bridge state changes
- Configurable refresh interval per page

#### 9. **Error Display**
**Current:** Shows "ERR" in header when bridge is offline
**Enhancement:**
- Show last known good data with timestamp
- Display error details on Guide page
- Add retry button on Actions page

#### 10. **Cost Display Formatting**
**Current:** Shows `$XX.XX/wk` and `$XX/mo`
**Enhancement:**
- Show cost per day for better granularity
- Add trend indicator (↑/↓) if cost changed
- Show savings opportunity if available

#### 11. **Weather Data Caching**
**Current:** Fetches weather every 15 minutes
**Enhancement:**
- Cache weather data (changes slowly)
- Show weather forecast (not just current)
- Add weather icons (simple ASCII art for e-ink)

#### 12. **Bridge Health Monitoring**
**Current:** Basic connection status
**Enhancement:**
- Show bridge uptime
- Display last successful update time
- Add bridge diagnostics page

---

## Code Quality Issues

### 1. **Duplicate Cost Calculation Logic**
The cost calculation logic is duplicated between:
- `src/pages/EInkBridgeDisplay.jsx`
- `pi-hmi/joule_hmi.py`

**Recommendation:** Extract to shared utility or ensure bridge API handles it.

### 2. **Inconsistent Error Handling**
Some functions use try/except with pass, others log errors.

**Recommendation:** Standardize error handling pattern:
```python
try:
    # operation
except SpecificError as e:
    logger.warning(f"Operation failed: {e}")
    # fallback
except Exception as e:
    logger.error(f"Unexpected error: {e}", exc_info=True)
    # safe fallback
```

### 3. **Magic Numbers**
Several magic numbers in the code:
- `4.33` (weeks per month multiplier)
- `0.50`, `0.60` (cost per degree-day estimates)
- `900` (15 minutes in seconds)

**Recommendation:** Extract to constants:
```python
WEEKS_PER_MONTH = 4.33
HEATING_COST_PER_DD = 0.50  # $/degree-day
COOLING_COST_PER_DD = 0.60  # $/degree-day
REFRESH_INTERVAL_SECONDS = 900
```

### 4. **Font Loading**
Font paths are hardcoded with multiple fallbacks.

**Recommendation:** Use environment variable or config file:
```python
FONT_PATH = os.getenv('HMI_FONT_PATH', '/usr/share/fonts/...')
```

---

## Performance Considerations

### ✅ Good
- Partial refresh reduces display update time
- 15-minute polling is reasonable for e-ink (low power)
- Touch input is non-blocking

### ⚠️ Could Improve
- **Cost calculation**: Currently recalculates every refresh even if nothing changed
- **Weather API calls**: Could be cached longer (weather changes slowly)
- **Bridge status polling**: 5-second interval in React context may be too frequent for e-ink use case

---

## Security Considerations

### ✅ Good
- Local network only (no internet required)
- HomeKit pairing uses secure protocol
- No sensitive data in logs (by default)

### ⚠️ Recommendations
- **Bridge URL**: Should validate URL format to prevent SSRF
- **Touch input**: Should sanitize coordinates to prevent out-of-bounds access
- **API endpoints**: Should validate input parameters

---

## Testing Recommendations

### Missing Tests
1. **Cost calculation accuracy**: Test fallback chain
2. **Touch calibration**: Test coordinate mapping
3. **Partial refresh**: Test ghosting prevention
4. **Bridge connectivity**: Test reconnection logic
5. **Display layout**: Test on actual hardware

### Test Scenarios
1. Bridge goes offline → display shows cached data
2. Weather API fails → display uses last known weather
3. Cost calculation fails → display shows fallback estimate
4. Touch calibration → verify coordinates map correctly
5. Partial refresh → verify no ghosting after N refreshes

---

## Documentation Gaps

### Missing Documentation
1. **API Endpoints**: Document all bridge API endpoints
2. **Cost Calculation**: Document the fallback chain and formulas
3. **Touch Calibration**: Step-by-step guide with screenshots
4. **Troubleshooting**: Common issues and solutions
5. **Hardware Setup**: Complete hardware wiring diagram

### Existing Documentation
- ✅ `prostat-bridge/README.md` - Good pairing guide
- ✅ `pi-hmi/README.md` - Good setup instructions
- ⚠️ Missing: API reference, troubleshooting guide

---

## Specific Code Issues Found

### 1. **EInkBridgeDisplay.jsx Line 382**
```jsx
{monthlyCost !== null ? `$${monthlyCost.toFixed(0)}` : "--"}
```
**Issue:** Uses `toFixed(0)` which rounds to nearest dollar. May want `toFixed(2)` for precision, or document that rounding is intentional.

### 2. **joule_hmi.py Line 193**
```python
self.monthly_cost = f"${cost * 4.33:.2f}/mo"
```
**Issue:** Uses `4.33` multiplier. Should be constant. Also, this assumes weekly cost is accurate for monthly projection.

### 3. **joule_hmi.py Line 239-246**
```python
if outdoor_temp < target_temp - 2:  # Heating
    weekly_dd = temp_diff * 7
    estimate = weekly_dd * 0.50
elif outdoor_temp > target_temp + 2:  # Cooling
    weekly_dd = temp_diff * 7
    estimate = weekly_dd * 0.60
```
**Issue:** Very simplified calculation. Doesn't account for:
- Building efficiency
- System type (heat pump vs. gas)
- Time of day variations
- Humidity effects

**Recommendation:** Use bridge API for accurate calculation, fallback only when API unavailable.

### 4. **EInkBridgeDisplay.jsx Line 168**
```jsx
const hasTemperatureChanged = Math.abs(currentTarget - (baselineTemperature || 70)) >= 1;
```
**Issue:** 1°F threshold may be too sensitive. User might adjust by 0.5°F and trigger recalculation.

---

## Recommendations Summary

### Immediate Actions
1. ✅ **Add cost caching** to Pi HMI
2. ✅ **Verify/Add bridge API endpoints** (`/api/settings`, `/api/cost-estimate`)
3. ✅ **Standardize cost calculation** between web preview and Pi HMI
4. ✅ **Add error logging** for debugging

### Short-term Improvements
1. **Improve touch calibration** with visual feedback
2. **Add display refresh optimization** (only refresh when data changes)
3. **Standardize error handling** patterns
4. **Extract magic numbers** to constants

### Long-term Enhancements
1. **Event-driven updates** instead of polling
2. **Weather forecast display** (not just current)
3. **Cost trend indicators** (↑/↓)
4. **Bridge diagnostics page**

---

## Conclusion

The Joule Bridge and e-ink HMI are well-designed systems with good architecture. The main issues are:

1. **Data persistence** - Cost data not properly cached
2. **API endpoint mismatches** - Some endpoints may not exist
3. **Layout inconsistencies** - Web preview vs. actual hardware differ
4. **Cost calculation duplication** - Logic duplicated in multiple places

**Overall Grade: B+**

The system works well but needs refinement in data persistence and API consistency. The architecture is solid and extensible.
