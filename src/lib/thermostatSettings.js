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
  thresholds: {
    autoHeatCool: true, // Allow Auto mode
    heatCoolMinDelta: 3, // Minimum gap between heat/cool setpoints in Auto mode (°F)
    staging: "auto", // 'auto' | 'manual'
    compressorMinCycleOff: 300, // seconds (5 minutes default)
    compressorMinOutdoorTemp: 0, // °F - won't run below this
    acOvercoolMax: 2, // °F - max overcool for dehumidification
    auxHeatMaxOutdoorTemp: 40, // °F - aux heat won't run above this
    heatDifferential: 0.5, // °F - dead band for heating
    heatDissipationTime: 0, // seconds - fan run time after heat stops
    heatMinOnTime: 300, // seconds (5 minutes)
    coolDifferential: 0.5, // °F - dead band for cooling
    coolDissipationTime: 0, // seconds - fan run time after cool stops
    coolMinOnTime: 300, // seconds (5 minutes)
    compressorReverseStaging: true,
    temperatureCorrection: 0, // °F offset
    humidityCorrection: 0, // % offset
    thermalProtect: 10, // °F - max difference before ignoring sensor
    installerCode: null, // 4-digit code (null = disabled)
  },

  // Comfort Settings
  comfortSettings: {
    home: {
      heatSetPoint: 70,
      coolSetPoint: 74,
      fanMode: "auto", // 'auto' | 'on'
      sensors: ["main"], // sensor IDs to use
    },
    away: {
      heatSetPoint: 62,
      coolSetPoint: 85,
      fanMode: "auto",
      sensors: ["main"],
    },
    sleep: {
      heatSetPoint: 66,
      coolSetPoint: 72,
      fanMode: "auto",
      sensors: ["main"],
    },
  },

  // Schedule (simplified - weekly schedule)
  schedule: {
    enabled: true,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
