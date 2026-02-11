# Joule Forecast and Cost Models — Explained

This document explains how Joule's different forecast and cost estimates work, why numbers might differ, and what each display means.

---

## Summary: The Two Different Things Being Compared

| What | What it measures | Scope |
|------|------------------|-------|
| **Forecast** | HVAC heating/cooling only (heat pump or furnace) | Model estimate |
| **Your Bill** | Whole-house electricity (HVAC + baseload) | Actual from utility |

**Baseload** = water heater, fridge, lights, appliances — typically 5–15 kWh/day. Joule's forecast does *not* include baseload, so your bill is usually higher than the forecast.

---

## 1. Quick Answer Card (Top of Details)

**Shows:** `$85.05 for this month` (example)

**What it is:** Monthly forecast for **HVAC only** (heat pump heating or AC cooling).

**Data sources:**
- **Past days this month:** Actual weather from Open-Meteo
- **Next 15 days:** Live NWS forecast via Open-Meteo
- **Days beyond:** 3-year historical average

**Uses:** Sinusoidal daily temperature profile (low ~6 AM, high ~2 PM), your heat loss factor, thermostat schedule, and heat pump capacity curve.

---

## 2. Monthly Forecast Table (Details → Monthly Forecast)

**Shows:** Day-by-day forecast kWh, cost, and your actual bill for each day.

**Columns:**
- **Forecast Energy (kWh):** Model estimate for HVAC that day
- **Est. Cost ($):** Forecast kWh × your electricity rate
- **Your Bill (kWh):** What you enter from your utility bill
- **Actual Cost ($):** Your bill kWh × rate
- **Δ kWh:** Your bill − Forecast (positive = bill higher than model)
- **BTU/°F (bill):** Empirical heat loss from your bill (assumes all kWh is heating; includes baseload so often inflated)

**Monthly Total row:**
- **Forecast:** Sum of all forecast days (HVAC only)
- **Your bill:** Sum of days you entered
- **Δ kWh:** Difference (usually positive because bill includes baseload)

---

## 3. Bill vs Forecast Summary (Top of page)

**Shows:** `📊 28 days entered | ⚡ 1028.8 kWh actual (504 kWh forecast) | 💰 $143 actual ($70 forecast)`

**Meaning:**
- **Actual:** Sum of kWh you entered for those days
- **Forecast:** Same-day forecast (HVAC only) — either from analysis or prorated from full-month forecast
- **Cost:** Actual/forecast × your electricity rate

**Why forecast can appear as 0:** If the Details table hasn’t rendered yet (e.g. collapsed), the forecast isn’t computed. Expand Details and the forecast will load. If it still shows 0, clear the analysis and click "Why is my bill so high?" again.

---

## 4. AI Bill Analysis ("Here's what I'm seeing")

**What it compares:** Forecast vs actual for the **same days** you entered.

**Context given to the AI:**
- Forecast kWh and cost for those days
- Actual kWh and cost for those days
- Heat loss source (calculated, from bill, manual)
- Thermostat settings, capacity curve, baseload guidance

**Typical takeaways:**
- **Actual > Forecast:** Usually baseload (water heater, fridge, etc.). Model is HVAC-only.
- **Actual < Forecast:** Model may overestimate heat loss or thermostat use.
- **Close match:** Home is behaving roughly as modeled.

---

## 5. Weather / Forecast Models

**Current Forecast (default):**
- Past days: actual weather
- Next 15 days: NWS forecast
- Beyond: 3-year historical average

**Typical (30-year):**
- All days use 30-year climate normals
- Good for “typical year” planning

**Polar Vortex:**
- Same as Current but with −5°F offset
- “Worst case” scenario

---

## 6. Heat Loss Sources

| Source | Meaning |
|--------|---------|
| **Calculated (DOE)** | From building: sq ft, insulation, shape, ceiling height |
| **From Bill Data (Auto-learned)** | Derived from past bills; forecast already uses this |
| **Manual Entry** | You enter BTU/hr/°F directly |
| **CSV Analyzer** | From uploaded CSV with daily usage |

---

## 7. Cost Components

**Variable cost:** kWh × $/kWh (from your rate)

**Fixed cost:** Monthly service charge (e.g. $15)

**Total:** Variable + fixed

---

## 8. Why Numbers Don’t Always Match

1. **Forecast = HVAC only, bill = whole house** — Baseload usually makes the bill higher.
2. **Different day ranges** — Summary can be for 9 days while the table shows the full month.
3. **Different weather sources** — Past days use actual weather; future days use forecast or historical.
4. **Heat loss source** — Switching between DOE, bill-learned, or manual changes the forecast.

---

## 9. "Show me the math" section

**Shows:** Building heat loss, capacity curve, example day calculation, and weekly breakdown.

**Building Characteristics:** Design heat loss from sq ft, insulation, shape, ceiling height.

**Example Day:** 35°F outdoor day, step-by-step: ΔT, heat loss, capacity factor, kWh, cost.

**Weekly Breakdown:** Week 1–4 costs and kWh from the forecast.
