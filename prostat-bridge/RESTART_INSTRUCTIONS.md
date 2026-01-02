# Restart Instructions for HomeKit Bridge

## Quick Restart

To restart the bridge service and activate the HomeKit bridge:

```bash
sudo systemctl restart prostat-bridge
```

## Verify HomeKit Bridge Started

After restarting, check the logs:

```bash
sudo journalctl -u prostat-bridge -f | grep -i "homekit"
```

You should see:
- "HomeKit Bridge Server Started"
- "Air Purifier accessory available" (if Blueair is configured)
- "Thermostat accessory available" (if Ecobee is paired)

## Test Pairing Info Endpoint

```bash
curl http://localhost:8080/api/homekit-bridge/pairing-info
```

Should return JSON with:
- `available: true`
- `pincode: "XXX-XX-XXX"`
- `qr_data: "X-HM://..."`
- `port: 51826`

## Alternative: Manual Restart

If you can't use sudo, you can manually restart:

1. Find the process:
   ```bash
   ps aux | grep server.py
   ```

2. Kill the process:
   ```bash
   kill <PID>
   ```

3. Restart manually:
   ```bash
   cd /home/thomas/git/joule-hvac/prostat-bridge
   source venv/bin/activate
   python3 server.py
   ```

## Check Ports After Restart

```bash
# Check HTTP API (port 8080)
curl http://localhost:8080/health

# Check HomeKit bridge (port 51826)
sudo netstat -tlnp | grep 51826
# or
sudo ss -tlnp | grep 51826
```

## Troubleshooting

If HomeKit bridge doesn't start:

1. **Check HAP-python is installed:**
   ```bash
   cd prostat-bridge
   source venv/bin/activate
   python3 -c "import pyhap; print('OK')"
   ```

2. **Check for errors in logs:**
   ```bash
   sudo journalctl -u prostat-bridge -n 100 | grep -i error
   ```

3. **Verify code is up to date:**
   ```bash
   cd /home/thomas/git/joule-hvac
   git status
   ```




