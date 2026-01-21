# USB Relay Options for Furnace Control

## Best Option: USB Relay Module (Recommended)

**Why this is perfect for your use case:**

- ✅ Plug-and-play USB device
- ✅ Directly controls 24VAC contactors (no boost converter needed if you get the right one)
- ✅ Professional, used in industrial automation
- ✅ Works with your existing `relay-server.js` code
- ✅ No breadboard wiring needed (just connect wires to screw terminals)

### Recommended USB Relay Modules

**Option 1: SainSmart USB Relay Module (Most Popular)**

- **Model:** SainSmart 4-Channel USB Relay Module
- **Cost:** ~$25-35
- **Specs:**
  - 4 relays (perfect for W, Y, G + one spare)
  - Each relay rated for 10A @ 250VAC or 10A @ 30VDC
  - USB-B connector (standard USB cable)
  - Screw terminals for easy wiring
  - LED indicators for each relay
- **Why it's great:** Most popular, tons of documentation, reliable
- **Buy on:** Amazon, SainSmart website

**Option 2: ICStation USB Relay Module**

- **Model:** ICStation 8-Channel USB Relay Board
- **Cost:** ~$30-40
- **Specs:**
  - 8 relays (more than you need, but future-proof)
  - Same ratings as SainSmart
  - USB-B connector
- **Why it's great:** More relays for the price, same reliability

**Option 3: 8CH USB Serial Relay Module with CH340 (Great Value!)**

- **Model:** DC 5V/12V/24V 8CH USB Serial Port Relay Module (CH340)
- **Cost:** ~$15-25
- **Specs:**
  - 8 relays (plenty for W, Y, G + spares)
  - CH340 USB-to-serial chip (works great with Android!)
  - USB-B connector (needs USB-B to USB-C adapter for tablet)
  - Supports AT commands: `AT+ON1`, `AT+OFF1`, etc.
  - Also supports 8-byte binary commands
  - 10A @ 250VAC rating (perfect for HVAC)
  - Works with Windows, Linux, Mac, and Android (via USB OTG)
- **Why it's great:** Very affordable, CH340 is well-supported, AT commands are simple
- **Note:** You'll need a USB-B to USB-C adapter for the Android tablet

**Option 4: Industrial USB Relay (Most Professional)**

- **Model:** Advantech ADAM-4068 or similar
- **Cost:** ~$150-300
- **Specs:**
  - Industrial-grade reliability
  - DIN rail mountable
  - Professional enclosure
- **Why it's great:** Most professional, but overkill for most uses

### Wiring Your Furnace Contactors

**Simple Setup:**

```
USB Relay Module
    │
    ├─ Relay 1 (W/Heat) ──→ Furnace W terminal
    ├─ Relay 2 (Y/Cool) ──→ Furnace Y terminal
    ├─ Relay 3 (G/Fan)  ──→ Furnace G terminal
    │
    └─ Common (C) ──→ Furnace C terminal (24VAC return)
```

**Power:**

- USB relay module gets power from USB (5V)
- Relays switch the 24VAC from your furnace transformer
- **No boost converter needed** - the relays handle the 24VAC directly!

### Software Integration

Your existing `relay-server.js` already supports this! Just use the `arduino` driver mode:

```powershell
# Find your USB relay COM port
[System.IO.Ports.SerialPort]::GetPortNames()

# Start relay server
$env:RELAY_ENABLED = 'true'
$env:RELAY_SECRET = 'abc123'
$env:RELAY_PORT = 'COM3'  # Your USB relay COM port
$env:RELAY_DRIVER = 'arduino'
node scripts/relay-server.js
```

**How it works:**

- USB relay modules typically use FTDI chips (show up as COM ports)
- They accept simple serial commands (like `RELAY 0 ON`)
- Your `relay-server.js` already sends these commands!

### Alternative: FTDI USB-to-Serial + Relay Board

If you want to build your own on a breadboard:

**Parts:**

- FTDI FT232RL USB-to-Serial breakout (~$5)
- 3-channel relay module (~$5)
- Jumper wires

**Wiring:**

- FTDI RTS pin → Relay module IN1
- FTDI DTR pin → Relay module IN2
- FTDI TX pin → Relay module IN3
- Common GND

**Software:**

- Use `RELAY_DRIVER=rtctl` mode in your relay-server.js
- Controls RTS/DTR lines directly (no serial commands needed)

## Even Simpler: Raspberry Pi Pico

**Why consider it:**

- **Cost:** ~$4 (cheapest option!)
- **USB native:** Shows up as USB device
- **Can control relays directly:** GPIO pins
- **Very simple:** Just wire relays to GPIO pins

**Setup:**

1. Flash MicroPython or CircuitPython
2. Write simple script to control GPIO based on USB serial commands
3. Wire relays to GPIO pins
4. Use your existing `relay-server.js` with serial mode

**Pros:**

- Cheapest option
- Very reliable
- Professional enough (used in many commercial products)

**Cons:**

- Requires a bit of Python programming
- Need to wire relays yourself

## Comparison Table

| Option               | Cost   | Ease of Use | Professional | Setup Time |
| -------------------- | ------ | ----------- | ------------ | ---------- |
| **USB Relay Module** | $25-35 | ⭐⭐⭐⭐⭐  | ⭐⭐⭐⭐     | 5 min      |
| FTDI + Relay Board   | $10-15 | ⭐⭐⭐      | ⭐⭐⭐       | 30 min     |
| Raspberry Pi Pico    | $4     | ⭐⭐        | ⭐⭐⭐       | 1 hour     |
| BlinkStick + Boost   | $20+   | ⭐⭐        | ⭐⭐         | 2+ hours   |

## My Recommendation

**Go with the SainSmart USB Relay Module** - it's the perfect balance of:

- Professional appearance
- Ease of use (plug and play)
- Reliability
- Price
- Works with your existing code

You literally just:

1. Plug it into USB
2. Wire your furnace terminals to the relay screw terminals
3. Start your relay server
4. Done!

No breadboard, no boost converter, no complex wiring. The relays are already rated for 24VAC, so they handle your furnace contactors directly.

## Quick Start with USB Relay Module

1. **Buy:** SainSmart 4-Channel USB Relay Module (~$30)

2. **Install drivers** (if needed):

   - Most use FTDI chips - Windows usually auto-installs
   - If not, download FTDI drivers from ftdichip.com

3. **Find COM port:**

   ```powershell
   [System.IO.Ports.SerialPort]::GetPortNames()
   ```

4. **Wire furnace:**

   - Relay 1 → W terminal
   - Relay 2 → Y terminal
   - Relay 3 → G terminal
   - Common → C terminal

5. **Start server:**

   ```powershell
   $env:RELAY_ENABLED = 'true'
   $env:RELAY_SECRET = 'abc123'
   $env:RELAY_PORT = 'COM3'  # Your relay COM port
   node scripts/relay-server.js
   ```

6. **Test from your React app:**
   - Open `ContactorDemo` or `ShortCycleTest`
   - Enable hardware mode
   - Set `relayServerUrl` to `http://localhost:3005`
   - Watch the relays click!

That's it! Much simpler than BlinkStick + boost converter.
