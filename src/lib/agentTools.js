// Agent tools for LLM-powered thermostat
// Provides the LLM with "superpowers" to fetch context on demand

/**
 * Tool: Read knowledge base file
 * Fetches HVAC domain knowledge, user preferences, or system state
 */
export async function readKnowledgeFile(filename) {
  try {
    // In browser context, fetch from public folder
    const response = await fetch(`/knowledge/${filename}`);
    if (!response.ok) return { error: true, message: `File not found: ${filename}` };
    const content = await response.text();
    return { success: true, content };
  } catch (error) {
    return { error: true, message: error.message };
  }
}

/**
 * Tool: Get current system state
 * Returns live thermostat data, sensor readings, system status
 */
export function getCurrentState(thermostatData) {
  if (!thermostatData) {
    return {
      indoorTemp: null,
      targetTemp: null,
      mode: 'unknown',
      systemRunning: false,
      message: 'No thermostat data available'
    };
  }

  return {
    indoorTemp: thermostatData.currentTemp,
    targetTemp: thermostatData.targetTemp,
    mode: thermostatData.mode,
    systemRunning: thermostatData.isRunning,
    outdoorTemp: thermostatData.outdoorTemp,
    humidity: thermostatData.humidity,
  };
}

/**
 * Tool: Get user settings
 * Returns system configuration, user preferences, safety constraints
 */
export function getUserSettings(userSettings) {
  if (!userSettings) return null;
  
  return {
    primarySystem: userSettings.primarySystem,
    hspf2: userSettings.hspf2,
    seer2: userSettings.seer2,
    capacity: userSettings.capacity,
    squareFeet: userSettings.squareFeet,
    utilityCost: userSettings.utilityCost,
    winterThermostat: userSettings.winterThermostat,
    summerThermostat: userSettings.summerThermostat,
  };
}

/**
 * Tool: Get location context
 * Returns climate data, elevation, regional info
 */
export function getLocationContext(userLocation) {
  if (!userLocation) return null;
  
  return {
    city: userLocation.city,
    state: userLocation.state,
    elevation: userLocation.elevation,
    lat: userLocation.lat,
    lon: userLocation.lon,
  };
}

/**
 * Tool: Search HVAC knowledge base
 * Simulates RAG - fetches relevant docs based on query
 */
export async function searchHVACKnowledge(query) {
  const lowerQuery = query.toLowerCase();
  
  // Simple keyword matching - in production, use vector search
  const knowledgeFiles = {
    'heat pump': 'heat_pump_basics.md',
    'auxiliary heat': 'aux_heat_guide.md',
    'aux heat': 'aux_heat_guide.md',
    'strip': 'aux_heat_guide.md',
    'defrost': 'defrost_cycle.md',
    'efficiency': 'efficiency_tips.md',
    'setback': 'setback_strategy.md',
    'humidity': 'humidity_info.md',
    'filter': 'filter_maintenance.md',
    'supply air': 'diagnostic_sensors.md',
    'return air': 'diagnostic_sensors.md',
    'cfm': 'diagnostic_sensors.md',
    'watt': 'diagnostic_sensors.md',
    'sensor': 'diagnostic_sensors.md',
    'diagnostic': 'diagnostic_sensors.md',
    'lockout': 'aux_heat_diagnostics.md',
    'threshold': 'aux_heat_diagnostics.md',
    'recovery': 'rapid_testing.md',
    'setting': 'thermostat_settings.md',
    'configuration': 'thermostat_settings.md',
    'ecobee': 'thermostat_settings.md',
    'cold weather': 'cold_weather_performance.md',
    'performance': 'cold_weather_performance.md',
    'cop': 'cold_weather_performance.md',
    'stage': 'thermostat_settings.md',
    'compressor': 'thermostat_settings.md',
  };
  
  for (const [keyword, file] of Object.entries(knowledgeFiles)) {
    if (lowerQuery.includes(keyword)) {
      return await readKnowledgeFile(file);
    }
  }
  
  return { success: false, message: 'No relevant knowledge found' };
}

/**
 * Tool: Calculate energy impact
 * Estimates cost/savings for thermostat changes
 */
export function calculateEnergyImpact(params) {
  const { tempChange, systemType, utilityCost = 0.15, hspf2 = 9, seer2 = 15 } = params;
  
  // Simplified calculation - rule of thumb: 3% savings per degree (heating)
  const percentSavings = Math.abs(tempChange) * 3;
  const annualSavings = percentSavings; // Rough estimate
  
  return {
    tempChange,
    percentSavings: percentSavings.toFixed(1),
    estimatedAnnualSavings: `$${annualSavings.toFixed(0)}`,
    recommendation: Math.abs(tempChange) <= 2 ? 'safe' : 'may trigger aux heat',
  };
}

/**
 * Tool: Check system policy
 * Validates proposed actions against safety constraints
 */
export function checkPolicy(action, params) {
  const policy = {
    maxTemp: 78,
    minTemp: 60,
    maxTempDelta: 3,
    requireConfirmForScheduleChange: true,
    stripHeatProtection: true,
  };
  
  if (action === 'setTemp') {
    const { temp } = params;
    if (temp > policy.maxTemp) {
      return { allowed: false, reason: `Temperature ${temp}°F exceeds maximum ${policy.maxTemp}°F` };
    }
    if (temp < policy.minTemp) {
      return { allowed: false, reason: `Temperature ${temp}°F below minimum ${policy.minTemp}°F` };
    }
  }
  
  if (action === 'setback') {
    const { delta } = params;
    if (Math.abs(delta) > policy.maxTempDelta && policy.stripHeatProtection) {
      return { 
        allowed: true, 
        warning: `Setback of ${delta}°F may trigger auxiliary heat (recommended max: ${policy.maxTempDelta}°F)` 
      };
    }
  }
  
  return { allowed: true };
}

/**
 * Tool: Get diagnostic data
 * Returns advanced sensor data if available, or explains what's missing
 */
export function getDiagnosticData(query, thermostatData, userSettings) {
  const lowerQuery = query.toLowerCase();
  const availableData = {
    // Basic sensors we typically have
    indoorTemp: thermostatData?.currentTemp,
    targetTemp: thermostatData?.targetTemp,
    outdoorTemp: thermostatData?.outdoorTemp,
    mode: thermostatData?.mode,
    systemRunning: thermostatData?.isRunning,
    
    // Advanced sensors we DON'T typically have
    supplyAirTemp: null,
    returnAirTemp: null,
    cfm: null,
    wattDraw: null,
    compressorStage: null,
    cop: null,
    outdoorCoilTemp: null,
    dutyCycle: null,
    auxRuntimeToday: null,
    compressorRuntimeToday: null,
    lockoutTemp: null,
    auxThreshold: null,
  };

  // Check what the question is asking for
  const requestedMetrics = [];
  if (lowerQuery.includes('supply air') || lowerQuery.includes('return air') || lowerQuery.includes('delta')) {
    requestedMetrics.push('supplyAirTemp', 'returnAirTemp');
  }
  if (lowerQuery.includes('cfm') || lowerQuery.includes('fan')) {
    requestedMetrics.push('cfm');
  }
  if (lowerQuery.includes('watt') || lowerQuery.includes('power') || lowerQuery.includes('draw')) {
    requestedMetrics.push('wattDraw');
  }
  if (lowerQuery.includes('stage') || lowerQuery.includes('compressor stage')) {
    requestedMetrics.push('compressorStage');
  }
  if (lowerQuery.includes('cop') || lowerQuery.includes('coefficient')) {
    requestedMetrics.push('cop');
  }
  if (lowerQuery.includes('outdoor coil') || lowerQuery.includes('coil temp')) {
    requestedMetrics.push('outdoorCoilTemp');
  }
  if (lowerQuery.includes('duty cycle') || lowerQuery.includes('runtime')) {
    requestedMetrics.push('dutyCycle', 'compressorRuntimeToday', 'auxRuntimeToday');
  }
  if (lowerQuery.includes('lockout') || lowerQuery.includes('threshold')) {
    requestedMetrics.push('lockoutTemp', 'auxThreshold');
  }

  // Determine what's missing
  const missing = requestedMetrics.filter(metric => availableData[metric] === null);
  const available = requestedMetrics.filter(metric => availableData[metric] !== null);

  return {
    available,
    missing,
    availableData: Object.fromEntries(
      Object.entries(availableData).filter(([k, v]) => v !== null)
    ),
    explanation: missing.length > 0 
      ? `Missing sensors/data: ${missing.join(', ')}. These require specialized sensors or equipment not available in this system.`
      : 'All requested data is available',
  };
}

/**
 * Available tools registry
 * This defines what the LLM can do
 */
export const AVAILABLE_TOOLS = {
  getCurrentState: {
    description: 'Get current thermostat state (temp, mode, system status)',
    params: ['thermostatData'],
  },
  getUserSettings: {
    description: 'Get system configuration and user preferences',
    params: ['userSettings'],
  },
  getLocationContext: {
    description: 'Get location and climate information',
    params: ['userLocation'],
  },
  searchHVACKnowledge: {
    description: 'Search HVAC knowledge base for specific topics',
    params: ['query'],
  },
  calculateEnergyImpact: {
    description: 'Calculate energy savings or cost for temperature changes',
    params: ['tempChange', 'systemType', 'utilityCost'],
  },
  checkPolicy: {
    description: 'Validate an action against safety policies',
    params: ['action', 'params'],
  },
  getDiagnosticData: {
    description: 'Get advanced diagnostic sensor data (or explain what sensors are missing)',
    params: ['query', 'thermostatData', 'userSettings'],
  },
};

