/**
 * Ecobee API Integration
 * Direct integration with Ecobee thermostats via OAuth 2.0
 *
 * Setup:
 * 1. Register app at https://www.ecobee.com/developers/
 * 2. Get API key (app key)
 * 3. Set redirect URI in Ecobee developer portal
 * 4. Store API key in Settings
 */

const ECOBEE_API_BASE = "https://api.ecobee.com";
const ECOBEE_AUTH_URL = "https://www.ecobee.com/consumer/login";
const ECOBEE_TOKEN_URL = `${ECOBEE_API_BASE}/token`;

/**
 * Get stored Ecobee credentials
 */
export function getEcobeeCredentials() {
  try {
    const apiKey = localStorage.getItem("ecobeeApiKey");
    const accessToken = localStorage.getItem("ecobeeAccessToken");
    const refreshToken = localStorage.getItem("ecobeeRefreshToken");
    const tokenExpiry = localStorage.getItem("ecobeeTokenExpiry");

    return {
      apiKey,
      accessToken,
      refreshToken,
      tokenExpiry: tokenExpiry ? parseInt(tokenExpiry, 10) : null,
    };
  } catch (e) {
    console.warn("Failed to get Ecobee credentials:", e);
    return {
      apiKey: null,
      accessToken: null,
      refreshToken: null,
      tokenExpiry: null,
    };
  }
}

/**
 * Store Ecobee credentials
 */
export function storeEcobeeCredentials({
  accessToken,
  refreshToken,
  expiresIn,
}) {
  try {
    if (accessToken) localStorage.setItem("ecobeeAccessToken", accessToken);
    if (refreshToken) localStorage.setItem("ecobeeRefreshToken", refreshToken);
    if (expiresIn) {
      const expiry = Date.now() + expiresIn * 1000;
      localStorage.setItem("ecobeeTokenExpiry", expiry.toString());
    }
  } catch (e) {
    console.warn("Failed to store Ecobee credentials:", e);
  }
}

/**
 * Clear Ecobee credentials
 */
export function clearEcobeeCredentials() {
  try {
    localStorage.removeItem("ecobeeAccessToken");
    localStorage.removeItem("ecobeeRefreshToken");
    localStorage.removeItem("ecobeeTokenExpiry");
    localStorage.removeItem("ecobeePin");
  } catch (e) {
    console.warn("Failed to clear Ecobee credentials:", e);
  }
}

/**
 * Check if access token is expired or about to expire (within 5 minutes)
 */
export function isTokenExpired(tokenExpiry) {
  if (!tokenExpiry) return true;
  const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;
  return tokenExpiry < fiveMinutesFromNow;
}

/**
 * Step 1: Get authorization PIN from Ecobee
 * User must enter this PIN on ecobee.com
 */
export async function requestEcobeePin(apiKey) {
  try {
    const response = await fetch(
      `${ECOBEE_TOKEN_URL}?grant_type=ecobeePin&client_id=${apiKey}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to request PIN: ${response.status} ${error}`);
    }

    const data = await response.json();

    // Store PIN for later use
    if (data.code) {
      localStorage.setItem("ecobeePin", data.code);
    }

    return {
      pin: data.code,
      authUrl: `${ECOBEE_AUTH_URL}?client_id=${apiKey}&response_type=ecobeePin&scope=smartWrite`,
      expiresIn: data.expires_in,
      interval: data.interval,
    };
  } catch (error) {
    console.error("Error requesting Ecobee PIN:", error);
    throw error;
  }
}

/**
 * Step 2: Exchange PIN for access token
 * Call this after user has authorized on ecobee.com
 */
export async function exchangePinForToken(apiKey, pin) {
  try {
    const response = await fetch(
      `${ECOBEE_TOKEN_URL}?grant_type=ecobeePin&code=${pin}&client_id=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange PIN: ${response.status} ${error}`);
    }

    const data = await response.json();

    storeEcobeeCredentials({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    });

    // Clear PIN after successful exchange
    localStorage.removeItem("ecobeePin");

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    console.error("Error exchanging PIN for token:", error);
    throw error;
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshEcobeeToken(apiKey, refreshToken) {
  try {
    const response = await fetch(
      `${ECOBEE_TOKEN_URL}?grant_type=refresh_token&refresh_token=${refreshToken}&client_id=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${response.status} ${error}`);
    }

    const data = await response.json();

    storeEcobeeCredentials({
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken, // Use new refresh token if provided
      expiresIn: data.expires_in,
    });

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    console.error("Error refreshing Ecobee token:", error);
    throw error;
  }
}

/**
 * Get valid access token (refresh if needed)
 */
export async function getValidAccessToken(apiKey) {
  const credentials = getEcobeeCredentials();

  if (!credentials.accessToken) {
    throw new Error("No access token. Please authenticate first.");
  }

  // Check if token is expired or about to expire
  if (isTokenExpired(credentials.tokenExpiry)) {
    if (!credentials.refreshToken) {
      throw new Error(
        "Token expired and no refresh token available. Please re-authenticate."
      );
    }

    // Refresh the token
    const refreshed = await refreshEcobeeToken(
      apiKey,
      credentials.refreshToken
    );
    return refreshed.accessToken;
  }

  return credentials.accessToken;
}

/**
 * Make authenticated API request to Ecobee
 */
async function ecobeeApiRequest(endpoint, method = "GET", body = null) {
  const credentials = getEcobeeCredentials();
  const apiKey = credentials.apiKey;

  if (!apiKey) {
    throw new Error(
      "Ecobee API key not configured. Please add it in Settings."
    );
  }

  const accessToken = await getValidAccessToken(apiKey);

  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${ECOBEE_API_BASE}${endpoint}`, options);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ecobee API error: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Get thermostat data (temperature, humidity, mode, etc.)
 */
export async function getThermostatData(thermostatId = null) {
  try {
    // Build selection object
    const selectionType = thermostatId ? "thermostats" : "registered";
    const selectionMatch = thermostatId || "";

    const body = {
      selection: {
        selectionType,
        selectionMatch,
        includeRuntime: true,
        includeSettings: true,
        includeSensors: true,
      },
    };

    const queryParams = new URLSearchParams({
      format: "json",
      body: JSON.stringify(body),
    });

    const response = await ecobeeApiRequest(
      `/1/thermostat?${queryParams.toString()}`,
      "GET"
    );

    // Parse response (Ecobee returns { status: { code: 0 }, thermostatList: [...] })
    if (
      response.status &&
      response.status.code === 0 &&
      response.thermostatList
    ) {
      const thermostats = response.thermostatList;

      // If specific ID requested, find it; otherwise use first
      const thermostat = thermostatId
        ? thermostats.find((t) => t.identifier === thermostatId)
        : thermostats[0];

      if (!thermostat) {
        throw new Error(`Thermostat ${thermostatId || "not found"}`);
      }

      // Extract relevant data
      const runtime = thermostat.runtime || {};
      const settings = thermostat.settings || {};
      const remoteSensors = thermostat.remoteSensors || [];

      // Get main sensor temperature (usually first sensor)
      const mainSensor =
        remoteSensors.find((s) => s.type === "ecobee3_remote_sensor") ||
        remoteSensors[0];
      const sensorTemp = mainSensor?.capability?.find(
        (c) => c.type === "temperature"
      )?.value;

      return {
        identifier: thermostat.identifier,
        name: thermostat.name,
        temperature: parseFloat(runtime.actualTemperature) / 10, // Ecobee uses tenths
        humidity: parseInt(runtime.actualHumidity, 10),
        targetHeatTemp: parseFloat(settings.heatTemp) / 10,
        targetCoolTemp: parseFloat(settings.coolTemp) / 10,
        mode: settings.hvacMode, // 'auto', 'heat', 'cool', 'off', 'auxHeatOnly'
        fanMode: settings.fan, // 'auto', 'on'
        isAway: settings.vacationHold?.enabled || false,
        equipmentStatus:
          runtime.desiredHeatRange || runtime.desiredCoolRange || "idle",
        sensorTemperature: sensorTemp ? parseFloat(sensorTemp) / 10 : null,
      };
    }

    throw new Error("Invalid response from Ecobee API");
  } catch (error) {
    console.error("Error getting thermostat data:", error);
    throw error;
  }
}

/**
 * Get comfort settings (climates) from Ecobee
 */
export async function getComfortSettings(thermostatId = null) {
  try {
    const credentials = getEcobeeCredentials();
    if (!credentials.apiKey || !credentials.accessToken) {
      throw new Error("Ecobee API credentials not configured");
    }

    // Build selection object
    const selectionType = thermostatId ? "thermostats" : "registered";
    const selectionMatch = thermostatId || "";

    const body = {
      selection: {
        selectionType,
        selectionMatch,
        includeProgram: true,
        includeSettings: true,
      },
    };

    const queryParams = new URLSearchParams({
      format: "json",
      body: JSON.stringify(body),
    });

    const response = await ecobeeApiRequest(
      `/1/thermostat?${queryParams.toString()}`,
      "GET"
    );

    // Parse response
    if (
      response.status &&
      response.status.code === 0 &&
      response.thermostatList
    ) {
      const thermostats = response.thermostatList;
      const thermostat = thermostatId
        ? thermostats.find((t) => t.identifier === thermostatId)
        : thermostats[0];

      if (!thermostat) {
        throw new Error(`Thermostat ${thermostatId || "not found"}`);
      }

      // Extract program/climates
      const program = thermostat.program || {};
      const climates = program.climates || [];
      const currentClimateRef = program.currentClimateRef;

      // Map Ecobee climates to app comfort settings
      // Ecobee typically has: home, away, sleep, etc.
      const comfortMap = {
        home: null,
        away: null,
        sleep: null,
      };

      // Find climates by name (case-insensitive)
      for (const climate of climates) {
        const name = climate.name?.toLowerCase();
        if (name === "home" || name === "comfort") {
          comfortMap.home = climate;
        } else if (name === "away" || name === "vacation") {
          comfortMap.away = climate;
        } else if (name === "sleep" || name === "night") {
          comfortMap.sleep = climate;
        }
      }

      // If not found by name, try to use the first 3 climates
      const foundClimates = Object.values(comfortMap).filter((c) => c !== null);
      if (foundClimates.length === 0 && climates.length > 0) {
        comfortMap.home = climates[0] || null;
        comfortMap.away = climates[1] || null;
        comfortMap.sleep = climates[2] || null;
      }

      // Convert to app format
      const result = {
        home: comfortMap.home
          ? {
              heatSetPoint: comfortMap.home.heatTemp
                ? parseFloat(comfortMap.home.heatTemp) / 10
                : 70,
              coolSetPoint: comfortMap.home.coolTemp
                ? parseFloat(comfortMap.home.coolTemp) / 10
                : 74,
              fanMode: comfortMap.home.fan || "auto",
            }
          : null,
        away: comfortMap.away
          ? {
              heatSetPoint: comfortMap.away.heatTemp
                ? parseFloat(comfortMap.away.heatTemp) / 10
                : 62,
              coolSetPoint: comfortMap.away.coolTemp
                ? parseFloat(comfortMap.away.coolTemp) / 10
                : 85,
              fanMode: comfortMap.away.fan || "auto",
            }
          : null,
        sleep: comfortMap.sleep
          ? {
              heatSetPoint: comfortMap.sleep.heatTemp
                ? parseFloat(comfortMap.sleep.heatTemp) / 10
                : 66,
              coolSetPoint: comfortMap.sleep.coolTemp
                ? parseFloat(comfortMap.sleep.coolTemp) / 10
                : 72,
              fanMode: comfortMap.sleep.fan || "auto",
            }
          : null,
      };

      return result;
    }

    throw new Error("Invalid response from Ecobee API");
  } catch (error) {
    console.error("Error getting comfort settings:", error);
    throw error;
  }
}

/**
 * Set thermostat temperature
 */
export async function setThermostatTemperature(
  thermostatId,
  heatTemp,
  coolTemp,
  holdType = "indefinite"
) {
  try {
    // Convert to tenths (Ecobee uses tenths of degrees)
    const heatTempTenths = Math.round(heatTemp * 10);
    const coolTempTenths = Math.round(coolTemp * 10);

    const body = {
      selection: {
        selectionType: thermostatId ? "thermostats" : "registered",
        selectionMatch: thermostatId || "",
      },
      functions: [
        {
          type: "setHold",
          params: {
            holdType: holdType, // 'indefinite', 'nextTransition', 'holdHours'
            heatHoldTemp: heatTempTenths,
            coolHoldTemp: coolTempTenths,
          },
        },
      ],
    };

    const queryParams = new URLSearchParams({
      format: "json",
      body: JSON.stringify(body),
    });

    const response = await ecobeeApiRequest(
      `/1/thermostat?${queryParams.toString()}`,
      "POST"
    );

    if (response.status && response.status.code === 0) {
      return { success: true };
    }

    throw new Error(
      `Failed to set temperature: ${
        response.status?.message || "Unknown error"
      }`
    );
  } catch (error) {
    console.error("Error setting thermostat temperature:", error);
    throw error;
  }
}

/**
 * Set thermostat mode (heat, cool, off, auto)
 */
export async function setThermostatMode(thermostatId, mode) {
  try {
    // Map our mode names to Ecobee mode names
    const ecobeeModeMap = {
      heat: "heat",
      cool: "cool",
      off: "off",
      auto: "auto",
    };

    const ecobeeMode = ecobeeModeMap[mode];
    if (!ecobeeMode) {
      throw new Error(`Invalid mode: ${mode}`);
    }

    const body = {
      selection: {
        selectionType: thermostatId ? "thermostats" : "registered",
        selectionMatch: thermostatId || "",
      },
      thermostat: {
        settings: {
          hvacMode: ecobeeMode,
        },
      },
    };

    const queryParams = new URLSearchParams({
      format: "json",
      body: JSON.stringify(body),
    });

    const response = await ecobeeApiRequest(
      `/1/thermostat?${queryParams.toString()}`,
      "POST"
    );

    if (response.status && response.status.code === 0) {
      return { success: true };
    }

    throw new Error(
      `Failed to set mode: ${response.status?.message || "Unknown error"}`
    );
  } catch (error) {
    console.error("Error setting thermostat mode:", error);
    throw error;
  }
}

/**
 * Set away mode (vacation hold)
 */
export async function setAwayMode(
  thermostatId,
  enabled,
  heatTemp = null,
  coolTemp = null
) {
  try {
    const credentials = getEcobeeCredentials();

    // If enabling away mode, use comfort settings if temps not provided
    if (enabled && (heatTemp === null || coolTemp === null)) {
      // Get current thermostat to use away comfort setting
      const thermostat = await getThermostatData(thermostatId);
      // For now, use default away temps (can be improved to read from comfort settings)
      heatTemp = heatTemp || 62;
      coolTemp = coolTemp || 85;
    }

    if (enabled) {
      // Set vacation hold
      const heatTempTenths = Math.round(heatTemp * 10);
      const coolTempTenths = Math.round(coolTemp * 10);

      const body = {
        selection: {
          selectionType: thermostatId ? "thermostats" : "registered",
          selectionMatch: thermostatId || "",
        },
        functions: [
          {
            type: "setVacation",
            params: {
              name: "Away Mode",
              coolHoldTemp: coolTempTenths,
              heatHoldTemp: heatTempTenths,
              startDate: new Date().toISOString().split("T")[0],
              startTime: new Date()
                .toTimeString()
                .split(" ")[0]
                .substring(0, 5),
              endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0], // 1 year from now
              endTime: "23:59",
              fan: "auto",
              fanMinOnTime: 0,
            },
          },
        ],
      };

      const queryParams = new URLSearchParams({
        format: "json",
      });

      const response = await ecobeeApiRequest(
        `/1/thermostat?${queryParams.toString()}`,
        "POST",
        body
      );

      if (response.status && response.status.code === 0) {
        return { success: true };
      }

      throw new Error(
        `Failed to set away mode: ${
          response.status?.message || "Unknown error"
        }`
      );
    } else {
      // Resume schedule (cancel vacation hold)
      const body = {
        selection: {
          selectionType: thermostatId ? "thermostats" : "registered",
          selectionMatch: thermostatId || "",
        },
        functions: [
          {
            type: "resumeProgram",
            params: {
              resumeAll: false,
            },
          },
        ],
      };

      const queryParams = new URLSearchParams({
        format: "json",
      });

      const response = await ecobeeApiRequest(
        `/1/thermostat?${queryParams.toString()}`,
        "POST",
        body
      );

      if (response.status && response.status.code === 0) {
        return { success: true };
      }

      throw new Error(
        `Failed to resume schedule: ${
          response.status?.message || "Unknown error"
        }`
      );
    }
  } catch (error) {
    console.error("Error setting away mode:", error);
    throw error;
  }
}

/**
 * Resume schedule (cancel all holds)
 */
export async function resumeSchedule(thermostatId) {
  try {
    const body = {
      selection: {
        selectionType: thermostatId ? "thermostats" : "registered",
        selectionMatch: thermostatId || "",
      },
      functions: [
        {
          type: "resumeProgram",
          params: {
            resumeAll: true,
          },
        },
      ],
    };

    const queryParams = new URLSearchParams({
      format: "json",
      body: JSON.stringify(body),
    });

    const response = await ecobeeApiRequest(
      `/1/thermostat?${queryParams.toString()}`,
      "POST"
    );

    if (response.status && response.status.code === 0) {
      return { success: true };
    }

    throw new Error(
      `Failed to resume schedule: ${
        response.status?.message || "Unknown error"
      }`
    );
  } catch (error) {
    console.error("Error resuming schedule:", error);
    throw error;
  }
}
