#!/usr/bin/env node
/**
 * ProStat Bridge - HomeKit HAP Controller (Node.js)
 * Alternative Node.js implementation using hap-controller
 *
 * Note: hap-controller may have different API than aiohomekit
 * This is a template - adjust based on actual library API
 */

import express from "express";
import cors from "cors";
// import { HAPController } from 'hap-controller'; // Uncomment when library is available

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 8080;
let controller = null;
const pairings = new Map();

// Initialize HAP Controller
async function initController() {
  // TODO: Initialize hap-controller
  // controller = new HAPController();
  // await controller.start();
  console.log("HAP Controller initialized");
}

// API Routes

app.get("/api/discover", async (req, res) => {
  try {
    // TODO: Implement discovery
    // const devices = await controller.discover();
    res.json({ devices: [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pair", async (req, res) => {
  try {
    const { device_id, pairing_code } = req.body;

    if (!device_id || !pairing_code) {
      return res
        .status(400)
        .json({ error: "device_id and pairing_code required" });
    }

    // TODO: Implement pairing
    // const pairing = await controller.pair(device_id, pairing_code);
    // pairings.set(device_id, pairing);

    res.json({ success: true, device_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/status", async (req, res) => {
  try {
    const { device_id } = req.query;

    if (!device_id) {
      return res.json({
        devices: Array.from(pairings.keys()).map((id) => ({ device_id: id })),
      });
    }

    // TODO: Get thermostat data
    // const pairing = pairings.get(device_id);
    // const data = await pairing.getCharacteristics([...]);

    res.json({ device_id, temperature: null, mode: "off" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/set-temperature", async (req, res) => {
  try {
    const { device_id, temperature } = req.body;

    if (!device_id || temperature === undefined) {
      return res
        .status(400)
        .json({ error: "device_id and temperature required" });
    }

    // TODO: Set temperature
    // const pairing = pairings.get(device_id);
    // await pairing.setCharacteristics([...]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/set-mode", async (req, res) => {
  try {
    const { device_id, mode } = req.body;

    if (!device_id || !mode) {
      return res.status(400).json({ error: "device_id and mode required" });
    }

    // TODO: Set mode
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/paired", (req, res) => {
  const devices = Array.from(pairings.keys()).map((id) => ({ device_id: id }));
  res.json({ devices });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Start server
async function main() {
  await initController();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ProStat Bridge listening on http://0.0.0.0:${PORT}`);
    console.log(
      "Note: This is a template. Install hap-controller and implement the TODO sections."
    );
  });
}

main().catch(console.error);
