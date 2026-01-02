# ProStat Bridge - HomeKit HAP Controller

Local-only thermostat control using HomeKit Accessory Protocol (HAP) over IP.

## Why HomeKit HAP?

- **Latency**: Milliseconds instead of 2-5 seconds (critical for short cycle protection)
- **Reliability**: Works offline, no cloud dependencies
- **Privacy**: All communication stays on your local network
- **Granularity**: High refresh rates for precise control

## Hardware Requirements

- Raspberry Pi Zero 2 W (recommended) or any Raspberry Pi
- **⚠️ CRITICAL: 2.4 GHz WiFi connection required** (see WiFi Requirements below)
- Ethernet or WiFi connection
- Ecobee thermostat with HomeKit support

## ⚠️ WiFi Requirements - CRITICAL

**The bridge MUST be connected to a 2.4 GHz WiFi network for proper operation.**

### Why 2.4 GHz is Required

- **Ecobee HomeKit**: Ecobee thermostats only support HomeKit pairing over 2.4 GHz WiFi
- **Blueair Devices**: Blueair air purifiers require 2.4 GHz WiFi for local network communication
- **Device Discovery**: HomeKit device discovery (mDNS) works reliably only on 2.4 GHz

### How to Ensure 2.4 GHz Connection

**If your router has separate SSIDs:**
- Connect the bridge to the **2.4 GHz SSID** (e.g., `YourNetwork-2.4GHz`)
- Do NOT connect to the 5 GHz SSID

**If your router uses a single SSID for both bands:**
- Most routers will auto-select 2.4 GHz for IoT devices
- Verify connection: `iwconfig | grep Frequency` should show 2.4 GHz (e.g., `Frequency:2.437 GHz`)
- If connected to 5 GHz, manually force 2.4 GHz in router settings or split the bands

**Verification:**
```bash
# Check WiFi frequency/band
iwconfig 2>/dev/null | grep -i frequency
# Should show: Frequency:2.4XX GHz (not 5.XXX GHz)
```

**⚠️ Failure to use 2.4 GHz will result in:**
- Ecobee pairing failures
- Device discovery not working
- Connection timeouts and errors

## Installation

### 1. Install Python Dependencies

```bash
cd prostat-bridge
pip3 install -r requirements.txt
```

### 2. Run the Service

```bash
python3 server.py
```

The service will start on `http://0.0.0.0:8080`

## Pairing Process

### Step 1: Enable HomeKit Pairing Mode on Ecobee

1. On your Ecobee thermostat, go to: **Menu → Settings → Installation Settings → HomeKit**
2. Make sure HomeKit is **enabled** and pairing mode is **active**
3. The thermostat will display:
   - A QR code (for Apple Home app)
   - An **8-digit pairing code** (format: XXX-XX-XXX, e.g., `640-54-831`)
   - **Important:** Write down this code - you'll need it for pairing

**⚠️ Important Notes:**
- If your Ecobee is already paired to Apple HomeKit, you **must unpair it first**:
  1. Open the **Home** app on your iPhone/iPad
  2. Find your Ecobee → Long-press → **Settings** → **Remove Accessory**
  3. Wait 30 seconds for the device to reset
  4. Then enable pairing mode on the Ecobee again
- HomeKit devices can only be paired to **ONE controller at a time**
- The pairing code may change when you enable/disable pairing mode

### Step 2: Discover Device

From your web app or via API:

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

**Note:** The `device_id` may change each time you enable pairing mode. Always use the ID from the most recent discovery.

### Step 3: Pair with Device

**Via API:**
```bash
curl -X POST http://localhost:8080/api/pair \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "cc:73:51:2d:3b:0b",
    "pairing_code": "640-54-831"
  }'
```

**Via Web App:**
1. Go to Settings → Joule Bridge Settings
2. Click "Discover" to find your Ecobee
3. Enter the 8-digit pairing code from your Ecobee screen
4. Click "Pair"

**Important:**
- Use the **exact** pairing code shown on your Ecobee screen
- Format: `XXX-XX-XXX` (with dashes) - e.g., `810-85-888`
- **Flexible input:** The bridge accepts both formats:
  - With dashes: `810-85-888` (recommended)
  - Without dashes: `81085888` (auto-formatted to `810-85-888`)
- The pairing process takes up to 45 seconds - be patient
- Keep the Ecobee screen showing the pairing code during the process

**Success Response:**
```json
{
  "success": true,
  "device_id": "cc:73:51:2d:3b:0b"
}
```

### Step 4: Verify Pairing

```bash
curl http://localhost:8080/api/paired
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

### Step 5: Test Connection

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

If you get `null`, see the "Status Returns Null" section in Troubleshooting.

### Pairing Persistence

Pairings are automatically saved to `prostat-bridge/data/pairings.json` and will persist across bridge restarts. The bridge automatically loads existing pairings on startup.

## API Endpoints

### Discover Devices

```
GET /api/discover
```

Returns list of HomeKit devices on the network.

### Pair with Device

```
POST /api/pair
Body: {
  "device_id": "XX:XX:XX:XX:XX:XX",
  "pairing_code": "123-45-678"  // or "12345678" (auto-formatted)
}
```

**Pairing Code Format:**
- Accepts both formats: `"123-45-678"` or `"12345678"`
- Automatically validates and formats to `XXX-XX-XXX` format
- Must be exactly 8 digits
- Provides detailed error messages if format is incorrect

### Get Thermostat Status

```
GET /api/status?device_id=XX:XX:XX:XX:XX:XX
```

Returns current temperature, target temperature, mode, etc.

### Set Temperature

```
POST /api/set-temperature
Body: {
  "device_id": "XX:XX:XX:XX:XX:XX",
  "temperature": 72.0
}
```

**Note:** The bridge automatically discovers the correct characteristic IDs for your Ecobee model. You can call `set-temperature` immediately after pairing - no need to call `/api/status` first. The bridge will automatically fetch the required IDs if they're not cached.

### Set Mode

```
POST /api/set-mode
Body: {
  "device_id": "XX:XX:XX:XX:XX:XX",
  "mode": "heat"  // or "cool", "off", "auto"
}
```

**Note:** Like `set-temperature`, this endpoint works immediately after pairing. The bridge automatically discovers and caches the correct characteristic IDs for your device.

### List Paired Devices

```
GET /api/paired
```

### Unpair Device

```
POST /api/unpair
Body: {
  "device_id": "XX:XX:XX:XX:XX:XX"
}
```

## Running as a Service

### systemd Service (Linux)

The bridge can run as a systemd service to auto-start on boot.

**Create the service file:**

```bash
sudo nano /etc/systemd/system/prostat-bridge.service
```

**Service file contents:**

```ini
[Unit]
Description=ProStat Bridge HomeKit Controller
After=network.target

[Service]
Type=simple
User=thomas
WorkingDirectory=/home/thomas/git/joule-hvac/prostat-bridge
ExecStart=/home/thomas/git/joule-hvac/prostat-bridge/venv/bin/python3 /home/thomas/git/joule-hvac/prostat-bridge/server.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Important:** Update the paths in the service file to match your installation:
- `User=` - Your Linux username
- `WorkingDirectory=` - Path to the `prostat-bridge` directory
- `ExecStart=` - Full path to Python in your virtual environment

**Enable and start:**

```bash
# Reload systemd to recognize the new service
sudo systemctl daemon-reload

# Enable the service to start on boot
sudo systemctl enable prostat-bridge

# Start the service
sudo systemctl start prostat-bridge

# Check status
sudo systemctl status prostat-bridge

# View logs
journalctl -u prostat-bridge -f
```

**Service Management:**

```bash
# Stop the service
sudo systemctl stop prostat-bridge

# Restart the service
sudo systemctl restart prostat-bridge

# Disable auto-start on boot
sudo systemctl disable prostat-bridge

# View recent logs
journalctl -u prostat-bridge -n 50
```

### Manual Start (Development/Testing)

For development or testing, you can run the bridge manually:

```bash
cd prostat-bridge
source venv/bin/activate
python3 server.py
```

Or run in the background:

```bash
cd prostat-bridge
source venv/bin/activate
nohup python3 server.py > /tmp/bridge.log 2>&1 &
```

**Check if running:**
```bash
curl http://localhost:8080/health
```

**View logs:**
```bash
tail -f /tmp/bridge.log
```

## Troubleshooting

### Device Not Found

**Symptoms:** Device doesn't appear in `/api/discover` results

**Solutions:**
- Ensure Ecobee and Bridge are on the same Wi-Fi network
- Check that HomeKit is enabled on Ecobee (Menu → Settings → Installation Settings → HomeKit)
- Verify the Ecobee is powered on and connected to Wi-Fi
- Try restarting the discovery process: `curl http://localhost:8080/api/discover`
- Check bridge logs: `tail -f /tmp/bridge.log` (or `journalctl -u prostat-bridge -f` if running as service)

### Pairing Fails

**Symptoms:** Pairing request returns error or times out

**Common Causes & Solutions:**

1. **Device Not in Pairing Mode**
   - On Ecobee: Menu → Settings → Installation Settings → HomeKit
   - Make sure pairing mode is **ACTIVE** (you should see a pairing code on screen)
   - The pairing code format is XXX-XX-XXX (e.g., `640-54-831`)

2. **Device Already Paired to Apple HomeKit**
   - HomeKit devices can only be paired to ONE controller at a time
   - If your Ecobee is paired to Apple HomeKit, you must unpair it first:
     1. Open the **Home** app on your iPhone/iPad
     2. Find your Ecobee thermostat
     3. Long-press → **Settings** → **Remove Accessory**
     4. Wait 30 seconds for the device to reset
     5. Enable pairing mode on the Ecobee again
     6. Use the **NEW** pairing code shown on the Ecobee screen (it may have changed)

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

- `"Pairing initialization timed out"` - The device didn't respond within 10 seconds. This means:
  - Device is not in HomeKit pairing mode (check Ecobee screen)
  - Device is already paired to Apple Home (must unpair first)
  - Network connectivity issues between bridge and device
  - Device is powered off or disconnected from WiFi
  - **Solution:** Verify pairing mode is active, unpair from Apple Home if needed, check network

- `"Pairing timed out"` - The pairing process took longer than 30 seconds. Usually means:
  - Incorrect pairing code (double-check all 8 digits)
  - Device not fully in pairing mode
  - Network latency issues
  - **Solution:** Verify code matches Ecobee screen exactly, wait 30 seconds and try again

- `"Device is already paired to another controller"` - Unpair from Apple HomeKit first (see #2 above).

- `"Device not found. Please discover devices first"` - Run discovery first, then use the device_id from the results.

**Enhanced Diagnostics:**
- The bridge now provides detailed error messages with step-by-step troubleshooting
- Check bridge logs for comprehensive diagnostic information:
  ```bash
  journalctl -u prostat-bridge -f | grep -i "pairing\|error"
  ```
- Logs include: pairing code format, device reachability, timing information, and specific error details

### Pairing Not Persisting After Restart

**Symptoms:** Device pairs successfully but disappears after bridge restart

**Solution:**
- This was a known issue that has been fixed. Pairings are now saved directly to disk.
- If you experience this issue:
  1. Check that `prostat-bridge/data/pairings.json` exists and contains your device
  2. Verify file permissions: `ls -la prostat-bridge/data/pairings.json`
  3. Check bridge logs for save errors: `grep -i "save\|pairing" /tmp/bridge.log`
  4. Try pairing again - the fix ensures pairings are saved correctly

### Connection Drops / Device Unreachable

**Symptoms:** Device shows as "paired but not reachable" or status returns `null`

**Solutions:**
- The bridge automatically refreshes device IP addresses when connection fails
- Wait a few seconds for automatic reconnection
- If it persists:
  1. Check that the Ecobee is powered on and connected to Wi-Fi
  2. Verify the Ecobee's IP address hasn't changed (check your router)
  3. Try unpairing and re-pairing the device
  4. Check bridge logs: `tail -f /tmp/bridge.log | grep -i "connect\|error"`

### Status Returns Null

**Symptoms:** `/api/status` returns `null` even though device is paired

**Solutions:**
- This usually means the device IP address changed or the device is offline
- The bridge will automatically try to refresh the IP address
- Check bridge logs for connection errors
- Verify the Ecobee is online and reachable on your network
- Try restarting the bridge: `sudo systemctl restart prostat-bridge` (or kill and restart manually)

### Cannot Change Temperature or Mode

**Symptoms:** `set-temperature` or `set-mode` calls fail with errors about wrong characteristic IDs

**Solutions:**
- This is now automatically handled by the bridge's characteristic ID discovery
- The bridge automatically discovers and caches the correct IDs for your Ecobee model
- If you see errors, check the bridge logs for "Cache miss" or "Using cached IDs" messages
- The bridge will automatically refresh the cache if a write fails
- If problems persist, try calling `/api/status` first to force ID discovery, then retry the set operation

### Multiple Devices Listed (Only One Ecobee)

**Symptoms:** `/api/paired` shows multiple device IDs but you only have one Ecobee

**Solution:**
- This happens when old/stale pairings remain in the system
- Unpair the old device IDs that are unreachable
- Keep only the device that's currently working
- The primary device is automatically set to the first one in the list

### Checking Logs

**Development/Manual Start:**
```bash
tail -f /tmp/bridge.log
```

**systemd Service:**
```bash
journalctl -u prostat-bridge -f
```

**Filter for specific issues:**
```bash
# Pairing issues
grep -i "pair\|error" /tmp/bridge.log

# Connection issues
grep -i "connect\|timeout" /tmp/bridge.log

# Device discovery
grep -i "discover\|found device" /tmp/bridge.log
```

### Enhanced Pairing Diagnostics

The bridge now provides comprehensive logging for pairing attempts. When pairing, you'll see detailed information in the logs:

**Pairing Code Validation:**
```
Pairing code validation: original='81085888', formatted='810-85-888', digits='81085888'
```

**Device Information:**
```
=== Starting pairing process ===
Device ID: da:04:e9:07:e2:d5
Original pairing code: 81085888
Formatted pairing code: 810-85-888
Device description available: {...}
✓ Device is reachable, proceeding with pairing
```

**Timing Information:**
```
Calling device.async_start_pairing(da:04:e9:07:e2:d5)...
✓ async_start_pairing completed in 2.34 seconds
Calling finish_pairing with code: 810-85-888...
✓ Pairing completed successfully in 5.67 seconds
```

**Error Diagnostics:**
If pairing fails, logs include:
- Exact error type and message
- Timing information (how long each step took)
- Device reachability status
- Full traceback for debugging
- Specific HomeKit protocol errors (if applicable)

**View pairing logs:**
```bash
# All pairing-related logs
journalctl -u prostat-bridge | grep -i "pairing\|pair"

# Recent pairing attempts with timing
journalctl -u prostat-bridge -n 100 | grep -E "pairing|Pairing|=== Starting"
```

## Technical Details

### Characteristic ID Discovery

The bridge automatically discovers the correct HomeKit characteristic IDs (AID and IID) for your specific Ecobee model. Different Ecobee firmware versions may use different IDs, so the bridge:

1. **Discovers IDs on first read**: When you call `/api/status`, the bridge queries the device to find the correct IDs for:
   - Current Temperature
   - Target Temperature  
   - Target Heating/Cooling State
   - Current Heating/Cooling State

2. **Caches IDs for writes**: The discovered IDs are cached so that `set-temperature` and `set-mode` can use them immediately.

3. **Auto-populates on cold start**: If you call `set-temperature` or `set-mode` immediately after server restart (before calling status), the bridge will automatically fetch the IDs first, then perform the write operation.

This means you **never need to call `/api/status` before setting temperature or mode** - the bridge handles ID discovery automatically.

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌──────────┐
│  Web App    │────────▶│  ProStat Pi  │────────▶│  Ecobee  │
│  (React)    │  HTTP   │  (Python)    │   HAP   │          │
└─────────────┘         └──────────────┘         └──────────┘
     │                          │
     │                          │
     └──────────────────────────┘
        Local Network Only
```

All communication stays on your local network. No cloud, no APIs, no external dependencies.

## Security Notes

- The service runs on your local network only
- HomeKit uses end-to-end encryption
- Pairing requires physical access to the thermostat
- No data leaves your network

## Next Steps

1. Integrate with the React web app
2. Add automatic reconnection logic
3. Implement short cycle protection
4. Add scheduling and away mode
5. Create mobile app companion
