/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import { normalizeCsvData } from "./csvNormalization";

describe("normalizeCsvData runtime unit conversion", () => {
  it("converts minutes to seconds for Heat Stage 1 and leaves others intact", () => {
    const headers = [
      "Date",
      "Time",
      "Outdoor Temp (F)",
      "Thermostat Temperature (F)",
      "Heat Stage 1 (min)",
      "Aux Heat 1 (sec)",
    ];
    const data = [
      {
        Date: "2025-01-01",
        Time: "00:00:00",
        "Outdoor Temp (F)": "30",
        "Thermostat Temperature (F)": "70",
        "Heat Stage 1 (min)": "5",
        "Aux Heat 1 (sec)": "10",
      },
    ];
    const out = normalizeCsvData(headers, data);
    expect(out).toHaveLength(1);
    expect(out[0]["Heat Stage 1 (sec)"]).toBe("300");
    expect(out[0]["Aux Heat 1 (sec)"]).toBe("10");
  });

  it("converts milliseconds to seconds for Aux Heat 1 and rounds", () => {
    const headers = [
      "Date",
      "Time",
      "Outdoor Temp (F)",
      "Thermostat Temperature (F)",
      "Heat Stage 1 (sec)",
      "Aux Heat 1 (ms)",
    ];
    const data = [
      {
        Date: "2025-01-01",
        Time: "00:00:00",
        "Outdoor Temp (F)": "30",
        "Thermostat Temperature (F)": "70",
        "Heat Stage 1 (sec)": "12",
        "Aux Heat 1 (ms)": "120000",
      },
    ];
    const out = normalizeCsvData(headers, data);
    expect(out).toHaveLength(1);
    expect(out[0]["Heat Stage 1 (sec)"]).toBe("12");
    expect(out[0]["Aux Heat 1 (sec)"]).toBe("120");
  });

  it("infers minutes when header lacks unit but values are small", () => {
    const headers = [
      "Date",
      "Time",
      "Outdoor Temp (F)",
      "Thermostat Temperature (F)",
      "Heat Stage 1",
      "Aux Heat 1",
    ];
    // Small numbers that look like minutes (<= 10, avg <= 5)
    const data = [
      {
        Date: "2025-01-01",
        Time: "00:00:00",
        "Outdoor Temp (F)": "30",
        "Thermostat Temperature (F)": "70",
        "Heat Stage 1": "3",
        "Aux Heat 1": "0",
      },
      {
        Date: "2025-01-01",
        Time: "00:15:00",
        "Outdoor Temp (F)": "29",
        "Thermostat Temperature (F)": "69.8",
        "Heat Stage 1": "5",
        "Aux Heat 1": "2",
      },
    ];
    const out = normalizeCsvData(headers, data);
    expect(out[0]["Heat Stage 1 (sec)"]).toBe("180"); // 3 min -> 180 sec
    expect(out[1]["Heat Stage 1 (sec)"]).toBe("300"); // 5 min -> 300 sec
    expect(out[0]["Aux Heat 1 (sec)"]).toBe("0");
    expect(out[1]["Aux Heat 1 (sec)"]).toBe("120"); // 2 min inferred -> 120 sec
  });
});
