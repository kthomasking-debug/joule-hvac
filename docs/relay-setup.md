# Relay Setup & Safety Guide

## Overview

This project provides a development-safe gate for triggering a relay connected to a USB relay board or Arduino via a small, local Node.js server. Use this only in a safe lab environment — toggling relays can switch mains/24VAC and cause hardware damage if incorrectly wired.

## Components

- `scripts/relay-server.js` — simple Express server that exposes POST `/api/relay/toggle` and writes `RELAY <index> ON|OFF` over serial to the configured port.
- `scripts/arduino-relay.ino` — example Arduino sketch that listens for `RELAY <index> ON|OFF` and toggles pins.
- `src/components/ShortCycleTest.jsx` — adds dev-only UI to enable/disable hardware relay mode and enter a `relayServerUrl` and `relaySecret` to confirm actions.

### New: Arduino-free USB LED option

If you only need a visible indicator and want to skip Arduino entirely, the server supports an RTS/DTR control-line driver that lights an LED from a USB‑serial adapter. Set `RELAY_DRIVER=rtctl` and wire an LED to the adapter’s `RTS` (or `DTR`) pin and `GND`.

It also supports BlinkStick USB LEDs (`RELAY_DRIVER=blinkstick`) with no wiring required.

## Security & Safety

By default the server rejects toggling unless both these environment variables are set:

- `RELAY_ENABLED=true` — enables the server.
- `RELAY_SECRET=xxxx` — secret token required for requests.

Start the relay server (development only):

```powershell
$env:RELAY_ENABLED = 'true'; $env:RELAY_SECRET='abc123'; $env:RELAY_PORT='COM3'; node scripts/relay-server.js
```

**Do NOT enable `RELAY_ENABLED` on public servers or production builds.** Keep the server local to your lab machine when manipulating relays.

## Using the Arduino

1. Load `scripts/arduino-relay.ino` to an Arduino or USB serial-equipped microcontroller.
2. Wire relays to the Arduino pins noted in the sketch. Use double relays or opto-isolation to isolate the laptop from mains or 24VAC.

## Development best practices

- Always validate the `relayServerUrl` points to a host you control (e.g., `http://localhost:3005`).
- Never use real AC hardware in CI builds; use the shortcut `protectMsOverride` prop for short testing durations without risk.
- The UI requires typing `ENABLE-HARDWARE` to confirm hardware toggling to prevent accidents.

## Quick curl example

Toggle relay index 0 ON from the command line (if the server is running):

```powershell
curl -X POST http://localhost:3005/api/relay/toggle -H "Content-Type: application/json" -d '{"index":0, "on": true, "secret":"abc123"}'
```

## Troubleshooting

- If you see `SerialPort` errors, verify `RELAY_PORT` (e.g., `COM3` or `/dev/ttyUSB0`).
- If the client shows 'serial port not ready', ensure the server is running and `RELAY_ENABLED` is `true`.

---

## Arduino-free USB‑Serial LED (RTS/DTR)

This option uses a USB‑to‑TTL serial adapter’s control line (RTS or DTR) to drive a plain LED. No microcontroller or sketch required.

### What to buy

- USB‑Serial adapter: FT232RL or CH340‑based (Windows compatible)
- 1× LED (3–5 mm)
- 1× resistor (330 Ω)
- Mini breadboard + a few male‑female jumpers

### Wiring

- LED anode (+) → series 330 Ω resistor → adapter `RTS` (or `DTR`) pin
- LED cathode (–) → adapter `GND`

Most FT232/CH340 breakouts label pins; consult the adapter’s pinout for `RTS`/`DTR` and `GND`.

### Find your COM port (Windows)

```powershell
[System.IO.Ports.SerialPort]::GetPortNames()
```

### Start the server in RTS/DTR mode

```powershell
$env:RELAY_ENABLED = 'true'
$env:RELAY_SECRET = 'abc123'
$env:RELAY_PORT = 'COM5'        # replace with your COM port
$env:RELAY_DRIVER = 'rtctl'     # use control-line driver
$env:RELAY_CONTROL_LINE = 'RTS' # or 'DTR' if you wired DTR
node scripts/relay-server.js
```

You should see a log like:

```
Relay server listening on http://localhost:3005 RELAY_ENABLED=true RELAY_PORT=COM5 RELAY_DRIVER=rtctl RELAY_CONTROL_LINE=RTS
```

### Test the LED from a terminal

```powershell
curl -X POST http://localhost:3005/api/relay/toggle -H "Content-Type: application/json" -d '{"index":0, "on": true,  "secret":"abc123"}'
Start-Sleep -Milliseconds 800
curl -X POST http://localhost:3005/api/relay/toggle -H "Content-Type: application/json" -d '{"index":0, "on": false, "secret":"abc123"}'
```

The LED should turn on, then off. The `index` is ignored in `rtctl` mode; the `on` flag maps to the chosen control line HIGH/LOW.

### Use from the app UI

- In `ShortCycleTest`, enable hardware mode, set `relayServerUrl` to `http://localhost:3005`, set the same secret, type `ENABLE-HARDWARE`, then click "Attempt Now" to trigger the LED.

### Notes

- Keep this to LED/low‑voltage only; do not drive coils or loads directly from RTS/DTR.
- If the LED is inverted, try switching to `RELAY_CONTROL_LINE='DTR'` or flipping LED polarity.

---

## BlinkStick USB LED

This option uses a BlinkStick RGB USB LED. No wiring is required; control happens over USB HID.

### What to buy

- BlinkStick (e.g., BlinkStick Nano/Stick/Pro)

### Install the Node library

```powershell
npm i blinkstick
```

### Start the server in BlinkStick mode

```powershell
$env:RELAY_ENABLED = 'true'
$env:RELAY_SECRET = 'abc123'
$env:RELAY_DRIVER = 'blinkstick'  # HID device, no COM port required
node scripts/relay-server.js
```

You should see a log like:

```
Relay server listening on http://localhost:3005 RELAY_ENABLED=true RELAY_PORT=null RELAY_DRIVER=blinkstick RELAY_CONTROL_LINE=RTS
```

### Test from terminal

```powershell
curl -X POST http://localhost:3005/api/relay/toggle -H "Content-Type: application/json" -d '{"index":0, "on": true,  "secret":"abc123"}'
Start-Sleep -Milliseconds 800
curl -X POST http://localhost:3005/api/relay/toggle -H "Content-Type: application/json" -d '{"index":0, "on": false, "secret":"abc123"}'
```

Your BlinkStick should turn on (green), then turn off.

### Use from the app UI

- In `ShortCycleTest`, enable hardware mode, set `relayServerUrl` to `http://localhost:3005`, enter the same secret, type `ENABLE-HARDWARE`, then click "Attempt Now" to flash the BlinkStick.

### Troubleshooting

- If you see `blinkstick module not installed`, run `npm i blinkstick` in the project root.
- If no device is found, ensure the BlinkStick is firmly plugged in; try a direct USB port.

---

## DS18B20 USB Temperature Sensor

This option adds real-time temperature monitoring to enable true thermostat functionality. The DS18B20 USB thermometer provides accurate temperature readings via a simple USB interface.

### What to buy

**Recommended: DS18B20 USB Thermometer Adapter**

- Look for "USB Thermometer" or "USB Temperature Sensor DS18B20"
- Common vendors: usbtemp.com, Amazon, eBay
- Cost: ~$15 - $25
- Shows up as a serial device (COM port on Windows)

**Why this is the best choice:**

- Plug-and-play USB device (no wiring required)
- Reliable serial interface, easy to read from Node.js
- No driver complexity (unlike USB-HID or custom protocols)
- Industrial-grade accuracy (±0.5°C)

### Install the Node library

```powershell
npm install usbtemp
```

### Find your temperature sensor

Plug in the DS18B20 USB device, then check available COM ports:

```powershell
[System.IO.Ports.SerialPort]::GetPortNames()
```

The DS18B20 device typically shows up as a new COM port (e.g., `COM6`).

### Enable temperature sensor support

Set the `TEMP_SENSOR_ENABLED` environment variable when starting the relay server:

```powershell
$env:RELAY_ENABLED = 'true'
$env:RELAY_SECRET = 'abc123'
$env:RELAY_PORT = 'COM3'           # your relay port (if using relays)
$env:TEMP_SENSOR_ENABLED = 'true'  # enable temperature sensor
node scripts/relay-server.js
```

You should see:

```
DS18B20 USB temperature sensor support enabled
Relay server listening on http://localhost:3005
  TEMP_SENSOR_ENABLED=true
```

### Test temperature reading

```powershell
curl http://localhost:3005/api/temperature
```

Response:

```json
{
  "ok": true,
  "temperatureC": 22.3,
  "temperatureF": 72.1,
  "timestamp": "2025-11-19T22:30:45.123Z"
}
```

### Auto Thermostat Mode

With temperature sensing enabled, the ShortCycleTest component can automatically control heating or cooling based on current temperature:

1. **Enable temperature sensor** as shown above
2. **In the app UI:**
   - Temperature will automatically display at the top of ShortCycleTest
   - Toggle "🤖 Auto Thermostat Mode" checkbox
   - Select mode: Heat (W terminal) or Cool (Y terminal)
   - Set target temperature (e.g., 70°F)
   - Set hysteresis (default 2°F) - prevents rapid cycling

**How it works:**

- **Heat mode**: Turns ON when `current < (target - hysteresis)`, OFF when `current > target`
- **Cool mode**: Turns ON when `current > (target + hysteresis)`, OFF when `current < target`
- Checks temperature every 5 seconds
- Respects short-cycle protection (5-minute default)

### Test thermostat logic manually

```powershell
curl -X POST http://localhost:3005/api/thermostat/control -H "Content-Type: application/json" -d '{
  "mode": "heat",
  "targetTemp": 70,
  "unit": "F",
  "hysteresis": 2
}'
```

Response:

```json
{
  "ok": true,
  "shouldBeOn": true,
  "currentTemp": 68.5,
  "targetTemp": 70,
  "unit": "F",
  "mode": "heat",
  "hysteresis": 2,
  "reason": "Current 68.5° < Target 70° - Hysteresis 2°",
  "timestamp": "2025-11-19T22:31:12.456Z"
}
```

### Troubleshooting

- **"Temperature sensor not enabled"**: Set `TEMP_SENSOR_ENABLED=true` when starting server
- **"usbtemp module not found"**: Run `npm install usbtemp`
- **"No temperature sensors found"**:
  - Verify DS18B20 USB device is plugged in
  - Check device manager for COM port
  - Try unplugging and replugging the device
  - Some devices require drivers - check manufacturer instructions
- **Temperature reading stuck or incorrect**:
  - Try a different USB port (direct, not hub)
  - Restart the relay server
  - Verify device is genuine DS18B20 (some clones have issues)

### Safety Notes

⚠️ **IMPORTANT**: Auto thermostat mode will physically toggle relays when hardware is enabled. Always:

- Test with LED indicators first (BlinkStick or USB-Serial LED)
- Verify wiring before connecting to HVAC equipment
- Use proper isolation (opto-couplers, relays rated for your voltage)
- Never exceed relay ratings
- Keep a manual override accessible
- Monitor initial auto mode sessions closely
