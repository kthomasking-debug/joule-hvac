# Blueair ESP32 Local Device Setup

This guide explains how to connect a Blueair air purifier running on an ESP32 device (local network device) to the Joule Bridge.

## Auto-Discovery (Recommended)

The bridge can automatically discover your ESP32 device even if its IP address changes. This is the recommended method.

### Option 1: MAC Address Discovery (Best for Dynamic IPs)

If your ESP32 device's IP address changes (DHCP), use MAC address discovery:

1. **Set the MAC address** as an environment variable:
   ```bash
   export BLUEAIR_MAC_ADDRESS=D0-EF-76-1B-B8-1C
   ```

2. **Restart the bridge service**:
   ```bash
   sudo systemctl restart prostat-bridge
   ```

3. **The bridge will automatically**:
   - Scan the network using ARP tables to find the device by MAC address
   - Update the IP address if it changes
   - Rediscover the device if connection is lost

### Option 2: Manual IP Address (Static IP)

If you want to manually specify the IP address (or have a static IP):

1. **Set the IP address** as an environment variable:
   ```bash
   export BLUEAIR_LOCAL_IP=192.168.0.107
   ```

2. **Restart the bridge service**:
   ```bash
   sudo systemctl restart prostat-bridge
   ```

**Note:** Manual IP takes priority over auto-discovery. If `BLUEAIR_LOCAL_IP` is set, auto-discovery is disabled.

## How Auto-Discovery Works

The bridge uses multiple methods to find your ESP32 device:

1. **mDNS/Bonjour** (if ESP32 advertises itself)
   - Scans for `_http._tcp.local.` services
   - Fastest method if supported

2. **ARP Table Scan** (MAC address discovery)
   - Scans your router's ARP table for the MAC address
   - Works even if IP changes
   - Requires `BLUEAIR_MAC_ADDRESS` to be set

3. **Automatic Rediscovery**
   - If connection fails, bridge automatically tries to rediscover the device
   - Prevents service interruption when IP changes
   - Limits rediscovery attempts to once every 30 seconds

4. **Cached IP Fallback**
   - If discovery fails, uses last known IP address
   - Verifies IP is still reachable before using

## Quick Setup

**For your device (MAC: D0-EF-76-1B-B8-1C):**

```bash
# Set MAC address for auto-discovery
export BLUEAIR_MAC_ADDRESS=D0-EF-76-1B-B8-1C

# Restart bridge
sudo systemctl restart prostat-bridge

# Verify it's working
journalctl -u prostat-bridge -f
# Look for: "Found Blueair ESP32 via ARP scan: 192.168.0.107"
# or: "Blueair local ESP32 mode (auto-discovered): 192.168.0.107"
```

## ESP32 API Requirements

Your ESP32 device needs to expose the following HTTP REST endpoints:

### 1. Get Status
```
GET http://192.168.0.107/api/status
```

**Response:**
```json
{
  "fan_speed": 2,
  "led_brightness": 100
}
```

### 2. Control Fan Speed
```
POST http://192.168.0.107/api/fan
Content-Type: application/json

{
  "speed": 3
}
```

**Speed values:**
- `0` = Off
- `1` = Low
- `2` = Medium  
- `3` = Max

**Response:**
```json
{
  "ok": true,
  "speed": 3
}
```

### 3. Control LED Brightness
```
POST http://192.168.0.107/api/led
Content-Type: application/json

{
  "brightness": 50
}
```

**Brightness values:** `0-100` (0 = off, 100 = full brightness)

**Response:**
```json
{
  "ok": true,
  "brightness": 50
}
```

## Testing the ESP32 API

You can test if your ESP32 device has these endpoints using `curl`:

```bash
# Test status endpoint
curl http://192.168.0.107/api/status

# Test fan control
curl -X POST http://192.168.0.107/api/fan \
  -H "Content-Type: application/json" \
  -d '{"speed": 3}'

# Test LED control
curl -X POST http://192.168.0.107/api/led \
  -H "Content-Type: application/json" \
  -d '{"brightness": 50}'
```

## If Your ESP32 Has Different Endpoints

If your ESP32 device uses different endpoint paths or formats, you have two options:

1. **Modify the ESP32 firmware** to match the expected API format
2. **Modify the bridge server code** in `prostat-bridge/server.py` to match your ESP32's API

The relevant functions are:
- `get_blueair_status()` - line ~1730
- `control_blueair_fan()` - line ~1676
- `control_blueair_led()` - line ~1703

## Persistent Configuration

To make the configuration persistent across reboots, add it to your systemd service file:

**For MAC address discovery (recommended for dynamic IPs):**
```bash
sudo systemctl edit prostat-bridge
```

Add:
```ini
[Service]
Environment="BLUEAIR_MAC_ADDRESS=D0-EF-76-1B-B8-1C"
```

**For manual IP address (static IP only):**
```ini
[Service]
Environment="BLUEAIR_LOCAL_IP=192.168.0.107"
```

Then reload and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart prostat-bridge
```

**Note:** MAC address discovery is recommended because it automatically handles IP address changes. Only use `BLUEAIR_LOCAL_IP` if you have a static IP or want to override auto-discovery.

## Troubleshooting

### Bridge shows "Not Connected"

1. **Check configuration:**
   ```bash
   echo $BLUEAIR_MAC_ADDRESS  # Should show: D0-EF-76-1B-B8-1C
   echo $BLUEAIR_LOCAL_IP     # Optional, only if using manual IP
   ```

2. **Check bridge logs for discovery:**
   ```bash
   journalctl -u prostat-bridge -f
   ```
   Look for:
   - `"Found Blueair ESP32 via ARP scan: ..."`
   - `"Found Blueair ESP32 via mDNS: ..."`
   - `"Blueair local ESP32 mode (auto-discovered): ..."`

3. **Verify the ESP32 is reachable:**
   ```bash
   # First, find current IP (if using MAC discovery)
   arp -a | grep -i "d0:ef:76:1b:b8:1c"
   
   # Then ping it
   ping 192.168.0.107  # Use the IP from arp output
   ```

4. **Test ESP32 API directly:**
   ```bash
   curl http://192.168.0.107/api/status
   ```

5. **Force rediscovery:**
   - Restart the bridge service: `sudo systemctl restart prostat-bridge`
   - The bridge will automatically try to rediscover the device

### IP Address Changed

If your ESP32 device's IP address changes:

- **With MAC address discovery**: The bridge will automatically find the new IP. No action needed!
- **With manual IP**: You'll need to update `BLUEAIR_LOCAL_IP` and restart the service, or switch to MAC address discovery.

### Discovery Not Working

If auto-discovery fails:

1. **Check MAC address format:**
   - Correct: `D0-EF-76-1B-B8-1C` or `D0:EF:76:1B:B8:1C`
   - Bridge accepts both formats

2. **Verify device is on same network:**
   - ESP32 and bridge must be on the same local network
   - Check router's connected devices list

3. **Try manual IP as fallback:**
   ```bash
   export BLUEAIR_LOCAL_IP=192.168.0.107
   sudo systemctl restart prostat-bridge
   ```

4. **Check ARP table manually:**
   ```bash
   arp -a | grep -i "d0:ef:76"
   ```
   If the device doesn't appear, it may not be on the network or ARP cache is empty.

### 404 Errors

If you see 404 errors, your ESP32 device doesn't have the expected endpoints. You'll need to either:
- Update the ESP32 firmware to add the endpoints
- Modify the bridge server code to match your ESP32's API format

### Connection Timeout

If requests timeout, check:
- ESP32 is on the same network as the bridge
- ESP32 firewall isn't blocking HTTP requests
- ESP32 web server is running and responding

## Your Device Information

Based on your router information:
- **MAC Address:** D0-EF-76-1B-B8-1C
- **IP Address:** 192.168.0.107
- **Device Type:** ESP32 (espressif)

Set `BLUEAIR_LOCAL_IP=192.168.0.107` to connect to this device.

