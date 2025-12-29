# Finding Your Blueair Device on the Network

## Important: Blueair Uses Cloud API

**Blueair devices connect via Blueair's cloud API, not local network discovery.** The integration uses your Blueair account credentials to connect through their servers. However, the device still appears on your local network for WiFi connectivity.

## Identifying the Unknown Device

You mentioned seeing an "Unknown" device with:
- **MAC Address**: `FE-B6-68-2D-88-A7`
- **IP Address**: `192.168.0.104`

### Method 1: Check MAC Vendor

Look up the MAC address vendor to see if it's Blueair:

```bash
# Online lookup
# Visit: https://macvendors.com/query/FE-B6-68-2D-88-A7
# Or: https://www.macvendorlookup.com/search/FE-B6-68-2D-88-A7

# Using nmap (if installed)
nmap --script smb-os-discovery 192.168.0.104
```

### Method 2: Scan the Device

Try to identify what services are running on that IP:

```bash
# Quick port scan
nmap -p 80,443,8080,8443 192.168.0.104

# Full scan (slower)
nmap -A 192.168.0.104

# Check if it responds to HTTP
curl -v http://192.168.0.104
curl -v https://192.168.0.104
```

### Method 3: Check Device Behavior

1. **Unplug your Blueair** and see if the device disappears from your router
2. **Check the Blueair app** - it may show the device's IP address
3. **Look at network traffic** - Blueair devices typically make periodic HTTPS connections to Blueair's cloud servers

### Method 4: Check Router Logs

Many routers log device names or manufacturers. Check your router's admin panel for:
- Device manufacturer
- Device type
- Connection history

## Verifying Blueair Connection in Bridge

Even if you find the device on the network, the bridge connects via cloud API. Verify the connection:

### 1. Check Bridge Status

```bash
# On the remote bridge (tom-pc)
curl http://192.168.0.106:8080/api/blueair/status
```

Expected response:
```json
{
  "connected": true,
  "devices_count": 1,
  "status": {
    "device_index": 0,
    "fan_speed": 2,
    "led_brightness": 100
  }
}
```

### 2. Check Bridge Logs

```bash
# SSH to remote bridge
ssh tom-pc@192.168.0.106

# Check service logs
sudo journalctl -u prostat-bridge -f | grep -i blueair
```

Look for:
```
Blueair connected: 1 device(s) found
```

### 3. Verify Credentials

```bash
# On remote bridge
echo $BLUEAIR_USERNAME
echo $BLUEAIR_PASSWORD
```

If empty, set them:
```bash
# Edit service file
sudo nano /etc/systemd/system/prostat-bridge.service

# Add to [Service] section:
Environment="BLUEAIR_USERNAME=your-email@example.com"
Environment="BLUEAIR_PASSWORD=your-password"

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart prostat-bridge
```

### 4. Test API Directly

```bash
# On remote bridge
python3 -c "
from blueair_api import get_devices
import asyncio
import os

async def test():
    devices = await get_devices(
        username=os.getenv('BLUEAIR_USERNAME'),
        password=os.getenv('BLUEAIR_PASSWORD')
    )
    print(f'Found {len(devices)} device(s)')
    for i, dev in enumerate(devices):
        print(f'Device {i}: {dev}')

asyncio.run(test())
"
```

## Network Discovery Tools

### Using arp-scan

```bash
# Install if needed
sudo apt-get install arp-scan

# Scan your network
sudo arp-scan --local

# Look for the MAC address FE-B6-68-2D-88-A7
```

### Using nmap

```bash
# Scan entire subnet
nmap -sn 192.168.0.0/24

# Get more details on specific IP
nmap -A 192.168.0.104
```

### Using Router Admin Panel

Most routers have a device list:
1. Log into router admin (usually `192.168.0.1` or `192.168.1.1`)
2. Look for "Connected Devices" or "DHCP Clients"
3. Find `192.168.0.104` and check:
   - Device name
   - Manufacturer
   - MAC address vendor

## Blueair Device Characteristics

Blueair devices typically:
- Connect to WiFi (2.4GHz)
- Make HTTPS connections to Blueair cloud servers
- May have a web interface on port 80 (for setup)
- Use mDNS/Bonjour for local discovery (optional)
- MAC address vendor: Check if it matches Blueair AB

## Quick Verification Script

Create a script to check if the device is your Blueair:

```bash
#!/bin/bash
# check-blueair.sh

IP="192.168.0.104"
MAC="FE-B6-68-2D-88-A7"

echo "Checking device at $IP..."
echo "MAC: $MAC"
echo ""

# Check if device is online
if ping -c 1 -W 1 $IP > /dev/null 2>&1; then
    echo "✓ Device is online"
else
    echo "✗ Device is offline"
    exit 1
fi

# Check open ports
echo "Scanning ports..."
nmap -p 80,443,8080 $IP

# Check MAC vendor (requires internet)
echo ""
echo "MAC Vendor lookup:"
curl -s "https://api.macvendors.com/$MAC"

echo ""
echo "To verify it's your Blueair:"
echo "1. Unplug your Blueair and check if this device disappears"
echo "2. Check the Blueair app for device IP"
echo "3. Try accessing http://$IP in a browser"
```

## Troubleshooting

### Device Not Found in Bridge

If the bridge shows "Not Connected" but you see the device on network:

1. **Check credentials are set correctly**
2. **Verify internet connection** (Blueair needs cloud access)
3. **Check Blueair app** - can you control it from the app?
4. **Restart bridge service**: `sudo systemctl restart prostat-bridge`

### Device Found But Can't Control

1. **Check bridge logs** for API errors
2. **Verify Blueair account** - try logging into Blueair app
3. **Check device is online** in Blueair app
4. **Test API directly** (see above)

## Next Steps

Once you've identified the device:

1. ✅ Verify it's your Blueair (unplug test)
2. ✅ Set up Blueair credentials in bridge
3. ✅ Test connection: `curl http://192.168.0.106:8080/api/blueair/status`
4. ✅ Try controlling from web app: `/control/blueair`

The device's local IP (`192.168.0.104`) is only used for WiFi connectivity. All control goes through Blueair's cloud API using your account credentials.


