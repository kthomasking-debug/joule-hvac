# Honeywell CT87K Integration Guide

## Overview

The Honeywell CT87K/CT87N is a **mechanical, non-programmable thermostat** with no digital interface. However, you can integrate it with your React thermostat app using professional-grade hardware:

1. **USB Temperature Sensor** (DS18B20) - for accurate temperature readings
2. **ESP32 or Raspberry Pi** - professional microcontroller/SBC to bridge USB ↔ thermostat wiring
3. **Industrial Relay Module** - to control HVAC contactors (W, Y, G)
4. **Optional: Read CT87K state** - detect when the mechanical thermostat is calling for heat/cool

## Hardware Options (Professional vs. Budget)

### Professional Options (Recommended)

**Option 1: ESP32 Development Board** ⭐ **RECOMMENDED**

- **Why:** Professional-grade, WiFi/Bluetooth capable, low power, industrial temperature range
- **Cost:** ~$8-15
- **Pros:**
  - Can connect via WiFi (no USB cable needed)
  - More powerful than Arduino
  - Professional appearance with proper enclosure
  - Can run as standalone device
- **Cons:** Slightly more complex setup

**Option 2: Raspberry Pi Zero 2 W**

- **Why:** Full Linux OS, very professional, can run Node.js directly
- **Cost:** ~$15-20
- **Pros:**
  - Can run your relay server directly on the Pi
  - WiFi built-in
  - Professional and reliable
  - Can add web interface
- **Cons:** More expensive, requires microSD card

**Option 3: Industrial PLC Module**

- **Why:** Most professional, designed for HVAC control
- **Cost:** $100-500+
- **Pros:** Industrial-grade reliability, certifications
- **Cons:** Expensive, proprietary software

### Budget Option

**Arduino Uno/Nano** (for prototyping/testing only)

- **Cost:** ~$5-10
- **Use case:** Development, testing, proof of concept
- **Not recommended for production** due to limited connectivity and professional appearance

## Hardware Setup

### Option 1: Bypass CT87K (Recommended for Full Control)

**Wiring Diagram:**

```
HVAC Transformer (24VAC)
    │
    ├─ R (Red) ──┐
    │            │
    │            ├─→ Arduino Relay Module
    │            │   (controls W, Y, G)
    │            │
    └─ C (Common)─┘
                  │
                  └─→ Your React App controls everything
```

**Components Needed:**

- **ESP32 Development Board** (recommended) or Raspberry Pi Zero 2 W
- **3-channel relay module** rated for 24VAC (industrial grade recommended)
- **DS18B20 USB temperature sensor** (or wired DS18B20)
- **USB cable** for programming/power (ESP32) or microSD card (Raspberry Pi)
- **Professional enclosure** (optional but recommended)

**How it works:**

- Your React app reads temperature from USB sensor
- App decides when to call for heat/cool
- Arduino relays control W, Y, G terminals directly
- CT87K can remain on wall as backup/display (not wired)

### Option 2: Hybrid Mode (CT87K + Smart Control)

**Wiring Diagram:**

```
HVAC Transformer (24VAC)
    │
    ├─ R (Red) ──┬─→ CT87K (mechanical thermostat)
    │            │
    │            └─→ Arduino Relay Module (smart control)
    │
    └─ C (Common)─┘
```

**How it works:**

- CT87K works normally (mechanical override)
- Arduino can also control W, Y, G (smart mode)
- Use a DPDT relay to switch between CT87K and Arduino control
- Your React app monitors both and can take over when needed

### Option 3: Read CT87K State (Advanced)

**Components:**

- Optocoupler or voltage divider to safely read 24VAC
- Arduino analog/digital inputs

**How it works:**

- Monitor CT87K's W, Y, G outputs (24VAC when calling)
- Convert to safe logic levels for Arduino
- Report state to your React app
- App can display "CT87K is calling for heat" status

## Software Setup

### 1. ESP32 Firmware (Professional Option)

Create `scripts/esp32-thermostat.ino` for ESP32:

```cpp
/*
 * Arduino Thermostat Controller
 * Controls W (heat), Y (cool), G (fan) relays
 * Reads temperature from DS18B20 (optional)
 * Communicates via USB Serial
 */

#include <OneWire.h>
#include <DallasTemperature.h>

// Relay pins (W, Y, G)
const int RELAY_W = 2;  // Heat
const int RELAY_Y = 3;  // Cool/Compressor
const int RELAY_G = 4;  // Fan

// Temperature sensor (DS18B20 on pin 5, optional)
#define ONE_WIRE_BUS 5
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);
bool hasTempSensor = false;

String buffer = "";

void setup() {
  Serial.begin(9600);

  // Initialize relays
  pinMode(RELAY_W, OUTPUT);
  pinMode(RELAY_Y, OUTPUT);
  pinMode(RELAY_G, OUTPUT);
  digitalWrite(RELAY_W, LOW);
  digitalWrite(RELAY_Y, LOW);
  digitalWrite(RELAY_G, LOW);

  // Initialize temperature sensor
  sensors.begin();
  if (sensors.getDeviceCount() > 0) {
    hasTempSensor = true;
    Serial.println("DS18B20 sensor found");
  } else {
    Serial.println("No DS18B20 sensor (temperature will come from USB sensor)");
  }
}

void processCommand(String cmd) {
  cmd.trim();

  // RELAY W|Y|G ON|OFF
  if (cmd.startsWith("RELAY")) {
    int firstSpace = cmd.indexOf(' ');
    if (firstSpace < 0) return;
    String rest = cmd.substring(firstSpace + 1);
    int secondSpace = rest.indexOf(' ');
    if (secondSpace < 0) return;

    String terminal = rest.substring(0, secondSpace);
    String stateStr = rest.substring(secondSpace + 1);
    stateStr.toUpperCase();

    int pin = -1;
    if (terminal == "W") pin = RELAY_W;
    else if (terminal == "Y") pin = RELAY_Y;
    else if (terminal == "G") pin = RELAY_G;

    if (pin >= 0) {
      bool on = stateStr == "ON";
      digitalWrite(pin, on ? HIGH : LOW);
      Serial.print("OK RELAY ");
      Serial.print(terminal);
      Serial.print(" ");
      Serial.println(on ? "ON" : "OFF");
    }
  }
  // TEMP - read temperature
  else if (cmd == "TEMP") {
    if (hasTempSensor) {
      sensors.requestTemperatures();
      float tempC = sensors.getTempCByIndex(0);
      float tempF = (tempC * 9.0 / 5.0) + 32.0;
      Serial.print("TEMP ");
      Serial.print(tempC, 1);
      Serial.print(" ");
      Serial.println(tempF, 1);
    } else {
      Serial.println("TEMP ERROR: No sensor");
    }
  }
  // STATUS - report all relay states
  else if (cmd == "STATUS") {
    Serial.print("STATUS W:");
    Serial.print(digitalRead(RELAY_W) ? "ON" : "OFF");
    Serial.print(" Y:");
    Serial.print(digitalRead(RELAY_Y) ? "ON" : "OFF");
    Serial.print(" G:");
    Serial.println(digitalRead(RELAY_G) ? "ON" : "OFF");
  }
}

void loop() {
  // Read serial commands
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c == '\n') {
      processCommand(buffer);
      buffer = "";
    } else {
      buffer += c;
    }
  }

  // Auto-report temperature every 5 seconds (optional)
  static unsigned long lastTempRead = 0;
  if (hasTempSensor && millis() - lastTempRead > 5000) {
    sensors.requestTemperatures();
    float tempC = sensors.getTempCByIndex(0);
    float tempF = (tempC * 9.0 / 5.0) + 32.0;
    Serial.print("AUTO_TEMP ");
    Serial.print(tempC, 1);
    Serial.print(" ");
    Serial.println(tempF, 1);
    lastTempRead = millis();
  }
}
```

### 2. ESP32 Setup (Professional)

**Option A: WiFi Mode (Recommended - No USB Cable Needed)**

1. **Install ESP32 Board Support:**

   - Arduino IDE: File → Preferences → Additional Board Manager URLs
   - Add: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Tools → Board → Boards Manager → Search "ESP32" → Install

2. **Install Required Libraries:**

   - Tools → Manage Libraries → Install:
     - WiFi (usually included)
     - WebServer (usually included)
     - OneWire
     - DallasTemperature
     - ArduinoJson

3. **Configure WiFi:**

   - Edit `scripts/esp32-thermostat.ino`
   - Set `ssid` and `password` to your WiFi credentials

4. **Upload to ESP32:**

   - Select Board: "ESP32 Dev Module"
   - Select Port: Your ESP32 COM port
   - Click Upload

5. **Find ESP32 IP Address:**

   - Check serial monitor (115200 baud)
   - Or check your router's connected devices
   - ESP32 will print its IP address

6. **Update Relay Server to Use ESP32:**
   ```powershell
   $env:RELAY_ENABLED = 'true'
   $env:RELAY_SECRET = 'abc123'
   $env:RELAY_URL = 'http://192.168.1.100'  # Your ESP32 IP
   $env:RELAY_DRIVER = 'esp32'
   ```

**Option B: Serial Mode (Fallback)**

If WiFi isn't available, ESP32 can still work via USB serial:

```powershell
$env:RELAY_ENABLED = 'true'
$env:RELAY_SECRET = 'abc123'
$env:RELAY_PORT = 'COM3'  # Your ESP32 USB port
$env:RELAY_DRIVER = 'arduino'  # Uses same serial protocol
```

### 3. Raspberry Pi Setup (Most Professional)

For Raspberry Pi, you can run the relay server directly on the Pi:

1. **Install Node.js on Raspberry Pi:**

   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Install GPIO libraries:**

   ```bash
   npm install onoff  # For GPIO control
   ```

3. **Run relay server on Pi:**
   - The Pi can control relays via GPIO pins
   - Access via network: `http://raspberry-pi-ip:3005`
   - No USB cable needed, fully network-based

### 4. Update Relay Server

Your existing `scripts/relay-server.js` supports ESP32! Just update the connection method:

**For ESP32 WiFi:**

```powershell
$env:RELAY_ENABLED = 'true'
$env:RELAY_SECRET = 'abc123'
$env:RELAY_URL = 'http://192.168.1.100'  # ESP32 IP
$env:RELAY_DRIVER = 'esp32'
```

**For ESP32 Serial (fallback):**

```powershell
$env:RELAY_ENABLED = 'true'
$env:RELAY_SECRET = 'abc123'
$env:RELAY_PORT = 'COM3'  # ESP32 USB port
$env:RELAY_DRIVER = 'arduino'  # Same serial protocol
```

**Start relay server:**

```powershell
node scripts/relay-server.js
```

**Test from React app:**

- Your `ContactorDemo` component already supports this!
- Enable hardware mode in `ShortCycleTest`
- Set `relayServerUrl` to `http://localhost:3005` (or ESP32 IP if running directly)

### 3. Temperature Sensor Options

**Option A: USB DS18B20 (Easiest)**

- Plug into USB port
- Use existing `TEMP_SENSOR_ENABLED=true` in relay server
- No Arduino wiring needed

**Option B: Wired DS18B20 to Arduino**

- Wire DS18B20 to Arduino pin 5
- Use the enhanced Arduino sketch above
- Arduino reports temperature via serial

## Safety Considerations

⚠️ **IMPORTANT:**

- 24VAC from HVAC transformer can be dangerous
- Use proper relay modules rated for 24VAC
- Consider using optocouplers for isolation
- Test with multimeter before connecting to HVAC
- Keep CT87K wired as backup if using hybrid mode

## Integration with Your React App

Your app already supports this! Here's how:

1. **Temperature Reading:**

   - Use `useTemperature` hook (already supports USB sensor)
   - Or use `useCpuTemperature` as fallback

2. **Relay Control:**

   - `ContactorDemo` component can control relays
   - `ShortCycleTest` has hardware mode
   - Both use the relay server API

3. **Thermostat Logic:**
   - Your existing thermostat settings work
   - Protection timers (compressor, min on-time) work
   - Schedule and hold features work

## Example Usage

```javascript
// In your React component
const { temperature } = useTemperature("usb"); // or 'cpu'

// Control relays via your existing ContactorDemo logic
// The component will automatically:
// - Read temperature from USB sensor
// - Calculate if heat/cool is needed
// - Control W, Y, G relays via Arduino
// - Respect all protection timers
```

## Next Steps

### Professional Setup (Recommended)

1. **Buy hardware:**

   - **ESP32 Development Board** (~$8-15) - Recommended
   - **OR Raspberry Pi Zero 2 W** (~$15-20) - Most professional
   - **3-channel relay module** rated for 24VAC (~$10-20)
   - **DS18B20 USB sensor** (~$15-25) OR wired DS18B20 (~$3)
   - **Professional enclosure** (~$10-30) - Optional but recommended

2. **Upload ESP32 firmware:**

   - Install ESP32 board support in Arduino IDE
   - Install required libraries (WiFi, WebServer, OneWire, DallasTemperature, ArduinoJson)
   - Configure WiFi credentials in `scripts/esp32-thermostat.ino`
   - Upload to ESP32

3. **Wire everything:**

   - Connect relays to W, Y, G terminals
   - Connect temperature sensor (USB or wired to ESP32)
   - Connect ESP32 to power (USB or dedicated power supply)
   - **No USB cable needed for operation** (WiFi mode)

4. **Test:**
   - ESP32 connects to WiFi automatically
   - Check serial monitor for IP address
   - Start relay server pointing to ESP32 IP
   - Open `ContactorDemo` in your app
   - Enable hardware mode
   - Watch relays click as temperature changes!

### Budget Setup (Development Only)

For prototyping/testing, Arduino is acceptable:

- Use `scripts/arduino-thermostat.ino` (simpler, USB serial only)
- Not recommended for production due to limited connectivity

## Professional Considerations

### Why ESP32 Over Arduino?

1. **WiFi Connectivity:** No USB cable needed, can be mounted anywhere
2. **Professional Appearance:** Can be installed in a proper enclosure
3. **Remote Access:** Can control from anywhere on your network
4. **More Reliable:** Better power management, industrial temperature range
5. **Future-Proof:** Can add features like MQTT, cloud connectivity, etc.

### Why Raspberry Pi Over ESP32?

1. **Full Linux OS:** Can run your entire relay server on the device
2. **More Processing Power:** Can handle complex logic locally
3. **Easier Development:** Standard Linux environment
4. **More Professional:** Industry-standard for IoT applications

### Enclosure Recommendations

- **ESP32:** Use a DIN rail mount enclosure or wall-mount box
- **Raspberry Pi:** Official Pi case or industrial enclosure
- **Relays:** Use relay modules with proper enclosures (not bare boards)
- **Wiring:** Use proper wire management, strain relief, labels

## Troubleshooting

- **ESP32 not connecting to WiFi:** Check credentials, signal strength, router settings
- **Relays not responding:** Check IP address, network connectivity, wiring
- **Temperature not reading:** Check USB sensor connection, or wire DS18B20 to ESP32
- **HVAC not turning on:** Verify relay wiring, check 24VAC transformer, test with multimeter
- **CT87K still controlling:** Disconnect CT87K wires if you want full app control
- **Serial monitor shows errors:** Check baud rate (115200 for ESP32, 9600 for Arduino)
