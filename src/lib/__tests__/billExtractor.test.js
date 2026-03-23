import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../aiProvider", () => ({
  isAIAvailable: () => false,
  callLLM: vi.fn(),
}));

import { extractBillToStorage } from "../billExtractor";

describe("extractBillToStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("extracts totals-only OCR bill using Current usage and date span", async () => {
    const text = `009434-059239
STMT#12711581
C: 8 R: 451
009434-059239
-
187.54
138.80
04/02/2026
6.63
TDATAAFDATTFTAATTAFTDDFADDDTFATADDDTDATFTAFFFDAFAFTAAAAADTAFTFTFA
THOMAS KING
03/08/2026
Metered Electric 138380
28
12669
12210
459
BILL WILL BE PAID BY AUTOMATIC DRAFT
138.80
COMPARE YOUR USAGE
138.80
0.00
Current
459
Last Month
908
Last Year
562`;

    const out = await extractBillToStorage(text, 2026, 2);

    expect(out).toBeTruthy();
    expect(Object.keys(out)).toEqual(expect.arrayContaining(["3", "4"]));
    expect(out["3"]["8"]).toBeCloseTo(17.7, 1);
    expect(out["4"]["2"]).toBeCloseTo(17.7, 1);

    const marchStored = JSON.parse(localStorage.getItem("actualKwh_2026_3") || "{}");
    const aprilStored = JSON.parse(localStorage.getItem("actualKwh_2026_4") || "{}");
    expect(marchStored["3-8"]).toBeCloseTo(17.7, 1);
    expect(aprilStored["4-2"]).toBeCloseTo(17.7, 1);
  });
});
