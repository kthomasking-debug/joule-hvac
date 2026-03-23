// Client-side agent implementation - no server needed!
// Uses localStorage for memory persistence

const AGENT_MEMORY_KEY = "agent_memory";

function parseLabeledNumber(input, label) {
  const rx = new RegExp(`${label}\\s*(?:is|=|:)?\\s*(-?\\d+(?:\\.\\d+)?)`, "i");
  const match = input.match(rx);
  return match ? Number(match[1]) : null;
}

function parseCalorieArgs(goalText) {
  const lower = goalText.toLowerCase();
  const args = {};

  const unitSystem = /\bmetric\b|\bcm\b|\bkg\b/.test(lower)
    ? "metric"
    : "imperial";
  args.unitSystem = unitSystem;

  const heightLabeled = parseLabeledNumber(goalText, "height");
  const weightLabeled = parseLabeledNumber(goalText, "weight");
  const stepsLabeled = parseLabeledNumber(goalText, "steps");
  const ageLabeled = parseLabeledNumber(goalText, "age");

  if (heightLabeled != null) args.height = heightLabeled;
  if (weightLabeled != null) args.weight = weightLabeled;
  if (stepsLabeled != null) args.steps = stepsLabeled;
  if (ageLabeled != null) args.age = ageLabeled;

  // Fallbacks for free-form phrasing when labels are omitted.
  if (args.height == null) {
    if (unitSystem === "metric") {
      const cmMatch = lower.match(/(\d+(?:\.\d+)?)\s*cm\b/);
      if (cmMatch) args.height = Number(cmMatch[1]);
    } else {
      const inMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\b/);
      const ftInMatch = lower.match(/(\d+)\s*(?:ft|')\s*(\d{1,2})\s*(?:in|"|inches)?/);
      if (ftInMatch) {
        args.height = Number(ftInMatch[1]) * 12 + Number(ftInMatch[2]);
      } else if (inMatch) {
        args.height = Number(inMatch[1]);
      }
    }
  }

  if (args.weight == null) {
    if (unitSystem === "metric") {
      const kgMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilogram|kilograms)\b/);
      if (kgMatch) args.weight = Number(kgMatch[1]);
    } else {
      const lbMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|pound|pounds)\b/);
      if (lbMatch) args.weight = Number(lbMatch[1]);
    }
  }

  if (args.steps == null) {
    const stepMatch = lower.match(/(\d{3,6})\s*steps?\b/);
    if (stepMatch) args.steps = Number(stepMatch[1]);
  }

  if (/\bfemale\b/.test(lower)) args.sex = "female";
  else if (/\bmale\b/.test(lower)) args.sex = "male";

  if (/\blose|weight loss|cut\b/.test(lower)) args.goal = "lose";
  else if (/\bgain|bulk\b/.test(lower)) args.goal = "gain";
  else if (/\bmaintain|maintenance\b/.test(lower)) args.goal = "maintain";

  return args;
}

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

  calculateDailyCalories: async ({
    height,
    weight,
    steps = 0,
    age = 30,
    sex = "male",
    unitSystem = "imperial",
    goal = "maintain",
  }) => {
    if (height == null || weight == null) {
      return {
        error: true,
        message: "height and weight are required",
      };
    }

    const heightNum = Number(height);
    const weightNum = Number(weight);
    const stepsNum = Math.max(0, Number(steps) || 0);
    const ageNum = Math.max(1, Number(age) || 30);

    if (!Number.isFinite(heightNum) || !Number.isFinite(weightNum)) {
      return {
        error: true,
        message: "height and weight must be valid numbers",
      };
    }

    const heightCm =
      unitSystem === "metric" ? heightNum : Math.max(0, heightNum) * 2.54;
    const weightKg =
      unitSystem === "metric" ? weightNum : Math.max(0, weightNum) * 0.453592;

    if (heightCm <= 0 || weightKg <= 0) {
      return {
        error: true,
        message: "height and weight must be greater than zero",
      };
    }

    const sexNormalized = String(sex).toLowerCase();
    const warnings = [];

    if (unitSystem === "metric") {
      if (heightNum < 120 || heightNum > 230)
        warnings.push("Height looks outside a typical adult range (120-230 cm)");
      if (weightNum < 35 || weightNum > 230)
        warnings.push("Weight looks outside a typical adult range (35-230 kg)");
    } else {
      if (heightNum < 48 || heightNum > 90)
        warnings.push("Height looks outside a typical adult range (48-90 in)");
      if (weightNum < 80 || weightNum > 500)
        warnings.push("Weight looks outside a typical adult range (80-500 lb)");
    }
    if (ageNum < 16 || ageNum > 90)
      warnings.push("Age is outside a typical adult range (16-90)");
    if (stepsNum > 40000)
      warnings.push("Steps value is unusually high; double-check daily step count");

    const sexOffset = sexNormalized === "female" ? -161 : 5;
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageNum + sexOffset;

    let activityMultiplier = 1.2;
    if (stepsNum >= 12000) activityMultiplier = 1.75;
    else if (stepsNum >= 10000) activityMultiplier = 1.6;
    else if (stepsNum >= 7500) activityMultiplier = 1.45;
    else if (stepsNum >= 5000) activityMultiplier = 1.35;

    const maintenanceCalories = bmr * activityMultiplier;

    let adjustment = 0;
    const goalNormalized = String(goal).toLowerCase();
    if (goalNormalized === "lose") adjustment = -500;
    if (goalNormalized === "gain") adjustment = 300;

    const recommendedCalories = Math.max(1200, maintenanceCalories + adjustment);
    const weightLb = weightKg * 2.20462;
    const proteinPerLb =
      goalNormalized === "lose" ? 1.0 : goalNormalized === "gain" ? 0.9 : 0.8;
    const fatRatio =
      goalNormalized === "maintain" ? 0.3 : goalNormalized === "lose" ? 0.28 : 0.27;
    const proteinG = Math.round(weightLb * proteinPerLb);
    const fatG = Math.round((recommendedCalories * fatRatio) / 9);
    const carbsG = Math.max(
      0,
      Math.round((recommendedCalories - proteinG * 4 - fatG * 9) / 4)
    );

    if (recommendedCalories < 1400)
      warnings.push("Estimated calories are low; verify values and consider professional guidance");

    return {
      success: true,
      inputs: {
        height,
        weight,
        steps: stepsNum,
        age: ageNum,
        sex: sexNormalized,
        unitSystem,
        goal: goalNormalized,
      },
      bmr: Math.round(bmr),
      activityMultiplier,
      maintenanceCalories: Math.round(maintenanceCalories),
      recommendedCalories: Math.round(recommendedCalories),
      macroTargets: {
        proteinG,
        carbsG,
        fatG,
      },
      warnings,
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
  if (/calori|calorie|caloric|intake|steps|weight|height|bmr|tdee/.test(lower)) {
    planned.push({
      name: "calculateDailyCalories",
      args: parseCalorieArgs(goal),
    });
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
