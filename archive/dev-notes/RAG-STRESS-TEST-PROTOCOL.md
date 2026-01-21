# RAG Stress Test Protocol

This document provides specific test questions to verify that Ask Joule is pulling from the indexed knowledge base (Manual J/S/D, ASHRAE standards, NREL data) and not hallucinating generic advice.

## Test Methodology

For each question:

1. Ask the question in Ask Joule
2. Verify the response cites the specific manual/standard (e.g., "According to ACCA Manual J...")
3. Verify the response includes the specific technical details listed below
4. If Ask Joule says "I don't know" or gives generic advice, the RAG indexing needs improvement

---

## 1. Manual J Test (Load Calculation)

### Question 1: "How does the direction my house faces affect my cooling load?"

**Expected Response Should Include:**

- ✅ Citation: "According to ACCA Manual J..."
- ✅ Specific fact: "East/West exposure has higher peak solar gain than South-facing windows"
- ✅ Reference to: "Fenestration loads" or "Solar Heat Gain Coefficient (SHGC)"
- ✅ Technical detail: "East/West windows typically have 2-3x the peak solar gain of South windows"
- ✅ Explanation: "South windows have lower peak gain but more consistent throughout the day"

**RAG Knowledge Location:** `hvacKnowledgeBase.js` → `manualJ.solarHeatGain`

**Pass Criteria:** Response cites Manual J and mentions East/West vs South orientation difference

---

### Question 2: "Does the color of my roof matter for heat gain?"

**Expected Response Should Include:**

- ✅ Citation: "According to ACCA Manual J..."
- ✅ Specific fact: "Yes, dark roofs absorb more heat (higher Sol-Air temperature)"
- ✅ Technical detail: "Dark roofs can reach 150-180°F surface temp vs 100-120°F for light roofs"
- ✅ Solution: "A radiant barrier reduces this load by 30-50%"
- ✅ Impact: "Dark roof can add 10-20% to cooling load vs light roof with radiant barrier"

**RAG Knowledge Location:** `hvacKnowledgeBase.js` → `manualJ.roofColor`

**Pass Criteria:** Response cites Manual J, mentions Sol-Air temperature, and recommends radiant barrier

---

## 2. Manual S Test (Equipment Sizing)

### Question 3: "My load calc says I need 2.8 tons. Can I install a 3.5 ton unit?"

**Expected Response Should Include:**

- ✅ Citation: "According to ACCA Manual S..."
- ✅ Answer: "NO" (clear, direct answer)
- ✅ Specific rule: "Equipment should not be oversized by more than 15-20% above calculated load"
- ✅ Calculation: "3.5 tons is 25% oversizing, which exceeds the 20% maximum"
- ✅ Warning: "Oversizing >20% causes poor humidity control, short cycling, and efficiency loss"
- ✅ Recommendation: "Maximum equipment for 2.8 ton load = 3.36 tons (20% limit)"

**RAG Knowledge Location:** `hvacKnowledgeBase.js` → `manualS.equipmentSelection`

**Pass Criteria:** Response says NO, cites Manual S 15-20% rule, and explains why 3.5 tons is too much

---

### Question 4: "What happens to capacity at high altitude?"

**Expected Response Should Include:**

- ✅ Citation: "According to ACCA Manual S..."
- ✅ Specific fact: "Air is less dense at altitude, reducing capacity"
- ✅ Formula: "Approximately 2-4% capacity loss per 1000 feet of elevation"
- ✅ Example: "At 5000ft elevation, capacity reduced by 10-20% vs sea level"
- ✅ Requirement: "Manual S requires derating equipment specifications for altitude"
- ✅ Warning: "Failure to derate can result in undersized system at high altitude"

**RAG Knowledge Location:** `hvacKnowledgeBase.js` → `manualS.altitudeDerating`

**Pass Criteria:** Response cites Manual S, mentions 2-4% per 1000ft, and explains derating requirement

---

## 3. Manual D Test (Ductwork)

### Question 5: "I added a HEPA filter and now my airflow is loud. Why?"

**Expected Response Should Include:**

- ✅ Citation: "According to ACCA Manual D..."
- ✅ Root cause: "HEPA filters increase static pressure significantly"
- ✅ Specific numbers: "HEPA filters can add 0.3-0.5\" WC static pressure vs standard filters"
- ✅ Problem explanation: "If ducts designed for 0.5\" WC and filter adds 0.3\" WC, total = 0.8\" WC (exceeds 0.6\" limit)"
- ✅ Blower impact: "High static pressure forces blower to speed up, causing noise and reducing lifespan"
- ✅ Solution: "Upgrade to larger filter area, use lower MERV, or redesign ductwork"

**RAG Knowledge Location:** `hvacKnowledgeBase.js` → `manualD.staticPressure`

**Pass Criteria:** Response cites Manual D, explains static pressure increase, and provides solutions

---

### Question 6: "What is the maximum length for a flex duct run?"

**Expected Response Should Include:**

- ✅ Citation: "According to ACCA Manual D..."
- ✅ Key fact: "Flex duct has high friction (2-3x higher than rigid duct)"
- ✅ Recommendation: "Keep flex duct runs short and pulled tight (no sagging)"
- ✅ Warning: "Excessive length kills airflow due to high friction losses"
- ✅ Best practice: "Use rigid duct for long runs, flex only for short connections"
- ✅ Rule: "Flex duct should not exceed 15-20% of total duct length in well-designed systems"

**RAG Knowledge Location:** `hvacKnowledgeBase.js` → `manualD.flexDuct`

**Pass Criteria:** Response cites Manual D, explains high friction, and recommends keeping runs short

---

## 4. ASHRAE Test (Human Factors)

### Question 7: "Why do I feel a draft near the window even if it's closed?"

**Expected Response Should Include:**

- ✅ Citation: "According to ASHRAE Standard 55..."
- ✅ Root cause: "Radiant asymmetry - the glass surface is cold"
- ✅ Technical explanation: "Your body radiates heat to the cold surface (Mean Radiant Temperature)"
- ✅ Specific fact: "If air is 72°F but window is 55°F, operative temp feels like 63-65°F"
- ✅ ASHRAE limit: "Radiant asymmetry should not exceed 5°F for comfort"
- ✅ Solution: "Improve window insulation (double/triple pane, low-E), use window treatments"

**RAG Knowledge Location:** `hvacKnowledgeBase.js` → `ashrae55.radiantAsymmetry`

**Pass Criteria:** Response cites ASHRAE 55, explains Mean Radiant Temperature, and provides solutions

---

### Question 8: "Is 1000ppm of CO2 bad?"

**Expected Response Should Include:**

- ✅ Citation: "According to ASHRAE Standard 62.2..."
- ✅ Specific fact: "1000ppm is the upper limit for 'good' air quality"
- ✅ Health impact: "Above 1000ppm, cognitive function declines, drowsiness, reduced productivity"
- ✅ Standard: "ASHRAE 62.2 requires sufficient ventilation to keep CO2 < 1000ppm"
- ✅ Recommendation: "If CO2 > 1000ppm, you need more ventilation"

**RAG Knowledge Location:** `hvacKnowledgeBase.js` → `ashrae622.airQuality`

**Pass Criteria:** Response cites ASHRAE 62.2, mentions 1000ppm as upper limit, and explains health effects

---

## 5. NREL/Physics Test (Deep Logic)

### Question 9: "What is a Balance Point?"

**Expected Response Should Include:**

- ✅ Citation: "According to NREL and OpenEnergyMonitor documentation..."
- ✅ Definition: "The outdoor temperature where your home's Heat Loss equals your Heat Pump's Capacity"
- ✅ Practical meaning: "Below this temperature, you need Aux heat"
- ✅ Typical range: "25-40°F for most heat pump systems"
- ✅ Calculation: "Balance Point = f(Heat Loss Factor, Heat Pump Capacity, HSPF2, Outdoor Temp)"

**RAG Knowledge Location:** `hvacKnowledgeBase.js` → `nrelData.balancePoint`

**Pass Criteria:** Response cites NREL/OpenEnergyMonitor, gives clear definition, and explains practical meaning

---

### Question 10: "How do you calculate Thermal Decay?"

**Expected Response Should Include:**

- ✅ Citation: "Based on Physics/Thermodynamics - Newton's Law of Cooling..."
- ✅ Formula: "dT/dt = -k × (T - T_ambient), where k is thermal decay constant"
- ✅ Practical formula: "ΔT/Δt = -Heat_Loss_Factor × ΔT / Thermal_Mass"
- ✅ Application: "Used to calculate how long building takes to cool down during setbacks"
- ✅ Connection: "After compressor shuts off, residual heat continues to heat home (thermal decay in reverse)"

**RAG Knowledge Location:** `hvacKnowledgeBase.js` → `nrelData.thermalDecay`

**Pass Criteria:** Response cites Newton's Law of Cooling, shows the formula, and explains application

---

## Test Results Template

```
Question: [Question text]
Date: [Date]
Tester: [Name]

Response Received:
[Paste Ask Joule's response here]

✅ Pass / ❌ Fail

Citations Found:
- [ ] Manual J
- [ ] Manual S
- [ ] Manual D
- [ ] ASHRAE 55
- [ ] ASHRAE 62.2
- [ ] NREL/Physics

Specific Details Found:
- [ ] [Expected detail 1]
- [ ] [Expected detail 2]
- [ ] [Expected detail 3]

Notes:
[Any observations about the response quality]
```

---

## Success Criteria

**A response PASSES if:**

1. ✅ Cites the specific manual/standard (Manual J, Manual S, Manual D, ASHRAE, NREL)
2. ✅ Includes the specific technical details listed above
3. ✅ Provides accurate information (not generic "consult a professional" advice)
4. ✅ Shows understanding of the underlying physics/engineering principles

**A response FAILS if:**

1. ❌ Says "I don't know" or "I can't answer that"
2. ❌ Gives generic advice without citing sources
3. ❌ Provides incorrect information
4. ❌ Doesn't mention the specific manual/standard
5. ❌ Missing key technical details from the expected response

---

## Troubleshooting

If a question fails:

1. **Check RAG trigger keywords:** Verify the question contains keywords that trigger RAG search
2. **Check knowledge base:** Verify the specific knowledge exists in `hvacKnowledgeBase.js`
3. **Check search function:** Verify `searchKnowledgeBase()` can find the knowledge
4. **Check context building:** Verify `buildMinimalContext()` includes RAG results
5. **Check LLM prompt:** Verify the system prompt instructs LLM to cite sources

---

## Next Steps After Testing

1. Document which questions pass/fail
2. For failing questions, identify missing knowledge or RAG trigger issues
3. Update knowledge base with missing information
4. Re-test until all questions pass
5. Add more edge case questions as needed
