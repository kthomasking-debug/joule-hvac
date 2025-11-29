# How LLM Executes Commands - Plain English Explanation

## 🧠 The Key Insight

**LLM thinks. Agent decides. Tools act.**

The LLM **does NOT run commands by itself**. It generates text (tool calls), and your **agent framework** decides what to do with that text.

---

## 🏗️ The Actual Flow

### 1. **LLM Receives Prompt**

User says: *"Set the heat pump to 70° but avoid using emergency heat unless necessary."*

LLM analyzes and thinks: *"Okay, user wants a 70° setpoint and no strip heat."*

---

### 2. **LLM Produces Structured Command (Tool Call)**

The LLM generates a **tool call** - it's just text/JSON, not an action:

```json
{
  "tool": "thermostat.set_temperature",
  "arguments": { "heat_setpoint": 70 }
}
```

Or:

```json
{
  "tool": "hvac.write_setting",
  "arguments": {
    "path": "/config/emergency_heat_allowed",
    "value": false
  }
}
```

**The LLM generates instructions, but does NOT execute anything.**

---

### 3. **Agent Framework Intercepts**

The agent framework (our `agentExecutor.js`) sees:

- LLM → "I want to call `thermostat.set_temperature`"
- It checks the tool registry
- If arguments are valid, it runs **real code**

```javascript
// This is REAL code that actually touches the thermostat
async function set_temperature(args) {
  const { heat_setpoint } = args;
  
  // Call Ecobee API (REAL ACTION)
  const ecobee = await getEcobeeConnector();
  await ecobee.updateSettings({
    runtime: { desiredHeat: heat_setpoint * 10 }
  });
  
  return { success: true, message: `Temperature set to ${heat_setpoint}°F` };
}
```

**The agent framework is the traffic controller.**

---

### 4. **Tool Executes Real Action**

This is where **actual side effects** happen:

- ✅ API call to thermostat (Ecobee, Nest, etc.)
- ✅ File write (`state/current_status.json`)
- ✅ Database query
- ✅ Terminal command
- ✅ Network request

**The LLM cannot do those things — the tools can.**

---

### 5. **Tool Sends Output Back to LLM**

The tool returns:

```json
{
  "success": true,
  "message": "Temperature set to 70°F",
  "currentTemp": 67
}
```

The LLM sees that and continues:

> "Done. Your heat pump is now set to 70°. Current temperature is 67°F, so it will start heating."

---

## 🧰 Where Does LLM Get HVAC Knowledge?

The LLM has **three sources**:

### 1. **Internal Training (General Knowledge)**

From its training data:
- What a heat pump is
- Why aux heat = expensive
- Why setbacks can trigger strips
- General HVAC concepts

**Limitation:** May be outdated or generic.

---

### 2. **RAG System (Your Documentation)**

The LLM can fetch via `search_knowledge()`:
- Your HVAC documentation
- Equipment manuals
- Ecobee configuration guides
- Sensor logs
- Historical performance data

**Example:**
```javascript
// LLM suggests:
{"tool": "search_knowledge", "arguments": {"query": "aux heat threshold"}}

// Tool executes:
// Reads knowledge/aux_heat_guide.md
// Returns: "Aux heat threshold is typically 2-3°F..."
```

---

### 3. **Real-Time Tool Access**

The LLM can call tools to get **live data**:

```javascript
// LLM suggests:
{"tool": "thermostat.get_status"}

// Tool executes:
// Calls Ecobee API or reads state/current_status.json
// Returns: { indoorTemp: 72, targetTemp: 70, mode: "heat" }
```

**This is what makes it accurate rather than hallucinating.**

---

## 🔄 Complete Example Flow

### User Question: "Why did my auxiliary heat activate at 6AM?"

**Step 1: LLM Generates Tool Calls**

```json
[
  {"tool": "read_file", "arguments": {"path": "state/heating_events.json"}},
  {"tool": "read_file", "arguments": {"path": "state/current_status.json"}},
  {"tool": "query_database", "arguments": {"sql": "SELECT outdoorTemp FROM temp_history WHERE time = '6AM'"}},
  {"tool": "read_file", "arguments": {"path": "config/policy.json"}}
]
```

**Step 2: Agent Framework Executes**

```javascript
// Tool 1: Read heating events
const events = await readFile('state/heating_events.json');
// Returns: { events: [{ type: 'aux_heat_activation', timestamp: '6AM', ... }] }

// Tool 2: Read current state
const state = await readFile('state/current_status.json');
// Returns: { thermostat: { indoorTemp: 72, ... } }

// Tool 3: Query database
const outdoorTemp = await queryDatabase("SELECT...");
// Returns: { rows: [{ outdoorTemp: 24 }] }

// Tool 4: Read policy
const policy = await readFile('config/policy.json');
// Returns: { auxHeat: { allowAuxDuringRecovery: true } }
```

**Step 3: Results Fed Back to LLM**

```json
{
  "tool_results": [
    {"tool": "read_file", "result": { "events": [...] }},
    {"tool": "read_file", "result": { "thermostat": {...} }},
    {"tool": "query_database", "result": { "rows": [{ "outdoorTemp": 24 }] }},
    {"tool": "read_file", "result": { "auxHeat": {...} }}
  ]
}
```

**Step 4: LLM Reasons from Data**

LLM combines all the data:
- Outdoor temp was 24°F at 6AM
- Setpoint jumped from 68°F to 72°F (4°F difference)
- Policy allows aux during recovery
- Event log shows aux activated for 23 minutes

**Step 5: LLM Generates Answer**

> "Outdoor temp dropped to 24°F at 5:50AM, your setpoint jumped 4 degrees at 6AM (from 68°F to 72°F), and 'Allow Aux Heat during Recovery' was enabled in your policy — so strips activated for 23 minutes to recover quickly. The heat pump alone would have taken 2+ hours to recover that 4°F difference."

---

## 🎯 Key Points

### ✅ What LLM Does:
- Generates tool calls (suggestions)
- Reasons from data
- Produces natural language responses
- Understands context

### ❌ What LLM Does NOT Do:
- Execute commands directly
- Touch hardware
- Write files
- Make API calls
- Access databases

### ✅ What Agent Framework Does:
- Validates tool calls
- Executes real code
- Handles errors
- Manages conversation flow

### ✅ What Tools Do:
- Actually touch the real world
- Make API calls
- Read/write files
- Query databases
- Execute commands

---

## 📁 Implementation

See `src/lib/agentExecutor.js` for the complete implementation:

- **Tool Registry** - Maps tool names to real functions
- **executeToolCall()** - Validates and executes tool calls
- **parseToolCalls()** - Extracts tool calls from LLM response
- **agentLoop()** - Main execution flow

---

## 🔌 Summary

**The LLM is not touching your thermostat directly.**

It's **instructing your agent** to run real commands through controlled interfaces you define.

**Flow:**
1. User asks question
2. LLM generates tool calls (text/JSON)
3. Agent framework validates and executes
4. Tools perform real actions
5. Results fed back to LLM
6. LLM generates final answer

**This is how agentic systems work.**

