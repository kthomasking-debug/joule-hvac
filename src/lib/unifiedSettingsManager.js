/**
 * Unified Settings Manager
 *
 * Single source of truth for all application settings.
 * Handles:
 * - localStorage persistence
 * - Reactive updates (custom events for same-tab changes)
 * - Validation
 * - Type safety
 */

// Default settings - single source of truth
export const DEFAULT_SETTINGS = {
  // System settings
  capacity: 24,
  efficiency: 15,
  hspf2: 9.0,
  afue: 0.95,
  primarySystem: "heatPump",
  coolingSystem: "heatPump",
  coolingCapacity: 36,
  cutoffTemp: -15, // Heat pump cutoff temperature (°F) - below this, capacity = 0 (lockout/no-heat condition)
                   // Manufacturer-dependent, typically -10°F to -20°F. Lower = more cold-tolerant system.

  // Thermostat settings
  winterThermostat: 70,
  summerThermostat: 74,

  // Building settings
  squareFeet: 800,
  insulationLevel: 0.65,
  homeShape: 0.9,
  ceilingHeight: 8,
  wallHeight: 8, // Vertical wall height (only applies to cabins/A-frames, 8 = standard cabin)
  homeElevation: 0,
  solarExposure: 1.5, // Default to medium (typical home)
  hasLoft: false, // For cabins/A-frames with lofts - reduces heat loss per sqft
  useManualHeatLoss: false,
  useCalculatedHeatLoss: true, // Default to calculated
  useAnalyzerHeatLoss: false,
  useLearnedHeatLoss: false,
  manualHeatLoss: 314, // BTU/hr/°F (heat loss factor)
  analyzerHeatLoss: null, // BTU/hr/°F (heat loss factor from System Performance Analyzer CSV)

  // Energy settings
  energyMode: "heating",
  useElectricAuxHeat: true,

  // Baseload (whole-house non-HVAC: fridge, water heater, lights, etc.)
  // Default 10 kWh/day; learned from bills when actual > hvac forecast
  baseloadKwhPerDay: 10,
  learnedBaseloadKwhPerDay: null, // Learned from bills; when set, overrides default

  // Cost settings
  utilityCost: 0.1,
  gasCost: 1.2,

  // UI settings
  useDetailedAnnualEstimate: false,

  // Advanced Equipment Profile (Elite Tier - Custom COP Curve)
  // For users who know what a COP curve is - upload NEEP data or manually enter
  useCustomEquipmentProfile: false,
  capacity47: null, // BTU/hr at 47°F (rated capacity)
  capacity17: null, // BTU/hr at 17°F (cold climate)
  capacity5: null, // BTU/hr at 5°F (very cold) - optional
  cop47: null, // COP at 47°F
  cop17: null, // COP at 17°F
  cop5: null, // COP at 5°F - optional

  // Location (stored separately but managed here)
  // location: null, // city/state string
};

// Settings that are stored separately (not in userSettings)
export const SEPARATE_SETTINGS = {
  darkMode: true,
  isMuted: false,
  heatLossFactor: null,
  manualTemp: 32,
  manualHumidity: 65,
};

// Validation rules for each setting
export const SETTING_VALIDATORS = {
  capacity: (value) => {
    const valid = [18, 24, 30, 36, 42, 48, 60];
    if (!valid.includes(value)) {
      return {
        valid: false,
        error: `Capacity must be one of: ${valid.join(", ")}`,
      };
    }
    return { valid: true };
  },

  efficiency: (value) => {
    if (typeof value !== "number" || value < 13 || value > 22) {
      return {
        valid: false,
        error: "Efficiency (SEER) must be between 13 and 22",
      };
    }
    return { valid: true };
  },

  hspf2: (value) => {
    if (typeof value !== "number" || value < 6 || value > 13) {
      return { valid: false, error: "HSPF2 must be between 6 and 13" };
    }
    return { valid: true };
  },

  afue: (value) => {
    if (typeof value !== "number" || value < 0.6 || value > 0.99) {
      return { valid: false, error: "AFUE must be between 0.6 and 0.99" };
    }
    return { valid: true };
  },

  primarySystem: (value) => {
    const valid = ["heatPump", "gasFurnace", "acPlusGas"];
    if (!valid.includes(value)) {
      return {
        valid: false,
        error: `Primary system must be one of: ${valid.join(", ")}`,
      };
    }
    return { valid: true };
  },

  coolingSystem: (value) => {
    const valid = ["heatPump", "centralAC", "dualFuel", "none"];
    if (!valid.includes(value)) {
      return {
        valid: false,
        error: `Cooling system must be one of: ${valid.join(", ")}`,
      };
    }
    return { valid: true };
  },

  coolingCapacity: (value) => {
    const valid = [18, 24, 30, 36, 42, 48, 60];
    if (!valid.includes(value)) {
      return {
        valid: false,
        error: `Cooling capacity must be one of: ${valid.join(", ")}`,
      };
    }
    return { valid: true };
  },

  winterThermostat: (value) => {
    if (typeof value !== "number" || value < 50 || value > 85) {
      return {
        valid: false,
        error: "Winter thermostat must be between 50 and 85°F",
      };
    }
    return { valid: true };
  },

  summerThermostat: (value) => {
    if (typeof value !== "number" || value < 50 || value > 85) {
      return {
        valid: false,
        error: "Summer thermostat must be between 50 and 85°F",
      };
    }
    return { valid: true };
  },

  indoorTemp: (value) => {
    if (typeof value !== "number" || value < 50 || value > 85) {
      return {
        valid: false,
        error: "Indoor temperature must be between 50 and 85°F",
      };
    }
    return { valid: true };
  },

  nighttimeTemp: (value) => {
    if (typeof value !== "number" || value < 50 || value > 85) {
      return {
        valid: false,
        error: "Nighttime temperature must be between 50 and 85°F",
      };
    }
    return { valid: true };
  },

  squareFeet: (value) => {
    if (typeof value !== "number" || value < 100 || value > 10000) {
      return {
        valid: false,
        error: "Square feet must be between 100 and 10,000",
      };
    }
    return { valid: true };
  },

  insulationLevel: (value) => {
    if (typeof value !== "number" || value < 0.3 || value > 2.0) {
      return {
        valid: false,
        error: "Insulation level must be between 0.3 and 2.0",
      };
    }
    return { valid: true };
  },

  homeShape: (value) => {
    // Allow values from 0.5 to 1.2 (Cabin is 1.2)
    if (typeof value !== "number" || value < 0.5 || value > 1.2) {
      return { valid: false, error: "Home shape must be between 0.5 and 1.2" };
    }
    return { valid: true };
  },

  ceilingHeight: (value) => {
    if (typeof value !== "number" || value < 6 || value > 20) {
      return {
        valid: false,
        error: "Ceiling height must be between 6 and 20 feet",
      };
    }
    return { valid: true };
  },

  homeElevation: (value) => {
    if (typeof value !== "number" || value < -500 || value > 15000) {
      return {
        valid: false,
        error: "Home elevation must be between -500 and 15,000 feet",
      };
    }
    return { valid: true };
  },

  solarExposure: (value) => {
    if (typeof value !== "number" || value < 0.5 || value > 2.0) {
      return { valid: false, error: "Solar exposure must be between 0 and 2" };
    }
    return { valid: true };
  },

  energyMode: (value) => {
    const valid = ["heating", "cooling"];
    if (!valid.includes(value)) {
      return {
        valid: false,
        error: `Energy mode must be one of: ${valid.join(", ")}`,
      };
    }
    return { valid: true };
  },

  useElectricAuxHeat: (value) => {
    if (typeof value !== "boolean") {
      return {
        valid: false,
        error: "Use electric aux heat must be true or false",
      };
    }
    return { valid: true };
  },

  utilityCost: (value) => {
    if (typeof value !== "number" || value < 0.05 || value > 1.0) {
      return {
        valid: false,
        error: "Utility cost must be between $0.05 and $1.00 per kWh",
      };
    }
    return { valid: true };
  },

  baseloadKwhPerDay: (value) => {
    if (value === null || value === undefined) return { valid: true };
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0 || num > 100) {
      return { valid: false, error: "Baseload must be between 0 and 100 kWh/day" };
    }
    return { valid: true };
  },

  learnedBaseloadKwhPerDay: (value) => {
    if (value === null || value === undefined) return { valid: true };
    const num = Number(value);
    if (!Number.isFinite(num) || num < 5 || num > 25) {
      return { valid: false, error: "Learned baseload must be between 5 and 25 kWh/day" };
    }
    return { valid: true };
  },

  budgetPlannerMonth: (value) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 1 || num > 12) {
      return { valid: false, error: "Month must be between 1 and 12" };
    }
    return { valid: true };
  },

  budgetPlannerYear: (value) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 2020 || num > 2100) {
      return { valid: false, error: "Year must be between 2020 and 2100" };
    }
    return { valid: true };
  },

  gasCost: (value) => {
    if (typeof value !== "number" || value < 0.5 || value > 5.0) {
      return {
        valid: false,
        error: "Gas cost must be between $0.50 and $5.00 per therm",
      };
    }
    return { valid: true };
  },

  useDetailedAnnualEstimate: (value) => {
    if (typeof value !== "boolean") {
      return {
        valid: false,
        error: "Use detailed annual estimate must be true or false",
      };
    }
    return { valid: true };
  },

  useManualHeatLoss: (value) => {
    if (typeof value !== "boolean") {
      return {
        valid: false,
        error: "Use manual heat loss must be true or false",
      };
    }
    return { valid: true };
  },

  useCalculatedHeatLoss: (value) => {
    if (typeof value !== "boolean") {
      return {
        valid: false,
        error: "Use calculated heat loss must be true or false",
      };
    }
    return { valid: true };
  },

  useAnalyzerHeatLoss: (value) => {
    if (typeof value !== "boolean") {
      return {
        valid: false,
        error: "Use analyzer heat loss must be true or false",
      };
    }
    return { valid: true };
  },

  useLearnedHeatLoss: (value) => {
    if (typeof value !== "boolean") {
      return {
        valid: false,
        error: "Use learned heat loss must be true or false",
      };
    }
    return { valid: true };
  },

  analyzerHeatLoss: (value) => {
    // Allow null (not set yet) or a positive number
    if (value === null || value === undefined) {
      return { valid: true };
    }
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      return {
        valid: false,
        error: "Analyzer heat loss must be a positive number (BTU/hr/°F)",
      };
    }
    return { valid: true };
  },

  manualHeatLoss: (value) => {
    if (typeof value !== "number" || value < 10 || value > 10000) {
      return {
        valid: false,
        error: "Manual heat loss must be between 10 and 10,000 BTU/hr/°F",
      };
    }
    return { valid: true };
  },

  useCustomEquipmentProfile: (value) => {
    if (typeof value !== "boolean") {
      return {
        valid: false,
        error: "Use custom equipment profile must be true or false",
      };
    }
    return { valid: true };
  },

  capacity47: (value) => {
    if (value === null || value === undefined) {
      return { valid: true };
    }
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0 || num > 200000) {
      return {
        valid: false,
        error: "Capacity at 47°F must be a positive number up to 200,000 BTU/hr",
      };
    }
    return { valid: true };
  },

  capacity17: (value) => {
    if (value === null || value === undefined) {
      return { valid: true };
    }
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0 || num > 200000) {
      return {
        valid: false,
        error: "Capacity at 17°F must be a positive number up to 200,000 BTU/hr",
      };
    }
    return { valid: true };
  },

  capacity5: (value) => {
    if (value === null || value === undefined) {
      return { valid: true };
    }
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0 || num > 200000) {
      return {
        valid: false,
        error: "Capacity at 5°F must be a positive number up to 200,000 BTU/hr",
      };
    }
    return { valid: true };
  },

  cop47: (value) => {
    if (value === null || value === undefined) {
      return { valid: true };
    }
    const num = Number(value);
    if (!Number.isFinite(num) || num < 1.0 || num > 6.0) {
      return {
        valid: false,
        error: "COP at 47°F must be between 1.0 and 6.0",
      };
    }
    return { valid: true };
  },

  cop17: (value) => {
    if (value === null || value === undefined) {
      return { valid: true };
    }
    const num = Number(value);
    if (!Number.isFinite(num) || num < 1.0 || num > 6.0) {
      return {
        valid: false,
        error: "COP at 17°F must be between 1.0 and 6.0",
      };
    }
    return { valid: true };
  },

  cop5: (value) => {
    if (value === null || value === undefined) {
      return { valid: true };
    }
    const num = Number(value);
    if (!Number.isFinite(num) || num < 1.0 || num > 6.0) {
      return {
        valid: false,
        error: "COP at 5°F must be between 1.0 and 6.0",
      };
    }
    return { valid: true };
  },
};

// Separate setting validators
export const SEPARATE_SETTING_VALIDATORS = {
  darkMode: (value) => {
    if (typeof value !== "boolean") {
      return { valid: false, error: "Dark mode must be true or false" };
    }
    return { valid: true };
  },

  isMuted: (value) => {
    if (typeof value !== "boolean") {
      return { valid: false, error: "Muted must be true or false" };
    }
    return { valid: true };
  },
};

/**
 * Get all settings from localStorage
 */
export function getAllSettings() {
  try {
    const stored = localStorage.getItem("userSettings");
    const settings = stored ? JSON.parse(stored) : {};
    return { ...DEFAULT_SETTINGS, ...settings };
  } catch (error) {
    console.warn("Failed to parse userSettings from localStorage", error);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Get a specific setting value
 */
export function getSetting(key) {
  const settings = getAllSettings();
  return settings[key] ?? DEFAULT_SETTINGS[key];
}

/**
 * Validate a setting value
 */
export function validateSetting(key, value) {
  const validator = SETTING_VALIDATORS[key];
  if (!validator) {
    // Unknown setting - allow it but warn
    console.warn(`No validator for setting: ${key}`);
    return { valid: true, warning: `No validation for ${key}` };
  }
  return validator(value);
}

/**
 * Set a setting value with validation
 * @param {string} key - Setting key
 * @param {any} value - New value
 * @param {object} meta - Metadata (source, comment, etc.)
 * @returns {object} - { success: boolean, error?: string, value?: any }
 */
export function setSetting(key, value, meta = {}) {
  // Validate
  const validation = validateSetting(key, value);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      value: null,
    };
  }

  // Get current settings
  const currentSettings = getAllSettings();

  // Update setting
  const updatedSettings = {
    ...currentSettings,
    [key]: value,
  };

  // Persist to localStorage
  try {
    localStorage.setItem("userSettings", JSON.stringify(updatedSettings));

    // Dispatch custom event for same-tab updates
    window.dispatchEvent(
      new CustomEvent("userSettingsUpdated", {
        detail: { key, value, previousValue: currentSettings[key], meta },
      })
    );

    // Also dispatch storage event for cross-tab compatibility
    // (Note: This won't actually fire a storage event, but components listening
    // to storage events will also listen to our custom event)

    return {
      success: true,
      value,
      previousValue: currentSettings[key],
      meta,
    };
  } catch (error) {
    console.error("Failed to persist setting", error);
    return {
      success: false,
      error: `Failed to save setting: ${error.message}`,
      value: null,
    };
  }
}

/**
 * Set a separate setting (not in userSettings)
 */
export function setSeparateSetting(key, value) {
  const validator = SEPARATE_SETTING_VALIDATORS[key];
  if (validator) {
    const validation = validator(value);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        value: null,
      };
    }
  }

  try {
    // Map to localStorage keys
    const storageKeys = {
      darkMode: "darkMode",
      isMuted: "globalMuted",
    };

    const storageKey = storageKeys[key] || key;
    localStorage.setItem(storageKey, JSON.stringify(value));

    // Dispatch custom event
    window.dispatchEvent(
      new CustomEvent("separateSettingUpdated", {
        detail: { key, value },
      })
    );

    return {
      success: true,
      value,
    };
  } catch (error) {
    console.error("Failed to persist separate setting", error);
    return {
      success: false,
      error: `Failed to save setting: ${error.message}`,
      value: null,
    };
  }
}

/**
 * Get a separate setting
 */
export function getSeparateSetting(key) {
  try {
    const storageKeys = {
      darkMode: "darkMode",
      isMuted: "globalMuted",
    };

    const storageKey = storageKeys[key] || key;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      return JSON.parse(stored);
    }
    return SEPARATE_SETTINGS[key];
  } catch (error) {
    console.warn(`Failed to read separate setting ${key}`, error);
    return SEPARATE_SETTINGS[key];
  }
}

/**
 * Batch update multiple settings
 */
export function setSettings(updates, meta = {}) {
  const results = {};
  const currentSettings = getAllSettings();
  const updatedSettings = { ...currentSettings };

  // Validate all updates first
  for (const [key, value] of Object.entries(updates)) {
    const validation = validateSetting(key, value);
    if (!validation.valid) {
      results[key] = {
        success: false,
        error: validation.error,
      };
      return {
        success: false,
        results,
        error: `Validation failed for ${key}: ${validation.error}`,
      };
    }
    updatedSettings[key] = value;
  }

  // Apply all updates
  try {
    localStorage.setItem("userSettings", JSON.stringify(updatedSettings));

    // Dispatch custom event
    window.dispatchEvent(
      new CustomEvent("userSettingsUpdated", {
        detail: { updates, meta },
      })
    );

    // Return success for each update
    for (const [key, value] of Object.entries(updates)) {
      results[key] = {
        success: true,
        value,
        previousValue: currentSettings[key],
      };
    }

    return { success: true, results };
  } catch (error) {
    console.error("Failed to persist settings", error);
    return {
      success: false,
      results,
      error: `Failed to save settings: ${error.message}`,
    };
  }
}

/**
 * Reset a setting to default
 */
export function resetSetting(key) {
  const defaultValue = DEFAULT_SETTINGS[key];
  if (defaultValue === undefined) {
    return {
      success: false,
      error: `No default value for setting: ${key}`,
    };
  }
  return setSetting(key, defaultValue, {
    source: "reset",
    comment: "Reset to default",
  });
}

/**
 * Reset all settings to defaults
 */
export function resetAllSettings() {
  try {
    localStorage.setItem("userSettings", JSON.stringify(DEFAULT_SETTINGS));
    window.dispatchEvent(
      new CustomEvent("userSettingsUpdated", {
        detail: { reset: true },
      })
    );
    return { success: true };
  } catch (error) {
    console.error("Failed to reset settings", error);
    return {
      success: false,
      error: `Failed to reset settings: ${error.message}`,
    };
  }
}
