#!/usr/bin/env node
/*
 * Simple development relay server to control USB relays via serial port
 * - Quick start example: RELAY_ENABLED=true RELAY_SECRET=abc123 RELAY_PORT=COM3 node scripts/relay-server.js
 * Security: only enabled when RELAY_ENABLED=true and RELAY_SECRET is provided.
 */
const express = require("express");
const bodyParser = require("body-parser");
// Support both serialport v8/v9 (default export) and v10+ ({ SerialPort })
const SerialLib = require("serialport");
const SerialPortCtor = SerialLib.SerialPort || SerialLib;

// Temperature sensor support (DS18B20 USB thermometer)
let usbtemp = null;
const TEMP_SENSOR_ENABLED = process.env.TEMP_SENSOR_ENABLED === "true";
if (TEMP_SENSOR_ENABLED) {
  try {
    usbtemp = require("usbtemp");
    console.log("DS18B20 USB temperature sensor support enabled");
  } catch {
    console.warn(
      "usbtemp module not found - temperature sensor disabled. Install with: npm install usbtemp"
    );
  }
}

const app = express();
app.use(bodyParser.json());

const RELAY_ENABLED = process.env.RELAY_ENABLED === "true";
const RELAY_SECRET = process.env.RELAY_SECRET || null;
const RELAY_PORT = process.env.RELAY_PORT || null; // e.g., COM3 or /dev/ttyUSB0
const RELAY_BAUD = parseInt(process.env.RELAY_BAUD || "9600", 10);
// Driver modes:
//  - "arduino" (default): write ASCII "RELAY <index> ON|OFF\n" to serial
//  - "rtctl": toggle USB-serial control line RTS or DTR to drive an LED (no Arduino needed)
const RELAY_DRIVER = (process.env.RELAY_DRIVER || "arduino").toLowerCase();
const RELAY_CONTROL_LINE = (
  process.env.RELAY_CONTROL_LINE || "RTS"
).toUpperCase(); // RTS | DTR

let port = null;
let portReady = false;
if (RELAY_ENABLED && RELAY_PORT) {
  try {
    // v10+: new SerialPort({ path, baudRate }) ; v8/v9: new SerialPort(path, { baudRate })
    if (SerialLib.SerialPort) {
      port = new SerialPortCtor({
        path: RELAY_PORT,
        baudRate: RELAY_BAUD,
        autoOpen: false,
      });
    } else {
      port = new SerialPortCtor(RELAY_PORT, {
        baudRate: RELAY_BAUD,
        autoOpen: false,
      });
    }
    port.open((err) => {
      if (err) {
        console.error("Failed to open serial port", RELAY_PORT, err.message);
        portReady = false;
      } else {
        console.log("Serial relay port opened", RELAY_PORT);
        portReady = true;
      }
    });
  } catch (e) {
    console.error("Unable to construct SerialPort for", RELAY_PORT, e.message);
  }
}

function validateSecret(req, res) {
  if (!RELAY_ENABLED)
    return res.status(403).send({ error: "Relay support disabled on server." });
  const secret = req.body && req.body.secret;
  if (!RELAY_SECRET || !secret || secret !== RELAY_SECRET)
    return res.status(401).send({ error: "Invalid secret." });
  // Only enforce serial port readiness for serial-based drivers
  const needsSerial = RELAY_DRIVER === "arduino" || RELAY_DRIVER === "rtctl";
  if (needsSerial && (!RELAY_PORT || !portReady))
    return res.status(503).send({ error: "Serial relay port not ready." });
  return null;
}

app.post("/api/relay/toggle", (req, res) => {
  try {
    const missing = validateSecret(req, res);
    if (missing) return;
    const { index, on } = req.body || {};
    const idx = typeof index === "number" ? index : 0;
    const onBool = !!on;
    if (RELAY_DRIVER === "rtctl") {
      // Toggle control line (RTS or DTR) instead of writing data
      const line = RELAY_CONTROL_LINE === "DTR" ? "dtr" : "rts"; // default RTS
      const setObj = {};
      setObj[line] = onBool;
      port.set(setObj, (err) => {
        if (err) {
          return res.status(500).json({
            error: `Failed to set ${line.toUpperCase()}=${onBool}`,
            message: err.message,
          });
        }
        return res.json({
          ok: true,
          driver: "rtctl",
          line: line.toUpperCase(),
          on: onBool,
        });
      });
    } else if (RELAY_DRIVER === "blinkstick") {
      // Use BlinkStick USB LED device (HID), no serial port required
      let device;
      try {
        const blinkstick = require("blinkstick");
        device = blinkstick.findFirst();
      } catch (e) {
        return res.status(500).json({
          error: "blinkstick module not installed",
          message: e && e.message,
        });
      }
      if (!device) {
        return res.status(503).json({ error: "No BlinkStick device found" });
      }
      const onColor = { r: 0, g: 255, b: 0 }; // green
      if (onBool) {
        device.setColor(onColor.r, onColor.g, onColor.b, (err) => {
          if (err)
            return res.status(500).json({
              error: "blinkstick setColor failed",
              message: err.message,
            });
          return res.json({ ok: true, driver: "blinkstick", color: onColor });
        });
      } else {
        device.turnOff((err) => {
          if (err)
            return res.status(500).json({
              error: "blinkstick turnOff failed",
              message: err.message,
            });
          return res.json({ ok: true, driver: "blinkstick", off: true });
        });
      }
    } else if (RELAY_DRIVER === "usbrelay") {
      // USB Relay Module (SainSmart, ICStation, etc.) - uses simple ON/OFF commands
      // Most USB relay modules use FTDI chips and accept simple serial commands
      // Format varies by model, but many accept: "ON<index>\r" / "OFF<index>\r"
      // Or: "A<index>ON\r" / "A<index>OFF\r" for some models
      // Default to simple format that works with most modules
      const cmd = `${onBool ? "ON" : "OFF"}${idx}\r`;
      port.write(cmd, (err) => {
        if (err)
          return res.status(500).json({
            error: "Failed to write to USB relay",
            message: err.message,
          });
        return res.json({
          ok: true,
          index: idx,
          on: onBool,
          driver: "usbrelay",
        });
      });
    } else {
      // Default Arduino-style command over serial
      // Format: RELAY <index> <ON|OFF>\n
      // This also works with most USB relay modules that accept text commands
      const cmd = `RELAY ${idx} ${onBool ? "ON" : "OFF"}\n`;
      port.write(cmd, (err) => {
        if (err)
          return res.status(500).json({
            error: "Failed to write to serial port",
            message: err.message,
          });
        return res.json({ ok: true, index: idx, on: onBool });
      });
    }
  } catch (err) {
    console.error("Relay toggle failed", err);
    return res.status(500).json({ error: "server error" });
  }
});

// Temperature sensor endpoint - GET /api/temperature
app.get("/api/temperature", (req, res) => {
  if (!TEMP_SENSOR_ENABLED || !usbtemp) {
    return res.status(503).json({
      error: "Temperature sensor not enabled or usbtemp not installed",
    });
  }

  usbtemp.getTemperatures((err, data) => {
    if (err) {
      console.error("Temperature read error:", err);
      return res
        .status(500)
        .json({ error: "Failed to read temperature", message: err.message });
    }

    if (!data || data.length === 0) {
      return res.status(503).json({ error: "No temperature sensors found" });
    }

    // Return temperature in both Celsius and Fahrenheit
    const tempC = data[0];
    const tempF = (tempC * 9) / 5 + 32;

    return res.json({
      ok: true,
      temperatureC: Math.round(tempC * 10) / 10,
      temperatureF: Math.round(tempF * 10) / 10,
      timestamp: new Date().toISOString(),
    });
  });
});

// Thermostat logic endpoint - POST /api/thermostat/control
// Accepts: { mode: 'heat'|'cool', targetTemp: number, unit: 'F'|'C', hysteresis: number }
// Returns: { shouldBeOn: boolean, currentTemp: number, reason: string }
app.post("/api/thermostat/control", (req, res) => {
  if (!TEMP_SENSOR_ENABLED || !usbtemp) {
    return res.status(503).json({ error: "Temperature sensor not enabled" });
  }

  const { mode, targetTemp, unit, hysteresis } = req.body || {};

  if (!mode || !["heat", "cool"].includes(mode)) {
    return res.status(400).json({ error: "mode must be 'heat' or 'cool'" });
  }

  if (typeof targetTemp !== "number" || isNaN(targetTemp)) {
    return res.status(400).json({ error: "targetTemp must be a number" });
  }

  const useF = unit === "F" || unit === "f";
  const hyst = typeof hysteresis === "number" ? hysteresis : useF ? 2 : 1; // Default 2°F or 1°C

  usbtemp.getTemperatures((err, data) => {
    if (err) {
      return res
        .status(500)
        .json({ error: "Failed to read temperature", message: err.message });
    }

    if (!data || data.length === 0) {
      return res.status(503).json({ error: "No temperature sensors found" });
    }

    const currentC = data[0];
    const currentF = (currentC * 9) / 5 + 32;
    const current = useF ? currentF : currentC;
    const target = targetTemp;

    let shouldBeOn = false;
    let reason = "";

    if (mode === "heat") {
      // Heat mode: turn ON if current < (target - hysteresis), OFF if current > target
      if (current < target - hyst) {
        shouldBeOn = true;
        reason = `Current ${current.toFixed(
          1
        )}° < Target ${target}° - Hysteresis ${hyst}°`;
      } else if (current > target) {
        shouldBeOn = false;
        reason = `Current ${current.toFixed(1)}° > Target ${target}°`;
      } else {
        // In dead band - maintain previous state (not available, default OFF)
        shouldBeOn = false;
        reason = `In dead band (${(target - hyst).toFixed(1)}° - ${target}°)`;
      }
    } else if (mode === "cool") {
      // Cool mode: turn ON if current > (target + hysteresis), OFF if current < target
      if (current > target + hyst) {
        shouldBeOn = true;
        reason = `Current ${current.toFixed(
          1
        )}° > Target ${target}° + Hysteresis ${hyst}°`;
      } else if (current < target) {
        shouldBeOn = false;
        reason = `Current ${current.toFixed(1)}° < Target ${target}°`;
      } else {
        // In dead band
        shouldBeOn = false;
        reason = `In dead band (${target}° - ${(target + hyst).toFixed(1)}°)`;
      }
    }

    return res.json({
      ok: true,
      shouldBeOn,
      currentTemp: Math.round(current * 10) / 10,
      targetTemp: target,
      unit: useF ? "F" : "C",
      mode,
      hysteresis: hyst,
      reason,
      timestamp: new Date().toISOString(),
    });
  });
});

const PORT = parseInt(process.env.PORT || "3005", 10);
app.listen(PORT, () => {
  console.log(`Relay server listening on http://localhost:${PORT}`);
  console.log(`  RELAY_ENABLED=${RELAY_ENABLED}`);
  console.log(`  RELAY_PORT=${RELAY_PORT}`);
  console.log(`  RELAY_DRIVER=${RELAY_DRIVER}`);
  console.log(`  RELAY_CONTROL_LINE=${RELAY_CONTROL_LINE}`);
  console.log(`  TEMP_SENSOR_ENABLED=${TEMP_SENSOR_ENABLED}`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down relay server");
  if (port && port.isOpen) port.close(() => process.exit(0));
  else process.exit(0);
});
