# Blueair Air Purifier Integration

## Overview

ProStat Bridge integrates with Blueair air purifiers to create a complete "life-support system" for your home:

- **Temperature**: Controlled by Ecobee (HomeKit)
- **Humidity**: Controlled by Dehumidifier (Relay)
- **Air Purity**: Controlled by Blueair (Cloud API)

## Why Integrate Blueair?

**Interlock Logic** - Coordinate air purifier with HVAC system for optimal air quality:

1. **Dust Kicker Cycle**: HVAC fan stirs up dust → Blueair catches it
2. **Noise Cancellation Mode**: Quiet when occupied, turbo when empty
3. **Coordinated Operation**: All systems work together intelligently

## Setup

### 1. Install Blueair API Library

On your Raspberry Pi:

```bash
cd prostat-bridge
pip install blueair-api
```

Or add to `requirements.txt` (already included).

### 2. Set Credentials

Set environment variables:

```bash
export BLUEAIR_USERNAME="your-email@example.com"
export BLUEAIR_PASSWORD="your-password"
```

Or add to systemd service file:

```ini
[Service]
Environment="BLUEAIR_USERNAME=your-email@example.com"
Environment="BLUEAIR_PASSWORD=your-password"
```

### 3. Restart Service

```bash
sudo systemctl restart prostat-bridge
```

Check logs to verify connection:

```bash
sudo journalctl -u prostat-bridge -f
```

You should see:

```
Blueair connected: 1 device(s) found
```

## Interlock Logic

### Dust Kicker Cycle

**Purpose**: Remove dust from floors and surfaces

**How it works:**

1. HVAC Fan turns ON (stirs up dust from floor)
2. Wait 30 seconds (let dust circulate)
3. Blueair set to MAX speed (catches circulating dust)
4. Run for 10 minutes
5. Both set to "Silent" mode

**Trigger manually:**

```bash
curl -X POST http://localhost:8080/api/blueair/dust-kicker
```

Or from web app: Click the 🧹 button in Air Purifier section.

### Noise Cancellation Mode

**Purpose**: Quiet when you're home, turbo when you're away

**How it works:**

- **Occupancy detected** (via Ecobee motion sensor):
  - LEDs: OFF
  - Fan: LOW (Whisper mode)
- **No occupancy**:
  - Fan: MAX (Turbo mode - scrub air while gone)

**Automatic**: Updates when system state changes (occupancy detected/cleared).

## API Endpoints

### Get Blueair Status

```
GET /api/blueair/status?device_index=0
```

Returns:

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

### Control Fan Speed

```
POST /api/blueair/fan
Body: {
  "device_index": 0,
  "speed": 3  // 0=off, 1=low, 2=medium, 3=max
}
```

### Control LED Brightness

```
POST /api/blueair/led
Body: {
  "device_index": 0,
  "brightness": 0  // 0-100 (0=off)
}
```

### Start Dust Kicker Cycle

```
POST /api/blueair/dust-kicker
```

## Web App Integration

The web app automatically detects and displays Blueair status when:

- ProStat Bridge is connected
- Blueair credentials are configured
- At least one device is found

**Features:**

- Real-time fan speed display
- LED brightness display
- Quick controls (Low, Max)
- Dust Kicker cycle button

## Fan Speed Levels

| Speed | Level  | Use Case                             |
| ----- | ------ | ------------------------------------ |
| 0     | Off    | System off                           |
| 1     | Low    | Whisper mode (occupied)              |
| 2     | Medium | Normal operation                     |
| 3     | Max    | Turbo mode (unoccupied, dust kicker) |

## Troubleshooting

### Blueair Not Connecting

**Symptoms**: Web app shows "Not Connected"

**Solutions:**

- Verify credentials: `echo $BLUEAIR_USERNAME`
- Check service logs: `journalctl -u prostat-bridge -f`
- Test API directly: `python3 -c "from blueair_api import get_blueair_account; import asyncio; asyncio.run(get_blueair_account('user', 'pass'))"`
- Verify internet connection (Blueair uses cloud API)

### Dust Kicker Not Working

**Symptoms**: Cycle starts but doesn't complete

**Solutions:**

- Check logs for errors: `journalctl -u prostat-bridge -f`
- Verify Blueair is connected: `curl http://localhost:8080/api/blueair/status`
- Check HVAC fan control (may need Ecobee integration)

### Noise Cancellation Not Activating

**Symptoms**: Mode doesn't change with occupancy

**Solutions:**

- Verify occupancy is being updated: Check system state
- Check Ecobee motion sensor is working
- Manually trigger evaluation: `curl -X POST http://localhost:8080/api/interlock/evaluate`

## Advanced: Custom Interlock Rules

You can extend the interlock logic in `server.py`:

```python
async def custom_interlock_rule():
    # Your custom logic here
    if some_condition:
        await control_blueair_fan(0, 3)
```

## Security Notes

- Blueair credentials are stored as environment variables (not in code)
- All communication goes through Blueair's cloud API (AWS)
- No local network access required for Blueair
- Consider using a dedicated Blueair account (not your personal one)

## Next Steps

1. ✅ Set up Blueair credentials
2. ✅ Test basic fan/LED control
3. ✅ Test Dust Kicker cycle
4. ✅ Configure occupancy detection (Ecobee motion sensor)
5. ✅ Monitor and fine-tune interlock rules

## Complete System Architecture

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│  Ecobee     │────────▶│  ProStat Pi  │────────▶│  Blueair     │
│  (HomeKit)  │  WiFi   │  (HAP +     │  Cloud  │  (Cloud API) │
│             │         │   Relay +   │  API    │              │
│             │         │   Blueair)  │         │              │
└─────────────┘         └──────────────┘         └──────────────┘
     Temperature              Brain                  Air Purity
```

**The Complete Life-Support System:**

- 🌡️ **Temperature**: Ecobee (HomeKit)
- 💧 **Humidity**: Dehumidifier (Relay)
- 🌬️ **Purity**: Blueair (Cloud API)

All coordinated by ProStat Bridge with intelligent interlock logic.
