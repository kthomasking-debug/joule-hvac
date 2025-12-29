# How to Pair the Bridge with Your Ecobee

> **⚠️ This guide has been consolidated into `USER_MANUAL.md`**  
> **Please see `docs/USER_MANUAL.md` for the complete user manual. This guide is kept for reference only.**

This guide walks you through pairing your Joule Bridge with your Ecobee thermostat using HomeKit.

## Prerequisites

- ✅ Bridge server is running (check Settings → Joule Bridge Settings)
- ✅ Bridge shows "Connected" status
- ✅ Ecobee thermostat is on the same WiFi network as your bridge
- ✅ Ecobee supports HomeKit (most models do)

## Step-by-Step Pairing Process

### Step 1: Enable HomeKit Pairing Mode on Ecobee

1. **On your Ecobee thermostat**, go to:
   - **Menu** → **Settings** → **Installation Settings** → **HomeKit**

2. **Make sure HomeKit is enabled** and pairing mode is **active**

3. **The thermostat will display:**
   - A QR code (for Apple Home app)
   - An **8-digit pairing code** (format: `XXX-XX-XXX`, e.g., `640-54-831`)
   - **⚠️ Important:** Write down this code - you'll need it for pairing!

**⚠️ Critical: If Already Paired to Apple HomeKit**

If your Ecobee is already paired to Apple HomeKit, you **must unpair it first**:

1. Open the **Home** app on your iPhone/iPad
2. Find your Ecobee thermostat
3. Long-press on it → **Settings** → **Remove Accessory**
4. Wait 30 seconds for the device to reset
5. Then enable pairing mode on the Ecobee again
6. **Note:** The pairing code may change - use the NEW code shown on screen

**Why?** HomeKit devices can only be paired to **ONE controller at a time**. If it's paired to Apple HomeKit, it won't pair to the bridge.

### Step 2: Configure Bridge URL (Required)

**⚠️ Important:** You must configure the bridge URL. The app will never use localhost as a fallback.

1. **Find your bridge IP address:**
   - Check your router's connected devices list
   - Or run `hostname -I` on the bridge computer
   - Example: `192.168.0.106`

2. **Open your web app** (Netlify site)
3. Go to **Settings** → **Joule Bridge Settings**
4. **Enter your bridge URL:**
   - Format: `http://YOUR_BRIDGE_IP:8080`
   - Example: `http://192.168.0.106:8080` (replace with your actual bridge IP)
5. Click **Save**
6. Wait for "Bridge Status: Connected" (green checkmark)

**Note:** If you see an error about bridge URL not being configured, you must set it explicitly. The app requires a remote bridge URL and will not default to localhost.

### Step 3: Discover Your Ecobee

1. In **Settings** → **Joule Bridge Settings**
2. Click the **"Discover"** button
3. Wait 10-30 seconds for discovery to complete
4. Your Ecobee should appear in the list with:
   - Device name (e.g., "My ecobee")
   - Device ID (e.g., `cc:73:51:2d:3b:0b`)

**If no devices found:**
- ✅ Make sure Ecobee is in pairing mode (Step 1)
- ✅ Verify Ecobee and bridge are on the same WiFi network
- ✅ Check that HomeKit is enabled on Ecobee
- ✅ Try clicking "Discover" again

### Step 4: Pair with Your Ecobee

1. **Find your Ecobee** in the discovered devices list
2. Click the **"Pair"** button next to your Ecobee
3. **Enter the 8-digit pairing code** from your Ecobee screen
   - Format: `XXX-XX-XXX` (with dashes)
   - Example: `640-54-831` or `810-85-888`
   - **Flexible input:** You can type with or without dashes:
     - `810-85-888` (recommended)
     - `81085888` (auto-formatted to `810-85-888`)
   - The input field will auto-format as you type
4. Click **"Pair"** button
5. **Wait up to 45 seconds** - pairing can take time
   - Keep the Ecobee screen showing the pairing code during this time
   - Don't close the pairing screen on Ecobee

**Success!** You should see:
- ✅ "Successfully paired!" message
- ✅ Device appears in "Paired Devices" section
- ✅ Green checkmark next to device

**If pairing fails:**
- ✅ Verify pairing code is correct (8 digits, format `XXX-XX-XXX`)
- ✅ You can enter code with or without dashes - both work
- ✅ Make sure Ecobee is still in pairing mode (code visible on screen)
- ✅ Check that Ecobee isn't paired to Apple HomeKit
- ✅ Check the detailed error message - it will provide specific troubleshooting steps
- ✅ Try unpairing and pairing again

### Step 5: Verify Pairing Works

1. **Check "Paired Devices" section** - your Ecobee should be listed
2. **Test connection:**
   - The app should automatically start reading temperature
   - Go to the main dashboard and check if temperature is showing
   - Try changing the target temperature to verify write access

**If device shows as "paired but not reachable":**
- This can happen if the bridge restarted and pairing data didn't load correctly
- See troubleshooting section below

## Using the Web Interface

The easiest way to pair is through the web interface:

1. **Settings** → **Joule Bridge Settings**
2. **Discover** → Find your Ecobee
3. **Click "Pair"** → Enter pairing code → **Pair**

The interface will:
- Auto-format the pairing code as you type
- Show pairing progress
- Display success/error messages
- List all paired devices

## Using the API (Advanced)

If you prefer command line or want to automate:

### Discover Devices

```bash
curl http://localhost:8080/api/discover
```

**Response:**
```json
{
  "devices": [
    {
      "device_id": "cc:73:51:2d:3b:0b",
      "name": "My ecobee",
      "model": "Unknown",
      "category": "Unknown"
    }
  ]
}
```

### Pair Device

```bash
curl -X POST http://localhost:8080/api/pair \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "cc:73:51:2d:3b:0b",
    "pairing_code": "640-54-831"
  }'
```

**Note:** The `pairing_code` can be entered with or without dashes:
- `"640-54-831"` (recommended)
- `"64054831"` (auto-formatted to `640-54-831`)

**Success Response:**
```json
{
  "success": true,
  "device_id": "cc:73:51:2d:3b:0b"
}
```

### Verify Pairing

```bash
curl http://localhost:8080/api/paired
```

### Test Connection

```bash
curl "http://localhost:8080/api/status?device_id=cc:73:51:2d:3b:0b"
```

**Expected Response:**
```json
{
  "device_id": "cc:73:51:2d:3b:0b",
  "temperature": 67.46,
  "target_temperature": 68.0,
  "target_mode": 1,
  "current_mode": 0,
  "mode": "heat"
}
```

## Troubleshooting

### "Device Not Found" During Discovery

**Symptoms:** Click "Discover" but no devices appear

**Solutions:**
- ✅ Ensure Ecobee and Bridge are on the same WiFi network
- ✅ Check that HomeKit is enabled on Ecobee (Menu → Settings → Installation Settings → HomeKit)
- ✅ Verify Ecobee is powered on and connected to WiFi
- ✅ Try restarting discovery: Click "Discover" again
- ✅ Check bridge logs: `sudo journalctl -u prostat-bridge -f` (if running as service)

### Pairing Fails

**Symptoms:** Pairing request returns error or times out

**Common Causes & Solutions:**

1. **Device Not in Pairing Mode**
   - On Ecobee: Menu → Settings → Installation Settings → HomeKit
   - Make sure pairing mode is **ACTIVE** (you should see a pairing code on screen)
   - The pairing code format is `XXX-XX-XXX` (e.g., `640-54-831`)

2. **Device Already Paired to Apple HomeKit**
   - HomeKit devices can only be paired to ONE controller at a time
   - Unpair from Apple HomeKit first:
     1. Open **Home** app on iPhone/iPad
     2. Find your Ecobee → Long-press → **Settings** → **Remove Accessory**
     3. Wait 30 seconds
     4. Enable pairing mode on Ecobee again
     5. Use the **NEW** pairing code shown on screen

3. **Incorrect Pairing Code Format**
   - The pairing code must be 8 digits in format: `XXX-XX-XXX` (with dashes)
   - Example: `640-54-831` or `810-85-888`
   - **Flexible input:** You can enter with or without dashes:
     - `810-85-888` (recommended)
     - `81085888` (auto-formatted to `810-85-888`)
   - Enter the exact code shown on your Ecobee screen
   - The bridge automatically validates and formats the code

4. **Network Connectivity Issues**
   - Ensure Ecobee and Bridge are on the same Wi-Fi network
   - Check that both devices have stable network connections
   - Try restarting both the Ecobee and the Bridge

5. **Pairing Initialization Timeout**
   - The pairing process has a 45-second timeout
   - If it times out, check:
     - Is the Ecobee actually in pairing mode? (Check the screen)
     - Are both devices on the same network?
     - Is the pairing code correct?
   - Try restarting the Ecobee and enabling pairing mode again

**Error Messages Explained:**

The bridge now provides detailed, actionable error messages with step-by-step troubleshooting:

- `"Pairing initialization timed out"` - Device didn't respond within 10 seconds. This means:
  - Device is not in HomeKit pairing mode (check Ecobee screen - code must be visible)
  - Device is already paired to Apple Home (must unpair first - see #2 above)
  - Network connectivity issues between bridge and device
  - Device is powered off or disconnected from WiFi
  - **Solution:** Verify pairing mode is active on Ecobee screen, unpair from Apple Home if needed, check network connectivity

- `"Pairing timed out"` - The pairing process took longer than 30 seconds. Usually means:
  - Incorrect pairing code (double-check all 8 digits match Ecobee screen)
  - Device not fully in pairing mode
  - Network latency issues
  - **Solution:** Verify code matches Ecobee screen exactly, wait 30 seconds and try again with same code

- `"Device is already paired to another controller"` - Unpair from Apple HomeKit first (see #2 above).

- `"Device not found. Please discover devices first"` - Run discovery first, then use the device_id from the results.

**Enhanced Error Display:**
- The web interface now shows detailed error messages with:
  - Clear explanation of what went wrong
  - Possible causes list
  - Step-by-step solutions
  - Visual indicators (✓/✗) for success/failure
- Check bridge logs for comprehensive diagnostics:
  ```bash
  journalctl -u prostat-bridge -f | grep -i "pairing\|error"
  ```

### Device Shows "Paired but Not Reachable"

**Symptoms:** Device appears in "Paired Devices" but status returns `null` or connection fails

**Solutions:**
- The bridge automatically refreshes device IP addresses when connection fails
- Wait a few seconds for automatic reconnection
- If it persists:
  1. Check that the Ecobee is powered on and connected to Wi-Fi
  2. Verify the Ecobee's IP address hasn't changed (check your router)
  3. Try unpairing and re-pairing the device
  4. Check bridge logs: `sudo journalctl -u prostat-bridge -f | grep -i "connect\|error"`

**Why this happens:**
- Device IP address changed (DHCP renewal)
- Bridge restarted and pairing data didn't load correctly
- Network connectivity issues
- Pairing file corruption

**Fix:** Unpair and re-pair the device (see Step 4 above)

### Pairing Not Persisting After Restart

**Symptoms:** Device pairs successfully but disappears after bridge restart

**Solution:**
- Pairings are automatically saved to `prostat-bridge/data/pairings.json`
- If you experience this issue:
  1. Check that `prostat-bridge/data/pairings.json` exists and contains your device
  2. Verify file permissions: `ls -la prostat-bridge/data/pairings.json`
  3. Check bridge logs for save errors: `grep -i "save\|pairing" /tmp/bridge.log` (or `journalctl -u prostat-bridge`)
  4. Try pairing again - the fix ensures pairings are saved correctly

### Multiple Devices Listed (Only One Ecobee)

**Symptoms:** `/api/paired` shows multiple device IDs but you only have one Ecobee

**Solution:**
- This happens when old/stale pairings remain in the system
- Unpair the old device IDs that are unreachable
- Keep only the device that's currently working
- The primary device is automatically set to the first one in the list

## Pairing Persistence

✅ **Good news:** Pairings are automatically saved to `prostat-bridge/data/pairings.json` and will persist across bridge restarts. The bridge automatically loads existing pairings on startup.

## What You Can Control After Pairing

Once paired, the bridge can:

✅ **Read:**
- Current temperature
- Target temperature
- Current mode (heat/cool/off/auto)
- Target mode

✅ **Control:**
- Set target temperature
- Change mode (heat/cool/off/auto)

❌ **Cannot access via HomeKit:**
- Schedules
- Comfort profiles
- Occupancy data
- Remote sensors
- Vacation mode
- Fan control

For full Ecobee features, use the Ecobee API (requires Ecobee account and API key).

## Enhanced Diagnostics & Logging

The bridge now includes comprehensive logging and error diagnostics:

### Pairing Code Format Flexibility

- **Accepts both formats:** `81085888` or `810-85-888`
- **Auto-formatting:** Automatically converts to `XXX-XX-XXX` format
- **Validation:** Ensures exactly 8 digits before attempting pairing
- **Clear errors:** Provides specific error messages if format is incorrect

### Detailed Error Messages

When pairing fails, you'll see:
- **Clear explanation** of what went wrong
- **Possible causes** list
- **Step-by-step solutions** specific to the error
- **Visual indicators** (✓/✗) in the web interface

### Comprehensive Logging

The bridge logs detailed information during pairing:
- Pairing code validation and formatting
- Device reachability checks
- Timing information for each step
- Full error details with tracebacks
- HomeKit protocol errors (if applicable)

**View pairing logs:**
```bash
# If running as systemd service
journalctl -u prostat-bridge -f | grep -i "pairing"

# View recent pairing attempts
journalctl -u prostat-bridge -n 100 | grep -E "pairing|Pairing|=== Starting"
```

### Frontend Debug Logging

The web app includes debug logging (visible in browser console):
- `[JouleBridge]` prefix for all bridge-related logs
- Device ID resolution
- Status fetch attempts
- Connection state changes
- Error details

**To view:** Open browser Developer Tools (F12) → Console tab

## Next Steps

After successful pairing:

1. ✅ Verify temperature reading works
2. ✅ Test setting temperature
3. ✅ Test changing mode
4. ✅ Set up as primary device (if you have multiple)
5. ✅ Configure your app to use the bridge

Your bridge is now connected to your Ecobee! 🎉

