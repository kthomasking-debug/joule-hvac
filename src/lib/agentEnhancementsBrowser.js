// Browser-compatible version of agent enhancements
// Uses localStorage instead of file system

/**
 * 1. CONVERSATION MEMORY (Browser-compatible)
 */
export class ConversationMemory {
  constructor() {
    this.historyKey = 'agent_conversation_history';
    this.maxHistory = 50;
  }

  async loadHistory() {
    try {
      const stored = localStorage.getItem(this.historyKey);
      if (!stored) return [];
      const data = JSON.parse(stored);
      return data.conversations || [];
    } catch {
      return [];
    }
  }

  async saveConversation(userQuestion, agentResponse, context = {}) {
    try {
      const history = await this.loadHistory();
      
      history.push({
        timestamp: new Date().toISOString(),
        question: userQuestion,
        response: agentResponse,
        context,
      });

      // Keep only last N conversations
      const trimmed = history.slice(-this.maxHistory);

      localStorage.setItem(this.historyKey, JSON.stringify({ conversations: trimmed }));
    } catch (error) {
      console.warn('Failed to save conversation memory:', error);
    }
  }

  async getRelevantHistory(currentQuestion, limit = 5) {
    try {
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
    } catch {
      return [];
    }
  }
}

/**
 * 2. PROACTIVE ALERTS (Browser-compatible)
 */
export class ProactiveAlerts {
  async checkSystem() {
    const alerts = [];
    
    // Check aux heat usage
    const auxAlert = await this.checkAuxHeatUsage();
    if (auxAlert.alert) alerts.push(auxAlert);
    
    // Check temperature drift
    const tempAlert = await this.checkTemperatureDrift();
    if (tempAlert.alert) alerts.push(tempAlert);
    
    // Check unusual patterns
    const patternAlert = await this.checkUnusualPatterns();
    if (patternAlert.alert) alerts.push(patternAlert);
    
    return alerts;
  }

  async checkAuxHeatUsage() {
    try {
      // Try to get runtime data from localStorage
      const thermostatData = JSON.parse(localStorage.getItem('thermostatCSVData') || 'null');
      const runtime = thermostatData?.runtime;
      
      const auxMinutes = runtime?.auxHeatMinutesToday || 0;
      
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
    try {
      // Check if we have current temp in localStorage
      const currentTemp = parseFloat(localStorage.getItem('currentIndoorTemp') || '0');
      const targetTemp = parseFloat(localStorage.getItem('targetTemp') || '0');
      
      if (currentTemp && targetTemp) {
        const delta = Math.abs(currentTemp - targetTemp);
        if (delta > 3) {
          return {
            alert: true,
            severity: 'medium',
            message: `🌡️ Temperature is ${delta.toFixed(1)}°F away from setpoint (${currentTemp}°F vs ${targetTemp}°F). The system may be struggling. Should I investigate?`,
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
    try {
      // Check for short-cycling in diagnostics
      const diagnostics = JSON.parse(localStorage.getItem('spa_diagnostics') || 'null');
      
      if (diagnostics?.issues) {
        const shortCycling = diagnostics.issues.find(i => i.type === 'short_cycling');
        if (shortCycling) {
          return {
            alert: true,
            severity: 'high',
            message: `🔄 I detected short cycling in your system. This can reduce efficiency and damage your compressor. Should I investigate?`,
            type: 'short_cycling',
          };
        }
        
        // Check for other issues
        if (diagnostics.issues.length > 0) {
          const criticalIssues = diagnostics.issues.filter(i => 
            i.type === 'temperature_instability' || 
            i.type === 'efficiency_degradation'
          );
          
          if (criticalIssues.length > 0) {
            return {
              alert: true,
              severity: 'medium',
              message: `⚠️ I detected ${criticalIssues.length} system issue(s) in your diagnostics. Check the Performance Analyzer for details.`,
              type: 'system_issues',
            };
          }
        }
      }
    } catch (err) {
      // No data available
    }
    
    return { alert: false };
  }
}

/**
 * 3. DAILY BRIEFING (Browser-compatible)
 */
export class DailyBriefing {
  async generateBriefing() {
    try {
      const userSettings = JSON.parse(localStorage.getItem('userSettings') || '{}');
      const thermostatData = JSON.parse(localStorage.getItem('thermostatCSVData') || 'null');
      const energyHistory = JSON.parse(localStorage.getItem('energyHistory') || '[]');
      
      const utilityCost = userSettings.utilityCost || 0.15;
      
      // Calculate yesterday's usage (simplified)
      const yesterday = this.getYesterdayDate();
      const yesterdayData = energyHistory.find(e => e.date === yesterday);
      
      const runtime = thermostatData?.runtime || {};
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
          systemHealth: this.assessSystemHealth(thermostatData),
          weather: this.getWeatherForecast(userSettings),
          recommendations: this.generateRecommendations(runtime),
        },
      };
      
      return briefing;
    } catch (error) {
      console.error('Failed to generate briefing:', error);
      return null;
    }
  }

  assessSystemHealth(thermostatData) {
    const health = {
      status: 'normal',
      issues: [],
    };
    
    const runtime = thermostatData?.runtime || {};
    if (runtime.auxHeatMinutesToday > 120) {
      health.status = 'warning';
      health.issues.push('High auxiliary heat usage');
    }
    
    // Check diagnostics
    try {
      const diagnostics = JSON.parse(localStorage.getItem('spa_diagnostics') || 'null');
      if (diagnostics?.issues?.length > 0) {
        health.status = 'warning';
        health.issues.push(`${diagnostics.issues.length} system issue(s) detected`);
      }
    } catch {
      // Ignore
    }
    
    return health;
  }

  getWeatherForecast(userSettings) {
    // Would fetch from weather API in production
    const location = JSON.parse(localStorage.getItem('userLocation') || 'null');
    return {
      today: '28°F, partly cloudy',
      tomorrow: '25°F, snow expected',
      impact: 'Colder weather will increase heating needs',
      location: location?.city || 'your area',
    };
  }

  generateRecommendations(runtime) {
    const recommendations = [];
    
    if (runtime.auxHeatMinutesToday > 60) {
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
 * 4. PATTERN RECOGNITION (Browser-compatible)
 */
export class PatternRecognition {
  async identifyPatterns(days = 30) {
    try {
      const history = await this.loadHistory();
      const userSettings = JSON.parse(localStorage.getItem('userSettings') || '{}');
      
      const patterns = {
        temperaturePreferences: this.analyzeTemperaturePreferences(history),
        auxHeatAvoidance: this.analyzeAuxHeatAvoidance(history),
      };
      
      // Save learned patterns
      await this.savePatterns(patterns);
      
      return patterns;
    } catch (error) {
      console.error('Failed to identify patterns:', error);
      return null;
    }
  }

  async loadHistory() {
    try {
      const stored = localStorage.getItem('agent_conversation_history');
      if (!stored) return [];
      const data = JSON.parse(stored);
      return data.conversations || [];
    } catch {
      return [];
    }
  }

  analyzeTemperaturePreferences(history) {
    const temps = [];
    
    history.forEach(conv => {
      const tempMatch = conv.question.match(/(\d+)\s*degrees?/i);
      if (tempMatch) {
        temps.push(parseInt(tempMatch[1]));
      }
    });
    
    if (temps.length > 0) {
      const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
      return {
        preferredTemp: Math.round(avg),
        confidence: Math.min(temps.length / 10, 1),
      };
    }
    
    return null;
  }

  analyzeAuxHeatAvoidance(history) {
    const auxMentions = history.filter(conv =>
      conv.question.toLowerCase().includes('aux') ||
      conv.question.toLowerCase().includes('strip') ||
      conv.question.toLowerCase().includes('emergency heat')
    ).length;
    
    return {
      avoidsAuxHeat: auxMentions > 3,
      confidence: Math.min(auxMentions / 5, 1),
    };
  }

  async savePatterns(patterns) {
    try {
      const notesKey = 'agent_notes';
      const existing = localStorage.getItem(notesKey) || '';
      const patternsSection = `
## Learned Patterns (${new Date().toISOString().split('T')[0]})

${JSON.stringify(patterns, null, 2)}
`;
      localStorage.setItem(notesKey, existing + patternsSection);
    } catch (error) {
      console.warn('Failed to save patterns:', error);
    }
  }
}

/**
 * 5. ENERGY OPTIMIZATION (Browser-compatible)
 */
export class EnergyOptimizer {
  async analyzeAndOptimize() {
    try {
      const userSettings = JSON.parse(localStorage.getItem('userSettings') || '{}');
      const thermostatData = JSON.parse(localStorage.getItem('thermostatCSVData') || 'null');
      
      const optimizations = [];
      
      // Check setback size
      const winterTemp = userSettings.winterThermostat || 70;
      const summerTemp = userSettings.summerThermostat || 75;
      const currentSetback = Math.abs(winterTemp - summerTemp);
      
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
      const runtime = thermostatData?.runtime || {};
      const auxMinutes = runtime.auxHeatMinutesToday || 0;
      if (auxMinutes > 60) {
        optimizations.push({
          type: 'minimize_aux_heat',
          current: `${auxMinutes} minutes/day`,
          recommended: '< 30 minutes/day',
          savings: '$20-30/month',
          reason: 'Auxiliary heat costs 3-4x more than heat pump',
        });
      }
      
      return {
        totalPotentialSavings: '$28-42/month',
        optimizations,
        priority: optimizations.sort((a, b) => {
          const aSavings = parseInt(a.savings.match(/\$(\d+)/)?.[1] || 0);
          const bSavings = parseInt(b.savings.match(/\$(\d+)/)?.[1] || 0);
          return bSavings - aSavings;
        }),
      };
    } catch (error) {
      console.error('Failed to analyze optimization:', error);
      return null;
    }
  }
}

