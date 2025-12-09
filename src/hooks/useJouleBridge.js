import { useState, useEffect, useCallback } from "react";
import {
  getThermostatStatus,
  setTemperature as bridgeSetTemperature,
  setMode as bridgeSetMode,
  getPrimaryDeviceId,
  checkBridgeHealth,
  BridgeConnectionError,
} from "../lib/jouleBridgeApi";

/**
 * React hook for Joule Bridge (HomeKit HAP) integration
 *
 * @param {string} deviceId - Optional specific device ID, otherwise uses primary device
 * @param {number} pollInterval - Polling interval in milliseconds (default: 5000 = 5 seconds)
 * @returns {Object} Bridge state and control functions
 */
export function useJouleBridge(deviceId = null, pollInterval = 5000) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [bridgeAvailable, setBridgeAvailable] = useState(false);
  const [thermostatData, setThermostatData] = useState(null);
  const [isPolling, setIsPolling] = useState(false);

  // Get device ID (use provided, or primary, or first available)
  const activeDeviceId = deviceId || getPrimaryDeviceId();

  // Check bridge health
  const checkHealth = useCallback(async () => {
    const available = await checkBridgeHealth();
    setBridgeAvailable(available);
    return available;
  }, []);

  // Fetch thermostat data
  const fetchThermostatData = useCallback(async () => {
    if (!activeDeviceId) {
      setError("No device paired. Please pair a device first.");
      setConnected(false);
      setLoading(false);
      return null;
    }

    try {
      setError(null);
      const data = await getThermostatStatus(activeDeviceId);

      if (data) {
        // Normalize data format to match Ecobee API format
        const normalized = {
          identifier: data.device_id,
          name: data.name || "Ecobee Thermostat",
          temperature: data.temperature || null,
          humidity: data.humidity || null, // May not be available via HAP
          targetHeatTemp: data.mode === "heat" ? data.target_temperature : null,
          targetCoolTemp: data.mode === "cool" ? data.target_temperature : null,
          mode: data.mode || "off",
          fanMode: "auto", // Default
          isAway: false, // May need separate implementation
          equipmentStatus:
            data.current_mode !== undefined
              ? { 0: "idle", 1: "heating", 2: "cooling", 3: "auto" }[
                  data.current_mode
                ] || "idle"
              : "idle",
          motionDetected: data.motion_detected || false, // From system state
          motionSensors: data.motion_sensors || [], // From system state
        };

        setThermostatData(normalized);
        setConnected(true);
        setLoading(false);
        return normalized;
      }

      setConnected(false);
      setLoading(false);
      return null;
    } catch (err) {
      // Only log non-connection errors (connection refused is expected when Bridge isn't available)
      if (!(err instanceof BridgeConnectionError)) {
        console.error("Error fetching Joule Bridge data:", err);
      }
      setError(err.message);
      setConnected(false);
      setLoading(false);
      return null;
    }
  }, [activeDeviceId]);

  // Start polling
  useEffect(() => {
    // Check bridge health first
    checkHealth().then((available) => {
      if (!available) {
        setError("Joule Bridge not available. Is the Bridge running?");
        setLoading(false);
        return;
      }

      // Initial fetch
      fetchThermostatData();

      // Set up polling
      setIsPolling(true);
      const interval = setInterval(() => {
        fetchThermostatData();
      }, pollInterval);

      return () => {
        clearInterval(interval);
        setIsPolling(false);
      };
    });
  }, [fetchThermostatData, pollInterval, checkHealth]);

  // Control functions
  const setTemp = useCallback(
    async (heatTemp, coolTemp) => {
      if (!activeDeviceId) {
        throw new Error("No device paired");
      }

      try {
        setError(null);
        // Use the appropriate temp based on current mode
        const temp = thermostatData?.mode === "cool" ? coolTemp : heatTemp;
        await bridgeSetTemperature(activeDeviceId, temp);
        // Refresh data after setting
        await fetchThermostatData();
        return { success: true };
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [activeDeviceId, thermostatData?.mode, fetchThermostatData]
  );

  const setMode = useCallback(
    async (mode) => {
      if (!activeDeviceId) {
        throw new Error("No device paired");
      }

      try {
        setError(null);
        await bridgeSetMode(activeDeviceId, mode);
        // Refresh data after setting
        await fetchThermostatData();
        return { success: true };
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [activeDeviceId, fetchThermostatData]
  );

  // Away mode (may need custom implementation via HAP)
  const setAway = useCallback(
    async (enabled, heatTemp = null, coolTemp = null) => {
      // TODO: Implement away mode via HAP
      // For now, just set temperatures
      if (enabled && (heatTemp !== null || coolTemp !== null)) {
        await setTemp(heatTemp || 62, coolTemp || 85);
      }
      return { success: true };
    },
    [setTemp]
  );

  const resume = useCallback(async () => {
    // Resume schedule - may need custom implementation
    return { success: true };
  }, []);

  return {
    // State
    loading,
    error,
    connected,
    bridgeAvailable,
    thermostatData,
    isPolling,

    // Data (convenience accessors)
    temperature: thermostatData?.temperature || null,
    humidity: thermostatData?.humidity || null,
    targetHeatTemp: thermostatData?.targetHeatTemp || null,
    targetCoolTemp: thermostatData?.targetCoolTemp || null,
    mode: thermostatData?.mode || null,
    fanMode: thermostatData?.fanMode || null,
    isAway: thermostatData?.isAway || false,
    equipmentStatus: thermostatData?.equipmentStatus || null,
    name: thermostatData?.name || null,

    // Control functions
    setTemperature: setTemp,
    setMode,
    setAway,
    resume,
    refresh: fetchThermostatData,
    checkHealth,
  };
}

