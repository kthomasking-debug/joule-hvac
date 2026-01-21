# CH340 8CH USB Relay Module Setup

## Overview

This guide covers setup for the **8CH USB Serial Port Relay Module with CH340 chip** - an excellent, affordable option for your Android tablet thermostat project.

## Module Specifications

- **Model:** DC 5V/12V/24V 8CH USB Serial Port Relay Module
- **Chip:** CH340 USB-to-Serial
- **Connector:** USB-B (female)
- **Relays:** 8 channels
- **Rating:** 10A @ 250VAC (perfect for HVAC 24VAC contactors)
- **Command Format:** AT commands or 8-byte binary
- **Cost:** ~$15-25

## Why This Module is Great

✅ **CH340 chip** - Well-supported on Android, Windows, Linux, Mac  
✅ **Very affordable** - Cheaper than SainSmart  
✅ **8 relays** - More than you need (W, Y, G), but future-proof  
✅ **AT commands** - Simple text commands, easy to debug  
✅ **Auto-recognition** - Supports both AT and binary commands

## Hardware Setup

### 1. USB Connection

**For Android Tablet:**

- USB-B to USB-C adapter (or USB-B to USB-A, then USB-A to USB-C OTG adapter)
- Connect USB-B end to relay module
- Connect USB-C end to tablet (via OTG adapter if needed)

**For Computer (testing):**

- Standard USB-A to USB-B cable (usually included with module)

### 2. Power Supply

The module needs external power:

- **DC 5V, 12V, or 24V** (check your module's jumper settings)
- **Option A: Use Furnace Transformer (Recommended!)**
  - Your furnace has a 24VAC transformer
  - Use a **24VAC to 24VDC converter** or **24VAC to 12VDC adapter**
  - Connect R and C wires from furnace to converter
  - Connect converter output to relay module power terminals
  - This powers both the relay module AND can charge the tablet!
- **Option B: Separate Power Supply**
  - Use a wall adapter or power supply (5V/12V/24V depending on module)
  - Connect to the module's power terminals
- **Important:** Module needs power even when connected via USB

### 3. Wiring to Furnace

Connect relay outputs to furnace terminals:

```
Relay Module          Furnace
-----------          -------
Relay 1 (NO)  ────→  W (Heat)
Relay 2 (NO)  ────→  Y (Cool)
Relay 3 (NO)  ────→  G (Fan)
Common (C)    ────→  C (24VAC return)
```

**Safety Notes:**

- Turn off furnace power before wiring
- Use proper wire gauge (18-22 AWG is fine for low voltage)
- Double-check connections before powering on

## Command Format

### AT Commands (Recommended)

The module supports AT commands for easy control:

**Turn relay ON:**

```
AT+ON1\r\n    (Turn on relay 1)
AT+ON2\r\n    (Turn on relay 2)
AT+ON3\r\n    (Turn on relay 3)
```

**Turn relay OFF:**

```
AT+OFF1\r\n   (Turn off relay 1)
AT+OFF2\r\n   (Turn off relay 2)
AT+OFF3\r\n   (Turn off relay 3)
```

**Note:** Relay numbers are **1-based** (1-8), not 0-based!

### 8-Byte Binary Commands

The module also supports 8-byte binary commands, but AT commands are easier to use and debug.

## Software Setup

### For Android Tablet (Web Serial API)

Your React app already supports this! Just use the `webSerialRelay.js` with `'at'` command format:

```javascript
import { getWebSerialRelay } from "../lib/webSerialRelay";

const relay = getWebSerialRelay();
await relay.connect();

// Turn on Heat (W terminal = relay 1)
await relay.toggleTerminal("W", true, "at");

// Turn on Cool (Y terminal = relay 2)
await relay.toggleTerminal("Y", true, "at");

// Turn on Fan (G terminal = relay 3)
await relay.toggleTerminal("G", true, "at");
```

### For Node.js Server (relay-server.js)

Update your `relay-server.js` to support AT commands:

```javascript
// Set environment variable:
// RELAY_DRIVER=at

// Or modify the code to detect CH340 modules and use AT format
```

**Quick fix for relay-server.js:**

Add this to the toggle handler:

```javascript
} else if (RELAY_DRIVER === "at") {
  // CH340 8CH relay module AT commands
  // Relay indices are 1-based: AT+ON1, AT+OFF1, etc.
  const relayNum = idx + 1; // Convert 0-based to 1-based
  const cmd = `AT+${onBool ? "ON" : "OFF"}${relayNum}\r\n`;
  port.write(cmd, (err) => {
    if (err) {
      return res.status(500).json({
        error: "Failed to write to USB relay",
        message: err.message,
      });
    }
    return res.json({ ok: true, index: idx, on: onBool, driver: "at" });
  });
}
```

## Testing

### 1. Test USB Connection

**On Android:**

- Connect module via USB OTG
- Open Chrome/Edge
- Go to: `chrome://device-log/` (if available)
- Or use a serial port tester app

**On Computer:**

- Windows: Check Device Manager → Ports (COM & LPT) → USB-SERIAL CH340
- Linux: `lsusb` should show CH340 device
- Mac: System Information → USB → CH340

### 2. Test AT Commands

**Using Serial Monitor (Arduino IDE or similar):**

- Open serial monitor
- Set baud rate: **9600** (default for most modules)
- Send: `AT+ON1` → Relay 1 should turn ON (LED indicator)
- Send: `AT+OFF1` → Relay 1 should turn OFF

**Using Web Serial API (in browser console):**

```javascript
const port = await navigator.serial.requestPort();
await port.open({ baudRate: 9600 });
const writer = port.writable.getWriter();
const encoder = new TextEncoder();

// Turn on relay 1
await writer.write(encoder.encode("AT+ON1\r\n"));

// Turn off relay 1
await writer.write(encoder.encode("AT+OFF1\r\n"));
```

### 3. Test with Your React App

1. Open your React app on the tablet
2. Navigate to ContactorDemo or ShortCycleTest
3. Click "Connect Relay"
4. Grant serial port permission
5. Toggle relays and verify furnace responds

## Troubleshooting

### Module Not Detected

- **Check USB connection:** Try different USB cable
- **Check power:** Module needs external power (5V/12V/24V)
- **Check drivers:** CH340 should auto-detect, but you can install drivers if needed
- **Check Android:** Enable USB OTG in settings

### Commands Not Working

- **Check baud rate:** Default is 9600, verify in module documentation
- **Check command format:** Must end with `\r\n` (carriage return + newline)
- **Check relay number:** AT commands use 1-based indexing (1-8), not 0-based
- **Check power:** Module must be powered externally

### Relay Doesn't Turn On

- **Check wiring:** Verify connections to relay NO (Normally Open) terminal
- **Check power:** Module needs external power supply
- **Check relay rating:** Ensure load doesn't exceed 10A @ 250VAC
- **Test with multimeter:** Verify relay contacts are closing

## Relay Mapping for HVAC

For your thermostat project, map relays to HVAC terminals:

| Relay | Terminal | Function | AT Command ON | AT Command OFF |
| ----- | -------- | -------- | ------------- | -------------- |
| 1     | W        | Heat     | `AT+ON1\r\n`  | `AT+OFF1\r\n`  |
| 2     | Y        | Cool     | `AT+ON2\r\n`  | `AT+OFF2\r\n`  |
| 3     | G        | Fan      | `AT+ON3\r\n`  | `AT+OFF3\r\n`  |

## Advanced Features

### Delay Commands

Some CH340 modules support delay:

```
AT+DELAY1,5000\r\n  (Relay 1, delay 5 seconds)
```

### All Relays On/Off

```
AT+ALLON\r\n   (Turn all relays on)
AT+ALLOFF\r\n  (Turn all relays off)
```

**Note:** Check your specific module's documentation for exact command syntax, as it may vary slightly between manufacturers.

## Cost Breakdown

- **8CH USB Relay Module (CH340):** $15-25
- **USB-B to USB-C adapter:** $5-10
- **Power supply (5V/12V):** $5-10
- **Total:** ~$25-45

**Much cheaper than SainSmart, and works great with Android!**

## Advantages Over Other Modules

✅ **Cheaper** - Half the price of SainSmart  
✅ **More relays** - 8 vs 4 channels  
✅ **CH340 support** - Works great with Android USB OTG  
✅ **AT commands** - Easier to debug than binary  
✅ **Same ratings** - 10A @ 250VAC, perfect for HVAC

This is an excellent choice for your Android tablet thermostat project!
