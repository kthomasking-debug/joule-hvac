// Client-side agent implementation - no server needed!
// Uses localStorage for memory persistence

const AGENT_MEMORY_KEY = "agent_memory";

// Load agent memory from localStorage
function loadAgentMemory() {
  try {
    const stored = localStorage.getItem(AGENT_MEMORY_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.warn("Failed to load agent memory:", err);
  }
  return { goals: [], facts: [], settingsSnapshot: null };
}

// Save agent memory to localStorage
function saveAgentMemory(memory) {
  try {
    localStorage.setItem(AGENT_MEMORY_KEY, JSON.stringify(memory));
  } catch (err) {
    console.warn("Failed to save agent memory:", err);
  }
}

// Agent tools (client-side versions)
const agentTools = {
  getTime: async () => ({ time: new Date().toISOString() }),

  getCpuThermostatTemp: async () => {
    // Try to get from window if available (from temperature hooks or external thermometer)
    if (window.__CURRENT_TEMP__) {
      return {
        mainF: window.__CURRENT_TEMP__,
        source: "client-side",
      };
    }
    // Check if temperature server is available (optional - for backward compatibility)
    try {
      const response = await fetch("http://localhost:3001/api/temperature/cpu");
      if (response.ok) {
        const data = await response.json();
        return {
          mainF: data.mainF || data.temperature,
          source: data.source || "temperature-server",
        };
      }
    } catch {
      // Server not available - that's okay, we'll use external thermometer later
    }
    return {
      error: "temperature_unavailable",
      message:
        "Temperature data not available. Connect an external thermometer or start the temperature server.",
    };
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

  rememberFact: async ({ fact }, memory) => {
    if (fact) {
      memory.facts.unshift({ fact, ts: Date.now() });
      memory.facts = memory.facts.slice(0, 200);
      saveAgentMemory(memory);
    }
    return { stored: !!fact, count: memory.facts.length };
  },

  listFacts: async () => {
    const memory = loadAgentMemory();
    return { facts: memory.facts.slice(0, 25) };
  },

  snapshotSettings: async ({ settings }, memory) => {
    if (settings) {
      memory.settingsSnapshot = { ...settings, ts: Date.now() };
      saveAgentMemory(memory);
    }
    return { ok: true };
  },

  getSettingsSnapshot: async () => {
    const memory = loadAgentMemory();
    return { settings: memory.settingsSnapshot };
  },

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
      const savingsPct = ((newSeer - seerVal) / seerVal) * 5;
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
      const savingsPct = ((newHspf - hspfVal) / hspfVal) * 6;
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

// Heuristic planner
function planAgentSteps(goal) {
  const lower = goal.toLowerCase();
  const planned = [];

  if (/time|date|now/.test(lower)) planned.push({ name: "getTime", args: {} });
  if (/cpu|temperature|thermostat/.test(lower))
    planned.push({ name: "getCpuThermostatTemp", args: {} });
  if (/joule score|efficiency|seer|hspf/.test(lower)) {
    if (/upgrade|analysis|improve/.test(lower)) {
      planned.push({ name: "getJouleAnalysis", args: {} });
    } else {
      planned.push({ name: "getJouleScore", args: {} });
    }
  }
  if (/remember/.test(lower)) {
    let fact = goal.replace(/remember/i, "").trim();
    const andMatch = fact.match(/^(.+?)\s+and\s+/i);
    if (andMatch) {
      fact = andMatch[1].trim();
    }
    if (fact) planned.push({ name: "rememberFact", args: { fact } });
  }
  if (/list facts|memory|recall/.test(lower))
    planned.push({ name: "listFacts", args: {} });
  if (planned.length === 0) {
    planned.push({ name: "getTime", args: {} });
  }

  return planned;
}

// Run agent (client-side, returns async generator for SSE-like streaming)
export async function* runAgentClient(goal, settings, abortSignal) {
  const startTs = Date.now();
  const memory = loadAgentMemory();

  // Store goal
  memory.goals.unshift({ goal, ts: startTs });
  memory.goals = memory.goals.slice(0, 100);
  saveAgentMemory(memory);

  yield { type: "goal", goal };

  // Plan steps
  const planned = planAgentSteps(goal);
  yield { type: "plan", steps: planned.map((p) => p.name) };

  // Handle settings snapshot
  if (settings) {
    try {
      await agentTools.snapshotSettings({ settings }, memory);
    } catch {
      yield { type: "warning", message: "Settings snapshot failed" };
    }
  }

  // Execute steps
  const results = [];
  for (const step of planned) {
    if (abortSignal?.aborted) {
      yield { type: "aborted", reason: "User cancelled" };
      break;
    }

    yield { type: "tool_call", tool: step.name, args: step.args };

    try {
      // Some tools need memory, pass it along
      const tool = agentTools[step.name];
      const out =
        step.name === "rememberFact" || step.name === "snapshotSettings"
          ? await tool(step.args, memory)
          : await tool(step.args);

      results.push({ tool: step.name, output: out });
      yield { type: "tool_result", tool: step.name, output: out };
    } catch (e) {
      const errorObj = { error: e.message || "tool_failed" };
      results.push({ tool: step.name, output: errorObj });
      yield { type: "tool_error", tool: step.name, output: errorObj };
    }
  }

  // Prune memory (time decay)
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  memory.facts = memory.facts.filter((f) => now - f.ts < sevenDays);
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  memory.goals = memory.goals.filter((g) => now - g.ts < threeDays);
  saveAgentMemory(memory);

  // Final summary
  const summary = {
    goal,
    steps: results,
    meta: { durationMs: Date.now() - startTs },
  };
  yield { type: "final", output: summary };
}
