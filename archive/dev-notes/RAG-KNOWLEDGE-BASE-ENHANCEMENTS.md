# RAG Knowledge Base Enhancements Summary

## Overview

Enhanced the HVAC knowledge base (`src/utils/rag/hvacKnowledgeBase.js`) with specific technical details from ACCA Manual J/S/D, ASHRAE standards, and NREL documentation to support the RAG stress test questions.

## New Knowledge Added

### 1. Manual J Enhancements

#### Solar Heat Gain by Direction (`manualJ.solarHeatGain`)

- ✅ East/West exposure has higher peak gain than South
- ✅ Fenestration loads and SHGC (Solar Heat Gain Coefficient)
- ✅ Specific multipliers: East/West typically 2-3x South
- ✅ Shading and glazing type impacts

#### Roof Color Impact (`manualJ.roofColor`)

- ✅ Dark roofs absorb more heat (higher Sol-Air temperature)
- ✅ Specific temperatures: Dark roofs 150-180°F vs light 100-120°F
- ✅ Radiant barrier reduces load by 30-50%
- ✅ Impact: Dark roof adds 10-20% to cooling load

### 2. Manual S Enhancements

#### Oversizing Limits (`manualS.equipmentSelection`)

- ✅ Enhanced: 15-20% maximum oversizing (was just 15%)
- ✅ Specific example: 2.8 ton load → max 3.36 tons (20% limit)
- ✅ Warning: 3.5 ton unit = 25% oversizing = TOO MUCH
- ✅ Explains humidity control issues from oversizing

#### Altitude Derating (`manualS.altitudeDerating`)

- ✅ NEW: 2-4% capacity loss per 1000ft elevation
- ✅ Example: 5000ft = 10-20% capacity reduction
- ✅ Manual S requirement to derate equipment
- ✅ Warning about undersizing at altitude

### 3. Manual D Enhancements

#### Static Pressure (`manualD.staticPressure`)

- ✅ NEW: HEPA filter impact (adds 0.3-0.5" WC)
- ✅ Specific problem: 0.5" design + 0.3" filter = 0.8" (exceeds 0.6" limit)
- ✅ Blower motor damage explanation
- ✅ Solutions: Larger filter area, lower MERV, redesign ducts

#### Flex Duct Limitations (`manualD.flexDuct`)

- ✅ NEW: High friction (2-3x rigid duct)
- ✅ Recommendation: Keep runs short, pulled tight
- ✅ Warning: Excessive length kills airflow
- ✅ Rule: Flex should not exceed 15-20% of total duct length

### 4. ASHRAE 55 Enhancements

#### Radiant Asymmetry (`ashrae55.radiantAsymmetry`)

- ✅ NEW: Mean Radiant Temperature (MRT) concept
- ✅ Cold window surfaces: 10-20°F colder than room air
- ✅ Body radiates heat to cold surfaces
- ✅ Specific example: 72°F air + 55°F window = feels like 63-65°F
- ✅ ASHRAE 55 limit: 5°F asymmetry maximum

### 5. ASHRAE 62.2 Enhancements

#### CO2 Levels (`ashrae622.airQuality`)

- ✅ Enhanced: 1000ppm is upper limit for "good" air
- ✅ Health effects: Cognitive decline above 1000ppm
- ✅ ASHRAE 62.2 requirement: Keep CO2 < 1000ppm
- ✅ Ventilation solutions

### 6. NREL/Physics Enhancements

#### Balance Point (`nrelData.balancePoint`)

- ✅ NEW: Definition from NREL/OpenEnergyMonitor
- ✅ Formula and calculation method
- ✅ Typical range: 25-40°F
- ✅ Practical meaning: Aux heat needed below this temp

#### Thermal Decay (`nrelData.thermalDecay`)

- ✅ NEW: Newton's Law of Cooling
- ✅ Formula: dT/dt = -k × (T - T_ambient)
- ✅ Practical formula: ΔT/Δt = -Heat_Loss_Factor × ΔT / Thermal_Mass
- ✅ Application: Calculate setback recovery time
- ✅ Connection to "free heat" concept

## RAG Trigger Keywords Updated

Added to `src/lib/groqAgent.js`:

- Direction, faces, roof color, dark roof, sol-air
- Altitude, elevation, derate
- HEPA, MERV, flex duct
- Draft, window, radiant
- CO2, carbon dioxide
- Thermal decay, newton, cooling law

## Test Protocol Created

Created `docs/RAG-STRESS-TEST-PROTOCOL.md` with:

- 10 specific test questions
- Expected responses with citations
- Pass/fail criteria
- Test results template

## Files Modified

1. `src/utils/rag/hvacKnowledgeBase.js` - Added 8 new knowledge topics
2. `src/lib/groqAgent.js` - Added RAG trigger keywords and fixed import
3. `docs/RAG-STRESS-TEST-PROTOCOL.md` - Created test protocol
4. `docs/ASK-JOULE-RAG-TEST-QUESTIONS.md` - Updated with new knowledge status

## Next Steps

1. **Run the stress test:** Use the 10 questions in `RAG-STRESS-TEST-PROTOCOL.md`
2. **Verify citations:** Each response should cite the specific manual/standard
3. **Check accuracy:** Verify technical details match the knowledge base
4. **Document results:** Use the test results template
5. **Fix any gaps:** If questions fail, identify missing knowledge and add it

## Expected Test Results

All 10 questions should now PASS because:

- ✅ All specific knowledge has been added to the knowledge base
- ✅ RAG triggers have been updated to catch these question types
- ✅ Knowledge includes citations to specific manuals/standards
- ✅ Technical details match the expected answers
