import { describe, it, expect, beforeEach } from "vitest";
import {
  loadTips,
  saveTips,
  submitTip,
  approveTip,
  upvoteTip,
  getSortedTips,
} from "../tipsEngine";

describe("tipsEngine", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loads default tips when no storage exists", () => {
    const tips = loadTips();
    expect(Array.isArray(tips)).toBe(true);
    expect(tips.length).toBeGreaterThan(0);
  });

  it("submits a tip to moderation queue", () => {
    const tip = submitTip("Test Tip", "Test content", "TestUser");
    expect(tip.title).toBe("Test Tip");
    expect(tip.status).toBe("pending");
  });

  it("approves a tip and moves it to public tips", () => {
    const tip = submitTip("Approve Test", "Content here", "User1");
    approveTip(tip.id);
    const tips = getSortedTips();
    const approved = tips.find((t) => t.id === tip.id);
    expect(approved).toBeTruthy();
    expect(approved.title).toBe("Approve Test");
  });

  it("upvotes a tip and sorts by upvotes", () => {
    saveTips([
      { id: 1, title: "A", upvotes: 5 },
      { id: 2, title: "B", upvotes: 10 },
    ]);
    upvoteTip(1);
    const sorted = getSortedTips();
    expect(sorted[0].id).toBe(2); // B still higher
    expect(sorted[1].upvotes).toBe(6); // A now 6
  });
});
