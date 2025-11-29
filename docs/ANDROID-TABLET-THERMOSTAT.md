# Android Tablet Smart Thermostat Setup

## Overview

Turn your React thermostat app into a wall-mounted smart thermostat using:

- **Android tablet** (wall-mounted where old thermostat was)
- **USB relay module** (connects tablet to furnace wires)
- **Your React app** (running in browser or as PWA)

This creates a professional, custom smart thermostat that looks great and gives you full control!

## Hardware Setup

### What You Need

1. **Android Tablet**

   - Any Android 7.0+ tablet with USB OTG support
   - 7-10 inch screen recommended (fits standard thermostat size)
   - **USB OTG adapter** (~$5) - allows tablet to act as USB host
   - **Wall mount** (~$10-30) - tablet wall mount or custom bracket

   **Recommended Tablets:**

   - **ONN Surf 7" Tablet** (2024) - ✅ **Perfect for this!**
     - 7" screen (ideal size)
     - USB-C port (works with USB-C OTG adapter)
     - Android OS (likely Android 11-13, supports Web Serial API)
     - 3GB RAM (sufficient for React app)
     - Very affordable (~$30-50)
   - Amazon Fire tablets (need to sideload Google Play)
   - Samsung Galaxy Tab A series
   - Any budget Android tablet with USB-C

2. **USB Relay Module**

   - **Recommended:** 8CH USB Serial Relay Module with CH340 (~$15-25) - **Best value!**
     - CH340 chip works great with Android
     - Uses AT commands: `AT+ON1`, `AT+OFF1`, etc.
     - 8 relays (more than you need, but future-proof)
   - SainSmart 4-Channel USB Relay Module (~$25-35)
   - Or any USB relay that works with serial commands
   - Must support USB OTG (CH340 and FTDI-based relays work)

3. **Power for Tablet**

   - USB-C power adapter (if tablet supports USB-C charging)
   - Or use a **USB-C Y-cable** that allows charging + USB OTG simultaneously
   - Or hardwire a USB power supply to the wall

4. **Wiring**
   - Connect USB relay to furnace wires (W, Y, G, C, R)
   - Same wiring as described in `docs/USB-RELAY-OPTIONS.md`

### Wiring Diagram

```
Android Tablet (USB OTG)
    │
    └─ USB Cable ──→ USB Relay Module
                          │
                          ├─ Relay 1 ──→ Furnace W (Heat)
                          ├─ Relay 2 ──→ Furnace Y (Cool)
                          ├─ Relay 3 ──→ Furnace G (Fan)
                          │
                          └─ Common ──→ Furnace C (24VAC return)
```

## Software Setup

### Option 1: Browser + Web Serial API (Easiest)

**Pros:**

- No server needed
- Direct control from React app
- Simple setup

**Cons:**

- Requires Chrome/Edge browser (Web Serial API support)
- May need user permission prompts

**Setup:**

1. **Install Chrome or Edge on tablet** (both support Web Serial API)

2. **Update your React app to use Web Serial API:**

Create `src/lib/webSerialRelay.js`:

```javascript
/**
 * Web Serial API relay control for Android tablets
 * Works directly in the browser - no server needed!
 */

export class WebSerialRelay {
  constructor() {
    this.port = null;
    this.writer = null;
    this.reader = null;
  }

  async connect() {
    try {
      // Request access to serial port
      this.port = await navigator.serial.requestPort();

      // Open with baud rate 9600 (standard for USB relays)
      await this.port.open({ baudRate: 9600 });

      // Get writer for sending commands
      this.writer = this.port.writable.getWriter();

      console.log("USB relay connected via Web Serial API");
      return true;
    } catch (error) {
      console.error("Failed to connect to USB relay:", error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.writer) {
        await this.writer.close();
        this.writer = null;
      }
      if (this.reader) {
        await this.reader.cancel();
        this.reader = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
    } catch (error) {
      console.error("Error disconnecting:", error);
    }
  }

  async toggleRelay(index, on) {
    if (!this.writer) {
      throw new Error("Not connected to USB relay");
    }

    // Format: RELAY <index> <ON|OFF>\n
    const command = `RELAY ${index} ${on ? "ON" : "OFF"}\n`;
    const encoder = new TextEncoder();
    await this.writer.write(encoder.encode(command));

    return { ok: true, index, on };
  }

  async isConnected() {
    return this.port !== null && this.port.readable !== null;
  }
}

// Singleton instance
let relayInstance = null;

export function getWebSerialRelay() {
  if (!relayInstance) {
    relayInstance = new WebSerialRelay();
  }
  return relayInstance;
}
```

3. **Update your ContactorDemo or ShortCycleTest component:**

```javascript
import { getWebSerialRelay } from "../lib/webSerialRelay";

// In your component:
const [relayConnected, setRelayConnected] = useState(false);
const webSerialRelay = getWebSerialRelay();

const connectRelay = async () => {
  try {
    await webSerialRelay.connect();
    setRelayConnected(true);
  } catch (error) {
    console.error("Failed to connect:", error);
    alert("Please connect USB relay and grant permission");
  }
};

const toggleRelay = async (terminal, on) => {
  // For CH340 8CH relay module, use 'at' command format
  // For SainSmart or Arduino-style, use 'arduino' format
  // For simple USB relays, use 'usbrelay' format
  const commandFormat = "at"; // or 'arduino' or 'usbrelay'
  await webSerialRelay.toggleTerminal(terminal, on, commandFormat);
};
```

### Option 2: PWA + Local Server (More Reliable)

**Pros:**

- More reliable connection
- Works with any browser
- Can run in background

**Cons:**

- Requires Termux (Android terminal emulator)
- Slightly more complex setup

**Setup:**

1. **Install Termux on tablet** (from F-Droid, not Play Store - Play Store version is outdated)

2. **Install Node.js in Termux:**

   ```bash
   pkg update
   pkg install nodejs
   npm install -g pm2  # Process manager to keep server running
   ```

3. **Copy your relay-server.js to tablet:**

   - Use ADB, or
   - Clone your repo in Termux, or
   - Use a file sync app

4. **Start relay server in Termux:**

   ```bash
   cd /path/to/your/project
   $env:RELAY_ENABLED = 'true'
   $env:RELAY_SECRET = 'abc123'
   $env:RELAY_PORT = '/dev/ttyUSB0'  # USB relay device path
   node scripts/relay-server.js

   # Or use PM2 to keep it running:
   pm2 start scripts/relay-server.js --name relay-server
   pm2 save
   pm2 startup  # Auto-start on boot
   ```

5. **Access your React app:**

   - Deploy to a web server, or
   - Run `npm run build` and serve the static files, or
   - Use Vite dev server (for development)

6. **Configure app to use localhost:**
   - Set `relayServerUrl` to `http://localhost:3005` in your React app

### Option 3: USB Relay with Built-in Web Server (Easiest!)

Some USB relay modules have built-in web servers. Check if yours does - if so, you can skip the server entirely and just make HTTP requests from your React app!

## Tablet Configuration

### 1. Enable USB OTG

- Go to Settings → Developer Options
- Enable "USB Debugging" (optional, but helpful)
- Some tablets have "USB OTG" toggle - enable it

### 2. Set Up Kiosk Mode (Optional)

To make it behave like a dedicated thermostat:

**Option A: Use Kiosk Browser App**

- Install "Kiosk Browser Lockdown" or similar
- Set your React app URL as home page
- Lock it to that app only

**Option B: Use Android's Built-in Kiosk Mode**

- Settings → Security → Device Admin Apps
- Enable kiosk mode (varies by manufacturer)

**Option C: Simple Auto-Launch**

- Use "Auto Start" or "Tasker" app
- Auto-open browser to your app URL on boot

### 3. Keep Screen On

- Settings → Display → Keep screen on (or use "Stay Awake" in Developer Options)
- Or use an app like "Keep Screen On"

### 4. Disable Sleep/Standby

- Settings → Display → Sleep → Never (or maximum time)
- Consider using a screen dimmer app to reduce brightness at night

## Power Management

### Option 1: Use Furnace Transformer (Best for Wall Mount!)

**This is the smartest option!** Your furnace already has a 24VAC transformer powering the thermostat. You can use this same power to charge the tablet.

**What you need:**

- **24VAC to 5V DC USB Adapter** (~$10-20)
  - Search for: "24VAC to USB adapter" or "thermostat USB power adapter"
  - Outputs 5V DC via USB port
  - Rated for 24VAC input (same as furnace transformer)

**Wiring:**

```
Furnace Transformer (24VAC)
    │
    ├─→ C (Common) ──→ USB Adapter (24VAC input)
    └─→ R (Hot)    ──→ USB Adapter (24VAC input)
                          │
                          └─→ USB-C Cable ──→ Tablet
```

**Advantages:**

- ✅ No separate power supply needed
- ✅ Always powered (no battery concerns)
- ✅ Professional installation
- ✅ Same power source as old thermostat

**Safety Notes:**

- Turn off furnace power before wiring
- Use proper wire gauge (18-22 AWG)
- Ensure USB adapter is rated for 24VAC (not just 24VDC)
- Mount adapter in a small junction box behind tablet

**Recommended Products:**

- "24VAC to 5V USB Power Adapter" (various brands on Amazon/eBay)
- Look for models specifically designed for thermostat installations
- Ensure it outputs at least 2A (for tablet charging)

### Option 2: USB-C Y-Cable (If Not Using Furnace Power)

- One end: USB-C to tablet
- Two branches:
  - USB-C power input (from wall adapter)
  - USB-A to USB relay
- Allows charging + USB OTG simultaneously

### Option 3: Hardwire USB Power (Separate Supply)

- Use a USB power adapter (5V)
- Wire it to the wall (behind where thermostat was)
- Connect to tablet's charging port
- USB relay connects via USB OTG adapter

### Option 4: Battery + Charging Dock

- Use a charging dock that keeps tablet charged
- USB relay connects via USB OTG

## Mounting the Tablet

### Standard Thermostat Replacement

1. **Remove old thermostat:**

   - Turn off power to furnace
   - Remove thermostat from wall
   - Keep the wires (W, Y, G, C, R)

2. **Mount tablet:**

   - Use a tablet wall mount bracket
   - Or 3D print a custom bracket
   - Or use a standard tablet mount with custom adapter

3. **Route wires:**

   - USB relay can be mounted behind tablet or in a small box
   - Route USB cable from tablet to relay
   - Connect relay outputs to furnace wires

4. **Power:**
   - **Best option:** Use furnace transformer with 24VAC to USB adapter
   - Connect R and C wires from furnace to USB adapter
   - Route USB cable from adapter to tablet
   - Or use separate USB power supply if preferred

## App Configuration

### Update Your React App for Tablet

1. **Full-screen mode:**

   ```javascript
   // In your main App component
   useEffect(() => {
     // Request fullscreen on tablet
     if (document.documentElement.requestFullscreen) {
       document.documentElement.requestFullscreen();
     }
   }, []);
   ```

2. **Touch-optimized UI:**

   - Your existing UI should work, but consider:
   - Larger touch targets
   - Swipe gestures
   - Landscape orientation support

3. **Always-on display:**
   - Consider a "screensaver" mode that shows:
     - Current temperature
     - Setpoint
     - System status
   - Wake on touch

## Tablet Compatibility Check

### For ONN Surf 7" Tablet (2024)

**✅ Should work perfectly!** Here's how to verify:

1. **Check USB OTG Support:**

   - Plug in a USB-C OTG adapter
   - Connect a USB flash drive or mouse
   - If it's detected, USB OTG works!

2. **Check Android Version:**

   - Settings → About Tablet → Android Version
   - Need Android 7.0+ (ONN Surf 2024 should be Android 11-13)

3. **Install Chrome/Edge:**

   - ONN tablets come with Google Play Store
   - Install Chrome or Edge browser
   - Both support Web Serial API on Android

4. **Test Web Serial API:**
   - Open Chrome on the tablet
   - Go to: `https://web-serial-test.glitch.me/`
   - If it can detect serial ports, you're good!

**Potential Issues:**

- ONN tablets are budget devices - may be slightly slower, but fine for a thermostat app
- Some budget tablets have limited USB power output - use a powered USB hub if relay doesn't work
- Check if tablet supports "USB OTG" in settings (some have a toggle)

## Testing

1. **Test USB relay connection:**

   - Connect USB relay to tablet via USB OTG
   - Open Chrome/Edge
   - Navigate to your app
   - Click "Connect Relay" button
   - Grant serial port permission when prompted

2. **Test relay control:**

   - Use your ContactorDemo or ShortCycleTest component
   - Enable hardware mode
   - Toggle relays and verify furnace responds

3. **Test temperature reading:**
   - If using USB temperature sensor, connect it too
   - Or use tablet's built-in sensors (if accessible)
   - Or use external API for weather data

## Troubleshooting

- **USB relay not detected:**

  - Check USB OTG adapter is connected
  - Try different USB cable
  - Check if relay needs drivers (usually auto-detects)
  - Verify relay shows up in Android's USB devices

- **Web Serial API not available:**

  - Must use Chrome or Edge browser
  - Android 7.0+ required
  - Some tablets may not support it (check browser compatibility)

- **Relay commands not working:**

  - Check baud rate (usually 9600)
  - Verify command format matches your relay module
  - Check serial port permissions

- **Tablet keeps going to sleep:**
  - Disable sleep in Settings
  - Use "Stay Awake" in Developer Options
  - Install a keep-awake app

## Professional Touches

1. **Custom Wall Plate:**

   - 3D print or order a custom wall plate that frames the tablet
   - Makes it look like a commercial smart thermostat

2. **Always-On Display:**

   - Show temperature, setpoint, and status even when "sleeping"
   - Use tablet's ambient display if available

3. **Voice Control:**

   - Your app already has voice support!
   - Tablet's microphone works great for "Ask Joule" commands

4. **Remote Access:**
   - Deploy your React app to a web server
   - Access from phone/computer to control when away
   - Or use a VPN to access tablet's local server

## Cost Breakdown

- **Android Tablet:** $30-50 (ONN Surf 7" is perfect and cheap!)
- **USB Relay Module (CH340):** $15-25
- **USB-C OTG Adapter:** $5-10
- **Wall Mount:** $10-30
- **24VAC to USB Adapter:** $10-20 (uses furnace transformer - no separate power needed!)
- **Total: ~$70-135** (vs $200-400 for commercial smart thermostat)

**With ONN Surf tablet and furnace power, you're looking at under $100 total!**

## Advantages Over Commercial Smart Thermostats

✅ **Full customization** - Your app, your features
✅ **No subscription fees** - Everything runs locally
✅ **Privacy** - No cloud required (unless you want it)
✅ **Unique features** - Your AI agent, calculators, etc.
✅ **Professional appearance** - Large touchscreen
✅ **Future-proof** - Easy to update and modify

This is actually a really smart approach - you get a professional smart thermostat with all your custom features, and it's probably cheaper than buying a Nest or Ecobee!
