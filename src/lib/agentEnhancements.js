// Agent Enhancements - Making the LLM Agent More Useful
// These are concrete implementations of the enhancement ideas

// Agent Enhancements - Making the LLM Agent More Useful
// These are concrete implementations of the enhancement ideas

// Browser-compatible file operations
async function readFileBrowser(path) {
  try {
    // In browser, try to fetch from public folder or use localStorage
    if (path.startsWith('agent/') || path.startsWith('state/') || path.startsWith('config/')) {
      // Use localStorage as fallback for browser
      const key = `agent_file_${path.replace(/\//g, '_')}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          return { success: true, data: JSON.parse(stored), raw: stored };
        } catch {
          return { success: true, data: null, raw: stored };
        }
      }
    }
    
    // Try to fetch from public folder
    const response = await fetch(`/${path}`);
    if (response.ok) {
      const content = await response.text();
      try {
        return { success: true, data: JSON.parse(content), raw: content };
      } catch {
        return { success: true, data: null, raw: content };
      }
    }
    
    return { error: true, message: `File not found: ${path}` };
  } catch (error) {
    return { error: true, message: error.message };
  }
}

async function writeFileBrowser(path, content) {
  try {
    // In browser, use localStorage
    if (path.startsWith('agent/') || path.startsWith('state/') || path.startsWith('config/')) {
      const key = `agent_file_${path.replace(/\//g, '_')}`;
      localStorage.setItem(key, typeof content === 'string' ? content : JSON.stringify(content));
      return { success: true };
    }
    
    // In Node.js, would use fs.writeFile
    // For browser, we'll use localStorage
    console.log(`[Agent] Would write to ${path}:`, content.substring(0, 100));
    return { success: true };
  } catch (error) {
    return { error: true, message: error.message };
  }
}

// Use browser-compatible functions
const readFile = readFileBrowser;
const writeFile = writeFileBrowser;

/**
 * 1. CONVERSATION MEMORY
 * Remembers past conversations and context
 */
export class ConversationMemory {
  constructor() {
    this.historyFile = 'agent/conversation_history.json';
    this.maxHistory = 50; // Keep last 50 conversations
  }

  async loadHistory() {
    try {
      const result = await readFile(this.historyFile);
      return result.data?.conversations || [];
    } catch {
      return [];
    }
  }

  async saveConversation(userQuestion, agentResponse, context = {}) {
    const history = await this.loadHistory();
    
    history.push({
      timestamp: new Date().toISOString(),
      question: userQuestion,
      response: agentResponse,
      context,
    });

    // Keep only last N conversations
    const trimmed = history.slice(-this.maxHistory);

    await writeFile(this.historyFile, JSON.stringify({ conversations: trimmed }, null, 2));
  }

  async getRelevantHistory(currentQuestion, limit = 5) {
    const history = await this.loadHistory();
    
    // Simple relevance: check for similar keywords
    const currentKeywords = currentQuestion.toLowerCase().split(/\s+/);
    
    const relevant = history
      .map(conv => {
        const questionKeywords = conv.question.toLowerCase().split(/\s+/);
        const overlap = currentKeywords.filter(k => questionKeywords.includes(k)).length;
        return { ...conv, relevance: overlap };
      })
      .filter(conv => conv.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);

    return relevant;
  }
}

/**
 * 2. PROACTIVE ALERTS
 * Monitors system and alerts without being asked
 */
export class ProactiveAlerts {
  constructor() {
    this.checks = [
      this.checkAuxHeatUsage,
      this.checkTemperatureDrift,
      this.checkUnusualPatterns,
      this.checkEnergySpikes,
    ];
  }

  async checkSystem() {
    const alerts = [];
    
    for (const check of this.checks) {
      const result = await check();
      if (result.alert) {
        alerts.push(result);
      }
    }

    return alerts;
  }

  async checkAuxHeatUsage() {
    // Try to get runtime data from localStorage (thermostat data)
    try {
      const thermostatData = JSON.parse(localStorage.getItem('thermostatCSVData') || 'null');
      const runtime = thermostatData?.runtime;
      
      // Also check from state file
      const state = await readFile('state/current_status.json');
      const stateRuntime = state.data?.runtime;
      
      const auxMinutes = runtime?.auxHeatMinutesToday || stateRuntime?.auxHeatMinutesToday || 0;
      
      if (auxMinutes > 120) { // 2 hours
        return {
          alert: true,
          severity: 'high',
          message: `⚠️ Auxiliary heat has run for ${auxMinutes} minutes today - that's unusually high. Would you like me to check why?`,
          type: 'aux_heat_usage',
        };
      }
    } catch (err) {
      // No data available
    }
    
    return { alert: false };
  }

  async checkTemperatureDrift() {
    // Try to get current temp from localStorage or state
    try {
      // Check if we have current temp in localStorage (from thermostat component)
      const currentTemp = parseFloat(localStorage.getItem('currentIndoorTemp') || '0');
      const targetTemp = parseFloat(localStorage.getItem('targetTemp') || '0');
      
      // Also try state file
      const state = await readFile('state/current_status.json');
      const stateTemp = state.data?.thermostat?.indoorTemp;
      const stateTarget = state.data?.thermostat?.targetTemp;
      
      const indoor = stateTemp || currentTemp;
      const target = stateTarget || targetTemp;
      
      if (indoor && target) {
        const delta = Math.abs(indoor - target);
        if (delta > 3) {
          return {
            alert: true,
            severity: 'medium',
            message: `🌡️ Temperature is ${delta.toFixed(1)}°F away from setpoint (${indoor}°F vs ${target}°F). The system may be struggling. Should I investigate?`,
            type: 'temperature_drift',
          };
        }
      }
    } catch (err) {
      // No data available
    }
    
    return { alert: false };
  }

  async checkUnusualPatterns() {
    // Check for short-cycling, excessive runtime, etc.
    const events = await readFile('state/heating_events.json');
    
    if (events.data?.events) {
      // Check for short cycles (on/off every < 10 minutes)
      const recentEvents = events.data.events.slice(-10);
      const shortCycles = recentEvents.filter(e => 
        e.durationMinutes && e.durationMinutes < 10
      ).length;
      
      if (shortCycles > 3) {
        return {
          alert: true,
          severity: 'high',
          message: `I detected ${shortCycles} short cycles recently. Your system may be oversized or have a sensor issue. Should I investigate?`,
          type: 'short_cycling',
        };
      }
    }
    
    return { alert: false };
  }

  async checkEnergySpikes() {
    // Compare today's usage to average
    const state = await readFile('state/current_status.json');
    const runtime = state.data?.runtime;
    
    // This would compare to historical average
    // Simplified for now
    return { alert: false };
  }
}

/**
 * 3. DAILY BRIEFINGS
 * Generates morning summaries
 */
export class DailyBriefing {
  async generateBriefing() {
    const state = await readFile('state/current_status.json');
    const events = await readFile('state/heating_events.json');
    const settings = await readFile('config/settings.json');
    
    const yesterday = this.getYesterdayDate();
    const runtime = state.data?.runtime || {};
    const utilityCost = settings.data?.utility?.electricityCost || 0.15;
    
    // Calculate yesterday's cost (simplified)
    const compressorKwh = (runtime.compressorMinutesToday || 0) / 60 * 3; // ~3kW
    const auxKwh = (runtime.auxHeatMinutesToday || 0) / 60 * 12; // ~12kW
    const totalKwh = compressorKwh + auxKwh;
    const cost = totalKwh * utilityCost;
    
    const briefing = {
      timestamp: new Date().toISOString(),
      date: yesterday,
      summary: {
        energyUsage: {
          compressorMinutes: runtime.compressorMinutesToday || 0,
          auxMinutes: runtime.auxHeatMinutesToday || 0,
          totalKwh: totalKwh.toFixed(1),
          cost: cost.toFixed(2),
        },
        systemHealth: this.assessSystemHealth(state.data, events.data),
        weather: this.getWeatherForecast(),
        recommendations: this.generateRecommendations(state.data, events.data),
      },
    };
    
    return briefing;
  }

  assessSystemHealth(state, events) {
    const health = {
      status: 'normal',
      issues: [],
    };
    
    if (state?.runtime?.auxHeatMinutesToday > 120) {
      health.status = 'warning';
      health.issues.push('High auxiliary heat usage');
    }
    
    if (events?.events?.some(e => e.type === 'short_cycling')) {
      health.status = 'warning';
      health.issues.push('Short cycling detected');
    }
    
    return health;
  }

  getWeatherForecast() {
    // Would fetch from weather API
    return {
      today: '28°F, partly cloudy',
      tomorrow: '25°F, snow expected',
      impact: 'Colder weather will increase heating needs',
    };
  }

  generateRecommendations(state, events) {
    const recommendations = [];
    
    if (state?.runtime?.auxHeatMinutesToday > 60) {
      recommendations.push({
        priority: 'high',
        message: 'Consider reducing temperature setbacks to minimize auxiliary heat usage',
        potentialSavings: '$15-20/month',
      });
    }
    
    return recommendations;
  }

  getYesterdayDate() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
}

/**
 * 4. PATTERN RECOGNITION
 * Learns user preferences and patterns
 */
export class PatternRecognition {
  async identifyPatterns(days = 30) {
    const history = await readFile('agent/conversation_history.json');
    const events = await readFile('state/heating_events.json');
    const state = await readFile('state/current_status.json');
    
    const patterns = {
      temperaturePreferences: this.analyzeTemperaturePreferences(history, state),
      schedulePatterns: this.analyzeSchedulePatterns(events),
      auxHeatAvoidance: this.analyzeAuxHeatAvoidance(history, events),
    };
    
    // Save learned patterns
    await this.savePatterns(patterns);
    
    return patterns;
  }

  analyzeTemperaturePreferences(history, state) {
    // Extract temperature mentions from history
    const temps = [];
    
    if (history.data?.conversations) {
      history.data.conversations.forEach(conv => {
        const tempMatch = conv.question.match(/(\d+)\s*degrees?/i);
        if (tempMatch) {
          temps.push(parseInt(tempMatch[1]));
        }
      });
    }
    
    if (temps.length > 0) {
      const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
      return {
        preferredTemp: Math.round(avg),
        confidence: Math.min(temps.length / 10, 1), // More data = higher confidence
      };
    }
    
    return null;
  }

  analyzeSchedulePatterns(events) {
    // Analyze when user typically adjusts temperature
    // Simplified - would analyze event timestamps
    return {
      morningWarmup: '6-7 AM',
      eveningSetback: '10-11 PM',
      confidence: 0.7,
    };
  }

  analyzeAuxHeatAvoidance(history, events) {
    // Check if user asks about aux heat frequently
    const auxMentions = history.data?.conversations?.filter(conv =>
      conv.question.toLowerCase().includes('aux') ||
      conv.question.toLowerCase().includes('strip') ||
      conv.question.toLowerCase().includes('emergency heat')
    ).length || 0;
    
    return {
      avoidsAuxHeat: auxMentions > 3,
      confidence: Math.min(auxMentions / 5, 1),
    };
  }

  async savePatterns(patterns) {
    const notes = await readFile('agent/NOTES.md');
    const patternsSection = `
## Learned Patterns (${new Date().toISOString().split('T')[0]})

${JSON.stringify(patterns, null, 2)}
`;
    
    const updated = (notes.raw || '') + patternsSection;
    await writeFile('agent/NOTES.md', updated);
  }
}

/**
 * 5. ENERGY OPTIMIZATION
 * Analyzes usage and suggests optimizations
 */
export class EnergyOptimizer {
  async analyzeAndOptimize() {
    const state = await readFile('state/current_status.json');
    const settings = await readFile('config/settings.json');
    const policy = await readFile('config/policy.json');
    
    const optimizations = [];
    
    // Check setback size
    const currentSetback = this.calculateCurrentSetback(state.data);
    if (currentSetback > 3) {
      optimizations.push({
        type: 'reduce_setback',
        current: `${currentSetback}°F`,
        recommended: '2°F',
        savings: '$15-20/month',
        reason: 'Large setbacks trigger expensive auxiliary heat',
      });
    }
    
    // Check aux heat usage
    const auxMinutes = state.data?.runtime?.auxHeatMinutesToday || 0;
    if (auxMinutes > 60) {
      optimizations.push({
        type: 'minimize_aux_heat',
        current: `${auxMinutes} minutes/day`,
        recommended: '< 30 minutes/day',
        savings: '$20-30/month',
        reason: 'Auxiliary heat costs 3-4x more than heat pump',
      });
    }
    
    // Check recovery timing
    optimizations.push({
      type: 'optimize_recovery',
      recommendation: 'Enable adaptive recovery to start heating earlier',
      savings: '$8-12/month',
      reason: 'Prevents aux heat activation during recovery',
    });
    
    return {
      totalPotentialSavings: '$28-42/month',
      optimizations,
      priority: optimizations.sort((a, b) => {
        const aSavings = parseInt(a.savings.match(/\$(\d+)/)?.[1] || 0);
        const bSavings = parseInt(b.savings.match(/\$(\d+)/)?.[1] || 0);
        return bSavings - aSavings;
      }),
    };
  }

  calculateCurrentSetback(state) {
    // Would analyze schedule to find setback
    // Simplified
    return 4; // Example
  }
}

// Export all enhancements
export {
  ConversationMemory,
  ProactiveAlerts,
  DailyBriefing,
  PatternRecognition,
  EnergyOptimizer,
};

