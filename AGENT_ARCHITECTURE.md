# Agent Architecture: Small Brain + Big Tools

## Philosophy

**The LLM should be lean and gain intelligence from tools, not from a massive prompt.**

---

## ✅ What We Changed

### Before (Prompt Bloat)
- 260-line system prompt with embedded rules
- ~7400 tokens per request (exceeded free tier limit)
- Reduced to 20 lines but still monolithic
- All knowledge baked into prompt

### After (Agent Architecture)
- **~15-line minimal system prompt**
- **~500-800 tokens per request** (2-3x more efficient)
- **Intelligence from tools + RAG**
- **Knowledge fetched on demand**

---

## 🧰 Agent Tools

The LLM gets "superpowers" via tools:

### 1. `getCurrentState(thermostatData)`
Returns live sensor data, temps, mode, system status

### 2. `getUserSettings(userSettings)`
Returns system specs (HSPF2, SEER2), preferences, capacity

### 3. `getLocationContext(userLocation)`
Returns city, state, elevation, climate zone

### 4. `searchHVACKnowledge(query)`
Fetches relevant docs from knowledge base (RAG simulation)

### 5. `calculateEnergyImpact(params)`
Estimates savings/costs for temperature changes

### 6. `checkPolicy(action, params)`
Validates actions against safety constraints

---

## 📁 Knowledge Base (RAG)

Instead of embedding everything in the prompt, we store knowledge in files:

```
/public/knowledge/
├── heat_pump_basics.md
├── aux_heat_guide.md
├── defrost_cycle.md
├── efficiency_tips.md
├── setback_strategy.md
└── ...
```

**The LLM fetches these on demand** based on the user's question.

---

## 🔄 Request Flow

### Traditional Approach (Bloated)
```
User Question
  ↓
[Massive 260-line prompt with all HVAC knowledge]
  ↓
LLM reasoning
  ↓
Answer
```
**Problem:** Wastes tokens on irrelevant knowledge every time.

---

### Agent Approach (Lean)
```
User Question
  ↓
[15-line minimal prompt: "You're an HVAC assistant with tools"]
  ↓
Auto-detect: Does question need "heat pump" knowledge?
  ↓
If yes → searchHVACKnowledge("heat pump") → fetch 500 chars
  ↓
Build minimal context (only relevant data)
  ↓
LLM reasoning
  ↓
Answer
```
**Benefits:**
- Only fetches what's needed
- Keeps token usage low
- Scales to unlimited knowledge (just add more .md files)
- Easy to update knowledge without changing code

---

## 📊 Token Efficiency Comparison

| Approach | System Prompt | Context | Total | Efficiency |
|----------|---------------|---------|-------|------------|
| **Original (260 lines)** | ~7400 tokens | ~500 | ~7900 | ❌ Exceeds free tier |
| **Reduced (20 lines)** | ~1000 tokens | ~500 | ~1500 | ⚠️ Still wasteful |
| **Agent (15 lines + RAG)** | ~200 tokens | ~600 | ~800 | ✅ 2-3x more efficient |

---

## 🎯 Context is Built Dynamically

The agent only includes what's relevant:

### Example 1: "What's the temperature?"
```
CONTEXT:
Current: 72°F indoor, target 70°F, mode: heat, 45°F outdoor
```
**(~50 tokens)**

### Example 2: "Why does my heat pump heat slowly?"
```
CONTEXT:
System: heatPump, HSPF2: 9, SEER2: 15

RELEVANT KNOWLEDGE:
Heat pumps move heat rather than create it. They produce 90-110°F 
discharge air (not 120-140°F like gas furnaces). Heating rate is 
1-2°F/hour, which is NORMAL...
```
**(~200 tokens + 500 token knowledge snippet = ~700 tokens)**

**Key insight:** We fetch knowledge *only when needed*, not every time.

---

## 🔍 RAG (Retrieval-Augmented Generation)

### Simple Keyword Matching (Current)
```javascript
if (question.includes('heat pump')) {
  fetchedKnowledge = await searchHVACKnowledge('heat pump');
}
```

### Future: Vector Search
Replace with embeddings + vector DB:
- Encode all knowledge files as vectors
- Encode user question as vector
- Find top-k similar documents
- Inject into context

**Benefits:**
- Handles semantic similarity (not just keywords)
- Scales to thousands of docs
- More accurate retrieval

---

## 🧠 Memory Structures (Future Enhancement)

Following the blueprint you provided:

### `/config/`
- `settings.json` → User preferences, system config
- `policy.json` → Safety constraints (max temp, setback limits)

### `/state/`
- `current_status.json` → Live thermostat state
- `sensor_cache.json` → Recent sensor readings
- `last_command.json` → Track recent actions

### `/agent/`
- `PLAN.md` → Short-term reasoning (agent loop state)
- `NOTES.md` → Learned heuristics, persistent insights
- `CONTEXT.md` → RAG index pointers

**Agent loop:**
```
1. Read PLAN.md (where did we leave off?)
2. Decide next action
3. Use one tool
4. Update PLAN.md
5. Return to user
```

---

## 🛡️ Safety via Policy Files

Instead of embedding rules in prompt:

### `policy.json`
```json
{
  "max_temp": 78,
  "min_temp": 60,
  "max_delta_per_hour": 2,
  "strip_heat_protection": true,
  "require_confirm_before_schedule_change": true
}
```

**The LLM reads this before executing commands.**

No massive prompt needed.

---

## 📝 Minimal System Prompt

```
You are Joule, an HVAC assistant. You have NO built-in knowledge.

You get intelligence from TOOLS:
- getCurrentState() → live thermostat data
- getUserSettings() → system specs, preferences  
- getLocationContext() → climate info
- searchHVACKnowledge(query) → fetch HVAC docs on demand
- calculateEnergyImpact(params) → estimate savings/costs
- checkPolicy(action, params) → validate safety constraints

Rules:
1. Be conversational and concise (1-3 sentences)
2. If you don't have data, say so honestly
3. Fetch knowledge docs when needed (search first, then answer)
4. Use specific numbers when available
5. Show personality for fun questions

When you don't know something, search for it. Don't make things up.
```

**That's it. ~15 lines. ~200 tokens.**

---

## 🚀 Benefits of Agent Architecture

### 1. **Scalable Knowledge**
Add unlimited .md files without touching code or prompt.

### 2. **Maintainable**
Update HVAC guidance by editing markdown files, not refactoring prompts.

### 3. **Token Efficient**
Only fetch what's needed → 2-3x fewer tokens → cheaper + faster.

### 4. **Transparent**
Developer and LLM share the same knowledge files (easy to debug).

### 5. **Extensible**
Add more tools easily (weather API, thermostat control, scheduling).

### 6. **Interpretable**
See exactly what knowledge the LLM accessed for each answer.

---

## 🔬 Test Results with Agent Architecture

*(To be run with new architecture)*

Expected improvements:
- ✅ Lower token usage (~800 vs ~1500)
- ✅ Faster responses (less to process)
- ✅ Same or better answer quality
- ✅ More room for conversation history

---

## 📦 Files Created

### Core Agent
- `src/lib/groqAgent.js` → Lean LLM agent with minimal prompt
- `src/lib/agentTools.js` → Tool library (superpowers for LLM)

### Knowledge Base
- `public/knowledge/heat_pump_basics.md`
- `public/knowledge/aux_heat_guide.md`
- `public/knowledge/defrost_cycle.md`

### Documentation
- `AGENT_ARCHITECTURE.md` → This file

---

## 🎯 Next Steps

### Phase 1: Test Current Implementation ✅
- [x] Create agent tools
- [x] Create knowledge base
- [x] Implement minimal prompt + RAG
- [ ] Test with live API
- [ ] Compare token usage vs old approach

### Phase 2: Add More Tools
- [ ] Weather API tool
- [ ] Energy cost calculator
- [ ] Schedule analyzer
- [ ] System diagnostics tool

### Phase 3: Implement Memory
- [ ] Add PLAN.md for agent state
- [ ] Add NOTES.md for learned heuristics
- [ ] Implement agent loop pattern

### Phase 4: Vector Search RAG
- [ ] Replace keyword matching with embeddings
- [ ] Use vector DB (ChromaDB, Pinecone, or local)
- [ ] Support semantic search across all docs

---

## 💡 Key Insight

**You don't build intelligence into the prompt. You give the LLM access to intelligence.**

The LLM is just a reasoning engine. The tools and knowledge base are the true "brain."

This is how you build production-grade agentic systems that scale.

