/**
 * Thermostat Settings Manager
 * Manages Ecobee-style thermostat settings including:
 * - Installation Settings (Equipment, Thresholds, Sensors)
 * - Comfort Settings
 * - Schedule
 * - Preferences
 * - Alerts/Reminders
 */

// Default settings structure
export const DEFAULT_THERMOSTAT_SETTINGS = {
  // Installation Settings → Equipment
  equipment: {
    wiring: {
      hasHeat: true,
      hasCool: true,
      hasFan: true,
      hasAuxHeat: false,
      hasDehumidifier: false,
      hasHumidifier: false,
      hasVentilator: false,
    },
    heatPump: {
      type: "air-to-air", // 'air-to-air' | 'geothermal'
      reversingValve: "O", // 'O' | 'B' - energized on cool or heat
      auxHeatSimultaneous: false, // Allow aux heat with heat pump
    },
    ventilator: {
      freeCoolingMaxOutdoorTemp: 65, // °F
      indoorOutdoorTempDelta: 5, // °F
      maxSetPointTempDelta: 2, // °F
    },
  },

  // Installation Settings → Thresholds
  // Optimized Defaults based on Building Science, NEMA Standards, and Comfort Psychology
  thresholds: {
    autoHeatCool: false, // Disabled - In spring/fall, "Auto" often triggers heat at night and AC at noon, wasting energy
    heatCoolMinDelta: 5, // °F - Prevents "mode fighting." If set to 2°F, AC might overshoot and trigger heat immediately
    staging: "auto", // 'auto' | 'manual' - Automatic staging enabled
    compressorMinCycleOff: 600, // seconds (10 minutes) - NEMA MG-1: Motors overheat on startup. Extending rest period allows refrigerant pressures to equalize
    compressorMinOnTime: 300, // seconds (5 minutes) - Oil return: Oil migrates into lines, takes ~3-5 minutes to push back to crankcase
    compressorMinOutdoorTemp: 20, // °F - Set to Balance Point. Below balance point, heat pumps run continuously but lose ground
    acOvercoolMax: 2.5, // °F - Allows AC to act as dehumidifier. Cold & Dry feels better than Warm & Wet
    auxHeatMaxOutdoorTemp: 35, // °F - Electric strips cost 3x more than heat pumps. Never use above freezing unless emergency
    heatDifferential: 1.0, // °F - 0.5°F causes rapid cycling (6+ cycles/hr). 1.0°F reduces cycles by ~40% with no noticeable comfort loss
    heatDissipationTime: 60, // seconds - Heat exchanger still hot when fire stops. 60s of fan scavenges "free" heat into room
    heatMinOnTime: 300, // seconds (5 minutes) - Oil return requirement
    coolDifferential: 1.0, // °F - Same as heat: prevents rapid cycling, reduces cycles by ~40%
    coolDissipationTime: 45, // seconds - Coil still wet and cold. 45s evaporates water (cooling air) and raises Sensible Heat Ratio
    coolMinOnTime: 300, // seconds (5 minutes) - Oil return requirement
    compressorReverseStaging: true, // Enabled - Instead of shutting off from Stage 2, shifts to Stage 1. Runs longer, quieter, more efficiently
    compressorToAuxTempDelta: 3, // °F - Don't trigger Aux just because 1 degree behind. Give heat pump time to recover. Aux is "Nuclear Option"
    fanMinOnTime: 0, // minutes per hour - minimum fan runtime for air circulation (0 = disabled)
    temperatureCorrection: 0, // °F offset - No correction unless sensor is inaccurate
    humidityCorrection: 0, // % offset - No correction unless sensor is inaccurate
    thermalProtect: 10, // °F - max difference before ignoring sensor (protects against bad readings)
    installerCode: null, // 4-digit code (null = disabled)
  },

  // Comfort Settings
  comfortSettings: {
    home: {
      heatSetPoint: 70,
      coolSetPoint: 74,
      humiditySetPoint: 50, // Target relative humidity (%)
      fanMode: "auto", // 'auto' | 'on'
      sensors: ["main"], // sensor IDs to use
    },
    away: {
      heatSetPoint: 62,
      coolSetPoint: 85,
      humiditySetPoint: 60, // Higher humidity acceptable when away
      fanMode: "auto",
      sensors: ["main"],
    },
    sleep: {
      heatSetPoint: 66,
      coolSetPoint: 72,
      humiditySetPoint: 50,
      fanMode: "auto",
      sensors: ["main"],
    },
  },

  // Dehumidifier Control Settings
  dehumidifier: {
    enabled: false, // Enable dehumidifier control
    humidityDeadband: 5, // Turn on when RH > setpoint + deadband, off when RH < setpoint - deadband
    minOnTime: 300, // Minimum on time in seconds (5 minutes)
    minOffTime: 300, // Minimum off time in seconds (5 minutes)
    relayTerminal: "Y2", // Relay terminal to use (Y2 = cooling relay 2, or custom)
  },

  // Schedule (simplified - weekly schedule)
  schedule: {
    enabled: true,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    scheduleProfile: "commuter", // Default profile: "commuter" | "workFromHome" | "arbitrage"
    // Day of week (0=Sunday) → array of {time: "HH:MM", comfortSetting: "home"|"away"|"sleep"}
    weekly: {
      0: [
        { time: "06:00", comfortSetting: "home" },
        { time: "08:00", comfortSetting: "away" },
        { time: "17:00", comfortSetting: "home" },
        { time: "22:00", comfortSetting: "sleep" },
      ],
      1: [
        { time: "06:00", comfortSetting: "home" },
        { time: "08:00", comfortSetting: "away" },
        { time: "17:00", comfortSetting: "home" },
        { time: "22:00", comfortSetting: "sleep" },
      ],
      2: [
        { time: "06:00", comfortSetting: "home" },
        { time: "08:00", comfortSetting: "away" },
        { time: "17:00", comfortSetting: "home" },
        { time: "22:00", comfortSetting: "sleep" },
      ],
      3: [
        { time: "06:00", comfortSetting: "home" },
        { time: "08:00", comfortSetting: "away" },
        { time: "17:00", comfortSetting: "home" },
        { time: "22:00", comfortSetting: "sleep" },
      ],
      4: [
        { time: "06:00", comfortSetting: "home" },
        { time: "08:00", comfortSetting: "away" },
        { time: "17:00", comfortSetting: "home" },
        { time: "22:00", comfortSetting: "sleep" },
      ],
      5: [
        { time: "08:00", comfortSetting: "home" },
        { time: "22:00", comfortSetting: "sleep" },
      ],
      6: [
        { time: "08:00", comfortSetting: "home" },
        { time: "22:00", comfortSetting: "sleep" },
      ],
    },
  },

  // Sensors
  sensors: {
    main: {
      id: "main",
      name: "Main Thermostat",
      enabled: true,
      temperatureCorrection: 0,
      humidityCorrection: 0,
    },
  },

  // Preferences
  preferences: {
    display: {
      brightness: 10, // 1-10
      screenTimeout: 30, // seconds
      units: "F", // 'F' | 'C'
    },
    ventilator: {
      mode: "auto", // 'auto' | 'minontime' | 'on' | 'off'
      minOnTime: 20, // minutes
    },
    followMe: true, // Use occupancy sensors to prioritize rooms
    serviceRemindMe: true,
    serviceRemindTechnician: false,
    monthsBetweenService: 6,
  },

  // Alerts/Reminders
  alerts: {
    filterChangeReminder: true,
    filterChangeInterval: 90, // days
    maintenanceReminder: true,
    maintenanceInterval: 180, // days
    temperatureAlerts: true,
    temperatureAlertRange: { min: 50, max: 90 }, // °F
    humidityAlerts: true,
    humidityAlertRange: { min: 30, max: 70 }, // %
  },

  // Access Control
  accessControl: {
    requirePin: false,
    pin: null, // 4-digit PIN
    installerCodeEnabled: false,
    installerCode: "3262", // default
  },

  // System Info
  systemInfo: {
    firmwareVersion: "1.0.0",
    model: "Joule HVAC Thermostat",
    serialNumber: null,
    lastServiceDate: null,
  },
};

/**
 * Load thermostat settings from localStorage
 */
export function loadThermostatSettings() {
  try {
    const stored = localStorage.getItem("thermostatSettings");
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to ensure all fields exist
      return mergeDeep(DEFAULT_THERMOSTAT_SETTINGS, parsed);
    }
  } catch (e) {
    console.warn("Failed to load thermostat settings:", e);
  }
  return DEFAULT_THERMOSTAT_SETTINGS;
}

/**
 * Save thermostat settings to localStorage
 */
export function saveThermostatSettings(settings) {
  try {
    localStorage.setItem("thermostatSettings", JSON.stringify(settings));
    window.dispatchEvent(new Event("thermostatSettingsChanged"));
    return true;
  } catch (e) {
    console.warn("Failed to save thermostat settings:", e);
    return false;
  }
}

/**
 * Update a specific setting path (e.g., 'thresholds.heatDifferential')
 */
export function updateThermostatSetting(path, value) {
  const settings = loadThermostatSettings();
  const keys = path.split(".");
  let current = settings;

  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }

  current[keys[keys.length - 1]] = value;
  saveThermostatSettings(settings);
  return settings;
}

/**
 * Get a specific setting value by path
 */
export function getThermostatSetting(path, defaultValue = null) {
  const settings = loadThermostatSettings();
  const keys = path.split(".");
  let current = settings;

  for (const key of keys) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object"
    ) {
      return defaultValue;
    }
    current = current[key];
  }

  return current !== undefined ? current : defaultValue;
}

/**
 * Deep merge utility
 */
function mergeDeep(target, source) {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = mergeDeep(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

function isObject(item) {
  return item && typeof item === "object" && !Array.isArray(item);
}

/**
 * Get current comfort setting based on schedule
 */
export function getCurrentComfortSetting(settings = null) {
  const s = settings || loadThermostatSettings();
  if (!s.schedule.enabled) {
    return "home"; // Default if schedule disabled
  }

  const now = new Date();
  const dayOfWeek = now.getDay();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;

  const daySchedule = s.schedule.weekly[dayOfWeek] || [];
  if (daySchedule.length === 0) {
    return "home";
  }

  // Find the most recent schedule entry before or at current time
  let currentSetting = "home";
  for (const entry of daySchedule) {
    if (entry.time <= currentTime) {
      currentSetting = entry.comfortSetting;
    } else {
      break;
    }
  }

  return currentSetting;
}

/**
 * Get setpoints for current comfort setting
 */
export function getCurrentSetpoints(settings = null) {
  const s = settings || loadThermostatSettings();
  const comfortSetting = getCurrentComfortSetting(s);
  return s.comfortSettings[comfortSetting] || s.comfortSettings.home;
}

/**
 * Optimized Settings Profile
 * These are now the same as defaults - defaults are already optimized
 * This profile is kept for backward compatibility
 */
export const OPTIMIZED_THERMOSTAT_SETTINGS = {
  thresholds: {
    autoHeatCool: false,
    heatCoolMinDelta: 5,
    staging: "auto",
    compressorMinCycleOff: 600, // 10 min - NEMA MG-1 motor protection
    compressorMinOnTime: 300, // 5 min - Oil return
    compressorMinOutdoorTemp: 20, // Balance Point
    acOvercoolMax: 2.5, // Better dehumidification
    auxHeatMaxOutdoorTemp: 35, // Electric strips cost 3x more
    heatDifferential: 1.0, // Reduces cycling by ~40%
    heatDissipationTime: 60, // Captures free heat
    heatMinOnTime: 300, // Oil return
    coolDifferential: 1.0, // Reduces cycling by ~40%
    coolDissipationTime: 45, // Evaporates water for better efficiency
    coolMinOnTime: 300, // Oil return
    compressorReverseStaging: true, // More efficient staging
    compressorToAuxTempDelta: 3, // Give heat pump time to recover
    temperatureCorrection: 0,
    humidityCorrection: 0,
    thermalProtect: 10,
    installerCode: null,
  },
};

/**
 * Apply optimized settings to current thermostat settings
 * Upgrades from safe defaults to optimized profile
 * @param {Object} currentSettings - Current thermostat settings (optional, loads if not provided)
 * @returns {Object} Updated settings with optimized thresholds
 */
export function applyOptimizedSettings(currentSettings = null) {
  const settings = currentSettings || loadThermostatSettings();

  // Merge optimized thresholds into current settings
  const optimized = {
    ...settings,
    thresholds: {
      ...settings.thresholds,
      ...OPTIMIZED_THERMOSTAT_SETTINGS.thresholds,
    },
  };

  // Save the optimized settings
  saveThermostatSettings(optimized);

  return optimized;
}

/**
 * Check if settings are currently using old safe defaults (pre-optimized)
 * @param {Object} settings - Thermostat settings (optional, loads if not provided)
 * @returns {boolean} True if using old safe defaults (0.5°F differentials, etc.)
 */
export function isUsingSafeDefaults(settings = null) {
  const s = settings || loadThermostatSettings();
  const thresholds = s.thresholds || {};

  // Check key indicators of old safe defaults (before optimization)
  return (
    thresholds.heatDifferential === 0.5 &&
    thresholds.coolDifferential === 0.5 &&
    thresholds.heatDissipationTime === 30 &&
    thresholds.coolDissipationTime === 30 &&
    thresholds.auxHeatMaxOutdoorTemp === 50 &&
    thresholds.compressorMinCycleOff === 300
  );
}

/**
 * Get optimization recommendations based on current settings
 * @param {Object} settings - Thermostat settings (optional, loads if not provided)
 * @returns {Object} Recommendations object with suggested changes
 */
export function getOptimizationRecommendations(settings = null) {
  const s = settings || loadThermostatSettings();
  const thresholds = s.thresholds || {};
  const recommendations = [];

  // Check against optimized defaults
  if (thresholds.heatDifferential === 0.5) {
    recommendations.push({
      setting: "Heat Differential",
      current: "0.5°F",
      recommended: "1.0°F",
      benefit: "Reduces cycling by ~40%, improves efficiency, maintains comfort",
    });
  }

  if (thresholds.coolDifferential === 0.5) {
    recommendations.push({
      setting: "Cool Differential",
      current: "0.5°F",
      recommended: "1.0°F",
      benefit: "Reduces cycling by ~40%, improves efficiency, maintains comfort",
    });
  }

  if (thresholds.heatDissipationTime === 30) {
    recommendations.push({
      setting: "Heat Dissipation Time",
      current: "30s",
      recommended: "60s",
      benefit: "Captures free heat from hot exchanger, better efficiency",
    });
  }

  if (thresholds.coolDissipationTime === 30) {
    recommendations.push({
      setting: "Cool Dissipation Time",
      current: "30s",
      recommended: "45s",
      benefit: "Evaporates water for better cooling, raises Sensible Heat Ratio",
    });
  }

  if (thresholds.auxHeatMaxOutdoorTemp === 50) {
    recommendations.push({
      setting: "Aux Heat Lockout",
      current: "50°F",
      recommended: "35°F",
      benefit: "Electric strips cost 3x more than heat pumps. Saves money.",
    });
  }

  if (thresholds.compressorMinCycleOff === 300) {
    recommendations.push({
      setting: "Compressor Min Cycle Off",
      current: "300s (5 min)",
      recommended: "600s (10 min)",
      benefit: "NEMA MG-1: Allows refrigerant pressures to equalize, reduces startup stress",
    });
  }

  if (thresholds.compressorMinOutdoorTemp > 20) {
    recommendations.push({
      setting: "Compressor Min Outdoor Temp",
      current: `${thresholds.compressorMinOutdoorTemp}°F`,
      recommended: "20°F (Balance Point)",
      benefit: "Below balance point, heat pumps lose ground. Protects compressor.",
    });
  }

  if (thresholds.acOvercoolMax < 2) {
    recommendations.push({
      setting: "AC Overcool Max",
      current: `${thresholds.acOvercoolMax}°F`,
      recommended: "2.5°F",
      benefit: "Allows AC to act as dehumidifier. Cold & Dry feels better than Warm & Wet.",
    });
  }

  return {
    hasRecommendations: recommendations.length > 0,
    recommendations,
    canOptimize: recommendations.length > 0,
  };
}
