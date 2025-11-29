// Lean LLM Agent for HVAC Thermostat
// Architecture: Small brain + big tools (no prompt bloat)

import {
  getCurrentState,
  getUserSettings,
  getLocationContext,
  searchHVACKnowledge,
  calculateEnergyImpact,
  checkPolicy,
  getDiagnosticData,
} from './agentTools.js';
import {
  ConversationMemory,
  ProactiveAlerts,
  DailyBriefing,
} from './agentEnhancementsBrowser.js';
import { calculateBalancePoint } from '../utils/balancePointCalculator.js';
import {
  calculateCharging,
  calculatePerformanceMetrics,
  calculateSetbackSavings,
  compareHeatingSystems,
} from '../utils/calculatorEngines.js';

/**
 * Minimal system prompt - LLM is just a reasoning engine
 * Intelligence comes from tools, not embedded rules
 */
const MINIMAL_SYSTEM_PROMPT = `You are Joule, an HVAC assistant. You have NO built-in knowledge.

You get intelligence from TOOLS:
- getCurrentState() → live thermostat data
- getUserSettings() → system specs, preferences  
- getLocationContext() → climate info
- searchHVACKnowledge(query) → fetch HVAC docs on demand
- calculateEnergyImpact(params) → estimate savings/costs
- checkPolicy(action, params) → validate safety constraints
- getDiagnosticData(query) → advanced sensor data (if available)

CRITICAL RULES FOR "I DON'T KNOW" RESPONSES:
1. If asked about data you don't have, EXPLAIN WHY:
   - "I don't have access to [specific sensor/data]" 
   - "That requires [specific sensor/equipment] which I don't have"
   - "I can't measure [metric] because [reason]"
   
2. Be specific about what's missing:
   - ❌ Bad: "I don't know"
   - ✅ Good: "I don't have a supply air temperature sensor, so I can't measure the delta between supply and return air"
   - ✅ Good: "I don't have real-time watt monitoring, so I can't show you the current strip heat power draw"
   
3. Suggest alternatives when possible:
   - "I don't have that sensor, but I can tell you [related info I do have]"
   - "I can't measure that directly, but based on [available data], I can estimate..."

4. For expert diagnostic questions:
   - Acknowledge the question is valid and important
   - Clearly state what sensors/data would be needed
   - Explain what you CAN provide instead (if anything)

General Rules:
1. Be conversational and concise (1-3 sentences for simple, 2-4 for complex)
2. Fetch knowledge docs when needed (search first, then answer)
3. Use specific numbers when available
4. Show personality for fun questions
5. For technical questions, be precise and honest about limitations

When you don't know something, search for it. Don't make things up.`;

/**
 * Unified Agent: Answer user question using minimal prompt + tools
 * Supports both simple (direct LLM) and advanced (planning) modes
 * This is the "small brain, big tools" architecture
 */
export async function answerWithAgent(
  userQuestion,
  apiKey,
  thermostatData = null,
  userSettings = null,
  userLocation = null,
  conversationHistory = [],
  options = {}
) {
  const { 
    mode = 'simple',  // 'simple' or 'advanced'
    enableProactive = true,
    maxRetries = 2,
    onProgress = null
  } = options;

  // Advanced mode: use planning system
  if (mode === 'advanced') {
    return await answerWithPlanning(
      userQuestion,
      apiKey,
      thermostatData,
      userSettings,
      userLocation,
      conversationHistory,
      { enableProactive, maxRetries, onProgress }
    );
  }

  // Simple mode: direct LLM with context (original behavior)
  if (!apiKey || !apiKey.trim()) {
    return {
      error: true,
      message: '🔑 Groq API key missing',
      needsSetup: true,
    };
  }

  // Load conversation memory for context
  const memory = new ConversationMemory();
  const relevantHistory = await memory.getRelevantHistory(userQuestion, 3);
  
  // Build enriched conversation history with relevant past conversations
  const enrichedHistory = [
    ...conversationHistory,
    ...relevantHistory.flatMap(conv => [
      {
        role: 'user',
        content: `[Previous conversation] ${conv.question}`,
      },
      {
        role: 'assistant',
        content: typeof conv.response === 'string' ? conv.response : conv.response.message || JSON.stringify(conv.response),
      },
    ]),
  ];

  // Build context by calling tools (only what's needed)
  const context = buildMinimalContext(userQuestion, thermostatData, userSettings, userLocation);

  // Build messages array
  const messages = [
    { role: 'system', content: MINIMAL_SYSTEM_PROMPT },
    ...enrichedHistory,
    {
      role: 'user',
      content: `${context}\n\nUser question: ${userQuestion}`,
    },
  ];

  // Call Groq API
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages,
        temperature: 0.7,
        max_tokens: 300, // Keep responses concise
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Handle rate limiting
      if (response.status === 429) {
        return {
          error: true,
          message: 'Rate limit exceeded. Please wait a moment and try again.',
        };
      }
      
      return {
        error: true,
        message: `Groq request failed: ${errorData.error?.message || response.statusText}`,
      };
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content;

    if (!answer) {
      return {
        error: true,
        message: 'No response from Groq API',
      };
    }

    const result = {
      success: true,
      message: answer,
      tokensUsed: data.usage?.total_tokens,
    };

    // Save to conversation memory
    try {
      await memory.saveConversation(userQuestion, answer, {
        thermostatData,
        userSettings,
        userLocation,
        tokensUsed: data.usage?.total_tokens,
      });
    } catch (err) {
      console.warn('Failed to save conversation memory:', err);
    }

    return result;
  } catch (error) {
    return {
      error: true,
      message: `Request failed: ${error.message}`,
    };
  }
}

/**
 * Advanced mode: Planning-based agent with multi-step execution
 * Uses reasoning, planning, and tool execution before LLM response
 */
async function answerWithPlanning(
  userQuestion,
  apiKey,
  thermostatData,
  userSettings,
  userLocation,
  conversationHistory,
  options
) {
  const { enableProactive, maxRetries, onProgress } = options;

  // Initialize calculator tools
  const tools = {
    balancePoint: {
      name: "Balance Point Calculator",
      execute: async (params) => calculateBalancePoint({ ...userSettings, ...params }),
    },
    charging: {
      name: "A/C Charging Calculator",
      execute: async (params) => calculateCharging(params),
    },
    performance: {
      name: "Performance Analyzer",
      execute: async (params) => calculatePerformanceMetrics({ ...userSettings, ...params }),
    },
    setback: {
      name: "Setback Strategy",
      execute: async (params) => calculateSetbackSavings({ ...userSettings, ...params }),
    },
    comparison: {
      name: "System Comparison",
      execute: async (params) => {
        const balancePoint = calculateBalancePoint({ ...userSettings, ...params });
        return compareHeatingSystems({
          ...userSettings,
          ...params,
          balancePoint: balancePoint.balancePoint,
        });
      },
    },
  };

  // Step 1: Reasoning - understand intent
  const reasoning = analyzeQuery(userQuestion, userSettings, conversationHistory);
  if (onProgress) onProgress({ name: 'Reasoning', tool: 'analyze', reason: reasoning.explanation });

  // Step 2: Planning - create execution plan
  const plan = createExecutionPlan(reasoning, tools);
  if (onProgress) onProgress({ name: 'Planning', tool: 'plan', reason: `${plan.steps.length} steps` });

  // Step 3: Execution - run tools
  const executionResults = await executePlan(plan, tools, userSettings, onProgress);

  // Step 4: Generate response using LLM with tool results
  const context = buildMinimalContext(userQuestion, thermostatData, userSettings, userLocation);
  const toolResultsSummary = formatToolResults(executionResults);
  
  const memory = new ConversationMemory();
  const enrichedHistory = [
    ...conversationHistory,
    ...(await memory.getRelevantHistory(userQuestion, 3)).flatMap(conv => [
      { role: 'user', content: `[Previous] ${conv.question}` },
      { role: 'assistant', content: typeof conv.response === 'string' ? conv.response : conv.response.message || JSON.stringify(conv.response) },
    ]),
  ];

  const messages = [
    { role: 'system', content: MINIMAL_SYSTEM_PROMPT },
    ...enrichedHistory,
    {
      role: 'user',
      content: `${context}\n\nTOOL RESULTS:\n${toolResultsSummary}\n\nUser question: ${userQuestion}\n\nProvide a helpful response based on the tool results above.`,
    },
  ];

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages,
        temperature: 0.7,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 429) {
        return { error: true, message: 'Rate limit exceeded. Please wait a moment and try again.' };
      }
      return { error: true, message: `Groq request failed: ${errorData.error?.message || response.statusText}` };
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content;

    // Save to memory
    try {
      await memory.saveConversation(userQuestion, answer, {
        thermostatData,
        userSettings,
        userLocation,
        tokensUsed: data.usage?.total_tokens,
      });
    } catch (err) {
      console.warn('Failed to save conversation memory:', err);
    }

    return {
      success: true,
      message: answer,
      reasoning: reasoning.explanation,
      executedTools: plan.steps.map(s => s.tool),
      confidence: reasoning.confidence,
      tokensUsed: data.usage?.total_tokens,
      metadata: {
        planSteps: plan.steps.length,
        toolsUsed: executionResults.toolsUsed,
      },
    };
  } catch (error) {
    return {
      error: true,
      message: `Request failed: ${error.message}`,
    };
  }
}

/**
 * Analyze query to understand intent and extract entities
 */
function analyzeQuery(query, userSettings, history) {
  const queryLower = query.toLowerCase();
  const intent = detectIntent(queryLower);
  const entities = extractEntities(queryLower);
  const missingData = identifyMissingData(entities, userSettings, intent);
  const confidence = calculateConfidence(queryLower, intent, entities, missingData);

  return {
    intent,
    entities,
    missingData,
    confidence,
    explanation: `Intent: ${intent}, Entities: ${Object.keys(entities).join(', ') || 'none'}, Confidence: ${(confidence * 100).toFixed(0)}%`,
  };
}

function detectIntent(queryLower) {
  const patterns = {
    cost_analysis: /(?:how much|what.*cost|weekly.*cost|monthly.*bill|price|expense)/i,
    performance_check: /(?:how.*doing|system.*health|performance|efficiency|cop|hspf|seer)/i,
    savings_optimization: /(?:save|reduce.*cost|lower.*bill|optimize|improve.*efficiency)/i,
    comparison: /(?:compare|vs|versus|which.*better|heat pump.*gas|cheaper)/i,
    forecast: /(?:forecast|predict|next.*week|upcoming|future.*cost)/i,
    balance_point: /(?:balance.*point|when.*aux|auxiliary|switchover)/i,
    charging: /(?:charg|refrigerant|subcool|superheat|pressure)/i,
  };

  for (const [intent, pattern] of Object.entries(patterns)) {
    if (pattern.test(queryLower)) return intent;
  }
  return 'general_inquiry';
}

function extractEntities(queryLower) {
  const entities = {};
  const tempMatch = queryLower.match(/(\d{2})\s*°?\s*f/i);
  if (tempMatch) entities.temperature = parseInt(tempMatch[1], 10);
  const sqftMatch = queryLower.match(/(\d{1,4}(?:,\d{3})*|\d+)\s*(?:sq\.?\s*ft|square\s*feet)/i);
  if (sqftMatch) entities.squareFeet = parseInt(sqftMatch[1].replace(/,/g, ''), 10);
  return entities;
}

function identifyMissingData(entities, userSettings, intent) {
  const missing = [];
  if (['cost_analysis', 'forecast', 'comparison'].includes(intent) && !entities.squareFeet && !userSettings?.squareFeet) {
    missing.push('squareFeet');
  }
  if (['cost_analysis', 'forecast'].includes(intent) && !entities.location && !userSettings?.city) {
    missing.push('location');
  }
  return missing;
}

function calculateConfidence(queryLower, intent, entities, missingData) {
  let confidence = 0.5;
  if (intent !== 'general_inquiry') confidence += 0.3;
  confidence += Math.min(0.3, Object.keys(entities).length * 0.1);
  confidence -= missingData.length * 0.1;
  return Math.max(0.3, Math.min(1, confidence));
}

/**
 * Create execution plan based on reasoning
 */
function createExecutionPlan(reasoning, tools) {
  const { intent, entities, missingData } = reasoning;
  const steps = [];

  if (missingData.includes('location')) {
    steps.push({ tool: 'requestLocation', params: {}, reason: 'Need location' });
  }

  switch (intent) {
    case 'cost_analysis':
      steps.push(
        { tool: 'balancePoint', params: {}, reason: 'Determine aux heat trigger' },
        { tool: 'setback', params: entities, reason: 'Calculate savings' }
      );
      break;
    case 'performance_check':
      steps.push(
        { tool: 'performance', params: {}, reason: 'Analyze system performance' },
        { tool: 'balancePoint', params: {}, reason: 'Check balance point' }
      );
      break;
    case 'savings_optimization':
      steps.push(
        { tool: 'setback', params: {}, reason: 'Calculate setback savings' },
        { tool: 'comparison', params: {}, reason: 'Compare system options' }
      );
      break;
    case 'comparison':
      steps.push(
        { tool: 'balancePoint', params: {}, reason: 'Get baseline' },
        { tool: 'comparison', params: {}, reason: 'Compare heat pump vs gas' }
      );
      break;
    case 'balance_point':
      steps.push({ tool: 'balancePoint', params: {}, reason: 'Calculate balance point' });
      break;
    case 'charging':
      steps.push({ tool: 'charging', params: entities, reason: 'Calculate charging targets' });
      break;
    default:
      steps.push({ tool: 'balancePoint', params: {}, reason: 'General analysis' });
  }

  return { intent, steps, estimatedTime: steps.length * 500 };
}

/**
 * Execute plan with tools
 */
async function executePlan(plan, tools, userSettings, onProgress) {
  const results = [];
  const startTime = Date.now();

  for (const step of plan.steps) {
    if (onProgress) onProgress({ name: step.tool, tool: step.tool, reason: step.reason });

    try {
      const tool = tools[step.tool];
      if (!tool) {
        results.push({ tool: step.tool, error: 'Tool not found', params: step.params });
        continue;
      }

      const result = await tool.execute({ ...userSettings, ...step.params });
      results.push({
        tool: step.tool,
        data: result,
        summary: summarizeResult(step.tool, result),
        params: step.params,
      });
    } catch (error) {
      results.push({ tool: step.tool, error: error.message, params: step.params });
    }
  }

  return {
    results,
    totalTime: Date.now() - startTime,
    toolsUsed: results.map(r => r.tool),
  };
}

function summarizeResult(toolName, result) {
  switch (toolName) {
    case 'balancePoint':
      return `Balance point: ${result.balancePoint}°F`;
    case 'setback':
      return `Annual savings: $${result.annualSavings || 'N/A'}`;
    case 'comparison':
      return `${result.winner || 'N/A'} saves $${result.monthlySavings || 'N/A'}/month`;
    case 'performance':
      return `Heat loss factor: ${result.heatLossFactor || 'N/A'} BTU/hr/°F`;
    default:
      return JSON.stringify(result).slice(0, 100);
  }
}

function formatToolResults(executionResults) {
  return executionResults.results.map(result => {
    if (result.error) {
      return `- ${result.tool}: ❌ Error: ${result.error}`;
    }
    return `- ${result.tool}: ✅ ${result.summary || JSON.stringify(result.data).slice(0, 100)}`;
  }).join('\n');
}

/**
 * Build minimal context - only include what's relevant to the question
 * This keeps token usage low
 */
function buildMinimalContext(question, thermostatData, userSettings, userLocation) {
  const lowerQuestion = question.toLowerCase();
  let context = 'CONTEXT:\n';

  // Check if this is an advanced diagnostic question
  const isDiagnostic = 
    lowerQuestion.includes('supply air') ||
    lowerQuestion.includes('return air') ||
    lowerQuestion.includes('delta') ||
    lowerQuestion.includes('cfm') ||
    lowerQuestion.includes('watt') ||
    lowerQuestion.includes('stage') ||
    lowerQuestion.includes('cop') ||
    lowerQuestion.includes('duty cycle') ||
    lowerQuestion.includes('lockout') ||
    lowerQuestion.includes('threshold') ||
    lowerQuestion.includes('btu') ||
    lowerQuestion.includes('coil temp');

  // For diagnostic questions, check what sensors are available
  if (isDiagnostic) {
    const diagnostic = getDiagnosticData(question, thermostatData, userSettings);
    context += `\nDIAGNOSTIC DATA CHECK:\n`;
    if (diagnostic.available.length > 0) {
      context += `Available: ${diagnostic.available.join(', ')}\n`;
    }
    if (diagnostic.missing.length > 0) {
      context += `Missing sensors: ${diagnostic.missing.join(', ')}\n`;
      context += `These require specialized sensors/equipment not available in this system.\n`;
    }
    // Include what basic data we DO have
    const state = getCurrentState(thermostatData);
    if (state.indoorTemp) {
      context += `\nBasic data available: ${state.indoorTemp}°F indoor, target ${state.targetTemp}°F, mode: ${state.mode}`;
      if (state.outdoorTemp) context += `, ${state.outdoorTemp}°F outdoor`;
    }
  }

  // Only include system state if question is about current conditions
  if (
    !isDiagnostic && (
      lowerQuestion.includes('temp') ||
      lowerQuestion.includes('mode') ||
      lowerQuestion.includes('running') ||
      lowerQuestion.includes('status')
    )
  ) {
    const state = getCurrentState(thermostatData);
    if (state.indoorTemp) {
      context += `\nCurrent: ${state.indoorTemp}°F indoor, target ${state.targetTemp}°F, mode: ${state.mode}`;
      if (state.outdoorTemp) context += `, ${state.outdoorTemp}°F outdoor`;
    } else {
      context += '\nNo live thermostat data available';
    }
  }

  // Include system specs if question is about efficiency, system, or heat pump
  if (
    lowerQuestion.includes('efficiency') ||
    lowerQuestion.includes('system') ||
    lowerQuestion.includes('heat pump') ||
    lowerQuestion.includes('hspf') ||
    lowerQuestion.includes('seer') ||
    lowerQuestion.includes('configuration') ||
    lowerQuestion.includes('setting')
  ) {
    const settings = getUserSettings(userSettings);
    if (settings) {
      context += `\nSystem: ${settings.primarySystem}, HSPF2: ${settings.hspf2 || 'unknown'}, SEER2: ${settings.seer2 || 'unknown'}`;
      if (settings.capacity) context += `, ${settings.capacity}k BTU`;
    }
  }

  // Include location if question is about climate, weather, or costs
  if (
    lowerQuestion.includes('weather') ||
    lowerQuestion.includes('climate') ||
    lowerQuestion.includes('location') ||
    lowerQuestion.includes('cost') ||
    lowerQuestion.includes('outdoor temp')
  ) {
    const location = getLocationContext(userLocation);
    if (location) {
      context += `\nLocation: ${location.city}, ${location.state}`;
      if (location.elevation) context += ` (${location.elevation}ft elevation)`;
    }
  }

  // Hint at available knowledge
  if (
    lowerQuestion.includes('heat pump') ||
    lowerQuestion.includes('aux') ||
    lowerQuestion.includes('strip') ||
    lowerQuestion.includes('defrost') ||
    lowerQuestion.includes('recovery') ||
    lowerQuestion.includes('lockout') ||
    lowerQuestion.includes('threshold')
  ) {
    context += '\n\nYou can search knowledge base with searchHVACKnowledge(query) for detailed info.';
  }

  return context;
}

/**
 * Tool-augmented response with RAG
 * Fetches knowledge docs when needed, then answers
 */
export async function answerWithRAG(
  userQuestion,
  apiKey,
  thermostatData = null,
  userSettings = null,
  userLocation = null
) {
  const lowerQuestion = userQuestion.toLowerCase();
  let fetchedKnowledge = null;

  // Auto-fetch relevant knowledge based on question
  if (lowerQuestion.includes('supply air') || lowerQuestion.includes('return air') || 
      lowerQuestion.includes('cfm') || lowerQuestion.includes('watt') || 
      lowerQuestion.includes('sensor') || lowerQuestion.includes('diagnostic')) {
    fetchedKnowledge = await searchHVACKnowledge('diagnostic');
  } else if (lowerQuestion.includes('lockout') || lowerQuestion.includes('threshold') || 
             lowerQuestion.includes('aux') || lowerQuestion.includes('strip')) {
    fetchedKnowledge = await searchHVACKnowledge('auxiliary heat');
  } else if (lowerQuestion.includes('setting') || lowerQuestion.includes('configuration') || 
             lowerQuestion.includes('ecobee') || lowerQuestion.includes('stage')) {
    fetchedKnowledge = await searchHVACKnowledge('setting');
  } else if (lowerQuestion.includes('recovery') || lowerQuestion.includes('setback') || 
             lowerQuestion.includes('trigger')) {
    fetchedKnowledge = await searchHVACKnowledge('recovery');
  } else if (lowerQuestion.includes('cold weather') || lowerQuestion.includes('performance') || 
             lowerQuestion.includes('cop') || lowerQuestion.includes('degrees per hour')) {
    fetchedKnowledge = await searchHVACKnowledge('cold weather');
  } else if (lowerQuestion.includes('heat pump') || lowerQuestion.includes('slow')) {
    fetchedKnowledge = await searchHVACKnowledge('heat pump');
  } else if (lowerQuestion.includes('defrost') || lowerQuestion.includes('steam') || 
             lowerQuestion.includes('ice')) {
    fetchedKnowledge = await searchHVACKnowledge('defrost');
  }

  // Build enhanced context with fetched knowledge
  let context = buildMinimalContext(userQuestion, thermostatData, userSettings, userLocation);
  
  if (fetchedKnowledge?.success) {
    // Truncate knowledge to avoid token limits (keep first 500 chars)
    const knowledgeSnippet = fetchedKnowledge.content.substring(0, 500);
    context += `\n\nRELEVANT KNOWLEDGE:\n${knowledgeSnippet}`;
  }

  // Now answer with the augmented context
  const messages = [
    { role: 'system', content: MINIMAL_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `${context}\n\nUser question: ${userQuestion}`,
    },
  ];

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages,
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 429) {
        return { error: true, message: 'Rate limit exceeded. Please wait a moment and try again.' };
      }
      return { error: true, message: `Groq request failed: ${errorData.error?.message || response.statusText}` };
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content;

    return {
      success: true,
      message: answer,
      tokensUsed: data.usage?.total_tokens,
      usedRAG: !!fetchedKnowledge?.success,
    };
  } catch (error) {
    return { error: true, message: `Request failed: ${error.message}` };
  }
}

/**
 * Proactive monitoring - checks system health and alerts user
 * Call this periodically (e.g., every hour) to detect issues
 */
export async function checkProactiveAlerts(thermostatData = null, userSettings = null) {
  const alerts = new ProactiveAlerts();
  const issues = await alerts.checkSystem();
  
  return {
    hasAlerts: issues.length > 0,
    alerts: issues,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate daily briefing
 * Call this in the morning to provide summary
 */
export async function generateDailyBriefing() {
  const briefing = new DailyBriefing();
  const summary = await briefing.generateBriefing();
  
  return {
    success: true,
    briefing: summary,
    message: formatBriefingMessage(summary),
  };
}

/**
 * Backward compatibility: Simple fallback function
 * @deprecated Use answerWithAgent instead
 */
export async function askJouleFallback(
  prompt,
  apiKey = "",
  modelOverride = null,
  thermostatData = null,
  conversationHistory = [],
  annualEstimate = null,
  userSettings = null,
  userLocation = null
) {
  // Simple wrapper around answerWithAgent for backward compatibility
  return await answerWithAgent(
    prompt,
    apiKey,
    thermostatData,
    userSettings,
    userLocation,
    conversationHistory,
    { mode: 'simple' }
  );
}

/**
 * Format briefing as user-friendly message
 */
function formatBriefingMessage(summary) {
  const { energyUsage, systemHealth, weather, recommendations } = summary.summary;
  
  let message = `Good morning! Here's your daily briefing:\n\n`;
  
  // Energy usage
  message += `📊 **Yesterday's Energy Usage:**\n`;
  message += `• Compressor: ${energyUsage.compressorMinutes} minutes\n`;
  message += `• Aux heat: ${energyUsage.auxMinutes} minutes\n`;
  message += `• Total: ${energyUsage.totalKwh} kWh ($${energyUsage.cost})\n\n`;
  
  // System health
  message += `🏥 **System Health:** ${systemHealth.status === 'normal' ? '✅ All good' : '⚠️ Issues detected'}\n`;
  if (systemHealth.issues.length > 0) {
    message += systemHealth.issues.map(issue => `• ${issue}`).join('\n') + '\n\n';
  }
  
  // Weather
  if (weather) {
    message += `🌤️ **Weather:** ${weather.today}\n`;
    message += `Tomorrow: ${weather.tomorrow}\n`;
    message += `${weather.impact}\n\n`;
  }
  
  // Recommendations
  if (recommendations.length > 0) {
    message += `💡 **Recommendations:**\n`;
    recommendations.forEach(rec => {
      message += `• ${rec.message} (${rec.potentialSavings})\n`;
    });
  }
  
  return message;
}

