# Ask Joule Agentic System - Testing Guide

## Overview

This document provides a comprehensive testing plan for the newly integrated agentic command system in Ask Joule. The agentic system enables intelligent multi-tool orchestration for complex voice queries.

## Architecture Summary

### Core Components

1. **JouleAgent Class** (`src/utils/agenticCommands.js`)

   - Intelligent tool routing and orchestration
   - Context-aware query analysis
   - Multi-step operation execution
   - Natural language response formatting

2. **Tool Registry** (6 integrated tools)

   - Balance Point Calculator
   - A/C Charging Calculator
   - Performance Analyzer
   - Setback Strategy Calculator
   - System Comparison
   - 7-Day Cost Forecaster

3. **Command Parser** (`src/components/askJouleParser.js`)

   - Agentic command patterns (lines 217-236)
   - Calculator command patterns
   - Direct navigation patterns

4. **AskJoule Integration** (`src/components/AskJoule.jsx`)
   - Agentic command handlers (lines 193-243)
   - Calculator command handlers (lines 245-325)
   - Navigation and settings handlers

## Test Cases

### 1. Agentic Multi-Tool Commands

#### Test 1.1: Full Comprehensive Analysis

**Voice Command:** "Comprehensive analysis" or "Give me a complete analysis"
**Expected Behavior:**

- Triggers `fullAnalysis` action
- Creates JouleAgent with userSettings
- Executes all 4 tools: balancePoint, performance, setback, comparison
- Returns formatted response combining all results
- Speaks combined natural language summary

**Validation:**

```javascript
// Should see in console:
// - Balance point calculation result
// - Performance metrics (heat loss factor, COP, thermal factor)
// - Setback savings (winter/summer monthly, annual)
// - System comparison (HP vs gas costs)
```

#### Test 1.2: System Performance Analysis

**Voice Command:** "Analyze my system" or "Check my system performance"
**Expected Behavior:**

- Triggers `systemAnalysis` action
- Executes performance + balancePoint tools
- Returns focused analysis on system health
- Reports balance point, heat loss factor, COP, thermal factor

**Validation:**

```javascript
// Response should include:
// - "Your balance point is X°F"
// - "Heat loss factor: Y BTU/hr/°F"
// - "Average COP: Z"
// - "Insulation quality: Good/Average/Poor"
```

#### Test 1.3: Cost Forecast

**Voice Command:** "Cost forecast for next week" or "What will my bill be this week?"
**Expected Behavior:**

- Triggers `costForecast` action
- Executes forecast tool with estimateWeeklyCost
- Returns weekly cost estimate based on avg temps
- Reports daily cost, weekly total, avg COP, avg temp

**Validation:**

```javascript
// Response should include:
// - "Weekly heating cost: $X"
// - "Daily average: $Y"
// - "Average outdoor temp: Z°F"
// - "Average COP: W"
```

#### Test 1.4: Savings Analysis

**Voice Command:** "All my savings" or "Show me all savings opportunities"
**Expected Behavior:**

- Triggers `savingsAnalysis` action
- Executes setback + comparison tools
- Returns comprehensive savings breakdown
- Reports setback monthly/annual + system comparison savings

**Validation:**

```javascript
// Response should include:
// - Winter setback savings: $X/month
// - Summer setback savings: $Y/month
// - Annual setback total: $Z
// - HP vs gas comparison winner + monthly/annual savings
```

### 2. Individual Calculator Commands

#### Test 2.1: Balance Point

**Voice Command:** "What's my balance point?"
**Expected Behavior:**

- Triggers `calculateBalancePoint` action
- Reads userSettings (squareFeet, hspf2, insulationLevel, designTemp, capacity)
- Calculates crossover temperature
- Returns balance point, aux heat at design, COP at design

**Validation:**

```javascript
// Response: "Your balance point is 32°F. At your design temp of 5°F,
// you'll need 25,000 BTU/hr of auxiliary heat. Your heat pump will
// operate at a COP of 1.8."
```

#### Test 2.2: A/C Charging

**Voice Command:** "Calculate charging for R-410A at 85°F"
**Expected Behavior:**

- Triggers `calculateCharging` action
- Extracts refrigerant=R-410A, outdoorTemp=85
- Uses ptCharts for saturation temps
- Returns target subcooling, superheat, diagnosis

**Validation:**

```javascript
// Response: "For R-410A at 85°F outdoor temp:
// Target subcooling: 10-15°F
// Target superheat: 8-12°F
// Status: Properly charged"
```

#### Test 2.3: Performance Metrics

**Voice Command:** "What's my heat loss factor?"
**Expected Behavior:**

- Triggers `calculatePerformance` action
- Computes heat loss factor = squareFeet × 0.018 × insulationLevel
- Calculates thermal factor, avg COP, insulation quality
- Returns formatted metrics

**Validation:**

```javascript
// Response: "Your heat loss factor is 36 BTU/hr/°F for a 2000 sq ft
// home with average insulation. Thermal factor: 0.018. Average COP: 2.65."
```

#### Test 2.4: Setback Savings

**Voice Command:** "Calculate setback savings"
**Expected Behavior:**

- Triggers `calculateSetback` action
- Uses winterTemp, summerTemp, utilityCost, hspf2, seer from userSettings
- Calculates winter/summer monthly savings, annual total
- Returns payback analysis (instant ROI)

**Validation:**

```javascript
// Response: "Winter setback savings: $25/month
// Summer setback savings: $18/month
// Annual total: $516
// Payback: Instant (programmable thermostats are free/low cost)"
```

#### Test 2.5: System Comparison

**Voice Command:** "Compare heat pump vs gas"
**Expected Behavior:**

- Triggers `compareSystem` action
- First calculates balance point for crossover temp
- Compares HP monthly cost vs gas furnace monthly cost
- Returns winner + monthly/annual savings

**Validation:**

```javascript
// Response: "Heat pump monthly cost: $85
// Gas furnace monthly cost: $120
// Winner: Heat pump saves $35/month ($420/year)
// Balance point: 32°F"
```

### 3. Multi-Turn Conversation Testing

#### Test 3.1: Tell Me More

**Initial Query:** "What's my balance point?"
**Follow-up:** "Tell me more"
**Expected Behavior:**

- Initial response: Balance point calculation
- Follow-up should use context resolver
- Should expand on balance point explanation

#### Test 3.2: Context Pronoun Resolution

**Query 1:** "What's my SEER?"
**Query 2:** "Why does it matter?"
**Expected Behavior:**

- Query 2 should resolve "it" → SEER
- Should provide SEER explanation using context

### 4. Suggested Questions Integration

#### Test 4.1: Home Page Suggestions

**Navigate to:** `/`
**Expected Suggestions:**

1. "Comprehensive analysis" 🔍
2. "What can I save this month?" 💰
3. "Show my energy flow" 📊
4. "How efficient is my system?" ⚡

#### Test 4.2: Cost Forecaster Page

**Navigate to:** `/cost-forecaster`
**Expected Suggestions:**

1. "Cost forecast for next week" 📅
2. "What will heating cost this week?" 🌡️

#### Test 4.3: Performance Analyzer Page

**Navigate to:** `/performance-analyzer`
**Expected Suggestions:**

1. "Analyze my system performance" 🔍
2. "What's my heat loss factor?" 📊

### 5. Error Handling

#### Test 5.1: Missing User Settings

**Setup:** Clear localStorage userSettings
**Query:** "Comprehensive analysis"
**Expected Behavior:**

- Should gracefully handle missing settings
- Should use defaults where possible
- Should return error message if critical data missing

#### Test 5.2: Invalid Calculator Params

**Query:** "Calculate charging for INVALID-REF"
**Expected Behavior:**

- Should fall back to R-410A default
- Should return valid charging targets
- Should not crash

### 6. Voice Control Integration

#### Test 6.1: Voice Recognition

**Speak:** "Comprehensive analysis"
**Expected Behavior:**

- Speech recognition captures query
- Parser detects fullAnalysis action
- Agent executes multi-tool analysis
- TTS speaks combined response

#### Test 6.2: Complex Multi-Turn Voice

**Speak:** "What's my balance point?"
**Wait for response**
**Speak:** "Tell me more about that"
**Expected Behavior:**

- First query calculates balance point
- Second query expands on balance point using context
- Both responses use TTS

## Performance Benchmarks

### Response Time Targets

- Single calculator: < 100ms
- Multi-tool analysis (2 tools): < 200ms
- Full comprehensive analysis (4 tools): < 500ms
- Voice recognition latency: < 500ms
- TTS playback start: < 200ms

### Memory Usage

- JouleAgent instance: < 1MB
- Tool execution overhead: < 500KB per tool
- Response formatting: < 100KB

## Integration Checklist

- [x] JouleAgent imported into AskJoule.jsx
- [x] fullAnalysis handler implemented
- [x] systemAnalysis handler implemented
- [x] costForecast handler implemented
- [x] savingsAnalysis handler implemented
- [x] Agentic patterns added to askJouleParser.js
- [x] Suggested questions updated with agentic prompts
- [x] Random tips include agentic capabilities
- [x] Build completes without errors
- [ ] E2E tests passing
- [ ] Voice control verified in browser
- [ ] Multi-turn conversations tested
- [ ] All calculator commands verified

## Known Limitations

1. **Forecast Tool:** Currently uses simplified weekly cost estimator. Full 7-day forecast integration pending.
2. **Settings Voice Control:** Basic navigation works, but direct settings modification ("set SEER to 18") not yet implemented.
3. **Methodology Explanations:** Educational content ("explain balance point calculation") currently falls back to AI. Dedicated methodology responses pending.

## Next Steps

1. **Enhanced Forecast Integration:** Connect to actual 7-day weather API for accurate cost predictions
2. **Settings Voice Modification:** Implement direct localStorage updates via voice commands
3. **Methodology Voice Responses:** Create dedicated educational response formatters
4. **Thermostat CSV Analysis:** Enable voice queries about uploaded thermostat data
5. **Multi-Device Sync:** Add cloud sync for conversation history and settings

## Success Metrics

- **Voice Control Coverage:** 100% of tools accessible via voice (target: 7/7 tools)
- **Agentic Query Success Rate:** 95% of multi-tool queries execute correctly
- **User Satisfaction:** Zero menu clicks required for common tasks
- **Response Accuracy:** 98% of calculator outputs match manual calculation pages
- **TTS Quality:** 100% of responses speak correctly without truncation

## Appendix: Voice Command Reference

### Agentic Commands

- "Comprehensive analysis" / "Complete report" / "Full analysis"
- "Analyze my system" / "Check my system" / "System health"
- "Cost forecast" / "Weekly cost prediction" / "Next week's bill"
- "All my savings" / "Total savings" / "How much can I save?"

### Calculator Commands

- "What's my balance point?" / "Calculate balance point"
- "Calculate charging for [refrigerant] at [temp]°F"
- "What's my heat loss factor?" / "System performance"
- "Calculate setback savings" / "Thermostat savings"
- "Compare heat pump vs gas" / "Which system is cheaper?"

### Navigation Commands

- "Go to [page name]" / "Navigate to [page]"
- "Show me [feature]" / "Open [calculator]"

### Settings Commands (partial)

- "Set location to [city]"
- "Update SEER to [value]"
- "Change utility cost to [value]"

### Context Commands

- "Tell me more" / "Explain that" / "More details"
- "Why does it matter?" / "What about it?"
- "Go back" / "Previous answer"
