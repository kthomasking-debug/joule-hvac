# Talking Thermostat Command Coverage

This document summarizes the natural language commands currently implemented in `ContactorDemo.jsx` and validated by `e2e/agent-thermostat-commands.spec.ts`.

## Categories

### 1. Core Temperature Controls

- Set explicit temperature: "Set the temperature to 72", "change temperature to 70".
- Adjust relative: "Make it warmer by 2 degrees", "Make it cooler by 3 degrees".
- Simple relative (default ±2°): "Make it warmer", "Make it cooler".

### 2. HVAC Mode Controls

- Switch modes: "Switch to heat mode", "Switch to cool mode", "Switch to auto mode", "Turn off the system".
- Variations: "heating mode please".

### 3. Status & Diagnostics

- System running check: "Is the HVAC system running right now?".
- Full status report: "Give me a status report", "What is the current status?", "quick status", "status report".

### 4. Comfort Intelligence

- Optimize for comfort: sets AUTO + 72°F.
- Optimize for savings: sets AUTO + 68°F with savings hint.
- Comfort assessment: "How comfortable is the house right now?" (Very comfortable / Comfortable / Could be better).

### 5. Fun Personality & UX

- Agent feeling: "How are you feeling today?".
- Gordon Ramsay mode: "Gordon Ramsay mode" / "Ramsay" (playful energy waste feedback).
- Bedtime recommendation: "bedtime temperature recommendation" / "sleep temp" sets 66°F.

### 6. Source & Room Controls

- Switch sensor source: "use cpu temperature", "use manual temperature".
- Manual room temp: "Set room temp to 65".

### 7. Temperature Query Variations

- Current temperature: "What's the current temperature in the house?", "Current temp in house", "What temperature is it in here?", "What temperature is it in here?", "What temperature is it in here" (variations matched by extended regex).

### 8. Placeholder / Future Feature Commands

- Humidity: "What's the humidity" (placeholder message).
- Fan runtime: "Start the fan for 10 minutes" (placeholder message).
- Energy usage: "How much energy am I using" / "energy use".
- Weather / outside temp: "What's the outside temperature" / "outside temp".

## Regex Notes

- Temperature set: `/(?:set|change|adjust).*?(?:thermostat|temp|temperature).*?(\d+)/`
- Current temperature: combined pattern includes phrases like `what.*current.*temp`, `current.*temp.*house`, `temp.*in.*house`, and extended patterns for "what temperature is it in here".
- Relative adjustments: `/(?:make.*(?:warmer|hotter)|increase.*temp).*?(\d+)|(?:make.*(?:cooler|colder)|decrease.*temp).*?(\d+)/` plus simple warmer/cooler without digit.
- Mode switching: checks distinct patterns for heat/cool/auto/off.
- Status report: `/status|what.*setting|current.*status|quick.*status|status.*report/`.
- Comfort assessment: `/how.*comfort/`.
- Optimization: comfort `/optimize.*comfort/`, savings `/optimize.*(?:cost|savings|energy)/`.
- Personality: feeling `/how.*(?:you|are you).*feel/`; Ramsay `/gordon.*ramsay|ramsay/`.
- Bedtime: `/bedtime.*temp|sleep.*temp/`.

## Test Suite Pass Status

All 29 tests in `agent-thermostat-commands.spec.ts` are passing as of latest run.

## Future Extensions

- Integrate real humidity sensor → replace placeholder.
- Implement fan control scheduling.
- Add energy accounting model for live usage estimates.
- Attach external weather API for real outside temp.
- Expand natural language for multi-step intents (e.g., "Optimize for comfort and set bedtime temperature").

## Maintenance Guidelines

1. When adding new commands, update both `processAgentCommand` and this document.
2. Keep regex specific to avoid accidental overlaps (prefer grouping with non-greedy qualifiers).
3. Add E2E test coverage for every new command phrase and at least one variation.
4. Use agent response bubble selectors (`.bg-green-100` / dark variant) in tests to target final responses.

---

_Last updated: 2025-11-20_
