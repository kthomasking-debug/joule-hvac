import { describe, it, expect, beforeEach } from "vitest";
import {
  recordPreferenceEvent,
  analyzePreferences,
} from "../preferenceLearner";

let store = {};

beforeEach(() => {
  store = {};
  global.localStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => {
      store[k] = v;
    },
    removeItem: (k) => {
      delete store[k];
    },
  };
});

describe("preferenceLearner", () => {
  it("records temperature events and computes averages", () => {
    // Simulate day temps
    for (let h = 8; h <= 10; h++) {
      const temp = 70 + (h - 8);
      // Fake time by monkey patching Date
      const RealDate = Date;
      global.Date = class extends RealDate {
        constructor() {
          super();
        }
        getHours() {
          return h;
        }
        getDay() {
          return 2;
        }
      }; // Tuesday
      recordPreferenceEvent({
        intent: "setTemperature",
        updates: { targetTemp: temp },
      });
      global.Date = RealDate;
    }
    const prefs = analyzePreferences();
    expect(prefs.avgDayTemp).toBeGreaterThan(70);
    expect(prefs.schedule.length).toBeGreaterThan(0);
  });

  it("suggests nighttime setback if delta small", () => {
    const RealDate = Date;
    // Day temps ~72
    for (let i = 0; i < 3; i++) {
      global.Date = class extends RealDate {
        constructor() {
          super();
        }
        getHours() {
          return 9;
        }
        getDay() {
          return 3;
        }
      };
      recordPreferenceEvent({
        intent: "setTemperature",
        updates: { targetTemp: 72 },
      });
    }
    // Night temps ~71 (small delta)
    for (let i = 0; i < 3; i++) {
      global.Date = class extends RealDate {
        constructor() {
          super();
        }
        getHours() {
          return 23;
        }
        getDay() {
          return 3;
        }
      };
      recordPreferenceEvent({
        intent: "setTemperature",
        updates: { targetTemp: 71 },
      });
    }
    global.Date = RealDate;
    const prefs = analyzePreferences();
    expect(prefs.suggestions.some((s) => /nighttime setback/i.test(s))).toBe(
      true
    );
  });
});
