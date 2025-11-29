// Agent Executor - The "Hands" that Execute LLM's Tool Calls
// This is what actually runs commands - the LLM only suggests them

import {
  readFile,
  queryDatabase,
  runTerminal,
  browse,
  searchKnowledge,
  getCurrentState,
  getUserSettings,
} from './agentTools.js';

/**
 * Tool Registry - Maps tool names to actual functions
 * This is what the agent framework uses to execute LLM's tool calls
 */
const TOOL_REGISTRY = {
  'read_file': readFile,
  'query_database': queryDatabase,
  'run_terminal': runTerminal,
  'browse': browse,
  'search_knowledge': searchKnowledge,
  'get_current_state': getCurrentState,
  'get_user_settings': getUserSettings,
  
  // Thermostat control tools (these actually touch hardware/APIs)
  'thermostat.set_temperature': async (args) => {
    // This is where REAL action happens
    const { heat_setpoint, cool_setpoint } = args;
    
    // Option 1: Call Ecobee API
    const ecobee = await getEcobeeConnector();
    if (ecobee) {
      await ecobee.updateSettings({
        runtime: {
          desiredHeat: heat_setpoint ? heat_setpoint * 10 : undefined,
          desiredCool: cool_setpoint ? cool_setpoint * 10 : undefined,
        },
      });
      return { success: true, message: `Temperature set to ${heat_setpoint || cool_setpoint}°F` };
    }
    
    // Option 2: Write to state file (for local testing)
    const state = await readFile('state/current_status.json');
    if (state.data) {
      state.data.thermostat.targetTemp = heat_setpoint || cool_setpoint;
      await writeFile('state/current_status.json', JSON.stringify(state.data, null, 2));
      return { success: true, message: `Temperature set to ${heat_setpoint || cool_setpoint}°F` };
    }
    
    return { error: true, message: 'Could not set temperature - no API or state file available' };
  },
  
  'thermostat.set_mode': async (args) => {
    const { mode } = args; // 'heat', 'cool', 'auto', 'off'
    
    const ecobee = await getEcobeeConnector();
    if (ecobee) {
      await ecobee.updateSettings({
        settings: { hvacMode: mode },
      });
      return { success: true, message: `Mode set to ${mode}` };
    }
    
    // Fallback to state file
    const state = await readFile('state/current_status.json');
    if (state.data) {
      state.data.thermostat.mode = mode;
      await writeFile('state/current_status.json', JSON.stringify(state.data, null, 2));
      return { success: true, message: `Mode set to ${mode}` };
    }
    
    return { error: true, message: 'Could not set mode' };
  },
  
  'hvac.write_setting': async (args) => {
    const { path, value } = args;
    
    // Write to config file
    const config = await readFile(path);
    if (config.error) {
      return { error: true, message: `Config file not found: ${path}` };
    }
    
    // Update value (simplified - would need proper JSON path handling)
    config.data = { ...config.data, ...value };
    await writeFile(path, JSON.stringify(config.data, null, 2));
    
    return { success: true, message: `Setting updated in ${path}` };
  },
  
  'thermostat.get_status': async () => {
    return await getCurrentState();
  },
  
  'get_aux_heat_runtime': async (args) => {
    const { date } = args || {};
    
    // Query database or read logs
    const events = await readFile('state/heating_events.json');
    if (events.data) {
      const auxEvents = events.data.events.filter(e => 
        e.type === 'aux_heat_activation' && 
        (!date || e.timestamp.startsWith(date))
      );
      const totalMinutes = auxEvents.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
      return { success: true, runtimeMinutes: totalMinutes, events: auxEvents };
    }
    
    return { error: true, message: 'No heating events data available' };
  },
};

/**
 * Execute a tool call from the LLM
 * This is the "traffic controller" - it validates and executes
 */
export async function executeToolCall(toolCall) {
  const { tool, arguments: args } = toolCall;
  
  // Validate tool exists
  if (!TOOL_REGISTRY[tool]) {
    return {
      error: true,
      message: `Unknown tool: ${tool}. Available tools: ${Object.keys(TOOL_REGISTRY).join(', ')}`,
    };
  }
  
  // Validate arguments (simplified - would use JSON schema in production)
  if (!args || typeof args !== 'object') {
    return {
      error: true,
      message: `Invalid arguments for tool ${tool}. Expected object, got ${typeof args}`,
    };
  }
  
  // Execute the tool (THIS IS WHERE REAL ACTION HAPPENS)
  try {
    const result = await TOOL_REGISTRY[tool](args);
    return result;
  } catch (error) {
    return {
      error: true,
      message: `Tool execution failed: ${error.message}`,
      stack: error.stack,
    };
  }
}

/**
 * Parse LLM response to extract tool calls
 * LLM generates text like: "I'll call thermostat.set_temperature with heat_setpoint: 70"
 * Or structured JSON: {"tool": "thermostat.set_temperature", "arguments": {"heat_setpoint": 70}}
 */
export function parseToolCalls(llmResponse) {
  const toolCalls = [];
  
  // Try to parse as JSON first (structured format)
  try {
    const json = JSON.parse(llmResponse);
    if (json.tool) {
      toolCalls.push(json);
    } else if (Array.isArray(json)) {
      toolCalls.push(...json);
    }
  } catch {
    // Not JSON - try to extract from natural language
    // Look for patterns like "call thermostat.set_temperature" or "use tool X"
    const toolPattern = /(?:call|use|execute)\s+(\w+(?:\.\w+)*)\s*(?:with|using)?\s*(?:args|arguments)?\s*:?\s*({[^}]*})?/gi;
    let match;
    
    while ((match = toolPattern.exec(llmResponse)) !== null) {
      const tool = match[1];
      let args = {};
      
      if (match[2]) {
        try {
          args = JSON.parse(match[2]);
        } catch {
          // Try to parse as key-value pairs
          const kvPattern = /(\w+):\s*([^\s,}]+)/g;
          let kvMatch;
          while ((kvMatch = kvPattern.exec(match[2])) !== null) {
            args[kvMatch[1]] = isNaN(kvMatch[2]) ? kvMatch[2] : Number(kvMatch[2]);
          }
        }
      }
      
      toolCalls.push({ tool, arguments: args });
    }
  }
  
  return toolCalls;
}

/**
 * Agent Loop - The main execution flow
 * 1. LLM generates tool calls (suggestions)
 * 2. Agent framework executes them (real actions)
 * 3. Results fed back to LLM
 * 4. LLM generates response
 */
export async function agentLoop(userQuestion, apiKey, maxIterations = 5) {
  const conversationHistory = [];
  let iteration = 0;
  
  while (iteration < maxIterations) {
    iteration++;
    
    // 1. LLM generates response (may include tool calls)
    const llmResponse = await callLLM(userQuestion, conversationHistory, apiKey);
    
    // 2. Parse tool calls from LLM response
    const toolCalls = parseToolCalls(llmResponse);
    
    // 3. If no tool calls, LLM is done - return final answer
    if (toolCalls.length === 0) {
      return {
        success: true,
        message: llmResponse,
        iterations: iteration,
      };
    }
    
    // 4. Execute each tool call (THIS IS WHERE REAL ACTION HAPPENS)
    const toolResults = [];
    for (const toolCall of toolCalls) {
      console.log(`[Agent] Executing tool: ${toolCall.tool}`, toolCall.arguments);
      const result = await executeToolCall(toolCall);
      toolResults.push({
        tool: toolCall.tool,
        result,
      });
    }
    
    // 5. Feed results back to LLM
    conversationHistory.push({
      role: 'assistant',
      content: llmResponse,
    });
    
    conversationHistory.push({
      role: 'user',
      content: `Tool execution results:\n${JSON.stringify(toolResults, null, 2)}\n\nContinue with the original question: ${userQuestion}`,
    });
    
    // 6. LLM processes results and continues
    // (loop continues)
  }
  
  return {
    error: true,
    message: 'Agent loop exceeded maximum iterations',
    iterations,
  };
}

/**
 * Call LLM with tool definitions
 * LLM sees available tools and can suggest which to use
 */
async function callLLM(userQuestion, conversationHistory, apiKey) {
  const systemPrompt = `You are Joule, an HVAC assistant. You have NO built-in knowledge.

You get intelligence from TOOLS. When you need information, suggest a tool call.

AVAILABLE TOOLS:
${Object.keys(TOOL_REGISTRY).map(tool => `- ${tool}`).join('\n')}

When you need to:
- Get data → use read_file(), query_database(), get_current_state()
- Control thermostat → use thermostat.set_temperature(), thermostat.set_mode()
- Search docs → use search_knowledge()
- Call APIs → use browse()

Format tool calls as JSON:
{"tool": "tool_name", "arguments": {"arg1": "value1"}}

Or describe what tool you'd use in natural language.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userQuestion },
  ];

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
      max_tokens: 500,
    }),
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Helper to get Ecobee connector (if available)
async function getEcobeeConnector() {
  try {
    const { connectToEcobee } = await import('./apiConnectors.js');
    return await connectToEcobee();
  } catch {
    return null;
  }
}

// Helper to write file (simplified - would use proper file system in production)
async function writeFile(path, content) {
  // In browser: would need API endpoint
  // In Node: use fs.writeFile
  console.log(`[Agent] Would write to ${path}:`, content.substring(0, 100));
  return { success: true };
}

