# Complete Agent Implementation Guide

## 📁 Directory Structure

```
engineering-tools/
├── src/
│   ├── lib/
│   │   ├── groqAgent.js          # Main agent (minimal prompt)
│   │   ├── agentTools.js         # Tool definitions
│   │   └── apiConnectors.js       # Ecobee/API connections
│   └── ...
│
├── agent/
│   ├── PLAN.md                   # Short-term memory (agent state)
│   ├── NOTES.md                  # Long-term memory (learned facts)
│   └── CONTEXT.md                # RAG pointers (optional)
│
├── state/
│   ├── current_status.json       # Live thermostat state
│   ├── sensors.json              # Sensor readings
│   ├── last_command.json         # Last user command
│   └── heating_events.json       # Event log
│
├── config/
│   ├── settings.json             # User preferences
│   ├── policy.json               # Safety constraints
│   └── ecobee_config.json        # Ecobee API credentials
│
├── logs/
│   ├── heating_events.csv        # Historical runtime data
│   ├── temperature_history.csv   # Temp over time
│   └── energy_usage.csv         # Energy tracking
│
├── knowledge/
│   ├── heat_pump_basics.md
│   ├── aux_heat_guide.md
│   ├── defrost_cycle.md
│   ├── diagnostic_sensors.md
│   ├── aux_heat_diagnostics.md
│   ├── thermostat_settings.md
│   ├── cold_weather_performance.md
│   └── rapid_testing.md
│
└── docs/
    ├── ecobee_api_guide.md       # API documentation
    ├── wiring_diagrams/          # System diagrams
    └── manufacturer_specs/       # Equipment specs
```

---

## 🧠 Minimal System Prompt

**File:** `src/lib/groqAgent.js`

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
1. If you don't have data, EXPLAIN WHY:
   - "I don't have access to [specific sensor/data]"
   - "That requires [equipment/API] which isn't available"
   - "I can't measure [metric] because [reason]"

2. Use tools to get real data before answering:
   - Read state files for current conditions
   - Query database for historical data
   - Browse APIs for live sensor readings
   - Search knowledge base for documentation

3. Be specific and honest about limitations

4. Combine data from multiple tools to answer complex questions

When you don't know something, use tools to find out. Don't make things up.`;
```

---

## 🧰 Complete Tool Definitions

**File:** `src/lib/agentTools.js`

```javascript
// ============================================
// TOOL 1: read_file(path)
// ============================================
export async function readFile(filePath) {
  try {
    // In browser: fetch from public folder
    // In Node: use fs.readFile
    const response = await fetch(`/${filePath}`);
    if (!response.ok) {
      return { 
        error: true, 
        message: `File not found: ${filePath}`,
        available: listAvailableFiles()
      };
    }
    const content = await response.text();
    
    // Try to parse as JSON
    try {
      return { success: true, data: JSON.parse(content), raw: content };
    } catch {
      return { success: true, data: null, raw: content };
    }
  } catch (error) {
    return { error: true, message: error.message };
  }
}

// ============================================
// TOOL 2: query_database(sql)
// ============================================
export async function queryDatabase(sql) {
  // In browser: use IndexedDB or fetch from API
  // In Node: use SQLite or PostgreSQL
  
  // Example: Query heating events
  if (sql.includes('heating_events') || sql.includes('heat_events')) {
    return await queryHeatingEvents(sql);
  }
  
  // Example: Query temperature history
  if (sql.includes('temperature') || sql.includes('temp_history')) {
    return await queryTemperatureHistory(sql);
  }
  
  return { error: true, message: 'Unsupported query' };
}

async function queryHeatingEvents(sql) {
  // Parse SQL (simplified - use proper SQL parser in production)
  const today = sql.includes('today');
  const thisWeek = sql.includes('this week');
  
  // Read from CSV or database
  const events = await readFile('logs/heating_events.csv');
  // ... parse and filter ...
  
  return { success: true, rows: events };
}

// ============================================
// TOOL 3: run_terminal(command)
// ============================================
export async function runTerminal(command) {
  // In browser: proxy through API endpoint
  // In Node: use child_process.exec
  
  // Security: Whitelist allowed commands
  const allowedCommands = [
    'curl',
    'cat',
    'grep',
    'tail',
    'head',
  ];
  
  const cmd = command.split(' ')[0];
  if (!allowedCommands.includes(cmd)) {
    return { error: true, message: `Command not allowed: ${cmd}` };
  }
  
  // Execute (in Node.js)
  const { exec } = require('child_process');
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        resolve({ error: true, message: error.message, stderr });
      } else {
        resolve({ success: true, output: stdout });
      }
    });
  });
}

// ============================================
// TOOL 4: browse(url) - API Calls
// ============================================
export async function browse(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${getApiToken(url)}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      return { 
        error: true, 
        message: `API request failed: ${response.status} ${response.statusText}`,
        status: response.status
      };
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { error: true, message: error.message };
  }
}

// ============================================
// TOOL 5: search_knowledge(query)
// ============================================
export async function searchKnowledge(query) {
  // Simple keyword matching (upgrade to vector search)
  const knowledgeFiles = {
    'heat pump': 'knowledge/heat_pump_basics.md',
    'aux': 'knowledge/aux_heat_guide.md',
    'defrost': 'knowledge/defrost_cycle.md',
    // ... etc
  };
  
  for (const [keyword, file] of Object.entries(knowledgeFiles)) {
    if (query.toLowerCase().includes(keyword)) {
      const result = await readFile(file);
      return result;
    }
  }
  
  return { success: false, message: 'No relevant knowledge found' };
}

// ============================================
// TOOL 6: get_current_state()
// ============================================
export async function getCurrentState() {
  // Read from state file
  const state = await readFile('state/current_status.json');
  if (state.error) {
    // Fallback: try API
    return await browse('https://api.ecobee.com/1/thermostat?json={"selection":{"selectionType":"registered","selectionMatch":""}}');
  }
  return state;
}

// ============================================
// TOOL 7: get_user_settings()
// ============================================
export async function getUserSettings() {
  return await readFile('config/settings.json');
}

// ============================================
// Tool Registry
// ============================================
export const AVAILABLE_TOOLS = {
  read_file: {
    description: 'Read files from disk (state, config, logs)',
    params: ['path'],
    example: "read_file('state/current_status.json')",
  },
  query_database: {
    description: 'Query historical data (SQL)',
    params: ['sql'],
    example: "query_database('SELECT * FROM heating_events WHERE date = today')",
  },
  run_terminal: {
    description: 'Execute system commands (whitelisted)',
    params: ['command'],
    example: "run_terminal('curl http://local-api/sensors')",
  },
  browse: {
    description: 'Fetch data from APIs (Ecobee, Nest, etc.)',
    params: ['url'],
    example: "browse('https://api.ecobee.com/1/thermostat')",
  },
  search_knowledge: {
    description: 'Search documentation and manuals',
    params: ['query'],
    example: "search_knowledge('aux heat threshold')",
  },
  get_current_state: {
    description: 'Get live thermostat state',
    params: [],
    example: "get_current_state()",
  },
  get_user_settings: {
    description: 'Get system configuration',
    params: [],
    example: "get_user_settings()",
  },
};
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
    "fanMode": "auto",
    "systemRunning": true,
    "stage": "stage1",
    "hold": false
  },
  "sensors": {
    "main": {
      "temp": 72.5,
      "humidity": null,
      "occupancy": null
    },
    "outdoor": {
      "temp": 35,
      "humidity": 65,
      "source": "weather_api"
    }
  },
  "heatPump": {
    "compressorRunning": true,
    "auxHeatActive": false,
    "defrostActive": false,
    "outdoorUnitRunning": true
  },
  "runtime": {
    "compressorMinutesToday": 240,
    "auxHeatMinutesToday": 15,
    "fanMinutesToday": 300
  }
}
```

### `state/sensors.json`

```json
{
  "sensors": [
    {
      "id": "main",
      "name": "Main Thermostat",
      "type": "temperature",
      "value": 72.5,
      "unit": "fahrenheit",
      "location": "living_room",
      "lastUpdate": "2025-11-24T10:30:00Z"
    },
    {
      "id": "outdoor",
      "name": "Outdoor Temperature",
      "type": "temperature",
      "value": 35,
      "unit": "fahrenheit",
      "source": "weather_api",
      "lastUpdate": "2025-11-24T10:30:00Z"
    }
  ],
  "available": ["indoorTemp", "outdoorTemp"],
  "missing": [
    "supplyAirTemp",
    "returnAirTemp",
    "cfm",
    "wattDraw",
    "compressorStage",
    "cop",
    "outdoorCoilTemp"
  ]
}
```

### `state/last_command.json`

```json
{
  "timestamp": "2025-11-24T10:25:00Z",
  "command": "Set temperature to 70 degrees",
  "intent": "SET_THERMOSTAT",
  "parameters": {
    "temperature": 70
  },
  "result": "success",
  "executed": true
}
```

### `state/heating_events.json`

```json
{
  "events": [
    {
      "timestamp": "2025-11-24T06:00:00Z",
      "type": "recovery_start",
      "fromTemp": 68,
      "toTemp": 70,
      "mode": "heat",
      "stage": "stage1",
      "auxHeatUsed": false
    },
    {
      "timestamp": "2025-11-24T06:15:00Z",
      "type": "aux_heat_activation",
      "reason": "outdoor_temp_below_balance_point",
      "outdoorTemp": 24,
      "balancePoint": 30,
      "durationMinutes": 23
    },
    {
      "timestamp": "2025-11-24T06:38:00Z",
      "type": "aux_heat_deactivation",
      "reason": "target_reached",
      "totalAuxMinutes": 23
    }
  ],
  "summary": {
    "totalAuxMinutesToday": 23,
    "totalCompressorMinutesToday": 240,
    "auxPercentage": 8.7
  }
}
```

---

## ⚙️ Configuration Files

### `config/settings.json`

```json
{
  "user": {
    "name": "Thomas",
    "preferences": {
      "comfortFirst": false,
      "minimizeAuxHeat": true,
      "allowLargeSetbacks": false
    }
  },
  "system": {
    "primarySystem": "heatPump",
    "type": "heatPumpWithAux",
    "manufacturer": "Mitsubishi",
    "model": "Hyper Heat",
    "capacity": 36000,
    "capacityUnit": "BTU",
    "hspf2": 10.5,
    "seer2": 20,
    "afue": null,
    "tons": 3
  },
  "building": {
    "squareFeet": 2400,
    "insulationLevel": 0.65,
    "homeShape": 0.9,
    "ceilingHeight": 8,
    "elevation": 2300
  },
  "location": {
    "city": "Blairsville",
    "state": "Georgia",
    "lat": 34.8764,
    "lon": -83.9582,
    "elevation": 2300,
    "climateZone": "4A"
  },
  "utility": {
    "electricityCost": 0.15,
    "gasCost": 1.2,
    "electricityUnit": "kWh",
    "gasUnit": "therm"
  },
  "thermostat": {
    "brand": "Ecobee",
    "model": "SmartThermostat",
    "hasRemoteSensors": false,
    "hasOutdoorSensor": false,
    "apiEnabled": true
  }
}
```

### `config/policy.json`

```json
{
  "safety": {
    "maxTemp": 78,
    "minTemp": 60,
    "maxTempDeltaPerHour": 3,
    "maxSetback": 3
  },
  "auxHeat": {
    "stripHeatProtection": true,
    "maxAuxRuntimePerHour": 20,
    "preferHeatPump": true,
    "allowAuxDuringRecovery": true
  },
  "recovery": {
    "adaptiveRecovery": true,
    "maxRecoveryTime": 120,
    "preventAuxDuringRecovery": false
  },
  "confirmations": {
    "requireConfirmBeforeScheduleChange": true,
    "requireConfirmBeforeLargeTempChange": true,
    "largeTempChangeThreshold": 3
  }
}
```

### `config/ecobee_config.json`

```json
{
  "apiKey": "YOUR_ECOBEE_API_KEY",
  "accessToken": "YOUR_ACCESS_TOKEN",
  "refreshToken": "YOUR_REFRESH_TOKEN",
  "thermostatId": "123456789012",
  "baseUrl": "https://api.ecobee.com",
  "version": "1",
  "autoRefresh": true,
  "refreshInterval": 3600
}
```

---

## 🔌 Ecobee API Connection

**File:** `src/lib/apiConnectors.js`

```javascript
// ============================================
// Ecobee API Connector
// ============================================

export class EcobeeConnector {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.accessToken = config.accessToken;
    this.refreshToken = config.refreshToken;
    this.thermostatId = config.thermostatId;
    this.baseUrl = config.baseUrl || 'https://api.ecobee.com';
    this.version = config.version || '1';
  }

  /**
   * Get thermostat summary (lightweight, fast)
   */
  async getSummary() {
    const url = `${this.baseUrl}/${this.version}/thermostat?json=${JSON.stringify({
      selection: {
        selectionType: 'registered',
        selectionMatch: '',
        includeRuntime: true,
        includeSensors: true,
        includeSettings: true,
        includeProgram: true,
        includeEquipmentStatus: true,
      },
    })}`;

    return await this.request(url);
  }

  /**
   * Get full thermostat data
   */
  async getThermostat(thermostatId = null) {
    const id = thermostatId || this.thermostatId;
    const url = `${this.baseUrl}/${this.version}/thermostat?json=${JSON.stringify({
      selection: {
        selectionType: 'thermostats',
        selectionMatch: id,
        includeRuntime: true,
        includeSensors: true,
        includeSettings: true,
        includeProgram: true,
        includeEquipmentStatus: true,
        includeEvents: true,
        includeWeather: true,
      },
    })}`;

    return await this.request(url);
  }

  /**
   * Get runtime report (historical data)
   */
  async getRuntimeReport(startDate, endDate, columns = ['auxHeat1', 'compCool1', 'compHeat1']) {
    const url = `${this.baseUrl}/${this.version}/runtimeReport?json=${JSON.stringify({
      selection: {
        selectionType: 'thermostats',
        selectionMatch: this.thermostatId,
        startDate,
        endDate,
        columns,
        includeSensors: true,
      },
    })}`;

    return await this.request(url);
  }

  /**
   * Update thermostat settings
   */
  async updateSettings(settings) {
    const url = `${this.baseUrl}/${this.version}/thermostat?format=json`;
    const body = {
      selection: {
        selectionType: 'thermostats',
        selectionMatch: this.thermostatId,
      },
      thermostat: settings,
    };

    return await this.request(url, { method: 'POST', body: JSON.stringify(body) });
  }

  /**
   * Make authenticated request
   */
  async request(url, options = {}) {
    // Refresh token if needed
    await this.ensureValidToken();

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (response.status === 401) {
      // Token expired, refresh
      await this.refreshAccessToken();
      return this.request(url, options);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`Ecobee API error: ${error.message || response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken() {
    const response = await fetch('https://api.ecobee.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: this.apiKey,
      }),
    });

    const data = await response.json();
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;

    // Save updated tokens
    await this.saveTokens();

    return data;
  }

  /**
   * Ensure token is valid
   */
  async ensureValidToken() {
    // Check if token expires soon (within 5 minutes)
    // If so, refresh it
    // Implementation depends on token storage
  }

  /**
   * Save tokens to config file
   */
  async saveTokens() {
    const config = await readFile('config/ecobee_config.json');
    config.data.accessToken = this.accessToken;
    config.data.refreshToken = this.refreshToken;
    await writeFile('config/ecobee_config.json', JSON.stringify(config.data, null, 2));
  }

  /**
   * Sync current state to state file
   */
  async syncToStateFile() {
    const data = await this.getSummary();
    const thermostat = data.thermostatList[0];

    const state = {
      timestamp: new Date().toISOString(),
      thermostat: {
        indoorTemp: thermostat.runtime.actualTemperature / 10,
        targetTemp: thermostat.runtime.desiredHeat / 10,
        mode: thermostat.settings.hvacMode,
        fanMode: thermostat.runtime.desiredFanMode,
        systemRunning: thermostat.equipmentStatus.length > 0,
        stage: this.getStage(thermostat.equipmentStatus),
        hold: thermostat.events.length > 0,
      },
      sensors: {
        main: {
          temp: thermostat.runtime.actualTemperature / 10,
          humidity: thermostat.runtime.actualHumidity,
        },
        outdoor: {
          temp: thermostat.weather.forecasts[0].temperature / 10,
          humidity: thermostat.weather.forecasts[0].relativeHumidity,
          source: 'ecobee_weather',
        },
      },
      heatPump: {
        compressorRunning: thermostat.equipmentStatus.includes('compCool1') || 
                          thermostat.equipmentStatus.includes('compHeat1'),
        auxHeatActive: thermostat.equipmentStatus.includes('auxHeat1') || 
                      thermostat.equipmentStatus.includes('auxHeat2'),
        defrostActive: thermostat.equipmentStatus.includes('defrost'),
        outdoorUnitRunning: thermostat.equipmentStatus.includes('compHeat1') || 
                           thermostat.equipmentStatus.includes('compCool1'),
      },
      runtime: {
        compressorMinutesToday: thermostat.runtime.compHeat1 + thermostat.runtime.compCool1,
        auxHeatMinutesToday: thermostat.runtime.auxHeat1 + thermostat.runtime.auxHeat2,
        fanMinutesToday: thermostat.runtime.fan,
      },
    };

    await writeFile('state/current_status.json', JSON.stringify(state, null, 2));
    return state;
  }

  getStage(equipmentStatus) {
    if (equipmentStatus.includes('compHeat2') || equipmentStatus.includes('compCool2')) {
      return 'stage2';
    }
    if (equipmentStatus.includes('compHeat1') || equipmentStatus.includes('compCool1')) {
      return 'stage1';
    }
    return 'off';
  }
}

// ============================================
// Usage in Agent
// ============================================

export async function connectToEcobee() {
  const config = await readFile('config/ecobee_config.json');
  if (config.error) {
    return { error: true, message: 'Ecobee config not found' };
  }

  const connector = new EcobeeConnector(config.data);
  
  // Sync current state
  await connector.syncToStateFile();
  
  return connector;
}
```

---

## 📝 Memory Files

### `agent/PLAN.md`

```markdown
# PLAN

Goal: Diagnose why auxiliary heat activated at 6AM this morning

## Subtasks:
1. ✅ Read heating events log for today
2. ✅ Check outdoor temperature at 6AM
3. ✅ Read thermostat settings (recovery, aux threshold)
4. ✅ Compare indoor temp drop vs outdoor temp
5. ⏳ Analyze recovery logic
6. ⏳ Explain cause to user

## Next Action:
Read config/policy.json to check aux heat settings

## Context:
- User asked: "Why did my auxiliary heat activate at 6AM?"
- Current indoor temp: 72°F
- Target temp: 70°F
- Outdoor temp: 24°F
- System: Heat pump with aux strips
```

### `agent/NOTES.md`

```markdown
# NOTES

## Learned Facts:
- User prefers minimal auxiliary heat usage
- Heat pump is 3-ton Mitsubishi Hyper Heat
- House is 2,400 sq ft, 1980s build
- Outdoor sensor connected via Ecobee weather API
- Aux lockout is set to 35°F (from policy.json)

## Heuristics:
- Defrost cycles require no intervention unless > 40 min continuous
- Strip heat costs ~3-6x more than compressor
- User prefers "comfort-first" strategy unless strips activate
- Large setbacks (>3°F) often trigger strips during recovery

## System Behavior:
- Balance point appears to be around 30°F
- Recovery typically takes 1.5-2 hours for 2°F setback
- Aux heat activates when outdoor temp < 25°F OR temp delta > 3°F
```

---

## 🔄 Complete Agent Flow Example

**Question:** "Why did my auxiliary heat activate at 6AM?"

**Agent's internal process:**

### Step 1: LLM Generates Tool Calls (Suggestions)

The LLM doesn't execute anything - it generates tool calls:

```json
[
  {"tool": "read_file", "arguments": {"path": "state/heating_events.json"}},
  {"tool": "read_file", "arguments": {"path": "state/current_status.json"}},
  {"tool": "query_database", "arguments": {"sql": "SELECT outdoorTemp FROM temp_history WHERE time = '6AM'"}},
  {"tool": "read_file", "arguments": {"path": "config/policy.json"}}
]
```

### Step 2: Agent Framework Executes (Real Actions)

The agent framework (`agentExecutor.js`) validates and executes:

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

### Step 3: Results Fed Back to LLM

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

### Step 4: LLM Reasons from Data

LLM combines all the data and generates answer:

**Answer:**
> "Outdoor temp dropped to 24°F at 5:50AM, your setpoint jumped 4 degrees at 6AM (from 68°F to 72°F), and 'Allow Aux Heat during Recovery' was enabled in your policy — so strips activated for 23 minutes to recover quickly. The heat pump alone would have taken 2+ hours to recover that 4°F difference."

**Key Point:** The LLM **suggests** tool calls. The agent framework **executes** them. Tools **perform** real actions.

---

## 🚀 Setup Instructions

### 1. Create Directory Structure

```bash
mkdir -p agent state config logs knowledge docs
```

### 2. Initialize State Files

```bash
# Copy sample files from this guide
cp state/current_status.json.example state/current_status.json
cp config/settings.json.example config/settings.json
cp config/policy.json.example config/policy.json
```

### 3. Set Up Ecobee API

1. Register at https://www.ecobee.com/developers/
2. Create app, get API key
3. Authorize and get tokens
4. Save to `config/ecobee_config.json`

### 4. Test Agent

```javascript
import { answerWithAgent } from './src/lib/groqAgent.js';
import { connectToEcobee } from './src/lib/apiConnectors.js';

// Connect to Ecobee
const ecobee = await connectToEcobee();
await ecobee.syncToStateFile();

// Ask question
const answer = await answerWithAgent(
  "Why did my auxiliary heat activate at 6AM?",
  process.env.GROQ_API_KEY
);

console.log(answer.message);
```

---

## ✅ Summary

**The LLM doesn't "know" anything. It queries tools that give it real data.**

- **Files** = Persistent state, config, logs
- **APIs** = Live sensor data (Ecobee, Nest, etc.)
- **Database** = Historical data
- **Knowledge Base** = Documentation, manuals
- **PLAN.md** = Short-term memory
- **NOTES.md** = Long-term memory

**The agent becomes "smart" by combining data from all these sources.**

