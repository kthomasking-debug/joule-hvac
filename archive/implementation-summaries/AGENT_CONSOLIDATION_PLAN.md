# Agent & LLM Consolidation Plan

## Current State Analysis

You have **5 overlapping LLM/Agent systems** that need consolidation:

### 1. **`groqIntegration.js`** - `askJouleFallback()`

- **Status**: ❌ **UNUSED** (imported but never called)
- **Purpose**: Simple fallback for when parser can't understand
- **Location**: `src/lib/groqIntegration.js`

### 2. **`groqAgent.js`** - `answerWithAgent()`

- **Status**: ✅ **ACTIVELY USED** (called in `fetchGroqLLM()`)
- **Purpose**: Agentic system with tools ("small brain, big tools" architecture)
- **Features**: Tool-based, conversation memory, proactive alerts
- **Location**: `src/lib/groqAgent.js`

### 3. **`JouleAgentCore.js`** - Full agentic system

- **Status**: ✅ **ACTIVELY USED** (via `useJouleAgent` hook)
- **Purpose**: Full agentic system with planning, reasoning, chain-of-thought
- **Features**: Multi-step planning, error recovery, proactive suggestions
- **Location**: `src/agents/JouleAgentCore.js`

### 4. **`agenticCommands.js`** - `JouleAgent` class

- **Status**: ❌ **UNUSED** (imported but never called)
- **Purpose**: Command router for multi-tool orchestration
- **Location**: `src/utils/agenticCommands.js`

### 5. **`useProactiveAgent.js`** - Proactive features

- **Status**: ✅ **ACTIVELY USED** (for alerts/briefings)
- **Purpose**: Background monitoring, alerts, daily briefings
- **Note**: This is a **separate concern** (not an LLM agent) - should stay

## Current Flow in AskJoule.jsx

```
User Query
    ↓
1. Try explicit commands (parseAskJoule) - UNIFIED PARSER
    ↓
2. If agenticMode ON → useJouleAgent.askAgent() (JouleAgentCore)
    ↓
3. Otherwise → answerWithAgent() (groqAgent.js)
```

**Note:** `parseThermostatCommand` from `commandParser.js` has been removed. All parsing is now handled by the unified `askJouleParser.js`.

## Consolidation Plan

### Goal: **One Unified Agent System**

### Recommended Architecture:

```
┌─────────────────────────────────────┐
│      Unified Joule Agent            │
│  (src/lib/jouleAgent.js)            │
├─────────────────────────────────────┤
│  - Simple mode: answerWithAgent()   │
│  - Advanced mode: full planning    │
│  - Same tool system                 │
│  - Same conversation memory         │
└─────────────────────────────────────┘
```

### Steps:

1. **Keep `groqAgent.js` as the base** (it's the most used and has the right architecture)
2. **Merge `JouleAgentCore` features into `groqAgent.js`** (planning, reasoning)
3. **Remove unused files**:
   - `groqIntegration.js` (unused)
   - `agenticCommands.js` (unused)
4. **Keep `useProactiveAgent.js`** (separate concern - alerts/briefings)

### Implementation:

1. Enhance `answerWithAgent()` to support both modes:

   ```javascript
   answerWithAgent(query, apiKey, {
     mode: "simple" | "advanced", // simple = current, advanced = planning
     enablePlanning: boolean,
     maxSteps: number,
   });
   ```

2. Move planning logic from `JouleAgentCore` into `groqAgent.js`

3. Update `AskJoule.jsx` to use single entry point:
   ```javascript
   // Remove useJouleAgent hook
   // Use answerWithAgent with mode flag
   const result = await answerWithAgent(query, apiKey, {
     mode: agenticMode ? 'advanced' : 'simple',
     ...
   });
   ```

## Files to Delete

- ❌ `src/lib/groqIntegration.js` (unused)
- ❌ `src/utils/agenticCommands.js` (unused)
- ❌ `src/agents/JouleAgentCore.js` (merge into groqAgent)
- ❌ `src/agents/useJouleAgent.js` (replace with direct call)

## Files to Keep

- ✅ `src/lib/groqAgent.js` (enhance with planning features)
- ✅ `src/hooks/useProactiveAgent.js` (separate concern)
- ✅ `src/lib/agentTools.js` (tool definitions)
- ✅ `src/lib/agentEnhancementsBrowser.js` (memory/alerts)

## Benefits

1. **Single source of truth** for LLM interactions
2. **Simpler codebase** - easier to understand and maintain
3. **No confusion** about which agent to use
4. **Same features** - just consolidated
5. **Easier testing** - one system to test

## Migration Checklist

- [ ] Enhance `groqAgent.js` with planning features
- [ ] Update `AskJoule.jsx` to use single entry point
- [ ] Remove unused imports
- [ ] Delete unused files
- [ ] Update tests
- [ ] Update documentation
