import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getThermostatStatus,
  setTemperature as bridgeSetTemperature,
  setMode as bridgeSetMode,
  getPrimaryDeviceId,
  checkBridgeHealth,
  BridgeConnectionError,
} from "../lib/jouleBridgeApi";

/**
 * Context for Joule Bridge state - shared across all pages
 * This prevents data from being cleared when navigating between pages
 */
const JouleBridgeContext = createContext(null);

/**
 * Joule Bridge Provider - wraps the app to provide shared bridge state
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} props.deviceId - Optional specific device ID
 * @param {number} props.pollInterval - Polling interval in ms (default: 5000)
 */
export function JouleBridgeProvider({ children, deviceId = null, pollInterval = 5000 }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [bridgeAvailable, setBridgeAvailable] = useState(false);
  const [thermostatData, setThermostatData] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [primaryId, setPrimaryId] = useState(null);
  const [initialized, setInitialized] = useState(false);

  // Get device ID (use provided, or primary, or first available)
  const activeDeviceId = (deviceId && deviceId !== "null") 
    ? deviceId 
    : (primaryId && primaryId !== "null" ? primaryId : null);

  // Check bridge health
  const checkHealth = useCallback(async () => {
    try {
      const available = await checkBridgeHealth();
      setBridgeAvailable(available);
      return available;
    } catch (err) {
      setBridgeAvailable(false);
      return false;
    }
  }, []);

  // Fetch thermostat data
  const fetchThermostatData = useCallback(async () => {
    let deviceIdToUse = activeDeviceId;
    
    if (!deviceIdToUse) {
      try {
        const id = await getPrimaryDeviceId();
        if (id) {
          deviceIdToUse = id;
          setPrimaryId(id);
        }
      } catch (e) {
        console.debug("Could not get primary device ID:", e);
      }
    }
    
    if (!deviceIdToUse) {
      setError("No device paired. Please pair a device first.");
      setConnected(false);
      setLoading(false);
      return null;
    }

    try {
      setError(null);
      const data = await getThermostatStatus(deviceIdToUse);

      if (data) {
        const normalized = {
          identifier: data.device_id,
          name: data.name || "Ecobee Thermostat",
          temperature: data.temperature || null,
          humidity: data.humidity || null,
          targetHeatTemp: data.mode === "heat" ? data.target_temperature : null,
          targetCoolTemp: data.mode === "cool" ? data.target_temperature : null,
          mode: data.mode || "off",
          fanMode: "auto",
          isAway: false,
          equipmentStatus:
            data.current_mode !== undefined
              ? { 0: "idle", 1: "heating", 2: "cooling", 3: "auto" }[data.current_mode] || "idle"
              : "idle",
          motionDetected: data.motion_detected || false,
          motionSensors: data.motion_sensors || [],
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
      if (!(err instanceof BridgeConnectionError)) {
        console.error("Error fetching Joule Bridge data:", err);
      }
      setError(err.message);
      setConnected(false);
      setLoading(false);
      return null;
    }
  }, [activeDeviceId]);

  // Fetch primary device ID on mount
  useEffect(() => {
    getPrimaryDeviceId().then(id => {
      setPrimaryId(id);
    });
  }, []);

  // Initialize and start polling - only once
  useEffect(() => {
    if (initialized) return;
    
    let interval = null;
    let mounted = true;
    
    const init = async () => {
      const available = await checkHealth();
      
      if (!mounted) return;
      
      if (!available) {
        setError("Joule Bridge not available. Is the Bridge running?");
        setLoading(false);
        setInitialized(true);
        return;
      }

      // Initial fetch
      await fetchThermostatData();
      
      if (!mounted) return;
      
      // Set up polling
      setIsPolling(true);
      interval = setInterval(() => {
        if (mounted) {
          fetchThermostatData();
        }
      }, pollInterval);
      
      setInitialized(true);
    };
    
    init();

    return () => {
      mounted = false;
      if (interval) {
        clearInterval(interval);
      }
      setIsPolling(false);
    };
  }, [initialized, checkHealth, fetchThermostatData, pollInterval]);

  // Control functions
  const setTemp = useCallback(
    async (heatTemp, coolTemp) => {
      if (!activeDeviceId) {
        throw new Error("No device paired");
      }

      try {
        setError(null);
        const temp = thermostatData?.mode === "cool" ? coolTemp : heatTemp;
        await bridgeSetTemperature(activeDeviceId, temp);
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
        await fetchThermostatData();
        return { success: true };
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [activeDeviceId, fetchThermostatData]
  );

  const setAway = useCallback(
    async (enabled, heatTemp = null, coolTemp = null) => {
      if (enabled && (heatTemp !== null || coolTemp !== null)) {
        await setTemp(heatTemp || 62, coolTemp || 85);
      }
      return { success: true };
    },
    [setTemp]
  );

  const resume = useCallback(async () => {
    return { success: true };
  }, []);

  const value = {
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
    targetTemperature: thermostatData?.targetHeatTemp || thermostatData?.targetCoolTemp || null,
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

  return (
    <JouleBridgeContext.Provider value={value}>
      {children}
    </JouleBridgeContext.Provider>
  );
}

/**
 * Hook to access Joule Bridge context
 * Must be used within a JouleBridgeProvider
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useJouleBridgeContext() {
  const context = useContext(JouleBridgeContext);
  if (context === null) {
    throw new Error('useJouleBridgeContext must be used within a JouleBridgeProvider');
  }
  return context;
}

/**
 * Hook to check if JouleBridgeProvider is available
 * Returns null if not within provider (for backwards compatibility)
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useOptionalJouleBridge() {
  return useContext(JouleBridgeContext);
}

