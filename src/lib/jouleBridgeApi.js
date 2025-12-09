/**
 * Joule Bridge API Client
 * Communicates with the Raspberry Pi backend running the HAP controller
 *
 * This replaces the direct Ecobee API calls with local HAP protocol calls
 */

const JOULE_BRIDGE_URL =
  import.meta.env.VITE_JOULE_BRIDGE_URL || "http://localhost:8080";

/**
 * Get Joule Bridge URL from settings or use default
 */
function getBridgeUrl() {
  try {
    const url = localStorage.getItem("jouleBridgeUrl");
    return url || JOULE_BRIDGE_URL;
  } catch {
    return JOULE_BRIDGE_URL;
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
  const url = getBridgeUrl();
  try {
    const response = await fetch(`${url}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Joule Bridge error: ${response.status} ${error}`);
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
 */
export async function discoverDevices() {
  try {
    const data = await bridgeRequest("/api/discover");
    return data.devices || [];
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
    const data = await bridgeRequest("/api/pair", {
      method: "POST",
      body: JSON.stringify({
        device_id: deviceId,
        pairing_code: pairingCode,
      }),
    });

    // Store paired device
    const pairedDevices = getPairedDevices();
    if (!pairedDevices.includes(deviceId)) {
      pairedDevices.push(deviceId);
      localStorage.setItem(
        "joulePairedDevices",
        JSON.stringify(pairedDevices)
      );
    }

    return data;
  } catch (error) {
    console.error("Error pairing device:", error);
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

    // Remove from stored list
    const pairedDevices = getPairedDevices().filter((id) => id !== deviceId);
    localStorage.setItem("joulePairedDevices", JSON.stringify(pairedDevices));
  } catch (error) {
    console.error("Error unpairing device:", error);
    throw error;
  }
}

/**
 * Get list of paired devices
 */
export function getPairedDevices() {
  try {
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
    const endpoint = deviceId
      ? `/api/status?device_id=${encodeURIComponent(deviceId)}`
      : "/api/status";

    const data = await bridgeRequest(endpoint);

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
 */
export async function checkBridgeHealth() {
  try {
    const url = getBridgeUrl();
    const response = await fetch(`${url}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Get the primary paired device ID (first one, or from settings)
 */
export function getPrimaryDeviceId() {
  try {
    const stored = localStorage.getItem("joulePrimaryDeviceId");
    if (stored) return stored;

    // Fallback to first paired device
    const paired = getPairedDevices();
    return paired[0] || null;
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
    // Only log non-connection errors (connection refused is expected when Bridge isn't available)
    if (!(error instanceof BridgeConnectionError)) {
      console.error("Error getting Blueair status:", error);
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

