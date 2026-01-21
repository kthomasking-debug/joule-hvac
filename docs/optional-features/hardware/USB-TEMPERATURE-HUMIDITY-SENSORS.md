# USB Temperature & Humidity Sensors for Android Tablet

## Overview

You need indoor temperature and humidity data for your thermostat. Here are USB sensor options that work with Android tablets via USB OTG.

## Recommended Solutions

### Option 1: USB HID Temperature/Humidity Sensor (Easiest) ⭐

**Best for:** Simple plug-and-play, no drivers needed

**Recommended Products:**

1. **AHT20 USB Temperature & Humidity Sensor** (~$15-25)

   - USB HID device (works like a keyboard/mouse)
   - No drivers needed on Android
   - Reads via Web HID API (Chrome/Edge)
   - Temperature: -40°C to +85°C (±0.3°C accuracy)
   - Humidity: 0-100% RH (±2% accuracy)
   - Updates every 2 seconds

2. **SHT31 USB Sensor** (~$20-30)
   - Higher accuracy (±0.2°C, ±2% RH)
   - USB HID interface
   - Works with Web HID API

**Pros:**

- ✅ No drivers needed
- ✅ Works with Web HID API (built into Chrome/Edge)
- ✅ Simple integration
- ✅ Both temp and humidity in one device

**Cons:**

- ⚠️ Requires Chrome/Edge browser (Web HID API)
- ⚠️ May need user permission prompt

**Setup:**

1. Connect sensor to USB OTG adapter
2. Use Web HID API in your React app (see code below)

---

### Option 2: USB-to-Serial Temperature Sensor (Recommended for Your Setup) ⭐

**Best for:** Works with Web Serial API (same as your relay), easy integration

**Recommended Product:**

**DS18B20 USB ASCII Thermometer** (~$10-20)

- **Temperature only** (no humidity)
- **USB-to-Serial adapter** (PL-2303TA chip - well-supported on Android)
- **ASCII format output** - easy to parse!
- **Serial communication:** 9600 8N1
- **Updates every 10 seconds**
- **Temperature range:** -55°C to +125°C
- **Accuracy:** ±0.5°C from -10°C to +85°C
- **Resolution:** 0.1°C
- **Cable length:** 5m (can extend to 100m)
- **Water resistant** - can measure liquid temperatures
- **Works with Web Serial API** - same as your relay!

**Why This is Perfect:**

- ✅ Uses **Web Serial API** (same as your CH340 relay)
- ✅ **ASCII format** = super easy to parse
- ✅ **PL-2303TA chip** is well-supported on Android
- ✅ Can use **same USB hub** as relay
- ✅ **No drivers needed** (standard serial)
- ✅ **Good accuracy** (±0.5°C)
- ✅ **Water resistant** (can measure liquids)

**Cons:**

- ⚠️ Temperature only (no humidity)
- ⚠️ Updates every 10 seconds (slower than some sensors)

**Alternative: DHT22 USB Temperature & Humidity Sensor** (~$15-20)

- Temperature + Humidity
- Uses serial commands
- Works with Web Serial API
- Temperature: -40°C to +80°C (±0.5°C)
- Humidity: 0-100% RH (±2% RH)

**Pros:**

- ✅ Works with Web Serial API (same as your relay)
- ✅ Can use same USB hub as relay
- ✅ More sensor options available

**Cons:**

- ⚠️ Requires serial communication code
- ⚠️ May need specific command protocols

---

### Option 3: USB Hub/Splitter Setup (Recommended for Multiple Devices)

**Best for:** Connecting relay + temperature sensor simultaneously

**Setup:**

```
Android Tablet (USB-C)
    │
    └─ USB-C OTG Adapter
           │
           └─ USB Hub (Powered, 4+ ports)
                  │
                  ├─ Port 1: USB Relay Module (CH340)
                  ├─ Port 2: USB Temperature/Humidity Sensor
                  └─ Port 3: (Optional) USB power for hub
```

**Recommended USB Hub:**

- **Anker 4-Port USB 3.0 Hub** (~$15-25)
  - Powered hub (recommended for reliability)
  - Works with USB OTG
  - Supports multiple devices simultaneously

**Alternative: USB-C Hub with Multiple Ports**

- **USB-C Hub with USB-A ports** (~$20-40)
  - Includes USB-A ports for relay + sensor
  - May include charging pass-through
  - All-in-one solution

---

## Integration Code

### Web HID API (for HID sensors like AHT20)

Create `src/lib/webHidSensor.js`:

```javascript
/**
 * Web HID API for USB temperature/humidity sensors
 * Works with AHT20, SHT31, and other HID sensors
 */

export class WebHidSensor {
  constructor() {
    this.device = null;
    this.onDataCallback = null;
  }

  /**
   * Request access to HID sensor
   */
  async connect() {
    try {
      // Request access to HID device
      // Filter by vendor/product ID if known
      const devices = await navigator.hid.requestDevice({
        filters: [
          // AHT20 example (adjust vendor/product IDs for your sensor)
          { vendorId: 0x1a86, productId: 0x7523 }, // CH340-based sensors
          // Add more filters as needed
        ],
      });

      if (devices.length === 0) {
        throw new Error("No HID sensor found");
      }

      this.device = devices[0];
      await this.device.open();

      // Listen for input reports
      this.device.addEventListener("inputreport", (event) => {
        this.handleInputReport(event);
      });

      console.log("✅ Connected to HID sensor");
      return true;
    } catch (error) {
      console.error("Failed to connect to HID sensor:", error);
      throw error;
    }
  }

  /**
   * Handle incoming data from sensor
   */
  handleInputReport(event) {
    const data = new Uint8Array(event.data.buffer);

    // Parse sensor data (format depends on sensor)
    // Example for AHT20:
    const temperature = this.parseTemperature(data);
    const humidity = this.parseHumidity(data);

    if (this.onDataCallback) {
      this.onDataCallback({ temperature, humidity, timestamp: Date.now() });
    }
  }

  /**
   * Parse temperature from sensor data
   * Adjust based on your sensor's protocol
   */
  parseTemperature(data) {
    // AHT20 example: bytes 0-2 contain temperature
    const rawTemp = (data[0] << 12) | (data[1] << 4) | (data[2] >> 4);
    const tempC = (rawTemp / 0x100000) * 200 - 50;
    const tempF = (tempC * 9) / 5 + 32;
    return { celsius: tempC, fahrenheit: tempF };
  }

  /**
   * Parse humidity from sensor data
   */
  parseHumidity(data) {
    // AHT20 example: bytes 1-3 contain humidity
    const rawHumidity = ((data[1] & 0x0f) << 16) | (data[2] << 8) | data[3];
    const humidity = (rawHumidity / 0x100000) * 100;
    return humidity;
  }

  /**
   * Request sensor reading
   */
  async readSensor() {
    if (!this.device) {
      throw new Error("Not connected");
    }

    // Send command to trigger reading (format depends on sensor)
    // AHT20 example:
    const command = new Uint8Array([0xac, 0x33, 0x00]);
    await this.device.sendReport(0, command);
  }

  /**
   * Set callback for sensor data
   */
  onData(callback) {
    this.onDataCallback = callback;
  }

  /**
   * Disconnect from sensor
   */
  async disconnect() {
    if (this.device) {
      await this.device.close();
      this.device = null;
    }
  }
}
```

**React Hook:**

Create `src/hooks/useUsbSensor.js`:

```javascript
import { useState, useEffect, useRef } from "react";
import { WebHidSensor } from "../lib/webHidSensor";

export function useUsbSensor() {
  const [temperature, setTemperature] = useState(null);
  const [humidity, setHumidity] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const sensorRef = useRef(null);

  useEffect(() => {
    const sensor = new WebHidSensor();
    sensorRef.current = sensor;

    sensor.onData((data) => {
      setTemperature(data.temperature);
      setHumidity(data.humidity);
      setConnected(true);
      setError(null);
    });

    sensor.connect().catch((err) => {
      setError(err.message);
      setConnected(false);
    });

    // Request reading every 2 seconds
    const interval = setInterval(() => {
      if (sensor.device) {
        sensor.readSensor();
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      sensor.disconnect();
    };
  }, []);

  return { temperature, humidity, connected, error };
}
```

---

### Web Serial API (for DS18B20 USB ASCII Thermometer) ⭐

**This is the recommended approach for your DS18B20 USB thermometer!**

The sensor sends ASCII data every 10 seconds. Here's how to integrate it:

**Option A: Extend your existing `webSerialRelay.js`:**

Add temperature reading capability to your relay controller:

```javascript
/**
 * Read temperature from DS18B20 USB ASCII thermometer
 * Sensor sends data automatically every 10 seconds in ASCII format
 * Example output: "+25.3C" or "-5.2C"
 */
async readTemperature() {
  if (!this.port || !this.port.readable) {
    throw new Error('Not connected to sensor');
  }

  const reader = this.port.readable.getReader();
  const decoder = new TextDecoder();

  try {
    // Read incoming data (sensor sends automatically every 10s)
    const { value, done } = await reader.read();

    if (done) {
      return null;
    }

    // Decode ASCII string (e.g., "+25.3C" or "-5.2C")
    const data = decoder.decode(value).trim();

    // Parse temperature (format: "+25.3C" or "-5.2C")
    // Remove 'C' and parse as float
    const tempC = parseFloat(data.replace('C', ''));

    if (isNaN(tempC)) {
      console.warn('Invalid temperature data:', data);
      return null;
    }

    // Convert to Fahrenheit
    const tempF = (tempC * 9) / 5 + 32;

    return {
      celsius: tempC,
      fahrenheit: tempF,
      raw: data,
      timestamp: Date.now(),
    };
  } finally {
    reader.releaseLock();
  }
}

/**
 * Start continuous temperature monitoring
 * Sensor sends data every 10 seconds automatically
 */
startTemperatureMonitoring(callback) {
  if (!this.port || !this.port.readable) {
    throw new Error('Not connected to sensor');
  }

  const reader = this.port.readable.getReader();
  const decoder = new TextDecoder();

  const readLoop = async () => {
    try {
      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        const data = decoder.decode(value).trim();
        const tempC = parseFloat(data.replace('C', ''));

        if (!isNaN(tempC)) {
          const tempF = (tempC * 9) / 5 + 32;
          callback({
            celsius: tempC,
            fahrenheit: tempF,
            raw: data,
            timestamp: Date.now(),
          });
        }
      }
    } catch (error) {
      console.error('Temperature monitoring error:', error);
    } finally {
      reader.releaseLock();
    }
  };

  readLoop();
}
```

**Option B: Create a dedicated sensor class:**

Create `src/lib/webSerialTemperature.js`:

```javascript
/**
 * Web Serial API for DS18B20 USB ASCII thermometer
 * Sensor sends ASCII data every 10 seconds automatically
 */

export class WebSerialTemperature {
  constructor() {
    this.port = null;
    this.reader = null;
    this.onDataCallback = null;
    this.monitoring = false;
  }

  /**
   * Connect to DS18B20 USB thermometer
   */
  async connect() {
    try {
      // Request access to serial port
      this.port = await navigator.serial.requestPort({
        filters: [
          // PL-2303TA USB-to-serial adapter
          { usbVendorId: 0x067b, usbProductId: 0x2303 }, // Prolific
          // CH340 (common alternative)
          { usbVendorId: 0x1a86, usbProductId: 0x7523 },
        ],
      });

      // Open port with sensor's settings: 9600 8N1
      await this.port.open({
        baudRate: 9600,
        dataBits: 8,
        parity: "none",
        stopBits: 1,
      });

      console.log("✅ Connected to DS18B20 USB thermometer");
      return true;
    } catch (error) {
      console.error("Failed to connect to temperature sensor:", error);
      throw error;
    }
  }

  /**
   * Start monitoring temperature (sensor sends data every 10s)
   */
  async startMonitoring() {
    if (!this.port || !this.port.readable) {
      throw new Error("Not connected");
    }

    this.monitoring = true;
    this.reader = this.port.readable.getReader();
    const decoder = new TextDecoder();

    const readLoop = async () => {
      try {
        while (this.monitoring) {
          const { value, done } = await this.reader.read();

          if (done) {
            break;
          }

          // Parse ASCII data (e.g., "+25.3C" or "-5.2C")
          const data = decoder.decode(value).trim();
          const tempC = parseFloat(data.replace("C", ""));

          if (!isNaN(tempC) && this.onDataCallback) {
            const tempF = (tempC * 9) / 5 + 32;
            this.onDataCallback({
              celsius: tempC,
              fahrenheit: tempF,
              raw: data,
              timestamp: Date.now(),
            });
          }
        }
      } catch (error) {
        console.error("Temperature monitoring error:", error);
        if (this.onDataCallback) {
          this.onDataCallback({ error: error.message });
        }
      } finally {
        this.reader.releaseLock();
      }
    };

    readLoop();
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring() {
    this.monitoring = false;
    if (this.reader) {
      await this.reader.cancel();
      this.reader.releaseLock();
      this.reader = null;
    }
  }

  /**
   * Set callback for temperature data
   */
  onData(callback) {
    this.onDataCallback = callback;
  }

  /**
   * Disconnect from sensor
   */
  async disconnect() {
    await this.stopMonitoring();
    if (this.port) {
      await this.port.close();
      this.port = null;
    }
  }
}
```

**React Hook for DS18B20:**

Create `src/hooks/useDs18b20Temperature.js`:

```javascript
import { useState, useEffect, useRef } from "react";
import { WebSerialTemperature } from "../lib/webSerialTemperature";

export function useDs18b20Temperature() {
  const [temperature, setTemperature] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const sensorRef = useRef(null);

  useEffect(() => {
    const sensor = new WebSerialTemperature();
    sensorRef.current = sensor;

    sensor.onData((data) => {
      if (data.error) {
        setError(data.error);
        setConnected(false);
      } else {
        setTemperature(data);
        setConnected(true);
        setError(null);
      }
    });

    // Connect and start monitoring
    sensor
      .connect()
      .then(() => {
        setConnected(true);
        return sensor.startMonitoring();
      })
      .catch((err) => {
        setError(err.message);
        setConnected(false);
      });

    return () => {
      sensor.disconnect();
    };
  }, []);

  return { temperature, connected, error };
}
```

---

## Shopping List Addition

Add to your shopping cart:

1. **USB Temperature Sensor:**

   - **DS18B20 USB ASCII Thermometer** (~$10-20) - ⭐ **RECOMMENDED!**
     - Works with Web Serial API (same as your relay)
     - ASCII format = easy to parse
     - PL-2303TA chip (well-supported)
     - Temperature only (no humidity)
   - **AHT20 USB Sensor** (~$15-25) - Temperature + Humidity (Web HID API)
   - **DHT22 USB Sensor** (~$15-20) - Temperature + Humidity (Serial)
   - **SHT31 USB Sensor** (~$20-30) - Higher accuracy (Web HID API)

2. **USB Hub (if connecting relay + sensor):**

   - **Anker 4-Port Powered USB Hub** (~$15-25)
   - OR **USB-C Hub with USB-A ports** (~$20-40)

3. **USB Cables:**
   - USB-A to Micro-USB (if sensor uses Micro-USB)
   - USB-A to USB-B (for relay, you already have this)

**Total Additional Cost:** ~$30-50

---

## Complete Setup Diagram

```
Android Tablet (USB-C)
    │
    └─ USB-C OTG Adapter
           │
           └─ USB Hub (Powered)
                  │
                  ├─ Port 1: USB Relay Module (CH340)
                  │      │
                  │      ├─ Relay 1 → W (Heat)
                  │      ├─ Relay 2 → Y (Cool)
                  │      └─ Relay 3 → G (Fan)
                  │
                  └─ Port 2: USB Temperature/Humidity Sensor
                         │
                         └─ Reads: Temperature + Humidity
```

---

## Integration with Your React App

Update `src/pages/ContactorDemo.jsx` or create a new component:

```javascript
import { useUsbSensor } from "../hooks/useUsbSensor";

function TemperatureSensorDisplay() {
  const { temperature, humidity, connected, error } = useUsbSensor();

  if (!connected) {
    return (
      <div className="p-3 bg-amber-50 border border-amber-200 rounded">
        <button
          onClick={() => {
            /* trigger connect */
          }}
        >
          Connect USB Sensor
        </button>
        {error && <div className="text-red-600">{error}</div>}
      </div>
    );
  }

  return (
    <div className="p-3 bg-blue-50 border border-blue-200 rounded">
      <div className="text-lg font-bold">
        {temperature?.fahrenheit.toFixed(1)}°F
      </div>
      <div className="text-sm text-gray-600">
        Humidity: {humidity?.toFixed(1)}%
      </div>
    </div>
  );
}
```

---

## Testing

1. **Connect sensor to USB hub**
2. **Connect hub to tablet via OTG adapter**
3. **Open Chrome/Edge on tablet**
4. **Navigate to your React app**
5. **Click "Connect USB Sensor" button**
6. **Grant permission when prompted**
7. **Verify temperature/humidity readings appear**

---

## Troubleshooting

### "No HID device found"

- Make sure sensor is connected and powered
- Check USB hub is powered (if using powered hub)
- Try different USB port on hub

### "Permission denied"

- Make sure you're using Chrome or Edge (Web HID API support)
- Grant permission when browser prompts
- Check tablet's USB OTG settings

### "Sensor not reading"

- Verify sensor is compatible with Web HID API
- Check sensor's documentation for correct vendor/product IDs
- Try different sensor model (AHT20 is well-supported)

### "USB hub not working"

- Use a **powered** USB hub (recommended)
- Some hubs don't work well with OTG - try different hub
- Connect hub directly to OTG adapter (no intermediate cables)

---

## Alternative: WiFi Temperature Sensor

If USB sensors prove difficult, consider:

- **ESP32 with DHT22/SHT31** (~$10-15)
  - WiFi-enabled temperature/humidity sensor
  - Serves data via HTTP REST API
  - Tablet connects via WiFi (no USB needed)
  - More reliable, but requires separate power

See `docs/CT87K-INTEGRATION.md` for ESP32 setup details.

---

## Recommended Purchase

**For your setup, I recommend:**

1. **DS18B20 USB ASCII Thermometer** ($10-20) ⭐ **BEST CHOICE!**

   - ✅ Works with **Web Serial API** (same as your relay!)
   - ✅ **ASCII format** = super easy to parse
   - ✅ **PL-2303TA chip** is well-supported on Android
   - ✅ Can use **same USB hub** as relay
   - ✅ **Good accuracy** (±0.5°C)
   - ✅ **Water resistant**
   - ⚠️ Temperature only (no humidity)

2. **Anker 4-Port Powered USB Hub** ($15-25)
   - Reliable power for multiple devices
   - Works well with USB OTG
   - Connect both relay + temperature sensor

**Total: ~$25-45 additional**

**If you need humidity too:**

- Add **DHT22 USB Sensor** ($15-20) for humidity
- OR use **AHT20 USB Sensor** ($15-25) for both temp + humidity (but uses Web HID API)

This gives you professional-grade temperature sensing directly in your tablet, using the same Web Serial API as your relay!
