# Naming Review & Improvement Suggestions

This document reviews all naming conventions across the Joule HVAC application and provides suggestions for improvements.

## Executive Summary

The app has generally good naming, but there are several areas where consistency and clarity could be improved:

1. **Inconsistent terminology** between routes, labels, and descriptions
2. **Vague or generic names** that don't clearly communicate purpose
3. **Mixed naming styles** (some descriptive, some abbreviated)
4. **Route path vs label mismatches** that could confuse users

---

## 1. Main Navigation & Routes

### Current State

| Route Path | Name | Label | Issue |
|------------|------|-------|-------|
| `/home` | "Mission Control" | "Mission Control" | Creative but potentially unclear |
| `/analysis` | "Simulation" | "Simulation" | Inconsistent with "Analysis" component name |
| `/analysis/budget` | "Budget" | "Monthly Forecast" | Name/label mismatch |
| `/analysis/compare` | "Heat Pump vs Gas Furnace" | "Heat Pump vs Gas Furnace" | ✅ Good (recently updated) |
| `/control` | "Climate" | "Climate" | Vague - doesn't clearly indicate thermostat control |
| `/home-health` | "Home Health" | "Home Health" | ✅ Good |

### Suggestions

1. **`/analysis` → "Analysis" or "Forecasts"**
   - **Current:** Name is "Simulation", component is "Analysis"
   - **Suggestion:** Change name to "Analysis" to match component, OR rename to "Forecasts" to be more user-friendly
   - **Rationale:** "Simulation" sounds technical; "Analysis" matches component; "Forecasts" is most user-friendly

2. **`/analysis/budget` → Align name and label**
   - **Current:** Name is "Budget", label is "Monthly Forecast"
   - **Suggestion:** Change name to "Monthly Forecast" to match label
   - **Rationale:** Consistency between name and label reduces confusion

3. **`/control` → "Thermostat & Air Quality" or "Climate Control"**
   - **Current:** "Climate" is too vague
   - **Suggestion:** "Climate Control" (more descriptive) or "Thermostat & Air Quality" (most explicit)
   - **Rationale:** Users need to understand this controls their thermostat and air quality devices

4. **`/home` → Keep "Mission Control" OR change to "Dashboard"**
   - **Current:** "Mission Control" is creative but potentially unclear
   - **Suggestion:** Keep if it's part of brand identity, OR change to "Dashboard" for clarity
   - **Rationale:** "Mission Control" is memorable but may not be immediately understood

---

## 2. Analysis Tab Labels

### Current State

| Tab ID | Label | Issue |
|--------|-------|-------|
| `forecast` | "Weekly Forecast" | ✅ Clear |
| `budget` | "Monthly Forecast" | ✅ Clear |
| `annual` | "Annual Forecast" | ✅ Clear |
| `city-comparison` | "City Comparison" | Could be more specific |
| `gas-electric-comparison` | "Gas+Electric City Comparison" | ✅ Clear but long |
| `energy-flow` | "Energy Flow" | Vague - what energy? |
| `compare` | "Heat Pump vs Gas Furnace" | ✅ Clear (recently updated) |
| `analyzer` | "Analyzer" | Too generic |

### Suggestions

1. **`city-comparison` → "City Cost Comparison"**
   - **Current:** "City Comparison" is vague
   - **Suggestion:** "City Cost Comparison" or "Compare Cities"
   - **Rationale:** Makes it clear this compares costs between cities

2. **`energy-flow` → "Heat Pump Performance" or "System Performance Flow"**
   - **Current:** "Energy Flow" is vague
   - **Suggestion:** "Heat Pump Performance" (if heat pump specific) or "System Performance Flow"
   - **Rationale:** More descriptive of what the visualization shows

3. **`analyzer` → "Performance Analyzer" or "System Analyzer"**
   - **Current:** "Analyzer" is too generic
   - **Suggestion:** "Performance Analyzer" or "System Analyzer"
   - **Rationale:** Clarifies what is being analyzed

4. **`gas-electric-comparison` → Consider shortening**
   - **Current:** "Gas+Electric City Comparison" is long
   - **Suggestion:** "Gas+Electric Comparison" (remove "City" since it's implied)
   - **Rationale:** Shorter while maintaining clarity

---

## 3. Route Paths vs Labels

### Issues Found

1. **`/analysis/budget`** - Path says "budget" but label says "Monthly Forecast"
   - **Suggestion:** Consider `/analysis/monthly-forecast` OR change label to "Monthly Budget"

2. **`/analysis/compare`** - Path says "compare" but label says "Heat Pump vs Gas Furnace"
   - **Suggestion:** Consider `/analysis/heat-pump-vs-gas` OR keep current (path is fine, label is descriptive)

3. **`/analysis/forecast`** - Not found in routes, but used in code
   - **Suggestion:** Ensure this route exists or is properly aliased

---

## 4. Component Names

### Current State

| Component File | Component Name | Issue |
|----------------|----------------|-------|
| `Analysis.jsx` | `Analysis` | ✅ Good |
| `MonthlyBudgetPlanner.jsx` | `MonthlyBudgetPlanner` | ✅ Good |
| `SevenDayCostForecaster.jsx` | `SevenDayCostForecaster` | ✅ Good |
| `HeatPumpEnergyFlow.jsx` | `HeatPumpEnergyFlow` | ✅ Good |
| `GasVsHeatPump.jsx` | `GasVsHeatPump` | ✅ Good |
| `SystemPerformanceAnalyzer.jsx` | `SystemPerformanceAnalyzer` | ✅ Good |
| `Home.jsx` | `HomeDashboard` | ✅ Good |
| `HomeHealth.jsx` | `HomeHealth` | ✅ Good |
| `Control.jsx` | `Control` | Could be more specific |

### Suggestions

1. **`Control.jsx` → Consider `ClimateControl.jsx` or `ThermostatControl.jsx`**
   - **Rationale:** More descriptive of the component's purpose

---

## 5. Section Headers & UI Labels

### Current State (from MonthlyBudgetPlanner)

| Section | Current Label | Issue |
|---------|---------------|-------|
| Annual forecast header | "📅 Annual Forecast" | ✅ Good |
| Monthly forecast header | "Monthly Forecast" | ✅ Good |
| City comparison | "📅 Monthly Budget Comparison" | ✅ Good (recently updated) |
| Climate data | "🌎 Climate Flex" | Creative but potentially unclear |
| Thermostat settings | "🌡️ Thermostat Settings" | ✅ Good |
| System balance point | "System Balance Point" | ✅ Good |

### Suggestions

1. **"Climate Flex" → "Climate Comparison" or "Climate Data"**
   - **Current:** "Climate Flex" is creative but unclear
   - **Suggestion:** "Climate Comparison" or "Climate Data"
   - **Rationale:** More immediately understandable

2. **Consider consistency in emoji usage**
   - Some sections use emojis (📅, 🌡️, 🌎), others don't
   - **Suggestion:** Either use emojis consistently or remove them for a more professional look
   - **Rationale:** Consistency improves visual hierarchy

---

## 6. Hidden/Advanced Routes

### Current State

| Route Path | Name | Label | Issue |
|-----------|------|-------|-------|
| `/energy-flow` | "Flow" | "Flow" | Too vague |
| `/charging-calculator` | "Charge" | "Charge" | Too short |
| `/methodology` | "Method" | "Method" | Too short |
| `/performance-analyzer` | "Analyzer" | "Analyzer" | Too generic |
| `/thermostat-analyzer` | "Thermostat" | "Thermostat" | Could be more specific |

### Suggestions

1. **`/energy-flow` → "Energy Flow" or "Performance Flow"**
   - **Current:** "Flow" is too vague
   - **Suggestion:** Use full "Energy Flow" or "Performance Flow" in name/label

2. **`/charging-calculator` → "Charging Calculator"**
   - **Current:** "Charge" is too short
   - **Suggestion:** Use full "Charging Calculator" in name/label

3. **`/methodology` → "Calculation Methodology"**
   - **Current:** "Method" is too short
   - **Suggestion:** Use full "Calculation Methodology" in name/label

4. **`/performance-analyzer` → "Performance Analyzer"**
   - **Current:** "Analyzer" is too generic
   - **Suggestion:** Use full "Performance Analyzer" in name/label

5. **`/thermostat-analyzer` → "Thermostat Strategy Analyzer"**
   - **Current:** "Thermostat" is too generic
   - **Suggestion:** Use full "Thermostat Strategy Analyzer" in name/label

---

## 7. Inconsistencies & Patterns

### Pattern Issues

1. **Forecast naming:**
   - ✅ Consistent: "Weekly Forecast", "Monthly Forecast", "Annual Forecast"
   - **Good pattern to maintain**

2. **Comparison naming:**
   - "City Comparison" vs "Gas+Electric City Comparison"
   - "Heat Pump vs Gas Furnace" (system comparison)
   - **Suggestion:** Consider standardizing format: "[Type] Comparison" or "Compare [Items]"

3. **Analyzer naming:**
   - "Analyzer" (generic)
   - "Performance Analyzer" (specific)
   - "Thermostat Strategy Analyzer" (very specific)
   - **Suggestion:** Always use full descriptive names

### Abbreviation Issues

- Some routes use abbreviations ("Flow", "Charge", "Method")
- **Suggestion:** Avoid abbreviations in user-facing names; use full descriptive names

---

## 8. Priority Recommendations

### High Priority (User-Facing Confusion)

1. **Align `/analysis/budget` name and label**
   - Change name from "Budget" to "Monthly Forecast"

2. **Clarify `/control` purpose**
   - Change from "Climate" to "Climate Control" or "Thermostat & Air Quality"

3. **Improve "Analyzer" specificity**
   - Change "Analyzer" to "Performance Analyzer" or "System Analyzer"

4. **Clarify "Energy Flow"**
   - Change to "Heat Pump Performance" or "System Performance Flow"

### Medium Priority (Consistency)

5. **Standardize comparison naming**
   - Consider "City Cost Comparison" instead of "City Comparison"

6. **Clarify "Climate Flex"**
   - Change to "Climate Comparison" or "Climate Data"

7. **Fix hidden route abbreviations**
   - Expand "Flow", "Charge", "Method" to full names

### Low Priority (Polish)

8. **Consider "Mission Control" vs "Dashboard"**
   - Evaluate if "Mission Control" aligns with brand or if "Dashboard" is clearer

9. **Standardize emoji usage**
   - Decide on consistent emoji usage or remove for professional look

10. **Review route path vs label alignment**
    - Ensure all route paths logically match their labels

---

## 9. Naming Conventions to Establish

### Recommended Patterns

1. **Forecasts:** "[Time Period] Forecast" (Weekly, Monthly, Annual)
2. **Comparisons:** "[Items] Comparison" or "Compare [Items]"
3. **Analyzers:** "[What] Analyzer" (Performance Analyzer, System Analyzer)
4. **Tools:** Full descriptive names, no abbreviations
5. **Routes:** Use kebab-case, descriptive paths
6. **Labels:** Use Title Case, full descriptive names
7. **Names:** Match labels for consistency

### Avoid

- ❌ Abbreviations in user-facing names ("Flow", "Charge", "Method")
- ❌ Generic terms without context ("Analyzer", "Climate")
- ❌ Name/label mismatches
- ❌ Vague descriptions ("Energy Flow" without context)

---

## 10. Implementation Checklist

- [ ] Update `/analysis` name from "Simulation" to "Analysis" or "Forecasts"
- [ ] Align `/analysis/budget` name with label ("Monthly Forecast")
- [ ] Update `/control` name to "Climate Control" or "Thermostat & Air Quality"
- [ ] Change "Analyzer" tab to "Performance Analyzer"
- [ ] Change "Energy Flow" to "Heat Pump Performance" or "System Performance Flow"
- [ ] Update "City Comparison" to "City Cost Comparison"
- [ ] Change "Climate Flex" to "Climate Comparison" or "Climate Data"
- [ ] Expand hidden route abbreviations ("Flow" → "Energy Flow", etc.)
- [ ] Review and standardize emoji usage
- [ ] Update route descriptions to match new names

---

## Conclusion

The app has generally good naming, but improving consistency and clarity will enhance user experience. Focus on:

1. **Clarity:** Every name should immediately communicate its purpose
2. **Consistency:** Similar features should use similar naming patterns
3. **Alignment:** Route names, labels, and descriptions should match
4. **Completeness:** Avoid abbreviations in user-facing names

Most changes are straightforward label/name updates that don't require code refactoring.




