// src/components/__tests__/AskJoule.enhanced.test.js
import { describe, it, expect } from "vitest";
import { parseAskJoule } from "../AskJoule";

describe("Enhanced AskJoule - Context-Aware Commands", () => {
  const mockContext = {
    userSettings: {
      hspf2: 8.5,
      efficiency: 14.5,
      winterThermostat: 70,
      summerThermostat: 74,
    },
    userLocation: { city: "Chicago", state: "Illinois" },
    annualEstimate: { totalCost: 2000, heatingCost: 1200, coolingCost: 800 },
  };

  describe("Quick Actions", () => {
    it("parses set winter thermostat command", () => {
      const result = parseAskJoule("set winter to 68", mockContext);
      expect(result.isCommand).toBe(true);
      expect(result.action).toBe("setWinterTemp");
      expect(result.value).toBe(68);
    });

    it("parses set winter thermostat phrase with 'thermostat'", () => {
      const result = parseAskJoule("set winter thermostat to 72", mockContext);
      expect(result.isCommand).toBe(true);
      expect(result.action).toBe("setWinterTemp");
      expect(result.value).toBe(72);
    });

    it("parses set thermostat winter to 72", () => {
      const result = parseAskJoule("set thermostat winter to 72", mockContext);
      expect(result.isCommand).toBe(true);
      expect(result.action).toBe("setWinterTemp");
      expect(result.value).toBe(72);
    });

    it("parses set summer thermostat command", () => {
      const result = parseAskJoule("set summer to 76", mockContext);
      expect(result.isCommand).toBe(true);
      expect(result.action).toBe("setSummerTemp");
      expect(result.value).toBe(76);
    });

    it("parses show me location command", () => {
      const result = parseAskJoule("show me Phoenix", mockContext);
      expect(result.isCommand).toBe(true);
      expect(result.action).toBe("navigate");
      expect(result.target).toBe("forecast");
      expect(result.cityName).toBe("Phoenix");
    });

    it("parses comparison command", () => {
      const result = parseAskJoule("compare", mockContext);
      expect(result.isCommand).toBe(true);
      expect(result.action).toBe("navigate");
      expect(result.target).toBe("comparison");
    });

    it("parses run analyzer command", () => {
      const result = parseAskJoule("run analyzer", mockContext);
      expect(result.isCommand).toBe(true);
      expect(result.action).toBe("navigate");
      expect(result.target).toBe("analyzer");
    });

    it("parses upgrade/ROI command", () => {
      const result = parseAskJoule("upgrade options", mockContext);
      expect(result.isCommand).toBe(true);
      expect(result.action).toBe("navigate");
      expect(result.target).toBe("roi");
    });
    it("parses set hspf command", () => {
      const result = parseAskJoule("set HSPF to 11", mockContext);
      expect(result.isCommand).toBe(true);
      expect(result.action).toBe("setHSPF");
      expect(result.value).toBe(11);
    });
    it("parses set seer command", () => {
      const result = parseAskJoule("set SEER to 18", mockContext);
      expect(result.isCommand).toBe(true);
      expect(result.action).toBe("setSEER");
      expect(result.value).toBe(18);
    });
    it("parses set utility cost command", () => {
      const result = parseAskJoule("set utility cost to $0.12", mockContext);
      expect(result.isCommand).toBe(true);
      expect(result.action).toBe("setUtilityCost");
      expect(result.value).toBeCloseTo(0.12, 3);
    });
    it("parses set location command", () => {
      const result = parseAskJoule("set location to Denver, CO", mockContext);
      expect(result.isCommand).toBe(true);
      expect(result.action).toBe("setLocation");
      expect(result.cityName).toBe("Denver, CO");
    });
  });

  describe("Info Queries", () => {
    it("parses what can I save query", () => {
      const result = parseAskJoule("what can I save", mockContext);
      expect(result.isCommand).toBe(true);
      expect(result.action).toBe("showSavings");
    });

    it("parses my score query", () => {
      const result = parseAskJoule("my joule score", mockContext);
      expect(result.isCommand).toBe(true);
      expect(result.action).toBe("showScore");
    });

    it("parses system status query", () => {
      const result = parseAskJoule("how's my system", mockContext);
      expect(result.isCommand).toBe(true);
      expect(result.action).toBe("systemStatus");
    });
  });

  describe("What-If Scenarios", () => {
    it("parses what if HSPF scenario", () => {
      const result = parseAskJoule(
        "what if I had a 10 HSPF system",
        mockContext
      );
      expect(result.isCommand).toBe(true);
      expect(result.action).toBe("whatIfHSPF");
      expect(result.value).toBe(10);
    });

    it("parses what if SEER scenario", () => {
      const result = parseAskJoule("what if 18 seer", mockContext);
      expect(result.isCommand).toBe(true);
      expect(result.action).toBe("whatIfSEER");
      expect(result.value).toBe(18);
    });

    it("parses break-even calculation", () => {
      const result = parseAskJoule("break-even on $8000 upgrade", mockContext);
      expect(result.isCommand).toBe(true);
      expect(result.action).toBe("breakEven");
      expect(result.cost).toBe(8000);
    });

    it("parses payback period with comma", () => {
      const result = parseAskJoule("payback on $12,500", mockContext);
      expect(result.isCommand).toBe(true);
      expect(result.action).toBe("breakEven");
      expect(result.cost).toBe(12500);
    });
  });

  describe("Educational Queries", () => {
    it("parses explain HSPF", () => {
      const result = parseAskJoule("explain HSPF", mockContext);
      expect(result.isCommand).toBe(true);
      expect(result.action).toBe("educate");
      expect(result.topic).toBe("hspf");
    });

    it("parses what is SEER", () => {
      const result = parseAskJoule("what is SEER", mockContext);
      expect(result.isCommand).toBe(true);
      expect(result.action).toBe("educate");
      expect(result.topic).toBe("seer");
    });

    it("parses tell me about aux heat", () => {
      const result = parseAskJoule("tell me about aux heat", mockContext);
      expect(result.isCommand).toBe(true);
      expect(result.action).toBe("educate");
      expect(result.topic).toBe("auxheat");
    });

    it("parses why is my bill high", () => {
      const result = parseAskJoule("why is my bill so high", mockContext);
      expect(result.isCommand).toBe(true);
      expect(result.action).toBe("explainBill");
    });

    it("parses what's normal for city", () => {
      const result = parseAskJoule("what's normal for Atlanta", mockContext);
      expect(result.isCommand).toBe(true);
      expect(result.action).toBe("normalForCity");
      expect(result.cityName).toBe("Atlanta");
    });
  });

  describe("Conversational Memory", () => {
    it("remembers previous location in multi-turn", () => {
      const context = {
        ...mockContext,
        lastQuery: { cityName: "Denver, CO", squareFeet: 2000 },
      };
      const result = parseAskJoule("what about 72 degrees", context);
      expect(result.cityName).toBe("Denver, CO");
      expect(result.indoorTemp).toBe(72);
    });

    it("overrides remembered location with new one", () => {
      const context = {
        ...mockContext,
        lastQuery: { cityName: "Denver, CO" },
      };
      const result = parseAskJoule("2000 sq ft in Phoenix at 70", context);
      expect(result.cityName).toBe("Phoenix");
      expect(result.squareFeet).toBe(2000);
      expect(result.indoorTemp).toBe(70);
    });
  });

  describe("Original Parsing (Backwards Compatibility)", () => {
    it("still parses traditional queries", () => {
      const result = parseAskJoule(
        "2000 sq ft in Atlanta, good insulation at 70"
      );
      expect(result.squareFeet).toBe(2000);
      expect(result.cityName).toBe("Atlanta");
      expect(result.insulationLevel).toBe(0.65);
      expect(result.indoorTemp).toBe(70);
    });

    it("parses system type", () => {
      const result = parseAskJoule("heat pump in Boston at 68");
      expect(result.primarySystem).toBe("heatPump");
      expect(result.cityName).toBe("Boston");
      expect(result.indoorTemp).toBe(68);
    });

    it("parses energy mode", () => {
      const result = parseAskJoule("heating costs for 1800 sq ft", mockContext);
      expect(result.energyMode).toBe("heating");
      expect(result.squareFeet).toBe(1800);
    });
  });

  describe("Edge Cases", () => {
    it("returns empty object for empty query", () => {
      const result = parseAskJoule("", mockContext);
      expect(result).toEqual({});
    });

    it("handles case insensitivity", () => {
      const result = parseAskJoule("SET WINTER TO 68", mockContext);
      expect(result.action).toBe("setWinterTemp");
      expect(result.value).toBe(68);
    });

    it("returns non-command for unrecognized queries", () => {
      const result = parseAskJoule("random gibberish text", mockContext);
      expect(result.isCommand).toBeUndefined();
    });
  });
});
