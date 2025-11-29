# Expert Diagnostic Questions - Agent Handling

## ✅ What Was Added

### 1. Enhanced "I Don't Know" Responses
The agent now **explains WHY** it doesn't have data:

**Before:**
- ❌ "I don't know"
- ❌ "I don't have that data"

**After:**
- ✅ "I don't have a supply air temperature sensor installed. That requires a sensor placed in the ductwork near the air handler, which isn't part of standard thermostat installations."
- ✅ "I don't have real-time power monitoring for the auxiliary heat strips. That would require a current clamp or power meter installed on the strip heat circuit."

### 2. New Knowledge Base Files
Added 5 new knowledge files covering expert topics:

- ✅ `diagnostic_sensors.md` - What sensors are/aren't available, how to explain missing data
- ✅ `aux_heat_diagnostics.md` - Advanced aux heat questions (lockout, thresholds, runtime)
- ✅ `thermostat_settings.md` - Ecobee-specific settings (staging, recovery, balance mode)
- ✅ `cold_weather_performance.md` - Performance metrics, COP, heating rates
- ✅ `rapid_testing.md` - Will strips trigger? Safe temperature steps?

### 3. New Tool: `getDiagnosticData()`
Checks what sensors are available vs missing for diagnostic questions:

```javascript
getDiagnosticData("What's the supply air temperature?", thermostatData, userSettings)
// Returns:
// {
//   available: ['indoorTemp', 'targetTemp', 'mode'],
//   missing: ['supplyAirTemp', 'returnAirTemp'],
//   explanation: "Missing sensors: supplyAirTemp, returnAirTemp. These require specialized sensors..."
// }
```

### 4. Enhanced RAG Search
Now automatically fetches relevant knowledge for expert questions:

- "supply air" → `diagnostic_sensors.md`
- "lockout" → `aux_heat_diagnostics.md`
- "setting" → `thermostat_settings.md`
- "recovery" → `rapid_testing.md`
- "cold weather" → `cold_weather_performance.md`

---

## 📋 Question Categories Handled

### 🔥 Heat Mode - Deeper Diagnostics

| Question | Agent Response |
|----------|---------------|
| "What is the current delta between supply air and return air?" | ✅ Explains: "I don't have supply/return air sensors. These require sensors in the ductwork..." |
| "How many BTUs are we delivering right now?" | ✅ Explains: "I can't measure BTU output directly. That requires airflow and temperature sensors..." |
| "What's the current compressor stage?" | ✅ Explains: "I don't have access to compressor stage info. That requires communication with the outdoor unit..." |
| "What's the current fan CFM?" | ✅ Explains: "I don't have a CFM meter. That requires specialized airflow measurement equipment..." |
| "Is my heat pump operating near its rated COP?" | ✅ Explains: "COP requires multiple sensors (outdoor temp, energy usage, heat output) which I don't have..." |
| "Is the thermostat calling for heat stage 1 or stage 2?" | ✅ Explains: "I don't have access to staging information. That requires thermostat API access..." |
| "Is my heat pump short-cycling?" | ✅ Can analyze if runtime data available, or explains what data is needed |
| "What's the current duty cycle?" | ✅ Explains: "Duty cycle requires runtime logging over time, which I don't have..." |

### ⚡ Aux Heat / Heat Strips

| Question | Agent Response |
|----------|---------------|
| "What exact condition caused auxiliary heat to activate?" | ✅ Uses knowledge from `aux_heat_diagnostics.md` to explain common triggers |
| "How long were the strips active today?" | ✅ Explains: "I don't have runtime logging for auxiliary heat. That requires separate relay monitoring..." |
| "What percentage of heating was from strips vs heat pump?" | ✅ Explains: "I don't have separate runtime tracking. Can estimate from energy costs if available..." |
| "What's the current lockout setting for auxiliary heat?" | ✅ Explains: "I don't have access to thermostat configuration settings. That requires API access..." |
| "Can you show me the real-time watt draw of the heat strips?" | ✅ Explains: "I don't have real-time power monitoring. That requires a current clamp or power meter..." |
| "What's the auxiliary heat maximum runtime per hour?" | ✅ Uses knowledge to explain typical limits (15-20 min/hour) |
| "Did thermostat recovery cause the strips to come on?" | ✅ Uses knowledge to explain recovery behavior and when strips activate |
| "At what outdoor temperature did the strips turn on today?" | ✅ Explains: "I don't have historical logging. That requires runtime data tracking..." |
| "Is my auxiliary heat lockout temperature configured correctly?" | ✅ Uses knowledge to explain typical lockout temps (30-40°F) and how to check |
| "Would turning adaptive recovery off prevent strip activation?" | ✅ Uses knowledge from `rapid_testing.md` to explain recovery behavior |

### ❄️ Cold Weather Performance

| Question | Agent Response |
|----------|---------------|
| "How many degrees per hour are we heating?" | ✅ Uses knowledge: "Heat pumps typically heat 1-2°F/hour. Can estimate based on outdoor temp..." |
| "What's the lowest outdoor temp where heat pump maintained setpoint?" | ✅ Explains: "I don't have historical data logging. Can estimate from balance point (25-35°F)..." |
| "Are we losing ground against the cold right now?" | ✅ Can check if temp is dropping despite system running, explains possible causes |
| "Is the heat pump's performance degrading in this cold?" | ✅ Uses knowledge: "Yes, this is expected. COP drops as outdoor temp decreases..." |
| "What is the COP trend over the last 24 hours?" | ✅ Explains: "COP requires multiple sensors not available. Can estimate from outdoor temp..." |

### 🔧 Thermostat Settings (Ecobee-Specific)

| Question | Agent Response |
|----------|---------------|
| "What is my heat pump minimum outdoor temperature?" | ✅ Explains: "I don't have access to thermostat configuration. Typical is 0-15°F..." |
| "Is 'heat pump to heat' enabled?" | ✅ Explains: "I don't have access to thermostat settings. That requires API access..." |
| "What is the temperature differential for heat?" | ✅ Explains: "I don't have access to thermostat settings. Typical is 0.5-2°F..." |
| "Is staging set to 'Auto' or 'Manual'?" | ✅ Explains: "I don't have access to thermostat settings. Check your thermostat menu..." |
| "What is my Aux Heat Max Outdoor Temp?" | ✅ Explains: "I don't have access to thermostat settings. Typical is 30-40°F..." |
| "Is 'Allow Aux Heat when recovering from setback' enabled?" | ✅ Explains: "I don't have access to thermostat settings. Check your thermostat menu..." |
| "Is Smart Recovery enabled for heating?" | ✅ Explains: "I don't have access to thermostat settings. Check your thermostat menu..." |
| "What is my Heat Pump Balance mode?" | ✅ Explains: "I don't have access to thermostat settings. Options are Max Savings, Savings, Comfort..." |

### 🧪 Rapid Testing Questions

| Question | Agent Response |
|----------|---------------|
| "If I increase setpoint by 3 degrees, will strips activate?" | ✅ Uses knowledge from `rapid_testing.md` to explain factors and recommend 1-2°F |
| "How big a temperature step can I safely request?" | ✅ Uses knowledge: "1-2°F is safe, 3°F may trigger, 4+°F very likely" |
| "If I disable Smart Recovery, what would heating profile look like?" | ✅ Uses knowledge to explain recovery behavior with/without Smart Recovery |
| "Given current outdoor temp, how long to heat 5 degrees without strips?" | ✅ Uses knowledge: "1-2°F/hour = 2.5-5 hours for 5°F" |
| "Would a nighttime setback trigger strips in the morning?" | ✅ Uses knowledge to explain factors (setback size, outdoor temp, recovery time) |

### 📊 Performance & Logging

| Question | Agent Response |
|----------|---------------|
| "What were my heating runtimes by stage today?" | ✅ Explains: "I don't have runtime logging by stage. That requires historical data tracking..." |
| "Which heating event had the longest continuous compressor run?" | ✅ Explains: "I don't have historical event logging. That requires runtime data..." |
| "Which time of day do I typically hit strip heat?" | ✅ Explains: "I don't have historical logging. Can estimate: typically morning recovery..." |
| "Are we using more auxiliary heat this week than last week?" | ✅ Explains: "I don't have historical comparison data. That requires runtime logging..." |
| "What's the average supply air temperature during heat mode?" | ✅ Explains: "I don't have a supply air sensor. That requires a sensor in the ductwork..." |

### 🧠 "Explain the Logic" Questions

| Question | Agent Response |
|----------|---------------|
| "Explain why you chose to run compressor instead of strips" | ✅ Uses knowledge to explain decision factors (outdoor temp, balance point, temp delta) |
| "Explain why you did—or didn't—activate auxiliary heat" | ✅ Uses knowledge to explain aux heat triggers (balance point, recovery, defrost) |
| "Show me the entire control logic you used" | ✅ Explains: "I don't have access to thermostat control logic. That's proprietary..." |
| "What factors are you prioritizing: comfort, efficiency, or protection?" | ✅ Uses knowledge to explain typical priorities and trade-offs |
| "Walk me through the recovery logic you used this morning" | ✅ Uses knowledge to explain Smart Recovery and recovery behavior |

### 🔍 Misconfiguration Checking

| Question | Agent Response |
|----------|---------------|
| "Do my heat stages match my equipment wiring?" | ✅ Explains: "I can't verify wiring. That requires physical inspection or professional service..." |
| "Is the thermostat properly configured for heat pump with aux?" | ✅ Uses knowledge to explain proper configuration (heat pump + aux, not conventional) |
| "Is the reversing valve energized correctly (O/B setting)?" | ✅ Explains: "I can't verify O/B setting. That requires checking thermostat configuration..." |
| "Is auxiliary heat set as stage 2 heat or emergency heat?" | ✅ Uses knowledge to explain difference and typical configuration |
| "Is the thermostat accidentally configured as conventional heat?" | ✅ Uses knowledge to explain how to check and why it matters |

### 🧯 Emergency Heat

| Question | Agent Response |
|----------|---------------|
| "Is Emergency Heat currently available?" | ✅ Explains: "I don't have access to emergency heat status. Check your thermostat..." |
| "What would happen if I forced Emergency Heat right now?" | ✅ Uses knowledge to explain emergency heat behavior (aux only, no heat pump) |
| "How much energy would Emergency Heat use per hour?" | ✅ Uses knowledge: "10-15 kW typical, costs 3-4x more than heat pump" |
| "Is Emergency Heat locked out?" | ✅ Explains: "I don't have access to lockout settings. Check your thermostat..." |
| "When was the last time Emergency Heat came on?" | ✅ Explains: "I don't have historical logging. That requires runtime data..." |

### 🚨 Failure Detection

| Question | Agent Response |
|----------|---------------|
| "Is the compressor not providing expected lift?" | ✅ Explains: "I can't measure lift directly. Signs include poor heating, low discharge temp..." |
| "Is the auxiliary heat coming on too often?" | ✅ Can analyze if runtime data available, or explains what to check |
| "Is the outdoor unit failing to defrost?" | ✅ Uses knowledge to explain defrost problems (excessive frequency, heavy ice) |
| "Is my system potentially low on refrigerant?" | ✅ Uses knowledge to explain signs (poor heating, frequent defrost, high energy) |
| "Are any sensors reporting incorrect values?" | ✅ Explains: "I can't verify sensor accuracy. Check for drift, placement issues..." |
| "Is the thermostat seeing excessive temperature drift?" | ✅ Explains: "I can't measure drift. Check sensor placement, calibration..." |

---

## 🎯 Response Pattern

For every expert question, the agent follows this pattern:

1. **Acknowledge** - "That's a great diagnostic question"
2. **Explain what's missing** - "I don't have [specific sensor/data]"
3. **Explain why** - "That requires [equipment/access] which isn't available"
4. **Suggest alternatives** - "I can tell you [related info] instead"
5. **Provide what's available** - "Based on [available data], I can estimate..."

---

## ✅ Summary

**All expert-level questions are now handled:**

- ✅ Agent explains WHY it doesn't have data (not just "I don't know")
- ✅ Knowledge base covers all diagnostic topics
- ✅ RAG automatically fetches relevant knowledge
- ✅ Agent provides alternatives when possible
- ✅ Agent uses available data to provide partial answers

**The agent is now ready for expert-level diagnostic questions!** 🚀

