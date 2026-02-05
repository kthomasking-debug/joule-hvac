# Questions That Go to LLM Fallback

## Processing Flow

The parser processes queries in this order:

1. **Sales Queries** (if in sales mode) → `salesFAQ.js`
2. **Offline Answers** → `calculateOfflineAnswer()` - regex patterns
3. **Regex Commands** → `parseCommandLocal()` - simple commands
4. **LLM Function Calling** → `llmIntentClassifier.js` - complex commands
5. **LLM Question Answering** → `answerWithAgent()` - everything else

## Questions That Go to LLM

Questions go to the LLM fallback (`answerWithAgent`) when they:

### 1. Need Context & Reasoning

- **Problem diagnosis**: "why is my system short cycling" (vs "what causes short cycling" which is offline)
- **Personalized advice**: "what should I set my thermostat to"
- **Complex scenarios**: "what happens if I set it to 65"
- **Troubleshooting**: "why is my house so cold"
- **System-specific questions**: "how do I know if my heat pump is working correctly"

### 2. Need Synthesis & Explanation

- **How-to questions**: "how do I save money", "how can I reduce my heating costs"
- **Comparison questions**: "what is the difference between heat and auto mode"
- **Best practices**: "what is the best temperature for my home"
- **Educational questions**: "how does a heat pump work"
- **Recommendations**: "what temperature should I set at night"

### 3. Need Current Data Analysis

- **Bill analysis**: "why is my bill high", "why is my energy bill so expensive"
- **Cost calculations**: "how much does it cost to run my heat pump"
- **Efficiency questions**: "how do I know if my system is efficient"
- **Savings questions**: "how much money can I save with a heat pump"

### 4. Need User Settings Context

- **Optimal settings**: "what is the most efficient thermostat setting"
- **Schedule questions**: "what is the best schedule for my home"
- **Configuration**: "how do I configure my thermostat"
- **Settings recommendations**: "what settings should I use for maximum efficiency"

### 5. Complex Multi-Part Questions

- **Multiple concerns**: "why is my system turning on and off frequently and not heating"
- **Conditional questions**: "if I lower my thermostat, how much will I save"
- **Scenario questions**: "what if I had a 10 HSPF system"

### 6. Questions NOT Handled Offline

The offline parser handles:

- ✅ Current temperature/humidity/HVAC status (data queries)
- ✅ General knowledge: "what causes short cycling", "what is a setback"
- ✅ Definitions: "what is balance point", "what does defrost mode mean"
- ✅ Simple calculators: temperature conversions, BTU calculations
- ✅ System status: firmware, bridge connection, last update

Questions that DON'T match offline patterns go to LLM:

- ❌ "why is MY system short cycling" (needs context)
- ❌ "how often should I change my filter" (needs personalized advice)
- ❌ "what temperature should I set" (needs user context)
- ❌ "how can I improve my home's efficiency" (needs analysis)

## Examples

### Goes to LLM:

- "why is my bill high" → needs bill analysis
- "what should I set my thermostat to" → needs user context
- "how do I save money" → needs personalized advice
- "why is my system short cycling" → needs problem diagnosis
- "what is the best temperature for my home" → needs recommendations
- "how much can I save by lowering my thermostat" → needs calculation with context

### Handled Offline:

- "what causes short cycling" → general knowledge
- "what is balance point" → definition
- "what's the temperature" → data query
- "convert 20 celsius to fahrenheit" → calculator
- "is the bridge connected" → system status

## Performance

- **Offline answers**: 0ms latency, $0 cost, instant response
- **LLM answers**: ~500-2000ms latency, ~$0.0001-0.001 per query, contextual & intelligent

The parser prioritizes offline answers for speed and cost, only using LLM when context, reasoning, or personalization is needed.
