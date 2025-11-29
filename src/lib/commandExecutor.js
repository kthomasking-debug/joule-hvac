/**
 * Command Executor for Ask Joule
 * Handles command detection, parameter extraction, validation, and execution
 */

import { updateThermostatSetting } from "./thermostatSettings.js";
import { calculateBalancePoint } from "../utils/balancePointCalculator.js";
import { applyOptimizedSettings } from "./thermostatSettings.js";

/**
 * Setting definitions with bounds and mapping
 */
const SETTING_DEFINITIONS = {
  // Heat/Cool Differentials
  heatDifferential: {
    path: "thresholds.heatDifferential",
    min: 0.5,
    max: 3.0,
    unit: "°F",
    displayName: "Heat Differential",
    description: "Dead band for heating",
  },
  coolDifferential: {
    path: "thresholds.coolDifferential",
    min: 0.5,
    max: 3.0,
    unit: "°F",
    displayName: "Cool Differential",
    description: "Dead band for cooling",
  },
  heatCoolMinDelta: {
    path: "thresholds.heatCoolMinDelta",
    min: 3,
    max: 10,
    unit: "°F",
    displayName: "Heat/Cool Min Delta",
    description: "Minimum gap between heat/cool setpoints in Auto mode",
  },

  // Dissipation Times
  heatDissipationTime: {
    path: "thresholds.heatDissipationTime",
    min: 0,
    max: 300,
    unit: "seconds",
    displayName: "Heat Dissipation Time",
    description: "Fan run time after heat stops",
  },
  coolDissipationTime: {
    path: "thresholds.coolDissipationTime",
    min: 0,
    max: 300,
    unit: "seconds",
    displayName: "Cool Dissipation Time",
    description: "Fan run time after cool stops",
  },

  // Min On Times
  heatMinOnTime: {
    path: "thresholds.heatMinOnTime",
    min: 60,
    max: 1800,
    unit: "seconds",
    displayName: "Heat Min On Time",
    description: "Minimum heat runtime",
  },
  coolMinOnTime: {
    path: "thresholds.coolMinOnTime",
    min: 60,
    max: 1800,
    unit: "seconds",
    displayName: "Cool Min On Time",
    description: "Minimum cool runtime",
  },

  // Compressor Settings
  compressorMinCycleOff: {
    path: "thresholds.compressorMinCycleOff",
    min: 180, // 3 minutes - safety minimum
    max: 1800,
    unit: "seconds",
    displayName: "Compressor Min Cycle Off",
    description: "Minimum off time between compressor cycles",
    dangerZone: { min: 0, max: 180 }, // Values below 180 are dangerous
  },
  compressorMinOutdoorTemp: {
    path: "thresholds.compressorMinOutdoorTemp",
    min: -20,
    max: 50,
    unit: "°F",
    displayName: "Compressor Min Outdoor Temp",
    description: "Compressor lockout temperature",
  },

  // Aux Heat Settings
  auxHeatMaxOutdoorTemp: {
    path: "thresholds.auxHeatMaxOutdoorTemp",
    min: 0,
    max: 60,
    unit: "°F",
    displayName: "Aux Heat Lockout",
    description: "Aux heat won't run above this temperature",
  },

  // Temperature Correction
  temperatureCorrection: {
    path: "thresholds.temperatureCorrection",
    min: -5,
    max: 5,
    unit: "°F",
    displayName: "Temperature Correction",
    description: "Temperature sensor offset",
  },

  // AC Overcool
  acOvercoolMax: {
    path: "thresholds.acOvercoolMax",
    min: 0,
    max: 5,
    unit: "°F",
    displayName: "AC Overcool Max",
    description: "Maximum overcool for dehumidification",
  },
};

/**
 * Natural language to setting name mapping
 */
const SETTING_NAME_MAP = {
  // Heat Differential
  "heat differential": "heatDifferential",
  "heating differential": "heatDifferential",
  "heat dead band": "heatDifferential",
  "heat threshold": "heatDifferential",

  // Cool Differential
  "cool differential": "coolDifferential",
  "cooling differential": "coolDifferential",
  "cool dead band": "coolDifferential",
  "cool threshold": "coolDifferential",

  // Dissipation Time
  "heat dissipation time": "heatDissipationTime",
  "heat dissipation": "heatDissipationTime",
  "cool dissipation time": "coolDissipationTime",
  "cool dissipation": "coolDissipationTime",
  "dissipation time": "heatDissipationTime", // Default to heat if ambiguous

  // Min On Times
  "heat min on time": "heatMinOnTime",
  "heat minimum on time": "heatMinOnTime",
  "cool min on time": "coolMinOnTime",
  "cool minimum on time": "coolMinOnTime",

  // Compressor
  "compressor min off time": "compressorMinCycleOff",
  "compressor min cycle off": "compressorMinCycleOff",
  "compressor off time": "compressorMinCycleOff",
  "compressor lockout": "compressorMinOutdoorTemp",
  "compressor min outdoor temp": "compressorMinOutdoorTemp",

  // Aux Heat
  "aux lockout": "auxHeatMaxOutdoorTemp",
  "aux heat lockout": "auxHeatMaxOutdoorTemp",
  "auxiliary lockout": "auxHeatMaxOutdoorTemp",
  "aux heat max outdoor temp": "auxHeatMaxOutdoorTemp",
  "aux max outdoor temp": "auxHeatMaxOutdoorTemp",

  // Temperature Correction
  "temperature correction": "temperatureCorrection",
  "temp correction": "temperatureCorrection",
  "sensor offset": "temperatureCorrection",

  // AC Overcool
  "ac overcool": "acOvercoolMax",
  "ac overcool max": "acOvercoolMax",
  "overcool max": "acOvercoolMax",
};

/**
 * Detect if input is a command vs a question
 */
export function detectCommand(input) {
  const lower = input.toLowerCase().trim();

  // Command patterns
  const commandPatterns = [
    /^set\s+(?:my\s+)?(heat|cool)\s+to\s+(.+)/i, // "set heat to 72" or "set cool to 68"
    /^set\s+(?:my\s+)?(.+?)\s+to\s+(.+)/i, // "set my differential to 1.5"
    /^change\s+(?:my\s+)?(.+?)\s+to\s+(.+)/i, // "change my differential to 1.5"
    /^update\s+(?:my\s+)?(.+?)\s+to\s+(.+)/i, // "update my differential to 1.5"
    /^enable\s+(.+)/i, // "enable aux heat"
    /^disable\s+(.+)/i, // "disable aux heat"
    /^optimize\s+(?:my\s+)?(?:settings|setup|configuration)?/i, // "optimize my settings"
    /^activate\s+(.+?)\s+mode/i, // "activate asthma defense mode"
    /^set\s+(?:my\s+)?(.+?)\s+(?:to\s+)?(?:my\s+)?balance\s+point/i, // "set my aux lockout to my balance point"
  ];

  for (const pattern of commandPatterns) {
    const match = lower.match(pattern);
    if (match) {
      return { isCommand: true, match };
    }
  }

  return { isCommand: false };
}

/**
 * Extract setting name and value from command
 */
export function extractCommandParameters(input) {
  const lower = input.toLowerCase().trim();

  // Pattern: "set heat/cool to [value]" (special case for comfort settings)
  let match = lower.match(/^set\s+(?:my\s+)?(heat|cool)\s+to\s+(.+)/i);
  if (match) {
    const mode = match[1].toLowerCase();
    const valueStr = match[2].trim();
    return { mode, valueStr, commandType: "setComfort" };
  }

  // Pattern: "set [setting] to [value]"
  match = lower.match(/^set\s+(?:my\s+)?(.+?)\s+to\s+(.+)/i);
  if (match) {
    const settingName = match[1].trim();
    const valueStr = match[2].trim();
    return { settingName, valueStr, commandType: "set" };
  }

  // Pattern: "change [setting] to [value]"
  match = lower.match(/^change\s+(?:my\s+)?(.+?)\s+to\s+(.+)/i);
  if (match) {
    const settingName = match[1].trim();
    const valueStr = match[2].trim();
    return { settingName, valueStr, commandType: "set" };
  }

  // Pattern: "set [setting] to my balance point"
  match = lower.match(
    /^set\s+(?:my\s+)?(.+?)\s+(?:to\s+)?(?:my\s+)?balance\s+point/i
  );
  if (match) {
    const settingName = match[1].trim();
    return {
      settingName,
      valueStr: "balancePoint",
      commandType: "setToBalancePoint",
    };
  }

  // Pattern: "enable/disable [setting]"
  match = lower.match(/^(enable|disable)\s+(.+)/i);
  if (match) {
    const action = match[1].toLowerCase();
    const settingName = match[2].trim();
    return {
      settingName,
      valueStr: action === "enable" ? "true" : "false",
      commandType: "toggle",
    };
  }

  // Pattern: "optimize my settings"
  if (lower.match(/^optimize\s+(?:my\s+)?(?:settings|setup|configuration)?/i)) {
    return { commandType: "optimize" };
  }

  // Pattern: "activate [mode] mode"
  match = lower.match(/^activate\s+(.+?)\s+mode/i);
  if (match) {
    const modeName = match[1].trim();
    return { modeName, commandType: "activateMode" };
  }

  return null;
}

/**
 * Map natural language setting name to setting key
 */
function mapSettingName(naturalName) {
  const normalized = naturalName.toLowerCase().trim();

  // Direct match
  if (SETTING_NAME_MAP[normalized]) {
    return SETTING_NAME_MAP[normalized];
  }

  // Partial match
  for (const [key, value] of Object.entries(SETTING_NAME_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  // Try matching individual words
  const words = normalized.split(/\s+/);
  for (const word of words) {
    for (const [key, value] of Object.entries(SETTING_NAME_MAP)) {
      if (key.includes(word) && word.length > 3) {
        return value;
      }
    }
  }

  return null;
}

/**
 * Parse value string to number with unit conversion
 */
function parseValue(valueStr, settingDef) {
  const lower = valueStr.toLowerCase().trim();

  // Handle "balance point" special case
  if (lower === "balance point" || lower === "my balance point") {
    return { isBalancePoint: true };
  }

  // Extract number
  const numberMatch = lower.match(/(\d+\.?\d*)/);
  if (!numberMatch) {
    return null;
  }

  let value = parseFloat(numberMatch[1]);

  // Handle unit conversion (minutes to seconds, etc.)
  if (settingDef.unit === "seconds") {
    if (lower.includes("minute") || lower.includes("min")) {
      value = value * 60;
    }
  }

  return { value, isBalancePoint: false };
}

/**
 * Validate value against bounds
 */
function validateValue(value, settingDef) {
  if (value < settingDef.min) {
    return {
      valid: false,
      error: `${settingDef.displayName} must be at least ${settingDef.min}${settingDef.unit}`,
    };
  }

  if (value > settingDef.max) {
    return {
      valid: false,
      error: `${settingDef.displayName} must be at most ${settingDef.max}${settingDef.unit}`,
    };
  }

  // Check danger zone
  if (settingDef.dangerZone) {
    if (
      value >= settingDef.dangerZone.min &&
      value < settingDef.dangerZone.max
    ) {
      return {
        valid: false,
        error: `⚠️ SAFETY WARNING: ${settingDef.displayName} of ${value}${settingDef.unit} is in the danger zone (${settingDef.dangerZone.min}-${settingDef.dangerZone.max}${settingDef.unit}). This could damage your equipment. Minimum safe value is ${settingDef.dangerZone.max}${settingDef.unit}.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Execute a command
 */
export async function executeCommand(input, userSettings = {}) {
  // Detect if it's a command
  const commandDetection = detectCommand(input);
  if (!commandDetection.isCommand) {
    return { isCommand: false };
  }

  // Extract parameters
  const params = extractCommandParameters(input);
  if (!params) {
    return {
      isCommand: true,
      success: false,
      error:
        "I couldn't understand that command. Try: 'Set my heat differential to 1.5 degrees'",
    };
  }

  // Handle optimize command
  if (params.commandType === "optimize") {
    try {
      applyOptimizedSettings();
      return {
        isCommand: true,
        success: true,
        message:
          "✓ I've optimized your settings for better efficiency! Your heat and cool differentials are now 1.0°F, dissipation times are 60 seconds, and aux heat lockout is 30°F.",
      };
    } catch (error) {
      return {
        isCommand: true,
        success: false,
        error: `Failed to optimize settings: ${error.message}`,
      };
    }
  }

  // Handle activate mode commands
  if (params.commandType === "activateMode") {
    const modeName = params.modeName.toLowerCase();

    if (modeName.includes("asthma") || modeName.includes("defense")) {
      // Asthma Defense Mode: Fan On, Blueair Auto (if available)
      try {
        updateThermostatSetting("comfortSettings.home.fanMode", "on");
        // Note: Blueair control would go here if available
        return {
          isCommand: true,
          success: true,
          message:
            "✓ Asthma Defense Mode activated! Fan is now set to On to improve air circulation.",
        };
      } catch (error) {
        return {
          isCommand: true,
          success: false,
          error: `Failed to activate Asthma Defense Mode: ${error.message}`,
        };
      }
    }

    return {
      isCommand: true,
      success: false,
      error: `Unknown mode: ${params.modeName}. Available modes: 'Asthma Defense'`,
    };
  }

  // Handle set heat/cool to X degrees
  if (params.commandType === "setComfort") {
    try {
      const mode = params.mode; // "heat" or "cool"
      const valueStr = params.valueStr;

      // Parse temperature value
      const tempMatch = valueStr.match(/(\d+\.?\d*)/);
      if (!tempMatch) {
        return {
          isCommand: true,
          success: false,
          error: `I couldn't parse the temperature "${valueStr}". Please specify a number like "72" or "68 degrees".`,
        };
      }

      const temperature = parseFloat(tempMatch[1]);

      // Validate temperature bounds (reasonable thermostat range)
      if (temperature < 50 || temperature > 90) {
        return {
          isCommand: true,
          success: false,
          error: `Temperature must be between 50°F and 90°F. You specified ${temperature}°F.`,
        };
      }

      // Update the appropriate comfort setting (home mode)
      const settingPath =
        mode === "heat"
          ? "comfortSettings.home.heatSetPoint"
          : "comfortSettings.home.coolSetPoint";

      updateThermostatSetting(settingPath, temperature);

      const modeDisplay = mode === "heat" ? "Heat" : "Cool";
      return {
        isCommand: true,
        success: true,
        message: `✓ I've set your ${modeDisplay} setpoint to ${temperature}°F.`,
      };
    } catch (error) {
      return {
        isCommand: true,
        success: false,
        error: `Failed to set ${params.mode} temperature: ${error.message}`,
      };
    }
  }

  // Handle set to balance point
  if (params.commandType === "setToBalancePoint") {
    try {
      // Calculate balance point
      const settingsForCalc = {
        squareFeet: 2000,
        ceilingHeight: 8,
        insulationLevel: 1.0,
        hspf2: 9,
        tons: 3,
        targetIndoorTemp: 68,
        designOutdoorTemp: 20,
        ...userSettings,
      };

      // Convert capacity to tons if needed
      if (settingsForCalc.capacity && !settingsForCalc.tons) {
        settingsForCalc.tons = settingsForCalc.capacity / 12.0;
      }

      // Use winter thermostat as targetIndoorTemp if available
      if (
        settingsForCalc.winterThermostat &&
        !settingsForCalc.targetIndoorTemp
      ) {
        settingsForCalc.targetIndoorTemp = settingsForCalc.winterThermostat;
      }

      const balancePointResult = calculateBalancePoint(settingsForCalc);

      if (!balancePointResult || balancePointResult.balancePoint === null) {
        return {
          isCommand: true,
          success: false,
          error:
            "I couldn't calculate your balance point. Please make sure your system settings (capacity, HSPF2, square footage) are configured in Settings.",
        };
      }

      const balancePoint = balancePointResult.balancePoint;

      // Map setting name
      const settingKey = mapSettingName(params.settingName);
      if (!settingKey) {
        return {
          isCommand: true,
          success: false,
          error: `I don't recognize the setting "${params.settingName}". Try: "aux lockout", "compressor lockout", etc.`,
        };
      }

      const settingDef = SETTING_DEFINITIONS[settingKey];
      if (!settingDef) {
        return {
          isCommand: true,
          success: false,
          error: `Setting "${params.settingName}" is not available for balance point assignment.`,
        };
      }

      // Validate balance point value
      const validation = validateValue(balancePoint, settingDef);
      if (!validation.valid) {
        return {
          isCommand: true,
          success: false,
          error: validation.error,
        };
      }

      // Execute
      updateThermostatSetting(settingDef.path, balancePoint);

      return {
        isCommand: true,
        success: true,
        message: `✓ Done! Set your ${settingDef.displayName} to ${balancePoint}°F (your balance point).`,
      };
    } catch (error) {
      return {
        isCommand: true,
        success: false,
        error: `Failed to set to balance point: ${error.message}`,
      };
    }
  }

  // Handle regular set command
  if (params.commandType === "set" || params.commandType === "toggle") {
    // Check if this is a user setting (winter/summer thermostat, etc.) that should be handled elsewhere
    const normalizedSetting = params.settingName.toLowerCase().trim();
    const isUserSetting = 
      normalizedSetting.includes("winter thermostat") ||
      normalizedSetting.includes("summer thermostat") ||
      normalizedSetting.includes("winter temp") ||
      normalizedSetting.includes("summer temp") ||
      normalizedSetting.includes("hspf") ||
      normalizedSetting.includes("seer") ||
      normalizedSetting.includes("capacity") ||
      normalizedSetting.includes("square feet") ||
      normalizedSetting.includes("insulation");
    
    if (isUserSetting) {
      return {
        isCommand: true,
        success: false,
        error: `"${params.settingName}" is a system setting, not a thermostat setting. Try: "set winter thermostat to ${params.valueStr}" or "set summer thermostat to ${params.valueStr}". Available thermostat settings: heat differential, cool differential, dissipation time, aux lockout, compressor lockout, etc.`,
      };
    }
    
    // Map setting name
    const settingKey = mapSettingName(params.settingName);
    if (!settingKey) {
      return {
        isCommand: true,
        success: false,
        error: `I don't recognize the setting "${params.settingName}". Available thermostat settings: heat differential, cool differential, dissipation time, aux lockout, compressor lockout, temperature correction, etc. For system settings like winter/summer thermostat, use: "set winter thermostat to X" or "set summer thermostat to X".`,
      };
    }

    const settingDef = SETTING_DEFINITIONS[settingKey];
    if (!settingDef) {
      return {
        isCommand: true,
        success: false,
        error: `Setting "${params.settingName}" is not available for command execution.`,
      };
    }

    // Parse value
    const parsedValue = parseValue(params.valueStr, settingDef);
    if (!parsedValue) {
      return {
        isCommand: true,
        success: false,
        error: `I couldn't parse the value "${params.valueStr}". Please specify a number.`,
      };
    }

    // Handle balance point special case
    if (parsedValue.isBalancePoint) {
      // This should have been caught by setToBalancePoint, but handle it here too
      return {
        isCommand: true,
        success: false,
        error: "Please use: 'Set my [setting] to my balance point'",
      };
    }

    // Validate value
    const validation = validateValue(parsedValue.value, settingDef);
    if (!validation.valid) {
      return {
        isCommand: true,
        success: false,
        error: validation.error,
      };
    }

    // Execute
    try {
      updateThermostatSetting(settingDef.path, parsedValue.value);

      // Format value for display
      let displayValue = parsedValue.value;
      if (settingDef.unit === "seconds" && parsedValue.value >= 60) {
        const minutes = Math.round(parsedValue.value / 60);
        displayValue = `${parsedValue.value} seconds (${minutes} minutes)`;
      } else {
        displayValue = `${parsedValue.value}${settingDef.unit}`;
      }

      return {
        isCommand: true,
        success: true,
        message: `✓ I've updated your ${settingDef.displayName} to ${displayValue}.`,
      };
    } catch (error) {
      return {
        isCommand: true,
        success: false,
        error: `Failed to update setting: ${error.message}`,
      };
    }
  }

  return {
    isCommand: true,
    success: false,
    error: "I couldn't understand that command format.",
  };
}
