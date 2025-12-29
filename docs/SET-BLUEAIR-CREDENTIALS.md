# Setting Blueair Credentials on Remote Bridge

## Quick Setup

To configure Blueair credentials on your remote bridge (`tom-pc@192.168.0.106`):

### Option 1: Manual SSH (Recommended)

1. **SSH to the remote bridge:**
   ```bash
   ssh tom-pc@192.168.0.106
   # Password: !Tk1234!
   ```

2. **Edit the service file:**
   ```bash
   sudo nano /etc/systemd/system/prostat-bridge.service
   ```

3. **Add these lines in the `[Service]` section** (after any existing `Environment=` lines):
   ```ini
   Environment="BLUEAIR_USERNAME=bunnyrita@gmail.com"
   Environment="BLUEAIR_PASSWORD=12345678"
   ```

4. **Save and exit** (Ctrl+X, then Y, then Enter)

5. **Reload systemd and restart the service:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart prostat-bridge
   ```

6. **Check the status:**
   ```bash
   sudo systemctl status prostat-bridge
   ```

7. **Test the Blueair connection:**
   ```bash
   curl http://localhost:8080/api/blueair/status
   ```

   You should see:
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

8. **Check logs for Blueair connection:**
   ```bash
   sudo journalctl -u prostat-bridge -f | grep -i blueair
   ```

   Look for: `Blueair connected: 1 device(s) found`

### Option 2: One-Line Command (if you have passwordless sudo)

```bash
ssh tom-pc@192.168.0.106 'sudo bash -c "
  # Backup
  cp /etc/systemd/system/prostat-bridge.service /etc/systemd/system/prostat-bridge.service.backup.$(date +%Y%m%d_%H%M%S)
  
  # Remove old credentials if they exist
  sed -i '\''/BLUEAIR_USERNAME=/d'\'' /etc/systemd/system/prostat-bridge.service
  sed -i '\''/BLUEAIR_PASSWORD=/d'\'' /etc/systemd/system/prostat-bridge.service
  
  # Add new credentials
  sed -i '\''/\[Service\]/a Environment=\"BLUEAIR_USERNAME=bunnyrita@gmail.com\"'\'' /etc/systemd/system/prostat-bridge.service
  sed -i '\''/\[Service\]/a Environment=\"BLUEAIR_PASSWORD=12345678\"'\'' /etc/systemd/system/prostat-bridge.service
  
  # Reload and restart
  systemctl daemon-reload
  systemctl restart prostat-bridge
  
  # Wait and test
  sleep 3
  curl http://localhost:8080/api/blueair/status
"'
```

## Verify Configuration

After setting credentials, verify from your local machine:

```bash
# Check status
curl http://192.168.0.106:8080/api/blueair/status

# Should return:
# {"connected": true, "devices_count": 1, ...}
```

## Troubleshooting

### Service won't start
```bash
ssh tom-pc@192.168.0.106
sudo journalctl -u prostat-bridge -n 50
```

### Blueair not connecting
1. Verify credentials are correct
2. Check internet connection (Blueair uses cloud API)
3. Test credentials manually:
   ```bash
   python3 -c "
   from blueair_api import get_devices
   import asyncio
   devices = asyncio.run(get_devices('bunnyrita@gmail.com', '12345678'))
   print(f'Found {len(devices)} device(s)')
   "
   ```

### Check service file syntax
```bash
sudo systemctl cat prostat-bridge.service
```

Make sure the `Environment=` lines are in the `[Service]` section.

## Next Steps

Once configured:
1. ✅ Go to `/control/blueair` in the web app
2. ✅ You should see "Connected" status
3. ✅ Try controlling fan speed and LED brightness
4. ✅ Test the Dust Kicker cycle


