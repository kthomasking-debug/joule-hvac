# Agent Demo - Contactor Bench Test Integration

## Quick Access

**Navigation:** Main menu → **Agent** (robot icon) or **More Menu** → **Contactor Demo**

## What This Demonstrates

The Contactor Demo now includes a **live AI agent chat interface** that can:

1. **Control thermostat settings** - "set thermostat to 72"
2. **Switch HVAC modes** - "switch to cool mode", "turn off"
3. **Change room temperature** (manual mode) - "set room temp to 65"
4. **Query current status** - "what is the current status"
5. **Switch temperature sources** - "use CPU temperature"

## Live Demo Features

### Visual Feedback

- **Real-time contactor animation** showing W (heat), Y (cool), G (fan) states
- **Temperature displays** showing current room temp and thermostat setting
- **System status indicator** showing active heating/cooling state
- **Chat history** with color-coded user commands and agent responses

### Command Examples

Try these commands in the agent chat:

```
set thermostat to 72
switch to cool mode
set room temp to 65
what is the current status
switch to heat mode
turn off
use manual temperature
set thermostat to 68
```

### Quick Action Buttons

Pre-configured buttons for common commands:

- **Set to 72°F** - Quick thermostat adjustment
- **Cool Mode** - Switch to cooling
- **Room 65°F** - Set manual room temperature
- **Status** - Query current system state

## Architecture

### Local Command Processing

Commands are processed locally for instant feedback:

- Pattern matching on natural language input
- Direct state updates to thermostat/HVAC controls
- Immediate visual response in contactors and displays

### Backend Agent Integration

Optional backend routing for complex queries:

- Commands containing "agent run" route to `/api/agent` endpoint
- SSE streaming for multi-step reasoning
- Memory persistence for context retention

## Testing Scenarios

### Scenario 1: Temperature Control

1. Type: "set thermostat to 75"
2. Observe thermostat slider update to 75°F
3. Watch contactor W close if room temp < 75°F (heat mode)
4. System status shows "🔥 Heating"

### Scenario 2: Mode Switching

1. Type: "switch to cool mode"
2. Observe HVAC mode button highlight change
3. If room temp > setpoint, contactor Y closes
4. System status shows "❄️ Cooling"

### Scenario 3: Manual Temperature Simulation

1. Type: "use manual temperature"
2. Type: "set room temp to 60"
3. Type: "set thermostat to 70"
4. Watch heat contactor (W) close
5. System status shows "🔥 Heating"

### Scenario 4: Status Query

1. Type: "what is the current status"
2. Agent responds with: room temp, setpoint, mode, source

## API Integration

### Temperature Server

- **Endpoint:** `http://localhost:3001/api/temperature/cpu`
- **Purpose:** Provides CPU-based temperature for bench testing
- **Formula:** CPU temp ÷ 2 = room temperature

### Agent Endpoint

- **Endpoint:** `http://localhost:3001/api/agent`
- **Method:** POST with `{ goal: string }`
- **Response:** SSE stream with plan, tool calls, final summary

## Future Enhancements

- [ ] Voice command input via microphone
- [ ] LLM-powered natural language understanding (beyond pattern matching)
- [ ] Multi-step reasoning for complex scenarios
- [ ] Historical command log with playback
- [ ] Preset automation sequences
- [ ] Integration with real thermostat hardware

## Technical Stack

- **Frontend:** React + Framer Motion (animations)
- **Agent Hook:** `useAgentRunner` (SSE streaming)
- **Command Processing:** Regex pattern matching
- **State Management:** React useState/useCallback
- **Styling:** Tailwind CSS with dark mode

## Files Modified

- `src/pages/ContactorDemo.jsx` - Added agent chat interface
- `src/navConfig.js` - Agent console in main nav
- `src/hooks/useAgentRunner.js` - SSE streaming hook
- `server/temperature-server.js` - Backend agent runtime

## Running the Demo

```powershell
# Terminal 1: Start temperature server
node server/temperature-server.js

# Terminal 2: Start dev server
npm run dev

# Navigate to http://localhost:5173/contactor-demo
```

**Tip:** Use the Contactor Demo page to showcase the agent's ability to control HVAC systems through natural language commands with immediate visual feedback.
