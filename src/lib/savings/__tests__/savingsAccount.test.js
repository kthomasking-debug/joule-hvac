import { describe, it, expect, beforeEach } from "vitest";
import {
  recordSavings,
  getAccount,
  resetAccount,
  addGoal,
  evaluateGoals,
  getProgress,
  getRecentEvents,
} from "../savingsAccount";

// Simple localStorage mock
const store = {};
beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  global.localStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => {
      store[k] = v;
    },
    removeItem: (k) => {
      delete store[k];
    },
  };
  resetAccount();
});

describe("savingsAccount", () => {
  it("records savings events and updates total", () => {
    recordSavings(12.34, { source: "optimizer" });
    recordSavings(7.66);
    const acct = getAccount();
    expect(acct.totalSavings).toBeCloseTo(20.0, 1);
    expect(acct.events.length).toBe(2);
  });

  it("ignores invalid savings amounts", () => {
    recordSavings(-5);
    recordSavings("abc");
    const acct = getAccount();
    expect(acct.totalSavings).toBe(0);
    expect(acct.events.length).toBe(0);
  });

  it("adds goals and evaluates achievements", () => {
    addGoal(25, "First Goal");
    recordSavings(10);
    evaluateGoals();
    let acct = getAccount();
    expect(acct.goals[0].achieved).toBe(false);
    recordSavings(20);
    evaluateGoals();
    acct = getAccount();
    expect(acct.goals[0].achieved).toBe(true);
    expect(acct.goals[0].achievedAt).toBeTruthy();
  });

  it("computes progress to next goal", () => {
    addGoal(50, "Goal A");
    recordSavings(10);
    const prog = getProgress();
    expect(prog.nextGoal.target).toBe(50);
    expect(prog.progressToNext).toBeCloseTo(0.2, 1);
  });

  it("returns recent events newest first", () => {
    for (let i = 1; i <= 12; i++) recordSavings(i);
    const recent = getRecentEvents(5);
    expect(recent.length).toBe(5);
    expect(recent[0].amount).toBe(12);
    expect(recent[4].amount).toBe(8);
  });

  it("creates milestones at thresholds", () => {
    recordSavings(55);
    const acct = getAccount();
    expect(acct.milestones.find((m) => m.target === 50)).toBeTruthy();
  });
});
