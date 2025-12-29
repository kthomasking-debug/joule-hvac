/**
 * Joule Bridge API Client
 * Communicates with the Raspberry Pi backend running the HAP controller
 *
 * This replaces the direct Ecobee API calls with local HAP protocol calls
 */

const JOULE_BRIDGE_URL = import.meta.env.VITE_JOULE_BRIDGE_URL;

/**
 * Get Joule Bridge URL from settings or environment variable
 * Never uses localhost as fallback - requires explicit configuration
 */
function getBridgeUrl() {
  try {
    const url = localStorage.getItem("jouleBridgeUrl");
    const finalUrl = url || JOULE_BRIDGE_URL;
    if (!finalUrl) {
      throw new Error("Joule Bridge URL not configured. Please set it in Settings.");
    }
    // Normalize URL - remove trailing slash
    return finalUrl.replace(/\/$/, '');
  } catch {
    if (JOULE_BRIDGE_URL) {
      return JOULE_BRIDGE_URL.replace(/\/$/, '');
    }
    throw new Error("Joule Bridge URL not configured. Please set it in Settings.");
  }
}

/**
 * Custom error for connection failures (Bridge not available)
 */
export class BridgeConnectionError extends Error {
  constructor(message) {
    super(message);
    this.name = "BridgeConnectionError";
    this.isConnectionError = true;
  }
}

/**
 * Make API request to Joule Bridge
 */
async function bridgeRequest(endpoint, options = {}) {
  // Try to get URL - throw a more helpful error if not configured
  let url;
  try {
    url = getBridgeUrl();
  } catch (e) {
    throw new BridgeConnectionError("Joule Bridge URL not configured. Please set it in Settings.");
  }
  
  try {
    const { headers, ...restOptions } = options;
    const response = await fetch(`${url}${endpoint}`, {
      ...restOptions,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    });

    if (!response.ok) {
      let errorText = await response.text();
      // Try to parse as JSON to get structured error
      let errorData = null;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        // Not JSON, use as-is
      }
      
      // Extract error message from JSON response if available
      const errorMessage = errorData?.error || errorText;
      const errorObj = new Error(errorMessage);
      errorObj.status = response.status;
      errorObj.isNotFound = response.status === 404;
      errorObj.originalError = errorData || errorText;
      throw errorObj;
    }

    return response.json();
  } catch (error) {
    // Check if it's a connection refused error (Bridge not available)
    if (
      error instanceof TypeError &&
      (error.message.includes("Failed to fetch") ||
        error.message.includes("ERR_CONNECTION_REFUSED") ||
        error.message.includes("NetworkError"))
    ) {
      throw new BridgeConnectionError("Joule Bridge is not available");
    }
    throw error;
  }
}

/**
 * Discover HomeKit devices on the network
 * HomeKit discovery can take 30-60 seconds, so we use a longer timeout
 */
export async function discoverDevices() {
  try {
    // Create a custom timeout for discovery (60 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    
    try {
      const url = getBridgeUrl();
      const response = await fetch(`${url}/api/discover`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Discovery failed with status ${response.status}`);
      }
      
      const data = await response.json();
      return data.devices || [];
    } catch (innerError) {
      clearTimeout(timeoutId);
      if (innerError.name === 'AbortError') {
        throw new Error("Discovery timed out after 60 seconds. Make sure:\n1. Your Ecobee has HomeKit pairing enabled\n2. Both devices are on the same network\n3. Try clicking Discover again");
      }
      throw innerError;
    }
  } catch (error) {
    console.error("Error discovering devices:", error);
    throw error;
  }
}

/**
 * Pair with a HomeKit device
 */
export async function pairDevice(deviceId, pairingCode) {
  try {
    // Pairing can take up to 30 seconds, so use a 45 second timeout (backend has 30s + 10s initialization)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    
    try {
      const data = await bridgeRequest("/api/pair", {
        method: "POST",
        body: JSON.stringify({
          device_id: deviceId,
          pairing_code: pairingCode,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Store paired device
      const pairedDevices = await getPairedDevices();
      if (!pairedDevices.includes(deviceId)) {
        pairedDevices.push(deviceId);
        localStorage.setItem(
          "joulePairedDevices",
          JSON.stringify(pairedDevices)
        );
      }

      return data;
    } catch (innerError) {
      clearTimeout(timeoutId);
      if (innerError.name === 'AbortError') {
        throw new Error("Pairing timed out after 45 seconds. The device may not be responding. Please check:\n1. The pairing code is correct\n2. The device is in pairing mode\n3. Both devices are on the same network");
      }
      // Preserve the detailed error message from the backend
      throw innerError;
    }
  } catch (error) {
    console.error("Error pairing device:", error);
    // If error has a message, preserve it; otherwise create a generic one
    if (!error.message) {
      error.message = error.toString();
    }
    throw error;
  }
}

/**
 * Unpair from a device
 */
export async function unpairDevice(deviceId) {
  try {
    await bridgeRequest("/api/unpair", {
      method: "POST",
      body: JSON.stringify({ device_id: deviceId }),
    });

    // Refresh paired devices list from API (this will update localStorage automatically)
    // This ensures we get the current state from the server
    await getPairedDevices();
  } catch (error) {
    console.error("Error unpairing device:", error);
    throw error;
  }
}

/**
 * Get list of paired devices
 * First tries to fetch from API, falls back to localStorage cache
 */
export async function getPairedDevices() {
  try {
    // Try to fetch from API first (most up-to-date)
    try {
      const pairedData = await bridgeRequest("/api/paired");
      // Always update localStorage with the current state from API
      // This ensures cache is cleared when devices are unpaired
      const deviceIds = pairedData.devices ? pairedData.devices.map(d => d.device_id) : [];
      localStorage.setItem("joulePairedDevices", JSON.stringify(deviceIds));
      return deviceIds;
    } catch (e) {
      // API call failed, fall back to localStorage cache
      console.debug("Could not fetch paired devices from API, using cache:", e);
    }
    
    // Fallback to localStorage cache
    const stored = localStorage.getItem("joulePairedDevices");
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Get thermostat status
 */
export async function getThermostatStatus(deviceId = null) {
  try {
    // Handle string "null" or empty string
    if (deviceId === "null" || deviceId === null || deviceId === undefined || deviceId === "") {
      deviceId = null;
    }
    
    // If no deviceId provided, try to get it from paired devices API
    if (!deviceId) {
      try {
        const pairedData = await bridgeRequest("/api/paired");
        if (pairedData.devices && pairedData.devices.length > 0) {
          // Use the first paired device
          deviceId = pairedData.devices[0].device_id;
          // Save it as primary if not already set
          if (!localStorage.getItem("joulePrimaryDeviceId")) {
            localStorage.setItem("joulePrimaryDeviceId", deviceId);
          }
        } else {
          // No paired devices - return null instead of making a request
          return null;
        }
      } catch (e) {
        // If we can't get paired devices, return null instead of making a request with null
        console.debug("Could not fetch paired devices:", e);
        return null;
      }
    }
    
    // Only make the request if we have a valid deviceId
    if (!deviceId || deviceId === "null") {
      return null;
    }
    
    const endpoint = `/api/status?device_id=${encodeURIComponent(deviceId)}`;
    const data = await bridgeRequest(endpoint);

    // Handle null/undefined response
    if (!data) {
      return null;
    }

    // If single device, return it; if multiple, return first
    if (data.devices && Array.isArray(data.devices)) {
      return data.devices[0] || null;
    }

    return data;
  } catch (error) {
    // Only log non-connection errors (connection refused is expected when Bridge isn't available)
    if (!(error instanceof BridgeConnectionError)) {
      console.error("Error getting thermostat status:", error);
    }
    throw error;
  }
}

/**
 * Set target temperature
 */
export async function setTemperature(deviceId, temperature) {
  try {
    await bridgeRequest("/api/set-temperature", {
      method: "POST",
      body: JSON.stringify({
        device_id: deviceId,
        temperature: parseFloat(temperature),
      }),
    });
    return { success: true };
  } catch (error) {
    console.error("Error setting temperature:", error);
    throw error;
  }
}

/**
 * Set HVAC mode
 */
export async function setMode(deviceId, mode) {
  try {
    await bridgeRequest("/api/set-mode", {
      method: "POST",
      body: JSON.stringify({
        device_id: deviceId,
        mode: mode.toLowerCase(),
      }),
    });
    return { success: true };
  } catch (error) {
    console.error("Error setting mode:", error);
    throw error;
  }
}

/**
 * Check if Joule Bridge is available
 * @returns {Promise<boolean>} True if bridge is available, false otherwise
 * @throws {Error} If there's a specific error that should be displayed to the user
 */
export async function checkBridgeHealth() {
  // Try to get URL, but don't throw if not configured - just return false
  let url;
  try {
    url = getBridgeUrl();
  } catch (e) {
    // URL not configured - return false instead of throwing
    return false;
  }
  
  // Validate URL format
  try {
    new URL(url);
  } catch (e) {
    throw new Error(`Invalid URL format: ${url}. Use format: http://hostname:port`);
  }
  
  // Create AbortController for timeout (more compatible than AbortSignal.timeout)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
  
  try {
    const response = await fetch(`${url}/health`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
      },
      // Don't include credentials for local requests
      credentials: "omit",
    });
    
    clearTimeout(timeoutId);
    
    // Check if response is ok (status 200-299)
    if (!response.ok) {
      throw new Error(`Health check failed with status ${response.status}. The bridge may be running but returned an error.`);
    }
    
    // Try to parse JSON to ensure it's a valid response
    try {
      const data = await response.json();
      // Check if response has expected structure (status: 'ok' or 'healthy')
      // But also accept any valid JSON response with 200 status as success
      return true;
    } catch (parseError) {
      // If we can't parse JSON, but got a 200 response, still consider it ok
      return response.ok;
    }
  } catch (fetchError) {
    clearTimeout(timeoutId);
    
    // If it's an abort error, it's a timeout
    if (fetchError.name === 'AbortError') {
      throw new Error('Connection timeout - bridge did not respond within 30 seconds. Make sure the bridge is running.');
    }
    
    // Check for common network errors
    if (fetchError.message && (
      fetchError.message.includes('Failed to fetch') ||
      fetchError.message.includes('ERR_CONNECTION_REFUSED') ||
      fetchError.message.includes('NetworkError') ||
      fetchError.message.includes('ERR_NETWORK')
    )) {
      throw new Error(`Cannot connect to bridge at ${url}. Make sure the bridge is running and the URL is correct.`);
    }
    
    // Re-throw with context for better error messages
    throw fetchError;
  }
}

/**
 * Diagnose pairing and connection issues
 * Returns diagnostic information about paired vs discovered devices
 */
export async function diagnoseBridge() {
  return bridgeRequest("/api/diagnose");
}

/**
 * Automatically fix pairing mismatches
 * Unpairs stale devices and suggests pairing new ones
 */
export async function autoFixPairing() {
  return bridgeRequest("/api/auto-fix", { method: "POST" });
}

/**
 * Get the primary paired device ID from server (single source of truth)
 * Uses /api/primary endpoint which validates the device is actually reachable
 */
export async function getPrimaryDeviceId() {
  try {
    // Use the server's /api/primary endpoint as single source of truth
    try {
      const primaryData = await bridgeRequest("/api/primary");
      if (primaryData.device_id) {
        // Cache it for offline/fallback scenarios
        localStorage.setItem("joulePrimaryDeviceId", primaryData.device_id);
        
        // Log if device is paired but not validated (not reachable)
        if (!primaryData.validated) {
          console.warn(`Primary device ${primaryData.device_id} is paired but not reachable:`, primaryData.error);
        }
        
        return primaryData.device_id;
      } else {
        // No device paired - clear stale cache
        localStorage.removeItem("joulePrimaryDeviceId");
      }
    } catch (e) {
      // If /api/primary fails, fall back to /api/paired
      console.debug("Could not fetch primary device, falling back to paired list:", e);
      try {
        const pairedData = await bridgeRequest("/api/paired");
        if (pairedData.devices && pairedData.devices.length > 0) {
          const firstDeviceId = pairedData.devices[0].device_id;
          localStorage.setItem("joulePrimaryDeviceId", firstDeviceId);
          return firstDeviceId;
        } else {
          // No devices paired - clear stale cache
          localStorage.removeItem("joulePrimaryDeviceId");
        }
      } catch (e2) {
        console.debug("Could not fetch paired devices either:", e2);
      }
    }
    
    // No devices paired - return null (don't use stale cache)
    return null;
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Set the primary device ID
 */
export function setPrimaryDeviceId(deviceId) {
  try {
    localStorage.setItem("joulePrimaryDeviceId", deviceId);
  } catch (error) {
    console.warn("Failed to store primary device ID:", error);
  }
}

/**
 * Get relay status
 */
export async function getRelayStatus() {
  try {
    const data = await bridgeRequest("/api/relay/status");
    return data;
  } catch (error) {
    // Only log non-connection errors (connection refused is expected when Bridge isn't available)
    if (!(error instanceof BridgeConnectionError)) {
      console.error("Error getting relay status:", error);
    }
    throw error;
  }
}

/**
 * Control relay manually
 */
export async function controlRelay(channel, on) {
  try {
    await bridgeRequest("/api/relay/control", {
      method: "POST",
      body: JSON.stringify({
        channel: channel || 2, // Default to channel 2 (Y2 terminal)
        on: on,
      }),
    });
    return { success: true };
  } catch (error) {
    console.error("Error controlling relay:", error);
    throw error;
  }
}

/**
 * Update system state for interlock logic
 */
export async function updateSystemState(state) {
  try {
    const data = await bridgeRequest("/api/system-state", {
      method: "POST",
      body: JSON.stringify(state),
    });
    return data;
  } catch (error) {
    console.error("Error updating system state:", error);
    throw error;
  }
}

/**
 * Evaluate interlock logic
 */
export async function evaluateInterlock() {
  try {
    const data = await bridgeRequest("/api/interlock/evaluate", {
      method: "POST",
    });
    return data;
  } catch (error) {
    console.error("Error evaluating interlock:", error);
    throw error;
  }
}

/**
 * Get Blueair status
 */
export async function getBlueairStatus(deviceIndex = 0) {
  try {
    const data = await bridgeRequest(
      `/api/blueair/status?device_index=${deviceIndex}`
    );
    return data;
  } catch (error) {
    // Handle 404s gracefully (Blueair not configured or not available)
    // Don't log or throw - just return null silently
    if (error.status === 404 || error.isNotFound || 
        (error.message && (
          error.message.includes('404') || 
          error.message.includes('Device not found') ||
          error.message.includes('Not Found')
        ))) {
      return null;
    }
    // Only log non-connection errors (connection refused is expected when Bridge isn't available)
    if (!(error instanceof BridgeConnectionError)) {
      console.debug("Error getting Blueair status:", error); // Changed to debug to reduce noise
    }
    throw error;
  }
}

/**
 * Control Blueair fan speed
 */
export async function controlBlueairFan(deviceIndex = 0, speed = 0) {
  try {
    await bridgeRequest("/api/blueair/fan", {
      method: "POST",
      body: JSON.stringify({
        device_index: deviceIndex,
        speed: speed, // 0=off, 1=low, 2=medium, 3=max
      }),
    });
    return { success: true };
  } catch (error) {
    console.error("Error controlling Blueair fan:", error);
    throw error;
  }
}

/**
 * Control Blueair LED brightness
 */
export async function controlBlueairLED(deviceIndex = 0, brightness = 100) {
  try {
    await bridgeRequest("/api/blueair/led", {
      method: "POST",
      body: JSON.stringify({
        device_index: deviceIndex,
        brightness: brightness, // 0-100
      }),
    });
    return { success: true };
  } catch (error) {
    console.error("Error controlling Blueair LED:", error);
    throw error;
  }
}

/**
 * Start Dust Kicker cycle
 */
export async function startDustKickerCycle() {
  try {
    const data = await bridgeRequest("/api/blueair/dust-kicker", {
      method: "POST",
    });
    return data;
  } catch (error) {
    console.error("Error starting Dust Kicker cycle:", error);
    throw error;
  }
}

/**
 * Get Blueair credentials status
 */
export async function getBlueairCredentials() {
  try {
    const data = await bridgeRequest("/api/blueair/credentials", {
      method: "GET",
    });
    return data;
  } catch (error) {
    console.error("Error getting Blueair credentials:", error);
    throw error;
  }
}

/**
 * Set Blueair credentials
 */
export async function setBlueairCredentials(username, password) {
  try {
    const data = await bridgeRequest("/api/blueair/credentials", {
      method: "POST",
      body: JSON.stringify({
        username,
        password,
      }),
    });
    return data;
  } catch (error) {
    console.error("Error setting Blueair credentials:", error);
    throw error;
  }
}

