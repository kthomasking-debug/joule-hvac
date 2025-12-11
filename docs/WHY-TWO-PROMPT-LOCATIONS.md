# Why Two Prompt Locations? Understanding the Dual LLM Architecture

## Overview

The application uses **two separate LLM systems** with different prompts because they serve **completely different purposes**:

1. **`groqAgent.js`** - **Conversational Q&A Agent** (Primary)
2. **`thermostatIntentClassifier.js`** - **Command Intent Classifier** (Secondary)

---

## System 1: `groqAgent.js` - Conversational Agent (Primary)

**Location:** `src/lib/groqAgent.js`

**Purpose:** Answers user questions with full conversational responses

**System Prompt:** `SYSTEM_PROMPT` (line 2)
- Makes Joule act like an HVAC expert
- Provides detailed explanations
- Answers "what", "why", "how" questions
- Maximum 250 words per response

**Example Use Cases:**
- "What's my balance point?" → Full explanation with calculations
- "Why is my system short cycling?" → Diagnostic explanation
- "How much can I save?" → Detailed savings analysis
- "Explain what HSPF means" → Educational response

**Output:** Natural language text response (paragraphs, explanations)

**Function:** `answerWithAgent(userQuestion, apiKey, ...)`

**When Used:**
- User asks informational questions
- User needs explanations
- User wants analysis or diagnostics
- General HVAC knowledge queries

---

## System 2: `thermostatIntentClassifier.js` - Intent Classifier (Secondary)

**Location:** `src/lib/thermostatIntentClassifier.js`

**Purpose:** Classifies voice commands into structured intents for execution

**System Prompt:** `systemPrompt` (line 48)
- Classifies commands into intent types
- Extracts structured parameters
- Returns JSON, not natural language
- Very focused on command recognition

**Example Use Cases:**
- "set temp to 72" → `{intent: "SET_THERMOSTAT", temperature: 72}`
- "make it warmer" → `{intent: "ADJUST_TEMP_UP", degrees: 2}`
- "switch to heat mode" → `{intent: "SWITCH_MODE", mode: "heat"}`
- "set to 70 and switch to cool" → `{intent: "MULTI_STEP", actions: [...]}`

**Output:** Structured JSON object with intent type and parameters

**Function:** `classifyIntent(command, apiKey, model)`

**When Used:**
- User gives voice commands
- User wants to control the thermostat
- User issues action commands (not questions)
- System needs to execute specific actions

---

## Why They're Separate

### 1. **Different Output Formats**

**groqAgent:**
```javascript
// Returns natural language
{
  success: true,
  message: "Your balance point is approximately 28°F. This means your heat pump can maintain temperature down to 28°F before auxiliary heat becomes necessary..."
}
```

**thermostatIntentClassifier:**
```javascript
// Returns structured JSON
{
  intent: "SET_THERMOSTAT",
  parameters: {
    temperature: 72,
    degrees: null,
    mode: null
  },
  confidence: 0.95,
  method: "llm"
}
```

### 2. **Different Token Budgets**

**groqAgent:**
- Needs tokens for full explanations
- Can use 300+ tokens for detailed answers
- Temperature: 0.1-0.3 (more creative)

**thermostatIntentClassifier:**
- Must be fast and precise
- Limited to 200 tokens (classification only)
- Temperature: 0.1 (deterministic)
- Uses JSON mode for structured output

### 3. **Different Prompt Complexity**

**groqAgent Prompt:**
- ~720 tokens
- Personality, tone, style guidelines
- Multiple modes (Byzantine, Marketing, Normal)
- Complex rules about what to say/not say

**thermostatIntentClassifier Prompt:**
- ~500 tokens
- Focused on classification rules
- Intent definitions and examples
- JSON schema requirements

### 4. **Different Use Cases**

**groqAgent:**
- "What is..." → Answer question
- "Why does..." → Explain concept
- "How much..." → Calculate and explain
- "Tell me about..." → Provide information

**thermostatIntentClassifier:**
- "Set..." → Execute command
- "Make it..." → Execute adjustment
- "Switch to..." → Change mode
- "Show..." → Display data

---

## How They Work Together

### Flow 1: Question → Answer (groqAgent)

```
User: "What's my balance point?"
  ↓
askJouleParser.js checks if it's a question
  ↓
groqAgent.answerWithAgent() called
  ↓
SYSTEM_PROMPT used
  ↓
Full conversational answer returned
```

### Flow 2: Command → Action (thermostatIntentClassifier)

```
User: "set temp to 72"
  ↓
askJouleParser.js detects command
  ↓
thermostatIntentClassifier.classifyIntent() called
  ↓
Intent classification prompt used
  ↓
Structured intent returned: {intent: "SET_THERMOSTAT", temperature: 72}
  ↓
Command executor runs the action
```

### Flow 3: Hybrid (Both Systems)

```
User: "set temp to 72 and tell me why that's efficient"
  ↓
thermostatIntentClassifier extracts: {intent: "SET_THERMOSTAT", temperature: 72}
  ↓
Command executed: Temperature set to 72
  ↓
groqAgent.answerWithAgent() called for "why that's efficient"
  ↓
Full explanation provided
```

---

## Architecture Benefits

### 1. **Separation of Concerns**
- Classification logic separate from conversational logic
- Easier to optimize each system independently
- Can update prompts without affecting the other

### 2. **Performance**
- Intent classifier is fast (200 tokens, low temp)
- Conversational agent can be more thorough (300+ tokens)
- Different models can be used for each (if needed)

### 3. **Reliability**
- Intent classifier has regex fallback
- Conversational agent has tool-based fallback
- Each can fail independently without breaking the other

### 4. **Maintainability**
- Clear boundaries between systems
- Easier to test each system separately
- Can swap out either system without affecting the other

---

## Code Examples

### Using groqAgent (Conversational)

```javascript
import { answerWithAgent } from '../lib/groqAgent';

const response = await answerWithAgent(
  "What's my balance point?",
  apiKey,
  thermostatData,
  userSettings,
  userLocation
);

// Response: {
//   success: true,
//   message: "Your balance point is approximately 28°F..."
// }
```

### Using thermostatIntentClassifier (Command)

```javascript
import { classifyIntent } from '../lib/thermostatIntentClassifier';

const result = await classifyIntent(
  "set temp to 72",
  apiKey
);

// Result: {
//   intent: "SET_THERMOSTAT",
//   parameters: { temperature: 72, degrees: null, mode: null },
//   confidence: 0.95,
//   method: "llm"
// }
```

---

## Summary

| Aspect | groqAgent.js (Primary) | thermostatIntentClassifier.js (Secondary) |
|--------|------------------------|-------------------------------------------|
| **Purpose** | Answer questions | Classify commands |
| **Input** | Questions, queries | Commands, actions |
| **Output** | Natural language text | Structured JSON |
| **Token Budget** | 300+ tokens | 200 tokens |
| **Temperature** | 0.1-0.3 | 0.1 (deterministic) |
| **Use Case** | "What is...", "Why...", "How..." | "Set...", "Make...", "Switch..." |
| **Fallback** | Tool-based | Regex patterns |

**They're not redundant—they're complementary systems that work together to provide both conversational intelligence and precise command execution.**

---

_Last updated: 2025-01-27_


