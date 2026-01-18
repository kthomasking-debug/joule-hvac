# HomeKit Bridge Testing Checklist

## Pre-Testing Setup

### Prerequisites
- [ ] Bridge server is running (`server.py`)
- [ ] HAP-python is installed (`pip install HAP-python`)
- [ ] Bridge has at least one paired Ecobee device
- [ ] Blueair is configured (optional, for Air Purifier testing)
- [ ] Network is accessible (bridge and test device on same network)

### Verify Installation
- [ ] Check HAP-python is installed:
  ```bash
  cd prostat-bridge
  source venv/bin/activate
  python3 -c "import pyhap; print('HAP-python installed')"
  ```
- [ ] Check bridge server starts without errors:
  ```bash
  python3 server.py
  # Look for "HomeKit Bridge Server Started" in logs
  ```

---

## 1. Bridge Startup Tests

### 1.1 Service Startup
- [ ] Bridge server starts successfully
- [ ] HTTP API server starts on port 8080
- [ ] HomeKit bridge server starts on port 51826
- [ ] No errors in startup logs
- [ ] Both servers run simultaneously

**Check logs for:**
```
HomeKit Bridge Server Started
Bridge name: Joule Bridge
Port: 51826
Thermostat accessory available (if Ecobee paired)
Air Purifier accessory available (if Blueair configured)
```

### 1.2 Port Verification
- [ ] Port 8080 is listening (HTTP API):
  ```bash
  sudo netstat -tlnp | grep 8080
  # or
  curl http://localhost:8080/health
  ```
- [ ] Port 51826 is listening (HomeKit HAP):
  ```bash
  sudo netstat -tlnp | grep 51826
  ```

### 1.3 Accessory Creation
- [ ] Thermostat accessory is created (if Ecobee paired)
- [ ] Air Purifier accessory is created (if Blueair available)
- [ ] Bridge shows correct number of accessories in logs

---

## 2. API Endpoint Tests

### 2.1 Pairing Info Endpoint
- [ ] GET `/api/homekit-bridge/pairing-info` returns valid data:
  ```bash
  curl http://localhost:8080/api/homekit-bridge/pairing-info
  ```
- [ ] Response includes:
  - [ ] `available: true`
  - [ ] `pincode` (format: XXX-XX-XXX)
  - [ ] `qr_data` (HomeKit format)
  - [ ] `setup_id`
  - [ ] `mac` address
  - [ ] `paired` status
  - [ ] `port: 51826`

### 2.2 Error Handling
- [ ] Endpoint returns error if HAP-python not installed
- [ ] Endpoint returns error if bridge not started
- [ ] Error messages are clear and helpful

---

## 3. Frontend UI Tests

### 3.1 Pairing Info Display
- [ ] Navigate to: Settings → Joule Bridge Settings
- [ ] "HomeKit Bridge Pairing" section appears
- [ ] QR code displays correctly
- [ ] Pairing PIN code displays (XXX-XX-XXX format)
- [ ] PIN code is large and readable
- [ ] Copy button works (copies PIN to clipboard)

### 3.2 Status Indicators
- [ ] Shows "Bridge is paired" if already paired
- [ ] Shows "Bridge is not paired yet" if not paired
- [ ] Shows correct number of paired clients
- [ ] Loading state shows while fetching info
- [ ] Error state shows if bridge unavailable

### 3.3 Refresh Functionality
- [ ] "Refresh Info" button works
- [ ] Updates pairing info after refresh
- [ ] Shows loading state during refresh

---

## 4. Thermostat Accessory Tests

### 4.1 State Reading
- [ ] Thermostat accessory reads current temperature
- [ ] Thermostat accessory reads target temperature
- [ ] Thermostat accessory reads mode (Heat/Cool/Auto/Off)
- [ ] State updates every 30 seconds
- [ ] Values match bridge API (`/api/status`)

**Test:**
```bash
# Check bridge API
curl "http://localhost:8080/api/status?device_id=<device_id>"

# Verify HomeKit bridge has same values (check logs)
```

### 4.2 Temperature Control
- [ ] Setting target temperature in HomeKit updates Ecobee
- [ ] Temperature changes are reflected in bridge API
- [ ] Temperature values are in correct units (Celsius)
- [ ] Changes persist after restart

**Test via HomeKit app:**
1. Change target temperature
2. Verify change in bridge API:
   ```bash
   curl "http://localhost:8080/api/status?device_id=<device_id>"
   ```
3. Verify change on Ecobee thermostat

### 4.3 Mode Control
- [ ] Setting mode (Heat/Cool/Auto/Off) in HomeKit updates Ecobee
- [ ] Mode changes are reflected in bridge API
- [ ] Mode values map correctly (0=Off, 1=Heat, 2=Cool, 3=Auto)

**Test via HomeKit app:**
1. Change mode
2. Verify in bridge API
3. Verify on Ecobee thermostat

### 4.4 State Synchronization
- [ ] Changes from Ecobee appear in HomeKit
- [ ] Changes from HomeKit appear on Ecobee
- [ ] No state conflicts or loops
- [ ] Updates happen within 30 seconds

---

## 5. Air Purifier Accessory Tests

### 5.1 State Reading
- [ ] Air Purifier reads fan speed (0-3)
- [ ] Air Purifier reads on/off state
- [ ] State updates every 30 seconds
- [ ] Values match Blueair API (`/api/blueair/status`)

**Test:**
```bash
# Check Blueair API
curl "http://localhost:8080/api/blueair/status?device_index=0"

# Verify HomeKit bridge has same values
```

### 5.2 On/Off Control
- [ ] Turning on in HomeKit starts Blueair fan
- [ ] Turning off in HomeKit stops Blueair fan
- [ ] State changes are reflected in Blueair API
- [ ] Changes persist

**Test via HomeKit app:**
1. Turn air purifier on/off
2. Verify in Blueair API:
   ```bash
   curl "http://localhost:8080/api/blueair/status?device_index=0"
   ```
3. Verify on Blueair device

### 5.3 Speed Control
- [ ] Setting speed in HomeKit updates Blueair
- [ ] Speed mapping works correctly:
  - 0% = Off (speed 0)
  - 1-33% = Low (speed 1)
  - 34-66% = Medium (speed 2)
  - 67-100% = High (speed 3)
- [ ] Speed changes are reflected in Blueair API

**Test via HomeKit app:**
1. Change fan speed
2. Verify in Blueair API
3. Verify on Blueair device

### 5.4 State Synchronization
- [ ] Changes from Blueair appear in HomeKit
- [ ] Changes from HomeKit appear on Blueair
- [ ] No state conflicts

---

## 6. Pairing Tests

### 6.1 Initial Pairing
- [ ] QR code is scannable
- [ ] Pairing PIN code is correct
- [ ] Pairing succeeds with QR code
- [ ] Pairing succeeds with manual PIN entry
- [ ] Bridge appears in HomeKit app after pairing
- [ ] Accessories appear inside bridge

### 6.2 Pairing Persistence
- [ ] Pairing persists after bridge restart
- [ ] Pairing persists after system reboot
- [ ] Paired clients count is correct
- [ ] No need to re-pair after restart

**Test:**
1. Pair bridge with HomeKit app
2. Restart bridge server
3. Verify bridge still appears as paired
4. Verify accessories are still accessible

### 6.3 Multiple Clients
- [ ] Multiple HomeKit controllers can pair
- [ ] All paired clients can control accessories
- [ ] Paired clients count is accurate

---

## 7. Error Handling Tests

### 7.1 Network Errors
- [ ] Bridge handles network disconnection gracefully
- [ ] Bridge reconnects when network is restored
- [ ] Accessories show appropriate error states

### 7.2 API Errors
- [ ] Bridge handles Ecobee API errors gracefully
- [ ] Bridge handles Blueair API errors gracefully
- [ ] Errors are logged appropriately
- [ ] Bridge continues running after errors

### 7.3 Missing Dependencies
- [ ] Bridge handles missing HAP-python gracefully
- [ ] Bridge handles missing Ecobee pairing gracefully
- [ ] Bridge handles missing Blueair gracefully
- [ ] Appropriate warnings are logged

---

## 8. Performance Tests

### 8.1 Response Times
- [ ] State updates happen within 30 seconds
- [ ] Control commands execute within 5 seconds
- [ ] API endpoints respond quickly (< 1 second)

### 8.2 Resource Usage
- [ ] Bridge doesn't consume excessive CPU
- [ ] Bridge doesn't consume excessive memory
- [ ] Multiple accessories don't cause performance issues

### 8.3 Concurrent Operations
- [ ] Multiple HomeKit controllers can control simultaneously
- [ ] Multiple accessories can be controlled simultaneously
- [ ] No race conditions or conflicts

---

## 9. Integration Tests

### 9.1 Bridge + HTTP API
- [ ] Both servers run simultaneously
- [ ] No port conflicts
- [ ] Both APIs work independently
- [ ] Shared state is consistent

### 9.2 Bridge + Ecobee
- [ ] Bridge controls Ecobee correctly
- [ ] Ecobee changes appear in bridge
- [ ] No conflicts between controllers

### 9.3 Bridge + Blueair
- [ ] Bridge controls Blueair correctly
- [ ] Blueair changes appear in bridge
- [ ] No conflicts

---

## 10. Systemd Service Tests

### 10.1 Auto-Start
- [ ] Service starts automatically on boot
- [ ] HomeKit bridge starts with service
- [ ] HTTP API starts with service
- [ ] All accessories are created on startup

**Test:**
```bash
# Reboot system
sudo reboot

# After reboot, check service
sudo systemctl status prostat-bridge

# Check logs
sudo journalctl -u prostat-bridge -n 50 | grep -i "homekit"
```

### 10.2 Service Restart
- [ ] Service restarts correctly
- [ ] Pairings persist after restart
- [ ] Accessories are recreated after restart
- [ ] No errors on restart

**Test:**
```bash
sudo systemctl restart prostat-bridge
sudo journalctl -u prostat-bridge -f
```

### 10.3 Service Stop/Start
- [ ] Service stops gracefully
- [ ] Service starts correctly
- [ ] No orphaned processes
- [ ] Ports are released on stop

---

## 11. Edge Cases

### 11.1 No Paired Devices
- [ ] Bridge starts without Ecobee paired
- [ ] Bridge shows no accessories
- [ ] Pairing info still available
- [ ] No errors in logs

### 11.2 No Blueair
- [ ] Bridge starts without Blueair
- [ ] Only Thermostat accessory appears
- [ ] No errors in logs

### 11.3 Both Devices Available
- [ ] Both Thermostat and Air Purifier appear
- [ ] Both can be controlled independently
- [ ] No conflicts

### 11.4 Rapid State Changes
- [ ] Rapid temperature changes don't cause issues
- [ ] Rapid mode changes don't cause issues
- [ ] Rapid fan speed changes don't cause issues
- [ ] State remains consistent

---

## 12. Documentation Tests

### 12.1 Code Documentation
- [ ] All functions have docstrings
- [ ] Complex logic is commented
- [ ] API endpoints are documented

### 12.2 User Documentation
- [ ] Pairing instructions are clear
- [ ] Troubleshooting guide is helpful
- [ ] API documentation is accurate

---

## Test Results Summary

### Pass/Fail Tracking
- Total Tests: ___
- Passed: ___
- Failed: ___
- Skipped: ___

### Critical Issues
- [ ] List any critical issues found

### Minor Issues
- [ ] List any minor issues found

### Notes
- [ ] Additional observations or recommendations

---

## Quick Test Commands

```bash
# Check bridge is running
curl http://localhost:8080/health

# Get pairing info
curl http://localhost:8080/api/homekit-bridge/pairing-info

# Check thermostat status
curl "http://localhost:8080/api/status?device_id=<device_id>"

# Check Blueair status
curl "http://localhost:8080/api/blueair/status?device_index=0"

# Check service status
sudo systemctl status prostat-bridge

# View logs
sudo journalctl -u prostat-bridge -f

# Check ports
sudo netstat -tlnp | grep -E "8080|51826"
```

---

## Testing Tips

1. **Use HomeKit Test Apps:**
   - Apple Home app (if available)
   - Eve for HomeKit (shows more details)
   - Home+ (advanced control)

2. **Monitor Logs:**
   - Keep `journalctl -u prostat-bridge -f` running during tests
   - Look for errors, warnings, or unexpected behavior

3. **Test Incrementally:**
   - Start with basic functionality
   - Add complexity gradually
   - Test each accessory separately

4. **Verify State Consistency:**
   - Check bridge API
   - Check HomeKit app
   - Check physical devices
   - All should match

5. **Test Failure Scenarios:**
   - Disconnect network
   - Stop services
   - Unpair devices
   - Verify graceful handling






