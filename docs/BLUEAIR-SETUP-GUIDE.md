# Blueair 211i Max Setup Guide

How to connect your Blueair 211i Max to the bridge so you can get data and control it from your app.

## How It Works

The Blueair 211i Max connects to **Blueair's cloud service** (not directly to your bridge). The bridge then connects to Blueair's cloud API to:
- Get sensor data (PM2.5, tVOC, etc.)
- Control fan speed
- Control LED brightness
- Monitor device status

**Architecture:**
```
Blueair 211i Max → WiFi → Blueair Cloud → Bridge (via API) → Your App
```

## Prerequisites

1. ✅ **Blueair 211i Max connected to WiFi** (already done!)
2. ✅ **Blueair device registered in Blueair app** (on your phone)
3. ✅ **Blueair account credentials** (email/password used in Blueair app)

## Step 1: Verify Blueair App Setup

1. **Open Blueair app** on your phone
2. **Make sure your 211i Max is connected:**
   - Device should show as "Online"
   - You should be able to control it from the app
   - If not connected, follow Blueair app setup instructions

3. **Note your Blueair account:**
   - Email address used to log into Blueair app
   - Password for that account

## Step 2: Install Blueair API Library

On your bridge server (mini computer):

```bash
cd ~/prostat-bridge
source venv/bin/activate
pip install blueair-api
```

Or if using system Python:
```bash
pip3 install blueair-api
```

## Step 3: Set Environment Variables

You need to set your Blueair credentials as environment variables.

### Option A: Set in Systemd Service (Recommended)

Edit the service file:

```bash
sudo nano /etc/systemd/system/prostat-bridge.service
```

Add these lines in the `[Service]` section:

```ini
[Service]
...
Environment="BLUEAIR_USERNAME=your-email@example.com"
Environment="BLUEAIR_PASSWORD=your-password"
```

**Replace:**
- `your-email@example.com` with your Blueair app email
- `your-password` with your Blueair app password

Then reload and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart prostat-bridge
```

### Option B: Set in Shell (Temporary - for testing)

```bash
export BLUEAIR_USERNAME="your-email@example.com"
export BLUEAIR_PASSWORD="your-password"
python3 server.py
```

### Option C: Create .env File (If supported)

Create `~/prostat-bridge/.env`:
```
BLUEAIR_USERNAME=your-email@example.com
BLUEAIR_PASSWORD=your-password
```

## Step 4: Verify Connection

### Check Bridge Logs

```bash
sudo journalctl -u prostat-bridge -f
```

Look for:
```
INFO - Blueair connected: 1 device(s) found
```

If you see an error, check:
- Credentials are correct
- Blueair device is online in Blueair app
- `blueair-api` library is installed

### Test API Endpoint

```bash
curl http://localhost:8080/api/blueair/status
```

**Expected response:**
```json
{
  "connected": true,
  "devices_count": 1,
  "status": {
    "fan_speed": 1,
    "led_brightness": 100,
    "pm25": 5.2,
    "tvoc": 0.1
  }
}
```

## Step 5: Use in Your App

### Get Blueair Status

```javascript
// From your web app
const response = await fetch('http://192.168.0.100:8080/api/blueair/status');
const data = await response.json();

console.log('PM2.5:', data.status.pm25);
console.log('Fan Speed:', data.status.fan_speed);
```

### Control Fan Speed

```javascript
await fetch('http://192.168.0.100:8080/api/blueair/fan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    device_index: 0,
    speed: 3  // 0=off, 1=low, 2=medium, 3=max
  })
});
```

### Control LED Brightness

```javascript
await fetch('http://192.168.0.100:8080/api/blueair/led', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    device_index: 0,
    brightness: 50  // 0-100
  })
});
```

## API Endpoints

### Get Status
```
GET /api/blueair/status?device_index=0
```

Returns:
- `connected`: Boolean - Is Blueair connected?
- `devices_count`: Number - How many devices found
- `status`: Object with:
  - `fan_speed`: 0-3 (0=off, 1=low, 2=med, 3=max)
  - `led_brightness`: 0-100
  - `pm25`: PM2.5 reading (if available)
  - `tvoc`: tVOC reading (if available)

### Control Fan
```
POST /api/blueair/fan
Body: {
  "device_index": 0,
  "speed": 3
}
```

### Control LED
```
POST /api/blueair/led
Body: {
  "device_index": 0,
  "brightness": 50
}
```

### Dust Kicker Cycle
```
POST /api/blueair/dust-kicker
```

Starts automated cycle:
1. HVAC fan to MAX
2. Wait 30 seconds
3. Blueair to MAX
4. Run for 10 minutes
5. Both to silent

## Troubleshooting

### "Blueair not connected"

**Check:**
1. ✅ Credentials are set correctly
2. ✅ Blueair device is online in Blueair app
3. ✅ `blueair-api` library is installed
4. ✅ Check logs: `sudo journalctl -u prostat-bridge -n 50`

**Common issues:**
- Wrong email/password
- Blueair device offline
- Library not installed
- Network connectivity issues

### "Blueair API error"

**Check:**
- Blueair account credentials are correct
- Device is registered in Blueair app
- Internet connection on bridge server
- Blueair cloud service is accessible

### "No devices found"

**Check:**
- Device is online in Blueair app
- Device is registered to your account
- Try logging into Blueair app to verify device is connected

## Security Notes

⚠️ **Important:**
- Blueair credentials are stored as environment variables
- Don't commit credentials to git
- Use secure password storage in production
- Consider using a secrets manager for production

## Multiple Blueair Devices

If you have multiple Blueair devices:

1. All devices will be discovered automatically
2. Use `device_index` parameter:
   - `device_index: 0` = First device
   - `device_index: 1` = Second device
   - etc.

3. Check which devices are available:
   ```bash
   curl http://localhost:8080/api/blueair/status
   # Look at "devices_count" in response
   ```

## Integration with Asthma Shield

The bridge also supports **Asthma Shield** mode, which automatically:
- Monitors PM2.5 and tVOC from Blueair
- Adjusts Blueair fan speed based on air quality
- Coordinates with Ecobee for optimal air quality

See `docs/ASTHMA-SHIELD-SETUP.md` for details.

## Summary

**Quick Setup:**
1. ✅ Blueair device connected to WiFi (done!)
2. ✅ Install: `pip install blueair-api`
3. ✅ Set: `BLUEAIR_USERNAME` and `BLUEAIR_PASSWORD` environment variables
4. ✅ Restart bridge: `sudo systemctl restart prostat-bridge`
5. ✅ Test: `curl http://localhost:8080/api/blueair/status`

**That's it!** Your Blueair 211i Max is now connected to the bridge and accessible from your app.

