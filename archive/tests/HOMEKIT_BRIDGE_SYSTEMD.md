# HomeKit Bridge Systemd Service Configuration

## Status: ✅ Already Configured

The HomeKit bridge is **automatically included** in the main bridge service (`prostat-bridge.service`) because it's integrated into `server.py`.

## Service Configuration

The existing `prostat-bridge.service` file already handles the HomeKit bridge:

```ini
[Unit]
Description=Joule Bridge HomeKit Controller
After=network-online.target
Wants=network-online.target
Requires=network-online.target

[Service]
Type=simple
User=thomas
WorkingDirectory=/home/thomas/git/joule-hvac/prostat-bridge
ExecStart=/home/thomas/git/joule-hvac/prostat-bridge/venv/bin/python3 /home/thomas/git/joule-hvac/prostat-bridge/server.py
Restart=always
RestartSec=10
Environment="PATH=/home/thomas/git/joule-hvac/prostat-bridge/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

## What Starts Automatically

When the service starts, `server.py` automatically:
1. ✅ Starts the HTTP API server (port 8080)
2. ✅ Starts the HomeKit bridge server (port 51826)
3. ✅ Loads existing device pairings
4. ✅ Checks for Blueair availability
5. ✅ Creates accessories (Thermostat, Air Purifier)

## Ports Used

- **8080**: HTTP API bridge (existing)
- **51826**: HomeKit HAP bridge (new)

Both ports are opened automatically when the service starts.

## Verification

To verify the HomeKit bridge is running:

```bash
# Check service status
sudo systemctl status prostat-bridge

# Check logs for HomeKit bridge startup
sudo journalctl -u prostat-bridge -n 100 | grep -i "homekit\|bridge"

# Check if port 51826 is listening
sudo netstat -tlnp | grep 51826
# or
sudo ss -tlnp | grep 51826
```

## No Additional Configuration Needed

Since the HomeKit bridge is integrated into `server.py`, **no separate service file is needed**. The existing service handles everything.

## Troubleshooting

If the HomeKit bridge doesn't start:

1. **Check HAP-python is installed:**
   ```bash
   cd /home/thomas/git/joule-hvac/prostat-bridge
   source venv/bin/activate
   python3 -c "import pyhap; print('HAP-python installed')"
   ```

2. **Check logs for errors:**
   ```bash
   sudo journalctl -u prostat-bridge -f
   ```

3. **Verify network is online:**
   ```bash
   systemctl is-active network-online.target
   ```

4. **Check if port 51826 is available:**
   ```bash
   sudo lsof -i :51826
   ```

## Manual Start (for testing)

If you need to test the HomeKit bridge manually:

```bash
cd /home/thomas/git/joule-hvac/prostat-bridge
source venv/bin/activate
python3 server.py
```

The HomeKit bridge will start automatically alongside the HTTP server.






