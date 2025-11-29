# Joule Agentic AI System

## Overview

Transform Ask Joule from a simple Q&A tool into a fully autonomous agentic AI that can:

- **Plan** multi-step operations autonomously
- **Reason** through complex queries with chain-of-thought
- **Execute** tools in sequence with error handling
- **Learn** from conversation history and user preferences
- **Self-correct** when encountering errors
- **Proactively suggest** optimizations and next steps

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Query                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Chain of Thought Reasoner                  │
│  • Intent Detection                                     │
│  • Entity Extraction                                    │
│  • Context Integration                                  │
│  • Confidence Scoring                                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  Agent Planner                          │
│  • Create execution plan                                │
│  • Select tools based on intent                         │
│  • Handle missing data                                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                 Agent Executor                          │
│  • Run tools in sequence                                │
│  • Handle errors gracefully                             │
│  • Track progress                                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   Reflector                             │
│  • Evaluate results                                     │
│  • Detect issues                                        │
│  • Retry if needed                                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Response Generator (LLM)                   │
│  • Natural language response                            │
│  • Proactive suggestions                                │
│  • Actionable recommendations                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                Agent Memory                             │
│  • Store interaction                                    │
│  • Update preferences                                   │
│  • Build context for future queries                     │
└─────────────────────────────────────────────────────────┘
```

## Core Components

### 1. JouleAgentCore (`src/agents/JouleAgentCore.js`)

Main orchestrator that coordinates all agent subsystems:

```javascript
const agent = new JouleAgentCore(userSettings, tools, conversationHistory);
const result = await agent.processQuery(
  "How much will heating cost next week?"
);
```

**Features:**

- Full agentic loop: Plan → Execute → Reflect → Respond
- Multi-step reasoning with chain of thought
- Automatic error detection and retry logic
- Proactive suggestion generation
- Conversation memory and context

### 2. Chain of Thought Reasoner

Breaks down complex queries into logical reasoning steps:

```javascript
const reasoning = await reasoner.analyze(query, context);
// Returns:
// {
//   intent: 'cost_analysis',
//   entities: { temperature: 68, location: 'Denver' },
//   missingData: ['squareFeet'],
//   confidence: 0.85,
//   explanation: "Intent: cost_analysis → Entities: temperature, location → Missing: squareFeet"
// }
```

**Reasoning Steps:**

1. Detect user intent (cost analysis, performance check, etc.)
2. Extract entities (temperature, location, system type)
3. Find relevant context from conversation history
4. Identify missing required data
5. Calculate confidence score

### 3. Agent Planner

Creates multi-step execution plans based on intent:

```javascript
const plan = await planner.createPlan(query, reasoning);
// Returns:
// {
//   intent: 'cost_analysis',
//   steps: [
//     { tool: 'balancePoint', params: {}, reason: 'Determine when aux heat kicks in' },
//     { tool: 'forecast', params: { ... }, reason: 'Predict weekly costs' }
//   ],
//   estimatedTime: 1000
// }
```

**Planning Strategies:**

- **Cost Analysis**: Balance Point → Forecast
- **Performance Check**: Performance Metrics → Balance Point
- **Savings Optimization**: Setback Analysis → System Comparison
- **Troubleshooting**: Performance → Balance Point → Diagnostics

### 4. Agent Executor

Executes plans with robust error handling:

```javascript
const results = await executor.executePlan(plan, {
  userSettings,
  onProgress: (step) => console.log(`Running: ${step.name}`),
});
```

**Features:**

- Sequential tool execution
- Progress callbacks for UI updates
- Graceful error handling
- Result summarization

### 5. Reflector

Evaluates results and determines if retry is needed:

```javascript
const reflection = await agent.reflect(executionResults, plan);
// Returns:
// {
//   needsRetry: false,
//   issues: [],
//   suggestions: ['Consider improving insulation']
// }
```

**Self-Correction:**

- Detects critical failures (missing data, invalid inputs)
- Suggests fixes for common issues
- Triggers retry with adjusted plan if needed

### 6. Agent Memory

Stores conversation context and learns user preferences:

```javascript
memory.store({ query, reasoning, results, timestamp });
const relevant = memory.recall("heating costs"); // Returns related past queries
const prefs = memory.getPreferences(); // { systemPreference: 'heatPump', interestedInSavings: true }
```

**Memory Types:**

- **Short-term**: Last 10 interactions for context
- **Preferences**: Learned user interests and patterns

## React Integration

### useJouleAgent Hook

Easy integration with React components:

```jsx
import { useJouleAgent } from "../agents/useJouleAgent";

function AskJouleComponent() {
  const { ask, isProcessing, executionProgress, getSuggestions } =
    useJouleAgent(userSettings, conversationHistory);

  const handleQuery = async (query) => {
    const result = await ask(query, {
      enableProactive: true,
      maxRetries: 2,
    });

    console.log(result.response); // Natural language response
    console.log(result.confidence); // 0.0 - 1.0
    console.log(result.suggestions); // Proactive recommendations
  };

  return (
    <div>
      {isProcessing && <ExecutionMonitor steps={executionProgress} />}
      {/* ... */}
    </div>
  );
}
```

### UI Components

**AgenticResponse**: Display results with reasoning transparency

```jsx
import { AgenticResponse } from "../agents/AgenticResponseUI";

<AgenticResponse
  result={agentResult}
  isProcessing={isProcessing}
  executionProgress={executionProgress}
/>;
```

**ExecutionMonitor**: Real-time execution progress

```jsx
import { ExecutionMonitor } from "../agents/AgenticResponseUI";

<ExecutionMonitor steps={executionProgress} />;
```

**AgentInsightPanel**: Show what agent knows and needs

```jsx
import { AgentInsightPanel } from "../agents/AgenticResponseUI";

<AgentInsightPanel
  userSettings={userSettings}
  missingData={["location", "squareFeet"]}
/>;
```

## Usage Examples

### Example 1: Simple Query

```javascript
const result = await ask("How much will heating cost next week?");
```

**Agent Process:**

1. **Reasoning**: Detects "cost_analysis" intent, extracts timeframe ("next week")
2. **Planning**: Creates plan: [balancePoint → forecast]
3. **Execution**: Runs both tools with user settings
4. **Response**: "Based on next week's forecast (avg 35°F), your heating will cost approximately $42. Your balance point is 45°F, so expect auxiliary heat to run frequently."
5. **Suggestions**: ["Consider a setback schedule to save $8/week"]

### Example 2: Multi-Step Analysis

```javascript
const result = await ask("Give me a comprehensive analysis of my system");
```

**Agent Process:**

1. **Reasoning**: Detects "full_analysis" intent
2. **Planning**: Creates plan: [performance → balancePoint → setback → comparison]
3. **Execution**: Runs all 4 tools sequentially
4. **Response**: Comprehensive report with all metrics
5. **Suggestions**: Top 3 optimization opportunities

### Example 3: Error Handling & Retry

```javascript
// User hasn't set location
const result = await ask("What will heating cost?");
```

**Agent Process:**

1. **Reasoning**: Detects missing location
2. **Planning**: Creates plan: [requestLocation → forecast]
3. **Execution**: First tool prompts for location
4. **Reflection**: Detects missing data issue
5. **Response**: "I need your location to calculate heating costs. Where are you located?"

### Example 4: Proactive Suggestions

```javascript
const result = await ask("My heating bills are high");
```

**Agent Response:**

```
Your current heating costs are $180/month. Here's what I found:

Balance Point: 42°F (higher than ideal)
Heat Loss: 28,000 BTU/hr at design conditions

💡 Proactive Suggestions:
1. Improve insulation → Save $35/month
2. Implement setback schedule → Save $22/month
3. Compare heat pump vs gas → Potential $45/month savings
```

## Advanced Features

### 1. Contextual Awareness

Agent remembers previous conversation:

```
User: "What's my balance point?"
Joule: "Your balance point is 45°F..."

User: "Is that good?"  // Agent knows "that" refers to balance point
Joule: "45°F is slightly higher than ideal. Most well-insulated homes have balance points around 35-40°F..."
```

### 2. Multi-Intent Queries

Handles complex queries with multiple intents:

```
User: "Compare heat pump vs gas and show me the payback period"
```

Agent automatically:

- Runs comparison tool
- Calculates ROI
- Generates payback timeline
- Suggests financing options

### 3. Confidence-Based Responses

Low confidence triggers clarification:

```
User: "What about Denver?"  // Vague query
Joule: "I'm 45% confident I understand. Are you asking about:
  1. Heating costs in Denver?
  2. System sizing for Denver climate?
  3. Denver utility rates?"
```

### 4. Learning from Feedback

Agent adapts to user preferences:

```javascript
// User frequently asks about savings
memory.preferences.interestedInSavings = true;

// Future responses automatically include savings analysis
```

## Integration Guide

### Step 1: Import Agent System

```jsx
import { useJouleAgent } from "../agents/useJouleAgent";
import { AgenticResponse } from "../agents/AgenticResponseUI";
```

### Step 2: Initialize in Component

```jsx
const { ask, isProcessing, executionProgress, getSuggestions } = useJouleAgent(
  userSettings,
  conversationHistory
);
```

### Step 3: Handle Queries

```jsx
const handleSubmit = async (query) => {
  try {
    const result = await ask(query, {
      enableProactive: true,
      maxRetries: 2,
    });

    setResponse(result);
  } catch (error) {
    console.error("Agent error:", error);
  }
};
```

### Step 4: Display Results

```jsx
<AgenticResponse
  result={response}
  isProcessing={isProcessing}
  executionProgress={executionProgress}
/>
```

## Configuration

### Tool Registration

Add new tools to the agent:

```javascript
const tools = {
  customTool: {
    name: "Custom Analysis",
    execute: async (params) => {
      // Your tool logic
      return { result: "data" };
    },
  },
};

const agent = new JouleAgentCore(userSettings, tools);
```

### Reasoning Customization

Adjust confidence thresholds:

```javascript
// In ChainOfThoughtReasoner.calculateConfidence()
const CONFIDENCE_THRESHOLD = 0.7; // Require 70% confidence
```

### Memory Configuration

```javascript
const memory = new AgentMemory();
memory.maxShortTerm = 20; // Increase memory capacity
```

## Performance

- **Average Query Time**: 1-3 seconds (with LLM)
- **Tool Execution**: 200-500ms per tool
- **Memory Footprint**: ~2MB for 100 interactions
- **Concurrent Queries**: Supports parallel processing

## Future Enhancements

### Phase 2: Advanced Agentic Features

1. **Multi-Modal Input**: Voice, images (thermostat screenshots)
2. **Autonomous Actions**: Auto-adjust settings with permission
3. **Scheduled Tasks**: "Remind me to change filter in 3 months"
4. **Collaborative Planning**: "Let's create a savings plan together"
5. **External Integration**: Weather API, utility API, smart thermostats

### Phase 3: Deep Learning

1. **Personalized Models**: Fine-tune on user's interaction history
2. **Anomaly Detection**: "Your heating costs are 30% higher than expected"
3. **Predictive Maintenance**: "Your compressor may need service soon"
4. **Behavioral Patterns**: Learn optimal setback schedules

## Testing

```bash
# Run agent tests
npm test src/agents/

# Test individual components
npm test src/agents/JouleAgentCore.test.js
npm test src/agents/useJouleAgent.test.js
```

## Troubleshooting

**Issue**: Agent returns low confidence

- **Solution**: Provide more context in query or fill in missing user settings

**Issue**: Tools fail with errors

- **Solution**: Check tool implementation, ensure all required params are passed

**Issue**: Slow response times

- **Solution**: Reduce maxRetries, optimize tool execution, cache LLM responses

## License

MIT - Part of the Engineering Tools project
