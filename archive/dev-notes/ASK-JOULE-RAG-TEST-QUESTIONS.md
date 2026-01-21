# Ask Joule RAG Test Questions

This document tests whether Ask Joule can answer specific user questions using the RAG (Retrieval-Augmented Generation) search engine.

## Test Categories

### 1. Financial Anxiety Questions (Budgeters)

#### Question 1: "Why is my bill predicted to be $150 next week?"

**Goal:** Cite the TMY3 weather forecast and the user's specific heat loss factor.

**Expected Behavior:**

- Should reference TMY3 weather data from the forecast
- Should cite the user's heat loss factor (from CSV analysis or settings)
- Should explain the calculation: Heat Loss = Heat Loss Factor × (Indoor Temp - Outdoor Temp) × Hours
- Should reference the 7-day forecast temperatures

**RAG Knowledge Needed:**

- ✅ TMY3 data explanation (in `hvacKnowledgeBase.js` - `nrelData.tmy3Data`)
- ✅ Heat loss calculation formulas (in `hvacKnowledgeBase.js` - `manualJ.heatLoss`)
- ⚠️ Need to ensure forecast data is included in context

**Test Status:** ✅ RAG has TMY3 knowledge, but needs to ensure forecast context is passed

---

#### Question 2: "How much will I save if I drop the temp to 65 at night?"

**Goal:** Run the math: (Current Delta - New Delta) × Hours × Cost.

**Expected Behavior:**

- Should calculate: Savings = (Heat Loss Factor × ΔT_old × Hours) - (Heat Loss Factor × ΔT_new × Hours)
- Should use current indoor temp vs new temp (65°F)
- Should multiply by utility cost from settings
- Should show annual/monthly savings

**RAG Knowledge Needed:**

- ✅ Setback savings formulas (in `hvacKnowledgeBase.js` - `doeGuides.thermostatSettings`)
- ✅ Heat loss calculations
- ⚠️ Need calculator engine to perform the math

**Test Status:** ✅ Knowledge exists, calculator engine should handle math

---

#### Question 3: "Is my heat pump cheaper to run than my gas furnace right now?"

**Goal:** Calculate the "Economic Balance Point" based on current electric vs. gas rates (from settings).

**Expected Behavior:**

- Should calculate: Economic Balance Point = (Gas Cost per BTU) / (Electric Cost per BTU × COP)
- Should use current utility rates from settings
- Should use current COP (which degrades with outdoor temp)
- Should compare current outdoor temp to economic balance point

**RAG Knowledge Needed:**

- ✅ Heat pump efficiency (COP degradation) (in `hvacKnowledgeBase.js` - `doeGuides.heatPumpEfficiency`)
- ⚠️ Need economic balance point calculation formula
- ⚠️ Need to access current utility rates from settings

**Test Status:** ⚠️ Need to add economic balance point knowledge to RAG

---

### 2. Equipment Health Questions (Nerds)

#### Question 4: "Is my system short cycling?"

**Goal:** Check the last 24h runtimes. If >3 cycles/hour with <5 min runtime, say YES and cite NEMA MG-1.

**Expected Behavior:**

- Should analyze runtime data from CSV or recent history
- Should detect: >3 cycles per hour AND <5 minutes runtime per cycle
- Should cite NEMA MG-1 standard
- Should explain why short cycling is bad (efficiency loss, equipment wear)

**RAG Knowledge Needed:**

- ❌ NEMA MG-1 standard (NOT in knowledge base)
- ✅ Short cycling symptoms (in `hvacKnowledgeBase.js` - `generalPrinciples.sizing`)
- ⚠️ Need to access runtime data from CSV analysis

**Test Status:** ❌ Missing NEMA MG-1 knowledge - needs to be added

---

#### Question 5: "What is my Balance Point?"

**Goal:** Return the exact temperature where Heat Loss = Heat Pump Capacity.

**Expected Behavior:**

- Should calculate balance point using: Balance Point = f(Heat Loss Factor, Heat Pump Capacity, HSPF2)
- Should display the exact temperature (e.g., "Your balance point is 32°F")
- Should explain what it means (aux heat needed below this temp)

**RAG Knowledge Needed:**

- ✅ Balance point explanation (in `hvacKnowledgeBase.js` - `manualS.heatPumpSizing`)
- ✅ Balance point calculator exists in codebase
- ✅ Already integrated in `groqAgent.js` context building

**Test Status:** ✅ Fully supported - balance point is calculated and included in context

---

#### Question 6: "According to Manual S, is my unit oversized?"

**Goal:** Compare the Manual J load (calculated from their CSV) to their equipment tonnage.

**Expected Behavior:**

- Should retrieve Manual J load from CSV analysis (if available)
- Should compare to equipment capacity (from settings)
- Should cite Manual S: equipment should be 100-115% of load
- Should say "oversized" if >115%, "undersized" if <100%, "properly sized" if 100-115%

**RAG Knowledge Needed:**

- ✅ Manual S sizing rules (in `hvacKnowledgeBase.js` - `manualS.equipmentSelection`)
- ✅ Manual J load calculation (in `hvacKnowledgeBase.js` - `manualJ.sizing`)
- ⚠️ Need to access CSV analysis results (heat loss factor → Manual J load)

**Test Status:** ✅ Knowledge exists, need to ensure CSV data is accessible

---

### 3. Comfort & Physics Questions (Skeptics)

#### Question 7: "Why does it feel cold even though the thermostat says 72?"

**Goal:** Cite ASHRAE 55. "Your humidity is 30%. The operative temperature feels like 69°. I recommend a humidifier."

**Expected Behavior:**

- Should calculate operative temperature using ASHRAE 55
- Should factor in humidity (low humidity = feels colder)
- Should cite ASHRAE Standard 55
- Should recommend humidifier if humidity < 30%

**RAG Knowledge Needed:**

- ✅ ASHRAE 55 comfort zone (in `hvacKnowledgeBase.js` - `ashrae55.comfortZone`)
- ✅ ASHRAE 55 calculator exists in `ashrae55.js`
- ✅ Already integrated in `groqAgent.js` context building
- ⚠️ Need to access current humidity from thermostat data

**Test Status:** ✅ Fully supported - ASHRAE 55 is calculated and included in context

---

#### Question 8: "Should I close the vents in the unused bedroom?"

**Goal:** Danger Warning. Cite Manual D. "Closing vents increases static pressure and can kill your blower motor. Do not do this."

**Expected Behavior:**

- Should give a strong warning: "DO NOT close vents"
- Should cite Manual D
- Should explain: increases static pressure, can damage blower motor
- Should suggest alternatives (close doors, use zoning)

**RAG Knowledge Needed:**

- ✅ Manual D airflow principles (in `hvacKnowledgeBase.js` - `manualD.airflow`)
- ⚠️ Need specific warning about closing vents (not explicitly stated)
- ⚠️ Need to emphasize danger (blower motor damage)

**Test Status:** ⚠️ Knowledge exists but needs stronger warning language

---

#### Question 9: "What is a 'heat dissipation time' and why should I change it?"

**Goal:** Explain the "Free Heat" concept (scavenging heat from the exchanger).

**Expected Behavior:**

- Should explain: After compressor shuts off, heat exchanger still has residual heat
- Should explain: Heat dissipation time = how long to wait before turning on again
- Should explain: Longer time = more "free heat" scavenged, but slower recovery
- Should recommend: 30-60 seconds typical, adjust based on comfort vs efficiency

**RAG Knowledge Needed:**

- ❌ Heat dissipation time concept (NOT in knowledge base)
- ❌ "Free heat" scavenging (NOT in knowledge base)
- ⚠️ This is a ProStat-specific feature, needs documentation

**Test Status:** ❌ Missing knowledge - needs to be added to knowledge base

---

## Summary

### ✅ Fully Supported (3/9)

1. Balance Point calculation
2. ASHRAE 55 comfort calculations
3. Manual S sizing rules

### ⚠️ Partially Supported (4/9)

1. Bill prediction (needs forecast context)
2. Temperature setback savings (needs calculator integration)
3. Economic balance point (needs formula)
4. Manual S oversized check (needs CSV data access)
5. Manual D vent warning (needs stronger language)

### ❌ Missing Knowledge (2/9)

1. NEMA MG-1 short cycling standard
2. Heat dissipation time / "Free Heat" concept

## Recommendations

1. **Add NEMA MG-1 knowledge** to `hvacKnowledgeBase.js`:

   - Short cycling definition: >3 cycles/hour with <5 min runtime
   - Equipment damage from excessive cycling
   - Efficiency loss from short cycling

2. **Add heat dissipation time knowledge** to `hvacKnowledgeBase.js`:

   - Explain residual heat in heat exchanger
   - Explain "free heat" scavenging concept
   - Recommend settings (30-60 seconds)

3. **Add economic balance point formula** to `hvacKnowledgeBase.js`:

   - Formula: Economic BP = (Gas Cost/BTU) / (Electric Cost/BTU × COP)
   - Explain when heat pump is cheaper than gas

4. **Enhance Manual D vent warning**:

   - Add explicit warning about closing vents
   - Emphasize blower motor damage risk

5. **Ensure context includes:**
   - 7-day weather forecast for bill predictions
   - CSV analysis results (heat loss factor, Manual J load)
   - Current humidity for ASHRAE 55 calculations
   - Utility rates for economic calculations
