// src/lib/savings/savingsAccount.js
// Logic for tracking cumulative energy/cost savings, goals, and milestones

const STORAGE_KEY = "energySavingsAccount";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { totalSavings: 0, events: [], goals: [], milestones: [] };
    const parsed = JSON.parse(raw);
    return {
      totalSavings: Number(parsed.totalSavings) || 0,
      events: Array.isArray(parsed.events) ? parsed.events : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      milestones: Array.isArray(parsed.milestones) ? parsed.milestones : [],
    };
  } catch {
    return { totalSavings: 0, events: [], goals: [], milestones: [] };
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore localStorage errors
  }
}

export function recordSavings(amount, meta = {}) {
  if (!Number.isFinite(Number(amount)) || amount <= 0) return loadState();
  const state = loadState();
  const evt = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    amount: Number(amount),
    ts: new Date().toISOString(),
    meta,
  };
  state.events.push(evt);
  state.totalSavings =
    Math.round((state.totalSavings + evt.amount) * 100) / 100;

  // Auto-milestones at $50, $100, every $250 beyond
  const nextMilestoneTargets = [50, 100];
  const dynamicTarget = Math.floor(state.totalSavings / 250) * 250 + 250; // next 250 block
  nextMilestoneTargets.push(dynamicTarget);
  const achieved = nextMilestoneTargets.filter(
    (t) =>
      state.totalSavings >= t && !state.milestones.find((m) => m.target === t)
  );
  for (const target of achieved) {
    state.milestones.push({ target, achievedAt: evt.ts });
  }

  saveState(state);
  return state;
}

export function getAccount() {
  return loadState();
}

export function resetAccount() {
  const empty = { totalSavings: 0, events: [], goals: [], milestones: [] };
  saveState(empty);
  return empty;
}

export function addGoal(target, label = "") {
  if (!Number.isFinite(Number(target)) || target <= 0) return loadState();
  const state = loadState();
  const goal = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    target: Number(target),
    label,
    achieved: false,
    achievedAt: null,
  };
  state.goals.push(goal);
  saveState(state);
  return state;
}

export function evaluateGoals() {
  const state = loadState();
  let changed = false;
  for (const g of state.goals) {
    if (!g.achieved && state.totalSavings >= g.target) {
      g.achieved = true;
      g.achievedAt = new Date().toISOString();
      changed = true;
    }
  }
  if (changed) saveState(state);
  return state;
}

export function getProgress() {
  const { totalSavings, goals, milestones } = loadState();
  const nextGoal =
    goals.filter((g) => !g.achieved).sort((a, b) => a.target - b.target)[0] ||
    null;
  const progressToNext = nextGoal
    ? Math.min(1, totalSavings / nextGoal.target)
    : 1;
  return { totalSavings, goals, milestones, nextGoal, progressToNext };
}

export function getRecentEvents(limit = 10) {
  const { events } = loadState();
  return events.slice(-limit).reverse();
}
