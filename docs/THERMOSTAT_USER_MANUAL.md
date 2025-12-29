# Thermostat User Manual (Developer Edition)

This manual explains how to run the thermostat tools, enable optional hardware feedback safely, and test short‑cycle behavior during development. It consolidates app usage and all hardware setup options (BlinkStick, USB‑Serial LED, USB relay, Arduino).

> Audience: Developers working on this repository in a lab/dev environment on Windows. Do not use any of these development servers or harnesses in production.

---

## Safety First

- Never connect your laptop directly to mains power or any unknown/high‑voltage circuit.
- For any physical control testing, use only:
  - BlinkStick (USB LED indicator), or
  - LED + resistor on USB‑Serial control line (RTS/DTR), or
  - A USB relay switching a safe low‑voltage circuit (e.g., 24 VAC control), or
  - An Arduino/USB relay with isolation.
- Treat `RELAY_ENABLED` as a dev‑only feature. Keep the relay server local and locked behind `RELAY_SECRET`.
- Respect compressor minimum off‑time (short‑cycle protection) when emulating thermostat calls for cooling.

---

## System Overview

- Frontend: React app with a Short‑Cycle Test UI (component `src/components/ShortCycleTest.jsx`).
- Hardware bridge (optional): `scripts/relay-server.js` — local Node server exposing `POST /api/relay/toggle`.
- Drivers (select via `RELAY_DRIVER`):
  - `blinkstick` (USB LED via HID; no COM port)
  - `rtctl` (USB‑Serial control line RTS/DTR; LED on breadboard)
  - `arduino` (default; sends ASCII `RELAY <index> ON|OFF` over COM)
  - (Future) vendor USB relay drivers

App → Relay Server → Selected Driver → Hardware LED/Relay

---

## Quick Start (No Wiring): BlinkStick USB LED

BlinkStick gives an immediate visual indicator for hardware toggles.

### Requirements

- BlinkStick device (Nano, Stick, or Pro)
- Node dependency: `blinkstick`

### Install dependency

```powershell
npm i blinkstick
```

### Start relay server (BlinkStick mode)

```powershell
$env:RELAY_ENABLED = 'true'
$env:RELAY_SECRET  = 'abc123'
$env:RELAY_DRIVER  = 'blinkstick'
node scripts/relay-server.js
```

Expected log:

```
Relay server listening on http://localhost:3005 ... RELAY_DRIVER=blinkstick
```

### Smoke test

```powershell
curl -X POST http://localhost:3005/api/relay/toggle -H "Content-Type: application/json" -d '{"index":0,"on":true,"secret":"abc123"}'
Start-Sleep -Milliseconds 500
curl -X POST http://localhost:3005/api/relay/toggle -H "Content-Type: application/json" -d '{"index":0,"on":false,"secret":"abc123"}'
```

LED should turn on (green) then off.

---

## Quick Start (Cheap LED): USB‑Serial Adapter + LED (RTS/DTR)

Drive an LED from a USB‑Serial adapter’s control line. No microcontroller required.

### Hardware

- USB‑Serial adapter (FT232RL or CH340 recommended)
- 1× LED (3–5 mm) and 1× 330 Ω resistor
- Breadboard + jumpers

### Wiring

- LED anode (+) → 330 Ω resistor → adapter `RTS` (or `DTR`)
- LED cathode (–) → adapter `GND`

### Find COM port (Windows)

```powershell
[System.IO.Ports.SerialPort]::GetPortNames()
```

### Start relay server (RTS/DTR mode)

```powershell
$env:RELAY_ENABLED = 'true'
$env:RELAY_SECRET  = 'abc123'
$env:RELAY_PORT    = 'COM5'        # replace with your port
$env:RELAY_DRIVER  = 'rtctl'
$env:RELAY_CONTROL_LINE = 'RTS'     # or 'DTR' if you wired DTR
node scripts/relay-server.js
```

### Smoke test

```powershell
curl -X POST http://localhost:3005/api/relay/toggle -H "Content-Type: application/json" -d '{"index":0,"on":true,"secret":"abc123"}'
Start-Sleep -Milliseconds 500
curl -X POST http://localhost:3005/api/relay/toggle -H "Content-Type: application/json" -d '{"index":0,"on":false,"secret":"abc123"}'
```

LED should turn on then off. The `index` is ignored in `rtctl` mode.

---

## Quick Start (Arduino)

Use an Arduino sketch that toggles pins on ASCII commands.

### Hardware

- Arduino with USB
- Relay module(s) or LEDs (low‑voltage test rig)

### Load sketch

- Open `scripts/arduino-relay.ino` in the Arduino IDE and upload.

### Start relay server (Arduino mode)

```powershell
$env:RELAY_ENABLED = 'true'
$env:RELAY_SECRET  = 'abc123'
$env:RELAY_PORT    = 'COM3'        # your Arduino port
$env:RELAY_DRIVER  = 'arduino'     # default
$env:RELAY_BAUD    = '9600'
node scripts/relay-server.js
```

### Smoke test

```powershell
curl -X POST http://localhost:3005/api/relay/toggle -H "Content-Type: application/json" -d '{"index":0,"on":true,"secret":"abc123"}'
```

The sketch should toggle the configured output for `index = 0`.

---

## App Usage: Short‑Cycle Test

1. Start the app
   ```powershell
   npm run dev
   ```
2. Open the Short‑Cycle Test view in the UI.
3. Enable hardware mode (dev‑only):
   - Set `relayServerUrl` to `http://localhost:3005`.
   - Enter the `relaySecret` you set above (e.g., `abc123`).
   - Type `ENABLE-HARDWARE` in the confirmation box.
4. Trigger a hardware action
   - Click "Attempt Now" to send a toggle request.
   - If the server is configured in BlinkStick mode, the LED lights (on), then turn it off with a second click or a curl call.
5. Respect short‑cycle protection
   - Cooling (compressor) calls require a minimum off‑time before the next start. The test enforces this to avoid rapid cycling.

---

## Relay Server Configuration

Environment variables (PowerShell):

- `RELAY_ENABLED`: `'true'` to enable server
- `RELAY_SECRET`: shared secret required by the client
- `RELAY_DRIVER`: one of `blinkstick`, `rtctl`, `arduino`
- `RELAY_PORT`: required for `rtctl` and `arduino` (e.g., `COM5`)
- `RELAY_BAUD`: serial baud for `arduino` (default `9600`)
- `RELAY_CONTROL_LINE`: `RTS` or `DTR` for `rtctl`

Endpoint:

- `POST /api/relay/toggle` with JSON body `{ index: number, on: boolean, secret: string }`

---

## Thermostat Control Basics (Reference)

- 24 VAC control circuit supplies `R` (hot) and `C` (common).
- Calls are normally open (NO); thermostat closes `R` to a function terminal during a call:
  - Heat: `R→W`
  - Cool/Compressor: `R→Y` (energizes a normally open contactor coil)
  - Fan: `R→G`
  - Reversing valve (heat pumps): `O/B` energized as configured
- For real equipment testing, use dry‑contact relays and isolation. Do not connect control circuits to your laptop ground.

---

## Troubleshooting

- BlinkStick not found
  - Ensure `npm i blinkstick` was run; re‑plug device; restart the server.
- Serial port not ready
  - Using `rtctl`/`arduino`: verify `RELAY_PORT` and that the device is present; check `[System.IO.Ports.SerialPort]::GetPortNames()`.
- UI shows invalid secret or no response
  - Verify `relayServerUrl`, `relaySecret`, and that the server window is running.
- LED stays on
  - Send a second `on: false` call or click again if the UI toggles off.
- Permissions / ports
  - Keep server on `localhost`; avoid running with elevated privileges; ensure nothing else binds port `3005`.

---

## FAQ

- Do I need an Arduino?
  - No. BlinkStick or USB‑Serial (RTS/DTR) LED options provide safe visual confirmation without microcontrollers.
- Can I switch actual 24 VAC thermostat calls?
  - Yes, with an isolated relay and proper wiring. Use NO contacts to route `R` to `W/Y/G` during a call. Observe safety and isolation.
- Why is there a safety confirmation in the UI?
  - To prevent accidental hardware toggling during development.

---

## Related Docs

- `docs/relay-setup.md` — setup and safety guide
- `scripts/relay-server.js` — relay bridge server
- `scripts/arduino-relay.ino` — Arduino example sketch
- `src/components/ShortCycleTest.jsx` — UI integration

---

## Support

Open an issue with:

- Driver (`RELAY_DRIVER`) and environment vars
- Device type (BlinkStick model, adapter model, Arduino board)
- Logs from the relay server window
- Steps to reproduce
