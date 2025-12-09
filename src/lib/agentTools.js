// Agent tools for LLM-powered thermostat
// Provides the LLM with "superpowers" to fetch context on demand

import { loadThermostatSettings } from "./thermostatSettings";

/**
 * Tool: Read knowledge base file
 * Fetches HVAC domain knowledge, user preferences, or system state
 */
export async function readKnowledgeFile(filename) {
  try {
    // In browser context, fetch from public folder
    const response = await fetch(`/knowledge/${filename}`);
    if (!response.ok)
      return { error: true, message: `File not found: ${filename}` };
    const content = await response.text();
    return { success: true, content };
  } catch (error) {
    return { error: true, message: error.message };
  }
}

/**
 * Tool: Get current system state
 * Returns live thermostat data, sensor readings, system status
 * Checks both passed data and localStorage for thermostat state
 */
export function getCurrentState(thermostatData) {
  // First try passed data
  if (
    thermostatData &&
    (thermostatData.currentTemp || thermostatData.targetTemp)
  ) {
    return {
      indoorTemp: thermostatData.currentTemp,
      targetTemp: thermostatData.targetTemp,
      mode: thermostatData.mode,
      systemRunning: thermostatData.isRunning,
      outdoorTemp: thermostatData.outdoorTemp,
      humidity: thermostatData.humidity,
    };
  }

  // Try localStorage for thermostat state
  if (typeof window !== "undefined") {
    try {
      // Check for thermostatState
      const storedState = localStorage.getItem("thermostatState");
      if (storedState) {
        const parsed = JSON.parse(storedState);
        if (
          parsed &&
          (parsed.currentTemp || parsed.targetTemp || parsed.indoorTemp)
        ) {
          return {
            indoorTemp: parsed.currentTemp || parsed.indoorTemp || null,
            targetTemp: parsed.targetTemp || null,
            mode: parsed.mode || "unknown",
            systemRunning: parsed.isRunning || parsed.systemRunning || false,
            outdoorTemp: parsed.outdoorTemp || null,
            humidity: parsed.humidity || null,
          };
        }
      }

      // Check for thermostatCSVData (might have different structure)
      const csvData = localStorage.getItem("thermostatCSVData");
      if (csvData) {
        const parsed = JSON.parse(csvData);
        if (parsed) {
          // Handle different possible structures
          return {
            indoorTemp:
              parsed.currentTemp || parsed.indoorTemp || parsed.temp || null,
            targetTemp:
              parsed.targetTemp || parsed.setpoint || parsed.target || null,
            mode: parsed.mode || parsed.hvacMode || "unknown",
            systemRunning: parsed.isRunning || parsed.running || false,
            outdoorTemp: parsed.outdoorTemp || parsed.outdoor || null,
            humidity: parsed.humidity || null,
          };
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  // No data available
  return {
    indoorTemp: null,
    targetTemp: null,
    mode: "unknown",
    systemRunning: false,
    message: "No thermostat data available",
  };
}

/**
 * Tool: Get user settings
 * Returns system configuration, user preferences, safety constraints
 */
export function getUserSettings(userSettings) {
  if (!userSettings) return null;

  // Handle different property names for SEER2
  // Some code uses 'efficiency' for SEER, some uses 'seer2'
  const seer2 =
    userSettings.seer2 || userSettings.efficiency || userSettings.seer || null;

  // Load thermostat schedule if available
  let thermostatSchedule = null;
  let nighttimeTemp = null;
  let daytimeTemp = null;
  let daytimeStartTime = null;
  let nighttimeStartTime = null;
  if (typeof window !== "undefined") {
    try {
      const thermostatSettings = loadThermostatSettings();
      if (thermostatSettings) {
        // Get sleep and wake times from schedule
        const daySchedule = thermostatSettings.schedule?.weekly?.[0] || [];
        const sleepEntry = daySchedule.find(
          (e) => e.comfortSetting === "sleep"
        );
        const homeEntry = daySchedule.find((e) => e.comfortSetting === "home");
        thermostatSchedule = {
          sleepTime: sleepEntry?.time || null,
          wakeTime: homeEntry?.time || null,
        };
        nighttimeTemp =
          thermostatSettings.comfortSettings?.sleep?.heatSetPoint || null;
        daytimeTemp =
          thermostatSettings.comfortSettings?.home?.heatSetPoint || null;
        daytimeStartTime = homeEntry?.time || null;
        nighttimeStartTime = sleepEntry?.time || null;
      }
    } catch (e) {
      // Ignore errors - thermostat settings are optional
    }
  }

  return {
    primarySystem: userSettings.primarySystem,
    hspf2: userSettings.hspf2,
    seer2: seer2,
    capacity: userSettings.capacity || userSettings.coolingCapacity,
    squareFeet: userSettings.squareFeet,
    utilityCost: userSettings.utilityCost,
    winterThermostat: userSettings.winterThermostat,
    summerThermostat: userSettings.summerThermostat,
    thermostatSchedule: thermostatSchedule,
    nighttimeTemp: nighttimeTemp,
    daytimeTemp: daytimeTemp,
    daytimeStartTime: daytimeStartTime,
    nighttimeStartTime: nighttimeStartTime,
  };
}

/**
 * Tool: Get location context
 * Returns climate data, elevation, regional info
 * Tries multiple sources: userLocation prop, localStorage, userSettings
 */
export function getLocationContext(userLocation, userSettings = null) {
  // Helper: Prefer userSettings.homeElevation if set (user-specified takes precedence)
  const getElevation = (locationElevation) => {
    if (
      userSettings &&
      typeof userSettings.homeElevation === "number" &&
      userSettings.homeElevation >= 0
    ) {
      return userSettings.homeElevation;
    }
    return locationElevation || null;
  };

  // Try userLocation prop first
  if (userLocation && (userLocation.city || userLocation.lat)) {
    return {
      city: userLocation.city || null,
      state: userLocation.state || null,
      elevation: getElevation(userLocation.elevation),
      lat: userLocation.lat || userLocation.latitude || null,
      lon: userLocation.lon || userLocation.longitude || null,
    };
  }

  // Try localStorage as fallback
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("userLocation");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.city || parsed.lat || parsed.latitude)) {
          return {
            city: parsed.city || null,
            state: parsed.state || null,
            elevation: getElevation(parsed.elevation),
            lat: parsed.lat || parsed.latitude || null,
            lon: parsed.lon || parsed.longitude || null,
          };
        }
      }

      // Try separate lat/lon keys
      const lat = localStorage.getItem("userLat");
      const lon = localStorage.getItem("userLon");
      if (lat && lon) {
        return {
          city: null,
          state: null,
          elevation: getElevation(null),
          lat: parseFloat(lat),
          lon: parseFloat(lon),
        };
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  // Try last_forecast_summary from localStorage (where dashboard gets location)
  if (typeof window !== "undefined") {
    try {
      const lastForecast = localStorage.getItem("last_forecast_summary");
      if (lastForecast) {
        const parsed = JSON.parse(lastForecast);
        if (parsed && parsed.location) {
          // Parse location string like "Blairsville, Georgia (Elev: 2200 ft)"
          const locationMatch = parsed.location.match(
            /^([^,]+),\s*([^(]+)\s*\(Elev:\s*(\d+)\s*ft\)/
          );
          if (locationMatch) {
            return {
              city: locationMatch[1].trim(),
              state: locationMatch[2].trim(),
              elevation: getElevation(parseInt(locationMatch[3], 10)),
              lat: null,
              lon: null,
            };
          }
          // Try simpler format: "City, State"
          const simpleMatch = parsed.location.match(/^([^,]+),\s*(.+)$/);
          if (simpleMatch) {
            return {
              city: simpleMatch[1].trim(),
              state: simpleMatch[2].trim(),
              elevation: getElevation(null),
              lat: null,
              lon: null,
            };
          }
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  // Try userSettings as last resort
  if (userSettings) {
    if (userSettings.city || userSettings.location) {
      return {
        city: userSettings.city || userSettings.location || null,
        state: userSettings.state || null,
        elevation: getElevation(null),
        lat: null,
        lon: null,
      };
    }
    // Even if no city/location, return elevation if it's set
    if (
      typeof userSettings.homeElevation === "number" &&
      userSettings.homeElevation >= 0
    ) {
      return {
        city: null,
        state: null,
        elevation: userSettings.homeElevation,
        lat: null,
        lon: null,
      };
    }
  }

  // Return helpful error message instead of null
  return {
    error: true,
    message:
      "Location data not available. Please set your location in Settings or use the location detection feature.",
    missing: {
      city: true,
      state: true,
      coordinates: true,
    },
    howToFix:
      "Go to Settings > Location to set your city/state or enable location detection.",
  };
}

/**
 * Tool: Get current outdoor temperature from NWS API
 * Fetches real-time current conditions from National Weather Service
 * Falls back to Open-Meteo if NWS is unavailable
 */
export async function getCurrentOutdoorTemp(lat, lon) {
  if (!lat || !lon) {
    // Try to get from location context
    const location = getLocationContext(null, null);
    if (location && location.lat && location.lon) {
      lat = location.lat;
      lon = location.lon;
    } else {
      // Try localStorage
      if (typeof window !== "undefined") {
        try {
          const userLocation = localStorage.getItem("userLocation");
          if (userLocation) {
            const parsed = JSON.parse(userLocation);
            lat = parsed.latitude || parsed.lat;
            lon = parsed.longitude || parsed.lon;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }

  if (!lat || !lon) {
    return { error: true, message: "Location not available" };
  }

  try {
    // Try NWS API first (for US locations)
    const pointsUrl = `https://api.weather.gov/points/${lat},${lon}`;
    const pointsResp = await fetch(pointsUrl, {
      headers: {
        "User-Agent": "EngineeringTools/1.0 (https://github.com/your-repo)",
        Accept: "application/json",
      },
    });

    if (pointsResp.ok) {
      const pointsData = await pointsResp.json();
      const gridId = pointsData.properties?.gridId;
      const gridX = pointsData.properties?.gridX;
      const gridY = pointsData.properties?.gridY;

      if (gridId && gridX !== undefined && gridY !== undefined) {
        // Get current observations
        const obsUrl = `https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/observations/latest`;
        const obsResp = await fetch(obsUrl, {
          headers: {
            "User-Agent": "EngineeringTools/1.0 (https://github.com/your-repo)",
            Accept: "application/json",
          },
        });

        if (obsResp.ok) {
          const obsData = await obsResp.json();
          const temp = obsData.properties?.temperature?.value;
          if (temp !== null && temp !== undefined) {
            // NWS observations return temperature in Celsius
            // Convert to Fahrenheit
            const tempF = (temp * 9) / 5 + 32;
            return {
              success: true,
              temperature: Math.round(tempF),
              source: "NWS",
              timestamp: obsData.properties?.timestamp,
            };
          }
        }
      }
    }

    // Fallback to Open-Meteo for current conditions
    const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&temperature_unit=fahrenheit`;
    const openMeteoResp = await fetch(openMeteoUrl);
    if (openMeteoResp.ok) {
      const data = await openMeteoResp.json();
      const currentTemp = data.current?.temperature_2m;
      if (currentTemp !== null && currentTemp !== undefined) {
        return {
          success: true,
          temperature: Math.round(currentTemp),
          source: "Open-Meteo",
        };
      }
    }

    return { error: true, message: "Unable to fetch current temperature" };
  } catch (error) {
    return { error: true, message: error.message };
  }
}

/**
 * Tool: Search HVAC knowledge base
 * Uses RAG (Retrieval-Augmented Generation) with structured knowledge base
 * Includes ACCA Manual J/S/D, ASHRAE 55/62.2, DOE guides, and engineering standards
 */
export async function searchHVACKnowledge(query) {
  try {
    // Import RAG query utility
    const { queryHVACKnowledge } = await import("../utils/rag/ragQuery.js");

    // Query the knowledge base
    const result = await queryHVACKnowledge(query);

    if (result.success) {
      return {
        success: true,
        content: result.content,
        message: "Found relevant HVAC engineering knowledge",
      };
    } else {
      return {
        success: false,
        message: result.message || "No relevant knowledge found",
      };
    }
  } catch (error) {
    console.error("[agentTools] Error in searchHVACKnowledge:", error);
    // Fallback to simple response
    return {
      success: false,
      message: `Error searching knowledge base: ${error.message}`,
    };
  }
}

/**
 * Tool: Calculate energy impact
 * Estimates cost/savings for thermostat changes
 */
export function calculateEnergyImpact(params) {
  const {
    tempChange,
    systemType,
    utilityCost = 0.15,
    hspf2 = 9,
    seer2 = 15,
  } = params;

  // Simplified calculation - rule of thumb: 3% savings per degree (heating)
  const percentSavings = Math.abs(tempChange) * 3;
  const annualSavings = percentSavings; // Rough estimate

  return {
    tempChange,
    percentSavings: percentSavings.toFixed(1),
    estimatedAnnualSavings: `$${annualSavings.toFixed(0)}`,
    recommendation: Math.abs(tempChange) <= 2 ? "safe" : "may trigger aux heat",
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

  if (action === "setTemp") {
    const { temp } = params;
    if (temp > policy.maxTemp) {
      return {
        allowed: false,
        reason: `Temperature ${temp}°F exceeds maximum ${policy.maxTemp}°F`,
      };
    }
    if (temp < policy.minTemp) {
      return {
        allowed: false,
        reason: `Temperature ${temp}°F below minimum ${policy.minTemp}°F`,
      };
    }
  }

  if (action === "setback") {
    const { delta } = params;
    if (Math.abs(delta) > policy.maxTempDelta && policy.stripHeatProtection) {
      return {
        allowed: true,
        warning: `Setback of ${delta}°F may trigger auxiliary heat (recommended max: ${policy.maxTempDelta}°F)`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Tool: Get CSV diagnostics data from System Performance Analyzer
 * Returns analysis results and parsed CSV data if available
 */
export function getCSVDiagnosticsData() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    // Multi-zone support: Check all zones for CSV data
    let zones = [];
    try {
      zones = JSON.parse(localStorage.getItem("zones") || "[]");
    } catch {
      // Fallback to single zone
      zones = [{ id: "zone1", name: "Main Zone" }];
    }
    
    // If no zones, check legacy single-zone storage
    if (zones.length === 0) {
      zones = [{ id: "zone1", name: "Main Zone" }];
    }
    
    const diagnostics = {
      hasData: false,
      resultsHistory: null,
      parsedCsvData: null,
      latestAnalysis: null,
      zones: [],
    };
    
    // Check each zone for data
    for (const zone of zones) {
      const zoneKey = (key) => `${key}_${zone.id}`;
      const resultsHistory = localStorage.getItem(zoneKey("spa_resultsHistory"));
      const parsedCsvData = localStorage.getItem(zoneKey("spa_parsedCsvData"));
      
      let zoneData = null;
      
      if (resultsHistory) {
        try {
          const history = JSON.parse(resultsHistory);
          if (Array.isArray(history) && history.length > 0) {
            zoneData = {
              zoneId: zone.id,
              zoneName: zone.name,
              resultsHistory: history,
              latestAnalysis: history[history.length - 1],
              parsedCsvData: parsedCsvData ? JSON.parse(parsedCsvData) : null,
            };
            diagnostics.hasData = true;
            diagnostics.zones.push(zoneData);
          }
        } catch (e) {
          console.warn(`Failed to parse spa_resultsHistory for ${zone.id}:`, e);
        }
      }
    }
    
    // For backwards compatibility, also check legacy single-zone storage
    if (!diagnostics.hasData) {
      const resultsHistory = localStorage.getItem("spa_resultsHistory");
      const parsedCsvData = localStorage.getItem("spa_parsedCsvData");
      
      if (resultsHistory) {
        try {
          diagnostics.resultsHistory = JSON.parse(resultsHistory);
          diagnostics.hasData = true;
          
          if (
            Array.isArray(diagnostics.resultsHistory) &&
            diagnostics.resultsHistory.length > 0
          ) {
            diagnostics.latestAnalysis =
              diagnostics.resultsHistory[diagnostics.resultsHistory.length - 1];
          }
        } catch (e) {
          console.warn("Failed to parse spa_resultsHistory:", e);
        }
      }
      
      if (parsedCsvData) {
        try {
          diagnostics.parsedCsvData = JSON.parse(parsedCsvData);
          diagnostics.hasData = true;
        } catch (e) {
          console.warn("Failed to parse spa_parsedCsvData:", e);
        }
      }
    } else {
      // Use the most recent analysis from any zone
      const allAnalyses = diagnostics.zones
        .filter(z => z.latestAnalysis)
        .map(z => ({ ...z.latestAnalysis, zoneId: z.zoneId, zoneName: z.zoneName }));
      
      if (allAnalyses.length > 0) {
        // Sort by timestamp if available, otherwise use first
        diagnostics.latestAnalysis = allAnalyses[0];
      }
    }

    return diagnostics.hasData ? diagnostics : null;
  } catch (e) {
    console.warn("Error getting CSV diagnostics data:", e);
    return null;
  }
}

/**
 * Tool: Get diagnostic data
 * Returns advanced sensor data if available, or explains what's missing
 * Now includes CSV analysis data for short cycling and system diagnostics
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
  if (
    lowerQuery.includes("supply air") ||
    lowerQuery.includes("return air") ||
    lowerQuery.includes("delta")
  ) {
    requestedMetrics.push("supplyAirTemp", "returnAirTemp");
  }
  if (lowerQuery.includes("cfm") || lowerQuery.includes("fan")) {
    requestedMetrics.push("cfm");
  }
  if (
    lowerQuery.includes("watt") ||
    lowerQuery.includes("power") ||
    lowerQuery.includes("draw")
  ) {
    requestedMetrics.push("wattDraw");
  }
  if (lowerQuery.includes("stage") || lowerQuery.includes("compressor stage")) {
    requestedMetrics.push("compressorStage");
  }
  if (lowerQuery.includes("cop") || lowerQuery.includes("coefficient")) {
    requestedMetrics.push("cop");
  }
  if (lowerQuery.includes("outdoor coil") || lowerQuery.includes("coil temp")) {
    requestedMetrics.push("outdoorCoilTemp");
  }
  if (lowerQuery.includes("duty cycle") || lowerQuery.includes("runtime")) {
    requestedMetrics.push(
      "dutyCycle",
      "compressorRuntimeToday",
      "auxRuntimeToday"
    );
  }
  if (lowerQuery.includes("lockout") || lowerQuery.includes("threshold")) {
    requestedMetrics.push("lockoutTemp", "auxThreshold");
  }

  // Determine what's missing
  const missing = requestedMetrics.filter(
    (metric) => availableData[metric] === null
  );
  const available = requestedMetrics.filter(
    (metric) => availableData[metric] !== null
  );

  // Check for CSV diagnostics data if query is about short cycling, system performance, or diagnostics
  const needsCSVData =
    lowerQuery.includes("short cycling") ||
    lowerQuery.includes("short cycle") ||
    lowerQuery.includes("cycling") ||
    lowerQuery.includes("runtime") ||
    lowerQuery.includes("diagnostic") ||
    lowerQuery.includes("system performance") ||
    lowerQuery.includes("analysis");

  let csvDiagnostics = null;
  if (needsCSVData) {
    csvDiagnostics = getCSVDiagnosticsData();
  }

  const result = {
    available,
    missing,
    availableData: Object.fromEntries(
      Object.entries(availableData).filter(([k, v]) => v !== null)
    ),
    csvDiagnostics: csvDiagnostics,
    explanation:
      missing.length > 0
        ? `Missing sensors/data: ${missing.join(
            ", "
          )}. These require specialized sensors or equipment not available in this system.`
        : "All requested data is available",
  };

  return result;
}

/**
 * Parse a day name from forecast data (e.g., "Fri, 11/14" -> "Fri")
 */
function parseDayName(dayString) {
  if (!dayString) return null;
  const match = dayString.match(/^(\w+),/);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Parse date from forecast day string (e.g., "Fri, 11/14" -> Date object)
 */
function parseForecastDate(dayString) {
  if (!dayString) return null;
  const match = dayString.match(/(\d{1,2})\/(\d{1,2})/);
  if (!match) return null;
  const month = parseInt(match[1], 10) - 1; // JS months are 0-indexed
  const day = parseInt(match[2], 10);
  const now = new Date();
  const year = now.getFullYear();
  // Handle year rollover (if month/day is in the past, assume next year)
  const date = new Date(year, month, day);
  if (date < now && date < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) {
    return new Date(year + 1, month, day);
  }
  return date;
}

/**
 * Find forecast day matching a user's date query
 * Handles: "Tuesday", "this Tuesday", "next Tuesday", "tomorrow", "in 3 days", etc.
 */
function findMatchingForecastDay(query, dailySummary) {
  if (!dailySummary || dailySummary.length === 0) return null;
  
  const lowerQuery = query.toLowerCase().trim();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Parse day names
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayAbbrevs = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  
  // Check for "tomorrow"
  if (lowerQuery.includes('tomorrow')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return dailySummary.find(d => {
      const forecastDate = parseForecastDate(d.day);
      return forecastDate && forecastDate.getTime() === tomorrow.getTime();
    });
  }
  
  // Check for "today"
  if (lowerQuery.includes('today')) {
    return dailySummary.find(d => {
      const forecastDate = parseForecastDate(d.day);
      return forecastDate && forecastDate.getTime() === today.getTime();
    });
  }
  
  // Check for "day after tomorrow" or "in 2 days"
  if (lowerQuery.includes('day after tomorrow') || /in\s+2\s+days?/i.test(lowerQuery)) {
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + 2);
    return dailySummary.find(d => {
      const forecastDate = parseForecastDate(d.day);
      return forecastDate && forecastDate.getTime() === targetDate.getTime();
    });
  }
  
  // Check for "in X days"
  const daysMatch = lowerQuery.match(/in\s+(\d+)\s+days?/i);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + days);
    return dailySummary.find(d => {
      const forecastDate = parseForecastDate(d.day);
      return forecastDate && forecastDate.getTime() === targetDate.getTime();
    });
  }
  
  // Check for day names (Tuesday, this Tuesday, next Tuesday)
  for (let i = 0; i < dayNames.length; i++) {
    const dayName = dayNames[i];
    const dayAbbrev = dayAbbrevs[i];
    
    if (lowerQuery.includes(dayName) || lowerQuery.includes(dayAbbrev)) {
      const isNext = lowerQuery.includes('next');
      const isThis = lowerQuery.includes('this');
      
      // Find the target day of week
      const todayDayOfWeek = today.getDay();
      let targetDayOfWeek = i;
      
      // Calculate days until target day
      let daysUntilTarget = (targetDayOfWeek - todayDayOfWeek + 7) % 7;
      if (daysUntilTarget === 0) daysUntilTarget = 7; // If today is the day, get next week's
      
      if (isNext) {
        daysUntilTarget += 7; // Next week's occurrence
      } else if (isThis && daysUntilTarget === 7) {
        daysUntilTarget = 0; // This week's occurrence (today if it's that day)
      }
      
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + daysUntilTarget);
      
      return dailySummary.find(d => {
        const forecastDate = parseForecastDate(d.day);
        return forecastDate && forecastDate.getTime() === targetDate.getTime();
      });
    }
  }
  
  return null;
}

/**
 * Get 7-Day Cost Forecast data
 * Returns daily high/low temperatures and forecast summary
 * Includes staleness check (forecasts older than 7 days are considered stale)
 * Enhanced with date parsing and cost breakdown context
 */
export function getForecastData() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const forecastSummary = localStorage.getItem("last_forecast_summary");
    if (!forecastSummary) {
      return null;
    }

    const parsed = JSON.parse(forecastSummary);
    if (!parsed) {
      return null;
    }

    // Check if forecast is stale (older than 7 days)
    const now = Date.now();
    const forecastAge = parsed.timestamp ? now - parsed.timestamp : Infinity;
    const isStale = forecastAge > 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    const ageInDays = forecastAge / (24 * 60 * 60 * 1000);

    // Validate and enhance daily summary
    const dailySummary = (parsed.dailySummary || []).map(day => ({
      ...day,
      // Ensure all numeric fields are valid
      lowTemp: typeof day.lowTemp === 'number' ? day.lowTemp : null,
      highTemp: typeof day.highTemp === 'number' ? day.highTemp : null,
      avgHumidity: typeof day.avgHumidity === 'number' ? day.avgHumidity : null,
      cost: typeof day.cost === 'number' ? day.cost : null,
      costWithAux: typeof day.costWithAux === 'number' ? day.costWithAux : null,
      energy: typeof day.energy === 'number' ? day.energy : null,
      auxEnergy: typeof day.auxEnergy === 'number' ? day.auxEnergy : null,
      energyWithAux: typeof day.energyWithAux === 'number' ? day.energyWithAux : null,
    })).filter(day => day.lowTemp !== null && day.highTemp !== null); // Filter out invalid entries

    // Validate data structure
    if (!Array.isArray(dailySummary) || dailySummary.length === 0) {
      console.warn("Forecast data has no valid daily summary");
      return {
        location: parsed.location || null,
        timestamp: parsed.timestamp || null,
        totalHPCost: parsed.totalHPCost || null,
        dailySummary: [],
        isStale,
        ageInDays: isStale ? Math.round(ageInDays) : null,
        error: "No daily forecast data available",
      };
    }

    return {
      location: parsed.location || null,
      timestamp: parsed.timestamp || null,
      totalHPCost: parsed.totalHPCost || null,
      dailySummary,
      isStale,
      ageInDays: isStale ? Math.round(ageInDays) : null,
      // Helper function to find matching day
      findDay: (query) => findMatchingForecastDay(query, dailySummary),
    };
  } catch (e) {
    console.warn("Failed to parse forecast data:", e);
    return {
      error: `Failed to parse forecast data: ${e.message}`,
      dailySummary: [],
    };
  }
}

/**
 * Available tools registry
 * This defines what the LLM can do
 */
export const AVAILABLE_TOOLS = {
  getCurrentState: {
    description: "Get current thermostat state (temp, mode, system status)",
    params: ["thermostatData"],
  },
  getUserSettings: {
    description: "Get system configuration and user preferences",
    params: ["userSettings"],
  },
  getLocationContext: {
    description:
      "Get location and climate information. Checks userLocation prop, localStorage, and userSettings. Returns error message if location data is missing, explaining what's needed.",
    params: ["userLocation", "userSettings (optional)"],
  },
  searchHVACKnowledge: {
    description: "Search HVAC knowledge base for specific topics",
    params: ["query"],
  },
  calculateEnergyImpact: {
    description: "Calculate energy savings or cost for temperature changes",
    params: ["tempChange", "systemType", "utilityCost"],
  },
  checkPolicy: {
    description: "Validate an action against safety policies",
    params: ["action", "params"],
  },
  getDiagnosticData: {
    description:
      "Get advanced diagnostic sensor data (or explain what sensors are missing)",
    params: ["query", "thermostatData", "userSettings"],
  },
};
