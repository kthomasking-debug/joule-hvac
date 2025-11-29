/* eslint-env node */
/* global process */
import express from "express";
import si from "systeminformation";
import cors from "cors";
import { exec } from "child_process";
import { promisify } from "util";
import net from "net";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// --- Agentic Runtime Imports (local simple implementation) ---
// Lightweight in-process agent loop (rule-based fallback; upgradeable to LLM tool-calling)
// Files colocated here to avoid new server entrypoint for initial integration.

// Simple persistent memory store (JSON file) - loaded once and periodically flushed
// Use fileURLToPath + path.join for reliable Windows path resolution (avoid duplicated drive letter like C:\C:)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AGENT_MEMORY_PATH = path.join(__dirname, "agent-memory.json");
// Ensure file exists (create empty structure if missing)
try {
  if (!fs.existsSync(AGENT_MEMORY_PATH)) {
    fs.writeFileSync(
      AGENT_MEMORY_PATH,
      JSON.stringify({ goals: [], facts: [], settingsSnapshot: null }, null, 2)
    );
  }
} catch (err) {
  console.warn("⚠️ Agent memory initialization failed", err.message);
}
let agentMemory = { goals: [], facts: [], settingsSnapshot: null };
try {
  if (fs.existsSync(AGENT_MEMORY_PATH)) {
    agentMemory = JSON.parse(fs.readFileSync(AGENT_MEMORY_PATH, "utf-8"));
  }
} catch (err) {
  console.warn("⚠️ Agent memory load failed, starting fresh", err.message);
}
function persistAgentMemory() {
  try {
    fs.writeFileSync(AGENT_MEMORY_PATH, JSON.stringify(agentMemory, null, 2));
  } catch (err) {
    console.warn("⚠️ Agent memory persist failed", err.message);
  }
}
// Flush every 30s
setInterval(persistAgentMemory, 30000).unref();

// Track active agent runs (for future LLM loop cancellation)
const activeAgentRuns = new Map(); // runId -> { goal, startTs, abortController }
let runIdCounter = 0;

// Tool definitions (minimal initial set)
const agentTools = {
  getTime: async () => ({ time: new Date().toISOString() }),
  getCpuThermostatTemp: async () => {
    try {
      const temp = await si.cpuTemperature();
      return {
        mainF: temp.main ? temp.main / 2 : null,
        source: "systeminformation",
      };
    } catch (err) {
      return { error: "cpu_temp_unavailable", message: err.message };
    }
  },
  getJouleScore: async ({ seer, hspf }) => {
    const seerVal = seer || 15;
    const hspfVal = hspf || 9;
    const seerScore = Math.min(50, (seerVal / 18) * 50);
    const hspfScore = Math.min(50, (hspfVal / 10) * 50);
    return {
      seer: seerVal,
      hspf: hspfVal,
      seerComponent: +seerScore.toFixed(2),
      hspfComponent: +hspfScore.toFixed(2),
      jouleScore: Math.round(seerScore + hspfScore),
    };
  },
  rememberFact: async ({ fact }) => {
    if (fact) agentMemory.facts.unshift({ fact, ts: Date.now() });
    agentMemory.facts = agentMemory.facts.slice(0, 200);
    return { stored: !!fact, count: agentMemory.facts.length };
  },
  listFacts: async () => ({ facts: agentMemory.facts.slice(0, 25) }),
  snapshotSettings: async ({ settings }) => {
    if (settings)
      agentMemory.settingsSnapshot = { ...settings, ts: Date.now() };
    return { ok: true };
  },
  getSettingsSnapshot: async () => ({ settings: agentMemory.settingsSnapshot }),
  getJouleAnalysis: async ({ seer, hspf, capacity }) => {
    const seerVal = seer || 15;
    const hspfVal = hspf || 9;
    const seerScore = Math.min(50, (seerVal / 18) * 50);
    const hspfScore = Math.min(50, (hspfVal / 10) * 50);
    const jouleScore = Math.round(seerScore + hspfScore);
    // Upgrade suggestions
    const upgrades = [];
    if (seerVal < 18) {
      const newSeer = Math.min(18, seerVal + 2);
      const newSeerScore = Math.min(50, (newSeer / 18) * 50);
      const projectedScore = Math.round(newSeerScore + hspfScore);
      const savingsPct = ((newSeer - seerVal) / seerVal) * 5; // ~5% per SEER point
      upgrades.push({
        type: "SEER upgrade",
        from: seerVal,
        to: newSeer,
        projectedScore,
        estimatedSavingsPct: +savingsPct.toFixed(1),
      });
    }
    if (hspfVal < 10) {
      const newHspf = Math.min(10, hspfVal + 1);
      const newHspfScore = Math.min(50, (newHspf / 10) * 50);
      const projectedScore = Math.round(seerScore + newHspfScore);
      const savingsPct = ((newHspf - hspfVal) / hspfVal) * 6; // ~6% per HSPF point
      upgrades.push({
        type: "HSPF upgrade",
        from: hspfVal,
        to: newHspf,
        projectedScore,
        estimatedSavingsPct: +savingsPct.toFixed(1),
      });
    }
    return {
      jouleScore,
      seer: seerVal,
      hspf: hspfVal,
      capacity: capacity || null,
      seerComponent: +seerScore.toFixed(2),
      hspfComponent: +hspfScore.toFixed(2),
      upgrades,
    };
  },
};

// Very small heuristic planner choosing tools based on goal keywords
async function runHeuristicAgent(goal, push, runId = null, abortSignal = null) {
  const startTs = Date.now();
  agentMemory.goals.unshift({ goal, ts: startTs });
  agentMemory.goals = agentMemory.goals.slice(0, 100);
  push({ type: "goal", goal });
  const lower = goal.toLowerCase();
  const planned = [];
  if (/time|date|now/.test(lower)) planned.push({ name: "getTime", args: {} });
  if (/cpu|temperature|thermostat/.test(lower))
    planned.push({ name: "getCpuThermostatTemp", args: {} });
  if (/joule score|efficiency|seer|hspf/.test(lower)) {
    // Use detailed analysis if 'upgrade' or 'analysis' mentioned
    if (/upgrade|analysis|improve/.test(lower)) {
      planned.push({ name: "getJouleAnalysis", args: {} });
    } else {
      planned.push({ name: "getJouleScore", args: {} });
    }
  }
  if (/remember/.test(lower)) {
    // Extract fact, handling "and" clauses - take text before "and" if present
    let fact = goal.replace(/remember/i, "").trim();
    // If there's an "and" clause, only take the part before it
    const andMatch = fact.match(/^(.+?)\s+and\s+/i);
    if (andMatch) {
      fact = andMatch[1].trim();
    }
    if (fact) planned.push({ name: "rememberFact", args: { fact } });
  }
  if (/list facts|memory|recall/.test(lower))
    planned.push({ name: "listFacts", args: {} });
  if (planned.length === 0) {
    // Default exploratory step
    planned.push({ name: "getTime", args: {} });
  }

  push({ type: "plan", steps: planned.map((p) => p.name) });
  const results = [];
  for (const step of planned) {
    if (abortSignal?.aborted) {
      push({ type: "aborted", reason: "User cancelled" });
      break;
    }
    push({ type: "tool_call", tool: step.name, args: step.args });
    try {
      const out = await agentTools[step.name](step.args);
      results.push({ tool: step.name, output: out });
      push({ type: "tool_result", tool: step.name, output: out });
    } catch (e) {
      const errorObj = { error: e.message || "tool_failed" };
      results.push({ tool: step.name, output: errorObj });
      push({ type: "tool_error", tool: step.name, output: errorObj });
    }
  }
  // Simple summarizer (no LLM yet): compile JSON summary
  const summary = {
    goal,
    steps: results,
    meta: { durationMs: Date.now() - startTs },
  };
  push({ type: "final", output: summary });
  // Prune memory (time decay)
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  agentMemory.facts = agentMemory.facts.filter((f) => now - f.ts < sevenDays);
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  agentMemory.goals = agentMemory.goals.filter((g) => now - g.ts < threeDays);
  // Cleanup active run tracking
  if (runId && activeAgentRuns.has(runId)) activeAgentRuns.delete(runId);
}

const execAsync = promisify(exec);

const app = express();
app.use(cors());
app.use(express.json());

// Store latest ecobee data with history
let latestEcobeeData = {
  temperature: null,
  humidity: null,
  hvacMode: null,
  lastUpdate: null,
  updateCount: 0,
  trigger: null,
};

// Store history of updates (last 100)
let ecobeeHistory = [];

// Function to get CPU temp via WMI (Windows)
async function getWindowsCpuTemp() {
  try {
    // Try to get temp from Open Hardware Monitor WMI namespace
    const { stdout } = await execAsync(
      "powershell -NoProfile -Command \"$sensor = Get-CimInstance -Namespace root/OpenHardwareMonitor -ClassName Sensor | Where-Object {$_.SensorType -eq 'Temperature' -and $_.Name -like 'CPU*'} | Select-Object -First 1; if ($sensor) { $sensor.Value } else { 0 }\""
    );

    const temp = parseFloat(stdout.trim());
    if (!isNaN(temp) && temp > 0) {
      console.log(`✅ Got CPU temp from Open Hardware Monitor: ${temp}°C`);
      return temp;
    }
  } catch (err) {
    console.log("⚠️  Open Hardware Monitor WMI not available:", err.message);
  }

  try {
    // Try WMI MSAcpi_ThermalZoneTemperature (less reliable but doesn't need OHM)
    const { stdout } = await execAsync(
      'powershell -NoProfile -Command "$temp = Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature | Select-Object -First 1; if ($temp) { $temp.CurrentTemperature } else { 0 }"'
    );

    const kelvin = parseFloat(stdout.trim());
    if (!isNaN(kelvin) && kelvin > 0) {
      // Convert from deciskelvin to Celsius
      const celsius = kelvin / 10 - 273.15;
      console.log(`✅ Got CPU temp from WMI thermal zone: ${celsius}°C`);
      return celsius;
    }
  } catch (err) {
    console.log("⚠️  WMI thermal zone not available:", err.message);
  }

  return null;
}

// CPU temperature endpoint
app.get("/api/temperature/cpu", async (req, res) => {
  try {
    // First try Windows WMI (Open Hardware Monitor or native WMI)
    let cpuTemp = await getWindowsCpuTemp();
    let source = "wmi";

    // Fallback to systeminformation
    if (cpuTemp === null || cpuTemp === 0) {
      const temp = await si.cpuTemperature();
      cpuTemp = temp.main;
      source = "systeminformation";
    }

    // If still no valid temp, use simulated value
    if (cpuTemp === 0 || cpuTemp == null) {
      cpuTemp = 140; // 140°F ÷ 2 = 70°F for thermostat
      source = "simulated";
      console.log(
        "⚠️  CPU temp unavailable. Using simulated: 140°F → 70°F. Install Open Hardware Monitor for real temps."
      );
    }

    // Divide by 2 for thermostat bench testing
    const thermostatTemp = {
      main: cpuTemp / 2,
      cores: [],
      max: cpuTemp / 2,
      originalMain: cpuTemp,
      originalMax: cpuTemp,
      source: source,
    };

    res.json(thermostatTemp);
  } catch (error) {
    console.error("Temperature read error:", error);
    res.status(500).json({ error: "Failed to read temperature" });
  }
});

// Ecobee temperature endpoint
app.get("/api/temperature/ecobee", (req, res) => {
  if (!latestEcobeeData.temperature) {
    return res.status(404).json({
      error: "No Ecobee data available",
      message: "Waiting for IFTTT webhook or manual update",
    });
  }

  res.json({
    ...latestEcobeeData,
    source: "ecobee",
  });
});

// IFTTT Webhook endpoint for Ecobee updates
app.post("/api/ecobee-webhook", (req, res) => {
  try {
    const newData = {
      temperature: parseFloat(req.body.temperature) || null,
      humidity: parseFloat(req.body.humidity) || null,
      hvacMode: req.body.hvacMode || req.body.mode || null,
      trigger: req.body.trigger || "webhook",
      timestamp: new Date().toISOString(),
    };

    // Update current data
    latestEcobeeData = {
      ...newData,
      lastUpdate: new Date(),
      updateCount: (latestEcobeeData.updateCount || 0) + 1,
    };

    // Add to history (keep last 100 updates)
    ecobeeHistory.unshift(newData);
    if (ecobeeHistory.length > 100) {
      ecobeeHistory.pop();
    }

    console.log("📡 Received Ecobee update:", latestEcobeeData);
    res.status(200).json({ status: "ok", data: latestEcobeeData });
  } catch (err) {
    console.error("Error processing Ecobee webhook:", err);
    res.status(500).json({ error: "Failed to process webhook" });
  }
});

// Manual update endpoint for testing
app.post("/api/ecobee-update", (req, res) => {
  try {
    const newData = {
      temperature:
        parseFloat(req.body.temperature) || latestEcobeeData.temperature,
      humidity: parseFloat(req.body.humidity) || latestEcobeeData.humidity,
      hvacMode: req.body.hvacMode || latestEcobeeData.hvacMode,
      trigger: "manual",
      timestamp: new Date().toISOString(),
    };

    latestEcobeeData = {
      ...newData,
      lastUpdate: new Date(),
      updateCount: (latestEcobeeData.updateCount || 0) + 1,
    };

    // Add to history
    ecobeeHistory.unshift(newData);
    if (ecobeeHistory.length > 100) {
      ecobeeHistory.pop();
    }

    console.log("✏️  Manual Ecobee update:", latestEcobeeData);
    res.json({ status: "ok", data: latestEcobeeData });
  } catch (err) {
    console.error("Manual update error:", err);
    res.status(500).json({ error: "Failed to update Ecobee data" });
  }
});

// Manual HVAC mode setter endpoint
app.post("/api/ecobee/hvac-mode", (req, res) => {
  try {
    const mode = req.body.mode || req.body.hvacMode;

    if (!mode) {
      return res.status(400).json({
        error: "Missing mode parameter",
        message: "Provide mode or hvacMode in request body",
      });
    }

    // Update only the hvacMode, preserve other data
    latestEcobeeData = {
      ...latestEcobeeData,
      hvacMode: mode,
      lastUpdate: new Date(),
      updateCount: (latestEcobeeData.updateCount || 0) + 1,
    };

    // Add to history
    const historyEntry = {
      temperature: latestEcobeeData.temperature,
      humidity: latestEcobeeData.humidity,
      hvacMode: mode,
      trigger: "manual_mode",
      timestamp: new Date().toISOString(),
    };

    ecobeeHistory.unshift(historyEntry);
    if (ecobeeHistory.length > 100) {
      ecobeeHistory.pop();
    }

    console.log(`🔧 HVAC mode set to: ${mode}`);
    res.json({ status: "ok", mode: mode, data: latestEcobeeData });
  } catch (err) {
    console.error("HVAC mode update error:", err);
    res.status(500).json({ error: "Failed to set HVAC mode" });
  }
});

// Legacy combined endpoint (backwards compatible)
app.get("/api/temperature", async (req, res) => {
  try {
    const temp = await si.cpuTemperature();

    // Divide by 2 for thermostat bench testing
    const thermostatTemp = {
      main: temp.main / 2,
      cores: temp.cores?.map((t) => t / 2) || [],
      max: temp.max / 2,
      originalMain: temp.main,
      originalMax: temp.max,
    };

    res.json(thermostatTemp);
  } catch (error) {
    console.error("Temperature read error:", error);
    res.status(500).json({ error: "Failed to read temperature" });
  }
});

// Ecobee history endpoint
app.get("/api/ecobee/history", (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json({
    history: ecobeeHistory.slice(0, limit),
    total: ecobeeHistory.length,
  });
});

// --- Agent SSE Endpoint ---
// POST /api/agent  { goal: string, settings?: object }
// Streams planning + tool execution events; final message contains summary
app.post("/api/agent", async (req, res) => {
  try {
    const { goal, settings } = req.body || {};
    if (!goal) {
      return res.status(400).json({
        error: "missing_goal",
        message: "Provide goal in request body",
      });
    }
    // Optional auth enforcement if server started with AGENT_API_KEY
    const requiredKey = process.env.AGENT_API_KEY;
    if (requiredKey) {
      const provided = req.headers["x-agent-key"];
      if (!provided || provided !== requiredKey) {
        return res.status(401).json({
          error: "unauthorized",
          message: "Invalid or missing agent key",
        });
      }
    }

    // Set SSE headers BEFORE any async operations that might fail
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Track this run for potential cancellation
    const runId = ++runIdCounter;
    const abortController = new AbortController();
    activeAgentRuns.set(runId, { goal, startTs: Date.now(), abortController });
    res.setHeader("X-Run-Id", runId.toString());
    res.flushHeaders?.();

    const push = (event) => {
      try {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch (writeErr) {
        console.warn("Agent SSE write failed", writeErr?.message);
      }
    };

    // Handle settings snapshot (may fail, but shouldn't stop execution)
    if (settings) {
      try {
        await agentTools.snapshotSettings({ settings });
      } catch (settingsErr) {
        console.warn("Settings snapshot failed", settingsErr?.message);
        push({ type: "warning", message: "Settings snapshot failed" });
      }
    }

    await runHeuristicAgent(goal, push, runId, abortController.signal);
    res.end();
  } catch (err) {
    console.error("Agent endpoint error", err);
    // Check if headers were already sent
    if (!res.headersSent) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.status(500);
      res.flushHeaders?.();
    }
    try {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          status: 500,
          message: err.message,
          stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
        })}\n\n`
      );
    } catch (writeErr) {
      console.warn("Agent SSE write failed", writeErr?.message);
    }
    res.end();
  }
});

// Memory inspection endpoint
app.get("/api/agent/memory", (req, res) => {
  const now = Date.now();
  res.json({
    goalsCount: agentMemory.goals.length,
    factsCount: agentMemory.facts.length,
    hasSettingsSnapshot: !!agentMemory.settingsSnapshot,
    latestGoalAgeMs: agentMemory.goals[0]
      ? now - agentMemory.goals[0].ts
      : null,
    latestFactAgeMs: agentMemory.facts[0]
      ? now - agentMemory.facts[0].ts
      : null,
  });
});

// --- TEST ONLY: Seed memory with custom timestamped goals/facts for pruning verification ---
// Not secured; intended solely for automated test environment. Avoid enabling in production.
app.post("/api/agent/seed-memory", (req, res) => {
  try {
    const { goals = [], facts = [] } = req.body || {};
    agentMemory.goals = goals.map((g) => ({
      goal: g.goal || g.text || String(g.goal || g),
      ts: typeof g.ts === "number" ? g.ts : Date.now(),
    }));
    agentMemory.facts = facts.map((f) => ({
      fact: f.fact || String(f.fact || f),
      ts: typeof f.ts === "number" ? f.ts : Date.now(),
    }));
    persistAgentMemory();
    res.json({
      seeded: true,
      goalsCount: agentMemory.goals.length,
      factsCount: agentMemory.facts.length,
    });
  } catch (e) {
    res.status(500).json({ error: "seed_failed", message: e.message });
  }
});

// Cancel active agent run
app.delete("/api/agent/:runId", (req, res) => {
  const runId = parseInt(req.params.runId, 10);
  const run = activeAgentRuns.get(runId);
  if (!run) {
    return res.status(404).json({ error: "run_not_found", runId });
  }
  run.abortController.abort();
  activeAgentRuns.delete(runId);
  res.json({ cancelled: true, runId, goal: run.goal });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "temperature-api",
    ecobeeConnected: !!latestEcobeeData.temperature,
    lastEcobeeUpdate: latestEcobeeData.lastUpdate,
    updateCount: latestEcobeeData.updateCount || 0,
    historySize: ecobeeHistory.length,
  });
});

// Allow overriding port for parallel test runs / avoiding EADDRINUSE
const PORT = process.env.TEMP_SERVER_PORT || 3001;

// Graceful start: check if port is already in use; if so, reuse existing instance without crashing
function startTemperatureApi(port) {
  const tester = net.createServer();
  tester.once("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(
        `⚠️  Port ${port} already in use. Assuming Temperature API is running; skipping duplicate startup.`
      );
    } else {
      console.error("Unexpected port test error:", err);
    }
  });
  tester.once("listening", () => {
    tester.close(() => {
      const server = app.listen(port, () => {
        console.log(`🌡️  Temperature API running on port ${port}`);
        console.log(
          `   CPU Temperature: http://localhost:${port}/api/temperature/cpu`
        );
        console.log(
          `   Ecobee Data: http://localhost:${port}/api/temperature/ecobee`
        );
        console.log(
          `   IFTTT Webhook: http://localhost:${port}/api/ecobee-webhook`
        );
        console.log(
          `   Manual Update: POST http://localhost:${port}/api/ecobee-update`
        );
        console.log(
          `   Set HVAC Mode: POST http://localhost:${port}/api/ecobee/hvac-mode`
        );
        console.log(`   History: http://localhost:${port}/api/ecobee/history`);
        console.log(`   Health Check: http://localhost:${port}/api/health`);
      });
      // Extra safeguard in case of late EADDRINUSE (rare)
      server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.log(
            `⚠️  Port ${port} became busy during startup. Skipping second instance.`
          );
        } else {
          console.error("Server error:", err);
        }
      });
    });
  });
  tester.listen(port);
}

startTemperatureApi(PORT);

export default app; // optional: allows importing in tests if needed
