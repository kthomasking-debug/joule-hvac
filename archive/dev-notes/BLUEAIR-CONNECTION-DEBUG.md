# Blueair Connection Debugging Guide

## Error: "Credentials saved but failed to connect"

This error means:
- ✅ Credentials were saved to the config file successfully
- ❌ The bridge failed to authenticate with Blueair's cloud API

## Possible Causes

### 1. **blueair-api Library Not Installed**

The bridge uses the `blueair-api` Python library. If it's not installed, the connection will fail.

**Check:**
```bash
# SSH into the mini PC
ssh tom-pc@192.168.0.106

# Check if library is installed
python3 -c "import blueair_api; print('OK')"
```

**If it fails:**
```bash
cd ~/prostat-bridge
pip3 install blueair-api
# Or if using requirements.txt:
pip3 install -r requirements.txt
```

### 2. **Password Contains Special Characters**

Your password `$Usfs30512` starts with `$`, which can cause issues in some contexts. However, the bridge should handle this correctly when passed as JSON.

**Test the credentials directly:**
```bash
# On the mini PC, test credentials manually
python3 << 'EOF'
import asyncio
from blueair_api import get_devices

async def test():
    try:
        api, devices = await get_devices(
            username="bunnyrita@gmail.com",
            password="$Usfs30512"
        )
        print(f"✅ Success! Found {len(devices)} device(s)")
        for i, device in enumerate(devices):
            print(f"  Device {i}: {device.name} (UUID: {device.uuid})")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

asyncio.run(test())
EOF
```

### 3. **Incorrect Credentials**

Double-check:
- Email: `bunnyrita@gmail.com` (must match your Blueair app login)
- Password: `$Usfs30512` (must match your Blueair app password)

**Verify in Blueair app:**
1. Open the Blueair app on your phone
2. Try logging in with these credentials
3. If login fails in the app, the credentials are wrong

### 4. **Network/Firewall Issues**

The bridge needs internet access to reach Blueair's cloud API (AWS servers).

**Test connectivity:**
```bash
# On the mini PC
curl -v https://api.blueair.io 2>&1 | head -20
# Or test DNS resolution
nslookup api.blueair.io
```

### 5. **Blueair API Rate Limiting or Account Issues**

Blueair's API might be:
- Rate limiting your requests
- Requiring account verification
- Blocking the connection for security reasons

**Check bridge logs for detailed error:**
```bash
# On the mini PC
sudo journalctl -u prostat-bridge -n 50 --no-pager | grep -i blueair
```

Look for lines like:
- `Blueair API error: ...`
- `Failed to initialize Blueair: ...`

## Step-by-Step Debugging

### Step 1: Check Library Installation

```bash
ssh tom-pc@192.168.0.106
python3 -c "from blueair_api import get_devices; print('Library OK')"
```

**If error:** Install it:
```bash
pip3 install blueair-api
```

### Step 2: Test Credentials Manually

```bash
# On mini PC
python3 << 'EOF'
import asyncio
from blueair_api import get_devices

async def test():
    try:
        api, devices = await get_devices(
            username="bunnyrita@gmail.com",
            password="$Usfs30512"
        )
        print(f"✅ SUCCESS: {len(devices)} device(s)")
    except Exception as e:
        print(f"❌ FAILED: {e}")

asyncio.run(test())
EOF
```

**If this fails**, the credentials are wrong or there's a network issue.

### Step 3: Check Bridge Logs

```bash
# On mini PC
sudo journalctl -u prostat-bridge -f | grep -i blueair
```

Then try saving credentials again from the web UI and watch the logs.

### Step 4: Verify Config File

```bash
# On mini PC
cat ~/prostat-bridge/data/blueair_config.json
```

Should show:
```json
{
  "username": "bunnyrita@gmail.com",
  "password": "$Usfs30512"
}
```

### Step 5: Restart Bridge Service

```bash
# On mini PC
sudo systemctl restart prostat-bridge
sleep 3
sudo journalctl -u prostat-bridge -n 20 --no-pager | grep -i blueair
```

## Common Error Messages

### "ModuleNotFoundError: No module named 'blueair_api'"
**Fix:** `pip3 install blueair-api`

### "Authentication failed" or "Invalid credentials"
**Fix:** Verify credentials in Blueair app, check for typos

### "Connection timeout" or "Network unreachable"
**Fix:** Check internet connectivity on the mini PC

### "Rate limit exceeded"
**Fix:** Wait a few minutes and try again

## Quick Fix Script

Run this on the mini PC to diagnose everything at once:

```bash
#!/bin/bash
echo "=== Blueair Connection Diagnostic ==="
echo ""
echo "1. Checking blueair-api library..."
python3 -c "from blueair_api import get_devices; print('✅ Library installed')" 2>&1 || echo "❌ Library missing - run: pip3 install blueair-api"
echo ""
echo "2. Checking config file..."
if [ -f ~/prostat-bridge/data/blueair_config.json ]; then
    echo "✅ Config file exists"
    cat ~/prostat-bridge/data/blueair_config.json | grep -v password
else
    echo "❌ Config file missing"
fi
echo ""
echo "3. Testing credentials..."
python3 << 'EOF'
import asyncio
from blueair_api import get_devices

async def test():
    try:
        api, devices = await get_devices(
            username="bunnyrita@gmail.com",
            password="$Usfs30512"
        )
        print(f"✅ Credentials work! Found {len(devices)} device(s)")
    except Exception as e:
        print(f"❌ Credentials failed: {e}")

asyncio.run(test())
EOF
echo ""
echo "4. Checking bridge logs..."
sudo journalctl -u prostat-bridge -n 30 --no-pager | grep -i blueair | tail -5
```

## Expected Success Output

When working correctly, you should see in the logs:
```
Blueair connected: 1 device(s) found
  Device 0: Blueair Pure 211 Max (UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
```

And the web UI should show:
```
✅ Connected: 1 device(s) found
```

## Still Not Working?

1. **Verify credentials work in Blueair mobile app**
2. **Check if Blueair account requires 2FA** (might need app-specific password)
3. **Try resetting Blueair password** and use the new one
4. **Check Blueair API status** (their servers might be down)

