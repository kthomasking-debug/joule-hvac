# E-Ink Display Sync Implementation - Complete Guide

## What We Just Built

You now have a complete data sync pipeline from your React forecaster to your Pi Zero 2W e-ink display.

## The Three-Part System

### Part 1: React Forecaster (Your Main PC)
**Status:** ✅ Complete with "Share with Pi" button

**What changed:**
- Added `ShareWithPiModal` component
- Added "Share with Pi" button below Quick Answer card
- Button appears only when forecast is calculated
- Modal prompts for Pi IP address (saves for next time)
- Sends both cost forecast and user settings to Pi bridge

**File:** `src/pages/SevenDayCostForecaster.jsx`
- Line ~12: Imported `ShareWithPiModal`
- Line ~41: Added `Wifi` icon from lucide-react
- Line ~713: Added `showSharePiModal` state
- Line ~1959-1963: Added "Share with Pi" button
- Line ~2331-2340: Render modal with success toast

### Part 2: Pi Bridge Server (Port 3002)
**Status:** ✅ Added endpoints

**New endpoints:**
- `GET /api/settings` - Returns saved settings from file
- `POST /api/settings` - Accepts settings from React app

**File:** `pi-zero-bridge/server.js`
- Lines ~130-168: New `/api/settings` endpoints
- Stores data in: `pi-zero-bridge/joule-settings.json`
- Auto-creates JSON file on first share

**Example response:**
```json
{
  "last_forecast_summary": {
    "location": "Atlanta, Georgia",
    "totalHPCost": 33.32,
    "totalHPCostWithAux": 43.64,
    "timestamp": 1705779600000
  },
  "userSettings": {
    "utilityCost": 0.1234,
    "capacity": 36,
    ...
  }
}
```

### Part 3: Python HMI (Pi Zero 2W)
**Status:** ✅ Updated to read from bridge

**Changes:**
- `fetch_weekly_cost()` now reads from `http://localhost:3002/api/settings`
- Prefers `totalHPCostWithAux` (with aux heat)
- Falls back to `totalHPCost` (base cost)
- Then tries `/api/weekly-cost` endpoint
- Finally uses degree-day estimation as last resort

**File:** `pi-hmi/joule_hmi.py` (lines 173-208)

## How to Use It

### Step 1: Find Your Pi's IP
```bash
# On the Pi:
hostname -I
# Output: 192.168.1.50

# Or from your main PC:
ping raspberrypi.local
arp -a | grep -i raspberry
```

### Step 2: Run Forecaster
1. Open http://localhost:5173/analysis/forecast
2. Enter location and settings
3. Wait for forecast to calculate
4. See "Share with Pi" button appear below Quick Answer

### Step 3: Share Settings
1. Click "Share with Pi" button
2. Enter your Pi's IP (e.g., `192.168.1.50`)
3. Click "Share" button
4. Wait for success confirmation

### Step 4: Check E-ink Display
- Python HMI will fetch new cost within 15 minutes
- E-ink display updates with "$43.64/wk" (matching Quick Answer)
- Refresh interval: 15 minutes (configurable)

## Cost Display Consistency

**All three systems now show the same cost:**

| System | Cost Field | Value |
|--------|-----------|-------|
| Quick Answer (React) | `totalCostWithAux` | $43.64/wk |
| E-Ink Display (React) | `totalHPCostWithAux` | $43.64/wk |
| Python HMI (Pi) | `totalHPCostWithAux` | $43.64/wk |
| localStorage | Saves both | ✓ |
| Bridge API | Returns both | ✓ |

## Troubleshooting

### Modal won't close after sharing
- Check browser console for errors
- Verify Pi IP is correct and reachable
- Try: `curl http://<pi-ip>:3002/health`

### "Share with Pi" button doesn't appear
- Make sure Forecaster has calculated a forecast
- Ensure `weeklyMetrics` is not null
- Check browser console for JavaScript errors

### Pi still shows old cost
- Force manual sync by clicking "Share with Pi" again
- Check Pi bridge is running: `curl http://192.168.1.50:3002/health`
- Verify file exists: `cat /root/pi-zero-bridge/joule-settings.json`
- Restart Python HMI: `sudo systemctl restart joule-hmi`

### Connection refused error in modal
- Verify Pi IP is correct
- Check Pi is on same WiFi network
- Ensure firewall allows port 3002
- Try SSH into Pi to verify connectivity

## Architecture Benefits

✅ **No external database needed** - Settings stored locally on Pi
✅ **Offline compatible** - Works without internet after first share
✅ **Simple to understand** - Direct HTTP endpoints
✅ **Scalable** - Can add multiple Pi devices (each with own settings)
✅ **Secure-enough** - Local network only

## Files Modified

```
✅ src/pages/SevenDayCostForecaster.jsx
   - Added modal state and import
   - Added "Share with Pi" button UI
   - Connected to success toast

✅ src/components/ShareWithPiModal.jsx (NEW)
   - User-friendly modal for entering Pi IP
   - Health check before sending
   - Success/error feedback
   - Saves Pi IP to localStorage

✅ src/lib/bridgeApi.js
   - Added shareSettingsWithPi() function
   - POSTs to /api/settings endpoint

✅ pi-zero-bridge/server.js
   - Added GET /api/settings endpoint
   - Added POST /api/settings endpoint
   - Stores to joule-settings.json

✅ pi-hmi/joule_hmi.py
   - Updated fetch_weekly_cost() method
   - Reads from bridge /api/settings first
   - Extracts totalHPCostWithAux with fallback

✅ PI_DATA_SYNC_FLOW.md (NEW)
   - Complete documentation of data flow
   - Diagrams and examples
   - Setup instructions
```

## Next Steps (Optional)

### Add Auto-Sync
Make React app periodically send updates to Pi (every hour):
```javascript
useEffect(() => {
  const timer = setInterval(() => {
    if (piIp && weeklyMetrics) {
      shareSettingsWithPi(`http://${piIp}:3002`);
    }
  }, 3600000); // Every hour
  return () => clearInterval(timer);
}, [piIp, weeklyMetrics]);
```

### Add Multiple Devices
Store multiple Pi IPs and sync to all:
```javascript
const piDevices = JSON.parse(localStorage.getItem("piDevices")) || [];
Promise.all(piDevices.map(ip => shareSettingsWithPi(`http://${ip}:3002`)));
```

### Add Authentication
Secure the bridge endpoint with a token:
```javascript
fetch(`${piUrl}/api/settings`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.VITE_BRIDGE_TOKEN}`
  },
  body: JSON.stringify(payload),
});
```

## Testing Checklist

- [ ] Forecaster calculates cost correctly
- [ ] "Share with Pi" button appears below Quick Answer
- [ ] Modal opens when button clicked
- [ ] Can enter Pi IP and click Share
- [ ] Get success message after 2-3 seconds
- [ ] File exists on Pi: `cat /root/pi-zero-bridge/joule-settings.json`
- [ ] Python HMI fetches data successfully
- [ ] E-ink display shows cost matching Quick Answer
- [ ] Pi IP is remembered for next share
- [ ] Previous Pi IP pre-fills modal

## Support

**Issue: "Connection refused"**
- Make sure bridge server is running on Pi
- Check: `ps aux | grep node`
- Restart if needed: `pkill -f "node.*server.js"`

**Issue: "Settings not updating"**
- Manually restart Python HMI: `sudo systemctl restart joule-hmi`
- Check logs: `sudo journalctl -u joule-hmi -n 20`

**Issue: "No forecaster data saved"**
- Run forecaster first before sharing
- Try changing location to force recalculation
- Check localStorage: Open DevTools → Application → localStorage

---

**Status:** ✅ System is ready to use!

Start by finding your Pi's IP address and clicking "Share with Pi" in the Forecaster.
