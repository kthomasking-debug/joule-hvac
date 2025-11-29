# Quick Start: Agent Implementation

## 📁 Complete File Structure

```
engineering-tools/
├── agent/                    # Agent memory
│   ├── PLAN.md              # Short-term memory (agent state)
│   └── NOTES.md             # Long-term memory (learned facts)
│
├── state/                    # Live system state
│   ├── current_status.json  # Current thermostat state
│   ├── sensors.json         # Sensor readings
│   └── last_command.json    # Last user command
│
├── config/                   # Configuration
│   ├── settings.json        # User preferences, system specs
│   ├── policy.json          # Safety constraints
│   └── ecobee_config.json   # Ecobee API credentials
│
├── logs/                     # Historical data
│   ├── heating_events.csv   # Runtime data
│   └── temperature_history.csv
│
├── knowledge/                # RAG knowledge base
│   ├── heat_pump_basics.md
│   ├── aux_heat_guide.md
│   ├── defrost_cycle.md
│   └── ... (8 total files)
│
└── src/lib/
    ├── groqAgent.js         # Main agent (minimal prompt)
    ├── agentTools.js        # Tool definitions
    └── apiConnectors.js      # Ecobee/API connections
```

---

## 🚀 Setup (3 Steps)

### 1. Create Directories
```bash
# Windows
powershell -ExecutionPolicy ByPass -File setup-agent-structure.ps1

# Linux/Mac
bash setup-agent-structure.sh
```

### 2. Copy Sample Files
```bash
# Copy example files to actual files
cp state/current_status.json.example state/current_status.json
cp config/settings.json.example config/settings.json
cp config/policy.json.example config/policy.json
```

### 3. Configure Ecobee API (Optional)
1. Register at https://www.ecobee.com/developers/
2. Create app, get API key
3. Authorize and get tokens
4. Save to `config/ecobee_config.json`

---

## 🧠 Minimal System Prompt

**Location:** `src/lib/groqAgent.js`

```javascript
const MINIMAL_SYSTEM_PROMPT = `You are Joule, an HVAC assistant. You have NO built-in knowledge.

You get intelligence from TOOLS:
- read_file(path) → read configuration, state, logs
- query_database(sql) → query historical data
- run_terminal(command) → execute system commands
- browse(url) → fetch from APIs (Ecobee, Nest, etc.)
- search_knowledge(query) → search documentation/manuals
- get_current_state() → get live thermostat data
- get_user_settings() → get system configuration

CRITICAL RULES:
1. If you don't have data, EXPLAIN WHY
2. Use tools to get real data before answering
3. Be specific and honest about limitations
4. Combine data from multiple tools to answer complex questions

When you don't know something, use tools to find out. Don't make things up.`;
```

**That's it. ~20 lines. ~200 tokens.**

---

## 🧰 7 Core Tools

### 1. `read_file(path)`
Reads files: state, config, logs, knowledge
```javascript
read_file('state/current_status.json')
read_file('config/policy.json')
read_file('knowledge/aux_heat_guide.md')
```

### 2. `query_database(sql)`
Queries historical data
```javascript
query_database("SELECT * FROM heating_events WHERE date = today")
```

### 3. `run_terminal(command)`
Executes system commands (whitelisted)
```javascript
run_terminal('curl http://local-api/sensors')
```

### 4. `browse(url)`
Fetches from APIs
```javascript
browse('https://api.ecobee.com/1/thermostat')
```

### 5. `search_knowledge(query)`
Searches documentation
```javascript
search_knowledge('aux heat threshold')
```

### 6. `get_current_state()`
Gets live thermostat data
```javascript
get_current_state()
```

### 7. `get_user_settings()`
Gets system configuration
```javascript
get_user_settings()
```

---

## 📄 Sample State Files

### `state/current_status.json`
```json
{
  "timestamp": "2025-11-24T10:30:00Z",
  "thermostat": {
    "indoorTemp": 72.5,
    "targetTemp": 70,
    "mode": "heat",
    "systemRunning": true
  },
  "heatPump": {
    "compressorRunning": true,
    "auxHeatActive": false
  },
  "runtime": {
    "compressorMinutesToday": 240,
    "auxHeatMinutesToday": 15
  }
}
```

### `config/settings.json`
```json
{
  "system": {
    "primarySystem": "heatPump",
    "hspf2": 10.5,
    "seer2": 20,
    "capacity": 36000
  },
  "location": {
    "city": "Blairsville",
    "state": "Georgia",
    "elevation": 2300
  }
}
```

### `config/policy.json`
```json
{
  "safety": {
    "maxTemp": 78,
    "minTemp": 60
  },
  "auxHeat": {
    "stripHeatProtection": true,
    "maxAuxRuntimePerHour": 20
  }
}
```

---

## 🔌 Ecobee API Connection

**File:** `src/lib/apiConnectors.js`

```javascript
import { EcobeeConnector } from './apiConnectors.js';

// Connect
const config = await readFile('config/ecobee_config.json');
const ecobee = new EcobeeConnector(config.data);

// Sync state
await ecobee.syncToStateFile();

// Get data
const summary = await ecobee.getSummary();
const thermostat = await ecobee.getThermostat();
const runtime = await ecobee.getRuntimeReport('2025-11-24', '2025-11-24');
```

---

## 🔄 How Agent Answers Questions

**Question:** "Why did my auxiliary heat activate at 6AM?"

**Agent Process:**

1. **Read PLAN.md** (if exists) - Check where we left off
2. **Read state/current_status.json** - Get current conditions
3. **Read state/heating_events.json** - Get event log
4. **Query database** - Get outdoor temp at 6AM
5. **Read config/policy.json** - Check aux heat settings
6. **Search knowledge** - Get aux heat activation info
7. **Combine data** - LLM reasons from all sources
8. **Answer** - "Outdoor temp dropped to 24°F, setpoint jumped 4°F, aux heat activated for 23 minutes"

**The LLM doesn't "know" anything. It queries tools to get real data.**

---

## ✅ Key Files Created

### Documentation
- ✅ `AGENT_IMPLEMENTATION_GUIDE.md` - Complete guide (this is the detailed version)
- ✅ `QUICK_START_AGENT.md` - This file (quick reference)

### Code
- ✅ `src/lib/groqAgent.js` - Main agent (minimal prompt)
- ✅ `src/lib/agentTools.js` - Tool definitions (7 tools)
- ✅ `src/lib/apiConnectors.js` - Ecobee API connector

### Sample Files
- ✅ `state/current_status.json.example`
- ✅ `config/settings.json.example`
- ✅ `config/policy.json.example`
- ✅ `config/ecobee_config.json.example`
- ✅ `agent/PLAN.md.example`
- ✅ `agent/NOTES.md.example`

### Setup Scripts
- ✅ `setup-agent-structure.ps1` - Windows
- ✅ `setup-agent-structure.sh` - Linux/Mac

---

## 🎯 Summary

**The LLM = Brain (reasoning only)**
- No built-in knowledge
- Understands natural language
- Reasons from data

**Tools = Eyes, Hands, Sensors**
- `read_file()` - Read state/config
- `query_database()` - Historical data
- `browse()` - API calls
- `search_knowledge()` - Documentation
- etc.

**Files = Memory**
- `state/` - Live data
- `config/` - Settings
- `agent/PLAN.md` - Short-term memory
- `agent/NOTES.md` - Long-term memory

**The agent becomes "smart" by combining data from all these sources.**

---

## 📚 Full Documentation

See `AGENT_IMPLEMENTATION_GUIDE.md` for:
- Complete tool implementations
- Full Ecobee API connector code
- Detailed examples
- Setup instructions

