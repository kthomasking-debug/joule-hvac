# Blueair Connection Test Results

## Current Status

### Bridge Health
✅ **Bridge is running** at `http://192.168.0.106:8080`
- Health endpoint: `{"status": "ok"}`

### Blueair Connection
❌ **Blueair is NOT connected**
- Status endpoint: `{"error": "Device not found"}`
- Fan control endpoint: `{"error": "Blueair not connected"}`

## Test Results

### API Endpoints Tested

1. **Health Check**
   ```bash
   curl http://192.168.0.106:8080/health
   # Response: {"status": "ok"} ✅
   ```

2. **Blueair Status**
   ```bash
   curl http://192.168.0.106:8080/api/blueair/status
   # Response: {"error": "Device not found"} ❌
   ```

3. **Blueair Fan Control**
   ```bash
   curl -X POST http://192.168.0.106:8080/api/blueair/fan \
     -H "Content-Type: application/json" \
     -d '{"device_index":0,"speed":1}'
   # Response: {"error": "Blueair not connected"} ❌
   ```

4. **Blueair Credentials Endpoint**
   ```bash
   curl http://192.168.0.106:8080/api/blueair/credentials
   # Response: 404 Not Found ❌
   ```
   **Note**: This endpoint doesn't exist yet on the remote bridge. The remote bridge needs to be updated with the new code.

## Root Cause Analysis

### Issue 1: Credentials Not Set
The Blueair credentials are likely not configured on the remote bridge. The bridge needs:
- `BLUEAIR_USERNAME=bunnyrita@gmail.com`
- `BLUEAIR_PASSWORD=12345678`

### Issue 2: Code Not Updated
The remote bridge is running old code that doesn't have:
- `/api/blueair/credentials` endpoint (GET/POST)
- Config file support for credentials
- Enhanced status endpoint with sensor data

## Next Steps to Fix

### Option 1: Update Remote Bridge Code (Recommended)
1. Deploy the updated `server.py` to the remote bridge
2. Restart the bridge service: `sudo systemctl restart prostat-bridge`
3. Use the web UI to set credentials via `/api/blueair/credentials`

### Option 2: Set Credentials via Environment Variables (Temporary)
If you can SSH to the remote bridge:
```bash
ssh tom-pc@192.168.0.106
sudo nano /etc/systemd/system/prostat-bridge.service
# Add to [Service] section:
Environment="BLUEAIR_USERNAME=bunnyrita@gmail.com"
Environment="BLUEAIR_PASSWORD=12345678"
sudo systemctl daemon-reload
sudo systemctl restart prostat-bridge
```

### Option 3: Test Locally First
If you have blueair-api installed locally:
```bash
cd prostat-bridge
source venv/bin/activate  # if using venv
python3 ../scripts/test-blueair-connection.py
```

## Expected Data from Blueair

Once connected, the Blueair API should provide:

### Device Information
- Device name
- MAC address
- Model number
- Device ID

### Status Data
- Current fan speed (0-3)
- LED brightness (0-100)
- Filter life percentage
- Operating mode

### Sensor Data (if available)
- PM2.5 levels
- PM10 levels
- tVOC (Total Volatile Organic Compounds)
- Air quality index (AQI)

## Enhanced Status Endpoint

The updated `get_blueair_status()` function now attempts to retrieve:
1. Device information (name, model, MAC address)
2. Current settings (fan speed, LED brightness)
3. Sensor data (PM2.5, tVOC, etc.)
4. Device status from the API

If the API doesn't support certain methods, it falls back to cached state.

## Testing Checklist

- [ ] Update remote bridge code
- [ ] Set Blueair credentials (via UI or environment variables)
- [ ] Restart bridge service
- [ ] Test credentials endpoint: `curl http://192.168.0.106:8080/api/blueair/credentials`
- [ ] Test status endpoint: `curl http://192.168.0.106:8080/api/blueair/status`
- [ ] Verify device data is returned
- [ ] Test fan control: `curl -X POST http://192.168.0.106:8080/api/blueair/fan -H "Content-Type: application/json" -d '{"device_index":0,"speed":2}'`
- [ ] Check bridge logs: `ssh tom-pc@192.168.0.106 'sudo journalctl -u prostat-bridge -f | grep -i blueair'`

## Current Code Status

✅ **Local code is updated** with:
- Credentials management (config file + API endpoints)
- Enhanced status endpoint
- Better error handling

❌ **Remote bridge needs update** to get:
- New credentials endpoints
- Config file support
- Enhanced status data


