# Asthma Shield BMS - Setup Guide

## Overview

The Asthma Shield is a complete, closed-loop Building Management System (BMS) that intelligently coordinates:

- **Ecobee Thermostat**: Temperature, humidity, motion (occupancy), HVAC control
- **Blueair Air Purifier**: PM2.5, tVOC monitoring and filtration control
- **Dehumidifier Relay**: Humidity-based mold prevention

All running on a $25 Raspberry Pi 3.

## System Architecture

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│  Ecobee     │────────▶│  Raspberry   │────────▶│  Blueair     │
│  (HomeKit)  │  WiFi   │  Pi 3        │  Cloud │  (Cloud API) │
│             │         │  (Brain)     │  API   │              │
│             │         │              │        │              │
└─────────────┘         └──────────────┘         └──────────────┘
     Sensors                  Logic                  Sensors
     Actuators                                        Actuators
                              │
                              ▼
                       ┌──────────────┐
                       │  CH340 Relay │
                       │  (Hardware)  │
                       └──────────────┘
                            Dehumidifier
```

## Installation

### 1. Install Dependencies

```bash
cd prostat-bridge
pip install -r requirements.txt
pip install blueair-api
```

### 2. Configure Environment Variables

Edit `asthma-shield.service` or set environment variables:

```bash
export ECOBEE_DEVICE_ID="XX:XX:XX:XX:XX:XX"  # Your Ecobee device ID
export BLUEAIR_USERNAME="your-email@example.com"
export BLUEAIR_PASSWORD="your-password"
```

### 3. Pair Ecobee (if not already paired)

First, pair your Ecobee with the HomeKit controller:

```bash
python3 -c "
from aiohomekit.controller import Controller
import asyncio

async def pair():
    controller = Controller()
    await controller.async_start()
    devices = await controller.async_discover()
    for d in devices:
        print(f'{d.device_id}: {d.description.get(\"name\")}')

asyncio.run(pair())
"
```

Then pair using the 8-digit code from your Ecobee:

```bash
python3 -c "
from aiohomekit.controller import Controller
import asyncio

async def pair():
    controller = Controller()
    await controller.async_start()
    pairing = await controller.async_pair('XX:XX:XX:XX:XX:XX', '12345678')
    print('Paired!')

asyncio.run(pair())
"
```

### 4. Install as Systemd Service

```bash
sudo cp asthma-shield.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable asthma-shield
sudo systemctl start asthma-shield
```

### 5. Monitor Logs

```bash
sudo journalctl -u asthma-shield -f
```

## The "Asthma Shield" Logic

### 1. Air Quality Threat Level (PM2.5)

**High Threat (PM2.5 > 10 µg/m³):**

- Blueair: **Max speed** (3)
- Ecobee Fan: **ON** (circulate air to filter)
- Action: "Dust detected. Engage scrubbers."

**Medium Threat (PM2.5 > 5 µg/m³ + Occupied):**

- Blueair: **Medium speed** (2)
- Action: "Minor dust, but people are here. Be polite."

**Low Threat (Otherwise):**

- Blueair: **Low/Silent** (1)
- Action: "Air is clean. Save energy/noise."

### 2. Humidity Threat Level (Mold Prevention)

**High Humidity (> 55%):**

- Dehumidifier: **ON**
- Action: "Mold risk. Dry it out."

**Low Humidity (< 45%):**

- Dehumidifier: **OFF**
- Action: "Too dry. Stop drying."

**Normal (45-55%):**

- Maintain current state (hysteresis)

### 3. Circulation Kick (The Clean Bubble Fix)

**Every Hour (at minute 0):**

- If PM2.5 < 2 µg/m³ (we think it's clean)
- Turn on Ecobee fan for 5 minutes
- Action: "Stir the pot" to verify air quality

## Configuration

Edit thresholds in `asthma_shield.py`:

```python
# Air Quality Thresholds
PM25_THRESHOLD_HIGH = 10  # µg/m³
PM25_THRESHOLD_MEDIUM = 5  # µg/m³

# Humidity Thresholds
HUMIDITY_HIGH = 55  # %
HUMIDITY_LOW = 45  # %

# Circulation Kick
CIRCULATION_KICK_INTERVAL = 60  # minutes
CIRCULATION_KICK_PM25_THRESHOLD = 2  # µg/m³

# Polling Interval
MAIN_LOOP_INTERVAL = 60  # seconds
```

## Troubleshooting

### Blueair Not Connecting

**Symptoms:** "Blueair not connected" in logs

**Solutions:**

- Verify credentials: `echo $BLUEAIR_USERNAME`
- Test API: `python3 -c "from blueair_api import get_blueair_account; import asyncio; asyncio.run(get_blueair_account('user', 'pass'))"`
- Check internet connection (Blueair uses cloud API)

### Ecobee Not Responding

**Symptoms:** "Ecobee not connected" in logs

**Solutions:**

- Verify device ID: `echo $ECOBEE_DEVICE_ID`
- Check pairing: `python3 -c "from aiohomekit.controller import Controller; import asyncio; c = Controller(); asyncio.run(c.async_start()); print(asyncio.run(c.async_load_pairing('XX:XX:XX:XX:XX:XX')))"`
- Ensure Ecobee is on the same network

### Relay Not Working

**Symptoms:** "Relay not connected" in logs

**Solutions:**

- Check USB connection: `lsusb | grep CH340`
- Verify port: `ls /dev/ttyUSB*` or `ls /dev/ttyACM*`
- Check permissions: `sudo usermod -a -G dialout pi`

### PM2.5 Reading Unavailable

**Symptoms:** "PM2.5 reading unavailable" in logs

**Solutions:**

- Verify Blueair device has PM2.5 sensor (some models don't)
- Check blueair-api library version and methods
- May need to adjust `get_blueair_pm25()` function based on your device

## Manual Testing

### Test Blueair Control

```python
python3 -c "
from blueair_api import get_blueair_account
import asyncio

async def test():
    account = await get_blueair_account('user', 'pass')
    device = account.devices[0]
    await device.set_fan_speed(3)
    print('Max speed set!')

asyncio.run(test())
"
```

### Test Relay Control

```python
import serial
port = serial.Serial('/dev/ttyUSB0', 9600)
port.write(b'AT+ON2\r\n')  # Turn on relay 2
port.write(b'AT+OFF2\r\n')  # Turn off relay 2
```

### Test Ecobee Control

```python
python3 -c "
from aiohomekit.controller import Controller
import asyncio

async def test():
    c = Controller()
    await c.async_start()
    pairing = await c.async_load_pairing('XX:XX:XX:XX:XX:XX')
    data = await pairing.async_get_characteristics([(1, 10)])
    print(f'Temperature: {data[(1, 10)][\"value\"]}')

asyncio.run(test())
"
```

## Integration with ProStat Bridge

The Asthma Shield can run alongside the ProStat Bridge service:

- **ProStat Bridge** (`server.py`): REST API for web app
- **Asthma Shield** (`asthma_shield.py`): Autonomous BMS logic

Both can share the same:

- Ecobee pairing
- Blueair connection
- Relay hardware

Run both services:

```bash
sudo systemctl start prostat-bridge
sudo systemctl start asthma-shield
```

## Next Steps

1. ✅ Install dependencies
2. ✅ Configure environment variables
3. ✅ Pair Ecobee
4. ✅ Test each component individually
5. ✅ Start service and monitor logs
6. ✅ Fine-tune thresholds based on your environment
7. ✅ Enjoy clean, healthy air! 🌬️

## Support

For issues or questions:

- Check logs: `sudo journalctl -u asthma-shield -f`
- Review configuration in `asthma_shield.py`
- Verify all components are connected and working

---

**The Asthma Shield: Your $25 Raspberry Pi 3 is now a complete Building Management System.**
