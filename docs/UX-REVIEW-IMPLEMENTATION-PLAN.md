# UX Review Implementation Plan

This document maps the UX/product review feedback to actionable implementation items.

---

## Product Direction Question

**Are you designing this as:**
- **A) Consumer SaaS for homeowners** — More aggressive UI, clearer CTAs, stronger emotional hooks
- **B) Tool for HVAC companies** — More technical detail, B2B language
- **C) Utility company dashboard** — Compliance, accessibility, multi-tenant
- **D) Personal project** — Can stay exploratory

*The answer changes how aggressive the UI should be.*

---

## Completed Fixes

### 1. Number consolidation (MonthlyBudgetPlanner.jsx)
**Problem:** Same numbers shown many times in different forms.

**Fix applied:** When user has full bill data (actualBillAmount), show ONE canonical comparison: Expected $X | Actual $Y | Difference +$Z. Hide details behind "Show details". Partial bill data still shows "So far $X for Y days" and "On track for $Z total".

### 2. Navigation consolidation (navConfig.jsx, Analysis.jsx)
**Problem:** Nav felt like 2 systems smashed together.

**Fix applied:**
- Main nav: Dashboard (renamed from Mission Control), Forecast (/analysis/monthly), Compare Bill (/analysis/compare-bill), Optimizer (/optimize), Settings. Tools removed from main nav.
- Analysis page header: "Forecast" instead of "Cost Simulator", "Dashboard" instead of "Home", single Compare Bill link.
- Tabs: "Weekly" | "Monthly" | "Annual" (shortened labels).

### 3. LLM prompts – diagnosis + bullets (MonthlyBudgetPlanner.jsx)
**Problem:** Long paragraphs, no headline diagnosis.

**Fix applied:**
- Added DIAGNOSIS instruction: One bold line first — "Your heating system looks normal. The extra $X likely came from other appliances" when baseload explains the gap.
- Added FORMAT: "Start with ONE-LINE diagnosis, then bullets for 'Why the bill is higher.'"
- Updated STRUCTURE: "When actual > estimate: Start with 'Your heating system looks normal. The extra $X likely came from other appliances.'"

### 4. Optimizer $0 savings UX (OneClickOptimizer.jsx)
**Problem:** `Estimated Savings: $0.00/mo` reads as "This app is useless."

**Fix applied:** When `monthlyDollars === 0`, show:
> No thermostat savings detected.  
> Biggest savings likely from non-heating usage.

### 2. Read aloud section (MonthlyBudgetPlanner.jsx)
**Problem:** "Read aloud when ready" + visible debug text felt like dev-mode.

**Fix applied:**
- Replaced checkbox with **"Explain this out loud"** button
- Moved "Comparing model vs your bill for X days..." into a collapsed `<details>` "Show comparison details"

---

## Remaining High-Impact Items

### 5. Replace long paragraph with scannable bullets (Problem 3)
**Location:** LLM prompt / bill analysis output in MonthlyBudgetPlanner

**Current:** "Since your actual bill is significantly higher than the model predicted…" (long paragraph)

**Fix:** Replace with:
```
**Why the bill is higher**
• Heating model: $86
• Your actual bill: $174
• Extra usage likely from:
  - Whole-house appliances
  - Water heater
  - Dryer
  - Cooking
**Investigate usage →**
```

*Note: This may require prompt changes in the bill analysis flow.*

### 6. Hero section restructure (Structural suggestion)
**Location:** MonthlyBudgetPlanner.jsx — bill comparison hero

**Ideal flow:**
1. **HERO:** "Your January bill was 102% higher than expected. $174 actual vs $92 expected" + [Find out why]
2. **Quick answer:** "Most likely cause: Whole-house electricity usage. Heating looks normal."
3. **Breakdown:** Heating expected $86 | Non-heating $88 | Fixed fees $24
4. **Actions:** Lower thermostat → saves $X | Reduce baseload → saves $Y
5. **Deep data (collapsed):** BTU/°F, kWh delta, weather modeling

### 7. Bold headline diagnosis (Product strategy)
**Location:** Bill analysis output (LLM prompt)

**Add diagnosis categories:**
- Heating normal
- Heating high
- House inefficient
- Baseload high
- Aux heat triggered

**Biggest opportunity — single bold line:**
> Your heating system looks normal. The extra $82 likely came from other appliances.

---

## File Reference

| Component | Path |
|-----------|------|
| MonthlyBudgetPlanner | `src/pages/MonthlyBudgetPlanner/MonthlyBudgetPlanner.jsx` |
| OneClickOptimizer | `src/components/optimization/OneClickOptimizer.jsx` |
| AnswerCard | `src/components/AnswerCard.jsx` |
| Analysis (tabs) | `src/pages/Analysis.jsx` |
| navConfig | `src/navConfig.jsx` |
| Bill analysis prompts | `MonthlyBudgetPlanner.jsx` (~lines 1340–1550) |

---

## Verdict Summary

| Dimension | Rating |
|-----------|--------|
| Concept | ⭐⭐⭐⭐⭐ |
| Data modeling | ⭐⭐⭐⭐⭐ |
| UX clarity | ⭐⭐⭐ |
| Navigation | ⭐⭐ |
| Trust factor | ⭐⭐⭐⭐ |
